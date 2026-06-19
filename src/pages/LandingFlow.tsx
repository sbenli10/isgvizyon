import { LandingLayout } from "@/components/marketing/LandingLayout";
import { workflowSteps } from "@/lib/landingContent";

export default function LandingFlow() {
  return (
    <LandingLayout
      eyebrow="Akış"
      title="ISGVizyon ile süreç nasıl işler?"
      description="Saha verisi toplanır, yapay zeka analiz eder, riskler önceliklendirilir ve aksiyonlar izlenebilir hale gelir."
    >
      <section className="grid gap-4 xl:grid-cols-4">
        {workflowSteps.map((item, index) => (
          <article key={item.step} className="relative rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            {index < workflowSteps.length - 1 ? (
              <div className="pointer-events-none absolute right-[-14px] top-10 hidden h-px w-7 bg-gradient-to-r from-sky-400 to-transparent xl:block" />
            ) : null}
            <div className="text-sm font-black tracking-[0.22em] text-sky-600">{item.step}</div>
            <h2 className="mt-5 text-xl font-black text-slate-950">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-600">Operasyon mantığı</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-lg font-black text-slate-950">Sahadan veri gelir</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Denetim, fotoğraf, uygunsuzluk ve görev verisi süreç içinde üretilir; ürün bu veriyi merkezi hale getirir.
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-lg font-black text-slate-950">Yönetim için karar desteğine dönüşür</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Aynı veri akışı AI risk yorumu, aksiyon önceliği, kapanış performansı ve yönetici raporlaması olarak tekrar kullanılır.
            </p>
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
