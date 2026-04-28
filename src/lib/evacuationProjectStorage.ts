export interface SavedEvacuationProject {
  id: string;
  project_name: string;
  canvas_json: string;
  created_at: string;
  thumbnail_data_url?: string;
}

export const EVACUATION_PROJECTS_STORAGE_KEY = "evacuation-editor-projects";

export const loadSavedEvacuationProjects = (): SavedEvacuationProject[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(EVACUATION_PROJECTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is SavedEvacuationProject =>
          Boolean(item) &&
          typeof item.id === "string" &&
          typeof item.project_name === "string" &&
          typeof item.canvas_json === "string" &&
          typeof item.created_at === "string",
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  } catch (error) {
    console.error("Kayıtlı kroki projeleri okunamadı:", error);
    return [];
  }
};
