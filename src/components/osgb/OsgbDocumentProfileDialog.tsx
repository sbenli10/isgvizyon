import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, FileCheck2, FileText, Loader2, Save, ShieldAlert, Users, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  buildAnnualPlanPrefillFromOsgbProfile,
  buildAdepPrefillFromOsgbProfile,
  buildRiskWizardPrefillFromOsgbProfile,
  createEmptyOsgbCompanyDocumentProfile,
  getOsgbCompanyDocumentProfile,
  updateOsgbCompanyDocumentProfile,
  type OsgbCompanyDocumentProfile,
  type OsgbCompanyDocumentProfileRecord,
  type OsgbDocumentProfilePerson,
  type OsgbEmergencyTeamKey,
  type OsgbManagedCompanyRecord,
} from "@/lib/osgbPlatform";

const inputClass =
  "border-slate-700 bg-slate-950/70 text-slate-100 placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/20";
const textareaClass = cn(inputClass, "min-h-20 resize-none");

const profileRoles: Array<{
  key: keyof Pick<
    OsgbCompanyDocumentProfile,
    "employerRepresentative" | "occupationalSafetySpecialist" | "workplaceDoctor" | "employeeRepresentative"
  >;
  label: string;
}> = [
  { key: "employerRepresentative", label: "İşveren / İ. Vekili" },
  { key: "occupationalSafetySpecialist", label: "İSG Uzmanı" },
  { key: "workplaceDoctor", label: "İşyeri Hekimi" },
  { key: "employeeRepresentative", label: "Çalışan Temsilcisi" },
];

const teamMeta: Array<{ key: OsgbEmergencyTeamKey; label: string }> = [
  { key: "fire", label: "Söndürme Ekibi" },
  { key: "rescue", label: "Kurtarma Ekibi" },
  { key: "protection", label: "Koruma Ekibi" },
  { key: "firstAid", label: "İlk Yardım Ekibi" },
];

function countFilledPerson(person: OsgbDocumentProfilePerson) {
  return [person.fullName, person.title, person.tcNo, person.phone, person.certificateNo, person.trainingDate].filter(Boolean).length;
}

function PersonFields({
  label,
  person,
  onChange,
  showCertificate = false,
}: {
  label: string;
  person: OsgbDocumentProfilePerson;
  onChange: (patch: Partial<OsgbDocumentProfilePerson>) => void;
  showCertificate?: boolean;
}) {
  const fieldId = label.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]+/gi, "-");
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-white">
        <Users className="h-4 w-4 text-cyan-300" />
        {label}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${fieldId}-full-name`} className="text-xs text-slate-300">Ad Soyad</Label>
          <Input id={`${fieldId}-full-name`} name={`${fieldId}_full_name`} className={inputClass} value={person.fullName} onChange={(event) => onChange({ fullName: event.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${fieldId}-title`} className="text-xs text-slate-300">Unvan</Label>
          <Input id={`${fieldId}-title`} name={`${fieldId}_title`} className={inputClass} value={person.title} onChange={(event) => onChange({ title: event.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${fieldId}-tc`} className="text-xs text-slate-300">TC / Kimlik No</Label>
          <Input id={`${fieldId}-tc`} name={`${fieldId}_tc_no`} className={inputClass} value={person.tcNo} onChange={(event) => onChange({ tcNo: event.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${fieldId}-phone`} className="text-xs text-slate-300">Telefon</Label>
          <Input id={`${fieldId}-phone`} name={`${fieldId}_phone`} className={inputClass} value={person.phone} onChange={(event) => onChange({ phone: event.target.value })} />
        </div>
        {showCertificate ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-certificate`} className="text-xs text-slate-300">Belge No</Label>
              <Input id={`${fieldId}-certificate`} name={`${fieldId}_certificate_no`} className={inputClass} value={person.certificateNo} onChange={(event) => onChange({ certificateNo: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-training`} className="text-xs text-slate-300">Eğitim / Sertifika Tarihi</Label>
              <Input id={`${fieldId}-training`} name={`${fieldId}_training_date`} type="date" className={inputClass} value={person.trainingDate} onChange={(event) => onChange({ trainingDate: event.target.value })} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function OsgbDocumentProfileDialog({
  open,
  onOpenChange,
  organizationId,
  company,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
  company: OsgbManagedCompanyRecord | null;
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState<OsgbCompanyDocumentProfileRecord | null>(null);
  const [profile, setProfile] = useState<OsgbCompanyDocumentProfile>(createEmptyOsgbCompanyDocumentProfile);

  useEffect(() => {
    if (!open || !organizationId || !company) return;
    let alive = true;
    setLoading(true);
    void getOsgbCompanyDocumentProfile(organizationId, company.id)
      .then((nextRecord) => {
        if (!alive) return;
        setRecord(nextRecord);
        setProfile(nextRecord.profile);
      })
      .catch((error: any) => {
        toast.error("Evrak profili yüklenemedi", { description: error?.message || "Beklenmeyen hata" });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [company, open, organizationId]);

  const completion = useMemo(() => {
    const roleScore = profileRoles.reduce((sum, role) => sum + countFilledPerson(profile[role.key]), 0);
    const teamScore = teamMeta.reduce((sum, team) => sum + countFilledPerson(profile.emergencyTeams[team.key].leader), 0);
    const maxScore = profileRoles.length * 6 + teamMeta.length * 6 + 5;
    const defaultsScore = Object.values(profile.documentDefaults).filter(Boolean).length;
    return Math.round(((roleScore + teamScore + defaultsScore) / maxScore) * 100);
  }, [profile]);

  const updatePerson = (
    key: keyof Pick<OsgbCompanyDocumentProfile, "employerRepresentative" | "occupationalSafetySpecialist" | "workplaceDoctor" | "employeeRepresentative">,
    patch: Partial<OsgbDocumentProfilePerson>,
  ) => {
    setProfile((previous) => ({
      ...previous,
      [key]: { ...previous[key], ...patch },
    }));
  };

  const updateTeamLeader = (key: OsgbEmergencyTeamKey, patch: Partial<OsgbDocumentProfilePerson>) => {
    setProfile((previous) => ({
      ...previous,
      emergencyTeams: {
        ...previous.emergencyTeams,
        [key]: {
          ...previous.emergencyTeams[key],
          leader: { ...previous.emergencyTeams[key].leader, ...patch },
        },
      },
    }));
  };

  const save = async () => {
    if (!organizationId || !company) return toast.error("Organizasyon veya firma bağlantısı bulunamadı.");
    setSaving(true);
    try {
      await updateOsgbCompanyDocumentProfile(organizationId, company.id, profile);
      const nextRecord = await getOsgbCompanyDocumentProfile(organizationId, company.id);
      setRecord(nextRecord);
      toast.success("Evrak profili kaydedildi");
    } catch (error: any) {
      toast.error("Evrak profili kaydedilemedi", { description: error?.message || "Beklenmeyen hata" });
    } finally {
      setSaving(false);
    }
  };

  const openModule = (path: string) => {
    if (!company) return;
    navigate(`${path}?companyId=${encodeURIComponent(company.id)}`);
    onOpenChange(false);
  };

  const prefillPreview = record
    ? {
        risk: buildRiskWizardPrefillFromOsgbProfile({ ...record, profile }),
        adep: buildAdepPrefillFromOsgbProfile({ ...record, profile }),
        annual: buildAnnualPlanPrefillFromOsgbProfile({ ...record, profile }),
      }
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName="z-[100] bg-slate-950/80" className="z-[120] flex max-h-[92vh] max-w-[1120px] flex-col gap-0 overflow-hidden rounded-2xl border border-slate-700 bg-[#172235] p-0 text-slate-50 shadow-2xl [&>button.absolute]:hidden">
        <DialogTitle className="sr-only">OSGB Evrak Profili</DialogTitle>
        <DialogDescription className="sr-only">Firmaya ait evrak otomasyon bilgilerini düzenleyin.</DialogDescription>
        <div className="flex items-start justify-between border-b border-slate-700 bg-slate-900/70 p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-300">
              <FileCheck2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Evrak Profili</h2>
              <p className="mt-1 text-sm text-slate-400">{company?.companyName || "Firma"} için risk analizi, ADEP, yıllık plan ve atama evraklarını besleyen ortak alanlar.</p>
            </div>
          </div>
          <DialogClose asChild>
            <button type="button" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </DialogClose>
        </div>

        {loading ? (
          <div className="grid min-h-[420px] place-items-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-200">Senkron evrak hazırlığı</div>
                <div className="mt-2 text-2xl font-black text-white">%{completion}</div>
                <p className="mt-1 text-sm text-cyan-100/80">Bu profil doldukça modüllere firma ve yetkili bilgileri aynı standartla aktarılır.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Hızlı çıktı modülleri</div>
                <div className="mt-3 grid gap-2">
                  <Button type="button" className="justify-start bg-slate-800 text-slate-100 hover:bg-slate-700" onClick={() => openModule("/risk-assessments")}>
                    <ShieldAlert className="mr-2 h-4 w-4" /> Risk Analizi
                  </Button>
                  <Button type="button" className="justify-start bg-slate-800 text-slate-100 hover:bg-slate-700" onClick={() => openModule("/adep-wizard")}>
                    <ClipboardList className="mr-2 h-4 w-4" /> Acil Durum Planı
                  </Button>
                  <Button type="button" className="justify-start bg-slate-800 text-slate-100 hover:bg-slate-700" onClick={() => openModule("/annual-plans")}>
                    <FileText className="mr-2 h-4 w-4" /> Yıllık Planlar
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              {profileRoles.map((role) => (
                <PersonFields
                  key={role.key}
                  label={role.label}
                  person={profile[role.key]}
                  showCertificate={role.key === "occupationalSafetySpecialist" || role.key === "workplaceDoctor"}
                  onChange={(patch) => updatePerson(role.key, patch)}
                />
              ))}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
              <div className="mb-3 text-sm font-black text-white">Diğer Destek Ekipleri</div>
              <div className="grid gap-3 xl:grid-cols-2">
                {teamMeta.map((team) => (
                  <PersonFields
                    key={team.key}
                    label={`${team.label} Başkanı`}
                    person={profile.emergencyTeams[team.key].leader}
                    onChange={(patch) => updateTeamLeader(team.key, patch)}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-5">
              <div className="space-y-1.5">
                <Label htmlFor="document-risk-method" className="text-xs text-slate-300">Risk Metodu</Label>
                <Input id="document-risk-method" name="document_risk_method" className={inputClass} value={profile.documentDefaults.riskMethod} onChange={(event) => setProfile((previous) => ({ ...previous, documentDefaults: { ...previous.documentDefaults, riskMethod: event.target.value } }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="document-annual-year" className="text-xs text-slate-300">Yıllık Plan Yılı</Label>
                <Input id="document-annual-year" name="document_annual_year" className={inputClass} value={profile.documentDefaults.annualPlanYear} onChange={(event) => setProfile((previous) => ({ ...previous, documentDefaults: { ...previous.documentDefaults, annualPlanYear: event.target.value } }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="document-prepared-at" className="text-xs text-slate-300">Hazırlama Tarihi</Label>
                <Input id="document-prepared-at" name="document_prepared_at" type="date" className={inputClass} value={profile.documentDefaults.preparedAt} onChange={(event) => setProfile((previous) => ({ ...previous, documentDefaults: { ...previous.documentDefaults, preparedAt: event.target.value } }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="document-revision-no" className="text-xs text-slate-300">Revizyon No</Label>
                <Input id="document-revision-no" name="document_revision_no" className={inputClass} value={profile.documentDefaults.revisionNo} onChange={(event) => setProfile((previous) => ({ ...previous, documentDefaults: { ...previous.documentDefaults, revisionNo: event.target.value } }))} />
              </div>
              <div className="space-y-1.5 lg:col-span-5">
                <Label htmlFor="document-activity-scope" className="text-xs text-slate-300">Faaliyet Alanı / Kapsam</Label>
                <Textarea id="document-activity-scope" name="document_activity_scope" className={textareaClass} value={profile.documentDefaults.activityScope} onChange={(event) => setProfile((previous) => ({ ...previous, documentDefaults: { ...previous.documentDefaults, activityScope: event.target.value } }))} />
              </div>
            </div>

            {prefillPreview ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-xs text-slate-400">
                Hazır veri: {prefillPreview.risk.companyInfo.companyTitle}, {prefillPreview.adep.company.companyName}, {prefillPreview.annual.company.title}
              </div>
            ) : null}
          </div>
        )}

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-700 bg-slate-950/50 p-4">
          <DialogClose asChild>
            <Button type="button" disabled={saving} className="bg-slate-700 text-white hover:bg-slate-600">Kapat</Button>
          </DialogClose>
          <Button type="button" disabled={saving || loading} onClick={() => void save()} className="bg-cyan-600 text-white hover:bg-cyan-500">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Kaydet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
