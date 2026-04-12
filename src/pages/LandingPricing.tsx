import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LandingLayout } from "@/components/marketing/LandingLayout";
import { pricingPlans } from "@/lib/landingContent";
import { useNavigate } from "react-router-dom";

export default function LandingPricing() {
  const navigate = useNavigate();

  return (
    <LandingLayout
      eyebrow="Fiyatlandırma"
      title="Ücretsiz plan ile başlayın, profesyonel plan ile gelişmiş modülleri açın"
      description="Plan yapısı ürün içindeki gerçek erişim modeline göre çalışır. Ücretsiz plan temel operasyonları başlatır; profesyonel plan ise gelişmiş modülleri, daha yüksek limitleri ve 7 günlük denemeyi açar."
    >
      <section className="grid gap-4 md:grid-cols-3">
        {pricingPlans.map((plan) => (
          <article
            key={plan.title}
            className={`rounded-[28px] border p-6 ${
              plan.recommended
                ? "border-cyan-400/20 bg-cyan-400/[0.08]"
                : "border-white/10 bg-white/[0.04]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold text-white">{plan.title}</h2>
              <Badge className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-200">
                {plan.badge}
              </Badge>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">{plan.description}</p>
            <div className="mt-5 space-y-3">
              {plan.bullets.map((bullet) => (
                <div
                  key={bullet}
                  className="rounded-[20px] border border-white/10 bg-[#101726] px-4 py-3 text-sm text-slate-200"
                >
                  {bullet}
                </div>
              ))}
            </div>
            <Button
              className={`mt-6 w-full rounded-2xl ${
                plan.recommended
                  ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                  : "bg-white/[0.08] text-white hover:bg-white/[0.12]"
              }`}
              onClick={() => navigate("/auth")}
            >
              {plan.cta}
            </Button>
          </article>
        ))}
      </section>

      <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 md:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-300/80">Plan mantığı</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-[#101726] p-5">
            <h3 className="text-lg font-semibold text-white">Ücretsiz plan ne sağlar?</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Temel firma, çalışan, risk, denetim ve düzeltici önleyici faaliyet akışını düşük riskle başlatır. Bu plan ürünün
              çalışma mantığını gerçek veriyle görmen için tasarlanmıştır.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-[#101726] p-5">
            <h3 className="text-lg font-semibold text-white">Profesyonel plan ne açar?</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Profesyonel plan; toplu düzeltici faaliyet analizi, yerleşim planı analizi, İSG asistanı,
              sertifika, ortak sağlık güvenlik birimi modülü ve yüksek yapay zeka limitlerini açar. 7 günlük deneme ile satın almadan
              önce içeriden deneyebilirsin.
            </p>
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
