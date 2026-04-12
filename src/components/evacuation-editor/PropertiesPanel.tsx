import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Trash2, Copy, ChevronUp, ChevronDown, Upload } from "lucide-react";

interface PropertiesPanelProps {
  selectedObject: any | null;
  onUpdateObject: (updates: Record<string, any>) => void;
  onDeleteObject: () => void;
  onDuplicateObject: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onUploadBackground: (file: File) => void;
}

function toHexColor(value: unknown): string {
  if (typeof value !== "string") return "#22c55e";
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }

  const rgbMatch = v.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgbMatch) return "#22c55e";

  const toPart = (n: string) => {
    const num = Math.max(0, Math.min(255, Number(n)));
    return num.toString(16).padStart(2, "0");
  };

  return `#${toPart(rgbMatch[1])}${toPart(rgbMatch[2])}${toPart(rgbMatch[3])}`;
}

export function PropertiesPanel({
  selectedObject,
  onUpdateObject,
  onDeleteObject,
  onDuplicateObject,
  onBringForward,
  onSendBackward,
  onUploadBackground,
}: PropertiesPanelProps) {
  const objectType = useMemo(() => {
    if (!selectedObject) return "Secili obje yok";
    return `${selectedObject.type || "obje"}`;
  }, [selectedObject]);

  const valueOf = (key: string, fallback: any) => (selectedObject ? (selectedObject as any)[key] ?? fallback : fallback);

  return (
    <Card className="flex h-full min-h-0 flex-col border-slate-700/70 bg-slate-950/40 backdrop-blur-sm shadow-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-100">Ozellikler</CardTitle>
        <p className="text-xs text-slate-400">{objectType}</p>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <div className="space-y-2">
          <Label className="text-xs text-slate-300">Dolu Kat Plani Yukle</Label>
          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-600 px-3 text-xs text-slate-300 hover:border-slate-400">
            <Upload className="h-3.5 w-3.5" />
            Arka plan sec
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadBackground(file);
              }}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-slate-300">X</Label>
            <Input
              type="number"
              className="h-8"
              value={Number(valueOf("left", 0)).toFixed(0)}
              onChange={(e) => onUpdateObject({ left: Number(e.target.value) })}
              disabled={!selectedObject}
            />
          </div>
          <div>
            <Label className="text-xs text-slate-300">Y</Label>
            <Input
              type="number"
              className="h-8"
              value={Number(valueOf("top", 0)).toFixed(0)}
              onChange={(e) => onUpdateObject({ top: Number(e.target.value) })}
              disabled={!selectedObject}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-slate-300">Aciklik</Label>
            <Input
              type="number"
              className="h-8"
              value={Number(valueOf("angle", 0)).toFixed(0)}
              onChange={(e) => onUpdateObject({ angle: Number(e.target.value) })}
              disabled={!selectedObject}
            />
          </div>
          <div>
            <Label className="text-xs text-slate-300">Yazi Boyutu</Label>
            <Input
              type="number"
              className="h-8"
              value={Number(valueOf("fontSize", 20)).toFixed(0)}
              onChange={(e) => onUpdateObject({ fontSize: Number(e.target.value) })}
              disabled={!selectedObject}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-slate-300">Renk</Label>
          <Input
            type="color"
            className="h-9 p-1"
            value={toHexColor(valueOf("fill", "#22c55e"))}
            onChange={(e) => onUpdateObject({ fill: e.target.value, stroke: e.target.value })}
            disabled={!selectedObject}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-slate-300">Opaklik</Label>
          <Slider
            value={[Math.round((Number(valueOf("opacity", 1)) || 1) * 100)]}
            onValueChange={(val) => onUpdateObject({ opacity: val[0] / 100 })}
            min={10}
            max={100}
            step={1}
            disabled={!selectedObject}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="gap-2" onClick={onBringForward} disabled={!selectedObject}>
            <ChevronUp className="h-3.5 w-3.5" /> Uste
          </Button>
          <Button variant="outline" className="gap-2" onClick={onSendBackward} disabled={!selectedObject}>
            <ChevronDown className="h-3.5 w-3.5" /> Alta
          </Button>
          <Button variant="outline" className="gap-2" onClick={onDuplicateObject} disabled={!selectedObject}>
            <Copy className="h-3.5 w-3.5" /> Kopyala
          </Button>
          <Button variant="destructive" className="gap-2" onClick={onDeleteObject} disabled={!selectedObject}>
            <Trash2 className="h-3.5 w-3.5" /> Sil
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
