import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Notification } from "@/types/notification";
import { toast } from "sonner";
import { readPageSessionCache, writePageSessionCache } from "@/lib/pageSessionCache";

type NotificationState = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
};

type Listener = (state: NotificationState) => void;

const STALE_MS = 60 * 1000;
const getNotificationsCacheKey = (userId: string) => `notifications:${userId}`;

const emptyState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  loading: true,
};

const store = {
  userId: null as string | null,
  state: emptyState,
  listeners: new Set<Listener>(),
  channel: null as ReturnType<typeof supabase.channel> | null,
  fetchPromise: null as Promise<void> | null,
  lastFetchedAt: 0,
};

const mapNotifications = (items: any[]): Notification[] =>
  items.map((item) => ({
    ...item,
    type: item.type as Notification["type"],
    category: item.category as Notification["category"],
    priority: item.priority as Notification["priority"],
    metadata: item.metadata as Record<string, any>,
  }));

const emit = () => {
  for (const listener of store.listeners) {
    listener(store.state);
  }
};

const setState = (next: NotificationState) => {
  store.state = next;
  emit();
};

const patchState = (patch: Partial<NotificationState>) => {
  setState({ ...store.state, ...patch });
};

const resetStore = () => {
  if (store.channel) {
    supabase.removeChannel(store.channel);
    store.channel = null;
  }

  store.userId = null;
  store.fetchPromise = null;
  store.lastFetchedAt = 0;
  setState(emptyState);
};

const fetchNotifications = async (userId: string, force = false) => {
  const isFresh =
    store.userId === userId && Date.now() - store.lastFetchedAt < STALE_MS;
  if (!force && isFresh && store.state.notifications.length > 0) {
    return;
  }

  if (store.fetchPromise) {
    return store.fetchPromise;
  }

  store.userId = userId;
  patchState({ loading: true });

  store.fetchPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .or("expires_at.is.null,expires_at.gt.now()")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const notifications = mapNotifications(data || []);
      store.lastFetchedAt = Date.now();
      writePageSessionCache(getNotificationsCacheKey(userId), notifications);
      setState({
        notifications,
        unreadCount: notifications.filter((item) => !item.is_read).length,
        loading: false,
      });
    } catch (error) {
      console.error("Fetch notifications error:", error);
      patchState({ loading: false });
    } finally {
      store.fetchPromise = null;
    }
  })();

  return store.fetchPromise;
};

const ensureRealtime = (userId: string) => {
  if (store.channel && store.userId === userId) {
    return;
  }

  if (store.channel) {
    supabase.removeChannel(store.channel);
    store.channel = null;
  }

  store.userId = userId;
  store.channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const newNotification = mapNotifications([payload.new])[0];
        const notifications = [newNotification, ...store.state.notifications].slice(
          0,
          50,
        );

        setState({
          notifications,
          unreadCount: notifications.filter((item) => !item.is_read).length,
          loading: false,
        });

        toast.info(newNotification.title, {
          description: newNotification.message,
        });
      },
    )
    .subscribe();
};

export const useNotifications = () => {
  const { user } = useAuth();
  const [state, setLocalState] = useState<NotificationState>(store.state);

  useEffect(() => {
    store.listeners.add(setLocalState);
    setLocalState(store.state);

    return () => {
      store.listeners.delete(setLocalState);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      resetStore();
      return;
    }

    const cached = readPageSessionCache<Notification[]>(
      getNotificationsCacheKey(user.id),
      STALE_MS,
    );
    if (cached && cached.length > 0) {
      setState({
        notifications: cached,
        unreadCount: cached.filter((item) => !item.is_read).length,
        loading: false,
      });
    }

    ensureRealtime(user.id);
    void fetchNotifications(user.id);
  }, [user?.id]);

  const markAsRead = async (notificationId: string) => {
    try {
      const timestamp = new Date().toISOString();
      const { error } = await supabase
        .from("notifications")
        .update({
          is_read: true,
          read_at: timestamp,
        })
        .eq("id", notificationId);

      if (error) throw error;

      const notifications = store.state.notifications.map((notification) =>
        notification.id === notificationId
          ? { ...notification, is_read: true, read_at: timestamp }
          : notification,
      );

      setState({
        notifications,
        unreadCount: notifications.filter((item) => !item.is_read).length,
        loading: false,
      });
    } catch (error) {
      console.error("Mark as read error:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      const timestamp = new Date().toISOString();
      const { error } = await supabase
        .from("notifications")
        .update({
          is_read: true,
          read_at: timestamp,
        })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;

      const notifications = store.state.notifications.map((notification) => ({
        ...notification,
        is_read: true,
        read_at: timestamp,
      }));

      setState({ notifications, unreadCount: 0, loading: false });
      toast.success("Tum bildirimler okundu olarak isaretlendi");
    } catch (error) {
      console.error("Mark all as read error:", error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);

      if (error) throw error;

      const notifications = store.state.notifications.filter(
        (notification) => notification.id !== notificationId,
      );

      setState({
        notifications,
        unreadCount: notifications.filter((item) => !item.is_read).length,
        loading: false,
      });
      toast.success("Bildirim silindi");
    } catch (error) {
      console.error("Delete notification error:", error);
    }
  };

  const refresh = async () => {
    if (!user?.id) return;
    await fetchNotifications(user.id, true);
  };

  return {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    loading: state.loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
  };
};
