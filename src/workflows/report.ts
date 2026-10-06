import {
  AgentWorkflow,
  type AgentWorkflowEvent,
  type AgentWorkflowStep
} from "agents/workflows";
import { getAgentByName } from "agents";
import { generateText, Output } from "ai";
import type { InterviewAgent } from "../agents/interview";
import { getModel } from "../lib/llm";
import { formatMemoryBank } from "../lib/memory";
import {
  MEMORY_EXTRACTION_PROMPT,
  REPORT_PROMPT,
  render
} from "../lib/prompts";
import {
  clampScore,
  extractedMemoriesSchema,
  finalReportSchema
} from "../lib/schemas";
import {
  candidateTurnCount,
  formatTranscript,
  type TranscriptLine
} from "../lib/transcript";
import type { FinalReport, TurnLog } from "../lib/types";

export type ReportParams = {
  sessionId: string;
  userId: string;
  role: string;
  transcript: TranscriptLine[];
  turns: Pick<
    TurnLog,
    "current_score" | "plagiarism_score" | "session_plagiarism_score"
  >[];
};

const LLM_STEP = {
  retries: { limit: 3, delay: "5 seconds", backoff: "exponential" },
  timeout: "2 minutes"
} as const;

/** Hard caps from the rubric, enforced in code rather than trusted to the model. */
export function applyScoreCaps(score: number, turnCount: number): number {
  if (turnCount < 3) return Math.min(score, 20);
  if (turnCount < 5) return Math.min(score, 39);
  return score;
}

const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

/**
 * Durable post-interview pipeline. Each step is checkpointed and retried
 * independently, so a transient LLM or storage failure never loses the
 * candidate's report.
 *
 *   score-transcript → blend-scores → extract-memories → save-memories → save-session
 */
export class InterviewReportWorkflow extends AgentWorkflow<
  InterviewAgent,
  ReportParams
> {
  async run(event: AgentWorkflowEvent<ReportParams>, step: AgentWorkflowStep) {
    const { sessionId, userId, role, transcript, turns } = event.payload;
    const transcriptText = formatTranscript(transcript);
    const turnCount = candidateTurnCount(transcript);

    await this.reportProgress({
      step: "score-transcript",
      message: "Scoring the full interview",
      percent: 0.1
    });
    const draft = await step.do("score-transcript", LLM_STEP, async () => {
      const { output } = await generateText({
        model: await getModel(this.env, "report"),
        output: Output.object({ schema: finalReportSchema }),
        system: render(REPORT_PROMPT, { role, turn_count: String(turnCount) }),
        prompt: transcriptText || "(The candidate did not answer anything.)",
        temperature: 0.3
      });
      return output;
    });

    await this.reportProgress({
      step: "blend-scores",
      message: "Combining live and final scores",
      percent: 0.4
    });
    const report = await step.do("blend-scores", async () => {
      const llmScore = clampScore(draft.score);
      // Skip the greeting turn; it carries no signal.
      const scored = turns.slice(1).map((t) => t.current_score);
      const averageTurnScore = mean(scored);
      const integrityRisk = clampScore(
        Math.max(
          turns.at(-1)?.session_plagiarism_score ?? 0,
          mean(turns.slice(1).map((t) => t.plagiarism_score)) ?? 0
        )
      );
      const integrityFlag = integrityRisk > 70;

      let score =
        averageTurnScore === null
          ? llmScore
          : 0.7 * llmScore + 0.3 * averageTurnScore;
      score = applyScoreCaps(clampScore(score), turnCount);
      if (integrityFlag) score = Math.min(score, 50);

      const result: FinalReport = {
        score,
        llmScore,
        averageTurnScore:
          averageTurnScore === null ? null : Math.round(averageTurnScore),
        integrityRisk,
        integrityFlag,
        strengths: draft.strengths.slice(0, 3),
        weaknesses: draft.weaknesses.slice(0, 3),
        summary: draft.summary,
        turnCount,
        memoriesSaved: 0
      };
      return result;
    });

    await this.reportProgress({
      step: "extract-memories",
      message: "Updating your memory bank",
      percent: 0.6
    });
    const memories = await step.do("extract-memories", LLM_STEP, async () => {
      if (turnCount === 0) return [];
      const user = await getAgentByName(this.env.UserAgent, userId);
      const known = await user.listMemories(50);
      const { output } = await generateText({
        model: await getModel(this.env, "report"),
        output: Output.object({ schema: extractedMemoriesSchema }),
        system: render(MEMORY_EXTRACTION_PROMPT, {
          known_facts: formatMemoryBank(known)
        }),
        prompt: transcriptText,
        temperature: 0.2
      });
      return output.memories.slice(0, 5);
    });

    const memoriesSaved = await step.do("save-memories", async () => {
      const user = await getAgentByName(this.env.UserAgent, userId);
      return user.addMemories(memories, sessionId);
    });

    await this.reportProgress({
      step: "save-session",
      message: "Saving to your history",
      percent: 0.9
    });
    await step.do("save-session", async () => {
      const user = await getAgentByName(this.env.UserAgent, userId);
      await user.saveSession({
        id: sessionId,
        role,
        score: report.score,
        summary: report.summary,
        strengths: report.strengths,
        weaknesses: report.weaknesses,
        integrityRisk: report.integrityRisk,
        turnCount: report.turnCount,
        createdAt: Date.now()
      });
    });

    const final: FinalReport = { ...report, memoriesSaved };
    await step.reportComplete(final);
    return final;
  }
}
