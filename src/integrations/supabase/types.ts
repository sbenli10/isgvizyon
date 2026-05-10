export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      adep_checklists: {
        Row: {
          check_frequency: string
          checklist_category: string
          checklist_item: string
          created_at: string | null
          id: string
          last_checked_date: string | null
          next_check_date: string | null
          notes: string | null
          plan_id: string
          responsible_role: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          check_frequency: string
          checklist_category: string
          checklist_item: string
          created_at?: string | null
          id?: string
          last_checked_date?: string | null
          next_check_date?: string | null
          notes?: string | null
          plan_id: string
          responsible_role: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          check_frequency?: string
          checklist_category?: string
          checklist_item?: string
          created_at?: string | null
          id?: string
          last_checked_date?: string | null
          next_check_date?: string | null
          notes?: string | null
          plan_id?: string
          responsible_role?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adep_checklists_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "adep_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      adep_drills: {
        Row: {
          action_items: string | null
          created_at: string | null
          drill_date: string
          drill_type: string
          duration_minutes: number | null
          id: string
          next_drill_date: string | null
          observations: string | null
          participants_count: number | null
          plan_id: string
          scenario_tested: string
          success_rate: string | null
          updated_at: string | null
        }
        Insert: {
          action_items?: string | null
          created_at?: string | null
          drill_date: string
          drill_type: string
          duration_minutes?: number | null
          id?: string
          next_drill_date?: string | null
          observations?: string | null
          participants_count?: number | null
          plan_id: string
          scenario_tested: string
          success_rate?: string | null
          updated_at?: string | null
        }
        Update: {
          action_items?: string | null
          created_at?: string | null
          drill_date?: string
          drill_type?: string
          duration_minutes?: number | null
          id?: string
          next_drill_date?: string | null
          observations?: string | null
          participants_count?: number | null
          plan_id?: string
          scenario_tested?: string
          success_rate?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adep_drills_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "adep_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      adep_emergency_contacts: {
        Row: {
          created_at: string | null
          id: string
          institution_name: string
          phone_number: string
          plan_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          institution_name: string
          phone_number: string
          plan_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          institution_name?: string
          phone_number?: string
          plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adep_emergency_contacts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "adep_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      adep_equipment_inventory: {
        Row: {
          created_at: string | null
          equipment_name: string
          equipment_type: string
          id: string
          last_inspection_date: string | null
          location: string
          next_inspection_date: string | null
          plan_id: string
          quantity: number
          responsible_person: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          equipment_name: string
          equipment_type: string
          id?: string
          last_inspection_date?: string | null
          location: string
          next_inspection_date?: string | null
          plan_id: string
          quantity?: number
          responsible_person?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          equipment_name?: string
          equipment_type?: string
          id?: string
          last_inspection_date?: string | null
          location?: string
          next_inspection_date?: string | null
          plan_id?: string
          quantity?: number
          responsible_person?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adep_equipment_inventory_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "adep_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      adep_legal_references: {
        Row: {
          article_number: string | null
          compliance_status: string | null
          created_at: string | null
          id: string
          law_name: string
          plan_id: string
          requirement_summary: string
          responsible_person: string | null
          review_date: string | null
          updated_at: string | null
        }
        Insert: {
          article_number?: string | null
          compliance_status?: string | null
          created_at?: string | null
          id?: string
          law_name: string
          plan_id: string
          requirement_summary: string
          responsible_person?: string | null
          review_date?: string | null
          updated_at?: string | null
        }
        Update: {
          article_number?: string | null
          compliance_status?: string | null
          created_at?: string | null
          id?: string
          law_name?: string
          plan_id?: string
          requirement_summary?: string
          responsible_person?: string | null
          review_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adep_legal_references_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "adep_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      adep_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string | null
          company_name: string
          completion_percentage: number | null
          created_at: string | null
          employee_count: number | null
          hazard_class: string | null
          id: string
          is_active: boolean | null
          is_deleted: boolean | null
          last_reviewed_at: string | null
          next_review_date: string | null
          org_id: string | null
          pdf_size_kb: number | null
          pdf_url: string | null
          plan_data: Json
          plan_name: string
          qr_code_url: string | null
          sector: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          version: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string | null
          company_name: string
          completion_percentage?: number | null
          created_at?: string | null
          employee_count?: number | null
          hazard_class?: string | null
          id?: string
          is_active?: boolean | null
          is_deleted?: boolean | null
          last_reviewed_at?: string | null
          next_review_date?: string | null
          org_id?: string | null
          pdf_size_kb?: number | null
          pdf_url?: string | null
          plan_data: Json
          plan_name: string
          qr_code_url?: string | null
          sector?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          version?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string | null
          company_name?: string
          completion_percentage?: number | null
          created_at?: string | null
          employee_count?: number | null
          hazard_class?: string | null
          id?: string
          is_active?: boolean | null
          is_deleted?: boolean | null
          last_reviewed_at?: string | null
          next_review_date?: string | null
          org_id?: string | null
          pdf_size_kb?: number | null
          pdf_url?: string | null
          plan_data?: Json
          plan_name?: string
          qr_code_url?: string | null
          sector?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          version?: number | null
        }
        Relationships: []
      }
      adep_preventive_measures: {
        Row: {
          control_period: string
          created_at: string | null
          id: string
          plan_id: string
          preventive_action: string
          responsible_role: string
          risk_type: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          control_period: string
          created_at?: string | null
          id?: string
          plan_id: string
          preventive_action: string
          responsible_role: string
          risk_type: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          control_period?: string
          created_at?: string | null
          id?: string
          plan_id?: string
          preventive_action?: string
          responsible_role?: string
          risk_type?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adep_preventive_measures_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "adep_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      adep_raci_matrix: {
        Row: {
          accountable: string | null
          consulted: string | null
          created_at: string | null
          id: string
          informed: string | null
          plan_id: string
          priority: string | null
          responsible: string | null
          task_category: string | null
          task_name: string
          updated_at: string | null
        }
        Insert: {
          accountable?: string | null
          consulted?: string | null
          created_at?: string | null
          id?: string
          informed?: string | null
          plan_id: string
          priority?: string | null
          responsible?: string | null
          task_category?: string | null
          task_name: string
          updated_at?: string | null
        }
        Update: {
          accountable?: string | null
          consulted?: string | null
          created_at?: string | null
          id?: string
          informed?: string | null
          plan_id?: string
          priority?: string | null
          responsible?: string | null
          task_category?: string | null
          task_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adep_raci_matrix_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "adep_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      adep_risk_sources: {
        Row: {
          created_at: string | null
          id: string
          last_assessment_date: string | null
          location: string
          mitigation_measures: string | null
          monitoring_frequency: string | null
          plan_id: string
          potential_impact: string
          risk_level: string
          risk_source: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_assessment_date?: string | null
          location: string
          mitigation_measures?: string | null
          monitoring_frequency?: string | null
          plan_id: string
          potential_impact: string
          risk_level: string
          risk_source: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_assessment_date?: string | null
          location?: string
          mitigation_measures?: string | null
          monitoring_frequency?: string | null
          plan_id?: string
          potential_impact?: string
          risk_level?: string
          risk_source?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adep_risk_sources_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "adep_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      adep_scenarios: {
        Row: {
          action_steps: string
          created_at: string | null
          hazard_type: string
          id: string
          plan_id: string | null
        }
        Insert: {
          action_steps: string
          created_at?: string | null
          hazard_type: string
          id?: string
          plan_id?: string | null
        }
        Update: {
          action_steps?: string
          created_at?: string | null
          hazard_type?: string
          id?: string
          plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adep_scenarios_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "adep_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      adep_teams: {
        Row: {
          created_at: string | null
          id: string
          members: Json | null
          plan_id: string | null
          team_leader_id: string | null
          team_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          members?: Json | null
          plan_id?: string | null
          team_leader_id?: string | null
          team_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          members?: Json | null
          plan_id?: string | null
          team_leader_id?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "adep_teams_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "adep_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adep_teams_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      annual_plans: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          plan_data: Json
          plan_type: string
          title: string | null
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          plan_data: Json
          plan_type: string
          title?: string | null
          updated_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          plan_data?: Json
          plan_type?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      ai_function_logs: {
        Row: {
          attempted_models: string[]
          attempts_count: number
          created_at: string
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          function_name: string
          id: string
          metadata: Json
          request_label: string | null
          resolved_model: string | null
          status: string
        }
        Insert: {
          attempted_models?: string[]
          attempts_count?: number
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          function_name: string
          id?: string
          metadata?: Json
          request_label?: string | null
          resolved_model?: string | null
          status: string
        }
        Update: {
          attempted_models?: string[]
          attempts_count?: number
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          function_name?: string
          id?: string
          metadata?: Json
          request_label?: string | null
          resolved_model?: string | null
          status?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          org_id: string
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          org_id: string
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_stats"
            referencedColumns: ["org_id"]
          },
        ]
      }
      billing_history: {
        Row: {
          amount: number
          billing_date: string | null
          created_at: string | null
          currency: string | null
          id: string
          invoice_url: string | null
          payment_method: string | null
          period_end: string | null
          period_start: string | null
          plan_name: string
          status: string | null
          user_id: string
        }
        Insert: {
          amount: number
          billing_date?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_url?: string | null
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_name: string
          status?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          billing_date?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_url?: string | null
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_name?: string
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      blueprint_analyses: {
        Row: {
          analysis_result: Json
          area_sqm: number | null
          building_type: string | null
          created_at: string | null
          floor_number: number | null
          id: string
          image_size_kb: number | null
          image_url: string | null
          project_name: string | null
          updated_at: string | null
          user_id: string
          user_notes: string | null
        }
        Insert: {
          analysis_result: Json
          area_sqm?: number | null
          building_type?: string | null
          created_at?: string | null
          floor_number?: number | null
          id?: string
          image_size_kb?: number | null
          image_url?: string | null
          project_name?: string | null
          updated_at?: string | null
          user_id: string
          user_notes?: string | null
        }
        Update: {
          analysis_result?: Json
          area_sqm?: number | null
          building_type?: string | null
          created_at?: string | null
          floor_number?: number | null
          id?: string
          image_size_kb?: number | null
          image_url?: string | null
          project_name?: string | null
          updated_at?: string | null
          user_id?: string
          user_notes?: string | null
        }
        Relationships: []
      }
      board_meetings: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          location: string | null
          meeting_date: string
          meeting_number: string | null
          meeting_time: string | null
          notes: string | null
          pdf_url: string | null
          president_name: string
          secretary_name: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          location?: string | null
          meeting_date: string
          meeting_number?: string | null
          meeting_time?: string | null
          notes?: string | null
          pdf_url?: string | null
          president_name: string
          secretary_name?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          location?: string | null
          meeting_date?: string
          meeting_number?: string | null
          meeting_time?: string | null
          notes?: string | null
          pdf_url?: string | null
          president_name?: string
          secretary_name?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_capa_entries: {
        Row: {
          ai_warning: string | null
          correction_plan: string | null
          created_at: string | null
          description: string
          fk_frequency: number | null
          fk_level: string | null
          fk_probability: number | null
          fk_severity: number | null
          fk_value: number | null
          id: string
          risk_score: string | null
          session_id: string
        }
        Insert: {
          ai_warning?: string | null
          correction_plan?: string | null
          created_at?: string | null
          description: string
          fk_frequency?: number | null
          fk_level?: string | null
          fk_probability?: number | null
          fk_severity?: number | null
          fk_value?: number | null
          id?: string
          risk_score?: string | null
          session_id: string
        }
        Update: {
          ai_warning?: string | null
          correction_plan?: string | null
          created_at?: string | null
          description?: string
          fk_frequency?: number | null
          fk_level?: string | null
          fk_probability?: number | null
          fk_severity?: number | null
          fk_value?: number | null
          id?: string
          risk_score?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_capa_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "bulk_capa_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_capa_sessions: {
        Row: {
          created_at: string | null
          entries_count: number | null
          id: string
          org_id: string
          recipient_email: string
          site_name: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entries_count?: number | null
          id?: string
          org_id: string
          recipient_email: string
          site_name: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          entries_count?: number | null
          id?: string
          org_id?: string
          recipient_email?: string
          site_name?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_capa_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_capa_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_stats"
            referencedColumns: ["org_id"]
          },
        ]
      }
      capa_records: {
        Row: {
          assigned_person: string
          corrective_action: string
          created_at: string | null
          deadline: string
          document_urls: Json | null
          file_urls: Json | null
          id: string
          media_urls: Json | null
          non_conformity: string
          notes: string | null
          org_id: string
          priority: string | null
          root_cause: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_person: string
          corrective_action: string
          created_at?: string | null
          deadline: string
          document_urls?: Json | null
          file_urls?: Json | null
          id?: string
          media_urls?: Json | null
          non_conformity: string
          notes?: string | null
          org_id: string
          priority?: string | null
          root_cause: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_person?: string
          corrective_action?: string
          created_at?: string | null
          deadline?: string
          document_urls?: Json | null
          file_urls?: Json | null
          id?: string
          media_urls?: Json | null
          non_conformity?: string
          notes?: string | null
          org_id?: string
          priority?: string | null
          root_cause?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capa_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_stats"
            referencedColumns: ["org_id"]
          },
        ]
      }
      capa_activity_logs: {
        Row: {
          action_type: string
          capa_record_id: string | null
          created_at: string
          description: string | null
          finding_id: string | null
          id: string
          metadata: Json
          org_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_type: string
          capa_record_id?: string | null
          created_at?: string
          description?: string | null
          finding_id?: string | null
          id?: string
          metadata?: Json
          org_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_type?: string
          capa_record_id?: string | null
          created_at?: string
          description?: string | null
          finding_id?: string | null
          id?: string
          metadata?: Json
          org_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capa_activity_logs_capa_record_id_fkey"
            columns: ["capa_record_id"]
            isOneToOne: false
            referencedRelation: "capa_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_activity_logs_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_activity_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_activity_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_stats"
            referencedColumns: ["org_id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          employee_count: number | null
          id: string
          industry: string | null
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          tax_number: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      company_risks: {
        Row: {
          assigned_to: string | null
          company_id: string
          created_at: string | null
          frequency: number | null
          hazard_source: string | null
          id: string
          preventive_measures: string[] | null
          probability: number | null
          risk_category: string
          risk_description: string
          risk_level: string | null
          risk_score: number | null
          severity: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          created_at?: string | null
          frequency?: number | null
          hazard_source?: string | null
          id?: string
          preventive_measures?: string[] | null
          probability?: number | null
          risk_category: string
          risk_description: string
          risk_level?: string | null
          risk_score?: number | null
          severity?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          created_at?: string | null
          frequency?: number | null
          hazard_source?: string | null
          id?: string
          preventive_measures?: string[] | null
          probability?: number | null
          risk_category?: string
          risk_description?: string
          risk_level?: string | null
          risk_score?: number | null
          severity?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string | null
          email_id: string | null
          id: string
          org_id: string
          recipient_email: string
          report_type: string
          report_url: string
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_id?: string | null
          id?: string
          org_id: string
          recipient_email: string
          report_type: string
          report_url: string
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_id?: string | null
          id?: string
          org_id?: string
          recipient_email?: string
          report_type?: string
          report_url?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_stats"
            referencedColumns: ["org_id"]
          },
        ]
      }
      emergency_plans: {
        Row: {
          company_name: string
          created_at: string | null
          employee_count: number
          hazard_class: string
          id: string
          pdf_size_kb: number | null
          pdf_url: string | null
          plan_data: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_name: string
          created_at?: string | null
          employee_count: number
          hazard_class: string
          id?: string
          pdf_size_kb?: number | null
          pdf_url?: string | null
          plan_data: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_name?: string
          created_at?: string | null
          employee_count?: number
          hazard_class?: string
          id?: string
          pdf_size_kb?: number | null
          pdf_url?: string | null
          plan_data?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          address: string | null
          allergies: string[] | null
          birth_date: string | null
          blood_type: string | null
          certifications: Json | null
          chronic_diseases: string[] | null
          company_id: string
          created_at: string | null
          department: string | null
          education_level: string | null
          email: string | null
          employment_type: string | null
          end_date: string | null
          first_name: string
          full_name: string | null
          gender: string | null
          id: string
          insured_job_code: string | null
          insured_job_name: string | null
          is_active: boolean | null
          job_title: string
          last_name: string
          phone: string | null
          start_date: string
          tc_number: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          allergies?: string[] | null
          birth_date?: string | null
          blood_type?: string | null
          certifications?: Json | null
          chronic_diseases?: string[] | null
          company_id: string
          created_at?: string | null
          department?: string | null
          education_level?: string | null
          email?: string | null
          employment_type?: string | null
          end_date?: string | null
          first_name: string
          full_name?: string | null
          gender?: string | null
          id?: string
          insured_job_code?: string | null
          insured_job_name?: string | null
          is_active?: boolean | null
          job_title: string
          last_name: string
          phone?: string | null
          start_date: string
          tc_number?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          allergies?: string[] | null
          birth_date?: string | null
          blood_type?: string | null
          certifications?: Json | null
          chronic_diseases?: string[] | null
          company_id?: string
          created_at?: string | null
          department?: string | null
          education_level?: string | null
          email?: string | null
          employment_type?: string | null
          end_date?: string | null
          first_name?: string
          full_name?: string | null
          gender?: string | null
          id?: string
          insured_job_code?: string | null
          insured_job_name?: string | null
          is_active?: boolean | null
          job_title?: string
          last_name?: string
          phone?: string | null
          start_date?: string
          tc_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      findings: {
        Row: {
          action_required: string | null
          assigned_to: string | null
          created_at: string | null
          description: string
          due_date: string | null
          id: string
          inspection_id: string
          is_resolved: boolean | null
          notification_method: string | null
          preventive_action: string | null
          priority: string | null
          resolution_notes: string | null
          resolved_at: string | null
          risk_definition: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          action_required?: string | null
          assigned_to?: string | null
          created_at?: string | null
          description: string
          due_date?: string | null
          id?: string
          inspection_id: string
          is_resolved?: boolean | null
          notification_method?: string | null
          preventive_action?: string | null
          priority?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          risk_definition?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          action_required?: string | null
          assigned_to?: string | null
          created_at?: string | null
          description?: string
          due_date?: string | null
          id?: string
          inspection_id?: string
          is_resolved?: boolean | null
          notification_method?: string | null
          preventive_action?: string | null
          priority?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          risk_definition?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "findings_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "v_recent_activities"
            referencedColumns: ["inspection_id"]
          },
        ]
      }
      hazard_analyses: {
        Row: {
          ai_result: Json
          created_at: string | null
          hazard_description: string
          id: string
          risk_score: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_result: Json
          created_at?: string | null
          hazard_description: string
          id?: string
          risk_score?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_result?: Json
          created_at?: string | null
          hazard_description?: string
          id?: string
          risk_score?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      inspection_templates: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          fields_json: Json
          id: string
          is_active: boolean | null
          org_id: string
          title: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          fields_json: Json
          id?: string
          is_active?: boolean | null
          org_id: string
          title: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          fields_json?: Json
          id?: string
          is_active?: boolean | null
          org_id?: string
          title?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_stats"
            referencedColumns: ["org_id"]
          },
        ]
      }
      inspections: {
        Row: {
          answers: Json | null
          completed_at: string | null
          corrective_action: string | null
          created_at: string | null
          equipment_category: string | null
          id: string
          location_name: string
          media_urls: Json | null
          notes: string | null
          org_id: string
          preventive_action: string | null
          risk_definition: string | null
          risk_level: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          corrective_action?: string | null
          created_at?: string | null
          equipment_category?: string | null
          id?: string
          location_name: string
          media_urls?: Json | null
          notes?: string | null
          org_id: string
          preventive_action?: string | null
          risk_definition?: string | null
          risk_level?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          corrective_action?: string | null
          created_at?: string | null
          equipment_category?: string | null
          id?: string
          location_name?: string
          media_urls?: Json | null
          notes?: string | null
          org_id?: string
          preventive_action?: string | null
          risk_definition?: string | null
          risk_level?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_stats"
            referencedColumns: ["org_id"]
          },
        ]
      }
      isgkatip_assignments: {
        Row: {
          assigned_minutes: number
          assignment_end: string | null
          assignment_start: string
          company_id: string
          created_at: string | null
          expert_id: string | null
          expert_name: string
          id: string
          is_active: boolean | null
          org_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_minutes: number
          assignment_end?: string | null
          assignment_start: string
          company_id: string
          created_at?: string | null
          expert_id?: string | null
          expert_name: string
          id?: string
          is_active?: boolean | null
          org_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_minutes?: number
          assignment_end?: string | null
          assignment_start?: string
          company_id?: string
          created_at?: string | null
          expert_id?: string | null
          expert_name?: string
          id?: string
          is_active?: boolean | null
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "isgkatip_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "isgkatip_active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "isgkatip_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "isgkatip_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "isgkatip_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "vw_compliance_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      isgkatip_companies: {
        Row: {
          assigned_minutes: number
          assigned_person_approval_date: string | null
          assigned_person_approval_status: string | null
          assigned_person_certificate_no: string | null
          assigned_person_certificate_type: string | null
          assigned_person_name: string | null
          company_name: string
          compliance_status: string
          contract_approval_date: string | null
          contract_approval_status: string | null
          contract_defined_by: string | null
          contract_definition_date: string | null
          contract_end: string | null
          contract_id: string | null
          contract_name: string | null
          contract_start: string | null
          contract_status: string | null
          contract_terminated_by: string | null
          contract_termination_reason: string | null
          contract_type: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          employee_count: number
          hazard_class: string
          id: string
          is_compliant: boolean | null
          is_deleted: boolean | null
          last_synced_at: string | null
          nace_code: string | null
          org_id: string
          required_minutes: number
          risk_score: number | null
          service_provider_certificate_no: string | null
          service_provider_city: string | null
          service_provider_id: string | null
          service_provider_name: string | null
          service_provider_sgk_no: string | null
          service_receiver_approval_status: string | null
          service_receiver_city: string | null
          sgk_no: string
          updated_at: string | null
          work_period: string | null
        }
        Insert: {
          assigned_minutes?: number
          assigned_person_approval_date?: string | null
          assigned_person_approval_status?: string | null
          assigned_person_certificate_no?: string | null
          assigned_person_certificate_type?: string | null
          assigned_person_name?: string | null
          company_name: string
          compliance_status?: string
          contract_approval_date?: string | null
          contract_approval_status?: string | null
          contract_defined_by?: string | null
          contract_definition_date?: string | null
          contract_end?: string | null
          contract_id?: string | null
          contract_name?: string | null
          contract_start?: string | null
          contract_status?: string | null
          contract_terminated_by?: string | null
          contract_termination_reason?: string | null
          contract_type?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          employee_count?: number
          hazard_class: string
          id?: string
          is_compliant?: boolean | null
          is_deleted?: boolean | null
          last_synced_at?: string | null
          nace_code?: string | null
          org_id: string
          required_minutes?: number
          risk_score?: number | null
          service_provider_certificate_no?: string | null
          service_provider_city?: string | null
          service_provider_id?: string | null
          service_provider_name?: string | null
          service_provider_sgk_no?: string | null
          service_receiver_approval_status?: string | null
          service_receiver_city?: string | null
          sgk_no: string
          updated_at?: string | null
          work_period?: string | null
        }
        Update: {
          assigned_minutes?: number
          assigned_person_approval_date?: string | null
          assigned_person_approval_status?: string | null
          assigned_person_certificate_no?: string | null
          assigned_person_certificate_type?: string | null
          assigned_person_name?: string | null
          company_name?: string
          compliance_status?: string
          contract_approval_date?: string | null
          contract_approval_status?: string | null
          contract_defined_by?: string | null
          contract_definition_date?: string | null
          contract_end?: string | null
          contract_id?: string | null
          contract_name?: string | null
          contract_start?: string | null
          contract_status?: string | null
          contract_terminated_by?: string | null
          contract_termination_reason?: string | null
          contract_type?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          employee_count?: number
          hazard_class?: string
          id?: string
          is_compliant?: boolean | null
          is_deleted?: boolean | null
          last_synced_at?: string | null
          nace_code?: string | null
          org_id?: string
          required_minutes?: number
          risk_score?: number | null
          service_provider_certificate_no?: string | null
          service_provider_city?: string | null
          service_provider_id?: string | null
          service_provider_name?: string | null
          service_provider_sgk_no?: string | null
          service_receiver_approval_status?: string | null
          service_receiver_city?: string | null
          sgk_no?: string
          updated_at?: string | null
          work_period?: string | null
        }
        Relationships: []
      }
      isgkatip_companies_backup: {
        Row: {
          assigned_minutes: number | null
          company_name: string | null
          compliance_status: string | null
          contract_end: string | null
          contract_start: string | null
          created_at: string | null
          employee_count: number | null
          hazard_class: string | null
          id: string | null
          last_synced_at: string | null
          nace_code: string | null
          org_id: string | null
          required_minutes: number | null
          risk_score: number | null
          sgk_no: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_minutes?: number | null
          company_name?: string | null
          compliance_status?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string | null
          employee_count?: number | null
          hazard_class?: string | null
          id?: string | null
          last_synced_at?: string | null
          nace_code?: string | null
          org_id?: string | null
          required_minutes?: number | null
          risk_score?: number | null
          sgk_no?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_minutes?: number | null
          company_name?: string | null
          compliance_status?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string | null
          employee_count?: number | null
          hazard_class?: string | null
          id?: string | null
          last_synced_at?: string | null
          nace_code?: string | null
          org_id?: string | null
          required_minutes?: number | null
          risk_score?: number | null
          sgk_no?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      isgkatip_compliance_flags: {
        Row: {
          company_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          message: string
          org_id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          rule_name: string
          severity: string
          status: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          message: string
          org_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_name: string
          severity: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          message?: string
          org_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_name?: string
          severity?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "isgkatip_compliance_flags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "isgkatip_active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "isgkatip_compliance_flags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "isgkatip_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "isgkatip_compliance_flags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "vw_compliance_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      isgkatip_deleted_companies: {
        Row: {
          company_data: Json
          deleted_at: string
          deleted_by: string
          deletion_reason: string | null
          id: string
          is_permanently_deleted: boolean | null
          org_id: string
          original_company_id: string
          restored_at: string | null
          restored_by: string | null
        }
        Insert: {
          company_data: Json
          deleted_at?: string
          deleted_by: string
          deletion_reason?: string | null
          id?: string
          is_permanently_deleted?: boolean | null
          org_id: string
          original_company_id: string
          restored_at?: string | null
          restored_by?: string | null
        }
        Update: {
          company_data?: Json
          deleted_at?: string
          deleted_by?: string
          deletion_reason?: string | null
          id?: string
          is_permanently_deleted?: boolean | null
          org_id?: string
          original_company_id?: string
          restored_at?: string | null
          restored_by?: string | null
        }
        Relationships: []
      }
      isgkatip_expert_capacity: {
        Row: {
          assigned_minutes: number
          available_minutes: number
          created_at: string | null
          expert_id: string
          id: string
          is_overloaded: boolean
          max_minutes_per_month: number
          month: string
          org_id: string
          updated_at: string | null
          utilization_rate: number
        }
        Insert: {
          assigned_minutes?: number
          available_minutes?: number
          created_at?: string | null
          expert_id: string
          id?: string
          is_overloaded?: boolean
          max_minutes_per_month?: number
          month: string
          org_id: string
          updated_at?: string | null
          utilization_rate?: number
        }
        Update: {
          assigned_minutes?: number
          available_minutes?: number
          created_at?: string | null
          expert_id?: string
          id?: string
          is_overloaded?: boolean
          max_minutes_per_month?: number
          month?: string
          org_id?: string
          updated_at?: string | null
          utilization_rate?: number
        }
        Relationships: []
      }
      isgkatip_predictive_alerts: {
        Row: {
          alert_type: string
          company_id: string | null
          confidence_score: number | null
          created_at: string | null
          details: Json | null
          dismissed_at: string | null
          dismissed_by: string | null
          id: string
          message: string
          org_id: string
          predicted_date: string | null
          severity: string
          status: string
          updated_at: string | null
        }
        Insert: {
          alert_type: string
          company_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          details?: Json | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          message: string
          org_id: string
          predicted_date?: string | null
          severity: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          alert_type?: string
          company_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          details?: Json | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          message?: string
          org_id?: string
          predicted_date?: string | null
          severity?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "isgkatip_predictive_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "isgkatip_active_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "isgkatip_predictive_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "isgkatip_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "isgkatip_predictive_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "vw_compliance_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      isgkatip_sync_logs: {
        Row: {
          created_at: string | null
          error_count: number
          id: string
          metadata: Json | null
          org_id: string
          source: string
          success_count: number
          total_companies: number
        }
        Insert: {
          created_at?: string | null
          error_count?: number
          id?: string
          metadata?: Json | null
          org_id: string
          source: string
          success_count?: number
          total_companies?: number
        }
        Update: {
          created_at?: string | null
          error_count?: number
          id?: string
          metadata?: Json | null
          org_id?: string
          source?: string
          success_count?: number
          total_companies?: number
        }
        Relationships: []
      }
      meeting_agenda: {
        Row: {
          agenda_number: number
          created_at: string | null
          deadline: string | null
          decision: string | null
          discussion: string | null
          id: string
          is_transferred_to_risk: boolean | null
          meeting_id: string
          responsible_person: string | null
          risk_item_id: string | null
          status: string | null
          topic: string
          updated_at: string | null
        }
        Insert: {
          agenda_number: number
          created_at?: string | null
          deadline?: string | null
          decision?: string | null
          discussion?: string | null
          id?: string
          is_transferred_to_risk?: boolean | null
          meeting_id: string
          responsible_person?: string | null
          risk_item_id?: string | null
          status?: string | null
          topic: string
          updated_at?: string | null
        }
        Update: {
          agenda_number?: number
          created_at?: string | null
          deadline?: string | null
          decision?: string | null
          discussion?: string | null
          id?: string
          is_transferred_to_risk?: boolean | null
          meeting_id?: string
          responsible_person?: string | null
          risk_item_id?: string | null
          status?: string | null
          topic?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_agenda_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "board_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_agenda_risk_item_id_fkey"
            columns: ["risk_item_id"]
            isOneToOne: false
            referencedRelation: "risk_items"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendees: {
        Row: {
          attendance_status: string | null
          created_at: string | null
          employee_id: string | null
          external_name: string | null
          id: string
          meeting_id: string
          notes: string | null
          role: string
          signature_url: string | null
          status: string | null
        }
        Insert: {
          attendance_status?: string | null
          created_at?: string | null
          employee_id?: string | null
          external_name?: string | null
          id?: string
          meeting_id: string
          notes?: string | null
          role: string
          signature_url?: string | null
          status?: string | null
        }
        Update: {
          attendance_status?: string | null
          created_at?: string | null
          employee_id?: string | null
          external_name?: string | null
          id?: string
          meeting_id?: string
          notes?: string | null
          role?: string
          signature_url?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "board_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_documents: {
        Row: {
          document_name: string
          document_type: string | null
          document_url: string
          file_size: number | null
          id: string
          meeting_id: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          document_name: string
          document_type?: string | null
          document_url: string
          file_size?: number | null
          id?: string
          meeting_id: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          document_name?: string
          document_type?: string | null
          document_url?: string
          file_size?: number | null
          id?: string
          meeting_id?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_documents_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "board_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      nace_codes: {
        Row: {
          ai_risk_score: number | null
          created_at: string | null
          hazard_class: string
          id: string
          nace_code: string
          nace_title: string
          risk_examples: string[] | null
          sector: string | null
          updated_at: string | null
        }
        Insert: {
          ai_risk_score?: number | null
          created_at?: string | null
          hazard_class: string
          id?: string
          nace_code: string
          nace_title: string
          risk_examples?: string[] | null
          sector?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_risk_score?: number | null
          created_at?: string | null
          hazard_class?: string
          id?: string
          nace_code?: string
          nace_title?: string
          risk_examples?: string[] | null
          sector?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      nace_hazard_library: {
        Row: {
          hazard: string | null
          id: string
          legal_reference: string | null
          nace_code: string | null
          risk: string | null
          severity: number | null
        }
        Insert: {
          hazard?: string | null
          id?: string
          legal_reference?: string | null
          nace_code?: string | null
          risk?: string | null
          severity?: number | null
        }
        Update: {
          hazard?: string | null
          id?: string
          legal_reference?: string | null
          nace_code?: string | null
          risk?: string | null
          severity?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_label: string | null
          action_url: string | null
          category: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          priority: string | null
          read_at: string | null
          related_id: string | null
          related_table: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          category: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          priority?: string | null
          read_at?: string | null
          related_id?: string | null
          related_table?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          category?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          priority?: string | null
          read_at?: string | null
          related_id?: string | null
          related_table?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          description: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          phone: string | null
          slug: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          slug: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          slug?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      profile_notes: {
        Row: {
          category: string
          company_id: string | null
          content: string
          created_at: string
          due_date: string | null
          id: string
          is_completed: boolean
          organization_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          company_id?: string | null
          content: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          organization_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          company_id?: string | null
          content?: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          organization_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_stats"
            referencedColumns: ["org_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          stamp_url: string | null
          created_at: string | null
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          organization_id: string | null
          phone: string | null
          position: string | null
          role: string | null
          subscription_expires_at: string | null
          subscription_plan: string | null
          subscription_started_at: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          two_factor_enabled: boolean | null
          two_factor_method: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          stamp_url?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          last_login_at?: string | null
          organization_id?: string | null
          phone?: string | null
          position?: string | null
          role?: string | null
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          subscription_started_at?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          two_factor_enabled?: boolean | null
          two_factor_method?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          stamp_url?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          organization_id?: string | null
          phone?: string | null
          position?: string | null
          role?: string | null
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          subscription_started_at?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          two_factor_enabled?: boolean | null
          two_factor_method?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_stats"
            referencedColumns: ["org_id"]
          },
        ]
      }
      reports: {
        Row: {
          content: Json | null
          created_at: string | null
          export_format: string | null
          file_url: string | null
          generated_at: string | null
          id: string
          org_id: string
          report_type: string
          title: string
          user_id: string
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          export_format?: string | null
          file_url?: string | null
          generated_at?: string | null
          id?: string
          org_id: string
          report_type: string
          title: string
          user_id: string
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          export_format?: string | null
          file_url?: string | null
          generated_at?: string | null
          id?: string
          org_id?: string
          report_type?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_stats"
            referencedColumns: ["org_id"]
          },
        ]
      }
      risk_assessments: {
        Row: {
          approval_date: string | null
          assessment_date: string | null
          assessment_name: string
          assessor_name: string | null
          company_id: string | null
          control_measures: string | null
          created_at: string | null
          department: string | null
          employee_representative_signature_url: string | null
          employee_representative_signed_at: string | null
          employee_representative_approval_status: string | null
          employee_representative_name: string | null
          employer_name: string | null
          employer_representative_approval_status: string | null
          employer_representative_signature_url: string | null
          employer_representative_signed_at: string | null
          employer_representative_name: string | null
          hazard_sources: string | null
          id: string
          identified_risks: string | null
          is_deleted: boolean | null
          legislation_notes: string | null
          method: string | null
          next_review_date: string | null
          notes: string | null
          occupational_safety_specialist_signature_url: string | null
          occupational_safety_specialist_signed_at: string | null
          occupational_safety_specialist_approval_status: string | null
          occupational_safety_specialist_name: string | null
          reviewer_name: string | null
          renewal_triggers_note: string | null
          responsible_persons: string | null
          sector: string | null
          status: string | null
          support_personnel_approval_status: string | null
          support_personnel_signature_url: string | null
          support_personnel_signed_at: string | null
          support_personnel_name: string | null
          updated_at: string | null
          user_id: string | null
          version: number | null
          workplace_address: string | null
          workplace_doctor_approval_status: string | null
          workplace_doctor_signature_url: string | null
          workplace_doctor_signed_at: string | null
          workplace_doctor_name: string | null
          workplace_title: string | null
        }
        Insert: {
          approval_date?: string | null
          assessment_date?: string | null
          assessment_name: string
          assessor_name?: string | null
          company_id?: string | null
          control_measures?: string | null
          created_at?: string | null
          department?: string | null
          employee_representative_signature_url?: string | null
          employee_representative_signed_at?: string | null
          employee_representative_approval_status?: string | null
          employee_representative_name?: string | null
          employer_name?: string | null
          employer_representative_approval_status?: string | null
          employer_representative_signature_url?: string | null
          employer_representative_signed_at?: string | null
          employer_representative_name?: string | null
          hazard_sources?: string | null
          id?: string
          identified_risks?: string | null
          is_deleted?: boolean | null
          legislation_notes?: string | null
          method?: string | null
          next_review_date?: string | null
          notes?: string | null
          occupational_safety_specialist_signature_url?: string | null
          occupational_safety_specialist_signed_at?: string | null
          occupational_safety_specialist_approval_status?: string | null
          occupational_safety_specialist_name?: string | null
          reviewer_name?: string | null
          renewal_triggers_note?: string | null
          responsible_persons?: string | null
          sector?: string | null
          status?: string | null
          support_personnel_approval_status?: string | null
          support_personnel_signature_url?: string | null
          support_personnel_signed_at?: string | null
          support_personnel_name?: string | null
          updated_at?: string | null
          user_id?: string | null
          version?: number | null
          workplace_address?: string | null
          workplace_doctor_approval_status?: string | null
          workplace_doctor_signature_url?: string | null
          workplace_doctor_signed_at?: string | null
          workplace_doctor_name?: string | null
          workplace_title?: string | null
        }
        Update: {
          approval_date?: string | null
          assessment_date?: string | null
          assessment_name?: string
          assessor_name?: string | null
          company_id?: string | null
          control_measures?: string | null
          created_at?: string | null
          department?: string | null
          employee_representative_signature_url?: string | null
          employee_representative_signed_at?: string | null
          employee_representative_approval_status?: string | null
          employee_representative_name?: string | null
          employer_name?: string | null
          employer_representative_approval_status?: string | null
          employer_representative_signature_url?: string | null
          employer_representative_signed_at?: string | null
          employer_representative_name?: string | null
          hazard_sources?: string | null
          id?: string
          identified_risks?: string | null
          is_deleted?: boolean | null
          legislation_notes?: string | null
          method?: string | null
          next_review_date?: string | null
          notes?: string | null
          occupational_safety_specialist_signature_url?: string | null
          occupational_safety_specialist_signed_at?: string | null
          occupational_safety_specialist_approval_status?: string | null
          occupational_safety_specialist_name?: string | null
          reviewer_name?: string | null
          renewal_triggers_note?: string | null
          responsible_persons?: string | null
          sector?: string | null
          status?: string | null
          support_personnel_approval_status?: string | null
          support_personnel_signature_url?: string | null
          support_personnel_signed_at?: string | null
          support_personnel_name?: string | null
          updated_at?: string | null
          user_id?: string | null
          version?: number | null
          workplace_address?: string | null
          workplace_doctor_approval_status?: string | null
          workplace_doctor_signature_url?: string | null
          workplace_doctor_signed_at?: string | null
          workplace_doctor_name?: string | null
          workplace_title?: string | null
        }
        Relationships: []
      }
      risk_items: {
        Row: {
          affected_people: string | null
          assessment_id: string | null
          completion_date: string | null
          created_at: string | null
          deadline: string | null
          department: string | null
          existing_controls: string | null
          frequency: number | null
          frequency_1: number | null
          frequency_2: number | null
          hazard: string
          id: string
          is_from_library: boolean | null
          item_number: number
          library_category: string | null
          photo_url: string | null
          probability: number | null
          probability_1: number | null
          probability_2: number | null
          proposed_controls: string | null
          responsible_person: string | null
          risk: string
          risk_class: string | null
          risk_class_1: string | null
          risk_class_2: string | null
          score: number | null
          score_1: number | null
          score_2: number | null
          severity: number | null
          severity_1: number | null
          severity_2: number | null
          sort_order: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          affected_people?: string | null
          assessment_id?: string | null
          completion_date?: string | null
          created_at?: string | null
          deadline?: string | null
          department?: string | null
          existing_controls?: string | null
          frequency?: number | null
          frequency_1?: number | null
          frequency_2?: number | null
          hazard: string
          id?: string
          is_from_library?: boolean | null
          item_number: number
          library_category?: string | null
          photo_url?: string | null
          probability?: number | null
          probability_1?: number | null
          probability_2?: number | null
          proposed_controls?: string | null
          responsible_person?: string | null
          risk: string
          risk_class?: string | null
          risk_class_1?: string | null
          risk_class_2?: string | null
          score?: number | null
          score_1?: number | null
          score_2?: number | null
          severity?: number | null
          severity_1?: number | null
          severity_2?: number | null
          sort_order?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          affected_people?: string | null
          assessment_id?: string | null
          completion_date?: string | null
          created_at?: string | null
          deadline?: string | null
          department?: string | null
          existing_controls?: string | null
          frequency?: number | null
          frequency_1?: number | null
          frequency_2?: number | null
          hazard?: string
          id?: string
          is_from_library?: boolean | null
          item_number?: number
          library_category?: string | null
          photo_url?: string | null
          probability?: number | null
          probability_1?: number | null
          probability_2?: number | null
          proposed_controls?: string | null
          responsible_person?: string | null
          risk?: string
          risk_class?: string | null
          risk_class_1?: string | null
          risk_class_2?: string | null
          score?: number | null
          score_1?: number | null
          score_2?: number | null
          severity?: number | null
          severity_1?: number | null
          severity_2?: number | null
          sort_order?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "risk_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_library: {
        Row: {
          category: string | null
          created_at: string | null
          hazard: string
          id: string
          is_active: boolean | null
          legal_reference: string | null
          risk: string
          sector: string
          suggested_controls: string[] | null
          typical_frequency: number | null
          typical_probability: number | null
          typical_severity: number | null
          usage_count: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          hazard: string
          id?: string
          is_active?: boolean | null
          legal_reference?: string | null
          risk: string
          sector: string
          suggested_controls?: string[] | null
          typical_frequency?: number | null
          typical_probability?: number | null
          typical_severity?: number | null
          usage_count?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          hazard?: string
          id?: string
          is_active?: boolean | null
          legal_reference?: string | null
          risk?: string
          sector?: string
          suggested_controls?: string[] | null
          typical_frequency?: number | null
          typical_probability?: number | null
          typical_severity?: number | null
          usage_count?: number | null
        }
        Relationships: []
      }
      risk_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          industry_sector: string
          risk_items: Json
          template_name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          industry_sector: string
          risk_items: Json
          template_name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          industry_sector?: string
          risk_items?: Json
          template_name?: string
        }
        Relationships: []
      }
      library_collections: {
        Row: {
          collection_type: string
          color_token: string | null
          created_at: string
          description: string | null
          icon_name: string | null
          id: string
          is_official: boolean
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          collection_type?: string
          color_token?: string | null
          created_at?: string
          description?: string | null
          icon_name?: string | null
          id?: string
          is_official?: boolean
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          collection_type?: string
          color_token?: string | null
          created_at?: string
          description?: string | null
          icon_name?: string | null
          id?: string
          is_official?: boolean
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      library_items: {
        Row: {
          audience: string | null
          body: string | null
          collection_id: string | null
          created_at: string
          created_by: string | null
          file_url: string | null
          id: string
          is_featured: boolean
          is_official: boolean
          item_type: string
          language_code: string
          metadata: Json
          published_year: number | null
          sector: string | null
          source_name: string | null
          source_url: string | null
          summary: string | null
          tags: string[]
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string | null
          body?: string | null
          collection_id?: string | null
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          is_featured?: boolean
          is_official?: boolean
          item_type?: string
          language_code?: string
          metadata?: Json
          published_year?: number | null
          sector?: string | null
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string | null
          body?: string | null
          collection_id?: string | null
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          is_featured?: boolean
          is_official?: boolean
          item_type?: string
          language_code?: string
          metadata?: Json
          published_year?: number | null
          sector?: string | null
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "library_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_library: {
        Row: {
          category_id: string
          category_label: string
          created_at: string | null
          details: string | null
          hazard_name: string
          id: string
          prevention_text: string
          regulation: string | null
          risk_level: string | null
          updated_at: string | null
        }
        Insert: {
          category_id: string
          category_label: string
          created_at?: string | null
          details?: string | null
          hazard_name: string
          id?: string
          prevention_text: string
          regulation?: string | null
          risk_level?: string | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          category_label?: string
          created_at?: string | null
          details?: string | null
          hazard_name?: string
          id?: string
          prevention_text?: string
          regulation?: string | null
          risk_level?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          ai_risk_analysis: boolean | null
          billing_period: string | null
          created_at: string | null
          currency: string | null
          excel_export: boolean | null
          id: string
          is_active: boolean | null
          max_companies: number | null
          max_employees: number | null
          pdf_export: boolean | null
          plan_code: string
          plan_name: string
          price: number
          priority_support: boolean | null
        }
        Insert: {
          ai_risk_analysis?: boolean | null
          billing_period?: string | null
          created_at?: string | null
          currency?: string | null
          excel_export?: boolean | null
          id?: string
          is_active?: boolean | null
          max_companies?: number | null
          max_employees?: number | null
          pdf_export?: boolean | null
          plan_code: string
          plan_name: string
          price: number
          priority_support?: boolean | null
        }
        Update: {
          ai_risk_analysis?: boolean | null
          billing_period?: string | null
          created_at?: string | null
          currency?: string | null
          excel_export?: boolean | null
          id?: string
          is_active?: boolean | null
          max_companies?: number | null
          max_employees?: number | null
          pdf_export?: boolean | null
          plan_code?: string
          plan_name?: string
          price?: number
          priority_support?: boolean | null
        }
        Relationships: []
      }
      trusted_devices: {
        Row: {
          created_at: string | null
          device_fingerprint: string
          device_name: string
          device_type: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          last_used_at: string | null
          trusted_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_fingerprint: string
          device_name: string
          device_type?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_used_at?: string | null
          trusted_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_fingerprint?: string
          device_name?: string
          device_type?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_used_at?: string | null
          trusted_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          id: string
          organization_id: string
          permissions: Json | null
          role: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          id?: string
          organization_id: string
          permissions?: Json | null
          role: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          id?: string
          organization_id?: string
          permissions?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_stats"
            referencedColumns: ["org_id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          browser: string | null
          created_at: string | null
          device_name: string
          device_type: string | null
          id: string
          ip_address: string | null
          is_current: boolean | null
          last_activity: string | null
          refresh_token: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string | null
          device_name: string
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_activity?: string | null
          refresh_token?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string | null
          device_name?: string
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_activity?: string | null
          refresh_token?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      v_assessment_id: {
        Row: {
          id: string | null
        }
        Insert: {
          id?: string | null
        }
        Update: {
          id?: string | null
        }
        Relationships: []
      }
      v_company_id: {
        Row: {
          id: string | null
        }
        Insert: {
          id?: string | null
        }
        Update: {
          id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      isgkatip_active_companies: {
        Row: {
          assigned_minutes: number | null
          assigned_person_approval_date: string | null
          assigned_person_approval_status: string | null
          assigned_person_certificate_no: string | null
          assigned_person_certificate_type: string | null
          assigned_person_name: string | null
          company_name: string | null
          compliance_status: string | null
          contract_approval_date: string | null
          contract_approval_status: string | null
          contract_defined_by: string | null
          contract_definition_date: string | null
          contract_end: string | null
          contract_id: string | null
          contract_name: string | null
          contract_start: string | null
          contract_status: string | null
          contract_terminated_by: string | null
          contract_termination_reason: string | null
          contract_type: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          employee_count: number | null
          hazard_class: string | null
          id: string | null
          is_compliant: boolean | null
          is_deleted: boolean | null
          last_synced_at: string | null
          nace_code: string | null
          org_id: string | null
          required_minutes: number | null
          risk_score: number | null
          service_provider_certificate_no: string | null
          service_provider_city: string | null
          service_provider_id: string | null
          service_provider_name: string | null
          service_provider_sgk_no: string | null
          service_receiver_approval_status: string | null
          service_receiver_city: string | null
          sgk_no: string | null
          updated_at: string | null
          work_period: string | null
        }
        Insert: {
          assigned_minutes?: number | null
          assigned_person_approval_date?: string | null
          assigned_person_approval_status?: string | null
          assigned_person_certificate_no?: string | null
          assigned_person_certificate_type?: string | null
          assigned_person_name?: string | null
          company_name?: string | null
          compliance_status?: string | null
          contract_approval_date?: string | null
          contract_approval_status?: string | null
          contract_defined_by?: string | null
          contract_definition_date?: string | null
          contract_end?: string | null
          contract_id?: string | null
          contract_name?: string | null
          contract_start?: string | null
          contract_status?: string | null
          contract_terminated_by?: string | null
          contract_termination_reason?: string | null
          contract_type?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          employee_count?: number | null
          hazard_class?: string | null
          id?: string | null
          is_compliant?: boolean | null
          is_deleted?: boolean | null
          last_synced_at?: string | null
          nace_code?: string | null
          org_id?: string | null
          required_minutes?: number | null
          risk_score?: number | null
          service_provider_certificate_no?: string | null
          service_provider_city?: string | null
          service_provider_id?: string | null
          service_provider_name?: string | null
          service_provider_sgk_no?: string | null
          service_receiver_approval_status?: string | null
          service_receiver_city?: string | null
          sgk_no?: string | null
          updated_at?: string | null
          work_period?: string | null
        }
        Update: {
          assigned_minutes?: number | null
          assigned_person_approval_date?: string | null
          assigned_person_approval_status?: string | null
          assigned_person_certificate_no?: string | null
          assigned_person_certificate_type?: string | null
          assigned_person_name?: string | null
          company_name?: string | null
          compliance_status?: string | null
          contract_approval_date?: string | null
          contract_approval_status?: string | null
          contract_defined_by?: string | null
          contract_definition_date?: string | null
          contract_end?: string | null
          contract_id?: string | null
          contract_name?: string | null
          contract_start?: string | null
          contract_status?: string | null
          contract_terminated_by?: string | null
          contract_termination_reason?: string | null
          contract_type?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          employee_count?: number | null
          hazard_class?: string | null
          id?: string | null
          is_compliant?: boolean | null
          is_deleted?: boolean | null
          last_synced_at?: string | null
          nace_code?: string | null
          org_id?: string | null
          required_minutes?: number | null
          risk_score?: number | null
          service_provider_certificate_no?: string | null
          service_provider_city?: string | null
          service_provider_id?: string | null
          service_provider_name?: string | null
          service_provider_sgk_no?: string | null
          service_receiver_approval_status?: string | null
          service_receiver_city?: string | null
          sgk_no?: string | null
          updated_at?: string | null
          work_period?: string | null
        }
        Relationships: []
      }
      isgkatip_deleted_companies_view: {
        Row: {
          company_name: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_by_name: string | null
          deleted_record_id: string | null
          deletion_reason: string | null
          employee_count: number | null
          hazard_class: string | null
          org_id: string | null
          original_company_id: string | null
          restored_at: string | null
          restored_by: string | null
          restored_by_name: string | null
          sgk_no: string | null
        }
        Relationships: []
      }
      user_current_year_plans: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          plan_data: Json | null
          plan_type: string | null
          title: string | null
          updated_at: string | null
          user_email: string | null
          user_id: string | null
          year: number | null
        }
        Relationships: []
      }
      v_dashboard_stats: {
        Row: {
          active_inspections: number | null
          critical_count: number | null
          open_findings: number | null
          org_id: string | null
          org_name: string | null
          overdue_actions: number | null
          total_inspections: number | null
        }
        Relationships: []
      }
      v_recent_activities: {
        Row: {
          created_at: string | null
          created_by: string | null
          inspection_id: string | null
          location_name: string | null
          org_id: string | null
          risk_level: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_stats"
            referencedColumns: ["org_id"]
          },
        ]
      }
      v_risk_distribution: {
        Row: {
          count: number | null
          org_id: string | null
          risk_level: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_stats"
            referencedColumns: ["org_id"]
          },
        ]
      }
      vw_compliance_dashboard: {
        Row: {
          assigned_minutes: number | null
          company_id: string | null
          company_name: string | null
          compliance_status: string | null
          contract_end: string | null
          contract_start: string | null
          contract_status: string | null
          critical_flags_count: number | null
          days_until_expiry: number | null
          employee_count: number | null
          hazard_class: string | null
          last_synced_at: string | null
          org_id: string | null
          required_minutes: number | null
          risk_score: number | null
          sgk_no: string | null
          warning_flags_count: number | null
        }
        Insert: {
          assigned_minutes?: number | null
          company_id?: string | null
          company_name?: string | null
          compliance_status?: string | null
          contract_end?: string | null
          contract_start?: string | null
          contract_status?: never
          critical_flags_count?: never
          days_until_expiry?: never
          employee_count?: number | null
          hazard_class?: string | null
          last_synced_at?: string | null
          org_id?: string | null
          required_minutes?: number | null
          risk_score?: number | null
          sgk_no?: string | null
          warning_flags_count?: never
        }
        Update: {
          assigned_minutes?: number | null
          company_id?: string | null
          company_name?: string | null
          compliance_status?: string | null
          contract_end?: string | null
          contract_start?: string | null
          contract_status?: never
          critical_flags_count?: never
          days_until_expiry?: never
          employee_count?: number | null
          hazard_class?: string | null
          last_synced_at?: string | null
          org_id?: string | null
          required_minutes?: number | null
          risk_score?: number | null
          sgk_no?: string | null
          warning_flags_count?: never
        }
        Relationships: []
      }
      vw_expert_capacity: {
        Row: {
          active_assignments_count: number | null
          assigned_minutes: number | null
          available_minutes: number | null
          expert_id: string | null
          is_overloaded: boolean | null
          max_minutes_per_month: number | null
          month: string | null
          org_id: string | null
          utilization_rate: number | null
        }
        Insert: {
          active_assignments_count?: never
          assigned_minutes?: number | null
          available_minutes?: number | null
          expert_id?: string | null
          is_overloaded?: boolean | null
          max_minutes_per_month?: number | null
          month?: string | null
          org_id?: string | null
          utilization_rate?: number | null
        }
        Update: {
          active_assignments_count?: never
          assigned_minutes?: number | null
          available_minutes?: number | null
          expert_id?: string | null
          is_overloaded?: boolean | null
          max_minutes_per_month?: number | null
          month?: string | null
          org_id?: string | null
          utilization_rate?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_required_minutes: {
        Args: { p_employee_count: number; p_hazard_class: string }
        Returns: number
      }
      create_company_with_data: {
        Args: {
          p_company_data: Json
          p_employees?: Json
          p_owner_id: string
          p_risk_template_id?: string
        }
        Returns: Json
      }
      generate_all_notifications: { Args: never; Returns: Json }
      generate_finding_notifications: { Args: never; Returns: undefined }
      generate_new_employee_notifications: { Args: never; Returns: undefined }
      generate_plan_review_notifications: { Args: never; Returns: undefined }
      generate_risk_notifications: { Args: never; Returns: undefined }
      permanently_delete_isgkatip_company: {
        Args: { p_deleted_record_id: string }
        Returns: Json
      }
      restore_isgkatip_company: {
        Args: { p_deleted_record_id: string }
        Returns: Json
      }
      soft_delete_isgkatip_company: {
        Args: { p_company_id: string; p_deletion_reason?: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
