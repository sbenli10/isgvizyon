import { useCallback, useMemo, useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, Copy, Download, ExternalLink, Globe2, Plus, RefreshCcw, XCircle } from "lucide-react";
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
  createOsgbClientPortalLink,
  getOsgbClientPortalUploadSignedUrl,
  listOsgbClientPortalCompanyOptions,
  listOsgbClientPortalUploads,
  listOsgbClientPortalWorkspace,
  reviewOsgbClientPortalUpload,
  updateOsgbClientPortalLinkStatus,
  type OsgbClientPortalLinkRecord,
  type OsgbClientPortalUploadRecord,
  type OsgbClientPortalWorkspace,
} from "@/lib/osgbOrchestration";

type FormState = {
  companyId: string;
  contactName: string;
  contactEmail: string;
  expiresAt: string;
};

const emptyForm: FormState = {
  companyId: "",
  contactName: "",
  contactEmail: "",
  expiresAt: "",
};

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR");
};

const formatBytes = (value: number) => {
  if (!value) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export default function OsgbClientPortal() {
  const { user, profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const [workspace, setWorkspace] = useState<OsgbClientPortalWorkspace | null>(null);
  const [uploads, setUploads] = useState<OsgbClientPortalUploadRecord[]>([]);
  const [companyOptions, setCompanyOptions] = useState<Array<{ companyId: string; companyName: string; hazardClass: string; deficitMinutes: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  usePageDataTiming(loading);

  const origin = useMemo(() => window.location.origin, []);

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [portalWorkspace, companies, uploadRows] = await Promise.all([
        listOsgbClientPortalWorkspace(organizationId),
        listOsgbClientPortalCompanyOptions(organizationId),
        listOsgbClientPortalUploads(organizationId),
      ]);
      setWorkspace(portalWorkspace);
      setCompanyOptions(companies);
      setUploads(uploadRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Musteri portali yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const buildPortalUrl = (link: Pick<OsgbClientPortalLinkRecord, "accessToken"> | { accessToken: string }) =>
    `${origin}/portal/company/${link.accessToken}`;

  const copyLink = async (link: Pick<OsgbClientPortalLinkRecord, "accessToken"> | { accessToken: string }) => {
    try {
      await navigator.clipboard.writeText(buildPortalUrl(link));
      toast.success("Portal linki panoya kopyalandi.");
    } catch {
      toast.error("Portal linki kopyalanamadi.");
    }
  };

  const handleCreate = async () => {
    if (!organizationId || !user?.id || !form.companyId) {
      toast.error("Firma secimi zorunlu.");
      return;
    }

    setSaving(true);
    try {
      const created = await createOsgbClientPortalLink(user.id, organizationId, {
        companyId: form.companyId,
        contactName: form.contactName || null,
        contactEmail: form.contactEmail || null,
        expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
      });
      setDialogOpen(false);
      setForm(emptyForm);
      await loadData();
      await copyLink({ accessToken: created.access_token });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Portal linki olusturulamadi.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (linkId: string, status: "active" | "paused" | "revoked") => {
    if (!organizationId) return;
    try {
      await updateOsgbClientPortalLinkStatus(organizationId, linkId, status);
      await loadData();
      toast.success("Portal durumu guncellendi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Portal durumu guncellenemedi.");
    }
  };

  const handleReview = async (uploadId: string, status: "approved" | "rejected") => {
    if (!organizationId || !user?.id) return;
    setReviewingId(uploadId);
    try {
      await reviewOsgbClientPortalUpload(organizationId, user.id, uploadId, status);
      await loadData();
      toast.success(status === "approved" ? "Dosya onaylandi." : "Dosya reddedildi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya durumu guncellenemedi.");
    } finally {
      setReviewingId(null);
    }
  };

  const handleDownload = async (upload: OsgbClientPortalUploadRecord) => {
    try {
      const signedUrl = await getOsgbClientPortalUploadSignedUrl(upload.filePath);
      if (!signedUrl) throw new Error("Dosya linki olusturulamadi.");
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya acilamadi.");
    }
  };

  if (!organizationId) {
    return (
      <div className="container mx-auto py-6">
        <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Organizasyon baglantisi gerekli</AlertTitle>
          <AlertDescription>Musteri portali baglantilari organizasyon bazinda yonetilir.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const pendingUploads = uploads.filter((upload) => upload.reviewStatus === "pending");

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
              <Globe2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Musteri Portali</h1>
              <p className="text-sm text-slate-400">Firma linklerini yonetin, gelen dosyalari inceleyin ve onay akisini tek yerden ilerletin.</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Yenile
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Portal linki olustur
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Portal yonetimi yuklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardDescription>Aktif link</CardDescription><CardTitle className="text-white">{workspace?.summary.activeLinks || 0}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardDescription>Goruntulenen link</CardDescription><CardTitle className="text-cyan-200">{workspace?.summary.viewedLinks || 0}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardDescription>Kapsanan firma</CardDescription><CardTitle className="text-white">{workspace?.summary.companiesCovered || 0}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardDescription>Onay bekleyen dosya</CardDescription><CardTitle className="text-amber-200">{pendingUploads.length}</CardTitle></CardHeader></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Portal erisimleri</CardTitle>
            <CardDescription>Firma belge durumu, hizmet kayitlari ve cari ozeti bu linkler uzerinden paylasilir.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && !workspace ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-950/40" />
              ))
            ) : workspace?.links.length ? (
              workspace.links.map((link) => (
                <div key={link.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{link.companyName}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {link.contactName || "Yetkili yok"} {link.contactEmail ? `• ${link.contactEmail}` : ""}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Geciken evrak: {link.overdueDocuments} • Acik bakiye: {link.openBalance.toLocaleString("tr-TR")} TL • Son goruntuleme: {formatDateTime(link.lastViewedAt)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{link.portalStatus}</Badge>
                      <Button size="sm" variant="outline" onClick={() => void copyLink(link)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Kopyala
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={buildPortalUrl(link)} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Ac
                        </a>
                      </Button>
                      {link.portalStatus !== "paused" ? (
                        <Button size="sm" variant="outline" onClick={() => void handleStatusChange(link.id, "paused")}>Duraklat</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => void handleStatusChange(link.id, "active")}>Aktif et</Button>
                      )}
                      {link.portalStatus !== "revoked" ? (
                        <Button size="sm" variant="outline" onClick={() => void handleStatusChange(link.id, "revoked")}>Iptal et</Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-5 text-sm text-slate-400">
                Henuz firma ile paylasilmis bir portal linki yok.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Gelen dosyalar</CardTitle>
            <CardDescription>Musteri portalindan gelen belgeleri burada inceleyip onaylayin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && !workspace ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-950/40" />
              ))
            ) : uploads.length ? (
              uploads.map((upload) => (
                <div key={upload.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{upload.fileName}</div>
                      <div className="mt-1 text-sm text-slate-400">{upload.companyName}{upload.documentType ? ` • ${upload.documentType}` : ""}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        {upload.submittedByName || "Isim yok"} {upload.submittedByEmail ? `• ${upload.submittedByEmail}` : ""} • {formatBytes(upload.fileSize)} • {formatDateTime(upload.createdAt)}
                      </div>
                      {upload.note ? <div className="mt-2 text-xs text-slate-400">{upload.note}</div> : null}
                      {upload.reviewNote ? <div className="mt-2 text-xs text-slate-500">Inceleme notu: {upload.reviewNote}</div> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={
                        upload.reviewStatus === "approved"
                          ? "bg-emerald-500/15 text-emerald-200"
                          : upload.reviewStatus === "rejected"
                            ? "bg-rose-500/15 text-rose-200"
                            : "bg-amber-500/15 text-amber-200"
                      }>
                        {upload.reviewStatus === "approved" ? "Onaylandi" : upload.reviewStatus === "rejected" ? "Reddedildi" : "Bekliyor"}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => void handleDownload(upload)}>
                        <Download className="mr-2 h-4 w-4" />
                        Dosyayi ac
                      </Button>
                      {upload.reviewStatus === "pending" ? (
                        <>
                          <Button size="sm" variant="outline" disabled={reviewingId === upload.id} onClick={() => void handleReview(upload.id, "approved")}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Onayla
                          </Button>
                          <Button size="sm" variant="outline" disabled={reviewingId === upload.id} onClick={() => void handleReview(upload.id, "rejected")}>
                            <XCircle className="mr-2 h-4 w-4" />
                            Reddet
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-5 text-sm text-slate-400">
                Henuz portaldan gelen bir dosya yok.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>Portal linki olustur</DialogTitle>
            <DialogDescription>Firma belge durumu, saha hizmeti ve cari ozeti bu link uzerinden gorur.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Firma</Label>
              <Select value={form.companyId} onValueChange={(value) => setForm((current) => ({ ...current, companyId: value }))}>
                <SelectTrigger><SelectValue placeholder="Firma secin" /></SelectTrigger>
                <SelectContent>
                  {companyOptions.map((company) => (
                    <SelectItem key={company.companyId} value={company.companyId}>
                      {company.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Yetkili kisi</Label>
              <Input value={form.contactName} onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>E-posta</Label>
              <Input type="email" value={form.contactEmail} onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Gecerlilik tarihi</Label>
              <Input type="date" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Vazgec</Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>{saving ? "Olusturuluyor" : "Link olustur"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
