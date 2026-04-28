import { useEffect, useMemo, useState } from "react";
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
  Bot,
  Building2,
  CalendarClock,
  CheckCircle2,
  Chrome,
  ExternalLink,
  FileCheck,
  Loader2,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const tabAliases: Record<string, string> = {
  dashboard: "overview",
  audit: "readiness",
};

const allowedTabs = new Set(["overview", "readiness", "compliance", "risk"]);

type BotStatus = "setup_required" | "ready_to_sync" | "synced";

type BotSnapshot = {
  companyCount: number;
  lastSyncedAt: string | null;
  status: BotStatus;
};

const formatSyncLabel = (value: string | null) => {
  if (!value) return "Henüz senkron yapılmadı";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Son senkron bilgisi alınamadı";
  return parsed.toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

export default function ISGBot() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [snapshot, setSnapshot] = useState<BotSnapshot>({
    companyCount: 0,
    lastSyncedAt: null,
    status: "setup_required",
  });
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);

  const activeTab = useMemo(() => {
    const rawTab = searchParams.get("tab") ?? "overview";
    const normalizedTab = tabAliases[rawTab] ?? rawTab;
    return allowedTabs.has(normalizedTab) ? normalizedTab : "overview";
  }, [searchParams]);

  useEffect(() => {
    if (!user?.id) {
      setSnapshot({
        companyCount: 0,
        lastSyncedAt: null,
        status: "setup_required",
      });
      setLoadingSnapshot(false);
      return;
    }

    let cancelled = false;

    const loadSnapshot = async () => {
      setLoadingSnapshot(true);
      try {
        const { data, error } = await supabase
          .from("isgkatip_companies")
          .select("id, last_synced_at")
          .eq("user_id", user.id)
          .order("last_synced_at", { ascending: false, nullsFirst: false });

        if (error) throw error;

        if (cancelled) return;

        const rows = data ?? [];
        const companyCount = rows.length;
        const lastSyncedAt = rows.find((row) => row.last_synced_at)?.last_synced_at ?? null;

        setSnapshot({
          companyCount,
          lastSyncedAt,
          status: companyCount > 0 ? "synced" : "ready_to_sync",
        });
      } catch (error) {
        if (!cancelled) {
          setSnapshot({
            companyCount: 0,
            lastSyncedAt: null,
            status: "ready_to_sync",
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingSnapshot(false);
        }
      }
    };

    void loadSnapshot();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleDownloadExtension = () => {
    window.open("/chrome-extension.zip", "_blank", "noopener,noreferrer");
  };

  const handleOpenExtensionGuide = () => {
    window.open("/docs/isg-bot-setup", "_blank", "noopener,noreferrer");
  };

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "overview") {
      next.delete("tab");
    } else {
      next.set("tab", value);
    }
    setSearchParams(next, { replace: true });
  };

  const statusBadge = useMemo(() => {
    if (loadingSnapshot) {
      return {
        label: "Durum okunuyor",
        className: "border-slate-700 bg-slate-800/80 text-slate-200",
      };
    }

    if (snapshot.status === "synced") {
      return {
        label: "Aksiyon hazır",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      };
    }

    if (snapshot.status === "ready_to_sync") {
      return {
        label: "İlk senkron bekleniyor",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      };
    }

    return {
      label: "Kurulum gerekli",
      className: "border-slate-700 bg-slate-800/80 text-slate-200",
    };
  }, [loadingSnapshot, snapshot.status]);

  const statusTitle = loadingSnapshot
    ? "Durum kontrol ediliyor"
    : snapshot.status === "synced"
    ? "Eklenti bağlantısı kullanıma hazır"
    : snapshot.status === "ready_to_sync"
    ? "Kurulum tamamlanmış olabilir, ilk veri bekleniyor"
    : "Kurulum adımları tamamlanmalı";

  const statusDescription = loadingSnapshot
    ? "ISG-Bot kaynak verisi ve son senkron bilgisi kontrol ediliyor."
    : snapshot.status === "synced"
    ? `${snapshot.companyCount} firma hazır. Sonraki adım, öncelikli aksiyonları kontrol edip ilgili modüllere geçmek.`
    : snapshot.status === "ready_to_sync"
    ? "Eklentiyi kurup İSG-KATİP işyeri listesi ekranını açtıktan sonra ilk senkron burada görünecek."
    : "Chrome eklentisini kurup İSG-KATİP üzerinden ilk veri alımını yapmanız gerekiyor.";

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <Badge className="w-fit border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/10">
                  ISG-Bot Durum Merkezi
                </Badge>
                <div className="space-y-2">
                  <CardTitle className="flex items-center gap-3 text-3xl">
                    <Bot className="h-8 w-8 text-cyan-400" />
                    İSG-KATİP verinizi aksiyona çevirin
                  </CardTitle>
                  <CardDescription className="max-w-3xl text-base leading-7 text-slate-300">
                    ISG-Bot, İSG-KATİP verinizi okunabilir hale getirir; eksikleri, yaklaşan işleri
                    ve öncelikli aksiyonları sizin yerinize sıralar. Burada veri girişi değil, durum
                    okuma ve operasyon yönlendirmesi yapılır.
                  </CardDescription>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleOpenExtensionGuide} variant="outline" className="border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-slate-800">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Kurulum Rehberi
                </Button>
                <Button onClick={handleDownloadExtension} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                  <Chrome className="mr-2 h-4 w-4" />
                  Eklentiyi İndir
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">1. Kur</p>
                <p className="mt-2 text-sm text-slate-200">Chrome eklentisini yükleyin ve tarayıcıyı hazırlayın.</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">2. Senkronize Et</p>
                <p className="mt-2 text-sm text-slate-200">İSG-KATİP işyeri listesinde ilk veriyi alın.</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">3. Aksiyon Al</p>
                <p className="mt-2 text-sm text-slate-200">Eksik sözleşme, kurul ve denetim hazırlığını bu merkezden yönetin.</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-slate-800 bg-slate-950/80 text-slate-50">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Bağlantı ve Durum</CardTitle>
                <CardDescription className="text-slate-400">
                  Eklenti hazır mı, veri geldi mi, sıradaki adım ne?
                </CardDescription>
              </div>
              <Badge variant="outline" className={statusBadge.className}>
                {statusBadge.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-start gap-3">
                {loadingSnapshot ? (
                  <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-cyan-400" />
                ) : snapshot.status === "synced" ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />
                ) : (
                  <Chrome className="mt-0.5 h-5 w-5 text-amber-400" />
                )}
                <div className="space-y-1">
                  <p className="font-semibold text-white">{statusTitle}</p>
                  <p className="text-sm leading-6 text-slate-300">{statusDescription}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Son senkron</p>
                <p className="mt-2 text-base font-semibold text-white">{formatSyncLabel(snapshot.lastSyncedAt)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Hazır firma</p>
                <p className="mt-2 text-base font-semibold text-white">{snapshot.companyCount}</p>
              </div>
            </div>

            <Alert className="border-slate-800 bg-slate-900/70 text-slate-100">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <AlertTitle>İlk senkron sonrası ne yapacağım?</AlertTitle>
              <AlertDescription className="mt-2 space-y-2 text-sm text-slate-300">
                <p>Önce öneri kartlarındaki işi tamamlayın. Ardından sözleşme, kurul ve denetim hazırlığı sekmelerine geçin.</p>
                <p>Bu ekran bireysel uzmana yön verir; ekip, portföy ve çok kullanıcılı operasyon için OSGB modülü kullanılır.</p>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Shield className="h-8 w-8 text-cyan-500 opacity-25" />
              <Badge variant="outline">Bireysel</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <h3 className="font-semibold">Günlük uzman akışı</h3>
            <p className="text-sm text-muted-foreground">Önce neye bakacağınızı, hangi firmada neyin eksik olduğunu söyler.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CalendarClock className="h-8 w-8 text-amber-500 opacity-25" />
              <Badge variant="outline">Hazırlık</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <h3 className="font-semibold">Yaklaşan işler</h3>
            <p className="text-sm text-muted-foreground">Sözleşme, kurul ve denetim baskısını gecikmeden görünür hale getirir.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <FileCheck className="h-8 w-8 text-emerald-500 opacity-25" />
              <Badge variant="outline">Uyum</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <h3 className="font-semibold">Mevzuat görünümü</h3>
            <p className="text-sm text-muted-foreground">Uyumsuzluk bayraklarını iş diline çevirir ve hangi başlığa dönmeniz gerektiğini söyler.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Building2 className="h-8 w-8 text-violet-500 opacity-25" />
              <Badge variant="outline">OSGB farkı</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <h3 className="font-semibold">Portföy değil, kişisel akış</h3>
            <p className="text-sm text-muted-foreground">ISG-Bot bireysel uzman ekranıdır. Ekipli portföy yönetimi için OSGB modülü kullanılır.</p>
          </CardContent>
        </Card>
      </div>

      <ISGBotCommandCenter />

      <Card id="isg-bot-toolset">
        <CardHeader>
          <CardTitle>Çalışma Alanları</CardTitle>
          <CardDescription>
            Veriyi farklı teknik ekranlara değil, ihtiyacınıza göre sade iş akışlarına ayırır.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 gap-2 bg-transparent p-0 md:grid-cols-4">
              <TabsTrigger value="overview" className="border border-border bg-background data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Genel Durum
              </TabsTrigger>
              <TabsTrigger value="readiness" className="border border-border bg-background data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Denetime Hazırlık
              </TabsTrigger>
              <TabsTrigger value="compliance" className="border border-border bg-background data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Uyum Kontrolü
              </TabsTrigger>
              <TabsTrigger value="risk" className="border border-border bg-background data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Risk Görünümü
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <ISGBotDashboard />
            </TabsContent>
            <TabsContent value="readiness" className="space-y-4">
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

      <Card>
        <CardHeader>
          <CardTitle>ISG-Bot ve OSGB Modülü Arasındaki Fark</CardTitle>
          <CardDescription>
            Aynı kaynaktan beslenirler ama farklı karar seviyelerine hitap ederler.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card/60 p-5">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <Users className="h-5 w-5 text-primary" />
              ISG-Bot: bireysel uzman akışı
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Kendi firma listenizi, eksik sözleşmeleri, kurul ihtiyacını ve denetime hazırlık
              başlıklarını hızlıca görmeniz için tasarlandı. Günlük iş listesi ve yönlendirme merkezi
              olarak çalışır.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-5">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <Building2 className="h-5 w-5 text-primary" />
              OSGB Modülü: ekipli portföy yönetimi
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Birden fazla uzman, firma havuzu, operasyon paneli ve organizasyon akışını yönetmek için
              kullanılır. Ekipler arası iş paylaşımı ve kurumsal görünürlük burada güçlenir.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
