import { describe, expect, it, vi } from "vitest";
import { safeInsertBefore, safeRemoveChild, withTemporaryBodyChild } from "@/lib/safeDom";

describe("safeDom helpers", () => {
  it("recovers from an invalid insertBefore reference mutated by the environment", () => {
    const parent = document.createElement("div");
    const anchor = document.createElement("span");
    const tail = document.createElement("span");
    const injected = document.createElement("strong");
    const onFailure = vi.fn();

    anchor.textContent = "anchor";
    tail.textContent = "tail";
    injected.textContent = "injected-node";
    parent.append(anchor, tail);
    anchor.remove();

    expect(() => safeInsertBefore(parent, injected, anchor, onFailure)).not.toThrow();
    expect(parent.textContent).toContain("tail");
    expect(parent.textContent).toContain("injected-node");
    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "insertBefore",
        fallbackStrategy: "append-child",
      }),
    );
  });

  it("skips stale removeChild calls without crashing", () => {
    const parent = document.createElement("div");
    const child = document.createElement("span");
    const onFailure = vi.fn();

    parent.appendChild(child);
    parent.removeChild(child);

    expect(() => safeRemoveChild(parent, child, onFailure)).not.toThrow();
    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "removeChild",
        fallbackStrategy: "skip-remove",
      }),
    );
  });

  it("handles temporary body children even when the node is removed early", () => {
    const anchor = document.createElement("a");
    anchor.textContent = "download";

    expect(() =>
      withTemporaryBodyChild(anchor, () => {
        expect(document.body.contains(anchor)).toBe(true);
        document.body.removeChild(anchor);
      }),
    ).not.toThrow();

    expect(document.body.contains(anchor)).toBe(false);
  });
});
