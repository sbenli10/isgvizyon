import { useMemo } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Company, Employee } from "@/types/companies";

export interface WorkAccidentFormValues {
  company_id: string;
  employee_id: string;
  accident_date: string;
  accident_time: string;
  injured_full_name: string;
  accident_place: string;
  injured_tc: string;
  injured_body_part: string;
  victim_statement: string;
  witness_statement: string;
  witness_name: string;
  department_chief_name: string;
  safety_expert_name: string;
  report_date: string;
  photos: File[];
}

interface WorkAccidentReportModalProps {
  open: boolean;
  value: WorkAccidentFormValues;
  companies: Company[];
  employees: Employee[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (patch: Partial<WorkAccidentFormValues>) => void;
  onSubmit: () => void;
}

export function WorkAccidentReportModal({
  open,
  value,
  companies,
  employees,
  saving,
  onOpenChange,
  onValueChange,
  onSubmit,
}: WorkAccidentReportModalProps) {
  const filteredEmployees = useMemo(
    () => employees.filter((employee) => employee.company_id === value.company_id),
    [employees, value.company_id],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto border-border bg-card text-foreground sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>İş Kazası Tutanağı</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Gerekli bilgileri doldurun, isterseniz olay fotoğraflarını ekleyin ve en sonda Word çıktısını alın.
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
            <Label>Çalışan Seç (Opsiyonel)</Label>
            <Select value={value.employee_id || undefined} onValueChange={(selected) => onValueChange({ employee_id: selected })}>
              <SelectTrigger>
                <SelectValue placeholder={value.company_id ? "Çalışan seçin" : "Önce firma seçin"} />
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
            <Label>Kaza tarihi</Label>
            <Input type="date" value={value.accident_date} onChange={(event) => onValueChange({ accident_date: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Kaza saati</Label>
            <Input type="time" value={value.accident_time} onChange={(event) => onValueChange({ accident_time: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Kazalının adı soyadı</Label>
            <Input value={value.injured_full_name} onChange={(event) => onValueChange({ injured_full_name: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Kaza yeri</Label>
            <Input value={value.accident_place} onChange={(event) => onValueChange({ accident_place: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Kazalının TC</Label>
            <Input value={value.injured_tc} onChange={(event) => onValueChange({ injured_tc: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Yaralanan bölge</Label>
            <Input value={value.injured_body_part} onChange={(event) => onValueChange({ injured_body_part: event.target.value })} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Kazanın anlatımı (Kazalıya göre)</Label>
            <Textarea
              value={value.victim_statement}
              onChange={(event) => onValueChange({ victim_statement: event.target.value })}
              className="min-h-[180px]"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Kazanın anlatımı (Tanığa göre)</Label>
            <Textarea
              value={value.witness_statement}
              onChange={(event) => onValueChange({ witness_statement: event.target.value })}
              className="min-h-[160px]"
            />
          </div>

          <div className="space-y-2">
            <Label>Tanık adı</Label>
            <Input value={value.witness_name} onChange={(event) => onValueChange({ witness_name: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Bölüm amiri</Label>
            <Input value={value.department_chief_name} onChange={(event) => onValueChange({ department_chief_name: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>İş güvenliği uzmanı</Label>
            <Input value={value.safety_expert_name} onChange={(event) => onValueChange({ safety_expert_name: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Tutanak tarihi</Label>
            <Input type="date" value={value.report_date} onChange={(event) => onValueChange({ report_date: event.target.value })} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Fotoğraflar (Opsiyonel)</Label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => onValueChange({ photos: Array.from(event.target.files || []) })}
            />
            {value.photos.length > 0 ? (
              <div className="rounded-2xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                {value.photos.length} adet fotoğraf Word çıktısına eklenecek.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold">Resmi belge notu</p>
              <p>Word çıktısında olay anlatımı alanları geniş tutulur ve eklediğiniz fotoğraflar belge sonuna eklenir.</p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Vazgeç
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Word Tutanak Oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
