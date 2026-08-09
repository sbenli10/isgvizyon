import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  Database,
  Download,
  FileQuestion,
  FileSpreadsheet,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  createEmptyQuestion,
  createEmptyQuestionSet,
  createQuestionId,
  difficultyOptions,
  downloadQuestionExcelTemplate,
  employeeToQuestionParticipant,
  generateQuestionPdf,
  generateTrainingQuestions,
  getCompanyDisplayName,
  loadQuestionCompanies,
  loadQuestionEmployees,
  loadQuestionHistory,
  loadQuestionSet,
  loadTemplateQuestions,
  parseQuestionsExcel,
  saveQuestionSet,
  trainingQuestionSectors,
  validateQuestionSet,
  type ExamType,
  type QuestionDifficulty,
  type QuestionHistoryItem,
  type QuestionParticipant,
  type TrainingQuestion,
  type TrainingQuestionSet,
} from "@/lib/trainingQuestions";
import type { Company, Employee } from "@/types/companies";

const optionLetters = ["A", "B", "C", "D"] as const;

function normalizeText(value: string) {
  return value.toLocaleLowerCase("tr-TR").trim();
}

function employeeName(employee: Employee) {
  return employee.full_name || [employee.first_name, employee.last_name].filter(Boolean).join(" ") || "Çalışan";
}

export default function TrainingQuestions() {
  const { user, profile } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [record, setRecord] = useState<TrainingQuestionSet>(() => createEmptyQuestionSet());
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [history, setHistory] = useState<QuestionHistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [includeAnswerKey, setIncludeAnswerKey] = useState(false);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === record.companyId) || null,
    [companies, record.companyId],
  );

  const filteredEmployees = useMemo(() => {
    const term = normalizeText(employeeSearch);
    return employees.filter((employee) => {
      if (!term) return true;
      return (
        normalizeText(employeeName(employee)).includes(term) ||
        normalizeText(employee.job_title || "").includes(term) ||
        normalizeText(employee.tc_number || "").includes(term)
      );
    });
  }, [employeeSearch, employees]);

  const progress = Math.min(record.questions.length, 10);

  const patchRecord = (patch: Partial<TrainingQuestionSet>) => {
    setRecord((current) => ({ ...current, ...patch }));
  };

  const loadBaseData = async () => {
    setLoading(true);
    try {
      const [companyRows, historyRows] = await Promise.all([
        loadQuestionCompanies(profile?.organization_id || null),
        loadQuestionHistory().catch(() => []),
      ]);
      setCompanies(companyRows);
      setHistory(historyRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Eğitim soruları ekranı yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBaseData();
  }, [profile?.organization_id]);

  const handleCompanyChange = async (companyId: string) => {
    const company = companies.find((item) => item.id === companyId);
    patchRecord({
      companyId,
      companyName: company ? getCompanyDisplayName(company) : "",
      participants: [],
      employeeName: "",
      employeeNationalId: "",
    });
    setSelectedEmployeeIds([]);
    setEmployees([]);

    try {
      setEmployees(await loadQuestionEmployees(companyId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Firma çalışanları yüklenemedi.");
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const questions = await generateTrainingQuestions(record.sector, record.difficulty);
      patchRecord({ questions, source: "app" } as Partial<TrainingQuestionSet>);
      toast.success("10 soruluk sınav kağıdı oluşturuldu.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI soruları oluşturamadı. Şablon sorular yüklendi.");
      patchRecord({ questions: loadTemplateQuestions(record.sector, record.difficulty) });
    } finally {
      setGenerating(false);
    }
  };

  const handleTemplateLoad = () => {
    patchRecord({ questions: loadTemplateQuestions(record.sector, record.difficulty) });
    toast.success("Hazır şablon sorular yüklendi.");
  };

  const updateQuestion = (id: string, patch: Partial<TrainingQuestion>) => {
    patchRecord({
      questions: record.questions.map((question) => (question.id === id ? { ...question, ...patch } : question)),
    });
  };

  const updateOption = (id: string, optionIndex: number, value: string) => {
    patchRecord({
      questions: record.questions.map((question) => {
        if (question.id !== id) return question;
        const options = [...question.options];
        options[optionIndex] = value;
        return { ...question, options };
      }),
    });
  };

  const addQuestion = () => {
    patchRecord({ questions: [...record.questions, createEmptyQuestion()] });
  };

  const removeQuestion = (id: string) => {
    patchRecord({ questions: record.questions.filter((question) => question.id !== id) });
  };

  const addManualParticipant = () => {
    const fullName = record.employeeName.trim();
    if (!fullName) {
      toast.warning("Listeye eklemek için ad soyad girin.");
      return;
    }
    const participant: QuestionParticipant = {
      id: createQuestionId(),
      fullName,
      nationalId: record.employeeNationalId.trim(),
    };
    patchRecord({
      participants: [...record.participants, participant],
      employeeName: "",
      employeeNationalId: "",
    });
  };

  const addSelectedEmployees = () => {
    const next = employees
      .filter((employee) => selectedEmployeeIds.includes(employee.id))
      .map(employeeToQuestionParticipant);

    if (!next.length) {
      toast.info("Önce çalışan seçin.");
      return;
    }

    const merged = [...record.participants];
    next.forEach((participant) => {
      const exists = merged.some((item) => item.id === participant.id || (item.nationalId && item.nationalId === participant.nationalId));
      if (!exists) merged.push(participant);
    });
    patchRecord({ participants: merged });
    setSelectedEmployeeIds([]);
  };

  const removeParticipant = (id: string) => {
    patchRecord({ participants: record.participants.filter((participant) => participant.id !== id) });
  };

  const handleSave = async (status: TrainingQuestionSet["status"] = "Kaydedildi") => {
    if (!user?.id) {
      toast.error("Kaydetmek için oturum gerekli.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveQuestionSet({ ...record, status }, user.id, profile?.organization_id || null);
      setRecord(saved);
      setHistory(await loadQuestionHistory());
      toast.success("Soru seti kaydedildi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Soru seti kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    const validation = validateQuestionSet(record);
    if (validation) {
      toast.error(validation);
      return;
    }
    generateQuestionPdf(record, includeAnswerKey);
    await handleSave("PDF hazır");
  };

  const handleExcel = async (file?: File) => {
    if (!file) return;
    try {
      const questions = await parseQuestionsExcel(file);
      if (!questions.length) {
        toast.error("Excel içinde geçerli soru bulunamadı.");
        return;
      }
      patchRecord({ questions });
      toast.success(`${questions.length} soru Excel'den aktarıldı.`);
    } catch {
      toast.error("Excel dosyası okunamadı.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const openHistory = async (id: string) => {
    try {
      const loaded = await loadQuestionSet(id);
      setRecord(loaded);
      setHistoryOpen(false);
      if (loaded.companyId) setEmployees(await loadQuestionEmployees(loaded.companyId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Soru seti açılamadı.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-5 bg-[#0b1020] p-4 text-white lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-950/30">
            <CircleHelp className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Eğitim Soruları</h1>
            <p className="mt-1 max-w-3xl text-sm text-sky-100/80">
              İş güvenliği eğitimi sonrası 10 soruluk sınav kağıdını AI ile üretin, düzenleyin ve PDF olarak indirin.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => setHelpOpen(true)}
          className="w-fit gap-2 border-violet-400/35 bg-violet-500/12 text-violet-100 hover:bg-violet-500/20"
        >
          <CircleHelp className="h-4 w-4" />
          Nasıl Yapılır?
        </Button>
      </header>

      <Card className="border-slate-700/60 bg-slate-900/70 shadow-2xl shadow-black/20">
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_270px_1.35fr]">
            <div className="space-y-2">
              <Label className="text-slate-100">Sektör</Label>
              <Select value={record.sector} onValueChange={(value) => patchRecord({ sector: value })}>
                <SelectTrigger className="h-12 border-slate-600 bg-slate-800 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[140] border-slate-700 bg-slate-900 text-white">
                  {trainingQuestionSectors.map((sector) => (
                    <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-100">Zorluk</Label>
              <Select value={record.difficulty} onValueChange={(value) => patchRecord({ difficulty: value as QuestionDifficulty })}>
                <SelectTrigger className="h-12 border-slate-600 bg-slate-800 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[140] border-slate-700 bg-slate-900 text-white">
                  {difficultyOptions.map((difficulty) => (
                    <SelectItem key={difficulty} value={difficulty}>{difficulty}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="mt-auto h-12 gap-2 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-950/35 hover:brightness-110"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              AI ile 10 Soru Üret
              <Badge className="ml-2 bg-white/20 text-white">{progress}/10</Badge>
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleTemplateLoad} className="gap-2 border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700">
              <FileQuestion className="h-4 w-4" />
              Şablondan Yükle
            </Button>
            <Button variant="outline" onClick={() => setHistoryOpen(true)} className="gap-2 border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700">
              <Database className="h-4 w-4" />
              Sorularım
            </Button>
            <Button variant="outline" onClick={addQuestion} className="gap-2 border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700">
              <Plus className="h-4 w-4" />
              Soru Ekle
            </Button>
            <Button variant="outline" onClick={() => patchRecord({ questions: [] })} className="gap-2 border-slate-700 bg-slate-900 text-slate-400 hover:text-white">
              <RefreshCcw className="h-4 w-4" />
              Sıfırla
            </Button>
            <Button variant="outline" onClick={downloadQuestionExcelTemplate} className="gap-2 border-blue-500/40 bg-blue-500/12 text-blue-100">
              <FileSpreadsheet className="h-4 w-4" />
              Excel Şablonu
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2 border-emerald-500/40 bg-emerald-500/12 text-emerald-100">
              <Upload className="h-4 w-4" />
              Excel Yükle
            </Button>
            <input ref={fileRef} type="file" hidden accept=".xlsx,.xls" onChange={(event) => void handleExcel(event.target.files?.[0])} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-700/60 bg-slate-900/70">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-200">Sınav / Çalışan Bilgileri</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-200">Sınavdan:</span>
              {(["Önce", "Sonra"] as ExamType[]).map((type) => (
                <Button
                  key={type}
                  size="sm"
                  onClick={() => patchRecord({ examType: type })}
                  className={record.examType === type ? "bg-violet-600 text-white hover:bg-violet-500" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}
                >
                  {type}
                </Button>
              ))}
              <Button className="gap-2 bg-cyan-600 text-white hover:bg-cyan-500" onClick={addSelectedEmployees}>
                <UserPlus className="h-4 w-4" />
                Firmadan Çalışan Seç
              </Button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Firma</Label>
              <Select value={record.companyId || "none"} onValueChange={(value) => value === "none" ? patchRecord({ companyId: "", companyName: "", participants: [] }) : void handleCompanyChange(value)}>
                <SelectTrigger className="h-11 border-slate-600 bg-slate-800 text-white">
                  <SelectValue placeholder="Firma seçin" />
                </SelectTrigger>
                <SelectContent className="z-[140] border-slate-700 bg-slate-900 text-white">
                  <SelectItem value="none">Firma seçin</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>{getCompanyDisplayName(company)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ad Soyad</Label>
              <Input value={record.employeeName} onChange={(event) => patchRecord({ employeeName: event.target.value })} placeholder="Çalışanın adı soyadı" className="h-11 border-slate-600 bg-slate-800 text-white placeholder:text-slate-400" />
            </div>
            <div className="space-y-2">
              <Label>T.C. Kimlik No</Label>
              <Input value={record.employeeNationalId} onChange={(event) => patchRecord({ employeeNationalId: event.target.value.replace(/\D/g, "").slice(0, 11) })} placeholder="11 haneli" className="h-11 border-slate-600 bg-slate-800 text-white placeholder:text-slate-400" />
            </div>
            <div className="space-y-2">
              <Label>Sınav Tarihi</Label>
              <Input type="date" value={record.examDate} onChange={(event) => patchRecord({ examDate: event.target.value })} className="h-11 border-slate-600 bg-slate-800 text-white" />
            </div>
            <div className="space-y-2">
              <Label>PDF Başlığı</Label>
              <Input value={record.title} onChange={(event) => patchRecord({ title: event.target.value })} className="h-11 border-slate-600 bg-slate-800 text-white" />
            </div>
            <div className="flex items-end">
              <Button onClick={addManualParticipant} className="h-11 w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-500">
                <Plus className="h-4 w-4" />
                Listeye Ekle
              </Button>
            </div>
          </div>

          {record.companyId ? (
            <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-300" />
                <p className="font-semibold text-blue-50">{selectedCompany ? getCompanyDisplayName(selectedCompany) : "Firma"} çalışanları</p>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Çalışan ara..." className="border-slate-600 bg-slate-950 pl-9 text-white" />
              </div>
              <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
                {filteredEmployees.map((employee) => (
                  <label key={employee.id} className="flex cursor-pointer gap-2 rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedEmployeeIds.includes(employee.id)}
                      onChange={(event) =>
                        setSelectedEmployeeIds((current) =>
                          event.target.checked ? [...current, employee.id] : current.filter((id) => id !== employee.id),
                        )
                      }
                      className="mt-1 h-4 w-4 accent-violet-500"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-white">{employeeName(employee)}</span>
                      <span className="block truncate text-xs text-slate-400">{employee.job_title || "Görev yok"} • {employee.tc_number || "TC yok"}</span>
                    </span>
                  </label>
                ))}
                {!filteredEmployees.length && <p className="text-sm text-slate-400">Bu firmada çalışan bulunamadı.</p>}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {record.questions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-600 bg-slate-950/40 px-6 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200">
            <Sparkles className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-xl font-bold">Henüz soru yok</h2>
          <p className="mt-2 text-sm text-sky-100/75">Sektör ve zorluk seçip AI ile soru üretin veya şablondan yükleyin.</p>
          <Button onClick={handleGenerate} disabled={generating} className="mt-5 gap-2 bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            AI ile Üret
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {record.questions.map((question, index) => (
            <Card key={question.id} className="border-slate-700/60 bg-slate-900/80">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-sm font-bold text-violet-100">
                    {index + 1}
                  </div>
                  <Textarea
                    value={question.question}
                    onChange={(event) => updateQuestion(question.id, { question: event.target.value })}
                    placeholder="Soru metni"
                    className="min-h-12 border-slate-600 bg-slate-950 text-white placeholder:text-slate-500"
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeQuestion(question.id)} className="text-rose-300 hover:bg-rose-500/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {question.options.map((option, optionIndex) => (
                    <div key={`${question.id}-${optionLetters[optionIndex]}`} className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => updateQuestion(question.id, { correctAnswer: optionLetters[optionIndex] })}
                        className={question.correctAnswer === optionLetters[optionIndex] ? "w-11 bg-emerald-600 text-white" : "w-11 bg-slate-800 text-slate-300 hover:bg-slate-700"}
                      >
                        {optionLetters[optionIndex]}
                      </Button>
                      <Input value={option} onChange={(event) => updateOption(question.id, optionIndex, event.target.value)} className="border-slate-600 bg-slate-950 text-white placeholder:text-slate-500" />
                    </div>
                  ))}
                </div>
                <Input
                  value={question.explanation}
                  onChange={(event) => updateQuestion(question.id, { explanation: event.target.value })}
                  placeholder="Cevap açıklaması"
                  className="border-slate-600 bg-slate-950 text-white placeholder:text-slate-500"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-slate-700/60 bg-slate-900/80">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-semibold text-white">Çıktı ve kayıt</p>
            <p className="text-sm text-slate-400">Birden fazla çalışan eklediğinizde her çalışan için aynı sınav PDF içinde ayrı sayfa oluşturulur.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
              <input type="checkbox" checked={includeAnswerKey} onChange={(event) => setIncludeAnswerKey(event.target.checked)} className="h-4 w-4 accent-violet-500" />
              Cevap anahtarı ekle
            </label>
            <Button variant="outline" onClick={() => void handleSave("Kaydedildi")} disabled={saving} className="gap-2 border-slate-600 bg-slate-800 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Kaydet
            </Button>
            <Button onClick={() => void handleDownload()} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500">
              <Download className="h-4 w-4" />
              PDF İndir
            </Button>
          </div>
        </CardContent>
      </Card>

      {record.participants.length ? (
        <Card className="border-slate-700/60 bg-slate-900/80">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-white">Listeye Eklenenler ({record.participants.length})</p>
              <Button variant="ghost" size="sm" onClick={() => patchRecord({ participants: [] })}>Temizle</Button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-700">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-300">Ad Soyad</TableHead>
                    <TableHead className="text-slate-300">T.C. Kimlik No</TableHead>
                    <TableHead className="text-right text-slate-300">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {record.participants.map((participant) => (
                    <TableRow key={participant.id} className="border-slate-800">
                      <TableCell className="font-medium text-white">{participant.fullName}</TableCell>
                      <TableCell className="text-slate-300">{participant.nationalId || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => removeParticipant(participant.id)} className="text-rose-300">
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
      ) : null}

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl border-slate-700 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Sorularım</DialogTitle>
            <DialogDescription className="text-slate-400">Kaydedilmiş sınav soru setlerinizi açın ve düzenlemeye devam edin.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-800">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-300">Başlık</TableHead>
                  <TableHead className="text-slate-300">Sektör</TableHead>
                  <TableHead className="text-slate-300">Zorluk</TableHead>
                  <TableHead className="text-slate-300">Soru</TableHead>
                  <TableHead className="text-slate-300">Tarih</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {!history.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-slate-400">Kaydedilmiş soru seti yok.</TableCell>
                  </TableRow>
                ) : (
                  history.map((item) => (
                    <TableRow key={item.id} className="border-slate-800">
                      <TableCell className="font-semibold text-white">{item.title}<p className="text-xs text-slate-500">{item.companyName}</p></TableCell>
                      <TableCell>{item.sector}</TableCell>
                      <TableCell>{item.difficulty}</TableCell>
                      <TableCell>{item.questionCount}</TableCell>
                      <TableCell>{item.examDate || new Date(item.updatedAt).toLocaleDateString("tr-TR")}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => void openHistory(item.id)} className="bg-violet-600 text-white hover:bg-violet-500">Aç</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-2xl border-slate-700 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Eğitim Soruları Nasıl Kullanılır?</DialogTitle>
            <DialogDescription className="text-slate-400">Sınav kağıdı üretimi için kısa akış.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-200">
            {[
              "Sektör ve zorluk seviyesini seçin.",
              "AI ile 10 soru üretin veya Excel/şablon üzerinden soru yükleyin.",
              "Firma seçerek çalışanları listeye ekleyin ya da manuel ad soyad girin.",
              "Soruları ve doğru cevapları kontrol edin.",
              "PDF indir butonuyla sınav kağıdını, isterseniz cevap anahtarıyla birlikte alın.",
            ].map((item, index) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold">{index + 1}</div>
                <p>{item}</p>
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-emerald-100">
              <CheckCircle2 className="h-4 w-4" />
              Kaydedilen soru setleri “Sorularım” ekranından tekrar açılabilir.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
