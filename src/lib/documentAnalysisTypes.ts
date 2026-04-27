export type DocumentAnalysisType =
  | "legislation"
  | "internal_procedure"
  | "technical_instruction"
  | "official_letter"
  | "contractual_obligation";

export interface DocumentAnalysisObligation {
  title: string;
  description: string;
  legalBasis?: string;
  priority: "low" | "medium" | "high" | "critical";
}

export interface DocumentAnalysisCriticalPoint {
  title: string;
  description: string;
  whyItMatters?: string;
}

export interface DocumentAnalysisActionItem {
  title: string;
  description: string;
  urgency: "low" | "medium" | "high" | "critical";
  suggestedModule: "capa" | "inspection" | "archive" | "report";
}

export interface DocumentAnalysisRiskNote {
  title: string;
  description: string;
}

export interface DocumentAnalysisResult {
  summary: string;
  keyObligations: DocumentAnalysisObligation[];
  criticalPoints: DocumentAnalysisCriticalPoint[];
  actionItems: DocumentAnalysisActionItem[];
  riskNotes: DocumentAnalysisRiskNote[];
}

export interface DocumentAnalysisRecord extends DocumentAnalysisResult {
  id: string;
  user_id: string;
  org_id: string | null;
  company_id: string | null;
  company_name: string | null;
  title: string;
  document_type: DocumentAnalysisType;
  source_file_name: string;
  source_file_url: string | null;
  source_file_path: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  raw_text: string | null;
  archived_to_library: boolean;
  last_exported_at: string | null;
  status: "draft" | "processing" | "completed" | "archived" | "failed";
  created_at: string;
  updated_at: string;
}

export const documentTypeOptions: Array<{ value: DocumentAnalysisType; label: string }> = [
  { value: "legislation", label: "Mevzuat" },
  { value: "internal_procedure", label: "İç prosedür" },
  { value: "technical_instruction", label: "Teknik talimat" },
  { value: "official_letter", label: "Denetim / resmî yazı" },
  { value: "contractual_obligation", label: "Sözleşme / yükümlülük dokümanı" },
];

export const urgencyLabelMap: Record<DocumentAnalysisActionItem["urgency"], string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  critical: "Kritik",
};

export const priorityLabelMap: Record<DocumentAnalysisObligation["priority"], string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  critical: "Kritik",
};
