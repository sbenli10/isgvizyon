import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getProfileCompanyDocumentFields, getProfileCompanyRegistryNo } from "@/lib/companyDocumentPrefill";
import {
  generateRiskAssessmentTeamAssignmentDocx,
  RISK_ASSESSMENT_TEAM_ASSIGNMENT_ROLES,
  type RiskAssessmentTeamAssignmentMember,
} from "@/lib/riskAssessmentTeamAssignmentExport";
import type { Company } from "@/types/companies";

type RiskAssessmentTeamAssignmentModalProps = {
  open: boolean;
  companies: Company[];
  onOpenChange: (open: boolean) => void;
};

type EmergencyTeamInfoPerson = {
  full_name?: string | null;
  fullName?: string | null;
};

const emptyMembers = (): RiskAssessmentTeamAssignmentMember[] =>
  RISK_ASSESSMENT_TEAM_ASSIGNMENT_ROLES.map((role) => ({
    role,
    fullName: "",
  }));

const today = () => new Date().toISOString().slice(0, 10);

const personName = (person?: EmergencyTeamInfoPerson | null) =>
  String(person?.full_name || person?.fullName || "").trim();

const getEmergencyTeamInfo = (company?: Company | null) => {
  const source = (company as Company & { emergency_team_info?: unknown } | null)?.emergency_team_info;
  if (!source || typeof source !== "object") return {};
  return source as Record<string, EmergencyTeamInfoPerson | undefined>;
};

export function RiskAssessmentTeamAssignmentModal({
  open,
  companies,
  onOpenChange,
}: RiskAssessmentTeamAssignmentModalProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [workplaceTitle, setWorkplaceTitle] = useState("");
  const [workplaceRegistryNo, setWorkplaceRegistryNo] = useState("");
  const [documentDate, setDocumentDate] = useState(today);
  const [members, setMembers] = useState<RiskAssessmentTeamAssignmentMember[]>(emptyMembers);
  const [notifiedByName, setNotifiedByName] = useState("");
  const [exporting, setExporting] = useState(false);

  const resetForm = () => {
    setSelectedCompanyId("");
    setWorkplaceTitle("");
    setWorkplaceRegistryNo("");
    setDocumentDate(today());
    setMembers(emptyMembers());
    setNotifiedByName("");
  };

  const updateMember = (index: number, fullName: string) => {
    setMembers((prev) => prev.map((member, itemIndex) => (itemIndex === index ? { ...member, fullName } : member)));
  };

  const handleCompanySelect = (companyId: string) => {
    const company = companies.find((item) => item.id === companyId);
    setSelectedCompanyId(companyId);

    if (!company) return;

    const fields = getProfileCompanyDocumentFields(company);
    const emergencyTeamInfo = getEmergencyTeamInfo(company);
    const employerName = fields.employerRepresentativeName;

    setWorkplaceTitle(company.company_name || "");
    setWorkplaceRegistryNo(getProfileCompanyRegistryNo(company));
    setNotifiedByName(employerName);
    setMembers([
      { role: "İşveren / İ. Vekili", fullName: employerName },
      { role: "İş Güvenliği Uzmanı", fullName: fields.occupationalSafetySpecialistName },
      { role: "İşyeri Hekimi", fullName: fields.workplaceDoctorName },
      { role: "Çalışan Baş Temsilcisi", fullName: fields.employeeRepresentativeName },
      {
        role: "Tüm Br. Bilgi Sahibi Kişi",
        fullName: personName(emergencyTeamInfo.all_units_contact) || fields.knowledgeableEmployeeName,
      },
      {
        role: "Söndürme Ekip Başkanı",
        fullName: personName(emergencyTeamInfo.fire_chief) || fields.fireSupportPersonName,
      },
      {
        role: "Kurtarma Ekip Başkanı",
        fullName: personName(emergencyTeamInfo.rescue_chief) || fields.evacuationSupportPersonName,
      },
      {
        role: "Koruma Ekip Başkanı",
        fullName: personName(emergencyTeamInfo.protection_chief),
      },
      {
        role: "İlk Yardım Ekip Başkanı",
        fullName: personName(emergencyTeamInfo.first_aid_chief) || fields.firstAidSupportPersonName,
      },
    ]);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await generateRiskAssessmentTeamAssignmentDocx({
        workplaceTitle,
        workplaceRegistryNo,
        documentDate,
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
            İşyeri bilgileri ve ekip üyelerini doldurarak resmi Word şablonunu indirin.
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
                <Label htmlFor="risk-team-document-date">Hazırlama/Güncelleme Tarihi</Label>
                <Input
                  id="risk-team-document-date"
                  type="date"
                  value={documentDate}
                  onChange={(event) => setDocumentDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-team-workplace-title">İşyeri Ünvanı</Label>
                <Input
                  id="risk-team-workplace-title"
                  value={workplaceTitle}
                  onChange={(event) => setWorkplaceTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-team-registry-no">İşyeri Sicil No</Label>
                <Input
                  id="risk-team-registry-no"
                  value={workplaceRegistryNo}
                  onChange={(event) => setWorkplaceRegistryNo(event.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Risk Değerlendirme Ekibi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {members.map((member, index) => (
                <div key={member.role} className="grid gap-2 rounded-xl border border-border/60 bg-card/70 p-2 md:grid-cols-[minmax(0,1fr)_260px]">
                  <Input
                    value={member.fullName}
                    onChange={(event) => updateMember(index, event.target.value)}
                    placeholder="Adı Soyadı"
                  />
                  <div className="flex items-center rounded-lg bg-muted px-3 text-sm font-medium text-muted-foreground">
                    {member.role}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tebliğ Eden</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="risk-team-notified-by">İşveren / İ. Vekili</Label>
                <Input
                  id="risk-team-notified-by"
                  value={notifiedByName}
                  onChange={(event) => setNotifiedByName(event.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            Vazgeç
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Hazırlanıyor..." : "Word Formu Oluştur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
