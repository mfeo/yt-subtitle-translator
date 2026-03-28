import type { TranslationBackend } from "./types.js";

/**
 * YouTube Native translation: appends &tlang= to the caption base URL.
 * This fetches pre-translated captions directly from YouTube.
 * The "text" input here is the baseUrl of a caption track.
 */
export class YouTubeNativeBackend implements TranslationBackend {
  readonly name = "youtube-native";

  async translate(
    baseUrl: string,
    _sourceLang: string | null,
    targetLang: string,
    signal?: AbortSignal
  ): Promise<string> {
    const url = new URL(baseUrl);
    url.searchParams.set("tlang", targetLang.replace("-", "_"));
    url.searchParams.set("fmt", "json3");

    const resp = await fetch(url.toString(), { signal });
    if (!resp.ok) throw new Error(`YouTube Native error ${resp.status}`);

    const json = (await resp.json()) as {
      events?: Array<{ segs?: Array<{ utf8?: string }> }>;
    };

    const lines: string[] = [];
    for (const event of json.events ?? []) {
      if (!event.segs) continue;
      const line = event.segs
        .map((s) => s.utf8 ?? "")
        .join("")
        .replace(/\n/g, " ")
        .trim();
      if (line) lines.push(line);
    }

    return lines.join("\n");
  }

  async isAvailable(): Promise<boolean> {
    return true; // Always available when YouTube is accessible
  }
}

/**
 * Translate a single text string using YouTube's auto-translate by
 * constructing a temporary caption URL request.
 * Returns original text as fallback if fails.
 */
export async function translateWithYouTubeNative(
  text: string,
  targetLang: string,
  signal?: AbortSignal
): Promise<string> {
  // YouTube native backend works best with full track URLs;
  // for inline text translation we have no baseUrl, so this is a no-op fallback.
  void text;
  void targetLang;
  void signal;
  return text;
}
