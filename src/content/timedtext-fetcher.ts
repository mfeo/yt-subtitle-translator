import type { CaptionTrack, TimedTextEvent, TimedTextTrack } from "../types/index.js";

export async function fetchCaptionTracks(): Promise<CaptionTrack[]> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve([]), 5000);

    const handler = (event: MessageEvent) => {
      if (
        event.source !== window ||
        !event.data ||
        event.data.type !== "__YT_CAPTION_TRACKS__"
      )
        return;

      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      resolve((event.data.tracks as CaptionTrack[]) ?? []);
    };

    window.addEventListener("message", handler);

    // Inject external script into MAIN world to read ytInitialPlayerResponse
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("dist/injected.js");
    (document.head ?? document.documentElement).appendChild(script);
    script.remove();
  });
}

export async function fetchTimedTextTrack(
  baseUrl: string,
  signal?: AbortSignal
): Promise<TimedTextTrack | null> {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("fmt", "json3");
    const resp = await fetch(url.toString(), { signal });
    if (!resp.ok) return null;
    return (await resp.json()) as TimedTextTrack;
  } catch {
    return null;
  }
}

/**
 * Pick the best caption track for translation:
 * prefer English, then any non-zh-TW track.
 */
export function selectBestTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (tracks.length === 0) return null;

  // Prefer en tracks
  const en = tracks.find((t) => t.languageCode.startsWith("en"));
  if (en) return en;

  // Avoid already-translated zh-TW
  const notZhTw = tracks.find((t) => !t.languageCode.startsWith("zh"));
  if (notZhTw) return notZhTw;

  return tracks[0] ?? null;
}

/**
 * Find the active caption text for the current video time (in ms).
 */
export function findCurrentCaption(
  events: TimedTextEvent[],
  currentTimeMs: number
): string | null {
  // Binary search for efficiency
  let lo = 0;
  let hi = events.length - 1;
  let result: string | null = null;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const ev = events[mid];
    if (!ev) break;

    const start = ev.tStartMs;
    const end = start + (ev.dDurationMs ?? 3000);

    if (currentTimeMs >= start && currentTimeMs < end) {
      const text = ev.segs?.map((s) => s.utf8).join("").trim() ?? "";
      if (text) result = text;
      break;
    } else if (currentTimeMs < start) {
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  return result;
}
