//src\components\SendReportModal.tsx
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Loader2, Send, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { resolveStorageObjectUrl } from "@/lib/storageObject";

interface SendReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportType: "risk_assessment" | "dof" | "adep" | "inspection";
  reportUrl: string;
  reportFilename: string;
  companyName: string;
}

export function SendReportModal({
  open,
  onOpenChange,
  reportType,
  reportUrl,
  reportFilename,
  companyName,
}: SendReportModalProps) {
  const { user } = useAuth();
  const [emailSending, setEmailSending] = useState(false);
  const [whatsAppSending, setWhatsAppSending] = useState(false);

  const [formData, setFormData] = useState({
    recipientEmail: "",
    recipientPhone: "",
    recipientName: "",
    customMessage: "",
  });

  const normalizePhoneNumber = (value: string) =>
    value.replace(/[^\d]/g, "");

  const buildWhatsAppMessage = async () => {
    const resolvedReportUrl = await resolveStorageObjectUrl(reportUrl, {
      bucket: "reports",
      expiresIn: 60 * 60,
    });

    const recipientName = formData.recipientName?.trim() || "Yetkili";
    const intro = `${companyName} için hazırlanan ${reportFilename} raporunu paylaşıyorum.`;
    const custom = formData.customMessage?.trim()
      ? `\n\nNot: ${formData.customMessage.trim()}`
      : "";

    return `Merhaba ${recipientName},\n\n${intro}\n\nRapor bağlantısı: ${resolvedReportUrl}${custom}\n\nİSGVİZYON üzerinden gönderilmiştir.`;
  };

  const handleSendEmail = async () => {
    if (!formData.recipientEmail) {
      toast.error("Lütfen alıcı e-posta adresini girin");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.recipientEmail)) {
      toast.error("Geçerli bir e-posta adresi girin");
      return;
    }

    setEmailSending(true);

    try {
      let senderName = "İSGVizyon Kullanıcısı";
      let organizationId: string | null = null;

      if (user?.id) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, organization_id")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.warn("Profile fetch warning:", profileError.message);
        } else {
          senderName = profileData?.full_name || senderName;
          organizationId = profileData?.organization_id ?? null;
        }
      }

      const { error } = await supabase.functions.invoke("send-report-email", {
        body: {
          recipient_email: formData.recipientEmail,
          recipient_name: formData.recipientName || "Yetkili",
          company_name: companyName,
          report_type: reportType,
          report_url: reportUrl,
          report_filename: reportFilename,
          sender_name: senderName,
          sender_email: user?.email || "noreply@isgvizyon.com",
          custom_message: formData.customMessage,
          org_id: organizationId,
          user_id: user?.id,
        },
      });

      if (error) throw error;

      toast.success("✅ Rapor başarıyla gönderildi", {
        description: `${formData.recipientEmail} adresine iletildi`,
      });

      setFormData({ recipientEmail: "", recipientPhone: "", recipientName: "", customMessage: "" });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Email send error:", error);
      toast.error("❌ E-posta gönderilemedi", {
        description: error.message,
      });
    } finally {
      setEmailSending(false);
    }
  };

  const handleSendWhatsApp = async () => {
    const normalizedPhone = normalizePhoneNumber(formData.recipientPhone);
    if (!normalizedPhone) {
      toast.error("Lütfen WhatsApp alıcı numarasını girin");
      return;
    }

    if (normalizedPhone.length < 10) {
      toast.error("Geçerli bir telefon numarası girin");
      return;
    }

    setWhatsAppSending(true);
    try {
      const message = await buildWhatsAppMessage();
      const whatsappUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      toast.success("WhatsApp paylaşımı hazırlandı", {
        description: "Rapor bağlantısı WhatsApp penceresinde açıldı.",
      });
    } catch (error: any) {
      console.error("WhatsApp send error:", error);
      toast.error("WhatsApp gönderimi başlatılamadı", {
        description: error?.message || "Rapor bağlantısı hazırlanırken bir sorun oluştu.",
      });
    } finally {
      setWhatsAppSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            PDF Oluştur ve Gönder
          </DialogTitle>
          <DialogDescription>
            <strong>{reportFilename}</strong> dosyasını e-posta veya WhatsApp ile paylaşın
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="recipientEmail">Alıcı E-posta *</Label>
            <Input
              id="recipientEmail"
              type="email"
              placeholder="ornek@firma.com"
              value={formData.recipientEmail}
              onChange={(e) =>
                setFormData({ ...formData, recipientEmail: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipientPhone">WhatsApp Numarası</Label>
            <Input
              id="recipientPhone"
              type="tel"
              placeholder="905XXXXXXXXX"
              value={formData.recipientPhone}
              onChange={(e) =>
                setFormData({ ...formData, recipientPhone: e.target.value })
              }
            />
            <p className="text-xs text-slate-500">
              Numaranın ülke kodu ile birlikte yazılması önerilir. Örnek: 90532XXXXXXX
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipientName">Alıcı Adı (Opsiyonel)</Label>
            <Input
              id="recipientName"
              placeholder="Örn: Ahmet Yılmaz"
              value={formData.recipientName}
              onChange={(e) =>
                setFormData({ ...formData, recipientName: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customMessage">Özel Mesaj (Opsiyonel)</Label>
            <Textarea
              id="customMessage"
              placeholder="Rapor hakkında ek açıklama..."
              rows={3}
              value={formData.customMessage}
              onChange={(e) =>
                setFormData({ ...formData, customMessage: e.target.value })
              }
            />
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-800 dark:bg-blue-950">
            <p className="text-blue-700 dark:text-blue-300">
              ℹ️ E-posta profesyonel formatta gönderilir. WhatsApp paylaşımında rapor bağlantısı otomatik olarak mesaja eklenir.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={emailSending || whatsAppSending}
          >
            İptal
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSendWhatsApp}
            disabled={emailSending || whatsAppSending}
            className="gap-2 border-green-500/30 text-green-700 hover:bg-green-50 hover:text-green-800 dark:text-green-300 dark:hover:bg-green-950/40"
          >
            {whatsAppSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Hazırlanıyor...
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4" />
                WhatsApp ile Gönder
              </>
            )}
          </Button>
          <Button onClick={handleSendEmail} disabled={emailSending || whatsAppSending} className="gap-2">
            {emailSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Gönder
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
