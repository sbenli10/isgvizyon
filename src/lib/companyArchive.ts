import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { uploadFileOptimized } from "@/lib/storageHelper";
import { buildStorageObjectRef, resolveStorageObjectUrl } from "@/lib/storageObject";

export const COMPANY_ARCHIVE_BUCKET = "safety_documents";
export const COMPANY_ARCHIVE_ROOT = "firma-arsivi";
const ARCHIVE_PAGE_SIZE = 25;

export const COMPANY_ARCHIVE_FOLDERS = [
  "Analizler",
  "Belgeler",
  "Foto\u011Fraflar",
  "Bilgiler",
] as const;

export type CompanyArchiveFolderName = (typeof COMPANY_ARCHIVE_FOLDERS)[number];
type ArchiveEntrySource = "storage" | "linked" | "generated";

type LooseRow = Record<string, unknown>;
type LooseDb = typeof supabase & {
  from: (table: string) => {
    select: (...args: unknown[]) => any;
  };
};

interface CompanyRow {
  id: string;
  name: string;
  tax_number: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  employee_count: number | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface EmployeeRow {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  department: string | null;
  tc_number: string | null;
  start_date: string | null;
  is_active: boolean | null;
}

interface CompanyArchiveDataset {
  folders: Record<CompanyArchiveFolderName, CompanyArchiveFileEntry[]>;
}

export interface CompanyArchiveFileEntry {
  path: string;
  name: string;
  displayName: string;
  size: number;
  createdAt: string;
  sourceType: ArchiveEntrySource;
  sourceLabel?: string | null;
  downloadUrl?: string | null;
  textContent?: string | null;
  mimeType?: string | null;
  deletable?: boolean;
  description?: string | null;
}

export interface CompanyArchiveFolderSummary {
  name: CompanyArchiveFolderName;
  path: string;
  fileCount: number;
}

export interface CompanyArchiveFolderPage {
  files: CompanyArchiveFileEntry[];
  hasMore: boolean;
  nextPage: number | null;
}

const db = supabase as LooseDb;
const archiveCache = new Map<string, CompanyArchiveDataset>();

const sanitizeDownloadName = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "")
    .trim();

const COMPANY_ARCHIVE_FOLDER_KEYS: Record<CompanyArchiveFolderName, string> = {
  Analizler: "analizler",
  Belgeler: "belgeler",
  "Foto\u011Fraflar": "fotograflar",
  Bilgiler: "bilgiler",
};

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"]);

const getArchiveFolderPath = (companyId: string, folder: CompanyArchiveFolderName) =>
  `${COMPANY_ARCHIVE_ROOT}/${companyId}/${COMPANY_ARCHIVE_FOLDER_KEYS[folder]}`;

const getArchiveDisplayName = (storedName: string) => {
  if (!storedName.includes("__")) return storedName;
  const parts = storedName.split("__");
  return parts.slice(1).join("__") || storedName;
};

const triggerBlobDownload = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = sanitizeDownloadName(fileName) || "arsiv-indir";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

const getTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const sortEntries = (entries: CompanyArchiveFileEntry[]) =>
  [...entries].sort((left, right) => {
    const diff = getTimestamp(right.createdAt) - getTimestamp(left.createdAt);
    if (diff !== 0) return diff;
    return left.displayName.localeCompare(right.displayName, "tr");
  });

const buildGeneratedEntry = (input: {
  folder: CompanyArchiveFolderName;
  companyId: string;
  name: string;
  displayName: string;
  createdAt?: string | null;
  textContent: string;
  description?: string | null;
  sourceLabel?: string | null;
}) => {
  const blob = new Blob([input.textContent], { type: "text/plain;charset=utf-8" });
  return {
    path: `virtual://${input.companyId}/${COMPANY_ARCHIVE_FOLDER_KEYS[input.folder]}/${input.name}`,
    name: input.name,
    displayName: input.displayName,
    size: blob.size,
    createdAt: input.createdAt || new Date().toISOString(),
    sourceType: "generated" as const,
    sourceLabel: input.sourceLabel || "Bilgi Kartı",
    textContent: input.textContent,
      mimeType: "text/plain",
      deletable: false,
    description: input.description || null,
  };
};

const buildLinkedEntry = (input: {
  folder: CompanyArchiveFolderName;
  companyId: string;
  name: string;
  displayName: string;
  createdAt?: string | null;
  downloadUrl: string;
  size?: number | null;
  mimeType?: string | null;
  description?: string | null;
  sourceLabel?: string | null;
}) => ({
  path: `linked://${input.companyId}/${COMPANY_ARCHIVE_FOLDER_KEYS[input.folder]}/${input.name}`,
  name: input.name,
  displayName: input.displayName,
  size: Number(input.size || 0),
  createdAt: input.createdAt || new Date().toISOString(),
  sourceType: "linked" as const,
  sourceLabel: input.sourceLabel || null,
  downloadUrl: input.downloadUrl,
  mimeType: input.mimeType || null,
  deletable: false,
  description: input.description || null,
});

const mapStorageFile = (folderPath: string, file: any): CompanyArchiveFileEntry => ({
  path: `${folderPath}/${file.name}`,
  name: file.name,
  displayName: getArchiveDisplayName(file.name),
  size: Number(file.metadata?.size || 0),
  createdAt: file.created_at || "",
  sourceType: "storage",
  sourceLabel: "Manuel Yükleme",
  deletable: true,
  description: "Manuel y\u00fcklenmi\u015f ar\u015fiv dosyas\u0131",
});

const formatDateText = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("tr-TR");
};

const toTextBlock = (lines: Array<string | null | undefined>) =>
  lines.filter((line) => line && line.trim().length > 0).join("\n");

const fileExtension = (name: string) => {
  const segments = name.split(".");
  return segments.length > 1 ? segments.at(-1)?.toLowerCase() || "" : "";
};

const isImageAttachment = (fileName: string, mimeType?: string | null) => {
  if (mimeType?.startsWith("image/")) return true;
  return IMAGE_EXTENSIONS.has(fileExtension(fileName));
};

const fetchCompany = async (companyId: string) => {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, tax_number, address, email, phone, industry, employee_count, notes, created_at, updated_at")
    .eq("id", companyId)
    .maybeSingle();

  if (error) throw error;
  return (data as CompanyRow | null) ?? null;
};

const fetchEmployees = async (companyId: string) => {
  const { data, error } = await supabase
    .from("employees")
    .select("id, first_name, last_name, job_title, department, tc_number, start_date, is_active")
    .eq("company_id", companyId)
    .order("first_name", { ascending: true });

  if (error) throw error;
  return ((data as EmployeeRow[] | null) ?? []).filter(Boolean);
};

const listStoredFolderEntries = async (companyId: string, folder: CompanyArchiveFolderName) => {
  const folderPath = getArchiveFolderPath(companyId, folder);
  const collected: CompanyArchiveFileEntry[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(COMPANY_ARCHIVE_BUCKET).list(folderPath, {
      limit: 100,
      offset,
      sortBy: { column: "created_at", order: "desc" },
    });

    if (error) throw error;
    const batch = (data || []).map((file) => mapStorageFile(folderPath, file));
    collected.push(...batch);

    if ((data || []).length < 100) break;
    offset += 100;
  }

  return collected;
};

const buildInfoEntries = async (companyId: string) => {
  const [company, employees] = await Promise.all([fetchCompany(companyId), fetchEmployees(companyId)]);
  if (!company) return [];

  const activeEmployees = employees.filter((employee) => employee.is_active !== false);
  const employeeList = activeEmployees.length
    ? activeEmployees
        .map((employee, index) =>
          `${index + 1}. ${employee.first_name} ${employee.last_name} | ${employee.job_title || "-"} | ${employee.department || "-"} | T.C.: ${employee.tc_number || "-"}`,
        )
        .join("\n")
    : "Aktif \u00e7al\u0131\u015fan kayd\u0131 bulunamad\u0131.";

  return [
    buildGeneratedEntry({
      folder: "Bilgiler",
      companyId,
      name: "firma-profili.txt",
      displayName: "Firma Profili.txt",
      createdAt: company.updated_at || company.created_at,
      description: "Sistemdeki firma bilgileri",
      sourceLabel: "Firma Bilgisi",
      textContent: toTextBlock([
        `Firma Ad\u0131: ${company.name}`,
        `Vergi / Sicil No: ${company.tax_number || "-"}`,
        `Adres: ${company.address || "-"}`,
        `E-posta: ${company.email || "-"}`,
        `Telefon: ${company.phone || "-"}`,
        `Sekt\u00f6r: ${company.industry || "-"}`,
        `Kay\u0131tl\u0131 \u00c7al\u0131\u015fan Say\u0131s\u0131: ${company.employee_count ?? activeEmployees.length}`,
        `Notlar: ${company.notes || "-"}`,
        `Olu\u015fturulma Tarihi: ${formatDateText(company.created_at)}`,
        `G\u00fcncellenme Tarihi: ${formatDateText(company.updated_at)}`,
      ]),
    }),
    buildGeneratedEntry({
      folder: "Bilgiler",
      companyId,
      name: "aktif-calisan-listesi.txt",
      displayName: "Aktif \u00c7al\u0131\u015fan Listesi.txt",
      createdAt: company.updated_at || company.created_at,
      description: "Firmaya ba\u011fl\u0131 \u00e7al\u0131\u015fanlar",
      sourceLabel: "\u00c7al\u0131\u015fan Listesi",
      textContent: toTextBlock([
        `Firma: ${company.name}`,
        `Aktif \u00c7al\u0131\u015fan Say\u0131s\u0131: ${activeEmployees.length}`,
        "",
        employeeList,
      ]),
    }),
  ];
};

const buildAnalysisEntries = async (companyId: string, companyName: string) => {
  const [riskAssessmentsResult, companyRisksResult, documentAnalysesResult] = await Promise.all([
    supabase
      .from("risk_assessments")
      .select("id, assessment_name, assessment_date, next_review_date, status, sector, workplace_title, notes, created_at, updated_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("company_risks")
      .select("id, risk_category, risk_description, risk_level, risk_score, hazard_source, updated_at, created_at")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false }),
    db
      .from("document_analyses")
      .select("id, title, summary, document_type, source_file_name, status, created_at, updated_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
  ]);

  if (riskAssessmentsResult.error) throw riskAssessmentsResult.error;
  if (companyRisksResult.error) throw companyRisksResult.error;
  if (documentAnalysesResult.error) throw documentAnalysesResult.error;

  const riskAssessmentEntries = (riskAssessmentsResult.data || []).map((row: any) =>
    buildGeneratedEntry({
      folder: "Analizler",
      companyId,
      name: `risk-analizi-${row.id}.txt`,
      displayName: `${row.assessment_name || "Risk Analizi"}.txt`,
      createdAt: row.updated_at || row.created_at,
      description: "Risk de\u011ferlendirme kayd\u0131",
      sourceLabel: "Risk Analizi",
      textContent: toTextBlock([
        `Firma: ${companyName}`,
        `Analiz Ad\u0131: ${row.assessment_name || "-"}`,
        `De\u011ferlendirme Tarihi: ${formatDateText(row.assessment_date)}`,
        `Sonraki G\u00f6zden Ge\u00e7irme: ${formatDateText(row.next_review_date)}`,
        `Durum: ${row.status || "-"}`,
        `Sekt\u00f6r: ${row.sector || "-"}`,
        `\u0130\u015fyeri / B\u00f6l\u00fcm: ${row.workplace_title || "-"}`,
        "",
        `Notlar: ${row.notes || "-"}`,
      ]),
    }),
  );

  const companyRiskSummaryEntries = (companyRisksResult.data || []).length
    ? [
        buildGeneratedEntry({
          folder: "Analizler",
          companyId,
          name: "firma-risk-envanteri.txt",
          displayName: "Firma Risk Envanteri.txt",
          createdAt: (companyRisksResult.data || [])[0]?.updated_at || (companyRisksResult.data || [])[0]?.created_at,
          description: "company_risks tablosundan olu\u015fturuldu",
          sourceLabel: "Risk Envanteri",
          textContent: toTextBlock([
            `Firma: ${companyName}`,
            `Risk Kayd\u0131 Say\u0131s\u0131: ${(companyRisksResult.data || []).length}`,
            "",
            ...(companyRisksResult.data || []).map(
              (row: any, index: number) =>
                `${index + 1}. [${row.risk_category || "-"}] ${row.risk_description || "-"} | Seviye: ${row.risk_level || "-"} | Skor: ${row.risk_score ?? "-"}`,
            ),
          ]),
        }),
      ]
    : [];

  const documentAnalysisEntries = ((documentAnalysesResult.data || []) as LooseRow[]).map((row) =>
    buildGeneratedEntry({
      folder: "Analizler",
      companyId,
      name: `belge-analizi-${String(row.id)}.txt`,
      displayName: `${String(row.title || row.source_file_name || "Belge Analizi")}.txt`,
      createdAt: String(row.updated_at || row.created_at || ""),
      description: "Belge analizi \u00f6zeti",
      sourceLabel: "Belge Analizi",
      textContent: toTextBlock([
        `Firma: ${companyName}`,
        `Analiz Ba\u015fl\u0131\u011f\u0131: ${String(row.title || "-")}`,
        `Belge T\u00fcr\u00fc: ${String(row.document_type || "-")}`,
        `Kaynak Dosya: ${String(row.source_file_name || "-")}`,
        `Durum: ${String(row.status || "-")}`,
        "",
        `${String(row.summary || "Analiz \u00f6zeti bulunmuyor.")}`,
      ]),
    }),
  );

  return [...riskAssessmentEntries, ...companyRiskSummaryEntries, ...documentAnalysisEntries];
};

const buildDocumentEntries = async (companyId: string, companyName: string) => {
  const [meetingsResult, analysesResult, emergencyPlansResult, reportsByCompanyIdResult, reportsByCompanyNameResult] = await Promise.all([
    supabase
      .from("board_meetings")
      .select("id, meeting_number, meeting_date, pdf_url, status, created_at")
      .eq("company_id", companyId)
      .order("meeting_date", { ascending: false }),
    db
      .from("document_analyses")
      .select("id, title, source_file_name, source_file_url, source_file_path, archived_to_library, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("emergency_plans")
      .select("id, company_name, created_at, pdf_url")
      .eq("company_name", companyName)
      .order("created_at", { ascending: false }),
    db
      .from("reports")
      .select("id, title, file_url, export_format, generated_at, content")
      .contains("content", { company_id: companyId })
      .order("generated_at", { ascending: false }),
    db
      .from("reports")
      .select("id, title, file_url, export_format, generated_at, content")
      .contains("content", { company_name: companyName })
      .order("generated_at", { ascending: false }),
  ]);

  if (meetingsResult.error) throw meetingsResult.error;
  if (analysesResult.error) throw analysesResult.error;
  if (emergencyPlansResult.error) throw emergencyPlansResult.error;
  if (reportsByCompanyIdResult.error) throw reportsByCompanyIdResult.error;
  if (reportsByCompanyNameResult.error) throw reportsByCompanyNameResult.error;

  const meetingEntries = (meetingsResult.data || [])
    .filter((row: any) => row.pdf_url)
    .map((row: any) =>
      buildLinkedEntry({
        folder: "Belgeler",
        companyId,
        name: `kurul-toplantisi-${row.id}.pdf`,
        displayName: `Kurul Toplant\u0131s\u0131 ${row.meeting_number || row.meeting_date || ""}.pdf`,
        createdAt: row.created_at || row.meeting_date,
        downloadUrl: String(row.pdf_url),
        mimeType: "application/pdf",
        sourceLabel: "Kurul PDF",
        description: "Kurul toplant\u0131s\u0131 PDF \u00e7\u0131kt\u0131s\u0131",
      }),
    );

  const analysisDocumentEntries = ((analysesResult.data || []) as LooseRow[])
    .filter((row) => Boolean(row.source_file_path || row.source_file_url))
    .map((row) => {
      const fileName = String(row.source_file_name || row.title || "belge");
      const downloadUrl = String(
        row.source_file_path
          ? buildStorageObjectRef("document-analysis-files", String(row.source_file_path))
          : row.source_file_url || "",
      );
      return buildLinkedEntry({
        folder: "Belgeler",
        companyId,
        name: `belge-analizi-kaynak-${String(row.id)}-${fileName}`,
        displayName: fileName,
        createdAt: String(row.created_at || ""),
        downloadUrl,
        sourceLabel: "Kaynak Belge",
        description: Boolean(row.archived_to_library)
          ? "Belge analizi kayna\u011f\u0131 (ar\u015fivlenmi\u015f)"
          : "Belge analizi kayna\u011f\u0131",
      });
    });

  const emergencyPlanEntries = (emergencyPlansResult.data || [])
    .filter((row: any) => row.pdf_url)
    .map((row: any) =>
      buildLinkedEntry({
        folder: "Belgeler",
        companyId,
        name: `acil-durum-eylem-plani-${row.id}.pdf`,
        displayName: `Acil Durum Eylem Plan\u0131 ${companyName}.pdf`,
        createdAt: row.created_at,
        downloadUrl: String(row.pdf_url),
        mimeType: "application/pdf",
        sourceLabel: "ADEP PDF",
        description: "ADEP PDF kayd\u0131",
      }),
    );

  const reportRows = [
    ...((reportsByCompanyIdResult.data || []) as LooseRow[]),
    ...((reportsByCompanyNameResult.data || []) as LooseRow[]),
  ].filter(
    (row, index, collection) =>
      collection.findIndex((candidate) => String(candidate.id) === String(row.id)) === index,
  );

  const reportEntries = reportRows
    .filter((row) => Boolean(row.file_url))
    .map((row) => {
      const exportFormat = String(row.export_format || "").toLowerCase();
      const extension = exportFormat === "docx" ? ".docx" : exportFormat === "pdf" ? ".pdf" : "";
      const rawTitle = String(row.title || "Rapor");
      const displayName = rawTitle.toLowerCase().endsWith(extension) || !extension ? rawTitle : `${rawTitle}${extension}`;
      const reportKind = String((row.content as Record<string, unknown> | null)?.report_kind || "");
      const sourceLabel =
        reportKind === "dof" || reportKind === "single_dof"
          ? "D\u00d6F Raporu"
          : exportFormat === "docx"
            ? "Word Rapor"
            : "PDF Rapor";

      return buildLinkedEntry({
        folder: "Belgeler",
        companyId,
        name: `rapor-${String(row.id)}${extension}`,
        displayName,
        createdAt: String(row.generated_at || ""),
        downloadUrl: String(row.file_url || ""),
        mimeType:
          exportFormat === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : exportFormat === "pdf"
              ? "application/pdf"
              : null,
        sourceLabel,
        description: "Sistemde saklanan rapor \u00e7\u0131kt\u0131s\u0131",
      });
    });

  return [...meetingEntries, ...analysisDocumentEntries, ...emergencyPlanEntries, ...reportEntries];
};

const buildPhotoEntries = async (companyId: string) => {
  const reportsResult = await db
    .from("incident_reports")
    .select("id, title, incident_type")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (reportsResult.error) throw reportsResult.error;

  const reports = ((reportsResult.data || []) as LooseRow[]).map((row) => ({
    id: String(row.id),
    title: String(row.title || row.incident_type || "Olay Kayd\u0131"),
  }));

  if (reports.length === 0) return [];

  const attachmentsResult = await db
    .from("incident_attachments")
    .select("id, report_id, file_name, file_path, file_size, mime_type, created_at")
    .in("report_id", reports.map((report) => report.id))
    .order("created_at", { ascending: false });

  if (attachmentsResult.error) throw attachmentsResult.error;

  const reportMap = new Map(reports.map((report) => [report.id, report.title]));

  return ((attachmentsResult.data || []) as LooseRow[])
    .filter((row) => isImageAttachment(String(row.file_name || ""), String(row.mime_type || "")))
    .map((row) =>
      buildLinkedEntry({
        folder: "Foto\u011Fraflar",
        companyId,
        name: String(row.file_name || row.id || "gorsel"),
        displayName: `${reportMap.get(String(row.report_id)) || "Olay"} - ${String(row.file_name || "G\u00f6rsel")}`,
        createdAt: String(row.created_at || ""),
        downloadUrl: buildStorageObjectRef("incident-files", String(row.file_path || "")),
        size: Number(row.file_size || 0),
        mimeType: String(row.mime_type || "image/*"),
        sourceLabel: "Olay Eki",
        description: "Olay / kaza kayd\u0131 eki",
      }),
    );
};

const buildCompanyArchiveDataset = async (companyId: string): Promise<CompanyArchiveDataset> => {
  const company = await fetchCompany(companyId);
  if (!company) {
    return {
      folders: {
        Analizler: [],
        Belgeler: [],
        "Foto\u011Fraflar": [],
        Bilgiler: [],
      },
    };
  }

  const [
    storedAnalyses,
    storedDocuments,
    storedPhotos,
    storedInfo,
    infoEntries,
    analysisEntries,
    documentEntries,
    photoEntries,
  ] = await Promise.all([
    listStoredFolderEntries(companyId, "Analizler"),
    listStoredFolderEntries(companyId, "Belgeler"),
    listStoredFolderEntries(companyId, "Foto\u011Fraflar"),
    listStoredFolderEntries(companyId, "Bilgiler"),
    buildInfoEntries(companyId),
    buildAnalysisEntries(companyId, company.name),
    buildDocumentEntries(companyId, company.name),
    buildPhotoEntries(companyId),
  ]);

  return {
    folders: {
      Analizler: sortEntries([...storedAnalyses, ...analysisEntries]),
      Belgeler: sortEntries([...storedDocuments, ...documentEntries]),
      "Foto\u011Fraflar": sortEntries([...storedPhotos, ...photoEntries]),
      Bilgiler: sortEntries([...storedInfo, ...infoEntries]),
    },
  };
};

const getCompanyArchiveDataset = async (companyId: string) => {
  const cached = archiveCache.get(companyId);
  if (cached) return cached;
  const dataset = await buildCompanyArchiveDataset(companyId);
  archiveCache.set(companyId, dataset);
  return dataset;
};

const invalidateCompanyArchiveCache = (companyId?: string) => {
  if (companyId) {
    archiveCache.delete(companyId);
    return;
  }
  archiveCache.clear();
};

const slicePage = (entries: CompanyArchiveFileEntry[], page: number): CompanyArchiveFolderPage => {
  const start = page * ARCHIVE_PAGE_SIZE;
  const visible = entries.slice(start, start + ARCHIVE_PAGE_SIZE);
  const hasMore = start + ARCHIVE_PAGE_SIZE < entries.length;
  return {
    files: visible,
    hasMore,
    nextPage: hasMore ? page + 1 : null,
  };
};

const downloadLinkedFile = async (entry: CompanyArchiveFileEntry) => {
  const resolvedUrl = await resolveStorageObjectUrl(entry.downloadUrl || null);
  const finalUrl = resolvedUrl || entry.downloadUrl;
  if (!finalUrl) throw new Error("Dosya ba\u011flant\u0131s\u0131 bulunamad\u0131.");

  try {
    const response = await fetch(finalUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    triggerBlobDownload(blob, entry.displayName);
  } catch {
    window.open(finalUrl, "_blank", "noopener,noreferrer");
  }
};

export async function ensureCompanyArchiveStructure(companyId: string) {
  void companyId;
  return;
}

export async function listCompanyArchiveFolders(companyId: string): Promise<CompanyArchiveFolderSummary[]> {
  const dataset = await getCompanyArchiveDataset(companyId);
  return COMPANY_ARCHIVE_FOLDERS.map((folder) => ({
    name: folder,
    path: getArchiveFolderPath(companyId, folder),
    fileCount: dataset.folders[folder].length,
  }));
}

export async function listCompanyArchiveFiles(
  companyId: string,
  folder: CompanyArchiveFolderName,
  page = 0,
): Promise<CompanyArchiveFolderPage> {
  const dataset = await getCompanyArchiveDataset(companyId);
  return slicePage(dataset.folders[folder], page);
}

export async function uploadCompanyArchiveFile(
  companyId: string,
  folder: CompanyArchiveFolderName,
  rawFile: File,
) {
  const safeOriginalName = sanitizeDownloadName(rawFile.name) || "dosya";
  const filePath = `${getArchiveFolderPath(companyId, folder)}/${Date.now()}__${safeOriginalName}`;
  await uploadFileOptimized(COMPANY_ARCHIVE_BUCKET, filePath, rawFile);
  invalidateCompanyArchiveCache(companyId);
}

export async function deleteCompanyArchiveFile(filePath: string) {
  const { error } = await supabase.storage.from(COMPANY_ARCHIVE_BUCKET).remove([filePath]);
  if (error) throw error;

  const match = filePath.match(/^firma-arsivi\/([^/]+)\//);
  invalidateCompanyArchiveCache(match?.[1]);
}

export async function downloadCompanyArchiveFile(entry: CompanyArchiveFileEntry) {
  if (entry.sourceType === "generated") {
    triggerBlobDownload(
      new Blob([entry.textContent || ""], { type: entry.mimeType || "text/plain;charset=utf-8" }),
      entry.displayName,
    );
    return;
  }

  if (entry.sourceType === "linked") {
    await downloadLinkedFile(entry);
    return;
  }

  const { data, error } = await supabase.storage.from(COMPANY_ARCHIVE_BUCKET).download(entry.path);
  if (error) throw error;
  triggerBlobDownload(data, entry.displayName);
}

export async function downloadCompanyArchiveFolderZip(
  companyId: string,
  companyName: string,
  folder: CompanyArchiveFolderName,
) {
  const zip = new JSZip();
  const dataset = await getCompanyArchiveDataset(companyId);
  const files = dataset.folders[folder];

  for (const file of files) {
    if (file.sourceType === "generated") {
      zip.file(`${folder}/${file.displayName}`, file.textContent || "");
      continue;
    }

    if (file.sourceType === "linked") {
      const resolvedUrl = await resolveStorageObjectUrl(file.downloadUrl || null);
      const response = await fetch(resolvedUrl || file.downloadUrl || "");
      if (!response.ok) continue;
      zip.file(`${folder}/${file.displayName}`, await response.arrayBuffer());
      continue;
    }

    const { data, error } = await supabase.storage.from(COMPANY_ARCHIVE_BUCKET).download(file.path);
    if (error) throw error;
    zip.file(`${folder}/${file.displayName}`, await data.arrayBuffer());
  }

  const output = await zip.generateAsync({ type: "blob" });
  triggerBlobDownload(output, `${sanitizeDownloadName(companyName)}-${folder}.zip`);
}

export async function downloadCompanyArchiveZip(companyId: string, companyName: string) {
  const zip = new JSZip();
  const dataset = await getCompanyArchiveDataset(companyId);

  for (const folder of COMPANY_ARCHIVE_FOLDERS) {
    for (const file of dataset.folders[folder]) {
      if (file.sourceType === "generated") {
        zip.file(`${folder}/${file.displayName}`, file.textContent || "");
        continue;
      }

      if (file.sourceType === "linked") {
        const resolvedUrl = await resolveStorageObjectUrl(file.downloadUrl || null);
        const response = await fetch(resolvedUrl || file.downloadUrl || "");
        if (!response.ok) continue;
        zip.file(`${folder}/${file.displayName}`, await response.arrayBuffer());
        continue;
      }

      const { data, error } = await supabase.storage.from(COMPANY_ARCHIVE_BUCKET).download(file.path);
      if (error) throw error;
      zip.file(`${folder}/${file.displayName}`, await data.arrayBuffer());
    }
  }

  const output = await zip.generateAsync({ type: "blob" });
  triggerBlobDownload(output, `${sanitizeDownloadName(companyName)}-firma-arsivi.zip`);
}
