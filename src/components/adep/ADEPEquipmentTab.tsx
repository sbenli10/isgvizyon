// src/components/adep/ADEPEquipmentTab.tsx

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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Package,
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
import { format, isBefore, parseISO } from "date-fns";
import AIGenerateButton from "@/components/adep/AIGenerateButton";
import type { EquipmentItem } from "@/types/adep-ai";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface ADEPEquipmentTabProps {
  planId: string | undefined;
}

type EquipmentType = "Yangın" | "İlk Yardım" | "Tahliye" | "Koruma";
type EquipmentStatus = "active" | "maintenance" | "retired";

interface ParsedEquipment {
  equipment_name: string;
  equipment_type: EquipmentType;
  quantity: number;
  location: string;
  next_inspection_date: string | null;
  status: EquipmentStatus;
  responsible_person: string | null;
  isValid: boolean;
  errors: string[];
}

export default function ADEPEquipmentTab({ planId }: ADEPEquipmentTabProps) {
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // File upload state
  const [parsedData, setParsedData] = useState<ParsedEquipment[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [duplicateAction, setDuplicateAction] = useState<
    "overwrite" | "skip" | "cancel"
  >("skip");

  // Form state
  const [formData, setFormData] = useState({
    equipment_name: "",
    equipment_type: "Yangın" as EquipmentType,
    quantity: 1,
    location: "",
    next_inspection_date: "",
    status: "active" as EquipmentStatus,
    responsible_person: "",
  });

  useEffect(() => {
    if (planId) {
      fetchEquipment();
    }
  }, [planId]);

  const fetchEquipment = async () => {
    if (!planId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("adep_equipment_inventory")
        .select("*")
        .eq("plan_id", planId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEquipment((data || []) as EquipmentItem[]);
    } catch (error: any) {
      console.error("Fetch error:", error);
      toast.error("Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // MANUEL EKLEME
  // ============================================
  const validateForm = (): boolean => {
    if (!formData.equipment_name.trim()) {
      toast.error("Ekipman adı zorunludur");
      return false;
    }
    if (!formData.location.trim()) {
      toast.error("Konum zorunludur");
      return false;
    }
    if (formData.quantity < 1) {
      toast.error("Adet en az 1 olmalıdır");
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
        equipment_name: formData.equipment_name,
        equipment_type: formData.equipment_type,
        quantity: formData.quantity,
        location: formData.location,
        next_inspection_date: formData.next_inspection_date || null,
        status: formData.status,
        responsible_person: formData.responsible_person || null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("adep_equipment_inventory")
          .update(payload)
          .eq("id", editingItem.id);

        if (error) throw error;
        toast.success("Ekipman güncellendi");
      } else {
        const { error } = await supabase
          .from("adep_equipment_inventory")
          .insert([payload]);

        if (error) throw error;
        toast.success("Ekipman eklendi");
      }

      setManualDialogOpen(false);
      resetForm();
      fetchEquipment();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error("Kaydetme hatası", {
        description: error.message || "Bilinmeyen hata",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: EquipmentItem) => {
    setEditingItem(item);
    setFormData({
      equipment_name: item.equipment_name,
      equipment_type: item.equipment_type as EquipmentType,
      quantity: item.quantity,
      location: item.location,
      next_inspection_date: item.next_inspection_date || "",
      status: item.status,
      responsible_person: item.responsible_person || "",
    });
    setManualDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu ekipmanı silmek istediğinizden emin misiniz?")) return;

    try {
      const { error } = await supabase
        .from("adep_equipment_inventory")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Ekipman silindi");
      fetchEquipment();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Silme hatası");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (
      !confirm(
        `${selectedItems.length} ekipmanı silmek istediğinizden emin misiniz?`
      )
    )
      return;

    try {
      const { error } = await supabase
        .from("adep_equipment_inventory")
        .delete()
        .in("id", selectedItems);

      if (error) throw error;
      toast.success(`${selectedItems.length} ekipman silindi`);
      setSelectedItems([]);
      fetchEquipment();
    } catch (error: any) {
      console.error("Bulk delete error:", error);
      toast.error("Toplu silme hatası");
    }
  };

  const resetForm = () => {
    setFormData({
      equipment_name: "",
      equipment_type: "Yangın",
      quantity: 1,
      location: "",
      next_inspection_date: "",
      status: "active",
      responsible_person: "",
    });
    setEditingItem(null);
  };

  // ============================================
  // DOSYA YÜKLEME
  // ============================================
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

        // Check duplicates
        checkDuplicates(parsed);

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

  const parseExcelData = (data: any[]): ParsedEquipment[] => {
    return data.map((row) => {
      const errors: string[] = [];
      let isValid = true;

      const equipment_name = String(row["Ekipman Adı"] || row.equipment_name || "").trim();
      const equipment_type = String(row["Tür"] || row.equipment_type || "Yangın");
      const quantity = Number(row["Adet"] || row.quantity || 1);
      const location = String(row["Konum"] || row.location || "").trim();
      const next_inspection_date = row["Sonraki Kontrol"] || row.next_inspection_date || null;
      const status = (row["Durum"] || row.status || "active") as EquipmentStatus;
      const responsible_person = String(row["Sorumlu"] || row.responsible_person || "").trim() || null;

      // Validation
      if (!equipment_name) {
        errors.push("Ekipman adı boş olamaz");
        isValid = false;
      }

      if (!location) {
        errors.push("Konum boş olamaz");
        isValid = false;
      }

      if (quantity < 1) {
        errors.push("Adet 1'den küçük olamaz");
        isValid = false;
      }

      const validTypes = ["Yangın", "İlk Yardım", "Tahliye", "Koruma"];
      if (!validTypes.includes(equipment_type)) {
        errors.push(`Geçersiz tür: ${equipment_type}`);
        isValid = false;
      }

      return {
        equipment_name,
        equipment_type: equipment_type as EquipmentType,
        quantity,
        location,
        next_inspection_date,
        status,
        responsible_person,
        isValid,
        errors,
      };
    });
  };

  const checkDuplicates = (parsed: ParsedEquipment[]) => {
    const existingKeys = equipment.map(
      (e) => `${e.equipment_name}_${e.location}`
    );
    const duplicateKeys = parsed
      .filter((p) => existingKeys.includes(`${p.equipment_name}_${p.location}`))
      .map((p) => `${p.equipment_name} - ${p.location}`);

    setDuplicates(duplicateKeys);
  };

    const handleBulkInsert = async () => {
    if (!planId) return;

    const validItems = parsedData.filter((p) => p.isValid);

    if (validItems.length === 0) {
        toast.error("Eklenecek geçerli satır yok");
        return;
    }

    if (duplicates.length > 0 && duplicateAction === "cancel") {
        toast.error("Duplicate kayıtlar var, işlem iptal edildi");
        return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
        // Step 1: Handle duplicates if needed
        if (duplicateAction === "overwrite" && duplicates.length > 0) {
        setUploadProgress(10);
        
        // Delete existing duplicates
        const deletePromises = validItems.map(async (item) => {
            await supabase
            .from("adep_equipment_inventory")
            .delete()
            .eq("plan_id", planId)
            .eq("equipment_name", item.equipment_name)
            .eq("location", item.location);
        });

        await Promise.all(deletePromises);
        toast.info("Duplicate kayıtlar silindi");
        }

        setUploadProgress(25);

        // Step 2: Prepare equipment array
        let equipment = validItems.map((item) => ({
        equipment_name: item.equipment_name,
        equipment_type: item.equipment_type,
        quantity: item.quantity,
        location: item.location,
        next_inspection_date: item.next_inspection_date,
        status: item.status,
        responsible_person: item.responsible_person,
        }));

        // Step 3: Filter out duplicates if action is "skip"
        if (duplicateAction === "skip" && duplicates.length > 0) {
        const existingKeys = equipment.map(
            (e) => `${e.equipment_name}_${e.location}`
        );
        
        const currentEquipment = await supabase
            .from("adep_equipment_inventory")
            .select("equipment_name, location")
            .eq("plan_id", planId);

        const existingSet = new Set(
            (currentEquipment.data || []).map(
            (e: any) => `${e.equipment_name}_${e.location}`
            )
        );

        equipment = equipment.filter(
            (e) => !existingSet.has(`${e.equipment_name}_${e.location}`)
        );

        toast.info(`${validItems.length - equipment.length} duplicate atlandı`);
        }

        setUploadProgress(50);

        // Step 4: Call Edge Function
        const { data, error } = await supabase.functions.invoke(
        "upload-equipment-excel",
        {
            body: {
            planId,
            equipment,
            },
        }
        );

        setUploadProgress(90);

        if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message || "Upload failed");
        }

        if (!data.success) {
        throw new Error(data.error || "Upload failed");
        }

        setUploadProgress(100);

        toast.success(`✅ ${data.insertedCount} ekipman eklendi`, {
        description: `${data.validatedCount} satır işlendi`,
        });

        // Reset and refresh
        setUploadDialogOpen(false);
        setParsedData([]);
        setDuplicates([]);
        setDuplicateAction("skip");
        fetchEquipment();
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
        "Ekipman Adı": "Yangın Söndürücü",
        "Tür": "Yangın",
        "Adet": 5,
        "Konum": "1. Kat Koridor",
        "Sonraki Kontrol": "2025-06-01",
        "Durum": "active",
        "Sorumlu": "İSG Uzmanı",
      },
      {
        "Ekipman Adı": "İlk Yardım Çantası",
        "Tür": "İlk Yardım",
        "Adet": 2,
        "Konum": "Yemekhane",
        "Sonraki Kontrol": "2025-05-15",
        "Durum": "active",
        "Sorumlu": "Saha Şefi",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ekipman Şablonu");
    XLSX.writeFile(wb, "ekipman_sablonu.xlsx");
    toast.success("Şablon indirildi");
  };

  // ============================================
  // UI HELPERS
  // ============================================
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; color: string }> = {
      active: { label: "Aktif", color: "bg-green-500" },
      maintenance: { label: "Bakımda", color: "bg-yellow-500" },
      retired: { label: "Kullanım Dışı", color: "bg-gray-500" },
    };

    const variant = variants[status] || variants.active;

    return (
      <Badge className={`${variant.color} text-white`}>{variant.label}</Badge>
    );
  };

  const isInspectionOverdue = (date: string | null): boolean => {
    if (!date) return false;
    try {
      return isBefore(parseISO(date), new Date());
    } catch {
      return false;
    }
  };

  // Filtering
  const filteredEquipment = equipment.filter((item) => {
    const matchesSearch =
      item.equipment_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType =
      typeFilter === "all" || item.equipment_type === typeFilter;

    return matchesSearch && matchesType;
  });

  // Statistics
  const stats = {
    total: equipment.length,
    active: equipment.filter((e) => e.status === "active").length,
    maintenance: equipment.filter((e) => e.status === "maintenance").length,
    overdue: equipment.filter((e) =>
      isInspectionOverdue(e.next_inspection_date)
    ).length,
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
          <h3 className="text-2xl font-bold">Acil Durum Ekipman Envanteri</h3>
          <p className="text-sm text-muted-foreground">
            Yangın, ilk yardım ve tahliye ekipmanları - Enterprise toplu yönetim
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <AIGenerateButton
            planId={planId}
            module="equipment"
            onSuccess={fetchEquipment}
            disabled={loading}
          />

          {/* Upload Dialog */}
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Toplu Yükle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Excel/CSV ile Toplu Ekipman Yükleme</DialogTitle>
                <DialogDescription>
                  Excel veya CSV dosyası ile yüzlerce ekipmanı tek seferde
                  yükleyin
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Template Download */}
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

                {/* Dropzone */}
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
                          veya dosya seçmek için tıklayın (.xlsx, .csv)
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Preview Table */}
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

                    {/* Duplicate Warning */}
                    {duplicates.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="space-y-2">
                            <p className="font-semibold">
                              {duplicates.length} adet duplicate kayıt tespit
                              edildi:
                            </p>
                            <ul className="text-xs list-disc list-inside">
                              {duplicates.slice(0, 5).map((d, i) => (
                                <li key={i}>{d}</li>
                              ))}
                              {duplicates.length > 5 && (
                                <li>... ve {duplicates.length - 5} diğer</li>
                              )}
                            </ul>
                            <Select
                              value={duplicateAction}
                              onValueChange={(v: any) => setDuplicateAction(v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="skip">
                                  Atla (yeni kayıtları ekle)
                                </SelectItem>
                                <SelectItem value="overwrite">
                                  Üzerine Yaz
                                </SelectItem>
                                <SelectItem value="cancel">
                                  İptal Et
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="border rounded-lg max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Durum</TableHead>
                            <TableHead>Ekipman Adı</TableHead>
                            <TableHead>Tür</TableHead>
                            <TableHead>Adet</TableHead>
                            <TableHead>Konum</TableHead>
                            <TableHead>Hatalar</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedData.map((item, idx) => (
                            <TableRow
                              key={idx}
                              className={
                                item.isValid ? "" : "bg-red-50 dark:bg-red-950/20"
                              }
                            >
                              <TableCell>
                                {item.isValid ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-red-500" />
                                )}
                              </TableCell>
                              <TableCell>{item.equipment_name}</TableCell>
                              <TableCell>{item.equipment_type}</TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>{item.location}</TableCell>
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
                      Tümünü Ekle (
                      {parsedData.filter((p) => p.isValid).length})
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Manual Add Dialog */}
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
                  {editingItem ? "Ekipmanı Düzenle" : "Yeni Ekipman Ekle"}
                </DialogTitle>
                <DialogDescription>
                  Ekipman bilgilerini girin
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="equipment_name">
                      Ekipman Adı <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="equipment_name"
                      placeholder="Örn: Yangın Söndürücü"
                      value={formData.equipment_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          equipment_name: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="equipment_type">Tür</Label>
                    <Select
                      value={formData.equipment_type}
                      onValueChange={(v: EquipmentType) =>
                        setFormData({ ...formData, equipment_type: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yangın">Yangın</SelectItem>
                        <SelectItem value="İlk Yardım">İlk Yardım</SelectItem>
                        <SelectItem value="Tahliye">Tahliye</SelectItem>
                        <SelectItem value="Koruma">Koruma</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Adet</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          quantity: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">
                      Konum <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="location"
                      placeholder="Örn: 1. Kat Koridor"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="next_inspection_date">
                      Sonraki Kontrol Tarihi
                    </Label>
                    <Input
                      id="next_inspection_date"
                      type="date"
                      value={formData.next_inspection_date}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          next_inspection_date: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Durum</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v: EquipmentStatus) =>
                        setFormData({ ...formData, status: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Aktif</SelectItem>
                        <SelectItem value="maintenance">Bakımda</SelectItem>
                        <SelectItem value="retired">Kullanım Dışı</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsible_person">Sorumlu Kişi</Label>
                  <Input
                    id="responsible_person"
                    placeholder="Örn: İSG Uzmanı"
                    value={formData.responsible_person}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        responsible_person: e.target.value,
                      })
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
              <Package className="h-8 w-8 text-muted-foreground opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aktif</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.active}
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
                <p className="text-sm text-muted-foreground">Bakımda</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.maintenance}
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
                  placeholder="Ekipman adı veya konum ara..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Tür Filtresi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="Yangın">Yangın</SelectItem>
                  <SelectItem value="İlk Yardım">İlk Yardım</SelectItem>
                  <SelectItem value="Tahliye">Tahliye</SelectItem>
                  <SelectItem value="Koruma">Koruma</SelectItem>
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
            <Package className="h-5 w-5 text-blue-500" />
            Ekipman Listesi ({filteredEquipment.length})
          </CardTitle>
          <CardDescription>
            Tüm acil durum ekipmanlarının envanteri
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : equipment.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 mb-4">
                <Package className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Henüz ekipman eklenmedi
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                AI ile otomatik oluştur, Excel ile toplu yükle veya manuel ekle
              </p>
              <div className="flex items-center justify-center gap-2">
                <AIGenerateButton
                  planId={planId}
                  module="equipment"
                  onSuccess={fetchEquipment}
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
          ) : filteredEquipment.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Arama kriterlerine uygun ekipman bulunamadı</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedItems.length === filteredEquipment.length
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedItems(
                              filteredEquipment.map((e) => e.id)
                            );
                          } else {
                            setSelectedItems([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Ekipman Adı</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Adet</TableHead>
                    <TableHead>Konum</TableHead>
                    <TableHead>Sonraki Kontrol</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEquipment.map((item) => (
                    <TableRow
                      key={item.id}
                      className={
                        isInspectionOverdue(item.next_inspection_date)
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
                      <TableCell className="font-medium">
                        {item.equipment_name}
                      </TableCell>
                      <TableCell>{item.equipment_type}</TableCell>
                      <TableCell className="text-center">
                        {item.quantity}
                      </TableCell>
                      <TableCell>{item.location}</TableCell>
                      <TableCell>
                        {item.next_inspection_date ? (
                          <span
                            className={
                              isInspectionOverdue(item.next_inspection_date)
                                ? "text-red-600 font-semibold"
                                : ""
                            }
                          >
                            {format(
                              parseISO(item.next_inspection_date),
                              "dd.MM.yyyy"
                            )}
                            {isInspectionOverdue(item.next_inspection_date) && (
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