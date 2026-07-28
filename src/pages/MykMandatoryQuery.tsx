import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  filterMykQualifications,
  loadLatestMykSyncLog,
  loadMykMandatoryQualifications,
  MYK_SOURCE_URL,
  syncMykMandatoryQualifications,
  type MykMandatoryQualification,
  type MykSyncLog,
} from "@/lib/mykMandatory";
import { cn } from "@/lib/utils";

type SortMode = "name-asc" | "name-desc" | "date-desc" | "date-asc" | "code-asc";
type DateFilter = "all" | "known" | "unknown" | "2016" | "2017-2019" | "2020-plus";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const inputClass =
  "h-12 rounded-lg border-slate-600 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:border-indigo-400";

const selectContentClass = "z-[90] max-h-80 border-slate-700 bg-slate-950 text-white";

const turkishMonthMap: Record<string, number> = {
  ocak: 0,
  şubat: 1,
  subat: 1,
  mart: 2,
  nisan: 3,
  mayıs: 4,
  mayis: 4,
  haziran: 5,
  temmuz: 6,
  ağustos: 7,
  agustos: 7,
  eylül: 8,
  eylul: 8,
  ekim: 9,
  kasım: 10,
  kasim: 10,
  aralık: 11,
  aralik: 11,
};

function formatDateTime(value?: string | null) {
  if (!value) return "Henüz güncellenmedi";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseTurkishDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = turkishMonthMap[match[2].toLocaleLowerCase("tr-TR")];
  const year = Number(match[3]);
  if (!day || month === undefined || !year) return null;

  return new Date(year, month, day).getTime();
}

function getDateYear(value: string) {
  const timestamp = parseTurkishDate(value);
  if (!timestamp) return null;
  return new Date(timestamp).getFullYear();
}

function isSyncStale(log: MykSyncLog | null, records: MykMandatoryQualification[]) {
  const latestValue =
    log?.finishedAt ||
    [...records]
      .map((record) => record.lastSeenAt || record.updatedAt)
      .filter(Boolean)
      .sort()
      .pop();

  if (!latestValue) return true;
  const latest = new Date(latestValue).getTime();
  if (Number.isNaN(latest)) return true;
  return Date.now() - latest > 24 * 60 * 60 * 1000;
}

function filterByDate(record: MykMandatoryQualification, dateFilter: DateFilter) {
  if (dateFilter === "all") return true;

  const year = getDateYear(record.obligationDate);
  if (dateFilter === "known") return year !== null;
  if (dateFilter === "unknown") return year === null;
  if (dateFilter === "2016") return year === 2016;
  if (dateFilter === "2017-2019") return year !== null && year >= 2017 && year <= 2019;
  if (dateFilter === "2020-plus") return year !== null && year >= 2020;

  return true;
}

function sortRecords(records: MykMandatoryQualification[], sortMode: SortMode) {
  return [...records].sort((a, b) => {
    if (sortMode === "name-desc") {
      return b.professionName.localeCompare(a.professionName, "tr");
    }

    if (sortMode === "date-desc" || sortMode === "date-asc") {
      const dateA = parseTurkishDate(a.obligationDate) ?? 0;
      const dateB = parseTurkishDate(b.obligationDate) ?? 0;
      return sortMode === "date-desc" ? dateB - dateA : dateA - dateB;
    }

    if (sortMode === "code-asc") {
      return (a.qualificationCodes[0] || "").localeCompare(b.qualificationCodes[0] || "", "tr");
    }

    return a.professionName.localeCompare(b.professionName, "tr");
  });
}

function getVisiblePages(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function QualificationCard({ record }: { record: MykMandatoryQualification }) {
  return (
    <article className="rounded-lg border border-slate-600/70 bg-slate-800/85 p-4 shadow-lg shadow-black/10 transition hover:border-indigo-400/50 hover:bg-slate-800">
      <h2 className="text-lg font-black text-white">{record.professionName}</h2>
      <div className="mt-3 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Yeterlilik Kodları</p>
        <div className="flex flex-wrap gap-2">
          {record.qualificationCodes.map((code) => (
            <span
              key={code}
              className="rounded-md border border-indigo-400/50 bg-indigo-600/25 px-2 py-1 text-xs font-black text-indigo-100"
            >
              {code}
            </span>
          ))}
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-slate-600 bg-slate-950/70 px-2.5 py-1.5 text-xs font-bold text-white">
          <CalendarDays className="h-3.5 w-3.5 text-slate-300" />
          Belge Zorunluluk Tarihi : {record.obligationDate || "Belirtilmedi"}
        </div>
      </div>
    </article>
  );
}

export default function MykMandatoryQuery() {
  const [records, setRecords] = useState<MykMandatoryQualification[]>([]);
  const [latestLog, setLatestLog] = useState<MykSyncLog | null>(null);
  const [query, setQuery] = useState("");
  const [profession, setProfession] = useState("all");
  const [codePrefix, setCodePrefix] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("name-asc");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadData = async () => {
    const [qualificationRows, log] = await Promise.all([
      loadMykMandatoryQualifications(),
      loadLatestMykSyncLog().catch(() => null),
    ]);
    setRecords(qualificationRows);
    setLatestLog(log);
    return { qualificationRows, log };
  };

  const handleSync = async (silent = false) => {
    setSyncing(true);
    try {
      const result = await syncMykMandatoryQualifications();
      if (!result.success) throw new Error(result.error || "MYK güncellemesi tamamlanamadı.");
      await loadData();
      if (!silent) {
        toast.success(`MYK listesi güncellendi. ${result.fetchedCount || 0} kayıt kontrol edildi.`);
      }
    } catch (error) {
      console.error("MYK senkronizasyonu başarısız:", error);
      if (!silent) {
        toast.error(error instanceof Error ? error.message : "MYK güncellemesi yapılamadı. Son kayıtlar gösteriliyor.");
      }
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    loadData()
      .then(async ({ qualificationRows, log }) => {
        if (!mounted) return;
        if (qualificationRows.length === 0 || isSyncStale(log, qualificationRows)) {
          await handleSync(true);
        }
      })
      .catch((error) => {
        console.error("MYK kayıtları yüklenemedi:", error);
        toast.error("MYK kayıtları yüklenemedi.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, profession, codePrefix, dateFilter, sortMode, pageSize]);

  const professionOptions = useMemo(() => {
    const unique = new Map<string, string>();
    records.forEach((record) => {
      unique.set(record.normalizedProfessionName, record.professionName);
    });

    return Array.from(unique.entries())
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label, "tr"));
  }, [records]);

  const codePrefixOptions = useMemo(() => {
    const prefixes = new Set<string>();
    records.forEach((record) => {
      record.qualificationCodes.forEach((code) => {
        const prefix = code.match(/^\d{2}UY/)?.[0];
        if (prefix) prefixes.add(prefix);
      });
    });
    return Array.from(prefixes).sort((a, b) => a.localeCompare(b, "tr"));
  }, [records]);

  const filteredRecords = useMemo(() => {
    const base = filterMykQualifications(records, query, profession).filter((record) => {
      const matchesCodePrefix =
        codePrefix === "all" ? true : record.qualificationCodes.some((code) => code.startsWith(codePrefix));
      return matchesCodePrefix && filterByDate(record, dateFilter);
    });

    return sortRecords(base, sortMode);
  }, [records, query, profession, codePrefix, dateFilter, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredRecords.length);
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);
  const visiblePages = getVisiblePages(safeCurrentPage, totalPages);

  const latestUpdate =
    latestLog?.finishedAt ||
    [...records]
      .map((record) => record.lastSeenAt || record.updatedAt)
      .filter(Boolean)
      .sort()
      .pop() ||
    null;

  const hasActiveFilters =
    query.trim() || profession !== "all" || codePrefix !== "all" || dateFilter !== "all" || sortMode !== "name-asc";

  const clearFilters = () => {
    setQuery("");
    setProfession("all");
    setCodePrefix("all");
    setDateFilter("all");
    setSortMode("name-asc");
  };

  return (
    <main className="min-h-screen bg-[#101827] px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-5">
        <header>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-indigo-300" />
            <h1 className="text-2xl font-black">MYK Zorunluluk Sorgula</h1>
          </div>
          <p className="mt-2 max-w-4xl text-sm text-blue-100/80">
            Meslek adı veya yeterlilik kodu ile MYK belge zorunluluğu kapsamındaki kayıtları kendi veritabanınız üzerinden sorgulayın.
          </p>
        </header>

        <section className="rounded-lg border border-slate-600/70 bg-slate-800/85 p-5 shadow-xl shadow-black/10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-indigo-300" />
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-100">Filtreleme ve Liste Yönetimi</h2>
            </div>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="border-slate-600 bg-slate-950/60 text-slate-100 hover:bg-slate-900"
              >
                <X className="mr-2 h-4 w-4" />
                Temizle
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-black">Arama Kutusu (Meslek Adı veya Kod)</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={cn(inputClass, "pl-10")}
                  placeholder="Örn: Betonarme Demircisi veya 16UY"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black">Meslek Seçici (Yeterlilik Adı)</label>
              <Select value={profession} onValueChange={setProfession}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Tüm meslekler" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="all">Tüm meslekler</SelectItem>
                  {professionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-black">Yeterlilik Kod Grubu</label>
              <Select value={codePrefix} onValueChange={setCodePrefix}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Tüm kodlar" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="all">Tüm kod grupları</SelectItem>
                  {codePrefixOptions.map((prefix) => (
                    <SelectItem key={prefix} value={prefix}>
                      {prefix}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black">Zorunluluk Tarihi</label>
              <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Tüm tarihler" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="all">Tüm tarihler</SelectItem>
                  <SelectItem value="known">Tarihi bilinenler</SelectItem>
                  <SelectItem value="unknown">Tarihi bulunamayanlar</SelectItem>
                  <SelectItem value="2016">2016</SelectItem>
                  <SelectItem value="2017-2019">2017 - 2019</SelectItem>
                  <SelectItem value="2020-plus">2020 ve sonrası</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black">Sıralama</label>
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Sırala" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="name-asc">Meslek adı A-Z</SelectItem>
                  <SelectItem value="name-desc">Meslek adı Z-A</SelectItem>
                  <SelectItem value="date-desc">En yeni zorunluluk tarihi</SelectItem>
                  <SelectItem value="date-asc">En eski zorunluluk tarihi</SelectItem>
                  <SelectItem value="code-asc">Yeterlilik koduna göre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black">Sayfa Başına</label>
              <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="20 kayıt" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} kayıt
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Toplam Meslek</p>
              <p className="mt-1 text-2xl font-black text-white">{records.length}</p>
            </div>
            <div className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-200">Filtrelenen Kayıt</p>
              <p className="mt-1 text-2xl font-black text-indigo-50">{filteredRecords.length}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Sayfa Durumu</p>
              <p className="mt-1 text-2xl font-black text-white">
                {safeCurrentPage} / {totalPages}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              Son güncelleme: {formatDateTime(latestUpdate)}
            </span>
            <a
              href={MYK_SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-indigo-300 hover:text-indigo-200"
            >
              Resmi MYK kaynağını aç
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleSync(false)}
              disabled={syncing}
              className="ml-auto border-indigo-400/40 bg-indigo-500/10 text-indigo-100 hover:bg-indigo-500/20"
            >
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Güncelle
            </Button>
          </div>
        </section>

        {loading ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-8 text-center text-slate-300">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
            MYK kayıtları yükleniyor...
          </div>
        ) : filteredRecords.length ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
              <span>
                {filteredRecords.length} kayıttan {startIndex + 1}-{endIndex} arası gösteriliyor.
              </span>
              <span className="text-slate-400">
                Sayfa başına {pageSize} kayıt
              </span>
            </div>

            <section className="space-y-3">
              {paginatedRecords.map((record) => (
                <QualificationCard key={record.id} record={record} />
              ))}
            </section>

            <nav
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3"
              aria-label="MYK kayıt sayfalama"
            >
              <div className="text-sm text-slate-300">
                Sayfa <span className="font-black text-white">{safeCurrentPage}</span> / {totalPages}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage === 1}
                  className="border-slate-600 bg-slate-950/60 text-slate-100 hover:bg-slate-800 disabled:opacity-40"
                  aria-label="İlk sayfa"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage === 1}
                  className="border-slate-600 bg-slate-950/60 text-slate-100 hover:bg-slate-800 disabled:opacity-40"
                  aria-label="Önceki sayfa"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {visiblePages.map((page) => (
                  <Button
                    key={page}
                    type="button"
                    variant={page === safeCurrentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      "h-9 min-w-9 px-3",
                      page === safeCurrentPage
                        ? "bg-indigo-500 text-white hover:bg-indigo-500/90"
                        : "border-slate-600 bg-slate-950/60 text-slate-100 hover:bg-slate-800",
                    )}
                    aria-current={page === safeCurrentPage ? "page" : undefined}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="border-slate-600 bg-slate-950/60 text-slate-100 hover:bg-slate-800 disabled:opacity-40"
                  aria-label="Sonraki sayfa"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage === totalPages}
                  className="border-slate-600 bg-slate-950/60 text-slate-100 hover:bg-slate-800 disabled:opacity-40"
                  aria-label="Son sayfa"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </nav>
          </>
        ) : (
          <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-8 text-center text-slate-300">
            Arama kriterlerine uygun MYK zorunluluk kaydı bulunamadı.
          </div>
        )}
      </div>
    </main>
  );
}
