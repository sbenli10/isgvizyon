//src\pages\Inspections.tsx
import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Plus,
  Download,
  Loader2,
  AlertCircle,
  Clock,
  Zap,
  Activity,
  ChevronRight,
  Eye,
  FileText,
  MapPin,
  Calendar,
  AlertTriangle,
  Share2,
  X,
  Trash2,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FineKinneyWizard } from "@/components/FineKinneyWizard";
import { ImageUpload } from "@/components/ImageUpload";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import {
  getInspectionDetail,
  getInspectionSummary,
  listInspectionsPage,
  type InspectionDetail,
  type InspectionListItem,
  type InspectionStatus,
  type RiskLevel,
  type InspectionSummary,
} from "@/lib/inspectionOperations";
import { readPageSessionCache, writePageSessionCache } from "@/lib/pageSessionCache";
import { uploadInspectionPhoto } from "@/lib/storage";
import { generateInspectionsPDF } from "@/lib/inspectionPdfExport";
import { SendReportModal } from "@/components/SendReportModal";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";
import jsPDF from "jspdf";

interface StatCard {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  trend?: string;
}

interface InspectionReportEvent {
  id: string;
  title: string;
  created_at: string;
  export_format?: string | null;
  file_url?: string | null;
  report_kind?: "dof" | "inspection";
}

const extractStorageReference = (rawUrl?: string | null) => {
  if (!rawUrl) return null;

  try {
    const parsedUrl = new URL(rawUrl);
    const match = parsedUrl.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/i);
    if (!match) return null;

    return {
      bucket: decodeURIComponent(match[1]),
      path: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
};

const statusFilters = ["all", "completed", "in_progress", "draft", "cancelled"] as const;
const PAGE_SIZE = 24;
const INSPECTIONS_CACHE_TTL = 5 * 60 * 1000;

const statusConfig = {
  completed: { label: "Tamamlandı", color: "bg-success/10 text-success border-success/30", icon: "✅" },
  in_progress: { label: "Devam Ediyor", color: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: "⏳" },
  draft: { label: "Taslak", color: "bg-gray-500/10 text-gray-600 border-gray-500/30", icon: "📝" },
  cancelled: { label: "İptal", color: "bg-destructive/10 text-destructive border-destructive/30", icon: "❌" },
};

const riskConfig = {
  low: { label: "Düşük Risk", color: "bg-success/10 text-success border-success/30", icon: "🟢" },
  medium: { label: "Orta Risk", color: "bg-warning/10 text-warning border-warning/30", icon: "🟡" },
  high: { label: "Yüksek Risk", color: "bg-orange-500/10 text-orange-600 border-orange-500/30", icon: "🔶" },
  critical: { label: "Kritik Risk", color: "bg-destructive/10 text-destructive border-destructive/30", icon: "🔴" },
};

export default function Inspections() {
  const { user } = useAuth();
  const activeUserId = user?.id ?? null;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<(typeof statusFilters)[number]>("all");
  const [inspections, setInspections] = useState<InspectionListItem[]>([]);
  const [summary, setSummary] = useState<InspectionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  usePageDataTiming(loading);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<InspectionListItem | null>(null);
  const [inspectionDetail, setInspectionDetail] = useState<InspectionDetail | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sharePreparing, setSharePreparing] = useState(false);
  const [currentReportUrl, setCurrentReportUrl] = useState("");
  const [currentReportFilename, setCurrentReportFilename] = useState("");
  const [linkedReport, setLinkedReport] = useState<{ id: string; url: string; filename: string; kind: "dof" | "inspection" } | null>(null);
  const [reportEvents, setReportEvents] = useState<InspectionReportEvent[]>([]);
  const [loadingLinkedReport, setLoadingLinkedReport] = useState(false);
  const [deletingLinkedReport, setDeletingLinkedReport] = useState(false);
  const [inspectionReportIds, setInspectionReportIds] = useState<Record<string, boolean>>({});
  const [highlightedInspectionId, setHighlightedInspectionId] = useState<string | null>(null);

  const [locationName, setLocationName] = useState("");
  const [equipmentCategory, setEquipmentCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("low");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [exporting, setExporting] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const location = useLocation();
  const [focusInspectionHandled, setFocusInspectionHandled] = useState<string | null>(null);
  const listCacheKey = activeUserId
    ? `inspections:list:${activeUserId}:${activeFilter}:${debouncedSearch}:${page}`
    : null;
  const summaryCacheKey = activeUserId ? `inspections:summary:${activeUserId}` : null;
  const activeInspection = inspectionDetail ?? selectedInspection;

  useEffect(() => {
    if (location.state?.prefilledNotes) {
      setNotes(location.state.prefilledNotes);
    }
  }, [location.state]);

  useEffect(() => {
    const focusInspectionId = location.state?.focusInspectionId as string | undefined;
    if (!focusInspectionId || loading || focusInspectionHandled === focusInspectionId || inspections.length === 0) {
      return;
    }

    const matchedInspection = inspections.find((inspection) => inspection.id === focusInspectionId);
    if (!matchedInspection) return;

    setFocusInspectionHandled(focusInspectionId);
    setHighlightedInspectionId(focusInspectionId);
    void openInspectionDetails(matchedInspection);
  }, [focusInspectionHandled, inspections, loading, location.state]);

  useEffect(() => {
    if (!highlightedInspectionId) return;
    const timer = window.setTimeout(() => setHighlightedInspectionId(null), 5000);
    return () => window.clearTimeout(timer);
  }, [highlightedInspectionId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, activeFilter]);

  const fetchInspections = useCallback(async () => {
    if (!activeUserId) return;

    setLoading(true);
    try {
      const pageData = await listInspectionsPage(activeUserId, {
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        status: activeFilter === "all" ? null : activeFilter,
      });

      setInspections(pageData.items);
      setHasNextPage(pageData.hasNextPage);
      const inspectionIds = pageData.items.map((item) => item.id).filter(Boolean);

      if (inspectionIds.length > 0) {
        const { data: reportRows, error: reportLookupError } = await supabase
          .from("reports")
          .select("content")
          .eq("user_id", activeUserId)
          .in("content->>inspection_id", inspectionIds);

        if (reportLookupError) {
          console.error("Inspection report lookup error:", reportLookupError);
          setInspectionReportIds({});
        } else {
          const reportMap = ((reportRows as any[]) ?? []).reduce<Record<string, boolean>>((acc, row) => {
            const inspectionId = row?.content?.inspection_id;
            if (typeof inspectionId === "string" && inspectionId.length > 0) {
              acc[inspectionId] = true;
            }
            return acc;
          }, {});
          setInspectionReportIds(reportMap);
        }
      } else {
        setInspectionReportIds({});
      }

      if (listCacheKey) {
        writePageSessionCache(listCacheKey, pageData);
      }
    } catch (error: any) {
      toast.error("Denetimler yüklenirken hata oluştu");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, activeUserId, debouncedSearch, page]);

  const fetchSummary = useCallback(async () => {
    if (!activeUserId) return;

    setSummaryLoading(true);
    try {
      const nextSummary = await getInspectionSummary(activeUserId);
      setSummary(nextSummary);
      if (summaryCacheKey) {
        writePageSessionCache(summaryCacheKey, nextSummary);
      }
    } catch (error) {
      console.error("Inspection summary load error:", error);
    } finally {
      setSummaryLoading(false);
    }
  }, [activeUserId, summaryCacheKey]);

  useEffect(() => {
    if (!activeUserId) return;
    if (listCacheKey) {
      const cachedPage = readPageSessionCache<{ items: InspectionListItem[]; hasNextPage: boolean }>(
        listCacheKey,
        INSPECTIONS_CACHE_TTL,
      );
      if (cachedPage) {
        setInspections(cachedPage.items);
        setHasNextPage(cachedPage.hasNextPage);
        setLoading(false);
      }
    }
    void fetchInspections();
  }, [activeUserId, fetchInspections, listCacheKey]);

  useEffect(() => {
    if (!activeUserId) return;
    if (summaryCacheKey) {
      const cachedSummary = readPageSessionCache<InspectionSummary>(
        summaryCacheKey,
        INSPECTIONS_CACHE_TTL,
      );
      if (cachedSummary) {
        setSummary(cachedSummary);
        setSummaryLoading(false);
      }
    }
    void fetchSummary();
  }, [activeUserId, fetchSummary, summaryCacheKey]);

  const refreshInspectionData = useCallback(async () => {
    await Promise.all([fetchInspections(), fetchSummary()]);
  }, [fetchInspections, fetchSummary]);

  const handleAIAnalysis = async () => {
    if (!notes.trim()) {
      toast.error("Lütfen notları yazın");
      return;
    }

    setAiAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-hazard", {
        body: { hazardDescription: notes.trim() },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const aiRisk = data.riskScore?.toLowerCase();
      if (aiRisk === "low" || aiRisk === "düşük") setRiskLevel("low");
      else if (aiRisk === "medium" || aiRisk === "orta") setRiskLevel("medium");
      else if (aiRisk === "high" || aiRisk === "yüksek") setRiskLevel("high");
      else if (aiRisk === "critical" || aiRisk === "kritik") setRiskLevel("critical");

      toast.success(`✅ AI Analizi: Risk = ${data.riskScore}`);
    } catch (e: any) {
      toast.error(e.message || "AI analizi başarısız");
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !locationName) {
      toast.error("Lütfen tüm zorunlu alanları doldurun");
      return;
    }

    setSubmitting(true);
    try {
      let photoUrl = null;
      if (selectedFile) {
        photoUrl = await uploadInspectionPhoto(selectedFile, user.id);
        if (!photoUrl) {
          throw new Error("Fotoğraf yüklenemedi");
        }
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.organization_id) {
        throw new Error("Kuruluş bilgisi bulunamadı");
      }

      const newInspectionData = {
        org_id: profile.organization_id,
        user_id: user.id,
        location_name: locationName,
        equipment_category: equipmentCategory || null,
        status: "draft" as InspectionStatus,
        risk_level: riskLevel as RiskLevel,
        notes: notes || null,
        answers: {},
        media_urls: photoUrl ? [photoUrl] : [],
      };

      const { error: insertError } = await supabase
        .from("inspections")
        .insert(newInspectionData)
        .select("id")
        .single();

      if (insertError) throw insertError;

      toast.success("✅ Denetim başarıyla oluşturuldu");

      setLocationName("");
      setEquipmentCategory("");
      setNotes("");
      setRiskLevel("low");
      setSelectedFile(null);
      setDialogOpen(false);
      setPage(0);
      await refreshInspectionData();
    } catch (error: any) {
      toast.error(error.message || "Denetim oluşturulurken hata oluştu");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteInspection = async (id: string) => {
    if (!confirm("Bu denetimi silmek istediğinize emin misiniz?")) return;

    try {
      const { error } = await supabase
        .from("inspections")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setDetailsOpen(false);
      setSelectedInspection(null);
      await refreshInspectionData();
      toast.success("✅ Denetim silindi");
    } catch (error) {
      toast.error("❌ Denetim silinemedi");
    }
  };



  const loadLinkedReport = async (inspectionId: string) => {
    if (!user) return;

    setLoadingLinkedReport(true);
    setLinkedReport(null);
    setReportEvents([]);
    try {
      const { data, error } = await supabase
        .from("reports")
        .select("id, file_url, title, export_format, content, created_at")
        .eq("user_id", user.id)
        .contains("content", { inspection_id: inspectionId })
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      const rows = (data as any[]) ?? [];
      if (!rows.length) return;

      const events = rows.map((row) => ({
        id: row.id,
        title: row.title || "Rapor",
        created_at: row.created_at,
        export_format: row.export_format,
        file_url: row.file_url,
        report_kind:
          row?.content?.report_kind === "dof" || row.export_format === "docx"
            ? "dof"
            : "inspection",
      })) as InspectionReportEvent[];
      setReportEvents(events);

      const latest = events[0];
      if (!latest?.file_url) return;
      const fallbackExt = latest.export_format === "docx" ? "docx" : "pdf";
      const title = latest.title.includes(".") ? latest.title : `${latest.title}.${fallbackExt}`;

      setLinkedReport({
        id: latest.id,
        url: latest.file_url,
        filename: title,
        kind: latest.report_kind || "inspection",
      });
    } catch (error) {
      console.error("Linked report load error:", error);
    } finally {
      setLoadingLinkedReport(false);
    }
  };

  const openInspectionDetails = async (inspection: InspectionListItem) => {
    setSelectedInspection(inspection);
    setInspectionDetail(null);
    setDetailsOpen(true);
    setDetailsLoading(true);
    try {
      if (!user) return;
      const [detail] = await Promise.all([
        getInspectionDetail(user.id, inspection.id),
        loadLinkedReport(inspection.id),
      ]);
      setInspectionDetail(detail);
    } catch (error) {
      console.error("Inspection detail load error:", error);
      toast.error("Denetim detayları yüklenemedi");
    } finally {
      setDetailsLoading(false);
    }
  };

  const openLinkedReport = () => {
    void (async () => {
      if (!linkedReport?.url) return;

      try {
        const accessUrl = await resolveLinkedReportUrl(linkedReport.url);

        if (linkedReport.kind === "dof") {
          const officePreviewUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(accessUrl)}`;
          window.open(officePreviewUrl, "_blank", "noopener,noreferrer");
          return;
        }

        window.open(accessUrl, "_blank", "noopener,noreferrer");
      } catch (error: any) {
        toast.error(error?.message || "Rapor açilamadi");
      }
    })();
  };

  const resolveLinkedReportUrl = async (rawUrl: string) => {
    const storageRef = extractStorageReference(rawUrl);
    if (!storageRef) return rawUrl;

    const { data, error } = await supabase.storage
      .from(storageRef.bucket)
      .createSignedUrl(storageRef.path, 60 * 60);

    if (error || !data?.signedUrl) {
      return rawUrl;
    }

    return data.signedUrl;
  };

  const downloadLinkedReport = async () => {
    if (!linkedReport?.url) return;
    try {
      const accessUrl = await resolveLinkedReportUrl(linkedReport.url);
      const response = await fetch(accessUrl);
      if (!response.ok) throw new Error("Rapor indirilemedi");
      const blob = await response.blob();
      const ext = linkedReport.kind === "dof" ? "docx" : "pdf";
      const filename = linkedReport.filename.includes(".")
        ? linkedReport.filename
        : `${linkedReport.filename}.${ext}`;
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error: any) {
      toast.error(error?.message || "Rapor indirilemedi");
    }
  };

  const handleDeleteLinkedReport = async () => {
    if (!user || !linkedReport?.id) return;
    if (!window.confirm("Bu raporu silmek istediğinize emin misiniz?")) return;

    setDeletingLinkedReport(true);
    try {
      const storageRef = extractStorageReference(linkedReport.url);

      if (storageRef) {
        const { error: storageError } = await supabase.storage
          .from(storageRef.bucket)
          .remove([storageRef.path]);

        if (storageError) {
          console.warn("Linked report storage delete error:", storageError);
        }
      }

      const { error: reportDeleteError } = await supabase
        .from("reports")
        .delete()
        .eq("id", linkedReport.id)
        .eq("user_id", user.id);

      if (reportDeleteError) throw reportDeleteError;

      setLinkedReport(null);
      setReportEvents((prev) => prev.filter((event) => event.id !== linkedReport.id));
      setInspectionReportIds((prev) => {
        const inspectionId = selectedInspection?.id ?? inspectionDetail?.id;
        if (!inspectionId) return prev;

        return {
          ...prev,
          [inspectionId]: false,
        };
      });
      setCurrentReportUrl("");
      setCurrentReportFilename("");
      toast.success("Rapor silindi");
    } catch (error: any) {
      console.error("Linked report delete error:", error);
      toast.error(error?.message || "Rapor silinemedi");
    } finally {
      setDeletingLinkedReport(false);
    }
  };

  const handleOpenShareModal = async () => {
    if (!user || !activeInspection) return;

    if (linkedReport?.url) {
      const accessUrl = await resolveLinkedReportUrl(linkedReport.url);
      setCurrentReportUrl(accessUrl);
      setCurrentReportFilename(linkedReport.filename);
      setSendModalOpen(true);
      return;
    }

    setSharePreparing(true);
    try {
      const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(16);
      doc.text("Denetim Raporu", 14, 18);

      doc.setFontSize(11);
      let y = 30;
      const line = (label: string, value?: string) => {
        doc.text(`${label}: ${value || "-"}`, 14, y);
        y += 8;
      };

      line("Konum", activeInspection.location_name);
      line("Tarih", new Date(activeInspection.created_at).toLocaleDateString("tr-TR"));
      line("Durum", statusConfig[activeInspection.status].label);
      line("Risk Seviyesi", riskConfig[activeInspection.risk_level].label);
      line("Ekipman", activeInspection.equipment_category || "-");
      line("Fotoğraf Sayısı", String(activeInspection.media_urls?.length || 0));

      if (activeInspection.notes) {
        y += 2;
        doc.setFontSize(12);
        doc.text("Notlar", 14, y);
        y += 7;
        doc.setFontSize(10);
        const notesLines = doc.splitTextToSize(activeInspection.notes, 180);
        doc.text(notesLines, 14, y);
      }

      const pdfBlob = doc.output("blob");
      const fileName = `inspection-${activeInspection.id}.pdf`;
      const storagePath = `inspection-reports/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("reports")
        .upload(storagePath, pdfBlob, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("reports")
        .getPublicUrl(storagePath);

      if (!publicUrlData?.publicUrl) {
        throw new Error("Rapor bağlantısı oluşturulamadı");
      }

      setCurrentReportUrl(publicUrlData.publicUrl);
      setCurrentReportFilename(fileName);
      setSendModalOpen(true);
    } catch (error: any) {
      console.error("Inspection report share error:", error);
      toast.error(error?.message || "E-posta gönderimi için rapor hazırlanamadı");
    } finally {
      setSharePreparing(false);
    }
  };
  const handleExport = async () => {
    if (inspections.length === 0) {
      toast.error("Dışa aktarılacak denetim bulunamadı");
      return;
    }

    setExporting(true);
    try {
      const exportData = inspections.map((i) => ({
        id: i.id,
        site_name: i.location_name,
        inspector_name: i.equipment_category || "N/A",
        inspection_date: i.created_at,
        status: i.status,
        risk_level: i.risk_level,
        observations: i.notes,
        photo_url: i.media_urls?.[0] || null,
      }));

      await generateInspectionsPDF(exportData);
      toast.success("✅ PDF raporu başarıyla oluşturuldu");
    } catch (error) {
      toast.error("❌ PDF oluşturulurken hata oluştu");
      console.error(error);
    } finally {
      setExporting(false);
    }
  };
  const currentPageLabel = page + 1;
  const visibleCount = inspections.length;

  const stats: StatCard[] = [
    {
      title: "Toplam Denetim",
      value: summary?.totalCount ?? inspections.length,
      icon: <Activity className="h-5 w-5" />,
      color: "from-blue-500 to-blue-600",
      trend: `${visibleCount} kayıt görüntüleniyor`,
    },
    {
      title: "Kritik Risk",
      value: summary?.criticalOrHighCount ?? 0,
      icon: <AlertTriangle className="h-5 w-5" />,
      color: "from-red-500 to-red-600",
      trend: summaryLoading ? "Yükleniyor..." : summary && summary.criticalOrHighCount > 0
        ? "Öncelikli aksiyon gerekiyor"
        : "Risk görünümü dengeli",
    },
    {
      title: "Devam Eden",
      value: summary?.openCount ?? 0,
      icon: <Clock className="h-5 w-5" />,
      color: "from-orange-500 to-orange-600",
      trend: summaryLoading ? "Yükleniyor..." : summary && summary.openCount > 0
        ? "Takip bekleyen kayıt var"
        : "Açık kayıt görünmüyor",
    },
  ];

  const riskAttentionRate = summary?.totalCount
    ? Math.round(((summary?.criticalOrHighCount ?? 0) / summary.totalCount) * 100)
    : 0;
  const operationalHighlights = [
    {
      label: "Bugün odak",
      value:
        summaryLoading
          ? "Analiz hazırlanıyor"
          : (summary?.criticalOrHighCount ?? 0) > 0
            ? `${summary?.criticalOrHighCount ?? 0} kayıt öncelikli`
            : "Kritik kayıt görünmüyor",
    },
    {
      label: "Sistem görünümü",
      value:
        summaryLoading
          ? "Senkronize ediliyor"
          : `${summary?.openCount ?? 0} açık denetim izleniyor`,
    },
    {
      label: "Arama bağlamı",
      value: debouncedSearch ? `"${debouncedSearch}" için sonuçlar` : "Tüm denetimler görüntüleniyor",
    },
  ];
  const getNextActionLabel = (inspection: InspectionListItem) => {
    if (inspection.status === "draft") return "Kaydı tamamla ve rapor akışını başlat";
    if (inspection.status === "in_progress") return "Saha notlarını netleştir ve raporu gözden geçir";
    if (inspection.status === "completed") return "Raporu paylaş veya arşiv bağlantısını aç";
    if (inspection.status === "cancelled") return "İptal gerekçesini kontrol et";
    return "Detayı aç ve sonraki aksiyonu netleştir";
  };
  const getNextActionButtonLabel = (inspection: InspectionListItem) => {
    if (inspection.status === "draft") return "Taslağı Tamamla";
    if (inspection.status === "in_progress") return "Detayı Aç ve Tamamla";
    if (inspection.status === "completed") return "Raporu İncele";
    if (inspection.status === "cancelled") return "Kayıt Gerekçesini İncele";
    return "Detayı Aç";
  };
  const getDetailSuggestedAction = () => {
    if (!activeInspection) {
      return {
        title: "Detayı açarak sonraki adımı belirleyin",
        description: "Bu panel, aktif denetim için önerilen sonraki operasyon adımını gösterir.",
        buttonLabel: "Detayı Gör",
        onClick: undefined as (() => void) | undefined,
        disabled: true,
      };
    }

    if (activeInspection.status === "draft") {
      return {
        title: "Taslak kaydı tamamlayın",
        description: "Notları ve risk seviyesini netleştirip bu denetimi operasyon akışına alın.",
        buttonLabel: "Saha Notlarını Gözden Geçir",
        onClick: undefined,
        disabled: true,
      };
    }

    if (linkedReport?.url) {
      return {
        title: "Rapor hazır, paylaşım aşamasına geçin",
        description: "Kayıt için oluşturulan raporu açabilir, indirebilir veya e-posta ile iletebilirsiniz.",
        buttonLabel: "Raporu Aç",
        onClick: openLinkedReport,
        disabled: false,
      };
    }

    return {
      title: "Rapor akışını başlatın",
      description: "Bu kaydı paylaşılabilir hale getirmek için rapor bağlantısını hazırlayın veya e-posta akışını tetikleyin.",
      buttonLabel: sharePreparing ? "Hazırlanıyor..." : "E-posta Akışını Başlat",
      onClick: () => {
        void handleOpenShareModal();
      },
      disabled: sharePreparing,
    };
  };
  const topCompanyEntries = inspections.reduce<Record<string, number>>((acc, inspection) => {
    const key = inspection.location_name?.trim() || "Bilinmeyen konum";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topCompanyTrend = Object.entries(topCompanyEntries).sort((a, b) => b[1] - a[1])[0];
  const topRiskLabel = summaryLoading
    ? "Trend hazırlanıyor"
    : topCompanyTrend
      ? `${topCompanyTrend[0]} • ${topCompanyTrend[1]} kayıt`
      : "Henüz trend oluşmadı";
  const detailMetrics = activeInspection
    ? [
        {
          label: "Risk skoru",
          value: riskConfig[activeInspection.risk_level].label,
          tone: activeInspection.risk_level === "critical" || activeInspection.risk_level === "high"
            ? "text-rose-300"
            : "text-emerald-300",
        },
        {
          label: "Kayıt tipi",
          value: activeInspection.notes ? "Notlu saha kaydı" : "Standart denetim",
          tone: "text-slate-100",
        },
        {
          label: "Rapor bağlantısı",
          value: linkedReport?.filename ? "Hazır" : "Bekliyor",
          tone: linkedReport?.filename ? "text-cyan-300" : "text-slate-400",
        },
      ]
    : [];
  const activityFeed = activeInspection
    ? [
        {
          id: "created",
          title: "Kayıt oluşturuldu",
          detail: `${new Date(activeInspection.created_at).toLocaleDateString("tr-TR")} tarihinde sisteme alındı`,
          tone: "border-cyan-400/20 bg-cyan-500/10 text-cyan-100",
        },
        ...(activeInspection.media_urls && activeInspection.media_urls.length > 0
          ? [
              {
                id: "media",
                title: "Medya kanıtı eklendi",
                detail: `${activeInspection.media_urls.length} fotoğraf kayıtla ilişkilendirildi`,
                tone: "border-violet-400/20 bg-violet-500/10 text-violet-100",
              },
            ]
          : []),
        {
          id: "risk",
          title: "Risk değerlendirmesi hazır",
          detail: `${riskConfig[activeInspection.risk_level].label} seviyesinde işlem önceliği belirlendi`,
          tone:
            activeInspection.risk_level === "critical" || activeInspection.risk_level === "high"
              ? "border-rose-400/20 bg-rose-500/10 text-rose-100"
              : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
        },
        ...(activeInspection.completed_at
          ? [
              {
                id: "completed",
                title: "Denetim tamamlandı",
                detail: `${new Date(activeInspection.completed_at).toLocaleDateString("tr-TR")} tarihinde tamamlandı olarak işaretlendi`,
                tone: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
              },
            ]
          : []),
        ...reportEvents.map((event, index) => ({
          id: `report-${event.id}-${index}`,
          title: `${event.report_kind === "dof" ? "DÖF" : "Denetim"} raporu üretildi`,
          detail: `${new Date(event.created_at).toLocaleDateString("tr-TR")} tarihinde ${event.title || "rapor"} oluşturuldu`,
          tone: "border-white/10 bg-white/[0.04] text-slate-100",
        })),
        ...(!reportEvents.length
          ? [
              {
                id: "report-pending",
                title: linkedReport?.url ? "Rapor bağlantısı mevcut" : "Rapor bağlantısı bekleniyor",
                detail: linkedReport?.url
                  ? "Rapor açılabilir, indirilebilir veya e-posta ile paylaşılabilir"
                  : "Detay panelinden paylaşım akışı tetiklenebilir",
                tone: "border-white/10 bg-white/[0.04] text-slate-100",
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] border border-cyan-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.16),_transparent_32%),linear-gradient(180deg,rgba(9,16,32,0.98),rgba(7,12,24,0.96))] p-6 shadow-[0_24px_80px_rgba(2,8,23,0.45)] md:p-8">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.08]" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
                Denetim Operasyon Merkezi
              </span>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-200">
                Premium görünüm • Hızlı karar akışı
              </span>
            </div>

            <div className="max-w-3xl space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
                Denetimleri izleyin, öncelikleri görün ve saha durumunu tek bakışta yönetin.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                İSGVİZYON denetim merkezi; açık kayıtları, kritik riskleri, rapor bağlantılarını ve saha notlarını
                tek ekranda toplar. Amaç sadece liste göstermek değil, hangi kaydın aksiyon beklediğini netleştirmektir.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {operationalHighlights.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
                  <p className="mt-2 text-sm font-medium text-slate-100">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                className="gap-2 rounded-2xl border-0 bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400 px-6 text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,0.25)] hover:opacity-95"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Yeni Denetim
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2 rounded-2xl border-white/15 bg-white/[0.04] px-6 text-slate-100 hover:bg-white/[0.08]"
                onClick={handleExport}
                disabled={exporting || loading || inspections.length === 0}
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                PDF İndir
              </Button>
            </div>
          </div>

          <div className="space-y-4 rounded-[24px] border border-white/10 bg-slate-950/55 p-4 backdrop-blur-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Operasyon Özeti</p>
                <h2 className="mt-2 text-lg font-semibold text-white">Canlı denetim görünümü</h2>
              </div>
              <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                {loading ? "Yükleniyor" : "Aktif"}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {stats.map((stat, idx) => (
                <div key={idx} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-transform duration-200 hover:-translate-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{stat.title}</span>
                    <div className={`rounded-xl bg-gradient-to-br ${stat.color} p-2 text-white shadow-lg`}>
                      {stat.icon}
                    </div>
                  </div>
                  <p className="mt-4 text-3xl font-semibold text-white">{stat.value}</p>
                  <p className="mt-1 text-xs text-slate-300">{stat.trend}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/8 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">Risk yoğunluğu</span>
                <span className="text-sm font-semibold text-cyan-100">%{riskAttentionRate}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400" style={{ width: `${Math.min(Math.max(riskAttentionRate, 6), 100)}%` }} />
              </div>
              <p className="mt-3 text-xs leading-6 text-slate-300">
                Kritik ve yüksek riskli kayıt oranı, açık denetim akışındaki öncelik yoğunluğunu gösterir.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Firma / konum trendi</span>
                <span className="text-[11px] font-medium text-slate-500">Aktif görünüm</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-100">{topRiskLabel}</p>
              <p className="mt-2 text-xs leading-6 text-slate-400">
                Görünen sayfada en çok kayıt bulunan firma / konum bu alanda öne çıkarılır. Operasyon ekipleri böylece yoğunlaşan alanı hızlıca görür.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <span className="hidden" />
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto border border-cyan-500/20 bg-[linear-gradient(180deg,rgba(11,18,32,0.98),rgba(15,23,42,0.96))] p-0 shadow-[0_32px_90px_rgba(2,8,23,0.65)]">
          <DialogHeader className="border-b border-white/10 bg-gradient-to-r from-cyan-500/15 via-sky-500/10 to-violet-500/15 px-6 py-5">
            <DialogTitle className="text-lg font-semibold text-white">Yeni Denetim Oluştur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-6 pt-5">
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-sm text-cyan-50">
              <div className="flex gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
                <p>
                  <strong>İpucu:</strong> Notları yazıp <span className="font-semibold">AI Analiz</span> ile risk seviyesini hızlıca netleştirebilir, denetimi daha tutarlı bir kayıtla başlatabilirsiniz.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="locationName">📍 Konum Adı *</Label>
                <Input id="locationName" placeholder="Örn: İnşaat Sahası Gamma" value={locationName} onChange={(e) => setLocationName(e.target.value)} className="h-11 border-white/10 bg-slate-900/70 text-slate-50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="equipmentCategory">🔧 Ekipman Kategorisi</Label>
                <Input id="equipmentCategory" placeholder="Örn: Vinç, Asansör" value={equipmentCategory} onChange={(e) => setEquipmentCategory(e.target.value)} className="h-11 border-white/10 bg-slate-900/70 text-slate-50" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="riskLevel">⚠️ Risk Seviyesi</Label>
                <Select value={riskLevel} onValueChange={(value) => setRiskLevel(value as RiskLevel)}>
                  <SelectTrigger className="h-11 border-white/10 bg-slate-900/70 text-slate-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">🟢 Düşük</SelectItem>
                    <SelectItem value="medium">🟡 Orta</SelectItem>
                    <SelectItem value="high">🔶 Yüksek</SelectItem>
                    <SelectItem value="critical">🔴 Kritik</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="notes">📝 Notlar</Label>
                <Button size="sm" variant="outline" className="h-8 gap-1.5 border-cyan-400/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20" onClick={handleAIAnalysis} disabled={aiAnalyzing || !notes.trim()}>
                  {aiAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  AI Analiz
                </Button>
              </div>
              <Textarea id="notes" placeholder="Denetim sırasında yapılan gözlemleri buraya yazın... (AI analiz edebilir)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="resize-none border-white/10 bg-slate-900/70 text-slate-50 placeholder:text-slate-400" />
              {notes.length > 0 && <p className="text-xs text-slate-400">{notes.length} karakter • AI analizi risk seviyesini otomatik güncelleyebilir.</p>}
            </div>

            <div className="space-y-2">
              <Label>📷 Fotoğraf</Label>
              <ImageUpload onImageSelected={(file) => setSelectedFile(file)} onRemoveImage={() => setSelectedFile(null)} disabled={submitting} />
            </div>

            <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2 rounded-2xl border-0 bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400 text-slate-950 shadow-[0_16px_40px_rgba(56,189,248,0.22)]">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Denetim Oluştur
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fine-Kinney Wizard */}
      <FineKinneyWizard />

      {/* FILTERS */}
      <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,23,39,0.96),rgba(12,20,34,0.96))] p-5 shadow-[0_18px_60px_rgba(2,8,23,0.28)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Filtre ve görünüm</p>
            <h2 className="text-xl font-semibold text-white">Denetim kayıtlarını hızla daraltın</h2>
            <p className="max-w-2xl text-sm text-slate-300">
              Duruma göre filtreleyin, arama yapın ve önce hangi denetimi açmanız gerektiğini daha hızlı görün.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Sayfa</p>
              <p className="mt-2 text-lg font-semibold text-slate-100">{currentPageLabel}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Görünen kayıt</p>
              <p className="mt-2 text-lg font-semibold text-slate-100">{visibleCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Açık kayıt</p>
              <p className="mt-2 text-lg font-semibold text-slate-100">{summary?.openCount ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Konum, ekipman veya not içinde arayın..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 rounded-2xl border-white/10 bg-slate-950/55 pl-9 text-slate-100 placeholder:text-slate-400"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`rounded-2xl px-4 py-2.5 text-xs font-semibold capitalize transition-all ${
                  activeFilter === f
                    ? "bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400 text-slate-950 shadow-[0_10px_24px_rgba(56,189,248,0.22)]"
                    : "border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                {f === "all"
                  ? "📋 Tümü"
                  : f === "completed"
                  ? "✅ Tamamlandı"
                  : f === "in_progress"
                  ? "⏳ Devam"
                  : f === "draft"
                  ? "📝 Taslak"
                  : "❌ İptal"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* LIST */}
      {loading ? (
        <div className="rounded-[24px] border border-white/10 bg-slate-950/45 py-14 text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-cyan-300" />
          <p className="text-sm text-slate-300">Denetimler yükleniyor...</p>
        </div>
      ) : inspections.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {inspections.map((inspection) => {
            const hasLinkedReport = Boolean(inspectionReportIds[inspection.id]);

            return (
            <div
              key={inspection.id}
              onClick={() => {
                void openInspectionDetails(inspection);
              }}
              className={`group relative overflow-hidden rounded-[24px] border bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(12,19,32,0.95))] p-5 shadow-[0_18px_50px_rgba(2,8,23,0.28)] transition-all hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(2,8,23,0.42)] ${
                highlightedInspectionId === inspection.id
                  ? "border-emerald-400/70 shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_22px_50px_rgba(16,185,129,0.18)]"
                  : "border-white/10 hover:border-cyan-400/30"
              }`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.12),transparent_26%)] opacity-70" />
              <div className="relative space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                        Denetim
                      </span>
                      <span className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-slate-400">
                        {new Date(inspection.created_at).toLocaleDateString("tr-TR")}
                      </span>
                    </div>
                    <h3 className="truncate text-lg font-semibold text-white transition-colors group-hover:text-cyan-200">
                      {inspection.location_name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {inspection.equipment_category || "Ekipman / kategori bilgisi eklenmemiş"}
                    </p>
                    {highlightedInspectionId === inspection.id ? (
                      <span className="mt-3 inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                        Tekli DÖF’ten geldi
                      </span>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-2 text-slate-300 transition-colors group-hover:border-cyan-400/30 group-hover:text-cyan-200">
                    <ChevronRight className="h-5 w-5" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusConfig[inspection.status].color}`}>
                    {statusConfig[inspection.status].icon} {statusConfig[inspection.status].label}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${riskConfig[inspection.risk_level].color}`}>
                    {riskConfig[inspection.risk_level].icon} {riskConfig[inspection.risk_level].label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Kayıt tipi</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{inspection.notes ? "Notlu kayıt" : "Standart kayıt"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Fotoğraf</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{inspection.media_urls?.length || 0} adet</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Aksiyon</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">
                      {inspection.status === "completed" ? "Arşiv" : "İzleme"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Öncelik</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">
                      {inspection.risk_level === "critical" || inspection.risk_level === "high" ? "Yüksek" : "Normal"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Rapor</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">
                      {hasLinkedReport ? "Arşivlendi" : inspection.notes ? "Hazır veri" : "Temel kayıt"}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <FileText className="h-4 w-4 text-cyan-200" />
                      Denetim özeti
                    </div>
                    <span className="text-[11px] font-medium text-slate-500">Kart görünümü</span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">
                    {inspection.notes?.trim() || "Bu kayıtta henüz paylaşılmış saha notu bulunmuyor. Detay görünümünde tam kayıt akışını inceleyebilirsiniz."}
                  </p>
                </div>

                <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.05] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">Sonraki önerilen aksiyon</p>
                  <p className="mt-3 text-sm leading-6 text-slate-200">
                    {getNextActionLabel(inspection)}
                  </p>
                  <Button
                    className="mt-4 h-9 w-full rounded-xl border-0 bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400 text-slate-950"
                    onClick={(e) => {
                      e.stopPropagation();
                      void openInspectionDetails(inspection);
                    }}
                  >
                    {getNextActionButtonLabel(inspection)}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    className="h-10 flex-1 gap-2 rounded-2xl border-0 bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400 text-slate-950"
                    onClick={(e) => {
                      e.stopPropagation();
                      void openInspectionDetails(inspection);
                    }}
                  >
                    {getNextActionButtonLabel(inspection)}
                  </Button>
                  {hasLinkedReport ? (
                    <Button
                      variant="outline"
                      className="h-10 rounded-2xl border-white/10 bg-white/[0.04] px-4 text-slate-100 hover:bg-white/[0.08]"
                      onClick={(e) => {
                        e.stopPropagation();
                        void openInspectionDetails(inspection);
                      }}
                    >
                      Rapor
                    </Button>
                  ) : null}
                </div>

                <Button
                  className="h-10 w-full gap-2 rounded-2xl border-0 bg-white/[0.06] text-slate-100 hover:bg-white/[0.12]"
                  onClick={(e) => {
                    e.stopPropagation();
                    void openInspectionDetails(inspection);
                  }}
                >
                  <Eye className="h-4 w-4" />
                  Detayları Gör
                </Button>
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(10,17,30,0.96))] p-12 text-center shadow-[0_18px_60px_rgba(2,8,23,0.24)]">
          <FileText className="mx-auto h-12 w-12 text-slate-500 opacity-70" />
          <div>
            <p className="text-lg font-semibold text-white">Denetim Bulunamadı</p>
            <p className="mt-2 text-sm text-slate-400">Seçili kriterlere uygun kayıt görünmüyor. Yeni bir denetim oluşturarak akışı başlatabilirsiniz.</p>
          </div>
        </div>
      )}

      {!loading && (
        <div className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-300">
            Sayfa {currentPageLabel} • {visibleCount} kayıt
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} className="rounded-xl border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]">
              Önceki Sayfa
            </Button>
            <Button variant="outline" size="sm" disabled={!hasNextPage} onClick={() => setPage((current) => current + 1)} className="rounded-xl border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]">
              Sonraki Sayfa
            </Button>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {selectedInspection && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all ${
          detailsOpen ? "bg-black/50 backdrop-blur-sm" : "bg-black/0 pointer-events-none"
        }`}>
          <div className={`w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-[28px] border border-cyan-500/20 bg-[linear-gradient(180deg,rgba(9,16,32,0.98),rgba(10,17,30,0.96))] shadow-[0_35px_90px_rgba(2,8,23,0.6)] transition-all ${
            detailsOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}>
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.22),_transparent_28%),linear-gradient(90deg,rgba(8,15,29,0.98),rgba(12,22,36,0.96),rgba(18,24,41,0.95))] p-6 md:p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                      Denetim rapor paneli
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusConfig[selectedInspection.status].color}`}>
                      {statusConfig[selectedInspection.status].icon} {statusConfig[selectedInspection.status].label}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${riskConfig[selectedInspection.risk_level].color}`}>
                      {riskConfig[selectedInspection.risk_level].icon} {riskConfig[selectedInspection.risk_level].label}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-white md:text-[30px]">
                      {selectedInspection.location_name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-300">
                      {new Date(selectedInspection.created_at).toLocaleDateString("tr-TR")} • saha kaydı, rapor bağlantısı ve medya görünümü
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDetailsOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] p-2 text-slate-200 transition-colors hover:bg-white/[0.12]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {detailMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{metric.label}</p>
                    <p className={`mt-2 text-sm font-semibold ${metric.tone}`}>{metric.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6 p-6 md:p-8">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_320px]">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="flex items-center gap-2 text-xs text-slate-400">
                        <MapPin className="h-4 w-4" /> Konum
                      </p>
                      <p className="mt-2 font-semibold text-white">{selectedInspection.location_name}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="flex items-center gap-2 text-xs text-slate-400">
                        <Calendar className="h-4 w-4" /> Tarih
                      </p>
                      <p className="mt-2 font-semibold text-white">
                        {new Date(selectedInspection.created_at).toLocaleDateString("tr-TR")}
                      </p>
                    </div>
                    {selectedInspection.equipment_category && (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs text-slate-400">🔧 Ekipman</p>
                        <p className="mt-2 font-semibold text-white">{selectedInspection.equipment_category}</p>
                      </div>
                    )}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs text-slate-400">📷 Fotoğraf</p>
                      <p className="mt-2 font-semibold text-white">
                        {detailsLoading ? "Hesaplanıyor..." : `${inspectionDetail?.media_urls?.length || 0} adet`}
                      </p>
                    </div>
                  </div>

                  {detailsLoading ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-3">
                      <div className="h-4 w-24 animate-pulse rounded bg-slate-800" />
                      <div className="h-3 w-full animate-pulse rounded bg-slate-900" />
                      <div className="h-3 w-4/5 animate-pulse rounded bg-slate-900" />
                    </div>
                  ) : inspectionDetail?.notes ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                      <div className="flex items-center justify-between">
                        <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                          <FileText className="h-4 w-4 text-cyan-200" /> Saha notları
                        </p>
                        <span className="text-[11px] font-medium text-slate-500">Detay görünümü</span>
                      </div>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                        {inspectionDetail.notes}
                      </p>
                    </div>
                  ) : null}

                  {!detailsLoading && inspectionDetail?.media_urls && inspectionDetail.media_urls.length > 0 && (
                    <div className="space-y-3">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                        <Eye className="h-4 w-4 text-cyan-200" /> Fotoğraflar
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {inspectionDetail.media_urls.map((url, idx) => (
                          <div key={idx} className="overflow-hidden rounded-2xl border border-white/10 aspect-video bg-slate-950/40">
                            <img
                              src={url}
                              alt={`Fotoğraf ${idx + 1}`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-100">Zaman çizelgesi</p>
                      <span className="text-[11px] font-medium text-slate-500">Activity feed</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {activityFeed.map((item, index) => (
                        <div key={`${item.title}-${index}`} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`mt-1 h-3 w-3 rounded-full border ${item.tone}`} />
                            {index < activityFeed.length - 1 ? (
                              <div className="mt-2 h-full min-h-[36px] w-px bg-white/10" />
                            ) : null}
                          </div>
                          <div className={`flex-1 rounded-2xl border p-4 ${item.tone}`}>
                            <p className="text-sm font-semibold">{item.title}</p>
                            <p className="mt-2 text-xs leading-6 text-slate-300">{item.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-200">Önerilen sonraki adım</p>
                    <p className="mt-3 text-sm font-semibold text-slate-100">{getDetailSuggestedAction().title}</p>
                    <p className="mt-2 text-xs leading-6 text-slate-300">
                      {getDetailSuggestedAction().description}
                    </p>
                    <Button
                      className="mt-4 h-9 w-full rounded-xl border-0 bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400 text-slate-950"
                      onClick={getDetailSuggestedAction().onClick}
                      disabled={getDetailSuggestedAction().disabled}
                    >
                      {getDetailSuggestedAction().buttonLabel}
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(34,211,238,0.12),rgba(15,23,42,0.55))] p-5 shadow-[0_18px_40px_rgba(8,145,178,0.12)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">Rapor Merkezi</p>
                        <p className="mt-2 text-base font-semibold text-white">Rapor işlemleri</p>
                      </div>
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium text-cyan-100">
                        {linkedReport?.url ? "Hazır" : "Beklemede"}
                      </span>
                    </div>
                    {loadingLinkedReport ? (
                      <p className="mt-4 text-sm text-slate-300">Rapor bağlantısı kontrol ediliyor...</p>
                    ) : linkedReport?.url ? (
                      <>
                        <p className="mt-4 text-sm font-semibold text-white">{linkedReport.filename}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          Bu denetime bağlı rapor arşivde hazır. Önizleyebilir, cihazınıza indirebilir, paylaşabilir veya gerekli durumda arşivden kaldırabilirsiniz.
                        </p>
                        <div className="mt-5 grid gap-2">
                          <Button size="sm" variant="outline" onClick={openLinkedReport} className="justify-start rounded-xl border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]">
                            <Eye className="mr-2 h-4 w-4" />
                            Rapor Önizleme
                          </Button>
                          <Button size="sm" onClick={downloadLinkedReport} className="justify-start rounded-xl border-0 bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400 text-slate-950">
                            <Download className="mr-2 h-4 w-4" />
                            Word Dosyasını İndir
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="justify-start rounded-xl border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
                            onClick={handleOpenShareModal}
                            disabled={sharePreparing}
                          >
                            {sharePreparing ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Share2 className="mr-2 h-4 w-4" />
                            )}
                            E-posta ile Paylaş
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleDeleteLinkedReport}
                            disabled={deletingLinkedReport}
                            className="justify-start rounded-xl border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                          >
                            {deletingLinkedReport ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Raporu Arşivden Kaldır
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="mt-4 text-sm leading-6 text-slate-300">
                        Bu denetime bağlı arşivlenmiş bir rapor bulunmuyor. Rapor oluşturulduktan sonra önizleme, indirme ve paylaşım işlemleri burada görüntülenir.
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4">
                    <div className="flex gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-200" />
                      <div className="text-sm text-slate-200">
                        <p className="font-semibold">Operasyon notu</p>
                        <p className="mt-2 leading-6 text-slate-300">
                          Denetim detaylarını düzenlemek veya DÖF akışına taşımak için ilgili rapor bağlantısını açabilir, mevcut medya ve notlarla kayıt bütünlüğünü koruyabilirsiniz.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <SendReportModal
        open={sendModalOpen}
        onOpenChange={setSendModalOpen}
        reportType={linkedReport?.kind === "dof" ? "dof" : "inspection"}
        reportUrl={currentReportUrl}
        reportFilename={currentReportFilename}
        companyName={selectedInspection?.location_name || "Denetim"}
      />
    </div>
  );
}


