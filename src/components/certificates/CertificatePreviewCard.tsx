import { Award, CalendarDays, Clock3, FileCheck2, QrCode, ShieldCheck, Stamp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CertificateDesignConfig, CertificateFormValues, CertificateParticipantInput, CertificateSignatureConfig, CertificateTemplateType } from "@/types/certificates";

type Props = {
  form: CertificateFormValues;
  participant?: CertificateParticipantInput | null;
  className?: string;
};

type SignatureBlock = {
  name: string;
  title: string;
  subtitle?: string;
};

type ThemeConfig = {
  page: string;
  inner: string;
  badge: string;
  titleColor: string;
  bodyColor: string;
  muted: string;
  line: string;
  topBand?: string;
  bottomBand?: string;
  accentPanel?: string;
  contentSurface?: string;
  showWatermark?: boolean;
  watermarkClass?: string;
  heroVariant: "classic" | "academy" | "executive" | "compliance" | "modern" | "minimal";
};

const themeConfig: Record<CertificateTemplateType, ThemeConfig> = {
  classic: {
    page: "bg-[#f8f4ea] text-slate-900 shadow-[0_30px_80px_rgba(88,63,18,0.18)] print:shadow-none",
    inner: "border-[10px] border-[#d6b15f] before:absolute before:inset-[16px] before:border before:border-[#b8964d] before:content-[''] after:absolute after:inset-[28px] after:border after:border-[#e9d7a8] after:content-['']",
    badge: "border-[#cba34b] bg-[#f7e8b8] text-[#6a4b16]",
    titleColor: "text-[#3a2a11]",
    bodyColor: "text-slate-800",
    muted: "text-slate-600",
    line: "bg-gradient-to-r from-transparent via-[#b89143] to-transparent",
    contentSurface: "bg-white/70",
    showWatermark: true,
    watermarkClass: "text-[110px] font-black tracking-tight text-slate-900/5",
    heroVariant: "classic",
  },
  academy: {
    page: "bg-[#f3f2ed] text-slate-900 shadow-[0_30px_80px_rgba(17,40,74,0.22)] print:shadow-none",
    inner: "border-[8px] border-[#c5d52c] before:absolute before:inset-[16px] before:border before:border-white/25 before:content-['']",
    badge: "border-[#d4af37] bg-[#f5e3a5] text-[#5f4711]",
    titleColor: "text-[#171717]",
    bodyColor: "text-slate-800",
    muted: "text-slate-600",
    line: "bg-gradient-to-r from-transparent via-[#1f1f1f] to-transparent",
    topBand: "bg-[#294d77]",
    bottomBand: "bg-transparent",
    contentSurface: "bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(245,243,237,0.93))]",
    showWatermark: true,
    watermarkClass: "text-[92px] font-black tracking-tight text-white/6",
    heroVariant: "academy",
  },
  executive: {
    page: "bg-[#111315] text-[#f4ead2] shadow-[0_35px_90px_rgba(0,0,0,0.38)] print:shadow-none",
    inner: "border border-[#b99750] before:absolute before:inset-[18px] before:border before:border-[#8e7540] before:content-[''] after:absolute after:inset-[34px] after:border after:border-[#53452a] after:content-['']",
    badge: "border-[#c9a65d] bg-[#c9a65d]/10 text-[#f4d38f]",
    titleColor: "text-[#f4d38f]",
    bodyColor: "text-[#f5f1e7]",
    muted: "text-[#c2b79f]",
    line: "bg-gradient-to-r from-transparent via-[#c9a65d] to-transparent",
    contentSurface: "bg-white/0",
    heroVariant: "executive",
  },
  compliance: {
    page: "bg-[#f6faf7] text-slate-900 shadow-[0_30px_80px_rgba(18,81,56,0.16)] print:shadow-none",
    inner: "border-[6px] border-[#156245] before:absolute before:inset-[14px] before:border before:border-[#8db4a2] before:content-['']",
    badge: "border-[#1f7a57] bg-[#e3f3eb] text-[#12533a]",
    titleColor: "text-[#0f3d2d]",
    bodyColor: "text-slate-800",
    muted: "text-slate-600",
    line: "bg-gradient-to-r from-transparent via-[#156245] to-transparent",
    topBand: "bg-[#12533a]",
    contentSurface: "bg-white/85",
    accentPanel: "bg-[#eef7f1] border-[#b8d3c6]",
    heroVariant: "compliance",
  },
  modern: {
    page: "bg-white text-slate-900 shadow-[0_30px_80px_rgba(15,23,42,0.16)] print:shadow-none",
    inner: "border border-slate-200 before:absolute before:left-0 before:top-0 before:h-full before:w-[86px] before:bg-[linear-gradient(180deg,#0f172a_0%,#1d4ed8_100%)] before:content-[''] after:absolute after:right-[34px] after:top-[34px] after:h-[84px] after:w-[84px] after:rounded-3xl after:border after:border-cyan-300 after:content-['']",
    badge: "border-cyan-300 bg-cyan-50 text-cyan-800",
    titleColor: "text-slate-900",
    bodyColor: "text-slate-700",
    muted: "text-slate-500",
    line: "bg-gradient-to-r from-cyan-500/20 via-cyan-500 to-cyan-500/20",
    contentSurface: "bg-white",
    accentPanel: "bg-slate-50 border-slate-200",
    heroVariant: "modern",
  },
  minimal: {
    page: "bg-white text-slate-900 shadow-[0_18px_60px_rgba(15,23,42,0.08)] print:shadow-none",
    inner: "border border-slate-200",
    badge: "border-slate-300 bg-white text-slate-700",
    titleColor: "text-slate-900",
    bodyColor: "text-slate-700",
    muted: "text-slate-500",
    line: "bg-gradient-to-r from-transparent via-slate-300 to-transparent",
    contentSurface: "bg-white",
    heroVariant: "minimal",
  },
};

function splitCurriculum(notes?: string) {
  const items = (notes || "")
    .split(/\r?\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length === 0) return [[], []] as const;
  const midpoint = Math.ceil(items.length / 2);
  return [items.slice(0, midpoint), items.slice(midpoint)] as const;
}

function normalizeDesignConfig(form: CertificateFormValues): CertificateDesignConfig {
  const source: Partial<CertificateDesignConfig> = form.design_config ?? {};
  const signatures = Array.isArray(source.signatures) ? [...source.signatures].slice(0, 4) : [];
  while (signatures.length < 4) {
    signatures.push({
      name: signatures.length === 2 ? form.company_name || "" : signatures.length === 3 ? "OSGB Yetkilisi" : form.trainer_names[signatures.length] || "",
      title: signatures.length === 0 ? "İSG Uzmanı" : signatures.length === 1 ? "İşyeri Hekimi" : signatures.length === 2 ? "İşveren Vekili" : "Düzenleyen Birim",
      image_url: "",
    });
  }

  return {
    primaryColor: source.primaryColor || "#d4af37",
    secondaryColor: source.secondaryColor || "#294d77",
    fontFamily: source.fontFamily === "sans" || source.fontFamily === "gothic" ? source.fontFamily : "serif",
    showBadge: typeof source.showBadge === "boolean" ? source.showBadge : true,
    showSeal: typeof source.showSeal === "boolean" ? source.showSeal : true,
    titleText: source.titleText || "",
    descriptionText: source.descriptionText || "",
    osgb_logo_url: source.osgb_logo_url || "",
    signatureCount: Math.min(4, Math.max(1, Number(source.signatureCount || 4))),
    signatures: signatures as CertificateSignatureConfig[],
  };
}

function fontClass(fontFamily: CertificateDesignConfig["fontFamily"], mode: "title" | "body") {
  if (fontFamily === "gothic") {
    return mode === "title"
      ? '[font-family:"Cinzel_Decorative","Times_New_Roman",serif]'
      : '[font-family:"Cormorant_Garamond","Georgia",serif]';
  }
  if (fontFamily === "sans") {
    return '[font-family:"Inter","Montserrat",sans-serif]';
  }
  return mode === "title"
    ? '[font-family:"Playfair_Display","Georgia",serif]'
    : '[font-family:"Cormorant_Garamond","Georgia",serif]';
}

function resolveDescription(form: CertificateFormValues, participantName: string) {
  const fallback = form.template_type === "academy"
    ? `${participantName}, çalışanların iş sağlığı ve güvenliği eğitimlerine ilişkin program kapsamında verilen eğitimi başarıyla tamamlayarak bu belgeyi almaya hak kazanmıştır.`
    : form.template_type === "compliance"
      ? `${participantName}, mevzuata uygun olarak planlanan eğitimi başarıyla tamamlamış olup bu belge resmi kayıt ve doğrulama amacıyla düzenlenmiştir.`
      : `${participantName}, ${form.company_name || "kurum"} tarafından düzenlenen ${form.training_name || "eğitim"} programını başarıyla tamamlamıştır.`;

  const design = normalizeDesignConfig(form);
  const template = (design.descriptionText || "").trim() || fallback;
  return template
    .split("{name}").join(participantName)
    .split("{company}").join(form.company_name || "Kurum")
    .split("{training}").join(form.training_name || "Eğitim")
    .split("{date}").join(form.training_date || "-")
    .split("{duration}").join(form.training_duration || "-");
}

function buildSignatures(form: CertificateFormValues): SignatureBlock[] {
  const design = normalizeDesignConfig(form);
  return design.signatures.slice(0, design.signatureCount).map((signature, index) => ({
    name: signature.name || (index === 2 ? form.company_name || "Ad Soyad" : "Ad Soyad"),
    title: signature.title || (index === 0 ? "İSG Uzmanı" : index === 1 ? "İşyeri Hekimi" : index === 2 ? "İşveren Vekili" : "OSGB / Kurum"),
    subtitle: index === 0 ? "Eğitmen" : index === 1 ? "Onay Yetkilisi" : index === 2 ? "Firma Yetkilisi" : "Düzenleyen Birim",
  }));
}

function heroTitle(form: CertificateFormValues) {
  const design = normalizeDesignConfig(form);
  if (design.titleText?.trim()) return design.titleText.trim();
  if (form.template_type === "academy") return "Temel Eğitim Sertifikası";
  if (form.template_type === "compliance") return "İSG Eğitim Sertifikası";
  if (form.template_type === "executive") return "Kurumsal Başarı Sertifikası";
  return form.training_name || "Eğitim Sertifikası";
}

function descriptionText(form: CertificateFormValues, participant?: CertificateParticipantInput | null) {
  return resolveDescription(form, participant?.name || "Katılımcı");
}

function SignatureRow({ signatures, muted, design }: { signatures: SignatureBlock[]; muted: string; design: CertificateDesignConfig }) {
  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${Math.max(1, signatures.length)}, minmax(0, 1fr))` }}>
      {signatures.map((signature, index) => (
        <div key={`${signature.title}-${index}`} className="flex flex-col items-center text-center">
          {design.signatures[index]?.image_url ? (
            <div className="mb-2 flex h-10 w-full items-end justify-center">
              <img src={design.signatures[index]?.image_url} alt={`${signature.name} imzası`} className="max-h-10 object-contain opacity-90" />
            </div>
          ) : null}
          <div className="mb-3 h-6 w-full border-b border-current/30" />
          <p className="text-sm font-semibold">{signature.name}</p>
          <p className={cn("mt-1 text-[11px]", muted)}>{signature.title}</p>
          {signature.subtitle ? <p className={cn("text-[10px]", muted)}>{signature.subtitle}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function CertificatePreviewCard({ form, participant, className }: Props) {
  const theme = themeConfig[form.template_type || "classic"];
  const design = normalizeDesignConfig(form);
  const signatures = buildSignatures(form);
  const [leftCurriculum, rightCurriculum] = splitCurriculum(form.notes);
  const hasCurriculum = leftCurriculum.length > 0 || rightCurriculum.length > 0;
  const participantName = participant?.name || "Katılımcı Adı Soyadı";
  const participantTc = participant?.tc_no || "11111111111";
  const participantTitle = participant?.job_title || "Görev / Unvan";
  const title = heroTitle(form);
  const summary = descriptionText(form, participant);
  const titleFontClass = fontClass(design.fontFamily, "title");
  const bodyFontClass = fontClass(design.fontFamily, "body");
  const primaryStyle = { color: design.primaryColor };
  const secondaryStyle = { color: design.secondaryColor };
  const accentSurfaceStyle = {
    borderColor: `${design.primaryColor}33`,
    backgroundColor: form.template_type === "academy" ? `${design.secondaryColor}10` : undefined,
  };

  return (
    <>
      <style>{`
        @page {
          size: A4 landscape;
          margin: 0;
        }
        @media print {
          html, body {
            background: white !important;
          }
          .certificate-print-root {
            width: 297mm !important;
            height: 210mm !important;
            break-inside: avoid;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      <div
        className={cn(
          "certificate-print-root relative mx-auto aspect-[1.414/1] w-full overflow-hidden rounded-[28px] p-6 print:h-[210mm] print:w-[297mm] print:rounded-none print:p-0",
          theme.page,
          className
        )}
      >
        <div className={cn("relative h-full w-full overflow-hidden rounded-[22px] p-8 print:rounded-none", theme.inner)}>
          {theme.topBand ? <div className={cn("absolute inset-x-0 top-0 h-[26%]", theme.topBand)} /> : null}
          {theme.bottomBand ? <div className={cn("absolute inset-x-0 bottom-0 h-12", theme.bottomBand)} /> : null}
          {theme.showWatermark ? (
            <div className={cn("pointer-events-none absolute left-6 top-4 select-none uppercase", theme.watermarkClass)}>
              {form.company_name || "İSGVizyon"}
            </div>
          ) : null}

          {theme.heroVariant === "academy" && design.showSeal ? (
            <div className="absolute left-[94px] top-[58px] flex h-24 w-24 items-center justify-center rounded-full border-[6px] bg-[#2f2418] shadow-[0_12px_24px_rgba(0,0,0,0.25)]" style={{ borderColor: design.primaryColor }}>
              <Award className="h-10 w-10 text-[#f0cf70]" />
            </div>
          ) : null}

          {theme.heroVariant === "academy" ? (
            <div className={cn("absolute right-10 top-8 text-right text-5xl font-black", titleFontClass)} style={primaryStyle}>
              {form.company_name || "Firma Logo"}
            </div>
          ) : null}

          {theme.heroVariant === "executive" ? (
            <div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.08),transparent_42%)]" />
          ) : null}

          {theme.heroVariant === "modern" ? (
            <div className="absolute right-10 top-10 rounded-3xl border border-cyan-300/60 bg-white/90 p-4 shadow-sm">
              <QrCode className="h-14 w-14 text-slate-700" />
              <p className="mt-2 text-center text-[10px] font-medium text-slate-500">QR Doğrulama</p>
            </div>
          ) : null}

          {theme.heroVariant === "compliance" ? (
            <div className={cn("absolute right-8 top-8 rounded-2xl border px-4 py-3", theme.accentPanel)}>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#14563d]">
                <FileCheck2 className="h-4 w-4" />
                Denetim Uyumlu Belge
              </div>
              <p className="mt-1 text-[11px] text-slate-600">Kayıt, doğrulama ve resmi arşiv kullanımına uygundur.</p>
            </div>
          ) : null}

          {theme.heroVariant === "academy" ? (
            <div className="absolute inset-x-0 top-[145px] bottom-0 bg-[linear-gradient(155deg,rgba(255,255,255,0.98)_10%,rgba(243,241,236,0.96)_52%,rgba(233,232,228,0.88)_100%)] [clip-path:polygon(0_7%,100%_0,100%_100%,0_100%)]" />
          ) : null}

          <div className="relative z-10 flex h-full flex-col">
            <div className={cn("rounded-[20px] p-6", theme.contentSurface)}>
              <div className="flex items-start justify-between gap-8">
                <div className="max-w-[68%]">
                  {design.showBadge ? (
                    <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em]", theme.badge)} style={{ borderColor: design.primaryColor, color: design.primaryColor }}>
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {form.certificate_type || "Katılım"}
                    </div>
                  ) : null}
                  <p
                    className={cn("mt-5 text-xs uppercase tracking-[0.48em]", theme.muted, bodyFontClass)}
                    style={secondaryStyle}
                  >
                    {title}
                  </p>
                  <h2
                    className={cn("mt-3 text-4xl font-black leading-tight md:text-6xl", theme.titleColor, titleFontClass)}
                    style={primaryStyle}
                  >
                    {participantName}
                  </h2>
                  <div className={cn("mt-6 h-[2px] w-full max-w-[620px]", theme.line)} style={{ backgroundImage: `linear-gradient(to right, transparent, ${design.primaryColor}, transparent)` }} />
                  <p className={cn("mt-6 max-w-[680px] text-[15px] leading-7", theme.bodyColor, bodyFontClass)}>{summary}</p>
                </div>

                <div className="flex min-w-[210px] flex-col items-end gap-3">
                  {form.logo_url ? (
                    <div className="flex h-28 w-44 items-center justify-center rounded-2xl border border-white/20 bg-white/90 p-4 shadow-sm">
                      <img src={form.logo_url} alt="Firma logosu" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className={cn("flex h-28 w-44 items-center justify-center rounded-2xl border text-center text-sm font-semibold", theme.badge)} style={accentSurfaceStyle}>
                      Firma Logo
                    </div>
                  )}

                  {design.osgb_logo_url ? (
                    <div className="flex h-20 w-40 items-center justify-center rounded-2xl border border-white/20 bg-white/90 p-3 shadow-sm">
                      <img src={design.osgb_logo_url} alt="OSGB logosu" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : null}

                  {theme.heroVariant === "academy" && design.showSeal ? (
                    <div className="rounded-full border px-4 py-2 text-xs font-semibold" style={{ borderColor: design.primaryColor, color: design.primaryColor, backgroundColor: `${design.primaryColor}1f` }}>
                      Resmi Eğitim Belgesi
                    </div>
                  ) : null}

                  {theme.heroVariant === "executive" ? (
                    <div className="rounded-2xl border border-[#b99750]/40 px-4 py-3 text-right text-xs text-[#e8d4a2]">
                      Premium Yönetici Serisi
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-6 grid flex-1 gap-6">
              {theme.heroVariant === "compliance" ? (
                <div className="grid flex-1 grid-cols-[1.25fr_1fr] gap-6">
                  <div className="space-y-4">
                    <div className={cn("rounded-2xl border p-5", theme.accentPanel)}>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <p><span className="font-semibold">Katılımcı:</span> {participantName}</p>
                        <p><span className="font-semibold">TCKN:</span> {participantTc}</p>
                        <p><span className="font-semibold">Görev:</span> {participantTitle}</p>
                        <p><span className="font-semibold">Tarih:</span> {form.training_date || "-"}</p>
                        <p><span className="font-semibold">Süre:</span> {form.training_duration || "-"}</p>
                        <p><span className="font-semibold">Geçerlilik:</span> {form.validity_date || "Süresiz"}</p>
                      </div>
                    </div>
                    {hasCurriculum ? (
                      <div className={cn("rounded-2xl border p-5", theme.accentPanel)}>
                        <p className="text-sm font-semibold text-[#14563d]">Eğitim İçerik Listesi</p>
                        <div className="mt-4 grid grid-cols-2 gap-4 text-[11px] leading-5 text-slate-700">
                          <div className="space-y-1">
                            {leftCurriculum.map((item, index) => (
                              <p key={`left-${index}`}>{item}</p>
                            ))}
                          </div>
                          <div className="space-y-1">
                            {rightCurriculum.map((item, index) => (
                              <p key={`right-${index}`}>{item}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col justify-between rounded-2xl border border-[#b8d3c6] bg-white/80 p-6">
                    <div>
                      <p className="text-center text-3xl font-semibold text-[#1d4537]">{form.company_name || "Firma & OSGB"}</p>
                      <p className="mt-3 text-center text-sm text-slate-600">Resmi eğitim kaydı ve imza alanı</p>
                    </div>
                    <SignatureRow signatures={signatures} muted={theme.muted} design={design} />
                  </div>
                </div>
              ) : (
                <div className="grid flex-1 grid-cols-[1.1fr_0.9fr] gap-6">
                  <div className="space-y-5">
                    <div className={cn("rounded-2xl border p-5", theme.contentSurface || "bg-white")} style={accentSurfaceStyle}> 
                      <div className={cn("grid grid-cols-2 gap-x-6 gap-y-3 text-sm", bodyFontClass)}>
                        <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /><span className="font-semibold">Eğitim Tarihi:</span> {form.training_date || "-"}</div>
                        <div className="flex items-center gap-2"><Clock3 className="h-4 w-4" /><span className="font-semibold">Süre:</span> {form.training_duration || "-"}</div>
                        <div><span className="font-semibold">Katılımcı:</span> {participantName}</div>
                        <div><span className="font-semibold">TCKN:</span> {participantTc}</div>
                        <div><span className="font-semibold">Görev:</span> {participantTitle}</div>
                        <div><span className="font-semibold">Geçerlilik:</span> {form.validity_date || "Süresiz"}</div>
                      </div>
                    </div>

                    {theme.heroVariant === "academy" ? (
                      <div className="rounded-2xl border border-black/10 bg-white/65 p-5 text-sm leading-6 text-slate-700">
                        <p className={cn("font-semibold text-slate-900", titleFontClass)}>Belge Açıklaması</p>
                        <p className="mt-2">
                          Bu sertifika, çalışanların iş sağlığı ve güvenliği eğitimlerine ilişkin usul ve esaslar kapsamında oluşturulmuştur.
                        </p>
                      </div>
                    ) : null}

                    {hasCurriculum ? (
                      <div className={cn("rounded-2xl border p-5", theme.accentPanel || "border-slate-200 bg-slate-50/90")} style={{ borderColor: `${design.primaryColor}44` }}>
                        <div className="flex items-center justify-between gap-3">
                          <p className={cn("text-sm font-semibold", titleFontClass)} style={primaryStyle}>Eğitim Konuları</p>
                          <Badge variant="secondary" className="text-[10px]">Opsiyonel alan dolduruldu</Badge>
                        </div>
                        <div className={cn("mt-3 grid grid-cols-2 gap-4 text-[11px] leading-5", bodyFontClass)}>
                          <div className="space-y-1.5">
                            {leftCurriculum.map((item, index) => (
                              <p key={`generic-left-${index}`}>{item}</p>
                            ))}
                          </div>
                          <div className="space-y-1.5">
                            {rightCurriculum.map((item, index) => (
                              <p key={`generic-right-${index}`}>{item}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300/80 bg-white/60 p-5 text-sm text-slate-500">
                        Eğitim konuları alanı boş bırakıldığı için bu bölüm sertifikada gizlenir.
                      </div>
                    )}

                    {theme.heroVariant === "modern" ? (
                      <div className={cn("rounded-2xl border p-5", theme.accentPanel)}>
                        <p className="text-sm font-semibold">Dijital Paylaşım Alanı</p>
                        <p className="mt-2 text-sm text-slate-600">QR doğrulama ve paylaşım için optimize edilmiştir.</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col justify-between rounded-2xl border border-current/10 bg-black/5 p-6">
                    {theme.heroVariant === "academy" && design.showSeal ? (
                      <div className="ml-auto flex h-24 w-24 items-center justify-center rounded-full border-[6px] text-[#3f2c08] shadow-[inset_0_6px_12px_rgba(255,255,255,0.4)]" style={{ borderColor: design.primaryColor, background: `radial-gradient(circle, ${design.primaryColor} 0%, ${design.secondaryColor} 100%)` }}>
                        <Stamp className="h-9 w-9" />
                      </div>
                    ) : null}
                    <div>
                      <p className={cn("text-xs uppercase tracking-[0.28em]", theme.muted, bodyFontClass)} style={secondaryStyle}>Kurum Bilgileri</p>
                      <p className={cn("mt-4 text-2xl font-semibold", titleFontClass)}>{form.company_name || "Firma & OSGB"}</p>
                      <p className={cn("mt-3 text-sm leading-6", theme.muted, bodyFontClass)}>{form.company_address || "Adres bilgisi girilmedi"}</p>
                      <p className={cn("mt-2 text-sm", theme.muted, bodyFontClass)}>{form.company_phone || "Telefon bilgisi girilmedi"}</p>
                      {design.osgb_logo_url ? (
                        <div className="mt-4 flex h-16 items-center justify-start rounded-xl border bg-white/80 p-3">
                          <img src={design.osgb_logo_url} alt="OSGB logosu" className="max-h-full max-w-[160px] object-contain" />
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-8">
                      <SignatureRow signatures={signatures} muted={theme.muted} design={design} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
