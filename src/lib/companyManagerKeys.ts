import type { ParsedEmployee } from "@/utils/excelParser";
import { buildDeterministicClientId } from "@/lib/clientIdentity";

export type BulkCompanyPreviewRow = {
  client_id?: string | null;
  company_name: string;
  tax_number?: string | null;
  nace_code?: string | null;
  email?: string | null;
};

const normalizeKeyPart = (value?: string | null) => (value || "").trim().toLocaleLowerCase("tr-TR");

export const getParsedEmployeePreviewKey = (employee: ParsedEmployee) =>
  normalizeKeyPart(employee.tc_number) ||
  normalizeKeyPart(employee.email) ||
  ([
    normalizeKeyPart(employee.full_name),
    normalizeKeyPart(employee.first_name),
    normalizeKeyPart(employee.last_name),
    normalizeKeyPart(employee.start_date),
  ]
    .filter(Boolean)
    .join("|") || "employee-preview-unknown");

export const getBulkCompanyPreviewKey = (row: BulkCompanyPreviewRow) =>
  normalizeKeyPart(row.client_id) ||
  buildDeterministicClientId("company-preview", [
    normalizeKeyPart(row.tax_number),
    normalizeKeyPart(row.nace_code),
    normalizeKeyPart(row.company_name),
    normalizeKeyPart(row.email),
  ]);
