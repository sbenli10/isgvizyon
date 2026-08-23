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

export type WorkspaceOrganizationInput = {
  name?: string;
  industry?: string;
  city?: string;
  phone?: string;
  website?: string;
};

export function useCreateWorkspaceOrganization() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const createWorkspaceOrganization = useCallback(
    async (nextPath?: string, input?: WorkspaceOrganizationInput) => {
      if (!user?.id) {
        toast.error("Organizasyon oluşturmak için giriş yapmalısınız.");
        return null;
      }

      setCreating(true);
      try {
        const { data, error } = await (supabase as any).rpc("create_workspace_organization", {
          p_name: input?.name?.trim() || getDefaultOrganizationName(user.email, user.user_metadata?.full_name),
          p_industry: input?.industry?.trim() || null,
          p_city: input?.city?.trim() || null,
          p_phone: input?.phone?.trim() || null,
          p_website: input?.website?.trim() || null,
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
