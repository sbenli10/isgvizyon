// src/components/adep/ADEPScenariosTab.tsx

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, Edit, Trash2, Flame, Home, Waves, Shield, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Scenario {
  id: string;
  hazard_type: string;
  action_steps: string;
}

interface ADEPScenariosTabProps {
  planId: string | undefined;
}

const STANDARD_SCENARIOS = [
  {
    type: "YANGIN",
    icon: Flame,
    color: "red",
    steps: `1. Yangını fark eden kişi en yakın alarm butonuna basar ve sözlü uyarı yapar.
2. Yangın alarm sistemi otomatik olarak devreye girer.
3. Yangın Söndürme Ekibi olay yerine yönlendirilir.
4. Küçük çaplı yangınlarda uygun tipte yangın söndürücü ile ilk müdahale yapılır.
5. Elektrik ana şalteri kapatılır.
6. Gerekli görülürse 110 İtfaiye aranır ve adres net şekilde bildirilir.
7. Tahliye Ekibi katları kontrollü şekilde boşaltır.
8. Asansör kullanılmaz, merdivenler tercih edilir.
9. Toplanma noktasında yoklama alınır.
10. Eksik personel varsa derhal itfaiyeye bildirilir.
11. Yangın sonrası hasar ve risk değerlendirmesi yapılır.
12. Olay raporu hazırlanır ve kök neden analizi yapılır.`,
  },
  {
    type: "DEPREM",
    icon: Home,
    color: "orange",
    steps: `1. Sarsıntı sırasında "ÇÖK-KAPAN-TUTUN" uygulanır.
2. Cam, dolap ve devrilebilecek eşyalardan uzak durulur.
3. Sarsıntı bitmeden bina terk edilmez.
4. Elektrik, doğalgaz ve su vanaları kapatılır.
5. Tahliye Ekibi kontrollü çıkışı başlatır.
6. Merdivenler kullanılır, panik yapılmaz.
7. Yaralılar İlk Yardım Ekibi tarafından güvenli alana alınır.
8. 112 Acil Servis bilgilendirilir.
9. Toplanma noktasında yoklama alınır.
10. Bina hasar kontrolü yapılmadan içeri girilmez.
11. Artçı sarsıntılara karşı dikkatli olunur.
12. Resmi makamların açıklamaları takip edilir.`,
  },
  {
    type: "İŞ KAZASI / YARALANMA",
    icon: AlertTriangle,
    color: "yellow",
    steps: `1. Olay derhal İSG sorumlusuna bildirilir.
2. Olay yeri güvenli hale getirilir.
3. İlk Yardım Ekibi müdahale eder.
4. Gerekli durumlarda 112 Acil aranır.
5. Yaralı güvenli bir alana alınır.
6. Olay fotoğraflanır ve kayıt altına alınır.
7. Tanık ifadeleri alınır.
8. SGK bildirimi için süreç başlatılır.
9. Kaza raporu hazırlanır.
10. Kök neden analizi yapılır.
11. Düzeltici ve önleyici faaliyetler planlanır.
12. Çalışanlara tekrar eğitim verilir.`,
  },
  {
    type: "SABOTAJ / GÜVENLİK TEHDİDİ",
    icon: Shield,
    color: "purple",
    steps: `1. Güvenlik birimine ve yönetime derhal bilgi verilir.
2. Şüpheli alan izole edilir.
3. Kamera kayıtları güvenli şekilde muhafaza edilir.
4. 155 Polis veya ilgili güvenlik birimi aranır.
5. Çalışanlar güvenli bölgeye yönlendirilir.
6. Şüpheli paketlere müdahale edilmez.
7. Giriş-çıkışlar kontrol altına alınır.
8. Olay kayıt altına alınır.
9. Yetkili mercilere yazılı bildirim yapılır.
10. Risk değerlendirmesi güncellenir.
11. Güvenlik prosedürleri gözden geçirilir.
12. Personel bilgilendirme toplantısı yapılır.`,
  },
  {
    type: "SEL / SU BASKINI",
    icon: Waves,
    color: "blue",
   steps: `1. Su baskını tespit edilir edilmez elektrik kesilir.
2. Doğalgaz vanaları kapatılır.
3. Kritik evrak ve ekipmanlar güvenli bölgeye taşınır.
4. Tahliye planı devreye alınır.
5. AFAD (122) ve belediye ekipleri bilgilendirilir.
6. Su tahliye pompaları devreye alınır.
7. Kaygan zeminlere karşı önlem alınır.
8. Kimyasal maddeler güvenli alana taşınır.
9. Toplanma noktasında yoklama yapılır.
10. Hasar tespiti yapılır.
11. Elektrik sistemi kontrol edilmeden enerji verilmez.
12. Olay raporu hazırlanır ve önleyici plan güncellenir.`,
  },
];

export default function ADEPScenariosTab({ planId }: ADEPScenariosTabProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  
  const [scenarioForm, setScenarioForm] = useState({
    hazard_type: "",
    action_steps: "",
  });

  useEffect(() => {
    if (planId) {
      fetchScenarios();
    }
  }, [planId]);

  const fetchScenarios = async () => {
    if (!planId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("adep_scenarios")
        .select("*")
        .eq("plan_id", planId)
        .order("hazard_type");

      if (error) throw error;
      setScenarios(data || []);
    } catch (error: any) {
      console.error("Scenarios fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const initializeStandardScenarios = async () => {
    if (!planId) return;

    try {
      const scenariosData = STANDARD_SCENARIOS.map((scenario) => ({
        plan_id: planId,
        hazard_type: scenario.type,
        action_steps: scenario.steps,
      }));

      const { error } = await supabase
        .from("adep_scenarios")
        .insert(scenariosData);

      if (error) throw error;
      
      toast.success("Standart senaryolar eklendi");
      fetchScenarios();
    } catch (error: any) {
      toast.error("Hata: " + error.message);
    }
  };

  const openDialog = (scenario?: Scenario) => {
    if (scenario) {
      setEditingScenario(scenario);
      setScenarioForm({
        hazard_type: scenario.hazard_type,
        action_steps: scenario.action_steps,
      });
    } else {
      setEditingScenario(null);
      setScenarioForm({
        hazard_type: "",
        action_steps: "",
      });
    }
    setDialogOpen(true);
  };

  const saveScenario = async () => {
    if (!planId || !scenarioForm.hazard_type || !scenarioForm.action_steps) {
      toast.error("Tüm alanlar zorunludur");
      return;
    }

    try {
      const scenarioData = {
        plan_id: planId,
        hazard_type: scenarioForm.hazard_type,
        action_steps: scenarioForm.action_steps,
      };

      if (editingScenario) {
        // Update
        const { error } = await supabase
          .from("adep_scenarios")
          .update(scenarioData)
          .eq("id", editingScenario.id);

        if (error) throw error;
        toast.success("Senaryo güncellendi");
      } else {
        // Create
        const { error } = await supabase
          .from("adep_scenarios")
          .insert([scenarioData]);

        if (error) throw error;
        toast.success("Senaryo eklendi");
      }

      setDialogOpen(false);
      fetchScenarios();
    } catch (error: any) {
      console.error("Save scenario error:", error);
      toast.error("Kaydetme hatası: " + error.message);
    }
  };

  const deleteScenario = async (id: string) => {
    if (!confirm("Bu senaryoyu silmek istediğinizden emin misiniz?")) return;

    try {
      const { error } = await supabase
        .from("adep_scenarios")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Senaryo silindi");
      fetchScenarios();
    } catch (error: any) {
      toast.error("Silme hatası: " + error.message);
    }
  };

  const getScenarioIcon = (type: string) => {
    const scenario = STANDARD_SCENARIOS.find(s => s.type === type);
    return scenario ? scenario.icon : AlertTriangle;
  };

  if (!planId) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">
            Senaryo eklemek için önce planı kaydedin
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Risk Senaryoları ve Uygulama Talimatları</h3>
          <p className="text-sm text-muted-foreground">
            Acil durum senaryolarını ve adım adım müdahale talimatlarını yönetin
          </p>
        </div>

        <div className="flex gap-2">
          {scenarios.length === 0 && (
            <Button onClick={initializeStandardScenarios} variant="outline" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Standart Senaryoları Ekle
            </Button>
          )}

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Yeni Senaryo
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingScenario ? "Senaryo Düzenle" : "Yeni Senaryo Ekle"}
                </DialogTitle>
                <DialogDescription>
                  Acil durum senaryosu ve müdahale adımlarını girin
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="hazard_type">Tehlike Türü *</Label>
                  <Input
                    id="hazard_type"
                    value={scenarioForm.hazard_type}
                    onChange={(e) =>
                      setScenarioForm({ ...scenarioForm, hazard_type: e.target.value })
                    }
                    placeholder="Örn: YANGIN"
                  />
                </div>

                {/* Standart Senaryolar */}
                <div className="flex flex-wrap gap-2">
                  {STANDARD_SCENARIOS.map((scenario) => {
                    const Icon = scenario.icon;
                    return (
                      <Badge
                        key={scenario.type}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground gap-1"
                        onClick={() =>
                          setScenarioForm({
                            hazard_type: scenario.type,
                            action_steps: scenario.steps,
                          })
                        }
                      >
                        <Icon className="h-3 w-3" />
                        {scenario.type}
                      </Badge>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="action_steps">Uygulama Adımları *</Label>
                  <Textarea
                    id="action_steps"
                    value={scenarioForm.action_steps}
                    onChange={(e) =>
                      setScenarioForm({ ...scenarioForm, action_steps: e.target.value })
                    }
                    placeholder="1. İlk adım&#10;2. İkinci adım&#10;..."
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  İptal
                </Button>
                <Button onClick={saveScenario}>Kaydet</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Scenarios List */}
      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          </CardContent>
        </Card>
      ) : scenarios.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <AlertTriangle className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg mb-2">Henüz senaryo eklenmedi</p>
              <p className="text-sm mb-6">
                Standart acil durum senaryolarını ekleyin veya özel senaryo oluşturun
              </p>
              <Button onClick={initializeStandardScenarios} className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Standart Senaryoları Ekle
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Acil Durum Senaryoları</CardTitle>
            <CardDescription>
              Her senaryo için adım adım uygulama talimatları
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {scenarios.map((scenario, index) => {
                const Icon = getScenarioIcon(scenario.hazard_type);
                return (
                  <AccordionItem key={scenario.id} value={scenario.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 w-full">
                        <Icon className="h-5 w-5 text-primary" />
                        <span className="font-semibold text-left flex-1">
                          {scenario.hazard_type}
                        </span>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDialog(scenario);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteScenario(scenario.id);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pl-8 pr-4 py-4 bg-muted/30 rounded-lg">
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                          {scenario.action_steps}
                        </pre>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}