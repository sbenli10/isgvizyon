import { useMemo } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Company, Employee } from "@/types/companies";

export interface ReturnToWorkTrainingInstructorForm {
  full_name: string;
  tc_number: string;
  title: string;
}

export interface ReturnToWorkTrainingFormValues {
  company_mode: "system" | "manual";
  company_id: string;
  employee_mode: "system" | "manual";
  employee_id: string;
  organization_name: string;
  address: string;
  sgk_registration_no: string;
  training_method: string;
  training_date: string;
  training_duration: string;
  participant_name: string;
  participant_title: string;
  participant_tc: string;
  instructors: ReturnToWorkTrainingInstructorForm[];
}

interface ReturnToWorkTrainingModalProps {
  open: boolean;
  value: ReturnToWorkTrainingFormValues;
  companies: Company[];
  employees: Employee[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (patch: Partial<ReturnToWorkTrainingFormValues>) => void;
  onInstructorChange: (index: number, patch: Partial<ReturnToWorkTrainingInstructorForm>) => void;
  onSubmit: () => void;
}

export function ReturnToWorkTrainingModal({
  open,
  value,
  companies,
  employees,
  saving,
  onOpenChange,
  onValueChange,
  onInstructorChange,
  onSubmit,
}: ReturnToWorkTrainingModalProps) {
  const filteredEmployees = useMemo(
    () =>
      value.company_mode === "system" && value.company_id
        ? employees.filter((employee) => employee.company_id === value.company_id)
        : [],
    [employees, value.company_id, value.company_mode],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto border-border bg-card text-foreground sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            İşe Dönüş İlave Eğitim Katılım Formu
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Form alanlarını doldurun. Sistemden firma ve çalışan seçebilir ya da gerekli bilgileri elle tamamlayabilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Firma seçimi</Label>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Manuel giriş</span>
                <Switch
                  checked={value.company_mode === "manual"}
                  onCheckedChange={(checked) =>
                    onValueChange({
                      company_mode: checked ? "manual" : "system",
                      company_id: checked ? "" : value.company_id,
                      employee_id: "",
                    })
                  }
                />
              </div>
            </div>
            {value.company_mode === "system" ? (
              <Select value={value.company_id || undefined} onValueChange={(selected) => onValueChange({ company_id: selected, employee_id: "" })}>
                <SelectTrigger>
                  <SelectValue placeholder="Firma seçin" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={value.organization_name} onChange={(event) => onValueChange({ organization_name: event.target.value })} placeholder="Kuruluş adını girin" />
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Katılımcı çalışan</Label>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Manuel giriş</span>
                <Switch
                  checked={value.employee_mode === "manual"}
                  onCheckedChange={(checked) =>
                    onValueChange({
                      employee_mode: checked ? "manual" : "system",
                      employee_id: checked ? "" : value.employee_id,
                    })
                  }
                />
              </div>
            </div>
            {value.employee_mode === "system" ? (
              <Select value={value.employee_id || undefined} onValueChange={(selected) => onValueChange({ employee_id: selected })}>
                <SelectTrigger>
                  <SelectValue placeholder={value.company_id ? "Çalışan seçin" : "Önce firma seçin"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredEmployees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name} {employee.job_title ? `- ${employee.job_title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={value.participant_name} onChange={(event) => onValueChange({ participant_name: event.target.value })} placeholder="Katılımcı adı soyadı" />
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Kuruluş</Label>
            <Input value={value.organization_name} onChange={(event) => onValueChange({ organization_name: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>SGK Sicil No</Label>
            <Input value={value.sgk_registration_no} onChange={(event) => onValueChange({ sgk_registration_no: event.target.value })} />
          </div>

          <div className="space-y-2 md:col-span-4">
            <Label>Adres</Label>
            <Textarea value={value.address} onChange={(event) => onValueChange({ address: event.target.value })} className="min-h-[90px]" />
          </div>

          <div className="space-y-2">
            <Label>Eğitim Şekli</Label>
            <Input value={value.training_method} onChange={(event) => onValueChange({ training_method: event.target.value })} placeholder="Örn: Yüz yüze" />
          </div>
          <div className="space-y-2">
            <Label>Eğitim Tarihi</Label>
            <Input type="date" value={value.training_date} onChange={(event) => onValueChange({ training_date: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Eğitim Süresi</Label>
            <Input value={value.training_duration} onChange={(event) => onValueChange({ training_duration: event.target.value })} placeholder="Örn: 2 Saat" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Katılımcı Adı Soyadı</Label>
            <Input value={value.participant_name} onChange={(event) => onValueChange({ participant_name: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Katılımcı Görevi</Label>
            <Input value={value.participant_title} onChange={(event) => onValueChange({ participant_title: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Katılımcı T.C. Kimlik No</Label>
            <Input value={value.participant_tc} onChange={(event) => onValueChange({ participant_tc: event.target.value })} />
          </div>

          <div className="space-y-3 md:col-span-4">
            <div>
              <Label>Eğitimde yer alan yetkililer</Label>
              <p className="text-xs text-muted-foreground">Aşağıdaki 5 satır Word formundaki eğitici/imza tablosuna aynen işlenir.</p>
            </div>
            <div className="space-y-3">
              {value.instructors.map((item, index) => (
                <div key={index} className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>#{index + 1} Adı Soyadı</Label>
                    <Input value={item.full_name} onChange={(event) => onInstructorChange(index, { full_name: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>T.C. No</Label>
                    <Input value={item.tc_number} onChange={(event) => onInstructorChange(index, { tc_number: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unvanı</Label>
                    <Input value={item.title} onChange={(event) => onInstructorChange(index, { title: event.target.value })} />
                  </div>
                </div>
              ))}
            </div>
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
