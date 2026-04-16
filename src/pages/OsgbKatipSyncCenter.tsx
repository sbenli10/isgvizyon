import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Building2, DatabaseZap, Link2, Plus, RefreshCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listOsgbExternalIntegrations,
  listOsgbIsgKatipWorkspace,
  pullOsgbExternalIntegration,
  runOsgbIsgKatipSyncRefresh,
  upsertOsgbExternalIntegration,
  type OsgbExternalIntegrationRecord,
  type OsgbIsgKatipWorkspace,
} from "@/lib/osgbOrchestration";

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR");
};

type IntegrationForm = {
  provider: "rest_api" | "custom_isgkatip";
  integrationName: string;
  baseUrl: string;
  apiPath: string;
  sourceKey: string;
};

const emptyForm: IntegrationForm = {
  provider: "rest_api",
  integrationName: "",
  baseUrl: "",
  apiPath: "/companies",
  sourceKey: "",
};

export default function OsgbKatipSyncCenter() {
  const { user, profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const [workspace, setWorkspace] = useState<OsgbIsgKatipWorkspace | null>(null);
  const [integrations, setIntegrations] = useState<OsgbExternalIntegrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pullingId, setPullingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<IntegrationForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  usePageDataTiming(loading);

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [data, integrationRows] = await Promise.all([
        listOsgbIsgKatipWorkspace(organizationId),
        listOsgbExternalIntegrations(organizationId),
      ]);
      setWorkspace(data);
      setIntegrations(integrationRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ISG-KATIP merkezi yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSync = async () => {
    if (!organizationId || !user?.id) return;
    setSyncing(true);
    try {
      const summary = await runOsgbIsgKatipSyncRefresh(organizationId, user.id);
      await loadData();
      toast.success(`${summary.success || 0} firma kaydi senkronize edildi.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ISG-KATIP senkronizasyonu basarisiz oldu.");
    } finally {
      setSyncing(false);
    }
  };

  const handlePull = async (integrationId?: string) => {
    if (!organizationId || !user?.id) return;
    setPullingId(integrationId || "default");
    try {
      const result = await pullOsgbExternalIntegration(organizationId, user.id, integrationId);
      await loadData();
      toast.success(`${result.imported || 0} firma dis kaynaktan cekildi.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dis kaynak aktarimi basarisiz oldu.");
    } finally {
      setPullingId(null);
    }
  };

  const handleSaveIntegration = async () => {
    if (!organizationId || !user?.id || !form.integrationName || !form.baseUrl) {
      toast.error("Entegrasyon adi ve adresi zorunlu.");
      return;
    }

    setSaving(true);
    try {
      await upsertOsgbExternalIntegration(user.id, organizationId, {
        provider: form.provider,
        integrationName: form.integrationName,
        baseUrl: form.baseUrl,
        apiPath: form.apiPath || "/companies",
        sourceKey: form.sourceKey || null,
      });
      setDialogOpen(false);
      setForm(emptyForm);
      await loadData();
      toast.success("Dis kaynak entegrasyonu kaydedildi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Entegrasyon kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  if (!organizationId) {
    return (
      <div className="container mx-auto py-6">
        <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Organizasyon baglantisi gerekli</AlertTitle>
          <AlertDescription>ISG-KATIP merkezi organizasyon kapsaminda calisir. Once bir kuruma baglanin.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">ISG-KATIP Senkron Merkezi</h1>
              <p className="text-sm text-slate-400">Manuel senkron, dis kaynak adaptoru ve firma sagligini tek merkezden yonetin.</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Yenile
          </Button>
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Kaynak ekle
          </Button>
          <Button onClick={() => void handleSync()} disabled={syncing}>
            <Link2 className="mr-2 h-4 w-4" />
            {syncing ? "Senkronize ediliyor" : "Mevcut veriyi yenile"}
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Merkez yuklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardDescription>Toplam firma</CardDescription><CardTitle className="text-white">{workspace?.summary.companyCount || 0}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardDescription>Kritik firma</CardDescription><CardTitle className="text-amber-200">{workspace?.summary.criticalCompanies || 0}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardDescription>Acik uyum bayragi</CardDescription><CardTitle className="text-rose-200">{workspace?.summary.openFlags || 0}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardDescription>Son senkron</CardDescription><CardTitle className="text-sm text-white">{formatDateTime(workspace?.summary.lastSyncAt || null)}</CardTitle></CardHeader></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Firma sagligi</CardTitle>
            <CardDescription>Hangi firma eksik sure veya acik bayrak ile ilerliyor hemen gorun.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && !workspace ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-2xl border border-slate-800 bg-slate-950/40" />
                ))}
              </div>
            ) : workspace?.companies.length ? (
              workspace.companies.map((company) => (
                <div key={company.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-cyan-300" />
                        <div className="font-medium text-white">{company.companyName}</div>
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        SGK: {company.sgkNo || "-"} • {company.employeeCount} calisan • {company.hazardClass || "Sinif yok"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{company.assignedMinutes}/{company.requiredMinutes} dk</Badge>
                      {company.criticalFlagCount > 0 ? <Badge className="bg-rose-500/15 text-rose-200">{company.criticalFlagCount} kritik</Badge> : null}
                      {company.flagCount > 0 ? <Badge className="bg-amber-500/15 text-amber-200">{company.flagCount} bayrak</Badge> : null}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Son sync: {formatDateTime(company.lastSyncedAt)} • Sozlesme bitisi: {company.contractEnd ? new Date(company.contractEnd).toLocaleDateString("tr-TR") : "-"}
                  </div>
                </div>
              ))
            ) : (
              <Alert className="border-slate-800 bg-slate-950/50 text-slate-200">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Henuz ISG-KATIP firma verisi yok</AlertTitle>
                <AlertDescription>Ilk senkron veya veri aktarma sonrasi bu liste dolacak.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-800 bg-slate-900/70">
            <CardHeader>
              <CardTitle className="text-white">Dis kaynaklar</CardTitle>
              <CardDescription>Gercek dis kaynak adresini baglayin; firma havuzu bu kaynaktan cekilip ISG-KATIP motoruna akar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {integrations.length ? integrations.map((integration) => (
                <div key={integration.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{integration.integrationName}</div>
                      <div className="mt-1 text-sm text-slate-400">{integration.baseUrl}{integration.apiPath}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        Son cekim: {formatDateTime(integration.lastSyncedAt)} {integration.lastError ? `• Hata: ${integration.lastError}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{integration.status}</Badge>
                      <Button size="sm" variant="outline" disabled={pullingId === integration.id} onClick={() => void handlePull(integration.id)}>
                        <DatabaseZap className="mr-2 h-4 w-4" />
                        {pullingId === integration.id ? "Cekiliyor" : "Veriyi cek"}
                      </Button>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-400">
                  Henuz bagli bir dis kaynak entegrasyonu yok.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/70">
            <CardHeader>
              <CardTitle className="text-white">Son islem kayitlari</CardTitle>
              <CardDescription>Senkron denemeleri ve audit kayitlari.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {workspace?.logs.length ? workspace.logs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-white">{log.action}</div>
                    <Badge variant="outline">{log.status}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">{formatDateTime(log.createdAt)} • {log.source || "manuel"}</div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-400">
                  Henuz senkron gecmisi kaydi yok.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>Dis kaynak bagla</DialogTitle>
            <DialogDescription>Firma listesini cekeceginiz REST veya ozel ISG kaynagini tanimlayin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kaynak tipi</Label>
              <Select value={form.provider} onValueChange={(value) => setForm((current) => ({ ...current, provider: value as IntegrationForm["provider"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rest_api">REST API</SelectItem>
                  <SelectItem value="custom_isgkatip">Ozel ISG Kaynagi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kaynak adi</Label>
              <Input value={form.integrationName} onChange={(event) => setForm((current) => ({ ...current, integrationName: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input value={form.baseUrl} onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://api.ornek.com" />
            </div>
            <div className="space-y-2">
              <Label>API path</Label>
              <Input value={form.apiPath} onChange={(event) => setForm((current) => ({ ...current, apiPath: event.target.value }))} placeholder="/companies" />
            </div>
            <div className="space-y-2">
              <Label>Kaynak anahtari</Label>
              <Input value={form.sourceKey} onChange={(event) => setForm((current) => ({ ...current, sourceKey: event.target.value }))} placeholder="Ornek: data veya companies" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Vazgec</Button>
            <Button onClick={() => void handleSaveIntegration()} disabled={saving}>{saving ? "Kaydediliyor" : "Kaydet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
