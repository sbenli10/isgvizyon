import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export const MYK_SOURCE_URL = "https://portal.myk.gov.tr/index.php?option=com_yeterlilik&view=arama&belge_zorunlu=1";

export interface MykMandatoryQualification {
  id: string;
  professionName: string;
  normalizedProfessionName: string;
  qualificationCodes: string[];
  obligationDate: string;
  sourceUrl: string;
  isActive: boolean;
  lastSeenAt: string;
  updatedAt: string;
}

export interface MykSyncLog {
  id: string;
  sourceUrl: string;
  status: string;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
}

function mapQualification(row: any): MykMandatoryQualification {
  return {
    id: row.id,
    professionName: row.profession_name || "",
    normalizedProfessionName: row.normalized_profession_name || "",
    qualificationCodes: Array.isArray(row.qualification_codes) ? row.qualification_codes : [],
    obligationDate: row.obligation_date || "",
    sourceUrl: row.source_url || MYK_SOURCE_URL,
    isActive: Boolean(row.is_active),
    lastSeenAt: row.last_seen_at || row.updated_at || "",
    updatedAt: row.updated_at || "",
  };
}

function mapSyncLog(row: any): MykSyncLog {
  return {
    id: row.id,
    sourceUrl: row.source_url || MYK_SOURCE_URL,
    status: row.status || "",
    fetchedCount: Number(row.fetched_count || 0),
    insertedCount: Number(row.inserted_count || 0),
    updatedCount: Number(row.updated_count || 0),
    errorMessage: row.error_message || null,
    startedAt: row.started_at || "",
    finishedAt: row.finished_at || null,
  };
}

export async function loadMykMandatoryQualifications() {
  const { data, error } = await db
    .from("myk_mandatory_qualifications")
    .select("*")
    .eq("is_active", true)
    .order("normalized_profession_name", { ascending: true });

  if (error) throw error;
  return (data || []).map(mapQualification) as MykMandatoryQualification[];
}

export async function loadLatestMykSyncLog() {
  const { data, error } = await db
    .from("myk_sync_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapSyncLog(data) : null;
}

export async function syncMykMandatoryQualifications() {
  const { data, error } = await supabase.functions.invoke("myk-sync", { body: {} });
  if (error) throw error;
  return data as {
    success: boolean;
    fetchedCount?: number;
    insertedCount?: number;
    updatedCount?: number;
    error?: string;
    sourceUrl?: string;
  };
}

export function filterMykQualifications(records: MykMandatoryQualification[], query: string, profession: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
  const normalizedProfession = profession && profession !== "all" ? profession : "";

  return records.filter((record) => {
    const matchesProfession = normalizedProfession ? record.normalizedProfessionName === normalizedProfession : true;
    if (!matchesProfession) return false;
    if (!normalizedQuery) return true;

    return (
      record.professionName.toLocaleLowerCase("tr-TR").includes(normalizedQuery) ||
      record.qualificationCodes.some((code) => code.toLocaleLowerCase("tr-TR").includes(normalizedQuery))
    );
  });
}
