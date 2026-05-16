import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Building2, Download, Link2, Plus, RefreshCcw, Search, ShieldAlert, Upload, Users, Wallet, CheckCircle2, ChevronRight, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { HighRiskSectionBoundary } from "@/components/HighRiskSectionBoundary";
import { useAuth } from "@/contexts/AuthContext";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { useOsgbAccess } from "@/hooks/useOsgbAccess";
import { useRouteOverlayCleanup } from "@/hooks/useRouteOverlayCleanup";
import { attachDeterministicClientIds } from "@/lib/clientIdentity";
import { OsgbCompany360Panel } from "@/components/osgb/OsgbCompany360Panel";
import { OsgbOnboardingChecklist } from "@/components/osgb/OsgbOnboardingChecklist";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { downloadCsv } from "@/lib/csvExport";
import {
  getOsgbCompany360Snapshot,
  importOsgbCompaniesFromKatip,
  importOsgbCompaniesFromRows,
  listOsgbCompanyTrackingWorkspace,
  type OsgbCompanyManagementInput,
  type OsgbCompanyTrackingWorkspaceData,
  type OsgbManagedCompanyRecord,
  upsertOsgbManagedCompany,
} from "@/lib/osgbPlatform";
import { cn } from "@/lib/utils";

type ManualCompanyFormState = {
  companyName: string;
  branchName: string; // ✅ Takma Ad (max 15)
  sgkNo: string;
  taxNumber: string;
  employeeCount: string;
  hazardClass: string;
  address: string;
  phone: string;
  email: string;
  contactName: string;
  naceCode: string; // ✅ NACE Kodu (İSGKatip senk.)
  contractStart: string;
  contractEnd: string;
  monthlyFee: string;
  assignmentMode: string;
  visitFrequency: string;
  notes: string;
};

type ImportPreviewRow = OsgbCompanyManagementInput & {
  client_id: string;
};

const emptyManualForm: ManualCompanyFormState = {
  companyName: "",
  branchName: "",
  sgkNo: "",
  taxNumber: "",
  employeeCount: "0",
  hazardClass: "Az Tehlikeli",
  address: "",
  phone: "",
  email: "",
  contactName: "",
  naceCode: "",
  contractStart: "",
  contractEnd: "",
  monthlyFee: "",
  assignmentMode: "automatic",
  visitFrequency: "monthly_once",
  notes: "",
};


const hazardOptions = ["Tümü", "Az Tehlikeli", "Tehlikeli", "Çok Tehlikeli"] as const;
const assignmentFilterOptions = ["ALL", "approved", "pending_personnel", "pending_workplace", "missing_contract", "planned"] as const;

const assignmentStatusLabels: Record<OsgbManagedCompanyRecord["assignmentApprovalStatus"], string> = {
  approved: "Tam Onaylı",
  pending_personnel: "Personel Onayı",
  pending_workplace: "İşyeri Onayı",
  missing_contract: "Sözleşme Yok",
  planned: "Planlanan",
  zero_employees: "Çalışan Sayısı 0", // ✅ EKLE
};

const assignmentStatusTone: Record<OsgbManagedCompanyRecord["assignmentApprovalStatus"], string> = {
  approved: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  pending_personnel: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  pending_workplace: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-200",
  missing_contract: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200",
  planned: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-200",
  zero_employees: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-200", // ✅ EKLE
};

const hazardClassTone: Record<string, string> = {
  "Az Tehlikeli": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Tehlikeli": "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  "Çok Tehlikeli": "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

const visitFrequencyLabels: Record<string, string> = {
  monthly_once: "Ayda 1 Defa",
  monthly_twice: "Ayda 2 Defa",
  monthly_three: "Ayda 3 Defa",
  monthly_four: "Ayda 4 Defa",
  weekly_once: "Her Hafta 1 Defa",
  weekly_twice: "Her Hafta 2 Defa",
  weekly_three: "Her Hafta 3 Defa",
  every_two_months: "2 Ayda 1",
  every_three_months: "3 Ayda 1",
  every_four_months: "4 Ayda 1",
  weekly: "Her Hafta 1 Defa",
  custom: "Özel Plan",
};

const visitFrequencyItems = [
  { value: "monthly_once", label: "Ayda 1 Defa" },
  { value: "monthly_twice", label: "Ayda 2 Defa" },
  { value: "monthly_three", label: "Ayda 3 Defa" },
  { value: "monthly_four", label: "Ayda 4 Defa" },
  { value: "weekly_once", label: "Her Hafta 1 Defa" },
  { value: "weekly_twice", label: "Her Hafta 2 Defa" },
  { value: "weekly_three", label: "Her Hafta 3 Defa" },
  { value: "every_two_months", label: "2 Ayda 1" },
  { value: "every_three_months", label: "3 Ayda 1" },
  { value: "every_four_months", label: "4 Ayda 1" },
] as const;

const assignmentStatusItems = [
  { value: "automatic", label: "Otomatik (Atamalara göre)", dotClass: "bg-blue-500" },
  { value: "approved", label: "Tam Onaylı", dotClass: "bg-emerald-500" },
  { value: "pending_personnel", label: "Personel Onayı Bekleniyor", dotClass: "bg-amber-500" },
  { value: "pending_workplace", label: "İşyeri Onayı Bekleniyor", dotClass: "bg-orange-500" },
  { value: "missing_contract", label: "İSG Profesyoneli Sözleşmesi Yok", dotClass: "bg-rose-500" },
  { value: "zero_employees", label: "Çalışan Sayısı 0", dotClass: "bg-violet-500" },
  { value: "planned", label: "Planlanan Atamalar", dotClass: "bg-sky-500" },
] as const;

function AssignmentStatusSelect({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const selectedItem = assignmentStatusItems.find((item) => item.value === value) ?? assignmentStatusItems[0];

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-10 rounded-md border border-slate-500/70 bg-[#33465f] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#3b506d] focus:ring-2 focus:ring-blue-500/70 focus:ring-offset-0 dark:border-slate-500/70 dark:bg-[#33465f] dark:text-white">
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selectedItem.value !== "automatic" && (
            <span className={cn("h-3 w-3 shrink-0 rounded-full shadow-sm ring-1 ring-white/25", selectedItem.dotClass)} />
          )}
          <span className="truncate">{selectedItem.label}</span>
        </span>
      </SelectTrigger>

      <SelectContent
        align="start"
        sideOffset={2}
        className="overflow-hidden rounded-none border border-slate-500/80 bg-[#33465f] p-0 text-white shadow-2xl dark:border-slate-500/80 dark:bg-[#33465f] dark:text-white"
      >
        {assignmentStatusItems.map((item) => (
          <SelectItem
            key={item.value}
            value={item.value}
            className="h-10 rounded-none py-0 pl-4 pr-3 text-sm font-semibold text-white focus:bg-[#246dd3] focus:text-white data-[state=checked]:bg-[#246dd3] data-[state=checked]:text-white [&>span:first-child]:hidden"
          >
            <span className="flex items-center gap-2">
              {item.value !== "automatic" && (
                <span className={cn("h-3 w-3 shrink-0 rounded-full shadow-sm ring-1 ring-white/25", item.dotClass)} />
              )}
              <span>{item.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function VisitFrequencySelect({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const selectedLabel =
    visitFrequencyItems.find((item) => item.value === value)?.label || visitFrequencyLabels[value] || "Ayda 1 Defa";

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-10 rounded-md border border-slate-500/70 bg-[#33465f] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#3b506d] focus:ring-2 focus:ring-blue-500/70 focus:ring-offset-0 dark:border-slate-500/70 dark:bg-[#33465f] dark:text-white">
        <span className="truncate">{selectedLabel}</span>
      </SelectTrigger>

      <SelectContent
        align="start"
        sideOffset={2}
        className="overflow-hidden rounded-none border border-slate-500/80 bg-[#33465f] p-0 text-white shadow-2xl dark:border-slate-500/80 dark:bg-[#33465f] dark:text-white"
      >
        {visitFrequencyItems.map((item) => (
          <SelectItem
            key={item.value}
            value={item.value}
            className="h-10 rounded-none py-0 pl-4 pr-3 text-sm font-semibold text-white focus:bg-[#246dd3] focus:text-white data-[state=checked]:bg-[#246dd3] data-[state=checked]:text-white [&>span:first-child]:hidden"
          >
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(value || 0);

const normalizeHeader = (value: string) =>
  value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]/g, "");

const loadXlsx = () => import("xlsx");

const parseImportRows = async (file: File): Promise<ImportPreviewRow[]> => {
  const XLSX = await loadXlsx();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
  const parsedRows = rows.map((row) => {
    const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizeHeader(key), value] as const);
    const getValue = (...keys: string[]) => normalizedEntries.find(([header]) => keys.includes(header))?.[1];
    const companyName = String(getValue("firmaunvani", "firmaadi", "companyname", "unvan") || "").trim();
    if (!companyName) return null;
    const visitValue = String(getValue("ziyaretsikligi", "visitfrequency") || "").trim().toLocaleLowerCase("tr-TR");
    const assignmentValue = String(getValue("atamadurumu", "assignmentmode") || "").trim().toLocaleLowerCase("tr-TR");
    return {
      companyName,
      sgkNo: String(getValue("sgksicilno", "sgkno", "sgk") || "").trim() || null,
      taxNumber: String(getValue("vergino", "taxnumber", "taxno") || "").trim() || null,
      employeeCount: Number(getValue("calisansayisi", "employeecount", "calisan") || 0),
      hazardClass: String(getValue("tehlikesinifi", "hazardclass", "sinif") || "Az Tehlikeli").trim() || "Az Tehlikeli",
      address: String(getValue("adresbilgisi", "address", "adres") || "").trim() || null,
      phone: String(getValue("telefon", "phone") || "").trim() || null,
      email: String(getValue("eposta", "email", "mail") || "").trim() || null,
      contactName: String(getValue("yetkilikisi", "contactname", "yetkili") || "").trim() || null,
      contractStart: String(getValue("sozlesmebaslangic", "contractstart") || "").trim() || null,
      contractEnd: String(getValue("sozlesmebitis", "contractend") || "").trim() || null,
      monthlyFee: Number(getValue("aylikhizmetbedeli", "monthlyfee", "ucret") || 0),
      assignmentMode: assignmentValue.includes("manuel") ? "manual" : "automatic",
      visitFrequency: visitValue.includes("4 ayda") ? "every_four_months" : visitValue.includes("3 ayda") ? "every_three_months" : visitValue.includes("2 ayda") ? "every_two_months" : visitValue.includes("hafta") && visitValue.includes("3") ? "weekly_three" : visitValue.includes("hafta") && visitValue.includes("2") ? "weekly_twice" : visitValue.includes("hafta") ? "weekly_once" : visitValue.includes("4") ? "monthly_four" : visitValue.includes("3") ? "monthly_three" : visitValue.includes("2") ? "monthly_twice" : visitValue.includes("ozel") || visitValue.includes("özel") ? "custom" : "monthly_once",
      notes: String(getValue("notlar", "notes") || "").trim() || null,
      managementSource: "import",
    } satisfies OsgbCompanyManagementInput;
  }).filter(Boolean) as OsgbCompanyManagementInput[];

  return attachDeterministicClientIds(parsedRows, "osgb-company-import", (row) => [
    row.taxNumber,
    row.sgkNo,
    row.companyName,
    row.email,
  ]);
};

export default function OSGBCompanyTracking() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { canManageOperations, roleLabel } = useOsgbAccess();
  const organizationId = profile?.organization_id || null;
  const [workspace, setWorkspace] = useState<OsgbCompanyTrackingWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hazardFilter, setHazardFilter] = useState<(typeof hazardOptions)[number]>("Tümü");
  const [assignmentFilter, setAssignmentFilter] = useState<(typeof assignmentFilterOptions)[number]>("ALL");
  const [sortBy, setSortBy] = useState<"company" | "employees" | "fee">("company");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [katipOpen, setKatipOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [manualForm, setManualForm] = useState<ManualCompanyFormState>(emptyManualForm);
  const [selectedKatipIds, setSelectedKatipIds] = useState<string[]>([]);
  const [importPreviewRows, setImportPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [company360, setCompany360] = useState<Awaited<ReturnType<typeof getOsgbCompany360Snapshot>> | null>(null);
  usePageDataTiming(loading);

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await listOsgbCompanyTrackingWorkspace(organizationId);
      setWorkspace(data);
      setSelectedCompanyId((current) => current || data.companies[0]?.id || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Firma havuzu yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const companies = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr-TR");
    return (workspace?.companies || []).filter((row) => {
      const matchesSearch = term.length === 0 ? true : [row.companyName, row.sgkNo, row.taxNumber, row.contactName].filter(Boolean).some((value) => String(value).toLocaleLowerCase("tr-TR").includes(term));
      return matchesSearch && (hazardFilter === "Tümü" || row.hazardClass === hazardFilter) && (assignmentFilter === "ALL" || row.assignmentApprovalStatus === assignmentFilter);
    }).sort((left, right) => sortBy === "employees" ? right.employeeCount - left.employeeCount : sortBy === "fee" ? right.monthlyFee - left.monthlyFee : left.companyName.localeCompare(right.companyName, "tr"));
  }, [assignmentFilter, hazardFilter, search, sortBy, workspace?.companies]);

  const selectedCompany = useMemo(() => companies.find((item) => item.id === selectedCompanyId) || companies[0] || null, [companies, selectedCompanyId]);

  useEffect(() => {
    if (!organizationId || !selectedCompany?.id) {
      setCompany360(null);
      return;
    }
    void getOsgbCompany360Snapshot(organizationId, selectedCompany.id).then(setCompany360).catch(() => setCompany360(null));
  }, [organizationId, selectedCompany?.id]);

  const closeTransientUi = useCallback(() => {
    setManualOpen(false);
    setKatipOpen(false);
    setBulkOpen(false);
  }, []);

  useRouteOverlayCleanup(closeTransientUi);

  const onboardingSteps = [
    { title: "İSG-KATİP verisini hazırla", description: "Extension veya ekip senkronundan gelen firmaları merkezde görün.", href: "/osgb/isgkatip", done: (workspace?.importCandidates.length || 0) > 0 || (workspace?.summary.totalCompanies || 0) > 0 },
    { title: "Firmaları havuza al", description: "Yalnızca yöneteceğiniz firmaları managed havuza taşıyın.", href: "/osgb/company-tracking", done: (workspace?.summary.totalCompanies || 0) > 0 },
    { title: "Sözleşme ve ücret tanımla", description: "Sözleşme tarihleri ve aylık hizmet bedeli boş kalmasın.", href: "/osgb/company-tracking", done: (workspace?.companies || []).some((item) => item.monthlyFee > 0) },
    { title: "Atama başlat", description: "Eksik hizmet süresi olan firmalara ekip atayın.", href: "/osgb/assignments", done: (workspace?.companies || []).some((item) => item.totalAssignedMinutes > 0) },
  ];

  const handleManualSave = async () => {
  if (!organizationId || !user?.id || !manualForm.companyName.trim()) {
    toast.error("Firma unvanı zorunlu.");
    return;
  }

  if (manualForm.branchName && manualForm.branchName.trim().length > 15) {
    toast.error("Takma ad en fazla 15 karakter olmalı.");
    return;
  }

  setSaving(true);
  try {
    await upsertOsgbManagedCompany(user.id, organizationId, {
      companyName: manualForm.companyName.trim(),
      // ✅ yeni alanlar
      branchName: manualForm.branchName.trim() || null,
      naceCode: manualForm.naceCode.trim() || null,

      sgkNo: manualForm.sgkNo.trim() || null,
      taxNumber: manualForm.taxNumber.trim() || null,
      employeeCount: Number(manualForm.employeeCount || 0),
      hazardClass: manualForm.hazardClass,
      address: manualForm.address.trim() || null,
      phone: manualForm.phone.trim() || null,
      email: manualForm.email.trim() || null,
      contactName: manualForm.contactName.trim() || null,
      contractStart: manualForm.contractStart || null,
      contractEnd: manualForm.contractEnd || null,
      monthlyFee: Number(manualForm.monthlyFee || 0),
      assignmentMode: manualForm.assignmentMode,
      visitFrequency: manualForm.visitFrequency,
      notes: manualForm.notes.trim() || null,
      managementSource: "manual",
    } as any);
    setManualOpen(false);
    setManualForm(emptyManualForm);
    toast.success("Firma OSGB havuzuna eklendi.");
    await loadData();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Firma eklenemedi.");
  } finally {
    setSaving(false);
  }
};

  const handleKatipImport = async () => {
    if (!organizationId || !user?.id || selectedKatipIds.length === 0) {
      toast.error("En az bir firma seçin.");
      return;
    }
    setSaving(true);
    try {
      const imported = await importOsgbCompaniesFromKatip(user.id, organizationId, selectedKatipIds);
      toast.success(`${imported} firma havuza alındı.`);
      setSelectedKatipIds([]);
      setKatipOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İSG-KATİP aktarımı başarısız oldu.");
    } finally {
      setSaving(false);
    }
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    try {
      const rows = await parseImportRows(file);
      setImportPreviewRows(rows);
      setUploadingFileName(file.name);
      toast.success(`${rows.length} satır hazır.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya okunamadı.");
    }
  };

  const handleBulkImport = async () => {
    if (!organizationId || !user?.id || importPreviewRows.length === 0) {
      toast.error("İçe aktarılacak firma yok.");
      return;
    }
    setSaving(true);
    try {
      const imported = await importOsgbCompaniesFromRows(user.id, organizationId, importPreviewRows);
      toast.success(`${imported} firma içe aktarıldı.`);
      setBulkOpen(false);
      setImportPreviewRows([]);
      setUploadingFileName("");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Toplu firma aktarımı başarısız oldu.");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () =>
    downloadCsv(
      "osgb-firma-havuzu.csv",
      ["Firma", "SGK", "Vergi No", "Çalışan", "Tehlike", "Atama", "Ziyaret", "Aylık Bedel"],
      companies.map((company) => [
        company.companyName,
        company.sgkNo || "",
        company.taxNumber || "",
        company.employeeCount,
        company.hazardClass,
        assignmentStatusLabels[company.assignmentApprovalStatus],
        visitFrequencyLabels[company.visitFrequency] || company.visitFrequency,
        company.monthlyFee,
      ]),
    );

  if (!organizationId) {
    return (
      <div className="container mx-auto py-6">
        <Alert>
          <AlertTitle>Organizasyon bağlantısı gerekli</AlertTitle>
          <AlertDescription>OSGB Firma Takibi organizasyon bazlı çalışır.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-8 py-8 px-4 xl:px-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between border-b border-border/80 pb-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20">
            <Building2 className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">OSGB Firma Takibi</h1>
              <Badge variant="outline" className="font-semibold bg-secondary/40 px-2.5 py-0.5 text-xs">{roleLabel}</Badge>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Merkezi müşteri portföyü ve operasyon takip paneli. Sözleşmeleri, atama süreçlerini ve saha ziyaret sıklıklarını gerçek zamanlı izleyin.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center lg:justify-end">
          <Button variant="outline" size="sm" onClick={() => navigate("/osgb/how-to")} className="h-9 rounded-xl font-medium">
            <BookOpen className="mr-2 h-4 w-4 text-muted-foreground" />
            Kılavuz
          </Button>
          <Button variant="outline" size="sm" onClick={() => void loadData()} className="h-9 rounded-xl font-medium">
            <RefreshCcw className="mr-2 h-4 w-4 text-muted-foreground" />
            Yenile
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="h-9 rounded-xl font-medium">
            <Download className="mr-2 h-4 w-4 text-muted-foreground" />
            Dışa Aktar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setKatipOpen(true)} disabled={!canManageOperations} className="h-9 rounded-xl font-medium border-blue-500/20 text-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-950/20">
            <Link2 className="mr-2 h-4 w-4 text-blue-500" />
            İSG-KATİP Aktar
          </Button>
          <Button variant="outline" size="sm" className="h-9 rounded-xl font-medium border-emerald-600/30 text-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20" onClick={() => setBulkOpen(true)} disabled={!canManageOperations}>
            <Upload className="mr-2 h-4 w-4" />
            Excel'den Yükle
          </Button>
          <Button size="sm" onClick={() => setManualOpen(true)} disabled={!canManageOperations} className="h-9 rounded-xl font-semibold shadow-md bg-primary hover:bg-primary/90">
            <Plus className="mr-1.5 h-4 w-4 stroke-[3]" />
            Firma Ekle
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="rounded-2xl shadow-sm">
          <AlertTitle>Hata oluştu</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* METRIC CARDS OVERVIEW */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-md rounded-2xl hover:shadow-lg transition-all border border-border/60 overflow-hidden bg-card">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Toplam Firma</span>
              <p className="text-3xl font-extrabold text-foreground tracking-tight">{workspace?.summary.totalCompanies || 0}</p>
            </div>
            <div className="p-3 bg-primary/10 text-primary rounded-2xl ring-4 ring-primary/5">
              <Building2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-md rounded-2xl hover:shadow-lg transition-all border border-border/60 overflow-hidden bg-card">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Tam Onaylı</span>
              <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">{workspace?.summary.approvedCount || 0}</p>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl ring-4 ring-emerald-500/5">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md rounded-2xl hover:shadow-lg transition-all border border-border/60 overflow-hidden bg-card">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Sözleşmesi Eksik</span>
              <p className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">{workspace?.summary.missingContractCount || 0}</p>
            </div>
            <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl ring-4 ring-rose-500/5">
              <ShieldAlert className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md rounded-2xl hover:shadow-lg transition-all border border-border/60 overflow-hidden bg-card">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Bekleyen Onaylar</span>
              <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
                {(workspace?.summary.pendingPersonnelApprovalCount || 0) + (workspace?.summary.pendingWorkplaceApprovalCount || 0)}
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl ring-4 ring-amber-500/5">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTER & FILTER TOOLBAR */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-12 bg-muted/40 p-4 rounded-2xl border border-border/70 backdrop-blur-sm shadow-sm">
        <div className="relative md:col-span-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 bg-background rounded-xl border-border/80 focus-visible:ring-primary" placeholder="Firma unvanı, SGK sicil veya vergi no ile ara..." />
        </div>
        <div className="md:col-span-2">
          <Select value={hazardFilter} onValueChange={(value) => setHazardFilter(value as (typeof hazardOptions)[number])}>
            <SelectTrigger className="h-10 bg-background rounded-xl border-border/80"><SelectValue placeholder="Tehlike Sınıfı" /></SelectTrigger>
            <SelectContent className="rounded-xl">{hazardOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-6">
          <Label className="inline-flex rounded-sm bg-[#173466] px-1.5 py-0.5 text-sm font-bold leading-none text-white">
            Atama Durumu
          </Label>
          <AssignmentStatusSelect
            value={manualForm.assignmentMode}
            onValueChange={(value) => setManualForm((prev) => ({ ...prev, assignmentMode: value }))}
          />
        </div>
        <div className="md:col-span-2">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as "company" | "employees" | "fee")}>
            <SelectTrigger className="h-10 bg-background rounded-xl border-border/80"><SelectValue placeholder="Sıralama" /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="company">Unvan Sırala (A-Z)</SelectItem>
              <SelectItem value="employees">Çalışan Sayısı (Azalan)</SelectItem>
              <SelectItem value="fee">Hizmet Bedeli (Azalan)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Button type="button" variant="destructive" className="w-full h-10 rounded-xl shadow-sm font-semibold bg-rose-600 hover:bg-rose-700 transition-colors" onClick={() => setAssignmentFilter("missing_contract")}>
            <ShieldAlert className="mr-1.5 h-4 w-4" />
            Eksikleri Listele
          </Button>
        </div>
      </div>

      {/* PORTFOLIO GRID & PREVIEW PANEL */}
      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
        <HighRiskSectionBoundary section="company-pool" componentName="OSGBCompanyTrackingPool">
          <Card className="rounded-2xl border border-border/80 overflow-hidden shadow-md bg-card">
            <CardHeader className="bg-card px-6 py-5 border-b border-border/60">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-xl font-bold text-foreground">Firma Portföy Havuzu</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground mt-0.5">Sözleşme süreleri, aylık hak ediş bedelleri ve atama durumları listesi.</CardDescription>
                </div>
                <Badge variant="secondary" className="font-semibold px-2.5 py-0.5 text-xs text-secondary-foreground">{companies.length} Kayıt</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-20 animate-pulse rounded-2xl border border-border bg-muted/30" />
                  ))}
                </div>
              ) : companies.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/60">
                        <TableHead className="pl-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground h-12">Firma / Sicil Bilgileri</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground h-12">Çalışan</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground h-12">Tehlike Sınıfı</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground h-12">Onay / Atama</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground h-12">Ziyaret Periyodu</TableHead>
                        <TableHead className="pr-6 text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground h-12">Aylık Hizmet</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companies.map((company) => {
                        const isSelected = selectedCompany?.id === company.id;
                        return (
                          <TableRow 
                            key={company.id} 
                            className={cn(
                              "group cursor-pointer transition-all border-b border-border/50 hover:bg-muted/30", 
                              isSelected && "bg-primary/10 hover:bg-primary/10 font-medium border-l-4 border-l-primary"
                            )} 
                            onClick={() => setSelectedCompanyId(company.id)}
                          >
                            <TableCell className={cn("pl-6 py-4 transition-all", isSelected && "pl-5")}>
                              <div className="space-y-1">
                                <div className="text-sm font-bold text-foreground tracking-tight group-hover:text-primary transition-colors flex items-center gap-1">
                                  {company.companyName}
                                  {isSelected && <ChevronRight className="h-3.5 w-3.5 text-primary stroke-[3]" />}
                                </div>
                                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5 font-medium">
                                  <span>SGK: {company.sgkNo || "Girilmedi"}</span>
                                  <span className="text-border/80">•</span>
                                  <span>Vergi No: {company.taxNumber || "-"}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-medium text-foreground">{company.employeeCount}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={cn("font-semibold text-xs px-2 py-0.5 rounded-md border shadow-none", hazardClassTone[company.hazardClass] || "bg-muted text-muted-foreground")}>
                                {company.hazardClass}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("font-semibold text-xs px-2.5 py-0.5 shadow-none border rounded-lg", assignmentStatusTone[company.assignmentApprovalStatus])}>
                                {assignmentStatusLabels[company.assignmentApprovalStatus]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground font-medium">
                              {visitFrequencyLabels[company.visitFrequency] || "Ayda 1 Defa"}
                            </TableCell>
                            <TableCell className="pr-6 text-right text-sm font-bold text-foreground">
                              {formatMoney(company.monthlyFee)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="px-8 py-20 text-center">
                  <div className="mx-auto h-16 w-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground mb-4">
                    <Building2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Firma Portföyü Boş</h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                    Kriterlerinize uygun bir firma bulunamadı. Üst menü butonlarını kullanarak sisteme yeni firmalar dahil edebilirsiniz.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </HighRiskSectionBoundary>

        {/* SIDEBAR DETAILED PANELS */}
        <div className="space-y-6">
          <OsgbCompany360Panel company={selectedCompany} snapshot={company360} />
          <OsgbOnboardingChecklist steps={onboardingSteps} />
        </div>
      </div>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Yeni OSGB Firması Ekle</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-12">
            {/* Firma Unvanı + Takma Ad */}
            <div className="space-y-2 md:col-span-8">
              <Label>Firma Unvanı *</Label>
              <Input
                placeholder="Örn: ABC Mühendislik Ltd. Şti."
                value={manualForm.companyName}
                onChange={(e) => setManualForm((prev) => ({ ...prev, companyName: e.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-4">
              <Label>Takma Ad <span className="text-xs text-muted-foreground">(max 15)</span></Label>
              <Input
                placeholder="Örn: Şube 1"
                maxLength={15}
                value={manualForm.branchName}
                onChange={(e) =>
                  setManualForm((prev) => ({ ...prev, branchName: e.target.value.slice(0, 15) }))
                }
              />
            </div>

            {/* SGK - Vergi - Çalışan */}
            <div className="space-y-2 md:col-span-4">
              <Label>SGK Sicil No</Label>
              <Input value={manualForm.sgkNo} onChange={(e) => setManualForm((prev) => ({ ...prev, sgkNo: e.target.value }))} />
            </div>

            <div className="space-y-2 md:col-span-4">
              <Label>Vergi No</Label>
              <Input value={manualForm.taxNumber} onChange={(e) => setManualForm((prev) => ({ ...prev, taxNumber: e.target.value }))} />
            </div>

            <div className="space-y-2 md:col-span-4">
              <Label>Çalışan Sayısı</Label>
              <Input
                type="number"
                min={0}
                value={manualForm.employeeCount}
                onChange={(e) => setManualForm((prev) => ({ ...prev, employeeCount: e.target.value }))}
              />
            </div>

            {/* Tehlike - Adres */}
            <div className="space-y-2 md:col-span-4">
              <Label>Tehlike Sınıfı</Label>
              <Select value={manualForm.hazardClass} onValueChange={(value) => setManualForm((prev) => ({ ...prev, hazardClass: value }))}>
                <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                <SelectContent>
                  {hazardOptions.filter((h) => h !== "Tümü").map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-8">
              <Label>Adres Bilgisi</Label>
              <Input
                placeholder="ISGKatip senkronizasyonunda otomatik doldurulur"
                value={manualForm.address}
                onChange={(e) => setManualForm((prev) => ({ ...prev, address: e.target.value }))}
              />
            </div>

            {/* Telefon - Eposta - Yetkili - NACE */}
            <div className="space-y-2 md:col-span-3">
              <Label>Telefon</Label>
              <Input value={manualForm.phone} onChange={(e) => setManualForm((prev) => ({ ...prev, phone: e.target.value }))} />
            </div>

            <div className="space-y-2 md:col-span-3">
              <Label>E-posta</Label>
              <Input value={manualForm.email} onChange={(e) => setManualForm((prev) => ({ ...prev, email: e.target.value }))} />
            </div>

            <div className="space-y-2 md:col-span-3">
              <Label>Yetkili Kişi</Label>
              <Input value={manualForm.contactName} onChange={(e) => setManualForm((prev) => ({ ...prev, contactName: e.target.value }))} />
            </div>

            <div className="space-y-2 md:col-span-3">
              <Label>NACE Kodu</Label>
              <Input
                placeholder="ISGKatip senkronize"
                value={manualForm.naceCode}
                readOnly
                disabled
              />
            </div>

            {/* Sözleşme - Ücret */}
            <div className="space-y-2 md:col-span-4">
              <Label>Sözleşme Başlangıç</Label>
              <Input type="date" value={manualForm.contractStart} onChange={(e) => setManualForm((prev) => ({ ...prev, contractStart: e.target.value }))} />
            </div>

            <div className="space-y-2 md:col-span-4">
              <Label>Sözleşme Bitiş</Label>
              <Input type="date" value={manualForm.contractEnd} onChange={(e) => setManualForm((prev) => ({ ...prev, contractEnd: e.target.value }))} />
            </div>

            <div className="space-y-2 md:col-span-4">
              <Label>Aylık Hizmet Bedeli (₺)</Label>
              <Input type="number" min={0} value={manualForm.monthlyFee} onChange={(e) => setManualForm((prev) => ({ ...prev, monthlyFee: e.target.value }))} />
            </div>

            {/* Atama - Ziyaret */}
            <div className="space-y-2 md:col-span-6">
              <Label>Atama Durumu</Label>
              <AssignmentStatusSelect
                value={manualForm.assignmentMode}
                onValueChange={(value) => setManualForm((prev) => ({ ...prev, assignmentMode: value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-6">
              <Label>Ziyaret Sıklığı</Label>
              <VisitFrequencySelect
                value={manualForm.visitFrequency}
                onValueChange={(value) => setManualForm((prev) => ({ ...prev, visitFrequency: value }))}
              />
            </div>

            {/* Notlar */}
            <div className="space-y-2 md:col-span-12">
              <Label>Notlar</Label>
              <Textarea value={manualForm.notes} onChange={(e) => setManualForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>İptal</Button>
            <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={handleManualSave} disabled={saving || !canManageOperations}>
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* DIALOG: ISG-KATIP SYNC IMPORT */}
      <Dialog open={katipOpen} onOpenChange={setKatipOpen}>
        <DialogContent className="max-w-3xl rounded-2xl shadow-xl border border-border/80">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">İSG-KATİP Sisteminden Firma Aktarımı</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Tarayıcı eklentisinden veya ortak veri havuzlarından gelen, ancak henüz takip listesine (Managed) eklenmemiş aday firmalar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1 py-2 border-y border-border/60 my-2">
            {(workspace?.importCandidates || []).length ? (
              workspace!.importCandidates.map((company) => {
                const isSelected = selectedKatipIds.includes(company.id);
                return (
                  <button 
                    key={company.id} 
                    type="button" 
                    onClick={() => setSelectedKatipIds((current) => isSelected ? current.filter((item) => item !== company.id) : [...current, company.id])} 
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all hover:bg-muted/60", 
                      isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/40 shadow-sm" : "border-border/80 bg-card"
                    )}
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-sm text-foreground tracking-tight">{company.companyName}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 font-medium">
                        <span>SGK Sicil: {company.sgkNo || "-"}</span>
                        <span>•</span>
                        <span>{company.employeeCount} Çalışan</span>
                        <span>•</span>
                        <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 h-4 font-semibold rounded-md", hazardClassTone[company.hazardClass])}>{company.hazardClass}</Badge>
                      </div>
                    </div>
                    <Badge variant={isSelected ? "default" : "outline"} className="text-xs font-semibold rounded-md px-2.5">
                      {isSelected ? "Seçildi" : "Seç"}
                    </Badge>
                  </button>
                );
              })
            ) : (
              <Alert className="rounded-xl bg-muted/30 border-dashed border-border/80 py-6">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <AlertTitle className="font-bold text-foreground">Aktarılacak aday firma bulunamadı</AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground mt-1">
                  İSG-KATİP senkronizasyon modülünü veya İSGVizyon Chrome uzantısını kullanarak organizasyonunuza yeni firma verileri çekebilirsiniz.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setKatipOpen(false)} className="rounded-xl">Kapat</Button>
            <Button onClick={handleKatipImport} disabled={saving || selectedKatipIds.length === 0 || !canManageOperations} className="rounded-xl bg-primary hover:bg-primary/90 font-semibold">
              {saving ? "Aktarılıyor..." : `${selectedKatipIds.length} Seçili Firmayı Portföye Al`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: BULK EXCEL CSV IMPORT */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-3xl rounded-2xl shadow-xl border border-border/80">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">Excel veya CSV Listesinden Toplu Aktarım</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Kolon başlıkları akıllı eşleştirici tarafından okunarak tüm firma portföyünüz saniyeler içinde güncellenir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 border-y border-border/60 my-2">
            <div className="grid w-full items-center gap-2">
              <Label htmlFor="bulk-file-input" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Yüklenecek Dosya Seçimi</Label>
              <div className="flex items-center justify-center border border-dashed border-border/80 rounded-xl p-4 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer relative">
                <input id="bulk-file-input" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void handleImportFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" />
                <div className="text-center space-y-1">
                  <FileSpreadsheet className="h-8 w-8 mx-auto text-emerald-600/80" />
                  <p className="text-sm font-semibold text-foreground">Dosyayı seçmek için tıklayın veya sürükleyin</p>
                  <p className="text-xs text-muted-foreground">Desteklenen formatlar: .xlsx, .xls, .csv</p>
                </div>
              </div>
            </div>

            {uploadingFileName ? (
              <div className="text-xs bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 p-3 rounded-xl border border-emerald-500/20 flex items-center justify-between font-medium">
                <span>Yüklenen Dosya: <strong className="font-bold">{uploadingFileName}</strong></span>
                <span>Okunan Toplam Satır: <strong className="font-extrabold text-sm">{importPreviewRows.length}</strong></span>
              </div>
            ) : null}

            <div className="max-h-56 overflow-auto rounded-xl border border-border/80 bg-card">
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0 z-10 border-b border-border/60">
                  <TableRow>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Firma Unvanı</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Çalışan</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Sınıf</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-right">Aylık Bedel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importPreviewRows.length ? (
                    importPreviewRows.map((row) => (
                      <TableRow key={row.client_id} className="hover:bg-muted/30 border-b border-border/50">
                        <TableCell className="text-xs font-bold text-foreground max-w-[260px] truncate">{row.companyName}</TableCell>
                        <TableCell className="text-xs font-medium text-muted-foreground">{row.employeeCount}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 rounded-md font-semibold", hazardClassTone[row.hazardClass])}>
                            {row.hazardClass}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right font-bold text-foreground">{formatMoney(row.monthlyFee || 0)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-10 font-medium">
                        Veri önizlemesi için bir Excel veya CSV dosyası yükleyin.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setBulkOpen(false)} className="rounded-xl">Vazgeç</Button>
            <Button onClick={handleBulkImport} disabled={saving || importPreviewRows.length === 0 || !canManageOperations} className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-semibold transition-colors shadow-md">
              {saving ? "Aktarılıyor..." : "Listeyi İçe Aktar ve Portföyü Güncelle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
