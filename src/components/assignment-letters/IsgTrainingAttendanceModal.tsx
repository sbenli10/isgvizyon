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
  generateIsgTrainingAttendanceDocx,
  type TrainingAttendanceParticipant,
  type TrainingAttendanceSession,
} from "@/lib/isgTrainingAttendanceExport";
import type { Company, Employee } from "@/types/companies";

const PARTICIPANT_LIMIT = 13;

const defaultTopics = {
  general:
    "1. Genel konular\n" +
    "a) Çalışma mevzuatı ile ilgili bilgiler\n" +
    "b) Çalışanların yasal hak ve sorumlulukları\n" +
    "c) İşyeri temizliği ve düzeni\n" +
    "d) İş kazası ve meslek hastalığından doğan hukuki sonuçlar",
  health:
    "2. Sağlık Konuları\n" +
    "a) Meslek hastalıklarının sebepleri\n" +
    "b) Hastalıklardan korunma prensipleri ve korunma tekniklerinin uygulanması\n" +
    "c) Biyolojik ve psikososyal risk etmenleri\n" +
    "d) İlkyardım\n" +
    "e) İşyeri hijyeni",
  technical:
    "3. Teknik konular\n" +
    "a) Kimyasal, fiziksel ve ergonomik risk etmenleri\n" +
    "b) Elle kaldırma ve taşıma\n" +
    "c) Parlama, patlama, yangın ve yangından korunma\n" +
    "d) İş ekipmanlarının güvenli kullanımı\n" +
    "e) Ekranlı araçlarla çalışma\n" +
    "f) Elektrik tehlikeleri, riskleri ve önlemleri\n" +
    "g) Güvenlik ve sağlık işaretleri\n" +
    "h) Kişisel koruyucu donanım kullanımı\n" +
    "ı) Tahliye ve kurtarma\n" +
    "i) İş kazalarının sebepleri ve korunma prensipleri ile tekniklerinin uygulanması\n" +
    "j) İş sağlığı ve güvenliği genel kuralları ve güvenlik kültürü",
  other:
    "4. Diğer konular\n" +
    "Çalışanın yaptığı işe özgü yüksekte çalışma, kapalı ortamda çalışma, radyasyon riskinin bulunduğu ortamlarda çalışma, özel risk taşıyan ekipman ile çalışma, kanserojen maddelerin yol açtığı olası sağlık riskleri ve benzeri.",
};

type IsgTrainingAttendanceModalProps = {
  open: boolean;
  companies: Company[];
  employees: Employee[];
  onOpenChange: (open: boolean) => void;
};

const emptyParticipant = (): TrainingAttendanceParticipant => ({
  fullName: "",
  tcNo: "",
  profession: "",
});

const emptySessions = (): TrainingAttendanceSession[] =>
  Array.from({ length: 4 }, () => ({
    date: "",
    time: "",
  }));

const employeeFullName = (employee: Employee) =>
  (employee.full_name || `${employee.first_name || ""} ${employee.last_name || ""}`).replace(/\s+/g, " ").trim();

const companyAddress = (company?: Company | null) =>
  [company?.address, company?.district, company?.city].filter(Boolean).join(", ");

export function IsgTrainingAttendanceModal({
  open,
  companies,
  employees,
  onOpenChange,
}: IsgTrainingAttendanceModalProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [companyTitle, setCompanyTitle] = useState("");
  const [trainingPlace, setTrainingPlace] = useState("");
  const [sessions, setSessions] = useState<TrainingAttendanceSession[]>(emptySessions);
  const [topics, setTopics] = useState(defaultTopics);
  const [participants, setParticipants] = useState<TrainingAttendanceParticipant[]>([emptyParticipant()]);
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
    setCompanyTitle("");
    setTrainingPlace("");
    setSessions(emptySessions());
    setTopics(defaultTopics);
    setParticipants([emptyParticipant()]);
    setSignatures({
      safetyExpertName: "",
      workplaceDoctorName: "",
      employerName: "",
    });
  };

  const importEmployees = (sourceEmployees = companyEmployees) => {
    if (sourceEmployees.length === 0) {
      toast.info("Bu firma için aktarılacak çalışan bulunamadı. Katılımcıları manuel ekleyebilirsiniz.");
      setParticipants((prev) => (prev.length > 0 ? prev : [emptyParticipant()]));
      return;
    }

    setParticipants(
      sourceEmployees.map((employee) => ({
        fullName: employeeFullName(employee),
        tcNo: employee.tc_number || "",
        profession: employee.job_title || employee.insured_job_name || employee.department || "",
      })),
    );
  };

  const handleCompanySelect = (companyId: string) => {
    const company = companies.find((item) => item.id === companyId);
    setSelectedCompanyId(companyId);

    if (!company) return;

    const fields = getProfileCompanyDocumentFields(company);
    setCompanyTitle(company.company_name || "");
    setTrainingPlace(companyAddress(company));
    setSignatures({
      safetyExpertName: fields.occupationalSafetySpecialistName,
      workplaceDoctorName: fields.workplaceDoctorName,
      employerName: fields.employerRepresentativeName,
    });
    importEmployees(employees.filter((employee) => employee.company_id === companyId));
  };

  const updateParticipant = (index: number, patch: Partial<TrainingAttendanceParticipant>) => {
    setParticipants((prev) => prev.map((participant, itemIndex) => (itemIndex === index ? { ...participant, ...patch } : participant)));
  };

  const updateSession = (index: number, patch: Partial<TrainingAttendanceSession>) => {
    setSessions((prev) => prev.map((session, itemIndex) => (itemIndex === index ? { ...session, ...patch } : session)));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      if (participants.length > PARTICIPANT_LIMIT) {
        toast.warning("Şablon en fazla 13 katılımcı destekliyor. İlk 13 kişi çıktıya eklendi.");
      }

      await generateIsgTrainingAttendanceDocx({
        companyTitle,
        trainingPlace,
        topics,
        sessions,
        participants: participants.slice(0, PARTICIPANT_LIMIT),
        signatures,
      });
      toast.success("İSG eğitim katılım listesi Word çıktısı hazırlandı.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Eğitim katılım listesi oluşturulamadı.";
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
          <DialogTitle>İş Sağlığı ve Güvenliği Eğitim Katılım Listesi</DialogTitle>
          <DialogDescription>
            Firma, eğitim oturumları ve katılımcı bilgilerini doldurarak Word çıktısı oluşturun.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Firma Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="training-company-select">Firma seçimi</Label>
                <Select value={selectedCompanyId} onValueChange={handleCompanySelect}>
                  <SelectTrigger id="training-company-select">
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
                <Label htmlFor="training-company-title">Firma adı</Label>
                <Input
                  id="training-company-title"
                  value={companyTitle}
                  onChange={(event) => setCompanyTitle(event.target.value)}
                  placeholder="Firma adı"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="training-place">Eğitimin verildiği yer</Label>
                <Input
                  id="training-place"
                  value={trainingPlace}
                  onChange={(event) => setTrainingPlace(event.target.value)}
                  placeholder="Eğitim yeri"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Eğitim Oturumları</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {sessions.map((session, index) => (
                <div key={index} className="rounded-2xl border border-border/60 bg-card/70 p-3">
                  <p className="mb-3 text-sm font-medium text-foreground">{index + 1}. Oturum</p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="space-y-2">
                      <Label htmlFor={`training-session-date-${index}`}>Eğitim Tarihi</Label>
                      <Input
                        id={`training-session-date-${index}`}
                        type="date"
                        value={session.date}
                        onChange={(event) => updateSession(index, { date: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`training-session-time-${index}`}>Saat</Label>
                      <Input
                        id={`training-session-time-${index}`}
                        type="time"
                        value={session.time}
                        onChange={(event) => updateSession(index, { time: event.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Konu / İçerik</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="training-topic-general">Genel konular</Label>
                <Textarea
                  id="training-topic-general"
                  value={topics.general}
                  onChange={(event) => setTopics((prev) => ({ ...prev, general: event.target.value }))}
                  className="min-h-[190px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="training-topic-health">Sağlık konuları</Label>
                <Textarea
                  id="training-topic-health"
                  value={topics.health}
                  onChange={(event) => setTopics((prev) => ({ ...prev, health: event.target.value }))}
                  className="min-h-[190px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="training-topic-technical">Teknik konular</Label>
                <Textarea
                  id="training-topic-technical"
                  value={topics.technical}
                  onChange={(event) => setTopics((prev) => ({ ...prev, technical: event.target.value }))}
                  className="min-h-[240px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="training-topic-other">Diğer konular</Label>
                <Textarea
                  id="training-topic-other"
                  value={topics.other}
                  onChange={(event) => setTopics((prev) => ({ ...prev, other: event.target.value }))}
                  className="min-h-[240px]"
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
                  <Button type="button" variant="outline" size="sm" onClick={() => setParticipants((prev) => [...prev, emptyParticipant()])}>
                    <Plus className="mr-2 h-4 w-4" />
                    Satır Ekle
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setParticipants([emptyParticipant()])}>
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
                      <TableHead className="min-w-[160px]">T.C. Kimlik No</TableHead>
                      <TableHead className="min-w-[180px]">Mesleği</TableHead>
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
                          <Input
                            value={participant.profession}
                            onChange={(event) => updateParticipant(index, { profession: event.target.value })}
                            placeholder="Mesleği"
                          />
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
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Alt İmza Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="training-safety-expert">İş Güvenliği Uzmanı</Label>
                <Input
                  id="training-safety-expert"
                  value={signatures.safetyExpertName}
                  onChange={(event) => setSignatures((prev) => ({ ...prev, safetyExpertName: event.target.value }))}
                  placeholder="İG uzmanı"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="training-workplace-doctor">İşyeri Hekimi</Label>
                <Input
                  id="training-workplace-doctor"
                  value={signatures.workplaceDoctorName}
                  onChange={(event) => setSignatures((prev) => ({ ...prev, workplaceDoctorName: event.target.value }))}
                  placeholder="İşyeri hekimi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="training-employer">İşveren</Label>
                <Input
                  id="training-employer"
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
