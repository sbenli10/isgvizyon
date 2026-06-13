import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileDown,
  FileText,
  FolderOpen,
  Info,
  ListChecks,
  Loader2,
  PenSquare,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { usePersistentFormDraft } from "@/hooks/usePersistentFormDraft";
import { supabase } from "@/integrations/supabase/client";
import { MANUAL_RISK_LIBRARY, type ManualRiskLibraryItem } from "@/lib/risk/manualRiskLibrary";
import { generateSectorRiskTemplates } from "@/lib/risk/sectorRiskTemplates";
import { getSectorMinimumRiskItemCount, RISK_TEMPLATE_CONFIGS } from "@/lib/risk/riskTemplateConfig";
import { listSavedRiskItems, type SavedRiskItem } from "@/lib/profileRisks";
import { generateRiskAssessmentOfficialDocx } from "@/lib/riskAssessmentOfficialDocx";
import { generateRisksWithGemini, type GeminiRiskResult } from "@/services/geminiService";
import type { RiskItem } from "@/types/risk-assessment";
import { addInterFontsToJsPDF } from "@/utils/fonts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type HazardClass = "Az Tehlikeli" | "Tehlikeli" | "Çok Tehlikeli" | "";
type RiskMethod = "5x5 Matris" | "Fine-Kinney" | "L Tipi Matris" | "Diğer";

type RiskTeamPerson = {
  fullName: string;
  tcNo: string;
  phone: string;
  title?: string;
  certificateNo?: string;
  certificateClass?: string;
};

type RiskTeamOsgb = {
  title: string;
  phone: string;
  email: string;
  authorizedPerson: string;
  address?: string;
};

type RiskWizardCompanyInfo = {
  companyTitle: string;
  address: string;
  email: string;
  workplaceRegistryNo: string;
  hazardClass: HazardClass;
  employeeCount: string;
  assessmentDate: string;
  riskMethod: RiskMethod | "";
  activityScope: string;
  note: string;
};

type RiskWizardTeamInfo = {
  employer: RiskTeamPerson;
  employeeRepresentative: RiskTeamPerson;
  safetyExpert: RiskTeamPerson;
  workplaceDoctor: RiskTeamPerson;
  osgb: RiskTeamOsgb;
};

type RiskWizardScopeInfo = {
  evaluatedSections: string;
  assessmentScopeItems: string[];
};

type RiskWizardTableItem = {
  id: string;
  no: number;
  departmentActivity: string;
  hazardSource: string;
  riskConsequence: string;
  affectedPeople: string;
  currentMeasure: string;
  probability: string;
  severity: string;
  riskScore: string;
  riskLevel: string;
  additionalMeasures: string;
  responsible: string;
  deadline: string;
};

type CorrectivePreventiveAction = {
  id: string;
  no: number;
  finding: string;
  action: string;
  responsible: string;
  deadline: string;
  status: string;
};

type SignatureRow = {
  id: string;
  fullName: string;
  role: string;
  documentOrContact: string;
};

type RiskWizardConclusionInfo = {
  generalConclusion: string;
  conclusionItems: string[];
  approvalNote: string;
  preparedBy: string;
  approvedBy: string;
  signatureDate: string;
};

type RiskAssessmentLogo = {
  name: string;
  type: string;
  dataUrl: string;
} | null;

type RiskAdditionMethod = "ai" | "manual" | "templates" | "saved";

type WizardCompanyOption = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  sgkNumber?: string | null;
  employeeCount?: number | null;
  hazardClass?: string | null;
  activityScope?: string | null;
  employerRepresentativeName?: string | null;
  employerRepresentativeTcNo?: string | null;
  employerRepresentativePhone?: string | null;
  employerRepresentativeTitle?: string | null;
  occupationalSafetySpecialistName?: string | null;
  occupationalSafetySpecialistTcNo?: string | null;
  occupationalSafetySpecialistPhone?: string | null;
  occupationalSafetySpecialistCertificateNo?: string | null;
  occupationalSafetySpecialistCertificateClass?: string | null;
  workplaceDoctorName?: string | null;
  workplaceDoctorTcNo?: string | null;
  workplaceDoctorPhone?: string | null;
  workplaceDoctorCertificateNo?: string | null;
  employeeRepresentativeName?: string | null;
  employeeRepresentativeTcNo?: string | null;
  employeeRepresentativePhone?: string | null;
  employeeRepresentativeTitle?: string | null;
  osgbTitle?: string | null;
  osgbAuthorizedPerson?: string | null;
  osgbPhone?: string | null;
  osgbEmail?: string | null;
  osgbAddress?: string | null;
};

type CompanyAssignmentForRisk = {
  company_id: string;
  role_type: string;
  person_name: string | null;
  certificate_no: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean | null;
};

type OrganizationForRisk = {
  name?: string | null;
  company_name?: string | null;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  authorized_person?: string | null;
  representative_name?: string | null;
};

type WizardStep = {
  id: string;
  label: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

type RiskAssessmentWizardDraft = {
  currentStep: number;
  selectedCompanyId?: string;
  companyInfo: RiskWizardCompanyInfo;
  teamInfo: RiskWizardTeamInfo;
  scopeInfo: RiskWizardScopeInfo;
  riskItems: RiskWizardTableItem[];
  correctiveActions: CorrectivePreventiveAction[];
  conclusionInfo: RiskWizardConclusionInfo;
  signatureRows: SignatureRow[];
  logo: RiskAssessmentLogo;
  riskAdditionMethod?: RiskAdditionMethod | null;
};

interface RiskAssessmentTemplateRecord {
  id: string;
  name: string;
  sector?: string | null;
  method: string;
  payload: {
    assessment?: Record<string, unknown>;
    items?: Array<Record<string, unknown>>;
  };
  created_at: string;
}

const today = new Date().toISOString().split("T")[0];

const WIZARD_STEPS: WizardStep[] = [
  {
    id: "company",
    label: "Firma Bilgileri",
    title: "Firma Bilgileri",
    description: "Firma profilinden gelen bilgileri kontrol edin veya boş birakin.",
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    id: "team",
    label: "Ekip",
    title: "Risk Değerlendirme Ekibi",
    description: "İşveren, çalisan temsilcisi, ISG uzmani, isyeri hekimi ve OSGB bilgileri.",
    icon: <Users className="h-5 w-5" />,
  },
  {
    id: "scope",
    label: "Tehlikeler",
    title: "Tehlikeler ve Kapsam",
    description: "Kapsamı, degerlendirilen faaliyetleri ve puanlama açiklamasini oluşturun.",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    id: "risk-method",
    label: "Riskler",
    title: "Risk Ekleme Yöntemi",
    description: "Riskleri nasil eklemek istediginizi seçin.",
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    id: "risk-table",
    label: "Önlemler",
    title: "Risk Değerlendirme Tablosu",
    description: "Seçtiginiz yönteme göre olusan risk maddelerini düzenleyin.",
    icon: <AlertTriangle className="h-5 w-5" />,
  },
  {
    id: "actions",
    label: "Faaliyetler",
    title: "Öncelikli Düzeltici / Önleyici Faaliyet Plani",
    description: "Plan satirlarini yalnizca ihtiyaç duydugunuz kadar oluşturun.",
    icon: <ListChecks className="h-5 w-5" />,
  },
  {
    id: "conclusion",
    label: "İmzalar",
    title: "Genel Sonuç, Onay ve İmzalar",
    description: "Onay metinlerini ve imza tablosunu tamamlayin.",
    icon: <PenSquare className="h-5 w-5" />,
  },
  {
    id: "preview",
    label: "Rapor",
    title: "Önizleme ve Rapor Oluştur",
    description: "Özeti kontrol edin, taslagi saklayin ve rapor çıktısini alin.",
    icon: <Eye className="h-5 w-5" />,
  },
];

const RISK_METHOD_STEP_INDEX = WIZARD_STEPS.findIndex((step) => step.id === "risk-method");
const RISK_TABLE_STEP_INDEX = WIZARD_STEPS.findIndex((step) => step.id === "risk-table");

const REQUIRED_COMPANY_FIELDS: Array<keyof RiskWizardCompanyInfo> = [];

const emptyCompanyInfo = (): RiskWizardCompanyInfo => ({
  companyTitle: "",
  address: "",
  email: "",
  workplaceRegistryNo: "",
  hazardClass: "",
  employeeCount: "",
  assessmentDate: today,
  riskMethod: "",
  activityScope: "",
  note: "",
});

const emptyTeamPerson = (): RiskTeamPerson => ({
  fullName: "",
  tcNo: "",
  phone: "",
  certificateNo: "",
});

const emptyOsgbInfo = (): RiskTeamOsgb => ({
  title: "",
  phone: "",
  email: "",
  authorizedPerson: "",
  address: "",
});

const emptyTeamInfo = (): RiskWizardTeamInfo => ({
  employer: emptyTeamPerson(),
  employeeRepresentative: emptyTeamPerson(),
  safetyExpert: emptyTeamPerson(),
  workplaceDoctor: emptyTeamPerson(),
  osgb: emptyOsgbInfo(),
});

const FIXED_METHOD_DESCRIPTION =
  "Risk puani = Olasilik x Siddet. Risk düzeyleri: 1-4 Düsük, 5-9 Orta, 10-15 Yüksek, 16-25 Çok Yüksek olarak kabul edilmistir. Kontrol tedbirlerinde öncelik sirasi; tehlikeyi ortadan kaldirma, ikame, mühendislik kontrolü, idari kontrol ve kisisel koruyucu donanim seklindedir.";

const emptyScopeInfo = (): RiskWizardScopeInfo => ({
  evaluatedSections: "",
  assessmentScopeItems: [""],
});

const emptyConclusionInfo = (): RiskWizardConclusionInfo => ({
  generalConclusion:
    "Bu risk değerlendirmesi, isyerinde beyan edilen faaliyet kapsami ve mevcut çalisma kosullari dikkate alinarak hazirlanmistir. Belirlenen ilave tedbirlerin uygulanmasi ve tamamlanan faaliyetler sonrasi risk seviyelerinin yeniden degerlendirilmesi önerilir.",
  conclusionItems: [
    "Bu risk değerlendirmesi, isyerinde beyan edilen faaliyet kapsami ve mevcut çalisma kosullari dikkate alinarak hazirlanmistir.",
    "Belirlenen ilave tedbirlerin uygulanmasi ve tamamlanan faaliyetler sonrasi risk seviyelerinin yeniden degerlendirilmesi önerilir.",
    "Risk değerlendirmesi, isyerinde önemli degisiklik olmasi veya mevzuat geregi yenilenmesi gereken durumlarda güncellenmelidir.",
  ],
  approvalNote: "",
  preparedBy: "",
  approvedBy: "",
  signatureDate: today,
});

const cleanText = (value?: string | null) => (value || "").replace(/\s+/g, " ").trim();
const cleanUnknown = (value: unknown) => (typeof value === "string" || typeof value === "number" ? cleanText(String(value)) : "");
const pickFirstText = (...values: unknown[]) => {
  for (const value of values) {
    const cleaned = cleanUnknown(value);
    if (cleaned) return cleaned;
  }
  return "";
};

const parseOptionalNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(cleanUnknown(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const hasTeamPersonData = (person?: RiskTeamPerson | null) =>
  Boolean(cleanText(person?.fullName) || cleanText(person?.tcNo) || cleanText(person?.phone) || cleanText(person?.certificateNo));

const hasOsgbData = (osgb?: RiskTeamOsgb | null) =>
  Boolean(cleanText(osgb?.title) || cleanText(osgb?.authorizedPerson) || cleanText(osgb?.phone) || cleanText(osgb?.email) || cleanText(osgb?.address));

const hasTeamInfoData = (team?: RiskWizardTeamInfo | null) =>
  Boolean(
    hasTeamPersonData(team?.employer) ||
      hasTeamPersonData(team?.employeeRepresentative) ||
      hasTeamPersonData(team?.safetyExpert) ||
      hasTeamPersonData(team?.workplaceDoctor) ||
      hasOsgbData(team?.osgb),
  );

const splitTextToItems = (value?: string | null) =>
  String(value || "")
    .split(/\r?\n|•|-/)
    .map((item) => cleanText(item))
    .filter(Boolean);
const asInt = (value?: string) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDisplayDate = (value?: string) => {
  if (!value) return "Belirtilmedi";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(parsed);
};

const slugify = (value: string) =>
  cleanText(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/i/g, "i")
    .replace(/g/g, "g")
    .replace(/ü/g, "u")
    .replace(/s/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "risk-değerlendirme";

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeLegacyTeamPerson = (value: unknown): RiskTeamPerson => {
  if (value && typeof value === "object") {
    const candidate = value as Partial<RiskTeamPerson>;
    return {
      fullName: cleanText(candidate.fullName),
      tcNo: cleanText(candidate.tcNo),
      phone: cleanText(candidate.phone),
      title: cleanText(candidate.title),
      certificateNo: cleanText(candidate.certificateNo),
      certificateClass: cleanText(candidate.certificateClass),
    };
  }
  return {
    ...emptyTeamPerson(),
    fullName: cleanText(typeof value === "string" ? value : ""),
  };
};

const normalizeLegacyOsgb = (value: unknown): RiskTeamOsgb => {
  if (value && typeof value === "object") {
    const candidate = value as Partial<RiskTeamOsgb>;
    return {
      title: cleanText(candidate.title),
      phone: cleanText(candidate.phone),
      email: cleanText(candidate.email),
      authorizedPerson: cleanText(candidate.authorizedPerson),
      address: cleanText(candidate.address),
    };
  }
  return {
    ...emptyOsgbInfo(),
    title: cleanText(typeof value === "string" ? value : ""),
  };
};

const normalizeTeamInfo = (value?: Partial<RiskWizardTeamInfo> | null): RiskWizardTeamInfo => ({
  employer: normalizeLegacyTeamPerson(value?.employer),
  employeeRepresentative: normalizeLegacyTeamPerson(value?.employeeRepresentative),
  safetyExpert: normalizeLegacyTeamPerson(value?.safetyExpert),
  workplaceDoctor: normalizeLegacyTeamPerson(value?.workplaceDoctor),
  osgb: normalizeLegacyOsgb(value?.osgb),
});

const assignmentMatchesRole = (assignment: CompanyAssignmentForRisk, needles: string[]) => {
  const haystack = cleanText([assignment.role_type, assignment.notes].filter(Boolean).join(" ")).toLocaleLowerCase("tr-TR");
  return needles.some((needle) => haystack.includes(needle));
};

const enrichCompaniesWithAssignments = (
  companies: WizardCompanyOption[],
  assignments: CompanyAssignmentForRisk[],
) => {
  if (assignments.length === 0) return companies;

  const byCompany = new Map<string, CompanyAssignmentForRisk[]>();
  assignments
    .filter((assignment) => assignment.is_active !== false)
    .forEach((assignment) => {
      byCompany.set(assignment.company_id, [...(byCompany.get(assignment.company_id) || []), assignment]);
    });

  return companies.map((company) => {
    const companyAssignments = byCompany.get(company.id) || [];
    const employer = companyAssignments.find((assignment) =>
      assignmentMatchesRole(assignment, ["isveren", "isveren", "vekil", "employer"]),
    );
    const employeeRepresentative = companyAssignments.find((assignment) =>
      assignmentMatchesRole(assignment, ["çalisan temsilcisi", "calisan temsilcisi", "employee"]),
    );
    const safetyExpert = companyAssignments.find((assignment) =>
      assignmentMatchesRole(assignment, ["is güvenligi", "isg", "igu", "uzman", "safety"]),
    );
    const workplaceDoctor = companyAssignments.find((assignment) =>
      assignmentMatchesRole(assignment, ["hekim", "doctor", "physician"]),
    );

    return {
      ...company,
      employerRepresentativeName: company.employerRepresentativeName || employer?.person_name || null,
      employerRepresentativePhone: company.employerRepresentativePhone || employer?.phone || null,
      employeeRepresentativeName: company.employeeRepresentativeName || employeeRepresentative?.person_name || null,
      employeeRepresentativePhone: company.employeeRepresentativePhone || employeeRepresentative?.phone || null,
      occupationalSafetySpecialistName: company.occupationalSafetySpecialistName || safetyExpert?.person_name || null,
      occupationalSafetySpecialistPhone: company.occupationalSafetySpecialistPhone || safetyExpert?.phone || null,
      occupationalSafetySpecialistCertificateNo:
        company.occupationalSafetySpecialistCertificateNo || safetyExpert?.certificate_no || null,
      workplaceDoctorName: company.workplaceDoctorName || workplaceDoctor?.person_name || null,
      workplaceDoctorPhone: company.workplaceDoctorPhone || workplaceDoctor?.phone || null,
      workplaceDoctorCertificateNo: company.workplaceDoctorCertificateNo || workplaceDoctor?.certificate_no || null,
    };
  });
};

const buildCompanyInfoFromProfile = (company: WizardCompanyOption): RiskWizardCompanyInfo => {
  const hazardClass = ["Az Tehlikeli", "Tehlikeli", "Çok Tehlikeli"].includes(cleanText(company.hazardClass))
    ? (cleanText(company.hazardClass) as HazardClass)
    : "";

  return {
    ...emptyCompanyInfo(),
    companyTitle: cleanText(company.name),
    address: cleanText(company.address),
    email: cleanText(company.email),
    workplaceRegistryNo: cleanText(company.sgkNumber),
    hazardClass,
    employeeCount: company.employeeCount != null ? String(company.employeeCount) : "",
    activityScope: cleanText(company.activityScope),
  };
};

const buildTeamInfoFromProfile = (company: WizardCompanyOption): RiskWizardTeamInfo => ({
  employer: {
    fullName: cleanText(company.employerRepresentativeName),
    tcNo: cleanText(company.employerRepresentativeTcNo),
    phone: cleanText(company.employerRepresentativePhone),
    title: cleanText(company.employerRepresentativeTitle) || "İşveren / İşveren Vekili",
  },
  employeeRepresentative: {
    fullName: cleanText(company.employeeRepresentativeName),
    tcNo: cleanText(company.employeeRepresentativeTcNo),
    phone: cleanText(company.employeeRepresentativePhone),
    title: cleanText(company.employeeRepresentativeTitle) || "Çalışan Temsilcisi",
  },
  safetyExpert: {
    fullName: cleanText(company.occupationalSafetySpecialistName),
    tcNo: cleanText(company.occupationalSafetySpecialistTcNo),
    phone: cleanText(company.occupationalSafetySpecialistPhone),
    certificateNo: cleanText(company.occupationalSafetySpecialistCertificateNo),
    certificateClass: cleanText(company.occupationalSafetySpecialistCertificateClass),
    title: "İş Güvenliği Uzmanı",
  },
  workplaceDoctor: {
    fullName: cleanText(company.workplaceDoctorName),
    tcNo: cleanText(company.workplaceDoctorTcNo),
    phone: cleanText(company.workplaceDoctorPhone),
    certificateNo: cleanText(company.workplaceDoctorCertificateNo),
    title: "İşyeri Hekimi",
  },
  osgb: {
    title: cleanText(company.osgbTitle),
    authorizedPerson: cleanText(company.osgbAuthorizedPerson),
    phone: cleanText(company.osgbPhone),
    email: cleanText(company.osgbEmail),
    address: cleanText(company.osgbAddress),
  },
});

const mergeCompanyInfoFallback = (current: RiskWizardCompanyInfo, fallback: RiskWizardCompanyInfo): RiskWizardCompanyInfo => ({
  companyTitle: current.companyTitle || fallback.companyTitle,
  address: current.address || fallback.address,
  email: current.email || fallback.email,
  workplaceRegistryNo: current.workplaceRegistryNo || fallback.workplaceRegistryNo,
  hazardClass: current.hazardClass || fallback.hazardClass,
  employeeCount: current.employeeCount || fallback.employeeCount,
  assessmentDate: current.assessmentDate || fallback.assessmentDate || today,
  riskMethod: current.riskMethod || fallback.riskMethod,
  activityScope: current.activityScope || fallback.activityScope,
  note: current.note || fallback.note,
});

const mergePersonFallback = (current: RiskTeamPerson, fallback: RiskTeamPerson): RiskTeamPerson => ({
  fullName: current.fullName || fallback.fullName,
  tcNo: current.tcNo || fallback.tcNo,
  phone: current.phone || fallback.phone,
  title: current.title || fallback.title,
  certificateNo: current.certificateNo || fallback.certificateNo,
  certificateClass: current.certificateClass || fallback.certificateClass,
});

const mergeTeamInfoFallback = (current: RiskWizardTeamInfo, fallback: RiskWizardTeamInfo): RiskWizardTeamInfo => ({
  employer: mergePersonFallback(current.employer, fallback.employer),
  employeeRepresentative: mergePersonFallback(current.employeeRepresentative, fallback.employeeRepresentative),
  safetyExpert: mergePersonFallback(current.safetyExpert, fallback.safetyExpert),
  workplaceDoctor: mergePersonFallback(current.workplaceDoctor, fallback.workplaceDoctor),
  osgb: {
    title: current.osgb.title || fallback.osgb.title,
    phone: current.osgb.phone || fallback.osgb.phone,
    email: current.osgb.email || fallback.osgb.email,
    authorizedPerson: current.osgb.authorizedPerson || fallback.osgb.authorizedPerson,
    address: current.osgb.address || fallback.osgb.address,
  },
});

const getRiskLevelFromScore = (score: number) => {
  if (score >= 16) return "Çok Yüksek";
  if (score >= 10) return "Yüksek";
  if (score >= 5) return "Orta";
  if (score >= 1) return "Düsük";
  return "";
};

const createEmptyRiskItem = (no: number): RiskWizardTableItem => ({
  id: createId("risk"),
  no,
  departmentActivity: "",
  hazardSource: "",
  riskConsequence: "",
  affectedPeople: "",
  currentMeasure: "",
  probability: "",
  severity: "",
  riskScore: "",
  riskLevel: "",
  additionalMeasures: "",
  responsible: "",
  deadline: "",
});

const normalizeMatrixValue = (value: unknown, fallback = 3) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return fallback;
  return Math.min(5, Math.max(1, Math.round(numericValue)));
};

const createRiskRowFromGeneratedRisk = (
  item: GeminiRiskResult | ReturnType<typeof generateSectorRiskTemplates>[number],
  index: number,
  sourcePrefix: string,
): RiskWizardTableItem => {
  const probability = normalizeMatrixValue("probability" in item ? item.probability : item.o);
  const severity = normalizeMatrixValue("severity" in item ? item.severity : item.s);
  const riskScore = probability * severity;
  const controls = Array.isArray(item.controls) ? item.controls.filter(Boolean) : [];

  return {
    id: createId(sourcePrefix),
    no: index + 1,
    departmentActivity: cleanText(item.category),
    hazardSource: cleanText(item.hazard),
    riskConsequence: cleanText(item.risk),
    affectedPeople: "Çalışanlar, ziyaretçiler ve ilgili üçüncü kisiler",
    currentMeasure: cleanText(controls[0] || ""),
    probability: String(probability),
    severity: String(severity),
    riskScore: String(riskScore),
    riskLevel: getRiskLevelFromScore(riskScore),
    additionalMeasures: cleanText(controls.slice(1).join("\n")),
    responsible: "",
    deadline: "",
  };
};

const createEmptyAction = (no: number): CorrectivePreventiveAction => ({
  id: createId("action"),
  no,
  finding: "",
  action: "",
  responsible: "",
  deadline: "",
  status: "",
});

const createEmptySignatureRow = (role = ""): SignatureRow => ({
  id: createId("signature"),
  fullName: "",
  role,
  documentOrContact: "",
});

const buildSignatureRowsFromTeam = (teamInfo: RiskWizardTeamInfo): SignatureRow[] => {
  const rows: SignatureRow[] = [
    {
      id: createId("signature"),
      fullName: cleanText(teamInfo.employer.fullName),
      role: "İşveren",
      documentOrContact: cleanText(teamInfo.employer.phone || teamInfo.employer.tcNo),
    },
    {
      id: createId("signature"),
      fullName: cleanText(teamInfo.employeeRepresentative.fullName),
      role: "Çalışan Temsilcisi",
      documentOrContact: cleanText(teamInfo.employeeRepresentative.phone),
    },
    {
      id: createId("signature"),
      fullName: cleanText(teamInfo.safetyExpert.fullName),
      role: "İş Güvenliği Uzmanı",
      documentOrContact: cleanText(
        [
          teamInfo.safetyExpert.certificateNo ? `Sertifika No: ${teamInfo.safetyExpert.certificateNo}` : "",
          teamInfo.safetyExpert.phone ? `Tel: ${teamInfo.safetyExpert.phone}` : "",
        ]
          .filter(Boolean)
          .join(" / "),
      ),
    },
    {
      id: createId("signature"),
      fullName: cleanText(teamInfo.workplaceDoctor.fullName),
      role: "İşyeri Hekimi",
      documentOrContact: cleanText(
        [
          teamInfo.workplaceDoctor.certificateNo ? `Sertifika No: ${teamInfo.workplaceDoctor.certificateNo}` : "",
          teamInfo.workplaceDoctor.phone ? `Tel: ${teamInfo.workplaceDoctor.phone}` : "",
        ]
          .filter(Boolean)
          .join(" / "),
      ),
    },
    {
      id: createId("signature"),
      fullName: cleanText(teamInfo.osgb.authorizedPerson || teamInfo.osgb.title),
      role: "OSGB",
      documentOrContact: cleanText([teamInfo.osgb.email, teamInfo.osgb.phone].filter(Boolean).join(" / ")),
    },
  ];
  return rows.filter((row) => cleanText(row.fullName) || cleanText(row.role));
};

const mapEditorRiskItemToWizardRow = (item: RiskItem, index: number): RiskWizardTableItem => ({
  id: item.id || createId("risk"),
  no: index + 1,
  departmentActivity: cleanText(item.department),
  hazardSource: cleanText(item.hazard),
  riskConsequence: cleanText(item.risk),
  affectedPeople: cleanText(item.affected_people),
  currentMeasure: cleanText(item.existing_controls),
  probability: item.probability_1 ? String(item.probability_1) : "",
  severity: item.severity_1 ? String(item.severity_1) : "",
  riskScore: item.score_1 ? String(item.score_1) : "",
  riskLevel: cleanText(item.risk_class_1),
  additionalMeasures: cleanText(item.proposed_controls),
  responsible: cleanText(item.responsible_person),
  deadline: item.deadline || "",
});


const mapSavedRiskItemToWizardRow = (item: SavedRiskItem, index: number): RiskWizardTableItem => ({
  id: createId("saved-risk"),
  no: index + 1,
  departmentActivity: cleanText(item.activity),
  hazardSource: cleanText(item.hazard),
  riskConsequence: cleanText(item.risk),
  affectedPeople: "Çalışanlar",
  currentMeasure: cleanText(item.currentStatus || item.riskDefinitionBefore),
  probability: item.probabilityBefore ? String(item.probabilityBefore) : "",
  severity: item.severityBefore ? String(item.severityBefore) : "",
  riskScore: item.riskScoreBefore ? String(item.riskScoreBefore) : "",
  riskLevel: getRiskLevelFromScore(Number(item.riskScoreBefore || 0)),
  additionalMeasures: cleanText(item.correctivePreventiveAction),
  responsible: cleanText(item.responsible),
  deadline: item.deadline || "",
});

const mapTemplateRiskItemToWizardRow = (item: Record<string, unknown>, index: number): RiskWizardTableItem => ({
  id: createId("risk-template"),
  no: index + 1,
  departmentActivity: cleanText(String(item.department || item.activity || item.area || "")),
  hazardSource: cleanText(String(item.hazardSource || item.hazard || "")),
  riskConsequence: cleanText(String(item.risk || item.consequence || "")),
  affectedPeople: cleanText(String(item.affectedPeople || item.affected_people || "")),
  currentMeasure: cleanText(String(item.existingControl || item.currentMeasure || item.existing_controls || "")),
  probability: item.probability ? String(item.probability) : item.probability_1 ? String(item.probability_1) : "",
  severity: item.severity ? String(item.severity) : item.severity_1 ? String(item.severity_1) : "",
  riskScore: item.riskScore ? String(item.riskScore) : item.score_1 ? String(item.score_1) : "",
  riskLevel: cleanText(String(item.riskLevel || item.risk_class_1 || "")),
  additionalMeasures: cleanText(String(item.additionalMeasures || item.actions || item.proposed_controls || "")),
  responsible: cleanText(String(item.responsible || item.responsible_person || "")),
  deadline: cleanText(String(item.deadline || "")),
});

const mapManualLibraryItemToWizardRow = (item: ManualRiskLibraryItem, index: number): RiskWizardTableItem => ({
  id: createId("risk-library"),
  no: index + 1,
  departmentActivity: cleanText(item.departmentActivity || item.category),
  hazardSource: cleanText(item.hazardSource),
  riskConsequence: cleanText(item.riskConsequence),
  affectedPeople: cleanText(item.affectedPeople || "Çalışanlar"),
  currentMeasure: cleanText(item.currentMeasure),
  probability: cleanText(item.probability),
  severity: cleanText(item.severity),
  riskScore: cleanText(item.riskScore),
  riskLevel: cleanText(item.riskLevel),
  additionalMeasures: cleanText(item.additionalMeasures),
  responsible: cleanText(item.responsible),
  deadline: cleanText(item.deadline),
});

const buildRiskItemsSummary = (items: RiskWizardTableItem[]) =>
  items.map((item, index) => ({
    ...item,
    no: index + 1,
    riskScore: item.riskScore || String(asInt(item.probability) * asInt(item.severity) || ""),
    riskLevel:
      cleanText(item.riskLevel) ||
      getRiskLevelFromScore(asInt(item.riskScore) || asInt(item.probability) * asInt(item.severity)),
  }));

const buildCorrectiveActionsSummary = (actions: CorrectivePreventiveAction[]) =>
  actions.map((action, index) => ({ ...action, no: index + 1 }));

const createInitialDraft = (): RiskAssessmentWizardDraft => ({
  currentStep: 0,
  selectedCompanyId: "",
  companyInfo: emptyCompanyInfo(),
  teamInfo: emptyTeamInfo(),
  scopeInfo: emptyScopeInfo(),
  riskItems: [],
  correctiveActions: [],
  conclusionInfo: emptyConclusionInfo(),
  signatureRows: [],
  logo: null,
  riskAdditionMethod: null,
});

const drawCenteredWrappedText = (
  doc: jsPDF,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  options?: { startFontSize?: number; minFontSize?: number; maxLines?: number; lineHeight?: number; weight?: "normal" | "bold" }
) => {
  const startFontSize = options?.startFontSize ?? 24;
  const minFontSize = options?.minFontSize ?? 12;
  const maxLines = options?.maxLines ?? 3;
  const lineHeight = options?.lineHeight ?? 6.2;
  let fontSize = startFontSize;
  let lines: string[] = [];

  while (fontSize >= minFontSize) {
    doc.setFontSize(fontSize);
    lines = doc.splitTextToSize(text, maxWidth) as string[];
    if (lines.length <= maxLines) break;
    fontSize -= 1;
  }

  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    const lastLine = lines[maxLines - 1] || "";
    lines[maxLines - 1] = `${lastLine.slice(0, Math.max(0, lastLine.length - 3)).trimEnd()}...`;
  }

  doc.setFontSize(fontSize);
  doc.setFont("Inter", options?.weight ?? "normal");
  doc.text(lines, centerX, startY, { align: "center", baseline: "top" });
  return { lines, height: lines.length * lineHeight, fontSize };
};

const buildTeamExtraInfo = (person: RiskTeamPerson) => cleanText(person.certificateNo);

const buildOsgbExtraInfo = (osgb: RiskTeamOsgb) =>
  cleanText(
    [
      osgb.authorizedPerson ? `Yetkili: ${osgb.authorizedPerson}` : "",
      osgb.email ? `E-posta: ${osgb.email}` : "",
    ]
      .filter(Boolean)
      .join(" / "),
  );

const addWizardPdfSectionTitle = (doc: jsPDF, y: number, title: string) => {
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(14, y, 182, 9, 2.5, 2.5, "F");
  doc.setFont("Inter", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 18, y + 5.9);
  doc.setTextColor(15, 23, 42);
};

const ensurePdfPage = (doc: jsPDF, cursorY: number, neededHeight: number) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (cursorY + neededHeight <= pageHeight - 18) return cursorY;
  doc.addPage("a4", "portrait");
  return 18;
};

const addPdfFooter = (doc: jsPDF, companyTitle: string, assessmentDate: string) => {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const baseText = `${cleanText(companyTitle) || "Firma"} Risk Değerlendirmesi - ${formatDisplayDate(assessmentDate)}`;

  for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
    doc.setPage(pageIndex);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.15);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    doc.setFont("Inter", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    let footerText = `${baseText} | Sayfa ${pageIndex}`;
    const maxWidth = pageWidth - 28;
    while (doc.getTextWidth(footerText) > maxWidth && footerText.length > 18) {
      footerText = `${footerText.slice(0, -4)}...`;
    }
    doc.text(footerText, pageWidth / 2, pageHeight - 7, { align: "center" });
  }
};

const buildWizardPdf = async (draft: RiskAssessmentWizardDraft) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  addInterFontsToJsPDF(doc);
  doc.setFont("Inter", "normal");

  const companyInfo = draft.companyInfo;
  const teamInfo = draft.teamInfo;
  const scopeInfo = draft.scopeInfo;
  const riskItems = buildRiskItemsSummary(draft.riskItems);
  const correctiveActions = buildCorrectiveActionsSummary(draft.correctiveActions);
  const signatureRows = draft.signatureRows.length > 0 ? draft.signatureRows : buildSignatureRowsFromTeam(teamInfo);
  const scopeItems = (scopeInfo.assessmentScopeItems || []).map((item) => cleanText(item)).filter(Boolean);
  const conclusionItems = (draft.conclusionInfo.conclusionItems || []).map((item) => cleanText(item)).filter(Boolean);
  const hasNote = Boolean(cleanText(companyInfo.note));

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(241, 245, 249);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(1.2);
  doc.roundedRect(10, 10, pageWidth - 20, pageHeight - 20, 5, 5);

  if (draft.logo?.dataUrl) {
    try {
      doc.addImage(
        draft.logo.dataUrl,
        draft.logo.type.includes("png") ? "PNG" : "JPEG",
        pageWidth - 48,
        16,
        30,
        18,
        undefined,
        "FAST",
      );
    } catch {
      // noop
    }
  }

  doc.setTextColor(30, 41, 59);
  doc.setFont("Inter", "bold");
  doc.setFontSize(18);
  doc.text("IS SAGLIGI VE GÜVENLIGI", pageWidth / 2, 24, { align: "center" });
  doc.text("RISK DEGERLENDIRMESI RAPORU", pageWidth / 2, 32, { align: "center" });

  const companyTitleBlock = drawCenteredWrappedText(
    doc,
    cleanText(companyInfo.companyTitle) || "FIRMA ÜNVANI",
    pageWidth / 2,
    41,
    draft.logo?.dataUrl ? 112 : 126,
    {
    startFontSize: 20,
    minFontSize: 13,
    maxLines: 3,
    lineHeight: 5.8,
    weight: "bold",
    },
  );

  let coverTableStartY = 41 + companyTitleBlock.height + 8;
  doc.setFont("Inter", "normal");
  doc.setFontSize(10);
  const coverRows = [
    ["Tehlike Sınıfı", cleanText(companyInfo.hazardClass) || ""],
    ["Faaliyet Kapsamı", cleanText(companyInfo.activityScope) || ""],
    ["Firma Ünvanı", cleanText(companyInfo.companyTitle) || ""],
    ["Adres", cleanText(companyInfo.address) || ""],
    ["E-posta", cleanText(companyInfo.email) || ""],
    ["İşyeri Sicil No", cleanText(companyInfo.workplaceRegistryNo) || ""],
    ["Çalışan Sayısı", cleanText(companyInfo.employeeCount) || ""],
    ["Değerlendirme Tarihi", formatDisplayDate(companyInfo.assessmentDate)],
    ["Risk Değerlendirme Yöntemi", cleanText(companyInfo.riskMethod) || ""],
  ];

  if (hasNote) {
    coverRows.push(["Not", cleanText(companyInfo.note)]);
  }

  autoTable(doc, {
    startY: coverTableStartY,
    margin: { left: 18, right: 18 },
    head: [["Alan", "Bilgi"]],
    body: coverRows.map(([label, value]) => [label, value || ""]),
    theme: "grid",
    styles: {
      font: "Inter",
      fontSize: 9,
      cellPadding: 2.2,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      valign: "middle",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      font: "Inter",
    },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold" },
      1: { cellWidth: 130 },
    },
  });

  doc.addPage("a4", "portrait");
  let cursorY = 18;

  addWizardPdfSectionTitle(doc, cursorY, "1. ISYERINE AIT BILGILER VE RISK DEGERLENDIRME EKIBI");
  cursorY += 13;
  autoTable(doc, {
    startY: cursorY,
    margin: { left: 14, right: 14 },
    head: [["Görev / Rol", "Ad - Soyad / Ünvan", "T.C. Kimlik No", "Telefon", "Sertifika No / Ek Bilgi"]],
    body: [
      [
        "İşveren",
        cleanText(teamInfo.employer.fullName),
        cleanText(teamInfo.employer.tcNo),
        cleanText(teamInfo.employer.phone),
        "",
      ],
      [
        "Çalışan Temsilcisi",
        cleanText(teamInfo.employeeRepresentative.fullName),
        cleanText(teamInfo.employeeRepresentative.tcNo),
        cleanText(teamInfo.employeeRepresentative.phone),
        "",
      ],
      [
        "İş Güvenliği Uzmanı",
        cleanText(teamInfo.safetyExpert.fullName),
        cleanText(teamInfo.safetyExpert.tcNo),
        cleanText(teamInfo.safetyExpert.phone),
        buildTeamExtraInfo(teamInfo.safetyExpert),
      ],
      [
        "İşyeri Hekimi",
        cleanText(teamInfo.workplaceDoctor.fullName),
        cleanText(teamInfo.workplaceDoctor.tcNo),
        cleanText(teamInfo.workplaceDoctor.phone),
        buildTeamExtraInfo(teamInfo.workplaceDoctor),
      ],
      [
        "OSGB",
        cleanText(teamInfo.osgb.title),
        "",
        cleanText(teamInfo.osgb.phone),
        buildOsgbExtraInfo(teamInfo.osgb),
      ],
    ],
    theme: "grid",
    styles: {
      font: "Inter",
      fontSize: 9,
      cellPadding: 2.2,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      textColor: [15, 23, 42],
      minCellHeight: 10,
    },
    headStyles: {
      fillColor: [226, 232, 240],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      font: "Inter",
    },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: "bold" },
      1: { cellWidth: 50 },
      2: { cellWidth: 30 },
      3: { cellWidth: 26 },
      4: { cellWidth: 42 },
    },
  });
  cursorY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || cursorY) + 8;

  cursorY = ensurePdfPage(doc, cursorY, 32);
  addWizardPdfSectionTitle(doc, cursorY, "2. DEGERLENDIRME KAPSAMI");
  cursorY += 13;
  doc.setFont("Inter", "normal");
  doc.setFontSize(9.5);
  if (scopeItems.length > 0) {
    scopeItems.forEach((item) => {
      const scopeLines = doc.splitTextToSize(`• ${item}`, 176) as string[];
      doc.text(scopeLines, 14, cursorY);
      cursorY += scopeLines.length * 5 + 2;
    });
    cursorY += 4;
  } else {
    const scopeLines = doc.splitTextToSize("Değerlendirme kapsami belirtilmemistir.", 178) as string[];
    doc.text(scopeLines, 14, cursorY);
    cursorY += scopeLines.length * 5 + 8;
  }
  if (cleanText(scopeInfo.evaluatedSections)) {
    doc.setFont("Inter", "bold");
    doc.text("Degerlendirilen Bölümler / Faaliyetler", 14, cursorY);
    cursorY += 5.5;
    doc.setFont("Inter", "normal");
    const evaluatedLines = doc.splitTextToSize(cleanText(scopeInfo.evaluatedSections), 178) as string[];
    doc.text(evaluatedLines, 14, cursorY);
    cursorY += evaluatedLines.length * 5 + 8;
  }

  cursorY = ensurePdfPage(doc, cursorY, 36);
  addWizardPdfSectionTitle(doc, cursorY, "3. RISK PUANLAMA METODU");
  cursorY += 13;
  const methodLines = doc.splitTextToSize(FIXED_METHOD_DESCRIPTION, 178) as string[];
  doc.text(methodLines, 14, cursorY);
  cursorY += methodLines.length * 5 + 6;
  autoTable(doc, {
    startY: cursorY,
    margin: { left: 14, right: 14 },
    head: [["Puan", "Olasilik", "Açıklama", "Siddet", "Açıklama"]],
    body: [
      ["1", "Çok düsük", "Beklenmez/çok seyrek", "Çok hafif", "Ilk yardim gerektirmeyen küçük durum"],
      ["2", "Düsük", "Seyrek", "Hafif", "Ilk yardim, kısa süreli rahatsizlik"],
      ["3", "Orta", "Ara sira", "Orta", "Tibbi müdahale, is günü kaybi ihtimali"],
      ["4", "Yüksek", "Sik", "Ciddi", "Ciddi yaralanma, kalici etki ihtimali"],
      ["5", "Çok yüksek", "Çok sik/kaçinilmaz", "Çok ciddi", "Ölüm, agir yaralanma veya büyük hasar"],
    ],
    theme: "grid",
    styles: {
      font: "Inter",
      fontSize: 8.2,
      cellPadding: 2,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      textColor: [15, 23, 42],
      valign: "middle",
    },
    headStyles: {
      fillColor: [219, 234, 254],
      textColor: [15, 23, 42],
      font: "Inter",
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 14, halign: "center" },
      1: { cellWidth: 28 },
      2: { cellWidth: 50 },
      3: { cellWidth: 24 },
      4: { cellWidth: 64 },
    },
  });

  doc.addPage("a4", "landscape");
  addWizardPdfSectionTitle(doc, 12, "4. RISK DEGERLENDIRME TABLOSU");
  autoTable(doc, {
    startY: 24,
    margin: { left: 8, right: 8, bottom: 12 },
    head: [[
      "No",
      "Bölüm / Faaliyet",
      "Tehlike Kaynagi",
      "Risk / Olasi Sonuç",
      "Etkilenenler",
      "Mevcut Önlem",
      "O",
      "S",
      "R",
      "Düzey",
      "Alinacak Ilave Önlemler",
      "Sorumlu",
      "Termin",
    ]],
    body:
      riskItems.length > 0
        ? riskItems.map((item) => [
            String(item.no),
            item.departmentActivity,
            item.hazardSource,
            item.riskConsequence,
            item.affectedPeople,
            item.currentMeasure,
            item.probability,
            item.severity,
            item.riskScore,
            item.riskLevel,
            item.additionalMeasures,
            item.responsible,
            item.deadline ? formatDisplayDate(item.deadline) : "",
          ])
        : [["", "Risk maddesi eklenmedi.", "", "", "", "", "", "", "", "", "", "", ""]],
    theme: "grid",
    styles: {
      font: "Inter",
      fontSize: 6.3,
      cellPadding: 1.3,
      lineColor: [203, 213, 225],
      lineWidth: 0.1,
      textColor: [15, 23, 42],
      valign: "middle",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      font: "Inter",
      fontStyle: "bold",
      fontSize: 6.5,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 26 },
      2: { cellWidth: 24 },
      3: { cellWidth: 28 },
      4: { cellWidth: 18 },
      5: { cellWidth: 24 },
      6: { cellWidth: 7, halign: "center" },
      7: { cellWidth: 7, halign: "center" },
      8: { cellWidth: 8, halign: "center" },
      9: { cellWidth: 14, halign: "center" },
      10: { cellWidth: 34 },
      11: { cellWidth: 18 },
      12: { cellWidth: 16, halign: "center" },
    },
  });

  doc.addPage("a4", "landscape");
  addWizardPdfSectionTitle(doc, 12, "5. ÖNCELIKLI DÜZELTICI / ÖNLEYICI FAALIYET PLANI");
  autoTable(doc, {
    startY: 24,
    margin: { left: 10, right: 10, bottom: 12 },
    head: [["No", "Tespit / Risk", "Yapilacak Faaliyet", "Sorumlu", "Termin", "Durum"]],
    body:
      correctiveActions.length > 0
        ? correctiveActions.map((item) => [
            String(item.no),
            item.finding,
            item.action,
            item.responsible,
            item.deadline ? formatDisplayDate(item.deadline) : "",
            item.status,
          ])
        : [["", "Öncelikli düzeltici/önleyici faaliyet eklenmedi.", "", "", "", ""]],
    theme: "grid",
    styles: {
      font: "Inter",
      fontSize: 7.4,
      cellPadding: 1.8,
      lineColor: [203, 213, 225],
      lineWidth: 0.1,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      font: "Inter",
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 55 },
      2: { cellWidth: 90 },
      3: { cellWidth: 40 },
      4: { cellWidth: 24, halign: "center" },
      5: { cellWidth: 36, halign: "center" },
    },
  });

  doc.addPage("a4", "portrait");
  cursorY = 18;
  addWizardPdfSectionTitle(doc, cursorY, "6. GENEL SONUÇ VE ONAY");
  cursorY += 13;
  if (conclusionItems.length > 0) {
    conclusionItems.forEach((item) => {
      const conclusionLines = doc.splitTextToSize(`• ${item}`, 176) as string[];
      doc.text(conclusionLines, 14, cursorY);
      cursorY += conclusionLines.length * 5 + 2;
    });
    cursorY += 4;
  } else {
    const conclusionLines = doc.splitTextToSize(
      cleanText(draft.conclusionInfo.generalConclusion) || "Genel sonuç girilmedi.",
      178,
    ) as string[];
    doc.text(conclusionLines, 14, cursorY);
    cursorY += conclusionLines.length * 5 + 6;
  }
  if (cleanText(draft.conclusionInfo.approvalNote)) {
    doc.setFont("Inter", "bold");
    doc.text("Onay Notu", 14, cursorY);
    cursorY += 5;
    doc.setFont("Inter", "normal");
    const approvalLines = doc.splitTextToSize(cleanText(draft.conclusionInfo.approvalNote), 178) as string[];
    doc.text(approvalLines, 14, cursorY);
    cursorY += approvalLines.length * 5 + 6;
  }
  autoTable(doc, {
    startY: cursorY,
    margin: { left: 14, right: 14 },
    head: [["Alan", "Bilgi"]],
    body: [
      ["Hazirlayan", cleanText(draft.conclusionInfo.preparedBy)],
      ["Onaylayan", cleanText(draft.conclusionInfo.approvedBy)],
      ["İmza Tarihi", formatDisplayDate(draft.conclusionInfo.signatureDate)],
    ],
    theme: "grid",
    styles: {
      font: "Inter",
      fontSize: 9,
      cellPadding: 2.2,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [226, 232, 240],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      font: "Inter",
    },
    columnStyles: {
      0: { cellWidth: 44, fontStyle: "bold" },
      1: { cellWidth: 134 },
    },
  });
  cursorY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || cursorY) + 8;

  cursorY = ensurePdfPage(doc, cursorY, 40);
  addWizardPdfSectionTitle(doc, cursorY, "7. IMZALAR");
  autoTable(doc, {
    startY: cursorY + 12,
    margin: { left: 14, right: 14, bottom: 16 },
    head: [["Adi Soyadi", "Görevi", "Belge / Iletisim Bilgisi", "İmza"]],
    body:
      signatureRows.length > 0
        ? signatureRows.map((row) => [cleanText(row.fullName), cleanText(row.role), cleanText(row.documentOrContact), ""])
        : [["", "İmza satiri eklenmedi.", "", ""]],
    theme: "grid",
    styles: {
      font: "Inter",
      fontSize: 9,
      cellPadding: 2.2,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      minCellHeight: 11,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      font: "Inter",
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 46 },
      2: { cellWidth: 58 },
      3: { cellWidth: 22 },
    },
  });

  addPdfFooter(doc, companyInfo.companyTitle, companyInfo.assessmentDate);

  return doc;
};

export default function RiskAssessmentWizard() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const locationState = location.state as { assessmentId?: string | null; companyId?: string | null } | null;
  const importAssessmentId = locationState?.assessmentId || null;

  const [currentStep, setCurrentStep] = useState(0);
  const [companies, setCompanies] = useState<WizardCompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(locationState?.companyId || "");
  const [companyInfo, setCompanyInfo] = useState<RiskWizardCompanyInfo>(emptyCompanyInfo);
  const [teamInfo, setTeamInfo] = useState<RiskWizardTeamInfo>(emptyTeamInfo);
  const [scopeInfo, setScopeInfo] = useState<RiskWizardScopeInfo>(emptyScopeInfo);
  const [riskItems, setRiskItems] = useState<RiskWizardTableItem[]>([]);
  const [correctiveActions, setCorrectiveActions] = useState<CorrectivePreventiveAction[]>([]);
  const [conclusionInfo, setConclusionInfo] = useState<RiskWizardConclusionInfo>(emptyConclusionInfo);
  const [signatureRows, setSignatureRows] = useState<SignatureRow[]>([]);
  const [logo, setLogo] = useState<RiskAssessmentLogo>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [wordTemplateAvailable, setWordTemplateAvailable] = useState(false);
  const [checkingTemplate, setCheckingTemplate] = useState(true);
  const [importingRiskItems, setImportingRiskItems] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [riskTemplateDialogOpen, setRiskTemplateDialogOpen] = useState(false);
  const [riskTemplates, setRiskTemplates] = useState<RiskAssessmentTemplateRecord[]>([]);
  const [loadingRiskTemplates, setLoadingRiskTemplates] = useState(false);
  const [riskAdditionMethod, setRiskAdditionMethod] = useState<RiskAdditionMethod | null>(null);
  const [aiSector, setAiSector] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [aiRiskCount, setAiRiskCount] = useState("40");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [manualRiskSearch, setManualRiskSearch] = useState("");
  const [expandedManualCategories, setExpandedManualCategories] = useState<Record<string, boolean>>({});

  const draftContextKey = useMemo(
    () => `${location.pathname}:${locationState?.assessmentId || locationState?.companyId || "general"}`,
    [location.pathname, locationState?.assessmentId, locationState?.companyId],
  );

  const { clearDraft } = usePersistentFormDraft<RiskAssessmentWizardDraft>({
    formId: `risk-assessment-wizard-v2:${draftContextKey}`,
    enabled: true,
    version: 2,
    storage: "indexedDb",
    ttlMs: 14 * 24 * 60 * 60 * 1000,
    debounceMs: 450,
    value: {
      currentStep,
      selectedCompanyId,
      companyInfo,
      teamInfo,
      scopeInfo,
      riskItems,
      correctiveActions,
      conclusionInfo,
      signatureRows,
      logo,
      riskAdditionMethod,
    },
    initialValue: createInitialDraft(),
    isDirty:
      Boolean(cleanText(companyInfo.companyTitle)) ||
      Boolean(selectedCompanyId) ||
      scopeInfo.assessmentScopeItems.some((item) => Boolean(cleanText(item))) ||
      riskItems.length > 0 ||
      correctiveActions.length > 0 ||
      signatureRows.length > 0 ||
      Boolean(riskAdditionMethod) ||
      currentStep > 0,
    onRestore: (draft) => {
      setCurrentStep(Math.min(Math.max(draft.currentStep || 0, 0), WIZARD_STEPS.length - 1));
      setSelectedCompanyId(draft.selectedCompanyId || locationState?.companyId || "");
      setCompanyInfo({ ...emptyCompanyInfo(), ...(draft.companyInfo || {}) });
      setTeamInfo(normalizeTeamInfo(draft.teamInfo || {}));
      const restoredScope = { ...emptyScopeInfo(), ...(draft.scopeInfo || {}) };
      setScopeInfo({
        evaluatedSections: cleanText(restoredScope.evaluatedSections),
        assessmentScopeItems:
          Array.isArray(restoredScope.assessmentScopeItems) && restoredScope.assessmentScopeItems.length > 0
            ? restoredScope.assessmentScopeItems
            : splitTextToItems((draft.scopeInfo as { scopeText?: string } | undefined)?.scopeText),
      });
      setRiskItems(Array.isArray(draft.riskItems) ? draft.riskItems : []);
      setCorrectiveActions(Array.isArray(draft.correctiveActions) ? draft.correctiveActions : []);
      const restoredConclusion = { ...emptyConclusionInfo(), ...(draft.conclusionInfo || {}) };
      setConclusionInfo({
        ...restoredConclusion,
        conclusionItems:
          Array.isArray(restoredConclusion.conclusionItems) && restoredConclusion.conclusionItems.length > 0
            ? restoredConclusion.conclusionItems
            : splitTextToItems(restoredConclusion.generalConclusion),
      });
      setSignatureRows(Array.isArray(draft.signatureRows) ? draft.signatureRows : []);
      setLogo(draft.logo || null);
      setRiskAdditionMethod(draft.riskAdditionMethod || null);
    },
    debugLabel: "RiskAssessmentWizardV2",
  });

  useEffect(() => {
    let active = true;
    const checkTemplate = async () => {
      try {
        const response = await fetch("/templates/Risk_Analizi.docx");
        if (!active) return;
        setWordTemplateAvailable(response.ok);
      } catch {
        if (!active) return;
        setWordTemplateAvailable(false);
      } finally {
        if (active) setCheckingTemplate(false);
      }
    };
    void checkTemplate();
    return () => {
      active = false;
    };
  }, []);

  const fetchRiskTemplates = async () => {
    if (!profile?.organization_id) {
      setRiskTemplates([]);
      return;
    }

    setLoadingRiskTemplates(true);
    try {
      const { data, error } = await supabase
        .from("risk_assessment_templates")
        .select("id, name, sector, method, payload, created_at")
        .eq("org_id", profile.organization_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRiskTemplates((data || []) as RiskAssessmentTemplateRecord[]);
    } catch (error) {
      console.error("Risk wizard template fetch error", error);
      toast.error("Risk sablonlari yüklenemedi.");
    } finally {
      setLoadingRiskTemplates(false);
    }
  };

  useEffect(() => {
    if (!riskTemplateDialogOpen) return;
    void fetchRiskTemplates();
  }, [profile?.organization_id, riskTemplateDialogOpen]);

  useEffect(() => {
    let active = true;
    const loadCompanies = async () => {
      setCompaniesLoading(true);
      try {
        let query = supabase
          .from("companies")
          .select("*")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (profile?.organization_id) {
          query = query.eq("organization_id", profile.organization_id);
        } else if (user?.id) {
          query = query.eq("user_id", user.id);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!active) return;

        const companyRows = (data || []) as Array<Record<string, unknown>>;
        const companyIds = companyRows.map((row) => String(row.id)).filter(Boolean);
        let assignments: CompanyAssignmentForRisk[] = [];
        let organizationInfo: OrganizationForRisk | null = null;

        if (companyIds.length > 0) {
          const { data: assignmentRows, error: assignmentError } = await supabase
            .from("company_assignments")
            .select("company_id, role_type, person_name, certificate_no, phone, email, notes, is_active")
            .in("company_id", companyIds);

          if (assignmentError) {
            console.warn("Risk wizard company assignment fetch warning", assignmentError);
          } else {
            assignments = (assignmentRows || []) as CompanyAssignmentForRisk[];
          }
        }

        if (profile?.organization_id) {
          const { data: organizationRow, error: organizationError } = await supabase
            .from("organizations")
            .select("*")
            .eq("id", profile.organization_id)
            .maybeSingle();

          if (organizationError) {
            console.warn("Risk wizard organization fetch warning", organizationError);
          } else {
            organizationInfo = organizationRow as OrganizationForRisk | null;
          }
        }

        const organizationOsgbTitle = pickFirstText(
          organizationInfo?.company_name,
          organizationInfo?.name,
          organizationInfo?.title,
        );
        const organizationOsgbAuthorizedPerson = pickFirstText(
          organizationInfo?.authorized_person,
          organizationInfo?.representative_name,
          profile?.full_name,
        );

        const mappedCompanies = companyRows.map((row) => ({
            id: String(row.id),
            name: cleanText(String(row.name || row.company_name || "Isimsiz firma")),
            email: row.email ? String(row.email) : null,
            phone: row.phone ? String(row.phone) : null,
            address: row.address ? String(row.address) : null,
            sgkNumber: row.sgk_number || row.sgk_workplace_number || row.workplace_registration_number
              ? String(row.sgk_number || row.sgk_workplace_number || row.workplace_registration_number)
              : null,
            employeeCount: parseOptionalNumber(row.employee_count),
            hazardClass: row.hazard_class ? String(row.hazard_class) : null,
            activityScope: row.activity_scope || row.sector || row.industry_sector || row.industry
              ? String(row.activity_scope || row.sector || row.industry_sector || row.industry)
              : null,
            employerRepresentativeName: row.employer_representative_name ? String(row.employer_representative_name) : null,
            employerRepresentativeTcNo: row.employer_representative_tc_no ? String(row.employer_representative_tc_no) : null,
            employerRepresentativePhone: row.employer_representative_phone ? String(row.employer_representative_phone) : null,
            employerRepresentativeTitle: row.employer_representative_title ? String(row.employer_representative_title) : null,
            occupationalSafetySpecialistName: row.occupational_safety_specialist_name
              ? String(row.occupational_safety_specialist_name)
              : null,
            occupationalSafetySpecialistTcNo: row.occupational_safety_specialist_tc_no
              ? String(row.occupational_safety_specialist_tc_no)
              : null,
            occupationalSafetySpecialistPhone: row.occupational_safety_specialist_phone
              ? String(row.occupational_safety_specialist_phone)
              : null,
            occupationalSafetySpecialistCertificateNo: row.occupational_safety_specialist_certificate_no
              ? String(row.occupational_safety_specialist_certificate_no)
              : null,
            occupationalSafetySpecialistCertificateClass: row.occupational_safety_specialist_certificate_class
              ? String(row.occupational_safety_specialist_certificate_class)
              : null,
            workplaceDoctorName: row.workplace_doctor_name ? String(row.workplace_doctor_name) : null,
            workplaceDoctorTcNo: row.workplace_doctor_tc_no ? String(row.workplace_doctor_tc_no) : null,
            workplaceDoctorPhone: row.workplace_doctor_phone ? String(row.workplace_doctor_phone) : null,
            workplaceDoctorCertificateNo: row.workplace_doctor_certificate_no ? String(row.workplace_doctor_certificate_no) : null,
            employeeRepresentativeName: row.employee_representative_name ? String(row.employee_representative_name) : null,
            employeeRepresentativeTcNo: row.employee_representative_tc_no ? String(row.employee_representative_tc_no) : null,
            employeeRepresentativePhone: row.employee_representative_phone ? String(row.employee_representative_phone) : null,
            employeeRepresentativeTitle: row.employee_representative_title ? String(row.employee_representative_title) : null,
            osgbTitle: pickFirstText(row.osgb_title, row.osgb_name, organizationOsgbTitle) || null,
            osgbAuthorizedPerson: pickFirstText(row.osgb_authorized_person, row.osgb_representative_name, organizationOsgbAuthorizedPerson) || null,
            osgbPhone: pickFirstText(row.osgb_phone, organizationInfo?.phone, profile?.phone) || null,
            osgbEmail: pickFirstText(row.osgb_email, organizationInfo?.email, profile?.email) || null,
            osgbAddress: pickFirstText(row.osgb_address, organizationInfo?.address) || null,
          }));

        setCompanies(enrichCompaniesWithAssignments(mappedCompanies, assignments));
      } catch (error) {
        console.error("Risk wizard company fetch error", error);
        if (active) toast.error("Profildeki firmalar yüklenemedi.");
      } finally {
        if (active) setCompaniesLoading(false);
      }
    };

    void loadCompanies();
    return () => {
      active = false;
    };
  }, [profile?.organization_id, user?.id]);

  const previewRiskItems = useMemo(() => buildRiskItemsSummary(riskItems), [riskItems]);
  const previewActions = useMemo(() => buildCorrectiveActionsSummary(correctiveActions), [correctiveActions]);
  const previewSignatureRows = useMemo(
    () => (signatureRows.length > 0 ? signatureRows : buildSignatureRowsFromTeam(teamInfo)),
    [signatureRows, teamInfo],
  );
  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) || null,
    [companies, selectedCompanyId],
  );
  const selectedCompanyMissingTeamFields = useMemo(() => {
    if (!selectedCompany) return [];
    return [
      ["İşveren / İşveren Vekili", selectedCompany.employerRepresentativeName],
      ["İş Güvenliği Uzmanı", selectedCompany.occupationalSafetySpecialistName],
      ["İşyeri Hekimi", selectedCompany.workplaceDoctorName],
      ["Çalışan Temsilcisi", selectedCompany.employeeRepresentativeName],
    ]
      .filter(([, value]) => !cleanText(String(value || "")))
      .map(([label]) => label);
  }, [selectedCompany]);
  const manualRiskCategories = useMemo(() => {
    const search = manualRiskSearch.toLocaleLowerCase("tr-TR").trim();
    const grouped = new Map<string, ManualRiskLibraryItem[]>();

    MANUAL_RISK_LIBRARY.forEach((item) => {
      const category = cleanText(item.category || "Genel");
      const searchableText = [
        item.category,
        item.hazardSource,
        item.riskConsequence,
        item.currentMeasure,
        item.additionalMeasures,
        item.responsible,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      if (search && !searchableText.includes(search)) return;
      grouped.set(category, [...(grouped.get(category) || []), item]);
    });

    return Array.from(grouped.entries())
      .map(([category, items]) => ({ category, items }))
      .sort((first, second) => first.category.localeCompare(second.category, "tr-TR"));
  }, [manualRiskSearch]);

  const progressRatio = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  const validationState = useMemo(() => {
    const missingCompanyFields = REQUIRED_COMPANY_FIELDS.filter((field) => !cleanText(String(companyInfo[field] || "")));
    return {
      companyStepValid: missingCompanyFields.length === 0,
      missingCompanyFields,
    };
  }, [companyInfo]);

  const isStepValid = (stepIndex: number) => {
    return { valid: true };
  };

  const resetWizard = () => {
    clearDraft();
    setCurrentStep(0);
    setSelectedCompanyId("");
    setCompanyInfo(emptyCompanyInfo());
    setTeamInfo(emptyTeamInfo());
    setScopeInfo(emptyScopeInfo());
    setRiskItems([]);
    setCorrectiveActions([]);
    setConclusionInfo(emptyConclusionInfo());
    setSignatureRows([]);
    setLogo(null);
    setRiskAdditionMethod(null);
    setAiSector("");
    setAiContext("");
    setAiRiskCount("40");
    setManualRiskSearch("");
    setExpandedManualCategories({});
    setTouched({});
    toast.success("Risk değerlendirme taslagi temizlendi.");
  };

  const touchField = (key: string) => setTouched((prev) => ({ ...prev, [key]: true }));

  const applyCompanyToWizard = (companyId: string) => {
    setSelectedCompanyId(companyId);
    const company = companies.find((item) => item.id === companyId);
    if (!company) return;

    setCompanyInfo((prev) => ({
      ...buildCompanyInfoFromProfile(company),
      assessmentDate: prev.assessmentDate || today,
      riskMethod: prev.riskMethod,
      note: prev.note,
    }));
    setTeamInfo(buildTeamInfoFromProfile(company));
    setSignatureRows([]);

    const missingFields = [
      ["İşveren / İşveren Vekili", company.employerRepresentativeName],
      ["İş Güvenliği Uzmanı", company.occupationalSafetySpecialistName],
      ["İşyeri Hekimi", company.workplaceDoctorName],
      ["Çalışan Temsilcisi", company.employeeRepresentativeName],
    ].filter(([, value]) => !cleanText(String(value || "")));

    if (missingFields.length > 0) {
      toast.warning("Firma bilgileri aktarildi; risk değerlendirme ekibinde eksik alanlar var.", {
        description: missingFields.map(([label]) => label).join(", "),
      });
    } else {
      toast.success("Firma ve risk değerlendirme ekibi bilgileri otomatik dolduruldu.");
    }
  };

  useEffect(() => {
    if (!selectedCompany) return;

    const companyFallback = buildCompanyInfoFromProfile(selectedCompany);
    const teamFallback = buildTeamInfoFromProfile(selectedCompany);

    setCompanyInfo((current) => mergeCompanyInfoFallback(current, companyFallback));
    setTeamInfo((current) => mergeTeamInfoFallback(current, teamFallback));
  }, [selectedCompany]);

  const handleNext = () => {
    const validation = isStepValid(currentStep);
    if (!validation.valid) {
      REQUIRED_COMPANY_FIELDS.forEach((field) => touchField(String(field)));
      toast.error(validation.message);
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const updateCompanyInfo = <K extends keyof RiskWizardCompanyInfo>(key: K, value: RiskWizardCompanyInfo[K]) => {
    setCompanyInfo((prev) => ({ ...prev, [key]: value }));
    touchField(String(key));
  };

  const updateTeamPerson = (
    key: "employer" | "employeeRepresentative" | "safetyExpert" | "workplaceDoctor",
    field: keyof RiskTeamPerson,
    value: string,
  ) => {
    setTeamInfo((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const updateTeamOsgb = (field: keyof RiskTeamOsgb, value: string) => {
    setTeamInfo((prev) => ({
      ...prev,
      osgb: {
        ...prev.osgb,
        [field]: value,
      },
    }));
  };

  const updateScopeInfo = <K extends keyof RiskWizardScopeInfo>(key: K, value: RiskWizardScopeInfo[K]) => {
    setScopeInfo((prev) => ({ ...prev, [key]: value }));
  };

  const updateConclusionInfo = <K extends keyof RiskWizardConclusionInfo>(
    key: K,
    value: RiskWizardConclusionInfo[K],
  ) => {
    setConclusionInfo((prev) => ({ ...prev, [key]: value }));
  };

  const addRiskItem = () => {
    setRiskItems((prev) => [...prev, createEmptyRiskItem(prev.length + 1)]);
  };

  const appendRiskItems = (items: RiskWizardTableItem[]) => {
    if (items.length === 0) return;
    setRiskItems((prev) =>
      [...prev, ...items].map((item, index) => ({
        ...item,
        no: index + 1,
      })),
    );
  };

  const buildBuiltInRiskRows = (sector: string, targetCount: number) => {
    const templates = generateSectorRiskTemplates(sector || "Genel Karma Risk Analizi");
    const safeTemplates = templates.length > 0 ? templates : generateSectorRiskTemplates("Genel Karma Risk Analizi");
    const count = Math.max(1, Math.min(120, targetCount));

    return Array.from({ length: count }, (_, index) =>
      createRiskRowFromGeneratedRisk(safeTemplates[index % safeTemplates.length], index, "sector-risk"),
    );
  };

  const generateAiRiskItems = async () => {
    const sector = cleanText(aiSector || companyInfo.activityScope || scopeInfo.evaluatedSections || companyInfo.companyTitle);
    if (!sector) {
      toast.error("AI ile risk üretmek için sektör, faaliyet kapsami veya kısa bir isyeri açiklamasi girin.");
      return;
    }

    const defaultCount = getSectorMinimumRiskItemCount(sector, 40);
    const targetCount = Math.max(1, Math.min(120, asInt(aiRiskCount) || defaultCount));
    const promptSector = cleanText([sector, aiContext ? `Ek saha notu: ${aiContext}` : ""].filter(Boolean).join(". "));

    setAiGenerating(true);
    try {
      const generatedRisks = await generateRisksWithGemini(promptSector, companyInfo.companyTitle);
      const aiRows = generatedRisks
        .slice(0, targetCount)
        .map((risk, index) => createRiskRowFromGeneratedRisk(risk, index, "ai-risk"));

      const missingCount = targetCount - aiRows.length;
      const completedRows =
        missingCount > 0 ? [...aiRows, ...buildBuiltInRiskRows(sector, missingCount)] : aiRows;

      appendRiskItems(completedRows);
      setRiskAdditionMethod("ai");
      setCurrentStep(RISK_TABLE_STEP_INDEX);
      toast.success(`${completedRows.length} risk maddesi Risk Değerlendirme Tablosu’na eklendi.`);
    } catch (error) {
      console.error("Risk wizard AI generation error", error);
      const fallbackRows = buildBuiltInRiskRows(sector, targetCount);
      appendRiskItems(fallbackRows);
      setRiskAdditionMethod("ai");
      setCurrentStep(RISK_TABLE_STEP_INDEX);
      toast.info("AI servisi yanit veremedi; sektör bazli hazir risk paketi tabloya eklendi.");
    } finally {
      setAiGenerating(false);
    }
  };

  const addManualLibraryItems = (items: ManualRiskLibraryItem[]) => {
    if (items.length === 0) return;

    const mappedItems = items.map((item, index) => mapManualLibraryItemToWizardRow(item, index));
    appendRiskItems(mappedItems);
    setRiskAdditionMethod("manual");
    toast.success(`${mappedItems.length} risk maddesi Risk Değerlendirme Tablosu’na eklendi.`);
  };

  const addManualLibraryCategory = (items: ManualRiskLibraryItem[]) => {
    addManualLibraryItems(items);
    setCurrentStep(RISK_TABLE_STEP_INDEX);
  };

  const toggleManualCategory = (category: string) => {
    setExpandedManualCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const handleRiskAdditionMethodSelect = (method: RiskAdditionMethod) => {
    setRiskAdditionMethod(method);

    if (method === "manual") {
      return;
    }

    if (method === "templates") {
      setRiskTemplateDialogOpen(true);
      return;
    }

    if (method === "saved") {
      if (!importAssessmentId) {
        toast.info("Kayitli riskleri aktarmak için wizard mevcut bir risk değerlendirmesi üzerinden açilmalidir.");
        return;
      }
      void importRiskItemsFromAssessment();
    }
  };

  const updateRiskItem = <K extends keyof RiskWizardTableItem>(id: string, key: K, value: RiskWizardTableItem[K]) => {
    setRiskItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextItem = { ...item, [key]: value };
        if (key === "probability" || key === "severity") {
          const score = asInt(String(nextItem.probability)) * asInt(String(nextItem.severity));
          nextItem.riskScore = score ? String(score) : "";
          nextItem.riskLevel = score ? getRiskLevelFromScore(score) : "";
        }
        if (key === "riskScore") {
          nextItem.riskLevel = getRiskLevelFromScore(asInt(String(value)));
        }
        return nextItem;
      }),
    );
  };

  const removeRiskItem = (id: string) => {
    setRiskItems((prev) => prev.filter((item) => item.id !== id).map((item, index) => ({ ...item, no: index + 1 })));
  };

  const addCorrectiveAction = () => {
    setCorrectiveActions((prev) => [...prev, createEmptyAction(prev.length + 1)]);
  };

  const updateCorrectiveAction = <K extends keyof CorrectivePreventiveAction>(
    id: string,
    key: K,
    value: CorrectivePreventiveAction[K],
  ) => {
    setCorrectiveActions((prev) => prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  };

  const removeCorrectiveAction = (id: string) => {
    setCorrectiveActions((prev) => prev.filter((item) => item.id !== id).map((item, index) => ({ ...item, no: index + 1 })));
  };

  const regenerateSignaturesFromTeam = () => {
    setSignatureRows(buildSignatureRowsFromTeam(teamInfo));
    toast.success("İmza satirlari ekip bilgilerinden yeniden oluşturuldu.");
  };

  const addSignatureRow = () => {
    setSignatureRows((prev) => [...prev, createEmptySignatureRow()]);
  };

  const updateSignatureRow = <K extends keyof SignatureRow>(id: string, key: K, value: SignatureRow[K]) => {
    setSignatureRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const removeSignatureRow = (id: string) => {
    setSignatureRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      toast.error("Sadece PNG veya JPG formatinda logo yükleyebilirsiniz.");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo dosyasi en fazla 2 MB olabilir.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      setLogo({
        name: file.name,
        type: file.type,
        dataUrl: String(loadEvent.target?.result || ""),
      });
      toast.success("Logo önizlemesi hazirlandi.");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const importRiskItemsFromAssessment = async () => {
    if (!user?.id) {
      toast.error("Kayitli riskleri aktarmak için oturum bulunamadi.");
      return;
    }
    setImportingRiskItems(true);
    try {
      if (importAssessmentId) {
        const { data, error } = await supabase
          .from("risk_items")
          .select(
            "id,item_number,department,hazard,risk,affected_people,existing_controls,proposed_controls,probability_1,severity_1,score_1,risk_class_1,responsible_person,deadline",
          )
          .eq("assessment_id", importAssessmentId)
          .order("sort_order", { ascending: true });
        if (error) throw error;
        const mappedItems = (data || []).map((item, index) =>
          mapEditorRiskItemToWizardRow(item as unknown as RiskItem, index),
        );
        setRiskItems(mappedItems);
        toast.success(`${mappedItems.length} risk maddesi editörden aktarildi.`);
      } else {
        const savedRisks = await listSavedRiskItems(user.id);
        const mappedItems = savedRisks.map(mapSavedRiskItemToWizardRow);
        setRiskItems(mappedItems);
        toast.success(`${mappedItems.length} kayıtlı risk maddesi aktarildi.`);
      }
      setRiskAdditionMethod("saved");
      setCurrentStep(RISK_TABLE_STEP_INDEX);
    } catch (error) {
      console.error("Risk wizard import error", error);
      toast.error("Risk maddeleri aktarilamadi.");
    } finally {
      setImportingRiskItems(false);
    }
  };

  const applyRiskTemplateToWizard = (template: RiskAssessmentTemplateRecord) => {
    const templateItems = Array.isArray(template.payload?.items) ? template.payload.items : [];
    if (templateItems.length === 0) {
      toast.error("Seçilen sablonda aktarilacak risk maddesi bulunamadi.");
      return;
    }

    const mappedItems = templateItems.map((item, index) => mapTemplateRiskItemToWizardRow(item, index));
    setRiskItems(mappedItems);
    setRiskAdditionMethod("templates");
    setCurrentStep(RISK_TABLE_STEP_INDEX);
    setRiskTemplateDialogOpen(false);
    toast.success(`"${template.name}" sablonundan ${mappedItems.length} risk maddesi tabloya aktarildi.`);
  };

  const handleSaveDraft = () => {
    toast.success("Taslak kaydedildi.", {
      description: "Girilen bilgiler adimlar arasinda ve tekrar giriste korunacaktir.",
    });
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const doc = await buildWizardPdf({
        currentStep,
        companyInfo,
        teamInfo,
        scopeInfo,
        riskItems,
        correctiveActions,
        conclusionInfo,
        signatureRows,
        logo,
      });
      const fileName = `risk-analizi-${slugify(companyInfo.companyTitle || "firma")}-${today}.pdf`;
      doc.save(fileName);
      toast.success("Risk değerlendirme raporu PDF olarak hazirlandi.");
    } catch (error) {
      console.error("Risk wizard PDF error", error);
      toast.error("PDF raporu oluşturulamadi.");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleWordDownload = async () => {
    setExportingWord(true);
    try {
      await generateRiskAssessmentOfficialDocx({
        companyInfo,
        teamInfo,
        scopeInfo,
        riskItems: buildRiskItemsSummary(riskItems),
        correctiveActions: buildCorrectiveActionsSummary(correctiveActions),
        conclusionInfo: {
          conclusionItems: (conclusionInfo.conclusionItems || []).map((item) => cleanText(item)).filter(Boolean),
          approvalNote: conclusionInfo.approvalNote,
          preparedBy: conclusionInfo.preparedBy,
          approvedBy: conclusionInfo.approvedBy,
          signatureDate: conclusionInfo.signatureDate,
        },
        signatureRows: previewSignatureRows,
      });
      toast.success("Risk değerlendirme raporu Word sablonu ile hazirlandi.");
    } catch (error) {
      console.error("Risk wizard DOCX error", error);
      toast.error("Word çıktısi oluşturulamadi.");
    } finally {
      setExportingWord(false);
    }
    return;

  };

  const addScopeItem = () => {
    setScopeInfo((prev) => ({ ...prev, assessmentScopeItems: [...prev.assessmentScopeItems, ""] }));
  };

  const updateScopeItem = (index: number, value: string) => {
    setScopeInfo((prev) => ({
      ...prev,
      assessmentScopeItems: prev.assessmentScopeItems.map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  };

  const removeScopeItem = (index: number) => {
    setScopeInfo((prev) => ({
      ...prev,
      assessmentScopeItems: prev.assessmentScopeItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const addConclusionItem = () => {
    setConclusionInfo((prev) => ({ ...prev, conclusionItems: [...prev.conclusionItems, ""] }));
  };

  const updateConclusionItem = (index: number, value: string) => {
    setConclusionInfo((prev) => ({
      ...prev,
      conclusionItems: prev.conclusionItems.map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  };

  const removeConclusionItem = (index: number) => {
    setConclusionInfo((prev) => ({
      ...prev,
      conclusionItems: prev.conclusionItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const renderInput = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    options?: { placeholder?: string; required?: boolean; type?: string; errorKey?: string },
  ) => {
    const isError = options?.required && touched[options?.errorKey || label] && !cleanText(value);
    return (
      <div className="space-y-2">
        <Label className={cn("text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300", isError && "text-red-500")}>
          {label}
        </Label>
        <Input
          type={options?.type || "text"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={options?.placeholder}
          className={cn(
            "h-11 rounded-lg border border-slate-300 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500",
            isError && "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
          )}
        />
        {isError ? <p className="text-xs text-red-500">Bu alanı boş bırakabilirsiniz; yalnizca çıktı bilgisini etkiler.</p> : null}
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/30 p-4">
              <p className="text-sm leading-relaxed text-cyan-800 dark:text-cyan-200">
                Firma bilgileri profil kayıtlarından otomatik getirilir. Bu ekranda yaptığınız değişiklikler yalnizca
                risk değerlendirme taslağına kaydedilir.
              </p>
            </div>

            <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-slate-900 dark:text-slate-100">
                  <Building2 className="h-4 w-4 text-cyan-600" />
                  Profilimdeki Firmadan Doldur
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  Firma seçildiginde kapak bilgileri ve Risk Değerlendirme Ekibi alanları Profilim &gt; Firmalar
                  kaydindan otomatik aktarılır.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                  <Select value={selectedCompanyId} onValueChange={applyCompanyToWizard} disabled={companiesLoading}>
                    <SelectTrigger className="h-10 rounded-xl border-slate-300 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                      <SelectValue placeholder={companiesLoading ? "Firmalar yükleniyor..." : "Firma seçin"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-80 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/profile?tab=companies")}
                    className="rounded-xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Profilim / Firmalar
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                {selectedCompany && selectedCompanyMissingTeamFields.length > 0 ? (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                    <p className="font-bold">Risk Değerlendirme Ekibi bilgileri eksik.</p>
                    <p className="mt-1 text-amber-200/90">
                      Eksik alanlar: {selectedCompanyMissingTeamFields.join(", ")}. Bu alanları Profilim &gt; Firmalar
                      sekmesindeki Atamalar bölümünden doldurabilirsiniz.
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {renderInput("Firma Ünvanı", companyInfo.companyTitle, (value) => updateCompanyInfo("companyTitle", value), {
                placeholder: "Firma ünvanı",
                errorKey: "companyTitle",
              })}
              {renderInput("İşyeri Sicil No", companyInfo.workplaceRegistryNo, (value) => updateCompanyInfo("workplaceRegistryNo", value), {
                placeholder: "İşyeri sicil numarası",
              })}
              {renderInput("Adres", companyInfo.address, (value) => updateCompanyInfo("address", value), {
                placeholder: "Açık adres",
              })}
              {renderInput("E-posta", companyInfo.email, (value) => updateCompanyInfo("email", value), {
                placeholder: "E-posta adresi",
                type: "email",
              })}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tehlike Sınıfı</Label>
                <Select value={companyInfo.hazardClass} onValueChange={(value) => updateCompanyInfo("hazardClass", value as HazardClass)}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-300 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                    <SelectItem value="Az Tehlikeli">Az Tehlikeli</SelectItem>
                    <SelectItem value="Tehlikeli">Tehlikeli</SelectItem>
                    <SelectItem value="Çok Tehlikeli">Çok Tehlikeli</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {renderInput("Çalışan Sayısı", companyInfo.employeeCount, (value) => updateCompanyInfo("employeeCount", value), {
                placeholder: "Çalışan sayısı",
                errorKey: "employeeCount",
              })}
              {renderInput("Değerlendirme Tarihi", companyInfo.assessmentDate, (value) => updateCompanyInfo("assessmentDate", value), {
                type: "date",
                errorKey: "assessmentDate",
              })}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Risk Değerlendirme Yöntemi</Label>
                <Select value={companyInfo.riskMethod} onValueChange={(value) => updateCompanyInfo("riskMethod", value as RiskMethod)}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-300 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                    <SelectItem value="5x5 Matris">5x5 Matris</SelectItem>
                    <SelectItem value="Fine-Kinney">Fine-Kinney</SelectItem>
                    <SelectItem value="L Tipi Matris">L Tipi Matris</SelectItem>
                    <SelectItem value="Diğer">Diğer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Faaliyet Kapsamı</Label>
              <Textarea
                value={companyInfo.activityScope}
                onChange={(event) => updateCompanyInfo("activityScope", event.target.value)}
                placeholder="Faaliyet kapsamını kısa ve net biçimde yazın"
                className="min-h-[100px] rounded-xl border-slate-300 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Not</Label>
              <Textarea
                value={companyInfo.note}
                onChange={(event) => updateCompanyInfo("note", event.target.value)}
                placeholder="Opsiyonel not"
                className="min-h-[90px] rounded-xl border-slate-300 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">Boş bırakılırsa çıktıda Not alanı hiç gösterilmez.</p>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Risk Analizi Logosu</Label>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Logo eklerseniz PDF çıktısinin üst bölümünde gösterilir.</p>
              </div>
              {logo ? (
                <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <img src={logo.dataUrl} alt={logo.name} className="h-20 w-40 rounded-xl bg-white object-contain p-3" />
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      onClick={() => setLogo(null)}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Logoyu Kaldır
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full rounded-2xl border border-dashed border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-8 text-center hover:border-cyan-500/30 hover:bg-cyan-500/5"
                >
                  <FileText className="mx-auto h-7 w-7 text-cyan-400" />
                  <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">PNG veya JPG logo seçin</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Maksimum 2 MB</p>
                </button>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-5">
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/30 p-4 text-sm leading-relaxed text-cyan-800 dark:text-cyan-200">
              {hasTeamInfoData(teamInfo)
                ? "Bu bilgiler firma profilinden otomatik getirildi. Bu ekranda yaptığınız değişiklikler risk değerlendirme taslağına kaydedilir."
                : "Firma profilinde kayıtlı ekip bilgisi bulunamadı. Alanları manuel doldurabilir veya boş bırakabilirsiniz."}
            </div>

            <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-slate-900 dark:text-slate-100">Risk Değerlendirme Ekibi</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  Alanlar zorunlu degildir. Boş bırakılan bilgiler çıktıda boş alan olarak kalir.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 p-4">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">İşveren</p>
                {renderInput("Ad - Soyad", teamInfo.employer.fullName, (value) => updateTeamPerson("employer", "fullName", value), {
                  placeholder: "İşveren ad soyad",
                })}
                {renderInput("T.C. Kimlik Numarasi", teamInfo.employer.tcNo, (value) => updateTeamPerson("employer", "tcNo", value), {
                  placeholder: "T.C. kimlik numarası",
                })}
                {renderInput("Telefon Numarasi", teamInfo.employer.phone, (value) => updateTeamPerson("employer", "phone", value), {
                  placeholder: "Telefon numarası",
                })}
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 p-4">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Çalışan Temsilcisi</p>
                {renderInput("Ad - Soyad", teamInfo.employeeRepresentative.fullName, (value) => updateTeamPerson("employeeRepresentative", "fullName", value), {
                  placeholder: "Çalışan temsilcisi ad soyad",
                })}
                {renderInput("T.C. Kimlik Numarasi", teamInfo.employeeRepresentative.tcNo, (value) => updateTeamPerson("employeeRepresentative", "tcNo", value), {
                  placeholder: "T.C. kimlik numarası",
                })}
                {renderInput("Telefon Numarasi", teamInfo.employeeRepresentative.phone, (value) => updateTeamPerson("employeeRepresentative", "phone", value), {
                  placeholder: "Telefon numarası",
                })}
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 p-4">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">İş Güvenliği Uzmanı</p>
                {renderInput("Ad - Soyad", teamInfo.safetyExpert.fullName, (value) => updateTeamPerson("safetyExpert", "fullName", value), {
                  placeholder: "Is güvenligi uzmani ad soyad",
                })}
                {renderInput("T.C. Kimlik Numarasi", teamInfo.safetyExpert.tcNo, (value) => updateTeamPerson("safetyExpert", "tcNo", value), {
                  placeholder: "T.C. kimlik numarası",
                })}
                {renderInput("Telefon Numarasi", teamInfo.safetyExpert.phone, (value) => updateTeamPerson("safetyExpert", "phone", value), {
                  placeholder: "Telefon numarası",
                })}
                {renderInput("Sertifika No", teamInfo.safetyExpert.certificateNo || "", (value) => updateTeamPerson("safetyExpert", "certificateNo", value), {
                  placeholder: "Sertifika numarası",
                })}
                {renderInput("Sertifika Sınıfı", teamInfo.safetyExpert.certificateClass || "", (value) => updateTeamPerson("safetyExpert", "certificateClass", value), {
                  placeholder: "A/B/C sinifi veya ek bilgi",
                })}
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 p-4">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">İşyeri Hekimi</p>
                {renderInput("Ad - Soyad", teamInfo.workplaceDoctor.fullName, (value) => updateTeamPerson("workplaceDoctor", "fullName", value), {
                  placeholder: "İşyeri hekimi ad soyad",
                })}
                {renderInput("T.C. Kimlik Numarasi", teamInfo.workplaceDoctor.tcNo, (value) => updateTeamPerson("workplaceDoctor", "tcNo", value), {
                  placeholder: "T.C. kimlik numarası",
                })}
                {renderInput("Telefon Numarasi", teamInfo.workplaceDoctor.phone, (value) => updateTeamPerson("workplaceDoctor", "phone", value), {
                  placeholder: "Telefon numarası",
                })}
                {renderInput("Sertifika No", teamInfo.workplaceDoctor.certificateNo || "", (value) => updateTeamPerson("workplaceDoctor", "certificateNo", value), {
                  placeholder: "Sertifika numarası",
                })}
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 p-4 md:col-span-2">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">OSGB Bilgileri</p>
                <div className="grid gap-4 md:grid-cols-2">
                  {renderInput("OSGB Unvani", teamInfo.osgb.title, (value) => updateTeamOsgb("title", value), {
                    placeholder: "OSGB unvani",
                  })}
                  {renderInput("Telefon Numarasi", teamInfo.osgb.phone, (value) => updateTeamOsgb("phone", value), {
                    placeholder: "Telefon numarası",
                  })}
                  {renderInput("E-posta", teamInfo.osgb.email, (value) => updateTeamOsgb("email", value), {
                    placeholder: "E-posta adresi",
                    type: "email",
                  })}
                  {renderInput("Yetkili Kisi", teamInfo.osgb.authorizedPerson, (value) => updateTeamOsgb("authorizedPerson", value), {
                    placeholder: "Yetkili kisi",
                  })}
                  {renderInput("Adres", teamInfo.osgb.address || "", (value) => updateTeamOsgb("address", value), {
                    placeholder: "OSGB adresi",
                  })}
                </div>
              </div>
              </CardContent>
            </Card>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Adim 3</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Değerlendirme kapsamını madde madde girin. Risk puanlama yöntemi bölümünde PDF’te her zaman sabit 5x5 tablo basilir.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button type="button" onClick={addScopeItem} className="rounded-xl bg-violet-600 text-white hover:bg-violet-700">
                <Plus className="mr-2 h-4 w-4" />
                Kapsam Maddesi Ekle
              </Button>
            </div>

            <div className="space-y-4">
              {scopeInfo.assessmentScopeItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-6 text-sm text-slate-400">
                  Henüz kapsam maddesi eklenmedi.
                </div>
              ) : (
                scopeInfo.assessmentScopeItems.map((item, index) => (
                  <div key={`scope-${index}`} className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge className="rounded-full border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-slate-600 dark:text-slate-300">Kapsam Maddesi #{index + 1}</Badge>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        onClick={() => removeScopeItem(index)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Sil
                      </Button>
                    </div>
                    <Textarea
                      value={item}
                      onChange={(event) => updateScopeItem(index, event.target.value)}
                      placeholder="Değerlendirme kapsami maddesi"
                      className="min-h-[90px] rounded-2xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Degerlendirilen Bölümler / Faaliyetler
              </Label>
              <Textarea
                value={scopeInfo.evaluatedSections}
                onChange={(event) => updateScopeInfo("evaluatedSections", event.target.value)}
                placeholder="Örn: Üretim hatti, depo, sevkiyat alanı"
                className="min-h-[100px] rounded-2xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
            <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
              <CardHeader>
                <CardTitle className="text-sm text-slate-900 dark:text-slate-100">PDF’te Sabit Görünecek Risk Puanlama Metodu</CardTitle>
                <CardDescription className="text-slate-400">
                  Kapakta seçtiginiz yöntem yazmaya devam eder; ancak resmi sablon geregi bu raporda sabit 5x5 puanlama açiklamasi ve tablosu kullanilir.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {FIXED_METHOD_DESCRIPTION}
              </CardContent>
            </Card>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-violet-500/10 bg-violet-500/5 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-violet-300">Adim 4</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Riskleri tek merkezden ekleyin: AI ile üretin, manuel satir açin, sablonlardan aktarin veya kayıtlı
                risklerinizi tabloya tasiyin.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  id: "ai" as const,
                  title: "Yapay Zeka Sohbeti ile Risk Üret",
                  description: "AI önce isyeriniz hakkinda baglam alir, sonra sektör odakli riskleri tabloya ekler.",
                  icon: <Sparkles className="h-6 w-6" />,
                  accent: "from-fuchsia-500 to-violet-600",
                  badge: "ÖNERILEN",
                  items: ["Sektör ve faaliyet odakli üretim", "Hazir risk paketiyle güvenli yedek", "Tabloya tek tikla aktarim"],
                },
                {
                  id: "manual" as const,
                  title: "Manuel Seçim",
                  description: "Risk kütüphanesinden veya kendi saha notlarinizdan satirlari kendiniz girin.",
                  icon: <BookOpen className="h-6 w-6" />,
                  accent: "from-emerald-500 to-teal-600",
                  items: ["Boş risk satiri oluşturma", "Tam kontrol", "Aninda düzenleme"],
                },
                {
                  id: "templates" as const,
                  title: "Sablonlar & Paylasilanlar",
                  description: "Kayitli sablonlarinizi veya paylasilan risk paketlerini hizlica kullanin.",
                  icon: <Archive className="h-6 w-6" />,
                  accent: "from-amber-500 to-orange-600",
                  items: ["Sablon kütüphanesi", "Tek tikla aktarma", "Sektör paketleri"],
                },
                {
                  id: "saved" as const,
                  title: "Kayitli Risklerim",
                  description: "Daha önce oluşturdugunuz risk maddelerini mevcut rapora aktarin.",
                  icon: <FolderOpen className="h-6 w-6" />,
                  accent: "from-blue-500 to-cyan-600",
                  items: ["Mevcut değerlendirmeden aktarim", "Arama ve filtreleme için hazir yapi", "Toplu ekleme"],
                },
              ].map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => handleRiskAdditionMethodSelect(method.id)}
                  className={cn(
                    "relative rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-900/50",
                    riskAdditionMethod === method.id
                      ? "border-violet-400/50 bg-violet-500/10"
                      : "border-slate-800 bg-white dark:bg-slate-900/40",
                  )}
                >
                  {method.badge ? (
                    <Badge className="absolute -top-3 left-5 rounded-full bg-violet-500 px-3 py-1 text-[10px] font-black text-white">
                      {method.badge}
                    </Badge>
                  ) : null}
                  <div className={cn("mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white", method.accent)}>
                    {method.icon}
                  </div>
                  <h4 className="text-base font-black leading-snug text-slate-900 dark:text-slate-100">{method.title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{method.description}</p>
                  <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    {method.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            {riskAdditionMethod === "manual" ? (
              <Card className="overflow-hidden border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <CardHeader className="border-b border-slate-800/80">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/90 text-white">
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-slate-900 dark:text-slate-100">Manuel Risk Seçimi</CardTitle>
                        <CardDescription className="mt-1 text-slate-400">
                          Sablondaki {MANUAL_RISK_LIBRARY.length} risk maddesini kategorilere göre seçip tabloya ekleyin.
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className="w-fit rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                      {manualRiskCategories.length} kategori
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-5">
                  <div className="grid gap-3 lg:grid-cols-[170px_1fr] lg:items-center">
                    <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
                      <BookOpen className="h-4 w-4 text-emerald-400" />
                      Risk Kütüphanesi
                    </div>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                      <Input
                        value={manualRiskSearch}
                        onChange={(event) => setManualRiskSearch(event.target.value)}
                        placeholder="Kategori, tehlike, risk veya önlem ara..."
                        className="h-11 rounded-xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70 pl-10 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                    {manualRiskCategories.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-6 text-center text-sm text-slate-400">
                        Aramaniza uygun risk maddesi bulunamadi.
                      </div>
                    ) : (
                      manualRiskCategories.map(({ category, items }) => {
                        const isExpanded = Boolean(expandedManualCategories[category]);
                        return (
                          <div key={category} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
                            <div className="flex items-center gap-3 p-3">
                              <button
                                type="button"
                                onClick={() => toggleManualCategory(category)}
                                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-2 text-left transition hover:bg-slate-800/50"
                              >
                                <span className="truncate text-sm font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">{category}</span>
                                <Badge className="rounded-full bg-slate-700 px-2 py-0.5 text-[11px] font-bold text-slate-900 dark:text-slate-100">
                                  {items.length}
                                </Badge>
                                <ChevronRight
                                  className={cn(
                                    "ml-auto h-4 w-4 shrink-0 text-slate-400 transition-transform",
                                    isExpanded ? "rotate-90" : "",
                                  )}
                                />
                              </button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => addManualLibraryCategory(items)}
                                className="h-9 w-9 shrink-0 rounded-xl text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                                title="Bu kategorideki tüm riskleri ekle"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            {isExpanded ? (
                              <div className="space-y-2 border-t border-slate-800/80 p-3">
                                {items.map((item) => (
                                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                      <div className="min-w-0 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Badge className="rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
                                            #{item.sourceSequenceNo}
                                          </Badge>
                                          {item.riskLevel ? (
                                            <Badge className="rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-300">
                                              {item.riskLevel}
                                            </Badge>
                                          ) : null}
                                        </div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.hazardSource || "Tehlike kaynağı belirtilmedi"}</p>
                                        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.riskConsequence || "Risk açiklamasi yok"}</p>
                                        {item.additionalMeasures ? (
                                          <p className="line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{item.additionalMeasures}</p>
                                        ) : null}
                                      </div>
                                      <Button
                                        type="button"
                                        onClick={() => addManualLibraryItems([item])}
                                        className="shrink-0 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
                                      >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Ekle
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="flex flex-col gap-3 border-t border-slate-800/80 pt-4 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                    <span>Eklenen maddeler bir sonraki adimda düzenlenebilir veya silinebilir.</span>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(RISK_TABLE_STEP_INDEX)}
                      className="rounded-xl border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    >
                      Risk Tablosuna Geç
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="text-base text-slate-900 dark:text-slate-100">AI ile Risk Üretim Alanı</CardTitle>
                <CardDescription className="text-slate-400">
                  Isterseniz kısa bir sektör/saha açiklamasi girin. AI yanit veremezse sistem sektör bazli hazir risk
                  paketini güvenli yedek olarak tabloya ekler.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_160px]">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">İşyeri Türü / Sektör</Label>
                    <Select
                      value={aiSector}
                      onValueChange={(value) => {
                        setAiSector(value);
                        setAiRiskCount(String(getSectorMinimumRiskItemCount(value, 40)));
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
                        <SelectValue placeholder="Sektör seçin veya asagiya açiklama yazın" />
                      </SelectTrigger>
                      <SelectContent className="max-h-80 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
                        {RISK_TEMPLATE_CONFIGS.map((sector) => (
                          <SelectItem key={sector.code} value={sector.name}>
                            {sector.name} · min. {sector.itemCount}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {renderInput("Risk Madde Sayısı", aiRiskCount, setAiRiskCount, {
                    type: "number",
                    placeholder: "40",
                  })}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">AI için Saha Notu</Label>
                  <Textarea
                    value={aiContext}
                    onChange={(event) => setAiContext(event.target.value)}
                    placeholder="Örn: 3 katli santiye, iskele ve geçici elektrik var; taseron ekipler çalisiyor."
                    className="min-h-[100px] rounded-2xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    Sonraki adimda oluşturulan tüm risk maddelerini düzenleyebilir, silebilir veya yeni satir ekleyebilirsiniz.
                  </p>
                  <Button
                    type="button"
                    onClick={generateAiRiskItems}
                    disabled={aiGenerating}
                    className="rounded-xl bg-violet-600 text-white hover:bg-violet-700"
                  >
                    {aiGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {aiGenerating ? "Riskler üretiliyor..." : "AI ile Riskleri Oluştur"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-rose-500/10 bg-rose-500/5 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-rose-400">Adim 5</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Risk tablosu yalnizca eklediginiz veya aktardiginiz satirlar kadar oluşturulur. Boş sablon satiri
                basilmaz.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={addRiskItem} className="rounded-xl bg-violet-600 text-white hover:bg-violet-700">
                <Plus className="mr-2 h-4 w-4" />
                Manuel Risk Maddesi Ekle
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRiskTemplateDialogOpen(true)}
                className="rounded-xl border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
              >
                {exportingWord ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                Risk Şablonundan Ekle
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={importingRiskItems}
                onClick={importRiskItemsFromAssessment}
                className="rounded-xl border-cyan-500/20 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
              >
                {importingRiskItems ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Kayitli Riskleri Aktar
              </Button>
            </div>
            {!importAssessmentId ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kayitli riskler Profilim &gt; Risklerim kütüphanenizden aktarılır; mevcut değerlendirme üzerinden açildiysa editör satirlari da desteklenir.
              </p>
            ) : null}

            <div className="space-y-4">
              {riskItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-6 text-sm text-slate-400">
                  Henüz risk maddesi eklenmedi. Isterseniz manuel satir ekleyin, AI ile üretin veya kayıtlı riskleri aktarin.
                </div>
              ) : (
                riskItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge className="rounded-full border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-slate-600 dark:text-slate-300">Risk Maddesi #{item.no}</Badge>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        onClick={() => removeRiskItem(item.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Sil
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {renderInput("Bölüm / Faaliyet", item.departmentActivity, (value) => updateRiskItem(item.id, "departmentActivity", value))}
                      {renderInput("Tehlike Kaynagi", item.hazardSource, (value) => updateRiskItem(item.id, "hazardSource", value))}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Risk / Olasi Sonuç</Label>
                        <Textarea
                          value={item.riskConsequence}
                          onChange={(event) => updateRiskItem(item.id, "riskConsequence", event.target.value)}
                          className="min-h-[90px] rounded-2xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Etkilenenler</Label>
                        <Textarea
                          value={item.affectedPeople}
                          onChange={(event) => updateRiskItem(item.id, "affectedPeople", event.target.value)}
                          className="min-h-[90px] rounded-2xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mevcut Önlem</Label>
                        <Textarea
                          value={item.currentMeasure}
                          onChange={(event) => updateRiskItem(item.id, "currentMeasure", event.target.value)}
                          className="min-h-[90px] rounded-2xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Alinacak Ilave Önlemler
                        </Label>
                        <Textarea
                          value={item.additionalMeasures}
                          onChange={(event) => updateRiskItem(item.id, "additionalMeasures", event.target.value)}
                          className="min-h-[90px] rounded-2xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-5">
                      {renderInput("O", item.probability, (value) => updateRiskItem(item.id, "probability", value), { type: "number" })}
                      {renderInput("S", item.severity, (value) => updateRiskItem(item.id, "severity", value), { type: "number" })}
                      {renderInput("R", item.riskScore, (value) => updateRiskItem(item.id, "riskScore", value), { type: "number" })}
                      {renderInput("Düzey", item.riskLevel, (value) => updateRiskItem(item.id, "riskLevel", value))}
                      {renderInput("Termin", item.deadline, (value) => updateRiskItem(item.id, "deadline", value), {
                        placeholder: "Süreklilik esastir / gg.aa.yyyy",
                      })}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {renderInput("Sorumlu", item.responsible, (value) => updateRiskItem(item.id, "responsible", value))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Adim 6</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Faaliyet plani tablosu yalnizca eklediginiz satirlardan olusur. Boş satirlar çıktıdan tamamen çikarilir.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button type="button" onClick={addCorrectiveAction} className="rounded-xl bg-violet-600 text-white hover:bg-violet-700">
                <Plus className="mr-2 h-4 w-4" />
                Faaliyet Ekle
              </Button>
            </div>

            {correctiveActions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-6 text-sm text-slate-400">
                Henüz faaliyet eklenmedi. Isterseniz bu adimi boş bırakabilirsiniz.
              </div>
            ) : (
              <div className="space-y-4">
                {correctiveActions.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge className="rounded-full border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-slate-600 dark:text-slate-300">Faaliyet #{item.no}</Badge>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        onClick={() => removeCorrectiveAction(item.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Sil
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {renderInput("Tespit / Risk", item.finding, (value) => updateCorrectiveAction(item.id, "finding", value))}
                      {renderInput("Yapilacak Faaliyet", item.action, (value) => updateCorrectiveAction(item.id, "action", value))}
                      {renderInput("Sorumlu", item.responsible, (value) => updateCorrectiveAction(item.id, "responsible", value))}
                      {renderInput("Termin", item.deadline, (value) => updateCorrectiveAction(item.id, "deadline", value), { type: "date" })}
                      {renderInput("Durum", item.status, (value) => updateCorrectiveAction(item.id, "status", value))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Adim 7</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Genel sonuç maddelerini ekleyin ve imza satirlarini ekip üyelerinden otomatik oluşturun veya elle yönetin.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button type="button" onClick={addConclusionItem} className="rounded-xl bg-violet-600 text-white hover:bg-violet-700">
                <Plus className="mr-2 h-4 w-4" />
                Sonuç Maddesi Ekle
              </Button>
            </div>

            <div className="space-y-4">
              {conclusionInfo.conclusionItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-6 text-sm text-slate-400">
                  Henüz sonuç maddesi eklenmedi.
                </div>
              ) : (
                conclusionInfo.conclusionItems.map((item, index) => (
                  <div key={`conclusion-${index}`} className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge className="rounded-full border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-slate-600 dark:text-slate-300">Sonuç Maddesi #{index + 1}</Badge>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        onClick={() => removeConclusionItem(index)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Sil
                      </Button>
                    </div>
                    <Textarea
                      value={item}
                      onChange={(event) => updateConclusionItem(index, event.target.value)}
                      placeholder="Genel sonuç / onay maddesi"
                      className="min-h-[90px] rounded-2xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Onay Notu</Label>
              <Textarea
                value={conclusionInfo.approvalNote}
                onChange={(event) => updateConclusionInfo("approvalNote", event.target.value)}
                className="min-h-[90px] rounded-2xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {renderInput("Hazirlayan", conclusionInfo.preparedBy, (value) => updateConclusionInfo("preparedBy", value))}
              {renderInput("Onaylayan", conclusionInfo.approvedBy, (value) => updateConclusionInfo("approvedBy", value))}
              {renderInput("İmza Tarihi", conclusionInfo.signatureDate, (value) => updateConclusionInfo("signatureDate", value), { type: "date" })}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" className="rounded-xl border-cyan-500/20 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20" onClick={regenerateSignaturesFromTeam}>
                <Users className="mr-2 h-4 w-4" />
                Ekipten Otomatik Doldur
              </Button>
              <Button type="button" onClick={addSignatureRow} className="rounded-xl bg-violet-600 text-white hover:bg-violet-700">
                <Plus className="mr-2 h-4 w-4" />
                İmza Satırı Ekle
              </Button>
            </div>

            {previewSignatureRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-6 text-sm text-slate-400">
                Henüz imza satiri eklenmedi.
              </div>
            ) : (
              <div className="space-y-4">
                {previewSignatureRows.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-5 grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
                    {renderInput("Adi Soyadi", row.fullName, (value) => updateSignatureRow(row.id, "fullName", value))}
                    {renderInput("Görevi", row.role, (value) => updateSignatureRow(row.id, "role", value))}
                    {renderInput("Belge / Iletisim Bilgisi", row.documentOrContact, (value) => updateSignatureRow(row.id, "documentOrContact", value))}
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-xl border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        onClick={() => removeSignatureRow(row.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Sil
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Adim 8</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Resmî sablondaki bölüm sirasina göre oluşturulacak rapor özetini kontrol edin.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["Firma Ünvanı", companyInfo.companyTitle || "Belirtilmedi"],
                ["Tehlike Sınıfı", companyInfo.hazardClass || "Belirtilmedi"],
                ["Çalışan Sayısı", companyInfo.employeeCount || "Belirtilmedi"],
                ["Faaliyet Kapsamı", companyInfo.activityScope || "Belirtilmedi"],
                ["Değerlendirme Tarihi", formatDisplayDate(companyInfo.assessmentDate)],
                ["Risk Değerlendirme Yöntemi", companyInfo.riskMethod || "Belirtilmedi"],
                ["Risk Madde Sayısı", String(previewRiskItems.length)],
                ["DÖF / Faaliyet Plani Sayısı", String(previewActions.length)],
                ["İmza Satırı Sayısı", String(previewSignatureRows.length)],
                ["Not", cleanText(companyInfo.note) ? "Var" : "Yok"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100 break-words">{value}</p>
                </div>
              ))}
            </div>

            <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="text-base text-slate-900 dark:text-slate-100">Word Şablonu Durumu</CardTitle>
                <CardDescription className="text-slate-400">
                  Resmî sablon dosyasi erisimi kontrol edildi. Sablon bulundugunda resmi Word çıktısi ayni veri setiyle indirilebilir.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Badge className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-semibold", wordTemplateAvailable ? "border-amber-500/20 bg-amber-500/10 text-amber-400" : "border-red-500/20 bg-red-500/10 text-red-400")}>
                    {checkingTemplate ? "Kontrol ediliyor" : wordTemplateAvailable ? "Sablon bulundu" : "Sablon erisilemedi"}
                  </Badge>
                  <span>{wordTemplateAvailable ? "Word sablonu indirilmeye hazir." : "Word sablon dosyasina erisilemiyor."}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base text-slate-900 dark:text-slate-100">Rapor Çıktılari</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  Boş, kismen dolu veya tamamen dolu risk değerlendirme çıktısi oluşturabilirsiniz.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <Button
                  type="button"
                  onClick={handleSaveDraft}
                  variant="outline"
                  className="rounded-xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Taslak Kaydet
                </Button>
                <Button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                  className="rounded-xl bg-cyan-600 text-white hover:bg-cyan-700"
                >
                  {exportingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  PDF Indir
                </Button>
                <Button
                  type="button"
                  onClick={handleWordDownload}
                  disabled={!wordTemplateAvailable || checkingTemplate || exportingWord}
                  variant="outline"
                  className="rounded-xl border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 hover:bg-amber-100 disabled:opacity-60"
                >
                  {exportingWord ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                  Word Indir
                </Button>
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:text-slate-100 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
      <div className="mx-auto max-w-[1200px] space-y-6">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 shadow-sm md:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_260px] lg:items-center">
          <div className="space-y-4">
            <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-slate-100 md:text-3xl">
              Risk Değerlendirme Oluştur
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Firma bilgileri ve risk değerlendirme ekibi, firma profilinden otomatik getirilir. Gerekirse bu
              ekranda düzenlenebilir.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">İlerleme</span>
              <Badge className="rounded-full border border-cyan-200 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/30 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200 text-[10px] font-semibold">
                %{Math.round(progressRatio)}
              </Badge>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-cyan-500 transition-all duration-300" style={{ width: `${progressRatio}%` }} />
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Alanları boş birakarak da taslak ve çıktı oluşturabilirsiniz.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6">
        <Card className="overflow-hidden rounded-xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm">
          <CardContent className="space-y-6 p-6">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {WIZARD_STEPS.map((step, index) => {
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      if (index <= currentStep) {
                        setCurrentStep(index);
                        return;
                      }
                      setCurrentStep(index);
                    }}
                    className={cn(
                      "min-w-[138px] rounded-xl border p-3 text-left transition",
                      isActive && "border-cyan-400 bg-cyan-50 dark:border-cyan-500 dark:bg-cyan-950/40",
                      isCompleted && "border-emerald-200 bg-emerald-50",
                      !isActive && !isCompleted && "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg border text-xs",
                          isActive && "border-cyan-200 bg-white text-cyan-700",
                          isCompleted && "border-emerald-200 bg-white text-emerald-700",
                          !isActive && !isCompleted && "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-slate-500 dark:text-slate-400",
                        )}
                      >
                        {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.icon}
                      </div>
                      <span className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-300">{step.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 p-4 md:p-5">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-950 dark:text-slate-100">{WIZARD_STEPS[currentStep].title}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{WIZARD_STEPS[currentStep].description}</p>
              </div>
              {renderStepContent()}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="rounded-xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Geri
              </Button>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveDraft}
                  className="rounded-xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Taslak Kaydet
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetWizard}
                  className="rounded-xl border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200 hover:bg-red-100"
                >
                  <X className="mr-2 h-4 w-4" />
                  Taslağı Temizle
                </Button>
                {currentStep < WIZARD_STEPS.length - 1 ? (
                  <Button type="button" onClick={handleNext} className="rounded-xl bg-cyan-600 text-white hover:bg-cyan-700">
                    Devam Et
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="hidden space-y-4">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 rounded-[28px] shadow-2xl p-5">
            <p className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">Özet</p>
            <div className="mt-4 space-y-3">
              {[
                ["Firma Ünvanı", companyInfo.companyTitle || "Belirtilmedi"],
                ["Risk Yöntemi", companyInfo.riskMethod || "Belirtilmedi"],
                ["Risk Madde Sayısı", String(previewRiskItems.length)],
                ["Faaliyet Sayısı", String(previewActions.length)],
                ["İmza Satırı", String(previewSignatureRows.length)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 p-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">{label}</p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 rounded-[28px] shadow-2xl p-5">
            <p className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">Rapor Çıktılari</p>
            <div className="mt-4 space-y-3">
              <Button
                type="button"
                onClick={handleSaveDraft}
                variant="outline"
                className="w-full rounded-xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:bg-slate-900"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Taslak Kaydet
              </Button>
              <Button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="w-full rounded-xl bg-violet-600 text-white hover:bg-violet-700"
              >
                {exportingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Risk Değerlendirme Raporu Oluştur
              </Button>
              <Button
                type="button"
                onClick={handleWordDownload}
                disabled={!wordTemplateAvailable || checkingTemplate || exportingWord}
                variant="outline"
                className="w-full rounded-xl border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-60"
              >
                <FileDown className="mr-2 h-4 w-4" />
                Word Olarak Indir
              </Button>
              <Button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                variant="outline"
                className="w-full rounded-xl border-cyan-500/20 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
              >
                <Download className="mr-2 h-4 w-4" />
                PDF Indir
              </Button>
            </div>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 rounded-[28px] shadow-2xl p-5">
            <p className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">Bilgilendirme</p>
            <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-400">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4">
                <p className="font-bold text-slate-700 dark:text-slate-200">Boş Not Alanı Gizlenir</p>
                <p className="mt-1">Not boş bırakılırsa kapakta “Not:” etiketi ve ilgili boşluk hiç oluşturulmaz.</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4">
                <p className="font-bold text-slate-700 dark:text-slate-200">Dinamik Tablo Satirlari</p>
                <p className="mt-1">
                  Risk tablosu ve faaliyet plani, yalnizca eklediginiz satirlar kadar üretilir; boş satir basilmaz.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4">
                <p className="font-bold text-slate-700 dark:text-slate-200">Word Şablonu</p>
                <p className="mt-1">
                  DOCX sablonu bulundugunda resmi Word çıktısi ayni veri setiyle indirilebilir. PDF çıktısi resmi bölüm sirasina göre çalismaya devam eder.

                </p>
              </div>
              <div className="inline-flex items-start gap-2 rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-3 text-cyan-200">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Kayitli risk maddeleri yalnizca mevcut bir risk değerlendirmesi üzerinden açildiginda aktarilabilir.</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
      </div>

      <Dialog open={riskTemplateDialogOpen} onOpenChange={setRiskTemplateDialogOpen}>
        <DialogContent className="max-w-3xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle>Risk Sablonlari</DialogTitle>
            <DialogDescription className="text-slate-400">
              Kayitli risk sablonlarindan birini tek tikla Risk Değerlendirme Tablosu’na aktarin.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {!profile?.organization_id ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-6 text-sm text-slate-400">
                Risk sablonlarini kullanmak için organizasyon bilgisi bulunmalidir.
              </div>
            ) : loadingRiskTemplates ? (
              <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-6 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sablonlar yükleniyor...
                </div>
              </div>
            ) : riskTemplates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-6 text-sm text-slate-400">
                Kayitli risk sablonu bulunamadi.
              </div>
            ) : (
              riskTemplates.map((template) => {
                const itemCount = Array.isArray(template.payload?.items) ? template.payload.items.length : 0;
                return (
                  <div key={template.id} className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{template.name}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                          {template.sector ? (
                            <Badge className="rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
                              {template.sector}
                            </Badge>
                          ) : null}
                          <Badge className="rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
                            {template.method || "Yöntem belirtilmedi"}
                          </Badge>
                          <Badge className="rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                            {itemCount} risk maddesi
                          </Badge>
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={() => applyRiskTemplateToWizard(template)}
                        className="rounded-xl bg-amber-500 text-slate-950 dark:text-slate-100 hover:bg-amber-400"
                      >
                        Tabloya Ekle
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
