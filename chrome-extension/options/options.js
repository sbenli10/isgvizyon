// ====================================================
// OPTIONS PAGE LOGIC
// ====================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🔧 Options page loaded');

  // Load saved settings
  try {
    const config = await chrome.storage.local.get([
      'supabaseUrl',
      'supabaseKey',
      'orgId',
    ]);

    if (config.supabaseUrl) {
      document.getElementById('supabaseUrl').value = config.supabaseUrl;
    }
    if (config.supabaseKey) {
      document.getElementById('supabaseKey').value = config.supabaseKey;
    }
    if (config.orgId) {
      document.getElementById('orgId').value = config.orgId;
    }

    console.log('✅ Saved settings loaded');
  } catch (error) {
    console.error('❌ Load settings error:', error);
  }

  // Form submit
  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSettings();
  });

  // Test button
  document.getElementById('testBtn').addEventListener('click', async () => {
    await testConnection();
  });
});

async function saveSettings() {
  const saveBtn = document.getElementById('saveBtn');
  const originalText = saveBtn.innerHTML;

  const supabaseUrl = document.getElementById('supabaseUrl').value.trim();
  const supabaseKey = document.getElementById('supabaseKey').value.trim();
  const orgId = document.getElementById('orgId').value.trim();

  // Validation
  if (!supabaseUrl || !supabaseKey || !orgId) {
    showStatus('❌ Tüm alanları doldurun', 'error');
    return;
  }

  if (!supabaseUrl.includes('supabase.co')) {
    showStatus('❌ Geçersiz Supabase URL', 'error');
    return;
  }

  if (!supabaseKey.startsWith('eyJ')) {
    showStatus('❌ Geçersiz Supabase Key formatı', 'error');
    return;
  }

  // UUID validation for orgId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orgId)) {
    showStatus('❌ Geçersiz Organization ID formatı', 'error');
    return;
  }

  try {
    // Show loading
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<div class="spinner"></div> Kaydediliyor...';

    // Save to storage
    await chrome.storage.local.set({
      supabaseUrl,
      supabaseKey,
      orgId,
    });

    console.log('✅ Settings saved to storage');

    showStatus('✅ Ayarlar başarıyla kaydedildi!', 'success');

    // Notify background script
    try {
      await chrome.runtime.sendMessage({
        type: 'CONFIG_UPDATED',
        data: { supabaseUrl, supabaseKey, orgId },
      });
      console.log('✅ Background notified');
    } catch (error) {
      console.warn('⚠️ Background notification failed:', error);
    }

    // Auto-close after 2 seconds
    setTimeout(() => {
      window.close();
    }, 2000);
  } catch (error) {
    console.error('❌ Save error:', error);
    showStatus('❌ Kaydetme hatası: ' + error.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalText;
  }
}

async function testConnection() {
  const testBtn = document.getElementById('testBtn');
  const originalText = testBtn.innerHTML;

  const supabaseUrl = document.getElementById('supabaseUrl').value.trim();
  const supabaseKey = document.getElementById('supabaseKey').value.trim();

  if (!supabaseUrl || !supabaseKey) {
    showStatus('❌ Önce URL ve Key alanlarını doldurun', 'error');
    return;
  }

  try {
    // Show loading
    testBtn.disabled = true;
    testBtn.innerHTML = '<div class="spinner"></div> Test ediliyor...';
    showStatus('🔄 Bağlantı test ediliyor...', 'info');

    // Test Supabase REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    if (response.ok || response.status === 404) {
      // 404 is OK (means API is reachable but no table specified)
      showStatus('✅ Supabase bağlantısı başarılı!', 'success');
      console.log('✅ Connection test successful');
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('❌ Connection test error:', error);
    showStatus('❌ Bağlantı hatası: ' + error.message, 'error');
  } finally {
    testBtn.disabled = false;
    testBtn.innerHTML = originalText;
  }
}

function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;

  console.log(`[${type.toUpperCase()}] ${message}`);

  if (type === 'success' || type === 'info') {
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }
}