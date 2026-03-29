import type { CaptionSource } from "../types/index.js";

type StableCallback = (text: string, lang: string | null, source: CaptionSource) => void;
export class CaptionStabilizer {
  private pendingText: string | null = null;
  private pendingLang: string | null = null;
  private pendingSource: CaptionSource | null = null;
  private stableTimer: ReturnType<typeof setTimeout> | null = null;
  private lastStableText = "";
  private lastFedText = "";

  constructor(
    private readonly onStable: StableCallback,
    private readonly stabilizeDelayMs: number = 1200
  ) {}

  feed(text: string, lang: string | null, source: CaptionSource, isScrolling: boolean): void {
    this.pendingText = text;
    this.pendingLang = lang;
    this.pendingSource = source;

    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }

    if (!isScrolling) {
      // Normal caption — already a complete sentence, emit immediately
      this.lastFedText = text;
      this.emitStable();
      return;
    }

    // Scrolling caption — check similarity and debounce
    const isRelated = this.isRelatedCaption(text, this.lastFedText);
    this.lastFedText = text;

    if (!isRelated) {
      // Completely different text (new sentence starting) — emit immediately
      this.emitStable();
    } else {
      // Text is growing word-by-word — wait for it to settle
      this.stableTimer = setTimeout(() => this.emitStable(), this.stabilizeDelayMs);
    }
  }

  reset(): void {
    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
    this.pendingText = null;
    this.pendingLang = null;
    this.pendingSource = null;
    this.lastStableText = "";
    this.lastFedText = "";
  }

  private isRelatedCaption(newText: string, prevText: string): boolean {
    if (!prevText) return false;
    // Prefix growth (word-by-word append)
    if (newText.startsWith(prevText) || prevText.startsWith(newText)) return true;
    // Substring containment (correction/reflow)
    if (newText.includes(prevText) || prevText.includes(newText)) return true;
    // Shared prefix ratio — >50% shared prefix = likely same sentence evolving
    const minLen = Math.min(newText.length, prevText.length);
    let shared = 0;
    while (shared < minLen && newText[shared] === prevText[shared]) shared++;
    return shared / minLen > 0.5;
  }

  private emitStable(): void {
    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
    if (this.pendingText && this.pendingText !== this.lastStableText) {
      this.lastStableText = this.pendingText;
      this.onStable(this.pendingText, this.pendingLang, this.pendingSource!);
    }
  }
}
