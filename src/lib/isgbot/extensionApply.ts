import {
  ISGVIZYON_EXCESS_DURATION_APPLY,
  ISGVIZYON_MULTI_ASSIGNMENT_APPLY,
  ISGVIZYON_VALIDATE_ASSIGNMENT_SURFACE,
  ISGVIZYON_VALIDATE_DURATION_SURFACE,
} from "@/lib/constants/extension";

const WEB_APP_STATUS_SOURCE = "isgvizyon-web-app";
const EXTENSION_APPLY_RESPONSE_MESSAGE = "ISGVIZYON_EXTENSION_APPLY_RESPONSE";
const EXTENSION_STATUS_RESPONSE_SOURCE = "isgvizyon-extension-bridge";

type ExtensionApplyPayload = {
  type: string;
  data: Record<string, unknown>;
};

type ExtensionApplyResponse = {
  success?: boolean;
  error?: string | null;
  results?: Array<Record<string, unknown>>;
  summary?: Record<string, unknown>;
  validation?: Record<string, unknown> | null;
};

function requestExtensionApply(payload: ExtensionApplyPayload, timeoutMs = 90000): Promise<ExtensionApplyResponse | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    const requestId = `isgbot-apply-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let settled = false;

    const cleanup = () => {
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(timer);
    };

    const finish = (response: ExtensionApplyResponse | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(response);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;

      const message = event.data;
      if (
        message?.source !== EXTENSION_STATUS_RESPONSE_SOURCE ||
        message?.type !== EXTENSION_APPLY_RESPONSE_MESSAGE ||
        message?.requestId !== requestId
      ) {
        return;
      }

      finish((message.payload || null) as ExtensionApplyResponse | null);
    };

    const timer = window.setTimeout(() => {
      finish({
        success: false,
        error: "Eklenti yanıt süresi aşıldı. Lütfen bağlantıyı ve İSG-KATİP sekmesini kontrol edin.",
      });
    }, timeoutMs);

    window.addEventListener("message", handleMessage);
    window.postMessage(
      {
        source: WEB_APP_STATUS_SOURCE,
        type: payload.type,
        requestId,
        payload: payload.data,
      },
      window.location.origin,
    );
  });
}

export function sendMultiAssignmentApply(data: Record<string, unknown>) {
  return requestExtensionApply({
    type: ISGVIZYON_MULTI_ASSIGNMENT_APPLY,
    data,
  });
}

export function sendExcessDurationApply(data: Record<string, unknown>) {
  return requestExtensionApply({
    type: ISGVIZYON_EXCESS_DURATION_APPLY,
    data,
  });
}

export function validateAssignmentSurface(data: Record<string, unknown> = {}) {
  return requestExtensionApply({
    type: ISGVIZYON_VALIDATE_ASSIGNMENT_SURFACE,
    data,
  }, 20000);
}

export function validateDurationSurface(data: Record<string, unknown> = {}) {
  return requestExtensionApply({
    type: ISGVIZYON_VALIDATE_DURATION_SURFACE,
    data,
  }, 20000);
}
