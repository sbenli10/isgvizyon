import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Plus, ArrowLeft } from "lucide-react";

export default function RiskAssessments() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {id && (
            <Button variant="ghost" size="icon" onClick={() => navigate('/risk-assessments')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <AlertTriangle className="h-8 w-8 text-orange-500" />
          <div>
            <h1 className="text-3xl font-bold">
              {id ? 'Risk Detayı' : 'Risk Değerlendirmeleri'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Risk takip ve yönetim sistemi
            </p>
          </div>
        </div>

        {!id && (
          <Button onClick={() => navigate('/risk-wizard')} className="gap-2">
            <Plus className="h-4 w-4" />
            Yeni Risk Değerlendirmesi
          </Button>
        )}
      </div>

      {/* Detail View */}
      {id && (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="text-orange-600 dark:text-orange-400">
              Risk ID: {id}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Durum</p>
              <p className="text-lg font-semibold">Bu risk bildirimden geldi</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Açıklama</p>
              <p>Risk detay sayfası yapım aşamasında. Bildirim sistemi başarıyla çalışıyor.</p>
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={() => navigate('/risk-wizard')}>
                Risk Wizard'a Git
              </Button>
              <Button variant="outline" onClick={() => navigate('/risk-editor')}>
                Risk Editor'e Git
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {!id && (
        <Card>
          <CardHeader>
            <CardTitle>Tüm Risk Değerlendirmeleri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg mb-2">Henüz risk değerlendirmesi yok</p>
              <p className="text-sm mb-6">
                Bildirim sisteminden gelen riskler burada listelenecek
              </p>
              <Button onClick={() => navigate('/risk-wizard')} className="gap-2">
                <Plus className="h-4 w-4" />
                İlk Risk Değerlendirmesini Oluştur
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}