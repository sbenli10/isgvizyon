import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Award,
  BookOpen,
  Building2,
  CalendarDays,
  Clock3,
  Download,
  FileArchive,
  FileSpreadsheet,
  Flame,
  Palette,
  History,
  HelpCircle,
  ImagePlus,
  Loader2,
  Mountain,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  DoorOpen,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { uploadFileOptimized } from "@/lib/storageHelper";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import {
  createCertificate,
  generateCertificateJob,
  getCertificateDownload,
  getCertificateItemDownload,
  getCertificateStatus,
} from "@/lib/certificateApi";
import { createCertificateExcelTemplate, parseCertificateParticipantsExcel } from "@/lib/certificateExcel";
import type {
  CertificateDesignConfig,
  CertificateFormValues,
  CertificateJobItem,
  CertificateJobRecord,
  CertificateParticipantInput,
  CertificateRecord,
} from "@/types/certificates";
import type { Company } from "@/types/companies";

// ====================================================
// ✅ FIX: local type for signatures (prevents TS2552)
// If you already have this type in "@/types/certificates", import it instead and delete this.
// ====================================================
type CertificateSignatureConfig = {
  name: string;
  title: string;
  image_url?: string;
};

const CERTIFICATE_BUCKET = "certificate-files";

function safeDecodeStoragePath(path: string) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function normalizeCertificateStoragePath(input?: string | null): string {
  if (!input) return "";

  let path = input.trim();
  if (!path) return "";

  path = path.split("?")[0].split("#")[0];
  path = path.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/(?:public|sign)\/certificate-files\//i, "");
  path = path.replace(/^certificate-files\//i, "");
  path = path.replace(/^\/+/, "");

  return safeDecodeStoragePath(path).replace(/^\/+/, "");
}

function splitStoragePath(path: string) {
  const segments = path.split("/").filter(Boolean);
  const name = segments.pop() || "";

  return {
    folder: segments.join("/"),
    name,
  };
}

async function certificateStorageObjectExists(path: string) {
  const { folder, name } = splitStoragePath(path);
  if (!folder || !name) return false;

  const { data, error } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .list(folder, {
      limit: 100,
      search: name,
    });

  if (error) {
    console.error("[CertificatesDashboard] storage object existence check failed", {
      bucket: CERTIFICATE_BUCKET,
      folder,
      name,
      message: error.message,
      statusCode: (error as { statusCode?: string | number } | null)?.statusCode,
    });

    return true;
  }

  return Boolean(data?.some((item) => item.name === name));
}

async function createCertificateSignedUrl(rawPath?: string | null, expiresIn = 60 * 60) {
  const path = normalizeCertificateStoragePath(rawPath);

  if (!path) {
    throw new Error("Sertifika dosya yolu bulunamadı.");
  }

  const exists = await certificateStorageObjectExists(path);
  if (!exists) {
    console.error("[CertificatesDashboard] certificate file missing in storage", {
      bucket: CERTIFICATE_BUCKET,
      path,
    });

    throw new Error("PDF dosyası depolama alanında bulunamadı. Dosya silinmiş, taşınmış veya yükleme tamamlanmamış olabilir.");
  }

  const { data, error } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    console.error("[CertificatesDashboard] signed url failed", {
      bucket: CERTIFICATE_BUCKET,
      path,
      message: error?.message,
      statusCode: (error as { statusCode?: string | number } | null)?.statusCode,
    });

    throw new Error("PDF dosyası depolama alanında bulunamadı veya erişim bağlantısı oluşturulamadı.");
  }

  return data.signedUrl;
}

// ====================================================
// DEFAULTS
// ====================================================

const defaultForm: CertificateFormValues = {
  company_id: null,
  company_name: "",
  company_address: "",
  company_phone: "",
  training_name: "Temel İş Sağlığı ve Güvenliği Eğitimi",
  training_date: new Date().toISOString().slice(0, 10),
  training_duration: "8 Saat",
  certificate_type: "Katılım",
  validity_date: "",
  logo_url: "",
  template_type: "academy",
  frame_style: "blue",
  trainer_names: [""],
  notes: "",
  design_config: {
    primaryColor: "#005a9c",
    secondaryColor: "#0ea5e9",
    fontFamily: "serif",
    showBadge: true,
    showSeal: true,
    titleText: "",
    descriptionText: "",
    osgb_logo_url: "",
    signatureCount: 4,
    signatures: [
      { name: "", title: "İSG Uzmanı" },
      { name: "", title: "İşyeri Hekimi" },
      { name: "", title: "İşveren Vekili" },
      { name: "", title: "OSGB Yetkilisi" },
    ],
  },
};

const templateCards = [
  { value: "academy", title: "İSGVİZYON Kurumsal Mavi", text: "Mavi/beyaz resmi çerçeve, QR doğrulama, konu ve imza alanlarıyla baskıya uygun ana şablon" },
  { value: "classic", title: "Prestij Klasik", text: "Geleneksel çerçeve, resmi görünüm ve sade kurumsal yerleşim" },
  { value: "executive", title: "Yönetici Altın", text: "Üst düzey teslimler için daha seçkin, premium ve davetiye benzeri sertifika yapısı" },
  { value: "compliance", title: "Mevzuat Uyum", text: "OSGB ve İSG eğitimleri için bilgi yoğun, düzenli ve denetim dostu resmi düzen" },
  { value: "modern", title: "Kurumsal Modern", text: "Çağdaş görünüm, yüksek kontrast ve dijital teslim odaklı premium tasarım" },
  { value: "minimal", title: "Minimal Baskı", text: "Temiz çizgiler, sade tipografi ve hızlı baskı için dengeli görünüm" },
] as const;

type CertificateCenterTabId = "isg" | "height" | "confined" | "fire";

const certificateCenterTabs = [
  {
    id: "isg",
    title: "İSG Sertifikası",
    subtitle: "Temel eğitim belgesi",
    icon: ShieldCheck,
    accent: "from-emerald-500 to-cyan-500",
    iconClassName: "text-emerald-300",
    description: "Mevcut toplu sertifika üretim formu ve katılımcı akışı bu sekmede çalışır.",
  },
  {
    id: "height",
    title: "Yüksekte Çalışma Sertifikası",
    subtitle: "Yüksekte çalışma eğitimi",
    icon: Mountain,
    accent: "from-sky-500 to-indigo-500",
    iconClassName: "text-sky-300",
    description: "Yüksekte çalışma sertifikası için ayrı tasarım ve alanlar bu sekmede hazırlanacak.",
  },
  {
    id: "confined",
    title: "Kapalı Alanlarda Çalışma Sertifikası",
    subtitle: "Kapalı alan eğitimi",
    icon: DoorOpen,
    accent: "from-violet-500 to-fuchsia-500",
    iconClassName: "text-violet-300",
    description: "Kapalı alanlarda çalışma sertifikasına ait özel form yapısı bu sekmede konumlandırılacak.",
  },
  {
    id: "fire",
    title: "Yangın Eğitimi Sertifikası",
    subtitle: "Yangın ve acil durum eğitimi",
    icon: Flame,
    accent: "from-orange-500 to-rose-500",
    iconClassName: "text-orange-300",
    description: "Yangın eğitimi sertifikası için ayrı tasarım ve belge ayarları bu sekmede hazırlanacak.",
  },
] as const;

const certificateSectorOptions = [
  "İnşaat",
  "Metal / Demir-Çelik",
  "Gıda Üretimi",
  "Tekstil",
  "Maden",
  "Kimya / Petrokimya",
  "Sağlık / Hastane",
  "Eğitim",
  "Lojistik / Depoculuk",
  "Otomotiv",
  "Enerji / Elektrik",
  "Tarım / Hayvancılık",
  "Mobilya / Ağaç İşleri",
  "Plastik / Kauçuk",
  "Cam / Seramik",
  "Matbaa / Ambalaj",
  "Otel / Turizm",
  "Perakende / AVM",
  "İlaç / Eczacılık",
  "Telekomünikasyon",
  "Temizlik Hizmetleri",
  "Güvenlik Hizmetleri",
  "Nakliyat / Taşımacılık",
  "Belediye / Kamu",
  "Havacılık",
  "Denizcilik / Gemi",
  "Savunma Sanayi",
  "Boya / Vernik",
  "Çimento / Beton",
  "Deri / Ayakkabı",
  "Elektronik / Bilişim",
  "Kağıt / Selüloz",
  "Mermer / Doğal Taş",
  "Atık Yönetimi / Geri Dönüşüm",
  "Su / Kanalizasyon",
  "Doğalgaz / LPG",
  "Hava Koşullarına Açık İşler",
  "Banka / Finans",
  "Call Center / Çağrı Merkezi",
  "Ofis / Büro",
  "Restoran / Yemek",
  "Fırın / Pastane",
  "Kuaför / Güzellik",
  "Oto Tamir / Servis",
  "Eczane",
  "Çiçekçi / Sera",
  "Oto Yıkama",
  "Montaj ve Bakım-Onarım",
  "Kreş / Anaokulu",
  "Veteriner / Pet Shop",
  "Spor / Fitness",
  "İtfaiye / Kurtarma",
] as const;

type CertificateTopicSection = {
  title: string;
  isOptional?: boolean;
  topics: string[];
};

const defaultCertificateTopicSections: CertificateTopicSection[] = [
  {
    title: "Genel Konular",
    topics: [
      "a) Çalışma mevzuatı ile ilgili bilgiler",
      "b) Çalışanların yasal hak ve sorumlulukları",
      "c) İşyeri temizliği ve düzeni",
      "ç) İş kazası ve meslek hastalığından doğan hukuki sonuçlar",
    ],
  },
  {
    title: "Sağlık Konuları",
    topics: [
      "a) Meslek hastalıklarının sebepleri",
      "b) Hastalıktan korunma prensipleri ve korunma teknikleri",
      "c) Biyolojik ve psikososyal risk etmenleri",
      "ç) İlk yardım",
      "d) Bağımlılık yapıcı maddelerin zararları ve teknoloji bağımlılığı",
    ],
  },
  {
    title: "Teknik Konular",
    topics: [
      "a) Kimyasal, fiziksel ve ergonomik risk etmenleri",
      "b) Elle kaldırma ve taşıma",
      "c) Parlama, patlama",
      "ç) Yangın ve yangından korunma",
      "d) İş ekipmanlarının güvenli kullanımı",
      "e) Ekranlı araçlarla çalışma",
      "f) Elektrik, tehlikeleri, riskleri ve önlemleri",
      "g) İş kazalarının sebepleri ve korunma prensipleri ile teknikleri",
      "ğ) Sağlık ve güvenlik işaretleri",
      "h) Kişisel koruyucu donanım kullanımı",
      "ı) İş sağlığı ve güvenliği genel kuralları ve güvenlik kültürü",
      "i) Acil durumlar, tahliye ve kurtarma",
    ],
  },
  {
    title: "İşyerine Özgü Riskler",
    isOptional: true,
    topics: [],
  },
];

const heightCertificateTopicSections: CertificateTopicSection[] = [
  {
    title: "Yüksekte Çalışma Eğitim Konuları",
    topics: [
      "Düşmeye karşı koruma önlemleri ve sistemleri",
      "İskelelerde güvenli çalışma",
      "Yaşam hatları ve Tam vücut tipi emniyet kemeri.",
      "Yüksekte çalışırken dikkat edilecek hususlar",
      "Temel güvenlik kuralları, iş planı ve alanın organizasyonu",
      "İşe uygun merdiven iskele seçimi - merdiven ve iskelelerin kurulması ve sabitlenmesi",
      "Toplu koruma yöntemleri ve önemi (korkuluk, platform, güvenlik ağı, barikatlama, işaretleme vs.)",
      "Kişisel koruyucu donanımlar (standart personel koruyucu ekipmanlar)",
      "Temel emniyet ipi ile enerji tutucu sistemlerin kullanımı ve özellikleri",
      "Çatılarda çalışma ve alınacak önlemler",
      "Yüksek iş makinelerinde alınacak önlemler",
      "Yüksekte yapılacak çalışmalarda tehlike ve risklerin önceden belirlenmesi ve önlenmesi",
      "Düşme faktörü kavramı ve önlemler, düşmeden korunmanın teorisi ve uygulamaları",
    ],
  },
];

const confinedCertificateTopicSections: CertificateTopicSection[] = [
  {
    title: "Kapalı Alanlarda Çalışma Eğitim Konuları",
    topics: [
      "KAPALI/SINIRLI ALAN TANIMI, TÜRLERİ VE SINIFLANDIRMASI (I. II. III. SINIF)",
      "YASAL ÇERÇEVE: 6331 SAYILI İSG KANUNU, İLGİLİ YÖNETMELİKLER VE ULUSLARARASI STANDARTLAR (OSHA 1910.146)",
      "KAPALI ALAN KAZA İSTATİSTİKLERİ, ÖNEMİ VE RİSK DEĞERLENDİRMESİ ZORUNLULUĞU",
      "ATMOSFERİK TEHLİKELER: OKSİJEN YETERSİZLİĞİ, PARLAYICI/PATLAYICI ORTAM VE ZEHİRLİ ORTAM",
      "OKSİJEN DENGESİ: GÜVENLİ ARALIK, YETERSİZLİK NEDENLERİ VE OKSİJENCE ZENGİN ORTAMDA ARTAN YANMA/TUTUŞMA RİSKİ",
      "BOĞUCU VE ZEHİRLİ GAZLAR: H2S, KARBON MONOKSİT (CO), METAN, CO2 VE TEHLİKENİN DUYULARLA ALGILANAMAMASI",
      "PARLAYICI/PATLAYICI ATMOSFER, ALT VE ÜST PATLAMA SINIRLARI (LEL/UEL) VE ATEX ÖNLEMLERİ",
      "FİZİKSEL VE DİĞER TEHLİKELER: GÖMÜLME/BOĞULMA, SIKIŞMA, TERMAL STRES, GÜRÜLTÜ VE BİYOLOJİK ETKENLER",
      "ATMOSFER ÖLÇÜMÜ VE GAZ DEDEKTÖRÜ KULLANIMI: ÖLÇÜM SIRASI, KATMANLI ÖLÇÜM VE SÜREKLİ İZLEME",
      "GAZ ÖLÇÜM CİHAZLARININ KALİBRASYONU, BUMP TEST VE ALARM SEVİYELERİ",
      "KAPALI ALANA GÜVENLİ GİRİŞ İZNİ SİSTEMİ (PERMIT-TO-WORK), İZİN FORMU VE GİRİŞİN SONLANDIRILMASI",
      "ENERJİ İZOLASYONU, KİLİTLEME-ETİKETLEME (LOTO), KÖRLEME, PURGE VE İNERTLEME",
      "ZORLAMALI (CEBRİ) MEKANİK HAVALANDIRMA VE EX-PROOF EKİPMAN KULLANIMI",
      "GÖREV VE SORUMLULUKLAR: GİREN PERSONEL, BEKÇİ/GÖZETMEN, GİRİŞ SORUMLUSU VE GAZ ÖLÇÜM YETKİLİSİ",
      "İLETİŞİM VE HABERLEŞME SİSTEMLERİ: SESLİ, TELSİZ, HALAT İŞARETİ VE SÜREKLİ HABERLEŞME KURALI",
      "KİŞİSEL KORUYUCU DONANIM VE SOLUNUM KORUMA: SCBA, HAVA HATLI/KAÇIŞ CİHAZLARI, TAM VÜCUT KEMERİ VE SEÇİM HİYERARŞİSİ",
      "ACİL DURUM, KURTARMA VE TAHLİYE PLANI: KURTARMA HİYERARŞİSİ, EKİPMANLAR (TRIPOD/VİNÇ/HALAT) VE TATBİKAT",
      "YANLIŞ KURTARMANIN ÖLÜMCÜL TEHLİKESİ ('ÖLÜ KAHRAMAN' İLKESİ), İLK YARDIM VE TEMEL YAŞAM DESTEĞİ",
    ],
  },
];

function getDefaultTopicSectionsForCertificateTab(tab: CertificateCenterTabId) {
  if (tab === "height") return heightCertificateTopicSections;
  if (tab === "confined") return confinedCertificateTopicSections;
  return defaultCertificateTopicSections;
}

function serializeCertificateTopicSections(sections: CertificateTopicSection[]) {
  return sections
    .map((section, sectionIndex) => {
      const title = `${sectionIndex + 1}. ${section.title.toLocaleUpperCase("tr-TR")}`;
      const topics = section.topics.map((topic) => `- ${topic}`).join("\n");
      return [title, topics].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

// ====================================================
// HELPERS
// ====================================================

function toDisplayText(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const candidate = (value as Record<string, unknown>).name;
    return typeof candidate === "string" ? candidate : "";
  }
  return "";
}

function splitCertificateTopics(value?: string | null) {
  let activeSection = "";
  const topics = (value || "")
    .split(/\r?\n|;/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => {
      const normalized = item.toLocaleLowerCase("tr-TR");
      if (normalized.includes("genel konular")) {
        activeSection = "general";
        return [];
      }
      if (normalized.includes("sağlık konuları") || normalized.includes("saglik konulari")) {
        activeSection = "health";
        return [];
      }
      if (normalized.includes("teknik konular")) {
        activeSection = "technical";
        return [];
      }

      const cleanItem = item.replace(/^[-•]\s*/, "").trim();
      return cleanItem ? [`${activeSection || "manual"}::${cleanItem}`] : [];
    });

  return topics.length > 0 ? topics : ["Konu bilgisi bulunmamaktadır."];
}

function formatPreviewDate(value?: string | null, fallback = "Belirtilmedi") {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("tr-TR");
}

function normalizeFileNameForStorage(fileName: string) {
  const extension = (fileName.split(".").pop() || "bin")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12) || "bin";
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const safeBase = baseName
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "G")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "U")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "O")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "C")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${safeBase || "logo"}.${extension}`;
}

function normalizeRoleText(value: unknown) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function findAssignmentPerson(assignments: any[], roleKeywords: string[]) {
  const normalizedKeywords = roleKeywords.map(normalizeRoleText);
  return assignments.find((assignment) => {
    const haystack = [
      assignment.role_type,
      assignment.assignment_group,
      assignment.notes,
    ].map(normalizeRoleText).join(" ");

    return normalizedKeywords.some((keyword) => haystack.includes(keyword));
  });
}

async function loadCompanyCertificatePeople(company: Company) {
  try {
    const { data, error } = await (supabase as any)
      .from("company_assignments")
      .select("role_type, assignment_group, person_name, certificate_no, phone, email, notes")
      .eq("company_id", company.id)
      .eq("is_active", true);

    if (error) throw error;

    const assignments = Array.isArray(data) ? data : [];
    const safetyExpert = findAssignmentPerson(assignments, [
      "is guvenligi uzmani",
      "isg uzmani",
      "igu",
      "safety expert",
      "occupational safety",
      "uzman",
    ]);
    const workplaceDoctor = findAssignmentPerson(assignments, [
      "isyeri hekimi",
      "hekim",
      "doctor",
      "workplace doctor",
    ]);
    const employer = findAssignmentPerson(assignments, [
      "isveren",
      "isveren vekili",
      "yetkili",
      "employer",
    ]);

    return {
      safetyExpertName: safetyExpert?.person_name || company.occupational_safety_specialist_name || "",
      safetyExpertCertificateNo: safetyExpert?.certificate_no || "",
      workplaceDoctorName: workplaceDoctor?.person_name || company.workplace_doctor_name || "",
      workplaceDoctorCertificateNo: workplaceDoctor?.certificate_no || "",
      employerName: employer?.person_name || company.employer_representative_name || company.company_name || "",
    };
  } catch (error) {
    console.warn("[CertificatesDashboard] Firma atama bilgileri alınamadı", {
      companyId: company.id,
      message: error instanceof Error ? error.message : error,
    });

    return {
      safetyExpertName: company.occupational_safety_specialist_name || "",
      safetyExpertCertificateNo: "",
      workplaceDoctorName: company.workplace_doctor_name || "",
      workplaceDoctorCertificateNo: "",
      employerName: company.employer_representative_name || company.company_name || "",
    };
  }
}

async function uploadInlineCertificateAssetIfNeeded(value: string | undefined | null, fileName: string) {
  const source = (value || "").trim();
  if (!source || (!source.startsWith("data:") && !source.startsWith("blob:"))) return source;

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error("Geçici logo dosyası okunamadı. Logoyu yeniden yükleyin.");
  }

  const blob = await response.blob();
  const file = new File([blob], fileName, {
    type: blob.type || "image/png",
    lastModified: Date.now(),
  });

  return uploadCertificateAsset(file);
}

async function prepareCertificateAssetsForOutput(input: CertificateFormValues) {
  const designConfig = normalizeDesignConfig(input.design_config, input.trainer_names, input.company_name);
  const [logoUrl, osgbLogoUrl, signatures] = await Promise.all([
    uploadInlineCertificateAssetIfNeeded(input.logo_url, "kurum-logo.png"),
    uploadInlineCertificateAssetIfNeeded(designConfig.osgb_logo_url, "osgb-logo.png"),
    Promise.all(
      designConfig.signatures.map(async (signature, index) => ({
        ...signature,
        image_url: await uploadInlineCertificateAssetIfNeeded(signature.image_url, `imza-${index + 1}.png`),
      })),
    ),
  ]);

  return {
    ...input,
    logo_url: logoUrl || "",
    design_config: {
      ...designConfig,
      osgb_logo_url: osgbLogoUrl || "",
      signatures,
    },
  };
}

function buildDefaultDesignConfig(trainerNames: string[] = [], companyName = ""): CertificateDesignConfig {
  return {
    primaryColor: "#d4af37",
    secondaryColor: "#294d77",
    fontFamily: "serif",
    showBadge: true,
    showSeal: true,
    titleText: "",
    descriptionText: "",
    osgb_logo_url: "",
    signatureCount: 4,
    signatures: [
      { name: trainerNames[0] || "", title: "İSG Uzmanı" },
      { name: trainerNames[1] || "", title: "İşyeri Hekimi" },
      { name: companyName || "", title: "İşveren Vekili" },
      { name: "OSGB Yetkilisi", title: "Düzenleyen Birim" },
    ],
  };
}

function normalizeDesignConfig(value: unknown, trainerNames: string[] = [], companyName = ""): CertificateDesignConfig {
  const source = value && typeof value === "object" ? (value as Partial<CertificateDesignConfig>) : {};
  const defaults = buildDefaultDesignConfig(trainerNames, companyName);

  const rawSignatures = Array.isArray(source.signatures) ? source.signatures : defaults.signatures;

  const signatures: CertificateSignatureConfig[] = rawSignatures
    .slice(0, 4)
    .map((signature: any, index: number) => ({
      name: typeof signature?.name === "string" ? signature.name : defaults.signatures[index]?.name || "",
      title: typeof signature?.title === "string" ? signature.title : defaults.signatures[index]?.title || "",
      image_url: typeof signature?.image_url === "string" ? signature.image_url : "",
    }));

  while (signatures.length < 4) {
    signatures.push(defaults.signatures[signatures.length] as any);
  }

  return {
    primaryColor: typeof source.primaryColor === "string" ? source.primaryColor : defaults.primaryColor,
    secondaryColor: typeof source.secondaryColor === "string" ? source.secondaryColor : defaults.secondaryColor,
    fontFamily: source.fontFamily === "sans" || source.fontFamily === "gothic" ? source.fontFamily : defaults.fontFamily,
    showBadge: typeof source.showBadge === "boolean" ? source.showBadge : defaults.showBadge,
    showSeal: typeof source.showSeal === "boolean" ? source.showSeal : defaults.showSeal,
    titleText: typeof source.titleText === "string" ? source.titleText : defaults.titleText,
    descriptionText: typeof source.descriptionText === "string" ? source.descriptionText : defaults.descriptionText,
    osgb_logo_url: typeof source.osgb_logo_url === "string" ? source.osgb_logo_url : defaults.osgb_logo_url,
    signatureCount: Math.min(4, Math.max(1, Number(source.signatureCount || defaults.signatureCount))),
    signatures: signatures as any,
  };
}

function readStudioPreset(): CertificateFormValues | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("certificate-studio-preset");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CertificateFormValues>;
    return {
      ...defaultForm,
      ...parsed,
      trainer_names: Array.isArray(parsed.trainer_names) ? parsed.trainer_names : defaultForm.trainer_names,
      design_config: normalizeDesignConfig(
        parsed.design_config,
        Array.isArray(parsed.trainer_names) ? parsed.trainer_names : defaultForm.trainer_names,
        parsed.company_name || defaultForm.company_name,
      ),
    };
  } catch {
    return null;
  }
}

// ====================================================
// PAGE
// ====================================================

export default function CertificatesDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState<CertificateFormValues>(() => readStudioPreset() || defaultForm);
  const [participants, setParticipants] = useState<CertificateParticipantInput[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [recentCertificates, setRecentCertificates] = useState<CertificateRecord[]>([]);
  const [activeCertificate, setActiveCertificate] = useState<CertificateRecord | null>(null);
  const [activeJob, setActiveJob] = useState<CertificateJobRecord | null>(null);
  const [jobItems, setJobItems] = useState<CertificateJobItem[]>([]);
  const [selectedPdfParticipantId, setSelectedPdfParticipantId] = useState("");
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deletingCertificateId, setDeletingCertificateId] = useState<string | null>(null);
  const [employeeLoadState, setEmployeeLoadState] = useState<"idle" | "loaded" | "empty">("idle");
  const [employeeLoadMessage, setEmployeeLoadMessage] = useState("");
  const [trainerNamesInput, setTrainerNamesInput] = useState(defaultForm.trainer_names.join(", "));
  const [activeCertificateCenterTab, setActiveCertificateCenterTab] =
    useState<CertificateCenterTabId>("isg");
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);
  const [topicSections, setTopicSections] = useState<CertificateTopicSection[]>(defaultCertificateTopicSections);
  const [newCatalogTopic, setNewCatalogTopic] = useState("");
  const [manualParticipant, setManualParticipant] = useState({ name: "", tc_no: "", job_title: "" });
  const [certificateLegislationMode, setCertificateLegislationMode] = useState<"first" | "repeat">("first");
  const [certificateTrainingType, setCertificateTrainingType] = useState<"face" | "remote" | "mixed">("face");
  const [certificateLayoutMode, setCertificateLayoutMode] = useState<"single" | "frontBack">("single");
  const [hideCertificateTc, setHideCertificateTc] = useState(false);
  const [selectedCertificateSector, setSelectedCertificateSector] = useState("");
  const studioSectionRef = useRef<HTMLDivElement | null>(null);
  const companyContextAppliedRef = useRef<string | null>(null);
  const rawTab = searchParams.get("tab");
  const currentTab = rawTab === "templates" || rawTab === "history" ? rawTab : "production";
  const activeCompanyId = searchParams.get("companyId") || "";
  const activeCertificateCenterTabMeta =
    certificateCenterTabs.find((tab) => tab.id === activeCertificateCenterTab) || certificateCenterTabs[0];
  const ActiveCertificateTabIcon = activeCertificateCenterTabMeta.icon;

  const completedItems = useMemo(
    () => jobItems.filter((item) => item.status === "completed" && item.pdf_path),
    [jobItems],
  );
  const isJobRunning = Boolean(activeJob && ["queued", "processing", "processing_with_errors"].includes(activeJob.status));

  const editableSignatures = useMemo(
    () => normalizeDesignConfig(form.design_config, form.trainer_names, form.company_name).signatures.slice(0, 3),
    [form.design_config, form.trainer_names, form.company_name],
  );

  const syncStoredPreview = useCallback(
    async (logoValue: string | undefined, setter: (value: string) => void) => {
      const nextValue = (logoValue || "").trim();
      if (!nextValue) {
        setter("");
        return;
      }

      if (/^https?:\/\//i.test(nextValue)) {
        setter(nextValue);
        return;
      }

      const companyLogoResult = await supabase.storage.from("company-logos").createSignedUrl(nextValue, 3600);
      if (!companyLogoResult.error && companyLogoResult.data?.signedUrl) {
        setter(companyLogoResult.data.signedUrl);
        return;
      }

      try {
        const certificateLogoUrl = await createCertificateSignedUrl(nextValue);
        if (certificateLogoUrl) {
          setter(certificateLogoUrl);
          return;
        }
      } catch {
        // Company logo fallback above may legitimately fail for certificate bucket paths.
      }

      setter("");
    },
    [],
  );

  const syncLogoPreview = useCallback(async (logoValue?: string) => {
    await syncStoredPreview(logoValue, setLogoPreviewUrl);
  }, [syncStoredPreview]);

  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void syncLogoPreview(form.logo_url);
  }, [form.logo_url, syncLogoPreview]);

  useEffect(() => {
    if (!activeCertificate || !activeJob) return;
    if (!["queued", "processing", "processing_with_errors", "completed", "completed_with_errors"].includes(activeJob.status))
      return;

    const interval = window.setInterval(() => {
      void refreshJobStatus(activeCertificate.id);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [activeCertificate, activeJob]);

  useEffect(() => {
    if (!selectedPdfParticipantId && completedItems[0]?.participant_id) {
      setSelectedPdfParticipantId(completedItems[0].participant_id);
    }
  }, [completedItems, selectedPdfParticipantId]);

  useEffect(() => {
    if (currentTab === "templates") {
      studioSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [currentTab]);

  useEffect(() => {
    if (!activeCompanyId || companies.length === 0) return;
    if (companyContextAppliedRef.current === activeCompanyId) return;
    if (!companies.some((company) => company.id === activeCompanyId)) return;
    companyContextAppliedRef.current = activeCompanyId;
    void applyCompany(activeCompanyId);
  }, [activeCompanyId, companies]);

  async function bootstrap() {
    setLoading(true);
    try {
      await Promise.all([loadCompanies(), loadRecentCertificates()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCompanies() {
    const { data, error } = await (supabase as any)
      .from("companies")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const mapped = (data || []).map((item: any) => ({
      ...item,
      owner_id: item.user_id,
      company_name: item.name,
      nace_code: item.industry || "",
      hazard_class: item.hazard_class || "Az Tehlikeli",
    }));

    setCompanies(mapped);
  }

  const activeCompany = activeCompanyId
    ? companies.find((company) => company.id === activeCompanyId) || null
    : null;

  async function loadRecentCertificates() {
    const { data, error } = await (supabase as any)
      .from("certificates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) throw error;
    setRecentCertificates(data || []);
  }

  async function refreshJobStatus(certificateId: string) {
    try {
      const statusPayload = await getCertificateStatus(certificateId);
      setActiveJob(statusPayload.job);
      setJobItems(statusPayload.items || []);
    } catch (error: any) {
      console.error("Sertifika durumu alınamadı:", error);
    }
  }

  async function applyCompany(companyId: string) {
    const company = companies.find((item) => item.id === companyId);
    if (!company) return;
    const companyPeople = await loadCompanyCertificatePeople(company);
    const trainerNames = [
      companyPeople.safetyExpertName,
      companyPeople.workplaceDoctorName,
    ].map((item) => item.trim()).filter(Boolean);
    const signaturePeople = [
      {
        name: companyPeople.safetyExpertName,
        title: companyPeople.safetyExpertCertificateNo
          ? `İş Güvenliği Uzmanı\nBelge No: ${companyPeople.safetyExpertCertificateNo}`
          : "İş Güvenliği Uzmanı",
      },
      {
        name: companyPeople.workplaceDoctorName,
        title: companyPeople.workplaceDoctorCertificateNo
          ? `İşyeri Hekimi\nBelge No: ${companyPeople.workplaceDoctorCertificateNo}`
          : "İşyeri Hekimi",
      },
      {
        name: companyPeople.employerName,
        title: "İşveren / Yetkili\nKaşe - İmza",
      },
      {
        name: "OSGB Yetkilisi",
        title: "Düzenleyen Birim",
      },
    ];

    setForm((prev) => ({
      ...prev,
      company_id: company.id,
      company_name: company.company_name,
      company_address: [company.address, company.city].filter(Boolean).join(", "),
      company_phone: company.phone || "",
      logo_url: company.logo_url || "",
      trainer_names: trainerNames,
      design_config: {
        ...normalizeDesignConfig(prev.design_config, trainerNames, company.company_name),
        signatures: signaturePeople.map((signature, index) => ({
          ...signature,
          image_url: normalizeDesignConfig(prev.design_config, trainerNames, company.company_name).signatures[index]?.image_url || "",
        })),
      } as any,
    }));
    setTrainerNamesInput(trainerNames.join(", "));

    if (trainerNames.length === 0) {
      toast.info("Seçilen firmada İSG uzmanı/işyeri hekimi bilgisi yok. Eğitmenleri manuel girebilirsiniz.");
    }

    try {
      const { data: employees, error } = await (supabase as any)
        .from("employees")
        .select("id, first_name, last_name, tc_number, job_title")
        .eq("company_id", company.id)
        .eq("is_active", true)
        .order("first_name", { ascending: true });

      if (error) throw error;

      const mappedParticipants = (employees || [])
        .map((employee: any) => ({
          id: employee.id,
          name: `${employee.first_name || ""} ${employee.last_name || ""}`.trim(),
          tc_no: employee.tc_number || "",
          job_title: employee.job_title || "",
        }))
        .filter((participant: CertificateParticipantInput) => participant.name.length > 0);

      if (mappedParticipants.length > 0) {
        setParticipants(mappedParticipants);
        setEmployeeLoadState("loaded");
        setEmployeeLoadMessage(`${mappedParticipants.length} çalışan katılımcı listesine otomatik yüklendi.`);
        toast.success(`${mappedParticipants.length} çalışan otomatik yüklendi`);
      } else {
        setParticipants([]);
        setEmployeeLoadState("empty");
        setEmployeeLoadMessage(
          "Seçilen firmaya ait kayıtlı çalışan bulunamadı. Katılımcıları manuel ekleyebilir veya Excel ile yükleyebilirsiniz.",
        );
        toast.info("Bu firmaya ait kayıtlı çalışan bulunamadı");
      }
    } catch (error: any) {
      setEmployeeLoadState("empty");
      setEmployeeLoadMessage(
        "Çalışanlar otomatik yüklenemedi. Katılımcıları manuel ekleyebilir veya Excel ile yükleyebilirsiniz.",
      );
      toast.error(`Çalışanlar yüklenemedi: ${error.message}`);
    }
  }

  function addParticipant() {
    setParticipants((prev) => [...prev, { name: "", tc_no: "", job_title: "" }]);
  }

  function addManualParticipant() {
    const name = manualParticipant.name.trim();
    if (!name) {
      toast.error("Katılımcı adı soyadı girin.");
      return;
    }

    setParticipants((prev) => [
      ...prev,
      {
        name,
        tc_no: manualParticipant.tc_no.trim(),
        job_title: manualParticipant.job_title.trim(),
      },
    ]);
    setManualParticipant({ name: "", tc_no: "", job_title: "" });
  }

  function updateTopic(sectionIndex: number, topicIndex: number, value: string) {
    setTopicSections((prev) =>
      prev.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              topics: section.topics.map((topic, currentTopicIndex) =>
                currentTopicIndex === topicIndex ? value.slice(0, 120) : topic,
              ),
            }
          : section,
      ),
    );
  }

  function removeTopic(sectionIndex: number, topicIndex: number) {
    setTopicSections((prev) =>
      prev.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? { ...section, topics: section.topics.filter((_, currentTopicIndex) => currentTopicIndex !== topicIndex) }
          : section,
      ),
    );
  }

  function addTopic(sectionIndex: number) {
    setTopicSections((prev) =>
      prev.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex && section.topics.length < 18
          ? { ...section, topics: [...section.topics, ""] }
          : section,
      ),
    );
  }

  function resetTopicSectionsForCurrentCertificateTab() {
    setTopicSections(getDefaultTopicSectionsForCertificateTab(activeCertificateCenterTab));
  }

  function openCertificateTopicDialog() {
    const expectedSections = getDefaultTopicSectionsForCertificateTab(activeCertificateCenterTab);
    const expectedTitle = expectedSections[0]?.title;
    const isSimpleTopicTab = activeCertificateCenterTab === "height" || activeCertificateCenterTab === "confined";
    const hasHeightTopics = topicSections[0]?.title === heightCertificateTopicSections[0].title;
    const hasConfinedTopics = topicSections[0]?.title === confinedCertificateTopicSections[0].title;
    const hasSimpleCertificateTopics = hasHeightTopics || hasConfinedTopics;

    if (isSimpleTopicTab && topicSections[0]?.title !== expectedTitle) {
      setTopicSections(expectedSections);
    }
    if (!isSimpleTopicTab && hasSimpleCertificateTopics) {
      setTopicSections(defaultCertificateTopicSections);
    }
    setTopicDialogOpen(true);
  }

  function addCatalogTopic() {
    const value = newCatalogTopic.trim();
    if (!value) return;

    setTopicSections((prev) =>
      prev.map((section, index) => (index === prev.length - 1 ? { ...section, topics: [...section.topics, value] } : section)),
    );
    setNewCatalogTopic("");
  }

  function saveTopicDialog() {
    setForm((prev) => ({ ...prev, notes: serializeCertificateTopicSections(topicSections) }));
    setTopicDialogOpen(false);
    toast.success("Eğitim konuları güncellendi.");
  }

  function updateParticipant(index: number, patch: Partial<CertificateParticipantInput>) {
    setParticipants((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  function removeParticipant(index: number) {
    setParticipants((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  async function uploadCertificateAsset(file: File) {
    const fileName = `logos/${crypto.randomUUID()}-${normalizeFileNameForStorage(file.name)}`;
    await uploadFileOptimized("certificate-files", fileName, file);
    return fileName;
  }

  async function handleExcelUpload(file: File) {
    try {
      const parsed = await parseCertificateParticipantsExcel(file);
      setParticipants(parsed);
      toast.success(`${parsed.length} katılımcı yüklendi`);
    } catch (error: any) {
      toast.error(`Excel okunamadı: ${error.message}`);
    }
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    const localPreviewUrl = URL.createObjectURL(file);
    setLogoPreviewUrl(localPreviewUrl);
    try {
      const fileName = await uploadCertificateAsset(file);
      setForm((prev) => ({ ...prev, logo_url: fileName }));
      await syncLogoPreview(fileName);
      toast.success("Logo yüklendi");
    } catch (error: any) {
      setLogoPreviewUrl("");
      toast.error(`Logo yüklenemedi: ${error.message}`);
    } finally {
      URL.revokeObjectURL(localPreviewUrl);
      setUploadingLogo(false);
    }
  }

  function updateCertificateSignature(index: number, patch: Partial<CertificateSignatureConfig>) {
    setForm((prev) => {
      const normalized = normalizeDesignConfig(prev.design_config, prev.trainer_names, prev.company_name);
      const signatures = normalized.signatures.map((signature: any, signatureIndex: number) =>
        signatureIndex === index ? { ...signature, ...patch } : signature,
      );

      return {
        ...prev,
        design_config: {
          ...normalized,
          signatures,
        } as any,
      };
    });
  }

  async function handleCreate() {
    if (!form.company_name.trim() || !form.training_name.trim()) {
      toast.error("Firma ve eğitim bilgileri zorunludur");
      return null;
    }
    if (participants.length === 0) {
      toast.error("En az bir katılımcı ekleyin");
      return null;
    }

    setSubmitting(true);
    try {
      const outputReadyForm = await prepareCertificateAssetsForOutput(form);
      if (outputReadyForm.logo_url !== form.logo_url || outputReadyForm.design_config !== form.design_config) {
        setForm(outputReadyForm);
      }

      const response = await createCertificate(outputReadyForm, participants);
      setActiveCertificate(response.certificate);
      setActiveJob(response.job);
      await loadRecentCertificates();
      toast.success("Sertifika işi oluşturuldu");
      return response;
    } catch (error: any) {
      toast.error(`Kayıt oluşturulamadı: ${error.message}`);
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerate(certificateOverride?: CertificateRecord | null) {
    try {
      let certificate = certificateOverride || activeCertificate;
      if (!certificate) {
        const created = await handleCreate();
        certificate = created?.certificate ?? null;
        if (certificate) {
          setActiveCertificate(certificate);
          setActiveJob(created?.job ?? null);
        }
      }
      if (!certificate) return;

      setSubmitting(true);
      const response = await generateCertificateJob(certificate.id);
      setActiveCertificate(response.certificate);
      setActiveJob(response.job);
      await refreshJobStatus(certificate.id);
      toast.success("Sertifika üretimi başlatıldı");
    } catch (error: any) {
      toast.error(`Üretim başlatılamadı: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadZip() {
    if (!activeCertificate) {
      toast.error("Önce sertifika işi oluşturun.");
      return;
    }
    try {
      const payload = await getCertificateDownload(activeCertificate.id);
      if (!payload.downloadUrl) {
        toast.error("ZIP henüz hazır değil");
        return;
      }
      window.open(payload.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast.error(`ZIP indirilemedi: ${error.message}`);
    }
  }

  async function handleDownloadSinglePdf() {
    const item =
      completedItems.find((entry) => entry.participant_id === selectedPdfParticipantId) || completedItems[0];

    if (!item?.id) {
      toast.error("Dosya yolu bulunamadı", {
        description: "Bu katılımcı için indirilebilir PDF kaydı bulunmuyor.",
      });
      return;
    }

    try {
      const payload = await getCertificateItemDownload(item.id);
      window.open(payload.downloadUrl, "_blank", "noopener,noreferrer");
      if (payload.regenerated && activeCertificate?.id) {
        toast.success("PDF yeniden oluşturuldu", {
          description: "Eksik tekil PDF dosyası yeniden üretildi ve indirme bağlantısı hazırlandı.",
        });
        await refreshJobStatus(activeCertificate.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF bağlantısı oluşturulamadı.";
      toast.error("PDF dosyası açılamadı", {
        description:
          message ||
          "PDF dosyası depolama alanında bulunamadı. Dosya silinmiş, taşınmış veya yükleme tamamlanmamış olabilir.",
      });
    }
  }

  async function loadCertificate(certificate: CertificateRecord) {
    setActiveCertificate(certificate);
    setForm({
      company_id: certificate.company_id,
      company_name: certificate.company_name || "",
      company_address: certificate.company_address || "",
      company_phone: certificate.company_phone || "",
      training_name: certificate.training_name,
      training_date: certificate.training_date,
      training_duration: certificate.training_duration,
      certificate_type: certificate.certificate_type,
      validity_date: certificate.validity_date || "",
      logo_url: certificate.logo_url || "",
      template_type: (certificate.template_type as any) || "classic",
      frame_style: (certificate.frame_style as any) || "gold",
      trainer_names: certificate.trainer_names || [""],
      notes: certificate.notes || "",
      design_config: normalizeDesignConfig(
        (certificate as any).design_config,
        certificate.trainer_names || [""],
        certificate.company_name || "",
      ),
    });

    const { data: participantRows } = await (supabase as any)
      .from("certificate_participants")
      .select("*")
      .eq("certificate_id", certificate.id)
      .order("created_at", { ascending: true });

    setParticipants(participantRows || []);
    setTrainerNamesInput((certificate.trainer_names || [""]).join(", "));
    await refreshJobStatus(certificate.id);
  }

  async function handleDeleteCertificate(certificate: CertificateRecord) {
    const targetName = certificate.training_name?.trim() || "Bu sertifika kaydı";
    const shouldDelete = window.confirm(`"${targetName}" kaydı silinsin mi? Bu işlem geri alınamaz.`);
    if (!shouldDelete) return;

    setDeletingCertificateId(certificate.id);
    try {
      const { error } = await (supabase as any).from("certificates").delete().eq("id", certificate.id);
      if (error) throw error;

      setRecentCertificates((prev) => prev.filter((item) => item.id !== certificate.id));

      if (activeCertificate?.id === certificate.id) {
        setActiveCertificate(null);
        setActiveJob(null);
        setJobItems([]);
        setSelectedPdfParticipantId("");
      }

      toast.success("Sertifika kaydı silindi");
    } catch (error: any) {
      toast.error(`Sertifika kaydı silinemedi: ${error.message}`);
    } finally {
      setDeletingCertificateId(null);
    }
  }

  // ====================================================
  // LOADING UI (theme-safe skeleton)
  // ====================================================
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="h-8 w-72 animate-pulse rounded bg-muted" />
            <div className="h-4 w-96 animate-pulse rounded bg-muted/80" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.25fr]">
          <div className="space-y-6">
            <div className="h-[420px] animate-pulse rounded-xl border border-border bg-muted/40" />
            <div className="h-[320px] animate-pulse rounded-xl border border-border bg-muted/40" />
          </div>
          <div className="space-y-6">
            <div className="h-[420px] animate-pulse rounded-xl border border-border bg-muted/40" />
            <div className="h-[260px] animate-pulse rounded-xl border border-border bg-muted/40" />
          </div>
        </div>
      </div>
    );
  }

  // ====================================================
  // RENDER
  // ====================================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-900/80 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-5 border-b border-slate-700/70 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white md:text-3xl">Sertifika Merkezi</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-300">
                Eğitim sertifikalarını türlerine göre ayırın, katılımcıları ekleyin ve çıktıları tek merkezden yönetin.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge className="border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-emerald-100 hover:bg-emerald-500/10">
              Toplu üretim aktif
            </Badge>
            <Badge className="border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-violet-100 hover:bg-violet-500/10">
              6 premium tema
            </Badge>
            <Button asChild variant="outline" className="gap-2 border-slate-600 bg-slate-800/80 text-slate-100 hover:bg-slate-700">
              <Link to="/dashboard/certificates/history">
                <History className="h-4 w-4" /> Geçmiş İşler
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-2 bg-slate-950/35 p-3 sm:grid-cols-2 xl:grid-cols-4">
          {certificateCenterTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeCertificateCenterTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCertificateCenterTab(tab.id)}
                className={cn(
                  "group relative overflow-hidden rounded-xl border px-3 py-3 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                  active
                    ? "border-white/20 bg-slate-800 text-white shadow-lg shadow-black/20"
                    : "border-slate-700/70 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:bg-slate-800/80 hover:text-white",
                )}
                aria-pressed={active}
              >
                {active ? (
                  <span className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", tab.accent)} />
                ) : null}
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5",
                      active ? tab.iconClassName : "text-slate-400 group-hover:text-slate-200",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{tab.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-400">{tab.subtitle}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {activeCompany ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Firma baglami aktif</p>
              <p className="text-sm text-muted-foreground">
                {activeCompany.company_name} icin katilimci ve sertifika bilgileri otomatik uygulanir.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete("companyId");
                setSearchParams(next);
                companyContextAppliedRef.current = null;
              }}
            >
              Baglami kaldir
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={currentTab === "production" ? "default" : "outline"}
          className="gap-2"
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            next.delete("tab");
            setSearchParams(next);
          }}
        >
          <Award className="h-4 w-4" />
          Sertifika Üret
        </Button>
        <Button
          type="button"
          variant={currentTab === "templates" ? "default" : "outline"}
          className="gap-2"
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            next.set("tab", "templates");
            setSearchParams(next);
          }}
        >
          <Palette className="h-4 w-4" />
          Tasarım Şablonları
        </Button>
        <Button
          type="button"
          variant={currentTab === "history" ? "default" : "outline"}
          className="gap-2"
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            next.set("tab", "history");
            setSearchParams(next);
          }}
        >
          <History className="h-4 w-4" />
          Geçmiş İşler ve Tekrar Basım
        </Button>
      </div>

      {currentTab === "production" ? (
      <>
      <Card className="overflow-hidden border-slate-700/70 bg-[#1d2a3d] text-slate-100 shadow-lg shadow-black/10">
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 border-b border-slate-700/80 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-white">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black leading-tight text-white">
                  {activeCertificateCenterTabMeta.title} Oluştur
                </h2>
                <p className="text-xs text-slate-400">{activeCertificateCenterTabMeta.subtitle}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="icon" className="h-8 w-8 bg-emerald-600 text-white hover:bg-emerald-500" title="Yardım">
                <HelpCircle className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                className="h-8 gap-2 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60"
                disabled={submitting || isJobRunning}
                onClick={() => void handleGenerate()}
              >
                <RefreshCw className={cn("h-4 w-4", isJobRunning && "animate-spin")} />
                Sertifikaları Oluştur
              </Button>
              <Button
                type="button"
                className="h-8 gap-2 bg-emerald-700 text-white hover:bg-emerald-600"
                onClick={() => void handleDownloadSinglePdf()}
              >
                <Download className="h-4 w-4" />
                Sertifikayı İndir
              </Button>
              <Button
                type="button"
                className="h-8 gap-2 bg-purple-700 text-white hover:bg-purple-600"
                onClick={() => void handleDownloadZip()}
              >
                <FileArchive className="h-4 w-4" />
                ZIP İndir
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 px-4 py-3 text-[11px] font-semibold text-slate-300 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-blue-300">MEVZUAT</span>
              <label className="flex items-center gap-1.5">
                Tür:
                <input type="radio" checked={certificateLegislationMode === "first"} onChange={() => setCertificateLegislationMode("first")} />
                İlk Defa
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={certificateLegislationMode === "repeat"} onChange={() => setCertificateLegislationMode("repeat")} />
                Tekrar
              </label>
              <label className="flex items-center gap-1.5">
                Şekil:
                <input type="radio" checked={certificateTrainingType === "face"} onChange={() => setCertificateTrainingType("face")} />
                Yüz Yüze
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={certificateTrainingType === "remote"} onChange={() => setCertificateTrainingType("remote")} />
                Uzaktan
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={certificateTrainingType === "mixed"} onChange={() => setCertificateTrainingType("mixed")} />
                Karma
              </label>
              <label className="flex items-center gap-1.5">
                Format:
                <input type="radio" checked={certificateLayoutMode === "single"} onChange={() => setCertificateLayoutMode("single")} />
                Tek Sayfa
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={certificateLayoutMode === "frontBack"} onChange={() => setCertificateLayoutMode("frontBack")} />
                Arkalı Önlü
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                Tarih:
                <Input
                  type="date"
                  value={form.training_date}
                  onChange={(event) => setForm((prev) => ({ ...prev, training_date: event.target.value }))}
                  className="h-7 w-36 border-slate-600 bg-[#111b2d] text-xs text-slate-100"
                />
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={hideCertificateTc} onCheckedChange={setHideCertificateTc} className="scale-75" />
                T.C. No Gizle
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Form */}
          <Card className="overflow-hidden border-slate-700/70 bg-[#1f2d40] text-slate-100 shadow-sm">
            <CardHeader className="border-b border-slate-700/70 pb-4">
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <Building2 className="h-5 w-5 text-emerald-400" />
                Firma ve Eğitim Bilgileri
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5 p-5">
              <div className="grid gap-5">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wide text-slate-300">Firma Seçin *</Label>
                  <Select
                    value={form.company_id || "manual"}
                    onValueChange={(value) => {
                      if (value !== "manual") {
                        void applyCompany(value);
                      } else {
                        setForm((prev) => ({ ...prev, company_id: null }));
                        setEmployeeLoadState("idle");
                        setEmployeeLoadMessage("");
                      }
                    }}
                  >
                    <SelectTrigger className="h-10 border-slate-600 bg-[#172236] text-slate-100">
                      <SelectValue placeholder="Firma Seçiniz" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-700 bg-[#172236] text-slate-100">
                      <SelectItem value="manual">Firma Seçiniz</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-[220px_1fr_220px]">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-300">Eğitim Gün Sayısı *</Label>
                    <Select value="1" onValueChange={() => undefined}>
                      <SelectTrigger className="h-12 border-slate-600 bg-[#172236] text-slate-100">
                        <SelectValue placeholder="1 Gün" />
                      </SelectTrigger>
                      <SelectContent className="border-slate-700 bg-[#172236] text-slate-100">
                        <SelectItem value="1">1 Gün</SelectItem>
                        <SelectItem value="2">2 Gün</SelectItem>
                        <SelectItem value="3">3 Gün</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-300">Sektör Seçimi</Label>
                    <Select value={selectedCertificateSector} onValueChange={setSelectedCertificateSector}>
                      <SelectTrigger className="h-12 border-slate-600 bg-[#172236] text-slate-100">
                        <SelectValue placeholder="Sektör Seçin..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-80 border-slate-700 bg-[#172236] text-slate-100">
                        {certificateSectorOptions.map((sector) => (
                          <SelectItem key={sector} value={sector}>
                            {sector}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button type="button" onClick={openCertificateTopicDialog} className="h-12 w-full gap-2 bg-blue-600 text-white hover:bg-blue-500">
                      <BookOpen className="h-4 w-4" />
                      Eğitim Konuları
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-bold uppercase tracking-wide text-slate-300">Eğitim Tarihleri *</Label>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-black text-emerald-400">1.</span>
                    <div className="relative w-full max-w-xs">
                      <Input
                        type="date"
                        value={form.training_date}
                        onChange={(event) => setForm((prev) => ({ ...prev, training_date: event.target.value }))}
                        className="h-12 border-slate-600 bg-[#172236] pr-10 text-slate-100"
                      />
                      <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                    <span className="text-slate-400">Otomatik Geçerlilik Tarihi Ayarla:</span>
                    <button type="button" className="rounded-md bg-emerald-600 px-2 py-1 text-white">Az Tehlikeli (+3 yıl)</button>
                    <button type="button" className="rounded-md bg-amber-600 px-2 py-1 text-white">Tehlikeli (+2 yıl)</button>
                    <button type="button" className="rounded-md bg-rose-600 px-2 py-1 text-white">Çok Tehlikeli (+1 yıl)</button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-300">Geçerlilik Tarihi *</Label>
                    <Input
                      type="date"
                      value={form.validity_date}
                      onChange={(event) => setForm((prev) => ({ ...prev, validity_date: event.target.value }))}
                      className="h-12 border-slate-600 bg-[#172236] text-slate-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-300">Eğitim Süresi *</Label>
                    <Select
                      value={form.training_duration}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, training_duration: value }))}
                    >
                      <SelectTrigger className="h-12 border-slate-600 bg-[#172236] text-slate-100">
                        <Clock3 className="mr-2 h-4 w-4 text-slate-400" />
                        <SelectValue placeholder="8 saat" />
                      </SelectTrigger>
                      <SelectContent className="border-slate-700 bg-[#172236] text-slate-100">
                        <SelectItem value="2 saat">2 saat</SelectItem>
                        <SelectItem value="4 saat">4 saat</SelectItem>
                        <SelectItem value="8 saat">8 saat</SelectItem>
                        <SelectItem value="12 saat">12 saat</SelectItem>
                        <SelectItem value="16 saat">16 saat</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3 border-t border-slate-700/70 pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-400" />
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-300">Eğiticileri Seç</Label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span>İş Güvenliği Uzmanı Eğiticisi</span>
                        <span className="flex items-center gap-2 text-emerald-300">Açık <Switch defaultChecked className="scale-75" /></span>
                      </div>
                      <Input
                        value={editableSignatures[0]?.name || ""}
                        onChange={(event) => {
                          updateCertificateSignature(0, { name: event.target.value });
                          setTrainerNamesInput([event.target.value, editableSignatures[1]?.name || ""].filter(Boolean).join(", "));
                          setForm((prev) => ({ ...prev, trainer_names: [event.target.value, editableSignatures[1]?.name || ""].filter(Boolean) }));
                        }}
                        placeholder="Adı Soyadı"
                        className="h-11 border-slate-600 bg-[#172236] text-slate-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span>İşyeri Hekimi Eğiticisi</span>
                        <span className="flex items-center gap-2 text-emerald-300">Açık <Switch defaultChecked className="scale-75" /></span>
                      </div>
                      <Input
                        value={editableSignatures[1]?.name || ""}
                        onChange={(event) => {
                          updateCertificateSignature(1, { name: event.target.value });
                          setTrainerNamesInput([editableSignatures[0]?.name || "", event.target.value].filter(Boolean).join(", "));
                          setForm((prev) => ({ ...prev, trainer_names: [editableSignatures[0]?.name || "", event.target.value].filter(Boolean) }));
                        }}
                        placeholder="Adı Soyadı"
                        className="h-11 border-slate-600 bg-[#172236] text-slate-100"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">Firma seçildiğinde bu alanlar otomatik doldurulur.</p>
                </div>

                <div className="flex flex-wrap items-center gap-5 border-t border-slate-700/70 pt-4 text-xs font-semibold text-slate-300">
                  <label className="flex items-center gap-2"><Switch /> İşveren Bilgilerini Ekle</label>
                  <label className="flex items-center gap-2"><Switch /> Hizmet Veren Firma Ekle</label>
                </div>

                <div className="space-y-3 border-t border-slate-700/70 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="text-xs font-bold text-slate-200">Sertifikaya kaşe/imza ekle</Label>
                    <label>
                      <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && void handleLogoUpload(event.target.files[0])} />
                      <Button type="button" size="sm" variant="outline" asChild className="h-7 gap-2 border-blue-500/50 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20">
                        <span><ImagePlus className="h-3.5 w-3.5" /> Kaşe/İmza Ekle</span>
                      </Button>
                    </label>
                  </div>
                  <p className="text-xs text-slate-400">Kaşeniz yoksa butona tıklayıp yükleyin; her sayfadan eklenebilir.</p>
                  <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-xs font-semibold text-amber-200">
                    Ücretsiz pakette kaşenizin üzerine çapraz “İSGPratik” filigranı eklenir.
                    <Button type="button" size="sm" className="ml-2 h-7 bg-indigo-600 text-white hover:bg-indigo-500">
                      Filigransız İçin Uzman/OSGB'ye Yükselt
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 border-t border-slate-700/70 pt-4">
                  <Label className="text-xs font-bold uppercase tracking-wide text-violet-300">Sertifika Logosu</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {["Logo Yok", "Sol", "Sağ", "Her İki Taraf"].map((label, index) => (
                      <Button
                        key={label}
                        type="button"
                        className={cn(
                          "h-9 text-xs font-bold",
                          index === 0 ? "bg-fuchsia-600 text-white hover:bg-fuchsia-500" : "bg-[#111b2d] text-slate-200 hover:bg-slate-700",
                        )}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Dialog open={topicDialogOpen} onOpenChange={setTopicDialogOpen}>
            <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden border-slate-700 bg-[#111b2d] p-0 text-slate-100">
              <DialogHeader className="border-b border-slate-700 bg-[#1d2a3d] px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-blue-400" />
                    <div>
                      <DialogTitle className="text-white">Eğitim Konuları Düzenle</DialogTitle>
                      <DialogDescription className="text-xs text-slate-400">
                        {activeCertificateCenterTab === "height" || activeCertificateCenterTab === "confined"
                          ? "Madde listesini düzenleyebilir, yeni maddeler ekleyebilir veya silebilirsiniz."
                          : "Kategorileri ve konuları düzenleyebilir, istediğiniz sıraya alabilirsiniz."}
                      </DialogDescription>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="max-h-[68vh] space-y-4 overflow-y-auto p-4">
                {activeCertificateCenterTab === "height" || activeCertificateCenterTab === "confined" ? (
                  <div className="rounded-xl border border-slate-700 bg-[#111b2d] p-4">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="text-sm font-black text-white">{topicSections[0]?.title || "Eğitim Konuları"}</h3>
                        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-300">
                          Madde listesini düzenleyebilir, yeni madde ekleyebilir veya silebilirsiniz. En fazla 18 madde
                          ve her maddede en fazla 120 karakter kullanabilirsiniz.
                        </p>
                      </div>
                      <Button
                        type="button"
                        className="h-10 shrink-0 gap-2 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                        disabled={(topicSections[0]?.topics.length || 0) >= 18}
                        onClick={() => addTopic(0)}
                      >
                        <Plus className="h-4 w-4" />
                        Madde Ekle <span className="text-xs opacity-80">(Maks. 18)</span>
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {(topicSections[0]?.topics || []).map((topic, topicIndex) => (
                        <div key={`height-topic-${topicIndex}`} className="grid grid-cols-[24px_1fr_30px] items-center gap-3">
                          <span className="text-xs font-black text-blue-300">{topicIndex + 1}.</span>
                          <Input
                            value={topic}
                            maxLength={120}
                            onChange={(event) => updateTopic(0, topicIndex, event.target.value)}
                            className="h-10 border-slate-600 bg-[#1f2d40] text-sm font-semibold text-slate-100"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                            onClick={() => removeTopic(0, topicIndex)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                <>
                {topicSections.map((section, sectionIndex) => (
                  <div key={`${section.title}-${sectionIndex}`} className="rounded-lg border border-slate-700 bg-[#152238] p-4">
                    <div className="grid grid-cols-[26px_1fr_auto_auto] items-center gap-2">
                      <span className="text-sm font-black text-blue-300">{sectionIndex + 1}.</span>
                      <Input
                        value={section.title}
                        onChange={(event) =>
                          setTopicSections((prev) =>
                            prev.map((item, index) => (index === sectionIndex ? { ...item, title: event.target.value } : item)),
                          )
                        }
                        className="h-8 border-slate-600 bg-[#1f2d40] text-sm font-bold text-slate-100"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                        onClick={() => setTopicSections((prev) => prev.filter((_, index) => index !== sectionIndex))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Badge className="bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15">
                        {section.isOptional ? "Seçilir" : "Normal"}
                      </Badge>
                    </div>

                    <div className="mt-3 space-y-2">
                      {section.topics.map((topic, topicIndex) => (
                        <div key={`${section.title}-${topicIndex}`} className="grid grid-cols-[22px_1fr_42px_92px_28px] items-center gap-2">
                          <span className="text-slate-500">↕</span>
                          <Input
                            value={topic}
                            onChange={(event) => updateTopic(sectionIndex, topicIndex, event.target.value)}
                            className="h-8 border-slate-600 bg-[#1f2d40] text-xs font-semibold text-slate-100"
                          />
                          <Button type="button" size="sm" variant="outline" className="h-8 border-slate-600 bg-[#172236] text-xs text-slate-300">
                            dk
                          </Button>
                          <Select defaultValue="original">
                            <SelectTrigger className="h-8 border-slate-600 bg-[#172236] text-xs text-slate-100">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-slate-700 bg-[#172236] text-slate-100">
                              <SelectItem value="original">Özgün</SelectItem>
                              <SelectItem value="common">Ortak</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                            onClick={() => removeTopic(sectionIndex, topicIndex)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-8 text-xs text-blue-300 hover:bg-blue-500/10 hover:text-blue-200"
                      onClick={() => addTopic(sectionIndex)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Madde Ekle
                    </Button>
                  </div>
                ))}

                <div className="flex gap-2">
                  <Input
                    value={newCatalogTopic}
                    onChange={(event) => setNewCatalogTopic(event.target.value)}
                    placeholder="Yeni katalog adı..."
                    className="h-10 border-slate-600 bg-[#1f2d40] text-slate-100"
                  />
                  <Button type="button" className="h-10 shrink-0 bg-blue-600 text-white hover:bg-blue-500" onClick={addCatalogTopic}>
                    <Plus className="mr-2 h-4 w-4" />
                    Katalog Ekle
                  </Button>
                </div>
                </>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-700 bg-[#1d2a3d] px-5 py-4">
                <div className="flex gap-4 text-xs font-semibold text-slate-400">
                  <button type="button" className="hover:text-slate-100" onClick={resetTopicSectionsForCurrentCertificateTab}>
                    Varsayılana Sıfırla
                  </button>
                  <button type="button" className="hover:text-slate-100">Şablonları Sil</button>
                  <button type="button" className="hover:text-slate-100">Şablon Kaydet</button>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="border-slate-600 bg-[#172236] text-slate-100 hover:bg-slate-700" onClick={() => setTopicDialogOpen(false)}>
                    İptal
                  </Button>
                  <Button type="button" className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={saveTopicDialog}>
                    Kaydet
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Participants */}
          <Card className="overflow-hidden border-slate-700/70 bg-[#1f2d40] text-slate-100">
            <CardHeader className="border-b border-slate-700/70 pb-4">
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <Users className="h-5 w-5 text-emerald-400" /> Katılımcı Listesi ({participants.length})
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 p-5">
              {employeeLoadState !== "idle" && (
                <div
                  className={cn(
                    "rounded-xl border px-4 py-3 text-sm",
                    employeeLoadState === "loaded"
                      ? "border-emerald-500/25 bg-emerald-500/10 text-foreground"
                      : "border-amber-500/25 bg-amber-500/10 text-foreground",
                  )}
                >
                  <p className="font-medium">{employeeLoadMessage}</p>
                </div>
              )}

              <div className="rounded-xl border border-blue-500/70 bg-blue-950/25 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Users className="h-4 w-4 text-blue-300" />
                  Firma Çalışanları
                </div>
                <div className="mt-8 text-center text-xs text-slate-400">
                  {form.company_id ? "Firma çalışanları katılımcı listesine aktarıldı." : "Çalışanları görmek için bir firma seçin."}
                </div>
              </div>

              <div className="rounded-xl border border-slate-700 bg-[#172236] p-3">
                <div className="grid gap-2">
                  <Input
                    value={manualParticipant.name}
                    onChange={(event) => setManualParticipant((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Katılımcının Adı Soyadı"
                    className="h-10 border-slate-600 bg-[#1f2d40] text-slate-100"
                  />
                  <Input
                    value={manualParticipant.tc_no}
                    onChange={(event) => setManualParticipant((prev) => ({ ...prev, tc_no: event.target.value }))}
                    placeholder="Katılımcının T.C. No (opsiyonel)"
                    className="h-10 border-slate-600 bg-[#1f2d40] text-slate-100"
                  />
                  <Input
                    value={manualParticipant.job_title}
                    onChange={(event) => setManualParticipant((prev) => ({ ...prev, job_title: event.target.value }))}
                    placeholder="Katılımcının Görev Unvanı"
                    className="h-10 border-slate-600 bg-[#1f2d40] text-slate-100"
                  />
                  <Button type="button" className="h-10 gap-2 bg-emerald-600 text-white hover:bg-emerald-500" onClick={addManualParticipant}>
                    <Plus className="h-4 w-4" />
                    Listeye Ekle
                  </Button>
                </div>

                <div className="my-3 flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="h-px flex-1 bg-slate-700" />
                  veya Excel ile toplu yükle
                  <span className="h-px flex-1 bg-slate-700" />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" className="h-9 gap-2 bg-blue-600 text-white hover:bg-blue-500" onClick={() => createCertificateExcelTemplate()}>
                    <FileSpreadsheet className="h-4 w-4" /> Şablon İndir
                  </Button>
                  <label>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(event) => event.target.files?.[0] && void handleExcelUpload(event.target.files[0])}
                    />
                    <Button type="button" className="h-9 w-full gap-2 bg-emerald-700 text-white hover:bg-emerald-600" asChild>
                      <span>
                        <Upload className="h-4 w-4" /> Excel Yükle
                      </span>
                    </Button>
                  </label>
                </div>
              </div>

              <div className="min-h-[280px] rounded-xl bg-[#1f2d40]">
                {participants.length === 0 ? (
                  <div className="flex min-h-[260px] flex-col items-center justify-center text-center text-slate-500">
                    <Users className="mb-3 h-12 w-12 opacity-60" />
                    <p className="text-xs font-black uppercase tracking-wider">Henüz katılımcı yok</p>
                  </div>
                ) : (
                  <div className="max-h-[320px] space-y-2 overflow-auto pr-1">
                    {participants.map((participant, index) => (
                      <div key={(participant as any).id || `participant-${index}`} className="grid gap-2 rounded-xl border border-slate-700 bg-[#172236] p-3 md:grid-cols-[1fr_150px_1fr_42px]">
                        <Input
                          value={participant.name}
                          onChange={(event) => updateParticipant(index, { name: event.target.value })}
                          className="h-9 border-slate-600 bg-[#1f2d40] text-slate-100"
                        />
                        <Input
                          value={participant.tc_no || ""}
                          onChange={(event) => updateParticipant(index, { tc_no: event.target.value })}
                          className="h-9 border-slate-600 bg-[#1f2d40] text-slate-100"
                        />
                        <Input
                          value={participant.job_title || ""}
                          onChange={(event) => updateParticipant(index, { job_title: event.target.value })}
                          className="h-9 border-slate-600 bg-[#1f2d40] text-slate-100"
                        />
                        <Button type="button" size="icon" className="h-9 w-9 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25" onClick={() => removeParticipant(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </>
      ) : currentTab === "history" ? (
        <Card className="overflow-hidden border-slate-700/70 bg-[#1f2d40] text-slate-100 shadow-lg shadow-black/10">
          <CardHeader className="border-b border-slate-700/70">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl text-white">
                  <History className="h-5 w-5 text-purple-300" />
                  Geçmiş İşler ve Tekrar Basım
                </CardTitle>
                <CardDescription className="mt-1 text-slate-400">
                  Önceki sertifika kayıtlarını seçip yeniden üretim başlatabilirsiniz.
                </CardDescription>
              </div>
              <div className="rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-purple-100">
                {recentCertificates.length} kayıt
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 p-5">
            {recentCertificates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-600/80 bg-[#172236] p-8 text-center">
                <History className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                <p className="font-semibold text-white">Henüz sertifika işi bulunmuyor.</p>
                <p className="mt-1 text-sm text-slate-400">
                  Sertifika üretimi yaptığınızda geçmiş işler burada listelenecek.
                </p>
              </div>
            ) : (
              recentCertificates.map((certificate) => (
                <div
                  key={certificate.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-700 bg-[#172236] p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <p className="font-semibold text-white">{certificate.training_name}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {certificate.company_name || "Firma yok"} • {certificate.training_date}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-500/40 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20"
                      onClick={() => void loadCertificate(certificate)}
                    >
                      Yükle
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-800"
                      asChild
                    >
                      <Link to={`/dashboard/certificates/${certificate.id}`}>Detay</Link>
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-500"
                      onClick={() => void handleGenerate(certificate)}
                    >
                      Tekrar Bas
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
                      disabled={deletingCertificateId === certificate.id}
                      onClick={() => void handleDeleteCertificate(certificate)}
                    >
                      {deletingCertificateId === certificate.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Sil
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-slate-700/70 bg-slate-900/80 shadow-xl shadow-black/10">
          <CardContent className="p-0">
            <div className={cn("h-1.5 bg-gradient-to-r", activeCertificateCenterTabMeta.accent)} />
            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_340px] lg:p-8">
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                    <ActiveCertificateTabIcon
                      className={cn("h-7 w-7", activeCertificateCenterTabMeta.iconClassName)}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Sertifika sekmesi</p>
                    <h2 className="mt-1 text-2xl font-bold text-white">{activeCertificateCenterTabMeta.title}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                      {activeCertificateCenterTabMeta.description}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-dashed border-slate-600/80 bg-slate-950/40 p-5">
                  <p className="font-semibold text-slate-100">Bu sekme hazır.</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Bu alanı daha sonra özel form, katılımcı listesi, süre, geçerlilik ve PDF/ZIP çıktı kontrolleriyle
                    genişletebiliriz. Şimdilik kullanıcı sertifika türleri arasında net şekilde geçiş yapabilir.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-5">
                <p className="text-sm font-semibold text-white">Planlanan yapı</p>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center gap-3 rounded-xl bg-slate-900 px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Firma ve eğitim bilgileri
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-slate-900 px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                    Katılımcı seçimi
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-slate-900 px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-violet-400" />
                    Sertifika tasarımı
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-slate-900 px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-orange-400" />
                    PDF ve ZIP çıktısı
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
