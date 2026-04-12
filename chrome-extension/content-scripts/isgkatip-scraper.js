// chrome-extension/content-scripts/isgkatip-scraper.js

// ====================================================
// İSG-KATİP SCRAPER - MANUEL BUTON İLE ÇALIŞIR
// ====================================================

console.log('🔍 İSG-KATİP Scraper yüklendi');

// Config
const CONFIG = {
  minDelay: 2000,
  debug: true,
};

// Selector'lar
const SELECTORS = {
  table: 'table',
  rows: 'table tbody tr',
};

// Kolon index'leri (gerçek İSG-KATİP yapısına göre)
// chrome-extension/content-scripts/isgkatip-scraper.js

// Kolon index'leri (İSG-KATİP'teki tüm kolonlar)
const COLUMNS = {
  // Temel
  contractId: 0,                      // Sözleşme/Görevlendirme ID
  contractName: 1,                    // Sözleşme/Görevlendirme Adı
  contractType: 2,                    // Sözleşme/Görevlendirme Tipi
  workDuration: 3,                    // Çalışma Süresi
  workPeriod: 4,                      // Çalışma Periyodu
  contractStartDate: 5,               // Sözleşme Başlangıç Tarihi
  contractEndDate: 6,                 // Sözleşme Bitiş Tarihi
  contractStatus: 7,                  // Sözleşme Statüsü
  contractApprovalStatus: 8,          // Sözleşme Onay Statüsü
  contractApprovalDate: 9,            // Sözleşme Onay Tarihi
  isCompliant: 10,                    // Sözleşme Mevzuata Uygun Mu
  
  // Görevlendirilen kişi
  assignedPersonName: 11,             // Görevlendirilen Kişi Ad Soyad
  assignedPersonCertType: 12,         // Görevlendirilen Kişi Sertifika Tipi
  assignedPersonCertNo: 13,           // Görevlendirilen Kişi Sertifika No
  
  // Hizmet veren işyeri
  serviceProviderId: 14,              // Hizmet Veren İşyeri ID
  serviceProviderName: 15,            // Hizmet Veren İşyeri Unvan
  serviceProviderSgkNo: 16,           // Hizmet Veren İşyeri SGK/Detsis No
  serviceProviderCity: 17,            // Hizmet Veren İşyeri İli
  serviceProviderCertNo: 18,          // Hizmet Veren İşyeri Yetki Belgesi No
  
  // Hizmet alan işyeri (asıl firma)
  serviceReceiverId: 19,              // Hizmet Alan İşyeri ID
  companyName: 20,                    // Hizmet Alan İşyeri Unvanı
  sgkNo: 21,                          // Hizmet Alan İşyeri SGK/Detsis No
  serviceReceiverCity: 22,            // Hizmet Alan İşyeri İli
  employeeCount: 23,                  // Hizmet Alan İşyeri Çalışan Sayısı
  hazardClass: 24,                    // Hizmet Alan İşyeri Tehlike Sınıfı
  naceCode: 25,                       // Hizmet Alan İşyeri NACE Kodu
  serviceReceiverApprovalStatus: 26,  // Hizmet Alan İşyeri Onay Statüsü
  
  // Diğer
  assignedPersonApprovalStatus: 27,   // Görevlendirilen Kişi Onay Statüsü
  assignedPersonApprovalDate: 28,     // Görevlendirilen Kişi Onay Tarihi
  contractDefinitionDate: 29,         // Sözleşme Tanımlanma Tarihi
  contractDefinedBy: 30,              // Sözleşmeyi Tanımlayan Kişi
  contractTerminationReason: 31,      // Sözleşme Sonlandırılma Nedeni
  contractTerminatedBy: 32,           // Sözleşmeyi Sonlandıran Kişi
};

function extractCompanyData(row) {
  const cells = row.querySelectorAll('td');
  
  if (cells.length < 33) {
    throw new Error(`Yetersiz kolon: ${cells.length}`);
  }
  
  const getText = (index) => {
    return cells[index] ? cells[index].textContent.trim() : '';
  };
  
  const getNumber = (index) => {
    const text = getText(index);
    const num = parseInt(text.replace(/\D/g, ''));
    return isNaN(num) ? 0 : num;
  };
  
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    
    const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (!match) return null;
    
    const [, day, month, year, hour, minute, second] = match;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  };
  
  return {
    // Temel bilgiler
    contract_id: getText(COLUMNS.contractId),
    contract_name: getText(COLUMNS.contractName),
    contract_type: getText(COLUMNS.contractType),
    contract_status: getText(COLUMNS.contractStatus),
    contract_approval_status: getText(COLUMNS.contractApprovalStatus),
    contract_approval_date: parseDate(getText(COLUMNS.contractApprovalDate)),
    is_compliant: getText(COLUMNS.isCompliant) === 'Uygun',
    
    // Görevlendirilen kişi
    assigned_person_name: getText(COLUMNS.assignedPersonName),
    assigned_person_certificate_type: getText(COLUMNS.assignedPersonCertType),
    assigned_person_certificate_no: getText(COLUMNS.assignedPersonCertNo),
    assigned_person_approval_status: getText(COLUMNS.assignedPersonApprovalStatus),
    assigned_person_approval_date: parseDate(getText(COLUMNS.assignedPersonApprovalDate)),
    
    // Hizmet veren
    service_provider_id: getText(COLUMNS.serviceProviderId),
    service_provider_name: getText(COLUMNS.serviceProviderName),
    service_provider_sgk_no: getText(COLUMNS.serviceProviderSgkNo),
    service_provider_city: getText(COLUMNS.serviceProviderCity),
    service_provider_certificate_no: getText(COLUMNS.serviceProviderCertNo),
    
    // Hizmet alan (asıl firma)
    service_receiver_id: getText(COLUMNS.serviceReceiverId),
    company_name: getText(COLUMNS.companyName),
    sgk_no: getText(COLUMNS.sgkNo),
    service_receiver_city: getText(COLUMNS.serviceReceiverCity),
    employee_count: getNumber(COLUMNS.employeeCount),
    hazard_class: getText(COLUMNS.hazardClass) || 'Az Tehlikeli',
    nace_code: getText(COLUMNS.naceCode),
    service_receiver_approval_status: getText(COLUMNS.serviceReceiverApprovalStatus),
    
    // Çalışma bilgileri
    assigned_minutes: getNumber(COLUMNS.workDuration),
    work_period: getText(COLUMNS.workPeriod),
    
    // Sözleşme tarihleri
    contract_start: parseDate(getText(COLUMNS.contractStartDate)),
    contract_end: parseDate(getText(COLUMNS.contractEndDate)),
    contract_definition_date: parseDate(getText(COLUMNS.contractDefinitionDate)),
    
    // Diğer
    contract_defined_by: getText(COLUMNS.contractDefinedBy),
    contract_termination_reason: getText(COLUMNS.contractTerminationReason),
    contract_terminated_by: getText(COLUMNS.contractTerminatedBy),
    
    // Hesaplanan
    required_minutes: calculateRequiredMinutes(
      getNumber(COLUMNS.employeeCount),
      getText(COLUMNS.hazardClass)
    ),
  };
}
// ====================================================
// INIT - BUTON GÖSTER
// ====================================================

async function init() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 İSG-KATİP SCRAPER BAŞLATILDI');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Login kontrolü
  const isLoggedIn = checkIfLoggedIn();
  
  if (!isLoggedIn) {
    console.warn('⚠️ Kullanıcı giriş yapmamış');
    return;
  }
  
  console.log('✅ Kullanıcı giriş yapmış');
  
  // Kişi kartı sayfasında mıyız?
  const isCorrectPage = window.location.href.includes('/kisi-kurum/kisi-karti/kisi-kartim');
  
  if (!isCorrectPage) {
    console.log('ℹ️ Kişi kartı sayfasında değiliz:', window.location.href);
    return;
  }
  
  console.log('✅ Kişi kartı sayfasındasınız');
  
  // Sayfa yüklenmesini bekle
  await new Promise(resolve => setTimeout(resolve, CONFIG.minDelay));
  
  // İSG Hizmet Sözleşmeleri tab'ına tıkla
  console.log('🔍 İSG Hizmet Sözleşmeleri tab aranıyor...');
  const tabClicked = await clickISGTab();
  
  if (!tabClicked) {
    console.warn('⚠️ Tab bulunamadı, yine de buton gösteriliyor');
  } else {
    console.log('✅ Tab başarıyla açıldı');
    
    // Tab yüklenmesini bekle
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Tablo kontrolü
  const table = document.querySelector(SELECTORS.table);
  if (table) {
    const rows = document.querySelectorAll(SELECTORS.rows);
    console.log(`✅ Tablo bulundu: ${rows.length} satır`);
  } else {
    console.log('⚠️ Tablo henüz yüklenmedi');
  }
  
  // BUTONU GÖSTER
  showTransferButton();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ SCRAPER HAZIR - BUTONA TIKLANMASI BEKLENİYOR');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// ====================================================
// İSG TAB'INA TIKLA
// ====================================================

async function clickISGTab() {
  const allTabs = document.querySelectorAll('a, button, [role="tab"], .tab-item');
  
  for (const tab of allTabs) {
    const text = tab.textContent.trim();
    
    if (
      text.includes('İSG Hizmet Sözleşmeleri') ||
      text.includes('İSG Hizmet') ||
      (text.includes('İSG') && text.includes('Sözleşme'))
    ) {
      console.log('✅ Tab bulundu:', text);
      tab.click();
      await new Promise(resolve => setTimeout(resolve, 1500));
      return true;
    }
  }
  
  console.error('❌ Tab bulunamadı');
  return false;
}

// ====================================================
// TRANSFER BUTONU GÖSTER
// ====================================================

function showTransferButton() {
  // Zaten varsa gösterme
  if (document.getElementById('denetron-transfer-btn')) {
    console.log('ℹ️ Buton zaten mevcut');
    return;
  }
  
  console.log('🔘 Transfer butonu oluşturuluyor...');
  
  const button = document.createElement('button');
  button.id = 'denetron-transfer-btn';
  button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    <span>Verileri İSGVizyon'a Aktar</span>
  `;
  
  button.style.cssText = `
    position: fixed;
    bottom: 30px;
    right: 30px;
    padding: 16px 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
    cursor: pointer;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 15px;
    font-weight: 600;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: all 0.3s ease;
    animation: slideInUp 0.5s ease-out;
  `;
  
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-3px)';
    button.style.boxShadow = '0 15px 50px rgba(102, 126, 234, 0.5)';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = '0 10px 40px rgba(102, 126, 234, 0.4)';
  });
  
  button.addEventListener('click', async () => {
    await handleTransfer(button);
  });
  
  document.body.appendChild(button);
  console.log('✅ Transfer butonu eklendi');
}

// ====================================================
// TRANSFER İŞLEMİ
// ====================================================

async function handleTransfer(button) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 VERİ TRANSFER İŞLEMİ BAŞLATILDI');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const originalHTML = button.innerHTML;
  button.disabled = true;
  button.style.opacity = '0.7';
  button.style.cursor = 'not-allowed';
  button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
    <span>Veriler toplanıyor...</span>
  `;
  
  try {
    showNotification('Veriler toplanıyor...', 'info');
    
    const companies = await scrapeCompanies();
    
    if (companies.length === 0) {
      throw new Error('Hiç işyeri verisi bulunamadı. Lütfen "İSG Hizmet Sözleşmeleri Bilgileri" tab\'ında olduğunuzdan emin olun.');
    }
    
    console.log(`📦 ${companies.length} işyeri bulundu, gönderiliyor...`);
    
    showNotification(`${companies.length} işyeri bulundu, İSGVizyon'a aktarılıyor...`, 'info');
    
    // Service worker'a gönder
    chrome.runtime.sendMessage({
      type: 'ISGKATIP_COMPANIES_SCRAPED',
      data: companies,
      metadata: {
        scrapedAt: new Date().toISOString(),
        sourceUrl: window.location.href,
        totalFound: companies.length,
      },
    });
    
    // Başarı
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
      <span>✅ ${companies.length} işyeri aktarıldı!</span>
    `;
    button.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    
    showNotification(`✅ ${companies.length} işyeri başarıyla aktarıldı!`, 'success');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ TRANSFER BAŞARILI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 3 saniye sonra eski haline dön
    setTimeout(() => {
      button.innerHTML = originalHTML;
      button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    }, 3000);
    
  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ TRANSFER HATASI');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Hata:', error.message);
    console.error('Stack:', error.stack);
    
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <span>❌ Hata oluştu</span>
    `;
    button.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    
    showNotification(`Hata: ${error.message}`, 'error');
    
    setTimeout(() => {
      button.innerHTML = originalHTML;
      button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    }, 3000);
  }
}

// ====================================================
// SCRAPE COMPANIES
// ====================================================

async function scrapeCompanies() {
  console.log('📊 Veri toplama başlatıldı...');
  
  const companies = [];
  const rows = document.querySelectorAll(SELECTORS.rows);
  
  console.log(`📋 Bulunan satır sayısı: ${rows.length}`);
  
  if (rows.length === 0) {
    throw new Error('Hiç sözleşme satırı bulunamadı');
  }
  
  rows.forEach((row, index) => {
    try {
      const company = extractCompanyData(row);
      
      if (company.company_name && company.sgk_no) {
        companies.push(company);
        
        if (CONFIG.debug && index < 5) {
          console.log(`  ✅ [${index + 1}] ${company.company_name}`);
        }
      }
    } catch (error) {
      if (CONFIG.debug) {
        console.error(`  ❌ [${index + 1}] Parse hatası:`, error.message);
      }
    }
  });
  
  console.log(`📦 Toplam parse edilen firma: ${companies.length}`);
  
  if (companies.length === 0) {
    throw new Error('Hiç işyeri verisi parse edilemedi');
  }
  
  return companies;
}

// ====================================================
// EXTRACT COMPANY DATA
// ====================================================

function extractCompanyData(row) {
  const cells = row.querySelectorAll('td');
  
  if (cells.length < 26) {
    throw new Error(`Yetersiz kolon: ${cells.length}`);
  }
  
  const getText = (index) => {
    return cells[index] ? cells[index].textContent.trim() : '';
  };
  
  const getNumber = (index) => {
    const text = getText(index);
    const num = parseInt(text.replace(/\D/g, ''));
    return isNaN(num) ? 0 : num;
  };
  
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    
    const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (!match) return null;
    
    const [, day, month, year, hour, minute, second] = match;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  };
  
  return {
    sgk_no: getText(COLUMNS.sgkNo),
    company_name: getText(COLUMNS.companyName),
    employee_count: getNumber(COLUMNS.employeeCount),
    hazard_class: getText(COLUMNS.hazardClass) || 'Az Tehlikeli',
    nace_code: getText(COLUMNS.naceCode),
    contract_id: getText(COLUMNS.contractId),
    contract_name: getText(COLUMNS.contractName),
    contract_type: getText(COLUMNS.contractType),
    contract_start: parseDate(getText(COLUMNS.startDate)),
    assigned_minutes: getNumber(COLUMNS.duration),
    period: getText(COLUMNS.period),
    required_minutes: calculateRequiredMinutes(
      getNumber(COLUMNS.employeeCount),
      getText(COLUMNS.hazardClass)
    ),
  };
}

function calculateRequiredMinutes(employeeCount, hazardClass) {
  let minutesPerEmployee = 10;
  
  if (hazardClass.includes('Çok Tehlikeli')) {
    minutesPerEmployee = 30;
  } else if (hazardClass.includes('Tehlikeli')) {
    minutesPerEmployee = 20;
  }
  
  return employeeCount * minutesPerEmployee;
}

function checkIfLoggedIn() {
  const userElements = document.querySelectorAll('[class*="user"], [class*="kullanici"]');
  
  for (const el of userElements) {
    const text = el.textContent.trim();
    if (text.length > 0 && !text.includes('Giriş')) {
      return true;
    }
  }
  
  if (document.querySelector('a[href*="logout"], a[href*="cikis"]')) {
    return true;
  }
  
  if (document.querySelector('form[action*="login"], #loginForm')) {
    return false;
  }
  
  return true;
}

function showNotification(message, type = 'info') {
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#3b82f6',
  };
  
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${colors[type]};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10001;
    font-family: system-ui;
    font-size: 14px;
    font-weight: 500;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = `İSGVizyon: ${message}`;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
  
  @keyframes slideInUp {
    from { transform: translateY(100px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;
document.head.appendChild(style);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

console.log('💡 İSG-KATİP Scraper hazır - Butona tıklayın');
