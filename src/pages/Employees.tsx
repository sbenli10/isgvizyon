import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, FileSpreadsheet, Plus, RefreshCcw, Shield, Trash2, Upload, Users } from "lucide-react";
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
  full_name: string | null;
  first_name: string;
  last_name: string;
  tc_number: string | null;
  email: string | null;
  phone: string | null;
  job_title: string;
  department: string | null;
  start_date: string | null;
  end_date: string | null;
  gender: string | null;
  insured_job_code: string | null;
  insured_job_name: string | null;
  employment_type: string | null;
  is_active: boolean;
};

type EmployeeFormState = {
  companyId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  tcNumber: string;
  jobTitle: string;
  department: string;
  startDate: string;
  endDate: string;
  gender: string;
  insuredJobCode: string;
  insuredJobName: string;
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
  fullName: "",
  firstName: "",
  lastName: "",
  tcNumber: "",
  jobTitle: "",
  department: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  gender: "",
  insuredJobCode: "",
  insuredJobName: "",
  employmentType: "Süresiz",
  phone: "",
  email: "",
};

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

const getHeaderValue = (row: EmployeeImportRow, ...keys: string[]) => {
  const normalizedKeys = keys.map((key) => normalizeHeader(key));
  return row[normalizedKeys.find((key) => row[key] !== undefined) || ""] || "";
};

const parseWorkbookDate = (value: string) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  const match = normalized.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!match) return normalized;
  const [, day, month, yearRaw] = match;
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const splitFullName = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return { firstName: "", lastName: "" };
  const parts = normalized.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1).join(" "),
  };
};

const loadXlsx = () => import("xlsx");

const readWorkbookRows = (file: File): Promise<EmployeeImportRow[]> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const XLSX = await loadXlsx();
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

const downloadAddTemplate = async () => {
  const XLSX = await loadXlsx();
  const rows = [
    [
      "Firma",
      "Adı Soyadı",
      "Adı",
      "Soyadı",
      "Tc Kimlik No",
      "İşe Giriş Tar.",
      "İşten Çık.Tar.",
      "Cinsiyeti",
      "Sigortalı Mes. Kodu",
      "Sigortalı Mes. İsmi",
      "Departman",
      "Telefon",
      "E-Posta",
    ],
    ["Benli AŞ", "Ahmet Yılmaz", "Ahmet", "Yılmaz", "12345678901", "2026-03-01", "", "Erkek", "7223.14", "Kaynak Ustası", "Üretim", "05551234567", "ahmet@example.com"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "CalisanEkle");
  XLSX.writeFile(wb, "calisan-ekleme-sablonu.xlsx");
};

const downloadRemoveTemplate = async () => {
  const XLSX = await loadXlsx();
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
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [employeePpeItems, setEmployeePpeItems] = useState<EmployeePpeRecord[]>([]);
  const [employeeHealthItems, setEmployeeHealthItems] = useState<EmployeeHealthRecord[]>([]);
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
      full_name: row.full_name ? String(row.full_name) : null,
      first_name: String(row.first_name || ""),
      last_name: String(row.last_name || ""),
      tc_number: row.tc_number ? String(row.tc_number) : null,
      email: row.email ? String(row.email) : null,
      phone: row.phone ? String(row.phone) : null,
      job_title: String(row.job_title || ""),
      department: row.department ? String(row.department) : null,
      start_date: row.start_date ? String(row.start_date) : null,
      end_date: row.end_date ? String(row.end_date) : null,
      gender: row.gender ? String(row.gender) : null,
      insured_job_code: row.insured_job_code ? String(row.insured_job_code) : null,
      insured_job_name: row.insured_job_name ? String(row.insured_job_name) : null,
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
        const [activeResult, passiveResult] = await Promise.all([
          applyEmployeeFilters(
            (supabase as any).from("employees").select("*"),
            true,
          )
            .order("first_name", { ascending: true }),
          applyEmployeeFilters(
            (supabase as any).from("employees").select("*"),
            false,
          )
            .order("first_name", { ascending: true }),
        ]);

        if (activeResult.error) throw activeResult.error;
        if (passiveResult.error) throw passiveResult.error;

        const mappedActiveEmployees = mapEmployeeRows((activeResult.data || []) as Array<Record<string, unknown>>, companyMap);
        const mappedPassiveEmployees = mapEmployeeRows((passiveResult.data || []) as Array<Record<string, unknown>>, companyMap);
        setActiveEmployees(mappedActiveEmployees);
        setPassiveEmployees(mappedPassiveEmployees);
        setActiveCount(mappedActiveEmployees.length);
        setPassiveCount(mappedPassiveEmployees.length);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Çalışan verileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user?.id, id, search, companyFilter]);

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
  const companyGroups = useMemo(() => {
    const groups = new Map<string, {
      companyId: string;
      companyName: string;
      activeEmployees: EmployeeRecord[];
      passiveEmployees: EmployeeRecord[];
      totalEmployees: number;
      activeCount: number;
      passiveCount: number;
    }>();

    filteredEmployees.forEach((employee) => {
      const companyId = employee.company_id || "UNKNOWN";
      const companyName = employee.company_name || "Firma bilgisi yok";
      if (!groups.has(companyId)) {
        groups.set(companyId, {
          companyId,
          companyName,
          activeEmployees: [],
          passiveEmployees: [],
          totalEmployees: 0,
          activeCount: 0,
          passiveCount: 0,
        });
      }

      const group = groups.get(companyId)!;
      if (employee.is_active) {
        group.activeEmployees.push(employee);
        group.activeCount += 1;
      } else {
        group.passiveEmployees.push(employee);
        group.passiveCount += 1;
      }
      group.totalEmployees += 1;
    });

    return Array.from(groups.values()).sort((left, right) => left.companyName.localeCompare(right.companyName, "tr"));
  }, [filteredEmployees]);
  const selectedCompanyGroup = useMemo(
    () => companyGroups.find((group) => group.companyId === selectedCompanyId) || companyGroups[0] || null,
    [companyGroups, selectedCompanyId],
  );
  const summary = useMemo(
    () => ({
      total: activeCount + passiveCount,
      active: activeCount,
      passive: passiveCount,
      filtered: filteredEmployees.length,
      companies: companyGroups.length,
    }),
    [activeCount, passiveCount, filteredEmployees.length, companyGroups.length],
  );

  useEffect(() => {
    if (id) return;
    if (companyFilter !== "ALL") {
      setSelectedCompanyId(companyFilter);
      return;
    }
    if (!companyGroups.length) {
      setSelectedCompanyId("");
      return;
    }
    if (!companyGroups.some((group) => group.companyId === selectedCompanyId)) {
      setSelectedCompanyId(companyGroups[0].companyId);
    }
  }, [companyFilter, companyGroups, id, selectedCompanyId]);

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
        full_name: form.fullName.trim() || `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        tc_number: form.tcNumber.trim() || null,
        job_title: form.jobTitle.trim(),
        department: form.department.trim() || null,
        start_date: form.startDate || new Date().toISOString().slice(0, 10),
        end_date: form.endDate || null,
        gender: form.gender || null,
        insured_job_code: form.insuredJobCode.trim() || null,
        insured_job_name: form.insuredJobName.trim() || form.jobTitle.trim(),
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
        const companyName = getHeaderValue(row, "company_name", "firma", "company", "firma adı", "firma ünvanı");
        const companyId = companyName ? companyMap.get(companyName.toLocaleLowerCase("tr-TR")) : undefined;
        const fullName = getHeaderValue(row, "adı soyadı", "ad soyad", "full_name", "fullname");
        const splitName = splitFullName(fullName);
        const firstName = getHeaderValue(row, "first_name", "adı", "adi", "ad", "isim") || splitName.firstName;
        const lastName = getHeaderValue(row, "last_name", "soyadı", "soyadi", "soyad") || splitName.lastName;
        const insuredJobName = getHeaderValue(row, "sigortalı mes. ismi", "sigortali mes. ismi", "sigortalı meslek ismi", "meslek adı", "insured_job_name");
        const jobTitle = getHeaderValue(row, "job_title", "gorev", "görev", "title") || insuredJobName;
        const tcNumber = getHeaderValue(row, "tc kimlik no", "tc_no", "tc_number", "tc");
        const email = getHeaderValue(row, "email", "eposta", "e-posta").toLocaleLowerCase("tr-TR");

        if (!companyId || !firstName || !lastName || !jobTitle) {
          errors.push(`Satır ${index + 2}: firma, ad/soyad ve sigortalı meslek bilgisi zorunlu.`);
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
          full_name: fullName || `${firstName} ${lastName}`.trim(),
          first_name: firstName,
          last_name: lastName,
          tc_number: tcNumber || null,
          job_title: jobTitle,
          department: getHeaderValue(row, "department", "departman", "bölüm", "bolum", "birim") || null,
          start_date:
            parseWorkbookDate(getHeaderValue(row, "işe giriş tar.", "ise giris tar.", "işe giriş tarihi", "start_date", "başlangıç tarihi", "baslangic_tarihi")) ||
            new Date().toISOString().slice(0, 10),
          end_date: parseWorkbookDate(getHeaderValue(row, "işten çık.tar.", "isten cik.tar.", "işten çıkış tarihi", "end_date")) || null,
          gender: getHeaderValue(row, "cinsiyeti", "cinsiyet", "gender") || null,
          insured_job_code: getHeaderValue(row, "sigortalı mes. kodu", "sigortali mes. kodu", "sigortalı meslek kodu", "insured_job_code") || null,
          insured_job_name: insuredJobName || null,
          employment_type: getHeaderValue(row, "employment_type", "calisma_tipi") || "Süresiz",
          phone: getHeaderValue(row, "phone", "telefon") || null,
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

      const headers = [
        "Adı Soyadı",
        "Adı",
        "Soyadı",
        "Firma",
        "TC Kimlik No",
        "İşe Giriş Tar.",
        "İşten Çık.Tar.",
        "Cinsiyeti",
        "Sigortalı Mes. Kodu",
        "Sigortalı Mes. İsmi",
        "Departman",
        "Telefon",
        "E-Posta",
        "Durum",
      ];
      const body = rows.map((employee) => [
        employee.full_name || `${employee.first_name} ${employee.last_name}`.trim(),
        employee.first_name,
        employee.last_name,
        employee.company_name || "",
        employee.tc_number || "",
        employee.start_date || "",
        employee.end_date || "",
        employee.gender || "",
        employee.insured_job_code || "",
        employee.insured_job_name || employee.job_title || "",
        employee.department || "",
        employee.phone || "",
        employee.email || "",
        employee.is_active ? "Aktif" : "Pasif",
      ]);

      if (format === "csv") {
        downloadCsv("calisanlar.csv", headers, body);
        return;
      }

      const XLSX = await loadXlsx();
      const sheet = XLSX.utils.aoa_to_sheet([headers, ...body]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Calisanlar");
      XLSX.writeFile(workbook, "calisanlar.xlsx");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dışa aktarma başarısız.");
    }
  };

  return (
    <div className="theme-page-readable space-y-6">
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
              Excel dosyasında `Firma`, `Adı Soyadı` veya `Adı` + `Soyadı`, ayrıca meslek/görev bilgisi bulunmalıdır.
              Desteklenen alanlar arasında `Tc Kimlik No`, `İşe Giriş Tar.`, `İşten Çık.Tar.`, `Cinsiyeti`, `Sigortalı Mes. Kodu`, `Sigortalı Mes. İsmi`, `Telefon`, `E-Posta` yer alır.
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
              <CardDescription>Görünen firma</CardDescription>
              <CardTitle className="text-3xl text-white">{summary.companies}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-emerald-500/20 bg-emerald-500/5">
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
            <div><p className="text-sm text-muted-foreground">Adı Soyadı</p><p className="font-medium">{detailEmployee?.full_name || `${detailEmployee?.first_name || ""} ${detailEmployee?.last_name || ""}`.trim() || "-"}</p></div>
            <div><p className="text-sm text-muted-foreground">TC Kimlik No</p><p className="font-medium">{detailEmployee?.tc_number || "-"}</p></div>
            <div><p className="text-sm text-muted-foreground">Sigortalı Mes. İsmi</p><p className="font-medium">{detailEmployee?.insured_job_name || detailEmployee?.job_title || "-"}</p></div>
            <div><p className="text-sm text-muted-foreground">Sigortalı Mes. Kodu</p><p className="font-medium">{detailEmployee?.insured_job_code || "-"}</p></div>
            <div><p className="text-sm text-muted-foreground">Departman</p><p className="font-medium">{detailEmployee?.department || "-"}</p></div>
            <div><p className="text-sm text-muted-foreground">Cinsiyet</p><p className="font-medium">{detailEmployee?.gender || "-"}</p></div>
            <div><p className="text-sm text-muted-foreground">İşe Giriş</p><p className="font-medium">{detailEmployee?.start_date || "-"}</p></div>
            <div><p className="text-sm text-muted-foreground">İşten Çıkış</p><p className="font-medium">{detailEmployee?.end_date || "-"}</p></div>
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
            <CardTitle>Firma Bazlı Çalışan Havuzu</CardTitle>
            <CardDescription>
              Önce firmayı seçin, sonra o firmaya ait tüm aktif ve pasif çalışanları tek ekranda yönetin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="rounded-2xl border border-slate-800 py-16 text-center text-sm text-muted-foreground">
                Firma kartları ve çalışanlar yükleniyor...
              </div>
            ) : companyGroups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 py-16 text-center text-sm text-muted-foreground">
                Bu filtrelere uygun firma veya çalışan bulunamadı.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {companyGroups.map((group) => {
                    const isSelected = selectedCompanyGroup?.companyId === group.companyId;
                    return (
                      <button
                        key={group.companyId}
                        type="button"
                        onClick={() => setSelectedCompanyId(group.companyId)}
                        className={`rounded-2xl border p-5 text-left transition ${
                          isSelected
                            ? "border-sky-400/60 bg-sky-500/10 shadow-lg shadow-sky-900/20"
                            : "border-slate-800 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-900/70"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <p className="text-lg font-semibold text-white">{group.companyName}</p>
                            <p className="text-sm text-slate-400">
                              {group.totalEmployees} çalışan, {group.activeCount} aktif, {group.passiveCount} pasif
                            </p>
                          </div>
                          <ChevronRight className={`h-5 w-5 ${isSelected ? "text-sky-300" : "text-slate-500"}`} />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-300">
                            Aktif {group.activeCount}
                          </Badge>
                          <Badge variant="secondary">
                            Pasif {group.passiveCount}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedCompanyGroup ? (
                  <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
                    <div className="flex flex-col gap-3 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <h3 className="text-2xl font-bold text-white">{selectedCompanyGroup.companyName}</h3>
                        <p className="text-sm text-slate-400">
                          Bu firmaya bağlı tüm çalışanlar tek ekranda listelenir. Kart değiştirerek firma ekipleri arasında hızlıca geçebilirsiniz.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-sky-500/30 text-sky-300">
                          Toplam {selectedCompanyGroup.totalEmployees}
                        </Badge>
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-300">
                          Aktif {selectedCompanyGroup.activeCount}
                        </Badge>
                        <Badge variant="secondary">
                          Pasif {selectedCompanyGroup.passiveCount}
                        </Badge>
                      </div>
                    </div>

                    <Tabs defaultValue="active" className="mt-5 space-y-4">
                      <TabsList className="h-auto w-full justify-start rounded-xl bg-slate-900/70 p-1">
                        <TabsTrigger value="active">
                          Aktif Çalışanlar ({selectedCompanyGroup.activeCount})
                        </TabsTrigger>
                        <TabsTrigger value="passive">
                          Pasif Çalışanlar ({selectedCompanyGroup.passiveCount})
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="active" className="mt-0">
                        <div className="rounded-2xl border border-slate-800">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Çalışan</TableHead>
                                <TableHead>Görev</TableHead>
                                <TableHead>İletişim</TableHead>
                                <TableHead>Durum</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedCompanyGroup.activeEmployees.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                                    Bu firmada aktif çalışan bulunmuyor.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                selectedCompanyGroup.activeEmployees.map((employee) => (
                                  <TableRow key={employee.id} className="cursor-pointer" onClick={() => navigate(`/employees/${employee.id}`)}>
                                    <TableCell>
                                      <div>
                                        <p className="font-medium text-white">{employee.first_name} {employee.last_name}</p>
                                        <p className="text-xs text-slate-400">{employee.department || "Departman yok"}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell>{employee.job_title}</TableCell>
                                    <TableCell>{employee.phone || employee.email || "-"}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline">Aktif</Badge>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>

                      <TabsContent value="passive" className="mt-0">
                        <div className="rounded-2xl border border-slate-800">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Çalışan</TableHead>
                                <TableHead>Görev</TableHead>
                                <TableHead>İletişim</TableHead>
                                <TableHead>Durum</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedCompanyGroup.passiveEmployees.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                                    Bu firmada pasif çalışan bulunmuyor.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                selectedCompanyGroup.passiveEmployees.map((employee) => (
                                  <TableRow key={employee.id} className="cursor-pointer" onClick={() => navigate(`/employees/${employee.id}`)}>
                                    <TableCell>
                                      <div>
                                        <p className="font-medium text-white">{employee.first_name} {employee.last_name}</p>
                                        <p className="text-xs text-slate-400">{employee.department || "Departman yok"}</p>
                                      </div>
                                    </TableCell>
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
                      </TabsContent>
                    </Tabs>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Yeni Çalışan Ekle</DialogTitle>
            <DialogDescription>Zorunlu alanlar: firma, ad, soyad ve sigortalı meslek/görev bilgisi.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Firma</Label>
              <Select value={form.companyId} onValueChange={(value) => setForm((prev) => ({ ...prev, companyId: value }))}>
                <SelectTrigger><SelectValue placeholder="Firma seçin" /></SelectTrigger>
                <SelectContent>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2"><Label>Adı Soyadı</Label><Input value={form.fullName} onChange={(e) => { const fullName = e.target.value; const split = splitFullName(fullName); setForm((prev) => ({ ...prev, fullName, firstName: split.firstName || prev.firstName, lastName: split.lastName || prev.lastName })); }} /></div>
            <div className="space-y-2"><Label>Ad</Label><Input value={form.firstName} onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value, fullName: `${e.target.value} ${prev.lastName}`.trim() }))} /></div>
            <div className="space-y-2"><Label>Soyad</Label><Input value={form.lastName} onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value, fullName: `${prev.firstName} ${e.target.value}`.trim() }))} /></div>
            <div className="space-y-2"><Label>TC Kimlik No</Label><Input value={form.tcNumber} onChange={(e) => setForm((prev) => ({ ...prev, tcNumber: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Sigortalı Mes. Kodu</Label><Input value={form.insuredJobCode} onChange={(e) => setForm((prev) => ({ ...prev, insuredJobCode: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Sigortalı Mes. İsmi</Label><Input value={form.insuredJobName} onChange={(e) => setForm((prev) => ({ ...prev, insuredJobName: e.target.value, jobTitle: e.target.value || prev.jobTitle }))} /></div>
            <div className="space-y-2"><Label>Görev</Label><Input value={form.jobTitle} onChange={(e) => setForm((prev) => ({ ...prev, jobTitle: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Departman</Label><Input value={form.department} onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))} /></div>
            <div className="space-y-2"><Label>İşe Giriş Tar.</Label><Input type="date" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} /></div>
            <div className="space-y-2"><Label>İşten Çık.Tar.</Label><Input type="date" value={form.endDate} onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Cinsiyeti</Label><Select value={form.gender || "EMPTY"} onValueChange={(value) => setForm((prev) => ({ ...prev, gender: value === "EMPTY" ? "" : value }))}><SelectTrigger><SelectValue placeholder="Cinsiyet seçin" /></SelectTrigger><SelectContent><SelectItem value="EMPTY">Belirtilmedi</SelectItem><SelectItem value="Erkek">Erkek</SelectItem><SelectItem value="Kadın">Kadın</SelectItem><SelectItem value="Diğer">Diğer</SelectItem></SelectContent></Select></div>
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


