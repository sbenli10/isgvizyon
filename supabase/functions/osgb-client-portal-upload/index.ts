import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });

const sanitizeName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const formData = await req.formData();
    const token = String(formData.get("token") || "");
    const note = String(formData.get("note") || "") || null;
    const submittedByName = String(formData.get("submittedByName") || "") || null;
    const submittedByEmail = String(formData.get("submittedByEmail") || "") || null;
    const requiredDocumentId = String(formData.get("requiredDocumentId") || "") || null;
    const file = formData.get("file");

    if (!token || !(file instanceof File)) {
      return jsonResponse(400, { success: false, error: "token ve file zorunlu." });
    }

    const { data: link, error: linkError } = await supabase
      .from("osgb_client_portal_links")
      .select("id, organization_id, company_id, portal_status, expires_at")
      .eq("access_token", token)
      .eq("portal_status", "active")
      .maybeSingle();

    if (linkError) throw linkError;
    if (!link) {
      return jsonResponse(404, { success: false, error: "Portal linki bulunamadi veya pasif." });
    }
    if (link.expires_at && new Date(link.expires_at) <= new Date()) {
      return jsonResponse(400, { success: false, error: "Portal linkinin suresi dolmus." });
    }

    if (requiredDocumentId) {
      const { data: requiredDocument, error: documentError } = await supabase
        .from("osgb_required_documents")
        .select("id")
        .eq("organization_id", link.organization_id)
        .eq("company_id", link.company_id)
        .eq("id", requiredDocumentId)
        .maybeSingle();

      if (documentError) throw documentError;
      if (!requiredDocument) {
        return jsonResponse(400, { success: false, error: "Secilen evrak bu firma ile eslesmiyor." });
      }
    }

    const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const safeName = sanitizeName(file.name.replace(/\.[^.]+$/, ""));
    const storagePath = `${link.organization_id}/${link.company_id}/${Date.now()}-${safeName}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("osgb-client-portal")
      .upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: uploadRecord, error: insertError } = await supabase
      .from("osgb_client_portal_uploads")
      .insert({
        organization_id: link.organization_id,
        portal_link_id: link.id,
        company_id: link.company_id,
        required_document_id: requiredDocumentId,
        file_name: file.name,
        file_path: storagePath,
        mime_type: file.type || null,
        file_size: file.size,
        note,
        submitted_by_name: submittedByName,
        submitted_by_email: submittedByEmail,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    if (requiredDocumentId) {
      const { error: documentUpdateError } = await supabase
        .from("osgb_required_documents")
        .update({
          status: "submitted",
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", link.organization_id)
        .eq("company_id", link.company_id)
        .eq("id", requiredDocumentId);

      if (documentUpdateError) throw documentUpdateError;
    }

    return jsonResponse(200, {
      success: true,
      uploadId: uploadRecord.id,
      fileName: file.name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse(500, { success: false, error: message });
  }
});
