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
  signatures?: Array<{ name?: string | null; title?: string | null }> | null;
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
  const trainers = list(raw.trainers, ["Belirtilmedi"]);
  const signatureDefaults = [
    { name: trainers[0] || "İSG Uzmanı", title: "İş Güvenliği Uzmanı" },
    { name: trainers[1] || "İşyeri Hekimi", title: "İşyeri Hekimi" },
    { name: "İşveren / Yetkili", title: "Kaşe - İmza" },
  ];
  const signatures = Array.isArray(raw.signatures)
    ? raw.signatures.slice(0, 3).map((signature, index) => ({
      name: text(signature?.name, signatureDefaults[index]?.name || "Yetkili"),
      title: text(signature?.title, signatureDefaults[index]?.title || "Yetkili"),
    }))
    : signatureDefaults;

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
    trainers,
    signatures,
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
  const isLongValue = label === "Adres" || label === "Eğitmenler";

  return (
    <div className="cert-info-row" data-long-value={isLongValue ? "true" : undefined}>
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

function parseTopicItem(item: string) {
  const match = item.match(/^(general|health|technical|manual)::(.+)$/i);
  if (!match) return { section: "manual", text: item };
  return { section: match[1].toLocaleLowerCase("en-US"), text: match[2].trim() };
}

function splitIntoColumns(items: string[], columnCount = 3) {
  const columns = Array.from({ length: columnCount }, () => [] as string[]);
  const manualItems: string[] = [];

  items.forEach((item) => {
    const parsed = parseTopicItem(item);
    if (parsed.section === "general") columns[0].push(parsed.text);
    else if (parsed.section === "health") columns[1].push(parsed.text);
    else if (parsed.section === "technical") columns[2].push(parsed.text);
    else manualItems.push(parsed.text);
  });

  manualItems.forEach((item, index) => {
    columns[index % columnCount].push(item);
  });

  return columns;
}

export default function CertificatePreview({ data: rawData, qrNode, qrImageUrl, className = "", scale = 1 }: CertificatePreviewProps) {
  const data = normalizePreviewData(rawData);
  const topicColumns = splitIntoColumns(data.trainingTopics, 3);
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

        <header className="cert-header">
          <div className="cert-logo-slot">
            {data.logoUrl ? (
              <img src={data.logoUrl} alt="Firma logosu" />
            ) : (
              <span>LOGO</span>
            )}
          </div>
          <div className="cert-title-block">
            <div className="cert-company">{data.companyName}</div>
            <div className="cert-sub-company">{data.trainingTitle}</div>
            <div className="cert-unit">EĞİTİM VE BELGELENDİRME BİRİMİ</div>
            <h1>
              <span>İŞ SAĞLIĞI VE GÜVENLİĞİ</span>
              <strong>TEMEL EĞİTİM KATILIM SERTİFİKASI</strong>
            </h1>
          </div>
          <div className="cert-seal">
            <span>GÜVENLİ</span>
            <span>ÇALIŞMA</span>
            <span>GÜVENCELİ</span>
            <span>GELECEK</span>
          </div>
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
            <h2>EĞİTİM KONULARI</h2>
            <div className="cert-topic-columns">
              {topicColumns.map((column, columnIndex) => (
                <div key={columnIndex} className="cert-topic-column">
                  <h3>{columnIndex + 1}. {columnIndex === 0 ? "GENEL KONULAR" : columnIndex === 1 ? "SAĞLIK KONULARI" : "TEKNİK KONULAR"}</h3>
                  <ul>
                    {column.map((topic, index) => (
                      <li key={`${topic}-${columnIndex}-${index}`}>{topic}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer className="cert-footer">
          <div className="cert-signatures">
            <div>
              <div className="cert-signature-line">
                <span>{data.signatures[0]?.name || "İSG Uzmanı"}</span>
                <small>{data.signatures[0]?.title || "İş Güvenliği Uzmanı"}</small>
              </div>
            </div>
            <div>
              <div className="cert-signature-line">
                <span>{data.signatures[1]?.name || "İşyeri Hekimi"}</span>
                <small>{data.signatures[1]?.title || "İşyeri Hekimi"}</small>
              </div>
            </div>
            <div>
              <div className="cert-signature-line">
                <span>{data.signatures[2]?.name || "İşveren / Yetkili"}</span>
                <small>{data.signatures[2]?.title || "Kaşe - İmza"}</small>
              </div>
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
          background: #fffdf8;
          color: #061d44;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .cert-preview * {
          box-sizing: border-box;
        }

        .cert-outer-frame {
          position: absolute;
          inset: 10px;
          border: 4px solid #c89b2d;
          pointer-events: none;
          z-index: 2;
        }

        .cert-inner-frame {
          position: absolute;
          inset: 20px;
          border: 4px double #08265a;
          pointer-events: none;
          z-index: 2;
        }

        .cert-header {
          position: relative;
          z-index: 3;
          display: grid;
          grid-template-columns: 128px minmax(0, 1fr) 150px;
          align-items: start;
          gap: 18px;
          padding: 42px 78px 0 78px;
          min-height: 190px;
        }

        .cert-title-block {
          min-width: 0;
          text-align: center;
          padding-top: 0;
        }

        .cert-logo-slot {
          width: 112px;
          height: 112px;
          border-radius: 18px;
          border: 1px solid rgba(8, 38, 90, 0.14);
          background: rgba(255, 255, 255, 0.88);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px;
          box-shadow: 0 8px 18px rgba(8, 38, 90, 0.08);
        }

        .cert-logo-slot img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          display: block;
        }

        .cert-logo-slot span {
          color: rgba(8, 38, 90, 0.36);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
        }

        .cert-company {
          color: #061d44;
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

        .cert-sub-company {
          margin-top: 5px;
          color: #061d44;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .cert-unit {
          margin-top: 8px;
          color: #111827;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .cert-title-block h1 {
          margin: 20px auto 0;
          max-width: 820px;
          color: #061d44;
          font-size: 32px;
          line-height: 1.08;
          font-weight: 900;
          letter-spacing: 0.015em;
          text-transform: uppercase;
          overflow-wrap: anywhere;
        }

        .cert-title-block h1 span,
        .cert-title-block h1 strong {
          display: block;
        }

        .cert-seal {
          justify-self: end;
          width: 112px;
          height: 112px;
          margin-top: 4px;
          border-radius: 999px;
          border: 9px solid #d4a53b;
          background: #08265a;
          color: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-size: 10px;
          line-height: 1.08;
          font-weight: 900;
          box-shadow: 0 8px 18px rgba(8, 38, 90, 0.18);
        }

        .cert-main-grid {
          position: relative;
          z-index: 3;
          display: grid;
          grid-template-columns: 560px 1fr;
          grid-template-rows: minmax(178px, auto) 150px;
          column-gap: 34px;
          row-gap: 22px;
          padding: 0 62px 0;
        }

        .cert-info-card {
          display: grid;
          grid-auto-rows: minmax(22px, auto);
          align-content: start;
          gap: 7px;
          min-width: 0;
        }

        .cert-info-row {
          display: grid;
          grid-template-columns: 132px 18px minmax(0, 1fr);
          align-items: start;
          min-width: 0;
          color: #111827;
          font-size: 13px;
          line-height: 1.28;
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

        .cert-info-row[data-long-value="true"] {
          font-size: 12px;
          line-height: 1.32;
        }

        .cert-info-row[data-long-value="true"] .cert-info-value {
          -webkit-line-clamp: 4;
          white-space: normal;
        }

        .cert-info-value-strong {
          color: var(--cert-primary);
          font-weight: 900;
          font-size: 15px;
          -webkit-line-clamp: 2;
        }

        .cert-summary-card {
          align-self: start;
          min-height: 152px;
          padding: 24px 28px;
          border: 2px solid #d4a53b;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.92);
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
          grid-column: 1 / 3;
          width: auto;
          min-height: 142px;
          padding: 20px 22px 14px;
          border: 2px solid #d4a53b;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.92);
          position: relative;
        }

        .cert-topics-card h2 {
          position: absolute;
          left: 50%;
          top: -16px;
          transform: translateX(-50%);
          margin: 0;
          border-radius: 999px;
          background: #08265a;
          color: #fff;
          padding: 6px 54px;
          font-size: 14px;
          line-height: 1;
          white-space: nowrap;
        }

        .cert-topic-columns {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .cert-topic-column {
          min-width: 0;
          border-right: 1px solid rgba(212, 165, 59, 0.45);
          padding-right: 12px;
        }

        .cert-topic-column:last-child {
          border-right: none;
        }

        .cert-topic-column h3 {
          margin: 0 0 7px;
          color: #061d44;
          font-size: 11px;
          font-weight: 900;
        }

        .cert-topic-column ul {
          margin: 0;
          padding-left: 14px;
          display: grid;
          gap: 3px;
          color: #111827;
          font-size: 9.2px;
          line-height: 1.22;
        }

        .cert-topic-column li {
          overflow-wrap: anywhere;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .cert-footer {
          position: absolute;
          z-index: 4;
          left: 86px;
          right: 82px;
          bottom: 42px;
          height: 92px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 130px;
          gap: 30px;
          align-items: end;
        }

        .cert-signatures {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 44px;
          align-self: end;
        }

        .cert-signature-line {
          min-width: 0;
          border-top: 2px solid #111827;
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
          white-space: pre-line;
        }

        .cert-qr-section {
          align-self: end;
          justify-self: end;
          width: 126px;
          text-align: center;
          color: #25465c;
        }

        .cert-qr-box {
          width: 92px;
          height: 92px;
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
