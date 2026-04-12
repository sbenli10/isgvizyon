import { Badge } from "@/components/ui/badge";
import { LandingLayout } from "@/components/marketing/LandingLayout";
import {
  landingValueProps,
  productModuleCards,
  productOverviewCards,
} from "@/lib/landingContent";

export default function LandingProduct() {
  return (
    <LandingLayout
      eyebrow="Ürün"
      title="İSG operasyonunu tek omurgada toplayan ürün yapısı"
      description="İSGVİZYON; risk değerlendirme, denetim, düzeltici ve önleyici faaliyet, belge akışı, yapay zeka destekli analiz ve ortak sağlık güvenlik birimi operasyonlarını aynı ürün çatısı altında birleştirir."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {productOverviewCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
                  <Icon className="h-5 w-5" />
                </div>
                {card.badge ? (
                  <Badge className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-100">
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

      <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 md:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-300/80">Ürün kapsamı</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
          Ana modüller birbirini besleyen tek bir operasyon akışı oluşturur.
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {productModuleCards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.title}
                className="rounded-[24px] border border-white/10 bg-[#101726] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-100">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  {card.badge ? (
                    <Badge className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">
                      {card.badge}
                    </Badge>
                  ) : null}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{card.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-[30px] border border-emerald-400/15 bg-emerald-400/[0.05] p-6 md:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-emerald-300/80">Neden tek yapı</p>
        <div className="mt-4 grid gap-3">
          {landingValueProps.map((item) => (
            <div key={item} className="rounded-[22px] border border-white/10 bg-[#101726] p-4 text-sm leading-7 text-slate-200">
              {item}
            </div>
          ))}
        </div>
      </section>
    </LandingLayout>
  );
}
