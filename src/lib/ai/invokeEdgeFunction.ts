import { supabase } from "@/integrations/supabase/client";

interface EdgeFunctionFailure {
  success?: false;
  error?: {
    code?: string;
    message?: string;
    details?: string;
  };
}

export async function invokeEdgeFunction<TResponse>(
  name: string,
  body: Record<string, unknown>,
): Promise<TResponse> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    throw new Error(error.message || "Edge function cagrisi basarisiz oldu.");
  }

  const payload = (data ?? null) as (TResponse & EdgeFunctionFailure) | null;
  if (!payload) {
    throw new Error("Bos yanit alindi.");
  }

  if (payload.success === false) {
    throw new Error(payload.error?.message || "Sunucu tarafi AI istegi basarisiz oldu.");
  }

  return payload as TResponse;
}
