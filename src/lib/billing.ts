import { supabase } from "@/integrations/supabase/client";
import type { BillingCatalogPlan, BillingOverview, BillingPeriod, SubscriptionPlan } from "@/types/subscription";

interface EdgeBillingResponse {
  success?: boolean;
  url?: string;
  error?: {
    message?: string;
  };
}

type RawPlanFeature = {
  plan_code: string;
  feature_key: string;
  limit_value: number | null;
  is_enabled: boolean;
  period: "monthly" | "lifetime" | null;
};

type RawSubscriptionPlan = {
  plan_code: string;
  plan_name: string;
  price: number;
  currency: string | null;
  billing_period: string | null;
  is_active: boolean | null;
};

type StaticPlanFeature = BillingCatalogPlan["features"][number];

const premiumFeatureKeys: Array<StaticPlanFeature["featureKey"]> = [
  "bulk_capa.access",
  "blueprint_analyzer.access",
  "form_builder.access",
  "isg_bot.access",
];

const osgbFeatureKeys: Array<StaticPlanFeature["featureKey"]> = [
  "osgb.access",
];

function feature(
  featureKey: StaticPlanFeature["featureKey"],
  isEnabled: boolean,
  limitValue: number | null = null,
  period: StaticPlanFeature["period"] = null,
): StaticPlanFeature {
  return {
    featureKey,
    isEnabled,
    limitValue,
    period,
  };
}

function buildFreeFeatures(): StaticPlanFeature[] {
  return [
    feature("companies.count", true, 1, "lifetime"),
    feature("employees.count", true, 50, "lifetime"),
    feature("risk_assessments.count", true, 3, "lifetime"),
    feature("inspections.count_monthly", true, 5, "monthly"),
    feature("capa.count", true, 10, "lifetime"),
    feature("reports.export_monthly", true, 3, "monthly"),
    feature("adep.count", true, 1, "lifetime"),
    feature("annual_plans.count", true, 1, "lifetime"),
    feature("board_meetings.count", true, 2, "lifetime"),
    feature("periodic_controls.count", true, 10, "lifetime"),
    feature("ppe.count", true, 50, "lifetime"),
    feature("health_surveillance.count", true, 50, "lifetime"),
    feature("assignment_letters.count", true, 10, "lifetime"),
    feature("storage.upload_mb_monthly", true, 100, "monthly"),
    feature("team.members", true, 1, "lifetime"),
    feature("certificates.monthly", false, 0, "monthly"),
    feature("ai.risk_generation_monthly", false, 0, "monthly"),
    feature("ai.bulk_capa_analysis_monthly", false, 0, "monthly"),
    feature("ai.nace_analysis_monthly", false, 0, "monthly"),
    feature("ai.evacuation_plan_monthly", false, 0, "monthly"),
    feature("ai.evacuation_image_monthly", false, 0, "monthly"),
    ...premiumFeatureKeys.map((key) => feature(key, false)),
    ...osgbFeatureKeys.map((key) => feature(key, false)),
  ];
}

function buildPremiumFeatures(): StaticPlanFeature[] {
  return [
    feature("companies.count", true, 3, "lifetime"),
    feature("employees.count", true, null, "lifetime"),
    feature("risk_assessments.count", true, null, "lifetime"),
    feature("inspections.count_monthly", true, null, "monthly"),
    feature("capa.count", true, null, "lifetime"),
    feature("reports.export_monthly", true, 100, "monthly"),
    feature("certificates.monthly", true, 100, "monthly"),
    feature("ai.risk_generation_monthly", true, 100, "monthly"),
    feature("ai.bulk_capa_analysis_monthly", true, 100, "monthly"),
    feature("ai.nace_analysis_monthly", true, 100, "monthly"),
    feature("ai.evacuation_plan_monthly", true, 50, "monthly"),
    feature("ai.evacuation_image_monthly", true, 50, "monthly"),
    feature("adep.count", true, null, "lifetime"),
    feature("annual_plans.count", true, null, "lifetime"),
    feature("board_meetings.count", true, null, "lifetime"),
    feature("periodic_controls.count", true, null, "lifetime"),
    feature("ppe.count", true, null, "lifetime"),
    feature("health_surveillance.count", true, null, "lifetime"),
    feature("assignment_letters.count", true, null, "lifetime"),
    feature("storage.upload_mb_monthly", true, 2048, "monthly"),
    feature("team.members", true, 3, "lifetime"),
    ...premiumFeatureKeys.map((key) => feature(key, true)),
    ...osgbFeatureKeys.map((key) => feature(key, false)),
  ];
}

function buildOsgbFeatures(): StaticPlanFeature[] {
  return [
    ...buildPremiumFeatures()
      .filter((item) => !osgbFeatureKeys.includes(item.featureKey))
      .map((item) => ({ ...item, isEnabled: true, limitValue: null })),
    ...osgbFeatureKeys.map((key) => feature(key, true)),
  ];
}

function getFallbackPlanDescription(planCode: string) {
  if (planCode === "osgb") {
    return "Coklu firma, ekip yonetimi ve OSGB operasyonlari icin.";
  }

  if (planCode === "premium") {
    return "AI destekli profesyonel is guvenligi yonetimi icin.";
  }

  return "Temel kullanim ve kontrollu baslangic icin.";
}

function getStaticBillingCatalog(): BillingCatalogPlan[] {
  return [
    {
      planCode: "free",
      planName: "Free",
      description: getFallbackPlanDescription("free"),
      price: 0,
      currency: "TRY",
      billingPeriod: "monthly",
      isCurrent: true,
      features: buildFreeFeatures(),
    },
    {
      planCode: "premium",
      planName: "Premium",
      description: getFallbackPlanDescription("premium"),
      price: null,
      currency: "TRY",
      billingPeriod: "monthly",
      isCurrent: false,
      features: buildPremiumFeatures(),
    },
    {
      planCode: "osgb",
      planName: "OSGB",
      description: getFallbackPlanDescription("osgb"),
      price: null,
      currency: "TRY",
      billingPeriod: "monthly",
      isCurrent: false,
      features: buildOsgbFeatures(),
    },
  ];
}

function assertBillingOverview(payload: unknown): BillingOverview {
  if (!payload || typeof payload !== "object") {
    throw new Error("Abonelik bilgisi alinamadi.");
  }

  return payload as BillingOverview;
}

export async function getBillingOverview(): Promise<BillingOverview> {
  const { data, error } = await (supabase as any).rpc("get_my_billing_overview");

  if (error) {
    throw new Error(error.message || "Abonelik bilgileri getirilemedi.");
  }

  return assertBillingOverview(data);
}

export async function getBillingCatalog(): Promise<BillingCatalogPlan[]> {
  const [{ data: planRows, error: plansError }, { data: featureRows, error: featuresError }] = await Promise.all([
    (supabase as any)
      .from("subscription_plans")
      .select("plan_code, plan_name, price, currency, billing_period, is_active")
      .eq("is_active", true),
    (supabase as any)
      .from("plan_features")
      .select("plan_code, feature_key, limit_value, is_enabled, period"),
  ]);

  if (plansError) {
    return getStaticBillingCatalog();
  }

  const fallbackFeaturesByPlan = new Map(
    getStaticBillingCatalog().map((plan) => [plan.planCode, plan.features] as const),
  );

  const featuresByPlan = new Map<string, RawPlanFeature[]>();
  for (const row of (featureRows ?? []) as RawPlanFeature[]) {
    const entries = featuresByPlan.get(row.plan_code) ?? [];
    entries.push(row);
    featuresByPlan.set(row.plan_code, entries);
  }

  const orderedCodes = ["free", "premium", "osgb"];
  const rows = ((planRows ?? []) as RawSubscriptionPlan[]).sort((left, right) => {
    const leftIndex = orderedCodes.indexOf(left.plan_code);
    const rightIndex = orderedCodes.indexOf(right.plan_code);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.plan_name.localeCompare(right.plan_name, "tr");
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });

  const catalog = rows.map((row) => ({
    planCode: row.plan_code,
    planName: row.plan_name,
    description: getFallbackPlanDescription(row.plan_code),
    price: row.price,
    currency: row.currency ?? "TRY",
    billingPeriod: row.billing_period === "yearly" ? "yearly" : "monthly",
    isCurrent: row.plan_code === "free",
    features: featuresError
      ? fallbackFeaturesByPlan.get(row.plan_code) ?? []
      : (featuresByPlan.get(row.plan_code) ?? []).map((feature) => ({
          featureKey: feature.feature_key,
          isEnabled: feature.is_enabled,
          limitValue: feature.limit_value,
          period: feature.period,
        })),
  }));

  return catalog.length > 0 ? catalog : getStaticBillingCatalog();
}

export async function startPremiumTrial(): Promise<BillingOverview> {
  const { data, error } = await supabase.functions.invoke("billing-start-trial", {
    body: {},
  });
  const payload = (data ?? null) as
    | {
        success?: boolean;
        overview?: BillingOverview | null;
        error?: { message?: string };
      }
    | null;

  if (error) {
    let serverMessage = "";
    let requestId = "";

    const maybeContext = (error as { context?: unknown }).context;
    if (maybeContext instanceof Response) {
      try {
        const responsePayload = (await maybeContext.clone().json()) as {
          requestId?: string;
          error?: { message?: string };
          message?: string;
        };
        serverMessage = responsePayload.error?.message || responsePayload.message || "";
        requestId = responsePayload.requestId || "";
      } catch (parseError) {
        console.warn("billing-start-trial error response parse failed", parseError);
      }
    }

    const suffix = requestId ? ` (Log ID: ${requestId})` : "";
    throw new Error(`${serverMessage || error.message || "Deneme suresi baslatilamadi."}${suffix}`);
  }

  if (!payload?.success) {
    throw new Error(payload?.error?.message || "Deneme suresi baslatilamadi.");
  }

  return payload.overview ? assertBillingOverview(payload.overview) : ({} as BillingOverview);
}

export async function backfillMyFeatureUsage() {
  const { data, error } = await (supabase as any).rpc("backfill_my_feature_usage");

  if (error) {
    throw new Error(error.message || "Kullanim ozeti senkronize edilemedi.");
  }

  return data;
}

async function openBillingUrl(functionName: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  const payload = (data ?? null) as EdgeBillingResponse | null;

  if (error) {
    let serverMessage = "";
    const maybeContext = (error as { context?: unknown }).context;

    if (maybeContext instanceof Response) {
      try {
        const responsePayload = (await maybeContext.clone().json()) as EdgeBillingResponse | { message?: string };
        serverMessage =
          ("error" in responsePayload ? responsePayload.error?.message : undefined) ||
          ("message" in responsePayload ? responsePayload.message : undefined) ||
          "";
      } catch (parseError) {
        console.warn(`${functionName} error response parse failed`, parseError);
      }
    }

    throw new Error(serverMessage || error.message || "Ödeme servisine bağlanılamadı.");
  }

  if (!payload?.success || !payload.url) {
    throw new Error(payload?.error?.message || "Yönlendirme bağlantısı oluşturulamadı.");
  }

  window.location.assign(payload.url);
}

export type CheckoutPlanCode = Extract<SubscriptionPlan, "premium" | "osgb">;

export type ManualPaymentStatus = "awaiting_receipt" | "pending" | "approved" | "rejected" | "cancelled";

export type ManualPaymentInvoiceInfo = {
  invoiceType: "individual" | "corporate";
  title: string;
  taxOffice?: string;
  taxNumber?: string;
  identityNumber?: string;
  address: string;
  email: string;
  phone?: string;
};

export type BankTransferSettings = {
  providerCode?: string;
  providerName?: string;
  isEnabled?: boolean;
  mode?: string;
  paymentType?: string;
  accountHolder?: string;
  iban?: string;
  bankName?: string;
  instructions?: string;
  approvalSlaBusinessDays?: number;
};

export type ManualPaymentRequest = {
  id: string;
  referenceCode?: string;
  reference_code?: string;
  userId?: string;
  userEmail?: string | null;
  userName?: string | null;
  organizationId?: string | null;
  planCode?: CheckoutPlanCode;
  plan_code?: CheckoutPlanCode;
  billingPeriod?: BillingPeriod;
  billing_period?: BillingPeriod;
  amount: number;
  currency: string;
  status: ManualPaymentStatus;
  bankAccountSnapshot?: BankTransferSettings;
  bank_account_snapshot?: BankTransferSettings;
  invoiceInfo?: ManualPaymentInvoiceInfo;
  invoice_info?: ManualPaymentInvoiceInfo;
  receiptFilePath?: string | null;
  receipt_file_path?: string | null;
  receiptFileName?: string | null;
  receipt_file_name?: string | null;
  receiptUploadedAt?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  createdAt?: string | null;
  events?: Array<{
    id: string;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    note?: string | null;
    actorRole?: string | null;
    createdAt?: string | null;
  }>;
};

function normalizeStorageName(fileName: string) {
  const extension = fileName.includes(".") ? fileName.split(".").pop() : "bin";
  const base = fileName
    .replace(/\.[^/.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return `${base || "dekont"}.${extension || "bin"}`;
}

export async function getBankTransferSettings(): Promise<BankTransferSettings> {
  const { data, error } = await (supabase as any).rpc("get_public_bank_transfer_settings");

  if (error) {
    throw new Error(error.message || "Havale / EFT bilgileri alınamadı.");
  }

  return (data || {}) as BankTransferSettings;
}

export async function createManualBankTransferPaymentRequest(
  planCode: CheckoutPlanCode,
  period: BillingPeriod,
  invoiceInfo: ManualPaymentInvoiceInfo,
): Promise<{ request: ManualPaymentRequest; bank: BankTransferSettings; message: string }> {
  const { data, error } = await (supabase as any).rpc("create_manual_bank_transfer_payment_request", {
    p_plan_code: planCode,
    p_billing_period: period,
    p_invoice_info: invoiceInfo,
  });

  if (error) {
    throw new Error(error.message || "Havale / EFT ödeme kodu oluşturulamadı.");
  }

  const payload = (data || {}) as { request?: ManualPaymentRequest; bank?: BankTransferSettings; message?: string };
  if (!payload.request?.id) {
    throw new Error("Ödeme kodu oluşturuldu ancak kayıt bilgisi alınamadı.");
  }

  return {
    request: payload.request,
    bank: payload.bank || {},
    message: payload.message || "Ödeme onayı 1 iş günü içinde yapılır.",
  };
}

export async function attachManualPaymentReceipt(
  requestId: string,
  receiptFilePath: string,
  receiptFileName: string,
): Promise<{ request: ManualPaymentRequest; message: string }> {
  const { data, error } = await (supabase as any).rpc("attach_manual_payment_receipt", {
    p_request_id: requestId,
    p_receipt_file_path: receiptFilePath,
    p_receipt_file_name: receiptFileName,
  });

  if (error) {
    throw new Error(error.message || "Dekont ödeme talebine bağlanamadı.");
  }

  const payload = (data || {}) as { request?: ManualPaymentRequest; message?: string };
  if (!payload.request?.id) {
    throw new Error("Dekont alındı ancak ödeme talebi güncellenemedi.");
  }

  return {
    request: payload.request,
    message: payload.message || "Dekont alındı. Ödeme onayı 1 iş günü içinde yapılır.",
  };
}

export async function uploadManualPaymentReceipt(requestId: string, file: File): Promise<string> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (userError || !userId) {
    throw new Error("Dekont yüklemek için oturum açmanız gerekir.");
  }

  const filePath = `${userId}/${requestId}/${Date.now()}-${normalizeStorageName(file.name)}`;
  const { error } = await supabase.storage.from("manual-payment-receipts").upload(filePath, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (error) {
    throw new Error(error.message || "Dekont yüklenemedi.");
  }

  return filePath;
}

export async function submitManualPaymentReceipt(requestId: string, file: File) {
  const filePath = await uploadManualPaymentReceipt(requestId, file);
  return attachManualPaymentReceipt(requestId, filePath, file.name);
}

export async function getMyManualPaymentRequests(): Promise<ManualPaymentRequest[]> {
  const { data, error } = await (supabase as any).rpc("get_my_manual_payment_requests");

  if (error) {
    throw new Error(error.message || "Ödeme geçmişi alınamadı.");
  }

  return Array.isArray(data) ? (data as ManualPaymentRequest[]) : [];
}

export async function getPlatformAdminManualPaymentRequests(status: ManualPaymentStatus | "all" = "pending") {
  const { data, error } = await (supabase as any).rpc("get_platform_admin_manual_payment_requests", {
    p_status: status,
    p_limit: 150,
  });

  if (error) {
    throw new Error(error.message || "Manuel ödeme talepleri alınamadı.");
  }

  const payload = (data || {}) as { payments?: ManualPaymentRequest[]; error?: string };
  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload.payments || [];
}

export async function reviewManualPaymentRequest(requestId: string, decision: "approved" | "rejected", note = "") {
  const { data, error } = await (supabase as any).rpc("review_manual_payment_request", {
    p_request_id: requestId,
    p_decision: decision,
    p_note: note,
  });

  if (error) {
    throw new Error(error.message || "Ödeme talebi sonuçlandırılamadı.");
  }

  return data as { request?: ManualPaymentRequest };
}

export async function updateBankTransferSettings(settings: {
  accountHolder: string;
  iban: string;
  bankName?: string;
  instructions?: string;
}) {
  const { data, error } = await (supabase as any).rpc("update_platform_admin_bank_transfer_settings", {
    p_account_holder: settings.accountHolder,
    p_iban: settings.iban,
    p_bank_name: settings.bankName || "",
    p_instructions: settings.instructions || "Ödeme onayı 1 iş günü içinde yapılır.",
  });

  if (error) {
    throw new Error(error.message || "IBAN ayarları kaydedilemedi.");
  }

  return (data || {}) as BankTransferSettings;
}

export async function createManualPaymentReceiptSignedUrl(filePath: string) {
  const { data, error } = await supabase.storage.from("manual-payment-receipts").createSignedUrl(filePath, 60 * 5);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Dekont bağlantısı oluşturulamadı.");
  }

  return data.signedUrl;
}

export async function startPlanCheckout(planCode: CheckoutPlanCode, period: BillingPeriod) {
  await openBillingUrl("billing-checkout", {
    billingPeriod: period,
    planCode,
  });
}

export async function startPremiumCheckout(period: BillingPeriod) {
  await startPlanCheckout("premium", period);
}

export async function startOsgbCheckout(period: BillingPeriod) {
  await startPlanCheckout("osgb", period);
}

export async function openBillingPortal() {
  await openBillingUrl("billing-portal", {});
}
