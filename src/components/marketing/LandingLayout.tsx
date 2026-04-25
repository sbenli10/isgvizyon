import { Menu, ShieldAlert, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activePath = useMemo(() => location.pathname, [location.pathname]);

  useEffect(() => {
    const previousTheme = theme;

    if (previousTheme !== "dark") {
      setTheme("dark");
    }

    return () => {
      if (previousTheme && previousTheme !== "dark") {
        setTheme(previousTheme);
      }
    };
    // Landing sayfaları tema seçiciden bağımsız olarak yalnızca dark modda çalışır.
  }, [setTheme, theme]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#070b15] text-white">
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_16%_14%,rgba(34,211,238,0.08),transparent_22%),radial-gradient(circle_at_84%_16%,rgba(124,58,237,0.12),transparent_24%),radial-gradient(circle_at_60%_80%,rgba(17,24,39,0.95),transparent_28%),linear-gradient(180deg,#060912_0%,#090d18_45%,#070b14_100%)]" />
      <div className="fixed inset-0 -z-10 opacity-[0.08] [background-image:linear-gradient(rgba(148,163,184,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.6)_1px,transparent_1px)] [background-size:104px_104px]" />
      <div className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden" aria-hidden="true">
        <div
          className="absolute left-[-10%] top-[8%] h-[24rem] w-[24rem] rounded-full bg-cyan-400/10 blur-3xl"
          style={{ animation: "landingFloatOne 18s ease-in-out infinite" }}
        />
        <div
          className="absolute right-[-8%] top-[12%] h-[22rem] w-[22rem] rounded-full bg-violet-500/12 blur-3xl"
          style={{ animation: "landingFloatTwo 24s ease-in-out infinite" }}
        />
        <div
          className="absolute bottom-[8%] left-[34%] h-[18rem] w-[18rem] rounded-full bg-sky-400/8 blur-3xl"
          style={{ animation: "landingFloatThree 20s ease-in-out infinite" }}
        />
      </div>
      <style>
        {`
          @keyframes landingFloatOne {
            0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
            50% { transform: translate3d(5%, 8%, 0) scale(1.08); }
          }
          @keyframes landingFloatTwo {
            0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
            50% { transform: translate3d(-6%, 10%, 0) scale(0.96); }
          }
          @keyframes landingFloatThree {
            0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
            50% { transform: translate3d(0, -10%, 0) scale(1.05); }
          }
        `}
      </style>

      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="sticky top-4 z-30 flex items-center justify-between rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <button
                type="button"
                onClick={() => navigate("/landing")}
                aria-label="İSGVizyon landing sayfasına git"
                className="text-left text-sm font-semibold tracking-[0.18em] text-slate-100"
              >
                İSGVİZYON
              </button>
              <p className="text-xs text-slate-400">Modern İSG operasyon platformu</p>
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
                  className={`rounded-full px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-cyan-400/12 text-cyan-100"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
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
              Giriş Yap
            </Button>
            <Button
              className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
              onClick={() => navigate("/auth")}
            >
              Ücretsiz Başla
            </Button>
          </div>
        </header>

        {mobileMenuOpen ? (
          <div className="mt-4 rounded-[28px] border border-white/10 bg-[#0f1626]/95 p-4 backdrop-blur-xl lg:hidden">
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
                    className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                      isActive
                        ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
                        : "border-white/8 bg-white/[0.03] text-slate-200 hover:border-cyan-400/20 hover:bg-white/[0.06]"
                    }`}
                  >
                    {link.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <main className="flex flex-1 flex-col gap-10 py-10 lg:py-12">
          {showHero && (eyebrow || title || description) ? (
            <section className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,20,33,0.92),rgba(10,16,28,0.98))] p-7 shadow-[0_30px_100px_rgba(0,0,0,0.24)] md:p-10">
              {eyebrow ? (
                <Badge className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-cyan-100">
                  {eyebrow}
                </Badge>
              ) : null}
              {title ? (
                <h1 className="mt-6 max-w-4xl text-[2.8rem] font-semibold leading-[0.96] tracking-[-0.055em] text-white sm:text-[3.6rem]">
                  {title}
                </h1>
              ) : null}
              {description ? (
                <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-300 sm:text-base">
                  {description}
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                  onClick={() => navigate("/auth")}
                >
                  Ücretsiz Başla
                </Button>
                <Button
                  variant="outline"
                  className="border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/10"
                  onClick={() => navigate("/landing/pricing")}
                >
                  Fiyatları Gör
                </Button>
              </div>
            </section>
          ) : null}

          {children}

          {showClosingCta ? (
            <section className="rounded-[30px] border border-cyan-400/15 bg-cyan-400/[0.06] p-6 md:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-medium text-white">İSG süreçlerini daha düzenli, daha görünür ve daha hızlı yönetin.</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Ücretsiz plan ile başlayın, profesyonel modülleri deneyin ve operasyonunuza en uygun modeli içeriden görün.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                    onClick={() => navigate("/auth")}
                  >
                    Ücretsiz Başla
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/10"
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
