import { CaptionSourceManager } from "./caption-source.js";
import { TranslationOverlay } from "./overlay.js";
import { AbortManager } from "../utils/abort.js";
import type { Settings } from "../types/settings.js";
import type { CaptionSource } from "../types/index.js";

let manager: CaptionSourceManager | null = null;
let overlay: TranslationOverlay | null = null;
const abortManager = new AbortManager();
let settings: Settings | null = null;
let requestCounter = 0;
let activeSource: CaptionSource | null = null;

async function loadSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response: unknown) => {
      if (chrome.runtime.lastError) {
        resolve(getDefaultSettings());
        return;
      }
      const resp = response as { success: boolean; data: Settings };
      resolve(resp?.success ? resp.data : getDefaultSettings());
    });
  });
}

function getDefaultSettings(): Settings {
  return {
    enabled: true,
    targetLang: "zh-TW",
    translationBackend: "ollama",
    ollama: { host: "http://localhost:11434", model: "qwen2.5:3b" },
    whisper: { provider: "whisper-cpp", host: "http://localhost:8080", groqApiKey: "" },
    cloud: { provider: "deepl", apiKey: "" },
    display: { fontSize: "medium", opacity: 0.85 },
  };
}

async function initialize(): Promise<void> {
  settings = await loadSettings();
  if (!settings.enabled) return;

  overlay = new TranslationOverlay({
    fontSize: settings.display.fontSize,
    opacity: settings.display.opacity,
  });
  overlay.mount();

  manager = new CaptionSourceManager(onCaption);
  activeSource = await manager.start();
  console.log(`[YT Translator] Caption source: ${activeSource}`);
}

function onCaption(text: string, lang: string | null, _source: CaptionSource): void {
  if (!overlay || !settings) return;

  const requestId = String(++requestCounter);
  const ctrl = abortManager.create("translate");

  // Use streaming port for progressive display
  const port = chrome.runtime.connect({ name: "translation-stream" });

  port.onMessage.addListener((msg: unknown) => {
    const message = msg as {
      type: string;
      partial?: string;
      translated?: string;
      error?: string;
      requestId?: string;
    };

    if (message.requestId !== requestId) return;

    switch (message.type) {
      case "TRANSLATE_PARTIAL":
        overlay!.show(message.partial ?? "", true);
        break;
      case "TRANSLATE_RESPONSE":
        overlay!.show(message.translated ?? "");
        port.disconnect();
        break;
      case "TRANSLATE_ERROR":
        console.warn("[YT Translator] Translation error:", message.error);
        port.disconnect();
        break;
    }
  });

  port.onDisconnect.addListener(() => {
    ctrl.abort();
  });

  port.postMessage({
    type: "TRANSLATE_REQUEST",
    text,
    sourceLang: lang,
    targetLang: settings!.targetLang,
    requestId,
  });
}

function cleanup(): void {
  manager?.stop();
  manager = null;
  overlay?.unmount();
  overlay = null;
  abortManager.abortAll();
  activeSource = null;
}

// Handle YouTube SPA navigation
document.addEventListener("yt-navigate-finish", () => {
  cleanup();
  // Small delay to let YouTube load the new page
  setTimeout(initialize, 1000);
});

// Listen for settings changes to re-initialize
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area !== "sync") return;
  cleanup();
  setTimeout(initialize, 200);
});

// Initial start
initialize();
