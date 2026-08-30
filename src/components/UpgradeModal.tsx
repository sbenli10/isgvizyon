import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  Building2,
  Check,
  ClipboardCopy,
  CreditCard,
  Crown,
  FileUp,
  Headphones,
  Landmark,
  LockKeyhole,
  Rocket,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useCreateWorkspaceOrganization } from "@/hooks/useCreateWorkspaceOrganization";
import {
  createManualBankTransferPaymentRequest,
  submitManualPaymentReceipt,
  type BankTransferSettings,
  type ManualPaymentInvoiceInfo,
  type ManualPaymentRequest,
} from "@/lib/billing";
import { getUserFacingError, getUserFacingErrorDescription } from "@/lib/userFacingError";
import type { BillingCatalogPlan, BillingPeriod, SubscriptionPlan } from "@/types/subscription";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggeredBy?: "trial_expired" | "feature_locked" | "manual" | "organization_required";
}

type PaidPlan = Extract<SubscriptionPlan, "premium" | "osgb">;
type PlanTone = "free" | "premium" | "osgb";
type OrganizationForm = {
  name: string;
  industry: string;
  city: string;
  phone: string;
  website: string;
};

const HIDE_UPGRADE_MODAL_KEY = "isgvizyon-hide-upgrade-modal";

const planFeatureHighlights: Record<PlanTone, string[]> = {
  free: [
    "1 firma ve sınırlı çalışan kaydı",
    "Temel İSG formları ve rapor çıktıları",
    "Kısıtlı AI ve aylık kullanım limitleri",
  ],
  premium: [
    "AI destekli DÖF, risk ve saha analizleri",
    "Sertifika, formlar, raporlar ve gelişmiş çıktı araçları",
    "Daha yüksek aylık kota ve profesyonel kullanım",
  ],
  osgb: [
    "Sınırsız firma operasyonu ve OSGB yönetim paneli",
    "Personel, görevlendirme, finans ve müşteri portalı",
    "Premium modüllerin tamamı ve kurumsal kapasite",
  ],
};

const planToneClass: Record<PlanTone, string> = {
  free: "border-slate-700/80 bg-slate-950/60",
  premium:
    "border-violet-400/50 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.28),rgba(15,23,42,0.92)_48%)] shadow-[0_24px_70px_rgba(124,58,237,0.22)]",
  osgb:
    "border-cyan-400/45 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.22),rgba(15,23,42,0.92)_48%)] shadow-[0_24px_70px_rgba(14,165,233,0.18)]",
};

const emptyInvoiceInfo: ManualPaymentInvoiceInfo = {
  invoiceType: "individual",
  title: "",
  taxOffice: "",
  taxNumber: "",
  identityNumber: "",
  address: "",
  email: "",
  phone: "",
};

function formatPrice(value: number | null | undefined, fallback: number) {
  const price = typeof value === "number" && value > 0 ? value : fallback;
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(price);
}

function getPlanPrice(plans: BillingCatalogPlan[], planCode: PaidPlan) {
  return plans.find((entry) => entry.planCode === planCode)?.price ?? null;
}

function getRequestReference(request?: ManualPaymentRequest | null) {
  return request?.referenceCode || request?.reference_code || "";
}

function getRequestPlan(request?: ManualPaymentRequest | null) {
  return request?.planCode || request?.plan_code || "";
}

function getRequestPeriod(request?: ManualPaymentRequest | null) {
  return request?.billingPeriod || request?.billing_period || "monthly";
}

function getBankText(bank: BankTransferSettings, key: keyof BankTransferSettings) {
  return String(bank[key] || "");
}

function PlanCard({
  tone,
  title,
  subtitle,
  price,
  period,
  icon,
  current,
  badge,
  disabled,
  loading,
  buttonLabel,
  secondaryButtonLabel,
  secondaryLoading,
  onClick,
  onSecondaryClick,
}: {
  tone: PlanTone;
  title: string;
  subtitle: string;
  price: string;
  period: string;
  icon: ReactNode;
  current?: boolean;
  badge?: string;
  disabled?: boolean;
  loading?: boolean;
  buttonLabel: string;
  secondaryButtonLabel?: string;
  secondaryLoading?: boolean;
  onClick?: () => void;
  onSecondaryClick?: () => void;
}) {
  return (
    <div className={`relative flex min-h-[390px] flex-col rounded-2xl border p-5 ${planToneClass[tone]}`}>
      {badge && (
        <Badge className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold text-white">
          {badge}
        </Badge>
      )}

      <div className="mb-5 flex items-start gap-3 pr-20">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-white">{icon}</div>
        <div>
          <h3 className="text-xl font-black text-white">{title}</h3>
          <p className="mt-1 text-xs font-medium leading-5 text-slate-300">{subtitle}</p>
        </div>
      </div>

      <div className="mb-5">
        <div className="flex items-end gap-1">
          <span className="text-4xl font-black tracking-tight text-white">{price}</span>
          {price !== "Ücretsiz" && <span className="pb-1 text-sm font-semibold text-slate-300">₺</span>}
          <span className="pb-1 text-xs font-semibold text-slate-400">/{period}</span>
        </div>
      </div>

      <ul className="mb-6 flex-1 space-y-3">
        {planFeatureHighlights[tone].map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm leading-5 text-slate-200">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {current && (
        <div className="mb-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100">
          Bu paket şu anda hesabınızda aktif.
        </div>
      )}

      <div className="grid gap-2">
      <Button
        disabled={disabled || loading || current}
        onClick={onClick}
        className={
          tone === "premium"
            ? "h-11 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 font-bold text-white shadow-lg shadow-violet-950/30 hover:from-violet-500 hover:to-fuchsia-400"
            : tone === "osgb"
              ? "h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-white shadow-lg shadow-cyan-950/30 hover:from-cyan-400 hover:to-blue-500"
              : "h-11 rounded-xl border border-white/10 bg-white/10 font-bold text-white hover:bg-white/15"
        }
      >
        {loading ? "Ödeme hazırlanıyor..." : buttonLabel}
      </Button>
        {secondaryButtonLabel ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled || secondaryLoading || current}
            onClick={onSecondaryClick}
            className="h-10 rounded-xl border-amber-300/30 bg-amber-500/10 font-bold text-amber-100 hover:bg-amber-500/20 hover:text-white"
          >
            <Landmark className="mr-2 h-4 w-4" />
            {secondaryLoading ? "Hazırlanıyor..." : secondaryButtonLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function UpgradeModal({ open, onOpenChange, triggeredBy = "manual" }: UpgradeModalProps) {
  const { profile } = useAuth();
  const {
    plan,
    status,
    plans,
    isOrganizationAdmin,
    isDemoActive,
    hasStripeCustomer,
    hasStripeSubscription,
  } = useSubscription();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const [hideAgain, setHideAgain] = useState(false);
  const [manualPlan, setManualPlan] = useState<PaidPlan | null>(null);
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false);
  const [manualPaymentBusy, setManualPaymentBusy] = useState(false);
  const [manualRequest, setManualRequest] = useState<ManualPaymentRequest | null>(null);
  const [manualBank, setManualBank] = useState<BankTransferSettings>({});
  const [invoiceInfo, setInvoiceInfo] = useState<ManualPaymentInvoiceInfo>(emptyInvoiceInfo);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [organizationPromptOpen, setOrganizationPromptOpen] = useState(false);
  const [organizationForm, setOrganizationForm] = useState<OrganizationForm>({
    name: "",
    industry: "Ortak Sağlık ve Güvenlik Birimi (OSGB)",
    city: "",
    phone: "",
    website: "",
  });

  const hasOrganization = Boolean(profile?.organization_id);
  const canPurchase = !hasOrganization || isOrganizationAdmin;
  const premiumMonthly = getPlanPrice(plans, "premium");
  const osgbMonthly = getPlanPrice(plans, "osgb");

  const premiumPrice = useMemo(() => {
    const monthly = Number(formatPrice(premiumMonthly, 249).replace(/\./g, ""));
    return billingPeriod === "yearly" ? formatPrice(monthly * 10, 2490) : formatPrice(premiumMonthly, 249);
  }, [billingPeriod, premiumMonthly]);

  const osgbPrice = useMemo(() => {
    const monthly = Number(formatPrice(osgbMonthly, 499).replace(/\./g, ""));
    return billingPeriod === "yearly" ? formatPrice(monthly * 10, 4990) : formatPrice(osgbMonthly, 499);
  }, [billingPeriod, osgbMonthly]);

  const manualPaymentAmount = manualPlan === "osgb" ? osgbPrice : premiumPrice;

  const { creating: creatingOrganization, createWorkspaceOrganization } = useCreateWorkspaceOrganization();

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && hideAgain) {
      window.localStorage.setItem(HIDE_UPGRADE_MODAL_KEY, "1");
    }

    onOpenChange(nextOpen);
  };

  const showManualPayment = (planCode: PaidPlan) => {
    setManualPlan(planCode);
    setManualPaymentOpen(true);
    setManualRequest(null);
    setManualBank({});
    setReceiptFile(null);
    setInvoiceInfo((current) => ({
      ...emptyInvoiceInfo,
      title: current.title || profile?.full_name || "",
      email: current.email || profile?.email || "",
    }));
  };

  const openManualPayment = (planCode: PaidPlan) => {
    if (planCode === "osgb" && !hasOrganization) {
      openOrganizationPrompt();
      return;
    }

    showManualPayment(planCode);
  };

  const createOrganizationAndContinue = async () => {
    const name = organizationForm.name.trim();
    if (name.length < 2) {
      toast.error("Organizasyon adını yazın.");
      return;
    }

    const website = organizationForm.website.trim();
    if (website && !/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(website)) {
      toast.error("Geçerli bir web sitesi adresi yazın.");
      return;
    }

    const organizationId = await createWorkspaceOrganization(undefined, {
      ...organizationForm,
      name,
      website,
    });
    if (!organizationId) return;

    setOrganizationPromptOpen(false);
    showManualPayment("osgb");
  };

  const openOrganizationPrompt = () => {
    setOrganizationForm((current) => ({
      ...current,
      name: current.name || `${profile?.full_name?.trim() || "Yeni"} OSGB`,
      phone: current.phone || profile?.phone || "",
    }));
    setOrganizationPromptOpen(true);
  };

  useEffect(() => {
    if (open && triggeredBy === "organization_required" && !hasOrganization) {
      openOrganizationPrompt();
    }
  }, [open, triggeredBy, hasOrganization]);

  const updateInvoiceInfo = (patch: Partial<ManualPaymentInvoiceInfo>) => {
    setInvoiceInfo((current) => ({ ...current, ...patch }));
  };

  const copyText = async (label: string, value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success(`${label} kopyalandı.`);
  };

  const createManualRequest = async () => {
    if (!manualPlan) return;
    if (!invoiceInfo.title.trim() || !invoiceInfo.address.trim() || !invoiceInfo.email.trim()) {
      toast.error("Fatura bilgileri eksik.", { description: "Ünvan/ad soyad, e-posta ve fatura adresi zorunludur." });
      return;
    }

    setManualPaymentBusy(true);
    try {
      const payload = await createManualBankTransferPaymentRequest(manualPlan, billingPeriod, invoiceInfo);
      setManualRequest(payload.request);
      setManualBank(payload.bank);
      toast.success("Ödeme açıklama kodu oluşturuldu.", { description: "Havale/EFT açıklamasına bu kodu yazın." });
    } catch (error) {
      const details = getUserFacingError(error);
      toast.error(details.title, { description: getUserFacingErrorDescription(error) });
    } finally {
      setManualPaymentBusy(false);
    }
  };

  const uploadReceipt = async () => {
    if (!manualRequest?.id) return;
    if (!receiptFile) {
      toast.error("Dekont yüklemek zorunludur.");
      return;
    }

    setManualPaymentBusy(true);
    try {
      const payload = await submitManualPaymentReceipt(manualRequest.id, receiptFile);
      setManualRequest(payload.request);
      toast.success("Dekont gönderildi.", { description: "Ödeme onayı 1 iş günü içinde yapılır." });
    } catch (error) {
      const details = getUserFacingError(error);
      toast.error(details.title, { description: getUserFacingErrorDescription(error) });
    } finally {
      setManualPaymentBusy(false);
    }
  };

  return (
    <>
    <Dialog
      open={open && !isDemoActive && !organizationPromptOpen && !manualPaymentOpen}
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="max-h-[92vh] w-[calc(100vw-24px)] max-w-6xl overflow-hidden rounded-3xl border border-slate-700/80 bg-[#07111f] p-0 text-white shadow-2xl shadow-black/50">
        <DialogHeader className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(17,24,39,0.96))] px-6 py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-100">
                <LockKeyhole className="h-3.5 w-3.5" />
                Güvenli Ödeme
              </div>
              <DialogTitle className="text-3xl font-black tracking-tight text-white">
                Planınızı seçin, ödeme adımına güvenle geçin
              </DialogTitle>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Free, Premium ve OSGB paketlerini tek ekranda karşılaştırın. Ücretli paket başvuruları
                fatura bilgileri ve ödeme dekontuyla güvenli biçimde alınır.
              </p>
            </div>

            <div className="flex rounded-2xl border border-white/10 bg-slate-950/70 p-1">
              {(["monthly", "yearly"] as BillingPeriod[]).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setBillingPeriod(period)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                    billingPeriod === period
                      ? "bg-white text-slate-950 shadow-lg"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {period === "monthly" ? "Aylık" : "Yıllık"}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(92vh-210px)] overflow-y-auto p-5 md:p-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <PlanCard
              tone="free"
              title="Free"
              subtitle="Temel başlangıç ve sınırlı kullanım"
              price="Ücretsiz"
              period="süresiz"
              icon={<BadgeCheck className="h-6 w-6" />}
              current={plan === "free" && status !== "trial"}
              buttonLabel="Mevcut plan"
              disabled
            />

            <PlanCard
              tone="premium"
              title="Premium"
              subtitle="İSG profesyonelleri için gelişmiş üretim paketi"
              price={premiumPrice}
              period={billingPeriod === "monthly" ? "ay" : "yıl"}
              icon={<Rocket className="h-6 w-6" />}
              badge={billingPeriod === "yearly" ? "2 ay avantaj" : "Popüler"}
              current={plan === "premium" || status === "trial"}
              disabled={!canPurchase || plan === "osgb"}
              buttonLabel={plan === "osgb" ? "OSGB paketine dahil" : "Premium'a geç"}
              onClick={() => openManualPayment("premium")}
            />

            <PlanCard
              tone="osgb"
              title="OSGB"
              subtitle="Çoklu firma, ekip ve operasyon yönetimi"
              price={osgbPrice}
              period={billingPeriod === "monthly" ? "ay" : "yıl"}
              icon={<Building2 className="h-6 w-6" />}
              badge="Kurumsal"
              current={plan === "osgb"}
              disabled={!canPurchase}
              buttonLabel="OSGB'ye geç"
              onClick={() => openManualPayment("osgb")}
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <CreditCard className="mb-3 h-5 w-5 text-cyan-300" />
              <p className="font-bold text-white">Güvenli ödeme başvurusu</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">Benzersiz açıklama kodu ve zorunlu dekont ile her ödeme kayıt altına alınır.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <Sparkles className="mb-3 h-5 w-5 text-violet-300" />
              <p className="font-bold text-white">Üyelik ayrışması</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">Plan değişince modül izinleri ve limitler otomatik olarak ayrışır.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <Headphones className="mb-3 h-5 w-5 text-emerald-300" />
              <p className="font-bold text-white">Portal yönetimi</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                {hasStripeCustomer || hasStripeSubscription
                  ? "Aktif müşteri kaydınız bulundu; abonelik portalı kullanılabilir."
                  : "Ödeme sonrası müşteri portalı otomatik açılabilir hale gelir."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 bg-slate-950/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <input
              type="checkbox"
              checked={hideAgain}
              onChange={(event) => setHideAgain(event.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
            />
            Bu bilgilendirme penceresini tekrar gösterme
          </label>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Crown className="h-4 w-4 text-amber-300" />
            Fiyatlar admin panelinden güncellenir; üyelik yalnızca ödeme onayından sonra açılır.
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={organizationPromptOpen} onOpenChange={setOrganizationPromptOpen}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-24px)] max-w-xl overflow-y-auto rounded-3xl border border-cyan-300/25 bg-[#07111f] p-0 text-white shadow-2xl shadow-black/50">
        <DialogHeader className="border-b border-cyan-300/15 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/60 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-cyan-300/25 bg-cyan-500/15 p-3 text-cyan-100">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black text-white">Önce organizasyonunuzu oluşturun</DialogTitle>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                OSGB paketi kurumsal bir çalışma alanına bağlı çalışır. Organizasyon oluşturulduktan sonra ödeme adımına devam edebilirsiniz.
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 p-6">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Seçilen paket</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-lg font-black text-white">OSGB / {billingPeriod === "yearly" ? "Yıllık" : "Aylık"}</p>
                <p className="mt-1 text-sm text-slate-300">Organizasyonu oluşturmadan ödeme başlatılamaz.</p>
              </div>
              <p className="whitespace-nowrap text-2xl font-black text-white">{osgbPrice} ₺</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="organization-name" className="text-slate-200">Organizasyon adı *</Label>
              <Input
                id="organization-name"
                value={organizationForm.name}
                onChange={(event) => setOrganizationForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Örn. ABC Ortak Sağlık Güvenlik Birimi"
                maxLength={120}
                className="h-11 rounded-xl border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organization-industry" className="text-slate-200">Sektör</Label>
              <Input
                id="organization-industry"
                value={organizationForm.industry}
                onChange={(event) => setOrganizationForm((current) => ({ ...current, industry: event.target.value }))}
                placeholder="Örn. OSGB"
                maxLength={100}
                className="h-11 rounded-xl border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organization-city" className="text-slate-200">Şehir</Label>
              <Input
                id="organization-city"
                value={organizationForm.city}
                onChange={(event) => setOrganizationForm((current) => ({ ...current, city: event.target.value }))}
                placeholder="Örn. İstanbul"
                maxLength={80}
                className="h-11 rounded-xl border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organization-phone" className="text-slate-200">Telefon</Label>
              <Input
                id="organization-phone"
                type="tel"
                value={organizationForm.phone}
                onChange={(event) => setOrganizationForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="Örn. 0 212 000 00 00"
                maxLength={30}
                className="h-11 rounded-xl border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organization-website" className="text-slate-200">Web sitesi</Label>
              <Input
                id="organization-website"
                type="url"
                value={organizationForm.website}
                onChange={(event) => setOrganizationForm((current) => ({ ...current, website: event.target.value }))}
                placeholder="Örn. https://firma.com"
                maxLength={160}
                className="h-11 rounded-xl border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
              />
            </div>
          </div>
          <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-50">
            Organizasyon oluşturmak OSGB paketini etkinleştirmez. Paket yalnızca ödeme başarıyla tamamlandıktan veya Havale/EFT dekontu platform yöneticisi tarafından onaylandıktan sonra açılır.
          </div>
          <div>
            <Button
              type="button"
              disabled={creatingOrganization}
              onClick={() => void createOrganizationAndContinue()}
              className="h-12 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-black text-white hover:from-cyan-400 hover:to-blue-500"
            >
              <Landmark className="mr-2 h-4 w-4" />
              {creatingOrganization ? "Oluşturuluyor..." : "Organizasyonu oluştur ve ödemeye geç"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={manualPaymentOpen} onOpenChange={setManualPaymentOpen}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-24px)] max-w-3xl overflow-y-auto rounded-3xl border border-amber-300/25 bg-[#07111f] p-0 text-white shadow-2xl shadow-black/50">
        <DialogHeader className="border-b border-amber-300/15 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/60 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-amber-300/25 bg-amber-500/15 p-3 text-amber-100">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black text-white">Havale / EFT ile Öde</DialogTitle>
              <p className="mt-1 text-sm leading-6 text-amber-100/80">
                Önce fatura bilgilerini girin, benzersiz ödeme açıklama kodunuzu alın. Dekont yüklenmeden ödeme talebi gönderilemez.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 p-6">
          <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-50">
            <strong>Ödeme onayı 1 iş günü içinde yapılır.</strong> Admin onayı olmadan üyelik açılmaz. Havale/EFT açıklamasına aşağıda üretilen kodu aynen yazın.
          </div>

          <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Ödenecek toplam</p>
                <p className="mt-1 text-sm text-slate-300">
                  {manualPlan === "osgb" ? "OSGB" : "Premium"} paket · {billingPeriod === "yearly" ? "Yıllık" : "Aylık"} ödeme
                </p>
              </div>
              <p className="text-3xl font-black tracking-tight text-white">{manualPaymentAmount} ₺</p>
            </div>
            <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-slate-400">
              Ödeme talebi oluşturulduğunda tutar sunucudaki güncel paket fiyatından tekrar doğrulanır.
            </p>
          </div>

          <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Fatura Bilgileri</p>
                <p className="mt-1 text-sm text-slate-400">Fatura bilgileri ödeme talebinden ayrı saklanır.</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-white">
                {manualPlan?.toUpperCase()} / {billingPeriod === "yearly" ? "Yıllık" : "Aylık"}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-200">Fatura tipi</Label>
                <select
                  value={invoiceInfo.invoiceType}
                  onChange={(event) => updateInvoiceInfo({ invoiceType: event.target.value as ManualPaymentInvoiceInfo["invoiceType"] })}
                  disabled={Boolean(manualRequest)}
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-400"
                >
                  <option value="individual">Bireysel</option>
                  <option value="corporate">Kurumsal</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Fatura ünvanı / Ad soyad *</Label>
                <Input value={invoiceInfo.title} onChange={(event) => updateInvoiceInfo({ title: event.target.value })} disabled={Boolean(manualRequest)} className="border-slate-700 bg-slate-950 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Vergi dairesi</Label>
                <Input value={invoiceInfo.taxOffice || ""} onChange={(event) => updateInvoiceInfo({ taxOffice: event.target.value })} disabled={Boolean(manualRequest)} className="border-slate-700 bg-slate-950 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">{invoiceInfo.invoiceType === "corporate" ? "Vergi no" : "T.C. kimlik no"}</Label>
                <Input
                  value={invoiceInfo.invoiceType === "corporate" ? invoiceInfo.taxNumber || "" : invoiceInfo.identityNumber || ""}
                  onChange={(event) => updateInvoiceInfo(invoiceInfo.invoiceType === "corporate" ? { taxNumber: event.target.value } : { identityNumber: event.target.value })}
                  disabled={Boolean(manualRequest)}
                  className="border-slate-700 bg-slate-950 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Fatura e-postası *</Label>
                <Input value={invoiceInfo.email} onChange={(event) => updateInvoiceInfo({ email: event.target.value })} disabled={Boolean(manualRequest)} className="border-slate-700 bg-slate-950 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Telefon</Label>
                <Input value={invoiceInfo.phone || ""} onChange={(event) => updateInvoiceInfo({ phone: event.target.value })} disabled={Boolean(manualRequest)} className="border-slate-700 bg-slate-950 text-white" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-slate-200">Fatura adresi *</Label>
                <Textarea value={invoiceInfo.address} onChange={(event) => updateInvoiceInfo({ address: event.target.value })} disabled={Boolean(manualRequest)} className="min-h-20 border-slate-700 bg-slate-950 text-white" />
              </div>
            </div>

            {!manualRequest ? (
              <Button onClick={() => void createManualRequest()} disabled={manualPaymentBusy} className="mt-4 h-11 w-full rounded-xl bg-amber-500 font-black text-slate-950 hover:bg-amber-400">
                {manualPaymentBusy ? "Kod oluşturuluyor..." : "Ödeme açıklama kodunu oluştur"}
              </Button>
            ) : null}
          </section>

          {manualRequest ? (
            <section className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Ödeme Bilgileri</p>
                  <h3 className="mt-1 text-xl font-black text-white">{Number(manualRequest.amount || 0).toLocaleString("tr-TR")} {manualRequest.currency || "TRY"}</h3>
                </div>
                <Badge className="border border-amber-300/25 bg-amber-500/15 text-amber-100">Onay bekler</Badge>
              </div>

              <div className="mt-4 grid gap-3">
                {[
                  ["Alıcı", getBankText(manualBank, "accountHolder")],
                  ["Banka", getBankText(manualBank, "bankName")],
                  ["IBAN", getBankText(manualBank, "iban")],
                  ["Açıklama kodu", getRequestReference(manualRequest)],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
                      <p className="mt-1 break-all text-sm font-bold text-white">{value || "Admin panelinden tanımlanacak"}</p>
                    </div>
                    {value ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => void copyText(label, value)} className="text-cyan-100 hover:bg-cyan-500/10 hover:text-white">
                        <ClipboardCopy className="mr-2 h-4 w-4" />
                        Kopyala
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-50">
                Açıklama alanına <strong>{getRequestReference(manualRequest)}</strong> yazılmayan ödemelerin eşleştirilmesi gecikebilir.
              </div>
            </section>
          ) : null}

          {manualRequest ? (
            <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Dekont</p>
              <p className="mt-1 text-sm text-slate-400">PDF, JPG, PNG veya WEBP dekont yükleyin. Dekont zorunludur.</p>
              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-600 bg-slate-950/60 px-4 py-8 text-center hover:border-cyan-400/70">
                <FileUp className="h-8 w-8 text-cyan-300" />
                <span className="mt-2 text-sm font-bold text-white">{receiptFile ? receiptFile.name : "Dekont dosyası seç"}</span>
                <span className="mt-1 text-xs text-slate-500">Maksimum 10 MB</span>
                <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => setReceiptFile(event.target.files?.[0] || null)} />
              </label>
              <Button onClick={() => void uploadReceipt()} disabled={manualPaymentBusy || !receiptFile || manualRequest.status === "pending" || manualRequest.status === "approved"} className="mt-4 h-11 w-full rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-500">
                {manualRequest.status === "pending" ? "Dekont gönderildi, onay bekliyor" : manualPaymentBusy ? "Dekont gönderiliyor..." : "Dekontu gönder ve onaya al"}
              </Button>
            </section>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
