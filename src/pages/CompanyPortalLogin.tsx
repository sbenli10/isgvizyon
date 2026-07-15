import { useMemo, useState } from "react";
import { Building2, KeyRound, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authenticateOsgbCompanyPortalAccount } from "@/lib/osgbPlatform";

export default function CompanyPortalLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => username.trim().length > 0 && password.trim().length > 0, [password, username]);

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error("Kullanici adi ve sifre zorunlu.");
      return;
    }

    setLoading(true);
    try {
      const result = await authenticateOsgbCompanyPortalAccount(username, password);
      toast.success("Firma girisi basarili.");
      navigate(result.portalPath, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Firma girisi yapilamadi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_30%),linear-gradient(180deg,#020617,#0f172a)] px-4 py-8 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/80 shadow-2xl shadow-black/40 lg:grid-cols-[1fr_420px]">
          <section className="hidden min-h-[520px] flex-col justify-between border-r border-slate-800 bg-slate-900/45 p-8 lg:flex">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
                <ShieldCheck className="h-4 w-4" />
                Firma Portal Girisi
              </div>
              <h1 className="mt-8 max-w-xl text-4xl font-black tracking-tight text-white">
                OSGB firmanizin paylastigi belgeleri ve hizmet ozetlerini guvenli sekilde takip edin.
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-slate-400">
                Size verilen firma kullanici adi ve sifre ile giris yapin. Giristen sonra bekleyen evraklar,
                hizmet ziyaretleri ve cari ozetiniz ayni portalda acilir.
              </p>
            </div>
            <div className="grid gap-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <Building2 className="mb-3 h-5 w-5 text-cyan-300" />
                Bu ekran yalnizca OSGB tarafindan yetkilendirilen firma hesaplari icindir.
              </div>
            </div>
          </section>

          <section className="p-5 sm:p-8">
            <div className="mb-8 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-300">
                <KeyRound className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">ISGVizyon</p>
                <h2 className="text-2xl font-black text-white">Firma Girisi</h2>
              </div>
            </div>

            <Card className="border-slate-800 bg-slate-900/70">
              <CardContent className="space-y-5 p-5">
                <div className="space-y-2">
                  <Label htmlFor="company-portal-username" className="text-slate-200">Kullanici adi</Label>
                  <Input
                    id="company-portal-username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    className="h-11 rounded-xl border-slate-700 bg-slate-950 text-slate-100"
                    placeholder="firma-kullanici"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handleSubmit();
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-portal-password" className="text-slate-200">Sifre</Label>
                  <Input
                    id="company-portal-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    className="h-11 rounded-xl border-slate-700 bg-slate-950 text-slate-100"
                    placeholder="ISG-..."
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handleSubmit();
                    }}
                  />
                </div>
                <Button
                  type="button"
                  disabled={loading || !canSubmit}
                  onClick={() => void handleSubmit()}
                  className="h-11 w-full rounded-xl bg-cyan-500 font-black text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                  Giris Yap
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
