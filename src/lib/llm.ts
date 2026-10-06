import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";

/**
 * Every LLM call in the app goes through here, so the provider can be
 * switched with a single env var.
 *
 * - "openai"     → GPT-4o / GPT-4o-mini, optionally routed through AI Gateway
 * - "workers-ai" → Llama 3.3 70B on Workers AI (no API key needed)
 *
 * If LLM_PROVIDER is "openai" but no OPENAI_API_KEY is configured we fall
 * back to Workers AI, so a fresh clone runs without any secrets.
 */
export type ModelPurpose = "interviewer" | "analyzer" | "report" | "coach";

export const WORKERS_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const OPENAI_MODELS: Record<ModelPurpose, string> = {
  interviewer: "gpt-4o",
  analyzer: "gpt-4o",
  report: "gpt-4o-mini",
  coach: "gpt-4o-mini"
};

export function activeProvider(env: Env): "openai" | "workers-ai" {
  const configured = String(env.LLM_PROVIDER || "openai");
  if (configured === "openai" && env.OPENAI_API_KEY) return "openai";
  return "workers-ai";
}

function gatewayId(env: Env): string | undefined {
  const id = String(env.AI_GATEWAY_ID || "").trim();
  return id || undefined;
}

export async function getModel(
  env: Env,
  purpose: ModelPurpose
): Promise<LanguageModel> {
  const gateway = gatewayId(env);

  if (activeProvider(env) === "openai") {
    // AI Gateway gives us request logs, caching and rate limiting for the
    // external provider. getUrl() resolves the account-scoped endpoint.
    const baseURL = gateway
      ? await env.AI.gateway(gateway).getUrl("openai")
      : undefined;
    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY, baseURL });
    // Chat Completions (not the Responses API) so the gateway can proxy it.
    return openai.chat(OPENAI_MODELS[purpose]);
  }

  const workersai = createWorkersAI({
    binding: env.AI,
    gateway: gateway ? { id: gateway } : undefined
  });
  return workersai(WORKERS_AI_MODEL);
}
