import { useNavigate } from "react-router-dom";
import { Building2, CircleHelp, Crown, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { OrganizationCreateButton } from "@/components/OrganizationCreateButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccessRole } from "@/hooks/useAccessRole";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";

const organizationInfoItems = [
  {
    icon: CircleHelp,
    title: "Benim şirketim yok, yine de oluşturmalı mıyım?",
    text: "Evet. Bağımsız uzman da olsanız, OSGB kurumu da olsanız platformda işlem yapmak için kendinize ait bir Dijital Ofis kurmalısınız. Örn: Ahmet Yılmaz İSG Ofisi.",
  },
  {
    icon: Users,
    title: "Bu adım ne işe yarar?",
    text: "Yönettiğiniz firmaları, çalışan kadronuzu, yasal evraklarınızı ve yapay zeka analizlerinizi tek bir çatı altında güvenle saklar.",
  },
  {
    icon: ShieldCheck,
    title: "Neden zorunlu?",
    text: "KVKK gereği hassas sağlık ve güvenlik verilerinin size özel kalması ve başka kullanıcı verileriyle karışmaması için korumalı bir çalışma alanı gerekir.",
  },
];

function OrganizationInfoCard() {
  return (
    <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <CircleHelp className="h-4 w-4 stroke-[1.8] text-cyan-200" />
        Organizasyon (Çalışma Alanı) Nedir?
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {organizationInfoItems.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-300/15">
                <Icon className="h-4 w-4 stroke-[1.8]" />
              </div>
              <p className="text-sm font-semibold leading-5 text-white">{item.title}</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">{item.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OsgbAccessGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const { loading: roleLoading, role } = useAccessRole();
  const { loading: planLoading, canAccessOsgb, isOsgbActive, isDemoActive, hasAccess } = usePlanLimits();
  const osgbAccess = hasAccess("osgb_module");
  const hasOsgbAccess = canAccessOsgb || isOsgbActive || isDemoActive || osgbAccess.allowed;

  if (authLoading || roleLoading || planLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="h-64 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/70" />
      </div>
    );
  }

  if (!hasOsgbAccess) {
    return (
      <div className="container mx-auto py-6">
        <Card className="overflow-hidden border-amber-500/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(15,23,42,0.92))] text-white shadow-[0_24px_70px_rgba(245,158,11,0.12)]">
          <CardHeader className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/20">
              <Crown className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">OSGB Modülü Kurumsal Paket Gerektirir</CardTitle>
            <p className="max-w-3xl text-sm leading-6 text-amber-50/85">
              Bu alan çoklu firma, görevlendirme, kapasite, finans ve İSG-KATİP operasyonları için tasarlanmıştır.
              OSGB modülünü kullanmak için OSGB paketine yükseltmeniz veya aktif bir demo başlatmanız gerekir.
            </p>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate("/settings?tab=billing&upgrade=1")}
              className="bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:from-amber-300 hover:to-orange-400"
            >
              OSGB Planına Yükseltin
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile?.organization_id) {
    return (
      <div className="container mx-auto py-6">
        <Card className="overflow-hidden border-cyan-500/20 bg-[linear-gradient(135deg,rgba(8,145,178,0.16),rgba(15,23,42,0.92))] text-cyan-50 shadow-[0_24px_70px_rgba(8,145,178,0.12)]">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3 text-xl font-semibold">
              <Building2 className="h-5 w-5" />
              Organizasyon Kaydı Gerekli
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-cyan-50">Başlamak için önce çalışma alanınızı oluşturun.</p>
              <OrganizationCreateButton nextPath="/osgb" className="w-full sm:w-auto" />
            </div>
            <p className="text-sm leading-6 text-cyan-100/90">
              OSGB planınız aktif. Ancak bu modülü kullanabilmek için önce bir organizasyon/çalışma alanı oluşturmanız gerekir.
            </p>
            <p className="text-sm leading-6 text-cyan-100/75">
              Organizasyon, firmalarınızı, çalışanlarınızı, evraklarınızı ve OSGB süreçlerinizi güvenli şekilde tek çatı altında tutar.
            </p>
          </CardHeader>
          <CardContent>
            <OrganizationInfoCard />
            <OrganizationCreateButton nextPath="/osgb" className="mt-5" />
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
