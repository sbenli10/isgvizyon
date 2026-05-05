import { supabase } from "@/integrations/supabase/client";
import { buildStorageObjectRef, parseStorageObjectRef } from "@/lib/storageObject";
import { uploadFileOptimized } from "@/lib/storageHelper";

const BUCKET_NAME = "inspection-photos";

export async function uploadInspectionPhoto(file: File, userId: string): Promise<string | null> {
  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    await uploadFileOptimized(BUCKET_NAME, fileName, file);

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
