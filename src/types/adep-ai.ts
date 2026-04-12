// src/types/adep-ai.ts

export type ADEPModule = 
  | "scenario"
  | "preventive"
  | "equipment"
  | "drill"
  | "checklist"
  | "raci"
  | "legal"
  | "risk";

export interface ADEPRequesFtBody {
  planId: string;
  module: ADEPModule;
}

export interface ADEPAIResponse {
  success: boolean;
  insertedCount: number;
  module: ADEPModule;
  metadata?: {
    model: string;
    processingTimeMs: number;
  };
  error?: string;
}

// Preventive Measures
export interface PreventiveMeasure {
  id: string;
  plan_id: string;
  risk_type: string;
  preventive_action: string;
  responsible_role: string;
  control_period: string;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}

// Equipment Inventory
export interface EquipmentItem {
  id: string;
  plan_id: string;
  equipment_name: string;
  equipment_type: string;
  quantity: number;
  location: string;
  last_inspection_date: string | null;
  next_inspection_date: string | null;
  status: 'active' | 'maintenance' | 'retired';
  responsible_person: string | null;
  created_at: string;
  updated_at: string;
}

// Drills
export interface Drill {
  id: string;
  plan_id: string;
  drill_type: string;
  drill_date: string;
  participants_count: number | null;
  duration_minutes: number | null;
  scenario_tested: string;
  success_rate: string | null;
  observations: string | null;
  action_items: string | null;
  next_drill_date: string | null;
  created_at: string;
  updated_at: string;
}

// Checklists
export interface Checklist {
  id: string;
  plan_id: string;
  checklist_category: string;
  checklist_item: string;
  check_frequency: string;
  responsible_role: string;
  last_checked_date: string | null;
  next_check_date: string | null;
  status: 'pending' | 'checked' | 'issue_found';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// RACI Matrix
export interface RACIItem {
  id: string;
  plan_id: string;
  task_name: string;
  responsible: string | null;
  accountable: string | null;
  consulted: string | null;
  informed: string | null;
  task_category: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
}

// Legal References
export interface LegalReference {
  id: string;
  plan_id: string;
  law_name: string;
  article_number: string | null;
  requirement_summary: string;
  compliance_status: 'compliant' | 'partial' | 'non_compliant';
  responsible_person: string | null;
  review_date: string | null;
  created_at: string;
  updated_at: string;
}

// Risk Sources
export interface RiskSource {
  id: string;
  plan_id: string;
  risk_source: string;
  location: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  potential_impact: string;
  mitigation_measures: string | null;
  monitoring_frequency: string | null;
  last_assessment_date: string | null;
  created_at: string;
  updated_at: string;
}