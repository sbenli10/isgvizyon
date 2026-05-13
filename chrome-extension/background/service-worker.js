import { AuthHandler } from "../auth/auth-handler.js";
import {
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_URL,
} from "../config/defaults.js";
import { assertExtensionApi } from "../shared/extension-api.js";

const MESSAGE_TYPES = {
  authSessionUpdated: "AUTH_SESSION_UPDATED",
  authPing: "DENETRON_AUTH_PING",
  authSuccess: "DENETRON_AUTH_SUCCESS",
  configUpdated: "CONFIG_UPDATED",
  getConfig: "GET_CONFIG",
  syncSubmit: "ISGKATIP_SYNC_SUBMIT",
  syncNow: "SYNC_NOW",
};

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
    console.log("[ISGVizyon Background] hazır");
  }

  async ensureDefaults() {
    const config = await this.extension.storage.local.get(["supabaseUrl", "supabaseKey"]);
    const payload = {};

    if (!config.supabaseUrl) payload.supabaseUrl = DEFAULT_SUPABASE_URL;
    if (!config.supabaseKey) payload.supabaseKey = DEFAULT_SUPABASE_ANON_KEY;

    if (Object.keys(payload).length) {
      await this.extension.storage.local.set(payload);
    }
  }

  async loadConfig() {
    const config = await this.extension.storage.local.get([
      "supabaseUrl",
      "supabaseKey",
      "orgId",
      "userId",
      "organizationName",
      "denetron_auth",
    ]);

    this.supabaseUrl = config.supabaseUrl || DEFAULT_SUPABASE_URL;
    this.supabaseKey = config.supabaseKey || DEFAULT_SUPABASE_ANON_KEY;
    this.userId = config.userId || config.denetron_auth?.user?.id || null;
    this.orgId =
      config.orgId ||
      config.denetron_auth?.user?.organization_id ||
      config.denetron_auth?.user?.user_metadata?.organization_id ||
      config.denetron_auth?.user?.app_metadata?.organization_id ||
      null;

    return {
      supabaseUrl: this.supabaseUrl,
      supabaseKey: this.supabaseKey,
      orgId: this.orgId,
      userId: this.userId,
      organizationName: config.organizationName || null,
    };
  }

  setupListeners() {
    this.extension.runtime.onMessage.addListener((message, sender, sendResponse) => {
      void this.handleMessage(message, sender)
        .then((result) => sendResponse(result))
        .catch((error) => {
          console.error("[ISGVizyon Background] runtime message error:", error);
          sendResponse({
            success: false,
            error: error?.message || "Beklenmeyen uzantı hatası.",
          });
        });
      return true;
    });

    if (this.extension.runtime.onMessageExternal) {
      this.extension.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
        void this.handleExternalMessage(message, sender)
          .then((result) => sendResponse(result))
          .catch((error) => {
            console.error("[ISGVizyon Background] external message error:", error);
            sendResponse({
              ok: false,
              success: false,
              error: error?.message || "Harici mesaj işlenemedi.",
            });
          });
        return true;
      });
    }

    this.extension.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete" && tab?.url?.includes("isgkatip.csgb.gov.tr")) {
        void this.extension.action.setBadgeText({ tabId, text: "ISG" });
        void this.extension.action.setBadgeBackgroundColor({ tabId, color: "#2563eb" });
      }
    });
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

  async handleExternalMessage(message, sender) {
    if (!this.isAllowedExternalSender(sender)) {
      return { ok: false, success: false, error: "INVALID_SENDER" };
    }

    if (message?.type === MESSAGE_TYPES.authPing) {
      return { ok: true, success: true, pong: true };
    }

    if (message?.type !== MESSAGE_TYPES.authSuccess) {
      return { ok: false, success: false, error: "INVALID_MESSAGE_TYPE" };
    }

    return this.persistAuthSession(message.authData);
  }

  async handleMessage(message) {
    switch (message?.type) {
      case MESSAGE_TYPES.authSessionUpdated:
        return this.persistAuthSession(message.data);

      case MESSAGE_TYPES.getConfig:
        return {
          success: true,
          ...(await this.loadConfig()),
        };

      case MESSAGE_TYPES.configUpdated:
        return this.handleConfigUpdated(message.data);

      case MESSAGE_TYPES.syncSubmit:
        return this.handleISGKatipSync(message.data || [], message.metadata || {});

      case MESSAGE_TYPES.syncNow:
        await this.loadStats();
        return { success: true };

      default:
        return { success: false, error: "Unknown message type" };
    }
  }

  async persistAuthSession(authData) {
    if (!authData) {
      return { ok: false, success: false, error: "MISSING_AUTH_DATA" };
    }

    await this.authHandler.init();
    await this.authHandler.saveAuth(authData);
    const config = await this.loadConfig();

    return {
      ok: true,
      success: true,
      saved: true,
      userId: config.userId,
      orgId: config.orgId,
    };
  }

  async handleConfigUpdated(data) {
    const payload = {};

    if (data?.supabaseUrl) payload.supabaseUrl = data.supabaseUrl;
    if (data?.supabaseKey) payload.supabaseKey = data.supabaseKey;
    if (data?.orgId) payload.orgId = data.orgId;

    if (Object.keys(payload).length) {
      await this.extension.storage.local.set(payload);
    }

    return {
      success: true,
      ...(await this.loadConfig()),
    };
  }

  cleanString(value) {
    return value ? String(value).trim() : "";
  }

  cleanNumber(value) {
    const parsed = Number.parseInt(String(value ?? "").replace(/[^\d-]/g, ""), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  async getAuthorizedHeaders() {
    const accessToken = await this.authHandler.getAccessToken();
    if (!accessToken) {
      throw new Error("ISGVizyon oturumu bulunamadı. Lütfen tekrar giriş yapın.");
    }

    return {
      apikey: this.supabaseKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }

  mapCompanyForSync(company) {
    const employeeCount = this.cleanNumber(company.employeeCount);
    const assignedMinutes = this.cleanNumber(company.assignedMinutes);
    const requiredMinutes = this.cleanNumber(company.requiredMinutes);

    return {
      sgkNo: this.cleanString(company.sgkNo),
      companyName: this.cleanString(company.companyName),
      employeeCount: employeeCount ?? 0,
      hazardClass: this.cleanString(company.hazardClass) || "Az Tehlikeli",
      naceCode: this.cleanString(company.naceCode) || null,
      contractStart: this.cleanString(company.contractStart) || null,
      contractEnd: this.cleanString(company.contractEnd) || null,
      assignedMinutes: assignedMinutes ?? 0,
      requiredMinutes,
    };
  }

  async handleISGKatipSync(companies, metadata) {
    await this.loadConfig();

    if (!this.orgId || !this.userId) {
      throw new Error("ISGVizyon kullanıcı/organizasyon bilgisi bulunamadı.");
    }

    if (!Array.isArray(companies) || !companies.length) {
      throw new Error("Aktarılacak firma verisi bulunamadı.");
    }

    const normalizedCompanies = companies
      .map((company) => this.mapCompanyForSync(company))
      .filter((company) => company.sgkNo && company.companyName);

    if (!normalizedCompanies.length) {
      throw new Error("Geçerli firma kaydı bulunamadı.");
    }

    const response = await fetch(`${this.supabaseUrl}/functions/v1/isgkatip-sync`, {
      method: "POST",
      headers: await this.getAuthorizedHeaders(),
      body: JSON.stringify({
        action: "BATCH_SYNC",
        data: {
          source: "ISGKATIP_EXTENSION",
          companies: normalizedCompanies,
          metadata: {
            ...metadata,
            totalRequested: companies.length,
          },
        },
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || `Senkronizasyon başarısız. HTTP ${response.status}`);
    }

    const summary = payload.summary || {
      total: normalizedCompanies.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    await this.extension.storage.local.set({
      extensionLastSyncedAt: new Date().toISOString(),
      extensionLastSyncSummary: summary,
    });

    await this.extension.action.setBadgeText({
      text: summary.total ? String(summary.total) : "",
    });
    await this.extension.action.setBadgeBackgroundColor({
      color: summary.errors > 0 ? "#dc2626" : "#059669",
    });

    this.extension.notifications.create({
      type: "basic",
      iconUrl: "/assets/icon-128.png",
      title: summary.errors > 0 ? "ISGVizyon senkronu tamamlandı (kontrol gerekli)" : "ISGVizyon senkronu tamamlandı",
      message: `Yeni: ${summary.inserted ?? 0}, güncel: ${summary.updated ?? 0}, atlanan: ${
        summary.skipped ?? 0
      }, hatalı: ${summary.errors ?? 0}`,
      priority: 1,
    });

    await this.loadStats();

    return {
      success: true,
      summary,
      results: payload.results || [],
    };
  }

  async loadStats() {
    await this.loadConfig();
    if (!this.orgId) return;

    const headers = await this.getAuthorizedHeaders();
    const response = await fetch(
      `${this.supabaseUrl}/functions/v1/isgkatip-sync`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "GET_COMPANIES",
          data: {
            filters: {},
          },
        }),
      }
    );

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || `İstatistikler alınamadı. HTTP ${response.status}`);
    }

    const companies = Array.isArray(payload.companies) ? payload.companies : [];
    const lastSyncedAt = companies.find((item) => item.last_synced_at)?.last_synced_at || null;

    await this.extension.storage.local.set({
      stats: {
        totalCompanies: companies.length,
        warningCount: companies.filter((item) => item.compliance_status === "WARNING").length,
        criticalCount: companies.filter((item) => item.compliance_status === "CRITICAL").length,
      },
      companiesPreview: companies.slice(0, 50),
      extensionLastSyncedAt: lastSyncedAt,
    });
  }
}

const service = new BackgroundService();
service.init().catch((error) => {
  console.error("[ISGVizyon Background] başlatılamadı:", error);
});
