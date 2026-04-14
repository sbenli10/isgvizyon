import { useMemo, useState } from "react";
import { Bell, Check, CheckCheck, Trash2, ExternalLink } from "lucide-react";
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
    { icon: string; ring: string; bg: string; text: string }
  > = {
    error: {
      icon: "🚨",
      ring: "ring-destructive/25",
      bg: "bg-destructive/10",
      text: "text-destructive",
    },
    warning: {
      icon: "⚠️",
      ring: "ring-amber-500/25 dark:ring-amber-400/25",
      bg: "bg-amber-500/10 dark:bg-amber-400/10",
      text: "text-amber-700 dark:text-amber-300",
    },
    info: {
      icon: "ℹ️",
      ring: "ring-sky-500/25 dark:ring-sky-400/25",
      bg: "bg-sky-500/10 dark:bg-sky-400/10",
      text: "text-sky-700 dark:text-sky-300",
    },
    success: {
      icon: "✅",
      ring: "ring-emerald-500/25 dark:ring-emerald-400/25",
      bg: "bg-emerald-500/10 dark:bg-emerald-400/10",
      text: "text-emerald-700 dark:text-emerald-300",
    },
  };

  const safeType = (["error", "warning", "info", "success"] as const).includes(
    type as NotificationType,
  )
    ? (type as NotificationType)
    : "info";

  const c = config[safeType];

  return (
    <div
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full text-sm",
        "ring-1",
        c.ring,
        c.bg,
        c.text,
      )}
      aria-hidden="true"
    >
      {c.icon}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "critical") {
    return (
      <Badge className="absolute right-3 top-3 border border-destructive/25 bg-destructive/10 text-destructive">
        Acil
      </Badge>
    );
  }

  if (priority === "high") {
    return (
      <Badge className="absolute right-3 top-3 border border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300">
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
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-foreground" />

          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1",
                "border border-destructive/25 bg-destructive text-destructive-foreground",
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
          "w-[400px] p-0",
          "border border-border bg-popover text-popover-foreground shadow-lg",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border bg-muted/40 p-4">
          <div>
            <DropdownMenuLabel className="p-0 text-base font-semibold text-foreground">
              Bildirimler
            </DropdownMenuLabel>

            {/* light'ta daha koyu secondary text */}
            <p className="mt-0.5 text-xs text-foreground/65 dark:text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : "Tüm bildirimler okundu"}
            </p>
          </div>

          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-8 gap-1 text-xs text-foreground hover:bg-accent"
            >
              <CheckCheck className="h-3 w-3" />
              Tümünü Okundu İşaretle
            </Button>
          )}
        </div>

        {/* Notification List */}
        <ScrollArea className="h-[400px]">
          {recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="mb-3 h-12 w-12 text-muted-foreground/60" />
              <p className="text-sm text-foreground/70 dark:text-muted-foreground">
                Henüz bildirim yok
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentNotifications.map((notification) => {
                const unread = !notification.is_read;

                return (
                  <DropdownMenuItem
                    key={notification.id}
                    // Don't let DropdownMenuItem apply its own text/focus colors.
                    className="p-0 focus:bg-transparent focus:text-inherit"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <div
                      className={cn(
                        // ✅ text-foreground sabitle: light modda beyaza düşmesin
                        "relative w-full p-4 text-foreground transition-colors",
                        "hover:bg-accent/60",
                        unread && "bg-primary/5",
                        // keyboard focus inside item
                        "focus:outline-none",
                      )}
                      onClick={() => handleNotificationClick(notification)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") handleNotificationClick(notification);
                      }}
                    >
                      {/* Unread indicator */}
                      {unread && (
                        <div className="absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary" />
                      )}

                      <div className="flex gap-3">
                        <NotificationIcon type={notification.type} />

                        <div className="min-w-0 flex-1">
                          {/* Title */}
                          <p className={cn("mb-1 line-clamp-1 text-sm font-semibold text-foreground")}>
                            {notification.title}
                          </p>

                          {/* Message - light'ta koyu, dark'ta muted */}
                          <p className="mb-2 line-clamp-2 text-xs leading-5 text-foreground/70 dark:text-muted-foreground">
                            {notification.message}
                          </p>

                          {/* Footer */}
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-foreground/60 dark:text-muted-foreground">
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
                                {notification.action_label}
                                <ExternalLink className="ml-1 h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1">
                          {unread && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground"
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
                            className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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

                      <PriorityBadge priority={notification.priority} />
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 5 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="ghost"
                className="w-full justify-center text-sm text-foreground hover:bg-accent"
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