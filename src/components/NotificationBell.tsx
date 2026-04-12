import { useState } from "react";
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

const NotificationIcon = ({ type }: { type: string }) => {
  const config = {
    error: { icon: "🚨", className: "bg-red-100 text-red-700 border-red-300" },
    warning: { icon: "⚠️", className: "bg-orange-100 text-orange-700 border-orange-300" },
    info: { icon: "ℹ️", className: "bg-blue-100 text-blue-700 border-blue-300" },
    success: { icon: "✅", className: "bg-green-100 text-green-700 border-green-300" },
  };

  const { icon, className } = config[type as keyof typeof config] || config.info;

  return (
    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm border-2", className)}>
      {icon}
    </div>
  );
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [open, setOpen] = useState(false);

  const recentNotifications = notifications.slice(0, 5);

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
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600 hover:bg-red-700 text-white text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[400px] p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-slate-50 dark:bg-slate-900">
          <div>
            <DropdownMenuLabel className="p-0 font-bold text-base">
              Bildirimler
            </DropdownMenuLabel>
            <p className="text-xs text-muted-foreground mt-0.5">
              {unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : "Tüm bildirimler okundu"}
            </p>
          </div>

          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-8 text-xs gap-1"
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
              <Bell className="h-12 w-12 text-muted-foreground opacity-50 mb-3" />
              <p className="text-sm text-muted-foreground">Henüz bildirim yok</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer relative",
                    !notification.is_read && "bg-blue-50/50 dark:bg-blue-950/20"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* Unread indicator */}
                  {!notification.is_read && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-600 rounded-full" />
                  )}

                  <div className="flex gap-3">
                    <NotificationIcon type={notification.type} />

                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <p className={cn(
                        "text-sm font-semibold mb-1 line-clamp-1",
                        !notification.is_read && "text-foreground"
                      )}>
                        {notification.title}
                      </p>

                      {/* Message */}
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {notification.message}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center justify-between">
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
                            className="h-auto p-0 text-xs gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotificationClick(notification);
                            }}
                          >
                            {notification.action_label}
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1">
                      {!notification.is_read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          title="Okundu işaretle"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        title="Sil"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Priority badge */}
                  {notification.priority === 'critical' && (
                    <Badge className="absolute top-2 right-2 bg-red-600 text-white text-xs">
                      Acil
                    </Badge>
                  )}
                  {notification.priority === 'high' && (
                    <Badge className="absolute top-2 right-2 bg-orange-600 text-white text-xs">
                      Önemli
                    </Badge>
                  )}
                </div>
              ))}
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
                className="w-full justify-center text-sm"
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