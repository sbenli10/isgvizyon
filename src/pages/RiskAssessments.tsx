import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Plus } from "lucide-react";

export default function RiskAssessments() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCompanyId = searchParams.get("companyId") || "";
  const contextSuffix = activeCompanyId
    ? `?companyId=${encodeURIComponent(activeCompanyId)}`
    : "";

  return (
    <div className="space-y-6">
      {activeCompanyId ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Firma baglami aktif</p>
              <p className="text-sm text-muted-foreground">
                Firma 360 baglamindan acildigi icin yeni risk akisi secili firma ile baslar.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete("companyId");
                setSearchParams(next);
              }}
            >
              Baglami kaldir
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {id ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/risk-assessments${contextSuffix}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : null}
          <AlertTriangle className="h-8 w-8 text-orange-500" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {id ? "Risk Detayi" : "Risk Degerlendirmeleri"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Risk takip ve yonetim sistemi
            </p>
          </div>
        </div>

        {!id ? (
          <Button onClick={() => navigate(`/risk-wizard${contextSuffix}`)} className="gap-2">
            <Plus className="h-4 w-4" />
            Yeni Risk Degerlendirmesi
          </Button>
        ) : null}
      </div>

      {id ? (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="text-orange-600 dark:text-orange-400">
              Risk ID: {id}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Durum</p>
              <p className="text-lg font-semibold text-foreground">Bu risk bildirimden geldi</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Aciklama</p>
              <p className="text-foreground">
                Risk detay sayfasi daha derin filtrelerle gelistiriliyor. Firma
                baglami korunarak wizard ve editor akisina gecis yapabilirsiniz.
              </p>
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={() => navigate(`/risk-wizard${contextSuffix}`)}>
                Risk Wizard'a Git
              </Button>
              <Button variant="outline" onClick={() => navigate(`/risk-editor${contextSuffix}`)}>
                Risk Editor'e Git
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Tum Risk Degerlendirmeleri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-12 text-center text-muted-foreground">
              <AlertTriangle className="mx-auto mb-4 h-16 w-16 opacity-20" />
              <p className="mb-2 text-lg">Henüz risk değerlendirmesi yok</p>
              <p className="mb-6 text-sm">
                Bildirim sisteminden gelen riskler burada listelenecek
              </p>
              <Button onClick={() => navigate(`/risk-wizard${contextSuffix}`)} className="gap-2">
                <Plus className="h-4 w-4" />
                Ilk Risk Degerlendirmesini Olustur
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
