import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface WorkspaceOption {
  workspace_id: string | null;
  workspace_name: string;
  workspace_type: "personal" | "owned_organization" | "joined_organization";
  role: string;
  is_active: boolean;
  is_current: boolean;
}

export function useWorkspaces() {
  const { user, refreshProfile } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    if (!user?.id) {
      setWorkspaces([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("list_my_workspaces");
      if (error) throw error;
      setWorkspaces((data ?? []) as WorkspaceOption[]);
    } catch (error) {
      console.error("Workspace list failed:", error);
      setWorkspaces([
        {
          workspace_id: null,
          workspace_name: "Kişisel Hesabım",
          workspace_type: "personal",
          role: "owner",
          is_active: true,
          is_current: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  const switchWorkspace = useCallback(
    async (workspaceId: string | null) => {
      if (!user?.id) return;

      setSwitching(true);
      try {
        const { error } = await (supabase as any).rpc("switch_workspace", {
          p_organization_id: workspaceId,
        });
        if (error) throw error;

        await refreshProfile();
        await loadWorkspaces();
        toast.success(workspaceId ? "Kurumsal çalışma alanına geçildi" : "Kişisel hesaba geçildi");
      } catch (error: any) {
        console.error("Workspace switch failed:", error);
        toast.error(error?.message || "Çalışma alanı değiştirilemedi");
      } finally {
        setSwitching(false);
      }
    },
    [loadWorkspaces, refreshProfile, user?.id],
  );

  const currentWorkspace = workspaces.find((workspace) => workspace.is_current) ?? workspaces[0] ?? null;

  return {
    workspaces,
    currentWorkspace,
    loading,
    switching,
    reload: loadWorkspaces,
    switchWorkspace,
  };
}
