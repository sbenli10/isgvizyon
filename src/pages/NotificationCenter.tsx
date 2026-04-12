import { useState, useMemo } from "react";
import { Bell, Filter, Check, CheckCheck, Trash2, ExternalLink, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotifications } from "@/hooks/useNotifications";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { NotificationCategory } from "@/types/notification";

const CATEGORY_CONFIG: Record<NotificationCategory, { label: string; icon: string; color: string }> = {
  risk: { label: "Risk Takibi", icon: "🎯", color: "text-red-600" },
  finding: { label: "Saha Bulguları", icon: "🔍", color: "text-orange-600" },
  plan: { label: "Plan & Prosedür", icon: "📋", color: "text-blue-600" },
  employee: { label: "Personel İşlemleri", icon: "👤", color: "text-purple-600" },
  training: { label: "Eğitim & Sertifika", icon: "🎓", color: "text-green-600" },
  legal: { label: "Yasal Terminler", icon: "⚖️", color: "text-indigo-600" },
  general: { label: "Genel", icon: "ℹ️", color: "text-slate-600" },
};

const NotificationIcon = ({ type }: { type: string }) => {
  const config = {
    error: { icon: "🚨", className: "bg-red-100 text-red-700 border-red-300" },
    warning: { icon: "⚠️", className: "bg-orange-100 text-orange-700 border-orange-300" },
    info: { icon: "ℹ️", className: "bg-blue-100 text-blue-700 border-blue-300" },
    success: { icon: "✅", className: "bg-green-100 text-green-700 border-green-300" },
  };

  const { icon, className } = config[type as keyof typeof config] || config.info;

  return (
    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-lg border-2", className)}>
      {icon}
    </div>
  );
};

export default function NotificationCenter() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  usePageDataTiming(loading);
  const [filter, setFilter] = useState<"all" | "unread" | "important">("all");
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | "all">("all");

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    let result = notifications;

    // Filter by read status
    if (filter === "unread") {
      result = result.filter(n => !n.is_read);
    } else if (filter === "important") {
      result = result.filter(n => n.priority === "high" || n.priority === "critical");
    }

    // Filter by category
    if (selectedCategory !== "all") {
      result = result.filter(n => n.category === selectedCategory);
    }

    return result;
  }, [notifications, filter, selectedCategory]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: notifications.length };
    notifications.forEach(n => {
      counts[n.category] = (counts[n.category] || 0) + 1;
    });
    return counts;
  }, [notifications]);

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            Bildirim Merkezi
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Proaktif İSG uyarıları ve görev takibi
          </p>
        </div>

        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button onClick={markAllAsRead} variant="outline" className="gap-2">
              <CheckCheck className="h-4 w-4" />
              Tümünü Okundu İşaretle
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{notifications.length}</div>
            <p className="text-xs text-muted-foreground">Toplam Bildirim</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{unreadCount}</div>
            <p className="text-xs text-muted-foreground">Okunmamış</p>
          </CardContent>
        </Card>

        <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">
              {notifications.filter(n => n.priority === "critical").length}
            </div>
            <p className="text-xs text-muted-foreground">Acil</p>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-900">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">
              {notifications.filter(n => n.priority === "high").length}
            </div>
            <p className="text-xs text-muted-foreground">Önemli</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Filtreler</CardTitle>
              <CardDescription>Bildirimleri kategoriye göre görüntüle</CardDescription>
            </div>

            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="all">Tümü</TabsTrigger>
                <TabsTrigger value="unread">
                  Okunmamış
                  {unreadCount > 0 && (
                    <Badge className="ml-2 bg-blue-600 text-white">{unreadCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="important">Önemli</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
              className="gap-2"
            >
              Tümü
              <Badge variant="secondary">{categoryCounts.all || 0}</Badge>
            </Button>

            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <Button
                key={key}
                variant={selectedCategory === key ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(key as NotificationCategory)}
                className="gap-2"
              >
                <span>{config.icon}</span>
                {config.label}
                {categoryCounts[key] > 0 && (
                  <Badge variant="secondary">{categoryCounts[key]}</Badge>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notification List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Bildirimler ({filteredNotifications.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && notifications.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900" />
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground opacity-50 mb-3" />
              <p className="text-sm text-muted-foreground">Bu filtrede bildirim bulunamadı</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md relative",
                    !notification.is_read
                      ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
                      : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-4">
                    {/* Icon */}
                    <NotificationIcon type={notification.type} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          <p className={cn(
                            "text-base font-semibold",
                            !notification.is_read && "text-foreground"
                          )}>
                            {notification.title}
                          </p>

                          {/* Category badge */}
                          <Badge variant="outline" className="text-xs">
                            {CATEGORY_CONFIG[notification.category].icon}{" "}
                            {CATEGORY_CONFIG[notification.category].label}
                          </Badge>
                        </div>

                        {/* Priority badge */}
                        {notification.priority === "critical" && (
                          <Badge className="bg-red-600 text-white">Acil</Badge>
                        )}
                        {notification.priority === "high" && (
                          <Badge className="bg-orange-600 text-white">Önemli</Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">
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

                        <div className="flex items-center gap-2">
                          {notification.action_url && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNotificationClick(notification);
                              }}
                              className="gap-2"
                            >
                              {notification.action_label}
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}

                          {!notification.is_read && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="gap-2"
                            >
                              <Check className="h-3 w-3" />
                              Okundu
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
