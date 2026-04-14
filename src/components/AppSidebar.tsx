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
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  BookOpen,
  TrendingUp,
  Building2,
  Flame,
  Calendar,
  Users,
  Target,
  Mail,
  Bot,
  ChevronDown,
  PencilRuler,
  History,
  Award,
  Briefcase,
  FileSearch,
  Map,
  CalendarClock,
  HeartPulse,
  Search,
  CircleHelp,
  Sparkles,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
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
  // Badge styles readable on card surface in both themes.
  if (badge === "AI") return "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-200";
  if (badge === "Pro") return "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200";
  if (badge === "Beta") return "border-sky-500/25 bg-sky-500/10 text-sky-800 dark:text-sky-200";
  if (badge === "NEW") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  if (typeof badge === "number") return "border-yellow-500/25 bg-yellow-500/10 text-yellow-900 dark:text-yellow-200";
  return "border-border/60 bg-muted/35 text-muted-foreground";
};

const cardShell =
  // This makes the whole sidebar look like a floating card.
  "rounded-[22px] border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[0_18px_55px_-35px_rgba(2,6,23,0.30)] dark:shadow-[0_30px_80px_-45px_rgba(0,0,0,0.65)]";

const cardInnerGlow =
  // Subtle premium glow (safe in light/dark)
  "bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.10),_transparent_40%)]";

const sectionLabel =
  "px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground";

const menuItemBase =
  "group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-[13px] font-medium transition-all duration-200";

const menuItemIdle =
  "text-foreground/80 hover:bg-muted/50 hover:text-foreground";

const menuItemActive =
  // Active: pill highlight + subtle border and shadow.
  "border border-primary/20 bg-[linear-gradient(90deg,hsl(var(--primary)/0.16),transparent)] text-foreground shadow-[0_12px_30px_-22px_hsl(var(--primary)/0.55)]";

const iconWrapBase =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-all duration-200";

const iconWrapIdle =
  "border-border/60 bg-background/45 text-muted-foreground group-hover:bg-background group-hover:text-foreground";

const iconWrapActive =
  "border-primary/25 bg-primary/10 text-primary";

const leftAccent =
  "absolute left-1 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-primary/80 opacity-0 transition-opacity";
const leftAccentActive = "opacity-100";

function PillBadge({ value, active }: { value: string | number; active: boolean }) {
  return (
    <span
      className={cn(
        "ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none",
        active ? "border-primary/25 bg-primary/10 text-primary" : badgeClassNames(value),
      )}
    >
      {value}
    </span>
  );
}

// ====================================================
// COMPONENT
// ====================================================

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  const { signOut, user } = useAuth();
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
          { title: "Panel", url: "/", icon: LayoutDashboard, badge: null },
          { title: "Profilim", url: "/profile", icon: User, badge: null },
          { title: "E-posta Geçmişi", url: "/email-history", icon: Mail, badge: null },
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
              { title: "OSGB Dashboard", url: "/osgb/dashboard", icon: LayoutDashboard, badge: null },
              { title: "Personel Havuzu", url: "/osgb/personnel", icon: Users, badge: null },
              { title: "Personel Görevlendirme", url: "/osgb/assignments", icon: Briefcase, badge: null },
              { title: "Firma Takibi", url: "/osgb/company-tracking", icon: Building2, badge: null },
              { title: "Süre ve Kapasite", url: "/osgb/capacity", icon: TrendingUp, badge: null },
              { title: "Uyarı Merkezi", url: "/osgb/alerts", icon: ShieldAlert, badge: "NEW" },
              { title: "Finans Yönetimi", url: "/osgb/finance", icon: FileText, badge: null },
              { title: "Evrak Takibi", url: "/osgb/documents", icon: FileSearch, badge: null },
              { title: "Görev Motoru", url: "/osgb/tasks", icon: ClipboardCheck, badge: null },
              { title: "Operasyon Notları", url: "/osgb/notes", icon: BookOpen, badge: null },
              { title: "Trend Analizi", url: "/osgb/analytics", icon: TrendingUp, badge: null },
            ],
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
          { title: "NACE Kod Sorgu", url: "/nace-query", icon: Shield, badge: "AI" },
          { title: "NACE Sektör Listesi", url: "/nace-query/sectors", icon: BookOpen, badge: null },
        ],
      },
      {
        label: "AI & Otomasyon",
        icon: Brain,
        items: [
          { title: "AI Raporlar", url: "/reports", icon: Brain, badge: "Beta" },
          { title: "İSGPratik Bot", url: "/isg-bot", icon: Bot, badge: "NEW" },
        ],
      },
    ],
    [draftMeetingsCount],
  );

  const bottomItems: MenuItem[] = useMemo(
    () => [{ title: "Ayarlar", url: "/settings", icon: Settings, badge: null }],
    [],
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

  return (
   <Sidebar
        collapsible="icon"
        style={
          {
            "--sidebar-width": "16rem",
            "--sidebar-width-icon": "4.75rem",
          } as React.CSSProperties
        }
        className={cn(
          "bg-transparent p-3",
          "h-dvh" // ✅ viewport yüksekliği
        )}
      >
      <div
          className={cn(
            cardShell,
            cardInnerGlow,
            "flex h-full min-h-0 flex-col" // ✅ kritik: content scroll için
          )}
        >
        {/* HEADER */}
        <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sidebar-border bg-background/55 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-cyan-500 text-white shadow-sm">
                  <Shield className="h-4 w-4" />
                </div>
              </div>

              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    İSGVİZYON
                  </div>
                  <div className="truncate text-sm font-semibold text-sidebar-foreground">
                    Premium çalışma alanı
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={toggleSidebar}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl border border-sidebar-border bg-background/45 text-muted-foreground transition",
                "hover:bg-muted/45 hover:text-sidebar-foreground",
              )}
              title={collapsed ? "Menüyü aç" : "Menüyü daralt"}
              type="button"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {!collapsed && (
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Menüde ara..."
                className={cn(
                  "h-10 rounded-2xl border border-sidebar-border bg-background/45 pl-9 text-sm text-sidebar-foreground shadow-none",
                  "placeholder:text-muted-foreground",
                  "focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:border-ring",
                )}
              />
            </div>
          )}
        </SidebarHeader>

        {/* CONTENT */}
        <SidebarContent className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 overscroll-contain">
          {filteredMenuGroups.map((group) => (
            <SidebarGroup key={group.label} className="px-1">
              {!collapsed ? (
                <div className={sectionLabel}>
                  <div className="flex items-center gap-2">
                    <group.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{group.label}</span>
                  </div>
                </div>
              ) : (
                <div className="my-2 flex justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
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
                              <item.icon className="h-[16px] w-[16px]" />
                            </span>

                            {!collapsed && (
                              <>
                                <span className="truncate">{item.title}</span>
                                {item.badge && <PillBadge value={item.badge} active={active} />}
                                <ChevronDown className={cn("ml-1 h-4 w-4 text-muted-foreground transition-transform", submenuOpen && "rotate-180")} />
                              </>
                            )}
                          </button>

                          {!collapsed && submenuOpen && (
                            <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-3">
                              {item.children?.map((child) => {
                                const childActive = isItemActive(child);

                                return (
                                  <SidebarMenuButton key={child.url} asChild tooltip={child.title}>
                                    <NavLink
                                      to={child.url}
                                      className={cn(
                                        "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors",
                                        "text-foreground/70 hover:bg-muted/45 hover:text-foreground",
                                        childActive && "bg-primary/10 text-foreground",
                                      )}
                                      activeClassName=""
                                    >
                                      <child.icon
                                        className={cn(
                                          "h-4 w-4",
                                          childActive ? "text-primary" : "text-muted-foreground",
                                        )}
                                      />
                                      <span className="truncate">{child.title}</span>
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
                            className={cn(menuItemBase, "border border-transparent", menuItemIdle, active && menuItemActive)}
                            activeClassName=""
                          >
                            <span className={cn(leftAccent, active && leftAccentActive)} />
                            <span className={cn(iconWrapBase, iconWrapIdle, active && iconWrapActive)}>
                              <item.icon className="h-[16px] w-[16px]" />
                            </span>

                            {!collapsed && (
                              <>
                                <span className="truncate">{item.title}</span>
                                {item.badge && <PillBadge value={item.badge} active={active} />}
                                <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/70" />
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
        <SidebarFooter className="border-t border-sidebar-border p-3">
          {!collapsed && user && (
            <div className="rounded-2xl border border-sidebar-border bg-background/45 p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-600 to-sky-500 text-sm font-bold text-white shadow-sm">
                  {user.email ? user.email.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-sidebar-foreground">
                    {user.email?.split("@")[0]}
                  </div>
                  <div className="truncate text-[10px] font-medium text-muted-foreground">
                    {user.email}
                  </div>
                </div>
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </div>
            </div>
          )}

          {/* Icon dock (card style) */}
          <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl border border-sidebar-border bg-background/45 p-2 shadow-sm">
            <ThemeToggle />

            <button
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/45 hover:text-foreground"
              title="Yardım"
              type="button"
            >
              <CircleHelp className="h-4 w-4" />
            </button>

            <button
              onClick={() => navigate("/settings")}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/45 hover:text-foreground"
              title="Ayarlar"
              type="button"
            >
              <Settings className="h-4 w-4" />
            </button>

            <button
              onClick={async () => {
                await signOut();
                navigate("/auth");
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