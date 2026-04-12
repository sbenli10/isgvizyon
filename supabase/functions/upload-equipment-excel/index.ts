// supabase/functions/upload-equipment-excel/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EquipmentRow {
  equipment_name: string;
  equipment_type: string;
  quantity: number;
  location: string;
  next_inspection_date: string | null;
  status: string;
  responsible_person: string | null;
}

/* ----------------------------
   🔧 Helpers
-----------------------------*/

const VALID_TYPES = ["Yangın", "İlk Yardım", "Tahliye", "Koruma"];
const VALID_STATUS = ["active", "maintenance", "retired"];

const sanitizeString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const excelSerialToISO = (serial: number): string => {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const date = new Date(utcValue * 1000);
  return date.toISOString().split("T")[0];
};

const normalizeDate = (value: unknown): string | null => {
  if (!value) return null;

  if (typeof value === "number") {
    return excelSerialToISO(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  }

  return null;
};

/* ----------------------------
   🚀 Edge Function
-----------------------------*/

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("📥 Request received");

  try {
    const body = await req.json();
    const { planId, equipment } = body;

    if (!planId) throw new Error("Missing planId");
    if (!Array.isArray(equipment) || equipment.length === 0)
      throw new Error("Invalid equipment array");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    /* ----------------------------
       ✅ Plan Exists Check
    -----------------------------*/
    const { data: planData, error: planError } = await supabase
      .from("adep_plans")
      .select("id")
      .eq("id", planId)
      .single();

    if (planError || !planData) {
      throw new Error("Plan not found");
    }

    console.log("✅ Plan validated");

    /* ----------------------------
       🔎 Validation & Normalize
    -----------------------------*/

    const validated: Array<EquipmentRow & { plan_id: string }> = [];
    const errors: string[] = [];

    for (let i = 0; i < equipment.length; i++) {
      const row = equipment[i];
      const rowNum = i + 1;
      const rowErrors: string[] = [];

      const equipmentName = sanitizeString(row.equipment_name);
      const location = sanitizeString(row.location);
      const responsible = sanitizeString(row.responsible_person);
      const type = sanitizeString(row.equipment_type);
      const status = sanitizeString(row.status) || "active";
      const quantity = Number(row.quantity);
      const nextInspection = normalizeDate(row.next_inspection_date);

      if (!equipmentName)
        rowErrors.push(`Row ${rowNum}: equipment_name required`);

      if (!location)
        rowErrors.push(`Row ${rowNum}: location required`);

      if (!VALID_TYPES.includes(type || ""))
        rowErrors.push(`Row ${rowNum}: invalid equipment_type`);

      if (!VALID_STATUS.includes(status))
        rowErrors.push(`Row ${rowNum}: invalid status`);

      if (isNaN(quantity) || quantity < 1)
        rowErrors.push(`Row ${rowNum}: quantity must be >= 1`);

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }

      validated.push({
        plan_id: planId,
        equipment_name: equipmentName!,
        equipment_type: type!,
        quantity,
        location: location!,
        next_inspection_date: nextInspection,
        status,
        responsible_person: responsible,
      });
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Validation failed",
          details: errors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`✅ Validated ${validated.length} rows`);

    /* ----------------------------
       🔁 Duplicate Protection
       equipment_name + location + plan_id
    -----------------------------*/

    for (const row of validated) {
      const { data: existing } = await supabase
        .from("adep_equipment_inventory")
        .select("id")
        .eq("plan_id", planId)
        .eq("equipment_name", row.equipment_name)
        .eq("location", row.location)
        .maybeSingle();

      if (existing) {
        throw new Error(
          `Duplicate found: ${row.equipment_name} - ${row.location}`
        );
      }
    }

    /* ----------------------------
       📦 Batch Insert
    -----------------------------*/

    const chunkSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < validated.length; i += chunkSize) {
      const chunk = validated.slice(i, i + chunkSize);

      const { data, error } = await supabase
        .from("adep_equipment_inventory")
        .insert(chunk)
        .select();

      if (error) {
        throw new Error(`Insert failed: ${error.message}`);
      }

      totalInserted += data.length;
    }

    console.log(`🎉 Inserted ${totalInserted} items`);

    return new Response(
      JSON.stringify({
        success: true,
        insertedCount: totalInserted,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("💥 Error:", error.message);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

console.log("🟢 upload-equipment-excel secure version ready");