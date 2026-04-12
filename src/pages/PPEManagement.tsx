import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Boxes,
  ExternalLink,
  PackageCheck,
  RefreshCcw,
  RotateCcw,
  Search,
  Shield,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessRole } from "@/hooks/useAccessRole";
import { downloadCsv } from "@/lib/csvExport";
import { readPageSessionCache, writePageSessionCache } from "@/lib/pageSessionCache";
import {
  buildPpeEmployeeOverview,
  createPpeRenewalTasks,
  deletePpeAssignment,
  deletePpeInventory,
  listPpeAssignments,
  listPpeEmployeeOptions,
  listPpeInventory,
  listPpeAssignmentsPage,
  listPpeInventoryOptions,
  listPpeInventoryPage,
  markPpeAssignmentReturned,
  upsertPpeAssignment,
  upsertPpeInventory,
  type PpeAssignmentInput,
  type PpeAssignmentRecord,
  type PpeEmployeeOption,
  type PpeInventoryOption,
  type PpeInventoryInput,
  type PpeInventoryRecord,
} from "@/lib/ppeOperations";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type InventoryFormState = {
  itemName: string;
  category: string;
  standardCode: string;
  defaultRenewalDays: string;
  stockQuantity: string;
  minStockLevel: string;
  isActive: boolean;
  notes: string;
};

type AssignmentFormState = {
  inventoryId: string;
  employeeId: string;
  assignedDate: string;
  dueDate: string;
  status: "assigned" | "replacement_due" | "returned";
  quantity: string;
  sizeLabel: string;
  notes: string;
};

const emptyInventoryForm: InventoryFormState = {
  itemName: "",
  category: "",
  standardCode: "",
  defaultRenewalDays: "365",
  stockQuantity: "0",
  minStockLevel: "0",
  isActive: true,
  notes: "",
};

const emptyAssignmentForm: AssignmentFormState = {
  inventoryId: "",
  employeeId: "",
  assignedDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  status: "assigned",
  quantity: "1",
  sizeLabel: "",
  notes: "",
};

const PPE_CACHE_TTL = 5 * 60 * 1000;
const PPE_ASSIGNMENT_PAGE_SIZE = 10;
const PPE_INVENTORY_PAGE_SIZE = 10;
const PPE_EMPLOYEE_PAGE_SIZE = 8;

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString("tr-TR") : "-");

export default function PPEManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canManage, isViewer } = useAccessRole();
  const [inventory, setInventory] = useState<PpeInventoryRecord[]>([]);
  const [assignments, setAssignments] = useState<PpeAssignmentRecord[]>([]);
  const [employees, setEmployees] = useState<PpeEmployeeOption[]>([]);
  const [inventoryOptions, setInventoryOptions] = useState<PpeInventoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("ALL");
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<PpeInventoryRecord | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<PpeAssignmentRecord | null>(null);
  const [inventoryForm, setInventoryForm] = useState<InventoryFormState>(emptyInventoryForm);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>(emptyAssignmentForm);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [employeePage, setEmployeePage] = useState(1);
  const [assignmentTotalCount, setAssignmentTotalCount] = useState(0);
  const [inventoryTotalCount, setInventoryTotalCount] = useState(0);

  const loadData = async () => {
    if (!user?.id) return;

    const cacheKey = `ppe:${user.id}`;
    const cached = readPageSessionCache<{
      inventory: PpeInventoryRecord[];
      assignments: PpeAssignmentRecord[];
      employees: PpeEmployeeOption[];
      inventoryOptions: PpeInventoryOption[];
      assignmentTotalCount: number;
      inventoryTotalCount: number;
    }>(cacheKey, PPE_CACHE_TTL);

    if (cached) {
      setInventory(cached.inventory);
      setAssignments(cached.assignments);
      setEmployees(cached.employees);
      setInventoryOptions(cached.inventoryOptions);
      setAssignmentTotalCount(cached.assignmentTotalCount);
      setInventoryTotalCount(cached.inventoryTotalCount);
      setError(null);
      setLoading(false);
    }

    setLoading(true);
    try {
      const [inventoryRows, assignmentRows, employeeRows, inventoryOptionRows] = await Promise.all([
        listPpeInventoryPage(user.id, {
          page: inventoryPage,
          pageSize: PPE_INVENTORY_PAGE_SIZE,
          search,
        }),
        listPpeAssignmentsPage(user.id, {
          page: assignmentPage,
          pageSize: PPE_ASSIGNMENT_PAGE_SIZE,
          employeeId: employeeFilter,
        }),
        listPpeEmployeeOptions(),
        listPpeInventoryOptions(user.id),
      ]);

      setInventory(inventoryRows.rows);
      setAssignments(assignmentRows.rows);
      setEmployees(employeeRows);
      setInventoryOptions(inventoryOptionRows);
      setAssignmentTotalCount(assignmentRows.count);
      setInventoryTotalCount(inventoryRows.count);
      setError(null);
      writePageSessionCache(cacheKey, {
        inventory: inventoryRows.rows,
        assignments: assignmentRows.rows,
        employees: employeeRows,
        inventoryOptions: inventoryOptionRows,
        assignmentTotalCount: assignmentRows.count,
        inventoryTotalCount: inventoryRows.count,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "KKD verileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user?.id, search, employeeFilter, assignmentPage, inventoryPage]);

  const inventoryMap = useMemo(
    () =>
      new Map(
        inventoryOptions.map((item) => [
          item.id,
          {
            item_name: item.itemName,
            default_renewal_days: item.defaultRenewalDays,
            is_active: item.isActive,
          },
        ]),
      ),
    [inventoryOptions],
  );
  const employeeMap = useMemo(() => new Map(employees.map((item) => [item.id, item])), [employees]);

  const summary = useMemo(() => {
    const today = new Date();
    const nextThirtyDays = new Date();
    nextThirtyDays.setDate(today.getDate() + 30);
    const activeAssignments = assignments.filter((item) => item.status !== "returned");

    return {
      inventoryCount: inventory.filter((item) => item.is_active).length,
      activeAssignments: activeAssignments.length,
      renewalDue: activeAssignments.filter((item) => {
        const due = new Date(item.due_date);
        return due >= today && due <= nextThirtyDays;
      }).length,
      overdue: activeAssignments.filter((item) => new Date(item.due_date) < today).length,
      lowStock: inventory.filter((item) => item.is_active && item.stock_quantity <= item.min_stock_level).length,
    };
  }, [assignments, inventory]);

  const employeeOverview = useMemo(
    () => buildPpeEmployeeOverview(employees, inventory, assignments),
    [employees, inventory, assignments],
  );
  const filteredEmployeeOverview = useMemo(
    () => employeeOverview.filter((item) => employeeFilter === "ALL" || item.employeeId === employeeFilter),
    [employeeFilter, employeeOverview],
  );
  const assignmentTotalPages = Math.max(1, Math.ceil(assignmentTotalCount / PPE_ASSIGNMENT_PAGE_SIZE));
  const inventoryTotalPages = Math.max(1, Math.ceil(inventoryTotalCount / PPE_INVENTORY_PAGE_SIZE));
  const employeeTotalPages = Math.max(1, Math.ceil(filteredEmployeeOverview.length / PPE_EMPLOYEE_PAGE_SIZE));
  const pagedEmployeeOverview = useMemo(
    () => filteredEmployeeOverview.slice((employeePage - 1) * PPE_EMPLOYEE_PAGE_SIZE, employeePage * PPE_EMPLOYEE_PAGE_SIZE),
    [employeePage, filteredEmployeeOverview],
  );

  useEffect(() => {
    setAssignmentPage(1);
    setInventoryPage(1);
    setEmployeePage(1);
  }, [search, employeeFilter]);

  useEffect(() => {
    if (assignmentPage > assignmentTotalPages) setAssignmentPage(assignmentTotalPages);
  }, [assignmentPage, assignmentTotalPages]);

  useEffect(() => {
    if (inventoryPage > inventoryTotalPages) setInventoryPage(inventoryTotalPages);
  }, [inventoryPage, inventoryTotalPages]);

  useEffect(() => {
    if (employeePage > employeeTotalPages) setEmployeePage(employeeTotalPages);
  }, [employeePage, employeeTotalPages]);

  const openInventoryCreate = () => {
    if (!canManage) return toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
    setEditingInventory(null);
    setInventoryForm(emptyInventoryForm);
    setInventoryDialogOpen(true);
  };

  const openInventoryEdit = (item: PpeInventoryRecord) => {
    if (!canManage) return toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
    setEditingInventory(item);
    setInventoryForm({
      itemName: item.item_name,
      category: item.category,
      standardCode: item.standard_code || "",
      defaultRenewalDays: String(item.default_renewal_days),
      stockQuantity: String(item.stock_quantity),
      minStockLevel: String(item.min_stock_level),
      isActive: item.is_active,
      notes: item.notes || "",
    });
    setInventoryDialogOpen(true);
  };

  const openAssignmentCreate = () => {
    if (!canManage) return toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
    setEditingAssignment(null);
    setAssignmentForm(emptyAssignmentForm);
    setAssignmentDialogOpen(true);
  };

  const openAssignmentEdit = (item: PpeAssignmentRecord) => {
    if (!canManage) return toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
    setEditingAssignment(item);
    setAssignmentForm({
      inventoryId: item.inventory_id,
      employeeId: item.employee_id,
      assignedDate: item.assigned_date,
      dueDate: item.due_date,
      status: item.status,
      quantity: String(item.quantity),
      sizeLabel: item.size_label || "",
      notes: item.notes || "",
    });
    setAssignmentDialogOpen(true);
  };

  const handleInventorySave = async () => {
    if (!user?.id) return;
    const defaultRenewalDays = Number(inventoryForm.defaultRenewalDays);
    const stockQuantity = Number(inventoryForm.stockQuantity);
    const minStockLevel = Number(inventoryForm.minStockLevel);

    if (!inventoryForm.itemName.trim() || !inventoryForm.category.trim()) {
      return toast.error("KKD adı ve kategori zorunludur.");
    }
    if (defaultRenewalDays <= 0 || stockQuantity < 0 || minStockLevel < 0) {
      return toast.error("Süre ve stok alanları geçerli olmalıdır.");
    }

    setSaving(true);
    try {
      const payload: PpeInventoryInput = {
        itemName: inventoryForm.itemName,
        category: inventoryForm.category,
        standardCode: inventoryForm.standardCode,
        defaultRenewalDays,
        stockQuantity,
        minStockLevel,
        isActive: inventoryForm.isActive,
        notes: inventoryForm.notes,
      };
      const saved = await upsertPpeInventory(user.id, payload, editingInventory?.id);
      setInventory((prev) => (editingInventory ? prev.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...prev]));
      setInventoryDialogOpen(false);
      toast.success(editingInventory ? "KKD kaydı güncellendi." : "KKD kaydı eklendi.");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "KKD kaydı kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignmentSave = async () => {
    if (!user?.id) return;
    const quantity = Number(assignmentForm.quantity);
    const employee = employeeMap.get(assignmentForm.employeeId);

    if (!assignmentForm.inventoryId || !assignmentForm.employeeId || !assignmentForm.dueDate) {
      return toast.error("Zimmet için ekipman, çalışan ve yenileme tarihi zorunludur.");
    }
    if (quantity <= 0) return toast.error("Adet 1 veya daha büyük olmalıdır.");
    if (new Date(assignmentForm.dueDate) < new Date(assignmentForm.assignedDate)) {
      return toast.error("Yenileme tarihi zimmet tarihinden önce olamaz.");
    }

    setSaving(true);
    try {
      const payload: PpeAssignmentInput = {
        inventoryId: assignmentForm.inventoryId,
        employeeId: assignmentForm.employeeId,
        companyId: employee?.companyId || null,
        assignedDate: assignmentForm.assignedDate,
        dueDate: assignmentForm.dueDate,
        status: assignmentForm.status,
        quantity,
        sizeLabel: assignmentForm.sizeLabel,
        notes: assignmentForm.notes,
        returnDate: assignmentForm.status === "returned" ? new Date().toISOString().slice(0, 10) : null,
      };
      const saved = await upsertPpeAssignment(user.id, payload, editingAssignment?.id);
      setAssignments((prev) => (editingAssignment ? prev.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...prev]));
      setAssignmentDialogOpen(false);
      toast.success(editingAssignment ? "Zimmet güncellendi." : "Zimmet kaydedildi.");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Zimmet kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleInventoryDelete = async (item: PpeInventoryRecord) => {
    if (!canManage) return toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
    if (!confirm(`"${item.item_name}" kaydı silinsin mi?`)) return;
    await deletePpeInventory(item.id);
    setInventory((prev) => prev.filter((row) => row.id !== item.id));
    setAssignments((prev) => prev.filter((row) => row.inventory_id !== item.id));
    toast.success("KKD kaydı silindi.");
  };

  const handleAssignmentDelete = async (item: PpeAssignmentRecord) => {
    if (!canManage) return toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
    if (!confirm("Bu zimmet kaydı silinsin mi?")) return;
    await deletePpeAssignment(item.id);
    setAssignments((prev) => prev.filter((row) => row.id !== item.id));
    toast.success("Zimmet kaydı silindi.");
  };

  const handleMarkReturned = async (item: PpeAssignmentRecord) => {
    if (!canManage) return toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
    const saved = await markPpeAssignmentReturned(item.id);
    setAssignments((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
    toast.success("KKD iade edildi.");
  };

  const handleExport = () => {
    downloadCsv(
      "kkd-zimmet.csv",
      ["Çalışan", "Firma", "KKD", "Durum", "Yenileme Tarihi"],
          assignments.map((item) => [
        employeeMap.get(item.employee_id)?.fullName || "",
        employeeMap.get(item.employee_id)?.companyName || "",
        inventoryMap.get(item.inventory_id)?.item_name || "",
        item.status,
        item.due_date,
      ]),
    );
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">KKD Zimmet Merkezi</h1>
              <p className="text-sm text-slate-400">KKD envanteri, yenileme takibi ve çalışan bazlı zimmet görünümü tek ekranda yönetilir.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExport}>Dışa Aktar</Button>
          <Button variant="outline" className="gap-2" onClick={() => void loadData()}><RefreshCcw className="h-4 w-4" />Yenile</Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate("/employees")}><ExternalLink className="h-4 w-4" />Çalışan Ekranı</Button>
          <Button className="gap-2" onClick={openInventoryCreate} disabled={!canManage}><Boxes className="h-4 w-4" />Yeni KKD</Button>
          <Button className="gap-2" onClick={openAssignmentCreate} disabled={!canManage}><PackageCheck className="h-4 w-4" />Yeni Zimmet</Button>
        </div>
      </div>

      {isViewer && <Alert className="border-slate-700 bg-slate-900/60 text-slate-100"><AlertTriangle className="h-4 w-4" /><AlertTitle>Görüntüleme yetkisi</AlertTitle><AlertDescription>Bu rolde kayıtları inceleyebilirsiniz; düzenleme işlemleri kapalıdır.</AlertDescription></Alert>}
      {error && <Alert className="border-red-500/20 bg-red-500/10 text-red-100"><AlertTriangle className="h-4 w-4" /><AlertTitle>KKD verisi yüklenemedi</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="border-slate-800 bg-slate-950/60"><CardHeader className="pb-2"><CardDescription>Aktif envanter</CardDescription><CardTitle className="text-3xl text-white">{summary.inventoryCount}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-950/60"><CardHeader className="pb-2"><CardDescription>Aktif zimmet</CardDescription><CardTitle className="text-3xl text-white">{summary.activeAssignments}</CardTitle></CardHeader></Card>
        <Card className="border-amber-500/20 bg-amber-500/5"><CardHeader className="pb-2"><CardDescription>30 gün içinde yenileme</CardDescription><CardTitle className="text-3xl text-white">{summary.renewalDue}</CardTitle></CardHeader></Card>
        <Card className="border-red-500/20 bg-red-500/5"><CardHeader className="pb-2"><CardDescription>Süresi geçen</CardDescription><CardTitle className="text-3xl text-white">{summary.overdue}</CardTitle></CardHeader></Card>
        <Card className="border-orange-500/20 bg-orange-500/5"><CardHeader className="pb-2"><CardDescription>Düşük stok</CardDescription><CardTitle className="text-3xl text-white">{summary.lowStock}</CardTitle></CardHeader></Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="KKD, çalışan veya firma ile ara" /></div>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}><SelectTrigger><SelectValue placeholder="Çalışan filtrele" /></SelectTrigger><SelectContent><SelectItem value="ALL">Tüm çalışanlar</SelectItem>{employees.map((item) => <SelectItem key={item.id} value={item.id}>{item.fullName}</SelectItem>)}</SelectContent></Select>
      </div>

      <Tabs defaultValue="assignments" className="space-y-4">
        <TabsList className="h-auto w-full justify-start rounded-xl bg-slate-900/70 p-1">
          <TabsTrigger value="assignments">Zimmetler</TabsTrigger>
          <TabsTrigger value="inventory">Envanter</TabsTrigger>
          <TabsTrigger value="employees">Çalışan Bazlı Görünüm</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="mt-0">
          <Card className="border-slate-800 bg-slate-950/60">
            <CardHeader><CardTitle className="text-white">Aktif Zimmetler</CardTitle><CardDescription>Yenileme, gecikme ve iade akışını bu listeden yönetin.</CardDescription></CardHeader>
            <CardContent><div className="rounded-2xl border border-slate-800"><Table><TableHeader><TableRow><TableHead>Çalışan</TableHead><TableHead>KKD</TableHead><TableHead>Durum</TableHead><TableHead>Yenileme</TableHead><TableHead className="text-right">İşlem</TableHead></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={5} className="py-12 text-center text-sm text-slate-400">Zimmet kayıtları yükleniyor...</TableCell></TableRow> : assignments.length === 0 ? <TableRow><TableCell colSpan={5} className="py-12 text-center text-sm text-slate-400">Zimmet kaydı bulunamadı.</TableCell></TableRow> : assignments.map((item) => { const employee = employeeMap.get(item.employee_id); const inventoryItem = inventoryMap.get(item.inventory_id); const overdue = item.status !== "returned" && new Date(item.due_date) < new Date(); return <TableRow key={item.id}><TableCell><div><p className="font-medium text-white">{employee?.fullName || "-"}</p><p className="text-xs text-slate-400">{employee?.companyName || "Firma yok"}</p></div></TableCell><TableCell><div><p className="font-medium text-white">{inventoryItem?.item_name || "-"}</p><p className="text-xs text-slate-400">{item.size_label || "Beden yok"} • {item.quantity} adet</p></div></TableCell><TableCell><Badge className={overdue ? "border-red-500/20 bg-red-500/10 text-red-200" : "border-slate-700 bg-slate-900 text-slate-100"}>{overdue ? "Süresi geçti" : item.status === "returned" ? "İade edildi" : item.status === "replacement_due" ? "Yenileme bekliyor" : "Zimmetli"}</Badge></TableCell><TableCell>{formatDate(item.due_date)}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2">{canManage && item.status !== "returned" && <Button variant="outline" size="sm" onClick={() => void handleMarkReturned(item)}><RotateCcw className="h-4 w-4" /></Button>}<Button variant="outline" size="sm" onClick={() => openAssignmentEdit(item)} disabled={!canManage}>Düzenle</Button>{canManage && <Button variant="outline" size="sm" className="text-red-300" onClick={() => void handleAssignmentDelete(item)}>Sil</Button>}</div></TableCell></TableRow>; })}</TableBody></Table></div>{assignmentTotalCount > PPE_ASSIGNMENT_PAGE_SIZE ? <div className="mt-4 flex items-center justify-between text-sm text-slate-400"><span>Sayfa {assignmentPage} / {assignmentTotalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setAssignmentPage((page) => Math.max(1, page - 1))} disabled={assignmentPage === 1}>Önceki</Button><Button variant="outline" size="sm" onClick={() => setAssignmentPage((page) => Math.min(assignmentTotalPages, page + 1))} disabled={assignmentPage === assignmentTotalPages}>Sonraki</Button></div></div> : null}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="mt-0">
          <Card className="border-slate-800 bg-slate-950/60">
            <CardHeader><CardTitle className="text-white">KKD Envanteri</CardTitle><CardDescription>Stok miktarı, minimum eşik ve yenileme standardını izleyin.</CardDescription></CardHeader>
            <CardContent><div className="rounded-2xl border border-slate-800"><Table><TableHeader><TableRow><TableHead>KKD</TableHead><TableHead>Standart</TableHead><TableHead>Stok</TableHead><TableHead>Yenileme</TableHead><TableHead className="text-right">İşlem</TableHead></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={5} className="py-12 text-center text-sm text-slate-400">Envanter yükleniyor...</TableCell></TableRow> : inventory.length === 0 ? <TableRow><TableCell colSpan={5} className="py-12 text-center text-sm text-slate-400">KKD envanteri boş.</TableCell></TableRow> : inventory.map((item) => <TableRow key={item.id}><TableCell><div><p className="font-medium text-white">{item.item_name}</p><p className="text-xs text-slate-400">{item.category}</p></div></TableCell><TableCell>{item.standard_code || "-"}</TableCell><TableCell><div><p className="font-medium text-white">{item.stock_quantity}</p><p className="text-xs text-slate-400">Minimum: {item.min_stock_level}</p></div></TableCell><TableCell>{item.default_renewal_days} gün</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => openInventoryEdit(item)} disabled={!canManage}>Düzenle</Button>{canManage && <Button variant="outline" size="sm" className="text-red-300" onClick={() => void handleInventoryDelete(item)}>Sil</Button>}</div></TableCell></TableRow>)}</TableBody></Table></div>{inventoryTotalCount > PPE_INVENTORY_PAGE_SIZE ? <div className="mt-4 flex items-center justify-between text-sm text-slate-400"><span>Sayfa {inventoryPage} / {inventoryTotalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setInventoryPage((page) => Math.max(1, page - 1))} disabled={inventoryPage === 1}>Önceki</Button><Button variant="outline" size="sm" onClick={() => setInventoryPage((page) => Math.min(inventoryTotalPages, page + 1))} disabled={inventoryPage === inventoryTotalPages}>Sonraki</Button></div></div> : null}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="mt-0">
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredEmployeeOverview.length === 0 ? (
              <Card className="border-slate-800 bg-slate-950/60 lg:col-span-2"><CardContent className="py-12 text-center text-sm text-slate-400">Çalışan kaydı veya KKD zimmeti bulunamadı.</CardContent></Card>
            ) : pagedEmployeeOverview.map((item) => (
              <Card key={item.employeeId} className="border-slate-800 bg-slate-950/60">
                <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-white"><UserRound className="h-4 w-4" />{item.employeeName}</CardTitle><CardDescription>{item.companyName || "Firma yok"}{item.department ? ` • ${item.department}` : ""}</CardDescription></div><div className="flex flex-wrap gap-2"><Badge variant="outline">{item.activeAssignments} aktif zimmet</Badge>{item.overdueCount > 0 && <Badge className="border-red-500/20 bg-red-500/10 text-red-200">{item.overdueCount} gecikmiş</Badge>}{item.renewalDueCount > 0 && <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-200">{item.renewalDueCount} yaklaşan</Badge>}</div></div></CardHeader>
                <CardContent className="space-y-3">{item.items.length === 0 ? <div className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">Aktif KKD zimmeti yok.</div> : item.items.map((ppeItem) => <div key={ppeItem.assignmentId} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3"><div><p className="font-medium text-white">{ppeItem.itemName}</p><p className="text-xs text-slate-400">{ppeItem.quantity} adet • {formatDate(ppeItem.dueDate)}</p></div><Badge className={new Date(ppeItem.dueDate) < new Date() ? "border-red-500/20 bg-red-500/10 text-red-200" : "border-slate-700 bg-slate-900 text-slate-100"}>{new Date(ppeItem.dueDate) < new Date() ? "Gecikmiş" : "Aktif"}</Badge></div>)}</CardContent>
              </Card>
            ))}{filteredEmployeeOverview.length > PPE_EMPLOYEE_PAGE_SIZE ? <div className="lg:col-span-2 flex items-center justify-between text-sm text-slate-400"><span>Sayfa {employeePage} / {employeeTotalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setEmployeePage((page) => Math.max(1, page - 1))} disabled={employeePage === 1}>Önceki</Button><Button variant="outline" size="sm" onClick={() => setEmployeePage((page) => Math.min(employeeTotalPages, page + 1))} disabled={employeePage === employeeTotalPages}>Sonraki</Button></div></div> : null}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={inventoryDialogOpen} onOpenChange={setInventoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingInventory ? "KKD Kaydını Düzenle" : "Yeni KKD Kaydı"}</DialogTitle><DialogDescription>Envanter bilgisi, stok seviyesi ve yenileme standardını tanımlayın.</DialogDescription></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>KKD adı</Label><Input value={inventoryForm.itemName} onChange={(e) => setInventoryForm((p) => ({ ...p, itemName: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Kategori</Label><Input value={inventoryForm.category} onChange={(e) => setInventoryForm((p) => ({ ...p, category: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Standart kodu</Label><Input value={inventoryForm.standardCode} onChange={(e) => setInventoryForm((p) => ({ ...p, standardCode: e.target.value }))} placeholder="EN 397" /></div>
            <div className="space-y-2"><Label>Varsayılan yenileme süresi (gün)</Label><Input type="number" min="1" value={inventoryForm.defaultRenewalDays} onChange={(e) => setInventoryForm((p) => ({ ...p, defaultRenewalDays: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Stok</Label><Input type="number" min="0" value={inventoryForm.stockQuantity} onChange={(e) => setInventoryForm((p) => ({ ...p, stockQuantity: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Minimum stok</Label><Input type="number" min="0" value={inventoryForm.minStockLevel} onChange={(e) => setInventoryForm((p) => ({ ...p, minStockLevel: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Notlar</Label><Textarea value={inventoryForm.notes} onChange={(e) => setInventoryForm((p) => ({ ...p, notes: e.target.value }))} className="min-h-20" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setInventoryDialogOpen(false)}>Vazgeç</Button><Button onClick={() => void handleInventorySave()} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingAssignment ? "KKD Zimmetini Düzenle" : "Yeni KKD Zimmeti"}</DialogTitle><DialogDescription>Çalışana teslim edilen KKD kaydını oluşturun veya güncelleyin.</DialogDescription></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>KKD</Label><Select value={assignmentForm.inventoryId} onValueChange={(value) => { const item = inventoryMap.get(value); const assigned = assignmentForm.assignedDate || new Date().toISOString().slice(0, 10); const suggestedDue = item ? new Date(new Date(assigned).getTime() + item.default_renewal_days * 86400000).toISOString().slice(0, 10) : ""; setAssignmentForm((prev) => ({ ...prev, inventoryId: value, dueDate: prev.dueDate || suggestedDue })); }}><SelectTrigger><SelectValue placeholder="KKD seçin" /></SelectTrigger><SelectContent>{inventoryOptions.filter((item) => item.isActive).map((item) => <SelectItem key={item.id} value={item.id}>{item.itemName}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Çalışan</Label><Select value={assignmentForm.employeeId} onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, employeeId: value }))}><SelectTrigger><SelectValue placeholder="Çalışan seçin" /></SelectTrigger><SelectContent>{employees.filter((item) => item.isActive).map((item) => <SelectItem key={item.id} value={item.id}>{item.fullName} • {item.companyName || "Firma yok"}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Zimmet tarihi</Label><Input type="date" value={assignmentForm.assignedDate} onChange={(e) => setAssignmentForm((p) => ({ ...p, assignedDate: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Yenileme tarihi</Label><Input type="date" value={assignmentForm.dueDate} onChange={(e) => setAssignmentForm((p) => ({ ...p, dueDate: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Durum</Label><Select value={assignmentForm.status} onValueChange={(value) => setAssignmentForm((p) => ({ ...p, status: value as AssignmentFormState["status"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="assigned">Zimmetli</SelectItem><SelectItem value="replacement_due">Yenileme bekliyor</SelectItem><SelectItem value="returned">İade edildi</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Adet</Label><Input type="number" min="1" value={assignmentForm.quantity} onChange={(e) => setAssignmentForm((p) => ({ ...p, quantity: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Beden / varyant</Label><Input value={assignmentForm.sizeLabel} onChange={(e) => setAssignmentForm((p) => ({ ...p, sizeLabel: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Notlar</Label><Textarea value={assignmentForm.notes} onChange={(e) => setAssignmentForm((p) => ({ ...p, notes: e.target.value }))} className="min-h-20" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAssignmentDialogOpen(false)}>Vazgeç</Button><Button onClick={() => void handleAssignmentSave()} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
