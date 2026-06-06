import { supabase } from "@/integrations/supabase/client";

export type OsgbFinanceStatus = "pending" | "paid" | "overdue";

export interface OsgbFinanceRecord {
  id: string;
  organization_id: string;
  company_id: string;
  company_name: string | null;
  period: string;
  amount: number;
  invoice_no: string | null;
  due_date: string | null;
  status: OsgbFinanceStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OsgbFinanceInput {
  organization_id: string;
  company_id: string;
  company_name?: string | null;
  period: string;
  amount: number;
  invoice_no?: string | null;
  due_date?: string | null;
  status?: OsgbFinanceStatus;
  notes?: string | null;
  created_by?: string | null;
}

export interface OsgbFinanceFilters {
  search?: string;
  status?: OsgbFinanceStatus | "ALL";
  companyId?: string | "ALL";
  period?: string;
}

const table = () => (supabase as any).from("osgb_finance_records");

const normalizeRecord = (row: any): OsgbFinanceRecord => ({
  ...row,
  amount: Number(row.amount || 0),
});

const normalizePeriod = (period: string) => {
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new Error("Dönem YYYY-AA formatında olmalıdır.");
  }
  return period;
};

const addOneMonthToPeriod = (period: string) => {
  normalizePeriod(period);
  const [year, month] = period.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
};

const addOneMonthToDate = (value: string | null) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDayOfTargetMonth);
  return `${year + Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
};

const getNextInvoiceNo = async (organizationId: string, period: string) => {
  const year = period.slice(0, 4);
  const { data, error } = await table()
    .select("invoice_no")
    .eq("organization_id", organizationId)
    .ilike("invoice_no", `IST-${year}-%`);

  if (error) throw error;

  const maxNo = (data ?? []).reduce((max: number, row: { invoice_no: string | null }) => {
    const match = row.invoice_no?.match(new RegExp(`^IST-${year}-(\\d+)$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `IST-${year}-${String(maxNo + 1).padStart(3, "0")}`;
};

export const listOsgbFinanceRecords = async (
  organizationId: string,
  filters: OsgbFinanceFilters = {},
): Promise<OsgbFinanceRecord[]> => {
  let query = table()
    .select("*")
    .eq("organization_id", organizationId)
    .order("period", { ascending: false })
    .order("due_date", { ascending: true });

  if (filters.status && filters.status !== "ALL") query = query.eq("status", filters.status);
  if (filters.companyId && filters.companyId !== "ALL") query = query.eq("company_id", filters.companyId);
  if (filters.period?.trim()) query = query.eq("period", filters.period.trim());
  if (filters.search?.trim()) {
    const needle = filters.search.trim();
    query = query.or(`company_name.ilike.%${needle}%,invoice_no.ilike.%${needle}%,notes.ilike.%${needle}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(normalizeRecord);
};

export const createOsgbFinanceRecord = async (input: OsgbFinanceInput): Promise<OsgbFinanceRecord> => {
  normalizePeriod(input.period);
  const payload = {
    organization_id: input.organization_id,
    company_id: input.company_id,
    company_name: input.company_name || null,
    period: input.period,
    amount: input.amount,
    invoice_no: input.invoice_no || null,
    due_date: input.due_date || null,
    status: input.status || "pending",
    notes: input.notes || null,
    created_by: input.created_by || null,
  };

  const { data, error } = await table().insert(payload).select("*").single();
  if (error) {
    if (error.code === "23505") throw new Error("Bu firma için ilgili dönem kaydı zaten mevcut.");
    throw error;
  }
  return normalizeRecord(data);
};

export const updateOsgbFinanceRecord = async (
  id: string,
  input: Partial<OsgbFinanceInput>,
): Promise<OsgbFinanceRecord> => {
  if (input.period) normalizePeriod(input.period);
  const { data, error } = await table()
    .update({
      company_id: input.company_id,
      company_name: input.company_name,
      period: input.period,
      amount: input.amount,
      invoice_no: input.invoice_no,
      due_date: input.due_date,
      status: input.status,
      notes: input.notes,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("Bu firma için ilgili dönem kaydı zaten mevcut.");
    throw error;
  }
  return normalizeRecord(data);
};

export const deleteOsgbFinanceRecord = async (id: string) => {
  const { error } = await table().delete().eq("id", id);
  if (error) throw error;
};

export const markFinancePaid = (id: string) => updateOsgbFinanceRecord(id, { status: "paid" });

export const markFinanceOverdue = (id: string) => updateOsgbFinanceRecord(id, { status: "overdue" });

export const duplicateFinanceNextMonth = async (
  record: OsgbFinanceRecord,
  createdBy?: string | null,
): Promise<OsgbFinanceRecord> => {
  const nextPeriod = addOneMonthToPeriod(record.period);

  const { data: existing, error: existingError } = await table()
    .select("id")
    .eq("organization_id", record.organization_id)
    .eq("company_id", record.company_id)
    .eq("period", nextPeriod)
    .limit(1);

  if (existingError) throw existingError;
  if ((existing ?? []).length > 0) {
    throw new Error("Bu firma için ilgili dönem kaydı zaten mevcut.");
  }

  const invoiceNo = await getNextInvoiceNo(record.organization_id, nextPeriod);
  return createOsgbFinanceRecord({
    organization_id: record.organization_id,
    company_id: record.company_id,
    company_name: record.company_name,
    period: nextPeriod,
    amount: record.amount,
    invoice_no: invoiceNo,
    due_date: addOneMonthToDate(record.due_date),
    status: "pending",
    notes: record.notes,
    created_by: createdBy || record.created_by,
  });
};
