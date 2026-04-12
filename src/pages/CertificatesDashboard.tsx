import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Award,
  Building2,
  Download,
  Eye,
  FileArchive,
  FileSpreadsheet,
  Palette,
  History,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { createCertificate, generateCertificateJob, getCertificateDownload, getCertificateStatus } from "@/lib/certificateApi";
import { createCertificateExcelTemplate, parseCertificateParticipantsExcel } from "@/lib/certificateExcel";
import { CertificatePreviewCard } from "@/components/certificates/CertificatePreviewCard";
import type { CertificateDesignConfig, CertificateFormValues, CertificateJobItem, CertificateJobRecord, CertificateParticipantInput, CertificateRecord } from "@/types/certificates";
import type { Company } from "@/types/companies";

const defaultForm: CertificateFormValues = {
  company_id: null,
  company_name: "",
  company_address: "",
  company_phone: "",
  training_name: "Temel İş Sağlığı ve Güvenliği Eğitimi",
  training_date: new Date().toISOString().slice(0, 10),
  training_duration: "8 Saat",
  certificate_type: "Katılım",
  validity_date: "",
  logo_url: "",
  template_type: "classic",
  frame_style: "gold",
  trainer_names: [""],
  notes: "",
  design_config: {
    primaryColor: "#d4af37",
    secondaryColor: "#294d77",
    fontFamily: "serif",
    showBadge: true,
    showSeal: true,
    titleText: "",
    descriptionText: "",
    osgb_logo_url: "",
    signatureCount: 4,
    signatures: [
      { name: "", title: "İSG Uzmanı" },
      { name: "", title: "İşyeri Hekimi" },
      { name: "", title: "İşveren Vekili" },
      { name: "", title: "OSGB Yetkilisi" },
    ],
  },
};

const templateCards = [
  { value: "classic", title: "Prestij Klasik", text: "Geleneksel çerçeve, resmi görünüm ve sade kurumsal yerleşim" },
  { value: "academy", title: "Akademi Mavi", text: "Mavi-gold üst bant, mühür hissi ve resmi eğitim belgesi kompozisyonu" },
  { value: "executive", title: "Yönetici Altın", text: "Üst düzey teslimler için daha seçkin, premium ve davetiye benzeri sertifika yapısı" },
  { value: "compliance", title: "Mevzuat Uyum", text: "OSGB ve İSG eğitimleri için bilgi yoğun, düzenli ve denetim dostu resmi düzen" },
  { value: "modern", title: "Kurumsal Modern", text: "Çağdaş görünüm, yüksek kontrast ve dijital teslim odaklı premium tasarım" },
  { value: "minimal", title: "Minimal Baskı", text: "Temiz çizgiler, sade tipografi ve hızlı baskı için dengeli görünüm" },
] as const;

function getJobStatusMeta(job: CertificateJobRecord | null, participantCount: number) {
  if (!job || job.status === "draft") {
    return {
      label: "Taslak hazır",
      tone: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-200",
      summary: "Sertifika kaydı hazır, ancak üretim henüz başlatılmadı.",
      detail: participantCount > 0
        ? "Katılımcılar eklendi. Şimdi toplu üretimi başlatabilirsiniz."
        : "Önce katılımcı ekleyin, ardından üretimi başlatın.",
    };
  }

  if (job.status === "queued") {
    return {
      label: "Kuyrukta bekliyor",
      tone: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      summary: "Üretim işi worker kuyruğuna başarıyla alındı.",
      detail: "PDF üretimi kısa süre içinde otomatik başlayacak.",
    };
  }

  if (job.status === "processing") {
    return {
      label: "Üretim sürüyor",
      tone: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      summary: "Katılımcı sertifikaları şu anda üretiliyor.",
      detail: "İlerleme oranı üretim tamamlandıkça otomatik güncellenir.",
    };
  }

  if (job.status === "processing_with_errors") {
    return {
      label: "Üretim sürüyor, bazı kayıtlar hatalı",
      tone: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
      summary: "Üretim devam ediyor ancak bazı katılımcılarda veri veya üretim hatası oluştu.",
      detail: "Detay sayfasından hatalı kayıtları inceleyip tekrar basım başlatabilirsiniz.",
    };
  }

  if (job.status === "completed") {
    return {
      label: "Üretim tamamlandı",
      tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      summary: "Tüm sertifikalar başarıyla üretildi.",
      detail: job.zip_path
        ? "ZIP dosyası hazır. Tekli PDF veya toplu ZIP indirebilirsiniz."
        : "PDF üretimi tamamlandı. ZIP paketi hazırlanıyor olabilir.",
    };
  }

  if (job.status === "completed_with_errors") {
    return {
      label: "Kısmen tamamlandı",
      tone: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
      summary: "Bazı sertifikalar üretildi, bazı katılımcılarda hata kaldı.",
      detail: job.zip_path
        ? "Hazır dosyaları ZIP olarak indirebilir, hatalı kayıtları ayrıca düzeltebilirsiniz."
        : "Başarılı kayıtlar oluştu. ZIP paketi hazırlanırken hatalı kayıtları kontrol edin.",
    };
  }

  if (job.status === "failed") {
    return {
      label: "Üretim başarısız",
      tone: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
      summary: "Hiçbir sertifika başarıyla üretilemedi.",
      detail: job.error_message || "Katılımcı verilerini ve worker loglarını kontrol edin.",
    };
  }

  return {
    label: "İşlem başarısız",
    tone: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
    summary: "Üretim tamamlanamadı.",
    detail: job.error_message || "Lütfen kayıtları kontrol edip tekrar deneyin.",
  };
}


function toDisplayText(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const candidate = (value as Record<string, unknown>).name;
    return typeof candidate === "string" ? candidate : "";
  }
  return "";
}

function buildDefaultDesignConfig(trainerNames: string[] = [], companyName = ""): CertificateDesignConfig {
  return {
    primaryColor: "#d4af37",
    secondaryColor: "#294d77",
    fontFamily: "serif",
    showBadge: true,
    showSeal: true,
    titleText: "",
    descriptionText: "",
    osgb_logo_url: "",
    signatureCount: 4,
    signatures: [
      { name: trainerNames[0] || "", title: "İSG Uzmanı" },
      { name: trainerNames[1] || "", title: "İşyeri Hekimi" },
      { name: companyName || "", title: "İşveren Vekili" },
      { name: "OSGB Yetkilisi", title: "Düzenleyen Birim" },
    ],
  };
}

function normalizeDesignConfig(value: unknown, trainerNames: string[] = [], companyName = ""): CertificateDesignConfig {
  const source = value && typeof value === "object" ? (value as Partial<CertificateDesignConfig>) : {};
  const defaults = buildDefaultDesignConfig(trainerNames, companyName);
  const rawSignatures = Array.isArray(source.signatures) ? source.signatures : defaults.signatures;
  const signatures: CertificateSignatureConfig[] = rawSignatures.slice(0, 4).map((signature, index) => ({
    name: typeof signature?.name === "string" ? signature.name : defaults.signatures[index]?.name || "",
    title: typeof signature?.title === "string" ? signature.title : defaults.signatures[index]?.title || "",
    image_url: typeof signature?.image_url === "string" ? signature.image_url : "",
  }));

  while (signatures.length < 4) {
    signatures.push(defaults.signatures[signatures.length]);
  }

  return {
    primaryColor: typeof source.primaryColor === "string" ? source.primaryColor : defaults.primaryColor,
    secondaryColor: typeof source.secondaryColor === "string" ? source.secondaryColor : defaults.secondaryColor,
    fontFamily: source.fontFamily === "sans" || source.fontFamily === "gothic" ? source.fontFamily : defaults.fontFamily,
    showBadge: typeof source.showBadge === "boolean" ? source.showBadge : defaults.showBadge,
    showSeal: typeof source.showSeal === "boolean" ? source.showSeal : defaults.showSeal,
    titleText: typeof source.titleText === "string" ? source.titleText : defaults.titleText,
    descriptionText: typeof source.descriptionText === "string" ? source.descriptionText : defaults.descriptionText,
    osgb_logo_url: typeof source.osgb_logo_url === "string" ? source.osgb_logo_url : defaults.osgb_logo_url,
    signatureCount: Math.min(4, Math.max(1, Number(source.signatureCount || defaults.signatureCount))),
    signatures,
  };
}

function readStudioPreset(): CertificateFormValues | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("certificate-studio-preset");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CertificateFormValues>;
    return {
      ...defaultForm,
      ...parsed,
      trainer_names: Array.isArray(parsed.trainer_names) ? parsed.trainer_names : defaultForm.trainer_names,
      design_config: normalizeDesignConfig(parsed.design_config, Array.isArray(parsed.trainer_names) ? parsed.trainer_names : defaultForm.trainer_names, parsed.company_name || defaultForm.company_name),
    };
  } catch {
    return null;
  }
}

export default function CertificatesDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState<CertificateFormValues>(() => readStudioPreset() || defaultForm);
  const [participants, setParticipants] = useState<CertificateParticipantInput[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [recentCertificates, setRecentCertificates] = useState<CertificateRecord[]>([]);
  const [activeCertificate, setActiveCertificate] = useState<CertificateRecord | null>(null);
  const [activeJob, setActiveJob] = useState<CertificateJobRecord | null>(null);
  const [jobItems, setJobItems] = useState<CertificateJobItem[]>([]);
  const [selectedPdfParticipantId, setSelectedPdfParticipantId] = useState("");
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deletingCertificateId, setDeletingCertificateId] = useState<string | null>(null);
  const [employeeLoadState, setEmployeeLoadState] = useState<"idle" | "loaded" | "empty">("idle");
  const [employeeLoadMessage, setEmployeeLoadMessage] = useState("");
  const [trainerNamesInput, setTrainerNamesInput] = useState(defaultForm.trainer_names.join(", "));
  const studioSectionRef = useRef<HTMLDivElement | null>(null);
  const currentTab = searchParams.get("tab") === "templates" ? "templates" : "production";

  const completedItems = useMemo(
    () => jobItems.filter((item) => item.status === "completed" && item.pdf_path),
    [jobItems]
  );
  const previewParticipant = participants[0];
  const jobStatusMeta = useMemo(() => getJobStatusMeta(activeJob, participants.length), [activeJob, participants.length]);
  const previewForm = useMemo(
    () => ({
      ...form,
      logo_url: logoPreviewUrl || form.logo_url || "",
      design_config: normalizeDesignConfig(form.design_config, form.trainer_names, form.company_name),
    }),
    [form, logoPreviewUrl]
  );

  const syncStoredPreview = useCallback(async (logoValue: string | undefined, setter: (value: string) => void) => {
    const nextValue = (logoValue || "").trim();
    if (!nextValue) {
      setter("");
      return;
    }

    if (/^https?:\/\//i.test(nextValue)) {
      setter(nextValue);
      return;
    }

    const companyLogoResult = await supabase.storage.from("company-logos").createSignedUrl(nextValue, 3600);
    if (!companyLogoResult.error && companyLogoResult.data?.signedUrl) {
      setter(companyLogoResult.data.signedUrl);
      return;
    }

    const certificateLogoResult = await supabase.storage.from("certificate-files").createSignedUrl(nextValue, 3600);
    if (!certificateLogoResult.error && certificateLogoResult.data?.signedUrl) {
      setter(certificateLogoResult.data.signedUrl);
      return;
    }

    setter("");
  }, []);

  const syncLogoPreview = useCallback(async (logoValue?: string) => {
    await syncStoredPreview(logoValue, setLogoPreviewUrl);
  }, [syncStoredPreview]);

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    void syncLogoPreview(form.logo_url);
  }, [form.logo_url, syncLogoPreview]);

  useEffect(() => {
    if (!activeCertificate || !activeJob) return;
    if (!["queued", "processing", "processing_with_errors", "completed", "completed_with_errors"].includes(activeJob.status)) return;
    const interval = window.setInterval(() => {
      void refreshJobStatus(activeCertificate.id);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [activeCertificate, activeJob]);

  useEffect(() => {
    if (!selectedPdfParticipantId && completedItems[0]?.participant_id) {
      setSelectedPdfParticipantId(completedItems[0].participant_id);
    }
  }, [completedItems, selectedPdfParticipantId]);

  useEffect(() => {
    if (currentTab === "templates") {
      studioSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [currentTab]);

  async function bootstrap() {
    setLoading(true);
    try {
      await Promise.all([loadCompanies(), loadRecentCertificates()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCompanies() {
    const { data, error } = await (supabase as any).from("companies").select("*").eq("is_active", true).order("created_at", { ascending: false });
    if (error) throw error;
    const mapped = (data || []).map((item: any) => ({ ...item, owner_id: item.user_id, company_name: item.name, nace_code: item.industry || "", hazard_class: item.hazard_class || "Az Tehlikeli" }));
    setCompanies(mapped);
  }

  async function loadRecentCertificates() {
    const { data, error } = await (supabase as any).from("certificates").select("*").order("created_at", { ascending: false }).limit(12);
    if (error) throw error;
    setRecentCertificates(data || []);
  }

  async function refreshJobStatus(certificateId: string) {
    try {
      const statusPayload = await getCertificateStatus(certificateId);
      setActiveJob(statusPayload.job);
      setJobItems(statusPayload.items || []);
    } catch (error: any) {
      console.error("Sertifika durumu alınamadı:", error);
    }
  }

  async function applyCompany(companyId: string) {
    const company = companies.find((item) => item.id === companyId);
    if (!company) return;

    setForm((prev) => ({
      ...prev,
      company_id: company.id,
      company_name: company.company_name,
      company_address: [company.address, company.city].filter(Boolean).join(", "),
      company_phone: company.phone || "",
      logo_url: company.logo_url || "",
      design_config: normalizeDesignConfig(prev.design_config, prev.trainer_names, company.company_name),
    }));

    try {
      const { data: employees, error } = await (supabase as any)
        .from("employees")
        .select("id, first_name, last_name, tc_number, job_title")
        .eq("company_id", company.id)
        .eq("is_active", true)
        .order("first_name", { ascending: true });

      if (error) throw error;

      const mappedParticipants = (employees || [])
        .map((employee: any) => ({
          id: employee.id,
          name: `${employee.first_name || ""} ${employee.last_name || ""}`.trim(),
          tc_no: employee.tc_number || "",
          job_title: employee.job_title || "",
        }))
        .filter((participant: CertificateParticipantInput) => participant.name.length > 0);

      if (mappedParticipants.length > 0) {
        setParticipants(mappedParticipants);
        setEmployeeLoadState("loaded");
        setEmployeeLoadMessage(`${mappedParticipants.length} çalışan katılımcı listesine otomatik yüklendi.`);
        toast.success(`${mappedParticipants.length} çalışan otomatik yüklendi`);
      } else {
        setParticipants([]);
        setEmployeeLoadState("empty");
        setEmployeeLoadMessage("Seçilen firmaya ait kayıtlı çalışan bulunamadı. Katılımcıları manuel ekleyebilir veya Excel ile yükleyebilirsiniz.");
        toast.info("Bu firmaya ait kayıtlı çalışan bulunamadı");
      }
    } catch (error: any) {
      setEmployeeLoadState("empty");
      setEmployeeLoadMessage("Çalışanlar otomatik yüklenemedi. Katılımcıları manuel ekleyebilir veya Excel ile yükleyebilirsiniz.");
      toast.error(`Çalışanlar yüklenemedi: ${error.message}`);
    }
  }

  function addParticipant() {
    setParticipants((prev) => [...prev, { name: "", tc_no: "", job_title: "" }]);
  }

  function updateParticipant(index: number, patch: Partial<CertificateParticipantInput>) {
    setParticipants((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function removeParticipant(index: number) {
    setParticipants((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  async function uploadCertificateAsset(file: File) {
    const fileName = `logos/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("certificate-files").upload(fileName, file, { upsert: true });
    if (error) throw error;
    return fileName;
  }

  async function handleExcelUpload(file: File) {
    try {
      const parsed = await parseCertificateParticipantsExcel(file);
      setParticipants(parsed);
      toast.success(`${parsed.length} katılımcı yüklendi`);
    } catch (error: any) {
      toast.error(`Excel okunamadı: ${error.message}`);
    }
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    const localPreviewUrl = URL.createObjectURL(file);
    setLogoPreviewUrl(localPreviewUrl);
    try {
      const fileName = await uploadCertificateAsset(file);
      setForm((prev) => ({ ...prev, logo_url: fileName }));
      await syncLogoPreview(fileName);
      toast.success("Logo yüklendi");
    } catch (error: any) {
      setLogoPreviewUrl("");
      toast.error(`Logo yüklenemedi: ${error.message}`);
    } finally {
      URL.revokeObjectURL(localPreviewUrl);
      setUploadingLogo(false);
    }
  }

  async function handleCreate() {
    if (!form.company_name.trim() || !form.training_name.trim()) {
      toast.error("Firma ve eğitim bilgileri zorunludur");
      return null;
    }
    if (participants.length === 0) {
      toast.error("En az bir katılımcı ekleyin");
      return null;
    }

    setSubmitting(true);
    try {
      const response = await createCertificate(form, participants);
      setActiveCertificate(response.certificate);
      setActiveJob(response.job);
      await loadRecentCertificates();
      toast.success("Sertifika işi oluşturuldu");
      return response;
    } catch (error: any) {
      toast.error(`Kayıt oluşturulamadı: ${error.message}`);
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerate(certificateOverride?: CertificateRecord | null) {
    try {
      let certificate = certificateOverride || activeCertificate;
      if (!certificate) {
        const created = await handleCreate();
        certificate = created?.certificate ?? null;
        if (certificate) {
          setActiveCertificate(certificate);
          setActiveJob(created?.job ?? null);
        }
      }
      if (!certificate) return;

      setSubmitting(true);
      const response = await generateCertificateJob(certificate.id);
      setActiveCertificate(response.certificate);
      setActiveJob(response.job);
      await refreshJobStatus(certificate.id);
      toast.success("Toplu üretim kuyruğa alındı");
    } catch (error: any) {
      toast.error(`Üretim başlatılamadı: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadZip() {
    if (!activeCertificate) return;
    try {
      const payload = await getCertificateDownload(activeCertificate.id);
      if (!payload.downloadUrl) {
        toast.error("ZIP henüz hazır değil");
        return;
      }
      window.open(payload.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast.error(`ZIP indirilemedi: ${error.message}`);
    }
  }

  async function handleDownloadSinglePdf() {
    const item =
      completedItems.find((entry) => entry.participant_id === selectedPdfParticipantId) ||
      completedItems[0];
    if (!item?.pdf_path) {
      toast.error("İndirilebilir PDF bulunamadı");
      return;
    }
    const { data, error } = await supabase.storage.from("certificate-files").createSignedUrl(item.pdf_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("PDF bağlantısı oluşturulamadı");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function loadCertificate(certificate: CertificateRecord) {
    setActiveCertificate(certificate);
    setForm({
      company_id: certificate.company_id,
      company_name: certificate.company_name || "",
      company_address: certificate.company_address || "",
      company_phone: certificate.company_phone || "",
      training_name: certificate.training_name,
      training_date: certificate.training_date,
      training_duration: certificate.training_duration,
      certificate_type: certificate.certificate_type,
      validity_date: certificate.validity_date || "",
      logo_url: certificate.logo_url || "",
      template_type: (certificate.template_type as any) || "classic",
      frame_style: (certificate.frame_style as any) || "gold",
      trainer_names: certificate.trainer_names || [""],
      notes: certificate.notes || "",
      design_config: normalizeDesignConfig((certificate as any).design_config, certificate.trainer_names || [""], certificate.company_name || ""),
    });

    const { data: participantRows } = await (supabase as any).from("certificate_participants").select("*").eq("certificate_id", certificate.id).order("created_at", { ascending: true });
    setParticipants(participantRows || []);
    setTrainerNamesInput((certificate.trainer_names || [""]).join(", "));
    await refreshJobStatus(certificate.id);
  }

  async function handleDeleteCertificate(certificate: CertificateRecord) {
    const targetName = certificate.training_name?.trim() || "Bu sertifika kaydı";
    const shouldDelete = window.confirm(`"${targetName}" kaydı silinsin mi? Bu işlem geri alınamaz.`);
    if (!shouldDelete) return;

    setDeletingCertificateId(certificate.id);
    try {
      const { error } = await (supabase as any)
        .from("certificates")
        .delete()
        .eq("id", certificate.id);

      if (error) throw error;

      setRecentCertificates((prev) => prev.filter((item) => item.id !== certificate.id));

      if (activeCertificate?.id === certificate.id) {
        setActiveCertificate(null);
        setActiveJob(null);
        setJobItems([]);
        setSelectedPdfParticipantId("");
      }

      toast.success("Sertifika kaydı silindi");
    } catch (error: any) {
      toast.error(`Sertifika kaydı silinemedi: ${error.message}`);
    } finally {
      setDeletingCertificateId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="h-8 w-72 animate-pulse rounded bg-slate-800" />
            <div className="h-4 w-96 animate-pulse rounded bg-slate-900" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-9 w-28 animate-pulse rounded-lg bg-slate-900" />
            ))}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.25fr]">
          <div className="space-y-6">
            <div className="h-[420px] animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
            <div className="h-[320px] animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
          </div>
          <div className="space-y-6">
            <div className="h-[420px] animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
            <div className="h-[260px] animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sertifika Merkezi</h1>
          <p className="text-sm text-muted-foreground mt-1">Toplu sertifika üretimi ve tasarım şablonları tek merkezden yönetilir.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="px-3 py-1">10.000 kayıt hedefi</Badge>
          <Badge variant="secondary" className="px-3 py-1">6 premium tema</Badge>
          <Badge variant="secondary" className="px-3 py-1">Paralel worker</Badge>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/dashboard/certificates/history"><History className="h-4 w-4" /> Geçmiş İşler</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={currentTab === "production" ? "default" : "outline"}
          className="gap-2"
          onClick={() => setSearchParams({})}
        >
          <Award className="h-4 w-4" />
          Sertifika Üret
        </Button>
        <Button
          type="button"
          variant={currentTab === "templates" ? "default" : "outline"}
          className="gap-2"
          onClick={() => setSearchParams({ tab: "templates" })}
        >
          <Palette className="h-4 w-4" />
          Tasarım Şablonları
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.25fr]">
        <div className="space-y-6">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Eğitim ve Firma Bilgileri</CardTitle>
              <CardDescription>Firma bilgilerini şirket yönetiminden çekebilir veya manuel düzenleyebilirsiniz.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Firma Seçimi</Label>
                  <Select value={form.company_id || "manual"} onValueChange={(value) => value !== "manual" ? void applyCompany(value) : (setForm((prev) => ({ ...prev, company_id: null })), setEmployeeLoadState("idle"), setEmployeeLoadMessage(""))}>
                    <SelectTrigger><SelectValue placeholder="Firma seçin" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manuel giriş</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>{company.company_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Firma Adı</Label><Input value={form.company_name} onChange={(e) => setForm((prev) => ({ ...prev, company_name: e.target.value, design_config: normalizeDesignConfig(prev.design_config, prev.trainer_names, e.target.value) }))} /></div>
                <div className="space-y-2"><Label>Telefon</Label><Input value={form.company_phone} onChange={(e) => setForm((prev) => ({ ...prev, company_phone: e.target.value }))} /></div>
                <div className="space-y-2 md:col-span-2"><Label>Adres</Label><Textarea value={form.company_address} onChange={(e) => setForm((prev) => ({ ...prev, company_address: e.target.value }))} className="min-h-20" /></div>
                <div className="space-y-2"><Label>Eğitim Adı</Label><Input value={form.training_name} onChange={(e) => setForm((prev) => ({ ...prev, training_name: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Eğitim Tarihi</Label><Input type="date" value={form.training_date} onChange={(e) => setForm((prev) => ({ ...prev, training_date: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Eğitim Süresi</Label><Input value={form.training_duration} onChange={(e) => setForm((prev) => ({ ...prev, training_duration: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Geçerlilik Tarihi</Label><Input type="date" value={form.validity_date} onChange={(e) => setForm((prev) => ({ ...prev, validity_date: e.target.value }))} /></div>
                <div className="space-y-2 md:col-span-2"><Label>Eğitmenler</Label><Input value={trainerNamesInput} onChange={(e) => { const nextValue = e.target.value; const trainerNames = nextValue.split(",").map((item) => item.trim()).filter(Boolean); setTrainerNamesInput(nextValue); setForm((prev) => ({ ...prev, trainer_names: trainerNames, design_config: { ...normalizeDesignConfig(prev.design_config, trainerNames, prev.company_name), signatures: normalizeDesignConfig(prev.design_config, trainerNames, prev.company_name).signatures.map((signature, index) => index === 0 ? { ...signature, name: signature.name || trainerNames[0] || "" } : index === 1 ? { ...signature, name: signature.name || trainerNames[1] || "" } : signature) } })); }} placeholder="Uzman adlarını virgül ile ayırın" /></div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Eğitim Konuları</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="min-h-24"
                    placeholder="İstersen eğitim konu başlıklarını satır satır, virgülle veya noktalı virgülle yazabilirsin."
                  />
                  <p className="text-xs text-muted-foreground">
                    Bu alan isteğe bağlıdır. Doldurursan tüm sertifika tasarımlarında gösterilir, boş bırakırsan gizlenir.
                  </p>
                </div>
                <div className="space-y-3 md:col-span-2">
                  <Label>Logo</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <label>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void handleLogoUpload(e.target.files[0])} />
                      <Button type="button" variant="outline" className="gap-2" asChild>
                        <span>{uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Logo Yükle</span>
                      </Button>
                    </label>
                    {logoPreviewUrl ? (
                      <div className="flex h-16 w-40 items-center justify-center rounded-xl border bg-card p-2">
                        <img src={logoPreviewUrl} alt="Logo önizleme" className="max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed px-4 py-3 text-xs text-muted-foreground">
                        Henüz logo yüklenmedi
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Yüklediğin logo önizlemede ve PDF sertifikada kullanılır. Görünmüyorsa yükleme sonrası birkaç saniye içinde otomatik yenilenir.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card ref={studioSectionRef} className={currentTab === "templates" ? "border-primary/40 shadow-lg shadow-primary/10" : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /> Tasarım Şablonları</CardTitle>
              <CardDescription>Tema seçimi ve gelişmiş tasarım ayarları sertifika üretim akışının içinden yönetilir.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {templateCards.map((template) => (
                  <button
                    key={template.value}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, template_type: template.value }))}
                    className={`rounded-2xl border p-4 text-left transition-all ${form.template_type === template.value ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border hover:border-primary/40 hover:bg-secondary/40"}`}
                  >
                    <p className="text-sm font-semibold">{template.title}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{template.text}</p>
                  </button>
                ))}
              </div>
              <div className="rounded-2xl border bg-secondary/20 p-4">
                <p className="text-sm font-semibold">Gelişmiş tasarım görünümü</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Renk paleti, ikinci logo, mühür, özel başlık, açıklama, imza görselleri ve canlı stüdyo önizlemesi için bu alanı kullanın.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="secondary">Canlı önizleme</Badge>
                  <Badge variant="secondary">Tema stüdyosu</Badge>
                  <Badge variant="secondary">İmza görseli</Badge>
                  <Badge variant="secondary">Premium hazırlık</Badge>
                </div>
                <Button type="button" className="mt-4 gap-2" onClick={() => setSearchParams({ tab: "templates" })}>
                  <Palette className="h-4 w-4" /> Şablon alanına odaklan
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Üretim Durumu</CardTitle>
              <CardDescription>Queue, worker ve ZIP üretim akışını gerçek zamanlı izleyin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`rounded-2xl border px-4 py-4 ${jobStatusMeta.tone}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{jobStatusMeta.label}</p>
                    <p className="mt-1 text-sm">{jobStatusMeta.summary}</p>
                  </div>
                  <Badge variant="secondary" className="bg-background/70">%{Math.round(activeJob?.progress || 0)}</Badge>
                </div>
                <p className="mt-3 text-xs opacity-90">{jobStatusMeta.detail}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Durum</p><p className="text-lg font-semibold mt-1">{jobStatusMeta.label}</p></div>
                <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Tamamlanan</p><p className="text-lg font-semibold mt-1">{activeJob?.completed_files || 0} / {activeJob?.total_files || participants.length}</p></div>
                <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">İlerleme</p><p className="text-lg font-semibold mt-1">%{Math.round(activeJob?.progress || 0)}</p></div>
              </div>
              <Progress value={activeJob?.progress || 0} className="h-3" />
              {activeJob?.error_message && (
                <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm text-orange-800 dark:text-orange-200">
                  <p className="font-medium">Son hata özeti</p>
                  <p className="mt-1 break-words text-xs">{activeJob.error_message}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void handleCreate()} disabled={submitting} variant="outline" className="gap-2"><Plus className="h-4 w-4" /> İşi Kaydet</Button>
                <Button onClick={() => void handleGenerate()} disabled={submitting} className="gap-2"><RefreshCw className="h-4 w-4" /> Sertifikaları Üret</Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2"><Eye className="h-4 w-4" /> Preview Certificate</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-6xl border-border/70 bg-background/95">
                    <DialogHeader>
                      <DialogTitle>Sertifika Önizleme</DialogTitle>
                      <DialogDescription>
                        Seçilen tema, firma bilgileri ve ilk katılımcı ile oluşturulan örnek sertifika görünümü.
                      </DialogDescription>
                    </DialogHeader>
                    <CertificatePreviewCard form={previewForm} participant={previewParticipant} className="min-h-[540px]" />
                  </DialogContent>
                </Dialog>
                <Button onClick={() => void handleDownloadSinglePdf()} disabled={completedItems.length === 0} variant="outline" className="gap-2"><Download className="h-4 w-4" /> Seçili PDF İndir</Button>
                <Button onClick={() => void handleDownloadZip()} disabled={!activeJob?.zip_path} variant="outline" className="gap-2"><FileArchive className="h-4 w-4" /> ZIP İndir</Button>
              </div>
              {completedItems.length > 0 && (
                <div className="space-y-2 rounded-xl border p-4">
                  <Label>İndirilecek katılımcı PDF'i</Label>
                  <Select value={selectedPdfParticipantId} onValueChange={setSelectedPdfParticipantId}>
                    <SelectTrigger><SelectValue placeholder="Katılımcı seçin" /></SelectTrigger>
                    <SelectContent>
                      {completedItems.map((item) => (
                        <SelectItem key={item.id} value={item.participant_id}>
                          {toDisplayText(item.participant_name) || item.participant_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Tüm katılımcılar üretildi. Bu alan tekil PDF açar, toplu indirme için ZIP kullanılmalıdır.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="text-white">Canlı Önizleme</CardTitle>
              <CardDescription className="text-slate-300">Seçilen tema ve firma bilgileriyle gerçek baskı hissine yakın önizleme.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <CertificatePreviewCard form={previewForm} participant={previewParticipant} className="min-h-[540px]" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Katılımcı Listesi</CardTitle>
              <CardDescription>Excel ile yükleyin veya manuel ekleyin. Worker kuyruğu her katılımcı için ayrı PDF üretir.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {employeeLoadState !== "idle" && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${employeeLoadState === "loaded" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
                  {employeeLoadMessage}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="gap-2" onClick={() => createCertificateExcelTemplate()}><FileSpreadsheet className="h-4 w-4" /> Excel Şablonu</Button>
                <label>
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && void handleExcelUpload(e.target.files[0])} />
                  <Button type="button" variant="outline" className="gap-2" asChild><span><Upload className="h-4 w-4" /> Excel Yükle</span></Button>
                </label>
                <Button type="button" variant="outline" className="gap-2" onClick={addParticipant}><Plus className="h-4 w-4" /> Katılımcı Ekle</Button>
              </div>
              <div className="max-h-[520px] overflow-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ad Soyad</TableHead>
                      <TableHead>T.C. No</TableHead>
                      <TableHead>Görev</TableHead>
                      <TableHead className="w-[80px]">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-10">Henüz katılımcı eklenmedi.</TableCell></TableRow>
                    ) : participants.map((participant, index) => (
                      <TableRow key={participant.id || `participant-${index}`}>
                        <TableCell><Input value={participant.name} onChange={(e) => updateParticipant(index, { name: e.target.value })} /></TableCell>
                        <TableCell><Input value={participant.tc_no || ""} onChange={(e) => updateParticipant(index, { tc_no: e.target.value })} /></TableCell>
                        <TableCell><Input value={participant.job_title || ""} onChange={(e) => updateParticipant(index, { job_title: e.target.value })} /></TableCell>
                        <TableCell><Button type="button" variant="ghost" size="sm" onClick={() => removeParticipant(index)}>Sil</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Geçmiş İşler ve Tekrar Basım</CardTitle>
              <CardDescription>Önceki sertifika kayıtlarını seçip yeniden üretim başlatabilirsiniz.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentCertificates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz sertifika işi bulunmuyor.</p>
              ) : recentCertificates.map((certificate) => (
                <div key={certificate.id} className="rounded-xl border p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-semibold">{certificate.training_name}</p>
                    <p className="text-sm text-muted-foreground">{certificate.company_name || "Firma yok"} • {certificate.training_date}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void loadCertificate(certificate)}>Yükle</Button>
                    <Button variant="outline" size="sm" asChild><Link to={`/dashboard/certificates/${certificate.id}`}>Detay</Link></Button>
                    <Button size="sm" onClick={() => void handleGenerate(certificate)}>Tekrar Bas</Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                      disabled={deletingCertificateId === certificate.id}
                      onClick={() => void handleDeleteCertificate(certificate)}
                    >
                      {deletingCertificateId === certificate.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Sil
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}



