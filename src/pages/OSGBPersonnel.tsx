import { useCallback, useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOsgbAccess } from "@/hooks/useOsgbAccess";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOsgbPersonnelCapacityPanel, listOsgbWorkspacePersonnel, type OsgbPersonnelCapacityRecord, type OsgbWorkspacePersonnelRecord } from "@/lib/osgbPlatform";

export default function OSGBPersonnel() {
  const { profile } = useAuth();
  const { canManagePeople } = useOsgbAccess();
  const organizationId = profile?.organization_id || null;
  const [personnel, setPersonnel] = useState<OsgbWorkspacePersonnelRecord[]>([]);
  const [capacity, setCapacity] = useState<OsgbPersonnelCapacityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!organizationId) return setLoading(false);
    setLoading(true);
    try {
      const [personnelRows, capacityRows] = await Promise.all([listOsgbWorkspacePersonnel(organizationId, true), getOsgbPersonnelCapacityPanel(organizationId)]);
      setPersonnel(personnelRows);
      setCapacity(capacityRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Personel havuzu yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const summary = useMemo(() => ({
    igu: personnel.filter((item) => item.role === "igu").length,
    hekim: personnel.filter((item) => item.role === "hekim").length,
    dsp: personnel.filter((item) => item.role === "dsp").length,
    overloaded: capacity.filter((item) => item.overloaded).length,
  }), [capacity, personnel]);

  if (!organizationId) return <div className="container mx-auto py-6"><Alert><AlertTitle>Organizasyon gerekli</AlertTitle><AlertDescription>Personel havuzu organizasyon bazlı çalışır.</AlertDescription></Alert></div>;

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Users className="h-5 w-5" /></div><div><h1 className="text-3xl font-bold tracking-tight text-foreground">Personel Havuzu</h1><p className="text-sm text-muted-foreground">Eski kullanıcı bazlı personel akışı yerine organizasyon ve kapasite görünümü burada toplanır.</p></div></div>
      </div>
      {error ? <Alert variant="destructive"><AlertTitle>Personel havuzu yüklenemedi</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className="grid gap-4 md:grid-cols-4"><Card><CardHeader><CardDescription>İGU</CardDescription><CardTitle>{summary.igu}</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>İşyeri Hekimi</CardDescription><CardTitle>{summary.hekim}</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>DSP</CardDescription><CardTitle>{summary.dsp}</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>Aşırı yük</CardDescription><CardTitle>{summary.overloaded}</CardTitle></CardHeader></Card></div>
      <Card><CardHeader><CardTitle>Ekip görünümü</CardTitle><CardDescription>{canManagePeople ? "Personel kayıtları organization-scoped kapasite motorundan okunuyor." : "Bu rolde yalnızca görüntüleme yapabilirsiniz."}</CardDescription></CardHeader><CardContent className="space-y-3">{loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-muted/40" />) : capacity.length ? capacity.map((person) => <div key={person.personnelId} className="rounded-2xl border border-border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-medium text-foreground">{person.fullName}</div><div className="mt-1 text-sm text-muted-foreground">{person.role.toUpperCase()} · {person.activeCompanyCount} aktif firma</div></div><div className="flex flex-wrap gap-2"><Badge variant="outline">{person.assignedMinutes}/{person.monthlyCapacityMinutes} dk</Badge>{person.overloaded ? <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-200">Aşırı yük</Badge> : <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">Dengeli</Badge>}</div></div><div className="mt-3 text-sm text-muted-foreground">Kalan kapasite: {person.remainingMinutes} dk · Doluluk: %{person.utilizationRatio}</div></div>) : <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-sm text-muted-foreground">Henüz aktif personel bulunmuyor.</div>}</CardContent></Card>
      <div className="flex gap-2"><Button variant="outline" onClick={() => window.location.assign("/osgb/assignments")}>Görevlendirme ekranına git</Button><Button variant="outline" onClick={() => window.location.assign("/osgb/capacity")}>Kapasite paneline git</Button></div>
    </div>
  );
}
