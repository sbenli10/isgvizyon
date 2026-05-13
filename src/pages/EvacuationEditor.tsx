import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowRight,
  BookOpenCheck,
  Circle,
  Copy,
  DoorOpen,
  Download,
  Eraser,
  FileImage,
  FileText,
  Grid3X3,
  History,
  ImagePlus,
  Layers3,
  Lock,
  Maximize2,
  Minus,
  MousePointer2,
  PanelLeft,
  PenLine,
  Plus,
  Redo2,
  Route,
  Save,
  Search,
  Square,
  Triangle,
  Type,
  Undo2,
  UploadCloud,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  createImageFromURLCompat,
  groupSVGElementsCompat,
  loadSVGFromStringCompat,
  Fabric,
  FabricCtors,
} from "@/components/evacuation-editor/FabricCompat";
import { CanvasWorkspace } from "@/components/evacuation-editor/CanvasWorkspace";
import { HistoryManager } from "@/components/evacuation-editor/HistoryManager";
import { GridSystem } from "@/components/evacuation-editor/GridSystem";
import { SnapSystem } from "@/components/evacuation-editor/SnapSystem";
import type { EditorSymbol } from "@/components/evacuation-editor/SymbolLibrary";
import { ISO7010_SYMBOLS } from "@/components/evacuation-editor/SymbolLibrary";
import type { LegendEntry } from "@/components/evacuation-editor/LegendPanel";
import type { LayerItem } from "@/components/evacuation-editor/LayerPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CanvasTool = "select" | "line" | "arrow" | "polyline" | "text" | "rect" | "circle";
type EditorTool =
  | "select"
  | "rect"
  | "circle"
  | "triangle"
  | "line"
  | "arrow"
  | "pen"
  | "text"
  | "wall"
  | "door"
  | "stairs"
  | "room"
  | "route"
  | "eraser";

type SafetySymbolCategory =
  | "custom"
  | "emergency"
  | "fire"
  | "mandatory"
  | "warning"
  | "prohibition"
  | "direction";

interface SafetySymbol {
  id: string;
  label: string;
  category: SafetySymbolCategory;
  color: string;
  shortCode: string;
  svg?: string;
  imageSrc?: string;
}

interface FloorState {
  id: string;
  name: string;
  canvasJson: string | null;
}

interface SavedProject {
  id: string;
  project_name: string;
  canvas_json: string;
  created_at: string;
  thumbnail_data_url?: string;
}

interface DraftPayload {
  projectName: string;
  floors: FloorState[];
  activeFloorId: string;
  backgroundImage: string | null;
  updatedAt: string;
}

const STORAGE_KEY = "evacuation-editor-projects";
const LOAD_KEY = "evacuation-editor-load-project";
const DRAFT_KEY = "isgvizyon-evacuation-editor-draft";
const CUSTOM_SYMBOLS_KEY = "isgvizyon-evacuation-custom-symbols";
const CANVAS_BASE_SIZE = { width: 1100, height: 680 };

const PropertiesPanel = lazy(() =>
  import("@/components/evacuation-editor/PropertiesPanel").then((module) => ({ default: module.PropertiesPanel })),
);
const LegendPanel = lazy(() =>
  import("@/components/evacuation-editor/LegendPanel").then((module) => ({ default: module.LegendPanel })),
);
const LayerPanel = lazy(() =>
  import("@/components/evacuation-editor/LayerPanel").then((module) => ({ default: module.LayerPanel })),
);
const loadEvacuationExportService = () => import("@/components/evacuation-editor/ExportService");

const initialFloor: FloorState = {
  id: "floor-ground",
  name: "Zemin Kat",
  canvasJson: null,
};

const categoryLabels: Record<SafetySymbolCategory, string> = {
  custom: "Özel Sembollerim",
  emergency: "Acil Durum (E)",
  fire: "Yangın (F)",
  mandatory: "Emredici (M)",
  warning: "Uyarı (W)",
  prohibition: "Yasaklayıcı (P)",
  direction: "Yönlendirme Okları",
};

const toolButtons: Array<{ id: EditorTool; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "select", label: "Seç", icon: MousePointer2 },
  { id: "rect", label: "Dikdörtgen", icon: Square },
  { id: "circle", label: "Daire", icon: Circle },
  { id: "triangle", label: "Üçgen", icon: Triangle },
  { id: "line", label: "Çizgi", icon: PenLine },
  { id: "arrow", label: "Ok", icon: ArrowRight },
  { id: "pen", label: "Kalem", icon: Route },
  { id: "text", label: "Metin", icon: Type },
  { id: "wall", label: "Duvar", icon: Layers3 },
  { id: "door", label: "Kapı", icon: DoorOpen },
  { id: "stairs", label: "Merdiven", icon: PanelLeft },
  { id: "room", label: "Alan", icon: Square },
  { id: "route", label: "Rota Oku", icon: Route },
  { id: "eraser", label: "Silgi", icon: Eraser },
];

const loadDefaultSvg = (id: string) => ISO7010_SYMBOLS.find((symbol) => symbol.id === id)?.svg;

const buildSymbolSvg = (shortCode: string, background: string, foreground = "#ffffff") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">
    <rect x="4" y="4" width="64" height="64" rx="12" fill="${background}" />
    <rect x="4" y="4" width="64" height="64" rx="12" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2" />
    <text x="36" y="42" text-anchor="middle" font-size="18" font-family="Arial, sans-serif" font-weight="700" fill="${foreground}">
      ${shortCode}
    </text>
  </svg>`;

const BASE_SYMBOLS: SafetySymbol[] = [
  {
    id: "emergency-exit",
    label: "Acil Çıkış",
    category: "emergency",
    color: "#16a34a",
    shortCode: "E1",
    svg: loadDefaultSvg("emergency-exit") || buildSymbolSvg("E1", "#16a34a"),
  },
  {
    id: "emergency-door",
    label: "Acil Çıkış Kapısı",
    category: "emergency",
    color: "#15803d",
    shortCode: "E2",
    svg: loadDefaultSvg("emergency-door") || buildSymbolSvg("E2", "#15803d"),
  },
  {
    id: "first-aid",
    label: "İlk Yardım",
    category: "emergency",
    color: "#16a34a",
    shortCode: "E3",
    svg: loadDefaultSvg("first-aid") || buildSymbolSvg("E3", "#16a34a"),
  },
  {
    id: "emergency-phone",
    label: "Acil Telefon",
    category: "emergency",
    color: "#2563eb",
    shortCode: "E4",
    svg: loadDefaultSvg("emergency-phone") || buildSymbolSvg("E4", "#2563eb"),
  },
  { id: "assembly-point", label: "Toplanma Noktası", category: "emergency", color: "#1d4ed8", shortCode: "E5", svg: loadDefaultSvg("assembly-point") || buildSymbolSvg("E5", "#1d4ed8") },
  { id: "aed-device", label: "AED Cihazı", category: "emergency", color: "#0f766e", shortCode: "E6", svg: buildSymbolSvg("AED", "#0f766e") },
  { id: "eye-wash", label: "Göz Yıkama", category: "emergency", color: "#0f766e", shortCode: "E7", svg: buildSymbolSvg("E7", "#0f766e") },
  { id: "emergency-shower", label: "Acil Duş", category: "emergency", color: "#0891b2", shortCode: "E8", svg: buildSymbolSvg("E8", "#0891b2") },
  { id: "stretcher", label: "Sedye", category: "emergency", color: "#0f766e", shortCode: "E9", svg: buildSymbolSvg("E9", "#0f766e") },
  { id: "evacuation-plan", label: "Tahliye Planı", category: "emergency", color: "#2563eb", shortCode: "EP", svg: buildSymbolSvg("EP", "#2563eb") },
  { id: "exit-down", label: "Çıkış Aşağı", category: "direction", color: "#16a34a", shortCode: "↓", svg: buildSymbolSvg("↓", "#16a34a") },
  { id: "exit-right", label: "Çıkış Sağ", category: "direction", color: "#16a34a", shortCode: "→", svg: loadDefaultSvg("evac-arrow") || buildSymbolSvg("→", "#16a34a") },
  { id: "exit-left", label: "Çıkış Sol", category: "direction", color: "#16a34a", shortCode: "←", svg: buildSymbolSvg("←", "#16a34a") },
  { id: "fire-extinguisher", label: "Yangın Söndürücü", category: "fire", color: "#dc2626", shortCode: "F1", svg: loadDefaultSvg("fire-extinguisher") || buildSymbolSvg("F1", "#dc2626") },
  { id: "fire-hose", label: "Yangın Hortumu", category: "fire", color: "#b91c1c", shortCode: "F2", svg: loadDefaultSvg("fire-hose") || buildSymbolSvg("F2", "#b91c1c") },
  { id: "fire-stairs", label: "Yangın Merdiveni", category: "fire", color: "#991b1b", shortCode: "F3", svg: loadDefaultSvg("stairs") || buildSymbolSvg("F3", "#991b1b") },
  { id: "alarm-button", label: "Alarm Butonu", category: "fire", color: "#ef4444", shortCode: "F4", svg: loadDefaultSvg("alarm-button") || buildSymbolSvg("F4", "#ef4444") },
  { id: "fire-phone", label: "Yangın Telefonu", category: "fire", color: "#b91c1c", shortCode: "F5", svg: buildSymbolSvg("F5", "#b91c1c") },
  { id: "fire-door", label: "Yangın Kapısı", category: "fire", color: "#991b1b", shortCode: "F6", svg: buildSymbolSvg("F6", "#991b1b") },
  { id: "blanket", label: "Söndürme Battaniyesi", category: "fire", color: "#dc2626", shortCode: "F7", svg: buildSymbolSvg("F7", "#dc2626") },
  { id: "cabinet", label: "Hortum Dolabı", category: "fire", color: "#b91c1c", shortCode: "F8", svg: loadDefaultSvg("fire-cabinet") || buildSymbolSvg("F8", "#b91c1c") },
  { id: "mandatory-general", label: "Genel Zorunluluk", category: "mandatory", color: "#2563eb", shortCode: "M1", svg: buildSymbolSvg("M1", "#2563eb") },
  { id: "read-instruction", label: "Talimatı Oku", category: "mandatory", color: "#1d4ed8", shortCode: "M2", svg: buildSymbolSvg("M2", "#1d4ed8") },
  { id: "gloves", label: "Eldiven", category: "mandatory", color: "#2563eb", shortCode: "M3", svg: buildSymbolSvg("M3", "#2563eb") },
  { id: "helmet", label: "Baret Kullan", category: "mandatory", color: "#2563eb", shortCode: "M4", svg: buildSymbolSvg("M4", "#2563eb") },
  { id: "mask", label: "Maske Kullan", category: "mandatory", color: "#2563eb", shortCode: "M5", svg: buildSymbolSvg("M5", "#2563eb") },
  { id: "safety-belt", label: "Emniyet Kemeri", category: "mandatory", color: "#1d4ed8", shortCode: "M6", svg: buildSymbolSvg("M6", "#1d4ed8") },
  { id: "warning-general", label: "Genel Tehlike", category: "warning", color: "#f59e0b", shortCode: "W1", svg: buildSymbolSvg("W1", "#f59e0b", "#111827") },
  { id: "radioactive", label: "Radyoaktif", category: "warning", color: "#f59e0b", shortCode: "W2", svg: buildSymbolSvg("W2", "#f59e0b", "#111827") },
  { id: "laser", label: "Lazer Işını", category: "warning", color: "#f59e0b", shortCode: "W3", svg: buildSymbolSvg("W3", "#f59e0b", "#111827") },
  { id: "electric", label: "Elektrik Tehlikesi", category: "warning", color: "#eab308", shortCode: "W4", svg: buildSymbolSvg("W4", "#eab308", "#111827") },
  { id: "hot-surface", label: "Sıcak Yüzey", category: "warning", color: "#f59e0b", shortCode: "W5", svg: buildSymbolSvg("W5", "#f59e0b", "#111827") },
  { id: "panel", label: "Elektrik Panosu", category: "warning", color: "#f59e0b", shortCode: "W6", svg: buildSymbolSvg("W6", "#f59e0b", "#111827") },
  { id: "prohibition-general", label: "Genel Yasak", category: "prohibition", color: "#dc2626", shortCode: "P1", svg: buildSymbolSvg("P1", "#dc2626") },
  { id: "no-smoking", label: "Sigara İçilmez", category: "prohibition", color: "#dc2626", shortCode: "P2", svg: buildSymbolSvg("P2", "#dc2626") },
  { id: "no-fire", label: "Ateşle Yaklaşma", category: "prohibition", color: "#dc2626", shortCode: "P3", svg: buildSymbolSvg("P3", "#dc2626") },
  { id: "no-entry", label: "Giriş Yasaktır", category: "prohibition", color: "#b91c1c", shortCode: "P4", svg: buildSymbolSvg("P4", "#b91c1c") },
  { id: "do-not-touch", label: "Dokunma", category: "prohibition", color: "#b91c1c", shortCode: "P5", svg: buildSymbolSvg("P5", "#b91c1c") },
  { id: "safe-way-1", label: "Güvenli Yol Oku 1", category: "direction", color: "#16a34a", shortCode: "↗", svg: buildSymbolSvg("↗", "#16a34a") },
  { id: "safe-way-2", label: "Güvenli Yol Oku 2", category: "direction", color: "#16a34a", shortCode: "↘", svg: buildSymbolSvg("↘", "#16a34a") },
  { id: "fire-arrow-1", label: "Yangın Ekipman Oku 1", category: "direction", color: "#dc2626", shortCode: "→", svg: buildSymbolSvg("→", "#dc2626") },
  { id: "fire-arrow-2", label: "Yangın Ekipman Oku 2", category: "direction", color: "#dc2626", shortCode: "↓", svg: buildSymbolSvg("↓", "#dc2626") },
];

const PanelLoadingCard = ({ message, compact = false }: { message: string; compact?: boolean }) => (
  <div
    className={[
      "flex h-full items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/60 px-4 text-center text-sm text-slate-300",
      compact ? "min-h-[160px]" : "min-h-[220px]",
    ].join(" ")}
  >
    <div className="flex items-center gap-3">
      <div className="h-2 w-2 rounded-full bg-cyan-300" />
      {message}
    </div>
  </div>
);

function SymbolCard({
  symbol,
  onAdd,
}: {
  symbol: SafetySymbol;
  onAdd: (symbol: SafetySymbol) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAdd(symbol)}
      className="group rounded-2xl border border-white/10 bg-slate-900/80 p-2.5 text-left transition-all hover:border-cyan-400/40 hover:bg-slate-800"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1 shadow-sm">
          {symbol.imageSrc ? (
            <img src={symbol.imageSrc} alt={symbol.label} className="h-10 w-10 object-contain" />
          ) : (
            <div className="h-10 w-10" dangerouslySetInnerHTML={{ __html: symbol.svg || buildSymbolSvg(symbol.shortCode, symbol.color) }} />
          )}
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 text-xs font-semibold text-slate-100">{symbol.label}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">{symbol.shortCode}</p>
        </div>
      </div>
    </button>
  );
}

function SymbolSidebar({
  symbols,
  query,
  onQueryChange,
  onAddSymbol,
  onUploadCustomSymbol,
}: {
  symbols: SafetySymbol[];
  query: string;
  onQueryChange: (value: string) => void;
  onAddSymbol: (symbol: SafetySymbol) => void;
  onUploadCustomSymbol: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const groupedSymbols = useMemo(() => {
    const next = new Map<SafetySymbolCategory, SafetySymbol[]>();
    (Object.keys(categoryLabels) as SafetySymbolCategory[]).forEach((category) => next.set(category, []));
    symbols.forEach((symbol) => {
      next.get(symbol.category)?.push(symbol);
    });
    return next;
  }, [symbols]);

  const visibleCategories = (Object.keys(categoryLabels) as SafetySymbolCategory[]).filter(
    (category) => (groupedSymbols.get(category) || []).length > 0,
  );

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[24px] border border-white/10 bg-[#172033] p-4 shadow-[0_24px_70px_rgba(2,8,23,0.35)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Semboller</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-100">İşaret Kütüphanesi</h2>
        </div>
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9 border-cyan-400/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
          onClick={() => inputRef.current?.click()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="İşaret ara..."
          className="h-10 rounded-2xl border-white/10 bg-slate-950/70 pl-9 text-slate-100 placeholder:text-slate-500"
        />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".svg,image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUploadCustomSymbol(file);
          event.currentTarget.value = "";
        }}
      />

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="space-y-5">
          {visibleCategories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
              Sembol bulunamadı.
            </div>
          ) : null}

          {visibleCategories.map((category) => {
            const items = groupedSymbols.get(category) || [];
            if (!items.length) return null;
            return (
              <section key={category} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {categoryLabels[category]}
                  </h3>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-slate-400">
                    {items.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {items.map((symbol) => (
                    <SymbolCard key={symbol.id} symbol={symbol} onAdd={onAddSymbol} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function EvacuationEditor() {
  const navigate = useNavigate();
  const canvasRef = useRef<any | null>(null);
  const historyRef = useRef<HistoryManager | null>(null);
  const snapRef = useRef<SnapSystem | null>(null);
  const hiddenPlanUploadRef = useRef<HTMLInputElement | null>(null);
  const gridConfigRef = useRef({ enabled: true, spacing: 20 });

  const [editorOpen, setEditorOpen] = useState(false);
  const [projectName, setProjectName] = useState("Yeni Kroki");
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const [selectedObject, setSelectedObject] = useState<any | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [legendOpen, setLegendOpen] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSnap, setGridSnap] = useState(true);
  const [snapToObjects, setSnapToObjects] = useState(true);
  const [snapToCenter, setSnapToCenter] = useState(true);
  const [gridSpacing, setGridSpacing] = useState(20);
  const [symbolQuery, setSymbolQuery] = useState("");
  const [customSymbols, setCustomSymbols] = useState<SafetySymbol[]>([]);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundLocked, setBackgroundLocked] = useState(false);
  const [canvasSize, setCanvasSize] = useState(CANVAS_BASE_SIZE);
  const [floors, setFloors] = useState<FloorState[]>([initialFloor]);
  const [activeFloorId, setActiveFloorId] = useState(initialFloor.id);
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [legendItems, setLegendItems] = useState<LegendEntry[]>([]);

  const activeFloor = useMemo(() => floors.find((floor) => floor.id === activeFloorId) ?? floors[0], [floors, activeFloorId]);

  const allSymbols = useMemo(() => [...customSymbols, ...BASE_SYMBOLS], [customSymbols]);
  const filteredSymbols = useMemo(() => {
    const normalized = symbolQuery.trim().toLocaleLowerCase("tr-TR");
    if (!normalized) return allSymbols;
    return allSymbols.filter((symbol) => symbol.label.toLocaleLowerCase("tr-TR").includes(normalized));
  }, [allSymbols, symbolQuery]);

  const buildCanvasJSON = useCallback((canvas: any) => {
    const json = canvas.toJSON(["denetronMeta", "symbolId", "symbolName", "legendEmoji", "name"] as any) as any;
    if (Array.isArray(json?.objects)) {
      json.objects = json.objects.filter((obj: any) => obj?.denetronMeta?.kind !== "grid");
    }
    return json;
  }, []);

  const updateLayersAndLegend = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const objects = canvas
      .getObjects()
      .filter((obj: any) => obj?.denetronMeta?.kind !== "grid")
      .map((obj: any, index: number) => {
        if (!obj.denetronMeta) obj.denetronMeta = {};
        if (!obj.denetronMeta.layerId) {
          obj.denetronMeta.layerId = `layer-${Date.now()}-${index}`;
        }

        const layerName = obj.denetronMeta?.name || obj.denetronMeta?.symbolName || obj.type || `Katman ${index + 1}`;

        return {
          id: obj.denetronMeta.layerId,
          name: layerName,
          visible: obj.visible !== false,
          locked: obj.lockMovementX === true,
          ref: obj,
        };
      });

    setLayers(objects.slice().reverse().map(({ id, name, visible, locked }) => ({ id, name, visible, locked })));

    const legendMap = new Map<string, LegendEntry>();
    objects.forEach(({ ref }) => {
      const symbolId = ref?.denetronMeta?.symbolId;
      const symbolName = ref?.denetronMeta?.symbolName;
      const legendEmoji = ref?.denetronMeta?.legendEmoji;
      if (!symbolId || !symbolName) return;

      const current = legendMap.get(symbolId);
      if (current) {
        current.count += 1;
      } else {
        legendMap.set(symbolId, {
          id: symbolId,
          name: symbolName,
          emoji: legendEmoji || "*",
          count: 1,
        });
      }
    });

    setLegendItems(Array.from(legendMap.values()));
  }, []);

  const findBackgroundObject = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getObjects().find((obj: any) => obj?.denetronMeta?.kind === "background") || null;
  }, []);

  const syncActiveFloorJson = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const serialized = JSON.stringify(buildCanvasJSON(canvas));
    setFloors((prev) => prev.map((floor) => (floor.id === activeFloorId ? { ...floor, canvasJson: serialized } : floor)));
  }, [activeFloorId, buildCanvasJSON]);

  const refreshBackgroundState = useCallback(() => {
    const backgroundObject = findBackgroundObject();
    setBackgroundImage(backgroundObject ? "loaded" : null);
    setBackgroundLocked(Boolean(backgroundObject?.lockMovementX));
  }, [findBackgroundObject]);

  const restoreFloor = useCallback(
    async (floor: FloorState | undefined) => {
      const canvas = canvasRef.current;
      if (!canvas || !floor) return;

      canvas.clear();
      canvas.set("backgroundColor", "#ffffff");

      if (floor.canvasJson) {
        await canvas.loadFromJSON(floor.canvasJson);
      }

      GridSystem.apply(canvas, showGrid, gridSpacing);
      canvas.requestRenderAll();
      historyRef.current?.pushSnapshot();
      updateLayersAndLegend();
      refreshBackgroundState();
    },
    [gridSpacing, refreshBackgroundState, showGrid, updateLayersAndLegend],
  );

  const loadSavedProject = useCallback(
    async (project: SavedProject) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        const parsed = JSON.parse(project.canvas_json);
        const incomingFloors = Array.isArray(parsed?.floors) ? parsed.floors : [initialFloor];
        const incomingActiveFloorId = parsed?.activeFloorId || incomingFloors[0]?.id || initialFloor.id;

        setProjectName(project.project_name || "Yeni Kroki");
        setFloors(incomingFloors);
        setActiveFloorId(incomingActiveFloorId);

        const floorToLoad = incomingFloors.find((floor: FloorState) => floor.id === incomingActiveFloorId) || incomingFloors[0];
        await restoreFloor(floorToLoad);
        toast.success("Kroki geçmişten yüklendi.");
      } catch {
        toast.error("Kayıtlı kroki yüklenemedi.");
      }
    },
    [restoreFloor],
  );

  const handleCanvasReady = useCallback(
    (canvas: any) => {
      canvasRef.current = canvas;
      canvas.set("backgroundColor", "#ffffff");
      setCanvasSize({ width: canvas.getWidth(), height: canvas.getHeight() });

      historyRef.current?.destroy();
      historyRef.current = new HistoryManager(canvas);

      snapRef.current?.destroy();
      snapRef.current = new SnapSystem(canvas, {
        gridEnabled: gridSnap,
        gridSpacing,
        snapToObjects,
        snapToCenter,
      });

      GridSystem.apply(canvas, showGrid, gridSpacing);

      const pendingId = localStorage.getItem(LOAD_KEY);
      if (pendingId) {
        localStorage.removeItem(LOAD_KEY);
        const projects: SavedProject[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        const pending = projects.find((item) => item.id === pendingId);
        if (pending) {
          void loadSavedProject(pending);
          return;
        }
      }

      if (activeFloor?.canvasJson) {
        void restoreFloor(activeFloor);
      } else {
        updateLayersAndLegend();
        refreshBackgroundState();
      }
    },
    [
      activeFloor,
      gridSnap,
      gridSpacing,
      loadSavedProject,
      refreshBackgroundState,
      restoreFloor,
      showGrid,
      snapToCenter,
      snapToObjects,
      updateLayersAndLegend,
    ],
  );

  useEffect(() => {
    const storedCustomSymbols = localStorage.getItem(CUSTOM_SYMBOLS_KEY);
    if (storedCustomSymbols) {
      try {
        setCustomSymbols(JSON.parse(storedCustomSymbols));
      } catch {
        localStorage.removeItem(CUSTOM_SYMBOLS_KEY);
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    GridSystem.apply(canvas, showGrid, gridSpacing);
    snapRef.current?.updateOptions({
      enabled: gridSnap || snapToObjects || snapToCenter,
      gridEnabled: gridSnap,
      gridSpacing,
      snapToObjects,
      snapToCenter,
    });
  }, [gridSnap, gridSpacing, showGrid, snapToCenter, snapToObjects]);

  useEffect(() => {
    gridConfigRef.current = { enabled: showGrid, spacing: gridSpacing };
  }, [showGrid, gridSpacing]);

  useEffect(() => {
    if (!editorOpen || !canvasRef.current) return;
    void restoreFloor(activeFloor);
  }, [activeFloor, editorOpen, restoreFloor]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTyping) return;

      if (event.key === "Delete") {
        deleteSelected();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        void duplicateSelected();
      }
    };

    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });

  useEffect(() => {
    if (!editorOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditorOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [editorOpen]);

  const handleCanvasResize = useCallback((canvas: any) => {
    GridSystem.apply(canvas, gridConfigRef.current.enabled, gridConfigRef.current.spacing);
    setCanvasSize({ width: canvas.getWidth(), height: canvas.getHeight() });
  }, []);

  const applyCanvasZoom = useCallback((nextZoom: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const clamped = Math.max(0.5, Math.min(2, nextZoom));
    const point = Fabric?.Point
      ? new Fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2)
      : ({ x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 } as any);

    canvas.zoomToPoint(point, clamped);
    canvas.requestRenderAll();
    setZoomPercent(Math.round(clamped * 100));
  }, []);

  const zoomIn = useCallback(() => applyCanvasZoom((zoomPercent + 10) / 100), [applyCanvasZoom, zoomPercent]);
  const zoomOut = useCallback(() => applyCanvasZoom((zoomPercent - 10) / 100), [applyCanvasZoom, zoomPercent]);
  const zoomReset = useCallback(() => applyCanvasZoom(1), [applyCanvasZoom]);

  const getActiveObject = () => canvasRef.current?.getActiveObject() as any;

  const handleUpdateObject = (updates: Record<string, any>) => {
    const canvas = canvasRef.current;
    const object = getActiveObject();
    if (!canvas || !object) return;
    object.set(updates);
    object.setCoords();
    canvas.requestRenderAll();
    syncActiveFloorJson();
  };

  const deleteSelected = () => {
    const canvas = canvasRef.current;
    const active = getActiveObject();
    if (!canvas || !active) return;

    if (active.type === "activeSelection") {
      (active.getObjects() || []).forEach((obj: any) => canvas.remove(obj));
    } else {
      canvas.remove(active);
    }

    canvas.discardActiveObject();
    canvas.requestRenderAll();
    updateLayersAndLegend();
    syncActiveFloorJson();
    refreshBackgroundState();
  };

  const duplicateSelected = async () => {
    const canvas = canvasRef.current;
    const active = getActiveObject();
    if (!canvas || !active) return;

    const cloned = await active.clone();
    cloned.set({ left: (active.left || 0) + 24, top: (active.top || 0) + 24 });
    canvas.add(cloned);
    canvas.setActiveObject(cloned);
    canvas.requestRenderAll();
    updateLayersAndLegend();
    syncActiveFloorJson();
  };

  const groupSelection = () => {
    const canvas = canvasRef.current;
    const active = getActiveObject();
    if (!canvas || !active || active.type !== "activeSelection") return;
    (active as any).toGroup();
    canvas.requestRenderAll();
    updateLayersAndLegend();
    syncActiveFloorJson();
  };

  const ungroupSelection = () => {
    const canvas = canvasRef.current;
    const active = getActiveObject();
    if (!canvas || !active || active.type !== "group") return;
    (active as any).toActiveSelection();
    canvas.requestRenderAll();
    updateLayersAndLegend();
    syncActiveFloorJson();
  };

  const moveLayer = (layerId: string, direction: "up" | "down") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const target = canvas.getObjects().find((obj: any) => obj?.denetronMeta?.layerId === layerId) as any;
    if (!target) return;
    if (direction === "up") target.bringForward();
    else target.sendBackwards();
    canvas.requestRenderAll();
    updateLayersAndLegend();
    syncActiveFloorJson();
  };

  const toggleLayerVisibility = (layerId: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const target = canvas.getObjects().find((obj: any) => obj?.denetronMeta?.layerId === layerId) as any;
    if (!target) return;
    target.set({ visible: !target.visible });
    canvas.requestRenderAll();
    updateLayersAndLegend();
    syncActiveFloorJson();
  };

  const toggleLayerLock = (layerId: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const target = canvas.getObjects().find((obj: any) => obj?.denetronMeta?.layerId === layerId) as any;
    if (!target) return;
    const shouldLock = !target.lockMovementX;
    target.set({
      lockMovementX: shouldLock,
      lockMovementY: shouldLock,
      lockScalingX: shouldLock,
      lockScalingY: shouldLock,
      lockRotation: shouldLock,
      selectable: !shouldLock,
    });
    canvas.requestRenderAll();
    updateLayersAndLegend();
    syncActiveFloorJson();
  };

  const deleteLayer = (layerId: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const target = canvas.getObjects().find((obj: any) => obj?.denetronMeta?.layerId === layerId);
    if (!target) return;
    canvas.remove(target);
    canvas.requestRenderAll();
    updateLayersAndLegend();
    syncActiveFloorJson();
    refreshBackgroundState();
  };

  const selectLayer = (layerId: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const target = canvas.getObjects().find((obj: any) => obj?.denetronMeta?.layerId === layerId);
    if (!target) return;
    canvas.setActiveObject(target);
    canvas.requestRenderAll();
  };

  const saveProject = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const activeFloorJson = JSON.stringify(buildCanvasJSON(canvas));
    const floorsToSave = floors.map((floor) =>
      floor.id === activeFloorId ? { ...floor, canvasJson: activeFloorJson } : floor,
    );

    setFloors(floorsToSave);

    const payload: SavedProject = {
      id: crypto.randomUUID(),
      project_name: projectName,
      canvas_json: JSON.stringify({ floors: floorsToSave, activeFloorId }),
      created_at: new Date().toISOString(),
      thumbnail_data_url: canvas.toDataURL({ format: "png", multiplier: 0.8 } as any),
    };

    const existing: SavedProject[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    localStorage.setItem(STORAGE_KEY, JSON.stringify([payload, ...existing]));
    toast.success("Kroki kaydedildi. Geçmiş ekranından tekrar yükleyebilirsiniz.");
  };

  const saveDraft = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const activeFloorJson = JSON.stringify(buildCanvasJSON(canvas));
    const floorsToSave = floors.map((floor) =>
      floor.id === activeFloorId ? { ...floor, canvasJson: activeFloorJson } : floor,
    );

    const payload: DraftPayload = {
      projectName,
      floors: floorsToSave,
      activeFloorId,
      backgroundImage,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    setFloors(floorsToSave);
    toast.success("Taslak kaydedildi.");
  };

  const loadDraft = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stored = localStorage.getItem(DRAFT_KEY);
    if (!stored) {
      toast.error("Yüklenecek taslak bulunamadı.");
      return;
    }

    try {
      const parsed = JSON.parse(stored) as DraftPayload;
      setProjectName(parsed.projectName || "Yeni Kroki");
      setFloors(parsed.floors?.length ? parsed.floors : [initialFloor]);
      setActiveFloorId(parsed.activeFloorId || parsed.floors?.[0]?.id || initialFloor.id);
      setBackgroundImage(parsed.backgroundImage || null);
      const nextFloor =
        parsed.floors?.find((floor) => floor.id === (parsed.activeFloorId || initialFloor.id)) || parsed.floors?.[0];
      await restoreFloor(nextFloor);
      toast.success("Taslak yüklendi.");
    } catch {
      toast.error("Taslak yüklenemedi.");
    }
  };

  const clearCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!window.confirm("Aktif kat temizlensin mi?")) return;

    canvas.clear();
    canvas.set("backgroundColor", "#ffffff");
    GridSystem.apply(canvas, showGrid, gridSpacing);
    canvas.requestRenderAll();
    historyRef.current?.pushSnapshot();
    setSelectedObject(null);
    setLegendItems([]);
    setLayers([]);
    setBackgroundImage(null);
    setBackgroundLocked(false);
    setFloors((prev) => prev.map((floor) => (floor.id === activeFloorId ? { ...floor, canvasJson: null } : floor)));
    toast.success("Aktif kat temizlendi.");
  };

  const exportByFormat = async (formatName: "png" | "pdf") => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { ExportService } = await loadEvacuationExportService();
    const fileName = "acil-durum-krokisi";

    if (formatName === "png") {
      await ExportService.exportPNG(canvas, fileName);
      return;
    }

    await ExportService.exportPDF({
      canvas,
      fileName,
      projectName,
      legendItems: legendItems.map((item) => ({ ...item })),
      legendElement: document.getElementById("evacuation-legend"),
      dateLabel: format(new Date(), "dd.MM.yyyy HH:mm"),
    });
  };

  const handleExportPng = useCallback(() => {
    void exportByFormat("png");
  }, []);

  const handleExportPdf = useCallback(() => {
    void exportByFormat("pdf");
  }, []);

  const changeFloor = useCallback(
    async (floorId: string) => {
      if (floorId === activeFloorId) return;
      syncActiveFloorJson();
      setActiveFloorId(floorId);
      const floor = floors.find((item) => item.id === floorId);
      await restoreFloor(floor);
    },
    [activeFloorId, floors, restoreFloor, syncActiveFloorJson],
  );

  const addFloor = () => {
    const newFloor: FloorState = {
      id: `floor-${Date.now()}`,
      name: `${floors.length}. Kat`,
      canvasJson: null,
    };

    syncActiveFloorJson();
    setFloors((prev) => [...prev, newFloor]);
    setActiveFloorId(newFloor.id);
    setTimeout(() => {
      void restoreFloor(newFloor);
    }, 0);
  };

  const handleAddSymbol = async (symbol: SafetySymbol) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      if (symbol.imageSrc) {
        const image = await createImageFromURLCompat(symbol.imageSrc);
        image.set({
          left: canvas.getWidth() / 2,
          top: canvas.getHeight() / 2,
          originX: "center",
          originY: "center",
          scaleX: 0.6,
          scaleY: 0.6,
          cornerStyle: "circle",
          transparentCorners: false,
        } as any);
        (image as any).denetronMeta = {
          kind: "symbol",
          name: symbol.label,
          symbolId: symbol.id,
          symbolName: symbol.label,
          legendEmoji: symbol.shortCode,
        };
        canvas.add(image);
        canvas.setActiveObject(image);
      } else {
        const loaded = await loadSVGFromStringCompat(symbol.svg || buildSymbolSvg(symbol.shortCode, symbol.color));
        const grouped = groupSVGElementsCompat(loaded.objects, loaded.options);
        grouped.set({
          left: canvas.getWidth() / 2,
          top: canvas.getHeight() / 2,
          originX: "center",
          originY: "center",
          scaleX: 0.78,
          scaleY: 0.78,
          cornerStyle: "circle",
          transparentCorners: false,
        } as any);
        (grouped as any).denetronMeta = {
          kind: "symbol",
          name: symbol.label,
          symbolId: symbol.id,
          symbolName: symbol.label,
          legendEmoji: symbol.shortCode,
        };
        canvas.add(grouped as any);
        canvas.setActiveObject(grouped as any);
      }

      canvas.requestRenderAll();
      updateLayersAndLegend();
      syncActiveFloorJson();
    } catch (error) {
      console.error("Sembol ekleme hatası:", error);
      toast.error("Sembol eklenemedi.");
    }
  };

  const applyUploadedBackground = async (file: File) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("PDF yükleme şu an desteklenmiyor. Lütfen PNG, JPG veya SVG kullanın.");
      return;
    }

    const dataUrl = await readAsDataUrl(file);
    let image: any;
    try {
      image = await createImageFromURLCompat(dataUrl);
    } catch {
      toast.error("Kroki görseli yüklenemedi.");
      return;
    }

    const existingBackground = findBackgroundObject();
    if (existingBackground) {
      canvas.remove(existingBackground);
    }

    image.set({
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
      originX: "center",
      originY: "center",
      opacity: 0.82,
      lockScalingFlip: true,
      selectable: true,
      evented: true,
      lockRotation: true,
    } as any);

    const fitScale = Math.min(canvas.getWidth() / (image.width || 1), canvas.getHeight() / (image.height || 1));
    image.scale(fitScale);
    (image as any).denetronMeta = { kind: "background", name: "Kat Planı" };

    canvas.add(image as any);
    image.sendToBack();
    GridSystem.apply(canvas, showGrid, gridSpacing);
    canvas.requestRenderAll();
    setBackgroundImage(dataUrl);
    setBackgroundLocked(false);
    updateLayersAndLegend();
    syncActiveFloorJson();
    toast.success("Kroki görseli çalışma alanına eklendi.");
  };

  const handleUploadCustomSymbol = async (file: File) => {
    const dataUrl = await readAsDataUrl(file);
    const customSymbol: SafetySymbol = {
      id: `custom-${Date.now()}`,
      label: file.name.replace(/\.[^.]+$/, ""),
      category: "custom",
      color: "#06b6d4",
      shortCode: "C",
      imageSrc: dataUrl,
    };

    setCustomSymbols((prev) => {
      const next = [customSymbol, ...prev];
      localStorage.setItem(CUSTOM_SYMBOLS_KEY, JSON.stringify(next));
      return next;
    });
    toast.success("Özel sembol eklendi.");
  };

  const insertTriangle = () => {
    const canvas = canvasRef.current;
    if (!canvas || !FabricCtors.Triangle) return;
    const triangle = new FabricCtors.Triangle({
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
      width: 90,
      height: 90,
      fill: "rgba(59,130,246,0.16)",
      stroke: "#38bdf8",
      strokeWidth: 2,
      originX: "center",
      originY: "center",
    } as any);
    (triangle as any).denetronMeta = { kind: "shape", name: "Üçgen" };
    canvas.add(triangle);
    canvas.setActiveObject(triangle);
    canvas.requestRenderAll();
    updateLayersAndLegend();
    syncActiveFloorJson();
  };

  const insertWall = () => {
    const canvas = canvasRef.current;
    if (!canvas || !FabricCtors.Line) return;
    const wall = new FabricCtors.Line(
      [canvas.getWidth() / 2 - 140, canvas.getHeight() / 2, canvas.getWidth() / 2 + 140, canvas.getHeight() / 2],
      {
        stroke: "#334155",
        strokeWidth: 8,
      } as any,
    );
    (wall as any).denetronMeta = { kind: "structure", name: "Duvar" };
    canvas.add(wall);
    canvas.setActiveObject(wall);
    canvas.requestRenderAll();
    updateLayersAndLegend();
    syncActiveFloorJson();
  };

  const insertRoom = () => {
    const canvas = canvasRef.current;
    if (!canvas || !FabricCtors.Rect) return;
    const room = new FabricCtors.Rect({
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
      width: 280,
      height: 180,
      fill: "rgba(15,23,42,0.04)",
      stroke: "#0f172a",
      strokeWidth: 3,
      originX: "center",
      originY: "center",
    } as any);
    (room as any).denetronMeta = { kind: "structure", name: "Oda / Alan" };
    canvas.add(room);
    canvas.setActiveObject(room);
    canvas.requestRenderAll();
    updateLayersAndLegend();
    syncActiveFloorJson();
  };

  const insertDoor = () => {
    const canvas = canvasRef.current;
    if (!canvas || !FabricCtors.Line || !FabricCtors.Circle || !FabricCtors.Group) return;

    const pivotX = canvas.getWidth() / 2 - 24;
    const pivotY = canvas.getHeight() / 2;
    const doorLine = new FabricCtors.Line([pivotX, pivotY - 44, pivotX, pivotY + 44], {
      stroke: "#475569",
      strokeWidth: 4,
      selectable: false,
      evented: false,
    } as any);
    const swing = new FabricCtors.Circle({
      left: pivotX,
      top: pivotY,
      originX: "left",
      originY: "center",
      radius: 44,
      startAngle: 270,
      endAngle: 360,
      stroke: "#38bdf8",
      fill: "",
      strokeWidth: 2,
      selectable: false,
      evented: false,
    } as any);
    const doorLeaf = new FabricCtors.Line([pivotX, pivotY, pivotX + 44, pivotY - 44], {
      stroke: "#38bdf8",
      strokeWidth: 3,
      selectable: false,
      evented: false,
    } as any);
    const group = new FabricCtors.Group([doorLine, swing, doorLeaf], {
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
      originX: "center",
      originY: "center",
    } as any);
    (group as any).denetronMeta = { kind: "structure", name: "Kapı" };
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
    updateLayersAndLegend();
    syncActiveFloorJson();
  };

  const insertStairs = () => {
    const canvas = canvasRef.current;
    if (!canvas || !FabricCtors.Rect || !FabricCtors.Line || !FabricCtors.Group) return;

    const objects = [
      new FabricCtors.Rect({
        left: -56,
        top: -72,
        width: 112,
        height: 144,
        fill: "rgba(148,163,184,0.08)",
        stroke: "#64748b",
        strokeWidth: 2,
        originX: "center",
        originY: "center",
      } as any),
    ];

    for (let index = 0; index < 5; index += 1) {
      objects.push(
        new FabricCtors.Line([-46 + index * 20, -56, -46 + index * 20, 56], {
          stroke: "#0f172a",
          strokeWidth: 2,
          selectable: false,
          evented: false,
        } as any),
      );
    }

    const group = new FabricCtors.Group(objects as any[], {
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
      originX: "center",
      originY: "center",
    } as any);
    (group as any).denetronMeta = { kind: "structure", name: "Merdiven" };
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
    updateLayersAndLegend();
    syncActiveFloorJson();
  };

  const insertRouteArrow = () => {
    const canvas = canvasRef.current;
    if (!canvas || !FabricCtors.Line || !FabricCtors.Triangle || !FabricCtors.Group) return;

    const shaft = new FabricCtors.Line([-90, 0, 50, 0], {
      stroke: "#16a34a",
      strokeWidth: 6,
      selectable: false,
      evented: false,
    } as any);
    const head = new FabricCtors.Triangle({
      left: 70,
      top: 0,
      originX: "center",
      originY: "center",
      width: 24,
      height: 24,
      fill: "#16a34a",
      angle: 90,
      selectable: false,
      evented: false,
    } as any);
    const group = new FabricCtors.Group([shaft, head], {
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
      originX: "center",
      originY: "center",
    } as any);
    (group as any).denetronMeta = { kind: "structure", name: "Rota Oku" };
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
    updateLayersAndLegend();
    syncActiveFloorJson();
  };

  const toggleBackgroundLock = () => {
    const canvas = canvasRef.current;
    const backgroundObject = findBackgroundObject();
    if (!canvas || !backgroundObject) return;
    const nextLock = !backgroundObject.lockMovementX;
    backgroundObject.set({
      lockMovementX: nextLock,
      lockMovementY: nextLock,
      lockScalingX: nextLock,
      lockScalingY: nextLock,
      lockRotation: nextLock,
      selectable: !nextLock,
      evented: !nextLock,
    });
    canvas.requestRenderAll();
    setBackgroundLocked(nextLock);
    syncActiveFloorJson();
  };

  const handleToolChange = (tool: EditorTool) => {
    if (tool === "triangle") {
      insertTriangle();
      setActiveTool("select");
      return;
    }
    if (tool === "wall") {
      insertWall();
      setActiveTool("select");
      return;
    }
    if (tool === "door") {
      insertDoor();
      setActiveTool("select");
      return;
    }
    if (tool === "stairs") {
      insertStairs();
      setActiveTool("select");
      return;
    }
    if (tool === "room") {
      insertRoom();
      setActiveTool("select");
      return;
    }
    if (tool === "route") {
      insertRouteArrow();
      setActiveTool("select");
      return;
    }
    if (tool === "eraser") {
      deleteSelected();
      setActiveTool("select");
      return;
    }
    setActiveTool(tool);
  };

  const canvasTool = useMemo<CanvasTool>(() => {
    if (activeTool === "pen") return "polyline";
    if (activeTool === "select") return "select";
    if (activeTool === "line") return "line";
    if (activeTool === "arrow") return "arrow";
    if (activeTool === "text") return "text";
    if (activeTool === "rect") return "rect";
    if (activeTool === "circle") return "circle";
    return "select";
  }, [activeTool]);

  const selectedLayerId = (selectedObject as any)?.denetronMeta?.layerId || null;
  const selectedName =
    (selectedObject as any)?.denetronMeta?.name ||
    (selectedObject as any)?.denetronMeta?.symbolName ||
    "Seçili öğe yok";

  return (
    <>
      <div className="-mx-4 -my-4 min-h-[calc(100vh-3.8rem)] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_22%),linear-gradient(180deg,#020617_0%,#06132b_46%,#081a39_100%)] px-4 py-6 lg:-mx-6 lg:-my-6 lg:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <div className="overflow-hidden rounded-[30px] border border-cyan-500/20 bg-slate-950/70 shadow-[0_36px_100px_rgba(2,12,27,0.55)] backdrop-blur-xl">
            <div className="grid gap-0 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="border-b border-slate-800/80 p-6 xl:border-b-0 xl:border-r">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                  <BookOpenCheck className="h-4 w-4" />
                  Ön Kullanım Rehberi
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-50 lg:text-5xl">
                  Acil Durum Kroki Editörü
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 lg:text-base">
                  Kendi kat planınızı yükleyin veya editörde sıfırdan acil durum krokisi oluşturun.
                  Sol panelden sembolleri seçin, ortadaki beyaz çalışma alanına yerleştirin ve
                  profesyonel krokinizi PNG veya PDF olarak dışa aktarın.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center gap-3 text-slate-100">
                      <UploadCloud className="h-5 w-5 text-cyan-300" />
                      <p className="font-semibold">1. Kroki veya Kat Planını Yükle</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      PNG, JPG, JPEG veya SVG dosyanızı yükleyin. Görsel çalışma alanına yerleşir ve
                      üzerine yönlendirme, yangın ve acil durum sembollerini eklemeye başlayabilirsiniz.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center gap-3 text-slate-100">
                      <Layers3 className="h-5 w-5 text-cyan-300" />
                      <p className="font-semibold">2. Sembolleri ve Yapıları Yerleştir</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Acil çıkış, ilk yardım, yangın ekipmanı ve yönlendirme işaretlerini ekleyin;
                      duvar, kapı, merdiven ve alan şekilleriyle krokini profesyonel biçimde tamamlayın.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center gap-3 text-slate-100">
                      <Route className="h-5 w-5 text-cyan-300" />
                      <p className="font-semibold">3. Tahliye Yolunu Çiz</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Çizgi, ok, metin ve serbest rota araçlarıyla tahliye akışını netleştirin.
                      Grid ve snap seçenekleri hizalı çalışma sağlar.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center gap-3 text-slate-100">
                      <Save className="h-5 w-5 text-cyan-300" />
                      <p className="font-semibold">4. Kaydet, Yükle, Dışa Aktar</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Taslağınızı kaydedin, geçmiş krokileri geri yükleyin ve düzeni koruyarak PNG veya PDF çıktısı alın.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">Editörde neler var</p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex items-center gap-2 text-slate-100">
                        <PanelLeft className="h-4 w-4 text-cyan-300" />
                        <p className="font-semibold">Sol sembol paneli</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        Acil durum, yangın, emredici, uyarı, yasaklayıcı ve yönlendirme sembolleri kategorili biçimde hazır gelir.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex items-center gap-2 text-slate-100">
                        <Layers3 className="h-4 w-4 text-cyan-300" />
                        <p className="font-semibold">Beyaz canvas ve katman yönetimi</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        Ortada beyaz çizim alanı bulunur. Sağ panelden katman, lejant ve seçili öğe özelliklerini yönetebilirsiniz.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex items-center gap-2 text-slate-100">
                        <Download className="h-4 w-4 text-cyan-300" />
                        <p className="font-semibold">PNG ve PDF dışa aktarma</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        Düzenleyici ayrı bir tam ekran dialog olarak açılır; çıktı alırken toolbar ve panel değil sadece kroki alanı dışa aktarılır.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                    <p className="text-sm font-semibold text-cyan-200">Önerilen kullanım sırası</p>
                    <ol className="mt-3 space-y-2 text-sm text-slate-300">
                      <li>1. Kroki adını verin ve kat planını yükleyin.</li>
                      <li>2. Gerekli sembolleri ve yapısal öğeleri ekleyin.</li>
                      <li>3. Tahliye güzergahlarını ve açıklama metinlerini tamamlayın.</li>
                      <li>4. Katmanlar, lejant ve ölçeği gözden geçirin.</li>
                      <li>5. Taslağı kaydedin, ardından PNG veya PDF çıktısı alın.</li>
                    </ol>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Button
                      className="gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400 text-slate-950 hover:opacity-95"
                      onClick={() => setEditorOpen(true)}
                    >
                      <Maximize2 className="h-4 w-4" />
                      Editöre Geç
                    </Button>
                    <Button variant="outline" className="gap-2 rounded-2xl border-white/10 bg-white/[0.04]" onClick={() => navigate("/evacuation-editor/history")}>
                      <History className="h-4 w-4" />
                      Geçmiş Krokileri Gör
                    </Button>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Editör bu sayfanın içinde uzun bir alan olarak değil, ayrı bir tam ekran çalışma penceresi olarak açılır.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {editorOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Acil Durum Kroki Editörü"
          className="fixed inset-0 z-[9999] bg-slate-950"
        >
          <div className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#0f172a] text-white">

            <header className="h-14 shrink-0 border-b border-white/10 bg-slate-900 px-4 shadow-[0_14px_40px_rgba(2,8,23,0.35)]">
              <div className="flex h-full items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-500/12 text-cyan-200">
                    <Layers3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-50">{projectName || "Yeni Kroki"}</h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 rounded-xl border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
                    onClick={zoomReset}
                    aria-label="Yakınlığı sıfırla"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 rounded-xl border-emerald-400/25 bg-emerald-500/10 px-3 text-emerald-100 hover:bg-emerald-500/20"
                    onClick={handleExportPng}
                  >
                    <FileImage className="mr-2 h-4 w-4" />
                    PNG
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 rounded-xl border-rose-400/25 bg-rose-500/10 px-3 text-rose-100 hover:bg-rose-500/20"
                    onClick={handleExportPdf}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 rounded-xl border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/20"
                    onClick={() => {
                      syncActiveFloorJson();
                      setEditorOpen(false);
                    }}
                    aria-label="Kroki editörünü kapat"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </header>

            <div className="h-11 shrink-0 border-b border-white/10 bg-slate-900 px-3 py-2">
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                <Input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  className="h-8 w-[180px] shrink-0 rounded-xl border-white/10 bg-slate-950/70 text-xs text-slate-100 sm:w-[220px]"
                  placeholder="Kroki adı"
                />

                <Select value={activeFloor?.id || floors[0].id} onValueChange={(value) => void changeFloor(value)}>
                  <SelectTrigger className="h-8 w-[120px] shrink-0 rounded-xl border-white/10 bg-slate-950/70 text-xs text-slate-100 sm:w-[150px]">
                    <SelectValue placeholder="Kat seç" />
                  </SelectTrigger>
                  <SelectContent>
                    {floors.map((floor) => (
                      <SelectItem key={floor.id} value={floor.id}>
                        {floor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button size="sm" variant="outline" className="h-8 rounded-xl border-white/10 bg-white/[0.04] text-xs" onClick={addFloor}>
                  <Plus className="mr-2 h-4 w-4" />
                  Kat
                </Button>

                <div className="mx-1 h-8 w-px shrink-0 bg-white/10" />

                {toolButtons.map((tool) => (
                  <Button
                    key={tool.id}
                    size="sm"
                    variant={activeTool === tool.id ? "default" : "outline"}
                    className={`h-8 shrink-0 rounded-xl gap-1.5 px-2.5 text-xs ${
                      activeTool === tool.id
                        ? "bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400 text-slate-950 hover:opacity-95"
                        : "border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
                    }`}
                    onClick={() => handleToolChange(tool.id)}
                  >
                    <tool.icon className="h-4 w-4" />
                    {tool.label}
                  </Button>
                ))}

                <div className="mx-1 h-8 w-px shrink-0 bg-white/10" />

                <Button size="icon" variant="outline" className="h-8 w-8 shrink-0 rounded-xl border-white/10 bg-white/[0.04]" onClick={() => historyRef.current?.undo()}>
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8 shrink-0 rounded-xl border-white/10 bg-white/[0.04]" onClick={() => historyRef.current?.redo()}>
                  <Redo2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8 shrink-0 rounded-xl border-white/10 bg-white/[0.04]" onClick={() => void duplicateSelected()}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8 shrink-0 rounded-xl border-white/10 bg-white/[0.04]" onClick={groupSelection}>
                  <Layers3 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8 shrink-0 rounded-xl border-white/10 bg-white/[0.04]" onClick={ungroupSelection}>
                  <PanelLeft className="h-4 w-4" />
                </Button>

                <div className="mx-1 h-8 w-px shrink-0 bg-white/10" />

                <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-xl border-white/10 bg-white/[0.04] text-xs" onClick={zoomOut}>
                  <ZoomOut className="mr-2 h-4 w-4" />
                  -
                </Button>
                <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-xl border-white/10 bg-white/[0.04] text-xs" onClick={zoomReset}>
                  %{zoomPercent}
                </Button>
                <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-xl border-white/10 bg-white/[0.04] text-xs" onClick={zoomIn}>
                  <ZoomIn className="mr-2 h-4 w-4" />
                  +
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className={`h-8 shrink-0 rounded-xl text-xs ${showGrid ? "border-cyan-400/25 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-100"}`}
                  onClick={() => setShowGrid((prev) => !prev)}
                >
                  <Grid3X3 className="mr-2 h-4 w-4" />
                  Grid
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className={`h-8 shrink-0 rounded-xl text-xs ${backgroundLocked ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-white/[0.04] text-slate-100"}`}
                  onClick={toggleBackgroundLock}
                  disabled={!backgroundImage}
                >
                  {backgroundLocked ? <Lock className="mr-2 h-4 w-4" /> : <PanelLeft className="mr-2 h-4 w-4" />}
                  Arka Planı Kilitle
                </Button>

                <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-xl border-white/10 bg-white/[0.04] text-xs" onClick={saveDraft}>
                  <Save className="mr-2 h-4 w-4" />
                  Taslağı Kaydet
                </Button>
                <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-xl border-white/10 bg-white/[0.04] text-xs" onClick={() => void loadDraft()}>
                  <History className="mr-2 h-4 w-4" />
                  Taslağı Yükle
                </Button>
                <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-xl border-white/10 bg-white/[0.04] text-xs" onClick={saveProject}>
                  <Save className="mr-2 h-4 w-4" />
                  Kaydet
                </Button>
                <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-xl border-white/10 bg-white/[0.04] text-xs" onClick={clearCanvas}>
                  <Eraser className="mr-2 h-4 w-4" />
                  Temizle
                </Button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 overflow-hidden">
              <aside className="w-[180px] shrink-0 border-r border-white/10 bg-slate-900 p-3 overflow-y-auto sm:w-[220px]">
                <SymbolSidebar
                  symbols={filteredSymbols}
                  query={symbolQuery}
                  onQueryChange={setSymbolQuery}
                  onAddSymbol={(symbol) => void handleAddSymbol(symbol)}
                  onUploadCustomSymbol={(file) => void handleUploadCustomSymbol(file)}
                />
              </aside>

              <main className="relative min-w-0 flex-1 overflow-auto bg-[#0b1120]">
                <div className="mx-auto my-6 flex min-h-full items-start justify-center px-6">
                  <div className="flex min-h-0 w-full max-w-[1600px] flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-[#172033] px-4 py-3">
                      <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Çizim Alanı</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-100">Beyaz çalışma yüzeyi</h3>
                    </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Araç: {toolButtons.find((tool) => tool.id === activeTool)?.label || "Seç"}</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Seçili: {selectedName}</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Kat: {activeFloor?.name}</span>
                      </div>
                    </div>

                    <div className="relative flex min-h-0 flex-1 overflow-auto rounded-[28px] border border-white/10 bg-[#d7dee9] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] lg:p-4">
                      <div className="mx-auto my-2 flex min-h-full items-start justify-center">
                        <div className="relative rounded-[28px] border border-slate-300/70 bg-white p-2 shadow-[0_30px_80px_rgba(15,23,42,0.12)] ring-1 ring-black/20">
                          <CanvasWorkspace
                            activeTool={canvasTool}
                            onCanvasReady={handleCanvasReady}
                            onSelectionChange={setSelectedObject}
                            onObjectsChange={() => {
                              updateLayersAndLegend();
                              syncActiveFloorJson();
                              refreshBackgroundState();
                            }}
                            onToolConsumed={() => setActiveTool("select")}
                            onCanvasResize={handleCanvasResize}
                            onZoomChange={setZoomPercent}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </main>

              <aside className="hidden h-auto w-[300px] shrink-0 border-l border-white/10 bg-[#101827] p-4 xl:block">
                <div className="flex h-full min-h-0 flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className={`h-10 rounded-2xl border-white/10 ${showGrid ? "bg-cyan-500/10 text-cyan-100" : "bg-white/[0.04] text-slate-100"}`}
                      onClick={() => setShowGrid((prev) => !prev)}
                    >
                      <Grid3X3 className="mr-2 h-4 w-4" />
                      Grid
                    </Button>
                    <Button
                      variant="outline"
                      className={`h-10 rounded-2xl border-white/10 ${backgroundLocked ? "bg-emerald-500/10 text-emerald-100" : "bg-white/[0.04] text-slate-100"}`}
                      onClick={toggleBackgroundLock}
                      disabled={!backgroundImage}
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      Kilit
                    </Button>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-[#172033] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Seçili öğe</p>
                        <h3 className="mt-2 text-sm font-semibold text-slate-100">{selectedName}</h3>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-400">
                        {layers.length} katman
                      </span>
                    </div>
                  </div>

                  <div className="min-h-0 flex-[1.1]">
                    <Suspense fallback={<PanelLoadingCard message="Özellik paneli yükleniyor..." compact />}>
                      <PropertiesPanel
                        selectedObject={selectedObject}
                        onUpdateObject={handleUpdateObject}
                        onDeleteObject={deleteSelected}
                        onDuplicateObject={() => {
                          void duplicateSelected();
                        }}
                        onBringForward={() => {
                          const object = getActiveObject();
                          if (!object) return;
                          object.bringForward();
                          canvasRef.current?.requestRenderAll();
                          syncActiveFloorJson();
                        }}
                        onSendBackward={() => {
                          const object = getActiveObject();
                          if (!object) return;
                          object.sendBackwards();
                          canvasRef.current?.requestRenderAll();
                          syncActiveFloorJson();
                        }}
                        onUploadBackground={(file) => void applyUploadedBackground(file)}
                      />
                    </Suspense>
                  </div>

                  <div className="min-h-0 flex-[0.95]">
                    <Suspense fallback={<PanelLoadingCard message="Katman paneli yükleniyor..." compact />}>
                      <LayerPanel
                        layers={layers}
                        selectedLayerId={selectedLayerId}
                        onSelectLayer={selectLayer}
                        onToggleVisibility={toggleLayerVisibility}
                        onToggleLock={toggleLayerLock}
                        onMoveLayer={moveLayer}
                        onDeleteLayer={deleteLayer}
                      />
                    </Suspense>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-[#172033] p-3">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs font-semibold text-slate-200"
                      onClick={() => setLegendOpen((prev) => !prev)}
                    >
                      <span>Lejant</span>
                      <span>{legendOpen ? "Gizle" : "Göster"}</span>
                    </button>
                    {legendOpen ? (
                      <div className="mt-3 max-h-[200px] overflow-auto" id="evacuation-legend">
                        <Suspense fallback={<PanelLoadingCard message="Lejant yükleniyor..." compact />}>
                          <LegendPanel items={legendItems} />
                        </Suspense>
                      </div>
                    ) : null}
                  </div>
                </div>
              </aside>
            </div>

            <footer className="border-t border-white/10 bg-[#101a31] px-4 py-3 lg:px-6">
              <div className="flex flex-col gap-2 text-xs text-slate-300 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Ölçek: 1m = 20px</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    {canvasSize.width}×{canvasSize.height}px
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Yakınlık: %{zoomPercent}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Grid: {showGrid ? "Açık" : "Kapalı"}</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Grid Aralığı: {gridSpacing}px</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    Arka plan: {backgroundImage ? (backgroundLocked ? "Yüklü · Kilitli" : "Yüklü") : "Yok"}
                  </span>
                </div>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      <input
        ref={hiddenPlanUploadRef}
        type="file"
        accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/jpg,image/svg+xml,application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void applyUploadedBackground(file);
          }
          event.currentTarget.value = "";
        }}
      />
    </>
  );
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
