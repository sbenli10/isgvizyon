import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Download, Edit2, FileSpreadsheet, Loader2, Plus, Search, Trash2, TriangleAlert, Upload } from "lucide-react";
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
  bulkDeleteSavedRiskItems,
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
  const rows = parseResult.validRows.slice(0, 50);

  return (
    <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-slate-800">
      <table className="w-full min-w-[1120px] text-left text-xs">
        <thead className="bg-slate-900 text-slate-300">
          <tr>
            <th className="px-3 py-2">Satır</th>
            <th className="px-3 py-2">Faaliyet</th>
            <th className="px-3 py-2">Tehlike</th>
            <th className="px-3 py-2">Risk</th>
            <th className="px-3 py-2">Mevcut Durum</th>
            <th className="px-3 py-2">O/F/Ş/R</th>
            <th className="px-3 py-2">DÖF</th>
            <th className="px-3 py-2">Termin</th>
            <th className="px-3 py-2">Sorumlu</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowNumber} className="border-t border-slate-800">
              <td className="px-3 py-2 text-slate-400">{row.rowNumber}</td>
              <td className="px-3 py-2 font-semibold text-slate-100">{row.input?.activity || "-"}</td>
              <td className="px-3 py-2 text-slate-300">{row.input?.hazard || "-"}</td>
              <td className="px-3 py-2 text-slate-300">{row.input?.risk || "-"}</td>
              <td className="px-3 py-2 text-slate-400">{row.input?.currentStatus || "-"}</td>
              <td className="px-3 py-2 text-amber-200">
                {[row.input?.probabilityBefore, row.input?.frequencyBefore, row.input?.severityBefore, row.input?.riskScoreBefore]
                  .map((value) => value ?? "-")
                  .join("/")}
              </td>
              <td className="px-3 py-2 text-slate-400">{row.input?.correctivePreventiveAction || "-"}</td>
              <td className="px-3 py-2 text-slate-400">{row.input?.deadline || "-"}</td>
              <td className="px-3 py-2 text-slate-400">{row.input?.responsible || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {parseResult.validRows.length > rows.length ? (
        <p className="border-t border-slate-800 px-3 py-2 text-xs text-slate-500">
          İlk {rows.length} geçerli satır gösteriliyor. Onayladığınızda tüm geçerli satırlar eklenecek.
        </p>
      ) : null}
    </div>
  );
}

export function ProfileRisksTab() {
  const { user, profile } = useAuth();
  const [risks, setRisks] = useState<SavedRiskItem[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<RiskFormState>(emptyForm);
  const [editingRisk, setEditingRisk] = useState<SavedRiskItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
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
      toast.error(error instanceof Error ? error.message : "Riskler yÃ¼klenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.id]);

  const categories = useMemo(() => Array.from(new Set(risks.map((risk) => risk.category || risk.sectorKey).filter(Boolean))) as string[], [risks]);

  const filteredRisks = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr-TR");
    const rows = risks.filter((risk) => {
      const haystack = [risk.activity, risk.hazard, risk.risk, risk.responsible, risk.currentStatus, risk.correctivePreventiveAction].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
      const matchesQuery = !term || haystack.includes(term);
      const matchesCompany = companyFilter === "all" || risk.companyId === companyFilter;
      const matchesCategory = categoryFilter === "all" || risk.category === categoryFilter || risk.sectorKey === categoryFilter;
      const matchesSource = sourceFilter === "all" || risk.source === sourceFilter;
      return matchesQuery && matchesCompany && matchesCategory && matchesSource;
    });
    return [...rows].sort((a, b) => (sortMode === "az" ? a.activity.localeCompare(b.activity, "tr-TR") : (b.createdAt || "").localeCompare(a.createdAt || "")));
  }, [categoryFilter, companyFilter, query, risks, sortMode, sourceFilter]);

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
    setForm(emptyForm);
    setAddOpen(true);
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
    source: "manual",
  });

  const saveRisk = async () => {
    if (!form.activity.trim() || !form.hazard.trim() || !form.risk.trim()) {
      toast.error("FAALÄ°YET, TEHLÄ°KE ve RÄ°SK zorunludur.");
      return;
    }
    setSaving(true);
    try {
      const input = buildInput();
      const saved = editingRisk ? await updateSavedRiskItem(editingRisk.id, input) : await createSavedRiskItem(input);
      setRisks((current) => editingRisk ? current.map((risk) => (risk.id === saved.id ? saved : risk)) : [saved, ...current]);
      toast.success(editingRisk ? "Risk maddesi gÃ¼ncellendi." : "Risk maddesi eklendi.");
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

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!window.confirm(`${ids.length} risk maddesini silmek istiyor musunuz?`)) return;
    await bulkDeleteSavedRiskItems(ids);
    setRisks((current) => current.filter((risk) => !selectedIds.has(risk.id)));
    setSelectedIds(new Set());
    toast.success("SeÃ§ilen risk maddeleri silindi.");
  };

  const handleFile = async (file?: File | null) => {
    if (!file || !user?.id) return;
    if (!/\.(xlsx|xls|csv|docx)$/i.test(file.name)) {
      toast.error("Sadece .xlsx, .xls, .csv veya .docx formatinda dosya yukleyebilirsiniz.");
      return;
    }
    try {
      setSelectedFileName(file.name);
      const result = /\.docx$/i.test(file.name)
        ? await parseSavedRiskWord(file, user.id, profile?.organization_id || null)
        : await parseSavedRiskExcel(file, user.id, profile?.organization_id || null);
      setParseResult(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dosya okunamadi.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const importParsedRows = async () => {
    if (!parseResult || parseResult.validRows.length === 0) return;
    setSaving(true);
    try {
      const result = await bulkCreateSavedRiskItems(parseResult.validRows.map((row) => row.input!).filter(Boolean), risks);
      setRisks((current) => [...result.inserted, ...current]);
      toast.success(`${result.inserted.length} risk maddesi yÃ¼klendi.`, { description: result.skipped ? `${result.skipped} kayÄ±t zaten vardÄ±, atlandÄ±.` : undefined });
      setUploadOpen(false);
      setParseResult(null);
      setSelectedFileName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Risk maddeleri yÃ¼klenemedi.");
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
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/20 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300"><TriangleAlert className="h-6 w-6" /></div>
            <div>
              <h2 className="text-2xl font-black text-white">Risklerim</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-400">Resmi risk tablo basliklariyla manuel kayit olusturun veya Excel/Word dosyasi uzerinden toplu yukleyin.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={openCreate} className="rounded-xl bg-amber-500 text-white hover:bg-amber-400"><Plus className="mr-2 h-4 w-4" />Risk Ekle</Button>
            <Button type="button" onClick={() => setUploadOpen(true)} className="rounded-xl bg-violet-600 text-white hover:bg-violet-500"><Upload className="mr-2 h-4 w-4" />Toplu Risk Yukle</Button>
            <Button type="button" variant="outline" onClick={downloadSavedRiskTemplate} className="rounded-xl border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"><Download className="mr-2 h-4 w-4" />Åžablon Ä°ndir</Button>
            <Button type="button" variant="outline" disabled={selectedIds.size === 0} onClick={() => void handleBulkDelete()} className="rounded-xl border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"><Trash2 className="mr-2 h-4 w-4" />SeÃ§ilenleri Sil</Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_180px_180px_160px_160px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Faaliyet, tehlike, risk veya sorumlu ara..." className={cn(inputClass, "pl-9")} />
          </div>
          <Select value={companyFilter} onValueChange={setCompanyFilter}><SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Firma" /></SelectTrigger><SelectContent className={selectContentClass}><SelectItem value="all">TÃ¼m Firmalar</SelectItem>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}</SelectContent></Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Kategori/SektÃ¶r" /></SelectTrigger><SelectContent className={selectContentClass}><SelectItem value="all">TÃ¼m Kategoriler</SelectItem>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}><SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Kaynak" /></SelectTrigger><SelectContent className={selectContentClass}><SelectItem value="all">TÃ¼mÃ¼</SelectItem><SelectItem value="manual">Manuel</SelectItem><SelectItem value="excel">Excel</SelectItem><SelectItem value="word">Word</SelectItem><SelectItem value="ai">AI</SelectItem><SelectItem value="template">Åžablon</SelectItem></SelectContent></Select>
          <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}><SelectTrigger className={selectTriggerClass}><SelectValue placeholder="SÄ±ralama" /></SelectTrigger><SelectContent className={selectContentClass}><SelectItem value="newest">Tarihe gÃ¶re</SelectItem><SelectItem value="az">A-Z</SelectItem></SelectContent></Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/50">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1680px] text-left text-sm">
            <thead className="bg-slate-900/80 text-xs font-black uppercase text-slate-300">
              <tr>
                <th className="px-3 py-3"><input type="checkbox" checked={filteredRisks.length > 0 && filteredRisks.every((risk) => selectedIds.has(risk.id))} onChange={(event) => setSelectedIds(event.target.checked ? new Set(filteredRisks.map((risk) => risk.id)) : new Set())} /></th>
                {['FAALÄ°YET','TEHLÄ°KE','RÄ°SK','MEVCUT DURUM','TESPÄ°T TARÄ°HÄ°','O/F/Åž/R','RÄ°SKÄ°N TANIMI','OLASI SONUÃ‡','DÃ–F','O/F/Åž/R DÃ–F SONRASI','TERMÄ°N','SORUMLU','Ä°ÅŸlemler'].map((header) => <th key={header} className="px-3 py-3">{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={14} className="h-40 text-center text-slate-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr> : filteredRisks.length === 0 ? (
                <tr><td colSpan={14} className="h-52 px-4 text-center"><div className="text-base font-bold text-slate-300">Henuz risk maddesi eklenmemis</div><p className="mt-2 text-sm text-slate-500">Manuel risk ekleyebilir veya Excel/Word dosyasi ile toplu yukleyebilirsiniz.</p></td></tr>
              ) : filteredRisks.map((risk) => (
                <tr key={risk.id} className="border-t border-slate-800/80 align-top transition hover:bg-slate-900/60">
                  <td className="px-3 py-4"><input type="checkbox" checked={selectedIds.has(risk.id)} onChange={() => toggleSelected(risk.id)} /></td>
                  <td className="px-3 py-4 font-semibold text-slate-100">{risk.activity}</td>
                  <td className="px-3 py-4 text-slate-300">{risk.hazard}</td>
                  <td className="px-3 py-4 text-slate-300">{risk.risk}</td>
                  <td className="px-3 py-4 text-slate-400">{risk.currentStatus || "-"}</td>
                  <td className="px-3 py-4 text-slate-400">{risk.detectionDate || "-"}</td>
                  <td className="px-3 py-4"><Badge className="border-amber-500/30 bg-amber-500/10 text-amber-200">{scoreBadge([risk.probabilityBefore, risk.frequencyBefore, risk.severityBefore, risk.riskScoreBefore])}</Badge></td>
                  <td className="px-3 py-4 text-slate-400">{risk.riskDefinitionBefore || "-"}</td>
                  <td className="px-3 py-4 text-slate-400">{risk.possibleConsequence || "-"}</td>
                  <td className="px-3 py-4 text-slate-400">{risk.correctivePreventiveAction || "-"}</td>
                  <td className="px-3 py-4"><Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200">{scoreBadge([risk.probabilityAfter, risk.frequencyAfter, risk.severityAfter, risk.riskScoreAfter])}</Badge></td>
                  <td className="px-3 py-4 text-slate-400">{risk.deadline || "-"}</td>
                  <td className="px-3 py-4 text-slate-400">{risk.responsible || "-"}</td>
                  <td className="px-3 py-4"><div className="flex gap-1"><Button type="button" size="icon" variant="ghost" onClick={() => openEdit(risk)} className="h-8 w-8 rounded-lg text-slate-300 hover:bg-slate-800"><Edit2 className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" onClick={() => void handleDelete(risk.id)} className="h-8 w-8 rounded-lg text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[calc(100dvh-24px)] w-[calc(100vw-20px)] overflow-y-auto border-slate-800 bg-slate-900 p-0 text-slate-100 sm:max-w-[900px]">
          <DialogHeader className="border-b border-slate-800 px-5 py-4"><DialogTitle>{editingRisk ? "Risk Maddesini DÃ¼zenle" : "Risk Maddesi Ekle"}</DialogTitle><DialogDescription>Resmi tablo baÅŸlÄ±klarÄ±na gÃ¶re risk maddesi bilgilerini girin.</DialogDescription></DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <Section title="Temel Bilgiler"><div className="grid gap-3 md:grid-cols-3"><FormInput label="FAALÄ°YET" required value={form.activity} onChange={(value) => updateForm("activity", value)} /><FormInput label="TEHLÄ°KE" required value={form.hazard} onChange={(value) => updateForm("hazard", value)} /><FormInput label="RÄ°SK" required value={form.risk} onChange={(value) => updateForm("risk", value)} /></div><div className="mt-3 grid gap-3 md:grid-cols-3"><FormInput label="MEVCUT DURUM" value={form.currentStatus} onChange={(value) => updateForm("currentStatus", value)} /><FormInput label="TESPÄ°T TARÄ°HÄ°" type="date" value={form.detectionDate} onChange={(value) => updateForm("detectionDate", value)} /><FormInput label="SORUMLU" value={form.responsible} onChange={(value) => updateForm("responsible", value)} /></div></Section>
            <Section title="Mevcut Risk Skoru"><div className="grid gap-3 md:grid-cols-5"><FormInput label="O" type="number" value={form.probabilityBefore} onChange={(value) => updateForm("probabilityBefore", value)} /><FormInput label="F" type="number" value={form.frequencyBefore} onChange={(value) => updateForm("frequencyBefore", value)} /><FormInput label="Åž" type="number" value={form.severityBefore} onChange={(value) => updateForm("severityBefore", value)} /><FormInput label="R" type="number" value={form.riskScoreBefore} onChange={(value) => updateForm("riskScoreBefore", value)} /><FormInput label="Kategori/SektÃ¶r" value={form.category} onChange={(value) => updateForm("category", value)} /></div><div className="mt-3"><FormTextarea label="RÄ°SKÄ°N TANIMI" value={form.riskDefinitionBefore} onChange={(value) => updateForm("riskDefinitionBefore", value)} /></div></Section>
            <Section title="Ã–nleyici Faaliyet"><div className="grid gap-3 md:grid-cols-2"><FormTextarea label="OLASI SONUÃ‡" value={form.possibleConsequence} onChange={(value) => updateForm("possibleConsequence", value)} /><FormTextarea label="DÃœZELTÄ°CÄ° / Ã–NLEYÄ°CÄ° FAALÄ°YET" value={form.correctivePreventiveAction} onChange={(value) => updateForm("correctivePreventiveAction", value)} /></div></Section>
            <Section title="DÃ–F SonrasÄ± Risk"><div className="grid gap-3 md:grid-cols-5"><FormInput label="O" type="number" value={form.probabilityAfter} onChange={(value) => updateForm("probabilityAfter", value)} /><FormInput label="F" type="number" value={form.frequencyAfter} onChange={(value) => updateForm("frequencyAfter", value)} /><FormInput label="Åž" type="number" value={form.severityAfter} onChange={(value) => updateForm("severityAfter", value)} /><FormInput label="R" type="number" value={form.riskScoreAfter} onChange={(value) => updateForm("riskScoreAfter", value)} /><FormInput label="TERMÄ°N" type="date" value={form.deadline} onChange={(value) => updateForm("deadline", value)} /></div><div className="mt-3"><FormTextarea label="RÄ°SKÄ°N TANIMI (DÃ–F SONRASI)" value={form.riskDefinitionAfter} onChange={(value) => updateForm("riskDefinitionAfter", value)} /></div></Section>
          </div>
          <DialogFooter className="border-t border-slate-800 px-5 py-4"><Button type="button" variant="outline" onClick={() => setAddOpen(false)} className="rounded-xl border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700">Ä°ptal</Button><Button type="button" disabled={saving} onClick={() => void saveRisk()} className="rounded-xl bg-amber-500 text-white hover:bg-amber-400">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-h-[calc(100dvh-24px)] w-[calc(100vw-20px)] overflow-y-auto border-slate-800 bg-slate-900 p-0 text-slate-100 sm:max-w-4xl">
          <DialogHeader className="border-b border-slate-800 px-5 py-4"><DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-violet-300" />Toplu Risk Yükle</DialogTitle><DialogDescription>Excel veya Word dosyanızdaki resmi başlıkları okuyarak risk maddelerini satır satır önizleyin.</DialogDescription></DialogHeader>
          <div className="space-y-4 px-5 py-5">
            <div className="grid min-h-[130px] place-items-center rounded-2xl border border-dashed border-slate-600 bg-slate-950/30 p-6 text-center transition hover:border-violet-400/70" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void handleFile(event.dataTransfer.files?.[0]); }}>
              <div><Upload className="mx-auto h-8 w-8 text-slate-500" /><p className="mt-2 font-semibold text-slate-200">Dosya seçin veya şablonu indirip doldurun</p><p className="mt-1 text-xs text-slate-500">Kabul edilen formatlar: .xlsx, .xls, .csv, .docx</p><div className="mt-4 flex flex-wrap justify-center gap-2"><Button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-xl bg-violet-600 text-white hover:bg-violet-500"><Upload className="mr-2 h-4 w-4" />Dosya Seç</Button><Button type="button" variant="outline" onClick={downloadSavedRiskTemplate} className="rounded-xl border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"><Download className="mr-2 h-4 w-4" />Şablon İndir</Button></div></div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.docx" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0])} />
            </div>
            {selectedFileName ? <p className="text-xs text-slate-400">SeÃ§ilen dosya: {selectedFileName}</p> : null}
            {parseResult ? <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-800/70 p-3"><p className="text-xs text-slate-400">Toplam satÄ±r</p><p className="text-2xl font-black text-white">{parseResult.totalRows}</p></div><div className="rounded-xl bg-emerald-500/10 p-3"><p className="text-xs text-emerald-300">GeÃ§erli satÄ±r</p><p className="text-2xl font-black text-emerald-200">{parseResult.validRows.length}</p></div><div className="rounded-xl bg-rose-500/10 p-3"><p className="text-xs text-rose-300">HatalÄ± satÄ±r</p><p className="text-2xl font-black text-rose-200">{parseResult.invalidRows.length}</p></div></div>{parseResult.missingHeaders.length ? <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">Eksik / hatalÄ± baÅŸlÄ±klar: {parseResult.missingHeaders.join(", ")}</div> : null}{parseResult.validRows.length ? <BulkRiskValidPreview parseResult={parseResult} /> : null}{parseResult.invalidRows.length ? <div className="mt-4 max-h-48 overflow-y-auto rounded-xl border border-slate-800"><table className="w-full text-xs"><tbody>{parseResult.invalidRows.slice(0, 20).map((row) => <tr key={row.rowNumber} className="border-b border-slate-800"><td className="px-3 py-2 text-slate-400">SatÄ±r {row.rowNumber}</td><td className="px-3 py-2 text-rose-300">{row.errors.join(" ")}</td></tr>)}</tbody></table></div> : null}</div> : null}
          </div>
          <DialogFooter className="border-t border-slate-800 px-5 py-4"><Button type="button" variant="outline" onClick={() => setUploadOpen(false)} className="rounded-xl border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700">Kapat</Button><Button type="button" disabled={saving || !parseResult?.validRows.length} onClick={() => void importParsedRows()} className="rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-400">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{parseResult?.validRows.length || 0} KaydÄ± YÃ¼kle</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


