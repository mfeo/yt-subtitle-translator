import {
  fetchCaptionTracks,
  fetchTimedTextTrack,
  findCurrentCaption,
  selectBestTrack,
} from "./timedtext-fetcher.js";
import { DOMObserver } from "./dom-observer.js";
import { AudioCapture } from "./audio-capture.js";
import type { CaptionSource, TimedTextEvent } from "../types/index.js";

type CaptionCallback = (text: string, lang: string | null, source: CaptionSource, isScrolling: boolean) => void;

const POLL_INTERVAL_MS = 250; // video timeupdate poll interval fallback

export class CaptionSourceManager {
  private activeSource: CaptionSource | null = null;
  private timedTextEvents: TimedTextEvent[] = [];
  private timedTextLang: string | null = null;
  private timedTextIsScrolling = false;
  private domObserver: DOMObserver | null = null;
  private audioCapture: AudioCapture | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private video: HTMLVideoElement | null = null;
  private callback: CaptionCallback;

  constructor(callback: CaptionCallback) {
    this.callback = callback;
  }

  async start(): Promise<CaptionSource> {
    // --- Layer 1: TimedText API ---
    try {
      const tracks = await fetchCaptionTracks();
      const track = selectBestTrack(tracks);
      if (track) {
        const timedText = await fetchTimedTextTrack(track.baseUrl);
        if (timedText && timedText.events.length > 0) {
          this.timedTextEvents = timedText.events;
          this.timedTextLang = track.languageCode;
          this.timedTextIsScrolling =
            track.kind === "asr" || track.vssId.startsWith("a.");
          this.startTimedTextPolling();
          this.activeSource = "timedtext";
          return "timedtext";
        }
      }
    } catch (err) {
      console.warn("[CaptionSource] TimedText failed:", err);
    }

    // --- Layer 2: DOM Observer ---
    this.domObserver = new DOMObserver((text, isScrolling) => {
      this.callback(text, null, "dom", isScrolling);
    });
    if (this.domObserver.start()) {
      this.activeSource = "dom";
      return "dom";
    }

    // --- Layer 3: Audio Capture + Whisper ---
    try {
      this.audioCapture = new AudioCapture((text) => {
        this.callback(text, null, "whisper", false);
      });
      await this.audioCapture.start();
      this.activeSource = "whisper";
      return "whisper";
    } catch (err) {
      console.warn("[CaptionSource] Audio capture failed:", err);
    }

    return "whisper"; // best effort
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.video?.removeEventListener("timeupdate", this.onTimeUpdate);
    this.domObserver?.stop();
    this.audioCapture?.stop();
    this.timedTextEvents = [];
    this.activeSource = null;
  }

  get source(): CaptionSource | null {
    return this.activeSource;
  }

  private startTimedTextPolling(): void {
    this.video = document.querySelector("video");
    if (!this.video) return;

    // Use timeupdate event for precise sync
    this.video.addEventListener("timeupdate", this.onTimeUpdate);
  }

  private lastEmittedText = "";
  private onTimeUpdate = (): void => {
    if (!this.video || this.timedTextEvents.length === 0) return;
    const currentMs = this.video.currentTime * 1000;
    const text = findCurrentCaption(this.timedTextEvents, currentMs);
    if (text && text !== this.lastEmittedText) {
      this.lastEmittedText = text;
      this.callback(text, this.timedTextLang, "timedtext", this.timedTextIsScrolling);
    }
  };
}
