import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  CreditCard,
  Plus,
  RefreshCcw,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessRole } from "@/hooks/useAccessRole";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listOsgbFinanceWorkspace,
  syncOsgbMonthlyAccruals,
  upsertOsgbFinancialEntry,
  type OsgbFinanceCompanySnapshot,
  type OsgbFinanceWorkspaceData,
  type OsgbFinancialEntryStatus,
  type OsgbFinancialEntryType,
} from "@/lib/osgbPlatform";
import { cn } from "@/lib/utils";

type FinanceEntryFormState = {
  companyId: string;
  type: OsgbFinancialEntryType;
  amount: string;
  entryDate: string;
  dueDate: string;
  status: OsgbFinancialEntryStatus;
  description: string;
  serviceMonth: string;
};

const emptyForm: FinanceEntryFormState = {
  companyId: "",
  type: "payment",
  amount: "",
  entryDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  status: "paid",
  description: "",
  serviceMonth: new Date().toISOString().slice(0, 10),
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR");
};

const entryTypeLabels: Record<OsgbFinancialEntryType, string> = {
  invoice: "Tahakkuk / Fatura",
  payment: "Tahsilat",
  adjustment: "Düzeltme",
};

const statusLabels: Record<OsgbFinancialEntryStatus, string> = {
  draft: "Taslak",
  open: "Açık",
  paid: "Tahsil edildi",
  cancelled: "İptal",
  overdue: "Gecikmiş",
  posted: "İşlendi",
};

const companyTone = (company: OsgbFinanceCompanySnapshot) => {
  if (company.needsAttention) return "border-rose-500/25 bg-rose-500/10";
  if (company.lowProfitability) return "border-amber-500/25 bg-amber-500/10";
  return "border-slate-800 bg-slate-950/40";
};

export default function Finance() {
  const { user, profile } = useAuth();
  const { canManage } = useAccessRole();
  const organizationId = profile?.organization_id || null;
  const [workspace, setWorkspace] = useState<OsgbFinanceWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FinanceEntryFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  usePageDataTiming(loading);

  const loadData = useCallback(async () => {
    if (!organizationId || !user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await listOsgbFinanceWorkspace(organizationId, user.id);
      setWorkspace(data);
      setSelectedCompanyId((current) => current || data.companies[0]?.companyId || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Finans görünümü yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const companies = useMemo(() => {
    const rows = workspace?.companies || [];
    const term = search.trim().toLocaleLowerCase("tr-TR");
    if (!term) return rows;
    return rows.filter((row) =>
      [row.companyName, row.packageName, row.paymentPerformanceLabel]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("tr-TR").includes(term)),
    );
  }, [search, workspace?.companies]);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.companyId === selectedCompanyId) || companies[0] || null,
    [companies, selectedCompanyId],
  );

  const selectedEntries = useMemo(
    () => (workspace?.entries || []).filter((entry) => entry.companyId === selectedCompany?.companyId),
    [selectedCompany?.companyId, workspace?.entries],
  );

  const handleSync = async () => {
    if (!organizationId || !user?.id) return;
    try {
      const created = await syncOsgbMonthlyAccruals(organizationId, user.id);
      await loadData();
      toast.success(created > 0 ? `${created} yeni aylık tahakkuk üretildi.` : "Bu ay için yeni tahakkuk gerekmiyordu.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Aylık tahakkuk üretilemedi.");
    }
  };

  const openCreateDialog = () => {
    setForm((current) => ({
      ...emptyForm,
      companyId: selectedCompany?.companyId || current.companyId,
    }));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!organizationId || !user?.id || !form.companyId || !form.amount) {
      toast.error("Firma ve tutar zorunlu.");
      return;
    }

    setSaving(true);
    try {
      await upsertOsgbFinancialEntry(user.id, organizationId, {
        companyId: form.companyId,
        type: form.type,
        amount: Number(form.amount),
        entryDate: form.entryDate,
        dueDate: form.dueDate || null,
        status: form.status,
        description: form.description || null,
        serviceMonth: form.serviceMonth || null,
      });
      setDialogOpen(false);
      setForm(emptyForm);
      await loadData();
      toast.success("Finans hareketi kaydedildi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Finans hareketi kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  if (!organizationId) {
    return (
      <div className="container mx-auto py-6">
        <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Organizasyon bağlantısı gerekli</AlertTitle>
          <AlertDescription>
            Cari ve kârlılık ekranı organizasyon verisi ile çalışır. Önce bir kuruma bağlanın.
          </AlertDescription>
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
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Cari ve Kârlılık</h1>
              <p className="text-sm text-slate-400">
                Tahakkuk, tahsilat ve tahmini kârlılığı aynı ekranda görün. Hangi müşteride finansal baskı var hemen anlayın.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Yenile
          </Button>
          <Button variant="outline" onClick={() => void handleSync()} disabled={!canManage}>
            <BadgeDollarSign className="mr-2 h-4 w-4" />
            Aylık tahakkuk oluştur
          </Button>
          <Button onClick={openCreateDialog} disabled={!canManage}>
            <Plus className="mr-2 h-4 w-4" />
            Finans hareketi ekle
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Finans görünümü yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader className="pb-3">
            <CardDescription>Toplam cari bakiye</CardDescription>
            <CardTitle className="text-3xl text-white">{formatCurrency(workspace?.totalCurrentBalance || 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader className="pb-3">
            <CardDescription>Gecikmiş bakiye</CardDescription>
            <CardTitle className="text-3xl text-white">{formatCurrency(workspace?.totalOverdueBalance || 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader className="pb-3">
            <CardDescription>Geç ödeme yapan firma</CardDescription>
            <CardTitle className="text-3xl text-white">{workspace?.latePayerCount || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader className="pb-3">
            <CardDescription>Düşük kârlılık</CardDescription>
            <CardTitle className="text-3xl text-white">{workspace?.lowProfitabilityCount || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Firma bazlı finans görünümü</CardTitle>
            <CardDescription>
              Burada hangi firmanın geciktiğini, bakiyesini ve kârlılık baskısını hızlıca görürsünüz.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Firma ya da paket ara" />

            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                Yükleniyor...
              </div>
            ) : companies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                Gösterilecek firma bulunamadı.
              </div>
            ) : (
              companies.map((company) => (
                <button
                  key={company.companyId}
                  type="button"
                  onClick={() => setSelectedCompanyId(company.companyId)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition",
                    selectedCompany?.companyId === company.companyId
                      ? "border-cyan-500/30 bg-cyan-500/10"
                      : companyTone(company),
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{company.companyName}</div>
                      <div className="mt-1 text-xs text-slate-400">{company.packageName || "Paket tanımsız"}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{company.paymentPerformanceLabel}</Badge>
                      {company.lowProfitability ? <Badge className="border border-amber-500/20 bg-amber-500/10 text-amber-200">Kârlılık baskısı</Badge> : null}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                    <div>Bakiye: <span className="text-slate-200">{formatCurrency(company.currentBalance)}</span></div>
                    <div>Gecikmiş: <span className="text-slate-200">{formatCurrency(company.overdueBalance)}</span></div>
                    <div>Kâr: <span className={cn(company.estimatedMonthlyMargin < 0 ? "text-rose-300" : "text-emerald-300")}>{formatCurrency(company.estimatedMonthlyMargin)}</span></div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Firma detayı</CardTitle>
            <CardDescription>
              Bu bölüm kullanıcıya üç şeyi söyler: ne yanlış, neden yanlış ve şimdi ne yapmalı.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedCompany ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                Detay için soldan bir firma seçin.
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-white">{selectedCompany.companyName}</div>
                      <div className="mt-1 text-sm text-slate-400">{selectedCompany.packageName || "Paket bilgisi yok"}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{selectedCompany.paymentPerformanceLabel}</Badge>
                      {selectedCompany.lowProfitability ? (
                        <Badge className="border border-amber-500/20 bg-amber-500/10 text-amber-200">Düşük kârlılık</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-sm font-medium text-white">Ne yanlış?</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {selectedCompany.needsAttention
                        ? "Cari hesapta gecikme veya tahsilat baskısı var."
                        : selectedCompany.lowProfitability
                          ? "Hizmet veriliyor ama tahmini kâr zayıf."
                          : "Finans görünümü dengeli."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-sm font-medium text-white">Neden yanlış?</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {selectedCompany.overdueBalance > 0
                        ? `${formatCurrency(selectedCompany.overdueBalance)} tutarında gecikmiş bakiye var.`
                        : selectedCompany.lowProfitability
                          ? `Beklenen gelir ${formatCurrency(selectedCompany.expectedRevenue)} iken tahmini kâr ${formatCurrency(selectedCompany.estimatedMonthlyMargin)} seviyesinde.`
                          : "Tahsilat ritmi ve maliyet dengesi şu an kabul edilebilir."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-sm font-medium text-white">Şimdi ne yapmalıyım?</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {selectedCompany.overdueBalance > 0
                        ? "Tahsilat kaydı ekleyin veya müşteriye ödeme hatırlatması yapın."
                        : selectedCompany.lowProfitability
                          ? "Sözleşme bedelini ve atanan iş yükünü yeniden gözden geçirin."
                          : "Aylık tahakkuku ve ödemeleri düzenli işlemeye devam edin."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Sözleşme bedeli</div>
                    <div className="mt-3 text-xl font-semibold text-white">{formatCurrency(selectedCompany.monthlyFee)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Aylık tahakkuk</div>
                    <div className="mt-3 text-xl font-semibold text-white">{formatCurrency(selectedCompany.expectedRevenue)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Cari bakiye</div>
                    <div className="mt-3 text-xl font-semibold text-white">{formatCurrency(selectedCompany.currentBalance)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Tahmini kârlılık</div>
                    <div className={cn("mt-3 text-xl font-semibold", selectedCompany.estimatedMonthlyMargin < 0 ? "text-rose-300" : "text-emerald-300")}>
                      {formatCurrency(selectedCompany.estimatedMonthlyMargin)}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                    <CreditCard className="h-4 w-4 text-cyan-300" />
                    Son finans hareketleri
                  </div>
                  <div className="space-y-3">
                    {selectedEntries.length === 0 ? (
                      <div className="text-sm text-slate-400">Bu firma için henüz finans hareketi yok.</div>
                    ) : (
                      selectedEntries.slice(0, 8).map((entry) => (
                        <div key={entry.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-white">{entryTypeLabels[entry.type]}</div>
                              <div className="mt-1 text-xs text-slate-400">{entry.description || "Açıklama yok"}</div>
                            </div>
                            <div className="text-right">
                              <div className={cn("font-semibold", entry.type === "payment" ? "text-emerald-300" : entry.type === "invoice" ? "text-cyan-300" : "text-amber-300")}>
                                {entry.type === "payment" ? "-" : ""}{formatCurrency(entry.amount)}
                              </div>
                              <div className="mt-1 text-xs text-slate-400">{statusLabels[entry.status]}</div>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                            <span>Tarih: {formatDate(entry.entryDate)}</span>
                            <span>Vade: {formatDate(entry.dueDate)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Finans hareketi ekle</DialogTitle>
            <DialogDescription>Tahsilat, tahakkuk veya düzeltme hareketini ilgili firmaya bağlayın.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Firma</Label>
              <Select value={form.companyId} onValueChange={(value) => setForm((current) => ({ ...current, companyId: value }))}>
                <SelectTrigger><SelectValue placeholder="Firma seçin" /></SelectTrigger>
                <SelectContent>
                  {(workspace?.companies || []).map((company) => (
                    <SelectItem key={company.companyId} value={company.companyId}>{company.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hareket tipi</Label>
              <Select value={form.type} onValueChange={(value) => setForm((current) => ({ ...current, type: value as OsgbFinancialEntryType, status: value === "payment" ? "paid" : "open" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(entryTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tutar</Label>
              <Input type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Durum</Label>
              <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as OsgbFinancialEntryStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>İşlem tarihi</Label>
              <Input type="date" value={form.entryDate} onChange={(event) => setForm((current) => ({ ...current, entryDate: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Vade tarihi</Label>
              <Input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Hizmet ayı</Label>
              <Input type="date" value={form.serviceMonth} onChange={(event) => setForm((current) => ({ ...current, serviceMonth: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Açıklama</Label>
              <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Örn: Nisan tahsilatı, vade güncellemesi..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Vazgeç</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
