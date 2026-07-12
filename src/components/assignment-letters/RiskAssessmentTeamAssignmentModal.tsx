import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProfileCompanyDocumentFields, getProfileCompanyRegistryNo } from "@/lib/companyDocumentPrefill";
import {
  generateRiskAssessmentTeamAssignmentDocx,
  type RiskAssessmentTeamMember,
} from "@/lib/riskAssessmentTeamAssignmentExport";
import type { Company, Employee } from "@/types/companies";

const defaultMembers: RiskAssessmentTeamMember[] = [
  { role: "İşveren / İ.Vekili", fullName: "" },
  { role: "İş Güvenliği Uzmanı", fullName: "" },
  { role: "İşyeri Hekimi", fullName: "" },
  { role: "Çalışan Baş Temsilcisi", fullName: "" },
  { role: "Tüm Br. Bilgi Sahibi Kişi", fullName: "" },
  { role: "Söndürme Ekip Başkanı", fullName: "" },
  { role: "Kurtarma Ekip Başkanı", fullName: "" },
  { role: "Koruma Ekip Başkanı", fullName: "" },
  { role: "İlk Yardım Ekip Başkanı", fullName: "" },
];

type RiskAssessmentTeamAssignmentModalProps = {
  open: boolean;
  companies: Company[];
  employees: Employee[];
  onOpenChange: (open: boolean) => void;
};

const employeeFullName = (employee: Employee) =>
  (employee.full_name || `${employee.first_name || ""} ${employee.last_name || ""}`).replace(/\s+/g, " ").trim();

const findEmployeeByName = (employees: Employee[], name?: string | null) => {
  const normalized = (name || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  return employees.find((employee) => employeeFullName(employee).toLocaleLowerCase("tr-TR") === normalized) || null;
};

export function RiskAssessmentTeamAssignmentModal({
  open,
  companies,
  employees,
  onOpenChange,
}: RiskAssessmentTeamAssignmentModalProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [workplaceTitle, setWorkplaceTitle] = useState("");
  const [workplaceRegistrationNo, setWorkplaceRegistrationNo] = useState("");
  const [revisionDate, setRevisionDate] = useState(new Date().toISOString().slice(0, 10));
  const [members, setMembers] = useState<RiskAssessmentTeamMember[]>(defaultMembers);
  const [notifiedByName, setNotifiedByName] = useState("");
  const [exporting, setExporting] = useState(false);

  const resetForm = () => {
    setSelectedCompanyId("");
    setWorkplaceTitle("");
    setWorkplaceRegistrationNo("");
    setRevisionDate(new Date().toISOString().slice(0, 10));
    setMembers(defaultMembers);
    setNotifiedByName("");
  };

  const handleCompanySelect = (companyId: string) => {
    const company = companies.find((item) => item.id === companyId);
    setSelectedCompanyId(companyId);

    if (!company) return;

    const fields = getProfileCompanyDocumentFields(company);
    const companyEmployees = employees.filter((employee) => employee.company_id === companyId);
    const knownEmployee = findEmployeeByName(companyEmployees, fields.knowledgeableEmployeeName);

    const nextMembers: RiskAssessmentTeamMember[] = [
      { role: "İşveren / İ.Vekili", fullName: fields.employerRepresentativeName },
      { role: "İş Güvenliği Uzmanı", fullName: fields.occupationalSafetySpecialistName },
      { role: "İşyeri Hekimi", fullName: fields.workplaceDoctorName },
      { role: "Çalışan Baş Temsilcisi", fullName: fields.employeeRepresentativeName },
      { role: "Tüm Br. Bilgi Sahibi Kişi", fullName: fields.knowledgeableEmployeeName || (knownEmployee ? employeeFullName(knownEmployee) : "") },
      { role: "Söndürme Ekip Başkanı", fullName: fields.fireSupportPersonName },
      { role: "Kurtarma Ekip Başkanı", fullName: fields.evacuationSupportPersonName },
      { role: "Koruma Ekip Başkanı", fullName: "" },
      { role: "İlk Yardım Ekip Başkanı", fullName: fields.firstAidSupportPersonName },
    ];

    setWorkplaceTitle(company.company_name || "");
    setWorkplaceRegistrationNo(getProfileCompanyRegistryNo(company));
    setMembers(nextMembers);
    setNotifiedByName(fields.employerRepresentativeName);
  };

  const updateMember = (index: number, patch: Partial<RiskAssessmentTeamMember>) => {
    setMembers((prev) => prev.map((member, itemIndex) => (itemIndex === index ? { ...member, ...patch } : member)));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await generateRiskAssessmentTeamAssignmentDocx({
        workplaceTitle,
        workplaceRegistrationNo,
        revisionDate,
        members,
        notifiedByName,
      });
      toast.success("Risk değerlendirme ekibi ataması Word çıktısı hazırlandı.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Risk değerlendirme ekibi ataması oluşturulamadı.";
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
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto border-border bg-card text-foreground sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Risk Değerlendirme Ekibi Ataması</DialogTitle>
          <DialogDescription>
            Şablondaki işyeri bilgileri, ekip üyeleri ve tebliğ eden alanlarını doldurarak Word çıktısı oluşturun.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">İşyeri Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="risk-team-company-select">Firma seçimi</Label>
                <Select value={selectedCompanyId} onValueChange={handleCompanySelect}>
                  <SelectTrigger id="risk-team-company-select">
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
                <Label htmlFor="risk-team-revision-date">Hazırlama / Güncelleme Tarihi</Label>
                <Input
                  id="risk-team-revision-date"
                  type="date"
                  value={revisionDate}
                  onChange={(event) => setRevisionDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-team-workplace-title">İşyeri unvanı</Label>
                <Input
                  id="risk-team-workplace-title"
                  value={workplaceTitle}
                  onChange={(event) => setWorkplaceTitle(event.target.value)}
                  placeholder="İşyeri unvanı"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-team-registry-no">İşyeri sicil no</Label>
                <Input
                  id="risk-team-registry-no"
                  value={workplaceRegistrationNo}
                  onChange={(event) => setWorkplaceRegistrationNo(event.target.value)}
                  placeholder="SGK / işyeri sicil no"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Risk Değerlendirme Ekibi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-2xl border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[240px]">Adı Soyadı</TableHead>
                      <TableHead className="min-w-[260px]">Görevi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input
                            value={member.fullName}
                            onChange={(event) => updateMember(index, { fullName: event.target.value })}
                            placeholder="Adı Soyadı"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={member.role}
                            onChange={(event) => updateMember(index, { role: event.target.value })}
                            placeholder="Görevi"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tebliğ Eden</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="risk-team-notified-by">İşveren / İ. Vekili</Label>
              <Input
                id="risk-team-notified-by"
                value={notifiedByName}
                onChange={(event) => setNotifiedByName(event.target.value)}
                placeholder="Tebliğ eden adı soyadı"
              />
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={resetForm}>
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
            >
              Kapat
            </Button>
            <Button type="button" onClick={handleExport} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />
              Word Olarak İndir
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
