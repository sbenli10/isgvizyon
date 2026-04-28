export type SupabaseServiceIncident = {
  unavailable: boolean;
  title: string;
  description: string;
  action: string;
  statusCode?: number;
  source?: string;
  updatedAt: number;
};

type Listener = (incident: SupabaseServiceIncident) => void;

const DEFAULT_INCIDENT: SupabaseServiceIncident = {
  unavailable: false,
  title: "",
  description: "",
  action: "",
  updatedAt: 0,
};

let incidentState: SupabaseServiceIncident = DEFAULT_INCIDENT;
const listeners = new Set<Listener>();

const SERVICE_DOWN_STATUSES = new Set([500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526]);

function emit(next: SupabaseServiceIncident) {
  incidentState = next;
  listeners.forEach((listener) => listener(next));
}

export function getSupabaseIncident() {
  return incidentState;
}

export function subscribeSupabaseIncident(listener: Listener) {
  listeners.add(listener);
  listener(incidentState);
  return () => {
    listeners.delete(listener);
  };
}

export function reportSupabaseIncident(input: {
  source?: string;
  statusCode?: number;
  description?: string;
}) {
  const title = "Sistem geçici bakımda veya veri servisi yanıt vermiyor";
  const description =
    input.description ||
    "Uygulamanın veri aldığı Supabase servisleri şu anda sağlıklı yanıt vermiyor. Bu nedenle kayıtlar, oturum yenileme ve rapor ekranları geçici olarak açılamayabilir.";

  emit({
    unavailable: true,
    title,
    description,
    action: "Birkaç dakika sonra tekrar deneyin. Sorun sürerse Supabase proje sağlığını ve servis durumunu kontrol edin.",
    statusCode: input.statusCode,
    source: input.source,
    updatedAt: Date.now(),
  });
}

export function clearSupabaseIncident() {
  if (!incidentState.unavailable) return;
  emit({
    ...DEFAULT_INCIDENT,
    updatedAt: Date.now(),
  });
}

export function isSupabaseServiceError(statusCode?: number) {
  return typeof statusCode === "number" && SERVICE_DOWN_STATUSES.has(statusCode);
}

export function isSupabaseNetworkFailure(error: unknown) {
  const text = String((error as { message?: string })?.message || error || "").toLowerCase();
  return (
    text.includes("failed to fetch") ||
    text.includes("load failed") ||
    text.includes("networkerror") ||
    text.includes("network request failed") ||
    text.includes("err_failed") ||
    text.includes("cors") ||
    text.includes("timeout")
  );
}

export function isSupabaseUrl(value: string) {
  return value.includes(".supabase.co/");
}
