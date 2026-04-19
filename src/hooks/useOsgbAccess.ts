import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type OsgbAccessRole =
  | "owner"
  | "admin"
  | "operations_manager"
  | "secretary"
  | "finance"
  | "coordinator"
  | "staff"
  | "viewer";

const normalizeRole = (role?: string | null): OsgbAccessRole => {
  const value = (role || "").trim().toLowerCase();
  if (["owner", "admin", "operations_manager", "secretary", "finance", "coordinator"].includes(value)) {
    return value as OsgbAccessRole;
  }
  if (value === "staff" || value === "inspector") return "operations_manager";
  return "viewer";
};

export function useOsgbAccess() {
  const { profile } = useAuth();
  const role = normalizeRole(profile?.role);

  return useMemo(() => {
    const canManageOperations = ["owner", "admin", "operations_manager", "coordinator"].includes(role);
    const canManagePeople = ["owner", "admin", "operations_manager"].includes(role);
    const canManageFinance = ["owner", "admin", "finance", "operations_manager"].includes(role);
    const canManageDocuments = ["owner", "admin", "operations_manager", "secretary"].includes(role);
    const canManagePortal = ["owner", "admin", "operations_manager", "secretary"].includes(role);
    const canManageAutomation = ["owner", "admin", "operations_manager", "secretary", "finance"].includes(role);
    const canViewDashboard = role !== "viewer";
    const canViewCompanyHub = ["owner", "admin", "operations_manager", "secretary", "finance", "coordinator"].includes(role);
    const canViewPeople = ["owner", "admin", "operations_manager", "coordinator"].includes(role);
    const canViewDocuments = ["owner", "admin", "operations_manager", "secretary", "finance", "coordinator"].includes(role);
    const canViewFinance = ["owner", "admin", "operations_manager", "finance"].includes(role);
    const canViewAutomation = ["owner", "admin", "operations_manager", "secretary", "finance", "coordinator"].includes(role);
    const canViewPortal = ["owner", "admin", "operations_manager", "secretary", "finance", "coordinator"].includes(role);
    const canViewAnalytics = ["owner", "admin", "operations_manager", "finance", "coordinator"].includes(role);
    const canViewKatip = role !== "viewer";

    return {
      role,
      roleLabel:
        role === "owner"
          ? "OSGB Sahibi"
          : role === "admin"
            ? "Yönetici"
            : role === "operations_manager"
              ? "Operasyon Sorumlusu"
              : role === "secretary"
                ? "Sekreterya"
                : role === "finance"
                  ? "Muhasebe"
                  : role === "coordinator"
                    ? "Koordinatör"
                    : role === "staff"
                      ? "Personel"
                      : "Görüntüleyici",
      canManageOperations,
      canManagePeople,
      canManageFinance,
      canManageDocuments,
      canManagePortal,
      canManageAutomation,
      canViewDashboard,
      canViewCompanyHub,
      canViewPeople,
      canViewDocuments,
      canViewFinance,
      canViewAutomation,
      canViewPortal,
      canViewAnalytics,
      canViewKatip,
      isReadOnly: role === "viewer",
    };
  }, [role]);
}
