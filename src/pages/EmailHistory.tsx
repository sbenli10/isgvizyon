import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Mail,
  CalendarDays,
  User,
  FileText,
  ExternalLink,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Send,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ReportType = "risk_assessment" | "dof" | "adep" | "inspection";
type EmailStatus = "sent" | "failed" | "bounced";

interface EmailLog {
  id: string;
  recipient_email: string;
  subject: string;
  report_type: ReportType;
  report_url: string;
  status: EmailStatus;
  created_at: string;
}

const PAGE_SIZE = 8;

const reportTypeLabels: Record<ReportType, string> = {
  risk_assessment: "Risk Raporu",
  dof: "DÖF Raporu",
  adep: "ADEP Planı",
  inspection: "Denetim Raporu",
};

const statusLabels: Record<EmailStatus, string> = {
  sent: "Gönderildi",
  failed: "Başarısız",
  bounced: "Teslim Edilemedi",
};

const statusTone: Record<
  EmailStatus,
  {
    badge: string;
    dot: string;
    card: string;
  }
> = {
  sent: {
    badge: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
    dot: "bg-emerald-400",
    card: "border-emerald-500/10",
  },
  failed: {
    badge: "border-red-400/20 bg-red-500/10 text-red-100",
    dot: "bg-red-400",
    card: "border-red-500/10",
  },
  bounced: {
    badge: "border-amber-400/20 bg-amber-500/10 text-amber-100",
    dot: "bg-amber-400",
    card: "border-amber-500/10",
  },
};

const reportTypeTone: Record<ReportType, string> = {
  risk_assessment: "border-cyan-400/20 bg-cyan-500/10 text-cyan-100",
  dof: "border-violet-400/20 bg-violet-500/10 text-violet-100",
  adep: "border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100",
  inspection: "border-sky-400/20 bg-sky-500/10 text-sky-100",
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function EmailHistory() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EmailStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ReportType | "all">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    void loadEmailLogs();
  }, [user?.id]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter, startDate, endDate]);

  const loadEmailLogs = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profileData?.organization_id) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("email_logs")
      .select("*")
      .eq("org_id", profileData.organization_id)
      .order("created_at", { ascending: false })
      .limit(250);

    if (error) {
      toast.error("E-posta geçmişi yüklenemedi");
      setLoading(false);
      return;
    }

    setLogs((data || []) as EmailLog[]);
    setLoading(false);
  };

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesSearch =
        !query ||
        log.recipient_email.toLowerCase().includes(query) ||
        log.subject.toLowerCase().includes(query) ||
        reportTypeLabels[log.report_type].toLowerCase().includes(query);

      const matchesStatus = statusFilter === "all" || log.status === statusFilter;
      const matchesType = typeFilter === "all" || log.report_type === typeFilter;
      const logDate = new Date(log.created_at);
      const matchesStartDate = !startDate || logDate >= new Date(`${startDate}T00:00:00`);
      const matchesEndDate = !endDate || logDate <= new Date(`${endDate}T23:59:59`);

      return matchesSearch && matchesStatus && matchesType && matchesStartDate && matchesEndDate;
    });
  }, [logs, search, statusFilter, typeFilter, startDate, endDate]);

  const sentCount = useMemo(() => logs.filter((item) => item.status === "sent").length, [logs]);
  const failedCount = useMemo(() => logs.filter((item) => item.status === "failed").length, [logs]);
  const bouncedCount = useMemo(() => logs.filter((item) => item.status === "bounced").length, [logs]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredLogs]);

  return (
    <div className="container mx-auto space-y-6 py-6">
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
        <div className="flex flex-col gap-6 px-6 py-7 lg:flex-row lg:items-start lg:justify-between lg:px-8">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
              <Send className="h-3.5 w-3.5" />
              Gönderim Merkezi
            </div>
            <div className="space-y-2">
              <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-white">
                <Mail className="h-8 w-8 text-cyan-300" />
                E-posta Geçmişi
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300 lg:text-base">
                Firmalara iletilen raporları, teslim durumlarını ve geçmiş hareketleri daha sade bir akışta izleyin.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <Button
              variant="outline"
              className="gap-2 rounded-2xl border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
              onClick={() => void loadEmailLogs()}
            >
              <RefreshCw className="h-4 w-4" />
              Listeyi Yenile
            </Button>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
              Sonuç: <span className="font-semibold text-white">{filteredLogs.length}</span> kayıt
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-white/10 bg-slate-950/70">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">Toplam kayıt</CardDescription>
            <CardTitle className="text-3xl text-white">{logs.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-emerald-500/15 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-emerald-100/70">Başarıyla iletildi</CardDescription>
            <CardTitle className="text-3xl text-emerald-300">{sentCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-red-500/15 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-red-100/70">Gönderim hatası</CardDescription>
            <CardTitle className="text-3xl text-red-300">{failedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-amber-500/15 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-amber-100/70">Teslim edilemedi</CardDescription>
            <CardTitle className="text-3xl text-amber-300">{bouncedCount}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card className="border-white/10 bg-slate-950/70 shadow-[0_16px_40px_rgba(2,6,23,0.28)]">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-xl text-white">Gönderim kayıtları</CardTitle>
              <CardDescription className="text-slate-400">
                Kayıtları arayın, filtreleyin ve rapor bağlantılarını güvenli şekilde açın.
              </CardDescription>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-400">
              <Filter className="h-3.5 w-3.5" />
              Profesyonel görünüm • Sayfalı liste
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.4fr_0.4fr_0.35fr_0.35fr]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Alıcı, konu veya rapor türü ara..."
                className="h-11 rounded-2xl border-white/10 bg-white/[0.04] pl-10 text-slate-100 placeholder:text-slate-500"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as EmailStatus | "all")}>
              <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-slate-100">
                <SelectValue placeholder="Durum filtrele" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm durumlar</SelectItem>
                <SelectItem value="sent">Gönderildi</SelectItem>
                <SelectItem value="failed">Başarısız</SelectItem>
                <SelectItem value="bounced">Teslim Edilemedi</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as ReportType | "all")}>
              <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-slate-100">
                <SelectValue placeholder="Rapor türü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm raporlar</SelectItem>
                <SelectItem value="risk_assessment">Risk Raporu</SelectItem>
                <SelectItem value="dof">DÖF Raporu</SelectItem>
                <SelectItem value="adep">ADEP Planı</SelectItem>
                <SelectItem value="inspection">Denetim Raporu</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-slate-100"
            />

            <Input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-slate-100"
            />
          </div>

          {(startDate || endDate) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/15 bg-cyan-500/5 px-4 py-3 text-sm">
              <div className="text-slate-300">
                Tarih aralığı filtresi aktif:
                <span className="ml-2 font-semibold text-cyan-100">
                  {startDate || "Başlangıç yok"} - {endDate || "Bitiş yok"}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
              >
                Tarih filtresini temizle
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3 py-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
              ))}
            </div>
          ) : pagedLogs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
              <Mail className="mx-auto h-10 w-10 text-slate-600" />
              <h3 className="mt-4 text-lg font-semibold text-slate-100">Kayıt bulunamadı</h3>
              <p className="mt-2 text-sm text-slate-400">
                Arama veya filtreleri değiştirerek sonucu daraltmayı deneyin.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.7),rgba(15,23,42,0.5))]">
                <div className="hidden grid-cols-[1.3fr_0.9fr_0.6fr_0.6fr_0.55fr] gap-4 border-b border-white/10 px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 lg:grid">
                  <span>Konu ve alıcı</span>
                  <span>Tarih</span>
                  <span>Rapor türü</span>
                  <span>Durum</span>
                  <span className="text-right">İşlem</span>
                </div>

                <div className="divide-y divide-white/10">
                  {pagedLogs.map((log) => (
                    <div
                      key={log.id}
                      className={cn(
                        "grid gap-4 px-5 py-5 transition-colors hover:bg-white/[0.03] lg:grid-cols-[1.3fr_0.9fr_0.6fr_0.6fr_0.55fr] lg:items-center",
                        statusTone[log.status].card,
                      )}
                    >
                      <div className="min-w-0 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-400/15 bg-cyan-500/10 text-cyan-200">
                            <FileText className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white lg:text-base">{log.subject}</p>
                            <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                              <User className="h-3.5 w-3.5" />
                              <span className="truncate">{log.recipient_email}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="text-sm text-slate-300">
                        <p className="flex items-center gap-2">
                          <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
                          {formatDateTime(log.created_at)}
                        </p>
                      </div>

                      <div>
                        <Badge className={cn("border", reportTypeTone[log.report_type])}>
                          {reportTypeLabels[log.report_type]}
                        </Badge>
                      </div>

                      <div>
                        <Badge className={cn("border", statusTone[log.status].badge)}>
                          <span className={cn("mr-2 inline-block h-2 w-2 rounded-full", statusTone[log.status].dot)} />
                          {statusLabels[log.status]}
                        </Badge>
                      </div>

                      <div className="flex justify-start lg:justify-end">
                        <a
                          href={log.report_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/[0.08]"
                        >
                          {log.status === "sent" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-300" />
                          )}
                          Raporu Aç
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {filteredLogs.length > PAGE_SIZE ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    Sayfa <span className="font-semibold text-slate-100">{currentPage}</span> /{" "}
                    <span className="font-semibold text-slate-100">{totalPages}</span>
                    <span className="mx-2 text-slate-600">•</span>
                    Toplam <span className="font-semibold text-slate-100">{filteredLogs.length}</span> kayıt
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-xl border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                      disabled={currentPage === 1}
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Önceki
                    </Button>

                    <div className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-200">
                      {currentPage}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-xl border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                      disabled={currentPage === totalPages}
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                      Sonraki
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
