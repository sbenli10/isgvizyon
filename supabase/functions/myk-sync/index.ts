import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SOURCE_URL = "https://portal.myk.gov.tr/index.php?option=com_yeterlilik&view=arama&belge_zorunlu=1";

type MykRecord = {
  profession_name: string;
  normalized_profession_name: string;
  qualification_codes: string[];
  obligation_date: string;
  source_url: string;
  source_hash: string;
  is_active: boolean;
  last_seen_at: string;
};

function decodeHtml(input: string) {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function cleanText(input: string) {
  return decodeHtml(
    input
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeProfession(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function extractCodes(value: string) {
  return Array.from(new Set(value.match(/\b\d{2}[A-Z]{2}\d{4}-\d\b/g) || []));
}

function extractDate(value: string) {
  const match = value.match(
    /\b\d{1,2}\s+(?:Ocak|Şubat|Subat|Mart|Nisan|Mayıs|Mayis|Haziran|Temmuz|Ağustos|Agustos|Eylül|Eylul|Ekim|Kasım|Kasim|Aralık|Aralik)\s+\d{4}\b/i,
  );

  return (
    match?.[0]
      ?.replace("Subat", "Şubat")
      .replace("Mayis", "Mayıs")
      .replace("Agustos", "Ağustos")
      .replace("Eylul", "Eylül")
      .replace("Kasim", "Kasım")
      .replace("Aralik", "Aralık") || ""
  );
}

function guessProfession(cells: string[], rowText: string, codes: string[], date: string) {
  const codeSet = new Set(codes);
  const candidate = cells.find((cell) => {
    const hasCode = extractCodes(cell).some((code) => codeSet.has(code));
    return !hasCode && cell !== date && cell.length > 2 && !/belge|zorunluluk|tarih|kod/i.test(cell);
  });

  if (candidate) return candidate;

  let cleaned = rowText;
  codes.forEach((code) => {
    cleaned = cleaned.replace(code, " ");
  });
  if (date) cleaned = cleaned.replace(date, " ");
  return cleaned
    .replace(/Belge Zorunluluk Tarihi/gi, " ")
    .replace(/Yeterlilik Kodları/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function parseMykHtml(html: string): Promise<MykRecord[]> {
  const rows = Array.from(html.matchAll(/<tr[\s\S]*?<\/tr>/gi)).map((match) => match[0]);
  const parsed: MykRecord[] = [];
  const seen = new Set<string>();
  const now = new Date().toISOString();

  for (const row of rows) {
    const cells = Array.from(row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((match) => cleanText(match[1]));
    const rowText = cleanText(row);
    const codes = extractCodes(rowText);
    if (!codes.length) continue;

    const obligationDate = extractDate(rowText);
    const profession = guessProfession(cells, rowText, codes, obligationDate);
    if (!profession || profession.length < 3) continue;

    const normalized = normalizeProfession(profession);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    parsed.push({
      profession_name: profession,
      normalized_profession_name: normalized,
      qualification_codes: codes,
      obligation_date: obligationDate,
      source_url: SOURCE_URL,
      source_hash: await sha256(`${normalized}|${codes.join(",")}|${obligationDate}`),
      is_active: true,
      last_seen_at: now,
    });
  }

  return parsed;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const startedAt = new Date().toISOString();
  const { data: log } = await supabase
    .from("myk_sync_logs")
    .insert({ source_url: SOURCE_URL, status: "running", started_at: startedAt })
    .select("id")
    .single();

  try {
    const response = await fetch(SOURCE_URL, {
      headers: {
        "User-Agent": "ISGVizyon MYK Sync/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      throw new Error(`MYK portalı ${response.status} durum kodu döndürdü.`);
    }

    const html = await response.text();
    const rows = await parseMykHtml(html);

    if (!rows.length) {
      throw new Error("MYK portalından okunabilir kayıt bulunamadı.");
    }

    const { data: existing } = await supabase
      .from("myk_mandatory_qualifications")
      .select("normalized_profession_name, source_hash");

    const existingMap = new Map((existing || []).map((item: any) => [item.normalized_profession_name, item.source_hash]));
    const insertedCount = rows.filter((row) => !existingMap.has(row.normalized_profession_name)).length;
    const updatedCount = rows.filter(
      (row) => existingMap.has(row.normalized_profession_name) && existingMap.get(row.normalized_profession_name) !== row.source_hash,
    ).length;

    const { error: upsertError } = await supabase
      .from("myk_mandatory_qualifications")
      .upsert(rows, { onConflict: "normalized_profession_name" });

    if (upsertError) throw upsertError;

    if (log?.id) {
      await supabase
        .from("myk_sync_logs")
        .update({
          status: "success",
          fetched_count: rows.length,
          inserted_count: insertedCount,
          updated_count: updatedCount,
          finished_at: new Date().toISOString(),
        })
        .eq("id", log.id);
    }

    return jsonResponse(200, {
      success: true,
      fetchedCount: rows.length,
      insertedCount,
      updatedCount,
      sourceUrl: SOURCE_URL,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MYK senkronizasyonu tamamlanamadı.";
    if (log?.id) {
      await supabase
        .from("myk_sync_logs")
        .update({ status: "error", error_message: message, finished_at: new Date().toISOString() })
        .eq("id", log.id);
    }

    return jsonResponse(500, {
      success: false,
      error: message,
      sourceUrl: SOURCE_URL,
    });
  }
});
