const CONFIG = {
  debug: false,
  minDelayMs: 1500,
  tableWaitMs: 12000,
  previewLimit: 10,
  pilotApplyLimit: 3,
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ISGVIZYON_ISGKATIP_STATUS") {
    sendResponse({
      success: true,
      isLoggedIn: isLoggedIn(),
      isTargetPage: isTargetPage(),
      hasPanel: Boolean(document.getElementById(PANEL_ID)),
      hasPreview: previewState.rowsParsed > 0,
      currentUrl: window.location.href,
    });

    return true;
  }

  if (message?.type === "ISGVIZYON_MULTI_ASSIGNMENT_APPLY_REQUEST") {
    void handlePilotApplyV2("multi_assignment_apply", message?.payload || {})
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          success: false,
          error: error?.message || "Çoklu atama pilot işlemi başarısız oldu.",
        }),
      );
    return true;
  }

  if (message?.type === "ISGVIZYON_VALIDATE_ASSIGNMENT_SURFACE_REQUEST") {
    void validateSurface("multi_assignment_apply", message?.payload || {})
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          success: false,
          error: error?.message || "Atama formu dogrulanamadi.",
        }),
      );
    return true;
  }

  if (message?.type === "ISGVIZYON_VALIDATE_DURATION_SURFACE_REQUEST") {
    void validateSurface("excess_duration_update_apply", message?.payload || {})
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          success: false,
          error: error?.message || "Sure guncelleme formu dogrulanamadi.",
        }),
      );
    return true;
  }

  if (message?.type === "ISGVIZYON_EXCESS_DURATION_APPLY_REQUEST") {
    void handlePilotApplyV2("excess_duration_update_apply", message?.payload || {})
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          success: false,
          error: error?.message || "Fazla süre pilot işlemi başarısız oldu.",
        }),
      );
    return true;
  }

  return false;
});

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

function safeMask(value) {
  const normalized = String(value || "").replace(/\D/g, "");
  if (!normalized) return "-";
  if (normalized.length <= 4) return normalized;
  return `${normalized.slice(0, 3)}***${normalized.slice(-2)}`;
}

function isVisibleElement(element) {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

async function waitForStableDom(durationMs = 400, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const start = Date.now();
    let lastMutationAt = Date.now();
    const observer = new MutationObserver(() => {
      lastMutationAt = Date.now();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    const tick = () => {
      const now = Date.now();
      if (now - lastMutationAt >= durationMs || now - start >= timeoutMs) {
        observer.disconnect();
        resolve();
        return;
      }
      window.setTimeout(tick, 120);
    };

    tick();
  });
}

function findElementsByPredicates(predicates, selector) {
  const controls = Array.from(document.querySelectorAll(selector)).filter(isVisibleElement);
  const ranked = [];

  controls.forEach((element) => {
    let score = 0;
    const labelText = normalizeText(element.getAttribute("aria-label") || "");
    const placeholderText = normalizeText(element.getAttribute("placeholder") || "");
    const nameText = normalizeText(element.getAttribute("name") || "");
    const idText = normalizeText(element.getAttribute("id") || "");
    const valueText = normalizeText(element.value || "");
    const buttonText = normalizeText(textContentOf(element));

    predicates.forEach((predicate) => {
      if (labelText.includes(predicate)) score += 3;
      if (placeholderText.includes(predicate)) score += 2;
      if (nameText.includes(predicate) || idText.includes(predicate)) score += 2;
      if (buttonText.includes(predicate) || valueText.includes(predicate)) score += 2;
    });

    if (idText) {
      const linkedLabels = Array.from(document.querySelectorAll(`label[for="${CSS.escape(element.id)}"]`));
      if (linkedLabels.some((label) => predicates.some((predicate) => normalizeText(textContentOf(label)).includes(predicate)))) {
        score += 4;
      }
    }

    const closestField = element.closest("label, .form-group, .form-item, .field, td, tr, div");
    if (closestField) {
      const fieldText = normalizeText(textContentOf(closestField));
      if (predicates.some((predicate) => fieldText.includes(predicate))) {
        score += 2;
      }
    }

    if (score > 0) ranked.push({ element, score });
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

function findInputByLabelText(labelTexts) {
  const predicates = labelTexts.map(normalizeText);
  const ranked = findElementsByPredicates(predicates, "input, textarea");
  return ranked[0] || null;
}

function findSelectByLabelText(labelTexts) {
  const predicates = labelTexts.map(normalizeText);
  const ranked = findElementsByPredicates(predicates, "select, [role='combobox']");
  return ranked[0] || null;
}

function findButtonByText(buttonTexts) {
  const predicates = buttonTexts.map(normalizeText);
  const ranked = findElementsByPredicates(predicates, "button, a, [role='button'], input[type='button'], input[type='submit']");
  return ranked[0] || null;
}

function scoreToConfidence(score) {
  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  if (score >= 1) return "low";
  return "not_found";
}

function detectKatipPageContext() {
  const headings = Array.from(document.querySelectorAll("h1, h2, h3, .page-title, .title, .breadcrumb, [role='heading']"))
    .map((element) => textContentOf(element))
    .filter(Boolean)
    .slice(0, 8);
  const bodyText = normalizeText(document.body?.innerText || "");

  let detectedModule = "unknown";
  let confidence = "low";

  if (bodyText.includes("isg hizmet sozlesmeleri") || headings.some((heading) => normalizeText(heading).includes("isg hizmet sozlesmeleri"))) {
    detectedModule = "contract_list";
    confidence = "high";
  } else if (bodyText.includes("sozlesme") || bodyText.includes("gorevlendirme")) {
    detectedModule = "contract_related";
    confidence = "medium";
  }

  return {
    url: window.location.href,
    title: document.title || null,
    path: window.location.pathname || null,
    activeTab: headings[0] || null,
    detectedModule,
    visibleHeadings: headings,
    formCount: document.querySelectorAll("form").length,
    inputCount: document.querySelectorAll("input, textarea").length,
    selectCount: document.querySelectorAll("select, [role='combobox']").length,
    buttonCount: document.querySelectorAll("button, a, [role='button']").length,
    confidence,
  };
}

function detectAssignmentFormSurface() {
  const fields = {
    sgkField: findInputByLabelText(["SGK Sicil No", "Işyeri Sicil No", "SGK No", "Sicil No"]),
    personField: findInputByLabelText(["T.C. Kimlik No", "Personel"]) || findSelectByLabelText(["Personel"]),
    roleField: findInputByLabelText(["Görev", "Rol"]) || findSelectByLabelText(["Görev", "Rol"]),
    contractTypeField: findSelectByLabelText(["Sözleşme Türü", "Sözleşme Tipi"]),
    minutesField: findInputByLabelText(["Süre", "Dakika"]),
    submitButton: findButtonByText(["Ata", "Görevlendir", "Yeni Sözleşme", "Kaydet", "Onayla"]),
  };

  const requiredKeys = ["sgkField", "personField", "submitButton"];
  const missing = requiredKeys.filter((key) => !fields[key]);
  const scores = Object.values(fields).filter(Boolean).map((entry) => entry.score);
  const score = scores.length ? Math.max(...scores) : 0;

  return {
    found: missing.length === 0,
    requiredFieldsFound: requiredKeys.length - missing.length,
    requiredFieldsMissing: missing,
    confidence: scoreToConfidence(score),
    fields,
  };
}

function detectDurationUpdateSurface() {
  const fields = {
    currentMinutesField: findInputByLabelText(["Mevcut Süre", "Atanan Süre", "Çalışma Süresi"]),
    newMinutesField: findInputByLabelText(["Yeni Süre", "Dakika", "Güncel Süre"]),
    contractTypeField: findSelectByLabelText(["Sözleşme Türü", "Sözleşme Tipi"]),
    submitButton: findButtonByText(["Güncelle", "Kaydet", "Süre Güncelle", "Düzenle"]),
  };

  const requiredKeys = ["newMinutesField", "submitButton"];
  const missing = requiredKeys.filter((key) => !fields[key]);
  const scores = Object.values(fields).filter(Boolean).map((entry) => entry.score);
  const score = scores.length ? Math.max(...scores) : 0;

  return {
    found: missing.length === 0,
    requiredFieldsFound: requiredKeys.length - missing.length,
    requiredFieldsMissing: missing,
    confidence: scoreToConfidence(score),
    fields,
  };
}

function validateRequiredFormFields(formSurface) {
  const blockingReasons = [];
  if (!formSurface.found) blockingReasons.push("Gerekli form alanlarının bir kısmı bulunamadı.");
  if (formSurface.confidence === "low" || formSurface.confidence === "not_found") {
    blockingReasons.push("Selector güven skoru düşük.");
  }
  if (formSurface.requiredFieldsMissing.length > 0) {
    blockingReasons.push(`Eksik alanlar: ${formSurface.requiredFieldsMissing.join(", ")}`);
  }
  return blockingReasons;
}

async function validateSurface(operationType, payload) {
  await waitForStableDom();
  const pageContext = detectKatipPageContext();
  const formSurface =
    operationType === "multi_assignment_apply" ? detectAssignmentFormSurface() : detectDurationUpdateSurface();
  const blockingReasons = [];

  if (!isLoggedIn()) blockingReasons.push("İSG-KATİP oturumu bulunamadı.");
  if (!isTargetPage()) {
    blockingReasons.push("İşlem için uygun İSG-KATİP ekranı bulunamadı. Lütfen ilgili atama/sözleşme ekranını açıp tekrar deneyin.");
  }
  blockingReasons.push(...validateRequiredFormFields(formSurface));

  return {
    success: blockingReasons.length === 0,
    error: blockingReasons.length > 0 ? blockingReasons[0] : null,
    validation: {
      pageContext,
      formSurface: {
        found: formSurface.found,
        requiredFieldsFound: formSurface.requiredFieldsFound,
        requiredFieldsMissing: formSurface.requiredFieldsMissing,
        confidence: formSurface.confidence,
      },
      canApply: blockingReasons.length === 0,
      blockingReasons,
      recordCount: Array.isArray(payload?.records) ? payload.records.length : 0,
    },
  };
}

function setNativeInputValue(input, value) {
  const prototype = Object.getPrototypeOf(input);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor?.set) {
    descriptor.set.call(input, value);
  } else {
    input.value = value;
  }
}

function dispatchInputEvents(element) {
  ["input", "change", "blur"].forEach((eventName) => {
    element.dispatchEvent(new Event(eventName, { bubbles: true }));
  });
}

function verifyInputValue(element, expectedValue) {
  return normalizeText(element.value || textContentOf(element)) === normalizeText(expectedValue);
}

function buildRowResult(record, operationType, status, message, extra = {}) {
  return {
    id: record.id || `${operationType}-${Date.now()}`,
    recordId: record.id || null,
    companyName: record.companyName || "Firma",
    sgkNo: safeMask(record.sgkNumber || record.sgkNo || "-"),
    status,
    reason: message,
    stage: extra.stage || null,
    selectorConfidence: extra.selectorConfidence || null,
    beforeValues: extra.beforeValues || null,
    afterValues: extra.afterValues || null,
    verificationStatus: extra.verificationStatus || null,
    durationMs: extra.durationMs || null,
    processedAt: new Date().toISOString(),
  };
}

async function executeSubmitFlow(operationType, record, formSurface) {
  const startedAt = Date.now();
  const beforeValues = {
    sgkNo: safeMask(record.sgkNumber || record.sgkNo || "-"),
    assignedMinutes: record.assignedMinutes || record.currentAssignedMinutes || null,
    newAssignedMinutes: record.newAssignedMinutes || record.assignedMinutes || null,
  };

  if (operationType === "excess_duration_update_apply" && formSurface.fields.newMinutesField?.element) {
    const targetValue = String(record.newAssignedMinutes ?? record.requiredMinutes ?? "");
    setNativeInputValue(formSurface.fields.newMinutesField.element, targetValue);
    dispatchInputEvents(formSurface.fields.newMinutesField.element);
    await wait(250);
    if (!verifyInputValue(formSurface.fields.newMinutesField.element, targetValue)) {
      return buildRowResult(record, operationType, "failed", "Alan değeri yazılamadı veya doğrulanamadı.", {
        stage: "input_verification",
        selectorConfidence: formSurface.confidence,
        beforeValues,
        afterValues: { attemptedMinutes: targetValue },
        verificationStatus: "failed",
        durationMs: Date.now() - startedAt,
      });
    }
  }

  if (!formSurface.fields.submitButton?.element) {
    return buildRowResult(record, operationType, "failed", "Submit butonu bulunamadı.", {
      stage: "submit_lookup",
      selectorConfidence: formSurface.confidence,
      beforeValues,
      verificationStatus: "failed",
      durationMs: Date.now() - startedAt,
    });
  }

  formSurface.fields.submitButton.element.scrollIntoView({ behavior: "smooth", block: "center" });
  await wait(250);
  formSurface.fields.submitButton.element.click();
  await waitForStableDom(600, 5000);

  const bodyText = normalizeText(document.body?.innerText || "");
  const successDetected =
    bodyText.includes("basarili") ||
    bodyText.includes("kaydedildi") ||
    bodyText.includes("guncellendi") ||
    bodyText.includes("onaylandi");
  const errorDetected =
    bodyText.includes("hata") ||
    bodyText.includes("basarisiz") ||
    bodyText.includes("zorunlu alan") ||
    bodyText.includes("gecersiz");

  const afterValues = {
    visibleTextSample: textContentOf(document.body).slice(0, 200),
  };

  if (errorDetected) {
    return buildRowResult(record, operationType, "failed", "İSG-KATİP hata mesajı gösterdi.", {
      stage: "submit_result",
      selectorConfidence: formSurface.confidence,
      beforeValues,
      afterValues,
      verificationStatus: "failed",
      durationMs: Date.now() - startedAt,
    });
  }

  if (successDetected) {
    return buildRowResult(record, operationType, "success_verified", "Doğrulanmış başarı: İSG-KATİP ekranında sonuç teyit edildi.", {
      stage: "submit_result",
      selectorConfidence: formSurface.confidence,
      beforeValues,
      afterValues,
      verificationStatus: "verified",
      durationMs: Date.now() - startedAt,
    });
  }

  return buildRowResult(record, operationType, "success_unverified", "Doğrulanamayan başarı: İşlem gönderildi ancak ekranda sonuç teyit edilemedi.", {
    stage: "submit_result",
    selectorConfidence: formSurface.confidence,
    beforeValues,
    afterValues,
    verificationStatus: "unverified",
    durationMs: Date.now() - startedAt,
  });
}

async function handlePilotApplyV2(operationType, payload) {
  if (!isLoggedIn()) {
    throw new Error("İSG-KATİP oturumu bulunamadı.");
  }

  if (!isTargetPage()) {
    throw new Error("İSG-KATİP hedef sayfası açık değil.");
  }

  const records = Array.isArray(payload?.records) ? payload.records.slice(0, CONFIG.pilotApplyLimit) : [];
  if (!records.length) {
    throw new Error("İşlem yapılacak kayıt seçilmedi.");
  }

  const validationResponse =
    payload?.validation && typeof payload.validation === "object"
      ? { success: !payload.validation.blockingReasons?.length, validation: payload.validation, error: payload.validation.blockingReasons?.[0] || null }
      : await validateSurface(operationType, payload);

  if (!validationResponse?.success) {
    return {
      success: false,
      error: validationResponse?.error || "İSG-KATİP form yüzeyi doğrulanamadı. Sayfa yapısı değişmiş olabilir.",
      validation: validationResponse?.validation || null,
      results: records.map((record) =>
        buildRowResult(record, operationType, "failed", validationResponse?.error || "Form yüzeyi doğrulanmadıysa işlem başlatılamaz.", {
          stage: "surface_validation",
          selectorConfidence: validationResponse?.validation?.formSurface?.confidence || "not_found",
          verificationStatus: "failed",
        }),
      ),
    };
  }

  const formSurface =
    operationType === "multi_assignment_apply" ? detectAssignmentFormSurface() : detectDurationUpdateSurface();
  const results = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    try {
      results.push(await executeSubmitFlow(operationType, record, formSurface));
    } catch (error) {
      results.push(
        buildRowResult(record, operationType, "failed", error?.message || "İşlem yüzeyi tetiklenemedi.", {
          stage: "unexpected_error",
          selectorConfidence: formSurface.confidence,
          verificationStatus: "failed",
        }),
      );
    }
  }

  return {
    success: results.some((item) => item.status === "success_verified" || item.status === "success_unverified"),
    validation: validationResponse.validation,
    results,
  };
}

async function handlePilotApply(operationType, payload) {
  if (!isLoggedIn()) {
    throw new Error("İSG-KATİP oturumu bulunamadı.");
  }

  if (!isTargetPage()) {
    throw new Error("İSG-KATİP hedef sayfası açık değil.");
  }

  const records = Array.isArray(payload?.records) ? payload.records.slice(0, CONFIG.pilotApplyLimit) : [];
  if (!records.length) {
    throw new Error("İşlem yapılacak kayıt seçilmedi.");
  }

  const actionSurface = tryFindInteractiveSurface(operationType);
  if (!actionSurface) {
    return {
      success: false,
      error: "İSG-KATİP form alanları bulunamadı. Sayfa yapısı değişmiş olabilir.",
      results: records.map((record, index) => ({
        id: record.id || `${operationType}-${index + 1}`,
        companyName: record.companyName || "Firma",
        sgkNo: record.sgkNumber || record.sgkNo || "-",
        status: "failed",
        reason: "İSG-KATİP form alanları bulunamadı. Sayfa yapısı değişmiş olabilir.",
        processedAt: new Date().toISOString(),
      })),
    };
  }

  const results = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    try {
      actionSurface.scrollIntoView({ behavior: "smooth", block: "center" });
      await wait(250);
      actionSurface.click();
      await wait(350);

      results.push({
        id: record.id || `${operationType}-${index + 1}`,
        companyName: record.companyName || "Firma",
        sgkNo: record.sgkNumber || record.sgkNo || "-",
        status: "success",
        reason:
          operationType === "multi_assignment_apply"
            ? "Pilot apply denemesi başlatıldı. İSG-KATİP üzerinde işlem yüzeyi tetiklendi."
            : "Pilot apply denemesi başlatıldı. İSG-KATİP üzerinde güncelleme yüzeyi tetiklendi.",
        processedAt: new Date().toISOString(),
      });
    } catch (error) {
      results.push({
        id: record.id || `${operationType}-${index + 1}`,
        companyName: record.companyName || "Firma",
        sgkNo: record.sgkNumber || record.sgkNo || "-",
        status: "failed",
        reason: error?.message || "İşlem yüzeyi tetiklenemedi.",
        processedAt: new Date().toISOString(),
      });
    }
  }

  return {
    success: results.some((item) => item.status === "success"),
    results,
  };
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
