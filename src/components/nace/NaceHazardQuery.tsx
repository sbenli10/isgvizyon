// ====================================================
// NACE HAZARD QUERY
// ====================================================

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Database,
  Download,
  Info,
  Layers,
  Lightbulb,
  Loader2,
  Search,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  generateNaceRiskAnalysis,
  type RiskAnalysisResponse,
  validateAIConfig,
} from "@/services/aiRiskService";
import { cn } from "@/lib/utils";
import {
  getUserFacingErrorDescription,
  notifyUserFacingError,
} from "@/lib/userFacingError";
import {
  buildNaceFineKinneyRows,
  exportNaceRiskAnalysisPdf,
  saveNaceRiskRowsForRiskWizard,
  type NaceRiskWizardTransferPayload,
} from "@/lib/naceRiskTransfer";

interface NaceResult {
  nace_code: string;
  nace_title: string;
  hazard_class: string;
  sector: string;
}

const exampleCodes = [
  { code: "41.20", title: "Bina inşaatı", tone: "blue" },
  { code: "47.11", title: "Market perakende", tone: "emerald" },
  { code: "25.11", title: "Metal yapı imalat", tone: "amber" },
];

const hazardMeta: Record<string, { className: string; softClassName: string; label: string; description: string }> = {
  "Az Tehlikeli": {
    className: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
    softClassName: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    label: "Düşük risk",
    description: "Temel iş güvenliği tedbirleri ve periyodik kontroller çoğu süreç için yeterlidir.",
  },
  Tehlikeli: {
    className: "border-amber-400/30 bg-amber-500/15 text-amber-100",
    softClassName: "border-amber-400/20 bg-amber-500/10 text-amber-200",
    label: "Orta risk",
    description: "Daha düzenli izleme, eğitim ve dokümante edilmiş kontrol tedbirleri gerekir.",
  },
  "Çok Tehlikeli": {
    className: "border-rose-400/30 bg-rose-500/15 text-rose-100",
    softClassName: "border-rose-400/20 bg-rose-500/10 text-rose-200",
    label: "Yüksek risk",
    description: "Sıkı kontrol, sürekli denetim ve ayrıntılı risk değerlendirme yaklaşımı zorunludur.",
  },
};

const getHazardMeta = (hazardClass: string) =>
  hazardMeta[hazardClass] ?? {
    className: "border-slate-500/30 bg-slate-500/15 text-slate-100",
    softClassName: "border-slate-500/20 bg-slate-500/10 text-slate-200",
    label: "Bilinmiyor",
    description: "Bu tehlike sınıfı için standart açıklama bulunamadı.",
  };

export default function NaceHazardQuery() {
  const [searchParams] = useSearchParams();
  const [naceCode, setNaceCode] = useState(() => searchParams.get("code") ?? "");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [result, setResult] = useState<NaceResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<RiskAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizedInput = useMemo(() => naceCode.trim(), [naceCode]);

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) setNaceCode(code);
  }, [searchParams]);

  const handleSearch = async () => {
    if (!normalizedInput) {
      toast.error("Lütfen NACE kodu girin");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setAiAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke("nace-query", {
        body: { nace: normalizedInput },
      });

      if (error) throw new Error(error.message || "NACE kodu bulunamadı");
      if (!data.success) throw new Error(data.error || "NACE kodu bulunamadı");

      setResult(data.data);
      toast.success("NACE kodu bulundu");
    } catch (err) {
      setError(getUserFacingErrorDescription(err));
      notifyUserFacingError(err, {
        fallbackTitle: "NACE kodu bulunamadı",
        fallbackDescription: "Girilen NACE kodu için kayıt bulunamadı. Kodu kontrol edip tekrar deneyin.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAIAnalysis = async () => {
    if (!result) return;

    if (!validateAIConfig()) {
      toast.error("AI servisi yapılandırılmamış");
      return;
    }

    setAiLoading(true);

    try {
      const analysis = await generateNaceRiskAnalysis({
        naceCode: result.nace_code,
        sector: result.sector,
        hazardClass: result.hazard_class,
        naceTitle: result.nace_title,
      });

      setAiAnalysis(analysis);
      toast.success(`${analysis.risks.length} risk tespit edildi`);
    } catch (err) {
      notifyUserFacingError(err, {
        fallbackTitle: "AI analizi oluşturulamadı",
        fallbackDescription: "NACE risk analizi şu anda oluşturulamadı. Biraz sonra tekrar deneyin.",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const selectedHazardMeta = result ? getHazardMeta(result.hazard_class) : null;
  const fineKinneyRows = useMemo(() => {
    if (!result || !aiAnalysis) return [];
    return buildNaceFineKinneyRows({
      risks: aiAnalysis.risks,
      naceCode: result.nace_code,
      sector: result.sector,
      hazardClass: result.hazard_class,
      naceTitle: result.nace_title,
    });
  }, [aiAnalysis, result]);

  const buildTransferPayload = (): NaceRiskWizardTransferPayload | null => {
    if (!result || fineKinneyRows.length === 0) return null;
    return {
      createdAt: new Date().toISOString(),
      naceCode: result.nace_code,
      naceTitle: result.nace_title,
      sector: result.sector,
      hazardClass: result.hazard_class,
      rows: fineKinneyRows,
    };
  };

  const handleExportPdf = () => {
    const payload = buildTransferPayload();
    if (!payload) {
      toast.error("PDF için önce AI risk analizi oluşturun.");
      return;
    }
    exportNaceRiskAnalysisPdf(payload);
    toast.success("Renkli AI risk analizi PDF olarak indirildi.");
  };

  const handleSendToRiskWizard = () => {
    const payload = buildTransferPayload();
    if (!payload) {
      toast.error("Aktarım için önce AI risk analizi oluşturun.");
      return;
    }
    saveNaceRiskRowsForRiskWizard(payload);
    toast.success(`${payload.rows.length} risk maddesi Risk Wizard için hazırlandı.`);
    window.location.href = "/risk-wizard";
  };

  return (
    <div className="w-full min-w-0 space-y-6 p-4 text-slate-100 sm:p-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.20),transparent_32%),linear-gradient(135deg,#020617_0%,#0f172a_48%,#082f49_100%)] p-6 shadow-2xl shadow-slate-950/40 lg:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-8 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-center">
          <div className="space-y-5">
            <Badge className="w-fit border border-cyan-300/25 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/10">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              NACE Tehlike Sınıfı ve AI Risk Analizi
            </Badge>
            <div>
              <h1 className="max-w-4xl text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                NACE kodundan tehlike sınıfını ve ön risk başlıklarını hızlıca bulun
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                Faaliyet kodunu girin; sistem tehlike sınıfını, sektör bilgisini ve AI destekli risk önerilerini profesyonel bir özet halinde hazırlasın.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Kod sorgulama", value: "Anlık", icon: Database },
                { label: "Tehlike sınıfı", value: "Resmi veri", icon: Shield },
                { label: "AI risk analizi", value: "Sektörel", icon: Zap },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                    <Icon className="h-5 w-5 text-cyan-200" />
                    <p className="mt-3 text-lg font-black text-white">{item.value}</p>
                    <p className="text-xs text-slate-400">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <Card className="border-white/10 bg-slate-950/70 text-slate-100 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Hızlı Sorgu</p>
                <h2 className="mt-2 text-xl font-black text-white">NACE kodu girin</h2>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="nace-code"
                    name="naceCode"
                    placeholder="Örn: 41.20 veya 4120"
                    value={naceCode}
                    onChange={(event) => setNaceCode(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && void handleSearch()}
                    className="h-12 rounded-2xl border-slate-700 bg-slate-950 pl-11 text-base font-bold text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400/20"
                  />
                </div>
                <Button onClick={() => void handleSearch()} disabled={loading} className="h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 font-black text-white shadow-lg shadow-cyan-950/30 hover:from-blue-500 hover:to-cyan-400">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Sorgula
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                {exampleCodes.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setNaceCode(item.code)}
                    className="rounded-2xl border border-slate-700 bg-slate-900/70 p-3 text-left transition hover:border-cyan-400/50 hover:bg-slate-800"
                  >
                    <span className="font-mono text-sm font-black text-white">{item.code}</span>
                    <span className="mt-1 block text-xs text-slate-400">{item.title}</span>
                  </button>
                ))}
              </div>
              <Link to="/nace-query/sectors" className="inline-flex items-center text-sm font-bold text-cyan-200 hover:text-cyan-100">
                Sektör listesinden kod seç
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {error ? (
        <Alert className="border-rose-400/25 bg-rose-500/10 text-rose-50">
          <AlertTriangle className="h-4 w-4 text-rose-300" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {result ? (
            <Card className="overflow-hidden border-slate-800 bg-slate-950/80 text-slate-100 shadow-xl shadow-slate-950/30">
              <CardContent className="p-0">
                <div className="border-b border-slate-800 bg-slate-900/80 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <Badge variant="outline" className="border-cyan-400/30 bg-cyan-500/10 font-mono text-cyan-100">
                        NACE {result.nace_code}
                      </Badge>
                      <h2 className="mt-3 text-2xl font-black text-white">{result.nace_title}</h2>
                      <p className="mt-2 text-sm text-slate-400">{result.sector}</p>
                    </div>
                    <Button onClick={() => void handleAIAnalysis()} disabled={aiLoading} className="rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 font-black text-white shadow-lg shadow-violet-950/30 hover:from-violet-500 hover:to-cyan-400">
                      {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                      AI Risk Analizi
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 lg:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Faaliyet Açıklaması</p>
                    <p className="mt-3 text-lg font-bold leading-7 text-white">{result.nace_title}</p>
                    <p className="mt-4 text-sm leading-6 text-slate-400">Bu faaliyet kodu için tehlike sınıfı, İSG planlaması, uzman/hekim süreleri ve risk dokümanı hazırlığında temel referans olarak kullanılabilir.</p>
                  </div>
                  <div className={cn("rounded-2xl border p-4", selectedHazardMeta?.softClassName)}>
                    <div className="flex items-center gap-3">
                      {result.hazard_class === "Az Tehlikeli" ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-80">Tehlike Sınıfı</p>
                        <p className="text-xl font-black">{result.hazard_class}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm font-semibold">{selectedHazardMeta?.label}</p>
                    <p className="mt-2 text-sm leading-6 opacity-90">{selectedHazardMeta?.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-slate-800 bg-slate-950/60 text-slate-100">
              <CardContent className="grid min-h-[260px] place-items-center p-8 text-center">
                <div>
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-400/20">
                    <Search className="h-6 w-6" />
                  </div>
                  <h2 className="mt-4 text-xl font-black text-white">Sorgu sonucu burada görünecek</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">NACE kodunu girip sorguladığınızda faaliyet, sektör ve tehlike sınıfı özetini bu alanda inceleyebilirsiniz.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {aiAnalysis ? (
            <section className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">AI Risk Çıktısı</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Sektörel risk önerileri</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="w-fit bg-violet-500/15 text-violet-100 hover:bg-violet-500/15">{aiAnalysis.risks.length} risk</Badge>
                  <Button
                    type="button"
                    onClick={handleExportPdf}
                    className="h-9 rounded-xl bg-rose-600 text-white hover:bg-rose-500"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Renkli PDF Al
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSendToRiskWizard}
                    className="h-9 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 font-black text-white hover:from-emerald-500 hover:to-cyan-500"
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Risk Wizard'a Aktar
                  </Button>
                </div>
              </div>
              <div className="grid gap-4">
                {fineKinneyRows.map((risk, index) => (
                  <Card key={`${risk.hazardSource}-${index}`} className="border-slate-800 bg-slate-950/80 text-slate-100 shadow-lg shadow-slate-950/20">
                    <CardContent className="p-5">
                      <div className="flex gap-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-500/10 text-sm font-black text-cyan-200 ring-1 ring-cyan-400/20">{index + 1}</span>
                        <div className="min-w-0 flex-1 space-y-4">
                          <div>
                            <h3 className="text-lg font-black text-white">{risk.hazardSource}</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-300">{risk.riskConsequence}</p>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {[
                              ["Faaliyet / Bölüm", risk.departmentActivity],
                              ["Mevcut Durum", risk.currentMeasure],
                              ["O F Ş R", `${risk.probability} · ${risk.frequency} · ${risk.severity} · ${risk.riskScore}`],
                              ["Riskin Tanımı", risk.riskLevel],
                              ["Olası Sonuç", risk.possibleOutcome],
                              ["DÖF Sonrası", `${risk.postProbability} · ${risk.postFrequency} · ${risk.postSeverity} · ${risk.postRiskScore}`],
                              ["Risk Tanımı (DÖF)", risk.postRiskLevel],
                              ["Termin / Sorumlu", `${risk.deadline} · ${risk.responsible}`],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                                <p className="mt-2 text-sm font-semibold leading-5 text-slate-200">{value || "-"}</p>
                              </div>
                            ))}
                          </div>
                          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Düzeltici / Önleyici Faaliyet</p>
                            <ul className="mt-3 space-y-2">
                              {risk.additionalMeasures.split("\n").filter(Boolean).map((measure, measureIndex) => (
                                <li key={`${measure}-${measureIndex}`} className="flex gap-2 text-sm leading-6 text-slate-200">
                                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                                  <span>{measure}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card className="border-slate-800 bg-slate-950/80 text-slate-100 shadow-xl shadow-slate-950/20">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-500/10 text-blue-200 ring-1 ring-blue-400/20">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-white">Nasıl kullanılır?</h3>
                  <p className="text-xs text-slate-400">4 kısa adım</p>
                </div>
              </div>
              {[
                "NACE kodunu yazın veya sektör listesinden seçin.",
                "Tehlike sınıfı ve sektör bilgisini kontrol edin.",
                "AI risk analizini çalıştırın.",
                "Riskleri değerlendirme ve planlama ekranlarında kullanın.",
              ].map((step, index) => (
                <div key={step} className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cyan-500/10 text-xs font-black text-cyan-200">{index + 1}</span>
                  <p className="text-sm leading-6 text-slate-300">{step}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Alert className="border-blue-400/20 bg-blue-500/10 text-blue-50">
            <Info className="h-4 w-4 text-blue-200" />
            <AlertDescription className="text-blue-100/90">
              NACE kodu tehlike sınıfı, iş güvenliği hizmet süreleri ve dokümantasyon kapsamı için temel referanstır.
            </AlertDescription>
          </Alert>
        </aside>
      </div>
    </div>
  );
}
