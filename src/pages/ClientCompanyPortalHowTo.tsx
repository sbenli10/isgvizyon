import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CircleHelp,
  CreditCard,
  FileText,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  {
    id: "1",
    title: "Belgeleri kontrol edin",
    description:
      "Ana ekrandaki bekleyen belgeler bölümünden hangi evrakın istendiğini ve son tarihi görün.",
    icon: FileText,
  },
  {
    id: "2",
    title: "Dosyanızı yükleyin",
    description:
      "Belge Yükle bölümünden ilgili belgeyi seçin, dosyanızı ekleyin ve kısa bir not bırakın.",
    icon: UploadCloud,
  },
  {
    id: "3",
    title: "İnceleme sonucunu takip edin",
    description:
      "Gönderdiğiniz dosyalar önce OSGB ekibi tarafından kontrol edilir. Son gönderimler alanından durumu izleyin.",
    icon: ShieldCheck,
  },
  {
    id: "4",
    title: "Cari özeti görüntüleyin",
    description:
      "Alt bölümde toplam bakiye, gecikmiş bakiye ve finansal risk bilgilerini görebilirsiniz.",
    icon: CreditCard,
  },
];

export default function ClientCompanyPortalHowTo() {
  const navigate = useNavigate();
  const { token } = useParams();

  const portalHref = useMemo(() => {
    if (!token) return "/landing";
    return `/portal/company/${token}`;
  }, [token]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_28%),linear-gradient(180deg,#020617,#0f172a)] p-6 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
                  Nasıl kullanılır
                </Badge>
                <Badge variant="outline">Müşteri portalı</Badge>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Bu portalı en basit haliyle nasıl kullanırım?
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                Bu ekran sizin için açılan özel müşteri portalıdır. Buradan eksik belgeleri görebilir,
                istenen dosyaları yükleyebilir ve gönderdiğiniz evrakların durumunu takip edebilirsiniz.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate(portalHref)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Portala dön
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Card className="border-slate-800 bg-slate-900/75">
            <CardContent className="pt-6">
              <p className="text-xs text-slate-400">Amaç</p>
              <p className="mt-1 text-lg font-semibold text-white">Belge paylaşımı</p>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/75">
            <CardContent className="pt-6">
              <p className="text-xs text-slate-400">Kim kullanır?</p>
              <p className="mt-1 text-lg font-semibold text-white">Firma yetkilisi</p>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/75">
            <CardContent className="pt-6">
              <p className="text-xs text-slate-400">Ne yapabilirsiniz?</p>
              <p className="mt-1 text-lg font-semibold text-white">Yükle ve takip et</p>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/75">
            <CardContent className="pt-6">
              <p className="text-xs text-slate-400">Dikkat</p>
              <p className="mt-1 text-lg font-semibold text-white">Link kişiye özeldir</p>
            </CardContent>
          </Card>
        </section>

        <Card className="border-slate-800 bg-slate-900/75">
          <CardHeader>
            <CardTitle className="text-white">4 adımda kullanım</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.id}
                  className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Adım {step.id}
                      </span>
                    </div>
                    <div className="mt-1 text-base font-semibold text-white">{step.title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/75">
          <CardHeader>
            <CardTitle className="text-white">Kısaca bilmeniz gerekenler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <p>Bu link yalnızca sizin firmanız için hazırlanır.</p>
            <p>Yüklediğiniz dosyalar doğrudan yayına girmez; önce OSGB ekibi tarafından incelenir.</p>
            <p>Belgeleriniz onaylandığında bekleyen evrak sayısı azalır.</p>
            <p>Link açılmıyorsa süresi dolmuş veya duraklatılmış olabilir; bu durumda OSGB yetkilinizden yeni link isteyin.</p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
          <p className="text-sm text-slate-300">
            Hazırsanız şimdi portala dönüp eksik belgeleri kontrol edebilirsiniz.
          </p>
          <Button onClick={() => navigate(portalHref)}>
            <CircleHelp className="mr-2 h-4 w-4" />
            Portala geç
          </Button>
        </div>
      </div>
    </div>
  );
}
