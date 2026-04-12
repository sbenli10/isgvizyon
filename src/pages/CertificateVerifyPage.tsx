import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BadgeCheck, Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCertificateVerification } from "@/lib/certificateApi";

export default function CertificateVerifyPage() {
  const { code } = useParams();
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!code) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getCertificateVerification(code);
        setPayload(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a,#020617_65%)] px-4 py-10">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="space-y-3 text-center">
            <div className="mx-auto h-4 w-40 animate-pulse rounded bg-slate-800" />
            <div className="mx-auto h-10 w-72 animate-pulse rounded bg-slate-900" />
            <div className="mx-auto h-4 w-96 animate-pulse rounded bg-slate-900" />
          </div>
          <div className="h-80 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a,#020617_65%)] px-4 py-10 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Sertifika Doğrulama</p>
          <h1 className="mt-3 text-4xl font-black">{error ? "Doğrulama Başarısız" : "Sertifika Geçerli"}</h1>
          <p className="mt-3 text-sm text-slate-300">QR kod veya doğrulama bağlantısı üzerinden görüntülenen kayıt.</p>
        </div>

        <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              {error ? <ShieldX className="h-5 w-5 text-red-400" /> : <ShieldCheck className="h-5 w-5 text-emerald-400" />}
              Doğrulama Sonucu
            </CardTitle>
            <CardDescription className="text-slate-300">Kayıt bilgileri sistem verisi ile eşleştirilmiştir.</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-100">{error}</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Katılımcı</p>
                  <p className="mt-3 text-2xl font-bold">{payload?.participant?.name}</p>
                  <p className="mt-2 text-sm text-slate-300">{payload?.participant?.job_title || "Görev belirtilmedi"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Sertifika Numarası</p>
                  <p className="mt-3 text-2xl font-bold">{payload?.participant?.certificate_no || "-"}</p>
                  <Badge className="mt-3 bg-emerald-500/15 text-emerald-200"><BadgeCheck className="mr-2 h-4 w-4" /> Doğrulandı</Badge>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 md:col-span-2">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Eğitim Bilgisi</p>
                  <p className="mt-3 text-xl font-semibold">{payload?.certificate?.training_name}</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
                    <span>Tarih: {payload?.certificate?.training_date}</span>
                    <span>Süre: {payload?.certificate?.training_duration}</span>
                    <span>Firma: {payload?.certificate?.company_name}</span>
                    <span>Tema: {payload?.certificate?.template_type}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
