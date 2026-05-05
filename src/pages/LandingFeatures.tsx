import { Badge } from "@/components/ui/badge";
import { LandingLayout } from "@/components/marketing/LandingLayout";
import { featureHighlightCards, pricingPlans } from "@/lib/landingContent";

export default function LandingFeatures() {
  return (
    <LandingLayout
      eyebrow="Özellikler"
      title="İSG yönetimini akıllı ve ölçülebilir hale getiren özellikler"
      description="Denetimden raporlamaya, uygunsuzluk takibinden yapay zeka destekli risk analizine kadar tüm süreci tek platformda yönetin."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {featureHighlightCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="rounded-[28px] border border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.72)] p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/26"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
                  <Icon className="h-5 w-5" />
                </div>
                {card.badge ? (
                  <Badge className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">
                    {card.badge}
                  </Badge>
                ) : null}
              </div>
              <h2 className="mt-5 text-xl font-semibold text-white">{card.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{card.description}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-[30px] border border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.72)] p-6 backdrop-blur-xl md:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-300/80">Plan görünümü</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
          Paketler ürünün gerçek operasyon yoğunluğuna göre ayrışır.
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {pricingPlans.map((plan) => (
            <article
              key={plan.title}
              className={`rounded-[26px] border p-5 ${
                plan.recommended
                  ? "border-cyan-400/25 bg-cyan-400/[0.08]"
                  : "border-white/10 bg-[#0B1F3A]/72"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">{plan.title}</h3>
                <Badge className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-200">
                  {plan.badge}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-300">{plan.description}</p>
              <div className="mt-4 space-y-2">
                {plan.bullets.map((bullet) => (
                  <div
                    key={bullet}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200"
                  >
                    {bullet}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </LandingLayout>
  );
}
