import type { TranslationBackendName, WhisperProvider } from "./index.js";

export interface Settings {
  enabled: boolean;
  targetLang: string;
  translationBackend: TranslationBackendName;
  ollama: {
    host: string;
    model: string;
  };
  whisper: {
    provider: WhisperProvider;
    host: string;
    groqApiKey: string;
  };
  display: {
    fontSize: "small" | "medium" | "large";
    opacity: number;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  targetLang: "zh-TW",
  translationBackend: "ollama",
  ollama: {
    host: "http://localhost:11434",
    model: "qwen2.5:3b",
  },
  whisper: {
    provider: "whisper-cpp",
    host: "http://localhost:8080",
    groqApiKey: "",
  },
  display: {
    fontSize: "medium",
    opacity: 0.85,
  },
};
