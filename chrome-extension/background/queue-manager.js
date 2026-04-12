// ====================================================
// QUEUE MANAGER - OFFLINE SUPPORT
// ====================================================

export class QueueManager {
  constructor() {
    this.storageKey = 'sync_queue';
    this.maxQueueSize = 1000;
  }

  /**
   * Queue'ya ekle
   */
  async add(item) {
    try {
      const queue = await this.getAll();

      if (queue.length >= this.maxQueueSize) {
        console.warn('⚠️ Queue full, removing oldest items');
        queue.shift();
      }

      queue.push({
        id: this.generateId(),
        ...item,
        addedAt: Date.now(),
        retryCount: 0,
      });

      await chrome.storage.local.set({ [this.storageKey]: queue });
      console.log('✅ Item added to queue');
    } catch (error) {
      console.error('❌ Queue add error:', error);
    }
  }

  /**
   * Tüm queue'yu getir
   */
  async getAll() {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      return result[this.storageKey] || [];
    } catch (error) {
      console.error('❌ Queue get error:', error);
      return [];
    }
  }

  /**
   * Queue'dan sil
   */
  async remove(itemId) {
    try {
      const queue = await this.getAll();
      const filtered = queue.filter((item) => item.id !== itemId);
      await chrome.storage.local.set({ [this.storageKey]: filtered });
      console.log(`✅ Item ${itemId} removed from queue`);
    } catch (error) {
      console.error('❌ Queue remove error:', error);
    }
  }

  /**
   * Başarısız item'ları retry et
   */
  async incrementRetry(itemId) {
    try {
      const queue = await this.getAll();
      const item = queue.find((i) => i.id === itemId);

      if (item) {
        item.retryCount += 1;
        item.lastRetryAt = Date.now();

        await chrome.storage.local.set({ [this.storageKey]: queue });
      }
    } catch (error) {
      console.error('❌ Retry increment error:', error);
    }
  }

  /**
   * Queue'yu temizle
   */
  async clear() {
    try {
      await chrome.storage.local.set({ [this.storageKey]: [] });
      console.log('✅ Queue cleared');
    } catch (error) {
      console.error('❌ Queue clear error:', error);
    }
  }

  /**
   * Queue istatistikleri
   */
  async getStats() {
    const queue = await this.getAll();

    return {
      total: queue.length,
      pending: queue.filter((i) => i.retryCount === 0).length,
      failed: queue.filter((i) => i.retryCount > 0).length,
      oldestItem: queue.length > 0 ? queue[0].addedAt : null,
    };
  }

  /**
   * Unique ID generator
   */
  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}