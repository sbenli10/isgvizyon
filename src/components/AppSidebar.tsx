// ====================================================
// APP SIDEBAR - FIXED & COMPLETE
// ====================================================

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
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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

const badgeClassNames = (badge: MenuItem["badge"]) => {
  if (badge === "AI") {
    return "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/25";
  }

  if (badge === "Pro") {
    return "bg-amber-500/15 text-amber-300 border-amber-400/25";
  }

  if (badge === "Beta") {
    return "bg-sky-500/15 text-sky-300 border-sky-400/25";
  }

  if (badge === "NEW") {
    return "bg-emerald-500/15 text-emerald-300 border-emerald-400/25";
  }

  if (typeof badge === "number") {
    return "bg-yellow-500/15 text-yellow-300 border-yellow-400/25";
  }

  return "bg-slate-500/15 text-slate-200 border-slate-400/20";
};

// ====================================================
// COMPONENT
// ====================================================

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const collapsed = state === "collapsed";

  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [collapsedSubmenus, setCollapsedSubmenus] = useState<string[]>([]);
  const [draftMeetingsCount, setDraftMeetingsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch draft meetings count
  useEffect(() => {
    if (user) {
      fetchDraftMeetingsCount();
    }
  }, [user]);

  const fetchDraftMeetingsCount = async () => {
    if (!user) return;

    try {
      const { count, error } = await supabase
        .from("board_meetings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "draft");

      if (!error) {
        setDraftMeetingsCount(count || 0);
      }
    } catch (error) {
      console.error("Failed to fetch draft meetings count:", error);
    }
  };

  // Menu Groups Configuration
  const menuGroups: MenuGroup[] = [
    {
      label: "GENEL",
      icon: LayoutDashboard,
      items: [
        { title: "Panel", url: "/", icon: LayoutDashboard, badge: null },
        { title: "Profilim", url: "/profile", icon: User, badge: null },
        {
          title: "E-posta Geçmişi",
          url: "/email-history",
          icon: Mail,
          badge: null,
        }
      ],
    },
    {
      label: "OPERASYONLAR",
      icon: Briefcase,
      items: [
        {
          title: "Denetimler",
          url: "/inspections",
          icon: ClipboardCheck,
          badge: null,
        },
        {
          title: "Kurul Toplantıları",
          url: "/board-meetings",
          icon: Users,
          badge: draftMeetingsCount > 0 ? draftMeetingsCount : null,
        },
        {
          title: "Atama Yazıları",
          url: "/assignment-letters",
          icon: FileText,
          badge: null,
        },
        {
          title: "İş Kazası / Ramak Kala",
          url: "/incidents",
          icon: ShieldAlert,
          badge: "NEW",
        },
        {
          title: "Periyodik Kontrol",
          url: "/periodic-controls",
          icon: CalendarClock,
          badge: "NEW",
        },
      ],
    },
    {
      label: "FİRMA VE KADRO",
      icon: Building2,
      items: [
        { title: "Firmalar", url: "/companies", icon: Building2, badge: null },
        {
          title: "Çalışanlar",
          url: "/employees",
          icon: Users,
          badge: null,
        },
        {
          title: "KKD Zimmet",
          url: "/ppe-management",
          icon: Shield,
          badge: "NEW",
        },
        {
          title: "Sağlık Gözetimi",
          url: "/health-surveillance",
          icon: HeartPulse,
          badge: "NEW",
        },
        {
          title: "OSGB Modülü",
          url: "/osgb",
          icon: Briefcase,
          badge: "NEW",
          children: [
            {
              title: "OSGB Dashboard",
              url: "/osgb/dashboard",
              icon: LayoutDashboard,
              badge: null,
            },
            {
              title: "Personel Havuzu",
              url: "/osgb/personnel",
              icon: Users,
              badge: null,
            },
            {
              title: "Personel Görevlendirme",
              url: "/osgb/assignments",
              icon: Briefcase,
              badge: null,
            },
            {
              title: "Firma Takibi",
              url: "/osgb/company-tracking",
              icon: Building2,
              badge: null,
            },
            {
              title: "Süre ve Kapasite",
              url: "/osgb/capacity",
              icon: TrendingUp,
              badge: null,
            },
            {
              title: "Uyarı Merkezi",
              url: "/osgb/alerts",
              icon: ShieldAlert,
              badge: "NEW",
            },
            {
              title: "Finans Yönetimi",
              url: "/osgb/finance",
              icon: FileText,
              badge: null,
            },
            {
              title: "Evrak Takibi",
              url: "/osgb/documents",
              icon: FileSearch,
              badge: null,
            },
            {
              title: "Görev Motoru",
              url: "/osgb/tasks",
              icon: ClipboardCheck,
              badge: null,
            },
            {
              title: "Operasyon Notları",
              url: "/osgb/notes",
              icon: BookOpen,
              badge: null,
            },
            {
              title: "Trend Analizi",
              url: "/osgb/analytics",
              icon: TrendingUp,
              badge: null,
            },
          ],
        },
      ],
    },
    {
      label: "BELGE YÖNETİMİ",
      icon: Award,
      items: [
        { title: "Sertifika Merkezi", url: "/dashboard/certificates", icon: Award, badge: "NEW" },
        { title: "Sertifika Geçmişi", url: "/dashboard/certificates/history", icon: History, badge: null },
        {
          title: "İSG Kütüphanesi",
          url: "/safety-library",
          icon: BookOpen,
          badge: null,
        }
      ],
    },
    {
      label: "RİSK & GÜVENLİK",
      icon: ShieldAlert,
      items: [
        {
          title: "Risk Sihirbazı",
          url: "/risk-wizard",
          icon: TrendingUp,
          badge: "AI",
        },
        {
          title: "Klasik Risk Editörü",
          url: "/risk-editor",
          icon: FileSearch,
          badge: "NEW",
        },
        { title: "DÖF Yönetimi", url: "/capa", icon: ShieldAlert, badge: null },
        {
          title: "DÖF Oluştur",
          url: "/bulk-capa",
          icon: ShieldPlus,
          badge: null,
        },
        {
          title: "Acil Durum Planı",
          url: "/adep-wizard",
          icon: Flame,
          badge: null,
        },
        {
          title: "ADEP Planlarım",
          url: "/adep-plans",
          icon: FileText,
          badge: null,
        },
      ],
    },
    {
      label: "ACİL DURUM VE KROKİ",
      icon: Map,
      items: [
        {
          title: "AI Kroki Okuyucu",
          url: "/blueprint-analyzer",
          icon: Target,
          badge: "Pro",
        },
        {
          title: "Kroki Düzenleyici",
          url: "/evacuation-editor",
          icon: PencilRuler,
          badge: "NEW",
        },
        {
          title: "Kroki Geçmişleri",
          url: "/evacuation-editor/history",
          icon: History,
          badge: null,
        },
      ],
    },
    {
      label: "YAPAY ZEKA VE OTOMASYON",
      icon: Brain,
      items: [
        { title: "AI Raporlar", url: "/reports", icon: Brain, badge: "Beta" },
        { title: "Dashboard", url: "/isg-bot", icon: Bot, badge: "NEW" },
        {
          title: "Denetime Hazır mıyım?",
          url: "/isg-bot?tab=audit",
          icon: ClipboardCheck,
          badge: null,
        },
        {
          title: "Compliance Raporu",
          url: "/isg-bot?tab=compliance",
          icon: Shield,
          badge: null,
        },
        {
          title: "Risk Analizi",
          url: "/isg-bot?tab=risk",
          icon: TrendingUp,
          badge: null,
        },
      ],
    },
    {
      label: "REFERANS VE PLANLAMA",
      icon: Calendar,
      items: [
        {
          title: "Yıllık Planlar",
          url: "/annual-plans",
          icon: Calendar,
          badge: null,
        },
        {
          title: "NACE Kod Sorgu",
          url: "/nace-query",
          icon: Shield,
          badge: "AI",
        },
        {
          title: "NACE Sektör Listesi",
          url: "/nace-query/sectors",
          icon: BookOpen,
          badge: null,
        },
      ],
    },
  ];

  const bottomItems: MenuItem[] = [
    { title: "Ayarlar", url: "/settings", icon: Settings, badge: null },
  ];

  const toggleGroup = (label: string) => {
    if (collapsed) return;
    setCollapsedGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  };

  const toggleSubmenu = (label: string) => {
    if (collapsed) return;
    setCollapsedSubmenus((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label],
    );
  };

  const isItemActive = (item: MenuItem) => {
    if (item.url === "/") {
      return location.pathname === "/";
    }

    return location.pathname === item.url || location.pathname.startsWith(`${item.url}/`);
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
  const filteredMenuGroups = menuGroups
    .map((group) => {
      if (!normalizedSearch) {
        return group;
      }

      const matchesGroup = group.label.toLocaleLowerCase("tr-TR").includes(normalizedSearch);
      const items = group.items
        .map((item) => {
          const matchesItem = item.title.toLocaleLowerCase("tr-TR").includes(normalizedSearch);
          const filteredChildren = item.children?.filter((child) =>
            child.title.toLocaleLowerCase("tr-TR").includes(normalizedSearch),
          );

          if (matchesGroup || matchesItem) {
            return item;
          }

          if (filteredChildren?.length) {
            return { ...item, children: filteredChildren };
          }

          return null;
        })
        .filter((item): item is MenuItem => item !== null);

      return items.length ? { ...group, items } : null;
    })
    .filter((group): group is MenuGroup => group !== null);

  return (
    <Sidebar
      collapsible="icon"
      style={
        {
          "--sidebar-width": "14rem",
          "--sidebar-width-icon": "4.5rem",
        } as React.CSSProperties
      }
      className="border-r border-sidebar-border bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.18),_transparent_26%),linear-gradient(180deg,hsl(var(--sidebar-background)),hsl(var(--sidebar-background)))] text-sidebar-foreground"
    >
      {/* HEADER - LOGO & BRANDING */}
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_10px_30px_-20px_rgba(99,102,241,0.8)] backdrop-blur">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 text-white shadow-sm">
                <Shield className="h-4 w-4" />
              </div>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-sidebar-foreground/55">
                  Denetron
                </div>
                <div className="truncate text-sm font-semibold text-sidebar-foreground">
                  Premium çalışma alanı
                </div>
              </div>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sidebar-foreground/70 transition hover:border-primary/25 hover:bg-white/10 hover:text-sidebar-foreground"
            title={collapsed ? "Menüyü aç" : "Menüyü daralt"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {!collapsed && (
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/45" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Menüde ara..."
              className="h-10 rounded-2xl border-white/10 bg-white/5 pl-9 text-sm text-sidebar-foreground shadow-none placeholder:text-sidebar-foreground/40 focus-visible:ring-primary/30"
            />
          </div>
        )}
      </SidebarHeader>

      {/* MAIN CONTENT */}
      <SidebarContent className="overflow-y-auto px-2 py-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {!collapsed && (
          <div className="mb-3 rounded-2xl border border-white/10 bg-gradient-to-r from-violet-500/12 via-fuchsia-500/10 to-cyan-500/12 p-3 text-sidebar-foreground shadow-[0_18px_40px_-28px_rgba(99,102,241,0.9)]">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-fuchsia-300">
              <Sparkles className="h-3.5 w-3.5" />
              Sık kullanılanlar
            </div>
            <p className="mt-2 text-xs leading-5 text-sidebar-foreground/72">
              Tek bulgu için tekli DÖF, toplu kayıtlar için çoklu DÖF ekranını kullanın.
            </p>
          </div>
        )}

        {filteredMenuGroups.map((group) => (
          <SidebarGroup key={group.label} className="mb-1 px-1 py-1">
            {/* GROUP HEADER */}
            <button
              onClick={() => toggleGroup(group.label)}
              className={`flex w-full items-center justify-between rounded-xl px-2 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-sidebar-foreground/45 transition-all ${
                !collapsed ? "hover:bg-white/5 hover:text-sidebar-foreground/75" : ""
              }`}
              disabled={collapsed}
            >
              {!collapsed ? (
                <>
                  <div className="flex items-center gap-2">
                    <group.icon className="h-3.5 w-3.5" />
                    <span>{group.label}</span>
                  </div>
                  <ChevronDown
                    className={`h-3 w-3 transition-transform duration-200 ${
                      collapsedGroups.includes(group.label) ? "-rotate-90" : ""
                    }`}
                  />
                </>
              ) : (
                <div className="mx-auto h-1.5 w-1.5 rounded-full bg-sidebar-foreground/30" />
              )}
            </button>

            {/* GROUP ITEMS */}
            {(!collapsedGroups.includes(group.label) || collapsed) && (
              <SidebarGroupContent>
                <SidebarMenu className="mt-1 gap-1.5">
                  {group.items.map((item) => {
                    const hasChildren = Boolean(item.children?.length);
                    const submenuOpen = isSubmenuOpen(item);

                    return (
                      <SidebarMenuItem key={item.url}>
                        {hasChildren ? (
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => toggleSubmenu(item.title)}
                              className={cn(
                                "group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-transparent px-3 py-2.5 text-sm font-medium text-sidebar-foreground/78 transition-all duration-200 hover:border-white/10 hover:bg-white/6 hover:text-sidebar-foreground",
                                isItemActive(item) &&
                                  "border-violet-400/20 bg-[linear-gradient(90deg,rgba(111,66,255,0.95),rgba(132,76,255,0.92),rgba(72,116,255,0.9))] text-white shadow-[0_16px_36px_-22px_rgba(109,61,248,0.95)]",
                              )}
                            >
                              <div className={cn("absolute inset-y-1 left-0 w-1 rounded-r-full bg-white/80 opacity-0 transition-opacity", isItemActive(item) && "opacity-100")} />
                              <div
                                className={cn(
                                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/6 text-violet-300 transition-all duration-200 group-hover:border-white/14 group-hover:bg-white/10",
                                  isItemActive(item) && "border-white/20 bg-white/10 text-white",
                                )}
                              >
                                <item.icon className="h-[16px] w-[16px] shrink-0 transition-transform group-hover:scale-110" />
                              </div>

                              {!collapsed && (
                                <>
                                  <span className="flex-1 truncate text-left">{item.title}</span>
                                  {item.badge && (
                                    <span
                                      className={cn(
                                        "rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider",
                                        isItemActive(item)
                                          ? "border-white/20 bg-white/10 text-white"
                                          : badgeClassNames(item.badge),
                                      )}
                                    >
                                      {item.badge}
                                    </span>
                                  )}
                                  <ChevronDown className={cn("h-4 w-4 transition-transform", submenuOpen && "rotate-180")} />
                                </>
                              )}
                            </button>

                            {!collapsed && submenuOpen ? (
                              <div className="ml-5 space-y-1 border-l border-white/10 pl-4">
                                {item.children?.map((child) => (
                                  <SidebarMenuButton key={child.url} asChild tooltip={child.title}>
                                    <NavLink
                                      to={child.url}
                                      className="group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/68 transition-all duration-200 hover:bg-white/6 hover:text-sidebar-foreground"
                                      activeClassName="border border-violet-400/20 bg-violet-500/10 text-violet-200"
                                    >
                                      <child.icon className="h-4 w-4 shrink-0 text-violet-300" />
                                      <span className="flex-1 truncate">{child.title}</span>
                                      {child.badge && (
                                        <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${badgeClassNames(child.badge)}`}>
                                          {child.badge}
                                        </span>
                                      )}
                                    </NavLink>
                                  </SidebarMenuButton>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <SidebarMenuButton asChild tooltip={item.title}>
                            <NavLink
                              to={item.url}
                              end={item.url === "/"}
                              className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-transparent px-3 py-2.5 text-sm font-medium text-sidebar-foreground/78 transition-all duration-200 hover:border-white/10 hover:bg-white/6 hover:text-sidebar-foreground"
                              activeClassName="border-violet-400/20 bg-[linear-gradient(90deg,rgba(111,66,255,0.95),rgba(132,76,255,0.92),rgba(72,116,255,0.9))] text-white font-semibold shadow-[0_16px_36px_-22px_rgba(109,61,248,0.95)]"
                            >
                              <div className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-white/80 opacity-0 transition-opacity group-[.active]:opacity-100" />

                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/6 text-violet-300 transition-all duration-200 group-hover:border-white/14 group-hover:bg-white/10 group-[.active]:border-white/20 group-[.active]:bg-white/10 group-[.active]:text-white">
                                <item.icon className="h-[16px] w-[16px] shrink-0 transition-transform group-hover:scale-110" />
                              </div>

                              {!collapsed && (
                                <>
                                  <span className="flex-1 truncate transition-transform group-hover:translate-x-0.5">
                                    {item.title}
                                  </span>
                                  {item.badge && (
                                    <span
                                      className={cn(
                                        "rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider",
                                        "group-[.active]:border-white/20 group-[.active]:bg-white/10 group-[.active]:text-white",
                                        badgeClassNames(item.badge),
                                      )}
                                    >
                                      {item.badge}
                                    </span>
                                  )}
                                </>
                              )}
                            </NavLink>
                          </SidebarMenuButton>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        ))}

        {/* SEPARATOR */}
        <div className="mx-2 my-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* TOOLS SECTION */}
        <SidebarGroup className="gap-2">
          <SidebarGroupLabel className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-sidebar-foreground/45">
            {!collapsed ? "SİSTEM" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {bottomItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="group relative flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-sm font-medium text-sidebar-foreground/78 transition-all duration-200 hover:border-white/10 hover:bg-white/6 hover:text-sidebar-foreground"
                      activeClassName="border-violet-400/20 bg-[linear-gradient(90deg,rgba(111,66,255,0.95),rgba(132,76,255,0.92),rgba(72,116,255,0.9))] text-white font-semibold shadow-[0_16px_36px_-22px_rgba(109,61,248,0.95)]"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/6 text-violet-300 transition-all duration-200 group-hover:border-white/14 group-hover:bg-white/10 group-[.active]:border-white/20 group-[.active]:bg-white/10 group-[.active]:text-white">
                        <item.icon className="h-[16px] w-[16px] shrink-0 transition-transform group-hover:scale-110" />
                      </div>
                      {!collapsed && (
                        <span className="flex-1 transition-transform group-hover:translate-x-0.5">
                          {item.title}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* FOOTER - USER & CONTROLS */}
      <SidebarFooter className="border-t border-sidebar-border p-3">
        {/* USER INFO PROFILE CARD */}
        {!collapsed && user && (
          <div className="group cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-3 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.95)] backdrop-blur transition-all hover:border-primary/20">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-blue-500 text-sm font-bold text-white shadow-sm transition-shadow">
                {user.email ? user.email.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-bold text-sidebar-foreground">
                  {user.email?.split("@")[0]}
                </span>
                <span className="truncate text-[10px] font-medium text-sidebar-foreground/45">
                  {user.email}
                </span>
              </div>
              <div className="shrink-0">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM CONTROLS */}
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.95)] backdrop-blur">
          <ThemeToggle />
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl text-sidebar-foreground/70 transition hover:bg-white/8 hover:text-sidebar-foreground"
            title="Yardım"
            type="button"
          >
            <CircleHelp className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate("/settings")}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-sidebar-foreground/70 transition hover:bg-white/8 hover:text-sidebar-foreground"
            title="Ayarlar"
            type="button"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={handleSignOut}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-sidebar-foreground/70 transition hover:bg-rose-500/10 hover:text-rose-400"
            title="Çıkış yap"
            type="button"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}







