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
    return "border-fuchsia-500/30 bg-fuchsia-500/12 text-fuchsia-800 dark:text-fuchsia-200";
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
  "rounded-[28px] border border-sidebar-border/80 bg-sidebar/92 text-sidebar-foreground backdrop-blur-2xl",
  "ring-1 ring-black/5 dark:ring-white/5",
  "shadow-[0_28px_80px_-42px_rgba(2,6,23,0.40)] dark:shadow-[0_44px_120px_-62px_rgba(0,0,0,0.82)]",
);

const cardInnerGlow = cn(
  // light
  "bg-[radial-gradient(900px_circle_at_10%_0%,_hsl(var(--primary)/0.10),_transparent_45%),radial-gradient(700px_circle_at_80%_10%,_hsl(var(--primary)/0.07),_transparent_40%)]",
  // dark
  "dark:bg-[radial-gradient(900px_circle_at_10%_0%,_hsl(var(--primary)/0.18),_transparent_45%),radial-gradient(700px_circle_at_80%_10%,_hsl(var(--primary)/0.12),_transparent_40%)]",
);

const sectionLabel =
  "mb-1 flex items-center justify-between px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.20em] text-muted-foreground/90";

// ✅ items-start: 2 satıra kırılınca ikon yukarı hizalı kalsın
const menuItemBase =
  "group relative flex h-auto min-h-[4.5rem] w-full items-start gap-3 overflow-visible rounded-[22px] px-3 py-3 text-[13px] font-medium transition-all duration-200";

const menuItemIdle = cn(
  "text-foreground/85 hover:bg-muted/55 hover:text-foreground",
  "hover:shadow-[0_12px_34px_-28px_rgba(15,23,42,0.50)]",
  "dark:text-foreground/80 dark:hover:bg-muted/35 dark:hover:shadow-[0_18px_44px_-32px_rgba(0,0,0,0.70)]",
);

const menuItemActive = cn(
  "border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.22),transparent_72%)]",
  "text-foreground shadow-[0_18px_44px_-30px_hsl(var(--primary)/0.75)]",
  "dark:border-primary/22 dark:bg-[linear-gradient(135deg,hsl(var(--primary)/0.26),transparent_72%)]",
);

// İKON KUTUSU: daha büyük + daha görünür (renk ikona verilecek)
const iconWrapBase = 
  "relative mt-0.5 flex h-12 w-12 min-w-12 basis-12 shrink-0 items-center justify-center overflow-visible rounded-[20px] border transition-all duration-200";

const iconWrapIdle = cn(
  "border-sidebar-border/80 bg-background/55",
  "shadow-sm group-hover:border-primary/45 group-hover:bg-background/80",
  "dark:border-white/10 dark:bg-white/5"
);

const iconWrapActive = cn(
  "border-primary/35 bg-[linear-gradient(180deg,hsl(var(--primary)/0.22),hsl(var(--primary)/0.12))]",
  "shadow-[0_24px_54px_-36px_hsl(var(--primary)/0.95)]",
  "dark:bg-[linear-gradient(180deg,hsl(var(--primary)/0.26),hsl(var(--primary)/0.14))]",
);

const leftAccent =
  "absolute left-1 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full bg-primary/85 opacity-0 transition-opacity";
const leftAccentActive = "opacity-100";

const surfacePanel = cn(
  "rounded-[24px] border border-sidebar-border/70 bg-background/55 backdrop-blur-xl",
  "shadow-[0_10px_24px_-18px_rgba(15,23,42,0.18)] dark:shadow-[0_14px_30px_-20px_rgba(0,0,0,0.55)]",
);

const collapsedUtilityButton = cn(
  "flex h-11 w-11 items-center justify-center rounded-[18px] border border-sidebar-border/80 bg-background/70",
  "text-foreground/80 shadow-[0_18px_34px_-26px_rgba(15,23,42,0.45)] backdrop-blur-xl transition",
  "hover:border-primary/30 hover:bg-background hover:text-foreground",
  "dark:text-foreground/85 dark:shadow-[0_18px_34px_-26px_rgba(0,0,0,0.78)]",
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
          : "text-foreground/90 dark:text-white/70"
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
        active ? "text-primary" : "text-foreground/70 dark:text-foreground/80",
      )}
    />
  );
}

// ====================================================
// COMPONENT
// ====================================================

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  const { signOut, user } = useAuth();
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

  const [collapsedSubmenus, setCollapsedSubmenus] = useState<string[]>([]);
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
          { title: "Atama Yazıları", url: "/assignment-letters", icon: FileText, badge: null },
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
                  canViewDashboard ? { title: "OSGB Başlangıç", url: "/osgb/dashboard", icon: LayoutDashboard, badge: null } : null,
                  canViewDashboard ? { title: "Nasıl Kullanılır", url: "/osgb/how-to", icon: CircleHelp, badge: null } : null,
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
                ].filter((item): item is MenuItem => Boolean(item)),
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
          { title: "ADEP Planlarım", url: "/adep-plans", icon: FileText, badge: null },
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
    [draftMeetingsCount],
  );

  const isItemActive = (item: MenuItem) => {
    if (item.url === "/") return location.pathname === "/";
    return location.pathname === item.url || location.pathname.startsWith(`${item.url}/`);
  };

  const toggleSubmenu = (label: string) => {
    if (collapsed) return;
    setCollapsedSubmenus((prev) => (prev.includes(label) ? prev.filter((it) => it !== label) : [...prev, label]));
  };

  const isSubmenuOpen = (item: MenuItem) => {
    if (!item.children?.length) return false;
    const childActive = item.children.some((child) => isItemActive(child));
    return childActive || !collapsedSubmenus.includes(item.title);
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

  return (
    <Sidebar
      collapsible="icon"
      style={
        {
          "--sidebar-width": "22rem",
          "--sidebar-width-icon": "5.5rem",
        } as React.CSSProperties
      }
      className={cn("h-svh bg-transparent p-3 md:p-4")}
    >
      <div className={cn(cardShell, cardInnerGlow, "flex h-full min-h-0 flex-col overflow-hidden")}>
        {collapsed && (
          <div className="flex items-center justify-center border-b border-sidebar-border/80 px-2 py-3">
            <button onClick={toggleSidebar} className={collapsedUtilityButton} title="Menüyü genişlet" type="button">
              <PanelLeftOpen className="h-5 w-5 stroke-[2.2]" />
            </button>
          </div>
        )}

        {/* HEADER */}
        <SidebarHeader className={cn("border-b border-sidebar-border/80 px-3 py-4", collapsed && "hidden")}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className={cn(surfacePanel, "flex h-12 w-12 shrink-0 items-center justify-center rounded-[22px] p-1")}>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-cyan-500 text-white shadow-sm">
                  <Shield className="h-4 w-4 stroke-[2.2]" />
                </div>
              </div>

              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    İSGVİZYON
                  </div>
                  <div className="text-sm font-semibold text-sidebar-foreground">Operasyon merkezi</div>
                  <div className="text-xs text-muted-foreground">Hızlı erişim ve görev takibi</div>
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
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className={cn(surfacePanel, "p-3")}>
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <Activity className="h-3.5 w-3.5" />
                    Görünen
                  </div>
                  <div className="mt-2 text-xl font-semibold text-sidebar-foreground">{totalVisibleItems}</div>
                  <div className="text-xs text-muted-foreground">aktif menü bağlantısı</div>
                </div>
                <div className={cn(surfacePanel, "p-3")}>
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <Command className="h-3.5 w-3.5" />
                    Durum
                  </div>
                  <div className="mt-2 text-sm font-semibold text-sidebar-foreground">Hazır</div>
                  <div className="text-xs text-muted-foreground">tek panelden hızlı erişim</div>
                </div>
              </div>

              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Menüde ara..."
                  className={cn(
                    "h-11 rounded-[20px] border border-sidebar-border/70 bg-background/55 pl-9 text-sm text-sidebar-foreground shadow-none backdrop-blur-xl",
                    "placeholder:text-muted-foreground",
                    "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
                  )}
                />
              </div>
            </>
          )}
        </SidebarHeader>

        {/* CONTENT */}
        <SidebarContent className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-1 overscroll-contain">
          {filteredMenuGroups.map((group) => (
            <SidebarGroup key={group.label} className="px-1">
              {!collapsed ? (
                <div className={sectionLabel}>
                  <div className="flex items-center gap-2">
                    <group.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{group.label}</span>
                  </div>
                  <span className="rounded-full border border-sidebar-border/70 bg-background/55 px-2 py-0.5 text-[10px] font-semibold tracking-normal text-muted-foreground">
                    {group.items.length}
                  </span>
                </div>
              ) : (
                <div className="my-3 flex justify-center">
                  <div className="h-8 w-px rounded-full bg-gradient-to-b from-transparent via-sidebar-border to-transparent" />
                </div>
              )}

              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
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
            <div className={cn(surfacePanel, "p-3")}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-600 to-sky-500 text-sm font-bold text-white shadow-sm">
                  {user.email ? user.email.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-sidebar-foreground">{user.email?.split("@")[0]}</div>
                  <div className="text-[10px] font-medium text-muted-foreground">{user.email}</div>
                </div>
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </div>
            </div>
          )}

          <div className={cn(surfacePanel, "mt-2 flex items-center justify-between gap-2 p-2")}>
            <ThemeToggle />

            <button
              className="flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground transition hover:bg-muted/45 hover:text-foreground dark:hover:bg-muted/30"
              title="Yardım"
              type="button"
            >
              <CircleHelp className="h-4 w-4" />
            </button>

            <button
              onClick={() => navigate("/settings")}
              className="flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground transition hover:bg-muted/45 hover:text-foreground dark:hover:bg-muted/30"
              title="Ayarlar"
              type="button"
            >
              <Settings className="h-4 w-4" />
            </button>

            <button
              onClick={handleSignOut}
              className="flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
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
