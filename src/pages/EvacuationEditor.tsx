import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { createPortal } from "react-dom";
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

const loadEvacuationExportService = () => import("@/components/evacuation-editor/ExportService");

const initialFloor: FloorState = {
  id: "floor-ground",
  name: "Zemin Kat",
  canvasJson: null,
};

const categoryLabels: Record<SafetySymbolCategory, string> = {
  custom: "Özel Sembollerim",
  emergency: "Acil Durum (E)",
  fire: "Yangin (F)",
  mandatory: "Emredici (M)",
  warning: "Uyari (W)",
  prohibition: "Yasaklayici (P)",
  direction: "Yönlendirme Oklari",
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
  { id: "door", label: "Kapi", icon: DoorOpen },
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
    label: "Acil Çikis",
    category: "emergency",
    color: "#16a34a",
    shortCode: "E1",
    svg: loadDefaultSvg("emergency-exit") || buildSymbolSvg("E1", "#16a34a"),
  },
  {
    id: "emergency-door",
    label: "Acil Çikis Kapisi",
    category: "emergency",
    color: "#15803d",
    shortCode: "E2",
    svg: loadDefaultSvg("emergency-door") || buildSymbolSvg("E2", "#15803d"),
  },
  {
    id: "first-aid",
    label: "Ilk Yardim",
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
  { id: "assembly-point", label: "Toplanma Noktasi", category: "emergency", color: "#1d4ed8", shortCode: "E5", svg: loadDefaultSvg("assembly-point") || buildSymbolSvg("E5", "#1d4ed8") },
  { id: "aed-device", label: "AED Cihazi", category: "emergency", color: "#0f766e", shortCode: "E6", svg: buildSymbolSvg("AED", "#0f766e") },
  { id: "eye-wash", label: "Göz Yikama", category: "emergency", color: "#0f766e", shortCode: "E7", svg: buildSymbolSvg("E7", "#0f766e") },
  { id: "emergency-shower", label: "Acil Dus", category: "emergency", color: "#0891b2", shortCode: "E8", svg: buildSymbolSvg("E8", "#0891b2") },
  { id: "stretcher", label: "Sedye", category: "emergency", color: "#0f766e", shortCode: "E9", svg: buildSymbolSvg("E9", "#0f766e") },
  { id: "evacuation-plan", label: "Tahliye Plani", category: "emergency", color: "#2563eb", shortCode: "EP", svg: buildSymbolSvg("EP", "#2563eb") },
  { id: "exit-down", label: "Çikis Asagi", category: "direction", color: "#16a34a", shortCode: "?", svg: buildSymbolSvg("?", "#16a34a") },
  { id: "exit-right", label: "Çikis Sag", category: "direction", color: "#16a34a", shortCode: "?", svg: loadDefaultSvg("evac-arrow") || buildSymbolSvg("?", "#16a34a") },
  { id: "exit-left", label: "Çikis Sol", category: "direction", color: "#16a34a", shortCode: "?", svg: buildSymbolSvg("?", "#16a34a") },
  { id: "fire-extinguisher", label: "Yangin Söndürücü", category: "fire", color: "#dc2626", shortCode: "F1", svg: loadDefaultSvg("fire-extinguisher") || buildSymbolSvg("F1", "#dc2626") },
  { id: "fire-hose", label: "Yangin Hortumu", category: "fire", color: "#b91c1c", shortCode: "F2", svg: loadDefaultSvg("fire-hose") || buildSymbolSvg("F2", "#b91c1c") },
  { id: "fire-stairs", label: "Yangin Merdiveni", category: "fire", color: "#991b1b", shortCode: "F3", svg: loadDefaultSvg("stairs") || buildSymbolSvg("F3", "#991b1b") },
  { id: "alarm-button", label: "Alarm Butonu", category: "fire", color: "#ef4444", shortCode: "F4", svg: loadDefaultSvg("alarm-button") || buildSymbolSvg("F4", "#ef4444") },
  { id: "fire-phone", label: "Yangin Telefonu", category: "fire", color: "#b91c1c", shortCode: "F5", svg: buildSymbolSvg("F5", "#b91c1c") },
  { id: "fire-door", label: "Yangin Kapisi", category: "fire", color: "#991b1b", shortCode: "F6", svg: buildSymbolSvg("F6", "#991b1b") },
  { id: "blanket", label: "Söndürme Battaniyesi", category: "fire", color: "#dc2626", shortCode: "F7", svg: buildSymbolSvg("F7", "#dc2626") },
  { id: "cabinet", label: "Hortum Dolabi", category: "fire", color: "#b91c1c", shortCode: "F8", svg: loadDefaultSvg("fire-cabinet") || buildSymbolSvg("F8", "#b91c1c") },
  { id: "mandatory-general", label: "Genel Zorunluluk", category: "mandatory", color: "#2563eb", shortCode: "M1", svg: buildSymbolSvg("M1", "#2563eb") },
  { id: "read-instruction", label: "Talimati Oku", category: "mandatory", color: "#1d4ed8", shortCode: "M2", svg: buildSymbolSvg("M2", "#1d4ed8") },
  { id: "gloves", label: "Eldiven", category: "mandatory", color: "#2563eb", shortCode: "M3", svg: buildSymbolSvg("M3", "#2563eb") },
  { id: "helmet", label: "Baret Kullan", category: "mandatory", color: "#2563eb", shortCode: "M4", svg: buildSymbolSvg("M4", "#2563eb") },
  { id: "mask", label: "Maske Kullan", category: "mandatory", color: "#2563eb", shortCode: "M5", svg: buildSymbolSvg("M5", "#2563eb") },
  { id: "safety-belt", label: "Emniyet Kemeri", category: "mandatory", color: "#1d4ed8", shortCode: "M6", svg: buildSymbolSvg("M6", "#1d4ed8") },
  { id: "warning-general", label: "Genel Tehlike", category: "warning", color: "#f59e0b", shortCode: "W1", svg: buildSymbolSvg("W1", "#f59e0b", "#111827") },
  { id: "radioactive", label: "Radyoaktif", category: "warning", color: "#f59e0b", shortCode: "W2", svg: buildSymbolSvg("W2", "#f59e0b", "#111827") },
  { id: "laser", label: "Lazer Isini", category: "warning", color: "#f59e0b", shortCode: "W3", svg: buildSymbolSvg("W3", "#f59e0b", "#111827") },
  { id: "electric", label: "Elektrik Tehlikesi", category: "warning", color: "#eab308", shortCode: "W4", svg: buildSymbolSvg("W4", "#eab308", "#111827") },
  { id: "hot-surface", label: "Sicak Yüzey", category: "warning", color: "#f59e0b", shortCode: "W5", svg: buildSymbolSvg("W5", "#f59e0b", "#111827") },
  { id: "panel", label: "Elektrik Panosu", category: "warning", color: "#f59e0b", shortCode: "W6", svg: buildSymbolSvg("W6", "#f59e0b", "#111827") },
  { id: "prohibition-general", label: "Genel Yasak", category: "prohibition", color: "#dc2626", shortCode: "P1", svg: buildSymbolSvg("P1", "#dc2626") },
  { id: "no-smoking", label: "Sigara Içilmez", category: "prohibition", color: "#dc2626", shortCode: "P2", svg: buildSymbolSvg("P2", "#dc2626") },
  { id: "no-fire", label: "Atesle Yaklasma", category: "prohibition", color: "#dc2626", shortCode: "P3", svg: buildSymbolSvg("P3", "#dc2626") },
  { id: "no-entry", label: "Giris Yasaktir", category: "prohibition", color: "#b91c1c", shortCode: "P4", svg: buildSymbolSvg("P4", "#b91c1c") },
  { id: "do-not-touch", label: "Dokunma", category: "prohibition", color: "#b91c1c", shortCode: "P5", svg: buildSymbolSvg("P5", "#b91c1c") },
  { id: "safe-way-1", label: "Güvenli Yol Oku 1", category: "direction", color: "#16a34a", shortCode: "?", svg: buildSymbolSvg("?", "#16a34a") },
  { id: "safe-way-2", label: "Güvenli Yol Oku 2", category: "direction", color: "#16a34a", shortCode: "?", svg: buildSymbolSvg("?", "#16a34a") },
  { id: "fire-arrow-1", label: "Yangin Ekipman Oku 1", category: "direction", color: "#dc2626", shortCode: "?", svg: buildSymbolSvg("?", "#dc2626") },
  { id: "fire-arrow-2", label: "Yangin Ekipman Oku 2", category: "direction", color: "#dc2626", shortCode: "?", svg: buildSymbolSvg("?", "#dc2626") },
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
  disabled = false,
}: {
  symbol: SafetySymbol;
  onAdd: (symbol: SafetySymbol) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onAdd(symbol)}
      title={symbol.label}
      className={[
        "flex h-[58px] flex-col items-center justify-center rounded-md bg-[#2a3a52] p-1 text-center transition",
        disabled ? "cursor-not-allowed opacity-50" : "hover:bg-[#344963]",
      ].join(" ")}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-white p-0.5">
        {symbol.imageSrc ? (
          <img src={symbol.imageSrc} alt={symbol.label} className="h-full w-full object-contain" />
        ) : (
          <div
            className="h-full w-full"
            dangerouslySetInnerHTML={{ __html: symbol.svg || buildSymbolSvg(symbol.shortCode, symbol.color) }}
          />
        )}
      </div>
      <span className="mt-1 line-clamp-1 max-w-full text-[9px] font-semibold leading-tight text-white">
        {symbol.label}
      </span>
    </button>
  );
}

function SymbolSidebar({
  symbols,
  query,
  onQueryChange,
  onAddSymbol,
  onUploadCustomSymbol,
  disabled = false,
}: {
  symbols: SafetySymbol[];
  query: string;
  onQueryChange: (value: string) => void;
  onAddSymbol: (symbol: SafetySymbol) => void;
  onUploadCustomSymbol: (file: File) => void;
  disabled?: boolean;
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
    <div className="flex h-full min-h-0 flex-col bg-[#172033] p-2 text-white">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-white">Semboller</h2>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-md text-violet-200 hover:bg-white/10 hover:text-white"
          onClick={() => inputRef.current?.click()}
          title="Özel sembol ekle"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Ara..."
          className="h-7 rounded-md border-white/10 bg-[#111c2f] pl-7 text-xs text-slate-100 placeholder:text-slate-500"
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

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="space-y-4">
          {visibleCategories.length === 0 ? (
            <div className="rounded-md border border-dashed border-white/10 bg-slate-950/40 p-4 text-center text-xs text-slate-400">
              Sembol bulunamadi.
            </div>
          ) : null}

          {visibleCategories.map((category) => {
            const items = groupedSymbols.get(category) || [];
            if (!items.length) return null;
            return (
              <section key={category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-bold text-emerald-300">
                    {categoryLabels[category]}
                  </h3>
                  <span className="text-[10px] font-medium text-slate-500">
                    {items.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {items.map((symbol) => (
                    <SymbolCard key={symbol.id} symbol={symbol} onAdd={onAddSymbol} disabled={disabled} />
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
  const [mounted, setMounted] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorContentReady, setEditorContentReady] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [pendingBackgroundFile, setPendingBackgroundFile] = useState<File | null>(null);
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
        toast.success("Kroki geçmisten yüklendi.");
      } catch {
        toast.error("Kayitli kroki yüklenemedi.");
      }
    },
    [restoreFloor],
  );

  const handleCanvasReady = useCallback(
    (canvas: any) => {
      console.log("✅ Canvas ready", canvas);
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
      setCanvasReady(true);
      console.log("✅ canvasReady true", canvas.getWidth(), canvas.getHeight());

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
  setMounted(true);
}, []);

  useEffect(() => {
    const warmupHandle = window.setTimeout(() => {
      void loadEvacuationExportService();
    }, 250);

    return () => window.clearTimeout(warmupHandle);
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

  const previousBodyOverflow = document.body.style.overflow;
  const previousHtmlOverflow = document.documentElement.style.overflow;

  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";

  const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        syncActiveFloorJson();
        setEditorContentReady(false);
        setCanvasReady(false);
        canvasRef.current = null;
        setEditorOpen(false);
      }
  };

  window.addEventListener("keydown", handleEscape);

  return () => {
    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousHtmlOverflow;
    window.removeEventListener("keydown", handleEscape);
  };
}, [editorOpen, syncActiveFloorJson]);

  const openEditorDialog = useCallback(() => {
    setCanvasReady(false);
    setEditorOpen(true);
    setEditorContentReady(false);

    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        startTransition(() => {
          setEditorContentReady(true);
        });
      }, 50);
    });
  }, []);

  const closeEditorDialog = useCallback(() => {
    syncActiveFloorJson();
    setEditorContentReady(false);
    setCanvasReady(false);
    canvasRef.current = null;
    setEditorOpen(false);
  }, [syncActiveFloorJson]);

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
    toast.success("Kroki kaydedildi. Geçmis ekranindan tekrar yükleyebilirsiniz.");
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
      toast.error("Yüklenecek taslak bulunamadi.");
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
    console.log("Symbol clicked", symbol.label, "canvas:", canvas);
    if (!canvas) {
      toast.error("Çizim alani henüz hazir degil. Lütfen birkaç saniye sonra tekrar deneyin.");
      return;
    }

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
        image.setCoords();
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
        (grouped as any).setCoords?.();
      }

      canvas.requestRenderAll();
      updateLayersAndLegend();
      syncActiveFloorJson();
    } catch (error) {
      console.error("Sembol ekleme hatasi:", error);
      toast.error("Sembol eklenemedi.");
    }
  };

  const applyUploadedBackground = async (file: File) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setPendingBackgroundFile(file);
      toast.info("Çizim alani hazirlaniyor. Kroki hazir olunca yüklenecek.");
      return;
    }

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("PDF yükleme su an desteklenmiyor. Lütfen PNG, JPG veya SVG kullanin.");
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
    (image as any).denetronMeta = { kind: "background", name: "Kat Plani" };

    canvas.add(image as any);
    image.sendToBack();
    image.setCoords();
    GridSystem.apply(canvas, showGrid, gridSpacing);
    canvas.requestRenderAll();
    setBackgroundImage(dataUrl);
    setBackgroundLocked(false);
    updateLayersAndLegend();
    syncActiveFloorJson();
    toast.success("Kroki görseli çalisma alanina eklendi.");
  };

  useEffect(() => {
    if (!canvasReady || !pendingBackgroundFile) return;

    const file = pendingBackgroundFile;
    setPendingBackgroundFile(null);
    void applyUploadedBackground(file);
  }, [canvasReady, pendingBackgroundFile]);

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
    (group as any).denetronMeta = { kind: "structure", name: "Kapi" };
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
    "Seçili öge yok";

  return (
    <>
      <div className="-mx-4 -my-4 min-h-[calc(100vh-3.8rem)] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_22%),linear-gradient(180deg,#020617_0%,#06132b_46%,#081a39_100%)] px-4 py-6 lg:-mx-6 lg:-my-6 lg:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <div className="overflow-hidden rounded-[30px] border border-cyan-500/20 bg-slate-950/70 shadow-[0_36px_100px_rgba(2,12,27,0.55)] backdrop-blur-xl">
            <div className="grid gap-0 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="border-b border-slate-800/80 p-6 xl:border-b-0 xl:border-r">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                  <BookOpenCheck className="h-4 w-4" />
                  Ön Kullanim Rehberi
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-50 lg:text-5xl">
                  Acil Durum Kroki Editörü
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 lg:text-base">
                  Kendi kat planinizi yükleyin veya editörde sifirdan acil durum krokisi olusturun.
                  Sol panelden sembolleri seçin, ortadaki beyaz çalisma alanina yerlestirin ve
                  profesyonel krokinizi PNG veya PDF olarak disa aktarin.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center gap-3 text-slate-100">
                      <UploadCloud className="h-5 w-5 text-cyan-300" />
                      <p className="font-semibold">1. Kroki veya Kat Planini Yükle</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      PNG, JPG, JPEG veya SVG dosyanizi yükleyin. Görsel çalisma alanina yerlesir ve
                      üzerine yönlendirme, yangin ve acil durum sembollerini eklemeye baslayabilirsiniz.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center gap-3 text-slate-100">
                      <Layers3 className="h-5 w-5 text-cyan-300" />
                      <p className="font-semibold">2. Sembolleri ve Yapilari Yerlestir</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Acil çikis, ilk yardim, yangin ekipmani ve yönlendirme isaretlerini ekleyin;
                      duvar, kapi, merdiven ve alan sekilleriyle krokini profesyonel biçimde tamamlayin.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center gap-3 text-slate-100">
                      <Route className="h-5 w-5 text-cyan-300" />
                      <p className="font-semibold">3. Tahliye Yolunu Çiz</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Çizgi, ok, metin ve serbest rota araçlariyla tahliye akisini netlestirin.
                      Grid ve snap seçenekleri hizali çalisma saglar.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center gap-3 text-slate-100">
                      <Save className="h-5 w-5 text-cyan-300" />
                      <p className="font-semibold">4. Kaydet, Yükle, Disa Aktar</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Taslaginizi kaydedin, geçmis krokileri geri yükleyin ve düzeni koruyarak PNG veya PDF çiktisi alin.
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
                        Acil durum, yangin, emredici, uyari, yasaklayici ve yönlendirme sembolleri kategorili biçimde hazir gelir.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex items-center gap-2 text-slate-100">
                        <Layers3 className="h-4 w-4 text-cyan-300" />
                        <p className="font-semibold">Beyaz canvas ve katman yönetimi</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        Ortada beyaz çizim alani bulunur. Sag panelden katman, lejant ve seçili öge özelliklerini yönetebilirsiniz.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex items-center gap-2 text-slate-100">
                        <Download className="h-4 w-4 text-cyan-300" />
                        <p className="font-semibold">PNG ve PDF disa aktarma</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        Düzenleyici ayri bir tam ekran dialog olarak açilir; çikti alirken toolbar ve panel degil sadece kroki alani disa aktarilir.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                    <p className="text-sm font-semibold text-cyan-200">Önerilen kullanim sirasi</p>
                    <ol className="mt-3 space-y-2 text-sm text-slate-300">
                      <li>1. Kroki adini verin ve kat planini yükleyin.</li>
                      <li>2. Gerekli sembolleri ve yapisal ögeleri ekleyin.</li>
                      <li>3. Tahliye güzergahlarini ve açiklama metinlerini tamamlayin.</li>
                      <li>4. Araç çubugundan grid, yakinlik ve çikti ayarlarini kontrol edin.</li>
                      <li>5. Taslagi kaydedin, ardindan PNG veya PDF çiktisi alin.</li>
                    </ol>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Button
                      className="gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400 text-slate-950 hover:opacity-95"
                      onClick={openEditorDialog}
                    >
                      <Maximize2 className="h-4 w-4" />
                      Editöre Geç
                    </Button>
                    <Button variant="outline" className="gap-2 rounded-2xl border-white/10 bg-white/[0.04]" onClick={() => navigate("/evacuation-editor/history")}>
                      <History className="h-4 w-4" />
                      Geçmis Krokileri Gör
                    </Button>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Editör bu sayfanin içinde uzun bir alan olarak degil, ayri bir tam ekran çalisma penceresi olarak açilir.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {mounted && editorOpen
  ? createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Acil Durum Kroki Editörü"
        className="fixed inset-0 z-[2147483647] isolate h-[100dvh] w-screen overflow-hidden bg-[#0f172a] text-white"
      >
        <div className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#0f172a] text-white">
          <header className="h-14 shrink-0 border-b border-white/10 bg-[#1b293d] px-4 shadow-[0_14px_40px_rgba(2,8,23,0.35)]">
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
                  aria-label="Yakinligi sifirla"
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
                  onClick={closeEditorDialog}
                  aria-label="Kroki editörünü kapat"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          <div className="h-10 shrink-0 border-b border-white/10 bg-[#111c2f] px-3 py-1.5">
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 rounded-md text-emerald-200 hover:bg-emerald-500/15 hover:text-emerald-100"
                onClick={() => hiddenPlanUploadRef.current?.click()}
                title="Kroki / Kat Plani Yükle"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 rounded-md text-cyan-200 hover:bg-cyan-500/15 hover:text-cyan-100"
                onClick={saveProject}
                title="Kaydet"
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 rounded-md text-violet-200 hover:bg-violet-500/15 hover:text-violet-100"
                onClick={saveDraft}
                title="Taslagi Kaydet"
              >
                <Layers3 className="h-4 w-4" />
              </Button>

              <Input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                className="h-8 w-[150px] shrink-0 rounded-md border-white/10 bg-slate-950/70 text-xs text-slate-100 sm:w-[190px]"
                placeholder="Kroki adi"
              />

              <Select value={activeFloor?.id || floors[0].id} onValueChange={(value) => void changeFloor(value)}>
                <SelectTrigger className="h-8 w-[110px] shrink-0 rounded-md border-white/10 bg-slate-950/70 text-xs text-slate-100 sm:w-[140px]">
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

              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 rounded-md text-slate-300 hover:bg-white/10 hover:text-white" onClick={addFloor} title="Kat ekle">
                <Plus className="h-4 w-4" />
              </Button>

              <div className="mx-1 h-8 w-px shrink-0 bg-white/10" />

              {toolButtons.map((tool) => (
                <Button
                  key={tool.id}
                  size="sm"
                  variant={activeTool === tool.id ? "default" : "outline"}
                  title={tool.label}
                  className={`h-8 shrink-0 gap-1.5 rounded-md px-2 text-xs ${
                    activeTool === tool.id
                      ? "bg-violet-500 text-white hover:bg-violet-500"
                      : "border-transparent bg-transparent text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                  onClick={() => handleToolChange(tool.id)}
                >
                  <tool.icon className="h-4 w-4" />
                  <span className="hidden xl:inline">{tool.label}</span>
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
                className={`h-8 shrink-0 rounded-xl text-xs ${
                  showGrid ? "border-cyan-400/25 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-100"
                }`}
                onClick={() => setShowGrid((prev) => !prev)}
              >
                <Grid3X3 className="mr-2 h-4 w-4" />
                Grid
              </Button>

              <Button
                size="sm"
                variant="outline"
                className={`h-8 shrink-0 rounded-xl text-xs ${
                  backgroundLocked ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-white/[0.04] text-slate-100"
                }`}
                onClick={toggleBackgroundLock}
                disabled={!backgroundImage}
              >
                {backgroundLocked ? <Lock className="mr-2 h-4 w-4" /> : <PanelLeft className="mr-2 h-4 w-4" />}
                Arka Plani Kilitle
              </Button>

              <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-xl border-white/10 bg-white/[0.04] text-xs" onClick={() => void loadDraft()}>
                <History className="mr-2 h-4 w-4" />
                Taslagi Yükle
              </Button>

              <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-xl border-white/10 bg-white/[0.04] text-xs" onClick={clearCanvas}>
                <Eraser className="mr-2 h-4 w-4" />
                Temizle
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden bg-[#0b1120]">
            <aside className="w-[184px] shrink-0 overflow-y-auto border-r border-white/10 bg-[#172033]">
              <SymbolSidebar
                symbols={filteredSymbols}
                query={symbolQuery}
                onQueryChange={setSymbolQuery}
                onAddSymbol={(symbol) => void handleAddSymbol(symbol)}
                onUploadCustomSymbol={(file) => void handleUploadCustomSymbol(file)}
                disabled={!canvasReady}
              />
            </aside>

            <main className="relative min-w-0 flex-1 overflow-auto bg-[#0b1120]">
              <div className="relative flex min-h-full min-w-max items-start justify-start px-5 py-4">
                <div className="relative rounded-lg bg-white shadow-[0_18px_70px_rgba(0,0,0,0.35)]">
                  {editorContentReady ? (
                    <CanvasWorkspace
                      key={activeFloorId}
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
                  ) : (
                    <div
                      className="flex items-center justify-center bg-white"
                      style={{ width: canvasSize.width, height: canvasSize.height }}
                    >
                      <PanelLoadingCard message="Editör hazirlaniyor..." compact />
                    </div>
                  )}
                </div>
              </div>
            </main>
          </div>

          <footer className="h-9 shrink-0 border-t border-white/10 bg-[#172033] px-3 text-[11px] text-slate-300">
            <div className="flex h-full items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span>Ölçek: 1m = 20px</span>
                <span>{canvasSize.width}×{canvasSize.height}px</span>
                <span className="hidden sm:inline">Grid: {showGrid ? "Açik" : "Kapali"}</span>
                <span className="hidden md:inline">Canvas: {canvasReady ? "Hazir" : "Hazirlaniyor"}</span>
                <span className="hidden lg:inline">
                  Arka plan: {backgroundImage ? (backgroundLocked ? "Yüklü · Kilitli" : "Yüklü") : "Yok"}
                </span>
              </div>
              <span className="shrink-0">Yakinlik: %{zoomPercent}</span>
            </div>
          </footer>
        </div>
      </div>,
      document.body
    )
  : null}
      <input
        ref={hiddenPlanUploadRef}
        type="file"
        accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/jpg,image/svg+xml,application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            if (!canvasRef.current) {
              setPendingBackgroundFile(file);
              toast.info("Çizim alani hazirlaniyor. Kroki hazir olunca yüklenecek.");
            } else {
              void applyUploadedBackground(file);
            }
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
