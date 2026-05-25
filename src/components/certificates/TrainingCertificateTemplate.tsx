import { Award, Building2, CalendarDays, Clock3, FileCheck2, MapPin, QrCode, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CertificateDesignConfig, CertificateFormValues, CertificateParticipantInput, CertificateSignatureConfig } from "@/types/certificates";

type TrainingCertificateTemplateProps = {
  form: CertificateFormValues;
  participant?: CertificateParticipantInput | null;
  className?: string;
};

type FieldRow = {
  label: string;
  value: string;
  highlight?: boolean;
};

function text(value: unknown, fallback = "Belirtilmedi") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeDesignConfig(form: CertificateFormValues): CertificateDesignConfig {
  const source: Partial<CertificateDesignConfig> = form.design_config ?? {};
  const signatures = Array.isArray(source.signatures) ? [...source.signatures].slice(0, 4) : [];

  while (signatures.length < 2) {
    signatures.push({
      name: form.trainer_names[signatures.length] || "",
      title: signatures.length === 0 ? "Egitmen" : "Yetkili",
      image_url: "",
    });
  }

  return {
    primaryColor: source.primaryColor || "#005a9c",
    secondaryColor: source.secondaryColor || "#0ea5e9",
    fontFamily: source.fontFamily === "sans" || source.fontFamily === "gothic" ? source.fontFamily : "serif",
    showBadge: typeof source.showBadge === "boolean" ? source.showBadge : true,
    showSeal: typeof source.showSeal === "boolean" ? source.showSeal : true,
    titleText: source.titleText || "",
    descriptionText: source.descriptionText || "",
    osgb_logo_url: source.osgb_logo_url || "",
    signatureCount: Math.min(4, Math.max(1, Number(source.signatureCount || 2))),
    signatures: signatures as CertificateSignatureConfig[],
  };
}

function splitTopics(notes?: string) {
  return (notes || "")
    .split(/\r?\n|;|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function certificateTitle(form: CertificateFormValues, design: CertificateDesignConfig) {
  const custom = text(design.titleText, "");
  if (custom) return custom.toLocaleUpperCase("tr-TR");
  const type = text(form.certificate_type, "Katilim").toLocaleLowerCase("tr-TR");
  if (type.includes("basari")) return "EGITIM KATILIM VE BASARI BELGESI";
  if (text(form.training_name, "").toLocaleLowerCase("tr-TR").includes("is sagligi")) {
    return "IS SAGLIGI VE GUVENLIGI EGITIM SERTIFIKASI";
  }
  return "EGITIM KATILIM BELGESI";
}

function buildDescription(form: CertificateFormValues, participantName: string, design: CertificateDesignConfig) {
  const custom = text(design.descriptionText, "");
  const fallback =
    `Sayin ${participantName}, ${text(form.company_name, "ilgili kurum")} bunyesinde gorev yapmakta olup, ` +
    `${text(form.training_name, "egitim programi")} egitim programina ${text(form.training_date)} tarihinde katilmistir. ` +
    `Toplam ${text(form.training_duration)} sureli egitim sonunda bu belgeyi almaya hak kazanmistir.`;

  return (custom || fallback)
    .replaceAll("{name}", participantName)
    .replaceAll("{company}", text(form.company_name, "ilgili kurum"))
    .replaceAll("{training}", text(form.training_name, "egitim programi"))
    .replaceAll("{date}", text(form.training_date))
    .replaceAll("{duration}", text(form.training_duration));
}

function CertificateFieldRow({ row }: { row: FieldRow }) {
  return (
    <div className="grid grid-cols-[118px_12px_minmax(0,1fr)] items-start gap-2 text-[13px] leading-5">
      <dt className="cert-text-primary font-bold">{row.label}</dt>
      <span className="cert-text-primary font-bold">:</span>
      <dd className={cn("cert-text-body min-w-0 break-words", row.highlight && "cert-text-strong text-base font-extrabold")}>
        {row.value}
      </dd>
    </div>
  );
}

function CertificateTopicsBlock({ topics }: { topics: string[] }) {
  const columnCount = topics.length > 6 ? 2 : 1;
  return (
    <section className="rounded-xl border border-[#c7d7e7] bg-white p-3 shadow-sm">
      <div className="cert-text-primary mb-2 flex items-center gap-2">
        <FileCheck2 className="h-4 w-4" />
        <h3 className="text-sm font-extrabold">Egitim Konulari</h3>
      </div>
      {topics.length > 0 ? (
        <ul className={cn("cert-text-secondary gap-x-5 gap-y-1 text-[10.5px] font-semibold italic leading-[1.35]", columnCount === 2 ? "grid grid-cols-2" : "space-y-1")}>
          {topics.map((topic, index) => (
            <li key={`${topic}-${index}`} className="flex gap-1.5">
              <span className="mt-[2px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#0ea5e9]" />
              <span className="min-w-0">{topic}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cert-text-muted text-xs italic">Konu bilgisi bulunmamaktadir.</p>
      )}
    </section>
  );
}

function CertificateVerificationBlock({ code, date }: { code: string; date: string }) {
  return (
    <div className="cert-text-body flex items-end gap-3">
      <div className="flex h-16 w-16 items-center justify-center rounded-md border border-[#0b5f9e]/30 bg-white shadow-sm">
        <QrCode className="h-11 w-11 text-[#0b5f9e]" />
      </div>
      <div className="space-y-1 text-[10px] font-bold">
        <p className="cert-text-muted text-[9px] italic">Dogrulama Kodu</p>
        <p className="cert-text-dark max-w-[132px] truncate">{code}</p>
        <p className="cert-text-muted pt-1 text-[9px] italic">Duzenlenme Tarihi</p>
        <p className="cert-text-dark">{date}</p>
      </div>
    </div>
  );
}

function CertificateSignatureBlock({ signature, fallbackName }: { signature: CertificateSignatureConfig; fallbackName: string }) {
  const name = text(signature.name, fallbackName);
  const title = text(signature.title, "Yetkili");

  return (
    <div className="cert-text-primary min-w-0 text-center">
      <div className="mb-1 flex h-10 items-end justify-center">
        {signature.image_url ? (
          <img src={signature.image_url} alt={`${name} imzasi`} className="max-h-10 max-w-[150px] object-contain" />
        ) : (
          <div className="h-8 w-28 rounded-[50%] border-b-2 border-[#005a9c]/70" />
        )}
      </div>
      <div className="mx-auto mb-2 h-px w-36 bg-[#005a9c]/40" />
      <p className="cert-text-strong truncate text-sm font-extrabold">{name}</p>
      <p className="cert-text-primary mt-0.5 text-[11px] font-bold uppercase tracking-wide">{title}</p>
    </div>
  );
}

export function TrainingCertificateTemplate({ form, participant, className }: TrainingCertificateTemplateProps) {
  const design = normalizeDesignConfig(form);
  const participantName = text(participant?.name, "Katilimci Adi Soyadi");
  const topics = splitTopics(form.notes);
  const title = certificateTitle(form, design);
  const certificateNo = text(participant?.certificate_no, "Otomatik olusturulacak");
  const verificationCode = text(participant?.verification_code, "QR / dogrulama uretimde olusur");
  const trainerNames = form.trainer_names.map((name) => name.trim()).filter(Boolean).join(", ") || "Belirtilmedi";
  const signatures = design.signatures.slice(0, Math.min(2, design.signatureCount || 2));

  const fields: FieldRow[] = [
    { label: "Katilimci", value: participantName, highlight: true },
    { label: "Gorev", value: text(participant?.job_title) },
    { label: "Egitim", value: text(form.training_name) },
    { label: "Tarih", value: text(form.training_date) },
    { label: "Sure", value: text(form.training_duration) },
    { label: "Gecerlilik", value: text(form.validity_date, "Suresiz") },
    { label: "Sertifika No", value: certificateNo },
    { label: "Firma", value: text(form.company_name, "Firma bilgisi girilmedi") },
    { label: "Adres", value: text(form.company_address, "Adres bilgisi girilmedi") },
    { label: "Egitmenler", value: trainerNames },
  ];

  return (
    <>
      <style>{`
        @page {
          size: A4 landscape;
          margin: 0;
        }
        .certificate-paper,
        .certificate-paper * {
          color-scheme: light;
          forced-color-adjust: none;
        }
        .certificate-paper {
          background: #005492;
          color: #0f172a;
          isolation: isolate;
        }
        .certificate-paper__sheet {
          background: linear-gradient(180deg, #fbfdff 0%, #f6f9fc 100%);
          color: #0f172a;
        }
        .certificate-paper__sheet .cert-text-primary {
          color: #005a9c !important;
        }
        .certificate-paper__sheet .cert-text-secondary {
          color: #0064ad !important;
        }
        .certificate-paper__sheet .cert-text-body {
          color: #144b75 !important;
        }
        .certificate-paper__sheet .cert-text-strong {
          color: #004b88 !important;
        }
        .certificate-paper__sheet .cert-text-muted {
          color: #4e7192 !important;
        }
        .certificate-paper__sheet .cert-text-dark {
          color: #0f2f4a !important;
        }
        @media print {
          html, body { background: white !important; }
          .training-certificate-root {
            width: 297mm !important;
            height: 210mm !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      <article
        className={cn(
          "certificate-paper training-certificate-root relative mx-auto aspect-[1.414/1] w-full overflow-hidden rounded-[24px] bg-[#005492] p-[14px] text-[#0f172a] shadow-[0_28px_80px_rgba(0,54,102,0.26)]",
          className,
        )}
        style={{ colorScheme: "light" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_58%,rgba(255,255,255,0.18),transparent_26%),linear-gradient(135deg,#0699d6_0%,#00599e_36%,#003f77_100%)]" />
        <div className="absolute left-0 top-0 z-20 h-[42%] w-[36%] bg-[linear-gradient(135deg,#05a7dc_0%,#0067aa_56%,#004c8b_100%)] shadow-[10px_12px_20px_rgba(0,32,64,0.35)] [clip-path:polygon(0_0,100%_0,0_100%)]" />
        <div className="absolute left-[3.5%] top-[6%] z-30 flex h-[13%] w-[9.2%] items-center justify-center rounded-full border-[5px] border-white bg-[#057fbd]/85 text-white shadow-lg">
          {form.logo_url ? (
            <img src={form.logo_url} alt="Kurum logosu" className="h-[72%] w-[72%] object-contain brightness-0 invert" />
          ) : (
            <Award className="h-[52%] w-[52%]" />
          )}
        </div>

        <div className="relative z-10 flex h-full items-stretch p-[3.2%]">
          <div className="certificate-paper__sheet relative ml-[1.4%] mt-[1.4%] flex flex-1 flex-col overflow-hidden rounded-[22px] border border-white/70 bg-[#f8fafc] px-[5.2%] pb-[2.1%] pt-[4.5%] shadow-[inset_0_0_0_1px_rgba(0,80,145,0.08),0_18px_28px_rgba(0,25,60,0.28)]">
            <div className="pointer-events-none absolute right-[7%] top-[14%] z-0 h-[63%] w-[42%] rounded-full border-[42px] border-[#005a9c]/[0.045]" />
            <ShieldCheck className="pointer-events-none absolute right-[10%] top-[26%] z-0 h-[42%] w-[28%] text-[#005a9c]/[0.045]" />

            <header className="relative z-10 text-center">
              <p className="cert-text-primary text-[12px] font-black uppercase tracking-[0.22em]">
                {text(form.company_name, "ISGVIZYON KURUMSAL EGITIM")}
              </p>
              <p className="cert-text-secondary mt-1 text-[11px] font-extrabold uppercase tracking-[0.16em]">Egitim ve Belgelendirme Birimi</p>
              <h1 className="cert-text-primary mt-4 text-[clamp(18px,2.45vw,30px)] font-black uppercase tracking-tight">{title}</h1>
            </header>

            <main className="relative z-10 mt-3 grid flex-1 grid-cols-[46%_1fr] gap-[3.5%]">
              <section className="space-y-1.5 self-start">
                {fields.map((row) => (
                  <CertificateFieldRow key={row.label} row={row} />
                ))}
              </section>

              <section className="flex flex-col justify-between gap-3">
                <div className="rounded-2xl border border-[#d6e4f0] bg-white p-4 text-center shadow-sm">
                  <UserRound className="mx-auto mb-2 h-5 w-5 text-[#0b75bb]" />
                  <p className="cert-text-body text-[13px] font-semibold leading-6">{buildDescription(form, participantName, design)}</p>
                </div>

                <div className="cert-text-body grid grid-cols-3 gap-2 text-[10px] font-bold">
                  <div className="rounded-xl border border-[#d5e5f1] bg-white p-2">
                    <CalendarDays className="mb-1 h-4 w-4 text-[#0783c7]" />
                    Egitim Tarihi<br />
                    <span className="cert-text-primary">{text(form.training_date)}</span>
                  </div>
                  <div className="rounded-xl border border-[#d5e5f1] bg-white p-2">
                    <Clock3 className="mb-1 h-4 w-4 text-[#0783c7]" />
                    Egitim Suresi<br />
                    <span className="cert-text-primary">{text(form.training_duration)}</span>
                  </div>
                  <div className="rounded-xl border border-[#d5e5f1] bg-white p-2">
                    <Building2 className="mb-1 h-4 w-4 text-[#0783c7]" />
                    Belge Turu<br />
                    <span className="cert-text-primary">{text(form.certificate_type, "Katilim")}</span>
                  </div>
                </div>
              </section>
            </main>

            <footer className="relative z-10 mt-2 grid grid-cols-[42%_22%_1fr] items-end gap-4">
              <CertificateTopicsBlock topics={topics} />
              <CertificateVerificationBlock code={verificationCode} date={new Date().toLocaleDateString("tr-TR")} />
              <div className="grid grid-cols-2 gap-4">
                {signatures.map((signature, index) => (
                  <CertificateSignatureBlock
                    key={`${signature.title || "signature"}-${index}`}
                    signature={signature}
                    fallbackName={index === 0 ? text(form.trainer_names[0], "Egitmen Adi") : "Yetkili Adi"}
                  />
                ))}
              </div>
            </footer>

            <div className="cert-text-muted relative z-10 mt-1 flex items-center justify-between gap-3 border-t border-[#c8d9e8] pt-1 text-[8.5px] font-semibold">
              <span>Bu belge ISGVIZYON sistemi uzerinden dijital dogrulama kaydiyla olusturulmustur.</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {text(form.company_address, "Kurumsal kayit adresi")}
              </span>
            </div>
          </div>
        </div>
      </article>
    </>
  );
}
