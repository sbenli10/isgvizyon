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
  extensionStatus: "ISGVIZYON_EXTENSION_STATUS",
  validateAssignmentSurface: "ISGVIZYON_VALIDATE_ASSIGNMENT_SURFACE",
  validateDurationSurface: "ISGVIZYON_VALIDATE_DURATION_SURFACE",
  multiAssignmentApply: "ISGVIZYON_MULTI_ASSIGNMENT_APPLY",
  excessDurationApply: "ISGVIZYON_EXCESS_DURATION_APPLY",
  isgKatipStatus: "ISGVIZYON_ISGKATIP_STATUS",
  validateAssignmentSurfaceRequest: "ISGVIZYON_VALIDATE_ASSIGNMENT_SURFACE_REQUEST",
  validateDurationSurfaceRequest: "ISGVIZYON_VALIDATE_DURATION_SURFACE_REQUEST",
  multiAssignmentApplyRequest: "ISGVIZYON_MULTI_ASSIGNMENT_APPLY_REQUEST",
  excessDurationApplyRequest: "ISGVIZYON_EXCESS_DURATION_APPLY_REQUEST",
  configUpdated: "CONFIG_UPDATED",
  getConfig: "GET_CONFIG",
  syncSubmit: "ISGKATIP_SYNC_SUBMIT",
  syncNow: "SYNC_NOW",
};

const DEBUG_EXTENSION_STATUS = false;

const debugExtensionStatus = (...args) => {
  if (DEBUG_EXTENSION_STATUS) console.debug(...args);
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
    // Keep the service worker quiet in production; errors are still reported explicitly.
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
      senderUrl.startsWith("http://localhost/") ||
      senderUrl.startsWith("http://localhost:") ||
      senderUrl.startsWith("http://127.0.0.1/") ||
      senderUrl.startsWith("http://127.0.0.1:") ||
      senderOrigin === "https://www.isgvizyon.com" ||
      senderOrigin === "https://isgvizyon.com" ||
      senderOrigin === "http://localhost" ||
      senderOrigin.startsWith("http://localhost:") ||
      senderOrigin === "http://127.0.0.1" ||
      senderOrigin.startsWith("http://127.0.0.1:")
    );
  }

  async handleExternalMessage(message, sender) {
    if (!this.isAllowedExternalSender(sender)) {
      return { ok: false, success: false, error: "INVALID_SENDER" };
    }

    if (message?.type === MESSAGE_TYPES.authPing || message?.type === MESSAGE_TYPES.extensionStatus) {
      return this.getExtensionStatus();
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

      case MESSAGE_TYPES.authPing:
      case MESSAGE_TYPES.extensionStatus:
        return this.getExtensionStatus();

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

      case MESSAGE_TYPES.multiAssignmentApply:
        return this.handlePilotApply("multi_assignment_apply", MESSAGE_TYPES.multiAssignmentApplyRequest, message.data || {});

      case MESSAGE_TYPES.excessDurationApply:
        return this.handlePilotApply("excess_duration_update_apply", MESSAGE_TYPES.excessDurationApplyRequest, message.data || {});

      case MESSAGE_TYPES.validateAssignmentSurface:
        return this.handleSurfaceValidation(MESSAGE_TYPES.validateAssignmentSurfaceRequest, message.data || {});

      case MESSAGE_TYPES.validateDurationSurface:
        return this.handleSurfaceValidation(MESSAGE_TYPES.validateDurationSurfaceRequest, message.data || {});

      default:
        return { success: false, error: "Unknown message type" };
    }
  }

  async getIsgKatipTabStatus() {
    const tabs = await this.extension.tabs.query({
      url: "https://isgkatip.csgb.gov.tr/*",
    });

    if (!tabs.length) {
      return {
        state: "not_open",
        hasTab: false,
        isLoggedIn: false,
        isTargetPage: false,
      };
    }

    const tab = tabs[0];
    const status = {
      state: "open",
      hasTab: true,
      isLoggedIn: false,
      isTargetPage: Boolean(tab.url?.includes("/kisi-kurum/kisi-karti/kisi-kartim")),
      url: tab.url || null,
    };

    if (!tab.id) return status;

    try {
      const contentStatus = await this.extension.tabs.sendMessage(tab.id, {
        type: MESSAGE_TYPES.isgKatipStatus,
      });
      const isReady = Boolean(contentStatus?.isLoggedIn && contentStatus?.isTargetPage);

      return {
        ...status,
        ...contentStatus,
        state: isReady ? "ready" : "login_required",
      };
    } catch (_error) {
      return status;
    }
  }

  async getExtensionStatus() {
    debugExtensionStatus("[ServiceWorker] status request received");
    await this.authHandler.init();
    const config = await this.loadConfig();
    const isAuthenticated = await this.authHandler.isAuthenticated();
    const isgKatip = await this.getIsgKatipTabStatus();
    const manifest = this.extension.runtime.getManifest?.();
    const cached = await this.extension.storage.local.get([
      "stats",
      "companiesPreview",
      "extensionLastSyncedAt",
      "extensionLastSyncSummary",
      "serviceHealth",
      "systemStatus",
    ]);
    const totalCompanies =
      typeof cached.stats?.totalCompanies === "number"
        ? cached.stats.totalCompanies
        : Array.isArray(cached.companiesPreview)
          ? cached.companiesPreview.length
          : 0;
    const isKatipSessionActive = Boolean(
      isgKatip?.state === "ready" ||
        (isgKatip?.isLoggedIn && isgKatip?.isTargetPage),
    );
    const isReady = Boolean(isAuthenticated && isKatipSessionActive);

    return {
      type: "ISGVIZYON_EXTENSION_STATUS_RESPONSE",
      ok: true,
      success: true,
      pong: true,
      installed: true,
      source: "extension",
      authenticated: Boolean(isAuthenticated),
      isAuthenticated: Boolean(isAuthenticated),
      userId: config.userId || null,
      orgId: config.orgId || null,
      organizationName: config.organizationName || null,
      isgKatip,
      isKatipSessionActive,
      isReady,
      lastSyncAt: cached.extensionLastSyncedAt || null,
      extensionLastSyncedAt: cached.extensionLastSyncedAt || null,
      totalCompanies,
      systemStatus: cached.systemStatus || (isReady ? "Hazır" : "Kontrol gerekli"),
      serviceHealth: cached.serviceHealth || null,
      lastSyncSummary: cached.extensionLastSyncSummary || null,
      version: manifest?.version || null,
      extensionVersion: manifest?.version || null,
    };
  }

  maskSgkNo(value) {
    const normalized = String(value || "").replace(/\D/g, "");
    if (normalized.length <= 4) return normalized || "-";
    return `${normalized.slice(0, 3)}***${normalized.slice(-2)}`;
  }

  buildApplySummary(operationType, results, planHash) {
    return {
      operation_type: operationType,
      total_count: results.length,
      success_count: results.filter((item) => item.status === "success" || item.status === "success_verified" || item.status === "success_unverified").length,
      success_verified_count: results.filter((item) => item.status === "success_verified").length,
      success_unverified_count: results.filter((item) => item.status === "success_unverified").length,
      failed_count: results.filter((item) => item.status === "failed").length,
      skipped_count: results.filter((item) => item.status === "skipped").length,
      plan_hash: planHash,
      selector_low_confidence_count: results.filter((item) => item.selectorConfidence === "low").length,
      rows: results.map((item) => ({
        id: item.id || null,
        companyName: item.companyName || null,
        sgkNo: this.maskSgkNo(item.sgkNo),
        status: item.status || "failed",
        reason: item.reason || null,
        stage: item.stage || null,
        selectorConfidence: item.selectorConfidence || null,
        verificationStatus: item.verificationStatus || null,
      })),
    };
  }

  async handleSurfaceValidation(requestType, payload) {
    const isgKatip = await this.getIsgKatipTabStatus();
    if (!(isgKatip?.state === "ready" || (isgKatip?.isLoggedIn && isgKatip?.isTargetPage))) {
      return {
        success: false,
        error: "İşlem için uygun İSG-KATİP ekranı bulunamadı. Lütfen ilgili atama/sözleşme ekranını açıp tekrar deneyin.",
        validation: {
          pageContext: {
            url: isgKatip?.url || null,
            title: null,
            detectedModule: "unknown",
            confidence: "low",
          },
          formSurface: {
            found: false,
            requiredFieldsFound: 0,
            requiredFieldsMissing: ["İSG-KATİP hedef sayfası"],
            confidence: "low",
          },
          canApply: false,
          blockingReasons: ["İSG-KATİP oturumu hazır değil."],
        },
      };
    }

    const tab = await this.findReadyKatipTab();
    if (!tab?.id) {
      return {
        success: false,
        error: "İSG-KATİP sekmesi bulunamadı.",
      };
    }

    try {
      const response = await this.extension.tabs.sendMessage(tab.id, {
        type: requestType,
        payload,
      });
      return response;
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Form yüzeyi doğrulanamadı.",
      };
    }
  }

  async findReadyKatipTab() {
    const tabs = await this.extension.tabs.query({
      url: "https://isgkatip.csgb.gov.tr/*",
    });
    const preferredTab = tabs.find((tab) => tab.url?.includes("/kisi-kurum/kisi-karti/kisi-kartim")) || tabs[0] || null;
    return preferredTab;
  }

  async handlePilotApply(operationType, requestType, payload) {
    await this.authHandler.init();
    const isAuthenticated = await this.authHandler.isAuthenticated();
    if (!isAuthenticated) {
      return { success: false, error: "İSGVizyon oturumu bulunamadı." };
    }

    const planHash = payload?.planHash || null;
    const operationId = payload?.operationId || null;
    const records = Array.isArray(payload?.records) ? payload.records.slice(0, 3) : [];

    if (!planHash) {
      return { success: false, error: "Plan doğrulaması başarısız oldu. Lütfen önizlemeyi yeniden oluşturun." };
    }

    if (!records.length) {
      return { success: false, error: "İşlem yapılacak kayıt seçilmedi." };
    }

    if (records.length > 3) {
      return { success: false, error: "Pilot modda en fazla 3 kayıt işlenebilir." };
    }

    const isgKatip = await this.getIsgKatipTabStatus();
    if (!(isgKatip?.state === "ready" || (isgKatip?.isLoggedIn && isgKatip?.isTargetPage))) {
      return { success: false, error: "İSG-KATİP oturumu bulunamadı veya hedef sayfa hazır değil." };
    }

    const tab = await this.findReadyKatipTab();
    if (!tab?.id) {
      return { success: false, error: "İSG-KATİP sekmesi bulunamadı." };
    }

    try {
      const validationRequestType =
        operationType === "multi_assignment_apply"
          ? MESSAGE_TYPES.validateAssignmentSurfaceRequest
          : MESSAGE_TYPES.validateDurationSurfaceRequest;
      const validation = await this.extension.tabs.sendMessage(tab.id, {
        type: validationRequestType,
        payload: {
          records,
        },
      });

      if (!validation?.success || !validation?.validation?.canApply) {
        return {
          success: false,
          error:
            validation?.error ||
            "Form yüzeyi doğrulanmadıysa işlem başlatılamaz.",
          validation: validation?.validation || null,
        };
      }

      const response = await this.extension.tabs.sendMessage(tab.id, {
        type: requestType,
        payload: {
          operationId,
          planHash,
          records,
          pilotLimit: 3,
          validation: validation.validation,
        },
      });

      const results = Array.isArray(response?.results) ? response.results : [];
      return {
        success: Boolean(response?.success),
        summary: this.buildApplySummary(operationType, results, planHash),
        results,
        error: response?.error || null,
        validation: validation.validation || null,
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "İSG-KATİP form alanları bulunamadı. Sayfa yapısı değişmiş olabilir.",
      };
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
      systemStatus: summary.errors > 0 ? "Sunucu senkronu kontrol edilmeli" : "Hazır",
      serviceHealth: summary.errors > 0 ? "Kontrol gerekli" : "Hazır",
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
      systemStatus: companies.length > 0 ? "Hazır" : "Firma verisi bekleniyor",
      serviceHealth: "Hazır",
    });
  }
}

const service = new BackgroundService();
service.init().catch((error) => {
  console.error("[ISGVizyon Background] başlatılamadı:", error);
});
