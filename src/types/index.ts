export interface CaptionEvent {
  text: string;
  lang: string | null;
  startMs: number;
  durationMs: number;
}

export interface TranslationResult {
  original: string;
  translated: string;
  partial?: boolean;
}

export interface CaptionTrack {
  baseUrl: string;
  name: string;
  vssId: string;
  languageCode: string;
  isDefault?: boolean;
}

export interface TimedTextEvent {
  tStartMs: number;
  dDurationMs?: number;
  segs?: Array<{ utf8: string }>;
}

export interface TimedTextTrack {
  events: TimedTextEvent[];
}

export type CaptionSource = "timedtext" | "dom" | "whisper";

export type TranslationBackendName = "ollama" | "youtube-native";

export type WhisperProvider = "ollama-whisper" | "whisper-cpp" | "groq";
