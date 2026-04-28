// chrome-extension/background/service-worker.js
import { AuthHandler } from "../auth/auth-handler.js";
import {
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_URL,
} from "../config/defaults.js";
import { assertExtensionApi } from "../shared/extension-api.js";

class BackgroundService {
  constructor() {
    this.extension = assertExtensionApi("BackgroundService");
    this.authHandler = new AuthHandler();
    this.supabaseUrl = DEFAULT_SUPABASE_URL;
    this.supabaseKey = DEFAULT_SUPABASE_ANON_KEY;
    this.orgId = null;
    this.userId = null;
  }

  async init() {
    await this.ensureDefaults();
    await this.authHandler.init();
    await this.loadConfig();
    this.setupListeners();
    console.log("ISGVizyon background service hazir");
  }

  async ensureDefaults() {
    const config = await this.extension.storage.local.get(["supabaseUrl", "supabaseKey"]);
    const payload = {};

    if (!config.supabaseUrl) payload.supabaseUrl = DEFAULT_SUPABASE_URL;
    if (!config.supabaseKey) payload.supabaseKey = DEFAULT_SUPABASE_ANON_KEY;

    if (Object.keys(payload).length > 0) {
      await this.extension.storage.local.set(payload);
    }
  }

  async fetchOrganizationId(userId, accessToken) {
    if (!userId || !accessToken) return null;

    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=organization_id&limit=1`,
        {
          headers: {
            apikey: this.supabaseKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) return null;

      const rows = await response.json();
      return rows?.[0]?.organization_id || null;
    } catch (error) {
      console.warn("Organization bilgisi alinamadi:", error?.message || error);
      return null;
    }
  }

  async loadConfig() {
    const config = await this.extension.storage.local.get([
      "supabaseUrl",
      "supabaseKey",
      "orgId",
      "userId",
      "denetron_auth",
    ]);

    this.supabaseUrl = config.supabaseUrl || DEFAULT_SUPABASE_URL;
    this.supabaseKey = config.supabaseKey || DEFAULT_SUPABASE_ANON_KEY;
    this.userId = config.userId || config.denetron_auth?.user?.id || null;

    const user = config.denetron_auth?.user || null;
    const accessToken =
      config.denetron_auth?.accessToken || config.denetron_auth?.session?.access_token || null;

    const fetchedOrgId = await this.fetchOrganizationId(this.userId, accessToken);

    this.orgId =
      user?.organization_id ||
      user?.user_metadata?.organization_id ||
      user?.app_metadata?.organization_id ||
      fetchedOrgId ||
      config.orgId ||
      this.userId ||
      null;

    await this.extension.storage.local.set({
      supabaseUrl: this.supabaseUrl,
      supabaseKey: this.supabaseKey,
      orgId: this.orgId,
      userId: this.userId,
    });

    return Boolean(this.supabaseUrl && this.supabaseKey);
  }

  setupListeners() {
    this.extension.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });

    this.setupExternalAuthListener();

    this.extension.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete") {
        this.handleTabUpdate(tabId, tab);
      }
    });
  }

  setupExternalAuthListener() {
    if (!this.extension.runtime.onMessageExternal) {
      console.warn("[Denetron Background] onMessageExternal kullanilamiyor");
      return;
    }

    this.extension.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
      this.handleExternalAuthMessage(message, sender, sendResponse);
      return true;
    });

    console.log("[Denetron Background] external auth listener hazir");
  }

  isAllowedExternalSender(sender) {
    const senderUrl = sender?.url || "";
    const senderOrigin = sender?.origin || "";

    return (
      senderUrl.startsWith("https://www.isgvizyon.com/") ||
      senderUrl.startsWith("https://isgvizyon.com/") ||
      senderOrigin === "https://www.isgvizyon.com" ||
      senderOrigin === "https://isgvizyon.com"
    );
  }

  summarizeExternalAuthData(authData) {
    const session = authData?.session || null;
    const user = authData?.user || session?.user || null;

    return {
      hasAuthData: Boolean(authData),
      hasSession: Boolean(session),
      hasAccessToken: Boolean(authData?.accessToken || session?.access_token),
      hasRefreshToken: Boolean(authData?.refreshToken || session?.refresh_token),
      hasUser: Boolean(user),
      userId: user?.id || null,
      userEmail: user?.email || null,
      expiresAt: authData?.expiresAt || session?.expires_at || null,
    };
  }

  async handleExternalAuthMessage(message, sender, sendResponse) {
    console.log("[Denetron Background] external message received", {
      messageType: message?.type,
      senderUrl: sender?.url || null,
      senderOrigin: sender?.origin || null,
      authSummary: this.summarizeExternalAuthData(message?.authData),
    });

    try {
      if (!this.isAllowedExternalSender(sender)) {
        console.warn("[Denetron Background] external message rejected: invalid sender", {
          senderUrl: sender?.url || null,
          senderOrigin: sender?.origin || null,
        });

        sendResponse({
          ok: false,
          success: false,
          error: "INVALID_SENDER",
        });

        return;
      }

      if (message?.type === "DENETRON_AUTH_PING") {
        console.log("[Denetron Background] external ping received", {
          senderUrl: sender?.url || null,
          senderOrigin: sender?.origin || null,
        });

        sendResponse({
          ok: true,
          success: true,
          pong: true,
        });

        return;
      }

      if (message?.type !== "DENETRON_AUTH_SUCCESS") {
        console.warn("[Denetron Background] external message ignored: invalid type", {
          type: message?.type,
        });

        sendResponse({
          ok: false,
          success: false,
          error: "INVALID_MESSAGE_TYPE",
        });

        return;
      }

      if (!message?.authData) {
        console.warn("[Denetron Background] external message missing authData");

        sendResponse({
          ok: false,
          success: false,
          error: "MISSING_AUTH_DATA",
        });

        return;
      }

      console.log("[Denetron Background] auth save start", {
        authSummary: this.summarizeExternalAuthData(message.authData),
      });

     await this.authHandler.init();
      await this.authHandler.saveAuth(message.authData);

      const verify = await this.extension.storage.local.get([
        "denetron_auth",
        "orgId",
        "userId",
      ]);

      this.userId = verify.userId || verify.denetron_auth?.user?.id || null;
      this.orgId = verify.orgId || this.userId || null;

      console.log("[Denetron Background] auth saved successfully", {
        hasStoredAuth: Boolean(verify.denetron_auth),
        userId: verify.userId || null,
        orgId: verify.orgId || null,
      });

      sendResponse({
        ok: true,
        success: true,
        saved: true,
        userId: verify.userId || null,
        orgId: verify.orgId || null,
      });

      console.log("[Denetron Background] auth saved successfully", {
        hasStoredAuth: Boolean(verify.denetron_auth),
        userId: verify.userId || null,
        orgId: verify.orgId || null,
      });

      sendResponse({
        ok: true,
        success: true,
        saved: true,
        userId: verify.userId || null,
        orgId: verify.orgId || null,
      });
    } catch (error) {
      console.error("[Denetron Background] auth save failed", {
        message: error?.message || String(error),
        stack: error?.stack || null,
      });

      sendResponse({
        ok: false,
        success: false,
        error: error?.message || "AUTH_SAVE_FAILED",
      });
    }
  }

  async handleMessage(message, _sender, sendResponse) {
    try {
      switch (message?.type) {
        case "SYNC_NOW":
          await this.handleManualSync();
          sendResponse({ success: true });
          break;

        case "ISGKATIP_COMPANIES_SCRAPED":
          await this.handleISGKatipSync(message.data || [], message.metadata || {});
          sendResponse({ success: true });
          break;

        case "GET_CONFIG":
          sendResponse({
            success: true,
            supabaseUrl: this.supabaseUrl,
            supabaseKey: this.supabaseKey,
            orgId: this.orgId,
            userId: this.userId,
          });
          break;

        default:
          sendResponse({ success: false, error: "Unknown message type" });
      }
    } catch (error) {
      console.error("Background message handling error:", error);
      sendResponse({ success: false, error: error?.message || "Unknown error" });
    }
  }

  cleanString(value) {
    return value ? String(value).trim() : "";
  }

  cleanNumber(value) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  validateDate(dateValue) {
    if (!dateValue) return null;
    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  calculateComplianceStatus(assigned, required) {
    if (!required || required <= 0) return "UNKNOWN";
    if (assigned >= required) return "COMPLIANT";
    if (assigned >= required * 0.8) return "WARNING";
    return "CRITICAL";
  }

  calculateRiskScore(company) {
    let score = 50;
    const hazardClass = String(company?.hazard_class || "");
    const employeeCount = this.cleanNumber(company?.employee_count);
    const complianceStatus = this.calculateComplianceStatus(
      this.cleanNumber(company?.assigned_minutes),
      this.cleanNumber(company?.required_minutes)
    );

    if (hazardClass.includes("Cok Tehlikeli") || hazardClass.includes("Çok Tehlikeli")) {
      score += 30;
    } else if (hazardClass.includes("Tehlikeli")) {
      score += 15;
    }

    if (employeeCount > 100) score += 10;
    else if (employeeCount > 50) score += 5;

    if (complianceStatus === "CRITICAL") score += 20;
    else if (complianceStatus === "WARNING") score += 10;

    return Math.min(score, 100);
  }

  async saveSyncLog(logData) {
    try {
      await fetch(`${this.supabaseUrl}/rest/v1/isgkatip_sync_logs`, {
        method: "POST",
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          org_id: this.orgId,
          source: logData.source,
          total_companies: logData.total_companies,
          success_count: logData.success_count,
          error_count: logData.error_count,
          metadata: logData.metadata,
        }),
      });
    } catch (error) {
      console.warn("Sync log kaydedilemedi:", error?.message || error);
    }
  }

  async loadStats() {
    if (!this.orgId) return;

    const scopeFilter = this.userId
      ? `or=(org_id.eq.${this.orgId},user_id.eq.${this.userId})`
      : `org_id=eq.${this.orgId}`;

    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/isgkatip_companies?${scopeFilter}&select=compliance_status,last_synced_at&order=last_synced_at.desc`,
      {
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Stats request failed with HTTP ${response.status}`);
    }

    const companies = await response.json();
    const lastSyncedAt = companies.find((item) => item.last_synced_at)?.last_synced_at || null;

    const stats = {
      totalCompanies: companies.length,
      warningCount: companies.filter((item) => item.compliance_status === "WARNING").length,
      criticalCount: companies.filter((item) => item.compliance_status === "CRITICAL").length,
    };

    await this.extension.storage.local.set({
      stats,
      extensionLastSyncedAt: lastSyncedAt,
    });
  }

  async handleManualSync() {
    await this.loadConfig();
    await this.loadStats();
  }

  async handleISGKatipSync(companies, metadata) {
    await this.loadConfig();

    if (!this.supabaseUrl || !this.supabaseKey || !this.orgId) {
      throw new Error("Supabase configuration eksik");
    }

    const headers = {
      apikey: this.supabaseKey,
      Authorization: `Bearer ${this.supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    };

    let successCount = 0;
    let errorCount = 0;

    for (const company of companies) {
      const payload = {
        org_id: this.orgId,
        user_id: this.userId,
        sgk_no: this.cleanString(company.sgk_no),
        company_name: this.cleanString(company.company_name),
        employee_count: this.cleanNumber(company.employee_count),
        hazard_class: this.cleanString(company.hazard_class) || "Az Tehlikeli",
        nace_code: this.cleanString(company.nace_code) || null,
        assigned_minutes: this.cleanNumber(company.assigned_minutes),
        required_minutes: this.cleanNumber(company.required_minutes),
        compliance_status: this.calculateComplianceStatus(
          this.cleanNumber(company.assigned_minutes),
          this.cleanNumber(company.required_minutes)
        ),
        risk_score: this.calculateRiskScore(company),
        contract_start: this.validateDate(company.contract_start),
        contract_end: this.validateDate(company.contract_end),
        last_synced_at: new Date().toISOString(),
      };

      if (!payload.sgk_no || !payload.company_name) {
        errorCount += 1;
        continue;
      }

      const response = await fetch(`${this.supabaseUrl}/rest/v1/isgkatip_companies`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (response.ok) successCount += 1;
      else errorCount += 1;
    }

    await this.saveSyncLog({
      source: "ISGKATIP_SCRAPER",
      total_companies: companies.length,
      success_count: successCount,
      error_count: errorCount,
      metadata,
    });

    await this.extension.action.setBadgeText({ text: successCount ? String(successCount) : "" });

    await this.extension.action.setBadgeBackgroundColor({
      color: successCount > 0 ? "#22c55e" : "#ef4444",
    });

    this.extension.notifications.create({
      type: "basic",
      iconUrl: "/assets/icon-128.png",
      title: successCount > 0 ? "ISG-KATIP senkronu tamamlandi" : "ISG-KATIP senkronu basarisiz",
      message:
        successCount > 0
          ? `${successCount} firma senkronize edildi${
              errorCount > 0 ? `, ${errorCount} kayit kontrol edilmeli.` : "."
            }`
          : "Kayitlar senkronize edilemedi.",
      priority: 1,
    });

    await this.loadStats();
  }

  handleTabUpdate(tabId, tab) {
    if (tab?.url?.includes("isgkatip.csgb.gov.tr")) {
      this.extension.action.setBadgeText({ tabId, text: "ISG" });
      this.extension.action.setBadgeBackgroundColor({ tabId, color: "#2563eb" });
    }
  }
}

const service = new BackgroundService();

service.init().catch((error) => {
  console.error("Background service baslatilamadi:", error);
});