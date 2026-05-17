import { ShieldAlert, Linkedin, Twitter, Youtube } from "lucide-react";
import { landingFooterGroups } from "@/lib/landingContent";
import { Badge } from "@/components/ui/badge";

const SOCIAL_LINKS = [
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/isgvizyon",
    icon: Linkedin,
  },
  {
    name: "Twitter",
    href: "https://twitter.com/isgvizyon",
    icon: Twitter,
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/@isgvizyon",
    icon: Youtube,
  },
];

export function LandingFooter() {
  return (
    <footer className="relative mx-auto w-full max-w-[1460px] px-4 sm:px-8 pt-14 pb-7">
      <div className="grid gap-12 rounded-[34px] border border-white/10 bg-white/[0.03] p-6 sm:p-10 lg:grid-cols-4">
        {/* SOL KURUMSAL */}
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
              <ShieldAlert className="h-5 w-5" aria-label="İSGVizyon Logo" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-white">İSGVİZYON</p>
              <p className="text-xs text-slate-400">Modern İSG operasyon platformu</p>
            </div>
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-300">
            İSG süreçlerini Excel, WhatsApp ve dağınık dosyalardan çıkarıp merkezi, izlenebilir ve raporlanabilir hale getiren operasyon yönetim platformu.
          </p>
          {/* Sosyal medya ve iletişim */}
          <div className="mt-6 flex flex-wrap items-center gap-3 sm:gap-5">
            {SOCIAL_LINKS.map((s, i) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                className="flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 text-slate-500 transition-colors hover:text-cyan-400 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              >
                <s.icon className="h-5 w-5 opacity-80" aria-hidden="true" />
              </a>
            ))}
            <span className="ml-2 border-l border-slate-700/40 pl-4 text-xs text-slate-400 opacity-85">
              <a
                href="mailto:destek@isgvizyon.com"
                className="underline decoration-dotted hover:text-cyan-400 transition-colors"
                aria-label="destek@isgvizyon.com e-posta ile iletişim"
              >
                destek@isgvizyon.com
              </a>
            </span>
          </div>
        </div>

        {/* LİNK GRUPLARI */}
        <nav aria-label="Alt sayfa bağlantıları" className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-8">
          {landingFooterGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">{group.title}</h3>

          <ul className="mt-4 flex flex-col gap-2">
            {group.links.map((link) =>
              link.href ? (
                <li key={link.name}>
                  <a
                    href={link.href}
                    aria-label={link.name}
                    className="text-sm text-slate-400 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 rounded"
                    rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    target={link.href.startsWith("http") ? "_blank" : undefined}
                  >
                    {link.name}
                  </a>
                </li>
              ) : (
                <li key={link.name}>
                  <span className="text-sm text-slate-400">{link.name}</span>
                </li>
              ),
            )}
          </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* ALT TELİF/YASAL BAR */}
      <div className="mx-auto mt-10 w-full max-w-[1200px] flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row sm:justify-between">
        <p aria-label="Telif hakkı">© 2026 İSGVizyon. Tüm hakları saklıdır.</p>
        <p className="text-right" aria-label="Kurumsal bilgi">Kurumsal İSG operasyonları için tasarlandı.</p>
      </div>
    </footer>
  );
}