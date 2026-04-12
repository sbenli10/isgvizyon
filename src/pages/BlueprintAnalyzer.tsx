import { useState, useRef, useCallback,useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Upload, Building2, Shield, AlertTriangle, CheckCircle2, Loader2, 
  FileImage, Trash2, Download, MapPin, Ruler, Layers, Eye, 
  ZoomIn, ZoomOut, RotateCw, Share2, ChevronRight, ChevronLeft, ArrowRight,
  Target, TrendingUp, Clock, Users, AlertCircle, CircleHelp, Info, Sparkles,
  Plus, Edit2, Save, X, CheckSquare, Square
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addInterFontsToJsPDF } from "@/utils/fonts";
import { format } from "date-fns";

interface ProjectInfo {
  area_type: string;
  detected_floor: number;
  building_category: string;
  estimated_area_sqm: number | null;
  usage_type?: string;
  construction_year?: number;
  occupancy_count?: number;
}

interface Equipment {
  type: string;
  count: number;
  locations: string[];
  adequacy_status: "sufficient" | "insufficient" | "excessive";
  recommended_count?: number;
  notes?: string;
}

interface Violation {
  issue: string;
  regulation_reference: string;
  severity: "critical" | "warning" | "info";
  recommended_action: string;
  estimated_cost?: number;
  priority_level?: number;
}

interface AnalysisResult {
  project_info: ProjectInfo;
  equipment_inventory: Equipment[];
  safety_violations: Violation[];
  expert_suggestions: string[];
  compliance_score: number | null;
  risk_assessment?: {
    fire_risk: "low" | "medium" | "high";
    structural_risk: "low" | "medium" | "high";
    evacuation_capacity: number;
  };
  improvement_roadmap?: {
    immediate: string[];
    short_term: string[];
    long_term: string[];
  };
}

interface AnalysisHistory {
  id: string;
  created_at: string;
  compliance_score: number | null;
  building_type: string;
  violations_count: number;
}

const EQUIPMENT_ICONS: Record<string, string> = {
  extinguisher: "🧯",
  exit: "🚪",
  hydrant: "🚰",
  first_aid: "🩹",
  assembly_point: "🟢",
  alarm: "🔔",
  emergency_light: "💡",
  fire_hose: "🔥",
  smoke_detector: "💨"
};

const EQUIPMENT_NAMES: Record<string, string> = {
  extinguisher: "Yangın Söndürme Tüpü",
  exit: "Acil Çıkış",
  hydrant: "Yangın Dolabı/Hidrant",
  first_aid: "İlk Yardım Dolabı",
  assembly_point: "Toplanma Alanı",
  alarm: "Yangın Alarm Butonu",
  emergency_light: "Acil Aydınlatma",
  fire_hose: "Yangın Hortumu",
  smoke_detector: "Duman Dedektörü"
};

const LOADING_MESSAGES = [
  { text: "Yapay zeka mimari planı tarıyor...", progress: 20 },
  { text: "Güvenlik ekipmanları tespit ediliyor...", progress: 40 },
  { text: "Mevzuat kontrolleri yapılıyor...", progress: 60 },
  { text: "Uyumsuzluklar analiz ediliyor...", progress: 80 },
  { text: "Sonuçlar hazırlanıyor...", progress: 95 }
];

const EQUIPMENT_PAGE_SIZE = 4;
const VIOLATION_PAGE_SIZE = 3;
const HISTORY_PAGE_SIZE = 6;
const SUGGESTION_PAGE_SIZE = 5;

// ✅ Helper: Floor number parser
const parseFloorNumber = (floor: any): number => {
  if (typeof floor === 'number') return floor;
  
  if (typeof floor === 'string') {
    // Sayı çıkar: "1.KAT" → 1, "2. Kat" → 2
    const match = floor.match(/\d+/);
    if (match) return parseInt(match[0]);
    
    // Özel durumlar
    const lowerFloor = floor.toLowerCase();
    if (lowerFloor.includes('zemin') || lowerFloor.includes('ground')) return 0;
    if (lowerFloor.includes('bodrum') || lowerFloor.includes('basement')) return -1;
    if (lowerFloor.includes('çatı') || lowerFloor.includes('roof')) return 99;
  }
  
  return 1; // Default: 1. kat
};
  


const formatCompliance = (score: number | null | undefined): string =>
  typeof score === "number" ? `${score}%` : "N/A";

const complianceProgressValue = (score: number | null | undefined): number =>
  typeof score === "number" ? score : 0;

const formatAreaWithUnit = (area: number | null | undefined): string =>
  typeof area === "number" ? `${area} m\u00B2` : "N/A";
export default function BlueprintAnalyzer() {
  const { user } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
  
  // States
  const [blueprintImage, setBlueprintImage] = useState<string>("");
  const [blueprintPreview, setBlueprintPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistory[]>([]);
  const [activeTab, setActiveTab] = useState("upload");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [compareMode, setCompareMode] = useState(false);
  const [previousAnalysis, setPreviousAnalysis] = useState<AnalysisResult | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [manualNotes, setManualNotes] = useState("");
  const [projectName, setProjectName] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [equipmentPage, setEquipmentPage] = useState(1);
  const [violationPage, setViolationPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [suggestionPage, setSuggestionPage] = useState(1);

   // ✅ Component mount olduğunda history'yi yükle
  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]); // user değiştiğinde yeniden fetch

  useEffect(() => {
    setEquipmentPage(1);
    setViolationPage(1);
    setSuggestionPage(1);
  }, [analysisResult]);

  useEffect(() => {
    setHistoryPage(1);
  }, [analysisHistory]);
  
  // ✅ Fetch history - Type-Safe Çözüm
  const fetchHistory = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("blueprint_analyses")
      .select("id, created_at, analysis_result, building_type, floor_number")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) {
      setAnalysisHistory(
        data.map((d) => ({
          id: d.id,
          created_at: d.created_at,
          compliance_score: 
            typeof d.analysis_result === 'object' && d.analysis_result !== null && 'compliance_score' in d.analysis_result
              ? (typeof (d.analysis_result as any).compliance_score === "number" ? (d.analysis_result as any).compliance_score : null)
              : null,
          building_type: d.building_type || "Bilinmiyor",
          violations_count: 0
        }))
      );
    }
  };

  const compressImage = useCallback(async (base64: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = base64;
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            throw new Error('Canvas context alınamadı');
          }
          
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (error) {
          console.error('Compression error:', error);
          // ✅ Fallback: orijinal base64
          resolve(base64);
        }
      };
      
      img.onerror = (error) => {
        console.error('Image load error:', error);
        reject(new Error('Görsel yüklenemedi'));
      };
    });
  }, []);

  // ✅ Image upload handler (geliştirilmiş)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Lütfen geçerli bir görsel dosyası seçin");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Dosya boyutu 10MB'ı aşamaz");
      return;
    }

    toast.info("Görsel yükleniyor...");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const original = event.target?.result as string;
        setBlueprintPreview(original);

        const compressed = await compressImage(original);
        setBlueprintImage(compressed);

        toast.success("✅ Kroki yüklendi ve optimize edildi");
        setActiveTab("preview");
      } catch (error) {
        console.error("Image compression error:", error);
        toast.error("Görsel işlenirken hata oluştu");
      }
    };
    reader.readAsDataURL(file);
  };

  // Save fonksiyonu
  const saveAnalysis = async () => {
    if (!analysisResult || !user) {
      toast.error("Kaydedilecek analiz bulunamadı");
      return;
    }

    try {
      console.log("💾 Saving analysis to database...");
      console.log("📊 Analysis result:", analysisResult);

      // ✅ Floor number'ı parse et
      const floorNumber = parseFloorNumber(analysisResult.project_info.detected_floor);
      
      console.log(`🔢 Floor parsing: "${analysisResult.project_info.detected_floor}" → ${floorNumber}`);

      const { data, error } = await supabase
        .from("blueprint_analyses")
        .insert({
          user_id: user.id,
          analysis_result: analysisResult as any,
          building_type: analysisResult.project_info.area_type || "unknown",
          floor_number: floorNumber, // ✅ Parsed integer
          area_sqm: analysisResult.project_info.estimated_area_sqm || 0,
          image_size_kb: Math.round((blueprintImage?.length || 0) * 0.75 / 1024),
          project_name: projectName || null,
          user_notes: manualNotes || null
        })
        .select()
        .single();

      if (error) {
        console.error("❌ Database save error:", error);
        throw error;
      }

      console.log("✅ Analysis saved successfully:", data.id);
      
      toast.success("✅ Analiz başarıyla kaydedildi!", {
        description: projectName || `Analiz #${data.id.substring(0, 8)}`
      });

      await fetchHistory();

    } catch (error: any) {
      console.error("💥 Save operation failed:", error);
      
      toast.error("❌ Kaydetme hatası", {
        description: error.message || "Bilinmeyen hata",
        duration: 5000
      });
    }
  };

  // ✅ Drag & Drop support
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const fakeEvent = {
        target: { files: [file] }
      } as any;
      handleImageUpload(fakeEvent);
    }
  }, []);

  // ✅ AI Analysis (production-ready)
  const analyzeBlueprint = async () => {
    if (!blueprintImage) {
      toast.error("Lütfen bir kroki görseli yükleyin");
      return;
    }

    setLoading(true);
    setLoadingProgress(0);
    setAnalysisResult(null);

    console.log("🚀 Starting blueprint analysis...");
    console.log("📊 Image size:", Math.round(blueprintImage.length * 0.75 / 1024), "KB");
    console.log("📝 Project name:", projectName || "(none)");
    console.log("📝 User notes:", manualNotes || "(none)");

    // Loading animation
    let messageIndex = 0;
    const interval = setInterval(() => {
      if (messageIndex < LOADING_MESSAGES.length) {
        setCurrentLoadingMessage(LOADING_MESSAGES[messageIndex].text);
        setLoadingProgress(LOADING_MESSAGES[messageIndex].progress);
        messageIndex++;
      }
    }, 2000);

    try {
      // ✅ Call Edge Function
      console.log("📡 Calling analyze-blueprint Edge Function...");
      
      const { data, error } = await supabase.functions.invoke("analyze-blueprint", {
        body: { 
          image: blueprintImage,
          project_name: projectName || "Adsız Proje",
          user_notes: manualNotes
        },
      });

      clearInterval(interval);
      setLoadingProgress(100);

      console.log("✅ Edge Function response received");
      console.log("📦 Response data:", data);
      console.log("❌ Response error:", error);

      // ✅ Error handling
      if (error) {
        console.error("💥 Edge Function error:", error);
        throw new Error(error.message || "Edge function hatası");
      }

      if (data?.error) {
        console.error("💥 API error:", data.error);
        throw new Error(data.error);
      }

      if (!data?.analysis) {
        console.error("💥 No analysis data in response");
        throw new Error("Analiz verisi alınamadı");
      }

      console.log("✅ Analysis result received:", {
        type: data.analysis.project_info.area_type,
        floor: data.analysis.project_info.detected_floor,
        area: data.analysis.project_info.estimated_area_sqm,
        score: data.analysis.compliance_score
      });

      setAnalysisResult(data.analysis);

      // ✅ Save to database with parsing
      try {
        console.log("💾 Saving to database...");

        const floorNumber = parseFloorNumber(data.analysis.project_info.detected_floor);
        
        const insertData = {
          user_id: user?.id,
          analysis_result: data.analysis as any,
          building_type: data.analysis.project_info.area_type || "unknown",
          floor_number: floorNumber,
          area_sqm: data.analysis.project_info.estimated_area_sqm || 0,
          image_size_kb: data.metadata?.image_size_kb || 0,
          project_name: projectName || "Adsız Proje",
          user_notes: manualNotes || null
        };

        console.log("📊 Insert data:", insertData);

        const { data: savedData, error: saveError } = await supabase
          .from("blueprint_analyses")
          .insert(insertData)
          .select()
          .single();

        if (saveError) {
          console.error("❌ Database save error:", saveError);
          console.error("📄 Error details:", {
            code: saveError.code,
            message: saveError.message,
            details: saveError.details,
            hint: saveError.hint
          });
          throw saveError;
        }

        console.log("✅ Saved to database:", savedData?.id);

        await fetchHistory();

      } catch (saveError: any) {
        console.error("💥 Save operation failed:", saveError);
        
        // Non-critical error, show warning but don't block
        toast.warning("⚠️ Analiz tamamlandı ama kaydedilemedi", {
          description: saveError.message || "Veritabanı hatası",
          duration: 5000
        });
      }

      // ✅ Success notification
      toast.success(
        `✅ Analiz tamamlandı! Uygunluk: ${formatCompliance(data.analysis.compliance_score)}`,
        {
          duration: 5000,
          description: `${data.analysis.equipment_inventory.length} ekipman türü tespit edildi`,
          action: {
            label: "ADEP'e Aktar",
            onClick: () => navigate("/adep-wizard", { state: { blueprintData: data.analysis } })
          }
        }
      );

      setActiveTab("results");

      console.log("🎉 Analysis completed successfully!");

    } catch (error: any) {
      clearInterval(interval);
      
      console.error("💥 Analysis failed:", error);
      console.error("📄 Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });

      let errorMessage = "Analiz sırasında hata oluştu";
      let errorDescription = "Lütfen tekrar deneyin";

      // ✅ User-friendly error messages
      if (error.message?.includes("timeout") || error.message?.includes("timed out")) {
        errorMessage = "⏱️ İstek zaman aşımına uğradı";
        errorDescription = "Daha küçük bir görsel deneyin veya internet bağlantınızı kontrol edin";
      } else if (error.message?.includes("fetch") || error.message?.includes("network")) {
        errorMessage = "🌐 Sunucuya bağlanılamadı";
        errorDescription = "İnternet bağlantınızı kontrol edin";
      } else if (error.message?.includes("CORS")) {
        errorMessage = "🔒 Güvenlik hatası";
        errorDescription = "Edge function CORS ayarları kontrol ediliyor";
      } else if (error.message?.includes("API")) {
        errorMessage = "🤖 AI servisi hatası";
        errorDescription = error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage, {
        description: errorDescription,
        duration: 8000
      });

    } finally {
      setLoading(false);
      console.log("🏁 Analysis process ended");
    }
  };
  // ✅ Enhanced PDF Export
  const exportPDF = async () => {
    if (!analysisResult) return;

    toast.info("📄 Profesyonel rapor oluşturuluyor...");

    const doc = new jsPDF();
    addInterFontsToJsPDF(doc);
    doc.setFont("Inter", "normal");

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;

    // ✅ COVER PAGE
    doc.setFillColor(29, 78, 216);
    doc.rect(0, 0, pageWidth, pageHeight / 2, 'F');
    doc.setFillColor(59, 130, 246);
    doc.rect(0, pageHeight / 2, pageWidth, pageHeight / 2, 'F');

    doc.setFont("Inter", "bold");
    doc.setFontSize(32);
    doc.setTextColor(255, 255, 255);
    doc.text("KROKİ GÜVENLİK", pageWidth / 2, 80, { align: 'center' });
    doc.text("ANALİZ RAPORU", pageWidth / 2, 95, { align: 'center' });

    doc.setFont("Inter", "normal");
    doc.setFontSize(14);
    doc.text(projectName || "Teknik Analiz", pageWidth / 2, 115, { align: 'center' });

    // Compliance badge
    doc.setFillColor(255, 255, 255);
    doc.circle(pageWidth / 2, 145, 25, 'F');
    doc.setFont("Inter", "bold");
    doc.setFontSize(24);
    const scoreColor = typeof analysisResult.compliance_score === "number" && analysisResult.compliance_score >= 80 ? [34, 197, 94] : 
                       typeof analysisResult.compliance_score === "number" && analysisResult.compliance_score >= 60 ? [245, 158, 11] : [220, 38, 38];
    // Satır 363 civarı
    doc.setTextColor(...(scoreColor as [number, number, number]));
    doc.text(formatCompliance(analysisResult.compliance_score), pageWidth / 2, 150, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("Genel Uygunluk Skoru", pageWidth / 2, 175, { align: 'center' });

    // Metadata
    doc.setFontSize(9);
    doc.text(`Rapor Tarihi: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, pageWidth / 2, 190, { align: 'center' });
    doc.text(`Hazırlayan: ${user?.email || "İSGVizyon AI"}`, pageWidth / 2, 197, { align: 'center' });

    // ✅ PAGE 2: BUILDING INFO
    doc.addPage();
    
    doc.setFillColor(29, 78, 216);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setFont("Inter", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("🏢 BİNA BİLGİLERİ", pageWidth / 2, 25, { align: 'center' });

    let y = 50;

    const buildingData = [
      ["Bina Tipi", analysisResult.project_info.building_category],
      ["Kullanım Amacı", analysisResult.project_info.area_type],
      ["Kat Sayısı", analysisResult.project_info.detected_floor.toString()],
      ["Tahmini Alan", formatAreaWithUnit(analysisResult.project_info.estimated_area_sqm)],
      ["Kapasite", analysisResult.project_info.occupancy_count?.toString() || "—"]
    ];

    autoTable(doc, {
      startY: y,
      body: buildingData,
      theme: 'grid',
      styles: {
        font: "Inter",
        fontSize: 11,
        cellPadding: 5
      },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [239, 246, 255], cellWidth: 70 },
        1: { fillColor: [255, 255, 255], fontStyle: 'bold', cellWidth: 110 }
      }
    });

    y = (doc as any).lastAutoTable.finalY + 15;

    // Risk Assessment
    if (analysisResult.risk_assessment) {
      doc.setFont("Inter", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text("⚠️ Risk Değerlendirmesi", margin, y);
      y += 10;

      const riskData = [
        ["Yangın Riski", analysisResult.risk_assessment.fire_risk === "high" ? "🔴 Yüksek" :
                         analysisResult.risk_assessment.fire_risk === "medium" ? "🟡 Orta" : "🟢 Düşük"],
        ["Yapısal Risk", analysisResult.risk_assessment.structural_risk === "high" ? "🔴 Yüksek" :
                         analysisResult.risk_assessment.structural_risk === "medium" ? "🟡 Orta" : "🟢 Düşük"],
        ["Tahliye Kapasitesi", `${analysisResult.risk_assessment.evacuation_capacity} kişi`]
      ];

      autoTable(doc, {
        startY: y,
        body: riskData,
        theme: 'striped',
        styles: {
          font: "Inter",
          fontSize: 10,
          cellPadding: 4
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 70 },
          1: { fontStyle: 'bold', fontSize: 11 }
        }
      });
    }

    // ✅ PAGE 3: EQUIPMENT
    doc.addPage();
    
    doc.setFillColor(34, 197, 94);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setFont("Inter", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("🛠️ EKİPMAN ENVANTERİ", pageWidth / 2, 25, { align: 'center' });

    y = 50;

    const equipmentData = analysisResult.equipment_inventory.map(eq => [
      EQUIPMENT_NAMES[eq.type],
      eq.count.toString(),
      eq.recommended_count?.toString() || "—",
      eq.adequacy_status === 'sufficient' ? '✓ Yeterli' :
      eq.adequacy_status === 'insufficient' ? '✗ Yetersiz' : '⚠ Fazla'
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Ekipman', 'Mevcut', 'Önerilen', 'Durum']],
      body: equipmentData,
      theme: 'grid',
      styles: {
        font: "Inter",
        fontSize: 10,
        cellPadding: 4
      },
      headStyles: {
        fillColor: [34, 197, 94],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 40, halign: 'center' }
      },
      didParseCell: (data) => {
        if (data.column.index === 3) {
          if (data.cell.text[0].includes('Yetersiz')) {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.text[0].includes('Yeterli')) {
            data.cell.styles.textColor = [34, 197, 94];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    // ✅ PAGE 4: VIOLATIONS
    if (analysisResult.safety_violations.length > 0) {
      doc.addPage();
      
      doc.setFillColor(220, 38, 38);
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setFont("Inter", "bold");
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text("⚠️ GÜVENLİK UYUMSUZLUKLARI", pageWidth / 2, 25, { align: 'center' });

      y = 50;

      const violationData = analysisResult.safety_violations.map((v, i) => [
        (i + 1).toString(),
        v.issue,
        v.severity === 'critical' ? '🔴 Kritik' :
        v.severity === 'warning' ? '🟡 Uyarı' : '🔵 Bilgi',
        v.recommended_action,
        v.regulation_reference
      ]);

      autoTable(doc, {
        startY: y,
        head: [['#', 'Sorun', 'Seviye', 'Önerilen Aksiyon', 'Mevzuat']],
        body: violationData,
        theme: 'grid',
        styles: {
          font: "Inter",
          fontSize: 8,
          cellPadding: 3
        },
        headStyles: {
          fillColor: [220, 38, 38],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 50 },
          2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 60 },
          4: { cellWidth: 40, fontSize: 7 }
        }
      });
    }

    // ✅ PAGE 5: ROADMAP
    if (analysisResult.improvement_roadmap) {
      doc.addPage();
      
      doc.setFillColor(245, 158, 11);
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setFont("Inter", "bold");
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text("🗺️ İYİLEŞTİRME YOLU HARİTASI", pageWidth / 2, 25, { align: 'center' });

      y = 50;

      // Immediate
      doc.setFont("Inter", "bold");
      doc.setFontSize(12);
      doc.setTextColor(220, 38, 38);
      doc.text("🔴 ACİL (0-7 gün)", margin, y);
      y += 8;

      doc.setFont("Inter", "normal");
      doc.setFontSize(9);
      doc.setTextColor(31, 41, 55);
      analysisResult.improvement_roadmap.immediate.forEach((item, i) => {
        const lines = doc.splitTextToSize(`${i + 1}. ${item}`, pageWidth - margin * 2 - 5);
        doc.text(lines, margin + 5, y);
        y += lines.length * 5 + 2;
      });

      y += 10;

      // Short-term
      doc.setFont("Inter", "bold");
      doc.setFontSize(12);
      doc.setTextColor(245, 158, 11);
      doc.text("🟡 KISA VADELİ (1-3 ay)", margin, y);
      y += 8;

      doc.setFont("Inter", "normal");
      doc.setFontSize(9);
      doc.setTextColor(31, 41, 55);
      analysisResult.improvement_roadmap.short_term.forEach((item, i) => {
        const lines = doc.splitTextToSize(`${i + 1}. ${item}`, pageWidth - margin * 2 - 5);
        doc.text(lines, margin + 5, y);
        y += lines.length * 5 + 2;
      });

      y += 10;

      // Long-term
      doc.setFont("Inter", "bold");
      doc.setFontSize(12);
      doc.setTextColor(34, 197, 94);
      doc.text("🟢 UZUN VADELİ (6-12 ay)", margin, y);
      y += 8;

      doc.setFont("Inter", "normal");
      doc.setFontSize(9);
      doc.setTextColor(31, 41, 55);
      analysisResult.improvement_roadmap.long_term.forEach((item, i) => {
        const lines = doc.splitTextToSize(`${i + 1}. ${item}`, pageWidth - margin * 2 - 5);
        doc.text(lines, margin + 5, y);
        y += lines.length * 5 + 2;
      });
    }

    // ✅ FOOTER (all pages)
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("Inter", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Sayfa ${i} / ${totalPages} | İSGVizyon AI Kroki Analizi © ${new Date().getFullYear()}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    doc.save(`İSGVizyon-Kroki-Analiz-${format(new Date(), 'yyyyMMdd-HHmmss')}.pdf`);
    toast.success("✅ Profesyonel rapor indirildi!");
  };

  const loadPreviousAnalysis = async (id: string) => {
    const { data, error } = await supabase
      .from("blueprint_analyses")
      .select("analysis_result")
      .eq("id", id)
      .single();

    if (!error && data?.analysis_result) {
      // ✅ Type assertion ile
      setPreviousAnalysis(data.analysis_result as unknown as AnalysisResult);
      setCompareMode(true);
      toast.success("Önceki analiz yüklendi. Karşılaştırma modu aktif.");
    } else if (error) {
      console.error("Load previous analysis error:", error);
      toast.error("Önceki analiz yüklenemedi");
    }
  };

  // ✅ Share analysis
  const shareAnalysis = async () => {
    if (!analysisResult) return;

    const shareData = {
      title: `Kroki Güvenlik Analizi - ${projectName}`,
      text: `Uygunluk Skoru: ${formatCompliance(analysisResult.compliance_score)}\n${analysisResult.safety_violations.length} uyumsuzluk tespit edildi.`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast.success("Paylaşıldı!");
      } catch (e) {
        console.log("Share cancelled");
      }
    } else {
      navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
      toast.success("Link kopyalandı!");
    }
  };

  const equipmentTotalPages = analysisResult
    ? Math.max(1, Math.ceil(analysisResult.equipment_inventory.length / EQUIPMENT_PAGE_SIZE))
    : 1;
  const violationTotalPages = analysisResult
    ? Math.max(1, Math.ceil(analysisResult.safety_violations.length / VIOLATION_PAGE_SIZE))
    : 1;
  const suggestionTotalPages = analysisResult
    ? Math.max(1, Math.ceil(analysisResult.expert_suggestions.length / SUGGESTION_PAGE_SIZE))
    : 1;
  const historyTotalPages = Math.max(1, Math.ceil(analysisHistory.length / HISTORY_PAGE_SIZE));

  const pagedEquipment = analysisResult
    ? analysisResult.equipment_inventory.slice(
        (equipmentPage - 1) * EQUIPMENT_PAGE_SIZE,
        equipmentPage * EQUIPMENT_PAGE_SIZE,
      )
    : [];
  const pagedViolations = analysisResult
    ? analysisResult.safety_violations.slice(
        (violationPage - 1) * VIOLATION_PAGE_SIZE,
        violationPage * VIOLATION_PAGE_SIZE,
      )
    : [];
  const pagedSuggestions = analysisResult
    ? analysisResult.expert_suggestions.slice(
        (suggestionPage - 1) * SUGGESTION_PAGE_SIZE,
        suggestionPage * SUGGESTION_PAGE_SIZE,
      )
    : [];
  const pagedHistory = analysisHistory.slice(
    (historyPage - 1) * HISTORY_PAGE_SIZE,
    historyPage * HISTORY_PAGE_SIZE,
  );

  const renderPagination = (
    currentPage: number,
    totalPages: number,
    onChange: React.Dispatch<React.SetStateAction<number>>,
    itemLabel: string,
  ) => {
    if (totalPages <= 1) return null;

    return (
      <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
        <span>
          Sayfa <span className="font-semibold text-slate-100">{currentPage}</span> /{" "}
          <span className="font-semibold text-slate-100">{totalPages}</span>
          <span className="mx-2 text-slate-600">•</span>
          {itemLabel}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
            onClick={() => onChange((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Önceki
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
            onClick={() => onChange((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
          >
            Sonraki
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] px-6 py-7 shadow-[0_24px_80px_rgba(2,6,23,0.42)] lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" />
              AI Kroki Analiz Merkezi
            </div>
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-white lg:text-4xl">
                <Building2 className="h-9 w-9 text-cyan-300" />
                Blueprint Analyzer
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 lg:text-base">
                Teknik çizimleri, kat planlarını ve tahliye krokilerini daha sade bir ekranda analiz edin; ekipman, uygunsuzluk ve yol haritasını sayfalı görünümle inceleyin.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border-white/10 bg-white/[0.04] text-slate-200">Yükle → Önizle → Sonuç</Badge>
              <Badge className="border-white/10 bg-white/[0.04] text-slate-200">Daha sakin sonuç ekranı</Badge>
              <Badge className="border-white/10 bg-white/[0.04] text-slate-200">Sayfalı liste görünümü</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => navigate("/blueprint-analyzer/how-to")}
            className="gap-2 rounded-2xl border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
          >
            <CircleHelp className="h-4 w-4" />
            Nasıl Kullanılır
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/adep-wizard")}
            className="gap-2 rounded-2xl border-cyan-400/20 bg-cyan-500/10 text-cyan-50 hover:bg-cyan-500/15"
          >
            <ArrowRight className="h-4 w-4" />
            ADEP Sihirbazı'na Git
          </Button>
        </div>
      </div>
      </div>

      {/* TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl border border-white/10 bg-slate-950/70 p-1 md:grid-cols-4">
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" />
            Yükle
          </TabsTrigger>
          <TabsTrigger value="preview" disabled={!blueprintPreview} className="gap-2">
            <Eye className="h-4 w-4" />
            Önizleme
          </TabsTrigger>
          <TabsTrigger value="results" disabled={!analysisResult} className="gap-2">
            <Target className="h-4 w-4" />
            Sonuçlar
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="h-4 w-4" />
            Geçmiş
          </TabsTrigger>
        </TabsList>

        {/* UPLOAD TAB */}
        <TabsContent value="upload" className="space-y-6">
          <Card className="border-white/10 bg-slate-950/70 shadow-[0_18px_40px_rgba(2,6,23,0.28)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileImage className="h-5 w-5 text-primary" />
                Kroki/Plan Yükle
              </CardTitle>
              <CardDescription>
                CAD çizimi, el çizimi, dijital plan veya tahliye krokisi yükleyebilirsiniz
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Project metadata */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Proje Adı</Label>
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Örn: ABC Plaza Kat Planı"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Manuel Notlar (Opsiyonel)</Label>
                  <Input
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    placeholder="Örn: 3. kat ofis alanı"
                    className="mt-2"
                  />
                </div>
              </div>

              {/* Upload area */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="relative"
              >
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  className="hidden"
                />
                
                <label 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-cyan-400/20 bg-cyan-500/[0.06] p-16 text-center transition-all group hover:bg-cyan-500/[0.10]"
                >
                  <FileImage className="mb-4 h-20 w-20 text-cyan-300 transition-transform group-hover:scale-110" />
                  <span className="text-xl font-bold text-foreground">Kroki Görseli Seç veya Sürükle</span>
                  <span className="mt-2 text-sm text-muted-foreground">PNG, JPG, JPEG (Max 10MB)</span>
                  <div className="flex items-center gap-4 mt-4">
                    <Badge variant="secondary">Sürükle & Bırak</Badge>
                    <Badge variant="secondary">AI Destekli</Badge>
                    <Badge variant="secondary">Hızlı Sonuç</Badge>
                  </div>
                </label>
              </div>

              {/* Info boxes */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-900 dark:text-blue-100">
                        <p className="font-semibold mb-1">Desteklenen Formatlar</p>
                        <p className="text-xs">• AutoCAD çıktıları (PDF'ten fotoğraf)</p>
                        <p className="text-xs">• Mimari kat planları</p>
                        <p className="text-xs">• Yangın tahliye planları</p>
                        <p className="text-xs">• El çizimleri</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-green-200 bg-green-50 dark:bg-green-950">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <div className="text-sm text-green-900 dark:text-green-100">
                        <p className="font-semibold mb-1">AI Analiz Kapsamı</p>
                        <p className="text-xs">✓ Ekipman envanter tespiti</p>
                        <p className="text-xs">✓ Mevzuat uyumluluk kontrolü</p>
                        <p className="text-xs">✓ Risk değerlendirmesi</p>
                        <p className="text-xs">✓ İyileştirme önerileri</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PREVIEW TAB */}
        <TabsContent value="preview" className="space-y-6">
          <Card className="border-white/10 bg-slate-950/70 shadow-[0_18px_40px_rgba(2,6,23,0.28)]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Kroki Önizleme</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setZoom(prev => Math.min(prev + 0.2, 3))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.5))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setRotation(prev => (prev + 90) % 360)}
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { 
                      setBlueprintPreview(""); 
                      setBlueprintImage(""); 
                      setZoom(1);
                      setRotation(0);
                      setActiveTab("upload");
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative h-[600px] w-full overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.84),rgba(15,23,42,0.58))]">
                <img 
                  src={blueprintPreview} 
                  alt="Kroki" 
                  className="absolute inset-0 m-auto max-w-full max-h-full object-contain transition-transform duration-300"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`
                  }}
                />
              </div>

              <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-sm text-muted-foreground">
                  Zoom: {Math.round(zoom * 100)}% | Rotasyon: {rotation}°
                </div>
                <Button
                  onClick={analyzeBlueprint}
                  disabled={loading}
                  className="h-12 gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-8 text-base font-bold hover:from-cyan-400 hover:to-indigo-400"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {currentLoadingMessage}
                    </>
                  ) : (
                    <>
                      <Shield className="h-5 w-5" />
                      Güvenlik Analizi Başlat
                    </>
                  )}
                </Button>
              </div>

              {loading && (
                <div className="mt-4 space-y-2">
                  <Progress value={loadingProgress} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">
                    {loadingProgress}% tamamlandı
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RESULTS TAB */}
<TabsContent value="results" className="space-y-6">
  {analysisResult && (
    <>
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-cyan-400/15 bg-slate-950/70">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Uygunluk Skoru</p>
                <p className="text-3xl font-black text-cyan-300 mt-1">
                  {formatCompliance(analysisResult.compliance_score)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-cyan-300" />
            </div>
            <Progress 
              value={complianceProgressValue(analysisResult.compliance_score)} 
              className="mt-3 h-2"
            />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/70">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Toplam Ekipman</p>
                <p className="text-3xl font-black mt-1">
                  {analysisResult.equipment_inventory.reduce((sum, eq) => sum + eq.count, 0)}
                </p>
              </div>
              <Shield className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/70">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Uyumsuzluklar</p>
                <p className="text-3xl font-black text-destructive mt-1">
                  {analysisResult.safety_violations.length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/70">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Bina Alanı</p>
                <p className="text-3xl font-black mt-1">
                  {formatAreaWithUnit(analysisResult.project_info.estimated_area_sqm)}
                </p>
              </div>
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 lg:flex-row">
        <Button onClick={exportPDF} className="gap-2 flex-1 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400">
          <Download className="h-4 w-4" />
          PDF Rapor İndir
        </Button>
        <Button 
          onClick={shareAnalysis} 
          variant="outline" 
          className="gap-2 flex-1 rounded-2xl border-white/10 bg-white/[0.03] hover:bg-white/[0.08]"
        >
          <Share2 className="h-4 w-4" />
          Paylaş
        </Button>
        <Button 
          onClick={() => navigate("/adep-wizard", { 
            state: { blueprintData: analysisResult } 
          })} 
          variant="outline"
          className="gap-2 flex-1 rounded-2xl border-white/10 bg-white/[0.03] hover:bg-white/[0.08]"
        >
          <ArrowRight className="h-4 w-4" />
          ADEP'e Aktar
        </Button>
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2 rounded-2xl border-white/10 bg-white/[0.03] hover:bg-white/[0.08]">
            <Save className="h-4 w-4" />
            Kaydet
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Analizi Kaydet</DialogTitle>
            <DialogDescription>
              Bu analizi daha sonra tekrar görüntülemek için kaydedin
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Proje Adı</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Örn: ABC Plaza 3. Kat"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Notlar</Label>
              <Textarea
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder="Ek notlar..."
                className="mt-2"
                rows={3}
              />
            </div>
            {/* ✅ Mevcut saveAnalysis fonksiyonunu kullan */}
            <Button 
              onClick={async () => {
                await saveAnalysis();
                if (!toast.error) { // Hata yoksa kapat
                  setSaveDialogOpen(false);
                }
              }}
              className="w-full"
            >
              Kaydet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Equipment Inventory */}
        <Card className="border-emerald-400/15 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Ekipman Envanteri
            </CardTitle>
            <CardDescription>
              Tespit edilen güvenlik ekipmanları ve uygunluk durumu
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pagedEquipment.map((eq, idx) => (
              <div 
                key={`${eq.type}-${idx}`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-emerald-400/20"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{EQUIPMENT_ICONS[eq.type]}</span>
                    <div>
                      <p className="font-bold text-foreground">
                        {EQUIPMENT_NAMES[eq.type]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {eq.locations.length} konumda tespit edildi
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant={
                      eq.adequacy_status === 'sufficient' ? 'default' :
                      eq.adequacy_status === 'insufficient' ? 'destructive' : 'secondary'
                    }
                    className="gap-1"
                  >
                    {eq.count} adet
                    {eq.recommended_count && ` / ${eq.recommended_count}`}
                  </Badge>
                </div>

                {/* Status indicator */}
                <div className={`flex items-center gap-2 text-sm font-semibold ${
                  eq.adequacy_status === 'sufficient' ? 'text-success' :
                  eq.adequacy_status === 'insufficient' ? 'text-destructive' :
                  'text-warning'
                }`}>
                  {eq.adequacy_status === 'sufficient' ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Yeterli
                    </>
                  ) : eq.adequacy_status === 'insufficient' ? (
                    <>
                      <AlertTriangle className="h-4 w-4" />
                      Yetersiz - {eq.recommended_count! - eq.count} adet daha gerekli
                    </>
                  ) : (
                    <>
                      <Info className="h-4 w-4" />
                      Fazla - {eq.count - eq.recommended_count!} adet
                    </>
                  )}
                </div>

                {/* Locations */}
                <div className="mt-3 space-y-1">
                  {eq.locations.slice(0, 3).map((loc, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-primary" />
                      <span>{loc}</span>
                    </div>
                  ))}
                  {eq.locations.length > 3 && (
                    <p className="text-xs text-primary pl-5">
                      +{eq.locations.length - 3} konum daha...
                    </p>
                  )}
                </div>
              </div>
            ))}
            {renderPagination(
              equipmentPage,
              equipmentTotalPages,
              setEquipmentPage,
              `${analysisResult.equipment_inventory.length} ekipman kaydı`,
            )}
          </CardContent>
        </Card>

        {/* Violations */}
        <Card className="border-red-400/15 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Güvenlik Uyumsuzlukları
            </CardTitle>
            <CardDescription>
              Tespit edilen sorunlar ve önerilen aksiyonlar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysisResult.safety_violations.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
                <p className="font-bold text-success text-lg">
                  Kritik uyumsuzluk tespit edilmedi!
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Tüm güvenlik standartları karşılanıyor.
                </p>
              </div>
            ) : (
              pagedViolations.map((violation, idx) => (
                <div 
                  key={`${violation.issue}-${idx}`}
                  className={`rounded-2xl border p-4 transition-all ${
                    violation.severity === 'critical' 
                      ? 'bg-destructive/10 border-destructive/30' :
                    violation.severity === 'warning' 
                      ? 'bg-warning/10 border-warning/30' :
                    'bg-blue-500/10 border-blue-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <Badge 
                      variant={
                        violation.severity === 'critical' ? 'destructive' :
                        violation.severity === 'warning' ? 'default' : 'secondary'
                      }
                      className="shrink-0"
                    >
                      {violation.severity === 'critical' ? '🔴 KRİTİK' :
                       violation.severity === 'warning' ? '🟡 UYARI' : '🔵 BİLGİ'}
                    </Badge>
                    {violation.priority_level && (
                      <Badge variant="outline" className="shrink-0">
                        Öncelik: {violation.priority_level}
                      </Badge>
                    )}
                  </div>

                  <p className="font-bold text-sm text-foreground mb-2">
                    {violation.issue}
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0">📜</span>
                      <span>{violation.regulation_reference}</span>
                    </div>

                    <div className="flex items-start gap-2 text-xs bg-background/50 p-2 rounded">
                      <span className="shrink-0">💡</span>
                      <span className="text-foreground font-medium">
                        {violation.recommended_action}
                      </span>
                    </div>

                    {violation.estimated_cost && (
                      <div className="flex items-center gap-2 text-xs font-semibold text-warning">
                        <span>💰</span>
                        <span>Tahmini Maliyet: ₺{violation.estimated_cost.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {analysisResult.safety_violations.length > 0 &&
              renderPagination(
                violationPage,
                violationTotalPages,
                setViolationPage,
                `${analysisResult.safety_violations.length} uyumsuzluk kaydı`,
              )}
          </CardContent>
        </Card>
      </div>

      {/* Improvement Roadmap */}
      {analysisResult.improvement_roadmap && (
        <Card className="border-cyan-400/15 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              İyileştirme Yol Haritası
            </CardTitle>
            <CardDescription>
              Öncelik sırasına göre yapılması gereken işlemler
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {/* Immediate */}
              <Card className="border-destructive/30 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    Acil (0-7 gün)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysisResult.improvement_roadmap.immediate.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-destructive shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Short-term */}
              <Card className="border-warning/30 bg-warning/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-warning" />
                    Kısa Vadeli (1-3 ay)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysisResult.improvement_roadmap.short_term.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-warning shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Long-term */}
              <Card className="border-success/30 bg-success/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    Uzun Vadeli (6-12 ay)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysisResult.improvement_roadmap.long_term.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-success shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expert Suggestions */}
      {analysisResult.expert_suggestions.length > 0 && (
        <Card className="border-blue-400/15 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              AI Uzman Önerileri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {pagedSuggestions.map((suggestion, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm">
                  <CheckSquare className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-foreground">{suggestion}</span>
                </li>
              ))}
            </ul>
            {renderPagination(
              suggestionPage,
              suggestionTotalPages,
              setSuggestionPage,
              `${analysisResult.expert_suggestions.length} uzman önerisi`,
            )}
          </CardContent>
        </Card>
      )}
    </>
  )}
</TabsContent>

{/* HISTORY TAB */}
<TabsContent value="history" className="space-y-6">
  <Card className="border-white/10 bg-slate-950/70 shadow-[0_18px_40px_rgba(2,6,23,0.28)]">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" />
        Analiz Geçmişi
      </CardTitle>
      <CardDescription>
        Önceki analizlerinizi görüntüleyin ve karşılaştırın
      </CardDescription>
    </CardHeader>
    <CardContent>
      {analysisHistory.length === 0 ? (
        <div className="text-center py-12">
          <FileImage className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">Henüz analiz geçmişi yok</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pagedHistory.map((item) => (
            <div 
              key={item.id}
              className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-cyan-400/20"
              onClick={() => loadPreviousAnalysis(item.id)}
            >
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {format(new Date(item.created_at), 'dd')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(item.created_at), 'MMM')}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {item.building_type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(item.created_at), 'HH:mm')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">
                    {formatCompliance(item.compliance_score)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Uygunluk
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      )}
      {renderPagination(
        historyPage,
        historyTotalPages,
        setHistoryPage,
        `${analysisHistory.length} analiz kaydı`,
      )}
    </CardContent>
  </Card>
</TabsContent>
      </Tabs>
    </div>
  );
}
