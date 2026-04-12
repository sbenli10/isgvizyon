import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ImagePlus, Palette, Save, Sparkles, Stamp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CertificatePreviewCard } from "@/components/certificates/CertificatePreviewCard";
import type { CertificateDesignConfig, CertificateFormValues, CertificateSignatureConfig, CertificateTemplateType } from "@/types/certificates";

const templateCards: Array<{ value: CertificateTemplateType; title: string; text: string }> = [
  { value: "classic", title: "Prestij Klasik", text: "Geleneksel çift çerçeve ve resmi belge dengesi." },
  { value: "academy", title: "Akademi Mavi", text: "Lacivert-altın üst bant, müfredat blokları ve resmi eğitim kimliği." },
  { value: "executive", title: "Yönetici Altın", text: "Lüks, davetiye hissi veren yönetici seviyesi görünüm." },
  { value: "compliance", title: "Mevzuat Uyum", text: "Denetim dostu, bilgi yoğun ve net imza hiyerarşisi." },
  { value: "modern", title: "Kurumsal Modern", text: "Dijital paylaşıma uygun çağdaş ve yüksek kontrast yapı." },
  { value: "minimal", title: "Minimal Baskı", text: "Mürekkep tasarruflu, sade ve hızlı baskı odaklı tasarım." },
];

function buildDefaultDesignConfig(): CertificateDesignConfig {
  return {
    primaryColor: "#d4af37",
    secondaryColor: "#294d77",
    fontFamily: "serif",
    showBadge: true,
    showSeal: true,
    titleText: "Temel Eğitim Sertifikası",
    descriptionText: "",
    osgb_logo_url: "",
    signatureCount: 4,
    signatures: [
      { name: "İbrahim Yılmaz", title: "İSG Uzmanı" },
      { name: "Dr. Elif Kaya", title: "İşyeri Hekimi" },
      { name: "Ayşe Demir", title: "İşveren Vekili" },
      { name: "İSGVizyon OSGB", title: "Düzenleyen Birim" },
    ],
  };
}

function buildDefaultForm(): CertificateFormValues {
  return {
    company_id: null,
    company_name: "İSGVizyon Teknoloji A.Ş.",
    company_address: "İstanbul Teknoloji Merkezi, Ataşehir / İstanbul",
    company_phone: "+90 216 555 00 00",
    training_name: "Temel İş Sağlığı ve Güvenliği Eğitimi",
    training_date: new Date().toISOString().slice(0, 10),
    training_duration: "8 Saat",
    certificate_type: "Katılım",
    validity_date: "",
    logo_url: "",
    template_type: "academy",
    frame_style: "gold",
    trainer_names: ["İbrahim Yılmaz", "Dr. Elif Kaya"],
    notes: "İSG mevzuatı\nYangın güvenliği\nAcil durumlar\nTahliye uygulamaları\nKKD kullanımı\nErgonomi\nElektrik güvenliği\nİş kazası önleme",
    design_config: buildDefaultDesignConfig(),
  };
}

function normalizeDesignConfig(config?: CertificateDesignConfig): CertificateDesignConfig {
  const defaults = buildDefaultDesignConfig();
  const signatures = Array.isArray(config?.signatures) ? [...config!.signatures].slice(0, 4) : defaults.signatures;
  while (signatures.length < 4) {
    signatures.push(defaults.signatures[signatures.length]);
  }
  return {
    ...defaults,
    ...(config || {}),
    signatures,
    signatureCount: Math.min(4, Math.max(1, Number(config?.signatureCount || defaults.signatureCount))),
  };
}

function readStoredPreset() {
  if (typeof window === "undefined") return buildDefaultForm();
  try {
    const raw = window.localStorage.getItem("certificate-studio-preset");
    if (!raw) return buildDefaultForm();
    const parsed = JSON.parse(raw) as Partial<CertificateFormValues>;
    return {
      ...buildDefaultForm(),
      ...parsed,
      trainer_names: Array.isArray(parsed.trainer_names) ? parsed.trainer_names : buildDefaultForm().trainer_names,
      design_config: normalizeDesignConfig(parsed.design_config),
    } as CertificateFormValues;
  } catch {
    return buildDefaultForm();
  }
}

export default function CertificateStudio() {
  const [form, setForm] = useState<CertificateFormValues>(() => readStoredPreset());
  const previewParticipant = useMemo(
    () => ({
      name: "Said Benli",
      tc_no: "12345678901",
      job_title: "İSG Uzmanı",
    }),
    []
  );

  function updateDesignConfig(patch: Partial<CertificateDesignConfig>) {
    setForm((prev) => ({
      ...prev,
      design_config: {
        ...normalizeDesignConfig(prev.design_config),
        ...patch,
      },
    }));
  }

  function updateSignature(index: number, patch: Partial<CertificateSignatureConfig>) {
    setForm((prev) => {
      const config = normalizeDesignConfig(prev.design_config);
      const signatures = config.signatures.map((signature, signatureIndex) =>
        signatureIndex === index ? { ...signature, ...patch } : signature
      );
      return {
        ...prev,
        design_config: {
          ...config,
          signatures,
        },
      };
    });
  }

  function handleImageUpload(kind: "logo" | "osgb" | "signature", file: File, signatureIndex?: number) {
    const objectUrl = URL.createObjectURL(file);
    if (kind === "logo") {
      setForm((prev) => ({ ...prev, logo_url: objectUrl }));
      return;
    }
    if (kind === "osgb") {
      updateDesignConfig({ osgb_logo_url: objectUrl });
      return;
    }
    if (typeof signatureIndex === "number") {
      updateSignature(signatureIndex, { image_url: objectUrl });
    }
  }

  function handleSavePreset() {
    window.localStorage.setItem("certificate-studio-preset", JSON.stringify(form));
    toast.success("Stüdyo ayarları kaydedildi");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sertifika Tasarım Stüdyosu</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Premium üyelik kurgusuna uygun, ayrı çalışan bir sertifika tasarım motoru. Sol panelde tasarla, sağ panelde canlı önizle.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="px-3 py-1">Premium Modül</Badge>
          <Badge variant="secondary" className="px-3 py-1">6 tema</Badge>
          <Button variant="outline" asChild className="gap-2">
            <Link to="/dashboard/certificates"><ArrowRight className="h-4 w-4" /> Sertifika Merkezine Git</Link>
          </Button>
          <Button className="gap-2" onClick={handleSavePreset}><Save className="h-4 w-4" /> Taslağı Kaydet</Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /> Tema ve Kimlik</CardTitle>
              <CardDescription>Temayı seç, renk kimliğini belirle ve kurumsal dili özelleştir.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3">
                {templateCards.map((template) => (
                  <button
                    key={template.value}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, template_type: template.value }))}
                    className={`rounded-2xl border p-4 text-left transition-all ${form.template_type === template.value ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border hover:border-primary/40 hover:bg-secondary/40"}`}
                  >
                    <p className="text-sm font-semibold">{template.title}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{template.text}</p>
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Ana Renk</Label>
                  <Input type="color" value={form.design_config?.primaryColor || "#d4af37"} onChange={(e) => updateDesignConfig({ primaryColor: e.target.value })} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label>İkincil Renk</Label>
                  <Input type="color" value={form.design_config?.secondaryColor || "#294d77"} onChange={(e) => updateDesignConfig({ secondaryColor: e.target.value })} className="h-11" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Font Ailesi</Label>
                <Select value={form.design_config?.fontFamily || "serif"} onValueChange={(value: "serif" | "sans" | "gothic") => updateDesignConfig({ fontFamily: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="serif">Serif</SelectItem>
                    <SelectItem value="sans">Sans</SelectItem>
                    <SelectItem value="gothic">Gotik</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <p className="text-sm font-medium">Badge</p>
                    <p className="text-xs text-muted-foreground">Başlık üstü etiket</p>
                  </div>
                  <Switch checked={form.design_config?.showBadge ?? true} onCheckedChange={(checked) => updateDesignConfig({ showBadge: checked })} />
                </div>
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <p className="text-sm font-medium">Mühür</p>
                    <p className="text-xs text-muted-foreground">Premium seal görünümü</p>
                  </div>
                  <Switch checked={form.design_config?.showSeal ?? true} onCheckedChange={(checked) => updateDesignConfig({ showSeal: checked })} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> İçerik ve Metinler</CardTitle>
              <CardDescription>Başlık, açıklama ve eğitim konularını kurum diline göre özelleştir.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Sertifika Başlığı</Label>
                <Input value={form.design_config?.titleText || ""} onChange={(e) => updateDesignConfig({ titleText: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Açıklama Metni</Label>
                <Textarea value={form.design_config?.descriptionText || ""} onChange={(e) => updateDesignConfig({ descriptionText: e.target.value })} className="min-h-24" placeholder="{name}, {company}, {training}, {date}, {duration}" />
              </div>
              <div className="space-y-2">
                <Label>Eğitim Konuları</Label>
                <Textarea value={form.notes || ""} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} className="min-h-28" placeholder="Her satıra bir konu yaz. Boş bırakırsan sertifikada gizlenir." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ImagePlus className="h-5 w-5 text-primary" /> Logo ve İmzalar</CardTitle>
              <CardDescription>Kurum logosu, OSGB logosu ve imza bloklarını görsel olarak düzenle.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <Label>Kurum Logosu</Label>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload("logo", e.target.files[0])} />
                  <Button type="button" variant="outline" asChild className="w-full"><span>Logo Yükle</span></Button>
                </label>
                <label className="space-y-2">
                  <Label>OSGB Logosu</Label>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload("osgb", e.target.files[0])} />
                  <Button type="button" variant="outline" asChild className="w-full"><span>OSGB Yükle</span></Button>
                </label>
              </div>

              <div className="space-y-2">
                <Label>İmza Alanı Sayısı</Label>
                <Select value={String(form.design_config?.signatureCount || 4)} onValueChange={(value) => updateDesignConfig({ signatureCount: Number(value) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 imza</SelectItem>
                    <SelectItem value="2">2 imza</SelectItem>
                    <SelectItem value="3">3 imza</SelectItem>
                    <SelectItem value="4">4 imza</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                {(form.design_config?.signatures || []).slice(0, form.design_config?.signatureCount || 4).map((signature, index) => (
                  <div key={`studio-signature-${index}`} className="rounded-xl border p-3">
                    <div className="grid gap-3">
                      <Input value={signature.name} onChange={(e) => updateSignature(index, { name: e.target.value })} placeholder="İsim" />
                      <Input value={signature.title} onChange={(e) => updateSignature(index, { title: e.target.value })} placeholder="Unvan" />
                      <label>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload("signature", e.target.files[0], index)} />
                        <Button type="button" variant="outline" asChild className="w-full"><span><Stamp className="mr-2 h-4 w-4" /> İmza PNG Yükle</span></Button>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <CardHeader className="border-b border-white/10">
            <CardTitle className="text-white">Canlı Önizleme</CardTitle>
            <CardDescription className="text-slate-300">Ayarlar anlık uygulanır. Yazdırma görünümü de bu alana göre şekillenir.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <CertificatePreviewCard form={form} participant={previewParticipant} className="min-h-[580px]" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
