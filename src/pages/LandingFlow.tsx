import { LandingLayout } from "@/components/marketing/LandingLayout";
import { workflowSteps } from "@/lib/landingContent";

export default function LandingFlow() {
  return (
    <LandingLayout
      eyebrow="Akış"
      title="İSGVizyon ile süreç nasıl işler?"
      description="Saha verisi toplanır, yapay zeka analiz eder, riskler önceliklendirilir ve aksiyonlar izlenebilir hale gelir."
    >
      <section className="grid gap-4 xl:grid-cols-4">
        {workflowSteps.map((item, index) => (
          <article
            key={item.step}
            className="relative rounded-[28px] border border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.72)] p-6 backdrop-blur-xl"
          >
            {index < workflowSteps.length - 1 ? (
              <div className="pointer-events-none absolute right-[-14px] top-10 hidden h-px w-7 bg-gradient-to-r from-cyan-400/60 to-transparent xl:block" />
            ) : null}
            <div className="text-sm font-semibold tracking-[0.22em] text-cyan-300/80">{item.step}</div>
            <h2 className="mt-5 text-xl font-semibold text-white">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[30px] border border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.72)] p-6 backdrop-blur-xl md:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-300/80">Operasyon mantığı</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-[#0B1F3A]/72 p-5">
            <h3 className="text-lg font-semibold text-white">Sahadan veri gelir</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Denetim, fotoğraf, uygunsuzluk ve görev verisi süreç içinde üretilir; ürün bu veriyi merkezi hale getirir.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-[#0B1F3A]/72 p-5">
            <h3 className="text-lg font-semibold text-white">Yönetim için karar desteğine dönüşür</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Aynı veri akışı AI risk yorumu, aksiyon önceliği, kapanış performansı ve yönetici raporlaması olarak tekrar kullanılır.
            </p>
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
