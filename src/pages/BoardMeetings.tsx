import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Plus,
  Calendar,
  Building2,
  FileText,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  Edit,
  Trash2,
  Eye,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { MeetingStatus } from "@/types/boardMeeting";

interface Company {
  id: string;
  name: string;
  industry: string | null;
}

interface BoardMeetingListItem {
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
  company?: Company;
  attendee_count?: number;
  agenda_count?: number;
}

const getBoardMeetingsCacheKey = (userId: string) =>
  `denetron:board-meetings:${userId}`;

export default function BoardMeetings() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [meetings, setMeetings] = useState<BoardMeetingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    if (user) {
      const cached = sessionStorage.getItem(getBoardMeetingsCacheKey(user.id));
      if (cached) {
        try {
          setMeetings(JSON.parse(cached) as BoardMeetingListItem[]);
          setLoading(false);
        } catch {
          sessionStorage.removeItem(getBoardMeetingsCacheKey(user.id));
        }
      }
      void fetchMeetings(Boolean(cached));
    }
  }, [user]);

  const fetchMeetings = async (silent = false) => {
    if (!user) return;

    if (!silent) {
      setLoading(true);
    }
    try {
      console.log("Board meetings loading...");

      const { data: meetingsData, error: meetingsError } = await supabase
        .from("board_meetings")
        .select(`
          *,
          company:companies(id, name, industry)
        `)
        .eq("user_id", user.id)
        .order("meeting_date", { ascending: false });

      if (meetingsError) throw meetingsError;

      const meetingsWithCounts = await Promise.all(
        (meetingsData || []).map(async (meeting) => {
          const { count: attendeeCount } = await supabase
            .from("meeting_attendees")
            .select("*", { count: "exact", head: true })
            .eq("meeting_id", meeting.id);

          const { count: agendaCount } = await supabase
            .from("meeting_agenda")
            .select("*", { count: "exact", head: true })
            .eq("meeting_id", meeting.id);

          return {
            ...meeting,
            attendee_count: attendeeCount || 0,
            agenda_count: agendaCount || 0,
          };
        })
      );

      console.log("Board meetings loaded:", meetingsWithCounts);
      setMeetings(meetingsWithCounts as BoardMeetingListItem[]);
      sessionStorage.setItem(
        getBoardMeetingsCacheKey(user.id),
        JSON.stringify(meetingsWithCounts)
      );
    } catch (error: any) {
      console.error("Board meetings load error:", error);
      toast.error("Toplant\u0131lar y\u00fcklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!confirm("Bu toplant\u0131y\u0131 silmek istedi\u011finize emin misiniz?")) return;

    try {
      const { error } = await supabase
        .from("board_meetings")
        .delete()
        .eq("id", meetingId);

      if (error) throw error;

      setMeetings((prev) => prev.filter((meeting) => meeting.id !== meetingId));
      toast.success("Toplant\u0131 silindi");
    } catch (error: any) {
      console.error("Delete meeting error:", error);
      toast.error("Toplant\u0131 silinemedi");
    }
  };

  const getStatusBadge = (status: MeetingStatus) => {
    const statusConfig = {
      draft: {
        label: "Taslak",
        icon: Clock,
        className: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
      },
      completed: {
        label: "Tamamland\u0131",
        icon: CheckCircle2,
        className: "bg-green-500/20 text-green-600 border-green-500/30",
      },
      cancelled: {
        label: "\u0130ptal",
        icon: XCircle,
        className: "bg-red-500/20 text-red-600 border-red-500/30",
      },
    } as const;

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge variant="outline" className={config.className}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const filteredMeetings = meetings.filter((meeting) => {
    const companyName = meeting.company?.name?.toLowerCase() || "";
    const location = meeting.location?.toLowerCase() || "";
    const meetingNumber = meeting.meeting_number?.toLowerCase() || "";
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      companyName.includes(search) ||
      location.includes(search) ||
      meetingNumber.includes(search);

    const matchesStatus =
      filterStatus === "all" || meeting.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-72 animate-pulse rounded bg-slate-800" />
            <div className="h-4 w-96 animate-pulse rounded bg-slate-900" />
          </div>
          <div className="h-10 w-36 animate-pulse rounded-lg bg-slate-900" />
        </div>

        <div className="h-12 animate-pulse rounded-xl bg-slate-900/70" />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70"
            />
          ))}
        </div>

        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <Users className="h-8 w-8 text-blue-500" />
            {"\u0130SG Kurul Toplant\u0131lar\u0131"}
          </h1>
          <p className="mt-1 text-slate-400">
            {"Toplant\u0131lar\u0131 y\u00f6netin, g\u00fcndem olu\u015fturun ve tutanak \u00e7\u0131kar\u0131n"}
          </p>
        </div>

        <Button
          onClick={() => navigate("/board-meetings/new")}
          className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          <Plus className="h-4 w-4" />
          {"Yeni Toplant\u0131"}
        </Button>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => navigate("/board-meetings/guide")}
          className="gap-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
        >
          <BookOpen className="h-4 w-4" />
          {"Nas\u0131l Kullan\u0131l\u0131r?"}
        </Button>

        <Button
          onClick={() => navigate("/board-meetings/new")}
          className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          <Plus className="h-4 w-4" />
          {"Yeni Toplant\u0131"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{"Toplam Toplant\u0131"}</p>
                <p className="mt-1 text-2xl font-bold text-white">{meetings.length}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Tamamlanan</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {meetings.filter((meeting) => meeting.status === "completed").length}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                <CheckCircle2 className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Taslak</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {meetings.filter((meeting) => meeting.status === "draft").length}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/20">
                <Clock className="h-6 w-6 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Bu Ay</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {
                    meetings.filter(
                      (meeting) =>
                        new Date(meeting.meeting_date).getMonth() === new Date().getMonth()
                    ).length
                  }
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/20">
                <Calendar className="h-6 w-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder={"Firma, lokasyon veya toplant\u0131 no ile ara..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-slate-700 bg-slate-800 pl-10 text-white"
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full border-slate-700 bg-slate-800 text-white md:w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{"T\u00fcm Durumlar"}</SelectItem>
                <SelectItem value="draft">Taslak</SelectItem>
                <SelectItem value="completed">{"Tamamland\u0131"}</SelectItem>
                <SelectItem value="cancelled">{"\u0130ptal"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredMeetings.length === 0 ? (
          <Card className="border-slate-800 bg-slate-900/50">
            <CardContent className="p-12 text-center">
              <Users className="mx-auto mb-4 h-16 w-16 text-slate-600" />
              <h3 className="mb-2 text-lg font-semibold text-white">{"Hen\u00fcz toplant\u0131 yok"}</h3>
              <p className="mb-6 text-slate-400">
                {'\u0130lk \u0130SG kurul toplant\u0131n\u0131z\u0131 olu\u015fturmak i\u00e7in "Yeni Toplant\u0131" butonuna t\u0131klay\u0131n.'}
              </p>
              <Button
                onClick={() => navigate("/board-meetings/new")}
                className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600"
              >
                <Plus className="h-4 w-4" />
                {"Yeni Toplant\u0131 Olu\u015ftur"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredMeetings.map((meeting) => (
            <Card
              key={meeting.id}
              className="border-slate-800 bg-slate-900/50 transition-all hover:border-blue-500/30"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-3 flex items-center gap-3">
                      <h3 className="text-lg font-bold text-white">
                        {meeting.meeting_number || "Toplant\u0131"}
                      </h3>
                      {getStatusBadge(meeting.status)}
                    </div>

                    <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Building2 className="h-4 w-4" />
                        <span>{meeting.company?.name}</span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-400">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {new Date(meeting.meeting_date).toLocaleDateString("tr-TR")}
                          {meeting.meeting_time && ` - ${meeting.meeting_time}`}
                        </span>
                      </div>

                      {meeting.location && (
                        <div className="flex items-center gap-2 text-slate-400">
                          <Users className="h-4 w-4" />
                          <span>{meeting.location}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-slate-400">
                        <FileText className="h-4 w-4" />
                        <span>
                          {meeting.attendee_count || 0} {"Kat\u0131l\u0131mc\u0131"} · {meeting.agenda_count || 0} {"G\u00fcndem"}
                        </span>
                      </div>
                    </div>

                    {meeting.president_name && (
                      <p className="mt-2 text-sm text-slate-500">
                        {"Ba\u015fkan:"} {meeting.president_name}
                      </p>
                    )}
                  </div>

                  <div className="ml-4 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/board-meetings/${meeting.id}`)}
                      className="text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/board-meetings/${meeting.id}/edit`)}
                      className="text-slate-400 hover:bg-slate-800 hover:text-white"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>

                    {meeting.pdf_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(meeting.pdf_url, "_blank", "noopener,noreferrer")}
                        className="text-green-400 hover:bg-green-500/10 hover:text-green-300"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteMeeting(meeting.id)}
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
