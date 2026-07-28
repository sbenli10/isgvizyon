import { supabase } from "@/integrations/supabase/client";
import type { Company, Employee } from "@/types/companies";

export type PpeCategory = {
  id: string;
  title: string;
  icon: string;
  items: PpeItem[];
};

export type PpeItem = {
  id: string;
  name: string;
  standard: string;
};

export type PpeZimmetEmployee = {
  id: string;
  fullName: string;
  tcNumber: string;
  department: string;
  jobTitle: string;
  isManual?: boolean;
};

export type PpeZimmetRecord = {
  formNo: string;
  companyId: string;
  companyName: string;
  deliveryDate: string;
  periodicControlDate: string;
  employees: PpeZimmetEmployee[];
  selectedItemIds: string[];
  selectedItems: Array<PpeItem & { categoryTitle: string }>;
  deliveredBy: string;
};

const db = supabase as any;

export const ppeCategories: PpeCategory[] = [
  {
    id: "head-face",
    title: "1. Baş ve Yüz Koruyucular",
    icon: "🧢",
    items: [
      { id: "industrial-safety-helmet", name: "Endüstriyel Emniyet Bareti", standard: "TS EN 397" },
      { id: "bump-cap", name: "Endüstriyel Darbe Başlığı (Kep Tipi)", standard: "TS EN 812" },
      { id: "height-safety-helmet", name: "Çene Kayışlı Yüksekte Çalışma Bareti", standard: "TS EN 397 / TS EN 12492" },
      { id: "electrical-insulating-helmet", name: "Elektriksel Yalıtımlı Baret", standard: "TS EN 50365" },
      { id: "safety-goggles", name: "Göz Koruyucu (Koruyucu Gözlük)", standard: "TS EN 166" },
      { id: "chemical-splash-goggles", name: "Kimyasal Sıçrama Gözlüğü", standard: "TS EN 166" },
      { id: "face-shield", name: "Yüz Siperi", standard: "TS EN 166" },
      { id: "welding-mask-face-shield", name: "Kaynak Maskesi / Yüz Siperi", standard: "TS EN 175" },
      { id: "welding-glasses-filter", name: "Kaynak Gözlüğü / Filtreli Kaynak Camı", standard: "TS EN 169 / TS EN 379" },
      { id: "molten-metal-face-shield", name: "Isı ve Erimiş Metal Sıçramasına Karşı Yüz Siperi", standard: "TS EN 168" },
      { id: "laser-safety-glasses", name: "Lazer Koruyucu Gözlük", standard: "TS EN 207" },
      { id: "lead-radiation-glasses", name: "Radyasyon Koruyucu Kurşun Gözlük", standard: "TS EN 61331" },
      { id: "rescue-hood-visor", name: "Kurtarma Başlığı / Vizörü", standard: "TS EN 168 / TS EN 14594" },
    ],
  },
  {
    id: "hearing",
    title: "2. İşitme Koruyucuları",
    icon: "🎧",
    items: [
      { id: "ear-plug", name: "Kulak Tıkacı", standard: "TS EN 352-2" },
      { id: "ear-muff", name: "Kulaklık (Manşonlu)", standard: "TS EN 352-1" },
      { id: "helmet-earmuff", name: "Barete Takılabilir Kulaklık", standard: "TS EN 352-3" },
      { id: "level-dependent-earmuff", name: "Seviye Bağımlı Elektronik Kulaklık", standard: "TS EN 352-4" },
      { id: "communication-earmuff", name: "İletişimli Gürültü Önleyici Kulaklık", standard: "TS EN 352-6" },
    ],
  },
  {
    id: "respiratory",
    title: "3. Solunum Koruyucuları",
    icon: "😷",
    items: [
      { id: "dust-mask-ffp", name: "Toz Maskesi (FFP1/FFP2/FFP3)", standard: "TS EN 149" },
      { id: "ffp3-respirator", name: "FFP3 Partikül Respiratörü", standard: "TS EN 149" },
      { id: "particle-filter", name: "Partikül Filtresi (P1/P2/P3)", standard: "TS EN 143" },
      { id: "gas-combined-filter", name: "Gaz Filtresi / Kombine Filtre", standard: "TS EN 14387" },
      { id: "full-face-mask", name: "Tam Yüz Maskesi", standard: "TS EN 136" },
      { id: "welding-fume-respirator", name: "Kaynak Duman Respiratörü", standard: "TS EN 149 / TS EN 143" },
      { id: "papr", name: "Motorlu Hava Temizleyici Solunum Cihazı (PAPR)", standard: "TS EN 12941 / TS EN 12942" },
      { id: "scba", name: "Temiz Hava Tüplü Solunum Cihazı (SCBA)", standard: "TS EN 137" },
      { id: "air-line-respirator", name: "Hava Beslemeli Solunum Cihazı", standard: "TS EN 14594" },
      { id: "rescue-air-hood", name: "Kurtarma İçin Hava Beslemeli Solunum Başlığı", standard: "TS EN 14594" },
      { id: "surgical-mask", name: "Tıbbi / Cerrahi Maske", standard: "TS EN 14683" },
    ],
  },
  {
    id: "hand-arm",
    title: "4. El ve Kol Koruyucuları",
    icon: "🧤",
    items: [
      { id: "mechanical-risk-glove", name: "Mekanik Risklere Karşı Eldiven", standard: "TS EN 388" },
      { id: "cut-resistant-glove", name: "Kesilmeye Dirençli Eldiven", standard: "TS EN 388" },
      { id: "chemical-glove", name: "Kimyasal Maddelere Karşı Eldiven", standard: "TS EN ISO 374" },
      { id: "acid-alkali-glove", name: "Asit ve Alkaliye Dayanıklı Eldiven", standard: "TS EN ISO 374" },
      { id: "nitrile-glove", name: "Tek Kullanımlık Nitril Eldiven", standard: "TS EN ISO 374" },
      { id: "food-contact-glove", name: "Gıda Temasına Uygun Eldiven", standard: "TS EN 1186 / TS EN 388" },
      { id: "thermal-risk-glove", name: "Isıl Risklere Karşı Eldiven", standard: "TS EN 407" },
      { id: "cold-glove", name: "Soğuğa Karşı Eldiven", standard: "TS EN 511" },
      { id: "cryogenic-glove", name: "Kriyojenik Sıvılara Karşı Eldiven", standard: "TS EN 511 / TS EN 388" },
      { id: "welder-glove", name: "Kaynakçı Eldiveni", standard: "TS EN 12477" },
      { id: "electrical-insulating-glove", name: "Elektriksel Yalıtımlı Eldiven", standard: "TS EN 60903" },
      { id: "antistatic-esd-glove", name: "Antistatik / ESD Eldiven", standard: "TS EN 16350" },
      { id: "anti-vibration-glove", name: "Titreşim Azaltıcı Eldiven", standard: "TS EN ISO 10819" },
      { id: "chainmail-glove", name: "Zincir Örgü Kesilme Eldiveni", standard: "TS EN 1082" },
      { id: "radiation-protective-glove", name: "Radyasyon Koruyucu Eldiven", standard: "TS EN 421" },
      { id: "cut-resistant-sleeve", name: "Kesilmeye Dirençli Kolluk", standard: "TS EN 388" },
      { id: "welder-leather-sleeve", name: "Kaynak ve Isıl Risklere Karşı Deri Kolluk", standard: "TS EN ISO 11611" },
    ],
  },
  {
    id: "foot-leg",
    title: "5. Ayak ve Bacak Koruyucuları",
    icon: "🥾",
    items: [
      { id: "safety-shoe-toecap", name: "Emniyet Ayakkabısı (Çelik/Kompozit Burunlu)", standard: "TS EN ISO 20345" },
      { id: "work-shoe", name: "İş Ayakkabısı (Burun Korumasız)", standard: "TS EN ISO 20347" },
      { id: "electrical-insulating-shoe", name: "Elektriksel Yalıtımlı Ayakkabı", standard: "TS EN 50321" },
      { id: "heat-resistant-boot", name: "Yanmaz Tabanlı Bot", standard: "TS EN ISO 20349" },
      { id: "chemical-boot", name: "Kimyasala Dayanıklı Çizme", standard: "TS EN ISO 20345 / TS EN 13832" },
      { id: "slip-resistant-shoe", name: "Kaymaz Tabanlı İş Ayakkabısı", standard: "TS EN ISO 20347" },
      { id: "cold-store-boot", name: "Soğuk Depo Botu", standard: "TS EN ISO 20345 / TS EN 511" },
      { id: "antistatic-esd-shoe", name: "Antistatik / ESD Ayakkabı", standard: "TS EN ISO 20345 / TS EN 61340-4-3" },
      { id: "metatarsal-shoe", name: "Metatars Koruyuculu Emniyet Ayakkabısı", standard: "TS EN ISO 20345" },
      { id: "chainsaw-boot", name: "Zincir Testere Koruyucu Botu", standard: "TS EN ISO 17249" },
      { id: "waterproof-boot", name: "Su Geçirmez İş Çizmesi", standard: "TS EN ISO 20345" },
      { id: "knee-pad", name: "Dizlik / Diz Koruyucu", standard: "TS EN 14404" },
      { id: "welder-spats", name: "Kaynakçı Tozluğu / Bacak Koruyucu", standard: "TS EN ISO 11611" },
    ],
  },
  {
    id: "body-height",
    title: "6. Gövde ve Yüksekte Çalışma Ekipmanları",
    icon: "🦺",
    items: [
      { id: "full-body-harness", name: "Tam Vücut Kişisel Sistem (Paraşüt Tipi)", standard: "TS EN 361" },
      { id: "lanyard", name: "Lanyard (Bağlantı Halatı)", standard: "TS EN 354" },
      { id: "energy-absorber", name: "Enerji Absorbe Edici (Şok Emici)", standard: "TS EN 355" },
      { id: "retractable-fall-arrester", name: "Geri Sarımlı Düşmeyi Durdurucu", standard: "TS EN 360" },
      { id: "lifeline", name: "Yatay / Dikey Yaşam Hattı", standard: "TS EN 795 / TS EN 353" },
      { id: "anchor-point", name: "Ankraj Noktası / Ankraj Sapanı", standard: "TS EN 795" },
      { id: "positioning-belt", name: "Konumlandırma Kemeri ve Halatı", standard: "TS EN 358" },
      { id: "confined-space-tripod", name: "Kapalı Alan Kurtarma Tripodu", standard: "TS EN 795" },
      { id: "rescue-winch", name: "Kurtarma Vinci / Kaldırma Cihazı", standard: "TS EN 1496" },
      { id: "hi-vis-vest", name: "Yüksek Görünürlüklü İkaz Yeleği", standard: "TS EN ISO 20471" },
      { id: "hi-vis-parka", name: "Yüksek Görünürlüklü Pantolon / Parka", standard: "TS EN ISO 20471" },
      { id: "heat-resistant-clothing", name: "Isıya Dayanıklı Elbise", standard: "TS EN ISO 11612" },
      { id: "flame-retardant-clothing", name: "Alev Geciktirici Koruyucu Elbise", standard: "TS EN ISO 11612 / TS EN ISO 14116" },
      { id: "welder-leather-apron", name: "Kaynakçı Deri Önlüğü / Ceketi", standard: "TS EN ISO 11611" },
      { id: "arc-flash-clothing", name: "Elektrik Arkına Karşı Koruyucu Elbise", standard: "IEC 61482 / TS EN ISO 11612" },
      { id: "chemical-suit", name: "Kimyasal Koruyucu Tulum", standard: "TS EN 14605 / TS EN 13034" },
      { id: "type-5-6-coverall", name: "Tek Kullanımlık Tip 5/6 Koruyucu Tulum", standard: "TS EN ISO 13982-1 / TS EN 13034" },
      { id: "biological-risk-coverall", name: "Biyolojik Risklere Karşı Koruyucu Tulum", standard: "TS EN 14126" },
      { id: "liquid-proof-apron", name: "Sıvı Geçirmez Önlük", standard: "TS EN 14605 / TS EN 13034" },
      { id: "laboratory-coat", name: "Laboratuvar Önlüğü", standard: "TS EN 13034 / TS EN 14126" },
      { id: "antistatic-clothing", name: "Antistatik Koruyucu Elbise", standard: "TS EN 1149-5" },
      { id: "esd-cleanroom-apron", name: "ESD Önlük / Temiz Oda Önlüğü", standard: "TS EN 61340-5-1" },
      { id: "cold-store-coat", name: "Soğuk Depo Montu / Tulumu", standard: "TS EN 342" },
      { id: "rain-clothing", name: "Yağmur ve Dış Ortam Koruyucu Elbisesi", standard: "TS EN 343" },
      { id: "life-jacket", name: "Can Yeleği / Yüzdürme Yardımcısı", standard: "TS EN ISO 12402" },
      { id: "lead-apron", name: "Radyasyon Koruyucu Kurşun Önlük", standard: "TS EN 61331" },
      { id: "chainsaw-trousers", name: "Zincir Testere Koruyucu Pantolonu", standard: "TS EN ISO 11393" },
      { id: "firefighter-clothing", name: "Yangın Müdahale Koruyucu Elbisesi", standard: "TS EN 469" },
    ],
  },
];

export const allPpeItems = ppeCategories.flatMap((category) =>
  category.items.map((item) => ({ ...item, categoryTitle: category.title })),
);

export function companyName(company: Company) {
  return company.company_name || (company as unknown as { name?: string }).name || "Firma";
}

export function companyRegistryNo(company?: Company | null) {
  return company?.sgk_workplace_number || company?.workplace_registration_number || "";
}

export function createPpeFormNo(date = new Date()) {
  const year = date.getFullYear();
  const stamp = `${date.getMonth() + 1}${date.getDate()}${date.getHours()}${date.getMinutes()}${date.getSeconds()}`.padStart(8, "0");
  return `KKD-${year}-${stamp.slice(-4)}`;
}

export function formatTrDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("tr-TR");
}

export async function loadPpeCompanies(): Promise<Company[]> {
  const { data, error } = await db.from("companies").select("*").eq("is_active", true).order("name", { ascending: true });
  if (error) throw error;
  return ((data || []) as Company[]).sort((left, right) => companyName(left).localeCompare(companyName(right), "tr-TR"));
}

export async function loadPpeEmployees(companyId: string): Promise<PpeZimmetEmployee[]> {
  if (!companyId) return [];
  const { data, error } = await db
    .from("employees")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("first_name", { ascending: true });

  if (error) throw error;

  return ((data || []) as Employee[]).map((employee) => ({
    id: employee.id,
    fullName: employee.full_name || `${employee.first_name || ""} ${employee.last_name || ""}`.trim(),
    tcNumber: employee.tc_number || "",
    department: employee.department || "",
    jobTitle: employee.job_title || "",
  }));
}

export async function savePpeZimmetRecord(record: PpeZimmetRecord, userId: string, organizationId?: string | null) {
  const { error } = await db.from("ppe_zimmet_records").insert({
    user_id: userId,
    organization_id: organizationId || null,
    company_id: record.companyId || null,
    company_name: record.companyName,
    form_no: record.formNo,
    delivery_date: record.deliveryDate || null,
    periodic_control_date: record.periodicControlDate || null,
    employees: record.employees,
    ppe_items: record.selectedItems,
    delivered_by: record.deliveredBy,
  });
  if (error) throw error;
}

async function loadPdfTools() {
  const [{ default: jsPDF }, { default: autoTable }, { addInterFontsToJsPDF }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("@/utils/fonts"),
  ]);
  return { jsPDF, autoTable, addInterFontsToJsPDF };
}

function savePdfBlob(doc: any, filename: string) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function generatePpeZimmetPdf(record: PpeZimmetRecord, company?: Company | null) {
  const { jsPDF, autoTable, addInterFontsToJsPDF } = await loadPdfTools();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  addInterFontsToJsPDF(doc);
  doc.setFont("Inter", "normal");

  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;

  doc.setFillColor(109, 40, 217);
  doc.rect(0, 0, pageWidth, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("Inter", "bold");
  doc.setFontSize(15);
  doc.text("KKD ZİMMET FORMU", margin, 12);
  doc.setFontSize(8);
  doc.text("Kişisel Koruyucu Donanım Teslim Belgesi", margin, 18);
  doc.text(`Form No: ${record.formNo}`, pageWidth - margin, 12, { align: "right" });

  doc.setTextColor(17, 24, 39);
  doc.setFontSize(10);
  doc.setFont("Inter", "bold");
  doc.text("1. FİRMA BİLGİLERİ", margin, 34);
  autoTable(doc, {
    startY: 38,
    theme: "grid",
    styles: { font: "Inter", fontSize: 8, cellPadding: 2, lineColor: [148, 163, 184], lineWidth: 0.2 },
    headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold" },
    body: [
      ["Firma", record.companyName || "-"],
      ["SGK Sicil No", companyRegistryNo(company) || "-"],
      ["Tehlike Sınıfı", company?.hazard_class || "-"],
      ["Adres", company?.address || "-"],
      ["Teslim Tarihi", formatTrDate(record.deliveryDate)],
      ["Periyodik Kontrol Tarihi", formatTrDate(record.periodicControlDate)],
      ["Teslim Eden", record.deliveredBy || "-"],
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 }, 1: { cellWidth: contentWidth - 45 } },
    margin: { left: margin, right: margin },
  });

  let y = (doc as any).lastAutoTable?.finalY + 8 || 78;
  doc.setFont("Inter", "bold");
  doc.setFontSize(10);
  doc.text("2. TESLİM EDİLEN KKD LİSTESİ", margin, y);
  autoTable(doc, {
    startY: y + 4,
    theme: "grid",
    head: [["#", "KKD", "Kategori", "Standart"]],
    body: record.selectedItems.map((item, index) => [String(index + 1), item.name, item.categoryTitle.replace(/^\d+\.\s*/, ""), item.standard]),
    styles: { font: "Inter", fontSize: 7.5, cellPadding: 1.8, lineColor: [148, 163, 184], lineWidth: 0.2 },
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: "bold" },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable?.finalY + 8 || y + 40;
  doc.setFont("Inter", "bold");
  doc.text("3. TESLİM ALAN ÇALIŞANLAR", margin, y);
  autoTable(doc, {
    startY: y + 4,
    theme: "grid",
    head: [["#", "Ad Soyad", "T.C. Kimlik No", "Departman / Görev", "İmza"]],
    body: record.employees.map((employee, index) => [
      String(index + 1),
      employee.fullName,
      employee.tcNumber || "-",
      [employee.department, employee.jobTitle].filter(Boolean).join(" / ") || "-",
      "",
    ]),
    styles: { font: "Inter", fontSize: 8, cellPadding: 2, minCellHeight: 12, lineColor: [148, 163, 184], lineWidth: 0.2 },
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 45 }, 2: { cellWidth: 32 }, 3: { cellWidth: 58 }, 4: { cellWidth: 37 } },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable?.finalY + 10 || 220;
  if (y > 245) {
    doc.addPage();
    y = 24;
  }
  doc.setFont("Inter", "normal");
  doc.setFontSize(8);
  const declaration =
    "Yukarıda belirtilen kişisel koruyucu donanımları eksiksiz teslim aldığımı, tarafıma kullanım ve bakım bilgisi verildiğini, ekipmanları talimatlara uygun kullanacağımı beyan ederim.";
  doc.text(doc.splitTextToSize(declaration, contentWidth), margin, y);
  y += 18;

  const blockWidth = 54;
  const gap = (contentWidth - blockWidth * 3) / 2;
  [
    ["TESLİM EDEN", record.deliveredBy || "Ad Soyad"],
    ["TESLİM ALAN", "Çalışan İmzası"],
    ["İŞVEREN / VEKİLİ", company?.employer_representative_name || "Ad Soyad"],
  ].forEach(([title, name], index) => {
    const x = margin + index * (blockWidth + gap);
    doc.rect(x, y, blockWidth, 25);
    doc.setFont("Inter", "bold");
    doc.text(title, x + blockWidth / 2, y + 6, { align: "center" });
    doc.setFont("Inter", "normal");
    doc.text(name, x + blockWidth / 2, y + 14, { align: "center" });
    doc.text("İmza", x + blockWidth / 2, y + 22, { align: "center" });
  });

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("6331 sayılı İş Sağlığı ve Güvenliği Kanunu kapsamında KKD teslim kaydıdır.", margin, 286);

  savePdfBlob(doc, `${record.formNo}_${record.companyName || "KKD_Zimmet"}.pdf`);
}
