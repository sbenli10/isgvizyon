import { useMemo } from "react";
import { AlertOctagon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Company, Employee } from "@/types/companies";

export const ROOT_CAUSE_EVENT_TYPES = [
  "Yaralanma/Meslek Hastalığı",
  "Tehlikeli Durum",
  "Tehlikeli Davranış",
  "Çevre Hasarı",
  "Maddi Hasar",
  "Diğer",
] as const;

export const ROOT_CAUSE_BODY_PARTS = ["Baş", "Göz", "Kol", "Bacak", "Yüz", "El", "Ayak", "Gövde", "Diğer"] as const;

export interface RootCauseInvestigationFormValues {
  company_mode: "system" | "manual";
  company_id: string;
  manual_company_name: string;
  employee_mode: "system" | "manual";
  employee_id: string;
  unit_name: string;
  location: string;
  event_types: string[];
  other_event_type: string;
  event_date: string;
  event_time: string;
  task_title: string;
  treatment_duration: string;
  unit_chief: string;
  lost_time: string;
  injured_name: string;
  treating_person: string;
  body_parts: string[];
  other_body_part: string;
  damaged_equipment: string;
  incident_description: string;
  unit_chief_opinion: string;
  safety_expert_name: string;
  workplace_doctor_name: string;
  board_member_name: string;
  other_evaluator_name: string;
  recommended_measures: string;
}

interface RootCauseInvestigationModalProps {
  open: boolean;
  value: RootCauseInvestigationFormValues;
  companies: Company[];
  employees: Employee[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (patch: Partial<RootCauseInvestigationFormValues>) => void;
  onToggleEventType: (type: string, checked: boolean) => void;
  onToggleBodyPart: (part: string, checked: boolean) => void;
  onSubmit: () => void;
}

export function RootCauseInvestigationModal({
  open,
  value,
  companies,
  employees,
  saving,
  onOpenChange,
  onValueChange,
  onToggleEventType,
  onToggleBodyPart,
  onSubmit,
}: RootCauseInvestigationModalProps) {
  const filteredEmployees = useMemo(
    () => (value.company_mode === "system" ? employees.filter((employee) => employee.company_id === value.company_id) : []),
    [employees, value.company_id, value.company_mode],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto border-border bg-card text-foreground sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertOctagon className="h-5 w-5 text-primary" />
            İş Kazası/Güvensiz Davranış Kök Neden Araştırma Formu
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Form alanlarını doldurun, kaza/olay tipi ve yaralanan vücut bölgesini işaretleyin. Çıktı resmi Word formatında hazırlanır.
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
              <Input
                value={value.manual_company_name}
                onChange={(event) => onValueChange({ manual_company_name: event.target.value })}
                placeholder="Firma adını manuel girin"
              />
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Kazazede bilgisi</Label>
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
              <Input value={value.injured_name} onChange={(event) => onValueChange({ injured_name: event.target.value })} placeholder="Kazazede adını manuel girin" />
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Birim</Label>
            <Input value={value.unit_name} onChange={(event) => onValueChange({ unit_name: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Olayın meydana geldiği yer</Label>
            <Input value={value.location} onChange={(event) => onValueChange({ location: event.target.value })} />
          </div>

          <div className="space-y-3 md:col-span-4">
            <Label>Kaza / Olay Tipi</Label>
            <div className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-4 md:grid-cols-2">
              {ROOT_CAUSE_EVENT_TYPES.map((type) => (
                <div key={type} className="flex items-center gap-3">
                  <Checkbox checked={value.event_types.includes(type)} onCheckedChange={(checked) => onToggleEventType(type, checked === true)} />
                  <span className="text-sm">{type}</span>
                </div>
              ))}
              {value.event_types.includes("Diğer") ? (
                <div className="md:col-span-2">
                  <Input
                    value={value.other_event_type}
                    onChange={(event) => onValueChange({ other_event_type: event.target.value })}
                    placeholder="Diğer olay tipi açıklaması"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Olay tarihi</Label>
            <Input type="date" value={value.event_date} onChange={(event) => onValueChange({ event_date: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Olay saati</Label>
            <Input type="time" value={value.event_time} onChange={(event) => onValueChange({ event_time: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Görevi</Label>
            <Input value={value.task_title} onChange={(event) => onValueChange({ task_title: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Tedavi süresi</Label>
            <Input value={value.treatment_duration} onChange={(event) => onValueChange({ treatment_duration: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Birim amiri</Label>
            <Input value={value.unit_chief} onChange={(event) => onValueChange({ unit_chief: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Kaybedilen süre</Label>
            <Input value={value.lost_time} onChange={(event) => onValueChange({ lost_time: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Kazazede (ad-soyad)</Label>
            <Input value={value.injured_name} onChange={(event) => onValueChange({ injured_name: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Tedavi eden</Label>
            <Input value={value.treating_person} onChange={(event) => onValueChange({ treating_person: event.target.value })} />
          </div>

          <div className="space-y-3 md:col-span-4">
            <Label>Yaralanan Vücut Bölgesi</Label>
            <div className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-4 md:grid-cols-5">
              {ROOT_CAUSE_BODY_PARTS.map((part) => (
                <div key={part} className="flex items-center gap-3">
                  <Checkbox checked={value.body_parts.includes(part)} onCheckedChange={(checked) => onToggleBodyPart(part, checked === true)} />
                  <span className="text-sm">{part}</span>
                </div>
              ))}
              {value.body_parts.includes("Diğer") ? (
                <div className="md:col-span-5">
                  <Input value={value.other_body_part} onChange={(event) => onValueChange({ other_body_part: event.target.value })} placeholder="Diğer vücut bölgesi" />
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-2 md:col-span-4">
            <Label>Zarar gören ekipman</Label>
            <Input value={value.damaged_equipment} onChange={(event) => onValueChange({ damaged_equipment: event.target.value })} />
          </div>

          <div className="space-y-2 md:col-span-4">
            <Label>Kaza/Olay/Meslek Hastalığı Tanımı</Label>
            <Textarea value={value.incident_description} onChange={(event) => onValueChange({ incident_description: event.target.value })} className="min-h-[180px]" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Bölüm amiri görüşü</Label>
            <Textarea value={value.unit_chief_opinion} onChange={(event) => onValueChange({ unit_chief_opinion: event.target.value })} className="min-h-[180px]" />
          </div>
          <div className="space-y-3 md:col-span-2">
            <div className="space-y-2">
              <Label>İSG Uzmanı</Label>
              <Input value={value.safety_expert_name} onChange={(event) => onValueChange({ safety_expert_name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>İşyeri Hekimi</Label>
              <Input value={value.workplace_doctor_name} onChange={(event) => onValueChange({ workplace_doctor_name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>İSG Kurul Üyesi</Label>
              <Input value={value.board_member_name} onChange={(event) => onValueChange({ board_member_name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Diğer</Label>
              <Input value={value.other_evaluator_name} onChange={(event) => onValueChange({ other_evaluator_name: event.target.value })} />
            </div>
          </div>

          <div className="space-y-2 md:col-span-4">
            <Label>Önerilen önlemler</Label>
            <Textarea value={value.recommended_measures} onChange={(event) => onValueChange({ recommended_measures: event.target.value })} className="min-h-[160px]" />
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
