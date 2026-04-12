// src/components/adep/ADEPPreventiveMeasuresTab.tsx

import { useState, useEffect } from "react";
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
import {
  Plus,
  AlertTriangle,
  Loader2,
  Trash2,
  Edit,
  Download,
  Filter,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import AIGenerateButton from "@/components/adep/AIGenerateButton";
import type { PreventiveMeasure } from "@/types/adep-ai";
import { Separator } from "@/components/ui/separator";

interface ADEPPreventiveMeasuresTabProps {
  planId: string | undefined;
}

export default function ADEPPreventiveMeasuresTab({
  planId,
}: ADEPPreventiveMeasuresTabProps) {
  const [measures, setMeasures] = useState<PreventiveMeasure[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMeasure, setEditingMeasure] = useState<PreventiveMeasure | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Form state
  const [formData, setFormData] = useState({
    risk_type: "",
    preventive_action: "",
    responsible_role: "",
    control_period: "Aylık",
    status: "pending" as "pending" | "in_progress" | "completed",
  });

  useEffect(() => {
    if (planId) {
      fetchMeasures();
    }
  }, [planId]);

  const fetchMeasures = async () => {
    if (!planId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("adep_preventive_measures")
        .select("*")
        .eq("plan_id", planId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMeasures((data || []) as PreventiveMeasure[]);
    } catch (error: any) {
      console.error("Fetch error:", error);
      toast.error("Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!planId) return;

    if (
      !formData.risk_type.trim() ||
      !formData.preventive_action.trim() ||
      !formData.responsible_role.trim()
    ) {
      toast.error("Lütfen tüm zorunlu alanları doldurun");
      return;
    }

    setSaving(true);
    try {
      if (editingMeasure) {
        // Update existing
        const { error } = await supabase
          .from("adep_preventive_measures")
          .update({
            risk_type: formData.risk_type,
            preventive_action: formData.preventive_action,
            responsible_role: formData.responsible_role,
            control_period: formData.control_period,
            status: formData.status,
          })
          .eq("id", editingMeasure.id);

        if (error) throw error;
        toast.success("Tedbir güncellendi");
      } else {
        // Insert new
        const { error } = await supabase
          .from("adep_preventive_measures")
          .insert([
            {
              plan_id: planId,
              risk_type: formData.risk_type,
              preventive_action: formData.preventive_action,
              responsible_role: formData.responsible_role,
              control_period: formData.control_period,
              status: formData.status,
            },
          ]);

        if (error) throw error;
        toast.success("Tedbir eklendi");
      }

      setDialogOpen(false);
      resetForm();
      fetchMeasures();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error("Kaydetme hatası", {
        description: error.message || "Bilinmeyen hata",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu tedbiri silmek istediğinizden emin misiniz?")) return;

    try {
      const { error } = await supabase
        .from("adep_preventive_measures")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Tedbir silindi");
      fetchMeasures();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Silme hatası");
    }
  };

  const handleEdit = (measure: PreventiveMeasure) => {
    setEditingMeasure(measure);
    setFormData({
      risk_type: measure.risk_type,
      preventive_action: measure.preventive_action,
      responsible_role: measure.responsible_role,
      control_period: measure.control_period,
      status: measure.status,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      risk_type: "",
      preventive_action: "",
      responsible_role: "",
      control_period: "Aylık",
      status: "pending",
    });
    setEditingMeasure(null);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; color: string }> = {
      pending: { label: "Beklemede", color: "bg-yellow-500" },
      in_progress: { label: "Devam Ediyor", color: "bg-blue-500" },
      completed: { label: "Tamamlandı", color: "bg-green-500" },
    };

    const variant = variants[status] || variants.pending;

    return (
      <Badge className={`${variant.color} text-white`}>{variant.label}</Badge>
    );
  };

  // Filtering
  const filteredMeasures = measures.filter((m) => {
    const matchesSearch =
      m.risk_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.preventive_action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.responsible_role.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || m.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Statistics
  const stats = {
    total: measures.length,
    pending: measures.filter((m) => m.status === "pending").length,
    in_progress: measures.filter((m) => m.status === "in_progress").length,
    completed: measures.filter((m) => m.status === "completed").length,
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
          <h3 className="text-2xl font-bold">Önleyici ve Sınırlandırıcı Tedbir Matrisi</h3>
          <p className="text-sm text-muted-foreground">
            Risk türlerine göre önleyici tedbirler ve kontrol periyotları
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <AIGenerateButton
            planId={planId}
            module="preventive"
            onSuccess={fetchMeasures}
            disabled={loading}
          />

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="gap-2"
                onClick={() => {
                  resetForm();
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Manuel Ekle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingMeasure ? "Tedbiri Düzenle" : "Yeni Tedbir Ekle"}
                </DialogTitle>
                <DialogDescription>
                  Risk türü ve önleyici aksiyonları tanımlayın
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="risk_type">
                      Risk Türü <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="risk_type"
                      placeholder="Örn: Yangın, Deprem, Kimyasal Sızıntı"
                      value={formData.risk_type}
                      onChange={(e) =>
                        setFormData({ ...formData, risk_type: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="responsible_role">
                      Sorumlu Rol <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="responsible_role"
                      placeholder="Örn: İSG Uzmanı, Ekip Lideri"
                      value={formData.responsible_role}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          responsible_role: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preventive_action">
                    Önleyici Aksiyon <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="preventive_action"
                    placeholder="Detaylı önleyici aksiyon tanımı yazın..."
                    rows={4}
                    value={formData.preventive_action}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        preventive_action: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="control_period">Kontrol Periyodu</Label>
                    <Select
                      value={formData.control_period}
                      onValueChange={(value) =>
                        setFormData({ ...formData, control_period: value })
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

                  <div className="space-y-2">
                    <Label htmlFor="status">Durum</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: any) =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Beklemede</SelectItem>
                        <SelectItem value="in_progress">Devam Ediyor</SelectItem>
                        <SelectItem value="completed">Tamamlandı</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
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
              <AlertTriangle className="h-8 w-8 text-muted-foreground opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Beklemede</p>
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
                <p className="text-sm text-muted-foreground">Devam Ediyor</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.in_progress}
                </p>
              </div>
              <div className="h-3 w-3 rounded-full bg-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tamamlandı</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.completed}
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
                  placeholder="Risk türü, aksiyon veya sorumlu ara..."
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
                  <SelectValue placeholder="Durum Filtresi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="pending">Beklemede</SelectItem>
                  <SelectItem value="in_progress">Devam Ediyor</SelectItem>
                  <SelectItem value="completed">Tamamlandı</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Önleyici Tedbirler ({filteredMeasures.length})
          </CardTitle>
          <CardDescription>
            Her risk türü için tanımlanmış önleyici aksiyonlar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : measures.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/10 mb-4">
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Henüz tedbir eklenmedi
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                AI ile otomatik oluştur veya manuel olarak kendiniz ekleyin
              </p>
              <div className="flex items-center justify-center gap-2">
                <AIGenerateButton
                  planId={planId}
                  module="preventive"
                  onSuccess={fetchMeasures}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Manuel Ekle
                </Button>
              </div>
            </div>
          ) : filteredMeasures.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Arama kriterlerine uygun tedbir bulunamadı</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Risk Türü</TableHead>
                    <TableHead>Önleyici Aksiyon</TableHead>
                    <TableHead>Sorumlu Rol</TableHead>
                    <TableHead>Kontrol Periyodu</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMeasures.map((measure) => (
                    <TableRow key={measure.id}>
                      <TableCell className="font-medium">
                        {measure.risk_type}
                      </TableCell>
                      <TableCell className="max-w-md">
                        {measure.preventive_action}
                      </TableCell>
                      <TableCell>{measure.responsible_role}</TableCell>
                      <TableCell>{measure.control_period}</TableCell>
                      <TableCell>{getStatusBadge(measure.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(measure)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(measure.id)}
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