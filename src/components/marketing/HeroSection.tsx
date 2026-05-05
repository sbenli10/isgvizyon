import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { landingHeroStats } from "@/lib/landingContent";

type HeroSectionProps = {
  onRequestDemo: () => void;
  onInspectFeatures: () => void;
};

const floatingInsights = [
  "AI Risk Analizi Aktif",
  "Aksiyon Önerisi Oluşturuldu",
  "Rapor Özeti Hazır",
  "Yüksek Riskli Alan Tespit Edildi",
];

export function HeroSection({ onRequestDemo, onInspectFeatures }: HeroSectionProps) {
  return (
    <section className="relative mx-auto grid min-h-[78vh] max-w-7xl gap-12 overflow-visible px-4 py-10 xl:grid-cols-[0.96fr_1.04fr] xl:items-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[8%] top-[8%] h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-[160px]" />
        <div className="absolute bottom-[6%] right-[4%] h-[420px] w-[420px] rounded-full bg-blue-500/12 blur-[160px]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(148,163,184,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.55)_1px,transparent_1px)] [background-size:120px_120px]" />
      </div>

      <div className="relative z-10 space-y-8">
        <Badge className="inline-flex items-center rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-cyan-100 backdrop-blur">
          <Sparkles className="mr-2 h-4 w-4 text-cyan-300" />
          <span className="text-xs font-semibold tracking-[0.18em] uppercase">
            AI Destekli İSG Platformu
          </span>
        </Badge>

        <div className="space-y-5">
          <h1 className="text-5xl font-semibold leading-[0.98] tracking-[-0.065em] text-white md:text-7xl">
            Riskleri Sadece
            <br />
            Kaydetmeyin,
            <br />
            <span className="bg-gradient-to-r from-[#22D3EE] via-[#60A5FA] to-[#93C5FD] bg-clip-text text-transparent">
              Önceden Görün
            </span>
          </h1>

          <p className="max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
            İSGVizyon, saha denetimleri, uygunsuzluklar, riskler ve aksiyon verilerini yapay zeka ile analiz ederek İSG süreçlerinizi daha görünür, ölçülebilir ve yönetilebilir hale getirir.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <Button
            onClick={onRequestDemo}
            className="h-14 rounded-2xl bg-gradient-to-r from-[#22D3EE] via-[#2563EB] to-[#5B7CFA] px-8 text-base font-semibold text-slate-950 shadow-[0_18px_60px_rgba(34,211,238,0.22)] transition-transform duration-200 hover:-translate-y-[1px] hover:from-cyan-200 hover:via-blue-400 hover:to-indigo-300"
          >
            Panele Git
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>

          <Button
            variant="outline"
            onClick={onInspectFeatures}
            className="h-14 rounded-2xl border-white/12 bg-white/[0.03] px-8 text-base font-semibold text-slate-100 backdrop-blur hover:bg-white/[0.06] hover:text-white"
          >
            Özellikleri İncele
          </Button>
        </div>

        <div className="grid gap-2 pt-2 text-sm text-slate-400 sm:grid-cols-2">
          {[
            "Merkezi kayıt ve izlenebilir aksiyon takibi",
            "Yapay zeka ile risk önceliklendirme",
            "Yönetici raporlaması için görünür veri akışı",
            "Kurumsal ekipler için rol bazlı operasyon modeli",
          ].map((item) => (
            <div key={item} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-3 pt-2 sm:grid-cols-2 xl:grid-cols-4">
          {landingHeroStats.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="rounded-[22px] border border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.72)] p-4 backdrop-blur-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.label}</span>
                  <Icon className="h-4 w-4 text-cyan-300" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
                <p className="mt-2 text-xs leading-6 text-slate-400">{item.hint}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute -inset-3 -z-10 rounded-[44px] bg-gradient-to-r from-cyan-500/24 via-blue-500/18 to-sky-500/24 blur-2xl" />

        <div className="relative overflow-hidden rounded-[36px] border border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.72)] p-3 shadow-[0_30px_110px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <div className="rounded-[30px] border border-white/8 bg-[#081224] p-6">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                  Ürün
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  İSGVizyon Risk Intelligence Paneli
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Saha verisini analiz eden, riskleri önceliklendiren ve yöneticilere karar desteği veren görünüm.
                </p>
              </div>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                Canlı Panel
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[22px] border border-cyan-400/20 bg-cyan-400/10 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">AI Risk Skoru</p>
                <p className="mt-3 text-4xl font-semibold text-white">84/100</p>
                <p className="mt-2 text-sm text-slate-300">Yapay zeka kritik alanları öncelikli takip listesine taşıdı.</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Tamamlanan Denetim</p>
                <p className="mt-3 text-4xl font-semibold text-white">%92</p>
                <p className="mt-2 text-sm text-slate-300">Operasyon görünürlüğü sayesinde saha denetimleri tek panelde takip ediliyor.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                {[
                  { label: "Kritik Uygunsuzluk", value: "17", tone: "warning" },
                  { label: "Geciken Aksiyon", value: "9", tone: "warning" },
                  { label: "Akıllı Öneri", value: "12", tone: "primary" },
                ].map((row) => (
                  <div
                    key={row.label}
                    className={`rounded-[20px] border p-4 ${
                      row.tone === "warning"
                        ? "border-amber-400/20 bg-amber-400/10"
                        : "border-cyan-400/20 bg-cyan-400/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-200">{row.label}</span>
                      <span className="text-lg font-semibold text-white">{row.value}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,18,36,0.96),rgba(7,17,31,0.98))] p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">Risk Trend Analizi</p>
                  <TrendingUp className="h-4 w-4 text-cyan-300" />
                </div>
                <div className="mt-5 space-y-4">
                  {[74, 82, 91, 88, 95].map((value, index) => (
                    <div key={`${value}-${index}`} className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Alan {index + 1}</span>
                        <span>{value}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/8">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-sky-400"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2 text-sm text-white">
                    <Workflow className="h-4 w-4 text-cyan-300" />
                    Akıllı Aksiyon Önerileri
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Tekrarlayan saha bulgularına göre bakım alanı, depo geçişleri ve enerji izolasyonu öncelikli aksiyon listesine alındı.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute -left-4 top-[10%] hidden w-44 rounded-[20px] border border-white/10 bg-[rgba(15,23,42,0.78)] px-4 py-3 text-sm text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:block">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            {floatingInsights[0]}
          </div>
        </div>
        <div className="pointer-events-none absolute -right-6 top-[16%] hidden w-48 rounded-[20px] border border-white/10 bg-[rgba(15,23,42,0.78)] px-4 py-3 text-sm text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:block">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            {floatingInsights[1]}
          </div>
        </div>
        <div className="pointer-events-none absolute left-[8%] top-[78%] hidden w-44 rounded-[20px] border border-white/10 bg-[rgba(15,23,42,0.78)] px-4 py-3 text-sm text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:block">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cyan-300" />
            {floatingInsights[2]}
          </div>
        </div>
        <div className="pointer-events-none absolute right-[4%] top-[84%] hidden w-52 rounded-[20px] border border-white/10 bg-[rgba(15,23,42,0.78)] px-4 py-3 text-sm text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:block">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[#FF9F1C]" />
            {floatingInsights[3]}
          </div>
        </div>
      </div>
    </section>
  );
}
