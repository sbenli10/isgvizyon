import {
  ArrowRight,
  BellRing,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { landingHeroStats } from "@/lib/landingContent";

type HeroSectionProps = {
  onRequestDemo: () => void;
  onInspectFeatures: () => void;
};

const heroWorkflow = [
  {
    title: "Denetim akışı",
    value: "17 açık aksiyon",
    icon: ClipboardCheck,
    accent: "text-cyan-200",
    badge: "Güncel",
  },
  {
    title: "Çalışan havuzu",
    value: "12 firma / 1.248 kayıt",
    icon: Users,
    accent: "text-emerald-200",
    badge: "Merkezi",
  },
  {
    title: "Risk ve plan",
    value: "5 kritik başlık",
    icon: ShieldAlert,
    accent: "text-violet-200",
    badge: "Takipte",
  },
];

export function HeroSection({ onRequestDemo, onInspectFeatures }: HeroSectionProps) {
  return (
    <section className="grid gap-8 xl:grid-cols-[0.94fr_1.06fr] xl:items-center">
      <div className="max-w-2xl">
        <Badge className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-cyan-100">
          Operasyon odaklı İSG platformu
        </Badge>
        <h1 className="mt-6 text-[2.8rem] font-semibold leading-[0.94] tracking-[-0.06em] text-white sm:text-[3.8rem] lg:text-[4.5rem]">
          İSG operasyonlarınızı tek merkezden yönetin
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
          Denetim, çalışan takibi, kurul toplantıları, risk değerlendirme, acil durum planları ve saha aksiyonlarını
          Excel karmaşasından çıkarıp merkezi, izlenebilir ve raporlanabilir hale getirin.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={onRequestDemo}
            className="h-12 rounded-2xl bg-cyan-400 px-6 text-base font-semibold text-slate-950 hover:bg-cyan-300 sm:min-w-[180px]"
          >
            Demo Talep Et
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={onInspectFeatures}
            className="h-12 rounded-2xl border-white/12 bg-white/[0.04] px-6 text-base text-slate-100 hover:bg-white/[0.08] sm:min-w-[180px]"
          >
            Özellikleri İncele
          </Button>
        </div>

        <p className="mt-5 text-sm font-medium text-slate-300">
          OSGB’ler, şantiyeler ve çok lokasyonlu işletmeler için tasarlandı.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {landingHeroStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_16px_40px_rgba(2,6,23,0.22)]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-cyan-200">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{stat.label}</p>
                <p className="mt-2 text-xl font-semibold text-white">{stat.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{stat.hint}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_18%,rgba(34,211,238,0.14),transparent_26%),radial-gradient(circle_at_82%_12%,rgba(124,58,237,0.18),transparent_28%)] blur-3xl" />
        <div
          className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(13,19,32,0.96),rgba(8,12,22,0.98))] p-4 shadow-[0_30px_100px_rgba(2,6,23,0.32)] sm:p-6"
          role="img"
          aria-label="İSGVizyon operasyon merkezi görünümünü temsil eden örnek kontrol paneli"
        >
          <div className="rounded-[28px] border border-white/8 bg-[#0a1020]">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/12 text-cyan-200">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Operasyon Merkezi</p>
                  <p className="text-xs text-slate-400">Tek panelden günlük İSG görünümü</p>
                </div>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Sistem hazır
                </span>
              </div>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-[1.1fr_0.9fr] sm:p-5">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Aktif görev", value: "24", tone: "text-cyan-200" },
                    { label: "Kritik bulgu", value: "6", tone: "text-rose-200" },
                    { label: "Yaklaşan termin", value: "14", tone: "text-amber-200" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[20px] border border-white/8 bg-[#10182b] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                      <p className={`mt-3 text-2xl font-semibold ${item.tone}`}>{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-[22px] border border-white/8 bg-[#0d1527] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Bugünün akışı</p>
                      <p className="mt-1 text-xs text-slate-400">Takip, görev ve yönetim görünürlüğü</p>
                    </div>
                    <BellRing className="h-4 w-4 text-cyan-200" />
                  </div>
                  <div className="mt-4 space-y-3">
                    {heroWorkflow.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.title}
                          className="flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-2xl bg-white/[0.05] ${item.accent}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">{item.title}</p>
                              <p className="text-xs text-slate-400">{item.value}</p>
                            </div>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-slate-200">
                            {item.badge}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(19,29,50,0.92),rgba(13,20,33,0.96))] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Yönetici Özeti</p>
                  <h3 className="mt-3 text-lg font-semibold text-white">İSG süreçleri tek merkezde</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    Denetim, çalışan, risk ve raporlama akışlarını dağınık dosyalar yerine izlenebilir bir panelde toplayın.
                  </p>
                  <div className="mt-4 grid gap-3">
                    {[
                      "Görev ve sorumlu görünürlüğü",
                      "Firma bazlı çalışan ve evrak takibi",
                      "Yönetim için daha hızlı raporlama",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-3 rounded-[18px] bg-white/[0.04] px-3 py-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                        <p className="text-sm text-slate-200">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-[#0e1628] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Canlı iş yükü</p>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: "Denetimler", value: "42 / ay" },
                      { label: "Çalışan kayıtları", value: "1.248" },
                      { label: "Aktif firmalar", value: "18" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between border-b border-white/6 pb-3 last:border-none last:pb-0">
                        <span className="text-sm text-slate-300">{item.label}</span>
                        <span className="text-sm font-semibold text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
