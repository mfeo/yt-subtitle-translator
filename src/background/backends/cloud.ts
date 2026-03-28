import type { TranslationBackend } from "./types.js";

export class DeepLBackend implements TranslationBackend {
  readonly name = "cloud-deepl";

  constructor(private apiKey: string) {}

  async translate(
    text: string,
    _sourceLang: string | null,
    targetLang: string,
    signal?: AbortSignal
  ): Promise<string> {
    const body = new URLSearchParams({
      auth_key: this.apiKey,
      text,
      target_lang: targetLang.toUpperCase().replace("-", "_"),
    });

    const resp = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal,
    });

    if (!resp.ok) throw new Error(`DeepL error ${resp.status}: ${await resp.text()}`);

    const json = (await resp.json()) as {
      translations?: Array<{ text: string }>;
    };
    const translated = json.translations?.[0]?.text;
    if (!translated) throw new Error("DeepL returned empty translation");
    return translated;
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }
}

export class OpenAIBackend implements TranslationBackend {
  readonly name = "cloud-openai";

  constructor(private apiKey: string) {}

  async translate(
    text: string,
    sourceLang: string | null,
    targetLang: string,
    signal?: AbortSignal
  ): Promise<string> {
    const from = sourceLang ? ` from ${sourceLang}` : "";
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Translate subtitle text${from} to ${targetLang}. Reply with only the translation.`,
          },
          { role: "user", content: text },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
      signal,
    });

    if (!resp.ok) throw new Error(`OpenAI error ${resp.status}: ${await resp.text()}`);

    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const translated = json.choices?.[0]?.message?.content;
    if (!translated) throw new Error("OpenAI returned empty translation");
    return translated.trim();
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }
}
