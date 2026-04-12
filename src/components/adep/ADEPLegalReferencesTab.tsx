// src/components/adep/ADEPLegalReferencesTab.tsx

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
  Scale,
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
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import { format, parseISO } from "date-fns";
import AIGenerateButton from "@/components/adep/AIGenerateButton";
import type { LegalReference } from "@/types/adep-ai";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface ADEPLegalReferencesTabProps {
  planId: string | undefined;
}

type ComplianceStatus = "compliant" | "partial" | "non_compliant";

interface ParsedLegalRef {
  law_name: string;
  article_number: string | null;
  requirement_summary: string;
  compliance_status: ComplianceStatus;
  responsible_person: string | null;
  review_date: string | null;
  isValid: boolean;
  errors: string[];
}

export default function ADEPLegalReferencesTab({
  planId,
}: ADEPLegalReferencesTabProps) {
  const [legalRefs, setLegalRefs] = useState<LegalReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LegalReference | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<ParsedLegalRef[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [formData, setFormData] = useState({
    law_name: "",
    article_number: "",
    requirement_summary: "",
    compliance_status: "compliant" as ComplianceStatus,
    responsible_person: "",
    review_date: "",
  });

  useEffect(() => {
    if (planId) {
      fetchLegalRefs();
    }
  }, [planId]);

  const fetchLegalRefs = async () => {
    if (!planId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("adep_legal_references")
        .select("*")
        .eq("plan_id", planId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLegalRefs((data || []) as LegalReference[]);
    } catch (error: any) {
      console.error("Fetch error:", error);
      toast.error("Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.law_name.trim()) {
      toast.error("Kanun/Yönetmelik adı zorunludur");
      return false;
    }
    if (!formData.requirement_summary.trim()) {
      toast.error("Gereklilik özeti zorunludur");
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
        law_name: formData.law_name,
        article_number: formData.article_number || null,
        requirement_summary: formData.requirement_summary,
        compliance_status: formData.compliance_status,
        responsible_person: formData.responsible_person || null,
        review_date: formData.review_date || null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("adep_legal_references")
          .update(payload)
          .eq("id", editingItem.id);

        if (error) throw error;
        toast.success("Mevzuat referansı güncellendi");
      } else {
        const { error } = await supabase
          .from("adep_legal_references")
          .insert([payload]);

        if (error) throw error;
        toast.success("Mevzuat referansı eklendi");
      }

      setManualDialogOpen(false);
      resetForm();
      fetchLegalRefs();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error("Kaydetme hatası", {
        description: error.message || "Bilinmeyen hata",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: LegalReference) => {
    setEditingItem(item);
    setFormData({
      law_name: item.law_name,
      article_number: item.article_number || "",
      requirement_summary: item.requirement_summary,
      compliance_status: item.compliance_status,
      responsible_person: item.responsible_person || "",
      review_date: item.review_date || "",
    });
    setManualDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm("Bu mevzuat referansını silmek istediğinizden emin misiniz?")
    )
      return;

    try {
      const { error } = await supabase
        .from("adep_legal_references")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Mevzuat referansı silindi");
      fetchLegalRefs();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Silme hatası");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (
      !confirm(
        `${selectedItems.length} mevzuat referansını silmek istediğinizden emin misiniz?`
      )
    )
      return;

    try {
      const { error } = await supabase
        .from("adep_legal_references")
        .delete()
        .in("id", selectedItems);

      if (error) throw error;
      toast.success(`${selectedItems.length} mevzuat referansı silindi`);
      setSelectedItems([]);
      fetchLegalRefs();
    } catch (error: any) {
      console.error("Bulk delete error:", error);
      toast.error("Toplu silme hatası");
    }
  };

  const resetForm = () => {
    setFormData({
      law_name: "",
      article_number: "",
      requirement_summary: "",
      compliance_status: "compliant",
      responsible_person: "",
      review_date: "",
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

  const parseExcelData = (data: any[]): ParsedLegalRef[] => {
    return data.map((row) => {
      const errors: string[] = [];
      let isValid = true;

      const law_name = String(
        row["Kanun/Yönetmelik"] || row.law_name || ""
      ).trim();
      const article_number =
        String(row["Madde No"] || row.article_number || "").trim() || null;
      const requirement_summary = String(
        row["Gereklilik Özeti"] || row.requirement_summary || ""
      ).trim();
      const compliance_status = (
        row["Uyum Durumu"] || row.compliance_status || "compliant"
      ) as ComplianceStatus;
      const responsible_person =
        String(row["Sorumlu"] || row.responsible_person || "").trim() || null;
      const review_date = row["İnceleme Tarihi"] || row.review_date || null;

      if (!law_name) {
        errors.push("Kanun/Yönetmelik adı boş olamaz");
        isValid = false;
      }

      if (!requirement_summary) {
        errors.push("Gereklilik özeti boş olamaz");
        isValid = false;
      }

      return {
        law_name,
        article_number,
        requirement_summary,
        compliance_status,
        responsible_person,
        review_date,
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
          law_name: item.law_name,
          article_number: item.article_number,
          requirement_summary: item.requirement_summary,
          compliance_status: item.compliance_status,
          responsible_person: item.responsible_person,
          review_date: item.review_date,
        }));

        const { error } = await supabase
          .from("adep_legal_references")
          .insert(payload);

        if (error) {
          console.error("Chunk insert error:", error);
        } else {
          successCount += chunk.length;
        }

        setUploadProgress(
          Math.round(((i + chunk.length) / validItems.length) * 100)
        );
      }

      toast.success(`${successCount} mevzuat referansı eklendi`);

      setUploadDialogOpen(false);
      setParsedData([]);
      fetchLegalRefs();
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
        "Kanun/Yönetmelik": "6331 Sayılı İSG Kanunu",
        "Madde No": "Madde 11",
        "Gereklilik Özeti":
          "İşveren acil durum planları hazırlamalı ve tatbikat yaptırmalıdır",
        "Uyum Durumu": "compliant",
        Sorumlu: "İSG Uzmanı",
        "İnceleme Tarihi": "2025-06-01",
      },
      {
        "Kanun/Yönetmelik": "Acil Durumlar Hakkında Yönetmelik",
        "Madde No": "Madde 5",
        "Gereklilik Özeti":
          "Acil durum ekipleri oluşturulmalı ve görevlendirilmelidir",
        "Uyum Durumu": "compliant",
        Sorumlu: "İşveren Vekili",
        "İnceleme Tarihi": "2025-06-01",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mevzuat Şablonu");
    XLSX.writeFile(wb, "mevzuat_sablonu.xlsx");
    toast.success("Şablon indirildi");
  };

  const getComplianceBadge = (status: string) => {
    const variants: Record<string, { label: string; color: string }> = {
      compliant: { label: "Uyumlu", color: "bg-green-500" },
      partial: { label: "Kısmi Uyum", color: "bg-yellow-500" },
      non_compliant: { label: "Uyumsuz", color: "bg-red-500" },
    };

    const variant = variants[status] || variants.compliant;

    return (
      <Badge className={`${variant.color} text-white`}>{variant.label}</Badge>
    );
  };

  const filteredRefs = legalRefs.filter((item) => {
    const matchesSearch =
      item.law_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.requirement_summary
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      item.article_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || item.compliance_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: legalRefs.length,
    compliant: legalRefs.filter((r) => r.compliance_status === "compliant")
      .length,
    partial: legalRefs.filter((r) => r.compliance_status === "partial").length,
    non_compliant: legalRefs.filter(
      (r) => r.compliance_status === "non_compliant"
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
          <h3 className="text-2xl font-bold">Mevzuat Referansları</h3>
          <p className="text-sm text-muted-foreground">
            İlgili kanun ve yönetmelik maddeleri - Enterprise yönetim
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <AIGenerateButton
            planId={planId}
            module="legal"
            onSuccess={fetchLegalRefs}
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
                  Excel/CSV ile Toplu Mevzuat Referansı Yükleme
                </DialogTitle>
                <DialogDescription>
                  İlgili mevzuat maddelerini toplu yükleyin
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
                            <TableHead>Kanun/Yönetmelik</TableHead>
                            <TableHead>Madde</TableHead>
                            <TableHead>Gereklilik</TableHead>
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
                                {item.law_name}
                              </TableCell>
                              <TableCell>{item.article_number || "-"}</TableCell>
                              <TableCell className="max-w-xs truncate">
                                {item.requirement_summary}
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
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingItem
                    ? "Mevzuat Referansı Düzenle"
                    : "Yeni Mevzuat Referansı Ekle"}
                </DialogTitle>
                <DialogDescription>
                  İlgili mevzuat maddesini tanımlayın
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="law_name">
                      Kanun/Yönetmelik{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="law_name"
                      placeholder="Örn: 6331 Sayılı İSG Kanunu"
                      value={formData.law_name}
                      onChange={(e) =>
                        setFormData({ ...formData, law_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="article_number">Madde No</Label>
                    <Input
                      id="article_number"
                      placeholder="Örn: Madde 11"
                      value={formData.article_number}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          article_number: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requirement_summary">
                    Gereklilik Özeti <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="requirement_summary"
                    placeholder="Maddede belirtilen gerekliliği özetleyin..."
                    rows={4}
                    value={formData.requirement_summary}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        requirement_summary: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="compliance_status">Uyum Durumu</Label>
                    <Select
                      value={formData.compliance_status}
                      onValueChange={(v: ComplianceStatus) =>
                        setFormData({ ...formData, compliance_status: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compliant">Uyumlu</SelectItem>
                        <SelectItem value="partial">Kısmi Uyum</SelectItem>
                        <SelectItem value="non_compliant">Uyumsuz</SelectItem>
                      </SelectContent>
                    </Select>
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

                  <div className="space-y-2">
                    <Label htmlFor="review_date">İnceleme Tarihi</Label>
                    <Input
                      id="review_date"
                      type="date"
                      value={formData.review_date}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          review_date: e.target.value,
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
                <p className="text-sm text-muted-foreground">Toplam Madde</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Scale className="h-8 w-8 text-muted-foreground opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Uyumlu</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.compliant}
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
                <p className="text-sm text-muted-foreground">Kısmi Uyum</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.partial}
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
                <p className="text-sm text-muted-foreground">Uyumsuz</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.non_compliant}
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
                  placeholder="Kanun, madde veya gereklilik ara..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Uyum Durumu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="compliant">Uyumlu</SelectItem>
                  <SelectItem value="partial">Kısmi Uyum</SelectItem>
                  <SelectItem value="non_compliant">Uyumsuz</SelectItem>
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
            <Scale className="h-5 w-5 text-amber-500" />
            Yasal Düzenlemeler ({filteredRefs.length})
          </CardTitle>
          <CardDescription>
            6331 sayılı Kanun ve ilgili yönetmelikler
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : legalRefs.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 mb-4">
                <Scale className="h-8 w-8 text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Mevzuat referansı eklenmedi
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                AI ile otomatik oluştur, Excel ile toplu yükle veya manuel ekle
              </p>
              <div className="flex items-center justify-center gap-2">
                <AIGenerateButton
                  planId={planId}
                  module="legal"
                  onSuccess={fetchLegalRefs}
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
          ) : filteredRefs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Arama kriterlerine uygun mevzuat bulunamadı</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedItems.length === filteredRefs.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedItems(filteredRefs.map((r) => r.id));
                          } else {
                            setSelectedItems([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Kanun/Yönetmelik</TableHead>
                    <TableHead>Madde</TableHead>
                    <TableHead>Gereklilik Özeti</TableHead>
                    <TableHead>Uyum Durumu</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRefs.map((item) => (
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
                        {item.law_name}
                      </TableCell>
                      <TableCell>{item.article_number || "-"}</TableCell>
                      <TableCell className="max-w-md">
                        {item.requirement_summary}
                      </TableCell>
                      <TableCell>
                        {getComplianceBadge(item.compliance_status)}
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