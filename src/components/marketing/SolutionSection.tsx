import { CheckCircle2 } from "lucide-react";
import { LandingSectionHeading } from "@/components/marketing/LandingSectionHeading";
import { landingSolutionCards } from "@/lib/landingContent";

export function SolutionSection() {
  return (
    <section className="space-y-10 text-slate-950">
      <LandingSectionHeading
        eyebrow="Çözüm"
        title="ISGVizyon tüm operasyonu tek panelde toplar"
        description="Saha ile ofis arasındaki süreci tek bir operasyon omurgasına taşıyarak görünürlük, takip ve raporlama kabiliyetini güçlendirir."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {landingSolutionCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="rounded-[30px] border border-slate-200 bg-white p-6 text-slate-950 shadow-[0_18px_55px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-950">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-950">
                  Modül
                </span>
              </div>
              <h3 className="mt-6 text-2xl font-black tracking-[-0.03em] text-slate-950">{card.title}</h3>
              <p className="mt-4 text-base font-medium leading-8 text-slate-950">{card.description}</p>
              <div className="mt-6 flex items-center gap-3 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-slate-950">
                <CheckCircle2 className="h-4 w-4 text-slate-950" />
                <p className="text-sm font-bold text-slate-950">
                  Aynı veri yapısında ilerleyen, izlenebilir operasyon akışı
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
