import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlarmClock,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Clock3,
  Building2,
  ClipboardList,
  CreditCard,
  FileCheck,
  Layers3,
  Link2,
  LineChart,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const featureCards = [
  {
    title: "Personel Havuzu",
    description: "İSG uzmanı, işyeri hekimi ve DSP personelini tek panelden yönetin. Kapasite, doluluk ve firma dağılımını birlikte görün.",
    icon: Users,
  },
  {
    title: "Firma Yönetimi",
    description: "Hizmet verdiğiniz firmaları, tehlike sınıfını, çalışan sayısını ve sözleşme tarihlerini merkezi olarak takip edin.",
    icon: Building2,
  },
  {
    title: "Atama Takibi",
    description: "Personel-firma atamalarını dakika bazında izleyin. Eksik süre, çakışan atama ve uygunsuzlukları anında görün.",
    icon: Briefcase,
  },
  {
    title: "Evrak Takibi",
    description: "Risk değerlendirmesi, ADEP, kurul toplantısı ve diğer İSG evraklarının geçerlilik tarihlerini yönetin.",
    icon: FileCheck,
  },
  {
    title: "Süre ve Kapasite Analizi",
    description: "Asgari hizmet süresi uyumu, uzman yoğunluğu ve portföy kapasitesini otomatik olarak hesaplayın.",
    icon: Activity,
    badge: "Önerilen",
  },
  {
    title: "Uyarı Merkezi",
    description: "Yaklaşan sözleşmeler, açık uygunsuzluklar, geciken görevler ve kritik firmalar için merkezi uyarı görünümü alın.",
    icon: AlarmClock,
    badge: "Operasyon",
  },
  {
    title: "Finans Yönetimi",
    description: "Firma bazlı tahsilatları, geciken ödemeleri, haftalık iş yükünü ve ödeme takvimini aynı ekranda yönetin.",
    icon: CreditCard,
  },
  {
    title: "İSG-KATİP Entegrasyonu",
    description: "Mevcut entegrasyondan gelen firma, süre ve uyum verilerini operasyon panelinde doğrudan kullanın.",
    icon: Link2,
  },
  {
    title: "Görev ve Otomasyon",
    description: "Evrak ve belge yenileme görevlerini otomatik üretin, operasyon görevlerini merkezi olarak yönetin.",
    icon: Clock3,
    badge: "Otomasyon",
  },
];

const benefitItems = [
  "Portföyünüzdeki riskli firmaları tek bakışta görün.",
  "Uzman başına düşen firma ve dakika yükünü ölçün.",
  "Sözleşme, kurul ve uyumsuzluk takibini tek panelde toplayın.",
  "İSG-KATİP verisini operasyon kararına dönüştürün.",
  "İlerleyen fazlarda evrak ve finans takibini aynı modüle ekleyin.",
  "OSGB yöneticisi ve operasyon sorumlusu için gerçek çalışma ekranı oluşturun.",
];

const workflowSteps = [
  {
    title: "Portföyü içe alın",
    description: "İSG-KATİP üzerinden gelen firma ve sözleşme verilerini tek havuzda toplayın.",
  },
  {
    title: "Kapasiteyi ölçün",
    description: "Atanmış dakika, gerekli dakika ve uzman doluluk oranlarını karşılaştırın.",
  },
  {
    title: "Kritik alanları bulun",
    description: "Uyumsuzluk bayrakları, yaklaşan sözleşmeler ve açık görevleri tespit edin.",
  },
  {
    title: "Operasyonu yönetin",
    description: "Firma takibi, atama yönetimi ve sonraki fazdaki finans/evrak modüllerine geçin.",
  },
];

const launchCards = [
  {
    title: "Portföy Dashboard",
    description: "Riskli firmalar, uzman yoğunluğu ve trendler",
    icon: Layers3,
    href: "/osgb/dashboard",
  },
  {
    title: "Görevlendirme",
    description: "Atama, kapasite ve mevzuat öneri motoru",
    icon: Briefcase,
    href: "/osgb/assignments",
  },
  {
    title: "Finans ve Evrak",
    description: "Tahsilat planı ve evrak yenileme takibi",
    icon: CreditCard,
    href: "/osgb/finance",
  },
  {
    title: "Trend Analizi",
    description: "Finans ve evrak trendlerine drill-down",
    icon: LineChart,
    href: "/osgb/analytics?view=finance",
  },
];

export default function OSGBModule() {
  const navigate = useNavigate();

  const phaseBadge = useMemo(() => {
    return (
      <Badge variant="secondary" className="border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
        İSG-KATİP verisi ile çalışır
      </Badge>
    );
  }, []);

  return (
    <div className="container mx-auto space-y-8 py-6">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] p-6 shadow-2xl shadow-slate-950/40">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">
                <Briefcase className="h-6 w-6" />
              </div>
              {phaseBadge}
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-white">OSGB Yönetim Modülü</h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Firma, personel, atama ve sözleşme operasyonunu tek bir yönetim katmanında toplayın.
                Mevcut İSG-KATİP verilerini kullanarak portföy görünümü, uzman yoğunluğu ve kritik açıkları
                operasyon ekranına dönüştürün.
              </p>
            </div>
            <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-2 flex items-center gap-2 text-cyan-200">
                  <Building2 className="h-4 w-4" />
                  Portföy görünümü
                </div>
                <p className="text-xs text-slate-400">Riskli firma, sözleşme ve açık dağılımı tek bakışta görülür.</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-2 flex items-center gap-2 text-cyan-200">
                  <Users className="h-4 w-4" />
                  Uzman yük takibi
                </div>
                <p className="text-xs text-slate-400">Uzman bazlı şirket, çalışan ve dakika yükü merkezi olarak yönetilir.</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-2 flex items-center gap-2 text-cyan-200">
                  <ShieldAlert className="h-4 w-4" />
                  Kritik uyarılar
                </div>
                <p className="text-xs text-slate-400">Açık uyumsuzluklar ve yaklaşan sözleşmeler önceliklendirilir.</p>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[280px]">
            <Button size="lg" className="justify-between" onClick={() => navigate("/osgb/dashboard")}>
              OSGB Dashboard'u Aç
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/isg-bot")}>
              Akıllı İSG Operasyon Botu'na Git
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold text-white">
          <BadgeCheck className="h-5 w-5 text-cyan-300" />
          Özellikler
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="border-slate-800 bg-slate-900/70">
                <CardHeader className="space-y-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    {item.badge ? <Badge variant="outline">{item.badge}</Badge> : null}
                  </div>
                  <div>
                    <CardTitle className="text-xl text-white">{item.title}</CardTitle>
                    <CardDescription className="pt-2 text-sm leading-6 text-slate-400">
                      {item.description}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">OSGB modülü ile ne kazanırsınız?</CardTitle>
            <CardDescription>Bu modül mevcut İSG-KATİP entegrasyonunu operasyon ekranına çevirir.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {benefitItems.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <p className="text-sm text-slate-300">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Kullanım akışı</CardTitle>
            <CardDescription>İlk sürüm için önerilen çalışma sırası.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {workflowSteps.map((step, index) => (
              <div key={step.title} className="flex gap-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10 text-sm font-semibold text-cyan-200">
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium text-white">{step.title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{step.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold text-white">
          <BadgeCheck className="h-5 w-5 text-cyan-300" />
          Hızlı başlat
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {launchCards.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => navigate(item.href)}
                className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 text-left transition hover:border-cyan-500/30 hover:bg-slate-900"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-base font-semibold text-white">{item.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <ClipboardList className="h-5 w-5 text-cyan-300" />
            Operasyon paketi kapsamı
          </CardTitle>
          <CardDescription>OSGB modülü artık gerçek operasyon ekranları ve kendi veri tabloları ile çalışır.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="text-sm font-semibold text-white">Canlı modüller</div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Dashboard, personel havuzu, görevlendirme, firma takibi, finans, evrak, görev motoru ve trend analizi hazır.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="text-sm font-semibold text-white">Mevcut veri kaynağı</div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              `isgkatip_companies`, `isgkatip_compliance_flags`, `isgkatip_predictive_alerts` ve OSGB operasyon tabloları birlikte kullanılır.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="text-sm font-semibold text-white">Otomasyon desteği</div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Evrak yenileme görevleri ve belge bitiş otomasyonları operasyon akışını destekler.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
