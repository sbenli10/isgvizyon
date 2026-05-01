import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Sparkles,
  Plus,
  Calendar,
  Clock,
  MapPin,
  User,
  Building2,
  Users,
  FileText,
  Loader2,
  CheckCircle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { generateAgendaWithAI } from "@/utils/aiAgendaGenerator";
import { usePersistentFormDraft } from "@/hooks/usePersistentFormDraft";
import type {
  MeetingAttendee,
  MeetingAgenda,
  AttendeeRole,
  AttendeeStatus,
  AgendaStatus,
} from "@/types/boardMeeting";
import { buildDeterministicClientId } from "@/lib/clientIdentity";

interface Company {
  id: string;
  name: string;
  industry: string | null;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string;
  department: string | null;
}

type EditableAttendee = Omit<MeetingAttendee, "id" | "meeting_id" | "created_at"> & {
  client_id: string;
};

type EditableAgendaItem = Omit<MeetingAgenda, "id" | "meeting_id" | "created_at" | "updated_at"> & {
  client_id: string;
};

const createInitialMeetingFormData = () => ({
  company_id: "",
  meeting_date: new Date().toISOString().split("T")[0],
  meeting_time: "14:00",
  location: "",
  president_name: "",
  secretary_name: "",
  notes: "",
});

export default function BoardMeetingForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const isEditMode = !!id;
  const requestedCompanyId = searchParams.get("companyId") || "";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingAgenda, setGeneratingAgenda] = useState(false);

  // Companies & Employees
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // Form Data
  const [formData, setFormData] = useState(createInitialMeetingFormData);

  // Attendees
  const [attendees, setAttendees] = useState<EditableAttendee[]>([]);

  // Agenda Items
  const [agendaItems, setAgendaItems] = useState<EditableAgendaItem[]>([]);

  // Selected company for employee filtering
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [restoredDraftLabel, setRestoredDraftLabel] = useState<string | null>(null);
  const [, setHasRestoredDraft] = useState(false);

  const draftKey = useMemo(
    () =>
      `board-meeting:${id || "new"}:${requestedCompanyId || formData.company_id || "no-company"}`,
    [formData.company_id, id, requestedCompanyId],
  );

  const {
    discardDraft,
    markSubmitted,
    hasRestoredDraftRef,
    shouldProtectFromDefaults,
    mergeDefaults,
  } = usePersistentFormDraft({
    formId: draftKey,
    enabled: Boolean(user?.id),
    userId: user?.id,
    organizationId: profile?.organization_id ?? null,
    version: 2,
    debounceMs: 500,
    ttlMs: 1000 * 60 * 60 * 24 * 14,
    storage: "localStorage",
    value: {
      formData,
      attendees,
      agendaItems,
    },
    initialValue: {
      formData: createInitialMeetingFormData(),
      attendees: [],
      agendaItems: [],
    },
    isDirty:
      Boolean(formData.company_id) ||
      Boolean(formData.location.trim()) ||
      Boolean(formData.president_name.trim()) ||
      Boolean(formData.secretary_name.trim()) ||
      Boolean(formData.notes.trim()) ||
      attendees.length > 0 ||
      agendaItems.length > 0,
    shouldPersist: (draft) =>
      Boolean(draft.formData.company_id) ||
      Boolean(draft.formData.location.trim()) ||
      Boolean(draft.formData.president_name.trim()) ||
      Boolean(draft.formData.secretary_name.trim()) ||
      Boolean(draft.formData.notes.trim()) ||
      draft.attendees.length > 0 ||
      draft.agendaItems.length > 0,
    onRestore: (draft) => {
      setFormData(
        draft.formData
          ? mergeDefaults({ formData: draft.formData }).formData
          : createInitialMeetingFormData(),
      );
      setAttendees(Array.isArray(draft.attendees) ? draft.attendees : []);
      setAgendaItems(Array.isArray(draft.agendaItems) ? draft.agendaItems : []);
      setHasRestoredDraft(true);
      setRestoredDraftLabel(isEditMode ? "Toplantı düzenleme taslağı" : "Toplantı taslağı");
      toast.info("Kaydedilmemiş toplantı taslağı geri yüklendi.");
    },
    debugLabel: "BoardMeetingForm",
  });

  useEffect(() => {
    if (user) {
      fetchCompanies();
      if (isEditMode) {
        fetchMeetingData();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (formData.company_id) {
      next.set("companyId", formData.company_id);
    } else {
      next.delete("companyId");
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [formData.company_id, searchParams, setSearchParams]);

  // ✅ Firma değiştiğinde çalışanları yükle VE otomatik katılımcı olarak ekle
  useEffect(() => {
    if (formData.company_id) {
      console.log("🔍 Firma seçildi:", formData.company_id);
      fetchEmployeesAndAutoAddAttendees(formData.company_id);
      const company = companies.find((c) => c.id === formData.company_id);
      setSelectedCompany(company || null);
    } else {
      console.log("⚠️ Firma seçilmedi, çalışanlar ve katılımcılar temizleniyor");
      setEmployees([]);
      setAttendees([]); // ✅ Firma yoksa katılımcıları da temizle
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.company_id, companies]);

  useEffect(() => {
    if (isEditMode || !requestedCompanyId || companies.length === 0) return;
    if (!companies.some((company) => company.id === requestedCompanyId)) return;
    setFormData((prev) =>
      prev.company_id === requestedCompanyId
        ? prev
        : shouldProtectFromDefaults
          ? mergeDefaults({
              formData: {
                ...prev,
                company_id: requestedCompanyId,
              },
            }).formData
          : { ...prev, company_id: requestedCompanyId }
    );
  }, [companies, isEditMode, mergeDefaults, requestedCompanyId, shouldProtectFromDefaults]);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, industry")
        .order("name");

      if (error) throw error;
      setCompanies(data || []);
    } catch (error: any) {
      console.error("Fetch companies error:", error);
      toast.error("Firmalar yüklenemedi");
    }
  };

  // ✅ Çalışanları yükle VE otomatik katılımcı olarak ekle
  const fetchEmployeesAndAutoAddAttendees = async (companyId: string) => {
    try {
      console.log("📡 Fetching employees for company:", companyId);
      
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, job_title, department")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("first_name");

      if (error) {
        console.error("❌ Fetch employees error:", error);
        throw error;
      }

      console.log("✅ Employees fetched:", data?.length || 0, "records");

      const typedEmployees: Employee[] = (data || []).map((emp) => ({
        id: emp.id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        job_title: emp.job_title,
        department: emp.department,
      }));

      setEmployees(typedEmployees);

      // ✅ Çalışanları otomatik katılımcı olarak ekle (sadece yeni toplantıda)
      if (!isEditMode && typedEmployees.length > 0 && !hasRestoredDraftRef.current) {
        const autoAttendees: EditableAttendee[] = 
          typedEmployees.map((emp, index) => ({
            client_id: buildDeterministicClientId("board-attendee", [companyId, emp.id, emp.first_name, emp.last_name], index),
            employee_id: emp.id,
            external_name: null,
            role: "Diğer" as AttendeeRole, // Varsayılan rol
            attendance_status: "Katıldı",
            status: "invited" as AttendeeStatus,
            signature_url: null,
            notes: null,
          }));

        setAttendees(autoAttendees);
        toast.success(`✅ ${typedEmployees.length} çalışan katılımcı olarak eklendi`);
      }

      if (typedEmployees.length === 0) {
        toast.info("Bu firmaya kayıtlı çalışan bulunamadı");
      }
    } catch (error: any) {
      console.error("❌ Fetch employees error:", error);
      toast.error("Çalışanlar yüklenemedi: " + error.message);
      setEmployees([]);
    }
  };

  const fetchMeetingData = async () => {
    if (!id) return;

    setLoading(true);
    try {
      // Fetch meeting
      const { data: meeting, error: meetingError } = await supabase
        .from("board_meetings")
        .select("*")
        .eq("id", id)
        .single();

      if (meetingError) throw meetingError;

      setFormData(
        shouldProtectFromDefaults
          ? mergeDefaults({
              formData: {
                company_id: meeting.company_id,
                meeting_date: meeting.meeting_date,
                meeting_time: meeting.meeting_time || "",
                location: meeting.location || "",
                president_name: meeting.president_name,
                secretary_name: meeting.secretary_name || "",
                notes: meeting.notes || "",
              },
            }).formData
          : {
              company_id: meeting.company_id,
              meeting_date: meeting.meeting_date,
              meeting_time: meeting.meeting_time || "",
              location: meeting.location || "",
              president_name: meeting.president_name,
              secretary_name: meeting.secretary_name || "",
              notes: meeting.notes || "",
            },
      );

      // Fetch attendees
      const { data: attendeesData, error: attendeesError } = await supabase
        .from("meeting_attendees")
        .select("*")
        .eq("meeting_id", id);

      if (attendeesError) throw attendeesError;

      const typedAttendees: EditableAttendee[] =
        (attendeesData || []).map((attendee: any, index: number) => ({
          client_id: buildDeterministicClientId("board-attendee", [attendee.id, attendee.employee_id, attendee.external_name], index),
          employee_id: attendee.employee_id,
          external_name: attendee.external_name,
          role: attendee.role as AttendeeRole,
          attendance_status: attendee.attendance_status || "Katıldı",
          status: attendee.status as AttendeeStatus,
          signature_url: attendee.signature_url,
          notes: attendee.notes,
        }));

      if (!hasRestoredDraftRef.current) {
        setAttendees(typedAttendees);
      }

      // Fetch agenda
      const { data: agendaData, error: agendaError } = await supabase
        .from("meeting_agenda")
        .select("*")
        .eq("meeting_id", id)
        .order("agenda_number");

      if (agendaError) throw agendaError;

      const typedAgenda: EditableAgendaItem[] =
        (agendaData || []).map((item, index) => ({
          client_id: buildDeterministicClientId("board-agenda", [item.id, item.agenda_number, item.topic], index),
          agenda_number: item.agenda_number,
          topic: item.topic,
          discussion: item.discussion,
          decision: item.decision,
          responsible_person: item.responsible_person,
          deadline: item.deadline,
          status: item.status as AgendaStatus,
          is_transferred_to_risk: item.is_transferred_to_risk,
          risk_item_id: item.risk_item_id,
        }));

      if (!hasRestoredDraftRef.current) {
        setAgendaItems(typedAgenda);
      }
    } catch (error: any) {
      console.error("Fetch meeting error:", error);
      toast.error("Toplantı yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAgenda = async () => {
    if (!selectedCompany) {
      toast.error("Lütfen önce bir firma seçin");
      return;
    }

    setGeneratingAgenda(true);
    try {
      const agenda = await generateAgendaWithAI(
        selectedCompany.name,
        selectedCompany.industry || "Genel",
        employees.length
      );

      const newAgendaItems: EditableAgendaItem[] =
        agenda.map((item, index) => ({
          client_id: buildDeterministicClientId("board-agenda", [selectedCompany.id, item.topic, agendaItems.length + index + 1], index),
          agenda_number: agendaItems.length + index + 1,
          topic: item.topic,
          discussion: item.description,
          decision: null,
          responsible_person: null,
          deadline: null,
          status: "open" as AgendaStatus,
          is_transferred_to_risk: false,
          risk_item_id: null,
        }));

      setAgendaItems([...agendaItems, ...newAgendaItems]);
      toast.success("✅ AI gündem oluşturuldu!", {
        description: `${agenda.length} madde eklendi`,
      });
    } catch (error) {
      toast.error("AI gündem oluşturulamadı");
    } finally {
      setGeneratingAgenda(false);
    }
  };

  const addAttendee = () => {
    const newAttendee: EditableAttendee = {
      client_id: buildDeterministicClientId("board-attendee", [formData.company_id, attendees.length, "manual"]),
      employee_id: null,
      external_name: null,
      role: "Diğer" as AttendeeRole,
      attendance_status: "Katıldı",
      status: "invited" as AttendeeStatus,
      signature_url: null,
      notes: null,
    };

    setAttendees([...attendees, newAttendee]);
  };

  const updateAttendee = (
    index: number,
    field: keyof Omit<MeetingAttendee, "id" | "meeting_id" | "created_at">,
    value: any
  ) => {
    const updated = [...attendees];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setAttendees(updated);
  };

  const removeAttendee = (index: number) => {
    setAttendees(attendees.filter((_, i) => i !== index));
  };

  const addAgendaItem = () => {
    const newItem: EditableAgendaItem = {
      client_id: buildDeterministicClientId("board-agenda", [formData.company_id, agendaItems.length + 1, "manual"]),
      agenda_number: agendaItems.length + 1,
      topic: "",
      discussion: null,
      decision: null,
      responsible_person: null,
      deadline: null,
      status: "open" as AgendaStatus,
      is_transferred_to_risk: false,
      risk_item_id: null,
    };

    setAgendaItems([...agendaItems, newItem]);
  };

  const updateAgendaItem = (
    index: number,
    field: keyof Omit<MeetingAgenda, "id" | "meeting_id" | "created_at" | "updated_at">,
    value: any
  ) => {
    const updated = [...agendaItems];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setAgendaItems(updated);
  };

  const removeAgendaItem = (index: number) => {
    const updated = agendaItems.filter((_, i) => i !== index);
    updated.forEach((item, idx) => {
      item.agenda_number = idx + 1;
    });
    setAgendaItems(updated);
  };

  const handleSave = async (status: "draft" | "completed") => {
    if (!user) return;

    if (!formData.company_id) {
      toast.error("Lütfen bir firma seçin");
      return;
    }
    if (!formData.meeting_date) {
      toast.error("Lütfen toplantı tarihi seçin");
      return;
    }
    if (!formData.president_name) {
      toast.error("Lütfen toplantı başkanı girin");
      return;
    }
    if (attendees.length === 0) {
      toast.error("En az 1 katılımcı ekleyin");
      return;
    }

    setSaving(true);
    try {
      const meetingNumber = `${new Date().getFullYear()}/${String(
        new Date().getMonth() + 1
      ).padStart(2, "0")}-${Date.now().toString().slice(-4)}`;

      let meetingId = id;

      if (isEditMode) {
        const { error: meetingError } = await supabase
          .from("board_meetings")
          .update({
            ...formData,
            status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id!);

        if (meetingError) throw meetingError;

        await supabase.from("meeting_attendees").delete().eq("meeting_id", id!);
        await supabase.from("meeting_agenda").delete().eq("meeting_id", id!);
      } else {
        const { data: newMeeting, error: meetingError } = await supabase
          .from("board_meetings")
          .insert({
            ...formData,
            user_id: user.id,
            meeting_number: meetingNumber,
            status,
          })
          .select()
          .single();

        if (meetingError) throw meetingError;
        meetingId = newMeeting.id;
      }

      if (attendees.length > 0) {
        const { error: attendeesError } = await supabase
          .from("meeting_attendees")
          .insert(
            attendees.map(({ client_id, ...attendee }) => ({
              meeting_id: meetingId,
              ...attendee,
            }))
          );

        if (attendeesError) throw attendeesError;
      }

      if (agendaItems.length > 0) {
        const { error: agendaError } = await supabase
          .from("meeting_agenda")
          .insert(
            agendaItems.map(({ client_id, ...item }) => ({
              meeting_id: meetingId,
              ...item,
            }))
          );

        if (agendaError) throw agendaError;
      }

      toast.success(`✅ Toplantı ${isEditMode ? "güncellendi" : "oluşturuldu"}!`);
      await markSubmitted();
      setHasRestoredDraft(false);
      setRestoredDraftLabel(null);
      navigate(`/board-meetings/${meetingId}`);
    } catch (error: any) {
      console.error("Save meeting error:", error);
      toast.error("Toplantı kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const attendeeRoles: AttendeeRole[] = [
    "İşveren Vekili",
    "İSG Uzmanı",
    "İşyeri Hekimi",
    "Çalışan Temsilcisi",
    "Diğer",
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-900" />
            <div className="space-y-2">
              <div className="h-8 w-64 animate-pulse rounded bg-slate-800" />
              <div className="h-4 w-96 animate-pulse rounded bg-slate-900" />
            </div>
          </div>
          <div className="h-10 w-36 animate-pulse rounded-lg bg-slate-900" />
        </div>

        <div className="h-[760px] animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/board-meetings${requestedCompanyId ? `?companyId=${encodeURIComponent(requestedCompanyId)}` : ""}`)}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {isEditMode ? "Toplantıyı Düzenle" : "Yeni Toplantı Oluştur"}
            </h1>
            <p className="text-slate-400 text-sm">İSG Kurul Toplantısı bilgilerini doldurun</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Taslak Kaydet
          </Button>

          <Button
            onClick={() => handleSave("completed")}
            disabled={saving}
            className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Tamamla ve Kaydet
          </Button>
        </div>
      </div>

      {restoredDraftLabel ? (
        <Card className="border-cyan-400/20 bg-cyan-400/10 text-cyan-50">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold">{restoredDraftLabel} geri yüklendi</p>
              <p className="mt-1 text-sm text-cyan-100/80">
                Kaydedilmemiş alanlar otomatik olarak geri getirildi.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void discardDraft();
                setHasRestoredDraft(false);
                setRestoredDraftLabel(null);
              }}
              className="border-cyan-300/30 bg-transparent text-cyan-50 hover:bg-cyan-400/10"
            >
              Taslağı temizle
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Building2 className="h-5 w-5 text-blue-400" />
                Toplantı Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white">Firma *</Label>
                  <Select 
                    value={formData.company_id} 
                    onValueChange={(value) => {
                      setFormData({ ...formData, company_id: value });
                      // ✅ Firma değişince attendees otomatik yüklenecek (useEffect'te)
                    }}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Firma seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Toplantı Tarihi *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="date"
                      value={formData.meeting_date}
                      onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
                      className="pl-10 bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Saat</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="time"
                      value={formData.meeting_time}
                      onChange={(e) => setFormData({ ...formData, meeting_time: e.target.value })}
                      className="pl-10 bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Lokasyon</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Toplantı Salonu A"
                      className="pl-10 bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Toplantı Başkanı *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={formData.president_name}
                      onChange={(e) => setFormData({ ...formData, president_name: e.target.value })}
                      placeholder="Ad Soyad"
                      className="pl-10 bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Sekreter</Label>
                  <Input
                    value={formData.secretary_name}
                    onChange={(e) => setFormData({ ...formData, secretary_name: e.target.value })}
                    placeholder="Ad Soyad"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Notlar</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Toplantı ile ilgili ek notlar..."
                  className="bg-slate-800 border-slate-700 text-white min-h-24"
                />
              </div>
            </CardContent>
          </Card>

          {/* Attendees */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Users className="h-5 w-5 text-purple-400" />
                  Katılımcılar ({attendees.length})
                </CardTitle>
                <Button variant="outline" size="sm" onClick={addAttendee} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Katılımcı Ekle
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {attendees.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Henüz katılımcı eklenmedi</p>
                  <p className="text-sm mt-2">Firma seçtiğinizde çalışanlar otomatik eklenecek</p>
                </div>
              ) : (
                attendees.map((attendee, index) => {
                  // ✅ Çalışan bilgisini bul
                  const employee = attendee.employee_id 
                    ? employees.find(e => e.id === attendee.employee_id)
                    : null;

                  return (
                    <Card key={attendee.client_id} className="bg-slate-800/50 border-slate-700">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{index + 1}</Badge>
                            {employee && (
                              <span className="text-white font-medium">
                                {employee.first_name} {employee.last_name}
                                {employee.job_title && (
                                  <span className="text-slate-400 text-sm ml-2">
                                    ({employee.job_title})
                                  </span>
                                )}
                              </span>
                            )}
                            {attendee.external_name && (
                              <span className="text-white font-medium">
                                {attendee.external_name}
                                <Badge variant="outline" className="ml-2 text-xs">
                                  Dışarıdan
                                </Badge>
                              </span>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAttendee(index)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Rol */}
                          <div className="space-y-2">
                            <Label className="text-slate-300 text-xs">Rol</Label>
                            <Select
                              value={attendee.role || ""}
                              onValueChange={(value) => updateAttendee(index, "role", value)}
                            >
                              <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm">
                                <SelectValue placeholder="Rol seçin" />
                              </SelectTrigger>
                              <SelectContent>
                                {attendeeRoles.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {role}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Katılım Durumu */}
                          <div className="space-y-2">
                            <Label className="text-slate-300 text-xs">Katılım</Label>
                            <Select
                              value={attendee.attendance_status || "Katıldı"}
                              onValueChange={(value) => updateAttendee(index, "attendance_status", value)}
                            >
                              <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Katıldı">Katıldı</SelectItem>
                                <SelectItem value="Katılmadı">Katılmadı</SelectItem>
                                <SelectItem value="Mazeret">Mazeret</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Durum */}
                          <div className="space-y-2">
                            <Label className="text-slate-300 text-xs">Durum</Label>
                            <Select
                              value={attendee.status || "invited"}
                              onValueChange={(value) => updateAttendee(index, "status", value)}
                            >
                              <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="invited">Davet Edildi</SelectItem>
                                <SelectItem value="confirmed">Onaylandı</SelectItem>
                                <SelectItem value="attended">Katıldı</SelectItem>
                                <SelectItem value="absent">Katılmadı</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Notlar */}
                        <div className="space-y-2">
                          <Label className="text-slate-300 text-xs">Notlar</Label>
                          <Input
                            value={attendee.notes || ""}
                            onChange={(e) => updateAttendee(index, "notes", e.target.value)}
                            placeholder="Katılımcı hakkında notlar..."
                            className="bg-slate-800 border-slate-700 text-white text-sm"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Agenda */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white">
                  <FileText className="h-5 w-5 text-green-400" />
                  Gündem Maddeleri ({agendaItems.length})
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateAgenda}
                    disabled={!formData.company_id || generatingAgenda}
                    className="gap-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                  >
                    {generatingAgenda ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    AI Gündem Öner
                  </Button>
                  <Button variant="outline" size="sm" onClick={addAgendaItem} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Madde Ekle
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {agendaItems.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="mb-3">Henüz gündem maddesi eklenmedi</p>
                  <Button variant="outline" size="sm" onClick={handleGenerateAgenda} disabled={!formData.company_id} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    AI ile Gündem Oluştur
                  </Button>
                </div>
              ) : (
                agendaItems.map((item, index) => (
                  <div key={item.client_id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1">
                        <Badge variant="outline" className="shrink-0">
                          {item.agenda_number}
                        </Badge>
                        <Input
                          value={item.topic}
                          onChange={(e) => updateAgendaItem(index, "topic", e.target.value)}
                          placeholder="Gündem maddesi başlığı"
                          className="bg-slate-800 border-slate-700 text-white font-semibold"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAgendaItem(index)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <Textarea
                      value={item.discussion || ""}
                      onChange={(e) => updateAgendaItem(index, "discussion", e.target.value)}
                      placeholder="Görüşmeler ve açıklamalar..."
                      className="bg-slate-800 border-slate-700 text-white text-sm"
                      rows={2}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-400">Karar</Label>
                        <Input
                          value={item.decision || ""}
                          onChange={(e) => updateAgendaItem(index, "decision", e.target.value)}
                          placeholder="Alınan karar"
                          className="bg-slate-800 border-slate-700 text-white text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-slate-400">Sorumlu</Label>
                        <Input
                          value={item.responsible_person || ""}
                          onChange={(e) => updateAgendaItem(index, "responsible_person", e.target.value)}
                          placeholder="Sorumlu kişi"
                          className="bg-slate-800 border-slate-700 text-white text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-slate-400">Termin</Label>
                        <Input
                          type="date"
                          value={item.deadline || ""}
                          onChange={(e) => updateAgendaItem(index, "deadline", e.target.value)}
                          className="bg-slate-800 border-slate-700 text-white text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Quick Info */}
        <div className="space-y-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-lg">Hızlı Bilgi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Katılımcı Sayısı</span>
                <Badge variant="outline">{attendees.length}</Badge>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Gündem Maddesi</span>
                <Badge variant="outline">{agendaItems.length}</Badge>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Katılan</span>
                <Badge variant="outline" className="bg-green-500/20 text-green-400">
                  {attendees.filter((a) => a.attendance_status === "Katıldı").length}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Katılmayan</span>
                <Badge variant="outline" className="bg-red-500/20 text-red-400">
                  {attendees.filter((a) => a.attendance_status === "Katılmadı").length}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {selectedCompany && (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white text-lg">Firma Bilgisi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-400 text-xs mb-1">Firma Adı</p>
                  <p className="text-white font-semibold">{selectedCompany.name}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-1">Sektör</p>
                  <p className="text-white">{selectedCompany.industry || "-"}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-1">Çalışan Sayısı</p>
                  <p className="text-white">{employees.length}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Sparkles className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-white mb-1">✨ Otomatik Katılımcı</p>
                  <p className="text-slate-300 text-xs">
                    Firma seçtiğinizde, o firmaya kayıtlı tüm aktif çalışanlar otomatik olarak katılımcı listesine eklenecektir.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Sparkles className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-white mb-1">🤖 AI Gündem Önerisi</p>
                  <p className="text-slate-300 text-xs">
                    "AI Gündem Öner" butonuna tıklayarak sektöre özel profesyonel gündem maddeleri oluşturabilirsiniz.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
