import { callable } from "agents";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import { convertToModelMessages, streamText } from "ai";
import { getModel } from "../lib/llm";
import { embed, formatMemoryBank } from "../lib/memory";
import { COACH_PROMPT, render } from "../lib/prompts";
import type { MemoryItem } from "../lib/schemas";
import {
  INITIAL_USER_STATE,
  type SessionRecord,
  type StoredMemory,
  type UserProfile,
  type UserState
} from "../lib/types";

type SessionRow = {
  id: string;
  role: string;
  score: number;
  summary: string;
  strengths: string;
  weaknesses: string;
  integrity_risk: number;
  turn_count: number;
  created_at: number;
};

type MemoryRow = {
  id: string;
  text: string;
  type: MemoryItem["type"];
  session_id: string | null;
  created_at: number;
};

const toMemory = (row: MemoryRow): StoredMemory => ({
  id: row.id,
  text: row.text,
  type: row.type,
  sessionId: row.session_id,
  createdAt: row.created_at
});

const toSession = (row: SessionRow): SessionRecord => ({
  id: row.id,
  role: row.role,
  score: row.score,
  summary: row.summary,
  strengths: JSON.parse(row.strengths || "[]"),
  weaknesses: JSON.parse(row.weaknesses || "[]"),
  integrityRisk: row.integrity_risk,
  turnCount: row.turn_count,
  createdAt: row.created_at
});

/**
 * One UserAgent per candidate. It is the long-term memory of the system:
 * - SQLite tables hold interview history and remembered facts
 * - Vectorize holds embeddings of those facts for semantic recall
 * - agent state mirrors recent rows so the dashboard updates live
 */
export class UserAgent extends AIChatAgent<Env, UserState> {
  initialState = INITIAL_USER_STATE;
  maxPersistedMessages = 100;

  async onStart() {
    this.sql`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      score INTEGER NOT NULL,
      summary TEXT NOT NULL,
      strengths TEXT NOT NULL,
      weaknesses TEXT NOT NULL,
      integrity_risk INTEGER NOT NULL DEFAULT 0,
      turn_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`;
    this.sql`CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      type TEXT NOT NULL,
      session_id TEXT,
      created_at INTEGER NOT NULL
    )`;
  }

  @callable()
  async setProfile(profile: UserProfile) {
    this.setState({ ...this.state, profile });
    this.refreshView();
    return this.state;
  }

  listSessions(limit = 20): SessionRecord[] {
    return this.sql<SessionRow>`
      SELECT * FROM sessions ORDER BY created_at DESC LIMIT ${limit}
    `.map(toSession);
  }

  listMemories(limit = 50): StoredMemory[] {
    return this.sql<MemoryRow>`
      SELECT * FROM memories ORDER BY created_at DESC LIMIT ${limit}
    `.map(toMemory);
  }

  /**
   * Semantic recall: embed the query, search Vectorize scoped to this user,
   * then hydrate the matches from SQLite. Falls back to the most recent
   * memories when Vectorize is unavailable (e.g. offline local dev).
   */
  async recallMemories(query: string, limit = 5): Promise<StoredMemory[]> {
    const fallback = () => this.listMemories(limit);
    if (!query.trim()) return fallback();

    try {
      const [vector] = await embed(this.env, [query]);
      if (!vector) return fallback();
      const { matches } = await this.env.MEMORY_INDEX.query(vector, {
        topK: limit,
        filter: { userId: this.name }
      });
      const ids = new Set(matches.map((m) => m.id));
      if (ids.size === 0) return fallback();
      const all = this.sql<MemoryRow>`SELECT * FROM memories`;
      const byId = new Map(all.map((row) => [row.id, toMemory(row)]));
      return matches
        .map((m) => byId.get(m.id))
        .filter((m): m is StoredMemory => Boolean(m));
    } catch (error) {
      console.warn(
        "Vectorize recall unavailable, using recent memories",
        error
      );
      return fallback();
    }
  }

  /** Stores new facts (skipping exact duplicates) and indexes them. */
  async addMemories(
    items: MemoryItem[],
    sessionId: string | null
  ): Promise<number> {
    const existing = new Set(
      this.sql<{ text: string }>`SELECT text FROM memories`.map((r) =>
        r.text.trim().toLowerCase()
      )
    );
    const fresh: StoredMemory[] = [];
    for (const item of items) {
      const text = item.text.trim();
      if (!text || existing.has(text.toLowerCase())) continue;
      existing.add(text.toLowerCase());
      fresh.push({
        id: crypto.randomUUID(),
        text,
        type: item.type,
        sessionId,
        createdAt: Date.now()
      });
    }
    if (fresh.length === 0) return 0;

    for (const m of fresh) {
      this.sql`INSERT INTO memories (id, text, type, session_id, created_at)
        VALUES (${m.id}, ${m.text}, ${m.type}, ${m.sessionId}, ${m.createdAt})`;
    }

    try {
      const vectors = await embed(
        this.env,
        fresh.map((m) => m.text)
      );
      await this.env.MEMORY_INDEX.upsert(
        fresh.map((m, i) => ({
          id: m.id,
          values: vectors[i],
          metadata: { userId: this.name, type: m.type }
        }))
      );
    } catch (error) {
      console.warn("Vectorize upsert failed; memory kept in SQLite", error);
    }

    this.refreshView();
    return fresh.length;
  }

  async saveSession(record: SessionRecord) {
    this.sql`INSERT OR REPLACE INTO sessions
      (id, role, score, summary, strengths, weaknesses, integrity_risk, turn_count, created_at)
      VALUES (${record.id}, ${record.role}, ${record.score}, ${record.summary},
        ${JSON.stringify(record.strengths)}, ${JSON.stringify(record.weaknesses)},
        ${record.integrityRisk}, ${record.turnCount}, ${record.createdAt})`;
    this.refreshView();
  }

  @callable()
  async clearMemories() {
    const ids = this.sql<{ id: string }>`SELECT id FROM memories`.map(
      (r) => r.id
    );
    this.sql`DELETE FROM memories`;
    if (ids.length > 0) {
      try {
        await this.env.MEMORY_INDEX.deleteByIds(ids);
      } catch (error) {
        console.warn("Vectorize delete failed", error);
      }
    }
    this.refreshView();
  }

  /** Dashboard prep coach, grounded in this candidate's history and memory. */
  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const profile = this.state.profile;
    const recent = this.listSessions(3)
      .map(
        (s) =>
          `- ${new Date(s.createdAt).toDateString()} · ${s.role} · score ${s.score}. ` +
          `Strengths: ${s.strengths.join("; ")}. Improve: ${s.weaknesses.join("; ")}.`
      )
      .join("\n");

    const result = streamText({
      model: await getModel(this.env, "coach"),
      system: render(COACH_PROMPT, {
        candidate_name: profile?.name,
        role: profile?.role,
        recent_sessions: recent || "No interviews yet.",
        memory_bank: formatMemoryBank(this.listMemories(20))
      }),
      // The coach only needs recent context.
      messages: await convertToModelMessages(this.messages.slice(-20)),
      temperature: 0.7,
      abortSignal: options?.abortSignal
    });
    return result.toUIMessageStreamResponse();
  }

  private refreshView() {
    this.setState({
      ...this.state,
      sessions: this.listSessions(),
      memories: this.listMemories()
    });
  }
}
