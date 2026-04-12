// src/components/adep/ADEPChecklistsTab.tsx

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  ClipboardCheck,
  Loader2,
  Trash2,
  Edit,
  Download,
  Upload,
  FileSpreadsheet,
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import { format, parseISO, isBefore } from "date-fns";
import AIGenerateButton from "@/components/adep/AIGenerateButton";
import type { Checklist } from "@/types/adep-ai";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface ADEPChecklistsTabProps {
  planId: string | undefined;
}

type ChecklistStatus = "pending" | "checked" | "issue_found";

interface ParsedChecklist {
  checklist_category: string;
  checklist_item: string;
  check_frequency: string;
  responsible_role: string;
  last_checked_date: string | null;
  next_check_date: string | null;
  status: ChecklistStatus;
  notes: string | null;
  isValid: boolean;
  errors: string[];
}

export default function ADEPChecklistsTab({ planId }: ADEPChecklistsTabProps) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Checklist | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<ParsedChecklist[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [formData, setFormData] = useState({
    checklist_category: "Yangın",
    checklist_item: "",
    check_frequency: "Aylık",
    responsible_role: "",
    last_checked_date: "",
    next_check_date: "",
    status: "pending" as ChecklistStatus,
    notes: "",
  });

  useEffect(() => {
    if (planId) {
      fetchChecklists();
    }
  }, [planId]);

  const fetchChecklists = async () => {
    if (!planId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("adep_checklists")
        .select("*")
        .eq("plan_id", planId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChecklists((data || []) as Checklist[]);
    } catch (error: any) {
      console.error("Fetch error:", error);
      toast.error("Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.checklist_item.trim()) {
      toast.error("Kontrol maddesi zorunludur");
      return false;
    }
    if (!formData.responsible_role.trim()) {
      toast.error("Sorumlu rol zorunludur");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!planId || !validateForm()) return;

    setSaving(true);
    try {
      const payload = {
        plan_id: planId,
        checklist_category: formData.checklist_category,
        checklist_item: formData.checklist_item,
        check_frequency: formData.check_frequency,
        responsible_role: formData.responsible_role,
        last_checked_date: formData.last_checked_date || null,
        next_check_date: formData.next_check_date || null,
        status: formData.status,
        notes: formData.notes || null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("adep_checklists")
          .update(payload)
          .eq("id", editingItem.id);

        if (error) throw error;
        toast.success("Checklist güncellendi");
      } else {
        const { error } = await supabase
          .from("adep_checklists")
          .insert([payload]);

        if (error) throw error;
        toast.success("Checklist eklendi");
      }

      setManualDialogOpen(false);
      resetForm();
      fetchChecklists();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error("Kaydetme hatası", {
        description: error.message || "Bilinmeyen hata",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: Checklist) => {
    setEditingItem(item);
    setFormData({
      checklist_category: item.checklist_category,
      checklist_item: item.checklist_item,
      check_frequency: item.check_frequency,
      responsible_role: item.responsible_role,
      last_checked_date: item.last_checked_date || "",
      next_check_date: item.next_check_date || "",
      status: item.status,
      notes: item.notes || "",
    });
    setManualDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu checklist maddesini silmek istediğinizden emin misiniz?"))
      return;

    try {
      const { error } = await supabase
        .from("adep_checklists")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Checklist silindi");
      fetchChecklists();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Silme hatası");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (
      !confirm(
        `${selectedItems.length} checklist maddesini silmek istediğinizden emin misiniz?`
      )
    )
      return;

    try {
      const { error } = await supabase
        .from("adep_checklists")
        .delete()
        .in("id", selectedItems);

      if (error) throw error;
      toast.success(`${selectedItems.length} checklist silindi`);
      setSelectedItems([]);
      fetchChecklists();
    } catch (error: any) {
      console.error("Bulk delete error:", error);
      toast.error("Toplu silme hatası");
    }
  };

  const resetForm = () => {
    setFormData({
      checklist_category: "Yangın",
      checklist_item: "",
      check_frequency: "Aylık",
      responsible_role: "",
      last_checked_date: "",
      next_check_date: "",
      status: "pending",
      notes: "",
    });
    setEditingItem(null);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const parsed = parseExcelData(jsonData);
        setParsedData(parsed);

        toast.success(`${parsed.length} satır yüklendi`);
      } catch (error) {
        console.error("Parse error:", error);
        toast.error("Dosya parse edilemedi");
      }
    };

    reader.readAsArrayBuffer(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  });

  const parseExcelData = (data: any[]): ParsedChecklist[] => {
    return data.map((row) => {
      const errors: string[] = [];
      let isValid = true;

      const checklist_category = String(
        row["Kategori"] || row.checklist_category || "Yangın"
      );
      const checklist_item = String(
        row["Kontrol Maddesi"] || row.checklist_item || ""
      ).trim();
      const check_frequency = String(
        row["Periyot"] || row.check_frequency || "Aylık"
      );
      const responsible_role = String(
        row["Sorumlu Rol"] || row.responsible_role || ""
      ).trim();
      const last_checked_date =
        row["Son Kontrol"] || row.last_checked_date || null;
      const next_check_date =
        row["Sonraki Kontrol"] || row.next_check_date || null;
      const status = (row["Durum"] || row.status || "pending") as ChecklistStatus;
      const notes = String(row["Notlar"] || row.notes || "").trim() || null;

      if (!checklist_item) {
        errors.push("Kontrol maddesi boş olamaz");
        isValid = false;
      }

      if (!responsible_role) {
        errors.push("Sorumlu rol boş olamaz");
        isValid = false;
      }

      return {
        checklist_category,
        checklist_item,
        check_frequency,
        responsible_role,
        last_checked_date,
        next_check_date,
        status,
        notes,
        isValid,
        errors,
      };
    });
  };

  const handleBulkInsert = async () => {
    if (!planId) return;

    const validItems = parsedData.filter((p) => p.isValid);

    if (validItems.length === 0) {
      toast.error("Eklenecek geçerli satır yok");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const chunkSize = 100;
      let successCount = 0;

      for (let i = 0; i < validItems.length; i += chunkSize) {
        const chunk = validItems.slice(i, i + chunkSize);

        const payload = chunk.map((item) => ({
          plan_id: planId,
          checklist_category: item.checklist_category,
          checklist_item: item.checklist_item,
          check_frequency: item.check_frequency,
          responsible_role: item.responsible_role,
          last_checked_date: item.last_checked_date,
          next_check_date: item.next_check_date,
          status: item.status,
          notes: item.notes,
        }));

        const { error } = await supabase.from("adep_checklists").insert(payload);

        if (error) {
          console.error("Chunk insert error:", error);
        } else {
          successCount += chunk.length;
        }

        setUploadProgress(
          Math.round(((i + chunk.length) / validItems.length) * 100)
        );
      }

      toast.success(`${successCount} checklist eklendi`);

      setUploadDialogOpen(false);
      setParsedData([]);
      fetchChecklists();
    } catch (error: any) {
      console.error("Bulk insert error:", error);
      toast.error("Toplu ekleme hatası", {
        description: error.message || "Bilinmeyen hata",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        Kategori: "Yangın",
        "Kontrol Maddesi": "Yangın söndürücülerin kontrol edilmesi",
        Periyot: "Aylık",
        "Sorumlu Rol": "İSG Uzmanı",
        "Son Kontrol": "2025-02-01",
        "Sonraki Kontrol": "2025-03-01",
        Durum: "pending",
        Notlar: "Tüm cihazlar kontrol edilecek",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Checklist Şablonu");
    XLSX.writeFile(wb, "checklist_sablonu.xlsx");
    toast.success("Şablon indirildi");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; color: string }> = {
      pending: { label: "Bekliyor", color: "bg-yellow-500" },
      checked: { label: "Kontrol Edildi", color: "bg-green-500" },
      issue_found: { label: "Sorun Var", color: "bg-red-500" },
    };

    const variant = variants[status] || variants.pending;

    return (
      <Badge className={`${variant.color} text-white`}>{variant.label}</Badge>
    );
  };

  const isOverdue = (date: string | null): boolean => {
    if (!date) return false;
    try {
      return isBefore(parseISO(date), new Date());
    } catch {
      return false;
    }
  };

  const filteredChecklists = checklists.filter((item) => {
    const matchesSearch =
      item.checklist_item.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.responsible_role.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || item.checklist_category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const stats = {
    total: checklists.length,
    pending: checklists.filter((c) => c.status === "pending").length,
    checked: checklists.filter((c) => c.status === "checked").length,
    overdue: checklists.filter((c) => isOverdue(c.next_check_date)).length,
  };

  if (!planId) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">
            Önce planı kaydedin
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold">Periyodik Kontrol Checklist</h3>
          <p className="text-sm text-muted-foreground">
            Düzenli kontrol edilmesi gereken maddeler - Enterprise yönetim
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <AIGenerateButton
            planId={planId}
            module="checklist"
            onSuccess={fetchChecklists}
            disabled={loading}
          />

          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Toplu Yükle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Excel/CSV ile Toplu Checklist Yükleme</DialogTitle>
                <DialogDescription>
                  Kontrol listelerini toplu yükleyin
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <Alert>
                  <FileSpreadsheet className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <span>Önce örnek şablonu indirin</span>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={downloadTemplate}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Şablon İndir
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>

                {parsedData.length === 0 && (
                  <div
                    {...getRootProps()}
                    className={[
                      "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition",
                      isDragActive
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50",
                    ].join(" ")}
                  >
                    <input {...getInputProps()} />
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    {isDragActive ? (
                      <p className="text-lg font-semibold">
                        Dosyayı buraya bırakın...
                      </p>
                    ) : (
                      <>
                        <p className="text-lg font-semibold mb-2">
                          Excel veya CSV dosyasını sürükleyin
                        </p>
                        <p className="text-sm text-muted-foreground">
                          veya dosya seçmek için tıklayın
                        </p>
                      </>
                    )}
                  </div>
                )}

                {parsedData.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">
                          Toplam: {parsedData.length} satır
                        </p>
                        <div className="flex gap-4 text-xs">
                          <span className="text-green-600">
                            <CheckCircle2 className="h-3 w-3 inline mr-1" />
                            Geçerli:{" "}
                            {parsedData.filter((p) => p.isValid).length}
                          </span>
                          <span className="text-red-600">
                            <AlertCircle className="h-3 w-3 inline mr-1" />
                            Hatalı:{" "}
                            {parsedData.filter((p) => !p.isValid).length}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setParsedData([])}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Temizle
                      </Button>
                    </div>

                    <div className="border rounded-lg max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Durum</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead>Kontrol Maddesi</TableHead>
                            <TableHead>Sorumlu</TableHead>
                            <TableHead>Hatalar</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedData.map((item, idx) => (
                            <TableRow
                              key={idx}
                              className={
                                item.isValid
                                  ? ""
                                  : "bg-red-50 dark:bg-red-950/20"
                              }
                            >
                              <TableCell>
                                {item.isValid ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-red-500" />
                                )}
                              </TableCell>
                              <TableCell>{item.checklist_category}</TableCell>
                              <TableCell>{item.checklist_item}</TableCell>
                              <TableCell>{item.responsible_role}</TableCell>
                              <TableCell>
                                {item.errors.length > 0 && (
                                  <ul className="text-xs text-red-600">
                                    {item.errors.map((e, i) => (
                                      <li key={i}>• {e}</li>
                                    ))}
                                  </ul>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {uploading && (
                      <div className="space-y-2">
                        <Progress value={uploadProgress} />
                        <p className="text-xs text-center text-muted-foreground">
                          Yükleniyor... %{uploadProgress}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setUploadDialogOpen(false);
                    setParsedData([]);
                  }}
                  disabled={uploading}
                >
                  İptal
                </Button>
                <Button
                  onClick={handleBulkInsert}
                  disabled={
                    uploading ||
                    parsedData.length === 0 ||
                    parsedData.filter((p) => p.isValid).length === 0
                  }
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Ekleniyor...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Tümünü Ekle ({parsedData.filter((p) => p.isValid).length})
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="gap-2"
                onClick={() => {
                  resetForm();
                  setManualDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Manuel Ekle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? "Checklist Düzenle" : "Yeni Checklist Ekle"}
                </DialogTitle>
                <DialogDescription>
                  Kontrol maddesi bilgilerini girin
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="checklist_category">Kategori</Label>
                    <Select
                      value={formData.checklist_category}
                      onValueChange={(v) =>
                        setFormData({ ...formData, checklist_category: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yangın">Yangın</SelectItem>
                        <SelectItem value="İlk Yardım">İlk Yardım</SelectItem>
                        <SelectItem value="Ekipman">Ekipman</SelectItem>
                        <SelectItem value="Tahliye">Tahliye</SelectItem>
                        <SelectItem value="Genel">Genel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="check_frequency">Kontrol Periyodu</Label>
                    <Select
                      value={formData.check_frequency}
                      onValueChange={(v) =>
                        setFormData({ ...formData, check_frequency: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Günlük">Günlük</SelectItem>
                        <SelectItem value="Haftalık">Haftalık</SelectItem>
                        <SelectItem value="Aylık">Aylık</SelectItem>
                        <SelectItem value="3 Aylık">3 Aylık</SelectItem>
                        <SelectItem value="6 Aylık">6 Aylık</SelectItem>
                        <SelectItem value="Yıllık">Yıllık</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="checklist_item">
                    Kontrol Maddesi <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="checklist_item"
                    placeholder="Kontrol edilecek maddeyi yazın..."
                    rows={3}
                    value={formData.checklist_item}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        checklist_item: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsible_role">
                    Sorumlu Rol <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="responsible_role"
                    placeholder="Örn: İSG Uzmanı, Saha Şefi"
                    value={formData.responsible_role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        responsible_role: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="last_checked_date">Son Kontrol</Label>
                    <Input
                      id="last_checked_date"
                      type="date"
                      value={formData.last_checked_date}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          last_checked_date: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="next_check_date">Sonraki Kontrol</Label>
                    <Input
                      id="next_check_date"
                      type="date"
                      value={formData.next_check_date}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          next_check_date: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Durum</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v: ChecklistStatus) =>
                        setFormData({ ...formData, status: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Bekliyor</SelectItem>
                        <SelectItem value="checked">Kontrol Edildi</SelectItem>
                        <SelectItem value="issue_found">Sorun Var</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notlar</Label>
                  <Textarea
                    id="notes"
                    placeholder="Ek notlar..."
                    rows={2}
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setManualDialogOpen(false);
                    resetForm();
                  }}
                  disabled={saving}
                >
                  İptal
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Kaydediliyor...
                    </>
                  ) : (
                    "Kaydet"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Toplam</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <ClipboardCheck className="h-8 w-8 text-muted-foreground opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bekliyor</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.pending}
                </p>
              </div>
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Kontrol Edildi</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.checked}
                </p>
              </div>
              <div className="h-3 w-3 rounded-full bg-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Süresi Geçmiş</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.overdue}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Kontrol maddesi veya sorumlu ara..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="Yangın">Yangın</SelectItem>
                  <SelectItem value="İlk Yardım">İlk Yardım</SelectItem>
                  <SelectItem value="Ekipman">Ekipman</SelectItem>
                  <SelectItem value="Tahliye">Tahliye</SelectItem>
                </SelectContent>
              </Select>

              {selectedItems.length > 0 && (
                <Button variant="destructive" onClick={handleBulkDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Seçilenleri Sil ({selectedItems.length})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-purple-500" />
            Kontrol Maddeleri ({filteredChecklists.length})
          </CardTitle>
          <CardDescription>
            Günlük, haftalık ve aylık kontroller
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : checklists.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10 mb-4">
                <ClipboardCheck className="h-8 w-8 text-purple-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Henüz checklist oluşturulmadı
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                AI ile otomatik oluştur, Excel ile toplu yükle veya manuel ekle
              </p>
              <div className="flex items-center justify-center gap-2">
                <AIGenerateButton
                  planId={planId}
                  module="checklist"
                  onSuccess={fetchChecklists}
                />
                <Button
                  variant="outline"
                  onClick={() => setUploadDialogOpen(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Toplu Yükle
                </Button>
                <Button onClick={() => setManualDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Manuel Ekle
                </Button>
              </div>
            </div>
          ) : filteredChecklists.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Arama kriterlerine uygun checklist bulunamadı</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedItems.length === filteredChecklists.length
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedItems(
                              filteredChecklists.map((c) => c.id)
                            );
                          } else {
                            setSelectedItems([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Kontrol Maddesi</TableHead>
                    <TableHead>Periyot</TableHead>
                    <TableHead>Sorumlu</TableHead>
                    <TableHead>Sonraki Kontrol</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChecklists.map((item) => (
                    <TableRow
                      key={item.id}
                      className={
                        isOverdue(item.next_check_date)
                          ? "bg-red-50 dark:bg-red-950/20"
                          : ""
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedItems([...selectedItems, item.id]);
                            } else {
                              setSelectedItems(
                                selectedItems.filter((id) => id !== item.id)
                              );
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {item.checklist_category}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        {item.checklist_item}
                      </TableCell>
                      <TableCell>{item.check_frequency}</TableCell>
                      <TableCell>{item.responsible_role}</TableCell>
                      <TableCell>
                        {item.next_check_date ? (
                          <span
                            className={
                              isOverdue(item.next_check_date)
                                ? "text-red-600 font-semibold"
                                : ""
                            }
                          >
                            {format(parseISO(item.next_check_date), "dd.MM.yyyy")}
                            {isOverdue(item.next_check_date) && (
                              <AlertCircle className="h-3 w-3 inline ml-1" />
                            )}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
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