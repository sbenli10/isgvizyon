import { supabase } from "@/integrations/supabase/client";

interface NaceCSVRow {
  nace_code: string;
  nace_title: string;
  hazard_class: string;
  sector: string;
}

export async function importNaceCodesFromCSV(csvContent: string): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const lines = csvContent.split("\n");
  const headers = lines[0].split(",");

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(",");
    const row: NaceCSVRow = {
      nace_code: values[0]?.trim() || "",
      nace_title: values[1]?.trim() || "",
      hazard_class: values[2]?.trim() || "",
      sector: values[3]?.trim() || "",
    };

    try {
      const { error } = await supabase.from("nace_codes").insert(row);

      if (error) {
        failed++;
        errors.push(`Row ${i}: ${error.message}`);
      } else {
        success++;
      }
    } catch (err) {
      failed++;
      errors.push(`Row ${i}: ${err}`);
    }
  }

  return { success, failed, errors };
}