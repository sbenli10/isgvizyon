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
  const { loading: subscriptionLoading, demoState, isPaidSubscriptionActive, refetch: refetchSubscription } = useSubscription();
  const [confirmDemoOpen, setConfirmDemoOpen] = useState(false);
  const [startingDemo, setStartingDemo] = useState(false);
  const activeTab = useMemo<ProfileTab>(() => {
    const tab = searchParams.get("tab") as ProfileTab | null;
    return tab && tabIds.has(tab) ? tab : "overview";
  }, [searchParams]);

  const demoButtonLabel = useMemo(() => {
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
  }, [demoState.daysLeft, demoState.hasDemo, demoState.hasExpired, demoState.isActive, startingDemo]);

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

  const activeTabConfig = PROFILE_TABS.find((tab) => tab.id === activeTab) ?? PROFILE_TABS[0];
  const profileName = profile?.full_name || user?.email?.split("@")[0] || "ISGVizyon kullanıcısı";
  const planLabel = isPaidSubscriptionActive ? "Aktif paket" : demoState.isActive ? "Demo aktif" : "Standart erişim";
  const workspaceLabel = profile?.organization_id ? "Organizasyon bağlı" : "Kişisel çalışma alanı";
  const quickStats = [
    { label: "Aktif Sekme", value: activeTabConfig.label, icon: activeTabConfig.icon, tone: "from-cyan-400/20 to-blue-500/10" },
    { label: "Modül", value: PROFILE_TABS.length, icon: LayoutGrid, tone: "from-violet-400/20 to-fuchsia-500/10" },
    { label: "Çalışma Alanı", value: workspaceLabel, icon: Building2, tone: "from-emerald-400/20 to-teal-500/10" },
    { label: "Üyelik", value: planLabel, icon: CreditCard, tone: "from-amber-400/20 to-orange-500/10" },
  ];

  return (
    <div className="relative flex h-[calc(100dvh-136px)] min-h-[680px] w-full min-w-0 flex-col overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.22),transparent_30%),radial-gradient(circle_at_82%_12%,rgba(124,58,237,0.20),transparent_28%),linear-gradient(180deg,#08111f_0%,#0b1324_45%,#050816_100%)] p-3 text-slate-100 shadow-[0_30px_100px_rgba(2,6,23,0.36)] sm:p-4 lg:p-5">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-16 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />

      <section className="relative shrink-0 overflow-hidden rounded-[30px] border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(14,165,233,0.12),transparent_42%,rgba(168,85,247,0.12))]" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <Badge className="rounded-full border border-cyan-300/30 bg-cyan-400/12 px-3 py-1 text-cyan-100 shadow-lg shadow-cyan-950/20">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              ISGVizyon Yönetim Merkezi
            </Badge>
            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-blue-600 to-cyan-400 shadow-xl shadow-blue-950/25">
                <ShieldCheck className="h-8 w-8 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-4xl">Profilim</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  {profileName} için firma, çalışan, eğitim, evrak, rapor, ziyaret ve abonelik yönetimini tek profesyonel panelde toplayın.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-bold sm:grid-cols-4 xl:min-w-[620px]">
            {quickStats.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className={"rounded-3xl border border-white/10 bg-gradient-to-br p-3 shadow-lg shadow-black/10 " + item.tone}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                      <p className="mt-2 truncate text-sm font-black text-white">{item.value}</p>
                    </div>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                      <Icon className="h-4 w-4 text-cyan-100" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {showDemoControl ? (
          <div className="relative mt-4 flex justify-start xl:justify-end">
            <Button
              type="button"
              disabled={!showDemoStartButton || startingDemo || !user}
              onClick={() => setConfirmDemoOpen(true)}
              className={
                "min-h-11 rounded-2xl px-5 text-xs font-black shadow-lg transition " +
                (showDemoStatusBadge
                  ? "border border-amber-300/25 bg-amber-400/10 text-amber-100 hover:bg-amber-400/10 disabled:opacity-80"
                  : "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-amber-500/20 hover:from-amber-300 hover:to-yellow-400")
              }
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {demoButtonLabel}
            </Button>
          </div>
        ) : null}
      </section>

      <div className="relative z-10 mt-4 shrink-0">
        <ProfileTabs tabs={PROFILE_TABS} activeTab={activeTab} onChange={handleTabChange} />
      </div>

      <section className="relative z-10 mt-4 min-h-0 flex-1 overflow-y-auto rounded-[30px] border border-white/10 bg-slate-950/35 p-3 shadow-2xl shadow-black/15 backdrop-blur-xl [scrollbar-width:none] sm:p-4 [&::-webkit-scrollbar]:hidden">
        {renderActiveTab()}
      </section>

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
