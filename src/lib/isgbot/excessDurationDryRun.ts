import type { IsgbotCompanyLike } from "./assignmentDryRun";

export type ExcessDurationPreviewRow = {
  id: string;
  companyName: string;
  sgkNo: string;
  employeeCount: number;
  hazardClass: string;
  assignedMinutes: number;
  requiredMinutes: number;
  excessMinutes: number;
  suggestedMinutes: number;
  impactNote: string;
  status: "Öneri Oluşturuldu" | "Hesaplanamadı";
};

export type ExcessDurationPreview = {
  rows: ExcessDurationPreviewRow[];
  missingRows: ExcessDurationPreviewRow[];
  summary: {
    analyzed_company_count: number;
    excess_assignment_count: number;
    total_excess_minutes: number;
    missing_data_count: number;
    recommendation_count: number;
  };
};

const hasValue = (value: unknown) => value !== null && typeof value !== "undefined" && String(value).trim() !== "";

export function buildExcessDurationPreview(companies: IsgbotCompanyLike[]): ExcessDurationPreview {
  const rows: ExcessDurationPreviewRow[] = [];
  const missingRows: ExcessDurationPreviewRow[] = [];

  companies.forEach((company) => {
    const assignedMinutes = Number(company.assigned_minutes || 0);
    const requiredMinutes = Number(company.required_minutes || 0);
    const base = {
      id: company.id,
      companyName: company.company_name || "Firma",
      sgkNo: company.sgk_no || "-",
      employeeCount: Number(company.employee_count || 0),
      hazardClass: company.hazard_class || "-",
      assignedMinutes,
      requiredMinutes,
    };

    if (!hasValue(company.assigned_minutes) || !hasValue(company.required_minutes) || requiredMinutes <= 0) {
      missingRows.push({
        ...base,
        excessMinutes: 0,
        suggestedMinutes: 0,
        impactNote: "Atanmış/gerekli dakika verisi olmadığı için öneri oluşturulamadı.",
        status: "Hesaplanamadı",
      });
      return;
    }

    if (assignedMinutes > requiredMinutes) {
      const excessMinutes = assignedMinutes - requiredMinutes;
      rows.push({
        ...base,
        excessMinutes,
        suggestedMinutes: requiredMinutes,
        impactNote: `${excessMinutes} dk/ay fazla atama görünüyor. Bu sadece önizlemedir; İSG-KATİP üzerinde değişiklik yapılmaz.`,
        status: "Öneri Oluşturuldu",
      });
    }
  });

  return {
    rows,
    missingRows,
    summary: {
      analyzed_company_count: companies.length,
      excess_assignment_count: rows.length,
      total_excess_minutes: rows.reduce((sum, row) => sum + row.excessMinutes, 0),
      missing_data_count: missingRows.length,
      recommendation_count: rows.length,
    },
  };
}
