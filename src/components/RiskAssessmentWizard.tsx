import { ChangeEvent, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Building2, CheckCircle2, ChevronLeft, ChevronRight, Download, FilePenLine, FileSearch, FileSignature, FileText, Loader2, ShieldCheck, Upload, Users, X } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { addInterFontsToJsPDF } from "@/utils/fonts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const today = new Date().toISOString().split("T")[0];
const steps: WizardStep[] = [
  { id: "isyeri", label: "İşyeri Bilgileri", title: "Resmî üst bilgi alanını tamamlayın", description: "Unvan, adres, işveren bilgisi ve tehlike sınıfını hazırlayın.", icon: <Building2 className="h-5 w-5" /> },
  { id: "ekip", label: "Ekip Üyeleri", title: "Risk değerlendirme ekibini tanımlayın", description: "İşveren/vekili, İSG uzmanı, işyeri hekimi, çalışan temsilcisi ve destek elemanlarını girin.", icon: <Users className="h-5 w-5" /> },
  { id: "yontem", label: "Yöntem ve Tarihler", title: "Analiz yöntemi ve geçerlilik yapısını belirleyin", description: "Risk analiz yöntemi, analiz tarihi ve geçerlilik alanlarını tamamlayın.", icon: <FileSearch className="h-5 w-5" /> },
  { id: "tehlike", label: "Tehlike ve Riskler", title: "Tehlike kaynaklarını ve riskleri yazın", description: "Tehlike kaynaklarını ve bunlardan doğabilecek riskleri net biçimde girin.", icon: <AlertTriangle className="h-5 w-5" /> },
  { id: "tedbir", label: "Kontrol Tedbirleri", title: "Tedbirleri ve sorumluları bağlayın", description: "Düzeltici ve önleyici faaliyetleri, sorumluları ve mevzuat notlarını tamamlayın.", icon: <ShieldCheck className="h-5 w-5" /> },
  { id: "onizleme", label: "Önizleme ve PDF", title: "Resmî raporu son kez kontrol edin", description: "Zorunlu içerikleri gözden geçirin, PDF alın ve kaydı oluşturun.", icon: <Download className="h-5 w-5" /> },
];

const hazardConfig = {
  "Az Tehlikeli": { years: 6, icon: "🟢", pillClass: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100", accentClass: "from-emerald-500/20 to-teal-500/5", summary: "Az tehlikeli işyerlerinde rapor en geç 6 yılda bir yenilenmelidir.", renewalLabel: "6 yılda bir" },
  "Tehlikeli": { years: 4, icon: "🟡", pillClass: "border-amber-400/20 bg-amber-500/10 text-amber-100", accentClass: "from-amber-500/20 to-orange-500/5", summary: "Tehlikeli işyerlerinde rapor en geç 4 yılda bir yenilenmelidir.", renewalLabel: "4 yılda bir" },
  "Çok Tehlikeli": { years: 2, icon: "🔴", pillClass: "border-red-400/20 bg-red-500/10 text-red-100", accentClass: "from-red-500/20 to-rose-500/5", summary: "Çok tehlikeli işyerlerinde rapor en geç 2 yılda bir yenilenmelidir.", renewalLabel: "2 yılda bir" },
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
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const hazardCfg = hazardConfig[formData.hazardLevel];
  const currentStepConfig = steps[currentStep];
  const completionRatio = ((currentStep + 1) / steps.length) * 100;
  const brandedCompanyName = cleanText(formData.firmName) || "Kurumsal risk değerlendirme raporu";
  const createdAtLabel = useMemo(() => new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date()), []);
  const checklist = useMemo(() => [formData.workplaceTitle, formData.workplaceAddress, formData.employerName, formData.employerRepresentativeName, formData.occupationalSafetySpecialistName, formData.workplaceDoctorName, formData.employeeRepresentativeName, formData.supportPersonnelName, formData.reportDate, formData.validityDate, formData.method, formData.hazardSources, formData.identifiedRisks, formData.controlMeasures, formData.responsiblePersons].map(cleanText), [formData]);
  const completedFields = checklist.filter(Boolean).length;
  const pdfReady = completedFields >= 13;
  const signatureCount = signatureRoleConfigs.filter((role) => Boolean(formData[role.key])).length;
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
  const formalCardClass = "border-slate-200/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.92))] shadow-[0_18px_42px_rgba(2,6,23,0.24)]";

  const updateForm = <K extends keyof FormData>(key: K, value: FormData[K]) => setFormData((prev) => ({ ...prev, [key]: value }));
  const handleHazardLevelChange = (level: HazardLevel) => setFormData((prev) => ({ ...prev, hazardLevel: level, validityDate: calculateValidityDate(prev.reportDate, level), renewalTriggersNote: cleanText(prev.renewalTriggersNote) === cleanText(defaultRenewalNote(prev.hazardLevel)) || !cleanText(prev.renewalTriggersNote) ? defaultRenewalNote(level) : prev.renewalTriggersNote }));
  const handleReportDateChange = (date: string) => setFormData((prev) => ({ ...prev, reportDate: date, validityDate: date ? calculateValidityDate(date, prev.hazardLevel) : "" }));
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
    const { error } = await supabase.storage.from("risk-assessment-signatures").upload(path, blob, { contentType: blob.type || "image/png", upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("risk-assessment-signatures").getPublicUrl(path);
    return data.publicUrl;
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
      const signColX = marginX + roleColWidth + nameColWidth + statusColWidth;
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
    table("Analiz Takvimi", [["Analiz Tarihi", formatDisplayDate(formData.reportDate)], ["Geçerlilik Bitişi", formatDisplayDate(formData.validityDate)], ["Yenileme Periyodu", hazardCfg.renewalLabel], ["Risk Analiz Yöntemi", formData.method]]);
    section("Tehlike Tanımları", formData.hazardSources); section("Doğabilecek Riskler", formData.identifiedRisks); section("Kontrol Tedbirleri", formData.controlMeasures); section("Uygulama Sorumluları", formData.responsiblePersons); section("Mevzuat ve Uygunluk Notları", formData.legislationNotes); section("Yenileme ve Güncelleme Notu", formData.renewalTriggersNote); signatureTable(); footer();
    doc.save(`Isg-Risk-Degerlendirme-Raporu-${cleanText(formData.firmName || "taslak")}-${Date.now()}.pdf`); toast.success("PDF oluşturuldu ve indirildi.");
  };

  const handleSubmit = async () => {
    if (!user?.id) return toast.error("Kullanıcı oturumu bulunamadı.");
    if (!cleanText(formData.firmName) || !cleanText(formData.workplaceTitle) || !cleanText(formData.workplaceAddress)) return toast.error("Lütfen işyeri temel bilgilerini eksiksiz doldurun.");
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
      toast.success("Risk değerlendirme taslağı oluşturuldu.", { description: "Şimdi detaylı madde yönetimi için editör ekranına geçiyoruz." });
      setFormData(createInitialFormData()); setCurrentStep(0);
      navigate("/risk-editor", { state: { assessmentId: insertedAssessment.id, companyId: insertedAssessment.company_id, createdFromWizard: true } });
    } catch (error: any) { toast.error(error.message || "Kayıt oluşturulamadı."); }
    finally { setSubmitting(false); }
  };

  const inputField = (label: string, value: string, setter: (value: string) => void, placeholder: string, className?: string) => (
    <div className={cn("space-y-2", className)}><Label className="text-sm font-semibold text-slate-200">{label}</Label><Input value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder} className="h-12 rounded-2xl border-slate-200/10 bg-slate-950/55 text-slate-100 placeholder:text-slate-500" /></div>
  );
  const textField = (label: string, value: string, setter: (value: string) => void, placeholder: string, helper?: string) => (
    <div className="space-y-2"><Label className="text-sm font-semibold text-slate-200">{label}</Label><Textarea value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder} className="min-h-[150px] rounded-[24px] border-slate-200/10 bg-slate-950/55 text-slate-100 placeholder:text-slate-500" />{helper ? <p className="text-xs text-slate-500">{helper}</p> : null}</div>
  );
  const renderSignatureCard = (role: SignatureRoleConfig) => {
    const imageUrl = formData[role.key];
    const signerName = cleanText(formData[role.nameKey]);
    return <div key={role.key} className="rounded-[24px] border border-slate-200/10 bg-slate-950/55 p-4 shadow-[0_10px_26px_rgba(2,6,23,0.18)]"><div className="flex items-start justify-between gap-3 border-b border-slate-200/10 pb-3"><div><p className="text-sm font-semibold text-white">{role.title}</p><p className="mt-1 text-xs font-medium text-slate-300">{role.subtitle}</p><p className="mt-1 text-xs leading-5 text-slate-500">{role.helper}</p></div><Badge className={cn("rounded-full border", imageUrl ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100" : "border-slate-200/10 bg-white/[0.04] text-slate-300")}>{imageUrl ? "Hazır" : "Bekliyor"}</Badge></div><div className="mt-3 grid gap-3 lg:grid-cols-[180px_1fr]"><button type="button" onClick={() => imageUrl && setSignaturePreview({ title: role.title, imageUrl, field: role.key })} className="flex h-28 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-200/10 bg-slate-900/80 transition hover:border-slate-300/20 hover:bg-slate-900 disabled:cursor-default" disabled={!imageUrl}>{imageUrl ? <img src={imageUrl} alt={`${role.title} görseli`} className="h-full w-full object-contain p-3" /> : <FileSignature className="h-7 w-7 text-slate-500" />}</button><div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200/10 bg-white/[0.03] px-3 py-2"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Ad Soyad</p><p className="mt-1 text-sm font-semibold text-white">{signerName || "-"}</p></div><div className="rounded-2xl border border-slate-200/10 bg-white/[0.03] px-3 py-2"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Onay Durumu</p><p className="mt-1 text-sm font-semibold text-white">{imageUrl ? "Hazır" : "Bekliyor"}</p></div><div className="rounded-2xl border border-slate-200/10 bg-white/[0.03] px-3 py-2 sm:col-span-2"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">İmza Tarihi</p><p className="mt-1 text-sm font-semibold text-white">{imageUrl ? formatDisplayDate(formData.reportDate) : "-"}</p></div></div><div className="flex flex-1 flex-wrap gap-2"><Button type="button" variant="outline" className="rounded-2xl border-slate-200/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.1]" onClick={() => signatureInputRefs.current[role.key]?.click()}><Upload className="mr-2 h-4 w-4" />İmza / Kaşe Yükle</Button>{imageUrl ? <Button type="button" variant="outline" className="rounded-2xl border-cyan-400/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15" onClick={() => setSignaturePreview({ title: role.title, imageUrl, field: role.key })}><FileSearch className="mr-2 h-4 w-4" />Büyüt</Button> : null}{imageUrl ? <Button type="button" variant="outline" className="rounded-2xl border-red-400/20 bg-red-500/10 text-red-100 hover:bg-red-500/15" onClick={() => updateForm(role.key, null)}><X className="mr-2 h-4 w-4" />Kaldır</Button> : null}</div></div><input ref={(node) => { signatureInputRefs.current[role.key] = node; }} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => handleSignatureUpload(role.key, event)} /></div></div>;
  };
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <div className="space-y-6"><div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/5 p-4"><p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">1. Adım · İşyeri Bilgileri</p><p className="mt-2 text-sm leading-6 text-slate-300">İşyeri unvanı, adres, işveren adı ve tehlike sınıfını resmî üst bilgi olarak hazırlayın.</p></div><div className="grid gap-4 md:grid-cols-2">{inputField("Firma / Rapor Başlığı *", formData.firmName, (v) => updateForm("firmName", v), "Örn: ABC Endüstri A.Ş. Risk Değerlendirme Raporu", "md:col-span-2")}{inputField("İşyeri Unvanı *", formData.workplaceTitle, (v) => updateForm("workplaceTitle", v), "Resmî işyeri unvanı")}{inputField("İşveren Adı *", formData.employerName, (v) => updateForm("employerName", v), "İşveren veya şirket yetkilisi")}{inputField("İşyeri Adresi *", formData.workplaceAddress, (v) => updateForm("workplaceAddress", v), "Açık adres bilgisi", "md:col-span-2")}{inputField("Bölüm / Alan", formData.department, (v) => updateForm("department", v), "Örn: Üretim hattı")}<div className="space-y-2"><Label className="text-sm font-semibold text-slate-200">Tehlike Sınıfı *</Label><Select value={formData.hazardLevel} onValueChange={(value) => handleHazardLevelChange(value as HazardLevel)}><SelectTrigger className="h-12 rounded-2xl border-white/10 bg-white/[0.04] text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="border-white/10 bg-slate-950 text-slate-100"><SelectItem value="Az Tehlikeli">🟢 Az Tehlikeli</SelectItem><SelectItem value="Tehlikeli">🟡 Tehlikeli</SelectItem><SelectItem value="Çok Tehlikeli">🔴 Çok Tehlikeli</SelectItem></SelectContent></Select></div></div><div className="space-y-3"><Label className="text-sm font-semibold text-slate-200">Firma Logosu</Label>{formData.logo ? <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/60 p-4"><img src={formData.logo} alt="Firma logosu" className="h-40 w-full rounded-2xl object-contain bg-white/[0.03]" /><Button type="button" size="icon" variant="outline" className="absolute right-6 top-6 rounded-xl border-red-400/20 bg-red-500/10 text-red-100 hover:bg-red-500/15" onClick={() => updateForm("logo", null)}><X className="h-4 w-4" /></Button></div> : <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full rounded-[24px] border border-dashed border-white/15 bg-white/[0.03] p-8 text-center transition-colors hover:border-cyan-400/30 hover:bg-cyan-500/5"><Upload className="mx-auto h-8 w-8 text-cyan-200" /><p className="mt-3 text-sm font-semibold text-slate-100">Kurumsal logo yükleyin</p><p className="mt-1 text-xs text-slate-500">PNG, JPG veya SVG · maksimum 2 MB</p></button>}<input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" /></div></div>;
      case 1:
        return <div className="space-y-6"><div className="rounded-2xl border border-slate-200/10 bg-white/[0.025] p-4"><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">2. Adım · Risk Değerlendirme Ekibi</p><p className="mt-2 text-sm leading-6 text-slate-300">Ekip üyeleri, raporda rol bazlı imza ve onay alanlarıyla birlikte resmî tabloda gösterilir. Önce isimleri, ardından varsa imza / kaşe görsellerini hazırlayın.</p></div><div className="rounded-[24px] border border-slate-200/10 bg-slate-950/45 p-4"><div className="mb-4 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200/10 bg-white/[0.03] px-3 py-2"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Toplam Rol</p><p className="mt-1 text-sm font-semibold text-white">5 ekip üyesi</p></div><div className="rounded-2xl border border-slate-200/10 bg-white/[0.03] px-3 py-2"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Hazır İmza</p><p className="mt-1 text-sm font-semibold text-white">{signatureCount}/5</p></div><div className="rounded-2xl border border-slate-200/10 bg-white/[0.03] px-3 py-2"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Onay Yapısı</p><p className="mt-1 text-sm font-semibold text-white">Rol bazlı tablo düzeni</p></div></div><div className="grid gap-4 md:grid-cols-2">{inputField("İşveren / Vekili *", formData.employerRepresentativeName, (v) => updateForm("employerRepresentativeName", v), "Ad Soyad")}{inputField("İSG Uzmanı *", formData.occupationalSafetySpecialistName, (v) => updateForm("occupationalSafetySpecialistName", v), "Ad Soyad")}{inputField("İşyeri Hekimi *", formData.workplaceDoctorName, (v) => updateForm("workplaceDoctorName", v), "Ad Soyad")}{inputField("Çalışan Temsilcisi *", formData.employeeRepresentativeName, (v) => updateForm("employeeRepresentativeName", v), "Ad Soyad")}{inputField("Destek Elemanı *", formData.supportPersonnelName, (v) => updateForm("supportPersonnelName", v), "Ad Soyad", "md:col-span-2")}</div></div><div className="grid gap-4 xl:grid-cols-2">{signatureRoleConfigs.map(renderSignatureCard)}</div></div>;
      case 2:
        return <div className="space-y-6"><div className="rounded-2xl border border-slate-200/10 bg-white/[0.025] p-4"><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">3. Adım · Yöntem ve Geçerlilik</p><p className="mt-2 text-sm leading-6 text-slate-300">Bu bölüm, resmî rapordaki analiz takvimi tablosunu oluşturur. Yöntem, analiz tarihi, yenileme periyodu ve geçerlilik tarihi doğrudan belge kapağına ve özet tablolarına yansır.</p></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label className="text-sm font-semibold text-slate-200">Risk Analiz Yöntemi *</Label><Select value={formData.method} onValueChange={(value) => updateForm("method", value as RiskMethod)}><SelectTrigger className="h-12 rounded-2xl border-slate-200/10 bg-slate-950/55 text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="border-white/10 bg-slate-950 text-slate-100">{methodOptions.map((method) => <SelectItem key={method} value={method}>{method}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label className="text-sm font-semibold text-slate-200">Analiz Tarihi *</Label><Input type="date" value={formData.reportDate} onChange={(e) => handleReportDateChange(e.target.value)} className="h-12 rounded-2xl border-slate-200/10 bg-slate-950/55 text-slate-100" /></div><div className="space-y-2"><Label className="text-sm font-semibold text-slate-200">Geçerlilik Bitişi</Label><Input type="date" value={formData.validityDate} disabled className="h-12 cursor-not-allowed rounded-2xl border-slate-200/10 bg-slate-950/50 text-slate-400" /></div><div className="rounded-2xl border border-slate-200/10 bg-slate-950/45 p-4"><p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Yenileme Periyodu</p><p className="mt-2 text-sm font-semibold text-white">{hazardCfg.renewalLabel}</p><p className="mt-2 text-xs leading-5 text-slate-400">{hazardCfg.summary}</p></div></div>{textField("Yenileme ve Güncelleme Notu", formData.renewalTriggersNote, (v) => updateForm("renewalTriggersNote", v), "Kaza, proses değişikliği veya yeni makine alınması durumunda yapılacak güncelleme notunu yazın.")}</div>;
      case 3:
        return <div className="space-y-6"><div className="rounded-2xl border border-rose-400/15 bg-rose-500/5 p-4"><p className="text-[11px] uppercase tracking-[0.22em] text-rose-200/80">4. Adım · Tehlike Tanımları</p><p className="mt-2 text-sm leading-6 text-slate-300">Tehlike kaynaklarını ve bunlardan doğabilecek riskleri net biçimde yazın.</p></div>{textField("Tehlike Kaynakları *", formData.hazardSources, (v) => updateForm("hazardSources", v), "Makine, ekipman, proses, kimyasal veya çevresel kaynaklı tehlikeleri yazın.")}{textField("Doğabilecek Riskler *", formData.identifiedRisks, (v) => updateForm("identifiedRisks", v), "Yaralanma, meslek hastalığı, yangın, patlama, düşme gibi sonuçları yazın.")}</div>;
      case 4:
        return <div className="space-y-6"><div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4"><p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/80">5. Adım · Kontrol Tedbirleri</p><p className="mt-2 text-sm leading-6 text-slate-300">Düzeltici ve önleyici faaliyetleri, sorumluları ve mevzuat notlarını resmileştirin.</p></div>{textField("Kontrol Tedbirleri *", formData.controlMeasures, (v) => updateForm("controlMeasures", v), "Kararlaştırılan düzeltici ve önleyici faaliyetleri yazın.")}{textField("Uygulama Sorumluları *", formData.responsiblePersons, (v) => updateForm("responsiblePersons", v), "Sorumlu kişileri ve takip rollerini yazın.")}{textField("Mevzuat / Uygunluk Notları", formData.legislationNotes, (v) => updateForm("legislationNotes", v), "İlgili yönetmelik, standart veya prosedür referanslarını ekleyin.")}</div>;
      default:
        return <div className="space-y-6"><div className="rounded-2xl border border-slate-200/10 bg-white/[0.025] p-4"><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">6. Adım · Resmî Önizleme</p><p className="mt-2 text-sm leading-6 text-slate-300">Bu görünüm, oluşturulacak PDF raporunun belge karakterini yansıtır. Kapağın, analiz takviminin ve ekip/onay tablosunun nasıl görüneceğini burada sakin ve resmî bir düzende kontrol edin.</p></div><div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]"><Card className="border-slate-200/10 bg-[#f8fbff] shadow-[0_16px_36px_rgba(15,23,42,0.1)]"><CardContent className="p-6 text-slate-900"><div className="rounded-[24px] border border-slate-200 bg-white"><div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">{formData.logo ? <img src={formData.logo} alt="Logo" className="h-full w-full object-cover" /> : <FileText className="h-5 w-5 text-slate-500" />}</div><div><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">İSG Risk Değerlendirme Raporu</p><p className="mt-2 text-lg font-black text-slate-900">{brandedCompanyName}</p><p className="mt-1 text-sm text-slate-500">{formData.workplaceTitle || "İşyeri unvanı bekleniyor"}</p></div></div><div className="min-w-[180px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Revizyon</p><p className="mt-1 text-xs font-semibold text-slate-700">Rev. 1</p><p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Geçerlilik</p><p className="mt-1 text-xs font-semibold text-slate-700">{formatDisplayDate(formData.validityDate)}</p><p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Oluşturulma</p><p className="mt-1 text-xs font-semibold text-slate-700">{createdAtLabel}</p></div></div><div className="grid gap-4 p-5"><div className="rounded-2xl border border-slate-200"><div className="grid grid-cols-[180px_1fr]"><div className="border-r border-slate-200 bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-[0.22em] text-white">İşyeri Bilgileri</div><div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">Resmî üst bilgi tablosu</div></div><div className="grid gap-px border-t border-slate-200 bg-slate-200 md:grid-cols-2">{[["İşyeri Unvanı", formData.workplaceTitle || "-"], ["İşveren Adı", formData.employerName || "-"], ["İşyeri Adresi", formData.workplaceAddress || "-"], ["Bölüm / Alan", formData.department || "-"]].map(([label, value]) => <div key={label} className="grid grid-cols-[140px_1fr] bg-white"><div className="border-r border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div><div className="px-4 py-3 text-sm font-medium text-slate-800">{value}</div></div>)}</div></div><div className="rounded-2xl border border-slate-200"><div className="grid grid-cols-[180px_1fr]"><div className="border-r border-slate-200 bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-[0.22em] text-white">Analiz Takvimi</div><div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">Yöntem ve geçerlilik bilgisi</div></div><div className="grid gap-px border-t border-slate-200 bg-slate-200 md:grid-cols-2">{[["Analiz Tarihi", formatDisplayDate(formData.reportDate)], ["Geçerlilik Bitişi", formatDisplayDate(formData.validityDate)], ["Risk Analiz Yöntemi", formData.method], ["Yenileme Periyodu", hazardCfg.renewalLabel]].map(([label, value]) => <div key={label} className="grid grid-cols-[140px_1fr] bg-white"><div className="border-r border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div><div className="px-4 py-3 text-sm font-medium text-slate-800">{value}</div></div>)}</div></div><div className="rounded-2xl border border-slate-200"><div className="grid grid-cols-[180px_1fr]"><div className="border-r border-slate-200 bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-[0.22em] text-white">İmza / Onay</div><div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">Rol bazlı onay tablosu</div></div><div className="grid grid-cols-[1.1fr_1.1fr_0.7fr_0.8fr] border-t border-slate-200 bg-slate-100 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500"><div className="border-r border-slate-200 px-4 py-3">Rol</div><div className="border-r border-slate-200 px-4 py-3">Ad Soyad</div><div className="border-r border-slate-200 px-4 py-3">Tarih / Durum</div><div className="px-4 py-3">İmza</div></div><div className="divide-y divide-slate-200">{signatureRoleConfigs.map((role) => { const imageUrl = formData[role.key]; return <div key={role.key} className="grid grid-cols-[1.1fr_1.1fr_0.7fr_0.8fr] bg-white"><div className="border-r border-slate-200 px-4 py-3"><p className="text-sm font-semibold text-slate-800">{role.subtitle}</p><p className="mt-1 text-xs text-slate-500">{role.title}</p></div><div className="border-r border-slate-200 px-4 py-3 text-sm font-medium text-slate-800">{cleanText(formData[role.nameKey]) || "-"}</div><div className="border-r border-slate-200 px-4 py-3"><p className="text-xs text-slate-500">{imageUrl ? formatDisplayDate(formData.reportDate) : "-"}</p><p className="mt-1 text-sm font-semibold text-slate-800">{imageUrl ? "Hazır" : "Bekliyor"}</p></div><div className="flex items-center justify-center px-4 py-3">{imageUrl ? <img src={imageUrl} alt={role.title} className="h-12 w-full rounded-xl border border-slate-200 object-contain p-1" /> : <div className="h-12 w-full rounded-xl border border-dashed border-slate-300 bg-slate-50" />}</div></div>; })}</div></div></div></div></CardContent></Card><div className="space-y-4"><Card className="border-slate-200/10 bg-slate-950/55"><CardContent className="p-4"><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Yönetmelik Kontrolü</p><div className="mt-3 grid gap-2">{[["İşyeri bilgileri", cleanText(formData.workplaceTitle) && cleanText(formData.workplaceAddress) && cleanText(formData.employerName)], ["Ekip üyeleri", cleanText(formData.employerRepresentativeName) && cleanText(formData.occupationalSafetySpecialistName) && cleanText(formData.workplaceDoctorName) && cleanText(formData.employeeRepresentativeName) && cleanText(formData.supportPersonnelName)], ["Analiz tarihi ve geçerlilik", cleanText(formData.reportDate) && cleanText(formData.validityDate)], ["Tehlike ve risk tanımları", cleanText(formData.hazardSources) && cleanText(formData.identifiedRisks)], ["Yöntem bilgisi", cleanText(formData.method)], ["Kontrol tedbirleri ve sorumlular", cleanText(formData.controlMeasures) && cleanText(formData.responsiblePersons)]].map(([label, ok]) => <div key={label} className="flex items-center justify-between rounded-2xl border border-slate-200/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200"><span>{label}</span><Badge className={cn("rounded-full border", ok ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100" : "border-amber-400/20 bg-amber-500/10 text-amber-100")}>{ok ? "Hazır" : "Eksik"}</Badge></div>)}</div></CardContent></Card><Card className="border-slate-200/10 bg-slate-950/55"><CardContent className="p-4"><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Belge Notu</p><p className="mt-3 text-sm leading-6 text-slate-300">PDF çıktısı, bu önizlemedeki düzeni takip eden klasik kapak, bilgi tabloları ve rol bazlı onay alanlarıyla oluşturulur. Ekranda gördüğünüz bilgi yapısı belgenin de karakterini belirler.</p></CardContent></Card><Button type="button" onClick={generatePDFPreview} className="w-full rounded-2xl bg-slate-100 text-slate-950 hover:bg-white"><Download className="mr-2 h-4 w-4" />PDF İndir</Button></div></div></div>;
    }
  };

  return (
    <>
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[30px] border border-slate-200/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.94))] p-6 shadow-[0_20px_48px_rgba(2,6,23,0.28)]">
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <Badge className="rounded-full border border-slate-200/10 bg-white/[0.04] text-slate-200">Risk Değerlendirme Akışı</Badge>
              <div className="flex min-w-[240px] items-center gap-3 rounded-2xl border border-slate-200/10 bg-white/[0.03] px-4 py-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/10 bg-slate-950/70">
                  {formData.logo ? (
                    <img src={formData.logo} alt="Firma logosu" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-5 w-5 text-cyan-100" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Marka Alanı</p>
                  <p className="truncate text-sm font-semibold text-white">{brandedCompanyName}</p>
                  <div className="mt-1 flex items-center gap-2"><p className="text-xs text-slate-400">{formData.logo ? "Logo hazır" : "Logo eklendiğinde burada görünür"}</p>{formData.logo ? <Badge className="rounded-full border border-emerald-400/20 bg-emerald-500/10 text-[10px] text-emerald-100">Hazır</Badge> : null}</div>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="ml-auto rounded-xl border-slate-200/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]">
                  <Upload className="mr-2 h-3.5 w-3.5" />
                  Logo Yükle
                </Button>
              </div>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white">Resmî içerik zorunluluklarına göre risk raporu hazırlayın</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Bu sihirbaz, yönetmeliğin 12. maddesinde yer alan işyeri bilgileri, ekip üyeleri, yöntem, tehlike tanımları, kontrol tedbirleri ve imza alanlarını eksiksiz toplar.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Resmî Alan", value: `${completedFields}/15`, hint: "Yönetmelik içeriği" },
                { label: "Geçerlilik", value: hazardCfg.renewalLabel, hint: formData.hazardLevel },
                { label: "İmza Alanı", value: `${signatureCount}/5`, hint: "Hazır imza / kaşe" },
              ].map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-slate-200/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{metric.label}</p>
                  <p className="mt-2 text-sm font-semibold text-white">{metric.value}</p>
                  <p className="mt-1 text-xs text-slate-400">{metric.hint}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-[26px] border border-slate-200/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Tehlike Profili</p>
                  <p className="mt-2 text-lg font-black text-white">{hazardCfg.icon} {formData.hazardLevel}</p>
                </div>
                <Badge className="border-slate-200/10 bg-white/[0.04] text-slate-100">{hazardCfg.renewalLabel}</Badge>
              </div>
              <p className="mt-3 text-sm text-slate-300">{hazardCfg.summary}</p>
            </div>
            <div className="rounded-[26px] border border-slate-200/10 bg-slate-950/55 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Adım Rehberi</p>
              <h2 className="mt-2 text-lg font-bold text-white">{currentStepConfig.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{currentStepConfig.description}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-slate-200" style={{ width: `${completionRatio}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className={formalCardClass}>
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-3 md:grid-cols-3">
              {steps.map((step, index) => {
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;
                const progressPercent = Math.round((stepCompletionCounts[index].completed / stepCompletionCounts[index].total) * 100);
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setCurrentStep(index)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-all",
                      isActive && "border-slate-300/20 bg-white/[0.05]",
                      isCompleted && "border-emerald-400/20 bg-emerald-500/10",
                      !isActive && !isCompleted && "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border", isActive && "border-slate-300/20 bg-white/[0.06] text-white", isCompleted && "border-emerald-400/25 bg-emerald-500/12 text-emerald-50", !isActive && !isCompleted && "border-white/10 bg-white/[0.04] text-slate-300")}>
                        {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : step.icon}
                      </div>
                      <Badge className={cn("rounded-full border text-[10px] uppercase tracking-[0.18em]", isActive && "border-cyan-400/20 bg-cyan-500/10 text-cyan-100", isCompleted && "border-emerald-400/20 bg-emerald-500/10 text-emerald-100", !isActive && !isCompleted && "border-white/10 bg-white/[0.04] text-slate-400")}>
                        {isCompleted ? "Hazır" : isActive ? "Aktif" : "Bekliyor"}
                      </Badge>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-white">{step.label}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>Tamamlama</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 font-medium text-slate-200">{stepCompletionCounts[index].completed}/{stepCompletionCounts[index].total}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className={cn("h-full rounded-full transition-all", isCompleted && "bg-emerald-400", isActive && "bg-slate-200", !isActive && !isCompleted && "bg-white/15")} style={{ width: `${progressPercent}%` }} />
                    </div>
                    <p className="mt-2 text-right text-[11px] font-medium text-slate-400">%{progressPercent}</p>
                  </button>
                );
              })}
            </div>

            <div className="rounded-[28px] border border-slate-200/10 bg-white/[0.02] p-5">{renderStepContent()}</div>

            <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0} className="rounded-2xl border-slate-200/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Geri
              </Button>
              <Button type="button" onClick={currentStep === steps.length - 1 ? handleSubmit : () => setCurrentStep(currentStep + 1)} disabled={submitting} className="rounded-2xl bg-slate-100 text-slate-950 hover:bg-white">
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Editör hazırlanıyor...</> : currentStep === steps.length - 1 ? <><FilePenLine className="mr-2 h-4 w-4" />Kaydet ve Editöre Geç</> : <>İleri<ChevronRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className={formalCardClass}>
            <CardContent className="p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Resmî Özet</p>
              <div className="mt-4 space-y-3">
                {[["Firma / Rapor", formData.firmName || "Henüz belirtilmedi"], ["Risk Analiz Yöntemi", formData.method], ["Geçerlilik Bitişi", formData.validityDate ? formatDisplayDate(formData.validityDate) : "Otomatik hesaplanacak"], ["Belge Durumu", pdfReady ? "Resmî rapor üretimine hazır" : "Zorunlu alanlar tamamlanıyor"]].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                    <p className="mt-2 text-sm font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className={formalCardClass}>
            <CardContent className="p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Resmî İçerik Notu</p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <div className="rounded-2xl border border-slate-200/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">İşyeri ve Ekip</p>
                  <p className="mt-2">İşyeri bilgileri, ekip üyeleri ve imza/onay alanları PDF içinde ayrı resmî tablolar halinde gösterilir.</p>
                </div>
                <div className="rounded-2xl border border-slate-200/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Geçerlilik ve Yenileme</p>
                  <p className="mt-2">Tehlike sınıfına göre yenileme süresi otomatik hesaplanır; kaza, yeni makine veya proses değişikliğinde revizyon notu ayrıca yazdırılır.</p>
                </div>
                <div className="rounded-2xl border border-slate-200/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Kayıt ve Belge Akışı</p>
                  <p className="mt-2">Kullanıcı kaydettiğinde kayıt risk_assessments tablosuna yazılır ve aynı veri yapısı editör ekranına köprülenir.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    <Dialog open={Boolean(signaturePreview)} onOpenChange={(open) => !open && setSignaturePreview(null)}>
      <DialogContent className="max-w-3xl border-white/10 bg-slate-950 text-white">
        <DialogHeader>
          <DialogTitle>{signaturePreview?.title || "İmza Önizleme"}</DialogTitle>
        </DialogHeader>
        {signaturePreview ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <Badge className="border-cyan-400/20 bg-cyan-500/10 text-cyan-100">Büyük Önizleme</Badge>
              <p className="text-xs text-slate-400">İmza / kaşe görseli PDF tablosunda ilgili ekip üyesine basılır.</p>
            </div>
            <div className="flex min-h-[360px] items-center justify-center rounded-[20px] border border-white/10 bg-slate-900/70 p-6">
              <img src={signaturePreview.imageUrl} alt={signaturePreview.title} className="max-h-[420px] w-full object-contain" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.1]"
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = signaturePreview.imageUrl;
                  link.download = `${asciiSlug(signaturePreview.title)}-${Date.now()}.png`;
                  link.click();
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                İndir
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl border-cyan-400/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15"
                onClick={() => signatureInputRefs.current[signaturePreview.field]?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Yeni Görsel Yükle
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl border-red-400/20 bg-red-500/10 text-red-100 hover:bg-red-500/15"
                onClick={() => {
                  updateForm(signaturePreview.field, null);
                  setSignaturePreview(null);
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Kaldır
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
    </>
  );
}

















