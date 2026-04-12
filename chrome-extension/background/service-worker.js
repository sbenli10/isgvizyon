// chrome-extension/background/service-worker.js

// ====================================================
// BACKGROUND SERVICE WORKER - TAM DÜZELTİLMİŞ
// ====================================================

import { AuthHandler } from "../auth/auth-handler.js";

class BackgroundService {
  constructor() {
    this.authHandler = new AuthHandler();
    this.supabaseUrl = null;
    this.supabaseKey = null;
    this.orgId = null;
  }

  // ====================================================
  // INIT
  // ====================================================

  async init() {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔧 BACKGROUND SERVICE BAŞLATILDI");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    await this.autoConfigureIfNeeded();
    await this.loadConfig();
    await this.setupListeners();

    console.log("✅ Background service hazır");
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
  // CONFIG LOAD
  // ====================================================

  async loadConfig() {
    try {
      const config = await chrome.storage.local.get([
        "supabaseUrl",
        "supabaseKey",
        "orgId",
        "denetron_auth",
      ]);

      this.supabaseUrl = config.supabaseUrl;
      this.supabaseKey = config.supabaseKey;

      if (config.denetron_auth?.user?.id) {
        this.orgId = config.denetron_auth.user.id;
        console.log("✅ Org ID (user ID):", this.orgId);
      } else if (config.orgId) {
        this.orgId = config.orgId;
        console.log("✅ Org ID (storage):", this.orgId);
      }

      console.log("✅ Config yüklendi:", {
        url: this.supabaseUrl ? "✓" : "✗",
        key: this.supabaseKey ? "✓" : "✗",
        orgId: this.orgId || "✗",
      });

      if (!this.supabaseUrl || !this.supabaseKey) {
        console.warn("⚠️ Config eksik");
        return false;
      }

      return true;
    } catch (error) {
      console.error("❌ Config load hatası:", error);
      return false;
    }
  }

  // ====================================================
  // LISTENERS
  // ====================================================

  async setupListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete") {
        this.handleTabUpdate(tabId, tab);
      }
    });
  }

  // ====================================================
  // MESSAGE HANDLER
  // ====================================================

  async handleMessage(message, sender, sendResponse) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📨 MESAJ ALINDI:", message.type);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
      switch (message.type) {
        case "SYNC_NOW":
          await this.handleManualSync();
          sendResponse({ success: true });
          break;

        case "ISGKATIP_COMPANIES_SCRAPED":
          await this.handleISGKatipSync(message.data, message.metadata);
          sendResponse({ success: true });
          break;

        case "GET_CONFIG":
          sendResponse({
            supabaseUrl: this.supabaseUrl,
            supabaseKey: this.supabaseKey,
            orgId: this.orgId,
          });
          break;

        default:
          console.warn("⚠️ Bilinmeyen mesaj tipi:", message.type);
          sendResponse({ success: false, error: "Unknown message type" });
      }
    } catch (error) {
      console.error("❌ Message handler hatası:", error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // ====================================================
  // İSG-KATİP SYNC HANDLER
  // ====================================================

  async handleISGKatipSync(companies, metadata) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📦 İSG-KATİP SYNC BAŞLATILDI");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 Toplam işyeri:", companies.length);
    console.log("📅 Tarih:", metadata.scrapedAt);
    console.log("🔗 Kaynak:", metadata.sourceUrl);

    try {
      // Config kontrol
      if (!this.supabaseUrl || !this.supabaseKey || !this.orgId) {
        console.error("❌ CONFIG EKSİK:");
        console.error("  Supabase URL:", this.supabaseUrl ? "✓" : "✗");
        console.error("  Supabase Key:", this.supabaseKey ? "✓" : "✗");
        console.error("  Org ID:", this.orgId || "✗");
        throw new Error("Supabase configuration eksik");
      }

      console.log("✅ Config doğrulandı");

      // Headers
      const headers = {
        apikey: this.supabaseKey,
        Authorization: `Bearer ${this.supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      };

      console.log("📡 Headers hazırlandı");

      // Veri kaydetme
      let successCount = 0;
      let errorCount = 0;
      const errors = [];
      const successfulCompanies = [];

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔄 VERİ KAYDETME BAŞLADI");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      for (let i = 0; i < companies.length; i++) {
        const company = companies[i];

        try {
          const cleanData = {
            org_id: this.orgId,
            sgk_no: this.cleanString(company.sgk_no),
            company_name: this.cleanString(company.company_name),
            employee_count: this.cleanNumber(company.employee_count),
            hazard_class:
              this.cleanString(company.hazard_class) || "Az Tehlikeli",
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

          if (!cleanData.sgk_no || !cleanData.company_name) {
            console.warn(
              `⚠️ [${i + 1}/${companies.length}] Geçersiz veri (SGK/Firma adı eksik)`
            );
            errorCount++;
            errors.push({
              index: i + 1,
              company: company.company_name || "İsimsiz",
              error: "SGK No veya Firma Adı eksik",
            });
            continue;
          }

          const response = await fetch(
            `${this.supabaseUrl}/rest/v1/isgkatip_companies`,
            {
              method: "POST",
              headers,
              body: JSON.stringify(cleanData),
            }
          );

          if (response.ok) {
            successCount++;
            successfulCompanies.push(cleanData.company_name);
            console.log(
              `✅ [${successCount}/${companies.length}] ${cleanData.company_name}`
            );
          } else {
            const errorText = await response.text();
            let errorJson;

            try {
              errorJson = JSON.parse(errorText);
            } catch {
              errorJson = { message: errorText };
            }

            errorCount++;
            errors.push({
              index: i + 1,
              company: cleanData.company_name,
              status: response.status,
              error: errorJson.message || errorJson.code || "Unknown error",
              details: errorJson,
            });

            console.error(
              `❌ [${i + 1}/${companies.length}] ${cleanData.company_name}`
            );
            console.error(
              `   → HTTP ${response.status}: ${errorJson.message || errorText}`
            );
          }
        } catch (error) {
          errorCount++;
          errors.push({
            index: i + 1,
            company: company.company_name || "İsimsiz",
            error: error.message,
          });
          console.error(
            `❌ [${i + 1}/${companies.length}] Fetch hatası:`,
            error.message
          );
        }
      }

      // Sonuçlar
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📊 SYNC SONUÇLARI");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`✅ Başarılı: ${successCount}/${companies.length}`);
      console.log(`❌ Hatalı: ${errorCount}/${companies.length}`);
      console.log(
        `📈 Başarı Oranı: ${((successCount / companies.length) * 100).toFixed(1)}%`
      );

      if (successCount > 0) {
        console.log("✅ BAŞARILI FİRMALAR (İlk 10):");
        successfulCompanies.slice(0, 10).forEach((name, idx) => {
          console.log(`   ${idx + 1}. ${name}`);
        });
        if (successfulCompanies.length > 10) {
          console.log(
            `   ... ve ${successfulCompanies.length - 10} firma daha`
          );
        }
      }

      if (errors.length > 0) {
        console.log("❌ HATALAR (İlk 5):");
        errors.slice(0, 5).forEach((err) => {
          console.error(`   [${err.index}] ${err.company}`);
          console.error(`       → ${err.error}`);
        });
        if (errors.length > 5) {
          console.log(`   ... ve ${errors.length - 5} hata daha`);
        }
      }

      // Sync log kaydet
      try {
        await this.saveSyncLog({
          source: "ISGKATIP_SCRAPER",
          total_companies: companies.length,
          success_count: successCount,
          error_count: errorCount,
          metadata: {
            ...metadata,
            errors: errors.slice(0, 10),
            successful_companies: successfulCompanies.slice(0, 10),
          },
        });
        console.log("✅ Sync log kaydedildi");
      } catch (logError) {
        console.warn("⚠️ Sync log kaydedilemedi:", logError.message);
      }

      // UI güncellemeleri
      chrome.action.setBadgeText({ text: successCount.toString() });
      chrome.action.setBadgeBackgroundColor({
        color: successCount > 0 ? "#4CAF50" : "#F44336",
      });

      const notificationTitle =
        successCount > 0
          ? "✅ İSG-KATİP Senkronizasyonu Tamamlandı"
          : "❌ İSG-KATİP Senkronizasyon Hatası";

      const notificationMessage =
        successCount > 0
          ? `${successCount} işyeri başarıyla senkronize edildi!${errorCount > 0 ? ` (${errorCount} hata)` : ""}`
          : `${errorCount} işyeri kaydedilemedi`;

      chrome.notifications.create({
        type: "basic",
        iconUrl: "/icons/icon128.png",
        title: notificationTitle,
        message: notificationMessage,
        priority: 2,
      });

      await this.loadStats();

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✅ İSG-KATİP SYNC TAMAMLANDI");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    } catch (error) {
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error("❌ KRİTİK HATA - SYNC DURDU");
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error("Hata:", error.message);
      console.error("Stack:", error.stack);

      chrome.notifications.create({
        type: "basic",
        iconUrl: "/icons/icon128.png",
        title: "❌ Senkronizasyon Hatası",
        message: error.message || "Bilinmeyen hata",
        priority: 2,
      });
    }
  }

  // ====================================================
  // HELPER FUNCTIONS
  // ====================================================

  cleanString(value) {
    if (!value) return "";
    return String(value).trim();
  }

  cleanNumber(value) {
    const num = parseInt(value);
    return isNaN(num) ? 0 : num;
  }

  validateDate(dateStr) {
    if (!dateStr) return null;

    try {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateStr)) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }

      const match = dateStr.match(
        /(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/
      );

      if (match) {
        const [, day, month, year, hour, minute, second] = match;
        const isoDate = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
        const date = new Date(isoDate);

        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }

      console.warn("⚠️ Tarih parse edilemedi:", dateStr);
      return null;
    } catch (error) {
      console.error("❌ Tarih validate hatası:", dateStr, error);
      return null;
    }
  }

  calculateComplianceStatus(assigned, required) {
    if (!required || required === 0) return "UNKNOWN";
    if (assigned >= required) return "COMPLIANT";
    if (assigned >= required * 0.8) return "WARNING";
    return "CRITICAL";
  }

  calculateRiskScore(company) {
    let score = 50;

    const hazardClass = String(company.hazard_class || "");
    if (hazardClass.includes("Çok Tehlikeli")) {
      score += 30;
    } else if (hazardClass.includes("Tehlikeli")) {
      score += 15;
    }

    const employeeCount = this.cleanNumber(company.employee_count);
    if (employeeCount > 100) {
      score += 10;
    } else if (employeeCount > 50) {
      score += 5;
    }

    const complianceStatus = this.calculateComplianceStatus(
      this.cleanNumber(company.assigned_minutes),
      this.cleanNumber(company.required_minutes)
    );

    if (complianceStatus === "CRITICAL") {
      score += 20;
    } else if (complianceStatus === "WARNING") {
      score += 10;
    }

    return Math.min(score, 100);
  }

  async saveSyncLog(logData) {
    try {
      console.log("📝 Sync log kaydediliyor...");

      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/isgkatip_sync_logs`,
        {
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
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("⚠️ Sync log kaydedilemedi:", response.status, errorText);
      } else {
        console.log("✅ Sync log başarıyla kaydedildi");
      }
    } catch (error) {
      console.warn("⚠️ Sync log kayıt hatası:", error.message);
    }
  }

  async loadStats() {
    if (!this.supabaseUrl || !this.supabaseKey || !this.orgId) {
      console.warn("⚠️ Stats için config eksik");
      return;
    }

    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/isgkatip_companies?org_id=eq.${this.orgId}&select=compliance_status`,
        {
          headers: {
            apikey: this.supabaseKey,
            Authorization: `Bearer ${this.supabaseKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const companies = await response.json();

      const stats = {
        totalCompanies: companies.length,
        warningCount: companies.filter((c) => c.compliance_status === "WARNING")
          .length,
        criticalCount: companies.filter(
          (c) => c.compliance_status === "CRITICAL"
        ).length,
      };

      await chrome.storage.local.set({ stats });

      console.log("📊 Stats güncellendi:", stats);
    } catch (error) {
      console.error("❌ Stats load hatası:", error);
    }
  }

  async handleManualSync() {
    console.log("🔄 Manuel sync tetiklendi");
    await this.loadStats();
  }

  async handleTabUpdate(tabId, tab) {
    if (tab.url?.includes("isgkatip.csgb.gov.tr")) {
      console.log("📍 İSG-KATİP sitesi tespit edildi");
      chrome.action.setBadgeText({ tabId, text: "🔍" });
      chrome.action.setBadgeBackgroundColor({ color: "#2196F3" });
    }
  }
}

const service = new BackgroundService();
service.init();

console.log("🟢 Service worker yüklendi");