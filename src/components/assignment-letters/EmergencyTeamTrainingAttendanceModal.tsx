import { useMemo, useState } from "react";
import { Download, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getProfileCompanyDocumentFields } from "@/lib/companyDocumentPrefill";
import {
  DEFAULT_EMERGENCY_TEAM_TOPICS,
  EMERGENCY_TEAM_OPTIONS,
  generateEmergencyTeamTrainingAttendanceDocx,
  type EmergencyTeamTrainingParticipant,
} from "@/lib/emergencyTeamTrainingAttendanceExport";
import type { Company, Employee } from "@/types/companies";

const PARTICIPANT_LIMIT = 22;

type EmergencyTeamTrainingAttendanceModalProps = {
  open: boolean;
  companies: Company[];
  employees: Employee[];
  onOpenChange: (open: boolean) => void;
};

const defaultTeamForRow = (index: number) => {
  if (index < 4) return "SÖNDÜRME EKİBİ";
  if (index < 8) return "KURTARMA EKİBİ";
  if (index < 12) return "KORUMA EKİBİ";
  return "İLK YARDIM EKİBİ";
};

const emptyParticipants = (): EmergencyTeamTrainingParticipant[] =>
  Array.from({ length: PARTICIPANT_LIMIT }, (_, index) => ({
    fullName: "",
    tcNo: "",
    team: defaultTeamForRow(index),
  }));

const employeeFullName = (employee: Employee) =>
  (employee.full_name || `${employee.first_name || ""} ${employee.last_name || ""}`).replace(/\s+/g, " ").trim();

const companyAddress = (company?: Company | null) =>
  [company?.address, company?.district, company?.city].filter(Boolean).join(", ");

export function EmergencyTeamTrainingAttendanceModal({
  open,
  companies,
  employees,
  onOpenChange,
}: EmergencyTeamTrainingAttendanceModalProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [trainingTopics, setTrainingTopics] = useState(DEFAULT_EMERGENCY_TEAM_TOPICS);
  const [trainingDate, setTrainingDate] = useState("");
  const [trainingPlace, setTrainingPlace] = useState("");
  const [participants, setParticipants] = useState<EmergencyTeamTrainingParticipant[]>(emptyParticipants);
  const [signatures, setSignatures] = useState({
    safetyExpertName: "",
    workplaceDoctorName: "",
    employerName: "",
  });
  const [exporting, setExporting] = useState(false);

  const companyEmployees = useMemo(
    () => employees.filter((employee) => employee.company_id === selectedCompanyId),
    [employees, selectedCompanyId],
  );

  const resetForm = () => {
    setSelectedCompanyId("");
    setTrainingTopics(DEFAULT_EMERGENCY_TEAM_TOPICS);
    setTrainingDate("");
    setTrainingPlace("");
    setParticipants(emptyParticipants());
    setSignatures({
      safetyExpertName: "",
      workplaceDoctorName: "",
      employerName: "",
    });
  };

  const updateParticipant = (index: number, patch: Partial<EmergencyTeamTrainingParticipant>) => {
    setParticipants((prev) => prev.map((participant, itemIndex) => (itemIndex === index ? { ...participant, ...patch } : participant)));
  };

  const importEmployees = (sourceEmployees = companyEmployees) => {
    if (sourceEmployees.length === 0) {
      toast.info("Bu firma için aktarılacak çalışan bulunamadı. Katılımcıları manuel doldurabilirsiniz.");
      return;
    }

    setParticipants((prev) =>
      emptyParticipants().map((participant, index) => {
        const employee = sourceEmployees[index];
        if (!employee) return prev[index] || participant;

        return {
          ...participant,
          fullName: employeeFullName(employee),
          tcNo: employee.tc_number || "",
          team: prev[index]?.team || participant.team,
        };
      }),
    );

    if (sourceEmployees.length > PARTICIPANT_LIMIT) {
      toast.warning("Şablon 22 satır destekliyor. İlk 22 çalışan forma aktarıldı.");
    }
  };

  const handleCompanySelect = (companyId: string) => {
    const company = companies.find((item) => item.id === companyId);
    setSelectedCompanyId(companyId);

    if (!company) return;

    const fields = getProfileCompanyDocumentFields(company);
    setTrainingPlace(companyAddress(company));
    setSignatures({
      safetyExpertName: fields.occupationalSafetySpecialistName,
      workplaceDoctorName: fields.workplaceDoctorName,
      employerName: fields.employerRepresentativeName,
    });
    importEmployees(employees.filter((employee) => employee.company_id === companyId));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await generateEmergencyTeamTrainingAttendanceDocx({
        trainingTopics,
        trainingDate,
        trainingPlace,
        participants,
        signatures,
      });
      toast.success("Acil durum ekipleri eğitim katılım formu Word çıktısı hazırlandı.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Acil durum ekipleri eğitim katılım formu oluşturulamadı.";
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
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto border-border bg-card text-foreground sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Acil Durum Ekipleri Eğitim Katılım Formu</DialogTitle>
          <DialogDescription>
            Eğitim tarihi, yeri, ekip katılımcıları ve imza bilgilerini doldurarak resmi Word şablonunu indirin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Eğitim Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="emergency-team-company-select">Firma seçimi</Label>
                <Select value={selectedCompanyId} onValueChange={handleCompanySelect}>
                  <SelectTrigger id="emergency-team-company-select">
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
                <Label htmlFor="emergency-team-training-date">Eğitim Tarihi</Label>
                <Input
                  id="emergency-team-training-date"
                  type="date"
                  value={trainingDate}
                  onChange={(event) => setTrainingDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency-team-training-place">Eğitim Yeri</Label>
                <Input
                  id="emergency-team-training-place"
                  value={trainingPlace}
                  onChange={(event) => setTrainingPlace(event.target.value)}
                  placeholder="Eğitim yeri"
                />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="emergency-team-training-topics">Eğitimin Konusu</Label>
                <Textarea
                  id="emergency-team-training-topics"
                  value={trainingTopics}
                  onChange={(event) => setTrainingTopics(event.target.value)}
                  className="min-h-48"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/60">
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Katılımcılar</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => importEmployees()}>
                <Users className="mr-2 h-4 w-4" />
                Firma çalışanlarını aktar
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {participants.map((participant, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-xl border border-border/60 bg-card/70 p-2 md:grid-cols-[48px_minmax(0,1fr)_180px_190px]"
                >
                  <div className="flex items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
                    {index + 1}
                  </div>
                  <Input
                    value={participant.fullName}
                    onChange={(event) => updateParticipant(index, { fullName: event.target.value })}
                    placeholder="Adı Soyadı"
                  />
                  <Input
                    value={participant.tcNo}
                    onChange={(event) => updateParticipant(index, { tcNo: event.target.value })}
                    placeholder="TC No"
                  />
                  <Select value={participant.team} onValueChange={(value) => updateParticipant(index, { team: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ekip seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMERGENCY_TEAM_OPTIONS.map((team) => (
                        <SelectItem key={team} value={team}>
                          {team}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">İmza Alanları</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="emergency-team-safety-expert">İş Güvenliği Uzmanı</Label>
                <Input
                  id="emergency-team-safety-expert"
                  value={signatures.safetyExpertName}
                  onChange={(event) => setSignatures((prev) => ({ ...prev, safetyExpertName: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency-team-doctor">İşyeri Hekimi</Label>
                <Input
                  id="emergency-team-doctor"
                  value={signatures.workplaceDoctorName}
                  onChange={(event) => setSignatures((prev) => ({ ...prev, workplaceDoctorName: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency-team-employer">İşveren / İ.Vekili</Label>
                <Input
                  id="emergency-team-employer"
                  value={signatures.employerName}
                  onChange={(event) => setSignatures((prev) => ({ ...prev, employerName: event.target.value }))}
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
