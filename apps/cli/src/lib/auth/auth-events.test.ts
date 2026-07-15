import { test, expect, describe } from "bun:test";
import { onAuthChange, emitAuthChange } from "./auth-events.ts";

describe("auth-events", () => {
  test("notifies subscribers on emit", () => {
    let count = 0;
    const unsubscribe = onAuthChange(() => {
      count += 1;
    });
    emitAuthChange();
    emitAuthChange();
    expect(count).toBe(2);
    unsubscribe();
  });

  test("stops notifying after unsubscribe", () => {
    let count = 0;
    const unsubscribe = onAuthChange(() => {
      count += 1;
    });
    emitAuthChange();
    unsubscribe();
    emitAuthChange();
    expect(count).toBe(1);
  });

  test("supports multiple independent subscribers", () => {
    const seen: string[] = [];
    const off1 = onAuthChange(() => seen.push("a"));
    const off2 = onAuthChange(() => seen.push("b"));
    emitAuthChange();
    expect(seen.sort()).toEqual(["a", "b"]);
    off1();
    off2();
  });
});
