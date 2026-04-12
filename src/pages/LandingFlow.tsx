import { LandingLayout } from "@/components/marketing/LandingLayout";
import { workflowSteps } from "@/lib/landingContent";

export default function LandingFlow() {
  return (
    <LandingLayout
      eyebrow="Akış"
      title="Kurulumdan gelişmiş kullanıma kadar ilerleyen net bir operasyon akışı"
      description="Platformu ilk gün sadece kayıt girmek için değil; risk, denetim, düzeltici ve önleyici faaliyet, plan, belge ve gelişmiş modüller arasında kaybolmadan ilerlemek için tasarladık."
    >
      <section className="grid gap-4 xl:grid-cols-4">
        {workflowSteps.map((item) => (
          <article
            key={item.step}
            className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6"
          >
            <div className="text-sm font-semibold tracking-[0.22em] text-cyan-300/80">{item.step}</div>
            <h2 className="mt-5 text-xl font-semibold text-white">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 md:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-300/80">Operasyon mantığı</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-[#101726] p-5">
            <h3 className="text-lg font-semibold text-white">Ücretsiz plan ile başlama</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Firma, çalışan, risk, denetim, tekil düzeltici ve önleyici faaliyet kaydı ve temel rapor akışlarıyla ürünün ana omurgası
              kurulur. Böylece ekip ürünü gerçek veriyle tanımaya başlar.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-[#101726] p-5">
            <h3 className="text-lg font-semibold text-white">Profesyonel plan ile hız ve ölçek</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Yapay zeka destekli modüller, yüksek limitler, sertifikalar, ortak sağlık güvenlik birimi alanı ve gelişmiş operasyon
              ekranları profesyonel planda açılır; ekip büyüdükçe ürün de seninle büyür.
            </p>
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
