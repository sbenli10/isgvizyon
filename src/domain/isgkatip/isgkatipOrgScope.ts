import { supabase } from "@/integrations/supabase/client";

export interface IsgkatipOrgScope {
  userId: string;
  organizationId: string;
}

const ORG_SCOPE_ERROR =
  "Organizasyon bilgisi bulunamadı. Lütfen profilinize bir organizasyon atayın.";

export const getIsgkatipOrgScope = async (params?: {
  userId?: string;
  organizationId?: string;
}): Promise<IsgkatipOrgScope> => {
  const userId = params?.userId
    ? params.userId
    : (await supabase.auth.getUser()).data.user?.id;

  if (!userId) {
    throw new Error("Kullanıcı oturumu bulunamadı.");
  }

  if (params?.organizationId) {
    return {
      userId,
      organizationId: params.organizationId,
    };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;

  if (!profile?.organization_id) {
    throw new Error(ORG_SCOPE_ERROR);
  }

  return {
    userId,
    organizationId: profile.organization_id,
  };
};

