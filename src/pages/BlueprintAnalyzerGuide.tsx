import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  ImageIcon,
  Layers3,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  Waypoints,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const workflowSteps = [
  {
    id: "01",
    title: "Krokiyi doğru formatta yükleyin",
    description:
      "Tahliye krokisi, kat planı, mimari çizim veya güvenlik ekipmanı yerleşim görselini yükleyin. Görsel ne kadar netse yapay zeka tespitleri o kadar güçlü olur.",
    icon: ImageIcon,
  },
  {
    id: "02",
    title: "Proje adını ve kısa notları ekleyin",
    description:
      "Analiz kaydı, geçmiş ekranı ve PDF çıktısı bu bilgilerle anlamlı hale gelir. Özellikle kat adı, bina adı ve kullanım senaryosu yazmanız önerilir.",
    icon: ClipboardCheck,
  },
  {
    id: "03",
    title: "AI analizi başlatın",
    description:
      "Sistem ekipman envanterini, olası uyumsuzlukları, tahliye eksiklerini ve mevzuat referanslarını otomatik oluşturmaya çalışır.",
    icon: Sparkles,
  },
  {
    id: "04",
    title: "Sonuçları uzman gözüyle doğrulayın",
    description:
      "Uygunluk skoru, tespit edilen güvenlik ekipmanları, eksiklikler ve önerilen aksiyonlar mutlaka insan kontrolünden geçirilmelidir.",
    icon: ShieldCheck,
  },
  {
    id: "05",
    title: "Karşılaştırma, kayıt ve raporlama",
    description:
      "Geçmiş analizleri açıp karşılaştırabilir, mevcut sonucu kaydedebilir ve profesyonel PDF çıktısı alabilirsiniz.",
    icon: FileText,
  },
];

const featureCards = [
  {
    title: "Ekipman Envanteri",
    text: "Yangın söndürücü, çıkış, ilk yardım, alarm, acil aydınlatma gibi öğeleri tespit edip listeler.",
    icon: Layers3,
  },
  {
    title: "Mevzuat Uyum Yorumu",
    text: "Uyumsuzlukları mevzuat dayanakları ile birlikte daha okunabilir bir formatta özetler.",
    icon: AlertTriangle,
  },
  {
    title: "Uygunluk Skoru",
    text: "Analiz sonucunu hızlı karar vermeyi kolaylaştıran özet bir skor görünümüne dönüştürür.",
    icon: Target,
  },
  {
    title: "Profesyonel PDF Çıktı",
    text: "Yönetici paylaşımı ve saha takibi için indirilebilir, kurumsal rapor çıktısı üretir.",
    icon: FileText,
  },
];

const bestPractices = [
  "Görselde çıkış, merdiven, ekipman ve yönlendirme alanları mümkün olduğunca net görünmelidir.",
  "Aynı analizde birden fazla ilgisiz kroki yerine tek proje veya tek kat mantığıyla çalışın.",
  "Yapay zeka analizini doğrudan resmi karar yerine ön değerlendirme ve hızlandırıcı destek olarak kullanın.",
  "Kaydetmeden önce sonuçlar sekmesindeki ekipman sayıları ve mevzuat önerilerini kontrol edin.",
];

const cautionItems = [
  "Düşük çözünürlüklü veya bulanık kroki yüklemek tespit doğruluğunu düşürür.",
  "Eksik kat planı veya kesilmiş görsel, yanlış uygunluk yorumlarına neden olabilir.",
  "AI sonucu uzman incelemesi olmadan doğrudan saha kararı gibi kullanılmamalıdır.",
];

export default function BlueprintAnalyzerGuide() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 lg:px-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-700/70 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_24%),radial-gradient(circle_at_top_right,rgba(234,179,8,0.14),transparent_20%),linear-gradient(135deg,#020617_0%,#0b1220_42%,#102347_100%)] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.55)]">
        <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-cyan-400/30 bg-cyan-500/15 text-cyan-100">AI Kroki Okuyucu Rehberi</Badge>
              <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-100">Profesyonel Kullanım Akışı</Badge>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-50 lg:text-5xl">
             Yapay Zeka ile Kroki Okuyucu Nasıl Kullanılır?
            </h1>
            <p className="max-w-4xl text-sm leading-7 text-slate-300 lg:text-base">
              Bu rehber, kroki ve kat planı analizini en doğru şekilde kullanmanız için hazırlandı. Amaç yalnızca
              dosya yüklemek değil, daha güvenilir tespitler almak, uyumsuzlukları anlamlandırmak ve raporlamayı
              standartlaştırmaktır.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/blueprint-analyzer")}>
              <ArrowLeft className="h-4 w-4" />
              Analiz Ekranına Dön
            </Button>
            <Button className="gap-2" onClick={() => navigate("/blueprint-analyzer")}>
              <Sparkles className="h-4 w-4" />
              Hemen Analize Başla
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        {featureCards.map((card) => (
          <Card key={card.title} className="border-slate-700/70 bg-slate-950/60">
            <CardContent className="pt-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
                <card.icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-base font-bold text-slate-100">{card.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{card.text}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-700/70 bg-slate-950/45 p-5 lg:p-6">
        <div className="flex items-center gap-3">
          <Waypoints className="h-5 w-5 text-cyan-300" />
          <h2 className="text-xl font-black text-slate-100">Adım Adım Doğru Kullanım</h2>
        </div>
        <Separator className="my-4 bg-slate-700/70" />

        <div className="grid gap-4">
          {workflowSteps.map((step) => (
            <Card key={step.id} className="border-slate-700/70 bg-slate-950/70">
              <CardContent className="flex items-start gap-4 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
                  <step.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-800 px-2 py-1 text-xs font-bold text-slate-300">{step.id}</span>
                    <h3 className="text-base font-bold text-slate-100">{step.title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{step.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-emerald-500/25 bg-emerald-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-200">
              <CheckCircle2 className="h-5 w-5" />
              En İyi Sonuç İçin Öneriler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-emerald-100">
            {bestPractices.map((item) => (
              <p key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{item}</span>
              </p>
            ))}
          </CardContent>
        </Card>

        <Card className="border-rose-500/25 bg-rose-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-200">
              <AlertTriangle className="h-5 w-5" />
              Dikkat Edilmesi Gerekenler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-rose-100">
            {cautionItems.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="border-slate-700/70 bg-slate-950/60 xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-100">
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
              Analiz Sonrası Kontrol Listesi
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="font-semibold text-slate-100">Ekipman sayıları tutarlı mı?</p>
              <p className="mt-2 text-slate-400">Söndürücü, çıkış, alarm ve diğer öğelerin gerçek planla uyumlu olup olmadığını kontrol edin.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="font-semibold text-slate-100">Mevzuat dayanakları mantıklı mı?</p>
              <p className="mt-2 text-slate-400">AI önerilerini kurum içi uzman görüşü ve güncel mevzuat bilgisi ile doğrulayın.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="font-semibold text-slate-100">Kaydetmeden önce not eklediniz mi?</p>
              <p className="mt-2 text-slate-400">Saha bağlamı, kat bilgisi veya özel gözlemlerinizi manuel not alanına eklemek çıktıyı güçlendirir.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="font-semibold text-slate-100">PDF rapor hazır mı?</p>
              <p className="mt-2 text-slate-400">Sonuçlar netse profesyonel PDF raporu indirip yönetim, saha ve denetim ekipleriyle paylaşabilirsiniz.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/25 bg-cyan-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-cyan-100">
              <TimerReset className="h-5 w-5" />
              Hızlı Başlangıç
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-cyan-50">
            <p>1. Proje adını yazın</p>
            <p>2. Krokiyi yükleyin</p>
            <p>3. AI analizi başlatın</p>
            <p>4. Sonuçlar sekmesini doğrulayın</p>
            <p>5. Kaydedin ve PDF indirin</p>
            <Button className="mt-2 w-full gap-2" onClick={() => navigate("/blueprint-analyzer")}>
              <Sparkles className="h-4 w-4" />
              Analiz Ekranını Aç
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
