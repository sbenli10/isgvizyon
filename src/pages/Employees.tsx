import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { ArrowLeft, FileSpreadsheet, Plus, RefreshCcw, Shield, Trash2, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/csvExport";
import { useAuth } from "@/contexts/AuthContext";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CompanyOption = { id: string; name: string };
type EmployeeRecord = {
  id: string;
  company_id: string;
  company_name: string | null;
  first_name: string;
  last_name: string;
  tc_number: string | null;
  email: string | null;
  phone: string | null;
  job_title: string;
  department: string | null;
  start_date: string | null;
  employment_type: string | null;
  is_active: boolean;
};

type EmployeeFormState = {
  companyId: string;
  firstName: string;
  lastName: string;
  tcNumber: string;
  jobTitle: string;
  department: string;
  startDate: string;
  employmentType: string;
  phone: string;
  email: string;
};

type EmployeeImportRow = Record<string, string>;
type EmployeePpeRecord = {
  id: string;
  due_date: string;
  status: string;
  quantity: number;
  size_label: string | null;
  item_name: string;
};

type EmployeeHealthRecord = {
  id: string;
  exam_type: string;
  exam_date: string;
  next_exam_date: string | null;
  result_status: string;
  status: string;
  physician_name: string | null;
};

const emptyForm: EmployeeFormState = {
  companyId: "",
  firstName: "",
  lastName: "",
  tcNumber: "",
  jobTitle: "",
  department: "",
  startDate: new Date().toISOString().slice(0, 10),
  employmentType: "Süresiz",
  phone: "",
  email: "",
};

const PAGE_SIZE = 10;

const normalizeHeader = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .trim()
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/\s+/g, "_");

const readWorkbookRows = (file: File): Promise<EmployeeImportRow[]> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
        resolve(
          rows.map((row) => {
            const normalized: EmployeeImportRow = {};
            Object.entries(row).forEach(([key, value]) => {
              normalized[normalizeHeader(key)] = String(value ?? "").trim();
            });
            return normalized;
          }),
        );
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.readAsArrayBuffer(file);
  });

const downloadAddTemplate = () => {
  const rows = [
    ["company_name", "first_name", "last_name", "job_title", "department", "start_date", "employment_type", "tc_number", "phone", "email"],
    ["Benli AŞ", "Ahmet", "Yılmaz", "Kaynak Ustası", "Üretim", "2026-03-01", "Süresiz", "12345678901", "05551234567", "ahmet@example.com"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "CalisanEkle");
  XLSX.writeFile(wb, "calisan-ekleme-sablonu.xlsx");
};

const downloadRemoveTemplate = () => {
  const rows = [
    ["employee_id", "tc_number", "email"],
    ["", "12345678901", ""],
    ["", "", "ahmet@example.com"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "CalisanCikar");
  XLSX.writeFile(wb, "calisan-cikarma-sablonu.xlsx");
};

export default function Employees() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<EmployeeRecord[]>([]);
  const [passiveEmployees, setPassiveEmployees] = useState<EmployeeRecord[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [passiveCount, setPassiveCount] = useState(0);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  usePageDataTiming(loading);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EmployeeFormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [employeePpeItems, setEmployeePpeItems] = useState<EmployeePpeRecord[]>([]);
  const [employeeHealthItems, setEmployeeHealthItems] = useState<EmployeeHealthRecord[]>([]);
  const [activePage, setActivePage] = useState(1);
  const [passivePage, setPassivePage] = useState(1);
  const addInputRef = useRef<HTMLInputElement | null>(null);
  const removeInputRef = useRef<HTMLInputElement | null>(null);

  const mapEmployeeRows = (
    rows: Array<Record<string, unknown>>,
    companyMap: Map<string, string>,
  ): EmployeeRecord[] =>
    rows.map((row) => ({
      id: String(row.id),
      company_id: String(row.company_id),
      company_name: companyMap.get(String(row.company_id)) || null,
      first_name: String(row.first_name || ""),
      last_name: String(row.last_name || ""),
      tc_number: row.tc_number ? String(row.tc_number) : null,
      email: row.email ? String(row.email) : null,
      phone: row.phone ? String(row.phone) : null,
      job_title: String(row.job_title || ""),
      department: row.department ? String(row.department) : null,
      start_date: row.start_date ? String(row.start_date) : null,
      employment_type: row.employment_type ? String(row.employment_type) : null,
      is_active: Boolean(row.is_active),
    }));

  const applyEmployeeFilters = (query: any, isActive: boolean) => {
    const term = search.trim();
    let next = query.eq("is_active", isActive);
    if (companyFilter !== "ALL") {
      next = next.eq("company_id", companyFilter);
    }
    if (term) {
      next = next.or(
        `first_name.ilike.%${term}%,last_name.ilike.%${term}%,job_title.ilike.%${term}%,department.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,tc_number.ilike.%${term}%`,
      );
    }
    return next;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: companyRows, error: companyError }] = await Promise.all([
        (supabase as any).from("companies").select("id, name").eq("is_active", true).order("name", { ascending: true }),
      ]);

      if (companyError) throw companyError;

      const companyMap = new Map<string, string>((companyRows || []).map((row: { id: string; name: string }) => [row.id, row.name]));
      const mappedCompanies = (companyRows || []) as CompanyOption[];

      setCompanies(mappedCompanies);

      if (id) {
        const { data: selectedRow, error: selectedError } = await (supabase as any)
          .from("employees")
          .select("*")
          .eq("id", id)
          .single();
        if (selectedError) throw selectedError;
        const [mappedSelected] = mapEmployeeRows([selectedRow], companyMap);
        setSelectedEmployee(mappedSelected || null);
      } else {
        const activeFrom = Math.max(0, (activePage - 1) * PAGE_SIZE);
        const passiveFrom = Math.max(0, (passivePage - 1) * PAGE_SIZE);

        const [activeResult, passiveResult] = await Promise.all([
          applyEmployeeFilters(
            (supabase as any).from("employees").select("*", { count: "exact" }),
            true,
          )
            .order("first_name", { ascending: true })
            .range(activeFrom, activeFrom + PAGE_SIZE - 1),
          applyEmployeeFilters(
            (supabase as any).from("employees").select("*", { count: "exact" }),
            false,
          )
            .order("first_name", { ascending: true })
            .range(passiveFrom, passiveFrom + PAGE_SIZE - 1),
        ]);

        if (activeResult.error) throw activeResult.error;
        if (passiveResult.error) throw passiveResult.error;

        setActiveEmployees(mapEmployeeRows((activeResult.data || []) as Array<Record<string, unknown>>, companyMap));
        setPassiveEmployees(mapEmployeeRows((passiveResult.data || []) as Array<Record<string, unknown>>, companyMap));
        setActiveCount(activeResult.count || 0);
        setPassiveCount(passiveResult.count || 0);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Çalışan verileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user?.id, id, activePage, passivePage, search, companyFilter]);

  useEffect(() => {
    const loadEmployeePpe = async () => {
      if (!id) {
        setEmployeePpeItems([]);
        setEmployeeHealthItems([]);
        return;
      }

      const { data, error } = await (supabase as any)
        .from("ppe_assignments")
        .select("id, due_date, status, quantity, size_label, inventory:ppe_inventory(item_name)")
        .eq("employee_id", id)
        .order("due_date", { ascending: true });

      if (error) {
        toast.error("Çalışanın KKD zimmetleri yüklenemedi.");
        return;
      }

      setEmployeePpeItems(
        ((data || []) as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id),
          due_date: String(row.due_date || ""),
          status: String(row.status || ""),
          quantity: Number(row.quantity || 0),
          size_label: row.size_label ? String(row.size_label) : null,
          item_name: String((row.inventory as { item_name?: string } | null)?.item_name || "KKD kaydı"),
        })),
      );
    };

    void loadEmployeePpe();

    const loadEmployeeHealth = async () => {
      if (!id) return;
      const { data, error } = await (supabase as any)
        .from("health_surveillance_records")
        .select("id, exam_type, exam_date, next_exam_date, result_status, status, physician_name")
        .eq("employee_id", id)
        .order("exam_date", { ascending: false });
      if (error) {
        toast.error("Çalışanın sağlık gözetimi verileri yüklenemedi.");
        return;
      }
      setEmployeeHealthItems(((data || []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        exam_type: String(row.exam_type || ""),
        exam_date: String(row.exam_date || ""),
        next_exam_date: row.next_exam_date ? String(row.next_exam_date) : null,
        result_status: String(row.result_status || ""),
        status: String(row.status || ""),
        physician_name: row.physician_name ? String(row.physician_name) : null,
      })));
    };

    void loadEmployeeHealth();
  }, [id]);

  const filteredEmployees = useMemo(() => [...activeEmployees, ...passiveEmployees], [activeEmployees, passiveEmployees]);
  const activeTotalPages = Math.max(1, Math.ceil(activeCount / PAGE_SIZE));
  const passiveTotalPages = Math.max(1, Math.ceil(passiveCount / PAGE_SIZE));
  const summary = useMemo(
    () => ({
      total: activeCount + passiveCount,
      active: activeCount,
      passive: passiveCount,
      filtered: activeCount + passiveCount,
    }),
    [activeCount, passiveCount],
  );

  useEffect(() => {
    setActivePage(1);
    setPassivePage(1);
  }, [search, companyFilter]);

  useEffect(() => {
    if (activePage > activeTotalPages) setActivePage(activeTotalPages);
  }, [activePage, activeTotalPages]);

  useEffect(() => {
    if (passivePage > passiveTotalPages) setPassivePage(passiveTotalPages);
  }, [passivePage, passiveTotalPages]);

  const fetchAllEmployees = async (): Promise<EmployeeRecord[]> => {
    const [{ data: companyRows, error: companyError }, { data: employeeRows, error: employeeError }] = await Promise.all([
      (supabase as any).from("companies").select("id, name"),
      (supabase as any).from("employees").select("*").order("first_name", { ascending: true }),
    ]);

    if (companyError) throw companyError;
    if (employeeError) throw employeeError;

    const companyMap = new Map<string, string>((companyRows || []).map((row: { id: string; name: string }) => [row.id, row.name]));
    return mapEmployeeRows((employeeRows || []) as Array<Record<string, unknown>>, companyMap);
  };

  const handleCreateEmployee = async () => {
    if (!form.companyId || !form.firstName.trim() || !form.lastName.trim() || !form.jobTitle.trim()) {
      toast.error("Firma, ad, soyad ve görev alanları zorunludur.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        company_id: form.companyId,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        tc_number: form.tcNumber.trim() || null,
        job_title: form.jobTitle.trim(),
        department: form.department.trim() || null,
        start_date: form.startDate || new Date().toISOString().slice(0, 10),
        employment_type: form.employmentType || "Süresiz",
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        is_active: true,
      };

      const { error } = await (supabase as any).from("employees").insert(payload);
      if (error) throw error;

      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("Çalışan kaydı eklendi.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Çalışan kaydı eklenemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAdd = async (file: File) => {
    try {
      const rows = await readWorkbookRows(file);
      if (rows.length === 0) {
        toast.error("Excel içinde satır bulunamadı.");
        return;
      }

      const companyMap = new Map(companies.map((item) => [item.name.toLocaleLowerCase("tr-TR"), item.id]));
      const directoryEmployees = await fetchAllEmployees();
      const existingTc = new Set(directoryEmployees.map((item) => item.tc_number).filter(Boolean));
      const existingEmail = new Set(directoryEmployees.map((item) => item.email?.toLocaleLowerCase("tr-TR")).filter(Boolean));
      const inserts: Record<string, unknown>[] = [];
      const errors: string[] = [];

      rows.forEach((row, index) => {
        const companyName = row.company_name || row.firma || row.company;
        const companyId = companyName ? companyMap.get(companyName.toLocaleLowerCase("tr-TR")) : undefined;
        const firstName = row.first_name || row.ad || row.isim;
        const lastName = row.last_name || row.soyad;
        const jobTitle = row.job_title || row.gorev || row.görev || row.title;
        const tcNumber = row.tc_number || row.tc || "";
        const email = (row.email || row.eposta || "").toLocaleLowerCase("tr-TR");

        if (!companyId || !firstName || !lastName || !jobTitle) {
          errors.push(`Satır ${index + 2}: company_name, first_name, last_name ve job_title zorunlu.`);
          return;
        }
        if (tcNumber && existingTc.has(tcNumber)) {
          errors.push(`Satır ${index + 2}: aynı TC ile çalışan zaten mevcut.`);
          return;
        }
        if (email && existingEmail.has(email)) {
          errors.push(`Satır ${index + 2}: aynı e-posta ile çalışan zaten mevcut.`);
          return;
        }

        inserts.push({
          company_id: companyId,
          first_name: firstName,
          last_name: lastName,
          tc_number: tcNumber || null,
          job_title: jobTitle,
          department: row.department || row.departman || null,
          start_date: row.start_date || row.baslangic_tarihi || new Date().toISOString().slice(0, 10),
          employment_type: row.employment_type || row.calisma_tipi || "Süresiz",
          phone: row.phone || row.telefon || null,
          email: email || null,
          is_active: true,
        });

        if (tcNumber) existingTc.add(tcNumber);
        if (email) existingEmail.add(email);
      });

      if (inserts.length > 0) {
        const { error } = await (supabase as any).from("employees").insert(inserts);
        if (error) throw error;
      }

      await loadData();
      toast.success(`${inserts.length} çalışan eklendi.${errors.length > 0 ? ` ${errors.length} satır atlandı.` : ""}`);
      if (errors.length > 0) {
        toast.info(errors.slice(0, 3).join(" | "));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toplu çalışan ekleme başarısız.");
    }
  };

  const handleBulkRemove = async (file: File) => {
    try {
      const rows = await readWorkbookRows(file);
      if (rows.length === 0) {
        toast.error("Excel içinde satır bulunamadı.");
        return;
      }

      const directoryEmployees = await fetchAllEmployees();
      const employeesById = new Map(directoryEmployees.map((item) => [item.id, item.id]));
      const employeesByTc = new Map(directoryEmployees.filter((item) => item.tc_number).map((item) => [item.tc_number as string, item.id]));
      const employeesByEmail = new Map(
        directoryEmployees.filter((item) => item.email).map((item) => [item.email!.toLocaleLowerCase("tr-TR"), item.id]),
      );
      const ids = new Set<string>();

      rows.forEach((row) => {
        const employeeId = row.employee_id || row.id;
        const tc = row.tc_number || row.tc || "";
        const email = (row.email || row.eposta || "").toLocaleLowerCase("tr-TR");
        if (employeeId && employeesById.has(employeeId)) ids.add(employeeId);
        if (tc && employeesByTc.has(tc)) ids.add(employeesByTc.get(tc) as string);
        if (email && employeesByEmail.has(email)) ids.add(employeesByEmail.get(email) as string);
      });

      if (ids.size === 0) {
        toast.error("Pasife alınacak eşleşen çalışan bulunamadı.");
        return;
      }

      const { error } = await (supabase as any)
        .from("employees")
        .update({ is_active: false, end_date: new Date().toISOString().slice(0, 10) })
        .in("id", Array.from(ids));
      if (error) throw error;

      await loadData();
      toast.success(`${ids.size} çalışan pasife alındı.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toplu çalışan çıkarma başarısız.");
    }
  };

  const handleReactivateEmployee = async (employeeId: string) => {
    try {
      const { error } = await (supabase as any)
        .from("employees")
        .update({ is_active: true, end_date: null })
        .eq("id", employeeId);
      if (error) throw error;

      toast.success("Çalışan tekrar aktife alındı.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Çalışan aktife alınamadı.");
    }
  };

  const detailEmployee = selectedEmployee;
  const exportEmployees = async (format: "csv" | "xlsx") => {
    try {
      const [{ data: companyRows, error: companyError }, activeResult, passiveResult] = await Promise.all([
        (supabase as any).from("companies").select("id, name"),
        applyEmployeeFilters((supabase as any).from("employees").select("*"), true).order("first_name", { ascending: true }),
        applyEmployeeFilters((supabase as any).from("employees").select("*"), false).order("first_name", { ascending: true }),
      ]);

      if (companyError) throw companyError;
      if (activeResult.error) throw activeResult.error;
      if (passiveResult.error) throw passiveResult.error;

      const companyMap = new Map<string, string>((companyRows || []).map((row: { id: string; name: string }) => [row.id, row.name]));
      const rows = [
        ...mapEmployeeRows((activeResult.data || []) as Array<Record<string, unknown>>, companyMap),
        ...mapEmployeeRows((passiveResult.data || []) as Array<Record<string, unknown>>, companyMap),
      ];

      const headers = ["Ad", "Soyad", "Firma", "Görev", "Departman", "Telefon", "E-posta", "TC", "Başlangıç", "Durum"];
      const body = rows.map((employee) => [
        employee.first_name,
        employee.last_name,
        employee.company_name || "",
        employee.job_title,
        employee.department || "",
        employee.phone || "",
        employee.email || "",
        employee.tc_number || "",
        employee.start_date || "",
        employee.is_active ? "Aktif" : "Pasif",
      ]);

      if (format === "csv") {
        downloadCsv("calisanlar.csv", headers, body);
        return;
      }

      const sheet = XLSX.utils.aoa_to_sheet([headers, ...body]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Calisanlar");
      XLSX.writeFile(workbook, "calisanlar.xlsx");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dışa aktarma başarısız.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {id && (
            <Button variant="ghost" size="icon" onClick={() => navigate("/employees")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Users className="h-8 w-8 text-sky-500" />
          <div>
            <h1 className="text-3xl font-bold">{id ? "Çalışan Detayı" : "Çalışanlar"}</h1>
            <p className="text-sm text-muted-foreground">Personel yönetimi, eğitim takibi ve KKD işlemleri.</p>
          </div>
        </div>

        {!id && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/ppe-management")}>
              <Shield className="h-4 w-4" />
              KKD Zimmet
            </Button>
            <Button variant="outline" className="gap-2" onClick={downloadAddTemplate}>
              <FileSpreadsheet className="h-4 w-4" />
              Ekleme Şablonu
            </Button>
            <Button variant="outline" className="gap-2" onClick={downloadRemoveTemplate}>
              <Trash2 className="h-4 w-4" />
              Çıkarma Şablonu
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => addInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Excel ile Ekle
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => removeInputRef.current?.click()}>
              <Trash2 className="h-4 w-4" />
              Excel ile Çıkar
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => void exportEmployees("csv")}>
              <FileSpreadsheet className="h-4 w-4" />
              CSV Dışa Aktar
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => void exportEmployees("xlsx")}>
              <FileSpreadsheet className="h-4 w-4" />
              Excel Dışa Aktar
            </Button>
            <Button className="gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Yeni Çalışan Ekle
            </Button>
          </div>
        )}
      </div>

      {!id && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Alert className="border-sky-500/20 bg-sky-500/5 text-slate-100">
            <FileSpreadsheet className="h-4 w-4" />
            <AlertTitle>Toplu çalışan ekleme</AlertTitle>
            <AlertDescription>
              Excel dosyasında `company_name`, `first_name`, `last_name`, `job_title` zorunludur.
              Opsiyonel alanlar: `department`, `start_date`, `employment_type`, `tc_number`, `phone`, `email`.
            </AlertDescription>
          </Alert>
          <Alert className="border-amber-500/20 bg-amber-500/5 text-slate-100">
            <Trash2 className="h-4 w-4" />
            <AlertTitle>Toplu çalışan çıkarma</AlertTitle>
            <AlertDescription>
              Çıkarma Excel'inde `employee_id`, `tc_number` veya `email` kolonlarından en az biri olmalıdır.
              Eşleşen çalışanlar silinmez, `pasif` duruma alınır.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {!id && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-slate-800 bg-slate-950/60">
            <CardHeader className="pb-2">
              <CardDescription>Toplam çalışan</CardDescription>
              <CardTitle className="text-3xl text-white">{summary.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-slate-800 bg-slate-950/60">
            <CardHeader className="pb-2">
              <CardDescription>Aktif çalışan</CardDescription>
              <CardTitle className="text-3xl text-white">{summary.active}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardDescription>Pasif çalışan</CardDescription>
              <CardTitle className="text-3xl text-white">{summary.passive}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-sky-500/20 bg-sky-500/5">
            <CardHeader className="pb-2">
              <CardDescription>Filtre sonucu</CardDescription>
              <CardTitle className="text-3xl text-white">{summary.filtered}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {!id && (
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ad, soyad, firma, görev, e-posta, telefon veya TC ile ara"
          />
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Firma filtrele" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tüm firmalar</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <input
        ref={addInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleBulkAdd(file);
          event.target.value = "";
        }}
      />
      <input
        ref={removeInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleBulkRemove(file);
          event.target.value = "";
        }}
      />

      {id ? (
        <Card>
          <CardHeader>
            <CardTitle>{detailEmployee ? `${detailEmployee.first_name} ${detailEmployee.last_name}` : `Çalışan ID: ${id}`}</CardTitle>
            <CardDescription>{detailEmployee?.company_name || "Çalışan bulunamadı"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
            <div><p className="text-sm text-muted-foreground">Görev</p><p className="font-medium">{detailEmployee?.job_title || "-"}</p></div>
            <div><p className="text-sm text-muted-foreground">Departman</p><p className="font-medium">{detailEmployee?.department || "-"}</p></div>
            <div><p className="text-sm text-muted-foreground">Başlangıç</p><p className="font-medium">{detailEmployee?.start_date || "-"}</p></div>
            <div><p className="text-sm text-muted-foreground">İletişim</p><p className="font-medium">{detailEmployee?.phone || detailEmployee?.email || "-"}</p></div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Sağlık Gözetimi Özeti</p>
                  <p className="text-sm text-slate-400">Son muayene kayıtları ve sıradaki tarih.</p>
                </div>
                <Button variant="outline" className="gap-2" onClick={() => navigate(`/health-surveillance?employeeId=${id}`)}>
                  <Shield className="h-4 w-4" />
                  Sağlık Gözetimine Git
                </Button>
              </div>

              <div className="rounded-2xl border border-slate-800">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Muayene</TableHead>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Sonraki</TableHead>
                      <TableHead>Durum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeHealthItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                          Bu çalışan için sağlık gözetimi kaydı bulunamadı.
                        </TableCell>
                      </TableRow>
                    ) : (
                      employeeHealthItems.slice(0, 4).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.exam_type}</TableCell>
                          <TableCell>{item.exam_date}</TableCell>
                          <TableCell>{item.next_exam_date || "-"}</TableCell>
                          <TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">KKD Zimmetleri</p>
                  <p className="text-sm text-slate-400">Bu çalışana bağlı aktif ve geçmiş KKD kayıtları.</p>
                </div>
                <Button variant="outline" className="gap-2" onClick={() => navigate("/ppe-management")}>
                  <Shield className="h-4 w-4" />
                  KKD Zimmete Git
                </Button>
              </div>

              <div className="rounded-2xl border border-slate-800">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>KKD</TableHead>
                      <TableHead>Yenileme</TableHead>
                      <TableHead>Adet</TableHead>
                      <TableHead>Durum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeePpeItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                          Bu çalışan için KKD zimmeti bulunamadı.
                        </TableCell>
                      </TableRow>
                    ) : (
                      employeePpeItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-white">{item.item_name}</p>
                              <p className="text-xs text-slate-400">{item.size_label || "Beden yok"}</p>
                            </div>
                          </TableCell>
                          <TableCell>{item.due_date || "-"}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>
                            <Badge variant={item.status === "returned" ? "secondary" : "outline"}>
                              {item.status === "returned"
                                ? "İade edildi"
                                : item.status === "replacement_due"
                                  ? "Yenileme bekliyor"
                                  : "Zimmetli"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Tüm Çalışanlar</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="active" className="space-y-4">
              <TabsList className="h-auto w-full justify-start rounded-xl bg-slate-900/70 p-1">
                <TabsTrigger value="active">Aktif Çalışanlar ({activeCount})</TabsTrigger>
                <TabsTrigger value="passive">Pasif Çalışanlar ({passiveCount})</TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="mt-0">
                <div className="rounded-2xl border border-slate-800">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Çalışan</TableHead>
                        <TableHead>Firma</TableHead>
                        <TableHead>Görev</TableHead>
                        <TableHead>İletişim</TableHead>
                        <TableHead>Durum</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">Çalışanlar yükleniyor...</TableCell>
                        </TableRow>
                      ) : activeEmployees.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">Filtreye uygun aktif çalışan yok.</TableCell>
                        </TableRow>
                      ) : (
                        activeEmployees.map((employee) => (
                          <TableRow key={employee.id} className="cursor-pointer" onClick={() => navigate(`/employees/${employee.id}`)}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-white">{employee.first_name} {employee.last_name}</p>
                                <p className="text-xs text-slate-400">{employee.department || "Departman yok"}</p>
                              </div>
                            </TableCell>
                            <TableCell>{employee.company_name || "-"}</TableCell>
                            <TableCell>{employee.job_title}</TableCell>
                            <TableCell>{employee.phone || employee.email || "-"}</TableCell>
                            <TableCell><Badge variant="outline">Aktif</Badge></TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {activeCount > PAGE_SIZE ? (
                  <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                    <span>Sayfa {activePage} / {activeTotalPages}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActivePage((page) => Math.max(1, page - 1))} disabled={activePage === 1}>
                        Önceki
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setActivePage((page) => Math.min(activeTotalPages, page + 1))} disabled={activePage === activeTotalPages}>
                        Sonraki
                      </Button>
                    </div>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="passive" className="mt-0">
                <div className="rounded-2xl border border-slate-800">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Çalışan</TableHead>
                        <TableHead>Firma</TableHead>
                        <TableHead>Görev</TableHead>
                        <TableHead>İletişim</TableHead>
                        <TableHead>Durum</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">Çalışanlar yükleniyor...</TableCell>
                        </TableRow>
                      ) : passiveEmployees.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">Filtreye uygun pasif çalışan yok.</TableCell>
                        </TableRow>
                      ) : (
                        passiveEmployees.map((employee) => (
                          <TableRow key={employee.id} className="cursor-pointer" onClick={() => navigate(`/employees/${employee.id}`)}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-white">{employee.first_name} {employee.last_name}</p>
                                <p className="text-xs text-slate-400">{employee.department || "Departman yok"}</p>
                              </div>
                            </TableCell>
                            <TableCell>{employee.company_name || "-"}</TableCell>
                            <TableCell>{employee.job_title}</TableCell>
                            <TableCell>{employee.phone || employee.email || "-"}</TableCell>
                            <TableCell>
                              <div className="flex items-center justify-between gap-2">
                                <Badge variant="secondary">Pasif</Badge>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleReactivateEmployee(employee.id);
                                  }}
                                >
                                  <RefreshCcw className="h-4 w-4" />
                                  Aktife Al
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {passiveCount > PAGE_SIZE ? (
                  <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                    <span>Sayfa {passivePage} / {passiveTotalPages}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPassivePage((page) => Math.max(1, page - 1))} disabled={passivePage === 1}>
                        Önceki
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPassivePage((page) => Math.min(passiveTotalPages, page + 1))} disabled={passivePage === passiveTotalPages}>
                        Sonraki
                      </Button>
                    </div>
                  </div>
                ) : null}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Yeni Çalışan Ekle</DialogTitle>
            <DialogDescription>Zorunlu alanlar: firma, ad, soyad ve görev.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Firma</Label>
              <Select value={form.companyId} onValueChange={(value) => setForm((prev) => ({ ...prev, companyId: value }))}>
                <SelectTrigger><SelectValue placeholder="Firma seçin" /></SelectTrigger>
                <SelectContent>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Ad</Label><Input value={form.firstName} onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Soyad</Label><Input value={form.lastName} onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))} /></div>
            <div className="space-y-2"><Label>TC Kimlik No</Label><Input value={form.tcNumber} onChange={(e) => setForm((prev) => ({ ...prev, tcNumber: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Görev</Label><Input value={form.jobTitle} onChange={(e) => setForm((prev) => ({ ...prev, jobTitle: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Departman</Label><Input value={form.department} onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Başlangıç Tarihi</Label><Input type="date" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Çalışma Tipi</Label><Select value={form.employmentType} onValueChange={(value) => setForm((prev) => ({ ...prev, employmentType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Süresiz">Süresiz</SelectItem><SelectItem value="Süreli">Süreli</SelectItem><SelectItem value="Stajyer">Stajyer</SelectItem><SelectItem value="Part-Time">Part-Time</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} /></div>
            <div className="space-y-2"><Label>E-posta</Label><Input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Vazgeç</Button>
            <Button onClick={() => void handleCreateEmployee()} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


