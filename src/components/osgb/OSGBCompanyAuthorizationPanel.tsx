import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  ShieldOff,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createOsgbCompanyPortalAccount,
  deleteOsgbCompanyPortalAccount,
  listOsgbCompanyPortalAccounts,
  listOsgbWorkspaceCompanies,
  listOsgbWorkspacePersonnel,
  updateOsgbCompanyPortalAccount,
  type OsgbCompanyPortalAccountRecord,
  type OsgbWorkspaceCompanyOption,
  type OsgbWorkspacePersonnelRecord,
} from "@/lib/osgbPlatform";

type AuthorizationFilter = "all" | "has_account" | "no_account" | "active" | "passive";

const inputClass = "h-10 rounded-xl border-slate-700/70 bg-slate-800/80 text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500/40";
const selectTriggerClass = "h-10 rounded-xl border-slate-700/70 bg-slate-800/80 text-sm font-semibold text-slate-100 focus:ring-blue-500/40";
const selectContentClass = "z-[130] border-slate-700 bg-slate-900 text-slate-100";

const formatDate = (value: string | null) => {
  if (!value) return "Hiç giriş yok";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
};

const normalizeText = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._\s-]+/g, "")
    .trim();

const slugifyCompanyName = (companyName: string) =>
  normalizeText(companyName)
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "firma";

const generatePassword = () => {
  const letters = Math.random().toString(36).slice(2, 8).toUpperCase();
  const digits = Math.floor(100 + Math.random() * 900);
  return `ISG-${letters}${digits}`;
};

const maskPassword = (value: string | null) => (value ? "•".repeat(Math.max(8, Math.min(value.length, 12))) : "••••••••");

function makeUniqueUsername(companyName: string, accounts: OsgbCompanyPortalAccountRecord[], currentAccountId?: string) {
  const base = slugifyCompanyName(companyName);
  const existing = new Set(
    accounts
      .filter((account) => account.id !== currentAccountId)
      .map((account) => account.username.toLocaleLowerCase("tr-TR")),
  );
  if (!existing.has(base)) return base;

  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base}-${index}`;
    if (!existing.has(candidate)) return candidate;
  }

  return `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function Header() {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-300 shadow-sm shadow-blue-950/30">
        <KeyRound className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <h2 className="text-2xl font-bold tracking-tight text-white">Firma Görevlendirme</h2>
        <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">
          Her OSGB firmanız için portal giriş hesabı oluşturun. Firma yetkilisi ana sayfada &quot;Firma Girişi&quot; butonundan bu bilgilerle giriş yapar.
        </p>
      </div>
    </div>
  );
}

function FilterChip({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-black transition",
        active
          ? "border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/20"
          : "border-slate-700/70 bg-slate-800/80 text-slate-300 hover:border-slate-600 hover:bg-slate-700/70 hover:text-white",
      )}
    >
      <span>{label}</span>
      <span className={cn("rounded-lg px-2 py-0.5 text-[10px]", active ? "bg-white/15 text-white" : "bg-slate-700/80 text-slate-300")}>{count}</span>
    </button>
  );
}

function PortalAccountDialog({
  open,
  onOpenChange,
  mode,
  company,
  username,
  password,
  busy,
  onUsernameChange,
  onPasswordChange,
  onGenerate,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "renew";
  company: OsgbWorkspaceCompanyOption | null;
  username: string;
  password: string;
  busy: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onGenerate: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[110] bg-slate-950/80 backdrop-blur-sm"
        className="z-[120] max-h-[92vh] w-[95vw] max-w-[520px] overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900 p-0 text-white shadow-2xl shadow-black/70 [&>button.absolute]:hidden"
      >
        <DialogTitle className="sr-only">{mode === "create" ? "Firma portal hesabı oluştur" : "Firma portal şifresi yenile"}</DialogTitle>
        <DialogDescription className="sr-only">Firma portal giriş bilgilerini düzenleyin.</DialogDescription>
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-300">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-white">{mode === "create" ? "Hesap Oluştur" : "Şifre Yenile"}</h3>
              <p className="mt-1 truncate text-sm text-slate-400">{company?.companyName || "Firma"}</p>
            </div>
          </div>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </div>

        <div className="space-y-4 px-6 py-5">
          {mode === "create" && (
            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-200">Kullanıcı adı</span>
              <Input value={username} onChange={(event) => onUsernameChange(event.target.value)} className={inputClass} placeholder="firma-kullanici" />
            </label>
          )}
          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-200">{mode === "create" ? "Şifre" : "Yeni şifre"}</span>
            <div className="flex gap-2">
              <Input value={password} onChange={(event) => onPasswordChange(event.target.value)} className={inputClass} placeholder="ISG-..." />
              <Button type="button" variant="outline" onClick={onGenerate} className="h-10 shrink-0 rounded-xl border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-white">
                Otomatik oluştur
              </Button>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 px-6 py-4">
          <DialogClose asChild>
            <Button type="button" variant="ghost" className="rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white">İptal</Button>
          </DialogClose>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={busy || (mode === "create" && !username.trim()) || !password.trim()}
            className="rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400"
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Kaydet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OSGBCompanyAuthorizationPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const { user, profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const companyLoginUrl = typeof window !== "undefined" ? `${window.location.origin}/firma-girisi` : "/firma-girisi";
  const [companies, setCompanies] = useState<OsgbWorkspaceCompanyOption[]>([]);
  const [personnel, setPersonnel] = useState<OsgbWorkspacePersonnelRecord[]>([]);
  const [accounts, setAccounts] = useState<OsgbCompanyPortalAccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AuthorizationFilter>("all");
  const [hazardFilter, setHazardFilter] = useState("all");
  const [personnelFilter, setPersonnelFilter] = useState("all");
  const [shownPasswords, setShownPasswords] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<OsgbWorkspaceCompanyOption | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<OsgbCompanyPortalAccountRecord | null>(null);
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setCompanies([]);
      setPersonnel([]);
      setAccounts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [companyRows, personnelRows, accountRows] = await Promise.all([
        listOsgbWorkspaceCompanies(organizationId),
        listOsgbWorkspacePersonnel(organizationId, true),
        listOsgbCompanyPortalAccounts(organizationId),
      ]);
      setCompanies(companyRows);
      setPersonnel(personnelRows);
      setAccounts(accountRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Firma görevlendirme verileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const accountByCompany = useMemo(() => {
    const map = new Map<string, OsgbCompanyPortalAccountRecord>();
    accounts.forEach((account) => map.set(account.companyId, account));
    return map;
  }, [accounts]);

  const counts = useMemo(() => {
    const hasAccount = companies.filter((company) => accountByCompany.has(company.id)).length;
    const active = accounts.filter((account) => account.isActive).length;
    return {
      all: companies.length,
      hasAccount,
      noAccount: companies.length - hasAccount,
      active,
      passive: accounts.filter((account) => !account.isActive).length,
    };
  }, [accountByCompany, accounts, companies]);

  const hazardOptions = useMemo(() => Array.from(new Set(companies.map((company) => company.hazardClass).filter(Boolean))), [companies]);

  const filteredCompanies = useMemo(() => {
    const query = normalizeText(search);
    return companies.filter((company) => {
      const account = accountByCompany.get(company.id);
      const haystack = normalizeText(`${company.companyName} ${company.sgkNo || ""} ${company.hazardClass}`);
      const matchesSearch = !query || haystack.includes(query);
      const matchesHazard = hazardFilter === "all" || company.hazardClass === hazardFilter;
      const matchesPersonnel = personnelFilter === "all" || personnel.some((person) => person.id === personnelFilter);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "has_account" && Boolean(account)) ||
        (statusFilter === "no_account" && !account) ||
        (statusFilter === "active" && Boolean(account?.isActive)) ||
        (statusFilter === "passive" && Boolean(account && !account.isActive));
      return matchesSearch && matchesHazard && matchesPersonnel && matchesStatus;
    });
  }, [accountByCompany, companies, hazardFilter, personnel, personnelFilter, search, statusFilter]);

  const openCreateDialog = (company: OsgbWorkspaceCompanyOption) => {
    setSelectedCompany(company);
    setSelectedAccount(null);
    setFormUsername(makeUniqueUsername(company.companyName, accounts));
    setFormPassword(generatePassword());
    setCreateOpen(true);
  };

  const openRenewDialog = (company: OsgbWorkspaceCompanyOption, account: OsgbCompanyPortalAccountRecord) => {
    setSelectedCompany(company);
    setSelectedAccount(account);
    setFormUsername(account.username);
    setFormPassword(generatePassword());
    setRenewOpen(true);
  };

  const handleCreateAccount = async () => {
    if (!organizationId || !user?.id || !selectedCompany) return;
    setBusy(true);
    try {
      const created = await createOsgbCompanyPortalAccount({
        organizationId,
        userId: user.id,
        companyId: selectedCompany.id,
        username: formUsername.trim().toLocaleLowerCase("tr-TR"),
        passwordPlain: formPassword,
        isActive: true,
      });
      setAccounts((current) => [created, ...current.filter((account) => account.id !== created.id)]);
      setCreateOpen(false);
      toast.success("Firma portal hesabı oluşturuldu.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Hesap oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  };

  const handleRenewPassword = async () => {
    if (!selectedAccount) return;
    setBusy(true);
    try {
      const updated = await updateOsgbCompanyPortalAccount(selectedAccount.id, { passwordPlain: formPassword });
      setAccounts((current) => current.map((account) => (account.id === updated.id ? updated : account)));
      setRenewOpen(false);
      toast.success("Firma portal şifresi yenilendi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Şifre yenilenemedi.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (account: OsgbCompanyPortalAccountRecord) => {
    setBusy(true);
    try {
      const updated = await updateOsgbCompanyPortalAccount(account.id, { isActive: !account.isActive });
      setAccounts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(updated.isActive ? "Hesap aktif edildi." : "Hesap pasife alındı.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Hesap durumu güncellenemedi.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (account: OsgbCompanyPortalAccountRecord) => {
    if (!window.confirm("Bu firma portal hesabını silmek istiyor musunuz?")) return;
    setBusy(true);
    try {
      await deleteOsgbCompanyPortalAccount(account.id);
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      toast.success("Firma portal hesabı silindi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Hesap silinemedi.");
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async (company: OsgbWorkspaceCompanyOption, account: OsgbCompanyPortalAccountRecord) => {
    const text = [`Firma Portal Girişi`, `Giriş adresi: ${companyLoginUrl}`, `Firma: ${company.companyName}`, `Kullanıcı adı: ${account.username}`, `Şifre: ${account.passwordPlain || "(şifre kayıtlı değil)"}`].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Firma giriş bilgileri kopyalandı.");
    } catch {
      toast.error("Giriş bilgileri kopyalanamadı.");
    }
  };

  const togglePassword = (accountId: string) => {
    setShownPasswords((current) => {
      const next = new Set(current);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  if (!organizationId) {
    return (
      <div className="space-y-4 text-slate-100">
        <Header />
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
          Firma görevlendirme ekranı için önce bir organizasyon çalışma alanına bağlanın.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-slate-100">
      <Header />

      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3 shadow-sm shadow-black/10 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1 xl:max-w-[310px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Firma ara... (ör: güvenlik, istanbul)" className={cn(inputClass, "pl-9")} />
          </div>

          <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 xl:pb-0">
            <FilterChip active={statusFilter === "all"} label="Tümü" count={counts.all} onClick={() => setStatusFilter("all")} />
            <FilterChip active={statusFilter === "has_account"} label="Hesabı Var" count={counts.hasAccount} onClick={() => setStatusFilter("has_account")} />
            <FilterChip active={statusFilter === "no_account"} label="Hesabı Yok" count={counts.noAccount} onClick={() => setStatusFilter("no_account")} />
            <FilterChip active={statusFilter === "active"} label="Aktif" count={counts.active} onClick={() => setStatusFilter("active")} />
            <FilterChip active={statusFilter === "passive"} label="Pasif" count={counts.passive} onClick={() => setStatusFilter("passive")} />
          </div>

          <div className="hidden h-8 w-px shrink-0 bg-slate-700/70 xl:block" />

          <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:shrink-0">
            <Select value={hazardFilter} onValueChange={setHazardFilter}>
              <SelectTrigger className={cn(selectTriggerClass, "xl:w-[180px]")}> <SelectValue placeholder="Tüm Tehlike Sınıfları" /> </SelectTrigger>
              <SelectContent className={selectContentClass}>
                <SelectItem value="all">Tüm Tehlike Sınıfları</SelectItem>
                {hazardOptions.map((hazard) => <SelectItem key={hazard} value={hazard}>{hazard}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={personnelFilter} onValueChange={setPersonnelFilter}>
              <SelectTrigger className={cn(selectTriggerClass, "xl:w-[150px]")}> <SelectValue placeholder="Tüm Personeller" /> </SelectTrigger>
              <SelectContent className={selectContentClass}>
                <SelectItem value="all">Tüm Personeller</SelectItem>
                {personnel.map((person) => <SelectItem key={person.id} value={person.id}>{person.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <p className="px-1 text-xs font-semibold text-slate-400">{filteredCompanies.length} / {companies.length} firma gösteriliyor</p>

      <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/50 shadow-sm shadow-black/10">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-900/70 text-xs font-semibold text-slate-300">
              <tr>
                <th className="px-4 py-3">Firma</th>
                <th className="px-4 py-3">Kullanıcı Adı</th>
                <th className="px-4 py-3">Şifre</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Son Giriş</th>
                <th className="px-4 py-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="h-28 px-4 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...</span>
                  </td>
                </tr>
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="h-28 px-4 text-center text-slate-500">
                    {companies.length === 0 ? 'Kayıtlı OSGB firmanız bulunmuyor. "OSGB Firmaları" sekmesinden firma ekleyin.' : "Filtrelere uygun firma bulunamadı."}
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => {
                  const account = accountByCompany.get(company.id);
                  const showPassword = Boolean(account && shownPasswords.has(account.id));
                  return (
                    <tr key={company.id} className="h-14 border-t border-slate-800/70 transition hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-100">{company.companyName}</div>
                        <div className="mt-1 text-xs text-slate-500">{company.sgkNo || "SGK No yok"} · {company.hazardClass}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">{account?.username || "—"}</td>
                      <td className="px-4 py-3">
                        {account ? (
                          <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
                            <span>{showPassword ? account.passwordPlain || "Şifre yok" : maskPassword(account.passwordPlain)}</span>
                            <Button type="button" variant="ghost" size="icon" onClick={() => togglePassword(account.id)} className="h-7 w-7 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white">
                              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {account ? (
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black", account.isActive ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300" : "border-slate-600 bg-slate-800 text-slate-400")}>
                            {account.isActive ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                            {account.isActive ? "Aktif" : "Pasif"}
                          </span>
                        ) : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{account ? formatDate(account.lastLoginAt) : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {account ? (
                            <>
                              <Button type="button" variant="ghost" size="icon" onClick={() => void handleCopy(company, account)} className="h-8 w-8 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white"><Copy className="h-4 w-4" /></Button>
                              <Button type="button" variant="ghost" size="icon" onClick={() => openRenewDialog(company, account)} className="h-8 w-8 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white"><RefreshCcw className="h-4 w-4" /></Button>
                              <Button type="button" variant="ghost" size="icon" disabled={busy} onClick={() => void handleToggleActive(account)} className="h-8 w-8 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white">{account.isActive ? <ShieldOff className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</Button>
                              <Button type="button" variant="ghost" size="icon" disabled={busy} onClick={() => void handleDelete(account)} className="h-8 w-8 rounded-xl text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"><Trash2 className="h-4 w-4" /></Button>
                            </>
                          ) : (
                            <Button type="button" onClick={() => openCreateDialog(company)} className="h-9 rounded-xl bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-500">
                              <Plus className="mr-1.5 h-4 w-4" /> Hesap Oluştur
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PortalAccountDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        company={selectedCompany}
        username={formUsername}
        password={formPassword}
        busy={busy}
        onUsernameChange={setFormUsername}
        onPasswordChange={setFormPassword}
        onGenerate={() => {
          if (selectedCompany) setFormUsername(makeUniqueUsername(selectedCompany.companyName, accounts));
          setFormPassword(generatePassword());
        }}
        onSubmit={() => void handleCreateAccount()}
      />

      <PortalAccountDialog
        open={renewOpen}
        onOpenChange={setRenewOpen}
        mode="renew"
        company={selectedCompany}
        username={formUsername}
        password={formPassword}
        busy={busy}
        onUsernameChange={setFormUsername}
        onPasswordChange={setFormPassword}
        onGenerate={() => setFormPassword(generatePassword())}
        onSubmit={() => void handleRenewPassword()}
      />
    </div>
  );
}
