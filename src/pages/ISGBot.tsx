import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ISGBotDashboard from "@/components/isg-bot/ISGBotDashboard";
import ISGBotCommandCenter from "@/components/isg-bot/ISGBotCommandCenter";
import AuditReadiness from "@/components/isg-bot/AuditReadiness";
import ComplianceReport from "@/components/isg-bot/ComplianceReport";
import RiskAnalyzer from "@/components/isg-bot/RiskAnalyzer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Shield,
  BarChart3,
  FileCheck,
  TrendingUp,
  Bot,
  Zap,
  Chrome,
  ExternalLink,
  Layers3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

const allowedTabs = new Set(["dashboard", "audit", "compliance", "risk"]);

export default function ISGBot() {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = useMemo(() => {
    const tab = searchParams.get("tab") ?? "dashboard";
    return allowedTabs.has(tab) ? tab : "dashboard";
  }, [searchParams]);

  const handleDownloadExtension = () => {
    window.open("/chrome-extension.zip", "_blank");
  };

  const handleOpenExtensionGuide = () => {
    window.open("/docs/isg-bot-setup", "_blank");
  };

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "dashboard") {
      next.delete("tab");
    } else {
      next.set("tab", value);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <Bot className="h-8 w-8 text-primary" />
            Akıllı İSG Operasyon Botu
          </h1>
          <p className="max-w-3xl text-muted-foreground">
            Uzmanlar için operasyon, firmalar için karar desteği, OSGB için portföy görünümü.
            İSG-KATİP verilerini aksiyona, mevzuat takibine ve görev üretimine çevirir.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleOpenExtensionGuide} variant="outline">
            <ExternalLink className="mr-2 h-4 w-4" />
            Kurulum Rehberi
          </Button>
          <Button onClick={handleDownloadExtension}>
            <Chrome className="mr-2 h-4 w-4" />
            Chrome Extension İndir
          </Button>
        </div>
      </div>

      <Alert>
        <Zap className="h-4 w-4" />
        <AlertDescription>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <strong>Chrome Extension kurulumu gerekli:</strong> İSG-KATİP entegrasyonu için uzantıyı yükleyin,
              ardından bot verileri otomatik olarak bu alana taşır.
            </div>
            <Button variant="link" size="sm" onClick={handleOpenExtensionGuide}>
              Nasıl kurulur?
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <ISGBotCommandCenter />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <BarChart3 className="h-8 w-8 text-primary opacity-20" />
              <Badge>Canlı</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <h3 className="font-semibold">Operasyon dashboard</h3>
            <p className="text-sm text-muted-foreground">Firma durumu, senkron verisi ve genel görünüm.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Shield className="h-8 w-8 text-green-500 opacity-20" />
              <Badge variant="outline">Uzman</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <h3 className="font-semibold">Denetim hazırlığı</h3>
            <p className="text-sm text-muted-foreground">Hazırlık skoru, eksik sözleşme ve kurul kontrolü.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <FileCheck className="h-8 w-8 text-blue-500 opacity-20" />
              <Badge variant="secondary">Mevzuat</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <h3 className="font-semibold">Compliance raporu</h3>
            <p className="text-sm text-muted-foreground">Uyumsuzluk bayrakları, çözüm notları ve takip.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Layers3 className="h-8 w-8 text-orange-500 opacity-20" />
              <Badge variant="destructive">OSGB</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <h3 className="font-semibold">Portföy görünümü</h3>
            <p className="text-sm text-muted-foreground">Riskli firmalar, uzman yoğunluğu ve açık dağılımı.</p>
          </CardContent>
        </Card>
      </div>

      <Card id="isg-bot-toolset">
        <CardHeader>
          <CardTitle>Araç seti</CardTitle>
          <CardDescription>
            Komuta merkezindeki özetlerin arkasındaki operasyon ekranları burada yer alır.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
              <TabsTrigger value="dashboard" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Denetime Hazır mıyım?</span>
              </TabsTrigger>
              <TabsTrigger value="compliance" className="gap-2">
                <FileCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Compliance</span>
              </TabsTrigger>
              <TabsTrigger value="risk" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Risk Analizi</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4">
              <ISGBotDashboard />
            </TabsContent>
            <TabsContent value="audit" className="space-y-4">
              <AuditReadiness />
            </TabsContent>
            <TabsContent value="compliance" className="space-y-4">
              <ComplianceReport />
            </TabsContent>
            <TabsContent value="risk" className="space-y-4">
              <RiskAnalyzer />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
