import { supabase } from "@/integrations/supabase/client";

interface EdgeFunctionFailure {
  success?: false;
  error?: {
    code?: string;
    message?: string;
    details?: string;
  };
}

export async function invokeEdgeFunction<TResponse, TBody extends object = Record<string, unknown>>(
  name: string,
  body: TBody,
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
    const code = payload.error?.code ? `[${payload.error.code}] ` : "";
    const details = payload.error?.details ? ` ${payload.error.details}` : "";
    throw new Error(`${code}${payload.error?.message || "Sunucu tarafi AI istegi basarisiz oldu."}${details}`.trim());
  }

  return payload as TResponse;
}
