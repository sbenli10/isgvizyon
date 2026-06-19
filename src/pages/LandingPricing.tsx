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
      <li className="flex items-start gap-3 text-sm text-slate-950">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <span className="font-semibold">{label}</span>
      </li>
    );
  }

  if (status === "limited") {
    return (
      <li className="flex items-start gap-3 text-sm text-slate-950">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <span className="font-semibold">{label} ({value})</span>
      </li>
    );
  }

  if (status === "excluded") {
    return (
      <li className="flex items-start gap-3 text-sm text-slate-950">
        <Minus className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <span className="line-through decoration-slate-300">{label}</span>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 text-sm text-slate-950">
      <Zap className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
      <span>
        <span className="font-semibold">{label}</span>
        <span className="ml-2 text-slate-700">({value})</span>
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
      description="ISGVizyon'u ekip büyüklüğünüze, saha operasyonlarınıza ve yapay zeka destekli analiz ihtiyaçlarınıza göre seçin."
    >
      <section className="relative overflow-hidden rounded-[34px] border border-sky-200 bg-white p-6 text-slate-950 shadow-sm md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.10),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.08),transparent_36%)]" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="rounded-full border border-sky-200 bg-white px-4 py-2 text-slate-950">
              <Sparkles className="mr-2 h-3.5 w-3.5 text-blue-600" />
              Yapay Zeka Destekli İSG Paketleri
            </Badge>
            <span className="text-sm font-semibold text-slate-950">
              Deneme üyeliği otomatik başlamaz; kullanıcı Ana Panel'den 7 günlük Premium denemeyi kendisi başlatır.
            </span>
          </div>

          <div className="mt-6 max-w-3xl">
            <h2 className="text-3xl font-black tracking-[-0.05em] text-slate-950 md:text-5xl">
              İSG süreçlerinizi ölçeklendiren paketler
            </h2>
            <p className="mt-4 text-sm leading-8 text-slate-950 md:text-base">
              Ücretsiz, Premium ve OSGB paketleri arasındaki limitleri, açık modülleri ve kapalı özellikleri tek ekranda karşılaştırın.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {displayPlans.map((plan, index) => (
          <article
            key={plan.title}
            className={[
              "relative flex h-full flex-col overflow-hidden rounded-[30px] border p-6 text-slate-950 transition-all duration-300 hover:-translate-y-1",
              plan.recommended
                ? "border-sky-300 bg-white shadow-[0_24px_70px_rgba(14,165,233,0.14)]"
                : "border-slate-200 bg-white shadow-sm",
            ].join(" ")}
          >
            {plan.recommended ? (
              <div className="absolute inset-x-0 top-0 flex justify-center">
                <Badge className="mt-3 rounded-full border border-blue-200 bg-white px-4 py-1 text-slate-950 shadow-[0_10px_30px_rgba(37,99,235,0.18)]">
                  En Popüler
                </Badge>
              </div>
            ) : null}

            <div className={`relative z-10 flex h-full flex-col text-slate-950 ${plan.recommended ? "pt-8" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-100 bg-white text-blue-600">
                    {index === 0 ? <ShieldCheck className="h-5 w-5" /> : index === 1 ? <Sparkles className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                  </div>
                  <h3 className="mt-4 text-2xl font-black tracking-[-0.04em] text-slate-950">{plan.title}</h3>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{plan.audience}</p>
                </div>

                <Badge className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-950">{plan.badge}</Badge>
              </div>

              <div className="mt-6">
                <div className="flex items-end gap-2">
                  <p className="text-4xl font-black tracking-[-0.06em] text-slate-950">{plan.price}</p>
                  <span className="pb-1 text-sm font-semibold text-slate-950">{plan.period}</span>
                </div>
                <p className="mt-3 min-h-[92px] text-sm leading-7 text-slate-950">{plan.description}</p>
              </div>

              <div className="mt-6 space-y-3 rounded-[22px] border border-slate-200 bg-white p-4 text-slate-950">
                {plan.bullets.map((bullet) => (
                  <div key={bullet} className="text-sm leading-7 text-slate-950">
                    {bullet}
                  </div>
                ))}
              </div>

              <ul className="mt-6 max-h-[560px] space-y-3 overflow-y-auto pr-1 text-slate-950">
                {getPlanValues(plan.title).map((feature) => (
                  <PlanFeatureItem key={`${plan.title}-${feature.label}`} label={feature.label} value={feature.value} />
                ))}
              </ul>

              <Button
                className="mt-6 w-full rounded-2xl border border-sky-200 bg-white text-slate-950 hover:bg-sky-50"
                onClick={() => navigate("/auth")}
              >
                {plan.cta}
              </Button>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-950">Plan Karşılaştırması</p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950 md:text-3xl">
              Tüm özellikleri plan bazında net görün
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-slate-950">
            Premium gelişmiş bireysel kullanım, OSGB ise Premium + OSGB operasyonlarıdır.
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

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["7 günlük Premium deneme", "Yeni kullanıcıya otomatik verilmez. Kullanıcı Ana Panel üzerinden kendisi başlatır."],
            ["OSGB = Premium + OSGB", "OSGB paketi Premium'un tüm AI, raporlama ve üretim araçlarını da içerir."],
            ["KVKK odaklı veri yönetimi", "Verilerinizi merkezi ve yetkilendirilmiş bir yapı içinde yönetmeye devam edersiniz."],
          ].map(([title, detail]) => (
            <div key={title} className="rounded-[22px] border border-slate-200 bg-white p-4 text-slate-950">
              <p className="text-sm font-black text-slate-950">{title}</p>
              <p className="mt-2 text-sm leading-7 text-slate-950">{detail}</p>
            </div>
          ))}
        </div>
      </section>
    </LandingLayout>
  );
}
