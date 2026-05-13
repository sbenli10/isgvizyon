const CONFIG = {
  debug: true,
  minDelayMs: 1500,
  tableWaitMs: 12000,
  previewLimit: 10,
};

const PANEL_ID = "isgvizyon-sync-panel";
const STYLE_ID = "isgvizyon-sync-style";
const NOTICE_TEXT =
  "ISGVizyon İSG Bot, resmi İSG-KATİP, e-Devlet veya kamu kurumu ürünü değildir. Kullanıcının kendi yetkili oturumunda görüntüleyebildiği bilgileri, kullanıcının onayıyla ISGVizyon hesabına aktarmaya yardımcı olur.";
const CONSENT_TEXT =
  "İSG-KATİP ekranında görünen firma/sözleşme bilgileri ISGVizyon hesabınıza aktarılacaktır. Şifre, çerez, token veya e-Devlet oturum bilgileri aktarılmaz.";

const FIELD_SYNONYMS = {
  companyName: [
    "hizmet alan isyeri unvani",
    "isyeri unvani",
    "unvan",
    "firma unvani",
    "firma adi",
  ],
  sgkNo: [
    "hizmet alan isyeri sgk/detsis no",
    "isyeri sgk/detsis no",
    "sgk/detsis no",
    "sgk sicil no",
    "sgk no",
    "sicil no",
  ],
  employeeCount: ["calisan sayisi", "toplam calisan", "personel sayisi"],
  hazardClass: ["tehlike sinifi", "tehlike sinifi", "tehlike sınıfı"],
  naceCode: ["nace kodu", "nace", "nace kod"],
  contractStart: [
    "sozlesme baslangic tarihi",
    "başlangıç tarihi",
    "baslangic tarihi",
  ],
  contractEnd: [
    "sozlesme bitis tarihi",
    "bitiş tarihi",
    "bitis tarihi",
  ],
  assignedMinutes: [
    "calisma suresi",
    "atanan sure",
    "atanan süre",
    "gorevlendirme suresi",
    "çalışma süresi",
  ],
  workPeriod: ["calisma periyodu", "periyot", "çalışma periyodu"],
};

let previewState = {
  rowsFound: 0,
  rowsParsed: 0,
  rowsSkipped: 0,
  companies: [],
};

function log(...args) {
  if (CONFIG.debug) console.log("[ISGVizyon Scraper]", ...args);
}

function normalizeText(value) {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function textContentOf(element) {
  return element?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function parseInteger(value) {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseDateText(value) {
  const text = textContentOf({ textContent: value });
  if (!text) return "";
  const dateOnly = text.match(/\d{2}\.\d{2}\.\d{4}/)?.[0];
  return dateOnly || text;
}

function calculateRequiredMinutes(employeeCount, hazardClass) {
  if (!employeeCount || employeeCount <= 0) return null;

  const normalizedHazard = normalizeText(hazardClass);
  let minutesPerEmployee = 10;

  if (normalizedHazard.includes("cok tehlikeli")) minutesPerEmployee = 30;
  else if (normalizedHazard.includes("tehlikeli")) minutesPerEmployee = 20;

  return employeeCount * minutesPerEmployee;
}

function isLoggedIn() {
  if (document.querySelector('form[action*="login"], #loginForm')) return false;
  if (document.querySelector('a[href*="logout"], a[href*="cikis"]')) return true;

  const pageText = normalizeText(document.body?.innerText || "");
  if (pageText.includes("giris yap") && pageText.includes("e-devlet")) return false;

  return true;
}

function isTargetPage() {
  return window.location.href.includes("/kisi-kurum/kisi-karti/kisi-kartim");
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function clickContractTabIfNeeded() {
  const tabCandidates = Array.from(
    document.querySelectorAll('a, button, [role="tab"], .tab-item, .nav-link')
  );

  for (const candidate of tabCandidates) {
    const text = normalizeText(textContentOf(candidate));
    if (text.includes("isg hizmet sozlesmeleri")) {
      candidate.click();
      await wait(CONFIG.minDelayMs);
      return true;
    }
  }

  return false;
}

function getHeaderCells(table) {
  const headerRows = table.querySelectorAll("thead tr, tr");
  for (const row of headerRows) {
    const cells = Array.from(row.querySelectorAll("th, td"));
    const headerText = cells.map((cell) => normalizeText(textContentOf(cell)));
    if (
      headerText.some((item) => item.includes("sgk")) &&
      headerText.some((item) => item.includes("nace")) &&
      headerText.some((item) => item.includes("tehlike"))
    ) {
      return cells;
    }
  }
  return [];
}

function resolveColumnMap(table) {
  const headerCells = getHeaderCells(table);
  if (!headerCells.length) return null;

  const headerNames = headerCells.map((cell) => normalizeText(textContentOf(cell)));
  const columnMap = {};

  for (const [field, aliases] of Object.entries(FIELD_SYNONYMS)) {
    const index = headerNames.findIndex((header) =>
      aliases.some((alias) => header.includes(alias))
    );

    if (index >= 0) {
      columnMap[field] = index;
    }
  }

  if (columnMap.companyName == null || columnMap.sgkNo == null) {
    return null;
  }

  return columnMap;
}

function findContractTable() {
  const tables = Array.from(document.querySelectorAll("table"));

  for (const table of tables) {
    const columnMap = resolveColumnMap(table);
    if (columnMap) {
      return { table, columnMap };
    }
  }

  return null;
}

async function waitForContractTable() {
  const start = Date.now();

  while (Date.now() - start < CONFIG.tableWaitMs) {
    const found = findContractTable();
    if (found) return found;
    await wait(500);
  }

  return null;
}

function getCellText(cells, index) {
  if (index == null) return "";
  return textContentOf(cells[index]);
}

function extractCompanyData(row, columnMap) {
  const cells = Array.from(row.querySelectorAll("td"));
  if (!cells.length) return null;

  const companyName = getCellText(cells, columnMap.companyName);
  const sgkNo = getCellText(cells, columnMap.sgkNo);
  const employeeCount = parseInteger(getCellText(cells, columnMap.employeeCount));
  const hazardClass = getCellText(cells, columnMap.hazardClass);
  const naceCode = getCellText(cells, columnMap.naceCode);
  const contractStart = parseDateText(getCellText(cells, columnMap.contractStart));
  const contractEnd = parseDateText(getCellText(cells, columnMap.contractEnd));
  const assignedMinutes = parseInteger(getCellText(cells, columnMap.assignedMinutes));
  const requiredMinutes = calculateRequiredMinutes(employeeCount, hazardClass);

  if (!companyName || !sgkNo) return null;

  return {
    companyName,
    sgkNo,
    employeeCount,
    hazardClass,
    naceCode,
    contractStart,
    contractEnd,
    assignedMinutes,
    requiredMinutes,
  };
}

async function readCompaniesForPreview() {
  const target = await waitForContractTable();
  if (!target) {
    throw new Error("Sözleşme tablosu bulunamadı.");
  }

  const rows = Array.from(target.table.querySelectorAll("tbody tr")).filter(
    (row) => row.querySelectorAll("td").length > 0
  );

  if (!rows.length) {
    throw new Error("Firma satırı bulunamadı.");
  }

  const parsed = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    try {
      const company = extractCompanyData(row, target.columnMap);
      if (!company) {
        skipped += 1;
        log("Satır atlandı", { index });
        return;
      }
      parsed.push(company);
    } catch (error) {
      skipped += 1;
      log("Satır parse edilemedi", { index, message: error?.message || String(error) });
    }
  });

  previewState = {
    rowsFound: rows.length,
    rowsParsed: parsed.length,
    rowsSkipped: skipped,
    companies: parsed,
  };

  return previewState;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${PANEL_ID} {
      position: fixed;
      right: 24px;
      bottom: 24px;
      width: 420px;
      max-height: calc(100vh - 48px);
      overflow: auto;
      z-index: 2147483647;
      border-radius: 18px;
      border: 1px solid rgba(15, 23, 42, 0.18);
      background: #ffffff;
      box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28);
      color: #0f172a;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #${PANEL_ID} * { box-sizing: border-box; }
    .isgvizyon-panel__header {
      padding: 18px 20px 14px;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #f8fafc;
    }
    .isgvizyon-panel__kicker {
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      opacity: 0.75;
    }
    .isgvizyon-panel__title {
      margin-top: 8px;
      font-size: 20px;
      font-weight: 700;
    }
    .isgvizyon-panel__body { padding: 18px 20px 20px; }
    .isgvizyon-panel__notice,
    .isgvizyon-panel__consent {
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 13px;
      line-height: 1.5;
    }
    .isgvizyon-panel__notice {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      color: #334155;
    }
    .isgvizyon-panel__consent {
      margin-top: 14px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e3a8a;
    }
    .isgvizyon-panel__actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 16px;
    }
    .isgvizyon-btn {
      border: 0;
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
    }
    .isgvizyon-btn:hover { transform: translateY(-1px); }
    .isgvizyon-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
    .isgvizyon-btn--primary {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff;
      box-shadow: 0 10px 28px rgba(37, 99, 235, 0.28);
    }
    .isgvizyon-btn--success {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: #ffffff;
      box-shadow: 0 10px 28px rgba(5, 150, 105, 0.28);
    }
    .isgvizyon-btn--secondary {
      background: #e2e8f0;
      color: #0f172a;
    }
    .isgvizyon-panel__summary {
      margin-top: 16px;
      display: none;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
      background: #ffffff;
    }
    .isgvizyon-panel__summary.is-active { display: block; }
    .isgvizyon-panel__summary-head {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1px;
      background: #e2e8f0;
    }
    .isgvizyon-panel__summary-stat {
      background: #f8fafc;
      padding: 10px 12px;
    }
    .isgvizyon-panel__summary-stat strong {
      display: block;
      font-size: 18px;
    }
    .isgvizyon-panel__summary-stat span {
      font-size: 12px;
      color: #64748b;
    }
    .isgvizyon-panel__list { padding: 8px 0; }
    .isgvizyon-panel__list-item {
      padding: 10px 14px;
      border-top: 1px solid #f1f5f9;
    }
    .isgvizyon-panel__list-item:first-child { border-top: 0; }
    .isgvizyon-panel__list-title { font-size: 13px; font-weight: 600; color: #0f172a; }
    .isgvizyon-panel__list-meta { font-size: 12px; color: #64748b; margin-top: 4px; }
    .isgvizyon-panel__footer-note {
      margin-top: 12px;
      font-size: 12px;
      color: #64748b;
    }
  `;

  document.head.appendChild(style);
}

function buildSummaryList(companies) {
  if (!companies.length) {
    return `<div class="isgvizyon-panel__list-item"><div class="isgvizyon-panel__list-meta">Önizlenecek kayıt bulunamadı.</div></div>`;
  }

  return companies
    .slice(0, CONFIG.previewLimit)
    .map(
      (company) => `
        <div class="isgvizyon-panel__list-item">
          <div class="isgvizyon-panel__list-title">${escapeHtml(company.companyName)}</div>
          <div class="isgvizyon-panel__list-meta">
            SGK: ${escapeHtml(company.sgkNo)} · ${
              company.employeeCount ?? "-"
            } çalışan · ${escapeHtml(company.hazardClass || "Belirtilmedi")}
          </div>
        </div>
      `
    )
    .join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ensurePanel() {
  ensureStyles();

  let panel = document.getElementById(PANEL_ID);
  if (panel) return panel;

  panel = document.createElement("section");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="isgvizyon-panel__header">
      <div class="isgvizyon-panel__kicker">ISGVizyon Uzantısı</div>
      <div class="isgvizyon-panel__title">İSG Bot Aktarım Paneli</div>
    </div>
    <div class="isgvizyon-panel__body">
      <div class="isgvizyon-panel__notice">${escapeHtml(NOTICE_TEXT)}</div>
      <div class="isgvizyon-panel__consent">${escapeHtml(CONSENT_TEXT)}</div>
      <div class="isgvizyon-panel__actions">
        <button id="isgvizyon-read-btn" class="isgvizyon-btn isgvizyon-btn--primary">Firmalarımı Oku</button>
        <button id="isgvizyon-confirm-btn" class="isgvizyon-btn isgvizyon-btn--success" disabled>Onayla ve ISGVizyon’a Aktar</button>
        <button id="isgvizyon-cancel-btn" class="isgvizyon-btn isgvizyon-btn--secondary" disabled>İptal</button>
      </div>
      <div id="isgvizyon-preview" class="isgvizyon-panel__summary"></div>
      <div class="isgvizyon-panel__footer-note">
        Önce veriler okunur, sonra önizleme gösterilir. Siz onay vermeden hiçbir veri ISGVizyon’a gönderilmez.
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  panel
    .querySelector("#isgvizyon-read-btn")
    ?.addEventListener("click", () => void handleReadCompanies());
  panel
    .querySelector("#isgvizyon-confirm-btn")
    ?.addEventListener("click", () => void handleConfirmTransfer());
  panel
    .querySelector("#isgvizyon-cancel-btn")
    ?.addEventListener("click", () => resetPreview("Aktarım iptal edildi."));

  return panel;
}

function setButtonsState({ reading = false, canConfirm = false }) {
  const panel = ensurePanel();
  const readBtn = panel.querySelector("#isgvizyon-read-btn");
  const confirmBtn = panel.querySelector("#isgvizyon-confirm-btn");
  const cancelBtn = panel.querySelector("#isgvizyon-cancel-btn");

  if (readBtn) {
    readBtn.disabled = reading;
    readBtn.textContent = reading ? "Firmalar okunuyor..." : "Firmalarımı Oku";
  }
  if (confirmBtn) confirmBtn.disabled = !canConfirm || reading;
  if (cancelBtn) cancelBtn.disabled = !canConfirm || reading;
}

function renderPreview(summary) {
  const panel = ensurePanel();
  const preview = panel.querySelector("#isgvizyon-preview");
  if (!preview) return;

  preview.classList.add("is-active");
  preview.innerHTML = `
    <div class="isgvizyon-panel__summary-head">
      <div class="isgvizyon-panel__summary-stat"><strong>${summary.rowsFound}</strong><span>Bulunan</span></div>
      <div class="isgvizyon-panel__summary-stat"><strong>${summary.rowsParsed}</strong><span>Hazır</span></div>
      <div class="isgvizyon-panel__summary-stat"><strong>${summary.rowsSkipped}</strong><span>Atlanan</span></div>
    </div>
    <div class="isgvizyon-panel__list">${buildSummaryList(summary.companies)}</div>
  `;
}

function resetPreview(message) {
  previewState = {
    rowsFound: 0,
    rowsParsed: 0,
    rowsSkipped: 0,
    companies: [],
  };

  const panel = ensurePanel();
  const preview = panel.querySelector("#isgvizyon-preview");
  if (preview) {
    preview.classList.remove("is-active");
    preview.innerHTML = "";
  }

  setButtonsState({ reading: false, canConfirm: false });
  if (message) showNotification(message, "info");
}

async function handleReadCompanies() {
  try {
    setButtonsState({ reading: true, canConfirm: false });
    const summary = await readCompaniesForPreview();

    if (!summary.rowsParsed) {
      throw new Error("Aktarılabilir firma/sözleşme kaydı bulunamadı.");
    }

    renderPreview(summary);
    setButtonsState({ reading: false, canConfirm: true });
    showNotification(
      `${summary.rowsParsed} kayıt önizlendi. Onay verirseniz aktarım başlatılacak.`,
      "success"
    );
  } catch (error) {
    log("Önizleme hatası", error);
    setButtonsState({ reading: false, canConfirm: false });
    showNotification(error?.message || "Veriler okunamadı.", "error");
  }
}

async function handleConfirmTransfer() {
  try {
    if (!previewState.companies.length) {
      throw new Error("Önce firma listesini okuyun.");
    }

    setButtonsState({ reading: true, canConfirm: false });

    const response = await chrome.runtime.sendMessage({
      type: "ISGKATIP_SYNC_SUBMIT",
      data: previewState.companies,
      metadata: {
        sourceUrl: window.location.href,
        previewSummary: {
          rowsFound: previewState.rowsFound,
          rowsParsed: previewState.rowsParsed,
          rowsSkipped: previewState.rowsSkipped,
        },
      },
    });

    if (!response?.success) {
      throw new Error(response?.error || "Aktarım başarısız oldu.");
    }

    const summary = response.summary || {};
    showNotification(
      `Aktarım tamamlandı. Yeni: ${summary.inserted ?? 0}, güncel: ${
        summary.updated ?? 0
      }, atlanan: ${summary.skipped ?? 0}.`,
      "success"
    );
    resetPreview();
  } catch (error) {
    setButtonsState({ reading: false, canConfirm: true });
    showNotification(error?.message || "Aktarım sırasında hata oluştu.", "error");
  }
}

function showNotification(message, type = "info") {
  const colors = {
    success: "#059669",
    error: "#dc2626",
    info: "#2563eb",
  };

  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483647;
    max-width: 360px;
    padding: 12px 16px;
    border-radius: 12px;
    background: ${colors[type] || colors.info};
    color: #ffffff;
    font: 600 13px/1.5 Inter, system-ui, sans-serif;
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.24);
  `;
  toast.textContent = `ISGVizyon: ${message}`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4200);
}

async function init() {
  log("Scraper başlatıldı");

  if (!isLoggedIn()) {
    showNotification("İSG-KATİP oturumu bulunamadı. Önce giriş yapın.", "error");
    return;
  }

  if (!isTargetPage()) {
    log("Hedef sayfada değil", window.location.href);
    return;
  }

  await wait(CONFIG.minDelayMs);
  await clickContractTabIfNeeded();
  ensurePanel();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void init(), { once: true });
} else {
  void init();
}
