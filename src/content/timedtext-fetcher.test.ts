import { describe, it, expect } from "bun:test";
import { findCurrentCaption, selectBestTrack } from "./timedtext-fetcher.js";
import type { CaptionTrack, TimedTextEvent } from "../types/index.js";

describe("findCurrentCaption", () => {
  const events: TimedTextEvent[] = [
    { tStartMs: 0, dDurationMs: 3000, segs: [{ utf8: "Hello" }] },
    { tStartMs: 3000, dDurationMs: 2000, segs: [{ utf8: "World" }] },
    { tStartMs: 5000, dDurationMs: 4000, segs: [{ utf8: "Goodbye" }] },
  ];

  it("finds the correct caption at a given time", () => {
    expect(findCurrentCaption(events, 1500)).toBe("Hello");
    expect(findCurrentCaption(events, 3500)).toBe("World");
    expect(findCurrentCaption(events, 7000)).toBe("Goodbye");
  });

  it("returns null when no caption matches", () => {
    expect(findCurrentCaption(events, 9500)).toBeNull();
    expect(findCurrentCaption(events, -100)).toBeNull();
  });

  it("returns null for empty events array", () => {
    expect(findCurrentCaption([], 1000)).toBeNull();
  });

  it("handles events with no segs", () => {
    const evts: TimedTextEvent[] = [{ tStartMs: 0, dDurationMs: 1000 }];
    expect(findCurrentCaption(evts, 500)).toBeNull();
  });
});

describe("selectBestTrack", () => {
  it("returns null for empty tracks", () => {
    expect(selectBestTrack([])).toBeNull();
  });

  it("prefers English tracks", () => {
    const tracks: CaptionTrack[] = [
      { baseUrl: "url1", name: "Japanese", vssId: ".ja", languageCode: "ja" },
      { baseUrl: "url2", name: "English", vssId: ".en", languageCode: "en" },
    ];
    expect(selectBestTrack(tracks)?.languageCode).toBe("en");
  });

  it("avoids zh-TW when other options exist", () => {
    const tracks: CaptionTrack[] = [
      { baseUrl: "url1", name: "zh-TW", vssId: ".zh-Hant", languageCode: "zh-TW" },
      { baseUrl: "url2", name: "Korean", vssId: ".ko", languageCode: "ko" },
    ];
    expect(selectBestTrack(tracks)?.languageCode).toBe("ko");
  });

  it("returns first track as fallback", () => {
    const tracks: CaptionTrack[] = [
      { baseUrl: "url1", name: "zh-TW", vssId: ".zh-Hant", languageCode: "zh-TW" },
    ];
    expect(selectBestTrack(tracks)?.languageCode).toBe("zh-TW");
  });
});
