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
import {
  INITIAL_INTERVIEW_STATE,
  type InterviewConfig,
  type InterviewState,
  type TurnLog
} from "../lib/types";

/**
 * One InterviewAgent instance (a Durable Object) per interview session.
 * It owns the transcript (persisted to SQLite by AIChatAgent) and the live
 * interview state, which is synced to every connected client.
 */
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
    return this.state;
  }

  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const config = this.state.config;
    // Ignore messages before the session is configured or after it ended.
    if (!config || this.state.status !== "active") return undefined;

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

      if (output.memory) {
        const user = await this.userAgent(config.userId);
        await user.addMemories([output.memory], this.name);
      }

      this.setState({
        ...this.state,
        phase: turn.phase,
        turns: [...this.state.turns, turn],
        analyzing: false
      });
    } catch (error) {
      console.error("Turn analysis failed", error);
      this.setState({ ...this.state, analyzing: false });
    }
  }
}
