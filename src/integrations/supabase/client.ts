import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  clearSupabaseIncident,
  isSupabaseNetworkFailure,
  isSupabaseServiceError,
  isSupabaseUrl,
  reportSupabaseIncident,
} from "@/lib/supabaseServiceHealth";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

const nativeFetch = (...args: Parameters<typeof fetch>) => fetch(...args);

const instrumentedSupabaseFetch: typeof fetch = async (input, init) => {
  const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const isSupabaseRequest = isSupabaseUrl(requestUrl);

  try {
    const response = await nativeFetch(input, init);

    if (isSupabaseRequest) {
      if (isSupabaseServiceError(response.status)) {
        reportSupabaseIncident({
          source: requestUrl,
          statusCode: response.status,
          description: `Supabase servisi ${response.status} durum kodu ile yanıt verdi.`,
        });
      } else if (response.ok || response.status === 401 || response.status === 403 || response.status === 404) {
        clearSupabaseIncident();
      }
    }

    return response;
  } catch (error) {
    if (isSupabaseRequest && isSupabaseNetworkFailure(error)) {
      reportSupabaseIncident({
        source: requestUrl,
        description:
          "Supabase isteği ağ seviyesinde yanıt vermedi. Bu durum genellikle geçici servis kesintisi, auth yenileme sorunu veya backend gateway hatasında görülür.",
      });
    }
    throw error;
  }
};

const clientOptions = {
  global: {
    fetch: instrumentedSupabaseFetch,
  },
};

export const createClient = () => {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, clientOptions);
};

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, clientOptions);
