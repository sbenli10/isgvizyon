// ====================================================
// NACE SECTOR LIST COMPONENT
// ====================================================

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Download,
  Filter,
  Loader2,
  Search,
  Shield,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NaceCode {
  id: string;
  nace_code: string;
  nace_title: string;
  hazard_class: string;
  sector: string;
  created_at: string;
}

const NACE_SECTOR_LIST_CACHE_KEY = "denetron:nace-sector-list";
const NACE_SECTOR_LIST_CACHE_TTL = 24 * 60 * 60 * 1000;

const hazardClassStyles: Record<string, string> = {
  "Az Tehlikeli": "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  Tehlikeli: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  "Çok Tehlikeli": "border-rose-400/30 bg-rose-500/10 text-rose-200",
};

const hazardStatStyles: Record<string, { ring: string; text: string; bg: string }> = {
  "Az Tehlikeli": { ring: "border-emerald-400/20", text: "text-emerald-200", bg: "bg-emerald-500/10" },
  Tehlikeli: { ring: "border-amber-400/20", text: "text-amber-200", bg: "bg-amber-500/10" },
  "Çok Tehlikeli": { ring: "border-rose-400/20", text: "text-rose-200", bg: "bg-rose-500/10" },
};

const escapeCsvValue = (value: string) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export default function NaceSectorList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [naceCodes, setNaceCodes] = useState<NaceCode[]>([]);
  const [filteredCodes, setFilteredCodes] = useState<NaceCode[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [hazardFilter, setHazardFilter] = useState<string>("all");
  const [sectors, setSectors] = useState<string[]>([]);

  useEffect(() => {
    const cached = sessionStorage.getItem(NACE_SECTOR_LIST_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as {
          naceCodes: NaceCode[];
          sectors: string[];
          timestamp: number;
        };

        if (Date.now() - parsed.timestamp < NACE_SECTOR_LIST_CACHE_TTL) {
          setNaceCodes(parsed.naceCodes);
          setSectors(parsed.sectors);
          setLoading(false);
          void loadNaceCodes(true);
          return;
        }
      } catch {
        sessionStorage.removeItem(NACE_SECTOR_LIST_CACHE_KEY);
      }
    }

    void loadNaceCodes();
  }, []);

  useEffect(() => {
    filterCodes();
  }, [searchTerm, sectorFilter, hazardFilter, naceCodes]);

  const summary = useMemo(
    () => ({
      total: naceCodes.length,
      visible: filteredCodes.length,
      az: naceCodes.filter((code) => code.hazard_class === "Az Tehlikeli").length,
      tehlikeli: naceCodes.filter((code) => code.hazard_class === "Tehlikeli").length,
      cok: naceCodes.filter((code) => code.hazard_class === "Çok Tehlikeli").length,
      sectorCount: sectors.length,
    }),
    [filteredCodes.length, naceCodes, sectors.length],
  );

  const loadNaceCodes = async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const pageSize = 1000;
      let from = 0;
      let allRows: NaceCode[] = [];

      while (true) {
        const { data, error } = await supabase
          .from("nace_codes")
          .select("*")
          .order("nace_code", { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const rows = (data || []) as NaceCode[];
        allRows = allRows.concat(rows);

        if (rows.length < pageSize) break;
        from += pageSize;
      }

      const uniqueSectors = Array.from(new Set(allRows.map((item) => item.sector).filter(Boolean))).sort();

      setNaceCodes(allRows);
      setSectors(uniqueSectors);
      sessionStorage.setItem(
        NACE_SECTOR_LIST_CACHE_KEY,
        JSON.stringify({
          naceCodes: allRows,
          sectors: uniqueSectors,
          timestamp: Date.now(),
        }),
      );

      if (!silent) toast.success(`${allRows.length || 0} NACE kodu yüklendi`);
    } catch (error) {
      console.error("Error loading NACE codes:", error);
      toast.error("NACE kodları yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const filterCodes = () => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("tr-TR");
    let filtered = naceCodes;

    if (normalizedSearch) {
      filtered = filtered.filter((code) => {
        const haystack = `${code.nace_code} ${code.nace_title} ${code.sector} ${code.hazard_class}`.toLocaleLowerCase("tr-TR");
        return haystack.includes(normalizedSearch);
      });
    }

    if (sectorFilter !== "all") filtered = filtered.filter((code) => code.sector === sectorFilter);
    if (hazardFilter !== "all") filtered = filtered.filter((code) => code.hazard_class === hazardFilter);

    setFilteredCodes(filtered);
  };

  const handleRowClick = (naceCode: string) => {
    navigate(`/nace-query?code=${encodeURIComponent(naceCode)}`);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSectorFilter("all");
    setHazardFilter("all");
  };

  const exportToCSV = () => {
    const csv = [
      ["NACE Kod", "Faaliyet", "Tehlike Sınıfı", "Sektör"],
      ...filteredCodes.map((code) => [code.nace_code, code.nace_title, code.hazard_class, code.sector]),
    ]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `nace-kodlari-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast.success("CSV dosyası indirildi");
  };

  if (loading) {
    return (
      <div className="w-full min-w-0 space-y-6 p-4 text-slate-100 sm:p-6">
        <div className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 p-6">
          <div className="h-8 w-72 animate-pulse rounded bg-slate-800" />
          <div className="mt-4 h-4 w-96 max-w-full animate-pulse rounded bg-slate-900" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="border-slate-800 bg-slate-950">
              <CardContent className="p-5">
                <div className="h-8 w-16 animate-pulse rounded bg-slate-800" />
                <div className="mt-3 h-3 w-24 animate-pulse rounded bg-slate-900" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-slate-800 bg-slate-950">
          <CardContent className="p-5">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-900" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6 p-4 text-slate-100 sm:p-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_30%),linear-gradient(135deg,#020617_0%,#0f172a_50%,#082f49_100%)] p-6 shadow-2xl shadow-slate-950/40 lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <Badge className="w-fit border border-cyan-300/25 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/10">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              NACE Veri Kütüphanesi
            </Badge>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
              Sektör, faaliyet ve tehlike sınıfını tek listede yönetin
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              Tüm NACE kodlarını arayın, filtreleyin, CSV olarak indirin veya seçtiğiniz kodu doğrudan tehlike sınıfı sorgulama ekranına taşıyın.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-[420px]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
              <p className="text-2xl font-black text-white">{summary.total}</p>
              <p className="text-xs text-slate-400">Toplam NACE kodu</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
              <p className="text-2xl font-black text-white">{summary.sectorCount}</p>
              <p className="text-xs text-slate-400">Sektör grubu</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Gösterilen", value: summary.visible, icon: Search, className: "border-cyan-400/20 bg-cyan-500/10 text-cyan-200" },
          { label: "Az Tehlikeli", value: summary.az, icon: CheckCircle2, className: `${hazardStatStyles["Az Tehlikeli"].ring} ${hazardStatStyles["Az Tehlikeli"].bg} ${hazardStatStyles["Az Tehlikeli"].text}` },
          { label: "Tehlikeli", value: summary.tehlikeli, icon: AlertCircle, className: `${hazardStatStyles.Tehlikeli.ring} ${hazardStatStyles.Tehlikeli.bg} ${hazardStatStyles.Tehlikeli.text}` },
          { label: "Çok Tehlikeli", value: summary.cok, icon: Shield, className: `${hazardStatStyles["Çok Tehlikeli"].ring} ${hazardStatStyles["Çok Tehlikeli"].bg} ${hazardStatStyles["Çok Tehlikeli"].text}` },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className={cn("border bg-slate-950/80 text-slate-100 shadow-lg shadow-slate-950/20", item.className)}>
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="text-3xl font-black">{item.value}</p>
                  <p className="mt-1 text-xs font-semibold opacity-80">{item.label}</p>
                </div>
                <Icon className="h-7 w-7 opacity-80" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-slate-800 bg-slate-950/85 text-slate-100 shadow-xl shadow-slate-950/20">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                id="nace-sector-search"
                name="naceSectorSearch"
                placeholder="NACE kodu, faaliyet, sektör veya tehlike sınıfı ara..."
                className="h-12 rounded-2xl border-slate-700 bg-slate-900/80 pl-11 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400/20"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="h-12 rounded-2xl border-slate-700 bg-slate-900/80 text-slate-100 lg:w-[260px]">
                <Filter className="mr-2 h-4 w-4 text-cyan-200" />
                <SelectValue placeholder="Sektör" />
              </SelectTrigger>
              <SelectContent className="max-h-80 border-slate-700 bg-slate-950 text-slate-100">
                <SelectItem value="all">Tüm Sektörler</SelectItem>
                {sectors.map((sector) => (
                  <SelectItem key={sector} value={sector}>
                    {sector}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={hazardFilter} onValueChange={setHazardFilter}>
              <SelectTrigger className="h-12 rounded-2xl border-slate-700 bg-slate-900/80 text-slate-100 lg:w-[220px]">
                <Shield className="mr-2 h-4 w-4 text-cyan-200" />
                <SelectValue placeholder="Tehlike Sınıfı" />
              </SelectTrigger>
              <SelectContent className="border-slate-700 bg-slate-950 text-slate-100">
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="Az Tehlikeli">Az Tehlikeli</SelectItem>
                <SelectItem value="Tehlikeli">Tehlikeli</SelectItem>
                <SelectItem value="Çok Tehlikeli">Çok Tehlikeli</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-400">
              <span className="font-black text-white">{filteredCodes.length}</span> kayıt gösteriliyor
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-xl border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800" onClick={resetFilters}>
                Filtreleri Sıfırla
              </Button>
              <Button className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 font-bold text-white hover:from-blue-500 hover:to-cyan-400" onClick={exportToCSV}>
                <Download className="mr-2 h-4 w-4" />
                CSV İndir
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-800 bg-slate-950/85 text-slate-100 shadow-xl shadow-slate-950/20">
        <CardContent className="p-0">
          {filteredCodes.length === 0 ? (
            <div className="grid min-h-[260px] place-items-center p-8 text-center">
              <div>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/20">
                  <Search className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-xl font-black text-white">Kayıt bulunamadı</h2>
                <p className="mt-2 text-sm text-slate-400">Filtreleri temizleyin veya farklı bir anahtar kelimeyle tekrar deneyin.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-900/90">
                  <TableRow className="border-slate-800 hover:bg-slate-900">
                    <TableHead className="min-w-[120px] text-slate-300">NACE Kod</TableHead>
                    <TableHead className="min-w-[360px] text-slate-300">Faaliyet</TableHead>
                    <TableHead className="min-w-[220px] text-slate-300">Sektör</TableHead>
                    <TableHead className="min-w-[160px] text-slate-300">Tehlike Sınıfı</TableHead>
                    <TableHead className="w-[80px] text-right text-slate-300">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCodes.map((code) => (
                    <TableRow
                      key={code.id}
                      className="cursor-pointer border-slate-800 transition hover:bg-cyan-500/5"
                      onClick={() => handleRowClick(code.nace_code)}
                    >
                      <TableCell className="font-mono text-sm font-black text-cyan-100">{code.nace_code}</TableCell>
                      <TableCell className="font-semibold leading-6 text-slate-100">{code.nace_title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="max-w-[260px] truncate border-slate-700 bg-slate-900/80 text-slate-300">
                          {code.sector || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("rounded-full font-bold", hazardClassStyles[code.hazard_class] ?? "border-slate-600 bg-slate-800 text-slate-200")}>
                          {code.hazard_class}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="rounded-xl text-cyan-200 hover:bg-cyan-500/10 hover:text-cyan-100">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
