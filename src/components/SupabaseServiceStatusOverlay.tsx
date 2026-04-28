import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCcw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getSupabaseIncident,
  subscribeSupabaseIncident,
  type SupabaseServiceIncident,
} from "@/lib/supabaseServiceHealth";

export function SupabaseServiceStatusOverlay() {
  const [incident, setIncident] = useState<SupabaseServiceIncident>(getSupabaseIncident());

  useEffect(() => {
    return subscribeSupabaseIncident(setIncident);
  }, []);

  if (!incident.unavailable) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-amber-400/20 bg-slate-950/95 p-6 text-center shadow-2xl shadow-black/40">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-300">
          <Wrench className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-white">{incident.title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{incident.description}</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5" />
          {incident.statusCode ? `Servis kodu: ${incident.statusCode}` : "Supabase bağlantısı geçici olarak kullanılamıyor"}
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-400">{incident.action}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button className="gap-2" onClick={() => window.location.reload()}>
            <RefreshCcw className="h-4 w-4" />
            Yeniden dene
          </Button>
          <Button
            variant="outline"
            className="border-slate-700 text-slate-200 hover:bg-slate-900"
            onClick={() => window.location.assign("/")}
          >
            Ana sayfaya dön
          </Button>
        </div>
      </div>
    </div>
  );
}
