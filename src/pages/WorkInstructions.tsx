import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import jsPDF from "jspdf";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TableVerticalAlign,
  WidthType,
  VerticalAlign,
} from "docx";
import { saveAs } from "file-saver";
import {
  AlertTriangle,
  BadgeCheck,
  Beaker,
  Bot,
  Briefcase,
  Building2,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Copy,
  Download,
  Eye,
  FileText,
  Filter,
  FlaskConical,
  Hammer,
  HardHat,
  Laptop,
  Loader2,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  Wrench,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { invokeEdgeFunction } from "@/lib/ai/invokeEdgeFunction";
import { cn } from "@/lib/utils";
import { addInterFontsToJsPDF } from "@/utils/fonts";

type InstructionCategory =
  | "İş Makineleri"
  | "El Aletleri"
  | "Kimyasal Madde"
  | "Elektrik İşleri"
  | "Yüksekte Çalışma"
  | "Kapalı Alan"
  | "Kaynak ve Kesme"
  | "Taşıma & Depolama"
  | "Mutfak & Yemekhane"
  | "Ofis & Ergonomi"
  | "Ofis & Büro"
  | "İnşaat & Saha"
  | "Genel İSG";

type WorkInstructionTemplate = {
  id: string;
  title: string;
  category: InstructionCategory;
  description: string;
  tags: string[];
  requiredPpe: string[];
  risks: string[];
  steps: string[];
  emergencyNotes: string[];
  legalNotes?: string[];
  updatedAt?: string;
  instructionSections?: {
    title: string;
    items: string[];
    tone?: "green" | "blue" | "yellow" | "red" | "purple";
  }[];
};

type DetailsInstruction = WorkInstructionTemplate & {
  source?: "template" | "saved";
};

type InstructionFormState = {
  title: string;
  category: InstructionCategory | "";
  description: string;
  tags: string;
  requiredPpe: string;
  risks: string;
  steps: string;
  emergencyNotes: string;
};

type AiFormState = {
  workName: string;
  category: InstructionCategory | "";
  environment: string;
  riskLevel: string;
  requiredPpe: string;
  notes: string;
};

type AiInstructionGenerateResponse = {
  success: true;
  model?: string;
  instruction: Omit<WorkInstructionTemplate, "id" | "updatedAt"> & {
    updatedAt?: string;
  };
};

type CategoryMeta = {
  icon: React.ComponentType<{ className?: string }>;
  badge: string;
  accent: string;
  chip: string;
};

const STORAGE_KEY = "isgvizyon-work-instructions";

const categories: InstructionCategory[] = [
  "İş Makineleri",
  "El Aletleri",
  "Kimyasal Madde",
  "Elektrik İşleri",
  "Yüksekte Çalışma",
  "Kapalı Alan",
  "Kaynak ve Kesme",
  "Taşıma & Depolama",
  "Mutfak & Yemekhane",
  "Ofis & Ergonomi",
  "Ofis & Büro",
  "İnşaat & Saha",
  "Genel İSG",
];

const categoryMeta: Record<InstructionCategory, CategoryMeta> = {
  "İş Makineleri": {
    icon: Truck,
    badge: "border-orange-400/25 bg-orange-500/12 text-orange-200",
    accent: "from-orange-500/20 to-amber-500/5",
    chip: "hover:border-orange-400/50 hover:text-orange-100",
  },
  "El Aletleri": {
    icon: Hammer,
    badge: "border-yellow-400/25 bg-yellow-500/12 text-yellow-200",
    accent: "from-yellow-500/20 to-amber-500/5",
    chip: "hover:border-yellow-400/50 hover:text-yellow-100",
  },
  "Kimyasal Madde": {
    icon: FlaskConical,
    badge: "border-rose-400/25 bg-rose-500/12 text-rose-200",
    accent: "from-rose-500/20 to-pink-500/5",
    chip: "hover:border-rose-400/50 hover:text-rose-100",
  },
  "Elektrik İşleri": {
    icon: Zap,
    badge: "border-amber-400/25 bg-amber-500/12 text-amber-200",
    accent: "from-amber-500/20 to-yellow-500/5",
    chip: "hover:border-amber-400/50 hover:text-amber-100",
  },
  "Yüksekte Çalışma": {
    icon: HardHat,
    badge: "border-red-400/25 bg-red-500/12 text-red-200",
    accent: "from-red-500/20 to-orange-500/5",
    chip: "hover:border-red-400/50 hover:text-red-100",
  },
  "Kapalı Alan": {
    icon: Building2,
    badge: "border-cyan-400/25 bg-cyan-500/12 text-cyan-200",
    accent: "from-cyan-500/20 to-slate-500/5",
    chip: "hover:border-cyan-400/50 hover:text-cyan-100",
  },
  "Kaynak ve Kesme": {
    icon: Wrench,
    badge: "border-violet-400/25 bg-violet-500/12 text-violet-200",
    accent: "from-violet-500/20 to-fuchsia-500/5",
    chip: "hover:border-violet-400/50 hover:text-violet-100",
  },
  "Taşıma & Depolama": {
    icon: Briefcase,
    badge: "border-emerald-400/25 bg-emerald-500/12 text-emerald-200",
    accent: "from-emerald-500/20 to-teal-500/5",
    chip: "hover:border-emerald-400/50 hover:text-emerald-100",
  },
  "Mutfak & Yemekhane": {
    icon: ChefHat,
    badge: "border-green-400/25 bg-green-500/12 text-green-200",
    accent: "from-green-500/20 to-lime-500/5",
    chip: "hover:border-green-400/50 hover:text-green-100",
  },
  "Ofis & Ergonomi": {
    icon: Laptop,
    badge: "border-blue-400/25 bg-blue-500/12 text-blue-200",
    accent: "from-blue-500/20 to-sky-500/5",
    chip: "hover:border-blue-400/50 hover:text-blue-100",
  },
  "Ofis & Büro": {
    icon: Laptop,
    badge: "border-sky-400/25 bg-sky-500/12 text-sky-200",
    accent: "from-sky-500/20 to-cyan-500/5",
    chip: "hover:border-sky-400/50 hover:text-sky-100",
  },
  "İnşaat & Saha": {
    icon: HardHat,
    badge: "border-orange-400/25 bg-orange-500/12 text-orange-200",
    accent: "from-orange-500/20 to-red-500/5",
    chip: "hover:border-orange-400/50 hover:text-orange-100",
  },
  "Genel İSG": {
    icon: ShieldCheck,
    badge: "border-teal-400/25 bg-teal-500/12 text-teal-200",
    accent: "from-teal-500/20 to-emerald-500/5",
    chip: "hover:border-teal-400/50 hover:text-teal-100",
  },
};

const defaultLegalNotes = [
  "6331 sayılı İş Sağlığı ve Güvenliği Kanunu kapsamında güvenli çalışma esaslarına uyulur.",
  "İş ekipmanları, KKD ve saha talimatları işveren/işveren vekili gözetiminde uygulanır.",
  "Talimat yılda en az bir kez veya proses/ekipman değişikliğinde gözden geçirilir.",
];

const forkliftInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  {
    title: "1. HAZIRLIK",
    tone: "green",
    items: [
      "Operatör ehliyeti ve yıllık periyodik muayenesi geçerli olmalıdır.",
      "Vardiya öncesi yağ, lastik, fren, korna, far ve hidrolik sistem kontrolü yapılmalıdır.",
      "Çatallar yere paralel ve tabandan 10-15 cm yukarıda olacak şekilde park konumunda tutulmalıdır.",
      "Yük kapasite etiketi ve denge diyagramı görünür olmalıdır.",
      "Vardiya öncesi kontrol formu (pre-shift checklist) imzalanmalı ve arşivlenmelidir.",
      "LPG/dizel forkliftlerde yakıt seviyesi ve kaçak kontrolü; akülü modellerde elektrolit ve şarj seviyesi denetlenmelidir.",
      "Emniyet kemeri, geri ikaz sesi ve sarı dönerli flaşör çalışır durumda olmalıdır.",
      "Çalışma alanı zemini, eğim, su ve yağ birikintisi açısından kontrol edilmelidir.",
      "TS ISO 3691-1 ve 6331 sayılı kanun kapsamında G sınıfı operatör belgesi yanınızda bulunmalıdır.",
    ],
  },
  {
    title: "2. OPERASYON KURALLARI",
    tone: "blue",
    items: [
      "Yük taşırken çatalları yerden 15 cm yukarıda tutarak hareket edin.",
      "Rampalarda yük yukarıda ileri, yük aşağıda geri çıkarak ilerleyin.",
      "Saatte 10 km hızı aşmayın, dönüşlerde hızı düşürün.",
      "Geri manevra için ayna veya gözcü kullanın, kornaya basın.",
      "Yaya ile minimum 3 metre güvenli mesafe bırakın ve kavşaklarda mutlaka durun.",
      "Yük kaldırırken direği geriye yaslayın (mast tilt back), denge merkezini koruyun.",
      "Park ederken çatalları yere indirin, el frenini çekin, kontağı kapatıp anahtarı çıkarın.",
      "Şarj ünitesinde akü değişimini havalandırılmış alanda, asit dökülmesine karşı tedbir alarak yapın.",
      "Vardiya değişiminde araç durumunu form üzerinden bir sonraki operatöre teslim edin.",
    ],
  },
  {
    title: "3. YASAKLAR",
    tone: "red",
    items: [
      "Yük kapasitesinin üstünde yük taşımak kesinlikle yasaktır.",
      "Çatallarda insan taşımak veya yük üzerinde personel taşımak yasaktır.",
      "Çatallar havadayken park etmek yasaktır.",
      "Sigara içerek veya telefonla konuşarak forklift kullanmak yasaktır.",
      "Görüş açısını kapatan yükle ileri yönde ilerlemek yasaktır; geri gidiş tercih edilir.",
      "Operatör koltuğunda emniyet kemeri takılı değilken aracı çalıştırmak yasaktır.",
      "Forklifti rampada yüksüz veya çatalları havada bırakarak terk etmek yasaktır.",
      "Yetkisiz personelin (G sınıfı belgesi olmayan) forklifti kullanması yasaktır.",
      "Tek çatalla yük taşımak veya yükü tek tarafa kaydırarak istiflemek yasaktır.",
    ],
  },
  {
    title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)",
    tone: "yellow",
    items: [
      "Baret (TS EN 397)",
      "Çelik burunlu iş ayakkabısı (TS EN ISO 20345 S3)",
      "Reflektörlü yelek (TS EN ISO 20471 sınıf 2)",
      "Mekanik dirençli iş eldiveni (TS EN 388)",
      "Koruyucu gözlük (TS EN 166)",
      "Kulak tıkacı (depo içi 85 dB üstü ortamda, TS EN 352)",
    ],
  },
  {
    title: "5. ACİL DURUM",
    tone: "purple",
    items: [
      "Devrilme tehlikesinde araçtan atlamayın, direksiyonu sıkıca tutun ve devrilme yönünün tersine yaslanın.",
      "Yangın durumunda kontağı kapatın, yakındaki ABC tipi yangın söndürücüyle müdahale edin.",
      "Kaza/yaralanma anında 112'yi arayın ve İSG uzmanını bilgilendirin.",
      "Yük düşmesinde alanı 5 metre çevreden kordona alın, yetkisiz girişi engelleyin.",
      "Akü asidi sıçramasında etkilenen bölgeyi 15 dakika bol su ile yıkayın, sağlık birimine başvurun.",
      "LPG kaçağında kıvılcım üretmeden ortamı havalandırın, vanayı kapatın, alanı tahliye edin.",
      "Çarpışma sonrası araç hasarlı ise kullanım dışı etiketi (out-of-service) asılarak servise alınmalıdır.",
    ],
  },
];

const tornaInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  {
    title: "1. HAZIRLIK",
    tone: "green",
    items: [
      "Tezgah kontrol panelindeki acil stop butonu çalışır durumda olmalıdır.",
      "İş parçası aynaya tam merkezlenip iyice sıkılmış olmalıdır.",
      "Kesici takım koruma siperliği takılı olmalıdır.",
      "Çalışma alanı talaş, yağ ve atık parçalardan arındırılmış olmalıdır.",
      "Soğutma sıvısı seviyesi ve filtresi kontrol edilmeli, mikrobiyal kontaminasyon (pH 8-9) takip edilmelidir.",
      "Kayar koruma kapağı (chuck guard) ve interlock anahtarının fonksiyon testi yapılmalıdır.",
      "Punta merkezi yağlanmalı ve hareket boşluğu (backlash) gözlemlenmelidir.",
      "Tezgah topraklaması ve elektrik panosu yıllık periyodik muayenesi geçerli olmalıdır.",
      "İş parçasının çıkıntı boyu üç çapı geçmemeli, gerekiyorsa lunet kullanılmalıdır.",
    ],
  },
  {
    title: "2. OPERASYON",
    tone: "blue",
    items: [
      "Devir ve ilerleme değerlerini iş parçası malzemesine göre ayarlayın.",
      "Aynayı sıkma anahtarını işlem öncesi mutlaka çıkarın.",
      "Talaş çıkarırken talaş kancası kullanın, asla elle dokunmayın.",
      "Tezgah çalışırken iş parçası ölçüm yapmayın, durdurup ölçün.",
      "Soğutma sıvısı debisini malzeme ve takıma uygun ayarlayıp sürekli akış sağlayın.",
      "Uzun parçalarda lunet veya gezer punta kullanarak titreşim ve kırbaçlamayı (whip) önleyin.",
      "Takım değişiminde tezgahı durdurup enerjisini kestikten sonra LOTO uygulayın.",
      "Çalışma sonunda talaşları talaş çekme aparatıyla toplayın, eldivensiz dokunmayın.",
      "Vardiya sonunda tezgahı ana şalterden kapatın ve günlük bakım formunu doldurun.",
    ],
  },
  {
    title: "3. YASAKLAR",
    tone: "red",
    items: [
      "Eldiven takarak torna tezgahında çalışmak yasaktır (kapma riski).",
      "Geniş, sarkık veya yırtık iş kıyafetiyle çalışmak yasaktır.",
      "Açık uzun saç, kolye, bileklik gibi takı ile çalışmak yasaktır.",
      "Koruyucu siperlik açıkken tezgahı çalıştırmak yasaktır.",
      "Tezgah dönerken aynaya el ile fren uygulamak yasaktır.",
      "Hava tabancası ile vücuda yönelik talaş üflemek yasaktır (göze gelme riski).",
      "Tezgah çalışırken kapağa yaslanmak veya işlemi izlemek için yaklaşmak yasaktır.",
      "Bakım/temizlik işlemini enerji kesilmeden yapmak yasaktır.",
    ],
  },
  {
    title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)",
    tone: "yellow",
    items: [
      "Koruyucu gözlük (TS EN 166 F)",
      "Çelik burunlu iş ayakkabısı (TS EN ISO 20345 S1P)",
      "Vücuda oturan iş tulumu (alev geciktirici tercih edilir)",
      "Saç bonesi/kep",
      "Kulak tıkacı (TS EN 352, 85 dB üstü)",
      "Talaş temizliğinde kesilmeye dirençli eldiven (TS EN 388 Cut 5)",
    ],
  },
  {
    title: "5. ACİL DURUM",
    tone: "purple",
    items: [
      "Acil durumda kırmızı acil stop butonuna derhal basın.",
      "Göze talaş kaçması durumunda göz duşu istasyonuna gidin, 15 dakika yıkayın.",
      "Yaralanma anında ilk yardımcıyı çağırın ve 112'yi arayın.",
      "Aynaya kapılma vakalarında ana şalteri kesin, kişiyi hareket ettirmeden ekibi çağırın.",
      "Soğutma sıvısı sıçramasında etkilenen cildi sabunlu suyla yıkayın, SDS'e bakın.",
      "Yangın çıkması halinde D tipi (metal yangını) söndürücü kullanın, su asla sıkmayın.",
      "Kesik/kanama durumunda turnike yerine baskılı pansuman uygulayıp sağlık birimine yönlendirin.",
    ],
  },
];

const hidrolikPresInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  {
    title: "1. HAZIRLIK",
    tone: "green",
    items: [
      "İki el kumanda sistemi ve ışık perdesi (light curtain) test edilmelidir.",
      "Kalıp güvenli şekilde tabla üzerine bağlanmış olmalıdır.",
      "Hidrolik yağ seviyesi ve basınç göstergesi kontrol edilmelidir.",
      "Acil stop butonları çalışır durumda olmalıdır.",
      "Kalıp ağırlığı pres kapasitesi ile uyumlu olmalı, kalıp koruma sistemi (die protection) aktif olmalıdır.",
      "Vardiya öncesi günlük kontrol formu doldurulmalı ve operatör imzalamalıdır.",
      "TS EN ISO 16092 ve makine direktifi (2006/42/EC) uyarınca CE belgesi ve risk değerlendirmesi mevcut olmalıdır.",
      "Çalışma alanı çevresinde 1 metre güvenlik bandı çekili ve bariyerler yerinde olmalıdır.",
      "Operatör pres kullanımı eğitimi almış ve yıllık tekrarı yapılmış olmalıdır.",
    ],
  },
  {
    title: "2. OPERASYON",
    tone: "blue",
    items: [
      "Pres dolumu yalnızca iki el kumanda sistemi ile yapılmalıdır.",
      "Ürünü kalıba yerleştirmek için pens veya manyetik tutucu kullanın.",
      "Her cycle sonunda parça çıkarmayı bekleyip basın.",
      "Kalıp değişimi ve bakım yalnızca enerjisi kesilmiş halde yapılmalıdır.",
      "Kalıp değişiminde LOTO uygulayın ve hidrolik basınç sıfırlanana kadar bekleyin.",
      "Işık perdesinden geçiş süresi ile durma süresi (stopping time) periyodik test edilmelidir.",
      "Sürekli çalışmada her 50 dakikada 10 dakika mola verip ergonomik dinlenme yapın.",
      "Üretim hızını cycle başına minimum 1.5 saniye altına düşürmeyin.",
      "Vardiya sonunda makine ana şalteri kapatılıp temizlik yapılmalıdır.",
    ],
  },
  {
    title: "3. YASAKLAR",
    tone: "red",
    items: [
      "Işık perdesini iptal etmek veya by-pass etmek kesinlikle yasaktır.",
      "Pres çalışırken kalıba el sokmak yasaktır.",
      "Tek el ile çalıştırmak veya iki el kumandasını sabitlemek yasaktır.",
      "Eğitim almamış personel pres kullanamaz.",
      "Bakım sırasında LOTO uygulanmadan kalıba/koça yaklaşmak yasaktır.",
      "Acil stop butonunu işlevsiz hale getirmek veya kapatmak yasaktır.",
      "Kalıp koruma sensörlerini iptal ederek üretim devam ettirmek yasaktır.",
      "Aşınmış veya çatlamış kalıpla baskı işlemi yapmak yasaktır.",
    ],
  },
  {
    title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)",
    tone: "yellow",
    items: [
      "Koruyucu gözlük (TS EN 166)",
      "Çelik burunlu ayakkabı (TS EN ISO 20345 S3)",
      "Anti-vibrasyon eldiveni (kalıp taşımada, TS EN ISO 10819)",
      "Kulak tıkacı (85 dB üstü ortamda, TS EN 352)",
      "Baret (TS EN 397)",
      "Mekanik dirençli eldiven (TS EN 388 4544)",
    ],
  },
  {
    title: "5. ACİL DURUM",
    tone: "purple",
    items: [
      "Sıkışma durumunda acil stop butonuna basın, yetkili olmadan parça çıkarmaya çalışmayın.",
      "Hidrolik sızıntıda makineyi durdurun, kayma riski için alanı işaretleyin.",
      "Yaralanma halinde 112 arayın ve İSG uzmanına haber verin.",
      "El/parmak sıkışmasında koçu yukarı almak için manuel by-pass'ı yetkili kişi uygulamalıdır.",
      "Hidrolik yağ yangınında ABC tipi söndürücü kullanın, su asla sıkmayın.",
      "Ciddi yaralanmada uzvu hareket ettirmeden bandajlayıp ambulans gelene kadar destek olun.",
      "Olay sonrası SGK'ya 3 iş günü içinde iş kazası bildirimi yapılmalıdır.",
    ],
  },
];

const spiralTaslamaInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  {
    title: "1. HAZIRLIK",
    tone: "green",
    items: [
      "Disk üzerinde çatlak/kırık olup olmadığını ses testi ile kontrol edin.",
      "Disk RPM değeri makine RPM değerinden düşük olmamalıdır.",
      "Koruyucu siper takılı ve sabit olmalıdır.",
      "Kabloyu hasar açısından kontrol edin, topraklama yapılı olmalıdır.",
      "Disk son kullanma tarihi (üretimden 3 yıl) geçmemiş olmalı, ambalajından yeni çıkmış olmalıdır.",
      "Çalışma alanında 11 metre çapında yanıcı malzeme bulunmamalı, gerekirse yangın battaniyesi serilmelidir.",
      "Sıcak iş izni (Hot Work Permit) düzenlenmiş, yangın söndürücü hazır bulundurulmalıdır.",
      "Ek tutamak (auxiliary handle) takılı olmalı, anahtar dili kilit konumunda olmamalıdır.",
      "Operatör kişisel maruziyet sınırı (titreşim A8 = 2.5 m/s²) hesaplanmış olmalıdır.",
    ],
  },
  {
    title: "2. OPERASYON",
    tone: "blue",
    items: [
      "Diski iş parçasına yavaşça temas ettirin, bastırarak değil keserek çalışın.",
      "Çevrede yanıcı malzeme bulunmamalıdır (kıvılcım yangını).",
      "İş parçasını mengene veya kelepçeyle sabitleyin.",
      "Çalışma sonrası diskin tamamen durmasını bekleyip yere bırakın.",
      "Diski iş parçasına 15-30° açıyla yaklaştırın, dik veya yatay sürtüş yapmayın.",
      "Makine boştayken tam devire (no-load test) ulaşmasını 60 saniye bekleyin.",
      "Sıcak iş sonrası 30 dakika boyunca yangın nöbetçisi (fire watch) sahada kalmalıdır.",
      "Her 1 saatlik kullanım sonrası 10 dakika ara verip elin titreşim maruziyetini düşürün.",
      "Kullanım sonunda fişi prizden çekin, diski sökmeden temizleme yapmayın.",
    ],
  },
  {
    title: "3. YASAKLAR",
    tone: "red",
    items: [
      "Kesme diskiyle taşlama, taşlama diskiyle kesme yapmak yasaktır.",
      "Koruyucu siperliği sökmek yasaktır.",
      "Eldivenle değişken ısıya maruz tutmak yasaktır (alev tutuşma).",
      "Sırtlı/yan kullanım yasaktır (geri tepme - kickback).",
      "Diski yere veya iş parçasına çarparak durdurmak yasaktır.",
      "Tetik kilidini sürekli basılı (ON) konumda sabitlemek yasaktır.",
      "Su altında veya nemli ortamda elektrikli spiral kullanmak yasaktır.",
      "Operatörden başka kişinin kıvılcım menzili içinde bulunması yasaktır.",
    ],
  },
  {
    title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)",
    tone: "yellow",
    items: [
      "Yüz siperliği (TS EN 166 B)",
      "Koruyucu gözlük (TS EN 166 F)",
      "Anti-vibrasyon eldiveni (TS EN ISO 10819)",
      "Kulak tıkacı veya kulaklık (TS EN 352, SNR ≥ 27 dB)",
      "FFP3 toz maskesi (silika tozu için)",
      "Alev geciktirici tulum (TS EN ISO 11611)",
      "Çelik burunlu ayakkabı (TS EN ISO 20345 S3)",
    ],
  },
  {
    title: "5. ACİL DURUM",
    tone: "purple",
    items: [
      "Disk patlaması durumunda derhal kapatın, alanı boşaltın.",
      "Yangın çıkarsa CO2 söndürücü kullanın, su kullanmayın (elektrik).",
      "Göze parça kaçması: göz duşu, ardından sağlık birimi.",
      "Geri tepme (kickback) ile yaralanmada kanamayı baskıyla durdurup 112 arayın.",
      "Elektrik çarpmasında şalterden kesin, yalıtkan cisimle kişiye yaklaşın, CPR uygulayın.",
      "Sıcak iş sonrası gizli yangına karşı 30 dakika gözlem yapın, ısıl kameralı kontrol önerilir.",
      "Maruziyet sonrası tinnitus/işitme kaybı şikayetlerinde işyeri hekimine başvurun.",
    ],
  },
];

const matkapInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  {
    title: "1. HAZIRLIK",
    tone: "green",
    items: [
      "Matkap ucunu sıkıştırma anahtarıyla iyice sıkın, anahtarı çıkarın.",
      "İş parçasını mengene veya kelepçe ile sabitleyin.",
      "Devir ayarını malzeme cinsine göre ayarlayın.",
      "Çevrede yanıcı sıvı/malzeme bulunmamalıdır.",
      "Sütunlu matkapta tabla yatay olarak ayarlanmalı, kayma boşluğu giderilmelidir.",
      "Matkap ucunun bilenmesi (118° açı) ve aşınma kontrolü yapılmalıdır.",
      "Soğutma sıvısı (kesme yağı) seviyesi yeterli olmalı, çelikte sürekli kullanılmalıdır.",
      "Topraklama ve kaçak akım rölesi (30 mA) çalışır durumda olmalıdır.",
      "Çalışma masası temiz, talaş ve yağdan arındırılmış olmalıdır.",
    ],
  },
  {
    title: "2. OPERASYON",
    tone: "blue",
    items: [
      "Delme işleminde matkabı dik tutun, eşit kuvvet uygulayın.",
      "Talaş birikiyorsa matkabı geri çekip temizleyin.",
      "Derin deliklerde periyodik olarak çıkıp soğuma süresi tanıyın.",
      "Çalışma sonrası matkap ucunu çıkarın ve yağlayın.",
      "Devir hızını çelikte 800-1500 rpm, alüminyumda 2500 rpm üstü olarak seçin.",
      "Çıkış anında parça delinme noktasında basıncı azaltın, kapma riskini önleyin.",
      "Talaşları fırça veya kanca ile temizleyin, asla hava tabancasıyla vücuda doğru üflemeyin.",
      "Sütunlu matkapta vardiya başında günlük kontrol formu doldurun.",
      "Çalışma sonrası enerjiyi kesin, mengeneyi açın ve makineyi temizleyin.",
    ],
  },
  {
    title: "3. YASAKLAR",
    tone: "red",
    items: [
      "Eldiven kullanarak sütunlu matkap çalıştırmak yasaktır.",
      "İş parçasını elle tutarak delmek yasaktır.",
      "Matkap çalışırken çapak temizliği yapmak yasaktır.",
      "Hasarlı matkap ucu kullanmak yasaktır.",
      "Sıkma anahtarı (chuck key) takılı şekilde makineyi çalıştırmak yasaktır.",
      "Matkabın koruyucu siperliği olmadan çalışmak yasaktır.",
      "Devir hızını malzemeden bağımsız olarak maksimumda kullanmak yasaktır.",
      "Açık uzun saç, kolye, sarkık iş kıyafetiyle çalışmak yasaktır.",
    ],
  },
  {
    title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)",
    tone: "yellow",
    items: [
      "Koruyucu gözlük (TS EN 166 F)",
      "Çelik burunlu ayakkabı (TS EN ISO 20345 S1P)",
      "Vücuda oturan iş tulumu (sarkıntı içermeyen)",
      "Saç bonesi (uzun saç için)",
      "Talaş temizliğinde kesilmeye dirençli eldiven (TS EN 388 Cut B)",
      "Yüksek devir/çelikte kulak tıkacı (TS EN 352)",
    ],
  },
  {
    title: "5. ACİL DURUM",
    tone: "purple",
    items: [
      "Sıkışma anında acil stop veya enerjiyi kesin.",
      "Matkap kırılması: alanı işaretleyin, parçaları yetkili topluyor.",
      "Yaralanma: ilk yardım, 112.",
      "Göze talaş kaçmasında göz duşunu 15 dakika kullanıp sağlık birimine gidin.",
      "Elektrik çarpmasında ana şalteri kapatın, kişiye yalıtkan cisimle dokunun.",
      "Yangında ABC tipi söndürücüyle müdahale, elektrikli ortamda CO2 tercih edin.",
      "Kazadan sonra makinayı kullanım dışı etiketleyip yetkili teknisyene muayene yaptırın.",
    ],
  },
];

const kimyasalDepolamaInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  {
    title: "1. HAZIRLIK",
    tone: "green",
    items: [
      "Her kimyasalın Güvenlik Bilgi Formu (SDS/MSDS) erişilebilir olmalıdır.",
      "Depolama alanı havalandırmalı, serin, kuru ve kilitli olmalıdır.",
      "Etiketleri (CLP/GHS) okunaklı ve eksiksiz olmalıdır.",
      "Birbiriyle reaksiyona girebilecek kimyasallar ayrı raflarda saklanmalıdır.",
      "Kimyasal envanteri güncel tutulmalı, depo girişi 12345 sayılı yönetmeliğe uygun olmalıdır.",
      "Göz duşu ve acil duş istasyonu kimyasaldan en fazla 10 saniyelik mesafede bulunmalıdır.",
      "Depo zemini sızdırmaz, kimyasal dirençli kaplama (epoksi) ile kaplı olmalıdır.",
      "Yangın algılama, gaz dedektörü ve havalandırma sistemi yıllık periyodik kontrolden geçmiş olmalıdır.",
      "Personel kimyasal güvenliği eğitimi (yıllık) almış ve sağlık raporu güncel olmalıdır.",
    ],
  },
  {
    title: "2. OPERASYON",
    tone: "blue",
    items: [
      "Aktarım işlemlerinde damlama tavası ve emici malzeme bulundurun.",
      "Asit/baz boşaltırken yavaşça ve suya doğru ekleyin.",
      "Kimyasal kabını taşırken iki elinizle ve gövdesinden tutun.",
      "Kullanım sonrası kabı sıkıca kapatın ve etiketle.",
      "Aktarımı çeker ocak (fume hood) altında veya yerel havalandırma yanında yapın.",
      "Konteynerleri 1.5 metreden yüksek istiflemeyin, ağır kimyasalları alt rafa koyun.",
      "Boşaltma sonrası ekipmanı önce su, sonra deterjanla yıkayıp kontaminasyonu önleyin.",
      "Atık kimyasalları renk kodlu (kırmızı/sarı) bertaraf bidonlarına ayrıştırın.",
      "Periyodik olarak kişisel maruziyet ölçümü (TWA, STEL) yapılmalı, sınır değerler aşılmamalıdır.",
    ],
  },
  {
    title: "3. YASAKLAR",
    tone: "red",
    items: [
      "Kimyasal kabının üzerinde yiyecek/içecek tüketmek yasaktır.",
      "Etiketsiz kaplarda kimyasal saklamak veya taşımak yasaktır.",
      "Birbiriyle reaksiyon veren kimyasalları aynı raflara koymak yasaktır.",
      "Açık alev veya kıvılcım üreten işlerle aynı alanda çalışmak yasaktır.",
      "Suyu aside eklemek yasaktır (sıçrama/patlama riski); daima asit suya eklenir.",
      "Kimyasalları gıda ambalajına (su şişesi vb.) doldurmak yasaktır.",
      "Hamile ve emziren personelin CMR (kanserojen, mutajen, repro-toksik) kimyasallarla çalışması yasaktır.",
      "Yetersiz havalandırılmış alanda VOC içeren kimyasalla çalışmak yasaktır.",
      "KKD'siz veya hasarlı KKD ile kimyasala temas etmek yasaktır.",
    ],
  },
  {
    title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)",
    tone: "yellow",
    items: [
      "Kimyasala dayanıklı eldiven (Nitril/Butil, TS EN 374)",
      "Kimyasal göz koruması (yan korumalı, TS EN 166 3-9)",
      "Yarım/tam yüz maskesi + uygun filtre (A2B2E2K2P3)",
      "Kimyasal önlük veya tulum (TS EN 14605 Tip 3-4)",
      "Kimyasal dirençli ayakkabı/çizme (TS EN 13832)",
      "Acil durum solunum cihazı (escape hood)",
      "Yüz siperliği (asit sıçramasına karşı)",
    ],
  },
  {
    title: "5. ACİL DURUM",
    tone: "purple",
    items: [
      "Cilde temasta 15 dakika bol su ile yıkayın, kontamine kıyafeti çıkarın.",
      "Göze sıçramada göz duşunu 15 dakika kullanın, sağlık birimine gidin.",
      "Sızıntıda emici malzeme ile çevreleyin, havalandırın, ekibi uzaklaştırın.",
      "Yangında uygun söndürücü (D, F, ABC tipine bakın) kullanın.",
      "Solunduğunda temiz havaya çıkarın, bilinç kaybında SCBA ile profesyonel kurtarma yapın.",
      "Yutma durumunda kusturmayın, SDS bölüm 4'e göre hareket edin ve hastaneye götürün.",
      "112 ve UZEM (Ulusal Zehir Danışma Merkezi: 114) aranmalı, SDS belgesi yanınızda olmalıdır.",
      "Olay sonrası 3 iş günü içinde SGK iş kazası bildirimi yapılmalıdır.",
    ],
  },
];

const elektrikPanosuInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  {
    title: "1. HAZIRLIK",
    tone: "green",
    items: [
      "Yalnızca yüksek/alçak gerilim yetki belgesi olan personel çalışabilir.",
      "Lockout-Tagout (LOTO) ile pano enerjisi kesilmeli ve kilitlenmelidir.",
      "Sıfır gerilim test cihazı ile gerilim olmadığı kontrol edilmelidir.",
      "Topraklama ve kısa devre düzeneği bağlanmalıdır.",
      "Çalışma izni (Permit to Work) düzenlenmiş ve enerji kesim formu imzalanmış olmalıdır.",
      "Pano önünde minimum 1 metre çalışma boşluğu açılmış ve sınır bandı çekilmiş olmalıdır.",
      "Elektrik İç Tesisleri Yönetmeliği ve TS EN 50110-1 standardına uygun çalışma planı yapılmalıdır.",
      "Beş altın kural uygulanmalı: aç, kilitle, test et, topraklama yap, sınırla.",
      "Personel kişisel ark flaş risk değerlendirmesini (incident energy) bilmelidir.",
    ],
  },
  {
    title: "2. OPERASYON",
    tone: "blue",
    items: [
      "Çalışma süresince LOTO etiketinizi pano üzerinde tutun.",
      "Yalıtkan halı üzerinde durarak çalışın.",
      "Tek elle çalışın, diğer eli vücuttan uzak tutun.",
      "Çalışma bitiminde test, topraklama sökme, etiket kaldırma sırasıyla devreyi açın.",
      "En az iki kişi çalışın, refakatçi (gözcü) sürekli sahada olmalıdır.",
      "Yalıtkan saplı ve VDE sertifikalı el aletlerini kullanın (1000V tested).",
      "Pano içine müdahale ederken el ve ayakkabınızdaki metal aksesuarları çıkarın.",
      "İş esnasında tüm anahtar/değişiklikleri elektrik şemasına işleyin ve revize edin.",
      "Vardiya devirlerinde LOTO devri prosedürü ile yetkiyi yazılı olarak teslim edin.",
    ],
  },
  {
    title: "3. YASAKLAR",
    tone: "red",
    items: [
      "Tek başına yüksek gerilimde çalışma yapmak kesinlikle yasaktır.",
      "Yetkisiz personelin pano kapağını açması yasaktır.",
      "Islak el veya kıyafetle pano açmak yasaktır.",
      "Ölçü aleti olmadan \"kesik mi\" varsayımıyla dokunmak yasaktır.",
      "LOTO etiketi olmayan veya başkasına ait kilitli devreyi açmak yasaktır.",
      "Sigorta yerine tel/çivi geçirerek devreyi köprülemek yasaktır.",
      "Yağmur, fırtına veya su basmış ortamda dış pano üzerinde çalışmak yasaktır.",
      "Yüksek gerilim hatlarına 5 metreden daha yakın iskele/vinç çalışması yapmak yasaktır.",
      "Çıplak ve hasarlı kabloyu izole bant ile geçici onarım yapıp servise vermek yasaktır.",
    ],
  },
  {
    title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)",
    tone: "yellow",
    items: [
      "Elektrik yalıtımlı eldiven (1000V class 0, TS EN 60903)",
      "Yüz siperliği (ark koruması, TS EN 166)",
      "Yalıtkan baret (TS EN 50365 class 0)",
      "Yalıtkan ayakkabı (TS EN 50321, dielektrik)",
      "Ark dirençli iş kıyafeti (TS EN 61482, ATPV ≥ 8 cal/cm²)",
      "Yalıtkan halı (TS EN 61111, 1000V için)",
      "Voltaj test cihazı ve topraklama seti (sınıf belirtilmiş)",
    ],
  },
  {
    title: "5. ACİL DURUM",
    tone: "purple",
    items: [
      "Çarpılma anında akımı şalterden kesin, kişiye yalıtkan cisimle dokunun.",
      "CPR bilen ilk yardımcıyı çağırın, 112 arayın.",
      "Elektrik yangınında CO2 veya kuru kimyasal söndürücü kullanın, asla su.",
      "Ark flaş yanığında etkilenen bölgeyi temiz, kuru steril örtüyle kapatın, su uygulamayın.",
      "Bilinç kaybında AED cihazı varsa derhal kullanın, defibrilasyon önceliklidir.",
      "Düşmüş yüksek gerilim hattında 10 metre güvenli mesafe bırakın, ördek yürüyüşü ile uzaklaşın.",
      "Olay sonrası pano kullanım dışı etiketlenmeli, müşterek kontrol yapılana dek enerji verilmemelidir.",
      "İş kazası 3 iş günü içinde SGK'ya, 6331 madde 14 uyarınca bildirilir.",
    ],
  },
];

const yuksekteCalismaInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  {
    title: "1. HAZIRLIK",
    tone: "green",
    items: [
      "Yüksekte çalışma eğitimi (16 saat) alınmış olunmalı, sağlık raporu güncel olmalıdır.",
      "İş izni (Permit to Work) düzenlenmiş olmalıdır.",
      "Tam vücut emniyet kemeri ve çift kancalı lanyard kontrol edilmelidir.",
      "İskele/platform günlük kontrol formu doldurulmuş olmalıdır.",
      "Hava koşulları (rüzgar, yağmur, sis) kontrol edilmeli, anemometre ölçümü yapılmalıdır.",
      "Çalışma alanı altında düşen cisim koruması (toplama ağı/bariyer) kurulmuş olmalıdır.",
      "Kurtarma planı yazılı olarak hazırlanmış ve ekibe brifing verilmiş olmalıdır.",
      "Yapı İşlerinde İSG Yönetmeliği ve TS EN 365 standardına uygun ekipman seçilmelidir.",
      "Personel kişisel düşme önleme (fall arrest) sertifikasına sahip olmalıdır.",
    ],
  },
  {
    title: "2. OPERASYON",
    tone: "blue",
    items: [
      "Çift kancalı lanyard ile sürekli ankraj noktasına bağlı kalın (100% tie-off).",
      "Ankraj noktası en az 22 kN (≈ 2.2 ton) yüke dayanıklı olmalıdır.",
      "Aletleri kemerli askıyla taşıyın, düşürmemeye dikkat edin.",
      "Düşme mesafesi (clearance) en az 6 metre olmalıdır.",
      "Çatı eğimi 30° üzerinde ise yatay yaşam halatı (horizontal lifeline) kullanın.",
      "Aletlerin lanyardı (tool tether) ile bilek bağlantısı sağlanmalı, 2 kg üzeri alet için ankraj kullanılmalıdır.",
      "Çalışma alanına çıkış/iniş için sabit merdiven veya merdiven kafesi (cage) kullanın.",
      "Sürekli iletişim için telsiz veya görsel kontak kurulmalı, yalnız çalışmamalıdır.",
      "Vardiya içerisinde 2 saatlik aralarla mola verip kemer baskı noktalarını rahatlatın.",
    ],
  },
  {
    title: "3. YASAKLAR",
    tone: "red",
    items: [
      "Tek kancalı lanyard ile geçişlerde kopuk kalmak yasaktır.",
      "İskele üzerinde malzeme istiflemek (devirme riski) yasaktır.",
      "Rüzgar 50 km/saat üzerindeyken yüksekte çalışmak yasaktır.",
      "Alkollü/uykusuz personelin yüksekte çalışması yasaktır.",
      "Bel kemeri (positioning belt) düşme önleme amacıyla kullanılmak yasaktır.",
      "Korkuluk veya yaşam halatı olmayan çatıda yürümek yasaktır.",
      "6331 sayılı yasa kapsamında sağlık raporu negatif (epilepsi, vertigo) personelin yüksekte çalışması yasaktır.",
      "Kaymaz olmayan ayakkabı ve eldivensiz çelik halat tutmak yasaktır.",
      "Elektrik hatlarına 5 metre yakın yüksek konumda metal aletle çalışmak yasaktır.",
    ],
  },
  {
    title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)",
    tone: "yellow",
    items: [
      "Tam vücut emniyet kemeri (TS EN 361)",
      "Çift kancalı şok emicili lanyard (TS EN 354/355)",
      "Çene bağlamalı baret (TS EN 397 4 noktalı)",
      "Kaymaz iş ayakkabısı (TS EN ISO 20345 SRC)",
      "Mekanik dirençli eldiven (TS EN 388)",
      "Geri sarımlı düşme önleyici (retractable, TS EN 360)",
      "Reflektörlü iş yeleği (TS EN ISO 20471)",
    ],
  },
  {
    title: "5. ACİL DURUM",
    tone: "purple",
    items: [
      "Düşme askıda kalan kişiyi en geç 15 dakika içinde kurtarın (suspension trauma).",
      "Kurtarma için önceden plan yapılmış ve kurtarma seti hazır olmalıdır.",
      "112 arayın, ambulans yerini ekibe bildirin.",
      "Askıda kalan kişiyi yere indirdikten sonra hemen yatırmayın, yarı oturur tutun (kalp riski).",
      "Düşme şokuna uğrayan ekipman (kemer/lanyard) atılmalı, tekrar kullanılmamalıdır.",
      "Yıldırım/elektrik tehlikesinde tüm yüksek çalışmalar derhal durdurulup zemine inilmelidir.",
      "Olay sonrası alanı kordon altına alın, fotoğraf çekin, tanıkları kayıt altına alın.",
      "Ciddi yaralanma 6331 madde 14 kapsamında SGK'ya 3 iş günü içinde bildirilmelidir.",
    ],
  },
];

const kapaliAlanInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  {
    title: "1. HAZIRLIK",
    tone: "green",
    items: [
      "Kapalı alan çalışma izni (Confined Space Permit) düzenlenmelidir.",
      "Atmosfer ölçümü yapılmalı (O2: %19.5-23.5, LEL: <%10, H2S: <10 ppm, CO: <30 ppm).",
      "Sürekli havalandırma (mekanik fan) sağlanmalıdır.",
      "Dışarıda gözcü (stand-by attendant) bulunmalıdır.",
      "Kapalı alan tehlike sınıflandırması yapılmalı (Permit-Required veya Non-Permit) belgelenmelidir.",
      "Giriş öncesi tüm enerjiler izole edilmeli (LOTO + boru körlemesi - blinding) yapılmalıdır.",
      "Üçlü kurtarma sistemi (tripod + winch) hazır kurulmuş olmalıdır.",
      "112 ile bağlantı kurulabilecek telsiz/telefon sürekli erişilebilir olmalıdır.",
      "Personel kapalı alan eğitimi (16 saat) almış ve sağlık raporu güncel olmalıdır.",
    ],
  },
  {
    title: "2. OPERASYON",
    tone: "blue",
    items: [
      "Atmosfer ölçümü çalışma süresince sürekli yapılmalıdır.",
      "Tam vücut emniyet kemeri ve kurtarma halatı taktırılmalıdır.",
      "İletişim aracı (telsiz/sözlü) sürekli açık tutulmalıdır.",
      "Tüm aletler kıvılcım üretmeyen (intrinsically safe) tipte olmalıdır.",
      "Gözcü giren/çıkan personeli zaman damgalı olarak giriş kayıt formuna işlemelidir.",
      "Kişi başına en az 0.5 m³/dk taze hava sağlanacak şekilde havalandırma debisini ayarlayın.",
      "Maksimum 30 dakikalık çalışma sonrası 10 dakika dışarıda mola verin.",
      "Kıvılcım üreten iş yapılacaksa ek sıcak iş izni alınıp yangın nöbetçisi konumlandırılmalıdır.",
      "Vardiya devirlerinde atmosfer ölçüm değerleri ve gözcü değişimi yazılı olarak yapılmalıdır.",
    ],
  },
  {
    title: "3. YASAKLAR",
    tone: "red",
    items: [
      "Atmosfer ölçümü yapılmadan girmek kesinlikle yasaktır.",
      "Gözcü olmadan tek başına girmek yasaktır.",
      "İçeride sigara/alev kullanmak yasaktır.",
      "Ek hava kaynağı olmadan oksijen yetersizliğinde kalmak yasaktır.",
      "Saf oksijenle havalandırma yapmak yasaktır (yangın/patlama riski).",
      "Acil durumda gözcünün içeri kurtarmaya girmesi yasaktır (çift ölüm vakası riski).",
      "Eğitim almamış veya sağlık şartı uygun olmayan personelin kapalı alana girmesi yasaktır.",
      "Permit'te yazılı maksimum çalışma süresinin aşılması yasaktır.",
      "Kapalı alan içinde benzin/dizel motorlu ekipman çalıştırmak yasaktır (CO birikimi).",
    ],
  },
  {
    title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)",
    tone: "yellow",
    items: [
      "Tam vücut emniyet kemeri + kurtarma halatı (TS EN 361/1496)",
      "Solunum cihazı (SCBA, TS EN 137) gerektiğinde",
      "Çoklu gaz dedektörü (4 gaz: O2/LEL/H2S/CO, kalibrasyonu güncel)",
      "Patlamaya karşı el feneri (ATEX zone uygun)",
      "Yüksek görünürlüklü tulum (TS EN ISO 20471)",
      "Çene bağlamalı baret (TS EN 397)",
      "Antistatik ayakkabı (TS EN ISO 20345 ESD)",
    ],
  },
  {
    title: "5. ACİL DURUM",
    tone: "purple",
    items: [
      "Atmosfer alarm verirse derhal tahliye edin.",
      "İçeride bayılma: ASLA kurtarmaya tek başına girmeyin, ekip ve SCBA çağırın.",
      "Kurtarma halatından çekerek dışarı alın, 112 arayın.",
      "Mekanik kurtarma için tripod ve winch sistemini kullanarak kişiyi yukarı çekin.",
      "H2S maruziyeti şüphesinde bilinçsiz kişiye temiz havada CPR uygulayın, AED hazırlayın.",
      "Patlama/yangında alanı tahliye edin, AFAD ve itfaiyeyi (110) bilgilendirin.",
      "Kurtarma sonrası kişiye en az 24 saat tıbbi gözlem (gecikmeli pulmoner ödem) uygulanmalıdır.",
      "Olay 6331 madde 14 uyarınca SGK'ya 3 iş günü içinde bildirilmeli, kök neden analizi yapılmalıdır.",
    ],
  },
];

const oksijenAsetilenInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  {
    title: "1. HAZIRLIK",
    tone: "green",
    items: [
      "Sıcak iş izni (Hot Work Permit) düzenlenmelidir.",
      "Çevredeki yanıcı malzemeler 11 metre uzaklaştırılmalı veya örtülmelidir.",
      "Hortumlarda alev geri tepme önleyici (flashback arrestor) takılı olmalıdır.",
      "Yangın söndürücü ve yangın nöbetçisi (fire watch) hazır olmalıdır.",
      "Tüplerin son hidrostatik test tarihi (5 yıl) geçerli olmalıdır.",
      "Hortum renk kodları doğru kullanılmalı (oksijen mavi, asetilen kırmızı) ve ezilme/çatlak kontrolü yapılmalıdır.",
      "Manometre ve regülatörler kalibrasyonlu, asetilen basıncı 1.5 bar üzerine çıkmamalıdır.",
      "Kaynakçı belgesi (TS EN ISO 9606) yanında olmalı, yıllık akciğer grafisi güncel olmalıdır.",
      "Çalışma alanı havalandırması yeterli, gerekiyorsa lokal duman emici kurulmuş olmalıdır.",
    ],
  },
  {
    title: "2. OPERASYON",
    tone: "blue",
    items: [
      "Tüpleri dik konumda zincirle bağlayın.",
      "Önce oksijen, sonra yakıt gazı vanasını açın; kapatırken tersi.",
      "Sızıntı kontrolü için sabunlu su kullanın, asla alev.",
      "İş bitiminde tüp vanalarını kapatıp hortumdaki gazı boşaltın.",
      "Alevi tutuştururken çakmak gazı (spark lighter) kullanın, kibrit/çakmak değil.",
      "Galvanizli/kurşunlu malzeme keserken solunum koruma (PAPR) kullanın, çinko ateşi riski mevcuttur.",
      "Sıcak iş bitiminde alanı 30 dakika boyunca kontrol edin (post-fire watch).",
      "Tüpleri taşırken vana koruma kapağı (cap) takılı olmalı, asla yuvarlanarak taşınmamalıdır.",
      "Vardiya sonunda tüm tüpleri kilitli depo alanına götürün, oksijen ve yakıt gaz tüplerini ayırın.",
    ],
  },
  {
    title: "3. YASAKLAR",
    tone: "red",
    items: [
      "Yağlı el veya bezle oksijen vanasına dokunmak yasaktır (patlama).",
      "Tüpleri devirmek, çarpıştırmak veya düşürmek yasaktır.",
      "Kapalı/yetersiz havalandırılmış alanda kaynak yapmak yasaktır.",
      "Yangın nöbetçisi olmadan sıcak iş yapmak yasaktır.",
      "Asetilen tüpünü 5 metre içinde oksijen tüpüyle birlikte depolamak yasaktır.",
      "Hortumda kaçak/çatlak varken bakım yerine bant ile geçici onarım yapmak yasaktır.",
      "Sıcak iş izni kapsamı dışındaki bölgede kaynak yapmak yasaktır.",
      "Asetilen tüpünü yatırarak (yatay) kullanmak yasaktır (aseton akışı).",
      "Boya/kimyasal ile kaplı yüzeyde ön temizlik yapmadan kaynak çakmak yasaktır.",
    ],
  },
  {
    title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)",
    tone: "yellow",
    items: [
      "Kaynak maskesi (DIN 10-13, otomatik karartmalı)",
      "Kaynakçı eldiveni (TS EN 12477 Tip A)",
      "Krom deri önlük ve tozluk (TS EN ISO 11611)",
      "Çelik burunlu ayakkabı (TS EN ISO 20345 S3 HRO)",
      "Yangına dayanıklı tulum (TS EN ISO 11611 sınıf 2)",
      "Solunum koruma (FFP3 veya PAPR, çinko/galvaniz için)",
      "Kulak tıkacı (TS EN 352, plazma kesimde)",
    ],
  },
  {
    title: "5. ACİL DURUM",
    tone: "purple",
    items: [
      "Geri tepme alevi: yakıt gazı vanasını derhal kapatın.",
      "Yangın çıkarsa söndürücü kullanın, yangın nöbetçisi 30 dakika sahada kalır.",
      "Göz yanığında soğuk suyla yıkayıp sağlık birimine gidin.",
      "Asetilen tüpü ısınırsa (50°C üstü) tüpü ıslatın, alanı 200 metre tahliye edin, itfaiyeyi (110) çağırın.",
      "Kaynakçı kataraktı veya ark gözü (welder's flash) şikayetinde 24 saat karanlık ortamda dinlenmelidir.",
      "Çinko ateşi (metal fume fever) belirtilerinde temiz havaya çıkarın, 24 saat tıbbi gözlem yapın.",
      "Cilt yanıklarında 15 dakika soğuk su ile soğutun, kabarmış cildi patlatmayın.",
      "Olay sonrası tüm tüp ve regülatörler servis edilene kadar kullanım dışı etiketlenmelidir.",
    ],
  },
];

const manuelTranspaletInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  {
    title: "1. HAZIRLIK",
    tone: "green",
    items: [
      "Transpaletin tekerlek, hidrolik ve fren sistemini kontrol edin.",
      "Yükün palet üzerinde dengeli yerleştirildiğinden emin olun.",
      "Yük kapasitesini aşmayacak şekilde planlayın (genellikle 2000-2500 kg).",
      "Geçiş güzergahını engellerden temizleyin.",
      "Pompa kolu yağlanmış, çatallar deforme olmamış ve düzgün hareket eder durumda olmalıdır.",
      "Çalışma alanı zemini düz, kaymaz ve yağ/su birikintisinden arındırılmış olmalıdır.",
      "NIOSH kaldırma formülüne uygun ergonomik planlama yapılmalıdır (max 23 kg manuel).",
      "Personel manuel elleçleme ve ergonomi eğitimi almış olmalıdır.",
      "Vardiya öncesi günlük kontrol formu doldurulmalı ve imzalanmalıdır.",
    ],
  },
  {
    title: "2. OPERASYON",
    tone: "blue",
    items: [
      "Transpaleti çekerek hareket ettirin, mümkünse iterek değil.",
      "Rampalarda yükü yukarı çıkışta önde, inişte arkada tutun.",
      "Köşelerde yavaşlayın ve gözcü kullanın.",
      "İş bitiminde yükü tam yere indirin.",
      "Yürüme hızı 5 km/saat (normal yürüme hızı) üzerine çıkarılmamalıdır.",
      "Çatalları paletin altına tam girecek şekilde yerleştirin, yarı sokmayla taşıma yapmayın.",
      "Dönüşlerde geniş yay çizin, yükün dengesi bozulmasın.",
      "Asansör girişlerinde önce yükü, sonra operatörü taşıyın; asansör kapasitesini aşmayın.",
      "Vardiya sonunda transpaleti belirlenmiş park alanına çekin, çatalları yere indirin.",
    ],
  },
  {
    title: "3. YASAKLAR",
    tone: "red",
    items: [
      "Transpalet üzerinde personel taşımak yasaktır.",
      "Aşırı yüklü transpaleti tek kişi taşımak yasaktır.",
      "Eğimli rampalarda durdurmak yasaktır (kayma).",
      "Yükü gözden kaçıracak şekilde taşımak yasaktır.",
      "5° üstündeki rampalarda manuel transpalet ile yük taşımak yasaktır.",
      "Hasarlı/deforme palet üzerinde yük taşımak yasaktır.",
      "Çatallar yukarıda iken transpaleti park etmek yasaktır.",
      "Tek elle veya ayak/diz ile pompalamak (yanlış postür) yasaktır.",
      "Yükü omuz hizası üzerinde manuel kaldırma yapmak yasaktır.",
    ],
  },
  {
    title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)",
    tone: "yellow",
    items: [
      "Çelik burunlu ayakkabı (TS EN ISO 20345 S3)",
      "Mekanik dirençli iş eldiveni (TS EN 388)",
      "Reflektörlü yelek (TS EN ISO 20471 sınıf 2)",
      "Bel desteği (yoğun manuel taşımada)",
      "Baret (depo girişlerinde, TS EN 397)",
    ],
  },
  {
    title: "5. ACİL DURUM",
    tone: "purple",
    items: [
      "Yük düşmesinde alanı boşaltın, kaldırma için ekip çağırın.",
      "Ayak ezilmesinde derhal soğuk uygulama, 112.",
      "Hidrolik kaçağında transpaleti kullanım dışı bırakıp etiketleyin.",
      "Bel/sırt incinmesinde kişiyi hareket ettirmeden ilk yardım çağırın.",
      "Çarpma/sıkışma vakalarında baskıyla kanama kontrolü yapın, sağlık birimini bilgilendirin.",
      "Yağ kaçağında talaş/emici malzeme dökerek kaymayı engelleyin.",
      "Olay sonrası ekipman kullanım dışı etiketlenmeli, teknik servise gönderilmelidir.",
    ],
  },
];

const mutfakBicakInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Bıçak keskinlik kontrolü yapılmalı, körelmiş bıçak kullanılmamalıdır.", "Kesim tahtası kaymayacak şekilde altına nemli bez konulmalıdır.", "Kıyma/dilimleme makinesi koruyucu siperleri yerinde olmalıdır.", "Çalışma yüzeyi temiz ve kuru olmalıdır.", "Bıçaklar renk kodlu (HACCP - kırmızı et, mavi balık, yeşil sebze) ayrılmış olmalıdır.", "Dilimleme makinesinin emniyet itici aparatı (pusher) takılı, sapı kontrol edilmiş olmalıdır.", "El yıkama ve dezenfeksiyon yapılmış, eldivenler sağlam olmalıdır.", "Mutfak personeli portör muayenesi (3 ayda bir) güncel olmalıdır.", "Acil ilk yardım dolabı erişilebilir, kanama kontrol seti hazır olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Bıçağı parmaklarınızı kıvırarak (kanca pozisyonu) kullanın.", "Bıçağı asla havada birine uzatmayın, sapı önde olacak şekilde verin.", "Düşen bıçağı tutmaya çalışmayın, kenara çekilin.", "Kıyma makinesinde malzemeyi sadece iticiyle bastırın.", "Bıçakla kesim sırasında dikkat dağıtacak konuşma/şakadan kaçının, göz teması kurmayın.", "Donmuş et kesimi öncesi malzemeyi 4°C'de çözündürün, asla sıcak su kullanmayın.", "Dilimleme makinesi temizliğini enerji kesilmiş ve disk durmuş halde yapın.", "Sıvı dökülmesi durumunda hemen silin, yer kuruyana kadar uyarı tabelası koyun.", "Vardiya sonunda bıçakları yıkayıp manyetik şerit veya kılıfa kaldırın."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Bıçağı bulaşığa atmak veya köpük altına bırakmak yasaktır.", "Bıçağı koşturarak veya yan tutarak taşımak yasaktır.", "Kıyma makinesine elle malzeme bastırmak yasaktır.", "Eldivensiz keskin bıçak temizliği yasaktır.", "Bıçağı tornavida/kapak açacağı gibi amaç dışı kullanmak yasaktır.", "Dilimleme makinesinde itici aparatı çıkarıp el ile beslemek yasaktır.", "Cebinizde veya kemerinizde açık bıçak taşımak yasaktır.", "Aynı bıçağı çiğ et ve sebze için yıkamadan kullanmak (çapraz kontaminasyon) yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Kesilmeye dirençli eldiven (TS EN 388 Cut 5/F, çelik örgü)", "Kaymaz iş ayakkabısı (TS EN ISO 20345 SRC)", "Mutfak önlüğü (sıvı geçirmez)", "Saç bonesi/kep", "Sıcak iş eldiveni (fırın/buharlı tencere için, TS EN 407)", "Yüz maskesi (HACCP gereği)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Kesik durumunda yarayı yıkayıp baskı uygulayın, derin ise sağlık birimine gidin.", "Parmak kopmasında parçayı buzlu suya koyun, 112 arayın.", "Yanık durumunda 15 dakika soğuk su, ardından sağlık birimi.", "Yağ yangınında F sınıfı söndürücü kullanın, su asla atmayın (sıçrama/patlama).", "Boğulma vakasında Heimlich manevrası uygulayın, ardından 112 arayın.", "Gıda zehirlenmesi şüphesinde numune saklayıp işyeri hekimine bildirin.", "Tüpgaz kaçağı/kokusunda kıvılcım üretmeden vanaları kapatın, alanı havalandırın, mutfağı tahliye edin."] },
];

const ofisEkranInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Sandalye yüksekliği ayaklar yere düz basacak şekilde ayarlanmalı (diz açısı 90-110°).", "Monitör üst kenarı göz hizasında ve 50-70 cm uzaklıkta olmalı.", "Klavye ve fare dirsek 90° açıda olacak şekilde konumlanmalı.", "Aydınlatma 500 lüks olmalı, ekrana yansıma engellenmeli.", "Bel desteği lumbar bölgesini destekleyecek şekilde ayarlanmalı, kol dayanağı omuz hizasında olmalıdır.", "Çalışma masası yüksekliği 72-75 cm aralığında, bacak boşluğu 60 cm olmalıdır.", "Doküman tutucu (document holder) monitör yanına yerleştirilmeli, boyun dönüşü azaltılmalıdır.", "Ortam sıcaklığı 20-24°C, nem oranı %40-60 aralığında tutulmalıdır.", "Ekran filtresi/anti-glare kullanımı tavsiye edilmeli, mavi ışık filtresi etkin olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Her 50 dakikada 10 dakika ekrandan uzaklaşın (20-20-20 kuralı).", "Saatlik kısa egzersiz: boyun, omuz, bilek hareketleri yapın.", "Su tüketimine ve duruşa dikkat edin (sırt dik, omuz rahat).", "Kabloları toplayın, geçiş yollarına bırakmayın.", "Sürekli oturmak yerine ayakta toplantı veya yürüyerek çağrı tercih edin.", "Telefon görüşmelerinde kulaklık kullanın, omuz-boyun arasına telefonu sıkıştırmayın.", "Mouse hareketleri için bilekle değil, dirsekle hareket edin (karpal tünel önleme).", "Çift monitör kullanımında ana monitörü göz hizasında ortalayın.", "Vardiya sonunda klavye/mouse temizliği yapın, ergonomi şikayetlerini İSG'ye bildirin."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Çoklu priz üzerine çoklu priz takmak yasaktır.", "Acil çıkış yollarını kutu/dosya ile kapatmak yasaktır.", "Kahve/su ekran-klavye yakınında bırakmak yasaktır.", "Yüksek raflara sandalye/mobilyaya çıkıp uzanmak yasaktır.", "Hasarlı kablo ve prizleri kullanmak yasaktır, derhal IT/teknik servise bildirilmelidir.", "Yangın söndürücü, yangın dolabı veya elektrik panosunun önünü kapatmak yasaktır.", "Ortak kullanım alanlarında (mutfak, koridor) ısıtıcı/ocak gibi cihazları gözetimsiz çalıştırmak yasaktır.", "Personal evrak ile elektrikli cihazları (ısıtıcı, ütü) kullanmak yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Bilgisayar gözlüğü (göz tavsiyesi varsa)", "Bilek desteği (mouse/klavye, jel destekli)", "Bel/sırt desteği (ergonomik sandalye veya lumbar yastık)", "Ayak desteği (footrest, kısa boylu çalışanlar için)", "Anti-glare ekran filtresi"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Yangın alarmında asansör değil merdiveni kullanın, en yakın toplanma alanına gidin.", "Elektrik çarpmasında şalterden kesin, ilk yardım çağırın.", "Düşme/takılmada hareket etmeden ekibi çağırın.", "Deprem anında çök-kapan-tutun, masa altına sığınıp sarsıntı bitince çıkın.", "Acil tahliyede engelli/hamile çalışanlara yardım için tahliye refakatçisi (buddy) atayın.", "Boyun/bel ağrısı şikayetlerinde işyeri hekimine başvurun, ergonomi değerlendirmesi yapılmalıdır."] },
];

const cepheIskelesiInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["İskele kurulumu yetkili teknik elemanca tasarlanmış olmalıdır.", "Statik hesap ve kontrol formu (haftalık) onaylı olmalıdır.", "Yeşil etiket (kullanıma uygun) iskele girişine asılı olmalıdır.", "Tabandaki ayak plakaları sağlam zemine oturtulmalıdır.", "İskele kurulum/söküm personeli scaffolder belgesine ve yüksekte çalışma eğitimine sahip olmalıdır.", "TS EN 12810 ve Yapı İşlerinde İSG Yönetmeliği uyarınca proje hazırlanmış olmalıdır.", "Cephe iskelesinde her 4 metrede bir bina aksamına kelepçe ile bağlama (tie) yapılmış olmalıdır.", "Düşey ve yatay diyagonal çaprazlar tam donanımlı olmalı, eksik eleman bulunmamalıdır.", "İskele yüküne göre statik kapasite (hafif 150 kg/m² - ağır 600 kg/m²) hesaplanmış olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["İskeleye yalnızca dahili merdiven veya kuleden çıkın.", "Korkuluk (üst 100 cm, ara 50 cm, süpürgelik 15 cm) eksiksiz olmalıdır.", "Platform genişliği en az 60 cm, alın tahtası 15 cm olmalı.", "Aynı platformda 2 kişiden fazla çalışmayın.", "Çalışma sırasında iskele kemerini ankraj noktasına çift kancalı bağlayın.", "Malzeme yukarı çıkarmada makara/vinç kullanın, elden geçirme yapmayın.", "Her vardiya başında iskele günlük kontrol formu (scafftag) doldurulmalı ve imzalanmalıdır.", "Söküm işlemini yukarıdan aşağıya, kurulumun tersi sırada ve LOTO ile yapın.", "Kar, buz veya ıslaklık varsa platform temizlenmeli, gerekirse çalışma durdurulmalıdır."] },
  { title: "3. YASAKLAR", tone: "red", items: ["İskele üstünde sıçrayarak veya koşturarak hareket etmek yasaktır.", "Korkuluk eksik iskelede çalışmak yasaktır.", "Tek borudan tırmanmak yasaktır.", "İskelenin yapısal elemanlarını sökmek/değiştirmek yetkisiz personel için yasaktır.", "Kırmızı etiketli (kullanıma uygunsuz) iskeleye girmek yasaktır.", "Rüzgar 50 km/saat üstünde iskele üzerinde çalışmak yasaktır.", "İskele yanına vinç, ekskavatör, forklift gibi makineleri 5 metre yakına getirmek yasaktır.", "Eksik platform kalas, çatlak/eğri boru veya paslı ekipmanla iskele kurmak yasaktır.", "İskele yapısal taşıma elemanlarına (taban, kelepçe) müdahale yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Tam vücut emniyet kemeri (TS EN 361)", "Çift kancalı şok emicili lanyard (TS EN 354/355)", "Çene bağlamalı baret (TS EN 397)", "Kaymaz iş ayakkabısı (TS EN ISO 20345 SRC)", "Reflektörlü iş yeleği (TS EN ISO 20471)", "Mekanik dirençli eldiven (TS EN 388)", "Anti-darbe gözlük (TS EN 166 F)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Düşme askıda kalanı 15 dakika içinde kurtarın (suspension trauma).", "İskele yıkılma riskinde alanı tahliye edin, ekibi uzaklaştırın.", "Düşen malzeme/yaralanma: 112 arayın, alan kapatılır.", "Kurtarmadan sonra kişiyi yarı oturur pozisyonda tutun, hemen yatırmayın.", "Düşme şokuna uğrayan kemer/lanyard atılmalı, tekrar kullanılmamalıdır.", "Yıldırım veya kuvvetli rüzgarda iskele üzerindeki tüm personel zemine indirilmelidir.", "Olay sonrası iskele kullanım dışı (kırmızı tag) etiketlenmeli, müşterek kontrol edilmelidir.", "İş kazası 6331 madde 14 uyarınca SGK'ya 3 iş günü içinde bildirilmelidir."] },
];

const elAletleriInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Kullanılan aletin işe uygun ve hasarsız olduğunu kontrol edin.", "Sap ve metal kısımların gevşek olmadığını kontrol edin.", "Yağlı/ıslak aletleri temizleyin.", "Aletleri belden taşıma kemeri/çantası ile taşıyın.", "Çatlak, kırık veya mantarlaşmış başlıklı aletleri kullanım dışı bırakın.", "Yalıtkan saplı el aletleri elektrik işlerinde 1000V dayanımlı (VDE) olmalıdır.", "Çalışma alanı ışıklandırma seviyesi en az 200 lüks olmalı, gölgesiz olmalıdır.", "Vardiya öncesi alet sayım kontrolü yapılmalı, tehlikeli alanlarda kayıt tutulmalıdır.", "Personel el aletleri kullanımı eğitimi almış olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Çekici işin doğrultusunda kullanın, iş parçasını sabitleyin.", "Tornavidayı işe uygun büyüklükte seçin, kesinlikle keski gibi kullanmayın.", "Pense ile somun açıp kapatmayın (anahtar kullanın).", "Kullanım sonrası aleti yerine kaldırın, fırlatmayın.", "Anahtarı çekme yönünde kullanın, ittirme yönünde uygulamayın (düşme/yaralanma).", "Bıçak/keski kullanırken vücudun karşı yönüne doğru kesim yapın.", "Yüksekte alet kullanımında lanyard (tool tether) ile bilek bağlantısı kurun.", "Çekiç darbelerinde gözlerinizi parça yönünden uzaklaştırın, başka birine doğrultmayın.", "Vardiya sonunda aletleri temizleyip alet panosuna (shadow board) iade edin."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Hasarlı/eskimiş el aletini kullanmak yasaktır.", "Yüksekteyken aletleri istifleyerek bırakmak yasaktır (düşme).", "Aleti başkasına atarak vermek yasaktır.", "İşe uygun olmayan aleti zorla kullanmak yasaktır.", "Anahtara uzatma borusu (cheater bar) takarak güç artırmak yasaktır.", "Tornavidayı keski/levye yerine kullanmak yasaktır.", "Cebinizde sivri uçlu alet (tornavida, çivi) taşımak yasaktır.", "Kıvılcım üreten aletleri patlayıcı ortamlarda (ATEX) kullanmak yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Mekanik dirençli eldiven (TS EN 388 4544)", "Koruyucu gözlük (TS EN 166 F)", "Çelik burunlu ayakkabı (TS EN ISO 20345 S1P)", "Baret (yüksekte/açık sahada, TS EN 397)", "Kesilmeye dirençli eldiven (TS EN 388 Cut B, kesici aletler için)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["El/parmak ezilmesinde soğuk uygulama, sağlık birimi.", "Göze parça kaçmasında göz duşu, sağlık birimi.", "Ciddi yaralanma: ilk yardım, 112.", "Derin kesik vakalarında baskılı pansuman uygulayıp uzvu kalp seviyesi üstünde tutun.", "Tetanos riskli yara (paslı çivi vb.) durumunda son aşı tarihi 5 yıldan fazla ise rapel önerilir.", "Aletten kaynaklı düşürme/çarpma kazalarında kişiyi hareket ettirmeden ekibi çağırın.", "Kazadan sonra hasar veren alet etiketlenip kullanım dışı bırakılmalıdır."] },
];

const genelIsgInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["İşbaşı eğitiminizi (6331 madde 17 uyarınca asgari 16 saat) almış olun ve özlük dosyanızı tamamlayın.", "Sağlık raporunuz güncel olmalıdır.", "Görev tanımınızı ve riskleri öğrenmiş olun.", "Görevle ilgili KKD'lerinizi tam ve sağlam olarak teslim alın.", "Risk değerlendirmesini ve acil durum planını okuyup imza defterine imza atın.", "İlk yardımcı, yangın söndürme ve tahliye sorumlularının kim olduğunu öğrenin.", "Çalıştığınız alandaki acil çıkış, toplanma alanı ve yangın söndürücü konumlarını öğrenin.", "Sağlık ve güvenlik işaretlerini (uyarı, yasak, zorunlu) tanıyın ve uygun davranın.", "Periyodik İSG eğitimlerine (çok tehlikeli sınıfta yıllık) katılın ve katılım kaydı alın."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Her sabah çalışma alanı 5S kontrolü (sıralı, sade, silinmiş, standart, sürdürülebilir) yapın.", "Yakın kaza/uygunsuzluk durumlarını derhal İSG uzmanına bildirin.", "Kaldırma işlerinde dizden çökerek yapın, beli zorlamayın (NIOSH max 23 kg).", "Çalışma sırasında telefonu yalnızca dinlenme molasında kullanın.", "İşyeri kurallarına uyun, davranış bazlı güvenlik (BBS) gözlemlerine destek olun.", "Çalışma izinleri (sıcak iş, yüksekte, kapalı alan, kazı) düzenlenmeden ilgili işi başlatmayın.", "Tehlike avı (hazard hunt) ve toolbox toplantılarına aktif katılın.", "KKD bakımını yapın, hasarlı KKD'yi derhal değiştirin, ortak KKD'yi dezenfekte edin.", "Vardiya sonunda alanı temiz, malzemeleri yerine konulmuş şekilde teslim edin."] },
  { title: "3. YASAKLAR", tone: "red", items: ["İşyerinde alkol, uyuşturucu, sigara (yasak alanlarda) tüketmek yasaktır.", "KKD'siz alanda KKD takmadan çalışmak yasaktır.", "Yetkisi olmadığı işi yapmak yasaktır.", "Yangın çıkış kapılarını/yollarını kapatmak yasaktır.", "İSG uyarı ve işaretlerine, talimat ve kurallara uymamak yasaktır.", "Şaka, koşma, itişme gibi davranışlarla iş güvenliğini tehlikeye atmak yasaktır.", "Makine ve ekipmanların güvenlik tertibatlarını (acil stop, sensör, kapak) iptal etmek yasaktır.", "İş kazası veya ramak kala olayları gizlemek/bildirmemek yasaktır.", "Sağlık raporu olmadan veya kısıtlı iş kapsamı dışında çalışmak yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Çalışma alanına özel KKD'leri tam takın.", "Genel: baret (TS EN 397), koruyucu gözlük (TS EN 166), iş eldiveni (TS EN 388).", "Ayak koruma: çelik burunlu ayakkabı (TS EN ISO 20345 S3).", "Görünürlük: reflektörlü yelek (TS EN ISO 20471).", "Kulak koruma: gerektiğinde tıkaç/manşon (TS EN 352)."] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Yangın alarmında kalk-kalan-tahliye-toplan: en yakın çıkıştan toplanma alanına.", "Deprem: çök-kapan-tutun, sarsıntı bitince çıkın.", "Kaza/yaralanma: ilk yardımcı çağırın, 112 (Türkiye genel acil).", "Kimyasal döküntü: alanı işaretleyin, İSG uzmanı çağırın.", "Elektrik çarpmasında ana şalterden kesin, yalıtkan cisimle kişiye yaklaşın.", "Boğulma vakalarında Heimlich manevrası, bilinç kaybında CPR (30:2 oran) uygulayın.", "Bomba ihbarı/şüpheli paket: alanı tahliye edin, AFAD/110 ve 155 hattını arayın.", "Olay sonrası ramak kala/kaza bildirim formu doldurulmalı, SGK'ya 3 iş günü içinde bildirilmelidir."] },
];

const cncFrezeInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["CNC programı simülasyondan geçirilmiş ve onaylanmış olmalıdır.", "Takım boyları ve ofsetler ölçülerek makineye girilmiş olmalıdır.", "İş parçası bağlama aparatı (mengene/fixture) sağlam monte edilmelidir.", "Acil stop butonu ve kapı interlock sistemi çalışır durumda olmalıdır.", "Soğutma sıvısı seviyesi yeterli, filtresi temiz olmalıdır.", "Operatör CNC eğitimi almış ve sertifikası güncel olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["İlk parça test çalışmasını yavaş besleme (feed override %25) ile yapın.", "Takım değişimi sırasında iğ (spindle) tamamen durmuş olmalıdır.", "Kapak açıkken makine çalıştırma yapmayın.", "Soğutma sıvısını takım ve iş parçası tipine göre ayarlayın.", "Vardiya sonunda talaşları temizleyip makineyi sıfır noktasına alın.", "Her 50 parçada takım aşınma kontrolü yapın."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Kapı interlock devre dışı bırakılarak çalışmak yasaktır.", "Eldiven takarak CNC tezgah çalıştırmak yasaktır.", "Programda test edilmemiş kodu doğrudan üretimde çalıştırmak yasaktır.", "Tezgah çalışırken iş parçasına uzanmak yasaktır.", "Yetkisiz parametre değişikliği yapmak yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Koruyucu gözlük (TS EN 166 F)", "Çelik burunlu ayakkabı (TS EN ISO 20345 S1P)", "Saç bonesi/kep", "Kulak tıkacı (TS EN 352)", "Vücuda oturan iş tulumu"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Çarpışma (crash) durumunda acil stop basın, yetkili olmadan müdahale etmeyin.", "Talaş sıçraması göz yaralanmasında göz duşunu kullanın.", "Takım kırılmasında alanı boşaltın, kırık parçaları kontrol edin.", "Yaralanmalarda 112 arayın ve İSG uzmanını bilgilendirin."] },
];

const kopruluVincInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["G sınıfı vinç operatör belgesi yanınızda bulundurulmalıdır.", "Vardiya öncesi sapan, kanca emniyet mandalı ve frenleri kontrol edin.", "Vinç yıllık periyodik muayenesi geçerli olmalıdır.", "Kaldırılacak yükün ağırlığı vinç kapasitesini aşmamalıdır.", "Çalışma alanı altında insansız bölge oluşturulmalıdır.", "Sapan ve bağlama ekipmanı hasarsız ve WLL etiketi görünür olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Yükü kaldırmadan önce deneme kaldırması (test lift) yapın.", "Yük taşırken ikaz kornasını çalıştırın, yaya uyarısı yapın.", "Yükü kişilerin üzerinden geçirmeyin.", "Eğik çekiş yapmayın, yük dikey kaldırılmalıdır.", "İndirme sırasında yavaş hareket edin, ani fren yapmayın.", "Sapan açısını 60° altında tutun, gerekirse traversa kullanın."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Yük üzerinde veya yükle birlikte insan taşımak yasaktır.", "Vinç kapasitesini aşan yük kaldırmak yasaktır.", "El ile yük yönlendirmek yasaktır, ip/halat kullanılmalıdır.", "Hasarlı sapan, halat veya zincir ile yük taşımak yasaktır.", "Yükün altında veya menzilinde durmak yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Baret (TS EN 397)", "Çelik burunlu ayakkabı (TS EN ISO 20345 S3)", "Mekanik eldiven (TS EN 388)", "Reflektörlü yelek (TS EN ISO 20471)", "İşaret eldiveni (parlak renkli)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Yük düşmesinde alanı boşaltın, kaldırma için ekip bekleyin.", "Sapan kopmasında derhal acil stop basın.", "Yaralanmalarda 112 arayın, uzvu hareket ettirmeyin.", "Elektrik arızasında vinç yüklü park pozisyonuna alın."] },
];

const kompresorInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Kompresör basınçlı ekipman yıllık periyodik muayenesi geçerli olmalıdır.", "Emniyet ventili, basınç göstergesi ve drenaj vanası kontrol edilmelidir.", "Hava filtresi temiz, yağ seviyesi yeterli olmalıdır.", "Kompresör titreşim yapmamalı, ses seviyesi normalin üzerinde olmamalıdır.", "Topraklama ve kaçak akım rölesi çalışır durumda olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Kompresörü düz, havalandırılmış zeminde çalıştırın.", "Tank drenaj vanasını günlük olarak açıp yoğuşma suyunu boşaltın.", "Hava hortumllarında patlak/çatlak kontrolü yapın.", "Basıncı iş gereksinimine göre ayarlayın, gereksiz yüksek basınç kullanmayın.", "Vardiya sonunda kompresörü kapatın, tankı tam basınçlı bırakmayın."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Hava tabancasıyla vücuda doğru hava üflemek kesinlikle yasaktır.", "Emniyet ventilini kapatmak veya devre dışı bırakmak yasaktır.", "Basınçlı tankta kaynak/tamir yapmak yasaktır.", "Periyodik muayenesi geçmiş kompresörü kullanmak yasaktır.", "Kompresör çalışırken hortum bağlantısı yapmak yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Kulak tıkacı (TS EN 352)", "Koruyucu gözlük (TS EN 166)", "Çelik burunlu ayakkabı (TS EN ISO 20345 S1P)", "Mekanik eldiven (TS EN 388)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Hortum patlamasında ana vanayi kapatın, alanı boşaltın.", "Basınç düşürücü arızasında kompresörü acil stop ile durdurun.", "Yaralanmalarda ilk yardım uygulayın, 112 arayın.", "Gaz kaçağı şüphesinde havalandırın, kıvılcım oluşturmayın."] },
];

const seritDaireTestereInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Testere bıçağının dişleri sağlam ve keskin olmalıdır.", "Koruyucu siperlik/kapak takılı ve çalışır olmalıdır.", "İş parçası mengene veya destekle sabitlenmiş olmalıdır.", "Acil stop butonu ve topraklama kontrolü yapılmalıdır.", "Çalışma alanı talaş ve kırıntılardan arındırılmış olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Bıçağı iş parçasına yavaşça temas ettirin, zorlamayın.", "Kesim sırasında malzemeyi eli ile ittirmeyin, itici kullanın.", "Kısa parça kesiminde özel tutucu veya destek kullanın.", "Çalışma sonrası bıçağın tamamen durmasını bekleyin.", "Bıçak değişimini enerji kesilmiş halde yapın."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Koruyucu siperlik olmadan kesim yapmak yasaktır.", "Eldiven ile daire testere kullanmak yasaktır.", "Hasarlı veya çatlak bıçakla çalışmak yasaktır.", "Çalışırken bıçağa yaklaşmak veya talaş temizlemek yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Koruyucu gözlük (TS EN 166 F)", "Kulak tıkacı (TS EN 352)", "Çelik burunlu ayakkabı (TS EN ISO 20345 S1P)", "Toz maskesi (FFP2)", "Vücuda oturan iş tulumu"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Bıçak kırılmasında acil stop basın, alanı boşaltın.", "Kesik/kanama durumunda baskılı pansuman uygulayıp 112 arayın.", "Göz yaralanmasında göz duşu kullanın.", "Parmak kopmasında parçayı buzlu suya koyun, 112 arayın."] },
];

const elektrikliKiriciInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Makine kablosu ve fiş hasarsız, topraklama bağlantılı olmalıdır.", "Uç (keski/matkap) sağlam takılmış ve hasarsız olmalıdır.", "Çalışma alanında gömülü tesisat (elektrik/su/gaz) taraması yapılmalıdır.", "Tozlu ortamlarda lokal havalandırma veya toz emici hazır olmalıdır.", "Kişisel titreşim maruziyet sınırı (A8=5 m/s²) hesaplanmış olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Makineyi iki elle kavrayarak çalıştırın, tek elle kullanmayın.", "Beton delme sırasında periyodik toz emme yapın.", "Her 30 dakikada mola verin, el ve kol titreşim maruziyetini azaltın.", "Çalışma sonrası uçları çıkarın ve makineyi temizleyin."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Tek elle kırıcı/delici kullanmak yasaktır.", "Su veya nemli ortamda izolasyonsuz cihaz kullanmak yasaktır.", "Tesisat taraması yapılmadan duvar/zemin kırmak yasaktır.", "Merdiven üzerinde kırıcı kullanmak yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Anti-vibrasyon eldiveni (TS EN ISO 10819)", "Koruyucu gözlük (TS EN 166)", "FFP3 toz maskesi (silika tozu)", "Kulak tıkacı/kulaklık (TS EN 352)", "Baret (TS EN 397)", "Çelik burunlu ayakkabı (TS EN ISO 20345 S3)"] },
];

const boyaCilaInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["SDS/MSDS belgeleri kontrol edilerek VOC ve solvent içeriği bilinmelidir.", "Çalışma alanı iyi havalandırılmış veya boya kabini içinde olmalıdır.", "Yanıcı buhar birikmesine karşı gaz dedektörü çalışır olmalıdır.", "Statik elektrik topraklaması yapılmış, ATEX uyumlu ekipman hazır olmalıdır.", "Yangın söndürücü ve acil duş istasyonu erişilebilir olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Boyayı karıştırırken ve tabanca ile uygularken maskenizi takın.", "Boya kabini filtresinin tıkanıklığını kontrol edin.", "Solvent ile temizlik sonrası bezleri kapaklı metal bidonlara atın.", "Boya artıklarını kimyasal atık olarak bertaraf edin.", "Vardiya sonunda ekipmanı temizleyip havalandırmayı kapatmayın."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Havalandırmasız ortamda boya uygulamak yasaktır.", "Boya alanında sigara/açık alev kullanmak yasaktır.", "KKD olmadan solvent bazlı boya ile çalışmak yasaktır.", "Gıda tüketim alanlarında boya/tiner depolamak yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Yarım/tam yüz organik gaz maskesi (A2 filtre)", "Kimyasal dirençli eldiven (Nitril, TS EN 374)", "Koruyucu gözlük (TS EN 166)", "Boya tulumu (tek kullanımlık veya yıkanabilir)", "Antistatik ayakkabı (TS EN ISO 20345 ESD)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Solvent zehirlenmesinde temiz havaya çıkarın, 112 arayın.", "Boya yangınında ABC/CO2 söndürücü kullanın.", "Cilde temas halinde sabunlu suyla yıkayın, SDS bölüm 4 uygulayın.", "Göze sıçramada 15 dakika göz duşu, sağlık birimine gidin."] },
];

const asbestInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Asbest söküm planı hazırlanmış ve Çalışma Bakanlığı'na bildirilmiş olmalıdır.", "Çalışma alanı kapatılmış, negatif basınç sistemi kurulmuş olmalıdır.", "Personel asbest söküm eğitimi almış, sağlık taraması yapılmış olmalıdır.", "Kişisel hava örnekleme pompası ile lif ölçümü yapıma planı hazır olmalıdır.", "Özel asbest atık poşetleri (çift kat, etiketli) ve sızdırmaz konteynerler hazır olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Asbest malzemeyi ıslatarak (islak yöntem) sökün, kuru kırma yapmayın.", "Çalışma sırasında sürekli hava ölçümü yapılmalıdır.", "Dekontaminasyon ünitesinden geçmeden alanı terk etmeyin.", "Atıkları çift katlı PE poşetlere paketleyip etiketleyin.", "Temizlik sonrası bağımsız laboratuvar ile hava ölçümü yaptırın."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Asbesti kuru olarak kırmak/frezelemek/taşlamak kesinlikle yasaktır.", "Eğitimsiz personelin asbest alanına girmesi yasaktır.", "Basınçlı hava ile temizlik yapmak yasaktır.", "Asbest atığını normal çöpe atmak yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Tam yüz maskesi + P3 filtre (TS EN 143)", "Tek kullanımlık tulum (Tip 5/6)", "Çelik burunlu iş ayakkabısı (TS EN ISO 20345 S3)", "Çift kat eldiven (nitril alt, mekanik üst)", "Koruyucu gözlük (TS EN 166)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Maske arızasında derhal alanı terk edin.", "Kontaminasyon durumunda dekontaminasyon prosedürünü uygulayın.", "Solunumsal şikayetlerde işyeri hekimine başvurun.", "6331 kapsamında kişisel maruziyet kayıtları 40 yıl saklanmalıdır."] },
];

const jeneretorInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Yakıt seviyesi, yağ seviyesi ve soğutma suyu kontrol edilmelidir.", "Topraklama kablosu bağlanmış olmalıdır.", "Egzoz çıkışı açık alana yönlendirilmiş olmalıdır.", "ATS (otomatik transfer şalteri) doğru konumda olmalıdır.", "Jeneratör yıllık periyodik bakımı ve elektrik ölçümleri güncel olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Yük bağlamadan önce jeneratörü çalıştırıp birkaç dakika ısıtın.", "Yük alma/verme sırasında ATS veya manuel şalteri doğru pozisyonda tutun.", "Çalışma sırasında yakıt ikmali yapmayın, önce durdurun.", "Ses seviyesini kontrol edin (85 dB üstünde KKD zorunlu).", "Vardiya sonunda soğumasını beklemeden kapatmayın."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Kapalı alanda jeneratör çalıştırmak yasaktır (CO zehirlenmesi).", "Çalışırken yakıt doldurmak yasaktır.", "Topraklamasız jeneratör kullanmak yasaktır.", "Yetkisiz personelin şalter müdahalesi yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Kulak tıkacı/kulaklık (TS EN 352)", "Yalıtkan eldiven (TS EN 60903)", "Çelik burunlu ayakkabı (TS EN ISO 20345 S3)", "Koruyucu gözlük (TS EN 166)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["CO zehirlenmesi belirtilerinde temiz havaya çıkarın, 112 arayın.", "Yakıt sızıntısı/yangında jeneratörü kapatın, ABC söndürücü kullanın.", "Elektrik çarpmasında ana şalteri kapatın, yalıtkan cisimle yaklaşın, CPR uygulayın.", "Yüksek sıcaklık alarmında jeneratörü soğumaya bırakın."] },
];

const kabloDosemeInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Çalışma izni ve enerji kesim formu düzenlenmiş olmalıdır.", "LOTO uygulanmış, gerilim yokluğu test edilmiş olmalıdır.", "Kablo güzergahındaki engeller temizlenmiş olmalıdır.", "Kullanılacak kablo cinsi ve kesiti projeye uygun olmalıdır.", "Yalıtkan el aletleri (VDE 1000V) ve ölçüm cihazları hazır olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Kablo çekiminde rulmanı çekme yönünde sabitleyin.", "Kablo bükme yarıçapını imalatçı önerisinin altına düşürmeyin.", "Bağlantı sonrası yalıtım direnci ölçümü yapın (megger testi).", "Kablo kanallarını kapaklarıyla kapatın, açıkta bırakmayın.", "Tamamlanan işi as-built çizimlerine işleyin."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Enerjili kablo üzerinde çalışmak yasaktır.", "LOTO uygulanmadan bağlantı yapmak yasaktır.", "Hasarlı kabloları yüzeysel bant ile onarmak yasaktır.", "Sertifikasız/yetki belgesiz kablo bağlantısı yapmak yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Yalıtkan eldiven (TS EN 60903 class 0)", "Koruyucu gözlük (TS EN 166)", "Yalıtkan ayakkabı (TS EN 50321)", "Baret (TS EN 397)", "Yüz siperliği (bağlantı işlerinde)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Elektrik çarpmasında şalteri kapatın, yalıtkan cisimle müdahale edin.", "Ark çakmasında soğuk su ile yanığı soğutun, 112 arayın.", "Kablo yangınında CO2 söndürücü kullanın.", "Yaralanmalarda ilk yardım uygulayın."] },
];

const catiCalismaInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Yüksekte çalışma izni düzenlenmiş olmalıdır.", "Çatı yüzey durumu (kaygan, kırılgan) değerlendirilmiş olmalıdır.", "Düşme önleme için yatay yaşam halatı veya ankraj noktaları kurulmuş olmalıdır.", "Çatı kenarlarında korkuluk veya kenar koruma sistemi olmalıdır.", "Hava koşulları kontrol edilmiş (rüzgar/yağmur/buz) olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Sürekli 100% ankraj bağlantısı sağlayın (çift kanca ile geçiş).", "Kırılgan yüzeylerde (aydınlık, eternit) yürüme platformu kullanın.", "Çatıya çıkış/iniş için güvenli erişim sağlayın (merdiven/kafes).", "Aletleri tool lanyard ile bağlayın, düşürme riskini önleyin.", "Çalışma alanı altında bariyer çekin, düşen cisim uyarısı yapın."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Yaşam halatı/kemersiz çatıda çalışmak yasaktır.", "Islak/buzlu çatıda çalışmak yasaktır.", "Kırılgan malzeme üzerinde koruma olmadan yürümek yasaktır.", "Rüzgar 40 km/saat üzerinde çatıda kalmak yasaktır.", "Tek başına çatıda çalışmak yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Tam vücut emniyet kemeri (TS EN 361)", "Çift kancalı lanyard (TS EN 354/355)", "Çene bağlamalı baret (TS EN 397)", "Kaymaz iş ayakkabısı (TS EN ISO 20345 SRC)", "Reflektörlü yelek (TS EN ISO 20471)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Düşme askıda kalma durumunda 15 dk içinde kurtarın.", "Çatı çökmesinde alanı tahliye edin, AFAD çağırın.", "112 arayın, ambulans erişim yolunu bildirin.", "Yıldırım tehlikesinde derhal zemine inin."] },
];

const portatifMerdivenInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Merdiven basamakları, kilitleri ve kaymaz ayaklarını kontrol edin.", "Merdiveni düz, sağlam zemine kurun.", "Yaslanma merdiveninde üst tarafta en az 1 metre uzatma bırakın.", "Merdiven açısı 75° olmalıdır (4:1 kuralı).", "Merdiven yıllık kontrol etiketini kontrol edin."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Daima 3 nokta teması kuralına uyun (iki el bir ayak veya iki ayak bir el).", "Son iki basamağa çıkmayın.", "Merdivende çalışırken yana uzanmayın, merkezi koruyun.", "Ağır veya hacimli malzeme ile merdivene çıkmayın.", "Merdiveni kullanım sonrası düzgün katlayıp yerine kaldırın."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Hasarlı/kırık merdiven kullanmak yasaktır.", "Metal merdiveni elektrik hattı yakınında kullanmak yasaktır.", "Merdiveni yatay platform/iskele olarak kullanmak yasaktır.", "İki merdiveni bağlayarak uzatmak yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Kaymaz iş ayakkabısı (TS EN ISO 20345 SRC)", "Baret (TS EN 397, çene bağlamalı)", "Mekanik eldiven (TS EN 388)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Düşme durumunda hareket etmeden ilk yardım çağırın.", "112 arayın, omurga yaralanması ihtimalini göz ardı etmeyin.", "Merdiven devrilmesinde alanı güvenli hale getirin."] },
];

const siloTankInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Kapalı alan çalışma izni (Confined Space Permit) düzenlenmelidir.", "Tank boşaltılmış, yıkanmış ve havalandırılmış olmalıdır.", "Atmosfer ölçümü yapılmalıdır (O2, LEL, toksik gaz).", "Tüm enerji kaynakları izole edilmiş (LOTO), boru körlemeleri yapılmış olmalıdır.", "Gözcü (stand-by attendant) ve üçlü kurtarma sistemi hazır olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Sürekli atmosfer ölçümü yaparak çalışın.", "Temizlik malzemesi kimyasal uyumu kontrol edin (reaksiyon riski).", "Maksimum 30 dakika çalış, 10 dakika dışarıda dinlen.", "Kaymaz platform ve aydınlatma (24V, ATEX) kullanın.", "Gözcü ile sürekli iletişim halinde olun."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Atmosfer ölçümü yapılmadan girmek kesinlikle yasaktır.", "Gözcüsüz çalışmak yasaktır.", "Tank içinde kıvılcım çıkaran ekipman kullanmak yasaktır.", "Saf oksijen ile havalandırmak yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Tam vücut emniyet kemeri + kurtarma halatı (TS EN 361/1496)", "Solunum koruma (SCBA veya PAPR)", "Çoklu gaz dedektörü (4 gaz)", "Antistatik tulum ve ayakkabı", "Çene bağlamalı baret (TS EN 397)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Gaz alarmında derhal tahliye edin.", "Bayılan kişiyi kurtarma halatı/tripod ile dışarı çekin.", "SCBA ile eğitimli kurtarma ekibi müdahale etsin.", "112 arayın, SDS bilgilerini hazır bulundurun."] },
];

const elektrikArkKaynakInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Sıcak iş izni düzenlenmiş olmalıdır.", "Kaynak makinesi topraklaması ve kablo kontrolü yapılmış olmalıdır.", "Çalışma alanında yangın söndürücü ve yangın nöbetçisi hazır olmalıdır.", "11 metre çevrede yanıcı malzeme bulunmamalıdır.", "Havalandırma yeterli, gerekirse lokal duman emici kurulmuş olmalıdır.", "Kaynakçı belgesi (TS EN ISO 9606) güncel olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Kaynak parametrelerini malzeme kalınlığına göre ayarlayın.", "Toprak klempini iş parçasına yakın ve sağlam bağlayın.", "Kaynak dikişini sıcakken kontrol edin (görsel muayene).", "MIG/MAG gazını ayarlayın (CO2/Argon karışımı), kaçak kontrolü yapın.", "Sıcak iş bitiminde 30 dakika fire watch uygulayın."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Islak eldiven veya kıyafetle kaynak yapmak yasaktır.", "Havalandırmasız ortamda kaynak yapmak yasaktır.", "Cam/plastik üzerinde çıplak gözle kaynak arkını izlemek yasaktır.", "Galvanizli malzemeyi solunum koruma olmadan kaynatmak yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Otomatik karartmalı kaynak maskesi (DIN 9-13)", "Kaynakçı eldiveni (TS EN 12477 Tip A)", "Alev geciktirici tulum (TS EN ISO 11611)", "Çelik burunlu ayakkabı (TS EN ISO 20345 S3 HRO)", "Solunum koruma (FFP3 veya PAPR)", "Kaynakçı tokluğu/önlüğü"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Ark gözü (welder flash) durumunda karanlık ortamda dinlenin.", "Yanık durumunda 15 dakika soğuk su, 112 arayın.", "Yangın çıkması halinde söndürücü kullanın, fire watch devam edin.", "Elektrik çarpmasında şalterden kesin, CPR uygulayın."] },
];

const reachTruckInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Operatör belgesi (F sınıfı) ve periyodik muayene geçerli olmalıdır.", "Akü şarj durumu, fren ve direksiyon kontrolü yapılmalıdır.", "Çatal uçları hasarsız ve düzgün olmalıdır.", "Çalışma koridorunda engel bulunmamalıdır.", "Mast yüksekliği raf üst seviyesine uygun olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Yükü çatala tam geçirin, yarı yükleme yapmayın.", "Kaldırma/indirme sırasında makineyi tamamen durdurun.", "Koridorlarda 5 km/saat hızı aşmayın.", "Geri manevrada arkaya bakın ve kornaya basın.", "Park ederken çatalları yere indirip el frenini çekin."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Çatallarda insan taşımak/kaldırmak yasaktır.", "Raf kapasitesini aşan istifleme yasaktır.", "Şarj alanında sigara içmek yasaktır.", "Yük/çatal havada park etmek yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Baret (TS EN 397)", "Çelik burunlu ayakkabı (TS EN ISO 20345 S3)", "Reflektörlü yelek (TS EN ISO 20471)", "Mekanik eldiven (TS EN 388)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Raf devrilmesinde alanı tahliye edin, ekibi uyarın.", "Yük düşmesinde sıkışan kişiyi hareket ettirmeyin, 112 arayın.", "Akü asidi sıçramasında 15 dakika su ile yıkayın.", "Yangında ABC söndürücü kullanın."] },
];

const depoRafInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Raf sisteminin yıllık periyodik kontrolü yapılmış olmalıdır.", "Her rafta yük kapasitesi etiketi görünür olmalıdır.", "Raf hasar görmüş bölge varsa kırmızı etiket asılmış olmalıdır.", "Zemin işaretlemeleri (yaya/araç geçişi) belirgin olmalıdır.", "Raf köşe koruyucuları (impact protection) takılı olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Ağır yükleri alt raflara, hafif yükleri üst raflara yerleştirin.", "Paletleri düzgün, çıkıntısız ve dengeli yerleştirin.", "Raf hasarını gördüğünüzde sorumlunuza bildirin, hasarlı bölge yok edilmelidir.", "Üst raflara erişim için forklift/istif makinesi kullanın, tırmanmayın.", "Geçiş yollarını malzeme ile daraltmayın."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Raf kapasitesini aşan istifleme yapmak yasaktır.", "Rafa tırmanmak/ayak basmak yasaktır.", "Hasarlı rafa yük koymak yasaktır.", "Paletleri çıkıntılı veya dengezis şekilde yerleştirmek yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Baret (TS EN 397)", "Çelik burunlu ayakkabı (TS EN ISO 20345 S3)", "Mekanik eldiven (TS EN 388)", "Reflektörlü yelek (TS EN ISO 20471)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Raf devrilmesinde alanı tahliye edin, 112 arayın.", "Düşen yük altında kalan kişiyi hareket ettirmeyin.", "Yapısal hasar varsa depoyu kapatın, mühendis kontrol yaptırana kadar kullanmayın."] },
];

const endustriyelFirinOcakInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Gaz bağlantıları ve hortumları sızıntı açısından kontrol edilmelidir.", "Davlumbaz ve aspirasyon sistemi çalışır durumda olmalıdır.", "Yangın söndürücü (F sınıfı yağ yangını) ve yangın battaniyesi erişilebilir olmalıdır.", "Fırın termostat ve emniyet ventili çalışır olmalıdır.", "Tabandaki kaymaz paspaslar temiz ve düzgün olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Ocağı açmadan önce gaz kokusunu kontrol edin.", "Fırına yiyecek koyarken sıcak iş eldiveni kullanın.", "Buharlı pişirici kapağını yavaşça açın, yüzünüzü uzak tutun.", "Yağ ile kızartmada sıcaklığı 180°C üzerine çıkarmayın.", "Vardiya sonunda tüm gaz vanalarını kapatın."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Islak elle elektrikli cihazlara dokunmak yasaktır.", "Gaz kokusunda ocağı açmak/kıvılcım oluşturmak yasaktır.", "Yanıcı malzemeyi fırın/ocak yakınına koymak yasaktır.", "Sıcak yağa su dökmek kesinlikle yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Sıcak iş eldiveni (TS EN 407)", "Kaymaz iş ayakkabısı (TS EN ISO 20345 SRC)", "Mutfak önlüğü (sıvı geçirmez)", "Saç bonesi/kep", "Yüz siperliği (kızartma işlerinde)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Yağ yangınında F sınıfı söndürücü veya yangın battaniyesi kullanın, asla su dökmeyin.", "Gaz kaçağında vanaları kapatın, kıvılcım üretmeden havalandırın, alanı tahliye edin.", "Yanık durumunda 15 dakika soğuk su, ciddi ise 112 arayın.", "Buharlı yanıkta etkilenen alanı kapatmayın, sağlık birimine gidin."] },
];

const yaziciFotokopiInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Cihaz havalandırılmış bölgede konumlandırılmış olmalıdır.", "Elektrik bağlantısı topraklı prize yapılmış olmalıdır.", "Toner dolumu ventilasyonlu ortamda yapılmalıdır.", "Kağıt stoku yanıcı malzemelerden uzakta depolanmalıdır.", "Cihaz periyodik bakımı (yıllık) yapılmış olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Kağıt sıkışmasında önce cihazı kapatıp soğumasını bekleyin.", "Toner değişimini eldiven ve maske ile yapın.", "Büyük baskı işlerinde arada havalandırma yapın.", "Yüksek voltajlı parçalara (fuser ünitesi) sıcakken dokunmayın.", "Kullanılmayan zamanlarda enerji tasarrufu moduna alın."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Cihaz kapağı açıkken yazdırmak/kopyalamak yasaktır.", "Islak elle cihaza müdahale etmek yasaktır.", "Toner tozunu çöpe dökmek veya üflemek yasaktır.", "Hasarlı/erimiş kağıdı makineden zorla çekmek yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Toner değişiminde nitril eldiven", "FFP2 maske (toner dolumunda)", "Koruyucu gözlük (toner dolumunda)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Cihaz yangınında fişi çekin, CO2 söndürücü kullanın.", "Toner solunmasında temiz havaya çıkarın, bol su için.", "Yanık durumunda soğuk su uygulayın.", "Elektrik çarpmasında prizden çekin, ilk yardım uygulayın."] },
];

const kaziIsleriInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Kazı planı hazırlanmış ve zemin etüdü yapılmış olmalıdır.", "Yeraltı tesisatları (elektrik, su, gaz, telekom) tespit edilmiş olmalıdır.", "Kazı derinliği 1.5 metre üzerinde ise iksa (şev/palplanş) sistemi projelendirilmelidir.", "Kazı kenarında ağır ekipman, malzeme istiflenmemiş olmalıdır.", "Yağmur sonrası zemin stabilitesi yeniden değerlendirilmelidir."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Kazıya inip çıkmak için güvenli merdiven veya rampa kullanın.", "Kazı kenarından en az 1.5 metre uzakta malzeme istifileyin.", "Kazı kenarına korkuluk veya bariyer yerleştirin.", "İksa sistemini günlük kontrol edin.", "Kazı içinde su birikmesini pompa ile tahliye edin."] },
  { title: "3. YASAKLAR", tone: "red", items: ["İksasız 1.5 metre üzeri kazıda çalışmak yasaktır.", "Kazı kenarına ağır araç/malzeme yerleştirmek yasaktır.", "Kazı çukuruna atlamak/yanlardan kaymak yasaktır.", "Yağmur/sel sırasında kazı içinde kalmak yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Baret (TS EN 397)", "Çelik burunlu ayakkabı (TS EN ISO 20345 S3)", "Reflektörlü yelek (TS EN ISO 20471)", "Mekanik eldiven (TS EN 388)", "Tam vücut emniyet kemeri (2m üzerinde)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Göçük durumunda alanı güvenli hale getirin, kazı ekipmanını durdurun.", "Gömülen kişiyi elle kazarak çıkarmayı deneyin, ağır ekipman dikkatli kullanılmalıdır.", "112 ve AFAD (122) arayın.", "Gaz hattı hasarında alanı tahliye edin, kıvılcım üretmeyin."] },
];

const betonKalıpInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Kalıp sistemi statik hesaba uygun kurulmuş ve kontrol edilmiş olmalıdır.", "Beton pompası ve boru hattı montajı gözden geçirilmiş olmalıdır.", "İskele/platform güvenli, korkuluklu ve yeterli genişlikte olmalıdır.", "Vibratör kablosu ve motoru hasarsız olmalıdır.", "Çalışma alanı düzenli, malzeme istifi uygun olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Beton pompası operatörü ile sürekli telsiz iletişimi kurun.", "Vibratörü betona dikey batırın, yatay sürüklemeyin.", "Kalıp söküm süresine uyun, erken sökmeyin.", "Çimento tozlu ortamda solunum koruma kullanın.", "Döküm sonrası kalıp basıncını kontrol edin, şişme durumunda güçlendirin."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Pompa borusu altında durmak/çalışmak yasaktır.", "Kalıp desteklerini yetkisiz sökmek yasaktır.", "Islak beton ile korumasız temas yasaktır (alkalı yanık).", "İskele olmadan yüksekte kalıp çalışması yapmak yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Baret (TS EN 397)", "Su geçirmez çizme (TS EN ISO 20345 S5)", "Alkali dirençli eldiven (TS EN 374)", "Koruyucu gözlük (TS EN 166)", "FFP2 toz maskesi (çimento tozu)", "Reflektörlü yelek (TS EN ISO 20471)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Çimento yanığında (alkali) 15 dakika bol su ile yıkayın.", "Pompa borusu patlamasında alanı tahliye edin.", "Kalıp çökmesinde altında kalan kişiyi hareket ettirmeyin, 112 arayın.", "Göze çimento sıçramasında göz duşunu 15 dakika kullanın."] },
];

const temizlikHijyenInstructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
  { title: "1. HAZIRLIK", tone: "green", items: ["Temizlik malzemelerinin SDS/MSDS bilgileri bilinmelidir.", "Kimyasallar karıştırılmamalı, dozaj talimatlarına uyulmalıdır.", "Sıvı dökülen alanlara \"Islak Zemin\" tabelası konulmalıdır.", "Çöp konteynerleri renk kodlu (geri dönüşüm/organik/tehlikeli) ayrılmış olmalıdır.", "El yıkama istasyonları sabun ve dezenfektan ile donatılmış olmalıdır."] },
  { title: "2. OPERASYON", tone: "blue", items: ["Günlük temizlik programına uygun çalışın.", "Temizlik sırasında alanı uyarı tabelaları ile işaretleyin.", "Kimyasal temizlik malzemelerini sulandırarak kullanın.", "Islak silme sonrası zeminin kurumasını sağlayın.", "Bulaşıcı atıkları (eldiven, maske) özel tıbbi atık kutusuna atın.", "Klozet/lavabo temizliğinde ayrı bezler kullanın."] },
  { title: "3. YASAKLAR", tone: "red", items: ["Çamaşır suyu ve amonyak gibi kimyasalları karıştırmak yasaktır.", "Eldivensiz kimyasal temizlik malzemesi kullanmak yasaktır.", "Temizlik malzemelerini gıda alanlarında bırakmak yasaktır.", "Islak zemin tabelası koymadan ıslak zemin bırakmak yasaktır."] },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow", items: ["Kimyasal eldiven (Nitril, TS EN 374)", "Kaymaz iş ayakkabısı (TS EN ISO 20345 SRC)", "Koruyucu gözlük (sıçrama riski olan işlerde)", "FFP2 maske (toz/aerosol temizliğinde)", "Önlük (sıvı geçirmez)"] },
  { title: "5. ACİL DURUM", tone: "purple", items: ["Kimyasal karışım nedeniyle zehirli gaz çıkarsa alanı havalandırın, tahliye edin.", "Cilde kimyasal temas halinde 15 dakika su ile yıkayın.", "Kayma düşme durumunda hareket etmeden yardım çağırın.", "Nefes darlığı/tahriş durumunda temiz havaya çıkarın, 112 arayın."] },
];

const makeTemplate = (
  id: string,
  title: string,
  category: InstructionCategory,
  description: string,
  tags: string[],
  requiredPpe: string[],
  risks: string[],
  steps: string[],
  emergencyNotes: string[],
): WorkInstructionTemplate => ({
  id,
  title,
  category,
  description,
  tags,
  requiredPpe,
  risks,
  steps,
  emergencyNotes,
  legalNotes: defaultLegalNotes,
  updatedAt: "2026-05-14",
});

const visibleTemplateIds = new Set([
  "forklift",
  "torna",
  "hidrolik-pres",
  "taslama",
  "matkap",
  "kimyasal-depolama",
  "elektrik-panosu",
  "yuksekte-calisma",
  "kapali-alan",
  "oksijen-asetilen",
  "transpalet",
  "mutfak-bicak-kesim",
  "ofis-ekran-onu",
  "cephe-iskelesi",
  "el-aletleri-genel",
  "genel-isyeri-isg",
  "cnc-freze-detayli",
  "koprulu-gezer-vinc",
  "kompresor-detayli",
  "serit-daire-testere",
  "elektrikli-kirici-delici",
  "boya-cila-uygulama",
  "asbest-ile-calisma",
  "jenerator-kullanma",
  "kablo-doseme-baglanti",
  "cati-uzerinde-calisma",
  "portatif-merdiven",
  "silo-tank-ici-temizlik",
  "elektrik-ark-kaynagi",
  "reach-truck",
  "depo-raf-sistemleri",
  "endustriyel-firin-ocak",
  "yazici-fotokopi-guvenlik",
  "kazi-isleri-guvenlik",
  "beton-dokum-kalip",
  "isyeri-temizlik-hijyen",
]);

const templates: WorkInstructionTemplate[] = [
  {
    ...makeTemplate(
      "forklift",
      "Forklift Kullanma Talimatı",
      "İş Makineleri",
      "Forklift kullanımı için hazırlık, operasyon kuralları, yasaklar, KKD ve acil durum adımlarını kapsayan detaylı İSG talimatıdır.",
      ["forklift", "istif", "trafik", "operatör", "G sınıfı", "TS ISO 3691-1"],
      forkliftInstructionSections[3].items,
      ["Devrilme", "Ezilme", "Çarpışma", "Yük düşmesi", "Akü asidi", "LPG kaçağı"],
      [...forkliftInstructionSections[0].items, ...forkliftInstructionSections[1].items, ...forkliftInstructionSections[2].items],
      forkliftInstructionSections[4].items,
    ),
    instructionSections: forkliftInstructionSections,
  },
  {
    ...makeTemplate(
      "torna",
      "Torna Tezgahı Kullanma Talimatı",
      "İş Makineleri",
      "Torna tezgahında talaşlı imalat sırasında kapma, fırlama, kesilme, talaş sıçraması ve yangın risklerini azaltmak için uygulanır.",
      ["torna", "talaşlı imalat", "makine koruyucu", "chuck guard", "LOTO", "lunet"],
      tornaInstructionSections[3].items,
      ["Dönen aksama kapılma", "Talaş sıçraması", "Kesici takım kırılması", "Parça fırlaması", "Soğutma sıvısı maruziyeti", "Metal yangını"],
      [...tornaInstructionSections[0].items, ...tornaInstructionSections[1].items, ...tornaInstructionSections[2].items],
      tornaInstructionSections[4].items,
    ),
    instructionSections: tornaInstructionSections,
  },
  {
    ...makeTemplate(
      "hidrolik-pres",
      "Hidrolik Pres Makinesi Talimatı",
      "İş Makineleri",
      "Hidrolik preslerde ezilme, sıkışma, hidrolik sızıntı, kalıp güvenliği ve acil müdahale risklerini kontrol altına alan çalışma talimatıdır.",
      ["pres", "hidrolik", "sıkışma", "ışık perdesi", "iki el kumanda", "LOTO", "TS EN ISO 16092"],
      hidrolikPresInstructionSections[3].items,
      ["El/parmak sıkışması", "Koç altında ezilme", "Hidrolik yağ sızıntısı", "Kalıp kırılması", "Işık perdesi by-pass riski", "Hidrolik yağ yangını"],
      [...hidrolikPresInstructionSections[0].items, ...hidrolikPresInstructionSections[1].items, ...hidrolikPresInstructionSections[2].items],
      hidrolikPresInstructionSections[4].items,
    ),
    instructionSections: hidrolikPresInstructionSections,
  },
  {
    ...makeTemplate(
      "taslama",
      "Spiral (Avuç İçi) Taşlama Makinesi Talimatı",
      "El Aletleri",
      "Spiral taşlama ve kesme işlemlerinde disk patlaması, kıvılcım yangını, geri tepme, titreşim ve toz maruziyeti risklerini azaltmak için uygulanır.",
      ["spiral", "avuç içi taşlama", "disk", "kıvılcım", "hot work", "kickback", "titreşim"],
      spiralTaslamaInstructionSections[3].items,
      ["Disk patlaması", "Kıvılcım yangını", "Geri tepme", "Elektrik çarpması", "Titreşim maruziyeti", "Silika tozu", "Gürültü"],
      [...spiralTaslamaInstructionSections[0].items, ...spiralTaslamaInstructionSections[1].items, ...spiralTaslamaInstructionSections[2].items],
      spiralTaslamaInstructionSections[4].items,
    ),
    instructionSections: spiralTaslamaInstructionSections,
  },
  {
    ...makeTemplate(
      "matkap",
      "Sütunlu/El Matkap Kullanma Talimatı",
      "El Aletleri",
      "Sütunlu ve el matkaplarında parça sabitleme, delme, talaş temizliği, elektrik güvenliği ve acil müdahale esaslarını belirler.",
      ["matkap", "sütunlu matkap", "el matkabı", "delme", "talaş", "chuck key", "kaçak akım"],
      matkapInstructionSections[3].items,
      ["Talaş sıçraması", "Parça dönmesi", "Matkap ucu kırılması", "Kapma/sıkışma", "Elektrik çarpması", "Yangın"],
      [...matkapInstructionSections[0].items, ...matkapInstructionSections[1].items, ...matkapInstructionSections[2].items],
      matkapInstructionSections[4].items,
    ),
    instructionSections: matkapInstructionSections,
  },
  {
    ...makeTemplate(
      "kimyasal-depolama",
      "Kimyasal Madde Depolama ve Kullanma Talimatı",
      "Kimyasal Madde",
      "Kimyasalların SDS/MSDS, CLP/GHS etiketleme, uyumsuz depolama, maruziyet ve acil müdahale kurallarına uygun depolanması ve kullanılması için hazırlanmıştır.",
      ["kimyasal", "SDS", "MSDS", "CLP", "GHS", "depolama", "TWA", "STEL", "UZEM"],
      kimyasalDepolamaInstructionSections[3].items,
      ["Kimyasal sıçrama", "Solunum maruziyeti", "Uyumsuz reaksiyon", "Yangın/patlama", "VOC maruziyeti", "CMR kimyasal riski"],
      [...kimyasalDepolamaInstructionSections[0].items, ...kimyasalDepolamaInstructionSections[1].items, ...kimyasalDepolamaInstructionSections[2].items],
      kimyasalDepolamaInstructionSections[4].items,
    ),
    instructionSections: kimyasalDepolamaInstructionSections,
  },
  {
    ...makeTemplate(
      "elektrik-panosu",
      "Elektrik Panosunda Çalışma Talimatı",
      "Elektrik İşleri",
      "Elektrik panolarında yetkili personel tarafından LOTO, sıfır gerilim doğrulaması, ark flaş ve acil müdahale esaslarına uygun güvenli çalışma yapılmasını sağlar.",
      ["elektrik", "pano", "LOTO", "gerilim", "ark flaş", "TS EN 50110-1", "beş altın kural"],
      elektrikPanosuInstructionSections[3].items,
      ["Elektrik çarpması", "Ark flaş", "Yanık", "Yangın", "Yüksek gerilim yaklaşma riski", "Yetkisiz enerji verme"],
      [...elektrikPanosuInstructionSections[0].items, ...elektrikPanosuInstructionSections[1].items, ...elektrikPanosuInstructionSections[2].items],
      elektrikPanosuInstructionSections[4].items,
    ),
    instructionSections: elektrikPanosuInstructionSections,
  },
  {
    ...makeTemplate(
      "yuksekte-calisma",
      "Yüksekte Çalışma Talimatı",
      "Yüksekte Çalışma",
      "Düşme riskinin bulunduğu tüm yüksekte çalışma faaliyetleri için eğitim, iş izni, ankraj, kurtarma planı ve KKD esaslarını tanımlar.",
      ["yüksekte çalışma", "düşme", "ankraj", "iskele", "fall arrest", "lanyard", "kurtarma planı"],
      yuksekteCalismaInstructionSections[3].items,
      ["Düşme", "Askıda kalma travması", "Malzeme düşmesi", "Ankraj yetersizliği", "Hava koşulları", "Elektrik hattına yaklaşma"],
      [...yuksekteCalismaInstructionSections[0].items, ...yuksekteCalismaInstructionSections[1].items, ...yuksekteCalismaInstructionSections[2].items],
      yuksekteCalismaInstructionSections[4].items,
    ),
    instructionSections: yuksekteCalismaInstructionSections,
  },
  {
    ...makeTemplate(
      "kapali-alan",
      "Kapalı Alanda Çalışma Talimatı",
      "Kapalı Alan",
      "Tank, silo, kuyu ve benzeri kapalı alanlarda izinli giriş, atmosfer ölçümü, gözcü, havalandırma ve kurtarma kurallarını içerir.",
      ["kapalı alan", "confined space", "gaz ölçümü", "permit", "gözcü", "tripod", "SCBA", "LOTO"],
      kapaliAlanInstructionSections[3].items,
      ["Oksijen yetersizliği", "H2S/CO maruziyeti", "Patlayıcı atmosfer", "Kurtarma güçlüğü", "Boğulma", "CO birikimi"],
      [...kapaliAlanInstructionSections[0].items, ...kapaliAlanInstructionSections[1].items, ...kapaliAlanInstructionSections[2].items],
      kapaliAlanInstructionSections[4].items,
    ),
    instructionSections: kapaliAlanInstructionSections,
  },
  makeTemplate("kaynak-kesme", "Kaynak ve Kesme İşleri Talimatı", "Kaynak ve Kesme", "Sıcak çalışma, kaynak ve kesme faaliyetlerinde yangın, ışın ve duman risklerini kontrol eder.", ["kaynak", "sıcak çalışma", "yangın", "duman"], ["Kaynak maskesi", "Deri eldiven", "Kaynak önlüğü", "Solunum koruyucu"], ["Yangın", "UV ışını", "Duman inhalasyonu", "Yanık", "Gaz tüpü riski"], ["Sıcak çalışma izni alınır.", "Yanıcı malzemeler uzaklaştırılır veya örtülür.", "Yangın söndürücü hazır bulundurulur.", "Gaz hortumları ve regülatörler kontrol edilir.", "Havalandırma sağlanır."], ["Yangın nöbetçisi gerekli süre izleme yapar.", "Yanıkta soğuk su uygulaması ve sağlık desteği sağlanır.", "Gaz kaçağında vanalar kapatılır ve alan havalandırılır."]),
  makeTemplate("elle-tasima", "Elle Taşıma Talimatı", "Taşıma & Depolama", "Elle kaldırma ve taşıma sırasında kas-iskelet sistemi yaralanmalarını önlemeye yöneliktir.", ["elle taşıma", "ergonomi", "yük"], ["İş ayakkabısı", "Kesilmeye dayanıklı eldiven", "Bel desteği gerektiğinde"], ["Bel incinmesi", "Ezilme", "Kayma/düşme", "Kesilme"], ["Yük ağırlığı ve tutma noktaları değerlendirilir.", "Yük vücuda yakın tutulur.", "Dizler bükülerek kaldırma yapılır.", "Dönüşler belden değil ayaklarla yapılır.", "Ağır/şekilsiz yüklerde yardım veya ekipman kullanılır."], ["İncinme durumunda çalışma durdurulur.", "Düşen yük alanı emniyete alınır.", "Yaralanma amire ve sağlık birimine bildirilir."]),
  {
    ...makeTemplate(
      "transpalet",
      "Manuel Transpalet Kullanma Talimatı",
      "Taşıma & Depolama",
      "Manuel transpalet ile yük taşıma, ergonomik elleçleme, rampada hareket, park ve acil müdahale kurallarını açıklar.",
      ["transpalet", "manuel transpalet", "depo", "yük taşıma", "ergonomi", "NIOSH", "hidrolik"],
      manuelTranspaletInstructionSections[3].items,
      ["Ayak ezilmesi", "Yük devrilmesi", "Bel/sırt incinmesi", "Hidrolik kaçak", "Kayma/düşme", "Çarpma/sıkışma"],
      [...manuelTranspaletInstructionSections[0].items, ...manuelTranspaletInstructionSections[1].items, ...manuelTranspaletInstructionSections[2].items],
      manuelTranspaletInstructionSections[4].items,
    ),
    instructionSections: manuelTranspaletInstructionSections,
  },
  makeTemplate("merdiven", "Merdiven Kullanma Talimatı", "Yüksekte Çalışma", "Portatif merdivenlerde düşme ve kayma risklerini azaltan güvenli kullanım kurallarını içerir.", ["merdiven", "portatif", "düşme"], ["Baret", "Kaymaz ayakkabı", "Emniyet kemeri gerektiğinde"], ["Düşme", "Merdiven kayması", "Malzeme düşmesi"], ["Merdiven sağlam, temiz ve hasarsız olmalıdır.", "4'e 1 açı kuralı uygulanır.", "Üst/alt noktalar sabitlenir.", "Üç nokta temas kuralı korunur.", "En üst basamakta çalışma yapılmaz."], ["Düşme halinde kişi hareket ettirilmeden sağlık ekibi çağrılır.", "Hasarlı merdiven kullanım dışı bırakılır.", "Alan bariyerlenir."]),
  makeTemplate("kompresor", "Kompresör Kullanma Talimatı", "İş Makineleri", "Basınçlı hava kompresörlerinde patlama, gürültü ve hortum risklerini kontrol eder.", ["kompresör", "basınçlı hava", "hortum"], ["Kulaklık", "Koruyucu gözlük", "İş ayakkabısı"], ["Basınç patlaması", "Hortum savrulması", "Gürültü", "Sıcak yüzey"], ["Emniyet ventili ve manometre kontrol edilir.", "Hortum bağlantıları sağlamlaştırılır.", "Basınç ayarı yetkisiz değiştirilmez.", "Hava insan vücuduna tutulmaz.", "Bakım öncesi basınç boşaltılır."], ["Hortum patlamasında enerji kesilir.", "Basınçlı kap hasarında alan boşaltılır.", "Yanık/yaralanmada ilk yardım uygulanır."]),
  makeTemplate("vinc-caraskal", "Vinç / Caraskal Kullanma Talimatı", "İş Makineleri", "Kaldırma ekipmanlarında yük bağlantısı, manevra ve iletişim kurallarını tanımlar.", ["vinç", "caraskal", "kaldırma", "sapan"], ["Baret", "İş ayakkabısı", "Eldiven", "Reflektif yelek"], ["Yük düşmesi", "Sapan kopması", "Ezilme", "Salınım"], ["Kaldırma ekipmanı periyodik kontrolü doğrulanır.", "Sapan ve kanca hasarı kontrol edilir.", "Yük altında durulmaz.", "Tek işaretçi ile iletişim sağlanır.", "Yük yavaş ve kontrollü kaldırılır."], ["Yük düşerse alan kapatılır.", "Sapan/kanca arızası etiketlenerek kullanım dışı bırakılır.", "Yaralanmada acil ekip çağrılır."]),
  makeTemplate("gida-hijyen", "Gıda Hazırlık Alanı Hijyen Talimatı", "Mutfak & Yemekhane", "Mutfak ve yemekhane alanlarında hijyen, çapraz bulaşma ve kesici alet güvenliği kurallarını tanımlar.", ["hijyen", "gıda", "mutfak", "bulaşma"], ["Bone", "Önlük", "Tek kullanımlık eldiven", "Kaymaz ayakkabı"], ["Kesilme", "Yanık", "Çapraz bulaşma", "Kayma/düşme"], ["El hijyeni ve kişisel temizlik sağlanır.", "Çiğ ve pişmiş ürünler ayrı ekipmanla işlenir.", "Kesici aletler güvenli yerde tutulur.", "Zemin döküntüleri hemen temizlenir.", "Soğuk zincir ve sıcaklık kayıtları takip edilir."], ["Kesiklerde gıda temas alanı temizlenir ve ilk yardım uygulanır.", "Gıda zehirlenmesi şüphesinde ürün ayrılır.", "Yangın/yanıkta uygun acil prosedür uygulanır."]),
  makeTemplate("ofis-ergonomi", "Ofis Ergonomi Talimatı", "Ofis & Ergonomi", "Ofis çalışanlarında duruş, ekran kullanımı ve kas-iskelet zorlanmalarını azaltmak için uygulanır.", ["ofis", "ergonomi", "ekran", "duruş"], ["Ergonomik sandalye", "Ekran yükseltici", "Bilek desteği gerektiğinde"], ["Boyun-bel ağrısı", "Göz yorgunluğu", "Tekrarlayan zorlanma"], ["Ekran göz hizasına ve uygun mesafeye ayarlanır.", "Ayaklar zemine tam basar.", "Klavye/fare omuzları zorlamayacak konumda tutulur.", "Düzenli mikro molalar verilir.", "Kablolar takılma riski oluşturmayacak şekilde düzenlenir."], ["Ağrı ve uyuşma belirtileri amire bildirilir.", "Düşme/takılma olayında alan düzeltilir.", "Elektrik ekipmanı arızasında fiş çekilir."]),
  makeTemplate("akulu-istif", "Akülü İstif Makinesi Talimatı", "İş Makineleri", "Akülü istifleyici ile dar depo alanlarında güvenli yük kaldırma ve taşıma kurallarını belirler.", ["istifleyici", "akü", "depo"], ["İş ayakkabısı", "Reflektif yelek", "Eldiven"], ["Devrilme", "Ayak ezilmesi", "Akü asidi", "Yük düşmesi"], ["Akü şarj seviyesi ve acil stop kontrol edilir.", "Yük kapasite etiketine uygun alınır.", "Çatal altında kişi bulunmaz.", "Dönüşlerde hız düşürülür.", "Şarj alanında havalandırma sağlanır."], ["Akü sızıntısında kimyasal prosedür uygulanır.", "Yük düşmesinde alan kapatılır.", "Arıza bakım ekibine bildirilir."]),
  makeTemplate("daire-testere", "Daire Testere Kullanma Talimatı", "El Aletleri", "Daire testere ile kesim faaliyetlerinde kesilme ve geri tepme risklerini azaltır.", ["testere", "kesim", "geri tepme"], ["Koruyucu gözlük", "Kulaklık", "Toz maskesi", "Eldiven"], ["Kesilme", "Geri tepme", "Talaş/toz", "Gürültü"], ["Muhafaza ve bıçak sağlamlığı kontrol edilir.", "Kesilecek parça sabitlenir.", "El kesim hattından uzak tutulur.", "Bıçak tam devrine ulaşmadan kesime başlanmaz.", "Makine durmadan parça alınmaz."], ["Kesilmede kanama kontrolü ve sağlık desteği sağlanır.", "Bıçak kırılmasında makine durdurulur.", "Toz yoğunluğunda havalandırma artırılır."]),
  makeTemplate("boya-isleri", "Boya ve Solvent Kullanma Talimatı", "Kimyasal Madde", "Boya, tiner ve solvent kullanımlarında yanıcılık ve solunum maruziyetini kontrol eder.", ["boya", "solvent", "yanıcı", "havalandırma"], ["Organik buhar maskesi", "Nitril eldiven", "Gözlük", "Antistatik ayakkabı"], ["Yangın", "Patlayıcı atmosfer", "Solunum maruziyeti", "Cilt teması"], ["SDS ve etiket bilgileri kontrol edilir.", "Alan havalandırılır.", "Ateş ve kıvılcım kaynakları uzaklaştırılır.", "Kaplar açık bırakılmaz.", "Atık bezler kapalı metal kutuda toplanır."], ["Solvent dökülmesinde alan havalandırılır.", "Yangında köpük/CO2/kuru kimyevi toz kullanılır.", "Soluma etkisinde kişi temiz havaya çıkarılır."]),
  makeTemplate("akumulator-sarj", "Akü Şarj Alanı Talimatı", "Elektrik İşleri", "Akü şarj alanlarında hidrojen gazı, asit ve elektrik risklerini kontrol eder.", ["akü", "şarj", "hidrojen", "asit"], ["Yüz siperi", "Asit eldiveni", "Önlük", "Göz duşu erişimi"], ["Patlama", "Asit yanığı", "Elektrik çarpması"], ["Şarj alanı havalandırılır.", "Sigara ve açık alev yasaktır.", "Kutup başları doğru bağlanır.", "Asit dökülme kiti hazırdır.", "Şarj cihazı kabloları hasarsız olmalıdır."], ["Asit temasında bol suyla yıkama yapılır.", "Gaz kokusu/şüphede alan boşaltılır.", "Elektrik arızasında enerji kesilir."]),
  makeTemplate("iskele", "İskele Üzerinde Çalışma Talimatı", "Yüksekte Çalışma", "İskele üzerinde çalışma, erişim ve malzeme kullanımında düşme risklerini azaltır.", ["iskele", "platform", "düşme"], ["Baret", "Kaymaz ayakkabı", "Emniyet kemeri gerektiğinde"], ["Düşme", "İskele çökmesi", "Malzeme düşmesi"], ["İskele etiket durumu kontrol edilir.", "Korkuluk, topuk levhası ve platform bütünlüğü doğrulanır.", "Merdiven dışı tırmanma yapılmaz.", "Platform aşırı yüklenmez.", "Alt alan uyarı ile çevrilir."], ["İskele hasarında kullanım durdurulur.", "Düşme olayında kurtarma planı uygulanır.", "Malzeme düşmesinde alan kapatılır."]),
  makeTemplate("silo", "Silo ve Tank Giriş Talimatı", "Kapalı Alan", "Silo/tank girişlerinde kapalı alan, göçük ve atmosfer risklerini yönetir.", ["silo", "tank", "kapalı alan", "gözcü"], ["Gaz ölçüm cihazı", "Emniyet kemeri", "Solunum koruyucu", "Baret"], ["Boğulma", "Gömülme", "Toksik gaz", "Patlayıcı atmosfer"], ["Ürün boşaltma ve enerji izolasyonu yapılır.", "Kapalı alan izni ve gaz ölçümü tamamlanır.", "Gözcü ve kurtarma ekipmanı hazırdır.", "Havalandırma süreklidir.", "İletişim yöntemi belirlenir."], ["Göçük/gömülme halinde ekipmanla kurtarma yapılır.", "Gaz alarmında giriş iptal edilir.", "Acil ekipler çağrılır."]),
  {
    ...makeTemplate(
      "oksijen-asetilen",
      "Oksijen-Asetilen Kaynak/Kesme Talimatı",
      "Kaynak ve Kesme",
      "Oksijen-asetilen kaynak ve kesme işlerinde sıcak iş izni, tüp güvenliği, geri tepme önleme, yangın nöbeti, duman maruziyeti ve acil müdahale kurallarını belirler.",
      ["oksijen", "asetilen", "kaynak", "kesme", "sıcak iş", "flashback arrestor", "fire watch", "PAPR"],
      oksijenAsetilenInstructionSections[3].items,
      ["Geri tepme alevi", "Tüp patlaması", "Yangın", "Asetilen tüpü ısınması", "Metal dumanı maruziyeti", "Ark gözü", "Yanık"],
      [...oksijenAsetilenInstructionSections[0].items, ...oksijenAsetilenInstructionSections[1].items, ...oksijenAsetilenInstructionSections[2].items],
      oksijenAsetilenInstructionSections[4].items,
    ),
    instructionSections: oksijenAsetilenInstructionSections,
  },
  makeTemplate("raf-depolama", "Raflı Depolama Talimatı", "Taşıma & Depolama", "Depo raflarında yük yerleştirme, kapasite ve istif güvenliği kurallarını tanımlar.", ["raf", "depo", "istif", "yük"], ["İş ayakkabısı", "Eldiven", "Reflektif yelek"], ["Raf devrilmesi", "Yük düşmesi", "Ezilme"], ["Raf kapasite etiketi kontrol edilir.", "Ağır yükler alt seviyelere yerleştirilir.", "Hasarlı palet kullanılmaz.", "Koridorlar açık tutulur.", "Raf hasarı hemen raporlanır."], ["Raf çarpması/hasarında alan kapatılır.", "Düşen yük elle tutulmaya çalışılmaz.", "Yaralanmada ilk yardım çağrılır."]),
  makeTemplate("bicak-kullanimi", "Mutfakta Bıçak Kullanma Talimatı", "Mutfak & Yemekhane", "Gıda hazırlık alanlarında kesici alet kullanımı ve saklama güvenliği için uygulanır.", ["bıçak", "mutfak", "kesici alet"], ["Kesilmeye dayanıklı eldiven", "Önlük", "Kaymaz ayakkabı"], ["Kesilme", "Çapraz bulaşma", "Kayma/düşme"], ["Bıçaklar keskin ve sapı sağlam olmalıdır.", "Kesme tahtası kaymayacak şekilde sabitlenir.", "Bıçak elde taşınırken uç aşağı bakar.", "Kirli/temiz ekipman ayrımı yapılır.", "Bıçaklar lavaboda bekletilmez."], ["Kesikte kanama durdurulur ve yara kapatılır.", "Kan bulaşan yüzeyler dezenfekte edilir.", "Derin kesikte sağlık kuruluşuna başvurulur."]),
  makeTemplate("ekranli-arac", "Ekranlı Araçlarla Çalışma Talimatı", "Ofis & Ergonomi", "Bilgisayar ve ekranlı araç kullanan çalışanlarda göz, duruş ve mola düzenini tanımlar.", ["ekran", "bilgisayar", "mola", "göz"], ["Ayarlanabilir sandalye", "Ekran filtresi gerektiğinde", "Aydınlatma düzeni"], ["Göz yorgunluğu", "Boyun ağrısı", "Karpal tünel riski"], ["Ekran yansıma yapmayacak konumda ayarlanır.", "Göz-ekran mesafesi yaklaşık 50-70 cm tutulur.", "20-20-20 mola prensibi uygulanır.", "Bilekler nötr pozisyonda tutulur.", "Aydınlatma göz kamaştırmayacak seviyede olmalıdır."], ["Görme bulanıklığı veya ağrı süreklilik gösterirse işyeri hekimine başvurulur.", "Elektrik arızasında ekipman kullanılmaz.", "Takılma riski oluşturan kablolar düzenlenir."]),
  makeTemplate("jenerator", "Jeneratör Kullanma Talimatı", "İş Makineleri", "Jeneratör devreye alma, yakıt ikmali ve egzoz gazı riskleri için güvenli çalışma sağlar.", ["jeneratör", "yakıt", "egzoz", "enerji"], ["Kulaklık", "Eldiven", "İş ayakkabısı", "Gözlük"], ["Karbonmonoksit", "Yangın", "Elektrik çarpması", "Gürültü"], ["Kapalı alanda jeneratör çalıştırılmaz.", "Yakıt ikmali motor soğukken yapılır.", "Topraklama ve kablo hasarı kontrol edilir.", "Egzoz çıkışı güvenli yöne verilir.", "Yetkisiz müdahale yapılmaz."], ["CO zehirlenmesinde kişi temiz havaya çıkarılır.", "Yakıt yangınında uygun söndürücü kullanılır.", "Elektrik arızasında enerji kesilir."]),
  makeTemplate("tas-motoru", "Sabit Taş Motoru Kullanma Talimatı", "El Aletleri", "Sabit taş motorlarında gözlük, dayama ayarı ve disk güvenliği kurallarını içerir.", ["taş motoru", "zımpara", "kıvılcım"], ["Yüz siperi", "Gözlük", "Kulaklık"], ["Taş patlaması", "Kıvılcım", "Göz yaralanması"], ["Taş çatlak kontrolü yapılır.", "Koruyucu siperlik ayarı kontrol edilir.", "Dayama boşluğu uygun tutulur.", "Yan yüzeyle taşlama yapılmaz.", "Kıvılcım yönü yanıcı malzemeden uzak tutulur."], ["Taş kırılırsa makine durdurulur.", "Göz yaralanmasında acil sağlık desteği alınır.", "Yangın riski için söndürücü hazır tutulur."]),
  makeTemplate("laboratuvar", "Laboratuvar Kimyasal Çalışma Talimatı", "Kimyasal Madde", "Laboratuvarda reaktif hazırlama, deney ve atık yönetiminde güvenli çalışma esaslarını tanımlar.", ["laboratuvar", "reaktif", "atık", "SDS"], ["Laboratuvar önlüğü", "Gözlük", "Nitril eldiven", "Uygun maske"], ["Sıçrama", "Zehirlenme", "Yanık", "Uyumsuz atık"], ["Çeker ocak gerekliliği değerlendirilir.", "Kimyasal isim ve konsantrasyon etiketlenir.", "Pipetleme ağızla yapılmaz.", "Atıklar uygun kapta toplanır.", "Dökülme kiti ve göz duşu yeri bilinir."], ["Sıçramada göz/vücut duşu kullanılır.", "Dökülmede laboratuvar sorumlusu bilgilendirilir.", "Soluma etkisinde temiz havaya çıkılır."]),
  makeTemplate("kilitleme-etiketleme", "Enerji Kesme Kilitleme Etiketleme Talimatı", "Elektrik İşleri", "Bakım-onarım öncesi tehlikeli enerjinin izole edilmesi ve kontrolünü sağlar.", ["LOTO", "kilitleme", "enerji izolasyonu"], ["Kişisel kilit", "Etiket", "İzole eldiven", "Gözlük"], ["Beklenmeyen çalışma", "Elektrik çarpması", "Basınç boşalması", "Sıkışma"], ["Tüm enerji kaynakları belirlenir.", "Enerji kesilir ve kişisel kilit uygulanır.", "Depolanmış enerji boşaltılır.", "Sıfır enerji doğrulaması yapılır.", "İş bitmeden kilit başkası tarafından kaldırılmaz."], ["Beklenmeyen enerji durumunda çalışma durdurulur.", "Kilit ihlali derhal raporlanır.", "Yaralanmada acil müdahale uygulanır."]),
  makeTemplate("catida-calisma", "Çatıda Çalışma Talimatı", "Yüksekte Çalışma", "Çatı üzerinde kırılgan yüzey, kenar ve hava koşulu risklerini yönetir.", ["çatı", "kenar koruma", "yaşam hattı"], ["Baret", "Tam vücut emniyet kemeri", "Kaymaz ayakkabı", "Lanyard"], ["Düşme", "Kırılgan yüzey", "Malzeme düşmesi", "Rüzgar"], ["Çatı erişim izni alınır.", "Kenar koruma veya yaşam hattı kontrol edilir.", "Kırılgan yüzeyler işaretlenir.", "Hava koşulları değerlendirilir.", "Malzeme ve el aletleri sabitlenir."], ["Düşme durumunda kurtarma planı uygulanır.", "Rüzgar artarsa çalışma durdurulur.", "Malzeme düşmesi halinde alt alan kapatılır."]),
  makeTemplate("kanal-cukur", "Kanal / Çukur Çalışma Talimatı", "Kapalı Alan", "Kazı, kanal ve çukur çalışmalarında göçük, düşme ve atmosfer risklerini kontrol eder.", ["kazı", "çukur", "kanal", "göçük"], ["Baret", "Reflektif yelek", "İş ayakkabısı", "Gaz ölçüm cihazı gerektiğinde"], ["Göçük", "Düşme", "Yeraltı hattı teması", "Gaz birikimi"], ["Kazı izni ve altyapı kontrolü yapılır.", "Şev/iksa gerekliliği değerlendirilir.", "Çukur çevresi bariyerlenir.", "Ağır ekipman kenardan uzak tutulur.", "Su ve gaz birikimi kontrol edilir."], ["Göçükte eğitimsiz kurtarma yapılmaz.", "Gaz şüphesinde alan boşaltılır.", "Yeraltı hattı hasarında ilgili birim çağrılır."]),
  makeTemplate("plazma-kesim", "Plazma Kesim Talimatı", "Kaynak ve Kesme", "Plazma kesimde ark, duman, yangın ve elektrik risklerine karşı güvenli çalışma adımlarını içerir.", ["plazma", "kesim", "ark", "duman"], ["Kaynak maskesi", "Deri eldiven", "Önlük", "Solunum koruyucu"], ["Ark ışını", "Duman", "Yanık", "Yangın", "Elektrik çarpması"], ["Topraklama ve kablo bağlantıları kontrol edilir.", "Parça sabitlenir.", "Havalandırma çalıştırılır.", "Yanıcı malzeme uzaklaştırılır.", "Kesim sonrası sıcak parçalar işaretlenir."], ["Yanıkta soğutma ve sağlık desteği sağlanır.", "Duman yoğunluğunda çalışma durdurulur.", "Yangında uygun söndürücü kullanılır."]),
  makeTemplate("paletleme", "Paletleme ve Streçleme Talimatı", "Taşıma & Depolama", "Palet hazırlama, streçleme ve sevkiyat öncesi yük stabilitesi için uygulanır.", ["palet", "streç", "sevkiyat", "depo"], ["Eldiven", "İş ayakkabısı", "Reflektif yelek"], ["Yük devrilmesi", "Kesilme", "Bel zorlanması"], ["Palet sağlamlığı kontrol edilir.", "Yük ağırlığı dengeli dağıtılır.", "Taşma ve sivri çıkıntı bırakılmaz.", "Streç film güvenli tutuşla uygulanır.", "Sevkiyat etiketi görünür olmalıdır."], ["Dengesiz yük sevk edilmez.", "Yük devrilirse alan kapatılır.", "Kesik/ezilmede ilk yardım uygulanır."]),
  makeTemplate("bulasik-makinesi", "Endüstriyel Bulaşık Makinesi Talimatı", "Mutfak & Yemekhane", "Endüstriyel bulaşık makinelerinde sıcak su, kimyasal ve kayma risklerini kontrol eder.", ["bulaşık", "sıcak su", "deterjan", "hijyen"], ["Isıya dayanıklı eldiven", "Önlük", "Kaymaz ayakkabı", "Gözlük gerektiğinde"], ["Yanık", "Kimyasal temas", "Kayma/düşme"], ["Deterjan bağlantıları ve sıcaklık göstergesi kontrol edilir.", "Makine çalışırken kapak zorlanmaz.", "Sıcak buhar yönüne dikkat edilir.", "Zemin kuru tutulur.", "Kimyasal kaplar etiketli tutulur."], ["Kimyasal sıçramada bol suyla yıkama yapılır.", "Yanıkta soğutma uygulanır.", "Makine arızasında enerji kesilir."]),
  makeTemplate("depo-ofis", "Arşiv / Dosya Odası Ergonomi Talimatı", "Ofis & Ergonomi", "Dosya arşivlerinde raf kullanımı, merdiven ve elle taşıma kaynaklı riskleri azaltır.", ["arşiv", "dosya", "raf", "ergonomi"], ["Kaymaz ayakkabı", "Eldiven gerektiğinde", "Basamaklı tabure"], ["Düşme", "Raf devrilmesi", "Bel zorlanması", "Kağıt kesiği"], ["Üst raflara uygun basamakla erişilir.", "Ağır klasörler alt raflara yerleştirilir.", "Raflar duvara sabitlenir.", "Geçiş yolları açık tutulur.", "Toplu taşıma için araba kullanılır."], ["Raf hasarında alan kapatılır.", "Düşme/yaralanmada ilk yardım çağrılır.", "Yoğun tozda havalandırma sağlanır."]),
  makeTemplate("cnc", "CNC Tezgahı Kullanma Talimatı", "İş Makineleri", "CNC tezgahlarında program çalıştırma, kapak güvenliği ve talaş yönetimini düzenler.", ["CNC", "tezgah", "talaş", "otomasyon"], ["Koruyucu gözlük", "İş ayakkabısı", "Dar kollu iş elbisesi"], ["Dönen parça", "Talaş sıçraması", "Kesici takım kırılması", "Sıkışma"], ["Program ve parça bağlama kontrol edilir.", "Kapak emniyetleri devre dışı bırakılmaz.", "İçeri elle müdahale için tezgah tam durdurulur.", "Soğutma sıvısı sızıntısı kontrol edilir.", "Talaş temizliği uygun ekipmanla yapılır."], ["Takım kırılmasında program durdurulur.", "Sızıntıda zemin temizlenir.", "Sıkışma/yaralanmada acil stop kullanılır."]),
  makeTemplate("soguk-hava", "Soğuk Hava Deposu Çalışma Talimatı", "Taşıma & Depolama", "Soğuk hava depolarında düşük sıcaklık, kayma ve yalnız çalışma risklerini yönetir.", ["soğuk hava", "depo", "düşük sıcaklık"], ["Termal kıyafet", "Kaymaz ayakkabı", "Eldiven", "Reflektif yelek"], ["Hipotermi", "Kayma", "Kapıda kalma", "Yük düşmesi"], ["Kapı açma mekanizması kontrol edilir.", "Çalışma süresi ve mola düzeni belirlenir.", "Zemin buzlanması kontrol edilir.", "Yalnız çalışma sınırlandırılır.", "Yük istifleri sağlam olmalıdır."], ["Kapıda kalma alarmı kullanılır.", "Soğuk etkilenmesinde kişi sıcak alana alınır.", "Buzlanma alanı işaretlenir."]),
  {
    ...makeTemplate("mutfak-bicak-kesim", "Mutfak Bıçak ve Kesim Aletleri Talimatı", "Mutfak & Yemekhane", "Mutfak ve yemekhane alanlarında bıçak, dilimleme/kıyma makinesi, HACCP renk kodu, kesilme ve acil müdahale kurallarını tanımlar.", ["bıçak", "kesim", "mutfak", "HACCP", "dilimleme makinesi"], mutfakBicakInstructionSections[3].items, ["Kesilme", "Parmak kopması", "Çapraz kontaminasyon", "Kayma/düşme", "Yağ yangını"], [...mutfakBicakInstructionSections[0].items, ...mutfakBicakInstructionSections[1].items, ...mutfakBicakInstructionSections[2].items], mutfakBicakInstructionSections[4].items),
    instructionSections: mutfakBicakInstructionSections,
  },
  {
    ...makeTemplate("ofis-ekran-onu", "Ofis ve Ekran Önü Çalışma Talimatı", "Ofis & Büro", "Ofis ve ekran önü çalışmalarında ergonomi, elektrik, yangın, tahliye ve acil durum kurallarını tanımlar.", ["ofis", "büro", "ergonomi", "ekran", "20-20-20"], ofisEkranInstructionSections[3].items, ["Boyun-bel ağrısı", "Göz yorgunluğu", "Karpal tünel riski", "Elektrik çarpması", "Takılma/düşme"], [...ofisEkranInstructionSections[0].items, ...ofisEkranInstructionSections[1].items, ...ofisEkranInstructionSections[2].items], ofisEkranInstructionSections[4].items),
    instructionSections: ofisEkranInstructionSections,
  },
  {
    ...makeTemplate("cephe-iskelesi", "Cephe İskelesinde Çalışma Talimatı", "İnşaat & Saha", "Cephe iskelelerinde kurulum, kontrol, etiketleme, çalışma, söküm ve acil müdahale kurallarını tanımlar.", ["cephe iskelesi", "iskele", "scafftag", "TS EN 12810"], cepheIskelesiInstructionSections[3].items, ["Düşme", "İskele yıkılması", "Malzeme düşmesi", "Rüzgar", "Eksik platform"], [...cepheIskelesiInstructionSections[0].items, ...cepheIskelesiInstructionSections[1].items, ...cepheIskelesiInstructionSections[2].items], cepheIskelesiInstructionSections[4].items),
    instructionSections: cepheIskelesiInstructionSections,
  },
  {
    ...makeTemplate("el-aletleri-genel", "El Aletleri (Çekiç, Tornavida, Pense) Talimatı", "El Aletleri", "Çekiç, tornavida, pense ve benzeri el aletlerinde seçim, kullanım, taşıma, yüksekte çalışma ve acil müdahale kurallarını tanımlar.", ["çekiç", "tornavida", "pense", "el aleti", "VDE"], elAletleriInstructionSections[3].items, ["El/parmak ezilmesi", "Göze parça kaçması", "Kesilme", "Alet düşmesi", "ATEX kıvılcım riski"], [...elAletleriInstructionSections[0].items, ...elAletleriInstructionSections[1].items, ...elAletleriInstructionSections[2].items], elAletleriInstructionSections[4].items),
    instructionSections: elAletleriInstructionSections,
  },
  {
    ...makeTemplate("genel-isyeri-isg", "Genel İşyeri İSG Kuralları Talimatı", "Genel İSG", "Tüm çalışanlar için genel iş sağlığı ve güvenliği, eğitim, KKD, bildirim, davranış ve acil durum kurallarını tanımlar.", ["genel İSG", "6331", "KKD", "5S", "BBS", "ramak kala"], genelIsgInstructionSections[3].items, ["İş kazası", "Ramak kala", "Yangın", "Deprem", "Elektrik çarpması", "Kimyasal döküntü"], [...genelIsgInstructionSections[0].items, ...genelIsgInstructionSections[1].items, ...genelIsgInstructionSections[2].items], genelIsgInstructionSections[4].items),
    instructionSections: genelIsgInstructionSections,
  },
  {
    ...makeTemplate("cnc-freze-detayli", "CNC Freze Tezgahı Kullanma Talimatı", "İş Makineleri", "CNC freze tezgahlarında program simülasyonu, takım/ofset, fixture, interlock, talaş ve acil müdahale kurallarını belirler.", ["CNC", "freze", "spindle", "fixture", "feed override", "interlock"], cncFrezeInstructionSections[3].items, ["Takım kırılması", "Makine çarpışması", "Talaş sıçraması", "Kapı interlock iptali", "Yetkisiz parametre değişikliği"], [...cncFrezeInstructionSections[0].items, ...cncFrezeInstructionSections[1].items, ...cncFrezeInstructionSections[2].items], cncFrezeInstructionSections[4].items),
    instructionSections: cncFrezeInstructionSections,
  },
  {
    ...makeTemplate("koprulu-gezer-vinc", "Köprülü/Gezer Vinç Kullanma Talimatı", "İş Makineleri", "Köprülü/gezer vinçlerde yük kaldırma, sapanlama, işaretleme, kapasite ve acil müdahale kurallarını tanımlar.", ["vinç", "köprülü vinç", "gezer vinç", "sapan", "WLL"], kopruluVincInstructionSections[3].items, ["Yük düşmesi", "Sapan kopması", "Ezilme", "Salınım", "Kapasite aşımı"], [...kopruluVincInstructionSections[0].items, ...kopruluVincInstructionSections[1].items, ...kopruluVincInstructionSections[2].items], kopruluVincInstructionSections[4].items),
    instructionSections: kopruluVincInstructionSections,
  },
  {
    ...makeTemplate("kompresor-detayli", "Kompresör Kullanma Talimatı", "İş Makineleri", "Basınçlı hava kompresörlerinde periyodik kontrol, emniyet ventili, drenaj, hortum ve acil müdahale kurallarını belirler.", ["kompresör", "basınçlı hava", "hortum", "emniyet ventili", "drenaj"], kompresorInstructionSections[3].items, ["Basınç patlaması", "Hortum savrulması", "Gürültü", "Elektrik riski", "Gaz kaçağı"], [...kompresorInstructionSections[0].items, ...kompresorInstructionSections[1].items, ...kompresorInstructionSections[2].items], kompresorInstructionSections[4].items),
    instructionSections: kompresorInstructionSections,
  },
  {
    ...makeTemplate("serit-daire-testere", "Şerit/Daire Testere Kullanma Talimatı", "El Aletleri", "Şerit ve daire testere ile kesim faaliyetlerinde bıçak, siperlik, sabitleme, kesilme ve acil müdahale kurallarını belirler.", ["şerit testere", "daire testere", "kesim", "bıçak", "siperlik"], seritDaireTestereInstructionSections[3].items, ["Kesilme", "Bıçak kırılması", "Talaş/toz", "Gürültü", "Parmak kopması"], [...seritDaireTestereInstructionSections[0].items, ...seritDaireTestereInstructionSections[1].items, ...seritDaireTestereInstructionSections[2].items], seritDaireTestereInstructionSections[4].items),
    instructionSections: seritDaireTestereInstructionSections,
  },
  {
    ...makeTemplate("elektrikli-kirici-delici", "Elektrikli Kırıcı/Delici Kullanma Talimatı", "El Aletleri", "Elektrikli kırıcı/delici kullanımında kablo, uç, tesisat taraması, toz, titreşim ve KKD kurallarını belirler.", ["kırıcı", "delici", "titreşim", "silika", "tesisat taraması", "A8"], elektrikliKiriciInstructionSections[3].items, ["Elektrik çarpması", "Silika tozu", "Titreşim maruziyeti", "Gömülü tesisat hasarı", "Uç kırılması"], [...elektrikliKiriciInstructionSections[0].items, ...elektrikliKiriciInstructionSections[1].items, ...elektrikliKiriciInstructionSections[2].items], []),
    instructionSections: elektrikliKiriciInstructionSections,
  },
  {
    ...makeTemplate("boya-cila-uygulama", "Boya ve Cila Uygulama Talimatı", "Kimyasal Madde", "Boya ve cila uygulamalarında VOC, solvent, yanıcı buhar, ATEX, havalandırma ve acil müdahale kurallarını tanımlar.", ["boya", "cila", "solvent", "VOC", "ATEX", "boya kabini"], boyaCilaInstructionSections[3].items, ["Solvent zehirlenmesi", "Yangın/patlama", "VOC maruziyeti", "Kimyasal temas", "Statik elektrik"], [...boyaCilaInstructionSections[0].items, ...boyaCilaInstructionSections[1].items, ...boyaCilaInstructionSections[2].items], boyaCilaInstructionSections[4].items),
    instructionSections: boyaCilaInstructionSections,
  },
  {
    ...makeTemplate("asbest-ile-calisma", "Asbest İle Çalışma Talimatı", "Kimyasal Madde", "Asbest sökümünde negatif basınç, dekontaminasyon, lif ölçümü, atık yönetimi ve kişisel maruziyet kayıtlarını düzenler.", ["asbest", "P3 filtre", "negatif basınç", "dekontaminasyon", "lif ölçümü"], asbestInstructionSections[3].items, ["Asbest lifi solunması", "Kontaminasyon", "Yetkisiz giriş", "Atık yönetimi uygunsuzluğu"], [...asbestInstructionSections[0].items, ...asbestInstructionSections[1].items, ...asbestInstructionSections[2].items], asbestInstructionSections[4].items),
    instructionSections: asbestInstructionSections,
  },
  {
    ...makeTemplate("jenerator-kullanma", "Jeneratör Kullanma Talimatı", "Elektrik İşleri", "Jeneratör kullanımında yakıt, topraklama, egzoz, ATS, CO zehirlenmesi ve elektrik güvenliği kurallarını belirler.", ["jeneratör", "ATS", "topraklama", "CO", "yakıt", "elektrik"], jeneretorInstructionSections[3].items, ["CO zehirlenmesi", "Elektrik çarpması", "Yakıt yangını", "Gürültü", "Yüksek sıcaklık"], [...jeneretorInstructionSections[0].items, ...jeneretorInstructionSections[1].items, ...jeneretorInstructionSections[2].items], jeneretorInstructionSections[4].items),
    instructionSections: jeneretorInstructionSections,
  },
  {
    ...makeTemplate("kablo-doseme-baglanti", "Kablo Döşeme ve Bağlantı Talimatı", "Elektrik İşleri", "Kablo döşeme ve bağlantı işlerinde LOTO, gerilim testi, kablo güzergahı, megger testi ve acil müdahale kurallarını tanımlar.", ["kablo", "LOTO", "megger", "VDE", "enerji kesim", "as-built"], kabloDosemeInstructionSections[3].items, ["Elektrik çarpması", "Ark çakması", "Kablo yangını", "Yetkisiz bağlantı", "Hasarlı kablo"], [...kabloDosemeInstructionSections[0].items, ...kabloDosemeInstructionSections[1].items, ...kabloDosemeInstructionSections[2].items], kabloDosemeInstructionSections[4].items),
    instructionSections: kabloDosemeInstructionSections,
  },
  {
    ...makeTemplate("cati-uzerinde-calisma", "Çatı Üzerinde Çalışma Talimatı", "Yüksekte Çalışma", "Çatı üzerinde çalışmalarda yaşam hattı, ankraj, kırılgan yüzey, hava koşulları ve kurtarma kurallarını belirler.", ["çatı", "yaşam hattı", "ankraj", "kırılgan yüzey", "tool lanyard"], catiCalismaInstructionSections[3].items, ["Düşme", "Askıda kalma", "Çatı çökmesi", "Düşen cisim", "Yıldırım"], [...catiCalismaInstructionSections[0].items, ...catiCalismaInstructionSections[1].items, ...catiCalismaInstructionSections[2].items], catiCalismaInstructionSections[4].items),
    instructionSections: catiCalismaInstructionSections,
  },
  {
    ...makeTemplate("portatif-merdiven", "Portatif Merdiven Kullanma Talimatı", "Yüksekte Çalışma", "Portatif merdiven kullanımında kontrol, 4:1 açısı, 3 nokta teması, elektrik hattı ve düşme risklerini yönetir.", ["merdiven", "portatif merdiven", "4:1", "3 nokta teması", "kaymaz ayak"], portatifMerdivenInstructionSections[3].items, ["Düşme", "Merdiven devrilmesi", "Elektrik hattı teması", "Omurga yaralanması"], [...portatifMerdivenInstructionSections[0].items, ...portatifMerdivenInstructionSections[1].items, ...portatifMerdivenInstructionSections[2].items], portatifMerdivenInstructionSections[4].items),
    instructionSections: portatifMerdivenInstructionSections,
  },
  {
    ...makeTemplate("silo-tank-ici-temizlik", "Silo ve Tank İçi Temizlik Talimatı", "Kapalı Alan", "Silo ve tank içi temizlikte kapalı alan izni, atmosfer ölçümü, LOTO, tripod/winch ve kurtarma kurallarını tanımlar.", ["silo", "tank", "kapalı alan", "tripod", "gaz ölçümü", "LOTO"], siloTankInstructionSections[3].items, ["Oksijen yetersizliği", "Toksik gaz", "Patlama", "Bayılma", "Kimyasal reaksiyon"], [...siloTankInstructionSections[0].items, ...siloTankInstructionSections[1].items, ...siloTankInstructionSections[2].items], siloTankInstructionSections[4].items),
    instructionSections: siloTankInstructionSections,
  },
  {
    ...makeTemplate("elektrik-ark-kaynagi", "Elektrik Ark Kaynağı (MIG/MAG/TIG) Talimatı", "Kaynak ve Kesme", "MIG/MAG/TIG kaynak işlerinde sıcak iş izni, topraklama, duman emişi, ark gözü, yanık ve yangın risklerini yönetir.", ["MIG", "MAG", "TIG", "ark kaynağı", "sıcak iş", "fire watch"], elektrikArkKaynakInstructionSections[3].items, ["Ark gözü", "Yanık", "Elektrik çarpması", "Kaynak dumanı", "Yangın"], [...elektrikArkKaynakInstructionSections[0].items, ...elektrikArkKaynakInstructionSections[1].items, ...elektrikArkKaynakInstructionSections[2].items], elektrikArkKaynakInstructionSections[4].items),
    instructionSections: elektrikArkKaynakInstructionSections,
  },
  {
    ...makeTemplate("reach-truck", "İstif Makinesi (Reach Truck) Kullanma Talimatı", "Taşıma & Depolama", "Reach truck kullanımında operatör yetkinliği, akü, çatal, koridor, raf ve acil müdahale kurallarını tanımlar.", ["reach truck", "istif makinesi", "akü", "raf", "F sınıfı"], reachTruckInstructionSections[3].items, ["Raf devrilmesi", "Yük düşmesi", "Ezilme", "Akü asidi", "Çarpışma"], [...reachTruckInstructionSections[0].items, ...reachTruckInstructionSections[1].items, ...reachTruckInstructionSections[2].items], reachTruckInstructionSections[4].items),
    instructionSections: reachTruckInstructionSections,
  },
  {
    ...makeTemplate("depo-raf-sistemleri", "Depo ve Raf Sistemleri Güvenlik Talimatı", "Taşıma & Depolama", "Depo raf sistemlerinde periyodik kontrol, kapasite etiketi, hasarlı raf, istifleme ve acil durum kurallarını belirler.", ["depo", "raf", "istif", "kapasite etiketi", "impact protection"], depoRafInstructionSections[3].items, ["Raf devrilmesi", "Yük düşmesi", "Kapasite aşımı", "Hasarlı raf", "Geçiş yolu daralması"], [...depoRafInstructionSections[0].items, ...depoRafInstructionSections[1].items, ...depoRafInstructionSections[2].items], depoRafInstructionSections[4].items),
    instructionSections: depoRafInstructionSections,
  },
  {
    ...makeTemplate("endustriyel-firin-ocak", "Endüstriyel Fırın ve Ocak Kullanma Talimatı", "Mutfak & Yemekhane", "Endüstriyel fırın, ocak ve buharlı pişiricilerde gaz, sıcak yüzey, yağ yangını ve yanık risklerini kontrol eder.", ["fırın", "ocak", "gaz", "davlumbaz", "yağ yangını", "mutfak"], endustriyelFirinOcakInstructionSections[3].items, ["Gaz kaçağı", "Yağ yangını", "Yanık", "Buhar yanığı", "Kayma"], [...endustriyelFirinOcakInstructionSections[0].items, ...endustriyelFirinOcakInstructionSections[1].items, ...endustriyelFirinOcakInstructionSections[2].items], endustriyelFirinOcakInstructionSections[4].items),
    instructionSections: endustriyelFirinOcakInstructionSections,
  },
  {
    ...makeTemplate("yazici-fotokopi-guvenlik", "Yazıcı ve Fotokopi Makinesi Güvenlik Talimatı", "Ofis & Büro", "Yazıcı ve fotokopi makinelerinde toner, elektrik, fuser sıcaklığı, havalandırma ve yangın risklerini yönetir.", ["yazıcı", "fotokopi", "toner", "fuser", "ofis"], yaziciFotokopiInstructionSections[3].items, ["Toner solunması", "Elektrik çarpması", "Yanık", "Cihaz yangını", "Kağıt sıkışması"], [...yaziciFotokopiInstructionSections[0].items, ...yaziciFotokopiInstructionSections[1].items, ...yaziciFotokopiInstructionSections[2].items], yaziciFotokopiInstructionSections[4].items),
    instructionSections: yaziciFotokopiInstructionSections,
  },
  {
    ...makeTemplate("kazi-isleri-guvenlik", "Kazı İşleri Güvenlik Talimatı", "İnşaat & Saha", "Kazı işlerinde zemin etüdü, yeraltı tesisatı, iksa, bariyerleme, göçük ve gaz hattı acil durumlarını düzenler.", ["kazı", "iksa", "zemin etüdü", "yeraltı tesisatı", "göçük"], kaziIsleriInstructionSections[3].items, ["Göçük", "Yeraltı tesisatı hasarı", "Düşme", "Gaz kaçağı", "Su baskını"], [...kaziIsleriInstructionSections[0].items, ...kaziIsleriInstructionSections[1].items, ...kaziIsleriInstructionSections[2].items], kaziIsleriInstructionSections[4].items),
    instructionSections: kaziIsleriInstructionSections,
  },
  {
    ...makeTemplate("beton-dokum-kalip", "Beton Döküm ve Kalıp İşleri Talimatı", "İnşaat & Saha", "Beton döküm, kalıp, pompa, vibratör ve çimento temasında çökme, patlama, alkali yanık ve yüksekte çalışma risklerini yönetir.", ["beton", "kalıp", "pompa", "vibratör", "çimento", "alkali yanık"], betonKalıpInstructionSections[3].items, ["Kalıp çökmesi", "Pompa borusu patlaması", "Alkali yanık", "Göze çimento sıçraması", "Yüksekte çalışma"], [...betonKalıpInstructionSections[0].items, ...betonKalıpInstructionSections[1].items, ...betonKalıpInstructionSections[2].items], betonKalıpInstructionSections[4].items),
    instructionSections: betonKalıpInstructionSections,
  },
  {
    ...makeTemplate("isyeri-temizlik-hijyen", "İşyeri Temizlik ve Hijyen Talimatı", "Genel İSG", "İşyeri temizlik ve hijyen süreçlerinde kimyasal karışım, ıslak zemin, atık ayrıştırma ve kişisel koruyucu donanım kurallarını belirler.", ["temizlik", "hijyen", "ıslak zemin", "kimyasal", "SDS", "atık"], temizlikHijyenInstructionSections[3].items, ["Kimyasal temas", "Zehirli gaz", "Kayma/düşme", "Aerosol/toz maruziyeti", "Bulaşıcı atık"], [...temizlikHijyenInstructionSections[0].items, ...temizlikHijyenInstructionSections[1].items, ...temizlikHijyenInstructionSections[2].items], temizlikHijyenInstructionSections[4].items),
    instructionSections: temizlikHijyenInstructionSections,
  },
].filter((template) => visibleTemplateIds.has(template.id));

const emptyInstructionForm: InstructionFormState = {
  title: "",
  category: "",
  description: "",
  tags: "",
  requiredPpe: "",
  risks: "",
  steps: "",
  emergencyNotes: "",
};

const emptyAiForm: AiFormState = {
  workName: "",
  category: "",
  environment: "",
  riskLevel: "Orta",
  requiredPpe: "",
  notes: "",
};

const splitList = (value: string) =>
  value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatDate = (value?: string) => value || new Date().toLocaleDateString("tr-TR");

type ExportSection = {
  title: string;
  items: string[];
  tone: "green" | "blue" | "yellow" | "red" | "purple" | "slate";
};


type Rgb = [number, number, number];

const exportToneColors: Record<ExportSection["tone"], { fill: Rgb; text: Rgb }> = {
  green: { fill: [0, 176, 117], text: [255, 255, 255] },
  blue: { fill: [33, 93, 235], text: [255, 255, 255] },
  yellow: { fill: [230, 128, 0], text: [255, 255, 255] },
  red: { fill: [194, 24, 32], text: [255, 255, 255] },
  purple: { fill: [114, 46, 229], text: [255, 255, 255] },
  slate: { fill: [15, 23, 42], text: [255, 255, 255] },
};

const getInstructionSectionsForExport = (instruction: WorkInstructionTemplate): ExportSection[] => {
  if (instruction.instructionSections?.length) {
    // Burada "as ExportSection[]" ekleyerek tone değerinin uyumlu olduğunu garanti ediyoruz
    return instruction.instructionSections.map((section) => ({
      title: section.title,
      items: section.items,
      tone: (section.tone ?? "slate") as ExportSection["tone"], 
    }));
  }

  // Varsayılan bölümler için tone değerlerini açıkça belirtiyoruz
  return [
    { title: "1. HAZIRLIK", tone: "green" as const, items: instruction.steps.slice(0, 3) },
    { title: "2. OPERASYON KURALLARI", tone: "blue" as const, items: instruction.steps.slice(3) },
    {
      title: "3. YASAKLAR",
      tone: "red" as const,
      items: [
        "Yetkisiz çalışma yapmak yasaktır.",
        "Koruyucuları devre dışı bırakmak yasaktır.",
        "KKD kullanmadan çalışmaya başlamak yasaktır.",
        "Arıza veya uygunsuzluğu bildirmeden çalışmaya devam etmek yasaktır.",
      ],
    },
    { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow" as const, items: instruction.requiredPpe },
    { title: "5. ACİL DURUM", tone: "purple" as const, items: instruction.emergencyNotes },
  ].filter((section) => section.items.length > 0);
};

const getDocumentMeta = (instruction: WorkInstructionTemplate) => ({
  code: instruction.id === "forklift" ? "CT-001" : `CT-${Math.abs(instruction.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 900 + 100}`,
  revision: "00",
  date: formatDate(instruction.updatedAt),
  category: instruction.category,
});

const sanitizeFileName = (value: string) => value.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");

const createInstructionText = (instruction: WorkInstructionTemplate) => {
  if (instruction.instructionSections?.length) {
    return [
      instruction.title,
      "",
      ...instruction.instructionSections.flatMap((section) => [
        section.title,
        ...section.items.map((item, index) => `${index + 1}. ${item}`),
        "",
      ]),
      "REVİZYON BİLGİSİ",
      `Son güncelleme: ${formatDate(instruction.updatedAt)}`,
    ].join("\n");
  }

  const lines = [
    instruction.title,
    "",
    `Kategori: ${instruction.category}`,
    `Açıklama: ${instruction.description}`,
    "",
    "Gerekli KKD:",
    ...instruction.requiredPpe.map((item) => `- ${item}`),
    "",
    "Başlıca Riskler:",
    ...instruction.risks.map((item) => `- ${item}`),
    "",
    "Güvenli Çalışma Adımları:",
    ...instruction.steps.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Acil Durumda Yapılacaklar:",
    ...instruction.emergencyNotes.map((item) => `- ${item}`),
    "",
    "Sorumluluklar:",
    "- Çalışanlar talimata ve amir uyarılarına uymakla sorumludur.",
    "- İşveren/işveren vekili uygun ekipman, eğitim ve gözetimi sağlamakla sorumludur.",
    "- İSG profesyonelleri talimatın güncelliğini takip eder.",
    "",
    "Revizyon Bilgisi:",
    `Son güncelleme: ${formatDate(instruction.updatedAt)}`,
  ];

  return lines.join("\n");
};

const exportInstructionPdf = (instruction: WorkInstructionTemplate) => {
  try {
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const interLoaded = addInterFontsToJsPDF(doc);
    const pdfFontFamily = interLoaded ? "Inter" : "helvetica";
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 28;
    const tableWidth = pageWidth - margin * 2;
    const numberWidth = 22;
    const contentWidth = tableWidth - numberWidth;
    const meta = getDocumentMeta(instruction);
    const sections = getInstructionSectionsForExport(instruction);
    let y = margin;

    const setRgb = (method: "setFillColor" | "setTextColor" | "setDrawColor", color: Rgb) => {
      doc[method](color[0], color[1], color[2]);
    };

    const drawFooter = () => {
      const footerY = pageHeight - 18;
      doc.setFont(pdfFontFamily, "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text("İSG Vizyon | Çalışma Talimatları", margin, footerY);
      doc.text("Bu belge 6331 sayılı İSG Kanunu kapsamında hazırlanmıştır.", pageWidth / 2, footerY, { align: "center" });
      doc.text(`Sayfa ${doc.getNumberOfPages()}`, pageWidth - margin, footerY, { align: "right" });
    };

    const addPageIfNeeded = (neededHeight: number) => {
      if (y + neededHeight <= pageHeight - 95) return;
      drawFooter();
      doc.addPage();
      y = margin;
    };

    const drawHeader = () => {
      doc.setDrawColor(116, 140, 171);
      doc.setLineWidth(0.7);
      doc.rect(margin, y, tableWidth, 54);
      doc.setFillColor(245, 248, 252);
      doc.rect(margin, y, tableWidth * 0.52, 54, "F");
      doc.setFont(pdfFontFamily, "bold");
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text("ÇALIŞMA TALİMATI", margin + tableWidth * 0.26, y + 31, { align: "center" });

      const labelX = margin + tableWidth * 0.52;
      const labelW = 110;
      const valueX = labelX + labelW;
      const rowH = 13.5;
      const rows = [
        ["Belge Kodu", meta.code],
        ["Revizyon No", meta.revision],
        ["Düzenleme Tarihi", meta.date],
        ["Kategori", meta.category],
      ];
      rows.forEach(([label, value], index) => {
        const rowY = y + rowH * index;
        doc.rect(labelX, rowY, labelW, rowH);
        doc.rect(valueX, rowY, tableWidth - tableWidth * 0.52 - labelW, rowH);
        doc.setFontSize(6.5);
        doc.setFont(pdfFontFamily, "bold");
        doc.text(label, labelX + 4, rowY + 9);
        doc.setFont(pdfFontFamily, "normal");
        doc.text(value, valueX + 4, rowY + 9);
      });

      y += 58;
      doc.setFillColor(24, 64, 180);
      doc.rect(margin, y, tableWidth, 16, "F");
      doc.setFont(pdfFontFamily, "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(instruction.title, pageWidth / 2, y + 11, { align: "center" });
      y += 18;
    };

    const drawSection = (section: ExportSection) => {
      const colors = exportToneColors[section.tone];
      addPageIfNeeded(18);
      setRgb("setFillColor", colors.fill);
      doc.rect(margin, y, tableWidth, 14, "F");
      doc.setFont(pdfFontFamily, "bold");
      doc.setFontSize(7.5);
      setRgb("setTextColor", colors.text);
      doc.text(section.title, margin + 5, y + 9.5);
      y += 14;

      section.items.forEach((item, index) => {
        const lines = doc.splitTextToSize(item, contentWidth - 8) as string[];
        const rowHeight = Math.max(12, lines.length * 8.2 + 4);
        addPageIfNeeded(rowHeight);
        doc.setFillColor(index % 2 === 0 ? 248 : 241, index % 2 === 0 ? 251 : 246, index % 2 === 0 ? 255 : 252);
        doc.rect(margin, y, tableWidth, rowHeight, "F");
        doc.setDrawColor(189, 205, 226);
        doc.rect(margin, y, numberWidth, rowHeight);
        doc.rect(margin + numberWidth, y, contentWidth, rowHeight);
        doc.setFont(pdfFontFamily, "bold");
        doc.setFontSize(6.8);
        doc.setTextColor(15, 23, 42);
        doc.text(String(index + 1), margin + numberWidth / 2, y + 8.8, { align: "center" });
        doc.setFont(pdfFontFamily, "normal");
        lines.forEach((line, lineIndex) => {
          doc.text(line, margin + numberWidth + 5, y + 8.8 + lineIndex * 8.2);
        });
        y += rowHeight;
      });
    };

    const drawApproval = () => {
      addPageIfNeeded(128);
      y += 8;
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, tableWidth, 16, "F");
      doc.setFont(pdfFontFamily, "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text("TEBLİĞ VE BEYAN", pageWidth / 2, y + 11, { align: "center" });
      y += 16;
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, tableWidth, 30, "F");
      doc.setDrawColor(148, 163, 184);
      doc.rect(margin, y, tableWidth, 30);
      doc.setFont(pdfFontFamily, "normal");
      doc.setFontSize(6.6);
      doc.setTextColor(15, 23, 42);
      const declaration =
        "Yukarıdaki çalışma talimatını okudum, anladım ve uygulayacağımı taahhüt ederim. 6331 sayılı İSG Kanunu kapsamında imzalı tebliğdir.";
      const declarationLines = doc.splitTextToSize(declaration, tableWidth - 10) as string[];
      declarationLines.forEach((line, index) => doc.text(line, margin + 5, y + 10 + index * 8));
      y += 30;

      const signatureWidths = [tableWidth * 0.42, tableWidth * 0.30, tableWidth * 0.28];
      const headers = ["ONAYLAYAN – Ad Soyad", "İmza", "İŞVEREN / VEKİLİ"];
      let x = margin;
      doc.setFont(pdfFontFamily, "bold");
      doc.setFontSize(6.7);
      headers.forEach((header, index) => {
        doc.rect(x, y, signatureWidths[index], 18);
        doc.text(header, x + signatureWidths[index] / 2, y + 11, { align: "center" });
        x += signatureWidths[index];
      });
      y += 18;
      x = margin;
      signatureWidths.forEach((width, index) => {
        doc.rect(x, y, width, 58);
        if (index === 2) {
          doc.setFont(pdfFontFamily, "normal");
          doc.text("Ad Soyad:", x + 8, y + 15);
          doc.text("İmza:", x + 8, y + 33);
          doc.text("Tarih: ...... / ...... / ........", x + 8, y + 51);
        }
        x += width;
      });
      y += 58;
    };

    drawHeader();
    sections.forEach(drawSection);
    drawApproval();
    drawFooter();
    doc.save(`${sanitizeFileName(instruction.title)}.pdf`);
  } catch (error) {
    console.error("PDF export failed:", error);
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      toast.error("PDF çıktısı için yeni pencere açılamadı.");
      return;
    }
    printWindow.document.write(`<pre>${escapeHtml(createInstructionText(instruction))}</pre>`);
    printWindow.document.close();
    printWindow.print();
  }
};

const exportInstructionWordLegacy = (instruction: WorkInstructionTemplate) => {
  const meta = getDocumentMeta(instruction);
  const sections = getInstructionSectionsForExport(instruction);
  const htmlColor = (color: Rgb) => `rgb(${color[0]},${color[1]},${color[2]})`;
  const sectionRows = sections
    .map((section) => {
      const colors = exportToneColors[section.tone];
      return `
        <tr>
          <td colspan="2" class="section-title" style="background:${htmlColor(colors.fill)};color:${htmlColor(colors.text)};">
            ${escapeHtml(section.title)}
          </td>
        </tr>
        ${section.items
          .map(
            (item, index) => `
              <tr class="${index % 2 === 0 ? "row-even" : "row-odd"}">
                <td class="num">${index + 1}</td>
                <td>${escapeHtml(item)}</td>
              </tr>
            `,
          )
          .join("")}
      `;
    })
    .join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(instruction.title)}</title>
  <style>
    @font-face {
      font-family: 'Inter';
      src: url('/fonts/Inter_18pt-Regular.ttf') format('truetype');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Inter';
      src: url('/fonts/Inter_24pt-Bold.ttf') format('truetype');
      font-weight: 700;
      font-style: normal;
    }
    @page { margin: 18mm 16mm; }
    body { font-family: 'Inter', Arial, sans-serif; color: #0f172a; font-size: 9pt; }
    table { border-collapse: collapse; width: 100%; }
    td { border: 1px solid #9fb3ce; padding: 3px 5px; vertical-align: top; }
    .header-left { width: 52%; height: 56px; background: #f3f6fb; text-align: center; font-size: 18px; font-weight: 700; letter-spacing: .2px; }
    .meta-label { width: 120px; font-size: 8px; font-weight: 700; background: #f8fafc; }
    .meta-value { font-size: 8px; }
    .title-bar { background: #1840b4; color: #fff; font-weight: 700; text-align: center; font-size: 10px; }
    .section-title { font-weight: 700; font-size: 8.5px; }
    .num { width: 24px; text-align: center; font-weight: 700; }
    .row-even td { background: #f8fbff; }
    .row-odd td { background: #f1f6fc; }
    .declaration-title { background: #0f172a; color: #fff; text-align: center; font-weight: 700; }
    .declaration { background: #f8fafc; font-size: 8px; }
    .signature-head { height: 20px; text-align: center; font-size: 8px; font-weight: 700; }
    .signature-cell { height: 64px; font-size: 8px; }
    .footer { margin-top: 22px; display: flex; justify-content: space-between; color: #64748b; font-size: 7px; }
  </style>
</head>
<body>
  <table>
    <tr>
      <td class="header-left" rowspan="4">ÇALIŞMA TALİMATI</td>
      <td class="meta-label">Belge Kodu</td>
      <td class="meta-value">${escapeHtml(meta.code)}</td>
    </tr>
    <tr><td class="meta-label">Revizyon No</td><td class="meta-value">${escapeHtml(meta.revision)}</td></tr>
    <tr><td class="meta-label">Düzenleme Tarihi</td><td class="meta-value">${escapeHtml(meta.date)}</td></tr>
    <tr><td class="meta-label">Kategori</td><td class="meta-value">${escapeHtml(meta.category)}</td></tr>
  </table>
  <table style="margin-top:4px;">
    <tr><td colspan="2" class="title-bar">${escapeHtml(instruction.title)}</td></tr>
    ${sectionRows}
  </table>
  <table style="margin-top:10px;">
    <tr><td colspan="3" class="declaration-title">TEBLİĞ VE BEYAN</td></tr>
    <tr>
      <td colspan="3" class="declaration">
        Yukarıdaki çalışma talimatını okudum, anladım ve uygulayacağımı taahhüt ederim.
        6331 sayılı İSG Kanunu kapsamında imzalı tebliğdir.
      </td>
    </tr>
    <tr>
      <td class="signature-head">ONAYLAYAN – Ad Soyad</td>
      <td class="signature-head">İmza</td>
      <td class="signature-head">İŞVEREN / VEKİLİ</td>
    </tr>
    <tr>
      <td class="signature-cell"></td>
      <td class="signature-cell"></td>
      <td class="signature-cell">Ad Soyad:<br><br>İmza:<br><br>Tarih: ...... / ...... / ........</td>
    </tr>
  </table>
  <div class="footer">
    <span>İSG Vizyon | Çalışma Talimatları</span>
    <span>Bu belge 6331 sayılı İSG Kanunu kapsamında hazırlanmıştır.</span>
    <span>Sayfa 1/1</span>
  </div>
</body>
</html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFileName(instruction.title)}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const exportInstructionWord = async (instruction: WorkInstructionTemplate) => {
  try {
    const meta = getDocumentMeta(instruction);
    const sections = getInstructionSectionsForExport(instruction);
    const border = { style: BorderStyle.SINGLE, size: 6, color: "9FB3CE" };
    const borders = { top: border, bottom: border, left: border, right: border };
    const rgbToHex = (color: Rgb) => color.map((part) => part.toString(16).padStart(2, "0")).join("").toUpperCase();

    const run = (text: string, options: { bold?: boolean; color?: string; size?: number } = {}) =>
      new TextRun({
        text,
        bold: options.bold,
        color: options.color ?? "0F172A",
        font: "Inter",
        size: options.size ?? 15,
      });

    const paragraph = (
      text: string,
      options: { bold?: boolean; color?: string; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {},
    ) =>
      new Paragraph({
        alignment: options.align,
        spacing: { before: 0, after: 0 },
        children: [run(text, options)],
      });

  type DocxTableVerticalAlign = "top" | "center" | "bottom";

const cell = (
  children: Paragraph[],
  options: {
    width?: number;
    columnSpan?: number;
    verticalMerge?: "restart" | "continue";
    fill?: string;
    valign?: DocxTableVerticalAlign;
  } = {},
) =>
  new TableCell({
    width: options.width
      ? { size: options.width, type: WidthType.PERCENTAGE }
      : undefined,
    columnSpan: options.columnSpan,
    verticalMerge: options.verticalMerge,
    verticalAlign: options.valign ?? "center",
    shading: options.fill ? { fill: options.fill } : undefined,
    margins: { top: 55, bottom: 55, left: 90, right: 90 },
    borders,
    children,
  });

    const metaRows = [
      ["Belge Kodu", meta.code],
      ["Revizyon No", meta.revision],
      ["Düzenleme Tarihi", meta.date],
      ["Kategori", meta.category],
    ];

    const headerRows = metaRows.map(([label, value], index) =>
      new TableRow({
        children: [
          cell([paragraph(index === 0 ? "ÇALIŞMA TALİMATI" : "", { bold: true, size: 30, align: AlignmentType.CENTER })], {
            width: 52,
            verticalMerge: index === 0 ? "restart" : "continue",
            fill: "F3F6FB",
          }),
          cell([paragraph(label, { bold: true, size: 13 })], { width: 22, fill: "F8FAFC" }),
          cell([paragraph(value, { size: 13 })], { width: 26 }),
        ],
      }),
    );

    const instructionRows: TableRow[] = [
      new TableRow({
        children: [
          cell([paragraph(instruction.title, { bold: true, color: "FFFFFF", size: 16, align: AlignmentType.CENTER })], {
            columnSpan: 2,
            fill: "1840B4",
          }),
        ],
      }),
    ];

    sections.forEach((section) => {
      const colors = exportToneColors[section.tone];
      instructionRows.push(
        new TableRow({
          children: [
            cell([paragraph(section.title, { bold: true, color: rgbToHex(colors.text), size: 15 })], {
              columnSpan: 2,
              fill: rgbToHex(colors.fill),
            }),
          ],
        }),
      );

      section.items.forEach((item, index) => {
        instructionRows.push(
          new TableRow({
            children: [
              cell([paragraph(String(index + 1), { bold: true, size: 13, align: AlignmentType.CENTER })], {
                width: 5,
                fill: index % 2 === 0 ? "F8FBFF" : "F1F6FC",
              }),
              cell([paragraph(item, { size: 13 })], {
                width: 95,
                fill: index % 2 === 0 ? "F8FBFF" : "F1F6FC",
              }),
            ],
          }),
        );
      });
    });

    const declarationText =
      "Yukarıdaki çalışma talimatını okudum, anladım ve uygulayacağımı taahhüt ederim. 6331 sayılı İSG Kanunu kapsamında imzalı tebliğdir.";

    const doc = new Document({
      creator: "İSG Vizyon",
      description: `${instruction.title} çalışma talimatı`,
      title: instruction.title,
      styles: {
        default: {
          document: {
            run: {
              font: "Inter",
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: { top: 720, right: 720, bottom: 720, left: 720 },
            },
          },
          children: [
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: headerRows }),
            new Paragraph({ spacing: { before: 80, after: 0 } }),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: instructionRows }),
            new Paragraph({ spacing: { before: 160, after: 0 } }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    cell([paragraph("TEBLİĞ VE BEYAN", { bold: true, color: "FFFFFF", size: 15, align: AlignmentType.CENTER })], {
                      columnSpan: 3,
                      fill: "0F172A",
                    }),
                  ],
                }),
                new TableRow({
                  children: [cell([paragraph(declarationText, { size: 13 })], { columnSpan: 3, fill: "F8FAFC" })],
                }),
                new TableRow({
                  children: [
                    cell([paragraph("ONAYLAYAN – Ad Soyad", { bold: true, size: 13, align: AlignmentType.CENTER })], { width: 33 }),
                    cell([paragraph("İmza", { bold: true, size: 13, align: AlignmentType.CENTER })], { width: 34 }),
                    cell([paragraph("İŞVEREN / VEKİLİ", { bold: true, size: 13, align: AlignmentType.CENTER })], { width: 33 }),
                  ],
                }),
                new TableRow({
                  children: [
                    cell([paragraph("", { size: 13 })], { width: 33 }),
                    cell([paragraph("", { size: 13 })], { width: 34 }),
                    cell(
                      [
                        paragraph("Ad Soyad:", { size: 13 }),
                        paragraph(""),
                        paragraph("İmza:", { size: 13 }),
                        paragraph(""),
                        paragraph("Tarih: ...... / ...... / ........", { size: 13 }),
                      ],
                      { width: 33, valign: VerticalAlign.TOP }, // "both" yerine "TOP" veya "CENTER" kullanın
                    ),
                  ],
                }),
              ],
            }),
            new Paragraph({ spacing: { before: 260, after: 0 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                run("İSG Vizyon | Çalışma Talimatları    •    Bu belge 6331 sayılı İSG Kanunu kapsamında hazırlanmıştır.    •    Sayfa 1/1", {
                  color: "64748B",
                  size: 12,
                }),
              ],
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${sanitizeFileName(instruction.title)}.docx`);
    toast.success("Word çıktısı oluşturuldu.");
  } catch (error) {
    console.error("Word export failed:", error);
    toast.error("Word çıktısı oluşturulurken bir hata oluştu.");
  }
};

const buildAiInstruction = (form: AiFormState): WorkInstructionTemplate => {
  const workName = form.workName.trim();
  const extraNotes = form.notes.trim();
  const normalizedInput = `${workName} ${extraNotes}`.toLocaleLowerCase("tr-TR");

  const inferCategory = (): InstructionCategory => {
    if (/kimyasal|boya|cila|solvent|asit|baz|asbest/.test(normalizedInput)) return "Kimyasal Madde";
    if (/elektrik|pano|kablo|jenerat/.test(normalizedInput)) return "Elektrik İşleri";
    if (/yüksek|çatı|merdiven|iskele|cephe/.test(normalizedInput)) return "Yüksekte Çalışma";
    if (/kapalı|tank|silo|kazan|depo içi/.test(normalizedInput)) return "Kapalı Alan";
    if (/kaynak|kesme|oksijen|asetilen|mig|mag|tig/.test(normalizedInput)) return "Kaynak ve Kesme";
    if (/forklift|transpalet|vinç|depo|raf|istif|taşıma/.test(normalizedInput)) return "Taşıma & Depolama";
    if (/mutfak|yemekhane|bıçak|fırın|ocak|gıda/.test(normalizedInput)) return "Mutfak & Yemekhane";
    if (/ofis|ekran|ergonomi|yazıcı|fotokopi/.test(normalizedInput)) return "Ofis & Büro";
    if (/spiral|matkap|testere|kırıcı|delici|çekiç|tornavida|pense/.test(normalizedInput)) return "El Aletleri";
    return "İş Makineleri";
  };

  const category = form.category || inferCategory();
  const ppeByCategory: Record<InstructionCategory, string[]> = {
    "İş Makineleri": ["Baret", "Koruyucu gözlük", "Çelik burunlu iş ayakkabısı", "Mekanik dirençli eldiven", "Kulak koruyucu"],
    "El Aletleri": ["Koruyucu gözlük", "Mekanik dirençli eldiven", "Çelik burunlu iş ayakkabısı", "Uygun iş elbisesi"],
    "Kimyasal Madde": ["Kimyasala dayanıklı eldiven", "Kimyasal gözlük/yüz siperi", "Uygun filtreli maske", "Kimyasal önlük/tulum", "Kimyasal dirençli ayakkabı"],
    "Elektrik İşleri": ["Yalıtkan eldiven", "Yüz siperi", "Yalıtkan ayakkabı", "Ark dirençli iş kıyafeti", "Yalıtkan baret"],
    "Yüksekte Çalışma": ["Tam vücut emniyet kemeri", "Çift kancalı lanyard", "Çene bağlamalı baret", "Kaymaz iş ayakkabısı", "Mekanik eldiven"],
    "Kapalı Alan": ["Tam vücut emniyet kemeri ve kurtarma halatı", "Çoklu gaz dedektörü", "Solunum koruma", "ATEX uygun aydınlatma", "Antistatik ayakkabı"],
    "Kaynak ve Kesme": ["Kaynak maskesi", "Kaynakçı eldiveni", "Alev geciktirici tulum", "Çelik burunlu ayakkabı", "Solunum koruma"],
    "Taşıma & Depolama": ["Çelik burunlu iş ayakkabısı", "Reflektörlü yelek", "Mekanik dirençli eldiven", "Baret"],
    "Mutfak & Yemekhane": ["Kesilmeye dirençli eldiven", "Kaymaz iş ayakkabısı", "Mutfak önlüğü", "Saç bonesi/kep", "Sıcak iş eldiveni"],
    "Ofis & Ergonomi": ["Ergonomik sandalye desteği", "Bilek desteği", "Anti-glare ekran filtresi", "Gerekirse bilgisayar gözlüğü"],
    "Ofis & Büro": ["Ergonomik sandalye desteği", "Bilek desteği", "Anti-glare ekran filtresi", "Gerekirse bilgisayar gözlüğü"],
    "İnşaat & Saha": ["Baret", "Çelik burunlu iş ayakkabısı", "Reflektörlü yelek", "Mekanik eldiven", "Koruyucu gözlük"],
    "Genel İSG": ["Çalışma alanına uygun KKD", "Baret", "Koruyucu gözlük", "İş eldiveni", "Çelik burunlu iş ayakkabısı"],
  };
  const ppe = splitList(form.requiredPpe);
  const requiredPpe = ppe.length ? ppe : ppeByCategory[category];
  const contextNote = extraNotes ? `Ek bilgi dikkate alınır: ${extraNotes}` : `${workName} işine özgü saha koşulları işe başlamadan önce değerlendirilir.`;
  const instructionSections: NonNullable<WorkInstructionTemplate["instructionSections"]> = [
    {
      title: "1. HAZIRLIK",
      tone: "green",
      items: [
        `${workName} işi için yetkili ve eğitimli personel görevlendirilmelidir.`,
        "İşe başlamadan önce risk değerlendirmesi, çalışma izni ve saha uygunluğu kontrol edilmelidir.",
        "Kullanılacak ekipman, koruyucular, acil durdurma düzenekleri ve enerji kaynakları gözle kontrol edilmelidir.",
        "Çalışma alanı kayma, takılma, düşme, yangın ve yetkisiz giriş risklerine karşı düzenlenmelidir.",
        "Gerekli KKD eksiksiz, sağlam ve kullanıma uygun şekilde hazır bulundurulmalıdır.",
        contextNote,
      ],
    },
    {
      title: "2. OPERASYON",
      tone: "blue",
      items: [
        `${workName} faaliyeti yalnızca belirlenmiş prosedür, üretici talimatı ve amir yönlendirmesine uygun yürütülmelidir.`,
        "İş sırasında dikkat dağıtıcı davranışlardan kaçınılmalı, çalışma alanında düzen korunmalıdır.",
        "Ekipman veya ortamda olağan dışı ses, koku, titreşim, sızıntı veya ısınma fark edilirse çalışma durdurulmalıdır.",
        "Yetkisiz kişilerin çalışma alanına girişi engellenmeli, gerekiyorsa alan bariyer ve uyarı levhalarıyla sınırlandırılmalıdır.",
        "İş bitiminde ekipman güvenli konuma alınmalı, enerji kaynakları kapatılmalı ve alan temiz teslim edilmelidir.",
        "Tespit edilen uygunsuzluklar amire ve İSG birimine bildirilerek kayıt altına alınmalıdır.",
      ],
    },
    {
      title: "3. YASAKLAR",
      tone: "red",
      items: [
        "Eğitimsiz veya yetkisiz personelin bu işi yapması yasaktır.",
        "KKD kullanmadan, hasarlı KKD ile veya uygun olmayan ekipmanla çalışmak yasaktır.",
        "Makine koruyucularını, sensörleri, kilitleme sistemlerini veya acil durdurma düzeneklerini devre dışı bırakmak yasaktır.",
        "Arıza, sızıntı, uygunsuzluk veya tehlikeli durum bildirilmeden çalışmaya devam etmek yasaktır.",
        "Çalışma alanında şaka yapmak, koşmak, telefonla ilgilenmek veya dikkati dağıtacak davranışlarda bulunmak yasaktır.",
        "İş bitmeden alanı güvensiz, enerjili veya temizlenmemiş şekilde terk etmek yasaktır.",
      ],
    },
    {
      title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)",
      tone: "yellow",
      items: requiredPpe,
    },
    {
      title: "5. ACİL DURUM",
      tone: "purple",
      items: [
        "Kaza, ramak kala veya ciddi uygunsuzlukta çalışma derhal durdurulmalı ve alan güvene alınmalıdır.",
        "Yaralanma durumunda ilk yardımcıya haber verilmeli, gerekiyorsa 112 Acil Çağrı Merkezi aranmalıdır.",
        "Yangın, elektrik, kimyasal sızıntı veya gaz riski varsa ilgili acil durum prosedürü uygulanmalı ve alan tahliye edilmelidir.",
        "Ekipmana, enerji kaynağına veya tehlikeli ortama yetkisiz müdahale edilmemelidir.",
        "Olay sonrası amir, İSG profesyoneli ve işyeri hekimi bilgilendirilmeli; olay/kaza kaydı oluşturulmalıdır.",
      ],
    },
  ];

  return {
    id: `ai-${Date.now()}`,
    title: `${workName} Çalışma Talimatı`,
    category,
    description: `${workName} faaliyeti için 5 standart başlık altında oluşturulan profesyonel İSG çalışma talimatı.`,
    tags: [workName, category, "AI taslak"].filter(Boolean),
    requiredPpe,
    risks: [
      `${workName} sırasında ekipman/ortam kaynaklı yaralanma`,
      "Yetkisiz kullanım veya kontrolsüz müdahale",
      "KKD kullanılmaması nedeniyle maruziyet",
      extraNotes ? `Ek bilgi kaynaklı özel saha riski: ${extraNotes}` : "Çalışma alanı kaynaklı çevresel riskler",
    ],
    steps: instructionSections.slice(0, 3).flatMap((section) => section.items),
    emergencyNotes: instructionSections[4].items,
    instructionSections,
    legalNotes: defaultLegalNotes,
    updatedAt: new Date().toLocaleDateString("tr-TR"),
  };
};

const generateInstructionWithGemini = async (form: AiFormState): Promise<WorkInstructionTemplate> => {
  const response = await invokeEdgeFunction<AiInstructionGenerateResponse>("work-instruction-generate", {
    workName: form.workName.trim(),
    notes: form.notes.trim(),
  });

  const instruction = response.instruction;

  return {
    ...instruction,
    id: `ai-${Date.now()}`,
    title: instruction.title || `${form.workName.trim()} Çalışma Talimatı`,
    category: instruction.category || "Genel İSG",
    description:
      instruction.description ||
      `${form.workName.trim()} faaliyeti için Gemini ile oluşturulan profesyonel İSG çalışma talimatı.`,
    tags: Array.isArray(instruction.tags) && instruction.tags.length ? instruction.tags : [form.workName.trim(), "Gemini AI"],
    requiredPpe:
      Array.isArray(instruction.requiredPpe) && instruction.requiredPpe.length
        ? instruction.requiredPpe
        : ["Çalışma alanına uygun KKD"],
    risks: Array.isArray(instruction.risks) ? instruction.risks : [],
    steps: Array.isArray(instruction.steps) ? instruction.steps : [],
    emergencyNotes: Array.isArray(instruction.emergencyNotes) ? instruction.emergencyNotes : [],
    instructionSections: Array.isArray(instruction.instructionSections) ? instruction.instructionSections : [],
    legalNotes: instruction.legalNotes ?? defaultLegalNotes,
    updatedAt: new Date().toLocaleDateString("tr-TR"),
  };
};

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: InstructionCategory | "Tümü";
  active: boolean;
  onClick: () => void;
}) {
  const meta = label === "Tümü" ? null : categoryMeta[label];
  const Icon = meta?.icon ?? Filter;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition",
        active
          ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.14)]"
          : "border-slate-700/70 bg-slate-900/70 text-slate-300",
        meta?.chip,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function InstructionCard({
  instruction,
  onPreview,
  onPdf,
  onWord,
}: {
  instruction: WorkInstructionTemplate;
  onPreview: () => void;
  onPdf: () => void;
  onWord: () => void;
}) {
  const meta = categoryMeta[instruction.category];
  const Icon = meta.icon;

  return (
    <Card className="group overflow-hidden border-slate-700/60 bg-slate-900/70 text-slate-100 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-cyan-400/45 hover:bg-slate-900">
      <div className={cn("h-1 bg-gradient-to-r", meta.accent)} />
      <CardHeader className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <Badge className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold", meta.badge)}>
            {instruction.category}
          </Badge>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
            <Icon className="h-5 w-5 text-slate-100" />
          </div>
        </div>
        <div>
          <CardTitle className="line-clamp-2 text-lg font-bold text-white">{instruction.title}</CardTitle>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">{instruction.description}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5 pt-0">
        <div className="flex flex-wrap gap-1.5">
          {[...instruction.requiredPpe.slice(0, 3), ...instruction.tags.slice(0, 2)].map((tag) => (
            <span key={tag} className="rounded-full border border-slate-700/80 bg-slate-950/70 px-2 py-1 text-[10px] text-slate-300">
              {tag}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400">
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2">
            <span className="block text-slate-500">KKD</span>
            <strong className="text-slate-200">{instruction.requiredPpe.length}</strong>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2">
            <span className="block text-slate-500">Risk</span>
            <strong className="text-slate-200">{instruction.risks.length}</strong>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2">
            <span className="block text-slate-500">Adım</span>
            <strong className="text-slate-200">{instruction.steps.length}</strong>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onPreview} className="border-slate-700 bg-slate-950/60 text-slate-100 hover:bg-slate-800">
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            İncele
          </Button>
          <Button type="button" size="sm" onClick={onPdf} className="bg-blue-600 text-white hover:bg-blue-500">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            PDF
          </Button>
          <Button type="button" size="sm" onClick={onWord} className="bg-violet-600 text-white hover:bg-violet-500">
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Word
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const sectionToneClasses = {
  green: "border-emerald-400/25 bg-emerald-500/10 shadow-emerald-950/20",
  blue: "border-blue-400/25 bg-blue-500/10 shadow-blue-950/20",
  yellow: "border-amber-400/25 bg-amber-500/10 shadow-amber-950/20",
  red: "border-red-400/25 bg-red-500/10 shadow-red-950/20",
  purple: "border-violet-400/25 bg-violet-500/10 shadow-violet-950/20",
  slate: "border-slate-800 bg-slate-950/55 shadow-black/10",
};

function DetailSection({
  title,
  children,
  tone = "slate",
}: {
  title: string;
  children: React.ReactNode;
  tone?: keyof typeof sectionToneClasses;
}) {
  return (
    <section className={cn("rounded-2xl border p-4 shadow-lg", sectionToneClasses[tone])}>
      <h3 className="mb-3 text-sm font-bold text-white">{title}</h3>
      {children}
    </section>
  );
}

function InstructionDetailsDialog({
  instruction,
  open,
  onOpenChange,
  onSave,
}: {
  instruction: DetailsInstruction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (instruction: WorkInstructionTemplate) => void;
}) {
  if (!instruction) return null;

  const copyInstruction = async () => {
    await navigator.clipboard.writeText(createInstructionText(instruction));
    toast.success("Talimat metni kopyalandı.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-5xl overflow-y-auto border-slate-700 bg-slate-950 text-slate-100">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn("border", categoryMeta[instruction.category].badge)}>{instruction.category}</Badge>
            <Badge variant="outline" className="border-slate-700 text-slate-300">
              Revizyon: {formatDate(instruction.updatedAt)}
            </Badge>
          </div>
          <DialogTitle className="text-2xl text-white">{instruction.title}</DialogTitle>
          <DialogDescription className="text-slate-400">{instruction.description}</DialogDescription>
        </DialogHeader>

        {instruction.instructionSections?.length ? (
          <div className="grid gap-4">
            {instruction.instructionSections.map((section) => (
              <DetailSection key={section.title} title={section.title} tone={section.tone ?? "slate"}>
                <List ordered items={section.items} />
              </DetailSection>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <DetailSection title="Amaç" tone="blue">
              <p className="text-sm leading-6 text-slate-300">{instruction.description}</p>
            </DetailSection>
            <DetailSection title="Kapsam" tone="green">
              <p className="text-sm leading-6 text-slate-300">
                Bu talimat, ilgili faaliyet kapsamında çalışan personel, kullanılan ekipman, çalışma alanı ve gözetim süreçlerini kapsar.
              </p>
            </DetailSection>
            <DetailSection title="Gerekli KKD" tone="yellow">
              <List items={instruction.requiredPpe} />
            </DetailSection>
            <DetailSection title="Başlıca Riskler" tone="red">
              <List items={instruction.risks} />
            </DetailSection>
            <DetailSection title="İşe Başlamadan Önce Kontroller" tone="green">
              <List ordered items={instruction.steps.slice(0, 3)} />
            </DetailSection>
            <DetailSection title="Güvenli Çalışma Adımları" tone="blue">
              <List ordered items={instruction.steps} />
            </DetailSection>
            <DetailSection title="Yasak Davranışlar" tone="red">
              <List
                items={[
                  "Yetkisiz personelin işi yürütmesi.",
                  "KKD kullanmadan çalışmaya başlanması.",
                  "Makine koruyucularının veya emniyet düzeneklerinin devre dışı bırakılması.",
                  "Arıza ve uygunsuzluk bildirilmeden çalışmaya devam edilmesi.",
                ]}
              />
            </DetailSection>
            <DetailSection title="Acil Durumda Yapılacaklar" tone="purple">
              <List items={instruction.emergencyNotes} />
            </DetailSection>
            <DetailSection title="Sorumluluklar" tone="slate">
              <List
                items={[
                  "Çalışanlar talimata, eğitimlere ve saha uyarılarına uymakla sorumludur.",
                  "Birim amiri uygulamayı takip eder ve uygunsuzlukları giderir.",
                  "İSG profesyonelleri talimatın revizyon, eğitim ve saha uygunluğunu destekler.",
                ]}
              />
            </DetailSection>
            <DetailSection title="Revizyon Bilgisi" tone="slate">
              <List items={instruction.legalNotes ?? defaultLegalNotes} />
            </DetailSection>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={copyInstruction} className="border-slate-700 bg-slate-900 text-slate-100">
            <Copy className="mr-2 h-4 w-4" />
            Kopyala
          </Button>
          <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
            <Button type="button" onClick={() => exportInstructionPdf(instruction)} className="bg-blue-600 hover:bg-blue-500">
              PDF İndir
            </Button>
            <Button type="button" onClick={() => exportInstructionWord(instruction)} className="bg-violet-600 hover:bg-violet-500">
              Word İndir
            </Button>
            <Button type="button" onClick={() => onSave(instruction)} className="bg-emerald-600 hover:bg-emerald-500">
              <Save className="mr-2 h-4 w-4" />
              Kayıtlı Talimatlarıma Ekle
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function List({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={cn("space-y-2 text-sm leading-6 text-slate-300", ordered ? "list-decimal pl-5" : "list-disc pl-5")}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </Tag>
  );
}

function NewInstructionDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (instruction: WorkInstructionTemplate) => void;
}) {
  const [form, setForm] = useState<InstructionFormState>(emptyInstructionForm);

  useEffect(() => {
    if (!open) setForm(emptyInstructionForm);
  }, [open]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.error("Talimat başlığı zorunludur.");
      return;
    }
    if (!form.category) {
      toast.error("Kategori seçmelisiniz.");
      return;
    }

    const instruction: WorkInstructionTemplate = {
      id: `user-${Date.now()}`,
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim() || `${form.title.trim()} için güvenli çalışma talimatı.`,
      tags: splitList(form.tags),
      requiredPpe: splitList(form.requiredPpe),
      risks: splitList(form.risks),
      steps: splitList(form.steps),
      emergencyNotes: splitList(form.emergencyNotes),
      legalNotes: defaultLegalNotes,
      updatedAt: new Date().toLocaleDateString("tr-TR"),
    };

    onCreate(instruction);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto border-slate-700 bg-slate-950 text-slate-100">
        <DialogHeader>
          <DialogTitle>Yeni Talimat</DialogTitle>
          <DialogDescription>Kuruma özel çalışma talimatınızı oluşturun ve kayıtlı talimatlarınıza ekleyin.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <FormGrid>
            <Field label="Talimat Başlığı">
              <Input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} className="bg-slate-900" />
            </Field>
            <Field label="Kategori">
              <Select value={form.category} onValueChange={(value) => setForm((prev) => ({ ...prev, category: value as InstructionCategory }))}>
                <SelectTrigger className="bg-slate-900">
                  <SelectValue placeholder="Kategori seçin" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormGrid>
          <Field label="Kısa Açıklama">
            <Textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} className="min-h-20 bg-slate-900" />
          </Field>
          <FormGrid>
            <Field label="Etiketler">
              <Textarea value={form.tags} onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))} placeholder="Virgül veya satır satır yazın" className="bg-slate-900" />
            </Field>
            <Field label="Gerekli KKD">
              <Textarea value={form.requiredPpe} onChange={(event) => setForm((prev) => ({ ...prev, requiredPpe: event.target.value }))} className="bg-slate-900" />
            </Field>
            <Field label="Riskler">
              <Textarea value={form.risks} onChange={(event) => setForm((prev) => ({ ...prev, risks: event.target.value }))} className="bg-slate-900" />
            </Field>
            <Field label="Acil Durum Notları">
              <Textarea value={form.emergencyNotes} onChange={(event) => setForm((prev) => ({ ...prev, emergencyNotes: event.target.value }))} className="bg-slate-900" />
            </Field>
          </FormGrid>
          <Field label="Güvenli Çalışma Adımları">
            <Textarea value={form.steps} onChange={(event) => setForm((prev) => ({ ...prev, steps: event.target.value }))} className="min-h-28 bg-slate-900" />
          </Field>
          <DialogFooter>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-500">
              <Plus className="mr-2 h-4 w-4" />
              Talimatı Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AiInstructionDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (instruction: WorkInstructionTemplate) => void;
}) {
  const [form, setForm] = useState<AiFormState>(emptyAiForm);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(emptyAiForm);
      setGenerating(false);
    }
  }, [open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.workName.trim()) {
      toast.error("İş / ekipman adı zorunludur.");
      return;
    }

    setGenerating(true);
    try {
      const instruction = await generateInstructionWithGemini(form);
      onCreate(instruction);
      onOpenChange(false);
    } catch (error) {
      console.error("AI instruction generation failed:", error);
      toast.error(error instanceof Error ? error.message : "Talimat oluşturulurken bir hata oluştu.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[425px] border border-slate-600/80 bg-[#1f2b3d] p-0 text-slate-100 shadow-2xl shadow-black/40">
        <div className="p-5">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-500/25 text-purple-200 ring-1 ring-purple-300/20">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold text-white">AI ile Talimat Üret</DialogTitle>
                <DialogDescription className="mt-3 text-xs leading-5 text-slate-300">
                  Yapay zeka iş/makine için 5 standart başlık altında 1-2 sayfalık talimat üretir. Düzenleyip kaydedebilirsiniz.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={submit} className="mt-5 grid gap-4">
            <Field label="İş / Makine / Ekipman Adı *">
              <Input
                value={form.workName}
                onChange={(event) => setForm((prev) => ({ ...prev, workName: event.target.value }))}
                placeholder="Örn: Hidrolik pres operatörü, CNC torna, kapalı tank temizliği"
                className="h-10 border-slate-500/80 bg-[#1d293a] text-sm text-slate-100 placeholder:text-slate-500 focus-visible:ring-purple-400/60"
              />
            </Field>

            <Field label="Ek Bilgi (opsiyonel)">
              <Textarea
                value={form.notes}
                maxLength={600}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Ortam, riskler, özel durumlar... (max 600 karakter)"
                className="min-h-[78px] resize-none border-slate-500/80 bg-[#1d293a] text-sm text-slate-100 placeholder:text-slate-500 focus-visible:ring-purple-400/60"
              />
            </Field>

            <Button
              type="submit"
              disabled={generating}
              className="mt-1 h-10 w-full rounded-lg bg-gradient-to-r from-purple-700 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-purple-950/30 hover:from-purple-600 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Talimat Üret
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs font-semibold text-slate-300">{label}</Label>
      {children}
    </div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function loadSavedInstructions(): WorkInstructionTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function WorkInstructionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<InstructionCategory | "Tümü">("Tümü");
  const [activeTab, setActiveTab] = useState<"templates" | "saved">("templates");
  const [savedInstructions, setSavedInstructions] = useState<WorkInstructionTemplate[]>(() => loadSavedInstructions());
  const [selectedInstruction, setSelectedInstruction] = useState<DetailsInstruction | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedInstructions));
  }, [savedInstructions]);

  const activeSource = activeTab === "templates" ? templates : savedInstructions;

  const filteredInstructions = useMemo(() => {
    const normalized = searchQuery.trim().toLocaleLowerCase("tr-TR");
    return activeSource.filter((instruction) => {
      const matchesCategory = selectedCategory === "Tümü" || instruction.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!normalized) return true;

      const haystack = [
        instruction.title,
        instruction.category,
        instruction.description,
        ...instruction.tags,
        ...instruction.requiredPpe,
        ...instruction.risks,
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(normalized);
    });
  }, [activeSource, searchQuery, selectedCategory]);

  const saveInstruction = useCallback((instruction: WorkInstructionTemplate) => {
    setSavedInstructions((prev) => {
      const exists = prev.some((item) => item.id === instruction.id || item.title === instruction.title);
      if (exists) {
        toast.info("Bu talimat kayıtlı talimatlarınızda zaten var.");
        return prev;
      }
      toast.success("Talimat kayıtlı talimatlarınıza eklendi.");
      return [{ ...instruction, id: instruction.id.startsWith("template-") ? `saved-${Date.now()}` : instruction.id }, ...prev];
    });
  }, []);

  const createInstruction = useCallback((instruction: WorkInstructionTemplate) => {
    setSavedInstructions((prev) => [instruction, ...prev]);
    setActiveTab("saved");
    toast.success("Talimat kaydedildi.");
  }, []);

  const openDetails = (instruction: WorkInstructionTemplate) => {
    setSelectedInstruction({ ...instruction, source: activeTab === "templates" ? "template" : "saved" });
    setDetailsOpen(true);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.16),transparent_28%),#020617] p-4 text-slate-100 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950/70 p-5 shadow-2xl shadow-black/30 backdrop-blur md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Badge className="mb-4 border border-cyan-400/25 bg-cyan-500/10 text-cyan-100">
                <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                İSG talimat merkezi
              </Badge>
              <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">Çalışma Talimatları</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">
                Hazır şablonlardan veya yapay zeka ile saniyeler içinde profesyonel İSG talimatı oluşturun.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                onClick={() => setAiDialogOpen(true)}
                className="h-11 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-5 text-white shadow-lg shadow-purple-950/30 hover:from-purple-500 hover:to-fuchsia-500"
              >
                <Bot className="mr-2 h-4 w-4" />
                AI ile Üret
              </Button>
              <Button type="button" onClick={() => setNewDialogOpen(true)} className="h-11 rounded-xl bg-blue-600 px-5 text-white hover:bg-blue-500">
                <Plus className="mr-2 h-4 w-4" />
                Yeni Talimat
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Başlık, kategori, KKD, risk veya etikete göre ara..."
                className="h-11 rounded-2xl border-slate-700 bg-slate-900/80 pl-10 text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              {templates.length} hazır şablon · {savedInstructions.length} kayıtlı talimat
            </div>
          </div>
        </section>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "templates" | "saved")} className="space-y-5">
          <TabsList className="grid w-full max-w-xl grid-cols-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-1">
            <TabsTrigger value="templates" className="rounded-xl data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-100">
              Şablon Kütüphanesi
            </TabsTrigger>
            <TabsTrigger value="saved" className="rounded-xl data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-100">
              Kayıtlı Talimatlarım
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <CategoryChip label="Tümü" active={selectedCategory === "Tümü"} onClick={() => setSelectedCategory("Tümü")} />
            {categories.map((category) => (
              <CategoryChip key={category} label={category} active={selectedCategory === category} onClick={() => setSelectedCategory(category)} />
            ))}
          </div>

          <TabsContent value="templates" className="mt-0">
            <InstructionGrid
              items={filteredInstructions}
              emptyLabel="Bu filtrelerle eşleşen şablon bulunamadı."
              onPreview={openDetails}
            />
          </TabsContent>
          <TabsContent value="saved" className="mt-0">
            <InstructionGrid
              items={filteredInstructions}
              emptyLabel="Henüz kayıtlı talimat yok. Yeni talimat ekleyebilir veya AI ile taslak üretebilirsiniz."
              onPreview={openDetails}
            />
          </TabsContent>
        </Tabs>
      </div>

      <InstructionDetailsDialog instruction={selectedInstruction} open={detailsOpen} onOpenChange={setDetailsOpen} onSave={saveInstruction} />
      <NewInstructionDialog open={newDialogOpen} onOpenChange={setNewDialogOpen} onCreate={createInstruction} />
      <AiInstructionDialog open={aiDialogOpen} onOpenChange={setAiDialogOpen} onCreate={createInstruction} />
    </div>
  );
}

function InstructionGrid({
  items,
  emptyLabel,
  onPreview,
}: {
  items: WorkInstructionTemplate[];
  emptyLabel: string;
  onPreview: (instruction: WorkInstructionTemplate) => void;
}) {
  if (!items.length) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-700 bg-slate-950/60 p-10 text-center text-slate-400">
        <BadgeCheck className="mx-auto mb-3 h-8 w-8 text-slate-500" />
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((instruction) => (
        <InstructionCard
          key={instruction.id}
          instruction={instruction}
          onPreview={() => onPreview(instruction)}
          onPdf={() => exportInstructionPdf(instruction)}
          onWord={() => exportInstructionWord(instruction)}
        />
      ))}
    </div>
  );
}
