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
import { getProfileCompanyDisplayName, getProfileCompanyDocumentFields, getProfileCompanyRegistryNo } from "@/lib/companyDocumentPrefill";
import {
  generateRiskAssessmentTeamTrainingAttendanceDocx,
  type RiskAssessmentTeamTrainingParticipant,
} from "@/lib/riskAssessmentTeamTrainingAttendanceExport";
import type { Company, Employee } from "@/types/companies";

const INITIAL_PARTICIPANT_ROW_COUNT = 3;

const roleOptions = [
  "ÇALIŞAN BAŞ TEMSİLCİSİ",
  "TÜM BİRİMLERDEN BİLGİ SAHİBİ KİŞİ",
  "SÖNDÜRME EKİBİ",
  "KURTARMA EKİBİ",
  "KORUMA EKİBİ",
  "İLK YARDIM EKİBİ",
  "İŞVEREN / İŞVEREN VEKİLİ",
  "İŞ GÜVENLİĞİ UZMANI",
  "İŞYERİ HEKİMİ",
];

const defaultRoles = [
  "ÇALIŞAN BAŞ TEMSİLCİSİ",
  "TÜM BİRİMLERDEN BİLGİ SAHİBİ KİŞİ",
  ...Array.from({ length: 4 }, () => "SÖNDÜRME EKİBİ"),
  ...Array.from({ length: 4 }, () => "KURTARMA EKİBİ"),
  ...Array.from({ length: 4 }, () => "KORUMA EKİBİ"),
  ...Array.from({ length: 2 }, () => "İLK YARDIM EKİBİ"),
];

const defaultTrainingTopics =
  "a) İş Kazası ve Meslek Hastalığı nedir, sebepleri ve istatistikleri\n" +
  "b) İSG risk değerlendirmesi nedir\n" +
  "c) Tehlike ve Risk nedir\n" +
  "d) Başlıca risk etmenleri nelerdir\n" +
  "e) Sektörel risk etmenleri nelerdir\n" +
  "f) Temel değerlendirme metotları nelerdir\n" +
  "g) Matris metodu nedir ve nasıl uygulanır\n" +
  "h) Görüş, Öneri ve Beklentiler nelerdir";

type RiskAssessmentTeamTrainingAttendanceModalProps = {
  open: boolean;
  companies: Company[];
  employees: Employee[];
  onOpenChange: (open: boolean) => void;
};

const emptyParticipants = (count = INITIAL_PARTICIPANT_ROW_COUNT): RiskAssessmentTeamTrainingParticipant[] =>
  Array.from({ length: count }, (_, index) => ({
    fullName: "",
    tcNo: "",
    role: defaultRoles[index] || "SÖNDÜRME EKİBİ",
  }));

const employeeFullName = (employee: Employee) =>
  (employee.full_name || `${employee.first_name || ""} ${employee.last_name || ""}`).replace(/\s+/g, " ").trim();

const companyAddress = (company?: Company | null) =>
  [company?.address, company?.district, company?.city].filter(Boolean).join(", ");

const makeParticipant = (fullName: string, tcNo: string, role: string): RiskAssessmentTeamTrainingParticipant | null => {
  const cleanName = fullName.trim();
  const cleanTc = tcNo.trim();
  if (!cleanName && !cleanTc) return null;
  return { fullName: cleanName, tcNo: cleanTc, role };
};

const uniqueByNameAndRole = (participants: RiskAssessmentTeamTrainingParticipant[]) => {
  const seen = new Set<string>();
  return participants.filter((participant) => {
    const key = `${participant.fullName.toLocaleLowerCase("tr-TR")}-${participant.role}`;
    if (!participant.fullName || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function RiskAssessmentTeamTrainingAttendanceModal({
  open,
  companies,
  employees,
  onOpenChange,
}: RiskAssessmentTeamTrainingAttendanceModalProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [address, setAddress] = useState("");
  const [sgkRegistrationNo, setSgkRegistrationNo] = useState("");
  const [trainingDate, setTrainingDate] = useState("");
  const [trainingDuration, setTrainingDuration] = useState("2 SAAT");
  const [trainingTitle, setTrainingTitle] = useState("Risk Değerlendirme Ekibi Eğitimi");
  const [trainingTopics, setTrainingTopics] = useState(defaultTrainingTopics);
  const [participants, setParticipants] = useState<RiskAssessmentTeamTrainingParticipant[]>(emptyParticipants);
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
    setOrganizationName("");
    setAddress("");
    setSgkRegistrationNo("");
    setTrainingDate("");
    setTrainingDuration("2 SAAT");
    setTrainingTitle("Risk Değerlendirme Ekibi Eğitimi");
    setTrainingTopics(defaultTrainingTopics);
    setParticipants(emptyParticipants());
    setSignatures({
      safetyExpertName: "",
      workplaceDoctorName: "",
      employerName: "",
    });
  };

  const fillParticipants = (sourceParticipants: RiskAssessmentTeamTrainingParticipant[]) => {
    setParticipants(
      emptyParticipants(Math.max(INITIAL_PARTICIPANT_ROW_COUNT, sourceParticipants.length)).map((participant, index) => ({
        ...participant,
        ...sourceParticipants[index],
        role: sourceParticipants[index]?.role || participant.role,
      })),
    );
  };

  const importEmployees = (sourceEmployees = companyEmployees) => {
    if (sourceEmployees.length === 0) {
      toast.info("Bu firma için aktarılacak çalışan bulunamadı. Satırları manuel doldurabilirsiniz.");
      return;
    }

    fillParticipants(
      sourceEmployees.map((employee, index) => ({
        fullName: employeeFullName(employee),
        tcNo: employee.tc_number || "",
        role: defaultRoles[index] || "SÖNDÜRME EKİBİ",
      })),
    );
  };

  const handleCompanySelect = (companyId: string) => {
    const company = companies.find((item) => item.id === companyId);
    const companyStaff = employees.filter((employee) => employee.company_id === companyId);
    setSelectedCompanyId(companyId);

    if (!company) return;

    const fields = getProfileCompanyDocumentFields(company);
    setOrganizationName(getProfileCompanyDisplayName(company));
    setAddress(companyAddress(company));
    setSgkRegistrationNo(getProfileCompanyRegistryNo(company));
    setSignatures({
      safetyExpertName: fields.occupationalSafetySpecialistName,
      workplaceDoctorName: fields.workplaceDoctorName,
      employerName: fields.employerRepresentativeName,
    });

    const profileParticipants = uniqueByNameAndRole(
      [
        makeParticipant(fields.employeeRepresentativeName, fields.employeeRepresentativeTcNo, "ÇALIŞAN BAŞ TEMSİLCİSİ"),
        makeParticipant(fields.knowledgeableEmployeeName, "", "TÜM BİRİMLERDEN BİLGİ SAHİBİ KİŞİ"),
        ...fields.emergencyTeams.fire.map((person) => makeParticipant(person.fullName, person.tcNo, "SÖNDÜRME EKİBİ")),
        ...fields.emergencyTeams.rescue.map((person) => makeParticipant(person.fullName, person.tcNo, "KURTARMA EKİBİ")),
        ...fields.emergencyTeams.protection.map((person) => makeParticipant(person.fullName, person.tcNo, "KORUMA EKİBİ")),
        ...fields.emergencyTeams.firstAid.map((person) => makeParticipant(person.fullName, person.tcNo, "İLK YARDIM EKİBİ")),
      ].filter((item): item is RiskAssessmentTeamTrainingParticipant => Boolean(item)),
    );

    if (profileParticipants.length > 0) {
      const fallbackRows = companyStaff.map((employee, index) => ({
        fullName: employeeFullName(employee),
        tcNo: employee.tc_number || "",
        role: defaultRoles[index + profileParticipants.length] || defaultRoles[index] || "",
      }));
      fillParticipants([...profileParticipants, ...fallbackRows]);
      return;
    }

    importEmployees(companyStaff);
  };

  const updateParticipant = (index: number, patch: Partial<RiskAssessmentTeamTrainingParticipant>) => {
    setParticipants((prev) => prev.map((participant, itemIndex) => (itemIndex === index ? { ...participant, ...patch } : participant)));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await generateRiskAssessmentTeamTrainingAttendanceDocx({
        organizationName,
        address,
        sgkRegistrationNo,
        trainingDate,
        trainingDuration,
        trainingTitle,
        trainingTopics,
        participants,
        signatures,
      });
      toast.success("Risk değerlendirme ekipleri eğitim katılım formu Word çıktısı hazırlandı.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Risk değerlendirme ekipleri eğitim katılım formu oluşturulamadı.";
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
          <DialogTitle>Risk Değerlendirme Ekipleri Eğitim Katılım Formu</DialogTitle>
          <DialogDescription>
            Firma bilgileri, eğitim detayları, katılımcılar ve imza alanlarını doldurarak Word şablon çıktısı oluşturun.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Firma ve Eğitim Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2 xl:col-span-2">
                <Label htmlFor="risk-team-training-company-select">Firma seçimi</Label>
                <Select value={selectedCompanyId} onValueChange={handleCompanySelect}>
                  <SelectTrigger id="risk-team-training-company-select">
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
                <Label htmlFor="risk-team-training-date">Eğitim tarihi</Label>
                <Input
                  id="risk-team-training-date"
                  type="date"
                  value={trainingDate}
                  onChange={(event) => setTrainingDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-team-training-duration">Eğitim süresi</Label>
                <Input
                  id="risk-team-training-duration"
                  value={trainingDuration}
                  onChange={(event) => setTrainingDuration(event.target.value)}
                  placeholder="2 SAAT"
                />
              </div>
              <div className="space-y-2 xl:col-span-2">
                <Label htmlFor="risk-team-training-organization">Kuruluş</Label>
                <Input
                  id="risk-team-training-organization"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder="Kuruluş / firma adı"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-team-training-sgk">SGK Sicil No</Label>
                <Input
                  id="risk-team-training-sgk"
                  value={sgkRegistrationNo}
                  onChange={(event) => setSgkRegistrationNo(event.target.value)}
                  placeholder="SGK sicil no"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-team-training-title">Eğitim başlığı</Label>
                <Input
                  id="risk-team-training-title"
                  value={trainingTitle}
                  onChange={(event) => setTrainingTitle(event.target.value)}
                  placeholder="Risk Değerlendirme Ekibi Eğitimi"
                />
              </div>
              <div className="space-y-2 xl:col-span-4">
                <Label htmlFor="risk-team-training-address">Adres</Label>
                <Input
                  id="risk-team-training-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Firma adresi"
                />
              </div>
              <div className="space-y-2 xl:col-span-4">
                <Label htmlFor="risk-team-training-topics">Eğitim konuları</Label>
                <Textarea
                  id="risk-team-training-topics"
                  value={trainingTopics}
                  onChange={(event) => setTrainingTopics(event.target.value)}
                  className="min-h-[150px]"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle className="text-base">Katılımcılar</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => importEmployees()}>
                    <Users className="mr-2 h-4 w-4" />
                    Çalışanları Firmadan Aktar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setParticipants((prev) => [...prev, { fullName: "", tcNo: "", role: defaultRoles[prev.length] || "SÖNDÜRME EKİBİ" }])}
                  >
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
                      <TableHead className="min-w-[220px]">Katılımcı Adı-Soyadı</TableHead>
                      <TableHead className="min-w-[160px]">T.C. Kimlik No</TableHead>
                      <TableHead className="min-w-[220px]">Görevi</TableHead>
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
                          <Select value={participant.role} onValueChange={(role) => updateParticipant(index, { role })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roleOptions.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {role}
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
              <p className="mt-3 text-xs text-muted-foreground">
                Çıktıdaki tablo satırları buradaki listeye göre otomatik ayarlanır; ister 3 ister 20 kişi ekleyebilirsiniz.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Alt İmza Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="risk-team-training-safety-expert">İş Güvenliği Uzmanı</Label>
                <Input
                  id="risk-team-training-safety-expert"
                  value={signatures.safetyExpertName}
                  onChange={(event) => setSignatures((prev) => ({ ...prev, safetyExpertName: event.target.value }))}
                  placeholder="İş güvenliği uzmanı"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-team-training-workplace-doctor">İşyeri Hekimi</Label>
                <Input
                  id="risk-team-training-workplace-doctor"
                  value={signatures.workplaceDoctorName}
                  onChange={(event) => setSignatures((prev) => ({ ...prev, workplaceDoctorName: event.target.value }))}
                  placeholder="İşyeri hekimi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-team-training-employer">İşveren / İşveren Vekili</Label>
                <Input
                  id="risk-team-training-employer"
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
