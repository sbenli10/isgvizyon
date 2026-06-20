import { useMemo, useState } from "react";
import {
  ClipboardCheck,
  FileText,
  FileQuestion,
  GraduationCap,
  Layers3,
  Search,
  ShieldCheck,
  Siren,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { AssignmentType } from "@/lib/assignmentWordGenerator";

interface AssignmentTypeCardsProps {
  onCreate: (type: AssignmentType) => void;
  onOpenEmployeeRepresentativeAppointment: () => void;
  onOpenIsgEntranceExam: () => void;
  onOpenIsgTrainingAttendance: () => void;
  onOpenWorkAccidentReport: () => void;
  onOpenReturnToWorkTraining: () => void;
  onOpenRootCauseInvestigation: () => void;
  onOpenNearMissReport: () => void;
  onOpenEmergencyDrillAttendance: () => void;
  onOpenDrillForm: () => void;
  onOpenIncidentInvestigationReport: () => void;
  onOpenOrientationOnboardingTraining: () => void;
}

type Category = "all" | "assignment" | "training" | "incident" | "drill";

interface DocumentAction {
  id: string;
  title: string;
  description: string;
  category: Exclude<Category, "all">;
  icon: typeof FileText;
  colorClass: string;
  action: () => void;
}

const filters: { key: Category; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "assignment", label: "Atama Yazıları" },
  { key: "training", label: "Eğitim Formları" },
  { key: "incident", label: "Olay / Kaza" },
  { key: "drill", label: "Tatbikat" },
];

const categoryLabels: Record<Exclude<Category, "all">, string> = {
  assignment: "Atama",
  training: "Eğitim",
  incident: "Olay / Kaza",
  drill: "Tatbikat",
};

const categoryStyles: Record<
  Exclude<Category, "all">,
  { badge: string; accent: string; button: string }
> = {
  assignment: {
    badge: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-200",
    accent: "from-blue-500/20 via-cyan-500/10 to-transparent",
    button: "bg-blue-600 text-white hover:bg-blue-500",
  },
  training: {
    badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
    accent: "from-emerald-500/20 via-teal-500/10 to-transparent",
    button: "bg-emerald-600 text-white hover:bg-emerald-500",
  },
  incident: {
    badge: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200",
    accent: "from-rose-500/20 via-orange-500/10 to-transparent",
    button: "bg-rose-600 text-white hover:bg-rose-500",
  },
  drill: {
    badge: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-200",
    accent: "from-violet-500/20 via-sky-500/10 to-transparent",
    button: "bg-violet-600 text-white hover:bg-violet-500",
  },
};

export function AssignmentTypeCards({
  onCreate,
  onOpenEmployeeRepresentativeAppointment,
  onOpenIsgEntranceExam,
  onOpenIsgTrainingAttendance,
  onOpenWorkAccidentReport,
  onOpenReturnToWorkTraining,
  onOpenRootCauseInvestigation,
  onOpenNearMissReport,
  onOpenEmergencyDrillAttendance,
  onOpenDrillForm,
  onOpenIncidentInvestigationReport,
  onOpenOrientationOnboardingTraining,
}: AssignmentTypeCardsProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("all");

  const documents = useMemo<DocumentAction[]>(
    () => [
      {
        id: "risk_assessment_team",
        title: "Risk Değerlendirme Ekibi Atama Yazısı",
        description: "Risk değerlendirme ekibi görevlendirme belgesi oluşturun.",
        category: "assignment",
        icon: ShieldCheck,
        colorClass: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-200",
        action: () => onCreate("risk_assessment_team"),
      },
      {
        id: "support_staff",
        title: "Destek Elemanı Atama Yazısı",
        description: "Acil durum destek personeli için atama yazısı hazırlayın.",
        category: "assignment",
        icon: UserCheck,
        colorClass: "bg-blue-500/10 text-blue-700 dark:text-blue-200",
        action: () => onCreate("support_staff"),
      },
      {
        id: "employee_representative",
        title: "Çalışan Temsilcisi Atama Yazısı",
        description: "Standart çalışan temsilcisi atama yazısı oluşturun.",
        category: "assignment",
        icon: UserCheck,
        colorClass: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-200",
        action: () => onCreate("employee_representative"),
      },
      {
        id: "employee_representative_bundle",
        title: "İSG Çalışan Temsilcisi Dosyası",
        description: "Temsilci atama, görev ve eğitim bilgilerini tek dosyada hazırlayın.",
        category: "assignment",
        icon: ClipboardCheck,
        colorClass: "bg-violet-500/10 text-violet-700 dark:text-violet-200",
        action: onOpenEmployeeRepresentativeAppointment,
      },
      {
        id: "isg_entrance_exam",
        title: "04 - İSG Giriş Sınavı",
        description: "Çalışan için iş sağlığı ve güvenliği eğitimi değerlendirme sınavı oluşturun.",
        category: "training",
        icon: FileQuestion,
        colorClass: "bg-blue-500/10 text-blue-700 dark:text-blue-200",
        action: onOpenIsgEntranceExam,
      },
      {
        id: "isg_training_attendance",
        title: "İŞ SAĞLIĞI ve GÜVENLİĞİ EĞİTİM KATILIM LİSTESİ",
        description: "Çalışanların temel İSG eğitimi katılım ve imza listesini oluşturun.",
        category: "training",
        icon: GraduationCap,
        colorClass: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-200",
        action: onOpenIsgTrainingAttendance,
      },
      {
        id: "orientation_onboarding",
        title: "Oryantasyon ve İşbaşı Eğitim Formu",
        description: "Yeni çalışan için oryantasyon ve işbaşı eğitim kaydı oluşturun.",
        category: "training",
        icon: GraduationCap,
        colorClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
        action: onOpenOrientationOnboardingTraining,
      },
      {
        id: "return_to_work_training",
        title: "İşe Dönüş İlave Eğitim Formu",
        description: "İşe dönüş sonrası ilave eğitim katılım formu hazırlayın.",
        category: "training",
        icon: GraduationCap,
        colorClass: "bg-teal-500/10 text-teal-700 dark:text-teal-200",
        action: onOpenReturnToWorkTraining,
      },
      {
        id: "work_accident",
        title: "İş Kazası Tutanağı",
        description: "İş kazası sonrası ilk kayıt ve beyan tutanağı oluşturun.",
        category: "incident",
        icon: Siren,
        colorClass: "bg-red-500/10 text-red-700 dark:text-red-200",
        action: onOpenWorkAccidentReport,
      },
      {
        id: "incident_investigation",
        title: "Kaza / Olay Araştırma Raporu",
        description: "Kaza veya olay sonrası araştırma raporu hazırlayın.",
        category: "incident",
        icon: FileText,
        colorClass: "bg-orange-500/10 text-orange-700 dark:text-orange-200",
        action: onOpenIncidentInvestigationReport,
      },
      {
        id: "root_cause",
        title: "Kök Neden Araştırma Formu",
        description: "Olayın temel nedenlerini ve düzeltici faaliyetleri kayıt altına alın.",
        category: "incident",
        icon: ClipboardCheck,
        colorClass: "bg-amber-500/10 text-amber-700 dark:text-amber-200",
        action: onOpenRootCauseInvestigation,
      },
      {
        id: "near_miss",
        title: "Ramak Kala Olay Bildirim Formu",
        description: "Ramak kala olayları hızlı ve standart şekilde bildirin.",
        category: "incident",
        icon: Siren,
        colorClass: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-200",
        action: onOpenNearMissReport,
      },
      {
        id: "emergency_drill_attendance",
        title: "Acil Durum Tatbikatı Katılım Formu",
        description: "Tatbikat katılımcı listesini ve süre bilgisini kaydedin.",
        category: "drill",
        icon: ClipboardCheck,
        colorClass: "bg-sky-500/10 text-sky-700 dark:text-sky-200",
        action: onOpenEmergencyDrillAttendance,
      },
      {
        id: "drill_form",
        title: "Tatbikat Değerlendirme Formu",
        description: "Tatbikat türü, değerlendirme ve sonuç bilgilerini hazırlayın.",
        category: "drill",
        icon: FileText,
        colorClass: "bg-purple-500/10 text-purple-700 dark:text-purple-200",
        action: onOpenDrillForm,
      },
    ],
    [
      onCreate,
      onOpenDrillForm,
      onOpenEmergencyDrillAttendance,
      onOpenEmployeeRepresentativeAppointment,
      onOpenIsgEntranceExam,
      onOpenIsgTrainingAttendance,
      onOpenIncidentInvestigationReport,
      onOpenNearMissReport,
      onOpenOrientationOnboardingTraining,
      onOpenReturnToWorkTraining,
      onOpenRootCauseInvestigation,
      onOpenWorkAccidentReport,
    ]
  );

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.toLocaleLowerCase("tr-TR").trim();

    return documents.filter((document) => {
      const matchesCategory = activeCategory === "all" || document.category === activeCategory;

      const searchableText = `${document.title} ${document.description} ${categoryLabels[document.category]}`
        .toLocaleLowerCase("tr-TR")
        .trim();

      const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, documents, query]);

  const categoryCounts = useMemo(
    () =>
      documents.reduce(
        (acc, document) => {
          acc[document.category] += 1;
          return acc;
        },
        { assignment: 0, training: 0, incident: 0, drill: 0 }
      ),
    [documents]
  );

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-xl shadow-slate-950/[0.04] dark:border-slate-800 dark:bg-slate-950">
      <div className="relative overflow-hidden border-b border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70 sm:p-5">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-200">
                <Layers3 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-slate-950 dark:text-white">Belge Kataloğu</h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Oluşturmak istediğiniz formu arayın veya kategoriye göre filtreleyin.
                </p>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">
              Tüm şablonlar boş, kısmen dolu veya firma/personel verileriyle hazır çıktı alacak şekilde tasarlandı.
            </p>
          </div>

          <div className="relative flex flex-wrap gap-2">
            <Badge className="w-fit rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-200">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {filteredDocuments.length} belge
            </Badge>
            <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs">
              DOCX hazır
            </Badge>
          </div>
        </div>

        <div className="relative mt-5 flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative xl:max-w-sm xl:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Belge, kategori veya kullanım amacı ara..."
              className="h-11 rounded-2xl border-slate-200 bg-white pl-9 text-slate-950 shadow-sm placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
            {filters.map((filter) => {
              const active = activeCategory === filter.key;
              const count =
                filter.key === "all"
                  ? documents.length
                  : categoryCounts[filter.key as Exclude<Category, "all">];

              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveCategory(filter.key)}
                  className={[
                    "shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition",
                    active
                      ? "border-cyan-500 bg-cyan-600 text-white shadow-lg shadow-cyan-600/20"
                      : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900",
                  ].join(" ")}
                >
                  {filter.label} <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filteredDocuments.length > 0 ? (
          filteredDocuments.map((document) => {
            const Icon = document.icon;
            const style = categoryStyles[document.category];

            return (
              <article
                key={document.id}
                className="group relative flex min-h-[220px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-2xl hover:shadow-cyan-950/10 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-cyan-700"
              >
                <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${style.accent}`} />
                <div className="relative flex items-start justify-between gap-3">
                  <div className={`rounded-2xl border border-white/60 p-3 shadow-sm ${document.colorClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <Badge className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider hover:bg-current/0 ${style.badge}`}>
                    {categoryLabels[document.category]}
                  </Badge>
                </div>

                <div className="relative mt-5 min-w-0 flex-1">
                  <h3 className="text-base font-black leading-6 text-slate-950 dark:text-white">{document.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {document.description}
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={document.action}
                  className={`relative mt-5 h-11 w-full rounded-2xl px-4 font-bold shadow-sm ${style.button}`}
                >
                  Oluştur
                </Button>
              </article>
            );
          })
        ) : (
          <div className="col-span-full px-5 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-950 dark:text-white">Belge bulunamadı</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Arama kelimesini değiştirin veya farklı bir kategori seçin.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
