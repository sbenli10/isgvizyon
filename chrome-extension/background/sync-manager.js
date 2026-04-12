// ====================================================
// SUPABASE SYNC MANAGER
// ====================================================

export class SyncManager {
  constructor() {
    this.supabaseUrl = null;
    this.supabaseKey = null;
    this.orgId = null;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  async init() {
    const config = await chrome.storage.local.get([
      'supabaseUrl',
      'supabaseKey',
      'orgId',
      'userId',
    ]);

    this.supabaseUrl = config.supabaseUrl;
    this.supabaseKey = config.supabaseKey;
    this.orgId = config.orgId;
    this.userId = config.userId;

    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Supabase configuration missing');
    }
  }

  /**
   * Company data'yı Supabase'e sync et
   */
  async syncToSupabase(companyData) {
    await this.init();

    try {
      // Edge Function'a gönder
      const response = await this.callEdgeFunction('isgkatip-sync', {
        action: 'SYNC_COMPANY',
        data: {
          ...companyData,
          orgId: this.orgId,
          userId: this.userId,
          source: 'chrome_extension',
        },
      });

      if (!response.success) {
        throw new Error(response.error || 'Sync failed');
      }

      console.log('✅ Sync successful:', companyData.sgkNo);
      return response;
    } catch (error) {
      console.error('❌ Sync error:', error);
      throw error;
    }
  }

  /**
   * Compliance flags'i kaydet
   */
  async syncComplianceFlags(complianceResult) {
    await this.init();

    try {
      const response = await this.callEdgeFunction('compliance-check', {
        action: 'SAVE_FLAGS',
        data: {
          ...complianceResult,
          orgId: this.orgId,
        },
      });

      return response;
    } catch (error) {
      console.error('❌ Compliance sync error:', error);
      throw error;
    }
  }

  /**
   * Audit log kaydet
   */
  async logAudit(action, details) {
    await this.init();

    try {
      await this.callEdgeFunction('isgkatip-sync', {
        action: 'LOG_AUDIT',
        data: {
          orgId: this.orgId,
          userId: this.userId,
          action,
          details,
          timestamp: new Date().toISOString(),
          source: 'chrome_extension',
        },
      });
    } catch (error) {
      console.error('❌ Audit log error:', error);
    }
  }

  /**
   * Edge Function çağrısı (retry logic ile)
   */
  async callEdgeFunction(functionName, payload, attempt = 1) {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/${functionName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.supabaseKey}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt < this.retryAttempts) {
        console.warn(`⚠️ Retry attempt ${attempt}/${this.retryAttempts}`);
        await this.delay(this.retryDelay * attempt);
        return this.callEdgeFunction(functionName, payload, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Diff detection - Sadece değişen alanları sync et
   */
  async syncWithDiffDetection(newData, existingData) {
    const changes = this.detectChanges(newData, existingData);

    if (changes.length === 0) {
      console.log('ℹ️ No changes detected, skipping sync');
      return { success: true, changes: [] };
    }

    console.log(`📊 Detected ${changes.length} changes:`, changes);

    return await this.syncToSupabase({
      ...newData,
      _changes: changes,
    });
  }

  /**
   * Değişiklikleri tespit et
   */
  detectChanges(newData, existingData) {
    const changes = [];
    const keys = Object.keys(newData);

    for (const key of keys) {
      if (newData[key] !== existingData?.[key]) {
        changes.push({
          field: key,
          oldValue: existingData?.[key],
          newValue: newData[key],
        });
      }
    }

    return changes;
  }

  /**
   * Helper: Delay
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Batch sync (çoklu firma)
   */
  async batchSync(companies) {
    const results = [];
    const batchSize = 10;

    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map((company) => this.syncToSupabase(company))
      );

      batchResults.forEach((result, index) => {
        results.push({
          company: batch[index].sgkNo,
          status: result.status,
          data: result.status === 'fulfilled' ? result.value : null,
          error: result.status === 'rejected' ? result.reason.message : null,
        });
      });

      console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} completed`);
    }

    return results;
  }
}