import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  ClipboardCheck,
  FileText,
  Brain,
  Settings,
  Shield,
  ShieldAlert,
  ShieldPlus,
  ChevronRight,
  LogOut,
  User,
  BookOpen,
  TrendingUp,
  Building2,
  Flame,
  Calendar,
  Users,
  Mail,
  Bot,
  ChevronDown,
  History,
  Award,
  Briefcase,
  FileSearch,
  Gavel,
  CalendarClock,
  MapPinned,
  HeartPulse,
  Search,
  CircleHelp,
  PanelLeftClose,
  PanelLeftOpen,
  Link2,
  Globe2,
  Star,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { useOsgbAccess } from "@/hooks/useOsgbAccess";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number | null;
  children?: MenuItem[];
}

interface MenuGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
}

const sidebarShell = cn(
  "rounded-[28px] border border-slate-200/80 bg-white/95 text-slate-900 backdrop-blur-2xl",
  "shadow-[0_20px_60px_-40px_rgba(15,23,42,0.32)]",
  "dark:border-white/10 dark:bg-[#071426]/95 dark:text-slate-100",
  "dark:shadow-[0_20px_60px_-36px_rgba(2,12,27,0.95)]",
);

const sidebarGlow = cn(
  "bg-[radial-gradient(760px_circle_at_0%_0%,rgba(14,165,233,0.12),transparent_34%),radial-gradient(560px_circle_at_100%_8%,rgba(20,184,166,0.10),transparent_30%)]",
  "dark:bg-[radial-gradient(700px_circle_at_0%_0%,rgba(34,211,238,0.10),transparent_34%),radial-gradient(540px_circle_at_100%_8%,rgba(45,212,191,0.08),transparent_28%)]",
);

const sectionLabel =
  "mb-1 mt-2 flex w-full items-center justify-between px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500/80 transition-colors hover:text-slate-700 dark:text-slate-400/75 dark:hover:text-slate-300";

const menuItemBase =
  "group relative flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-[12.75px] font-medium leading-tight transition-all duration-150";

const menuItemIdle =
  "text-slate-700 hover:bg-slate-100/80 hover:text-slate-950 active:bg-slate-100 dark:text-slate-100/88 dark:hover:bg-white/5 dark:hover:text-white dark:active:bg-white/8";

const menuItemActive = cn(
  "bg-gradient-to-r from-cyan-500/10 via-teal-500/8 to-blue-500/10 text-[#067f7f] ring-1 ring-cyan-500/20",
  "shadow-[inset_3px_0_0_rgba(6,182,212,0.78)]",
  "dark:from-cyan-400/10 dark:via-teal-400/8 dark:to-blue-400/10 dark:text-cyan-100 dark:ring-cyan-300/15",
);

const submenuItemBase =
  "group relative flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium leading-tight transition-all duration-150";

const subtleLine =
  "absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-gradient-to-b from-cyan-400 via-teal-400 to-blue-500 opacity-0 transition-opacity duration-150";

const subtleLineActive = "opacity-100";

const actionButton = cn(
  "flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-all duration-150",
  "hover:bg-slate-100 hover:text-slate-900",
  "dark:text-slate-400 dark:hover:bg-white/6 dark:hover:text-white",
);

const collapsedUtilityButton = cn(
  "flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-600 transition",
  "hover:bg-slate-100 hover:text-slate-950",
  "dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white",
);

const badgeClassNames = (badge: MenuItem["badge"]) => {
  if (badge === "AI") {
    return "border border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-700 dark:border-fuchsia-400/25 dark:bg-fuchsia-500/14 dark:text-fuchsia-200";
  }

  if (badge === "NEW") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/12 dark:text-emerald-200";
  }

  if (badge === "Beta") {
    return "border border-sky-500/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/25 dark:bg-sky-500/14 dark:text-sky-200";
  }

  if (badge === "Pro") {
    return "border border-amber-500/25 bg-amber-500/10 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/14 dark:text-amber-200";
  }

  if (typeof badge === "number") {
    return "border border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-500/12 dark:text-indigo-100";
  }

  return "border border-slate-200/80 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/8 dark:text-slate-200";
};

function PillBadge({ value }: { value: string | number }) {
  return (
    <span
      className={cn(
        "ml-auto rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em]",
        badgeClassNames(value),
      )}
    >
      {value}
    </span>
  );
}

const getItemAccent = (item: MenuItem) => {
  const map: Array<[RegExp, string]> = [
    [/(bot|otomasyon|yapay zeka|ai|analizi|sorgulama)/i, "text-cyan-600 group-hover:text-cyan-700 dark:text-cyan-400 dark:group-hover:text-cyan-300"],
    [/(risk|kkd|iş kazası|güvenlik)/i, "text-emerald-600 group-hover:text-emerald-700 dark:text-emerald-400 dark:group-hover:text-emerald-300"],
    [/(döf|kurul|doküman|belge|sertifika|form|talimat|muayene)/i, "text-violet-600 group-hover:text-violet-700 dark:text-violet-400 dark:group-hover:text-violet-300"],
    [/(acil|tahliye|kroki|plan)/i, "text-amber-600 group-hover:text-amber-700 dark:text-amber-400 dark:group-hover:text-amber-300"],
    [/(osgb|firma|çalışan|ziyaret|programı|atama|arşiv|iş ilan)/i, "text-teal-600 group-hover:text-teal-700 dark:text-teal-400 dark:group-hover:text-teal-300"],
    [/(profil|panel|dashboard)/i, "text-blue-600 group-hover:text-blue-700 dark:text-blue-400 dark:group-hover:text-blue-300"],
    [/(nace|rapor|raporları)/i, "text-fuchsia-600 group-hover:text-fuchsia-700 dark:text-fuchsia-400 dark:group-hover:text-fuchsia-300"],
  ];

  const match = map.find(([regex]) => regex.test(item.title) || regex.test(item.url));
  return match?.[1] ?? "text-slate-500 group-hover:text-slate-700 dark:text-slate-300 dark:group-hover:text-white";
};

function MenuIcon({ item, active }: { item: MenuItem; active: boolean }) {
  const Icon = item.icon;

  return (
    <Icon
      className={cn(
        "h-[17px] w-[17px] shrink-0 stroke-[1.9] transition-colors duration-150",
        active ? "text-[#067f7f] dark:text-cyan-100" : getItemAccent(item),
      )}
    />
  );
}

function SubMenuIcon({ item, active }: { item: MenuItem; active: boolean }) {
  const Icon = item.icon;

  return (
    <Icon
      className={cn(
        "h-4 w-4 shrink-0 stroke-[1.85] transition-colors duration-150",
        active ? "text-[#067f7f] dark:text-cyan-100" : getItemAccent(item),
      )}
    />
  );
}

export function AppSidebar() {
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";

  const { signOut, user } = useAuth();
  const {
    canViewAnalytics,
    canViewAutomation,
    canViewCompanyHub,
    canViewDocuments,
    canViewFinance,
    canViewKatip,
    canViewPeople,
    canViewPortal,
  } = useOsgbAccess();
  const { hasAccess } = usePlanLimits();
  const canAccessOsgbModule = hasAccess("osgb_module").allowed;
  const canAccessIsgBot = hasAccess("isg_bot").allowed;
  const navigate = useNavigate();
  const location = useLocation();

  const [expandedSubmenus, setExpandedSubmenus] = useState<string[]>(["OSGB Modülü"]);
  const [draftMeetingsCount, setDraftMeetingsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [favoriteUrls, setFavoriteUrls] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];

    try {
      const stored = window.localStorage.getItem("app-sidebar-favorites");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

  useEffect(() => {
    if (user) void fetchDraftMeetingsCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("app-sidebar-favorites", JSON.stringify(favoriteUrls));
  }, [favoriteUrls]);

  const fetchDraftMeetingsCount = async () => {
    if (!user) return;
    try {
      const { count, error } = await supabase
        .from("board_meetings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "draft");

      if (!error) setDraftMeetingsCount(count || 0);
    } catch (error) {
      console.error("Failed to fetch draft meetings count:", error);
    }
  };

  const menuGroups: MenuGroup[] = useMemo(
    () => [
      {
        label: "Sık Kullanılanlar",
        icon: Star,
        items: [
          { title: "Risk Sihirbazı", url: "/risk-wizard", icon: TrendingUp, badge: "AI" },
          { title: "Acil Durum Planı", url: "/adep-wizard", icon: Flame, badge: null },
        ],
      },
      {
        label: "Genel",
        icon: LayoutDashboard,
        items: [
          { title: "Ana Panel", url: "/", icon: LayoutDashboard, badge: null },
          { title: "Profilim", url: "/profile", icon: User, badge: null },
          { title: "E-posta Arşivi", url: "/email-history", icon: Mail, badge: null },
        ],
      },
      {
        label: "Operasyonlar",
        icon: Briefcase,
        items: [
          { title: "Denetimler", url: "/inspections", icon: ClipboardCheck, badge: null },
          {
            title: "Kurul Toplantıları",
            url: "/board-meetings",
            icon: Users,
            badge: draftMeetingsCount > 0 ? draftMeetingsCount : null,
          },
          { title: "İSG FORMLARI", url: "/assignment-letters", icon: FileText, badge: null },
          { title: "İş Kazası / Ramak Kala", url: "/incidents", icon: ShieldAlert, badge: "NEW" },
          { title: "Periyodik Kontrol", url: "/periodic-controls", icon: CalendarClock, badge: "NEW" },
        ],
      },
      {
        label: "Firma & Kadro",
        icon: Building2,
        items: [
          { title: "Firmalar", url: "/companies", icon: Building2, badge: null },
          { title: "Çalışanlar", url: "/employees", icon: Users, badge: null },
          { title: "KKD Zimmet", url: "/ppe-management", icon: Shield, badge: "NEW" },
          { title: "Sağlık Gözetimi", url: "/health-surveillance", icon: HeartPulse, badge: "NEW" },
          canAccessOsgbModule
            ? {
                title: "OSGB Modülü",
                url: "/osgb",
                icon: Briefcase,
                badge: "NEW",
                children: [
                  { title: "OSGB Başlangıç", url: "/osgb/dashboard", icon: LayoutDashboard, badge: null },
                  { title: "Nasıl Kullanılır", url: "/osgb/how-to", icon: CircleHelp, badge: null },
                  canViewCompanyHub
                    ? { title: "Firma Havuzu", url: "/osgb/company-tracking", icon: Building2, badge: null }
                    : null,
                  canViewPeople
                    ? { title: "Personel ve Atamalar", url: "/osgb/assignments", icon: Briefcase, badge: null }
                    : null,
                  canViewPeople
                    ? { title: "Dakika ve Kapasite", url: "/osgb/capacity", icon: TrendingUp, badge: null }
                    : null,
                  canViewPeople
                    ? { title: "Saha Operasyonu", url: "/osgb/field-visits", icon: MapPinned, badge: "NEW" }
                    : null,
                  canViewDocuments
                    ? { title: "Yasal Evraklar", url: "/osgb/documents", icon: FileSearch, badge: null }
                    : null,
                  canViewFinance
                    ? { title: "Finans ve Karlılık", url: "/osgb/finance", icon: FileText, badge: null }
                    : null,
                  canViewAutomation
                    ? { title: "Otomasyon Merkezi", url: "/osgb/automation", icon: Bot, badge: "NEW" }
                    : null,
                  canViewKatip
                    ? { title: "ISG-KATIP Merkezi", url: "/osgb/isgkatip", icon: Link2, badge: "NEW" }
                    : null,
                  canViewPortal
                    ? { title: "Müşteri Portalı", url: "/osgb/client-portal", icon: Globe2, badge: "NEW" }
                    : null,
                  canViewAnalytics
                    ? { title: "Trend Analizi", url: "/osgb/analytics", icon: TrendingUp, badge: null }
                    : null,
                ].filter((item): item is NonNullable<typeof item> => item !== null),
              }
            : null,
        ].filter((item): item is MenuItem => item !== null),
      },
      {
        label: "Belge Yönetimi",
        icon: Award,
        items: [
          { title: "Sertifika Merkezi", url: "/dashboard/certificates", icon: Award, badge: "NEW" },
          { title: "Sertifika Geçmişi", url: "/dashboard/certificates/history", icon: History, badge: null },
          { title: "İSG Kütüphanesi", url: "/safety-library", icon: BookOpen, badge: null },
        ],
      },
      {
        label: "Risk & Güvenlik",
        icon: ShieldAlert,
        items: [
          { title: "Klasik Risk Editörü", url: "/risk-editor", icon: FileSearch, badge: "NEW" },
          { title: "DÖF Yönetimi", url: "/capa", icon: ShieldAlert, badge: null },
          { title: "DÖF Oluştur", url: "/bulk-capa", icon: ShieldPlus, badge: null },
          { title: "Mevzuat Belge Analizi", url: "/document-analysis", icon: Gavel, badge: "AI" },
          { title: "ADEP Planlarım", url: "/adep-plans", icon: FileText, badge: null },
          { title: "Tahliye Kroki Editörü", url: "/evacuation-editor", icon: MapPinned, badge: "NEW" },
          { title: "Kroki Geçmişleri", url: "/evacuation-editor/history", icon: History, badge: null },
          { title: "AI Kroki Analizi", url: "/blueprint-analyzer", icon: Search, badge: "AI" },
          { title: "Kroki Kullanım Rehberi", url: "/blueprint-analyzer/how-to", icon: CircleHelp, badge: null },
        ],
      },
      {
        label: "Planlama",
        icon: Calendar,
        items: [
          { title: "Yıllık Planlar", url: "/annual-plans", icon: Calendar, badge: null },
          { title: "NACE Kod Sorgulama", url: "/nace-query", icon: Shield, badge: "AI" },
          { title: "NACE Sektör Listesi", url: "/nace-query/sectors", icon: BookOpen, badge: null },
        ],
      },
      {
        label: "Yapay Zeka & Otomasyon",
        icon: Brain,
        items: [
          { title: "Yapay Zeka Raporları", url: "/reports", icon: Brain, badge: "Beta" },
          {
            title: "İSGBot",
            url: canAccessIsgBot ? "/isg-bot" : "/settings?tab=billing&upgrade=1",
            icon: Bot,
            badge: canAccessIsgBot ? "NEW" : "Kilitli",
          },
        ],
      },
    ],
    [
      canViewAnalytics,
      canViewAutomation,
      canViewCompanyHub,
      canViewDocuments,
      canViewFinance,
      canViewKatip,
      canViewPeople,
      canViewPortal,
      canAccessIsgBot,
      canAccessOsgbModule,
      draftMeetingsCount,
    ],
  );

  const isItemActive = (item: MenuItem) => {
    if (item.url === "/") return location.pathname === "/";
    return location.pathname === item.url || location.pathname.startsWith(`${item.url}/`);
  };

  const toggleSubmenu = (label: string) => {
    if (collapsed) return;
    setExpandedSubmenus((prev) =>
      prev.includes(label) ? prev.filter((it) => it !== label) : [...prev, label],
    );
  };

  const isSubmenuOpen = (item: MenuItem) => {
    if (!item.children?.length) return false;
    return expandedSubmenus.includes(item.title);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase("tr-TR");

  const flatMenuItems = useMemo(() => {
    return menuGroups.flatMap((group) =>
      group.items.flatMap((item) => (item.children?.length ? [item, ...item.children] : [item])),
    );
  }, [menuGroups]);

  const favoriteItems = useMemo(() => {
    return favoriteUrls
      .map((url) => flatMenuItems.find((item) => item.url === url))
      .filter((item): item is MenuItem => Boolean(item));
  }, [favoriteUrls, flatMenuItems]);

  const menuGroupsWithFavorites = useMemo(() => {
    return menuGroups.map((group) => {
      if (group.label !== "Sık Kullanılanlar") return group;

      const defaultItems = group.items.filter((item) => !favoriteUrls.includes(item.url));
      return {
        ...group,
        items: [...favoriteItems, ...defaultItems],
      };
    });
  }, [favoriteItems, favoriteUrls, menuGroups]);

  const filteredMenuGroups = useMemo(() => {
    if (!normalizedSearch) return menuGroupsWithFavorites;

    return menuGroupsWithFavorites
      .map((group) => {
        const matchesGroup = group.label.toLocaleLowerCase("tr-TR").includes(normalizedSearch);

        const items = group.items
          .map((item) => {
            const matchesItem = item.title.toLocaleLowerCase("tr-TR").includes(normalizedSearch);
            const filteredChildren = item.children?.filter((child) =>
              child.title.toLocaleLowerCase("tr-TR").includes(normalizedSearch),
            );

            if (matchesGroup || matchesItem) return item;
            if (filteredChildren?.length) return { ...item, children: filteredChildren };
            return null;
          })
          .filter((x): x is MenuItem => x !== null);

        return items.length ? { ...group, items } : null;
      })
      .filter((g): g is MenuGroup => g !== null);
  }, [menuGroupsWithFavorites, normalizedSearch]);

  const displayGroups = filteredMenuGroups;

  const isFavorite = (url: string) => favoriteUrls.includes(url);

  const toggleFavorite = (event: React.MouseEvent, item: MenuItem) => {
    event.preventDefault();
    event.stopPropagation();

    setFavoriteUrls((prev) =>
      prev.includes(item.url) ? prev.filter((url) => url !== item.url) : [item.url, ...prev].slice(0, 8),
    );
  };

  const toggleGroup = (label: string) => {
    if (collapsed || normalizedSearch) return;
    setCollapsedGroups((prev) =>
      prev.includes(label) ? prev.filter((it) => it !== label) : [...prev, label],
    );
  };

  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar
      collapsible="icon"
      desktopSpacer={false}
      style={
        {
          "--sidebar-width": "18rem",
          "--sidebar-width-icon": "4.65rem",
        } as React.CSSProperties
      }
      className={cn("top-0 z-[60] h-screen bg-transparent p-0 md:p-4")}
    >
      <div
        className={cn(
          sidebarShell,
          sidebarGlow,
          "flex h-full min-h-0 flex-col overflow-hidden",
          isMobile &&
            "rounded-none border-0 bg-white ring-0 shadow-none backdrop-blur-none dark:bg-[#071426]",
        )}
      >
        {collapsed && (
          <div className="border-b border-slate-200/80 px-2.5 py-3 dark:border-white/8">
            <div className="flex items-center justify-center">
              <button
                onClick={toggleSidebar}
                className={collapsedUtilityButton}
                title="Menüyü genişlet"
                type="button"
              >
                <PanelLeftOpen className="h-4 w-4 stroke-[1.9]" />
              </button>
            </div>
          </div>
        )}

        <SidebarHeader className={cn("border-b border-slate-200/80 px-3 py-3 dark:border-white/8", collapsed && "hidden")}>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.9] text-slate-400 dark:text-slate-500" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Menüde ara..."
                className={cn(
                  "h-9 rounded-xl border border-slate-200/80 bg-white/75 pl-8 pr-3 text-[12.5px] text-slate-900 shadow-none",
                  "placeholder:text-slate-400 hover:bg-slate-50 focus-visible:border-cyan-500/25 focus-visible:ring-1 focus-visible:ring-cyan-500/20",
                  "dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:bg-white/[0.05] dark:focus-visible:border-cyan-400/20 dark:focus-visible:ring-cyan-400/20",
                )}
              />
            </div>

            <button
              onClick={toggleSidebar}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
              title={collapsed ? "Menüyü aç" : "Menüyü daralt"}
              type="button"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4 stroke-[1.9]" />
              ) : (
                <PanelLeftClose className="h-4 w-4 stroke-[1.9]" />
              )}
            </button>
          </div>
        </SidebarHeader>

        <SidebarContent className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-2 overscroll-contain [scrollbar-color:rgba(148,163,184,0.38)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/60 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/60 dark:[scrollbar-color:rgba(255,255,255,0.14)_transparent] dark:[&::-webkit-scrollbar-thumb]:bg-white/10 dark:hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
          {!collapsed ? <WorkspaceSwitcher className="mx-1 mb-2" /> : null}

          {!collapsed && normalizedSearch && displayGroups.length === 0 && (
            <div className="m-2 rounded-xl border border-slate-200/80 bg-white/70 p-4 text-center text-sm text-slate-500 dark:border-white/8 dark:bg-white/[0.03] dark:text-slate-400">
              “{searchQuery}” için menü bulunamadı.
            </div>
          )}

          {displayGroups.map((group) => {
            const groupCollapsed = collapsedGroups.includes(group.label) && !normalizedSearch;

            return (
              <SidebarGroup key={`${group.label}-${group.items.length}`} className="px-1">
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    className={sectionLabel}
                    title={groupCollapsed ? `${group.label} grubunu aç` : `${group.label} grubunu kapat`}
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 stroke-[1.9] transition-transform duration-150",
                        groupCollapsed && "-rotate-90",
                      )}
                    />
                  </button>
                ) : (
                  <div className="my-2 flex justify-center">
                    <div className="h-5 w-px rounded-full bg-slate-200 dark:bg-white/12" />
                  </div>
                )}

                {!groupCollapsed && (
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0.5">
                      {group.items.map((item) => {
                        const hasChildren = Boolean(item.children?.length);
                        const active = isItemActive(item);
                        const submenuOpen = isSubmenuOpen(item);
                        const favorite = isFavorite(item.url);

                        if (hasChildren) {
                          return (
                            <SidebarMenuItem key={item.url}>
                              <button
                                type="button"
                                onClick={() => toggleSubmenu(item.title)}
                                className={cn(
                                  menuItemBase,
                                  menuItemIdle,
                                  active && menuItemActive,
                                  collapsed && "justify-center px-0",
                                )}
                              >
                                <span className={cn(subtleLine, active && subtleLineActive)} />
                                <MenuIcon item={item} active={active} />

                                {!collapsed && (
                                  <>
                                    <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-[1.15]">{item.title}</span>
                                    <button
                                      type="button"
                                      onClick={(event) => toggleFavorite(event, item)}
                                      className={cn(
                                        "flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition dark:text-slate-500",
                                        "opacity-0 hover:text-amber-500 group-hover:opacity-100 dark:hover:text-amber-300",
                                        favorite && "opacity-100 text-amber-500 dark:text-amber-300",
                                      )}
                                      title={favorite ? "Favorilerden çıkar" : "Favorilere ekle"}
                                    >
                                      <Star
                                        className={cn(
                                          "h-3.5 w-3.5 stroke-[1.9]",
                                          favorite && "fill-amber-400 dark:fill-amber-300",
                                        )}
                                      />
                                    </button>
                                    {item.badge && <PillBadge value={item.badge} />}
                                    <ChevronDown
                                      className={cn(
                                        "h-3.5 w-3.5 shrink-0 stroke-[1.9] text-slate-400 transition-transform duration-150 dark:text-slate-500",
                                        submenuOpen && "rotate-180 text-slate-600 dark:text-slate-300",
                                      )}
                                    />
                                  </>
                                )}
                              </button>

                              {!collapsed && submenuOpen && (
                                <div className="ml-5 mt-0.5 space-y-0.5 border-l border-slate-200/80 pl-3 dark:border-white/8">
                                  {item.children?.map((child) => {
                                    const childActive = isItemActive(child);
                                    const childFavorite = isFavorite(child.url);

                                    return (
                                      <SidebarMenuButton key={child.url} asChild tooltip={child.title}>
                                        <NavLink
                                          to={child.url}
                                          onClick={closeMobileSidebar}
                                          className={cn(
                                            submenuItemBase,
                                            "text-slate-600 hover:bg-slate-100/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white",
                                            childActive && "bg-cyan-500/10 text-[#067f7f] ring-1 ring-cyan-500/15 dark:bg-white/6 dark:text-cyan-100",
                                          )}
                                          activeClassName=""
                                        >
                                          <span className={cn(subtleLine, childActive && subtleLineActive)} />
                                          <SubMenuIcon item={child} active={childActive} />
                                          <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-[1.15]">{child.title}</span>
                                          <button
                                            type="button"
                                            onClick={(event) => toggleFavorite(event, child)}
                                            className={cn(
                                              "flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition dark:text-slate-500",
                                              "opacity-0 hover:text-amber-500 group-hover:opacity-100 dark:hover:text-amber-300",
                                              childFavorite && "opacity-100 text-amber-500 dark:text-amber-300",
                                            )}
                                            title={childFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
                                          >
                                            <Star
                                              className={cn(
                                                "h-3.5 w-3.5 stroke-[1.9]",
                                                childFavorite && "fill-amber-400 dark:fill-amber-300",
                                              )}
                                            />
                                          </button>
                                          {child.badge && <PillBadge value={child.badge} />}
                                        </NavLink>
                                      </SidebarMenuButton>
                                    );
                                  })}
                                </div>
                              )}
                            </SidebarMenuItem>
                          );
                        }

                        return (
                          <SidebarMenuItem key={item.url}>
                            <SidebarMenuButton asChild tooltip={item.title}>
                              <NavLink
                                to={item.url}
                                end={item.url === "/"}
                                onClick={closeMobileSidebar}
                                className={cn(
                                  menuItemBase,
                                  menuItemIdle,
                                  active && menuItemActive,
                                  collapsed && "justify-center px-0",
                                )}
                                activeClassName=""
                              >
                                <span className={cn(subtleLine, active && subtleLineActive)} />
                                <MenuIcon item={item} active={active} />

                                {!collapsed && (
                                  <>
                                    <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-[1.15]">{item.title}</span>
                                    <button
                                      type="button"
                                      onClick={(event) => toggleFavorite(event, item)}
                                      className={cn(
                                        "flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition dark:text-slate-500",
                                        "opacity-0 hover:text-amber-500 group-hover:opacity-100 dark:hover:text-amber-300",
                                        favorite && "opacity-100 text-amber-500 dark:text-amber-300",
                                      )}
                                      title={favorite ? "Favorilerden çıkar" : "Favorilere ekle"}
                                    >
                                      <Star
                                        className={cn(
                                          "h-3.5 w-3.5 stroke-[1.9]",
                                          favorite && "fill-amber-400 dark:fill-amber-300",
                                        )}
                                      />
                                    </button>
                                    {item.badge && <PillBadge value={item.badge} />}
                                    <ChevronRight className="h-3.5 w-3.5 shrink-0 stroke-[1.9] text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300" />
                                  </>
                                )}
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                )}
              </SidebarGroup>
            );
          })}
        </SidebarContent>

        <SidebarFooter className="border-t border-slate-200/80 px-3 py-2.5 dark:border-white/8">
          <div className="flex items-center justify-between gap-1.5">
            <ThemeToggle />

            <button className={actionButton} title="Yardım" type="button">
              <CircleHelp className="h-4 w-4 stroke-[1.9]" />
            </button>

            <button
              onClick={() => {
                closeMobileSidebar();
                navigate("/settings");
              }}
              className={actionButton}
              title="Ayarlar"
              type="button"
            >
              <Settings className="h-4 w-4 stroke-[1.9]" />
            </button>

            <button
              onClick={() => {
                closeMobileSidebar();
                void handleSignOut();
              }}
              className={cn(actionButton, "hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300")}
              title="Çıkış yap"
              type="button"
            >
              <LogOut className="h-4 w-4 stroke-[1.9]" />
            </button>
          </div>
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}
