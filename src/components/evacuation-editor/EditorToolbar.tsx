import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Undo2,
  Redo2,
  MousePointer2,
  PenLine,
  Waypoints,
  Type,
  Group,
  Ungroup,
  Copy,
  Trash2,
  Download,
  Save,
  Plus,
  ArrowRight,
  PanelRight,
  Square,
  Circle,
  ImagePlus,
  History,
  Minus,
  Sparkles,
  ImageIcon,
} from "lucide-react";

export type ToolMode = "select" | "line" | "arrow" | "polyline" | "text" | "rect" | "circle";

interface FloorItem {
  id: string;
  name: string;
}

interface EditorToolbarProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  activeTool: ToolMode;
  onToolChange: (tool: ToolMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSaveProject: () => void;
  onExport: (format: "png" | "pdf" | "svg") => void;
  onOpenHistory: () => void;
  onOpenAIGenerator: () => void;
  onOpenAIImprover: () => void;
  onOpenAIImageGenerator: () => void;
  aiGenerating?: boolean;
  aiImproving?: boolean;
  imageGenerating?: boolean;
  zoomPercent: number;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomIn: () => void;
  onUploadBackground: (file: File) => void;
  gridEnabled: boolean;
  onGridEnabledChange: (enabled: boolean) => void;
  gridSnap: boolean;
  onGridSnapChange: (enabled: boolean) => void;
  snapToObjects: boolean;
  onSnapToObjectsChange: (enabled: boolean) => void;
  snapToCenter: boolean;
  onSnapToCenterChange: (enabled: boolean) => void;
  gridSpacing: number;
  onGridSpacingChange: (spacing: number) => void;
  floors: FloorItem[];
  activeFloorId: string;
  onFloorChange: (floorId: string) => void;
  onAddFloor: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
}

const toolOptions: { id: ToolMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "select", label: "Seç", icon: MousePointer2 },
  { id: "line", label: "Çizgi", icon: PenLine },
  { id: "arrow", label: "Ok", icon: ArrowRight },
  { id: "polyline", label: "Poliline", icon: Waypoints },
  { id: "rect", label: "Dikdörtgen", icon: Square },
  { id: "circle", label: "Daire", icon: Circle },
  { id: "text", label: "Metin", icon: Type },
];

export function EditorToolbar(props: EditorToolbarProps) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-950/80 p-3 shadow-[0_10px_40px_rgba(2,6,23,0.35)] backdrop-blur-md">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <Input
          value={props.projectName}
          onChange={(e) => props.onProjectNameChange(e.target.value)}
          className="h-9 w-[230px] shrink-0 border-slate-700 bg-slate-900/80"
          placeholder="Proje adı"
        />

        <Separator orientation="vertical" className="h-8 shrink-0 bg-slate-700" />

        {toolOptions.map((tool) => (
          <Button
            key={tool.id}
            size="sm"
            variant={props.activeTool === tool.id ? "default" : "outline"}
            className="shrink-0 gap-1"
            onClick={() => props.onToolChange(tool.id)}
          >
            <tool.icon className="h-3.5 w-3.5" />
            {tool.label}
          </Button>
        ))}

        <Separator orientation="vertical" className="h-8 shrink-0 bg-slate-700" />

        <Button size="icon" variant="outline" className="shrink-0 bg-slate-900/60" onClick={props.onUndo}><Undo2 className="h-4 w-4" /></Button>
        <Button size="icon" variant="outline" className="shrink-0 bg-slate-900/60" onClick={props.onRedo}><Redo2 className="h-4 w-4" /></Button>
        <Button size="icon" variant="outline" className="shrink-0" onClick={props.onGroup}><Group className="h-4 w-4" /></Button>
        <Button size="icon" variant="outline" className="shrink-0" onClick={props.onUngroup}><Ungroup className="h-4 w-4" /></Button>
        <Button size="icon" variant="outline" className="shrink-0" onClick={props.onDuplicate}><Copy className="h-4 w-4" /></Button>
        <Button size="icon" variant="destructive" className="shrink-0" onClick={props.onDelete}><Trash2 className="h-4 w-4" /></Button>

        <Separator orientation="vertical" className="h-8 shrink-0 bg-slate-700" />

        <Select value={props.activeFloorId} onValueChange={props.onFloorChange}>
          <SelectTrigger className="h-9 w-[160px] shrink-0 border-slate-700 bg-slate-900">
            <SelectValue placeholder="Kat seç" />
          </SelectTrigger>
          <SelectContent>
            {props.floors.map((floor) => (
              <SelectItem key={floor.id} value={floor.id}>{floor.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={props.onAddFloor} className="shrink-0 gap-1">
          <Plus className="h-3.5 w-3.5" /> Kat
        </Button>

        <Separator orientation="vertical" className="h-8 shrink-0 bg-slate-700" />

        <label className="inline-flex cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) props.onUploadBackground(file);
              e.currentTarget.value = "";
            }}
          />
          <Button type="button" size="sm" variant="outline" className="shrink-0 gap-1" asChild>
            <span><ImagePlus className="h-3.5 w-3.5" /> Arka Plan</span>
          </Button>
        </label>

        <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={props.onOpenHistory}>
          <History className="h-3.5 w-3.5" /> Kroki Geçmişleri
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1 border-cyan-700/70 bg-cyan-500/10 text-cyan-200"
          onClick={props.onOpenAIGenerator}
          disabled={props.aiGenerating}
        >
          <Sparkles className="h-3.5 w-3.5" /> {props.aiGenerating ? "AI Oluşturuyor" : "AI ile Kroki Oluştur"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1 border-violet-700/70 bg-violet-500/10 text-violet-200"
          onClick={props.onOpenAIImprover}
          disabled={props.aiImproving}
        >
          <Sparkles className="h-3.5 w-3.5" /> {props.aiImproving ? "AI İyileştiriyor" : "AI Kroki İyileştir"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1 border-emerald-700/70 bg-emerald-500/10 text-emerald-200"
          onClick={props.onOpenAIImageGenerator}
          disabled={props.imageGenerating}
        >
          <ImageIcon className="h-3.5 w-3.5" /> {props.imageGenerating ? "3D Görsel Üretiliyor" : "AI 3D Görsel Oluştur"}
        </Button>

        <div className="flex shrink-0 items-center gap-1 rounded-md border border-slate-700 bg-slate-900/70 p-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={props.onZoomOut}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 min-w-[56px] px-2 text-xs font-semibold" onClick={props.onZoomReset}>
            %{props.zoomPercent}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={props.onZoomIn}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={props.onToggleFocusMode}>
          <PanelRight className="h-3.5 w-3.5" /> {props.focusMode ? "Normal" : "Odak"}
        </Button>
        <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={props.onSaveProject}><Save className="h-3.5 w-3.5" /> Kaydet</Button>
        <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => props.onExport("png")}><Download className="h-3.5 w-3.5" /> PNG</Button>
        <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => props.onExport("pdf")}><Download className="h-3.5 w-3.5" /> PDF</Button>
        <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => props.onExport("svg")}><Download className="h-3.5 w-3.5" /> SVG</Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-slate-800/90 bg-gradient-to-r from-slate-900/70 to-[#09142f] px-3 py-2">
        <div className="flex items-center gap-2">
          <Switch checked={props.gridEnabled} onCheckedChange={props.onGridEnabledChange} />
          <Label className="text-xs text-slate-300">Grid</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={props.gridSnap} onCheckedChange={props.onGridSnapChange} />
          <Label className="text-xs text-slate-300">Grid Snap</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={props.snapToObjects} onCheckedChange={props.onSnapToObjectsChange} />
          <Label className="text-xs text-slate-300">Obje Snap</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={props.snapToCenter} onCheckedChange={props.onSnapToCenterChange} />
          <Label className="text-xs text-slate-300">Merkez Snap</Label>
        </div>
        <div className="flex min-w-[220px] items-center gap-3">
          <Label className="text-xs text-slate-300">Grid Boşluğu</Label>
          <Slider
            min={10}
            max={80}
            step={2}
            value={[props.gridSpacing]}
            onValueChange={(value) => props.onGridSpacingChange(value[0])}
          />
          <span className="w-10 text-right text-xs text-slate-400">{props.gridSpacing}</span>
        </div>
      </div>
    </div>
  );
}
