import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Users, MapPin, Phone, Mail, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadCompanyDetail();
    }
  }, [id]);

  const loadCompanyDetail = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      setCompany(data);
    } catch (error: any) {
      console.error("Load company error:", error);
      toast.error("Firma yüklenemedi");
      navigate("/companies");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-900" />
          <div className="space-y-2">
            <div className="h-8 w-64 animate-pulse rounded bg-slate-800" />
            <div className="h-4 w-48 animate-pulse rounded bg-slate-900" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="h-56 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
            <div className="h-72 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
          </div>
          <div className="space-y-6">
            <div className="h-56 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
            <div className="h-56 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
          </div>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">Firma bulunamadı</p>
          <Button onClick={() => navigate("/companies")} className="mt-4">
            Geri Dön
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/companies")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            {company.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Firma Detayları
          </p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Temel Bilgiler */}
        <Card>
          <CardHeader>
            <CardTitle>Temel Bilgiler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Vergi Numarası</p>
              <p className="font-mono font-semibold">{company.tax_number}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">NACE Kodu</p>
              <Badge variant="outline">{company.industry || "-"}</Badge>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Tehlike Sınıfı</p>
              <Badge className={
                company.hazard_class === "Çok Tehlikeli"
                  ? "bg-red-100 text-red-700"
                  : company.hazard_class === "Tehlikeli"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-green-100 text-green-700"
              }>
                {company.hazard_class || "Az Tehlikeli"}
              </Badge>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Çalışan Sayısı</p>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-semibold">{company.employee_count || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* İletişim Bilgileri */}
        <Card>
          <CardHeader>
            <CardTitle>İletişim Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {company.address && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Adres</p>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-primary mt-1" />
                  <p className="text-sm">{company.address}</p>
                </div>
              </div>
            )}

            {company.phone && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Telefon</p>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <p className="text-sm font-mono">{company.phone}</p>
                </div>
              </div>
            )}

            {company.email && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">E-posta</p>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <p className="text-sm">{company.email}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Aksiyonlar */}
      <Card>
        <CardHeader>
          <CardTitle>Hızlı İşlemler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button onClick={() => navigate(`/companies/${id}/edit`)}>
              Düzenle
            </Button>
            <Button variant="outline" onClick={() => navigate(`/risk-assessments?company=${id}`)}>
              Risk Değerlendirmeleri
            </Button>
            <Button variant="outline" onClick={() => navigate(`/employees?company=${id}`)}>
              Çalışanları Görüntüle
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
