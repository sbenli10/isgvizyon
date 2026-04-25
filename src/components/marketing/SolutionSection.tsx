import { CheckCircle2 } from "lucide-react";
import { LandingSectionHeading } from "@/components/marketing/LandingSectionHeading";
import { landingSolutionCards } from "@/lib/landingContent";

export function SolutionSection() {
  return (
    <section className="space-y-10">
      <LandingSectionHeading
        eyebrow="Çözüm"
        title="İSGVizyon tüm operasyonu tek panelde toplar"
        description="Saha ile ofis arasındaki süreci tek bir operasyon omurgasına taşıyarak görünürlük, takip ve raporlama kabiliyetini güçlendirir."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {landingSolutionCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(9,14,24,0.92))] p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/16 bg-cyan-400/10 text-cyan-200">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Modül
                </span>
              </div>
              <h3 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-white">{card.title}</h3>
              <p className="mt-4 text-base leading-8 text-slate-300">{card.description}</p>
              <div className="mt-6 flex items-center gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <p className="text-sm text-slate-200">Aynı veri yapısında ilerleyen, izlenebilir operasyon akışı</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
