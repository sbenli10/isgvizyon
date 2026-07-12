import { useMemo, useState } from "react";
import { Download, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getProfileCompanyDocumentFields } from "@/lib/companyDocumentPrefill";
import {
  generateEmergencyTeamTrainingAttendanceDocx,
  type EmergencyTeamTrainingParticipant,
} from "@/lib/emergencyTeamTrainingAttendanceExport";
import type { Company, Employee } from "@/types/companies";

const PARTICIPANT_LIMIT = 22;

const teamOptions = ["SÖNDÜRME EKİBİ", "KURTARMA EKİBİ", "KORUMA EKİBİ", "İLK YARDIM EKİBİ"];

const defaultTeams = [
  ...Array.from({ length: 4 }, () => "SÖNDÜRME EKİBİ"),
  ...Array.from({ length: 4 }, () => "KURTARMA EKİBİ"),
  ...Array.from({ length: 4 }, () => "KORUMA EKİBİ"),
  ...Array.from({ length: 10 }, () => "İLK YARDIM EKİBİ"),
];

const defaultTrainingTopic =
  "• Binaların Yangından Korunması Hakkında Yönetmelik\n" +
  "• Bina Analizi ve Tehlikeler\n" +
  "• Yangına neden Olabilecek Risklerin Tespiti\n" +
  "• Yangın ve Yanma Kimyası\n" +
  "• Yangın Söndürücülerin Sınıflandırılması ve Teknik Özellikleri\n" +
  "• Yangın Algılama, Uyarı, Söndürme ve Tahliye Sistemlerinin Kullanımı\n" +
  "• Yangın Söndürme Güvenliği\n" +
  "• Yangın İhbar Verme ve İşletme İçi İletişim\n" +
  "• Acil Durum Planının Değerlendirilmesi\n" +
  "• Ekip Liderleri ve Görevleri\n" +
  "• Temel Tahliye Eğitimi\n" +
  "• Tahliye Tatbikatında Yapılması Gerekenler\n" +
  "• Kişisel Koruyucu Ekipman Kullanımı\n" +
  "• Temel Afet Bilinci\n" +
  "• Afet ve Acil Durumlar\n" +
  "• Afet ve Acil Durum Planları\n" +
  "• Afetlere Hazırlık\n" +
  "• Ekiplerin Kurulması ve Görevleri\n" +
  "• Arama Kurtarma Eğitimi\n" +
  "• Arama Stratejileri ve Çeşitleri\n" +
  "• Alan Güvenliği\n" +
  "• Olay, İhbar\n" +
  "• Kurtarmada İpler ve Düğümler\n" +
  "• Afetlerde İlk Yardım Bilgilendirilmesi\n" +
  "• Arama ve Dinlenme Evreleri\n" +
  "• Tahkimat ve Destek Malzemeleri";

type EmergencyTeamTrainingAttendanceModalProps = {
  open: boolean;
  companies: Company[];
  employees: Employee[];
  onOpenChange: (open: boolean) => void;
};

const emptyParticipants = (): EmergencyTeamTrainingParticipant[] =>
  Array.from({ length: PARTICIPANT_LIMIT }, (_, index) => ({
    fullName: "",
    tcNo: "",
    team: defaultTeams[index],
  }));

const employeeFullName = (employee: Employee) =>
  (employee.full_name || `${employee.first_name || ""} ${employee.last_name || ""}`).replace(/\s+/g, " ").trim();

const companyAddress = (company?: Company | null) =>
  [company?.address, company?.district, company?.city].filter(Boolean).join(", ");

const namedParticipant = (fullName: string | undefined, team: string): EmergencyTeamTrainingParticipant | null =>
  fullName?.trim() ? { fullName: fullName.trim(), tcNo: "", team } : null;

export function EmergencyTeamTrainingAttendanceModal({
  open,
  companies,
  employees,
  onOpenChange,
}: EmergencyTeamTrainingAttendanceModalProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [trainingDate, setTrainingDate] = useState("");
  const [trainingPlace, setTrainingPlace] = useState("");
  const [trainingTopic, setTrainingTopic] = useState(defaultTrainingTopic);
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
    setTrainingDate("");
    setTrainingPlace("");
    setTrainingTopic(defaultTrainingTopic);
    setParticipants(emptyParticipants());
    setSignatures({
      safetyExpertName: "",
      workplaceDoctorName: "",
      employerName: "",
    });
  };

  const fillParticipants = (sourceParticipants: EmergencyTeamTrainingParticipant[]) => {
    setParticipants(
      emptyParticipants().map((participant, index) => ({
        ...participant,
        ...sourceParticipants[index],
        team: sourceParticipants[index]?.team || participant.team,
      })),
    );
  };

  const importEmployees = (sourceEmployees = companyEmployees) => {
    if (sourceEmployees.length === 0) {
      toast.info("Bu firma için aktarılacak çalışan bulunamadı. Satırları manuel doldurabilirsiniz.");
      return;
    }

    fillParticipants(
      sourceEmployees.slice(0, PARTICIPANT_LIMIT).map((employee, index) => ({
        fullName: employeeFullName(employee),
        tcNo: employee.tc_number || "",
        team: defaultTeams[index],
      })),
    );
  };

  const handleCompanySelect = (companyId: string) => {
    const company = companies.find((item) => item.id === companyId);
    setSelectedCompanyId(companyId);

    if (!company) return;

    const fields = getProfileCompanyDocumentFields(company);
    setTrainingPlace(companyAddress(company) || company.company_name || "");
    setSignatures({
      safetyExpertName: fields.occupationalSafetySpecialistName,
      workplaceDoctorName: fields.workplaceDoctorName,
      employerName: fields.employerRepresentativeName,
    });

    const profileTeamRows = [
      namedParticipant(fields.fireSupportPersonName, "SÖNDÜRME EKİBİ"),
      namedParticipant(fields.evacuationSupportPersonName, "KURTARMA EKİBİ"),
      namedParticipant(fields.knowledgeableEmployeeName, "KORUMA EKİBİ"),
      namedParticipant(fields.firstAidSupportPersonName, "İLK YARDIM EKİBİ"),
    ].filter((item): item is EmergencyTeamTrainingParticipant => Boolean(item));

    if (profileTeamRows.length > 0) {
      fillParticipants(profileTeamRows);
      return;
    }

    importEmployees(employees.filter((employee) => employee.company_id === companyId));
  };

  const updateParticipant = (index: number, patch: Partial<EmergencyTeamTrainingParticipant>) => {
    setParticipants((prev) => prev.map((participant, itemIndex) => (itemIndex === index ? { ...participant, ...patch } : participant)));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await generateEmergencyTeamTrainingAttendanceDocx({
        trainingTopic,
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
            Şablondaki eğitim konusu, tarih, yer, ekip listesi ve imza alanlarını doldurarak Word çıktısı oluşturun.
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
                <Label htmlFor="emergency-team-training-date">Eğitim tarihi</Label>
                <Input
                  id="emergency-team-training-date"
                  type="date"
                  value={trainingDate}
                  onChange={(event) => setTrainingDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency-team-training-place">Eğitim yeri</Label>
                <Input
                  id="emergency-team-training-place"
                  value={trainingPlace}
                  onChange={(event) => setTrainingPlace(event.target.value)}
                  placeholder="Eğitim yeri"
                />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="emergency-team-training-topic">Eğitimin konusu</Label>
                <Textarea
                  id="emergency-team-training-topic"
                  value={trainingTopic}
                  onChange={(event) => setTrainingTopic(event.target.value)}
                  className="min-h-[220px]"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle className="text-base">Ekip Katılımcıları</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => importEmployees()}>
                    <Users className="mr-2 h-4 w-4" />
                    Çalışanları Firmadan Aktar
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setParticipants((prev) => [...prev, { fullName: "", tcNo: "", team: "SÖNDÜRME EKİBİ" }])}>
                    <Plus className="mr-2 h-4 w-4" />
                    Satır Ekle
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setParticipants(emptyParticipants())}>
                    Tümünü Temizle
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-2xl border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">No</TableHead>
                      <TableHead className="min-w-[220px]">Adı Soyadı</TableHead>
                      <TableHead className="min-w-[160px]">TC No</TableHead>
                      <TableHead className="min-w-[190px]">Ekibi</TableHead>
                      <TableHead className="w-16 text-right">Sil</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.map((participant, index) => (
                      <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Input
                            value={participant.fullName}
                            onChange={(event) => updateParticipant(index, { fullName: event.target.value })}
                            placeholder="Adı Soyadı"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={participant.tcNo}
                            maxLength={11}
                            onChange={(event) => updateParticipant(index, { tcNo: event.target.value })}
                            placeholder="T.C. Kimlik No"
                          />
                        </TableCell>
                        <TableCell>
                          <Select value={participant.team} onValueChange={(team) => updateParticipant(index, { team })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {teamOptions.map((team) => (
                                <SelectItem key={team} value={team}>
                                  {team}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setParticipants((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                            disabled={participants.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {participants.length > PARTICIPANT_LIMIT ? (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">
                  Word şablonu 22 satır içeriyor. Çıktıda ilk 22 satır kullanılacak.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Alt İmza Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="emergency-team-safety-expert">İş Güvenliği Uzmanı</Label>
                <Input
                  id="emergency-team-safety-expert"
                  value={signatures.safetyExpertName}
                  onChange={(event) => setSignatures((prev) => ({ ...prev, safetyExpertName: event.target.value }))}
                  placeholder="İş güvenliği uzmanı"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency-team-workplace-doctor">İşyeri Hekimi</Label>
                <Input
                  id="emergency-team-workplace-doctor"
                  value={signatures.workplaceDoctorName}
                  onChange={(event) => setSignatures((prev) => ({ ...prev, workplaceDoctorName: event.target.value }))}
                  placeholder="İşyeri hekimi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency-team-employer">İşveren / İ. Vekili</Label>
                <Input
                  id="emergency-team-employer"
                  value={signatures.employerName}
                  onChange={(event) => setSignatures((prev) => ({ ...prev, employerName: event.target.value }))}
                  placeholder="İşveren / vekili"
                />
              </div>
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
