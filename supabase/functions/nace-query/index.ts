// ====================================================
// NACE QUERY EDGE FUNCTION - FIXED
// ====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NaceQueryRequest {
  nace: string;
}

interface NaceQueryResponse {
  success: boolean;
  data?: {
    nace_code: string;
    nace_title: string;
    hazard_class: string;
    sector: string;
  };
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request
    const { nace }: NaceQueryRequest = await req.json();

    if (!nace) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "NACE code is required",
        } as NaceQueryResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Normalize NACE code (remove dots, whitespace)
    const normalizedNace = nace.replace(/[\s.]/g, "");

    // Query database
    const { data, error } = await supabaseClient
      .from("nace_codes")
      .select("nace_code, nace_title, hazard_class, sector")
      .or(
        `nace_code.eq.${nace},nace_code.eq.${normalizedNace},nace_code.ilike.${nace}%`
      )
      .limit(1)
      .single();

    if (error) {
      console.error("Database error:", error);

      return new Response(
        JSON.stringify({
          success: false,
          error: "NACE code not found",
        } as NaceQueryResponse),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Return result
    return new Response(
      JSON.stringify({
        success: true,
        data,
      } as NaceQueryResponse),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    // ✅ FIXED: Proper error type handling
    console.error("Function error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      } as NaceQueryResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});