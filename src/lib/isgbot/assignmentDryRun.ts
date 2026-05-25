export type IsgbotCompanyLike = {
  id: string;
  company_name: string | null;
  sgk_no: string | null;
  employee_count: number | null;
  hazard_class: string | null;
  contract_status?: string | null;
  assigned_minutes?: number | null;
  required_minutes?: number | null;
  is_deleted?: boolean | null;
};

export type IsgbotPersonnel = {
  id: string;
  fullName: string;
  tcNo: string;
  role: string;
  certificateType: string;
  certificateNo: string;
  eligibility: "Uygun" | "Eksik Bilgi" | "Uygun Değil";
  maxMinutes: number;
  currentLoadMinutes: number;
  remainingCapacityMinutes: number;
  warnings: string[];
};

export type ParsedSgkInput = {
  raw: string;
  normalized: string;
  valid: boolean;
  reason?: string;
};

export type PersonnelParseResult = {
  personnel: IsgbotPersonnel[];
  invalidRows: Array<{ raw: string; reason: string }>;
};

export type MultiAssignmentMatch = {
  sgkNo: string;
  company: IsgbotCompanyLike | null;
  status: "matched" | "unmatched" | "passive" | "missing_data";
  warning?: string;
};

export type MultiAssignmentPlanRow = {
  id: string;
  companyName: string;
  sgkNo: string;
  personnelName: string;
  personnelRole: string;
  contractStatus: string;
  employeeCount: number;
  hazardClass: string;
  requiredMinutes: number;
  suggestedMinutes: number;
  status: "Planlanabilir" | "Uyarılı" | "Kapasite Yetersiz" | "Veri Eksik";
  warnings: string[];
};

export type MultiAssignmentDryRunResult = {
  parsedSgk: ParsedSgkInput[];
  validSgkNumbers: string[];
  invalidInputs: ParsedSgkInput[];
  matches: MultiAssignmentMatch[];
  planRows: MultiAssignmentPlanRow[];
  summary: {
    parsed_sgk_count: number;
    matched_company_count: number;
    unmatched_sgk_count: number;
    planned_assignment_count: number;
    warning_count: number;
    invalid_input_count: number;
    capacity_insufficient_count: number;
    missing_data_count: number;
  };
};

const normalizeDigits = (value: string) => value.replace(/\D/g, "");

export const normalizeSgkNumber = (value: string) => normalizeDigits(value).replace(/^0+/, "");

export function parseSgkNumbers(input: string): ParsedSgkInput[] {
  const seen = new Set<string>();
  return input
    .split(/\r?\n|,|;|\t/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((raw) => {
      const normalized = normalizeSgkNumber(raw);
      if (normalized.length < 5) {
        return { raw, normalized, valid: false, reason: "SGK sicil numarası çok kısa veya geçersiz." };
      }
      if (seen.has(normalized)) {
        return { raw, normalized, valid: false, reason: "Tekrar eden SGK sicil numarası atlandı." };
      }
      seen.add(normalized);
      return { raw, normalized, valid: true };
    });
}

export function parsePersonnelText(input: string): PersonnelParseResult {
  const invalidRows: PersonnelParseResult["invalidRows"] = [];
  const personnel = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((raw, index) => {
      const parts = raw.includes(",")
        ? raw.split(",").map((part) => part.trim())
        : raw.split(/\s+-\s+/).map((part) => part.trim());
      let fullName = "";
      let tcNo = "";
      let role = "";
      let certificateNo = "";

      if (parts.length >= 4) {
        [fullName, tcNo, role, certificateNo] = parts;
      } else if (parts.length >= 3) {
        [tcNo, fullName, role] = parts;
      } else {
        tcNo = normalizeDigits(parts[0] || raw);
      }

      const normalizedTc = normalizeDigits(tcNo);
      if (normalizedTc.length !== 11) {
        invalidRows.push({ raw, reason: "T.C. kimlik numarası 11 haneli olmalıdır." });
      }

      const resolvedName = fullName || `Personel ${index + 1}`;
      const resolvedRole = role || "İSG Profesyoneli";
      const maxMinutes = 11700;
      const currentLoadMinutes = 0;
      const warnings = normalizedTc.length === 11 ? [] : ["T.C. kimlik numarası eksik/geçersiz."];

      return {
        id: normalizedTc || `personel-${index + 1}`,
        fullName: resolvedName,
        tcNo: normalizedTc || "-",
        role: resolvedRole,
        certificateType: resolvedRole,
        certificateNo: certificateNo || "-",
        eligibility: warnings.length ? "Eksik Bilgi" : "Uygun",
        maxMinutes,
        currentLoadMinutes,
        remainingCapacityMinutes: maxMinutes - currentLoadMinutes,
        warnings,
      } satisfies IsgbotPersonnel;
    });

  return { personnel, invalidRows };
}

export function buildMultiAssignmentPlan(
  companies: IsgbotCompanyLike[],
  sgkNumbers: string[],
  personnel: IsgbotPersonnel[],
  selectedPersonnelId: string | null,
): MultiAssignmentDryRunResult {
  const companyBySgk = new Map(
    companies
      .map((company) => [normalizeSgkNumber(company.sgk_no || ""), company] as const)
      .filter(([sgk]) => Boolean(sgk)),
  );
  const selectedPersonnel = personnel.find((person) => person.id === selectedPersonnelId) || personnel[0] || null;

  const matches = sgkNumbers.map((sgkNo) => {
    const company = companyBySgk.get(sgkNo) || null;
    if (!company) return { sgkNo, company: null, status: "unmatched", warning: "Eşleşen firma bulunamadı." } satisfies MultiAssignmentMatch;
    if (company.is_deleted) return { sgkNo, company, status: "passive", warning: "Firma pasif/silinmiş görünüyor." } satisfies MultiAssignmentMatch;
    if (!company.employee_count || !company.hazard_class) {
      return { sgkNo, company, status: "missing_data", warning: "Firma için çalışan sayısı veya tehlike sınıfı eksik." } satisfies MultiAssignmentMatch;
    }
    return { sgkNo, company, status: "matched" } satisfies MultiAssignmentMatch;
  });

  const planRows = matches
    .filter((match) => match.company)
    .map((match) => {
      const company = match.company!;
      const requiredMinutes = Number(company.required_minutes || 0);
      const employeeCount = Number(company.employee_count || 0);
      const hazardClass = company.hazard_class || "-";
      const contractStatus = company.contract_status || "Veri yok";
      const warnings: string[] = [];

      if (!selectedPersonnel) warnings.push("Personel seçilmedi.");
      if (!requiredMinutes) warnings.push("Firma için gerekli dakika hesaplanamadı.");
      if (!employeeCount) warnings.push("Çalışan sayısı bulunamadı.");
      if (!company.hazard_class) warnings.push("Tehlike sınıfı verisi eksik.");
      if (contractStatus.toLocaleLowerCase("tr-TR").includes("aktif")) warnings.push("Firma zaten aktif sözleşmeye sahip.");
      if (selectedPersonnel && requiredMinutes > selectedPersonnel.remainingCapacityMinutes) warnings.push("Personelin kalan kapasitesi yetersiz.");
      if (match.warning) warnings.push(match.warning);

      const status: MultiAssignmentPlanRow["status"] =
        warnings.some((warning) => warning.includes("kapasitesi")) ? "Kapasite Yetersiz" :
        warnings.some((warning) => warning.includes("hesaplanamadı") || warning.includes("bulunamadı") || warning.includes("eksik")) ? "Veri Eksik" :
        warnings.length ? "Uyarılı" : "Planlanabilir";

      return {
        id: `${company.id}-${selectedPersonnel?.id || "no-personnel"}`,
        companyName: company.company_name || "Firma",
        sgkNo: match.sgkNo,
        personnelName: selectedPersonnel?.fullName || "Personel seçilmedi",
        personnelRole: selectedPersonnel?.role || "-",
        contractStatus,
        employeeCount,
        hazardClass,
        requiredMinutes,
        suggestedMinutes: requiredMinutes,
        status,
        warnings,
      };
    });

  return {
    parsedSgk: sgkNumbers.map((normalized) => ({ raw: normalized, normalized, valid: true })),
    validSgkNumbers: sgkNumbers,
    invalidInputs: [],
    matches,
    planRows,
    summary: {
      parsed_sgk_count: sgkNumbers.length,
      matched_company_count: matches.filter((match) => match.company).length,
      unmatched_sgk_count: matches.filter((match) => match.status === "unmatched").length,
      planned_assignment_count: planRows.length,
      warning_count: planRows.reduce((sum, row) => sum + row.warnings.length, 0),
      invalid_input_count: 0,
      capacity_insufficient_count: planRows.filter((row) => row.status === "Kapasite Yetersiz").length,
      missing_data_count: planRows.filter((row) => row.status === "Veri Eksik").length,
    },
  };
}
