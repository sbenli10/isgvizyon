const AUTH_BRIDGE_SOURCE = "denetron-web-app";
const AUTH_SESSION_MESSAGE = "AUTH_SESSION_UPDATED";

console.log("[ISGVizyon Auth Listener] hazır");

window.addEventListener("message", async (event) => {
  if (event.source !== window) return;

  const payload = event.data;
  if (!payload || payload.source !== AUTH_BRIDGE_SOURCE) return;

  if (payload.type !== "DENETRON_AUTH_UPDATED") return;

  try {
    await chrome.runtime.sendMessage({
      type: AUTH_SESSION_MESSAGE,
      data: payload.data || null,
    });
    console.log("[ISGVizyon Auth Listener] oturum güncellemesi iletildi");
  } catch (error) {
    console.error("[ISGVizyon Auth Listener] iletim başarısız:", error);
  }
});
