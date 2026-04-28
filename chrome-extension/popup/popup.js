// chrome-extension/popup/popup.js
import { AuthHandler } from "../auth/auth-handler.js";
import {
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_URL,
} from "../config/defaults.js";
import { assertExtensionApi } from "../shared/extension-api.js";

const POPUP_DEBUG = true;
const POPUP_LOG_PREFIX = "[Denetron Popup]";

function popupLog(step, data = {}) {
  if (!POPUP_DEBUG) return;

  try {
    console.log(POPUP_LOG_PREFIX, {
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

  const payload = {
    step,
    time: new Date().toISOString(),
    ...data,
  };

  // Normal akış uyarılarını Chrome extension "Hatalar" ekranına düşürmemek için warn değil log kullanıyoruz.
  console.log(`${POPUP_LOG_PREFIX} WARN ${step}`, payload);
}

function popupError(step, error, data = {}) {
  const payload = {
    step,
    time: new Date().toISOString(),
    error: {
      name: error?.name || null,
      message: error?.message || String(error),
      stack: error?.stack || null,
    },
    ...data,
  };

  console.error(`${POPUP_LOG_PREFIX} ERROR ${step}`, payload);
}

function maskValue(value, visibleStart = 6, visibleEnd = 4) {
  if (!value || typeof value !== "string") return null;
  if (value.length <= visibleStart + visibleEnd) return "***";
  return `${value.slice(0, visibleStart)}...${value.slice(-visibleEnd)}`;
}

function summarizeAuthData(authData) {
  if (!authData) {
    return {
      exists: false,
    };
  }

  const session = authData.session || authData;

  return {
    exists: true,
    hasAccessToken: Boolean(authData.accessToken || session.access_token),
    accessTokenMasked: maskValue(authData.accessToken || session.access_token),
    hasRefreshToken: Boolean(authData.refreshToken || session.refresh_token),
    refreshTokenMasked: maskValue(authData.refreshToken || session.refresh_token),
    hasUser: Boolean(authData.user || session.user),
    userId: authData.user?.id || session.user?.id || null,
    userEmail: authData.user?.email || session.user?.email || null,
    hasSession: Boolean(authData.session),
    expiresAt:
      authData.expiresAt ||
      (session.expires_at ? session.expires_at * 1000 : null) ||
      null,
    expiresAtIso:
      authData.expiresAt || session.expires_at
        ? new Date(authData.expiresAt || session.expires_at * 1000).toISOString()
        : null,
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
    this.lastSyncedAt = null;
    this.systemStatus = "Hazirlaniyor";
    this.stats = {
      totalCompanies: 0,
      warningCount: 0,
      criticalCount: 0,
    };

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

      popupLog("init:autoConfigureDefaults:start");
      await this.autoConfigureDefaults();
      popupLog("init:autoConfigureDefaults:done");

      popupLog("init:authHandler:init:start");
      await this.authHandler.init();
      popupLog("init:authHandler:init:done");

      popupLog("init:checkLocalStorageAuth:start");
      await this.checkLocalStorageAuth();
      popupLog("init:checkLocalStorageAuth:done");

      popupLog("init:loadConfig:start");
      const configLoaded = await this.loadConfig();
      popupLog("init:loadConfig:done", {
        configLoaded,
        supabaseUrl: this.supabaseUrl,
        hasSupabaseKey: Boolean(this.supabaseKey),
        supabaseKeyMasked: maskValue(this.supabaseKey),
        orgId: this.orgId,
        userId: this.userId,
      });

      popupLog("init:isAuthenticated:start");
      const isAuthenticated = await this.authHandler.isAuthenticated();
      popupLog("init:isAuthenticated:done", {
        isAuthenticated,
      });

      if (!isAuthenticated) {
        popupLog("init:not-authenticated:show-auth-screen");
        this.showAuthScreen();
        return;
      }

      if (!configLoaded) {
        popupWarn("init:config-not-loaded:show-auth-screen");
        this.showAuthScreen("Eklenti yapilandirmasi hazirlaniyor. Lutfen tekrar deneyin.");
        return;
      }

      popupLog("init:syncOrgIdWithUser:start");
      await this.syncOrgIdWithUser();
      popupLog("init:syncOrgIdWithUser:done", {
        orgId: this.orgId,
        userId: this.userId,
      });

      popupLog("init:showMainApp:start");
      await this.showMainApp();
      popupLog("init:showMainApp:done");
    } catch (error) {
      popupError("init:error", error);
      this.showFatalAuthFallback(error);
      throw error;
    }
  }

  async autoConfigureDefaults() {
    popupLog("autoConfigureDefaults:start");

    try {
      const config = await this.extension.storage.local.get(["supabaseUrl", "supabaseKey"]);
      const payload = {};

      popupLog("autoConfigureDefaults:current-config", {
        hasSupabaseUrl: Boolean(config.supabaseUrl),
        supabaseUrl: config.supabaseUrl || null,
        hasSupabaseKey: Boolean(config.supabaseKey),
        supabaseKeyMasked: maskValue(config.supabaseKey),
      });

      if (!config.supabaseUrl) payload.supabaseUrl = DEFAULT_SUPABASE_URL;
      if (!config.supabaseKey) payload.supabaseKey = DEFAULT_SUPABASE_ANON_KEY;

      popupLog("autoConfigureDefaults:payload", {
        keys: Object.keys(payload),
        supabaseUrl: payload.supabaseUrl || null,
        hasSupabaseKey: Boolean(payload.supabaseKey),
        supabaseKeyMasked: maskValue(payload.supabaseKey),
      });

      if (Object.keys(payload).length > 0) {
        await this.extension.storage.local.set(payload);
        popupLog("autoConfigureDefaults:storage-set:done");
      } else {
        popupLog("autoConfigureDefaults:no-changes-needed");
      }
    } catch (error) {
      popupError("autoConfigureDefaults:error", error);
      console.error("Auto-configure hatasi:", error);
    }
  }

  async loadConfig() {
    popupLog("loadConfig:start");

    try {
      const config = await this.extension.storage.local.get([
        "supabaseUrl",
        "supabaseKey",
        "orgId",
        "userId",
      ]);

      popupLog("loadConfig:storage-result", {
        keys: Object.keys(config || {}),
        hasSupabaseUrl: Boolean(config.supabaseUrl),
        supabaseUrl: config.supabaseUrl || null,
        hasSupabaseKey: Boolean(config.supabaseKey),
        supabaseKeyMasked: maskValue(config.supabaseKey),
        orgId: config.orgId || null,
        userId: config.userId || null,
      });

      this.supabaseUrl = config.supabaseUrl || DEFAULT_SUPABASE_URL;
      this.supabaseKey = config.supabaseKey || DEFAULT_SUPABASE_ANON_KEY;
      this.orgId = config.orgId || null;
      this.userId = config.userId || null;

      const result = Boolean(this.supabaseUrl && this.supabaseKey);

      popupLog("loadConfig:return", {
        result,
        resolvedSupabaseUrl: this.supabaseUrl,
        hasResolvedSupabaseKey: Boolean(this.supabaseKey),
        resolvedSupabaseKeyMasked: maskValue(this.supabaseKey),
      });

      return result;
    } catch (error) {
      popupError("loadConfig:error", error);

      console.error("Config load hatasi:", error);
      this.supabaseUrl = DEFAULT_SUPABASE_URL;
      this.supabaseKey = DEFAULT_SUPABASE_ANON_KEY;

      popupWarn("loadConfig:return:true:fallback-defaults", {
        supabaseUrl: this.supabaseUrl,
        hasSupabaseKey: Boolean(this.supabaseKey),
        supabaseKeyMasked: maskValue(this.supabaseKey),
      });

      return true;
    }
  }

  async checkLocalStorageAuth() {
    popupLog("checkLocalStorageAuth:start", {
      urls: ["https://www.isgvizyon.com/*", "https://isgvizyon.com/*"],
    });

    try {
      const tabs = await this.extension.tabs.query({
        url: ["https://www.isgvizyon.com/*", "https://isgvizyon.com/*"],
      });

      popupLog("checkLocalStorageAuth:tabs-result", {
        tabCount: tabs.length,
        tabs: tabs.map((tab) => ({
          id: tab.id,
          url: tab.url,
          title: tab.title,
          active: tab.active,
          status: tab.status,
        })),
      });

      for (const tab of tabs) {
        popupLog("checkLocalStorageAuth:tab:start", {
          tabId: tab.id,
          url: tab.url,
          title: tab.title,
        });

        if (!tab.id) {
          popupWarn("checkLocalStorageAuth:tab:skip:no-tab-id", {
            tab,
          });
          continue;
        }

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

              localStorage.removeItem(key);

              try {
                return {
                  found: true,
                  key,
                  parsed: JSON.parse(auth),
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

          popupLog("checkLocalStorageAuth:executeScript:result", {
            tabId: tab.id,
            rawResult: result,
          });

          const scriptResult = result?.[0]?.result || null;

          popupLog("checkLocalStorageAuth:script-result", {
            tabId: tab.id,
            found: Boolean(scriptResult?.found),
            key: scriptResult?.key || null,
            parseError: scriptResult?.parseError || null,
            localStorageLength: scriptResult?.localStorageLength || null,
            availableKeys: scriptResult?.availableKeys || null,
            authDataSummary: summarizeAuthData(scriptResult?.parsed),
          });

          if (scriptResult?.parseError) {
            popupWarn("checkLocalStorageAuth:parse-error", {
              tabId: tab.id,
              parseError: scriptResult.parseError,
              rawPreview: scriptResult.rawPreview,
              rawLength: scriptResult.rawLength,
            });
            continue;
          }

          const authData = scriptResult?.parsed || null;

          if (authData) {
            popupLog("checkLocalStorageAuth:saveAuth:start", {
              tabId: tab.id,
              authDataSummary: summarizeAuthData(authData),
            });

            await this.authHandler.saveAuth(authData);

            popupLog("checkLocalStorageAuth:saveAuth:done", {
              tabId: tab.id,
            });

            return;
          }

          popupLog("checkLocalStorageAuth:tab:no-auth-data", {
            tabId: tab.id,
          });
        } catch (error) {
          popupError("checkLocalStorageAuth:tab:error", error, {
            tabId: tab.id,
            url: tab.url,
          });

          console.warn("Tab auth erisimi basarisiz:", error?.message || error);
        }
      }

      popupWarn("checkLocalStorageAuth:done:no-auth-found-in-tabs");
    } catch (error) {
      popupError("checkLocalStorageAuth:error", error);
      console.error("Web auth aktarimi basarisiz:", error);
    }
  }

  showLoading() {
    popupLog("showLoading");
    this.toggleScreens("loading");
  }

 showAuthScreen(message = "") {
  popupLog("showAuthScreen:forced-render:start", {
    message,
    loginUrl: this.authHandler.getLoginUrl(),
  });

  document.body.innerHTML = `
    <div style="
      width: 360px;
      min-height: 520px;
      box-sizing: border-box;
      background: #07111f;
      color: #ffffff;
      font-family: Arial, sans-serif;
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
    ">
      <div style="width: 100%;">
        <div style="
          width: 56px;
          height: 56px;
          margin: 0 auto 18px;
          border-radius: 18px;
          background: rgba(255,255,255,0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 700;
        ">
          İ
        </div>

        <h1 style="
          font-size: 22px;
          line-height: 1.25;
          margin: 0 0 10px;
          color: #ffffff;
        ">
          ISGVizyon
        </h1>

        <p style="
          font-size: 14px;
          line-height: 1.45;
          margin: 0 0 22px;
          color: rgba(255,255,255,0.78);
        ">
          ${
            message ||
            "Uzantıyı kullanmak için ISGVizyon hesabınızla giriş yapmanız gerekiyor."
          }
        </p>

        <button id="btnLoginFallback" style="
          width: 100%;
          border: 0;
          border-radius: 12px;
          padding: 12px 16px;
          background: #ffffff;
          color: #07111f;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        ">
          Giriş Yap
        </button>

        <button id="btnOpenAppFallback" style="
          width: 100%;
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 12px;
          padding: 11px 16px;
          background: transparent;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 10px;
        ">
          ISGVizyon'u Aç
        </button>

        <div style="
          margin-top: 16px;
          font-size: 12px;
          line-height: 1.4;
          color: rgba(255,255,255,0.55);
        ">
          Login sonrası popup'ı tekrar açın.
        </div>
      </div>
    </div>
  `;

  const loginUrl = this.authHandler.getLoginUrl();

  document.getElementById("btnLoginFallback")?.addEventListener("click", () => {
    popupLog("showAuthScreen:btnLoginFallback:click", { loginUrl });

    this.extension.tabs.create({
      url: loginUrl,
    });

    window.close();
  });

  document.getElementById("btnOpenAppFallback")?.addEventListener("click", () => {
    popupLog("showAuthScreen:btnOpenAppFallback:click");

    this.extension.tabs.create({
      url: "https://www.isgvizyon.com",
    });

    window.close();
  });

  popupLog("showAuthScreen:forced-render:done");
}

  showFatalAuthFallback(error) {
    popupError("showFatalAuthFallback", error);

    document.body.innerHTML = `
      <div style="
        min-height: 100vh;
        width: 100vw;
        box-sizing: border-box;
        background: #07111f;
        color: white;
        font-family: Arial, sans-serif;
        padding: 20px;
      ">
        <h2 style="margin-top: 0;">Uzantı başlatılamadı</h2>
        <p style="opacity: 0.85;">${error?.message || "Bilinmeyen hata oluştu."}</p>
        <button id="btnRetryPopup" style="
          padding: 10px 14px;
          border: 0;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
        ">
          Tekrar Dene
        </button>
      </div>
    `;

    document.getElementById("btnRetryPopup")?.addEventListener("click", () => {
      window.location.reload();
    });
  }

  async showMainApp() {
    popupLog("showMainApp:start");

    this.toggleScreens("main");

    popupLog("showMainApp:setupEventListeners:start");
    this.setupEventListeners();
    popupLog("showMainApp:setupEventListeners:done");

    popupLog("showMainApp:renderUserProfile:start");
    await this.renderUserProfile();
    popupLog("showMainApp:renderUserProfile:done");

    popupLog("showMainApp:loadStats:start");
    await this.loadStats();
    popupLog("showMainApp:loadStats:done", {
      stats: this.stats,
      lastSyncedAt: this.lastSyncedAt,
      systemStatus: this.systemStatus,
    });

    popupLog("showMainApp:renderStatusPanel:start");
    await this.renderStatusPanel();
    popupLog("showMainApp:renderStatusPanel:done");

    popupLog("showMainApp:loadActivities:start");
    await this.loadActivities();
    popupLog("showMainApp:loadActivities:done");

    this.updateStatsUI();

    popupLog("showMainApp:done");
  }

  toggleScreens(target) {
    popupLog("toggleScreens:start", {
      target,
    });

    const loadingScreen = document.getElementById("loadingScreen");
    const authScreen = document.getElementById("authScreen");
    const mainApp = document.getElementById("mainApp");

    popupLog("toggleScreens:dom-check", {
      hasLoadingScreen: Boolean(loadingScreen),
      hasAuthScreen: Boolean(authScreen),
      hasMainApp: Boolean(mainApp),
      loadingScreenCurrentDisplay: loadingScreen?.style?.display || null,
      authScreenCurrentDisplay: authScreen?.style?.display || null,
      mainAppCurrentDisplay: mainApp?.style?.display || null,
    });

    if (loadingScreen) loadingScreen.style.display = target === "loading" ? "flex" : "none";
    if (authScreen) authScreen.style.display = target === "auth" ? "flex" : "none";
    if (mainApp) mainApp.style.display = target === "main" ? "block" : "none";

    popupLog("toggleScreens:done", {
      target,
      loadingScreenDisplay: loadingScreen?.style?.display || null,
      authScreenDisplay: authScreen?.style?.display || null,
      mainAppDisplay: mainApp?.style?.display || null,
    });
  }

  handleLogin() {
    popupLog("handleLogin:start");

    const loginUrl = this.authHandler.getLoginUrl();

    popupLog("handleLogin:create-tab", {
      loginUrl,
    });

    this.extension.tabs.create({ url: loginUrl });
    window.close();
  }

  async handleLogout() {
    popupLog("handleLogout:start");

    await this.authHandler.clearAuth();

    popupLog("handleLogout:auth-cleared:reload");
    window.location.reload();
  }

  setupEventListeners() {
    popupLog("setupEventListeners:start");

    const btnLogout = document.getElementById("btnLogout");
    const btnSync = document.getElementById("btnSync");
    const btnOpenDashboard = document.getElementById("btnOpenDashboard");
    const btnSyncISGKatip = document.getElementById("btnSyncISGKatip");

    popupLog("setupEventListeners:dom-check", {
      hasBtnLogout: Boolean(btnLogout),
      hasBtnSync: Boolean(btnSync),
      hasBtnOpenDashboard: Boolean(btnOpenDashboard),
      hasBtnSyncISGKatip: Boolean(btnSyncISGKatip),
    });

    btnLogout?.addEventListener("click", () => this.handleLogout());
    btnSync?.addEventListener("click", () => this.handleSync());

    btnOpenDashboard?.addEventListener("click", () => {
      popupLog("btnOpenDashboard:click");
      this.extension.tabs.create({ url: "https://www.isgvizyon.com/isg-bot" });
    });

    btnSyncISGKatip?.addEventListener("click", async () => {
      popupLog("btnSyncISGKatip:click");
      await this.handleISGKatipSync();
    });

    popupLog("setupEventListeners:done");
  }

  async fetchOrganizationId(userId, accessToken) {
    popupLog("fetchOrganizationId:start", {
      userId,
      hasAccessToken: Boolean(accessToken),
      accessTokenMasked: maskValue(accessToken),
    });

    if (!userId || !accessToken) {
      popupWarn("fetchOrganizationId:return:null:missing-user-or-token", {
        userId,
        hasAccessToken: Boolean(accessToken),
      });
      return null;
    }

    try {
      const url = `${this.supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=organization_id&limit=1`;

      popupLog("fetchOrganizationId:request:start", {
        url,
        hasSupabaseKey: Boolean(this.supabaseKey),
        supabaseKeyMasked: maskValue(this.supabaseKey),
      });

      const response = await fetch(url, {
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      popupLog("fetchOrganizationId:response", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
      });

      if (!response.ok) return null;

      const rows = await response.json();

      popupLog("fetchOrganizationId:rows", {
        rowCount: Array.isArray(rows) ? rows.length : null,
        organizationId: rows?.[0]?.organization_id || null,
      });

      return rows?.[0]?.organization_id || null;
    } catch (error) {
      popupError("fetchOrganizationId:error", error);
      console.warn("Organization bilgisi alinamadi:", error?.message || error);
      return null;
    }
  }

  async syncOrgIdWithUser() {
    popupLog("syncOrgIdWithUser:start");

    try {
      const storage = await this.extension.storage.local.get("denetron_auth");
      const auth = storage.denetron_auth || null;
      const user = auth?.user || null;
      const accessToken = auth?.accessToken || auth?.session?.access_token || null;

      popupLog("syncOrgIdWithUser:storage-result", {
        hasAuth: Boolean(auth),
        hasUser: Boolean(user),
        userId: user?.id || null,
        userEmail: user?.email || null,
        hasAccessToken: Boolean(accessToken),
        accessTokenMasked: maskValue(accessToken),
        currentOrgId: this.orgId,
      });

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

      popupLog("syncOrgIdWithUser:metadata-org", {
        metadataOrgId,
        rootOrgId: user.organization_id || null,
        userMetadataOrgId: user.user_metadata?.organization_id || null,
        appMetadataOrgId: user.app_metadata?.organization_id || null,
      });

      this.orgId =
        metadataOrgId ||
        (await this.fetchOrganizationId(user.id, accessToken)) ||
        this.orgId ||
        user.id;

      popupLog("syncOrgIdWithUser:resolved", {
        userId: this.userId,
        orgId: this.orgId,
      });

      await this.extension.storage.local.set({
        orgId: this.orgId,
        userId: this.userId,
      });

      popupLog("syncOrgIdWithUser:storage-set:done");
    } catch (error) {
      popupError("syncOrgIdWithUser:error", error);
      console.error("Org scope eslenemedi:", error);
    }
  }

  async handleISGKatipSync() {
    const targetUrl = "https://isgkatip.csgb.gov.tr/kisi-kurum/kisi-karti/kisi-kartim";

    popupLog("handleISGKatipSync:start", {
      targetUrl,
    });

    try {
      const tabs = await this.extension.tabs.query({
        url: "https://isgkatip.csgb.gov.tr/*",
      });

      popupLog("handleISGKatipSync:tabs-result", {
        tabCount: tabs.length,
        tabs: tabs.map((tab) => ({
          id: tab.id,
          url: tab.url,
          windowId: tab.windowId,
          active: tab.active,
        })),
      });

      if (tabs.length > 0) {
        const tab = tabs[0];
        const currentUrl = tab.url || "";

        popupLog("handleISGKatipSync:existing-tab", {
          tabId: tab.id,
          windowId: tab.windowId,
          currentUrl,
        });

        await this.extension.tabs.update(tab.id, { active: true });
        await this.extension.windows.update(tab.windowId, { focused: true });

        if (!currentUrl.includes("/kisi-kurum/kisi-karti/kisi-kartim")) {
          popupLog("handleISGKatipSync:update-tab-url");
          await this.extension.tabs.update(tab.id, { url: targetUrl });
        } else {
          popupLog("handleISGKatipSync:create-notification");
          this.extension.notifications.create({
            type: "basic",
            iconUrl: "/assets/icon-128.png",
            title: "ISGVizyon ISG Bot",
            message: 'Sag alttaki "Verileri ISGVizyon\'a Aktar" butonuna tiklayin.',
            priority: 1,
          });
        }
      } else {
        popupLog("handleISGKatipSync:create-new-tab");
        await this.extension.tabs.create({ url: targetUrl });
      }

      popupLog("handleISGKatipSync:window-close");
      window.close();
    } catch (error) {
      popupError("handleISGKatipSync:error", error);
      console.error("ISG-KATIP acma hatasi:", error);
      this.extension.tabs.create({ url: targetUrl });
      window.close();
    }
  }

  async loadStats() {
    popupLog("loadStats:start", {
      orgId: this.orgId,
    });

    const storage = await this.extension.storage.local.get(["denetron_auth", "userId"]);
    const auth = storage.denetron_auth || null;
    const userId = storage.userId || auth?.user?.id || null;
    const accessToken = auth?.accessToken || auth?.session?.access_token || null;

    popupLog("loadStats:storage-result", {
      hasAuth: Boolean(auth),
      userId,
      hasAccessToken: Boolean(accessToken),
      accessTokenMasked: maskValue(accessToken),
      orgId: this.orgId,
    });

    if (!this.orgId) {
      this.systemStatus = "Bagli organizasyon bekleniyor";

      popupWarn("loadStats:return:no-org-id", {
        systemStatus: this.systemStatus,
      });

      return;
    }

    try {
      const headers = {
        apikey: this.supabaseKey,
        Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${this.supabaseKey}`,
        "Content-Type": "application/json",
      };

      const scopeFilter = userId
        ? `or=(org_id.eq.${this.orgId},user_id.eq.${userId})`
        : `org_id=eq.${this.orgId}`;

      const url = `${this.supabaseUrl}/rest/v1/isgkatip_companies?${scopeFilter}&select=compliance_status,last_synced_at&order=last_synced_at.desc`;

      popupLog("loadStats:request:start", {
        url,
        scopeFilter,
        hasSupabaseKey: Boolean(this.supabaseKey),
        supabaseKeyMasked: maskValue(this.supabaseKey),
        authorizationMode: accessToken ? "user-access-token" : "anon-key",
      });

      const response = await fetch(url, { headers });

      popupLog("loadStats:response", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => null);

        popupWarn("loadStats:response:not-ok", {
          status: response.status,
          statusText: response.statusText,
          responseTextPreview: responseText ? responseText.slice(0, 500) : null,
        });

        throw new Error(`HTTP ${response.status}`);
      }

      const companies = await response.json();

      popupLog("loadStats:companies", {
        count: companies.length,
        firstRow: companies[0] || null,
      });

      this.lastSyncedAt = companies.find((row) => row.last_synced_at)?.last_synced_at || null;
      this.stats = {
        totalCompanies: companies.length,
        warningCount: companies.filter((row) => row.compliance_status === "WARNING").length,
        criticalCount: companies.filter((row) => row.compliance_status === "CRITICAL").length,
      };
      this.systemStatus = "Veri servisi hazir";

      popupLog("loadStats:computed", {
        stats: this.stats,
        lastSyncedAt: this.lastSyncedAt,
        systemStatus: this.systemStatus,
      });

      await this.extension.storage.local.set({
        stats: this.stats,
        extensionLastSyncedAt: this.lastSyncedAt,
      });

      popupLog("loadStats:storage-cache-set:done");
    } catch (error) {
      this.systemStatus = "Veri servisi kontrol edilmeli";

      popupError("loadStats:error", error, {
        systemStatus: this.systemStatus,
      });

      console.error("Stats yuklenemedi:", error?.message || error);

      const cached = await this.extension.storage.local.get(["stats", "extensionLastSyncedAt"]);

      popupLog("loadStats:cached-result", {
        hasCachedStats: Boolean(cached.stats),
        cachedStats: cached.stats || null,
        cachedLastSyncedAt: cached.extensionLastSyncedAt || null,
      });

      if (cached.stats) this.stats = cached.stats;
      if (cached.extensionLastSyncedAt) this.lastSyncedAt = cached.extensionLastSyncedAt;
    }
  }

  updateStatsUI() {
    popupLog("updateStatsUI:start", {
      stats: this.stats,
    });

    const totalEl = document.getElementById("totalCompanies");
    const warningEl = document.getElementById("warningCount");
    const criticalEl = document.getElementById("criticalCount");

    popupLog("updateStatsUI:dom-check", {
      hasTotalEl: Boolean(totalEl),
      hasWarningEl: Boolean(warningEl),
      hasCriticalEl: Boolean(criticalEl),
    });

    if (totalEl) totalEl.textContent = String(this.stats.totalCompanies ?? 0);
    if (warningEl) warningEl.textContent = String(this.stats.warningCount ?? 0);
    if (criticalEl) criticalEl.textContent = String(this.stats.criticalCount ?? 0);

    popupLog("updateStatsUI:done");
  }

  async renderUserProfile() {
    popupLog("renderUserProfile:start");

    const storage = await this.extension.storage.local.get("denetron_auth");
    const user = storage.denetron_auth?.user || null;

    popupLog("renderUserProfile:storage-result", {
      hasUser: Boolean(user),
      userId: user?.id || null,
      userEmail: user?.email || null,
    });

    const fullName =
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.full_name ||
      user?.email ||
      "ISGVizyon Kullanicisi";

    const email = user?.email || user?.user_metadata?.email || "Hesap bilgisi alinamadi";
    const avatarLetter = String(fullName).trim().charAt(0).toUpperCase() || "I";

    const nameEl = document.getElementById("userName");
    const emailEl = document.getElementById("userEmail");
    const avatarEl = document.getElementById("userAvatar");

    popupLog("renderUserProfile:dom-check", {
      hasNameEl: Boolean(nameEl),
      hasEmailEl: Boolean(emailEl),
      hasAvatarEl: Boolean(avatarEl),
      fullName,
      email,
      avatarLetter,
    });

    if (nameEl) nameEl.textContent = fullName;
    if (emailEl) emailEl.textContent = email;
    if (avatarEl) avatarEl.textContent = avatarLetter;

    popupLog("renderUserProfile:done");
  }

  formatDateLabel(value) {
    popupLog("formatDateLabel:start", {
      value,
    });

    if (!value) {
      popupLog("formatDateLabel:return:no-value");
      return "Henüz senkron yok";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      popupWarn("formatDateLabel:return:invalid-date", {
        value,
      });
      return "Tarih alinamadi";
    }

    const result = date.toLocaleString("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
    });

    popupLog("formatDateLabel:return", {
      result,
    });

    return result;
  }

  async checkServiceHealth() {
    popupLog("checkServiceHealth:start", {
      supabaseUrl: this.supabaseUrl,
    });

    try {
      const response = await fetch(`${this.supabaseUrl}/rest/v1/`, {
        method: "GET",
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
        },
      });

      popupLog("checkServiceHealth:response", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
      });

      if (response.ok || response.status === 401 || response.status === 404) {
        popupLog("checkServiceHealth:return:Hazir");
        return "Hazir";
      }

      const result = `Kontrol gerekli (${response.status})`;

      popupWarn("checkServiceHealth:return:kontrol-gerekli", {
        result,
      });

      return result;
    } catch (error) {
      popupError("checkServiceHealth:error", error);
      return "Yanit vermiyor";
    }
  }

  async renderStatusPanel() {
    popupLog("renderStatusPanel:start");

    const lastSyncEl = document.getElementById("lastSyncValue");
    const orgEl = document.getElementById("organizationValue");
    const serviceEl = document.getElementById("serviceStatusValue");

    popupLog("renderStatusPanel:dom-check", {
      hasLastSyncEl: Boolean(lastSyncEl),
      hasOrgEl: Boolean(orgEl),
      hasServiceEl: Boolean(serviceEl),
      lastSyncedAt: this.lastSyncedAt,
      orgId: this.orgId,
    });

    if (lastSyncEl) lastSyncEl.textContent = this.formatDateLabel(this.lastSyncedAt);
    if (orgEl) orgEl.textContent = this.orgId || "Organizasyon bekleniyor";

    if (serviceEl) {
      popupLog("renderStatusPanel:checkServiceHealth:start");
      serviceEl.textContent = await this.checkServiceHealth();
      popupLog("renderStatusPanel:checkServiceHealth:done", {
        text: serviceEl.textContent,
      });
    }

    popupLog("renderStatusPanel:done");
  }

  async loadActivities() {
    popupLog("loadActivities:start");

    const list = document.getElementById("activityList");

    popupLog("loadActivities:dom-check", {
      hasList: Boolean(list),
    });

    if (!list) return;

    const items = [];

    if (this.lastSyncedAt) items.push(`Son senkron ${this.formatDateLabel(this.lastSyncedAt)}`);
    if (this.stats.totalCompanies > 0) items.push(`${this.stats.totalCompanies} firma goruntuleniyor`);
    if (this.stats.criticalCount > 0) items.push(`${this.stats.criticalCount} kritik kayit takip bekliyor`);

    popupLog("loadActivities:items", {
      count: items.length,
      items,
    });

    if (items.length === 0) {
      list.innerHTML = '<div class="empty-state">Henüz işlem yok</div>';
      popupLog("loadActivities:render-empty");
      return;
    }

    list.innerHTML = items
      .map(
        (item) =>
          `<div class="activity-item"><span class="activity-bullet"></span><span>${item}</span></div>`
      )
      .join("");

    popupLog("loadActivities:done");
  }

  async handleSync() {
    popupLog("handleSync:start");

    const btn = document.getElementById("btnSync");

    popupLog("handleSync:dom-check", {
      hasBtn: Boolean(btn),
    });

    if (!btn) return;

    const original = btn.innerHTML;

    try {
      btn.disabled = true;
      btn.innerHTML = "Senkronize ediliyor...";

      popupLog("handleSync:sendMessage:SYNC_NOW:start");
      await this.extension.runtime.sendMessage({ type: "SYNC_NOW" });
      popupLog("handleSync:sendMessage:SYNC_NOW:done");

      await this.loadStats();
      await this.renderStatusPanel();
      await this.loadActivities();

      this.updateStatsUI();

      btn.innerHTML = "Tamamlandi";

      popupLog("handleSync:done");
    } catch (error) {
      popupError("handleSync:error", error);
      console.error("Senkron hatasi:", error);
      btn.innerHTML = "Hata";
    } finally {
      setTimeout(() => {
        btn.innerHTML = original;
        btn.disabled = false;

        popupLog("handleSync:button-restored");
      }, 1800);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  popupLog("DOMContentLoaded");

  const controller = new PopupController();

  popupLog("controller:init:start");

  controller.init().catch((error) => {
    popupError("controller:init:catch", error);

    console.error("Popup init hatasi:", error);

    const loadingScreen = document.getElementById("loadingScreen");
    const authScreen = document.getElementById("authScreen");
    const subtitle = document.querySelector(".subtitle");

    popupLog("controller:init:catch:dom-check", {
      hasLoadingScreen: Boolean(loadingScreen),
      hasAuthScreen: Boolean(authScreen),
      hasSubtitle: Boolean(subtitle),
    });

    if (loadingScreen) loadingScreen.style.display = "none";
    if (authScreen) authScreen.style.display = "flex";

    if (subtitle) {
      subtitle.textContent =
        error?.message ||
        "Eklenti baslatilamadi. Eklentiyi yeniden yukleyip tekrar deneyin.";
    }

    if (!authScreen) {
      controller.showFatalAuthFallback(error);
    }
  });
});