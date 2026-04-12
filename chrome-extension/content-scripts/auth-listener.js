// ====================================================
// AUTH LISTENER (WEB APP -> EXTENSION)
// ====================================================

console.log('🔐 Denetron auth listener hazır');

window.addEventListener('message', async (event) => {
  if (event.source !== window) {
    return;
  }

  const payload = event.data;
  if (!payload || payload.source !== 'denetron-web-app') {
    return;
  }

  if (payload.type === 'DENETRON_AUTH_UPDATED') {
    try {
      await chrome.runtime.sendMessage({
        type: 'WEB_AUTH_UPDATED',
        data: payload.data || null,
      });
      console.log('✅ Auth bilgisi service worker\'a iletildi');
    } catch (error) {
      console.error('❌ Auth iletimi başarısız:', error);
    }
  }
});
