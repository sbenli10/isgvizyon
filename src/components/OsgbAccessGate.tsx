import { useNavigate } from "react-router-dom";
import { Building2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccessRole } from "@/hooks/useAccessRole";
import { useAuth } from "@/contexts/AuthContext";

export function OsgbAccessGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const { loading: roleLoading, role } = useAccessRole();

  if (authLoading || roleLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="h-64 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/70" />
      </div>
    );
  }

  if (!profile?.organization_id) {
    return (
      <div className="container mx-auto py-6">
        <Card className="border-cyan-500/20 bg-cyan-500/10 text-cyan-50">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3 text-xl font-semibold">
              <Building2 className="h-5 w-5" />
              Organizasyon Kaydı Gerekli
            </div>
            <p className="text-sm leading-6 text-cyan-100/90">
              OSGB modülünü aktifleştirmek için bir kurum kaydı oluşturmanız gerekmektedir.
            </p>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() =>
                navigate(
                  `/profile?tab=workspace&action=create&next=${encodeURIComponent("/settings?tab=billing&upgrade=1")}`,
                )
              }
              className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            >
              Şimdi Organizasyon Oluştur
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!["admin", "inspector", "viewer", "staff"].includes(role)) {
    return (
      <div className="container mx-auto py-6">
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-100">
          <div className="mb-3 flex items-center gap-3 text-xl font-semibold">
            <ShieldAlert className="h-5 w-5" />
            OSGB modülüne erişim yok
          </div>
          <p className="text-sm text-red-100/80">Profil rolünüz bu modülü görüntülemek için yetkili değil.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
