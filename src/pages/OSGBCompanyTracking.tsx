import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Building2, Download, Link2, Plus, RefreshCcw, Search, ShieldAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { useOsgbAccess } from "@/hooks/useOsgbAccess";
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
  sgkNo: string;
  taxNumber: string;
  employeeCount: string;
  hazardClass: string;
  address: string;
  phone: string;
  email: string;
  contactName: string;
  contractStart: string;
  contractEnd: string;
  monthlyFee: string;
  assignmentMode: string;
  visitFrequency: string;
  notes: string;
};

const emptyManualForm: ManualCompanyFormState = {
  companyName: "",
  sgkNo: "",
  taxNumber: "",
  employeeCount: "0",
  hazardClass: "Az Tehlikeli",
  address: "",
  phone: "",
  email: "",
  contactName: "",
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
};
const assignmentStatusTone: Record<OsgbManagedCompanyRecord["assignmentApprovalStatus"], string> = {
  approved: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  pending_personnel: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  pending_workplace: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-200",
  missing_contract: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200",
  planned: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-200",
};
const visitFrequencyLabels: Record<string, string> = {
  monthly_once: "Ayda 1 Defa",
  monthly_twice: "Ayda 2 Defa",
  weekly: "Haftalık",
  custom: "Özel Plan",
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(value || 0);

const normalizeHeader = (value: string) =>
  value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]/g, "");

const parseImportRows = async (file: File): Promise<OsgbCompanyManagementInput[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
  return rows.map((row) => {
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
      visitFrequency: visitValue.includes("hafta") ? "weekly" : visitValue.includes("2") ? "monthly_twice" : visitValue.includes("ozel") || visitValue.includes("özel") ? "custom" : "monthly_once",
      notes: String(getValue("notlar", "notes") || "").trim() || null,
      managementSource: "import",
    } satisfies OsgbCompanyManagementInput;
  }).filter(Boolean) as OsgbCompanyManagementInput[];
};

export default function OSGBCompanyTracking() {
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
  const [importPreviewRows, setImportPreviewRows] = useState<OsgbCompanyManagementInput[]>([]);
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
    setSaving(true);
    try {
      await upsertOsgbManagedCompany(user.id, organizationId, {
        companyName: manualForm.companyName.trim(),
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
      });
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
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">OSGB Firma Takibi</h1>
                <Badge variant="outline">{roleLabel}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Bu ekran OSGB firma havuzudur. Havuzdaki firmalar tüm operasyon ekranlarında aynı veriyle çalışır.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Yenile
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Dışa Aktar
          </Button>
          <Button variant="outline" onClick={() => setKatipOpen(true)} disabled={!canManageOperations}>
            <Link2 className="mr-2 h-4 w-4" />
            İSG-KATİP’ten Aktar
          </Button>
          <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setBulkOpen(true)} disabled={!canManageOperations}>
            <Upload className="mr-2 h-4 w-4" />
            Toplu Firma Yükle
          </Button>
          <Button onClick={() => setManualOpen(true)} disabled={!canManageOperations}>
            <Plus className="mr-2 h-4 w-4" />
            Firma Ekle
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Firma havuzu yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_repeat(5,minmax(0,0.6fr))]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" placeholder="Firma, SGK no, vergi no..." />
        </div>
        <Select value={hazardFilter} onValueChange={(value) => setHazardFilter(value as (typeof hazardOptions)[number])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{hazardOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={assignmentFilter} onValueChange={(value) => setAssignmentFilter(value as (typeof assignmentFilterOptions)[number])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tüm atamalar</SelectItem>
            <SelectItem value="approved">Tam onaylı</SelectItem>
            <SelectItem value="pending_personnel">Personel onayı</SelectItem>
            <SelectItem value="pending_workplace">İşyeri onayı</SelectItem>
            <SelectItem value="missing_contract">Sözleşme yok</SelectItem>
            <SelectItem value="planned">Planlanan</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(value) => setSortBy(value as "company" | "employees" | "fee")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="company">Unvan</SelectItem>
            <SelectItem value="employees">Çalışan</SelectItem>
            <SelectItem value="fee">Aylık bedel</SelectItem>
          </SelectContent>
        </Select>
        <Card><CardContent className="px-4 py-3"><div className="text-center text-xl font-semibold text-foreground">{workspace?.summary.totalCompanies || 0}</div><div className="text-center text-xs text-muted-foreground">Havuzdaki firma</div></CardContent></Card>
        <Button type="button" className="bg-violet-600 text-white hover:bg-violet-700" onClick={() => setAssignmentFilter("missing_contract")}>
          <ShieldAlert className="mr-2 h-4 w-4" />
          Eksik atamaları bul
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={assignmentFilter === "ALL" ? "default" : "outline"} className="cursor-pointer" onClick={() => setAssignmentFilter("ALL")}>Tümü ({workspace?.summary.totalCompanies || 0})</Badge>
        <Badge variant="outline" className="cursor-pointer" onClick={() => setAssignmentFilter("approved")}>Tam onaylı ({workspace?.summary.approvedCount || 0})</Badge>
        <Badge variant="outline" className="cursor-pointer" onClick={() => setAssignmentFilter("pending_personnel")}>Personel onayı ({workspace?.summary.pendingPersonnelApprovalCount || 0})</Badge>
        <Badge variant="outline" className="cursor-pointer" onClick={() => setAssignmentFilter("pending_workplace")}>İşyeri onayı ({workspace?.summary.pendingWorkplaceApprovalCount || 0})</Badge>
        <Badge variant="outline" className="cursor-pointer" onClick={() => setAssignmentFilter("missing_contract")}>Sözleşme yok ({workspace?.summary.missingContractCount || 0})</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Firma Havuzu</CardTitle>
            <CardDescription>Bu havuzdaki firmalar dashboard, kapasite, saha, evrak, finans ve portal ekranlarında birebir görünür.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-2xl border border-border bg-muted/40" />)}</div>
            ) : companies.length ? (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Firma</TableHead>
                      <TableHead>Çalışan</TableHead>
                      <TableHead>Tehlike</TableHead>
                      <TableHead>Atama</TableHead>
                      <TableHead>Ziyaret</TableHead>
                      <TableHead>Aylık Bedel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company) => (
                      <TableRow key={company.id} className={cn("cursor-pointer transition-colors", selectedCompany?.id === company.id && "bg-primary/5")} onClick={() => setSelectedCompanyId(company.id)}>
                        <TableCell><div className="space-y-1"><div className="font-medium text-foreground">{company.companyName}</div><div className="text-xs text-muted-foreground">{company.sgkNo || "SGK yok"} · {company.taxNumber || "Vergi no yok"}</div></div></TableCell>
                        <TableCell>{company.employeeCount}</TableCell>
                        <TableCell><Badge variant="outline">{company.hazardClass}</Badge></TableCell>
                        <TableCell><Badge className={assignmentStatusTone[company.assignmentApprovalStatus]}>{assignmentStatusLabels[company.assignmentApprovalStatus]}</Badge></TableCell>
                        <TableCell>{visitFrequencyLabels[company.visitFrequency] || "Ayda 1 Defa"}</TableCell>
                        <TableCell>{formatMoney(company.monthlyFee)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border bg-muted/20 px-8 py-16 text-center">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-6 text-base text-muted-foreground">Henüz havuza alınmış firma yok. İSG-KATİP, Excel veya manuel ekleme ile başlayın.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <OsgbCompany360Panel company={selectedCompany} snapshot={company360} />
          <OsgbOnboardingChecklist steps={onboardingSteps} />
        </div>
      </div>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Yeni OSGB firması ekle</DialogTitle>
            <DialogDescription>Manuel kayıt doğrudan managed havuza eklenir.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-12">
            <div className="space-y-2 md:col-span-12"><Label>Firma unvanı</Label><Input value={manualForm.companyName} onChange={(e) => setManualForm((prev) => ({ ...prev, companyName: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-4"><Label>SGK Sicil No</Label><Input value={manualForm.sgkNo} onChange={(e) => setManualForm((prev) => ({ ...prev, sgkNo: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-4"><Label>Vergi No</Label><Input value={manualForm.taxNumber} onChange={(e) => setManualForm((prev) => ({ ...prev, taxNumber: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-4"><Label>Çalışan Sayısı</Label><Input type="number" value={manualForm.employeeCount} onChange={(e) => setManualForm((prev) => ({ ...prev, employeeCount: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-4"><Label>Tehlike Sınıfı</Label><Select value={manualForm.hazardClass} onValueChange={(value) => setManualForm((prev) => ({ ...prev, hazardClass: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Az Tehlikeli">Az Tehlikeli</SelectItem><SelectItem value="Tehlikeli">Tehlikeli</SelectItem><SelectItem value="Çok Tehlikeli">Çok Tehlikeli</SelectItem></SelectContent></Select></div>
            <div className="space-y-2 md:col-span-8"><Label>Adres</Label><Input value={manualForm.address} onChange={(e) => setManualForm((prev) => ({ ...prev, address: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-4"><Label>Telefon</Label><Input value={manualForm.phone} onChange={(e) => setManualForm((prev) => ({ ...prev, phone: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-4"><Label>E-posta</Label><Input value={manualForm.email} onChange={(e) => setManualForm((prev) => ({ ...prev, email: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-4"><Label>Yetkili Kişi</Label><Input value={manualForm.contactName} onChange={(e) => setManualForm((prev) => ({ ...prev, contactName: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-4"><Label>Sözleşme Başlangıç</Label><Input type="date" value={manualForm.contractStart} onChange={(e) => setManualForm((prev) => ({ ...prev, contractStart: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-4"><Label>Sözleşme Bitiş</Label><Input type="date" value={manualForm.contractEnd} onChange={(e) => setManualForm((prev) => ({ ...prev, contractEnd: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-4"><Label>Aylık Hizmet Bedeli</Label><Input type="number" value={manualForm.monthlyFee} onChange={(e) => setManualForm((prev) => ({ ...prev, monthlyFee: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-6"><Label>Atama Modu</Label><Select value={manualForm.assignmentMode} onValueChange={(value) => setManualForm((prev) => ({ ...prev, assignmentMode: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="automatic">Otomatik</SelectItem><SelectItem value="manual">Manuel</SelectItem></SelectContent></Select></div>
            <div className="space-y-2 md:col-span-6"><Label>Ziyaret Sıklığı</Label><Select value={manualForm.visitFrequency} onValueChange={(value) => setManualForm((prev) => ({ ...prev, visitFrequency: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly_once">Ayda 1 Defa</SelectItem><SelectItem value="monthly_twice">Ayda 2 Defa</SelectItem><SelectItem value="weekly">Haftalık</SelectItem><SelectItem value="custom">Özel Plan</SelectItem></SelectContent></Select></div>
            <div className="space-y-2 md:col-span-12"><Label>Notlar</Label><Textarea value={manualForm.notes} onChange={(e) => setManualForm((prev) => ({ ...prev, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>İptal</Button>
            <Button onClick={handleManualSave} disabled={saving || !canManageOperations}>Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={katipOpen} onOpenChange={setKatipOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>İSG-KATİP’ten havuza al</DialogTitle>
            <DialogDescription>Organizasyona gelen ama henüz managed olmayan firmaları seçin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(workspace?.importCandidates || []).length ? workspace!.importCandidates.map((company) => (
              <button key={company.id} type="button" onClick={() => setSelectedKatipIds((current) => current.includes(company.id) ? current.filter((item) => item !== company.id) : [...current, company.id])} className={cn("flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left", selectedKatipIds.includes(company.id) ? "border-primary bg-primary/5" : "border-border bg-card")}>
                <div><div className="font-medium text-foreground">{company.companyName}</div><div className="text-sm text-muted-foreground">{company.sgkNo || "SGK yok"} · {company.employeeCount} çalışan · {company.hazardClass}</div></div>
                <Badge variant={selectedKatipIds.includes(company.id) ? "default" : "outline"}>{selectedKatipIds.includes(company.id) ? "Seçildi" : "Seç"}</Badge>
              </button>
            )) : <Alert><AlertTitle>Aktarılacak firma bulunamadı</AlertTitle><AlertDescription>Önce İSG-KATİP Merkezi veya İSGBot ile organizasyona veri alın.</AlertDescription></Alert>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKatipOpen(false)}>Kapat</Button>
            <Button onClick={handleKatipImport} disabled={saving || selectedKatipIds.length === 0 || !canManageOperations}>Havuza Al</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Excel / CSV ile firma aktar</DialogTitle>
            <DialogDescription>Dosyadaki firmalar doğrudan managed havuza eklenir.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void handleImportFile(e.target.files?.[0] || null)} />
            {uploadingFileName ? <div className="text-sm text-muted-foreground">{uploadingFileName} · {importPreviewRows.length} satır hazır</div> : null}
            <div className="max-h-72 overflow-auto rounded-2xl border border-border">
              <Table>
                <TableHeader><TableRow><TableHead>Firma</TableHead><TableHead>Çalışan</TableHead><TableHead>Tehlike</TableHead><TableHead>Ücret</TableHead></TableRow></TableHeader>
                <TableBody>{importPreviewRows.map((row, index) => <TableRow key={`${row.companyName}-${index}`}><TableCell>{row.companyName}</TableCell><TableCell>{row.employeeCount}</TableCell><TableCell>{row.hazardClass}</TableCell><TableCell>{formatMoney(row.monthlyFee || 0)}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Kapat</Button>
            <Button onClick={handleBulkImport} disabled={saving || importPreviewRows.length === 0 || !canManageOperations}>İçe Aktar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
