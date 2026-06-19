import { Menu, MessageCircle, Rocket, ShieldAlert, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  const navLinks = useMemo(
    () => [
      { label: "Özellikler", path: "/landing/features" },
      { label: "Modüller", path: "/landing/product" },
      { label: "Fiyatlar", path: "/landing/pricing" },
      { label: "Referanslar", path: "/landing/trust" },
      { label: "Araçlar", path: "/landing/flow" },
      { label: "Kurumsal", path: "/landing/trust" },
    ],
    [],
  );

  useEffect(() => {
    const storedTheme =
      typeof window !== "undefined" ? window.localStorage.getItem("denetron-theme") : null;
    previousThemeRef.current = storedTheme === "light" || storedTheme === "dark" ? storedTheme : null;
    setTheme("light");

    return () => {
      if (previousThemeRef.current && previousThemeRef.current !== "light") {
        setTheme(previousThemeRef.current);
      }
    };
  }, [setTheme]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white font-['Inter',sans-serif] text-slate-900">
      <div className="bg-[#172337] text-white">
        <div className="mx-auto flex h-auto min-h-10 max-w-[1440px] flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-2 text-xs font-semibold sm:justify-between lg:px-10">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-blue-600 px-3 text-[11px] font-black shadow-lg shadow-blue-900/30">
              <Rocket className="h-3 w-3" />
              ISGVizyon ile tanış
            </span>
            <span className="hidden text-slate-200 md:inline">İSG süreçlerini tek panelden yönetin</span>
          </div>
          <p className="hidden text-slate-300 lg:block">
            İSG firmaları, OSGB'ler ve iş güvenliği uzmanları için dijital yönetim platformu
          </p>
          <button
            type="button"
            onClick={() => navigate("/auth")}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-400"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Demo Talep Et
          </button>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <button
            type="button"
            onClick={() => navigate("/landing")}
            aria-label="ISGVizyon landing sayfasına git"
            className="flex items-center gap-3 text-left"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-50 text-blue-600 ring-1 ring-sky-200">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-xl font-black tracking-[-0.04em] text-slate-900">ISGVizyon</span>
              <span className="hidden text-xs font-semibold text-slate-500 sm:block">Dijital İSG yönetim platformu</span>
            </span>
          </button>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Landing navigasyon">
            {navLinks.map((link) => {
              const isActive = activePath === link.path;
              return (
                <button
                  key={`${link.path}-${link.label}`}
                  type="button"
                  onClick={() => navigate(link.path)}
                  className={[
                    "rounded-full px-3 py-2 text-sm font-bold transition-all",
                    "outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                    isActive ? "bg-sky-50 text-blue-700" : "text-slate-700 hover:bg-slate-100 hover:text-blue-700",
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
              className="text-slate-700 hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileMenuOpen((current) => !current)}
              aria-label={mobileMenuOpen ? "Mobil menüyü kapat" : "Mobil menüyü aç"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <Button
              variant="outline"
              className="hidden rounded-full border-blue-200 bg-white px-5 font-black text-blue-700 hover:bg-blue-50 sm:inline-flex"
              onClick={() => navigate("/auth")}
            >
              Giriş Yap
            </Button>

            <Button
              className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-5 font-black text-white shadow-[0_14px_35px_rgba(37,99,235,0.28)] hover:from-blue-500 hover:to-cyan-400"
              onClick={() => navigate("/auth")}
            >
              Ücretsiz Dene
            </Button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-slate-200 bg-white p-4 shadow-xl lg:hidden">
            <div className="grid gap-2">
              {navLinks.map((link) => {
                const isActive = activePath === link.path;
                return (
                  <button
                    key={`${link.path}-${link.label}-mobile`}
                    type="button"
                    onClick={() => {
                      navigate(link.path);
                      setMobileMenuOpen(false);
                    }}
                    className={[
                      "rounded-2xl border px-4 py-3 text-left text-sm font-bold transition-all",
                      isActive
                        ? "border-sky-200 bg-sky-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
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

      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col bg-white px-5 py-10 sm:px-8 lg:px-10">
        <main className="flex flex-1 flex-col gap-10">
          {showHero && (eyebrow || title || description) ? (
            <section className="relative overflow-hidden rounded-[36px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-7 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-10">
              <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_18%_18%,rgba(14,165,233,0.12),transparent_40%),radial-gradient(circle_at_80%_22%,rgba(37,99,235,0.10),transparent_42%)]" />

              {eyebrow ? (
                <Badge className="relative z-10 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sky-700">
                  {eyebrow}
                </Badge>
              ) : null}

              {title ? (
                <h1 className="relative z-10 mt-6 max-w-4xl text-[2.4rem] font-semibold leading-[0.98] tracking-[-0.055em] text-slate-950 sm:text-[3.4rem]">
                  {title}
                </h1>
              ) : null}

              {description ? (
                <p className="relative z-10 mt-4 max-w-3xl text-sm leading-8 text-slate-600 sm:text-base">
                  {description}
                </p>
              ) : null}

              <div className="relative z-10 mt-6 flex flex-wrap gap-3">
                <Button
                  className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_14px_40px_rgba(37,99,235,0.22)] hover:from-blue-500 hover:to-cyan-400"
                  onClick={() => navigate("/auth")}
                >
                  Panele Git
                </Button>
                <Button
                  variant="outline"
                  className="border-sky-200 bg-white text-blue-700 hover:bg-sky-50"
                  onClick={() => navigate("/landing/pricing")}
                >
                  Fiyatları İncele
                </Button>
              </div>
            </section>
          ) : null}

          {children}

          {showClosingCta ? (
            <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white p-6 text-slate-950 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:p-8">
              <div className="pointer-events-none absolute inset-0 opacity-45 [background:radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.08),transparent_45%),radial-gradient(circle_at_85%_50%,rgba(37,99,235,0.08),transparent_45%)]" />

              <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    İSG süreçlerini daha görünür, daha ölçülebilir ve daha yönetilebilir hale getirin.
                  </p>
                  <p className="mt-2 text-sm font-medium leading-7 text-slate-950">
                    Mevcut panel ve giriş akışınızı bozmadan, yapay zeka destekli operasyon yaklaşımını doğrudan ürün üzerinden deneyimleyin.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_14px_40px_rgba(37,99,235,0.22)] hover:from-blue-500 hover:to-cyan-400"
                    onClick={() => navigate("/auth")}
                  >
                    Panele Git
                  </Button>

                  <Button
                    variant="outline"
                    className="border-sky-200 bg-white text-blue-700 hover:bg-sky-50"
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
