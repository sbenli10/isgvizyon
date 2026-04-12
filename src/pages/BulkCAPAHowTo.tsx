import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  ImageIcon,
  Sparkles,
  ClipboardCheck,
  ShieldCheck,
  XCircle,
  FileText,
  Timer,
  CircleHelp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const steps = [
  {
    id: "01",
    title: "Saha Bilgisini Gir",
    desc: "Saha/Tesis adını net girin. Rapor başlığı ve Word çıktısı bu bilgiye göre oluşur.",
    icon: ClipboardCheck,
  },
  {
    id: "02",
    title: "Durum Bazlı Fotoğraf Yükle",
    desc: "Tek risk için 1-3 fotoğraf yükleyin. Farklı riskleri aynı bulgu içinde karıştırmayın.",
    icon: ImageIcon,
  },
  {
    id: "03",
    title: "AI ile Analiz Et",
    desc: "AI açıklama, risk tanımı ve faaliyet alanlarını doldurur. İçeriği mutlaka insan kontrolünden geçirin.",
    icon: Sparkles,
  },
  {
    id: "04",
    title: "Onayla ve Raporla",
    desc: "Önemlilik, termin ve bildirim şekli alanlarını kontrol edin. Sonra kaydedin ve Word çıktısını alın.",
    icon: FileText,
  },
];

export default function BulkCAPAHowTo() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 lg:px-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0b1f4d] p-6 shadow-[0_18px_60px_rgba(2,6,23,0.45)]">
        <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-cyan-400/30 bg-cyan-500/15 text-cyan-100">Toplu DÖF Rehberi</Badge>
              <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-100">Durum Bazlı Analiz</Badge>
            </div>

            <h1 className="text-2xl font-black tracking-tight text-slate-100 lg:text-4xl">
              Toplu DÖF Nasıl Kullanılır?
            </h1>
            <p className="max-w-3xl text-sm text-slate-300 lg:text-base">
              Hızlı, doğru ve mevzuata uyumlu DÖF oluşturmak için fotoğrafları konu bazlı yönetin.
              Bu sayfa, kullanıcı hatalarını azaltmak için en iyi akışı adım adım gösterir.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/bulk-capa")}> 
              <ArrowLeft className="h-4 w-4" /> Toplu DÖF'e Dön
            </Button>
            <Button className="gap-2" onClick={() => navigate("/bulk-capa")}> 
              <CircleHelp className="h-4 w-4" /> Hemen Uygulamaya Geç
            </Button>
          </div>
        </div>
      </section>

      <Card className="border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-orange-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-200">
            <AlertTriangle className="h-5 w-5" /> Kritik Kural
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-amber-100">
          <p>
            Aynı anda 10-15 farklı durumu tek bulgu içinde analiz etmeyin.
          </p>
          <p className="font-semibold">
            Her bulgu için tek konu/tek risk yaklaşımı kullanın.
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-4">
        <Card className="border-slate-700/70 bg-slate-950/60">
          <CardContent className="pt-6">
            <p className="text-xs text-slate-400">Önerilen fotoğraf</p>
            <p className="mt-1 text-2xl font-black text-slate-100">1-3</p>
            <p className="mt-1 text-xs text-slate-400">her bulgu için</p>
          </CardContent>
        </Card>
        <Card className="border-slate-700/70 bg-slate-950/60">
          <CardContent className="pt-6">
            <p className="text-xs text-slate-400">Zorunlu adım</p>
            <p className="mt-1 text-2xl font-black text-slate-100">İnsan Kontrolü</p>
            <p className="mt-1 text-xs text-slate-400">AI sonrası</p>
          </CardContent>
        </Card>
        <Card className="border-slate-700/70 bg-slate-950/60">
          <CardContent className="pt-6">
            <p className="text-xs text-slate-400">Hedef</p>
            <p className="mt-1 text-2xl font-black text-slate-100">Daha Net DÖF</p>
            <p className="mt-1 text-xs text-slate-400">daha az revizyon</p>
          </CardContent>
        </Card>
        <Card className="border-slate-700/70 bg-slate-950/60">
          <CardContent className="pt-6">
            <p className="text-xs text-slate-400">Süreç hızı</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-100">
              <Timer className="h-5 w-5 text-cyan-300" /> Hızlı
            </p>
            <p className="mt-1 text-xs text-slate-400">standart akışla</p>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4 lg:p-6">
        <h2 className="text-lg font-bold text-slate-100 lg:text-xl">Adım Adım Profesyonel Akış</h2>
        <Separator className="my-4 bg-slate-700/70" />

        <div className="grid gap-3">
          {steps.map((step) => (
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
              <ShieldCheck className="h-5 w-5" /> Yapılması Gerekenler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-emerald-100">
            <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" /> Her bulguyu tek risk odağında tutun.</p>
            <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" /> AI sonrası termin ve önemlilik alanını manuel kontrol edin.</p>
            <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" /> Kaydetmeden önce önizlemede son kontrol yapın.</p>
          </CardContent>
        </Card>

        <Card className="border-rose-500/30 bg-rose-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-200">
              <XCircle className="h-5 w-5" /> Kaçınılması Gerekenler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-rose-100">
            <p>Aynı kayıtta farklı risk türlerini birleştirmeyin.</p>
            <p>Çok sayıda fotoğrafı tek analizde karıştırmayın.</p>
            <p>AI metnini kontrol etmeden doğrudan raporlamayın.</p>
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/50 p-4">
        <p className="text-sm text-slate-300">
          Hazırsanız şimdi aynı standartla ilk durum bazlı DÖF kaydınızı oluşturun.
        </p>
        <Button className="gap-2" onClick={() => navigate("/bulk-capa")}>
          <Sparkles className="h-4 w-4" /> Toplu DÖF Formuna Git
        </Button>
      </div>
    </div>
  );
}

