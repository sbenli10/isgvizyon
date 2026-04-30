import { supabase } from "@/integrations/supabase/client";

const STORAGE_REF_PREFIX = "storage://";

export interface StorageObjectRef {
  bucket: string;
  path: string;
}

const encodePath = (value: string) =>
  value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

export const buildStorageObjectRef = (bucket: string, path: string) =>
  `${STORAGE_REF_PREFIX}${encodeURIComponent(bucket)}/${encodePath(path)}`;

export const parseStorageObjectRef = (
  value?: string | null,
  fallbackBucket?: string | null,
): StorageObjectRef | null => {
  if (!value) return null;

  if (value.startsWith(STORAGE_REF_PREFIX)) {
    const rawRef = value.slice(STORAGE_REF_PREFIX.length);
    const slashIndex = rawRef.indexOf("/");
    if (slashIndex === -1) return null;

    return {
      bucket: decodeURIComponent(rawRef.slice(0, slashIndex)),
      path: decodeURIComponent(rawRef.slice(slashIndex + 1)),
    };
  }

  try {
    const parsedUrl = new URL(value);
    const match = parsedUrl.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/i);
    if (!match) return null;

    return {
      bucket: decodeURIComponent(match[1]),
      path: decodeURIComponent(match[2]),
    };
  } catch {
    if (!/^https?:\/\//i.test(value) && !value.startsWith("data:") && !value.startsWith("blob:") && fallbackBucket) {
      return { bucket: fallbackBucket, path: value };
    }
    return null;
  }
};

export const resolveStorageObjectUrl = async (
  value?: string | null,
  options?: {
    bucket?: string | null;
    expiresIn?: number;
  },
) => {
  if (!value) return value ?? null;
  if (value.startsWith("data:") || value.startsWith("blob:")) return value;

  const ref = parseStorageObjectRef(value, options?.bucket);
  if (!ref) return value;

  const { data, error } = await supabase.storage
    .from(ref.bucket)
    .createSignedUrl(ref.path, options?.expiresIn ?? 60 * 60);

  if (error || !data?.signedUrl) {
    return value;
  }

  return data.signedUrl;
};

export const resolveStorageObjectUrls = async (
  values: Array<string | null | undefined>,
  options?: {
    bucket?: string | null;
    expiresIn?: number;
  },
) => Promise.all(values.map((value) => resolveStorageObjectUrl(value, options)));
