import { landingProblemItems } from "@/lib/landingContent";
import { LandingSectionHeading } from "@/components/marketing/LandingSectionHeading";

/**
 * ProblemSection
 * Amaç: “dağınık operasyon” problemini daha profesyonel, premium ve güven veren bir dille göstermek.
 * - Kartlara hover/odak durumları eklendi (daha interaktif ve canlı).
 * - İkon alanına glow + renk geçişi eklendi (heyecan/premium hissi).
 * - Grid daha dengeli hale getirildi (xl’de 5 kolon korunur, aralıklar iyileşti).
 * - Arka plan overlay ile kartlar daha net ayrışır.
 */

export function ProblemSection() {
  return (
    <section className="relative space-y-10">
      {/* Subtle section background to separate from other blocks */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[36px] opacity-[0.55]
        [background:radial-gradient(circle_at_18%_20%,rgba(34,211,238,0.10),transparent_45%),radial-gradient(circle_at_82%_30%,rgba(167,139,250,0.10),transparent_45%)]"
      />

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
              className={[
                "group relative overflow-hidden rounded-[28px] border border-white/10",
                "bg-white/[0.035] p-5",
                "shadow-[0_18px_55px_rgba(2,6,23,0.28)]",
                "transition-all duration-300",
                "hover:-translate-y-0.5 hover:border-cyan-400/20 hover:bg-white/[0.05]",
                "focus-within:ring-2 focus-within:ring-cyan-400/30 focus-within:ring-offset-2 focus-within:ring-offset-[#050712]",
              ].join(" ")}
            >
              {/* hover glow */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100
                [background:radial-gradient(circle_at_22%_18%,rgba(34,211,238,0.12),transparent_55%),radial-gradient(circle_at_86%_30%,rgba(167,139,250,0.10),transparent_55%)]"
              />

              <div className="relative">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-amber-200">
                  <div className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_0_30px_rgba(34,211,238,0.10)]" />
                  <Icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-[1.04]" />
                </div>

                <h3 className="mt-5 text-[1.05rem] font-semibold leading-snug text-white">
                  {item.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {item.description}
                </p>

                {/* tiny underline accent */}
                <div className="mt-5 h-px w-10 bg-gradient-to-r from-cyan-400/40 to-violet-400/10 opacity-70 transition-all duration-300 group-hover:w-16" />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}