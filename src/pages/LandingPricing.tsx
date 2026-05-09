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

function PlanFeatureItem({ label, value }: { label: string; value: PricingComparisonValue }) {
  const status = getFeatureStatus(value);

  if (status === "included") {
    return (
      <li className="flex items-start gap-3 text-sm text-slate-200">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        <span className="font-medium">{label}</span>
      </li>
    );
  }

  if (status === "limited") {
    return (
      <li className="flex items-start gap-3 text-sm text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <span className="font-medium">{label} ({value})</span>
      </li>
    );
  }

  if (status === "excluded") {
    return (
      <li className="flex items-start gap-3 text-sm text-slate-500">
        <Minus className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <span className="line-through decoration-slate-600/80">{label}</span>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 text-sm text-cyan-100">
      <Zap className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
      <span>
        <span className="font-medium">{label}</span>
        <span className="ml-2 text-cyan-200/90">({value})</span>
      </span>
    </li>
  );
}

function ComparisonPill({ value }: { value: PricingComparisonValue }) {
  const status = getFeatureStatus(value);

  if (status === "included") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {value}
      </span>
    );
  }

  if (status === "limited") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
        <AlertTriangle className="h-3.5 w-3.5" />
        {value}
      </span>
    );
  }

  if (status === "excluded") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-500/20 bg-slate-500/10 px-3 py-1 text-xs font-medium text-slate-300">
        <Minus className="h-3.5 w-3.5" />
        Yok
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
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

      if (error || !isMounted) {
        return;
      }

      const nextPrices: PlanPriceMap = {};
      for (const row of (data ?? []) as PlanPriceRow[]) {
        const code = row.plan_code ?? row.code;
        const numericPrice = typeof row.price === "string" ? Number(row.price) : row.price;

        if (!code || numericPrice === null || Number.isNaN(numericPrice)) {
          continue;
        }

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

        if (!dbPrice) {
          return plan;
        }

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
      title="İhtiyacınıza Uygun Akıllı Fiyatlandırma"
      description="İSGVizyon'u ekip büyüklüğünüze, saha operasyonlarınıza ve yapay zeka destekli analiz ihtiyaçlarınıza göre seçin."
    >
      <section className="relative overflow-hidden rounded-[34px] border border-cyan-400/14 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(11,31,58,0.68))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.28)] md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.10),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.12),transparent_36%)]" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-cyan-100">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              Yapay Zeka Destekli İSG Paketleri
            </Badge>
            <span className="text-sm text-slate-400">
              Deneme üyeliği otomatik başlamaz; kullanıcı Ana Panel'den 7 günlük Premium denemeyi kendisi başlatır.
            </span>
          </div>

          <div className="mt-6 max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-white md:text-5xl">
              İSG Süreçlerinizi Ölçeklendiren Paketler
            </h2>
            <p className="mt-4 text-sm leading-8 text-slate-300 md:text-base">
              Ücretsiz, Premium ve OSGB paketleri arasındaki tüm limitleri, açık modülleri ve kapalı özellikleri
              tek ekranda karşılaştırın. OSGB paketi Premium'un tüm özelliklerini içerir.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {displayPlans.map((plan, index) => (
          <article
            key={plan.title}
            className={[
              "relative flex h-full flex-col overflow-hidden rounded-[30px] border p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1",
              plan.recommended
                ? "border-cyan-400/30 bg-[linear-gradient(180deg,rgba(34,211,238,0.12),rgba(15,23,42,0.90))] shadow-[0_28px_90px_rgba(34,211,238,0.14)]"
                : "border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.72)]",
            ].join(" ")}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_34%)]" />

            {plan.recommended ? (
              <div className="absolute inset-x-0 top-0 flex justify-center">
                <Badge className="mt-3 rounded-full border border-cyan-300/30 bg-gradient-to-r from-cyan-400/90 to-blue-500/90 px-4 py-1 text-slate-950 shadow-[0_10px_30px_rgba(34,211,238,0.24)]">
                  En Popüler
                </Badge>
              </div>
            ) : null}

            <div className={`relative z-10 flex h-full flex-col ${plan.recommended ? "pt-8" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-cyan-200">
                    {index === 0 ? <ShieldCheck className="h-5 w-5" /> : index === 1 ? <Sparkles className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white">{plan.title}</h3>
                  <p className="mt-2 text-sm text-slate-400">{plan.audience}</p>
                </div>

                <Badge className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-200">
                  {plan.badge}
                </Badge>
              </div>

              <div className="mt-6">
                <div className="flex items-end gap-2">
                  <p className="text-4xl font-semibold tracking-[-0.06em] text-white">{plan.price}</p>
                  <span className="pb-1 text-sm text-slate-400">{plan.period}</span>
                </div>
                <p className="mt-3 min-h-[92px] text-sm leading-7 text-slate-300">{plan.description}</p>
              </div>

              <div className="mt-6 space-y-3 rounded-[22px] border border-white/10 bg-[#0B1F3A]/68 p-4">
                {plan.bullets.map((bullet) => (
                  <div key={bullet} className="text-sm leading-7 text-slate-300">
                    {bullet}
                  </div>
                ))}
              </div>

              <ul className="mt-6 max-h-[560px] space-y-3 overflow-y-auto pr-1">
                {getPlanValues(plan.title).map((feature) => (
                  <PlanFeatureItem key={`${plan.title}-${feature.label}`} label={feature.label} value={feature.value} />
                ))}
              </ul>

              <Button
                className={[
                  "mt-6 w-full rounded-2xl",
                  plan.recommended
                    ? "bg-gradient-to-r from-[#22D3EE] via-[#2563EB] to-[#5B7CFA] text-slate-950 hover:from-cyan-200 hover:via-blue-400 hover:to-indigo-300"
                    : "bg-white/[0.08] text-white hover:bg-white/[0.12]",
                ].join(" ")}
                onClick={() => navigate("/auth")}
              >
                {plan.cta}
              </Button>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-[32px] border border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.76)] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.24)] backdrop-blur-xl md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-300/80">Plan Karşılaştırması</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white md:text-3xl">
              Tüm özellikleri plan bazında net görün
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-slate-300">
            Bu tablo, veritabanındaki `plan_features` matrisiyle aynı iş kuralını takip eder: Free sınırlı,
            Premium gelişmiş bireysel kullanım, OSGB ise Premium + OSGB operasyonlarıdır.
          </p>
        </div>

        <div className="mt-8 overflow-hidden rounded-[28px] border border-white/10">
          <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr] border-b border-white/10 bg-[#0A1830]/92 md:grid">
            <div className="px-5 py-4 text-sm font-semibold text-slate-200">Özellik</div>
            <div className="px-5 py-4 text-sm font-semibold text-slate-100">Ücretsiz</div>
            <div className="px-5 py-4 text-sm font-semibold text-cyan-100">Premium</div>
            <div className="px-5 py-4 text-sm font-semibold text-slate-100">OSGB</div>
          </div>

          <div className="divide-y divide-white/10">
            {pricingComparisonRows.map((row) => (
              <div
                key={row.feature}
                className="grid gap-4 bg-[rgba(11,31,58,0.55)] px-5 py-5 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:items-center"
              >
                <div className="text-sm font-medium text-white">{row.feature}</div>
                <div className="flex items-center justify-between gap-3 md:block">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 md:hidden">Ücretsiz</span>
                  <ComparisonPill value={row.free} />
                </div>
                <div className="flex items-center justify-between gap-3 md:block">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 md:hidden">Premium</span>
                  <ComparisonPill value={row.premium} />
                </div>
                <div className="flex items-center justify-between gap-3 md:block">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 md:hidden">OSGB</span>
                  <ComparisonPill value={row.osgb} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-white/10 bg-[#0B1F3A]/72 p-4">
            <p className="text-sm font-medium text-white">7 günlük Premium deneme</p>
            <p className="mt-2 text-sm leading-7 text-slate-400">
              Yeni kullanıcıya otomatik verilmez. Kullanıcı Ana Panel üzerinden kendisi başlatır.
            </p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-[#0B1F3A]/72 p-4">
            <p className="text-sm font-medium text-white">OSGB = Premium + OSGB</p>
            <p className="mt-2 text-sm leading-7 text-slate-400">
              OSGB paketi Premium'un tüm AI, raporlama ve üretim araçlarını da içerir.
            </p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-[#0B1F3A]/72 p-4">
            <p className="text-sm font-medium text-white">KVKK odaklı veri yönetimi</p>
            <p className="mt-2 text-sm leading-7 text-slate-400">
              Verilerinizi merkezi ve yetkilendirilmiş bir yapı içinde yönetmeye devam edersiniz.
            </p>
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
