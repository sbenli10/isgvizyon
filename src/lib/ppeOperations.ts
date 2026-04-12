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
  in?: (column: string, values: unknown[]) => QueryBuilder;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => PromiseLike<{ data: unknown[] | null; error: Error | null }> & QueryBuilder;
  select: (...args: unknown[]) => QueryBuilder;
  maybeSingle: () => Promise<{ data: unknown; error: Error | null }>;
  single: () => Promise<{ data: unknown; error: Error | null }>;
};

type MutationBuilder = {
  eq: (column: string, value: unknown) => MutationBuilder;
  select: (...args: unknown[]) => MutationBuilder;
  single: () => Promise<{ data: unknown; error: Error | null }>;
};

const db = supabase as LooseClient;

export type PpeAssignmentStatus = "assigned" | "replacement_due" | "returned";

interface PpeInventoryRow {
  id: string;
  user_id: string;
  item_name: string;
  category: string;
  standard_code: string | null;
  default_renewal_days: number;
  stock_quantity: number;
  min_stock_level: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface PpeAssignmentRow {
  id: string;
  user_id: string;
  inventory_id: string;
  employee_id: string;
  company_id: string | null;
  assigned_date: string;
  due_date: string;
  return_date: string | null;
  status: PpeAssignmentStatus;
  quantity: number;
  size_label: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
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

interface OsgbTaskLookupRow {
  id: string;
  company_id: string | null;
  title: string;
  source: string;
  status: "open" | "in_progress" | "completed" | "cancelled";
}

export interface PpeInventoryRecord {
  id: string;
  user_id: string;
  item_name: string;
  category: string;
  standard_code: string | null;
  default_renewal_days: number;
  stock_quantity: number;
  min_stock_level: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PpeAssignmentRecord {
  id: string;
  user_id: string;
  inventory_id: string;
  employee_id: string;
  company_id: string | null;
  assigned_date: string;
  due_date: string;
  return_date: string | null;
  status: PpeAssignmentStatus;
  quantity: number;
  size_label: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PpeEmployeeOption {
  id: string;
  fullName: string;
  companyId: string;
  companyName: string | null;
  department: string | null;
  jobTitle: string;
  isActive: boolean;
}

export interface PpeInventoryOption {
  id: string;
  itemName: string;
  isActive: boolean;
  defaultRenewalDays: number;
}

export interface PpeInventoryInput {
  itemName: string;
  category: string;
  standardCode?: string | null;
  defaultRenewalDays: number;
  stockQuantity: number;
  minStockLevel: number;
  isActive: boolean;
  notes?: string | null;
}

export interface PpeAssignmentInput {
  inventoryId: string;
  employeeId: string;
  companyId?: string | null;
  assignedDate: string;
  dueDate: string;
  status: PpeAssignmentStatus;
  quantity: number;
  sizeLabel?: string | null;
  notes?: string | null;
  returnDate?: string | null;
}

export interface PpeEmployeeOverview {
  employeeId: string;
  employeeName: string;
  companyName: string | null;
  department: string | null;
  activeAssignments: number;
  overdueCount: number;
  renewalDueCount: number;
  items: Array<{
    assignmentId: string;
    itemName: string;
    dueDate: string;
    status: PpeAssignmentStatus;
    quantity: number;
  }>;
}

export interface PpeRenewalTaskResult {
  created: number;
  skipped: number;
}

export interface PagedResult<T> {
  rows: T[];
  count: number;
}

export interface PpeInventoryPageParams {
  page: number;
  pageSize: number;
  search?: string;
}

export interface PpeAssignmentPageParams {
  page: number;
  pageSize: number;
  employeeId?: string;
}

const mapInventory = (row: PpeInventoryRow): PpeInventoryRecord => ({
  ...row,
  default_renewal_days: Number(row.default_renewal_days),
  stock_quantity: Number(row.stock_quantity),
  min_stock_level: Number(row.min_stock_level),
});

const mapAssignment = (row: PpeAssignmentRow): PpeAssignmentRecord => ({
  ...row,
  quantity: Number(row.quantity),
});

const ensureInventoryRow = (row: unknown) => row as PpeInventoryRow;
const ensureAssignmentRow = (row: unknown) => row as PpeAssignmentRow;
const ensureEmployeeRow = (row: unknown) => row as EmployeeRow;
const ensureCompanyRow = (row: unknown) => row as CompanyRow;
const ensureTaskRow = (row: unknown) => row as OsgbTaskLookupRow;

export const listPpeInventory = async (userId: string): Promise<PpeInventoryRecord[]> => {
  const { data, error } = await db
    .from("ppe_inventory")
    .select("*")
    .eq("user_id", userId)
    .order("item_name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapInventory(ensureInventoryRow(row)));
};

export const listPpeInventoryPage = async (
  userId: string,
  params: PpeInventoryPageParams,
): Promise<PagedResult<PpeInventoryRecord>> => {
  const { page, pageSize, search } = params;
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;
  let query = (supabase as any)
    .from("ppe_inventory")
    .select("*", { count: "exact" })
    .eq("user_id", userId);

  if (search?.trim()) {
    const term = search.trim();
    query = query.or(`item_name.ilike.%${term}%,category.ilike.%${term}%,standard_code.ilike.%${term}%`);
  }

  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  return {
    rows: (data ?? []).map((row: unknown) => mapInventory(ensureInventoryRow(row))),
    count: count ?? 0,
  };
};

export const upsertPpeInventory = async (
  userId: string,
  input: PpeInventoryInput,
  inventoryId?: string,
): Promise<PpeInventoryRecord> => {
  const payload = {
    user_id: userId,
    item_name: input.itemName.trim(),
    category: input.category.trim(),
    standard_code: input.standardCode?.trim() || null,
    default_renewal_days: input.defaultRenewalDays,
    stock_quantity: input.stockQuantity,
    min_stock_level: input.minStockLevel,
    is_active: input.isActive,
    notes: input.notes?.trim() || null,
  };

  const query = inventoryId
    ? db.from("ppe_inventory").update(payload).eq("id", inventoryId)
    : db.from("ppe_inventory").insert(payload);

  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return mapInventory(ensureInventoryRow(data));
};

export const deletePpeInventory = async (id: string): Promise<void> => {
  const { error } = await db.from("ppe_inventory").delete().eq("id", id);
  if (error) throw error;
};

export const listPpeAssignments = async (userId: string): Promise<PpeAssignmentRecord[]> => {
  const { data, error } = await db
    .from("ppe_assignments")
    .select("*")
    .eq("user_id", userId)
    .order("due_date", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapAssignment(ensureAssignmentRow(row)));
};

export const listPpeAssignmentsPage = async (
  userId: string,
  params: PpeAssignmentPageParams,
): Promise<PagedResult<PpeAssignmentRecord>> => {
  const { page, pageSize, employeeId } = params;
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;
  let query = (supabase as any)
    .from("ppe_assignments")
    .select("*", { count: "exact" })
    .eq("user_id", userId);

  if (employeeId && employeeId !== "ALL") {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error, count } = await query
    .order("due_date", { ascending: true })
    .range(from, to);

  if (error) throw error;
  return {
    rows: (data ?? []).map((row: unknown) => mapAssignment(ensureAssignmentRow(row))),
    count: count ?? 0,
  };
};

export const upsertPpeAssignment = async (
  userId: string,
  input: PpeAssignmentInput,
  assignmentId?: string,
): Promise<PpeAssignmentRecord> => {
  const payload = {
    user_id: userId,
    inventory_id: input.inventoryId,
    employee_id: input.employeeId,
    company_id: input.companyId || null,
    assigned_date: input.assignedDate,
    due_date: input.dueDate,
    status: input.status,
    quantity: input.quantity,
    size_label: input.sizeLabel?.trim() || null,
    notes: input.notes?.trim() || null,
    return_date: input.returnDate || null,
  };

  const query = assignmentId
    ? db.from("ppe_assignments").update(payload).eq("id", assignmentId)
    : db.from("ppe_assignments").insert(payload);

  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return mapAssignment(ensureAssignmentRow(data));
};

export const deletePpeAssignment = async (id: string): Promise<void> => {
  const { error } = await db.from("ppe_assignments").delete().eq("id", id);
  if (error) throw error;
};

export const markPpeAssignmentReturned = async (assignmentId: string): Promise<PpeAssignmentRecord> => {
  const { data, error } = await db
    .from("ppe_assignments")
    .update({
      status: "returned",
      return_date: new Date().toISOString().slice(0, 10),
    })
    .eq("id", assignmentId)
    .select("*")
    .single();

  if (error) throw error;
  return mapAssignment(ensureAssignmentRow(data));
};

export const listPpeEmployeeOptions = async (): Promise<PpeEmployeeOption[]> => {
  const [{ data: employeeData, error: employeeError }, { data: companyData, error: companyError }] =
    await Promise.all([
      db
        .from("employees")
        .select("id, company_id, first_name, last_name, job_title, department, is_active")
        .order("first_name", { ascending: true }),
      db.from("companies").select("id, name").order("name", { ascending: true }),
    ]);

  if (employeeError) throw employeeError;
  if (companyError) throw companyError;

  const companyMap = new Map(
    (companyData ?? []).map((row) => {
      const company = ensureCompanyRow(row);
      return [company.id, company.name];
    }),
  );

  return (employeeData ?? []).map((row) => {
    const employee = ensureEmployeeRow(row);
    return {
      id: employee.id,
      fullName: `${employee.first_name} ${employee.last_name}`.trim(),
      companyId: employee.company_id,
      companyName: companyMap.get(employee.company_id) ?? null,
      department: employee.department,
      jobTitle: employee.job_title,
      isActive: Boolean(employee.is_active ?? true),
    };
  });
};

export const listPpeInventoryOptions = async (userId: string): Promise<PpeInventoryOption[]> => {
  const { data, error } = await (supabase as any)
    .from("ppe_inventory")
    .select("id, item_name, is_active, default_renewal_days")
    .eq("user_id", userId)
    .order("item_name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    itemName: row.item_name,
    isActive: Boolean(row.is_active),
    defaultRenewalDays: Number(row.default_renewal_days ?? 0),
  }));
};

export const buildPpeEmployeeOverview = (
  employees: PpeEmployeeOption[],
  inventory: PpeInventoryRecord[],
  assignments: PpeAssignmentRecord[],
): PpeEmployeeOverview[] => {
  const inventoryMap = new Map(inventory.map((item) => [item.id, item.item_name]));
  const now = new Date();
  const inThirtyDays = new Date();
  inThirtyDays.setDate(now.getDate() + 30);

  return employees
    .map((employee) => {
      const rows = assignments.filter((item) => item.employee_id === employee.id);
      const activeRows = rows.filter((item) => item.status !== "returned");
      const overdueCount = activeRows.filter((item) => new Date(item.due_date) < now).length;
      const renewalDueCount = activeRows.filter((item) => {
        const due = new Date(item.due_date);
        return due >= now && due <= inThirtyDays;
      }).length;

      return {
        employeeId: employee.id,
        employeeName: employee.fullName,
        companyName: employee.companyName,
        department: employee.department,
        activeAssignments: activeRows.length,
        overdueCount,
        renewalDueCount,
        items: activeRows.map((item) => ({
          assignmentId: item.id,
          itemName: inventoryMap.get(item.inventory_id) || "KKD kaydı",
          dueDate: item.due_date,
          status: item.status,
          quantity: item.quantity,
        })),
      };
    })
    .sort((left, right) => {
      if (right.overdueCount !== left.overdueCount) {
        return right.overdueCount - left.overdueCount;
      }
      return right.renewalDueCount - left.renewalDueCount;
    });
};

export const createPpeRenewalTasks = async (
  userId: string,
  inventory: PpeInventoryRecord[],
  assignments: PpeAssignmentRecord[],
  employees: PpeEmployeeOption[],
): Promise<PpeRenewalTaskResult> => {
  const now = Date.now();
  const horizon = now + 1000 * 60 * 60 * 24 * 30;
  const inventoryMap = new Map(inventory.map((item) => [item.id, item]));
  const employeeMap = new Map(employees.map((item) => [item.id, item]));

  const actionableAssignments = assignments.filter((assignment) => {
    if (assignment.status === "returned") return false;
    const dueDate = new Date(assignment.due_date).getTime();
    if (Number.isNaN(dueDate)) return false;
    return dueDate <= horizon;
  });

  if (actionableAssignments.length === 0) {
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

  for (const assignment of actionableAssignments) {
    const inventoryItem = inventoryMap.get(assignment.inventory_id);
    const employee = employeeMap.get(assignment.employee_id);
    if (!inventoryItem || !employee) {
      skipped += 1;
      continue;
    }

    const title = `KKD yenileme: ${employee.fullName} - ${inventoryItem.item_name}`;
    const duplicate = existingTasks.some(
      (task) =>
        task.source === "ppe_renewal" &&
        task.title === title &&
        task.company_id === (assignment.company_id || null) &&
        task.status !== "cancelled",
    );

    if (duplicate) {
      skipped += 1;
      continue;
    }

    const dueTime = new Date(assignment.due_date).getTime();
    const priority = dueTime < now || assignment.status === "replacement_due" ? "high" : "medium";

    await createOsgbTask(userId, {
      companyId: assignment.company_id,
      title,
      description: `${employee.fullName} için ${inventoryItem.item_name} yenilemesi planlanmalı. Firma: ${employee.companyName || "atanmamış"}. Son yenileme tarihi: ${assignment.due_date}.`,
      dueDate: assignment.due_date,
      priority,
      source: "ppe_renewal",
    });

    existingTasks.unshift({
      id: assignment.id,
      company_id: assignment.company_id,
      title,
      source: "ppe_renewal",
      status: "open",
    });

    created += 1;
  }

  return { created, skipped };
};
