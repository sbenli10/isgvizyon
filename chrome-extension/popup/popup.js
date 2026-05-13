// chrome-extension/popup/popup.js
import { AuthHandler } from "../auth/auth-handler.js";
import {
  DEFAULT_PRIVACY_POLICY_URL,
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_URL,
  EXTENSION_LEGAL_NOTICE,
} from "../config/defaults.js";
import { assertExtensionApi } from "../shared/extension-api.js";

const POPUP_DEBUG = true;
const POPUP_LOG_PREFIX = "[Denetron Popup]";
const WEB_APP_URL = "https://www.isgvizyon.com";
const ISGKATIP_URL = "https://isgkatip.csgb.gov.tr/kisi-kurum/kisi-karti/kisi-kartim";

function popupLog(step, data = {}) {
  if (!POPUP_DEBUG) return;

  try {
    console.log(`${POPUP_LOG_PREFIX} ${step}`, {
      step,
      time: new Date().toISOString(),
      ...data,
    });
  } catch (_error) {
    console.log(POPUP_LOG_PREFIX, step, data);
  }
}

function popupWarn(step, data = {}) {
  if (!POPUP_DEBUG) return;

  console.log(`${POPUP_LOG_PREFIX} WARN ${step}`, {
    step,
    time: new Date().toISOString(),
    ...data,
  });
}

function popupError(step, error, data = {}) {
  console.warn(`${POPUP_LOG_PREFIX} ERROR ${step}`, {
    step,
    time: new Date().toISOString(),
    error: {
      name: error?.name || null,
      message: error?.message || String(error),
      stack: error?.stack || null,
    },
    ...data,
  });
}

function maskValue(value, visibleStart = 6, visibleEnd = 4) {
  if (!value || typeof value !== "string") return null;
  if (value.length <= visibleStart + visibleEnd) return "***";
  return `${value.slice(0, visibleStart)}...${value.slice(-visibleEnd)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function summarizeAuthData(authData) {
  if (!authData) return { exists: false };

  const session = authData.session || authData;
  const accessToken = authData.accessToken || authData.access_token || session.access_token;
  const refreshToken = authData.refreshToken || authData.refresh_token || session.refresh_token;
  const user = authData.user || session.user || null;

  return {
    exists: true,
    hasAccessToken: Boolean(accessToken),
    accessTokenMasked: maskValue(accessToken),
    hasRefreshToken: Boolean(refreshToken),
    refreshTokenMasked: maskValue(refreshToken),
    hasUser: Boolean(user),
    userId: user?.id || null,
    userEmail: user?.email || null,
    hasSession: Boolean(authData.session),
  };
}

window.addEventListener("error", (event) => {
  popupError("window:error", event.error || new Error(event.message), {
    message: event.message,
    source: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  popupError("window:unhandledrejection", event.reason, {
    reason: event.reason?.message || event.reason,
  });
});

class PopupController {
  constructor() {
    popupLog("constructor:start");

    this.extension = assertExtensionApi("Popup");
    this.authHandler = new AuthHandler();

    this.supabaseUrl = DEFAULT_SUPABASE_URL;
    this.supabaseKey = DEFAULT_SUPABASE_ANON_KEY;

    this.orgId = null;
    this.userId = null;
    this.organizationName = null;
    this.userProfile = null;

    this.lastSyncedAt = null;
    this.systemStatus = "Hazırlanıyor";
    this.serviceHealth = "Kontrol ediliyor";
    this.companies = [];

    this.stats = this.buildDashboardStats([]);

    popupLog("constructor:done", {
      hasExtensionApi: Boolean(this.extension),
      hasStorageLocal: Boolean(this.extension?.storage?.local),
      hasTabsApi: Boolean(this.extension?.tabs),
      hasScriptingApi: Boolean(this.extension?.scripting),
      supabaseUrl: this.supabaseUrl,
      hasSupabaseKey: Boolean(this.supabaseKey),
      supabaseKeyMasked: maskValue(this.supabaseKey),
    });
  }

  async init() {
    popupLog("init:start");

    try {
      this.showLoading();

      await this.autoConfigureDefaults();
      await this.authHandler.init();
      await this.checkLocalStorageAuth();

      const configLoaded = await this.loadConfig();
      const isAuthenticated = await this.authHandler.isAuthenticated();

      popupLog("init:auth-check", {
        configLoaded,
        isAuthenticated,
      });

      if (!isAuthenticated) {
        this.showAuthScreen();
        return;
      }

      if (!configLoaded) {
        this.showAuthScreen("Eklenti yapılandırması hazırlanıyor. Lütfen tekrar deneyin.");
        return;
      }

      await this.syncOrgIdWithUser();
      await this.showMainApp();

      popupLog("init:done");
    } catch (error) {
      popupError("init:error", error);
      this.showFatalAuthFallback(error);
      throw error;
    }
  }

  async autoConfigureDefaults() {
    try {
      const config = await this.extension.storage.local.get(["supabaseUrl", "supabaseKey"]);
      const payload = {};

      if (!config.supabaseUrl) payload.supabaseUrl = DEFAULT_SUPABASE_URL;
      if (!config.supabaseKey) payload.supabaseKey = DEFAULT_SUPABASE_ANON_KEY;

      if (Object.keys(payload).length > 0) {
        await this.extension.storage.local.set(payload);
      }

      popupLog("autoConfigureDefaults:done", {
        payloadKeys: Object.keys(payload),
      });
    } catch (error) {
      popupError("autoConfigureDefaults:error", error);
    }
  }

  async loadConfig() {
    try {
      const config = await this.extension.storage.local.get([
        "supabaseUrl",
        "supabaseKey",
        "orgId",
        "userId",
        "organizationName",
      ]);

      this.supabaseUrl = config.supabaseUrl || DEFAULT_SUPABASE_URL;
      this.supabaseKey = config.supabaseKey || DEFAULT_SUPABASE_ANON_KEY;
      this.orgId = config.orgId || null;
      this.userId = config.userId || null;
      this.organizationName = config.organizationName || null;

      const result = Boolean(this.supabaseUrl && this.supabaseKey);

      popupLog("loadConfig:done", {
        result,
        supabaseUrl: this.supabaseUrl,
        hasSupabaseKey: Boolean(this.supabaseKey),
        supabaseKeyMasked: maskValue(this.supabaseKey),
        orgId: this.orgId,
        userId: this.userId,
        organizationName: this.organizationName,
      });

      return result;
    } catch (error) {
      popupError("loadConfig:error", error);

      this.supabaseUrl = DEFAULT_SUPABASE_URL;
      this.supabaseKey = DEFAULT_SUPABASE_ANON_KEY;

      return true;
    }
  }

  async checkLocalStorageAuth() {
    try {
      const tabs = await this.extension.tabs.query({
        url: ["https://www.isgvizyon.com/*", "https://isgvizyon.com/*"],
      });

      popupLog("checkLocalStorageAuth:tabs", {
        tabCount: tabs.length,
      });

      for (const tab of tabs) {
        if (!tab.id) continue;

        try {
          const result = await this.extension.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const key = "denetron_extension_auth";
              const auth = localStorage.getItem(key);

              if (!auth) {
                return {
                  found: false,
                  key,
                  localStorageLength: localStorage.length,
                  availableKeys: Array.from({ length: localStorage.length })
                    .map((_, index) => localStorage.key(index))
                    .filter(Boolean)
                    .slice(0, 30),
                };
              }

              try {
                const parsed = JSON.parse(auth);
                localStorage.removeItem(key);

                return {
                  found: true,
                  key,
                  parsed,
                  rawLength: auth.length,
                };
              } catch (error) {
                return {
                  found: true,
                  key,
                  parseError: error?.message || String(error),
                  rawPreview: auth.slice(0, 500),
                  rawLength: auth.length,
                };
              }
            },
          });

          const scriptResult = result?.[0]?.result || null;

          popupLog("checkLocalStorageAuth:script-result", {
            tabId: tab.id,
            found: Boolean(scriptResult?.found),
            parseError: scriptResult?.parseError || null,
            authDataSummary: summarizeAuthData(scriptResult?.parsed),
          });

          if (scriptResult?.parseError) continue;

          const authData = scriptResult?.parsed || null;

          if (authData) {
            await this.authHandler.saveAuth(authData);
            popupLog("checkLocalStorageAuth:saveAuth:done", { tabId: tab.id });
            return;
          }
        } catch (error) {
          popupWarn("checkLocalStorageAuth:tab:error", {
            tabId: tab.id,
            message: error?.message || String(error),
          });
        }
      }
    } catch (error) {
      popupWarn("checkLocalStorageAuth:error", {
        message: error?.message || String(error),
      });
    }
  }

  showLoading() {
    document.body.innerHTML = `
      <main class="premium-popup premium-popup--center">
        <section class="loading-card">
          <div class="loader-ring"></div>
          <div>
            <div class="loading-title">ISGVizyon hazırlanıyor</div>
            <div class="loading-text">Oturum ve firma verileri kontrol ediliyor.</div>
          </div>
        </section>
      </main>
    `;
  }

  showAuthScreen(message = "") {
    const loginUrl = this.authHandler.getLoginUrl();

    popupLog("showAuthScreen", {
      loginUrl,
      message,
    });

    document.body.innerHTML = `
      <main class="premium-popup premium-popup--center">
        <section class="auth-premium-card">
          <div class="auth-logo">İ</div>
          <div class="auth-kicker">ISGVizyon Uzantısı</div>
          <h1>İSG Bot hesabınıza bağlanın</h1>
          <p>
            ${escapeHtml(message || "Firmalarınızı, uyum durumunuzu ve İSG-KATİP senkron durumunu görüntülemek için giriş yapın.")}
          </p>

          <button id="btnLoginFallback" class="primary-action">Giriş Yap</button>
          <button id="btnOpenAppFallback" class="secondary-action full">ISGVizyon'u Aç</button>

          <div class="auth-note">Giriş tamamlandıktan sonra uzantıyı tekrar açın.</div>
          <div class="auth-note">${escapeHtml(EXTENSION_LEGAL_NOTICE)}</div>
          <div class="auth-note">Gizlilik: Şifre, çerez ve e-Devlet oturum bilgisi aktarılmaz. <a href="${DEFAULT_PRIVACY_POLICY_URL}" target="_blank" rel="noreferrer noopener">Gizlilik politikası</a></div>
        </section>
      </main>
    `;

    document.getElementById("btnLoginFallback")?.addEventListener("click", () => {
      this.extension.tabs.create({ url: loginUrl });
      window.close();
    });

    document.getElementById("btnOpenAppFallback")?.addEventListener("click", () => {
      this.extension.tabs.create({ url: WEB_APP_URL });
      window.close();
    });
  }

  showFatalAuthFallback(error) {
    popupError("showFatalAuthFallback", error);

    document.body.innerHTML = `
      <main class="premium-popup premium-popup--center">
        <section class="auth-premium-card">
          <div class="auth-logo danger">!</div>
          <div class="auth-kicker">Başlatma hatası</div>
          <h1>Uzantı başlatılamadı</h1>
          <p>${escapeHtml(error?.message || "Bilinmeyen hata oluştu.")}</p>
          <button id="btnRetryPopup" class="primary-action">Tekrar Dene</button>
        </section>
      </main>
    `;

    document.getElementById("btnRetryPopup")?.addEventListener("click", () => {
      window.location.reload();
    });
  }

  async showMainApp() {
    popupLog("showMainApp:start");

    await this.loadDashboardData();
    this.renderProfessionalDashboard();

    popupLog("showMainApp:done", {
      stats: this.stats,
      companyCount: this.companies.length,
      lastSyncedAt: this.lastSyncedAt,
      systemStatus: this.systemStatus,
      serviceHealth: this.serviceHealth,
      organizationName: this.organizationName,
    });
  }

  async getAuthContext() {
    const storage = await this.extension.storage.local.get([
      "denetron_auth",
      "userId",
      "orgId",
      "organizationName",
    ]);

    const auth = storage.denetron_auth || null;
    const user = auth?.user || auth?.session?.user || null;

    const accessToken =
      auth?.accessToken ||
      auth?.session?.access_token ||
      auth?.access_token ||
      null;

    const userId =
      storage.userId ||
      this.userId ||
      user?.id ||
      null;

    const orgId =
      storage.orgId ||
      this.orgId ||
      user?.organization_id ||
      user?.user_metadata?.organization_id ||
      user?.app_metadata?.organization_id ||
      null;

    this.userId = userId;
    this.orgId = orgId;
    this.organizationName = storage.organizationName || this.organizationName || null;

    return {
      storage,
      auth,
      user,
      accessToken,
      userId,
      orgId,
    };
  }

  getSupabaseHeaders(accessToken) {
    return {
      apikey: this.supabaseKey,
      Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${this.supabaseKey}`,
      "Content-Type": "application/json",
    };
  }

  async fetchOrganizationId(userId, accessToken) {
    if (!userId || !accessToken) return null;

    try {
      const url = `${this.supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=organization_id&limit=1`;

      const response = await fetch(url, {
        headers: this.getSupabaseHeaders(accessToken),
      });

      if (!response.ok) return null;

      const rows = await response.json();
      return rows?.[0]?.organization_id || null;
    } catch (error) {
      popupWarn("fetchOrganizationId:error", {
        message: error?.message || String(error),
      });

      return null;
    }
  }

  async fetchOrganizationName(orgId, accessToken) {
    if (!orgId) return null;

    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/organizations?id=eq.${orgId}&select=name,slug,industry,city&limit=1`,
        {
          headers: this.getSupabaseHeaders(accessToken),
        }
      );

      if (!response.ok) return null;

      const rows = await response.json();
      return rows?.[0]?.name || null;
    } catch (error) {
      popupWarn("fetchOrganizationName:error", {
        message: error?.message || String(error),
      });

      return null;
    }
  }

  async syncOrgIdWithUser() {
    popupLog("syncOrgIdWithUser:start");

    try {
      const { accessToken, user, orgId } = await this.getAuthContext();

      if (!user?.id) {
        popupWarn("syncOrgIdWithUser:return:no-user-id");
        return;
      }

      this.userId = user.id;

      const metadataOrgId =
        user.organization_id ||
        user.user_metadata?.organization_id ||
        user.app_metadata?.organization_id ||
        null;

      this.orgId =
        metadataOrgId ||
        orgId ||
        (await this.fetchOrganizationId(user.id, accessToken)) ||
        null;

      if (this.orgId && !this.organizationName) {
        this.organizationName = await this.fetchOrganizationName(this.orgId, accessToken);
      }

      await this.extension.storage.local.set({
        orgId: this.orgId,
        userId: this.userId,
        organizationName: this.organizationName,
      });

      popupLog("syncOrgIdWithUser:done", {
        userId: this.userId,
        orgId: this.orgId,
        organizationName: this.organizationName,
      });
    } catch (error) {
      popupWarn("syncOrgIdWithUser:error", {
        message: error?.message || String(error),
      });
    }
  }

  async fetchCompanies(orgId, accessToken) {
    if (!orgId) return [];

    const select = [
      "id",
      "org_id",
      "sgk_no",
      "company_name",
      "employee_count",
      "hazard_class",
      "assigned_minutes",
      "required_minutes",
      "compliance_status",
      "risk_score",
      "last_synced_at",
      "contract_start",
      "contract_end",
      "contract_status",
      "assigned_person_name",
      "service_provider_name",
      "is_deleted",
    ].join(",");

    const url =
      `${this.supabaseUrl}/rest/v1/isgkatip_companies` +
      `?org_id=eq.${orgId}` +
      `&or=(is_deleted.is.null,is_deleted.eq.false)` +
      `&select=${select}` +
      `&order=last_synced_at.desc`;

    popupLog("fetchCompanies:request", {
      url,
      orgId,
    });

    const response = await fetch(url, {
      headers: this.getSupabaseHeaders(accessToken),
    });

    const responseText = await response.text();

    popupLog("fetchCompanies:response", {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      responseTextPreview: responseText ? responseText.slice(0, 500) : null,
    });

    if (!response.ok) {
      throw new Error(`Firma listesi alınamadı. HTTP ${response.status}: ${responseText}`);
    }

    const rows = responseText ? JSON.parse(responseText) : [];
    return Array.isArray(rows) ? rows : [];
  }

  async checkServiceHealth(accessToken) {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/isgkatip_companies?select=id&limit=1`,
        {
          method: "GET",
          headers: this.getSupabaseHeaders(accessToken),
        }
      );

      popupLog("checkServiceHealth:response", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
      });

      if (response.ok) return "Hazır";
      return `Kontrol gerekli (${response.status})`;
    } catch (_error) {
      return "Yanıt vermiyor";
    }
  }

  buildDashboardStats(companies) {
    const rows = Array.isArray(companies) ? companies : [];
    const totalCompanies = rows.length;

    const compliantCount = rows.filter((row) => row.compliance_status === "COMPLIANT").length;
    const warningCount = rows.filter((row) => row.compliance_status === "WARNING").length;
    const criticalCount = rows.filter((row) => row.compliance_status === "CRITICAL").length;
    const excessCount = rows.filter((row) => row.compliance_status === "EXCESS").length;
    const unknownCount = rows.filter((row) => !row.compliance_status || row.compliance_status === "UNKNOWN").length;

    const totalEmployees = rows.reduce((sum, row) => sum + Number(row.employee_count || 0), 0);
    const totalAssignedMinutes = rows.reduce((sum, row) => sum + Number(row.assigned_minutes || 0), 0);
    const totalRequiredMinutes = rows.reduce((sum, row) => sum + Number(row.required_minutes || 0), 0);

    const riskScores = rows
      .map((row) => Number(row.risk_score || 0))
      .filter((value) => Number.isFinite(value) && value > 0);

    const averageRiskScore =
      riskScores.length > 0
        ? Math.round(riskScores.reduce((sum, value) => sum + value, 0) / riskScores.length)
        : 0;

    const now = Date.now();
    const nextThirtyDays = now + 30 * 24 * 60 * 60 * 1000;

    const expiringContractsCount = rows.filter((row) => {
      if (!row.contract_end) return false;
      const time = new Date(row.contract_end).getTime();
      return Number.isFinite(time) && time >= now && time <= nextThirtyDays;
    }).length;

    const highRiskCount = rows.filter((row) => Number(row.risk_score || 0) >= 70).length;

    const minuteCoverage =
      totalRequiredMinutes > 0
        ? Math.round((totalAssignedMinutes / totalRequiredMinutes) * 100)
        : 0;

    return {
      totalCompanies,
      compliantCount,
      warningCount,
      criticalCount,
      excessCount,
      unknownCount,
      totalEmployees,
      totalAssignedMinutes,
      totalRequiredMinutes,
      averageRiskScore,
      expiringContractsCount,
      highRiskCount,
      minuteCoverage,
    };
  }

  async loadDashboardData() {
    popupLog("loadDashboardData:start");

    const { accessToken, orgId, user } = await this.getAuthContext();

    this.userProfile = {
      id: user?.id || null,
      email: user?.email || user?.user_metadata?.email || null,
      fullName:
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.email ||
        "ISGVizyon Kullanıcısı",
    };

    if (!orgId) {
      this.systemStatus = "Organizasyon bekleniyor";
      this.serviceHealth = "Beklemede";
      this.companies = [];
      this.stats = this.buildDashboardStats([]);
      return;
    }

    try {
      if (!this.organizationName) {
        this.organizationName = await this.fetchOrganizationName(orgId, accessToken);
      }

      const [companies, serviceHealth] = await Promise.all([
        this.fetchCompanies(orgId, accessToken),
        this.checkServiceHealth(accessToken),
      ]);

      this.companies = companies;
      this.stats = this.buildDashboardStats(companies);
      this.lastSyncedAt = companies.find((row) => row.last_synced_at)?.last_synced_at || null;
      this.serviceHealth = serviceHealth;
      this.systemStatus = companies.length > 0 ? "Veri servisi hazır" : "Firma verisi bekleniyor";

      await this.extension.storage.local.set({
        orgId: this.orgId,
        userId: this.userId,
        organizationName: this.organizationName,
        stats: this.stats,
        companiesPreview: companies.slice(0, 50),
        extensionLastSyncedAt: this.lastSyncedAt,
      });

      popupLog("loadDashboardData:done", {
        organizationName: this.organizationName,
        stats: this.stats,
        companyCount: companies.length,
        serviceHealth,
      });
    } catch (error) {
      popupWarn("loadDashboardData:error", {
        message: error?.message || String(error),
      });

      this.systemStatus = "Veri servisi kontrol edilmeli";
      this.serviceHealth = "Kontrol gerekli";

      const cached = await this.extension.storage.local.get([
        "companiesPreview",
        "extensionLastSyncedAt",
        "organizationName",
      ]);

      this.companies = Array.isArray(cached.companiesPreview) ? cached.companiesPreview : [];
      this.stats = this.buildDashboardStats(this.companies);
      this.lastSyncedAt = cached.extensionLastSyncedAt || null;
      this.organizationName = cached.organizationName || this.organizationName || null;
    }
  }

  getComplianceLabel(status) {
    switch (status) {
      case "COMPLIANT":
        return "Uyumlu";
      case "WARNING":
        return "Uyarı";
      case "CRITICAL":
        return "Kritik";
      case "EXCESS":
        return "Fazla Süre";
      default:
        return "Bilinmiyor";
    }
  }

  getComplianceClass(status) {
    switch (status) {
      case "COMPLIANT":
        return "is-success";
      case "WARNING":
        return "is-warning";
      case "CRITICAL":
        return "is-danger";
      case "EXCESS":
        return "is-info";
      default:
        return "is-muted";
    }
  }

  getRiskLabel(score) {
    const value = Number(score || 0);

    if (value >= 80) return "Çok Yüksek";
    if (value >= 60) return "Yüksek";
    if (value >= 35) return "Orta";
    if (value > 0) return "Düşük";
    return "Belirsiz";
  }

  formatDateLabel(value) {
    if (!value) return "Henüz senkron yok";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Tarih alınamadı";
    }

    return date.toLocaleString("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  formatShortDate(value) {
    if (!value) return "Yok";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Yok";

    return date.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "short",
    });
  }

  renderProfessionalDashboard() {
    const stats = this.stats || this.buildDashboardStats([]);
    const companies = Array.isArray(this.companies) ? this.companies : [];

    const organizationLabel = this.organizationName || "ISGVizyon Organizasyonu";
    const userName = this.userProfile?.fullName || "ISGVizyon Kullanıcısı";
    const userEmail = this.userProfile?.email || "Oturum aktif";
    const avatarLetter = String(userName || "I").trim().charAt(0).toUpperCase() || "I";
    const lastSyncLabel = this.formatDateLabel(this.lastSyncedAt);

    const topCompanies = companies.slice(0, 12);

    const companyRows =
      topCompanies.length > 0
        ? topCompanies
            .map((company) => {
              const statusClass = this.getComplianceClass(company.compliance_status);
              const statusLabel = this.getComplianceLabel(company.compliance_status);
              const riskScore = Number(company.risk_score || 0);
              const employeeCount = Number(company.employee_count || 0);
              const required = Number(company.required_minutes || 0);
              const assigned = Number(company.assigned_minutes || 0);
              const companyName = company.company_name || "İsimsiz firma";

              return `
                <div class="company-row" title="${escapeHtml(companyName)}">
                  <div class="company-main">
                    <div class="company-title">${escapeHtml(companyName)}</div>
                    <div class="company-meta">
                      <span>${escapeHtml(company.hazard_class || "Tehlike sınıfı yok")}</span>
                      <span>•</span>
                      <span>${employeeCount} çalışan</span>
                      <span>•</span>
                      <span>${assigned}/${required} dk</span>
                    </div>
                    <div class="company-submeta">
                      <span>SGK: ${escapeHtml(company.sgk_no || "-")}</span>
                      <span>Bitiş: ${escapeHtml(this.formatShortDate(company.contract_end))}</span>
                    </div>
                  </div>

                  <div class="company-side">
                    <span class="status-pill ${statusClass}">${statusLabel}</span>
                    <span class="risk-mini">Risk ${riskScore} · ${escapeHtml(this.getRiskLabel(riskScore))}</span>
                  </div>
                </div>
              `;
            })
            .join("")
        : `
          <div class="empty-premium">
            <strong>Henüz firma listesi görüntülenemedi.</strong>
            <span>İSG-KATİP üzerinden senkron başlatın veya verileri yenileyin.</span>
          </div>
        `;

    const activities = this.buildActivityItems(stats, companies, userName, lastSyncLabel)
      .map(
        (item) => `
          <div class="activity-premium ${escapeHtml(item.type)}">
            <span class="activity-dot"></span>
            <div>
              <div class="activity-title">${escapeHtml(item.title)}</div>
              <div class="activity-text">${escapeHtml(item.text)}</div>
            </div>
          </div>
        `
      )
      .join("");

    document.body.innerHTML = `
      <main class="premium-popup">
        <section class="premium-hero">
          <div class="hero-brand">
            <div class="brand-orb">İ</div>
            <div>
              <div class="brand-title">ISGVizyon</div>
              <div class="brand-subtitle">İSG Bot Uzantısı</div>
            </div>
          </div>

          <button id="btnLogout" class="ghost-icon-button" title="Çıkış yap">Çıkış</button>
        </section>

        <section class="session-card">
          <div class="session-avatar">${escapeHtml(avatarLetter)}</div>
          <div class="session-content">
            <div class="session-kicker">Oturum Kartı</div>
            <div class="session-name">${escapeHtml(userName)}</div>
            <div class="session-email">${escapeHtml(userEmail)}</div>
          </div>
          <div class="session-status">
            <span></span>
            Aktif
          </div>
        </section>

        <section class="system-grid">
          <div class="system-card wide">
            <div class="system-label">Bağlı organizasyon</div>
            <div class="system-value">${escapeHtml(organizationLabel)}</div>
          </div>

          <div class="system-card">
            <div class="system-label">Son senkron zamanı</div>
            <div class="system-value">${escapeHtml(lastSyncLabel)}</div>
          </div>

          <div class="system-card">
            <div class="system-label">Sistem durumu</div>
            <div class="system-value status-ready">${escapeHtml(this.serviceHealth || this.systemStatus || "Hazır")}</div>
          </div>
        </section>

        <section class="premium-stats">
          <div class="premium-stat primary">
            <div class="stat-topline">Toplam Firma</div>
            <div class="stat-number">${stats.totalCompanies ?? 0}</div>
            <div class="stat-caption">${stats.totalEmployees ?? 0} çalışan</div>
          </div>

          <div class="premium-stat success">
            <div class="stat-topline">Uyumlu</div>
            <div class="stat-number">${stats.compliantCount ?? 0}</div>
            <div class="stat-caption">Kontrol altında</div>
          </div>

          <div class="premium-stat warning">
            <div class="stat-topline">Uyarı</div>
            <div class="stat-number">${stats.warningCount ?? 0}</div>
            <div class="stat-caption">Takip önerilir</div>
          </div>

          <div class="premium-stat danger">
            <div class="stat-topline">Kritik</div>
            <div class="stat-number">${stats.criticalCount ?? 0}</div>
            <div class="stat-caption">Aksiyon gerekli</div>
          </div>
        </section>

        <section class="insight-row">
          <div class="insight-card">
            <div class="insight-label">Ortalama risk</div>
            <div class="insight-value">${stats.averageRiskScore ?? 0}</div>
          </div>

          <div class="insight-card">
            <div class="insight-label">Dakika karşılama</div>
            <div class="insight-value">${stats.minuteCoverage ?? 0}%</div>
          </div>

          <div class="insight-card">
            <div class="insight-label">Yaklaşan bitiş</div>
            <div class="insight-value">${stats.expiringContractsCount ?? 0}</div>
          </div>
        </section>

        <section class="coverage-card">
          <div class="coverage-head">
            <span>Dakika karşılama oranı</span>
            <strong>${stats.totalAssignedMinutes ?? 0}/${stats.totalRequiredMinutes ?? 0} dk</strong>
          </div>
          <div class="coverage-track">
            <div class="coverage-fill" style="width:${Math.max(0, Math.min(100, stats.minuteCoverage || 0))}%"></div>
          </div>
        </section>

        <section class="actions-premium">
          <button id="btnSync" class="primary-action">Verileri Yenile</button>

          <div class="secondary-actions">
            <button id="btnOpenDashboard" class="secondary-action">Paneli Aç</button>
            <button id="btnSyncISGKatip" class="secondary-action">İSG-KATİP Sayfasını Aç</button>
          </div>
        </section>

        <section class="activity-card">
          <div class="section-head compact">
            <div>
              <div class="section-title">Gizlilik ve Yetki</div>
              <div class="section-subtitle">Aktarım her zaman kullanıcı onayıyla başlatılır.</div>
            </div>
          </div>

          <div class="activity-list-premium">
            <div class="activity-premium info">
              <span class="activity-dot"></span>
              <div>
                <div class="activity-title">Resmi kurum değildir</div>
                <div class="activity-text">${escapeHtml(EXTENSION_LEGAL_NOTICE)}</div>
              </div>
            </div>
            <div class="activity-premium info">
              <span class="activity-dot"></span>
              <div>
                <div class="activity-title">Aktarım onaylıdır</div>
                <div class="activity-text">İSG-KATİP ekranındaki veriler önce önizlenir. Siz onay vermeden hiçbir kayıt ISGVizyon hesabınıza aktarılmaz.</div>
              </div>
            </div>
            <div class="activity-premium info">
              <span class="activity-dot"></span>
              <div>
                <div class="activity-title">Gizlilik</div>
                <div class="activity-text">Şifre, çerez, token veya e-Devlet oturum bilgileri aktarılmaz. Ayrıntılar için: ${escapeHtml(DEFAULT_PRIVACY_POLICY_URL)}</div>
              </div>
            </div>
          </div>
        </section>

        <section class="companies-card">
          <div class="section-head">
            <div>
              <div class="section-title">Çekilen Firmalar</div>
              <div class="section-subtitle">İSG-KATİP entegrasyonundan gelen son kayıtlar</div>
            </div>
            <span class="section-count">${companies.length}</span>
          </div>

          <div class="company-list">
            ${companyRows}
          </div>
        </section>

        <section class="activity-card">
          <div class="section-head compact">
            <div>
              <div class="section-title">Aktivite ve Aksiyonlar</div>
              <div class="section-subtitle">Kısa durum özeti ve öncelikler</div>
            </div>
          </div>

          <div class="activity-list-premium">
            ${activities}
          </div>
        </section>
      </main>
    `;

    this.bindDashboardEvents();

    popupLog("renderProfessionalDashboard:done", {
      companyCount: companies.length,
      stats,
    });
  }

  buildActivityItems(stats, companies, userName, lastSyncLabel) {
    const items = [
      {
        type: "success",
        title: "Oturum aktif",
        text: `${userName} hesabı uzantıya bağlı.`,
      },
    ];

    if (this.lastSyncedAt) {
      items.push({
        type: "info",
        title: "Son senkron",
        text: `${lastSyncLabel} tarihinde ${stats.totalCompanies || 0} firma görüntülendi.`,
      });
    } else {
      items.push({
        type: "warning",
        title: "Senkron bekleniyor",
        text: "Henüz başarılı firma senkronu görünmüyor.",
      });
    }

    if ((stats.criticalCount || 0) > 0) {
      items.push({
        type: "danger",
        title: "Kritik takip",
        text: `${stats.criticalCount} firma kritik uyum durumunda.`,
      });
    }

    if ((stats.warningCount || 0) > 0) {
      items.push({
        type: "warning",
        title: "Uyarıdaki firmalar",
        text: `${stats.warningCount} firma uyarı seviyesinde izleniyor.`,
      });
    }

    if ((stats.expiringContractsCount || 0) > 0) {
      items.push({
        type: "warning",
        title: "Yaklaşan sözleşme bitişi",
        text: `${stats.expiringContractsCount} sözleşme 30 gün içinde bitiyor.`,
      });
    }

    if ((stats.totalCompanies || 0) > 0 && companies.length > 0) {
      items.push({
        type: "info",
        title: "Firma listesi hazır",
        text: `${companies.length} firma kayıt olarak listeleniyor.`,
      });
    }

    return items.slice(0, 7);
  }

  bindDashboardEvents() {
    document.getElementById("btnLogout")?.addEventListener("click", () => this.handleLogout());

    document.getElementById("btnSync")?.addEventListener("click", async () => {
      const button = document.getElementById("btnSync");
      const originalText = button?.textContent || "Verileri Yenile";

      try {
        if (button) {
          button.disabled = true;
          button.textContent = "Yenileniyor...";
        }

        await this.loadDashboardData();
        this.renderProfessionalDashboard();
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = originalText;
        }
      }
    });

    document.getElementById("btnOpenDashboard")?.addEventListener("click", () => {
      this.extension.tabs.create({ url: `${WEB_APP_URL}/isg-bot` });
    });

    document.getElementById("btnSyncISGKatip")?.addEventListener("click", async () => {
      await this.handleISGKatipSync();
    });
  }

  async handleLogout() {
    popupLog("handleLogout:start");
    await this.authHandler.clearAuth();
    window.location.reload();
  }

  async handleISGKatipSync() {
    popupLog("handleISGKatipSync:start", {
      targetUrl: ISGKATIP_URL,
    });

    try {
      const tabs = await this.extension.tabs.query({
        url: "https://isgkatip.csgb.gov.tr/*",
      });

      if (tabs.length > 0) {
        const tab = tabs[0];
        const currentUrl = tab.url || "";

        await this.extension.tabs.update(tab.id, { active: true });
        await this.extension.windows.update(tab.windowId, { focused: true });

        if (!currentUrl.includes("/kisi-kurum/kisi-karti/kisi-kartim")) {
          await this.extension.tabs.update(tab.id, { url: ISGKATIP_URL });
        } else {
          this.extension.notifications.create({
            type: "basic",
            iconUrl: "/assets/icon-128.png",
            title: "ISGVizyon İSG Bot",
            message:
              'Sağ alttaki "Firmalarımı Oku" butonuna tıklayın, önizlemeyi kontrol edin ve ardından "Onayla ve ISGVizyon’a Aktar" ile devam edin.',
            priority: 1,
          });
        }
      } else {
        await this.extension.tabs.create({ url: ISGKATIP_URL });
      }

      window.close();
    } catch (error) {
      popupError("handleISGKatipSync:error", error);
      this.extension.tabs.create({ url: ISGKATIP_URL });
      window.close();
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  popupLog("DOMContentLoaded");

  const controller = new PopupController();

  controller.init().catch((error) => {
    popupError("controller:init:catch", error);

    const loadingScreen = document.getElementById("loadingScreen");
    const authScreen = document.getElementById("authScreen");
    const subtitle = document.querySelector(".subtitle");

    if (loadingScreen) loadingScreen.style.display = "none";
    if (authScreen) authScreen.style.display = "flex";

    if (subtitle) {
      subtitle.textContent =
        error?.message ||
        "Eklenti başlatılamadı. Eklentiyi yeniden yükleyip tekrar deneyin.";
    }

    if (!authScreen) {
      controller.showFatalAuthFallback(error);
    }
  });
});
