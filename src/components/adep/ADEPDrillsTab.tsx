// src/components/adep/ADEPDrillsTab.tsx

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
  Activity,
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
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import { format, parseISO, isFuture } from "date-fns";
import AIGenerateButton from "@/components/adep/AIGenerateButton";
import type { Drill } from "@/types/adep-ai";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface ADEPDrillsTabProps {
  planId: string | undefined;
}

interface ParsedDrill {
  drill_type: string;
  drill_date: string;
  participants_count: number | null;
  duration_minutes: number | null;
  scenario_tested: string;
  success_rate: string | null;
  observations: string | null;
  action_items: string | null;
  next_drill_date: string | null;
  isValid: boolean;
  errors: string[];
}

export default function ADEPDrillsTab({ planId }: ADEPDrillsTabProps) {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Drill | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<ParsedDrill[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [formData, setFormData] = useState({
    drill_type: "Yangın Tatbikatı",
    drill_date: "",
    participants_count: null as number | null,
    duration_minutes: null as number | null,
    scenario_tested: "",
    success_rate: "",
    observations: "",
    action_items: "",
    next_drill_date: "",
  });

  useEffect(() => {
    if (planId) {
      fetchDrills();
    }
  }, [planId]);

  const fetchDrills = async () => {
    if (!planId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("adep_drills")
        .select("*")
        .eq("plan_id", planId)
        .order("drill_date", { ascending: false });

      if (error) throw error;
      setDrills((data || []) as Drill[]);
    } catch (error: any) {
      console.error("Fetch error:", error);
      toast.error("Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.drill_type.trim()) {
      toast.error("Tatbikat türü zorunludur");
      return false;
    }
    if (!formData.drill_date) {
      toast.error("Tatbikat tarihi zorunludur");
      return false;
    }
    if (!formData.scenario_tested.trim()) {
      toast.error("Test edilen senaryo zorunludur");
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
        drill_type: formData.drill_type,
        drill_date: formData.drill_date,
        participants_count: formData.participants_count,
        duration_minutes: formData.duration_minutes,
        scenario_tested: formData.scenario_tested,
        success_rate: formData.success_rate || null,
        observations: formData.observations || null,
        action_items: formData.action_items || null,
        next_drill_date: formData.next_drill_date || null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("adep_drills")
          .update(payload)
          .eq("id", editingItem.id);

        if (error) throw error;
        toast.success("Tatbikat güncellendi");
      } else {
        const { error } = await supabase.from("adep_drills").insert([payload]);

        if (error) throw error;
        toast.success("Tatbikat eklendi");
      }

      setManualDialogOpen(false);
      resetForm();
      fetchDrills();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error("Kaydetme hatası", {
        description: error.message || "Bilinmeyen hata",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: Drill) => {
    setEditingItem(item);
    setFormData({
      drill_type: item.drill_type,
      drill_date: item.drill_date,
      participants_count: item.participants_count,
      duration_minutes: item.duration_minutes,
      scenario_tested: item.scenario_tested,
      success_rate: item.success_rate || "",
      observations: item.observations || "",
      action_items: item.action_items || "",
      next_drill_date: item.next_drill_date || "",
    });
    setManualDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu tatbikatı silmek istediğinizden emin misiniz?")) return;

    try {
      const { error } = await supabase.from("adep_drills").delete().eq("id", id);

      if (error) throw error;
      toast.success("Tatbikat silindi");
      fetchDrills();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Silme hatası");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (
      !confirm(
        `${selectedItems.length} tatbikatı silmek istediğinizden emin misiniz?`
      )
    )
      return;

    try {
      const { error } = await supabase
        .from("adep_drills")
        .delete()
        .in("id", selectedItems);

      if (error) throw error;
      toast.success(`${selectedItems.length} tatbikat silindi`);
      setSelectedItems([]);
      fetchDrills();
    } catch (error: any) {
      console.error("Bulk delete error:", error);
      toast.error("Toplu silme hatası");
    }
  };

  const resetForm = () => {
    setFormData({
      drill_type: "Yangın Tatbikatı",
      drill_date: "",
      participants_count: null,
      duration_minutes: null,
      scenario_tested: "",
      success_rate: "",
      observations: "",
      action_items: "",
      next_drill_date: "",
    });
    setEditingItem(null);
  };

  // File Upload
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

  const parseExcelData = (data: any[]): ParsedDrill[] => {
    return data.map((row) => {
      const errors: string[] = [];
      let isValid = true;

      const drill_type = String(row["Tatbikat Türü"] || row.drill_type || "").trim();
      const drill_date = String(row["Tarih"] || row.drill_date || "").trim();
      const participants_count = row["Katılımcı Sayısı"] || row.participants_count || null;
      const duration_minutes = row["Süre (dk)"] || row.duration_minutes || null;
      const scenario_tested = String(
        row["Test Edilen Senaryo"] || row.scenario_tested || ""
      ).trim();
      const success_rate = String(row["Başarı Oranı"] || row.success_rate || "").trim() || null;
      const observations = String(row["Gözlemler"] || row.observations || "").trim() || null;
      const action_items = String(row["Aksiyon Maddeleri"] || row.action_items || "").trim() || null;
      const next_drill_date = row["Sonraki Tatbikat"] || row.next_drill_date || null;

      if (!drill_type) {
        errors.push("Tatbikat türü boş olamaz");
        isValid = false;
      }

      if (!drill_date) {
        errors.push("Tarih boş olamaz");
        isValid = false;
      }

      if (!scenario_tested) {
        errors.push("Senaryo boş olamaz");
        isValid = false;
      }

      return {
        drill_type,
        drill_date,
        participants_count,
        duration_minutes,
        scenario_tested,
        success_rate,
        observations,
        action_items,
        next_drill_date,
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
          drill_type: item.drill_type,
          drill_date: item.drill_date,
          participants_count: item.participants_count,
          duration_minutes: item.duration_minutes,
          scenario_tested: item.scenario_tested,
          success_rate: item.success_rate,
          observations: item.observations,
          action_items: item.action_items,
          next_drill_date: item.next_drill_date,
        }));

        const { error } = await supabase.from("adep_drills").insert(payload);

        if (error) {
          console.error("Chunk insert error:", error);
        } else {
          successCount += chunk.length;
        }

        setUploadProgress(
          Math.round(((i + chunk.length) / validItems.length) * 100)
        );
      }

      toast.success(`${successCount} tatbikat eklendi`);

      setUploadDialogOpen(false);
      setParsedData([]);
      fetchDrills();
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
        "Tatbikat Türü": "Yangın Tatbikatı",
        "Tarih": "2025-03-15",
        "Katılımcı Sayısı": 50,
        "Süre (dk)": 45,
        "Test Edilen Senaryo": "Ofis yangını ve tahliye",
        "Başarı Oranı": "%85",
        "Gözlemler": "Tahliye süresi hedeflenen süre içinde tamamlandı",
        "Aksiyon Maddeleri": "Acil çıkış işaretlerinin yenilenmesi",
        "Sonraki Tatbikat": "2025-09-15",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tatbikat Şablonu");
    XLSX.writeFile(wb, "tatbikat_sablonu.xlsx");
    toast.success("Şablon indirildi");
  };

  const filteredDrills = drills.filter((item) => {
    const matchesSearch =
      item.drill_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.scenario_tested.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === "all" || item.drill_type === typeFilter;

    return matchesSearch && matchesType;
  });

  const stats = {
    total: drills.length,
    past: drills.filter((d) => !isFuture(parseISO(d.drill_date))).length,
    upcoming: drills.filter((d) => isFuture(parseISO(d.drill_date))).length,
    avgParticipants: Math.round(
      drills.reduce((sum, d) => sum + (d.participants_count || 0), 0) /
        (drills.length || 1)
    ),
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
          <h3 className="text-2xl font-bold">Tatbikat Kayıtları</h3>
          <p className="text-sm text-muted-foreground">
            Geçmiş ve planlanan acil durum tatbikatları - Enterprise yönetim
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <AIGenerateButton
            planId={planId}
            module="drill"
            onSuccess={fetchDrills}
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
                <DialogTitle>Excel/CSV ile Toplu Tatbikat Yükleme</DialogTitle>
                <DialogDescription>
                  Geçmiş ve planlanan tatbikatları toplu yükleyin
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
                            <TableHead>Tatbikat Türü</TableHead>
                            <TableHead>Tarih</TableHead>
                            <TableHead>Senaryo</TableHead>
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
                              <TableCell>{item.drill_type}</TableCell>
                              <TableCell>{item.drill_date}</TableCell>
                              <TableCell>{item.scenario_tested}</TableCell>
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
                  {editingItem ? "Tatbikatı Düzenle" : "Yeni Tatbikat Ekle"}
                </DialogTitle>
                <DialogDescription>Tatbikat bilgilerini girin</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="drill_type">
                      Tatbikat Türü <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.drill_type}
                      onValueChange={(v) =>
                        setFormData({ ...formData, drill_type: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yangın Tatbikatı">
                          Yangın Tatbikatı
                        </SelectItem>
                        <SelectItem value="Deprem Tatbikatı">
                          Deprem Tatbikatı
                        </SelectItem>
                        <SelectItem value="Tahliye Tatbikatı">
                          Tahliye Tatbikatı
                        </SelectItem>
                        <SelectItem value="İlk Yardım Tatbikatı">
                          İlk Yardım Tatbikatı
                        </SelectItem>
                        <SelectItem value="Kimyasal Acil Durum">
                          Kimyasal Acil Durum
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="drill_date">
                      Tatbikat Tarihi <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="drill_date"
                      type="date"
                      value={formData.drill_date}
                      onChange={(e) =>
                        setFormData({ ...formData, drill_date: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="participants_count">Katılımcı Sayısı</Label>
                    <Input
                      id="participants_count"
                      type="number"
                      min="0"
                      placeholder="Örn: 50"
                      value={formData.participants_count || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          participants_count: e.target.value
                            ? parseInt(e.target.value)
                            : null,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration_minutes">Süre (dakika)</Label>
                    <Input
                      id="duration_minutes"
                      type="number"
                      min="0"
                      placeholder="Örn: 45"
                      value={formData.duration_minutes || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          duration_minutes: e.target.value
                            ? parseInt(e.target.value)
                            : null,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scenario_tested">
                    Test Edilen Senaryo{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="scenario_tested"
                    placeholder="Örn: Ofis yangını ve tahliye"
                    value={formData.scenario_tested}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        scenario_tested: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="success_rate">Başarı Oranı</Label>
                    <Input
                      id="success_rate"
                      placeholder="Örn: %85 veya İyi"
                      value={formData.success_rate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          success_rate: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="next_drill_date">
                      Sonraki Tatbikat Tarihi
                    </Label>
                    <Input
                      id="next_drill_date"
                      type="date"
                      value={formData.next_drill_date}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          next_drill_date: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observations">Gözlemler</Label>
                  <Textarea
                    id="observations"
                    placeholder="Tatbikat sırasında yapılan gözlemler..."
                    rows={3}
                    value={formData.observations}
                    onChange={(e) =>
                      setFormData({ ...formData, observations: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="action_items">Aksiyon Maddeleri</Label>
                  <Textarea
                    id="action_items"
                    placeholder="Tatbikat sonrası alınacak aksiyonlar..."
                    rows={3}
                    value={formData.action_items}
                    onChange={(e) =>
                      setFormData({ ...formData, action_items: e.target.value })
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
              <Activity className="h-8 w-8 text-muted-foreground opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Geçmiş</p>
                <p className="text-2xl font-bold text-blue-600">{stats.past}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Planlanan</p>
                <p className="text-2xl font-bold text-orange-600">
                  {stats.upcoming}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-orange-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ort. Katılımcı</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.avgParticipants}
                </p>
              </div>
              <div className="h-3 w-3 rounded-full bg-green-500" />
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
                  placeholder="Tatbikat türü veya senaryo ara..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Tür Filtresi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="Yangın Tatbikatı">
                    Yangın Tatbikatı
                  </SelectItem>
                  <SelectItem value="Deprem Tatbikatı">
                    Deprem Tatbikatı
                  </SelectItem>
                  <SelectItem value="Tahliye Tatbikatı">
                    Tahliye Tatbikatı
                  </SelectItem>
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
            <Activity className="h-5 w-5 text-green-500" />
            Tatbikat Listesi ({filteredDrills.length})
          </CardTitle>
          <CardDescription>
            Tüm tatbikat kayıtları ve planları
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : drills.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                <Activity className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Henüz tatbikat kaydı yok
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                AI ile otomatik plan oluştur, Excel ile toplu yükle veya manuel
                ekle
              </p>
              <div className="flex items-center justify-center gap-2">
                <AIGenerateButton
                  planId={planId}
                  module="drill"
                  onSuccess={fetchDrills}
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
          ) : filteredDrills.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Arama kriterlerine uygun tatbikat bulunamadı</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedItems.length === filteredDrills.length
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedItems(filteredDrills.map((d) => d.id));
                          } else {
                            setSelectedItems([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Tatbikat Türü</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Katılımcı</TableHead>
                    <TableHead>Süre</TableHead>
                    <TableHead>Başarı</TableHead>
                    <TableHead>Sonraki</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDrills.map((item) => (
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
                        {item.drill_type}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(item.drill_date), "dd.MM.yyyy")}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.participants_count || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.duration_minutes ? `${item.duration_minutes} dk` : "-"}
                      </TableCell>
                      <TableCell>{item.success_rate || "-"}</TableCell>
                      <TableCell>
                        {item.next_drill_date
                          ? format(parseISO(item.next_drill_date), "dd.MM.yyyy")
                          : "-"}
                      </TableCell>
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