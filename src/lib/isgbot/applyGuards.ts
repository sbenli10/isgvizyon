import type { MultiAssignmentPlanRow } from "./assignmentDryRun";
import type { ExcessDurationPreviewRow } from "./excessDurationDryRun";

export const ISGBOT_APPLY_ENABLED = String(import.meta.env.VITE_ISGBOT_APPLY_ENABLED || "").toLowerCase() === "true";
export const ISGBOT_PILOT_LIMIT = Math.max(1, Number.parseInt(String(import.meta.env.VITE_ISGBOT_APPLY_LIMIT || "3"), 10) || 3);

type ExtensionLike = {
  installed: boolean;
  isgKatipReady: boolean;
  state: string;
};

type ConfirmationLike = {
  reviewedPlan: boolean;
  acceptedRealChange: boolean;
  typedConfirmation: string;
};

type ApplyGuardResult = {
  allowed: boolean;
  reasons: string[];
};

type MultiAssignmentApplyInput = {
  applyEnabled: boolean;
  extensionStatus: ExtensionLike;
  planRows: MultiAssignmentPlanRow[];
  selectedRows: MultiAssignmentPlanRow[];
  planHash: string | null;
  confirmation?: ConfirmationLike;
  pilotLimit?: number;
};

type ExcessDurationApplyInput = {
  applyEnabled: boolean;
  extensionStatus: ExtensionLike;
  previewRows: ExcessDurationPreviewRow[];
  selectedRows: ExcessDurationPreviewRow[];
  planHash: string | null;
  confirmation?: ConfirmationLike;
  pilotLimit?: number;
};

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForHash);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeForHash((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value ?? null;
}

function stableStringify(value: unknown) {
  return JSON.stringify(normalizeForHash(value));
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `plan_${(hash >>> 0).toString(16)}`;
}

export function createPlanHash(payload: unknown) {
  return hashString(stableStringify(payload));
}

function validateConfirmation(confirmation?: ConfirmationLike) {
  const reasons: string[] = [];
  if (!confirmation?.reviewedPlan) {
    reasons.push("Önizleme planını kontrol ettiğinizi onaylamalısınız.");
  }
  if (!confirmation?.acceptedRealChange) {
    reasons.push("Gerçek değişiklik onay kutusunu işaretlemelisiniz.");
  }
  if (confirmation?.typedConfirmation?.trim().toLocaleUpperCase("tr-TR") !== "ONAYLIYORUM") {
    reasons.push("Devam etmek için ONAYLIYORUM yazmalısınız.");
  }
  return reasons;
}

export function validateApplyPayload(
  type: "multi_assignment" | "excess_duration",
  records: unknown[],
  planHash: string | null,
  pilotLimit = ISGBOT_PILOT_LIMIT,
): ApplyGuardResult {
  const reasons: string[] = [];
  if (!planHash) reasons.push("Plan doğrulaması başarısız oldu. Lütfen önizlemeyi yeniden oluşturun.");
  if (!Array.isArray(records) || records.length === 0) reasons.push("İşlem yapılacak kayıt seçilmedi.");
  if (Array.isArray(records) && records.length > pilotLimit) {
    reasons.push(`Pilot modda en fazla ${pilotLimit} kayıt işlenebilir.`);
  }

  if (type === "multi_assignment") {
    records.forEach((record, index) => {
      const row = record as Partial<MultiAssignmentPlanRow>;
      if (!row.companyName || !row.sgkNo || !row.personnelName) {
        reasons.push(`Atama kaydı #${index + 1} eksik bilgiler içeriyor.`);
      }
      if (!row.suggestedMinutes || row.suggestedMinutes <= 0) {
        reasons.push(`Atama kaydı #${index + 1} için önerilen dakika geçersiz.`);
      }
    });
  }

  if (type === "excess_duration") {
    records.forEach((record, index) => {
      const row = record as Partial<ExcessDurationPreviewRow>;
      if (!row.companyName || !row.sgkNo) {
        reasons.push(`Süre kaydı #${index + 1} eksik firma bilgisi içeriyor.`);
      }
      if (!row.suggestedMinutes || row.suggestedMinutes <= 0) {
        reasons.push(`Süre kaydı #${index + 1} için önerilen yeni dakika geçersiz.`);
      }
    });
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

export function canApplyMultiAssignment(input: MultiAssignmentApplyInput): ApplyGuardResult {
  const reasons: string[] = [];
  const pilotLimit = input.pilotLimit ?? ISGBOT_PILOT_LIMIT;

  if (!input.applyEnabled) reasons.push("Gerçek işlem modu şu anda kapalıdır. Önizleme oluşturabilirsiniz.");
  if (!input.extensionStatus.installed) reasons.push("Eklenti bağlantısı doğrulanamadı.");
  if (!input.extensionStatus.isgKatipReady || input.extensionStatus.state !== "sync_ready") {
    reasons.push("İSG-KATİP oturumu bulunamadı veya hazır değil.");
  }
  if (!input.planRows.length) reasons.push("Önce dry-run planı oluşturun.");
  if (!input.selectedRows.length) reasons.push("İşlem yapılacak kayıt seçilmedi.");

  const invalidSelectedRows = input.selectedRows.filter(
    (row) => row.status === "Kapasite Yetersiz" || row.status === "Veri Eksik",
  );
  if (invalidSelectedRows.length > 0) {
    reasons.push("Kapasite yetersiz veya veri eksik kayıtlar gerçek işleme alınamaz.");
  }

  reasons.push(...validateConfirmation(input.confirmation));

  const payloadValidation = validateApplyPayload(
    "multi_assignment",
    input.selectedRows,
    input.planHash,
    pilotLimit,
  );
  reasons.push(...payloadValidation.reasons);

  return {
    allowed: reasons.length === 0,
    reasons: [...new Set(reasons)],
  };
}

export function canApplyExcessDuration(input: ExcessDurationApplyInput): ApplyGuardResult {
  const reasons: string[] = [];
  const pilotLimit = input.pilotLimit ?? ISGBOT_PILOT_LIMIT;

  if (!input.applyEnabled) reasons.push("Gerçek işlem modu şu anda kapalıdır. Önizleme oluşturabilirsiniz.");
  if (!input.extensionStatus.installed) reasons.push("Eklenti bağlantısı doğrulanamadı.");
  if (!input.extensionStatus.isgKatipReady || input.extensionStatus.state !== "sync_ready") {
    reasons.push("İSG-KATİP oturumu bulunamadı veya hazır değil.");
  }
  if (!input.previewRows.length) reasons.push("Önce fazla süre önizlemesi oluşturun.");
  if (!input.selectedRows.length) reasons.push("İşlem yapılacak kayıt seçilmedi.");

  const invalidRows = input.selectedRows.filter((row) => row.status === "Hesaplanamadı" || row.excessMinutes <= 0);
  if (invalidRows.length > 0) {
    reasons.push("Eksik veri içeren kayıtlar gerçek işleme alınamaz.");
  }

  reasons.push(...validateConfirmation(input.confirmation));

  const payloadValidation = validateApplyPayload(
    "excess_duration",
    input.selectedRows,
    input.planHash,
    pilotLimit,
  );
  reasons.push(...payloadValidation.reasons);

  return {
    allowed: reasons.length === 0,
    reasons: [...new Set(reasons)],
  };
}
