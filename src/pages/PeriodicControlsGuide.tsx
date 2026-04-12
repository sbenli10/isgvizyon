import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BellRing,
  CalendarClock,
  CheckCircle2,
  FileUp,
  FolderArchive,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const workflowSteps = [
  {
    id: "01",
    title: "Kontrol kalemini kayıt altına alın",
    description:
      "Ekipman adı, kontrol kategorisi, firma, lokasyon ve bir sonraki kontrol tarihini girin. Bu kayıt periyodik takip omurgasını oluşturur.",
    icon: Wrench,
  },
  {
    id: "02",
    title: "Kontrol terminini operasyon takvimine bağlayın",
    description:
      "Yaklaşan veya geciken kontroller için sistem otomatik görev üretir. Böylece kayıt sadece listede kalmaz, görev motoruna da düşer.",
    icon: CalendarClock,
  },
  {
    id: "03",
    title: "Raporu yükleyin ve geçmişi arşivleyin",
    description:
      "Kontrol tamamlandığında PDF veya destekleyici raporu yükleyin. Yüklenen her dosya ilgili ekipman geçmişine işlenir.",
    icon: FileUp,
  },
  {
    id: "04",
    title: "Sonraki kontrol tarihini güncelleyin",
    description:
      "Yeni rapor geldiğinde son kontrol ve bir sonraki kontrol tarihini güncelleyerek akışı canlı tutun. Sistem sonraki uyarıları buna göre üretir.",
    icon: BellRing,
  },
];

const featureCards = [
  {
    title: "Merkezi Takip Masası",
    text: "Basınçlı kaplar, kaldırma ekipmanları, elektrik tesisatı ve benzeri tüm kontrol kalemlerini tek yüzeyde toplar.",
    icon: ShieldCheck,
  },
  {
    title: "Görev Motoru Bağlantısı",
    text: "Yaklaşan ve geciken kontrolleri OSGB görev motoruna aktarır; manuel takip yükünü azaltır.",
    icon: Sparkles,
  },
  {
    title: "Rapor Arşivi",
    text: "Kontrol raporlarını kayda bağlı saklar ve denetim hazırlığında belge arama süresini kısaltır.",
    icon: FolderArchive,
  },
];

const bestPractices = [
  "Her kayıt için ekipman adını sahada kullanılan isimle değil, raporda geçen resmi isimle tutun.",
  "Kontrol kategorisini mümkün olduğunca standardize edin; filtreleme ve rapor takibi kolaylaşır.",
  "Rapor yükledikten sonra son kontrol ve bir sonraki kontrol tarihini aynı işlemde güncelleyin.",
  "Kontrol kuruluşu veya uzman bilgisini boş bırakmayın; geriye dönük izlenebilirlik için kritiktir.",
];

export default function PeriodicControlsGuide() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 lg:px-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-700/70 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_22%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_24%),linear-gradient(135deg,#020617_0%,#0b1220_42%,#111827_100%)] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.55)]">
        <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-cyan-400/30 bg-cyan-500/15 text-cyan-100">Periyodik Kontrol Rehberi</Badge>
              <Badge className="border-blue-400/30 bg-blue-500/15 text-blue-100">Operasyon Kullanım Akışı</Badge>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-50 lg:text-5xl">
              Periyodik Kontrol Modülü Nasıl Kullanılır?
            </h1>
            <p className="max-w-4xl text-sm leading-7 text-slate-300 lg:text-base">
              Bu modül, kontrol gerektiren ekipmanları yalnızca listelemek için değil; termin yönetimi, rapor arşivi ve görev takibini tek akışta
              yürütmek için tasarlandı. Amaç, yaklaşan kontrolleri kaçırmamak ve denetim gününde raporu aramak zorunda kalmamaktır.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/periodic-controls")}>
              <ArrowLeft className="h-4 w-4" />
              Modüle dön
            </Button>
            <Button className="gap-2 bg-cyan-600 hover:bg-cyan-700" onClick={() => navigate("/periodic-controls")}>
              <CalendarClock className="h-4 w-4" />
              Hemen kullanmaya başla
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
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
          <CalendarClock className="h-5 w-5 text-cyan-300" />
          <h2 className="text-xl font-black text-slate-100">Adım adım kullanım akışı</h2>
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
        <Card className="border-cyan-500/25 bg-cyan-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-cyan-100">
              <CheckCircle2 className="h-5 w-5" />
              Doğru kullanım önerileri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-cyan-50">
            {bestPractices.map((item) => (
              <p key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{item}</span>
              </p>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-700/70 bg-slate-950/60">
          <CardHeader>
            <CardTitle className="text-slate-100">Bu modülde ne takip edilir?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-300">
            <p>Basınçlı kaplar, kaldırma ekipmanları, topraklama, paratoner, elektrik tesisatı ve periyodik rapor gerektiren benzeri kalemler.</p>
            <p>Her kayıt için firma, lokasyon, son kontrol tarihi, bir sonraki kontrol tarihi ve rapor dosyası aynı yapıda tutulur.</p>
            <p>Yaklaşan terminlerde görev üretimi devreye girer; böylece kayıt operasyon akışının parçası olur.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
