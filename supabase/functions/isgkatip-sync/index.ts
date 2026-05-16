import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompanyData {
  sgkNo: string;
  companyName: string;
  employeeCount?: number;
  hazardClass?: string;
  naceCode?: string | null;
  contractStart?: string | null;
  contractEnd?: string | null;
  assignedMinutes?: number;
  requiredMinutes?: number | null;
}

interface AuthContext {
  organizationId: string;
  userId: string;
}

interface SyncSummary {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

interface SyncResult {
  success: boolean;
  operation: "inserted" | "updated" | "skipped";
  company: Record<string, unknown>;
}

interface StatusError extends Error {
  status?: number;
}

serve(async (req: Request) => {
  const requestUrl = req.url;
  const requestMethod = req.method;
  
  console.log(`[ISG-KATIP-SYNC] [REQUEST_START] Metot: ${requestMethod} | URL: ${requestUrl}`);

  if (requestMethod === "OPTIONS") {
    console.log("[ISG-KATIP-SYNC] [CORS_OPTIONS] OPTIONS isteği alındı, CORS başlıkları dönülüyor.");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    console.log("[ISG-KATIP-SYNC] [ENV_CHECK] Ortam değişkenleri başarıyla okundu.");

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    
    // Yetkilendirme bağlamını doğrula ve logla
    console.log("[ISG-KATIP-SYNC] [AUTH_INIT] Kullanıcı kimlik doğrulama adımı başlatılıyor...");
    const authContext = await requireAuthContext(req, supabaseUrl, anonKey, serviceClient);
    console.log(`[ISG-KATIP-SYNC] [AUTH_SUCCESS] Kullanıcı doğrulandı. UserID: ${authContext.userId} | OrgID: ${authContext.organizationId}`);

    // Gelen JSON gövdesini oku
    const body = await req.json();
    const { action, data } = body;
    console.log(`[ISG-KATIP-SYNC] [ACTION_RECEIVED] Tetiklenen Aksiyon: "${action}"`);

    let response;
    switch (action) {
      case "SYNC_COMPANY":
        console.log("[ISG-KATIP-SYNC] [ROUTING] " + action + " işlemine yönlendiriliyor.");
        response = await syncCompany(serviceClient, authContext, data);
        break;
      case "BATCH_SYNC":
        console.log("[ISG-KATIP-SYNC] [ROUTING] " + action + " işlemine yönlendiriliyor. Firma adedi: " + (data?.companies?.length || 0));
        response = await batchSyncCompanies(serviceClient, authContext, data);
        break;
      case "GET_COMPANIES":
        console.log("[ISG-KATIP-SYNC] [ROUTING] " + action + " işlemine yönlendiriliyor.");
        response = await getCompanies(serviceClient, authContext, data?.filters || {});
        break;
      case "PULL_REMOTE_AND_SYNC":
        console.log("[ISG-KATIP-SYNC] [ROUTING] " + action + " işlemine yönlendiriliyor.");
        response = await pullRemoteAndSync(serviceClient, authContext, data || {});
        break;
      case "GET_CHANGE_TRACKING":
        console.log("[ISG-KATIP-SYNC] [ROUTING] " + action + " işlemine yönlendiriliyor.");
        response = await getChangeTracking(serviceClient, authContext);
        break;
      default:
        console.error(`[ISG-KATIP-SYNC] [ROUTING_ERROR] Bilinmeyen aksiyon talebi: ${action}`);
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`[ISG-KATIP-SYNC] [REQUEST_SUCCESS] Aksiyon "${action}" başarıyla tamamlandı. Yanıt gönderiliyor.`);
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const err = error as StatusError;
    console.error(`[ISG-KATIP-SYNC] [CRITICAL_EXCEPTION] Hata Yakalandı! Mesaj: ${err.message} | HTTP Status: ${err?.status || 500}`);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Unknown error",
      }),
      {
        status: err?.status || 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

async function requireAuthContext(
  req: Request, 
  _supabaseUrl: string, 
  _anonKey: string, 
  serviceClient: SupabaseClient
): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization");
  
  // 401 hatasını yakalamak için başlığı detaylıca loglayalım
  if (!authHeader) {
    console.error("[ISG-KATIP-SYNC] [AUTH_FAIL] İstek başlığında (Headers) 'Authorization' alanı bulunamadı! İstemci token göndermiyor.");
    const error = new Error("Yetkisiz istek. Authorization başlığı eksik.") as StatusError;
    error.status = 401;
    throw error;
  }

  if (!authHeader.startsWith("Bearer ")) {
    console.error(`[ISG-KATIP-SYNC] [AUTH_FAIL] Authorization başlığı 'Bearer ' ile başlamıyor! Gelen değer: "${authHeader.substring(0, 15)}..."`);
    const error = new Error("Yetkisiz istek. Geçersiz token formatı.") as StatusError;
    error.status = 401;
    throw error;
  }

  console.log("[ISG-KATIP-SYNC] [AUTH_TOKEN_CHECK] Token başlığı mevcut. Supabase Auth doğrulaması başlatılıyor...");

  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) {
    console.error("[ISG-KATIP-SYNC] [AUTH_FAIL] Bearer token boÅŸ geldi.");
    const error = new Error("Yetkisiz istek. Token boÅŸ.") as StatusError;
    error.status = 401;
    throw error;
  }

  const {
    data: { user },
    error: authError,
  } = await serviceClient.auth.getUser(accessToken);

  if (authError || !user) {
    console.error("[ISG-KATIP-SYNC] [AUTH_FAIL] Supabase auth.getUser() başarısız oldu veya oturum geçersiz.", authError);
    const error = new Error("ISGVizyon oturumu doğrulanamadı veya süresi doldu.") as StatusError;
    error.status = 401;
    throw error;
  }

  console.log(`[ISG-KATIP-SYNC] [AUTH_USER_OK] Kullanıcı oturumu geçerli. UID: ${user.id}. Profil organizasyon verisi sorgulanıyor...`);

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error(`[ISG-KATIP-SYNC] [DB_ERROR] 'profiles' tablosundan organization_id okunurken hata oluştu:`, profileError);
    throw profileError;
  }

  const organizationId =
    profile?.organization_id ||
    user.user_metadata?.organization_id ||
    user.app_metadata?.organization_id ||
    null;

  if (!organizationId) {
    console.error(`[ISG-KATIP-SYNC] [AUTH_FORBIDDEN] Kullanıcı sisteme giriş yaptı fakat herhangi bir organizasyon (organization_id) bağı bulunamadı!`);
    const error = new Error("Kullanıcı için organization_id bulunamadı.") as StatusError;
    error.status = 403;
    throw error;
  }

  return {
    organizationId,
    userId: user.id,
  };
}

function normalizeHazardClass(value?: string | null): string {
  const normalized = String(value || "Az Tehlikeli").toLocaleLowerCase("tr-TR");
  if (normalized.includes("çok") || normalized.includes("cok")) return "Çok Tehlikeli";
  if (normalized.includes("tehlikeli")) return "Tehlikeli";
  return "Az Tehlikeli";
}

function normalizeInteger(value: unknown, fallback = 0): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeDate(value?: string | null): string | null {
  if (!value) return null;

  const trimmed = String(value).trim();
  const trDate = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (trDate) {
    const [, day, month, year] = trDate;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toISOString().split("T")[0];
}

function calculateRequiredMinutes(employeeCount: number, hazardClass: string): number {
  const normalizedHazard = normalizeHazardClass(hazardClass);
  let perEmployee = 10;
  if (normalizedHazard === "Çok Tehlikeli") perEmployee = 30;
  else if (normalizedHazard === "Tehlikeli") perEmployee = 20;
  return Math.max(0, employeeCount) * perEmployee;
}

function calculateComplianceStatus(assignedMinutes: number, requiredMinutes: number): string {
  if (!requiredMinutes || requiredMinutes <= 0) return "UNKNOWN";
  if (assignedMinutes >= requiredMinutes) return "COMPLIANT";
  if (assignedMinutes >= requiredMinutes * 0.8) return "WARNING";
  return "CRITICAL";
}

function calculateRiskScore(company: Record<string, unknown>): number {
  let score = 45;
  const hazardClass = normalizeHazardClass(String(company.hazard_class || "Az Tehlikeli"));
  const employeeCount = normalizeInteger(company.employee_count, 0);
  const assignedMinutes = normalizeInteger(company.assigned_minutes, 0);
  const requiredMinutes = normalizeInteger(company.required_minutes, 0);
  const complianceStatus = calculateComplianceStatus(assignedMinutes, requiredMinutes);

  if (hazardClass === "Çok Tehlikeli") score += 25;
  else if (hazardClass === "Tehlikeli") score += 12;

  if (employeeCount >= 100) score += 10;
  else if (employeeCount >= 50) score += 5;

  if (complianceStatus === "CRITICAL") score += 20;
  else if (complianceStatus === "WARNING") score += 10;

  return Math.min(score, 100);
}

function buildCompanyPayload(authContext: AuthContext, company: CompanyData) {
  const employeeCount = normalizeInteger(company.employeeCount, 0);
  const assignedMinutes = normalizeInteger(company.assignedMinutes, 0);
  const hazardClass = normalizeHazardClass(company.hazardClass);
  const requiredMinutes =
    company.requiredMinutes == null
      ? calculateRequiredMinutes(employeeCount, hazardClass)
      : normalizeInteger(company.requiredMinutes, calculateRequiredMinutes(employeeCount, hazardClass));

  return {
    org_id: authContext.organizationId,
    user_id: authContext.userId,
    sgk_no: String(company.sgkNo || "").trim(),
    company_name: String(company.companyName || "").trim(),
    employee_count: employeeCount,
    hazard_class: hazardClass,
    nace_code: company.naceCode ? String(company.naceCode).trim() : null,
    contract_start: normalizeDate(company.contractStart),
    contract_end: normalizeDate(company.contractEnd),
    assigned_minutes: assignedMinutes,
    required_minutes: requiredMinutes,
    compliance_status: calculateComplianceStatus(assignedMinutes, requiredMinutes),
    risk_score: calculateRiskScore({
      employee_count: employeeCount,
      hazard_class: hazardClass,
      assigned_minutes: assignedMinutes,
      required_minutes: requiredMinutes,
    }),
    last_synced_at: new Date().toISOString(),
    is_deleted: false,
    deleted_at: null,
  };
}

async function findExistingCompany(
  supabase: SupabaseClient, 
  authContext: AuthContext, 
  payload: ReturnType<typeof buildCompanyPayload>
) {
  const bySgk = payload.sgk_no
    ? await supabase
        .from("isgkatip_companies")
        .select("*")
        .eq("org_id", authContext.organizationId)
        .eq("sgk_no", payload.sgk_no)
        .maybeSingle()
    : null;

  if (bySgk?.error) throw bySgk.error;
  if (bySgk?.data) return bySgk.data;

  const byName = await supabase
    .from("isgkatip_companies")
    .select("*")
    .eq("org_id", authContext.organizationId)
    .eq("company_name", payload.company_name)
    .maybeSingle();

  if (byName.error) throw byName.error;
  return byName.data || null;
}

function hasMeaningfulChange(existing: Record<string, unknown> | null, payload: ReturnType<typeof buildCompanyPayload>) {
  if (!existing) return true;

  const keys: Array<keyof typeof payload> = [
    "sgk_no",
    "company_name",
    "employee_count",
    "hazard_class",
    "nace_code",
    "contract_start",
    "contract_end",
    "assigned_minutes",
    "required_minutes",
    "compliance_status",
    "risk_score",
  ];

  return keys.some((key) => (existing?.[key] ?? null) !== (payload[key] ?? null));
}

async function syncCompany(supabase: SupabaseClient, authContext: AuthContext, incoming: CompanyData): Promise<SyncResult> {
  console.log(`[ISG-KATIP-SYNC] [syncCompany] Eşleştirme başlatıldı. SGK: ${incoming?.sgkNo || 'Eksik'} | Unvan: ${incoming?.companyName || 'Eksik'}`);
  
  if (!incoming?.sgkNo || !incoming?.companyName) {
    throw new Error("sgkNo ve companyName zorunludur.");
  }

  const payload = buildCompanyPayload(authContext, incoming);
  const existing = await findExistingCompany(supabase, authContext, payload);

  if (existing && !hasMeaningfulChange(existing, payload)) {
    console.log(`[ISG-KATIP-SYNC] [syncCompany] Değişiklik yok, veritabanı yazma adımı atlanıyor (Skipped). SGK: ${payload.sgk_no}`);
    await logAudit(supabase, authContext, {
      action: "SYNC_COMPANY_SKIPPED",
      source: "ISGKATIP_EXTENSION",
      details: {
        sgk_no: payload.sgk_no,
        company_name: payload.company_name,
      },
      status: "SUCCESS",
    });

    return {
      success: true,
      operation: "skipped",
      company: existing,
    };
  }

  const upsertPayload = existing ? { ...payload, id: existing.id } : payload;
  console.log(`[ISG-KATIP-SYNC] [syncCompany] Veritabanına yazılıyor (Upsert). İşlem Tipi: ${existing ? 'UPDATE' : 'INSERT'}`);

  const { data, error } = await supabase
    .from("isgkatip_companies")
    .upsert(upsertPayload, {
      onConflict: "org_id,sgk_no",
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) {
    console.error(`[ISG-KATIP-SYNC] [syncCompany] Tabloya yazılırken hata fırlatıldı:`, error);
    throw error;
  }

  console.log(`[ISG-KATIP-SYNC] [syncCompany] Uyum (Compliance) kontrolleri tetikleniyor... ID: ${data.id}`);
  await runComplianceCheck(supabase, data);
  
  await logAudit(supabase, authContext, {
    action: existing ? "SYNC_COMPANY_UPDATED" : "SYNC_COMPANY_CREATED",
    source: "ISGKATIP_EXTENSION",
    details: {
      sgk_no: payload.sgk_no,
      company_name: payload.company_name,
    },
    status: "SUCCESS",
    resourceId: data.id,
  });

  return {
    success: true,
    operation: existing ? "updated" : "inserted",
    company: data,
  };
}

async function batchSyncCompanies(supabase: SupabaseClient, authContext: AuthContext, data: Record<string, unknown>) {
  const companies = Array.isArray(data?.companies) ? data.companies : [];
  console.log(`[ISG-KATIP-SYNC] [batchSyncCompanies] Toplu senkronizasyon havuzu işleniyor. Toplam adet: ${companies.length}`);
  
  if (!companies.length) {
    throw new Error("Aktarılacak firma listesi boş.");
  }

  const results = [];
  const summary: SyncSummary = {
    total: companies.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  for (const company of companies) {
    try {
      const result = await syncCompany(supabase, authContext, company);
      results.push({
        sgkNo: company.sgkNo || null,
        companyName: company.companyName || null,
        operation: result.operation,
        success: true,
      });
      summary[result.operation] += 1;
    } catch (error) {
      const err = error as Error;
      console.error(`[ISG-KATIP-SYNC] [batchSyncCompanies] Firma döngüsünde hata! SGK: ${company?.sgkNo}`, err);
      results.push({
        sgkNo: company?.sgkNo || null,
        companyName: company?.companyName || null,
        success: false,
        error: err.message || "Unknown sync error",
      });
      summary.errors += 1;
    }
  }

  console.log(`[ISG-KATIP-SYNC] [batchSyncCompanies] Döngü bitti. Özet: Toplam=${summary.total}, Eklenen=${summary.inserted}, Güncellenen=${summary.updated}, Atlanan=${summary.skipped}, Hatalı=${summary.errors}`);

  const { error: logError } = await supabase.from("isgkatip_sync_logs").insert({
    org_id: authContext.organizationId,
    user_id: authContext.userId,
    action: "BATCH_SYNC",
    source: (data?.source as string) || "ISGKATIP_EXTENSION",
    total_companies: summary.total,
    success_count: summary.inserted + summary.updated,
    error_count: summary.errors,
    details: null,
    metadata: {
      inserted: summary.inserted,
      updated: summary.updated,
      skipped: summary.skipped,
      previewSummary: (data?.metadata as Record<string, unknown> | undefined)?.previewSummary || null,
    },
    status: summary.errors > 0 ? "PARTIAL" : "SUCCESS",
    resource_type: "isgkatip_company_batch",
    resource_id: null,
  });

  if (logError) {
    console.error("[ISG-KATIP-SYNC] [batchSyncCompanies] 'isgkatip_sync_logs' tablosuna log atılırken hata oluştu:", logError);
  }

  return {
    success: true,
    results,
    summary,
  };
}

async function getCompanies(supabase: SupabaseClient, authContext: AuthContext, filters: Record<string, unknown>) {
  console.log("[ISG-KATIP-SYNC] [getCompanies] Firma listeleme filtresi:", filters);
  let query = supabase
    .from("isgkatip_companies")
    .select("*")
    .eq("org_id", authContext.organizationId)
    .eq("is_deleted", false);

  if (filters?.complianceStatus) {
    query = query.eq("compliance_status", filters.complianceStatus);
  }

  if (filters?.hazardClass) {
    query = query.eq("hazard_class", filters.hazardClass);
  }

  const { data, error } = await query.order("company_name");
  if (error) throw error;

  return {
    success: true,
    companies: data || [],
    count: (data || []).length,
  };
}

function getComparableCompanyKey(row: Record<string, unknown>): string {
  return String(row.sgk_no || row.id || "").trim();
}

function getComparableValue(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (value === null || typeof value === "undefined" || value === "") return "-";
  return String(value);
}

function compareCompanySnapshots(currentRows: Array<Record<string, unknown>>, backupRows: Array<Record<string, unknown>>) {
  const previousByKey = new Map<string, Record<string, unknown>>();
  const sortedBackups = [...backupRows].sort((first, second) => {
    const firstTime = new Date(String(first.last_synced_at || first.updated_at || first.created_at || 0)).getTime();
    const secondTime = new Date(String(second.last_synced_at || second.updated_at || second.created_at || 0)).getTime();
    return secondTime - firstTime;
  });

  for (const row of sortedBackups) {
    const key = getComparableCompanyKey(row);
    if (key && !previousByKey.has(key)) previousByKey.set(key, row);
  }

  const currentByKey = new Map(
    currentRows
      .map((row) => [getComparableCompanyKey(row), row] as const)
      .filter(([key]) => Boolean(key)),
  );

  const watchedFields = [
    { key: "company_name", label: "Firma adı" },
    { key: "employee_count", label: "Çalışan sayısı" },
    { key: "hazard_class", label: "Tehlike sınıfı" },
    { key: "contract_start", label: "Sözleşme başlangıcı" },
    { key: "contract_end", label: "Sözleşme bitişi" },
    { key: "assigned_minutes", label: "Atanan süre" },
    { key: "required_minutes", label: "Gerekli süre" },
    { key: "nace_code", label: "NACE kodu" },
  ];

  const changes = [];

  for (const row of currentRows) {
    const key = getComparableCompanyKey(row);
    const previous = key ? previousByKey.get(key) : null;

    if (!previous) {
      changes.push({
        id: String(row.id || key),
        companyName: String(row.company_name || "Firma"),
        type: "added",
        summary: "Yeni firma eklendi",
        details: [
          `Çalışan: ${String(row.employee_count || 0)}`,
          `Tehlike sınıfı: ${String(row.hazard_class || "-")}`,
        ],
      });
      continue;
    }

    const details = watchedFields
      .map((field) => {
        const before = getComparableValue(previous, field.key);
        const after = getComparableValue(row, field.key);
        return before !== after ? `${field.label}: ${before} → ${after}` : null;
      })
      .filter(Boolean);

    if (details.length > 0) {
      changes.push({
        id: String(row.id || key),
        companyName: String(row.company_name || "Firma"),
        type: "updated",
        summary: `${details.length} alanda değişiklik var`,
        details,
      });
    }
  }

  for (const [key, previous] of previousByKey.entries()) {
    if (!currentByKey.has(key)) {
      changes.push({
        id: String(previous.id || key),
        companyName: String(previous.company_name || "Firma"),
        type: "removed",
        summary: "Firma son senkronda aktif listede görünmüyor",
        details: [
          `SGK: ${String(previous.sgk_no || "-")}`,
          `Son bilinen çalışan: ${String(previous.employee_count || 0)}`,
        ],
      });
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    hasBaseline: backupRows.length > 0,
    changes,
    currentCount: currentRows.length,
    previousCount: previousByKey.size,
  };
}

async function getChangeTracking(supabase: SupabaseClient, authContext: AuthContext) {
  console.log("[ISG-KATIP-SYNC] [getChangeTracking] Değişiklik izleme kuyruğu tetiklendi.");
  const { data: companies, error: companyError } = await supabase
    .from("isgkatip_companies")
    .select("id, company_name, sgk_no, last_synced_at, contract_start, contract_end, contract_status, risk_score, hazard_class, employee_count, nace_code, assigned_minutes, required_minutes")
    .eq("org_id", authContext.organizationId)
    .eq("is_deleted", false)
    .order("company_name", { ascending: true });

  if (companyError) throw companyError;

  const { data: backups, error: backupError } = await supabase
    .from("isgkatip_companies_backup")
    .select("*")
    .eq("org_id", authContext.organizationId);

  if (backupError) throw backupError;

  return {
    success: true,
    result: compareCompanySnapshots(companies || [], backups || []),
    companies: companies || [],
  };
}

async function runComplianceCheck(supabase: SupabaseClient, company: Record<string, unknown>) {
  const flags = [];
  const assigned = normalizeInteger(company.assigned_minutes, 0);
  const required = normalizeInteger(company.required_minutes, 0);
  const employeeCount = normalizeInteger(company.employee_count, 0);

  if (assigned < required * 0.9) {
    flags.push({
      rule_name: "DURATION_CHECK",
      severity: "CRITICAL",
      message: `Eksik süre: ${required - assigned} dk/ay`,
      details: { required, assigned },
    });
  } else if (assigned < required) {
    flags.push({
      rule_name: "DURATION_CHECK",
      severity: "WARNING",
      message: "Sınır değerde süre ataması",
      details: { required, assigned },
    });
  }

  if (company.contract_end) {
    const daysUntil = getDaysUntil(String(company.contract_end));
    if (daysUntil < 0) {
      flags.push({
        rule_name: "CONTRACT_EXPIRY",
        severity: "CRITICAL",
        message: `Sözleşme ${Math.abs(daysUntil)} gün önce sona erdi`,
        details: { contract_end: company.contract_end },
      });
    } else if (daysUntil <= 30) {
      flags.push({
        rule_name: "CONTRACT_EXPIRY",
        severity: "WARNING",
        message: `Sözleşme ${daysUntil} gün içinde sona erecek`,
        details: { contract_end: company.contract_end, days_until: daysUntil },
      });
    }
  }

  if (employeeCount >= 50) {
    flags.push({
      rule_name: "KURUL_OBLIGATION",
      severity: "INFO",
      message: "İSG Kurulu zorunluluğu var (50+ çalışan)",
      details: { employee_count: employeeCount },
    });
  }

  console.log(`[ISG-KATIP-SYNC] [runComplianceCheck] Saptanan Uyumsuzluk (Flag) adedi: ${flags.length}`);

  for (const flag of flags) {
    const { error: upsertError } = await supabase.from("isgkatip_compliance_flags").upsert(
      {
        org_id: String(company.org_id),
        company_id: String(company.id),
        rule_name: flag.rule_name,
        severity: flag.severity,
        message: flag.message,
        details: flag.details,
        status: "OPEN",
      },
      { onConflict: "company_id,rule_name,status", ignoreDuplicates: true },
    );
    if (upsertError) {
      console.error("[ISG-KATIP-SYNC] [runComplianceCheck] Compliance flag eklenirken hata:", upsertError);
    }
  }
}

async function logAudit(
  supabase: SupabaseClient, 
  authContext: AuthContext, 
  logData: {
    action: string;
    source: string;
    details: unknown;
    status: string;
    resourceId?: string | null;
  }
) {
  const { error } = await supabase.from("isgkatip_sync_logs").insert({
    org_id: authContext.organizationId,
    user_id: authContext.userId,
    action: logData.action,
    source: logData.source,
    total_companies: 1,
    success_count: 1,
    error_count: 0,
    details: logData.details,
    metadata: null,
    status: logData.status,
    resource_type: "isgkatip_company",
    resource_id: logData.resourceId || null,
  });
  if (error) {
    console.error("[ISG-KATIP-SYNC] [logAudit] Denetim günlüğü yazılamadı:", error);
  }
}

function getDaysUntil(dateString: string): number {
  const target = new Date(dateString);
  const now = new Date();
  return Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function firstDefined(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function normalizeRemoteCompany(row: Record<string, unknown>): CompanyData | null {
  const sgkNo = firstDefined(row.sgkNo, row.sgk_no, row.taxNo, row.tax_no, row.registration_no);
  const companyName = firstDefined(row.companyName, row.company_name, row.name, row.unvan);
  if (!sgkNo || !companyName) return null;

  return {
    sgkNo: String(sgkNo),
    companyName: String(companyName),
    employeeCount: normalizeInteger(firstDefined(row.employeeCount, row.employee_count, row.staffCount, row.staff_count), 0),
    hazardClass: String(firstDefined(row.hazardClass, row.hazard_class, row.dangerClass, row.danger_class) || "Az Tehlikeli"),
    contractStart: firstDefined(row.contractStart, row.contract_start, row.startDate, row.start_date) as string | null,
    contractEnd: firstDefined(row.contractEnd, row.contract_end, row.endDate, row.end_date) as string | null,
    assignedMinutes: normalizeInteger(firstDefined(row.assignedMinutes, row.assigned_minutes, row.serviceMinutes, row.service_minutes), 0),
    naceCode: firstDefined(row.naceCode, row.nace_code) as string | null,
  };
}

async function pullRemoteAndSync(supabase: SupabaseClient, authContext: AuthContext, data: Record<string, unknown>) {
  console.log("[ISG-KATIP-SYNC] [pullRemoteAndSync] Dış entegrasyon havuzu çekiliyor...");
  let query = supabase
    .from("osgb_external_integrations")
    .select("*")
    .eq("organization_id", authContext.organizationId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (data?.integrationId) {
    query = supabase
      .from("osgb_external_integrations")
      .select("*")
      .eq("organization_id", authContext.organizationId)
      .eq("id", data.integrationId)
      .limit(1);
  }

  const { data: integrations, error } = await query;
  if (error) throw error;
  const integration = integrations?.[0];
  if (!integration) throw new Error("Aktif dış kaynak entegrasyonu bulunamadı.");

  const remoteRows = await fetchRemoteCompanies(integration);
  const normalizedCompanies = remoteRows
    .map((row: unknown) => normalizeRemoteCompany(row as Record<string, unknown>))
    .filter(Boolean) as CompanyData[];

  if (!normalizedCompanies.length) {
    throw new Error("Dış kaynak yanıtında eşlenebilir firma kaydı bulunamadı.");
  }

  return batchSyncCompanies(supabase, authContext, {
    companies: normalizedCompanies,
    source: (data?.source as string) || (integration.integration_name as string) || "external_integration",
    metadata: {
      integrationId: integration.id,
    },
  });
}

async function fetchRemoteCompanies(integration: Record<string, unknown>) {
  const baseUrl = String(integration.base_url || "").replace(/\/+$/, "");
  const apiPath = String(integration.api_path || "/companies");
  const url = `${baseUrl}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;

  console.log(`[ISG-KATIP-SYNC] [fetchRemoteCompanies] İstek atılan uç nokta (Endpoint): ${url}`);

  const headers: Record<string, string> = { Accept: "application/json" };
  const authHeaderName = Deno.env.get("ISGKATIP_REMOTE_AUTH_HEADER") || "x-api-key";
  const apiKey = Deno.env.get("ISGKATIP_REMOTE_API_KEY");
  const bearerToken = Deno.env.get("ISGKATIP_REMOTE_BEARER");

  if (apiKey) headers[authHeaderName] = apiKey;
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
    console.error(`[ISG-KATIP-SYNC] [fetchRemoteCompanies] İstek başarısız oldu. Durum kodu: ${response.status}`);
    throw new Error(`Dış kaynak cevabı başarısız: ${response.status}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload)) return payload;
  if (integration.source_key && Array.isArray(payload?.[String(integration.source_key)])) {
    return payload[String(integration.source_key)];
  }
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.companies)) return payload.companies;
  return [];
}
