import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

function getDefaultOrganizationName(userEmail?: string | null, fullName?: string | null) {
  const displayName = fullName?.trim() || userEmail?.split("@")[0]?.trim();

  if (displayName) {
    return `${displayName} Çalışma Alanı`;
  }

  return "İSGVizyon Çalışma Alanı";
}

export function useCreateWorkspaceOrganization() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const createWorkspaceOrganization = useCallback(
    async (nextPath?: string) => {
      if (!user?.id) {
        toast.error("Organizasyon oluşturmak için giriş yapmalısınız.");
        return null;
      }

      setCreating(true);
      try {
        const { data, error } = await (supabase as any).rpc("create_workspace_organization", {
          p_name: getDefaultOrganizationName(user.email, user.user_metadata?.full_name),
          p_industry: null,
          p_city: null,
          p_phone: null,
          p_website: null,
        });

        if (error) throw error;

        await refreshProfile();
        toast.success("Organizasyon çalışma alanınız oluşturuldu.");

        if (nextPath) {
          navigate(nextPath);
        }

        return (data ?? null) as string | null;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Organizasyon oluşturulamadı.";
        toast.error(message);
        return null;
      } finally {
        setCreating(false);
      }
    },
    [navigate, refreshProfile, user],
  );

  return {
    creating,
    createWorkspaceOrganization,
  };
}
