import { useMemo } from "react";
import { Loader2, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Company, Employee } from "@/types/companies";

export interface EmployeeRepresentativeAppointmentFormValues {
  company_mode: "system" | "manual";
  company_id: string;
  manual_company_name: string;
  workplace_title: string;
  workplace_address: string;
  sgk_registration_no: string;
  employee_mode: "system" | "manual";
  employee_id: string;
  representative_name: string;
  representative_tc: string;
  representative_title: string;
  representative_department: string;
  appointment_date: string;
  document_number: string;
  representative_type: string;
  appointment_reason: string;
  legal_basis: string;
  duties_and_authorities: string;
  communication_method: string;
  training_commitment: string;
  employer_name: string;
  employer_title: string;
  employee_signature_name: string;
  additional_notes: string;
}

interface EmployeeRepresentativeAppointmentModalProps {
  open: boolean;
  value: EmployeeRepresentativeAppointmentFormValues;
  companies: Company[];
  employees: Employee[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (patch: Partial<EmployeeRepresentativeAppointmentFormValues>) => void;
  onSubmit: () => void;
}

export function EmployeeRepresentativeAppointmentModal({
  open,
  value,
  companies,
  employees,
  saving,
  onOpenChange,
  onValueChange,
  onSubmit,
}: EmployeeRepresentativeAppointmentModalProps) {
  const filteredEmployees = useMemo(
    () => (value.company_mode === "system" ? employees.filter((employee) => employee.company_id === value.company_id) : []),
    [employees, value.company_id, value.company_mode],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto border-border bg-card text-foreground sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users2 className="h-5 w-5 text-primary" />
            İş Sağlığı ve Güvenliği Çalışan Temsilcisi Ataması
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Firma ve çalışan bilgilerini sistemden seçebilir veya manuel girebilirsiniz. Belge çok sayfalı resmi Word formatında hazırlanır.
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
                      company_id: "",
                      employee_mode: checked ? "manual" : value.employee_mode,
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
              <Label>Çalışan temsilcisi</Label>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Manuel giriş</span>
                <Switch
                  checked={value.employee_mode === "manual"}
                  onCheckedChange={(checked) =>
                    onValueChange({
                      employee_mode: checked ? "manual" : "system",
                      employee_id: "",
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
              <Input value={value.representative_name} onChange={(event) => onValueChange({ representative_name: event.target.value })} placeholder="Ad soyad girin" />
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>İşyeri Adı / Ünvanı</Label>
            <Input value={value.workplace_title} onChange={(event) => onValueChange({ workplace_title: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>SGK Sicil No</Label>
            <Input value={value.sgk_registration_no} onChange={(event) => onValueChange({ sgk_registration_no: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label>İşyeri Adresi</Label>
            <Textarea value={value.workplace_address} onChange={(event) => onValueChange({ workplace_address: event.target.value })} className="min-h-[90px]" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Çalışan Temsilcisi Adı Soyadı</Label>
            <Input value={value.representative_name} onChange={(event) => onValueChange({ representative_name: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>T.C. Kimlik No</Label>
            <Input value={value.representative_tc} onChange={(event) => onValueChange({ representative_tc: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Görev Ünvanı</Label>
            <Input value={value.representative_title} onChange={(event) => onValueChange({ representative_title: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Bölüm / Birim</Label>
            <Input value={value.representative_department} onChange={(event) => onValueChange({ representative_department: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Atama Tarihi</Label>
            <Input type="date" value={value.appointment_date} onChange={(event) => onValueChange({ appointment_date: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Belge / Karar No</Label>
            <Input value={value.document_number} onChange={(event) => onValueChange({ document_number: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Temsilci Türü</Label>
            <Input value={value.representative_type} onChange={(event) => onValueChange({ representative_type: event.target.value })} placeholder="Örn: Çalışan Temsilcisi / Baş Temsilci" />
          </div>

          <div className="space-y-2 md:col-span-4">
            <Label>Atama Gerekçesi</Label>
            <Textarea value={value.appointment_reason} onChange={(event) => onValueChange({ appointment_reason: event.target.value })} className="min-h-[110px]" />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label>Dayanak / Mevzuat</Label>
            <Textarea value={value.legal_basis} onChange={(event) => onValueChange({ legal_basis: event.target.value })} className="min-h-[110px]" />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label>Görev, Yetki ve Sorumluluklar</Label>
            <Textarea value={value.duties_and_authorities} onChange={(event) => onValueChange({ duties_and_authorities: event.target.value })} className="min-h-[180px]" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>İletişim / Bildirim Yöntemi</Label>
            <Textarea value={value.communication_method} onChange={(event) => onValueChange({ communication_method: event.target.value })} className="min-h-[110px]" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Eğitim / Bilgilendirme Taahhüdü</Label>
            <Textarea value={value.training_commitment} onChange={(event) => onValueChange({ training_commitment: event.target.value })} className="min-h-[110px]" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>İşveren / İşveren Vekili</Label>
            <Input value={value.employer_name} onChange={(event) => onValueChange({ employer_name: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>İşveren Unvanı</Label>
            <Input value={value.employer_title} onChange={(event) => onValueChange({ employer_title: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Temsilci İmza Adı</Label>
            <Input value={value.employee_signature_name} onChange={(event) => onValueChange({ employee_signature_name: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label>Ek Notlar</Label>
            <Textarea value={value.additional_notes} onChange={(event) => onValueChange({ additional_notes: event.target.value })} className="min-h-[120px]" />
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
