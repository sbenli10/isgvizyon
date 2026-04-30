import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  AlertTriangle,
  Archive,
  Brain,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSearch,
  FileText,
  Gavel,
  Loader2,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import {
  documentTypeOptions,
  priorityLabelMap,
  type DocumentAnalysisRecord,
  type DocumentAnalysisResult,
  type DocumentAnalysisType,
  type DocumentAnalysisActionItem,
  urgencyLabelMap,
} from "@/lib/documentAnalysisTypes";
import { usePersistentDraft } from "@/hooks/usePersistentDraft";
import { buildStorageObjectRef } from "@/lib/storageObject";

interface CompanyOption {
  id: string;
  name: string;
  address: string | null;
  industry: string | null;
}

const MAX_PDF_OCR_PAGES = 5;
const DOCUMENT_BUCKET = "document-analysis-files";

let pdfJsLoader: Promise<typeof import("pdfjs-dist")> | null = null;
let documentAnalysisPdfLoader: Promise<typeof import("@/lib/documentAnalysisPdfExport")> | null = null;
let documentAnalysisWordLoader: Promise<typeof import("@/lib/documentAnalysisWordExport")> | null = null;

const loadPdfJs = async () => {
  if (!pdfJsLoader) {
    pdfJsLoader = import("pdfjs-dist").then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
      return pdfjsLib;
    });
  }

  return pdfJsLoader;
};

const loadDocumentAnalysisPdf = async () => {
  if (!documentAnalysisPdfLoader) {
    documentAnalysisPdfLoader = import("@/lib/documentAnalysisPdfExport");
  }

  return documentAnalysisPdfLoader;
};

const loadDocumentAnalysisWord = async () => {
  if (!documentAnalysisWordLoader) {
    documentAnalysisWordLoader = import("@/lib/documentAnalysisWordExport");
  }

  return documentAnalysisWordLoader;
};

const db = supabase as any;

const priorityTone: Record<string, string> = {
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  critical: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

const urgencyToInspectionRisk: Record<DocumentAnalysisActionItem["urgency"], "low" | "medium" | "high" | "critical"> = {
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
};

const normalizeRecord = (row: any): DocumentAnalysisRecord => ({
  ...row,
  keyObligations: Array.isArray(row.key_obligations_json) ? row.key_obligations_json : [],
  criticalPoints: Array.isArray(row.critical_points_json) ? row.critical_points_json : [],
  actionItems: Array.isArray(row.action_items_json) ? row.action_items_json : [],
  riskNotes: Array.isArray(row.risk_notes_json) ? row.risk_notes_json : [],
});

const buildAnalysisTitle = (companyName: string | null, fileName: string) =>
  `${companyName || "Firma seçilmedi"} - ${fileName.replace(/\.(pdf|docx)$/i, "")}`;

const safeFileName = (value: string) =>
  value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export default function DocumentAnalysis() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeCompanyId = searchParams.get("companyId") || "";
  const activeDocumentType = (searchParams.get("docType") as DocumentAnalysisType | null) || "legislation";

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(activeCompanyId);
  const [documentType, setDocumentType] = useState<DocumentAnalysisType>(activeDocumentType);
  const [contextNote, setContextNote] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [analysisHistory, setAnalysisHistory] = useState<DocumentAnalysisRecord[]>([]);
  const [currentRecord, setCurrentRecord] = useState<DocumentAnalysisRecord | null>(null);
  const [savingArchive, setSavingArchive] = useState(false);
  const [creatingAction, setCreatingAction] = useState<null | "capa" | "inspection" | "report-pdf" | "report-word">(null);
  const [restoredDraftLabel, setRestoredDraftLabel] = useState<string | null>(null);

  const { clearDraft } = usePersistentDraft({
    key: `document-analysis:${profile?.organization_id || "no-org"}:${user?.id || "guest"}:${activeCompanyId || "no-company"}`,
    enabled: Boolean(user?.id),
    version: 1,
    value: {
      selectedCompanyId,
      documentType,
      contextNote,
    },
    onRestore: (draft) => {
      setSelectedCompanyId(draft.selectedCompanyId || activeCompanyId);
      setDocumentType((draft.documentType as DocumentAnalysisType) || "legislation");
      setContextNote(draft.contextNote || "");
      setRestoredDraftLabel("Belge analiz taslağı");
      toast.info("Kaydedilmemiş taslak geri yüklendi.", {
        description: "Belge tekrar seçilmelidir; dosyalar tarayıcıda taslak olarak saklanmaz.",
      });
    },
  });

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) || null,
    [companies, selectedCompanyId],
  );

  useEffect(() => {
    if (!user?.id) return;
    void Promise.all([loadCompanies(), loadHistory()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedCompanyId) {
      next.set("companyId", selectedCompanyId);
    } else {
      next.delete("companyId");
    }
    next.set("docType", documentType);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [documentType, searchParams, selectedCompanyId, setSearchParams]);

  const loadCompanies = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("companies")
      .select("id,name,address,industry")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      toast.error("Firma listesi yüklenemedi.");
      return;
    }

    setCompanies((data as CompanyOption[]) || []);
    if (!selectedCompanyId && activeCompanyId) {
      setSelectedCompanyId(activeCompanyId);
    }
  };

  const loadHistory = async () => {
    if (!user?.id) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await db
        .from("document_analyses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) throw error;
      const normalized = ((data || []) as any[]).map(normalizeRecord);
      setAnalysisHistory(normalized);
      setCurrentRecord((prev) => prev || normalized[0] || null);
    } catch (error) {
      console.error("Document analyses load failed:", error);
      toast.error("Belge analiz geçmişi yüklenemedi.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const openPdfDocument = async (file: File) => {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    return pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      isEvalSupported: false,
      useWorkerFetch: false,
    } as any).promise;
  };

  const extractPdfTextDirect = async (file: File) => {
    const pdf = await openPdfDocument(file);
    let text = "";
    for (let index = 1; index <= pdf.numPages; index += 1) {
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(" ") + "\n";
    }
    return text.trim();
  };

  const renderPdfPagesForOcr = async (file: File) => {
    const pdf = await openPdfDocument(file);
    const pageCount = Math.min(pdf.numPages, MAX_PDF_OCR_PAGES);
    const renderedPages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) throw new Error("PDF sayfası OCR için hazırlanamadı.");

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      renderedPages.push(canvas.toDataURL("image/jpeg", 0.82));
    }

    return renderedPages;
  };

  const extractPdfText = async (file: File) => {
    try {
      const text = await extractPdfTextDirect(file);
      if (text) return text;
      throw new Error("PDF içinde seçilebilir metin bulunamadı.");
    } catch {
      toast.info(`${file.name} taranmış PDF olabilir, OCR ile okunuyor...`, { duration: 5000 });
      const images = await renderPdfPagesForOcr(file);
      const { data, error } = await supabase.functions.invoke("extract-pdf-ocr", {
        body: {
          fileName: file.name,
          images,
          languageHints: ["tr", "en"],
        },
      });

      if (error) throw new Error(error.message);
      const text = typeof data?.text === "string" ? data.text.trim() : "";
      if (!text) throw new Error(data?.message || "OCR metin çıkaramadı.");
      return text;
    }
  };

  const extractWordText = async (file: File) => {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  };

  const extractDocumentText = async (file: File) => {
    return file.type === "application/pdf" ? extractPdfText(file) : extractWordText(file);
  };

  const uploadSourceFile = async (file: File) => {
    if (!user?.id) throw new Error("Dosya yüklemek için oturum gerekli.");
    const filePath = `${user.id}/${selectedCompanyId || "no-company"}/${Date.now()}-${safeFileName(file.name)}`;
    const { error } = await supabase.storage.from(DOCUMENT_BUCKET).upload(filePath, file, { upsert: false });
    if (error) throw error;
    return { filePath, publicUrl: buildStorageObjectRef(DOCUMENT_BUCKET, filePath) };
  };

  const persistAnalysis = async (payload: DocumentAnalysisResult & { rawText: string; file: File; fileUrl: string; filePath: string }) => {
    if (!user?.id) throw new Error("Analiz kaydı için oturum gerekli.");

    const title = buildAnalysisTitle(selectedCompany?.name || null, payload.file.name);
    const { data, error } = await db
      .from("document_analyses")
      .insert({
        user_id: user.id,
        org_id: profile?.organization_id || null,
        company_id: selectedCompany?.id || null,
        company_name: selectedCompany?.name || null,
        title,
        document_type: documentType,
        source_file_name: payload.file.name,
        source_file_url: payload.fileUrl,
        source_file_path: payload.filePath,
        mime_type: payload.file.type,
        file_size_bytes: payload.file.size,
        raw_text: payload.rawText,
        summary: payload.summary,
        key_obligations_json: payload.keyObligations,
        critical_points_json: payload.criticalPoints,
        action_items_json: payload.actionItems,
        risk_notes_json: payload.riskNotes,
        status: "completed",
      })
      .select("*")
      .single();

    if (error) throw error;
    return normalizeRecord(data);
  };

  const createActionLog = async (analysisId: string, actionType: "capa" | "inspection" | "archive" | "report", targetId: string | null, targetLabel: string, metadata: Record<string, unknown> = {}) => {
    if (!user?.id) return;
    await db.from("document_analysis_actions").insert({
      analysis_id: analysisId,
      user_id: user.id,
      org_id: profile?.organization_id || null,
      action_type: actionType,
      target_id: targetId,
      target_label: targetLabel,
      metadata,
    });
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast.error("Önce PDF veya DOCX belge yükleyin.");
      return;
    }

    if (!selectedCompanyId) {
      toast.error("Analizi firma ile bağlamak için önce firma seçin.");
      return;
    }

    setAnalyzing(true);

    try {
      toast.info("Belge metni okunuyor...");
      const text = await extractDocumentText(selectedFile);
      if (!text) {
        throw new Error("Belgeden okunabilir içerik çıkarılamadı.");
      }

      const upload = await uploadSourceFile(selectedFile);
      toast.info("AI belge analizi oluşturuluyor...");

      const { data, error } = await supabase.functions.invoke("analyze-document-obligations", {
        body: {
          companyName: selectedCompany?.name || null,
          documentType,
          fileName: selectedFile.name,
          text,
          contextNote,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.success === false) throw new Error(data?.error?.message || "Belge analizi başarısız oldu.");

      const result = data?.result as DocumentAnalysisResult | undefined;
      if (!result) throw new Error("Sunucudan analiz sonucu alınamadı.");

      const savedRecord = await persistAnalysis({
        ...result,
        rawText: text,
        file: selectedFile,
        fileUrl: upload.publicUrl,
        filePath: upload.filePath,
      });

      clearDraft();
      setRestoredDraftLabel(null);
      setCurrentRecord(savedRecord);
      setAnalysisHistory((prev) => [savedRecord, ...prev.filter((item) => item.id !== savedRecord.id)].slice(0, 12));
      toast.success("Mevzuat belge analizi hazır.");
    } catch (error: any) {
      console.error("Document analysis failed:", error);
      toast.error(error?.message || "Belge analizi sırasında bir hata oluştu.");
    } finally {
      setAnalyzing(false);
    }
  };

  const buildCapaPriority = (record: DocumentAnalysisRecord) => {
    const maxPriority = record.keyObligations.some((item) => item.priority === "critical")
      ? "Kritik"
      : record.keyObligations.some((item) => item.priority === "high")
      ? "Yüksek"
      : record.keyObligations.some((item) => item.priority === "medium")
      ? "Orta"
      : "Düşük";
    return maxPriority;
  };

  const handleCreateCapa = async () => {
    if (!currentRecord || !user?.id) return;
    if (!profile?.organization_id) {
      toast.error("DÖF oluşturmak için profilinizde organizasyon bağlantısı gerekli.");
      return;
    }

    setCreatingAction("capa");
    try {
      const correctiveAction = currentRecord.actionItems.map((item, index) => `${index + 1}. ${item.title} - ${item.description}`).join("\n");
      const rootCause = currentRecord.criticalPoints.map((item) => item.title).join(", ") || "Belgede kritik uyum boşlukları tespit edildi";
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 14);

      const { data, error } = await supabase.from("capa_records").insert({
        user_id: user.id,
        org_id: profile.organization_id,
        non_conformity: currentRecord.summary,
        root_cause: rootCause,
        corrective_action: correctiveAction,
        assigned_person: user.email || "İSGVizyon kullanıcısı",
        deadline: deadline.toISOString().slice(0, 10),
        status: "Açık",
        priority: buildCapaPriority(currentRecord),
        notes: `Belge: ${currentRecord.source_file_name}\nFirma: ${currentRecord.company_name || "-"}\n\nÖne çıkan yükümlülükler:\n${currentRecord.keyObligations.map((item, index) => `${index + 1}. ${item.title}`).join("\n")}`,
        document_urls: currentRecord.source_file_path
          ? [buildStorageObjectRef(DOCUMENT_BUCKET, currentRecord.source_file_path)]
          : currentRecord.source_file_url
            ? [currentRecord.source_file_url]
            : [],
      }).select("id").single();

      if (error) throw error;
      await createActionLog(currentRecord.id, "capa", data?.id || null, "DÖF oluşturuldu", {
        companyId: currentRecord.company_id,
        companyName: currentRecord.company_name,
      });
      toast.success("Belge analizinden DÖF kaydı oluşturuldu.");
      navigate("/capa");
    } catch (error: any) {
      toast.error(error?.message || "DÖF oluşturulamadı.");
    } finally {
      setCreatingAction(null);
    }
  };

  const handleCreateInspection = async () => {
    if (!currentRecord || !user?.id) return;
    if (!profile?.organization_id) {
      toast.error("Denetime eklemek için profilinizde organizasyon bağlantısı gerekli.");
      return;
    }

    setCreatingAction("inspection");
    try {
      const topUrgency = currentRecord.actionItems.some((item) => item.urgency === "critical")
        ? "critical"
        : currentRecord.actionItems.some((item) => item.urgency === "high")
        ? "high"
        : currentRecord.actionItems.some((item) => item.urgency === "medium")
        ? "medium"
        : "low";

      const { data, error } = await supabase.from("inspections").insert({
        user_id: user.id,
        org_id: profile.organization_id,
        location_name: currentRecord.company_name || currentRecord.title,
        equipment_category: "Mevzuat Belge Analizi",
        notes: `Belge özeti:\n${currentRecord.summary}\n\nKontrol/checklist maddeleri:\n${currentRecord.keyObligations.map((item, index) => `${index + 1}. ${item.title} - ${item.description}`).join("\n")}`,
        risk_level: urgencyToInspectionRisk[topUrgency],
        risk_definition: currentRecord.criticalPoints.map((item) => item.title).join(", "),
        corrective_action: currentRecord.actionItems.map((item) => item.title).join(" / "),
        preventive_action: currentRecord.actionItems.map((item) => item.description).join("\n"),
        status: "draft",
      }).select("id").single();

      if (error) throw error;
      await createActionLog(currentRecord.id, "inspection", data?.id || null, "Denetime eklendi", {
        companyId: currentRecord.company_id,
        companyName: currentRecord.company_name,
      });
      toast.success("Belge analizi denetim/checklist kaydına dönüştürüldü.");
      navigate("/inspections", { state: { focusInspectionId: data?.id } });
    } catch (error: any) {
      toast.error(error?.message || "Denetim kaydı oluşturulamadı.");
    } finally {
      setCreatingAction(null);
    }
  };

  const handleArchive = async () => {
    if (!currentRecord || !user?.id) return;
    if (currentRecord.archived_to_library) {
      toast.info("Bu analiz zaten firma arşivine kaydedildi.");
      return;
    }

    setSavingArchive(true);
    try {
      const { data: collection, error: collectionError } = await supabase
        .from("library_collections")
        .select("id")
        .eq("slug", "internal-archive")
        .maybeSingle();

      if (collectionError) throw collectionError;
      if (!collection?.id) throw new Error("Kurum içi arşiv koleksiyonu bulunamadı.");

      const { data: archiveItem, error: archiveError } = await supabase.from("library_items").insert({
        collection_id: collection.id,
        title: currentRecord.title,
        summary: currentRecord.summary,
        body: `${currentRecord.summary}\n\nKritik yükümlülükler:\n${currentRecord.keyObligations.map((item, index) => `${index + 1}. ${item.title} - ${item.description}`).join("\n")}`,
        item_type: "archive_document",
        audience: "İSG uzmanı ve operasyon ekibi",
        sector: selectedCompany?.industry || null,
        source_name: "Mevzuat Belge Analizi",
        source_url: currentRecord.source_file_path
          ? buildStorageObjectRef(DOCUMENT_BUCKET, currentRecord.source_file_path)
          : currentRecord.source_file_url,
        file_url: currentRecord.source_file_path
          ? buildStorageObjectRef(DOCUMENT_BUCKET, currentRecord.source_file_path)
          : currentRecord.source_file_url,
        tags: ["mevzuat", "uyum", "belge-analizi"],
        metadata: {
          companyId: currentRecord.company_id,
          companyName: currentRecord.company_name,
          analysisId: currentRecord.id,
          documentType: currentRecord.document_type,
        },
        created_by: user.id,
      }).select("id").single();

      if (archiveError) throw archiveError;

      const { data, error } = await db
        .from("document_analyses")
        .update({
          archived_to_library: true,
          status: "archived",
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentRecord.id)
        .select("*")
        .single();

      if (error) throw error;
      const normalized = normalizeRecord(data);
      setCurrentRecord(normalized);
      setAnalysisHistory((prev) => prev.map((item) => (item.id === normalized.id ? normalized : item)));
      await createActionLog(currentRecord.id, "archive", archiveItem?.id || null, "Firma arşivine kaydedildi");
      toast.success("Analiz Safety Library kurum içi arşivine kaydedildi.");
    } catch (error: any) {
      toast.error(error?.message || "Firma arşivine kaydedilemedi.");
    } finally {
      setSavingArchive(false);
    }
  };

  const handleExportPdf = async () => {
    if (!currentRecord) return;
    setCreatingAction("report-pdf");
    try {
      const { generateDocumentAnalysisPdf } = await loadDocumentAnalysisPdf();
      await generateDocumentAnalysisPdf(currentRecord);
      await createActionLog(currentRecord.id, "report", currentRecord.id, "PDF raporu indirildi", { format: "pdf" });
      toast.success("PDF raporu hazırlandı.");
    } catch (error: any) {
      toast.error(error?.message || "PDF raporu hazırlanamadı.");
    } finally {
      setCreatingAction(null);
    }
  };

  const handleExportWord = async () => {
    if (!currentRecord) return;
    setCreatingAction("report-word");
    try {
      const { generateDocumentAnalysisWord } = await loadDocumentAnalysisWord();
      await generateDocumentAnalysisWord(currentRecord);
      await createActionLog(currentRecord.id, "report", currentRecord.id, "Word raporu indirildi", { format: "word" });
      toast.success("Word raporu hazırlandı.");
    } catch (error: any) {
      toast.error(error?.message || "Word raporu hazırlanamadı.");
    } finally {
      setCreatingAction(null);
    }
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Gavel className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Mevzuat Belge Analizi</h1>
              <p className="text-sm text-slate-400">
                PDF ve DOCX belgeleri okuyup belge özeti, kritik yükümlülükler, dikkat gerektiren maddeler ve uygulanabilir aksiyon önerileri üretin.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          Bu modül belgeyi sadece özetlemez; sonucu DÖF, denetim, rapor ve firma arşivine bağlar.
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Belge Yükle ve Analiz Et</CardTitle>
            <CardDescription>
              Firma seçin, belge tipini belirleyin ve AI analizi oluşturun. İlk sürümde tek belge üzerinden ilerlenir.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {restoredDraftLabel ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-cyan-50 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">{restoredDraftLabel} geri yüklendi</p>
                  <p className="mt-1 text-sm text-cyan-100/80">Belge hariç kaydedilmemiş alanlar otomatik olarak geri getirildi.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    clearDraft();
                    setRestoredDraftLabel(null);
                    setContextNote("");
                  }}
                  className="border-cyan-300/30 bg-transparent text-cyan-50 hover:bg-cyan-400/10"
                >
                  Taslağı temizle
                </Button>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Firma</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Firma seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Belge tipi</Label>
                <Select value={documentType} onValueChange={(value) => setDocumentType(value as DocumentAnalysisType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypeOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Belge</Label>
              <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setSelectedFile(file);
                    if (event.currentTarget) event.currentTarget.value = "";
                  }}
                />
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">PDF / DOCX yükleyin</p>
                    <p className="text-xs text-slate-400">
                      Taranmış PDF ise OCR ile okunur. Belge seçildikten sonra AI; özet, yükümlülük ve aksiyon önerileri çıkarır.
                    </p>
                  </div>
                  <Button type="button" onClick={() => fileInputRef.current?.click()} className="gap-2">
                    <Upload className="h-4 w-4" />
                    Belge Seç
                  </Button>
                </div>
                {selectedFile ? (
                  <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-3 text-sm text-slate-200">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="truncate">{selectedFile.name}</span>
                      </div>
                      <span className="text-xs text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ek bağlam notu</Label>
              <Textarea
                value={contextNote}
                onChange={(event) => setContextNote(event.target.value)}
                placeholder="Örn: Bu belgeyi firmanın elektrik bakım süreci için inceliyorum. Kritik yükümlülükleri ve sahaya aktarılacak aksiyonları önceliklendir."
                className="min-h-[110px]"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Belge Özeti</p>
                <p className="mt-2 text-sm text-slate-200">AI belgeyi yöneticinin hızlıca anlayacağı şekilde özetler.</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Kritik Yükümlülükler</p>
                <p className="mt-2 text-sm text-slate-200">Uygulanması gereken maddeler önceliğe göre ayrılır.</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Dikkat Noktaları</p>
                <p className="mt-2 text-sm text-slate-200">Eksik kalırsa risk yaratacak kritik alanlar işaretlenir.</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Aksiyonlar</p>
                <p className="mt-2 text-sm text-slate-200">DÖF, denetim ve arşiv akışına uygun öneriler üretilir.</p>
              </div>
            </div>

            <Button onClick={handleAnalyze} disabled={analyzing} className="h-12 w-full gap-2 text-base font-semibold">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              AI Analizi Oluştur
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Sonuç Ekranı</CardTitle>
            <CardDescription>
              Sol tarafta belge özeti ve kritik maddeler, sağ tarafta aksiyonlar ve çıktı seçenekleri yer alır.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentRecord ? (
              <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Belge Özeti</p>
                        <h3 className="mt-2 text-xl font-bold text-white">{currentRecord.title}</h3>
                        <p className="mt-2 text-sm leading-7 text-slate-300">{currentRecord.summary}</p>
                      </div>
                      <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                        {documentTypeOptions.find((item) => item.value === currentRecord.document_type)?.label}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-amber-300" />
                      <h3 className="text-lg font-semibold text-white">Kritik Yükümlülükler</h3>
                    </div>
                    <div className="space-y-3">
                      {currentRecord.keyObligations.map((item, index) => (
                        <div key={`${item.title}-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-white">{item.title}</p>
                              <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
                              {item.legalBasis ? (
                                <p className="mt-2 text-xs text-slate-400">Dayanak: {item.legalBasis}</p>
                              ) : null}
                            </div>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${priorityTone[item.priority] || priorityTone.low}`}>
                              {priorityLabelMap[item.priority]}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-300" />
                      <h3 className="text-lg font-semibold text-white">Dikkat Gerektiren Maddeler</h3>
                    </div>
                    <div className="space-y-3">
                      {currentRecord.criticalPoints.map((item, index) => (
                        <div key={`${item.title}-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                          <p className="font-medium text-white">{item.title}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
                          {item.whyItMatters ? (
                            <p className="mt-2 text-xs text-slate-400">Neden önemli: {item.whyItMatters}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h3 className="text-lg font-semibold text-white">Uygulanabilir Aksiyonlar</h3>
                    </div>
                    <div className="space-y-3">
                      {currentRecord.actionItems.map((item, index) => (
                        <div key={`${item.title}-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-white">{item.title}</p>
                              <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
                              <p className="mt-2 text-xs text-slate-400">
                                Önerilen modül: {item.suggestedModule === "capa" ? "DÖF" : item.suggestedModule === "inspection" ? "Denetim" : item.suggestedModule === "archive" ? "Arşiv" : "Rapor"}
                              </p>
                            </div>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${priorityTone[item.urgency] || priorityTone.low}`}>
                              {urgencyLabelMap[item.urgency]}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-cyan-300" />
                      <h3 className="text-lg font-semibold text-white">Aksiyon Merkezi</h3>
                    </div>
                    <div className="grid gap-3">
                      <Button onClick={handleCreateCapa} disabled={creatingAction !== null} className="justify-start gap-2">
                        {creatingAction === "capa" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                        DÖF oluştur
                      </Button>
                      <Button variant="outline" onClick={handleCreateInspection} disabled={creatingAction !== null} className="justify-start gap-2">
                        {creatingAction === "inspection" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                        Denetime ekle
                      </Button>
                      <Button variant="outline" onClick={handleExportPdf} disabled={creatingAction !== null} className="justify-start gap-2">
                        {creatingAction === "report-pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        Rapor olarak indir (PDF)
                      </Button>
                      <Button variant="outline" onClick={handleExportWord} disabled={creatingAction !== null} className="justify-start gap-2">
                        {creatingAction === "report-word" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                        Rapor olarak indir (Word)
                      </Button>
                      <Button variant="secondary" onClick={handleArchive} disabled={savingArchive} className="justify-start gap-2">
                        {savingArchive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                        Firma arşivine kaydet
                      </Button>
                    </div>
                    <Separator className="my-4 bg-slate-800" />
                    <div className="space-y-3 text-sm text-slate-300">
                      <div className="flex items-start gap-2">
                        <Building2 className="mt-0.5 h-4 w-4 text-slate-500" />
                        <div>
                          <p className="font-medium text-white">Firma bağlantısı</p>
                          <p>{currentRecord.company_name || "Bağlanmadı"}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <FileSearch className="mt-0.5 h-4 w-4 text-slate-500" />
                        <div>
                          <p className="font-medium text-white">Kaynak belge</p>
                          <p className="break-all">{currentRecord.source_file_name}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-slate-500" />
                        <div>
                          <p className="font-medium text-white">Arşiv durumu</p>
                          <p>{currentRecord.archived_to_library ? "Safety Library arşivine kaydedildi" : "Henüz arşive alınmadı"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-8 text-center text-slate-400">
                İlk analiz sonucunuz burada görünecek. Belgeyi yükleyip AI analizi oluşturun.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-white">Son Analizler</CardTitle>
          <CardDescription>
            Belgeler firma bazlı hafızada tutulur; tekrar rapor alabilir, DÖF veya denetim akışına yeniden bağlayabilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
              Analiz geçmişi yükleniyor...
            </div>
          ) : analysisHistory.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
              Henüz kayıtlı bir belge analizi yok.
            </div>
          ) : (
            <div className="grid gap-3">
              {analysisHistory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentRecord(item)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    currentRecord?.id === item.id
                      ? "border-primary/30 bg-primary/10"
                      : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {item.company_name || "Firma yok"} • {documentTypeOptions.find((option) => option.value === item.document_type)?.label}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">{item.summary}</p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-slate-400">
                      <p>{new Date(item.created_at).toLocaleDateString("tr-TR")}</p>
                      <p className="mt-1">{item.archived_to_library ? "Arşivlendi" : "Aktif analiz"}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
