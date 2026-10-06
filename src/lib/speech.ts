/**
 * Text-to-speech on Workers AI. Deepgram Aura is the primary voice; MeloTTS
 * is a fallback. The browser falls back to speechSynthesis if both fail.
 */
const PRIMARY_TTS = "@cf/deepgram/aura-1";
const FALLBACK_TTS = "@cf/myshell-ai/melotts";
const MAX_CHARS = 1500;

const AUDIO_HEADERS = {
  "content-type": "audio/mpeg",
  "cache-control": "no-store"
};

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function primary(env: Env, text: string): Promise<Response> {
  const raw = await env.AI.run(
    PRIMARY_TTS,
    { text, speaker: "luna", encoding: "mp3" },
    { returnRawResponse: true }
  );
  if (!raw.ok || !raw.body) throw new Error(`Aura TTS failed: ${raw.status}`);
  return new Response(raw.body, { headers: AUDIO_HEADERS });
}

async function fallback(env: Env, text: string): Promise<Response> {
  const result = (await env.AI.run(FALLBACK_TTS, {
    prompt: text,
    lang: "en"
  })) as Uint8Array | { audio: string };
  const bytes =
    result instanceof Uint8Array ? result : base64ToBytes(result.audio);
  return new Response(new Uint8Array(bytes), { headers: AUDIO_HEADERS });
}

export async function handleSpeak(request: Request, env: Env) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  let text = "";
  try {
    const body = (await request.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    // fall through to the validation below
  }
  if (!text) return new Response("Missing text", { status: 400 });
  text = text.slice(0, MAX_CHARS);

  try {
    return await primary(env, text);
  } catch (error) {
    console.warn("Primary TTS failed, trying fallback", error);
  }
  try {
    return await fallback(env, text);
  } catch (error) {
    console.error("TTS failed", error);
    return new Response("TTS unavailable", { status: 502 });
  }
}
