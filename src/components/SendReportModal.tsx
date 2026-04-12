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
import { Mail, Loader2, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

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
  const [sending, setSending] = useState(false);

  const [formData, setFormData] = useState({
    recipientEmail: "",
    recipientName: "",
    customMessage: "",
  });

  const handleSend = async () => {
    if (!formData.recipientEmail) {
      toast.error("Lütfen alıcı e-posta adresini girin");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.recipientEmail)) {
      toast.error("Geçerli bir e-posta adresi girin");
      return;
    }

    setSending(true);

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
          sender_email: user?.email || "noreply@denetron.app",
          custom_message: formData.customMessage,
          org_id: organizationId,
          user_id: user?.id,
        },
      });

      if (error) throw error;

      toast.success("✅ Rapor başarıyla gönderildi", {
        description: `${formData.recipientEmail} adresine iletildi`,
      });

      setFormData({ recipientEmail: "", recipientName: "", customMessage: "" });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Email send error:", error);
      toast.error("❌ E-posta gönderilemedi", {
        description: error.message,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            Raporu E-posta ile Gönder
          </DialogTitle>
          <DialogDescription>
            <strong>{reportFilename}</strong> dosyasını firma yetkilisine gönderin
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

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
            <p className="text-blue-700 dark:text-blue-300">
              ℹ️ E-posta otomatik olarak profesyonel formatta gönderilecektir
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            İptal
          </Button>
          <Button onClick={handleSend} disabled={sending} className="gap-2">
            {sending ? (
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
