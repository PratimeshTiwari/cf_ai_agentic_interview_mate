import { createOpenAI } from "@ai-sdk/openai";
import {
  generateText,
  NoObjectGeneratedError,
  Output,
  type FlexibleSchema,
  type LanguageModel
} from "ai";
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
    binding: withSingleTextSource(env.AI),
    gateway: gateway ? { id: gateway } : undefined
  });
  return workersai(WORKERS_AI_MODEL);
}

/**
 * Structured output with retries. Workers AI occasionally answers a
 * JSON-schema request with an empty body; a fresh attempt almost always
 * succeeds, so we retry before surfacing the error.
 */
export async function generateStructured<T>({
  env,
  purpose,
  schema,
  system,
  prompt,
  temperature,
  attempts = 3
}: {
  env: Env;
  purpose: ModelPurpose;
  schema: FlexibleSchema<T>;
  system: string;
  prompt: string;
  temperature?: number;
  attempts?: number;
}): Promise<T> {
  const model = await getModel(env, purpose);
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema }),
        system,
        prompt,
        temperature
      });
      return output as T;
    } catch (error) {
      lastError = error;
      if (!NoObjectGeneratedError.isInstance(error)) throw error;
      console.warn(`Structured output attempt ${attempt} returned no object`);
    }
  }
  throw lastError;
}

/**
 * Llama 3.3 on Workers AI streams OpenAI-style chunks that carry each token
 * twice: in `choices[0].delta.content` and in the legacy `response` field.
 * workers-ai-provider emits both, which doubles every delta. This wraps the
 * binding so streamed events keep only the `choices` text.
 */
function withSingleTextSource(ai: Ai): Ai {
  return new Proxy(ai, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop !== "run") {
        return typeof value === "function" ? value.bind(target) : value;
      }
      return async (...args: Parameters<Ai["run"]>) => {
        const result = await target.run(...args);
        return result instanceof ReadableStream
          ? result.pipeThrough(dropDuplicateResponseField())
          : result;
      };
    }
  });
}

function dropDuplicateResponseField(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const rewrite = (event: string) =>
    event
      .split("\n")
      .map((line) => {
        if (!line.startsWith("data:")) return line;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") return line;
        try {
          const chunk = JSON.parse(payload);
          if (chunk?.choices?.[0]?.delta && "response" in chunk) {
            delete chunk.response;
            return `data: ${JSON.stringify(chunk)}`;
          }
        } catch {
          // not JSON; pass through untouched
        }
        return line;
      })
      .join("\n");

  return new TransformStream({
    transform(bytes, controller) {
      buffer += decoder.decode(bytes, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        controller.enqueue(encoder.encode(`${rewrite(event)}\n\n`));
      }
    },
    flush(controller) {
      buffer += decoder.decode();
      if (buffer) controller.enqueue(encoder.encode(rewrite(buffer)));
    }
  });
}
