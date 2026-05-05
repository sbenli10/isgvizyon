export type SubscriptionStatus = "trial" | "free" | "premium" | "cancelled" | "past_due";
export type SubscriptionPlan = "free" | "premium" | "osgb";
export type BillingPeriod = "monthly" | "yearly";

export type FeatureKey =
  | "companies.count"
  | "employees.count"
  | "risk_assessments.count"
  | "inspections.count_monthly"
  | "capa.count"
  | "bulk_capa.access"
  | "reports.export_monthly"
  | "ai.risk_generation_monthly"
  | "ai.bulk_capa_analysis_monthly"
  | "ai.nace_analysis_monthly"
  | "ai.evacuation_plan_monthly"
  | "ai.evacuation_image_monthly"
  | "blueprint_analyzer.access"
  | "adep.count"
  | "annual_plans.count"
  | "periodic_controls.count"
  | "ppe.count"
  | "health_surveillance.count"
  | "certificates.monthly"
  | "isg_bot.access"
  | "form_builder.access"
  | "board_meetings.count"
  | "assignment_letters.count"
  | "osgb.access"
  | "storage.upload_mb_monthly"
  | "team.members";

export interface SubscriptionFeatures {
  maxCompanies: number | null;
  maxEmployees: number | null;
  aiRiskAnalysis: boolean;
  pdfExport: boolean;
  excelExport: boolean;
  prioritySupport: boolean;
}

export interface SubscriptionFeatureEntitlement {
  featureKey: FeatureKey | string;
  isEnabled: boolean;
  limitValue: number | null;
  period: "monthly" | "lifetime" | null;
  currentUsage: number;
  currentValue: number;
  allowed: boolean;
}

export interface BillingCatalogPlan {
  planCode: SubscriptionPlan | string;
  planName: string;
  description: string;
  price: number | null;
  currency: string;
  billingPeriod: BillingPeriod;
  isCurrent: boolean;
  features: Array<{
    featureKey: FeatureKey | string;
    isEnabled: boolean;
    limitValue: number | null;
    period: "monthly" | "lifetime" | null;
  }>;
}

export interface BillingOverview {
  organizationId: string;
  isOrganizationAdmin: boolean;
  planCode: SubscriptionPlan | string;
  planName: string;
  status: "active" | "trialing" | "canceled" | "past_due" | string;
  description: string;
  price: number | null;
  currency: string;
  billingPeriod: BillingPeriod;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  daysLeftInTrial: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  hasStripeCustomer: boolean;
  hasStripeSubscription: boolean;
  canStartTrial: boolean;
  entitlements: SubscriptionFeatureEntitlement[];
  plans: BillingCatalogPlan[];
}

export interface BillingHistory {
  id: string;
  user_id: string;
  organization_id?: string | null;
  plan_name: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed" | "refunded" | string;
  invoice_url: string | null;
  billing_date: string;
  period_start: string;
  period_end: string;
  payment_method: string | null;
  provider?: string | null;
  provider_reference?: string | null;
}

export interface UserSession {
  id: string;
  user_id: string;
  device_name: string;
  device_type: "windows" | "macos" | "linux" | "android" | "ios" | "web";
  browser: string | null;
  ip_address: string | null;
  user_agent: string | null;
  last_activity: string;
  created_at: string;
  is_current: boolean;
}
