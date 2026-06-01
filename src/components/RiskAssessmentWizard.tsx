import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
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
import { generateSectorRiskTemplates } from "@/lib/risk/sectorRiskTemplates";
import { getSectorMinimumRiskItemCount, RISK_TEMPLATE_CONFIGS } from "@/lib/risk/riskTemplateConfig";
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
  certificateNo?: string;
};

type RiskTeamOsgb = {
  title: string;
  phone: string;
  email: string;
  authorizedPerson: string;
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

type WizardStep = {
  id: string;
  label: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

type RiskAssessmentWizardDraft = {
  currentStep: number;
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
    label: "Firma ve İşyeri Bilgileri",
    title: "Firma ve İşyeri Bilgileri",
    description: "Kapakta ve üst bilgi alanlarında yer alacak temel bilgileri girin.",
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    id: "team",
    label: "Risk Değerlendirme Ekibi",
    title: "İşyerine Ait Bilgiler ve Risk Değerlendirme Ekibi",
    description: "Resmî ekip tablosunda yer alacak ekip üyelerini tanımlayın.",
    icon: <Users className="h-5 w-5" />,
  },
  {
    id: "scope",
    label: "Kapsam ve Yöntem",
    title: "Değerlendirme Kapsamı ve Yöntem",
    description: "Kapsamı, değerlendirilen faaliyetleri ve puanlama açıklamasını oluşturun.",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    id: "risk-method",
    label: "Risk Ekleme Yöntemi",
    title: "Risk Ekleme Yöntemi",
    description: "Riskleri nasıl eklemek istediğinizi seçin.",
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    id: "risk-table",
    label: "Risk Değerlendirme Tablosu",
    title: "Risk Değerlendirme Tablosu",
    description: "Seçtiğiniz yönteme göre oluşan risk maddelerini düzenleyin.",
    icon: <AlertTriangle className="h-5 w-5" />,
  },
  {
    id: "actions",
    label: "Faaliyet Planı",
    title: "Öncelikli Düzeltici / Önleyici Faaliyet Planı",
    description: "Plan satırlarını yalnızca ihtiyaç duyduğunuz kadar oluşturun.",
    icon: <ListChecks className="h-5 w-5" />,
  },
  {
    id: "conclusion",
    label: "Sonuç ve İmzalar",
    title: "Genel Sonuç, Onay ve İmzalar",
    description: "Onay metinlerini ve imza tablosunu tamamlayın.",
    icon: <PenSquare className="h-5 w-5" />,
  },
  {
    id: "preview",
    label: "Önizleme ve Rapor",
    title: "Önizleme ve Rapor Oluştur",
    description: "Özeti kontrol edin, taslağı saklayın ve rapor çıktısını alın.",
    icon: <Eye className="h-5 w-5" />,
  },
];

const RISK_METHOD_STEP_INDEX = WIZARD_STEPS.findIndex((step) => step.id === "risk-method");
const RISK_TABLE_STEP_INDEX = WIZARD_STEPS.findIndex((step) => step.id === "risk-table");

const REQUIRED_COMPANY_FIELDS: Array<keyof RiskWizardCompanyInfo> = [
  "companyTitle",
  "hazardClass",
  "employeeCount",
  "assessmentDate",
  "activityScope",
  "riskMethod",
];

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
});

const emptyTeamInfo = (): RiskWizardTeamInfo => ({
  employer: emptyTeamPerson(),
  employeeRepresentative: emptyTeamPerson(),
  safetyExpert: emptyTeamPerson(),
  workplaceDoctor: emptyTeamPerson(),
  osgb: emptyOsgbInfo(),
});

const FIXED_METHOD_DESCRIPTION =
  "Risk puanı = Olasılık x Şiddet. Risk düzeyleri: 1-4 Düşük, 5-9 Orta, 10-15 Yüksek, 16-25 Çok Yüksek olarak kabul edilmiştir. Kontrol tedbirlerinde öncelik sırası; tehlikeyi ortadan kaldırma, ikame, mühendislik kontrolü, idari kontrol ve kişisel koruyucu donanım şeklindedir.";

const emptyScopeInfo = (): RiskWizardScopeInfo => ({
  evaluatedSections: "",
  assessmentScopeItems: [""],
});

const emptyConclusionInfo = (): RiskWizardConclusionInfo => ({
  generalConclusion:
    "Bu risk değerlendirmesi, işyerinde beyan edilen faaliyet kapsamı ve mevcut çalışma koşulları dikkate alınarak hazırlanmıştır. Belirlenen ilave tedbirlerin uygulanması ve tamamlanan faaliyetler sonrası risk seviyelerinin yeniden değerlendirilmesi önerilir.",
  conclusionItems: [
    "Bu risk değerlendirmesi, işyerinde beyan edilen faaliyet kapsamı ve mevcut çalışma koşulları dikkate alınarak hazırlanmıştır.",
    "Belirlenen ilave tedbirlerin uygulanması ve tamamlanan faaliyetler sonrası risk seviyelerinin yeniden değerlendirilmesi önerilir.",
    "Risk değerlendirmesi, işyerinde önemli değişiklik olması veya mevzuat gereği yenilenmesi gereken durumlarda güncellenmelidir.",
  ],
  approvalNote: "",
  preparedBy: "",
  approvedBy: "",
  signatureDate: today,
});

const cleanText = (value?: string | null) => (value || "").replace(/\s+/g, " ").trim();
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
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "risk-degerlendirme";

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeLegacyTeamPerson = (value: unknown): RiskTeamPerson => {
  if (value && typeof value === "object") {
    const candidate = value as Partial<RiskTeamPerson>;
    return {
      fullName: cleanText(candidate.fullName),
      tcNo: cleanText(candidate.tcNo),
      phone: cleanText(candidate.phone),
      certificateNo: cleanText(candidate.certificateNo),
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

const getRiskLevelFromScore = (score: number) => {
  if (score >= 16) return "Çok Yüksek";
  if (score >= 10) return "Yüksek";
  if (score >= 5) return "Orta";
  if (score >= 1) return "Düşük";
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
    affectedPeople: "Çalışanlar, ziyaretçiler ve ilgili üçüncü kişiler",
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
  doc.text("İŞ SAĞLIĞI VE GÜVENLİĞİ", pageWidth / 2, 24, { align: "center" });
  doc.text("RİSK DEĞERLENDİRMESİ RAPORU", pageWidth / 2, 32, { align: "center" });

  const companyTitleBlock = drawCenteredWrappedText(
    doc,
    cleanText(companyInfo.companyTitle) || "FİRMA ÜNVANI",
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

  addWizardPdfSectionTitle(doc, cursorY, "1. İŞYERİNE AİT BİLGİLER VE RİSK DEĞERLENDİRME EKİBİ");
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
  addWizardPdfSectionTitle(doc, cursorY, "2. DEĞERLENDİRME KAPSAMI");
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
    const scopeLines = doc.splitTextToSize("Değerlendirme kapsamı belirtilmemiştir.", 178) as string[];
    doc.text(scopeLines, 14, cursorY);
    cursorY += scopeLines.length * 5 + 8;
  }
  if (cleanText(scopeInfo.evaluatedSections)) {
    doc.setFont("Inter", "bold");
    doc.text("Değerlendirilen Bölümler / Faaliyetler", 14, cursorY);
    cursorY += 5.5;
    doc.setFont("Inter", "normal");
    const evaluatedLines = doc.splitTextToSize(cleanText(scopeInfo.evaluatedSections), 178) as string[];
    doc.text(evaluatedLines, 14, cursorY);
    cursorY += evaluatedLines.length * 5 + 8;
  }

  cursorY = ensurePdfPage(doc, cursorY, 36);
  addWizardPdfSectionTitle(doc, cursorY, "3. RİSK PUANLAMA METODU");
  cursorY += 13;
  const methodLines = doc.splitTextToSize(FIXED_METHOD_DESCRIPTION, 178) as string[];
  doc.text(methodLines, 14, cursorY);
  cursorY += methodLines.length * 5 + 6;
  autoTable(doc, {
    startY: cursorY,
    margin: { left: 14, right: 14 },
    head: [["Puan", "Olasılık", "Açıklama", "Şiddet", "Açıklama"]],
    body: [
      ["1", "Çok düşük", "Beklenmez/çok seyrek", "Çok hafif", "İlk yardım gerektirmeyen küçük durum"],
      ["2", "Düşük", "Seyrek", "Hafif", "İlk yardım, kısa süreli rahatsızlık"],
      ["3", "Orta", "Ara sıra", "Orta", "Tıbbi müdahale, iş günü kaybı ihtimali"],
      ["4", "Yüksek", "Sık", "Ciddi", "Ciddi yaralanma, kalıcı etki ihtimali"],
      ["5", "Çok yüksek", "Çok sık/kaçınılmaz", "Çok ciddi", "Ölüm, ağır yaralanma veya büyük hasar"],
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
  addWizardPdfSectionTitle(doc, 12, "4. RİSK DEĞERLENDİRME TABLOSU");
  autoTable(doc, {
    startY: 24,
    margin: { left: 8, right: 8, bottom: 12 },
    head: [[
      "No",
      "Bölüm / Faaliyet",
      "Tehlike Kaynağı",
      "Risk / Olası Sonuç",
      "Etkilenenler",
      "Mevcut Önlem",
      "O",
      "Ş",
      "R",
      "Düzey",
      "Alınacak İlave Önlemler",
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
  addWizardPdfSectionTitle(doc, 12, "5. ÖNCELİKLİ DÜZELTİCİ / ÖNLEYİCİ FAALİYET PLANI");
  autoTable(doc, {
    startY: 24,
    margin: { left: 10, right: 10, bottom: 12 },
    head: [["No", "Tespit / Risk", "Yapılacak Faaliyet", "Sorumlu", "Termin", "Durum"]],
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
      ["Hazırlayan", cleanText(draft.conclusionInfo.preparedBy)],
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
  addWizardPdfSectionTitle(doc, cursorY, "7. İMZALAR");
  autoTable(doc, {
    startY: cursorY + 12,
    margin: { left: 14, right: 14, bottom: 16 },
    head: [["Adı Soyadı", "Görevi", "Belge / İletişim Bilgisi", "İmza"]],
    body:
      signatureRows.length > 0
        ? signatureRows.map((row) => [cleanText(row.fullName), cleanText(row.role), cleanText(row.documentOrContact), ""])
        : [["", "İmza satırı eklenmedi.", "", ""]],
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
  const { profile } = useAuth();
  const location = useLocation();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const locationState = location.state as { assessmentId?: string | null; companyId?: string | null } | null;
  const importAssessmentId = locationState?.assessmentId || null;

  const [currentStep, setCurrentStep] = useState(0);
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
      scopeInfo.assessmentScopeItems.some((item) => Boolean(cleanText(item))) ||
      riskItems.length > 0 ||
      correctiveActions.length > 0 ||
      signatureRows.length > 0 ||
      Boolean(riskAdditionMethod) ||
      currentStep > 0,
    onRestore: (draft) => {
      setCurrentStep(Math.min(Math.max(draft.currentStep || 0, 0), WIZARD_STEPS.length - 1));
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
      toast.error("Risk şablonları yüklenemedi.");
    } finally {
      setLoadingRiskTemplates(false);
    }
  };

  useEffect(() => {
    if (!riskTemplateDialogOpen) return;
    void fetchRiskTemplates();
  }, [profile?.organization_id, riskTemplateDialogOpen]);

  const previewRiskItems = useMemo(() => buildRiskItemsSummary(riskItems), [riskItems]);
  const previewActions = useMemo(() => buildCorrectiveActionsSummary(correctiveActions), [correctiveActions]);
  const previewSignatureRows = useMemo(
    () => (signatureRows.length > 0 ? signatureRows : buildSignatureRowsFromTeam(teamInfo)),
    [signatureRows, teamInfo],
  );

  const progressRatio = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  const validationState = useMemo(() => {
    const missingCompanyFields = REQUIRED_COMPANY_FIELDS.filter((field) => !cleanText(String(companyInfo[field] || "")));
    return {
      companyStepValid: missingCompanyFields.length === 0,
      missingCompanyFields,
    };
  }, [companyInfo]);

  const isStepValid = (stepIndex: number) => {
    if (stepIndex === 0 && !validationState.companyStepValid) {
      return {
        valid: false,
        message: "Lütfen zorunlu firma ve işyeri bilgilerini doldurun.",
      };
    }
    return { valid: true };
  };

  const resetWizard = () => {
    clearDraft();
    setCurrentStep(0);
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
    setTouched({});
    toast.success("Risk değerlendirme taslağı temizlendi.");
  };

  const touchField = (key: string) => setTouched((prev) => ({ ...prev, [key]: true }));

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
      toast.error("AI ile risk üretmek için sektör, faaliyet kapsamı veya kısa bir işyeri açıklaması girin.");
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
      toast.info("AI servisi yanıt veremedi; sektör bazlı hazır risk paketi tabloya eklendi.");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleRiskAdditionMethodSelect = (method: RiskAdditionMethod) => {
    setRiskAdditionMethod(method);

    if (method === "manual") {
      if (riskItems.length === 0) addRiskItem();
      setCurrentStep(RISK_TABLE_STEP_INDEX);
      return;
    }

    if (method === "templates") {
      setRiskTemplateDialogOpen(true);
      return;
    }

    if (method === "saved") {
      if (!importAssessmentId) {
        toast.info("Kayıtlı riskleri aktarmak için wizard mevcut bir risk değerlendirmesi üzerinden açılmalıdır.");
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
    toast.success("İmza satırları ekip bilgilerinden yeniden oluşturuldu.");
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
      toast.error("Sadece PNG veya JPG formatında logo yükleyebilirsiniz.");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo dosyası en fazla 2 MB olabilir.");
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
      toast.success("Logo önizlemesi hazırlandı.");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const importRiskItemsFromAssessment = async () => {
    if (!importAssessmentId) {
      toast.error("RiskAssessmentEditor aktarımı için assessmentId bulunamadı.");
      return;
    }
    setImportingRiskItems(true);
    try {
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
      setRiskAdditionMethod("saved");
      setCurrentStep(RISK_TABLE_STEP_INDEX);
      toast.success(`${mappedItems.length} risk maddesi editörden aktarıldı.`);
    } catch (error) {
      console.error("Risk wizard import error", error);
      toast.error("Risk maddeleri aktarılamadı.");
    } finally {
      setImportingRiskItems(false);
    }
  };

  const applyRiskTemplateToWizard = (template: RiskAssessmentTemplateRecord) => {
    const templateItems = Array.isArray(template.payload?.items) ? template.payload.items : [];
    if (templateItems.length === 0) {
      toast.error("Seçilen şablonda aktarılacak risk maddesi bulunamadı.");
      return;
    }

    const mappedItems = templateItems.map((item, index) => mapTemplateRiskItemToWizardRow(item, index));
    setRiskItems(mappedItems);
    setRiskAdditionMethod("templates");
    setCurrentStep(RISK_TABLE_STEP_INDEX);
    setRiskTemplateDialogOpen(false);
    toast.success(`"${template.name}" şablonundan ${mappedItems.length} risk maddesi tabloya aktarıldı.`);
  };

  const handleSaveDraft = () => {
    toast.success("Taslak kaydedildi.", {
      description: "Girilen bilgiler adımlar arasında ve tekrar girişte korunacaktır.",
    });
  };

  const handleExportPdf = async () => {
    if (!validationState.companyStepValid) {
      REQUIRED_COMPANY_FIELDS.forEach((field) => touchField(String(field)));
      toast.error("PDF oluşturmadan önce zorunlu firma ve işyeri bilgilerini tamamlayın.");
      setCurrentStep(0);
      return;
    }
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
      toast.success("Risk değerlendirme raporu PDF olarak hazırlandı.");
    } catch (error) {
      console.error("Risk wizard PDF error", error);
      toast.error("PDF raporu oluşturulamadı.");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleWordDownload = async () => {
    if (!validationState.companyStepValid) {
      REQUIRED_COMPANY_FIELDS.forEach((field) => touchField(String(field)));
      toast.error("Word çıktısı oluşturmadan önce zorunlu firma ve işyeri bilgilerini tamamlayın.");
      setCurrentStep(0);
      return;
    }

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
      toast.success("Risk değerlendirme raporu Word şablonu ile hazırlandı.");
    } catch (error) {
      console.error("Risk wizard DOCX error", error);
      toast.error("Word çıktısı oluşturulamadı.");
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
        <Label className={cn("text-xs font-semibold uppercase tracking-wider text-slate-400", isError && "text-red-400")}>
          {label}
        </Label>
        <Input
          type={options?.type || "text"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={options?.placeholder}
          className={cn(
            "h-11 rounded-xl border-slate-800 bg-slate-900/50 text-slate-100 placeholder:text-slate-600",
            isError && "border-red-500/50 bg-red-950/10",
          )}
        />
        {isError ? <p className="text-xs text-red-400">Bu alan zorunludur.</p> : null}
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-cyan-500/10 bg-cyan-500/5 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-400">Adım 1</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Resmî kapak ve üst bilgi alanları için firma ve işyeri bilgilerini doldurun. Not alanı
                opsiyoneldir; boş bırakılırsa çıktıda hiç görünmez.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {renderInput("Firma Ünvanı *", companyInfo.companyTitle, (value) => updateCompanyInfo("companyTitle", value), {
                placeholder: "Firma ünvanı",
                required: true,
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tehlike Sınıfı *</Label>
                <Select value={companyInfo.hazardClass} onValueChange={(value) => updateCompanyInfo("hazardClass", value as HazardClass)}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-800 bg-slate-900/50 text-slate-100">
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-100">
                    <SelectItem value="Az Tehlikeli">Az Tehlikeli</SelectItem>
                    <SelectItem value="Tehlikeli">Tehlikeli</SelectItem>
                    <SelectItem value="Çok Tehlikeli">Çok Tehlikeli</SelectItem>
                  </SelectContent>
                </Select>
                {touched.companyTitle && !cleanText(companyInfo.hazardClass) ? <p className="text-xs text-red-400">Bu alan zorunludur.</p> : null}
              </div>
              {renderInput("Çalışan Sayısı *", companyInfo.employeeCount, (value) => updateCompanyInfo("employeeCount", value), {
                placeholder: "Çalışan sayısı",
                required: true,
                errorKey: "employeeCount",
              })}
              {renderInput("Değerlendirme Tarihi *", companyInfo.assessmentDate, (value) => updateCompanyInfo("assessmentDate", value), {
                type: "date",
                required: true,
                errorKey: "assessmentDate",
              })}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Risk Değerlendirme Yöntemi *</Label>
                <Select value={companyInfo.riskMethod} onValueChange={(value) => updateCompanyInfo("riskMethod", value as RiskMethod)}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-800 bg-slate-900/50 text-slate-100">
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-100">
                    <SelectItem value="5x5 Matris">5x5 Matris</SelectItem>
                    <SelectItem value="Fine-Kinney">Fine-Kinney</SelectItem>
                    <SelectItem value="L Tipi Matris">L Tipi Matris</SelectItem>
                    <SelectItem value="Diğer">Diğer</SelectItem>
                  </SelectContent>
                </Select>
                {touched.riskMethod && !cleanText(companyInfo.riskMethod) ? <p className="text-xs text-red-400">Bu alan zorunludur.</p> : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Faaliyet Kapsamı *</Label>
              <Textarea
                value={companyInfo.activityScope}
                onChange={(event) => updateCompanyInfo("activityScope", event.target.value)}
                placeholder="Faaliyet kapsamını kısa ve net biçimde yazın"
                className="min-h-[110px] rounded-2xl border-slate-800 bg-slate-900/50 text-slate-100 placeholder:text-slate-600"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Not</Label>
              <Textarea
                value={companyInfo.note}
                onChange={(event) => updateCompanyInfo("note", event.target.value)}
                placeholder="Opsiyonel not"
                className="min-h-[90px] rounded-2xl border-slate-800 bg-slate-900/50 text-slate-100 placeholder:text-slate-600"
              />
              <p className="text-xs text-slate-500">Boş bırakılırsa çıktıda Not alanı hiç gösterilmez.</p>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Risk Analizi Logosu</Label>
                <p className="mt-1 text-xs text-slate-500">Logo eklerseniz PDF çıktısının üst bölümünde gösterilir.</p>
              </div>
              {logo ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
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
                  className="w-full rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 p-8 text-center hover:border-cyan-500/30 hover:bg-cyan-500/5"
                >
                  <FileText className="mx-auto h-7 w-7 text-cyan-400" />
                  <p className="mt-3 text-sm font-semibold text-slate-200">PNG veya JPG logo seçin</p>
                  <p className="mt-1 text-xs text-slate-500">Maksimum 2 MB</p>
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
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Adım 2</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Bu bilgiler mevcut “İşyerine Ait Bilgiler ve Risk Değerlendirme Ekibi” bölümündeki ilgili
                satırlara yazdırılır. Boş alanlar hücreyi boş bırakır.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 space-y-4">
                <p className="text-sm font-bold text-white">İşveren</p>
                {renderInput("Ad - Soyad", teamInfo.employer.fullName, (value) => updateTeamPerson("employer", "fullName", value), {
                  placeholder: "İşveren ad soyad",
                })}
                {renderInput("T.C. Kimlik Numarası", teamInfo.employer.tcNo, (value) => updateTeamPerson("employer", "tcNo", value), {
                  placeholder: "T.C. kimlik numarası",
                })}
                {renderInput("Telefon Numarası", teamInfo.employer.phone, (value) => updateTeamPerson("employer", "phone", value), {
                  placeholder: "Telefon numarası",
                })}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 space-y-4">
                <p className="text-sm font-bold text-white">Çalışan Temsilcisi</p>
                {renderInput("Ad - Soyad", teamInfo.employeeRepresentative.fullName, (value) => updateTeamPerson("employeeRepresentative", "fullName", value), {
                  placeholder: "Çalışan temsilcisi ad soyad",
                })}
                {renderInput("T.C. Kimlik Numarası", teamInfo.employeeRepresentative.tcNo, (value) => updateTeamPerson("employeeRepresentative", "tcNo", value), {
                  placeholder: "T.C. kimlik numarası",
                })}
                {renderInput("Telefon Numarası", teamInfo.employeeRepresentative.phone, (value) => updateTeamPerson("employeeRepresentative", "phone", value), {
                  placeholder: "Telefon numarası",
                })}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 space-y-4">
                <p className="text-sm font-bold text-white">İş Güvenliği Uzmanı</p>
                {renderInput("Ad - Soyad", teamInfo.safetyExpert.fullName, (value) => updateTeamPerson("safetyExpert", "fullName", value), {
                  placeholder: "İş güvenliği uzmanı ad soyad",
                })}
                {renderInput("T.C. Kimlik Numarası", teamInfo.safetyExpert.tcNo, (value) => updateTeamPerson("safetyExpert", "tcNo", value), {
                  placeholder: "T.C. kimlik numarası",
                })}
                {renderInput("Telefon Numarası", teamInfo.safetyExpert.phone, (value) => updateTeamPerson("safetyExpert", "phone", value), {
                  placeholder: "Telefon numarası",
                })}
                {renderInput("Sertifika No", teamInfo.safetyExpert.certificateNo || "", (value) => updateTeamPerson("safetyExpert", "certificateNo", value), {
                  placeholder: "Sertifika numarası",
                })}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 space-y-4">
                <p className="text-sm font-bold text-white">İşyeri Hekimi</p>
                {renderInput("Ad - Soyad", teamInfo.workplaceDoctor.fullName, (value) => updateTeamPerson("workplaceDoctor", "fullName", value), {
                  placeholder: "İşyeri hekimi ad soyad",
                })}
                {renderInput("T.C. Kimlik Numarası", teamInfo.workplaceDoctor.tcNo, (value) => updateTeamPerson("workplaceDoctor", "tcNo", value), {
                  placeholder: "T.C. kimlik numarası",
                })}
                {renderInput("Telefon Numarası", teamInfo.workplaceDoctor.phone, (value) => updateTeamPerson("workplaceDoctor", "phone", value), {
                  placeholder: "Telefon numarası",
                })}
                {renderInput("Sertifika No", teamInfo.workplaceDoctor.certificateNo || "", (value) => updateTeamPerson("workplaceDoctor", "certificateNo", value), {
                  placeholder: "Sertifika numarası",
                })}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 space-y-4 md:col-span-2">
                <p className="text-sm font-bold text-white">OSGB</p>
                <div className="grid gap-4 md:grid-cols-2">
                  {renderInput("OSGB Unvanı", teamInfo.osgb.title, (value) => updateTeamOsgb("title", value), {
                    placeholder: "OSGB unvanı",
                  })}
                  {renderInput("Telefon Numarası", teamInfo.osgb.phone, (value) => updateTeamOsgb("phone", value), {
                    placeholder: "Telefon numarası",
                  })}
                  {renderInput("E-posta", teamInfo.osgb.email, (value) => updateTeamOsgb("email", value), {
                    placeholder: "E-posta adresi",
                    type: "email",
                  })}
                  {renderInput("Yetkili Kişi", teamInfo.osgb.authorizedPerson, (value) => updateTeamOsgb("authorizedPerson", value), {
                    placeholder: "Yetkili kişi",
                  })}
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Adım 3</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Değerlendirme kapsamını madde madde girin. Risk puanlama yöntemi bölümünde PDF’te her zaman sabit 5x5 tablo basılır.
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
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 p-6 text-sm text-slate-400">
                  Henüz kapsam maddesi eklenmedi.
                </div>
              ) : (
                scopeInfo.assessmentScopeItems.map((item, index) => (
                  <div key={`scope-${index}`} className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge className="rounded-full border border-slate-800 bg-slate-950 text-slate-300">Kapsam Maddesi #{index + 1}</Badge>
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
                      placeholder="Değerlendirme kapsamı maddesi"
                      className="min-h-[90px] rounded-2xl border-slate-800 bg-slate-900/50 text-slate-100 placeholder:text-slate-600"
                    />
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Değerlendirilen Bölümler / Faaliyetler
              </Label>
              <Textarea
                value={scopeInfo.evaluatedSections}
                onChange={(event) => updateScopeInfo("evaluatedSections", event.target.value)}
                placeholder="Örn: Üretim hattı, depo, sevkiyat alanı"
                className="min-h-[100px] rounded-2xl border-slate-800 bg-slate-900/50 text-slate-100 placeholder:text-slate-600"
              />
            </div>
            <Card className="border-slate-800 bg-slate-950/40">
              <CardHeader>
                <CardTitle className="text-sm text-white">PDF’te Sabit Görünecek Risk Puanlama Metodu</CardTitle>
                <CardDescription className="text-slate-400">
                  Kapakta seçtiğiniz yöntem yazmaya devam eder; ancak resmi şablon gereği bu raporda sabit 5x5 puanlama açıklaması ve tablosu kullanılır.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-300 leading-relaxed">
                {FIXED_METHOD_DESCRIPTION}
              </CardContent>
            </Card>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-violet-500/10 bg-violet-500/5 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-violet-300">Adım 4</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Riskleri tek merkezden ekleyin: AI ile üretin, manuel satır açın, şablonlardan aktarın veya kayıtlı
                risklerinizi tabloya taşıyın.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  id: "ai" as const,
                  title: "Yapay Zeka Sohbeti ile Risk Üret",
                  description: "AI önce işyeriniz hakkında bağlam alır, sonra sektör odaklı riskleri tabloya ekler.",
                  icon: <Sparkles className="h-6 w-6" />,
                  accent: "from-fuchsia-500 to-violet-600",
                  badge: "ÖNERİLEN",
                  items: ["Sektör ve faaliyet odaklı üretim", "Hazır risk paketiyle güvenli yedek", "Tabloya tek tıkla aktarım"],
                },
                {
                  id: "manual" as const,
                  title: "Manuel Seçim",
                  description: "Risk kütüphanesinden veya kendi saha notlarınızdan satırları kendiniz girin.",
                  icon: <BookOpen className="h-6 w-6" />,
                  accent: "from-emerald-500 to-teal-600",
                  items: ["Boş risk satırı oluşturma", "Tam kontrol", "Anında düzenleme"],
                },
                {
                  id: "templates" as const,
                  title: "Şablonlar & Paylaşılanlar",
                  description: "Kayıtlı şablonlarınızı veya paylaşılan risk paketlerini hızlıca kullanın.",
                  icon: <Archive className="h-6 w-6" />,
                  accent: "from-amber-500 to-orange-600",
                  items: ["Şablon kütüphanesi", "Tek tıkla aktarma", "Sektör paketleri"],
                },
                {
                  id: "saved" as const,
                  title: "Kayıtlı Risklerim",
                  description: "Daha önce oluşturduğunuz risk maddelerini mevcut rapora aktarın.",
                  icon: <FolderOpen className="h-6 w-6" />,
                  accent: "from-blue-500 to-cyan-600",
                  items: ["Mevcut değerlendirmeden aktarım", "Arama ve filtreleme için hazır yapı", "Toplu ekleme"],
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
                      : "border-slate-800 bg-slate-900/25",
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
                  <h4 className="text-base font-black leading-snug text-white">{method.title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{method.description}</p>
                  <ul className="mt-4 space-y-2 text-xs text-slate-300">
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

            <Card className="border-slate-800 bg-slate-950/50">
              <CardHeader>
                <CardTitle className="text-base text-white">AI ile Risk Üretim Alanı</CardTitle>
                <CardDescription className="text-slate-400">
                  İsterseniz kısa bir sektör/saha açıklaması girin. AI yanıt veremezse sistem sektör bazlı hazır risk
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
                      <SelectTrigger className="h-11 rounded-xl border-slate-800 bg-slate-900/50 text-slate-100">
                        <SelectValue placeholder="Sektör seçin veya aşağıya açıklama yazın" />
                      </SelectTrigger>
                      <SelectContent className="max-h-80 border-slate-800 bg-slate-950 text-slate-100">
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
                    placeholder="Örn: 3 katlı şantiye, iskele ve geçici elektrik var; taşeron ekipler çalışıyor."
                    className="min-h-[100px] rounded-2xl border-slate-800 bg-slate-900/50 text-slate-100 placeholder:text-slate-600"
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-relaxed text-slate-500">
                    Sonraki adımda oluşturulan tüm risk maddelerini düzenleyebilir, silebilir veya yeni satır ekleyebilirsiniz.
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
              <p className="text-[11px] font-bold uppercase tracking-widest text-rose-400">Adım 5</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Risk tablosu yalnızca eklediğiniz veya aktardığınız satırlar kadar oluşturulur. Boş şablon satırı
                basılmaz.
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
                disabled={!importAssessmentId || importingRiskItems}
                onClick={importRiskItemsFromAssessment}
                className="rounded-xl border-cyan-500/20 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
              >
                {importingRiskItems ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Kayıtlı Riskleri Aktar
              </Button>
            </div>
            {!importAssessmentId ? (
              <p className="text-xs text-slate-500">
                Kayıtlı risk aktarımı için sihirbaz mevcut bir risk değerlendirmesi üzerinden açılmalıdır.
              </p>
            ) : null}

            <div className="space-y-4">
              {riskItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 p-6 text-sm text-slate-400">
                  Henüz risk maddesi eklenmedi. İsterseniz manuel satır ekleyin, AI ile üretin veya kayıtlı riskleri aktarın.
                </div>
              ) : (
                riskItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge className="rounded-full border border-slate-800 bg-slate-950 text-slate-300">Risk Maddesi #{item.no}</Badge>
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
                      {renderInput("Tehlike Kaynağı", item.hazardSource, (value) => updateRiskItem(item.id, "hazardSource", value))}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Risk / Olası Sonuç</Label>
                        <Textarea
                          value={item.riskConsequence}
                          onChange={(event) => updateRiskItem(item.id, "riskConsequence", event.target.value)}
                          className="min-h-[90px] rounded-2xl border-slate-800 bg-slate-900/50 text-slate-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Etkilenenler</Label>
                        <Textarea
                          value={item.affectedPeople}
                          onChange={(event) => updateRiskItem(item.id, "affectedPeople", event.target.value)}
                          className="min-h-[90px] rounded-2xl border-slate-800 bg-slate-900/50 text-slate-100"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mevcut Önlem</Label>
                        <Textarea
                          value={item.currentMeasure}
                          onChange={(event) => updateRiskItem(item.id, "currentMeasure", event.target.value)}
                          className="min-h-[90px] rounded-2xl border-slate-800 bg-slate-900/50 text-slate-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Alınacak İlave Önlemler
                        </Label>
                        <Textarea
                          value={item.additionalMeasures}
                          onChange={(event) => updateRiskItem(item.id, "additionalMeasures", event.target.value)}
                          className="min-h-[90px] rounded-2xl border-slate-800 bg-slate-900/50 text-slate-100"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-5">
                      {renderInput("O", item.probability, (value) => updateRiskItem(item.id, "probability", value), { type: "number" })}
                      {renderInput("Ş", item.severity, (value) => updateRiskItem(item.id, "severity", value), { type: "number" })}
                      {renderInput("R", item.riskScore, (value) => updateRiskItem(item.id, "riskScore", value), { type: "number" })}
                      {renderInput("Düzey", item.riskLevel, (value) => updateRiskItem(item.id, "riskLevel", value))}
                      {renderInput("Termin", item.deadline, (value) => updateRiskItem(item.id, "deadline", value), { type: "date" })}
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
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Adım 6</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Faaliyet planı tablosu yalnızca eklediğiniz satırlardan oluşur. Boş satırlar çıktıdan tamamen çıkarılır.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button type="button" onClick={addCorrectiveAction} className="rounded-xl bg-violet-600 text-white hover:bg-violet-700">
                <Plus className="mr-2 h-4 w-4" />
                Faaliyet Ekle
              </Button>
            </div>

            {correctiveActions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 p-6 text-sm text-slate-400">
                Henüz faaliyet eklenmedi. İsterseniz bu adımı boş bırakabilirsiniz.
              </div>
            ) : (
              <div className="space-y-4">
                {correctiveActions.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge className="rounded-full border border-slate-800 bg-slate-950 text-slate-300">Faaliyet #{item.no}</Badge>
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
                      {renderInput("Yapılacak Faaliyet", item.action, (value) => updateCorrectiveAction(item.id, "action", value))}
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
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Adım 7</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Genel sonuç maddelerini ekleyin ve imza satırlarını ekip üyelerinden otomatik oluşturun veya elle yönetin.
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
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 p-6 text-sm text-slate-400">
                  Henüz sonuç maddesi eklenmedi.
                </div>
              ) : (
                conclusionInfo.conclusionItems.map((item, index) => (
                  <div key={`conclusion-${index}`} className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge className="rounded-full border border-slate-800 bg-slate-950 text-slate-300">Sonuç Maddesi #{index + 1}</Badge>
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
                      className="min-h-[90px] rounded-2xl border-slate-800 bg-slate-900/50 text-slate-100"
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
                className="min-h-[90px] rounded-2xl border-slate-800 bg-slate-900/50 text-slate-100"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {renderInput("Hazırlayan", conclusionInfo.preparedBy, (value) => updateConclusionInfo("preparedBy", value))}
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
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 p-6 text-sm text-slate-400">
                Henüz imza satırı eklenmedi.
              </div>
            ) : (
              <div className="space-y-4">
                {previewSignatureRows.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
                    {renderInput("Adı Soyadı", row.fullName, (value) => updateSignatureRow(row.id, "fullName", value))}
                    {renderInput("Görevi", row.role, (value) => updateSignatureRow(row.id, "role", value))}
                    {renderInput("Belge / İletişim Bilgisi", row.documentOrContact, (value) => updateSignatureRow(row.id, "documentOrContact", value))}
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
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Adım 8</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Resmî şablondaki bölüm sırasına göre oluşturulacak rapor özetini kontrol edin.
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
                ["DÖF / Faaliyet Planı Sayısı", String(previewActions.length)],
                ["İmza Satırı Sayısı", String(previewSignatureRows.length)],
                ["Not", cleanText(companyInfo.note) ? "Var" : "Yok"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                  <p className="mt-2 text-sm font-bold text-slate-100 break-words">{value}</p>
                </div>
              ))}
            </div>

            <Card className="border-slate-800 bg-slate-950/50">
              <CardHeader>
                <CardTitle className="text-base text-white">Word Şablonu Durumu</CardTitle>
                <CardDescription className="text-slate-400">
                  Resmî şablon dosyası erişimi kontrol edildi. Şablon bulunduğunda resmi Word çıktısı aynı veri setiyle indirilebilir.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <Badge className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-semibold", wordTemplateAvailable ? "border-amber-500/20 bg-amber-500/10 text-amber-400" : "border-red-500/20 bg-red-500/10 text-red-400")}>
                    {checkingTemplate ? "Kontrol ediliyor" : wordTemplateAvailable ? "Şablon bulundu" : "Şablon erişilemedi"}
                  </Badge>
                  <span>{wordTemplateAvailable ? "Word şablonu indirilmeye hazır." : "Word şablon dosyasına erişilemiyor."}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="theme-page-readable space-y-8">
      <section className="overflow-hidden rounded-[30px] border border-slate-800 bg-slate-950 p-6 md:p-8 shadow-[0_20px_48px_rgba(2,6,23,0.28)]">
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr] items-center">
          <div className="space-y-4">
            <Badge className="rounded-full border border-slate-800 bg-slate-900 text-slate-300 font-semibold px-3 py-1 text-xs">
              Resmî Risk Analizi Sihirbazı
            </Badge>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
              Resmî şablona uygun risk değerlendirme raporu oluşturun
            </h1>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">İlerleme</span>
              <Badge className="rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 text-[10px] font-semibold">
                %{Math.round(progressRatio)}
              </Badge>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-900">
              <div className="h-full rounded-full bg-cyan-500 transition-all duration-300" style={{ width: `${progressRatio}%` }} />
            </div>
            <p className="text-xs text-slate-400">
              Zorunlu alanlar tamamlandığında PDF veya Word çıktısı oluşturabilirsiniz.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="border-slate-850 bg-slate-950/80 shadow-2xl rounded-[28px] overflow-hidden">
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
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
                      const validation = isStepValid(currentStep);
                      if (!validation.valid) {
                        REQUIRED_COMPANY_FIELDS.forEach((field) => touchField(String(field)));
                        toast.error(validation.message);
                        return;
                      }
                      setCurrentStep(index);
                    }}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      isActive && "border-cyan-500/30 bg-cyan-500/5",
                      isCompleted && "border-slate-800 bg-slate-900/30",
                      !isActive && !isCompleted && "border-slate-800 bg-slate-950 hover:bg-slate-900/40",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg border text-xs",
                          isActive && "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
                          isCompleted && "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
                          !isActive && !isCompleted && "border-slate-800 bg-slate-900 text-slate-400",
                        )}
                      >
                        {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.icon}
                      </div>
                      <span className="text-[11px] font-bold text-slate-100 truncate">{step.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-slate-850 bg-slate-900/20 p-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-white">{WIZARD_STEPS[currentStep].title}</h3>
                <p className="text-xs text-slate-400 mt-1">{WIZARD_STEPS[currentStep].description}</p>
              </div>
              {renderStepContent()}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-850 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="rounded-xl border-slate-800 bg-slate-900/50 text-slate-100 hover:bg-slate-900"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Geri
              </Button>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetWizard}
                  className="rounded-xl border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                >
                  <X className="mr-2 h-4 w-4" />
                  Taslağı Temizle
                </Button>
                {currentStep < WIZARD_STEPS.length - 1 ? (
                  <Button type="button" onClick={handleNext} className="rounded-xl bg-violet-600 text-white hover:bg-violet-700">
                    İleri
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-850 bg-slate-950/80 rounded-[28px] shadow-2xl p-5">
            <p className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">Özet</p>
            <div className="mt-4 space-y-3">
              {[
                ["Firma Ünvanı", companyInfo.companyTitle || "Belirtilmedi"],
                ["Risk Yöntemi", companyInfo.riskMethod || "Belirtilmedi"],
                ["Risk Madde Sayısı", String(previewRiskItems.length)],
                ["Faaliyet Sayısı", String(previewActions.length)],
                ["İmza Satırı", String(previewSignatureRows.length)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-850/80 bg-slate-900/10 p-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
                  <p className="mt-1 text-sm font-bold text-slate-100">{value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-slate-850 bg-slate-950/80 rounded-[28px] shadow-2xl p-5">
            <p className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">Rapor Çıktıları</p>
            <div className="mt-4 space-y-3">
              <Button
                type="button"
                onClick={handleSaveDraft}
                variant="outline"
                className="w-full rounded-xl border-slate-800 bg-slate-900/50 text-slate-100 hover:bg-slate-900"
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
                Word Olarak İndir
              </Button>
              <Button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                variant="outline"
                className="w-full rounded-xl border-cyan-500/20 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
              >
                <Download className="mr-2 h-4 w-4" />
                PDF İndir
              </Button>
            </div>
          </Card>

          <Card className="border-slate-850 bg-slate-950/80 rounded-[28px] shadow-2xl p-5">
            <p className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">Bilgilendirme</p>
            <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-400">
              <div className="rounded-xl border border-slate-850 bg-slate-900/10 p-4">
                <p className="font-bold text-slate-200">Boş Not Alanı Gizlenir</p>
                <p className="mt-1">Not boş bırakılırsa kapakta “Not:” etiketi ve ilgili boşluk hiç oluşturulmaz.</p>
              </div>
              <div className="rounded-xl border border-slate-850 bg-slate-900/10 p-4">
                <p className="font-bold text-slate-200">Dinamik Tablo Satırları</p>
                <p className="mt-1">
                  Risk tablosu ve faaliyet planı, yalnızca eklediğiniz satırlar kadar üretilir; boş satır basılmaz.
                </p>
              </div>
              <div className="rounded-xl border border-slate-850 bg-slate-900/10 p-4">
                <p className="font-bold text-slate-200">Word Şablonu</p>
                <p className="mt-1">
                  DOCX şablonu bulunduğunda resmi Word çıktısı aynı veri setiyle indirilebilir. PDF çıktısı resmi bölüm sırasına göre çalışmaya devam eder.

                </p>
              </div>
              <div className="inline-flex items-start gap-2 rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-3 text-cyan-200">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Kayıtlı risk maddeleri yalnızca mevcut bir risk değerlendirmesi üzerinden açıldığında aktarılabilir.</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={riskTemplateDialogOpen} onOpenChange={setRiskTemplateDialogOpen}>
        <DialogContent className="max-w-3xl border-slate-800 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>Risk Şablonları</DialogTitle>
            <DialogDescription className="text-slate-400">
              Kayıtlı risk şablonlarından birini tek tıkla Risk Değerlendirme Tablosu’na aktarın.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {!profile?.organization_id ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 p-6 text-sm text-slate-400">
                Risk şablonlarını kullanmak için organizasyon bilgisi bulunmalıdır.
              </div>
            ) : loadingRiskTemplates ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Şablonlar yükleniyor...
                </div>
              </div>
            ) : riskTemplates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 p-6 text-sm text-slate-400">
                Kayıtlı risk şablonu bulunamadı.
              </div>
            ) : (
              riskTemplates.map((template) => {
                const itemCount = Array.isArray(template.payload?.items) ? template.payload.items.length : 0;
                return (
                  <div key={template.id} className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-white">{template.name}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                          {template.sector ? (
                            <Badge className="rounded-full border border-slate-700 bg-slate-900 text-slate-300">
                              {template.sector}
                            </Badge>
                          ) : null}
                          <Badge className="rounded-full border border-slate-700 bg-slate-900 text-slate-300">
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
