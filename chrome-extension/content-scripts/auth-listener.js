const AUTH_BRIDGE_SOURCE = "denetron-web-app";
const STATUS_BRIDGE_SOURCE = "isgvizyon-web-app";
const STATUS_RESPONSE_SOURCE = "isgvizyon-extension-bridge";
const AUTH_SESSION_MESSAGE = "AUTH_SESSION_UPDATED";
const EXTENSION_STATUS_MESSAGE = "ISGVIZYON_EXTENSION_STATUS";
const EXTENSION_STATUS_RESPONSE = "ISGVIZYON_EXTENSION_STATUS_RESPONSE";
const MULTI_ASSIGNMENT_APPLY = "ISGVIZYON_MULTI_ASSIGNMENT_APPLY";
const EXCESS_DURATION_APPLY = "ISGVIZYON_EXCESS_DURATION_APPLY";
const VALIDATE_ASSIGNMENT_SURFACE = "ISGVIZYON_VALIDATE_ASSIGNMENT_SURFACE";
const VALIDATE_DURATION_SURFACE = "ISGVIZYON_VALIDATE_DURATION_SURFACE";
const EXTENSION_APPLY_RESPONSE = "ISGVIZYON_EXTENSION_APPLY_RESPONSE";
const AUTH_LISTENER_DEBUG = false;
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/www\.isgvizyon\.com$/,
  /^https:\/\/isgvizyon\.com$/,
  /^http:\/\/localhost(?::\d+)?$/,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/,
];

const debugAuthListener = (...args) => {
  if (AUTH_LISTENER_DEBUG) console.log(...args);
};

const isAllowedOrigin = (origin) => ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));

const postStatusResponse = (requestId, payload) => {
  window.postMessage(
    {
      source: STATUS_RESPONSE_SOURCE,
      type: EXTENSION_STATUS_RESPONSE,
      requestId,
      payload,
    },
    window.location.origin,
  );
};

const postApplyResponse = (requestId, payload) => {
  window.postMessage(
    {
      source: STATUS_RESPONSE_SOURCE,
      type: EXTENSION_APPLY_RESPONSE,
      requestId,
      payload,
    },
    window.location.origin,
  );
};

debugAuthListener("[ISGVizyon Auth Listener] hazır");

window.addEventListener("message", async (event) => {
  if (event.source !== window) return;
  if (!isAllowedOrigin(event.origin)) return;

  const payload = event.data;
  if (!payload) return;

  if (payload.source === STATUS_BRIDGE_SOURCE && payload.type === EXTENSION_STATUS_MESSAGE) {
    try {
      debugAuthListener("[Bridge] status request received");
      const response = await chrome.runtime.sendMessage({
        type: EXTENSION_STATUS_MESSAGE,
        requestId: payload.requestId || null,
        source: "web_bridge",
      });
      debugAuthListener("[Bridge] status response forwarded");
      postStatusResponse(payload.requestId || null, response || { success: false, error: "EMPTY_EXTENSION_RESPONSE" });
    } catch (error) {
      postStatusResponse(payload.requestId || null, {
        success: false,
        error: error?.message || "Eklenti durum bilgisi alınamadı.",
      });
    }
    return;
  }

  if (
    payload.source === STATUS_BRIDGE_SOURCE &&
    (
      payload.type === MULTI_ASSIGNMENT_APPLY ||
      payload.type === EXCESS_DURATION_APPLY ||
      payload.type === VALIDATE_ASSIGNMENT_SURFACE ||
      payload.type === VALIDATE_DURATION_SURFACE
    )
  ) {
    try {
      debugAuthListener("[Bridge] apply request received", { type: payload.type });
      const response = await chrome.runtime.sendMessage({
        type: payload.type,
        requestId: payload.requestId || null,
        source: "web_bridge",
        data: payload.payload || null,
      });
      debugAuthListener("[Bridge] apply response forwarded", { type: payload.type });
      postApplyResponse(payload.requestId || null, response || { success: false, error: "EMPTY_EXTENSION_RESPONSE" });
    } catch (error) {
      postApplyResponse(payload.requestId || null, {
        success: false,
        error: error?.message || "Gerçek işlem yanıtı alınamadı.",
      });
    }
    return;
  }

  if (payload.source !== AUTH_BRIDGE_SOURCE || payload.type !== "DENETRON_AUTH_UPDATED") return;

  try {
    await chrome.runtime.sendMessage({
      type: AUTH_SESSION_MESSAGE,
      data: payload.data || null,
    });
    debugAuthListener("[ISGVizyon Auth Listener] oturum güncellemesi iletildi");
  } catch (error) {
    console.error("[ISGVizyon Auth Listener] iletim başarısız:", error);
  }
});
