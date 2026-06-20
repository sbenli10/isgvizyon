import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { usePersistentFormDraft } from "@/hooks/usePersistentFormDraft";
import { supabase } from "@/integrations/supabase/client";
import {
  MANUAL_RISK_LIBRARY,
  type ManualRiskLibraryItem,
} from "@/lib/risk/manualRiskLibrary";
import { generateSectorRiskTemplates } from "@/lib/risk/sectorRiskTemplates";
import {
  getSectorMinimumRiskItemCount,
  RISK_TEMPLATE_CONFIGS,
} from "@/lib/risk/riskTemplateConfig";
import { listSavedRiskItems, type SavedRiskItem } from "@/lib/profileRisks";
import {
  calculateRiskValidityDate,
  generateRiskAnalysisTemplateDocx,
  generateRiskAnalysisTemplatePdf,
  type RiskTemplateExportPayload,
  type RiskTemplateEmergencyInfo,
} from "@/lib/riskTemplateExport";
import {
  generateRiskProcedureTemplateDoc,
  type RiskProcedureTemplatePayload,
} from "@/lib/riskProcedureTemplateExport";
import {
  generateRisksWithGemini,
  type GeminiRiskResult,
} from "@/services/geminiService";
import type { RiskItem } from "@/types/risk-assessment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type HazardClass = "Az Tehlikeli" | "Tehlikeli" | "Çok Tehlikeli" | "";
type RiskMethod = "5x5 Matris" | "Fine-Kinney" | "L Tipi Matris" | "Diger";

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
  validUntil: string;
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
  frequency: string;
  severity: string;
  riskScore: string;
  riskLevel: string;
  additionalMeasures: string;
  postProbability: string;
  postFrequency: string;
  postSeverity: string;
  postRiskScore: string;
  postRiskLevel: string;
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
  emergencyTeamInfo?: RiskTemplateEmergencyInfo | null;
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
  icon: ReactNode;
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
    label: "Firma",
    title: "Firma ve Rapor Bilgileri",
    description:
      "Firma profilini seçin; kapak, yöntem, tarih ve faaliyet bilgilerini kontrol edin.",
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    id: "risk-method",
    label: "Risk Kaynagi",
    title: "Risk Ekleme Yöntemi",
    description:
      "Riskleri AI, kütüphane, sablon veya kayitli degerlendirmeler üzerinden ekleyin.",
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    id: "risk-table",
    label: "Risk Tablosu",
    title: "Risk Degerlendirme Tablosu",
    description:
      "Eklenen riskleri, puanlari, önlemleri, sorumlulari ve terminleri düzenleyin.",
    icon: <AlertTriangle className="h-5 w-5" />,
  },
  {
    id: "preview",
    label: "Rapor",
    title: "Kontrol ve Rapor Olusturma",
    description:
      "Özeti kontrol edin; taslagi saklayin ve Word/PDF çıktısını olusturun.",
    icon: <Eye className="h-5 w-5" />,
  },
];

const RISK_TABLE_STEP_INDEX = WIZARD_STEPS.findIndex(
  (step) => step.id === "risk-table",
);

const REQUIRED_COMPANY_FIELDS: Array<keyof RiskWizardCompanyInfo> = [];

const emptyCompanyInfo = (): RiskWizardCompanyInfo => ({
  companyTitle: "",
  address: "",
  email: "",
  workplaceRegistryNo: "",
  hazardClass: "",
  employeeCount: "",
  assessmentDate: today,
  validUntil: "",
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
  "Risk puani = Olasilik x Siddet. Risk düzeyleri: 1-4 Düşük, 5-9 Orta, 10-15 Yüksek, 16-25 Çok Yüksek olarak kabul edilmistir. Kontrol tedbirlerinde öncelik sirasi; tehlikeyi ortadan kaldirma, ikame, mühendislik kontrolü, idari kontrol ve kisisel koruyucu donanim seklindedir.";

const emptyScopeInfo = (): RiskWizardScopeInfo => ({
  evaluatedSections: "",
  assessmentScopeItems: [""],
});

const emptyConclusionInfo = (): RiskWizardConclusionInfo => ({
  generalConclusion:
    "Bu risk degerlendirmesi, isyerinde beyan edilen faaliyet kapsami ve mevcut çalışma kosullari dikkate alinarak hazirlanmistir. Belirlenen ilave tedbirlerin uygulanmasi ve tamamlanan faaliyetler sonrasi risk seviyelerinin yeniden degerlendirilmesi önerilir.",
  conclusionItems: [
    "Bu risk degerlendirmesi, isyerinde beyan edilen faaliyet kapsami ve mevcut çalışma kosullari dikkate alinarak hazirlanmistir.",
    "Belirlenen ilave tedbirlerin uygulanmasi ve tamamlanan faaliyetler sonrasi risk seviyelerinin yeniden degerlendirilmesi önerilir.",
    "Risk degerlendirmesi, isyerinde Önemli degisiklik olmasi veya mevzuat geregi yenilenmesi gereken durumlarda güncellenmelidir.",
  ],
  approvalNote: "",
  preparedBy: "",
  approvedBy: "",
  signatureDate: today,
});

const cleanText = (value?: string | null) =>
  (value || "").replace(/\s+/g, " ").trim();
const cleanUnknown = (value: unknown) =>
  typeof value === "string" || typeof value === "number"
    ? cleanText(String(value))
    : "";
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
  Boolean(
    cleanText(person?.fullName) ||
    cleanText(person?.tcNo) ||
    cleanText(person?.phone) ||
    cleanText(person?.certificateNo),
  );

const hasOsgbData = (osgb?: RiskTeamOsgb | null) =>
  Boolean(
    cleanText(osgb?.title) ||
    cleanText(osgb?.authorizedPerson) ||
    cleanText(osgb?.phone) ||
    cleanText(osgb?.email) ||
    cleanText(osgb?.address),
  );

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
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(
    parsed,
  );
};

const createId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

const readEmergencyPerson = (value: unknown) => {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    fullName: cleanText(String(source.full_name || source.fullName || "")),
    tcNo: cleanText(String(source.tc_no || source.tcNo || "")),
  };
};

const normalizeEmergencyTeamInfo = (
  value: unknown,
): RiskTemplateEmergencyInfo | null => {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  return {
    allUnitsContact: readEmergencyPerson(source.all_units_contact),
    fireChief: readEmergencyPerson(source.fire_chief),
    rescueChief: readEmergencyPerson(source.rescue_chief),
    protectionChief: readEmergencyPerson(source.protection_chief),
    firstAidChief: readEmergencyPerson(source.first_aid_chief),
  };
};

const normalizeTeamInfo = (
  value?: Partial<RiskWizardTeamInfo> | null,
): RiskWizardTeamInfo => ({
  employer: normalizeLegacyTeamPerson(value?.employer),
  employeeRepresentative: normalizeLegacyTeamPerson(
    value?.employeeRepresentative,
  ),
  safetyExpert: normalizeLegacyTeamPerson(value?.safetyExpert),
  workplaceDoctor: normalizeLegacyTeamPerson(value?.workplaceDoctor),
  osgb: normalizeLegacyOsgb(value?.osgb),
});

const assignmentMatchesRole = (
  assignment: CompanyAssignmentForRisk,
  needles: string[],
) => {
  const haystack = cleanText(
    [assignment.role_type, assignment.notes].filter(Boolean).join(" "),
  ).toLocaleLowerCase("tr-TR");
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
      byCompany.set(assignment.company_id, [
        ...(byCompany.get(assignment.company_id) || []),
        assignment,
      ]);
    });

  return companies.map((company) => {
    const companyAssignments = byCompany.get(company.id) || [];
    const employer = companyAssignments.find((assignment) =>
      assignmentMatchesRole(assignment, [
        "isveren",
        "isveren",
        "vekil",
        "employer",
      ]),
    );
    const employeeRepresentative = companyAssignments.find((assignment) =>
      assignmentMatchesRole(assignment, [
        "çalışan temsilcisi",
        "çalışan temsilcisi",
        "employee",
      ]),
    );
    const safetyExpert = companyAssignments.find((assignment) =>
      assignmentMatchesRole(assignment, [
        "is güvenliği",
        "isg",
        "igu",
        "uzman",
        "safety",
      ]),
    );
    const workplaceDoctor = companyAssignments.find((assignment) =>
      assignmentMatchesRole(assignment, ["hekim", "doctor", "physician"]),
    );

    return {
      ...company,
      employerRepresentativeName:
        company.employerRepresentativeName || employer?.person_name || null,
      employerRepresentativePhone:
        company.employerRepresentativePhone || employer?.phone || null,
      employeeRepresentativeName:
        company.employeeRepresentativeName ||
        employeeRepresentative?.person_name ||
        null,
      employeeRepresentativePhone:
        company.employeeRepresentativePhone ||
        employeeRepresentative?.phone ||
        null,
      occupationalSafetySpecialistName:
        company.occupationalSafetySpecialistName ||
        safetyExpert?.person_name ||
        null,
      occupationalSafetySpecialistPhone:
        company.occupationalSafetySpecialistPhone ||
        safetyExpert?.phone ||
        null,
      occupationalSafetySpecialistCertificateNo:
        company.occupationalSafetySpecialistCertificateNo ||
        safetyExpert?.certificate_no ||
        null,
      workplaceDoctorName:
        company.workplaceDoctorName || workplaceDoctor?.person_name || null,
      workplaceDoctorPhone:
        company.workplaceDoctorPhone || workplaceDoctor?.phone || null,
      workplaceDoctorCertificateNo:
        company.workplaceDoctorCertificateNo ||
        workplaceDoctor?.certificate_no ||
        null,
    };
  });
};

const buildCompanyInfoFromProfile = (
  company: WizardCompanyOption,
): RiskWizardCompanyInfo => {
  const hazardClass = ["Az Tehlikeli", "Tehlikeli", "Çok Tehlikeli"].includes(
    cleanText(company.hazardClass),
  )
    ? (cleanText(company.hazardClass) as HazardClass)
    : "";

  return {
    ...emptyCompanyInfo(),
    companyTitle: cleanText(company.name),
    address: cleanText(company.address),
    email: cleanText(company.email),
    workplaceRegistryNo: cleanText(company.sgkNumber),
    hazardClass,
    employeeCount:
      company.employeeCount != null ? String(company.employeeCount) : "",
    validUntil: calculateRiskValidityDate(today, hazardClass),
    activityScope: cleanText(company.activityScope),
  };
};

const buildTeamInfoFromProfile = (
  company: WizardCompanyOption,
): RiskWizardTeamInfo => ({
  employer: {
    fullName: cleanText(company.employerRepresentativeName),
    tcNo: cleanText(company.employerRepresentativeTcNo),
    phone: cleanText(company.employerRepresentativePhone),
    title:
      cleanText(company.employerRepresentativeTitle) ||
      "Isveren / Isveren Vekili",
  },
  employeeRepresentative: {
    fullName: cleanText(company.employeeRepresentativeName),
    tcNo: cleanText(company.employeeRepresentativeTcNo),
    phone: cleanText(company.employeeRepresentativePhone),
    title:
      cleanText(company.employeeRepresentativeTitle) || "Çalışan Temsilcisi",
  },
  safetyExpert: {
    fullName: cleanText(company.occupationalSafetySpecialistName),
    tcNo: cleanText(company.occupationalSafetySpecialistTcNo),
    phone: cleanText(company.occupationalSafetySpecialistPhone),
    certificateNo: cleanText(company.occupationalSafetySpecialistCertificateNo),
    certificateClass: cleanText(
      company.occupationalSafetySpecialistCertificateClass,
    ),
    title: "Is Güvenliği Uzmani",
  },
  workplaceDoctor: {
    fullName: cleanText(company.workplaceDoctorName),
    tcNo: cleanText(company.workplaceDoctorTcNo),
    phone: cleanText(company.workplaceDoctorPhone),
    certificateNo: cleanText(company.workplaceDoctorCertificateNo),
    title: "Isyeri Hekimi",
  },
  osgb: {
    title: cleanText(company.osgbTitle),
    authorizedPerson: cleanText(company.osgbAuthorizedPerson),
    phone: cleanText(company.osgbPhone),
    email: cleanText(company.osgbEmail),
    address: cleanText(company.osgbAddress),
  },
});

const mergeCompanyInfoFallback = (
  current: RiskWizardCompanyInfo,
  fallback: RiskWizardCompanyInfo,
): RiskWizardCompanyInfo => ({
  companyTitle: current.companyTitle || fallback.companyTitle,
  address: current.address || fallback.address,
  email: current.email || fallback.email,
  workplaceRegistryNo:
    current.workplaceRegistryNo || fallback.workplaceRegistryNo,
  hazardClass: current.hazardClass || fallback.hazardClass,
  employeeCount: current.employeeCount || fallback.employeeCount,
  assessmentDate: current.assessmentDate || fallback.assessmentDate || today,
  validUntil: current.validUntil || fallback.validUntil,
  riskMethod: current.riskMethod || fallback.riskMethod,
  activityScope: current.activityScope || fallback.activityScope,
  note: current.note || fallback.note,
});

const mergePersonFallback = (
  current: RiskTeamPerson,
  fallback: RiskTeamPerson,
): RiskTeamPerson => ({
  fullName: current.fullName || fallback.fullName,
  tcNo: current.tcNo || fallback.tcNo,
  phone: current.phone || fallback.phone,
  title: current.title || fallback.title,
  certificateNo: current.certificateNo || fallback.certificateNo,
  certificateClass: current.certificateClass || fallback.certificateClass,
});

const mergeTeamInfoFallback = (
  current: RiskWizardTeamInfo,
  fallback: RiskWizardTeamInfo,
): RiskWizardTeamInfo => ({
  employer: mergePersonFallback(current.employer, fallback.employer),
  employeeRepresentative: mergePersonFallback(
    current.employeeRepresentative,
    fallback.employeeRepresentative,
  ),
  safetyExpert: mergePersonFallback(
    current.safetyExpert,
    fallback.safetyExpert,
  ),
  workplaceDoctor: mergePersonFallback(
    current.workplaceDoctor,
    fallback.workplaceDoctor,
  ),
  osgb: {
    title: current.osgb.title || fallback.osgb.title,
    phone: current.osgb.phone || fallback.osgb.phone,
    email: current.osgb.email || fallback.osgb.email,
    authorizedPerson:
      current.osgb.authorizedPerson || fallback.osgb.authorizedPerson,
    address: current.osgb.address || fallback.osgb.address,
  },
});

const createEmptyRiskItem = (no: number): RiskWizardTableItem => ({
  id: createId("risk"),
  no,
  departmentActivity: "",
  hazardSource: "",
  riskConsequence: "",
  affectedPeople: "",
  currentMeasure: "",
  probability: "",
  frequency: "",
  severity: "",
  riskScore: "",
  riskLevel: "",
  additionalMeasures: "",
  postProbability: "",
  postFrequency: "",
  postSeverity: "",
  postRiskScore: "",
  postRiskLevel: "",
  responsible: "",
  deadline: "",
});

const normalizeFineKinneyValue = (value: unknown, fallback = 3) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return fallback;
  return numericValue;
};

const formatRiskNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

const getFineKinneyRiskLevelFromScore = (score: number) => {
  if (score > 400) return "Çok Yüksek";
  if (score >= 200) return "Yüksek";
  if (score >= 70) return "Önemli";
  if (score >= 20) return "Olasi";
  if (score > 0) return "Kabul Edilebilir";
  return "";
};

const inferFrequencyFromScore = (
  probability?: string | number | null,
  severity?: string | number | null,
  score?: string | number | null,
) => {
  const probabilityValue = Number(probability || 0);
  const severityValue = Number(severity || 0);
  const scoreValue = Number(score || 0);
  if (!probabilityValue || !severityValue || !scoreValue) return "";
  return formatRiskNumber(scoreValue / (probabilityValue * severityValue));
};

const createRiskRowFromGeneratedRisk = (
  item:
    | GeminiRiskResult
    | ReturnType<typeof generateSectorRiskTemplates>[number],
  index: number,
  sourcePrefix: string,
): RiskWizardTableItem => {
  const probability = normalizeFineKinneyValue(
    "probability" in item ? item.probability : item.o,
  );
  const frequency = normalizeFineKinneyValue(
    "frequency" in item ? item.frequency : item.f,
    1,
  );
  const severity = normalizeFineKinneyValue(
    "severity" in item ? item.severity : item.s,
  );
  const riskScore = probability * frequency * severity;
  const controls = Array.isArray(item.controls)
    ? item.controls.filter(Boolean)
    : [];
  const postProbability = 0.2;
  const postFrequency = 1;
  const postSeverity = Math.min(3, severity);
  const postRiskScore = postProbability * postFrequency * postSeverity;

  return {
    id: createId(sourcePrefix),
    no: index + 1,
    departmentActivity: cleanText(item.category),
    hazardSource: cleanText(item.hazard),
    riskConsequence: cleanText(item.risk),
    affectedPeople: "Çalışanlar, ziyaretçiler ve ilgili üçüncü kisiler",
    currentMeasure: "Mevcut durum saha kontrolünde degerlendirilecektir.",
    probability: formatRiskNumber(probability),
    frequency: formatRiskNumber(frequency),
    severity: formatRiskNumber(severity),
    riskScore: formatRiskNumber(riskScore),
    riskLevel: getFineKinneyRiskLevelFromScore(riskScore),
    additionalMeasures: cleanText(controls.join("\n")),
    postProbability: formatRiskNumber(postProbability),
    postFrequency: formatRiskNumber(postFrequency),
    postSeverity: formatRiskNumber(postSeverity),
    postRiskScore: formatRiskNumber(postRiskScore),
    postRiskLevel: getFineKinneyRiskLevelFromScore(postRiskScore),
    responsible: "Isveren",
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

const buildSignatureRowsFromTeam = (
  teamInfo: RiskWizardTeamInfo,
): SignatureRow[] => {
  const rows: SignatureRow[] = [
    {
      id: createId("signature"),
      fullName: cleanText(teamInfo.employer.fullName),
      role: "Isveren",
      documentOrContact: cleanText(
        teamInfo.employer.phone || teamInfo.employer.tcNo,
      ),
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
      role: "Is Güvenliği Uzmani",
      documentOrContact: cleanText(
        [
          teamInfo.safetyExpert.certificateNo
            ? `Sertifika No: ${teamInfo.safetyExpert.certificateNo}`
            : "",
          teamInfo.safetyExpert.phone
            ? `Tel: ${teamInfo.safetyExpert.phone}`
            : "",
        ]
          .filter(Boolean)
          .join(" / "),
      ),
    },
    {
      id: createId("signature"),
      fullName: cleanText(teamInfo.workplaceDoctor.fullName),
      role: "Isyeri Hekimi",
      documentOrContact: cleanText(
        [
          teamInfo.workplaceDoctor.certificateNo
            ? `Sertifika No: ${teamInfo.workplaceDoctor.certificateNo}`
            : "",
          teamInfo.workplaceDoctor.phone
            ? `Tel: ${teamInfo.workplaceDoctor.phone}`
            : "",
        ]
          .filter(Boolean)
          .join(" / "),
      ),
    },
    {
      id: createId("signature"),
      fullName: cleanText(
        teamInfo.osgb.authorizedPerson || teamInfo.osgb.title,
      ),
      role: "OSGB",
      documentOrContact: cleanText(
        [teamInfo.osgb.email, teamInfo.osgb.phone].filter(Boolean).join(" / "),
      ),
    },
  ];
  return rows.filter((row) => cleanText(row.fullName) || cleanText(row.role));
};

const mapEditorRiskItemToWizardRow = (
  item: RiskItem,
  index: number,
): RiskWizardTableItem => ({
  id: item.id || createId("risk"),
  no: index + 1,
  departmentActivity: cleanText(item.department),
  hazardSource: cleanText(item.hazard),
  riskConsequence: cleanText(item.risk),
  affectedPeople: cleanText(item.affected_people),
  currentMeasure: cleanText(item.existing_controls),
  probability: item.probability_1 ? String(item.probability_1) : "",
  frequency: item.frequency_1 ? String(item.frequency_1) : "",
  severity: item.severity_1 ? String(item.severity_1) : "",
  riskScore: item.score_1 ? String(item.score_1) : "",
  riskLevel: cleanText(item.risk_class_1),
  additionalMeasures: cleanText(item.proposed_controls),
  postProbability: item.probability_2 ? String(item.probability_2) : "",
  postFrequency: item.frequency_2 ? String(item.frequency_2) : "",
  postSeverity: item.severity_2 ? String(item.severity_2) : "",
  postRiskScore: item.score_2 ? String(item.score_2) : "",
  postRiskLevel: cleanText(item.risk_class_2),
  responsible: cleanText(item.responsible_person),
  deadline: item.deadline || "",
});

const mapSavedRiskItemToWizardRow = (
  item: SavedRiskItem,
  index: number,
): RiskWizardTableItem => ({
  id: createId("saved-risk"),
  no: index + 1,
  departmentActivity: cleanText(item.activity),
  hazardSource: cleanText(item.hazard),
  riskConsequence: cleanText(item.risk),
  affectedPeople: "Çalışanlar",
  currentMeasure: cleanText(item.currentStatus || item.riskDefinitionBefore),
  probability: item.probabilityBefore ? String(item.probabilityBefore) : "",
  frequency: item.frequencyBefore ? String(item.frequencyBefore) : "1",
  severity: item.severityBefore ? String(item.severityBefore) : "",
  riskScore: item.riskScoreBefore ? String(item.riskScoreBefore) : "",
  riskLevel: getFineKinneyRiskLevelFromScore(Number(item.riskScoreBefore || 0)),
  additionalMeasures: cleanText(item.correctivePreventiveAction),
  postProbability: item.probabilityAfter
    ? String(item.probabilityAfter)
    : "0.2",
  postFrequency: item.frequencyAfter ? String(item.frequencyAfter) : "1",
  postSeverity: item.severityAfter ? String(item.severityAfter) : "1",
  postRiskScore: item.riskScoreAfter ? String(item.riskScoreAfter) : "",
  postRiskLevel: getFineKinneyRiskLevelFromScore(
    Number(item.riskScoreAfter || 0),
  ),
  responsible: cleanText(item.responsible),
  deadline: item.deadline || "",
});

const mapTemplateRiskItemToWizardRow = (
  item: Record<string, unknown>,
  index: number,
): RiskWizardTableItem => ({
  id: createId("risk-template"),
  no: index + 1,
  departmentActivity: cleanText(
    String(item.department || item.activity || item.area || ""),
  ),
  hazardSource: cleanText(String(item.hazardSource || item.hazard || "")),
  riskConsequence: cleanText(String(item.risk || item.consequence || "")),
  affectedPeople: cleanText(
    String(item.affectedPeople || item.affected_people || ""),
  ),
  currentMeasure: cleanText(
    String(
      item.existingControl ||
        item.currentMeasure ||
        item.existing_controls ||
        "",
    ),
  ),
  probability: item.probability
    ? String(item.probability)
    : item.probability_1
      ? String(item.probability_1)
      : "",
  frequency: item.frequency
    ? String(item.frequency)
    : item.frequency_1
      ? String(item.frequency_1)
      : "1",
  severity: item.severity
    ? String(item.severity)
    : item.severity_1
      ? String(item.severity_1)
      : "",
  riskScore: item.riskScore
    ? String(item.riskScore)
    : item.score_1
      ? String(item.score_1)
      : "",
  riskLevel: cleanText(String(item.riskLevel || item.risk_class_1 || "")),
  additionalMeasures: cleanText(
    String(
      item.additionalMeasures || item.actions || item.proposed_controls || "",
    ),
  ),
  postProbability: cleanText(
    String(item.postProbability || item.probability_2 || "0.2"),
  ),
  postFrequency: cleanText(
    String(item.postFrequency || item.frequency_2 || "1"),
  ),
  postSeverity: cleanText(String(item.postSeverity || item.severity_2 || "1")),
  postRiskScore: cleanText(String(item.postRiskScore || item.score_2 || "")),
  postRiskLevel: cleanText(
    String(item.postRiskLevel || item.risk_class_2 || ""),
  ),
  responsible: cleanText(
    String(item.responsible || item.responsible_person || ""),
  ),
  deadline: cleanText(String(item.deadline || "")),
});

const mapManualLibraryItemToWizardRow = (
  item: ManualRiskLibraryItem,
  index: number,
): RiskWizardTableItem => ({
  id: createId("risk-library"),
  no: index + 1,
  departmentActivity: cleanText(item.departmentActivity || item.category),
  hazardSource: cleanText(item.hazardSource),
  riskConsequence: cleanText(item.riskConsequence),
  affectedPeople: cleanText(item.affectedPeople || "Çalışanlar"),
  currentMeasure: cleanText(item.currentMeasure),
  probability: cleanText(item.probability),
  frequency:
    inferFrequencyFromScore(item.probability, item.severity, item.riskScore) ||
    "1",
  severity: cleanText(item.severity),
  riskScore: cleanText(item.riskScore),
  riskLevel: cleanText(item.riskLevel),
  additionalMeasures: cleanText(item.additionalMeasures),
  postProbability: cleanText(item.residualProbability || "0.2"),
  postFrequency:
    inferFrequencyFromScore(
      item.residualProbability,
      item.residualSeverity,
      item.residualRiskScore,
    ) || "1",
  postSeverity: cleanText(item.residualSeverity || "1"),
  postRiskScore: cleanText(item.residualRiskScore || ""),
  postRiskLevel: cleanText(item.residualRiskLevel || "Kabul Edilebilir"),
  responsible: cleanText(item.responsible),
  deadline: cleanText(item.deadline),
});

const buildRiskItemsSummary = (items: RiskWizardTableItem[]) =>
  items.map((item, index) => {
    const frequency = cleanText(item.frequency) || "1";
    const hasInitialScoreInputs = Boolean(
      cleanText(item.probability) &&
      cleanText(frequency) &&
      cleanText(item.severity),
    );
    const riskScore =
      cleanText(item.riskScore) ||
      (hasInitialScoreInputs
        ? formatRiskNumber(
            asInt(item.probability) * asInt(frequency) * asInt(item.severity),
          )
        : "");

    const postProbability = cleanText(item.postProbability) || "0.2";
    const postFrequency = cleanText(item.postFrequency) || "1";
    const postSeverity = cleanText(item.postSeverity) || "1";
    const hasPostScoreInputs = Boolean(
      cleanText(postProbability) &&
      cleanText(postFrequency) &&
      cleanText(postSeverity),
    );
    const postRiskScore =
      cleanText(item.postRiskScore) ||
      (hasPostScoreInputs
        ? formatRiskNumber(
            asInt(postProbability) * asInt(postFrequency) * asInt(postSeverity),
          )
        : "");

    return {
      ...item,
      no: index + 1,
      frequency,
      riskScore,
      riskLevel:
        cleanText(item.riskLevel) ||
        getFineKinneyRiskLevelFromScore(asInt(riskScore)),
      additionalMeasures:
        cleanText(item.additionalMeasures) ||
        "Planlanan düzeltici/önleyici faaliyet uygulanacaktir.",
      postProbability,
      postFrequency,
      postSeverity,
      postRiskScore,
      postRiskLevel:
        cleanText(item.postRiskLevel) ||
        getFineKinneyRiskLevelFromScore(asInt(postRiskScore)),
      responsible: cleanText(item.responsible) || "Isveren",
      deadline: cleanText(item.deadline),
    };
  });

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

export default function RiskAssessmentWizard() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const locationState = location.state as {
    assessmentId?: string | null;
    companyId?: string | null;
  } | null;
  const importAssessmentId = locationState?.assessmentId || null;

  const [currentStep, setCurrentStep] = useState(0);
  const [companies, setCompanies] = useState<WizardCompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    locationState?.companyId || "",
  );
  const [companyInfo, setCompanyInfo] =
    useState<RiskWizardCompanyInfo>(emptyCompanyInfo);
  const [teamInfo, setTeamInfo] = useState<RiskWizardTeamInfo>(emptyTeamInfo);
  const [scopeInfo, setScopeInfo] =
    useState<RiskWizardScopeInfo>(emptyScopeInfo);
  const [riskItems, setRiskItems] = useState<RiskWizardTableItem[]>([]);
  const [correctiveActions, setCorrectiveActions] = useState<
    CorrectivePreventiveAction[]
  >([]);
  const [conclusionInfo, setConclusionInfo] =
    useState<RiskWizardConclusionInfo>(emptyConclusionInfo);
  const [signatureRows, setSignatureRows] = useState<SignatureRow[]>([]);
  const [logo, setLogo] = useState<RiskAssessmentLogo>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [wordTemplateAvailable, setWordTemplateAvailable] = useState(false);
  const [checkingTemplate, setCheckingTemplate] = useState(true);
  const [importingRiskItems, setImportingRiskItems] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingProcedureWord, setExportingProcedureWord] = useState(false);
  const [riskTemplateDialogOpen, setRiskTemplateDialogOpen] = useState(false);
  const [riskTemplates, setRiskTemplates] = useState<
    RiskAssessmentTemplateRecord[]
  >([]);
  const [loadingRiskTemplates, setLoadingRiskTemplates] = useState(false);
  const [riskAdditionMethod, setRiskAdditionMethod] =
    useState<RiskAdditionMethod | null>(null);
  const [aiSector, setAiSector] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [aiRiskCount, setAiRiskCount] = useState("40");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [manualRiskSearch, setManualRiskSearch] = useState("");
  const [expandedManualCategories, setExpandedManualCategories] = useState<
    Record<string, boolean>
  >({});

  const draftContextKey = useMemo(
    () =>
      `${location.pathname}:${locationState?.assessmentId || locationState?.companyId || "general"}`,
    [location.pathname, locationState?.assessmentId, locationState?.companyId],
  );

  const { clearDraft } = usePersistentFormDraft<RiskAssessmentWizardDraft>({
    formId: `risk-assessment-wizard-v3:${draftContextKey}`,
    enabled: true,
    version: 3,
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
      setCurrentStep(
        Math.min(Math.max(draft.currentStep || 0, 0), WIZARD_STEPS.length - 1),
      );
      setSelectedCompanyId(
        draft.selectedCompanyId || locationState?.companyId || "",
      );
      setCompanyInfo({ ...emptyCompanyInfo(), ...(draft.companyInfo || {}) });
      setTeamInfo(normalizeTeamInfo(draft.teamInfo || {}));
      const restoredScope = { ...emptyScopeInfo(), ...(draft.scopeInfo || {}) };
      setScopeInfo({
        evaluatedSections: cleanText(restoredScope.evaluatedSections),
        assessmentScopeItems:
          Array.isArray(restoredScope.assessmentScopeItems) &&
          restoredScope.assessmentScopeItems.length > 0
            ? restoredScope.assessmentScopeItems
            : splitTextToItems(
                (draft.scopeInfo as { scopeText?: string } | undefined)
                  ?.scopeText,
              ),
      });
      setRiskItems(Array.isArray(draft.riskItems) ? draft.riskItems : []);
      setCorrectiveActions(
        Array.isArray(draft.correctiveActions) ? draft.correctiveActions : [],
      );
      const restoredConclusion = {
        ...emptyConclusionInfo(),
        ...(draft.conclusionInfo || {}),
      };
      setConclusionInfo({
        ...restoredConclusion,
        conclusionItems:
          Array.isArray(restoredConclusion.conclusionItems) &&
          restoredConclusion.conclusionItems.length > 0
            ? restoredConclusion.conclusionItems
            : splitTextToItems(restoredConclusion.generalConclusion),
      });
      setSignatureRows(
        Array.isArray(draft.signatureRows) ? draft.signatureRows : [],
      );
      setLogo(draft.logo || null);
      setRiskAdditionMethod(draft.riskAdditionMethod || null);
    },
    debugLabel: "RiskAssessmentWizardV3",
  });

  useEffect(() => {
    let active = true;
    const checkTemplate = async () => {
      try {
        const headResponse = await fetch(
          "/templates/risk-analizi-sablonu.docx",
          { method: "HEAD" },
        );
        const response = headResponse.ok
          ? headResponse
          : await fetch(encodeURI("/templates/risk-analizi-sablonu.docx"), {
              method: "GET",
            });
        if (!active) return;
        const contentType = response.headers.get("content-type") || "";
        setWordTemplateAvailable(
          response.ok && !contentType.toLocaleLowerCase().includes("text/html"),
        );
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
        const companyIds = companyRows
          .map((row) => String(row.id))
          .filter(Boolean);
        let assignments: CompanyAssignmentForRisk[] = [];
        let organizationInfo: OrganizationForRisk | null = null;

        if (companyIds.length > 0) {
          const { data: assignmentRows, error: assignmentError } =
            await supabase
              .from("company_assignments")
              .select(
                "company_id, role_type, person_name, certificate_no, phone, email, notes, is_active",
              )
              .in("company_id", companyIds);

          if (assignmentError) {
            console.warn(
              "Risk wizard company assignment fetch warning",
              assignmentError,
            );
          } else {
            assignments = (assignmentRows || []) as CompanyAssignmentForRisk[];
          }
        }

        if (profile?.organization_id) {
          const { data: organizationRow, error: organizationError } =
            await supabase
              .from("organizations")
              .select("*")
              .eq("id", profile.organization_id)
              .maybeSingle();

          if (organizationError) {
            console.warn(
              "Risk wizard organization fetch warning",
              organizationError,
            );
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
          name: cleanText(
            String(row.name || row.company_name || "Isimsiz firma"),
          ),
          email: row.email ? String(row.email) : null,
          phone: row.phone ? String(row.phone) : null,
          address: row.address ? String(row.address) : null,
          sgkNumber:
            row.sgk_number ||
            row.sgk_workplace_number ||
            row.workplace_registration_number
              ? String(
                  row.sgk_number ||
                    row.sgk_workplace_number ||
                    row.workplace_registration_number,
                )
              : null,
          employeeCount: parseOptionalNumber(row.employee_count),
          hazardClass: row.hazard_class ? String(row.hazard_class) : null,
          activityScope:
            row.activity_scope ||
            row.sector ||
            row.industry_sector ||
            row.industry
              ? String(
                  row.activity_scope ||
                    row.sector ||
                    row.industry_sector ||
                    row.industry,
                )
              : null,
          employerRepresentativeName: row.employer_representative_name
            ? String(row.employer_representative_name)
            : null,
          employerRepresentativeTcNo: row.employer_representative_tc_no
            ? String(row.employer_representative_tc_no)
            : null,
          employerRepresentativePhone: row.employer_representative_phone
            ? String(row.employer_representative_phone)
            : null,
          employerRepresentativeTitle: row.employer_representative_title
            ? String(row.employer_representative_title)
            : null,
          occupationalSafetySpecialistName:
            row.occupational_safety_specialist_name
              ? String(row.occupational_safety_specialist_name)
              : null,
          occupationalSafetySpecialistTcNo:
            row.occupational_safety_specialist_tc_no
              ? String(row.occupational_safety_specialist_tc_no)
              : null,
          occupationalSafetySpecialistPhone:
            row.occupational_safety_specialist_phone
              ? String(row.occupational_safety_specialist_phone)
              : null,
          occupationalSafetySpecialistCertificateNo:
            row.occupational_safety_specialist_certificate_no
              ? String(row.occupational_safety_specialist_certificate_no)
              : null,
          occupationalSafetySpecialistCertificateClass:
            row.occupational_safety_specialist_certificate_class
              ? String(row.occupational_safety_specialist_certificate_class)
              : null,
          workplaceDoctorName: row.workplace_doctor_name
            ? String(row.workplace_doctor_name)
            : null,
          workplaceDoctorTcNo: row.workplace_doctor_tc_no
            ? String(row.workplace_doctor_tc_no)
            : null,
          workplaceDoctorPhone: row.workplace_doctor_phone
            ? String(row.workplace_doctor_phone)
            : null,
          workplaceDoctorCertificateNo: row.workplace_doctor_certificate_no
            ? String(row.workplace_doctor_certificate_no)
            : null,
          employeeRepresentativeName: row.employee_representative_name
            ? String(row.employee_representative_name)
            : null,
          employeeRepresentativeTcNo: row.employee_representative_tc_no
            ? String(row.employee_representative_tc_no)
            : null,
          employeeRepresentativePhone: row.employee_representative_phone
            ? String(row.employee_representative_phone)
            : null,
          employeeRepresentativeTitle: row.employee_representative_title
            ? String(row.employee_representative_title)
            : null,
          osgbTitle:
            pickFirstText(
              row.osgb_title,
              row.osgb_name,
              organizationOsgbTitle,
            ) || null,
          osgbAuthorizedPerson:
            pickFirstText(
              row.osgb_authorized_person,
              row.osgb_representative_name,
              organizationOsgbAuthorizedPerson,
            ) || null,
          osgbPhone:
            pickFirstText(
              row.osgb_phone,
              organizationInfo?.phone,
              profile?.phone,
            ) || null,
          osgbEmail:
            pickFirstText(
              row.osgb_email,
              organizationInfo?.email,
              profile?.email,
            ) || null,
          osgbAddress:
            pickFirstText(row.osgb_address, organizationInfo?.address) || null,
          emergencyTeamInfo: normalizeEmergencyTeamInfo(
            row.emergency_team_info,
          ),
        }));

        setCompanies(
          enrichCompaniesWithAssignments(mappedCompanies, assignments),
        );
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

  const previewRiskItems = useMemo(
    () => buildRiskItemsSummary(riskItems),
    [riskItems],
  );
  const previewActions = useMemo(
    () => buildCorrectiveActionsSummary(correctiveActions),
    [correctiveActions],
  );
  const previewSignatureRows = useMemo(
    () =>
      signatureRows.length > 0
        ? signatureRows
        : buildSignatureRowsFromTeam(teamInfo),
    [signatureRows, teamInfo],
  );
  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) || null,
    [companies, selectedCompanyId],
  );
  const selectedCompanyMissingTeamFields = useMemo(() => {
    if (!selectedCompany) return [];
    return [
      ["Isveren / Isveren Vekili", selectedCompany.employerRepresentativeName],
      ["Is Güvenliği Uzmani", selectedCompany.occupationalSafetySpecialistName],
      ["Isyeri Hekimi", selectedCompany.workplaceDoctorName],
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
      .sort((first, second) =>
        first.category.localeCompare(second.category, "tr-TR"),
      );
  }, [manualRiskSearch]);

  const progressRatio = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  const isStepValid = (
    _stepIndex: number,
  ): { valid: boolean; message?: string } => {
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
    toast.success("Risk degerlendirme taslagi temizlendi.");
  };

  const touchField = (key: string) =>
    setTouched((prev) => ({ ...prev, [key]: true }));

  const applyCompanyToWizard = (companyId: string) => {
    setSelectedCompanyId(companyId);
    const company = companies.find((item) => item.id === companyId);
    if (!company) return;

    setCompanyInfo((prev) => {
      const profileInfo = buildCompanyInfoFromProfile(company);
      const assessmentDate = prev.assessmentDate || today;
      return {
        ...profileInfo,
        assessmentDate,
        validUntil: calculateRiskValidityDate(
          assessmentDate,
          profileInfo.hazardClass,
        ),
        riskMethod: prev.riskMethod,
        note: prev.note,
      };
    });
    setTeamInfo(buildTeamInfoFromProfile(company));
    setSignatureRows([]);

    const missingFields = [
      ["Isveren / Isveren Vekili", company.employerRepresentativeName],
      ["Is Güvenliği Uzmani", company.occupationalSafetySpecialistName],
      ["Isyeri Hekimi", company.workplaceDoctorName],
      ["Çalışan Temsilcisi", company.employeeRepresentativeName],
    ].filter(([, value]) => !cleanText(String(value || "")));

    if (missingFields.length > 0) {
      toast.warning(
        "Firma bilgileri aktarildi; risk degerlendirme ekibinde eksik alanlar var.",
        {
          description: missingFields.map(([label]) => label).join(", "),
        },
      );
    } else {
      toast.success(
        "Firma ve risk degerlendirme ekibi bilgileri otomatik dolduruldu.",
      );
    }
  };

  useEffect(() => {
    if (!selectedCompany) return;

    const companyFallback = buildCompanyInfoFromProfile(selectedCompany);
    const teamFallback = buildTeamInfoFromProfile(selectedCompany);

    setCompanyInfo((current) =>
      mergeCompanyInfoFallback(current, companyFallback),
    );
    setTeamInfo((current) => mergeTeamInfoFallback(current, teamFallback));
  }, [selectedCompany]);

  const handleNext = () => {
    const validation = isStepValid(currentStep);
    if (!validation.valid) {
      REQUIRED_COMPANY_FIELDS.forEach((field) => touchField(String(field)));
      toast.error(
        validation.message ||
          "Bu adimda kontrol edilmesi gereken alanlar bulunuyor.",
      );
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const updateCompanyInfo = <K extends keyof RiskWizardCompanyInfo>(
    key: K,
    value: RiskWizardCompanyInfo[K],
  ) => {
    setCompanyInfo((prev) => {
      const next = { ...prev, [key]: value } as RiskWizardCompanyInfo;
      if (key === "hazardClass" || key === "assessmentDate") {
        next.validUntil = calculateRiskValidityDate(
          next.assessmentDate || today,
          next.hazardClass,
        );
      }
      return next;
    });
    touchField(String(key));
  };

  const updateTeamPerson = (
    key:
      | "employer"
      | "employeeRepresentative"
      | "safetyExpert"
      | "workplaceDoctor",
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

  const updateScopeInfo = <K extends keyof RiskWizardScopeInfo>(
    key: K,
    value: RiskWizardScopeInfo[K],
  ) => {
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
    const templates = generateSectorRiskTemplates(
      sector || "Genel Karma Risk Analizi",
    );
    const safeTemplates =
      templates.length > 0
        ? templates
        : generateSectorRiskTemplates("Genel Karma Risk Analizi");
    const count = Math.max(1, Math.min(120, targetCount));

    return Array.from({ length: count }, (_, index) =>
      createRiskRowFromGeneratedRisk(
        safeTemplates[index % safeTemplates.length],
        index,
        "sector-risk",
      ),
    );
  };

  const generateAiRiskItems = async () => {
    const sector = cleanText(
      aiSector ||
        companyInfo.activityScope ||
        scopeInfo.evaluatedSections ||
        companyInfo.companyTitle,
    );
    if (!sector) {
      toast.error(
        "AI ile risk üretmek için sektör, faaliyet kapsami veya kisa bir isyeri açıklaması girin.",
      );
      return;
    }

    const defaultCount = getSectorMinimumRiskItemCount(sector, 40);
    const targetCount = Math.max(
      1,
      Math.min(120, asInt(aiRiskCount) || defaultCount),
    );
    const promptSector = cleanText(
      [sector, aiContext ? `Ek saha notu: ${aiContext}` : ""]
        .filter(Boolean)
        .join(". "),
    );

    setAiGenerating(true);
    try {
      const generatedRisks = await generateRisksWithGemini(
        promptSector,
        companyInfo.companyTitle,
      );
      const aiRows = generatedRisks
        .slice(0, targetCount)
        .map((risk, index) =>
          createRiskRowFromGeneratedRisk(risk, index, "ai-risk"),
        );

      const missingCount = targetCount - aiRows.length;
      const completedRows =
        missingCount > 0
          ? [...aiRows, ...buildBuiltInRiskRows(sector, missingCount)]
          : aiRows;

      appendRiskItems(completedRows);
      setRiskAdditionMethod("ai");
      setCurrentStep(RISK_TABLE_STEP_INDEX);
      toast.success(
        `${completedRows.length} risk maddesi Risk Degerlendirme Tablosu’na eklendi.`,
      );
    } catch (error) {
      console.error("Risk wizard AI generation error", error);
      const fallbackRows = buildBuiltInRiskRows(sector, targetCount);
      appendRiskItems(fallbackRows);
      setRiskAdditionMethod("ai");
      setCurrentStep(RISK_TABLE_STEP_INDEX);
      toast.info(
        "AI servisi yanit veremedi; sektör bazli hazir risk paketi tabloya eklendi.",
      );
    } finally {
      setAiGenerating(false);
    }
  };

  const addManualLibraryItems = (items: ManualRiskLibraryItem[]) => {
    if (items.length === 0) return;

    const mappedItems = items.map((item, index) =>
      mapManualLibraryItemToWizardRow(item, index),
    );
    appendRiskItems(mappedItems);
    setRiskAdditionMethod("manual");
    toast.success(
      `${mappedItems.length} risk maddesi Risk Degerlendirme Tablosu’na eklendi.`,
    );
  };

  const addManualLibraryCategory = (items: ManualRiskLibraryItem[]) => {
    addManualLibraryItems(items);
    setCurrentStep(RISK_TABLE_STEP_INDEX);
  };

  const toggleManualCategory = (category: string) => {
    setExpandedManualCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
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
      void importRiskItemsFromAssessment();
    }
  };

  const updateRiskItem = <K extends keyof RiskWizardTableItem>(
    id: string,
    key: K,
    value: RiskWizardTableItem[K],
  ) => {
    setRiskItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextItem = { ...item, [key]: value };
        if (
          key === "probability" ||
          key === "frequency" ||
          key === "severity"
        ) {
          const score =
            asInt(String(nextItem.probability)) *
            asInt(String(nextItem.frequency || "1")) *
            asInt(String(nextItem.severity));
          nextItem.riskScore = score ? String(score) : "";
          nextItem.riskLevel = score
            ? getFineKinneyRiskLevelFromScore(score)
            : "";
        }
        if (key === "riskScore") {
          nextItem.riskLevel = getFineKinneyRiskLevelFromScore(
            asInt(String(value)),
          );
        }
        if (
          key === "postProbability" ||
          key === "postFrequency" ||
          key === "postSeverity"
        ) {
          const postScore =
            asInt(String(nextItem.postProbability || "0.2")) *
            asInt(String(nextItem.postFrequency || "1")) *
            asInt(String(nextItem.postSeverity || "1"));
          nextItem.postRiskScore = postScore ? formatRiskNumber(postScore) : "";
          nextItem.postRiskLevel = postScore
            ? getFineKinneyRiskLevelFromScore(postScore)
            : "";
        }
        if (key === "postRiskScore") {
          nextItem.postRiskLevel = getFineKinneyRiskLevelFromScore(
            asInt(String(value)),
          );
        }
        return nextItem;
      }),
    );
  };

  const removeRiskItem = (id: string) => {
    setRiskItems((prev) =>
      prev
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, no: index + 1 })),
    );
  };

  const addCorrectiveAction = () => {
    setCorrectiveActions((prev) => [
      ...prev,
      createEmptyAction(prev.length + 1),
    ]);
  };

  const updateCorrectiveAction = <K extends keyof CorrectivePreventiveAction>(
    id: string,
    key: K,
    value: CorrectivePreventiveAction[K],
  ) => {
    setCorrectiveActions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    );
  };

  const removeCorrectiveAction = (id: string) => {
    setCorrectiveActions((prev) =>
      prev
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, no: index + 1 })),
    );
  };

  const regenerateSignaturesFromTeam = () => {
    setSignatureRows(buildSignatureRowsFromTeam(teamInfo));
    toast.success("Imza satirlari ekip bilgilerinden yeniden olusturuldu.");
  };

  const addSignatureRow = () => {
    setSignatureRows((prev) => [...prev, createEmptySignatureRow()]);
  };

  const updateSignatureRow = <K extends keyof SignatureRow>(
    id: string,
    key: K,
    value: SignatureRow[K],
  ) => {
    setSignatureRows((prev) => {
      const sourceRows = prev.length > 0 ? prev : previewSignatureRows;
      return sourceRows.map((row) =>
        row.id === id ? { ...row, [key]: value } : row,
      );
    });
  };

  const removeSignatureRow = (id: string) => {
    setSignatureRows((prev) => {
      const sourceRows = prev.length > 0 ? prev : previewSignatureRows;
      return sourceRows.filter((row) => row.id !== id);
    });
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
            "id,item_number,department,hazard,risk,affected_people,existing_controls,proposed_controls,probability_1,frequency_1,severity_1,score_1,risk_class_1,probability_2,frequency_2,severity_2,score_2,risk_class_2,responsible_person,deadline",
          )
          .eq("assessment_id", importAssessmentId)
          .order("sort_order", { ascending: true });
        if (error) throw error;
        const mappedItems = (data || []).map((item, index) =>
          mapEditorRiskItemToWizardRow(item as unknown as RiskItem, index),
        );
        setRiskItems(mappedItems);
        toast.success(
          `${mappedItems.length} risk maddesi editörden aktarildi.`,
        );
      } else {
        const savedRisks = await listSavedRiskItems(user.id);
        const mappedItems = savedRisks.map(mapSavedRiskItemToWizardRow);
        setRiskItems(mappedItems);
        toast.success(`${mappedItems.length} kayitli risk maddesi aktarildi.`);
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

  const applyRiskTemplateToWizard = (
    template: RiskAssessmentTemplateRecord,
  ) => {
    const templateItems = Array.isArray(template.payload?.items)
      ? template.payload.items
      : [];
    if (templateItems.length === 0) {
      toast.error("Seçilen sablonda aktarilacak risk maddesi bulunamadi.");
      return;
    }

    const mappedItems = templateItems.map((item, index) =>
      mapTemplateRiskItemToWizardRow(item, index),
    );
    setRiskItems(mappedItems);
    setRiskAdditionMethod("templates");
    setCurrentStep(RISK_TABLE_STEP_INDEX);
    setRiskTemplateDialogOpen(false);
    toast.success(
      `"${template.name}" sablonundan ${mappedItems.length} risk maddesi tabloya aktarildi.`,
    );
  };

  const handleSaveDraft = () => {
    toast.success("Taslak kaydedildi.", {
      description:
        "Girilen bilgiler adimlar arasinda ve tekrar giriste korunacaktir.",
    });
  };

  const buildRiskTemplatePayload = (
    summaryItems: ReturnType<typeof buildRiskItemsSummary>,
  ): RiskTemplateExportPayload => ({
    companyInfo: {
      companyTitle: companyInfo.companyTitle || selectedCompany?.name || "",
      workplaceRegistryNo:
        companyInfo.workplaceRegistryNo || selectedCompany?.sgkNumber || "",
      hazardClass:
        companyInfo.hazardClass || selectedCompany?.hazardClass || "",
      assessmentDate: companyInfo.assessmentDate,
      validUntil: companyInfo.validUntil,
    },
    teamInfo: {
      employer: {
        fullName: teamInfo.employer.fullName,
        tcNo: teamInfo.employer.tcNo,
      },
      safetyExpert: {
        fullName: teamInfo.safetyExpert.fullName,
        certificateNo: teamInfo.safetyExpert.certificateNo,
      },
      workplaceDoctor: {
        fullName: teamInfo.workplaceDoctor.fullName,
        certificateNo: teamInfo.workplaceDoctor.certificateNo,
      },
      employeeRepresentative: {
        fullName: teamInfo.employeeRepresentative.fullName,
        tcNo: teamInfo.employeeRepresentative.tcNo,
      },
    },
    emergencyInfo: selectedCompany?.emergencyTeamInfo || undefined,
    riskItems: summaryItems.map((item) => ({
      no: item.no,
      departmentActivity: item.departmentActivity,
      hazardSource: item.hazardSource,
      riskConsequence: item.riskConsequence,
      affectedPeople: item.affectedPeople,
      currentMeasure: item.currentMeasure,
      probability: item.probability,
      frequency: item.frequency,
      severity: item.severity,
      riskScore: item.riskScore,
      riskLevel: item.riskLevel,
      additionalMeasures: item.additionalMeasures,
      responsible: item.responsible,
      deadline: item.deadline,
      postProbability: item.postProbability,
      postFrequency: item.postFrequency,
      postSeverity: item.postSeverity,
      postRiskScore: item.postRiskScore,
      postRiskLevel: item.postRiskLevel,
    })),
  });

  const buildRiskProcedurePayload = (): RiskProcedureTemplatePayload => ({
    companyInfo: {
      companyTitle: companyInfo.companyTitle || selectedCompany?.name || "",
      workplaceRegistryNo:
        companyInfo.workplaceRegistryNo || selectedCompany?.sgkNumber || "",
      hazardClass:
        companyInfo.hazardClass || selectedCompany?.hazardClass || "",
      employeeCount:
        companyInfo.employeeCount ||
        (selectedCompany?.employeeCount != null
          ? String(selectedCompany.employeeCount)
          : ""),
      activityScope:
        companyInfo.activityScope || selectedCompany?.activityScope || "",
      address: companyInfo.address || selectedCompany?.address || "",
    },
    teamInfo: {
      employer: {
        fullName: teamInfo.employer.fullName,
        tcNo: teamInfo.employer.tcNo,
      },
      safetyExpert: {
        fullName: teamInfo.safetyExpert.fullName,
        certificateNo: teamInfo.safetyExpert.certificateNo,
      },
      workplaceDoctor: {
        fullName: teamInfo.workplaceDoctor.fullName,
        certificateNo: teamInfo.workplaceDoctor.certificateNo,
      },
      employeeRepresentative: {
        fullName: teamInfo.employeeRepresentative.fullName,
        tcNo: teamInfo.employeeRepresentative.tcNo,
      },
    },
    emergencyInfo: selectedCompany?.emergencyTeamInfo || undefined,
    riskAnalysisPageCount: "1",
  });

  const handleRiskProcedureDownload = async () => {
    const payload = buildRiskProcedurePayload();

    setExportingProcedureWord(true);
    try {
      await generateRiskProcedureTemplateDoc(payload);
      toast.success("Sablon dolduruldu, rapor indirildi.");
    } catch (error) {
      console.error("Risk procedure template export error", error);
      const message =
        error instanceof Error ? error.message : "Rapor olusturulamadi.";
      toast.error(
        message.includes("Sablon")
          ? "Sablon bulunamadi."
          : "Rapor olusturulamadi.",
      );
    } finally {
      setExportingProcedureWord(false);
    }
  };

  const handleExportPdf = async () => {
    const summaryItems = buildRiskItemsSummary(riskItems);
    if (summaryItems.length === 0) {
      toast.error("Risk maddesi yok.");
      return;
    }
    if (!wordTemplateAvailable) {
      toast.error("Sablon bulunamadi.");
      return;
    }
    const payload = buildRiskTemplatePayload(summaryItems);

    setExportingPdf(true);
    try {
      await generateRiskAnalysisTemplatePdf(payload);
      toast.success("Risk analizi PDF olarak hazirlandi.");
    } catch (error) {
      console.error("Risk wizard PDF error", error);
      const message =
        error instanceof Error ? error.message : "PDF raporu olusturulamadi.";
      toast.error(
        message.includes("Sablon")
          ? "Sablon bulunamadi."
          : "PDF raporu olusturulamadi.",
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const handleRiskTemplateDownload = async () => {
    const summaryItems = buildRiskItemsSummary(riskItems);
    if (summaryItems.length === 0) {
      toast.error("Risk maddesi yok.");
      return;
    }
    if (!wordTemplateAvailable) {
      toast.error("Sablon bulunamadi.");
      return;
    }
    const payload = buildRiskTemplatePayload(summaryItems);

    setExportingWord(true);
    try {
      await generateRiskAnalysisTemplateDocx(payload);
      toast.success("Rapor basariyla olusturuldu.");
    } catch (error) {
      console.error("Risk analysis template DOCX error", error);
      const message =
        error instanceof Error ? error.message : "Rapor olusturulamadi.";
      toast.error(
        message.includes("Sablon")
          ? "Sablon bulunamadi."
          : "Rapor olusturulamadi.",
      );
    } finally {
      setExportingWord(false);
    }
  };

  const addScopeItem = () => {
    setScopeInfo((prev) => ({
      ...prev,
      assessmentScopeItems: [...prev.assessmentScopeItems, ""],
    }));
  };

  const updateScopeItem = (index: number, value: string) => {
    setScopeInfo((prev) => ({
      ...prev,
      assessmentScopeItems: prev.assessmentScopeItems.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    }));
  };

  const removeScopeItem = (index: number) => {
    setScopeInfo((prev) => ({
      ...prev,
      assessmentScopeItems: prev.assessmentScopeItems.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }));
  };

  const addConclusionItem = () => {
    setConclusionInfo((prev) => ({
      ...prev,
      conclusionItems: [...prev.conclusionItems, ""],
    }));
  };

  const updateConclusionItem = (index: number, value: string) => {
    setConclusionInfo((prev) => ({
      ...prev,
      conclusionItems: prev.conclusionItems.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    }));
  };

  const removeConclusionItem = (index: number) => {
    setConclusionInfo((prev) => ({
      ...prev,
      conclusionItems: prev.conclusionItems.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }));
  };

  const renderInput = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    options?: {
      placeholder?: string;
      required?: boolean;
      type?: string;
      errorKey?: string;
    },
  ) => {
    const isError =
      options?.required &&
      touched[options?.errorKey || label] &&
      !cleanText(value);
    return (
      <div className="space-y-2">
        <Label
          className={cn(
            "text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300",
            isError && "text-red-500",
          )}
        >
          {label}
        </Label>
        <Input
          type={options?.type || "text"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={options?.placeholder}
          className={cn(
            "h-11 rounded-lg border border-slate-300 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500",
            isError &&
              "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
          )}
        />
        {isError ? (
          <p className="text-xs text-red-500">
            Bu alani bos birakabilirsiniz; yalnizca çıktı bilgisini etkiler.
          </p>
        ) : null}
      </div>
    );
  };

  const renderStepContent = () => {
    switch (WIZARD_STEPS[currentStep]?.id) {
      case "company":
        return (
          <div className="space-y-6">
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/30 p-4">
              <p className="text-sm leading-relaxed text-cyan-800 dark:text-cyan-200">
                Firma bilgileri profil kayitlarindan otomatik getirilir. Bu
                ekranda yaptiginiz degisiklikler yalnizca risk degerlendirme
                taslagina kaydedilir.
              </p>
            </div>

            <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-slate-900 dark:text-slate-100">
                  <Building2 className="h-4 w-4 text-cyan-600" />
                  Profilimdeki Firmadan Doldur
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  Firma seçildiginde kapak bilgileri ve Risk Degerlendirme Ekibi
                  alanlari Profilim &gt; Firmalar kaydindan otomatik aktarilir.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                  <Select
                    value={selectedCompanyId}
                    onValueChange={applyCompanyToWizard}
                    disabled={companiesLoading}
                  >
                    <SelectTrigger className="h-10 rounded-xl border-slate-300 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                      <SelectValue
                        placeholder={
                          companiesLoading
                            ? "Firmalar yükleniyor..."
                            : "Firma seçin"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-80 border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
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
                    className="rounded-xl border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Profilim / Firmalar
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                {selectedCompany &&
                selectedCompanyMissingTeamFields.length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    <p className="font-bold">
                      Risk Degerlendirme Ekibi bilgileri eksik.
                    </p>
                    <p className="mt-1 text-amber-700 dark:text-amber-200/90">
                      Eksik alanlar:{" "}
                      {selectedCompanyMissingTeamFields.join(", ")}. Bu alanlari
                      Profilim &gt; Firmalar sekmesindeki Atamalar bölümünden
                      doldurabilirsiniz.
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-cyan-200 bg-cyan-50/80 shadow-sm dark:border-cyan-800 dark:bg-cyan-950/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-cyan-900 dark:text-cyan-100">
                  <FileText className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                  Risk Degerlendirme Süreci
                </CardTitle>
                <CardDescription className="text-cyan-800/80 dark:text-cyan-200/80">
                  Firma ve ekip bilgileri ile prosedür raporu olusturun.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  onClick={handleRiskProcedureDownload}
                  disabled={exportingProcedureWord}
                  className="rounded-xl bg-cyan-600 text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60"
                >
                  {exportingProcedureWord ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Risk Degerlendirme Süreci Raporu Indir
                </Button>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {renderInput(
                "Firma Unvani",
                companyInfo.companyTitle,
                (value) => updateCompanyInfo("companyTitle", value),
                {
                  placeholder: "Firma unvani",
                  errorKey: "companyTitle",
                },
              )}
              {renderInput(
                "Isyeri Sicil No",
                companyInfo.workplaceRegistryNo,
                (value) => updateCompanyInfo("workplaceRegistryNo", value),
                {
                  placeholder: "Isyeri sicil numarasi",
                },
              )}
              {renderInput(
                "Adres",
                companyInfo.address,
                (value) => updateCompanyInfo("address", value),
                {
                  placeholder: "Açık adres",
                },
              )}
              {renderInput(
                "E-posta",
                companyInfo.email,
                (value) => updateCompanyInfo("email", value),
                {
                  placeholder: "E-posta adresi",
                  type: "email",
                },
              )}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Tehlike Sinifi
                </Label>
                <Select
                  value={companyInfo.hazardClass}
                  onValueChange={(value) =>
                    updateCompanyInfo("hazardClass", value as HazardClass)
                  }
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-300 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                    <SelectItem value="Az Tehlikeli">Az Tehlikeli</SelectItem>
                    <SelectItem value="Tehlikeli">Tehlikeli</SelectItem>
                    <SelectItem value="Çok Tehlikeli">Çok Tehlikeli</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {renderInput(
                "Çalışan Sayısı",
                companyInfo.employeeCount,
                (value) => updateCompanyInfo("employeeCount", value),
                {
                  placeholder: "Çalışan sayısı",
                  errorKey: "employeeCount",
                },
              )}
              {renderInput(
                "Degerlendirme Tarihi",
                companyInfo.assessmentDate,
                (value) => updateCompanyInfo("assessmentDate", value),
                {
                  type: "date",
                  errorKey: "assessmentDate",
                },
              )}
              {renderInput(
                "Geçerlilik / Yenileme Tarihi",
                companyInfo.validUntil,
                (value) => updateCompanyInfo("validUntil", value),
                {
                  type: "date",
                },
              )}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Risk Degerlendirme Yöntemi
                </Label>
                <Select
                  value={companyInfo.riskMethod}
                  onValueChange={(value) =>
                    updateCompanyInfo("riskMethod", value as RiskMethod)
                  }
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-300 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                    <SelectItem value="5x5 Matris">5x5 Matris</SelectItem>
                    <SelectItem value="Fine-Kinney">Fine-Kinney</SelectItem>
                    <SelectItem value="L Tipi Matris">L Tipi Matris</SelectItem>
                    <SelectItem value="Diger">Diger</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Faaliyet Kapsami
              </Label>
              <Textarea
                value={companyInfo.activityScope}
                onChange={(event) =>
                  updateCompanyInfo("activityScope", event.target.value)
                }
                placeholder="Faaliyet kapsamini kisa ve net biçimde yazin"
                className="min-h-[100px] rounded-xl border-slate-300 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Not
              </Label>
              <Textarea
                value={companyInfo.note}
                onChange={(event) =>
                  updateCompanyInfo("note", event.target.value)
                }
                placeholder="Opsiyonel not"
                className="min-h-[90px] rounded-xl border-slate-300 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bos birakilirsa çıktıda Not alani hiç gösterilmez.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Risk Analizi Logosu
                </Label>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Logo eklerseniz PDF çıktısının üst bölümünde gösterilir.
                </p>
              </div>
              {logo ? (
                <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <img
                      src={logo.dataUrl}
                      alt={logo.name}
                      className="h-20 w-40 rounded-xl bg-white object-contain p-3"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      onClick={() => setLogo(null)}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Logoyu Kaldir
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
                  <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    PNG veya JPG logo seçin
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Maksimum 2 MB
                  </p>
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

      case "team":
        return (
          <div className="space-y-5">
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/30 p-4 text-sm leading-relaxed text-cyan-800 dark:text-cyan-200">
              {hasTeamInfoData(teamInfo)
                ? "Bu bilgiler firma profilinden otomatik getirildi. Bu ekranda yaptiginiz degisiklikler risk degerlendirme taslagina kaydedilir."
                : "Firma profilinde kayitli ekip bilgisi bulunamadi. Alanlari manuel doldurabilir veya bos birakabilirsiniz."}
            </div>

            <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-slate-900 dark:text-slate-100">
                  Risk Degerlendirme Ekibi
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  Alanlar zorunlu degildir. Bos birakilan bilgiler çıktıda bos
                  alan olarak kalir.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 p-4">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Isveren
                  </p>
                  {renderInput(
                    "Ad - Soyad",
                    teamInfo.employer.fullName,
                    (value) => updateTeamPerson("employer", "fullName", value),
                    {
                      placeholder: "Isveren ad soyad",
                    },
                  )}
                  {renderInput(
                    "T.C. Kimlik Numarasi",
                    teamInfo.employer.tcNo,
                    (value) => updateTeamPerson("employer", "tcNo", value),
                    {
                      placeholder: "T.C. kimlik numarasi",
                    },
                  )}
                  {renderInput(
                    "Telefon Numarasi",
                    teamInfo.employer.phone,
                    (value) => updateTeamPerson("employer", "phone", value),
                    {
                      placeholder: "Telefon numarasi",
                    },
                  )}
                </div>

                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 p-4">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Çalışan Temsilcisi
                  </p>
                  {renderInput(
                    "Ad - Soyad",
                    teamInfo.employeeRepresentative.fullName,
                    (value) =>
                      updateTeamPerson(
                        "employeeRepresentative",
                        "fullName",
                        value,
                      ),
                    {
                      placeholder: "çalışan temsilcisi ad soyad",
                    },
                  )}
                  {renderInput(
                    "T.C. Kimlik Numarasi",
                    teamInfo.employeeRepresentative.tcNo,
                    (value) =>
                      updateTeamPerson("employeeRepresentative", "tcNo", value),
                    {
                      placeholder: "T.C. kimlik numarasi",
                    },
                  )}
                  {renderInput(
                    "Telefon Numarasi",
                    teamInfo.employeeRepresentative.phone,
                    (value) =>
                      updateTeamPerson(
                        "employeeRepresentative",
                        "phone",
                        value,
                      ),
                    {
                      placeholder: "Telefon numarasi",
                    },
                  )}
                </div>

                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 p-4">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Is Güvenliği Uzmani
                  </p>
                  {renderInput(
                    "Ad - Soyad",
                    teamInfo.safetyExpert.fullName,
                    (value) =>
                      updateTeamPerson("safetyExpert", "fullName", value),
                    {
                      placeholder: "Is güvenliği uzmani ad soyad",
                    },
                  )}
                  {renderInput(
                    "T.C. Kimlik Numarasi",
                    teamInfo.safetyExpert.tcNo,
                    (value) => updateTeamPerson("safetyExpert", "tcNo", value),
                    {
                      placeholder: "T.C. kimlik numarasi",
                    },
                  )}
                  {renderInput(
                    "Telefon Numarasi",
                    teamInfo.safetyExpert.phone,
                    (value) => updateTeamPerson("safetyExpert", "phone", value),
                    {
                      placeholder: "Telefon numarasi",
                    },
                  )}
                  {renderInput(
                    "Sertifika No",
                    teamInfo.safetyExpert.certificateNo || "",
                    (value) =>
                      updateTeamPerson("safetyExpert", "certificateNo", value),
                    {
                      placeholder: "Sertifika numarasi",
                    },
                  )}
                  {renderInput(
                    "Sertifika Sinifi",
                    teamInfo.safetyExpert.certificateClass || "",
                    (value) =>
                      updateTeamPerson(
                        "safetyExpert",
                        "certificateClass",
                        value,
                      ),
                    {
                      placeholder: "A/B/C sinifi veya ek bilgi",
                    },
                  )}
                </div>

                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 p-4">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Isyeri Hekimi
                  </p>
                  {renderInput(
                    "Ad - Soyad",
                    teamInfo.workplaceDoctor.fullName,
                    (value) =>
                      updateTeamPerson("workplaceDoctor", "fullName", value),
                    {
                      placeholder: "Isyeri hekimi ad soyad",
                    },
                  )}
                  {renderInput(
                    "T.C. Kimlik Numarasi",
                    teamInfo.workplaceDoctor.tcNo,
                    (value) =>
                      updateTeamPerson("workplaceDoctor", "tcNo", value),
                    {
                      placeholder: "T.C. kimlik numarasi",
                    },
                  )}
                  {renderInput(
                    "Telefon Numarasi",
                    teamInfo.workplaceDoctor.phone,
                    (value) =>
                      updateTeamPerson("workplaceDoctor", "phone", value),
                    {
                      placeholder: "Telefon numarasi",
                    },
                  )}
                  {renderInput(
                    "Sertifika No",
                    teamInfo.workplaceDoctor.certificateNo || "",
                    (value) =>
                      updateTeamPerson(
                        "workplaceDoctor",
                        "certificateNo",
                        value,
                      ),
                    {
                      placeholder: "Sertifika numarasi",
                    },
                  )}
                </div>

                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 p-4 md:col-span-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    OSGB Bilgileri
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    {renderInput(
                      "OSGB Unvani",
                      teamInfo.osgb.title,
                      (value) => updateTeamOsgb("title", value),
                      {
                        placeholder: "OSGB unvani",
                      },
                    )}
                    {renderInput(
                      "Telefon Numarasi",
                      teamInfo.osgb.phone,
                      (value) => updateTeamOsgb("phone", value),
                      {
                        placeholder: "Telefon numarasi",
                      },
                    )}
                    {renderInput(
                      "E-posta",
                      teamInfo.osgb.email,
                      (value) => updateTeamOsgb("email", value),
                      {
                        placeholder: "E-posta adresi",
                        type: "email",
                      },
                    )}
                    {renderInput(
                      "Yetkili Kisi",
                      teamInfo.osgb.authorizedPerson,
                      (value) => updateTeamOsgb("authorizedPerson", value),
                      {
                        placeholder: "Yetkili kisi",
                      },
                    )}
                    {renderInput(
                      "Adres",
                      teamInfo.osgb.address || "",
                      (value) => updateTeamOsgb("address", value),
                      {
                        placeholder: "OSGB adresi",
                      },
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "scope":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Adim 3
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Degerlendirme kapsamini madde madde girin. Risk puanlama yöntemi
                bölümünde PDF’te her zaman sabit 5x5 tablo basilir.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={addScopeItem}
                className="rounded-xl bg-violet-600 text-white hover:bg-violet-700"
              >
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
                  <div
                    key={`scope-${index}`}
                    className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <Badge className="rounded-full border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
                        Kapsam Maddesi #{index + 1}
                      </Badge>
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
                      onChange={(event) =>
                        updateScopeItem(index, event.target.value)
                      }
                      placeholder="Degerlendirme kapsami maddesi"
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
                onChange={(event) =>
                  updateScopeInfo("evaluatedSections", event.target.value)
                }
                placeholder="Örn: Üretim hatti, depo, sevkiyat alani"
                className="min-h-[100px] rounded-2xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
            <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
              <CardHeader>
                <CardTitle className="text-sm text-slate-900 dark:text-slate-100">
                  PDF’te Sabit Görünecek Risk Puanlama Metodu
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Kapakta seçtiğiniz yöntem yazmaya devam eder; ancak resmi
                  sablon geregi bu raporda sabit 5x5 puanlama açıklaması ve
                  tablosu kullanilir.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {FIXED_METHOD_DESCRIPTION}
              </CardContent>
            </Card>
          </div>
        );

      case "risk-method":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-violet-500/10 bg-violet-500/5 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-violet-700 dark:text-violet-300">
                Adim 4
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Riskleri tek merkezden ekleyin: AI ile üretin, manuel satir
                açın, sablonlardan aktarin veya kayitli risklerinizi tabloya
                tasiyin.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  id: "ai" as const,
                  title: "Yapay Zeka Sohbeti ile Risk Üret",
                  description:
                    "AI önce isyeriniz hakkinda baglam alir, sonra sektör odakli riskleri tabloya ekler.",
                  icon: <Sparkles className="h-6 w-6" />,
                  accent: "from-fuchsia-500 to-violet-600",
                  badge: "ÖNERİLEN",
                  items: [
                    "Sektör ve faaliyet odakli Üretim",
                    "Hazir risk paketiyle güvenli yedek",
                    "Tabloya tek tikla aktarim",
                  ],
                },
                {
                  id: "manual" as const,
                  title: "Manuel Seçim",
                  description:
                    "Risk kütüphanesinden veya kendi saha notlarinizdan satirlari kendiniz girin.",
                  icon: <BookOpen className="h-6 w-6" />,
                  accent: "from-emerald-500 to-teal-600",
                  items: [
                    "Bos risk satiri olusturma",
                    "Tam kontrol",
                    "Anında düzenleme",
                  ],
                },
                {
                  id: "templates" as const,
                  title: "Sablonlar & Paylasilanlar",
                  description:
                    "Kayitli sablonlarinizi veya paylasilan risk paketlerini hizlica kullanin.",
                  icon: <Archive className="h-6 w-6" />,
                  accent: "from-amber-500 to-orange-600",
                  items: [
                    "Sablon kütüphanesi",
                    "Tek tikla aktarma",
                    "Sektör paketleri",
                  ],
                },
                {
                  id: "saved" as const,
                  title: "Kayitli Risklerim",
                  description:
                    "Daha önce olusturdugunuz risk maddelerini mevcut rapora aktarin.",
                  icon: <FolderOpen className="h-6 w-6" />,
                  accent: "from-blue-500 to-cyan-600",
                  items: [
                    "Mevcut degerlendirmeden aktarim",
                    "Arama ve filtreleme için hazir yapi",
                    "Toplu ekleme",
                  ],
                },
              ].map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => handleRiskAdditionMethodSelect(method.id)}
                  className={cn(
                    "relative rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md dark:hover:border-slate-700 dark:hover:bg-slate-800/70",
                    riskAdditionMethod === method.id
                      ? "border-violet-400/50 bg-violet-500/10"
                      : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40",
                  )}
                >
                  {method.badge ? (
                    <Badge className="absolute -top-3 left-5 rounded-full bg-violet-500 px-3 py-1 text-[10px] font-black text-white">
                      {method.badge}
                    </Badge>
                  ) : null}
                  <div
                    className={cn(
                      "mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white",
                      method.accent,
                    )}
                  >
                    {method.icon}
                  </div>
                  <h4 className="text-base font-black leading-snug text-slate-900 dark:text-slate-100">
                    {method.title}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {method.description}
                  </p>
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
                        <CardTitle className="text-lg text-slate-900 dark:text-slate-100">
                          Manuel Risk Seçimi
                        </CardTitle>
                        <CardDescription className="mt-1 text-slate-400">
                          Sablondaki {MANUAL_RISK_LIBRARY.length} risk maddesini
                          kategorilere göre seçip tabloya ekleyin.
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
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
                        onChange={(event) =>
                          setManualRiskSearch(event.target.value)
                        }
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
                        const isExpanded = Boolean(
                          expandedManualCategories[category],
                        );
                        return (
                          <div
                            key={category}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60"
                          >
                            <div className="flex items-center gap-3 p-3">
                              <button
                                type="button"
                                onClick={() => toggleManualCategory(category)}
                                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-2 text-left transition hover:bg-slate-800/50"
                              >
                                <span className="truncate text-sm font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">
                                  {category}
                                </span>
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
                                className="h-9 w-9 shrink-0 rounded-xl text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300"
                                title="Bu kategorideki tüm riskleri ekle"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            {isExpanded ? (
                              <div className="space-y-2 border-t border-slate-800/80 p-3">
                                {items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4"
                                  >
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                      <div className="min-w-0 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Badge className="rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
                                            #{item.sourceSequenceNo}
                                          </Badge>
                                          {item.riskLevel ? (
                                            <Badge className="rounded-full border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                                              {item.riskLevel}
                                            </Badge>
                                          ) : null}
                                        </div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                          {item.hazardSource ||
                                            "Tehlike kaynagi belirtilmedi"}
                                        </p>
                                        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                          {item.riskConsequence ||
                                            "Risk açıklaması yok"}
                                        </p>
                                        {item.additionalMeasures ? (
                                          <p className="line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                            {item.additionalMeasures}
                                          </p>
                                        ) : null}
                                      </div>
                                      <Button
                                        type="button"
                                        onClick={() =>
                                          addManualLibraryItems([item])
                                        }
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
                    <span>
                      Eklenen maddeler bir sonraki adimda düzenlenebilir veya
                      silinebilir.
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(RISK_TABLE_STEP_INDEX)}
                      className="rounded-xl border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                    >
                      Risk Tablosuna Geç
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {riskAdditionMethod === "ai" ? (
              <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-base text-slate-900 dark:text-slate-100">
                    AI ile Risk Üretim Alani
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Isterseniz kisa bir sektör/saha açıklaması girin. AI yanit
                    veremezse sistem sektör bazli hazir risk paketini güvenli
                    yedek olarak tabloya ekler.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_160px]">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Isyeri Türü / Sektör
                      </Label>
                      <Select
                        value={aiSector}
                        onValueChange={(value) => {
                          setAiSector(value);
                          setAiRiskCount(
                            String(getSectorMinimumRiskItemCount(value, 40)),
                          );
                        }}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
                          <SelectValue placeholder="Sektör seçin veya asagiya açıklama yazin" />
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
                    {renderInput(
                      "Risk Madde Sayisi",
                      aiRiskCount,
                      setAiRiskCount,
                      {
                        type: "number",
                        placeholder: "40",
                      },
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      AI için Saha Notu
                    </Label>
                    <Textarea
                      value={aiContext}
                      onChange={(event) => setAiContext(event.target.value)}
                      placeholder="Örn: 3 katli santiye, iskele ve geçici elektrik var; taseron ekipler çalışıyor."
                      className="min-h-[100px] rounded-2xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      Sonraki adimda olusturulan tüm risk maddelerini
                      düzenleyebilir, silebilir veya yeni satir
                      ekleyebilirsiniz.
                    </p>
                    <Button
                      type="button"
                      onClick={generateAiRiskItems}
                      disabled={aiGenerating}
                      className="rounded-xl bg-violet-600 text-white hover:bg-violet-700"
                    >
                      {aiGenerating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      {aiGenerating
                        ? "Riskler üretiliyor..."
                        : "AI ile Riskleri Olustur"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        );

      case "risk-table":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-rose-500/10 bg-rose-500/5 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-rose-400">
                Adim 5
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Risk tablosu yalnizca eklediginiz veya aktardiginiz satirlar
                kadar olusturulur. Bos sablon satiri basilmaz.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={addRiskItem}
                className="rounded-xl bg-violet-600 text-white hover:bg-violet-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Manuel Risk Maddesi Ekle
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRiskTemplateDialogOpen(true)}
                className="rounded-xl border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
              >
                {exportingWord ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                Risk Sablonundan Ekle
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={importingRiskItems}
                onClick={importRiskItemsFromAssessment}
                className="rounded-xl border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-300 dark:hover:bg-cyan-950/50"
              >
                {importingRiskItems ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Kayitli Riskleri Aktar
              </Button>
            </div>
            {!importAssessmentId ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kayitli riskler Profilim &gt; Risklerim kütüphanenizden
                aktarilir; mevcut degerlendirme üzerinden açıldıysa editör
                satirlari da desteklenir.
              </p>
            ) : null}

            <div className="space-y-4">
              {riskItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-6 text-sm text-slate-400">
                  Henüz risk maddesi eklenmedi. Isterseniz manuel satir ekleyin,
                  AI ile üretin veya kayitli riskleri aktarin.
                </div>
              ) : (
                riskItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <Badge className="rounded-full border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
                        Risk Maddesi #{item.no}
                      </Badge>
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
                      {renderInput(
                        "Bölüm / Faaliyet",
                        item.departmentActivity,
                        (value) =>
                          updateRiskItem(item.id, "departmentActivity", value),
                      )}
                      {renderInput(
                        "Tehlike Kaynagi",
                        item.hazardSource,
                        (value) =>
                          updateRiskItem(item.id, "hazardSource", value),
                      )}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Risk / Olasi Sonuç
                        </Label>
                        <Textarea
                          value={item.riskConsequence}
                          onChange={(event) =>
                            updateRiskItem(
                              item.id,
                              "riskConsequence",
                              event.target.value,
                            )
                          }
                          className="min-h-[90px] rounded-2xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Etkilenenler
                        </Label>
                        <Textarea
                          value={item.affectedPeople}
                          onChange={(event) =>
                            updateRiskItem(
                              item.id,
                              "affectedPeople",
                              event.target.value,
                            )
                          }
                          className="min-h-[90px] rounded-2xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Mevcut önlem
                        </Label>
                        <Textarea
                          value={item.currentMeasure}
                          onChange={(event) =>
                            updateRiskItem(
                              item.id,
                              "currentMeasure",
                              event.target.value,
                            )
                          }
                          className="min-h-[90px] rounded-2xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Alinacak Ilave önlemler
                        </Label>
                        <Textarea
                          value={item.additionalMeasures}
                          onChange={(event) =>
                            updateRiskItem(
                              item.id,
                              "additionalMeasures",
                              event.target.value,
                            )
                          }
                          className="min-h-[90px] rounded-2xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-800 dark:text-amber-300">
                          Mevcut Risk Puani
                        </p>
                        <Badge className="rounded-full border border-amber-200 bg-white text-amber-700 dark:border-amber-900 dark:bg-slate-900 dark:text-amber-300">
                          O × F × S = R
                        </Badge>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                        {renderInput(
                          "Olasilik (O)",
                          item.probability,
                          (value) =>
                            updateRiskItem(item.id, "probability", value),
                          { type: "number" },
                        )}
                        {renderInput(
                          "Frekans (F)",
                          item.frequency,
                          (value) =>
                            updateRiskItem(item.id, "frequency", value),
                          { type: "number" },
                        )}
                        {renderInput(
                          "Siddet (S)",
                          item.severity,
                          (value) => updateRiskItem(item.id, "severity", value),
                          { type: "number" },
                        )}
                        {renderInput(
                          "Risk Puani (R)",
                          item.riskScore,
                          (value) =>
                            updateRiskItem(item.id, "riskScore", value),
                          { type: "number" },
                        )}
                        {renderInput("Risk Düzeyi", item.riskLevel, (value) =>
                          updateRiskItem(item.id, "riskLevel", value),
                        )}
                        {renderInput(
                          "Termin",
                          item.deadline,
                          (value) => updateRiskItem(item.id, "deadline", value),
                          {
                            placeholder: "Süreklilik esastir / gg.aa.yyyy",
                          },
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {renderInput("Sorumlu", item.responsible, (value) =>
                        updateRiskItem(item.id, "responsible", value),
                      )}
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-300">
                          Tedbir Sonrasi Risk
                        </p>
                        <Badge className="rounded-full border border-emerald-200 bg-white text-emerald-700 dark:border-emerald-900 dark:bg-slate-900 dark:text-emerald-300">
                          Artik risk seviyesi
                        </Badge>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        {renderInput(
                          "Olasilik (O)",
                          item.postProbability,
                          (value) =>
                            updateRiskItem(item.id, "postProbability", value),
                          { type: "number" },
                        )}
                        {renderInput(
                          "Frekans (F)",
                          item.postFrequency,
                          (value) =>
                            updateRiskItem(item.id, "postFrequency", value),
                          { type: "number" },
                        )}
                        {renderInput(
                          "Siddet (S)",
                          item.postSeverity,
                          (value) =>
                            updateRiskItem(item.id, "postSeverity", value),
                          { type: "number" },
                        )}
                        {renderInput(
                          "Risk Puani (R)",
                          item.postRiskScore,
                          (value) =>
                            updateRiskItem(item.id, "postRiskScore", value),
                          { type: "number" },
                        )}
                        {renderInput(
                          "Risk Düzeyi",
                          item.postRiskLevel,
                          (value) =>
                            updateRiskItem(item.id, "postRiskLevel", value),
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case "actions":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">
                Adim 6
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Faaliyet plani tablosu yalnizca eklediginiz satirlardan olusur.
                Bos satirlar çıktıdan tamamen çıkarılır.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={addCorrectiveAction}
                className="rounded-xl bg-violet-600 text-white hover:bg-violet-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Faaliyet Ekle
              </Button>
            </div>

            {correctiveActions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-6 text-sm text-slate-400">
                Henüz faaliyet eklenmedi. Isterseniz bu adimi bos
                birakabilirsiniz.
              </div>
            ) : (
              <div className="space-y-4">
                {correctiveActions.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <Badge className="rounded-full border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
                        Faaliyet #{item.no}
                      </Badge>
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
                      {renderInput("Tespit / Risk", item.finding, (value) =>
                        updateCorrectiveAction(item.id, "finding", value),
                      )}
                      {renderInput("Yapilacak Faaliyet", item.action, (value) =>
                        updateCorrectiveAction(item.id, "action", value),
                      )}
                      {renderInput("Sorumlu", item.responsible, (value) =>
                        updateCorrectiveAction(item.id, "responsible", value),
                      )}
                      {renderInput(
                        "Termin",
                        item.deadline,
                        (value) =>
                          updateCorrectiveAction(item.id, "deadline", value),
                        { type: "date" },
                      )}
                      {renderInput("Durum", item.status, (value) =>
                        updateCorrectiveAction(item.id, "status", value),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "conclusion":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Adim 7
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Genel sonuç maddelerini ekleyin ve imza satirlarini ekip
                üyelerinden otomatik olusturun veya elle yönetin.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={addConclusionItem}
                className="rounded-xl bg-violet-600 text-white hover:bg-violet-700"
              >
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
                  <div
                    key={`conclusion-${index}`}
                    className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <Badge className="rounded-full border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
                        Sonuç Maddesi #{index + 1}
                      </Badge>
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
                      onChange={(event) =>
                        updateConclusionItem(index, event.target.value)
                      }
                      placeholder="Genel sonuç / onay maddesi"
                      className="min-h-[90px] rounded-2xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Onay Notu
              </Label>
              <Textarea
                value={conclusionInfo.approvalNote}
                onChange={(event) =>
                  updateConclusionInfo("approvalNote", event.target.value)
                }
                className="min-h-[90px] rounded-2xl border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {renderInput("Hazirlayan", conclusionInfo.preparedBy, (value) =>
                updateConclusionInfo("preparedBy", value),
              )}
              {renderInput("Onaylayan", conclusionInfo.approvedBy, (value) =>
                updateConclusionInfo("approvedBy", value),
              )}
              {renderInput(
                "Imza Tarihi",
                conclusionInfo.signatureDate,
                (value) => updateConclusionInfo("signatureDate", value),
                { type: "date" },
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-300 dark:hover:bg-cyan-950/50"
                onClick={regenerateSignaturesFromTeam}
              >
                <Users className="mr-2 h-4 w-4" />
                Ekipten Otomatik Doldur
              </Button>
              <Button
                type="button"
                onClick={addSignatureRow}
                className="rounded-xl bg-violet-600 text-white hover:bg-violet-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Imza Satiri Ekle
              </Button>
            </div>

            {previewSignatureRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-6 text-sm text-slate-400">
                Henüz imza satiri eklenmedi.
              </div>
            ) : (
              <div className="space-y-4">
                {previewSignatureRows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-5 grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto]"
                  >
                    {renderInput("Adi Soyadi", row.fullName, (value) =>
                      updateSignatureRow(row.id, "fullName", value),
                    )}
                    {renderInput("Görevi", row.role, (value) =>
                      updateSignatureRow(row.id, "role", value),
                    )}
                    {renderInput(
                      "Belge / Iletisim Bilgisi",
                      row.documentOrContact,
                      (value) =>
                        updateSignatureRow(row.id, "documentOrContact", value),
                    )}
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
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Adim 8
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Resmî sablondaki bölüm sirasina göre olusturulacak rapor Özetini
                kontrol edin.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["Firma Unvani", companyInfo.companyTitle || "Belirtilmedi"],
                ["Tehlike Sinifi", companyInfo.hazardClass || "Belirtilmedi"],
                ["Çalışan Sayısı", companyInfo.employeeCount || "Belirtilmedi"],
                [
                  "Faaliyet Kapsami",
                  companyInfo.activityScope || "Belirtilmedi",
                ],
                [
                  "Degerlendirme Tarihi",
                  formatDisplayDate(companyInfo.assessmentDate),
                ],
                [
                  "Risk Degerlendirme Yöntemi",
                  companyInfo.riskMethod || "Belirtilmedi",
                ],
                ["Risk Madde Sayisi", String(previewRiskItems.length)],
                ["DÖF / Faaliyet Plani Sayisi", String(previewActions.length)],
                ["Imza Satiri Sayisi", String(previewSignatureRows.length)],
                ["Not", cleanText(companyInfo.note) ? "Var" : "Yok"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-4"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {label}
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100 break-words">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="text-base text-slate-900 dark:text-slate-100">
                  Word Sablonu Durumu
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Resmî sablon dosyasi erisimi kontrol edildi. Sablon
                  bulundugunda resmi Word çıktısı ayni veri setiyle
                  indirilebilir.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold",
                      wordTemplateAvailable
                        ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                        : "border-red-500/20 bg-red-500/10 text-red-400",
                    )}
                  >
                    {checkingTemplate
                      ? "Kontrol ediliyor"
                      : wordTemplateAvailable
                        ? "Sablon bulundu"
                        : "Sablona erisilemedi"}
                  </Badge>
                  <span>
                    {wordTemplateAvailable
                      ? "Word sablonu indirilmeye hazir."
                      : "Word sablon dosyasina erisilemiyor."}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base text-slate-900 dark:text-slate-100">
                  Rapor çıktılari
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  Bos, kismen dolu veya tamamen dolu risk degerlendirme çıktısı
                  olusturabilirsiniz.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Button
                  type="button"
                  onClick={handleSaveDraft}
                  variant="outline"
                  className="rounded-xl border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
                  {exportingPdf ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  PDF Indir
                </Button>
                <Button
                  type="button"
                  onClick={handleRiskTemplateDownload}
                  disabled={
                    !wordTemplateAvailable || checkingTemplate || exportingWord
                  }
                  className="rounded-xl bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {exportingWord ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="mr-2 h-4 w-4" />
                  )}
                  Word Dosyasi Indir
                </Button>
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.10),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(139,92,246,0.08),_transparent_28%)] bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <section className="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-slate-950 px-5 py-6 text-white shadow-xl shadow-slate-950/10 sm:px-7 lg:px-9 lg:py-8 dark:border-slate-800">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />

          <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold tracking-wide text-cyan-100">
                  ISGVizyon Risk Yönetimi
                </Badge>
                <Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-300">
                  8 adimli profesyonel olusturucu
                </Badge>
              </div>
              <h1 className="max-w-4xl text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
                Risk Degerlendirmesini düzenli, Kontrolle ve Eksiksiz Hazirlayin
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Firma ve ekip bilgilerini aktarin, kapsami belirleyin, risk
                maddelerini yönetin ve resmi rapor çıktısını tek ekrandan
                olusturun.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Genel ilerleme
                  </p>
                  <p className="mt-1 text-lg font-black text-white">
                    Adim {currentStep + 1} / {WIZARD_STEPS.length}
                  </p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-lg font-black text-cyan-100">
                  %{Math.round(progressRatio)}
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400 transition-all duration-500"
                  style={{ width: `${progressRatio}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">
                Taslak otomatik korunur. Zorunlu alan bulunmadigindan bilgileri
                daha sonra tamamlayabilirsiniz.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Seçili Firma",
              value: companyInfo.companyTitle || "Firma seçilmedi",
              detail: companyInfo.hazardClass || "Tehlike sinifi belirtilmedi",
              icon: <Building2 className="h-5 w-5" />,
              iconClass:
                "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
            },
            {
              label: "Risk Maddeleri",
              value: String(previewRiskItems.length),
              detail: riskAdditionMethod
                ? "Risk kaynagi seçildi"
                : "Henüz risk kaynagi seçilmedi",
              icon: <AlertTriangle className="h-5 w-5" />,
              iconClass:
                "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
            },
            {
              label: "Faaliyet Plani",
              value: String(previewActions.length),
              detail: `${previewSignatureRows.length} imza satiri`,
              icon: <CheckCircle2 className="h-5 w-5" />,
              iconClass:
                "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
            },
            {
              label: "Rapor Sablonu",
              value: checkingTemplate
                ? "Kontrol ediliyor"
                : wordTemplateAvailable
                  ? "Hazir"
                  : "Erisilemiyor",
              detail: wordTemplateAvailable
                ? "Word ve PDF çıktısı alinabilir"
                : "Sablon dosyasini kontrol edin",
              icon: <FileText className="h-5 w-5" />,
              iconClass: wordTemplateAvailable
                ? "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
                : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-950/[0.03] dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    stat.iconClass,
                  )}
                >
                  {stat.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    {stat.label}
                  </p>
                  <p className="mt-1 truncate text-base font-black text-slate-950 dark:text-white">
                    {stat.value}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                    {stat.detail}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start">
          <aside className="hidden xl:sticky xl:top-6 xl:block">
            <Card className="overflow-hidden rounded-[24px] border-slate-200/80 bg-white shadow-lg shadow-slate-950/[0.04] dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="border-b border-slate-200/80 bg-slate-50/80 pb-4 dark:border-slate-800 dark:bg-slate-900/80">
                <CardTitle className="text-base text-slate-950 dark:text-white">
                  Olusturma Adimlari
                </CardTitle>
                <CardDescription className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Istediginiz adima dogrudan geçebilir, bilgileri dilediginiz
                  sirada tamamlayabilirsiniz.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-3">
                {WIZARD_STEPS.map((step, index) => {
                  const isActive = index === currentStep;
                  const isCompleted = index < currentStep;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setCurrentStep(index)}
                      aria-current={isActive ? "step" : undefined}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/30",
                        isActive
                          ? "border-cyan-300 bg-cyan-50 shadow-sm dark:border-cyan-700 dark:bg-cyan-950/30"
                          : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/70",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
                          isActive &&
                            "border-cyan-200 bg-cyan-600 text-white dark:border-cyan-700",
                          isCompleted &&
                            !isActive &&
                            "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
                          !isActive &&
                            !isCompleted &&
                            "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          step.icon
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Adim {index + 1}
                        </p>
                        <p
                          className={cn(
                            "mt-0.5 truncate text-sm font-bold",
                            isActive
                              ? "text-cyan-900 dark:text-cyan-100"
                              : "text-slate-800 dark:text-slate-200",
                          )}
                        >
                          {step.label}
                        </p>
                      </div>
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform",
                          isActive
                            ? "translate-x-0.5 text-cyan-600"
                            : "text-slate-300 group-hover:translate-x-0.5 group-hover:text-slate-500",
                        )}
                      />
                    </button>
                  );
                })}
              </CardContent>

              <div className="border-t border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl border border-slate-200 bg-white px-2 py-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-lg font-black text-slate-950 dark:text-white">
                      {previewRiskItems.length}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Risk
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-2 py-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-lg font-black text-slate-950 dark:text-white">
                      {previewActions.length}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Faaliyet
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </aside>

          <main className="min-w-0">
            <Card className="overflow-hidden rounded-[24px] border-slate-200/80 bg-white shadow-lg shadow-slate-950/[0.04] dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-cyan-50/50 px-4 py-4 sm:px-6 lg:px-7 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-cyan-950/20 xl:hidden">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {WIZARD_STEPS.map((step, index) => {
                    const isActive = index === currentStep;
                    const isCompleted = index < currentStep;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => setCurrentStep(index)}
                        className={cn(
                          "flex min-w-[132px] items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition",
                          isActive
                            ? "border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-100"
                            : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                            isActive
                              ? "bg-cyan-600 text-white"
                              : isCompleted
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                          )}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            step.icon
                          )}
                        </span>
                        <span className="truncate text-xs font-bold">
                          {step.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <CardHeader className="border-b border-slate-200/80 px-4 py-5 sm:px-6 lg:px-7 dark:border-slate-800">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
                      {WIZARD_STEPS[currentStep].icon}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-400">
                        Adim {currentStep + 1} / {WIZARD_STEPS.length}
                      </p>
                      <CardTitle className="mt-1 text-xl text-slate-950 sm:text-2xl dark:text-white">
                        {WIZARD_STEPS[currentStep].title}
                      </CardTitle>
                      <CardDescription className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {WIZARD_STEPS[currentStep].description}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    Otomatik taslak açık
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-6 lg:p-7">
                {renderStepContent()}
              </CardContent>

              <div className="border-t border-slate-200/80 bg-slate-50/80 px-4 py-4 sm:px-6 lg:px-7 dark:border-slate-800 dark:bg-slate-950/30">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrev}
                    disabled={currentStep === 0}
                    className="h-11 rounded-xl border-slate-300 bg-white px-5 text-slate-700 shadow-sm hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Önceki Adim
                  </Button>

                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSaveDraft}
                      className="h-11 rounded-xl border-slate-300 bg-white px-5 text-slate-700 shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Taslagi Kaydet
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetWizard}
                      className="h-11 rounded-xl border-rose-200 bg-rose-50 px-5 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Taslagi Temizle
                    </Button>
                    {currentStep < WIZARD_STEPS.length - 1 ? (
                      <Button
                        type="button"
                        onClick={handleNext}
                        className="h-11 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 text-white shadow-lg shadow-cyan-600/15 hover:from-cyan-500 hover:to-blue-500"
                      >
                        Sonraki Adim
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleRiskTemplateDownload}
                        disabled={
                          !wordTemplateAvailable ||
                          checkingTemplate ||
                          exportingWord ||
                          previewRiskItems.length === 0
                        }
                        className="h-11 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 text-white shadow-lg shadow-violet-600/15 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50"
                      >
                        {exportingWord ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FileDown className="mr-2 h-4 w-4" />
                        )}
                        Word Raporunu Olustur
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </main>
        </div>
      </div>
      <Dialog
        open={riskTemplateDialogOpen}
        onOpenChange={setRiskTemplateDialogOpen}
      >
        <DialogContent className="max-w-3xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle>Risk Sablonlari</DialogTitle>
            <DialogDescription className="text-slate-400">
              Kayitli risk sablonlarindan birini tek tikla Risk Degerlendirme
              Tablosu’na aktarin.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {!profile?.organization_id ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 p-6 text-sm text-slate-400">
                Risk sablonlarini kullanmak için organizasyon bilgisi
                bulunmalidir.
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
                const itemCount = Array.isArray(template.payload?.items)
                  ? template.payload.items.length
                  : 0;
                return (
                  <div
                    key={template.id}
                    className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {template.name}
                        </p>
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
                        className="rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400"
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
