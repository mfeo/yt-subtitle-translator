import type { WhisperProvider } from "../types/index.js";

interface WhisperConfig {
  provider: WhisperProvider;
  host: string; // for whisper-cpp
  groqApiKey: string;
}

/**
 * Transcribes audio using the configured Whisper provider.
 * Returns transcribed text.
 */
export async function transcribeAudio(
  audioBase64: string,
  mimeType: string,
  config: WhisperConfig,
  signal?: AbortSignal
): Promise<string> {
  const audioBlob = base64ToBlob(audioBase64, mimeType);

  switch (config.provider) {
    case "whisper-cpp":
      return transcribeWhisperCpp(audioBlob, config.host, signal);
    case "groq":
      return transcribeGroq(audioBlob, config.groqApiKey, signal);
    case "ollama-whisper":
      // Ollama doesn't natively support audio; fall back to whisper-cpp
      return transcribeWhisperCpp(audioBlob, config.host, signal);
    default: {
      const _: never = config.provider;
      throw new Error(`Unknown whisper provider: ${_}`);
    }
  }
}

async function transcribeWhisperCpp(
  audio: Blob,
  host: string,
  signal?: AbortSignal
): Promise<string> {
  const form = new FormData();
  const filename = audio.type === "audio/wav" ? "audio.wav" : "audio.webm";
  form.append("file", audio, filename);
  form.append("response_format", "json");

  const resp = await fetch(`${host}/inference`, {
    method: "POST",
    body: form,
    signal,
  });

  if (!resp.ok) {
    throw new Error(`whisper.cpp error ${resp.status}: ${await resp.text()}`);
  }

  const json = (await resp.json()) as { text?: string };
  if (!json.text) throw new Error("whisper.cpp returned empty transcription");
  return json.text.trim();
}

async function transcribeGroq(
  audio: Blob,
  apiKey: string,
  signal?: AbortSignal
): Promise<string> {
  if (!apiKey) throw new Error("Groq API key not configured");

  const form = new FormData();
  form.append("file", audio, "audio.webm");
  form.append("model", "whisper-large-v3");
  form.append("response_format", "json");

  const resp = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal,
  });

  if (!resp.ok) {
    throw new Error(`Groq error ${resp.status}: ${await resp.text()}`);
  }

  const json = (await resp.json()) as { text?: string };
  if (!json.text) throw new Error("Groq returned empty transcription");
  return json.text.trim();
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export async function isWhisperAvailable(config: WhisperConfig): Promise<boolean> {
  if (config.provider === "groq") return config.groqApiKey.length > 0;
  try {
    const resp = await fetch(`${config.host}/inference`, {
      method: "HEAD",
      signal: AbortSignal.timeout(2000),
    });
    return resp.status !== 404;
  } catch {
    return false;
  }
}
