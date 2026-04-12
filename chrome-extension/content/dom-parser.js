// ====================================================
// İSG-KATİP DOM PARSER
// ====================================================

export class ISGKatipParser {
  constructor() {
    this.selectors = {
      companyName: '[data-company-name], .company-title, #company-name',
      sgkNo: '[data-sgk], .sgk-no, #sgk-sicil',
      employeeCount: '[data-employee-count], .employee-count',
      hazardClass: '[data-hazard-class], .tehlike-sinifi',
      contractStart: '[data-contract-start], .sozlesme-baslangic',
      contractEnd: '[data-contract-end], .sozlesme-bitis',
      assignedMinutes: '[data-assigned-minutes], .atanan-sure',
      contractTable: '.sozlesme-listesi, #contract-table',
    };
  }

  /**
   * Firma bilgilerini parse et
   */
  parseCompanyInfo() {
    try {
      return {
        companyName: this.extractText(this.selectors.companyName),
        sgkNo: this.extractSGKNo(),
        employeeCount: this.extractEmployeeCount(),
        hazardClass: this.extractHazardClass(),
        contractStart: this.extractDate(this.selectors.contractStart),
        contractEnd: this.extractDate(this.selectors.contractEnd),
        assignedMinutes: this.extractMinutes(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Parse error:', error);
      return null;
    }
  }

  /**
   * SGK Sicil No normalize et
   */
  extractSGKNo() {
    const raw = this.extractText(this.selectors.sgkNo);
    // Format: 123456789 veya 12-3456789
    return raw.replace(/[^0-9]/g, '');
  }

  /**
   * Çalışan sayısını integer'a çevir
   */
  extractEmployeeCount() {
    const raw = this.extractText(this.selectors.employeeCount);
    const match = raw.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  /**
   * Tehlike sınıfını normalize et
   */
  extractHazardClass() {
    const raw = this.extractText(this.selectors.hazardClass).toLowerCase();
    
    if (raw.includes('az tehlikeli') || raw.includes('az-tehlikeli')) {
      return 'Az Tehlikeli';
    }
    if (raw.includes('çok tehlikeli') || raw.includes('cok-tehlikeli')) {
      return 'Çok Tehlikeli';
    }
    return 'Tehlikeli';
  }

  /**
   * Tarih parse et (DD.MM.YYYY veya YYYY-MM-DD)
   */
  extractDate(selector) {
    const raw = this.extractText(selector);
    if (!raw) return null;

    // DD.MM.YYYY format
    const ddmmyyyy = raw.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (ddmmyyyy) {
      return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
    }

    // YYYY-MM-DD format
    const yyyymmdd = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (yyyymmdd) {
      return raw;
    }

    return null;
  }

  /**
   * Atanan süreyi dakika cinsine çevir
   */
  extractMinutes() {
    const raw = this.extractText(this.selectors.assignedMinutes);
    
    // "120 dk/ay" veya "2 saat/ay" formatları
    const minuteMatch = raw.match(/(\d+)\s*(dk|dakika)/i);
    if (minuteMatch) {
      return parseInt(minuteMatch[1], 10);
    }

    const hourMatch = raw.match(/(\d+)\s*(saat|sa)/i);
    if (hourMatch) {
      return parseInt(hourMatch[1], 10) * 60;
    }

    return 0;
  }

  /**
   * Tablo satırlarından çoklu firma çek
   */
  parseCompanyTable() {
    const table = document.querySelector(this.selectors.contractTable);
    if (!table) return [];

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    
    return rows.map((row) => {
      try {
        const cells = row.querySelectorAll('td');
        
        return {
          companyName: cells[0]?.textContent.trim() || '',
          sgkNo: cells[1]?.textContent.trim().replace(/[^0-9]/g, '') || '',
          employeeCount: parseInt(cells[2]?.textContent.trim() || '0', 10),
          hazardClass: this.normalizeHazardClass(cells[3]?.textContent.trim() || ''),
          contractStart: cells[4]?.textContent.trim() || null,
          contractEnd: cells[5]?.textContent.trim() || null,
          assignedMinutes: parseInt(cells[6]?.textContent.trim() || '0', 10),
          isSelected: row.classList.contains('selected') || false,
        };
      } catch (error) {
        console.error('Row parse error:', error);
        return null;
      }
    }).filter(Boolean);
  }

  /**
   * Generic text extractor
   */
  extractText(selector) {
    const element = document.querySelector(selector);
    return element?.textContent.trim() || '';
  }

  /**
   * Hazard class normalizer
   */
  normalizeHazardClass(raw) {
    const lower = raw.toLowerCase();
    if (lower.includes('az')) return 'Az Tehlikeli';
    if (lower.includes('çok') || lower.includes('cok')) return 'Çok Tehlikeli';
    return 'Tehlikeli';
  }
}