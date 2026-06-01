import { useMemo } from "react";
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
  TriangleAlert,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  const activeTab = useMemo<ProfileTab>(() => {
    const tab = searchParams.get("tab") as ProfileTab | null;
    return tab && tabIds.has(tab) ? tab : "overview";
  }, [searchParams]);

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
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
            {["Tek Merkez", "Canlı Veri", "Koyu Tema"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-slate-100">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <ProfileTabs tabs={PROFILE_TABS} activeTab={activeTab} onChange={handleTabChange} />

      <section className="min-h-[520px]">{renderActiveTab()}</section>
    </div>
  );
}
