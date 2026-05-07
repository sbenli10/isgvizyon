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
  Sparkles,
  Activity,
  Command,
  PanelLeftClose,
  PanelLeftOpen,
  Link2,
  Globe2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { useOsgbAccess } from "@/hooks/useOsgbAccess";
import { useSubscription } from "@/hooks/useSubscription";
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

// ====================================================
// TYPES
// ====================================================

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

// ====================================================
// PREMIUM CARD SIDEBAR STYLES (theme-safe)
// ====================================================

const badgeClassNames = (badge: MenuItem["badge"]) => {
  if (badge === "AI")
    return "border-fuchsia-500/35 bg-fuchsia-500/16 text-fuchsia-900 dark:text-fuchsia-100";
  if (badge === "Pro")
    return "border-amber-500/30 bg-amber-500/12 text-amber-900 dark:text-amber-200";
  if (badge === "Beta")
    return "border-sky-500/30 bg-sky-500/12 text-sky-900 dark:text-sky-200";
  if (badge === "NEW")
    return "border-emerald-500/30 bg-emerald-500/12 text-emerald-900 dark:text-emerald-200";
  if (typeof badge === "number")
    return "border-yellow-500/30 bg-yellow-500/12 text-yellow-950 dark:text-yellow-200";
  return "border-border/60 bg-muted/35 text-muted-foreground";
};

const cardShell = cn(
  "rounded-[28px] border border-sidebar-border/80 bg-sidebar/95 text-sidebar-foreground backdrop-blur-xl",
  "ring-1 ring-black/5 dark:ring-white/5",
  "shadow-[0_18px_54px_-40px_rgba(15,23,42,0.18)] dark:shadow-[0_20px_64px_-42px_rgba(0,0,0,0.52)]",
);

const cardInnerGlow = cn(
  // light
  "bg-[radial-gradient(700px_circle_at_10%_0%,_hsl(var(--primary)/0.05),_transparent_34%),radial-gradient(520px_circle_at_82%_8%,_hsl(var(--primary)/0.04),_transparent_30%)]",
  // dark
  "dark:bg-[radial-gradient(700px_circle_at_10%_0%,_hsl(var(--primary)/0.10),_transparent_34%),radial-gradient(520px_circle_at_82%_8%,_hsl(var(--primary)/0.06),_transparent_30%)]",
);

const sectionLabel =
  "mb-1 flex items-center justify-between px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/90";

// ✅ items-start: 2 satıra kırılınca ikon yukarı hizalı kalsın
const menuItemBase =
  "group relative flex h-auto min-h-[3.5rem] w-full items-center gap-3 overflow-visible rounded-[18px] px-3 py-2.5 text-[13px] font-medium transition-all duration-200";

const menuItemIdle = cn(
  "text-foreground hover:bg-muted/55 hover:text-foreground",
  "hover:shadow-[0_8px_20px_-18px_rgba(15,23,42,0.20)]",
  "dark:text-white dark:hover:bg-muted/34 dark:hover:shadow-[0_10px_24px_-20px_rgba(0,0,0,0.34)]",
);

const menuItemActive = cn(
  "border border-primary/18 bg-[linear-gradient(90deg,hsl(var(--primary)/0.94),hsl(var(--primary)/0.76))]",
  "text-primary-foreground shadow-[0_10px_24px_-18px_hsl(var(--primary)/0.42)]",
  "dark:border-primary/18 dark:bg-[linear-gradient(90deg,hsl(var(--primary)/0.94),hsl(var(--primary)/0.76))]",
);

// İKON KUTUSU: daha büyük + daha görünür (renk ikona verilecek)
const iconWrapBase = 
  "relative flex h-9 w-9 min-w-9 basis-9 shrink-0 items-center justify-center overflow-visible rounded-[12px] border transition-all duration-200";

const iconWrapIdle = cn(
  "border-sidebar-border/75 bg-background/72",
  "shadow-none group-hover:border-primary/40 group-hover:bg-background/92",
  "dark:border-white/12 dark:bg-white/8"
);

const iconWrapActive = cn(
  "border-white/15 bg-white/10",
  "shadow-none",
  "dark:bg-white/10",
);

const leftAccent =
  "absolute right-2 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-white/80 opacity-0 transition-opacity";
const leftAccentActive = "opacity-100";

const surfacePanel = cn(
  "rounded-[18px] border border-sidebar-border/70 bg-background/60 backdrop-blur-xl",
  "shadow-[0_6px_16px_-14px_rgba(15,23,42,0.10)] dark:shadow-[0_8px_18px_-16px_rgba(0,0,0,0.24)]",
);

const collapsedUtilityButton = cn(
  "flex h-11 w-11 items-center justify-center rounded-[18px] border border-sidebar-border/80 bg-background/70",
  "text-foreground/80 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.28)] backdrop-blur-xl transition",
  "hover:border-primary/30 hover:bg-background hover:text-foreground",
  "dark:text-foreground/85 dark:shadow-[0_12px_24px_-18px_rgba(0,0,0,0.58)]",
);

function PillBadge({ value, active }: { value: string | number; active: boolean }) {
  return (
    <span
      className={cn(
        "ml-auto mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none",
        active ? "border-primary/30 bg-primary/12 text-primary" : badgeClassNames(value),
      )}
    >
      {value}
    </span>
  );
}

// İkonları görünür yapmak için TEK kaynak: ikonun kendi class’ı
function MenuIcon({ Icon, active }: { Icon: React.ComponentType<{ className?: string }>; active: boolean }) {
  return (
    <Icon
      className={cn(
        "relative z-20 h-6 w-6 stroke-[2.5] transition-all duration-200",
        active
          ? "scale-110 text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.8)] dark:text-white"
          : "text-foreground dark:text-white"
      )}
    />
  );
}

function SubMenuIcon({
  Icon,
  active,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Icon
      className={cn(
        "mt-0.5 h-[18px] w-[18px] stroke-[2.25]",
        active ? "text-primary" : "text-foreground/80 dark:text-white/90",
      )}
    />
  );
}

// ====================================================
// COMPONENT
// ====================================================

export function AppSidebar() {
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";

  const { signOut, user } = useAuth();
  const { plan, status, isPaidPlan, daysLeftInTrial } = useSubscription();
  const {
    canViewAnalytics,
    canViewAutomation,
    canViewCompanyHub,
    canViewDashboard,
    canViewDocuments,
    canViewFinance,
    canViewKatip,
    canViewPeople,
    canViewPortal,
  } = useOsgbAccess();
  const navigate = useNavigate();
  const location = useLocation();

  const [expandedSubmenus, setExpandedSubmenus] = useState<string[]>(["OSGB Modülü"]);
  const [draftMeetingsCount, setDraftMeetingsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user) void fetchDraftMeetingsCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
        icon: Sparkles,
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
              {
                title: "OSGB Modülü",
                url: "/osgb",
                icon: Briefcase,
                badge: "NEW",
                children: [
                  { title: "OSGB Başlangıç", url: "/osgb/dashboard", icon: LayoutDashboard, badge: null },
                  { title: "Nasıl Kullanılır", url: "/osgb/how-to", icon: CircleHelp, badge: null },
                  canViewCompanyHub ? { title: "Firma Havuzu", url: "/osgb/company-tracking", icon: Building2, badge: null } : null,
                  canViewPeople ? { title: "Personel ve Atamalar", url: "/osgb/assignments", icon: Briefcase, badge: null } : null,
                  canViewPeople ? { title: "Dakika ve Kapasite", url: "/osgb/capacity", icon: TrendingUp, badge: null } : null,
                  canViewPeople ? { title: "Saha Operasyonu", url: "/osgb/field-visits", icon: MapPinned, badge: "NEW" } : null,
                  canViewDocuments ? { title: "Yasal Evraklar", url: "/osgb/documents", icon: FileSearch, badge: null } : null,
                  canViewFinance ? { title: "Finans ve Karlılık", url: "/osgb/finance", icon: FileText, badge: null } : null,
                  canViewAutomation ? { title: "Otomasyon Merkezi", url: "/osgb/automation", icon: Bot, badge: "NEW" } : null,
                  canViewKatip ? { title: "ISG-KATIP Merkezi", url: "/osgb/isgkatip", icon: Link2, badge: "NEW" } : null,
                  canViewPortal ? { title: "Müşteri Portalı", url: "/osgb/client-portal", icon: Globe2, badge: "NEW" } : null,
                  canViewAnalytics ? { title: "Trend Analizi", url: "/osgb/analytics", icon: TrendingUp, badge: null } : null,
                ].filter((item): item is NonNullable<typeof item> => item !== null),
              },
            ],
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
          { title: "İSGBot", url: "/isg-bot", icon: Bot, badge: "NEW" },
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
      draftMeetingsCount,
    ],
  );

  const isItemActive = (item: MenuItem) => {
    if (item.url === "/") return location.pathname === "/";
    return location.pathname === item.url || location.pathname.startsWith(`${item.url}/`);
  };

  const toggleSubmenu = (label: string) => {
    if (collapsed) return;
    setExpandedSubmenus((prev) => (prev.includes(label) ? prev.filter((it) => it !== label) : [...prev, label]));
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

  const totalVisibleItems = filteredMenuGroups.reduce((sum, group) => {
    return sum + group.items.reduce((count, item) => count + 1 + (item.children?.length ?? 0), 0);
  }, 0);
  const membershipLabel =
    status === "trial"
      ? `Demo · ${daysLeftInTrial}g`
      : plan === "osgb"
        ? "OSGB"
        : plan === "premium"
          ? "Premium"
          : null;

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
          "--sidebar-width-icon": "5.5rem",
        } as React.CSSProperties
      }
      className={cn("top-0 z-[60] h-screen bg-transparent p-0 md:p-4")}
    >
      <div
        className={cn(
          cardShell,
          cardInnerGlow,
          "flex h-full min-h-0 flex-col overflow-hidden",
          isMobile &&
            "rounded-none border-0 bg-sidebar text-sidebar-foreground ring-0 shadow-none backdrop-blur-none dark:bg-sidebar",
        )}
      >
        {collapsed && (
          <div className="flex items-center justify-center border-b border-sidebar-border/80 px-2 py-3">
            <button onClick={toggleSidebar} className={collapsedUtilityButton} title="Menüyü genişlet" type="button">
              <PanelLeftOpen className="h-5 w-5 stroke-[2.2]" />
            </button>
          </div>
        )}

        {/* HEADER */}
        <SidebarHeader className={cn("border-b border-sidebar-border/70 px-3 py-3", collapsed && "hidden")}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className={cn(surfacePanel, "flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] p-1")}>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 via-fuchsia-600 to-cyan-500 text-white">
                  <Shield className="h-3.5 w-3.5 stroke-[2.2]" />
                </div>
              </div>

              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    İSGVİZYON
                  </div>
                  <div className="text-sm font-semibold text-sidebar-foreground">Operasyon Merkezi</div>
                  <div className="text-[11px] text-muted-foreground">Hızlı erişim ve görev takibi</div>
                </div>
              )}
            </div>

            <button
              onClick={toggleSidebar}
              className={cn(
                surfacePanel,
                "flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground transition",
                "hover:bg-muted/55 hover:text-sidebar-foreground",
              )}
              title={collapsed ? "Menüyü aç" : "Menüyü daralt"}
              type="button"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-5 w-5 stroke-[2.2]" />
              ) : (
                <PanelLeftClose className="h-5 w-5 stroke-[2.2]" />
              )}
            </button>
          </div>

          {!collapsed && (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(isPaidPlan || status === "trial") && status !== "past_due" && membershipLabel && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    {membershipLabel}
                  </div>
                )}
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Hazır
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className={cn(surfacePanel, "p-3")}>
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <Activity className="h-3.5 w-3.5" />
                    Görünen
                  </div>
                  <div className="mt-1.5 text-2xl font-semibold text-sidebar-foreground">{totalVisibleItems}</div>
                  <div className="text-[11px] text-muted-foreground">aktif menü</div>
                </div>
                <div className={cn(surfacePanel, "p-3")}>
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <Command className="h-3.5 w-3.5" />
                    Durum
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-sidebar-foreground">Hazır</div>
                  <div className="text-[11px] text-muted-foreground">hızlı erişim</div>
                </div>
              </div>

              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Menüde ara..."
                  className={cn(
                    "h-10 rounded-[16px] border border-sidebar-border/70 bg-background/65 pl-9 text-sm text-sidebar-foreground shadow-none backdrop-blur-xl",
                    "placeholder:text-muted-foreground",
                    "hover:border-sidebar-border hover:bg-background/65",
                    "focus-visible:border-primary/35 focus-visible:ring-2 focus-visible:ring-cyan-400/15 dark:focus-visible:ring-primary/20",
                  )}
                />
              </div>
            </>
          )}
        </SidebarHeader>

        {/* CONTENT */}
        <SidebarContent className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-1 overscroll-contain [scrollbar-color:hsl(var(--sidebar-border))_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-sidebar-border/70 hover:[&::-webkit-scrollbar-thumb]:bg-sidebar-border">
          {filteredMenuGroups.map((group) => (
            <SidebarGroup key={group.label} className="px-1">
              {!collapsed ? (
                <div className={sectionLabel}>
                  <div className="flex items-center gap-2">
                    <group.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{group.label}</span>
                  </div>
                  <span className="rounded-full border border-sidebar-border/70 bg-background/65 px-2 py-0.5 text-[10px] font-semibold tracking-normal text-foreground/75 dark:text-white/75">
                    {group.items.length}
                  </span>
                </div>
              ) : (
                <div className="my-3 flex justify-center">
                  <div className="h-8 w-px rounded-full bg-gradient-to-b from-transparent via-sidebar-border to-transparent" />
                </div>
              )}

              <SidebarGroupContent>
                <SidebarMenu className="gap-1.5">
                  {group.items.map((item) => {
                    const hasChildren = Boolean(item.children?.length);
                    const active = isItemActive(item);
                    const submenuOpen = isSubmenuOpen(item);

                    if (hasChildren) {
                      return (
                        <SidebarMenuItem key={item.url}>
                          <button
                            type="button"
                            onClick={() => toggleSubmenu(item.title)}
                            className={cn(
                              menuItemBase,
                              "border border-transparent",
                              menuItemIdle,
                              active && menuItemActive,
                            )}
                          >
                            <span className={cn(leftAccent, active && leftAccentActive)} />
                            <span className={cn(iconWrapBase, iconWrapIdle, active && iconWrapActive)}>
                              <MenuIcon Icon={item.icon} active={active} />
                            </span>

                            {!collapsed && (
                              <>
                                <span className="min-w-0 flex-1 whitespace-normal leading-5">{item.title}</span>
                                {item.badge && <PillBadge value={item.badge} active={active} />}

                                <ChevronDown
                                  className={cn(
                                    "ml-1 mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out",
                                    submenuOpen && "rotate-180",
                                  )}
                                />
                              </>
                            )}
                          </button>

                          {!collapsed && submenuOpen && (
                            <div className="ml-6 mt-2 space-y-1 border-l border-sidebar-border/80 pl-4">
                              {item.children?.map((child) => {
                                const childActive = isItemActive(child);

                                return (
                                  <SidebarMenuButton key={child.url} asChild tooltip={child.title}>
                                    <NavLink
                                      to={child.url}
                                      onClick={closeMobileSidebar}
                                      className={cn(
                                        "flex h-auto min-h-[3rem] items-start gap-3 overflow-visible rounded-2xl px-3 py-2.5 text-[13px] font-medium transition-colors",
                                        "text-foreground/80 hover:bg-muted/45 hover:text-foreground",
                                        "dark:text-foreground/80 dark:hover:bg-muted/30",
                                        childActive && "bg-primary/10 text-foreground",
                                      )}
                                      activeClassName=""
                                    >
                                      <SubMenuIcon Icon={child.icon} active={childActive} />
                                      <span className="min-w-0 flex-1 whitespace-normal leading-5">{child.title}</span>
                                      {child.badge && <PillBadge value={child.badge} active={childActive} />}
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
                              "border border-transparent",
                              menuItemIdle,
                              active && menuItemActive,
                            )}
                            activeClassName=""
                          >
                            <span className={cn(leftAccent, active && leftAccentActive)} />
                            <span className={cn(iconWrapBase, iconWrapIdle, active && iconWrapActive)}>
                              <MenuIcon Icon={item.icon} active={active} />
                            </span>

                            {!collapsed && (
                              <>
                                <span className="min-w-0 flex-1 whitespace-normal leading-5">{item.title}</span>
                                {item.badge && <PillBadge value={item.badge} active={active} />}
                                <ChevronRight className="ml-auto mt-1 h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-200 group-hover:translate-x-0.5" />
                              </>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        {/* FOOTER */}
        <SidebarFooter className="border-t border-sidebar-border/80 p-3">
          {!collapsed && user && (
            <div className={cn("rounded-[18px] border border-sidebar-border/70 bg-background/80 shadow-[0_6px_16px_-14px_rgba(15,23,42,0.12)] dark:bg-background/55 dark:shadow-[0_8px_18px_-16px_rgba(0,0,0,0.24)]", "p-3")}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-600 to-sky-500 text-sm font-bold text-white">
                  {user.email ? user.email.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-sidebar-foreground">{user.email?.split("@")[0]}</div>
                  <div className="truncate text-[10px] font-medium text-muted-foreground">{user.email}</div>
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
            </div>
          )}

          <div className={cn(surfacePanel, "mt-2 flex items-center justify-between gap-1.5 p-2")}>
            <ThemeToggle />

            <button
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/45 hover:text-foreground dark:hover:bg-muted/30"
              title="Yardım"
              type="button"
            >
              <CircleHelp className="h-4 w-4" />
            </button>

            <button
              onClick={() => {
                closeMobileSidebar();
                navigate("/settings");
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/45 hover:text-foreground dark:hover:bg-muted/30"
              title="Ayarlar"
              type="button"
            >
              <Settings className="h-4 w-4" />
            </button>

            <button
              onClick={() => {
                closeMobileSidebar();
                void handleSignOut();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              title="Çıkış yap"
              type="button"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}
