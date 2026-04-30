// ====================================================
// NACE HAZARD QUERY - "NASIL KULLANILIR?" BÖLÜMÜ EKLENMİŞ
// ====================================================

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Lightbulb,
  TrendingUp,
  Info,
  HelpCircle,
  BookOpen,
  Zap,
  Target,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  generateNaceRiskAnalysis,
  type RiskAnalysisResponse,
  validateAIConfig,
} from "@/services/aiRiskService";

interface NaceResult {
  nace_code: string;
  nace_title: string;
  hazard_class: string;
  sector: string;
}

export default function NaceHazardQuery() {
  const [naceCode, setNaceCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [result, setResult] = useState<NaceResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<RiskAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!naceCode.trim()) {
      toast.error("Lütfen NACE kodu girin");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setAiAnalysis(null);

    try {
      console.log("🔍 Searching NACE code:", naceCode);

      const { data, error } = await supabase.functions.invoke("nace-query", {
        body: { nace: naceCode.trim() },
      });

      if (error) {
        console.error("❌ Supabase function error:", error);
        throw new Error(error.message || "NACE kodu bulunamadı");
      }

      if (!data.success) {
        throw new Error(data.error || "NACE kodu bulunamadı");
      }

      console.log("✅ NACE result:", data.data);

      setResult(data.data);
      toast.success("NACE kodu bulundu");
    } catch (err) {
      console.error("❌ Search error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "NACE kodu bulunamadı";
      setError(errorMessage);
      toast.error(errorMessage);
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
      console.log("🤖 Starting AI risk analysis...");

      const analysis = await generateNaceRiskAnalysis({
        naceCode: result.nace_code,
        sector: result.sector,
        hazardClass: result.hazard_class,
        naceTitle: result.nace_title,
      });

      console.log("✅ AI analysis completed:", analysis);

      setAiAnalysis(analysis);
      toast.success(`${analysis.risks.length} risk tespit edildi`);
    } catch (err) {
      console.error("❌ AI analysis error:", err);
      toast.error("AI analizi başar��sız", {
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const getHazardColor = (hazardClass: string) => {
    switch (hazardClass) {
      case "Az Tehlikeli":
        return "bg-green-500";
      case "Tehlikeli":
        return "bg-yellow-500";
      case "Çok Tehlikeli":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getHazardIcon = (hazardClass: string) => {
    switch (hazardClass) {
      case "Az Tehlikeli":
        return <CheckCircle2 className="h-5 w-5" />;
      case "Tehlikeli":
        return <AlertTriangle className="h-5 w-5" />;
      case "Çok Tehlikeli":
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Shield className="h-5 w-5" />;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          NACE Kod Tehlike Sınıfı Sorgulama
        </h1>
        <p className="text-muted-foreground">
          NACE koduna göre tehlike sınıfı sorgulama ve AI destekli risk analizi
        </p>
      </div>

      {/* ✅ NASIL KULLANILIR? BÖLÜMÜ */}
      <Card className="border-blue-500/20 bg-gradient-to-br from-blue-950/20 to-purple-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-500" />
            Nasıl Kullanılır?
          </CardTitle>
          <CardDescription>
            NACE kod sorgulama ve AI risk analizi için adım adım rehber
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {/* Adım 1 */}
            <AccordionItem value="step-1">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white font-bold">
                    1
                  </div>
                  <span className="font-semibold">NACE Kodunu Girin</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-11">
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground">
                    İşyerinizin NACE (ekonomik faaliyet) kodunu aşağıdaki
                    formatlarda girebilirsiniz:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-4 w-4 text-green-500" />
                          <span className="font-mono font-semibold">41.20</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Noktalı format
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-4 w-4 text-green-500" />
                          <span className="font-mono font-semibold">4120</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Noktasız format
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-4 w-4 text-green-500" />
                          <span className="font-mono font-semibold">47.11</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Her iki format da
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  <Alert>
                    <BookOpen className="h-4 w-4" />
                    <AlertDescription>
                      <strong>NACE kodunuzu bilmiyor musunuz?</strong> "Sektör
                      Listesi" sayfasından tüm kodları inceleyebilirsiniz.
                    </AlertDescription>
                  </Alert>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Adım 2 */}
            <AccordionItem value="step-2">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500 text-white font-bold">
                    2
                  </div>
                  <span className="font-semibold">Tehlike Sınıfını Görün</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-11">
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Sorgulama sonucunda işyerinizin tehlike sınıfını öğreneceksiniz:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Card className="border-green-500/50">
                      <CardContent className="pt-4">
                        <Badge className="bg-green-500 text-white mb-2">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Az Tehlikeli
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          Düşük risk seviyesi. Temel iş güvenliği tedbirleri yeterli.
                        </p>
                        <p className="text-xs font-semibold mt-2">
                          Örnek: Ofis, market, eğitim
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-yellow-500/50">
                      <CardContent className="pt-4">
                        <Badge className="bg-yellow-500 text-white mb-2">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Tehlikeli
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          Orta risk seviyesi. Kapsamlı güvenlik tedbirleri gerekir.
                        </p>
                        <p className="text-xs font-semibold mt-2">
                          Örnek: İmalat, lojistik, gıda
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-red-500/50">
                      <CardContent className="pt-4">
                        <Badge className="bg-red-500 text-white mb-2">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Çok Tehlikeli
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          Yüksek risk. Sıkı tedbirler ve sürekli denetim zorunlu.
                        </p>
                        <p className="text-xs font-semibold mt-2">
                          Örnek: İnşaat, madencilik, kimya
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Adım 3 */}
            <AccordionItem value="step-3">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white font-bold">
                    3
                  </div>
                  <span className="font-semibold">
                    AI Risk Analizi Yapın
                    <Badge className="ml-2 bg-purple-500/20 text-purple-400 border-purple-500/30">
                      AI
                    </Badge>
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-11">
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Sonuç geldikten sonra "AI Risk Analizi" butonuna basarak
                    yapay zeka destekli detaylı risk analizi alın.
                  </p>
                  <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Zap className="h-5 w-5 text-purple-400 mt-0.5" />
                      <div>
                        <h4 className="font-semibold mb-2">AI Size Ne Sağlar?</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            <span>
                              Sektörünüze özel <strong>5 ana tehlike</strong>
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            <span>
                              Her tehlike için <strong>detaylı risk açıklaması</strong>
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            <span>
                              <strong>Önleyici tedbirler</strong> ve öneriler
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            <span>
                              <strong>6331 sayılı İSG Kanunu</strong> uyumlu analiz
                            </span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      AI analizi <strong>30-60 saniye</strong> sürebilir.
                      Google Gemini AI motorunu kullanır.
                    </AlertDescription>
                  </Alert>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Adım 4 */}
            <AccordionItem value="step-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white font-bold">
                    4
                  </div>
                  <span className="font-semibold">Sonuçları Kullanın</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-11">
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground">
                    AI risk analizi sonuçlarını farklı modüllerde kullanabilirsiniz:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Card>
                      <CardContent className="pt-4">
                        <TrendingUp className="h-8 w-8 text-blue-500 mb-2" />
                        <h4 className="font-semibold mb-1">Fine Kinney</h4>
                        <p className="text-xs text-muted-foreground">
                          Riskleri skorlayarak öncelik belirleyin
                        </p>
                        <Badge variant="outline" className="mt-2">
                          Yakında
                        </Badge>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <Shield className="h-8 w-8 text-orange-500 mb-2" />
                        <h4 className="font-semibold mb-1">ADEP Planı</h4>
                        <p className="text-xs text-muted-foreground">
                          Acil durum eylem planı oluşturun
                        </p>
                        <Badge variant="outline" className="mt-2">
                          Yakında
                        </Badge>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <BookOpen className="h-8 w-8 text-purple-500 mb-2" />
                        <h4 className="font-semibold mb-1">Risk Kütüphanesi</h4>
                        <p className="text-xs text-muted-foreground">
                          Riskleri kütüphanenize kaydedin
                        </p>
                        <Badge variant="outline" className="mt-2">
                          Yakında
                        </Badge>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Quick Start */}
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center gap-2 mb-3">
              <PlayCircle className="h-5 w-5 text-green-500" />
              <h4 className="font-semibold">Hızlı Başlangıç Örnekleri</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => setNaceCode("41.20")}
              >
                <div className="text-left">
                  <div className="font-mono font-bold">41.20</div>
                  <div className="text-xs text-muted-foreground">
                    Bina İnşaatı
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => setNaceCode("47.11")}
              >
                <div className="text-left">
                  <div className="font-mono font-bold">47.11</div>
                  <div className="text-xs text-muted-foreground">
                    Market Perakende
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => setNaceCode("25.11")}
              >
                <div className="text-left">
                  <div className="font-mono font-bold">25.11</div>
                  <div className="text-xs text-muted-foreground">
                    Metal Yapı İmalat
                  </div>
                </div>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          NACE (Avrupa Topluluğu'nda Ekonomik Faaliyetlerin İstatistiki
          Sınıflandırması) koduna göre işyeri tehlike sınıfını ve iş sağlığı
          güvenliği risklerini öğrenin.
        </AlertDescription>
      </Alert>

      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle>NACE Kodu Sorgula</CardTitle>
          <CardDescription>
            Örnek: 41.20, 4120, 47.11 veya 4711 formatında girebilirsiniz
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="NACE kodunu girin (örn: 41.20)"
              value={naceCode}
              onChange={(e) => setNaceCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2">Sorgula</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Result Display */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tehlike Sınıfı Sonucu</CardTitle>
                <CardDescription>NACE: {result.nace_code}</CardDescription>
              </div>
              <Button onClick={handleAIAnalysis} disabled={aiLoading}>
                {aiLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Lightbulb className="h-4 w-4 mr-2" />
                )}
                AI Risk Analizi
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* NACE Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Faaliyet
                </label>
                <p className="text-lg font-semibold">{result.nace_title}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Sektör
                </label>
                <p className="text-lg font-semibold">{result.sector}</p>
              </div>
            </div>

            {/* Hazard Class Badge */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Tehlike Sınıfı
              </label>
              <Badge
                className={`${getHazardColor(
                  result.hazard_class
                )} text-white text-lg px-4 py-2`}
              >
                <span className="mr-2">{getHazardIcon(result.hazard_class)}</span>
                {result.hazard_class}
              </Badge>
            </div>

            {/* Hazard Class Info */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {result.hazard_class === "Az Tehlikeli" && (
                  <span>
                    <strong>Az Tehlikeli:</strong> Düşük risk seviyesi. Temel iş
                    güvenliği tedbirleri yeterlidir.
                  </span>
                )}
                {result.hazard_class === "Tehlikeli" && (
                  <span>
                    <strong>Tehlikeli:</strong> Orta risk seviyesi. Kapsamlı
                    güvenlik tedbirleri gerektirir.
                  </span>
                )}
                {result.hazard_class === "Çok Tehlikeli" && (
                  <span>
                    <strong>Çok Tehlikeli:</strong> Yüksek risk seviyesi. Sıkı
                    güvenlik tedbirleri ve sürekli denetim zorunludur.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* AI Analysis Results */}
      {aiAnalysis && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">AI Risk Analizi Sonuçları</h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {aiAnalysis.risks.map((risk, index) => (
              <Card key={index} className="border-l-4 border-l-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      {index + 1}
                    </span>
                    {risk.hazard}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Risk Description */}
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground mb-2">
                      Risk Tanımı
                    </h4>
                    <p className="text-sm leading-relaxed">{risk.risk}</p>
                  </div>

                  {/* Preventive Measures */}
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground mb-2">
                      Önleyici Tedbirler
                    </h4>
                    <ul className="space-y-2">
                      {risk.preventiveMeasures.map((measure, mIndex) => (
                        <li
                          key={mIndex}
                          className="flex items-start gap-2 text-sm"
                        >
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{measure}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Action Buttons */}
          <Card className="bg-muted">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" className="flex-1">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Fine Kinney Analizi Oluştur
                </Button>
                <Button variant="outline" className="flex-1">
                  <Shield className="h-4 w-4 mr-2" />
                  ADEP Planına Ekle
                </Button>
                <Button variant="outline" className="flex-1">
                  <Info className="h-4 w-4 mr-2" />
                  Risk Kütüphanesine Kaydet
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
