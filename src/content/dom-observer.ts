import { debounce } from "../utils/debounce.js";

type CaptionCallback = (text: string) => void;

export class DOMObserver {
  private observer: MutationObserver | null = null;
  private lastText = "";
  private callback: CaptionCallback;

  private debouncedEmit = debounce((text: string) => {
    if (text && text !== this.lastText) {
      this.lastText = text;
      this.callback(text);
    }
  }, 150);

  constructor(callback: CaptionCallback) {
    this.callback = callback;
  }

  start(): boolean {
    const container = document.querySelector(".ytp-caption-window-container");
    if (!container) return false;

    this.observer = new MutationObserver(() => {
      const text = this.extractText();
      if (text) this.debouncedEmit(text);
    });

    this.observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return true;
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.lastText = "";
  }

  private extractText(): string {
    const segments = document.querySelectorAll(".ytp-caption-segment");
    return Array.from(segments)
      .map((el) => el.textContent ?? "")
      .join(" ")
      .trim();
  }
}
