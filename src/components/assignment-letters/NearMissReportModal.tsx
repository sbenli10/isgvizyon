import { useMemo } from "react";
import { Siren, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Company, Employee } from "@/types/companies";

export interface NearMissReportFormValues {
  company_mode: "system" | "manual";
  company_id: string;
  manual_company_name: string;
  employee_mode: "system" | "manual";
  employee_id: string;
  report_date: string;
  report_time: string;
  reporter_name: string;
  reporter_unit_role: string;
  is_experienced_by_reporter: boolean;
  is_witnessed_by_reporter: boolean;
  incident_description: string;
  incident_location: string;
  prevention_suggestion: string;
  safety_officer_name: string;
  planned_actions: string;
  signer_name: string;
}

interface NearMissReportModalProps {
  open: boolean;
  value: NearMissReportFormValues;
  companies: Company[];
  employees: Employee[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (patch: Partial<NearMissReportFormValues>) => void;
  onSubmit: () => void;
}

export function NearMissReportModal({
  open,
  value,
  companies,
  employees,
  saving,
  onOpenChange,
  onValueChange,
  onSubmit,
}: NearMissReportModalProps) {
  const filteredEmployees = useMemo(
    () => (value.company_mode === "system" ? employees.filter((employee) => employee.company_id === value.company_id) : []),
    [employees, value.company_id, value.company_mode],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto border-border bg-card text-foreground sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Siren className="h-5 w-5 text-primary" />
            Çalışan Güvenliği Ramak Kala Olay Bildirim Formu
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Olay bildirim bilgilerini doldurun. Firma ve çalışan alanlarını sistemden seçebilir veya manuel girebilirsiniz.
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
              <Input value={value.manual_company_name} onChange={(event) => onValueChange({ manual_company_name: event.target.value })} placeholder="Firma adını manuel girin" />
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Bildirimi yapan kişi</Label>
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
              <Input value={value.reporter_name} onChange={(event) => onValueChange({ reporter_name: event.target.value })} placeholder="Ad soyad girin" />
            )}
          </div>

          <div className="space-y-2">
            <Label>Tarih</Label>
            <Input type="date" value={value.report_date} onChange={(event) => onValueChange({ report_date: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Saat</Label>
            <Input type="time" value={value.report_time} onChange={(event) => onValueChange({ report_time: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Birimi - Görevi</Label>
            <Input value={value.reporter_unit_role} onChange={(event) => onValueChange({ reporter_unit_role: event.target.value })} />
          </div>

          <div className="space-y-3 md:col-span-4">
            <Label>Bildirimi yapan kişinin rolü</Label>
            <div className="flex flex-wrap gap-6 rounded-2xl border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                <Checkbox checked={value.is_experienced_by_reporter} onCheckedChange={(checked) => onValueChange({ is_experienced_by_reporter: checked === true })} />
                <span className="text-sm">Olayı Yaşayan</span>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox checked={value.is_witnessed_by_reporter} onCheckedChange={(checked) => onValueChange({ is_witnessed_by_reporter: checked === true })} />
                <span className="text-sm">Tanıklık Eden</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 md:col-span-4">
            <Label>Olayı Tanımlayınız</Label>
            <Textarea value={value.incident_description} onChange={(event) => onValueChange({ incident_description: event.target.value })} className="min-h-[180px]" />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label>Olay Yerini Belirtiniz</Label>
            <Input value={value.incident_location} onChange={(event) => onValueChange({ incident_location: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label>Olayın Tekrarlanmaması İçin Çözüm Öneriniz</Label>
            <Textarea value={value.prevention_suggestion} onChange={(event) => onValueChange({ prevention_suggestion: event.target.value })} className="min-h-[140px]" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>İş Güvenliği Sorumlusu</Label>
            <Input value={value.safety_officer_name} onChange={(event) => onValueChange({ safety_officer_name: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Adı/Soyadı</Label>
            <Input value={value.signer_name} onChange={(event) => onValueChange({ signer_name: event.target.value })} />
          </div>

          <div className="space-y-2 md:col-span-4">
            <Label>Yapılacak Faaliyetler</Label>
            <Textarea value={value.planned_actions} onChange={(event) => onValueChange({ planned_actions: event.target.value })} className="min-h-[180px]" />
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
