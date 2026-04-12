import { supabase } from "@/integrations/supabase/client";
import { createOsgbTask, getOsgbCompanyOptions, type OsgbCompanyOption } from "@/lib/osgbOperations";

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
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => PromiseLike<{ data: unknown[] | null; error: Error | null }> & QueryBuilder;
  select: (...args: unknown[]) => QueryBuilder;
  single: () => Promise<{ data: unknown; error: Error | null }>;
};

type MutationBuilder = {
  eq: (column: string, value: unknown) => MutationBuilder;
  select: (...args: unknown[]) => MutationBuilder;
  single: () => Promise<{ data: unknown; error: Error | null }>;
};

const db = supabase as LooseClient;

export type PeriodicControlStatus =
  | "scheduled"
  | "warning"
  | "overdue"
  | "completed"
  | "inactive";

export type PeriodicControlResult =
  | "suitable"
  | "conditional"
  | "unsuitable"
  | "not_evaluated";

interface PeriodicControlCompanyRelation {
  company_name: string | null;
}

interface PeriodicControlRow {
  id: string;
  user_id: string;
  company_id: string | null;
  equipment_name: string;
  control_category: string;
  location: string | null;
  responsible_vendor: string | null;
  standard_reference: string | null;
  last_control_date: string | null;
  next_control_date: string;
  status: PeriodicControlStatus;
  result_status: PeriodicControlResult;
  notes: string | null;
  created_at: string;
  updated_at: string;
  company?: PeriodicControlCompanyRelation | PeriodicControlCompanyRelation[] | null;
}

interface PeriodicControlReportRow {
  id: string;
  control_id: string;
  user_id: string;
  report_date: string;
  report_summary: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

interface OsgbTaskLookupRow {
  id: string;
  company_id: string | null;
  title: string;
  source: string;
  status: "open" | "in_progress" | "completed" | "cancelled";
}

export interface PeriodicControlRecord {
  id: string;
  user_id: string;
  company_id: string | null;
  equipment_name: string;
  control_category: string;
  location: string | null;
  responsible_vendor: string | null;
  standard_reference: string | null;
  last_control_date: string | null;
  next_control_date: string;
  status: PeriodicControlStatus;
  result_status: PeriodicControlResult;
  notes: string | null;
  created_at: string;
  updated_at: string;
  company: PeriodicControlCompanyRelation | null;
}

export interface PeriodicControlReportRecord {
  id: string;
  control_id: string;
  user_id: string;
  report_date: string;
  report_summary: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface PeriodicControlInput {
  companyId?: string | null;
  equipmentName: string;
  controlCategory: string;
  location?: string | null;
  responsibleVendor?: string | null;
  standardReference?: string | null;
  lastControlDate?: string | null;
  nextControlDate: string;
  status: PeriodicControlStatus;
  resultStatus: PeriodicControlResult;
  notes?: string | null;
}

export interface PeriodicControlTaskResult {
  created: number;
  skipped: number;
}

export interface PagedResult<T> {
  rows: T[];
  count: number;
}

export interface PeriodicControlsPageParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: PeriodicControlStatus | "ALL";
  companyId?: string;
}

export interface PeriodicControlReportPageParams {
  page: number;
  pageSize: number;
}

const ensureControlRow = (row: unknown) => row as PeriodicControlRow;
const ensureReportRow = (row: unknown) => row as PeriodicControlReportRow;
const ensureTaskRow = (row: unknown) => row as OsgbTaskLookupRow;

const normalizeCompany = (
  company: PeriodicControlRow["company"],
): PeriodicControlCompanyRelation | null => {
  if (!company) return null;
  return Array.isArray(company) ? company[0] ?? null : company;
};

const mapControl = (row: PeriodicControlRow): PeriodicControlRecord => ({
  id: row.id,
  user_id: row.user_id,
  company_id: row.company_id,
  equipment_name: row.equipment_name,
  control_category: row.control_category,
  location: row.location,
  responsible_vendor: row.responsible_vendor,
  standard_reference: row.standard_reference,
  last_control_date: row.last_control_date,
  next_control_date: row.next_control_date,
  status: row.status,
  result_status: row.result_status,
  notes: row.notes,
  created_at: row.created_at,
  updated_at: row.updated_at,
  company: normalizeCompany(row.company),
});

const mapReport = (row: PeriodicControlReportRow): PeriodicControlReportRecord => ({
  id: row.id,
  control_id: row.control_id,
  user_id: row.user_id,
  report_date: row.report_date,
  report_summary: row.report_summary,
  file_name: row.file_name,
  file_path: row.file_path,
  file_size: row.file_size == null ? null : Number(row.file_size),
  mime_type: row.mime_type,
  created_at: row.created_at,
});

export const getPeriodicControlCompanyOptions = async (
  userId: string,
): Promise<OsgbCompanyOption[]> => getOsgbCompanyOptions(userId);

export const listPeriodicControls = async (
  userId: string,
): Promise<PeriodicControlRecord[]> => {
  const { data, error } = await db
    .from("periodic_controls")
    .select("*, company:isgkatip_companies(company_name)")
    .eq("user_id", userId)
    .order("next_control_date", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapControl(ensureControlRow(row)));
};

export const listPeriodicControlsPage = async (
  userId: string,
  params: PeriodicControlsPageParams,
): Promise<PagedResult<PeriodicControlRecord>> => {
  const { page, pageSize, search, status, companyId } = params;
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;
  let query = (supabase as any)
    .from("periodic_controls")
    .select("*, company:isgkatip_companies(company_name)", { count: "exact" })
    .eq("user_id", userId);

  if (status && status !== "ALL") {
    query = query.eq("status", status);
  }
  if (companyId && companyId !== "ALL") {
    query = query.eq("company_id", companyId);
  }
  if (search?.trim()) {
    const term = search.trim();
    query = query.or(`equipment_name.ilike.%${term}%,control_category.ilike.%${term}%,location.ilike.%${term}%`);
  }

  const { data, error, count } = await query
    .order("next_control_date", { ascending: true })
    .range(from, to);

  if (error) throw error;
  return {
    rows: (data ?? []).map((row: unknown) => mapControl(ensureControlRow(row))),
    count: count ?? 0,
  };
};

export const upsertPeriodicControl = async (
  userId: string,
  input: PeriodicControlInput,
  controlId?: string,
): Promise<PeriodicControlRecord> => {
  const payload = {
    user_id: userId,
    company_id: input.companyId || null,
    equipment_name: input.equipmentName.trim(),
    control_category: input.controlCategory.trim(),
    location: input.location?.trim() || null,
    responsible_vendor: input.responsibleVendor?.trim() || null,
    standard_reference: input.standardReference?.trim() || null,
    last_control_date: input.lastControlDate || null,
    next_control_date: input.nextControlDate,
    status: input.status,
    result_status: input.resultStatus,
    notes: input.notes?.trim() || null,
  };

  const query = controlId
    ? db.from("periodic_controls").update(payload).eq("id", controlId)
    : db.from("periodic_controls").insert(payload);

  const { data, error } = await query
    .select("*, company:isgkatip_companies(company_name)")
    .single();

  if (error) throw error;
  return mapControl(ensureControlRow(data));
};

export const deletePeriodicControl = async (id: string): Promise<void> => {
  const { error } = await db.from("periodic_controls").delete().eq("id", id);
  if (error) throw error;
};

export const listPeriodicControlReports = async (
  controlId: string,
): Promise<PeriodicControlReportRecord[]> => {
  const { data, error } = await db
    .from("periodic_control_reports")
    .select("*")
    .eq("control_id", controlId)
    .order("report_date", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapReport(ensureReportRow(row)));
};

export const listPeriodicControlReportHistory = async (
  userId: string,
): Promise<PeriodicControlReportRecord[]> => {
  const { data, error } = await db
    .from("periodic_control_reports")
    .select("*")
    .eq("user_id", userId)
    .order("report_date", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapReport(ensureReportRow(row)));
};

export const listPeriodicControlReportHistoryPage = async (
  userId: string,
  params: PeriodicControlReportPageParams,
): Promise<PagedResult<PeriodicControlReportRecord>> => {
  const { page, pageSize } = params;
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;
  const { data, error, count } = await (supabase as any)
    .from("periodic_control_reports")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("report_date", { ascending: false })
    .range(from, to);

  if (error) throw error;
  return {
    rows: (data ?? []).map((row: unknown) => mapReport(ensureReportRow(row))),
    count: count ?? 0,
  };
};

export const uploadPeriodicControlReport = async (
  userId: string,
  controlId: string,
  file: File,
  reportDate: string,
  reportSummary?: string | null,
): Promise<PeriodicControlReportRecord> => {
  const safeFileName = `${userId}/${controlId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const { error: uploadError } = await supabase.storage
    .from("periodic-control-files")
    .upload(safeFileName, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data, error } = await db
    .from("periodic_control_reports")
    .insert({
      user_id: userId,
      control_id: controlId,
      report_date: reportDate,
      report_summary: reportSummary?.trim() || null,
      file_name: file.name,
      file_path: safeFileName,
      file_size: file.size,
      mime_type: file.type || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapReport(ensureReportRow(data));
};

export const getPeriodicControlReportDownloadUrl = async (
  filePath: string,
): Promise<string> => {
  const { data, error } = await supabase.storage
    .from("periodic-control-files")
    .createSignedUrl(filePath, 3600);

  if (error) throw error;
  return data.signedUrl;
};

export const deletePeriodicControlReport = async (
  report: PeriodicControlReportRecord,
): Promise<void> => {
  const { error } = await db
    .from("periodic_control_reports")
    .delete()
    .eq("id", report.id);

  if (error) throw error;
  await supabase.storage.from("periodic-control-files").remove([report.file_path]);
};

export const createPeriodicControlTasks = async (
  userId: string,
  controls: PeriodicControlRecord[],
): Promise<PeriodicControlTaskResult> => {
  const now = Date.now();
  const horizon = now + 1000 * 60 * 60 * 24 * 30;

  const actionable = controls.filter((control) => {
    if (control.status === "inactive" || control.status === "completed") return false;
    const dueTime = new Date(control.next_control_date).getTime();
    if (Number.isNaN(dueTime)) return false;
    return dueTime <= horizon;
  });

  if (actionable.length === 0) {
    return { created: 0, skipped: 0 };
  }

  const { data, error } = await db
    .from("osgb_tasks")
    .select("id, company_id, title, source, status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const existingTasks = (data ?? []).map((row) => ensureTaskRow(row));
  let created = 0;
  let skipped = 0;

  for (const control of actionable) {
    const title = `Periyodik kontrol: ${control.equipment_name}`;
    const duplicate = existingTasks.some(
      (task) =>
        task.source === "periodic_control" &&
        task.title === title &&
        task.company_id === (control.company_id || null) &&
        task.status !== "cancelled" &&
        task.status !== "completed",
    );

    if (duplicate) {
      skipped += 1;
      continue;
    }

    const dueTime = new Date(control.next_control_date).getTime();
    const priority =
      dueTime < now || control.status === "overdue"
        ? "critical"
        : control.status === "warning"
          ? "high"
          : "medium";

    await createOsgbTask(userId, {
      companyId: control.company_id,
      title,
      description: `${control.equipment_name} için ${control.control_category} kontrolü ${control.next_control_date} tarihinde planlanmış. Lokasyon: ${control.location || "belirtilmedi"}. Kontrol kuruluşu: ${control.responsible_vendor || "atanmadı"}.`,
      dueDate: control.next_control_date,
      priority,
      source: "periodic_control",
    });

    existingTasks.unshift({
      id: control.id,
      company_id: control.company_id,
      title,
      source: "periodic_control",
      status: "open",
    });

    created += 1;
  }

  return { created, skipped };
};
