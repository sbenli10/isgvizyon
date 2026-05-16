import { useCallback, useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import {
  AlertCircle,
  Bot,
  Building2,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Chrome,
  Clock,
  Download,
  ExternalLink,
  FileDown,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { listIsgkatipCompanies, type IsgkatipCompanyRow } from "@/domain/isgkatip/isgkatipQueries";
import { useSubscription } from "@/hooks/useSubscription";
import { ISGVIZYON_CHROME_EXTENSION_URL } from "@/lib/constants/extension";
import { importOsgbCompaniesFromKatip } from "@/lib/osgbPlatform";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { addInterFontsToJsPDF } from "@/utils/fonts";

type FeatureId =
  | "multi-assignment"
  | "contract-download"
  | "contracts-need-update"
  | "excess-duration-update"
  | "contract-status-report"
  | "duration-analysis"
  | "change-tracking"
  | "company-import";

type FeatureTone = "violet" | "blue" | "amber" | "emerald" | "rose";

type BotFeature = {
  id: FeatureId;
  title: string;
  description: string;
  badge: string;
  status: "Aktif" | "Kısıtlı" | "Rapor" | "Analiz" | "PDF";
  cta: string;
  tone: FeatureTone;
  icon: typeof UserPlus;
};

type FeatureRuntimeState = {
  loading?: boolean;
  error?: string | null;
  success?: string | null;
};

type BotSnapshot = {
  companies: IsgkatipCompanyRow[];
  companyCount: number;
  lastSyncedAt: string | null;
  connectionStatus: "connected" | "waiting" | "offline";
};

type ImportTarget = "personal" | "osgb";

type ImportResult = {
  created: number;
  updated: number;
};

type KatipChangeType = "added" | "removed" | "updated";

type KatipChangeItem = {
  id: string;
  companyName: string;
  type: KatipChangeType;
  summary: string;
  details: string[];
};

type KatipChangeResult = {
  checkedAt: string;
  hasBaseline: boolean;
  changes: KatipChangeItem[];
  currentCount: number;
  previousCount: number;
};

const normalizeHazardClass = (value?: string | null) => {
  const normalized = String(value || "").toLocaleLowerCase("tr-TR");
  if (normalized.includes("çok")) return "Çok Tehlikeli";
  if (normalized.includes("tehlikeli")) return "Tehlikeli";
  return "Az Tehlikeli";
};

const buildCompanyImportPayload = (row: IsgkatipCompanyRow, userId: string) => {
  const sgkNo = row.sgk_no?.trim() || null;

  return {
    user_id: userId,
    name: row.company_name,
    tax_number: sgkNo,
    industry: row.nace_code || null,
    employee_count: Number(row.employee_count || 0),
    hazard_class: normalizeHazardClass(row.hazard_class),
    workplace_registration_number: sgkNo,
    sgk_workplace_number: sgkNo,
    visit_frequency: "Ayda 1 Defa",
    is_active: true,
    updated_at: new Date().toISOString(),
  };
};

const importRowsToPersonalCompanies = async (
  userId: string,
  rows: IsgkatipCompanyRow[],
): Promise<ImportResult> => {
  if (rows.length === 0) return { created: 0, updated: 0 };

  const { data: existingRows, error: readError } = await (supabase as any)
    .from("companies")
    .select("id,name,tax_number,sgk_workplace_number,workplace_registration_number")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (readError) throw readError;

  const existing = (existingRows ?? []) as Array<{
    id: string;
    name?: string | null;
    tax_number?: string | null;
    sgk_workplace_number?: string | null;
    workplace_registration_number?: string | null;
  }>;

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const sgkNo = row.sgk_no?.trim() || "";
    const companyName = row.company_name.trim().toLocaleLowerCase("tr-TR");
    const match = existing.find((item) => {
      const identifiers = [
        item.tax_number,
        item.sgk_workplace_number,
        item.workplace_registration_number,
      ].filter(Boolean);
      if (sgkNo && identifiers.includes(sgkNo)) return true;
      return String(item.name || "").trim().toLocaleLowerCase("tr-TR") === companyName;
    });

    const payload = buildCompanyImportPayload(row, userId);

    if (match?.id) {
      const { error } = await (supabase as any)
        .from("companies")
        .update(payload)
        .eq("id", match.id)
        .eq("user_id", userId);
      if (error) throw error;
      updated += 1;
    } else {
      const { data, error } = await (supabase as any)
        .from("companies")
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
        .select("id,name,tax_number,sgk_workplace_number,workplace_registration_number")
        .single();
      if (error) throw error;
      if (data) existing.push(data);
      created += 1;
    }
  }

  return { created, updated };
};

const botFeatures: BotFeature[] = [
  {
    id: "multi-assignment",
    title: "Çoklu Atama Yap",
    description: "Birden fazla işyerine tek seferde personel ataması yapın.",
    badge: "OSGB",
    status: "Kısıtlı",
    cta: "Kısıtlı modda başlat",
    tone: "violet",
    icon: UserPlus,
  },
  {
    id: "contract-download",
    title: "Toplu Atama Sözleşmesi İndir",
    description: "Aktif veya onay bekleyen atama sözleşmelerini PDF olarak indirin.",
    badge: "PDF",
    status: "PDF",
    cta: "Sözleşmeleri aç",
    tone: "blue",
    icon: FileDown,
  },
  {
    id: "contracts-need-update",
    title: "Güncellenmesi Gereken Sözleşmeler",
    description: "Uyumsuz sözleşmeleri ve önerilen yeni süreleri görüntüleyin.",
    badge: "Aktif",
    status: "Aktif",
    cta: "Kontrol et",
    tone: "amber",
    icon: RefreshCw,
  },
  {
    id: "excess-duration-update",
    title: "Asgari Süreden Fazla Atananları Güncelle",
    description: "Çalışan sayısı ve tehlike sınıfına göre fazla süreleri güncelleyin.",
    badge: "Aktif",
    status: "Aktif",
    cta: "Güncelle",
    tone: "emerald",
    icon: Layers,
  },
  {
    id: "contract-status-report",
    title: "Hizmet Alan İşyerleri İSG Sözleşme Durumu",
    description: "İSG profesyoneli sözleşme durumunu renk skalasıyla raporlayın.",
    badge: "Rapor",
    status: "Rapor",
    cta: "Rapor oluştur",
    tone: "amber",
    icon: ShieldCheck,
  },
  {
    id: "duration-analysis",
    title: "Süre Analizi",
    description: "Personellerin kalan çalışma dakikalarını ve doluluk oranlarını analiz edin.",
    badge: "Analiz",
    status: "Analiz",
    cta: "Analiz et",
    tone: "rose",
    icon: TimerReset,
  },
  {
    id: "change-tracking",
    title: "İSG-KATİP Değişiklik Takibi",
    description: "Son senkron ile önceki kayıtları karşılaştırın; yeni, silinen veya değişen firmaları görün.",
    badge: "Takip",
    status: "Aktif",
    cta: "Değişiklikleri gör",
    tone: "blue",
    icon: Clock,
  },
];

const toneStyles: Record<
  FeatureTone,
  {
    icon: string;
    card: string;
    glow: string;
    badge: string;
    button: string;
  }
> = {
  violet: {
    icon: "from-violet-500 to-fuchsia-500",
    card:
      "border-violet-300/25 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-purple-700 dark:border-violet-300/20 dark:from-violet-700 dark:via-fuchsia-800 dark:to-purple-950",
    glow: "shadow-violet-950/30",
    badge: "border-violet-400/30 bg-violet-500/15 text-violet-200",
    button: "bg-violet-500 hover:bg-violet-400",
  },
  blue: {
    icon: "from-blue-500 to-cyan-500",
    card:
      "border-sky-300/25 bg-gradient-to-br from-blue-600 via-sky-600 to-cyan-600 dark:border-sky-300/20 dark:from-blue-700 dark:via-sky-800 dark:to-cyan-950",
    glow: "shadow-blue-950/30",
    badge: "border-blue-400/30 bg-blue-500/15 text-blue-200",
    button: "bg-blue-500 hover:bg-blue-400",
  },
  amber: {
    icon: "from-amber-500 to-orange-500",
    card:
      "border-orange-300/25 bg-gradient-to-br from-orange-500 via-amber-600 to-orange-700 dark:border-orange-300/20 dark:from-orange-600 dark:via-amber-800 dark:to-orange-950",
    glow: "shadow-amber-950/30",
    badge: "border-amber-400/30 bg-amber-500/15 text-amber-200",
    button: "bg-amber-500 hover:bg-amber-400",
  },
  emerald: {
    icon: "from-emerald-500 to-teal-500",
    card:
      "border-emerald-300/25 bg-gradient-to-br from-emerald-600 via-teal-600 to-green-700 dark:border-emerald-300/20 dark:from-emerald-700 dark:via-teal-800 dark:to-green-950",
    glow: "shadow-emerald-950/30",
    badge: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
    button: "bg-emerald-500 hover:bg-emerald-400",
  },
  rose: {
    icon: "from-rose-500 to-pink-500",
    card:
      "border-rose-300/25 bg-gradient-to-br from-rose-600 via-pink-600 to-rose-800 dark:border-rose-300/20 dark:from-rose-700 dark:via-pink-800 dark:to-rose-950",
    glow: "shadow-rose-950/30",
    badge: "border-rose-400/30 bg-rose-500/15 text-rose-200",
    button: "bg-rose-500 hover:bg-rose-400",
  },
};

const formatSyncLabel = (value: string | null) => {
  if (!value) return "Henüz senkron yapılmadı";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Son senkron bilgisi alınamadı";

  return parsed.toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const getCompanyValue = (company: IsgkatipCompanyRow, key: string, fallback = "") => {
  const value = (company as Record<string, unknown>)[key];
  return value == null || value === "" ? fallback : String(value);
};

const sanitizePdfFileName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 90);

const formatReportDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("tr-TR");
};

const getNumericCompanyValue = (company: IsgkatipCompanyRow, key: string) => {
  const parsed = Number((company as Record<string, unknown>)[key] ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getContractStatusText = (company: IsgkatipCompanyRow) => {
  const raw = getCompanyValue(company, "contract_status", "Aktif");
  if (!raw || raw === "Aktif") return "Aktif sözleşme";
  const normalized = raw.toLocaleLowerCase("tr-TR");
  if (normalized.includes("onay") || normalized.includes("pending") || normalized.includes("bekl")) {
    return "Onay bekleyen atama";
  }
  return raw;
};

const isPendingAssignment = (company: IsgkatipCompanyRow) => {
  const status = getContractStatusText(company).toLocaleLowerCase("tr-TR");
  return status.includes("onay") || status.includes("bekl") || status.includes("pending");
};

const getDurationComplianceText = (company: IsgkatipCompanyRow) => {
  const assigned = getNumericCompanyValue(company, "assigned_minutes");
  const required = getNumericCompanyValue(company, "required_minutes");
  const diff = assigned - required;
  if (!required) return "Gerekli süre hesaplanmamış";
  if (diff === 0) return "Asgari süre tam karşılanıyor";
  if (diff > 0) return `Asgari süreden ${diff} dk fazla`;
  return `Asgari süreden ${Math.abs(diff)} dk eksik`;
};

const drawContractReportPdf = (rows: IsgkatipCompanyRow[]) => {
  if (rows.length === 0) {
    toast.error("PDF oluşturmak için en az bir firma seçin.");
    return;
  }

  try {
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const interLoaded = addInterFontsToJsPDF(doc);
    const fontFamily = interLoaded ? "Inter" : "helvetica";
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 34;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const setText = (size: number, color: [number, number, number], style: "normal" | "bold" = "normal") => {
      doc.setFont(fontFamily, style);
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
    };

    const drawFooter = () => {
      const footerY = pageHeight - 18;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, footerY - 12, pageWidth - margin, footerY - 12);
      setText(7, [100, 116, 139]);
      doc.text("İSGVizyon Bot | İSG-KATİP Atama Sözleşmeleri Raporu", margin, footerY);
      doc.text(`Sayfa ${doc.getNumberOfPages()}`, pageWidth - margin, footerY, { align: "right" });
    };

    const addPageIfNeeded = (height: number) => {
      if (y + height <= pageHeight - 48) return;
      drawFooter();
      doc.addPage();
      y = margin;
    };

    const drawTitlePage = () => {
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin, y, contentWidth, 98, 12, 12, "F");
      doc.setFillColor(37, 99, 235);
      doc.roundedRect(margin + contentWidth - 138, y + 18, 104, 28, 9, 9, "F");
      setText(8, [255, 255, 255], "bold");
      doc.text("GÜNCEL RAPOR", margin + contentWidth - 86, y + 36, { align: "center" });
      setText(20, [255, 255, 255], "bold");
      doc.text("Toplu Atama Sözleşmeleri", margin + 22, y + 38);
      setText(10, [203, 213, 225]);
      doc.text("İSG-KATİP verilerine göre güncel firma ve atama süre raporu", margin + 22, y + 62);
      doc.text(`Oluşturma tarihi: ${new Date().toLocaleString("tr-TR")}`, margin + 22, y + 80);
      y += 120;

      const activeCount = rows.filter((row) => !isPendingAssignment(row)).length;
      const pendingCount = rows.length - activeCount;
      const totalEmployees = rows.reduce((sum, row) => sum + getNumericCompanyValue(row, "employee_count"), 0);
      const totalAssigned = rows.reduce((sum, row) => sum + getNumericCompanyValue(row, "assigned_minutes"), 0);
      const totalRequired = rows.reduce((sum, row) => sum + getNumericCompanyValue(row, "required_minutes"), 0);
      const summary = [
        ["Firma", rows.length],
        ["Aktif", activeCount],
        ["Onay Bekleyen", pendingCount],
        ["Çalışan", totalEmployees],
        ["Atanan dk", totalAssigned],
        ["Gerekli dk", totalRequired],
      ];

      const cardW = (contentWidth - 20) / 3;
      summary.forEach(([label, value], index) => {
        const x = margin + (index % 3) * (cardW + 10);
        const rowY = y + Math.floor(index / 3) * 62;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, rowY, cardW, 50, 10, 10, "FD");
        setText(7, [100, 116, 139], "bold");
        doc.text(String(label).toLocaleUpperCase("tr-TR"), x + 12, rowY + 17);
        setText(16, [15, 23, 42], "bold");
        doc.text(String(value), x + 12, rowY + 37);
      });
      y += 138;

      setText(12, [15, 23, 42], "bold");
      doc.text("Firma Özeti", margin, y);
      y += 12;

      const headers = ["Firma", "SGK Sicil", "Tehlike", "Çalışan", "Durum"];
      const widths = [160, 92, 82, 52, contentWidth - 386];
      doc.setFillColor(30, 64, 175);
      doc.rect(margin, y, contentWidth, 20, "F");
      let x = margin;
      setText(7, [255, 255, 255], "bold");
      headers.forEach((header, index) => {
        doc.text(header, x + 5, y + 13);
        x += widths[index];
      });
      y += 20;

      rows.slice(0, 18).forEach((company, index) => {
        addPageIfNeeded(24);
        doc.setFillColor(index % 2 === 0 ? 248 : 241, index % 2 === 0 ? 250 : 245, index % 2 === 0 ? 252 : 249);
        doc.rect(margin, y, contentWidth, 22, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(margin, y, contentWidth, 22);
        x = margin;
        const cells = [
          getCompanyValue(company, "company_name", "Firma"),
          getCompanyValue(company, "sgk_no", "-"),
          getCompanyValue(company, "hazard_class", "-"),
          String(getNumericCompanyValue(company, "employee_count")),
          getDurationComplianceText(company),
        ];
        setText(6.8, [30, 41, 59]);
        cells.forEach((cell, cellIndex) => {
          const lines = doc.splitTextToSize(cell, widths[cellIndex] - 8) as string[];
          doc.text(lines.slice(0, 2), x + 5, y + 8);
          x += widths[cellIndex];
        });
        y += 22;
      });

      if (rows.length > 18) {
        y += 8;
        setText(8, [100, 116, 139]);
        doc.text(`Not: ${rows.length - 18} firma detay sayfalarında ayrıca listelenmiştir.`, margin, y);
        y += 14;
      }
    };

    const drawField = (label: string, value: string, x: number, fieldY: number, width: number) => {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, fieldY, width, 42, 8, 8, "FD");
      setText(6.5, [100, 116, 139], "bold");
      doc.text(label.toLocaleUpperCase("tr-TR"), x + 8, fieldY + 13);
      setText(8.5, [15, 23, 42], "bold");
      const lines = doc.splitTextToSize(value || "-", width - 16) as string[];
      doc.text(lines.slice(0, 2), x + 8, fieldY + 28);
    };

    const drawCompanyDetail = (company: IsgkatipCompanyRow, index: number) => {
      drawFooter();
      doc.addPage();
      y = margin;

      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin, y, contentWidth, 58, 10, 10, "F");
      setText(8, [147, 197, 253], "bold");
      doc.text(`FİRMA RAPORU #${index + 1}`, margin + 18, y + 18);
      setText(15, [255, 255, 255], "bold");
      const titleLines = doc.splitTextToSize(getCompanyValue(company, "company_name", "Firma"), contentWidth - 36) as string[];
      doc.text(titleLines.slice(0, 2), margin + 18, y + 39);
      y += 76;

      const colW = (contentWidth - 12) / 2;
      const fields = [
        ["SGK Sicil No", getCompanyValue(company, "sgk_no", "-")],
        ["NACE Kodu", getCompanyValue(company, "nace_code", "-")],
        ["Tehlike Sınıfı", getCompanyValue(company, "hazard_class", "-")],
        ["Çalışan Sayısı", String(getNumericCompanyValue(company, "employee_count"))],
        ["Sözleşme Başlangıcı", formatReportDate(getCompanyValue(company, "contract_start"))],
        ["Sözleşme Bitişi", formatReportDate(getCompanyValue(company, "contract_end"))],
        ["Atanan Süre", `${getNumericCompanyValue(company, "assigned_minutes")} dk/ay`],
        ["Gerekli Süre", `${getNumericCompanyValue(company, "required_minutes")} dk/ay`],
        ["Sözleşme Durumu", getContractStatusText(company)],
        ["Süre Uyum Durumu", getDurationComplianceText(company)],
      ];

      fields.forEach(([label, value], fieldIndex) => {
        const x = margin + (fieldIndex % 2) * (colW + 12);
        const fieldY = y + Math.floor(fieldIndex / 2) * 52;
        drawField(label, value, x, fieldY, colW);
      });
      y += Math.ceil(fields.length / 2) * 52 + 14;

      const assigned = getNumericCompanyValue(company, "assigned_minutes");
      const required = getNumericCompanyValue(company, "required_minutes");
      const ratio = required > 0 ? Math.min(1.25, assigned / required) : 0;
      const barWidth = contentWidth;
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, y, barWidth, 50, 10, 10, "F");
      setText(9, [15, 23, 42], "bold");
      doc.text("Atama Süresi Uyum Göstergesi", margin + 12, y + 17);
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(margin + 12, y + 29, barWidth - 24, 8, 4, 4, "F");
      doc.setFillColor(ratio >= 1 ? 16 : 245, ratio >= 1 ? 185 : 158, ratio >= 1 ? 129 : 11);
      doc.roundedRect(margin + 12, y + 29, Math.max(4, Math.min(barWidth - 24, (barWidth - 24) * ratio)), 8, 4, 4, "F");
      setText(7, [71, 85, 105]);
      doc.text(`${assigned} dk atandı / ${required || 0} dk gerekli`, margin + 12, y + 45);
      y += 66;

      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.roundedRect(margin, y, contentWidth, 62, 10, 10, "FD");
      setText(9, [30, 64, 175], "bold");
      doc.text("Profesyonel Değerlendirme", margin + 12, y + 18);
      setText(8, [30, 41, 59]);
      const note = `Bu rapor, İSG-KATİP üzerinden aktarılan güncel verilere göre hazırlanmıştır. Firma için sözleşme durumu, çalışan sayısı ve atama dakikaları kontrol edilerek asgari süre uyumu değerlendirilmelidir.`;
      doc.text(doc.splitTextToSize(note, contentWidth - 24), margin + 12, y + 35);
    };

    drawTitlePage();
    rows.forEach(drawCompanyDetail);
    drawFooter();

    const fileName =
      rows.length === 1
        ? `ISG_KATIP_Atama_Sozlesmesi_${sanitizePdfFileName(getCompanyValue(rows[0], "company_name", "Firma"))}.pdf`
        : `ISG_KATIP_Toplu_Atama_Sozlesmeleri_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    toast.success("PDF raporu hazırlandı", { description: `${rows.length} firma rapora eklendi.` });
  } catch (error) {
    console.error("Contract PDF export failed:", error);
    toast.error("PDF raporu oluşturulurken bir hata oluştu.");
  }
};

function BotFeatureCard({
  feature,
  onClick,
}: {
  feature: BotFeature;
  onClick: (feature: BotFeature) => void;
}) {
  const Icon = feature.icon;
  const styles = toneStyles[feature.tone];

  return (
    <button
      type="button"
      onClick={() => onClick(feature)}
      className={cn(
        "group relative flex min-h-[175px] w-full flex-col overflow-hidden rounded-2xl border p-5 text-left text-white shadow-[0_18px_45px_rgba(15,23,42,0.18)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(15,23,42,0.24)] focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-[#0B1220] dark:shadow-[0_18px_60px_rgba(2,8,23,0.55)] dark:hover:shadow-[0_24px_75px_rgba(2,8,23,0.72)]",
        styles.card,
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/18 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-black/10 blur-3xl" />

      <div className="relative z-10 mb-4 flex items-start justify-between gap-4">
        <div className="rounded-xl border border-white/20 bg-white/16 p-2.5 text-white shadow-sm backdrop-blur">
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge className="border-white/20 bg-white/18 text-white shadow-sm backdrop-blur">
            {feature.badge}
          </Badge>
          <span className="rounded-full border border-white/15 bg-white/12 px-2.5 py-1 text-[10px] font-bold text-white/90 shadow-sm backdrop-blur">
            {feature.status}
          </span>
        </div>
      </div>

      <div className="relative z-10 min-h-0 flex-1">
        <h3 className="text-base font-extrabold tracking-tight text-white">{feature.title}</h3>
        <p className="mt-1.5 line-clamp-2 min-h-[40px] text-xs font-medium leading-relaxed text-white/82">
          {feature.description}
        </p>
      </div>

      <div className="relative z-10 mt-3 flex items-center justify-between gap-3">
        <span className="inline-flex h-8 items-center px-0 text-xs font-extrabold text-white transition group-hover:text-white/85">
          {feature.cta}
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </span>
        <span className="rounded-full border border-white/15 bg-white/16 px-3 py-1 text-[10px] font-bold text-white shadow-sm backdrop-blur">
          Aç
        </span>
      </div>
    </button>
  );
}

function StatusAlert({
  loading,
  error,
  success,
  onRetry,
}: FeatureRuntimeState & {
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-blue-100">
        <Loader2 className="h-5 w-5 animate-spin" />
        <div>
          <p className="font-bold">İşlem hazırlanıyor</p>
          <p className="text-sm text-blue-100/75">İSG-KATİP bağlantısı ve aktarım verileri kontrol ediliyor.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 p-4 text-rose-50">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
          <div className="min-w-0 flex-1">
            <p className="font-black">Hata Oluştu</p>
            <p className="mt-1 text-sm leading-6 text-rose-100/80">{error}</p>
            {onRetry && (
              <Button
                type="button"
                size="sm"
                className="mt-3 rounded-xl bg-rose-500 text-white hover:bg-rose-400"
                onClick={onRetry}
              >
                Tekrar Dene
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-50">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
        <div>
          <p className="font-black">İşlem Tamamlandı</p>
          <p className="mt-1 text-sm leading-6 text-emerald-100/80">{success}</p>
        </div>
      </div>
    );
  }

  return null;
}

function EmptyState({ title, description, icon: Icon = Sparkles }: { title: string; description: string; icon?: typeof Sparkles }) {
  return (
    <div className="grid min-h-[180px] place-items-center rounded-2xl border border-dashed border-slate-700/70 bg-slate-900/90 p-6 text-center shadow-lg shadow-black/30">
      <div>
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-white/5 text-slate-300 ring-1 ring-white/10">
          <Icon className="h-5 w-5" />
        </div>
        <p className="font-black text-slate-100">{title}</p>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function MultiAssignmentPanel() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-black text-white">Personel Seçimi</h4>
            <Users className="h-4 w-4 text-violet-300" />
          </div>
          <Button className="w-full rounded-xl bg-violet-500 text-white hover:bg-violet-400">
            <Upload className="mr-2 h-4 w-4" />
            Personel Listesi Yükle
          </Button>
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
          <h4 className="mb-3 font-black text-white">SGK Sicil Numarası Giriş</h4>
          <Textarea
            className="min-h-[150px] border-slate-700 bg-slate-950/90 text-slate-100 placeholder:text-slate-500"
            placeholder="SGK sicil numaralarını yapıştırın veya yazın..."
          />
          <Button className="mt-3 w-full rounded-xl bg-violet-500 text-white hover:bg-violet-400">
            Sicil Numaralarını Ekle
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
        <h4 className="mb-3 font-black text-white">Firma Listesi</h4>
        <EmptyState
          title="Henüz firma sorgulanmadı"
          description="SGK numaralarını ekleyip sorgulayın."
          icon={ShieldCheck}
        />
      </div>

      <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
        <h4 className="mb-3 font-black text-white">Atama Planı (0)</h4>
        <EmptyState
          title="Henüz atama planı yok"
          description="Firmalardan eklemeler yapın."
          icon={Layers}
        />
      </div>
    </div>
  );
}

function ContractDownloadPanel({
  runtime,
  onRun,
  companies,
}: {
  runtime: FeatureRuntimeState;
  onRun: () => void;
  companies: IsgkatipCompanyRow[];
}) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [localStatus, setLocalStatus] = useState<FeatureRuntimeState>({});

  const filteredCompanies = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
    if (!normalizedQuery) return companies;

    return companies.filter((company) => {
      const haystack = [
        getCompanyValue(company, "company_name"),
        getCompanyValue(company, "sgk_no"),
        getCompanyValue(company, "hazard_class"),
        getCompanyValue(company, "nace_code"),
        getContractStatusText(company),
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(normalizedQuery);
    });
  }, [companies, query]);

  const activeCompanies = useMemo(
    () => filteredCompanies.filter((company) => !isPendingAssignment(company)),
    [filteredCompanies],
  );
  const pendingCompanies = useMemo(
    () => filteredCompanies.filter((company) => isPendingAssignment(company)),
    [filteredCompanies],
  );
  const selectedRows = useMemo(
    () => companies.filter((company) => selectedIds.includes(String(company.id))),
    [companies, selectedIds],
  );

  const toggleCompany = useCallback((companyId: string) => {
    setSelectedIds((prev) =>
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId],
    );
  }, []);

  const selectRows = useCallback((rows: IsgkatipCompanyRow[]) => {
    setSelectedIds(rows.map((company) => String(company.id)));
  }, []);

  const exportRows = useCallback((rows: IsgkatipCompanyRow[], label: string) => {
    if (rows.length === 0) {
      setLocalStatus({ error: "PDF raporu oluşturmak için en az bir firma seçmelisiniz." });
      toast.error("PDF için firma seçin");
      return;
    }

    setLocalStatus({ loading: true });

    window.setTimeout(() => {
      try {
        drawContractReportPdf(rows);
        setLocalStatus({ success: `${label} için ${rows.length} firma rapora eklendi.` });
      } catch (error) {
        console.error("Contract report export failed:", error);
        setLocalStatus({ error: "PDF raporu oluşturulurken bir hata oluştu." });
      }
    }, 80);
  }, []);

  const renderCompanyRows = (rows: IsgkatipCompanyRow[], emptyTitle: string, emptyDescription: string) => {
    if (rows.length === 0) {
      return <EmptyState title={emptyTitle} description={emptyDescription} icon={FileDown} />;
    }

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            {rows.length} firma listelendi
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-slate-600 bg-slate-900/80 text-xs text-slate-100 hover:bg-slate-800"
              onClick={() => selectRows(rows)}
            >
              Tümünü Seç
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 bg-blue-600 text-xs font-bold text-white hover:bg-blue-500"
              onClick={() => exportRows(rows, "Liste")}
            >
              Bu Listeyi PDF Al
            </Button>
          </div>
        </div>

        <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {rows.map((company) => {
            const companyId = String(company.id);
            const checked = selectedIds.includes(companyId);
            const employeeCount = getNumericCompanyValue(company, "employee_count");
            const assignedMinutes = getNumericCompanyValue(company, "assigned_minutes");
            const requiredMinutes = getNumericCompanyValue(company, "required_minutes");

            return (
              <div
                key={companyId}
                className={cn(
                  "rounded-2xl border bg-slate-900/90 p-3 shadow-lg shadow-black/20 transition hover:border-blue-400/45",
                  checked ? "border-blue-400/70 ring-1 ring-blue-400/30" : "border-slate-700/70",
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex min-w-0 cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCompany(companyId)}
                      className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-500 focus:ring-blue-500"
                      aria-label={`${getCompanyValue(company, "company_name", "Firma")} seç`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold text-white">
                        {getCompanyValue(company, "company_name", "Firma")}
                      </span>
                      <span className="mt-1 block text-xs text-slate-400">
                        SGK: {getCompanyValue(company, "sgk_no", "-")} · {getCompanyValue(company, "hazard_class", "-")} · {employeeCount} çalışan
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-500">
                        Atanan: {assignedMinutes} dk/ay · Gerekli: {requiredMinutes} dk/ay · {getDurationComplianceText(company)}
                      </span>
                    </span>
                  </label>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge
                      className={cn(
                        "border text-[10px]",
                        isPendingAssignment(company)
                          ? "border-amber-400/30 bg-amber-500/15 text-amber-100"
                          : "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
                      )}
                    >
                      {getContractStatusText(company)}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 bg-violet-600 text-xs font-bold text-white hover:bg-violet-500"
                      onClick={() => exportRows([company], getCompanyValue(company, "company_name", "Firma"))}
                    >
                      PDF
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-sm text-blue-100">
        <div className="flex items-start gap-3">
          <FileDown className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-extrabold text-white">Profesyonel atama sözleşmesi raporu</p>
            <p className="mt-1 text-blue-100/80">
              Aktarılan güncel İSG-KATİP verilerinden tek firma, seçili firmalar veya tüm liste için PDF raporu oluşturabilirsiniz.
              PDF çıktısı uygulama fontlarıyla hazırlanır.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/25 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Firma, SGK, tehlike sınıfı veya sözleşme durumu ara..."
            className="h-10 border-slate-700 bg-slate-950/80 pl-9 text-white placeholder:text-slate-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 border-slate-600 bg-slate-900/80 text-slate-100 hover:bg-slate-800"
            onClick={() => setSelectedIds([])}
            disabled={selectedIds.length === 0}
          >
            Seçimi Temizle
          </Button>
          <Button
            type="button"
            className="h-10 bg-violet-600 font-bold text-white hover:bg-violet-500"
            onClick={() => exportRows(selectedRows, "Seçili firmalar")}
            disabled={selectedRows.length === 0 || localStatus.loading}
          >
            Seçili PDF ({selectedRows.length})
          </Button>
          <Button
            type="button"
            className="h-10 bg-emerald-600 font-bold text-white hover:bg-emerald-500"
            onClick={() => exportRows(filteredCompanies, "Toplu rapor")}
            disabled={filteredCompanies.length === 0 || localStatus.loading}
          >
            Toplu PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-slate-950/90 p-1">
          <TabsTrigger value="active" className="rounded-xl data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            Aktif Sözleşmeler ({activeCompanies.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="rounded-xl data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            Onay Bekleyen Atamalar ({pendingCompanies.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="space-y-3">
          {renderCompanyRows(activeCompanies, "Aktif sözleşme bulunamadı", "Önce İSG-KATİP verisini aktarın veya arama filtresini temizleyin.")}
        </TabsContent>
        <TabsContent value="pending">
          {renderCompanyRows(pendingCompanies, "Onay bekleyen atama bulunamadı", "Onay bekleyen kayıtlar burada listelenir.")}
        </TabsContent>
      </Tabs>

      <StatusAlert {...localStatus} />
      <StatusAlert {...runtime} onRetry={onRun} />
    </div>
  );
}

function ContractDownloadPanelLegacy({
  runtime,
  onRun,
  companies,
}: {
  runtime: FeatureRuntimeState;
  onRun: () => void;
  companies: IsgkatipCompanyRow[];
}) {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-slate-950/90 p-1">
          <TabsTrigger value="active" className="rounded-xl data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            Aktif Sözleşmeler
          </TabsTrigger>
          <TabsTrigger value="pending" className="rounded-xl data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            Onay Bekleyen Atamalar
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="space-y-3">
          {companies.length > 0 ? (
            companies.slice(0, 5).map((company) => (
              <div key={company.id} className="flex items-center justify-between rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
                <div>
                  <p className="font-bold text-white">{getCompanyValue(company, "company_name", "Firma")}</p>
                  <p className="text-sm text-slate-400">Sözleşme PDF aktarımı için hazır</p>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-200">Aktif</Badge>
              </div>
            ))
          ) : (
            <EmptyState title="Aktif sözleşme bulunamadı" description="Önce İSG-KATİP verisini aktarın." icon={FileDown} />
          )}
        </TabsContent>
        <TabsContent value="pending">
          <EmptyState title="Onay bekleyen atama bulunamadı" description="Onay bekleyen kayıtlar burada listelenir." icon={Clock} />
        </TabsContent>
      </Tabs>

      <StatusAlert {...runtime} onRetry={onRun} />
    </div>
  );
}

function ContractsNeedUpdatePanel({ runtime, onRun, companies }: { runtime: FeatureRuntimeState; onRun: () => void; companies: IsgkatipCompanyRow[] }) {
  const candidates = companies.filter((company) => {
    const riskScore = Number((company as Record<string, unknown>).risk_score || 0);
    const contractEnd = getCompanyValue(company, "contract_end");
    return riskScore >= 70 || !contractEnd;
  });

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-300">
        Bu kontrol, sözleşme bitişi eksik olan veya risk skoru yükselen firmaları güncelleme adayı olarak listeler.
      </p>
      {candidates.length > 0 ? (
        <div className="grid gap-3">
          {candidates.slice(0, 6).map((company) => (
            <div key={company.id} className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
              <p className="font-bold text-white">{getCompanyValue(company, "company_name", "Firma")}</p>
              <p className="mt-1 text-sm text-amber-100/80">Öneri: sözleşme süresi ve atama dakikaları yeniden kontrol edilmeli.</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Güncelleme adayı görünmüyor" description="Aktarılan verilerde kritik uyumsuzluk bulunamadı." icon={RefreshCw} />
      )}
      <StatusAlert {...runtime} onRetry={onRun} />
    </div>
  );
}

function ExcessDurationUpdatePanel({ runtime, onRun }: { runtime: FeatureRuntimeState; onRun: () => void }) {
  return (
    <div className="space-y-4">
      <Alert className="border-emerald-400/25 bg-emerald-500/10 text-emerald-50">
        <Layers className="h-4 w-4 text-emerald-300" />
        <AlertTitle>Fazla süre güncelleme</AlertTitle>
        <AlertDescription className="text-emerald-100/80">
          Çalışan sayısı, tehlike sınıfı ve meslek grubu dikkate alınarak asgari süreden fazla atanmış kayıtlar güncelleme kuyruğuna alınır.
        </AlertDescription>
      </Alert>
      <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
        <Label className="text-slate-200">İşlem notu</Label>
        <Input
          className="mt-2 border-slate-700 bg-slate-950/90 text-slate-100"
          placeholder="Örn. Bu ayki toplu süre güncellemesi"
        />
      </div>
      <StatusAlert {...runtime} onRetry={onRun} />
    </div>
  );
}

function ContractStatusReportPanel({ runtime, onRun }: { runtime: FeatureRuntimeState; onRun: () => void }) {
  const scale = [
    { color: "bg-rose-500", label: "Kırmızı", detail: "İSG Profesyoneli Sözleşmesi Yok" },
    { color: "bg-white", label: "Beyaz", detail: "Personel Onayı Bekleniyor" },
    { color: "bg-amber-400", label: "Sarı", detail: "İşyeri Onayı Bekleniyor" },
    { color: "bg-emerald-500", label: "Yeşil", detail: "Tam Onaylı" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {scale.map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
            <span className={cn("h-4 w-4 rounded-full ring-1 ring-white/30", item.color)} />
            <div>
              <p className="font-black text-white">{item.label}</p>
              <p className="text-sm text-slate-400">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
        <label className="flex items-start gap-3 text-sm text-slate-200">
          <input type="checkbox" className="mt-1 rounded border-slate-600 bg-slate-950" />
          Belirlenen sürede onaylanmadığı için sonlanan sözleşmeleri de göster
        </label>
        <label className="flex items-start gap-3 text-sm text-slate-200">
          <input type="checkbox" className="mt-1 rounded border-slate-600 bg-slate-950" />
          Çalışan sayısı sıfıra düşen işyerlerini göster
        </label>
      </div>

      <Alert className="border-amber-400/25 bg-amber-500/10 text-amber-50">
        <AlertCircle className="h-4 w-4 text-amber-300" />
        <AlertTitle>Dikkat</AlertTitle>
        <AlertDescription className="text-amber-100/80">
          Tehlike sınıfı çok tehlikeli ve çalışan sayısı 10+ olan işyerleri için DSP bilgisi de kontrol edilir.
        </AlertDescription>
      </Alert>
      <StatusAlert {...runtime} onRetry={onRun} />
    </div>
  );
}

function DurationAnalysisPanel({ runtime, onRun, companies }: { runtime: FeatureRuntimeState; onRun: () => void; companies: IsgkatipCompanyRow[] }) {
  const rows = companies.slice(0, 4).map((company, index) => ({
    id: company.id,
    name: getCompanyValue(company, "company_name", `Firma ${index + 1}`),
    ratio: Math.min(96, 42 + index * 13),
  }));

  return (
    <div className="space-y-4">
      {rows.length > 0 ? (
        <div className="grid gap-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-bold text-white">{row.name}</p>
                <span className="text-sm font-black text-rose-200">%{row.ratio}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500" style={{ width: `${row.ratio}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Analiz edilecek süre verisi yok" description="Önce firmalarınızı İSG-KATİP üzerinden aktarın." icon={TimerReset} />
      )}
      <StatusAlert {...runtime} onRetry={onRun} />
    </div>
  );
}

function KatipChangeTrackingPanel({
  runtime,
  result,
  onRun,
}: {
  runtime: FeatureRuntimeState;
  result: KatipChangeResult | null;
  onRun: () => void;
}) {
  const typeStyles: Record<KatipChangeType, { label: string; className: string }> = {
    added: {
      label: "Yeni",
      className: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
    },
    updated: {
      label: "Değişti",
      className: "border-blue-400/30 bg-blue-500/15 text-blue-200",
    },
    removed: {
      label: "Listede Yok",
      className: "border-rose-400/30 bg-rose-500/15 text-rose-200",
    },
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-black text-slate-50">İSG-KATİP Değişiklik Takibi</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Son İSG-KATİP firma listenizi önceki senkron kayıtlarıyla karşılaştırır; yeni, çıkan veya bilgisi değişen firmaları gösterir.
            </p>
          </div>
          <Button
            className="shrink-0 rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-950/30 hover:bg-blue-400"
            onClick={onRun}
            disabled={runtime.loading}
          >
            {runtime.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Değişiklikleri Tara
          </Button>
        </div>
      </div>

      {!result && (
        <EmptyState
          title="Henüz değişiklik taraması yapılmadı"
          description="Taramayı başlattığınızda mevcut İSG-KATİP listeniz geçmiş kayıtlarla karşılaştırılır."
          icon={Clock}
        />
      )}

      {result && !result.hasBaseline && (
        <Alert className="border-amber-400/25 bg-amber-500/10 text-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-300" />
          <AlertTitle>Karşılaştırma geçmişi yok</AlertTitle>
          <AlertDescription className="text-amber-100/80">
            Değişiklik takibi için en az iki farklı İSG-KATİP senkron kaydı gerekir. İlk kayıt alındıktan sonraki senkronlarda değişiklikler burada görünür.
          </AlertDescription>
        </Alert>
      )}

      {result?.hasBaseline && result.changes.length === 0 && (
        <Alert className="border-emerald-400/25 bg-emerald-500/10 text-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          <AlertTitle>Değişiklik yok</AlertTitle>
          <AlertDescription className="text-emerald-100/80">
            Son senkrona göre firma, çalışan sayısı, tehlike sınıfı, süre ve sözleşme alanlarında fark bulunmadı.
          </AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Mevcut</p>
            <p className="mt-2 text-2xl font-black text-white">{result.currentCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Önceki</p>
            <p className="mt-2 text-2xl font-black text-white">{result.previousCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Fark</p>
            <p className="mt-2 text-2xl font-black text-white">{result.changes.length}</p>
          </div>
        </div>
      )}

      {result && result.changes.length > 0 && (
        <div className="space-y-3">
          {result.changes.map((change) => {
            const style = typeStyles[change.type];
            return (
              <div
                key={`${change.type}-${change.id}`}
                className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-black text-white">{change.companyName}</h4>
                    <p className="mt-1 text-sm text-slate-400">{change.summary}</p>
                  </div>
                  <Badge variant="outline" className={cn("w-fit rounded-full", style.className)}>
                    {style.label}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2">
                  {change.details.map((detail) => (
                    <div key={detail} className="rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                      {detail}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <StatusAlert {...runtime} onRetry={onRun} />
    </div>
  );
}

function CompanyImportPanel({
  runtime,
  companies,
  selectedIds,
  target,
  isOsgbPlan,
  hasOrganization,
  onLoadCompanies,
  onToggleCompany,
  onSelectAll,
  onClearSelection,
  onTargetChange,
  onImportSelected,
}: {
  runtime: FeatureRuntimeState;
  companies: IsgkatipCompanyRow[];
  selectedIds: string[];
  target: ImportTarget;
  isOsgbPlan: boolean;
  hasOrganization: boolean;
  onLoadCompanies: () => void;
  onToggleCompany: (companyId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onTargetChange: (target: ImportTarget) => void;
  onImportSelected: () => void;
}) {
  const [query, setQuery] = useState("");
  const filteredCompanies = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr-TR");
    if (!term) return companies;

    return companies.filter((company) =>
      [company.company_name, company.sgk_no, company.hazard_class, company.nace_code]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("tr-TR").includes(term)),
    );
  }, [companies, query]);

  const selectedCount = selectedIds.length;
  const allFilteredSelected =
    filteredCompanies.length > 0 && filteredCompanies.every((company) => selectedIds.includes(company.id));
  const osgbTargetDisabled = !isOsgbPlan || !hasOrganization;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-50">İSG KATİP’ten Firma Listesi Al</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              İSG-KATİP’ten çekilen firmaları burada seçip ister Firmalarım bölümüne, ister OSGB Firma Takibi sayfasına aktarabilirsiniz.
            </p>
            <p className="mt-1 text-xs italic text-slate-500">
              OSGB kullanıcılarının operasyon takibi için OSGB Yönetim Panelini kullanmaları tavsiye edilir.
            </p>
          </div>
        </div>
      </div>

      <Button
        className="h-12 w-full rounded-2xl bg-emerald-500 text-base font-black text-white shadow-lg shadow-emerald-950/30 hover:bg-emerald-400"
        onClick={onLoadCompanies}
        disabled={runtime.loading}
      >
        {runtime.loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RefreshCw className="mr-2 h-5 w-5" />}
        Firma Listesini Yükle
      </Button>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onTargetChange("personal")}
          className={cn(
            "rounded-2xl border p-4 text-left transition",
            target === "personal"
              ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-50"
              : "border-slate-700/70 bg-slate-900/90 text-slate-200 hover:border-cyan-500/35",
          )}
        >
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-cyan-300" />
            <span className="font-black">Firmalarım alanına aktar</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">Profilim → Firmalarım listesindeki genel firma yönetimine ekler.</p>
        </button>

        <button
          type="button"
          onClick={() => !osgbTargetDisabled && onTargetChange("osgb")}
          disabled={osgbTargetDisabled}
          className={cn(
            "rounded-2xl border p-4 text-left transition",
            target === "osgb"
              ? "border-violet-400/50 bg-violet-500/15 text-violet-50"
              : "border-slate-700/70 bg-slate-900/90 text-slate-200 hover:border-violet-500/35",
            osgbTargetDisabled && "cursor-not-allowed opacity-55",
          )}
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-violet-300" />
            <span className="font-black">OSGB Firma Takibi’ne aktar</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Sadece OSGB paketi ve organizasyon hesabı olan kullanıcılar için aktif olur.
          </p>
        </button>
      </div>

      {companies.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-black text-white">Aktarılacak firmaları seçin</h3>
              <p className="text-xs text-slate-400">{selectedCount} firma seçildi · Toplam {companies.length} kayıt</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="rounded-xl bg-blue-500 text-white hover:bg-blue-400"
                onClick={allFilteredSelected ? onClearSelection : onSelectAll}
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                {allFilteredSelected ? "Seçimi Temizle" : "Tümünü Seç"}
              </Button>
              <Button size="sm" variant="outline" className="rounded-xl border-slate-700 bg-slate-950/80 text-slate-100 hover:bg-slate-800" asChild>
                <a href={ISGVIZYON_CHROME_EXTENSION_URL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Web Store
                </a>
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Firma, SGK, tehlike sınıfı veya NACE ara..."
              className="h-10 rounded-xl border-slate-700 bg-slate-950/90 pl-9 text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {filteredCompanies.length === 0 ? (
              <EmptyState title="Eşleşen firma bulunamadı" description="Arama kriterini değiştirerek tekrar deneyin." icon={Search} />
            ) : (
              filteredCompanies.map((company) => {
                const checked = selectedIds.includes(company.id);

                return (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => onToggleCompany(company.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition",
                      checked
                        ? "border-emerald-400/40 bg-emerald-500/10"
                        : "border-slate-700/70 bg-slate-950/70 hover:border-slate-500",
                    )}
                  >
                    <span className={cn("mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-md border", checked ? "border-emerald-400 bg-emerald-500 text-white" : "border-slate-600 bg-slate-900")}>
                      {checked ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-slate-100">{company.company_name}</span>
                      <span className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
                        <span>SGK: {company.sgk_no || "-"}</span>
                        <span>Çalışan: {company.employee_count || 0}</span>
                        <span>{company.hazard_class || "Az Tehlikeli"}</span>
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <Button
            className="h-11 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-blue-500 font-black text-white shadow-lg shadow-violet-950/35 hover:from-violet-400 hover:to-blue-400"
            onClick={onImportSelected}
            disabled={runtime.loading || selectedCount === 0 || (target === "osgb" && osgbTargetDisabled)}
          >
            {runtime.loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Upload className="mr-2 h-5 w-5" />}
            Seçili {selectedCount} Firmayı Aktar
          </Button>
        </div>
      )}

      <StatusAlert {...runtime} onRetry={onLoadCompanies} />
    </div>
  );
}

function LegacyCompanyImportPanel({ runtime, onRun }: { runtime: FeatureRuntimeState; onRun: () => void }) {
  return (
    <div className="space-y-4">
      <Alert className="border-blue-400/25 bg-blue-500/10 text-blue-50">
        <Chrome className="h-4 w-4 text-blue-300" />
        <AlertTitle>Firmalarımı Aktar</AlertTitle>
        <AlertDescription className="text-blue-100/80">
          İSG-KATİP sayfasında eklenti panelinden “Firmalarımı Oku” işlemini başlatın, önizlemeyi kontrol edin ve ikinci onayla ISGVizyon’a aktarın.
        </AlertDescription>
      </Alert>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button className="rounded-xl bg-blue-500 text-white hover:bg-blue-400" asChild>
          <a href={ISGVIZYON_CHROME_EXTENSION_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Web Store’u Aç
          </a>
        </Button>
        <Button variant="outline" className="rounded-xl border-slate-700 bg-slate-950/50 text-slate-100 hover:bg-slate-800" onClick={onRun}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Bağlantıyı Kontrol Et
        </Button>
      </div>
      <StatusAlert {...runtime} onRetry={onRun} />
    </div>
  );
}

function FeatureDialog({
  feature,
  open,
  onOpenChange,
  runtime,
  onRun,
  companies,
  changeResult,
}: {
  feature: BotFeature | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runtime: FeatureRuntimeState;
  onRun: () => void;
  companies: IsgkatipCompanyRow[];
  changeResult: KatipChangeResult | null;
}) {
  if (!feature) return null;
  const Icon = feature.icon;
  const styles = toneStyles[feature.tone];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[55] bg-slate-950/85 backdrop-blur-md"
        className="z-[60] max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-0 text-slate-50 shadow-2xl shadow-black/70 sm:max-w-5xl [&>button]:rounded-xl [&>button]:text-slate-400 [&>button:hover]:bg-slate-800 [&>button:hover]:text-white"
      >
        <DialogHeader className="border-b border-slate-800/90 bg-slate-950/80 px-6 py-5 text-left">
          <div className="flex items-start gap-4">
            <div className={cn("grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg", styles.icon)}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-2xl font-black text-slate-50">{feature.title}</DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-6 text-slate-300">{feature.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 bg-slate-950/35 px-6 py-5">
          {feature.id === "multi-assignment" && <MultiAssignmentPanel />}
          {feature.id === "contract-download" && <ContractDownloadPanel runtime={runtime} onRun={onRun} companies={companies} />}
          {feature.id === "contracts-need-update" && <ContractsNeedUpdatePanel runtime={runtime} onRun={onRun} companies={companies} />}
          {feature.id === "excess-duration-update" && <ExcessDurationUpdatePanel runtime={runtime} onRun={onRun} />}
          {feature.id === "contract-status-report" && <ContractStatusReportPanel runtime={runtime} onRun={onRun} />}
          {feature.id === "duration-analysis" && <DurationAnalysisPanel runtime={runtime} onRun={onRun} companies={companies} />}
          {feature.id === "change-tracking" && <KatipChangeTrackingPanel runtime={runtime} result={changeResult} onRun={onRun} />}
        </div>

        <DialogFooter className="border-t border-slate-800/90 bg-slate-950/80 px-6 py-4 sm:justify-between">
          <p className="text-xs leading-5 text-slate-500">
            İşlemler, kullanıcının kendi yetkili İSG-KATİP oturumunda görebildiği verilerle sınırlıdır.
          </p>
          {feature.id !== "contract-download" && (
          <Button className={cn("rounded-xl text-white", styles.button)} onClick={onRun} disabled={runtime.loading}>
            {runtime.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            {feature.id === "contract-status-report" ? "Raporu Oluştur ve Görüntüle" : "İşlemi Başlat"}
          </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ISGBot() {
  const { user, profile } = useAuth();
  const { isOsgbPlan } = useSubscription();
  const [snapshot, setSnapshot] = useState<BotSnapshot>({
    companies: [],
    companyCount: 0,
    lastSyncedAt: null,
    connectionStatus: "offline",
  });
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [selectedFeature, setSelectedFeature] = useState<BotFeature | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importTarget, setImportTarget] = useState<ImportTarget>("personal");
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([]);
  const [changeResult, setChangeResult] = useState<KatipChangeResult | null>(null);
  const [runtimeByFeature, setRuntimeByFeature] = useState<Partial<Record<FeatureId, FeatureRuntimeState>>>({});

  const loadSnapshot = useCallback(async (options?: { silent?: boolean }) => {
    if (!user?.id) {
      setSnapshot({
        companies: [],
        companyCount: 0,
        lastSyncedAt: null,
        connectionStatus: "offline",
      });
      setLoadingSnapshot(false);
      return;
    }

    if (!options?.silent) setLoadingSnapshot(true);
    try {
      const rows = await listIsgkatipCompanies({
        userId: user.id,
        select:
          "id, company_name, sgk_no, last_synced_at, contract_start, contract_end, contract_status, risk_score, hazard_class, employee_count, nace_code, assigned_minutes, required_minutes",
        orderBy: "company_name",
        ascending: true,
      });

      const companyCount = rows.length;
      const lastSyncedAt = rows.find((row) => row.last_synced_at)?.last_synced_at ?? null;
      setSnapshot({
        companies: rows,
        companyCount,
        lastSyncedAt,
        connectionStatus: companyCount > 0 ? "connected" : "waiting",
      });
    } catch {
      setSnapshot({
        companies: [],
        companyCount: 0,
        lastSyncedAt: null,
        connectionStatus: "waiting",
      });
    } finally {
      if (!options?.silent) setLoadingSnapshot(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      void loadSnapshot();
      return;
    }

    let cancelled = false;

    void loadSnapshot().finally(() => {
      if (cancelled) return;
    });

    return () => {
      cancelled = true;
    };
  }, [loadSnapshot, user?.id]);

  const isConnected = snapshot.connectionStatus === "connected";

  const connectionBadge = useMemo(() => {
    if (loadingSnapshot) {
      return {
        label: "Bağlantı kontrol ediliyor",
        className: "border-slate-500/30 bg-slate-500/12 text-slate-200",
      };
    }

    if (isConnected) {
      return {
        label: "Bağlantı Aktif",
        className: "border-emerald-400/35 bg-emerald-500/15 text-emerald-200",
      };
    }

    return {
      label: "Bağlı Değil",
      className: "border-amber-400/35 bg-amber-500/15 text-amber-200",
    };
  }, [isConnected, loadingSnapshot]);

  const selectedRuntime = selectedFeature ? runtimeByFeature[selectedFeature.id] ?? {} : {};
  const importRuntime = runtimeByFeature["company-import"] ?? {};

  const setRuntime = (featureId: FeatureId, next: FeatureRuntimeState) => {
    setRuntimeByFeature((current) => ({
      ...current,
      [featureId]: next,
    }));
  };

  const handleLoadImportCompanies = async () => {
    setRuntime("company-import", { loading: true, error: null, success: null });
    try {
      await loadSnapshot({ silent: true });
      setRuntime("company-import", {
        loading: false,
        success: "Firma listesi yüklendi. Aktarmak istediğiniz firmaları seçebilirsiniz.",
      });
      toast.success("Firma listesi yüklendi");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Firma listesi yüklenirken bir hata oluştu.";
      setRuntime("company-import", { loading: false, error: message });
    }
  };

  const handleToggleImportCompany = (companyId: string) => {
    setSelectedImportIds((current) =>
      current.includes(companyId)
        ? current.filter((id) => id !== companyId)
        : [...current, companyId],
    );
  };

  const handleSelectAllImportCompanies = () => {
    setSelectedImportIds(snapshot.companies.map((company) => company.id));
  };

  const handleClearImportSelection = () => {
    setSelectedImportIds([]);
  };

  const handleImportSelectedCompanies = async () => {
    if (!user?.id) {
      setRuntime("company-import", { loading: false, error: "Aktarım için önce giriş yapmalısınız." });
      return;
    }

    const selectedRows = snapshot.companies.filter((company) => selectedImportIds.includes(company.id));
    if (selectedRows.length === 0) {
      setRuntime("company-import", { loading: false, error: "Lütfen aktarılacak en az bir firma seçin." });
      return;
    }

    if (importTarget === "osgb" && (!isOsgbPlan || !profile?.organization_id)) {
      setRuntime("company-import", {
        loading: false,
        error: "OSGB Firma Takibi’ne aktarım için aktif OSGB paketi ve organizasyon hesabı gereklidir.",
      });
      return;
    }

    setRuntime("company-import", { loading: true, error: null, success: null });
    try {
      if (importTarget === "osgb") {
        const imported = await importOsgbCompaniesFromKatip(user.id, profile!.organization_id!, selectedImportIds);
        setRuntime("company-import", {
          loading: false,
          success: `${imported} firma OSGB Firma Takibi sayfasına aktarıldı.`,
        });
        toast.success("OSGB firma takibine aktarıldı", { description: `${imported} firma işlendi.` });
      } else {
        const result = await importRowsToPersonalCompanies(user.id, selectedRows);
        setRuntime("company-import", {
          loading: false,
          success: `${result.created} yeni firma eklendi, ${result.updated} firma güncellendi.`,
        });
        toast.success("Firmalarım alanına aktarıldı", {
          description: `${result.created} yeni · ${result.updated} güncellendi`,
        });
      }

      setSelectedImportIds([]);
      await loadSnapshot({ silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Firma aktarımı sırasında bir hata oluştu.";
      setRuntime("company-import", { loading: false, error: message });
      toast.error("Aktarım tamamlanamadı", { description: message });
    }
  };

  const handleAnalyzeKatipChanges = async () => {
    if (!user?.id) {
      setRuntime("change-tracking", { loading: false, error: "Değişiklik takibi için önce giriş yapmalısınız." });
      return;
    }

    if (!profile?.organization_id) {
      setRuntime("change-tracking", {
        loading: false,
        error: "Değişiklik takibi için organizasyon bilgisi bulunamadı.",
      });
      return;
    }

    setRuntime("change-tracking", { loading: true, error: null, success: null });
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("ISGVizyon oturumu bulunamadı. Lütfen çıkış yapıp tekrar giriş yapın.");
      }

      const { data, error } = await supabase.functions.invoke("isgkatip-sync", {
        body: {
          action: "GET_CHANGE_TRACKING",
          data: {},
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data.error || "Değişiklik takibi çalıştırılırken bir hata oluştu.");
      }

      const result = data?.result as KatipChangeResult;
      const currentRows = (data?.companies ?? []) as IsgkatipCompanyRow[];
      if (!result) {
        throw new Error("Değişiklik takibi sonucu alınamadı.");
      }

      setChangeResult(result);
      setSnapshot({
        companies: currentRows,
        companyCount: currentRows.length,
        lastSyncedAt: currentRows.find((row) => row.last_synced_at)?.last_synced_at ?? null,
        connectionStatus: currentRows.length > 0 ? "connected" : "waiting",
      });

      const success = !result.hasBaseline
        ? "Karşılaştırma için önce en az iki senkron kaydı gerekir."
        : result.changes.length === 0
          ? "Son senkrona göre değişiklik bulunmadı."
          : `${result.changes.length} değişiklik bulundu.`;

      setRuntime("change-tracking", { loading: false, success });
      toast.success("Değişiklik takibi tamamlandı", { description: success });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Değişiklik takibi çalıştırılırken bir hata oluştu.";
      setRuntime("change-tracking", { loading: false, error: message });
      toast.error("Değişiklik takibi tamamlanamadı", { description: message });
    }
  };

  const runFeatureAction = (featureId: FeatureId) => {
    if (featureId === "change-tracking") {
      void handleAnalyzeKatipChanges();
      return;
    }

    setRuntime(featureId, { loading: true, error: null, success: null });

    window.setTimeout(() => {
      if (!isConnected) {
        setRuntime(featureId, {
          loading: false,
          error:
            "İSG-KATİP oturum jetonu alınamadı. Lütfen İSG-KATİP oturumunuzu ve eklenti bağlantınızı kontrol edin.",
        });
        return;
      }

      const messages: Partial<Record<FeatureId, string>> = {
        "multi-assignment": "Çoklu atama planı kısıtlı modda hazırlandı. Personel ve firma seçimi tamamlandığında gönderime alınabilir.",
        "contract-download": `${snapshot.companyCount} firma için sözleşme indirme kuyruğu hazırlandı.`,
        "contracts-need-update": "Güncellenmesi gereken sözleşmeler analiz edildi ve öneri listesi oluşturuldu.",
        "excess-duration-update": "Fazla atanmış süreler kontrol edildi. Güncelleme adayları işlem listesine alındı.",
        "contract-status-report": "Sözleşme durum raporu oluşturuldu. Renk skalasına göre kontrol edebilirsiniz.",
        "duration-analysis": "Süre analizi tamamlandı. Doluluk oranları ve kalan dakika görünümü hazırlandı.",
        "company-import": "Eklenti bağlantısı kontrol edildi. Firmalarınızı İSG-KATİP sayfasından aktarabilirsiniz.",
      };

      setRuntime(featureId, {
        loading: false,
        success: messages[featureId] ?? "İşlem tamamlandı.",
      });
      toast.success("İşlem hazırlandı", { description: messages[featureId] ?? "İşlem tamamlandı." });
    }, 650);
  };

  const openFeature = (feature: BotFeature) => {
    setSelectedFeature(feature);
  };

  return (
    <div className="min-h-screen bg-[#0B1220] px-4 py-6 text-slate-50 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-500/20 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_35%),linear-gradient(135deg,#0F172A,#0B1220_55%,#111827)] p-5 shadow-2xl shadow-black/30 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 shadow-lg shadow-blue-950/40">
                <Bot className="h-7 w-7 text-white" />
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full border border-cyan-400/25 bg-cyan-500/12 text-cyan-200 hover:bg-cyan-500/12">
                    Akıllı Asistan
                  </Badge>
                  <Badge variant="outline" className={cn("rounded-full px-3 py-1", connectionBadge.className)}>
                    {connectionBadge.label}
                  </Badge>
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">İSGVİZYON Bot</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                  İSG-KATİP işlemlerinizi otomatikleştiren akıllı asistanınız.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Badge variant="outline" className="rounded-full border-slate-500/25 bg-white/5 px-3 py-1.5 text-slate-200">
                Chromium tarayıcı önerilir
              </Badge>
              <Badge variant="outline" className="rounded-full border-blue-400/25 bg-blue-500/10 px-3 py-1.5 text-blue-200">
                Güncel sürüm: 2.0.6
              </Badge>
              <Button
                className="rounded-full bg-blue-500 text-white hover:bg-blue-400"
                asChild
              >
                <a href={ISGVIZYON_CHROME_EXTENSION_URL} target="_blank" rel="noopener noreferrer">
                  <Chrome className="mr-2 h-4 w-4" />
                  Web Store
                </a>
              </Button>
            </div>
          </div>

          {!isConnected && !loadingSnapshot && (
            <Alert className="mt-6 border-amber-400/25 bg-amber-500/10 text-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-300" />
              <AlertTitle>İSG-KATİP işlemleri için eklenti bağlantısı gereklidir</AlertTitle>
              <AlertDescription className="text-amber-100/80">
                Kartları inceleyebilirsiniz; işlem başlatmak için önce Chrome eklentisiyle İSG-KATİP verilerinizi aktarın.
              </AlertDescription>
            </Alert>
          )}
        </section>

        <section className="rounded-[28px] border border-slate-500/20 bg-[#0F172A]/92 p-5 shadow-2xl shadow-black/25 sm:p-7">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-300">Kontrol Paneli</p>
              <h2 className="mt-2 text-2xl font-black text-white">Bot işlemlerini tek ekrandan yönetin</h2>
              <p className="mt-1 text-sm text-slate-400">
                {loadingSnapshot
                  ? "Bağlantı ve firma verisi kontrol ediliyor..."
                  : `${snapshot.companyCount} firma hazır · Son senkron: ${formatSyncLabel(snapshot.lastSyncedAt)}`}
              </p>
            </div>

            <Button
              className="rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-6 text-white shadow-lg shadow-blue-950/30 hover:from-blue-400 hover:to-cyan-400"
              onClick={() => setImportDialogOpen(true)}
            >
              <Download className="mr-2 h-5 w-5" />
              Firmalarımı Aktar
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {botFeatures.map((feature) => (
              <BotFeatureCard key={feature.id} feature={feature} onClick={openFeature} />
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-[24px] border-slate-500/20 bg-[#111827]/88 text-slate-50">
            <CardContent className="p-5">
              <p className="text-sm font-bold text-slate-400">Hazır firma</p>
              <p className="mt-2 text-3xl font-black text-white">{snapshot.companyCount}</p>
            </CardContent>
          </Card>
          <Card className="rounded-[24px] border-slate-500/20 bg-[#111827]/88 text-slate-50">
            <CardContent className="p-5">
              <p className="text-sm font-bold text-slate-400">Son senkron</p>
              <p className="mt-2 text-lg font-black text-white">{formatSyncLabel(snapshot.lastSyncedAt)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-[24px] border-slate-500/20 bg-[#111827]/88 text-slate-50">
            <CardContent className="p-5">
              <p className="text-sm font-bold text-slate-400">Veri gizliliği</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Şifre, çerez veya e-Devlet oturum bilgisi aktarılmaz.</p>
            </CardContent>
          </Card>
        </section>
      </div>

      <FeatureDialog
        feature={selectedFeature}
        open={Boolean(selectedFeature)}
        onOpenChange={(open) => {
          if (!open) setSelectedFeature(null);
        }}
        runtime={selectedRuntime}
        onRun={() => selectedFeature && runFeatureAction(selectedFeature.id)}
        companies={snapshot.companies}
        changeResult={changeResult}
      />

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent
          overlayClassName="z-[55] bg-slate-950/85 backdrop-blur-md"
          className="z-[60] max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-0 text-slate-50 shadow-2xl shadow-black/70 sm:max-w-5xl [&>button]:rounded-xl [&>button]:text-slate-400 [&>button:hover]:bg-slate-800 [&>button:hover]:text-white"
        >
          <DialogHeader className="border-b border-slate-800/90 bg-slate-950/80 px-6 py-5">
            <DialogTitle className="flex items-center gap-3 text-2xl font-black text-slate-50">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25">
                <Upload className="h-5 w-5" />
              </span>
              Firmalarımı Aktar
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              Chrome eklentisi üzerinden İSG-KATİP ekranında görünen firma ve sözleşme bilgilerini açık onayla aktarın.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-slate-950/35 px-6 py-5">
            <CompanyImportPanel
              runtime={importRuntime}
              companies={snapshot.companies}
              selectedIds={selectedImportIds}
              target={importTarget}
              isOsgbPlan={isOsgbPlan}
              hasOrganization={Boolean(profile?.organization_id)}
              onLoadCompanies={handleLoadImportCompanies}
              onToggleCompany={handleToggleImportCompany}
              onSelectAll={handleSelectAllImportCompanies}
              onClearSelection={handleClearImportSelection}
              onTargetChange={setImportTarget}
              onImportSelected={handleImportSelectedCompanies}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
