import { callable } from "agents";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import { convertToModelMessages, streamText } from "ai";
import { getModel } from "../lib/llm";
import { INTERVIEWER_PROMPT, render } from "../lib/prompts";
import {
  INITIAL_INTERVIEW_STATE,
  type InterviewConfig,
  type InterviewState
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
      memory_bank: "",
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
}
