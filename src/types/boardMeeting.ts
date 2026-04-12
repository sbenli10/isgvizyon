export type MeetingStatus = 'draft' | 'completed' | 'cancelled';
export type AttendeeStatus = 'invited' | 'attended' | 'absent' | 'excused';
export type AttendeeRole = 
  | 'İşveren Vekili' 
  | 'İSG Uzmanı' 
  | 'İşyeri Hekimi' 
  | 'Çalışan Temsilcisi'
  | 'Diğer';
export type AgendaStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

export interface BoardMeeting {
  id: string;
  company_id: string;
  user_id: string;
  meeting_number: string | null;
  meeting_date: string;
  meeting_time: string | null;
  location: string | null;
  president_name: string;
  secretary_name: string | null;
  status: MeetingStatus;
  notes: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingAttendee {
  id: string;
  meeting_id: string;
  employee_id: string | null;
  external_name: string | null;
  role: string;
  attendance_status?: string | null; // ✅ Opsiyonel
  status: string;
  signature_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface MeetingAgenda {
  id: string;
  meeting_id: string;
  agenda_number: number;
  topic: string;
  discussion: string | null;
  decision: string | null;
  responsible_person: string | null;
  deadline: string | null;
  status: AgendaStatus;
  is_transferred_to_risk: boolean;
  risk_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingDocument {
  id: string;
  meeting_id: string;
  document_name: string;
  document_url: string;
  document_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

// Extended types with relations
export interface BoardMeetingWithRelations extends BoardMeeting {
  company?: {
    id: string;
    name: string;
    industry: string | null;
  };
  attendees?: MeetingAttendee[];
  agenda?: MeetingAgenda[];
  documents?: MeetingDocument[];
  attendee_count?: number;
  completed_agenda_count?: number;
}