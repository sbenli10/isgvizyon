import { supabase } from "@/integrations/supabase/client";
import { optimizeImage } from "./fileOptimizer";

/**
 * Supabase Storage'a dosya yükleyen merkezi fonksiyon.
 * Resimleri otomatik sıkıştırır, PDF vb. dosyaları olduğu gibi yükler.
 */
export const uploadFileOptimized = async (
  bucket: string,
  filePath: string,
  rawFile: File,
): Promise<string> => {
  const fileToUpload = await optimizeImage(rawFile);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, fileToUpload, { upsert: true });

  if (error) {
    console.error("Supabase yükleme hatası:", error);
    throw error;
  }

  // Private bucket'larda public URL dönmek yanlış olur.
  // Bu durumda storage path'i döndürüp signed URL üretimini ayrı akışa bırakıyoruz.
  if (bucket === "certificate-files") {
    return filePath;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
};
