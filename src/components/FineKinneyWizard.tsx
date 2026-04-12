import { useState, useMemo } from "react";
import { Calculator, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// ✅ Türkçe seçenekler (basit ve anlaşılır)
const probabilityOptions = [
  { value: "0.1", label: "0.1 — Neredeyse imkansız" },
  { value: "0.2", label: "0.2 — Çok az olası" },
  { value: "0.5", label: "0.5 — Düşük ihtimal" },
  { value: "1", label: "1 — Olası değil ama mümkün" },
  { value: "3", label: "3 — Olağandışı" },
  { value: "6", label: "6 — Oldukça olası" },
  { value: "10", label: "10 — Beklenen" },
];

const severityOptions = [
  { value: "1", label: "1 — İlkyardım (hafif yaralanma)" },
  { value: "3", label: "3 — Önemli yaralanma" },
  { value: "7", label: "7 — Ciddi yaralanma (hastaneye gidiş)" },
  { value: "15", label: "15 — Tek kişinin ölümü" },
  { value: "40", label: "40 — Birden fazla ölüm" },
  { value: "100", label: "100 — Felaket" },
];

const frequencyOptions = [
  { value: "0.5", label: "0.5 — Yılda bir kez" },
  { value: "1", label: "1 — Yılda birkaç kez" },
  { value: "2", label: "2 — Ayda bir kez" },
  { value: "3", label: "3 — Haftada bir kez" },
  { value: "6", label: "6 — Günde bir kez" },
  { value: "10", label: "10 — Saatte bir kez" },
];

interface RiskLevel {
  label: string;
  className: string;
  description: string;
  emoji: string;
}

function getRiskLevel(score: number): RiskLevel {
  if (score <= 20)
    return {
      label: "✅ Kabul Edilebilir",
      className: "bg-success/15 text-success border-success/30",
      description: "Risk kabul edilebilir. Acı bir işlem gerekmez.",
      emoji: "✅",
    };
  if (score <= 70)
    return {
      label: "🔵 Olası",
      className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
      description: "Dikkat gerekli. Düzenli kontrol yapın.",
      emoji: "🔵",
    };
  if (score <= 200)
    return {
      label: "🟡 Önemli",
      className: "bg-warning/15 text-warning border-warning/30",
      description: "Düzeltme gerekli. Acilen önlemler alın.",
      emoji: "🟡",
    };
  if (score <= 400)
    return {
      label: "🔴 Yüksek",
      className: "bg-orange-500/15 text-orange-400 border-orange-500/30",
      description: "Derhal düzeltme yapılmalı. Acı işlemler almak zorunlu.",
      emoji: "🔴",
    };
  return {
    label: "⛔ KRİTİK",
    className: "bg-destructive/15 text-destructive border-destructive/30",
    description: "FAALİYETİ DERHAL DURDURUN! Kritik müdahale gerekli.",
    emoji: "⛔",
  };
}

export function FineKinneyWizard() {
  const [probability, setProbability] = useState<string>("");
  const [severity, setSeverity] = useState<string>("");
  const [frequency, setFrequency] = useState<string>("");

  const result = useMemo(() => {
    if (!probability || !severity || !frequency) return null;
    const score =
      parseFloat(probability) *
      parseFloat(severity) *
      parseFloat(frequency);
    return { score, level: getRiskLevel(score) };
  }, [probability, severity, frequency]);

  const reset = () => {
    setProbability("");
    setSeverity("");
    setFrequency("");
  };

  return (
    <div className="glass-card p-6 glow-primary animate-fade-in space-y-5 border border-primary/20">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg gradient-primary">
            <Calculator className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              ⚠️ Fine-Kinney Risk Hesaplama
            </h3>
            <p className="text-xs text-muted-foreground">
              Risk = Olasılık × Şiddet × Frekans
            </p>
          </div>
        </div>
        {result && (
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Sıfırla
          </Button>
        )}
      </div>

      {/* 3 Seçenek */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Olasılık */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-foreground uppercase tracking-wider">
            1️⃣ Ne kadar olası?
          </Label>
          <Select value={probability} onValueChange={setProbability}>
            <SelectTrigger className="bg-secondary/50 border-border/50 hover:border-primary/30">
              <SelectValue placeholder="Seçin..." />
            </SelectTrigger>
            <SelectContent className="bg-card border-border z-50">
              {probabilityOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Şiddet */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-foreground uppercase tracking-wider">
            2️⃣ Ne kadar ciddi?
          </Label>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="bg-secondary/50 border-border/50 hover:border-primary/30">
              <SelectValue placeholder="Seçin..." />
            </SelectTrigger>
            <SelectContent className="bg-card border-border z-50">
              {severityOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Frekans */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-foreground uppercase tracking-wider">
            3️⃣ Ne sıklıkta?
          </Label>
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger className="bg-secondary/50 border-border/50 hover:border-primary/30">
              <SelectValue placeholder="Seçin..." />
            </SelectTrigger>
            <SelectContent className="bg-card border-border z-50">
              {frequencyOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sonuç */}
      {result && (
        <div
          className={`rounded-lg border-2 p-5 space-y-3 animate-fade-in ${result.level.className}`}
        >
          {/* Skor ve Seviye */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{result.score.toFixed(1)}</p>
              <p className="text-xs opacity-75">Risk Skoru</p>
            </div>
            <div className="text-4xl">{result.level.emoji}</div>
          </div>

          {/* Seviye */}
          <div className="text-center font-bold text-lg">
            {result.level.label}
          </div>

          {/* Açıklama */}
          <div className="bg-background/30 p-3 rounded-lg">
            <p className="text-sm font-medium">{result.level.description}</p>
          </div>

          {/* Matematiksel Gösterim */}
          <div className="text-xs opacity-60 text-center font-mono">
            {probability} × {severity} × {frequency} = {result.score.toFixed(1)}
          </div>
        </div>
      )}

      {/* Yardım Metni */}
      {!result && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">
            💡 <span className="font-semibold">Nasıl kullanılır:</span> Yukarıdaki 3 seçeneği doldurun ve riskiniz otomatik hesaplanacak.
          </p>
        </div>
      )}
    </div>
  );
}