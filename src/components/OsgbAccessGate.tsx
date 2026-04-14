import { ShieldAlert } from "lucide-react";
import { useAccessRole } from "@/hooks/useAccessRole";

export function OsgbAccessGate({ children }: { children: React.ReactNode }) {
  const { loading, role } = useAccessRole();

  if (loading) {
    return <div className="container mx-auto py-6"><div className="h-64 animate-pulse rounded-3xl border border-border bg-card/70" /></div>;
  }

  if (!["admin", "inspector", "viewer", "staff"].includes(role)) {
    return (
      <div className="container mx-auto py-6">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-900 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-100">
          <div className="mb-3 flex items-center gap-3 text-xl font-semibold">
            <ShieldAlert className="h-5 w-5" />
            OSGB modülüne erişim yok
          </div>
          <p className="text-sm text-red-800/80 dark:text-red-100/80">Profil rolünüz bu modülü görüntülemek için yetkili değil.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
