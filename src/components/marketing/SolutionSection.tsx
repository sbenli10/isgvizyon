import { CheckCircle2 } from "lucide-react";
import { landingSolutionCards } from "@/lib/landingContent";

export function SolutionSection() {
  return (
    <section className="relative overflow-hidden bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-0 top-0 h-80 w-80 rounded-full bg-cyan-100/60 blur-3xl" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-96 w-96 rounded-full bg-blue-100/60 blur-3xl" />

      <div className="relative mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.28em] !text-sky-700">
            Çözüm
          </p>

          <h2 className="mt-5 text-3xl font-black tracking-[-0.04em] !text-slate-950 sm:text-4xl lg:text-5xl">
            İSGVizyon tüm operasyonu tek panelde toplar
          </h2>

          <p className="mt-5 max-w-2xl text-base font-medium leading-8 !text-slate-600 sm:text-lg">
            Saha ile ofis arasındaki süreci tek bir operasyon omurgasına taşıyarak
            görünürlük, takip ve raporlama kabiliyetini güçlendirir.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {landingSolutionCards.map((card) => {
            const Icon = card.icon;

            return (
              <article
                key={card.title}
                className="group relative min-h-[260px] overflow-hidden rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-sky-200 hover:shadow-[0_24px_70px_rgba(14,165,233,0.15)]"
              >
                <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-bl-[42px] bg-gradient-to-br from-sky-100 to-cyan-50 opacity-90 transition group-hover:from-sky-200 group-hover:to-cyan-100" />

                <div className="relative z-10 flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sky-700 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>

                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] !text-sky-800">
                    Modül
                  </span>
                </div>

                <div className="relative z-10 mt-7">
                  <h3 className="text-2xl font-black tracking-[-0.03em] !text-slate-950">
                    {card.title}
                  </h3>

                  <p className="mt-4 text-base font-medium leading-8 !text-slate-700">
                    {card.description}
                  </p>
                </div>

                <div className="relative z-10 mt-7 flex items-start gap-3 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>

                  <p className="text-sm font-bold leading-6 !text-emerald-950">
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