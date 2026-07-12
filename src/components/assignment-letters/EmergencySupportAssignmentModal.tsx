import { useEffect, useMemo, useState } from "react";
import { Download, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProfileCompanyDisplayName, getProfileCompanyDocumentFields, getProfileCompanyRegistryNo } from "@/lib/companyDocumentPrefill";
import {
  generateEmergencySupportAssignmentDocx,
  type EmergencySupportAssignmentParticipant,
  type EmergencySupportTeamKey,
} from "@/lib/emergencySupportAssignmentExport";
import type { Company, Employee } from "@/types/companies";

type TeamState = Record<EmergencySupportTeamKey, EmergencySupportAssignmentParticipant[]>;

type EmergencySupportAssignmentModalProps = {
  open: boolean;
  companies: Company[];
  employees: Employee[];
  onOpenChange: (open: boolean) => void;
};

const teamMeta: Array<{ key: EmergencySupportTeamKey; title: string; rows: number }> = [
  { key: "rescue", title: "Kurtarma Ekibi", rows: 4 },
  { key: "fire", title: "Söndürme Ekibi", rows: 4 },
  { key: "firstAid", title: "İlkyardım Ekibi", rows: 10 },
  { key: "protection", title: "Koruma Ekibi", rows: 4 },
];

const emptyRows = (count: number): EmergencySupportAssignmentParticipant[] =>
  Array.from({ length: count }, () => ({ fullName: "", tcNo: "" }));

const emptyTeams = (): TeamState => ({
  rescue: emptyRows(4),
  fire: emptyRows(4),
  firstAid: emptyRows(10),
  protection: emptyRows(4),
});

const employeeFullName = (employee: Employee) =>
  (employee.full_name || `${employee.first_name || ""} ${employee.last_name || ""}`).replace(/\s+/g, " ").trim();

const participantKey = (participant: EmergencySupportAssignmentParticipant) =>
  (participant.tcNo || participant.fullName).toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();

const employeeKey = (employee: Employee) =>
  (employee.tc_number || employeeFullName(employee)).toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();

const putFirst = (
  teams: TeamState,
  key: EmergencySupportTeamKey,
  fullName?: string,
  tcNo?: string,
) => {
  if (!fullName?.trim()) return;
  teams[key][0] = { fullName: fullName.trim(), tcNo: tcNo || "" };
};

export function EmergencySupportAssignmentModal({
  open,
  companies,
  employees,
  onOpenChange,
}: EmergencySupportAssignmentModalProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [workplaceTitle, setWorkplaceTitle] = useState("");
  const [workplaceRegistrationNo, setWorkplaceRegistrationNo] = useState("");
  const [revisionDate, setRevisionDate] = useState(new Date().toISOString().slice(0, 10));
  const [notifiedByName, setNotifiedByName] = useState("");
  const [teams, setTeams] = useState<TeamState>(emptyTeams);
  const [exporting, setExporting] = useState(false);

  const companyEmployees = useMemo(
    () => employees.filter((employee) => employee.company_id === selectedCompanyId),
    [employees, selectedCompanyId],
  );

  const resetForm = () => {
    setSelectedCompanyId("");
    setWorkplaceTitle("");
    setWorkplaceRegistrationNo("");
    setRevisionDate(new Date().toISOString().slice(0, 10));
    setNotifiedByName("");
    setTeams(emptyTeams());
  };

  const handleCompanySelect = (companyId: string) => {
    const company = companies.find((item) => item.id === companyId);
    setSelectedCompanyId(companyId);

    if (!company) return;

    const fields = getProfileCompanyDocumentFields(company);
    const nextTeams = emptyTeams();

    putFirst(nextTeams, "rescue", fields.evacuationSupportPersonName);
    putFirst(nextTeams, "fire", fields.fireSupportPersonName);
    putFirst(nextTeams, "firstAid", fields.firstAidSupportPersonName);
    putFirst(nextTeams, "protection", fields.knowledgeableEmployeeName || fields.employeeRepresentativeName);

    setWorkplaceTitle(getProfileCompanyDisplayName(company));
    setWorkplaceRegistrationNo(getProfileCompanyRegistryNo(company));
    setNotifiedByName(fields.employerRepresentativeName);
    setTeams(nextTeams);
  };

  useEffect(() => {
    if (!open || selectedCompanyId || companies.length === 0) return;
    handleCompanySelect(companies[0].id);
  }, [companies, open, selectedCompanyId]);

  const importEmployeesToTeam = (teamKey: EmergencySupportTeamKey, rowCount: number) => {
    if (companyEmployees.length === 0) {
      toast.info("Bu firma için aktarılacak çalışan bulunamadı. Satırları manuel doldurabilirsiniz.");
      return;
    }

    setTeams((prev) => {
      const usedKeys = new Set<string>();
      Object.entries(prev).forEach(([key, participants]) => {
        if (key === teamKey) return;
        participants.forEach((participant) => {
          const keyValue = participantKey(participant);
          if (keyValue) usedKeys.add(keyValue);
        });
      });

      const availableEmployees = companyEmployees.filter((employee) => !usedKeys.has(employeeKey(employee)));
      let employeeIndex = 0;

      return {
        ...prev,
        [teamKey]: prev[teamKey].slice(0, rowCount).map((participant) => {
          if (participantKey(participant)) return participant;

          const employee = availableEmployees[employeeIndex];
          employeeIndex += 1;

          return employee
            ? {
                fullName: employeeFullName(employee),
                tcNo: employee.tc_number || "",
              }
            : participant;
        }),
      };
    });
  };

  const updateParticipant = (
    teamKey: EmergencySupportTeamKey,
    index: number,
    patch: Partial<EmergencySupportAssignmentParticipant>,
  ) => {
    setTeams((prev) => ({
      ...prev,
      [teamKey]: prev[teamKey].map((participant, itemIndex) => (itemIndex === index ? { ...participant, ...patch } : participant)),
    }));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await generateEmergencySupportAssignmentDocx({
        workplaceTitle,
        workplaceRegistrationNo,
        revisionDate,
        notifiedByName,
        teams,
      });
      toast.success("Acil durum destek elemanı çoklu atama Word çıktısı hazırlandı.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Acil durum destek elemanı ataması oluşturulamadı.";
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
          <DialogTitle>Acil Durum Destek Elemanı Ataması</DialogTitle>
          <DialogDescription>
            Kurtarma, söndürme, ilkyardım ve koruma ekiplerini tek Word şablonunda çoklu olarak atayın.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">İşyeri Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="support-assignment-company">Firma seçimi</Label>
                <Select value={selectedCompanyId || ""} onValueChange={handleCompanySelect}>
                  <SelectTrigger id="support-assignment-company">
                    <SelectValue placeholder="Firma seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {getProfileCompanyDisplayName(company) || "İsimsiz firma"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-assignment-date">Hazırlama / Güncelleme Tarihi</Label>
                <Input
                  id="support-assignment-date"
                  type="date"
                  value={revisionDate}
                  onChange={(event) => setRevisionDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-assignment-title">İşyeri unvanı</Label>
                <Input
                  id="support-assignment-title"
                  value={workplaceTitle}
                  onChange={(event) => setWorkplaceTitle(event.target.value)}
                  placeholder="İşyeri unvanı"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-assignment-registry">İşyeri sicil no</Label>
                <Input
                  id="support-assignment-registry"
                  value={workplaceRegistrationNo}
                  onChange={(event) => setWorkplaceRegistrationNo(event.target.value)}
                  placeholder="SGK / işyeri sicil no"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="support-assignment-notified-by">Tebliğ eden işyeri / vekili</Label>
                <Input
                  id="support-assignment-notified-by"
                  value={notifiedByName}
                  onChange={(event) => setNotifiedByName(event.target.value)}
                  placeholder="İşyeri / vekili"
                />
              </div>
            </CardContent>
          </Card>

          {teamMeta.map((team) => (
            <Card key={team.key} className="border-border/70 bg-background/60">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base">{team.title}</CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={() => importEmployeesToTeam(team.key, team.rows)}>
                    <Users className="mr-2 h-4 w-4" />
                    Çalışanları Aktar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-2xl border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Sıra No</TableHead>
                        <TableHead className="min-w-[240px]">Adı Soyadı</TableHead>
                        <TableHead className="min-w-[180px]">T.C. No</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teams[team.key].map((participant, index) => (
                        <TableRow key={index}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <Input
                              value={participant.fullName}
                              onChange={(event) => updateParticipant(team.key, index, { fullName: event.target.value })}
                              placeholder="Adı Soyadı"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={participant.tcNo}
                              maxLength={11}
                              onChange={(event) => updateParticipant(team.key, index, { tcNo: event.target.value })}
                              placeholder="T.C. Kimlik No"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
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
