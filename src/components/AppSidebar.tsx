import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  ClipboardCheck,
  ClipboardList,
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
  Flame,
  Calendar,
  Users,
  Mail,
  Bot,
  ChevronDown,
  History,
  Award,
  Briefcase,
  CalendarClock,
  MapPinned,
  HeartPulse,
  Search,
  CircleHelp,
  PanelLeftClose,
  PanelLeftOpen,
  Star,
  Sparkles,
  Headphones,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
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
  iconClassName?: string;
  badge?: string | number | null;
  children?: MenuItem[];
}

interface MenuGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
}

const SIDEBAR_SECTIONS_STORAGE_KEY = "isgvizyon-sidebar-sections";
const SIDEBAR_FAVORITES_STORAGE_KEY = "isgvizyon-sidebar-favorites";

const sidebarShell = cn(
  "border-r border-[rgba(148,163,184,0.12)] bg-[#111C31] text-[#E5EDF9]",
  "shadow-none",
);

const sidebarGlow = "bg-[#111C31]";

const sectionLabel =
  "mb-1 mt-2 flex h-6 w-full items-center justify-between rounded-md px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7890B8] transition-colors hover:bg-white/[0.03] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400/45";

const menuItemBase =
  "group relative flex min-h-8 w-full items-center gap-2 rounded-lg px-3 py-1 text-[14px] font-medium leading-tight outline-none transition-all duration-150 focus-visible:ring-1 focus-visible:ring-indigo-400/45";

const menuItemIdle =
  "text-[#E5EDF9] hover:bg-white/[0.04] hover:text-white active:bg-white/[0.06]";

const menuItemActive = cn(
  "bg-indigo-500/[0.12] text-white font-semibold",
  "shadow-[inset_2px_0_0_#8B5CF6]",
);

const submenuItemBase =
  "group relative flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 py-1 text-[13px] font-medium leading-tight outline-none transition-all duration-150 focus-visible:ring-1 focus-visible:ring-indigo-400/45";

const subtleLine =
  "absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-violet-400 opacity-0 transition-opacity duration-150";

const subtleLineActive = "opacity-100";

const actionButton = cn(
  "flex h-9 w-9 items-center justify-center rounded-lg text-slate-300/80 transition-all duration-150",
  "hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400/45",
);

const collapsedUtilityButton = cn(
  "flex h-8 w-8 items-center justify-center rounded-lg border border-slate-500/20 bg-[#16233A] text-slate-300 transition",
  "hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400/45",
);

const badgeClassNames = (badge: MenuItem["badge"]) => {
  if (badge === "AI") {
    return "border border-violet-400/20 bg-violet-500/18 text-violet-200";
  }

  if (badge === "NEW") {
    return "border border-emerald-400/20 bg-emerald-500/12 text-emerald-200";
  }

  if (badge === "Beta") {
    return "border border-sky-400/20 bg-sky-500/12 text-sky-200";
  }

  if (badge === "Pro") {
    return "border border-amber-400/25 bg-amber-500/12 text-amber-200";
  }

  if (typeof badge === "number") {
    return "border border-indigo-400/20 bg-indigo-500/12 text-indigo-100";
  }

  return "border border-slate-400/15 bg-white/[0.05] text-slate-200";
};

function PillBadge({ value }: { value: string | number }) {
  return (
    <span
      className={cn(
        "ml-auto inline-flex h-[18px] items-center gap-0.5 rounded-md px-1.5 text-[9px] font-semibold uppercase tracking-[0.06em]",
        badgeClassNames(value),
      )}
    >
      {value === "AI" ? <Sparkles className="h-3 w-3" /> : null}
      {value}
    </span>
  );
}

const getItemAccent = (item: MenuItem) => {
  if (item.iconClassName) return item.iconClassName;

  const map: Array<[RegExp, string]> = [
    [
      /(bot|otomasyon|yapay zeka|ai|analizi|sorgulama)/i,
      "text-cyan-400 group-hover:text-cyan-300",
    ],
    [
      /(risk|kkd|iş kazası|güvenlik)/i,
      "text-violet-400 group-hover:text-violet-300",
    ],
    [
      /(döf|kurul|doküman|belge|sertifika|form|talimat|muayene)/i,
      "text-amber-400 group-hover:text-amber-300",
    ],
    [
      /(acil|tahliye|kroki|plan)/i,
      "text-orange-400 group-hover:text-orange-300",
    ],
    [
      /(osgb|firma|çalışan|ziyaret|programı|atama|arşiv|iş ilan)/i,
      "text-teal-400 group-hover:text-teal-300",
    ],
    [
      /(profil|panel|dashboard)/i,
      "text-blue-400 group-hover:text-blue-300",
    ],
    [
      /(nace|rapor|raporları)/i,
      "text-fuchsia-400 group-hover:text-fuchsia-300",
    ],
  ];

  const match = map.find(([regex]) => regex.test(item.title) || regex.test(item.url));

  return (
    match?.[1] ??
    "text-slate-300 group-hover:text-white"
  );
};

function MenuIcon({ item, active }: { item: MenuItem; active: boolean }) {
  const Icon = item.icon;

  return (
    <Icon
      className={cn(
        "h-[18px] w-[18px] shrink-0 stroke-[1.9] transition-colors duration-150",
        active ? "text-violet-200" : getItemAccent(item),
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
        active ? "text-violet-200" : getItemAccent(item),
      )}
    />
  );
}

const readStoredStringArray = (key: string) => {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

export function AppSidebar() {
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";

  const { signOut, user } = useAuth();
  const { hasAccess } = usePlanLimits();
  const canAccessOsgbModule = hasAccess("osgb_module").allowed;
  const canAccessIsgBot = hasAccess("isg_bot").allowed;

  const navigate = useNavigate();
  const location = useLocation();

  const [expandedSubmenus, setExpandedSubmenus] = useState<string[]>([
    "Kroki Editörü",
  ]);

  const [draftMeetingsCount, setDraftMeetingsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const [favoriteUrls, setFavoriteUrls] = useState<string[]>(() =>
    readStoredStringArray(SIDEBAR_FAVORITES_STORAGE_KEY),
  );

  const [collapsedGroups, setCollapsedGroups] = useState<string[]>(() =>
    readStoredStringArray(SIDEBAR_SECTIONS_STORAGE_KEY),
  );

  useEffect(() => {
    if (user) void fetchDraftMeetingsCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_FAVORITES_STORAGE_KEY, JSON.stringify(favoriteUrls));
  }, [favoriteUrls]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_SECTIONS_STORAGE_KEY, JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

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
    () => {
      return [
        {
          label: "Yönetim",
          icon: LayoutDashboard,
          items: [
            { title: "Komuta Merkezi", url: "/dashboard", icon: LayoutDashboard, iconClassName: "text-rose-400 group-hover:text-rose-300", badge: null },
            { title: "Profilim", url: "/profile", icon: User, iconClassName: "text-blue-400 group-hover:text-blue-300", badge: null },
            {
              title: "İSGPratik Bot",
              url: canAccessIsgBot ? "/isg-bot" : "/settings?tab=billing&upgrade=1",
              icon: Bot,
              iconClassName: "text-cyan-400 group-hover:text-cyan-300",
              badge: canAccessIsgBot ? "AI" : "Kilitli",
            },
            canAccessOsgbModule
              ? {
                  title: "OSGB Yönetimi",
                  url: "/osgb",
                  icon: Briefcase,
                  iconClassName: "text-indigo-400 group-hover:text-indigo-300",
                  badge: "NEW",
                }
              : null,
          ].filter((item): item is NonNullable<typeof item> => item !== null),
        },
        {
          label: "Risk Yönetimi",
          icon: ShieldAlert,
          items: [
            { title: "Risk Değerlendirme", url: "/risk-wizard", icon: TrendingUp, iconClassName: "text-violet-400 group-hover:text-violet-300", badge: "AI" },
            { title: "Acil Durum Planı", url: "/adep-wizard", icon: Flame, iconClassName: "text-amber-400 group-hover:text-amber-300", badge: null },
            { title: "ADEP Planlarım", url: "/adep-plans", icon: FileText, iconClassName: "text-orange-400 group-hover:text-orange-300", badge: null },
            {
              title: "Kroki Editörü",
              url: "/evacuation-editor",
              icon: MapPinned,
              iconClassName: "text-cyan-400 group-hover:text-cyan-300",
              badge: "NEW",
              children: [
                {
                  title: "Tahliye Kroki",
                  url: "/evacuation-editor",
                  icon: MapPinned,
                  iconClassName: "text-cyan-400 group-hover:text-cyan-300",
                  badge: "NEW",
                },
                {
                  title: "Kroki Geçmişleri",
                  url: "/evacuation-editor/history",
                  icon: History,
                  iconClassName: "text-blue-400 group-hover:text-blue-300",
                  badge: null,
                },
                {
                  title: "AI Kroki Analizi",
                  url: "/blueprint-analyzer",
                  icon: Search,
                  iconClassName: "text-cyan-400 group-hover:text-cyan-300",
                  badge: "AI",
                },
                {
                  title: "Kroki Kullanım Rehberi",
                  url: "/blueprint-analyzer/how-to",
                  icon: CircleHelp,
                  iconClassName: "text-slate-300 group-hover:text-white",
                  badge: null,
                },
              ],
            },
            { title: "İş Kazası / Ramak Kala", url: "/incidents", icon: ShieldAlert, iconClassName: "text-rose-400 group-hover:text-rose-300", badge: "NEW" },
          ],
        },
        {
          label: "Formlar & Belgeler",
          icon: Award,
          items: [
            { title: "DÖF Oluştur", url: "/bulk-capa", icon: ShieldPlus, iconClassName: "text-violet-400 group-hover:text-violet-300", badge: null },
            { title: "AI Saha Analizi", url: "/blueprint-analyzer", icon: Search, iconClassName: "text-cyan-400 group-hover:text-cyan-300", badge: "AI" },
            {
              title: "Kurul Toplantısı",
              url: "/board-meetings",
              icon: Users,
              iconClassName: "text-blue-400 group-hover:text-blue-300",
              badge: draftMeetingsCount > 0 ? draftMeetingsCount : "AI",
            },
            { title: "Atama Yazıları", url: "/assignment-letters", icon: FileText, iconClassName: "text-amber-400 group-hover:text-amber-300", badge: null },
            { title: "Eğitim Katılımı", url: "/assignment-letters?form=egitim-katilimi", icon: Award, iconClassName: "text-orange-400 group-hover:text-orange-300", badge: null },
            { title: "İşbaşı Eğitim Tutanağı", url: "/assignment-letters?form=isbasi-egitim", icon: Users, iconClassName: "text-emerald-400 group-hover:text-emerald-300", badge: null },
            { title: "Tatbikat Tutanağı", url: "/assignment-letters?form=tatbikat", icon: Flame, iconClassName: "text-orange-400 group-hover:text-orange-300", badge: null },
            { title: "Tespit ve Öneri Defteri", url: "/assignment-letters?form=tespit-oneri", icon: ClipboardCheck, iconClassName: "text-amber-400 group-hover:text-amber-300", badge: null },
            {
              title: "Sertifika Oluştur",
              url: "/dashboard/certificates",
              icon: Award,
              iconClassName: "text-teal-400 group-hover:text-teal-300",
              badge: "NEW",
            },
            { title: "Eğitim Soruları", url: "/safety-library", icon: CircleHelp, iconClassName: "text-violet-400 group-hover:text-violet-300", badge: "AI" },
            { title: "KKD Formu", url: "/ppe-management?form=kkd", icon: Shield, iconClassName: "text-cyan-400 group-hover:text-cyan-300", badge: "NEW" },
            { title: "İş İzin Formu", url: "/work-instructions?form=is-izin", icon: ClipboardList, iconClassName: "text-lime-400 group-hover:text-lime-300", badge: null },
            { title: "Ceza ve Tebliğ Tutanağı", url: "/assignment-letters?form=ceza-teblig", icon: ShieldAlert, iconClassName: "text-rose-400 group-hover:text-rose-300", badge: null },
            { title: "İş Kazası Raporu", url: "/incidents", icon: ShieldAlert, iconClassName: "text-red-400 group-hover:text-red-300", badge: null },
            { title: "Talimat Oluştur", url: "/work-instructions?form=talimat", icon: ClipboardList, iconClassName: "text-blue-400 group-hover:text-blue-300", badge: "AI" },
            { title: "Muayene Formu (EK2)", url: "/health-surveillance?form=ek2", icon: HeartPulse, iconClassName: "text-pink-400 group-hover:text-pink-300", badge: null },
            { title: "İSG Kütüphanesi", url: "/safety-library", icon: BookOpen, iconClassName: "text-sky-400 group-hover:text-sky-300", badge: null },
            {
              title: "Sertifika Geçmişi",
              url: "/dashboard/certificates/history",
              icon: History,
              iconClassName: "text-blue-400 group-hover:text-blue-300",
              badge: null,
            },
          ],
        },
        {
          label: "Operasyon Takibi",
          icon: Briefcase,
          items: [
            { title: "DÖF Yönetimi", url: "/inspections", icon: ClipboardCheck, iconClassName: "text-violet-400 group-hover:text-violet-300", badge: null },
            { title: "Denetimler", url: "/capa", icon: ShieldAlert, iconClassName: "text-rose-400 group-hover:text-rose-300", badge: null },
            {
              title: "Periyodik Kontrol",
              url: "/periodic-controls",
              icon: CalendarClock,
              iconClassName: "text-amber-400 group-hover:text-amber-300",
              badge: "NEW",
            },
            { title: "Sağlık Gözetimi", url: "/health-surveillance", icon: HeartPulse, iconClassName: "text-pink-400 group-hover:text-pink-300", badge: "NEW" },
            { title: "KKD Zimmet", url: "/ppe-management", icon: Shield, iconClassName: "text-emerald-400 group-hover:text-emerald-300", badge: "NEW" },
          ],
        },
        {
          label: "Planlama & Sorgulama",
          icon: Calendar,
          items: [
            { title: "Yıllık Planlar", url: "/annual-plans", icon: Calendar, iconClassName: "text-teal-400 group-hover:text-teal-300", badge: null },
            { title: "Yapay Zeka Raporları", url: "/reports", icon: Brain, iconClassName: "text-fuchsia-400 group-hover:text-fuchsia-300", badge: "Beta" },
            { title: "NACE Kod Sorgulama", url: "/nace-query", icon: Shield, iconClassName: "text-cyan-400 group-hover:text-cyan-300", badge: "AI" },
            {
              title: "NACE Sektör Listesi",
              url: "/nace-query/sectors",
              icon: BookOpen,
              iconClassName: "text-sky-400 group-hover:text-sky-300",
              badge: null,
            },
          ],
        },
        {
          label: "Genel",
          icon: LayoutDashboard,
          items: [
            { title: "E-posta Arşivi", url: "/email-history", icon: Mail, iconClassName: "text-blue-400 group-hover:text-blue-300", badge: null },
            { title: "Ayarlar", url: "/settings", icon: Settings, iconClassName: "text-slate-300 group-hover:text-white", badge: null },
          ],
        },
      ];
    },
    [
      canAccessIsgBot,
      canAccessOsgbModule,
      draftMeetingsCount,
    ],
  );

  const isItemActive = (item: MenuItem): boolean => {
    const currentPath = `${location.pathname}${location.search}`;
    const itemPath = item.url.split("?")[0];
    const isSelfActive =
      item.url === "/"
        ? location.pathname === "/"
        : item.url.includes("?")
          ? currentPath === item.url
          : location.pathname === itemPath || location.pathname.startsWith(`${itemPath}/`);

    const isChildActive = item.children?.some((child) => isItemActive(child)) ?? false;

    return isSelfActive || isChildActive;
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

  const filteredMenuGroups = useMemo(() => {
    if (!normalizedSearch) return menuGroups;

    return menuGroups
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
  }, [menuGroups, normalizedSearch]);

  const displayGroups = filteredMenuGroups;

  const isFavorite = (url: string) => favoriteUrls.includes(url);

  const toggleFavoriteItem = (item: MenuItem) => {
    setFavoriteUrls((prev) =>
      prev.includes(item.url)
        ? prev.filter((url) => url !== item.url)
        : [item.url, ...prev].slice(0, 8),
    );
  };

  const toggleFavorite = (event: React.MouseEvent, item: MenuItem) => {
    event.preventDefault();
    event.stopPropagation();

    toggleFavoriteItem(item);
  };

  const handleFavoriteKeyDown = (event: React.KeyboardEvent, item: MenuItem) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    event.stopPropagation();

    toggleFavoriteItem(item);
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
          "--sidebar-width": "15rem",
          "--sidebar-width-icon": "4.25rem",
        } as React.CSSProperties
      }
      className={cn("top-0 z-[60] h-screen bg-[#111C31] p-0")}
    >
      <div
        className={cn(
          sidebarShell,
          sidebarGlow,
          "flex h-full min-h-0 flex-col overflow-hidden rounded-none border-y-0 border-l-0",
          isMobile && "border-0 shadow-none",
        )}
      >
        {collapsed && (
          <div className="border-b border-white/[0.08] px-2 py-2">
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={toggleSidebar}
                className={collapsedUtilityButton}
                title="Menüyü genişlet"
                aria-label="Menüyü genişlet"
                type="button"
              >
                <PanelLeftOpen className="h-4 w-4 stroke-[1.9]" />
              </button>
            </div>
          </div>
        )}

        <SidebarHeader
          className={cn(
            "border-b border-white/[0.08] px-2 py-2",
            collapsed && "hidden",
          )}
        >
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.9] text-[#7890B8]" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Menüde ara..."
                className={cn(
                  "h-8 rounded-xl border border-slate-500/25 bg-[#16233A] pl-8 pr-2 text-[12.5px] text-slate-100 shadow-none",
                  "placeholder:text-[#7890B8]/75 hover:bg-[#1A2942] focus-visible:border-indigo-400/45 focus-visible:ring-1 focus-visible:ring-indigo-400/30",
                )}
              />
            </div>

            <button
              onClick={toggleSidebar}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-500/20 bg-[#16233A] text-slate-300 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400/45"
              title={collapsed ? "Menüyü aç" : "Menüyü daralt"}
              aria-label={collapsed ? "Menüyü aç" : "Menüyü daralt"}
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

        <SidebarContent className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-2 overscroll-contain [scrollbar-color:rgba(120,144,184,0.28)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/25 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/35">
          {!collapsed && !normalizedSearch && (
            <SidebarGroup className="px-1 pb-1 pt-0">
              <div className="mb-1 mt-2 flex h-6 items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7890B8]">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>Sık Kullanılanlar</span>
              </div>
              <SidebarGroupContent>
                {favoriteItems.length ? (
                  <SidebarMenu className="gap-0.5">
                    {favoriteItems.map((item) => {
                      const active = isItemActive(item);
                      const favorite = isFavorite(item.url);

                      return (
                        <SidebarMenuItem key={`favorite-${item.url}`}>
                          <SidebarMenuButton asChild tooltip={item.title}>
                            <NavLink
                              to={item.url}
                              end={item.url === "/"}
                              onClick={closeMobileSidebar}
                              aria-current={active ? "page" : undefined}
                              className={cn(menuItemBase, menuItemIdle, active && menuItemActive)}
                              activeClassName=""
                            >
                              <span className={cn(subtleLine, active && subtleLineActive)} />
                              <MenuIcon item={item} active={active} />
                              <span className="min-w-0 flex-1 truncate text-left">{item.title}</span>
                              {item.badge && <PillBadge value={item.badge} />}
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(event) => toggleFavorite(event, item)}
                                onKeyDown={(event) => handleFavoriteKeyDown(event, item)}
                                className={cn(
                                  "flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 transition hover:text-amber-300",
                                  favorite && "text-amber-300",
                                )}
                                title={favorite ? "Favorilerden çıkar" : "Favorilere ekle"}
                                aria-label={favorite ? "Favorilerden çıkar" : "Favorilere ekle"}
                              >
                                <Star className={cn("h-3.5 w-3.5 stroke-[1.9]", favorite && "fill-amber-300")} />
                              </span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                ) : (
                  <div className="px-2 py-1 text-[11px] text-[#7890B8]/70">Henüz favori yok.</div>
                )}
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {!collapsed && normalizedSearch && displayGroups.length === 0 && (
            <div className="m-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-center text-xs text-[#7890B8]">
              Menü bulunamadı.
            </div>
          )}

          {displayGroups.map((group) => {
            const groupCollapsed = collapsedGroups.includes(group.label) && !normalizedSearch;

            return (
              <SidebarGroup key={`${group.label}-${group.items.length}`} className="px-1 py-0">
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    className={sectionLabel}
                    title={groupCollapsed ? `${group.label} grubunu aç` : `${group.label} grubunu kapat`}
                    aria-label={groupCollapsed ? `${group.label} grubunu aç` : `${group.label} grubunu kapat`}
                    aria-expanded={!groupCollapsed}
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
                    <div className="h-5 w-px rounded-full bg-white/[0.10]" />
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
                            <SidebarMenuItem key={`${group.label}-${item.title}-${item.url}`}>
                              <button
                                type="button"
                                onClick={() => toggleSubmenu(item.title)}
                                className={cn(
                                  menuItemBase,
                                  menuItemIdle,
                                  active && menuItemActive,
                                  collapsed && "justify-center px-0",
                                )}
                                aria-current={active ? "page" : undefined}
                                aria-expanded={submenuOpen}
                                aria-label={item.title}
                              >
                                <span className={cn(subtleLine, active && subtleLineActive)} />
                                <MenuIcon item={item} active={active} />

                                {!collapsed && (
                                  <>
                                    <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-[1.15]">
                                      {item.title}
                                    </span>

                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onClick={(event) => toggleFavorite(event, item)}
                                      onKeyDown={(event) => handleFavoriteKeyDown(event, item)}
                                      className={cn(
                                        "flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 transition",
                                        "opacity-0 hover:text-amber-300 group-hover:opacity-100",
                                        favorite && "opacity-100 text-amber-300",
                                      )}
                                      title={favorite ? "Favorilerden çıkar" : "Favorilere ekle"}
                                      aria-label={favorite ? "Favorilerden çıkar" : "Favorilere ekle"}
                                    >
                                      <Star
                                        className={cn(
                                          "h-3.5 w-3.5 stroke-[1.9]",
                                          favorite && "fill-amber-300",
                                        )}
                                      />
                                    </span>

                                    {item.badge && <PillBadge value={item.badge} />}

                                    <ChevronDown
                                      className={cn(
                                        "h-3.5 w-3.5 shrink-0 stroke-[1.9] text-slate-500 opacity-70 transition duration-150 group-hover:text-slate-300 group-hover:opacity-100",
                                        submenuOpen && "rotate-180 text-slate-300 opacity-100",
                                      )}
                                    />
                                  </>
                                )}
                              </button>

                              {!collapsed && submenuOpen && (
                                <div className="ml-5 mt-0.5 space-y-0.5 border-l border-white/[0.08] pl-2">
                                  {item.children?.map((child) => {
                                    const childActive = isItemActive(child);
                                    const childFavorite = isFavorite(child.url);

                                    return (
                                      <SidebarMenuButton key={child.url} asChild tooltip={child.title}>
                                        <NavLink
                                          to={child.url}
                                          onClick={closeMobileSidebar}
                                          aria-current={childActive ? "page" : undefined}
                                          className={cn(
                                            submenuItemBase,
                                            "text-slate-300 hover:bg-white/[0.04] hover:text-white",
                                            childActive &&
                                              "bg-indigo-500/[0.12] text-white font-semibold shadow-[inset_2px_0_0_#8B5CF6]",
                                          )}
                                          activeClassName=""
                                        >
                                          <span
                                            className={cn(subtleLine, childActive && subtleLineActive)}
                                          />
                                          <SubMenuIcon item={child} active={childActive} />

                                          <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-[1.15]">
                                            {child.title}
                                          </span>

                                          <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(event) => toggleFavorite(event, child)}
                                            onKeyDown={(event) => handleFavoriteKeyDown(event, child)}
                                            className={cn(
                                              "flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 transition",
                                              "opacity-0 hover:text-amber-300 group-hover:opacity-100",
                                              childFavorite &&
                                                "opacity-100 text-amber-300",
                                            )}
                                            title={
                                              childFavorite ? "Favorilerden çıkar" : "Favorilere ekle"
                                            }
                                            aria-label={childFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
                                          >
                                            <Star
                                              className={cn(
                                                "h-3.5 w-3.5 stroke-[1.9]",
                                                childFavorite &&
                                                  "fill-amber-300",
                                              )}
                                            />
                                          </span>

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
                          <SidebarMenuItem key={`${group.label}-${item.title}-${item.url}`}>
                            <SidebarMenuButton asChild tooltip={item.title}>
                              <NavLink
                                to={item.url}
                                end={item.url === "/"}
                                onClick={closeMobileSidebar}
                                aria-current={active ? "page" : undefined}
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
                                    <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-[1.15]">
                                      {item.title}
                                    </span>

                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onClick={(event) => toggleFavorite(event, item)}
                                      onKeyDown={(event) => handleFavoriteKeyDown(event, item)}
                                      className={cn(
                                        "flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 transition",
                                        "opacity-0 hover:text-amber-300 group-hover:opacity-100",
                                        favorite && "opacity-100 text-amber-300",
                                      )}
                                      title={favorite ? "Favorilerden çıkar" : "Favorilere ekle"}
                                      aria-label={favorite ? "Favorilerden çıkar" : "Favorilere ekle"}
                                    >
                                      <Star
                                        className={cn(
                                          "h-3.5 w-3.5 stroke-[1.9]",
                                          favorite && "fill-amber-300",
                                        )}
                                      />
                                    </span>

                                    {item.badge && <PillBadge value={item.badge} />}

                                    <ChevronRight className="h-3.5 w-3.5 shrink-0 stroke-[1.9] text-slate-500 opacity-70 transition duration-150 group-hover:translate-x-0.5 group-hover:text-slate-300 group-hover:opacity-100" />
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

        <SidebarFooter className="border-t border-white/[0.08] bg-[#0D1729] px-2 py-2">
          <div
            className={cn(
              "flex items-center gap-1.5 [&_button]:h-9 [&_button]:w-9 [&_button]:rounded-lg [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-slate-300/80 [&_button]:shadow-none [&_button]:backdrop-blur-0 [&_button:hover]:bg-white/[0.06] [&_button:hover]:text-white",
              collapsed ? "flex-col justify-center" : "justify-between",
            )}
          >
            <ThemeToggle />

            <button className={actionButton} title="Yardım" aria-label="Yardım" type="button">
              <CircleHelp className="h-4 w-4 stroke-[1.9]" />
            </button>

            <button
              onClick={() => {
                closeMobileSidebar();
                navigate("/settings");
              }}
              className={actionButton}
              title="Ayarlar"
              aria-label="Ayarlar"
              type="button"
            >
              <Settings className="h-4 w-4 stroke-[1.9]" />
            </button>

            <button className={actionButton} title="Destek" aria-label="Destek" type="button">
              <Headphones className="h-4 w-4 stroke-[1.9]" />
            </button>

            <button
              onClick={() => {
                closeMobileSidebar();
                void handleSignOut();
              }}
              className={cn(actionButton, "hover:bg-red-500/10 hover:text-red-300")}
              title="Çıkış yap"
              aria-label="Çıkış yap"
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
