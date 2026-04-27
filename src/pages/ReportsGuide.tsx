import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Brain,
  Camera,
  CheckCircle2,
  CircleHelp,
  FileText,
  ImageIcon,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const usageSteps = [
  {
    id: "01",
    title: "Sahadaki durumu net tanımla",
    desc: "Kısa ama somut bir açıklama yazın. Ne oldu, nerede oldu ve kim etkilenebilir sorularını cevaplayın.",
    icon: FileText,
  },
  {
    id: "02",
    title: "Fotoğrafı ekle veya kamerayla çek",
    desc: "Tek risk için 1-3 fotoğraf kullanın. Mobilde doğrudan kamerayı açıp sahadan anlık kayıt ekleyebilirsiniz.",
    icon: Camera,
  },
  {
    id: "03",
    title: "Gerekirse mevzuat/PDF bağlamı ekle",
    desc: "PDF ve DOCX dosyaları ana analiz girdisi değildir. Sadece mevzuat dayanağı ve uzman yorumunu güçlendirmek için kullanılır.",
    icon: ShieldCheck,
  },
  {
    id: "04",
    title: "Analizi çalıştır ve kontrol et",
    desc: "Fine-Kinney sonucu, yasal dayanak ve aksiyon önerilerini gözden geçirin. Sonra PDF/Word çıktısı alın veya DÖF'e aktarın.",
    icon: Brain,
  },
];

const rightWays = [
  "Fotoğraf + kısa saha açıklaması ile analiz başlatın.",
  "Aynı risk için 1-3 net kare kullanın; farklı riskleri tek analizde birleştirmeyin.",
  "PDF/DOCX yüklediyseniz bunu mevzuat desteği olarak düşünün, ana bulgu olarak değil.",
  "Analiz sonrası önerilen aksiyonları insan kontrolünden geçirip sonra raporlayın.",
];

const wrongWays = [
  "Sadece PDF yükleyip risk analizi beklemeyin.",
  "Belirsiz veya çok genel açıklamalarla analiz çalıştırmayın.",
  "Aynı kayıtta farklı alanlara ait ilgisiz fotoğrafları karıştırmayın.",
  "AI sonucunu hiç kontrol etmeden doğrudan resmi rapor olarak paylaşmayın.",
];

export default function ReportsGuide() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 lg:px-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0b1f4d] p-6 shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
        <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-cyan-400/30 bg-cyan-500/15 text-cyan-100">Reports Rehberi</Badge>
              <Badge className="border-blue-400/30 bg-blue-500/15 text-blue-100">Saha Risk Analizi</Badge>
            </div>

            <h1 className="text-2xl font-black tracking-tight text-slate-100 lg:text-4xl">
              Reports Nasıl Kullanılır?
            </h1>
            <p className="max-w-3xl text-sm text-slate-300 lg:text-base">
              Bu ekran bir mevzuat özetleyicisi değil, saha uygunsuzluğu analiz ekranıdır.
              Fotoğraf, saha notu ve destekleyici mevzuat bağlamı ile hızlı Fine-Kinney analizi üretmek için tasarlanmıştır.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/reports")}>
              <ArrowLeft className="h-4 w-4" /> Reports'a Dön
            </Button>
            <Button className="gap-2" onClick={() => navigate("/reports")}>
              <CircleHelp className="h-4 w-4" /> Hemen Analize Geç
            </Button>
          </div>
        </div>
      </section>

      <Card className="border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-orange-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-200">
            <TriangleAlert className="h-5 w-5" /> En Kritik Kural
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-amber-100">
          <p>
            PDF ve DOCX dosyaları bu ekranda ana analiz girdisi değildir.
          </p>
          <p className="font-semibold">
            Önce saha notu yazın veya fotoğraf yükleyin; belgeler yalnızca mevzuat bağlamı ekler.
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-4">
        <Card className="border-slate-700/70 bg-slate-950/60">
          <CardContent className="pt-6">
            <p className="text-xs text-slate-400">Ana girdi</p>
            <p className="mt-1 text-2xl font-black text-slate-100">Fotoğraf / Not</p>
            <p className="mt-1 text-xs text-slate-400">zorunlu</p>
          </CardContent>
        </Card>
        <Card className="border-slate-700/70 bg-slate-950/60">
          <CardContent className="pt-6">
            <p className="text-xs text-slate-400">Destekleyici belge</p>
            <p className="mt-1 text-2xl font-black text-slate-100">PDF / DOCX</p>
            <p className="mt-1 text-xs text-slate-400">opsiyonel bağlam</p>
          </CardContent>
        </Card>
        <Card className="border-slate-700/70 bg-slate-950/60">
          <CardContent className="pt-6">
            <p className="text-xs text-slate-400">Önerilen fotoğraf</p>
            <p className="mt-1 text-2xl font-black text-slate-100">1-3</p>
            <p className="mt-1 text-xs text-slate-400">aynı risk için</p>
          </CardContent>
        </Card>
        <Card className="border-slate-700/70 bg-slate-950/60">
          <CardContent className="pt-6">
            <p className="text-xs text-slate-400">Çıktı</p>
            <p className="mt-1 text-2xl font-black text-slate-100">PDF / Word</p>
            <p className="mt-1 text-xs text-slate-400">rapor + DÖF aktarımı</p>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4 lg:p-6">
        <h2 className="text-lg font-bold text-slate-100 lg:text-xl">Adım Adım Kullanım</h2>
        <Separator className="my-4 bg-slate-700/70" />

        <div className="grid gap-3">
          {usageSteps.map((step) => (
            <Card key={step.id} className="border-slate-700/70 bg-slate-950/65">
              <CardContent className="flex items-start gap-4 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-200">
                  <step.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-slate-800 px-2 py-1 text-xs font-bold text-slate-300">{step.id}</span>
                    <h3 className="text-base font-bold text-slate-100">{step.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{step.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-emerald-500/30 bg-emerald-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-200">
              <CheckCircle2 className="h-5 w-5" /> Doğru Kullanım
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-emerald-100">
            {rightWays.map((item) => (
              <p key={item} className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{item}</span>
              </p>
            ))}
          </CardContent>
        </Card>

        <Card className="border-rose-500/30 bg-rose-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-200">
              <XCircle className="h-5 w-5" /> Yanlış Beklentiler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-rose-100">
            {wrongWays.map((item) => (
              <p key={item} className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{item}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-700/70 bg-slate-950/65">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-100">
              <ImageIcon className="h-5 w-5 text-cyan-300" /> Örnek Doğru Senaryo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-300">
            <p>1. Elektrik panosunun açık halini fotoğraflayın.</p>
            <p>2. Açıklama yazın: "Pano kapağı açık, iç devreler erişilebilir, yetkisiz temas riski var."</p>
            <p>3. İsterseniz elektrik mevzuatı PDF'i yükleyin.</p>
            <p>4. Analizi çalıştırın, sonra PDF/Word alın veya DÖF'e aktarın.</p>
          </CardContent>
        </Card>

        <Card className="border-slate-700/70 bg-slate-950/65">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-100">
              <Sparkles className="h-5 w-5 text-blue-300" /> Bu Ekranın Gücü
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-300">
            <p>Fotoğraf analizi, mevzuat dayanağı, Fine-Kinney puanı ve aksiyon önerisini tek akışta üretir.</p>
            <p>Rapor geçmişte saklanır, çıktı alınır ve gerekirse DÖF sürecine bağlanır.</p>
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/50 p-4">
        <p className="text-sm text-slate-300">
          Hazırsanız şimdi sahadan gelen ilk uygunsuzluğu standart akışla analiz edin.
        </p>
        <Button className="gap-2" onClick={() => navigate("/reports")}>
          <Sparkles className="h-4 w-4" /> Reports Ekranına Git
        </Button>
      </div>
    </div>
  );
}
