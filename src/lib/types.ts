import type { MemoryItem, TurnAnalysis } from "./schemas";

/** Shared between the Worker (agents, workflow) and the React client. */

export type InterviewConfig = {
  userId: string;
  candidateName: string;
  role: string;
  resume: string;
  jobDescription: string;
};

export type TurnLog = TurnAnalysis & {
  turn: number;
  timestamp: number;
};

export type InterviewStatus = "setup" | "active" | "ending" | "complete";

export type FinalReport = {
  score: number;
  llmScore: number;
  averageTurnScore: number | null;
  integrityRisk: number;
  integrityFlag: boolean;
  strengths: string[];
  weaknesses: string[];
  summary: string;
  turnCount: number;
  memoriesSaved: number;
};

export type InterviewState = {
  status: InterviewStatus;
  config: InterviewConfig | null;
  phase: string;
  turns: TurnLog[];
  lastActivityAt: number | null;
  startedAt: number | null;
  endedReason: "manual" | "timeout" | null;
  reportProgress: string | null;
  report: FinalReport | null;
};

export const INITIAL_INTERVIEW_STATE: InterviewState = {
  status: "setup",
  config: null,
  phase: "Introduction",
  turns: [],
  lastActivityAt: null,
  startedAt: null,
  endedReason: null,
  reportProgress: null,
  report: null
};

export type StoredMemory = MemoryItem & {
  id: string;
  sessionId: string | null;
  createdAt: number;
};

export type SessionRecord = {
  id: string;
  role: string;
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  integrityRisk: number;
  turnCount: number;
  createdAt: number;
};

export type UserProfile = {
  id: string;
  name: string;
  role: string;
};

export type UserState = {
  profile: UserProfile | null;
  sessions: SessionRecord[];
  memories: StoredMemory[];
};

export const INITIAL_USER_STATE: UserState = {
  profile: null,
  sessions: [],
  memories: []
};
