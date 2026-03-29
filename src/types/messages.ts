import type { CaptionSource, TranslationBackendName } from "./index.js";
import type { Settings } from "./settings.js";

export type MessageType =
  | "TRANSLATE_REQUEST"
  | "TRANSLATE_RESPONSE"
  | "TRANSLATE_PARTIAL"
  | "TRANSLATE_ERROR"
  | "GET_SETTINGS"
  | "SAVE_SETTINGS"
  | "TEST_CONNECTION"
  | "AUDIO_CHUNK"
  | "STT_RESULT"
  | "STATUS_UPDATE"
  | "START_TAB_CAPTURE"
  | "STOP_TAB_CAPTURE"
  | "START_OFFSCREEN_CAPTURE"
  | "STOP_OFFSCREEN_CAPTURE";

export interface TranslateRequestMessage {
  type: "TRANSLATE_REQUEST";
  text: string;
  sourceLang: string | null;
  targetLang: string;
  requestId: string;
}

export interface TranslateResponseMessage {
  type: "TRANSLATE_RESPONSE";
  translated: string;
  requestId: string;
}

export interface TranslatePartialMessage {
  type: "TRANSLATE_PARTIAL";
  partial: string;
  requestId: string;
}

export interface TranslateErrorMessage {
  type: "TRANSLATE_ERROR";
  error: string;
  requestId: string;
}

export interface GetSettingsMessage {
  type: "GET_SETTINGS";
}

export interface SaveSettingsMessage {
  type: "SAVE_SETTINGS";
  settings: Partial<Settings>;
}

export interface TestConnectionMessage {
  type: "TEST_CONNECTION";
  backend: TranslationBackendName;
}

export interface AudioChunkMessage {
  type: "AUDIO_CHUNK";
  audioData: string; // base64 encoded audio
  mimeType: string;
  tabId?: number;
}

export interface SttResultMessage {
  type: "STT_RESULT";
  text: string;
  requestId: string;
}

export interface StatusUpdateMessage {
  type: "STATUS_UPDATE";
  captionSource: CaptionSource | null;
  backend: TranslationBackendName | null;
  active: boolean;
}

export interface StartTabCaptureMessage {
  type: "START_TAB_CAPTURE";
  streamId: string;
  tabId: number;
}

export interface StopTabCaptureMessage {
  type: "STOP_TAB_CAPTURE";
}

export interface StartOffscreenCaptureMessage {
  type: "START_OFFSCREEN_CAPTURE";
  streamId: string;
  tabId: number;
}

export interface StopOffscreenCaptureMessage {
  type: "STOP_OFFSCREEN_CAPTURE";
}

export type ExtensionMessage =
  | TranslateRequestMessage
  | TranslateResponseMessage
  | TranslatePartialMessage
  | TranslateErrorMessage
  | GetSettingsMessage
  | SaveSettingsMessage
  | TestConnectionMessage
  | AudioChunkMessage
  | SttResultMessage
  | StatusUpdateMessage
  | StartTabCaptureMessage
  | StopTabCaptureMessage
  | StartOffscreenCaptureMessage
  | StopOffscreenCaptureMessage;

export type MessageResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };
