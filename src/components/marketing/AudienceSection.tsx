import { LandingSectionHeading } from "@/components/marketing/LandingSectionHeading";
import { landingAudienceItems } from "@/lib/landingContent";

export function AudienceSection() {
  return (
    <section className="space-y-10">
      <LandingSectionHeading
        eyebrow="Kullanım Alanı"
        title="Kimler için uygun?"
        description="İSGVizyon, yalnızca tek tip şirket yapısı için değil; sahası, ekibi ve operasyon yoğunluğu farklı olan yapılar için tasarlanır."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {landingAudienceItems.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-violet-200">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{item.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
