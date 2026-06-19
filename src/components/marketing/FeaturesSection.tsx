import { CheckCircle2 } from "lucide-react";
import { LandingSectionHeading } from "@/components/marketing/LandingSectionHeading";
import { landingFeatureGroups } from "@/lib/landingContent";

export function FeaturesSection() {
  return (
    <section className="space-y-10" id="features">
      <LandingSectionHeading
        eyebrow="Özellikler"
        title="Dağınık liste değil, operasyon akışına göre gruplanmış modüller"
        description="ISGVizyon özelliklerini gerçek kullanım alanlarına göre gruplayarak daha hızlı karar vermenizi sağlar."
      />

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {landingFeatureGroups.map((group) => {
          const Icon = group.icon;
          return (
            <article key={group.title} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_18px_50px_rgba(14,165,233,0.10)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 text-blue-600">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-black text-slate-950">{group.title}</h3>
              <div className="mt-5 space-y-3">
                {group.items.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-600" />
                    <span className="text-sm leading-7 text-slate-600">{item}</span>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
