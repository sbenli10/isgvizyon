import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Briefcase,
  Building2,
  CalendarCheck2,
  FileCheck,
  Globe2,
  Link2,
  MapPinned,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

const steps = [
  {
    title: "İSG-KATİP’ten al",
    description: "ISGBot extension kaynağından gelen firmaları ve süre verisini önce kurumsal merkeze çekin.",
    href: "/osgb/isgkatip",
    icon: Link2,
  },
  {
    title: "Excel veya manuel ekle",
    description: "İSG-KATİP dışında kalan firmaları Excel/CSV veya manuel kayıt ile havuza dahil edin.",
    href: "/osgb/company-tracking",
    icon: Building2,
  },
  {
    title: "Havuza al ve sözleşmeyi tamamla",
    description: "Yalnızca yöneteceğiniz firmaları managed havuza alın; aylık bedel, tarih ve ziyaret sıklığını boş bırakmayın.",
    href: "/osgb/company-tracking",
    icon: Briefcase,
  },
  {
    title: "Atama başlat",
    description: "Uzman, hekim ve DSP görevlendirmelerini dakika açığına göre tamamlayın.",
    href: "/osgb/assignments",
    icon: CalendarCheck2,
  },
  {
    title: "Saha, evrak ve finansı aç",
    description: "Hizmet ispatı, yasal evrak ve cari takibini aynı firmaya bağlayın.",
    href: "/osgb/field-visits",
    icon: MapPinned,
  },
];

const moduleLinks = [
  { title: "Firma Havuzu", href: "/osgb/company-tracking", icon: Building2 },
  { title: "Personel ve Atamalar", href: "/osgb/assignments", icon: Briefcase },
  { title: "Saha Operasyonu", href: "/osgb/field-visits", icon: MapPinned },
  { title: "Yasal Evraklar", href: "/osgb/documents", icon: FileCheck },
  { title: "Finans ve Karlılık", href: "/osgb/finance", icon: Wallet },
  { title: "Müşteri Portalı", href: "/osgb/client-portal", icon: Globe2 },
];

export default function OsgbHowTo() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  return (
    <div className="container mx-auto space-y-6 py-6">
      <section className="rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.14),_transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.86))] p-6 shadow-2xl shadow-slate-950/40">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/10">
                Nasıl kullanılır
              </Badge>
              <Badge variant="outline">OSGB başlangıç rehberi</Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">OSGB modülünü ilk günden nasıl kullanmalıyım?</h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              Bu ürün, tek tek form ekranlarından çok bir müşteri yaşam döngüsü sistemi gibi çalışır.
              Önce firmayı havuza alır, sonra atamayı başlatır, ardından saha, evrak, finans ve portalı aynı şirket üzerinde yürütürsünüz.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate(profile?.organization_id ? "/osgb/company-tracking" : "/profile?tab=workspace&action=create")}>
              {profile?.organization_id ? "Firma havuzunu aç" : "Organizasyon oluştur"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => navigate("/osgb/dashboard")}>
              Başlangıç ekranına dön
            </Button>
          </div>
        </div>
      </section>

      {!profile?.organization_id ? (
        <Card className="border-cyan-500/20 bg-cyan-500/10">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">OSGB paketi organizasyonla başlar</p>
              <p className="mt-1 text-sm text-slate-300">
                Rehberi inceleyebilirsiniz; ancak OSGB üyeliği ve operasyon ekranları için önce çalışma alanınızı oluşturmanız gerekir.
              </p>
            </div>
            <Button onClick={() => navigate("/profile?tab=workspace&action=create")}>
              Çalışma alanı oluştur
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Adım adım başlangıç akışı</CardTitle>
            <CardDescription>Yeni gelen OSGB kullanıcısı bu sırayı izlerse ürün doğal şekilde açılır.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => navigate(step.href)}
                  className="flex w-full items-start gap-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-left transition hover:border-cyan-500/30 hover:bg-slate-900"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Adım {index + 1}</span>
                    </div>
                    <div className="mt-1 text-base font-semibold text-white">{step.title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{step.description}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Ana mantık</CardTitle>
            <CardDescription>OSGB çekirdeği ile uzmanlık modüllerini ayırarak ilerleyin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center gap-2 font-semibold text-white">
                <Bot className="h-4 w-4 text-cyan-300" />
                İSGBot
              </div>
              <p className="mt-2 leading-6 text-slate-400">
                Bireysel uzman ve extension katmanıdır; İSG-KATİP verisini getirir, yorumlar ve ilk sinyali üretir.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center gap-2 font-semibold text-white">
                <BookOpen className="h-4 w-4 text-cyan-300" />
                OSGB Modülü
              </div>
              <p className="mt-2 leading-6 text-slate-400">
                Firma havuzu, ekip operasyonu, evrak, finans ve müşteri portalını kurumsal işleyişe dönüştürür.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-white">Hangi modüle ne zaman girerim?</CardTitle>
          <CardDescription>Sidebar sadeleşti; uzmanlık modülleri ise firma içinden açılacak şekilde düşünülmeli.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {moduleLinks.map((item) => {
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
                <div className="font-semibold text-white">{item.title}</div>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
