// chrome-extension/auth/auth-handler.js
import {
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_URL,
  DEFAULT_WEB_APP_URL,
} from "../config/defaults.js";
import { assertExtensionApi } from "../shared/extension-api.js";

const AUTH_DEBUG = true;
const AUTH_LOG_PREFIX = "[Denetron AuthHandler]";

function maskValue(value, visibleStart = 6, visibleEnd = 4) {
  if (!value || typeof value !== "string") return null;
  if (value.length <= visibleStart + visibleEnd) return "***";
  return `${value.slice(0, visibleStart)}...${value.slice(-visibleEnd)}`;
}

function safeError(error) {
  return {
    name: error?.name || null,
    message: error?.message || String(error),
    stack: error?.stack || null,
  };
}

function safeAuthSummary(auth) {
  if (!auth) {
    return {
      exists: false,
    };
  }

  return {
    exists: true,
    hasAccessToken: Boolean(auth.accessToken),
    accessTokenMasked: maskValue(auth.accessToken),
    hasRefreshToken: Boolean(auth.refreshToken),
    refreshTokenMasked: maskValue(auth.refreshToken),
    hasExpiresAt: Boolean(auth.expiresAt),
    expiresAt: auth.expiresAt || null,
    expiresAtIso: auth.expiresAt ? new Date(auth.expiresAt).toISOString() : null,
    now: Date.now(),
    nowIso: new Date().toISOString(),
    isExpired: auth.expiresAt ? Date.now() >= auth.expiresAt : null,
    expiresInMs: auth.expiresAt ? auth.expiresAt - Date.now() : null,
    hasUser: Boolean(auth.user),
    userId: auth.user?.id || null,
    userEmail: auth.user?.email || null,
    organizationId:
      auth.user?.organization_id ||
      auth.user?.user_metadata?.organization_id ||
      auth.user?.app_metadata?.organization_id ||
      null,
    hasSession: Boolean(auth.session),
  };
}

function safeSessionSummary(session) {
  if (!session) {
    return {
      exists: false,
    };
  }

  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : null;

  return {
    exists: true,
    hasAccessToken: Boolean(session.access_token),
    accessTokenMasked: maskValue(session.access_token),
    hasRefreshToken: Boolean(session.refresh_token),
    refreshTokenMasked: maskValue(session.refresh_token),
    expiresAtRaw: session.expires_at || null,
    expiresAtMs,
    expiresAtIso: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
    tokenType: session.token_type || null,
    hasUser: Boolean(session.user),
    userId: session.user?.id || null,
    userEmail: session.user?.email || null,
  };
}

function authLog(step, data = {}) {
  if (!AUTH_DEBUG) return;

  try {
    console.log(AUTH_LOG_PREFIX, {
      step,
      time: new Date().toISOString(),
      ...data,
    });
  } catch (error) {
    console.log(AUTH_LOG_PREFIX, step, data);
  }
}

export class AuthHandler {
  constructor() {
    authLog("constructor:start");

    this.extension = assertExtensionApi("AuthHandler");
    this.supabaseUrl = DEFAULT_SUPABASE_URL;
    this.webAppUrl = DEFAULT_WEB_APP_URL;
    this.storageKey = "denetron_auth";

    authLog("constructor:done", {
      hasExtensionApi: Boolean(this.extension),
      hasStorageLocal: Boolean(this.extension?.storage?.local),
      supabaseUrl: this.supabaseUrl,
      webAppUrl: this.webAppUrl,
      storageKey: this.storageKey,
    });
  }

  async init() {
    authLog("init:start");

    try {
      const config = await this.extension.storage.local.get(["supabaseUrl"]);

      authLog("init:storage-config", {
        hasStoredSupabaseUrl: Boolean(config.supabaseUrl),
        storedSupabaseUrl: config.supabaseUrl || null,
        defaultSupabaseUrl: DEFAULT_SUPABASE_URL,
      });

      this.supabaseUrl = config.supabaseUrl || DEFAULT_SUPABASE_URL;

      authLog("init:done", {
        resolvedSupabaseUrl: this.supabaseUrl,
      });
    } catch (error) {
      authLog("init:error", {
        error: safeError(error),
      });

      throw error;
    }
  }

  normalizeAuthPayload(authData) {
    authLog("normalizeAuthPayload:start", {
      hasAuthData: Boolean(authData),
      hasDirectAccessToken: Boolean(authData?.accessToken),
      hasDirectRefreshToken: Boolean(authData?.refreshToken),
      hasSession: Boolean(authData?.session),
      session: safeSessionSummary(authData?.session),
      hasUser: Boolean(authData?.user),
      userId: authData?.user?.id || authData?.session?.user?.id || null,
      userEmail: authData?.user?.email || authData?.session?.user?.email || null,
    });

    if (!authData) {
      authLog("normalizeAuthPayload:return:null:no-auth-data");
      return null;
    }

    if (authData.accessToken && authData.refreshToken) {
      authLog("normalizeAuthPayload:return:direct-token-payload", {
        normalized: safeAuthSummary(authData),
      });

      return authData;
    }

    if (authData.session?.access_token) {
      const expiresAt =
        authData.expiresAt ||
        (authData.session.expires_at ? authData.session.expires_at * 1000 : null) ||
        Date.now() + 60 * 60 * 1000;

      const normalized = {
        accessToken: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
        expiresAt,
        user: authData.user || authData.session.user || null,
        session: authData.session,
      };

      authLog("normalizeAuthPayload:return:session-payload", {
        normalized: safeAuthSummary(normalized),
      });

      return normalized;
    }

    authLog("normalizeAuthPayload:return:raw-auth-data", {
      normalized: safeAuthSummary(authData),
    });

    return authData;
  }

  async getAuth() {
    authLog("getAuth:start", {
      storageKey: this.storageKey,
    });

    try {
      const result = await this.extension.storage.local.get([this.storageKey]);
      const auth = result[this.storageKey] || null;

      authLog("getAuth:storage-result", {
        storageKeys: Object.keys(result || {}),
        auth: safeAuthSummary(auth),
      });

      return auth;
    } catch (error) {
      authLog("getAuth:error", {
        error: safeError(error),
      });

      console.error("Get auth error:", error);
      return null;
    }
  }

  async saveAuth(authData) {
    authLog("saveAuth:start", {
      incomingHasAuthData: Boolean(authData),
      incomingHasSession: Boolean(authData?.session),
      incomingSession: safeSessionSummary(authData?.session),
      incomingHasUser: Boolean(authData?.user),
      incomingUserId: authData?.user?.id || authData?.session?.user?.id || null,
      incomingUserEmail: authData?.user?.email || authData?.session?.user?.email || null,
    });

    try {
      const normalized = this.normalizeAuthPayload(authData);

      authLog("saveAuth:normalized", {
        normalized: safeAuthSummary(normalized),
      });

      if (!normalized?.user?.id) {
        authLog("saveAuth:error:no-valid-user-id", {
          normalized: safeAuthSummary(normalized),
          normalizedUser: normalized?.user || null,
        });

        throw new Error("Gecerli kullanici bilgisi bulunamadi.");
      }

      const config = await this.extension.storage.local.get(["supabaseUrl", "supabaseKey"]);

      authLog("saveAuth:storage-config", {
        hasStoredSupabaseUrl: Boolean(config.supabaseUrl),
        storedSupabaseUrl: config.supabaseUrl || null,
        hasStoredSupabaseKey: Boolean(config.supabaseKey),
        storedSupabaseKeyMasked: maskValue(config.supabaseKey),
        hasDefaultSupabaseKey: Boolean(DEFAULT_SUPABASE_ANON_KEY),
        defaultSupabaseKeyMasked: maskValue(DEFAULT_SUPABASE_ANON_KEY),
      });

      const resolvedOrganizationId =
        normalized.user.organization_id ||
        normalized.user.user_metadata?.organization_id ||
        normalized.user.app_metadata?.organization_id ||
        null;

      authLog("saveAuth:resolved-identifiers", {
        userId: normalized.user.id,
        userEmail: normalized.user.email || null,
        organizationId: resolvedOrganizationId,
        organizationIdFromRoot: normalized.user.organization_id || null,
        organizationIdFromUserMetadata: normalized.user.user_metadata?.organization_id || null,
        organizationIdFromAppMetadata: normalized.user.app_metadata?.organization_id || null,
      });

      const payloadToStore = {
        denetron_auth: normalized,
        supabaseUrl: config.supabaseUrl || DEFAULT_SUPABASE_URL,
        supabaseKey: config.supabaseKey || DEFAULT_SUPABASE_ANON_KEY,
        orgId: resolvedOrganizationId,
        userId: normalized.user.id,
      };

      authLog("saveAuth:storage-set:start", {
        keys: Object.keys(payloadToStore),
        auth: safeAuthSummary(payloadToStore.denetron_auth),
        supabaseUrl: payloadToStore.supabaseUrl,
        hasSupabaseKey: Boolean(payloadToStore.supabaseKey),
        supabaseKeyMasked: maskValue(payloadToStore.supabaseKey),
        orgId: payloadToStore.orgId,
        userId: payloadToStore.userId,
      });

      await this.extension.storage.local.set(payloadToStore);

      authLog("saveAuth:storage-set:done");

      const verifyResult = await this.extension.storage.local.get([
        this.storageKey,
        "supabaseUrl",
        "supabaseKey",
        "orgId",
        "userId",
      ]);

      authLog("saveAuth:verify-storage", {
        hasAuth: Boolean(verifyResult[this.storageKey]),
        auth: safeAuthSummary(verifyResult[this.storageKey]),
        supabaseUrl: verifyResult.supabaseUrl || null,
        hasSupabaseKey: Boolean(verifyResult.supabaseKey),
        supabaseKeyMasked: maskValue(verifyResult.supabaseKey),
        orgId: verifyResult.orgId || null,
        userId: verifyResult.userId || null,
      });

      authLog("saveAuth:done");
    } catch (error) {
      authLog("saveAuth:error", {
        error: safeError(error),
      });

      throw error;
    }
  }

  async clearAuth() {
    authLog("clearAuth:start", {
      keysToRemove: [this.storageKey, "orgId", "userId"],
    });

    try {
      await this.extension.storage.local.remove([this.storageKey, "orgId", "userId"]);

      authLog("clearAuth:remove:done");

      const verifyResult = await this.extension.storage.local.get([
        this.storageKey,
        "orgId",
        "userId",
      ]);

      authLog("clearAuth:verify-storage", {
        hasAuth: Boolean(verifyResult[this.storageKey]),
        orgId: verifyResult.orgId || null,
        userId: verifyResult.userId || null,
      });

      return true;
    } catch (error) {
      authLog("clearAuth:error", {
        error: safeError(error),
      });

      console.error("Clear auth error:", error);
      return false;
    }
  }

  async isAuthenticated() {
    authLog("isAuthenticated:start");

    try {
      const auth = await this.getAuth();

      authLog("isAuthenticated:auth-result", {
        auth: safeAuthSummary(auth),
      });

      if (!auth) {
        authLog("isAuthenticated:return:false:no-auth");
        return false;
      }

      if (!auth.expiresAt) {
        authLog("isAuthenticated:return:false:no-expiresAt", {
          auth: safeAuthSummary(auth),
        });

        return false;
      }

      if (Date.now() >= auth.expiresAt) {
        authLog("isAuthenticated:token-expired:refreshToken:start", {
          auth: safeAuthSummary(auth),
        });

        const refreshResult = await this.refreshToken();

        authLog("isAuthenticated:token-expired:refreshToken:done", {
          refreshResult,
        });

        return refreshResult;
      }

      authLog("isAuthenticated:return:true", {
        expiresInMs: auth.expiresAt - Date.now(),
      });

      return true;
    } catch (error) {
      authLog("isAuthenticated:error", {
        error: safeError(error),
      });

      return false;
    }
  }

  async refreshToken() {
    authLog("refreshToken:start", {
      supabaseUrl: this.supabaseUrl,
    });

    try {
      const auth = await this.getAuth();

      authLog("refreshToken:auth-result", {
        auth: safeAuthSummary(auth),
      });

      if (!auth?.refreshToken) {
        authLog("refreshToken:return:false:no-refresh-token");
        return false;
      }

      const config = await this.extension.storage.local.get(["supabaseKey"]);
      const supabaseKey = config.supabaseKey || DEFAULT_SUPABASE_ANON_KEY;

      const refreshUrl = `${this.supabaseUrl}/auth/v1/token?grant_type=refresh_token`;

      authLog("refreshToken:request:start", {
        url: refreshUrl,
        method: "POST",
        hasSupabaseKey: Boolean(supabaseKey),
        supabaseKeyMasked: maskValue(supabaseKey),
        hasRefreshToken: Boolean(auth.refreshToken),
        refreshTokenMasked: maskValue(auth.refreshToken),
      });

      const response = await fetch(refreshUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          refresh_token: auth.refreshToken,
        }),
      });

      authLog("refreshToken:response:received", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        redirected: response.redirected,
        type: response.type,
      });

      const responseText = await response.text();

      authLog("refreshToken:response:text", {
        hasText: Boolean(responseText),
        textLength: responseText?.length || 0,
        textPreview: responseText ? responseText.slice(0, 500) : null,
      });

      let data = null;

      try {
        data = responseText ? JSON.parse(responseText) : null;

        authLog("refreshToken:response:json-parsed", {
          hasData: Boolean(data),
          hasAccessToken: Boolean(data?.access_token),
          accessTokenMasked: maskValue(data?.access_token),
          hasRefreshToken: Boolean(data?.refresh_token),
          refreshTokenMasked: maskValue(data?.refresh_token),
          hasUser: Boolean(data?.user),
          userId: data?.user?.id || null,
          userEmail: data?.user?.email || null,
          expiresAtRaw: data?.expires_at || null,
          expiresIn: data?.expires_in || null,
          tokenType: data?.token_type || null,
          error: data?.error || null,
          errorCode: data?.error_code || null,
          errorDescription: data?.error_description || null,
          msg: data?.msg || null,
        });
      } catch (jsonError) {
        authLog("refreshToken:response:json-parse-error", {
          error: safeError(jsonError),
          responseTextPreview: responseText ? responseText.slice(0, 500) : null,
        });
      }

      if (!response.ok) {
        authLog("refreshToken:error:response-not-ok", {
          status: response.status,
          statusText: response.statusText,
          data,
        });

        throw new Error(`Token refresh failed with HTTP ${response.status}`);
      }

      authLog("refreshToken:saveAuth:start", {
        session: safeSessionSummary(data),
        hasUser: Boolean(data?.user),
      });

      await this.saveAuth({
        session: data,
        user: data?.user,
      });

      authLog("refreshToken:saveAuth:done");
      authLog("refreshToken:return:true");

      return true;
    } catch (error) {
      authLog("refreshToken:error", {
        error: safeError(error),
      });

      console.error("Token refresh error:", error);

      authLog("refreshToken:clearAuth:start");
      await this.clearAuth();
      authLog("refreshToken:clearAuth:done");

      return false;
    }
  }

  async getAccessToken() {
    authLog("getAccessToken:start");

    try {
      const auth = await this.getAuth();

      authLog("getAccessToken:auth-result", {
        auth: safeAuthSummary(auth),
      });

      if (!auth) {
        authLog("getAccessToken:return:null:no-auth");
        return null;
      }

      if (!auth.expiresAt) {
        authLog("getAccessToken:return:null:no-expiresAt", {
          auth: safeAuthSummary(auth),
        });

        return null;
      }

      const shouldRefresh = Date.now() >= auth.expiresAt - 5 * 60 * 1000;

      authLog("getAccessToken:refresh-check", {
        shouldRefresh,
        refreshThresholdMs: 5 * 60 * 1000,
        expiresAt: auth.expiresAt,
        expiresAtIso: new Date(auth.expiresAt).toISOString(),
        now: Date.now(),
        nowIso: new Date().toISOString(),
        msUntilExpiry: auth.expiresAt - Date.now(),
      });

      if (shouldRefresh) {
        authLog("getAccessToken:refreshToken:start");

        const refreshResult = await this.refreshToken();

        authLog("getAccessToken:refreshToken:done", {
          refreshResult,
        });

        const nextAuth = await this.getAuth();

        authLog("getAccessToken:next-auth-after-refresh", {
          auth: safeAuthSummary(nextAuth),
        });

        const nextAccessToken = nextAuth?.accessToken || null;

        authLog("getAccessToken:return:after-refresh", {
          hasAccessToken: Boolean(nextAccessToken),
          accessTokenMasked: maskValue(nextAccessToken),
        });

        return nextAccessToken;
      }

      authLog("getAccessToken:return:current-token", {
        hasAccessToken: Boolean(auth.accessToken),
        accessTokenMasked: maskValue(auth.accessToken),
      });

      return auth.accessToken;
    } catch (error) {
      authLog("getAccessToken:error", {
        error: safeError(error),
      });

      return null;
    }
  }

  async getUser() {
    authLog("getUser:start");

    try {
      const auth = await this.getAuth();
      const user = auth?.user || null;

      authLog("getUser:return", {
        hasUser: Boolean(user),
        userId: user?.id || null,
        userEmail: user?.email || null,
        organizationId:
          user?.organization_id ||
          user?.user_metadata?.organization_id ||
          user?.app_metadata?.organization_id ||
          null,
      });

      return user;
    } catch (error) {
      authLog("getUser:error", {
        error: safeError(error),
      });

      return null;
    }
  }

  getLoginUrl() {
    authLog("getLoginUrl:start", {
      webAppUrl: this.webAppUrl,
    });

    const loginUrl = `${this.webAppUrl}/auth?ext=true`;

    authLog("getLoginUrl:return", {
      loginUrl,
    });

    return loginUrl;
  }
}