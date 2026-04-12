// src/components/adep/ADEPGeneralInfo.tsx

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

interface Company {
  id: string;
  name: string;
  address: string;
  phone: string;
  employee_count: number;
  industry: string;
}

interface ADEPGeneralInfoProps {
  data: any;
  planData: any;
  onChange: (section: string, data: any) => void;
  onPlanDataChange: (section: string, data: any) => void;
}

export default function ADEPGeneralInfo({ 
  data, 
  planData, 
  onChange, 
  onPlanDataChange 
}: ADEPGeneralInfoProps) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    fetchCompanies();
  }, [user]);

  const fetchCompanies = async () => {
    if (!user) return;

    try {
      const { data: companiesData, error } = await supabase
        .from("companies")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (error) throw error;
      setCompanies(companiesData || []);
    } catch (error) {
      console.error("Companies fetch error:", error);
    }
  };

  const handleCompanySelect = (companyId: string) => {
    const company = companies.find((c) => c.id === companyId);
    if (!company) return;

    onChange("company_id", companyId);
    onChange("company_name", company.name);
    onChange("employee_count", company.employee_count);
    onChange("sector", company.industry);

    // İşyeri bilgilerini doldur
    onPlanDataChange("isyeri_bilgileri", {
      ...planData.isyeri_bilgileri,
      adres: company.address || "",
      telefon: company.phone || "",
    });
  };

  const addPreparer = () => {
    const newPreparers = [
      ...planData.genel_bilgiler.hazirlayanlar,
      { unvan: "", ad_soyad: "" }
    ];
    onPlanDataChange("genel_bilgiler", {
      ...planData.genel_bilgiler,
      hazirlayanlar: newPreparers,
    });
  };

  const removePreparer = (index: number) => {
    const newPreparers = planData.genel_bilgiler.hazirlayanlar.filter(
      (_: any, i: number) => i !== index
    );
    onPlanDataChange("genel_bilgiler", {
      ...planData.genel_bilgiler,
      hazirlayanlar: newPreparers,
    });
  };

  const updatePreparer = (index: number, field: string, value: string) => {
    const newPreparers = [...planData.genel_bilgiler.hazirlayanlar];
    newPreparers[index][field] = value;
    onPlanDataChange("genel_bilgiler", {
      ...planData.genel_bilgiler,
      hazirlayanlar: newPreparers,
    });
  };

  return (
    <div className="space-y-6">
      {/* Plan Adı ve Firma Seçimi */}
      <Card>
        <CardHeader>
          <CardTitle>1. İşyeri Bilgileri</CardTitle>
          <CardDescription>
            Plan adı ve firma bilgilerini girin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plan_name">Plan Adı *</Label>
              <Input
                id="plan_name"
                value={data.plan_name}
                onChange={(e) => onChange("plan_name", e.target.value)}
                placeholder="Örn: 2026 Acil Durum Eylem Planı"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Firma Seç *</Label>
              <Select value={data.company_id} onValueChange={handleCompanySelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Firma seçin" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="address">Adres</Label>
              <Input
                id="address"
                value={planData.isyeri_bilgileri.adres}
                onChange={(e) =>
                  onPlanDataChange("isyeri_bilgileri", {
                    ...planData.isyeri_bilgileri,
                    adres: e.target.value,
                  })
                }
                placeholder="İşyeri adresi"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={planData.isyeri_bilgileri.telefon}
                onChange={(e) =>
                  onPlanDataChange("isyeri_bilgileri", {
                    ...planData.isyeri_bilgileri,
                    telefon: e.target.value,
                  })
                }
                placeholder="0212 123 45 67"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="hazard_class">Tehlike Sınıfı</Label>
              <Select
                value={data.hazard_class}
                onValueChange={(value) => {
                  onChange("hazard_class", value);
                  onPlanDataChange("isyeri_bilgileri", {
                    ...planData.isyeri_bilgileri,
                    tehlike_sinifi: value,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Az Tehlikeli">Az Tehlikeli</SelectItem>
                  <SelectItem value="Tehlikeli">Tehlikeli</SelectItem>
                  <SelectItem value="Çok Tehlikeli">Çok Tehlikeli</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee_count">Çalışan Sayısı</Label>
              <Input
                id="employee_count"
                type="number"
                value={data.employee_count}
                onChange={(e) => onChange("employee_count", parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sgk_sicil">SGK Sicil No</Label>
              <Input
                id="sgk_sicil"
                value={planData.isyeri_bilgileri.sgk_sicil_no}
                onChange={(e) =>
                  onPlanDataChange("isyeri_bilgileri", {
                    ...planData.isyeri_bilgileri,
                    sgk_sicil_no: e.target.value,
                  })
                }
                placeholder="12345678"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hazırlayanlar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Hazırlayan Kişiler</CardTitle>
              <CardDescription>
                Planı hazırlayan ve onaylayan kişilerin bilgilerini girin
              </CardDescription>
            </div>
            <Button onClick={addPreparer} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {planData.genel_bilgiler.hazirlayanlar.map((preparer: any, index: number) => (
            <div key={index} className="flex gap-4 items-start">
              <div className="flex-1 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Ünvan</Label>
                  <Input
                    value={preparer.unvan}
                    onChange={(e) => updatePreparer(index, "unvan", e.target.value)}
                    placeholder="İş Güvenliği Uzmanı"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ad Soyad</Label>
                  <Input
                    value={preparer.ad_soyad}
                    onChange={(e) => updatePreparer(index, "ad_soyad", e.target.value)}
                    placeholder="Ahmet Yılmaz"
                  />
                </div>
              </div>
              {index > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removePreparer(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tarihler ve Revizyon */}
      <Card>
        <CardHeader>
          <CardTitle>Tarihler ve Revizyon Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="hazirlanma_tarihi">Hazırlanma Tarihi</Label>
              <Input
                id="hazirlanma_tarihi"
                type="date"
                value={planData.genel_bilgiler.hazirlanma_tarihi}
                onChange={(e) =>
                  onPlanDataChange("genel_bilgiler", {
                    ...planData.genel_bilgiler,
                    hazirlanma_tarihi: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gecerlilik_tarihi">Geçerlilik Tarihi</Label>
              <Input
                id="gecerlilik_tarihi"
                type="date"
                value={planData.genel_bilgiler.gecerlilik_tarihi}
                onChange={(e) =>
                  onPlanDataChange("genel_bilgiler", {
                    ...planData.genel_bilgiler,
                    gecerlilik_tarihi: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="revizyon_no">Revizyon No</Label>
              <Input
                id="revizyon_no"
                value={planData.genel_bilgiler.revizyon_no}
                onChange={(e) =>
                  onPlanDataChange("genel_bilgiler", {
                    ...planData.genel_bilgiler,
                    revizyon_no: e.target.value,
                  })
                }
                placeholder="Rev. 0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="revizyon_tarihi">Revizyon Tarihi</Label>
              <Input
                id="revizyon_tarihi"
                type="date"
                value={planData.genel_bilgiler.revizyon_tarihi}
                onChange={(e) =>
                  onPlanDataChange("genel_bilgiler", {
                    ...planData.genel_bilgiler,
                    revizyon_tarihi: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Toplanma Yeri */}
      <Card>
        <CardHeader>
          <CardTitle>3. Toplanma Yeri</CardTitle>
          <CardDescription>
            İşyerinizin acil durum toplanma noktası bilgilerini girin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="toplanma_yeri">Toplanma Yeri Açıklaması</Label>
            <Textarea
              id="toplanma_yeri"
              value={planData.toplanma_yeri.aciklama}
              onChange={(e) =>
                onPlanDataChange("toplanma_yeri", {
                  ...planData.toplanma_yeri,
                  aciklama: e.target.value,
                })
              }
              placeholder="Toplanma yerinin konumu ve özellikleri..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}