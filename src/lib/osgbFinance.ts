import { supabase } from "@/integrations/supabase/client";

export type OsgbFinanceStatus = "pending" | "paid" | "overdue";

export interface OsgbFinanceRecord {
  id: string;
  organizationId: string;
  companyId: string;
  companyName: string | null;
  period: string;
  amount: number;
  invoiceNo: string | null;
  dueDate: string | null;
  status: OsgbFinanceStatus;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OsgbFinanceInput {
  companyId: string;
  companyName?: string | null;
  period: string;
  amount: number;
  invoiceNo?: string | null;
  dueDate?: string | null;
  status?: OsgbFinanceStatus;
  notes?: string | null;
}

const FINANCE_SELECT = `
  id,
  organization_id,
  company_id,
  company_name,
  period,
  amount,
  invoice_no,
  due_date,
  status,
  notes,
  created_by,
  created_at,
  updated_at,
  company:isgkatip_companies(company_name)
`;

const PERIOD_PATTERN = /^\d{4}-\d{2}$/;

const mapFinanceRecord = (row: any): OsgbFinanceRecord => ({
  id: row.id,
  organizationId: row.organization_id,
  companyId: row.company_id,
  companyName: row.company_name || row.company?.company_name || null,
  period: row.period,
  amount: Number(row.amount || 0),
  invoiceNo: row.invoice_no || null,
  dueDate: row.due_date || null,
  status: (row.status || "pending") as OsgbFinanceStatus,
  notes: row.notes || null,
  createdBy: row.created_by || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const assertValidPeriod = (period: string) => {
  if (!PERIOD_PATTERN.test(period)) {
    throw new Error("Dönem YYYY-MM formatında olmalı.");
  }
};

const buildFinancePayload = (organizationId: string, input: OsgbFinanceInput) => {
  assertValidPeriod(input.period);
  return {
    organization_id: organizationId,
    company_id: input.companyId,
    company_name: input.companyName?.trim() || null,
    period: input.period,
    amount: Number(input.amount || 0),
    invoice_no: input.invoiceNo?.trim() || null,
    due_date: input.dueDate || null,
    status: input.status || "pending",
    notes: input.notes?.trim() || null,
  };
};

const addOneMonthToPeriod = (period: string) => {
  assertValidPeriod(period);
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const addOneMonthToDate = (dateValue: string | null) => {
  if (!dateValue) return null;
  const date = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const originalDay = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + 1);
  if (date.getUTCDate() !== originalDay) {
    date.setUTCDate(0);
  }
  return date.toISOString().slice(0, 10);
};

const generateInvoiceNo = async (organizationId: string, period: string) => {
  const year = period.slice(0, 4);
  const prefix = `IST-${year}-`;
  const { data, error } = await (supabase as any)
    .from("osgb_finance_records")
    .select("invoice_no")
    .eq("organization_id", organizationId)
    .ilike("invoice_no", `${prefix}%`);

  if (error) throw error;

  const maxSequence = (data || []).reduce((max: number, row: any) => {
    const suffix = String(row.invoice_no || "").replace(prefix, "");
    const sequence = Number.parseInt(suffix, 10);
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return `${prefix}${String(maxSequence + 1).padStart(3, "0")}`;
};

export const listOsgbFinanceRecords = async (organizationId: string): Promise<OsgbFinanceRecord[]> => {
  const { data, error } = await (supabase as any)
    .from("osgb_finance_records")
    .select(FINANCE_SELECT)
    .eq("organization_id", organizationId)
    .order("period", { ascending: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapFinanceRecord);
};

export const createOsgbFinanceRecord = async (
  userId: string,
  organizationId: string,
  input: OsgbFinanceInput,
): Promise<OsgbFinanceRecord> => {
  const payload = {
    ...buildFinancePayload(organizationId, input),
    created_by: userId,
  };

  const { data, error } = await (supabase as any)
    .from("osgb_finance_records")
    .insert(payload)
    .select(FINANCE_SELECT)
    .single();

  if (error) throw error;
  return mapFinanceRecord(data);
};

export const updateOsgbFinanceRecord = async (
  id: string,
  organizationId: string,
  input: OsgbFinanceInput,
): Promise<OsgbFinanceRecord> => {
  const { data, error } = await (supabase as any)
    .from("osgb_finance_records")
    .update(buildFinancePayload(organizationId, input))
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select(FINANCE_SELECT)
    .single();

  if (error) throw error;
  return mapFinanceRecord(data);
};

export const deleteOsgbFinanceRecord = async (id: string, organizationId: string): Promise<void> => {
  const { error } = await (supabase as any)
    .from("osgb_finance_records")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) throw error;
};

const markFinanceStatus = async (
  id: string,
  organizationId: string,
  status: OsgbFinanceStatus,
): Promise<OsgbFinanceRecord> => {
  const { data, error } = await (supabase as any)
    .from("osgb_finance_records")
    .update({ status })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select(FINANCE_SELECT)
    .single();

  if (error) throw error;
  return mapFinanceRecord(data);
};

export const markFinancePaid = (id: string, organizationId: string) => markFinanceStatus(id, organizationId, "paid");
export const markFinancePending = (id: string, organizationId: string) => markFinanceStatus(id, organizationId, "pending");
export const markFinanceOverdue = (id: string, organizationId: string) => markFinanceStatus(id, organizationId, "overdue");

export const duplicateFinanceNextMonth = async (
  userId: string,
  organizationId: string,
  record: OsgbFinanceRecord,
): Promise<OsgbFinanceRecord> => {
  const nextPeriod = addOneMonthToPeriod(record.period);

  const { data: existing, error: existingError } = await (supabase as any)
    .from("osgb_finance_records")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("company_id", record.companyId)
    .eq("period", nextPeriod)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    throw new Error("Bu firma için ilgili dönem kaydı zaten mevcut.");
  }

  const invoiceNo = await generateInvoiceNo(organizationId, nextPeriod);
  return createOsgbFinanceRecord(userId, organizationId, {
    companyId: record.companyId,
    companyName: record.companyName,
    period: nextPeriod,
    amount: record.amount,
    invoiceNo,
    dueDate: addOneMonthToDate(record.dueDate),
    status: "pending",
    notes: record.notes,
  });
};
