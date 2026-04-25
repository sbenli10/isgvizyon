import { landingProblemItems } from "@/lib/landingContent";
import { LandingSectionHeading } from "@/components/marketing/LandingSectionHeading";

export function ProblemSection() {
  return (
    <section className="space-y-10">
      <LandingSectionHeading
        eyebrow="Problemin Kendisi"
        title="İSG süreçleri hâlâ Excel, klasör ve WhatsApp arasında mı yürüyor?"
        description="Operasyon büyüdükçe bilgi farklı kanallara dağılır. Asıl sorun yalnızca kayıt tutmak değil; kayıtların takip, görünürlük ve sorumluluk üretmemesidir."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {landingProblemItems.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.title}
              className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_48px_rgba(2,6,23,0.18)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-amber-200">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{item.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
