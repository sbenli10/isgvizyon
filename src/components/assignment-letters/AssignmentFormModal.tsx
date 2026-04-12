import { useMemo } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AssignmentType, HazardClass } from "@/lib/assignmentPdfGenerator";
import type { Company, Employee } from "@/types/companies";

export interface AssignmentFormValues {
  company_id: string;
  employee_id: string;
  start_date: string;
  duration: string;
  weekly_hours: string;
  hazard_class: HazardClass;
}

const hazardMinutes: Record<HazardClass, number> = {
  "Az Tehlikeli": 10,
  "Tehlikeli": 20,
  "Çok Tehlikeli": 40,
};

const assignmentTitles: Record<AssignmentType, string> = {
  risk_assessment_team: "Risk Değerlendirme Ekibi Atama Yazısı",
  support_staff: "Destek Elemanı Atama Yazısı",
  employee_representative: "Çalışan Temsilcisi Atama Yazısı",
};

interface AssignmentFormModalProps {
  open: boolean;
  assignmentType: AssignmentType | null;
  mode: "create" | "edit";
  value: AssignmentFormValues;
  companies: Company[];
  employees: Employee[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (patch: Partial<AssignmentFormValues>) => void;
  onSubmit: () => void;
}

export function AssignmentFormModal({
  open,
  assignmentType,
  mode,
  value,
  companies,
  employees,
  saving,
  onOpenChange,
  onValueChange,
  onSubmit,
}: AssignmentFormModalProps) {
  const filteredEmployees = useMemo(
    () => employees.filter((employee) => employee.company_id === value.company_id),
    [employees, value.company_id]
  );

  const selectedCompany = companies.find((company) => company.id === value.company_id);
  const employeeCount = Number(selectedCompany?.employee_count || 0);
  const minimumMinutes = hazardMinutes[value.hazard_class];
  const suggestedWeeklyHours = employeeCount > 0 ? Number(((employeeCount * minimumMinutes) / 60 / 4).toFixed(1)) : 0;
  const enteredWeeklyHours = Number(value.weekly_hours || 0);
  const showWarning = employeeCount > 0 && enteredWeeklyHours > 0 && enteredWeeklyHours < suggestedWeeklyHours;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-slate-700/70 bg-slate-950/95 text-slate-100">
        <DialogHeader>
          <DialogTitle>{assignmentType ? assignmentTitles[assignmentType] : "Atama Yazısı"}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Firma, personel ve görevlendirme bilgilerini doldurun. Kayıt tamamlandığında resmi PDF belgesi oluşturulur.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Firma Seç</Label>
            <Select
              value={value.company_id || undefined}
              onValueChange={(selected) => onValueChange({ company_id: selected, employee_id: "" })}
            >
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
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Personel Seç</Label>
            <Select value={value.employee_id || undefined} onValueChange={(selected) => onValueChange({ employee_id: selected })}>
              <SelectTrigger>
                <SelectValue placeholder={value.company_id ? "Personel seçin" : "Önce firma seçin"} />
              </SelectTrigger>
              <SelectContent>
                {filteredEmployees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.first_name} {employee.last_name} - {employee.job_title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Atama Başlangıç Tarihi</Label>
            <Input type="date" value={value.start_date} onChange={(event) => onValueChange({ start_date: event.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Görev Süresi (Ay)</Label>
            <Input
              type="number"
              min="1"
              value={value.duration}
              onChange={(event) => onValueChange({ duration: event.target.value })}
              placeholder="Örn: 12"
            />
          </div>

          <div className="space-y-2">
            <Label>Haftalık Çalışma Saati</Label>
            <Input
              type="number"
              min="1"
              step="0.5"
              value={value.weekly_hours}
              onChange={(event) => onValueChange({ weekly_hours: event.target.value })}
              placeholder="Örn: 2"
            />
          </div>

          <div className="space-y-2">
            <Label>Tehlike Sınıfı</Label>
            <Select value={value.hazard_class} onValueChange={(selected: HazardClass) => onValueChange({ hazard_class: selected })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Az Tehlikeli">Az Tehlikeli</SelectItem>
                <SelectItem value="Tehlikeli">Tehlikeli</SelectItem>
                <SelectItem value="Çok Tehlikeli">Çok Tehlikeli</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold">Minimum süre bilgilendirmesi</p>
              <p>{value.hazard_class} sınıfında çalışan başına minimum süre {minimumMinutes} dk olarak dikkate alınır.</p>
              {employeeCount > 0 ? (
                <p>Seçilen firmada kayıtlı {employeeCount} çalışan bulunuyor. Bu durumda önerilen haftalık süre yaklaşık {suggestedWeeklyHours} saat olur.</p>
              ) : (
                <p>Firma çalışan sayısı bulunamadığı için sadece sınıf bazlı süre bilgisi gösteriliyor.</p>
              )}
              {showWarning ? <p className="font-medium text-amber-200">Girilen haftalık süre önerilen minimum değerin altında görünüyor.</p> : null}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Vazgeç
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "edit" ? "Kaydet ve PDF Güncelle" : "Belgeyi Oluştur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
