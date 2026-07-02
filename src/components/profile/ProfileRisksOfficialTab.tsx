import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Download, Edit2, FileSpreadsheet, FolderOpen, FolderPlus, Loader2, MoveRight, Plus, Search, Share2, Sparkles, Trash2, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  bulkCreateSavedRiskItems,
  createSavedRiskItem,
  deleteSavedRiskItem,
  downloadSavedRiskTemplate,
  listSavedRiskItems,
  parseSavedRiskExcel,
  parseSavedRiskWord,
  updateSavedRiskItem,
  type SavedRiskExcelParseResult,
  type SavedRiskInput,
  type SavedRiskItem,
  type SavedRiskSource,
} from "@/lib/profileRisks";

type CompanyOption = { id: string; name: string };
type SortMode = "newest" | "az";

type RiskFormState = {
  activity: string;
  hazard: string;
  risk: string;
  currentStatus: string;
  detectionDate: string;
  probabilityBefore: string;
  frequencyBefore: string;
  severityBefore: string;
  riskScoreBefore: string;
  riskDefinitionBefore: string;
  possibleConsequence: string;
  correctivePreventiveAction: string;
  probabilityAfter: string;
  frequencyAfter: string;
  severityAfter: string;
  riskScoreAfter: string;
  riskDefinitionAfter: string;
  deadline: string;
  responsible: string;
  folderName: string;
  category: string;
  sectorKey: string;
  companyId: string;
};

const db = supabase as any;
const inputClass = "h-10 rounded-xl border-slate-700/70 bg-slate-900/70 text-slate-100 placeholder:text-slate-500 focus-visible:ring-amber-500/40";
const textareaClass = "min-h-[86px] rounded-xl border-slate-700/70 bg-slate-900/70 text-slate-100 placeholder:text-slate-500 focus-visible:ring-amber-500/40";
const selectTriggerClass = "h-10 rounded-xl border-slate-700/70 bg-slate-900/70 text-slate-100 focus:ring-amber-500/40";
const selectContentClass = "z-[80] border-slate-700 bg-slate-900 text-slate-100";

const emptyForm: RiskFormState = {
  activity: "",
  hazard: "",
  risk: "",
  currentStatus: "",
  detectionDate: "",
  probabilityBefore: "",
  frequencyBefore: "",
  severityBefore: "",
  riskScoreBefore: "",
  riskDefinitionBefore: "",
  possibleConsequence: "",
  correctivePreventiveAction: "",
  probabilityAfter: "",
  frequencyAfter: "",
  severityAfter: "",
  riskScoreAfter: "",
  riskDefinitionAfter: "",
  deadline: "",
  responsible: "",
  folderName: "",
  category: "",
  sectorKey: "",
  companyId: "all",
};

const toNumberOrNull = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const scoreFrom = (o: string, f: string, s: string, r: string) => {
  const explicitScore = toNumberOrNull(r);
  if (explicitScore !== null) return explicitScore;
  const probability = toNumberOrNull(o);
  const frequency = toNumberOrNull(f);
  const severity = toNumberOrNull(s);
  return probability && frequency && severity ? probability * frequency * severity : null;
};

const itemToForm = (item: SavedRiskItem): RiskFormState => ({
  activity: item.activity,
  hazard: item.hazard,
  risk: item.risk,
  currentStatus: item.currentStatus || "",
  detectionDate: item.detectionDate || "",
  probabilityBefore: item.probabilityBefore ? String(item.probabilityBefore) : "",
  frequencyBefore: item.frequencyBefore ? String(item.frequencyBefore) : "",
  severityBefore: item.severityBefore ? String(item.severityBefore) : "",
  riskScoreBefore: item.riskScoreBefore ? String(item.riskScoreBefore) : "",
  riskDefinitionBefore: item.riskDefinitionBefore || "",
  possibleConsequence: item.possibleConsequence || "",
  correctivePreventiveAction: item.correctivePreventiveAction || "",
  probabilityAfter: item.probabilityAfter ? String(item.probabilityAfter) : "",
  frequencyAfter: item.frequencyAfter ? String(item.frequencyAfter) : "",
  severityAfter: item.severityAfter ? String(item.severityAfter) : "",
  riskScoreAfter: item.riskScoreAfter ? String(item.riskScoreAfter) : "",
  riskDefinitionAfter: item.riskDefinitionAfter || "",
  deadline: item.deadline || "",
  responsible: item.responsible || "",
  folderName: item.folderName || "",
  category: item.category || "",
  sectorKey: item.sectorKey || "",
  companyId: item.companyId || "all",
});

function scoreBadge(values: Array<number | null | undefined>) {
  return values.map((value) => value ?? "-").join("/");
}

function FormInput({ label, value, onChange, required, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}{required ? " *" : ""}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={inputClass} />
    </div>
  );
}

function FormTextarea({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}{required ? " *" : ""}</Label>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={textareaClass} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/35 p-4">
      <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-200">{title}</h3>
      {children}
    </div>
  );
}

function BulkRiskValidPreview({ parseResult }: { parseResult: SavedRiskExcelParseResult }) {
  const rows = parseResult.validRows.slice(0, 8);

  return (
    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black text-slate-100">Okunan risk önizlemesi</p>
          <p className="text-xs text-slate-500">İlk satırlar kart görünümünde listelendi. Onayladığınızda tüm geçerli satırlar eklenecek.</p>
        </div>
        <Badge className="w-fit border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
          {parseResult.validRows.length} geçerli kayıt
        </Badge>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {rows.map((row) => {
          const score = [row.input?.probabilityBefore, row.input?.frequencyBefore, row.input?.severityBefore, row.input?.riskScoreBefore]
            .map((value) => value ?? "-")
            .join("/");

          return (
            <div key={row.rowNumber} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-100">{row.input?.activity || "Faaliyet yok"}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{row.input?.hazard || "Tehlike belirtilmemiş"}</p>
                </div>
                <Badge className="shrink-0 border-amber-500/30 bg-amber-500/10 text-amber-200">Satır {row.rowNumber}</Badge>
              </div>
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-lg bg-slate-950/60 p-2">
                  <p className="text-slate-500">Risk</p>
                  <p className="mt-1 line-clamp-2 font-semibold text-slate-200">{row.input?.risk || "-"}</p>
                </div>
                <div className="rounded-lg bg-slate-950/60 p-2">
                  <p className="text-slate-500">Mevcut durum</p>
                  <p className="mt-1 line-clamp-2 font-semibold text-slate-200">{row.input?.currentStatus || "-"}</p>
                </div>
                <div className="rounded-lg bg-slate-950/60 p-2">
                  <p className="text-slate-500">O/F/Ş/R</p>
                  <p className="mt-1 font-semibold text-amber-200">{score}</p>
                </div>
                <div className="rounded-lg bg-slate-950/60 p-2">
                  <p className="text-slate-500">Sorumlu / Termin</p>
                  <p className="mt-1 truncate font-semibold text-slate-200">{row.input?.responsible || "-"} / {row.input?.deadline || "-"}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {parseResult.validRows.length > rows.length ? (
        <p className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
          İlk {rows.length} kayıt gösteriliyor. Kalan {parseResult.validRows.length - rows.length} geçerli kayıt da onay sonrası eklenecek.
        </p>
      ) : null}
    </div>
  );
}

const defaultBulkFolderName = () => `Toplu Riskler - ${new Date().toLocaleDateString("tr-TR")}`;

const fileNameToFolderName = (fileName: string) => fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

export function ProfileRisksTab() {
  const { user, profile } = useAuth();
  const [risks, setRisks] = useState<SavedRiskItem[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [folderFilter, setFolderFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<RiskFormState>(emptyForm);
  const [editingRisk, setEditingRisk] = useState<SavedRiskItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFolderName, setUploadFolderName] = useState(defaultBulkFolderName);
  const [parseResult, setParseResult] = useState<SavedRiskExcelParseResult | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [riskRows, companyResponse] = await Promise.all([
        listSavedRiskItems(user.id),
        db.from("isgkatip_companies").select("id, company_name").eq("is_deleted", false).order("company_name", { ascending: true }),
      ]);
      setRisks(riskRows);
      setCompanies((companyResponse.data ?? []).map((row: any) => ({ id: row.id, name: row.company_name || "Firma" })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Riskler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.id]);

  const categories = useMemo(() => Array.from(new Set(risks.map((risk) => risk.category || risk.sectorKey).filter(Boolean))) as string[], [risks]);
  const folders = useMemo(() => Array.from(new Set(risks.map((risk) => risk.folderName).filter(Boolean))) as string[], [risks]);

  const filteredRisks = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr-TR");
    const rows = risks.filter((risk) => {
      const haystack = [risk.activity, risk.hazard, risk.risk, risk.responsible, risk.currentStatus, risk.correctivePreventiveAction].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
      const matchesQuery = !term || haystack.includes(term);
      const matchesCompany = companyFilter === "all" || risk.companyId === companyFilter;
      const matchesCategory = categoryFilter === "all" || risk.category === categoryFilter || risk.sectorKey === categoryFilter;
      const matchesSource = sourceFilter === "all" || risk.source === sourceFilter;
      const matchesFolder = folderFilter === "all" || risk.folderName === folderFilter;
      return matchesQuery && matchesCompany && matchesCategory && matchesSource && matchesFolder;
    });
    return [...rows].sort((a, b) => (sortMode === "az" ? a.activity.localeCompare(b.activity, "tr-TR") : (b.createdAt || "").localeCompare(a.createdAt || "")));
  }, [categoryFilter, companyFilter, folderFilter, query, risks, sortMode, sourceFilter]);

  const updateForm = (field: keyof RiskFormState, value: string) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (["probabilityBefore", "frequencyBefore", "severityBefore"].includes(field) && !current.riskScoreBefore) {
        const score = scoreFrom(next.probabilityBefore, next.frequencyBefore, next.severityBefore, "");
        next.riskScoreBefore = score ? String(score) : "";
      }
      if (["probabilityAfter", "frequencyAfter", "severityAfter"].includes(field) && !current.riskScoreAfter) {
        const score = scoreFrom(next.probabilityAfter, next.frequencyAfter, next.severityAfter, "");
        next.riskScoreAfter = score ? String(score) : "";
      }
      return next;
    });
  };

  const openCreate = () => {
    setEditingRisk(null);
    setForm({ ...emptyForm, folderName: folderFilter === "all" ? "" : folderFilter });
    setAddOpen(true);
  };

  const openUploadDialog = () => {
    setParseResult(null);
    setSelectedFileName("");
    setUploadFolderName(folderFilter === "all" ? defaultBulkFolderName() : folderFilter);
    setUploadOpen(true);
  };

  const openEdit = (risk: SavedRiskItem) => {
    setEditingRisk(risk);
    setForm(itemToForm(risk));
    setAddOpen(true);
  };

  const buildInput = (): SavedRiskInput => ({
    userId: user?.id || "",
    organizationId: profile?.organization_id || null,
    companyId: form.companyId === "all" ? null : form.companyId,
    sectorKey: form.sectorKey.trim() || null,
    category: form.category.trim() || null,
    activity: form.activity.trim(),
    hazard: form.hazard.trim(),
    risk: form.risk.trim(),
    currentStatus: form.currentStatus.trim() || null,
    detectionDate: form.detectionDate || null,
    probabilityBefore: toNumberOrNull(form.probabilityBefore),
    frequencyBefore: toNumberOrNull(form.frequencyBefore),
    severityBefore: toNumberOrNull(form.severityBefore),
    riskScoreBefore: scoreFrom(form.probabilityBefore, form.frequencyBefore, form.severityBefore, form.riskScoreBefore),
    riskDefinitionBefore: form.riskDefinitionBefore.trim() || null,
    possibleConsequence: form.possibleConsequence.trim() || null,
    correctivePreventiveAction: form.correctivePreventiveAction.trim() || null,
    probabilityAfter: toNumberOrNull(form.probabilityAfter),
    frequencyAfter: toNumberOrNull(form.frequencyAfter),
    severityAfter: toNumberOrNull(form.severityAfter),
    riskScoreAfter: scoreFrom(form.probabilityAfter, form.frequencyAfter, form.severityAfter, form.riskScoreAfter),
    riskDefinitionAfter: form.riskDefinitionAfter.trim() || null,
    deadline: form.deadline || null,
    responsible: form.responsible.trim() || null,
    folderName: form.folderName.trim() || null,
    source: "manual",
  });

  const saveRisk = async () => {
    if (!form.activity.trim() || !form.hazard.trim() || !form.risk.trim()) {
      toast.error("FAALİYET, TEHLİKE ve RİSK zorunludur.");
      return;
    }
    setSaving(true);
    try {
      const input = buildInput();
      const saved = editingRisk ? await updateSavedRiskItem(editingRisk.id, input) : await createSavedRiskItem(input);
      setRisks((current) => editingRisk ? current.map((risk) => (risk.id === saved.id ? saved : risk)) : [saved, ...current]);
      toast.success(editingRisk ? "Risk maddesi güncellendi." : "Risk maddesi eklendi.");
      setAddOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Risk maddesi kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bu risk maddesini silmek istiyor musunuz?")) return;
    await deleteSavedRiskItem(id);
    setRisks((current) => current.filter((risk) => risk.id !== id));
    setSelectedIds((current) => new Set([...current].filter((selectedId) => selectedId !== id)));
    toast.success("Risk maddesi silindi.");
  };

  const handleMoveSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const folderName = window.prompt("Seçilen risk maddeleri hangi klasöre taşınsın?", folderFilter === "all" ? defaultBulkFolderName() : folderFilter);
    if (folderName === null) return;
    const cleanedFolderName = folderName.trim();
    if (!cleanedFolderName) {
      toast.error("Klasör adı boş olamaz.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await db
        .from("saved_risk_items")
        .update({ folder_name: cleanedFolderName, updated_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      setRisks((current) => current.map((risk) => (selectedIds.has(risk.id) ? { ...risk, folderName: cleanedFolderName, updatedAt: new Date().toISOString() } : risk)));
      setFolderFilter(cleanedFolderName);
      setSelectedIds(new Set());
      toast.success(`${ids.length} risk maddesi "${cleanedFolderName}" klasörüne taşındı.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Risk maddeleri taşınamadı.");
    } finally {
      setSaving(false);
    }
  };

  const handleFile = async (file?: File | null) => {
    if (!file || !user?.id) return;
    if (!/\.(xlsx|xls|csv|docx)$/i.test(file.name)) {
      toast.error("Sadece .xlsx, .xls, .csv veya .docx formatında dosya yükleyebilirsiniz.");
      return;
    }
    try {
      setSelectedFileName(file.name);
      setUploadFolderName((current) => {
        const cleaned = current.trim();
        if (cleaned && !cleaned.startsWith("Toplu Riskler -")) return current;
        return fileNameToFolderName(file.name) || defaultBulkFolderName();
      });
      const result = /\.docx$/i.test(file.name)
        ? await parseSavedRiskWord(file, user.id, profile?.organization_id || null)
        : await parseSavedRiskExcel(file, user.id, profile?.organization_id || null);
      setParseResult(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dosya okunamadı.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const importParsedRows = async () => {
    if (!parseResult || parseResult.validRows.length === 0) return;
    setSaving(true);
    try {
      const folderName = uploadFolderName.trim() || defaultBulkFolderName();
      const result = await bulkCreateSavedRiskItems(
        parseResult.validRows.map((row) => ({ ...row.input!, folderName })).filter(Boolean),
        risks,
      );
      setRisks((current) => [...result.inserted, ...current]);
      setFolderFilter(folderName);
      toast.success(`${result.inserted.length} risk maddesi "${folderName}" klasörüne yüklendi.`, { description: result.skipped ? `${result.skipped} kayıt zaten vardı, atlandı.` : undefined });
      setUploadOpen(false);
      setParseResult(null);
      setSelectedFileName("");
      setUploadFolderName(defaultBulkFolderName());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Risk maddeleri yüklenemedi.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-[520px] space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative w-full xl:max-w-[580px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Risk ara..." className={cn(inputClass, "pl-9")} />
        </div>
        <div className="text-sm font-semibold text-slate-300">
          Toplam: <span className="text-cyan-300">{filteredRisks.length}</span>
        </div>
        <div className="flex flex-1 flex-wrap gap-2 xl:justify-end">
          <Button
            type="button"
            onClick={() => {
              const name = window.prompt("Klasör adı", defaultBulkFolderName());
              if (!name?.trim()) return;
              setFolderFilter(name.trim());
              setUploadFolderName(name.trim());
              toast.success(`"${name.trim()}" klasörü hazırlandı. Risk ekleyebilir veya toplu yükleme yapabilirsiniz.`);
            }}
            className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
          >
            <FolderPlus className="mr-2 h-4 w-4" />Klasör
          </Button>
          <Button type="button" disabled={selectedIds.size === 0 || saving} onClick={() => void handleMoveSelected()} className="rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500">
            <MoveRight className="mr-2 h-4 w-4" />Toplu Taşı
          </Button>
          <Button type="button" onClick={openUploadDialog} className="rounded-xl bg-violet-600 text-white hover:bg-violet-500">
            <Upload className="mr-2 h-4 w-4" />Toplu Yükle
          </Button>
          <Button type="button" onClick={downloadSavedRiskTemplate} className="rounded-xl bg-fuchsia-600 text-white hover:bg-fuchsia-500">
            <Sparkles className="mr-2 h-4 w-4" />Excel'den AI Şablon
          </Button>
          <Button type="button" onClick={() => toast.info("Paylaşılan şablon galerisi yakında bu alana bağlanacak.")} className="rounded-xl bg-sky-600 text-white hover:bg-sky-500">
            <Share2 className="mr-2 h-4 w-4" />Paylaşılan Şablonlar
          </Button>
          <Button type="button" onClick={openCreate} className="rounded-xl bg-amber-500 text-white hover:bg-amber-400">
            <Plus className="mr-2 h-4 w-4" />Ekle
          </Button>
        </div>
      </div>

      {folders.length ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setFolderFilter("all")} className={cn("rounded-full border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800", folderFilter === "all" && "border-cyan-400 bg-cyan-500/10 text-cyan-200")}>
            Tüm Riskler
          </Button>
          {folders.map((folder) => (
            <Button key={folder} type="button" size="sm" variant="outline" onClick={() => setFolderFilter(folder)} className={cn("rounded-full border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800", folderFilter === folder && "border-emerald-400 bg-emerald-500/10 text-emerald-200")}>
              <FolderOpen className="mr-2 h-3.5 w-3.5" />{folder}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-2 rounded-2xl border border-slate-800 bg-slate-900/45 p-3 md:grid-cols-4">
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Firma" /></SelectTrigger>
          <SelectContent className={selectContentClass}><SelectItem value="all">Tüm Firmalar</SelectItem>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Kategori/Sektör" /></SelectTrigger>
          <SelectContent className={selectContentClass}><SelectItem value="all">Tüm Kategoriler</SelectItem>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Kaynak" /></SelectTrigger>
          <SelectContent className={selectContentClass}><SelectItem value="all">Tüm Kaynaklar</SelectItem><SelectItem value="manual">Manuel</SelectItem><SelectItem value="excel">Excel</SelectItem><SelectItem value="word">Word</SelectItem><SelectItem value="ai">AI</SelectItem><SelectItem value="template">Şablon</SelectItem></SelectContent>
        </Select>
        <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
          <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Sıralama" /></SelectTrigger>
          <SelectContent className={selectContentClass}><SelectItem value="newest">Tarihe göre</SelectItem><SelectItem value="az">A-Z</SelectItem></SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid min-h-[340px] place-items-center rounded-2xl border border-slate-800 bg-slate-950/30 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filteredRisks.length === 0 ? (
        <div className="grid min-h-[360px] place-items-center rounded-2xl border border-slate-900/40 bg-slate-950/10">
          <div className="text-center">
            <TriangleAlert className="mx-auto h-11 w-11 text-slate-500" />
            <p className="mt-4 text-sm text-slate-300">Henüz risk maddesi eklenmemiş</p>
            <Button type="button" onClick={openCreate} className="mt-5 rounded-xl bg-amber-500 text-white hover:bg-amber-400">
              <Plus className="mr-2 h-4 w-4" />İlk Risk Maddesini Ekle
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredRisks.map((risk) => (
            <article key={risk.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-cyan-500/40 hover:bg-slate-900">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-3">
                  <input className="mt-1 h-4 w-4 accent-cyan-500" type="checkbox" checked={selectedIds.has(risk.id)} onChange={() => toggleSelected(risk.id)} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-slate-100">{risk.activity}</h3>
                      {risk.folderName ? <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200"><FolderOpen className="mr-1 h-3 w-3" />{risk.folderName}</Badge> : null}
                      <Badge className="border-slate-600 bg-slate-800 text-slate-300">{risk.source === "word" ? "Word" : risk.source === "excel" ? "Excel" : risk.source === "ai" ? "AI" : "Manuel"}</Badge>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-3">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
                        <p className="text-xs font-bold uppercase text-slate-500">Tehlike</p>
                        <p className="mt-1 text-sm font-semibold text-slate-200">{risk.hazard || "-"}</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
                        <p className="text-xs font-bold uppercase text-slate-500">Risk</p>
                        <p className="mt-1 text-sm font-semibold text-slate-200">{risk.risk || "-"}</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
                        <p className="text-xs font-bold uppercase text-slate-500">Düzeltici / Önleyici Faaliyet</p>
                        <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-200">{risk.correctivePreventiveAction || "-"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-200">O/F/Ş/R: {scoreBadge([risk.probabilityBefore, risk.frequencyBefore, risk.severityBefore, risk.riskScoreBefore])}</Badge>
                      <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200">DÖF: {scoreBadge([risk.probabilityAfter, risk.frequencyAfter, risk.severityAfter, risk.riskScoreAfter])}</Badge>
                      <Badge className="border-slate-600 bg-slate-800 text-slate-300">Tespit: {risk.detectionDate || "-"}</Badge>
                      <Badge className="border-slate-600 bg-slate-800 text-slate-300">Termin: {risk.deadline || "-"}</Badge>
                      <Badge className="border-slate-600 bg-slate-800 text-slate-300">Sorumlu: {risk.responsible || "-"}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="icon" variant="ghost" onClick={() => openEdit(risk)} className="h-9 w-9 rounded-xl text-slate-300 hover:bg-slate-800">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => void handleDelete(risk.id)} className="h-9 w-9 rounded-xl text-rose-300 hover:bg-rose-500/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[calc(100dvh-24px)] w-[calc(100vw-20px)] overflow-y-auto border-slate-800 bg-slate-900 p-0 text-slate-100 sm:max-w-[900px]">
          <DialogHeader className="border-b border-slate-800 px-5 py-4"><DialogTitle>{editingRisk ? "Risk Maddesini Düzenle" : "Risk Maddesi Ekle"}</DialogTitle><DialogDescription>Resmi tablo başlıklarına göre risk maddesi bilgilerini girin.</DialogDescription></DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <Section title="Temel Bilgiler"><div className="grid gap-3 md:grid-cols-3"><FormInput label="FAALİYET" required value={form.activity} onChange={(value) => updateForm("activity", value)} /><FormInput label="TEHLİKE" required value={form.hazard} onChange={(value) => updateForm("hazard", value)} /><FormInput label="RİSK" required value={form.risk} onChange={(value) => updateForm("risk", value)} /></div><div className="mt-3 grid gap-3 md:grid-cols-4"><FormInput label="KLASÖR" value={form.folderName} onChange={(value) => updateForm("folderName", value)} placeholder="Örn. İnşaat Riskleri" /><FormInput label="MEVCUT DURUM" value={form.currentStatus} onChange={(value) => updateForm("currentStatus", value)} /><FormInput label="TESPİT TARİHİ" type="date" value={form.detectionDate} onChange={(value) => updateForm("detectionDate", value)} /><FormInput label="SORUMLU" value={form.responsible} onChange={(value) => updateForm("responsible", value)} /></div></Section>
            <Section title="Mevcut Risk Skoru"><div className="grid gap-3 md:grid-cols-5"><FormInput label="O" type="number" value={form.probabilityBefore} onChange={(value) => updateForm("probabilityBefore", value)} /><FormInput label="F" type="number" value={form.frequencyBefore} onChange={(value) => updateForm("frequencyBefore", value)} /><FormInput label="Ş" type="number" value={form.severityBefore} onChange={(value) => updateForm("severityBefore", value)} /><FormInput label="R" type="number" value={form.riskScoreBefore} onChange={(value) => updateForm("riskScoreBefore", value)} /><FormInput label="Kategori/Sektör" value={form.category} onChange={(value) => updateForm("category", value)} /></div><div className="mt-3"><FormTextarea label="RİSKİN TANIMI" value={form.riskDefinitionBefore} onChange={(value) => updateForm("riskDefinitionBefore", value)} /></div></Section>
            <Section title="Önleyici Faaliyet"><div className="grid gap-3 md:grid-cols-2"><FormTextarea label="OLASI SONUÇ" value={form.possibleConsequence} onChange={(value) => updateForm("possibleConsequence", value)} /><FormTextarea label="DÜZELTİCİ / ÖNLEYİCİ FAALİYET" value={form.correctivePreventiveAction} onChange={(value) => updateForm("correctivePreventiveAction", value)} /></div></Section>
            <Section title="DÖF Sonrası Risk"><div className="grid gap-3 md:grid-cols-5"><FormInput label="O" type="number" value={form.probabilityAfter} onChange={(value) => updateForm("probabilityAfter", value)} /><FormInput label="F" type="number" value={form.frequencyAfter} onChange={(value) => updateForm("frequencyAfter", value)} /><FormInput label="Ş" type="number" value={form.severityAfter} onChange={(value) => updateForm("severityAfter", value)} /><FormInput label="R" type="number" value={form.riskScoreAfter} onChange={(value) => updateForm("riskScoreAfter", value)} /><FormInput label="TERMİN" type="date" value={form.deadline} onChange={(value) => updateForm("deadline", value)} /></div><div className="mt-3"><FormTextarea label="RİSKİN TANIMI (DÖF SONRASI)" value={form.riskDefinitionAfter} onChange={(value) => updateForm("riskDefinitionAfter", value)} /></div></Section>
          </div>
          <DialogFooter className="border-t border-slate-800 px-5 py-4"><Button type="button" variant="outline" onClick={() => setAddOpen(false)} className="rounded-xl border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700">İptal</Button><Button type="button" disabled={saving} onClick={() => void saveRisk()} className="rounded-xl bg-amber-500 text-white hover:bg-amber-400">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-h-[calc(100dvh-24px)] w-[calc(100vw-20px)] overflow-hidden border-slate-800 bg-slate-900 p-0 text-slate-100 sm:max-w-5xl">
          <DialogHeader className="border-b border-slate-800 bg-slate-950/40 px-5 py-4">
            <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-violet-300" />Toplu Risk Yükle</DialogTitle>
            <DialogDescription>Excel veya Word dosyanızdaki resmi başlıkları okuyarak risk maddelerini onay öncesi özetleyin.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(100dvh-170px)] space-y-4 overflow-y-auto overflow-x-hidden px-5 py-5">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <Label className="text-xs font-black uppercase tracking-wide text-emerald-200">Bu yükleme için klasör adı</Label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={uploadFolderName}
                  onChange={(event) => setUploadFolderName(event.target.value)}
                  placeholder="Örn. İnşaat Risk Analizi"
                  className={cn(inputClass, "border-emerald-500/30 focus-visible:ring-emerald-500/30")}
                />
                <Button type="button" variant="outline" onClick={() => setUploadFolderName(selectedFileName ? fileNameToFolderName(selectedFileName) : defaultBulkFolderName())} className="rounded-xl border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20">
                  <FolderOpen className="mr-2 h-4 w-4" />Otomatik Adlandır
                </Button>
              </div>
              <p className="mt-2 text-xs text-emerald-100/70">Onaylanan tüm risk maddeleri bu klasörün içinde listelenecek.</p>
            </div>
            <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-slate-600 bg-slate-950/30 p-4 transition hover:border-violet-400/70 sm:flex-row sm:items-center sm:justify-between" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void handleFile(event.dataTransfer.files?.[0]); }}>
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-300">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-100">Dosya seçin veya buraya bırakın</p>
                  <p className="mt-1 text-xs text-slate-500">Kabul edilen formatlar: .xlsx, .xls, .csv, .docx</p>
                  {selectedFileName ? <p className="mt-2 break-all text-xs font-semibold text-violet-200">Seçilen dosya: {selectedFileName}</p> : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-xl bg-violet-600 text-white hover:bg-violet-500"><Upload className="mr-2 h-4 w-4" />Dosya Seç</Button>
                <Button type="button" variant="outline" onClick={downloadSavedRiskTemplate} className="rounded-xl border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"><Download className="mr-2 h-4 w-4" />Şablon İndir</Button>
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.docx" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0])} />
            </div>
            {parseResult ? <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-800/70 p-3"><p className="text-xs text-slate-400">Toplam satır</p><p className="text-2xl font-black text-white">{parseResult.totalRows}</p></div><div className="rounded-xl bg-emerald-500/10 p-3"><p className="text-xs text-emerald-300">Geçerli satır</p><p className="text-2xl font-black text-emerald-200">{parseResult.validRows.length}</p></div><div className="rounded-xl bg-rose-500/10 p-3"><p className="text-xs text-rose-300">Hatalı satır</p><p className="text-2xl font-black text-rose-200">{parseResult.invalidRows.length}</p></div></div>{parseResult.missingHeaders.length ? <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">Eksik / hatalı başlıklar: {parseResult.missingHeaders.join(", ")}</div> : null}{parseResult.validRows.length ? <BulkRiskValidPreview parseResult={parseResult} /> : null}{parseResult.invalidRows.length ? <div className="mt-4 max-h-48 overflow-y-auto rounded-xl border border-slate-800"><table className="w-full text-xs"><tbody>{parseResult.invalidRows.slice(0, 20).map((row) => <tr key={row.rowNumber} className="border-b border-slate-800"><td className="px-3 py-2 text-slate-400">Satır {row.rowNumber}</td><td className="px-3 py-2 text-rose-300">{row.errors.join(" ")}</td></tr>)}</tbody></table></div> : null}</div> : null}
          </div>
          <DialogFooter className="border-t border-slate-800 bg-slate-950/40 px-5 py-4"><Button type="button" variant="outline" onClick={() => setUploadOpen(false)} className="rounded-xl border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700">Kapat</Button><Button type="button" disabled={saving || !parseResult?.validRows.length} onClick={() => void importParsedRows()} className="rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-400">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{parseResult?.validRows.length || 0} Kaydı Yükle</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


