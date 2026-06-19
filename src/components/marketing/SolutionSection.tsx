import { CheckCircle2 } from "lucide-react";
import { LandingSectionHeading } from "@/components/marketing/LandingSectionHeading";
import { landingSolutionCards } from "@/lib/landingContent";

export function SolutionSection() {
  return (
    <section className="relative overflow-hidden rounded-[36px] bg-gradient-to-b from-white via-sky-50/40 to-white px-4 py-14 text-slate-950 sm:px-6 lg:px-0">
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-cyan-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-blue-200/30 blur-3xl" />

      <div className="relative space-y-10">
        <LandingSectionHeading
          eyebrow="Çözüm"
          title="İSGVizyon tüm operasyonu tek panelde toplar"
          description="Saha ile ofis arasındaki süreci tek bir operasyon omurgasına taşıyarak görünürlük, takip ve raporlama kabiliyetini güçlendirir."
        />

        <div className="grid gap-5 lg:grid-cols-2">
          {landingSolutionCards.map((card) => {
            const Icon = card.icon;

            return (
              <article
                key={card.title}
                className="group relative overflow-hidden rounded-[30px] border border-slate-200/80 bg-white p-6 text-slate-950 shadow-[0_18px_55px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-sky-200 hover:shadow-[0_24px_70px_rgba(14,165,233,0.15)]"
              >
                <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-bl-[42px] bg-gradient-to-br from-sky-100 to-cyan-50 opacity-80 transition group-hover:from-sky-200 group-hover:to-cyan-100" />

                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sky-700 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>

                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-sky-700">
                    Modül
                  </span>
                </div>

                <div className="relative mt-7">
                  <h3 className="text-2xl font-black tracking-[-0.03em] text-slate-950">
                    {card.title}
                  </h3>

                  <p className="mt-4 text-base font-medium leading-8 text-slate-700">
                    {card.description}
                  </p>
                </div>

                <div className="relative mt-6 flex items-start gap-3 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>

                  <p className="text-sm font-bold leading-6 text-emerald-950">
                    Aynı veri yapısında ilerleyen, izlenebilir operasyon akışı
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}