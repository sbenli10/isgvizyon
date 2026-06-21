import { useRef, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck,
  KeyRound,
  Link2,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OSGBManagementDialog } from "@/components/osgb/OSGBManagementDialog";

const features = [
  {
    title: "Personel Havuzu",
    description: "İGU, işyeri hekimi ve DSP ekiplerinizi rol, kapasite ve doluluk bilgileriyle tek merkezde yönetin.",
    icon: Users,
    badge: "YENİ",
  },
  {
    title: "Firma Yönetimi",
    description: "Hizmet verilen firmaları, sözleşmeleri ve tehlike sınıfı bilgilerini güncel tutun.",
    icon: Building2,
  },
  {
    title: "Atama Takibi",
    description: "Firma-personel eşleşmelerini dakika bazında izleyin, eksik süreleri hızlıca yakalayın.",
    icon: Briefcase,
  },
  {
    title: "Evrak Takibi",
    description: "Yasal belge, yükümlülük ve geçerlilik tarihlerini operasyon akışına bağlayın.",
    icon: FileCheck,
  },
  {
    title: "Personel Görevlendirme",
    description: "Uygun personeli doğru firmaya yönlendiren pratik görevlendirme akışları oluşturun.",
    icon: UserPlus,
    badge: "YENİ",
  },
  {
    title: "Firma Takibi",
    description: "Sözleşme, risk, tahsilat ve açık iş durumlarını firma bazında takip edin.",
    icon: ShieldCheck,
  },
  {
    title: "Finans Yönetimi",
    description: "Tahsilat, bekleyen ödeme ve kârlılık görünümünü OSGB operasyonuyla birlikte yönetin.",
    icon: Wallet,
  },
  {
    title: "İSG-KATİP Entegrasyonu",
    description: "İSG-KATİP verisini senkronize ederek saha ve yönetim süreçlerinde zaman kazanın.",
    icon: Link2,
    badge: "YENİ",
  },
];

const benefits = [
  "Tüm OSGB operasyonlarınızı tek panelden yönetin",
  "Yasal çalışma süresi gereksinimlerini otomatik hesaplayın",
  "Geciken ödemeleri ve yaklaşan sözleşmeleri görüntüleyin",
  "Detaylı rapor ve analizlerle iş süreçlerinizi optimize edin",
  "Personel kapasitelerini ve doluluk oranlarını anlık takip edin",
  "Evrak geçerlilik tarihlerini otomatik takip edin",
  "İSG-KATİP ile entegre çalışarak zaman kazanın",
  "Mobil uyumlu arayüz ile her yerden erişin",
];

const steps = [
  {
    title: "Personel Ekleyin",
    description: "İGU, İH ve DSP personellerinizi havuza ekleyin",
  },
  {
    title: "Firma Kaydedin",
    description: "Hizmet verdiğiniz firmaları sisteme tanımlayın",
  },
  {
    title: "Atama Yapın",
    description: "Personelleri firmalara dakika bazında atayın",
  },
  {
    title: "Takip Edin",
    description: "Evrak, finans ve raporları kolayca yönetin",
  },
];

export default function OSGBModule() {
  const [managementOpen, setManagementOpen] = useState(false);
  const howToRef = useRef<HTMLElement | null>(null);

  const scrollToHowTo = () => {
    howToRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="w-full min-w-0 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-700/40 via-purple-700/35 to-fuchsia-700/30 p-6 shadow-2xl shadow-slate-950/40 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-400/15 text-cyan-100 shadow-lg shadow-cyan-950/40">
                <Briefcase className="h-8 w-8" />
              </div>
              <div>
                <Badge className="border border-emerald-400/25 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/15">
                  Profesyonel OSGB Yönetim Çözümü
                </Badge>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                  OSGB Yönetim Modülü
                </h1>
              </div>
            </div>

            <p className="max-w-3xl text-base leading-7 text-slate-200 sm:text-lg">
              Firma, personel, atama, evrak ve finans yönetimini tek bir yerden yapın. İSG-KATİP entegrasyonu ile operasyonlarınızı kolaylaştırın.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white" onClick={scrollToHowTo}>
                Nasıl Kullanılır?
              </Button>
              <Badge variant="outline" className="border-cyan-300/25 bg-slate-950/20 px-3 py-2 text-cyan-100">
                <Sparkles className="mr-2 h-4 w-4" /> Tek panel · Çoklu operasyon
              </Badge>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-5 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
                <KeyRound className="h-5 w-5 text-cyan-200" />
                <div>
                  <p className="font-bold text-white">Yönetim paneli hazır</p>
                  <p className="text-sm text-slate-400">Tüm OSGB operasyonlarını tablar üzerinden açın.</p>
                </div>
              </div>
              <Button type="button" size="lg" className="w-full justify-between bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={() => setManagementOpen(true)}>
                OSGB Modülünü Aç
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button type="button" size="lg" variant="outline" className="w-full border-slate-600 bg-slate-950/40 text-slate-100 hover:bg-slate-900 hover:text-white" onClick={() => setManagementOpen(true)}>
                Hemen Başla
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">Özellikler</h2>
          <p className="mt-2 text-sm text-slate-400">OSGB ekiplerinin günlük operasyonunu hızlandıran ana yetenekler.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5 transition hover:border-cyan-400/40 hover:bg-slate-900">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  {feature.badge ? <Badge className="bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/15">{feature.badge}</Badge> : null}
                </div>
                <h3 className="text-base font-bold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5 lg:p-6">
        <h2 className="text-2xl font-black tracking-tight text-white">OSGB Modülü ile Neler Kazanırsınız?</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {benefits.map((benefit) => (
            <div key={benefit} className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <span className="text-sm leading-6 text-slate-200">{benefit}</span>
            </div>
          ))}
        </div>
      </section>

      <section ref={howToRef} className="space-y-4 scroll-mt-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">Nasıl Kullanılır?</h2>
          <p className="mt-2 text-sm text-slate-400">Dört adımda OSGB yönetim akışınızı canlıya alın.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500 text-sm font-black text-slate-950">
                {index + 1}
              </div>
              <h3 className="text-base font-bold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="mt-1 h-5 w-5 text-cyan-200" />
            <div>
              <p className="font-bold text-white">Operasyon paneline geçmeye hazır mısınız?</p>
              <p className="mt-1 text-sm text-slate-300">Dashboard, personel, firma, finans, arşiv ve İSG-KATİP senkronizasyonunu tek dialog içinde yönetin.</p>
            </div>
          </div>
          <Button type="button" onClick={() => setManagementOpen(true)}>
            Hemen Başla
          </Button>
        </div>
      </section>

      <OSGBManagementDialog open={managementOpen} onOpenChange={setManagementOpen} />
    </div>
  );
}
