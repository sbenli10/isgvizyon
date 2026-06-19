import { Badge } from "@/components/ui/badge";
import { LandingLayout } from "@/components/marketing/LandingLayout";
import { landingValueProps, productModuleCards, productOverviewCards } from "@/lib/landingContent";

export default function LandingProduct() {
  return (
    <LandingLayout
      eyebrow="Ürün"
      title="Riskleri sadece kaydeden değil, yorumlayan bir ürün katmanı"
      description="ISGVizyon; risk değerlendirme, denetim, uygunsuzluk, DÖF, belge akışı ve OSGB operasyonlarını aynı veri omurgasında birleştirerek yapay zeka destekli İSG görünürlüğü sunar."
    >
      <section className="grid gap-4 text-slate-950 md:grid-cols-2 xl:grid-cols-4">
        {productOverviewCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-950">
                  <Icon className="h-5 w-5" />
                </div>
                {card.badge ? (
                  <Badge className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-950">
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
        <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-950">Ürün kapsamı</p>
        <h2 className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950">
          Ana modüller birbirini besleyen tek bir operasyon akışı oluşturur.
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {productModuleCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.title} className="rounded-[24px] border border-slate-200 bg-white p-5 text-slate-950">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-950">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  {card.badge ? (
                    <Badge className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-950">
                      {card.badge}
                    </Badge>
                  ) : null}
                </div>
                <h3 className="mt-4 text-lg font-black text-slate-950">{card.title}</h3>
                <p className="mt-3 text-sm font-medium leading-7 text-slate-950">{card.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-950">Neden bu yapı</p>
        <div className="mt-4 grid gap-3">
          {landingValueProps.map((item) => (
            <div
              key={item}
              className="rounded-[22px] border border-slate-200 bg-white p-4 text-sm font-semibold leading-7 text-slate-950 shadow-sm"
            >
              {item}
            </div>
          ))}
        </div>
      </section>
    </LandingLayout>
  );
}
