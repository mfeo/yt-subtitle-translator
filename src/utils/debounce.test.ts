import { describe, it, expect, mock } from "bun:test";
import { debounce, throttle } from "./debounce.js";

describe("debounce", () => {
  it("delays execution", async () => {
    const fn = mock(() => {});
    const debounced = debounce(fn, 50);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 80));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("cancels previous call when called again before delay", async () => {
    const fn = mock(() => {});
    const debounced = debounce(fn, 50);

    debounced();
    debounced();
    debounced();

    await new Promise((r) => setTimeout(r, 80));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("throttle", () => {
  it("calls immediately on first invocation", () => {
    const fn = mock(() => {});
    const throttled = throttle(fn, 100);
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("suppresses calls within throttle window", async () => {
    const fn = mock(() => {});
    const throttled = throttle(fn, 100);
    throttled();
    throttled();
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);

    await new Promise((r) => setTimeout(r, 120));
    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
