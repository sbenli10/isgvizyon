import { ShieldAlert } from "lucide-react";
import { landingFooterGroups } from "@/lib/landingContent";

export function LandingFooter() {
  return (
    <footer className="grid gap-10 rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm sm:p-10 lg:grid-cols-[0.92fr_1.08fr]">
      <div className="max-w-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 text-blue-600">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black tracking-[0.18em] text-slate-950">ISGVizyon</p>
            <p className="text-xs font-semibold text-slate-500">Modern İSG operasyon platformu</p>
          </div>
        </div>
        <p className="mt-5 text-sm leading-7 text-slate-600">
          İSG süreçlerini Excel, mesajlaşma ve dağınık dosyalardan çıkarıp merkezi, izlenebilir ve raporlanabilir hale getiren operasyon yönetim platformu.
        </p>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
        {landingFooterGroups.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">{group.title}</h3>
            <ul className="mt-4 space-y-3">
              {group.links.map((link) => (
                <li key={link} className="text-sm font-semibold text-slate-500">
                  {link}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="lg:col-span-2">
        <div className="h-px bg-slate-200" />
        <div className="mt-5 flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 ISGVizyon. Tüm hakları saklıdır.</p>
          <p>Kurumsal İSG operasyonları için tasarlandı.</p>
        </div>
      </div>
    </footer>
  );
}
