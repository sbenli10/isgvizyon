import { useState } from "react";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Trash2,
  Edit,
  Eye,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { withTemporaryBodyChild } from "@/lib/safeDom";

type RequestType = "export" | "view" | "correction" | "deletion" | "objection";

interface DataRequest {
  type: RequestType;
  label: string;
  description: string;
  icon: typeof Eye;
  color: string;
}

const dataRequests: DataRequest[] = [
  {
    type: "view",
    label: "Verilerimi Görüntüle",
    description:
      "Kişisel verilerinizin işlenip işlenmediğini öğrenin ve işlenmişse buna ilişkin bilgi talep edin. (KVKK Madde 11/1-a, 11/1-b)",
    icon: Eye,
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    type: "export",
    label: "Verilerimi İndir",
    description:
      "Kişisel verilerinizin bir kopyasını JSON formatında indirin. Veri taşınabilirliği ve yedekleme için kullanabilirsiniz.",
    icon: Download,
    color: "bg-emerald-500/10 text-emerald-500",
  },
  {
    type: "correction",
    label: "Verilerimi Düzelt",
    description:
      "Eksik veya yanlış işlenmiş kişisel verilerinizin düzeltilmesini talep edin. (KVKK Madde 11/1-d)",
    icon: Edit,
    color: "bg-amber-500/10 text-amber-500",
  },
  {
    type: "deletion",
    label: "Verilerimi Sil",
    description:
      "Kişisel verilerinizin silinmesini talep edin. Yasal saklama yükümlülüklerimiz kapsamındaki veriler saklanmaya devam edebilir. (KVKK Madde 11/1-e)",
    icon: Trash2,
    color: "bg-destructive/10 text-destructive",
  },
  {
    type: "objection",
    label: "İtiraz Bildir",
    description:
      "Verilerinizin işlenmesine itiraz edin. Özellikle otomatik sistemler tarafından analiz edilmesi sonucunda aleyhinize bir sonuç ortaya çıkmasına itiraz edebilirsiniz. (KVKK Madde 11/1-g)",
    icon: AlertTriangle,
    color: "bg-purple-500/10 text-purple-500",
  },
];

export default function DataPrivacy() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState<RequestType | null>(null);
  const [exportData, setExportData] = useState<Record<string, unknown> | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showDeletionDialog, setShowDeletionDialog] = useState(false);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [showObjectionDialog, setShowObjectionDialog] = useState(false);
  const [correctionNote, setCorrectionNote, clearCorrectionDraft] = useFormDraft(
    "dataPrivacy:correctionNote",
    "",
  );
  const [objectionNote, setObjectionNote, clearObjectionDraft] = useFormDraft(
    "dataPrivacy:objectionNote",
    "",
  );
  const [deletionConfirmed, setDeletionConfirmed] = useState(false);

  const fetchUserData = async () => {
    if (!user) return null;

    const data: Record<string, unknown> = {};

    // Profile data
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    data.profile = profileData;

    // Organization data
    const { data: orgData } = await supabase
      .from("organizations")
      .select("id, name, slug, created_at")
      .eq("id", (profileData as any)?.organization_id)
      .maybeSingle();
    data.organization = orgData;

    // Auth metadata (non-sensitive parts)
    data.auth = {
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      provider: user.app_metadata?.provider,
    };

    return data;
  };

  const handleView = async () => {
    setLoading("view");
    try {
      const data = await fetchUserData();
      if (data) {
        setExportData(data);
        setShowExportDialog(true);
      }
      toast.success("Verileriniz başarıyla getirildi");
    } catch (error) {
      toast.error("Veriler getirilirken hata oluştu");
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const handleExport = async () => {
    setLoading("export");
    try {
      const data = await fetchUserData();
      if (!data) {
        toast.error("Dışa aktarılacak veri bulunamadı");
        return;
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `denetron-verilerim-${new Date().toISOString().split("T")[0]}.json`;
      withTemporaryBodyChild(a, () => {
        a.click();
      });
      URL.revokeObjectURL(url);

      toast.success("Verileriniz başarıyla indirildi");
    } catch (error) {
      toast.error("Dışa aktarma sırasında hata oluştu");
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const handleCorrection = async () => {
    if (!correctionNote.trim()) {
      toast.error("Lütfen düzeltme talebinizi açıklayın");
      return;
    }
    setLoading("correction");
    try {
      // Store correction request
      const { error } = await supabase.from("data_privacy_requests").insert({
        user_id: user?.id,
        request_type: "correction",
        details: correctionNote,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Düzeltme talebiniz kaydedildi. En kısa sürede değerlendirilecektir.");
      setShowCorrectionDialog(false);
      setCorrectionNote("");
      clearCorrectionDraft();
    } catch (error: any) {
      // Table might not exist yet
      toast.error(error.message || "Talep kaydedilirken hata oluştu");
    } finally {
      setLoading(null);
    }
  };

  const handleDeletion = async () => {
    if (!deletionConfirmed) return;
    setLoading("deletion");
    try {
      const { error } = await supabase.from("data_privacy_requests").insert({
        user_id: user?.id,
        request_type: "deletion",
        details: "Kullanıcı veri silme talebi",
        status: "pending",
      });

      if (error) throw error;

      toast.success(
        "Silme talebiniz kaydedildi. Yasal inceleme sonrası 30 gün içinde verileriniz silinecektir."
      );
      setShowDeletionDialog(false);
      setDeletionConfirmed(false);
    } catch (error: any) {
      toast.error(error.message || "Talep kaydedilirken hata oluştu");
    } finally {
      setLoading(null);
    }
  };

  const handleObjection = async () => {
    if (!objectionNote.trim()) {
      toast.error("Lütfen itiraz nedeninizi açıklayın");
      return;
    }
    setLoading("objection");
    try {
      const { error } = await supabase.from("data_privacy_requests").insert({
        user_id: user?.id,
        request_type: "objection",
        details: objectionNote,
        status: "pending",
      });

      if (error) throw error;

      toast.success("İtiraz talebiniz kaydedildi. En kısa sürede değerlendirilecektir.");
      setShowObjectionDialog(false);
      setObjectionNote("");
      clearObjectionDraft();
    } catch (error: any) {
      toast.error(error.message || "Talep kaydedilirken hata oluştu");
    } finally {
      setLoading(null);
    }
  };

  const handleAction = (type: RequestType) => {
    switch (type) {
      case "view":
        return handleView();
      case "export":
        return handleExport();
      case "correction":
        setShowCorrectionDialog(true);
        break;
      case "deletion":
        setShowDeletionDialog(true);
        break;
      case "objection":
        setShowObjectionDialog(true);
        break;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Geri
          </Button>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Veri Haklarım</h1>
              <p className="text-sm text-muted-foreground">
                KVKK Madde 11 kapsamındaki haklarınızı buradan kullanabilirsiniz
              </p>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-6">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                6698 sayılı Kişisel Verilerin Korunması Kanunu
              </p>
              <p className="text-xs text-muted-foreground">
                Aşağıdaki haklarınızı kullanmak için ilgili butona tıklayın. Talepleriniz KVKK'ya
                uygun olarak değerlendirilecek ve en geç 30 gün içinde yanıtlanacaktır.
                Detaylı bilgi için{" "}
                <button
                  onClick={() => navigate("/privacy-policy")}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Gizlilik Politikası
                </button>{" "}
                sayfamızı inceleyebilirsiniz.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Action Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {dataRequests.map((req) => {
            const Icon = req.icon;
            const isLoading = loading === req.type;
            return (
              <Card
                key={req.type}
                className="border-border/60 bg-card/70 transition-all hover:border-primary/30"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${req.color}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base">{req.label}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{req.description}</p>
                  <Button
                    className="w-full"
                    variant={req.type === "deletion" ? "destructive" : "default"}
                    onClick={() => handleAction(req.type)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="mr-2 h-4 w-4" />
                    )}
                    {req.label}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Separator className="my-8" />

        {/* Contact */}
        <Card className="border-border/60">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Taleplerinizle ilgili sorularınız için{" "}
              <a href="mailto:kvkk@isgvizyon.com" className="text-primary hover:underline">
                kvkk@isgvizyon.com
              </a>{" "}
              adresine e-posta gönderebilirsiniz.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* View Data Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kişisel Verileriniz</DialogTitle>
            <DialogDescription>
              Platformumuzda kayıtlı olan kişisel verileriniz aşağıda listelenmiştir.
            </DialogDescription>
          </DialogHeader>
          {exportData && (
            <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
              {JSON.stringify(exportData, null, 2)}
            </pre>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowExportDialog(false);
                handleExport();
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              JSON Olarak İndir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Correction Dialog */}
      <Dialog open={showCorrectionDialog} onOpenChange={setShowCorrectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Veri Düzeltme Talebi</DialogTitle>
            <DialogDescription>
              Düzeltilmesini istediğiniz verileri ve doğru bilgileri aşağıya yazın.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="correction-note">Düzeltme Talebi</Label>
              <Textarea
                id="correction-note"
                placeholder="Örn: Adım 'Ahmet Yılmaz' olarak kayıtlı ancak doğru yazılım 'Ahmet Yılmaz' şeklindedir..."
                value={correctionNote}
                onChange={(e) => setCorrectionNote(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCorrectionDialog(false); clearCorrectionDraft(); }}
              İptal
            </Button>
            <Button onClick={handleCorrection} disabled={loading === "correction"}>
              {loading === "correction" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Talebi Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deletion Dialog */}
      <Dialog open={showDeletionDialog} onOpenChange={setShowDeletionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Veri Silme Talebi</DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                Bu işlem, kişisel verilerinizin silinmesi için bir talep oluşturur.
              </span>
              <span className="block font-medium text-destructive">
                Dikkat: İSG mevzuatı gereği bazı veriler yasal süre boyunca saklanmak zorundadır.
                Yasal yükümlülük kapsamındaki veriler silinmeyecektir.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={deletionConfirmed}
                onChange={(e) => setDeletionConfirmed(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-foreground">
                Verilerimin silinmesini talep ediyorum. Yasal saklama yükümlülükleri kapsamındaki
                verilerin saklanmaya devam edeceğini kabul ediyorum.
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeletionDialog(false)}>
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletion}
              disabled={!deletionConfirmed || loading === "deletion"}
            >
              {loading === "deletion" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Silme Talebi Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Objection Dialog */}
      <Dialog open={showObjectionDialog} onOpenChange={setShowObjectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>İtiraz Bildirimi</DialogTitle>
            <DialogDescription>
              Verilerinizin işlenmesine itiraz nedeninizi aşağıya yazın.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="objection-note">İtiraz Nedeni</Label>
              <Textarea
                id="objection-note"
                placeholder="İtiraz nedeninizi açıklayın..."
                value={objectionNote}
                onChange={(e) => setObjectionNote(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowObjectionDialog(false); clearObjectionDraft(); }}
              İptal
            </Button>
            <Button onClick={handleObjection} disabled={loading === "objection"}>
              {loading === "objection" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="mr-2 h-4 w-4" />
              )}
              İtiraz Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
