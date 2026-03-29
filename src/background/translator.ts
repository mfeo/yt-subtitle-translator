import { LRUCache } from "./cache.js";
import { OllamaBackend } from "./backends/ollama.js";
import type { Settings } from "../types/settings.js";
import type { TranslationBackendName } from "../types/index.js";

export class Translator {
  private cache = new LRUCache(500);
  private ollamaBackend: OllamaBackend;
  private currentBackendName: TranslationBackendName = "ollama";

  constructor(private settings: Settings) {
    this.ollamaBackend = new OllamaBackend(
      settings.ollama.host,
      settings.ollama.model
    );
  }

  updateSettings(settings: Settings): void {
    this.settings = settings;
    this.ollamaBackend = new OllamaBackend(
      settings.ollama.host,
      settings.ollama.model
    );
    this.currentBackendName = settings.translationBackend;
  }

  async translate(
    text: string,
    sourceLang: string | null,
    targetLang: string,
    onPartial?: (partial: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const cacheKey = LRUCache.makeKey(text, targetLang);
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached;

    const translated = await this.dispatchTranslation(
      text,
      sourceLang,
      targetLang,
      onPartial,
      signal
    );

    if (!signal?.aborted) {
      this.cache.set(cacheKey, translated);
    }

    return translated;
  }

  private async dispatchTranslation(
    text: string,
    sourceLang: string | null,
    targetLang: string,
    onPartial?: (partial: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const preferred = this.settings.translationBackend;

    if (preferred === "ollama") {
      if (await this.ollamaBackend.isAvailable()) {
        try {
          if (onPartial && this.ollamaBackend.translateStream) {
            return await this.ollamaBackend.translateStream(
              text, sourceLang, targetLang, onPartial, signal
            );
          }
          return await this.ollamaBackend.translate(text, sourceLang, targetLang, signal);
        } catch (err) {
          if (signal?.aborted) throw err;
          console.warn("[Translator] Ollama failed, falling back:", err);
        }
      }
      // Ollama unavailable — return original
      return text;
    }

    // youtube-native backend handles track URLs, not inline text — fallback gracefully
    return text;
  }

  async testConnection(backend: TranslationBackendName): Promise<boolean> {
    if (backend === "ollama") return this.ollamaBackend.isAvailable();
    return true;
  }
}
