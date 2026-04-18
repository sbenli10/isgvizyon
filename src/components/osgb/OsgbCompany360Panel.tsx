import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function OsgbCompany360Panel({
  company,
  snapshot,
}: {
  company: OsgbManagedCompanyRecord | null;
  snapshot: OsgbCompany360Snapshot | null;
}) {
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
        <CardTitle>{company.companyName}</CardTitle>
        <CardDescription>Tek ekranda dakika, atama, saha, evrak, cari ve portal görünümü.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
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
          <div className="text-sm font-medium text-foreground">Atanan kişiler</div>
          <div className="flex flex-wrap gap-2">
            {snapshot.assignedPeople.length ? snapshot.assignedPeople.map((person) => (
              <Badge key={person} variant="outline">{person}</Badge>
            )) : <span className="text-sm text-muted-foreground">Henüz aktif atama görünmüyor.</span>}
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Açık görev</div>
            <div className="mt-2 text-xl font-semibold text-foreground">{snapshot.openTaskCount}</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Operasyon notu</div>
            <div className="mt-2 text-xl font-semibold text-foreground">{snapshot.noteCount}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
