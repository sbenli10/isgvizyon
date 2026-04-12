// src/components/adep/ADEPRiskSourcesTab.tsx

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
  MapPin,
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
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import { format, parseISO } from "date-fns";
import AIGenerateButton from "@/components/adep/AIGenerateButton";
import type { RiskSource } from "@/types/adep-ai";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface ADEPRiskSourcesTabProps {
  planId: string | undefined;
}

type RiskLevel = "low" | "medium" | "high" | "critical";

interface ParsedRiskSource {
  risk_source: string;
  location: string;
  risk_level: RiskLevel;
  potential_impact: string;
  mitigation_measures: string | null;
  monitoring_frequency: string | null;
  last_assessment_date: string | null;
  isValid: boolean;
  errors: string[];
}

export default function ADEPRiskSourcesTab({
  planId,
}: ADEPRiskSourcesTabProps) {
  const [riskSources, setRiskSources] = useState<RiskSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RiskSource | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<ParsedRiskSource[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [formData, setFormData] = useState({
    risk_source: "",
    location: "",
    risk_level: "medium" as RiskLevel,
    potential_impact: "",
    mitigation_measures: "",
    monitoring_frequency: "",
    last_assessment_date: "",
  });

  useEffect(() => {
    if (planId) {
      fetchRiskSources();
    }
  }, [planId]);

  const fetchRiskSources = async () => {
    if (!planId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("adep_risk_sources")
        .select("*")
        .eq("plan_id", planId)
        .order("risk_level", { ascending: false });

      if (error) throw error;
      setRiskSources((data || []) as RiskSource[]);
    } catch (error: any) {
      console.error("Fetch error:", error);
      toast.error("Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.risk_source.trim()) {
      toast.error("Risk kaynağı zorunludur");
      return false;
    }
    if (!formData.location.trim()) {
      toast.error("Konum zorunludur");
      return false;
    }
    if (!formData.potential_impact.trim()) {
      toast.error("Potansiyel etki zorunludur");
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
        risk_source: formData.risk_source,
        location: formData.location,
        risk_level: formData.risk_level,
        potential_impact: formData.potential_impact,
        mitigation_measures: formData.mitigation_measures || null,
        monitoring_frequency: formData.monitoring_frequency || null,
        last_assessment_date: formData.last_assessment_date || null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("adep_risk_sources")
          .update(payload)
          .eq("id", editingItem.id);

        if (error) throw error;
        toast.success("Risk kaynağı güncellendi");
      } else {
        const { error } = await supabase
          .from("adep_risk_sources")
          .insert([payload]);

        if (error) throw error;
        toast.success("Risk kaynağı eklendi");
      }

      setManualDialogOpen(false);
      resetForm();
      fetchRiskSources();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error("Kaydetme hatası", {
        description: error.message || "Bilinmeyen hata",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: RiskSource) => {
    setEditingItem(item);
    setFormData({
      risk_source: item.risk_source,
      location: item.location,
      risk_level: item.risk_level,
      potential_impact: item.potential_impact,
      mitigation_measures: item.mitigation_measures || "",
      monitoring_frequency: item.monitoring_frequency || "",
      last_assessment_date: item.last_assessment_date || "",
    });
    setManualDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu risk kaynağını silmek istediğinizden emin misiniz?"))
      return;

    try {
      const { error } = await supabase
        .from("adep_risk_sources")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Risk kaynağı silindi");
      fetchRiskSources();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Silme hatası");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (
      !confirm(
        `${selectedItems.length} risk kaynağını silmek istediğinizden emin misiniz?`
      )
    )
      return;

    try {
      const { error } = await supabase
        .from("adep_risk_sources")
        .delete()
        .in("id", selectedItems);

      if (error) throw error;
      toast.success(`${selectedItems.length} risk kaynağı silindi`);
      setSelectedItems([]);
      fetchRiskSources();
    } catch (error: any) {
      console.error("Bulk delete error:", error);
      toast.error("Toplu silme hatası");
    }
  };

  const resetForm = () => {
    setFormData({
      risk_source: "",
      location: "",
      risk_level: "medium",
      potential_impact: "",
      mitigation_measures: "",
      monitoring_frequency: "",
      last_assessment_date: "",
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

  const parseExcelData = (data: any[]): ParsedRiskSource[] => {
    return data.map((row) => {
      const errors: string[] = [];
      let isValid = true;

      const risk_source = String(
        row["Risk Kaynağı"] || row.risk_source || ""
      ).trim();
      const location = String(row["Konum"] || row.location || "").trim();
      const risk_level = (
        row["Risk Seviyesi"] || row.risk_level || "medium"
      ) as RiskLevel;
      const potential_impact = String(
        row["Potansiyel Etki"] || row.potential_impact || ""
      ).trim();
      const mitigation_measures =
        String(row["Önlemler"] || row.mitigation_measures || "").trim() || null;
      const monitoring_frequency =
        String(
          row["İzleme Sıklığı"] || row.monitoring_frequency || ""
        ).trim() || null;
      const last_assessment_date =
        row["Son Değerlendirme"] || row.last_assessment_date || null;

      if (!risk_source) {
        errors.push("Risk kaynağı boş olamaz");
        isValid = false;
      }

      if (!location) {
        errors.push("Konum boş olamaz");
        isValid = false;
      }

      if (!potential_impact) {
        errors.push("Potansiyel etki boş olamaz");
        isValid = false;
      }

      const validLevels = ["low", "medium", "high", "critical"];
      if (!validLevels.includes(risk_level)) {
        errors.push(`Geçersiz risk seviyesi: ${risk_level}`);
        isValid = false;
      }

      return {
        risk_source,
        location,
        risk_level,
        potential_impact,
        mitigation_measures,
        monitoring_frequency,
        last_assessment_date,
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
          risk_source: item.risk_source,
          location: item.location,
          risk_level: item.risk_level,
          potential_impact: item.potential_impact,
          mitigation_measures: item.mitigation_measures,
          monitoring_frequency: item.monitoring_frequency,
          last_assessment_date: item.last_assessment_date,
        }));

        const { error } = await supabase.from("adep_risk_sources").insert(payload);

        if (error) {
          console.error("Chunk insert error:", error);
        } else {
          successCount += chunk.length;
        }

        setUploadProgress(
          Math.round(((i + chunk.length) / validItems.length) * 100)
        );
      }

      toast.success(`${successCount} risk kaynağı eklendi`);

      setUploadDialogOpen(false);
      setParsedData([]);
      fetchRiskSources();
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
        "Risk Kaynağı": "Kimyasal Depolama Alanı",
        Konum: "Depo - A Blok",
        "Risk Seviyesi": "high",
        "Potansiyel Etki": "Kimyasal sızıntı, yangın, sağlık riskleri",
        Önlemler:
          "MSDS bulundurma, izolasyon, havalandırma sistemi, acil duş",
        "İzleme Sıklığı": "Günlük",
        "Son Değerlendirme": "2025-02-01",
      },
      {
        "Risk Kaynağı": "Yüksekte Çalışma Alanları",
        Konum: "Üretim - 2. Kat",
        "Risk Seviyesi": "medium",
        "Potansiyel Etki": "Düşme, yaralanma",
        Önlemler: "Korkuluk, emniyet kemeri, düzenli eğitim",
        "İzleme Sıklığı": "Haftalık",
        "Son Değerlendirme": "2025-02-15",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Risk Kaynakları Şablonu");
    XLSX.writeFile(wb, "risk_kaynaklari_sablonu.xlsx");
    toast.success("Şablon indirildi");
  };

  const getRiskLevelBadge = (level: string) => {
    const variants: Record<string, { label: string; color: string }> = {
      low: { label: "Düşük", color: "bg-green-500" },
      medium: { label: "Orta", color: "bg-yellow-500" },
      high: { label: "Yüksek", color: "bg-orange-500" },
      critical: { label: "Kritik", color: "bg-red-500" },
    };

    const variant = variants[level] || variants.medium;

    return (
      <Badge className={`${variant.color} text-white`}>{variant.label}</Badge>
    );
  };

  const filteredRisks = riskSources.filter((item) => {
    const matchesSearch =
      item.risk_source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.potential_impact.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLevel = levelFilter === "all" || item.risk_level === levelFilter;

    return matchesSearch && matchesLevel;
  });

  const stats = {
    total: riskSources.length,
    critical: riskSources.filter((r) => r.risk_level === "critical").length,
    high: riskSources.filter((r) => r.risk_level === "high").length,
    medium: riskSources.filter((r) => r.risk_level === "medium").length,
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
          <h3 className="text-2xl font-bold">Risk Kaynakları Haritası</h3>
          <p className="text-sm text-muted-foreground">
            İşyerindeki potansiyel risk noktaları - Enterprise yönetim
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <AIGenerateButton
            planId={planId}
            module="risk"
            onSuccess={fetchRiskSources}
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
                <DialogTitle>
                  Excel/CSV ile Toplu Risk Kaynağı Yükleme
                </DialogTitle>
                <DialogDescription>
                  Risk kaynaklarını toplu yükleyin
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
                            <TableHead>Risk Kaynağı</TableHead>
                            <TableHead>Konum</TableHead>
                            <TableHead>Seviye</TableHead>
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
                                {item.risk_source}
                              </TableCell>
                              <TableCell>{item.location}</TableCell>
                              <TableCell>
                                {getRiskLevelBadge(item.risk_level)}
                              </TableCell>
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
                  {editingItem
                    ? "Risk Kaynağı Düzenle"
                    : "Yeni Risk Kaynağı Ekle"}
                </DialogTitle>
                <DialogDescription>
                  Risk kaynağını tanımlayın
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="risk_source">
                      Risk Kaynağı <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="risk_source"
                      placeholder="Örn: Kimyasal Depolama Alanı"
                      value={formData.risk_source}
                      onChange={(e) =>
                        setFormData({ ...formData, risk_source: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">
                      Konum <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="location"
                      placeholder="Örn: Depo - A Blok"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="potential_impact">
                    Potansiyel Etki <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="potential_impact"
                    placeholder="Risk gerçekleşirse oluşabilecek etkiler..."
                    rows={3}
                    value={formData.potential_impact}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        potential_impact: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mitigation_measures">Önlemler</Label>
                  <Textarea
                    id="mitigation_measures"
                    placeholder="Alınacak önleyici tedbirler..."
                    rows={3}
                    value={formData.mitigation_measures}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        mitigation_measures: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="risk_level">Risk Seviyesi</Label>
                    <Select
                      value={formData.risk_level}
                      onValueChange={(v: RiskLevel) =>
                        setFormData({ ...formData, risk_level: v })
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

                  <div className="space-y-2">
                    <Label htmlFor="monitoring_frequency">İzleme Sıklığı</Label>
                    <Select
                      value={formData.monitoring_frequency}
                      onValueChange={(v) =>
                        setFormData({ ...formData, monitoring_frequency: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seçiniz" />
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

                  <div className="space-y-2">
                    <Label htmlFor="last_assessment_date">
                      Son Değerlendirme
                    </Label>
                    <Input
                      id="last_assessment_date"
                      type="date"
                      value={formData.last_assessment_date}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          last_assessment_date: e.target.value,
                        })
                      }
                    />
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
                <p className="text-sm text-muted-foreground">Toplam Risk</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <MapPin className="h-8 w-8 text-muted-foreground opacity-20" />
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

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Yüksek</p>
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
                <p className="text-sm text-muted-foreground">Orta</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.medium}
                </p>
              </div>
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
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
                  placeholder="Risk kaynağı veya konum ara..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Risk Seviyesi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="critical">Kritik</SelectItem>
                  <SelectItem value="high">Yüksek</SelectItem>
                  <SelectItem value="medium">Orta</SelectItem>
                  <SelectItem value="low">Düşük</SelectItem>
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
            <MapPin className="h-5 w-5 text-red-500" />
            Risk Noktaları ({filteredRisks.length})
          </CardTitle>
          <CardDescription>
            Konum bazlı risk kaynakları ve önlemler
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : riskSources.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
                <MapPin className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Risk kaynağı belirlenmedi
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                AI ile otomatik oluştur, Excel ile toplu yükle veya manuel ekle
              </p>
              <div className="flex items-center justify-center gap-2">
                <AIGenerateButton
                  planId={planId}
                  module="risk"
                  onSuccess={fetchRiskSources}
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
          ) : filteredRisks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Arama kriterlerine uygun risk kaynağı bulunamadı</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedItems.length === filteredRisks.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedItems(filteredRisks.map((r) => r.id));
                          } else {
                            setSelectedItems([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Risk Kaynağı</TableHead>
                    <TableHead>Konum</TableHead>
                    <TableHead>Risk Seviyesi</TableHead>
                    <TableHead>Potansiyel Etki</TableHead>
                    <TableHead>Önlemler</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRisks.map((item) => (
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
                        {item.risk_source}
                      </TableCell>
                      <TableCell>{item.location}</TableCell>
                      <TableCell>{getRiskLevelBadge(item.risk_level)}</TableCell>
                      <TableCell className="max-w-xs">
                        {item.potential_impact}
                      </TableCell>
                      <TableCell className="max-w-md">
                        {item.mitigation_measures || "-"}
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