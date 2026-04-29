//src\pages\Reports.tsx
import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Brain, FileText, CheckCircle, Clock, AlertTriangle, 
  Download, Loader2, ShieldCheck, PlusCircle, Trash2,
  Eye, Filter, Search, TrendingUp, BarChart3, Lightbulb,
  Upload, Image as ImageIcon, Sparkles, Copy, Share2, History, X, FileUp, Calculator, Gavel, Hammer, ArrowRight, Badge, Map, CircleHelp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { usePersistentDraft } from "@/hooks/usePersistentDraft";

// ✅ PDF.js worker setup

interface FineKinneyAiResult {
  hazardDescription: string;
  probability: number;
  frequency: number;
  severity: number;
  riskScore: number;
  riskLevel: "Kabul Edilebilir" | "Düşük" | "Önemli" | "Yüksek" | "Kritik";
  legalReference: string;
  immediateAction: string;
  preventiveAction: string;
  justification: string;
  photoNumber?: number;
  analysisError?: string;
}

interface AnalysisHistory {
  id: string;
  user_id: string;
  hazard_description: string;
  ai_result: FineKinneyAiResult;
  risk_score: string;
  created_at: string;
  updated_at: string;
}

const MAX_PHOTOS = 3;
const MAX_DOCUMENTS = 3;
const MAX_PDF_OCR_PAGES = 5;

let pdfJsLoader: Promise<typeof import("pdfjs-dist")> | null = null;
let hazardPdfExportLoader: Promise<typeof import("@/lib/reportsPdfExport")> | null = null;
let hazardWordExportLoader: Promise<typeof import("@/lib/reportsWordExport")> | null = null;

const loadPdfJs = async () => {
  if (!pdfJsLoader) {
    pdfJsLoader = import("pdfjs-dist").then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
      return pdfjsLib;
    });
  }

  return pdfJsLoader;
};

const loadHazardPdfExport = async () => {
  if (!hazardPdfExportLoader) {
    hazardPdfExportLoader = import("@/lib/reportsPdfExport");
  }

  return hazardPdfExportLoader;
};

const loadHazardWordExport = async () => {
  if (!hazardWordExportLoader) {
    hazardWordExportLoader = import("@/lib/reportsWordExport");
  }

  return hazardWordExportLoader;
};

function calculateRiskScore(probability: number, frequency: number, severity: number) {
  return Number(probability || 0) * Number(frequency || 0) * Number(severity || 0);
}

function getRiskLevelFromScore(score: number): FineKinneyAiResult["riskLevel"] {
  if (score >= 400) return "Kritik";
  if (score >= 200) return "Yüksek";
  if (score >= 70) return "Önemli";
  if (score >= 20) return "Düşük";
  return "Kabul Edilebilir";
}

function normalizeAiResult<T extends FineKinneyAiResult>(result: T): T {
  const normalizedScore = calculateRiskScore(result.probability, result.frequency, result.severity);
  return {
    ...result,
    riskScore: normalizedScore,
    riskLevel: getRiskLevelFromScore(normalizedScore),
  };
}

const riskColors: Record<string, string> = {
  "Kabul Edilebilir": "bg-success/15 text-success border-success/30",
  "Düşük": "bg-success/20 text-success border-success/40",
  "Önemli": "bg-warning/15 text-warning border-warning/30",
  "Yüksek": "bg-orange-500/15 text-orange-500 border-orange-500/30",
  "Kritik": "bg-destructive/15 text-destructive border-destructive/30",
  "Low": "bg-success/15 text-success border-success/30",
  "Medium": "bg-warning/15 text-warning border-warning/30",
  "High": "bg-destructive/15 text-destructive border-destructive/30",
};

const tips = [
  `Maksimum ${MAX_PHOTOS} fotoğraf ve ${MAX_DOCUMENTS} destekleyici belge yükleyebilirsiniz.`,
  "Fotoğraf veya saha gözlemi açıklaması ana analiz girdisidir.",
  "PDF/DOCX belgeleri yalnızca mevzuat bağlamı ve dayanak üretmek için kullanılır.",
  "Bağlamı netleştirin: 'Ne oldu?', 'Nerede?', 'Kimler etkilendi?'",
];

// --- HEATMAP COMPONENT ---
const RiskHeatmap = ({ history }: { history: AnalysisHistory[] }) => {
  const matrix = Array(5).fill(0).map(() => Array(5).fill(0));
  
  history.forEach(h => {
    const ai = h.ai_result;
    if (ai && ai.probability && ai.severity) {
      const pIdx = ai.probability <= 0.5 ? 0 : ai.probability <= 1 ? 1 : ai.probability <= 3 ? 2 : ai.probability <= 6 ? 3 : 4;
      const sIdx = ai.severity <= 3 ? 0 : ai.severity <= 7 ? 1 : ai.severity <= 15 ? 2 : ai.severity <= 40 ? 3 : 4;
      matrix[4 - pIdx][sIdx]++;
    }
  });

  return (
    <div className="glass-card p-6 border-border/50 overflow-hidden relative">
      <div className="flex items-center gap-2 mb-4">
        <Map className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Risk Isı Haritası</h3>
      </div>
      <div className="flex">
        <div className="flex flex-col justify-center pr-4 text-xs text-muted-foreground font-medium" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          İhtimal (Probability)
        </div>
        
        <div className="flex-1">
          <div className="grid grid-rows-5 gap-1">
            {matrix.map((row, i) => (
              <div key={i} className="grid grid-cols-5 gap-1">
                {row.map((count, j) => (
                  <div 
                    key={j} 
                    className={`aspect-square rounded-md flex items-center justify-center text-xs transition-all duration-300 hover:scale-105 cursor-help
                      ${count > 0 ? 'bg-destructive shadow-[0_0_15px_rgba(239,68,68,0.4)] text-white font-bold' : 'bg-secondary/30 text-muted-foreground/30'}
                    `}
                    title={`İhtimal Seviyesi ${5-i}, Şiddet Seviyesi ${j+1} - Toplam: ${count} Analiz`}
                  >
                    {count > 0 ? count : ''}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="text-center pt-3 text-xs text-muted-foreground font-medium">
            Şiddet (Severity)
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Reports() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const imagePickerRef = useRef<HTMLInputElement | null>(null);
  const cameraCaptureRef = useRef<HTMLInputElement | null>(null);
  const documentPickerRef = useRef<HTMLInputElement | null>(null);
  const activeCompanyId = searchParams.get("companyId") || "";
  const [hazardInput, setHazardInput] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  
  // ✅ ÇOKLU FOTOĞRAF DESTEĞİ
  const [aiResults, setAiResults] = useState<(FineKinneyAiResult & { photoNumber: number })[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [history, setHistory] = useState<AnalysisHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [filterRisk, setFilterRisk] = useState(searchParams.get("risk") || "all");
  const [searchText, setSearchText] = useState(searchParams.get("search") || "");
  const [selectedHistory, setSelectedHistory] = useState<AnalysisHistory | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [restoredDraftLabel, setRestoredDraftLabel] = useState<string | null>(null);

  const draftScopeKey = useMemo(
    () => `reports:${user?.id || "guest"}:${activeCompanyId || "no-company"}`,
    [activeCompanyId, user?.id],
  );

  const { clearDraft } = usePersistentDraft({
    key: draftScopeKey,
    enabled: Boolean(user?.id),
    version: 1,
    value: { hazardInput },
    onRestore: (draft) => {
      if (draft.hazardInput) {
        setHazardInput(draft.hazardInput);
        setRestoredDraftLabel("Saha gözlemi taslağı");
        toast.info("Kaydedilmemiş taslak geri yüklendi.");
      }
    },
  });

    
  useEffect(() => {
    if (user) {
      fetchHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // user.id ile kontrol et

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (filterRisk !== "all") {
      next.set("risk", filterRisk);
    } else {
      next.delete("risk");
    }

    if (searchText.trim()) {
      next.set("search", searchText.trim());
    } else {
      next.delete("search");
    }

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [filterRisk, searchParams, searchText, setSearchParams]);

  const fetchHistory = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("hazard_analyses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHistory((data as unknown as AnalysisHistory[]) || []);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openPdfDocument = async (file: File) => {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const documentOptions = {
      data: new Uint8Array(arrayBuffer),
      disableWorker: true,
      isEvalSupported: false,
      useWorkerFetch: false,
    };

    return pdfjsLib.getDocument(documentOptions as any).promise;
  };

  const extractPdfTextDirect = async (file: File): Promise<string> => {
    const pdf = await openPdfDocument(file);
    let text = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(" ") + "\n";
    }

    return text.trim();
  };

  const renderPdfPagesForOcr = async (file: File): Promise<string[]> => {
    const pdf = await openPdfDocument(file);
    const pageCount = Math.min(pdf.numPages, MAX_PDF_OCR_PAGES);
    const renderedPages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("PDF sayfası OCR için hazırlanamadı.");
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
      }).promise;

      renderedPages.push(canvas.toDataURL("image/jpeg", 0.82));
    }

    return renderedPages;
  };

  const extractPdfText = async (file: File): Promise<string> => {
    try {
      const directText = await extractPdfTextDirect(file);
      if (directText) {
        return directText;
      }
      throw new Error("PDF içinde okunabilir metin bulunamadı");
    } catch (directError) {
      console.warn("PDF metin extraction başarısız, OCR deneniyor:", directError);
      toast.info(`📷 ${file.name} taranmış PDF olabilir, OCR ile okunuyor...`, {
        duration: 5000,
      });

      try {
        const images = await renderPdfPagesForOcr(file);
        const { data, error } = await supabase.functions.invoke("extract-pdf-ocr", {
          body: {
            fileName: file.name,
            images,
            languageHints: ["tr", "en"],
          },
        });

        if (error) {
          throw new Error(error.message);
        }

        const text = typeof data?.text === "string" ? data.text.trim() : "";
        if (!text) {
          throw new Error(data?.message || "OCR metin üretemedi");
        }

        toast.success(`📄 ${file.name} OCR ile okundu`);
        return text;
      } catch (ocrError) {
        console.error("PDF OCR hatası:", ocrError);
        const message =
          ocrError instanceof Error && ocrError.message.trim().length > 0
            ? ocrError.message
            : "PDF okunamadı";
        throw new Error(message);
      }
    }
  };

  const extractWordText = async (file: File): Promise<string> => {
    try {
      const mammoth = await import("mammoth");
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (error) {
      throw new Error("Word okunamadı");
    }
  };

  // Reports.tsx içine eklenecek yardımcı fonksiyon
  const compressImage = async (file: File): Promise<string> => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Fotoğraf okunamadı"));
      reader.readAsDataURL(file);
    });

    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const files = input.files;
    if (!files) return;

    const imageFiles: File[] = [];
    const newDocuments: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.type.startsWith("image/")) {
        imageFiles.push(file);
        continue;
      }

      if (file.type === "application/pdf" || file.name.endsWith(".docx")) {
        newDocuments.push(file);
        continue;
      }

      toast.error(`${file.name} desteklenmiyor`, {
        description: "Sadece JPG, PNG, PDF ve DOCX dosyaları yüklenebilir.",
      });
    }

    const remainingImageSlots = Math.max(0, MAX_PHOTOS - imageUrls.length);
    const acceptedImageFiles = imageFiles.slice(0, remainingImageSlots);
    const skippedImageCount = imageFiles.length - acceptedImageFiles.length;

    if (skippedImageCount > 0) {
      toast.error(`Maksimum ${MAX_PHOTOS} fotoğraf yüklenebilir!`, {
        description: "Lütfen mevcut fotoğrafları silin veya daha az fotoğraf seçin.",
      });
    }

    const remainingDocumentSlots = Math.max(0, MAX_DOCUMENTS - uploadedFiles.length);
    const acceptedDocuments = newDocuments.slice(0, remainingDocumentSlots);
    const skippedDocumentCount = newDocuments.length - acceptedDocuments.length;

    if (skippedDocumentCount > 0) {
      toast.error(`Maksimum ${MAX_DOCUMENTS} belge yüklenebilir!`, {
        description: "Lütfen mevcut belgeleri silin veya daha az belge seçin.",
      });
    }

    if (acceptedImageFiles.length > 0) {
      try {
        const processedImages = await Promise.all(
          acceptedImageFiles.map(async (file) => compressImage(file)),
        );

        setImageUrls((prev) => [...prev, ...processedImages].slice(0, MAX_PHOTOS));
        toast.success(`${processedImages.length} fotoğraf yüklendi`);
      } catch (error) {
        console.error("Fotoğraf işleme hatası:", error);
        toast.error("Fotoğraflar işlenirken bir hata oluştu.");
      }
    }

    if (acceptedDocuments.length > 0) {
      setUploadedFiles((prev) => [...prev, ...acceptedDocuments].slice(0, MAX_DOCUMENTS));
      toast.success(`${acceptedDocuments.length} belge yüklendi`);
    }

    if (input) {
      input.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const extractFilesContent = async (): Promise<{ content: string; successCount: number; failedCount: number }> => {
    let allContent = "";
    const MAX_CHARS_PER_FILE = 10000; // 10k karakter/dosya
    let successCount = 0;
    let failedCount = 0;

    for (const file of uploadedFiles) {
      try {
        setExtracting(true);
        toast.info(`📄 ${file.name} okunuyor...`);
        
        let content = file.type === "application/pdf" ?
          await extractPdfText(file) 
          : await extractWordText(file);
        
        // ✅ Karakter limiti kontrolü
        if (content.length > MAX_CHARS_PER_FILE) {
          content = content.substring(0, MAX_CHARS_PER_FILE) + "\n... (içerik kısaltıldı)";
          toast.warning(`⚠️ ${file.name} çok uzun, ilk ${MAX_CHARS_PER_FILE} karakter kullanıldı.`, {
            duration: 4000
          });
        }
        
        allContent += `\n--- ${file.name} İçeriği (MEVZUAT/KANIT) ---\n${content}\n`;
        successCount += 1;
      } catch (error: any) {
        failedCount += 1;
        toast.error(`❌ ${file.name} okunamadı: ${error.message}`);
      }
    }
    
    setExtracting(false);
    return { content: allContent, successCount, failedCount };
  };

  const analyzeHazard = async () => {
    // ✅ Validation: PDF/DOCX sadece baglamdir, analiz girdisi degil
    if (!hazardInput.trim() && imageUrls.length === 0 && uploadedFiles.length === 0) {
      toast.error("Lütfen bir saha gözlemi açıklaması veya fotoğraf ekleyin.");
      return;
    }

    if (!hazardInput.trim() && imageUrls.length === 0 && uploadedFiles.length > 0) {
      toast.error("Mevzuat/PDF dosyaları tek başına analiz edilmez.", {
        description: "Önce saha gözlemi yazın veya fotoğraf yükleyin. Belgeler yalnızca analize mevzuat bağlamı ekler.",
      });
      return;
    }

    setLoading(true);
    setAiResults([]);

    // ✅ Çoklu fotoğraf analizi için kullanıcıyı bilgilendir
    if (imageUrls.length >= 3) {
      toast.info("⏳ Çoklu fotoğraf analizi 1-2 dakika sürebilir, lütfen bekleyin...", {
        duration: 5000
      });
    }

    try {
      let analysisText = hazardInput;

      // ✅ Belge içeriğini ekle (varsa)
      if (uploadedFiles.length > 0) {
        toast.info("📄 Dökümanlar ve Mevzuat taranıyor...");
        const { content: fileContent, successCount, failedCount } = await extractFilesContent();

        if (successCount === 0) {
          throw new Error(
            failedCount > 0
              ? "Yüklenen belgeler okunamadı. PDF scan ise OCR ayarını, düz PDF ise dosya içeriğini kontrol edin."
              : "Yüklenen belgelerden okunabilir içerik alınamadı.",
          );
        }

        analysisText = `${analysisText}\n\n[SİSTEM KÜTÜPHANESİ DÖKÜMANLARI - BUNLARDAN ATIF YAP]:\n${fileContent}`;
      }

      // ✅ Backend'e analiz isteği gönder
      const { data, error } = await supabase.functions.invoke("analyze-hazard", {
        body: { 
          hazardDescription: analysisText.trim(),
          images: imageUrls,
        },
      });

      // ✅ Hata kontrolü
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      // ✅ Çoklu fotoğraf analizi durumu
      if (data.photoAnalyses && Array.isArray(data.photoAnalyses) && data.photoAnalyses.length > 0) {
        const normalizedAnalyses = data.photoAnalyses.map((analysis: FineKinneyAiResult & { photoNumber: number }) =>
          normalizeAiResult(analysis),
        );
        setAiResults(normalizedAnalyses);
        
        // Her fotoğraf analizini veritabanına kaydet
        const insertPromises = normalizedAnalyses.map((analysis: FineKinneyAiResult & { photoNumber: number }) => 
          supabase.from("hazard_analyses").insert({
            user_id: user?.id,
            hazard_description: `📷 Fotoğraf ${analysis.photoNumber}: ${analysis.hazardDescription}`,
            ai_result: JSON.parse(JSON.stringify(analysis)), 
            risk_score: analysis.riskLevel || "Unknown",
          })
        );

        await Promise.all(insertPromises);
        
        await fetchHistory();
        
        const failedAnalyses = normalizedAnalyses.filter((analysis) => analysis.analysisError);
        if (failedAnalyses.length > 0) {
          toast.warning(`${failedAnalyses.length} fotoğraf tam analiz edilemedi; manuel kontrol notu ile rapora eklendi.`, {
            duration: 6000,
          });
        }

        clearDraft();
        setRestoredDraftLabel(null);
        toast.success(`✅ ${normalizedAnalyses.length} fotoğraf işlendi!`, {
          action: {
            label: "Formu Temizle",
            onClick: () => {
              setHazardInput("");
              setImageUrls([]);
              setUploadedFiles([]);
            }
          }
        });
      } 
      // ✅ Tek sonuç durumu (geriye dönük uyumluluk)
      else {
        const resultData = normalizeAiResult(data as FineKinneyAiResult);
        setAiResults([{ ...resultData, photoNumber: 1 }]);
        
        await supabase.from("hazard_analyses").insert({
          user_id: user?.id,
          hazard_description: resultData.hazardDescription || hazardInput.trim(),
          ai_result: JSON.parse(JSON.stringify(resultData)), 
          risk_score: resultData.riskLevel || "Unknown",
        });
        
        await fetchHistory();
        
        clearDraft();
        setRestoredDraftLabel(null);
        toast.success("✅ Analiz tamamlandı!", {
          action: {
            label: "Formu Temizle",
            onClick: () => {
              setHazardInput("");
              setImageUrls([]);
              setUploadedFiles([]);
            }
          }
        });
      }

    } catch (e: any) {
      console.error("🔴 Analiz Hatası:", e);
      
      // ✅ Farklı hata türleri için özel mesajlar
      if (e.message?.includes("timeout") || e.message?.includes("504") || e.message?.includes("Gateway")) {
        toast.error("⏰ Analiz çok uzun sürdü. Lütfen daha az fotoğraf yükleyin veya tekrar deneyin.", {
          duration: 6000
        });
      } else if (e.message?.includes("network") || e.message?.includes("fetch")) {
        toast.error("🌐 İnternet bağlantısı hatası. Lütfen bağlantınızı kontrol edin.", {
          duration: 6000
        });
      } else if (e.message?.includes("Maksimum") || e.message?.includes("limit")) {
        toast.error(e.message); // Backend'den gelen limit hatası
      } else {
        toast.error(`❌ Analiz hatası: ${e.message || "Bilinmeyen bir hata oluştu"}`, {
          description: "Lütfen tekrar deneyin veya destek ekibiyle iletişime geçin."
        });
      }
    } finally {
      setLoading(false);
      setExtracting(false);
    }
  };

  const sendToCapa = (analysis: FineKinneyAiResult, description: string) => {
    navigate(`/capa${activeCompanyId ? `?companyId=${encodeURIComponent(activeCompanyId)}` : ""}`, {
      state: {
        aiData: {
          description: analysis.hazardDescription || description,
          plan: `[Anlık] ${analysis.immediateAction}

[Kalıcı] ${analysis.preventiveAction}`,
          justification: `${analysis.justification}
Yasal Atıf: ${analysis.legalReference}`,
          risk: analysis.riskLevel,
        },
      },
    });
    toast.info("Veriler DÖF formuna aktarılıyor...");
  };

  const generateRichPDF = async (
    analysis: FineKinneyAiResult,
    originalDescription: string,
    imageUrl?: string,
  ) => {
    const { generateHazardAnalysisPdf } = await loadHazardPdfExport();
    await generateHazardAnalysisPdf({
      analyses: [
        {
          ...analysis,
          hazardDescription: analysis.hazardDescription || originalDescription,
          imageUrl,
          sourceLabel: analysis.photoNumber ? `Fotoğraf ${analysis.photoNumber} Analizi` : "Analiz Raporu",
        },
      ],
      title: "Profesyonel Fine-Kinney Risk Analizi",
      subtitle: "Görsel, bulgu, mevzuat dayanağı ve aksiyon planı birlikte sunulur",
      fileName: `isg-analiz-raporu-${Date.now()}.pdf`,
    });
    toast.success("Rapor PDF olarak indirildi!");
  };

  const generateCombinedPDF = async () => {
    if (!aiResults.length) return;

    const { generateHazardAnalysisPdf } = await loadHazardPdfExport();
    await generateHazardAnalysisPdf({
      analyses: aiResults.map((result, idx) => ({
        ...result,
        imageUrl: imageUrls[(result.photoNumber || idx + 1) - 1],
        sourceLabel: `Fotoğraf ${result.photoNumber || idx + 1} Analizi`,
      })),
      title: "Toplu Fotoğraf Risk Analiz Raporu",
      subtitle: `${aiResults.length} fotoğraf için tek dosyada kurumsal saha raporu`,
      fileName: `isg-toplu-analiz-raporu-${Date.now()}.pdf`,
    });
    toast.success("Toplu PDF raporu indirildi!");
  };

  const generateRichWord = async (
    analysis: FineKinneyAiResult,
    originalDescription: string,
    imageUrl?: string,
  ) => {
    const { generateHazardAnalysisWord } = await loadHazardWordExport();
    await generateHazardAnalysisWord({
      analyses: [
        {
          ...analysis,
          hazardDescription: analysis.hazardDescription || originalDescription,
          imageUrl,
          sourceLabel: analysis.photoNumber ? `Fotoğraf ${analysis.photoNumber} Analizi` : "Analiz Raporu",
        },
      ],
      title: "Profesyonel Fine-Kinney Risk Analiz Raporu",
      subtitle: "Analiz edilen görsel, risk puanı, aksiyon planı ve mevzuat dayanağı düzenli bir Word raporunda sunulur.",
      fileName: `isg-analiz-raporu-${Date.now()}.docx`,
      supportingDocuments: uploadedFiles.map((file) => file.name),
    });
    toast.success("Rapor Word olarak indirildi!");
  };

  const generateCombinedWord = async () => {
    if (!aiResults.length) return;

    const { generateHazardAnalysisWord } = await loadHazardWordExport();
    await generateHazardAnalysisWord({
      analyses: aiResults.map((result, idx) => ({
        ...result,
        imageUrl: imageUrls[(result.photoNumber || idx + 1) - 1],
        sourceLabel: `Fotoğraf ${result.photoNumber || idx + 1} Analizi`,
      })),
      title: "Toplu Fotoğraf Risk Analiz Raporu",
      subtitle: `${aiResults.length} fotoğraf için bulgular, risk seviyeleri ve aksiyon planları tek Word dosyasında birleştirilir.`,
      fileName: `isg-toplu-analiz-raporu-${Date.now()}.docx`,
      supportingDocuments: uploadedFiles.map((file) => file.name),
    });
    toast.success("Toplu Word raporu indirildi!");
  };

  const deleteAnalysis = async (id: string) => {
    if (!confirm("Bu analizi silmek istediğinize emin misiniz?")) return;
    try {
      const { error } = await supabase.from("hazard_analyses").delete().eq("id", id);
      if (error) throw error;
      setHistory(history.filter((h) => h.id !== id));
      setDetailsOpen(false);
      setSelectedHistory(null);
      toast.success("Analiz silindi");
    } catch (error) {
      toast.error("Analiz silinemedi");
    }
  };

  const filteredHistory = history.filter((item) => {
    const matchesRisk = filterRisk === "all" || item.risk_score === filterRisk;
    const matchesSearch = item.hazard_description.toLowerCase().includes(searchText.toLowerCase());
    return matchesRisk && matchesSearch;
  });

  const stats = {
    total: history.length,
    critical: history.filter((h) => ["Kritik", "Yüksek", "High"].includes(h.risk_score)).length,
    medium: history.filter((h) => ["Önemli", "Medium"].includes(h.risk_score)).length,
    low: history.filter((h) => ["Düşük", "Kabul Edilebilir", "Low"].includes(h.risk_score)).length,
  };

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            Saha Risk Analizi
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Fotoğraf, saha notu ve destekleyici mevzuat belgeleri ile Fine-Kinney risk analizi oluşturun.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => navigate("/reports/guide")}
        >
          <CircleHelp className="h-4 w-4" /> Nasıl Kullanılır?
        </Button>
      </div>

      {activeCompanyId ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Firma bağlamı aktif</p>
              <p className="text-sm text-muted-foreground">
                Bu ekran Firma 360 içinden açıldı. Buradan CAPA akışına geçerken aynı firma bağlamı korunur.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete("companyId");
                setSearchParams(next);
              }}
            >
              Bağlamı kaldır
            </Button>
          </div>
        </div>
      ) : null}

      {/* DASHBOARD TOP (Stats + Heatmap) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-2 gap-4">
          <div className="glass-card p-5 border border-border/50 flex flex-col justify-center">
            <p className="text-sm text-muted-foreground">Toplam Analiz</p>
            <p className="text-4xl font-black text-foreground">{stats.total}</p>
          </div>
          <div className="glass-card p-5 border border-destructive/30 bg-destructive/5 flex flex-col justify-center">
            <p className="text-sm text-destructive font-semibold">🔴 Kritik / Yüksek</p>
            <p className="text-4xl font-black text-destructive">{stats.critical}</p>
          </div>
          <div className="glass-card p-5 border border-warning/30 bg-warning/5 flex flex-col justify-center">
            <p className="text-sm text-warning font-semibold">🟡 Önemli</p>
            <p className="text-4xl font-black text-warning">{stats.medium}</p>
          </div>
          <div className="glass-card p-5 border border-success/30 bg-success/5 flex flex-col justify-center">
            <p className="text-sm text-success font-semibold">🟢 Düşük / Kabul Edilebilir</p>
            <p className="text-4xl font-black text-success">{stats.low}</p>
          </div>
        </div>
        
        <div className="lg:col-span-1">
          <RiskHeatmap history={history} />
        </div>
      </div>

      {/* AI ANALYZER SECTION */}
      <div className="glass-card p-6 border border-primary/20 space-y-4 shadow-sm shadow-primary/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none"></div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-700 mb-2">Bu ekran nasıl kullanılır?</p>
              <div className="space-y-1">
                {tips.map((tip, idx) => (
                  <p key={idx} className="text-xs text-blue-600">• {tip}</p>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {restoredDraftLabel ? (
            <div className="flex flex-col gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-cyan-50 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">{restoredDraftLabel} geri yüklendi</p>
                <p className="mt-1 text-sm text-cyan-100/80">Kaydedilmemiş saha notu tekrar forma taşındı.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  clearDraft();
                  setRestoredDraftLabel(null);
                  setHazardInput("");
                }}
                className="border-cyan-300/30 bg-transparent text-cyan-50 hover:bg-cyan-400/10"
              >
                Taslağı temizle
              </Button>
            </div>
          ) : null}
          <div>
            <Label className="text-sm font-semibold mb-2 flex items-center gap-2">
              📝 Saha Gözlemi / Uygunsuzluk Açıklaması
            </Label>
            <Textarea
              placeholder="Sahada gördüğünüz uygunsuzluğu detaylandırın. (Örn: Elektrik panosu açık, kablolar düzensiz ve yetkisiz erişim mümkün.)"
              value={hazardInput}
              onChange={(e) => setHazardInput(e.target.value)}
              className="min-h-[100px] bg-secondary/50 border-border/50 focus:border-primary/50 transition-colors text-base"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div 
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 transition-all
                ${imageUrls.length >= MAX_PHOTOS ?
                  'border-border/30 bg-secondary/10 opacity-50 cursor-not-allowed' 
                  : 'border-primary/30 bg-primary/5'
                }
              `}
            >
              <Upload className={`h-8 w-8 mb-3 ${imageUrls.length >= MAX_PHOTOS ? "text-muted-foreground" : "text-primary"}`} />
              <span className="text-sm font-semibold text-foreground">
                {imageUrls.length >= MAX_PHOTOS ? "Fotoğraf Limiti Doldu" : `Saha Fotoğrafı Ekle (Max ${MAX_PHOTOS})`}
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                {imageUrls.length}/{MAX_PHOTOS} fotoğraf
              </span>
              <span className="text-[11px] text-muted-foreground mt-1 text-center">
                Galeriden secin veya sahada dogrudan kamera ile cekip ekleyin.
              </span>
              <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={imageUrls.length >= MAX_PHOTOS}
                  onClick={() => imagePickerRef.current?.click()}
                >
                  Galeriden Seç
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={imageUrls.length >= MAX_PHOTOS}
                  onClick={() => cameraCaptureRef.current?.click()}
                >
                  Kamerayla Çek
                </Button>
              </div>
              <input 
                ref={imagePickerRef}
                type="file" 
                multiple 
                accept="image/*" 
                onChange={handleFileUpload} 
                className="hidden"
                disabled={imageUrls.length >= MAX_PHOTOS}
              />
              <input
                ref={cameraCaptureRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
                disabled={imageUrls.length >= MAX_PHOTOS}
              />
            </div>

            {/* BELGE UPLOAD (LİMİT KONTROLÜ İLE) */}
            <div 
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 transition-all
                ${uploadedFiles.length >= MAX_DOCUMENTS ?
                  "border-border/30 bg-secondary/10 opacity-50 cursor-not-allowed"
                  : "border-border/50 bg-secondary/20"
                }
              `}
            >
              <FileUp className={`h-8 w-8 mb-3 ${uploadedFiles.length >= MAX_DOCUMENTS ? "text-muted-foreground/50" : "text-muted-foreground"}`} />
              <span className="text-sm font-semibold text-foreground">
                {uploadedFiles.length >= MAX_DOCUMENTS ? "Belge Limiti Doldu" : `İSG Mevzuatı / PDF Yükle (Max ${MAX_DOCUMENTS})`}
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                {uploadedFiles.length}/{MAX_DOCUMENTS} belge
              </span>
              <span className="text-[11px] text-muted-foreground mt-1 text-center">
                Destekleyici mevzuat bağlamı icin kullanilir, tek basina risk analizi baslatmaz.
              </span>
              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full"
                disabled={uploadedFiles.length >= MAX_DOCUMENTS}
                onClick={() => documentPickerRef.current?.click()}
              >
                Belge Seç
              </Button>
              <input 
                ref={documentPickerRef}
                type="file" 
                multiple 
                accept=".pdf,.docx" 
                onChange={handleFileUpload} 
                className="hidden"
                disabled={uploadedFiles.length >= MAX_DOCUMENTS}
              />
            </div>
          </div>

          {imageUrls.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Seçilen Fotoğraflar ({imageUrls.length}/{MAX_PHOTOS})
                </Label>
                {imageUrls.length >= MAX_PHOTOS && (
                  <span className="text-xs font-bold text-destructive">⚠️ Limit doldu</span>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {imageUrls.map((url, idx) => (
                  <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-primary/20 shadow-sm group">
                    <img src={url} alt={`Fotoğraf ${idx + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-black/70 p-1 rounded-full text-white hover:bg-destructive transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Referans Dökümanlar ({uploadedFiles.length}/{MAX_DOCUMENTS})
                </Label>
                {uploadedFiles.length >= MAX_DOCUMENTS && (
                  <span className="text-xs font-bold text-destructive">⚠️ Limit doldu</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-secondary/50 px-3 py-2 rounded-md border border-border/50">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium truncate max-w-[150px]">{file.name}</span>
                    <button onClick={() => setUploadedFiles(uploadedFiles.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive ml-2">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
       </div>

        <Button
          onClick={analyzeHazard}
          disabled={loading || extracting || (!hazardInput.trim() && uploadedFiles.length === 0 && imageUrls.length === 0)}
          className="w-full gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 border-0 text-white h-14 text-lg font-bold shadow-xl shadow-blue-500/20 mt-4 rounded-xl"
        >
          {loading || extracting ? (
            <><Loader2 className="h-6 w-6 animate-spin" /> {extracting ? "Mevzuat Taranıyor..." : "Derin Analiz Yapılıyor..."}</>
          ) : (
            <><Brain className="h-6 w-6" /> Saha Riskini Analiz Et</>
          )}
        </Button>

        {/* ✅ ÇOKLU FOTOĞRAF ANALİZ SONUÇLARI */}
        {aiResults.length > 0 && (
          <div className="space-y-8 pt-8 border-t border-border mt-8">
            <div className="flex items-center gap-3 mb-6">
              <ImageIcon className="h-7 w-7 text-primary" />
              <h3 className="text-2xl font-bold text-foreground">
                {aiResults.length} Fotoğraf Analiz Edildi
              </h3>
            </div>

            {aiResults.map((result, idx) => (
              <div key={idx} className="glass-card p-6 border-2 border-primary/30 space-y-6 animate-fade-in rounded-2xl shadow-lg">
                <div className="flex items-center gap-4 pb-4 border-b-2 border-border">
                  <div className="bg-gradient-to-br from-primary/20 to-primary/10 p-3 rounded-xl">
                    <ImageIcon className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-foreground flex items-center gap-2">
                      📷 Fotoğraf {result.photoNumber}
                      <Badge className={`text-sm px-3 py-1 ml-2 ${riskColors[result.riskLevel]}`}>
                        {result.riskLevel}
                      </Badge>
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ayrıntılı Fine-Kinney Risk Analizi
                    </p>
                  </div>
                </div>

                {imageUrls[(result.photoNumber || idx + 1) - 1] && (
                  <div className="w-40 h-32 rounded-xl overflow-hidden border-2 border-primary/30 shadow-md">
                    <img 
                      src={imageUrls[(result.photoNumber || idx + 1) - 1]} 
                      alt={`Fotoğraf ${result.photoNumber}`} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="glass-card p-4 text-center border-border/50 bg-secondary/10">
                    <p className="text-xs text-muted-foreground mb-1">İhtimal</p>
                    <p className="text-2xl font-bold text-foreground">{result.probability}</p>
                  </div>
                  <div className="glass-card p-4 text-center border-border/50 bg-secondary/10">
                    <p className="text-xs text-muted-foreground mb-1">Frekans</p>
                    <p className="text-2xl font-bold text-foreground">{result.frequency}</p>
                  </div>
                  <div className="glass-card p-4 text-center border-border/50 bg-secondary/10">
                    <p className="text-xs text-muted-foreground mb-1">Şiddet</p>
                    <p className="text-2xl font-bold text-foreground">{result.severity}</p>
                  </div>
                  <div className="glass-card p-4 text-center col-span-2 border-primary/20 bg-primary/10">
                    <p className="text-xs text-primary mb-1 font-bold uppercase">TOPLAM RİSK</p>
                    <p className="text-4xl font-black text-foreground">{result.riskScore}</p>
                  </div>
                </div>

                <div className="glass-card p-6 border-border/50 bg-card">
                  <h5 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border/50 pb-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Tespit Edilen Tehlike
                  </h5>
                    <p className="text-base text-foreground leading-relaxed">{result.hazardDescription}</p>
                    {result.analysisError ? (
                      <p className="mt-3 text-sm font-medium text-warning">
                        Not: Bu görsel otomatik analiz sırasında hata aldı. Sonuç manuel kontrol uyarısıyla rapora eklendi.
                      </p>
                    ) : null}
                  </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div className="glass-card p-5 border-destructive/30 bg-destructive/5">
                    <h5 className="text-xs font-bold text-destructive mb-3 flex items-center gap-2 uppercase">
                      <Hammer className="h-4 w-4" /> Anlık Düzeltici Aksiyon
                    </h5>
                    <p className="text-sm text-foreground/90 leading-relaxed">{result.immediateAction}</p>
                  </div>

                  <div className="glass-card p-5 border-success/30 bg-success/5">
                    <h5 className="text-xs font-bold text-success mb-3 flex items-center gap-2 uppercase">
                      <ShieldCheck className="h-4 w-4" /> Kalıcı Önleyici Aksiyon
                    </h5>
                    <p className="text-sm text-foreground/90 leading-relaxed">{result.preventiveAction}</p>
                  </div>

                  <div className="md:col-span-2 glass-card p-5 border-blue-500/30 bg-blue-500/5">
                    <h5 className="text-xs font-bold text-blue-600 mb-3 flex items-center gap-2 uppercase">
                      <Gavel className="h-4 w-4" /> Yasal Mevzuat Atıfı
                    </h5>
                    <p className="text-base font-semibold text-blue-700 dark:text-blue-400 mb-3">
                      {result.legalReference}
                    </p>
                    <div className="pt-3 border-t border-blue-500/20">
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Gerekçe</p>
                      <p className="text-sm text-foreground/80 italic">{result.justification}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
                  <Button 
                    size="sm" 
                    onClick={() => sendToCapa(result, `Fotoğraf ${result.photoNumber}`)}
                    className="gap-2 flex-1 h-11 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-black"
                  >
                    <PlusCircle className="h-4 w-4" /> DÖF Formuna Ekle
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => generateRichPDF(
                      result,
                      `Fotoğraf ${result.photoNumber}: ${result.hazardDescription}`,
                      imageUrls[(result.photoNumber || idx + 1) - 1],
                    )}
                    className="gap-2 flex-1 h-11 border-2"
                  >
                    <Download className="h-4 w-4" /> PDF İndir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateRichWord(
                      result,
                      `Fotoğraf ${result.photoNumber}: ${result.hazardDescription}`,
                      imageUrls[(result.photoNumber || idx + 1) - 1],
                    )}
                    className="gap-2 flex-1 h-11 border-2"
                  >
                    <FileText className="h-4 w-4" /> Word İndir
                  </Button>
                </div>
              </div>
            ))}

            {aiResults.length > 1 && (
              <div className="glass-card p-6 border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl">
                <h4 className="font-bold text-xl mb-5 flex items-center gap-3">
                  <TrendingUp className="h-6 w-6 text-primary" />
                  Genel Değerlendirme Özeti
                </h4>
                <div className="grid grid-cols-1 gap-4 text-center md:grid-cols-3 md:gap-6">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground font-medium">Analiz Edilen Fotoğraf</p>
                    <p className="text-5xl font-black text-foreground">{aiResults.length}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground font-medium">En Yüksek Risk Skoru</p>
                    <p className="text-5xl font-black text-destructive">
                      {Math.max(...aiResults.map(r => r.riskScore))}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground font-medium">Ortalama Risk Skoru</p>
                    <p className="text-5xl font-black text-warning">
                      {Math.round(aiResults.reduce((sum, r) => sum + r.riskScore, 0) / aiResults.length)}
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <Button
                    onClick={generateCombinedPDF}
                    className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Download className="h-4 w-4" /> Toplu PDF İndir
                  </Button>
                  <Button
                    variant="outline"
                    onClick={generateCombinedWord}
                    className="gap-2"
                  >
                    <FileText className="h-4 w-4" /> Toplu Word İndir
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* HISTORY SECTION */}
      <div className="space-y-4 pt-8">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Önceki Analiz Kayıtları
          </h2>
        </div>

        {historyLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredHistory.map((item) => {
              const aiData = item.ai_result as FineKinneyAiResult;
              const isOldFormat = !aiData?.riskScore || typeof aiData.riskScore === 'string';

              return (
                <div key={item.id} className="glass-card border border-border/50 hover:border-primary/40 transition-all shadow-sm overflow-hidden">
                  <div className="p-5 flex items-start justify-between gap-4 cursor-pointer bg-card/50" onClick={() => { setSelectedHistory(item); setDetailsOpen(selectedHistory?.id !== item.id ? true : !detailsOpen); }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-3">
                        {isOldFormat ? (
                          <Badge className={riskColors[item.risk_score] || riskColors["Low"]}>{item.risk_score || "Bilinmiyor"}</Badge>
                        ) : (
                          <>
                            <Badge className={`px-2.5 py-0.5 text-xs font-bold ${riskColors[aiData.riskLevel]}`}>{aiData.riskLevel}</Badge>
                            <span className="text-xs font-black bg-secondary/80 px-2 py-1 rounded text-foreground">Skor: {aiData.riskScore}</span>
                          </>
                        )}
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {new Date(item.created_at).toLocaleDateString("tr-TR", {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <p className="text-base font-semibold text-foreground line-clamp-2 leading-snug">
                        {isOldFormat ? item.hazard_description : aiData.hazardDescription}
                      </p>
                    </div>

                    <Button size="icon" variant="ghost" className="text-muted-foreground shrink-0 hover:bg-destructive/10 hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteAnalysis(item.id); }}>
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>

                  {selectedHistory?.id === item.id && detailsOpen && (
                    <div className="p-5 border-t border-border bg-secondary/5 space-y-4 animate-fade-in text-sm">
                      {!isOldFormat && (
                        <>
                          <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                              <p className="font-bold text-destructive text-xs uppercase tracking-wider flex items-center gap-1"><Hammer className="h-3 w-3"/> Anlık Müdahale</p>
                              <p className="text-foreground/80 bg-background p-3 rounded border border-border/50">{aiData.immediateAction}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="font-bold text-success text-xs uppercase tracking-wider flex items-center gap-1"><ShieldCheck className="h-3 w-3"/> Kalıcı Çözüm</p>
                              <p className="text-foreground/80 bg-background p-3 rounded border border-border/50">{aiData.preventiveAction}</p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="font-bold text-blue-500 text-xs uppercase tracking-wider flex items-center gap-1"><Gavel className="h-3 w-3"/> İlgili Mevzuat</p>
                            <p className="text-blue-700 dark:text-blue-300 font-medium bg-blue-500/10 p-3 rounded border border-blue-500/20">{aiData.legalReference}</p>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2 pt-2">
                            <Button size="sm" variant="outline" className="gap-2" onClick={() => generateRichPDF(aiData, aiData.hazardDescription)}>
                              <Download className="h-4 w-4" /> PDF Rapor
                            </Button>
                            <Button size="sm" variant="outline" className="gap-2" onClick={() => generateRichWord(aiData, aiData.hazardDescription)}>
                              <FileText className="h-4 w-4" /> Word Rapor
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

