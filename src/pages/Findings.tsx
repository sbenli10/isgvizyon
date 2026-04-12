import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Plus, ArrowLeft } from "lucide-react";

export default function Findings() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {id && (
            <Button variant="ghost" size="icon" onClick={() => navigate('/findings')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Search className="h-8 w-8 text-blue-500" />
          <div>
            <h1 className="text-3xl font-bold">
              {id ? 'Bulgu Detayı' : 'Saha Bulguları'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Teftiş bulguları ve düzeltici faaliyetler
            </p>
          </div>
        </div>

        {!id && (
          <Button onClick={() => navigate('/inspections')} className="gap-2">
            <Plus className="h-4 w-4" />
            Yeni Denetim
          </Button>
        )}
      </div>

      {/* Detail View */}
      {id && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="text-blue-600 dark:text-blue-400">
              Bulgu ID: {id}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Durum</p>
              <p className="text-lg font-semibold">Çözülmedi (Termin Geçmiş)</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Açıklama</p>
              <p>Bulgu detay sayfası yapım aşamasında. Bildirim sistemi başarıyla çalışıyor.</p>
            </div>
            <Button onClick={() => navigate('/inspections')}>
              Denetimlere Git
            </Button>
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {!id && (
        <Card>
          <CardHeader>
            <CardTitle>Tüm Saha Bulguları</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg mb-2">Henüz bulgu yok</p>
              <p className="text-sm mb-6">
                Denetimlerden gelen bulgular burada listelenecek
              </p>
              <Button onClick={() => navigate('/inspections')} className="gap-2">
                <Plus className="h-4 w-4" />
                Yeni Denetim Başlat
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}