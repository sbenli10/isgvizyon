import { Bell, TrendingUp, AlertTriangle, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

export default function NotificationWidget() {
  const navigate = useNavigate();
  const { notifications, unreadCount } = useNotifications();

  const criticalNotifications = notifications
    .filter((notification) => !notification.is_read && (notification.priority === "critical" || notification.priority === "high"))
    .slice(0, 3);

  return (
    <div className="rounded-[24px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
            <Radar className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Control Feed</p>
            <p className="mt-1 text-lg font-semibold text-white">Acil Bildirimler</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-slate-200">
            <Bell className="mr-2 h-3.5 w-3.5" />
            {unreadCount} okunmamış
          </Badge>
          {unreadCount > 0 && (
            <Badge className="border-red-500/20 bg-red-500/15 text-red-100">
              {unreadCount} yeni
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {criticalNotifications.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] py-8 text-center text-sm text-slate-400">
            Kritik veya yüksek öncelikli açık bildirim görünmüyor.
          </div>
        ) : (
          <>
            {criticalNotifications.map((notification, index) => (
              <div
                key={notification.id}
                className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.035] p-4 transition-all hover:border-cyan-400/20 hover:bg-white/[0.05] cursor-pointer"
                onClick={() => navigate(notification.action_url || "/notifications")}
              >
                <div className="absolute inset-y-4 left-0 w-px bg-gradient-to-b from-cyan-400/0 via-cyan-400/40 to-cyan-400/0" />
                <div className="flex items-start gap-3 pl-3">
                  <div className="mt-0.5 rounded-full border border-white/10 bg-slate-950 p-1.5">
                    <span
                      className={`block h-2 w-2 rounded-full ${notification.priority === "critical" ? "bg-red-400" : "bg-orange-400"}`}
                    />
                  </div>

                  {notification.priority === "critical" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-red-500" />
                  ) : (
                    <TrendingUp className="mt-0.5 h-4 w-4 text-orange-500" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        Sinyal {String(index + 1).padStart(2, "0")}
                      </p>
                      <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-[10px] text-slate-300">
                        {notification.priority === "critical" ? "Kritik" : "Yüksek"}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-1 text-sm font-semibold text-white">{notification.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">{notification.message}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: tr,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              className="mt-3 w-full border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
              onClick={() => navigate("/notifications")}
            >
              Tüm Bildirimleri Görüntüle
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
