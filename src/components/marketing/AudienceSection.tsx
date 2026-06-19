import { LandingSectionHeading } from "@/components/marketing/LandingSectionHeading";
import { landingAudienceItems } from "@/lib/landingContent";

export function AudienceSection() {
  return (
    <section className="space-y-10">
      <LandingSectionHeading
        eyebrow="Kullanım Alanı"
        title="Kimler için uygun?"
        description="ISGVizyon, sahası, ekibi ve operasyon yoğunluğu farklı olan İSG yapıları için tasarlanır."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {landingAudienceItems.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_18px_50px_rgba(14,165,233,0.10)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-100 bg-cyan-50 text-cyan-700">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-black text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
