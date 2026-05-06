import { ClipboardCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const ORIENTATION_TOPICS = [
  "Şirket Tanıtımı",
  "İş ve Paydos Saatleri ve Servis Bilgileri",
  "Yapılan İşin Tanıtımı",
  "İş Yeri Kuralları, İç Yönetmelik, Disiplin Yönetmeliği Eğitimi",
  "Temel İş Sağlığı ve Güvenliği Eğitimi",
  "İşyerine Özgü Riskler ve Korunma Tedbirleri",
  "Yangın Eğitimi",
  "Kalite Sistemi Genel Bilinçlendirme Eğitimi",
] as const;

export const ONBOARDING_TOPICS = [
  "Kullanacağı Makine Bilgisi",
  "Güvenli Makine Kullanımı Eğitimi",
  "İş Tarifi ve Pratiği Eğitimi",
  "Muhtemel Bir Uygunsuzluk veya Yapılacak Hatanın Bir Sonraki Adıma Etkisi Ne olacak?",
] as const;

export type TopicStatus = "provided" | "not_provided" | null;

export interface OrientationOnboardingTrainingFormValues {
  full_name: string;
  birth_place_year: string;
  start_date: string;
  education_level: string;
  position: string;
  orientation_duration: string;
  orientation_topics: Record<string, TopicStatus>;
  orientation_trainer: string;
  onboarding_duration: string;
  onboarding_topics: Record<string, TopicStatus>;
  onboarding_trainer: string;
  notes: string;
  trainee_signature_name: string;
  employer_signature_name: string;
}

interface OrientationOnboardingTrainingModalProps {
  open: boolean;
  value: OrientationOnboardingTrainingFormValues;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (patch: Partial<OrientationOnboardingTrainingFormValues>) => void;
  onTopicStatusChange: (section: "orientation_topics" | "onboarding_topics", topic: string, status: TopicStatus) => void;
  onSubmit: () => void;
}

export function OrientationOnboardingTrainingModal({
  open,
  value,
  saving,
  onOpenChange,
  onValueChange,
  onTopicStatusChange,
  onSubmit,
}: OrientationOnboardingTrainingModalProps) {
  const renderTopicRows = (section: "orientation_topics" | "onboarding_topics", topics: readonly string[]) => (
    <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
      {topics.map((topic) => {
        const status = value[section][topic] ?? null;
        return (
          <div key={topic} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-medium text-foreground">{topic}</div>
            <div className="flex items-center gap-5 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox checked={status === "provided"} onCheckedChange={(checked) => onTopicStatusChange(section, topic, checked ? "provided" : null)} />
                <span>Verildi</span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox checked={status === "not_provided"} onCheckedChange={(checked) => onTopicStatusChange(section, topic, checked ? "not_provided" : null)} />
                <span>Verilmedi</span>
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto border-border bg-card text-foreground sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Oryantasyon ve İşbaşı Eğitimi Formu
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Tüm alanlar manuel girilir. Oryantasyon ve işbaşı eğitim konularını işaretleyerek Word çıktısı oluşturabilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Adı Soyadı</Label>
            <Input value={value.full_name} onChange={(event) => onValueChange({ full_name: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Doğum Yeri ve Yılı</Label>
            <Input value={value.birth_place_year} onChange={(event) => onValueChange({ birth_place_year: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>İşe Giriş Tarihi</Label>
            <Input value={value.start_date} onChange={(event) => onValueChange({ start_date: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Öğrenim Durumu</Label>
            <Input value={value.education_level} onChange={(event) => onValueChange({ education_level: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label>Pozisyonu</Label>
            <Input value={value.position} onChange={(event) => onValueChange({ position: event.target.value })} />
          </div>

          <div className="space-y-3 md:col-span-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_160px] sm:items-end">
              <div>
                <Label>1- Oryantasyon Eğitimi Konuları</Label>
              </div>
              <div className="space-y-2">
                <Label>Süresi</Label>
                <Input value={value.orientation_duration} onChange={(event) => onValueChange({ orientation_duration: event.target.value })} />
              </div>
            </div>
            {renderTopicRows("orientation_topics", ORIENTATION_TOPICS)}
            <div className="space-y-2">
              <Label>Eğitimi Veren Ad Soyad - İmza</Label>
              <Input value={value.orientation_trainer} onChange={(event) => onValueChange({ orientation_trainer: event.target.value })} />
            </div>
          </div>

          <div className="space-y-3 md:col-span-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_160px] sm:items-end">
              <div>
                <Label>2- İşbaşı Eğitimi Konuları</Label>
              </div>
              <div className="space-y-2">
                <Label>Süresi</Label>
                <Input value={value.onboarding_duration} onChange={(event) => onValueChange({ onboarding_duration: event.target.value })} />
              </div>
            </div>
            {renderTopicRows("onboarding_topics", ONBOARDING_TOPICS)}
            <div className="space-y-2">
              <Label>Eğitimi Veren Ad Soyad - İmza</Label>
              <Input value={value.onboarding_trainer} onChange={(event) => onValueChange({ onboarding_trainer: event.target.value })} />
            </div>
          </div>

          <div className="space-y-2 md:col-span-4">
            <Label>Açıklama ve Notlar</Label>
            <Textarea value={value.notes} onChange={(event) => onValueChange({ notes: event.target.value })} className="min-h-[140px]" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Eğitimi Alan Personelin Adı Soyadı / İmzası</Label>
            <Input value={value.trainee_signature_name} onChange={(event) => onValueChange({ trainee_signature_name: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>İşveren / İ.Vekili Adı Soyadı / İmzası</Label>
            <Input value={value.employer_signature_name} onChange={(event) => onValueChange({ employer_signature_name: event.target.value })} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Vazgeç
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Word Formu Oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
