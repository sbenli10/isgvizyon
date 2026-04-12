import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppAccessRole = "admin" | "inspector" | "viewer" | "staff";

const rank: Record<AppAccessRole, number> = {
  viewer: 0,
  staff: 1,
  inspector: 2,
  admin: 3,
};

export function useAccessRole() {
  const { user, profile } = useAuth();
  const [role, setRole] = useState<AppAccessRole>("viewer");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!user?.id) {
        if (active) {
          setRole("viewer");
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const [{ data: userRoles }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", user.id),
        ]);

        const candidates = [
          profile?.role,
          ...(userRoles ?? []).map((item) => item.role),
        ].filter(Boolean) as string[];

        const normalized = candidates.reduce<AppAccessRole>((current, value) => {
          const lower = value.toLowerCase() as AppAccessRole;
          if (!(lower in rank)) return current;
          return rank[lower] > rank[current] ? lower : current;
        }, "viewer");

        if (active) {
          setRole(normalized);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [profile?.role, user?.id]);

  return useMemo(
    () => ({
      role,
      loading,
      canManage: role === "admin" || role === "inspector" || role === "staff",
      isViewer: role === "viewer",
    }),
    [loading, role],
  );
}
