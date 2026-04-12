// chrome-extension/config.js
// Credentials are NO LONGER hardcoded.
// Users must configure via the Options page after installation.

const AUTO_CONFIG = {
  enabled: false, // Disabled — users configure manually via Options page
  defaultOrgId: null,
};

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("📦 Extension event:", details.reason);

  if (details.reason === "install") {
    console.log("🎉 Extension ilk kez yüklendi");
    console.log("⚠️ Lutfen ayarlar sayfasindan Supabase bilgilerinizi girin.");
    // Open options page so user can configure credentials
    chrome.runtime.openOptionsPage();
  } else if (details.reason === "update") {
    console.log("🔄 Extension güncellendi");
  }
});

console.log("🟢 Config script loaded");