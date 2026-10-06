import { callable, getAgentByName } from "agents";
import {
  AIChatAgent,
  type ChatResponseResult,
  type OnChatMessageOptions
} from "@cloudflare/ai-chat";
import { convertToModelMessages, generateText, Output, streamText } from "ai";
import { getModel } from "../lib/llm";
import { formatMemoryBank } from "../lib/memory";
import { ANALYZER_PROMPT, INTERVIEWER_PROMPT, render } from "../lib/prompts";
import { clampScore, turnAnalysisSchema } from "../lib/schemas";
import { formatTranscript, messageText, toTranscript } from "../lib/transcript";
import type { ReportParams } from "../workflows/report";
import {
  INITIAL_INTERVIEW_STATE,
  type FinalReport,
  type InterviewConfig,
  type InterviewState,
  type TurnLog
} from "../lib/types";

/**
 * One InterviewAgent instance (a Durable Object) per interview session.
 * It owns the transcript (persisted to SQLite by AIChatAgent) and the live
 * interview state, which is synced to every connected client.
 */
/** End the session after this long without candidate activity. */
export const INACTIVITY_LIMIT_SECONDS = 120;

export class InterviewAgent extends AIChatAgent<Env, InterviewState> {
  initialState = INITIAL_INTERVIEW_STATE;
  maxPersistedMessages = 200;

  @callable()
  async configure(config: InterviewConfig) {
    if (this.state.status !== "setup") return this.state;
    this.setState({
      ...this.state,
      config: {
        userId: config.userId,
        candidateName: config.candidateName,
        role: config.role.trim() || "Software Engineer",
        resume: config.resume ?? "",
        jobDescription: config.jobDescription ?? ""
      },
      status: "active",
      startedAt: Date.now(),
      lastActivityAt: Date.now()
    });
    await this.schedule(INACTIVITY_LIMIT_SECONDS, "checkInactivity");
    return this.state;
  }

  /** Clients call this while the candidate is speaking, typing or listening. */
  @callable()
  async touch() {
    if (this.state.status !== "active") return;
    this.setState({ ...this.state, lastActivityAt: Date.now() });
  }

  /**
   * Scheduled watchdog. A single timer chain is kept alive: if there was
   * activity since it was scheduled, it re-arms itself for the remaining
   * time; otherwise it ends the interview.
   */
  async checkInactivity() {
    if (this.state.status !== "active") return;
    const idleMs = Date.now() - (this.state.lastActivityAt ?? 0);
    const limitMs = INACTIVITY_LIMIT_SECONDS * 1000;
    if (idleMs >= limitMs) {
      await this.endSession("timeout");
      return;
    }
    const remaining = Math.max(5, Math.ceil((limitMs - idleMs) / 1000));
    await this.schedule(remaining, "checkInactivity");
  }

  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const config = this.state.config;
    // Ignore messages before the session is configured or after it ended.
    if (!config || this.state.status !== "active") return undefined;
    this.setState({ ...this.state, lastActivityAt: Date.now() });

    const system = render(INTERVIEWER_PROMPT, {
      role: config.role,
      candidate_name: config.candidateName,
      resume: config.resume,
      job_description: config.jobDescription,
      memory_bank: formatMemoryBank(await this.recallForTurn(config.userId)),
      phase: this.state.phase
    });

    const result = streamText({
      model: await getModel(this.env, "interviewer"),
      system,
      messages: await convertToModelMessages(this.messages),
      temperature: 0.6,
      abortSignal: options?.abortSignal
    });

    return result.toUIMessageStreamResponse();
  }

  private userAgent(userId: string) {
    return getAgentByName(this.env.UserAgent, userId);
  }

  /** Pulls the facts most relevant to the candidate's latest answer. */
  private async recallForTurn(userId: string) {
    const lastUser = [...this.messages]
      .reverse()
      .find((m) => m.role === "user");
    const query = lastUser ? messageText(lastUser) : "";
    try {
      const user = await this.userAgent(userId);
      return await user.recallMemories(query || "candidate background", 5);
    } catch (error) {
      console.warn("Memory recall failed", error);
      return [];
    }
  }

  /**
   * Runs after every completed interviewer reply. A second, structured LLM
   * call scores the latest answer and updates the live HUD via setState.
   */
  protected async onChatResponse(result: ChatResponseResult) {
    if (result.status !== "completed" || this.state.status !== "active") {
      return;
    }
    // The idle clock restarts once the interviewer has finished speaking.
    this.setState({ ...this.state, lastActivityAt: Date.now() });
    await this.analyzeTurn();
  }

  private async analyzeTurn() {
    const config = this.state.config;
    if (!config) return;

    this.setState({ ...this.state, analyzing: true });
    try {
      const { output } = await generateText({
        model: await getModel(this.env, "analyzer"),
        output: Output.object({ schema: turnAnalysisSchema }),
        system: render(ANALYZER_PROMPT, {
          role: config.role,
          phase: this.state.phase
        }),
        prompt: formatTranscript(toTranscript(this.messages)),
        temperature: 0.2
      });

      const turn: TurnLog = {
        ...output,
        current_score: clampScore(output.current_score),
        plagiarism_score: clampScore(output.plagiarism_score),
        session_plagiarism_score: clampScore(output.session_plagiarism_score),
        turn: this.state.turns.length + 1,
        timestamp: Date.now()
      };

      this.setState({
        ...this.state,
        phase: turn.phase,
        turns: [...this.state.turns, turn],
        analyzing: false
      });

      if (output.memory) {
        try {
          const user = await this.userAgent(config.userId);
          await user.addMemories([output.memory], this.name);
        } catch (error) {
          console.warn("Saving turn memory failed", error);
        }
      }
    } catch (error) {
      console.error("Turn analysis failed", error);
      this.setState({ ...this.state, analyzing: false });
    }
  }

  /**
   * Ends the interview and hands the transcript to InterviewReportWorkflow.
   * The workflow reports progress and its final result back to this agent.
   */
  @callable()
  async endSession(reason: "manual" | "timeout" = "manual") {
    const config = this.state.config;
    if (!config || this.state.status !== "active") return this.state;

    this.setState({
      ...this.state,
      status: "ending",
      endedReason: reason,
      reportProgress: "Starting report"
    });

    const params: ReportParams = {
      sessionId: this.name,
      userId: config.userId,
      role: config.role,
      transcript: toTranscript(this.messages),
      turns: this.state.turns.map((t) => ({
        current_score: t.current_score,
        plagiarism_score: t.plagiarism_score,
        session_plagiarism_score: t.session_plagiarism_score
      }))
    };
    await this.runWorkflow("REPORT_WORKFLOW", params, {
      metadata: { userId: config.userId }
    });
    return this.state;
  }

  async onWorkflowProgress(
    _workflowName: string,
    _workflowId: string,
    progress: unknown
  ) {
    const message = (progress as { message?: string } | null)?.message;
    if (message) this.setState({ ...this.state, reportProgress: message });
  }

  async onWorkflowComplete(
    _workflowName: string,
    _workflowId: string,
    result?: unknown
  ) {
    if (!result) return;
    this.setState({
      ...this.state,
      status: "complete",
      reportProgress: null,
      report: result as FinalReport
    });
  }

  async onWorkflowError(
    _workflowName: string,
    _workflowId: string,
    error: string
  ) {
    console.error("Report workflow failed", error);
    this.setState({
      ...this.state,
      status: "complete",
      reportProgress: null,
      report: {
        score: 0,
        llmScore: 0,
        averageTurnScore: null,
        integrityRisk: 0,
        integrityFlag: false,
        strengths: [],
        weaknesses: [],
        summary:
          "The report could not be generated. Please try another session.",
        turnCount: 0,
        memoriesSaved: 0
      }
    });
  }
}
