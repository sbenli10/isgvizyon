import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Lock, Unlock, MoveUp, MoveDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LayerItem {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

interface LayerPanelProps {
  layers: LayerItem[];
  selectedLayerId?: string | null;
  onSelectLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onMoveLayer: (id: string, direction: "up" | "down") => void;
  onDeleteLayer: (id: string) => void;
}

export function LayerPanel({
  layers,
  selectedLayerId,
  onSelectLayer,
  onToggleVisibility,
  onToggleLock,
  onMoveLayer,
  onDeleteLayer,
}: LayerPanelProps) {
  return (
    <Card className="flex h-full min-h-0 flex-col border-slate-700/70 bg-slate-950/40 backdrop-blur-sm shadow-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-100">Katmanlar</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-2 overflow-auto">
        {layers.length === 0 && <p className="text-xs text-slate-400">Katman bulunamadi.</p>}
        {layers.map((layer) => (
          <div
            key={layer.id}
            className={cn(
              "rounded-lg border p-2 transition-colors",
              selectedLayerId === layer.id ? "border-cyan-500 bg-cyan-500/10" : "border-slate-700 bg-slate-900/70"
            )}
          >
            <button onClick={() => onSelectLayer(layer.id)} className="mb-2 block w-full text-left text-xs text-slate-100">
              {layer.name}
            </button>
            <div className="flex flex-wrap gap-1">
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onToggleVisibility(layer.id)}>
                {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </Button>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onToggleLock(layer.id)}>
                {layer.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              </Button>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onMoveLayer(layer.id, "up")}>
                <MoveUp className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onMoveLayer(layer.id, "down")}>
                <MoveDown className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => onDeleteLayer(layer.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}