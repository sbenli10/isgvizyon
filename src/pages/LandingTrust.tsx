import { Badge } from "@/components/ui/badge";
import { LandingLayout } from "@/components/marketing/LandingLayout";
import { trustCards, trustMetrics, trustUseCases } from "@/lib/landingContent";

export default function LandingTrust() {
  return (
    <LandingLayout
      eyebrow="Güven"
      title="Verileriniz, süreçleriniz ve kararlarınız güvende"
      description="ISGVizyon, İSG süreçlerinizi merkezi, izlenebilir ve güvenilir bir yapıda yönetmeniz için tasarlanmıştır."
    >
      <section className="grid gap-4 text-slate-950 md:grid-cols-2">
        {trustCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-950">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-xl font-black text-slate-950">{card.title}</h2>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-950">{card.description}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 text-slate-950 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-950">Sistem yaklaşımı</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {trustMetrics.map((metric) => (
              <div key={metric.label} className="rounded-[22px] border border-slate-200 bg-white p-5 text-slate-950">
                <p className="text-3xl font-black tracking-[-0.05em] text-slate-950">{metric.value}</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white p-6 text-slate-950 md:p-8">
          <Badge className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-950">
            Kullanım alanları
          </Badge>
          <div className="mt-5 space-y-3">
            {trustUseCases.map((item) => (
              <div key={item} className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
