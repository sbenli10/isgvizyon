import { supabase } from "@/integrations/supabase/client";
import { optimizeImage } from "./fileOptimizer";

/**
 * Supabase Storage'a dosya yükleyen merkezi fonksiyon.
 * Resimleri otomatik sıkıştırır, PDF vb. dosyaları olduğu gibi yükler.
 */
export const uploadFileOptimized = async (
  bucket: string, 
  filePath: string, 
  rawFile: File
): Promise<string> => {
  
  // 1. Tünele giren dosyayı optimize et (Sadece resimse küçülür, değilse aynı kalır)
  const fileToUpload = await optimizeImage(rawFile);

  // 2. Supabase Storage'a gönder
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, fileToUpload, { upsert: true });

  if (error) {
    console.error("Supabase yükleme hatası:", error);
    throw error;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  
  return data.publicUrl;
};