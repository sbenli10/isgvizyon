import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import {
  BulkCAPAContent,
  clearPersistedBulkCapaDraft,
  persistBulkCapaDraftSnapshot,
  type BulkCAPADraftSnapshot,
} from "@/pages/BulkCAPA";

const profileResponse = {
  data: {
    organization_id: null,
    full_name: "Test Uzmani",
    position: "İş Güvenliği Uzmanı",
    avatar_url: null,
    stamp_url: null,
  },
  error: null,
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "test-user",
      email: "test@example.com",
    },
    session: {
      user: {
        id: "test-user",
        email: "test@example.com",
      },
    },
    loading: false,
    profile: null,
    refreshProfile: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/osgbPageCache", () => ({
  readOsgbPageCache: vi.fn(() => null),
  writeOsgbPageCache: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => {
  const buildCompaniesChain = () => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(async () => ({ data: [], error: null })),
    };

    return chain;
  };

  const buildProfilesChain = () => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => profileResponse),
    };

    return chain;
  };

  const buildGenericChain = () => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      single: vi.fn(async () => ({ data: null, error: null })),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      ilike: vi.fn(() => chain),
    };

    return chain;
  };

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === "companies") {
          return buildCompaniesChain();
        }

        if (table === "profiles") {
          return buildProfilesChain();
        }

        return buildGenericChain();
      }),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(async () => ({ data: null, error: null })),
        })),
      },
    },
  };
});

function buildDraftSnapshot(): BulkCAPADraftSnapshot {
  return {
    companyInputMode: "manual",
    selectedCompanyId: "",
    manualCompanyName: "Aslan İnşaat",
    generalInfo: {
      company_name: "Aslan İnşaat",
      company_logo_url: null,
      provider_logo_url: null,
      area_region: "Üretim Sahası",
      observation_range: "A Blok",
      report_date: "2026-05-01",
      observer_name: "Deneme Uzman",
      observer_certificate_no: "",
      responsible_person: "İŞVEREN / İŞVEREN VEKİLİ",
      employer_representative_title: "İşveren / İşveren Vekili",
      employer_representative_name: "",
      report_no: "DRAFT-001",
    },
    newEntry: {
      id: "",
      description: "Taslak açıklama",
      riskDefinition: "Taslak risk",
      correctiveAction: "Taslak düzeltici faaliyet",
      preventiveAction: "",
      importance_level: "Orta",
      termin_date: "",
      related_department: "Üretim",
      notification_method: "E-mail",
      responsible_name: "",
      responsible_role: "",
      approver_name: "Deneme Uzman",
      approver_title: "İş Güvenliği Uzmanı",
      include_stamp: true,
      media_urls: [],
      ai_analyzed: false,
    },
    bulkSourceImages: [],
    entries: [],
    overallAnalysis: "",
    createMode: "single",
    createStep: "items",
    createDialogOpen: false,
    sessionId: null,
    sessionStatus: null,
    sessionJobType: null,
  };
}

describe("BulkCAPA runtime draft guards", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    await clearPersistedBulkCapaDraft("bulk-capa-draft:test-user");
    await persistBulkCapaDraftSnapshot("bulk-capa-draft:test-user", buildDraftSnapshot());
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps restored form values across blur/focus and delayed profile defaults", async () => {
    render(
      <MemoryRouter initialEntries={["/bulk-capa"]}>
        <BulkCAPAContent />
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue("Taslak açıklama")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
    });

    expect(screen.getByDisplayValue("Taslak açıklama")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Taslak açıklama")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Aslan İnşaat")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Deneme Uzman")).toBeInTheDocument();
    });
  }, 10000);
});
