import { supabase } from "@/integrations/supabase/client";

export type OsgbRole = "igu" | "hekim" | "dsp";
export type OsgbComplianceStatus = "compliant" | "warning" | "overdue" | "missing" | "not_applicable";

export interface OsgbWorkspaceCompanyOption {
  id: string;
  companyName: string;
  hazardClass: string;
  employeeCount: number;
  complianceStatus: OsgbComplianceStatus;
  contractEnd: string | null;
  totalRequiredMinutes: number;
  totalAssignedMinutes: number;
  deficitMinutes: number;
  overtimeMinutes: number;
  requiredMinutesByRole: Record<OsgbRole, number>;
  assignedMinutesByRole: Record<OsgbRole, number>;
}

export interface OsgbWorkspaceAssignmentRecord {
  id: string;
  organization_id: string | null;
  company_id: string;
  personnel_id: string;
  assigned_role: OsgbRole;
  assigned_minutes: number;
  start_date: string | null;
  end_date: string | null;
  status: "active" | "passive" | "completed" | "cancelled";
  notes: string | null;
  service_month: string | null;
  legal_basis: string | null;
  created_at: string;
  updated_at: string;
  company?: { company_name: string | null } | null;
  personnel?: { full_name: string | null; role: string | null; monthly_capacity_minutes?: number | null } | null;
}

export interface OsgbWorkspacePersonnelRecord {
  id: string;
  full_name: string;
  role: OsgbRole;
  monthly_capacity_minutes: number;
  is_active: boolean;
  certificate_expiry_date: string | null;
}

export interface OsgbComplianceCompanyRecord {
  companyId: string;
  companyName: string;
  employeeCount: number;
  hazardClass: string;
  complianceStatus: OsgbComplianceStatus;
  totalRequiredMinutes: number;
  totalAssignedMinutes: number;
  deficitMinutes: number;
  overtimeMinutes: number;
  contractEnd: string | null;
  packageName: string | null;
  collectionRiskScore: number;
  profitabilityScore: number;
  estimatedMonthlyMargin: number;
  overdueBalance: number;
  currentBalance: number;
  requiredMinutesByRole: Record<OsgbRole, number>;
  assignedMinutesByRole: Record<OsgbRole, number>;
}

export interface OsgbPlatformObligationRecord {
  id: string;
  companyId: string;
  companyName: string;
  obligationName: string;
  status: OsgbComplianceStatus;
  dueDate: string | null;
  legalBasis: string;
  riskIfMissing: string | null;
  responsibleRole: string | null;
}

export interface OsgbPlatformContractRecord {
  id: string;
  companyId: string;
  companyName: string;
  packageName: string;
  contractStatus: string;
  monthlyFee: number;
  startsOn: string;
  endsOn: string | null;
}

export interface OsgbPersonnelCapacityRecord {
  personnelId: string;
  fullName: string;
  role: OsgbRole;
  monthlyCapacityMinutes: number;
  assignedMinutes: number;
  remainingMinutes: number;
  utilizationRatio: number;
  activeCompanyCount: number;
  overloaded: boolean;
}

export interface OsgbPlatformDashboardSummary {
  totalCompanies: number;
  compliantCompanies: number;
  companiesWithGap: number;
  totalDeficitMinutes: number;
  totalOvertimeMinutes: number;
  activeContracts: number;
  expiringContracts: number;
  overdueObligations: number;
  warningObligations: number;
  overdueBalance: number;
  averageMargin: number;
}

export interface OsgbPlatformDashboardData {
  serviceMonth: string;
  summary: OsgbPlatformDashboardSummary;
  complianceRows: OsgbComplianceCompanyRecord[];
  obligationRows: OsgbPlatformObligationRecord[];
  contractRows: OsgbPlatformContractRecord[];
  personnelLoads: OsgbPersonnelCapacityRecord[];
}

export type OsgbFieldVisitStatus = "planned" | "in_progress" | "completed" | "missed" | "cancelled";
export type OsgbFieldVisitType =
  | "onsite_visit"
  | "board_meeting"
  | "training"
  | "risk_review"
  | "emergency_drill"
  | "health_surveillance"
  | "periodic_control"
  | "document_delivery"
  | "remote_consulting";
export type OsgbEvidenceType =
  | "photo"
  | "signature"
  | "attendance_sheet"
  | "meeting_minutes"
  | "training_record"
  | "gps"
  | "document"
  | "note";
export type OsgbRequiredDocumentStatus = "missing" | "submitted" | "approved" | "rejected";
export type OsgbRiskLevel = "low" | "medium" | "high" | "critical";
export type OsgbFinancialEntryType = "invoice" | "payment" | "adjustment";
export type OsgbFinancialEntryStatus = "draft" | "open" | "paid" | "cancelled" | "overdue" | "posted";

export interface OsgbFieldVisitEvidenceRecord {
  id: string;
  type: OsgbEvidenceType;
  title: string;
  fileUrl: string | null;
  metadata: Record<string, any>;
  capturedAt: string;
}

export interface OsgbFieldVisitPersonnelRecord {
  id: string;
  personnelId: string | null;
  profileId: string | null;
  fullName: string;
  role: string;
  attended: boolean;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  signedAt: string | null;
}

export interface OsgbFieldVisitRecord {
  id: string;
  organizationId: string;
  companyId: string;
  companyName: string;
  contractId: string | null;
  plannedAt: string;
  plannedEndAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  status: OsgbFieldVisitStatus;
  visitType: OsgbFieldVisitType;
  visitAddress: string | null;
  checkInLocation: string | null;
  checkOutLocation: string | null;
  durationMinutes: number;
  notes: string | null;
  nextActionSummary: string | null;
  complianceImpactMinutes: number;
  createdBy: string | null;
  assignedPersonnel: OsgbFieldVisitPersonnelRecord[];
  evidence: OsgbFieldVisitEvidenceRecord[];
  proofScore: number;
  proofLevel: "Yetersiz" | "Orta" | "Güçlü";
  proofMissingReasons: string[];
  hasEnoughEvidence: boolean;
}

export interface OsgbFieldVisitSummary {
  totalVisits: number;
  completedVisits: number;
  inProgressVisits: number;
  missingProofVisits: number;
  totalComplianceImpactMinutes: number;
}

export interface OsgbFieldVisitWorkspaceData {
  serviceMonth: string;
  summary: OsgbFieldVisitSummary;
  visits: OsgbFieldVisitRecord[];
  companies: OsgbWorkspaceCompanyOption[];
  personnel: OsgbWorkspacePersonnelRecord[];
}

export interface OsgbRequiredDocumentRecord {
  id: string;
  organizationId: string;
  companyId: string;
  companyName: string;
  obligationId: string | null;
  obligationName: string | null;
  fieldVisitId: string | null;
  fieldVisitLabel: string | null;
  documentType: string;
  requiredReason: string;
  riskIfMissing: string | null;
  dueDate: string | null;
  status: OsgbRequiredDocumentStatus;
  delayDays: number;
  riskLevel: OsgbRiskLevel;
  legalBasis: string | null;
  nextAction: string;
}

export interface OsgbRequiredDocumentsOverview {
  total: number;
  missing: number;
  overdue: number;
  critical: number;
}

export interface OsgbRequiredDocumentsWorkspaceData {
  documents: OsgbRequiredDocumentRecord[];
  overview: OsgbRequiredDocumentsOverview;
}

export interface OsgbFinancialEntryRecord {
  id: string;
  organizationId: string;
  companyId: string;
  companyName: string;
  financeAccountId: string | null;
  contractId: string | null;
  serviceMonth: string | null;
  type: OsgbFinancialEntryType;
  amount: number;
  entryDate: string;
  dueDate: string | null;
  status: OsgbFinancialEntryStatus;
  description: string | null;
}

export interface OsgbFinanceCompanySnapshot {
  companyId: string;
  companyName: string;
  packageName: string | null;
  monthlyFee: number;
  currentBalance: number;
  overdueBalance: number;
  collectionRiskScore: number;
  profitabilityScore: number;
  estimatedMonthlyMargin: number;
  estimatedCost: number;
  expectedRevenue: number;
  paymentPerformanceLabel: string;
  needsAttention: boolean;
  lowProfitability: boolean;
  openInvoices: number;
  lateInvoiceCount: number;
}

export interface OsgbFinanceWorkspaceData {
  serviceMonth: string;
  companies: OsgbFinanceCompanySnapshot[];
  entries: OsgbFinancialEntryRecord[];
  totalCurrentBalance: number;
  totalOverdueBalance: number;
  lowProfitabilityCount: number;
  latePayerCount: number;
}

export interface OsgbWorkspaceAssignmentRecommendation {
  role: OsgbRole;
  recommendedMinutes: number;
  currentAssignedMinutes: number;
  remainingGapMinutes: number;
  legalReference: string;
  summary: string;
}

const getServiceMonth = (value?: Date | string | null) => {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
};

const getServiceMonthEnd = (value?: Date | string | null) => {
  const month = getServiceMonth(value);
  const date = new Date(`${month}T00:00:00`);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
};

const daysUntil = (value: string | null) => {
  if (!value) return null;
  const now = new Date();
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  return Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

const emptyRoleMap = (): Record<OsgbRole, number> => ({
  igu: 0,
  hekim: 0,
  dsp: 0,
});

const normalizeComplianceStatus = (value: string | null | undefined): OsgbComplianceStatus => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "warning") return "warning";
  if (normalized === "overdue") return "overdue";
  if (normalized === "missing") return "missing";
  if (normalized === "not_applicable") return "not_applicable";
  return "compliant";
};

const normalizeRiskLevel = (value: string | null | undefined): OsgbRiskLevel => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "low") return "low";
  if (normalized === "high") return "high";
  if (normalized === "critical") return "critical";
  return "medium";
};

const guessDocumentType = (obligationName: string) => {
  const normalized = obligationName.toLocaleLowerCase("tr-TR");
  if (normalized.includes("risk")) return "risk_degerlendirmesi";
  if (normalized.includes("kurul")) return "kurul_tutanagi";
  if (normalized.includes("eğitim") || normalized.includes("egitim")) return "egitim_kaydi";
  if (normalized.includes("acil")) return "acil_durum_belgesi";
  if (normalized.includes("tatbikat")) return "tatbikat_kaydi";
  if (normalized.includes("sağlık") || normalized.includes("saglik")) return "saglik_kaydi";
  return "yasal_evrak";
};

const deriveDocumentRiskLevel = (obligationStatus: string, riskText: string | null | undefined): OsgbRiskLevel => {
  if (obligationStatus === "missing" || obligationStatus === "overdue") return "critical";
  const risk = (riskText || "").toLocaleLowerCase("tr-TR");
  if (risk.includes("durdurma") || risk.includes("ceza")) return "high";
  if (risk.includes("yaralan") || risk.includes("denetim")) return "high";
  return "medium";
};

const buildLocationText = (lat: number | null | undefined, lng: number | null | undefined) => {
  if (lat == null || lng == null) return null;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};

const calculateVisitDuration = (startAt: string | null | undefined, endAt: string | null | undefined) => {
  if (!startAt || !endAt) return 0;
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60)));
};

const calculateProofState = (
  visit: {
    startedAt: string | null;
    completedAt: string | null;
    checkInLocation: string | null;
    checkOutLocation: string | null;
  },
  evidence: OsgbFieldVisitEvidenceRecord[],
  personnel: OsgbFieldVisitPersonnelRecord[],
) => {
  let score = 0;
  const reasons: string[] = [];

  if (visit.startedAt) score += 15;
  else reasons.push("Başlangıç kaydı yok");

  if (visit.completedAt) score += 15;
  else reasons.push("Tamamlanma kaydı yok");

  if (visit.checkInLocation) score += 20;
  else reasons.push("Check-in konumu eksik");

  if (visit.checkOutLocation) score += 10;
  else reasons.push("Check-out konumu eksik");

  const photoCount = evidence.filter((item) => item.type === "photo").length;
  const documentCount = evidence.filter((item) => item.type === "document" || item.type === "meeting_minutes" || item.type === "training_record").length;
  const signatureCount = evidence.filter((item) => item.type === "signature").length;
  const attendedCount = personnel.filter((item) => item.attended).length;
  const signedPersonnelCount = personnel.filter((item) => !!item.signedAt).length;

  score += Math.min(20, photoCount * 10);
  if (photoCount === 0) reasons.push("Fotoğraf kanıtı yok");

  score += Math.min(10, documentCount * 10);
  if (documentCount === 0) reasons.push("Tutanak veya belge kanıtı yok");

  score += Math.min(20, signatureCount * 20);
  if (signatureCount === 0 && signedPersonnelCount === 0) reasons.push("İmza kanıtı yok");

  score += attendedCount > 0 ? 10 : 0;
  if (attendedCount === 0) reasons.push("Katılan personel doğrulanmamış");

  if (score >= 80) {
    return { score, level: "Güçlü" as const, reasons };
  }
  if (score >= 45) {
    return { score, level: "Orta" as const, reasons };
  }
  return { score, level: "Yetersiz" as const, reasons };
};

const legalReferences: Record<OsgbRole, string> = {
  igu: "6331 sayılı Kanun ve iş güvenliği uzmanı görevlendirme süreleri",
  hekim: "6331 sayılı Kanun ve işyeri hekimi görevlendirme süreleri",
  dsp: "6331 sayılı Kanun ve diğer sağlık personeli görevlendirme süreleri",
};

const listManagedOsgbCompanyIds = async (organizationId: string): Promise<string[]> => {
  const { data, error } = await (supabase as any)
    .from("isgkatip_companies")
    .select("id")
    .eq("org_id", organizationId)
    .eq("is_deleted", false)
    .eq("is_osgb_managed", true);

  if (error) throw error;
  return (data ?? []).map((row: any) => row.id).filter(Boolean);
};

export const refreshOsgbMonthlyCompliance = async (organizationId: string, serviceMonth = getServiceMonth()) => {
  const { error } = await (supabase as any).rpc("refresh_osgb_monthly_compliance", {
    p_organization_id: organizationId,
    p_service_month: serviceMonth,
  });

  if (error) throw error;
};

export const listOsgbWorkspaceCompanies = async (
  organizationId: string,
  serviceMonth = getServiceMonth(),
): Promise<OsgbWorkspaceCompanyOption[]> => {
  const managedCompanyIds = await listManagedOsgbCompanyIds(organizationId);
  if (managedCompanyIds.length === 0) {
    return [];
  }

  const [companiesResponse, complianceResponse, contractsResponse] = await Promise.all([
    (supabase as any)
      .from("isgkatip_companies")
      .select("id, company_name, hazard_class, employee_count")
      .eq("org_id", organizationId)
      .eq("is_deleted", false)
      .eq("is_osgb_managed", true)
      .in("id", managedCompanyIds)
      .order("company_name", { ascending: true }),
    (supabase as any)
      .from("osgb_monthly_company_compliance")
      .select(`
        company_id,
        hazard_class,
        employee_count,
        compliance_status,
        igu_required_minutes,
        hekim_required_minutes,
        dsp_required_minutes,
        igu_assigned_minutes,
        hekim_assigned_minutes,
        dsp_assigned_minutes,
        deficit_minutes,
        overtime_minutes,
        company:isgkatip_companies(company_name)
      `)
      .eq("organization_id", organizationId)
      .in("company_id", managedCompanyIds)
      .eq("service_month", serviceMonth)
      .order("deficit_minutes", { ascending: false }),
    (supabase as any)
      .from("osgb_service_contracts")
      .select("company_id, ends_on, contract_status")
      .eq("organization_id", organizationId)
      .in("company_id", managedCompanyIds)
      .in("contract_status", ["active", "paused"])
      .order("updated_at", { ascending: false }),
  ]);

  if (companiesResponse.error) throw companiesResponse.error;
  if (complianceResponse.error) throw complianceResponse.error;
  if (contractsResponse.error) throw contractsResponse.error;

  const contractsByCompany = new Map<string, { ends_on: string | null }>();
  for (const contract of contractsResponse.data ?? []) {
    if (!contractsByCompany.has(contract.company_id)) {
      contractsByCompany.set(contract.company_id, { ends_on: contract.ends_on || null });
    }
  }

  const complianceByCompany = new Map<string, any>();
  for (const row of complianceResponse.data ?? []) {
    complianceByCompany.set(row.company_id, row);
  }

  return (companiesResponse.data ?? []).map((company: any) => {
    const compliance = complianceByCompany.get(company.id);
    return {
      id: company.id,
      companyName: company.company_name || "Firma",
      hazardClass: compliance?.hazard_class || company.hazard_class || "Bilinmiyor",
      employeeCount: compliance?.employee_count || company.employee_count || 0,
      complianceStatus: normalizeComplianceStatus(compliance?.compliance_status),
      contractEnd: contractsByCompany.get(company.id)?.ends_on || null,
      totalRequiredMinutes:
        (compliance?.igu_required_minutes || 0) +
        (compliance?.hekim_required_minutes || 0) +
        (compliance?.dsp_required_minutes || 0),
      totalAssignedMinutes:
        (compliance?.igu_assigned_minutes || 0) +
        (compliance?.hekim_assigned_minutes || 0) +
        (compliance?.dsp_assigned_minutes || 0),
      deficitMinutes: compliance?.deficit_minutes || 0,
      overtimeMinutes: compliance?.overtime_minutes || 0,
      requiredMinutesByRole: {
        igu: compliance?.igu_required_minutes || 0,
        hekim: compliance?.hekim_required_minutes || 0,
        dsp: compliance?.dsp_required_minutes || 0,
      },
      assignedMinutesByRole: {
        igu: compliance?.igu_assigned_minutes || 0,
        hekim: compliance?.hekim_assigned_minutes || 0,
        dsp: compliance?.dsp_assigned_minutes || 0,
      },
    };
  });
};

export const listOsgbWorkspacePersonnel = async (
  organizationId: string,
  activeOnly = false,
): Promise<OsgbWorkspacePersonnelRecord[]> => {
  let query = (supabase as any)
    .from("osgb_personnel")
    .select("id, full_name, role, monthly_capacity_minutes, is_active, certificate_expiry_date")
    .eq("organization_id", organizationId)
    .order("full_name", { ascending: true });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OsgbWorkspacePersonnelRecord[];
};

export const listOsgbWorkspaceAssignmentsPage = async (
  organizationId: string,
  params: { page: number; pageSize: number; status?: string; search?: string },
): Promise<{ rows: OsgbWorkspaceAssignmentRecord[]; count: number }> => {
  const { page, pageSize, status, search } = params;
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  let query = (supabase as any)
    .from("osgb_assignments")
    .select("*, company:isgkatip_companies(company_name), personnel:osgb_personnel(full_name, role, monthly_capacity_minutes)", { count: "exact" })
    .eq("organization_id", organizationId);

  if (status && status !== "ALL") {
    query = query.eq("status", status);
  }

  if (search?.trim()) {
    const term = search.trim().replace(/,/g, " ");
    const [companyResult, personnelResult] = await Promise.all([
      (supabase as any)
        .from("isgkatip_companies")
        .select("id")
        .eq("org_id", organizationId)
        .eq("is_deleted", false)
        .ilike("company_name", `%${term}%`)
        .limit(100),
      (supabase as any)
        .from("osgb_personnel")
        .select("id")
        .eq("organization_id", organizationId)
        .ilike("full_name", `%${term}%`)
        .limit(100),
    ]);

    if (companyResult.error) throw companyResult.error;
    if (personnelResult.error) throw personnelResult.error;

    const companyIds = (companyResult.data ?? []).map((item: any) => item.id);
    const personnelIds = (personnelResult.data ?? []).map((item: any) => item.id);
    const conditions = [`notes.ilike.%${term}%`, `assigned_role.ilike.%${term}%`];

    if (companyIds.length > 0) {
      conditions.push(`company_id.in.(${companyIds.join(",")})`);
    }
    if (personnelIds.length > 0) {
      conditions.push(`personnel_id.in.(${personnelIds.join(",")})`);
    }

    query = query.or(conditions.join(","));
  }

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw error;
  return { rows: (data ?? []) as OsgbWorkspaceAssignmentRecord[], count: count ?? 0 };
};

export const getOsgbWorkspacePersonnelAssignedMinutesTotal = async (
  organizationId: string,
  personnelId: string,
  assignmentId?: string,
) => {
  let query = (supabase as any)
    .from("osgb_assignments")
    .select("assigned_minutes")
    .eq("organization_id", organizationId)
    .eq("personnel_id", personnelId)
    .eq("status", "active");

  if (assignmentId) {
    query = query.neq("id", assignmentId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).reduce((sum: number, item: any) => sum + Number(item.assigned_minutes || 0), 0);
};

export const getOsgbWorkspaceCompanyAssignedMinutesTotal = async (
  organizationId: string,
  companyId: string,
  role?: OsgbRole,
  assignmentId?: string,
) => {
  let query = (supabase as any)
    .from("osgb_assignments")
    .select("assigned_minutes")
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .eq("status", "active");

  if (role) {
    query = query.eq("assigned_role", role);
  }

  if (assignmentId) {
    query = query.neq("id", assignmentId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).reduce((sum: number, item: any) => sum + Number(item.assigned_minutes || 0), 0);
};

export const getCompanyActiveAssignmentInWorkspace = async (
  organizationId: string,
  companyId: string,
  role: OsgbRole,
  assignmentId?: string,
) => {
  let query = (supabase as any)
    .from("osgb_assignments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .eq("assigned_role", role)
    .eq("status", "active")
    .limit(1);

  if (assignmentId) {
    query = query.neq("id", assignmentId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).length > 0;
};

export const upsertOsgbAssignmentWorkspace = async (
  userId: string,
  organizationId: string,
  input: {
    companyId: string;
    personnelId: string;
    assignedRole: OsgbRole;
    assignedMinutes: number;
    startDate?: string | null;
    endDate?: string | null;
    status?: OsgbWorkspaceAssignmentRecord["status"];
    notes?: string | null;
    serviceMonth?: string | null;
  },
  id?: string,
) => {
  const hasDuplicate = input.status === "active" || !input.status
    ? await getCompanyActiveAssignmentInWorkspace(organizationId, input.companyId, input.assignedRole, id)
    : false;

  if (hasDuplicate) {
    throw new Error("Bu firmada seçilen rol için zaten aktif bir görevlendirme var.");
  }

  const payload = {
    user_id: userId,
    organization_id: organizationId,
    company_id: input.companyId,
    personnel_id: input.personnelId,
    assigned_role: input.assignedRole,
    assigned_minutes: input.assignedMinutes,
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    status: input.status || "active",
    notes: input.notes || null,
    service_month: input.serviceMonth || getServiceMonth(),
    updated_at: new Date().toISOString(),
  };

  const query = id
    ? (supabase as any).from("osgb_assignments").update(payload).eq("id", id)
    : (supabase as any).from("osgb_assignments").insert(payload);

  const { data, error } = await query
    .select("*, company:isgkatip_companies(company_name), personnel:osgb_personnel(full_name, role, monthly_capacity_minutes)")
    .single();

  if (error) throw error;
  return data as OsgbWorkspaceAssignmentRecord;
};

export const getOsgbPersonnelCapacityPanel = async (
  organizationId: string,
  serviceMonth = getServiceMonth(),
): Promise<OsgbPersonnelCapacityRecord[]> => {
  const managedCompanyIds = await listManagedOsgbCompanyIds(organizationId);
  const personnelResponse = await listOsgbWorkspacePersonnel(organizationId, true);

  if (managedCompanyIds.length === 0) {
    return personnelResponse.map((person) => ({
      personnelId: person.id,
      fullName: person.full_name,
      role: person.role,
      monthlyCapacityMinutes: person.monthly_capacity_minutes,
      assignedMinutes: 0,
      remainingMinutes: person.monthly_capacity_minutes,
      utilizationRatio: 0,
      activeCompanyCount: 0,
      overloaded: false,
    }));
  }

  const assignmentsResponse = await (supabase as any)
    .from("osgb_assignments")
    .select("personnel_id, assigned_minutes, company_id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .eq("service_month", serviceMonth)
    .in("company_id", managedCompanyIds);

  if (assignmentsResponse.error) throw assignmentsResponse.error;

  const aggregates = new Map<string, { minutes: number; companyIds: Set<string> }>();
  for (const row of assignmentsResponse.data ?? []) {
    const current = aggregates.get(row.personnel_id) || { minutes: 0, companyIds: new Set<string>() };
    current.minutes += Number(row.assigned_minutes || 0);
    if (row.company_id) current.companyIds.add(row.company_id);
    aggregates.set(row.personnel_id, current);
  }

  return personnelResponse.map((person) => {
    const aggregate = aggregates.get(person.id);
    const assignedMinutes = aggregate?.minutes || 0;
    const remainingMinutes = person.monthly_capacity_minutes - assignedMinutes;
    const utilizationRatio = person.monthly_capacity_minutes > 0
      ? Math.round((assignedMinutes / person.monthly_capacity_minutes) * 100)
      : 0;

    return {
      personnelId: person.id,
      fullName: person.full_name,
      role: person.role,
      monthlyCapacityMinutes: person.monthly_capacity_minutes,
      assignedMinutes,
      remainingMinutes,
      utilizationRatio,
      activeCompanyCount: aggregate?.companyIds.size || 0,
      overloaded: remainingMinutes < 0 || utilizationRatio >= 100,
    };
  }).sort((left, right) => {
    if (left.overloaded !== right.overloaded) return left.overloaded ? -1 : 1;
    return right.utilizationRatio - left.utilizationRatio;
  });
};

export const getOsgbWorkspaceAssignmentRecommendation = (
  company: OsgbWorkspaceCompanyOption | null | undefined,
  role: OsgbRole,
  currentAssignedMinutes = 0,
): OsgbWorkspaceAssignmentRecommendation | null => {
  if (!company) return null;

  const recommendedMinutes = company.requiredMinutesByRole[role] || 0;
  const remainingGapMinutes = Math.max(0, recommendedMinutes - currentAssignedMinutes);
  const roleName = role === "igu" ? "İSG uzmanı" : role === "hekim" ? "işyeri hekimi" : "DSP";

  return {
    role,
    recommendedMinutes,
    currentAssignedMinutes,
    remainingGapMinutes,
    legalReference: legalReferences[role],
    summary:
      recommendedMinutes > 0
        ? `${company.companyName} için ${company.employeeCount} çalışan ve ${company.hazardClass} sınıfına göre ${roleName} ihtiyacı ${recommendedMinutes} dk/ay.`
        : `${company.companyName} için seçili rol bazında hesaplanan zorunlu süre görünmüyor.`,
  };
};

export const getOsgbPlatformDashboard = async (
  organizationId: string,
  options?: { refreshCompliance?: boolean; serviceMonth?: string },
): Promise<OsgbPlatformDashboardData> => {
  const serviceMonth = options?.serviceMonth || getServiceMonth();
  const managedCompanyIds = await listManagedOsgbCompanyIds(organizationId);

  if (options?.refreshCompliance !== false) {
    await refreshOsgbMonthlyCompliance(organizationId, serviceMonth);
  }

  if (managedCompanyIds.length === 0) {
    const personnelLoads = await getOsgbPersonnelCapacityPanel(organizationId, serviceMonth);
    return {
      serviceMonth,
      summary: {
        totalCompanies: 0,
        compliantCompanies: 0,
        companiesWithGap: 0,
        totalDeficitMinutes: 0,
        totalOvertimeMinutes: 0,
        activeContracts: 0,
        expiringContracts: 0,
        overdueObligations: 0,
        warningObligations: 0,
        overdueBalance: 0,
        averageMargin: 0,
      },
      complianceRows: [],
      obligationRows: [],
      contractRows: [],
      personnelLoads,
    };
  }

  const [complianceResponse, obligationsResponse, contractsResponse, profitabilityResponse, personnelLoads] = await Promise.all([
    (supabase as any)
      .from("osgb_monthly_company_compliance")
      .select(`
        company_id,
        employee_count,
        hazard_class,
        igu_required_minutes,
        hekim_required_minutes,
        dsp_required_minutes,
        igu_assigned_minutes,
        hekim_assigned_minutes,
        dsp_assigned_minutes,
        deficit_minutes,
        overtime_minutes,
        compliance_status,
        company:isgkatip_companies(company_name)
      `)
      .eq("organization_id", organizationId)
      .in("company_id", managedCompanyIds)
      .eq("service_month", serviceMonth)
      .order("deficit_minutes", { ascending: false }),
    (supabase as any)
      .from("osgb_company_obligations")
      .select(`
        id,
        company_id,
        obligation_name,
        obligation_status,
        due_date,
        legal_basis,
        risk_if_missing,
        responsible_role,
        company:isgkatip_companies(company_name)
      `)
      .eq("organization_id", organizationId)
      .in("company_id", managedCompanyIds)
      .in("obligation_status", ["warning", "overdue", "missing"])
      .order("due_date", { ascending: true }),
    (supabase as any)
      .from("osgb_service_contracts")
      .select(`
        id,
        company_id,
        package_name,
        contract_status,
        monthly_fee,
        starts_on,
        ends_on,
        company:isgkatip_companies(company_name)
      `)
      .eq("organization_id", organizationId)
      .in("company_id", managedCompanyIds)
      .in("contract_status", ["active", "paused", "expired"])
      .order("ends_on", { ascending: true }),
    (supabase as any)
      .from("v_osgb_company_profitability")
      .select("*")
      .eq("organization_id", organizationId)
      .in("company_id", managedCompanyIds),
    getOsgbPersonnelCapacityPanel(organizationId, serviceMonth),
  ]);

  if (complianceResponse.error) throw complianceResponse.error;
  if (obligationsResponse.error) throw obligationsResponse.error;
  if (contractsResponse.error) throw contractsResponse.error;
  if (profitabilityResponse.error) throw profitabilityResponse.error;

  const profitabilityByCompany = new Map<string, any>();
  for (const row of profitabilityResponse.data ?? []) {
    profitabilityByCompany.set(row.company_id, row);
  }

  const contractByCompany = new Map<string, any>();
  for (const row of contractsResponse.data ?? []) {
    if (!contractByCompany.has(row.company_id)) {
      contractByCompany.set(row.company_id, row);
    }
  }

  const complianceRows: OsgbComplianceCompanyRecord[] = (complianceResponse.data ?? []).map((row: any) => {
    const profitability = profitabilityByCompany.get(row.company_id);
    const contract = contractByCompany.get(row.company_id);
    return {
      companyId: row.company_id,
      companyName: row.company?.company_name || "Firma",
      employeeCount: row.employee_count || 0,
      hazardClass: row.hazard_class || "Bilinmiyor",
      complianceStatus: normalizeComplianceStatus(row.compliance_status),
      totalRequiredMinutes: (row.igu_required_minutes || 0) + (row.hekim_required_minutes || 0) + (row.dsp_required_minutes || 0),
      totalAssignedMinutes: (row.igu_assigned_minutes || 0) + (row.hekim_assigned_minutes || 0) + (row.dsp_assigned_minutes || 0),
      deficitMinutes: row.deficit_minutes || 0,
      overtimeMinutes: row.overtime_minutes || 0,
      contractEnd: contract?.ends_on || null,
      packageName: profitability?.package_name || contract?.package_name || null,
      collectionRiskScore: profitability?.collection_risk_score || 0,
      profitabilityScore: profitability?.profitability_score || 0,
      estimatedMonthlyMargin: profitability?.estimated_monthly_margin || 0,
      overdueBalance: profitability?.overdue_balance || 0,
      currentBalance: profitability?.current_balance || 0,
      requiredMinutesByRole: {
        igu: row.igu_required_minutes || 0,
        hekim: row.hekim_required_minutes || 0,
        dsp: row.dsp_required_minutes || 0,
      },
      assignedMinutesByRole: {
        igu: row.igu_assigned_minutes || 0,
        hekim: row.hekim_assigned_minutes || 0,
        dsp: row.dsp_assigned_minutes || 0,
      },
    };
  });

  const obligationRows: OsgbPlatformObligationRecord[] = (obligationsResponse.data ?? []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    companyName: row.company?.company_name || "Firma",
    obligationName: row.obligation_name,
    status: normalizeComplianceStatus(row.obligation_status),
    dueDate: row.due_date || null,
    legalBasis: row.legal_basis,
    riskIfMissing: row.risk_if_missing || null,
    responsibleRole: row.responsible_role || null,
  }));

  const contractRows: OsgbPlatformContractRecord[] = (contractsResponse.data ?? []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    companyName: row.company?.company_name || "Firma",
    packageName: row.package_name,
    contractStatus: row.contract_status,
    monthlyFee: row.monthly_fee || 0,
    startsOn: row.starts_on,
    endsOn: row.ends_on || null,
  }));

  const totalCompanies = complianceRows.length;
  const summary: OsgbPlatformDashboardSummary = {
    totalCompanies,
    compliantCompanies: complianceRows.filter((row) => row.complianceStatus === "compliant").length,
    companiesWithGap: complianceRows.filter((row) => row.deficitMinutes > 0 || row.complianceStatus === "overdue" || row.complianceStatus === "missing").length,
    totalDeficitMinutes: complianceRows.reduce((sum, row) => sum + row.deficitMinutes, 0),
    totalOvertimeMinutes: complianceRows.reduce((sum, row) => sum + row.overtimeMinutes, 0),
    activeContracts: contractRows.filter((row) => row.contractStatus === "active").length,
    expiringContracts: contractRows.filter((row) => {
      const remaining = daysUntil(row.endsOn);
      return row.contractStatus === "active" && remaining !== null && remaining >= 0 && remaining <= 30;
    }).length,
    overdueObligations: obligationRows.filter((row) => row.status === "overdue" || row.status === "missing").length,
    warningObligations: obligationRows.filter((row) => row.status === "warning").length,
    overdueBalance: complianceRows.reduce((sum, row) => sum + row.overdueBalance, 0),
    averageMargin: totalCompanies > 0
      ? Math.round(complianceRows.reduce((sum, row) => sum + row.estimatedMonthlyMargin, 0) / totalCompanies)
      : 0,
  };

  return {
    serviceMonth,
    summary,
    complianceRows,
    obligationRows,
    contractRows,
    personnelLoads,
  };
};

export const listOsgbFieldVisitsWorkspace = async (
  organizationId: string,
  options?: { serviceMonth?: string; refreshCompliance?: boolean },
): Promise<OsgbFieldVisitWorkspaceData> => {
  const serviceMonth = options?.serviceMonth || getServiceMonth();
  const serviceMonthEnd = getServiceMonthEnd(serviceMonth);
  const managedCompanyIds = await listManagedOsgbCompanyIds(organizationId);

  if (options?.refreshCompliance !== false) {
    await refreshOsgbMonthlyCompliance(organizationId, serviceMonth);
  }

  if (managedCompanyIds.length === 0) {
    const [companies, personnel] = await Promise.all([
      listOsgbWorkspaceCompanies(organizationId, serviceMonth),
      listOsgbWorkspacePersonnel(organizationId, true),
    ]);

    return {
      serviceMonth,
      summary: {
        totalVisits: 0,
        completedVisits: 0,
        inProgressVisits: 0,
        missingProofVisits: 0,
        totalComplianceImpactMinutes: 0,
      },
      visits: [],
      companies,
      personnel,
    };
  }

  const [visitsResponse, companies, personnel] = await Promise.all([
    (supabase as any)
      .from("osgb_field_visits")
      .select(`
        *,
        company:isgkatip_companies(company_name),
        visit_personnel:osgb_visit_personnel(
          id,
          personnel_id,
          profile_id,
          planned_role,
          attended,
          checked_in_at,
          checked_out_at,
          signed_at,
          personnel:osgb_personnel(id, full_name, role),
          profile:profiles(id, full_name)
        ),
        evidence:osgb_visit_evidence(
          id,
          evidence_type,
          title,
          file_url,
          payload,
          captured_at
        )
      `)
      .eq("organization_id", organizationId)
      .in("company_id", managedCompanyIds)
      .gte("planned_start_at", `${serviceMonth}T00:00:00`)
      .lte("planned_start_at", `${serviceMonthEnd}T23:59:59`)
      .order("planned_start_at", { ascending: true }),
    listOsgbWorkspaceCompanies(organizationId, serviceMonth),
    listOsgbWorkspacePersonnel(organizationId, true),
  ]);

  if (visitsResponse.error) throw visitsResponse.error;

  const visits: OsgbFieldVisitRecord[] = (visitsResponse.data ?? []).map((row: any) => {
    const evidence: OsgbFieldVisitEvidenceRecord[] = (row.evidence ?? []).map((item: any) => ({
      id: item.id,
      type: item.evidence_type,
      title: item.title,
      fileUrl: item.file_url || null,
      metadata: item.payload || {},
      capturedAt: item.captured_at,
    }));

    const assignedPersonnel: OsgbFieldVisitPersonnelRecord[] = (row.visit_personnel ?? []).map((item: any) => ({
      id: item.id,
      personnelId: item.personnel_id || item.personnel?.id || null,
      profileId: item.profile_id || item.profile?.id || null,
      fullName: item.personnel?.full_name || item.profile?.full_name || "Atanmamış personel",
      role: item.planned_role || item.personnel?.role || "igu",
      attended: !!item.attended,
      checkedInAt: item.checked_in_at || null,
      checkedOutAt: item.checked_out_at || null,
      signedAt: item.signed_at || null,
    }));

    const baseVisit = {
      startedAt: row.actual_start_at || null,
      completedAt: row.actual_end_at || null,
      checkInLocation: buildLocationText(row.check_in_lat, row.check_in_lng),
      checkOutLocation: buildLocationText(row.check_out_lat, row.check_out_lng),
    };

    const proof = calculateProofState(baseVisit, evidence, assignedPersonnel);

    return {
      id: row.id,
      organizationId: row.organization_id,
      companyId: row.company_id,
      companyName: row.company?.company_name || "Firma",
      contractId: row.contract_id || null,
      plannedAt: row.planned_start_at,
      plannedEndAt: row.planned_end_at || null,
      startedAt: row.actual_start_at || null,
      completedAt: row.actual_end_at || null,
      status: row.visit_status,
      visitType: row.visit_type,
      visitAddress: row.visit_address || null,
      checkInLocation: baseVisit.checkInLocation,
      checkOutLocation: baseVisit.checkOutLocation,
      durationMinutes: calculateVisitDuration(row.actual_start_at, row.actual_end_at),
      notes: row.service_summary || null,
      nextActionSummary: row.next_action_summary || null,
      complianceImpactMinutes: Number(row.compliance_impact_minutes || 0),
      createdBy: row.created_by || null,
      assignedPersonnel,
      evidence,
      proofScore: proof.score,
      proofLevel: proof.level,
      proofMissingReasons: proof.reasons,
      hasEnoughEvidence: proof.score >= 45,
    };
  });

  return {
    serviceMonth,
    summary: {
      totalVisits: visits.length,
      completedVisits: visits.filter((visit) => visit.status === "completed").length,
      inProgressVisits: visits.filter((visit) => visit.status === "in_progress").length,
      missingProofVisits: visits.filter((visit) => visit.status === "completed" && !visit.hasEnoughEvidence).length,
      totalComplianceImpactMinutes: visits.reduce((sum, visit) => sum + visit.complianceImpactMinutes, 0),
    },
    visits,
    companies,
    personnel,
  };
};

export const upsertOsgbFieldVisitWorkspace = async (
  userId: string,
  organizationId: string,
  input: {
    companyId: string;
    contractId?: string | null;
    visitType: OsgbFieldVisitType;
    plannedAt: string;
    plannedEndAt?: string | null;
    visitAddress?: string | null;
    notes?: string | null;
    nextActionSummary?: string | null;
    complianceImpactMinutes?: number;
    assignedPersonnelIds?: string[];
  },
  id?: string,
) => {
  const payload = {
    organization_id: organizationId,
    company_id: input.companyId,
    contract_id: input.contractId || null,
    visit_type: input.visitType,
    visit_status: "planned",
    planned_start_at: input.plannedAt,
    planned_end_at: input.plannedEndAt || null,
    visit_address: input.visitAddress || null,
    service_summary: input.notes || null,
    next_action_summary: input.nextActionSummary || null,
    compliance_impact_minutes: input.complianceImpactMinutes || 0,
    created_by: userId,
    updated_at: new Date().toISOString(),
  };

  const query = id
    ? (supabase as any).from("osgb_field_visits").update(payload).eq("id", id).eq("organization_id", organizationId)
    : (supabase as any).from("osgb_field_visits").insert(payload);

  const { data, error } = await query.select("id").single();
  if (error) throw error;

  const visitId = data.id as string;
  const personnelIds = Array.from(new Set((input.assignedPersonnelIds || []).filter(Boolean)));

  if (id) {
    const { error: deleteError } = await (supabase as any).from("osgb_visit_personnel").delete().eq("visit_id", visitId);
    if (deleteError) throw deleteError;
  }

  if (personnelIds.length > 0) {
    const { data: personnelRows, error: personnelError } = await (supabase as any)
      .from("osgb_personnel")
      .select("id, role")
      .eq("organization_id", organizationId)
      .in("id", personnelIds);

    if (personnelError) throw personnelError;

    const payloads = (personnelRows ?? []).map((person: any) => ({
      visit_id: visitId,
      personnel_id: person.id,
      planned_role: person.role,
    }));

    if (payloads.length > 0) {
      const { error: visitPersonnelError } = await (supabase as any).from("osgb_visit_personnel").insert(payloads);
      if (visitPersonnelError) throw visitPersonnelError;
    }
  }

  return visitId;
};

export const transitionOsgbFieldVisit = async (
  organizationId: string,
  visitId: string,
  nextStatus: OsgbFieldVisitStatus,
  input?: {
    lat?: number | null;
    lng?: number | null;
  },
) => {
  const now = new Date().toISOString();
  const patch: Record<string, any> = {
    visit_status: nextStatus,
    updated_at: now,
  };

  if (nextStatus === "in_progress") {
    patch.actual_start_at = now;
    patch.check_in_lat = input?.lat ?? null;
    patch.check_in_lng = input?.lng ?? null;
  }

  if (nextStatus === "completed") {
    patch.actual_end_at = now;
    patch.check_out_lat = input?.lat ?? null;
    patch.check_out_lng = input?.lng ?? null;
  }

  const { error } = await (supabase as any)
    .from("osgb_field_visits")
    .update(patch)
    .eq("id", visitId)
    .eq("organization_id", organizationId);
  if (error) throw error;
};

export const addOsgbFieldVisitEvidence = async (
  userId: string,
  organizationId: string,
  input: {
    visitId: string;
    type: OsgbEvidenceType;
    title: string;
    fileUrl?: string | null;
    metadata?: Record<string, any>;
  },
) => {
  const { error } = await (supabase as any).from("osgb_visit_evidence").insert({
    organization_id: organizationId,
    visit_id: input.visitId,
    evidence_type: input.type,
    title: input.title,
    file_url: input.fileUrl || null,
    payload: input.metadata || {},
    captured_by: userId,
  });

  if (error) throw error;
};

export const syncOsgbRequiredDocuments = async (organizationId: string, userId: string) => {
  const managedCompanyIds = await listManagedOsgbCompanyIds(organizationId);
  if (managedCompanyIds.length === 0) {
    return 0;
  }

  const [obligationsResponse, existingResponse] = await Promise.all([
    (supabase as any)
      .from("osgb_company_obligations")
      .select("id, company_id, obligation_name, legal_basis, due_date, risk_if_missing, obligation_status")
      .eq("organization_id", organizationId)
      .in("company_id", managedCompanyIds),
    (supabase as any)
      .from("osgb_required_documents")
      .select("id, obligation_id, document_type")
      .eq("organization_id", organizationId)
      .in("company_id", managedCompanyIds),
  ]);

  if (obligationsResponse.error) throw obligationsResponse.error;
  if (existingResponse.error) throw existingResponse.error;

  const existingRows = (existingResponse.data ?? []) as Array<{
    id: string;
    obligation_id: string | null;
    document_type: string;
    risk_if_missing?: string | null;
  }>;
  const existingKeys = new Set(existingRows.map((row) => `${row.obligation_id || "none"}:${row.document_type}`));
  const existingByKey = new Map<string, (typeof existingRows)[number]>(
    existingRows.map((row) => [`${row.obligation_id || "none"}:${row.document_type}`, row]),
  );

  const inserts = (obligationsResponse.data ?? [])
    .map((obligation: any) => {
      const documentType = guessDocumentType(obligation.obligation_name || "");
      const key = `${obligation.id}:${documentType}`;
      if (existingKeys.has(key)) return null;

      const dueDate = obligation.due_date || null;
      const delayDays = dueDate ? Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24))) : 0;

      return {
        organization_id: organizationId,
        company_id: obligation.company_id,
        obligation_id: obligation.id,
        document_type: documentType,
        required_reason: `${obligation.obligation_name} için bu evrakın bulunması gerekir.`,
        risk_if_missing: obligation.risk_if_missing || "Yasal yükümlülük yerine getirilmemiş görünür ve denetimde risk doğurur.",
        due_date: dueDate,
        status: "missing",
        delay_days: delayDays,
        risk_level: deriveDocumentRiskLevel(obligation.obligation_status, obligation.risk_if_missing),
        created_by: userId,
      };
    })
    .filter(Boolean);

  if (inserts.length > 0) {
    const { error } = await (supabase as any).from("osgb_required_documents").insert(inserts);
    if (error) throw error;
  }

  const updates = (obligationsResponse.data ?? [])
    .map((obligation: any) => {
      const documentType = guessDocumentType(obligation.obligation_name || "");
      const key = `${obligation.id}:${documentType}`;
      const existing = existingByKey.get(key);
      if (!existing) return null;

      const dueDate = obligation.due_date || null;
      const delayDays = dueDate ? Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24))) : 0;
      const riskLevel = deriveDocumentRiskLevel(obligation.obligation_status, obligation.risk_if_missing);

      return {
        id: existing.id,
        due_date: dueDate,
        delay_days: delayDays,
        risk_if_missing: obligation.risk_if_missing || existing.risk_if_missing || null,
        risk_level: riskLevel,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  for (const update of updates) {
    const { error } = await (supabase as any)
      .from("osgb_required_documents")
      .update(update)
      .eq("id", update.id)
      .eq("organization_id", organizationId);

    if (error) throw error;
  }

  return inserts.length;
};

export const listOsgbRequiredDocumentsWorkspace = async (
  organizationId: string,
  userId: string,
): Promise<OsgbRequiredDocumentsWorkspaceData> => {
  const managedCompanyIds = await listManagedOsgbCompanyIds(organizationId);
  await syncOsgbRequiredDocuments(organizationId, userId);

  if (managedCompanyIds.length === 0) {
    return {
      documents: [],
      overview: {
        total: 0,
        missing: 0,
        overdue: 0,
        critical: 0,
      },
    };
  }

  const { data, error } = await (supabase as any)
    .from("osgb_required_documents")
    .select(`
      id,
      organization_id,
      company_id,
      obligation_id,
      field_visit_id,
      document_type,
      required_reason,
      risk_if_missing,
      due_date,
      status,
      delay_days,
      risk_level,
      company:isgkatip_companies(company_name),
      obligation:osgb_company_obligations(obligation_name, legal_basis),
      visit:osgb_field_visits(planned_start_at)
    `)
    .eq("organization_id", organizationId)
    .in("company_id", managedCompanyIds)
    .order("risk_level", { ascending: false })
    .order("due_date", { ascending: true });

  if (error) throw error;

  const documents: OsgbRequiredDocumentRecord[] = (data ?? []).map((row: any) => {
    const dueDate = row.due_date || null;
    const delayDays = dueDate ? Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24))) : Number(row.delay_days || 0);
    const riskLevel = normalizeRiskLevel(row.risk_level);

    return {
      id: row.id,
      organizationId: row.organization_id,
      companyId: row.company_id,
      companyName: row.company?.company_name || "Firma",
      obligationId: row.obligation_id || null,
      obligationName: row.obligation?.obligation_name || null,
      fieldVisitId: row.field_visit_id || null,
      fieldVisitLabel: row.visit?.planned_start_at ? new Date(row.visit.planned_start_at).toLocaleDateString("tr-TR") : null,
      documentType: row.document_type,
      requiredReason: row.required_reason,
      riskIfMissing: row.risk_if_missing || null,
      dueDate,
      status: row.status,
      delayDays,
      riskLevel,
      legalBasis: row.obligation?.legal_basis || null,
      nextAction:
        row.status === "approved"
          ? "Evrak onaylı, yalnızca vadesini takip edin."
          : row.status === "submitted"
            ? "Müşteri gönderimini doğrulayın ve onay bekleyin."
            : delayDays > 0
              ? "Görev oluşturup müşteriden belgeyi bugün talep edin."
              : "Belgeyi müşteriden isteyin ve teslim tarihini teyit edin.",
    };
  });

  return {
    documents,
    overview: {
      total: documents.length,
      missing: documents.filter((item) => item.status === "missing").length,
      overdue: documents.filter((item) => item.status === "missing" && item.delayDays > 0).length,
      critical: documents.filter((item) => item.riskLevel === "critical" || item.riskLevel === "high").length,
    },
  };
};

export const updateOsgbRequiredDocumentStatus = async (
  organizationId: string,
  id: string,
  status: OsgbRequiredDocumentStatus,
) => {
  const { data, error } = await (supabase as any)
    .from("osgb_required_documents")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("id")
    .single();

  if (error) throw error;
  return data;
};

export const createOsgbRequiredDocumentTask = async (
  userId: string,
  organizationId: string,
  document: OsgbRequiredDocumentRecord,
) => {
  const title = `Evrak takibi: ${document.companyName}`;
  const { data: duplicateRows, error: duplicateError } = await (supabase as any)
    .from("osgb_tasks")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("company_id", document.companyId)
    .eq("title", title)
    .neq("status", "cancelled")
    .limit(1);

  if (duplicateError) throw duplicateError;
  if ((duplicateRows ?? []).length > 0) return false;

  const { error } = await (supabase as any).from("osgb_tasks").insert({
    user_id: userId,
    organization_id: organizationId,
    company_id: document.companyId,
    related_document_id: null,
    title,
    description: `${document.documentType} belgesi eksik. Sebep: ${document.requiredReason} Risk: ${document.riskIfMissing || "Yasal uyumsuzluk"}`,
    priority: document.riskLevel === "critical" ? "critical" : document.riskLevel === "high" ? "high" : "medium",
    status: "open",
    due_date: document.dueDate,
    source: "required_document",
    created_by: userId,
  });

  if (error) throw error;
  return true;
};

export const buildOsgbRequiredDocumentNotification = (document: OsgbRequiredDocumentRecord) => {
  return `${document.companyName} için ${document.documentType} belgesi bekleniyor. Sebep: ${document.requiredReason}. ${document.riskIfMissing || "Belge eksikliği yasal risk doğurur."} Mümkünse bugün paylaşmanızı rica ederiz.`;
};

const calculateEntrySignedAmount = (entry: { type: OsgbFinancialEntryType; amount: number }) => {
  if (entry.type === "payment") return -Math.abs(entry.amount);
  return entry.amount;
};

const computeCollectionRiskScore = (currentBalance: number, overdueBalance: number, lateInvoiceCount: number) => {
  if (currentBalance <= 0) return 0;
  const overdueRatio = overdueBalance / currentBalance;
  return Math.min(100, Math.round(overdueRatio * 70 + lateInvoiceCount * 10));
};

const computePaymentPerformanceLabel = (overdueBalance: number, lateInvoiceCount: number) => {
  if (overdueBalance <= 0) return "Düzenli";
  if (lateInvoiceCount >= 2 || overdueBalance > 0) return "Gecikmeli";
  return "Yakın takip";
};

export const syncOsgbMonthlyAccruals = async (
  organizationId: string,
  userId: string,
  serviceMonth = getServiceMonth(),
) => {
  const managedCompanyIds = await listManagedOsgbCompanyIds(organizationId);
  if (managedCompanyIds.length === 0) {
    return 0;
  }

  const serviceMonthEnd = getServiceMonthEnd(serviceMonth);
  const billingFallback = new Date(`${serviceMonthEnd}T00:00:00`).getDate();

  const { data: contracts, error: contractsError } = await (supabase as any)
    .from("osgb_service_contracts")
    .select("id, company_id, monthly_fee, billing_day, package_name, starts_on, ends_on, contract_status")
    .eq("organization_id", organizationId)
    .in("company_id", managedCompanyIds)
    .eq("contract_status", "active");

  if (contractsError) throw contractsError;

  let created = 0;

  for (const contract of contracts ?? []) {
    const startsOn = contract.starts_on ? new Date(contract.starts_on) : null;
    const endsOn = contract.ends_on ? new Date(contract.ends_on) : null;
    const monthStart = new Date(`${serviceMonth}T00:00:00`);

    if (startsOn && startsOn > new Date(`${serviceMonthEnd}T23:59:59`)) continue;
    if (endsOn && endsOn < monthStart) continue;

    const billingDay = Math.max(1, Math.min(28, Number(contract.billing_day || billingFallback)));
    const dueDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), billingDay).toISOString().slice(0, 10);

    const { data: existingEntries, error: existingError } = await (supabase as any)
      .from("osgb_financial_entries")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("company_id", contract.company_id)
      .eq("contract_id", contract.id)
      .eq("entry_type", "invoice")
      .eq("service_month", serviceMonth)
      .limit(1);

    if (existingError) throw existingError;

    if ((existingEntries ?? []).length === 0) {
      const { error: insertError } = await (supabase as any).from("osgb_financial_entries").insert({
        organization_id: organizationId,
        company_id: contract.company_id,
        contract_id: contract.id,
        service_month: serviceMonth,
        entry_type: "invoice",
        amount: contract.monthly_fee || 0,
        entry_date: serviceMonth,
        due_date: dueDate,
        status: new Date(dueDate) < new Date() ? "overdue" : "open",
        description: `${serviceMonth.slice(0, 7)} hizmet tahakkuku - ${contract.package_name}`,
        created_by: userId,
      });

      if (insertError) throw insertError;
      created += 1;
    }

    const { error: accountError } = await (supabase as any)
      .from("osgb_finance_accounts")
      .upsert(
        {
          organization_id: organizationId,
          company_id: contract.company_id,
          contract_id: contract.id,
          payment_term_days: 30,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,company_id" },
      );

    if (accountError) throw accountError;
  }

  return created;
};

export const upsertOsgbFinancialEntry = async (
  userId: string,
  organizationId: string,
  input: {
    companyId: string;
    contractId?: string | null;
    financeAccountId?: string | null;
    serviceMonth?: string | null;
    type: OsgbFinancialEntryType;
    amount: number;
    entryDate: string;
    dueDate?: string | null;
    status: OsgbFinancialEntryStatus;
    description?: string | null;
  },
  id?: string,
) => {
  const payload = {
    organization_id: organizationId,
    company_id: input.companyId,
    contract_id: input.contractId || null,
    finance_account_id: input.financeAccountId || null,
    service_month: input.serviceMonth || null,
    entry_type: input.type,
    amount: input.amount,
    entry_date: input.entryDate,
    due_date: input.dueDate || null,
    status: input.status,
    description: input.description || null,
    created_by: userId,
    updated_at: new Date().toISOString(),
  };

  const query = id
    ? (supabase as any).from("osgb_financial_entries").update(payload).eq("id", id).eq("organization_id", organizationId)
    : (supabase as any).from("osgb_financial_entries").insert(payload);

  const { data, error } = await query.select("id").single();
  if (error) throw error;
  await recalculateOsgbFinanceAccounts(organizationId);
  return data.id as string;
};

export const recalculateOsgbFinanceAccounts = async (organizationId: string) => {
  const managedCompanyIds = await listManagedOsgbCompanyIds(organizationId);
  if (managedCompanyIds.length === 0) {
    return;
  }

  const [entriesResponse, activeContractsResponse, profitabilityResponse] = await Promise.all([
    (supabase as any)
      .from("osgb_financial_entries")
      .select("company_id, entry_type, amount, due_date, status")
      .eq("organization_id", organizationId)
      .in("company_id", managedCompanyIds),
    (supabase as any)
      .from("osgb_service_contracts")
      .select("company_id, id")
      .eq("organization_id", organizationId)
      .in("company_id", managedCompanyIds)
      .eq("contract_status", "active"),
    (supabase as any)
      .from("v_osgb_company_profitability")
      .select("company_id, estimated_monthly_margin")
      .eq("organization_id", organizationId)
      .in("company_id", managedCompanyIds),
  ]);

  if (entriesResponse.error) throw entriesResponse.error;
  if (activeContractsResponse.error) throw activeContractsResponse.error;
  if (profitabilityResponse.error) throw profitabilityResponse.error;

  const profitabilityByCompany = new Map<string, number>();
  for (const row of profitabilityResponse.data ?? []) {
    profitabilityByCompany.set(row.company_id, Number(row.estimated_monthly_margin || 0));
  }

  const grouped = new Map<string, { currentBalance: number; overdueBalance: number; lateInvoiceCount: number }>();
  for (const row of entriesResponse.data ?? []) {
    const current = grouped.get(row.company_id) || { currentBalance: 0, overdueBalance: 0, lateInvoiceCount: 0 };
    current.currentBalance += calculateEntrySignedAmount({
      type: row.entry_type,
      amount: Number(row.amount || 0),
    });

    if (
      row.entry_type === "invoice" &&
      row.due_date &&
      row.status !== "paid" &&
      row.status !== "cancelled" &&
      new Date(row.due_date) < new Date()
    ) {
      current.overdueBalance += Number(row.amount || 0);
      current.lateInvoiceCount += 1;
    }

    grouped.set(row.company_id, current);
  }

  const activeContractByCompany = new Map<string, string>();
  for (const row of activeContractsResponse.data ?? []) {
    if (!activeContractByCompany.has(row.company_id)) {
      activeContractByCompany.set(row.company_id, row.id);
    }
  }

  for (const [companyId, values] of grouped.entries()) {
    const profitabilityScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          profitabilityByCompany.has(companyId)
            ? (profitabilityByCompany.get(companyId) || 0) >= 0
              ? 65 + Math.min(35, Math.round((profitabilityByCompany.get(companyId) || 0) / 1000))
              : Math.max(10, 50 + Math.round((profitabilityByCompany.get(companyId) || 0) / 500))
            : 50,
        ),
      ),
    );

    const { error } = await (supabase as any)
      .from("osgb_finance_accounts")
      .upsert(
        {
          organization_id: organizationId,
          company_id: companyId,
          contract_id: activeContractByCompany.get(companyId) || null,
          current_balance: values.currentBalance,
          overdue_balance: values.overdueBalance,
          collection_risk_score: computeCollectionRiskScore(values.currentBalance, values.overdueBalance, values.lateInvoiceCount),
          profitability_score: profitabilityScore,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,company_id" },
      );

    if (error) throw error;
  }
};

export const listOsgbFinanceWorkspace = async (
  organizationId: string,
  userId: string,
  serviceMonth = getServiceMonth(),
): Promise<OsgbFinanceWorkspaceData> => {
  const managedCompanyIds = await listManagedOsgbCompanyIds(organizationId);
  await syncOsgbMonthlyAccruals(organizationId, userId, serviceMonth);
  await recalculateOsgbFinanceAccounts(organizationId);

  if (managedCompanyIds.length === 0) {
    return {
      serviceMonth,
      companies: [],
      entries: [],
      totalCurrentBalance: 0,
      totalOverdueBalance: 0,
      lowProfitabilityCount: 0,
      latePayerCount: 0,
    };
  }

  const [entriesResponse, accountsResponse, profitabilityResponse, contractsResponse] = await Promise.all([
    (supabase as any)
      .from("osgb_financial_entries")
      .select(`
        id,
        organization_id,
        company_id,
        finance_account_id,
        contract_id,
        service_month,
        entry_type,
        amount,
        entry_date,
        due_date,
        status,
        description,
        company:isgkatip_companies(company_name)
      `)
      .eq("organization_id", organizationId)
      .in("company_id", managedCompanyIds)
      .order("entry_date", { ascending: false }),
    (supabase as any)
      .from("osgb_finance_accounts")
      .select(`
        id,
        company_id,
        current_balance,
        overdue_balance,
        collection_risk_score,
        profitability_score,
        company:isgkatip_companies(company_name)
      `)
      .eq("organization_id", organizationId)
      .in("company_id", managedCompanyIds),
    (supabase as any)
      .from("v_osgb_company_profitability")
      .select("*")
      .eq("organization_id", organizationId)
      .in("company_id", managedCompanyIds),
    (supabase as any)
      .from("osgb_service_contracts")
      .select("id, company_id, package_name, monthly_fee, contract_status")
      .eq("organization_id", organizationId)
      .in("company_id", managedCompanyIds)
      .in("contract_status", ["active", "paused"]),
  ]);

  if (entriesResponse.error) throw entriesResponse.error;
  if (accountsResponse.error) throw accountsResponse.error;
  if (profitabilityResponse.error) throw profitabilityResponse.error;
  if (contractsResponse.error) throw contractsResponse.error;

  const entries: OsgbFinancialEntryRecord[] = (entriesResponse.data ?? []).map((row: any) => ({
    id: row.id,
    organizationId: row.organization_id,
    companyId: row.company_id,
    companyName: row.company?.company_name || "Firma",
    financeAccountId: row.finance_account_id || null,
    contractId: row.contract_id || null,
    serviceMonth: row.service_month || null,
    type: row.entry_type,
    amount: Number(row.amount || 0),
    entryDate: row.entry_date,
    dueDate: row.due_date || null,
    status: row.status,
    description: row.description || null,
  }));

  const entriesByCompany = new Map<string, OsgbFinancialEntryRecord[]>();
  for (const entry of entries) {
    const current = entriesByCompany.get(entry.companyId) || [];
    current.push(entry);
    entriesByCompany.set(entry.companyId, current);
  }

  const profitabilityByCompany = new Map<string, any>();
  for (const row of profitabilityResponse.data ?? []) {
    profitabilityByCompany.set(row.company_id, row);
  }

  const contractByCompany = new Map<string, any>();
  for (const row of contractsResponse.data ?? []) {
    if (!contractByCompany.has(row.company_id)) {
      contractByCompany.set(row.company_id, row);
    }
  }

  const companies: OsgbFinanceCompanySnapshot[] = (accountsResponse.data ?? []).map((row: any) => {
    const profitability = profitabilityByCompany.get(row.company_id);
    const contract = contractByCompany.get(row.company_id);
    const companyEntries = entriesByCompany.get(row.company_id) || [];
    const openInvoices = companyEntries.filter((entry) => entry.type === "invoice" && entry.status !== "paid" && entry.status !== "cancelled").length;
    const lateInvoiceCount = companyEntries.filter(
      (entry) => entry.type === "invoice" && entry.dueDate && entry.status !== "paid" && entry.status !== "cancelled" && new Date(entry.dueDate) < new Date(),
    ).length;
    const expectedRevenue = Number(profitability?.monthly_fee || contract?.monthly_fee || 0);
    const estimatedMargin = Number(profitability?.estimated_monthly_margin || 0);

    return {
      companyId: row.company_id,
      companyName: row.company?.company_name || "Firma",
      packageName: profitability?.package_name || contract?.package_name || null,
      monthlyFee: Number(contract?.monthly_fee || 0),
      currentBalance: Number(row.current_balance || 0),
      overdueBalance: Number(row.overdue_balance || 0),
      collectionRiskScore: Number(row.collection_risk_score || 0),
      profitabilityScore: Number(row.profitability_score || 0),
      estimatedMonthlyMargin: estimatedMargin,
      estimatedCost: Math.max(0, expectedRevenue - estimatedMargin),
      expectedRevenue,
      paymentPerformanceLabel: computePaymentPerformanceLabel(Number(row.overdue_balance || 0), lateInvoiceCount),
      needsAttention: Number(row.overdue_balance || 0) > 0 || Number(row.collection_risk_score || 0) >= 60,
      lowProfitability: estimatedMargin < 0 || Number(row.profitability_score || 0) < 45,
      openInvoices,
      lateInvoiceCount,
    };
  }).sort((left, right) => {
    if (left.needsAttention !== right.needsAttention) return left.needsAttention ? -1 : 1;
    return right.overdueBalance - left.overdueBalance;
  });

  return {
    serviceMonth,
    companies,
    entries,
    totalCurrentBalance: companies.reduce((sum, company) => sum + company.currentBalance, 0),
    totalOverdueBalance: companies.reduce((sum, company) => sum + company.overdueBalance, 0),
    lowProfitabilityCount: companies.filter((company) => company.lowProfitability).length,
    latePayerCount: companies.filter((company) => company.lateInvoiceCount > 0).length,
  };
};

export interface OsgbManagedCompanyRecord {
  id: string;
  organizationId: string;
  companyName: string;
  sgkNo: string | null;
  taxNumber: string | null;
  employeeCount: number;
  hazardClass: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  contactName: string | null;
  assignmentMode: string;
  visitFrequency: string;
  notes: string | null;
  managementSource: string;
  isManaged: boolean;
  managedAt: string | null;
  contractStart: string | null;
  contractEnd: string | null;
  monthlyFee: number;
  assignmentApprovalStatus?: "approved" | "pending_personnel" | "pending_workplace" | "missing_contract" | "planned" | "zero_employees" | null;  totalRequiredMinutes: number;
  totalAssignedMinutes: number;
  requiredMinutesByRole: Record<OsgbRole, number>;
  assignedMinutesByRole: Record<OsgbRole, number>;
}

export interface OsgbCompanyImportCandidate {
  id: string;
  companyName: string;
  sgkNo: string | null;
  employeeCount: number;
  hazardClass: string;
  contractStart: string | null;
  contractEnd: string | null;
  assignedMinutes: number;
  requiredMinutes: number;
  managementSource: string;
}

export interface OsgbCompanyTrackingWorkspaceData {
  serviceMonth: string;
  companies: OsgbManagedCompanyRecord[];
  importCandidates: OsgbCompanyImportCandidate[];
  summary: {
    totalCompanies: number;
    lessHazardousCount: number;
    hazardousCount: number;
    veryHazardousCount: number;
    totalIguMinutes: number;
    totalHekimMinutes: number;
    approvedCount: number;
    pendingPersonnelApprovalCount: number;
    pendingWorkplaceApprovalCount: number;
    zeroEmployeeCount: number;
    missingContractCount: number;
    plannedAssignmentCount: number;
  };
}

export interface OsgbCompanyManagementInput {
  companyName: string;
  sgkNo?: string | null;
  taxNumber?: string | null;
  employeeCount?: number;
  hazardClass: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  contactName?: string | null;
  contractStart?: string | null;
  contractEnd?: string | null;
  monthlyFee?: number;
  assignmentMode?: string;
   // ✅ EKLE: Atama Durumu (DB'ye yazacağız)
  assignmentApprovalStatus?:
    | "approved"
    | "pending_personnel"
    | "pending_workplace"
    | "missing_contract"
    | "planned"
    | "zero_employees"
    | null;
  visitFrequency?: string;
  notes?: string | null;
  managementSource?: "manual" | "import" | "isgkatip" | "extension";
  naceCode?: string | null;
}

const deriveAssignmentApprovalStatus = (row: any, assignedMinutes: number) => {
  const assignedPersonApproval = String(row.assigned_person_approval_status || "").toLocaleLowerCase("tr-TR");
  const receiverApproval = String(row.service_receiver_approval_status || "").toLocaleLowerCase("tr-TR");
  const contractStatus = String(row.contract_status || "").toLocaleLowerCase("tr-TR");

  if (assignedMinutes <= 0) return "missing_contract" as const;
  if (contractStatus.includes("plan")) return "planned" as const;
  if (assignedPersonApproval && !assignedPersonApproval.includes("approve")) return "pending_personnel" as const;
  if (receiverApproval && !receiverApproval.includes("approve")) return "pending_workplace" as const;
  return "approved" as const;
};

const normalizeManagedCompany = (
  row: any,
  compliance: any | undefined,
  contract: any | undefined,
): OsgbManagedCompanyRecord => {
  const iguRequired = Number(compliance?.igu_required_minutes || publicCalculateRequiredFallback(row.employee_count, row.hazard_class, "igu"));
  const hekimRequired = Number(compliance?.hekim_required_minutes || publicCalculateRequiredFallback(row.employee_count, row.hazard_class, "hekim"));
  const dspRequired = Number(compliance?.dsp_required_minutes || publicCalculateRequiredFallback(row.employee_count, row.hazard_class, "dsp"));
  const iguAssigned = Number(compliance?.igu_assigned_minutes || 0);
  const hekimAssigned = Number(compliance?.hekim_assigned_minutes || 0);
  const dspAssigned = Number(compliance?.dsp_assigned_minutes || 0);
  const totalAssignedMinutes = iguAssigned + hekimAssigned + dspAssigned;

  return {
    id: row.id,
    organizationId: row.org_id,
    companyName: row.company_name || "Firma",
    sgkNo: row.sgk_no || null,
    taxNumber: row.tax_number || null,
    employeeCount: Number(row.employee_count || 0),
    hazardClass: row.hazard_class || "Az Tehlikeli",
    address: row.address || null,
    phone: row.phone || null,
    email: row.email || null,
    contactName: row.contact_name || null,
    assignmentMode: row.assignment_mode || "automatic",
    visitFrequency: row.visit_frequency || "monthly_once",
    notes: row.notes || null,
    managementSource: row.management_source || "extension",
    isManaged: !!row.is_osgb_managed,
    managedAt: row.managed_at || null,
    contractStart: contract?.starts_on || row.contract_start || null,
    contractEnd: contract?.ends_on || row.contract_end || null,
    monthlyFee: Number(contract?.monthly_fee || 0),
    assignmentApprovalStatus: deriveAssignmentApprovalStatus(row, totalAssignedMinutes),
    totalRequiredMinutes: iguRequired + hekimRequired + dspRequired,
    totalAssignedMinutes,
    requiredMinutesByRole: {
      igu: iguRequired,
      hekim: hekimRequired,
      dsp: dspRequired,
    },
    assignedMinutesByRole: {
      igu: iguAssigned,
      hekim: hekimAssigned,
      dsp: dspAssigned,
    },
  };
};

const publicCalculateRequiredFallback = (
  employeeCount: number | null | undefined,
  hazardClass: string | null | undefined,
  role: OsgbRole,
) => {
  const employees = Math.max(0, Number(employeeCount || 0));
  const normalizedHazard = String(hazardClass || "").toLocaleLowerCase("tr-TR");

  if (role === "dsp") {
    if (normalizedHazard.includes("çok")) return employees * 10;
    if (normalizedHazard.includes("tehlikeli")) return employees * 6;
    return 0;
  }

  if (role === "hekim") {
    if (normalizedHazard.includes("çok")) return employees * 15;
    if (normalizedHazard.includes("tehlikeli")) return employees * 10;
    return employees * 5;
  }

  if (normalizedHazard.includes("çok")) return employees * 40;
  if (normalizedHazard.includes("tehlikeli")) return employees * 20;
  return employees * 10;
};

const ensureOsgbCompanyContract = async (
  userId: string,
  organizationId: string,
  companyId: string,
  input: OsgbCompanyManagementInput,
) => {
  const { data: existingContract, error: contractReadError } = await (supabase as any)
    .from("osgb_service_contracts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (contractReadError) throw contractReadError;

  const startsOn = input.contractStart || new Date().toISOString().slice(0, 10);
  const patch = {
    organization_id: organizationId,
    company_id: companyId,
    package_name: "Standart OSGB Hizmeti",
    contract_status: input.contractStart ? "active" : "draft",
    starts_on: startsOn,
    ends_on: input.contractEnd || null,
    monthly_fee: Number(input.monthlyFee || 0),
    auto_invoice: true,
    notes: input.notes || null,
    created_by: userId,
    updated_at: new Date().toISOString(),
  };

  const query = existingContract?.id
    ? (supabase as any).from("osgb_service_contracts").update(patch).eq("id", existingContract.id)
    : (supabase as any).from("osgb_service_contracts").insert(patch);

  const { data: savedContract, error: contractSaveError } = await query.select("id").single();
  if (contractSaveError) throw contractSaveError;

  const { error: accountError } = await (supabase as any)
    .from("osgb_finance_accounts")
    .upsert(
      {
        organization_id: organizationId,
        company_id: companyId,
        contract_id: savedContract.id,
        payment_term_days: 30,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,company_id" },
    );

  if (accountError) throw accountError;
};

export const listOsgbCompanyTrackingWorkspace = async (
  organizationId: string,
  serviceMonth = getServiceMonth(),
): Promise<OsgbCompanyTrackingWorkspaceData> => {
  await refreshOsgbMonthlyCompliance(organizationId, serviceMonth);

  const [companyResponse, complianceResponse, contractResponse] = await Promise.all([
    (supabase as any)
      .from("isgkatip_companies")
      .select(`
        id,
        org_id,
        company_name,
        sgk_no,
        tax_number,
        employee_count,
        hazard_class,
        address,
        phone,
        email,
        contact_name,
        assignment_mode,
        visit_frequency,
        notes,
        is_osgb_managed,
        management_source,
        managed_at,
        contract_start,
        contract_end,
        assigned_person_approval_status,
        service_receiver_approval_status,
        contract_status,
        nace_code
      `)
      .eq("org_id", organizationId)
      .eq("is_deleted", false)
      .order("company_name", { ascending: true }),
    (supabase as any)
      .from("osgb_monthly_company_compliance")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("service_month", serviceMonth),
    (supabase as any)
      .from("osgb_service_contracts")
      .select("id, company_id, starts_on, ends_on, monthly_fee, contract_status")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
  ]);

  if (companyResponse.error) throw companyResponse.error;
  if (complianceResponse.error) throw complianceResponse.error;
  if (contractResponse.error) throw contractResponse.error;

  const complianceByCompany = new Map<string, any>((complianceResponse.data ?? []).map((row: any) => [row.company_id, row]));
  const contractByCompany = new Map<string, any>();
  for (const contract of contractResponse.data ?? []) {
    if (!contractByCompany.has(contract.company_id)) {
      contractByCompany.set(contract.company_id, contract);
    }
  }

  const allCompanies = (companyResponse.data ?? []).map((row: any) =>
    normalizeManagedCompany(row, complianceByCompany.get(row.id), contractByCompany.get(row.id)),
  );

  const companies = allCompanies.filter((row) => row.isManaged);
  const importCandidates = allCompanies
    .filter((row) => !row.isManaged)
    .map((row) => ({
      id: row.id,
      companyName: row.companyName,
      sgkNo: row.sgkNo,
      employeeCount: row.employeeCount,
      hazardClass: row.hazardClass,
      contractStart: row.contractStart,
      contractEnd: row.contractEnd,
      assignedMinutes: row.totalAssignedMinutes,
      requiredMinutes: row.totalRequiredMinutes,
      managementSource: row.managementSource,
    }));

  return {
    serviceMonth,
    companies,
    importCandidates,
    summary: {
      totalCompanies: companies.length,
      lessHazardousCount: companies.filter((item) => item.hazardClass === "Az Tehlikeli").length,
      hazardousCount: companies.filter((item) => item.hazardClass === "Tehlikeli").length,
      veryHazardousCount: companies.filter((item) => item.hazardClass === "Çok Tehlikeli").length,
      totalIguMinutes: companies.reduce((sum, item) => sum + item.requiredMinutesByRole.igu, 0),
      totalHekimMinutes: companies.reduce((sum, item) => sum + item.requiredMinutesByRole.hekim, 0),
      approvedCount: companies.filter((item) => item.assignmentApprovalStatus === "approved").length,
      pendingPersonnelApprovalCount: companies.filter((item) => item.assignmentApprovalStatus === "pending_personnel").length,
      pendingWorkplaceApprovalCount: companies.filter((item) => item.assignmentApprovalStatus === "pending_workplace").length,
      zeroEmployeeCount: companies.filter((item) => item.employeeCount === 0).length,
      missingContractCount: companies.filter((item) => item.assignmentApprovalStatus === "missing_contract").length,
      plannedAssignmentCount: companies.filter((item) => item.assignmentApprovalStatus === "planned").length,
    },
  };
};

export const upsertOsgbManagedCompany = async (
  userId: string,
  organizationId: string,
  input: OsgbCompanyManagementInput,
  existingCompanyId?: string,
) => {
  const companyPayload = {
    org_id: organizationId,
    company_name: input.companyName,
    branch_name: (input as any).branchName?.trim() || null, // ✅ yeni alan
    sgk_no: input.sgkNo?.trim() || `MANUAL-${Date.now()}`,
    tax_number: input.taxNumber?.trim() || null,
    employee_count: Math.max(0, Number(input.employeeCount || 0)),
    hazard_class: input.hazardClass,
    address: input.address?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    contact_name: input.contactName?.trim() || null,
    assignment_mode: input.assignmentMode || "automatic",
    assignment_approval_status: input.assignmentApprovalStatus || null,
    visit_frequency: input.visitFrequency || "monthly_once",
    notes: input.notes?.trim() || null,
    is_osgb_managed: true,
    management_source: input.managementSource || "manual",
    managed_at: new Date().toISOString(),
    nace_code: input.naceCode?.trim() || null,
    contract_start: input.contractStart || null,
    contract_end: input.contractEnd || null,
    assigned_minutes: 0,
    required_minutes: publicCalculateRequiredFallback(input.employeeCount, input.hazardClass, "igu")
      + publicCalculateRequiredFallback(input.employeeCount, input.hazardClass, "hekim")
      + publicCalculateRequiredFallback(input.employeeCount, input.hazardClass, "dsp"),
    compliance_status: "missing",
    updated_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
  };

  const query = existingCompanyId
    ? (supabase as any).from("isgkatip_companies").update(companyPayload).eq("id", existingCompanyId).eq("org_id", organizationId)
    : (supabase as any).from("isgkatip_companies").insert(companyPayload);

  const { data, error } = await query.select("id").single();
  if (error) throw error;

  await ensureOsgbCompanyContract(userId, organizationId, data.id, input);
  await refreshOsgbMonthlyCompliance(organizationId);
  return data.id as string;
};

export const importOsgbCompaniesFromKatip = async (
  userId: string,
  organizationId: string,
  companyIds: string[],
) => {
  const uniqueIds = Array.from(new Set(companyIds.filter(Boolean)));
  if (uniqueIds.length === 0) return 0;

  const { data: rows, error } = await (supabase as any)
    .from("isgkatip_companies")
    .select("*")
    .eq("org_id", organizationId)
    .eq("is_deleted", false)
    .in("id", uniqueIds);

  if (error) throw error;

  let imported = 0;
  for (const row of rows ?? []) {
    await upsertOsgbManagedCompany(
      userId,
      organizationId,
      {
        companyName: row.company_name,
        sgkNo: row.sgk_no,
        taxNumber: row.tax_number || null,
        employeeCount: row.employee_count || 0,
        hazardClass: row.hazard_class || "Az Tehlikeli",
        address: row.address || null,
        phone: row.phone || null,
        email: row.email || null,
        contactName: row.contact_name || null,
        contractStart: row.contract_start || null,
        contractEnd: row.contract_end || null,
        monthlyFee: 0,
        assignmentMode: row.assignment_mode || "automatic",
        visitFrequency: row.visit_frequency || "monthly_once",
        notes: row.notes || null,
        managementSource: "isgkatip",
        naceCode: row.nace_code || null,
      },
      row.id,
    );
    imported += 1;
  }

  return imported;
};

export const importOsgbCompaniesFromRows = async (
  userId: string,
  organizationId: string,
  rows: OsgbCompanyManagementInput[],
) => {
  let created = 0;
  for (const row of rows) {
    await upsertOsgbManagedCompany(userId, organizationId, {
      ...row,
      managementSource: row.managementSource || "import",
    });
    created += 1;
  }
  return created;
};

export interface OsgbManagedCompanyOption {
  id: string;
  companyName: string;
  hazardClass: string;
}

export interface OsgbWorkspaceTaskRecord {
  id: string;
  companyId: string | null;
  companyName: string | null;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "completed" | "cancelled";
  assignedTo: string | null;
  dueDate: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OsgbWorkspaceNoteRecord {
  id: string;
  companyId: string | null;
  companyName: string | null;
  title: string | null;
  note: string;
  noteType: "general" | "finance" | "document" | "assignment" | "risk";
  createdAt: string;
  updatedAt: string;
}

export interface OsgbCompany360Snapshot {
  companyId: string;
  activeAssignments: number;
  assignedMinutes: number;
  requiredMinutes: number;
  deficitMinutes: number;
  recentVisitCount: number;
  missingEvidenceVisitCount: number;
  openDocumentCount: number;
  overdueDocumentCount: number;
  currentBalance: number;
  overdueBalance: number;
  activePortalLinkCount: number;
  latestPortalViewAt: string | null;
  openTaskCount: number;
  noteCount: number;
  assignedPeople: string[];
  nextActions: string[];
}

export const listOsgbManagedCompanyOptions = async (
  organizationId: string,
): Promise<OsgbManagedCompanyOption[]> => {
  const { data, error } = await (supabase as any)
    .from("isgkatip_companies")
    .select("id, company_name, hazard_class")
    .eq("org_id", organizationId)
    .eq("is_deleted", false)
    .eq("is_osgb_managed", true)
    .order("company_name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    companyName: row.company_name || "Firma",
    hazardClass: row.hazard_class || "Bilinmiyor",
  }));
};

export const listOsgbTasksWorkspace = async (
  organizationId: string,
): Promise<OsgbWorkspaceTaskRecord[]> => {
  const managedCompanyIds = await listManagedOsgbCompanyIds(organizationId);

  let query = (supabase as any)
    .from("osgb_tasks")
    .select("id, company_id, title, description, priority, status, assigned_to, due_date, source, created_at, updated_at, company:isgkatip_companies(company_name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (managedCompanyIds.length > 0) {
    query = query.or(`company_id.is.null,company_id.in.(${managedCompanyIds.join(",")})`);
  } else {
    query = query.is("company_id", null);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id || null,
    companyName: row.company?.company_name || null,
    title: row.title,
    description: row.description || null,
    priority: row.priority,
    status: row.status,
    assignedTo: row.assigned_to || null,
    dueDate: row.due_date || null,
    source: row.source || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const createOsgbTaskWorkspace = async (
  userId: string,
  organizationId: string,
  input: {
    companyId?: string | null;
    title: string;
    description?: string | null;
    priority?: OsgbWorkspaceTaskRecord["priority"];
    status?: OsgbWorkspaceTaskRecord["status"];
    assignedTo?: string | null;
    dueDate?: string | null;
    source?: string | null;
  },
) => {
  if (input.companyId) {
    const managedCompanyIds = await listManagedOsgbCompanyIds(organizationId);
    if (!managedCompanyIds.includes(input.companyId)) {
      throw new Error("Görev yalnızca OSGB havuzundaki firmalara bağlanabilir.");
    }
  }

  const { data, error } = await (supabase as any)
    .from("osgb_tasks")
    .insert({
      user_id: userId,
      created_by: userId,
      organization_id: organizationId,
      company_id: input.companyId || null,
      title: input.title,
      description: input.description || null,
      priority: input.priority || "medium",
      status: input.status || "open",
      assigned_to: input.assignedTo || null,
      due_date: input.dueDate || null,
      source: input.source || "manual",
    })
    .select("id, company_id, title, description, priority, status, assigned_to, due_date, source, created_at, updated_at, company:isgkatip_companies(company_name)")
    .single();

  if (error) throw error;
  return {
    id: data.id,
    companyId: data.company_id || null,
    companyName: data.company?.company_name || null,
    title: data.title,
    description: data.description || null,
    priority: data.priority,
    status: data.status,
    assignedTo: data.assigned_to || null,
    dueDate: data.due_date || null,
    source: data.source || null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } satisfies OsgbWorkspaceTaskRecord;
};

export const updateOsgbTaskWorkspaceStatus = async (
  organizationId: string,
  id: string,
  status: OsgbWorkspaceTaskRecord["status"],
) => {
  const { data, error } = await (supabase as any)
    .from("osgb_tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("id, company_id, title, description, priority, status, assigned_to, due_date, source, created_at, updated_at, company:isgkatip_companies(company_name)")
    .single();

  if (error) throw error;
  return {
    id: data.id,
    companyId: data.company_id || null,
    companyName: data.company?.company_name || null,
    title: data.title,
    description: data.description || null,
    priority: data.priority,
    status: data.status,
    assignedTo: data.assigned_to || null,
    dueDate: data.due_date || null,
    source: data.source || null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } satisfies OsgbWorkspaceTaskRecord;
};

export const deleteOsgbTaskWorkspace = async (
  organizationId: string,
  id: string,
) => {
  const { error } = await (supabase as any)
    .from("osgb_tasks")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", id);

  if (error) throw error;
};

export const listOsgbNotesWorkspace = async (
  organizationId: string,
): Promise<OsgbWorkspaceNoteRecord[]> => {
  const managedCompanyIds = await listManagedOsgbCompanyIds(organizationId);

  let query = (supabase as any)
    .from("osgb_notes")
    .select("id, company_id, title, note, note_type, created_at, updated_at, company:isgkatip_companies(company_name)")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  if (managedCompanyIds.length > 0) {
    query = query.or(`company_id.is.null,company_id.in.(${managedCompanyIds.join(",")})`);
  } else {
    query = query.is("company_id", null);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id || null,
    companyName: row.company?.company_name || null,
    title: row.title || null,
    note: row.note,
    noteType: row.note_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const upsertOsgbNoteWorkspace = async (
  userId: string,
  organizationId: string,
  input: {
    companyId?: string | null;
    title?: string | null;
    note: string;
    noteType: OsgbWorkspaceNoteRecord["noteType"];
  },
  id?: string,
) => {
  if (input.companyId) {
    const managedCompanyIds = await listManagedOsgbCompanyIds(organizationId);
    if (!managedCompanyIds.includes(input.companyId)) {
      throw new Error("Not yalnızca OSGB havuzundaki firmalara bağlanabilir.");
    }
  }

  const payload = {
    user_id: userId,
    created_by: userId,
    organization_id: organizationId,
    company_id: input.companyId || null,
    title: input.title || null,
    note: input.note,
    note_type: input.noteType,
    updated_at: new Date().toISOString(),
  };

  const query = id
    ? (supabase as any).from("osgb_notes").update(payload).eq("organization_id", organizationId).eq("id", id)
    : (supabase as any).from("osgb_notes").insert(payload);

  const { data, error } = await query
    .select("id, company_id, title, note, note_type, created_at, updated_at, company:isgkatip_companies(company_name)")
    .single();

  if (error) throw error;
  return {
    id: data.id,
    companyId: data.company_id || null,
    companyName: data.company?.company_name || null,
    title: data.title || null,
    note: data.note,
    noteType: data.note_type,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } satisfies OsgbWorkspaceNoteRecord;
};

export const deleteOsgbNoteWorkspace = async (
  organizationId: string,
  id: string,
) => {
  const { error } = await (supabase as any)
    .from("osgb_notes")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", id);

  if (error) throw error;
};

export const getOsgbCompany360Snapshot = async (
  organizationId: string,
  companyId: string,
  serviceMonth = getServiceMonth(),
): Promise<OsgbCompany360Snapshot> => {
  const [complianceResponse, assignmentsResponse, visitsResponse, documentsResponse, financeResponse, portalResponse, tasksResponse, notesResponse] = await Promise.all([
    (supabase as any)
      .from("osgb_monthly_company_compliance")
      .select("igu_required_minutes, hekim_required_minutes, dsp_required_minutes, igu_assigned_minutes, hekim_assigned_minutes, dsp_assigned_minutes, deficit_minutes")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .eq("service_month", serviceMonth)
      .maybeSingle(),
    (supabase as any)
      .from("osgb_assignments")
      .select("assigned_minutes, personnel:osgb_personnel(full_name)")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .eq("status", "active"),
    (supabase as any)
      .from("osgb_field_visits")
      .select("id, visit_status")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId),
    (supabase as any)
      .from("osgb_required_documents")
      .select("id, status, delay_days")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId),
    (supabase as any)
      .from("osgb_finance_accounts")
      .select("current_balance, overdue_balance")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .maybeSingle(),
    (supabase as any)
      .from("osgb_client_portal_links")
      .select("id, portal_status, last_viewed_at")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId),
    (supabase as any)
      .from("osgb_tasks")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .in("status", ["open", "in_progress"]),
    (supabase as any)
      .from("osgb_notes")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId),
  ]);

  if (complianceResponse.error) throw complianceResponse.error;
  if (assignmentsResponse.error) throw assignmentsResponse.error;
  if (visitsResponse.error) throw visitsResponse.error;
  if (documentsResponse.error) throw documentsResponse.error;
  if (financeResponse.error) throw financeResponse.error;
  if (portalResponse.error) throw portalResponse.error;
  if (tasksResponse.error) throw tasksResponse.error;
  if (notesResponse.error) throw notesResponse.error;

  const compliance = complianceResponse.data;
  const visits = visitsResponse.data ?? [];
  const documents = documentsResponse.data ?? [];
  const portalLinks = portalResponse.data ?? [];

  const nextActions: string[] = [];
  const deficitMinutes = Number(compliance?.deficit_minutes || 0);
  const overdueDocuments = documents.filter((item: any) => item.status === "missing" && Number(item.delay_days || 0) > 0).length;
  const missingEvidenceVisits = visits.filter((item: any) => item.visit_status === "completed").length;
  const overdueBalance = Number(financeResponse.data?.overdue_balance || 0);

  if (deficitMinutes > 0) nextActions.push("Eksik hizmet süresi için yeni atama yapın.");
  if (overdueDocuments > 0) nextActions.push("Geciken evraklar için müşteri bildirimi ve görev oluşturun.");
  if (missingEvidenceVisits > 0) nextActions.push("Kanıt seviyesi düşük ziyaretler için ek fotoğraf veya imza isteyin.");
  if (overdueBalance > 0) nextActions.push("Cari bakiyede gecikme var; tahsilat takibini başlatın.");
  if (nextActions.length === 0) nextActions.push("Firma operasyonu dengede görünüyor; planlı ziyaret ve evrak vadesini izleyin.");

  return {
    companyId,
    activeAssignments: (assignmentsResponse.data ?? []).length,
    assignedMinutes: Number(compliance?.igu_assigned_minutes || 0) + Number(compliance?.hekim_assigned_minutes || 0) + Number(compliance?.dsp_assigned_minutes || 0),
    requiredMinutes: Number(compliance?.igu_required_minutes || 0) + Number(compliance?.hekim_required_minutes || 0) + Number(compliance?.dsp_required_minutes || 0),
    deficitMinutes,
    recentVisitCount: visits.length,
    missingEvidenceVisitCount: missingEvidenceVisits,
    openDocumentCount: documents.filter((item: any) => item.status !== "approved").length,
    overdueDocumentCount: overdueDocuments,
    currentBalance: Number(financeResponse.data?.current_balance || 0),
    overdueBalance,
    activePortalLinkCount: portalLinks.filter((item: any) => item.portal_status === "active").length,
    latestPortalViewAt: portalLinks
      .map((item: any) => item.last_viewed_at)
      .filter(Boolean)
      .sort()
      .at(-1) || null,
    openTaskCount: (tasksResponse.data ?? []).length,
    noteCount: (notesResponse.data ?? []).length,
    assignedPeople: Array.from(new Set((assignmentsResponse.data ?? []).map((item: any) => item.personnel?.full_name).filter(Boolean))),
    nextActions,
  };
};
