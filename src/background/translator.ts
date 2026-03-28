import { LRUCache } from "./cache.js";
import { OllamaBackend } from "./backends/ollama.js";
import { DeepLBackend, OpenAIBackend } from "./backends/cloud.js";
import type { TranslationBackend } from "./backends/types.js";
import type { Settings } from "../types/settings.js";
import type { TranslationBackendName } from "../types/index.js";

export class Translator {
  private cache = new LRUCache(500);
  private ollamaBackend: OllamaBackend;
  private cloudBackend: TranslationBackend | null = null;
  private currentBackendName: TranslationBackendName = "ollama";

  constructor(private settings: Settings) {
    this.ollamaBackend = new OllamaBackend(
      settings.ollama.host,
      settings.ollama.model
    );
    this.updateCloudBackend(settings);
  }

  updateSettings(settings: Settings): void {
    this.settings = settings;
    this.ollamaBackend = new OllamaBackend(
      settings.ollama.host,
      settings.ollama.model
    );
    this.updateCloudBackend(settings);
    this.currentBackendName = settings.translationBackend;
  }

  private updateCloudBackend(settings: Settings): void {
    if (settings.cloud.provider === "deepl") {
      this.cloudBackend = new DeepLBackend(settings.cloud.apiKey);
    } else {
      this.cloudBackend = new OpenAIBackend(settings.cloud.apiKey);
    }
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
      // Fallback: cloud or return original
      return await this.tryCloudFallback(text, sourceLang, targetLang, signal);
    }

    if (preferred === "cloud" && this.cloudBackend) {
      if (await this.cloudBackend.isAvailable()) {
        try {
          return await this.cloudBackend.translate(text, sourceLang, targetLang, signal);
        } catch (err) {
          if (signal?.aborted) throw err;
          console.warn("[Translator] Cloud backend failed:", err);
        }
      }
    }

    // youtube-native backend handles track URLs, not inline text — fallback gracefully
    return text;
  }

  private async tryCloudFallback(
    text: string,
    sourceLang: string | null,
    targetLang: string,
    signal?: AbortSignal
  ): Promise<string> {
    if (this.cloudBackend && (await this.cloudBackend.isAvailable())) {
      try {
        return await this.cloudBackend.translate(text, sourceLang, targetLang, signal);
      } catch {
        // ignore
      }
    }
    return text; // Return original if all backends fail
  }

  async testConnection(backend: TranslationBackendName): Promise<boolean> {
    if (backend === "ollama") return this.ollamaBackend.isAvailable();
    if (backend === "cloud" && this.cloudBackend) return this.cloudBackend.isAvailable();
    return true;
  }
}
