import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Layers3,
  MessageCircle,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type HeroSectionProps = {
  onRequestDemo: () => void;
  onInspectFeatures: () => void;
};

const metricCards = [
  {
    label: "Toplam Firma",
    value: "128",
    change: "+18%",
    tone: "from-sky-500 to-blue-600",
    soft: "bg-sky-50 text-sky-700 ring-sky-100",
    icon: Building2,
  },
  {
    label: "Aktif Çalışan",
    value: "4.820",
    change: "+426",
    tone: "from-cyan-500 to-teal-500",
    soft: "bg-cyan-50 text-cyan-700 ring-cyan-100",
    icon: Users,
  },
  {
    label: "Risk Analizi",
    value: "342",
    change: "92%",
    tone: "from-indigo-500 to-blue-600",
    soft: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    icon: ShieldCheck,
  },
  {
    label: "Sertifika",
    value: "1.764",
    change: "+64",
    tone: "from-emerald-500 to-green-600",
    soft: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    icon: FileText,
  },
];

const processRows = [
  {
    title: "Risk değerlendirme raporu",
    status: "Hazır",
    progress: "92%",
    color: "from-blue-600 to-cyan-400",
  },
  {
    title: "Yıllık eğitim planı",
    status: "Planlandı",
    progress: "76%",
    color: "from-violet-600 to-fuchsia-400",
  },
  {
    title: "Acil durum planı",
    status: "Güncel",
    progress: "88%",
    color: "from-amber-500 to-orange-400",
  },
  {
    title: "OSGB doküman arşivi",
    status: "Senkron",
    progress: "100%",
    color: "from-emerald-500 to-teal-400",
  },
];

const quickActions = [
  {
    title: "Risk Raporu",
    icon: ShieldCheck,
    className: "from-blue-600 to-cyan-500 shadow-blue-500/25",
  },
  {
    title: "Eğitim Planı",
    icon: ClipboardCheck,
    className: "from-violet-600 to-fuchsia-500 shadow-violet-500/25",
  },
  {
    title: "Sertifika",
    icon: FileCheck2,
    className: "from-emerald-600 to-teal-500 shadow-emerald-500/25",
  },
];

function DashboardMockup() {
  return (
    <div className="relative mx-auto mt-10 w-full max-w-6xl px-3 sm:mt-12 lg:mt-14">
      <div className="pointer-events-none absolute -left-5 top-20 hidden h-28 w-28 rounded-[2rem] bg-gradient-to-br from-sky-300 to-blue-600 opacity-70 blur-sm md:block" />

      <div className="pointer-events-none absolute -right-3 bottom-8 hidden h-48 w-32 rotate-[-12deg] rounded-[2.2rem] border border-sky-100 bg-white p-2 shadow-[0_30px_80px_rgba(15,23,42,0.22)] lg:block">
        <div className="h-full rounded-[1.7rem] bg-gradient-to-b from-sky-50 via-white to-cyan-50 p-3">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300" />

          <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 p-3 text-white shadow-lg shadow-blue-500/20">
            <p className="text-[10px] font-black uppercase tracking-wider text-white/80">Mobil Panel</p>
            <p className="mt-2 text-2xl font-black">84%</p>
            <p className="mt-1 text-[10px] font-semibold text-white/80">Uyumluluk skoru</p>
          </div>

          <div className="mt-3 space-y-2">
            <div className="h-8 rounded-xl bg-white shadow-sm" />
            <div className="h-8 rounded-xl bg-cyan-100/70" />
            <div className="h-8 rounded-xl bg-blue-100/70" />
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_35px_100px_rgba(15,23,42,0.20)] ring-1 ring-white">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-sky-50 via-white to-cyan-50" />

        <div className="relative flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>

          <div className="hidden rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-semibold text-slate-500 shadow-sm sm:block">
            app.isgvizyon.com/dashboard
          </div>

          <Badge className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-700 hover:bg-cyan-50">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            AI Öneri Aktif
          </Badge>
        </div>

        <div className="relative grid min-h-[440px] bg-white md:grid-cols-[235px_minmax(0,1fr)]">
          <aside className="hidden border-r border-slate-200 bg-slate-950 p-5 text-white md:block">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm font-black">ISGVizyon</p>
                <p className="text-[11px] text-slate-400">İSG Yönetim Paneli</p>
              </div>
            </div>

            <div className="mt-8 space-y-2 text-sm">
              {["Dashboard", "Firmalar", "Risk Analizi", "Eğitim Planı", "Sertifika", "OSGB Arşiv"].map(
                (item, index) => (
                  <div
                    key={item}
                    className={[
                      "flex items-center gap-2 rounded-xl px-3 py-2.5 font-semibold transition",
                      index === 0
                        ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-500/20"
                        : "text-slate-300",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-1.5 w-1.5 rounded-full",
                        index === 0 ? "bg-white" : "bg-slate-600",
                      ].join(" ")}
                    />
                    {item}
                  </div>
                ),
              )}
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Bugünkü durum</p>
              <p className="mt-2 text-2xl font-black text-white">23</p>
              <p className="mt-1 text-xs text-slate-400">Tamamlanacak aksiyon</p>
            </div>
          </aside>

          <div className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black text-slate-900">Operasyon Özeti</p>
                <p className="mt-1 text-xs text-slate-500">
                  Firmalar, çalışanlar, eğitimler ve dokümanlar tek akışta.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {quickActions.map((action) => {
                  const Icon = action.icon;

                  return (
                    <button
                      key={action.title}
                      type="button"
                      className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${action.className} px-4 py-2 text-xs font-black text-white shadow-lg transition hover:-translate-y-0.5`}
                    >
                      <Icon className="h-4 w-4" />
                      {action.title}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metricCards.map((metric) => {
                const Icon = metric.icon;

                return (
                  <div
                    key={metric.label}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    <div className="flex items-center justify-between">
                      <div className={`rounded-xl p-2 ring-1 ${metric.soft}`}>
                        <Icon className="h-4 w-4" />
                      </div>

                      <span
                        className={`rounded-full bg-gradient-to-r ${metric.tone} px-2.5 py-1 text-[10px] font-black text-white shadow-sm`}
                      >
                        {metric.change}
                      </span>
                    </div>

                    <p className="mt-4 text-2xl font-black text-slate-900">{metric.value}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{metric.label}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-900">İSG Süreç Akışı</p>
                    <p className="mt-1 text-xs text-slate-500">Canlı takip ve otomatik durum kontrolü</p>
                  </div>

                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                    Canlı
                  </span>
                </div>

                <div className="space-y-3">
                  {processRows.map((row) => (
                    <div key={row.title} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-slate-700">{row.title}</p>
                        <span className="text-[11px] font-black text-blue-600">{row.status}</span>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${row.color}`}
                          style={{ width: row.progress }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

             <div className="overflow-hidden rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25">
                  <Sparkles className="h-5 w-5" />
                </div>

                <Badge className="rounded-full border border-blue-100 bg-white px-3 py-1 !text-blue-700 shadow-sm hover:bg-white">
                  Akıllı analiz
                </Badge>
              </div>

              <p className="mt-4 text-sm font-black !text-slate-950">
                AI karar desteği
              </p>

              <p className="mt-2 text-xs font-semibold leading-6 !text-slate-700">
                Geciken aksiyonları, yüksek riskli firmaları ve eksik evrakları otomatik görünür kılar.
              </p>

              <div className="mt-5 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                <p className="text-[11px] font-bold !text-slate-600">
                  Önerilen aksiyon
                </p>
                <p className="mt-1 text-sm font-black !text-slate-950">
                  7 kritik kayıt önceliklendirildi
                </p>
              </div>

              <button
                type="button"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-black !text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5"
              >
                AI önerilerini incele
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroSection({ onRequestDemo, onInspectFeatures }: HeroSectionProps) {
  return (
    <section className="relative left-1/2 -ml-[50vw] -mt-10 min-h-[calc(100vh-120px)] w-screen max-w-none overflow-hidden bg-white px-5 pb-14 pt-16 text-slate-950 sm:px-8 lg:px-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.14),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fbff_58%,#eef7ff_100%)]" />
        <div className="absolute -left-40 top-24 h-[32rem] w-[32rem] rounded-full bg-sky-100 opacity-90 blur-2xl" />
        <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-[45%] bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-400 opacity-95 blur-[1px]" />
        <div className="absolute -right-24 top-16 h-[42rem] w-[42rem] rounded-[35%] bg-blue-100 opacity-80" />
        <div className="absolute bottom-8 right-[-6rem] h-[28rem] w-[18rem] rotate-[-18deg] rounded-[8rem] bg-gradient-to-b from-blue-700 via-sky-500 to-cyan-400 opacity-95" />
        <div className="absolute bottom-36 right-20 h-72 w-72 rounded-full bg-cyan-300/40 blur-3xl" />
        <div className="absolute right-16 top-[45%] hidden select-none text-[10rem] font-black leading-none tracking-[-0.08em] text-white/80 md:block lg:text-[14rem]">
          İSGVİZYON
        </div>
        <div className="absolute left-[12%] top-16 h-[30rem] w-[30rem] rounded-full border border-sky-100/80" />
        <div className="absolute left-[14%] top-12 h-[34rem] w-[34rem] rounded-full border border-sky-50" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center text-center">
        <Badge className="rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-xs font-black tracking-[0.22em] text-sky-600 shadow-sm backdrop-blur hover:bg-white">
          <Zap className="mr-2 h-3.5 w-3.5 fill-sky-500 text-sky-500" />
          ISGVizyon İSG Yönetim Platformu
        </Badge>

        <h1 className="mt-7 max-w-5xl text-4xl font-black leading-[1.04] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl">
          İSG Süreçlerinizi
          <span className="block bg-gradient-to-r from-sky-400 via-cyan-500 to-blue-700 bg-clip-text text-transparent">
            Tek Panelden Yönetin
          </span>
        </h1>

        <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
          Firmalar, çalışanlar, risk analizleri, eğitimler, sertifikalar, yıllık planlar ve İSG dokümanlarını tek
          merkezden yönetin.
        </p>

        <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <Button
            onClick={onRequestDemo}
            className="h-14 rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 px-7 text-base font-black text-white shadow-[0_18px_45px_rgba(37,99,235,0.30)] transition hover:-translate-y-0.5 hover:from-blue-500 hover:via-sky-400 hover:to-cyan-300"
          >
            Ücretsiz Deneyin
            <ArrowRight className="h-5 w-5" />
          </Button>

          <Button
            onClick={onInspectFeatures}
            className="h-14 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 px-7 text-base font-black text-white shadow-[0_18px_45px_rgba(168,85,247,0.25)] transition hover:-translate-y-0.5 hover:from-violet-500 hover:via-fuchsia-400 hover:to-pink-400"
          >
            <Layers3 className="h-5 w-5" />
            Modülleri İncele
          </Button>

          <Button
            variant="outline"
            onClick={onRequestDemo}
            className="h-14 rounded-full border-sky-200 bg-white/90 px-7 text-base font-black text-blue-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-sky-50 hover:text-blue-800"
          >
            <PlayCircle className="h-5 w-5" />
            Demo Talep Et
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm font-bold text-slate-600">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Kurulum gerektirmez
          </span>

          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-blue-700">
            <CheckCircle2 className="h-4 w-4" />
            Web tabanlı panel
          </span>

          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-violet-700">
            <CheckCircle2 className="h-4 w-4" />
            AI destekli takip
          </span>
        </div>

        <DashboardMockup />
      </div>

      <button
        type="button"
        onClick={onRequestDemo}
        aria-label="Demo talep et"
        className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-600 text-white shadow-[0_16px_45px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5 hover:from-emerald-300 hover:to-green-500"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </section>
  );
}