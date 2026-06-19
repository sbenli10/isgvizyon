import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Minus, ShieldCheck, Sparkles, Users, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LandingLayout } from "@/components/marketing/LandingLayout";
import {
  pricingComparisonRows,
  pricingPlans,
  type PricingComparisonValue,
  type PricingPlan,
} from "@/lib/pricingCatalog";
import { supabase } from "@/integrations/supabase/client";

type FeatureStatus = "included" | "limited" | "excluded" | "custom";

type PlanPriceRow = {
  plan_code: string | null;
  code?: string | null;
  price: number | string | null;
  currency: string | null;
  billing_period: string | null;
};

type PlanPriceMap = Record<string, { price: number; currency: string; billingPeriod: string }>;

const planAccent = {
  Ücretsiz: {
    icon: ShieldCheck,
    labelClass: "bg-slate-100 text-slate-700",
    dotClass: "bg-slate-500",
    buttonClass: "bg-slate-950 text-white hover:bg-slate-800",
  },
  Premium: {
    icon: Sparkles,
    labelClass: "bg-violet-50 text-violet-700",
    dotClass: "bg-violet-500",
    buttonClass: "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-500 hover:to-fuchsia-400",
  },
  OSGB: {
    icon: Users,
    labelClass: "bg-white/10 text-white",
    dotClass: "bg-cyan-300",
    buttonClass: "bg-gradient-to-r from-cyan-400 to-blue-500 text-white hover:from-cyan-300 hover:to-blue-400",
  },
} satisfies Record<PricingPlan["title"], { icon: typeof ShieldCheck; labelClass: string; dotClass: string; buttonClass: string }>;

function formatCurrencyPrice(price: number, currency: string) {
  const normalizedCurrency = currency || "TRY";
  if (normalizedCurrency === "TRY") {
    return `₺${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(price)}`;
  }
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: normalizedCurrency,
    maximumFractionDigits: 0,
  }).format(price);
}

function getPeriodLabel(period: string, fallback: string) {
  if (period === "monthly") return "/ ay";
  if (period === "yearly") return "/ yıl";
  return fallback;
}

function getFeatureStatus(value: PricingComparisonValue): FeatureStatus {
  if (value === "Var" || value === "Sınırsız") return "included";
  if (value === "Kısıtlı") return "limited";
  if (value === "Yok") return "excluded";
  return "custom";
}

function PlanFeatureItem({
  label,
  value,
  featured,
}: {
  label: string;
  value: PricingComparisonValue;
  featured: boolean;
}) {
  const status = getFeatureStatus(value);
  const textClass = featured ? "text-white" : "text-slate-950";
  const mutedClass = featured ? "text-slate-300" : "text-slate-600";

  if (status === "included") {
    return (
      <li className={`flex items-start gap-3 text-sm ${textClass}`}>
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        <span className="font-semibold">{label}</span>
      </li>
    );
  }

  if (status === "limited") {
    return (
      <li className={`flex items-start gap-3 text-sm ${textClass}`}>
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <span className="font-semibold">{label} ({value})</span>
      </li>
    );
  }

  if (status === "excluded") {
    return (
      <li className={`flex items-start gap-3 text-sm ${mutedClass}`}>
        <Minus className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="line-through decoration-slate-300">{label}</span>
      </li>
    );
  }

  return (
    <li className={`flex items-start gap-3 text-sm ${textClass}`}>
      <Zap className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
      <span>
        <span className="font-semibold">{label}</span>
        <span className={`ml-2 ${mutedClass}`}>({value})</span>
      </span>
    </li>
  );
}

function ComparisonPill({ value }: { value: PricingComparisonValue }) {
  const status = getFeatureStatus(value);

  if (status === "included") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-slate-950">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        {value}
      </span>
    );
  }

  if (status === "limited") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-slate-950">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        {value}
      </span>
    );
  }

  if (status === "excluded") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-950">
        <Minus className="h-3.5 w-3.5 text-slate-500" />
        Yok
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-slate-950">
      {value}
    </span>
  );
}

function getPlanValues(planTitle: PricingPlan["title"]) {
  return pricingComparisonRows.map((row) => ({
    label: row.feature,
    value: planTitle === "Ücretsiz" ? row.free : planTitle === "Premium" ? row.premium : row.osgb,
  }));
}

export default function LandingPricing() {
  const navigate = useNavigate();
  const [planPrices, setPlanPrices] = useState<PlanPriceMap>({});

  useEffect(() => {
    let isMounted = true;

    async function loadPublicPlanPrices() {
      const { data, error } = await (supabase as any)
        .from("subscription_plans")
        .select("plan_code, code, price, currency, billing_period")
        .eq("is_active", true)
        .in("plan_code", ["free", "premium", "osgb"]);

      if (error || !isMounted) return;

      const nextPrices: PlanPriceMap = {};
      for (const row of (data ?? []) as PlanPriceRow[]) {
        const code = row.plan_code ?? row.code;
        const numericPrice = typeof row.price === "string" ? Number(row.price) : row.price;
        if (!code || numericPrice === null || Number.isNaN(numericPrice)) continue;
        nextPrices[code] = {
          price: numericPrice,
          currency: row.currency ?? "TRY",
          billingPeriod: row.billing_period ?? "monthly",
        };
      }

      setPlanPrices(nextPrices);
    }

    void loadPublicPlanPrices();
    return () => {
      isMounted = false;
    };
  }, []);

  const displayPlans = useMemo(
    () =>
      pricingPlans.map((plan) => {
        const code = plan.title === "Ücretsiz" ? "free" : plan.title === "Premium" ? "premium" : "osgb";
        const dbPrice = planPrices[code];
        if (!dbPrice) return plan;
        return {
          ...plan,
          price: formatCurrencyPrice(dbPrice.price, dbPrice.currency),
          period: code === "free" && dbPrice.price === 0 ? "/ sınırsız süre" : getPeriodLabel(dbPrice.billingPeriod, plan.period),
        };
      }),
    [planPrices],
  );

  return (
    <LandingLayout
      eyebrow="Fiyatlandırma"
      title="İhtiyacınıza uygun akıllı fiyatlandırma"
      description="ISGVizyon'u ekip büyüklüğünüze, saha operasyonlarınıza ve OSGB süreçlerinize göre seçin. OSGB paketi çoklu firma yönetimi için öne çıkarıldı."
    >
      <section className="text-center text-slate-950">
        <h2 className="text-3xl font-black tracking-[-0.05em] text-slate-950 md:text-5xl">
          Paketler ve Özellikler
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-sm font-medium leading-8 text-slate-950 md:text-base">
          Risk analizi, eğitim, sertifika, doküman, AI ve OSGB operasyonlarını tek panelde yönetmek için size uygun paketi seçin.
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-3 xl:items-stretch">
        {displayPlans.map((plan) => {
          const featured = plan.title === "OSGB";
          const accent = planAccent[plan.title];
          const Icon = accent.icon;
          const featureValues = getPlanValues(plan.title).slice(0, 8);

          return (
            <article
              key={plan.title}
              className={[
                "relative flex min-h-[620px] flex-col overflow-hidden rounded-[30px] border p-6 transition-all duration-300 hover:-translate-y-1",
                featured
                  ? "border-slate-800 bg-slate-900 text-white shadow-[0_28px_90px_rgba(15,23,42,0.22)]"
                  : "border-slate-200 bg-white text-slate-950 shadow-[0_18px_55px_rgba(15,23,42,0.08)]",
              ].join(" ")}
            >
              {featured ? (
                <div className="absolute inset-x-0 top-0 flex justify-center">
                  <Badge className="mt-[-1px] rounded-b-2xl rounded-t-none border-0 bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-2 text-xs font-black text-white shadow-lg">
                    Öne Çıkan OSGB Paketi
                  </Badge>
                </div>
              ) : plan.badge ? (
                <div className="absolute inset-x-0 top-0 flex justify-center">
                  <Badge className="mt-[-1px] rounded-b-2xl rounded-t-none border-0 bg-blue-600 px-5 py-2 text-xs font-black text-white shadow-lg">
                    {plan.badge}
                  </Badge>
                </div>
              ) : null}

              <div className="pt-7">
                <div className={`flex h-11 items-center justify-center rounded-2xl px-4 text-base font-black ${accent.labelClass}`}>
                  {plan.title}
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <div
                    className={[
                      "flex h-11 w-11 items-center justify-center rounded-2xl border",
                      featured ? "border-white/10 bg-white/10 text-cyan-200" : "border-slate-200 bg-white text-slate-950",
                    ].join(" ")}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${featured ? "text-slate-200" : "text-slate-950"}`}>{plan.audience}</p>
                    <p className={`mt-1 text-xs font-semibold ${featured ? "text-cyan-200" : "text-slate-700"}`}>{plan.badge}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-end gap-2">
                    <p className={`text-5xl font-black tracking-[-0.07em] ${featured ? "text-white" : "text-slate-950"}`}>
                      {plan.price}
                    </p>
                    <span className={`pb-2 text-sm font-semibold ${featured ? "text-slate-300" : "text-slate-700"}`}>
                      {plan.period}
                    </span>
                  </div>
                  <p className={`mt-3 min-h-[92px] text-sm font-medium leading-7 ${featured ? "text-slate-200" : "text-slate-950"}`}>
                    {plan.description}
                  </p>
                </div>               
              </div>

              <div className="mt-7 flex-1">
                <p className={`text-sm font-black underline underline-offset-4 ${featured ? "text-white" : "text-slate-950"}`}>
                  Paket özellikleri:
                </p>
                <ul className="mt-5 space-y-4">
                  {plan.bullets.map((bullet) => (
                    <li key={bullet} className={`flex items-start gap-3 text-sm font-semibold ${featured ? "text-white" : "text-slate-950"}`}>
                      <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${accent.dotClass}`} />
                      {bullet}
                    </li>
                  ))}
                </ul>

                <div className={`mt-6 rounded-[22px] border p-4 ${featured ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}>
                  <ul className="space-y-3">
                    {featureValues.map((feature) => (
                      <PlanFeatureItem
                        key={`${plan.title}-${feature.label}`}
                        label={feature.label}
                        value={feature.value}
                        featured={featured}
                      />
                    ))}
                  </ul>
                </div>
              </div>

              <button
                type="button"
                className={`mt-7 h-12 rounded-2xl px-5 text-sm font-black shadow-lg transition ${accent.buttonClass}`}
                onClick={() => navigate("/auth")}
              >
                {plan.cta}
              </button>
            </article>
          );
        })}
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-950">Plan Karşılaştırması</p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950 md:text-3xl">
              Tüm özellikleri plan bazında net görün
            </h2>
          </div>
          <p className="max-w-2xl text-sm font-medium leading-7 text-slate-950">
            Premium gelişmiş bireysel kullanım, OSGB ise Premium + çoklu firma operasyon katmanıdır.
          </p>
        </div>

        <div className="mt-8 overflow-hidden rounded-[28px] border border-slate-200">
          <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr] border-b border-slate-200 bg-slate-50 md:grid">
            <div className="px-5 py-4 text-sm font-black text-slate-950">Özellik</div>
            <div className="px-5 py-4 text-sm font-black text-slate-950">Ücretsiz</div>
            <div className="px-5 py-4 text-sm font-black text-slate-950">Premium</div>
            <div className="px-5 py-4 text-sm font-black text-slate-950">OSGB</div>
          </div>

          <div className="divide-y divide-slate-200">
            {pricingComparisonRows.map((row) => (
              <div key={row.feature} className="grid gap-4 bg-white px-5 py-5 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:items-center">
                <div className="text-sm font-bold text-slate-950">{row.feature}</div>
                <div className="flex items-center justify-between gap-3 md:block">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-950 md:hidden">Ücretsiz</span>
                  <ComparisonPill value={row.free} />
                </div>
                <div className="flex items-center justify-between gap-3 md:block">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-950 md:hidden">Premium</span>
                  <ComparisonPill value={row.premium} />
                </div>
                <div className="flex items-center justify-between gap-3 md:block">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-950 md:hidden">OSGB</span>
                  <ComparisonPill value={row.osgb} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
