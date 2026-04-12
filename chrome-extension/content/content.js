// ====================================================
// CONTENT SCRIPT MAIN
// ====================================================

import { ISGKatipParser } from './dom-parser.js';
import { DOMObserver } from './observer.js';

class ISGKatipContentScript {
  constructor() {
    this.parser = new ISGKatipParser();
    this.observer = null;
    this.lastSyncedData = null;
  }

  async init() {
    console.log('🚀 Denetron İSG Bot başlatıldı');

    // İlk parse
    this.parseAndSync();

    // Observer başlat
    this.observer = new DOMObserver(this.parser, (data) => {
      this.parseAndSync(data);
    });
    this.observer.start();

    // Message listener
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sendResponse);
      return true; // Async response
    });
  }

  parseAndSync(data = null) {
    try {
      const companyData = data || this.parser.parseCompanyInfo();
      
      if (!companyData) {
        console.warn('⚠️ No company data found');
        return;
      }

      // Duplicate check
      if (JSON.stringify(companyData) === JSON.stringify(this.lastSyncedData)) {
        return;
      }

      this.lastSyncedData = companyData;

      // Background'a gönder
      chrome.runtime.sendMessage({
        type: 'COMPANY_DATA_PARSED',
        data: companyData,
      });

      console.log('✅ Data sent to background:', companyData);
    } catch (error) {
      console.error('❌ Parse and sync error:', error);
    }
  }

  handleMessage(message, sendResponse) {
    switch (message.type) {
      case 'GET_COMPANY_INFO':
        sendResponse({ data: this.parser.parseCompanyInfo() });
        break;

      case 'GET_COMPANY_TABLE':
        sendResponse({ data: this.parser.parseCompanyTable() });
        break;

      case 'BULK_ASSIGN':
        this.handleBulkAssign(message.payload, sendResponse);
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  }

  async handleBulkAssign(payload, sendResponse) {
    try {
      const { companies, expertId } = payload;
      const results = [];

      for (const company of companies) {
        // İSG-KATİP'te atama işlemini simüle et
        const result = await this.assignExpert(company.sgkNo, expertId);
        results.push(result);
      }

      sendResponse({ success: true, results });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async assignExpert(sgkNo, expertId) {
    // İSG-KATİP spesifik DOM manipülasyonu
    // Bu kısım İSG-KATİP'in gerçek UI'ına göre özelleştirilmeli
    return {
      sgkNo,
      expertId,
      status: 'success',
      timestamp: new Date().toISOString(),
    };
  }
}

// Init
const contentScript = new ISGKatipContentScript();
contentScript.init();