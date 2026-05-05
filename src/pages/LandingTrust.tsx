import { Badge } from "@/components/ui/badge";
import { LandingLayout } from "@/components/marketing/LandingLayout";
import { trustCards, trustMetrics, trustUseCases } from "@/lib/landingContent";

export default function LandingTrust() {
  return (
    <LandingLayout
      eyebrow="Güven"
      title="Verileriniz, süreçleriniz ve kararlarınız güvende"
      description="İSGVizyon, İSG süreçlerinizi merkezi, izlenebilir ve güvenilir bir yapıda yönetmeniz için tasarlanmıştır."
    >
      <section className="grid gap-4 md:grid-cols-2">
        {trustCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="rounded-[28px] border border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.72)] p-6 backdrop-blur-xl"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-white">{card.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{card.description}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[30px] border border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.72)] p-6 backdrop-blur-xl md:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-300/80">Sistem yaklaşımı</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {trustMetrics.map((metric) => (
              <div key={metric.label} className="rounded-[22px] border border-white/10 bg-[#0B1F3A]/72 p-5">
                <p className="text-3xl font-semibold tracking-[-0.05em] text-white">{metric.value}</p>
                <p className="mt-2 text-sm text-slate-400">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[30px] border border-cyan-400/18 bg-cyan-400/[0.06] p-6 md:p-8">
          <div className="flex items-center gap-3">
            <Badge className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-cyan-100">
              Kullanım alanları
            </Badge>
          </div>
          <div className="mt-5 space-y-3">
            {trustUseCases.map((item) => (
              <div
                key={item}
                className="rounded-[22px] border border-white/10 bg-[#0B1F3A]/72 px-4 py-3 text-sm text-slate-200"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
