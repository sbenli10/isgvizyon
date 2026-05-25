type ApplyResultStatus =
  | "pending"
  | "processing"
  | "success"
  | "success_verified"
  | "success_unverified"
  | "failed"
  | "skipped";

export type ApplyResultRow = {
  id: string;
  companyName: string;
  sgkNo: string;
  operationType: string;
  status: ApplyResultStatus;
  reason: string | null;
  processedAt: string | null;
  stage?: string | null;
  verificationStatus?: string | null;
  selectorConfidence?: string | null;
  durationMs?: number | null;
};

export function normalizeApplyResult(
  input: Partial<ApplyResultRow> & { id: string; companyName: string; sgkNo: string; operationType: string },
): ApplyResultRow {
  return {
    id: input.id,
    companyName: input.companyName,
    sgkNo: input.sgkNo,
    operationType: input.operationType,
    status: input.status || "pending",
    reason: input.reason || null,
    processedAt: input.processedAt || null,
    stage: input.stage || null,
    verificationStatus: input.verificationStatus || null,
    selectorConfidence: input.selectorConfidence || null,
    durationMs: input.durationMs ?? null,
  };
}

export function summarizeApplyResults(results: ApplyResultRow[]) {
  return {
    total_count: results.length,
    success_count: results.filter((row) => row.status === "success" || row.status === "success_verified" || row.status === "success_unverified").length,
    success_verified_count: results.filter((row) => row.status === "success_verified").length,
    success_unverified_count: results.filter((row) => row.status === "success_unverified").length,
    failed_count: results.filter((row) => row.status === "failed").length,
    skipped_count: results.filter((row) => row.status === "skipped").length,
    processing_count: results.filter((row) => row.status === "processing").length,
    pending_count: results.filter((row) => row.status === "pending").length,
    selector_low_confidence_count: results.filter((row) => row.selectorConfidence === "low").length,
  };
}

export function exportApplyResultsCsv(
  reportTitle: string,
  rows: ApplyResultRow[],
  downloadCsv: (filename: string, rows: Record<string, unknown>[]) => void,
) {
  const statusLabel = (status: ApplyResultRow["status"]) => {
    if (status === "success_verified") return "Başarılı ve doğrulandı";
    if (status === "success_unverified") return "Başarılı ancak doğrulanamadı";
    if (status === "success") return "Başarılı";
    if (status === "failed") return "Hatalı";
    if (status === "skipped") return "Atlandı";
    if (status === "processing") return "İşleniyor";
    return "Bekliyor";
  };

  downloadCsv(
    `isgvizyon-gercek-islem-sonuc-${new Date().toISOString().slice(0, 10)}.csv`,
    rows.map((row) => ({
      Rapor: reportTitle,
      Firma: row.companyName,
      "SGK no": row.sgkNo,
      "İşlem türü": row.operationType,
      Durum: statusLabel(row.status),
      Aşama: row.stage || "-",
      "Doğrulama durumu": row.verificationStatus || "-",
      "Selector güveni": row.selectorConfidence || "-",
      "Süre (ms)": row.durationMs ?? "-",
      "Hata nedeni": row.reason || "-",
      "İşlem zamanı": row.processedAt || "-",
    })),
  );
}
