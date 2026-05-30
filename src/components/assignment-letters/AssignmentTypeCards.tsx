import { useMemo, useState } from "react";
import {
  ClipboardCheck,
  FileText,
  GraduationCap,
  Search,
  ShieldCheck,
  Siren,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { AssignmentType } from "@/lib/assignmentWordGenerator";

interface AssignmentTypeCardsProps {
  onCreate: (type: AssignmentType) => void;
  onOpenEmployeeRepresentativeAppointment: () => void;
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

export function AssignmentTypeCards({
  onCreate,
  onOpenEmployeeRepresentativeAppointment,
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

  return (
    <section className="rounded-[24px] border border-border/60 bg-card shadow-sm">
      <div className="border-b border-border/60 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Belge Türleri</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Oluşturmak istediğiniz formu arayın veya kategoriye göre filtreleyin.
            </p>
          </div>

          <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs">
            {filteredDocuments.length} belge
          </Badge>
        </div>

        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative xl:max-w-sm xl:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Belge ara..."
              className="h-10 rounded-xl border-border/70 bg-background pl-9"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
            {filters.map((filter) => {
              const active = activeCategory === filter.key;

              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveCategory(filter.key)}
                  className={[
                    "shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition",
                    active
                      ? "border-primary/30 bg-primary text-primary-foreground shadow-sm"
                      : "border-border/70 bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  ].join(" ")}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="divide-y divide-border/60">
        {filteredDocuments.length > 0 ? (
          filteredDocuments.map((document) => {
            const Icon = document.icon;

            return (
              <div
                key={document.id}
                className="group flex flex-col gap-3 px-4 py-3 transition hover:bg-muted/35 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className={`mt-0.5 rounded-xl p-2 ${document.colorClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold leading-5 text-foreground">
                        {document.title}
                      </h3>
                      <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[11px] font-medium">
                        {categoryLabels[document.category]}
                      </Badge>
                    </div>

                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground sm:line-clamp-1">
                      {document.description}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={document.action}
                  className="w-full rounded-xl px-4 shadow-sm sm:w-auto"
                >
                  Oluştur
                </Button>
              </div>
            );
          })
        ) : (
          <div className="px-5 py-10 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">Belge bulunamadı</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Arama kelimesini değiştirin veya farklı bir kategori seçin.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}