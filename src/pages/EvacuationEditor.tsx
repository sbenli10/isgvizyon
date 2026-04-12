import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { BookOpenCheck, History, Layers3, Loader2, Route, Save, Sparkles, UploadCloud } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  createImageFromURLCompat,
  groupSVGElementsCompat,
  loadSVGFromStringCompat,
  Fabric,
  FabricCtors,
} from "@/components/evacuation-editor/FabricCompat";

import { CanvasWorkspace } from "@/components/evacuation-editor/CanvasWorkspace";
import { SymbolLibrary, type EditorSymbol } from "@/components/evacuation-editor/SymbolLibrary";
import { EditorToolbar, type ToolMode } from "@/components/evacuation-editor/EditorToolbar";
import { PropertiesPanel } from "@/components/evacuation-editor/PropertiesPanel";
import { LegendPanel, type LegendEntry } from "@/components/evacuation-editor/LegendPanel";
import { LayerPanel, type LayerItem } from "@/components/evacuation-editor/LayerPanel";
import { HistoryManager } from "@/components/evacuation-editor/HistoryManager";
import { GridSystem } from "@/components/evacuation-editor/GridSystem";
import { SnapSystem } from "@/components/evacuation-editor/SnapSystem";
import { ExportService } from "@/components/evacuation-editor/ExportService";
import { generateEvacuationPlan, improveEvacuationPlan, type AIEvacuationPlan } from "@/lib/aiPlanGenerator";
import { generateEvacuationImage } from "@/lib/aiEvacuationImageGenerator";
import { importAIPlan, validateAIPlan } from "@/lib/canvasAIImporter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

const STORAGE_KEY = "evacuation-editor-projects";
const LOAD_KEY = "evacuation-editor-load-project";

const initialFloor: FloorState = {
  id: "floor-ground",
  name: "Zemin Kat",
  canvasJson: null,
};

export default function EvacuationEditor() {
  const navigate = useNavigate();
  const canvasRef = useRef<any | null>(null);
  const historyRef = useRef<HistoryManager | null>(null);
  const snapRef = useRef<SnapSystem | null>(null);
  const gridConfigRef = useRef({ enabled: true, spacing: 20 });

  const [projectName, setProjectName] = useState("Acil Durum Kroki Projesi");
  const [activeTool, setActiveTool] = useState<ToolMode>("select");
  const [selectedObject, setSelectedObject] = useState<any | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(true);

  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiImproveDialogOpen, setAiImproveDialogOpen] = useState(false);
  const [aiImprovePrompt, setAiImprovePrompt] = useState("");
  const [aiImproveLoading, setAiImproveLoading] = useState(false);
  const [aiImageDialogOpen, setAiImageDialogOpen] = useState(false);
  const [aiImagePrompt, setAiImagePrompt] = useState("");
  const [aiImageLoading, setAiImageLoading] = useState(false);
  const [aiImageDataUrl, setAiImageDataUrl] = useState<string | null>(null);

  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [legendItems, setLegendItems] = useState<LegendEntry[]>([]);

  const [gridEnabled, setGridEnabled] = useState(true);
  const [gridSnap, setGridSnap] = useState(true);
  const [snapToObjects, setSnapToObjects] = useState(true);
  const [snapToCenter, setSnapToCenter] = useState(true);
  const [gridSpacing, setGridSpacing] = useState(20);

  const [floors, setFloors] = useState<FloorState[]>([initialFloor]);
  const [activeFloorId, setActiveFloorId] = useState(initialFloor.id);

  const activeFloor = useMemo(() => floors.find((f) => f.id === activeFloorId) ?? floors[0], [floors, activeFloorId]);

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
      const symbolId = (ref as any)?.denetronMeta?.symbolId;
      const symbolName = (ref as any)?.denetronMeta?.symbolName;
      const legendEmoji = (ref as any)?.denetronMeta?.legendEmoji;
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

  const buildCanvasJSON = useCallback((canvas: any) => {
    const json = canvas.toJSON(["denetronMeta", "symbolId", "symbolName", "legendEmoji", "name"] as any) as any;
    if (Array.isArray(json?.objects)) {
      json.objects = json.objects.filter((obj: any) => obj?.denetronMeta?.kind !== "grid");
    }
    return json;
  }, []);

  const syncActiveFloorJson = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const serialized = JSON.stringify(buildCanvasJSON(canvas));
    setFloors((prev) => prev.map((floor) => (floor.id === activeFloorId ? { ...floor, canvasJson: serialized } : floor)));
  }, [activeFloorId, buildCanvasJSON]);

  const restoreFloor = useCallback(
    async (floor: FloorState | undefined) => {
      const canvas = canvasRef.current;
      if (!canvas || !floor) return;

      canvas.clear();
      canvas.set("backgroundColor", "#0b1220");

      if (floor.canvasJson) {
        await canvas.loadFromJSON(floor.canvasJson);
      }

      GridSystem.apply(canvas, gridEnabled, gridSpacing);
      canvas.requestRenderAll();
      historyRef.current?.pushSnapshot();
      updateLayersAndLegend();
    },
    [gridEnabled, gridSpacing, updateLayersAndLegend]
  );

  const changeFloor = useCallback(
    async (floorId: string) => {
      if (floorId === activeFloorId) return;
      syncActiveFloorJson();
      setActiveFloorId(floorId);
      const floor = floors.find((item) => item.id === floorId);
      await restoreFloor(floor);
    },
    [activeFloorId, floors, restoreFloor, syncActiveFloorJson]
  );

  const loadSavedProject = useCallback(
    async (project: SavedProject) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        const parsed = JSON.parse(project.canvas_json);
        const incomingFloors = Array.isArray(parsed?.floors) ? parsed.floors : [initialFloor];
        const incomingActiveFloorId = parsed?.activeFloorId || incomingFloors[0]?.id || initialFloor.id;

        setProjectName(project.project_name || "Acil Durum Kroki Projesi");
        setFloors(incomingFloors);
        setActiveFloorId(incomingActiveFloorId);

        const floorToLoad = incomingFloors.find((f: FloorState) => f.id === incomingActiveFloorId) || incomingFloors[0];
        await restoreFloor(floorToLoad);
        toast.success("Kroki geçmişten yüklendi.");
      } catch {
        toast.error("Kayıtlı kroki yüklenemedi.");
      }
    },
    [restoreFloor]
  );

  const handleCanvasReady = useCallback(
    (canvas: any) => {
      canvasRef.current = canvas;
      historyRef.current?.destroy();
      historyRef.current = new HistoryManager(canvas);

      snapRef.current?.destroy();
      snapRef.current = new SnapSystem(canvas, {
        gridEnabled: gridSnap,
        gridSpacing,
        snapToObjects,
        snapToCenter,
      });

      GridSystem.apply(canvas, gridEnabled, gridSpacing);

      const pendingId = localStorage.getItem(LOAD_KEY);
      if (!pendingId) return;
      localStorage.removeItem(LOAD_KEY);
      const projects: SavedProject[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const pending = projects.find((item) => item.id === pendingId);
      if (pending) {
        loadSavedProject(pending);
      }
    },
    [gridEnabled, gridSpacing, gridSnap, loadSavedProject, snapToCenter, snapToObjects]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    GridSystem.apply(canvas, gridEnabled, gridSpacing);
    snapRef.current?.updateOptions({
      enabled: gridSnap || snapToObjects || snapToCenter,
      gridEnabled: gridSnap,
      gridSpacing,
      snapToObjects,
      snapToCenter,
    });
  }, [gridEnabled, gridSpacing, gridSnap, snapToObjects, snapToCenter]);

  useEffect(() => {
    gridConfigRef.current = { enabled: gridEnabled, spacing: gridSpacing };
  }, [gridEnabled, gridSpacing]);

  const handleCanvasResize = useCallback((canvas: any) => {
    GridSystem.apply(canvas, gridConfigRef.current.enabled, gridConfigRef.current.spacing);
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
  const buildAIPlanFromCanvas = useCallback((canvas: any): AIEvacuationPlan => {
    const plan: AIEvacuationPlan = {
      rooms: [],
      exits: [],
      extinguishers: [],
      routes: [],
    };

    const objects = canvas.getObjects().filter((obj: any) => obj?.denetronMeta?.kind !== "grid");

    objects.forEach((obj: any, index: number) => {
      const meta = obj?.denetronMeta || {};
      const kind = String(meta.kind || "").toLowerCase();
      const symbolId = String(meta.symbolId || "").toLowerCase();
      const label = String(meta.name || meta.symbolName || "").toLowerCase();

      if (obj.type === "rect" || kind === "room") {
        const width = Number(obj.getScaledWidth?.() ?? obj.width ?? 0);
        const height = Number(obj.getScaledHeight?.() ?? obj.height ?? 0);
        plan.rooms.push({
          id: `room-${index}`,
          name: meta.name || "Oda",
          x: Number(obj.left || 0),
          y: Number(obj.top || 0),
          width,
          height,
        });
        return;
      }

      if (symbolId.includes("exit") || kind.includes("exit") || label.includes("cikis")) {
        plan.exits.push({
          id: `exit-${index}`,
          name: meta.symbolName || meta.name || "Acil Cikis",
          x: Number(obj.left || 0),
          y: Number(obj.top || 0),
        });
        return;
      }

      if (symbolId.includes("extinguisher") || label.includes("sondur")) {
        plan.extinguishers.push({
          id: `ext-${index}`,
          name: meta.symbolName || meta.name || "Yangin Sondurucu",
          x: Number(obj.left || 0),
          y: Number(obj.top || 0),
        });
      }
    });

    return plan;
  }, []);

  const handleGeneratePlan = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      toast.error("Canvas hazir degil.");
      return;
    }

    if (!aiPrompt.trim()) {
      toast.error("Lutfen bina aciklamasi girin.");
      return;
    }

    try {
      setAiLoading(true);
      const plan = await generateEvacuationPlan(aiPrompt.trim());
      validateAIPlan(plan);

      canvas.clear();
      canvas.set("backgroundColor", "#0b1220");

      await importAIPlan(canvas, plan);
      GridSystem.apply(canvas, gridEnabled, gridSpacing);
      canvas.requestRenderAll();

      historyRef.current?.pushSnapshot();
      updateLayersAndLegend();
      syncActiveFloorJson();

      setAiDialogOpen(false);
      setAiPrompt("");
      toast.success("AI tahliye krokisi olusturuldu.");
    } catch (error: any) {
      const message = error?.message || "AI plan olusturulamadi.";
      toast.error(message);
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, gridEnabled, gridSpacing, syncActiveFloorJson, updateLayersAndLegend]);
  const handleImprovePlan = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      toast.error("Canvas hazir degil.");
      return;
    }

    if (!aiImprovePrompt.trim()) {
      toast.error("Lutfen iyilestirme talebinizi girin.");
      return;
    }

    const currentPlan = buildAIPlanFromCanvas(canvas);
    if (currentPlan.rooms.length === 0 && currentPlan.exits.length === 0 && currentPlan.extinguishers.length === 0) {
      toast.error("Iyilestirme icin once krokiye plan veya semboller ekleyin.");
      return;
    }

    try {
      setAiImproveLoading(true);
      const improvedPlan = await improveEvacuationPlan(currentPlan, aiImprovePrompt.trim());
      validateAIPlan(improvedPlan);

      canvas.clear();
      canvas.set("backgroundColor", "#0b1220");

      await importAIPlan(canvas, improvedPlan);
      GridSystem.apply(canvas, gridEnabled, gridSpacing);
      canvas.requestRenderAll();

      historyRef.current?.pushSnapshot();
      updateLayersAndLegend();
      syncActiveFloorJson();

      setAiImproveDialogOpen(false);
      setAiImprovePrompt("");
      toast.success("AI krokiyi basariyla iyilestirdi.");
    } catch (error: any) {
      const message = error?.message || "AI iyilestirme tamamlanamadi.";
      toast.error(message);
    } finally {
      setAiImproveLoading(false);
    }
  }, [aiImprovePrompt, buildAIPlanFromCanvas, gridEnabled, gridSpacing, syncActiveFloorJson, updateLayersAndLegend]);

  const applyBackgroundFromDataUrl = useCallback(
    async (dataUrl: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let image: any;
      try {
        image = await createImageFromURLCompat(dataUrl);
      } catch {
        toast.error("3D gorsel canvasa uygulanamadi.");
        return;
      }

      image.set({
        left: canvas.getWidth() / 2,
        top: canvas.getHeight() / 2,
        originX: "center",
        originY: "center",
        opacity: 0.45,
        lockScalingFlip: true,
        selectable: true,
        evented: true,
        lockRotation: true,
      } as any);

      const fitScale = Math.min(canvas.getWidth() / (image.width || 1), canvas.getHeight() / (image.height || 1));
      image.scale(fitScale);
      (image as any).denetronMeta = { kind: "background", name: "AI 3D Gorsel" };

      canvas.add(image as any);
      image.sendToBack();
      GridSystem.apply(canvas, gridEnabled, gridSpacing);
      canvas.requestRenderAll();
      toast.success("3D gorsel arka plan olarak eklendi.");
    },
    [gridEnabled, gridSpacing]
  );

  const downloadAIImage = useCallback(() => {
    if (!aiImageDataUrl) return;
    const link = document.createElement("a");
    link.href = aiImageDataUrl;
    link.download = `${projectName.replace(/\s+/g, "-").toLowerCase()}-3d-plan.png`;
    link.click();
  }, [aiImageDataUrl, projectName]);

  const handleGenerateImage = useCallback(async () => {
    if (!aiImagePrompt.trim()) {
      toast.error("Lutfen 3D gorsel icin bina aciklamasi girin.");
      return;
    }

    try {
      setAiImageLoading(true);
      const image = await generateEvacuationImage(aiImagePrompt.trim());
      setAiImageDataUrl(image.dataUrl);
      toast.success("AI 3D gorsel uretildi.");
    } catch (error: any) {
      const message = error?.message || "AI 3D gorsel uretilemedi.";
      toast.error(message);
    } finally {
      setAiImageLoading(false);
    }
  }, [aiImagePrompt]);
  const addFloor = () => {
    const newFloor: FloorState = {
      id: `floor-${Date.now()}`,
      name: `${floors.length}. Kat`,
      canvasJson: null,
    };

    syncActiveFloorJson();
    setFloors((prev) => [...prev, newFloor]);
    setActiveFloorId(newFloor.id);
    setTimeout(() => restoreFloor(newFloor), 0);
  };

  const handleAddSymbol = async (symbol: EditorSymbol) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const loaded = await loadSVGFromStringCompat(symbol.svg);
      const grouped = groupSVGElementsCompat(loaded.objects, loaded.options);

      grouped.set({
        left: canvas.getWidth() / 2,
        top: canvas.getHeight() / 2,
        originX: "center",
        originY: "center",
        scaleX: 0.85,
        scaleY: 0.85,
        cornerStyle: "circle",
        transparentCorners: false,
      } as any);

      (grouped as any).denetronMeta = {
        kind: "symbol",
        name: symbol.name,
        symbolId: symbol.id,
        symbolName: symbol.name,
        legendEmoji: symbol.emoji,
      };

      canvas.add(grouped as any);
      canvas.setActiveObject(grouped as any);
      canvas.requestRenderAll();
      updateLayersAndLegend();
    } catch (error) {
      console.error("Sembol ekleme hatası:", error);
      toast.error("Sembol eklenemedi");
    }
  };

  const handleUploadBackground = async (file: File) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = await readAsDataUrl(file);
    let image: any;
    try {
      image = await createImageFromURLCompat(dataUrl);
    } catch {
      toast.error("Arka plan yüklenemedi");
      return;
    }

    image.set({
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
      originX: "center",
      originY: "center",
      opacity: 0.55,
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
    GridSystem.apply(canvas, gridEnabled, gridSpacing);
    canvas.requestRenderAll();
    toast.success("Arka plan görseli eklendi");
  };

  const applyTemplate = (template: "ofis" | "depo" | "okul") => {
    const canvas = canvasRef.current;
    if (!canvas || !FabricCtors.Rect || !FabricCtors.Line) return;

    const width = canvas.getWidth();
    const height = canvas.getHeight();
    const base = new FabricCtors.Rect({
      left: width / 2,
      top: height / 2,
      originX: "center",
      originY: "center",
      width: width * 0.7,
      height: height * 0.68,
      stroke: "#94a3b8",
      fill: "rgba(148,163,184,0.04)",
      strokeWidth: 2,
    } as any);

    (base as any).denetronMeta = { kind: "template", name: "Kat Şablonu" };
    canvas.add(base);

    if (template === "ofis") {
      const wall1 = new FabricCtors.Line([width * 0.28, height * 0.36, width * 0.72, height * 0.36], { stroke: "#94a3b8", strokeWidth: 2 } as any);
      const wall2 = new FabricCtors.Line([width * 0.5, height * 0.36, width * 0.5, height * 0.72], { stroke: "#94a3b8", strokeWidth: 2 } as any);
      (wall1 as any).denetronMeta = { kind: "template", name: "Duvar" };
      (wall2 as any).denetronMeta = { kind: "template", name: "Duvar" };
      canvas.add(wall1, wall2);
    }

    if (template === "depo") {
      for (let i = 0; i < 3; i += 1) {
        const rack = new FabricCtors.Rect({
          left: width * (0.36 + i * 0.12),
          top: height * 0.53,
          width: 60,
          height: 180,
          fill: "rgba(30,64,175,0.15)",
          stroke: "#3b82f6",
          strokeWidth: 2,
        } as any);
        (rack as any).denetronMeta = { kind: "template", name: "Raf" };
        canvas.add(rack);
      }
    }

    if (template === "okul") {
      for (let i = 0; i < 4; i += 1) {
        const room = new FabricCtors.Rect({
          left: width * (0.3 + (i % 2) * 0.2),
          top: height * (0.3 + Math.floor(i / 2) * 0.22),
          width: 140,
          height: 100,
          fill: "rgba(16,185,129,0.12)",
          stroke: "#10b981",
          strokeWidth: 2,
        } as any);
        (room as any).denetronMeta = { kind: "template", name: "Sınıf" };
        canvas.add(room);
      }
    }

    canvas.requestRenderAll();
    updateLayersAndLegend();
    toast.success("Kat planı şablonu eklendi");
  };

  const getActiveObject = () => canvasRef.current?.getActiveObject() as any;

  const handleUpdateObject = (updates: Record<string, any>) => {
    const canvas = canvasRef.current;
    const obj = getActiveObject();
    if (!canvas || !obj) return;
    obj.set(updates);
    obj.setCoords();
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
  };

  const groupSelection = () => {
    const canvas = canvasRef.current;
    const active = getActiveObject();
    if (!canvas || !active || active.type !== "activeSelection") return;
    (active as any).toGroup();
    canvas.requestRenderAll();
  };

  const ungroupSelection = () => {
    const canvas = canvasRef.current;
    const active = getActiveObject();
    if (!canvas || !active || active.type !== "group") return;
    (active as any).toActiveSelection();
    canvas.requestRenderAll();
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
  };

  const toggleLayerVisibility = (layerId: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const target = canvas.getObjects().find((obj: any) => obj?.denetronMeta?.layerId === layerId) as any;
    if (!target) return;
    target.set({ visible: !target.visible });
    canvas.requestRenderAll();
    updateLayersAndLegend();
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
    });
    canvas.requestRenderAll();
    updateLayersAndLegend();
  };

  const deleteLayer = (layerId: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const target = canvas.getObjects().find((obj: any) => obj?.denetronMeta?.layerId === layerId);
    if (!target) return;
    canvas.remove(target);
    canvas.requestRenderAll();
    updateLayersAndLegend();
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
      floor.id === activeFloorId ? { ...floor, canvasJson: activeFloorJson } : floor
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
    toast.success("Kroki kaydedildi. Geçmişler sayfasından tekrar yükleyebilirsiniz.");
  };

  const exportByFormat = async (formatName: "png" | "pdf" | "svg") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const safeName = projectName.replace(/\s+/g, "-").toLowerCase();

    if (formatName === "png") return ExportService.exportPNG(canvas, safeName);
    if (formatName === "svg") return ExportService.exportSVG(canvas, safeName);

    await ExportService.exportPDF({
      canvas,
      fileName: safeName,
      projectName,
      legendItems: legendItems.map((item) => ({ ...item })),
      legendElement: document.getElementById("evacuation-legend"),
      dateLabel: format(new Date(), "dd.MM.yyyy HH:mm"),
    });
  };

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Delete") deleteSelected();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelected();
      }
    };

    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  if (showWelcomeScreen) {
    return (
      <div className="-mx-4 -my-4 min-h-[calc(100vh-3.8rem)] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_22%),linear-gradient(180deg,#020617_0%,#06132b_45%,#081a39_100%)] px-4 py-6 lg:-mx-6 lg:-my-6 lg:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <div className="overflow-hidden rounded-[28px] border border-cyan-500/20 bg-slate-950/70 shadow-[0_30px_100px_rgba(2,12,27,0.55)] backdrop-blur-xl">
            <div className="grid gap-0 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="border-b border-slate-800/80 p-6 xl:border-b-0 xl:border-r">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                  <BookOpenCheck className="h-4 w-4" />
                  Ön Kullanım Rehberi
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-50 lg:text-5xl">
                  Acil Durum Kroki Düzenleyici
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 lg:text-base">
                  Bu ekran, profesyonel kroki editörüne geçmeden önce size çalışma mantığını baştan sona anlatır.
                  Kullanıcı önce sembolleri yerleştirir, ardından tahliye yollarını çizer, kat planını ekler,
                  lejantı kontrol eder ve son olarak PDF veya PNG dışa aktarımını alır.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center gap-3 text-slate-100">
                      <UploadCloud className="h-5 w-5 text-cyan-300" />
                      <p className="font-semibold">1. Kat Planını Yükle</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Araç çubuğundaki arka plan yükleme alanından plan görselini ekleyin. Görseli ölçekleyebilir, sabitleyebilir ve
                      krokinin temelini hızlıca kurabilirsiniz.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center gap-3 text-slate-100">
                      <Layers3 className="h-5 w-5 text-cyan-300" />
                      <p className="font-semibold">2. ISO 7010 Sembollerini Yerleştir</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Sol panelden acil çıkış, yangın söndürücü, ilk yardım, alarm ve yönlendirme sembollerini sürükleyerek planın üzerine ekleyin.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center gap-3 text-slate-100">
                      <Route className="h-5 w-5 text-cyan-300" />
                      <p className="font-semibold">3. Tahliye Yolunu Çizin</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Çizgi, ok ve poliline araçlarıyla tahliye akışını oluşturun. Grid, snap ve merkez yakalama seçenekleri ile daha düzenli çalışın.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center gap-3 text-slate-100">
                      <Save className="h-5 w-5 text-cyan-300" />
                      <p className="font-semibold">4. Kaydet, Geçmişten Yükle, Dışa Aktar</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Çalışmanızı kaydedin, geçmiş krokilerden tekrar yükleyin ve hazır olduğunda PNG, SVG veya PDF çıktısı alın.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">Bu sayfada neler var</p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex items-center gap-2 text-slate-100">
                        <Sparkles className="h-4 w-4 text-cyan-300" />
                        <p className="font-semibold">AI destekli plan üretimi</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        Bina açıklamasından otomatik yerleşim oluşturabilir, mevcut krokiyi yapay zeka ile geliştirebilirsiniz.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex items-center gap-2 text-slate-100">
                        <History className="h-4 w-4 text-cyan-300" />
                        <p className="font-semibold">Çok katlı çalışma ve geçmiş yönetimi</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        Zemin kat, 1. kat ve diğer katlar için ayrı canvas durumları tutulur. Geçmişler sayfasından eski projeler tekrar açılabilir.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex items-center gap-2 text-slate-100">
                        <Layers3 className="h-4 w-4 text-cyan-300" />
                        <p className="font-semibold">Katman, özellik ve lejant kontrolü</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        Sağ panelden seçili objeyi düzenleyin, sol alttan katmanları yönetin ve alttaki lejant paneli ile kullanılan sembolleri doğrulayın.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                    <p className="text-sm font-semibold text-cyan-200">Önerilen kullanım sırası</p>
                    <ol className="mt-3 space-y-2 text-sm text-slate-300">
                      <li>1. Proje adını verin ve kat planını ekleyin.</li>
                      <li>2. Gerekli güvenlik sembollerini yerleştirin.</li>
                      <li>3. Tahliye güzergahlarını ve açıklama metinlerini tamamlayın.</li>
                      <li>4. Katmanlar ve lejantı kontrol edin.</li>
                      <li>5. Krokileri kaydedin, ardından PDF veya PNG çıktısı alın.</li>
                    </ol>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Button className="gap-2" onClick={() => setShowWelcomeScreen(false)}>
                      <Layers3 className="h-4 w-4" />
                      Editöre Geç
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => navigate("/evacuation-editor/history")}>
                      <History className="h-4 w-4" />
                      Geçmiş Krokileri Gör
                    </Button>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Editöre geçtiğinizde tüm araç çubuğu, sembol kütüphanesi ve profesyonel çizim alanı aktif olur.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="-mx-4 -my-4 flex h-[calc(100vh-3.8rem)] min-h-0 flex-col overflow-hidden bg-gradient-to-b from-slate-950 via-[#020b22] to-[#04133b] lg:-mx-6 lg:-my-6">
        <div className="sticky top-0 z-20 border-b border-slate-800/80 bg-[#020b22]/95 px-4 py-3 backdrop-blur-md lg:px-6">
          <div className="mb-2 flex items-center gap-2">
            <Layers3 className="h-6 w-6 text-cyan-400" />
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-100">Acil Durum Kroki Düzenleyici</h1>
              <p className="text-xs text-slate-400">Geniş canvas, profesyonel çizim alanı</p>
            </div>
          </div>

          <EditorToolbar
            projectName={projectName}
            onProjectNameChange={setProjectName}
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onUndo={() => historyRef.current?.undo()}
            onRedo={() => historyRef.current?.redo()}
            onGroup={groupSelection}
            onUngroup={ungroupSelection}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onSaveProject={saveProject}
            onExport={exportByFormat}
            onOpenHistory={() => navigate("/evacuation-editor/history")}
            onOpenAIGenerator={() => setAiDialogOpen(true)}
            onOpenAIImprover={() => setAiImproveDialogOpen(true)}
            onOpenAIImageGenerator={() => { setAiImageDialogOpen(true); if (!aiImagePrompt.trim() && aiPrompt.trim()) setAiImagePrompt(aiPrompt); }}
            aiGenerating={aiLoading}
            aiImproving={aiImproveLoading}
            imageGenerating={aiImageLoading}
            zoomPercent={zoomPercent}
            onZoomOut={zoomOut}
            onZoomReset={zoomReset}
            onZoomIn={zoomIn}
            onUploadBackground={handleUploadBackground}
            gridEnabled={gridEnabled}
            onGridEnabledChange={setGridEnabled}
            gridSnap={gridSnap}
            onGridSnapChange={setGridSnap}
            snapToObjects={snapToObjects}
            onSnapToObjectsChange={setSnapToObjects}
            snapToCenter={snapToCenter}
            onSnapToCenterChange={setSnapToCenter}
            gridSpacing={gridSpacing}
            onGridSpacingChange={setGridSpacing}
            floors={floors.map((f) => ({ id: f.id, name: f.name }))}
            activeFloorId={activeFloor?.id || floors[0].id}
            onFloorChange={changeFloor}
            onAddFloor={addFloor}
            focusMode={focusMode}
            onToggleFocusMode={() => setFocusMode((v) => !v)}
          />

          <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
            <Button size="sm" variant="outline" onClick={() => applyTemplate("ofis")}>Ofis Şablonu</Button>
            <Button size="sm" variant="outline" onClick={() => applyTemplate("depo")}>Depo Şablonu</Button>
            <Button size="sm" variant="outline" onClick={() => applyTemplate("okul")}>Okul Şablonu</Button>
            <span className="ml-2 whitespace-nowrap text-xs text-slate-400">
              Zoom: %{zoomPercent} | Space + Drag: Pan | Wheel/Pinch: Zoom
            </span>
          </div>
        </div>

        <div className="min-h-0 flex flex-1 gap-3 p-3 lg:p-4">
          <div className="flex min-h-0 w-[240px] shrink-0 flex-col gap-3">
            <div className="min-h-0 flex-1">
              <SymbolLibrary onAddSymbol={handleAddSymbol} />
            </div>
            <div className="h-[240px] min-h-[180px]">
              <LayerPanel
                layers={layers}
                selectedLayerId={(selectedObject as any)?.denetronMeta?.layerId || null}
                onSelectLayer={selectLayer}
                onToggleVisibility={toggleLayerVisibility}
                onToggleLock={toggleLayerLock}
                onMoveLayer={moveLayer}
                onDeleteLayer={deleteLayer}
              />
            </div>
          </div>

          <div className="flex min-h-0 min-w-[900px] flex-[1_1_70%] flex-col gap-2 overflow-hidden">
            <div className="min-h-0 flex-1">
              <CanvasWorkspace
                activeTool={activeTool}
                onCanvasReady={handleCanvasReady}
                onSelectionChange={setSelectedObject}
                onObjectsChange={updateLayersAndLegend}
                onToolConsumed={() => setActiveTool("select")}
                onCanvasResize={handleCanvasResize}
                onZoomChange={setZoomPercent}
              />
            </div>

            <div className="rounded-lg border border-slate-800/80 bg-slate-950/55 p-2">
              <button
                className="w-full rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2 text-left text-xs font-semibold text-slate-200"
                onClick={() => setLegendOpen((v) => !v)}
              >
                {legendOpen ? "Lejantı Gizle" : "Lejantı Göster"}
              </button>
              {legendOpen && (
                <div className="mt-2 max-h-[220px] overflow-auto">
                  <LegendPanel items={legendItems} />
                </div>
              )}
            </div>
          </div>

          {!focusMode && (
            <div className="min-h-0 w-[260px] shrink-0">
              <PropertiesPanel
                selectedObject={selectedObject}
                onUpdateObject={handleUpdateObject}
                onDeleteObject={deleteSelected}
                onDuplicateObject={duplicateSelected}
                onBringForward={() => {
                  const obj = getActiveObject();
                  if (!obj) return;
                  obj.bringForward();
                  canvasRef.current?.requestRenderAll();
                }}
                onSendBackward={() => {
                  const obj = getActiveObject();
                  if (!obj) return;
                  obj.sendBackwards();
                  canvasRef.current?.requestRenderAll();
                }}
                onUploadBackground={handleUploadBackground}
              />
            </div>
          )}
        </div>
      </div>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl border-slate-700 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>AI ile Kroki Oluştur</DialogTitle>
            <DialogDescription className="text-slate-400">
              Bina açıklamasını girin, Gemini ile otomatik tahliye planı oluşturulsun.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={7}
            placeholder="Örnek: 300 m2 ofis, 6 oda, 2 acil çıkış, 1 yangın merdiveni"
            className="border-slate-700 bg-slate-900/70"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setAiDialogOpen(false)} disabled={aiLoading}>Vazgeç</Button>
            <Button onClick={handleGeneratePlan} disabled={aiLoading} className="gap-2">
              {aiLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {aiLoading ? "Plan Oluşturuluyor" : "Plan Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={aiImproveDialogOpen} onOpenChange={setAiImproveDialogOpen}>
        <DialogContent className="max-w-2xl border-slate-700 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>AI Kroki Iyilestir</DialogTitle>
            <DialogDescription className="text-slate-400">
              Mevcut krokiyi tarifinize gore gelistirin. Ornek: "Krokiye bir acil cikis daha ekle".
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={aiImprovePrompt}
            onChange={(e) => setAiImprovePrompt(e.target.value)}
            rows={6}
            placeholder="Ornek: Krokideki kuzey koridora bir acil cikis ve bir yangin sondurucu ekle."
            className="border-slate-700 bg-slate-900/70"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setAiImproveDialogOpen(false)} disabled={aiImproveLoading}>Vazgec</Button>
            <Button onClick={handleImprovePlan} disabled={aiImproveLoading} className="gap-2">
              {aiImproveLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {aiImproveLoading ? "Iyilestiriliyor" : "Krokiyi Iyilestir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={aiImageDialogOpen} onOpenChange={setAiImageDialogOpen}>
        <DialogContent className="max-w-4xl border-slate-700 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>AI 3D Gorsel Olustur</DialogTitle>
            <DialogDescription className="text-slate-400">
              Kullanici talimatina gore 3D profesyonel acil durum plani gorseli olusturulur.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={aiImagePrompt}
            onChange={(e) => setAiImagePrompt(e.target.value)}
            rows={6}
            placeholder="Ornek: 300 m2 ofis, 6 oda, 2 acil cikis, 1 yangin merdiveni. Izometrik 3D afis kalitesinde olustur."
            className="border-slate-700 bg-slate-900/70"
          />

          {aiImageDataUrl ? (
            <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
              <img src={aiImageDataUrl} alt="AI 3D tahliye plani" className="max-h-[420px] w-full rounded-md object-contain" />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-6 text-center text-sm text-slate-400">
              Henuz 3D gorsel uretilmedi.
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAiImageDialogOpen(false)} disabled={aiImageLoading}>Kapat</Button>
            <Button variant="outline" onClick={downloadAIImage} disabled={!aiImageDataUrl || aiImageLoading}>PNG Indir</Button>
            <Button variant="outline" onClick={() => aiImageDataUrl && applyBackgroundFromDataUrl(aiImageDataUrl)} disabled={!aiImageDataUrl || aiImageLoading}>Arka Plan Yap</Button>
            <Button onClick={handleGenerateImage} disabled={aiImageLoading} className="gap-2">
              {aiImageLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {aiImageLoading ? "3D Gorsel Uretiliyor" : "3D Gorsel Uret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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



















