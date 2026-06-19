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
      <section className="grid gap-4 text-slate-950 md:grid-cols-2 xl:grid-cols-3">
        {featureHighlightCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-sky-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 text-slate-950">
                  <Icon className="h-5 w-5" />
                </div>
                {card.badge ? (
                  <Badge className="rounded-full border border-sky-200 bg-white px-3 py-1 text-slate-950">
                    {card.badge}
                  </Badge>
                ) : null}
              </div>
              <h2 className="mt-5 text-xl font-black text-slate-950">{card.title}</h2>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-950">{card.description}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-950">Plan görünümü</p>
        <h2 className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950">
          Paketler ürünün gerçek operasyon yoğunluğuna göre ayrışır.
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {pricingPlans.map((plan) => (
            <article
              key={plan.title}
              className="rounded-[26px] border border-slate-200 bg-white p-5 text-slate-950 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-black text-slate-950">{plan.title}</h3>
                <Badge className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-950">
                  {plan.badge}
                </Badge>
              </div>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-950">{plan.description}</p>
              <div className="mt-4 space-y-2">
                {plan.bullets.map((bullet) => (
                  <div
                    key={bullet}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950"
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
