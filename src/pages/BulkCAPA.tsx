import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, FileText, ImageIcon, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface HazardEntry {
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
}

interface BulkCAPAGeneralInfo {
  company_name: string;
  company_logo_url: string | null;
  provider_logo_url: string | null;
  area_region: string;
  observation_range: string;
  report_date: string;
  observer_name: string;
  observer_certificate_no: string;
  responsible_person: string;
  employer_representative_title: string;
  employer_representative_name: string;
  report_no: string;
}

export interface BulkCAPADraftSnapshot {
  companyInputMode: "existing" | "manual";
  selectedCompanyId: string;
  manualCompanyName: string;
  generalInfo: BulkCAPAGeneralInfo;
  newEntry: HazardEntry;
  bulkSourceImages?: string[];
  entries: HazardEntry[];
  overallAnalysis: string;
  createMode: "single" | "bulk";
  createStep: "general" | "items";
  createDialogOpen?: boolean;
  sessionId?: string | null;
  sessionStatus?: string | null;
  sessionJobType?: string | null;
}

const BULK_CAPA_DRAFT_STORAGE_KEY_PREFIX = "bulk-capa-draft";
const BULK_CAPA_DRAFT_FALLBACK_STORAGE_KEY = `${BULK_CAPA_DRAFT_STORAGE_KEY_PREFIX}:fallback`;
const BULK_CAPA_DRAFT_LAST_KEY_STORAGE_KEY = `${BULK_CAPA_DRAFT_STORAGE_KEY_PREFIX}:last-key`;

const steps = [
  {
    title: "1. Tek Bir Uygunsuzluğu Seç",
    text: "Her DÖF kaydı bir ana uygunsuzluğu anlatmalı. Birden fazla konuyu aynı kayda sıkıştırmayın.",
    icon: ClipboardList,
  },
  {
    title: "2. Kanıt Fotoğraflarını Hazırla",
    text: "Aynı uygunsuzluğu gösteren 1-3 net fotoğraf yeterlidir. Farklı alan veya risk fotoğraflarını ayrı kayıt yapın.",
    icon: ImageIcon,
  },
  {
    title: "3. Risk ve Aksiyonu Netleştir",
    text: "Tespit, risk tanımı, düzeltici faaliyet, önleyici faaliyet, sorumlu kişi ve termin tarihini kontrol edin.",
    icon: ShieldCheck,
  },
  {
    title: "4. Raporlamadan Önce Kontrol Et",
    text: "Önem seviyesi, mevzuat dili ve termin tarihi insan kontrolünden geçmeden rapora alınmamalıdır.",
    icon: FileText,
  },
];

const rules = [
  "Firma, saha/alan, gözlem tarihi ve gözlem yapan kişi bilgilerini eksiksiz girin.",
  "Her bulguda tespit edilen uygunsuzluğu kısa, açık ve denetlenebilir yazın.",
  "Risk tanımında olası sonucu belirtin; sadece problem başlığını tekrar etmeyin.",
  "Düzeltici faaliyet mevcut uygunsuzluğu kapatmalı, önleyici faaliyet tekrarını engellemelidir.",
  "Sorumlu kişi ve termin tarihi olmadan DÖF kaydı tamamlanmış sayılmamalıdır.",
];

const avoid = [
  "Tek kayıtta çok sayıda farklı risk anlatmak",
  "Belirsiz veya bulanık fotoğraflarla rapor oluşturmak",
  "AI metnini kontrol etmeden müşteriye göndermek",
  "Termin tarihini ve sorumluyu boş bırakmak",
];

export const readStoredBulkCapaDraft = () => {
  if (typeof window === "undefined") return null;

  try {
    const preferredKey =
      window.localStorage.getItem(BULK_CAPA_DRAFT_LAST_KEY_STORAGE_KEY) ||
      BULK_CAPA_DRAFT_FALLBACK_STORAGE_KEY;
    const raw =
      window.localStorage.getItem(preferredKey) ||
      window.localStorage.getItem(BULK_CAPA_DRAFT_FALLBACK_STORAGE_KEY);

    if (!raw) return null;
    return JSON.parse(raw) as Partial<BulkCAPADraftSnapshot>;
  } catch {
    return null;
  }
};

export const sanitizeBulkCapaDraftForLocalStorage = (
  snapshot: BulkCAPADraftSnapshot,
): BulkCAPADraftSnapshot => ({
  ...snapshot,
  generalInfo: {
    ...snapshot.generalInfo,
    company_logo_url: snapshot.generalInfo.company_logo_url?.startsWith("data:")
      ? null
      : snapshot.generalInfo.company_logo_url,
    provider_logo_url: snapshot.generalInfo.provider_logo_url?.startsWith("data:")
      ? null
      : snapshot.generalInfo.provider_logo_url,
  },
  newEntry: {
    ...snapshot.newEntry,
    media_urls: [],
  },
  bulkSourceImages: [],
  entries: snapshot.entries.map((entry) => ({
    ...entry,
    media_urls: [],
  })),
});

export const persistBulkCapaDraftSnapshot = async (
  scopedKey: string | null,
  snapshot: BulkCAPADraftSnapshot,
) => {
  if (typeof window === "undefined") return;

  const serialized = JSON.stringify(sanitizeBulkCapaDraftForLocalStorage(snapshot));

  try {
    if (scopedKey) {
      window.localStorage.setItem(scopedKey, serialized);
      window.localStorage.setItem(BULK_CAPA_DRAFT_LAST_KEY_STORAGE_KEY, scopedKey);
    }

    window.localStorage.setItem(BULK_CAPA_DRAFT_FALLBACK_STORAGE_KEY, serialized);
  } catch (error) {
    console.warn("Bulk CAPA draft persistence failed:", error);
  }
};

export const clearPersistedBulkCapaDraft = async (scopedKey: string | null) => {
  if (typeof window === "undefined") return;

  try {
    if (scopedKey) {
      window.localStorage.removeItem(scopedKey);
    }
    window.localStorage.removeItem(BULK_CAPA_DRAFT_FALLBACK_STORAGE_KEY);
    window.localStorage.removeItem(BULK_CAPA_DRAFT_LAST_KEY_STORAGE_KEY);
  } catch (error) {
    console.warn("Bulk CAPA draft cleanup failed:", error);
  }
};

export const attachBulkCapaDraftFlushListeners = ({
  flushDraft,
}: {
  flushDraft: () => void;
}) => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      flushDraft();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    flushDraft();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
};

export function BulkCAPAContent() {
  const { user } = useAuth();
  const draft = useMemo(() => {
    const scopedKey = user?.id ? `${BULK_CAPA_DRAFT_STORAGE_KEY_PREFIX}:${user.id}` : null;
    if (typeof window === "undefined" || !scopedKey) return readStoredBulkCapaDraft();

    try {
      const raw = window.localStorage.getItem(scopedKey);
      return raw ? (JSON.parse(raw) as Partial<BulkCAPADraftSnapshot>) : readStoredBulkCapaDraft();
    } catch {
      return readStoredBulkCapaDraft();
    }
  }, [user?.id]);

  return (
    <div className="w-full min-w-0 space-y-6 px-4 py-6 lg:px-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge className="border-cyan-400/30 bg-cyan-500/15 text-cyan-100">Bulk CAPA</Badge>
              <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-100">Temel Kullanım</Badge>
            </div>
            <h1 className="text-2xl font-black tracking-tight lg:text-4xl">Toplu DÖF Ekranı</h1>
            <p className="text-sm leading-6 text-slate-300 lg:text-base">
              Bu ekranın amacı, saha fotoğraflarından veya gözlem notlarından düzenli DÖF kayıtları
              hazırlamadan önce kullanıcıya doğru çalışma şeklini anlatmaktır.
            </p>
          </div>
        </div>
      </section>

      <Card className="border-amber-500/30 bg-amber-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-200">
            <AlertTriangle className="h-5 w-5" />
            Ana Kural
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-amber-100">
          Her DÖF kaydı tek bir uygunsuzluk ve tek bir risk odağı taşımalıdır. Kullanıcı önce konuyu
          sadeleştirmeli, sonra kanıtı ve aksiyon planını eklemelidir.
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Card key={step.title} className="border-slate-800 bg-slate-950/70">
              <CardContent className="p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-200">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-base font-bold text-slate-100">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{step.text}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-emerald-500/25 bg-emerald-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-200">
              <CheckCircle2 className="h-5 w-5" />
              Kullanıcı Ne Yapmalı?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-emerald-100">
            {rules.map((rule) => (
              <p key={rule} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{rule}</span>
              </p>
            ))}
          </CardContent>
        </Card>

        <Card className="border-rose-500/25 bg-rose-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-200">
              <AlertTriangle className="h-5 w-5" />
              Nelerden Kaçınmalı?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-rose-100">
            {avoid.map((item) => (
              <p key={item} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{item}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      </section>

      {draft ? (
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-slate-100">Kaydedilmiş Taslak Özeti</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-slate-300">Firma</Label>
              <Input readOnly value={draft.manualCompanyName || draft.generalInfo?.company_name || ""} />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Bulgu</Label>
              <Input readOnly value={draft.newEntry?.description || ""} />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Gözlem Yapan</Label>
              <Input readOnly value={draft.generalInfo?.observer_name || ""} />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function BulkCAPA() {
  return <BulkCAPAContent />;
}
