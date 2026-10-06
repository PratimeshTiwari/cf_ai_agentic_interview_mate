import type { StoredMemory } from "./types";

export const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";

/** Embeds texts with Workers AI (768-dim bge-base vectors). */
export async function embed(env: Env, texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const result = (await env.AI.run(EMBEDDING_MODEL, { text: texts })) as {
    data?: number[][];
  };
  return result.data ?? [];
}

export function formatMemoryBank(memories: StoredMemory[]): string {
  if (memories.length === 0) return "";
  return memories.map((m) => `- [${m.type}] ${m.text}`).join("\n");
}
