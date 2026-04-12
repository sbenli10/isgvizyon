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
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
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
    return "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/30 shadow-sm shadow-fuchsia-500/20";
  }

  if (badge === "Pro") {
    return "bg-amber-500/15 text-amber-200 border-amber-400/30 shadow-sm shadow-amber-500/20";
  }

  if (badge === "Beta") {
    return "bg-sky-500/15 text-sky-200 border-sky-400/30 shadow-sm shadow-sky-500/20";
  }

  if (badge === "NEW") {
    return "bg-emerald-500/15 text-emerald-200 border-emerald-400/30 shadow-sm shadow-emerald-500/20";
  }

  if (typeof badge === "number") {
    return "bg-yellow-500/15 text-yellow-200 border-yellow-400/30 shadow-sm shadow-yellow-500/20";
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

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-800 bg-slate-950/95 backdrop-blur-xl">
      {/* HEADER - LOGO & BRANDING */}
      <SidebarHeader className="border-b border-slate-800 p-4">
        <div className="flex items-center gap-3 group/brand cursor-pointer">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.35),_transparent_55%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92))] shadow-lg shadow-cyan-500/20 transition-all duration-300 group-hover/brand:scale-105 group-hover/brand:shadow-cyan-500/35">
            <Shield className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-base font-black tracking-tight text-white bg-clip-text">
                İSGVİZYON
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-100/45 truncate">
                Entegre İSG Operasyon Platformu
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* MAIN CONTENT */}
      <SidebarContent className="px-2 py-3 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label} className="mb-1">
            {/* GROUP HEADER */}
            <button
              onClick={() => toggleGroup(group.label)}
              className={`flex items-center justify-between w-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 hover:text-slate-300 transition-all rounded-lg ${
                !collapsed ? "hover:bg-slate-900/50" : ""
              }`}
              disabled={collapsed}
            >
              {!collapsed ? (
                <>
                  <div className="flex items-center gap-2">
                    <group.icon className="h-3 w-3" />
                    <span>{group.label}</span>
                  </div>
                  <ChevronDown
                    className={`h-3 w-3 transition-transform duration-200 ${
                      collapsedGroups.includes(group.label) ? "-rotate-90" : ""
                    }`}
                  />
                </>
              ) : (
                <div className="w-full h-px bg-slate-800" />
              )}
            </button>

            {/* GROUP ITEMS */}
            {(!collapsedGroups.includes(group.label) || collapsed) && (
              <SidebarGroupContent>
                <SidebarMenu className="mt-1 gap-1">
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
                                "group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-300/85 transition-all duration-200 hover:border-slate-700 hover:bg-slate-900/80 hover:text-white",
                                isItemActive(item) && "border-cyan-400/20 bg-[linear-gradient(90deg,rgba(8,145,178,0.22),rgba(30,64,175,0.18))] text-white font-semibold shadow-lg shadow-cyan-950/40",
                              )}
                            >
                              <div className={cn("absolute inset-y-1 left-0 w-1 rounded-r-full bg-cyan-300 opacity-0 transition-opacity", isItemActive(item) && "opacity-100")} />
                              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 transition-all duration-200 group-hover:border-slate-700 group-hover:bg-slate-800", isItemActive(item) && "border-cyan-300/20 bg-cyan-400/10")}>
                                <item.icon className="h-[16px] w-[16px] shrink-0 transition-transform group-hover:scale-110" />
                              </div>

                              {!collapsed && (
                                <>
                                  <span className="flex-1 truncate text-left">{item.title}</span>
                                  {item.badge && (
                                    <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${badgeClassNames(item.badge)}`}>
                                      {item.badge}
                                    </span>
                                  )}
                                  <ChevronDown className={cn("h-4 w-4 transition-transform", submenuOpen && "rotate-180")} />
                                </>
                              )}
                            </button>

                            {!collapsed && submenuOpen ? (
                              <div className="ml-5 space-y-1 border-l border-slate-800/80 pl-4">
                                {item.children?.map((child) => (
                                  <SidebarMenuButton key={child.url} asChild tooltip={child.title}>
                                    <NavLink
                                      to={child.url}
                                      className="group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-slate-900 hover:text-white"
                                      activeClassName="border border-cyan-400/15 bg-slate-900 text-white"
                                    >
                                      <child.icon className="h-4 w-4 shrink-0" />
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
                              className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-300/85 transition-all duration-200 hover:border-slate-700 hover:bg-slate-900/80 hover:text-white"
                              activeClassName="border-cyan-400/20 bg-[linear-gradient(90deg,rgba(8,145,178,0.22),rgba(30,64,175,0.18))] text-white font-semibold shadow-lg shadow-cyan-950/40"
                            >
                              <div className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-cyan-300 opacity-0 transition-opacity group-[.active]:opacity-100" />

                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 transition-all duration-200 group-hover:border-slate-700 group-hover:bg-slate-800 group-[.active]:border-cyan-300/20 group-[.active]:bg-cyan-400/10">
                                <item.icon className="h-[16px] w-[16px] shrink-0 transition-transform group-hover:scale-110" />
                              </div>

                              {!collapsed && (
                                <>
                                  <span className="flex-1 truncate transition-transform group-hover:translate-x-0.5">
                                    {item.title}
                                  </span>
                                  {item.badge && (
                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${badgeClassNames(item.badge)}`}
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
        <div className="my-3 h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent mx-2" />

        {/* TOOLS SECTION */}
        <SidebarGroup className="gap-2">
          <SidebarGroupLabel className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            {!collapsed ? "SİSTEM" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {bottomItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="group relative flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-slate-300/85 transition-all duration-200 hover:border-slate-700 hover:bg-slate-900/80 hover:text-white"
                      activeClassName="border-cyan-400/20 bg-[linear-gradient(90deg,rgba(8,145,178,0.22),rgba(30,64,175,0.18))] text-white font-semibold shadow-lg shadow-cyan-950/40"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 transition-all duration-200 group-hover:border-slate-700 group-hover:bg-slate-800">
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
      <SidebarFooter className="border-t border-slate-800 p-3 space-y-3">
        {/* USER INFO PROFILE CARD */}
        {!collapsed && user && (
          <div className="group cursor-pointer rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-900 to-slate-800 p-3 transition-all hover:border-cyan-400/20">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold text-white shadow-lg shadow-cyan-500/30 transition-shadow group-hover:shadow-cyan-500/50">
                {user.email ? user.email.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-bold text-white">
                  {user.email?.split("@")[0]}
                </span>
                <span className="truncate text-[9px] font-medium text-slate-500">
                  {user.email}
                </span>
              </div>
              <div className="shrink-0">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM CONTROLS */}
        <div className="flex gap-2">
          <button
            onClick={toggleSidebar}
            className="group flex flex-1 items-center justify-center gap-2 rounded-lg p-2.5 text-slate-400 transition-all duration-200 hover:bg-slate-900 hover:text-white border border-transparent hover:border-slate-700"
            title={collapsed ? "Menüyü Aç" : "Menüyü Kapat"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Daralt
                </span>
              </>
            )}
          </button>

          <button
            onClick={handleSignOut}
            className="group flex items-center justify-center rounded-lg p-2.5 text-slate-400 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20"
            title="Çıkış Yap"
          >
            <LogOut className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}







