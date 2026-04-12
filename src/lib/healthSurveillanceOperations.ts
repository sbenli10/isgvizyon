import { createOsgbTask } from "@/lib/osgbOperations";
import { supabase } from "@/integrations/supabase/client";

type LooseClient = typeof supabase & {
  from: (table: string) => {
    select: (...args: unknown[]) => QueryBuilder;
    insert: (value: unknown) => MutationBuilder;
    update: (value: unknown) => MutationBuilder;
    delete: () => MutationBuilder;
  };
};

type QueryBuilder = {
  eq: (column: string, value: unknown) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => PromiseLike<{ data: unknown[] | null; error: Error | null }> & QueryBuilder;
  select: (...args: unknown[]) => QueryBuilder;
  single: () => Promise<{ data: unknown; error: Error | null }>;
};

type MutationBuilder = {
  eq: (column: string, value: unknown) => MutationBuilder;
  select: (...args: unknown[]) => MutationBuilder;
  single: () => Promise<{ data: unknown; error: Error | null }>;
};

const db = supabase as LooseClient;

export type HealthExamType = "pre_employment" | "periodic" | "return_to_work" | "special";
export type HealthResultStatus = "fit" | "conditional_fit" | "unfit" | "pending";
export type HealthWorkflowStatus = "active" | "warning" | "overdue" | "completed" | "archived";

interface EmployeeRelation {
  first_name: string | null;
  last_name: string | null;
}

interface CompanyRelation {
  name: string | null;
}

interface HealthRow {
  id: string;
  user_id: string;
  employee_id: string;
  company_id: string | null;
  exam_type: HealthExamType;
  exam_date: string;
  next_exam_date: string | null;
  physician_name: string | null;
  result_status: HealthResultStatus;
  restrictions: string | null;
  summary: string | null;
  notes: string | null;
  status: HealthWorkflowStatus;
  created_at: string;
  updated_at: string;
  employee?: EmployeeRelation | EmployeeRelation[] | null;
  company?: CompanyRelation | CompanyRelation[] | null;
}

interface HealthFileRow {
  id: string;
  record_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  report_date: string;
  file_summary: string | null;
  created_at: string;
}

interface EmployeeRow {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  job_title: string;
  department: string | null;
  is_active: boolean | null;
}

interface CompanyRow {
  id: string;
  name: string;
}

interface TaskLookupRow {
  id: string;
  company_id: string | null;
  title: string;
  source: string;
  status: "open" | "in_progress" | "completed" | "cancelled";
}

export interface HealthSurveillanceRecord {
  id: string;
  user_id: string;
  employee_id: string;
  company_id: string | null;
  exam_type: HealthExamType;
  exam_date: string;
  next_exam_date: string | null;
  physician_name: string | null;
  result_status: HealthResultStatus;
  restrictions: string | null;
  summary: string | null;
  notes: string | null;
  status: HealthWorkflowStatus;
  created_at: string;
  updated_at: string;
  employee: { first_name: string | null; last_name: string | null } | null;
  company: { name: string | null } | null;
}

export interface HealthSurveillanceFileRecord {
  id: string;
  record_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  report_date: string;
  file_summary: string | null;
  created_at: string;
}

export interface HealthSurveillanceInput {
  employeeId: string;
  companyId?: string | null;
  examType: HealthExamType;
  examDate: string;
  nextExamDate?: string | null;
  physicianName?: string | null;
  resultStatus: HealthResultStatus;
  restrictions?: string | null;
  summary?: string | null;
  notes?: string | null;
  status: HealthWorkflowStatus;
}

export interface HealthEmployeeOption {
  id: string;
  fullName: string;
  companyId: string;
  companyName: string | null;
  jobTitle: string;
  department: string | null;
  isActive: boolean;
}

export interface HealthTaskResult {
  created: number;
  skipped: number;
}

export interface PagedResult<T> {
  rows: T[];
  count: number;
}

export interface HealthRecordsPageParams {
  page: number;
  pageSize: number;
  status?: HealthWorkflowStatus | "ALL";
  employeeId?: string;
  search?: string;
}

const ensureHealthRow = (row: unknown) => row as HealthRow;
const ensureHealthFileRow = (row: unknown) => row as HealthFileRow;
const ensureEmployeeRow = (row: unknown) => row as EmployeeRow;
const ensureCompanyRow = (row: unknown) => row as CompanyRow;
const ensureTaskRow = (row: unknown) => row as TaskLookupRow;

const relationOne = <T,>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const mapRecord = (row: HealthRow): HealthSurveillanceRecord => ({
  ...row,
  employee: relationOne(row.employee),
  company: relationOne(row.company),
});

const mapFile = (row: HealthFileRow): HealthSurveillanceFileRecord => ({
  ...row,
  file_size: row.file_size == null ? null : Number(row.file_size),
});

export const listHealthSurveillanceRecords = async (userId: string): Promise<HealthSurveillanceRecord[]> => {
  const { data, error } = await db
    .from("health_surveillance_records")
    .select("*, employee:employees(first_name,last_name), company:companies(name)")
    .eq("user_id", userId)
    .order("next_exam_date", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapRecord(ensureHealthRow(row)));
};

export const listHealthSurveillanceRecordsPage = async (
  userId: string,
  params: HealthRecordsPageParams,
): Promise<PagedResult<HealthSurveillanceRecord>> => {
  const { page, pageSize, status, employeeId, search } = params;
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;
  let query = (supabase as any)
    .from("health_surveillance_records")
    .select("*, employee:employees(first_name,last_name), company:companies(name)", { count: "exact" })
    .eq("user_id", userId);

  if (status && status !== "ALL") {
    query = query.eq("status", status);
  }
  if (employeeId && employeeId !== "ALL") {
    query = query.eq("employee_id", employeeId);
  }
  if (search?.trim()) {
    const term = search.trim();
    query = query.or(`physician_name.ilike.%${term}%,summary.ilike.%${term}%,notes.ilike.%${term}%`);
  }

  const { data, error, count } = await query
    .order("next_exam_date", { ascending: true })
    .range(from, to);

  if (error) throw error;
  return {
    rows: (data ?? []).map((row: unknown) => mapRecord(ensureHealthRow(row))),
    count: count ?? 0,
  };
};

export const upsertHealthSurveillanceRecord = async (
  userId: string,
  input: HealthSurveillanceInput,
  recordId?: string,
): Promise<HealthSurveillanceRecord> => {
  const payload = {
    user_id: userId,
    employee_id: input.employeeId,
    company_id: input.companyId || null,
    exam_type: input.examType,
    exam_date: input.examDate,
    next_exam_date: input.nextExamDate || null,
    physician_name: input.physicianName?.trim() || null,
    result_status: input.resultStatus,
    restrictions: input.restrictions?.trim() || null,
    summary: input.summary?.trim() || null,
    notes: input.notes?.trim() || null,
    status: input.status,
  };

  const query = recordId
    ? db.from("health_surveillance_records").update(payload).eq("id", recordId)
    : db.from("health_surveillance_records").insert(payload);

  const { data, error } = await query.select("*, employee:employees(first_name,last_name), company:companies(name)").single();
  if (error) throw error;
  return mapRecord(ensureHealthRow(data));
};

export const deleteHealthSurveillanceRecord = async (id: string) => {
  const { error } = await db.from("health_surveillance_records").delete().eq("id", id);
  if (error) throw error;
};

export const listHealthSurveillanceFiles = async (recordId: string): Promise<HealthSurveillanceFileRecord[]> => {
  const { data, error } = await db
    .from("health_surveillance_files")
    .select("*")
    .eq("record_id", recordId)
    .order("report_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapFile(ensureHealthFileRow(row)));
};

export const uploadHealthSurveillanceFile = async (
  userId: string,
  recordId: string,
  file: File,
  reportDate: string,
  fileSummary?: string | null,
): Promise<HealthSurveillanceFileRecord> => {
  const safeFileName = `${userId}/${recordId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const { error: uploadError } = await supabase.storage.from("health-surveillance-files").upload(safeFileName, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data, error } = await db
    .from("health_surveillance_files")
    .insert({
      user_id: userId,
      record_id: recordId,
      file_name: file.name,
      file_path: safeFileName,
      file_size: file.size,
      mime_type: file.type || null,
      report_date: reportDate,
      file_summary: fileSummary?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapFile(ensureHealthFileRow(data));
};

export const getHealthSurveillanceFileDownloadUrl = async (filePath: string): Promise<string> => {
  const { data, error } = await supabase.storage.from("health-surveillance-files").createSignedUrl(filePath, 3600);
  if (error) throw error;
  return data.signedUrl;
};

export const deleteHealthSurveillanceFile = async (file: HealthSurveillanceFileRecord) => {
  const { error } = await db.from("health_surveillance_files").delete().eq("id", file.id);
  if (error) throw error;
  await supabase.storage.from("health-surveillance-files").remove([file.file_path]);
};

export const listHealthEmployeeOptions = async (): Promise<HealthEmployeeOption[]> => {
  const [{ data: employeeData, error: employeeError }, { data: companyData, error: companyError }] = await Promise.all([
    db.from("employees").select("id, company_id, first_name, last_name, job_title, department, is_active").order("first_name", { ascending: true }),
    db.from("companies").select("id, name").order("name", { ascending: true }),
  ]);
  if (employeeError) throw employeeError;
  if (companyError) throw companyError;

  const companyMap = new Map((companyData ?? []).map((row) => {
    const company = ensureCompanyRow(row);
    return [company.id, company.name];
  }));

  return (employeeData ?? []).map((row) => {
    const employee = ensureEmployeeRow(row);
    return {
      id: employee.id,
      fullName: `${employee.first_name} ${employee.last_name}`.trim(),
      companyId: employee.company_id,
      companyName: companyMap.get(employee.company_id) ?? null,
      jobTitle: employee.job_title,
      department: employee.department,
      isActive: Boolean(employee.is_active ?? true),
    };
  });
};

export const createHealthSurveillanceTasks = async (
  userId: string,
  records: HealthSurveillanceRecord[],
  employees: HealthEmployeeOption[],
): Promise<HealthTaskResult> => {
  const now = Date.now();
  const horizon = now + 1000 * 60 * 60 * 24 * 30;
  const employeeMap = new Map(employees.map((item) => [item.id, item]));
  const actionable = records.filter((record) => {
    if (!record.next_exam_date) return false;
    if (record.status === "archived" || record.status === "completed") return false;
    const dueTime = new Date(record.next_exam_date).getTime();
    if (Number.isNaN(dueTime)) return false;
    return dueTime <= horizon;
  });
  if (actionable.length === 0) return { created: 0, skipped: 0 };

  const { data, error } = await db.from("osgb_tasks").select("id, company_id, title, source, status").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  const existing = (data ?? []).map((row) => ensureTaskRow(row));

  let created = 0;
  let skipped = 0;

  for (const record of actionable) {
    const employee = employeeMap.get(record.employee_id);
    const employeeName = employee?.fullName || "Calisan";
    const title = `Saglik gozetimi: ${employeeName}`;
    const duplicate = existing.some((task) => task.source === "health_surveillance" && task.title === title && task.company_id === (record.company_id || null) && task.status !== "cancelled" && task.status !== "completed");
    if (duplicate) {
      skipped += 1;
      continue;
    }

    const dueTime = new Date(record.next_exam_date as string).getTime();
    const priority = dueTime < now || record.status === "overdue" ? "critical" : "high";
    await createOsgbTask(userId, {
      companyId: record.company_id,
      title,
      description: `${employeeName} icin ${record.exam_type} muayenesi takip edilmeli. Sonraki muayene tarihi: ${record.next_exam_date}. Sonuc durumu: ${record.result_status}.`,
      dueDate: record.next_exam_date,
      priority,
      source: "health_surveillance",
    });

    existing.unshift({ id: record.id, company_id: record.company_id, title, source: "health_surveillance", status: "open" });
    created += 1;
  }

  return { created, skipped };
};
