import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useFormDraft } from "@/hooks/useFormDraft";

describe("useFormDraft", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("initialValue kullanılır, sessionStorage'da veri yoksa", () => {
    const { result } = renderHook(() => useFormDraft("test:key", "default"));
    const [value] = result.current;
    expect(value).toBe("default");
  });

  it("mevcut sessionStorage taslağı geri yüklenir", () => {
    window.sessionStorage.setItem("test:note", JSON.stringify("önceki taslak"));
    const { result } = renderHook(() => useFormDraft("test:note", ""));
    const [value] = result.current;
    expect(value).toBe("önceki taslak");
  });

  it("state değiştiğinde sessionStorage güncellenir", async () => {
    const { result } = renderHook(() => useFormDraft("test:input", ""));

    act(() => {
      const [, setValue] = result.current;
      setValue("yeni değer");
    });

    const [value] = result.current;
    expect(value).toBe("yeni değer");
    expect(JSON.parse(window.sessionStorage.getItem("test:input") ?? "null")).toBe("yeni değer");
  });

  it("clearDraft sessionStorage anahtarını kaldırır", () => {
    window.sessionStorage.setItem("test:clear", JSON.stringify("taslak"));
    const { result } = renderHook(() => useFormDraft("test:clear", ""));

    act(() => {
      const [, , clearDraft] = result.current;
      clearDraft();
    });

    expect(window.sessionStorage.getItem("test:clear")).toBeNull();
  });

  it("nesne (object) değerleri doğru persist edilir", async () => {
    const initial = { search: "", status: "all" };

    const { result } = renderHook(() => useFormDraft("test:obj", initial));

    act(() => {
      const [, setValue] = result.current;
      setValue((prev) => ({ ...prev, search: "abc" }));
    });

    const [value] = result.current;
    expect(value.search).toBe("abc");
    expect(value.status).toBe("all");
  });

  it("geçersiz JSON sessionStorage değeri görmezden gelinir ve initialValues döndürülür", () => {
    window.sessionStorage.setItem("test:bad", "not-json-{{");
    const { result } = renderHook(() => useFormDraft("test:bad", "fallback"));
    const [value] = result.current;
    expect(value).toBe("fallback");
  });
});
