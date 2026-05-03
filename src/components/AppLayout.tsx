import { AppSidebar } from "@/components/AppSidebar";
import NotificationBell from "@/components/NotificationBell";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";
import { ChevronRight, LogOut, Settings, ShieldCheck, Sparkles, User } from "lucide-react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const routeMeta = [
  { match: "/companies", label: "Firma Yönetimi", section: "Operasyon" },
  { match: "/employees", label: "Çalışan Yönetimi", section: "Operasyon" },
  { match: "/capa", label: "DÖF Yönetimi", section: "Risk ve Güvenlik" },
  { match: "/risk", label: "Risk Yönetimi", section: "Risk ve Güvenlik" },
  { match: "/adep", label: "Acil Durum Planları", section: "Planlama" },
  { match: "/reports", label: "Rapor Merkezi", section: "Dokümantasyon" },
  { match: "/osgb", label: "OSGB Operasyon", section: "Kurumsal Yönetim" },
  { match: "/settings", label: "Ayarlar", section: "Sistem" },
  { match: "/profile", label: "Profil", section: "Hesap" },
];

const DESKTOP_SIDEBAR_WIDTH = "18rem";
const DESKTOP_SIDEBAR_COLLAPSED_WIDTH = "5.5rem";
const NAVBAR_HEIGHT = "5.25rem";

function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const { state } = useSidebar();
  const { user, signOut } = useAuth();
  const { plan, status } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const getUserInitials = () => {
    if (!user?.email) return "U";
    return user.email.substring(0, 2).toUpperCase();
  };

  const activeMeta =
    routeMeta.find((item) => location.pathname.startsWith(item.match)) ?? {
      label: "Operasyon Merkezi",
      section: "İSGVizyon",
    };

  const userDisplayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Kullanıcı";
  const isPremiumMember = plan === "premium" && status !== "past_due";
  const isCollapsed = state === "collapsed";
  const desktopOffset = isCollapsed ? DESKTOP_SIDEBAR_COLLAPSED_WIDTH : DESKTOP_SIDEBAR_WIDTH;

  useEffect(() => {
    console.log("AppLayoutShell MOUNTED", {
      pathname: location.pathname,
    });

    return () => {
      console.log("AppLayoutShell UNMOUNTED", {
        pathname: location.pathname,
      });
    };
  }, []);

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_24%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_22%),hsl(var(--background))]">
      <AppSidebar />

      <div
        className={cn("relative min-h-screen transition-[padding] duration-200 ease-linear", "md:pl-0")}
        style={{ paddingLeft: 0 }}
      >
        <div
          className="relative z-0 hidden md:block"
          style={{
            paddingLeft: desktopOffset,
          }}
        >
          <header
            className="fixed right-0 top-0 z-50 border-b border-border/60 bg-background/78 px-4 py-3 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.22)] backdrop-blur-2xl lg:px-6"
            style={{
              left: desktopOffset,
              height: NAVBAR_HEIGHT,
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.10),transparent_24%)]" />
            <div className="relative flex h-full items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.22),rgba(255,255,255,0.92))] shadow-[0_16px_38px_-24px_hsl(var(--primary)/0.85)] dark:bg-[linear-gradient(135deg,hsl(var(--primary)/0.28),rgba(15,23,42,0.96))]">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-cyan-400 to-indigo-500 text-primary-foreground shadow-sm">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <span>İSGVİZYON</span>
                      <ChevronRight className="h-3 w-3" />
                      <span className="truncate">{activeMeta.section}</span>
                    </div>
                    <div className="truncate text-lg font-semibold tracking-tight text-foreground">
                      {activeMeta.label}
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden items-center gap-2 xl:flex">
                <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Sistem hazır
                </div>
                {isPremiumMember && (
                  <div className="flex items-center gap-2 rounded-full border border-amber-500/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(251,191,36,0.08))] px-3 py-2 text-xs font-semibold text-amber-800 shadow-sm dark:text-amber-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    Premium aktif
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-2 text-xs font-medium text-foreground/80">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Yeni nesil operasyon arayüzü
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 rounded-2xl border border-border/70 bg-background/80 px-3 py-2 shadow-sm md:flex">
                  <NotificationBell />
                  <ThemeToggle />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-auto rounded-2xl border border-border/70 bg-background/82 px-2 py-2 shadow-sm transition hover:bg-accent/60"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 ring-2 ring-primary/15">
                          <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.email} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {getUserInitials()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="hidden text-left sm:block">
                          <div className="max-w-[10rem] truncate text-sm font-semibold text-foreground">
                            {userDisplayName}
                          </div>
                          <div className="text-[11px] text-muted-foreground">Hesap ve tercihler</div>
                        </div>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 rounded-2xl border border-border/70 p-2" align="end">
                    <DropdownMenuLabel className="rounded-xl bg-muted/40 px-3 py-3 font-normal">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.email} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {getUserInitials()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold leading-none text-foreground">
                            {userDisplayName}
                          </p>
                          <p className="mt-1 truncate text-xs leading-none text-muted-foreground">
                            {user?.email}
                          </p>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/profile")} className="rounded-xl">
                      <User className="mr-2 h-4 w-4" />
                      Profil
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/settings")} className="rounded-xl">
                      <Settings className="mr-2 h-4 w-4" />
                      Ayarlar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="rounded-xl text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Çıkış Yap
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <main
            className="relative z-0 min-h-screen bg-transparent"
            style={{
              paddingTop: NAVBAR_HEIGHT,
            }}
          >
            <div className="relative z-0 container max-w-screen-2xl px-4 pt-4 lg:px-6 lg:pt-6">
              <div className="relative z-0 rounded-[30px] border border-border/60 bg-background/58 p-3 shadow-[0_26px_90px_-48px_rgba(15,23,42,0.24)] backdrop-blur-2xl lg:p-4">
                <SubscriptionBanner />
              </div>
            </div>
            <div className="relative z-0 container max-w-screen-2xl p-4 pt-3 lg:p-6 lg:pt-4">
              <div className="relative z-0 rounded-[30px] border border-border/50 bg-background/38 px-1 py-1 shadow-[0_26px_90px_-48px_rgba(15,23,42,0.22)] backdrop-blur-xl lg:px-2 lg:py-2">
                {children}
              </div>
            </div>
          </main>
        </div>

        <div className="relative z-0 md:hidden">
          <header className="sticky top-0 z-50 border-b border-border/60 bg-background/78 px-4 py-3 backdrop-blur-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.10),transparent_24%)]" />
            <div className="relative flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <SidebarTrigger className="h-10 w-10 rounded-2xl border border-border/70 bg-background/80 text-foreground shadow-sm hover:bg-accent" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <span>İSGVİZYON</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="truncate">{activeMeta.section}</span>
                  </div>
                  <div className="truncate text-lg font-semibold tracking-tight text-foreground">
                    {activeMeta.label}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <NotificationBell />
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main className="relative z-0 min-h-screen bg-transparent">
            <div className="relative z-0 container max-w-screen-2xl px-4 pt-4">
              <div className="relative z-0 rounded-[30px] border border-border/60 bg-background/58 p-3 shadow-[0_26px_90px_-48px_rgba(15,23,42,0.24)] backdrop-blur-2xl">
                <SubscriptionBanner />
              </div>
            </div>
            <div className="relative z-0 container max-w-screen-2xl p-4 pt-3">
              <div className="relative z-0 rounded-[30px] border border-border/50 bg-background/38 px-1 py-1 shadow-[0_26px_90px_-48px_rgba(15,23,42,0.22)] backdrop-blur-xl">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    console.log("AppLayout MOUNTED");
    return () => {
      console.log("AppLayout UNMOUNTED");
    };
  }, []);

  return (
    <SidebarProvider>
      <AppLayoutShell>{children}</AppLayoutShell>
    </SidebarProvider>
  );
}
