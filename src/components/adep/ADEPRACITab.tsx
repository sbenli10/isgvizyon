// src/components/adep/ADEPRACITab.tsx

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
  Network,
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
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import AIGenerateButton from "@/components/adep/AIGenerateButton";
import type { RACIItem } from "@/types/adep-ai";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface ADEPRACITabProps {
  planId: string | undefined;
}

type Priority = "low" | "medium" | "high" | "critical";

interface ParsedRACI {
  task_name: string;
  responsible: string | null;
  accountable: string | null;
  consulted: string | null;
  informed: string | null;
  task_category: string | null;
  priority: Priority;
  isValid: boolean;
  errors: string[];
}

export default function ADEPRACITab({ planId }: ADEPRACITabProps) {
  const [raciMatrix, setRaciMatrix] = useState<RACIItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RACIItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<ParsedRACI[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [formData, setFormData] = useState({
    task_name: "",
    responsible: "",
    accountable: "",
    consulted: "",
    informed: "",
    task_category: "Planlama",
    priority: "medium" as Priority,
  });

  useEffect(() => {
    if (planId) {
      fetchRaciMatrix();
    }
  }, [planId]);

  const fetchRaciMatrix = async () => {
    if (!planId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("adep_raci_matrix")
        .select("*")
        .eq("plan_id", planId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRaciMatrix((data || []) as RACIItem[]);
    } catch (error: any) {
      console.error("Fetch error:", error);
      toast.error("Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.task_name.trim()) {
      toast.error("Görev adı zorunludur");
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
        task_name: formData.task_name,
        responsible: formData.responsible || null,
        accountable: formData.accountable || null,
        consulted: formData.consulted || null,
        informed: formData.informed || null,
        task_category: formData.task_category,
        priority: formData.priority,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("adep_raci_matrix")
          .update(payload)
          .eq("id", editingItem.id);

        if (error) throw error;
        toast.success("RACI güncellendi");
      } else {
        const { error } = await supabase
          .from("adep_raci_matrix")
          .insert([payload]);

        if (error) throw error;
        toast.success("RACI eklendi");
      }

      setManualDialogOpen(false);
      resetForm();
      fetchRaciMatrix();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error("Kaydetme hatası", {
        description: error.message || "Bilinmeyen hata",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: RACIItem) => {
    setEditingItem(item);
    setFormData({
      task_name: item.task_name,
      responsible: item.responsible || "",
      accountable: item.accountable || "",
      consulted: item.consulted || "",
      informed: item.informed || "",
      task_category: item.task_category || "Planlama",
      priority: item.priority,
    });
    setManualDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu RACI maddesini silmek istediğinizden emin misiniz?"))
      return;

    try {
      const { error } = await supabase
        .from("adep_raci_matrix")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("RACI silindi");
      fetchRaciMatrix();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Silme hatası");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (
      !confirm(
        `${selectedItems.length} RACI maddesini silmek istediğinizden emin misiniz?`
      )
    )
      return;

    try {
      const { error } = await supabase
        .from("adep_raci_matrix")
        .delete()
        .in("id", selectedItems);

      if (error) throw error;
      toast.success(`${selectedItems.length} RACI silindi`);
      setSelectedItems([]);
      fetchRaciMatrix();
    } catch (error: any) {
      console.error("Bulk delete error:", error);
      toast.error("Toplu silme hatası");
    }
  };

  const resetForm = () => {
    setFormData({
      task_name: "",
      responsible: "",
      accountable: "",
      consulted: "",
      informed: "",
      task_category: "Planlama",
      priority: "medium",
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

  const parseExcelData = (data: any[]): ParsedRACI[] => {
    return data.map((row) => {
      const errors: string[] = [];
      let isValid = true;

      const task_name = String(row["Görev"] || row.task_name || "").trim();
      const responsible = String(row["R (Yapan)"] || row.responsible || "").trim() || null;
      const accountable = String(row["A (Hesap Veren)"] || row.accountable || "").trim() || null;
      const consulted = String(row["C (Danışılan)"] || row.consulted || "").trim() || null;
      const informed = String(row["I (Bilgilendirilen)"] || row.informed || "").trim() || null;
      const task_category = String(row["Kategori"] || row.task_category || "").trim() || null;
      const priority = (row["Öncelik"] || row.priority || "medium") as Priority;

      if (!task_name) {
        errors.push("Görev adı boş olamaz");
        isValid = false;
      }

      return {
        task_name,
        responsible,
        accountable,
        consulted,
        informed,
        task_category,
        priority,
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
          task_name: item.task_name,
          responsible: item.responsible,
          accountable: item.accountable,
          consulted: item.consulted,
          informed: item.informed,
          task_category: item.task_category,
          priority: item.priority,
        }));

        const { error } = await supabase.from("adep_raci_matrix").insert(payload);

        if (error) {
          console.error("Chunk insert error:", error);
        } else {
          successCount += chunk.length;
        }

        setUploadProgress(
          Math.round(((i + chunk.length) / validItems.length) * 100)
        );
      }

      toast.success(`${successCount} RACI maddesi eklendi`);

      setUploadDialogOpen(false);
      setParsedData([]);
      fetchRaciMatrix();
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
        Görev: "ADEP Planının Hazırlanması",
        "R (Yapan)": "İSG Uzmanı",
        "A (Hesap Veren)": "İşveren Vekili",
        "C (Danışılan)": "Saha Şefi",
        "I (Bilgilendirilen)": "Tüm Çalışanlar",
        Kategori: "Planlama",
        Öncelik: "high",
      },
      {
        Görev: "Tatbikat Organizasyonu",
        "R (Yapan)": "Ekip Liderleri",
        "A (Hesap Veren)": "İSG Uzmanı",
        "C (Danışılan)": "İşveren",
        "I (Bilgilendirilen)": "Tüm Çalışanlar",
        Kategori: "Tatbikat",
        Öncelik: "medium",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RACI Şablonu");
    XLSX.writeFile(wb, "raci_sablonu.xlsx");
    toast.success("Şablon indirildi");
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, { label: string; color: string }> = {
      low: { label: "Düşük", color: "bg-gray-500" },
      medium: { label: "Orta", color: "bg-blue-500" },
      high: { label: "Yüksek", color: "bg-orange-500" },
      critical: { label: "Kritik", color: "bg-red-500" },
    };

    const variant = variants[priority] || variants.medium;

    return (
      <Badge className={`${variant.color} text-white`}>{variant.label}</Badge>
    );
  };

  const filteredMatrix = raciMatrix.filter((item) => {
    const matchesSearch =
      item.task_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.responsible?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.accountable?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || item.task_category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const stats = {
    total: raciMatrix.length,
    categories: new Set(raciMatrix.map((r) => r.task_category)).size,
    critical: raciMatrix.filter((r) => r.priority === "critical").length,
    high: raciMatrix.filter((r) => r.priority === "high").length,
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
          <h3 className="text-2xl font-bold">RACI Sorumluluk Matrisi</h3>
          <p className="text-sm text-muted-foreground">
            Responsible, Accountable, Consulted, Informed - Enterprise yönetim
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <AIGenerateButton
            planId={planId}
            module="raci"
            onSuccess={fetchRaciMatrix}
            disabled={loading}
          />

          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Toplu Yükle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Excel/CSV ile Toplu RACI Yükleme</DialogTitle>
                <DialogDescription>
                  RACI sorumluluk matrisini toplu yükleyin
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-semibold">RACI Tanımları:</p>
                      <ul className="text-xs space-y-1">
                        <li>
                          <strong>R (Responsible):</strong> İşi yapan kişi/ekip
                        </li>
                        <li>
                          <strong>A (Accountable):</strong> Hesap veren, karar
                          verici
                        </li>
                        <li>
                          <strong>C (Consulted):</strong> Danışılan, görüşü
                          alınan
                        </li>
                        <li>
                          <strong>I (Informed):</strong> Bilgilendirilen
                        </li>
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>

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
                            <TableHead>Görev</TableHead>
                            <TableHead>R</TableHead>
                            <TableHead>A</TableHead>
                            <TableHead>C</TableHead>
                            <TableHead>I</TableHead>
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
                              <TableCell className="font-medium">
                                {item.task_name}
                              </TableCell>
                              <TableCell>{item.responsible || "-"}</TableCell>
                              <TableCell>{item.accountable || "-"}</TableCell>
                              <TableCell>{item.consulted || "-"}</TableCell>
                              <TableCell>{item.informed || "-"}</TableCell>
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
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? "RACI Düzenle" : "Yeni RACI Ekle"}
                </DialogTitle>
                <DialogDescription>
                  Görev ve sorumlulukları tanımlayın
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="task_name">
                    Görev Adı <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="task_name"
                    placeholder="Örn: ADEP Planının Hazırlanması"
                    value={formData.task_name}
                    onChange={(e) =>
                      setFormData({ ...formData, task_name: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="responsible">
                      <Badge variant="outline" className="mr-2">
                        R
                      </Badge>
                      Responsible (Yapan)
                    </Label>
                    <Input
                      id="responsible"
                      placeholder="Örn: İSG Uzmanı"
                      value={formData.responsible}
                      onChange={(e) =>
                        setFormData({ ...formData, responsible: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accountable">
                      <Badge variant="outline" className="mr-2">
                        A
                      </Badge>
                      Accountable (Hesap Veren)
                    </Label>
                    <Input
                      id="accountable"
                      placeholder="Örn: İşveren Vekili"
                      value={formData.accountable}
                      onChange={(e) =>
                        setFormData({ ...formData, accountable: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="consulted">
                      <Badge variant="outline" className="mr-2">
                        C
                      </Badge>
                      Consulted (Danışılan)
                    </Label>
                    <Input
                      id="consulted"
                      placeholder="Örn: Saha Şefi"
                      value={formData.consulted}
                      onChange={(e) =>
                        setFormData({ ...formData, consulted: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="informed">
                      <Badge variant="outline" className="mr-2">
                        I
                      </Badge>
                      Informed (Bilgilendirilen)
                    </Label>
                    <Input
                      id="informed"
                      placeholder="Örn: Tüm Çalışanlar"
                      value={formData.informed}
                      onChange={(e) =>
                        setFormData({ ...formData, informed: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="task_category">Görev Kategorisi</Label>
                    <Select
                      value={formData.task_category}
                      onValueChange={(v) =>
                        setFormData({ ...formData, task_category: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Planlama">Planlama</SelectItem>
                        <SelectItem value="Tatbikat">Tatbikat</SelectItem>
                        <SelectItem value="Kontrol">Kontrol</SelectItem>
                        <SelectItem value="Eğitim">Eğitim</SelectItem>
                        <SelectItem value="Raporlama">Raporlama</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Öncelik</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(v: Priority) =>
                        setFormData({ ...formData, priority: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Düşük</SelectItem>
                        <SelectItem value="medium">Orta</SelectItem>
                        <SelectItem value="high">Yüksek</SelectItem>
                        <SelectItem value="critical">Kritik</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                <p className="text-sm text-muted-foreground">Toplam Görev</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Network className="h-8 w-8 text-muted-foreground opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Kategori</p>
                <p className="text-2xl font-bold">{stats.categories}</p>
              </div>
              <div className="h-3 w-3 rounded-full bg-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Yüksek Öncelik</p>
                <p className="text-2xl font-bold text-orange-600">
                  {stats.high}
                </p>
              </div>
              <div className="h-3 w-3 rounded-full bg-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Kritik</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.critical}
                </p>
              </div>
              <div className="h-3 w-3 rounded-full bg-red-500" />
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
                  placeholder="Görev veya sorumlu ara..."
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
                  <SelectItem value="Planlama">Planlama</SelectItem>
                  <SelectItem value="Tatbikat">Tatbikat</SelectItem>
                  <SelectItem value="Kontrol">Kontrol</SelectItem>
                  <SelectItem value="Eğitim">Eğitim</SelectItem>
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
            <Network className="h-5 w-5 text-indigo-500" />
            Sorumluluk Matrisi ({filteredMatrix.length})
          </CardTitle>
          <CardDescription>
            Görev bazlı rol ve sorumluluk tanımları
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : raciMatrix.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/10 mb-4">
                <Network className="h-8 w-8 text-indigo-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                RACI matrisi oluşturulmadı
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                AI ile otomatik oluştur, Excel ile toplu yükle veya manuel ekle
              </p>
              <div className="flex items-center justify-center gap-2">
                <AIGenerateButton
                  planId={planId}
                  module="raci"
                  onSuccess={fetchRaciMatrix}
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
          ) : filteredMatrix.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Arama kriterlerine uygun RACI bulunamadı</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedItems.length === filteredMatrix.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedItems(filteredMatrix.map((r) => r.id));
                          } else {
                            setSelectedItems([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Görev</TableHead>
                    <TableHead>R (Yapan)</TableHead>
                    <TableHead>A (Hesap Veren)</TableHead>
                    <TableHead>C (Danışılan)</TableHead>
                    <TableHead>I (Bilgilendirilen)</TableHead>
                    <TableHead>Öncelik</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMatrix.map((item) => (
                    <TableRow key={item.id}>
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
                        {item.task_name}
                      </TableCell>
                      <TableCell>{item.responsible || "-"}</TableCell>
                      <TableCell>{item.accountable || "-"}</TableCell>
                      <TableCell>{item.consulted || "-"}</TableCell>
                      <TableCell>{item.informed || "-"}</TableCell>
                      <TableCell>{getPriorityBadge(item.priority)}</TableCell>
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