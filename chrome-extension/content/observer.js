// ====================================================
// MUTATION OBSERVER - DOM DEĞİŞİKLİKLERİNİ İZLE
// ====================================================

export class DOMObserver {
  constructor(parser, onUpdate) {
    this.parser = parser;
    this.onUpdate = onUpdate;
    this.observer = null;
    this.debounceTimer = null;
  }

  start() {
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-status'],
    });

    console.log('✅ DOM Observer started');
  }

  handleMutations(mutations) {
    // Debounce: 500ms içinde birden fazla değişiklik varsa tek seferde işle
    clearTimeout(this.debounceTimer);
    
    this.debounceTimer = setTimeout(() => {
      const relevantMutation = mutations.some((mutation) => {
        return (
          mutation.target.classList?.contains('sozlesme-listesi') ||
          mutation.target.closest('.company-detail')
        );
      });

      if (relevantMutation) {
        console.log('🔄 Relevant DOM change detected');
        this.triggerUpdate();
      }
    }, 500);
  }

  triggerUpdate() {
    const data = this.parser.parseCompanyInfo();
    if (data && this.onUpdate) {
      this.onUpdate(data);
    }
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
      console.log('⏹️ DOM Observer stopped');
    }
  }
}