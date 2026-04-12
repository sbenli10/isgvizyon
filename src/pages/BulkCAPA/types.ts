// BulkCAPA Type Definitions

export interface HazardEntry {
  id: string;
  description: string;
  riskDefinition: string;
  correctiveAction: string;
  preventiveAction: string;
  importance_level: "Düşük" | "Orta" | "Yüksek" | "Kritik";
  termin_date: string;
  related_department: string;
  notification_method: string;
  responsible_name: string;
  responsible_role: string;
  approver_name: string;
  approver_title: string;
  include_stamp: boolean;
  media_urls: string[];
  ai_analyzed: boolean;
}

export interface BulkCAPAGeneralInfo {
  company_name: string;
  company_logo_url: string | null;
  provider_logo_url: string | null;
  area_region: string;
  observation_range: string;
  report_date: string;
  observer_name: string;
  observer_certificate_no: string;
  responsible_person: string;
  employer_representative_title: string;
  employer_representative_name: string;
  report_no: string;
}

export interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
}

export interface CompanyOption {
  id: string;
  name: string;
  industry?: string | null;
  employee_count?: number | null;
  notes?: string | null;
  logo_url?: string | null;
}

export interface HistoricalFinding {
  id: string;
  inspection_id: string;
  location_name: string;
  description: string;
  risk_definition: string;
  corrective_action: string;
  preventive_action: string;
  priority: HazardEntry["importance_level"];
  due_date: string | null;
  created_at: string;
  is_resolved: boolean;
  assigned_to: string | null;
  similarity: number;
  source: "inspection" | "bulk_session";
}

export interface BulkSessionHistoryRow {
  id: string;
  company_name: string | null;
  area_region: string | null;
  department_name: string | null;
  report_date: string | null;
  updated_at: string | null;
}

export interface BulkEntryHistoryRow {
  id: string;
  session_id: string;
  description: string | null;
  risk_definition: string | null;
  corrective_action: string | null;
  preventive_action: string | null;
  priority: string | null;
  due_date: string | null;
  responsible_name: string | null;
  responsible_role: string | null;
  created_at: string | null;
}

export interface BulkCAPATemplate {
  id: string;
  name: string;
  payload: any;
  created_at?: string | null;
}

export interface AIAnalysisResult {
  description: string;
  riskDefinition: string;
  correctiveAction: string;
  preventiveAction: string;
  importance_level: "Düşük" | "Orta" | "Yüksek" | "Kritik";
}

export interface ProfileContext {
  full_name: string | null;
  position: string | null;
  avatar_url: string | null;
  stamp_url: string | null;
}
