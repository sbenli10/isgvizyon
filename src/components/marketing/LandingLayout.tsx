import { Menu, ShieldAlert, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { landingNavLinks } from "@/lib/landingContent";

type LandingLayoutProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  children: React.ReactNode;
  showHero?: boolean;
  showClosingCta?: boolean;
};

export function LandingLayout({
  eyebrow,
  title,
  description,
  children,
  showHero = true,
  showClosingCta = true,
}: LandingLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const previousThemeRef = useRef<string | null>(null);

  const activePath = useMemo(() => location.pathname, [location.pathname]);

  useEffect(() => {
    const storedTheme =
      typeof window !== "undefined" ? window.localStorage.getItem("denetron-theme") : null;
    previousThemeRef.current = storedTheme === "light" || storedTheme === "dark" ? storedTheme : null;
    setTheme("dark");

    return () => {
      if (previousThemeRef.current && previousThemeRef.current !== "dark") {
        setTheme(previousThemeRef.current);
      }
    };
  }, [setTheme]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050B1E] font-['Inter',sans-serif] text-white">
      <div className="fixed inset-0 -z-30 bg-[radial-gradient(circle_at_18%_16%,rgba(34,211,238,0.14),transparent_24%),radial-gradient(circle_at_84%_14%,rgba(37,99,235,0.22),transparent_30%),radial-gradient(circle_at_50%_-10%,rgba(59,130,246,0.10),transparent_34%),radial-gradient(circle_at_62%_82%,rgba(11,31,58,0.80),transparent_42%),linear-gradient(180deg,#061126_0%,#091833_45%,#081224_100%)]" />
      <div className="fixed inset-0 -z-20 opacity-[0.08] [background-image:linear-gradient(rgba(148,163,184,0.38)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.38)_1px,transparent_1px)] [background-size:96px_96px]" />
      <div className="pointer-events-none fixed inset-0 -z-[15] opacity-60 [background-image:radial-gradient(circle,rgba(255,255,255,0.85)_0.6px,transparent_0.9px),radial-gradient(circle,rgba(34,211,238,0.55)_0.7px,transparent_1px),radial-gradient(circle,rgba(148,163,184,0.55)_0.6px,transparent_0.95px)] [background-position:0_0,120px_80px,60px_140px] [background-size:240px_240px,320px_320px,280px_280px]" />

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute left-[-12%] top-[5%] h-[26rem] w-[26rem] rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="absolute right-[-10%] top-[10%] h-[24rem] w-[24rem] rounded-full bg-blue-500/12 blur-3xl" />
        <div className="absolute bottom-[8%] left-[28%] h-[22rem] w-[22rem] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="sticky top-4 z-30">
          <div className="flex items-center justify-between rounded-full border border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.72)] px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-100">
                <div className="absolute inset-0 rounded-2xl shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_0_30px_rgba(34,211,238,0.12)]" />
                <ShieldAlert className="h-5 w-5" />
              </div>

              <div className="leading-tight">
                <button
                  type="button"
                  onClick={() => navigate("/landing")}
                  aria-label="İSGVizyon landing sayfasına git"
                  className="text-left text-sm font-semibold tracking-[0.20em] text-slate-100 transition-colors hover:text-white"
                >
                  İSGVİZYON
                </button>
                <p className="text-xs text-slate-400">
                  AI destekli İSG operasyon platformu • Güvenli • Ölçülebilir • İzlenebilir
                </p>
              </div>
            </div>

            <nav className="hidden items-center gap-1 lg:flex" aria-label="Landing navigasyon">
              {landingNavLinks.map((link) => {
                const isActive = activePath === link.path;
                return (
                  <button
                    key={link.path}
                    type="button"
                    onClick={() => navigate(link.path)}
                    className={[
                      "rounded-full px-3 py-2 text-sm transition-all",
                      "outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050B1E]",
                      isActive
                        ? "bg-cyan-400/14 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]"
                        : "text-slate-300 hover:bg-white/8 hover:text-white",
                    ].join(" ")}
                  >
                    {link.label}
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-200 hover:bg-white/10 lg:hidden"
                onClick={() => setMobileMenuOpen((current) => !current)}
                aria-label={mobileMenuOpen ? "Mobil menüyü kapat" : "Mobil menüyü aç"}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>

              <Button
                variant="ghost"
                className="hidden text-slate-200 hover:bg-white/10 sm:inline-flex"
                onClick={() => navigate("/auth")}
              >
                Firma Girişi
              </Button>

              <Button
                className="bg-gradient-to-r from-[#22D3EE] via-[#2563EB] to-[#5B7CFA] text-slate-950 shadow-[0_12px_40px_rgba(34,211,238,0.22)] hover:from-cyan-200 hover:via-blue-400 hover:to-indigo-300"
                onClick={() => navigate("/auth")}
              >
                Panele Git
              </Button>
            </div>
          </div>

          {mobileMenuOpen ? (
            <div className="mt-4 rounded-[28px] border border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.88)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.40)] backdrop-blur-xl lg:hidden">
              <div className="grid gap-2">
                {landingNavLinks.map((link) => {
                  const isActive = activePath === link.path;
                  return (
                    <button
                      key={link.path}
                      type="button"
                      onClick={() => {
                        navigate(link.path);
                        setMobileMenuOpen(false);
                      }}
                      className={[
                        "rounded-2xl border px-4 py-3 text-left text-sm transition-all",
                        isActive
                          ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-100"
                          : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-cyan-400/25 hover:bg-white/[0.06]",
                      ].join(" ")}
                    >
                      {link.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </header>

        <main className="flex flex-1 flex-col gap-10 py-10 lg:py-12">
          {showHero && (eyebrow || title || description) ? (
            <section className="relative overflow-hidden rounded-[36px] border border-[rgba(148,163,184,0.18)] bg-[linear-gradient(180deg,rgba(11,31,58,0.68),rgba(7,17,31,0.96))] p-7 shadow-[0_30px_110px_rgba(0,0,0,0.28)] md:p-10">
              <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background:radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.16),transparent_40%),radial-gradient(circle_at_80%_22%,rgba(37,99,235,0.18),transparent_42%)]" />

              {eyebrow ? (
                <Badge className="relative z-10 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-cyan-100">
                  {eyebrow}
                </Badge>
              ) : null}

              {title ? (
                <h1 className="relative z-10 mt-6 max-w-4xl text-[2.4rem] font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-[3.4rem]">
                  {title}
                </h1>
              ) : null}

              {description ? (
                <p className="relative z-10 mt-4 max-w-3xl text-sm leading-8 text-slate-300 sm:text-base">
                  {description}
                </p>
              ) : null}

              <div className="relative z-10 mt-6 flex flex-wrap gap-3">
                <Button
                  className="bg-gradient-to-r from-[#22D3EE] via-[#2563EB] to-[#5B7CFA] text-slate-950 shadow-[0_14px_50px_rgba(34,211,238,0.24)] hover:from-cyan-200 hover:via-blue-400 hover:to-indigo-300"
                  onClick={() => navigate("/auth")}
                >
                  Panele Git
                </Button>
                <Button
                  variant="outline"
                  className="border-white/12 bg-white/[0.04] text-slate-100 hover:bg-white/10"
                  onClick={() => navigate("/landing/pricing")}
                >
                  Fiyatlandırmayı İncele
                </Button>
              </div>
            </section>
          ) : null}

          {children}

          {showClosingCta ? (
            <section className="relative overflow-hidden rounded-[30px] border border-cyan-400/18 bg-cyan-400/[0.06] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.30)] md:p-8">
              <div className="pointer-events-none absolute inset-0 opacity-[0.45] [background:radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.18),transparent_45%),radial-gradient(circle_at_85%_50%,rgba(37,99,235,0.16),transparent_45%)]" />

              <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    İSG süreçlerini daha görünür, daha ölçülebilir ve daha yönetilebilir hale getirin.
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Mevcut panel ve giriş akışınızı bozmadan, yapay zeka destekli operasyon yaklaşımını doğrudan ürün üzerinden deneyimleyin.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="bg-gradient-to-r from-[#22D3EE] via-[#2563EB] to-[#5B7CFA] text-slate-950 shadow-[0_14px_50px_rgba(34,211,238,0.22)] hover:from-cyan-200 hover:via-blue-400 hover:to-indigo-300"
                    onClick={() => navigate("/auth")}
                  >
                    Panele Git
                  </Button>

                  <Button
                    variant="outline"
                    className="border-white/12 bg-white/[0.04] text-slate-100 hover:bg-white/10"
                    onClick={() => navigate("/landing/product")}
                  >
                    Ürünü İncele
                  </Button>
                </div>
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
