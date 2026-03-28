export interface TranslationBackend {
  readonly name: string;

  translate(
    text: string,
    sourceLang: string | null,
    targetLang: string,
    signal?: AbortSignal
  ): Promise<string>;

  translateStream?(
    text: string,
    sourceLang: string | null,
    targetLang: string,
    onChunk: (partial: string) => void,
    signal?: AbortSignal
  ): Promise<string>;

  isAvailable(): Promise<boolean>;
}
