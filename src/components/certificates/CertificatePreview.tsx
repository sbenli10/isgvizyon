import React from "react";

export type CertificatePreviewData = {
  participantName?: string | null;
  role?: string | null;
  trainingTitle?: string | null;
  date?: string | null;
  duration?: string | null;
  validity?: string | null;
  certificateNo?: string | null;
  companyName?: string | null;
  address?: string | null;
  trainers?: string[] | null;
  trainingTopics?: string[] | null;
  verificationCode?: string | null;
  issueDate?: string | null;
  summaryText?: string | null;
  logoUrl?: string | null;
  osgbLogoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

type CertificatePreviewProps = {
  data: CertificatePreviewData;
  qrNode?: React.ReactNode;
  qrImageUrl?: string | null;
  className?: string;
  scale?: number;
};

const PREVIEW_LAYOUT = {
  width: 1123,
  height: 794,
  padding: 34,
} as const;

function text(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function list(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const normalized = value.map((item) => text(item)).filter(Boolean);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizePreviewData(raw: CertificatePreviewData) {
  const participantName = text(raw.participantName, "Katılımcı");
  const companyName = text(raw.companyName, "Firma Bilgisi Girilmedi");
  const trainingTitle = text(raw.trainingTitle, "Eğitim Bilgisi Girilmedi");
  return {
    participantName,
    role: text(raw.role, "Belirtilmedi"),
    trainingTitle,
    date: text(raw.date, "Belirtilmedi"),
    duration: text(raw.duration, "Belirtilmedi"),
    validity: text(raw.validity, "Süresiz"),
    certificateNo: text(raw.certificateNo, "Belirtilmedi"),
    companyName,
    address: text(raw.address),
    trainers: list(raw.trainers, ["Belirtilmedi"]),
    trainingTopics: list(raw.trainingTopics, ["Konu bilgisi bulunmamaktadır."]),
    verificationCode: text(raw.verificationCode, "Üretimde oluşur"),
    issueDate: text(raw.issueDate, new Date().toLocaleDateString("tr-TR")),
    summaryText: text(
      raw.summaryText,
      `${participantName}, çalışanların iş sağlığı ve güvenliği eğitimlerine ilişkin program kapsamında verilen eğitimi başarıyla tamamlayarak bu belgeyi almaya hak kazanmıştır.`,
    ),
    logoUrl: text(raw.logoUrl),
    osgbLogoUrl: text(raw.osgbLogoUrl),
    primaryColor: text(raw.primaryColor, "#0b5489"),
    secondaryColor: text(raw.secondaryColor, "#0389c7"),
  };
}

function InfoRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="cert-info-row">
      <div className="cert-info-label">{label}</div>
      <div className="cert-info-colon">:</div>
      <div className={strong ? "cert-info-value cert-info-value-strong" : "cert-info-value"}>{value}</div>
    </div>
  );
}

function QrSection({ qrNode, qrImageUrl }: { qrNode?: React.ReactNode; qrImageUrl?: string | null }) {
  return (
    <div className="cert-qr-section">
      <div className="cert-qr-box">
        {qrNode || (qrImageUrl ? <img src={qrImageUrl} alt="Sertifika doğrulama QR kodu" /> : <span>QR</span>)}
      </div>
      <div className="cert-qr-title">QR ile doğrula</div>
      <div className="cert-qr-note">Doğrulama: QR kodu okutun veya doğrulama sayfasını ziyaret edin.</div>
    </div>
  );
}

export default function CertificatePreview({ data: rawData, qrNode, qrImageUrl, className = "", scale = 1 }: CertificatePreviewProps) {
  const data = normalizePreviewData(rawData);
  const rows = [
    ["Katılımcı", data.participantName, true] as const,
    ["Görev", data.role] as const,
    ["Eğitim", data.trainingTitle] as const,
    ["Tarih", data.date] as const,
    ["Süre", data.duration] as const,
    ["Geçerlilik", data.validity] as const,
    ["Sertifika No", data.certificateNo] as const,
    ["Firma", data.companyName] as const,
    ["Adres", data.address || "-"] as const,
    ["Eğitmenler", data.trainers.join(", ")] as const,
  ];

  return (
    <div
      className={`cert-preview-shell ${className}`}
      style={{
        width: PREVIEW_LAYOUT.width * scale,
        height: PREVIEW_LAYOUT.height * scale,
      }}
    >
      <div
        className="cert-preview"
        style={{
          width: PREVIEW_LAYOUT.width,
          height: PREVIEW_LAYOUT.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          ["--cert-primary" as string]: data.primaryColor,
          ["--cert-secondary" as string]: data.secondaryColor,
        }}
      >
        <div className="cert-outer-frame" />
        <div className="cert-inner-frame" />
        <div className="cert-diagonal" />
        <div className="cert-watermark">İSGVİZYON</div>

        <header className="cert-header">
          <div className="cert-logo-slot">{data.logoUrl ? <img src={data.logoUrl} alt="Logo" /> : null}</div>
          <div className="cert-title-block">
            <div className="cert-company">{data.companyName}</div>
            <div className="cert-unit">EĞİTİM VE BELGELENDİRME BİRİMİ</div>
            <h1>İŞ SAĞLIĞI VE GÜVENLİĞİ EĞİTİM SERTİFİKASI</h1>
          </div>
          <div className="cert-logo-slot cert-logo-slot-right">{data.osgbLogoUrl ? <img src={data.osgbLogoUrl} alt="OSGB Logo" /> : null}</div>
        </header>

        <main className="cert-main-grid">
          <section className="cert-info-card">
            {rows.map(([label, value, strong]) => (
              <InfoRow key={label} label={label} value={value} strong={Boolean(strong)} />
            ))}
          </section>

          <section className="cert-summary-card">
            <p>{data.summaryText}</p>
          </section>

          <section className="cert-topics-card">
            <h2>Eğitim Konuları</h2>
            <ul>
              {data.trainingTopics.map((topic, index) => (
                <li key={`${topic}-${index}`}>{topic}</li>
              ))}
            </ul>
          </section>
        </main>

        <footer className="cert-footer">
          <div className="cert-footer-meta">
            <div>
              <strong>Doğrulama Kodu</strong>
              <span>{data.verificationCode}</span>
            </div>
            <div>
              <strong>Düzenlenme Tarihi</strong>
              <span>{data.issueDate}</span>
            </div>
          </div>

          <div className="cert-signatures">
            <div className="cert-signature-line">
              <span>{data.trainers[0] || "Eğitmen"}</span>
              <small>Eğitmen</small>
            </div>
            <div className="cert-signature-line">
              <span>{data.companyName}</span>
              <small>Yetkili</small>
            </div>
          </div>

          <QrSection qrNode={qrNode} qrImageUrl={qrImageUrl} />
        </footer>
      </div>

      <style>{`
        .cert-preview-shell {
          overflow: hidden;
          background: transparent;
        }

        .cert-preview {
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          background: #fbfdff;
          color: #0b3554;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .cert-preview * {
          box-sizing: border-box;
        }

        .cert-outer-frame {
          position: absolute;
          inset: 18px;
          border: 9px solid #cbdbe8;
          pointer-events: none;
          z-index: 2;
        }

        .cert-inner-frame {
          position: absolute;
          inset: 42px;
          border: 1px solid rgba(0, 65, 105, 0.24);
          pointer-events: none;
          z-index: 2;
        }

        .cert-diagonal {
          position: absolute;
          left: 0;
          top: 0;
          width: 390px;
          height: 270px;
          background: linear-gradient(135deg, var(--cert-secondary), var(--cert-primary));
          clip-path: polygon(0 0, 100% 0, 0 100%);
          z-index: 1;
        }

        .cert-watermark {
          position: absolute;
          right: 116px;
          top: 338px;
          z-index: 0;
          font-size: 64px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: rgba(0, 65, 105, 0.045);
          user-select: none;
        }

        .cert-header {
          position: relative;
          z-index: 3;
          display: grid;
          grid-template-columns: 130px minmax(0, 1fr) 130px;
          align-items: start;
          gap: 24px;
          padding: 64px 78px 0;
          min-height: 202px;
        }

        .cert-logo-slot {
          width: 108px;
          height: 76px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cert-logo-slot img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .cert-logo-slot-right {
          justify-self: end;
          width: 112px;
          height: 54px;
        }

        .cert-title-block {
          min-width: 0;
          text-align: center;
          padding-top: 4px;
        }

        .cert-company {
          color: var(--cert-primary);
          font-weight: 800;
          font-size: 18px;
          line-height: 1.18;
          text-transform: uppercase;
          overflow-wrap: anywhere;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .cert-unit {
          margin-top: 10px;
          color: var(--cert-primary);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .cert-title-block h1 {
          margin: 22px auto 0;
          max-width: 820px;
          color: var(--cert-primary);
          font-size: 31px;
          line-height: 1.13;
          font-weight: 900;
          letter-spacing: 0.015em;
          text-transform: uppercase;
          overflow-wrap: anywhere;
        }

        .cert-main-grid {
          position: relative;
          z-index: 3;
          display: grid;
          grid-template-columns: 430px 1fr;
          grid-template-rows: minmax(184px, auto) 148px;
          column-gap: 44px;
          row-gap: 26px;
          padding: 0 100px 0;
        }

        .cert-info-card {
          display: grid;
          grid-auto-rows: minmax(20px, auto);
          align-content: start;
          gap: 5px;
          min-width: 0;
        }

        .cert-info-row {
          display: grid;
          grid-template-columns: 128px 16px minmax(0, 1fr);
          align-items: start;
          min-width: 0;
          color: #0a395a;
          font-size: 14px;
          line-height: 1.22;
        }

        .cert-info-label,
        .cert-info-colon {
          color: var(--cert-primary);
          font-weight: 800;
          white-space: nowrap;
        }

        .cert-info-value {
          min-width: 0;
          overflow-wrap: anywhere;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .cert-info-value-strong {
          color: var(--cert-primary);
          font-weight: 900;
          font-size: 15px;
          -webkit-line-clamp: 2;
        }

        .cert-summary-card {
          align-self: start;
          min-height: 168px;
          padding: 25px 28px;
          border: 1px solid rgba(0, 65, 105, 0.22);
          background: rgba(255, 255, 255, 0.88);
          box-shadow: 0 8px 22px rgba(0, 45, 82, 0.05);
        }

        .cert-summary-card p {
          margin: 0;
          color: #0b3554;
          font-size: 15px;
          line-height: 1.42;
          overflow-wrap: anywhere;
          display: -webkit-box;
          -webkit-line-clamp: 7;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .cert-topics-card {
          grid-column: 1 / 2;
          width: 430px;
          min-height: 148px;
          padding: 17px 20px;
          border: 1px solid rgba(0, 65, 105, 0.22);
          background: rgba(255, 255, 255, 0.86);
        }

        .cert-topics-card h2 {
          margin: 0 0 10px;
          color: var(--cert-primary);
          font-size: 15px;
          line-height: 1.1;
        }

        .cert-topics-card ul {
          margin: 0;
          padding-left: 17px;
          display: grid;
          gap: 3px;
          color: #0b3554;
          font-size: 11px;
          line-height: 1.22;
        }

        .cert-topics-card li {
          overflow-wrap: anywhere;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .cert-footer {
          position: absolute;
          z-index: 4;
          left: 96px;
          right: 92px;
          bottom: 42px;
          height: 120px;
          display: grid;
          grid-template-columns: 270px minmax(0, 1fr) 150px;
          gap: 30px;
          align-items: end;
          border-top: 1px solid rgba(0, 65, 105, 0.18);
          padding-top: 16px;
        }

        .cert-footer-meta {
          align-self: end;
          display: grid;
          gap: 10px;
          color: #25465c;
          font-size: 11px;
          line-height: 1.25;
          min-width: 0;
        }

        .cert-footer-meta div {
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        .cert-footer-meta strong {
          color: var(--cert-primary);
          font-size: 11px;
        }

        .cert-footer-meta span {
          min-width: 0;
          overflow-wrap: anywhere;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .cert-signatures {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 26px;
          align-self: end;
        }

        .cert-signature-line {
          min-width: 0;
          border-top: 1px solid var(--cert-primary);
          padding-top: 9px;
          text-align: center;
          color: #0b3554;
        }

        .cert-signature-line span {
          display: block;
          font-weight: 800;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cert-signature-line small {
          display: block;
          margin-top: 2px;
          font-size: 10px;
          color: #4d6677;
        }

        .cert-qr-section {
          align-self: end;
          justify-self: end;
          width: 132px;
          text-align: center;
          color: #25465c;
        }

        .cert-qr-box {
          width: 104px;
          height: 104px;
          margin: 0 auto 5px;
          border: 1px solid #d4d9dc;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .cert-qr-box img,
        .cert-qr-box canvas,
        .cert-qr-box svg {
          width: 100% !important;
          height: 100% !important;
          object-fit: contain;
          display: block;
        }

        .cert-qr-box span {
          font-weight: 900;
          color: #9aa7af;
          letter-spacing: 0.08em;
        }

        .cert-qr-title {
          color: var(--cert-primary);
          font-weight: 900;
          font-size: 11px;
          line-height: 1.15;
        }

        .cert-qr-note {
          margin-top: 3px;
          color: #4d6677;
          font-size: 8px;
          line-height: 1.16;
        }
      `}</style>
    </div>
  );
}
