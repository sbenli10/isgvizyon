import { useCallback, useEffect, useState } from "react";
import {
  listOsgbWorkspaceCompanies,
  type OsgbWorkspaceCompanyOption,
} from "@/lib/osgbPlatform";

export const useOsgbManagedCompanies = (organizationId: string | null) => {
  const [companies, setCompanies] = useState<OsgbWorkspaceCompanyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!organizationId) {
      setCompanies([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const rows = await listOsgbWorkspaceCompanies(organizationId);
      setCompanies(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Firma havuzu yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    companies,
    loading,
    error,
    reload,
  };
};
