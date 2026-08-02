import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  Activity,
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteOsgbPersonnel,
  upsertOsgbPersonnel,
  type OsgbPersonnelInput,
  type OsgbPersonnelRecord,
} from "@/lib/osgbOperations";
import {
  getOsgbPersonnelCapacityPanel,
  listOsgbWorkspaceCompanies,
  upsertOsgbAssignmentWorkspace,
  type OsgbPersonnelCapacityRecord,
  type OsgbWorkspaceCompanyOption,
  type OsgbWorkspaceAssignmentRecord,
  type OsgbRole,
} from "@/lib/osgbPlatform";
import { cn } from "@/lib/utils";

type PersonnelFormState = {
  fullName: string;
  role: OsgbRole;
  certificateNo: string;
  phone: string;
  email: string;
  certificateExpiryDate: string;
  monthlyCapacityMinutes: string;
  expertiseAreas: string;
  notes: string;
  isActive: boolean;
  assignmentCompanyId: string;
  assignmentMinutes: string;
  assignmentStatus: OsgbWorkspaceAssignmentRecord["status"];
  assignmentStartDate: string;
  assignmentEndDate: string;
  assignmentNotes: string;
};

type PersonnelRow = OsgbPersonnelRecord & {
  organization_id?: string | null;
};

type BulkPreviewRow = PersonnelFormState & {
  rowNo: number;
};

const roleLabels: Record<OsgbRole, string> = {
  igu: "İş Güvenliği Uzmanı",
  hekim: "İşyeri Hekimi",
  dsp: "Diğer Sağlık Personeli",
};

const roleShortLabels: Record<OsgbRole, string> = {
  igu: "İGU",
  hekim: "Hekim",
  dsp: "DSP",
};

const emptyForm: PersonnelFormState = {
  fullName: "",
  role: "igu",
  certificateNo: "",
  phone: "",
  email: "",
  certificateExpiryDate: "",
  monthlyCapacityMinutes: "781",
  expertiseAreas: "",
  notes: "",
  isActive: true,
  assignmentCompanyId: "none",
  assignmentMinutes: "",
  assignmentStatus: "active",
  assignmentStartDate: new Date().toISOString().slice(0, 10),
  assignmentEndDate: "",
  assignmentNotes: "",
};

const normalizeSearch = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");

const parseRole = (value: unknown): OsgbRole => {
  const normalized = normalizeSearch(String(value || ""));
  if (normalized.includes("hekim")) return "hekim";
  if (normalized.includes("dsp") || normalized.includes("diger") || normalized.includes("saglik")) return "dsp";
  return "igu";
};

const getCell = (row: Record<string, unknown>, names: string[]) => {
  const keys = Object.keys(row);
  const normalizedNames = names.map(normalizeSearch);
  const key = keys.find((item) => normalizedNames.includes(normalizeSearch(item)));
  return key ? row[key] : "";
};

const toInput = (value: unknown) => String(value ?? "").trim();

const toPersonnelInput = (form: PersonnelFormState): OsgbPersonnelInput => ({
  fullName: form.fullName.trim(),
  role: form.role,
  certificateNo: form.certificateNo.trim() || null,
  phone: form.phone.trim() || null,
  email: form.email.trim() || null,
  certificateExpiryDate: form.certificateExpiryDate || null,
  expertiseAreas: form.expertiseAreas
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  monthlyCapacityMinutes: Math.max(0, Number(form.monthlyCapacityMinutes || 0)),
  isActive: form.isActive,
  notes: form.notes.trim() || null,
});

const mapPersonnelToForm = (person: PersonnelRow): PersonnelFormState => ({
  fullName: person.full_name || "",
  role: person.role,
  certificateNo: person.certificate_no || "",
  phone: person.phone || "",
  email: person.email || "",
  certificateExpiryDate: person.certificate_expiry_date || "",
  monthlyCapacityMinutes: String(person.monthly_capacity_minutes || 0),
  expertiseAreas: Array.isArray(person.expertise_areas) ? person.expertise_areas.join(", ") : "",
  notes: person.notes || "",
  isActive: person.is_active !== false,
  assignmentCompanyId: "none",
  assignmentMinutes: "",
  assignmentStatus: "active",
  assignmentStartDate: new Date().toISOString().slice(0, 10),
  assignmentEndDate: "",
  assignmentNotes: "",
});

export default function OSGBPersonnel() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const organizationId = profile?.organization_id || null;
  const userId = user?.id || profile?.id || null;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [personnel, setPersonnel] = useState<PersonnelRow[]>([]);
  const [companies, setCompanies] = useState<OsgbWorkspaceCompanyOption[]>([]);
  const [capacity, setCapacity] = useState<OsgbPersonnelCapacityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | OsgbRole>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "active" | "passive">("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonnelRow | null>(null);
  const [form, setForm] = useState<PersonnelFormState>(emptyForm);
  const [bulkPreview, setBulkPreview] = useState<BulkPreviewRow[]>([]);

  const loadData = useCallback(async () => {
    if (!organizationId || !userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const personnelQuery = (supabase as any)
        .from("osgb_personnel")
        .select("*")
        .eq("organization_id", organizationId)
        .order("full_name", { ascending: true });

      const [personnelResult, capacityRows, companyRows] = await Promise.all([
        personnelQuery,
        getOsgbPersonnelCapacityPanel(organizationId),
        listOsgbWorkspaceCompanies(organizationId),
      ]);

      if (personnelResult.error) throw personnelResult.error;
      setPersonnel((personnelResult.data ?? []) as PersonnelRow[]);
      setCapacity(capacityRows);
      setCompanies(companyRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Personel havuzu yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const capacityByPersonnelId = useMemo(
    () => new Map(capacity.map((item) => [item.personnelId, item])),
    [capacity],
  );

  const filteredPersonnel = useMemo(() => {
    const normalizedTerm = normalizeSearch(search);
    return personnel.filter((item) => {
      const matchesRole = roleFilter === "ALL" || item.role === roleFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "active" ? item.is_active !== false : item.is_active === false);
      const searchable = normalizeSearch(
        [item.full_name, item.email, item.phone, item.certificate_no, item.notes, roleLabels[item.role]].join(" "),
      );
      return matchesRole && matchesStatus && (!normalizedTerm || searchable.includes(normalizedTerm));
    });
  }, [personnel, roleFilter, search, statusFilter]);

  const summary = useMemo(
    () => ({
      igu: personnel.filter((item) => item.role === "igu" && item.is_active !== false).length,
      hekim: personnel.filter((item) => item.role === "hekim" && item.is_active !== false).length,
      dsp: personnel.filter((item) => item.role === "dsp" && item.is_active !== false).length,
      overloaded: capacity.filter((item) => item.overloaded).length,
      totalCapacity: capacity.reduce((sum, item) => sum + item.monthlyCapacityMinutes, 0),
      assigned: capacity.reduce((sum, item) => sum + item.assignedMinutes, 0),
    }),
    [capacity, personnel],
  );

  const openCreateForm = () => {
    setEditingPerson(null);
    setForm({
      ...emptyForm,
      assignmentStartDate: new Date().toISOString().slice(0, 10),
    });
    setFormOpen(true);
  };

  const openEditForm = (person: PersonnelRow) => {
    setEditingPerson(person);
    setForm(mapPersonnelToForm(person));
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!userId || !form.fullName.trim()) {
      toast.error("Personel adı soyadı zorunludur.");
      return;
    }

    setSaving(true);
    try {
      const savedPerson = await upsertOsgbPersonnel(userId, toPersonnelInput(form), editingPerson?.id);
      if (organizationId && form.assignmentCompanyId !== "none") {
        if (!form.assignmentMinutes || Number(form.assignmentMinutes) <= 0) {
          toast.error("Firma görevlendirmesi için atanacak süre girin.");
          setSaving(false);
          return;
        }
        await upsertOsgbAssignmentWorkspace(userId, organizationId, {
          companyId: form.assignmentCompanyId,
          personnelId: savedPerson.id,
          assignedRole: form.role,
          assignedMinutes: Number(form.assignmentMinutes),
          startDate: form.assignmentStartDate || new Date().toISOString().slice(0, 10),
          endDate: form.assignmentEndDate || null,
          status: form.assignmentStatus,
          notes: form.assignmentNotes || null,
        });
      }
      toast.success(
        form.assignmentCompanyId !== "none"
          ? "Personel eklendi ve firma görevlendirmesi oluşturuldu."
          : editingPerson
            ? "Personel güncellendi."
            : "Personel havuza eklendi.",
      );
      setFormOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Personel kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (person: PersonnelRow) => {
    const confirmed = window.confirm(`${person.full_name} kaydını silmek istiyor musunuz? Aktif görevlendirmesi varsa önce görevlendirmeyi pasife alın.`);
    if (!confirmed) return;

    try {
      await deleteOsgbPersonnel(person.id);
      toast.success("Personel silindi.");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Personel silinemedi.");
    }
  };

  const downloadTemplate = () => {
    const rows = [
      {
        "Ad Soyad": "Ali Taşkın",
        "Rol": "İş Güvenliği Uzmanı",
        "Belge No": "C-123456",
        "Telefon": "05xx xxx xx xx",
        "E-posta": "ali@example.com",
        "Belge Bitiş Tarihi": "2027-12-31",
        "Aylık Kapasite (dk)": 781,
        "Uzmanlık Alanları": "İnşaat, üretim",
        "Not": "Tam zamanlı",
      },
      {
        "Ad Soyad": "Ayşe Demir",
        "Rol": "İşyeri Hekimi",
        "Belge No": "H-98765",
        "Telefon": "",
        "E-posta": "",
        "Belge Bitiş Tarihi": "",
        "Aylık Kapasite (dk)": 600,
        "Uzmanlık Alanları": "",
        "Not": "",
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "OSGB Personel Havuzu");
    XLSX.writeFile(workbook, "OSGB_Personel_Havuzu_Sablonu.xlsx");
  };

  const handleBulkFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const preview = rows
        .map((row, index) => ({
          rowNo: index + 2,
          fullName: toInput(getCell(row, ["Ad Soyad", "Adı Soyadı", "Full Name", "Personel"])),
          role: parseRole(getCell(row, ["Rol", "Görev", "Unvan"])),
          certificateNo: toInput(getCell(row, ["Belge No", "Sertifika No", "Certificate No"])),
          phone: toInput(getCell(row, ["Telefon", "Phone"])),
          email: toInput(getCell(row, ["E-posta", "Email", "Mail"])),
          certificateExpiryDate: toInput(getCell(row, ["Belge Bitiş Tarihi", "Sertifika Bitiş", "Expiry"])),
          monthlyCapacityMinutes: toInput(getCell(row, ["Aylık Kapasite (dk)", "Kapasite", "Kapasite Dk"])) || "781",
          expertiseAreas: toInput(getCell(row, ["Uzmanlık Alanları", "Alanlar", "Branş"])),
          notes: toInput(getCell(row, ["Not", "Notlar", "Açıklama"])),
          isActive: true,
          assignmentCompanyId: "none",
          assignmentMinutes: "",
          assignmentStatus: "active" as const,
          assignmentStartDate: new Date().toISOString().slice(0, 10),
          assignmentEndDate: "",
          assignmentNotes: "",
        }))
        .filter((row) => row.fullName);

      setBulkPreview(preview);
      setBulkOpen(true);
      if (!preview.length) toast.error("Excel içinde aktarılabilecek personel bulunamadı.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Excel dosyası okunamadı.");
    }
  };

  const handleBulkSave = async () => {
    if (!userId || !bulkPreview.length) return;
    setBulkSaving(true);
    try {
      for (const row of bulkPreview) {
        await upsertOsgbPersonnel(userId, toPersonnelInput(row));
      }
      toast.success(`${bulkPreview.length} personel havuza aktarıldı.`);
      setBulkOpen(false);
      setBulkPreview([]);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Toplu personel aktarımı tamamlanamadı.");
    } finally {
      setBulkSaving(false);
    }
  };

  const goAssignments = (personId?: string) => {
    const suffix = personId ? `&personnelId=${personId}` : "";
    navigate(`/osgb?panel=assignments${suffix}`);
  };

  if (!organizationId) {
    return (
      <div className="w-full min-w-0 py-6">
        <Alert>
          <AlertTitle>Organizasyon gerekli</AlertTitle>
          <AlertDescription>Personel havuzu OSGB organizasyonu bazlı çalışır.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-500/10 text-cyan-300">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Personel Havuzu</h1>
            <p className="text-sm text-slate-300">
              OSGB personelini, kapasitesini ve görevlendirme akışını tek ekrandan yönetin.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="border-amber-400/45 bg-amber-500/15 text-amber-100 shadow-lg shadow-amber-950/20 hover:border-amber-300 hover:bg-amber-500/25 hover:text-white" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Şablon
          </Button>
          <Button variant="outline" className="border-violet-400/45 bg-violet-500/15 text-violet-100 shadow-lg shadow-violet-950/20 hover:border-violet-300 hover:bg-violet-500/25 hover:text-white" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Toplu Yükle
          </Button>
          <Button className="bg-gradient-to-r from-cyan-400 to-sky-500 text-slate-950 shadow-lg shadow-cyan-950/30 hover:from-cyan-300 hover:to-sky-400" onClick={openCreateForm}>
            <Plus className="mr-2 h-4 w-4" />
            Personel Ekle
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBulkFile} />
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Personel havuzu yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="İGU" value={summary.igu} icon={UserCog} tone="cyan" subtitle="Aktif iş güvenliği uzmanı" />
        <MetricCard title="İşyeri Hekimi" value={summary.hekim} icon={BriefcaseBusiness} tone="emerald" subtitle="Aktif hekim kaydı" />
        <MetricCard title="DSP" value={summary.dsp} icon={UserPlus} tone="violet" subtitle="Diğer sağlık personeli" />
        <MetricCard title="Aşırı yük" value={summary.overloaded} icon={AlertTriangle} tone="rose" subtitle={`${summary.assigned}/${summary.totalCapacity} dk kullanılıyor`} />
      </div>

      <Card className="border-slate-800 bg-slate-950/70 text-slate-100">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl text-white">Personel Yönetimi</CardTitle>
              <CardDescription className="text-slate-400">
                Manuel ekleme, toplu aktarım, kapasite takibi ve görevlendirme geçişleri burada.
              </CardDescription>
            </div>
            <Button variant="outline" className="border-fuchsia-400/40 bg-gradient-to-r from-blue-600/25 to-fuchsia-600/20 text-blue-50 shadow-lg shadow-blue-950/25 hover:border-fuchsia-300 hover:from-blue-500/35 hover:to-fuchsia-500/30 hover:text-white" onClick={() => goAssignments()}>
              <Activity className="mr-2 h-4 w-4" />
              Görevlendirme Paneli
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Personel, belge no, e-posta veya telefon ara..."
                className="border-slate-700 bg-slate-900 pl-10 text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as typeof roleFilter)}>
              <SelectTrigger className="border-slate-700 bg-slate-900 text-slate-100">
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm roller</SelectItem>
                <SelectItem value="igu">İGU</SelectItem>
                <SelectItem value="hekim">İşyeri Hekimi</SelectItem>
                <SelectItem value="dsp">DSP</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="border-slate-700 bg-slate-900 text-slate-100">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm durumlar</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="passive">Pasif</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-hidden rounded-2xl border border-slate-800">
            <Table>
              <TableHeader className="bg-slate-900/90">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-300">Personel</TableHead>
                  <TableHead className="text-slate-300">Rol</TableHead>
                  <TableHead className="text-slate-300">Kapasite</TableHead>
                  <TableHead className="text-slate-300">İletişim</TableHead>
                  <TableHead className="text-slate-300">Durum</TableHead>
                  <TableHead className="text-right text-slate-300">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index} className="border-slate-800">
                      <TableCell colSpan={6}>
                        <div className="h-12 animate-pulse rounded-xl bg-slate-800/70" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredPersonnel.length ? (
                  filteredPersonnel.map((person) => {
                    const load = capacityByPersonnelId.get(person.id);
                    return (
                      <TableRow key={person.id} className="border-slate-800 hover:bg-slate-900/60">
                        <TableCell>
                          <div className="font-semibold text-white">{person.full_name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {person.certificate_no || "Belge no yok"}
                            {person.certificate_expiry_date ? ` · Bitiş: ${person.certificate_expiry_date}` : ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("border-0", person.role === "igu" && "bg-cyan-500/15 text-cyan-200", person.role === "hekim" && "bg-emerald-500/15 text-emerald-200", person.role === "dsp" && "bg-violet-500/15 text-violet-200")}>
                            {roleShortLabels[person.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-slate-200">
                            {load ? `${load.assignedMinutes}/${load.monthlyCapacityMinutes} dk` : `0/${person.monthly_capacity_minutes} dk`}
                          </div>
                          <div className="mt-2 h-2 w-32 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={cn("h-full rounded-full", load?.overloaded ? "bg-rose-500" : "bg-cyan-400")}
                              style={{ width: `${Math.min(100, load?.utilizationRatio || 0)}%` }}
                            />
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {load ? `${load.activeCompanyCount} firma · %${load.utilizationRatio}` : "Görevlendirme yok"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-slate-300">{person.phone || "-"}</div>
                          <div className="text-xs text-slate-500">{person.email || "-"}</div>
                        </TableCell>
                        <TableCell>
                          {person.is_active !== false ? (
                            <Badge className="bg-emerald-500/15 text-emerald-200">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Aktif
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-slate-700 text-slate-400">Pasif</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="border-indigo-400/45 bg-indigo-500/15 text-indigo-100 hover:border-indigo-300 hover:bg-indigo-500/25 hover:text-white" onClick={() => goAssignments(person.id)}>
                              Görevlendir
                            </Button>
                            <Button size="icon" variant="outline" className="border-cyan-400/35 bg-cyan-500/10 text-cyan-100 hover:border-cyan-300 hover:bg-cyan-500/20 hover:text-white" onClick={() => openEditForm(person)}>
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="outline" className="border-rose-400/40 bg-rose-500/15 text-rose-100 hover:border-rose-300 hover:bg-rose-500/25 hover:text-white" onClick={() => handleDelete(person)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow className="border-slate-800">
                    <TableCell colSpan={6}>
                      <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
                        <Users className="h-10 w-10 text-slate-600" />
                        <div>
                          <div className="font-semibold text-white">Personel bulunamadı</div>
                          <p className="mt-1 text-sm text-slate-400">Filtreleri temizleyin veya havuza yeni personel ekleyin.</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PersonnelFormDialog
        open={formOpen}
        form={form}
        companies={companies}
        saving={saving}
        editing={Boolean(editingPerson)}
        onOpenChange={setFormOpen}
        onChange={setForm}
        onSave={handleSave}
      />

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="z-[80] max-w-4xl border-slate-800 bg-slate-950 text-slate-100" overlayClassName="z-[79]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <FileSpreadsheet className="h-5 w-5 text-emerald-300" />
              Toplu Personel Yükle
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Excel dosyasındaki personeller OSGB personel havuzuna eklenecek. Firma görevlendirmeleri sonraki adımda yapılır.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[420px] overflow-auto rounded-2xl border border-slate-800">
            <Table>
              <TableHeader className="bg-slate-900">
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-300">Satır</TableHead>
                  <TableHead className="text-slate-300">Ad Soyad</TableHead>
                  <TableHead className="text-slate-300">Rol</TableHead>
                  <TableHead className="text-slate-300">Kapasite</TableHead>
                  <TableHead className="text-slate-300">İletişim</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulkPreview.map((row) => (
                  <TableRow key={`${row.rowNo}-${row.fullName}`} className="border-slate-800">
                    <TableCell>{row.rowNo}</TableCell>
                    <TableCell className="font-medium text-white">{row.fullName}</TableCell>
                    <TableCell>{roleLabels[row.role]}</TableCell>
                    <TableCell>{row.monthlyCapacityMinutes} dk</TableCell>
                    <TableCell>{row.phone || row.email || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-700 bg-slate-900 text-slate-100" onClick={() => setBulkOpen(false)}>
              Vazgeç
            </Button>
            <Button className="bg-emerald-500 text-slate-950 hover:bg-emerald-400" onClick={handleBulkSave} disabled={bulkSaving || !bulkPreview.length}>
              {bulkSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {bulkPreview.length} Personeli Aktar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: typeof Users;
  tone: "cyan" | "emerald" | "violet" | "rose";
}) {
  const toneClass = {
    cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
    emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    violet: "border-violet-500/25 bg-violet-500/10 text-violet-300",
    rose: "border-rose-500/25 bg-rose-500/10 text-rose-300",
  }[tone];

  return (
    <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardDescription className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</CardDescription>
          <CardTitle className="mt-3 text-3xl text-white">{value}</CardTitle>
          <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
    </Card>
  );
}

function PersonnelFormDialog({
  open,
  form,
  companies,
  saving,
  editing,
  onOpenChange,
  onChange,
  onSave,
}: {
  open: boolean;
  form: PersonnelFormState;
  companies: OsgbWorkspaceCompanyOption[];
  saving: boolean;
  editing: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (form: PersonnelFormState) => void;
  onSave: () => void;
}) {
  const patchForm = (patch: Partial<PersonnelFormState>) => onChange({ ...form, ...patch });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-2xl shadow-black/60">
        <button
          type="button"
          className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          onClick={() => onOpenChange(false)}
          aria-label="Kapat"
        >
          ×
        </button>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold leading-none tracking-tight text-white">{editing ? "Personel Kaydını Düzenle" : "Personel Havuza Ekle"}</h2>
          <p className="text-sm text-slate-400">
            Personeli OSGB havuzuna ekleyin; isterseniz aynı anda firma görevlendirmesini de oluşturun.
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Ad Soyad *</Label>
            <Input value={form.fullName} onChange={(event) => patchForm({ fullName: event.target.value })} className="border-slate-700 bg-slate-900 text-slate-100" />
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={form.role} onValueChange={(value) => patchForm({ role: value as OsgbRole })}>
              <SelectTrigger className="border-slate-700 bg-slate-900 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="igu">İş Güvenliği Uzmanı</SelectItem>
                <SelectItem value="hekim">İşyeri Hekimi</SelectItem>
                <SelectItem value="dsp">Diğer Sağlık Personeli</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Aylık Kapasite (dk)</Label>
            <Input type="number" min="0" value={form.monthlyCapacityMinutes} onChange={(event) => patchForm({ monthlyCapacityMinutes: event.target.value })} className="border-slate-700 bg-slate-900 text-slate-100" />
          </div>
          <div className="space-y-2">
            <Label>Belge No</Label>
            <Input value={form.certificateNo} onChange={(event) => patchForm({ certificateNo: event.target.value })} className="border-slate-700 bg-slate-900 text-slate-100" />
          </div>
          <div className="space-y-2">
            <Label>Belge Bitiş Tarihi</Label>
            <Input type="date" value={form.certificateExpiryDate} onChange={(event) => patchForm({ certificateExpiryDate: event.target.value })} className="border-slate-700 bg-slate-900 text-slate-100" />
          </div>
          <div className="space-y-2">
            <Label>Telefon</Label>
            <Input value={form.phone} onChange={(event) => patchForm({ phone: event.target.value })} className="border-slate-700 bg-slate-900 text-slate-100" />
          </div>
          <div className="space-y-2">
            <Label>E-posta</Label>
            <Input type="email" value={form.email} onChange={(event) => patchForm({ email: event.target.value })} className="border-slate-700 bg-slate-900 text-slate-100" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Uzmanlık Alanları</Label>
            <Input value={form.expertiseAreas} onChange={(event) => patchForm({ expertiseAreas: event.target.value })} placeholder="İnşaat, üretim, maden..." className="border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Not</Label>
            <Textarea value={form.notes} onChange={(event) => patchForm({ notes: event.target.value })} className="min-h-24 border-slate-700 bg-slate-900 text-slate-100" />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:col-span-2">
            <div>
              <div className="font-medium text-white">Aktif personel</div>
              <p className="text-sm text-slate-400">Pasife alınan personel yeni görevlendirme listelerinde öne çıkarılmaz.</p>
            </div>
            <Switch checked={form.isActive} onCheckedChange={(value) => patchForm({ isActive: value })} />
          </div>

          <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4 md:col-span-2">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">Firma Bazlı Görevlendirme</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Firma seçerseniz personel kaydıyla birlikte atama kaydı da oluşturulur.
                </p>
              </div>
              <Badge className="bg-cyan-500/15 text-cyan-200">Opsiyonel</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Firma</Label>
                <Select value={form.assignmentCompanyId} onValueChange={(value) => patchForm({ assignmentCompanyId: value })}>
                  <SelectTrigger className="border-slate-700 bg-slate-900 text-slate-100">
                    <SelectValue placeholder="Firma seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sadece havuza ekle</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Atanacak Süre (dk/ay)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.assignmentMinutes}
                  onChange={(event) => patchForm({ assignmentMinutes: event.target.value })}
                  placeholder="Örn: 120"
                  disabled={form.assignmentCompanyId === "none"}
                  className="border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <Label>Görevlendirme Durumu</Label>
                <Select
                  value={form.assignmentStatus}
                  onValueChange={(value) => patchForm({ assignmentStatus: value as OsgbWorkspaceAssignmentRecord["status"] })}
                  disabled={form.assignmentCompanyId === "none"}
                >
                  <SelectTrigger className="border-slate-700 bg-slate-900 text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="passive">Pasif</SelectItem>
                    <SelectItem value="completed">Tamamlandı</SelectItem>
                    <SelectItem value="cancelled">İptal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Başlangıç Tarihi</Label>
                <Input
                  type="date"
                  value={form.assignmentStartDate}
                  onChange={(event) => patchForm({ assignmentStartDate: event.target.value })}
                  disabled={form.assignmentCompanyId === "none"}
                  className="border-slate-700 bg-slate-900 text-slate-100 disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <Label>Bitiş Tarihi</Label>
                <Input
                  type="date"
                  value={form.assignmentEndDate}
                  onChange={(event) => patchForm({ assignmentEndDate: event.target.value })}
                  disabled={form.assignmentCompanyId === "none"}
                  className="border-slate-700 bg-slate-900 text-slate-100 disabled:opacity-50"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Görevlendirme Notu</Label>
                <Textarea
                  value={form.assignmentNotes}
                  onChange={(event) => patchForm({ assignmentNotes: event.target.value })}
                  disabled={form.assignmentCompanyId === "none"}
                  className="min-h-20 border-slate-700 bg-slate-900 text-slate-100 disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="border-slate-700 bg-slate-900 text-slate-100" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button className="bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {editing ? "Güncelle" : "Kaydet"}
          </Button>
        </div>
      </div>
    </div>
  );
}
