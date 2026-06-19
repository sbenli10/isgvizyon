import { useMemo, useState } from "react";
import { Download, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateIsgEntranceExamDocx, type IsgEntranceExamPayload } from "@/lib/isgEntranceExamExport";
import type { Company, Employee } from "@/types/companies";

type IsgEntranceExamForm = IsgEntranceExamPayload & {
  companyId: string;
  employeeId: string;
};

type IsgEntranceExamModalProps = {
  open: boolean;
  companies: Company[];
  employees: Employee[];
  onOpenChange: (open: boolean) => void;
};

const defaultExamForm: IsgEntranceExamForm = {
  companyId: "",
  employeeId: "",
  participantFullName: "",
  participantTcNo: "",
  trainingDate: "",
  signatureText: "",
  companyTitle: "",
  examResult: "",
};

const employeeFullName = (employee: Employee) =>
  (employee.full_name || `${employee.first_name || ""} ${employee.last_name || ""}`).replace(/\s+/g, " ").trim();

const toPayload = (form: IsgEntranceExamForm): IsgEntranceExamPayload => ({
  participantFullName: form.participantFullName,
  participantTcNo: form.participantTcNo,
  trainingDate: form.trainingDate,
  signatureText: form.signatureText,
  companyTitle: form.companyTitle,
  examResult: form.examResult,
});

export function IsgEntranceExamModal({ open, companies, employees, onOpenChange }: IsgEntranceExamModalProps) {
  const [form, setForm] = useState<IsgEntranceExamForm>(defaultExamForm);
  const [exporting, setExporting] = useState(false);

  const companyEmployees = useMemo(
    () => employees.filter((employee) => employee.company_id === form.companyId),
    [employees, form.companyId],
  );

  const resetForm = () => setForm(defaultExamForm);

  const handleCompanySelect = (companyId: string) => {
    const company = companies.find((item) => item.id === companyId);

    setForm((prev) => ({
      ...prev,
      companyId,
      employeeId: "",
      participantFullName: "",
      participantTcNo: "",
      companyTitle: company?.company_name || prev.companyTitle,
    }));
  };

  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employees.find((item) => item.id === employeeId);

    setForm((prev) => ({
      ...prev,
      employeeId,
      participantFullName: employee ? employeeFullName(employee) : prev.participantFullName,
      participantTcNo: employee?.tc_number || prev.participantTcNo,
    }));
  };

  const handleExport = async (blank = false) => {
    setExporting(true);
    try {
      await generateIsgEntranceExamDocx(blank ? toPayload(defaultExamForm) : toPayload(form));
      toast.success("İSG giriş sınavı Word çıktısı hazırlandı.");
    } catch (error) {
      console.error("ISG entrance exam export failed", error);
      const message = error instanceof Error ? error.message : "İSG giriş sınavı oluşturulamadı.";
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetForm();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] overflow-y-auto border-border bg-card text-foreground sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>İSG Giriş Sınavı</DialogTitle>
          <DialogDescription>
            Personel ve firma bilgilerini doldurarak sınav formunu Word olarak oluşturun. Tüm alanları boş bırakarak boş form da indirebilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Firma Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="isg-exam-company-select">Firma Seçimi</Label>
                <Select value={form.companyId} onValueChange={handleCompanySelect}>
                  <SelectTrigger id="isg-exam-company-select">
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
              <div className="space-y-2">
                <Label htmlFor="isg-exam-company-title">Firma Unvanı</Label>
                <Input
                  id="isg-exam-company-title"
                  value={form.companyTitle}
                  onChange={(event) => setForm((prev) => ({ ...prev, companyTitle: event.target.value }))}
                  placeholder="Firma unvanı"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Personel Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="isg-exam-employee-select">Personel Seçimi</Label>
                <Select value={form.employeeId} onValueChange={handleEmployeeSelect}>
                  <SelectTrigger id="isg-exam-employee-select">
                    <SelectValue placeholder={form.companyId ? "Personel seçin" : "Önce firma seçin"} />
                  </SelectTrigger>
                  <SelectContent>
                    {companyEmployees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employeeFullName(employee)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="isg-exam-participant-name">Adı Soyadı</Label>
                <Input
                  id="isg-exam-participant-name"
                  value={form.participantFullName}
                  onChange={(event) => setForm((prev) => ({ ...prev, participantFullName: event.target.value }))}
                  placeholder="Adı Soyadı"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="isg-exam-participant-tc">T.C. Kimlik No</Label>
                <Input
                  id="isg-exam-participant-tc"
                  value={form.participantTcNo}
                  maxLength={11}
                  onChange={(event) => setForm((prev) => ({ ...prev, participantTcNo: event.target.value }))}
                  placeholder="T.C. Kimlik No"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sınav Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="isg-exam-training-date">Eğitim Tarihi</Label>
                <Input
                  id="isg-exam-training-date"
                  type="date"
                  value={form.trainingDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, trainingDate: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="isg-exam-result">Sınav Sonucu</Label>
                <Input
                  id="isg-exam-result"
                  value={form.examResult}
                  onChange={(event) => setForm((prev) => ({ ...prev, examResult: event.target.value }))}
                  placeholder="Başarılı, Başarısız, 80/100, Geçti"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">İmza Alanı</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="isg-exam-signature">İmza metni</Label>
                <Input
                  id="isg-exam-signature"
                  value={form.signatureText}
                  onChange={(event) => setForm((prev) => ({ ...prev, signatureText: event.target.value }))}
                  placeholder="Boş bırakılabilir"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={resetForm} disabled={exporting}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Temizle
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={exporting}
            >
              Kapat
            </Button>
            <Button type="button" variant="outline" onClick={() => void handleExport(true)} disabled={exporting}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Boş Form İndir
            </Button>
            <Button type="button" onClick={() => void handleExport()} disabled={exporting}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Word Olarak İndir
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
