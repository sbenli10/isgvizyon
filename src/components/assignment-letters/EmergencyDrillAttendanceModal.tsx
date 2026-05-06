import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface EmergencyDrillAttendanceParticipantForm {
  full_name: string;
  tc_number: string;
}

export interface EmergencyDrillAttendanceFormValues {
  drill_topic: string;
  drill_date: string;
  drill_duration: string;
  participants: EmergencyDrillAttendanceParticipantForm[];
}

interface EmergencyDrillAttendanceModalProps {
  open: boolean;
  value: EmergencyDrillAttendanceFormValues;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (patch: Partial<EmergencyDrillAttendanceFormValues>) => void;
  onParticipantChange: (index: number, patch: Partial<EmergencyDrillAttendanceParticipantForm>) => void;
  onSubmit: () => void;
}

export function EmergencyDrillAttendanceModal({
  open,
  value,
  saving,
  onOpenChange,
  onValueChange,
  onParticipantChange,
  onSubmit,
}: EmergencyDrillAttendanceModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto border-border bg-card text-foreground sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Acil Durum Tatbikatı Katılım Kayıt Formu
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Bu formdaki tüm alanlar manuel girilir. Word çıktısı iki kolonlu resmi katılım listesi formatında hazırlanır.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-3">
          <div className="space-y-2 md:col-span-3">
            <Label>Tatbikatın Konusu</Label>
            <Input value={value.drill_topic} onChange={(event) => onValueChange({ drill_topic: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Tatbikat Tarihi</Label>
            <Input type="date" value={value.drill_date} onChange={(event) => onValueChange({ drill_date: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Tatbikat Süresi</Label>
            <Input value={value.drill_duration} onChange={(event) => onValueChange({ drill_duration: event.target.value })} placeholder="Örn: 45 Dakika" />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Katılımcı Listesi</Label>
            <p className="text-xs text-muted-foreground">Toplam 96 satır Word formuna işlenir. Boş bıraktığınız satırlar boş görünür.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[0, 48].map((offset) => (
              <div key={offset} className="space-y-3 rounded-2xl border border-border bg-muted/20 p-3">
                {value.participants.slice(offset, offset + 48).map((participant, index) => {
                  const actualIndex = offset + index;
                  return (
                    <div key={actualIndex} className="grid gap-2 rounded-xl border border-border/60 bg-background/70 p-2 md:grid-cols-[56px_minmax(0,1fr)_160px]">
                      <div className="flex items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
                        {actualIndex + 1}
                      </div>
                      <Input
                        value={participant.full_name}
                        onChange={(event) => onParticipantChange(actualIndex, { full_name: event.target.value })}
                        placeholder="Ad Soyad"
                      />
                      <Input
                        value={participant.tc_number}
                        onChange={(event) => onParticipantChange(actualIndex, { tc_number: event.target.value })}
                        placeholder="TC"
                      />
                    </div>
                  );
                })}
              </div>
            ))}
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
