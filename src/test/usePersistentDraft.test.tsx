import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  usePersistentDraft,
  writeStoredDraft,
  readStoredDraft,
} from "@/hooks/usePersistentDraft";

describe("usePersistentDraft", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.useFakeTimers();
  });

  it("restores a saved draft and writes updates back to storage", () => {
    writeStoredDraft("reports:user-1", { hazardInput: "mevcut taslak" }, 1);
    const onRestore = vi.fn();

    const { rerender } = renderHook(
      ({ value }) =>
        usePersistentDraft({
          key: "reports:user-1",
          version: 1,
          value,
          onRestore,
        }),
      {
        initialProps: {
          value: { hazardInput: "" },
        },
      },
    );

    expect(onRestore).toHaveBeenCalledWith({ hazardInput: "mevcut taslak" });

    rerender({ value: { hazardInput: "güncel taslak" } });

    act(() => {
      vi.advanceTimersByTime(550);
    });

    expect(readStoredDraft("reports:user-1", 1)).toEqual({ hazardInput: "güncel taslak" });
  });

  it("skips incompatible draft versions", () => {
    writeStoredDraft("document-analysis:user-1", { contextNote: "v1" }, 1);
    const onRestore = vi.fn();

    renderHook(() =>
      usePersistentDraft({
        key: "document-analysis:user-1",
        version: 2,
        value: { contextNote: "" },
        onRestore,
      }),
    );

    expect(onRestore).not.toHaveBeenCalled();
    expect(readStoredDraft("document-analysis:user-1", 2)).toBeNull();
  });

  it("re-hydrates when the draft key changes between entities", () => {
    writeStoredDraft("capa:user-1:company-a:new", { nonConformity: "İlk kayıt" }, 1);
    writeStoredDraft("capa:user-1:company-a:edit-42", { nonConformity: "Düzenleme kaydı" }, 1);
    const onRestore = vi.fn();

    const { rerender } = renderHook(
      ({ draftKey }) =>
        usePersistentDraft({
          key: draftKey,
          version: 1,
          value: { nonConformity: "" },
          onRestore,
        }),
      {
        initialProps: {
          draftKey: "capa:user-1:company-a:new",
        },
      },
    );

    expect(onRestore).toHaveBeenNthCalledWith(1, { nonConformity: "İlk kayıt" });

    rerender({ draftKey: "capa:user-1:company-a:edit-42" });

    expect(onRestore).toHaveBeenNthCalledWith(2, { nonConformity: "Düzenleme kaydı" });
  });
});
