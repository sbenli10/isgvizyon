import { useEffect, useMemo, useState } from "react";
import { FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssignmentTypeCards } from "@/components/assignment-letters/AssignmentTypeCards";
import { AssignmentFormModal, type AssignmentFormValues } from "@/components/assignment-letters/AssignmentFormModal";
import { AssignmentHistoryTable, type AssignmentHistoryItem } from "@/components/assignment-letters/AssignmentHistoryTable";
import { WorkAccidentReportModal, type WorkAccidentFormValues } from "@/components/assignment-letters/WorkAccidentReportModal";
import {
  ReturnToWorkTrainingModal,
  type ReturnToWorkTrainingFormValues,
  type ReturnToWorkTrainingInstructorForm,
} from "@/components/assignment-letters/ReturnToWorkTrainingModal";
import {
  RootCauseInvestigationModal,
  type RootCauseInvestigationFormValues,
} from "@/components/assignment-letters/RootCauseInvestigationModal";
import { NearMissReportModal, type NearMissReportFormValues } from "@/components/assignment-letters/NearMissReportModal";
import {
  EmergencyDrillAttendanceModal,
  type EmergencyDrillAttendanceFormValues,
  type EmergencyDrillAttendanceParticipantForm,
} from "@/components/assignment-letters/EmergencyDrillAttendanceModal";
import { DrillFormModal, type DrillFormValues } from "@/components/assignment-letters/DrillFormModal";
import {
  OrientationOnboardingTrainingModal,
  ORIENTATION_TOPICS,
  ONBOARDING_TOPICS,
  type OrientationOnboardingTrainingFormValues,
  type TopicStatus,
} from "@/components/assignment-letters/OrientationOnboardingTrainingModal";
import {
  EmployeeRepresentativeAppointmentModal,
  type EmployeeRepresentativeAppointmentFormValues,
} from "@/components/assignment-letters/EmployeeRepresentativeAppointmentModal";
import {
  IncidentInvestigationReportModal,
  type IncidentInvestigationReportFormValues,
} from "@/components/assignment-letters/IncidentInvestigationReportModal";
import {
  generateAssignmentWord,
  type AssignmentLetterDocumentData,
  type AssignmentType,
  type HazardClass,
} from "@/lib/assignmentWordGenerator";
import { useAuth } from "@/contexts/AuthContext";
import { generateWorkAccidentWord } from "@/lib/workAccidentWordGenerator";
import { generateReturnToWorkTrainingWord } from "@/lib/returnToWorkTrainingWordGenerator";
import { generateRootCauseInvestigationWord } from "@/lib/rootCauseInvestigationWordGenerator";
import { generateNearMissReportWord } from "@/lib/nearMissReportWordGenerator";
import { generateEmergencyDrillAttendanceWord } from "@/lib/emergencyDrillAttendanceWordGenerator";
import { generateDrillFormWord } from "@/lib/drillFormWordGenerator";
import { generateOrientationOnboardingTrainingWord } from "@/lib/orientationOnboardingTrainingWordGenerator";
import { generateEmployeeRepresentativeAppointmentWord } from "@/lib/employeeRepresentativeAppointmentWordGenerator";
import { generateIncidentInvestigationReportWord } from "@/lib/incidentInvestigationReportWordGenerator";
import type { Company, Employee } from "@/types/companies";

interface CompanyRecord extends Company {
  logo_url?: string | null;
}

interface AssignmentLetterRow {
  id: string;
  company_id: string;
  employee_id: string;
  assignment_type: AssignmentType;
  start_date: string;
  duration: number;
  weekly_hours: number;
  created_at: string;
}

interface AssignmentLetterSettingsForm {
  institution_title: string;
  institution_subtitle: string;
  document_code: string;
  publish_number: string;
  revision_date: string;
  left_signature_name: string;
  left_signature_title: string;
  right_signature_name: string;
  right_signature_title: string;
}

interface EmployeeRepresentativeBundleSettingsForm {
  revision_no: string;
  prepared_by_name: string;
  prepared_by_title: string;
  approved_by_name: string;
  approved_by_title: string;
  trainer_name: string;
  trainer_title: string;
}

const defaultForm: AssignmentFormValues = {
  company_id: "",
  employee_id: "",
  start_date: new Date().toISOString().slice(0, 10),
  duration: "12",
  weekly_hours: "2",
  hazard_class: "Az Tehlikeli",
};

const defaultLetterSettings: AssignmentLetterSettingsForm = {
  institution_title: "T.C.",
  institution_subtitle: "",
  document_code: "ISG-BLG-ATM",
  publish_number: "Yayın 00",
  revision_date: new Date().toISOString().slice(0, 10),
  left_signature_name: "İşveren / İşveren Vekili",
  left_signature_title: "",
  right_signature_name: "",
  right_signature_title: "",
};

const defaultEmployeeRepresentativeBundleSettings: EmployeeRepresentativeBundleSettingsForm = {
  revision_no: "00",
  prepared_by_name: "İş Güvenliği Uzmanı",
  prepared_by_title: "İş Güvenliği Uzmanı",
  approved_by_name: "İşveren / İ.Vekili",
  approved_by_title: "İşveren / İ.Vekili",
  trainer_name: "İş Güvenliği Uzmanı",
  trainer_title: "Eğitici",
};

const defaultWorkAccidentForm: WorkAccidentFormValues = {
  company_id: "",
  employee_id: "",
  accident_date: new Date().toISOString().slice(0, 10),
  accident_time: "09:00",
  injured_full_name: "",
  accident_place: "",
  injured_tc: "",
  injured_body_part: "",
  victim_statement: "",
  witness_statement: "",
  witness_name: "",
  department_chief_name: "",
  safety_expert_name: "",
  report_date: new Date().toISOString().slice(0, 10),
  photos: [],
};

const defaultTrainingInstructors: ReturnToWorkTrainingInstructorForm[] = Array.from({ length: 5 }, () => ({
  full_name: "",
  tc_number: "",
  title: "",
}));

const defaultReturnToWorkTrainingForm: ReturnToWorkTrainingFormValues = {
  company_mode: "system",
  company_id: "",
  employee_mode: "system",
  employee_id: "",
  organization_name: "",
  address: "",
  sgk_registration_no: "",
  training_method: "",
  training_date: new Date().toISOString().slice(0, 10),
  training_duration: "",
  participant_name: "",
  participant_title: "",
  participant_tc: "",
  instructors: defaultTrainingInstructors,
};

const defaultRootCauseInvestigationForm: RootCauseInvestigationFormValues = {
  company_mode: "system",
  company_id: "",
  manual_company_name: "",
  employee_mode: "system",
  employee_id: "",
  unit_name: "",
  location: "",
  event_types: [],
  other_event_type: "",
  event_date: new Date().toISOString().slice(0, 10),
  event_time: "09:00",
  task_title: "",
  treatment_duration: "",
  unit_chief: "",
  lost_time: "",
  injured_name: "",
  treating_person: "",
  body_parts: [],
  other_body_part: "",
  damaged_equipment: "",
  incident_description: "",
  unit_chief_opinion: "",
  safety_expert_name: "",
  workplace_doctor_name: "",
  board_member_name: "",
  other_evaluator_name: "",
  recommended_measures: "",
};

const defaultNearMissReportForm: NearMissReportFormValues = {
  company_mode: "system",
  company_id: "",
  manual_company_name: "",
  employee_mode: "system",
  employee_id: "",
  report_date: new Date().toISOString().slice(0, 10),
  report_time: "09:00",
  reporter_name: "",
  reporter_unit_role: "",
  is_experienced_by_reporter: false,
  is_witnessed_by_reporter: false,
  incident_description: "",
  incident_location: "",
  prevention_suggestion: "",
  safety_officer_name: "",
  planned_actions: "",
  signer_name: "",
};

const defaultEmergencyDrillParticipants: EmergencyDrillAttendanceParticipantForm[] = Array.from({ length: 96 }, () => ({
  full_name: "",
  tc_number: "",
}));

const defaultEmergencyDrillAttendanceForm: EmergencyDrillAttendanceFormValues = {
  drill_topic: "",
  drill_date: new Date().toISOString().slice(0, 10),
  drill_duration: "",
  participants: defaultEmergencyDrillParticipants,
};

const defaultDrillForm: DrillFormValues = {
  workplace_name: "",
  drill_name: "",
  drill_date: new Date().toISOString().slice(0, 10),
  drill_types: [],
  other_drill_type: "",
  participant_count: "",
  assembly_count_result: "",
  start_time: "09:00",
  end_time: "10:00",
  drill_subject: "",
  drill_purpose: "",
  post_drill_evaluation: "",
  things_done_correctly: "",
  things_done_wrong: "",
  conclusions: "",
  conductor_name: "",
  conductor_title: "",
  approver_name: "",
};

const defaultIncidentInvestigationReportForm: IncidentInvestigationReportFormValues = {
  cause_activity: "",
  where_when: "",
  incident_type: "",
  incident_outcome: "",
  injured_full_name: "",
  injured_job_title: "",
  injured_department: "",
  injured_age: "",
  insured_number: "",
  service_duration: "",
  incident_description: "",
  risk_analysis_status: "",
  hazard: "",
  risk: "",
  root_cause: "",
  corrective_actions: "",
  witness_one_name: "",
  witness_one_title: "",
  witness_one_department: "",
  witness_two_name: "",
  witness_two_title: "",
  witness_two_department: "",
  witness_three_name: "",
  witness_three_title: "",
  witness_three_department: "",
  report_date: new Date().toISOString().slice(0, 10),
  prepared_by: "",
  approved_by: "",
};

const buildTopicDefaults = (topics: readonly string[]) =>
  Object.fromEntries(topics.map((topic) => [topic, null])) as Record<string, TopicStatus>;

const defaultOrientationOnboardingTrainingForm: OrientationOnboardingTrainingFormValues = {
  full_name: "",
  birth_place_year: "",
  start_date: new Date().toISOString().slice(0, 10),
  education_level: "",
  position: "",
  orientation_duration: "",
  orientation_topics: buildTopicDefaults(ORIENTATION_TOPICS),
  orientation_trainer: "",
  onboarding_duration: "",
  onboarding_topics: buildTopicDefaults(ONBOARDING_TOPICS),
  onboarding_trainer: "",
  notes: "",
  trainee_signature_name: "",
  employer_signature_name: "",
};

const defaultEmployeeRepresentativeAppointmentForm: EmployeeRepresentativeAppointmentFormValues = {
  company_mode: "system",
  company_id: "",
  manual_company_name: "",
  workplace_title: "",
  workplace_address: "",
  sgk_registration_no: "",
  employee_mode: "system",
  employee_id: "",
  representative_name: "",
  representative_tc: "",
  representative_title: "",
  representative_department: "",
  appointment_date: new Date().toISOString().slice(0, 10),
  document_number: "",
  representative_type: "Çalışan Temsilcisi",
  appointment_reason: "",
  legal_basis: "",
  duties_and_authorities: "",
  communication_method: "",
  training_commitment: "",
  employer_name: "",
  employer_title: "",
  employee_signature_name: "",
  additional_notes: "",
};

const assignmentLabels: Record<AssignmentType, string> = {
  risk_assessment_team: "Risk Değerlendirme Ekibi Atama Yazısı",
  support_staff: "Destek Elemanı Atama Yazısı",
  employee_representative: "Çalışan Temsilcisi Atama Yazısı",
};

function normalizeHazardClass(value?: string | null): HazardClass {
  if (!value) return "Az Tehlikeli";
  if (value.includes("Çok") || value.includes("Ã‡ok")) return "Çok Tehlikeli";
  if (value.includes("Tehlikeli") && !value.includes("Az")) return "Tehlikeli";
  return "Az Tehlikeli";
}

function mapCompany(row: any): CompanyRecord {
  return {
    ...row,
    owner_id: row.user_id,
    company_name: row.name,
    nace_code: row.industry || "",
    hazard_class: normalizeHazardClass(row.hazard_class) as unknown as Company["hazard_class"],
    employee_count: Number(row.employee_count || 0),
    logo_url: row.logo_url || null,
  };
}

function mapEmployee(row: any): Employee {
  return {
    ...row,
    tc_number: row.tc_number || "",
    first_name: row.first_name || "",
    last_name: row.last_name || "",
    job_title: row.job_title || "",
    start_date: row.start_date || new Date().toISOString().slice(0, 10),
    is_active: row.is_active !== false,
    created_at: row.created_at || "",
    updated_at: row.updated_at || "",
    company_id: row.company_id,
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("tr-TR");
}

function buildDocumentNumber(row: AssignmentLetterRow) {
  const year = new Date(row.created_at || Date.now()).getFullYear();
  return `ATM-${year}-${row.id.slice(0, 8).toUpperCase()}`;
}

export default function AssignmentLetters() {
  const { user, profile } = useAuth();
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [historyRows, setHistoryRows] = useState<AssignmentLetterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [workAccidentSaving, setWorkAccidentSaving] = useState(false);
  const [returnTrainingSaving, setReturnTrainingSaving] = useState(false);
  const [rootCauseSaving, setRootCauseSaving] = useState(false);
  const [nearMissSaving, setNearMissSaving] = useState(false);
  const [emergencyDrillSaving, setEmergencyDrillSaving] = useState(false);
  const [drillFormSaving, setDrillFormSaving] = useState(false);
  const [incidentInvestigationSaving, setIncidentInvestigationSaving] = useState(false);
  const [employeeRepresentativeAppointmentSaving, setEmployeeRepresentativeAppointmentSaving] = useState(false);
  const [orientationOnboardingTrainingSaving, setOrientationOnboardingTrainingSaving] = useState(false);
  const [activeType, setActiveType] = useState<AssignmentType | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [workAccidentOpen, setWorkAccidentOpen] = useState(false);
  const [returnTrainingOpen, setReturnTrainingOpen] = useState(false);
  const [rootCauseOpen, setRootCauseOpen] = useState(false);
  const [nearMissOpen, setNearMissOpen] = useState(false);
  const [emergencyDrillOpen, setEmergencyDrillOpen] = useState(false);
  const [drillFormOpen, setDrillFormOpen] = useState(false);
  const [incidentInvestigationOpen, setIncidentInvestigationOpen] = useState(false);
  const [employeeRepresentativeAppointmentOpen, setEmployeeRepresentativeAppointmentOpen] = useState(false);
  const [orientationOnboardingTrainingOpen, setOrientationOnboardingTrainingOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssignmentFormValues>(defaultForm);
  const [letterSettings, setLetterSettings] = useState<AssignmentLetterSettingsForm>(defaultLetterSettings);
  const [employeeRepresentativeBundleSettings, setEmployeeRepresentativeBundleSettings] =
    useState<EmployeeRepresentativeBundleSettingsForm>(defaultEmployeeRepresentativeBundleSettings);
  const [workAccidentForm, setWorkAccidentForm] = useState<WorkAccidentFormValues>(defaultWorkAccidentForm);
  const [returnTrainingForm, setReturnTrainingForm] = useState<ReturnToWorkTrainingFormValues>(defaultReturnToWorkTrainingForm);
  const [rootCauseForm, setRootCauseForm] = useState<RootCauseInvestigationFormValues>(defaultRootCauseInvestigationForm);
  const [nearMissForm, setNearMissForm] = useState<NearMissReportFormValues>(defaultNearMissReportForm);
  const [emergencyDrillForm, setEmergencyDrillForm] = useState<EmergencyDrillAttendanceFormValues>(defaultEmergencyDrillAttendanceForm);
  const [drillForm, setDrillForm] = useState<DrillFormValues>(defaultDrillForm);
  const [incidentInvestigationForm, setIncidentInvestigationForm] =
    useState<IncidentInvestigationReportFormValues>(defaultIncidentInvestigationReportForm);
  const [employeeRepresentativeAppointmentForm, setEmployeeRepresentativeAppointmentForm] =
    useState<EmployeeRepresentativeAppointmentFormValues>(defaultEmployeeRepresentativeAppointmentForm);
  const [orientationOnboardingTrainingForm, setOrientationOnboardingTrainingForm] =
    useState<OrientationOnboardingTrainingFormValues>(defaultOrientationOnboardingTrainingForm);

  useEffect(() => {
    void bootstrap();
  }, [user?.id]);

  async function bootstrap() {
    setLoading(true);
    try {
      await Promise.all([loadCompanies(), loadEmployees(), loadHistory(), loadLetterSettings()]);
    } catch (error: any) {
      toast.error(`Atama yazıları verileri yüklenemedi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadCompanies() {
    const { data, error } = await (supabase as any)
      .from("companies")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    setCompanies((data || []).map(mapCompany));
  }

  async function loadEmployees() {
    const { data, error } = await (supabase as any)
      .from("employees")
      .select("*")
      .eq("is_active", true)
      .order("first_name", { ascending: true });

    if (error) throw error;
    setEmployees((data || []).map(mapEmployee));
  }

  async function loadHistory() {
    const { data, error } = await (supabase as any)
      .from("assignment_letters")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    setHistoryRows(data || []);
  }

  async function loadLetterSettings() {
    if (!user?.id) {
      setLetterSettings(defaultLetterSettings);
      setEmployeeRepresentativeBundleSettings(defaultEmployeeRepresentativeBundleSettings);
      return;
    }

    const { data, error } = await (supabase as any)
      .from("assignment_letter_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      setLetterSettings(defaultLetterSettings);
      setEmployeeRepresentativeBundleSettings(defaultEmployeeRepresentativeBundleSettings);
      return;
    }

    setLetterSettings({
      institution_title: data.institution_title || defaultLetterSettings.institution_title,
      institution_subtitle: data.institution_subtitle || "",
      document_code: data.document_code || defaultLetterSettings.document_code,
      publish_number: data.publish_number || defaultLetterSettings.publish_number,
      revision_date: data.revision_date || defaultLetterSettings.revision_date,
      left_signature_name: data.left_signature_name || defaultLetterSettings.left_signature_name,
      left_signature_title: data.left_signature_title || "",
      right_signature_name: data.right_signature_name || "",
      right_signature_title: data.right_signature_title || "",
    });
    setEmployeeRepresentativeBundleSettings({
      revision_no: data.employee_rep_revision_no || defaultEmployeeRepresentativeBundleSettings.revision_no,
      prepared_by_name: data.employee_rep_prepared_by_name || defaultEmployeeRepresentativeBundleSettings.prepared_by_name,
      prepared_by_title: data.employee_rep_prepared_by_title || defaultEmployeeRepresentativeBundleSettings.prepared_by_title,
      approved_by_name: data.employee_rep_approved_by_name || defaultEmployeeRepresentativeBundleSettings.approved_by_name,
      approved_by_title: data.employee_rep_approved_by_title || defaultEmployeeRepresentativeBundleSettings.approved_by_title,
      trainer_name: data.employee_rep_trainer_name || defaultEmployeeRepresentativeBundleSettings.trainer_name,
      trainer_title: data.employee_rep_trainer_title || defaultEmployeeRepresentativeBundleSettings.trainer_title,
    });
  }

  function resetModalState() {
    setModalOpen(false);
    setActiveType(null);
    setEditingId(null);
    setForm(defaultForm);
  }

  function openCreateModal(type: AssignmentType) {
    setEditingId(null);
    setActiveType(type);
    setForm(defaultForm);
    setModalOpen(true);
  }

  function resetWorkAccidentModal() {
    setWorkAccidentOpen(false);
    setWorkAccidentForm(defaultWorkAccidentForm);
  }

  function openWorkAccidentModal() {
    setWorkAccidentForm((prev) => ({
      ...defaultWorkAccidentForm,
      safety_expert_name: prev.safety_expert_name || letterSettings.right_signature_name || "",
    }));
    setWorkAccidentOpen(true);
  }

  function resetReturnTrainingModal() {
    setReturnTrainingOpen(false);
    setReturnTrainingForm(defaultReturnToWorkTrainingForm);
  }

  function openReturnTrainingModal() {
    setReturnTrainingForm(defaultReturnToWorkTrainingForm);
    setReturnTrainingOpen(true);
  }

  function resetRootCauseModal() {
    setRootCauseOpen(false);
    setRootCauseForm(defaultRootCauseInvestigationForm);
  }

  function openRootCauseModal() {
    setRootCauseForm(defaultRootCauseInvestigationForm);
    setRootCauseOpen(true);
  }

  function resetNearMissModal() {
    setNearMissOpen(false);
    setNearMissForm(defaultNearMissReportForm);
  }

  function openNearMissModal() {
    setNearMissForm(defaultNearMissReportForm);
    setNearMissOpen(true);
  }

  function resetEmergencyDrillModal() {
    setEmergencyDrillOpen(false);
    setEmergencyDrillForm(defaultEmergencyDrillAttendanceForm);
  }

  function openEmergencyDrillModal() {
    setEmergencyDrillForm(defaultEmergencyDrillAttendanceForm);
    setEmergencyDrillOpen(true);
  }

  function resetDrillFormModal() {
    setDrillFormOpen(false);
    setDrillForm(defaultDrillForm);
  }

  function openDrillFormModal() {
    setDrillForm(defaultDrillForm);
    setDrillFormOpen(true);
  }

  function resetIncidentInvestigationModal() {
    setIncidentInvestigationOpen(false);
    setIncidentInvestigationForm(defaultIncidentInvestigationReportForm);
  }

  function openIncidentInvestigationModal() {
    setIncidentInvestigationForm(defaultIncidentInvestigationReportForm);
    setIncidentInvestigationOpen(true);
  }

  function resetEmployeeRepresentativeAppointmentModal() {
    setEmployeeRepresentativeAppointmentOpen(false);
    setEmployeeRepresentativeAppointmentForm(defaultEmployeeRepresentativeAppointmentForm);
  }

  function openEmployeeRepresentativeAppointmentModal() {
    setEmployeeRepresentativeAppointmentForm({
      ...defaultEmployeeRepresentativeAppointmentForm,
      document_number: employeeRepresentativeBundleSettings.revision_no,
      employer_name: employeeRepresentativeBundleSettings.prepared_by_name,
      employer_title: employeeRepresentativeBundleSettings.prepared_by_title,
      employee_signature_name: employeeRepresentativeBundleSettings.approved_by_name,
      representative_title: defaultEmployeeRepresentativeAppointmentForm.representative_title,
    });
    setEmployeeRepresentativeAppointmentOpen(true);
  }

  function resetOrientationOnboardingTrainingModal() {
    setOrientationOnboardingTrainingOpen(false);
    setOrientationOnboardingTrainingForm(defaultOrientationOnboardingTrainingForm);
  }

  function openOrientationOnboardingTrainingModal() {
    setOrientationOnboardingTrainingForm(defaultOrientationOnboardingTrainingForm);
    setOrientationOnboardingTrainingOpen(true);
  }

  const historyItems = useMemo<AssignmentHistoryItem[]>(() => {
    return historyRows.map((row) => {
      const company = companies.find((item) => item.id === row.company_id);
      const employee = employees.find((item) => item.id === row.employee_id);
      return {
        id: row.id,
        companyName: company?.company_name || "Firma bulunamadı",
        employeeName: employee ? `${employee.first_name} ${employee.last_name}`.trim() : "Personel bulunamadı",
        assignmentTypeLabel: assignmentLabels[row.assignment_type] || row.assignment_type,
        createdAt: formatDate(row.created_at),
      };
    });
  }, [companies, employees, historyRows]);

  async function resolveCompanyLogoUrl(company?: CompanyRecord) {
    if (!company?.logo_url) return undefined;
    if (company.logo_url.startsWith("http") || company.logo_url.startsWith("data:")) {
      return company.logo_url;
    }

    const companyBucket = await supabase.storage.from("company-logos").createSignedUrl(company.logo_url, 3600);
    if (!companyBucket.error && companyBucket.data?.signedUrl) {
      return companyBucket.data.signedUrl;
    }

    const certificateBucket = await supabase.storage.from("certificate-files").createSignedUrl(company.logo_url, 3600);
    if (!certificateBucket.error && certificateBucket.data?.signedUrl) {
      return certificateBucket.data.signedUrl;
    }

    return undefined;
  }

  async function buildDocumentData(
    type: AssignmentType,
    row: AssignmentLetterRow,
    hazardClass: HazardClass = "Az Tehlikeli"
  ): Promise<AssignmentLetterDocumentData | null> {
    const company = companies.find((item) => item.id === row.company_id);
    const employee = employees.find((item) => item.id === row.employee_id);
    if (!company || !employee) return null;

    const companyLogoUrl = await resolveCompanyLogoUrl(company);

    return {
      assignmentType: type,
      assignmentTitle: assignmentLabels[type],
      companyName: company.company_name,
      companyLogoUrl,
      institutionTitle: letterSettings.institution_title,
      institutionSubtitle: letterSettings.institution_subtitle || company.company_name,
      documentCode: letterSettings.document_code,
      publishNumber: letterSettings.publish_number,
      revisionDate: letterSettings.revision_date,
      employeeName: `${employee.first_name} ${employee.last_name}`.trim(),
      employeeJobTitle: employee.job_title || "-",
      startDate: row.start_date,
      duration: Number(row.duration || 0),
      weeklyHours: Number(row.weekly_hours || 0),
      hazardClass,
      createdAt: row.created_at,
      documentNumber: buildDocumentNumber(row),
      leftSignatureName: letterSettings.left_signature_name,
      leftSignatureTitle: letterSettings.left_signature_title,
      rightSignatureName: letterSettings.right_signature_name || `${employee.first_name} ${employee.last_name}`.trim(),
      rightSignatureTitle: letterSettings.right_signature_title || employee.job_title || "-",
    };
  }

  async function handleSaveLetterSettings() {
    if (!user?.id) {
      toast.error("Belge ayarlarını kaydetmek için giriş yapmalısınız.");
      return;
    }

    setSettingsSaving(true);
    try {
      const payload = {
        user_id: user.id,
        organization_id: profile?.organization_id ?? null,
        institution_title: letterSettings.institution_title.trim() || defaultLetterSettings.institution_title,
        institution_subtitle: letterSettings.institution_subtitle.trim() || null,
        document_code: letterSettings.document_code.trim() || defaultLetterSettings.document_code,
        publish_number: letterSettings.publish_number.trim() || defaultLetterSettings.publish_number,
        revision_date: letterSettings.revision_date || null,
        left_signature_name: letterSettings.left_signature_name.trim() || defaultLetterSettings.left_signature_name,
        left_signature_title: letterSettings.left_signature_title.trim() || null,
        right_signature_name: letterSettings.right_signature_name.trim() || null,
        right_signature_title: letterSettings.right_signature_title.trim() || null,
        employee_rep_revision_no: employeeRepresentativeBundleSettings.revision_no.trim() || defaultEmployeeRepresentativeBundleSettings.revision_no,
        employee_rep_prepared_by_name:
          employeeRepresentativeBundleSettings.prepared_by_name.trim() || defaultEmployeeRepresentativeBundleSettings.prepared_by_name,
        employee_rep_prepared_by_title:
          employeeRepresentativeBundleSettings.prepared_by_title.trim() || defaultEmployeeRepresentativeBundleSettings.prepared_by_title,
        employee_rep_approved_by_name:
          employeeRepresentativeBundleSettings.approved_by_name.trim() || defaultEmployeeRepresentativeBundleSettings.approved_by_name,
        employee_rep_approved_by_title:
          employeeRepresentativeBundleSettings.approved_by_title.trim() || defaultEmployeeRepresentativeBundleSettings.approved_by_title,
        employee_rep_trainer_name:
          employeeRepresentativeBundleSettings.trainer_name.trim() || defaultEmployeeRepresentativeBundleSettings.trainer_name,
        employee_rep_trainer_title:
          employeeRepresentativeBundleSettings.trainer_title.trim() || defaultEmployeeRepresentativeBundleSettings.trainer_title,
      };

      const { error } = await (supabase as any)
        .from("assignment_letter_settings")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;

      toast.success("Belge ayarları kaydedildi.");
      await loadLetterSettings();
    } catch (error: any) {
      toast.error(`Belge ayarları kaydedilemedi: ${error.message}`);
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleCreateAssignment() {
    if (!activeType) return;
    if (!form.company_id || !form.employee_id || !form.start_date || !form.duration || !form.weekly_hours) {
      toast.error("Lütfen tüm zorunlu alanları doldurun.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        company_id: form.company_id,
        employee_id: form.employee_id,
        assignment_type: activeType,
        start_date: form.start_date,
        duration: Number(form.duration),
        weekly_hours: Number(form.weekly_hours),
      };

      let savedRow: AssignmentLetterRow | null = null;

      if (editingId) {
        const { data, error } = await (supabase as any)
          .from("assignment_letters")
          .update(payload)
          .eq("id", editingId)
          .select("*")
          .single();

        if (error) throw error;
        savedRow = data as AssignmentLetterRow;
      } else {
        const { data, error } = await (supabase as any)
          .from("assignment_letters")
          .insert(payload)
          .select("*")
          .single();

        if (error) throw error;
        savedRow = data as AssignmentLetterRow;
      }

      const documentData = await buildDocumentData(activeType, savedRow, form.hazard_class);
      if (!documentData) {
        toast.error("Belge kaydedildi ancak Word çıktısı için firma veya personel bilgisi bulunamadı.");
      } else {
        await generateAssignmentWord(documentData);
      }

      toast.success(editingId ? "Atama yazısı güncellendi." : "Atama yazısı oluşturuldu.");
      resetModalState();
      await loadHistory();
    } catch (error: any) {
      toast.error(`Atama yazısı kaydedilemedi: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadHistoryItem(id: string) {
    const row = historyRows.find((item) => item.id === id);
    if (!row) {
      toast.error("Belge kaydı bulunamadı.");
      return;
    }

    const company = companies.find((item) => item.id === row.company_id);
    const hazardClass = normalizeHazardClass(company?.hazard_class);
    const documentData = await buildDocumentData(row.assignment_type, row, hazardClass);
    if (!documentData) {
      toast.error("İlgili firma veya personel kaydı bulunamadı.");
      return;
    }

    await generateAssignmentWord(documentData);
  }

  function handleEditHistoryItem(id: string) {
    const row = historyRows.find((item) => item.id === id);
    if (!row) {
      toast.error("Düzenlenecek belge bulunamadı.");
      return;
    }

    const company = companies.find((item) => item.id === row.company_id);
    setEditingId(row.id);
    setActiveType(row.assignment_type);
    setForm({
      company_id: row.company_id,
      employee_id: row.employee_id,
      start_date: row.start_date,
      duration: String(row.duration ?? 12),
      weekly_hours: String(row.weekly_hours ?? 0),
      hazard_class: normalizeHazardClass(company?.hazard_class),
    });
    setModalOpen(true);
  }

  async function handleDeleteHistoryItem(id: string) {
    const confirmed = window.confirm("Bu atama yazısını silmek istediğinize emin misiniz?");
    if (!confirmed) return;

    try {
      const { error } = await (supabase as any).from("assignment_letters").delete().eq("id", id);
      if (error) throw error;
      setHistoryRows((prev) => prev.filter((item) => item.id !== id));
      toast.success("Atama yazısı silindi.");
    } catch (error: any) {
      toast.error(`Belge silinemedi: ${error.message}`);
    }
  }

  async function handleGenerateWorkAccidentReport() {
    if (
      !workAccidentForm.accident_date ||
      !workAccidentForm.accident_time ||
      !workAccidentForm.injured_full_name ||
      !workAccidentForm.accident_place ||
      !workAccidentForm.injured_tc ||
      !workAccidentForm.injured_body_part ||
      !workAccidentForm.victim_statement ||
      !workAccidentForm.witness_statement
    ) {
      toast.error("Lütfen iş kazası tutanağı için zorunlu alanları doldurun.");
      return;
    }

    setWorkAccidentSaving(true);
    try {
      await generateWorkAccidentWord({
        accidentDate: workAccidentForm.accident_date,
        accidentTime: workAccidentForm.accident_time,
        injuredFullName: workAccidentForm.injured_full_name,
        accidentPlace: workAccidentForm.accident_place,
        injuredTc: workAccidentForm.injured_tc,
        injuredBodyPart: workAccidentForm.injured_body_part,
        victimStatement: workAccidentForm.victim_statement,
        witnessStatement: workAccidentForm.witness_statement,
        witnessName: workAccidentForm.witness_name,
        departmentChiefName: workAccidentForm.department_chief_name,
        safetyExpertName: workAccidentForm.safety_expert_name,
        reportDate: workAccidentForm.report_date,
        photos: workAccidentForm.photos,
      });

      toast.success("İş kazası tutanağı Word çıktısı hazırlandı.");
      resetWorkAccidentModal();
    } catch (error: any) {
      toast.error(`İş kazası tutanağı oluşturulamadı: ${error.message}`);
    } finally {
      setWorkAccidentSaving(false);
    }
  }

  async function handleGenerateReturnTrainingForm() {
    if (
      !returnTrainingForm.organization_name.trim() ||
      !returnTrainingForm.address.trim() ||
      !returnTrainingForm.sgk_registration_no.trim() ||
      !returnTrainingForm.training_method.trim() ||
      !returnTrainingForm.training_date ||
      !returnTrainingForm.training_duration.trim() ||
      !returnTrainingForm.participant_name.trim() ||
      !returnTrainingForm.participant_title.trim() ||
      !returnTrainingForm.participant_tc.trim()
    ) {
      toast.error("Lütfen işe dönüş ilave eğitim formu için zorunlu alanları doldurun.");
      return;
    }

    setReturnTrainingSaving(true);
    try {
      await generateReturnToWorkTrainingWord({
        organizationName: returnTrainingForm.organization_name,
        address: returnTrainingForm.address,
        sgkRegistrationNo: returnTrainingForm.sgk_registration_no,
        trainingMethod: returnTrainingForm.training_method,
        trainingDate: returnTrainingForm.training_date,
        trainingDuration: returnTrainingForm.training_duration,
        participantName: returnTrainingForm.participant_name,
        participantTitle: returnTrainingForm.participant_title,
        participantTc: returnTrainingForm.participant_tc,
        instructors: returnTrainingForm.instructors.map((item) => ({
          fullName: item.full_name,
          tcNumber: item.tc_number,
          title: item.title,
        })),
      });

      toast.success("İşe dönüş ilave eğitim katılım formu Word çıktısı hazırlandı.");
      resetReturnTrainingModal();
    } catch (error: any) {
      toast.error(`Form oluşturulamadı: ${error.message}`);
    } finally {
      setReturnTrainingSaving(false);
    }
  }

  async function handleGenerateRootCauseForm() {
    if (
      !rootCauseForm.unit_name.trim() ||
      !rootCauseForm.location.trim() ||
      rootCauseForm.event_types.length === 0 ||
      !rootCauseForm.event_date ||
      !rootCauseForm.event_time ||
      !rootCauseForm.injured_name.trim() ||
      rootCauseForm.body_parts.length === 0 ||
      !rootCauseForm.incident_description.trim()
    ) {
      toast.error("Lütfen kök neden araştırma formu için zorunlu alanları doldurun.");
      return;
    }

    setRootCauseSaving(true);
    try {
      await generateRootCauseInvestigationWord({
        unitName: rootCauseForm.unit_name,
        location: rootCauseForm.location,
        eventTypes: rootCauseForm.event_types,
        otherEventType: rootCauseForm.other_event_type,
        eventDate: rootCauseForm.event_date,
        eventTime: rootCauseForm.event_time,
        taskTitle: rootCauseForm.task_title,
        treatmentDuration: rootCauseForm.treatment_duration,
        unitChief: rootCauseForm.unit_chief,
        lostTime: rootCauseForm.lost_time,
        injuredName: rootCauseForm.injured_name,
        treatingPerson: rootCauseForm.treating_person,
        bodyParts: rootCauseForm.body_parts,
        otherBodyPart: rootCauseForm.other_body_part,
        damagedEquipment: rootCauseForm.damaged_equipment,
        incidentDescription: rootCauseForm.incident_description,
        unitChiefOpinion: rootCauseForm.unit_chief_opinion,
        safetyExpertName: rootCauseForm.safety_expert_name,
        workplaceDoctorName: rootCauseForm.workplace_doctor_name,
        boardMemberName: rootCauseForm.board_member_name,
        otherEvaluatorName: rootCauseForm.other_evaluator_name,
        recommendedMeasures: rootCauseForm.recommended_measures,
      });

      toast.success("Kök neden araştırma formu Word çıktısı hazırlandı.");
      resetRootCauseModal();
    } catch (error: any) {
      toast.error(`Kök neden araştırma formu oluşturulamadı: ${error.message}`);
    } finally {
      setRootCauseSaving(false);
    }
  }

  async function handleGenerateNearMissReport() {
    if (
      !nearMissForm.report_date ||
      !nearMissForm.report_time ||
      !nearMissForm.reporter_name.trim() ||
      !nearMissForm.reporter_unit_role.trim() ||
      !nearMissForm.incident_description.trim() ||
      !nearMissForm.incident_location.trim()
    ) {
      toast.error("Lütfen olay bildirim formu için zorunlu alanları doldurun.");
      return;
    }

    setNearMissSaving(true);
    try {
      await generateNearMissReportWord({
        reportDate: nearMissForm.report_date,
        reportTime: nearMissForm.report_time,
        reporterName: nearMissForm.reporter_name,
        reporterUnitRole: nearMissForm.reporter_unit_role,
        isExperiencedByReporter: nearMissForm.is_experienced_by_reporter,
        isWitnessedByReporter: nearMissForm.is_witnessed_by_reporter,
        incidentDescription: nearMissForm.incident_description,
        incidentLocation: nearMissForm.incident_location,
        preventionSuggestion: nearMissForm.prevention_suggestion,
        safetyOfficerName: nearMissForm.safety_officer_name,
        plannedActions: nearMissForm.planned_actions,
        signerName: nearMissForm.signer_name,
      });

      toast.success("Ramak kala olay bildirim formu Word çıktısı hazırlandı.");
      resetNearMissModal();
    } catch (error: any) {
      toast.error(`Olay bildirim formu oluşturulamadı: ${error.message}`);
    } finally {
      setNearMissSaving(false);
    }
  }

  async function handleGenerateEmergencyDrillAttendance() {
    if (!emergencyDrillForm.drill_topic.trim() || !emergencyDrillForm.drill_date || !emergencyDrillForm.drill_duration.trim()) {
      toast.error("Lütfen tatbikat konusu, tarihi ve süresini doldurun.");
      return;
    }

    setEmergencyDrillSaving(true);
    try {
      await generateEmergencyDrillAttendanceWord({
        drillTopic: emergencyDrillForm.drill_topic,
        drillDate: emergencyDrillForm.drill_date,
        drillDuration: emergencyDrillForm.drill_duration,
        participants: emergencyDrillForm.participants.map((item) => ({
          fullName: item.full_name,
          tcNumber: item.tc_number,
        })),
      });

      toast.success("Acil durum tatbikatı katılım kayıt formu Word çıktısı hazırlandı.");
      resetEmergencyDrillModal();
    } catch (error: any) {
      toast.error(`Tatbikat katılım formu oluşturulamadı: ${error.message}`);
    } finally {
      setEmergencyDrillSaving(false);
    }
  }

  async function handleGenerateDrillForm() {
    if (!drillForm.workplace_name.trim() || !drillForm.drill_name.trim() || !drillForm.drill_date || drillForm.drill_types.length === 0) {
      toast.error("Lütfen işyeri, tatbikat adı, tarihi ve en az bir tatbikat türü girin.");
      return;
    }

    setDrillFormSaving(true);
    try {
      await generateDrillFormWord({
        workplaceName: drillForm.workplace_name,
        drillName: drillForm.drill_name,
        drillDate: drillForm.drill_date,
        drillTypes: drillForm.drill_types,
        otherDrillType: drillForm.other_drill_type,
        participantCount: drillForm.participant_count,
        assemblyCountResult: drillForm.assembly_count_result,
        startTime: drillForm.start_time,
        endTime: drillForm.end_time,
        drillSubject: drillForm.drill_subject,
        drillPurpose: drillForm.drill_purpose,
        postDrillEvaluation: drillForm.post_drill_evaluation,
        thingsDoneCorrectly: drillForm.things_done_correctly,
        thingsDoneWrong: drillForm.things_done_wrong,
        conclusions: drillForm.conclusions,
        conductorName: drillForm.conductor_name,
        conductorTitle: drillForm.conductor_title,
        approverName: drillForm.approver_name,
      });

      toast.success("Tatbikat formu Word çıktısı hazırlandı.");
      resetDrillFormModal();
    } catch (error: any) {
      toast.error(`Tatbikat formu oluşturulamadı: ${error.message}`);
    } finally {
      setDrillFormSaving(false);
    }
  }

  async function handleGenerateIncidentInvestigationReport() {
    if (
      !incidentInvestigationForm.cause_activity.trim() ||
      !incidentInvestigationForm.where_when.trim() ||
      !incidentInvestigationForm.incident_type.trim() ||
      !incidentInvestigationForm.injured_full_name.trim() ||
      !incidentInvestigationForm.incident_description.trim()
    ) {
      toast.error("Lütfen araştırma raporu için zorunlu alanları doldurun.");
      return;
    }

    setIncidentInvestigationSaving(true);
    try {
      await generateIncidentInvestigationReportWord({
        causeActivity: incidentInvestigationForm.cause_activity,
        whereWhen: incidentInvestigationForm.where_when,
        incidentType: incidentInvestigationForm.incident_type,
        incidentOutcome: incidentInvestigationForm.incident_outcome,
        injuredFullName: incidentInvestigationForm.injured_full_name,
        injuredJobTitle: incidentInvestigationForm.injured_job_title,
        injuredDepartment: incidentInvestigationForm.injured_department,
        injuredAge: incidentInvestigationForm.injured_age,
        insuredNumber: incidentInvestigationForm.insured_number,
        serviceDuration: incidentInvestigationForm.service_duration,
        incidentDescription: incidentInvestigationForm.incident_description,
        riskAnalysisStatus: incidentInvestigationForm.risk_analysis_status,
        hazard: incidentInvestigationForm.hazard,
        risk: incidentInvestigationForm.risk,
        rootCause: incidentInvestigationForm.root_cause,
        correctiveActions: incidentInvestigationForm.corrective_actions,
        witnessOneName: incidentInvestigationForm.witness_one_name,
        witnessOneTitle: incidentInvestigationForm.witness_one_title,
        witnessOneDepartment: incidentInvestigationForm.witness_one_department,
        witnessTwoName: incidentInvestigationForm.witness_two_name,
        witnessTwoTitle: incidentInvestigationForm.witness_two_title,
        witnessTwoDepartment: incidentInvestigationForm.witness_two_department,
        witnessThreeName: incidentInvestigationForm.witness_three_name,
        witnessThreeTitle: incidentInvestigationForm.witness_three_title,
        witnessThreeDepartment: incidentInvestigationForm.witness_three_department,
        reportDate: incidentInvestigationForm.report_date,
        preparedBy: incidentInvestigationForm.prepared_by,
        approvedBy: incidentInvestigationForm.approved_by,
      });

      toast.success("Kaza / olay araştırma raporu Word çıktısı hazırlandı.");
      resetIncidentInvestigationModal();
    } catch (error: any) {
      toast.error(`Araştırma raporu oluşturulamadı: ${error.message}`);
    } finally {
      setIncidentInvestigationSaving(false);
    }
  }

  async function handleGenerateEmployeeRepresentativeAppointment() {
    if (
      !employeeRepresentativeAppointmentForm.workplace_title.trim() ||
      !employeeRepresentativeAppointmentForm.representative_name.trim() ||
      !employeeRepresentativeAppointmentForm.appointment_date ||
      !employeeRepresentativeAppointmentForm.representative_type.trim()
    ) {
      toast.error("Lütfen çalışan temsilcisi formu için zorunlu alanları doldurun.");
      return;
    }

    setEmployeeRepresentativeAppointmentSaving(true);
    try {
      await generateEmployeeRepresentativeAppointmentWord({
        workplaceTitle: employeeRepresentativeAppointmentForm.workplace_title,
        workplaceAddress: employeeRepresentativeAppointmentForm.workplace_address,
        sgkRegistrationNo: employeeRepresentativeAppointmentForm.sgk_registration_no,
        representativeName: employeeRepresentativeAppointmentForm.representative_name,
        representativeTc: employeeRepresentativeAppointmentForm.representative_tc,
        representativeTitle: employeeRepresentativeAppointmentForm.representative_title,
        representativeDepartment: employeeRepresentativeAppointmentForm.representative_department,
        appointmentDate: employeeRepresentativeAppointmentForm.appointment_date,
        documentNumber: employeeRepresentativeAppointmentForm.document_number,
        representativeType: employeeRepresentativeAppointmentForm.representative_type,
        appointmentReason: employeeRepresentativeAppointmentForm.appointment_reason,
        legalBasis: employeeRepresentativeAppointmentForm.legal_basis,
        dutiesAndAuthorities: employeeRepresentativeAppointmentForm.duties_and_authorities,
        communicationMethod: employeeRepresentativeAppointmentForm.communication_method,
        trainingCommitment: employeeRepresentativeAppointmentForm.training_commitment,
        employerName: employeeRepresentativeAppointmentForm.employer_name,
        employerTitle: employeeRepresentativeAppointmentForm.employer_title,
        employeeSignatureName: employeeRepresentativeAppointmentForm.employee_signature_name,
        revisionNo: employeeRepresentativeBundleSettings.revision_no,
        preparedByName: employeeRepresentativeBundleSettings.prepared_by_name,
        preparedByTitle: employeeRepresentativeBundleSettings.prepared_by_title,
        approvedByName: employeeRepresentativeBundleSettings.approved_by_name,
        approvedByTitle: employeeRepresentativeBundleSettings.approved_by_title,
        trainerName: employeeRepresentativeBundleSettings.trainer_name,
        trainerTitle: employeeRepresentativeBundleSettings.trainer_title,
        additionalNotes: employeeRepresentativeAppointmentForm.additional_notes,
      });

      toast.success("Çalışan temsilcisi atama formu Word çıktısı hazırlandı.");
      resetEmployeeRepresentativeAppointmentModal();
    } catch (error: any) {
      toast.error(`Çalışan temsilcisi atama formu oluşturulamadı: ${error.message}`);
    } finally {
      setEmployeeRepresentativeAppointmentSaving(false);
    }
  }

  async function handleGenerateOrientationOnboardingTraining() {
    if (!orientationOnboardingTrainingForm.full_name.trim() || !orientationOnboardingTrainingForm.position.trim()) {
      toast.error("Lütfen oryantasyon ve işbaşı eğitimi formu için zorunlu alanları doldurun.");
      return;
    }

    setOrientationOnboardingTrainingSaving(true);
    try {
      await generateOrientationOnboardingTrainingWord({
        fullName: orientationOnboardingTrainingForm.full_name,
        birthPlaceYear: orientationOnboardingTrainingForm.birth_place_year,
        startDate: orientationOnboardingTrainingForm.start_date,
        educationLevel: orientationOnboardingTrainingForm.education_level,
        position: orientationOnboardingTrainingForm.position,
        orientationDuration: orientationOnboardingTrainingForm.orientation_duration,
        orientationTopics: orientationOnboardingTrainingForm.orientation_topics,
        orientationTrainer: orientationOnboardingTrainingForm.orientation_trainer,
        onboardingDuration: orientationOnboardingTrainingForm.onboarding_duration,
        onboardingTopics: orientationOnboardingTrainingForm.onboarding_topics,
        onboardingTrainer: orientationOnboardingTrainingForm.onboarding_trainer,
        notes: orientationOnboardingTrainingForm.notes,
        traineeSignatureName: orientationOnboardingTrainingForm.trainee_signature_name,
        employerSignatureName: orientationOnboardingTrainingForm.employer_signature_name,
      });

      toast.success("Oryantasyon ve işbaşı eğitimi formu Word çıktısı hazırlandı.");
      resetOrientationOnboardingTrainingModal();
    } catch (error: any) {
      toast.error(`Oryantasyon ve işbaşı eğitimi formu oluşturulamadı: ${error.message}`);
    } finally {
      setOrientationOnboardingTrainingSaving(false);
    }
  }

  return (
    <div className="theme-page-readable mx-auto max-w-[1600px] space-y-8 px-1 pb-6 sm:px-2">
      <section className="relative overflow-hidden rounded-[32px] border border-border/70 bg-gradient-to-br from-slate-50 via-white to-slate-100 px-5 py-6 text-slate-950 shadow-[0_24px_70px_rgba(2,6,23,0.10)] dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 dark:text-slate-50 dark:shadow-[0_30px_90px_rgba(2,6,23,0.32)] sm:px-7 sm:py-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.14),transparent_34%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.22),transparent_34%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200">
              <ShieldCheck className="h-4 w-4" />
              Resmi Belge Modülü
            </div>
            <h1 className="mt-4 flex items-center gap-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white lg:text-4xl">
              <FileText className="h-8 w-8 text-cyan-600 dark:text-cyan-300" />
              İSG Formları ve Atama Yazıları
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300 lg:text-base">
              İSG profesyonelleri için resmi atama, eğitim, olay bildirimi ve tatbikat belgelerini tek ekrandan daha hızlı üretin.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-cyan-500/15 bg-cyan-500/10 px-3 py-1 text-cyan-800 hover:bg-cyan-500/10 dark:border-cyan-400/15 dark:bg-white/10 dark:text-cyan-100 dark:hover:bg-white/10">Word üretimi</Badge>
            <Badge className="border-slate-300 bg-white/80 px-3 py-1 text-slate-800 hover:bg-white/80 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/10">Kurumsal belge akışı</Badge>
            <Badge className="border-slate-300 bg-white/80 px-3 py-1 text-slate-800 hover:bg-white/80 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/10">Mobil uyumlu dialoglar</Badge>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="cardBase overflow-hidden rounded-[28px] border border-border/70 bg-gradient-to-br from-background via-background to-muted/20 shadow-[0_20px_55px_rgba(2,6,23,0.08)]">
          <CardHeader className="space-y-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              Belge Standardı
            </div>
            <CardTitle className="cardTitle text-xl tracking-tight">Daha düzenli, daha hızlı belge üretimi</CardTitle>
            <CardDescription className="cardDescription max-w-3xl text-sm leading-6">
              Kartlar belge türüne göre gruplanır, her form mobil uyumlu dialog ile açılır ve tüm Word çıktıları aynı profesyonel belge akışında oluşturulur.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Belge Sayısı</div>
              <div className="mt-2 text-2xl font-black tracking-tight text-foreground">10+</div>
              <p className="mt-2 text-sm text-muted-foreground">Atama, olay, eğitim ve tatbikat formu tek modülde.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Çıktı Tipi</div>
              <div className="mt-2 text-2xl font-black tracking-tight text-foreground">DOCX</div>
              <p className="mt-2 text-sm text-muted-foreground">Kurumsal Word belgeleriyle düzenli arşiv akışı.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Kullanım Deneyimi</div>
              <div className="mt-2 text-2xl font-black tracking-tight text-foreground">Mobil</div>
              <p className="mt-2 text-sm text-muted-foreground">Dar ekranda taşmayan, rahat doldurulan form dialogları.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cardBase rounded-[28px] border border-border/70 bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-950 shadow-[0_20px_60px_rgba(2,6,23,0.08)] dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 dark:text-slate-50 dark:shadow-[0_20px_60px_rgba(2,6,23,0.28)]">
          <CardHeader className="space-y-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
              Hızlı Bilgi
            </div>
            <CardTitle className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Minimum Süre Kuralı</CardTitle>
            <CardDescription className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              Tehlike sınıfına göre sistem bilgi amaçlı minimum süre uyarısı gösterir.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-2xl border border-slate-300 bg-white/75 p-4 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">Az Tehlikeli: çalışan başına 10 dakika</div>
            <div className="rounded-2xl border border-slate-300 bg-white/75 p-4 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">Tehlikeli: çalışan başına 20 dakika</div>
            <div className="rounded-2xl border border-slate-300 bg-white/75 p-4 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">Çok Tehlikeli: çalışan başına 40 dakika</div>
          </CardContent>
        </Card>
      </section>
      <AssignmentTypeCards
        onCreate={openCreateModal}
        onOpenEmployeeRepresentativeAppointment={openEmployeeRepresentativeAppointmentModal}
        onOpenWorkAccidentReport={openWorkAccidentModal}
        onOpenReturnToWorkTraining={openReturnTrainingModal}
        onOpenRootCauseInvestigation={openRootCauseModal}
        onOpenNearMissReport={openNearMissModal}
        onOpenEmergencyDrillAttendance={openEmergencyDrillModal}
        onOpenDrillForm={openDrillFormModal}
        onOpenIncidentInvestigationReport={openIncidentInvestigationModal}
        onOpenOrientationOnboardingTraining={openOrientationOnboardingTrainingModal}
      />

      <Card className="cardBase rounded-[28px] border border-border/70 bg-gradient-to-br from-background via-background to-muted/20 shadow-[0_18px_50px_rgba(2,6,23,0.06)]">
        <CardHeader>
          <CardTitle className="cardTitle">Belge Ayarları</CardTitle>
          <CardDescription className="cardDescription">
            Tüm atama yazılarında ortak kullanılacak kurum başlığı, belge kodu, yayın no ve imza alanlarını buradan yönetin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="institution_title">Sabit kurum başlığı</Label>
              <Input
                id="institution_title"
                value={letterSettings.institution_title}
                onChange={(event) => setLetterSettings((prev) => ({ ...prev, institution_title: event.target.value }))}
                placeholder="Örn: T.C."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="institution_subtitle">Alt kurum / birim satırı</Label>
              <Input
                id="institution_subtitle"
                value={letterSettings.institution_subtitle}
                onChange={(event) => setLetterSettings((prev) => ({ ...prev, institution_subtitle: event.target.value }))}
                placeholder="Örn: Giresun Üniversitesi İş Sağlığı ve Güvenliği Koordinatörlüğü"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document_code">Belge kodu</Label>
              <Input
                id="document_code"
                value={letterSettings.document_code}
                onChange={(event) => setLetterSettings((prev) => ({ ...prev, document_code: event.target.value }))}
                placeholder="Örn: ISG-BLG-ATM"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publish_number">Yayın no</Label>
              <Input
                id="publish_number"
                value={letterSettings.publish_number}
                onChange={(event) => setLetterSettings((prev) => ({ ...prev, publish_number: event.target.value }))}
                placeholder="Örn: Yayın 02"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revision_date">Revizyon tarihi</Label>
              <Input
                id="revision_date"
                type="date"
                value={letterSettings.revision_date}
                onChange={(event) => setLetterSettings((prev) => ({ ...prev, revision_date: event.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
              <div className="space-y-2">
                <Label htmlFor="left_signature_name">Sol imza alanı adı</Label>
                <Input
                  id="left_signature_name"
                  value={letterSettings.left_signature_name}
                  onChange={(event) => setLetterSettings((prev) => ({ ...prev, left_signature_name: event.target.value }))}
                  placeholder="Örn: İşveren / İşveren Vekili"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="left_signature_title">Sol imza alanı unvanı</Label>
                <Input
                  id="left_signature_title"
                  value={letterSettings.left_signature_title}
                  onChange={(event) => setLetterSettings((prev) => ({ ...prev, left_signature_title: event.target.value }))}
                  placeholder="Örn: Genel Müdür"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
              <div className="space-y-2">
                <Label htmlFor="right_signature_name">Sağ imza alanı adı</Label>
                <Input
                  id="right_signature_name"
                  value={letterSettings.right_signature_name}
                  onChange={(event) => setLetterSettings((prev) => ({ ...prev, right_signature_name: event.target.value }))}
                  placeholder="Boş bırakılırsa atanan personel adı kullanılır"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="right_signature_title">Sağ imza alanı unvanı</Label>
                <Input
                  id="right_signature_title"
                  value={letterSettings.right_signature_title}
                  onChange={(event) => setLetterSettings((prev) => ({ ...prev, right_signature_title: event.target.value }))}
                  placeholder="Boş bırakılırsa personel unvanı kullanılır"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button className="rounded-xl px-5" onClick={handleSaveLetterSettings} disabled={settingsSaving}>
              {settingsSaving ? "Kaydediliyor..." : "Belge Ayarlarını Kaydet"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="cardBase rounded-[28px] border border-border/70 bg-gradient-to-br from-background via-background to-muted/20 shadow-[0_18px_50px_rgba(2,6,23,0.06)]">
        <CardHeader>
          <CardTitle className="cardTitle">Çalışan Temsilcisi Dosya Ayarları</CardTitle>
          <CardDescription className="cardDescription">
            Çalışan temsilcisi dosyasında kullanılacak revizyon no, hazırlayan, onaylayan ve eğitici bilgilerini ayrı olarak yönetin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="employee_rep_revision_no">Revizyon no</Label>
              <Input
                id="employee_rep_revision_no"
                value={employeeRepresentativeBundleSettings.revision_no}
                onChange={(event) =>
                  setEmployeeRepresentativeBundleSettings((prev) => ({ ...prev, revision_no: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee_rep_prepared_by_name">Hazırlayan</Label>
              <Input
                id="employee_rep_prepared_by_name"
                value={employeeRepresentativeBundleSettings.prepared_by_name}
                onChange={(event) =>
                  setEmployeeRepresentativeBundleSettings((prev) => ({ ...prev, prepared_by_name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee_rep_prepared_by_title">Hazırlayan Unvanı</Label>
              <Input
                id="employee_rep_prepared_by_title"
                value={employeeRepresentativeBundleSettings.prepared_by_title}
                onChange={(event) =>
                  setEmployeeRepresentativeBundleSettings((prev) => ({ ...prev, prepared_by_title: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee_rep_approved_by_name">Onaylayan</Label>
              <Input
                id="employee_rep_approved_by_name"
                value={employeeRepresentativeBundleSettings.approved_by_name}
                onChange={(event) =>
                  setEmployeeRepresentativeBundleSettings((prev) => ({ ...prev, approved_by_name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee_rep_approved_by_title">Onaylayan Unvanı</Label>
              <Input
                id="employee_rep_approved_by_title"
                value={employeeRepresentativeBundleSettings.approved_by_title}
                onChange={(event) =>
                  setEmployeeRepresentativeBundleSettings((prev) => ({ ...prev, approved_by_title: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee_rep_trainer_name">Eğitici</Label>
              <Input
                id="employee_rep_trainer_name"
                value={employeeRepresentativeBundleSettings.trainer_name}
                onChange={(event) =>
                  setEmployeeRepresentativeBundleSettings((prev) => ({ ...prev, trainer_name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee_rep_trainer_title">Eğitici Unvanı</Label>
              <Input
                id="employee_rep_trainer_title"
                value={employeeRepresentativeBundleSettings.trainer_title}
                onChange={(event) =>
                  setEmployeeRepresentativeBundleSettings((prev) => ({ ...prev, trainer_title: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button className="rounded-xl px-5" onClick={handleSaveLetterSettings} disabled={settingsSaving}>
              {settingsSaving ? "Kaydediliyor..." : "Temsilci Dosya Ayarlarını Kaydet"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AssignmentHistoryTable
        items={historyItems}
        onDownload={handleDownloadHistoryItem}
        onEdit={handleEditHistoryItem}
        onDelete={handleDeleteHistoryItem}
      />

      <AssignmentFormModal
        open={modalOpen}
        assignmentType={activeType}
        mode={editingId ? "edit" : "create"}
        value={form}
        companies={companies}
        employees={employees}
        saving={saving}
        onOpenChange={(open) => {
          if (!open) {
            resetModalState();
            return;
          }
          setModalOpen(true);
        }}
        onValueChange={(patch) => {
          setForm((prev) => {
            const next = { ...prev, ...patch };
            if (patch.company_id) {
              const company = companies.find((item) => item.id === patch.company_id);
              next.hazard_class = normalizeHazardClass(company?.hazard_class);
            }
            return next;
          });
        }}
        onSubmit={handleCreateAssignment}
      />

      <WorkAccidentReportModal
        open={workAccidentOpen}
        value={workAccidentForm}
        companies={companies}
        employees={employees}
        saving={workAccidentSaving}
        onOpenChange={(open) => {
          if (!open) {
            resetWorkAccidentModal();
            return;
          }
          setWorkAccidentOpen(true);
        }}
        onValueChange={(patch) => {
          setWorkAccidentForm((prev) => {
            const next = { ...prev, ...patch };
            if (patch.company_id) {
              next.employee_id = "";
            }
            if (patch.employee_id) {
              const employee = employees.find((item) => item.id === patch.employee_id);
              if (employee) {
                next.injured_full_name = `${employee.first_name} ${employee.last_name}`.trim();
                next.injured_tc = employee.tc_number || next.injured_tc;
              }
            }
            return next;
          });
        }}
        onSubmit={handleGenerateWorkAccidentReport}
      />

      <ReturnToWorkTrainingModal
        open={returnTrainingOpen}
        value={returnTrainingForm}
        companies={companies}
        employees={employees}
        saving={returnTrainingSaving}
        onOpenChange={(open) => {
          if (!open) {
            resetReturnTrainingModal();
            return;
          }
          setReturnTrainingOpen(true);
        }}
        onValueChange={(patch) => {
          setReturnTrainingForm((prev) => {
            const next = { ...prev, ...patch };

            if (patch.company_id) {
              const company = companies.find((item) => item.id === patch.company_id);
              if (company) {
                next.organization_name = company.company_name || next.organization_name;
                next.address = [company.address, company.district, company.city].filter(Boolean).join(", ") || next.address;
                next.sgk_registration_no = company.sgk_workplace_number || next.sgk_registration_no;
              }
              next.employee_id = "";
              next.participant_name = "";
              next.participant_title = "";
              next.participant_tc = "";
            }

            if (patch.company_mode === "manual") {
              next.company_id = "";
              next.employee_id = "";
              next.employee_mode = "manual";
            }

            if (patch.company_mode === "system") {
              next.employee_id = "";
            }

            if (patch.employee_mode === "manual") {
              next.employee_id = "";
            }

            if (patch.employee_id) {
              const employee = employees.find((item) => item.id === patch.employee_id);
              if (employee) {
                next.participant_name = `${employee.first_name} ${employee.last_name}`.trim();
                next.participant_title = employee.job_title || next.participant_title;
                next.participant_tc = employee.tc_number || next.participant_tc;
              }
            }

            if (patch.employee_mode === "system" && !next.company_id) {
              next.employee_id = "";
            }

            return next;
          });
        }}
        onInstructorChange={(index, patch) => {
          setReturnTrainingForm((prev) => ({
            ...prev,
            instructors: prev.instructors.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
          }));
        }}
        onSubmit={handleGenerateReturnTrainingForm}
      />

      <RootCauseInvestigationModal
        open={rootCauseOpen}
        value={rootCauseForm}
        companies={companies}
        employees={employees}
        saving={rootCauseSaving}
        onOpenChange={(open) => {
          if (!open) {
            resetRootCauseModal();
            return;
          }
          setRootCauseOpen(true);
        }}
        onValueChange={(patch) => {
          setRootCauseForm((prev) => {
            const next = { ...prev, ...patch };

            if (patch.company_id) {
              const company = companies.find((item) => item.id === patch.company_id);
              next.employee_id = "";
              next.unit_name = company?.company_name || next.unit_name;
            }

            if (patch.employee_id) {
              const employee = employees.find((item) => item.id === patch.employee_id);
              if (employee) {
                next.injured_name = `${employee.first_name} ${employee.last_name}`.trim();
                next.task_title = employee.job_title || next.task_title;
              }
            }

            if (patch.company_mode === "manual") {
              next.company_id = "";
              next.employee_id = "";
              next.employee_mode = "manual";
            }

            if (patch.company_mode === "system") {
              next.employee_id = "";
            }

            if (patch.employee_mode === "manual") {
              next.employee_id = "";
            }

            if (patch.manual_company_name && !next.unit_name.trim()) {
              next.unit_name = patch.manual_company_name;
            }

            return next;
          });
        }}
        onToggleEventType={(type, checked) => {
          setRootCauseForm((prev) => ({
            ...prev,
            event_types: checked ? [...prev.event_types, type] : prev.event_types.filter((item) => item !== type),
            other_event_type: !checked && type === "Diğer" ? "" : prev.other_event_type,
          }));
        }}
        onToggleBodyPart={(part, checked) => {
          setRootCauseForm((prev) => ({
            ...prev,
            body_parts: checked ? [...prev.body_parts, part] : prev.body_parts.filter((item) => item !== part),
            other_body_part: !checked && part === "Diğer" ? "" : prev.other_body_part,
          }));
        }}
        onSubmit={handleGenerateRootCauseForm}
      />

      <NearMissReportModal
        open={nearMissOpen}
        value={nearMissForm}
        companies={companies}
        employees={employees}
        saving={nearMissSaving}
        onOpenChange={(open) => {
          if (!open) {
            resetNearMissModal();
            return;
          }
          setNearMissOpen(true);
        }}
        onValueChange={(patch) => {
          setNearMissForm((prev) => {
            const next = { ...prev, ...patch };

            if (patch.company_id) {
              next.employee_id = "";
            }

            if (patch.company_mode === "manual") {
              next.company_id = "";
              next.employee_id = "";
              next.employee_mode = "manual";
            }

            if (patch.company_mode === "system") {
              next.employee_id = "";
            }

            if (patch.employee_mode === "manual") {
              next.employee_id = "";
            }

            if (patch.employee_id) {
              const employee = employees.find((item) => item.id === patch.employee_id);
              if (employee) {
                next.reporter_name = `${employee.first_name} ${employee.last_name}`.trim();
                next.reporter_unit_role = [employee.department, employee.job_title].filter(Boolean).join(" - ") || employee.job_title || next.reporter_unit_role;
                next.signer_name = `${employee.first_name} ${employee.last_name}`.trim();
              }
            }

            return next;
          });
        }}
        onSubmit={handleGenerateNearMissReport}
      />

      <EmergencyDrillAttendanceModal
        open={emergencyDrillOpen}
        value={emergencyDrillForm}
        saving={emergencyDrillSaving}
        onOpenChange={(open) => {
          if (!open) {
            resetEmergencyDrillModal();
            return;
          }
          setEmergencyDrillOpen(true);
        }}
        onValueChange={(patch) => {
          setEmergencyDrillForm((prev) => ({ ...prev, ...patch }));
        }}
        onParticipantChange={(index, patch) => {
          setEmergencyDrillForm((prev) => ({
            ...prev,
            participants: prev.participants.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
          }));
        }}
        onSubmit={handleGenerateEmergencyDrillAttendance}
      />

      <DrillFormModal
        open={drillFormOpen}
        value={drillForm}
        saving={drillFormSaving}
        onOpenChange={(open) => {
          if (!open) {
            resetDrillFormModal();
            return;
          }
          setDrillFormOpen(true);
        }}
        onValueChange={(patch) => {
          setDrillForm((prev) => ({ ...prev, ...patch }));
        }}
        onToggleDrillType={(type, checked) => {
          setDrillForm((prev) => ({
            ...prev,
            drill_types: checked ? [...prev.drill_types, type] : prev.drill_types.filter((item) => item !== type),
            other_drill_type: !checked && type === "Diğer" ? "" : prev.other_drill_type,
          }));
        }}
        onSubmit={handleGenerateDrillForm}
      />

      <EmployeeRepresentativeAppointmentModal
        open={employeeRepresentativeAppointmentOpen}
        value={employeeRepresentativeAppointmentForm}
        companies={companies}
        employees={employees}
        saving={employeeRepresentativeAppointmentSaving}
        onOpenChange={(open) => {
          if (!open) {
            resetEmployeeRepresentativeAppointmentModal();
            return;
          }
          setEmployeeRepresentativeAppointmentOpen(true);
        }}
        onValueChange={(patch) => {
          setEmployeeRepresentativeAppointmentForm((prev) => {
            const next = { ...prev, ...patch };

            if (patch.company_id) {
              const company = companies.find((item) => item.id === patch.company_id);
              if (company) {
                next.workplace_title = company.company_name || next.workplace_title;
                next.workplace_address = [company.address, company.district, company.city].filter(Boolean).join(", ") || next.workplace_address;
                next.sgk_registration_no = company.sgk_workplace_number || next.sgk_registration_no;
              }
              next.employee_id = "";
            }

            if (patch.company_mode === "manual") {
              next.company_id = "";
              next.employee_id = "";
              next.employee_mode = "manual";
            }

            if (patch.company_mode === "system") {
              next.employee_id = "";
            }

            if (patch.employee_mode === "manual") {
              next.employee_id = "";
            }

            if (patch.employee_id) {
              const employee = employees.find((item) => item.id === patch.employee_id);
              if (employee) {
                const fullName = `${employee.first_name} ${employee.last_name}`.trim();
                next.representative_name = fullName;
                next.representative_tc = employee.tc_number || next.representative_tc;
                next.representative_title = employee.job_title || next.representative_title;
                next.representative_department = employee.department || next.representative_department;
                next.employee_signature_name = fullName;
              }
            }

            if (patch.manual_company_name && !next.workplace_title.trim()) {
              next.workplace_title = patch.manual_company_name;
            }

            return next;
          });
        }}
        onSubmit={handleGenerateEmployeeRepresentativeAppointment}
      />

      <OrientationOnboardingTrainingModal
        open={orientationOnboardingTrainingOpen}
        value={orientationOnboardingTrainingForm}
        saving={orientationOnboardingTrainingSaving}
        onOpenChange={(open) => {
          if (!open) {
            resetOrientationOnboardingTrainingModal();
            return;
          }
          setOrientationOnboardingTrainingOpen(true);
        }}
        onValueChange={(patch) => {
          setOrientationOnboardingTrainingForm((prev) => ({ ...prev, ...patch }));
        }}
        onTopicStatusChange={(section, topic, status) => {
          setOrientationOnboardingTrainingForm((prev) => ({
            ...prev,
            [section]: {
              ...prev[section],
              [topic]: status,
            },
          }));
        }}
        onSubmit={handleGenerateOrientationOnboardingTraining}
      />

      <IncidentInvestigationReportModal
        open={incidentInvestigationOpen}
        value={incidentInvestigationForm}
        saving={incidentInvestigationSaving}
        onOpenChange={(open) => {
          if (!open) {
            resetIncidentInvestigationModal();
            return;
          }
          setIncidentInvestigationOpen(true);
        }}
        onValueChange={(patch) => {
          setIncidentInvestigationForm((prev) => ({ ...prev, ...patch }));
        }}
        onSubmit={handleGenerateIncidentInvestigationReport}
      />

      {loading ? <div className="text-sm text-muted-foreground">Atama yazıları yükleniyor...</div> : null}
    </div>
  );
}
