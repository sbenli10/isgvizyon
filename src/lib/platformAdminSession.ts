const PLATFORM_ADMIN_SESSION_KEY = "isgvizyon-platform-admin-session";

export function markPlatformAdminSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PLATFORM_ADMIN_SESSION_KEY, "active");
}

export function clearPlatformAdminSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PLATFORM_ADMIN_SESSION_KEY);
}

export function hasPlatformAdminSession() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(PLATFORM_ADMIN_SESSION_KEY) === "active";
}
