// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import {
  consumeIntendedRoute,
  isPersistableRoute,
  readLastSafeRoute,
  resolvePostAuthRoute,
  saveIntendedRoute,
  saveLastSafeRoute,
} from "@/lib/navigationPersistence";
import {
  clearStoredDraft,
  readStoredDraft,
  writeStoredDraft,
} from "@/hooks/usePersistentDraft";

describe("navigation persistence", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("stores and consumes intended routes safely", () => {
    saveIntendedRoute("/reports?companyId=abc");

    expect(consumeIntendedRoute()).toBe("/reports?companyId=abc");
    expect(consumeIntendedRoute()).toBeNull();
  });

  it("ignores auth and landing routes for persistence", () => {
    expect(isPersistableRoute("/reports")).toBe(true);
    expect(isPersistableRoute("/auth")).toBe(false);
    expect(isPersistableRoute("/landing/pricing")).toBe(false);
  });

  it("keeps the last safe route in session storage", () => {
    saveLastSafeRoute("/bulk-capa?companyId=123");
    expect(readLastSafeRoute()).toBe("/bulk-capa?companyId=123");
  });

  it("resolves post-auth route by intended, then last safe, then fallback", () => {
    saveLastSafeRoute("/companies?view=cards");
    saveIntendedRoute("/reports?companyId=abc");

    expect(resolvePostAuthRoute("/")).toBe("/reports?companyId=abc");
    expect(resolvePostAuthRoute("/")).toBe("/companies?view=cards");
    window.sessionStorage.removeItem("denetron:last-safe-route");
    expect(resolvePostAuthRoute("/dashboard")).toBe("/dashboard");
  });
});

describe("draft persistence helpers", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("hydrates stored drafts with version matching", () => {
    writeStoredDraft("reports:user-1", { hazardInput: "test" }, 2);

    expect(readStoredDraft<{ hazardInput: string }>("reports:user-1", 2)).toEqual({
      hazardInput: "test",
    });
    expect(readStoredDraft("reports:user-1", 1)).toBeNull();
  });

  it("clears drafts after submit or reset", () => {
    writeStoredDraft("reports:user-1", { hazardInput: "draft" }, 1);
    clearStoredDraft("reports:user-1");

    expect(readStoredDraft("reports:user-1", 1)).toBeNull();
  });

  it("returns null for invalid JSON payloads without crashing", () => {
    window.localStorage.setItem("denetron:draft:reports:user-1", "{broken");
    expect(readStoredDraft("reports:user-1", 1)).toBeNull();
  });
});
