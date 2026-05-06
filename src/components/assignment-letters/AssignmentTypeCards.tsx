import {
  AlertOctagon,
  AlertTriangle,
  ClipboardCheck,
  FileText,
  GraduationCap,
  NotebookPen,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Users2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssignmentType } from "@/lib/assignmentWordGenerator";

interface AssignmentTypeItem {
  type: AssignmentType;
  title: string;
  description: string;
  icon: typeof FileText;
}

interface ActionCardItem {
  title: string;
  description: string;
  action: string;
  icon: typeof FileText;
  onClick: () => void;
  tag: string;
  tone: string;
  iconTone: string;
}

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

const assignmentTypes: AssignmentTypeItem[] = [
  {
    type: "risk_assessment_team",
    title: "Risk Değerlendirme Ekibi Atama",
    description: "Risk değerlendirme çalışmalarında görev alacak personel için resmi ekip görevlendirme yazısı oluşturun.",
    icon: ShieldCheck,
  },
  {
    type: "support_staff",
    title: "Destek Elemanı Atama",
    description: "Acil durum, tahliye ve yangınla mücadele görevleri için resmi destek elemanı atama belgesi hazırlayın.",
    icon: FileText,
  },
  {
    type: "employee_representative",
    title: "Çalışan Temsilcisi Atama",
    description: "Çalışan temsilcisi görevlendirmeleri için resmi atama belgesi üretin ve arşivleyin.",
    icon: Users2,
  },
];

const sectionShell =
  "rounded-[28px] border border-border/70 bg-gradient-to-br from-background via-background to-muted/20 p-5 shadow-[0_18px_50px_rgba(2,6,23,0.06)] dark:shadow-[0_18px_50px_rgba(2,6,23,0.28)] sm:p-6";
const cardShell =
  "group relative overflow-hidden rounded-[26px] border border-border/70 bg-gradient-to-br from-background via-background to-muted/20 shadow-[0_22px_55px_rgba(2,6,23,0.08)] transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-[0_26px_70px_rgba(37,99,235,0.18)] dark:shadow-[0_22px_55px_rgba(2,6,23,0.34)]";
const actionButtonClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-gradient-to-r from-slate-100 via-white to-slate-100 font-semibold text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.10)] transition-all duration-300 hover:border-primary/30 hover:from-cyan-50 hover:via-sky-50 hover:to-blue-50 hover:text-slate-950 hover:shadow-[0_16px_36px_rgba(37,99,235,0.16)] dark:border-slate-700 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 dark:text-white dark:shadow-[0_12px_30px_rgba(15,23,42,0.22)] dark:hover:from-primary dark:hover:via-cyan-500 dark:hover:to-primary dark:hover:text-white dark:hover:shadow-[0_16px_36px_rgba(37,99,235,0.32)]";

const renderActionCard = (item: ActionCardItem) => (
  <Card key={item.title} className={`${cardShell} flex h-full flex-col justify-between ${item.tone}`}>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(37,99,235,0.10),transparent_32%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    <CardHeader className="relative space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm ${item.iconTone}`}>
          <item.icon className="h-5 w-5" />
        </div>
        <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {item.tag}
        </span>
      </div>
      <div className="space-y-2.5">
        <CardTitle className="cardTitle leading-snug tracking-tight">{item.title}</CardTitle>
        <CardDescription className="cardDescription text-sm leading-6">{item.description}</CardDescription>
      </div>
    </CardHeader>
    <CardContent className="relative pt-0">
      <Button className={actionButtonClass} onClick={item.onClick}>
        {item.action}
      </Button>
    </CardContent>
  </Card>
);

const renderPrimaryAssignmentCard = (item: AssignmentTypeItem, onCreate: (type: AssignmentType) => void) => (
  <Card key={item.type} className={`${cardShell} flex h-full flex-col justify-between border-cyan-500/15`}>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.10),transparent_34%)]" />
    <CardHeader className="relative space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300 bg-cyan-50 text-cyan-700 shadow-sm dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300">
          <item.icon className="h-5 w-5" />
        </div>
        <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Resmi Atama
        </span>
      </div>
      <div className="space-y-2.5">
        <CardTitle className="cardTitle leading-snug tracking-tight">{item.title}</CardTitle>
        <CardDescription className="cardDescription text-sm leading-6">{item.description}</CardDescription>
      </div>
    </CardHeader>
    <CardContent className="relative pt-0">
      <Button
        className={`${actionButtonClass} border-cyan-200 from-cyan-50 via-sky-50 to-blue-50 text-slate-900 hover:border-cyan-300 hover:from-cyan-100 hover:via-sky-100 hover:to-blue-100 dark:border-cyan-500/20 dark:from-cyan-600 dark:via-sky-600 dark:to-blue-700 dark:text-white dark:hover:from-cyan-500 dark:hover:via-sky-500 dark:hover:to-blue-600`}
        onClick={() => onCreate(item.type)}
      >
        Oluştur
      </Button>
    </CardContent>
  </Card>
);

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
  const appointmentDocuments: ActionCardItem[] = [
    {
      title: "İSG Çalışan Temsilcisi Ataması",
      description: "Çalışan temsilcisi için daha detaylı resmi atama ve tebliğ formunu sistemden ya da manuel bilgilerle hazırlayın.",
      icon: Users2,
      action: "Form Oluştur",
      onClick: onOpenEmployeeRepresentativeAppointment,
      tag: "Dosya Paketi",
      tone: "border-violet-400/30",
      iconTone: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300",
    },
  ];

  const incidentDocuments: ActionCardItem[] = [
    {
      title: "İş Kazası Tutanağı",
      description: "Kazaya ilişkin gerekli alanları doldurun, fotoğraf ekleyin ve Word tutanak çıktısı alın.",
      icon: AlertTriangle,
      action: "Tutanak Oluştur",
      onClick: onOpenWorkAccidentReport,
      tag: "Olay Formu",
      tone: "border-amber-400/30",
      iconTone: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
    },
    {
      title: "Kök Neden Araştırma Formu",
      description: "İş kazası veya güvensiz davranış olayları için tiklenebilir alanlarla resmi kök neden araştırma formu hazırlayın.",
      icon: AlertOctagon,
      action: "Form Oluştur",
      onClick: onOpenRootCauseInvestigation,
      tag: "Analiz",
      tone: "border-rose-400/30",
      iconTone: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
    },
    {
      title: "Ramak Kala Olay Bildirimi",
      description: "Çalışan güvenliği ramak kala olaylarını kayıt altına alın ve Word bildirim formu olarak çıktı alın.",
      icon: Siren,
      action: "Form Oluştur",
      onClick: onOpenNearMissReport,
      tag: "Bildirim",
      tone: "border-sky-400/30",
      iconTone: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300",
    },
    {
      title: "Kaza / Olay Araştırma Raporu",
      description: "Kaza ve olay detaylarını, risk analizini ve görgü şahidi bilgilerini manuel girerek resmi araştırma raporu oluşturun.",
      icon: NotebookPen,
      action: "Rapor Oluştur",
      onClick: onOpenIncidentInvestigationReport,
      tag: "Rapor",
      tone: "border-fuchsia-400/30",
      iconTone: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10 dark:text-fuchsia-300",
    },
  ];

  const trainingDocuments: ActionCardItem[] = [
    {
      title: "İşe Dönüş İlave Eğitim Formu",
      description: "İş kazası veya meslek hastalığı sonrası ilave eğitim katılımını resmi Word formu olarak hazırlayın.",
      icon: GraduationCap,
      action: "Form Oluştur",
      onClick: onOpenReturnToWorkTraining,
      tag: "Eğitim",
      tone: "border-primary/30",
      iconTone: "border-primary/30 bg-primary/10 text-primary",
    },
    {
      title: "Tatbikat Katılım Formu",
      description: "Acil durum tatbikatına katılan kişileri manuel girin ve resmi katılım kayıt formu Word çıktısı alın.",
      icon: ShieldAlert,
      action: "Form Oluştur",
      onClick: onOpenEmergencyDrillAttendance,
      tag: "Tatbikat",
      tone: "border-emerald-400/30",
      iconTone: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
    },
    {
      title: "Tatbikat Formu",
      description: "Tatbikat türünü işaretleyerek tüm değerlendirme alanlarını manuel doldurun ve Word formu oluşturun.",
      icon: ShieldCheck,
      action: "Form Oluştur",
      onClick: onOpenDrillForm,
      tag: "Tatbikat",
      tone: "border-indigo-400/30",
      iconTone: "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300",
    },
    {
      title: "Oryantasyon ve İşbaşı Eğitimi",
      description: "Personel bilgilerini manuel girin, eğitim konularını işaretleyin ve resmi eğitim formu Word çıktısı alın.",
      icon: ClipboardCheck,
      action: "Form Oluştur",
      onClick: onOpenOrientationOnboardingTraining,
      tag: "Eğitim",
      tone: "border-cyan-400/30",
      iconTone: "border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300",
    },
  ];

  return (
    <div className="space-y-8">
      <section className={sectionShell}>
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">Atama Belgeleri</span>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Atama Yazıları</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">Görevlendirme, temsilci ve destek elemanı atama belgelerini daha hızlı ve düzenli biçimde oluşturun.</p>
          </div>
          <div className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
            Sık kullanılan resmi belgeler
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assignmentTypes.map((item) => renderPrimaryAssignmentCard(item, onCreate))}
          {appointmentDocuments.map(renderActionCard)}
        </div>
      </section>

      <section className={sectionShell}>
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-600 dark:text-rose-300">Olay Yönetimi</span>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Olay ve Bildirim Formları</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">Kaza, kök neden ve bildirim süreçleri için resmi Word belgelerini tek alandan yönetin.</p>
          </div>
          <div className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
            İnceleme, tutanak ve rapor akışı
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{incidentDocuments.map(renderActionCard)}</div>
      </section>

      <section className={sectionShell}>
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">Eğitim Akışı</span>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Eğitim ve Tatbikat Formları</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">Eğitim katılımı, tatbikat kayıtları ve değerlendirme formlarını daha profesyonel bir görünümle yönetin.</p>
          </div>
          <div className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
            Eğitim kayıt ve değerlendirme seti
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{trainingDocuments.map(renderActionCard)}</div>
      </section>
    </div>
  );
}
