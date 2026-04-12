import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, DatabaseZap, RefreshCcw, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listOsgbBatchLogs, type OsgbBatchLogRecord } from "@/lib/osgbOperations";
import { readOsgbPageCache, writeOsgbPageCache } from "@/lib/osgbPageCache";
import { downloadCsv } from "@/lib/csvExport";

const CACHE_TTL_MS = 3 * 60 * 1000;
const getCacheKey = (userId: string) => `batch-logs:${userId}`;

const statusClass: Record<OsgbBatchLogRecord["status"], string> = {
  success: "bg-emerald-500/15 text-emerald-200 border-emerald-400/20",
  error: "bg-red-500/15 text-red-200 border-red-400/20",
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR");
};

export default function OSGBBatchLogs() {
  const { user } = useAuth();
  const [records, setRecords] = useState<OsgbBatchLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedLog, setSelectedLog] = useState<OsgbBatchLogRecord | null>(null);

  const loadData = async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setLoading(true);
    try {
      const rows = await listOsgbBatchLogs(user.id);
      setRecords(rows);
      writeOsgbPageCache(getCacheKey(user.id), rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch logları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const cached = readOsgbPageCache<OsgbBatchLogRecord[]>(getCacheKey(user.id), CACHE_TTL_MS);
    if (cached) {
      setRecords(cached);
      setLoading(false);
      void loadData(true);
      return;
    }
    void loadData();
  }, [user?.id]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesStatus = statusFilter === "ALL" || record.status === statusFilter;
      const matchesQuery =
        !query ||
        [record.batch_type, record.run_source, record.error_message || ""].some((value) =>
          value.toLowerCase().includes(query),
        );
      return matchesStatus && matchesQuery;
    });
  }, [records, search, statusFilter]);

  const summary = useMemo(() => ({
    total: records.length,
    success: records.filter((item) => item.status === "success").length,
    error: records.filter((item) => item.status === "error").length,
    created: records.reduce((sum, item) => sum + item.created_count, 0),
  }), [records]);

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
              <DatabaseZap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">OSGB Batch Logları</h1>
              <p className="text-sm text-slate-400">
                Günlük batch çalışmaları, üretilen görev sayıları ve hata kayıtları burada tutulur.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                "osgb-batch-loglari.csv",
                ["Tarih", "Batch Tipi", "Kaynak", "Durum", "İşlenen", "Oluşturulan", "Atlanan", "Hata"],
                filteredRecords.map((record) => [
                  record.created_at,
                  record.batch_type,
                  record.run_source,
                  record.status,
                  record.processed_count,
                  record.created_count,
                  record.skipped_count,
                  record.error_message || "",
                ]),
              )
            }
          >
            Dışa Aktar
          </Button>
          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Yenile
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader className="pb-2"><CardDescription>Toplam çalışma</CardDescription><CardTitle className="text-3xl text-white">{summary.total}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader className="pb-2"><CardDescription>Başarılı</CardDescription><CardTitle className="text-3xl text-emerald-200">{summary.success}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader className="pb-2"><CardDescription>Hata</CardDescription><CardTitle className="text-3xl text-red-200">{summary.error}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader className="pb-2"><CardDescription>Üretilen görev</CardDescription><CardTitle className="text-3xl text-cyan-200">{summary.created}</CardTitle></CardHeader></Card>
      </div>

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-white">Filtreler</CardTitle>
          <CardDescription>Batch tipi, kaynak ve hata detayına göre geçmişi tarayın.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Batch tipi, kaynak veya hata mesajı ara" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tüm durumlar</SelectItem>
              <SelectItem value="success">Başarılı</SelectItem>
              <SelectItem value="error">Hata</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Batch logları yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-white">Çalışma geçmişi</CardTitle>
          <CardDescription>Son 200 batch log kaydı.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-xl border border-slate-800 bg-slate-950/50" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead>Tarih</TableHead>
                  <TableHead>Batch tipi</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>İşlenen</TableHead>
                  <TableHead>Oluşan</TableHead>
                  <TableHead>Atlanan</TableHead>
                  <TableHead>Hata</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-400">
                      Batch log kaydı bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => (
                    <TableRow key={record.id} className="border-slate-800">
                      <TableCell className="text-slate-300">{formatDateTime(record.created_at)}</TableCell>
                      <TableCell className="text-slate-300">{record.batch_type}</TableCell>
                      <TableCell className="text-slate-300">{record.run_source}</TableCell>
                      <TableCell>
                        <Badge className={`border ${statusClass[record.status]}`}>{record.status === "success" ? "Başarılı" : "Hata"}</Badge>
                      </TableCell>
                      <TableCell>{record.processed_count}</TableCell>
                      <TableCell>{record.created_count}</TableCell>
                      <TableCell>{record.skipped_count}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-xs text-slate-400">{record.error_message || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedLog(record)}>Detay</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Batch log detayı</DialogTitle>
          </DialogHeader>
          {selectedLog ? (
            <div className="grid gap-4 text-sm text-slate-300">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">Tarih: <span className="font-medium text-white">{formatDateTime(selectedLog.created_at)}</span></div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">Durum: <span className="font-medium text-white">{selectedLog.status}</span></div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">Batch tipi: <span className="font-medium text-white">{selectedLog.batch_type}</span></div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">Kaynak: <span className="font-medium text-white">{selectedLog.run_source}</span></div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">İşlenen: <span className="font-medium text-white">{selectedLog.processed_count}</span></div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">Oluşturulan: <span className="font-medium text-white">{selectedLog.created_count}</span></div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                <div className="mb-2 font-medium text-white">Atlanan kayıt</div>
                <div>{selectedLog.skipped_count}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                <div className="mb-2 font-medium text-white">Hata detayı</div>
                <div className="whitespace-pre-wrap break-words text-xs text-slate-400">{selectedLog.error_message || "Hata kaydı yok."}</div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
