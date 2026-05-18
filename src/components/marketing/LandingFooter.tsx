import { ShieldAlert } from "lucide-react";
import { landingFooterGroups } from "@/lib/landingContent";

export function LandingFooter() {
  return (
    <footer className="grid gap-10 rounded-[34px] border border-white/10 bg-white/[0.03] p-7 sm:p-10 lg:grid-cols-[0.92fr_1.08fr]">
      <div className="max-w-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-white">İSGVİZYON</p>
            <p className="text-xs text-slate-400">Modern İSG operasyon platformu</p>
          </div>
        </div>
        <p className="mt-5 text-sm leading-7 text-slate-300">
          İSG süreçlerini Excel, WhatsApp ve dağınık dosyalardan çıkarıp merkezi, izlenebilir ve raporlanabilir hale getiren operasyon yönetim platformu.
        </p>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
        {landingFooterGroups.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">{group.title}</h3>
            <ul className="mt-4 space-y-3">
              {group.links.map((link) => (
                <li key={link} className="text-sm text-slate-400">
                  {link}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="lg:col-span-2">
        <div className="h-px bg-white/10" />
        <div className="mt-5 flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 İSGVizyon. Tüm hakları saklıdır.</p>
          <p>Kurumsal İSG operasyonları için tasarlandı.</p>
        </div>
      </div>
    </footer>
  );
}
