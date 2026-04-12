export interface Company {
  id: string;
  owner_id: string;
  company_name: string;
  tax_number: string;
  nace_code: string;
  hazard_class: "Az Tehlikeli" | "Tehlikeli" | "Çok Tehlikeli";
  industry_sector?: string;
  address?: string;
  city?: string;
  district?: string;
  postal_code?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  employee_count: number;
  workplace_registration_number?: string;
  sgk_workplace_number?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface Employee {
  id: string;
  company_id: string;
  tc_number?: string;
  first_name: string;
  last_name: string;
  birth_date?: string;
  gender?: "Erkek" | "Kadın" | "Diğer";
  email?: string;
  phone?: string;
  address?: string;
  job_title: string;
  department?: string;
  start_date: string;
  end_date?: string;
  employment_type?: "Süresiz" | "Süreli" | "Stajyer" | "Part-Time";
  education_level?: string;
  certifications?: any[];
  blood_type?: string;
  chronic_diseases?: string[];
  allergies?: string[];
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface RiskTemplate {
  id: string;
  template_name: string;
  industry_sector: string;
  description: string;
  risk_items: RiskItem[];
  created_at: string;
}

export interface RiskItem {
  description: string;
  category: string;
  probability: number;
  frequency: number;
  severity: number;
}

export interface CompanyRisk {
  id: string;
  company_id: string;
  risk_description: string;
  risk_category: string;
  hazard_source?: string;
  probability: number;
  frequency: number;
  severity: number;
  risk_score?: number;
  risk_level?: string;
  preventive_measures?: string[];
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}
