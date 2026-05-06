import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const DRILL_FORM_TYPES = [
  "Yangın",
  "Patlama",
  "Doğal Afet",
  "Tehlikeli Kimyasal, Biyolojik, Radyoaktif",
  "Zehirlenme veya Salgın Hastalıklar ve Nükleer Maddelerden Kaynaklanan Yayılım",
  "Sabotaj",
  "Diğer",
] as const;

export interface DrillFormValues {
  workplace_name: string;
  drill_name: string;
  drill_date: string;
  drill_types: string[];
  other_drill_type: string;
  participant_count: string;
  assembly_count_result: string;
  start_time: string;
  end_time: string;
  drill_subject: string;
  drill_purpose: string;
  post_drill_evaluation: string;
  things_done_correctly: string;
  things_done_wrong: string;
  conclusions: string;
  conductor_name: string;
  conductor_title: string;
  approver_name: string;
}

interface DrillFormModalProps {
  open: boolean;
  value: DrillFormValues;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (patch: Partial<DrillFormValues>) => void;
  onToggleDrillType: (type: string, checked: boolean) => void;
  onSubmit: () => void;
}

export function DrillFormModal({
  open,
  value,
  saving,
  onOpenChange,
  onValueChange,
  onToggleDrillType,
  onSubmit,
}: DrillFormModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto border-border bg-card text-foreground sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Tatbikat Formu
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Bu formdaki tüm alanlar manuel girilir. Tatbikat türü seçimini işaretleyin; Word çıktısı aynı şekilde hazırlanır.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-4">
          <div className="space-y-2 md:col-span-4">
            <Label>İşyeri Adı/Unvanı</Label>
            <Input value={value.workplace_name} onChange={(event) => onValueChange({ workplace_name: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Tatbikat Adı</Label>
            <Input value={value.drill_name} onChange={(event) => onValueChange({ drill_name: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Tatbikat Tarihi</Label>
            <Input type="date" value={value.drill_date} onChange={(event) => onValueChange({ drill_date: event.target.value })} />
          </div>

          <div className="space-y-3 md:col-span-4">
            <Label>Tatbikat Türü</Label>
            <div className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-4 md:grid-cols-2">
              {DRILL_FORM_TYPES.map((type) => (
                <div key={type} className="flex items-center gap-3">
                  <Checkbox checked={value.drill_types.includes(type)} onCheckedChange={(checked) => onToggleDrillType(type, checked === true)} />
                  <span className="text-sm">{type}</span>
                </div>
              ))}
              {value.drill_types.includes("Diğer") || value.drill_types.includes("Doğal Afet") ? (
                <div className="md:col-span-2">
                  <Input value={value.other_drill_type} onChange={(event) => onValueChange({ other_drill_type: event.target.value })} placeholder="Diğer / doğal afet açıklaması" />
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Katılan Kişi Sayısı</Label>
            <Input value={value.participant_count} onChange={(event) => onValueChange({ participant_count: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Toplanma Yerindeki Sayım Sonucu</Label>
            <Input value={value.assembly_count_result} onChange={(event) => onValueChange({ assembly_count_result: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Başlangıç Saati</Label>
            <Input type="time" value={value.start_time} onChange={(event) => onValueChange({ start_time: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Bitiş Saati</Label>
            <Input type="time" value={value.end_time} onChange={(event) => onValueChange({ end_time: event.target.value })} />
          </div>

          <div className="space-y-2 md:col-span-4">
            <Label>Tatbikat Konumu</Label>
            <Textarea value={value.drill_subject} onChange={(event) => onValueChange({ drill_subject: event.target.value })} className="min-h-[100px]" />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label>Tatbikatın Amacı</Label>
            <Textarea value={value.drill_purpose} onChange={(event) => onValueChange({ drill_purpose: event.target.value })} className="min-h-[120px]" />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label>Tatbikat Sonrası Değerlendirme</Label>
            <Textarea value={value.post_drill_evaluation} onChange={(event) => onValueChange({ post_drill_evaluation: event.target.value })} className="min-h-[120px]" />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label>Tatbikat Esnasında Doğru Yapılanlar</Label>
            <Textarea value={value.things_done_correctly} onChange={(event) => onValueChange({ things_done_correctly: event.target.value })} className="min-h-[120px]" />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label>Tatbikat Esnasında Yanlış Yapılanlar</Label>
            <Textarea value={value.things_done_wrong} onChange={(event) => onValueChange({ things_done_wrong: event.target.value })} className="min-h-[120px]" />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label>Çıkarılan Sonuçlar</Label>
            <Textarea value={value.conclusions} onChange={(event) => onValueChange({ conclusions: event.target.value })} className="min-h-[120px]" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Tatbikatı Yürüten Adı Soyadı</Label>
            <Input value={value.conductor_name} onChange={(event) => onValueChange({ conductor_name: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Tatbikatı Onaylayan Adı Soyadı</Label>
            <Input value={value.approver_name} onChange={(event) => onValueChange({ approver_name: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Tatbikatı Yürüten Ünvanı</Label>
            <Input value={value.conductor_title} onChange={(event) => onValueChange({ conductor_title: event.target.value })} />
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
