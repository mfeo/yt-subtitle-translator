export class AbortManager {
  private controllers = new Map<string, AbortController>();

  /**
   * Get or create an AbortController for a given key.
   * Calling this aborts any existing controller for that key.
   */
  create(key: string): AbortController {
    const existing = this.controllers.get(key);
    if (existing) {
      existing.abort();
    }
    const ctrl = new AbortController();
    this.controllers.set(key, ctrl);
    return ctrl;
  }

  abort(key: string): void {
    const ctrl = this.controllers.get(key);
    if (ctrl) {
      ctrl.abort();
      this.controllers.delete(key);
    }
  }

  abortAll(): void {
    for (const ctrl of this.controllers.values()) {
      ctrl.abort();
    }
    this.controllers.clear();
  }
}
