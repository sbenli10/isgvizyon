import { useMemo, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Info,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";

type NotificationType = "error" | "warning" | "info" | "success";

function NotificationIcon({ type }: { type: string }) {
  const config: Record<
    NotificationType,
    {
      icon: React.ComponentType<{ className?: string }>;
      shell: string;
      iconClass: string;
    }
  > = {
    error: {
      icon: Siren,
      shell: "border-destructive/20 bg-destructive/10",
      iconClass: "text-destructive",
    },
    warning: {
      icon: AlertTriangle,
      shell: "border-amber-500/20 bg-amber-500/10 dark:border-amber-400/20 dark:bg-amber-400/10",
      iconClass: "text-amber-700 dark:text-amber-300",
    },
    info: {
      icon: Info,
      shell: "border-sky-500/20 bg-sky-500/10 dark:border-sky-400/20 dark:bg-sky-400/10",
      iconClass: "text-sky-700 dark:text-sky-300",
    },
    success: {
      icon: ShieldCheck,
      shell: "border-emerald-500/20 bg-emerald-500/10 dark:border-emerald-400/20 dark:bg-emerald-400/10",
      iconClass: "text-emerald-700 dark:text-emerald-300",
    },
  };

  const safeType = (["error", "warning", "info", "success"] as const).includes(
    type as NotificationType,
  )
    ? (type as NotificationType)
    : "info";

  const item = config[safeType];
  const Icon = item.icon;

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-sm",
        item.shell,
      )}
      aria-hidden="true"
    >
      <Icon className={cn("h-4 w-4", item.iconClass)} />
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "critical") {
    return (
      <Badge className="border border-destructive/20 bg-destructive/10 text-destructive shadow-none">
        Acil
      </Badge>
    );
  }

  if (priority === "high") {
    return (
      <Badge className="border border-amber-500/20 bg-amber-500/10 text-amber-700 shadow-none dark:text-amber-300">
        Önemli
      </Badge>
    );
  }

  return null;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications();

  const [open, setOpen] = useState(false);

  const recentNotifications = useMemo(() => notifications.slice(0, 5), [notifications]);

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    if (notification.action_url) {
      navigate(notification.action_url);
      setOpen(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-2xl border border-border/70 bg-background/80 text-foreground shadow-sm transition hover:bg-accent/60"
        >
          <Bell className="h-4.5 w-4.5 text-foreground" />

          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1",
                "border border-destructive/20 bg-destructive text-destructive-foreground shadow-sm",
                "text-[10px] font-bold leading-none",
              )}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className={cn(
          "w-[420px] rounded-[24px] border border-border/70 bg-background/96 p-0 text-popover-foreground shadow-[0_28px_80px_-34px_rgba(15,23,42,0.45)] backdrop-blur-2xl",
          "max-sm:w-[calc(100vw-2rem)]",
        )}
      >
        <div className="border-b border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.58),rgba(255,255,255,0.20))] p-4 dark:bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.78),rgba(15,23,42,0.46))]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DropdownMenuLabel className="p-0 text-base font-semibold text-foreground">
                Bildirim Merkezi
              </DropdownMenuLabel>
              <p className="mt-1 text-xs text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} okunmamış bildirim var`
                  : "Tüm bildirimler kontrol edildi"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-full border border-primary/15 bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-foreground/80">
                {notifications.length} kayıt
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="h-8 rounded-xl border border-border/60 bg-background/70 px-3 text-xs text-foreground shadow-sm hover:bg-accent/70"
                >
                  <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                  Tümünü oku
                </Button>
              )}
            </div>
          </div>
        </div>

        <ScrollArea className="h-[420px]">
          {recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-border/70 bg-muted/40 shadow-sm">
                <Bell className="h-7 w-7 text-muted-foreground/70" />
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">Henüz bildirim yok</p>
              <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                Yeni görev, uyarı ve operasyon hareketleri burada görünecek.
              </p>
            </div>
          ) : (
            <div className="space-y-3 p-3">
              {recentNotifications.map((notification) => {
                const unread = !notification.is_read;

                return (
                  <DropdownMenuItem
                    key={notification.id}
                    className="rounded-[22px] p-0 focus:bg-transparent focus:text-inherit"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <div
                      className={cn(
                        "relative w-full rounded-[22px] border border-border/70 bg-background/72 p-4 text-foreground shadow-sm transition",
                        "hover:bg-accent/35",
                        unread && "border-primary/20 bg-primary/5 shadow-[0_16px_38px_-32px_hsl(var(--primary)/0.85)]",
                      )}
                      onClick={() => handleNotificationClick(notification)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          handleNotificationClick(notification);
                        }
                      }}
                    >
                      {unread && (
                        <div className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.14)]" />
                      )}

                      <div className="flex items-start gap-3">
                        <NotificationIcon type={notification.type} />

                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-start justify-between gap-3 pr-4">
                            <p className="line-clamp-1 text-sm font-semibold text-foreground">
                              {notification.title}
                            </p>
                            <PriorityBadge priority={notification.priority} />
                          </div>

                          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {notification.message}
                          </p>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.created_at), {
                                addSuffix: true,
                                locale: tr,
                              })}
                            </span>

                            {notification.action_url && (
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs text-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNotificationClick(notification);
                                }}
                              >
                                {notification.action_label || "Detaya git"}
                                <ExternalLink className="ml-1 h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col gap-1">
                          {unread && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              title="Okundu işaretle"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            title="Sil"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 5 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-3">
              <Button
                variant="ghost"
                className="h-10 w-full justify-center rounded-2xl border border-border/60 bg-background/70 text-sm text-foreground shadow-sm hover:bg-accent/60"
                onClick={() => {
                  navigate("/notifications");
                  setOpen(false);
                }}
              >
                Tüm Bildirimleri Görüntüle
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
