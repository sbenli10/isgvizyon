import { Menu, MessageCircle, Rocket, X } from "lucide-react";
import { useMemo, useState } from "react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activePath = useMemo(() => location.pathname, [location.pathname]);
  const navLinks = useMemo(
    () => [
      { label: "Özellikler", path: "/landing/features" },
      { label: "Entegrasyonlar", path: "/landing/product" },
      { label: "Fiyatlar", path: "/landing/pricing" },
      { label: "Referanslar", path: "/landing/trust" },
      { label: "Araçlar", path: "/landing/flow" },
      { label: "Kurumsal", path: "/landing/trust" },
    ],
    [],
  );

  return (
    <div className="isgvizyon-landing-dark min-h-screen overflow-x-hidden bg-[#08111f] font-['Inter',sans-serif] text-slate-100">
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_50%,rgba(34,211,238,0.22),transparent_30%),radial-gradient(circle_at_78%_50%,rgba(59,130,246,0.22),transparent_34%)]" />
        <div className="relative mx-auto flex h-auto min-h-11 max-w-[1440px] flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-2 text-xs font-semibold sm:justify-between lg:px-10">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 px-3.5 text-[11px] font-black text-white shadow-lg shadow-cyan-950/30">
              <Rocket className="h-3 w-3" />
              ISGVizyon ile tanış
            </span>
            <span className="hidden font-bold text-white md:inline">İSG süreçlerini tek panelden yönetin</span>
          </div>
          <p className="hidden max-w-xl text-center font-semibold text-cyan-50 lg:block">
            İSG firmaları, OSGB'ler ve iş güvenliği uzmanları için dijital yönetim platformu
          </p>
          <button
            type="button"
            onClick={() => navigate("/auth")}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-1.5 text-xs font-black text-slate-950 shadow-lg shadow-emerald-950/20 transition hover:from-emerald-300 hover:to-cyan-300"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Demo Talep Et
          </button>
        </div>
      </div>

      <header className="isgvizyon-marketing-header sticky top-0 z-50 border-b border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
        <div className="mx-auto grid h-[72px] max-w-[1320px] grid-cols-[210px_minmax(0,1fr)_350px] items-center gap-5 px-5 sm:px-8 lg:px-10">
          <button
            type="button"
            onClick={() => navigate("/landing")}
            aria-label="ISGVizyon landing sayfasına git"
            className="flex min-w-0 shrink-0 items-center text-left"
          >
            <span className="leading-tight">
              <span className="isgvizyon-brand-word block whitespace-nowrap text-[26px] font-black tracking-[-0.055em]">ISGVizyon</span>
            </span>
          </button>

          <nav className="hidden min-w-0 items-center justify-center gap-6 lg:flex" aria-label="Landing navigasyon">
            {navLinks.map((link) => {
              const isActive = activePath === link.path;
              return (
                <button
                  key={`${link.path}-${link.label}`}
                  type="button"
                  onClick={() => navigate(link.path)}
                  className={[
                    "isgvizyon-marketing-nav-item group relative inline-flex h-[72px] items-center gap-1.5 px-0 text-sm font-semibold transition-all",
                    "outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                    isActive
                      ? "!text-slate-950 after:absolute after:bottom-0 after:left-0 after:h-[3px] after:w-full after:rounded-full after:bg-cyan-500"
                      : "!text-slate-900 hover:!text-blue-700",
                  ].join(" ")}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>

          <div className="flex min-w-0 items-center justify-end gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="!text-blue-700 hover:bg-blue-50 hover:!text-blue-800 lg:hidden"
              onClick={() => setMobileMenuOpen((current) => !current)}
              aria-label={mobileMenuOpen ? "Mobil menüyü kapat" : "Mobil menüyü aç"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <Button
              variant="outline"
              className="isgvizyon-login-button hidden h-11 min-w-[122px] rounded-full border border-blue-500 px-6 text-sm font-black shadow-[0_12px_26px_rgba(37,99,235,0.18)] ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:border-blue-600 hover:shadow-[0_18px_34px_rgba(37,99,235,0.24)] sm:inline-flex"
              onClick={() => navigate("/auth")}
            >
              Giriş Yap
            </Button>

            <Button
              className="h-11 min-w-[132px] rounded-full bg-gradient-to-r from-blue-600 to-blue-700 px-7 text-sm font-bold !text-white shadow-[0_14px_28px_rgba(37,99,235,0.32)] hover:from-blue-500 hover:to-blue-700"
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
            <section className="isgvizyon-marketing-hero relative overflow-hidden rounded-[36px] border border-slate-800 bg-[linear-gradient(135deg,#0b1424_0%,#13233d_52%,#07111f_100%)] p-7 shadow-[0_24px_80px_rgba(15,23,42,0.16)] md:p-10">
              <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_18%_18%,rgba(14,165,233,0.12),transparent_40%),radial-gradient(circle_at_80%_22%,rgba(37,99,235,0.10),transparent_42%)]" />

              {eyebrow ? (
                <Badge className="relative z-10 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 !text-sky-700">
                  {eyebrow}
                </Badge>
              ) : null}

              {title ? (
                <h1 className="isgvizyon-marketing-hero-title relative z-10 mt-6 max-w-4xl text-[2.4rem] font-semibold leading-[0.98] tracking-[-0.055em] !text-white sm:text-[3.4rem]">
                  {title}
                </h1>
              ) : null}

              {description ? (
                <p className="isgvizyon-marketing-hero-description relative z-10 mt-4 max-w-3xl text-sm leading-8 !text-slate-200 sm:text-base">
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
                  className="border-sky-200 bg-white !text-blue-700 hover:bg-sky-50"
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
                  <p className="text-sm font-semibold !text-slate-950">
                    İSG süreçlerini daha görünür, daha ölçülebilir ve daha yönetilebilir hale getirin.
                  </p>
                  <p className="mt-2 text-sm font-medium leading-7 !text-slate-700">
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
                    className="border-sky-200 bg-white !text-blue-700 hover:bg-sky-50"
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
