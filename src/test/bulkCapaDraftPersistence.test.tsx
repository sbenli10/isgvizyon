import React, { useEffect, useMemo, useRef, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachBulkCapaDraftFlushListeners,
  clearPersistedBulkCapaDraft,
  persistBulkCapaDraftSnapshot,
  readStoredBulkCapaDraft,
  type BulkCAPADraftSnapshot,
} from "@/pages/BulkCAPA";

function buildSnapshot(manualCompanyName: string): BulkCAPADraftSnapshot {
  return {
    companyInputMode: "manual",
    selectedCompanyId: "",
    manualCompanyName,
    generalInfo: {
      company_name: manualCompanyName,
      company_logo_url: null,
      provider_logo_url: null,
      area_region: "",
      observation_range: "",
      report_date: "2026-05-01",
      observer_name: "",
      observer_certificate_no: "",
      responsible_person: "",
      employer_representative_title: "",
      employer_representative_name: "",
      report_no: "",
    },
    newEntry: {
      id: "",
      description: "",
      riskDefinition: "",
      correctiveAction: "",
      preventiveAction: "",
      importance_level: "Orta",
      termin_date: "",
      related_department: "Diger",
      notification_method: "E-mail",
      responsible_name: "",
      responsible_role: "",
      approver_name: "",
      approver_title: "",
      include_stamp: true,
      media_urls: [],
      ai_analyzed: false,
    },
    bulkSourceImages: [],
    entries: [],
    overallAnalysis: "",
    createMode: "single",
    createStep: "general",
    createDialogOpen: true,
    sessionId: null,
    sessionStatus: null,
    sessionJobType: null,
  };
}

function BulkCapaDraftHarness() {
  const initialDraft = useMemo(() => readStoredBulkCapaDraft(), []);
  const [companyName, setCompanyName] = useState(initialDraft?.manualCompanyName || "");
  const latestNameRef = useRef(companyName);

  useEffect(() => {
    latestNameRef.current = companyName;
    void persistBulkCapaDraftSnapshot(null, buildSnapshot(companyName));
  }, [companyName]);

  useEffect(() => {
    return attachBulkCapaDraftFlushListeners({
      flushDraft: () => {
        void persistBulkCapaDraftSnapshot(null, buildSnapshot(latestNameRef.current));
      },
    });
  }, []);

  return (
    <div>
      <input
        aria-label="Firma adı"
        value={companyName}
        onChange={(event) => setCompanyName(event.target.value)}
      />
      <button
        type="button"
        onClick={async () => {
          await clearPersistedBulkCapaDraft(null);
          setCompanyName("");
        }}
      >
        Başarılı submit
      </button>
    </div>
  );
}

describe("BulkCAPA draft persistence", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    await clearPersistedBulkCapaDraft(null);
  });

  it("hidden -> visible does not call window.location.reload", () => {
    const reloadSpy = vi.spyOn(window.location, "reload").mockImplementation(() => undefined as never);
    render(<BulkCapaDraftHarness />);

    act(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(reloadSpy).not.toHaveBeenCalled();
    reloadSpy.mockRestore();
  });

  it("keeps form values after visibilitychange", () => {
    render(<BulkCapaDraftHarness />);
    const input = screen.getByLabelText("Firma adı");

    fireEvent.change(input, { target: { value: "Aslan İnşaat" } });

    act(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(screen.getByLabelText("Firma adı")).toHaveValue("Aslan İnşaat");
  });

  it("restores draft after remount", () => {
    const view = render(<BulkCapaDraftHarness />);
    fireEvent.change(screen.getByLabelText("Firma adı"), { target: { value: "Beta Metal" } });

    view.unmount();
    render(<BulkCapaDraftHarness />);

    expect(screen.getByLabelText("Firma adı")).toHaveValue("Beta Metal");
  });

  it("clears draft after successful submit", async () => {
    const view = render(<BulkCapaDraftHarness />);
    fireEvent.change(screen.getByLabelText("Firma adı"), { target: { value: "Gamma Lojistik" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Başarılı submit" }));
    });

    view.unmount();
    render(<BulkCapaDraftHarness />);

    expect(screen.getByLabelText("Firma adı")).toHaveValue("");
  });
});
