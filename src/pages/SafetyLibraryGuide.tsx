import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileArchive,
  FileSearch,
  FolderArchive,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const workflowSteps = [
  {
    id: "01",
    title: "Kategori veya arama ile doğru riski bulun",
    description:
      "Kütüphane sekmesinde sektör bazlı kategori seçebilir veya tehlike adı, mevzuat ya da önlem metni üzerinden arama yapabilirsiniz.",
    icon: FileSearch,
  },
  {
    id: "02",
    title: "Detay ekranından mevzuat ve önlem bilgisini doğrulayın",
    description:
      "Her kayıt için risk seviyesi, açıklama, önlem yöntemi ve ilgili mevzuat aynı pencerede gösterilir. Sahaya çıkmadan önce bu alanları kontrol edin.",
    icon: ShieldCheck,
  },
  {
    id: "03",
    title: "Denetimi doğrudan kayıt üzerinden başlatın",
    description:
      "Bir tehlike kartından Denetim başlat aksiyonu verildiğinde, ilgili önlem notları denetim ekranına otomatik taşınır.",
    icon: ClipboardCheck,
  },
  {
    id: "04",
    title: "Yeni risk başlıklarını kütüphaneye ekleyin",
    description:
      "Kuruma özel tehlikeleri, ilgili mevzuat dayanağı ve önerilen önlemlerle birlikte kütüphaneye kaydederek standart bir bilgi havuzu oluşturun.",
    icon: Sparkles,
  },
  {
    id: "05",
    title: "Doküman arşivini prosedür merkezi olarak kullanın",
    description:
      "Talimat, prosedür, form ve rehber dokümanları yükleyin. Yeni yüklenen dosyalar artık gerçek dosya adıyla görünür.",
    icon: FolderArchive,
  },
];

const featureCards = [
  {
    title: "Merkezi Tehlike Havuzu",
    text: "Saha ekiplerinin aynı risk tanımlarını kullanmasını sağlar ve farklı firmalarda standart denetim dili oluşturur.",
    icon: BookOpen,
  },
  {
    title: "Mevzuat Dayanağı",
    text: "Her risk kaydında ilgili mevzuat veya kurum içi prosedür bilgisini tutarak savunulabilir kayıt üretir.",
    icon: ShieldCheck,
  },
  {
    title: "Hızlı Denetim Başlatma",
    text: "Kütüphanedeki bir riskten doğrudan denetime geçip önlem bilgisini otomatik taşır.",
    icon: ClipboardCheck,
  },
  {
    title: "Doküman Arşivi",
    text: "Prosedür, form ve iş talimatlarını tek yerde saklayarak operasyon ekibinin güncel dokümana hızlı erişmesini sağlar.",
    icon: FileArchive,
  },
];

const bestPractices = [
  "Yeni tehlike eklerken açıklamayı kısa değil, sahada uygulanabilir olacak kadar net yazın.",
  "Mevzuat alanında mümkünse yönetmelik veya prosedür adı verin; yalnızca genel başlık bırakmayın.",
  "Arşivde yüklenen dosyaları sürüm mantığıyla yönetin; eski sürümleri silmeden önce güncel olanı doğrulayın.",
  "Kütüphaneyi sadece liste olarak değil, denetim hazırlık standardı olarak kullanın.",
];

const cautionItems = [
  "Eski yüklenmiş arşiv dosyalarında orijinal isim bilgisi yoksa bu kayıtlar geçmişte random isimle saklanmış olabilir.",
  "Kütüphaneye eklenen hatalı mevzuat veya yanlış önlem metni, sonraki denetim kayıtlarını da etkileyebilir.",
  "Arşive yüklenen her dokümanın kurum içinde onaylı sürüm olduğundan emin olun.",
];

export default function SafetyLibraryGuide() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 lg:px-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-700/70 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_22%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_24%),linear-gradient(135deg,#020617_0%,#0b1220_40%,#111827_100%)] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.55)]">
        <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-100">İSG Kütüphanesi Rehberi</Badge>
              <Badge className="border-blue-400/30 bg-blue-500/15 text-blue-100">Kurumsal Kullanım Akışı</Badge>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-50 lg:text-5xl">
              İSG Kütüphanesi Nasıl Kullanılır?
            </h1>
            <p className="max-w-4xl text-sm leading-7 text-slate-300 lg:text-base">
              Bu alan, tehlike tanımlarını, önlem metinlerini ve kurum içi dokümanları tek merkezde yönetmek için tasarlandı.
              Amaç yalnızca kayıt tutmak değil; denetim kalitesini standartlaştırmak ve sahaya giden ekibin aynı referansla çalışmasını sağlamaktır.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/safety-library")}>
              <ArrowLeft className="h-4 w-4" />
              Kütüphaneye dön
            </Button>
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate("/safety-library")}>
              <BookOpen className="h-4 w-4" />
              Hemen kullanmaya başla
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        {featureCards.map((card) => (
          <Card key={card.title} className="border-slate-700/70 bg-slate-950/60">
            <CardContent className="pt-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
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
          <BookOpen className="h-5 w-5 text-emerald-300" />
          <h2 className="text-xl font-black text-slate-100">Adım adım kullanım akışı</h2>
        </div>
        <Separator className="my-4 bg-slate-700/70" />

        <div className="grid gap-4">
          {workflowSteps.map((step) => (
            <Card key={step.id} className="border-slate-700/70 bg-slate-950/70">
              <CardContent className="flex items-start gap-4 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
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

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-emerald-500/25 bg-emerald-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-200">
              <CheckCircle2 className="h-5 w-5" />
              Doğru kullanım önerileri
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

        <Card className="border-amber-500/25 bg-amber-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-200">
              <TriangleAlert className="h-5 w-5" />
              Dikkat edilmesi gerekenler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-amber-100">
            {cautionItems.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
