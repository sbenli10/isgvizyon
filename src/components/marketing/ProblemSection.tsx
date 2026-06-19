import { landingProblemItems } from "@/lib/landingContent";
import { LandingSectionHeading } from "@/components/marketing/LandingSectionHeading";

export function ProblemSection() {
  return (
    <section className="relative space-y-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[-2rem] top-[-2rem] -z-10 h-72 rounded-[3rem] bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.12),transparent_44%),radial-gradient(circle_at_85%_10%,rgba(37,99,235,0.08),transparent_42%)]"
      />

      <LandingSectionHeading
        eyebrow="Problemin Kendisi"
        title="İSG süreçleri hâlâ Excel, klasör ve mesajlar arasında mı yürüyor?"
        description="Operasyon büyüdükçe bilgi farklı kanallara dağılır. ISGVizyon kayıt, takip ve sorumluluk akışını tek merkezde görünür hale getirir."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {landingProblemItems.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.title}
              className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_24px_70px_rgba(14,165,233,0.12)]"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 [background:radial-gradient(circle_at_22%_18%,rgba(14,165,233,0.10),transparent_55%)]"
              />

              <div className="relative">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 text-blue-600">
                  <Icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-[1.04]" />
                </div>

                <h3 className="mt-5 text-[1.05rem] font-black leading-snug text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
                <div className="mt-5 h-px w-10 bg-gradient-to-r from-sky-400 to-cyan-300 transition-all duration-300 group-hover:w-16" />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
