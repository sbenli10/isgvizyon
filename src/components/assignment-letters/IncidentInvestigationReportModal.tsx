import { Loader2, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface IncidentInvestigationReportFormValues {
  cause_activity: string;
  where_when: string;
  incident_type: string;
  incident_outcome: string;
  injured_full_name: string;
  injured_job_title: string;
  injured_department: string;
  injured_age: string;
  insured_number: string;
  service_duration: string;
  incident_description: string;
  risk_analysis_status: string;
  hazard: string;
  risk: string;
  root_cause: string;
  corrective_actions: string;
  witness_one_name: string;
  witness_one_title: string;
  witness_one_department: string;
  witness_two_name: string;
  witness_two_title: string;
  witness_two_department: string;
  witness_three_name: string;
  witness_three_title: string;
  witness_three_department: string;
  report_date: string;
  prepared_by: string;
  approved_by: string;
}

interface IncidentInvestigationReportModalProps {
  open: boolean;
  value: IncidentInvestigationReportFormValues;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (patch: Partial<IncidentInvestigationReportFormValues>) => void;
  onSubmit: () => void;
}

export function IncidentInvestigationReportModal({
  open,
  value,
  saving,
  onOpenChange,
  onValueChange,
  onSubmit,
}: IncidentInvestigationReportModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto border-border bg-card text-foreground sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NotebookPen className="h-5 w-5 text-primary" />
            Kaza / Olay Araştırma Raporu
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Bu formdaki tüm alanlar manuel girilir. Word çıktısı verdiğiniz resmi araştırma raporu formatında hazırlanır.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Kaza / Olaya neden olan faaliyet</Label>
            <Input value={value.cause_activity} onChange={(event) => onValueChange({ cause_activity: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Kaza / olay nerede ve ne zaman oldu</Label>
            <Input value={value.where_when} onChange={(event) => onValueChange({ where_when: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Kaza / olay türü</Label>
            <Input value={value.incident_type} onChange={(event) => onValueChange({ incident_type: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Kaza / olay sonucu</Label>
            <Input value={value.incident_outcome} onChange={(event) => onValueChange({ incident_outcome: event.target.value })} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Kazazede Adı Soyadı</Label>
            <Input value={value.injured_full_name} onChange={(event) => onValueChange({ injured_full_name: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Yaşı</Label>
            <Input value={value.injured_age} onChange={(event) => onValueChange({ injured_age: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Sigorta sicil no</Label>
            <Input value={value.insured_number} onChange={(event) => onValueChange({ insured_number: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Görev Ünvanı</Label>
            <Input value={value.injured_job_title} onChange={(event) => onValueChange({ injured_job_title: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Görev yaptığı bünye</Label>
            <Input value={value.injured_department} onChange={(event) => onValueChange({ injured_department: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Görev Süresi</Label>
            <Input value={value.service_duration} onChange={(event) => onValueChange({ service_duration: event.target.value })} />
          </div>

          <div className="space-y-2 md:col-span-4">
            <Label>Kaza ve Olayın Tanımlanması</Label>
            <Textarea value={value.incident_description} onChange={(event) => onValueChange({ incident_description: event.target.value })} className="min-h-[180px]" />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label>Risk analizi / kontrol süreci / kurul kararı durumu</Label>
            <Textarea value={value.risk_analysis_status} onChange={(event) => onValueChange({ risk_analysis_status: event.target.value })} className="min-h-[120px]" />
          </div>

          <div className="space-y-2 md:col-span-4">
            <Label>Tehlike</Label>
            <Input value={value.hazard} onChange={(event) => onValueChange({ hazard: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label>Risk</Label>
            <Input value={value.risk} onChange={(event) => onValueChange({ risk: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label>Kök Sebep</Label>
            <Input value={value.root_cause} onChange={(event) => onValueChange({ root_cause: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label>Düzeltici / Önleyici Faaliyetler</Label>
            <Textarea value={value.corrective_actions} onChange={(event) => onValueChange({ corrective_actions: event.target.value })} className="min-h-[160px]" />
          </div>

          {[
            ["Birinci Görgü Şahidi", "witness_one_name", "witness_one_title", "witness_one_department"],
            ["İkinci Görgü Şahidi", "witness_two_name", "witness_two_title", "witness_two_department"],
            ["Üçüncü Görgü Şahidi", "witness_three_name", "witness_three_title", "witness_three_department"],
          ].map(([label, nameKey, titleKey, departmentKey]) => (
            <div key={label} className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4 md:col-span-4">
              <div className="text-sm font-semibold text-foreground">{label}</div>
              <div className="grid gap-3 md:grid-cols-3">
                <Input value={value[nameKey as keyof IncidentInvestigationReportFormValues] as string} onChange={(event) => onValueChange({ [nameKey]: event.target.value } as Partial<IncidentInvestigationReportFormValues>)} placeholder="Adı Soyadı" />
                <Input value={value[titleKey as keyof IncidentInvestigationReportFormValues] as string} onChange={(event) => onValueChange({ [titleKey]: event.target.value } as Partial<IncidentInvestigationReportFormValues>)} placeholder="Görev Ünvanı" />
                <Input value={value[departmentKey as keyof IncidentInvestigationReportFormValues] as string} onChange={(event) => onValueChange({ [departmentKey]: event.target.value } as Partial<IncidentInvestigationReportFormValues>)} placeholder="Görev yaptığı bünye" />
              </div>
            </div>
          ))}

          <div className="space-y-2">
            <Label>Raporun düzenlenme tarihi</Label>
            <Input type="date" value={value.report_date} onChange={(event) => onValueChange({ report_date: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Raporu düzenleyen</Label>
            <Input value={value.prepared_by} onChange={(event) => onValueChange({ prepared_by: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-1">
            <Label>Raporu onaylayan</Label>
            <Input value={value.approved_by} onChange={(event) => onValueChange({ approved_by: event.target.value })} />
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
