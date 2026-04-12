// src/components/adep/ADEPLegislationTab.tsx

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

interface ADEPLegislationTabProps {
  data: {
    amac: string;
    kapsam: string;
    dayanak: string;
    tanimlar: string;
  };
  onChange: (data: any) => void;
}

export default function ADEPLegislationTab({ data, onChange }: ADEPLegislationTabProps) {
  const updateField = (field: string, value: string) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <BookOpen className="h-5 w-5" />
        <p className="text-sm">
          Bu bölümdeki metinler İSG mevzuatına göre hazırlanmış standart metinlerdir.
          İhtiyaç durumunda düzenleyebilirsiniz.
        </p>
      </div>

      {/* Amaç */}
      <Card>
        <CardHeader>
          <CardTitle>1. Amaç</CardTitle>
          <CardDescription>
            Planın hazırlanma amacı
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={data.amac}
            onChange={(e) => updateField("amac", e.target.value)}
            rows={4}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* Kapsam */}
      <Card>
        <CardHeader>
          <CardTitle>2. Kapsam</CardTitle>
          <CardDescription>
            Planın kapsadığı alanlar ve kişiler
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={data.kapsam}
            onChange={(e) => updateField("kapsam", e.target.value)}
            rows={3}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* Dayanak */}
      <Card>
        <CardHeader>
          <CardTitle>3. Dayanak</CardTitle>
          <CardDescription>
            Yasal dayanak ve mevzuat bilgileri
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={data.dayanak}
            onChange={(e) => updateField("dayanak", e.target.value)}
            rows={3}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* Tanımlar */}
      <Card>
        <CardHeader>
          <CardTitle>4. Tanımlar</CardTitle>
          <CardDescription>
            Planda kullanılan terimler ve açıklamaları
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={data.tanimlar}
            onChange={(e) => updateField("tanimlar", e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>
    </div>
  );
}