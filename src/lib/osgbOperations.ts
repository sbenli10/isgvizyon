import { supabase } from "@/integrations/supabase/client";

export interface OsgbCompanyOption {
  id: string;
  companyName: string;
  hazardClass: string;
  contractEnd: string | null;
  employeeCount?: number;
  requiredMinutes?: number;
  assignedMinutes?: number;
}

export interface OsgbPersonnelRecord {
  id: string;
  user_id: string;
  full_name: string;
  role: "igu" | "hekim" | "dsp";
  certificate_no: string | null;
  phone: string | null;
  email: string | null;
  certificate_expiry_date: string | null;
  expertise_areas: string[] | null;
  monthly_capacity_minutes: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OsgbAssignmentRecord {
  id: string;
  user_id: string;
  company_id: string;
  personnel_id: string;
  assigned_role: "igu" | "hekim" | "dsp";
  assigned_minutes: number;
  start_date: string | null;
  end_date: string | null;
  status: "active" | "passive" | "completed" | "cancelled";
  notes: string | null;
  created_at: string;
  updated_at: string;
  company?: { company_name: string | null } | null;
  personnel?: { full_name: string | null; role: string | null } | null;
}

export interface OsgbFinanceRecord {
  id: string;
  user_id: string;
  company_id: string;
  invoice_no: string | null;
  service_period: string | null;
  invoice_date: string | null;
  due_date: string | null;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  paid_at: string | null;
  payment_note: string | null;
  created_at: string;
  company?: { company_name: string | null } | null;
}

export interface OsgbDocumentRecord {
  id: string;
  user_id: string;
  company_id: string;
  document_type: string;
  document_name: string;
  issue_date: string | null;
  expiry_date: string | null;
  status: "active" | "warning" | "expired" | "archived";
  file_url: string | null;
  notes: string | null;
  created_at: string;
  company?: { company_name: string | null } | null;
}

export interface OsgbTaskRecord {
  id: string;
  user_id: string;
  company_id: string | null;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "completed" | "cancelled";
  assigned_to: string | null;
  due_date: string | null;
  source: string;
  created_at: string;
  company?: { company_name: string | null } | null;
}

export interface OsgbNoteRecord {
  id: string;
  user_id: string;
  company_id: string | null;
  title: string | null;
  note: string;
  note_type: "general" | "finance" | "document" | "assignment" | "risk";
  created_at: string;
  updated_at: string;
  company?: { company_name: string | null } | null;
}

export interface OsgbBatchLogRecord {
  id: string;
  user_id: string | null;
  batch_type: string;
  run_source: string;
  status: "success" | "error";
  processed_count: number;
  created_count: number;
  skipped_count: number;
  error_message: string | null;
  created_at: string;
}

export interface OsgbAssignmentRecommendation {
  role: OsgbAssignmentRecord["assigned_role"];
  hazardClass: string;
  employeeCount: number;
  perEmployeeMinutes: number;
  recommendedMinutes: number;
  currentAssignedMinutes: number;
  projectedCoverageRatio: number;
  remainingGapMinutes: number;
  legalReference: string;
  summary: string;
}

export interface OsgbTaskInput {
  companyId?: string | null;
  relatedDocumentId?: string | null;
  relatedFinanceId?: string | null;
  title: string;
  description?: string | null;
  priority?: OsgbTaskRecord["priority"];
  status?: OsgbTaskRecord["status"];
  assignedTo?: string | null;
  dueDate?: string | null;
  source?: string;
}

export interface OsgbFinanceInput {
  companyId: string;
  invoiceNo?: string | null;
  servicePeriod?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  amount: number;
  currency?: string;
  status?: OsgbFinanceRecord["status"];
  paidAt?: string | null;
  paymentNote?: string | null;
}

export interface OsgbDocumentInput {
  companyId: string;
  documentType: string;
  documentName: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  status?: OsgbDocumentRecord["status"];
  fileUrl?: string | null;
  notes?: string | null;
}

export interface OsgbNoteInput {
  companyId?: string | null;
  title?: string | null;
  note: string;
  noteType?: OsgbNoteRecord["note_type"];
}

export interface OsgbPersonnelInput {
  fullName: string;
  role: OsgbPersonnelRecord["role"];
  certificateNo?: string | null;
  phone?: string | null;
  email?: string | null;
  certificateExpiryDate?: string | null;
  expertiseAreas?: string[] | null;
  monthlyCapacityMinutes: number;
  isActive?: boolean;
  notes?: string | null;
}

export interface OsgbPersonnelPageParams {
  page: number;
  pageSize: number;
  role?: string;
  status?: string;
  search?: string;
}

export interface OsgbAssignmentPageParams {
  page: number;
  pageSize: number;
  status?: string;
  search?: string;
}

export interface OsgbFinancePageParams {
  page: number;
  pageSize: number;
  status?: string;
  companyId?: string;
  search?: string;
}

export interface OsgbDocumentPageParams {
  page: number;
  pageSize: number;
  status?: string;
  companyId?: string;
  search?: string;
}

export interface OsgbAssignmentInput {
  companyId: string;
  personnelId: string;
  assignedRole: OsgbAssignmentRecord["assigned_role"];
  assignedMinutes: number;
  startDate?: string | null;
  endDate?: string | null;
  status?: OsgbAssignmentRecord["status"];
  notes?: string | null;
}

export interface OsgbCompanyTrackingRecord {
  companyId: string;
  companyName: string;
  hazardClass: string;
  employeeCount: number;
  contractEnd: string | null;
  requiredMinutes: number;
  assignedMinutes: number;
  assignmentStatus: "atandi" | "eksik" | "atanmamis";
  activeAssignment: {
    assignmentId: string;
    personnelName: string;
    role: string;
    assignedMinutes: number;
    startDate: string | null;
    endDate: string | null;
  } | null;
  documentSummary: {
    active: number;
    warning: number;
    expired: number;
  };
  financeSummary: {
    pendingAmount: number;
    overdueAmount: number;
  };
  openTaskCount: number;
  noteCount: number;
}

export interface OsgbFinanceCalendarItem {
  id: string;
  companyName: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: OsgbFinanceRecord["status"];
  invoiceNo: string | null;
  servicePeriod: string | null;
  dayLabel: string;
  monthLabel: string;
  isOverdue: boolean;
}

export interface OsgbOperationalSummary {
  finance: {
    pendingCount: number;
    pendingAmount: number;
    paidAmount: number;
    overdueCount: number;
    overdueAmount: number;
    calendarItems: OsgbFinanceCalendarItem[];
    monthlyTrend: Array<{
      month: string;
      pendingAmount: number;
      paidAmount: number;
      overdueAmount: number;
    }>;
  };
  documents: {
    activeCount: number;
    warningCount: number;
    expiredCount: number;
    expiringSoonCount: number;
    monthlyTrend: Array<{
      month: string;
      activeCount: number;
      warningCount: number;
      expiredCount: number;
    }>;
  };
}

export interface OsgbDashboardOperationalSummary {
  finance: {
    pendingAmount: number;
    overdueCount: number;
    overdueAmount: number;
    calendarItemCount: number;
    monthlyTrendMonths: number;
  };
  documents: {
    warningCount: number;
    expiredCount: number;
    monthlyTrendMonths: number;
  };
}

export interface OsgbFinanceOverview {
  pendingAmount: number;
  paidAmount: number;
  overdueAmount: number;
  calendarItems: OsgbFinanceCalendarItem[];
}

export interface OsgbDocumentsOverview {
  activeCount: number;
  warningCount: number;
  expiredCount: number;
}

export interface PagedResult<T> {
  rows: T[];
  count: number;
}

export interface OsgbTaskPageParams {
  page: number;
  pageSize: number;
  status?: string;
  search?: string;
}

const assignmentDuplicateMessage =
  "Bu firmada zaten aktif bir personel görevlendirmesi var. Mükerrer atama engellendi.";

const normalizeHazardClass = (value?: string | null) => {
  const normalized = (value || "").toLocaleLowerCase("tr-TR");
  if (normalized.includes("çok")) return "cok_tehlikeli";
  if (normalized.includes("tehlikeli")) return "tehlikeli";
  return "az_tehlikeli";
};

const assignmentRecommendationMatrix: Record<
  OsgbAssignmentRecord["assigned_role"],
  Record<"az_tehlikeli" | "tehlikeli" | "cok_tehlikeli", number>
> = {
  igu: {
    az_tehlikeli: 10,
    tehlikeli: 20,
    cok_tehlikeli: 40,
  },
  hekim: {
    az_tehlikeli: 5,
    tehlikeli: 10,
    cok_tehlikeli: 15,
  },
  dsp: {
    az_tehlikeli: 0,
    tehlikeli: 10,
    cok_tehlikeli: 15,
  },
};

const assignmentLegalReference: Record<OsgbAssignmentRecord["assigned_role"], string> = {
  igu: "6331 sayılı Kanun ve iş güvenliği uzmanı görevlendirme süreleri",
  hekim: "6331 sayılı Kanun ve işyeri hekimi görevlendirme süreleri",
  dsp: "6331 sayılı Kanun ve diğer sağlık personeli görevlendirme süreleri",
};

export const getOsgbCompanyOptions = async (userId: string): Promise<OsgbCompanyOption[]> => {
  const { data, error } = await supabase
    .from("isgkatip_companies")
    .select("id, company_name, hazard_class, contract_end, employee_count, required_minutes, assigned_minutes")
    .eq("org_id", userId)
    .eq("is_deleted", false)
    .order("company_name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    id: item.id,
    companyName: item.company_name,
    hazardClass: item.hazard_class || "Bilinmiyor",
    contractEnd: item.contract_end || null,
    employeeCount: item.employee_count || 0,
    requiredMinutes: item.required_minutes || 0,
    assignedMinutes: item.assigned_minutes || 0,
  }));
};

export const listOsgbPersonnel = async (userId: string): Promise<OsgbPersonnelRecord[]> => {
  const { data, error } = await supabase
    .from("osgb_personnel")
    .select("*")
    .eq("user_id", userId)
    .order("full_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as OsgbPersonnelRecord[];
};

export const listOsgbPersonnelPage = async (
  userId: string,
  params: OsgbPersonnelPageParams,
): Promise<PagedResult<OsgbPersonnelRecord>> => {
  const { page, pageSize, role, status, search } = params;
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  let query = (supabase as any)
    .from("osgb_personnel")
    .select("*", { count: "exact" })
    .eq("user_id", userId);

  if (role && role !== "ALL") {
    query = query.eq("role", role);
  }

  if (status && status !== "ALL") {
    query = query.eq("is_active", status === "active");
  }

  if (search?.trim()) {
    const term = search.trim().replace(/,/g, " ");
    query = query.or(
      `full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,certificate_no.ilike.%${term}%`,
    );
  }

  const { data, error, count } = await query
    .order("full_name", { ascending: true })
    .range(from, to);

  if (error) throw error;
  return {
    rows: (data ?? []) as OsgbPersonnelRecord[],
    count: count ?? 0,
  };
};

export const listOsgbPersonnelIdentity = async (
  userId: string,
): Promise<Array<Pick<OsgbPersonnelRecord, "email" | "certificate_no">>> => {
  const { data, error } = await supabase
    .from("osgb_personnel")
    .select("email, certificate_no")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []) as Array<Pick<OsgbPersonnelRecord, "email" | "certificate_no">>;
};

export const listActiveOsgbPersonnel = async (userId: string): Promise<OsgbPersonnelRecord[]> => {
  const { data, error } = await supabase
    .from("osgb_personnel")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as OsgbPersonnelRecord[];
};

export const upsertOsgbPersonnel = async (userId: string, input: OsgbPersonnelInput, id?: string) => {
  const payload = {
    user_id: userId,
    full_name: input.fullName,
    role: input.role,
    certificate_no: input.certificateNo || null,
    phone: input.phone || null,
    email: input.email || null,
    certificate_expiry_date: input.certificateExpiryDate || null,
    expertise_areas: input.expertiseAreas?.filter(Boolean) || [],
    monthly_capacity_minutes: input.monthlyCapacityMinutes,
    is_active: input.isActive ?? true,
    notes: input.notes || null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data, error } = await supabase.from("osgb_personnel").update(payload).eq("id", id).select("*").single();
    if (error) throw error;
    return data as OsgbPersonnelRecord;
  }

  const { data, error } = await supabase.from("osgb_personnel").insert(payload).select("*").single();
  if (error) throw error;
  return data as OsgbPersonnelRecord;
};

export const deleteOsgbPersonnel = async (id: string) => {
  const { error } = await supabase.from("osgb_personnel").delete().eq("id", id);
  if (error) throw error;
};

export const listOsgbAssignments = async (userId: string): Promise<OsgbAssignmentRecord[]> => {
  const { data, error } = await supabase
    .from("osgb_assignments")
    .select("*, company:isgkatip_companies(company_name), personnel:osgb_personnel(full_name, role)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OsgbAssignmentRecord[];
};

export const listOsgbAssignmentsPage = async (
  userId: string,
  params: OsgbAssignmentPageParams,
): Promise<PagedResult<OsgbAssignmentRecord>> => {
  const { page, pageSize, status, search } = params;
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  let query = (supabase as any)
    .from("osgb_assignments")
    .select("*, company:isgkatip_companies(company_name), personnel:osgb_personnel(full_name, role)", { count: "exact" })
    .eq("user_id", userId);

  if (status && status !== "ALL") {
    query = query.eq("status", status);
  }

  if (search?.trim()) {
    const term = search.trim().replace(/,/g, " ");
    const [companyResult, personnelResult] = await Promise.all([
      supabase
        .from("isgkatip_companies")
        .select("id")
        .eq("org_id", userId)
        .eq("is_deleted", false)
        .ilike("company_name", `%${term}%`)
        .limit(100),
      supabase
        .from("osgb_personnel")
        .select("id")
        .eq("user_id", userId)
        .ilike("full_name", `%${term}%`)
        .limit(100),
    ]);

    if (companyResult.error) throw companyResult.error;
    if (personnelResult.error) throw personnelResult.error;

    const companyIds = (companyResult.data ?? []).map((item: any) => item.id);
    const personnelIds = (personnelResult.data ?? []).map((item: any) => item.id);
    const conditions = [
      `notes.ilike.%${term}%`,
      `assigned_role.ilike.%${term}%`,
    ];

    if (companyIds.length > 0) {
      conditions.push(`company_id.in.(${companyIds.join(",")})`);
    }

    if (personnelIds.length > 0) {
      conditions.push(`personnel_id.in.(${personnelIds.join(",")})`);
    }

    query = query.or(conditions.join(","));
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  return {
    rows: (data ?? []) as OsgbAssignmentRecord[],
    count: count ?? 0,
  };
};

export const getOsgbPersonnelAssignedMinutes = async (
  userId: string,
  personnelIds: string[],
): Promise<Record<string, number>> => {
  if (personnelIds.length === 0) return {};

  const { data, error } = await supabase
    .from("osgb_assignments")
    .select("personnel_id, assigned_minutes")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("personnel_id", personnelIds);

  if (error) throw error;

  return (data ?? []).reduce<Record<string, number>>((acc, item: any) => {
    acc[item.personnel_id] = (acc[item.personnel_id] || 0) + Number(item.assigned_minutes || 0);
    return acc;
  }, {});
};

export const getOsgbPersonnelAssignedMinutesTotal = async (
  userId: string,
  personnelId: string,
  assignmentId?: string,
): Promise<number> => {
  let query = supabase
    .from("osgb_assignments")
    .select("assigned_minutes")
    .eq("user_id", userId)
    .eq("personnel_id", personnelId)
    .eq("status", "active");

  if (assignmentId) {
    query = query.neq("id", assignmentId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).reduce((sum: number, item: any) => sum + Number(item.assigned_minutes || 0), 0);
};

export const getOsgbCompanyAssignedMinutesTotal = async (
  userId: string,
  companyId: string,
  assignmentId?: string,
): Promise<number> => {
  let query = supabase
    .from("osgb_assignments")
    .select("assigned_minutes")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("status", "active");

  if (assignmentId) {
    query = query.neq("id", assignmentId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).reduce((sum: number, item: any) => sum + Number(item.assigned_minutes || 0), 0);
};

export const listCompanyOsgbAssignments = async (
  userId: string,
  companyId: string,
): Promise<OsgbAssignmentRecord[]> => {
  const { data, error } = await supabase
    .from("osgb_assignments")
    .select("*, company:isgkatip_companies(company_name), personnel:osgb_personnel(full_name, role)")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OsgbAssignmentRecord[];
};

export const getCompanyActiveAssignment = async (userId: string, companyId: string, assignmentId?: string) => {
  let query = supabase
    .from("osgb_assignments")
    .select("id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("status", "active")
    .limit(1);

  if (assignmentId) {
    query = query.neq("id", assignmentId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).length > 0;
};

export const upsertOsgbAssignment = async (userId: string, input: OsgbAssignmentInput, id?: string) => {
  const hasDuplicate = input.status === "active"
    ? await getCompanyActiveAssignment(userId, input.companyId, id)
    : false;

  if (hasDuplicate) {
    throw new Error(assignmentDuplicateMessage);
  }

  const payload = {
    user_id: userId,
    company_id: input.companyId,
    personnel_id: input.personnelId,
    assigned_role: input.assignedRole,
    assigned_minutes: input.assignedMinutes,
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    status: input.status || "active",
    notes: input.notes || null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data, error } = await supabase
      .from("osgb_assignments")
      .update(payload)
      .eq("id", id)
      .select("*, company:isgkatip_companies(company_name), personnel:osgb_personnel(full_name, role)")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new Error(assignmentDuplicateMessage);
      }
      throw error;
    }
    return data as OsgbAssignmentRecord;
  }

  const { data, error } = await supabase
    .from("osgb_assignments")
    .insert(payload)
    .select("*, company:isgkatip_companies(company_name), personnel:osgb_personnel(full_name, role)")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error(assignmentDuplicateMessage);
    }
    throw error;
  }
  return data as OsgbAssignmentRecord;
};

export const deleteOsgbAssignment = async (id: string) => {
  const { error } = await supabase.from("osgb_assignments").delete().eq("id", id);
  if (error) throw error;
};

export const listOsgbFinance = async (userId: string): Promise<OsgbFinanceRecord[]> => {
  const { data, error } = await supabase
    .from("osgb_finance")
    .select("*, company:isgkatip_companies(company_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OsgbFinanceRecord[];
};

export const listOsgbFinancePage = async (
  userId: string,
  params: OsgbFinancePageParams,
): Promise<PagedResult<OsgbFinanceRecord>> => {
  const { page, pageSize, status, companyId, search } = params;
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  let query = (supabase as any)
    .from("osgb_finance")
    .select("*, company:isgkatip_companies(company_name)", { count: "exact" })
    .eq("user_id", userId);

  if (status && status !== "ALL") {
    query = query.eq("status", status);
  }

  if (companyId && companyId !== "ALL") {
    query = query.eq("company_id", companyId);
  }

  if (search?.trim()) {
    const term = search.trim().replace(/,/g, " ");
    const companyResult = await supabase
      .from("isgkatip_companies")
      .select("id")
      .eq("org_id", userId)
      .eq("is_deleted", false)
      .ilike("company_name", `%${term}%`)
      .limit(100);

    if (companyResult.error) throw companyResult.error;

    const companyIds = (companyResult.data ?? []).map((item: any) => item.id);
    const conditions = [
      `invoice_no.ilike.%${term}%`,
      `service_period.ilike.%${term}%`,
      `payment_note.ilike.%${term}%`,
    ];

    if (companyIds.length > 0) {
      conditions.push(`company_id.in.(${companyIds.join(",")})`);
    }

    query = query.or(conditions.join(","));
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  return {
    rows: (data ?? []) as OsgbFinanceRecord[],
    count: count ?? 0,
  };
};

export const listCompanyOsgbFinance = async (
  userId: string,
  companyId: string,
): Promise<OsgbFinanceRecord[]> => {
  const { data, error } = await supabase
    .from("osgb_finance")
    .select("*, company:isgkatip_companies(company_name)")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OsgbFinanceRecord[];
};

export const getOsgbFinanceOverview = async (userId: string): Promise<OsgbFinanceOverview> => {
  const { data, error } = await supabase
    .from("osgb_finance")
    .select("id, due_date, invoice_date, amount, status, currency, invoice_no, service_period, company:isgkatip_companies(company_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const financeRows = (data ?? []) as Array<{
    id: string;
    due_date: string | null;
    invoice_date: string | null;
    amount: number;
    currency: string;
    status: OsgbFinanceRecord["status"];
    invoice_no: string | null;
    service_period: string | null;
    company?: { company_name: string | null } | null;
  }>;

  const now = new Date();
  const nextWindow = new Date();
  nextWindow.setDate(nextWindow.getDate() + 60);

  const calendarItems = financeRows
    .filter((record) => {
      if (!record.due_date) return false;
      const dueDate = new Date(record.due_date);
      if (Number.isNaN(dueDate.getTime())) return false;
      return record.status === "overdue" || (dueDate >= now && dueDate <= nextWindow);
    })
    .sort((a, b) => {
      const aTime = a.due_date ? new Date(a.due_date).getTime() : 0;
      const bTime = b.due_date ? new Date(b.due_date).getTime() : 0;
      return aTime - bTime;
    })
    .slice(0, 12)
    .map((record) => {
      const dueDate = new Date(record.due_date as string);
      return {
        id: record.id,
        companyName: record.company?.company_name || "Firma",
        amount: record.amount,
        currency: record.currency,
        dueDate: record.due_date as string,
        status: record.status,
        invoiceNo: record.invoice_no,
        servicePeriod: record.service_period,
        dayLabel: dueDate.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }),
        monthLabel: dueDate.toLocaleDateString("tr-TR", { month: "long", year: "numeric" }),
        isOverdue: record.status === "overdue" || dueDate.getTime() < now.getTime(),
      } satisfies OsgbFinanceCalendarItem;
    });

  return {
    pendingAmount: financeRows.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amount, 0),
    paidAmount: financeRows.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount, 0),
    overdueAmount: financeRows.filter((item) => item.status === "overdue").reduce((sum, item) => sum + item.amount, 0),
    calendarItems,
  };
};

export const upsertOsgbFinance = async (userId: string, input: OsgbFinanceInput, id?: string) => {
  const payload = {
    user_id: userId,
    company_id: input.companyId,
    invoice_no: input.invoiceNo || null,
    service_period: input.servicePeriod || null,
    invoice_date: input.invoiceDate || null,
    due_date: input.dueDate || null,
    amount: input.amount,
    currency: input.currency || "TRY",
    status: input.status || "pending",
    paid_at: input.paidAt || null,
    payment_note: input.paymentNote || null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data, error } = await supabase.from("osgb_finance").update(payload).eq("id", id).select("*, company:isgkatip_companies(company_name)").single();
    if (error) throw error;
    return data as OsgbFinanceRecord;
  }

  const { data, error } = await supabase.from("osgb_finance").insert(payload).select("*, company:isgkatip_companies(company_name)").single();
  if (error) throw error;
  return data as OsgbFinanceRecord;
};

export const deleteOsgbFinance = async (id: string) => {
  const { error } = await supabase.from("osgb_finance").delete().eq("id", id);
  if (error) throw error;
};

export const listOsgbDocuments = async (userId: string): Promise<OsgbDocumentRecord[]> => {
  const { data, error } = await supabase
    .from("osgb_document_tracking")
    .select("*, company:isgkatip_companies(company_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OsgbDocumentRecord[];
};

export const listOsgbDocumentsPage = async (
  userId: string,
  params: OsgbDocumentPageParams,
): Promise<PagedResult<OsgbDocumentRecord>> => {
  const { page, pageSize, status, companyId, search } = params;
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  let query = (supabase as any)
    .from("osgb_document_tracking")
    .select("*, company:isgkatip_companies(company_name)", { count: "exact" })
    .eq("user_id", userId);

  if (status && status !== "ALL") {
    query = query.eq("status", status);
  }

  if (companyId && companyId !== "ALL") {
    query = query.eq("company_id", companyId);
  }

  if (search?.trim()) {
    const term = search.trim().replace(/,/g, " ");
    const companyResult = await supabase
      .from("isgkatip_companies")
      .select("id")
      .eq("org_id", userId)
      .eq("is_deleted", false)
      .ilike("company_name", `%${term}%`)
      .limit(100);

    if (companyResult.error) throw companyResult.error;

    const companyIds = (companyResult.data ?? []).map((item: any) => item.id);
    const conditions = [
      `document_name.ilike.%${term}%`,
      `document_type.ilike.%${term}%`,
      `notes.ilike.%${term}%`,
    ];

    if (companyIds.length > 0) {
      conditions.push(`company_id.in.(${companyIds.join(",")})`);
    }

    query = query.or(conditions.join(","));
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  return {
    rows: (data ?? []) as OsgbDocumentRecord[],
    count: count ?? 0,
  };
};

export const getOsgbDocumentsOverview = async (userId: string): Promise<OsgbDocumentsOverview> => {
  const { data, error } = await supabase
    .from("osgb_document_tracking")
    .select("status")
    .eq("user_id", userId);

  if (error) throw error;

  const rows = (data ?? []) as Array<{ status: OsgbDocumentRecord["status"] }>;
  return {
    activeCount: rows.filter((item) => item.status === "active").length,
    warningCount: rows.filter((item) => item.status === "warning").length,
    expiredCount: rows.filter((item) => item.status === "expired").length,
  };
};

export const listActionableOsgbDocuments = async (userId: string): Promise<OsgbDocumentRecord[]> => {
  const { data, error } = await supabase
    .from("osgb_document_tracking")
    .select("*, company:isgkatip_companies(company_name)")
    .eq("user_id", userId)
    .in("status", ["warning", "expired"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OsgbDocumentRecord[];
};

export const listCompanyOsgbDocuments = async (
  userId: string,
  companyId: string,
): Promise<OsgbDocumentRecord[]> => {
  const { data, error } = await supabase
    .from("osgb_document_tracking")
    .select("*, company:isgkatip_companies(company_name)")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OsgbDocumentRecord[];
};

export const upsertOsgbDocument = async (userId: string, input: OsgbDocumentInput, id?: string) => {
  const payload = {
    user_id: userId,
    company_id: input.companyId,
    document_type: input.documentType,
    document_name: input.documentName,
    issue_date: input.issueDate || null,
    expiry_date: input.expiryDate || null,
    status: input.status || "active",
    file_url: input.fileUrl || null,
    notes: input.notes || null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data, error } = await supabase.from("osgb_document_tracking").update(payload).eq("id", id).select("*, company:isgkatip_companies(company_name)").single();
    if (error) throw error;
    return data as OsgbDocumentRecord;
  }

  const { data, error } = await supabase.from("osgb_document_tracking").insert(payload).select("*, company:isgkatip_companies(company_name)").single();
  if (error) throw error;
  return data as OsgbDocumentRecord;
};

export const deleteOsgbDocument = async (id: string) => {
  const { error } = await supabase.from("osgb_document_tracking").delete().eq("id", id);
  if (error) throw error;
};

export const getOsgbOperationalSummary = async (userId: string): Promise<OsgbOperationalSummary> => {
  const [financeRows, documentRows] = await Promise.all([
    listOsgbFinance(userId),
    listOsgbDocuments(userId),
  ]);

  const now = new Date();
  const nextWindow = new Date();
  nextWindow.setDate(nextWindow.getDate() + 60);

  const calendarItems = financeRows
    .filter((record) => {
      if (!record.due_date) return false;
      const dueDate = new Date(record.due_date);
      if (Number.isNaN(dueDate.getTime())) return false;
      return record.status === "overdue" || (dueDate >= now && dueDate <= nextWindow);
    })
    .sort((a, b) => {
      const aTime = a.due_date ? new Date(a.due_date).getTime() : 0;
      const bTime = b.due_date ? new Date(b.due_date).getTime() : 0;
      return aTime - bTime;
    })
    .slice(0, 12)
    .map((record) => {
      const dueDate = new Date(record.due_date as string);
      return {
        id: record.id,
        companyName: record.company?.company_name || "Firma",
        amount: record.amount,
        currency: record.currency,
        dueDate: record.due_date as string,
        status: record.status,
        invoiceNo: record.invoice_no,
        servicePeriod: record.service_period,
        dayLabel: dueDate.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }),
        monthLabel: dueDate.toLocaleDateString("tr-TR", { month: "long", year: "numeric" }),
        isOverdue: record.status === "overdue" || dueDate.getTime() < now.getTime(),
      } satisfies OsgbFinanceCalendarItem;
    });

  const monthKeys = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("tr-TR", { month: "short" });
    return { key, label };
  });

  const financeMonthlyTrend = monthKeys.map(({ key, label }) => {
    const rows = financeRows.filter((record) => {
      const reference = record.due_date || record.invoice_date;
      if (!reference) return false;
      const date = new Date(reference);
      if (Number.isNaN(date.getTime())) return false;
      const rowKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return rowKey === key;
    });

    return {
      month: label,
      pendingAmount: rows.filter((row) => row.status === "pending").reduce((sum, row) => sum + row.amount, 0),
      paidAmount: rows.filter((row) => row.status === "paid").reduce((sum, row) => sum + row.amount, 0),
      overdueAmount: rows.filter((row) => row.status === "overdue").reduce((sum, row) => sum + row.amount, 0),
    };
  });

  const documentMonthlyTrend = monthKeys.map(({ key, label }) => {
    const rows = documentRows.filter((record) => {
      const reference = record.expiry_date || record.created_at;
      if (!reference) return false;
      const date = new Date(reference);
      if (Number.isNaN(date.getTime())) return false;
      const rowKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return rowKey === key;
    });

    return {
      month: label,
      activeCount: rows.filter((row) => row.status === "active").length,
      warningCount: rows.filter((row) => row.status === "warning").length,
      expiredCount: rows.filter((row) => row.status === "expired").length,
    };
  });

  return {
    finance: {
      pendingCount: financeRows.filter((item) => item.status === "pending").length,
      pendingAmount: financeRows.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amount, 0),
      paidAmount: financeRows.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount, 0),
      overdueCount: financeRows.filter((item) => item.status === "overdue").length,
      overdueAmount: financeRows.filter((item) => item.status === "overdue").reduce((sum, item) => sum + item.amount, 0),
      calendarItems,
      monthlyTrend: financeMonthlyTrend,
    },
    documents: {
      activeCount: documentRows.filter((item) => item.status === "active").length,
      warningCount: documentRows.filter((item) => item.status === "warning").length,
      expiredCount: documentRows.filter((item) => item.status === "expired").length,
      expiringSoonCount: documentRows.filter((item) => item.status === "warning" || item.status === "expired").length,
      monthlyTrend: documentMonthlyTrend,
    },
  };
};

export const getOsgbDashboardOperationalSummary = async (userId: string): Promise<OsgbDashboardOperationalSummary> => {
  const [financeResponse, documentResponse] = await Promise.all([
    supabase
      .from("osgb_finance")
      .select("due_date, invoice_date, amount, status")
      .eq("user_id", userId),
    supabase
      .from("osgb_document_tracking")
      .select("expiry_date, created_at, status")
      .eq("user_id", userId),
  ]);

  if (financeResponse.error) throw financeResponse.error;
  if (documentResponse.error) throw documentResponse.error;

  const financeRows = (financeResponse.data ?? []) as Array<{
    due_date: string | null;
    invoice_date: string | null;
    amount: number;
    status: OsgbFinanceRecord["status"];
  }>;
  const documentRows = (documentResponse.data ?? []) as Array<{
    expiry_date: string | null;
    created_at: string;
    status: OsgbDocumentRecord["status"];
  }>;

  const now = new Date();
  const nextWindow = new Date();
  nextWindow.setDate(nextWindow.getDate() + 60);

  const calendarItemCount = financeRows.filter((record) => {
    if (!record.due_date) return false;
    const dueDate = new Date(record.due_date);
    if (Number.isNaN(dueDate.getTime())) return false;
    return record.status === "overdue" || (dueDate >= now && dueDate <= nextWindow);
  }).length;

  return {
    finance: {
      pendingAmount: financeRows.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amount, 0),
      overdueCount: financeRows.filter((item) => item.status === "overdue").length,
      overdueAmount: financeRows.filter((item) => item.status === "overdue").reduce((sum, item) => sum + item.amount, 0),
      calendarItemCount: Math.min(calendarItemCount, 12),
      monthlyTrendMonths: 6,
    },
    documents: {
      warningCount: documentRows.filter((item) => item.status === "warning").length,
      expiredCount: documentRows.filter((item) => item.status === "expired").length,
      monthlyTrendMonths: 6,
    },
  };
};

export const getOsgbCompanyTracking = async (userId: string): Promise<OsgbCompanyTrackingRecord[]> => {
  const [companies, assignments, documents, finance, tasks, notes] = await Promise.all([
    supabase
      .from("isgkatip_companies")
      .select("id, company_name, hazard_class, employee_count, contract_end, required_minutes, assigned_minutes")
      .eq("org_id", userId)
      .eq("is_deleted", false)
      .order("company_name", { ascending: true }),
    listOsgbAssignments(userId),
    listOsgbDocuments(userId),
    listOsgbFinance(userId),
    listOsgbTasks(userId),
    listOsgbNotes(userId),
  ]);

  if (companies.error) throw companies.error;

  return (companies.data ?? []).map((company: any) => {
    const activeAssignment = assignments.find(
      (assignment) => assignment.company_id === company.id && assignment.status === "active",
    );
    const companyDocuments = documents.filter((document) => document.company_id === company.id);
    const companyFinance = finance.filter((item) => item.company_id === company.id);
    const companyTasks = tasks.filter(
      (task) => task.company_id === company.id && task.status !== "completed" && task.status !== "cancelled",
    );
    const companyNotes = notes.filter((note) => note.company_id === company.id);

    const assignmentStatus: OsgbCompanyTrackingRecord["assignmentStatus"] = !activeAssignment
      ? "atanmamis"
      : (activeAssignment.assigned_minutes || 0) < (company.required_minutes || 0)
        ? "eksik"
        : "atandi";

    return {
      companyId: company.id,
      companyName: company.company_name,
      hazardClass: company.hazard_class || "Bilinmiyor",
      employeeCount: company.employee_count || 0,
      contractEnd: company.contract_end || null,
      requiredMinutes: company.required_minutes || 0,
      assignedMinutes: activeAssignment?.assigned_minutes || 0,
      assignmentStatus,
      activeAssignment: activeAssignment
        ? {
            assignmentId: activeAssignment.id,
            personnelName: activeAssignment.personnel?.full_name || "Atanan personel",
            role: activeAssignment.assigned_role,
            assignedMinutes: activeAssignment.assigned_minutes,
            startDate: activeAssignment.start_date,
            endDate: activeAssignment.end_date,
          }
        : null,
      documentSummary: {
        active: companyDocuments.filter((document) => document.status === "active").length,
        warning: companyDocuments.filter((document) => document.status === "warning").length,
        expired: companyDocuments.filter((document) => document.status === "expired").length,
      },
      financeSummary: {
        pendingAmount: companyFinance
          .filter((item) => item.status === "pending")
          .reduce((sum, item) => sum + item.amount, 0),
        overdueAmount: companyFinance
          .filter((item) => item.status === "overdue")
          .reduce((sum, item) => sum + item.amount, 0),
      },
      openTaskCount: companyTasks.length,
      noteCount: companyNotes.length,
    } satisfies OsgbCompanyTrackingRecord;
  });
};

export const getOsgbCompanyTrackingPage = async (
  orgId: string,
  params: { page: number; pageSize: number; status?: string; search?: string },
): Promise<PagedResult<OsgbCompanyTrackingRecord>> => {
  const { data, error } = await (supabase as any).rpc("get_osgb_company_tracking_page", {
    p_org_id: orgId,
    p_page: params.page,
    p_page_size: params.pageSize,
    p_search: params.search?.trim() || null,
    p_assignment_status: params.status && params.status !== "ALL" ? params.status : null,
  });

  if (error) throw error;

  const rows = (data ?? []) as Array<OsgbCompanyTrackingRecord & { total_count?: number }>;
  return {
    rows: rows.map(({ total_count, ...row }) => row),
    count: rows[0]?.total_count ?? 0,
  };
};

export const listOsgbTasks = async (userId: string): Promise<OsgbTaskRecord[]> => {
  const { data, error } = await supabase
    .from("osgb_tasks")
    .select("*, company:isgkatip_companies(company_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OsgbTaskRecord[];
};

export const listOsgbTasksPage = async (
  userId: string,
  params: OsgbTaskPageParams,
): Promise<PagedResult<OsgbTaskRecord>> => {
  const { page, pageSize, status, search } = params;
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;
  let query = (supabase as any)
    .from("osgb_tasks")
    .select("*, company:isgkatip_companies(company_name)", { count: "exact" })
    .eq("user_id", userId);

  if (status && status !== "ALL") {
    query = query.eq("status", status);
  }
  if (search?.trim()) {
    const term = search.trim();
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%,assigned_to.ilike.%${term}%`);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  return {
    rows: (data ?? []) as OsgbTaskRecord[],
    count: count ?? 0,
  };
};

export const listOsgbBatchLogs = async (userId: string): Promise<OsgbBatchLogRecord[]> => {
  const { data, error } = await supabase
    .from("osgb_batch_logs")
    .select("*")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return (data ?? []) as OsgbBatchLogRecord[];
};

export const getAssignmentRecommendation = (
  company: OsgbCompanyOption | null | undefined,
  role: OsgbAssignmentRecord["assigned_role"],
  currentAssignedMinutes = 0,
): OsgbAssignmentRecommendation | null => {
  if (!company) return null;

  const hazardKey = normalizeHazardClass(company.hazardClass) as "az_tehlikeli" | "tehlikeli" | "cok_tehlikeli";
  const perEmployeeMinutes = assignmentRecommendationMatrix[role][hazardKey];
  const employeeCount = company.employeeCount || 0;
  const recommendedMinutes = perEmployeeMinutes * employeeCount;
  const remainingGapMinutes = Math.max(0, recommendedMinutes - currentAssignedMinutes);
  const projectedCoverageRatio = recommendedMinutes > 0
    ? Math.min(100, Math.round((currentAssignedMinutes / recommendedMinutes) * 100))
    : 100;

  const roleName =
    role === "igu"
      ? "İSG uzmanı"
      : role === "hekim"
        ? "işyeri hekimi"
        : "DSP";

  return {
    role,
    hazardClass: company.hazardClass,
    employeeCount,
    perEmployeeMinutes,
    recommendedMinutes,
    currentAssignedMinutes,
    projectedCoverageRatio,
    remainingGapMinutes,
    legalReference: assignmentLegalReference[role],
    summary:
      recommendedMinutes > 0
        ? `${company.companyName} için ${employeeCount} çalışan ve ${company.hazardClass} sınıfına göre ${roleName} önerisi ${recommendedMinutes} dk/ay.`
        : `${company.companyName} için seçili rol bazında zorunlu süre önerisi tanımlı değil.`,
  };
};

export const createOsgbTask = async (userId: string, input: OsgbTaskInput) => {
  const payload = {
    user_id: userId,
    company_id: input.companyId || null,
    related_document_id: input.relatedDocumentId || null,
    related_finance_id: input.relatedFinanceId || null,
    title: input.title,
    description: input.description || null,
    priority: input.priority || "medium",
    status: input.status || "open",
    assigned_to: input.assignedTo || null,
    due_date: input.dueDate || null,
    source: input.source || "manual",
  };

  const { data, error } = await supabase
    .from("osgb_tasks")
    .insert(payload)
    .select("*, company:isgkatip_companies(company_name)")
    .single();

  if (error) throw error;
  return data as OsgbTaskRecord;
};

export const createUpcomingDocumentTasks = async (userId: string, documents: OsgbDocumentRecord[]) => {
  const actionableDocuments = documents.length > 0
    ? documents.filter((record) => record.status === "warning" || record.status === "expired")
    : await listActionableOsgbDocuments(userId);
  if (actionableDocuments.length === 0) {
    return { created: 0, skipped: 0 };
  }

  const existingTasks = await listOsgbTasks(userId);
  let created = 0;
  let skipped = 0;

  for (const record of actionableDocuments) {
    const title = `Evrak yenileme: ${record.document_name}`;
    const duplicate = existingTasks.some(
      (task) =>
        task.source === "document_tracking" &&
        task.company_id === record.company_id &&
        task.title === title &&
        task.status !== "cancelled",
    );

    if (duplicate) {
      skipped += 1;
      continue;
    }

    await createOsgbTask(userId, {
      companyId: record.company_id,
      relatedDocumentId: record.id,
      title,
      description: `${record.company?.company_name || "Firma"} için ${record.document_type} belgesi takip edilmeli. Son geçerlilik: ${record.expiry_date || "-"}.`,
      priority: record.status === "expired" ? "critical" : "high",
      dueDate: record.expiry_date,
      source: "document_tracking",
    });
    created += 1;
  }

  return { created, skipped };
};

export const createExpiringPersonnelCertificateTasks = async (
  userId: string,
  personnelRecords: OsgbPersonnelRecord[],
) => {
  const now = Date.now();
  const horizon = now + 1000 * 60 * 60 * 24 * 45;
  const actionablePersonnel = personnelRecords.filter((record) => {
    if (!record.is_active || !record.certificate_expiry_date) return false;
    const expiry = new Date(record.certificate_expiry_date).getTime();
    if (Number.isNaN(expiry)) return false;
    return expiry <= horizon;
  });

  if (actionablePersonnel.length === 0) {
    return { created: 0, skipped: 0 };
  }

  const existingTasks = await listOsgbTasks(userId);
  let created = 0;
  let skipped = 0;

  for (const person of actionablePersonnel) {
    const title = `Belge yenileme: ${person.full_name}`;
    const duplicate = existingTasks.some(
      (task) =>
        task.source === "personnel_certificate" &&
        task.title === title &&
        task.status !== "cancelled" &&
        task.status !== "completed",
    );

    if (duplicate) {
      skipped += 1;
      continue;
    }

    await createOsgbTask(userId, {
      title,
      description: `${person.full_name} için ${roleLabelsForTasks(person.role)} belgesinin geçerlilik tarihi ${person.certificate_expiry_date}. Yenileme süreci başlatılmalı.`,
      priority: new Date(person.certificate_expiry_date).getTime() < now ? "critical" : "high",
      dueDate: person.certificate_expiry_date,
      assignedTo: person.full_name,
      source: "personnel_certificate",
    });
    created += 1;
  }

  return { created, skipped };
};

const roleLabelsForTasks = (role: OsgbPersonnelRecord["role"]) => {
  if (role === "igu") return "İGU";
  if (role === "hekim") return "İşyeri Hekimi";
  return "DSP";
};

export const updateOsgbTaskStatus = async (id: string, status: OsgbTaskRecord["status"]) => {
  const { data, error } = await supabase
    .from("osgb_tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, company:isgkatip_companies(company_name)")
    .single();

  if (error) throw error;
  return data as OsgbTaskRecord;
};

export const deleteOsgbTask = async (id: string) => {
  const { error } = await supabase.from("osgb_tasks").delete().eq("id", id);
  if (error) throw error;
};

export const listOsgbNotes = async (userId: string): Promise<OsgbNoteRecord[]> => {
  const { data, error } = await supabase
    .from("osgb_notes")
    .select("*, company:isgkatip_companies(company_name)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OsgbNoteRecord[];
};

export const upsertOsgbNote = async (userId: string, input: OsgbNoteInput, id?: string) => {
  const payload = {
    user_id: userId,
    company_id: input.companyId || null,
    title: input.title || null,
    note: input.note,
    note_type: input.noteType || "general",
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data, error } = await supabase
      .from("osgb_notes")
      .update(payload)
      .eq("id", id)
      .select("*, company:isgkatip_companies(company_name)")
      .single();
    if (error) throw error;
    return data as OsgbNoteRecord;
  }

  const { data, error } = await supabase
    .from("osgb_notes")
    .insert(payload)
    .select("*, company:isgkatip_companies(company_name)")
    .single();
  if (error) throw error;
  return data as OsgbNoteRecord;
};

export const deleteOsgbNote = async (id: string) => {
  const { error } = await supabase.from("osgb_notes").delete().eq("id", id);
  if (error) throw error;
};
