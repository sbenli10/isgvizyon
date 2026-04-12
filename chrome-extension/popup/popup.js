// chrome-extension/popup/popup.js

// ====================================================
// POPUP CONTROLLER - TAM DÜZELTİLMİŞ
// ====================================================

import { AuthHandler } from "../auth/auth-handler.js";

class PopupController {
  constructor() {
    this.authHandler = new AuthHandler();
    this.supabaseUrl = null;
    this.supabaseKey = null;
    this.orgId = null;
    this.stats = {
      totalCompanies: 0,
      warningCount: 0,
      criticalCount: 0,
    };
  }

  // ====================================================
  // INIT
  // ====================================================

  async init() {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🚀 POPUP BAŞLATILDI");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    this.showLoading();

    await this.autoConfigureIfNeeded();

    const configLoaded = await this.loadConfig();

    if (!configLoaded) {
      console.warn("⚠️ Extension yapılandırılmamış");
      this.showAuthScreen();
      return;
    }

    console.log("✅ Configuration yüklendi");

    await this.checkLocalStorageAuth();

    const isAuth = await this.authHandler.isAuthenticated();

    if (!isAuth) {
      console.log("🔐 Kullanıcı giriş yapmamış");
      this.showAuthScreen();
      return;
    }

    console.log("✅ Kullanıcı giriş yapmış");

    await this.syncOrgIdWithUser();

    await this.showMainApp();

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ POPUP HAZIR");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }

  // ====================================================
  // AUTO CONFIGURE
  // ====================================================

  async autoConfigureIfNeeded() {
    try {
      const config = await chrome.storage.local.get([
        "supabaseUrl",
        "supabaseKey",
        "autoConfigured",
      ]);

      if (!config.supabaseUrl || !config.supabaseKey) {
        console.log("⚠️ Supabase ayarlari eksik. Lutfen Options sayfasindan yapilandirin.");
      }
    } catch (error) {
      console.error("❌ Auto-configure hatası:", error);
    }
  }

  // ====================================================
  // LOAD CONFIG
  // ====================================================

  async loadConfig() {
    try {
      const config = await chrome.storage.local.get([
        "supabaseUrl",
        "supabaseKey",
        "orgId",
        "autoConfigured",
      ]);

      console.log("⚙️ Config durumu:", {
        hasUrl: !!config.supabaseUrl,
        hasKey: !!config.supabaseKey,
        hasOrgId: !!config.orgId,
        autoConfigured: config.autoConfigured,
      });

      if (!config.supabaseUrl) {
        console.error("❌ Supabase URL eksik");
        return false;
      }

      if (!config.supabaseKey) {
        console.error("❌ Supabase Key eksik");
        return false;
      }

      this.supabaseUrl = config.supabaseUrl;
      this.supabaseKey = config.supabaseKey;
      this.orgId = config.orgId;

      return true;
    } catch (error) {
      console.error("❌ Config load hatası:", error);
      return false;
    }
  }

  // ====================================================
  // SYNC ORG ID WITH USER
  // ====================================================

  async syncOrgIdWithUser() {
    try {
      const auth = await chrome.storage.local.get("denetron_auth");

      if (auth.denetron_auth?.user?.id) {
        const userId = auth.denetron_auth.user.id;
        console.log("📍 Authenticated user ID:", userId);

        if (this.orgId !== userId) {
          console.log("🔄 OrgId güncelleniyor:", userId);
          this.orgId = userId;
          await chrome.storage.local.set({ orgId: userId });
        }
      } else {
        console.warn("⚠️ Auth user bulunamadı");
      }
    } catch (error) {
      console.error("❌ Sync org ID hatası:", error);
    }
  }

  // ====================================================
  // LOCAL STORAGE AUTH CHECK
  // ====================================================

  async checkLocalStorageAuth() {
    try {
      const tabs = await chrome.tabs.query({
        url: ["https://www.denetron.me/*", "https://denetron.me/*"],
      });

      for (const tab of tabs) {
        if (!tab.id) continue;

        try {
          const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const auth = localStorage.getItem("denetron_extension_auth");
              if (!auth) return null;
              localStorage.removeItem("denetron_extension_auth");
              return JSON.parse(auth);
            },
          });

          const authData = result?.[0]?.result;

          if (authData) {
            console.log("✅ Web'den auth alındı");
            await this.authHandler.saveAuth(authData);
            return;
          }
        } catch (err) {
          console.warn("⚠️ Tab erişim hatası:", tab.id, err.message);
        }
      }
    } catch (err) {
      console.error("❌ LocalStorage auth check hatası", err);
    }
  }

  // ====================================================
  // SCREEN MANAGEMENT
  // ====================================================

  showLoading() {
    const loadingScreen = document.getElementById("loadingScreen");
    const authScreen = document.getElementById("authScreen");
    const mainApp = document.getElementById("mainApp");

    if (loadingScreen) loadingScreen.style.display = "flex";
    if (authScreen) authScreen.style.display = "none";
    if (mainApp) mainApp.style.display = "none";
  }

  showAuthScreen() {
    const loadingScreen = document.getElementById("loadingScreen");
    const authScreen = document.getElementById("authScreen");
    const mainApp = document.getElementById("mainApp");

    if (loadingScreen) loadingScreen.style.display = "none";
    if (authScreen) authScreen.style.display = "flex";
    if (mainApp) mainApp.style.display = "none";

    document
      .getElementById("btnLogin")
      ?.addEventListener("click", () => this.handleLogin());
  }

  async showMainApp() {
    const loadingScreen = document.getElementById("loadingScreen");
    const authScreen = document.getElementById("authScreen");
    const mainApp = document.getElementById("mainApp");

    if (loadingScreen) loadingScreen.style.display = "none";
    if (authScreen) authScreen.style.display = "none";
    if (mainApp) mainApp.style.display = "block";

    this.setupEventListeners();

    await this.loadStats();
    await this.loadActivities();

    this.updateStatsUI();
  }

  // ====================================================
  // LOGIN / LOGOUT
  // ====================================================

  handleLogin() {
    const loginUrl = this.authHandler.getLoginUrl();
    console.log("🔐 Login sayfası açılıyor:", loginUrl);
    chrome.tabs.create({ url: loginUrl });
    window.close();
  }

  async handleLogout() {
    if (!confirm("Çıkış yapmak istediğinizden emin misiniz?")) return;
    console.log("👋 Çıkış yapılıyor...");
    await this.authHandler.clearAuth();
    window.location.reload();
  }

  // ====================================================
  // EVENT LISTENERS
  // ====================================================

  setupEventListeners() {
    document
      .getElementById("btnLogout")
      ?.addEventListener("click", () => this.handleLogout());

    document
      .getElementById("btnSync")
      ?.addEventListener("click", () => this.handleSync());

    document
      .getElementById("btnOpenDashboard")
      ?.addEventListener("click", () => {
        chrome.tabs.create({
          url: "https://www.denetron.me/isg-bot",
        });
      });

    document
      .getElementById("btnSyncISGKatip")
      ?.addEventListener("click", async () => {
        await this.handleISGKatipSync();
      });
  }

  // ====================================================
  // İSG-KATİP SYNC HANDLER
  // ====================================================

  async handleISGKatipSync() {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔗 İSG-KATİP SYNC TETİKLENDİ (POPUP)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const targetUrl =
      "https://isgkatip.csgb.gov.tr/kisi-kurum/kisi-karti/kisi-kartim";

    try {
      const tabs = await chrome.tabs.query({
        url: "https://isgkatip.csgb.gov.tr/*",
      });

      if (tabs.length > 0) {
        const tab = tabs[0];
        const currentUrl = tab.url || "";

        console.log("✅ İSG-KATİP tab bulundu:", tab.id);
        console.log("📍 Mevcut URL:", currentUrl);

        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });

        if (!currentUrl.includes("/kisi-kurum/kisi-karti/kisi-kartim")) {
          console.log("🔄 Kişi Kartı sayfasına yönlendiriliyor...");

          await chrome.tabs.update(tab.id, { url: targetUrl });

          chrome.notifications.create({
            type: "basic",
            iconUrl: "/icons/icon128.png",
            title: "İSG-KATİP",
            message: "Kişi Kartı sayfası yükleniyor...",
            priority: 1,
          });
        } else {
          console.log("✅ Zaten doğru sayfada");

          chrome.notifications.create({
            type: "basic",
            iconUrl: "/icons/icon128.png",
            title: "İSGVizyon İSG Bot",
            message:
              'Sağ alt köşedeki "Verileri İSGVizyon\'a Aktar" butonuna tıklayın.',
            priority: 1,
          });
        }
      } else {
        console.log("ℹ️ İSG-KATİP tab yok, yeni açılıyor...");

        await chrome.tabs.create({ url: targetUrl });

        chrome.notifications.create({
          type: "basic",
          iconUrl: "/icons/icon128.png",
          title: "İSG-KATİP",
          message:
            'Giriş yapın. Sağ altta "Verileri İSGVizyon\'a Aktar" butonu görünecek.',
          priority: 2,
        });

        chrome.action.setBadgeText({ text: "📋" });
        chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
      }

      console.log("✅ İSG-KATİP açıldı");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      window.close();
    } catch (error) {
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error("❌ İSG-KATİP SYNC HATASI");
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error("Hata:", error.message);

      chrome.tabs.create({ url: targetUrl });

      chrome.notifications.create({
        type: "basic",
        iconUrl: "/icons/icon128.png",
        title: "İSG-KATİP",
        message: "Giriş yapın ve Kişi Kartı sayfasına gidin.",
        priority: 1,
      });

      window.close();
    }
  }

  // ====================================================
  // LOAD STATS
  // ====================================================

  async loadStats() {
    if (!this.supabaseUrl || !this.supabaseKey || !this.orgId) {
      console.warn("⚠️ Stats için config eksik:", {
        hasUrl: !!this.supabaseUrl,
        hasKey: !!this.supabaseKey,
        hasOrgId: !!this.orgId,
      });
      return;
    }

    console.log("📊 Stats yükleniyor...");
    console.log("📍 Org ID:", this.orgId);

    try {
      const authData = await chrome.storage.local.get("denetron_auth");
      const accessToken = authData.denetron_auth?.session?.access_token;

      const headers = {
        apikey: this.supabaseKey,
        Authorization: accessToken
          ? `Bearer ${accessToken}`
          : `Bearer ${this.supabaseKey}`,
        "Content-Type": "application/json",
      };

      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/isgkatip_companies?org_id=eq.${this.orgId}&select=compliance_status`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const companies = await response.json();

      console.log("✅ Companies alındı:", companies.length);

      this.stats = {
        totalCompanies: companies.length,
        warningCount: companies.filter((c) => c.compliance_status === "WARNING")
          .length,
        criticalCount: companies.filter(
          (c) => c.compliance_status === "CRITICAL"
        ).length,
      };

      console.log("📊 Stats hesaplandı:", this.stats);

      await chrome.storage.local.set({ stats: this.stats });
    } catch (error) {
      console.error("❌ Stats load hatası:", error.message);

      const cached = await chrome.storage.local.get("stats");
      if (cached.stats) {
        this.stats = cached.stats;
        console.log("📦 Cached stats kullanılıyor:", this.stats);
      }
    }
  }

  // ====================================================
  // UPDATE UI
  // ====================================================

  updateStatsUI() {
    const totalEl = document.getElementById("totalCompanies");
    const warningEl = document.getElementById("warningCount");
    const criticalEl = document.getElementById("criticalCount");

    if (totalEl) totalEl.textContent = this.stats.totalCompanies ?? 0;
    if (warningEl) warningEl.textContent = this.stats.warningCount ?? 0;
    if (criticalEl) criticalEl.textContent = this.stats.criticalCount ?? 0;

    console.log("✅ Stats UI güncellendi");
  }

  async loadActivities() {
    const list = document.getElementById("activityList");
    if (!list) return;

    list.innerHTML = '<p class="empty-state">Henüz işlem yok</p>';
  }

  // ====================================================
  // MANUAL SYNC
  // ====================================================

  async handleSync() {
    const btn = document.getElementById("btnSync");
    if (!btn) return;

    const original = btn.innerHTML;

    try {
      btn.disabled = true;
      btn.innerHTML = "⏳ Senkronize ediliyor...";

      console.log("🔄 Manuel sync başlatıldı");

      await chrome.runtime.sendMessage({ type: "SYNC_NOW" });

      await this.loadStats();
      this.updateStatsUI();

      btn.innerHTML = "✅ Tamamlandı";

      console.log("✅ Manuel sync tamamlandı");

      setTimeout(() => {
        btn.innerHTML = original;
        btn.disabled = false;
      }, 2000);
    } catch (err) {
      console.error("❌ Sync hatası:", err);

      btn.innerHTML = "❌ Hata";

      setTimeout(() => {
        btn.innerHTML = original;
        btn.disabled = false;
      }, 2000);
    }
  }
}

// ====================================================
// START
// ====================================================

document.addEventListener("DOMContentLoaded", () => {
  const controller = new PopupController();
  controller.init();
});
