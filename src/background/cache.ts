/**
 * Simple LRU cache backed by a Map (insertion order).
 * Oldest entries are evicted when capacity is exceeded.
 */
export class LRUCache {
  private map = new Map<string, string>();
  private readonly cap: number;

  constructor(capacity = 500) {
    this.cap = capacity;
  }

  get(key: string): string | undefined {
    const val = this.map.get(key);
    if (val === undefined) return undefined;
    // Refresh recency
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key: string, value: string): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.cap) {
      // Delete oldest (first) entry
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  static makeKey(text: string, targetLang: string): string {
    return `${text}|${targetLang}`;
  }
}
