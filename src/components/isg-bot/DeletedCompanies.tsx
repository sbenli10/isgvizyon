// src/components/isg-bot/DeletedCompanies.tsx

"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Loader2,
  Calendar,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

// ====================================================
// TYPES
// ====================================================

interface DeletedCompany {
  deleted_record_id: string;
  original_company_id: string;
  company_name: string;
  sgk_no: string;
  employee_count: number;
  hazard_class: string;
  deleted_at: string;
  deleted_by_name: string | null;
  deletion_reason: string | null;
  restored_at: string | null;
  restored_by_name: string | null;
}

// ====================================================
// COMPONENT
// ====================================================

export default function DeletedCompanies() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deletedCompanies, setDeletedCompanies] = useState<DeletedCompany[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [permanentlyDeleting, setPermanentlyDeleting] = useState<string | null>(
    null
  );

  // ====================================================
  // LOAD DATA
  // ====================================================

  useEffect(() => {
    if (user) {
      loadDeletedCompanies();
    }
  }, [user]);

  const loadDeletedCompanies = async () => {
    if (!user) {
      toast.error("Kullanıcı oturumu bulunamadı");
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const orgId = user.id;

      console.log("🔄 Loading deleted companies...");
      console.log("📍 Org ID:", orgId);

      const { data, error } = await supabase
        .from("isgkatip_deleted_companies_view")
        .select("*")
        .eq("org_id", orgId)
        .is("restored_at", null)
        .order("deleted_at", { ascending: false });

      if (error) {
        console.error("❌ Load error:", error);
        throw error;
      }

      console.log("✅ Deleted companies loaded:", data?.length || 0);

      setDeletedCompanies(data || []);

      if (data && data.length > 0) {
        toast.success(`${data.length} silinmiş firma bulundu`);
      }
    } catch (error: any) {
      console.error("❌ Load deleted companies error:", error);
      toast.error("Silinmiş firmalar yüklenemedi", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // ====================================================
  // RESTORE
  // ====================================================

  const handleRestore = async (deletedRecordId: string, companyName: string) => {
    if (!confirm(`"${companyName}" firmasını geri getirmek istediğinizden emin misiniz?`)) {
      return;
    }

    setRestoring(deletedRecordId);

    try {
      console.log("🔄 Restoring company:", deletedRecordId);

      const { data, error } = await supabase.rpc("restore_isgkatip_company", {
        p_deleted_record_id: deletedRecordId,
      });

      if (error) {
        console.error("❌ Restore error:", error);
        throw error;
      }

      console.log("✅ Company restored:", data);

      toast.success(`${companyName} başarıyla geri getirildi`, {
        description: "Firma aktif firmalar listesine eklendi",
      });

      // Reload list
      await loadDeletedCompanies();
    } catch (error: any) {
      console.error("❌ Restore error:", error);
      toast.error("Firma geri getirilemedi", {
        description: error.message,
      });
    } finally {
      setRestoring(null);
    }
  };

  // ====================================================
  // PERMANENT DELETE
  // ====================================================

  const handlePermanentDelete = async (
    deletedRecordId: string,
    companyName: string
  ) => {
    setPermanentlyDeleting(deletedRecordId);

    try {
      console.log("🗑️ Permanently deleting company:", deletedRecordId);

      const { data, error } = await supabase.rpc(
        "permanently_delete_isgkatip_company",
        {
          p_deleted_record_id: deletedRecordId,
        }
      );

      if (error) {
        console.error("❌ Permanent delete error:", error);
        throw error;
      }

      console.log("✅ Company permanently deleted:", data);

      toast.success(`${companyName} kalıcı olarak silindi`, {
        description: "Bu işlem geri alınamaz",
      });

      // Reload list
      await loadDeletedCompanies();
    } catch (error: any) {
      console.error("❌ Permanent delete error:", error);
      toast.error("Firma kalıcı olarak silinemedi", {
        description: error.message,
      });
    } finally {
      setPermanentlyDeleting(null);
    }
  };

  // ====================================================
  // LOADING STATE
  // ====================================================

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-52 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-72 animate-pulse rounded bg-slate-900" />
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-48 animate-pulse rounded bg-slate-800" />
            <div className="h-4 w-72 animate-pulse rounded bg-slate-900" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-900/70" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/isg-bot")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Geri Dön
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Silme Geçmişi</h1>
          <p className="text-muted-foreground">
            Silinmiş firmaları geri getirin veya kalıcı olarak silin
          </p>
        </div>
      </div>

      <Separator />

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Silinmiş Firmalar ({deletedCompanies.length})</span>
            {deletedCompanies.length > 0 && (
              <Badge variant="secondary">
                {deletedCompanies.length} kayıt
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Bu firmalar soft delete ile silinmiştir ve geri getirilebilir
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deletedCompanies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <div className="absolute inset-0 blur-3xl bg-emerald-500/20 animate-pulse" />
                <AlertTriangle className="relative h-16 w-16 text-emerald-500" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">
                  Silinmiş Firma Yok
                </h3>
                <p className="text-sm text-muted-foreground">
                  Henüz hiçbir firma silinmemiş
                </p>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Firma</TableHead>
                    <TableHead className="font-semibold">SGK No</TableHead>
                    <TableHead className="font-semibold">Çalışan</TableHead>
                    <TableHead className="font-semibold">Tehlike</TableHead>
                    <TableHead className="font-semibold">
                      Silinme Tarihi
                    </TableHead>
                    <TableHead className="font-semibold">Silen Kişi</TableHead>
                    <TableHead className="font-semibold">Neden</TableHead>
                    <TableHead className="text-right font-semibold">
                      İşlem
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedCompanies.map((company) => (
                    <TableRow
                      key={company.deleted_record_id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <TableCell>
                        <div className="font-medium">
                          {company.company_name}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {company.sgk_no}
                      </TableCell>
                      <TableCell>{company.employee_count}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            company.hazard_class === "Çok Tehlikeli"
                              ? "destructive"
                              : company.hazard_class === "Tehlikeli"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {company.hazard_class}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {new Date(company.deleted_at).toLocaleString("tr-TR")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {company.deleted_by_name || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {company.deletion_reason || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleRestore(
                                company.deleted_record_id,
                                company.company_name
                              )
                            }
                            disabled={
                              restoring === company.deleted_record_id ||
                              permanentlyDeleting === company.deleted_record_id
                            }
                          >
                            {restoring === company.deleted_record_id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4 mr-2" />
                            )}
                            Geri Getir
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={
                                  restoring === company.deleted_record_id ||
                                  permanentlyDeleting ===
                                    company.deleted_record_id
                                }
                              >
                                {permanentlyDeleting ===
                                company.deleted_record_id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 mr-2" />
                                )}
                                Kalıcı Sil
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                                  <AlertTriangle className="h-5 w-5" />
                                  Kalıcı Olarak Sil?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="space-y-2">
                                  <p className="font-semibold">
                                    <strong>{company.company_name}</strong>{" "}
                                    firması kalıcı olarak silinecek.
                                  </p>
                                  <p className="text-destructive">
                                    Bu işlem GERİ ALINAMAZ!
                                  </p>
                                  <p className="text-sm">
                                    Firma veritabanından tamamen silinecek ve
                                    hiçbir şekilde geri getirilemeyecek.
                                  </p>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    handlePermanentDelete(
                                      company.deleted_record_id,
                                      company.company_name
                                    )
                                  }
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Evet, Kalıcı Olarak Sil
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
