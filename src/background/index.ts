import { Translator } from "./translator.js";
import { transcribeAudio } from "./whisper.js";
import type { ExtensionMessage } from "../types/messages.js";
import type { Settings } from "../types/settings.js";
import { DEFAULT_SETTINGS } from "../types/settings.js";
import { AbortManager } from "../utils/abort.js";

let settings: Settings = { ...DEFAULT_SETTINGS };
let translator = new Translator(settings);
const abortManager = new AbortManager();

// Load persisted settings on startup
chrome.storage.sync.get(null, (items) => {
  if (Object.keys(items).length > 0) {
    settings = mergeSettings(DEFAULT_SETTINGS, items as Partial<Settings>);
    translator.updateSettings(settings);
  }
});

// Listen for settings changes
chrome.storage.sync.onChanged.addListener((changes) => {
  const patch: Record<string, unknown> = {};
  for (const [key, change] of Object.entries(changes)) {
    patch[key] = change.newValue;
  }
  settings = mergeSettings(settings, patch as Partial<Settings>);
  translator.updateSettings(settings);
});

// Streaming port for partial translation updates
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "translation-stream") return;

  port.onMessage.addListener(async (msg: unknown) => {
    const message = msg as ExtensionMessage;
    if (message.type !== "TRANSLATE_REQUEST") return;

    const { text, sourceLang, targetLang, requestId } = message;
    const ctrl = abortManager.create(`translate:${requestId}`);

    try {
      const translated = await translator.translate(
        text,
        sourceLang,
        targetLang,
        (partial) => {
          if (!ctrl.signal.aborted) {
            port.postMessage({ type: "TRANSLATE_PARTIAL", partial, requestId });
          }
        },
        ctrl.signal
      );

      if (!ctrl.signal.aborted) {
        port.postMessage({ type: "TRANSLATE_RESPONSE", translated, requestId });
      }
    } catch (err) {
      if (!ctrl.signal.aborted) {
        port.postMessage({
          type: "TRANSLATE_ERROR",
          error: err instanceof Error ? err.message : String(err),
          requestId,
        });
      }
    }
  });

  port.onDisconnect.addListener(() => {
    abortManager.abortAll();
  });
});

// Regular message handler
chrome.runtime.onMessage.addListener(
  (msg: unknown, sender, sendResponse: (response: unknown) => void) => {
    const message = msg as ExtensionMessage;

    switch (message.type) {
      case "TRANSLATE_REQUEST": {
        const { text, sourceLang, targetLang, requestId } = message;
        const ctrl = abortManager.create(`translate:${requestId}`);
        translator
          .translate(text, sourceLang, targetLang, undefined, ctrl.signal)
          .then((translated) => {
            sendResponse({ success: true, data: { translated, requestId } });
          })
          .catch((err: unknown) => {
            sendResponse({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            });
          });
        return true;
      }

      case "GET_SETTINGS": {
        sendResponse({ success: true, data: settings });
        return false;
      }

      case "SAVE_SETTINGS": {
        const newSettings = mergeSettings(settings, message.settings);
        settings = newSettings;
        translator.updateSettings(settings);
        chrome.storage.sync.set(settings as unknown as Record<string, unknown>, () => {
          sendResponse({ success: true, data: settings });
        });
        return true;
      }

      case "TEST_CONNECTION": {
        translator
          .testConnection(message.backend)
          .then((available) => {
            sendResponse({ success: true, data: { available } });
          })
          .catch(() => {
            sendResponse({ success: true, data: { available: false } });
          });
        return true;
      }

      case "AUDIO_CHUNK": {
        const { audioData, mimeType } = message;
        transcribeAudio(audioData, mimeType, settings.whisper)
          .then((text) => {
            sendResponse({ success: true, data: { text } });
          })
          .catch((err: unknown) => {
            sendResponse({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            });
          });
        return true;
      }

      default:
        return false;
    }
  }
);

function mergeSettings(base: Settings, patch: Partial<Settings>): Settings {
  return {
    ...base,
    ...patch,
    ollama: { ...base.ollama, ...(patch.ollama ?? {}) },
    whisper: { ...base.whisper, ...(patch.whisper ?? {}) },
    display: { ...base.display, ...(patch.display ?? {}) },
  };
}
