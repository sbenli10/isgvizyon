import { useMemo, useState } from "react";
import { ArrowRight, Check, Search, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LandingLayout } from "@/components/marketing/LandingLayout";
import { platformFeatureCatalog, type PlatformFeatureCard } from "@/lib/landingContent";

const categories = ["Tümü", "Yönetim", "Risk", "Saha", "Belgeler", "Çalışan", "Planlama", "AI", "OSGB"] as const;

const accentStyles: Record<PlatformFeatureCard["accent"], { icon: string; border: string; glow: string }> = {
  cyan: { icon: "bg-cyan-500/15 text-cyan-300 ring-cyan-400/25", border: "hover:border-cyan-400/50", glow: "bg-cyan-400" },
  blue: { icon: "bg-blue-500/15 text-blue-300 ring-blue-400/25", border: "hover:border-blue-400/50", glow: "bg-blue-400" },
  violet: { icon: "bg-violet-500/15 text-violet-300 ring-violet-400/25", border: "hover:border-violet-400/50", glow: "bg-violet-400" },
  emerald: { icon: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/25", border: "hover:border-emerald-400/50", glow: "bg-emerald-400" },
  amber: { icon: "bg-amber-500/15 text-amber-300 ring-amber-400/25", border: "hover:border-amber-400/50", glow: "bg-amber-400" },
  rose: { icon: "bg-rose-500/15 text-rose-300 ring-rose-400/25", border: "hover:border-rose-400/50", glow: "bg-rose-400" },
};

export default function LandingFeatures() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("Tümü");
  const [searchQuery, setSearchQuery] = useState("");

  const visibleFeatures = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("tr-TR");
    return platformFeatureCatalog.filter((feature) => {
      const matchesCategory = activeCategory === "Tümü" || feature.category === activeCategory;
      const matchesSearch = !normalizedQuery || `${feature.title} ${feature.description} ${feature.category}`.toLocaleLowerCase("tr-TR").includes(normalizedQuery);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  return (
    <LandingLayout
      eyebrow="Kapsamlı İSG çözümü"
      title="Platformda neler yapabilirsiniz?"
      description="İSGVizyon'daki operasyon, belge, analiz ve OSGB araçlarını keşfedin. Her özellik gerçek bir iş akışını daha hızlı ve izlenebilir hale getirir."
    >
      <section className="isgvizyon-feature-catalog overflow-hidden rounded-2xl border border-slate-800 bg-[#07101f] text-white shadow-[0_24px_80px_rgba(2,6,23,0.18)]">
        <div className="border-b border-slate-800 bg-slate-950/70 p-4 md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                Tüm özellikler
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-400">{platformFeatureCatalog.length} ayrı araç ve iş akışı tek platformda.</p>
            </div>

            <label className="relative block w-full xl:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Özelliklerde ara..."
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15"
              />
            </label>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={[
                  "h-8 shrink-0 rounded-md border px-3 text-xs font-bold transition",
                  activeCategory === category
                    ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-200"
                    : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-white",
                ].join(" ")}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-px bg-slate-800 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {visibleFeatures.map((card) => {
          const Icon = card.icon;
          const accent = accentStyles[card.accent];
          return (
            <article
              key={card.title}
              className={`isgvizyon-feature-card group relative flex min-h-[218px] flex-col overflow-hidden bg-[#0b1425] p-5 transition duration-200 ${accent.border}`}
            >
              <span className={`absolute left-0 top-0 h-px w-0 transition-all duration-300 group-hover:w-full ${accent.glow}`} />
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${accent.icon}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                {card.badge ? (
                  <Badge className="rounded-md border border-blue-400/40 bg-blue-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider !text-white">
                    {card.badge}
                  </Badge>
                ) : null}
              </div>
              <p className="isgvizyon-feature-category mt-4 text-[10px] font-black uppercase tracking-[0.16em]">{card.category}</p>
              <h2 className="isgvizyon-feature-title mt-1.5 text-base font-black leading-6">{card.title}</h2>
              <p className="isgvizyon-feature-description mt-2 flex-1 text-xs font-medium leading-5">{card.description}</p>
              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="isgvizyon-feature-action mt-4 inline-flex w-fit items-center gap-1.5 text-[11px] font-bold transition hover:opacity-80"
              >
                Platformda kullan
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </article>
          );
        })}
        </div>

        {visibleFeatures.length === 0 ? (
          <div className="border-t border-slate-800 px-5 py-14 text-center">
            <Search className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm font-bold text-white">Aramanızla eşleşen özellik bulunamadı.</p>
            <button type="button" onClick={() => { setSearchQuery(""); setActiveCategory("Tümü"); }} className="mt-2 text-xs font-bold text-cyan-300 hover:text-cyan-200">
              Filtreleri temizle
            </button>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 shadow-sm md:grid-cols-[1fr_auto] md:items-center md:p-7">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-emerald-700">
            <Check className="h-4 w-4" />
            İhtiyacınıza göre ölçeklenen yapı
          </div>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-slate-950">Doğru paketi seçin, ihtiyacınız olan araçlarla başlayın.</h2>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">Ücretsiz, Premium ve OSGB paketlerini özellik ve kullanım limitleriyle yan yana karşılaştırın.</p>
        </div>
        <Button onClick={() => navigate("/landing/pricing")} className="h-11 rounded-lg bg-blue-600 px-5 font-black text-white hover:bg-blue-500">
          Paketleri karşılaştır
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </section>
    </LandingLayout>
  );
}
