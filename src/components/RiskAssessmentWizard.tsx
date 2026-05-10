import { ChangeEvent, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  AlertTriangle, Building2, CheckCircle2, ChevronLeft, ChevronRight, 
  Download, FilePenLine, FileSearch, FileSignature, FileText, 
  Loader2, ShieldCheck, Upload, Users, X, Info
} from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { usePersistentFormDraft } from "@/hooks/usePersistentFormDraft";
import { supabase } from "@/integrations/supabase/client";
import { uploadFileOptimized } from "@/lib/storageHelper";
import { buildStorageObjectRef } from "@/lib/storageObject";
import { cn } from "@/lib/utils";
import { addInterFontsToJsPDF } from "@/utils/fonts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type HazardLevel = "Az Tehlikeli" | "Tehlikeli" | "Çok Tehlikeli";
type RiskMethod = "L Tipi Matris" | "Fine-Kinney" | "5x5 Matris" | "Kontrol Listesi Destekli Matris";
type SignatureFieldKey =
  | "employerRepresentativeSignatureUrl"
  | "occupationalSafetySpecialistSignatureUrl"
  | "workplaceDoctorSignatureUrl"
  | "employeeRepresentativeSignatureUrl"
  | "supportPersonnelSignatureUrl";

interface WizardStep { id: string; label: string; title: string; description: string; icon: React.ReactNode; }
interface SignatureRoleConfig {
  key: SignatureFieldKey;
  nameKey:
    | "employerRepresentativeName"
    | "occupationalSafetySpecialistName"
    | "workplaceDoctorName"
    | "employeeRepresentativeName"
    | "supportPersonnelName";
  title: string;
  helper: string;
  subtitle: string;
}
interface FormData {
  firmName: string; workplaceTitle: string; workplaceAddress: string; employerName: string; department: string;
  hazardLevel: HazardLevel; method: RiskMethod; reportDate: string; validityDate: string; logo: string | null;
  employerRepresentativeName: string; occupationalSafetySpecialistName: string; workplaceDoctorName: string;
  employerRepresentativeSignatureUrl: string | null; occupationalSafetySpecialistSignatureUrl: string | null; workplaceDoctorSignatureUrl: string | null;
  employeeRepresentativeName: string; supportPersonnelName: string; employeeRepresentativeSignatureUrl: string | null; supportPersonnelSignatureUrl: string | null;
  hazardSources: string; identifiedRisks: string;
  controlMeasures: string; responsiblePersons: string; legislationNotes: string; renewalTriggersNote: string;
}

type RiskAssessmentWizardDraft = {
  currentStep: number;
  formData: FormData;
};

const today = new Date().toISOString().split("T")[0];
const steps: WizardStep[] = [
  { id: "isyeri", label: "İşyeri Bilgileri", title: "Resmî Üst Bilgi Alanları", description: "Unvan, adres, işveren bilgisi ve tehlike sınıfını hazırlayın.", icon: <Building2 className="h-5 w-5" /> },
  { id: "ekip", label: "Ekip Üyeleri", title: "Risk Değerlendirme Ekibi", description: "İşveren vekili, İSG uzmanı, işyeri hekimi, çalışan temsilcisi ve destek elemanlarını girin.", icon: <Users className="h-5 w-5" /> },
  { id: "yontem", label: "Yöntem ve Tarihler", title: "Analiz Yöntemi ve Geçerlilik", description: "Risk analiz yöntemi, analiz tarihi ve geçerlilik sürelerini belirleyin.", icon: <FileSearch className="h-5 w-5" /> },
  { id: "tehlike", label: "Tehlike ve Riskler", title: "Tehlike Kaynakları ve Riskler", description: "Tehlike kaynaklarını ve bunlardan doğabilecek riskleri detaylandırın.", icon: <AlertTriangle className="h-5 w-5" /> },
  { id: "tedbir", label: "Kontrol Tedbirleri", title: "Önleyici Tedbirler ve Sorumlular", description: "Düzeltici-önleyici faaliyetleri, sorumluları ve mevzuat notlarını tamamlayın.", icon: <ShieldCheck className="h-5 w-5" /> },
  { id: "onizleme", label: "Önizleme ve PDF", title: "Resmî Rapor Önizleme", description: "Zorunlu içerikleri gözden geçirin, PDF çıktısı alın ve kaydı tamamlayın.", icon: <Download className="h-5 w-5" /> },
];

const hazardConfig = {
  "Az Tehlikeli": { years: 6, icon: "🟢", pillClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400", bgClass: "bg-emerald-500/5", borderClass: "border-emerald-500/20", textClass: "text-emerald-400", summary: "Az tehlikeli işyerlerinde rapor en geç 6 yılda bir yenilenmelidir.", renewalLabel: "6 yılda bir" },
  "Tehlikeli": { years: 4, icon: "🟡", pillClass: "border-amber-500/20 bg-amber-500/10 text-amber-400", bgClass: "bg-amber-500/5", borderClass: "border-amber-500/20", textClass: "text-amber-400", summary: "Tehlikeli işyerlerinde rapor en geç 4 yılda bir yenilenmelidir.", renewalLabel: "4 yılda bir" },
  "Çok Tehlikeli": { years: 2, icon: "🔴", pillClass: "border-rose-500/20 bg-rose-500/10 text-rose-400", bgClass: "bg-rose-500/5", borderClass: "border-rose-500/20", textClass: "text-rose-400", summary: "Çok tehlikeli işyerlerinde rapor en geç 2 yılda bir yenilenmelidir.", renewalLabel: "2 yılda bir" },
} as const;

const methodOptions: RiskMethod[] = ["L Tipi Matris", "Fine-Kinney", "5x5 Matris", "Kontrol Listesi Destekli Matris"];

const signatureRoleConfigs: SignatureRoleConfig[] = [
  { key: "employerRepresentativeSignatureUrl", nameKey: "employerRepresentativeName", title: "İşveren / Vekili İmza Alanı", helper: "İşveren veya vekilinin imza ya da onay görselini yükleyin.", subtitle: "İşveren / İşveren Vekili" },
  { key: "occupationalSafetySpecialistSignatureUrl", nameKey: "occupationalSafetySpecialistName", title: "İSG Uzmanı İmza / Kaşe", helper: "Uzman imzası veya kaşe görselini yükleyin.", subtitle: "İş Güvenliği Uzmanı" },
  { key: "workplaceDoctorSignatureUrl", nameKey: "workplaceDoctorName", title: "İşyeri Hekimi İmza Alanı", helper: "Hekim imzası veya paraf görseli ekleyin.", subtitle: "İşyeri Hekimi" },
  { key: "employeeRepresentativeSignatureUrl", nameKey: "employeeRepresentativeName", title: "Çalışan Temsilcisi İmza Alanı", helper: "Temsilci için imza görseli eklenebilir.", subtitle: "Çalışan Temsilcisi" },
  { key: "supportPersonnelSignatureUrl", nameKey: "supportPersonnelName", title: "Destek Elemanı İmza Alanı", helper: "Destek elemanı için imza ya da onay görseli yükleyin.", subtitle: "Destek Elemanı" },
];

type SignatureStatusKey =
  | "employer_representative_approval_status"
  | "occupational_safety_specialist_approval_status"
  | "workplace_doctor_approval_status"
  | "employee_representative_approval_status"
  | "support_personnel_approval_status";

type SignatureSignedAtKey =
  | "employer_representative_signed_at"
  | "occupational_safety_specialist_signed_at"
  | "workplace_doctor_signed_at"
  | "employee_representative_signed_at"
  | "support_personnel_signed_at";

type SignatureUrlDbKey =
  | "employer_representative_signature_url"
  | "occupational_safety_specialist_signature_url"
  | "workplace_doctor_signature_url"
  | "employee_representative_signature_url"
  | "support_personnel_signature_url";

type SignatureDbConfig = SignatureRoleConfig & {
  dbUrlKey: SignatureUrlDbKey;
  dbStatusKey: SignatureStatusKey;
  dbSignedAtKey: SignatureSignedAtKey;
};

const signatureDbConfigs: SignatureDbConfig[] = [
  { ...signatureRoleConfigs[0], dbUrlKey: "employer_representative_signature_url", dbStatusKey: "employer_representative_approval_status", dbSignedAtKey: "employer_representative_signed_at" },
  { ...signatureRoleConfigs[1], dbUrlKey: "occupational_safety_specialist_signature_url", dbStatusKey: "occupational_safety_specialist_approval_status", dbSignedAtKey: "occupational_safety_specialist_signed_at" },
  { ...signatureRoleConfigs[2], dbUrlKey: "workplace_doctor_signature_url", dbStatusKey: "workplace_doctor_approval_status", dbSignedAtKey: "workplace_doctor_signed_at" },
  { ...signatureRoleConfigs[3], dbUrlKey: "employee_representative_signature_url", dbStatusKey: "employee_representative_approval_status", dbSignedAtKey: "employee_representative_signed_at" },
  { ...signatureRoleConfigs[4], dbUrlKey: "support_personnel_signature_url", dbStatusKey: "support_personnel_approval_status", dbSignedAtKey: "support_personnel_signed_at" },
];

const cleanText = (text?: string | null) => (text || "").replace(/\s+/g, " ").trim();
const asciiSlug = (value: string) => cleanText(value).toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "risk-raporu";

const calculateValidityDate = (reportDate: string, hazardLevel: HazardLevel) => {
  if (!reportDate) return "";
  const baseDate = new Date(`${reportDate}T00:00:00`);
  if (Number.isNaN(baseDate.getTime())) return "";
  baseDate.setFullYear(baseDate.getFullYear() + hazardConfig[hazardLevel].years);
  return baseDate.toISOString().split("T")[0];
};

const defaultRenewalNote = (hazardLevel: HazardLevel) => `${hazardConfig[hazardLevel].summary} İşyerinde iş kazası olması, çalışma yönteminin değişmesi veya yeni makine alınması gibi durumlarda bu süreler beklenmeksizin rapor tamamen veya kısmen yenilenmelidir.`;

const formatDisplayDate = (value?: string) => {
  if (!value) return "-";
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(date);
};

const buildSignatureMeta = (roleKey: SignatureFieldKey, imageUrl: string | null, timestampIso: string) => {
  const config = signatureDbConfigs.find((entry) => entry.key === roleKey);
  if (!config) return null;
  return {
    dbUrlKey: config.dbUrlKey,
    dbStatusKey: config.dbStatusKey,
    dbSignedAtKey: config.dbSignedAtKey,
    status: imageUrl ? "Hazır" : "Bekliyor",
    signedAt: imageUrl ? timestampIso : null,
  };
};

const createInitialFormData = (): FormData => ({
  firmName: "", workplaceTitle: "", workplaceAddress: "", employerName: "", department: "", hazardLevel: "Tehlikeli", method: "5x5 Matris",
  reportDate: today, validityDate: calculateValidityDate(today, "Tehlikeli"), logo: null,
  employerRepresentativeName: "", occupationalSafetySpecialistName: "", workplaceDoctorName: "",
  employerRepresentativeSignatureUrl: null, occupationalSafetySpecialistSignatureUrl: null, workplaceDoctorSignatureUrl: null,
  employeeRepresentativeName: "", supportPersonnelName: "", employeeRepresentativeSignatureUrl: null, supportPersonnelSignatureUrl: null,
  hazardSources: "", identifiedRisks: "", controlMeasures: "", responsiblePersons: "", legislationNotes: "", renewalTriggersNote: defaultRenewalNote("Tehlikeli"),
});

export default function RiskAssessmentWizard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRefs = useRef<Record<SignatureFieldKey, HTMLInputElement | null>>({
    employerRepresentativeSignatureUrl: null,
    occupationalSafetySpecialistSignatureUrl: null,
    workplaceDoctorSignatureUrl: null,
    employeeRepresentativeSignatureUrl: null,
    supportPersonnelSignatureUrl: null,
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>(createInitialFormData);
  const [signaturePreview, setSignaturePreview] = useState<{ title: string; imageUrl: string; field: SignatureFieldKey } | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  const locationState = location.state as { companyId?: string | null } | null;
  const draftContextKey = useMemo(
    () => `${location.pathname}:${locationState?.companyId || "general"}`,
    [location.pathname, locationState?.companyId],
  );

  const draftFormData = useMemo<FormData>(() => ({
    ...formData,
    logo: formData.logo?.startsWith("data:") ? null : formData.logo,
    employerRepresentativeSignatureUrl: formData.employerRepresentativeSignatureUrl?.startsWith("data:") ? null : formData.employerRepresentativeSignatureUrl,
    occupationalSafetySpecialistSignatureUrl: formData.occupationalSafetySpecialistSignatureUrl?.startsWith("data:") ? null : formData.occupationalSafetySpecialistSignatureUrl,
    workplaceDoctorSignatureUrl: formData.workplaceDoctorSignatureUrl?.startsWith("data:") ? null : formData.workplaceDoctorSignatureUrl,
    employeeRepresentativeSignatureUrl: formData.employeeRepresentativeSignatureUrl?.startsWith("data:") ? null : formData.employeeRepresentativeSignatureUrl,
    supportPersonnelSignatureUrl: formData.supportPersonnelSignatureUrl?.startsWith("data:") ? null : formData.supportPersonnelSignatureUrl,
  }), [formData]);

  const { clearDraft } = usePersistentFormDraft<RiskAssessmentWizardDraft>({
    formId: `risk-assessment-wizard:${draftContextKey}`,
    enabled: Boolean(user?.id),
    version: 1,
    storage: "indexedDb",
    ttlMs: 14 * 24 * 60 * 60 * 1000,
    debounceMs: 500,
    userId: user?.id,
    organizationId: profile?.organization_id ?? null,
    value: {
      currentStep,
      formData: draftFormData,
    },
    initialValue: {
      currentStep: 0,
      formData: createInitialFormData(),
    },
    isDirty:
      draftFormData.firmName.trim().length > 0 ||
      draftFormData.workplaceTitle.trim().length > 0 ||
      draftFormData.employerName.trim().length > 0 ||
      currentStep > 0,
    onRestore: (draft) => {
      setCurrentStep(
        typeof draft.currentStep === "number"
          ? Math.min(Math.max(draft.currentStep, 0), steps.length - 1)
          : 0,
      );
      setFormData({
        ...createInitialFormData(),
        ...(draft.formData || {}),
      });
    },
    debugLabel: "RiskAssessmentWizard",
  });

  const resetWizardDraft = () => {
    clearDraft();
    setCurrentStep(0);
    setFormData(createInitialFormData());
    setSignaturePreview(null);
    setTouched({});
    toast.success("Risk değerlendirme taslağı temizlendi.");
  };

  const hazardCfg = hazardConfig[formData.hazardLevel];
  const currentStepConfig = steps[currentStep];
  const completionRatio = ((currentStep + 1) / steps.length) * 100;
  const brandedCompanyName = cleanText(formData.firmName) || "Kurumsal Risk Değerlendirme Raporu";
  const createdAtLabel = useMemo(() => new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date()), []);
  
  const checklist = useMemo(() => [
    formData.workplaceTitle, formData.workplaceAddress, formData.employerName, formData.employerRepresentativeName, 
    formData.occupationalSafetySpecialistName, formData.workplaceDoctorName, formData.employeeRepresentativeName, 
    formData.supportPersonnelName, formData.reportDate, formData.validityDate, formData.method, formData.hazardSources, 
    formData.identifiedRisks, formData.controlMeasures, formData.responsiblePersons
  ].map(cleanText), [formData]);
  
  const completedFields = checklist.filter(Boolean).length;
  const pdfReady = completedFields >= 13;
  
  const isStepValid = (stepIndex: number): { valid: boolean; message?: string } => {
    switch (stepIndex) {
      case 0:
        if (!cleanText(formData.firmName)) return { valid: false, message: "Lütfen Rapor Başlığını doldurun." };
        if (!cleanText(formData.workplaceTitle)) return { valid: false, message: "Lütfen İşyeri Unvanını doldurun." };
        if (!cleanText(formData.employerName)) return { valid: false, message: "Lütfen İşveren Adını doldurun." };
        if (!cleanText(formData.workplaceAddress)) return { valid: false, message: "Lütfen İşyeri Adresini doldurun." };
        return { valid: true };
      case 1:
        if (!cleanText(formData.employerRepresentativeName)) return { valid: false, message: "Lütfen İşveren / Vekili adını girin." };
        if (!cleanText(formData.occupationalSafetySpecialistName)) return { valid: false, message: "Lütfen İSG Uzmanı adını girin." };
        if (!cleanText(formData.workplaceDoctorName)) return { valid: false, message: "Lütfen İşyeri Hekimi adını girin." };
        if (!cleanText(formData.employeeRepresentativeName)) return { valid: false, message: "Lütfen Çalışan Temsilcisi adını girin." };
        if (!cleanText(formData.supportPersonnelName)) return { valid: false, message: "Lütfen Destek Elemanı adını girin." };
        return { valid: true };
      case 2:
        if (!formData.reportDate) return { valid: false, message: "Lütfen Analiz Tarihini seçin." };
        return { valid: true };
      case 3:
        if (!cleanText(formData.hazardSources)) return { valid: false, message: "Lütfen Tehlike Kaynaklarını tanımlayın." };
        if (!cleanText(formData.identifiedRisks)) return { valid: false, message: "Lütfen Doğabilecek Riskleri belirtin." };
        return { valid: true };
      case 4:
        if (!cleanText(formData.controlMeasures)) return { valid: false, message: "Lütfen Kontrol Tedbirlerini girin." };
        if (!cleanText(formData.responsiblePersons)) return { valid: false, message: "Lütfen Sorumlu Kişileri belirtin." };
        return { valid: true };
      default:
        return { valid: true };
    }
  };

  const stepCompletionCounts = useMemo(() => {
    const counters = [
      [formData.firmName, formData.workplaceTitle, formData.workplaceAddress, formData.employerName, formData.department, formData.logo ? "logo" : ""],
      [formData.employerRepresentativeName, formData.occupationalSafetySpecialistName, formData.workplaceDoctorName, formData.employeeRepresentativeName, formData.supportPersonnelName, formData.employerRepresentativeSignatureUrl ? "asset" : "", formData.occupationalSafetySpecialistSignatureUrl ? "asset" : "", formData.workplaceDoctorSignatureUrl ? "asset" : "", formData.employeeRepresentativeSignatureUrl ? "asset" : "", formData.supportPersonnelSignatureUrl ? "asset" : ""],
      [formData.method, formData.reportDate, formData.validityDate, formData.renewalTriggersNote],
      [formData.hazardSources, formData.identifiedRisks],
      [formData.controlMeasures, formData.responsiblePersons, formData.legislationNotes],
      [pdfReady ? "ready" : "", formData.firmName, formData.method],
    ];
    return counters.map((items) => ({ completed: items.filter((item) => cleanText(item).length > 0).length, total: items.length }));
  }, [formData, pdfReady]);

  const updateForm = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setTouched((prev) => ({ ...prev, [key]: true }));
  };
  
  const handleHazardLevelChange = (level: HazardLevel) => setFormData((prev) => ({ 
    ...prev, 
    hazardLevel: level, 
    validityDate: calculateValidityDate(prev.reportDate, level), 
    renewalTriggersNote: cleanText(prev.renewalTriggersNote) === cleanText(defaultRenewalNote(prev.hazardLevel)) || !cleanText(prev.renewalTriggersNote) ? defaultRenewalNote(level) : prev.renewalTriggersNote 
  }));
  
  const handleReportDateChange = (date: string) => setFormData((prev) => ({ 
    ...prev, 
    reportDate: date, 
    validityDate: date ? calculateValidityDate(date, prev.hazardLevel) : "" 
  }));

  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo boyutu 2 MB sınırını aşamaz.");
    const reader = new FileReader();
    reader.onload = (e) => { updateForm("logo", (e.target?.result as string) || null); toast.success("Firma logosu yüklendi."); };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleSignatureUpload = (field: SignatureFieldKey, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("İmza / kaşe görseli 2 MB sınırını aşamaz.");
    const reader = new FileReader();
    reader.onload = (e) => { updateForm(field, (e.target?.result as string) || null); toast.success("İmza görseli hazırlandı."); };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const uploadDataUrlToStorage = async (dataUrl: string | null, assessmentId: string, slot: string) => {
    if (!dataUrl || !user?.id) return null;
    if (!dataUrl.startsWith("data:")) return dataUrl;
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const extension = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
    const path = `${user.id}/${assessmentId}/${slot}-${Date.now()}.${extension}`;
    const file = new File([blob], `${slot}.${extension}`, { type: blob.type || "image/png" });
    await uploadFileOptimized("risk-assessment-signatures", path, file);
    return buildStorageObjectRef("risk-assessment-signatures", path);
  };

  const handleStepNavigation = (direction: "next" | "prev") => {
    if (direction === "next") {
      const check = isStepValid(currentStep);
      if (!check.valid) {
        const keysToTouch = steps[currentStep].id === "isyeri" 
          ? ["firmName", "workplaceTitle", "employerName", "workplaceAddress"]
          : steps[currentStep].id === "ekip"
          ? ["employerRepresentativeName", "occupationalSafetySpecialistName", "workplaceDoctorName", "employeeRepresentativeName", "supportPersonnelName"]
          : [];
        
        setTouched(prev => {
          const newTouched = { ...prev };
          keysToTouch.forEach(k => { newTouched[k] = true; });
          return newTouched;
        });

        toast.error(check.message || "Lütfen zorunlu alanları doldurun.");
        return;
      }
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    } else {
      setCurrentStep(prev => Math.max(prev - 1, 0));
    }
  };

  const generatePDFPreview = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const hasCustomFont = addInterFontsToJsPDF(doc);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 14;
    const contentWidth = pageWidth - marginX * 2;
    const leftWidth = 52;
    let cursorY = 16;
    
    const font = (style: "normal" | "bold" = "normal", size = 10) => { doc.setFont(hasCustomFont ? "Inter" : "helvetica", style); doc.setFontSize(size); };
    
    const footer = () => {
      doc.setDrawColor(214, 223, 236); doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);
      font("normal", 8.5); doc.setTextColor(100, 116, 139);
      doc.text(brandedCompanyName, marginX, pageHeight - 6.5);
      doc.text(`Oluşturulma: ${createdAtLabel}`, pageWidth / 2, pageHeight - 6.5, { align: "center" });
      doc.text("İSG Risk Değerlendirme Raporu", pageWidth - marginX, pageHeight - 6.5, { align: "right" });
    };

    const sectionGap = 4;
    const ensure = (needed: number) => { if (cursorY + needed <= pageHeight - 22) return; footer(); doc.addPage(); doc.setFillColor(245, 247, 251); doc.rect(0, 0, pageWidth, pageHeight, "F"); cursorY = 16; };
    
    const section = (title: string, content: string) => {
      const lines = doc.splitTextToSize(cleanText(content) || "Belirtilmedi", contentWidth - leftWidth - 8);
      const height = Math.max(22, lines.length * 5 + 12) + 10; ensure(height + sectionGap);
      doc.setDrawColor(214, 226, 241); doc.setFillColor(255, 255, 255); doc.roundedRect(marginX, cursorY, contentWidth, height, 2, 2, "FD");
      doc.setFillColor(15, 23, 42); doc.rect(marginX, cursorY, leftWidth, 10, "F"); doc.setFillColor(239, 246, 255); doc.rect(marginX + leftWidth, cursorY, contentWidth - leftWidth, 10, "F");
      font("bold", 9); doc.setTextColor(255, 255, 255); doc.text("BÖLÜM", marginX + leftWidth / 2, cursorY + 6.5, { align: "center" });
      doc.setTextColor(8, 47, 73); doc.text(title, marginX + leftWidth + 4, cursorY + 6.5);
      doc.line(marginX + leftWidth, cursorY, marginX + leftWidth, cursorY + height); doc.line(marginX, cursorY + 10, marginX + contentWidth, cursorY + 10);
      font("normal", 9.3); doc.setTextColor(31, 41, 55); doc.text(lines, marginX + leftWidth + 4, cursorY + 17); cursorY += height + sectionGap;
    };

    const table = (title: string, rows: Array<[string, string]>) => {
      const rowHeight = 9; const height = 10 + rows.length * rowHeight; ensure(height + sectionGap);
      doc.setDrawColor(214, 226, 241); doc.setFillColor(255, 255, 255); doc.roundedRect(marginX, cursorY, contentWidth, height, 2, 2, "FD");
      doc.setFillColor(15, 23, 42); doc.rect(marginX, cursorY, leftWidth, 10, "F"); doc.setFillColor(239, 246, 255); doc.rect(marginX + leftWidth, cursorY, contentWidth - leftWidth, 10, "F");
      font("bold", 9); doc.setTextColor(255, 255, 255); doc.text("BÖLÜM", marginX + leftWidth / 2, cursorY + 6.5, { align: "center" });
      doc.setTextColor(8, 47, 73); doc.text(title, marginX + leftWidth + 4, cursorY + 6.5);
      doc.line(marginX + leftWidth, cursorY, marginX + leftWidth, cursorY + height); doc.line(marginX, cursorY + 10, marginX + contentWidth, cursorY + 10);
      rows.forEach(([label, value], i) => { const y = cursorY + 10 + i * rowHeight; if (i) doc.line(marginX, y, marginX + contentWidth, y); font("bold", 9); doc.setTextColor(51, 65, 85); doc.text(label, marginX + 4, y + 6); font("normal", 9.4); doc.setTextColor(15, 23, 42); doc.text(value || "-", marginX + leftWidth + 4, y + 6); });
      cursorY += height + sectionGap;
    };

    const signatureTable = () => {
      const previewTimestampIso = new Date().toISOString();
      const rows = signatureDbConfigs.map((config) => {
        const imageUrl = formData[config.key];
        const meta = buildSignatureMeta(config.key, imageUrl, previewTimestampIso);
        return {
          role: config.title.replace(" İmza Alanı", "").replace(" İmza / Kaşe", ""),
          subtitle: config.subtitle,
          name: formData[config.nameKey],
          imageUrl,
          status: meta?.status || "Bekliyor",
          signedAt: meta?.signedAt || null,
        };
      });
      const rowHeight = 19; const height = 18 + rows.length * rowHeight; ensure(height + sectionGap);
      const titleBlockWidth = 40;
      const roleColWidth = 48;
      const nameColWidth = 54;
      const statusColWidth = 28;
      doc.setDrawColor(214, 226, 241); doc.setFillColor(255, 255, 255); doc.roundedRect(marginX, cursorY, contentWidth, height, 2, 2, "FD");
      doc.setFillColor(15, 23, 42); doc.rect(marginX, cursorY, titleBlockWidth, 18, "F"); doc.setFillColor(239, 246, 255); doc.rect(marginX + titleBlockWidth, cursorY, contentWidth - titleBlockWidth, 18, "F");
      font("bold", 8.8); doc.setTextColor(255, 255, 255); doc.text("İMZA", marginX + titleBlockWidth / 2, cursorY + 7, { align: "center" });
      font("normal", 7.4); doc.text("ONAY", marginX + titleBlockWidth / 2, cursorY + 13, { align: "center" });
      doc.setTextColor(8, 47, 73); font("bold", 8.6); doc.text("Ekip Üyeleri ve Onay Görselleri", marginX + titleBlockWidth + 4, cursorY + 6.8);
      font("normal", 7.2); doc.text("Rol bazlı imza / kaşe alanları", marginX + titleBlockWidth + 4, cursorY + 12.6);
      doc.line(marginX + titleBlockWidth, cursorY, marginX + titleBlockWidth, cursorY + height); doc.line(marginX, cursorY + 18, marginX + contentWidth, cursorY + 18);
      const roleDivider = marginX + roleColWidth;
      const nameDivider = marginX + roleColWidth + nameColWidth;
      const statusDivider = marginX + roleColWidth + nameColWidth + statusColWidth;
      doc.line(roleDivider, cursorY + 18, roleDivider, cursorY + height);
      doc.line(nameDivider, cursorY + 18, nameDivider, cursorY + height);
      doc.line(statusDivider, cursorY + 18, statusDivider, cursorY + height);
      font("bold", 7.5); doc.setTextColor(71, 85, 105);
      doc.text("ROL", marginX + 4, cursorY + 15);
      doc.text("AD SOYAD", roleDivider + 4, cursorY + 15);
      doc.text("TARİH / DURUM", nameDivider + 4, cursorY + 15);
      doc.text("İMZA / KAŞE", statusDivider + 4, cursorY + 15);
      rows.forEach((row, i) => {
        const y = cursorY + 18 + i * rowHeight;
        if (i) doc.line(marginX, y, marginX + contentWidth, y);
        font("bold", 8.3); doc.setTextColor(51, 65, 85); doc.text(row.role, marginX + 4, y + 8);
        font("normal", 7.2); doc.setTextColor(100, 116, 139); doc.text(row.subtitle, marginX + 4, y + 13.2);
        font("normal", 8.4); doc.setTextColor(15, 23, 42); doc.text(cleanText(row.name) || "-", roleDivider + 4, y + 8);
        font("normal", 7); doc.setTextColor(100, 116, 139); doc.text(formatDisplayDate(row.signedAt || ""), nameDivider + 4, y + 6);
        const badgeX = nameDivider + 4;
        const badgeY = y + 8.5;
        const badgeText = row.status.toUpperCase();
        const badgeWidth = row.status === "Hazır" ? 16 : 19;
        if (row.status === "Hazır") {
          doc.setFillColor(236, 253, 245);
          doc.setDrawColor(16, 185, 129);
          doc.roundedRect(badgeX, badgeY, badgeWidth, 5.2, 1.2, 1.2, "FD");
          font("bold", 6.8); doc.setTextColor(6, 95, 70); doc.text(badgeText, badgeX + badgeWidth / 2, badgeY + 3.5, { align: "center" });
        } else {
          doc.setFillColor(255, 251, 235);
          doc.setDrawColor(245, 158, 11);
          doc.roundedRect(badgeX, badgeY, badgeWidth, 5.2, 1.2, 1.2, "FD");
          font("bold", 6.8); doc.setTextColor(146, 64, 14); doc.text(badgeText, badgeX + badgeWidth / 2, badgeY + 3.5, { align: "center" });
        }
        font("normal", 7.2); doc.setTextColor(100, 116, 139); doc.text("Yetkili imza alanı", statusDivider + 4, y + 6);
        if (row.imageUrl) {
          try {
            doc.addImage(row.imageUrl, row.imageUrl.includes("image/png") ? "PNG" : "JPEG", statusDivider + 4, y + 7.5, 24, 9.5);
          } catch {
            doc.line(statusDivider + 4, y + 14.5, marginX + contentWidth - 6, y + 14.5);
          }
        } else {
          doc.line(statusDivider + 4, y + 14.5, marginX + contentWidth - 6, y + 14.5);
        }
      });
      cursorY += height + sectionGap;
    };

    font(); doc.setFillColor(247, 249, 252); doc.rect(0, 0, pageWidth, pageHeight, "F");
    doc.setFillColor(15, 23, 42); doc.roundedRect(marginX, cursorY, contentWidth, 48, 5, 5, "F"); doc.setFillColor(255, 255, 255); doc.roundedRect(marginX + 4, cursorY + 5, 26, 26, 3, 3, "F");
    if (formData.logo) { try { doc.addImage(formData.logo, formData.logo.includes("image/png") ? "PNG" : "JPEG", marginX + 5, cursorY + 6, 24, 24); } catch {} }
    doc.setTextColor(255, 255, 255); font("bold", 15); doc.text("İSG Risk Değerlendirme Raporu", pageWidth / 2, cursorY + 13, { align: "center" }); font("normal", 10.2); doc.text(brandedCompanyName, pageWidth / 2, cursorY + 20, { align: "center" }); font("normal", 8.6); doc.setTextColor(186, 200, 220); doc.text("Oluşturulma", pageWidth - marginX - 6, cursorY + 10, { align: "right" }); doc.text(createdAtLabel, pageWidth - marginX - 6, cursorY + 15, { align: "right" }); doc.text("Rev. 1", pageWidth - marginX - 6, cursorY + 22, { align: "right" }); doc.text(`Geçerlilik: ${formatDisplayDate(formData.validityDate)}`, pageWidth - marginX - 6, cursorY + 27, { align: "right" }); doc.text(`Tehlike: ${formData.hazardLevel}`, pageWidth - marginX - 6, cursorY + 32, { align: "right" }); font("bold", 10); doc.setTextColor(255, 255, 255); doc.text(cleanText(formData.workplaceTitle) || cleanText(formData.firmName) || "İşyeri Unvanı", marginX + 34, cursorY + 31); font("normal", 8.7); doc.setTextColor(203, 213, 225); doc.text(cleanText(formData.workplaceAddress) || "İşyeri adresi bekleniyor", marginX + 34, cursorY + 36); doc.text(`İşveren Adı: ${cleanText(formData.employerName) || "-"}`, marginX + 34, cursorY + 41);
    cursorY += 56;
    table("İşyeri Bilgileri", [["İşyeri Unvanı", cleanText(formData.workplaceTitle) || cleanText(formData.firmName)], ["İşyeri Adresi", cleanText(formData.workplaceAddress)], ["İşveren Adı", cleanText(formData.employerName)], ["Bölüm / Alan", cleanText(formData.department)]]);
    table("Analiz Takvimi", [["Analiz Tarihi", formatDisplayDate(formData.reportDate)], ["Geçerlilik Bitişi", formatDisplayDate(formData.validityDate)], ["Risk Analiz Yöntemi", formData.method], ["Yenileme Periyodu", hazardCfg.renewalLabel]]);
    section("Tehlike Tanımları", formData.hazardSources); section("Doğabilecek Riskler", formData.identifiedRisks); section("Kontrol Tedbirleri", formData.controlMeasures); section("Uygulama Sorumluları", formData.responsiblePersons); section("Mevzuat ve Uygunluk Notları", formData.legislationNotes); section("Yenileme ve Güncelleme Notu", formData.renewalTriggersNote); signatureTable(); footer();
    doc.save(`Isg-Risk-Degerlendirme-Raporu-${cleanText(formData.firmName || "taslak")}-${Date.now()}.pdf`); toast.success("PDF oluşturuldu ve indirildi.");
  };

  const handleSubmit = async () => {
    if (!user?.id) return toast.error("Kullanıcı oturumu bulunamadı.");
    const check = isStepValid(currentStep);
    if (!check.valid) return toast.error(check.message);
    
    setSubmitting(true);
    try {
      const { data: companyMatch } = await supabase.from("companies").select("id, name").eq("user_id", user.id).ilike("name", cleanText(formData.firmName)).maybeSingle();
      const payload = {
        user_id: user.id, company_id: companyMatch?.id ?? null, assessment_name: cleanText(formData.firmName), assessment_date: formData.reportDate || null, next_review_date: formData.validityDate || null,
        department: cleanText(formData.department) || null, sector: formData.hazardLevel, method: formData.method,
        assessor_name: cleanText(formData.occupationalSafetySpecialistName) || null, reviewer_name: cleanText(formData.employerRepresentativeName) || null,
        status: "draft", version: 1, notes: cleanText(formData.legislationNotes) || null,
        workplace_title: cleanText(formData.workplaceTitle) || null, workplace_address: cleanText(formData.workplaceAddress) || null, employer_name: cleanText(formData.employerName) || null,
        employer_representative_name: cleanText(formData.employerRepresentativeName) || null, occupational_safety_specialist_name: cleanText(formData.occupationalSafetySpecialistName) || null,
        workplace_doctor_name: cleanText(formData.workplaceDoctorName) || null, employee_representative_name: cleanText(formData.employeeRepresentativeName) || null, support_personnel_name: cleanText(formData.supportPersonnelName) || null,
        hazard_sources: cleanText(formData.hazardSources) || null, identified_risks: cleanText(formData.identifiedRisks) || null, control_measures: cleanText(formData.controlMeasures) || null,
        responsible_persons: cleanText(formData.responsiblePersons) || null, legislation_notes: cleanText(formData.legislationNotes) || null, renewal_triggers_note: cleanText(formData.renewalTriggersNote) || null,
      };
      const { data: insertedAssessment, error } = await supabase.from("risk_assessments").insert(payload as never).select("id, company_id").single();
      if (error) throw error;
      const signatureSavedAt = new Date().toISOString();
      const uploadedSignatureUrls = {
        employerRepresentativeSignatureUrl: await uploadDataUrlToStorage(formData.employerRepresentativeSignatureUrl, insertedAssessment.id, "employer-representative"),
        occupationalSafetySpecialistSignatureUrl: await uploadDataUrlToStorage(formData.occupationalSafetySpecialistSignatureUrl, insertedAssessment.id, "occupational-safety-specialist"),
        workplaceDoctorSignatureUrl: await uploadDataUrlToStorage(formData.workplaceDoctorSignatureUrl, insertedAssessment.id, "workplace-doctor"),
        employeeRepresentativeSignatureUrl: await uploadDataUrlToStorage(formData.employeeRepresentativeSignatureUrl, insertedAssessment.id, "employee-representative"),
        supportPersonnelSignatureUrl: await uploadDataUrlToStorage(formData.supportPersonnelSignatureUrl, insertedAssessment.id, "support-personnel"),
      } satisfies Record<SignatureFieldKey, string | null>;
      const signaturePayload: Record<string, string | null> = {};
      signatureDbConfigs.forEach((config) => {
        const uploadedUrl = uploadedSignatureUrls[config.key];
        const meta = buildSignatureMeta(config.key, uploadedUrl, signatureSavedAt);
        signaturePayload[config.dbUrlKey] = uploadedUrl;
        signaturePayload[config.dbStatusKey] = meta?.status || "Bekliyor";
        signaturePayload[config.dbSignedAtKey] = meta?.signedAt || null;
      });
      if (Object.values(signaturePayload).some((value) => value !== null)) {
        const { error: updateError } = await supabase.from("risk_assessments").update(signaturePayload as never).eq("id", insertedAssessment.id);
        if (updateError) throw updateError;
      }
      sessionStorage.setItem("risk-editor-bridge", JSON.stringify({ assessmentId: insertedAssessment.id, companyId: insertedAssessment.company_id, createdFromWizard: true, createdAt: Date.now() }));
      toast.success("Risk değerlendirme taslağı oluşturuldu.", { description: "Detaylı yönetim için editör ekranına geçiliyor." });
      clearDraft();
      setFormData(createInitialFormData()); setCurrentStep(0);
      navigate("/risk-editor", { state: { assessmentId: insertedAssessment.id, companyId: insertedAssessment.company_id, createdFromWizard: true } });
    } catch (error: any) { toast.error(error.message || "Kayıt oluşturulamadı."); }
    finally { setSubmitting(false); }
  };

  const inputField = (label: string, fieldKey: keyof FormData, setter: (value: string) => void, placeholder: string, className?: string, type = "text") => {
    const isError = touched[fieldKey] && !cleanText(formData[fieldKey] as string);
    return (
      <div className={cn("space-y-2", className)}>
        <Label className={cn("text-xs font-semibold uppercase tracking-wider text-slate-400", isError && "text-red-400")}>
          {label}
        </Label>
        <Input 
          type={type}
          value={formData[fieldKey] as string || ""} 
          onChange={(e) => setter(e.target.value)} 
          placeholder={placeholder} 
          className={cn(
            "h-12 bg-slate-900/50 border-slate-800 focus:border-cyan-500/50 focus:ring-cyan-500/20 text-slate-100 placeholder:text-slate-600 rounded-xl transition-all",
            isError && "border-red-500/50 focus:border-red-500 focus:ring-red-500/10 bg-red-950/10"
          )} 
        />
        {isError && <p className="text-xs font-medium text-red-500/90">Bu alan resmî rapor için zorunludur.</p>}
      </div>
    );
  };

  const textField = (label: string, fieldKey: keyof FormData, setter: (value: string) => void, placeholder: string, helper?: string) => {
    const isError = touched[fieldKey] && !cleanText(formData[fieldKey] as string);
    return (
      <div className="space-y-2">
        <Label className={cn("text-xs font-semibold uppercase tracking-wider text-slate-400", isError && "text-red-400")}>
          {label}
        </Label>
        <Textarea 
          value={formData[fieldKey] as string || ""} 
          onChange={(e) => setter(e.target.value)} 
          placeholder={placeholder} 
          className={cn(
            "min-h-[140px] bg-slate-900/50 border-slate-800 focus:border-cyan-500/50 focus:ring-cyan-500/20 text-slate-100 placeholder:text-slate-600 rounded-2xl transition-all",
            isError && "border-red-500/50 focus:border-red-500 focus:ring-red-500/10 bg-red-950/10"
          )} 
        />
        {isError ? (
          <p className="text-xs font-medium text-red-500/90 font-semibold">Tehlike ve tedbir analizleri boş bırakılamaz.</p>
        ) : helper ? (
          <p className="text-xs text-slate-500 leading-normal">{helper}</p>
        ) : null}
      </div>
    );
  };

  const renderSignatureCard = (role: SignatureRoleConfig) => {
    const imageUrl = formData[role.key];
    const signerName = cleanText(formData[role.nameKey]);
    return (
      <div key={role.key} className="rounded-[24px] border border-slate-800 bg-slate-900/40 p-5 shadow-[0_12px_28px_rgba(2,6,23,0.12)] transition hover:border-slate-800/80">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="space-y-1">
            <p className="text-sm font-bold text-white">{role.subtitle}</p>
            <p className="text-xs text-slate-400">{role.title}</p>
          </div>
          <Badge className={cn("rounded-full border px-2.5 py-0.5 text-[10px] tracking-wider uppercase font-semibold", imageUrl ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-slate-800 bg-slate-950 text-slate-500")}>
            {imageUrl ? "Hazır" : "Bekliyor"}
          </Badge>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[140px_1fr]">
          <button 
            type="button" 
            onClick={() => imageUrl && setSignaturePreview({ title: role.title, imageUrl, field: role.key })} 
            className="flex h-28 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 transition hover:border-slate-700/50 hover:bg-slate-950 disabled:cursor-default" 
            disabled={!imageUrl}
          >
            {imageUrl ? (
              <img src={imageUrl} alt={`${role.title} görseli`} className="h-full w-full object-contain p-2" />
            ) : (
              <div className="text-center space-y-2">
                <FileSignature className="mx-auto h-5 w-5 text-slate-600" />
                <span className="block text-[10px] text-slate-500">İmza Yok</span>
              </div>
            )}
          </button>
          <div className="flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="text-xs text-slate-500 leading-normal">{role.helper}</div>
              {signerName ? (
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300">
                  <Users className="h-3 w-3 text-cyan-400" />
                  {signerName}
                </div>
              ) : (
                <div className="text-xs font-semibold text-amber-500/90 inline-flex items-center gap-1">
                  <Info className="h-3.5 w-3.5" /> Ad-soyad bilgisi girilmelidir.
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" size="sm" variant="outline" className="h-9 rounded-xl border-slate-800 bg-slate-900/50 text-slate-200 hover:bg-slate-900" onClick={() => signatureInputRefs.current[role.key]?.click()}>
                <Upload className="mr-1.5 h-3.5 w-3.5" />Yükle
              </Button>
              {imageUrl && (
                <>
                  <Button type="button" size="sm" variant="outline" className="h-9 rounded-xl border-cyan-500/20 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20" onClick={() => setSignaturePreview({ title: role.title, imageUrl, field: role.key })}>
                    <FileSearch className="mr-1.5 h-3.5 w-3.5" />Büyüt
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-9 rounded-xl border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20" onClick={() => updateForm(role.key, null)}>
                    <X className="mr-1.5 h-3.5 w-3.5" />Kaldır
                  </Button>
                </>
              )}
            </div>
          </div>
          <input ref={(node) => { signatureInputRefs.current[role.key] = node; }} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => handleSignatureUpload(role.key, event)} />
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-cyan-500/10 bg-cyan-500/5 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-400">1. Adım · İşyeri Temel Kaydı</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">Yönetmeliğin 12. maddesi uyarınca raporda bulunması zorunlu olan unvan, adres ve işveren bilgilerini giriniz.</p>
            </div>
            
            <div className="space-y-4">
              {inputField("Rapor / Firma Başlığı *", "firmName", (v) => updateForm("firmName", v), "Örn: ABC Endüstri A.Ş. Risk Değerlendirme Raporu")}
              
              <div className="grid gap-4 md:grid-cols-2">
                {inputField("İşyeri Unvanı *", "workplaceTitle", (v) => updateForm("workplaceTitle", v), "Resmî işyeri unvanı")}
                {inputField("İşveren Adı *", "employerName", (v) => updateForm("employerName", v), "İşveren veya yetkili vekil")}
              </div>

              {inputField("İşyeri Adresi *", "workplaceAddress", (v) => updateForm("workplaceAddress", v), "Sistemde kayıtlı açık adres")}

              <div className="grid gap-4 md:grid-cols-2">
                {inputField("Bölüm / Departman", "department", (v) => updateForm("department", v), "Örn: Kaynakhane, Depolama Alanı")}
                
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tehlike Sınıfı *</Label>
                  <Select value={formData.hazardLevel} onValueChange={(value) => handleHazardLevelChange(value as HazardLevel)}>
                    <SelectTrigger className="h-12 rounded-xl border-slate-800 bg-slate-900/50 text-white focus:ring-cyan-500/20 focus:border-cyan-500/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-slate-950 text-slate-100">
                      <SelectItem value="Az Tehlikeli">🟢 Az Tehlikeli</SelectItem>
                      <SelectItem value="Tehlikeli">🟡 Tehlikeli</SelectItem>
                      <SelectItem value="Çok Tehlikeli">🔴 Çok Tehlikeli</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 mt-2">
              {(["Az Tehlikeli", "Tehlikeli", "Çok Tehlikeli"] as HazardLevel[]).map((level) => {
                const config = hazardConfig[level];
                const isSelected = formData.hazardLevel === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => handleHazardLevelChange(level)}
                    className={cn(
                      "flex flex-col text-left p-4 rounded-2xl border transition-all",
                      isSelected 
                        ? cn("bg-slate-900 border-2", config.borderClass)
                        : "border-slate-800 bg-slate-900/20 opacity-60 hover:opacity-100"
                    )}
                  >
                    <span className="text-sm font-bold text-slate-100">{config.icon} {level}</span>
                    <span className="mt-2 text-[11px] text-slate-400 leading-snug">{config.renewalLabel} yenileme</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Kurumsal Rapor Logosu</Label>
              {formData.logo ? (
                <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <img src={formData.logo} alt="Firma logosu" className="h-32 w-full rounded-xl object-contain bg-slate-900/30" />
                  <Button type="button" size="icon" variant="outline" className="absolute right-6 top-6 rounded-lg border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20" onClick={() => updateForm("logo", null)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full rounded-2xl border border-dashed border-slate-800 bg-slate-900/10 p-8 text-center transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/5">
                  <Upload className="mx-auto h-7 w-7 text-cyan-400" />
                  <p className="mt-3 text-sm font-semibold text-slate-200">Görsel Dosyası Seçin</p>
                  <p className="mt-1 text-xs text-slate-500">PNG, JPG veya SVG · maks 2 MB</p>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">2. Adım · Atamalar ve İmzalar</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">Ekip üyelerinin isimlerini ve resmî onay süreçleri için imza/kaşe görsellerini bu alandan yönetin.</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {inputField("İşveren / İşveren Vekili Adı *", "employerRepresentativeName", (v) => updateForm("employerRepresentativeName", v), "Ad Soyad")}
                {inputField("İş Güvenliği Uzmanı Adı *", "occupationalSafetySpecialistName", (v) => updateForm("occupationalSafetySpecialistName", v), "Ad Soyad")}
                {inputField("İşyeri Hekimi Adı *", "workplaceDoctorName", (v) => updateForm("workplaceDoctorName", v), "Ad Soyad")}
                {inputField("Çalışan Temsilcisi Adı *", "employeeRepresentativeName", (v) => updateForm("employeeRepresentativeName", v), "Ad Soyad")}
                {inputField("Destek Elemanı Adı *", "supportPersonnelName", (v) => updateForm("supportPersonnelName", v), "Ad Soyad", "md:col-span-2")}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Rol Bazlı İmza & Onay Dosyaları</Label>
              <div className="grid gap-4 md:grid-cols-2">
                {signatureRoleConfigs.map(renderSignatureCard)}
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">3. Adım · Metodoloji ve Takvim</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">Raporun geçerlilik yapısını ve yasal yenileme periyotlarını tanımlayın.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Risk Değerlendirme Metodu *</Label>
                <Select value={formData.method} onValueChange={(value) => updateForm("method", value as RiskMethod)}>
                  <SelectTrigger className="h-12 rounded-xl border-slate-800 bg-slate-900/50 text-white focus:ring-cyan-500/20 focus:border-cyan-500/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-100">
                    {methodOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Rapor Hazırlama Tarihi *</Label>
                <Input type="date" value={formData.reportDate} onChange={(e) => handleReportDateChange(e.target.value)} className="h-12 rounded-xl border-slate-800 bg-slate-900/50 text-white focus:ring-cyan-500/20 focus:border-cyan-500/50 [color-scheme:dark]" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Yasal Geçerlilik Bitiş Tarihi</Label>
                <Input type="date" value={formData.validityDate} disabled className="h-12 cursor-not-allowed rounded-xl border-slate-850 bg-slate-950/80 text-slate-500 [color-scheme:dark]" />
              </div>

              <div className={cn("rounded-2xl border p-4 flex flex-col justify-center", hazardCfg.borderClass, hazardCfg.bgClass)}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tehlike Sınıfı Yenileme Döngüsü</p>
                <p className={cn("mt-1 text-sm font-bold", hazardCfg.textClass)}>{hazardCfg.renewalLabel} ({hazardCfg.years} Yıl)</p>
                <p className="mt-1 text-xs text-slate-300 leading-snug">{hazardCfg.summary}</p>
              </div>
            </div>

            {textField("Yenileme ve Kapsam Notları", "renewalTriggersNote", (v) => updateForm("renewalTriggersNote", v), "Raporun olağan dışı hangi durumlarda kısmen veya tamamen revize edileceğini belirtiniz.")}
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-rose-500/10 bg-rose-500/5 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-rose-400">4. Adım · Risk ve Tehlike Matrisi</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300 font-medium">İşyerinde tespit edilen birincil tehlike kaynaklarını ve bu kaynakların yol açabileceği potansiyel tehlikeleri giriniz.</p>
            </div>

            {textField("Tehlike Kaynakları *", "hazardSources", (v) => updateForm("hazardSources", v), "Örn: Yüksekte çalışma, elektrik tesisatı, kimyasal depolama alanları, ergonomik risk etmenleri...")}
            {textField("Doğabilecek Yasal Riskler *", "identifiedRisks", (v) => updateForm("identifiedRisks", v), "Örn: Düşme sonucu yaralanma, elektrik şoku, solvent maruziyeti bağlı meslek hastalıkları...")}
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">5. Adım · Önleyici Eylem Planı</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">Tehlikelerin bertaraf edilmesi için uygulanacak düzeltici-önleyici tedbirleri ve sorumluları bağlayın.</p>
            </div>

            {textField("Kararlaştırılan Tedbirler *", "controlMeasures", (v) => updateForm("controlMeasures", v), "Örn: Yaşam hatlarının çekilmesi, periyodik kontrol takipleri, kişisel koruyucu donanım (KKD) temini...")}
            {textField("Sorumlu Kadro & Departmanlar *", "responsiblePersons", (v) => updateForm("responsiblePersons", v), "Örn: Bakım Onarım Müdürü, İSG Sorumlusu, İlgili Postabaşı...")}
            {textField("Mevzuat Referansları ve Notlar", "legislationNotes", (v) => updateForm("legislationNotes", v), "6331 Sayılı Kanun, Yapı İşlerinde İSG Yönetmeliği vb. standart referansları ekleyebilirsiniz.")}
          </div>
        );
      default:
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">6. Adım · Resmî Önizleme</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">Oluşturulacak yasal belgenin sayfa düzenini ve onay tablosunu kontrol edin. Her şey hazırsa kaydı tamamlayın.</p>
            </div>
            
            <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
              <Card className="border-slate-800 bg-slate-950 shadow-inner overflow-hidden">
                <CardContent className="p-6">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shrink-0">
                          {formData.logo ? <img src={formData.logo} alt="Logo" className="h-full w-full object-contain" /> : <FileText className="h-5 w-5 text-slate-400" />}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Yönetmelik Uyumlu Risk Değerlendirmesi</p>
                          <p className="text-base font-black text-slate-900">{brandedCompanyName}</p>
                          <p className="text-xs text-slate-500 font-semibold">{formData.workplaceTitle || "İşyeri Ünvanı Eksik"}</p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-left sm:text-right shrink-0">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Geçerlilik</p>
                        <p className="text-xs font-bold text-slate-800">{formatDisplayDate(formData.validityDate)}</p>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-2">Döngü</p>
                        <p className="text-xs font-bold text-slate-800">{formData.hazardLevel}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4 mt-4">
                      <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                        <div className="grid grid-cols-[140px_1fr] border-b border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-700">
                          <div>PARAMETRE</div>
                          <div>İŞYERİ BİLGİSİ</div>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {[
                            ["İşyeri Unvanı", formData.workplaceTitle],
                            ["İşveren Yetkili", formData.employerName],
                            ["Açık Adres", formData.workplaceAddress],
                            ["Bölüm / Alan", formData.department]
                          ].map(([label, val]) => (
                            <div key={label} className="grid grid-cols-[140px_1fr] px-3 py-2">
                              <span className="font-semibold text-slate-500">{label}</span>
                              <span className="text-slate-800">{val || "-"}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-lg overflow-hidden text-[11px]">
                        <div className="grid grid-cols-[140px_1fr_100px] border-b border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-700">
                          <div>EKİP ROLÜ</div>
                          <div>AD SOYAD</div>
                          <div className="text-center">İRE / ONAY</div>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {signatureRoleConfigs.map((role) => (
                            <div key={role.key} className="grid grid-cols-[140px_1fr_100px] px-3 py-2 items-center">
                              <div className="font-semibold text-slate-700">{role.subtitle}</div>
                              <div className="text-slate-600 truncate">{cleanText(formData[role.nameKey]) || "-"}</div>
                              <div className="flex justify-center">
                                {formData[role.key] ? (
                                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[9px] hover:bg-emerald-50 shrink-0">ONAYLI</Badge>
                                ) : (
                                  <Badge className="border-amber-200 bg-amber-50 text-amber-700 text-[9px] hover:bg-amber-50 shrink-0">BEKLİYOR</Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="border-slate-850 bg-slate-900/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs uppercase tracking-wider text-slate-400">Yasal Uyum Raporu</CardTitle>
                    <CardDescription className="text-xs text-slate-500">Raporun yasal geçerlilik durumu:</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[
                      ["Üst Bilgi Blokları", cleanText(formData.firmName) && cleanText(formData.workplaceTitle) && cleanText(formData.employerName)],
                      ["Ekip Kadrosu", cleanText(formData.employerRepresentativeName) && cleanText(formData.occupationalSafetySpecialistName) && cleanText(formData.workplaceDoctorName)],
                      ["Matris ve Çözüm Notları", cleanText(formData.hazardSources) && cleanText(formData.controlMeasures)]
                    ].map(([label, ok]) => (
                      <div key={label as string} className="flex items-center justify-between rounded-xl bg-slate-950/50 border border-slate-850 px-3.5 py-2 text-xs text-slate-200">
                        <span>{label}</span>
                        <Badge className={cn("rounded-full border text-[10px] font-semibold tracking-wide", ok ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400")}>
                          {ok ? "TAMAM" : "EKSİK"}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Button type="button" onClick={generatePDFPreview} className="w-full h-12 rounded-xl bg-violet-600 text-white hover:bg-violet-700 font-bold shadow-lg shadow-violet-600/10 transition-all border-none">
                  <Download className="mr-2 h-4 w-4" /> PDF Olarak İndir
                </Button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <div className="theme-page-readable space-y-8">
        <section className="overflow-hidden rounded-[30px] border border-slate-800 bg-slate-950 p-6 md:p-8 shadow-[0_20px_48px_rgba(2,6,23,0.28)]">
          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr] items-center">
            <div className="space-y-4">
              <Badge className="rounded-full border border-slate-800 bg-slate-900 text-slate-300 font-semibold px-3 py-1 text-xs">
                Yönetmelik Uyum Sihirbazı
              </Badge>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
                Standartlara uygun risk değerlendirme raporu hazırlayın
              </h1>
              <p className="text-sm leading-relaxed text-slate-400 max-w-2xl">
                Bu sihirbaz, yasal zorunluluklara uygun şekilde işyeri bilgilerini, ekip kadrolarını, analiz metotlarını, tehlike kaynaklarını ve imza matrisini adım adım bir araya getirir.
              </p>
            </div>
            
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">Aktif Rapor Süreci</span>
                <Badge className={cn("rounded-full border px-2.5 py-0.5 text-[10px] tracking-wide uppercase font-semibold", pdfReady ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400")}>
                  {pdfReady ? "Hazır" : "Taslak"}
                </Badge>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-900">
                <div className="h-full rounded-full bg-cyan-500 transition-all duration-300" style={{ width: `${completionRatio}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>İlerleme Oranı</span>
                <span className="font-bold text-white">%{Math.round(completionRatio)}</span>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <Card className="border-slate-850 bg-slate-950/80 shadow-2xl rounded-[28px] overflow-hidden">
            <CardContent className="space-y-6 p-6">
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
                {steps.map((step, index) => {
                  const isActive = index === currentStep;
                  const isCompleted = index < currentStep;
                  const progressPercent = Math.round((stepCompletionCounts[index].completed / stepCompletionCounts[index].total) * 100);
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => {
                        if (index <= currentStep) {
                          setCurrentStep(index);
                        } else {
                          const check = isStepValid(currentStep);
                          if (!check.valid) {
                            toast.error(check.message);
                          } else {
                            setCurrentStep(index);
                          }
                        }
                      }}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-all relative overflow-hidden",
                        isActive && "border-cyan-500/30 bg-cyan-500/5",
                        isCompleted && "border-slate-800 bg-slate-900/30",
                        !isActive && !isCompleted && "border-slate-800 bg-slate-950 hover:bg-slate-900/40"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg border text-xs", 
                          isActive && "border-cyan-500/30 bg-cyan-500/10 text-cyan-400", 
                          isCompleted && "border-emerald-500/20 bg-emerald-500/10 text-emerald-400", 
                          !isActive && !isCompleted && "border-slate-800 bg-slate-900 text-slate-400"
                        )}>
                          {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.icon}
                        </div>
                        <span className="text-[11px] font-bold text-slate-100 truncate">{step.label}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
                        <span>Tamamlanan</span>
                        <span className="font-bold text-slate-300">{stepCompletionCounts[index].completed}/{stepCompletionCounts[index].total}</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-900">
                        <div className={cn("h-full rounded-full transition-all", isCompleted && "bg-emerald-400", isActive && "bg-cyan-500", !isActive && !isCompleted && "bg-slate-800")} style={{ width: `${progressPercent}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-slate-850 bg-slate-900/20 p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-white">{currentStepConfig.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{currentStepConfig.description}</p>
                </div>
                {renderStepContent()}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-850 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => handleStepNavigation("prev")} 
                  disabled={currentStep === 0} 
                  className="rounded-xl border-slate-800 bg-slate-900/50 text-slate-100 hover:bg-slate-900"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" /> Geri
                </Button>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={resetWizardDraft} 
                    disabled={submitting} 
                    className="rounded-xl border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  >
                    <X className="mr-2 h-4 w-4" /> Taslağı Temizle
                  </Button>
                  <Button 
                    type="button" 
                    onClick={currentStep === steps.length - 1 ? handleSubmit : () => handleStepNavigation("next")} 
                    disabled={submitting} 
                    className="rounded-xl bg-violet-650 text-white hover:bg-violet-700 font-bold border-none transition-all shadow-md active:scale-95"
                  >
                    {submitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Editör Hazırlanıyor...</>
                    ) : currentStep === steps.length - 1 ? (
                      <><FilePenLine className="mr-2 h-4 w-4" /> Kaydet ve Editöre Geç</>
                    ) : (
                      <span className="flex items-center text-white">İleri <ChevronRight className="ml-2 h-4 w-4" /></span>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-slate-850 bg-slate-950/80 rounded-[28px] shadow-2xl p-5">
              <p className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">Rapor Kimliği</p>
              <div className="mt-4 space-y-3">
                {[
                  ["Yasal Unvan", formData.workplaceTitle || "Henüz Belirtilmedi"],
                  ["İSG Değerlendirme Yöntemi", formData.method],
                  ["Yasal Süre Sonu", formData.validityDate ? formatDisplayDate(formData.validityDate) : "Otomatik Hesaplanacak"],
                  ["Yenileme Tipi", formData.hazardLevel]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-850/80 bg-slate-900/10 p-3.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
                    <p className="mt-1 text-sm font-bold text-slate-100 truncate">{value}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-slate-850 bg-slate-950/80 rounded-[28px] shadow-2xl p-5">
              <p className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">Resmî Kapsam Notu</p>
              <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-400">
                <div className="rounded-xl bg-slate-900/10 border border-slate-850 p-4 space-y-1">
                  <p className="font-bold text-slate-200">İşyeri ve Kurul Kadrosu</p>
                  <p>Mevzuat uyarınca işveren, İSG uzmanı, hekim, temsilci ve destek elemanı atama yazıları PDF tablosuna otomatik yansıtılır.</p>
                </div>
                <div className="rounded-xl bg-slate-900/10 border border-slate-850 p-4 space-y-1">
                  <p className="font-bold text-slate-200">Kaza ve Revizyon Notu</p>
                  <p>İş kazası, proses veya ekipman değişikliği gibi acil durumlarda raporun revize edilmesi gerektiği uyarısı otomatik basılır.</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      
      <Dialog open={Boolean(signaturePreview)} onOpenChange={(open) => !open && setSignaturePreview(null)}>
        <DialogContent className="max-w-3xl border-slate-800 bg-slate-950 text-white rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black">{signaturePreview?.title || "İmza Görseli"}</DialogTitle>
          </DialogHeader>
          {signaturePreview && (
            <div className="space-y-4">
              <div className="flex h-80 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
                <img src={signaturePreview.imageUrl} alt={signaturePreview.title} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-900"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = signaturePreview.imageUrl;
                    link.download = `${asciiSlug(signaturePreview.title)}-signature.png`;
                    link.click();
                  }}
                >
                  <Download className="mr-2 h-4 w-4" /> İndir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-cyan-500/20 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
                  onClick={() => {
                    signatureInputRefs.current[signaturePreview.field]?.click();
                    setSignaturePreview(null);
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" /> Değiştir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  onClick={() => {
                    updateForm(signaturePreview.field, null);
                    setSignaturePreview(null);
                  }}
                >
                  <X className="mr-2 h-4 w-4" /> Kaldır
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}