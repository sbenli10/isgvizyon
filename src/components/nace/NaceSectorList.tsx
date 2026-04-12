// ====================================================
// NACE SECTOR LIST COMPONENT
// ====================================================

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Search,
  Loader2,
  Shield,
  Building2,
  Download,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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

  const loadNaceCodes = async (silent = false) => {
  if (!silent) {
    setLoading(true);
  }
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

    setNaceCodes(allRows);

    // Extract unique sectors
    const uniqueSectors = Array.from(
      new Set(allRows.map((item) => item.sector))
    ).sort();
    setSectors(uniqueSectors);
    sessionStorage.setItem(
      NACE_SECTOR_LIST_CACHE_KEY,
      JSON.stringify({
        naceCodes: allRows,
        sectors: uniqueSectors,
        timestamp: Date.now(),
      })
    );

    toast.success(`${allRows.length || 0} NACE kodu yüklendi`);
  } catch (error) {
    console.error("Error loading NACE codes:", error);
    toast.error("NACE kodları yüklenemedi");
  } finally {
    setLoading(false);
  }
};


  const filterCodes = () => {
    let filtered = naceCodes;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (code) =>
          code.nace_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          code.nace_title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sector filter
    if (sectorFilter !== "all") {
      filtered = filtered.filter((code) => code.sector === sectorFilter);
    }

    // Hazard class filter
    if (hazardFilter !== "all") {
      filtered = filtered.filter((code) => code.hazard_class === hazardFilter);
    }

    setFilteredCodes(filtered);
  };

  const getHazardColor = (hazardClass: string) => {
    switch (hazardClass) {
      case "Az Tehlikeli":
        return "bg-green-500";
      case "Tehlikeli":
        return "bg-yellow-500";
      case "Çok Tehlikeli":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleRowClick = (naceCode: string) => {
    navigate(`/nace-query?code=${naceCode}`);
  };

  const exportToCSV = () => {
    const csv = [
      ["NACE Kod", "Faaliyet", "Tehlike Sınıfı", "Sektör"],
      ...filteredCodes.map((code) => [
        code.nace_code,
        code.nace_title,
        code.hazard_class,
        code.sector,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "nace-codes.csv";
    link.click();

    toast.success("CSV dosyası indirildi");
  };

  if (loading) {
    return (
      <div className="container mx-auto space-y-6 py-6">
        <div className="space-y-2">
          <div className="h-8 w-64 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-80 animate-pulse rounded bg-slate-900" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="h-8 w-16 animate-pulse rounded bg-slate-800" />
                <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-900" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded bg-slate-900/70" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-900/70" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          NACE Sektör Listesi
        </h1>
        <p className="text-muted-foreground">
          Tüm NACE kodları, tehlike sınıfları ve sektör bilgileri
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam Kod
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{naceCodes.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Az Tehlikeli
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {naceCodes.filter((c) => c.hazard_class === "Az Tehlikeli").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tehlikeli
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {naceCodes.filter((c) => c.hazard_class === "Tehlikeli").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Çok Tehlikeli
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {naceCodes.filter((c) => c.hazard_class === "Çok Tehlikeli").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtreler</CardTitle>
          <CardDescription>NACE kodlarını filtreleyin</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="NACE kodu veya faaliyet ara..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sektör" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Sektörler</SelectItem>
                {sectors.map((sector) => (
                  <SelectItem key={sector} value={sector}>
                    {sector}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={hazardFilter} onValueChange={setHazardFilter}>
              <SelectTrigger>
                <Shield className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tehlike Sınıfı" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="Az Tehlikeli">Az Tehlikeli</SelectItem>
                <SelectItem value="Tehlikeli">Tehlikeli</SelectItem>
                <SelectItem value="Çok Tehlikeli">Çok Tehlikeli</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              {filteredCodes.length} sonuç gösteriliyor
            </p>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV İndir
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {filteredCodes.length === 0 ? (
            <Alert>
              <AlertDescription>
                Filtre kriterlerine uygun NACE kodu bulunamadı
              </AlertDescription>
            </Alert>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NACE Kod</TableHead>
                    <TableHead>Faaliyet</TableHead>
                    <TableHead>Sektör</TableHead>
                    <TableHead>Tehlike Sınıfı</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCodes.map((code) => (
                    <TableRow
                      key={code.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(code.nace_code)}
                    >
                      <TableCell className="font-mono font-medium">
                        {code.nace_code}
                      </TableCell>
                      <TableCell>{code.nace_title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{code.sector}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${getHazardColor(
                            code.hazard_class
                          )} text-white`}
                        >
                          {code.hazard_class}
                        </Badge>
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
