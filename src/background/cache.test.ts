import { describe, it, expect } from "bun:test";
import { LRUCache } from "./cache.js";

describe("LRUCache", () => {
  it("stores and retrieves values", () => {
    const cache = new LRUCache(10);
    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");
  });

  it("returns undefined for missing keys", () => {
    const cache = new LRUCache(10);
    expect(cache.get("nonexistent")).toBeUndefined();
  });

  it("evicts oldest entry when over capacity", () => {
    const cache = new LRUCache(3);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    cache.set("d", "4"); // should evict "a"
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("2");
    expect(cache.get("d")).toBe("4");
  });

  it("refreshes recency on get", () => {
    const cache = new LRUCache(3);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    cache.get("a"); // refresh a
    cache.set("d", "4"); // should evict "b" (now oldest)
    expect(cache.get("a")).toBe("1");
    expect(cache.get("b")).toBeUndefined();
  });

  it("tracks size correctly", () => {
    const cache = new LRUCache(10);
    expect(cache.size).toBe(0);
    cache.set("x", "1");
    cache.set("y", "2");
    expect(cache.size).toBe(2);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("makeKey produces consistent keys", () => {
    expect(LRUCache.makeKey("hello", "zh-TW")).toBe("hello|zh-TW");
  });

  it("has() returns correct boolean", () => {
    const cache = new LRUCache(5);
    cache.set("k", "v");
    expect(cache.has("k")).toBe(true);
    expect(cache.has("missing")).toBe(false);
  });
});
