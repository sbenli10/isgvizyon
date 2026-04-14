import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/NotificationBell";
import { LogOut, User, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const getUserInitials = () => {
    if (!user?.email) return "U";
    return user.email.substring(0, 2).toUpperCase();
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />

        <main className="flex flex-1 flex-col overflow-hidden">
          <header className="flex items-center justify-between gap-4 border-b border-border/70 bg-card/80 px-4 py-3 backdrop-blur-xl lg:px-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="lg:hidden" />
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-sm">
                  <span className="text-sm font-bold text-primary-foreground">D</span>
                </div>
                <span className="hidden text-sm font-semibold text-foreground sm:inline">
                  İSGVİZYON
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <NotificationBell />
              <ThemeToggle />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.email} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user?.user_metadata?.full_name || "Kullanıcı"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="mr-2 h-4 w-4" />
                    Profil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Ayarlar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Çıkış Yap
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div className="flex-1 overflow-auto bg-background">
            <div className="container max-w-screen-2xl px-4 pt-4 lg:px-6 lg:pt-6">
              <SubscriptionBanner />
            </div>
            <div className="container max-w-screen-2xl p-4 pt-3 lg:p-6 lg:pt-4">{children}</div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
