import { supabase } from "@/integrations/supabase/client";
import { buildStorageObjectRef, parseStorageObjectRef } from "@/lib/storageObject";

const BUCKET_NAME = "inspection-photos";

export async function uploadInspectionPhoto(file: File, userId: string): Promise<string | null> {
  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    return buildStorageObjectRef(BUCKET_NAME, fileName);
  } catch (error) {
    console.error("Upload error:", error);
    return null;
  }
}

export async function deleteInspectionPhoto(photoUrl: string): Promise<boolean> {
  try {
    const storageRef = parseStorageObjectRef(photoUrl, BUCKET_NAME);
    if (!storageRef || storageRef.bucket !== BUCKET_NAME) return false;

    const { error } = await supabase.storage.from(BUCKET_NAME).remove([storageRef.path]);
    return !error;
  } catch (error) {
    console.error("Delete error:", error);
    return false;
  }
}
