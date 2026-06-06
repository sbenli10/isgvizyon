import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Archive,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutGrid,
  MapPin,
  Settings,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProfileTabs, type ProfileTab, type ProfileTabConfig } from "@/components/profile/ProfileTabs";
import { ProfileOverview } from "@/components/profile/ProfileOverview";
import { ProfileCompaniesTab } from "@/components/profile/ProfileCompaniesTab";
import { ProfileEmployeesTab } from "@/components/profile/ProfileEmployeesTab";
import { ProfileTrainingsTab } from "@/components/profile/ProfileTrainingsTab";
import { ProfileDocumentsTab } from "@/components/profile/ProfileDocumentsTab";
import { ProfileCompanyFollowTab } from "@/components/profile/ProfileCompanyFollowTab";
import { ProfileArchiveTab } from "@/components/profile/ProfileArchiveTab";
import { ProfileRisksTab } from "@/components/profile/ProfileRisksTab";
import { ProfileReportsTab } from "@/components/profile/ProfileReportsTab";
import { ProfileVisitsTab } from "@/components/profile/ProfileVisitsTab";
import { ProfileSubscriptionTab } from "@/components/profile/ProfileSubscriptionTab";
import { ProfileSettingsTab } from "@/components/profile/ProfileSettingsTab";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { startOsgbDemoSubscription } from "@/lib/demoSubscription";

const PROFILE_TABS: ProfileTabConfig[] = [
  { id: "overview", label: "Genel Bakış", icon: LayoutGrid },
  { id: "companies", label: "Firmalar", icon: Building2 },
  { id: "employees", label: "Çalışanlar", icon: Users },
  { id: "trainings", label: "Eğitmenler", icon: GraduationCap },
  { id: "documents", label: "Evrak Takip", icon: FileText },
  { id: "follow", label: "Firma Takip", icon: ShieldCheck },
  { id: "archive", label: "Arşiv", icon: Archive },
  { id: "risks", label: "Risklerim", icon: TriangleAlert },
  { id: "reports", label: "Raporlar", icon: ClipboardList },
  { id: "visits", label: "Firma Ziyaretleri", icon: MapPin },
  { id: "subscription", label: "Abonelik", icon: CreditCard },
  { id: "settings", label: "Ayarlar", icon: Settings },
];

const tabIds = new Set(PROFILE_TABS.map((tab) => tab.id));

export default function Profile() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
 const {
  loading: subscriptionLoading,
  overview,
  demoState,
  isDemoActive,
  refetch: refetchSubscription,
} = useSubscription();

const activePlanName = String(overview?.planName || "").toLocaleLowerCase("tr-TR");

const isPremiumActive = activePlanName.includes("premium");
const isOsgbActive = activePlanName.includes("osgb");
const isPaidSubscriptionActive = Boolean(isPremiumActive || isOsgbActive);
  const [confirmDemoOpen, setConfirmDemoOpen] = useState(false);
  const [startingDemo, setStartingDemo] = useState(false);

  const activeTab = useMemo<ProfileTab>(() => {
    const tab = searchParams.get("tab") as ProfileTab | null;
    return tab && tabIds.has(tab) ? tab : "overview";
  }, [searchParams]);

  const demoButtonLabel = useMemo(() => {
    if (subscriptionLoading) {
      return "Demo kontrol ediliyor...";
    }

    if (startingDemo) {
      return "Başlatılıyor...";
    }

    if (demoState.isActive) {
      return `Demo Aktif • ${demoState.daysLeft} gün kaldı`;
    }

    if (demoState.hasDemo && demoState.hasExpired) {
      return "Demo Süresi Doldu";
    }

    return "30 Günlük Demo Üyelik Başlat";
  }, [
    subscriptionLoading,
    demoState.daysLeft,
    demoState.hasDemo,
    demoState.hasExpired,
    demoState.isActive,
    startingDemo,
  ]);

  const showDemoStartButton = !subscriptionLoading && !isPaidSubscriptionActive && !demoState.hasDemo;
  const showDemoStatusBadge = !subscriptionLoading && !isPaidSubscriptionActive && demoState.hasDemo;
  const showDemoControl = showDemoStartButton || showDemoStatusBadge;

  const handleConfirmStartDemo = async () => {
    if (!user) {
      toast.error("Demo üyelik başlatmak için giriş yapmalısınız.");
      return;
    }

    if (isPaidSubscriptionActive || demoState.hasDemo) {
      toast.error("Aktif üyeliği olan veya daha önce demo kullanmış kullanıcı demo başlatamaz.");
      setConfirmDemoOpen(false);
      return;
    }

    setStartingDemo(true);
    try {
      await startOsgbDemoSubscription(user.id, profile?.organization_id ?? null);
      await refetchSubscription();
      toast.success("Demo üyeliğiniz başlatıldı. 30 gün boyunca tüm özellikleri kullanabilirsiniz.");
      setConfirmDemoOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Demo üyelik başlatılamadı.";
      toast.error(message);
    } finally {
      setStartingDemo(false);
    }
  };

  const handleTabChange = (tab: ProfileTab) => {
    const nextParams = new URLSearchParams(searchParams);
    if (tab === "overview") nextParams.delete("tab");
    else nextParams.set("tab", tab);
    setSearchParams(nextParams, { replace: true });
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case "companies":
        return <ProfileCompaniesTab />;
      case "employees":
        return <ProfileEmployeesTab />;
      case "trainings":
        return <ProfileTrainingsTab />;
      case "documents":
        return <ProfileDocumentsTab />;
      case "follow":
        return <ProfileCompanyFollowTab />;
      case "archive":
        return <ProfileArchiveTab />;
      case "risks":
        return <ProfileRisksTab />;
      case "reports":
        return <ProfileReportsTab />;
      case "visits":
        return <ProfileVisitsTab />;
      case "subscription":
        return <ProfileSubscriptionTab />;
      case "settings":
        return <ProfileSettingsTab />;
      default:
        return <ProfileOverview />;
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 px-4 pb-8 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[28px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.20),transparent_34%),linear-gradient(135deg,#020617,#0f172a_56%,#111827)] p-5 text-white shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">
              İSGVizyon Yönetim Merkezi
            </Badge>
            <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">Profilim</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Firmalar, çalışanlar, eğitimler, evrak takibi, riskler, raporlar, ziyaretler, abonelik ve ayarlar tek
              sekmeli merkezde yönetilir.
            </p>
          </div>

          <div className="flex flex-wrap justify-start gap-2 text-center text-xs font-bold lg:max-w-[430px] lg:justify-end">
            {["Tek Merkez", "Canlı Veri", "Koyu Tema"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-slate-100">
                {item}
              </div>
            ))}

            {showDemoControl ? (
              <Button
                type="button"
                disabled={!showDemoStartButton || startingDemo || !user}
                onClick={() => setConfirmDemoOpen(true)}
                className={`min-h-11 rounded-2xl px-4 text-xs font-black shadow-lg transition ${
                  showDemoStatusBadge
                    ? "border border-amber-300/25 bg-amber-400/10 text-amber-100 hover:bg-amber-400/10 disabled:opacity-80"
                    : "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-amber-500/20 hover:from-amber-300 hover:to-yellow-400"
                }`}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {demoButtonLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <ProfileTabs tabs={PROFILE_TABS} activeTab={activeTab} onChange={handleTabChange} />

      <section className="min-h-[520px]">{renderActiveTab()}</section>

      <Dialog open={confirmDemoOpen} onOpenChange={setConfirmDemoOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>30 Günlük OSGB Demo Üyeliği Başlatılsın mı?</DialogTitle>
            <DialogDescription className="text-slate-300">
              Demo süresince OSGB modülü ve platform özelliklerini 30 gün boyunca kullanabilirsiniz. Bu hak yalnızca bir kez kullanılabilir.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={startingDemo}
              onClick={() => setConfirmDemoOpen(false)}
              className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white"
            >
              İptal
            </Button>
            <Button
              type="button"
              disabled={startingDemo}
              onClick={() => void handleConfirmStartDemo()}
              className="bg-gradient-to-r from-amber-400 to-yellow-500 font-black text-slate-950 hover:from-amber-300 hover:to-yellow-400"
            >
              {startingDemo ? "Başlatılıyor..." : "Demoyu Başlat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
