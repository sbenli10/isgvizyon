// src/components/adep/AIGenerateButton.tsx

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ADEPModule, ADEPAIResponse } from "@/types/adep-ai";

interface AIGenerateButtonProps {
  planId: string;
  module: ADEPModule;
  onSuccess?: () => void;
  disabled?: boolean;
}

const MODULE_LABELS: Record<ADEPModule, string> = {
  scenario: "Acil Durum Senaryoları",
  preventive: "Önleyici Tedbir Matrisi",
  equipment: "Ekipman Envanteri",
  drill: "Tatbikat Planı",
  checklist: "Kontrol Checklist'i",
  raci: "RACI Sorumluluk Matrisi",
  legal: "Mevzuat Referansları",
  risk: "Risk Kaynakları Haritası",
};

export default function AIGenerateButton({
  planId,
  module,
  onSuccess,
  disabled = false,
}: AIGenerateButtonProps) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);

    try {
      toast.info("AI analizi başlatılıyor...", {
        description: `${MODULE_LABELS[module]} oluşturuluyor`,
      });

      const { data, error } = await supabase.functions.invoke("generate-adep-analysis", {
        body: {
          planId,
          module,
        },
      });

      if (error) throw error;

      const response = data as ADEPAIResponse;

      if (response.success && response.insertedCount > 0) {
        toast.success("AI ile başarıyla oluşturuldu!", {
          description: `${response.insertedCount} kayıt eklendi`,
        });

        // Trigger parent refresh
        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error(response.error || "Kayıt eklenemedi");
      }
    } catch (error: any) {
      console.error("AI generation error:", error);
      toast.error("AI ile oluşturma başarısız", {
        description: error.message || "Bilinmeyen hata",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20 hover:from-purple-500/20 hover:to-blue-500/20"
          disabled={disabled || generating}
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Oluşturuluyor...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              AI ile Otomatik Oluştur
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI ile Otomatik Oluştur
          </AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{MODULE_LABELS[module]}</strong> için yapay zeka destekli içerik
            oluşturulacak.
            <br />
            <br />
            Bu işlem:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>İşyeri bilgilerinize göre özelleştirilmiş içerik üretir</li>
              <li>Türkiye İSG mevzuatına uygun standartlar kullanır</li>
              <li>Mevcut kayıtları silmez, yeni kayıtlar ekler</li>
              <li>15-30 saniye sürebilir</li>
            </ul>
            <br />
            Devam etmek istiyor musunuz?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={generating}>İptal</AlertDialogCancel>
          <AlertDialogAction onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Oluşturuluyor...
              </>
            ) : (
              "Oluştur"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}