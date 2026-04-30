import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getBulkCapaLegalBasis } from "@/lib/bulkCapaLegalBasis";

type PreviewEntry = {
  id: string;
  description: string;
  riskDefinition: string;
  correctiveAction: string;
  preventiveAction: string;
  importance_level: "Düşük" | "Orta" | "Yüksek" | "Kritik";
  termin_date: string;
  related_department: string;
  notification_method: string;
  responsible_name: string;
  responsible_role: string;
  approver_name: string;
  approver_title: string;
  include_stamp: boolean;
  media_urls: string[];
  ai_analyzed: boolean;
};

type GeneralInfo = {
  report_date: string;
  observer_name: string;
  report_no: string;
  employer_representative_name: string;
  area_region: string;
};

type ProfileContext = {
  full_name: string | null;
  position: string | null;
};

type SelectedCompany = {
  notes?: string | null;
  industry?: string | null;
} | null;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewFocusEntryId: string | null;
  focusedPreviewEntry: PreviewEntry | null;
  lastSingleInspectionId: string | null;
  lastSingleCreatedAt: string | null;
  generalInfo: GeneralInfo;
  profileContext: ProfileContext | null;
  reportCompanyName: string;
  selectedCompany: SelectedCompany;
  previewEntries: PreviewEntry[];
  overallAnalysis: string;
  saving: boolean;
  onClose: () => void;
  onReturnSinglePreviewToEdit: () => void;
  onSaveSinglePreviewExport: () => Promise<void>;
  onOpenInspection: (inspectionId: string) => void;
};

const buildMediaKey = (url: string, index: number) => `${url}-${index}`;

export default function BulkCapaPreviewDialog({
  open,
  onOpenChange,
  previewFocusEntryId,
  focusedPreviewEntry,
  lastSingleInspectionId,
  lastSingleCreatedAt,
  generalInfo,
  profileContext,
  reportCompanyName,
  selectedCompany,
  previewEntries,
  overallAnalysis,
  saving,
  onClose,
  onReturnSinglePreviewToEdit,
  onSaveSinglePreviewExport,
  onOpenInspection,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] overflow-y-auto border-border/50 bg-slate-200/95 p-0 text-slate-900 shadow-[0_40px_120px_rgba(15,23,42,0.45)] sm:w-full sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 border-b border-slate-300 bg-white px-6 py-4 text-xl font-semibold text-slate-900">
            {previewFocusEntryId ? "Tekli DÖF Önizlemesi" : "Rapor Önizlemesi"}
            {previewFocusEntryId ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <Sparkles className="h-5 w-5 text-yellow-500" />
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Oluşturulan DÖF raporunu inceleyin, düzenlemeye dönün veya Word çıktısını indirin.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(94vh-76px)] overflow-y-auto bg-slate-200 px-3 py-4 text-slate-900 sm:px-4 sm:py-6 md:px-8">
          {previewFocusEntryId && focusedPreviewEntry ? (
            <div className="mx-auto mb-6 flex max-w-[794px] flex-col gap-3 rounded-[24px] border border-emerald-200 bg-white/95 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">
                  Tekli Kayıt Aksiyonları
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Tekli DÖF kaydı hazır. Bu kaydı arşivleyip kompakt Word çıktısını hemen indirebilirsiniz.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                {lastSingleInspectionId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenInspection(lastSingleInspectionId)}
                    className="border-violet-300 bg-violet-50 !text-violet-950 hover:bg-violet-100 hover:!text-violet-950 disabled:!text-violet-900/80"
                    style={{ color: "#2e1065" }}
                  >
                    Denetimler Kaydını Aç
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={onReturnSinglePreviewToEdit}
                  className="border-cyan-300 bg-cyan-50 !text-cyan-950 hover:bg-cyan-100 hover:!text-cyan-950 disabled:!text-cyan-900/80"
                  style={{ color: "#164e63" }}
                >
                  Düzenlemeye Geri Dön
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="border-slate-300 bg-white !text-slate-800 hover:bg-slate-100 hover:!text-slate-900 disabled:!text-slate-600"
                  style={{ color: "#1e293b" }}
                >
                  Kapat
                </Button>
                <Button
                  type="button"
                  onClick={() => void onSaveSinglePreviewExport()}
                  disabled={saving}
                  className="bg-emerald-500 !text-white shadow-[0_18px_40px_rgba(16,185,129,0.2)] hover:bg-emerald-400 hover:!text-white"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Hazırlanıyor...
                    </>
                  ) : (
                    "Kaydet / Word İndir"
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          {previewFocusEntryId && focusedPreviewEntry ? (
            <div className="mx-auto mb-6 flex max-w-[794px] flex-wrap items-center gap-2 rounded-[20px] border border-slate-200 bg-white/90 px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                Inspection ID: {lastSingleInspectionId || "Henüz oluşturulmadı"}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                Rapor No: {generalInfo.report_no || "Belirtilmedi"}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                Firma: {reportCompanyName || "Belirtilmedi"}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                Oluşturulma Saati:{" "}
                {lastSingleCreatedAt
                  ? new Date(lastSingleCreatedAt).toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Henüz yok"}
              </span>
            </div>
          ) : null}

          <div
            className="mx-auto min-h-[1123px] max-w-[794px] rounded-[6px] bg-white px-4 py-6 text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:px-6 sm:py-8 md:px-14 md:py-14 [&_h2]:text-slate-800 [&_h3]:text-[#1d3760] [&_p]:!text-slate-900 [&_span]:text-inherit [&_td]:!text-slate-900 [&_th]:!text-white"
            style={{ color: "#0f172a" }}
          >
            <div className="flex items-center justify-end border-b border-slate-300 pb-2 text-[11px] text-slate-500">
              <span>İSG TESPİT VE DÖF RAPORU</span>
              <span className="mx-2">|</span>
              <span>
                {generalInfo.report_date
                  ? new Date(generalInfo.report_date).toLocaleDateString("tr-TR")
                  : new Date().toLocaleDateString("tr-TR")}
              </span>
            </div>

            <div className="mt-8 text-center">
              <h2 className="text-[28px] font-bold tracking-tight text-slate-800">
                İŞ SAĞLIĞI VE GÜVENLİĞİ
              </h2>
              <p className="mt-2 text-[17px] font-semibold text-slate-800">
                TESPİT VE DÜZELTİCİ / ÖNLEYİCİ FAALİYET (DÖF) RAPORU
              </p>
            </div>

            <div className="mt-5 border-b-2 border-red-500" />

            <div className="mt-4 flex justify-center">
              <table className="w-full max-w-[560px] border-collapse text-sm">
                <tbody>
                  {[
                    [
                      "Rapor Tarihi",
                      generalInfo.report_date
                        ? new Date(generalInfo.report_date).toLocaleDateString("tr-TR")
                        : new Date().toLocaleDateString("tr-TR"),
                    ],
                    [
                      "Hazırlayan",
                      `${generalInfo.observer_name || profileContext?.full_name || "İsim Soyisim"} - ${
                        profileContext?.position || "İş Güvenliği Uzmanı"
                      }`,
                    ],
                    ["Konu", `${generalInfo.area_region || "Genel Çalışma Sahası"} Risk Analizi`],
                    [
                      "Tehlike Sınıfı",
                      (selectedCompany?.notes || selectedCompany?.industry || "Çok Tehlikeli")
                        .toString()
                        .toLocaleUpperCase("tr-TR"),
                    ],
                  ].map(([label, value], index) => (
                    <tr key={label}>
                      <td className="w-[32%] border border-slate-400 bg-[#1d3760] px-3 py-2 font-semibold text-white">
                        {label}
                      </td>
                      <td
                        className={`border border-slate-400 px-3 py-2 ${
                          index === 3 ? "font-bold text-red-600" : "text-slate-900"
                        }`}
                      >
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previewEntries.map((entry, idx) => {
              const legalBasis = getBulkCapaLegalBasis({
                description: entry.description,
                riskDefinition: entry.riskDefinition,
                relatedDepartment: entry.related_department,
              });

              return (
                <div key={entry.id} className="mt-10">
                  {entry.media_urls.length > 0 ? (
                    <div
                      className={`grid gap-3 ${
                        entry.media_urls.length === 1
                          ? "grid-cols-1 justify-items-center"
                          : entry.media_urls.length === 2
                            ? "grid-cols-2"
                            : "grid-cols-3"
                      } max-sm:grid-cols-1`}
                    >
                      {entry.media_urls.map((imageUrl, imgIdx) => (
                        <div
                          key={buildMediaKey(imageUrl, imgIdx)}
                          className="border border-slate-400 bg-white p-2"
                        >
                          <img
                            src={imageUrl}
                            alt={`Fotoğraf ${imgIdx + 1}`}
                            className={`mx-auto object-cover ${
                              entry.media_urls.length === 1
                                ? "h-[240px] w-[240px]"
                                : "h-[190px] w-full"
                            }`}
                          />
                          <p className="mt-2 text-center text-[11px] leading-4 text-slate-700">
                            Görsel Tanım — {entry.related_department || "Genel Alan"}
                            <br />
                            {entry.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-6 border-b-2 border-[#1d3760] pb-1">
                    <h3 className="text-[26px] font-bold text-[#1d3760]">
                      {idx + 1}. {(entry.related_department || "GENEL SAHA").toUpperCase()}
                    </h3>
                  </div>

                  <div className="mt-3">
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr>
                          {[
                            "TESPİT EDİLEN UYGUNSUZLUK",
                            "RİSK ANALİZİ",
                            "MEVZUAT DAYANAĞI",
                            "ÖNERİLEN DÖF (AKSİYON)",
                          ].map((title) => (
                            <th
                              key={title}
                              className="border border-slate-400 bg-[#1d3760] px-2 py-2 text-center font-bold text-white"
                            >
                              {title}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-slate-400 px-2 py-2 align-top text-slate-900">
                            {entry.description}
                          </td>
                          <td className="border border-slate-400 px-2 py-2 align-top text-slate-900">
                            {entry.riskDefinition}
                          </td>
                          <td className="border border-slate-400 px-2 py-2 align-top text-slate-900">
                            {legalBasis}
                          </td>
                          <td className="border border-slate-400 px-2 py-2 align-top text-slate-900">
                            <span
                              className={
                                entry.importance_level === "Kritik"
                                  ? "font-bold text-red-600"
                                  : "text-slate-900"
                              }
                            >
                              {entry.correctiveAction}
                            </span>
                            {entry.preventiveAction ? (
                              <div className="mt-1 text-slate-700">{entry.preventiveAction}</div>
                            ) : null}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 border-b-2 border-[#1d3760] pb-1">
                    <p className="text-[12px] font-bold text-slate-900">
                      FOTOĞRAF KANITI — {(entry.related_department || "GENEL SAHA").toUpperCase()} UYGUNSUZLUKLARI
                    </p>
                  </div>
                </div>
              );
            })}

            <div className="mt-12 border-b-2 border-[#1d3760] pb-1">
              <h3 className="text-[24px] font-bold text-[#1d3760]">TERMİN VE AKSİYON PLANI</h3>
            </div>

            <div className="mt-3 flex justify-center">
              <table className="w-full max-w-[610px] border-collapse text-[13px]">
                <thead>
                  <tr>
                    {["RİSK SEVİYESİ", "TERMİN", "YAPILACAK İŞLEMLER"].map((title) => (
                      <th
                        key={title}
                        className="border border-slate-400 bg-[#1d3760] px-2 py-2 text-center font-bold text-white"
                      >
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewEntries.map((entry) => {
                    const riskColors =
                      entry.importance_level === "Kritik" || entry.importance_level === "Yüksek"
                        ? "bg-red-700 text-white"
                        : entry.importance_level === "Orta"
                          ? "bg-orange-500 text-white"
                          : "bg-green-700 text-white";

                    return (
                      <tr key={`${entry.id}-action`}>
                        <td className={`border border-slate-400 px-2 py-2 text-center font-bold ${riskColors}`}>
                          {entry.importance_level === "Kritik" || entry.importance_level === "Yüksek"
                            ? "YÜKSEK RİSK"
                            : entry.importance_level === "Orta"
                              ? "ORTA RİSK"
                              : "DÜŞÜK RİSK"}
                        </td>
                        <td className="border border-slate-400 px-2 py-2 text-center font-bold text-slate-900">
                          {entry.termin_date
                            ? new Date(entry.termin_date).toLocaleDateString("tr-TR")
                            : "-"}
                        </td>
                        <td className="border border-slate-400 px-2 py-2 text-slate-900">
                          {entry.correctiveAction}
                          {entry.preventiveAction ? (
                            <div className="mt-1 text-slate-700">{entry.preventiveAction}</div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-12 border-b-2 border-red-500 pb-1">
              <p className="text-[18px] font-bold text-red-600">HUKUKİ HATIRLATMA (Yönetici Özeti)</p>
            </div>

            <div className="mt-4 border-2 border-red-500 bg-[#fff7f7] px-5 py-4">
              <p className="text-[13px] font-bold text-red-600">
                6331 Sayılı İş Sağlığı ve Güvenliği Kanunu gereğince:
              </p>
              <p className="mt-3 text-center text-[13px] font-bold leading-6 text-slate-900">
                İŞVEREN, ÇALIŞANLARIN SAĞLIĞINI VE GÜVENLİĞİNİ SAĞLAMAKLA YÜKÜMLÜDÜR.
              </p>
              <p className="mt-4 text-[13px] leading-6 text-slate-800">
                {overallAnalysis.trim() ||
                  "Bu raporda fotoğraf kanıtlarıyla sunulan uygunsuzlukların giderilmemesi durumunda meydana gelebilecek iş kazalarında işveren, ilgili mevzuat kapsamında idari ve hukuki sorumlulukla karşılaşabilir."}
              </p>
            </div>

            <p className="mt-12 text-right text-[13px] text-slate-700">Onayınıza arz ederim.</p>

            <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-10">
              <div className="text-center">
                <div className="mx-auto h-px w-full max-w-[220px] bg-slate-800" />
                <p className="mt-3 text-[13px] font-semibold text-slate-900">Hazırlayan</p>
                <p className="mt-1 text-[12px] text-slate-600">
                  {generalInfo.observer_name || profileContext?.full_name || "İş Güvenliği Uzmanı"}
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto h-px w-full max-w-[220px] bg-slate-800" />
                <p className="mt-3 text-[13px] font-semibold text-slate-900">Onaylayan</p>
                <p className="mt-1 text-[12px] text-slate-600">
                  {generalInfo.employer_representative_name || "İşveren / İşveren Vekili"}
                </p>
              </div>
            </div>

            <div className="mt-16 text-center text-[11px] text-slate-400">Sayfa 1 / 1</div>
          </div>
        </div>

        <Button onClick={onClose} className="m-3 mt-0 w-[calc(100%-1.5rem)] sm:m-4 sm:w-[calc(100%-2rem)]" variant="outline">
          Kapat
        </Button>
      </DialogContent>
    </Dialog>
  );
}
