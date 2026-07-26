import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  HelpCircle,
  Loader2,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  catalogItemToEntry,
  companyDisplayName,
  createClientId,
  createEmptySuggestionLedgerRecord,
  deleteSuggestionLedgerRecord,
  generateSuggestionLedgerPdf,
  getCompanyRegistryNo,
  loadSuggestionLedgerCompanies,
  loadSuggestionLedgerHistory,
  loadSuggestionLedgerRecord,
  saveSuggestionLedgerRecord,
  suggestionCatalog,
  suggestionCategories,
  suggestionPriorities,
  validateSuggestionLedger,
  type SuggestionLedgerEntry,
  type SuggestionLedgerHistoryItem,
  type SuggestionLedgerRecord,
  type SuggestionPriority,
} from "@/lib/suggestionLedger";
import { cn } from "@/lib/utils";
import type { Company } from "@/types/companies";

const tabItems = [
  { id: "ledger", label: "Öneri / Defter Oluştur", icon: ClipboardCheck },
  { id: "risk", label: "Risk Değerlendirmesinden", icon: Sparkles },
  { id: "law", label: "Yasal Dayanaklar", icon: BookOpenCheck },
] as const;

const priorityClassName: Record<SuggestionPriority, string> = {
  "Yüksek Öncelik": "border-rose-400/30 bg-rose-500/10 text-rose-100",
  "Orta Öncelik": "border-amber-400/30 bg-amber-500/10 text-amber-100",
  Bilgilendirme: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
  Genel: "border-slate-500/30 bg-slate-500/10 text-slate-200",
};

function EntryCard({
  entry,
  index,
  onRemove,
}: {
  entry: SuggestionLedgerEntry;
  index: number;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-700/80 bg-slate-950/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge className="border-blue-400/25 bg-blue-500/10 text-blue-100">{index + 1}</Badge>
          <Badge className={priorityClassName[entry.priority]}>{entry.priority}</Badge>
          <span className="truncate text-xs text-slate-400">{entry.category}</span>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-rose-200" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-sm font-semibold leading-5 text-white">{entry.finding}</p>
      <p className="mt-2 text-xs leading-5 text-slate-300">{entry.suggestion}</p>
      {entry.legalReference ? <p className="mt-2 text-[11px] text-amber-200">Yasal dayanak: {entry.legalReference}</p> : null}
    </div>
  );
}

export default function SuggestionLedger() {
  const { user, profile } = useAuth();
  const [record, setRecord] = useState<SuggestionLedgerRecord>(() => createEmptySuggestionLedgerRecord(profile?.organization_id || null));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [history, setHistory] = useState<SuggestionLedgerHistoryItem[]>([]);
  const [category, setCategory] = useState("Tüm konular");
  const [priority, setPriority] = useState<(typeof suggestionPriorities)[number]>("Tüm öncelikler");
  const [search, setSearch] = useState("");
  const [manualFinding, setManualFinding] = useState("");
  const [manualSuggestion, setManualSuggestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === record.companyId) || null,
    [companies, record.companyId],
  );

  const filteredCatalog = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr-TR");
    return suggestionCatalog.filter((item) => {
      const matchesCategory = category === "Tüm konular" || item.category === category;
      const matchesPriority = priority === "Tüm öncelikler" || item.priority === priority;
      const haystack = `${item.finding} ${item.suggestion} ${item.legalReference} ${item.tags.join(" ")}`.toLocaleLowerCase("tr-TR");
      return matchesCategory && matchesPriority && (!term || haystack.includes(term));
    });
  }, [category, priority, search]);

  const patchRecord = (patch: Partial<SuggestionLedgerRecord>) => {
    setRecord((current) => ({ ...current, ...patch }));
  };

  const refreshHistory = async () => {
    try {
      setHistory(await loadSuggestionLedgerHistory());
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const companyRows = await loadSuggestionLedgerCompanies();
        setCompanies(companyRows);
        await refreshHistory();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Firma ve defter verileri yüklenemedi.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleCompanyChange = (companyId: string) => {
    const company = companies.find((item) => item.id === companyId);
    if (!company) return;
    patchRecord({
      companyId: company.id,
      companyName: companyDisplayName(company),
      sgkRegistryNo: getCompanyRegistryNo(company),
      hazardClass: company.hazard_class || "",
    });
  };

  const addCatalogItem = (itemId: string) => {
    const item = suggestionCatalog.find((candidate) => candidate.id === itemId);
    if (!item) return;
    if (record.entries.some((entry) => entry.catalogId === item.id)) {
      toast.info("Bu madde deftere zaten eklendi.");
      return;
    }
    patchRecord({ entries: [...record.entries, catalogItemToEntry(item)] });
  };

  const addManualEntry = () => {
    if (!manualFinding.trim() || !manualSuggestion.trim()) {
      toast.error("Manuel kayıt için tespit ve öneri alanlarını doldurun.");
      return;
    }
    patchRecord({
      entries: [
        ...record.entries,
        {
          id: createClientId("manual-entry"),
          category: "Manuel",
          priority: "Genel",
          finding: manualFinding.trim(),
          suggestion: manualSuggestion.trim(),
          legalReference: "",
        },
      ],
    });
    setManualFinding("");
    setManualSuggestion("");
  };

  const removeEntry = (entryId: string) => {
    patchRecord({ entries: record.entries.filter((entry) => entry.id !== entryId) });
  };

  const saveRecord = async () => {
    if (!user) return;
    const errors = validateSuggestionLedger(record);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    setSaving(true);
    try {
      const saved = await saveSuggestionLedgerRecord(record, user.id, profile?.organization_id || null);
      setRecord(saved);
      await refreshHistory();
      toast.success("Tespit ve öneri defteri kaydedildi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Defter kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const createPdf = async () => {
    const errors = validateSuggestionLedger(record);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    setPdfLoading(true);
    try {
      await generateSuggestionLedgerPdf(record);
      toast.success("PDF çıktı hazırlandı.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF çıktısı oluşturulamadı.");
    } finally {
      setPdfLoading(false);
    }
  };

  const openHistoryRecord = async (id: string) => {
    setLoading(true);
    try {
      setRecord(await loadSuggestionLedgerRecord(id));
      toast.success("Kayıt açıldı.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kayıt açılamadı.");
    } finally {
      setLoading(false);
    }
  };

  const deleteRecord = async (id?: string) => {
    if (!id) return;
    const confirmed = window.confirm("Bu tespit ve öneri defteri kaydını silmek istediğinize emin misiniz?");
    if (!confirmed) return;
    setSaving(true);
    try {
      await deleteSuggestionLedgerRecord(id);
      setRecord(createEmptySuggestionLedgerRecord(profile?.organization_id || null));
      await refreshHistory();
      toast.success("Kayıt silindi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kayıt silinemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101827] px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-amber-400/25 bg-amber-500/15 text-amber-300">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white">İSG Tespit ve Öneri Defteri</h1>
                <p className="text-sm text-slate-400">Örnek defter kayıtlarını seçin, firmaya ait bilgilerle kaydedin ve PDF çıktısı alın.</p>
              </div>
            </div>
          </div>
          <Button type="button" variant="outline" className="w-fit border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15">
            <HelpCircle className="mr-2 h-4 w-4" />
            Nasıl Yapılır?
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                type="button"
                variant={index === 0 ? "default" : "outline"}
                className={cn(
                  "h-9 rounded-lg text-xs font-bold",
                  index === 0
                    ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                    : "border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800",
                )}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            );
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardContent className="p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <Label className="text-xs text-slate-300">Konu</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="mt-1 border-slate-700 bg-slate-950/60 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[80] border-slate-700 bg-slate-950 text-white">
                        {suggestionCategories.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-300">Öncelik</Label>
                    <Select value={priority} onValueChange={(value) => setPriority(value as typeof priority)}>
                      <SelectTrigger className="mt-1 border-slate-700 bg-slate-950/60 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[80] border-slate-700 bg-slate-950 text-white">
                        {suggestionPriorities.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-300">Arama</Label>
                    <div className="relative mt-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Tespit/öneri içinde ara..."
                        className="border-slate-700 bg-slate-950/60 pl-9 text-white placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base text-white">
                    <BookOpenCheck className="h-4 w-4 text-amber-300" />
                    Hazır Öneri Kataloğu
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">Deftere eklemek istediğiniz maddeleri seçin.</CardDescription>
                </div>
                <Badge className="border-slate-600 bg-slate-800 text-slate-200">{filteredCatalog.length} madde</Badge>
              </CardHeader>
              <CardContent className="max-h-[520px] space-y-3 overflow-y-auto pr-2 [scrollbar-color:rgba(148,163,184,.35)_transparent] [scrollbar-width:thin]">
                {loading ? (
                  <div className="flex h-40 items-center justify-center text-slate-400">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Katalog yükleniyor...
                  </div>
                ) : filteredCatalog.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">Aramanıza uygun madde bulunamadı.</div>
                ) : (
                  filteredCatalog.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-700/80 bg-slate-950/35 p-3 transition hover:border-amber-400/35 hover:bg-slate-950/55">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge className={priorityClassName[item.priority]}>{item.priority}</Badge>
                        <Badge className="border-slate-600 bg-slate-800 text-slate-300">{item.subCategory}</Badge>
                        <span className="ml-auto text-[11px] text-slate-500">{item.legalReference}</span>
                      </div>
                      <p className="text-sm font-semibold leading-5 text-white">{item.finding}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-300">{item.suggestion}</p>
                      <div className="mt-3 flex justify-end">
                        <Button type="button" size="sm" className="h-8 bg-amber-500 text-slate-950 hover:bg-amber-400" onClick={() => addCatalogItem(item.id)}>
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          Ekle
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Plus className="h-4 w-4 text-cyan-300" />
                  Hazır Önerilerden Yeni
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">Katalog dışında kalan tespitleri manuel ekleyin.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-slate-300">Tespit</Label>
                  <Textarea
                    value={manualFinding}
                    onChange={(event) => setManualFinding(event.target.value)}
                    placeholder="Tespitinizi yazın..."
                    className="mt-1 min-h-20 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Öneri</Label>
                  <Textarea
                    value={manualSuggestion}
                    onChange={(event) => setManualSuggestion(event.target.value)}
                    placeholder="Önerinizi yazın..."
                    className="mt-1 min-h-20 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500"
                  />
                </div>
                <Button type="button" className="bg-cyan-400 text-slate-950 hover:bg-cyan-300" onClick={addManualEntry}>
                  <Plus className="mr-2 h-4 w-4" />
                  Deftere Ekle
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <FileText className="h-4 w-4 text-cyan-300" />
                  PDF'e Kaydetme Notu
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">Kayıt alındıktan sonra firma bilgileriyle PDF çıktısı oluşturulur.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
                  <AlertTriangle className="mb-2 h-4 w-4" />
                  PDF çıktısında firma ünvanı, SGK sicil no, tehlike sınıfı ve seçilen tespit/öneriler otomatik doldurulur.
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Building2 className="h-4 w-4 text-amber-300" />
                  Defter Kaydı
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-slate-300">Firma</Label>
                  <Select value={record.companyId} onValueChange={handleCompanyChange}>
                    <SelectTrigger className="mt-1 border-slate-700 bg-slate-950/60 text-white">
                      <SelectValue placeholder="Firma seçin" />
                    </SelectTrigger>
                    <SelectContent className="z-[80] max-h-80 border-slate-700 bg-slate-950 text-white">
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {companyDisplayName(company)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs text-slate-300">SGK Sicil No</Label>
                    <Input value={record.sgkRegistryNo} onChange={(event) => patchRecord({ sgkRegistryNo: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-300">Tehlike Sınıfı</Label>
                    <Input value={record.hazardClass} onChange={(event) => patchRecord({ hazardClass: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-slate-300">Düzenleme Tarihi</Label>
                  <Input type="date" value={record.recordDate} onChange={(event) => patchRecord({ recordDate: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                </div>

                <div className="rounded-lg border border-dashed border-slate-700 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">Eklenen kayıtlar</span>
                    <Badge className="border-slate-600 bg-slate-800 text-slate-200">{record.entries.length} madde</Badge>
                  </div>
                  <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1 [scrollbar-color:rgba(148,163,184,.35)_transparent] [scrollbar-width:thin]">
                    {record.entries.length === 0 ? (
                      <p className="rounded-lg bg-slate-950/50 p-4 text-center text-xs text-slate-500">Soldaki önerilerden ekleme yapın.</p>
                    ) : (
                      record.entries.map((entry, index) => <EntryCard key={entry.id} entry={entry} index={index} onRemove={() => removeEntry(entry.id)} />)
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-slate-300">Genel Not</Label>
                  <Textarea
                    value={record.generalNote}
                    onChange={(event) => patchRecord({ generalNote: event.target.value })}
                    placeholder="Örn. 12.05.2026 tarihli saha ziyaretinde..."
                    className="mt-1 min-h-20 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500"
                  />
                </div>

                {selectedCompany ? (
                  <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                    <CheckCircle2 className="mb-2 h-4 w-4" />
                    {companyDisplayName(selectedCompany)} bilgileri forma aktarıldı.
                  </div>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" onClick={saveRecord} disabled={saving || loading} className="bg-amber-500 text-slate-950 hover:bg-amber-400">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Defteri Kaydet
                  </Button>
                  <Button type="button" onClick={createPdf} disabled={pdfLoading} variant="outline" className="border-amber-400/35 bg-slate-950/50 text-amber-100 hover:bg-amber-500/10">
                    {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    PDF Çıktı Al
                  </Button>
                </div>
                {record.id ? (
                  <Button type="button" variant="ghost" className="w-full text-rose-200 hover:bg-rose-500/10 hover:text-rose-100" onClick={() => deleteRecord(record.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Bu Kaydı Sil
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white">Son Kayıtlar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {history.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-700 p-4 text-center text-xs text-slate-500">Henüz defter kaydı yok.</p>
                ) : (
                  history.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full rounded-lg border border-slate-700/80 bg-slate-950/35 p-3 text-left transition hover:border-cyan-400/30 hover:bg-slate-950/55"
                      onClick={() => openHistoryRecord(item.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-white">{item.companyName}</span>
                        <Badge className="border-slate-600 bg-slate-800 text-slate-200">{item.entryCount}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{item.recordDate} • {item.status}</p>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
