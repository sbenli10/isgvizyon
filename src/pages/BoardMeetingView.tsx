import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Edit,
  Download,
  Trash2,
  Calendar,
  MapPin,
  Users,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  User,
  Building2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type {
  BoardMeetingWithRelations,
  MeetingAttendee,
  MeetingAgenda,
  AttendeeStatus,
  AgendaStatus,
  AttendeeRole,
} from "@/types/boardMeeting";
import { generateBoardMeetingPDF } from "@/utils/boardMeetingPdfGenerator";

interface EmployeeData {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string;
  department: string | null;
}

interface CompanyData {
  id: string;
  name: string;
  industry: string | null;
  address: string | null;
}

interface AttendeeWithEmployee extends MeetingAttendee {
  employee?: EmployeeData | null;
}

export default function BoardMeetingView() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState<BoardMeetingWithRelations | null>(null);
  const [attendees, setAttendees] = useState<AttendeeWithEmployee[]>([]);
  const [agenda, setAgenda] = useState<MeetingAgenda[]>([]);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    if (id) {
      fetchMeetingData();
    }
  }, [id]);

  const fetchMeetingData = async () => {
    if (!id) return;

    setLoading(true);
    try {
      // Fetch meeting
      const { data: meetingData, error: meetingError } = await supabase
        .from("board_meetings")
        .select(`
          *,
          company:companies(id, name, industry, address)
        `)
        .eq("id", id)
        .single();

      if (meetingError) throw meetingError;

      setMeeting(meetingData as any);
      setCompany(meetingData.company as any);

      // Fetch attendees with employee details
      const { data: attendeesData, error: attendeesError } = await supabase
        .from("meeting_attendees")
        .select(`
          *,
          employee:employees(id, first_name, last_name, job_title, department)
        `)
        .eq("meeting_id", id);

      if (attendeesError) throw attendeesError;

      // Type cast attendees
      const typedAttendees: AttendeeWithEmployee[] = (attendeesData || []).map((att) => ({
        id: att.id,
        meeting_id: att.meeting_id,
        employee_id: att.employee_id,
        external_name: att.external_name,
        role: att.role as AttendeeRole,
        attendance_status: att.attendance_status,
        status: att.status as AttendeeStatus,
        signature_url: att.signature_url,
        notes: att.notes,
        created_at: att.created_at,
        employee: att.employee
          ? {
              id: att.employee.id,
              first_name: att.employee.first_name,
              last_name: att.employee.last_name,
              job_title: att.employee.job_title,
              department: att.employee.department,
            }
          : null,
      }));

      setAttendees(typedAttendees);

      // Fetch agenda
      const { data: agendaData, error: agendaError } = await supabase
        .from("meeting_agenda")
        .select("*")
        .eq("meeting_id", id)
        .order("agenda_number");

      if (agendaError) throw agendaError;

      // Type cast agenda
      const typedAgenda: MeetingAgenda[] = (agendaData || []).map((item) => ({
        id: item.id,
        meeting_id: item.meeting_id,
        agenda_number: item.agenda_number,
        topic: item.topic,
        discussion: item.discussion,
        decision: item.decision,
        responsible_person: item.responsible_person,
        deadline: item.deadline,
        status: item.status as AgendaStatus,
        is_transferred_to_risk: item.is_transferred_to_risk,
        risk_item_id: item.risk_item_id,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));

      setAgenda(typedAgenda);
    } catch (error: any) {
      console.error("Fetch meeting error:", error);
      toast.error("Toplantı yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!meeting) {
      toast.error("Toplantı bilgisi yüklenemedi");
      return;
    }

    setGeneratingPDF(true);

    try {
      const pdfData = {
        meeting_number: meeting.meeting_number,
        meeting_date: meeting.meeting_date,
        meeting_time: meeting.meeting_time || "",
        location: meeting.location || "",
        president_name: meeting.president_name,
        secretary_name: meeting.secretary_name || "",
        status: meeting.status,
        company_name: company?.name || "",
        company_industry: company?.industry || "",
        attendees: attendees.map((att) => ({
          name: att.employee
            ? `${att.employee.first_name} ${att.employee.last_name}`
            : att.external_name || "Bilinmeyen",
          role: att.role || "",
          attendance_status: att.attendance_status || "Katıldı",
        })),
        agenda: agenda.map((item) => ({
          agenda_number: item.agenda_number,
          topic: item.topic,
          discussion: item.discussion || "",
          decision: item.decision || "",
          responsible_person: item.responsible_person || "",
          deadline: item.deadline || "",
        })),
        decisions: agenda
          .filter((item) => item.decision)
          .map((item, index) => ({
            decision_number: index + 1,
            description: item.decision || "",
            responsible: item.responsible_person || "",
            deadline: item.deadline || "",
          })),
      };

      generateBoardMeetingPDF(pdfData);
      toast.success("PDF başarıyla oluşturuldu!");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("PDF oluşturulurken hata oluştu");
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    if (!confirm("Bu toplantıyı silmek istediğinize emin misiniz?")) return;

    try {
      const { error } = await supabase.from("board_meetings").delete().eq("id", id);

      if (error) throw error;

      toast.success("✅ Toplantı silindi");
      navigate("/board-meetings");
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Toplantı silinemedi");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      invited: { label: "Davetli", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
      confirmed: { label: "Onaylandı", className: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
      attended: { label: "Katıldı", className: "bg-green-500/20 text-green-400 border-green-500/30" },
      absent: { label: "Katılmadı", className: "bg-red-500/20 text-red-400 border-red-500/30" },
      excused: { label: "Mazeret", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    };

    const config = statusMap[status] || statusMap.invited;

    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getEmployeeName = (attendee: AttendeeWithEmployee): string => {
    if (attendee.employee) {
      return `${attendee.employee.first_name} ${attendee.employee.last_name}`;
    }
    return attendee.external_name || "İsimsiz";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-900" />
            <div className="space-y-2">
              <div className="h-8 w-64 animate-pulse rounded bg-slate-800" />
              <div className="h-4 w-80 animate-pulse rounded bg-slate-900" />
            </div>
          </div>
          <div className="h-10 w-32 animate-pulse rounded-lg bg-slate-900" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="h-[620px] animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
          <div className="space-y-6">
            <div className="h-64 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
            <div className="h-64 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
          </div>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <p className="text-white text-lg mb-2">Toplantı bulunamadı</p>
          <p className="text-slate-400 text-sm mb-4">Bu toplantı silinmiş veya erişim izniniz yok</p>
          <Button onClick={() => navigate("/board-meetings")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Toplantılara Dön
          </Button>
        </div>
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
            onClick={() => navigate("/board-meetings")}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{meeting.meeting_number || "Toplantı Detayı"}</h1>
              {meeting.status === "completed" && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Tamamlandı
                </Badge>
              )}
              {meeting.status === "draft" && (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  <Clock className="h-3 w-3 mr-1" />
                  Taslak
                </Badge>
              )}
              {meeting.status === "cancelled" && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                  <XCircle className="h-3 w-3 mr-1" />
                  İptal
                </Badge>
              )}
            </div>
            <p className="text-slate-400 text-sm mt-1">
              {new Date(meeting.meeting_date).toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadPDF}
            disabled={generatingPDF}
            className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-blue-600 hover:from-blue-700 hover:to-purple-700"
          >
            {generatingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            PDF İndir
          </Button>

          <Button variant="outline" onClick={() => navigate(`/board-meetings/${id}/edit`)} className="gap-2">
            <Edit className="h-4 w-4" />
            Düzenle
          </Button>

          <Button
            variant="outline"
            onClick={handleDelete}
            className="gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
            Sil
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Meeting Info */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Building2 className="h-5 w-5 text-blue-400" />
                Toplantı Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Firma</p>
                  <p className="text-white font-semibold">{company?.name || "-"}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-400 mb-1">Tarih & Saat</p>
                  <div className="flex items-center gap-2 text-white">
                    <Calendar className="h-4 w-4 text-blue-400" />
                    {new Date(meeting.meeting_date).toLocaleDateString("tr-TR")}
                    {meeting.meeting_time && (
                      <>
                        <Clock className="h-4 w-4 text-blue-400 ml-2" />
                        {meeting.meeting_time}
                      </>
                    )}
                  </div>
                </div>

                {meeting.location && (
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Lokasyon</p>
                    <div className="flex items-center gap-2 text-white">
                      <MapPin className="h-4 w-4 text-purple-400" />
                      {meeting.location}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm text-slate-400 mb-1">Toplantı Başkanı</p>
                  <div className="flex items-center gap-2 text-white">
                    <User className="h-4 w-4 text-green-400" />
                    {meeting.president_name}
                  </div>
                </div>

                {meeting.secretary_name && (
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Sekreter</p>
                    <p className="text-white">{meeting.secretary_name}</p>
                  </div>
                )}
              </div>

              {meeting.notes && (
                <div className="pt-4 border-t border-slate-800">
                  <p className="text-sm text-slate-400 mb-2">Notlar</p>
                  <p className="text-white text-sm">{meeting.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attendees */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Users className="h-5 w-5 text-purple-400" />
                Katılımcılar ({attendees.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attendees.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Katılımcı bulunmamaktadır</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {attendees.map((attendee) => (
                    <div
                      key={attendee.id}
                      className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-white">{getEmployeeName(attendee)}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {attendee.role}
                          </Badge>
                          {attendee.employee?.job_title && (
                            <span className="text-xs text-slate-400">{attendee.employee.job_title}</span>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(attendee.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agenda */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <FileText className="h-5 w-5 text-green-400" />
                Gündem ve Kararlar ({agenda.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agenda.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Gündem maddesi bulunmamaktadır</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {agenda.map((item) => (
                    <div key={item.id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex items-start gap-3 mb-3">
                        <Badge variant="outline" className="shrink-0 mt-1">
                          {item.agenda_number}
                        </Badge>
                        <div className="flex-1">
                          <h4 className="font-semibold text-white mb-2">{item.topic}</h4>
                          {item.discussion && <p className="text-sm text-slate-300 mb-3">{item.discussion}</p>}
                          {item.decision && (
                            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-3">
                              <p className="text-xs text-blue-400 font-semibold mb-1">Karar</p>
                              <p className="text-sm text-white">{item.decision}</p>
                            </div>
                          )}
                          {(item.responsible_person || item.deadline) && (
                            <div className="flex items-center gap-4 text-xs text-slate-400">
                              {item.responsible_person && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  Sorumlu: {item.responsible_person}
                                </div>
                              )}
                              {item.deadline && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Termin: {new Date(item.deadline).toLocaleDateString("tr-TR")}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-lg">İstatistikler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Toplam Katılımcı</span>
                <Badge variant="outline">{attendees.length}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Katılan</span>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  {attendees.filter((a) => a.status === "attended").length}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Katılmayan</span>
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                  {attendees.filter((a) => a.status === "absent").length}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Gündem Sayısı</span>
                <Badge variant="outline">{agenda.length}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Karar Sayısı</span>
                <Badge variant="outline">{agenda.filter((a) => a.decision).length}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Company Info */}
          {company && (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white text-lg">Firma Bilgisi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-400 text-xs mb-1">Firma Adı</p>
                  <p className="text-white font-semibold">{company.name}</p>
                </div>
                {company.industry && (
                  <div>
                    <p className="text-slate-400 text-xs mb-1">Sektör</p>
                    <p className="text-white">{company.industry}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30">
            <CardContent className="p-4 space-y-3">
              <Button
                onClick={handleDownloadPDF}
                disabled={generatingPDF}
                className="w-full gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {generatingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Resmi Tutanak İndir
              </Button>

              <p className="text-xs text-slate-300 text-center">
                Mevzuata uygun resmi tutanak PDF'i oluşturun
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
