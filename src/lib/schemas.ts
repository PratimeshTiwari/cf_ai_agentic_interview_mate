import { z } from "zod";

export const INTERVIEW_PHASES = [
  "Introduction",
  "Discovery",
  "Technical Deep Dive",
  "Behavioral Check",
  "Feedback & Close"
] as const;

export const MEMORY_TYPES = [
  "skill",
  "experience",
  "preference",
  "weakness",
  "fact"
] as const;

export const memorySchema = z.object({
  text: z
    .string()
    .describe("One short, self-contained fact about the candidate"),
  type: z.enum(MEMORY_TYPES)
});

/** Silent per-turn analysis produced after every interviewer reply. */
export const turnAnalysisSchema = z.object({
  phase: z.enum(INTERVIEW_PHASES).describe("Phase the interview is in now"),
  user_persona: z
    .enum(["Normal", "Efficient", "Confused", "Chatty", "Adversarial"])
    .describe("How the candidate is behaving"),
  answer_quality: z.enum([
    "Strong",
    "Adequate",
    "Weak",
    "Irrelevant",
    "AI-Suspected"
  ]),
  reasoning: z.string().describe("Why the interviewer chose the next step"),
  current_score: z
    .number()
    .describe(
      "Overall standing so far, re-evaluated over the whole conversation"
    ),
  behavior_log: z
    .string()
    .describe("Observation of tone, hesitation, confidence and phrasing"),
  plagiarism_score: z
    .number()
    .describe("Likelihood the latest answer was read, pasted or AI-generated"),
  session_plagiarism_score: z
    .number()
    .describe("Likelihood of assisted answers across the whole session"),
  feedback: z
    .string()
    .describe("One-line private coaching note on the latest answer"),
  memory: memorySchema
    .nullable()
    .describe("A durable fact worth remembering for future sessions, or null")
});

export type TurnAnalysis = z.infer<typeof turnAnalysisSchema>;
export type MemoryItem = z.infer<typeof memorySchema>;

/** Final evaluation produced by the report workflow. */
export const finalReportSchema = z.object({
  score: z.number(),
  strengths: z.array(z.string()).describe("2-3 key strengths"),
  weaknesses: z.array(z.string()).describe("2-3 areas for improvement"),
  summary: z.string().describe("At most 3 sentences")
});

export type FinalReportDraft = z.infer<typeof finalReportSchema>;

export const extractedMemoriesSchema = z.object({
  memories: z.array(memorySchema)
});

export const clampScore = (n: unknown): number => {
  const value = Number(n);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};
