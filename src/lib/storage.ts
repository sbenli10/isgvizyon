import { supabase } from "@/integrations/supabase/client";

const BUCKET_NAME = "inspection-photos";

export async function ensureBucketExists() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

  if (!bucketExists) {
    await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 5242880,
    });
  }
}

export async function uploadInspectionPhoto(file: File, userId: string): Promise<string | null> {
  try {
    await ensureBucketExists();

    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    return data.publicUrl;
  } catch (error) {
    console.error("Upload error:", error);
    return null;
  }
}

export async function deleteInspectionPhoto(photoUrl: string): Promise<boolean> {
  try {
    const fileName = photoUrl.split(`${BUCKET_NAME}/`)[1];
    if (!fileName) return false;

    const { error } = await supabase.storage.from(BUCKET_NAME).remove([fileName]);
    return !error;
  } catch (error) {
    console.error("Delete error:", error);
    return false;
  }
}
