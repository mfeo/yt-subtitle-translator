import type { TranslationBackend } from "./types.js";

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

interface OllamaGenerateChunk {
  response: string;
  done: boolean;
}

export class OllamaBackend implements TranslationBackend {
  readonly name = "ollama";

  constructor(
    private host: string,
    private model: string
  ) {}

  private buildPrompt(
    text: string,
    sourceLang: string | null,
    targetLang: string
  ): string {
    const from = sourceLang ? ` from ${sourceLang}` : "";
    return (
      `Translate the following subtitle text${from} to ${targetLang}. ` +
      `Reply with only the translation, preserving line breaks.\n\n${text}`
    );
  }

  async translate(
    text: string,
    sourceLang: string | null,
    targetLang: string,
    signal?: AbortSignal
  ): Promise<string> {
    const body: OllamaGenerateRequest = {
      model: this.model,
      prompt: this.buildPrompt(text, sourceLang, targetLang),
      stream: false,
      options: { temperature: 0.1, num_predict: 200 },
    };

    const resp = await fetch(`${this.host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!resp.ok) throw new Error(`Ollama error ${resp.status}: ${await resp.text()}`);

    const json = (await resp.json()) as { response: string };
    return json.response.trim();
  }

  async translateStream(
    text: string,
    sourceLang: string | null,
    targetLang: string,
    onChunk: (partial: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const body: OllamaGenerateRequest = {
      model: this.model,
      prompt: this.buildPrompt(text, sourceLang, targetLang),
      stream: true,
      options: { temperature: 0.1, num_predict: 200 },
    };

    const resp = await fetch(`${this.host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!resp.ok) throw new Error(`Ollama error ${resp.status}: ${await resp.text()}`);

    const reader = resp.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value, { stream: true }).split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line) as OllamaGenerateChunk;
          accumulated += chunk.response;
          onChunk(accumulated);
          if (chunk.done) return accumulated.trim();
        } catch {
          // skip malformed JSON line
        }
      }
    }

    return accumulated.trim();
  }

  async isAvailable(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.host}/api/tags`, { signal: AbortSignal.timeout(3000) });
      return resp.ok;
    } catch {
      return false;
    }
  }

  updateConfig(host: string, model: string): void {
    (this as { host: string }).host = host;
    (this as { model: string }).model = model;
  }
}
