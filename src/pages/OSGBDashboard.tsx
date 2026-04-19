import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  Briefcase,
  Building2,
  FileCheck,
  Globe2,
  GraduationCap,
  Link2,
  LineChart,
  MapPinned,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOsgbAccess } from "@/hooks/useOsgbAccess";
import { OsgbOnboardingChecklist } from "@/components/osgb/OsgbOnboardingChecklist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const coreModules = [
  {
    title: "Firma Havuzu",
    description: "İSG-KATİP, Excel veya manuel girişle firmaları havuza alın ve tüm operasyonu aynı veri üzerinden yönetin.",
    icon: Building2,
    href: "/osgb/company-tracking",
  },
  {
    title: "Personel ve Atamalar",
    description: "Uzman, hekim ve DSP görevlendirmelerini dakika baskısı ile birlikte görün.",
    icon: Briefcase,
    href: "/osgb/assignments",
  },
  {
    title: "Saha Operasyonu",
    description: "Ziyaret planı, hizmet ispatı ve kanıt seviyesini operasyon takibine bağlayın.",
    icon: MapPinned,
    href: "/osgb/field-visits",
  },
  {
    title: "Yasal Evraklar",
    description: "Eksik ve geciken evrakları neden gerekli ve ne yapmalıyım mantığıyla yönetin.",
    icon: FileCheck,
    href: "/osgb/documents",
  },
  {
    title: "Finans ve Karlılık",
    description: "Cari, tahsilat baskısı ve müşteri kârlılığını aynı yerde izleyin.",
    icon: Wallet,
    href: "/osgb/finance",
  },
  {
    title: "Otomasyon ve Portal",
    description: "Görev üretimi, müşteri portalı ve görünür hizmet akışını tek sistemde tutun.",
    icon: Globe2,
    href: "/osgb/automation",
  },
];

const serviceModules = [
  "Kurul toplantıları",
  "Risk değerlendirmesi",
  "İş kazası ve DÖF yönetimi",
  "Yıllık plan ve eğitim çıktıları",
  "Sertifika / katılım üretimi",
  "Rapor ve arşiv katmanı",
];

export default function OSGBDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { roleLabel, canViewCompanyHub, canViewFinance, canViewDocuments, canViewPortal } = useOsgbAccess();

  const onboardingSteps = useMemo(
    () => [
      {
        title: "İSG-KATİP verisini hazırla",
        description: "Extension kaynağından gelen firmaları önce organizasyon görünümüne alın.",
        href: "/osgb/isgkatip",
        done: false,
      },
      {
        title: "Firma havuzunu kur",
        description: "Yalnızca yöneteceğiniz firmaları OSGB havuzuna alın ve sözleşme bilgilerini tamamlayın.",
        href: "/osgb/company-tracking",
        done: false,
      },
      {
        title: "Atama ve kapasiteyi başlat",
        description: "Dakika açığını görün, ekip atayın ve hizmet döngüsünü canlıya alın.",
        href: "/osgb/assignments",
        done: false,
      },
      {
        title: "Saha, evrak ve finans takibini aç",
        description: "Operasyonun savunulabilir ve satılabilir kısmını buradan yürütün.",
        href: "/osgb/how-to",
        done: false,
      },
    ],
    [],
  );

  return (
    <div className="container mx-auto space-y-6 py-6">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.86))] p-6 shadow-2xl shadow-slate-950/40">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border border-cyan-400/20 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/10">
                OSGB başlangıç ekranı
              </Badge>
              <Badge variant="outline">Rol: {roleLabel}</Badge>
              {profile?.organization_id ? <Badge variant="outline">Organizasyon bağlı</Badge> : null}
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                OSGB modülü nasıl çalışır, nereden başlanır?
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                Bu ekran bir rapor dashboard&apos;u değil, OSGB ürününü ekip içinde nasıl kullanacağınızı anlatan başlangıç katmanıdır.
                Amaç; firmaları havuza almak, atamaları başlatmak, saha, evrak ve finans akışını tek müşteri yaşam döngüsünde toplamak.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <div className="mb-2 flex items-center gap-2 text-cyan-200">
                  <Building2 className="h-4 w-4" />
                  Portföy yönetimi
                </div>
                <p className="text-xs leading-5 text-slate-400">
                  Hangi firmalar sizde, hangileri havuzda, hangi firmada baskı var sorusuna cevap verir.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <div className="mb-2 flex items-center gap-2 text-cyan-200">
                  <ShieldAlert className="h-4 w-4" />
                  Savunulabilir hizmet
                </div>
                <p className="text-xs leading-5 text-slate-400">
                  Ziyaret, evrak, görev ve portal akışıyla verilen hizmetin kanıtını kurumsal hafızada tutar.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <div className="mb-2 flex items-center gap-2 text-cyan-200">
                  <LineChart className="h-4 w-4" />
                  Karlılık görünümü
                </div>
                <p className="text-xs leading-5 text-slate-400">
                  OSGB ürününü sadece operasyon paneli değil, sözleşme ve finans kararı veren merkez haline getirir.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button size="lg" className="justify-between" onClick={() => navigate("/osgb/how-to")}>
              Nasıl kullanılır
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/osgb/company-tracking")} disabled={!canViewCompanyHub}>
              Firma havuzunu aç
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/osgb/isgkatip")}>
              İSG-KATİP merkezine git
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">OSGB çekirdek modülleri</CardTitle>
            <CardDescription>Satılabilir ürün yüzeyi bu modüller etrafında kurulmalı.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {coreModules.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => navigate(item.href)}
                  className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-left transition hover:border-cyan-500/30 hover:bg-slate-900"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{item.description}</p>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <OsgbOnboardingChecklist
          title="Başlangıç sırası"
          description="İlk kez gelen OSGB kullanıcısı bu sırayla ilerlediğinde ürün daha anlaşılır ve kontrollü açılır."
          steps={onboardingSteps}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Firma 360 içinde açılacak hizmet modülleri</CardTitle>
            <CardDescription>Bu modüller ayrı route olarak yaşayabilir, ama firma içinden context ile açılmalıdır.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {serviceModules.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Bu rol için en kritik ekranlar</CardTitle>
            <CardDescription>Sidebar görünürlüğü rolünüze göre daraltıldı; aşağıdaki akış sizi en hızlı hedefe götürür.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="font-semibold text-white">OSGB sahibi / yönetici</div>
              <p className="mt-2 leading-6">Firma Havuzu, Personel ve Atamalar, Finans ve Karlılık, Trend Analizi.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="font-semibold text-white">Operasyon / koordinatör</div>
              <p className="mt-2 leading-6">Firma Havuzu, Dakika ve Kapasite, Saha Operasyonu, Otomasyon Merkezi.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="font-semibold text-white">Sekreterya / muhasebe</div>
              <p className="mt-2 leading-6">
                {canViewDocuments ? "Yasal Evraklar" : "Doküman görünümü"} · {canViewPortal ? "Müşteri Portalı" : "Portal görünümü"} · {canViewFinance ? "Finans ve Karlılık" : "Finans görünümü"}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Bot className="h-5 w-5 text-cyan-300" />
            Ürün mantığı
          </CardTitle>
          <CardDescription>İSGBot ve OSGB modülü artık farklı amaçlar için konumlanıyor.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="font-semibold text-white">İSGBot</div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Bireysel uzman asistanı, İSG-KATİP extension kaynağı ve kişisel karar destek katmanı.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="font-semibold text-white">OSGB Modülü</div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Firma havuzu, ekip operasyonu, saha, evrak, finans, portal ve analitiği aynı müşteri yaşam döngüsünde birleştirir.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
