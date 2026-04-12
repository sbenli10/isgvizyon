import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LandingLayout } from "@/components/marketing/LandingLayout";
import {
  landingNavLinks,
  landingValueProps,
  pricingPlans,
  productOverviewCards,
} from "@/lib/landingContent";

export default function Index() {
  const navigate = useNavigate();

  return (
    <LandingLayout
      eyebrow="Bilgi Merkezi"
      title="İSGVİZYON’u bölüm bölüm inceleyin"
      description="Ana sayfa artık her şeyi tek ekrana sıkıştırmak yerine ürün yapısını ayrı alanlarda anlatır. Ürün kapsamını, öne çıkan özellikleri, işleyiş akışını, güven katmanını ve plan yapısını ayrı sayfalardan rahatça inceleyebilirsiniz."
    >
      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 md:p-8">
          <Badge className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-cyan-100">
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            Ayrı anlatım alanları
          </Badge>
          <h2 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-white">
            Ürün büyüdükçe anlatımı da daha sade hale getirdik.
          </h2>
          <p className="mt-4 text-sm leading-8 text-slate-300 sm:text-base">
            Risk, denetim, belge, yapay zeka ve ortak sağlık güvenlik birimi modülleri aynı ürün içinde büyüdüğü için; ürün anlatımını
            ayrı içerik sayfalarına ayırdık. Böylece kullanıcı hangi başlıkta neyi göreceğini daha rahat anlayabilir.
          </p>

          <div className="mt-6 grid gap-3">
            {landingValueProps.map((item) => (
              <div key={item} className="rounded-[22px] border border-white/10 bg-[#101726] p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-300" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button
              className="h-12 gap-2 rounded-2xl bg-cyan-400 px-6 text-slate-950 hover:bg-cyan-300"
              onClick={() => navigate("/landing/product")}
            >
                Ürün sayfasına git
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-12 rounded-2xl border-white/10 bg-white/[0.04] px-6 text-slate-100 hover:bg-white/10"
              onClick={() => navigate("/landing/pricing")}
            >
              Planları incele
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {productOverviewCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(16,23,38,0.9))] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.18)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  {card.badge ? (
                    <Badge className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-100">
                      {card.badge}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-5 text-lg font-semibold text-white">{card.title}</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">{card.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 md:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-300/80">Gezinme</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
          Landing başlıkları artık ayrı sayfalarda.
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {landingNavLinks.map((link) => (
            <button
              key={link.path}
              type="button"
              onClick={() => navigate(link.path)}
              className="rounded-[24px] border border-white/10 bg-[#101726] p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/20"
            >
              <p className="text-sm font-semibold text-white">{link.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                  {link.label === "Ürün" && "Platformun ne sunduğunu ana modüller üzerinden görün."}
                  {link.label === "Özellikler" && "Gerçek ekranları ve profesyonel plan farklarını modül bazında inceleyin."}
                  {link.label === "Akış" && "Kurulumdan gelişmiş kullanıma kadar işleyiş adımlarını görün."}
                  {link.label === "Güven" && "Veri güvenliği, üyelik mantığı ve sistem katmanlarını inceleyin."}
                  {link.label === "Fiyatlandırma" && "Ücretsiz, profesyonel ve kurumsal plan yapısını net görün."}
                </p>
              </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {pricingPlans.map((plan) => (
          <div
            key={plan.title}
            className={`rounded-[26px] border p-5 ${
              plan.recommended
                ? "border-cyan-400/20 bg-[linear-gradient(180deg,rgba(34,211,238,0.12),rgba(255,255,255,0.04))]"
                : "border-white/10 bg-white/[0.04]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-semibold text-white">{plan.title}</p>
              <Badge className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-200">
                {plan.badge}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-300">{plan.description}</p>
            <Button
              className={`mt-5 w-full rounded-2xl ${
                plan.recommended
                  ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                  : "bg-white/[0.08] text-white hover:bg-white/[0.12]"
              }`}
              onClick={() => navigate("/landing/pricing")}
            >
              {plan.cta}
            </Button>
          </div>
        ))}
      </section>
    </LandingLayout>
  );
}
