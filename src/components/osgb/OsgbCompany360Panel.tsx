import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Building2,
  CalendarRange,
  CreditCard,
  FileArchive,
  FileCheck,
  Globe2,
  GraduationCap,
  MapPinned,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OsgbCompany360Snapshot, OsgbManagedCompanyRecord } from "@/lib/osgbPlatform";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR");
};

const buildCompanyHref = (basePath: string, companyId: string) => `${basePath}?companyId=${encodeURIComponent(companyId)}`;

export function OsgbCompany360Panel({
  company,
  snapshot,
}: {
  company: OsgbManagedCompanyRecord | null;
  snapshot: OsgbCompany360Snapshot | null;
}) {
  const navigate = useNavigate();

  const serviceLinks = useMemo(() => {
    if (!company) return [];
    return [
      { title: "Kurul Toplantıları", description: "Toplantı, karar ve tutanak akışını bu firma için açın.", href: buildCompanyHref("/board-meetings", company.id), icon: Briefcase },
      { title: "Risk Değerlendirmesi", description: "Risk sihirbazı ve editörü firma bağlamında açın.", href: buildCompanyHref("/risk-assessments", company.id), icon: ShieldAlert },
      { title: "İş Kazası / DÖF", description: "Incident, kök neden ve CAPA akışını firma için yönetin.", href: buildCompanyHref("/incidents", company.id), icon: ShieldAlert },
      { title: "Yıllık Plan / Eğitim", description: "Plan, eğitim ve değerlendirme çıktıları üretin.", href: buildCompanyHref("/annual-plans", company.id), icon: GraduationCap },
      { title: "Sertifika / Katılım", description: "Eğitim çıktıları ve sertifika üretimini bu firma için açın.", href: buildCompanyHref("/dashboard/certificates", company.id), icon: GraduationCap },
      { title: "Arşiv / Raporlar", description: "Rapor geçmişi ve kütüphane çıktılarının arşiv katmanına gidin.", href: buildCompanyHref("/reports", company.id), icon: FileArchive },
    ];
  }, [company]);

  if (!company || !snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Firma 360</CardTitle>
          <CardDescription>Detay görmek için havuzdan bir firma seçin.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{company.companyName}</CardTitle>
              <Badge variant="outline">{company.hazardClass}</Badge>
              <Badge variant="outline">{company.employeeCount} çalışan</Badge>
            </div>
            <CardDescription>
              Firma 360 bu müşterinin operasyon, hizmet, evrak, finans ve hizmet modüllerini tek merkezde toplar.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate(buildCompanyHref("/osgb/company-tracking", company.id))}>
              <Building2 className="mr-2 h-4 w-4" />
              Havuz kaydını aç
            </Button>
            <Button size="sm" onClick={() => navigate(buildCompanyHref("/osgb/how-to", company.id))}>
              Nasıl kullanılır
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="health" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl border border-border bg-muted/30 p-2 lg:grid-cols-4">
            <TabsTrigger value="health" className="rounded-xl">Genel Sağlık</TabsTrigger>
            <TabsTrigger value="operations" className="rounded-xl">Operasyon</TabsTrigger>
            <TabsTrigger value="service-modules" className="rounded-xl">Hizmet Modülleri</TabsTrigger>
            <TabsTrigger value="records" className="rounded-xl">Arşiv ve Portal</TabsTrigger>
          </TabsList>

          <TabsContent value="health" className="mt-0 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Dakika durumu</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{snapshot.assignedMinutes}/{snapshot.requiredMinutes} dk</div>
                <div className="mt-1 text-sm text-muted-foreground">Eksik hizmet: {snapshot.deficitMinutes} dk</div>
              </div>
              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Cari durumu</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{formatMoney(snapshot.currentBalance)}</div>
                <div className="mt-1 text-sm text-muted-foreground">Geciken bakiye: {formatMoney(snapshot.overdueBalance)}</div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-sm text-muted-foreground">Aktif atama</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{snapshot.activeAssignments}</div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-sm text-muted-foreground">Saha ziyareti</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{snapshot.recentVisitCount}</div>
                <div className="mt-1 text-xs text-muted-foreground">Kanıt eksiği: {snapshot.missingEvidenceVisitCount}</div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-sm text-muted-foreground">Açık evrak</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{snapshot.openDocumentCount}</div>
                <div className="mt-1 text-xs text-muted-foreground">Geciken: {snapshot.overdueDocumentCount}</div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-sm text-muted-foreground">Portal</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{snapshot.activePortalLinkCount}</div>
                <div className="mt-1 text-xs text-muted-foreground">Son görüntüleme: {formatDateTime(snapshot.latestPortalViewAt)}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium text-foreground">Şimdi ne yapmalıyım?</div>
              <div className="space-y-2">
                {snapshot.nextActions.map((item) => (
                  <div key={item} className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-foreground">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="operations" className="mt-0 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  Atamalar
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {snapshot.assignedPeople.length ? snapshot.assignedPeople.join(", ") : "Henüz aktif atama görünmüyor."}
                </div>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => navigate(buildCompanyHref("/osgb/assignments", company.id))}>
                  Atamaları aç
                </Button>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPinned className="h-4 w-4" />
                  Saha hizmeti
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {snapshot.recentVisitCount} ziyaret kaydı, {snapshot.missingEvidenceVisitCount} kanıt eksik hizmet görünüyor.
                </div>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => navigate(buildCompanyHref("/osgb/field-visits", company.id))}>
                  Saha ekranını aç
                </Button>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileCheck className="h-4 w-4" />
                  Evrak
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {snapshot.openDocumentCount} açık evrak, {snapshot.overdueDocumentCount} geciken yükümlülük var.
                </div>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => navigate(buildCompanyHref("/osgb/documents", company.id))}>
                  Evrak ekranını aç
                </Button>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  Finans
                </div>
                <div className="mt-2 text-sm text-foreground">
                  Cari bakiye {formatMoney(snapshot.currentBalance)}, geciken tutar {formatMoney(snapshot.overdueBalance)}.
                </div>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => navigate(buildCompanyHref("/osgb/finance", company.id))}>
                  Finans ekranını aç
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="service-modules" className="mt-0 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {serviceLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => navigate(item.href)}
                    className="rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/30 hover:bg-muted/30"
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-sm font-semibold text-foreground">{item.title}</div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
                  </button>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="records" className="mt-0 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BookOpen className="h-4 w-4" />
                  Operasyon hafızası
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {snapshot.openTaskCount} açık görev ve {snapshot.noteCount} operasyon notu bu firmaya bağlı görünüyor.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigate(buildCompanyHref("/osgb/tasks", company.id))}>
                    Görevleri aç
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(buildCompanyHref("/osgb/notes", company.id))}>
                    Notları aç
                  </Button>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe2 className="h-4 w-4" />
                  Portal ve arşiv
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {snapshot.activePortalLinkCount} aktif portal linki var. Arşiv, rapor ve müşteri yüklemeleri bu katmandan yönetilmeli.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigate(buildCompanyHref("/osgb/client-portal", company.id))}>
                    Portalı aç
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(buildCompanyHref("/reports", company.id))}>
                    Raporları aç
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Son hedef burada tek bir firma için kurul, risk, DÖF, yıllık plan, sertifika ve arşiv akışını aynı müşteri yaşam döngüsünde toplamak.
              Şu an bu modüllere firma içinden hızlı geçiş eklenmiş durumda.
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
