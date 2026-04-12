import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { ToolMode } from "./EditorToolbar";
import { Fabric, FabricCtors } from "./FabricCompat";

interface CanvasWorkspaceProps {
  activeTool: ToolMode;
  onCanvasReady: (canvas: any) => void;
  onSelectionChange: (obj: any | null) => void;
  onObjectsChange: () => void;
  onToolConsumed: () => void;
  onCanvasResize?: (canvas: any) => void;
  onZoomChange?: (zoomPercent: number) => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

export function CanvasWorkspace({
  activeTool,
  onCanvasReady,
  onSelectionChange,
  onObjectsChange,
  onToolConsumed,
  onCanvasResize,
  onZoomChange,
}: CanvasWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<any | null>(null);
  const lineDraftRef = useRef<any | null>(null);

  const isSpacePressedRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!canvasElRef.current || canvasRef.current || !FabricCtors.Canvas) return;

    const canvas = new FabricCtors.Canvas(canvasElRef.current, {
      width: 900,
      height: 600,
      preserveObjectStacking: true,
      backgroundColor: "#0b1220",
      selection: true,
    } as any);

    canvasRef.current = canvas;
    onCanvasReady(canvas);

    const handleSelection = () => onSelectionChange(canvas.getActiveObject() || null);
    const handleObjects = (event: any) => {
      if (event?.target?.denetronMeta?.kind === "grid") return;
      onObjectsChange();
    };

    const handleWheel = (event: any) => {
      const nativeEvent = event.e as WheelEvent;
      nativeEvent.preventDefault();
      nativeEvent.stopPropagation();

      const delta = nativeEvent.deltaY;
      const zoom = canvas.getZoom();
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * Math.pow(0.999, delta)));
      const pointer = canvas.getPointer(nativeEvent);
      const point = Fabric?.Point ? new Fabric.Point(pointer.x, pointer.y) : ({ x: pointer.x, y: pointer.y } as any);

      canvas.zoomToPoint(point, nextZoom);
      onZoomChange?.(Math.round(nextZoom * 100));
    };

    const handlePanMouseDown = (event: any) => {
      if (!isSpacePressedRef.current) return;
      isPanningRef.current = true;
      panStartRef.current = { x: event.e.clientX, y: event.e.clientY };
      canvas.selection = false;
      canvas.defaultCursor = "grabbing";
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    };

    const handlePanMouseMove = (event: any) => {
      if (!isPanningRef.current) return;
      const vpt = canvas.viewportTransform;
      if (!vpt) return;

      const currentX = event.e.clientX;
      const currentY = event.e.clientY;
      vpt[4] += currentX - panStartRef.current.x;
      vpt[5] += currentY - panStartRef.current.y;

      panStartRef.current = { x: currentX, y: currentY };
      canvas.requestRenderAll();
    };

    const handlePanMouseUp = () => {
      if (!isPanningRef.current) return;
      isPanningRef.current = false;
      canvas.selection = true;
      canvas.defaultCursor = isSpacePressedRef.current ? "grab" : "default";
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;

      const target = event.target as HTMLElement | null;
      const isTyping = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTyping) return;

      event.preventDefault();
      isSpacePressedRef.current = true;
      if (!isPanningRef.current) {
        canvas.defaultCursor = "grab";
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      isSpacePressedRef.current = false;
      if (!isPanningRef.current) {
        canvas.defaultCursor = "default";
      }
    };

    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", () => onSelectionChange(null));
    canvas.on("object:added", handleObjects);
    canvas.on("object:removed", handleObjects);
    canvas.on("object:modified", handleObjects);
    canvas.on("mouse:wheel", handleWheel);
    canvas.on("mouse:down", handlePanMouseDown);
    canvas.on("mouse:move", handlePanMouseMove);
    canvas.on("mouse:up", handlePanMouseUp);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    let raf = 0;
    const resize = () => {
      if (!containerRef.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!containerRef.current) return;

        const bounds = containerRef.current.getBoundingClientRect();
        const width = Math.max(900, Math.floor(bounds.width - 8));
        const height = Math.max(520, Math.floor(bounds.height - 8));

        if (canvas.getWidth() !== width || canvas.getHeight() !== height) {
          canvas.setWidth(width);
          canvas.setHeight(height);
          onCanvasResize?.(canvas);
          canvas.requestRenderAll();
        }
      });
    };

    resize();
    const observer = new ResizeObserver(resize);
    if (containerRef.current) observer.observe(containerRef.current);

    onZoomChange?.(100);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.dispose();
      canvasRef.current = null;
    };
  }, [onCanvasReady, onCanvasResize, onObjectsChange, onSelectionChange, onZoomChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (event: any) => {
      if (isSpacePressedRef.current) return;

      const pointer = canvas.getPointer(event.e);

      if (activeTool === "text" && FabricCtors.IText) {
        const text = new FabricCtors.IText("Yeni Metin", {
          left: pointer.x,
          top: pointer.y,
          fontSize: 20,
          fill: "#e2e8f0",
        } as any);
        (text as any).denetronMeta = { kind: "text", name: "Metin" };
        canvas.add(text);
        canvas.setActiveObject(text);
        onToolConsumed();
        return;
      }

      if (activeTool === "rect" && FabricCtors.Rect) {
        const rect = new FabricCtors.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 140,
          height: 80,
          fill: "rgba(34,197,94,0.15)",
          stroke: "#22c55e",
          strokeWidth: 2,
          originX: "center",
          originY: "center",
        } as any);
        (rect as any).denetronMeta = { kind: "shape", name: "Dikdortgen" };
        canvas.add(rect);
        canvas.setActiveObject(rect);
        canvas.requestRenderAll();
        onToolConsumed();
        return;
      }

      if (activeTool === "circle" && FabricCtors.Circle) {
        const circle = new FabricCtors.Circle({
          left: pointer.x,
          top: pointer.y,
          radius: 42,
          fill: "rgba(59,130,246,0.15)",
          stroke: "#3b82f6",
          strokeWidth: 2,
          originX: "center",
          originY: "center",
        } as any);
        (circle as any).denetronMeta = { kind: "shape", name: "Daire" };
        canvas.add(circle);
        canvas.setActiveObject(circle);
        canvas.requestRenderAll();
        onToolConsumed();
        return;
      }

      if ((activeTool === "line" || activeTool === "arrow") && FabricCtors.Line) {
        const draft = new FabricCtors.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: "#22c55e",
          strokeWidth: 4,
          selectable: false,
          evented: false,
        } as any);
        lineDraftRef.current = draft;
        canvas.add(draft);
        return;
      }

      if (activeTool === "polyline" && FabricCtors.Polyline) {
        const draft = new FabricCtors.Polyline(
          [
            { x: pointer.x, y: pointer.y },
            { x: pointer.x + 40, y: pointer.y },
            { x: pointer.x + 80, y: pointer.y + 20 },
          ],
          {
            fill: "",
            stroke: "#22c55e",
            strokeWidth: 4,
            selectable: false,
            evented: false,
          } as any
        );
        lineDraftRef.current = draft;
        canvas.add(draft);
      }
    };

    const handleMouseMove = (event: any) => {
      const draft = lineDraftRef.current;
      if (!draft) return;
      const pointer = canvas.getPointer(event.e);

      if (FabricCtors.Line && draft instanceof FabricCtors.Line) {
        draft.set({ x2: pointer.x, y2: pointer.y });
      } else {
        const points = draft.get("points") || [];
        if (points.length >= 3) {
          points[2].x = pointer.x;
          points[2].y = pointer.y;
          draft.set({ points });
        }
      }
      canvas.requestRenderAll();
    };

    const handleMouseUp = () => {
      const draft = lineDraftRef.current;
      if (!draft) return;

      if (activeTool === "arrow" && FabricCtors.Line && draft instanceof FabricCtors.Line) {
        const arrow = createArrowFromLine(draft);
        canvas.remove(draft);
        canvas.add(arrow as any);
        canvas.setActiveObject(arrow as any);
      } else {
        draft.set({ selectable: true, evented: true });
        (draft as any).denetronMeta = { kind: "path", name: activeTool === "polyline" ? "Poliline" : "Cizgi" };
        canvas.setActiveObject(draft as any);
      }

      lineDraftRef.current = null;
      onToolConsumed();
      canvas.requestRenderAll();
    };

    if (activeTool !== "select") {
      canvas.on("mouse:down", handleMouseDown);
      canvas.on("mouse:move", handleMouseMove);
      canvas.on("mouse:up", handleMouseUp);
      if (!isSpacePressedRef.current) {
        canvas.defaultCursor = "crosshair";
      }
    } else if (!isSpacePressedRef.current) {
      canvas.defaultCursor = "default";
    }

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
    };
  }, [activeTool, onToolConsumed]);

  return (
    <Card className="h-full min-h-0 border-slate-700/80 bg-gradient-to-b from-slate-950/70 to-[#091634] shadow-[0_16px_50px_rgba(2,6,23,0.42)] backdrop-blur-sm">
      <CardContent ref={containerRef} className="h-full min-h-0 p-2">
        <div className="h-full w-full overflow-hidden rounded-xl border border-slate-700/80 bg-[#07152f]">
          <canvas ref={canvasElRef} className="block" />
        </div>
      </CardContent>
    </Card>
  );
}

function createArrowFromLine(line: any) {
  const x1 = line.x1 || 0;
  const y1 = line.y1 || 0;
  const x2 = line.x2 || 0;
  const y2 = line.y2 || 0;

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headSize = 14;

  const shaft = new FabricCtors.Line([x1, y1, x2, y2], {
    stroke: "#22c55e",
    strokeWidth: 4,
    selectable: false,
    evented: false,
  } as any);

  const head = new FabricCtors.Triangle({
    left: x2,
    top: y2,
    originX: "center",
    originY: "center",
    width: headSize,
    height: headSize,
    fill: "#22c55e",
    angle: (angle * 180) / Math.PI + 90,
    selectable: false,
    evented: false,
  } as any);

  const group = new FabricCtors.Group([shaft, head], {
    selectable: true,
    evented: true,
  } as any);

  (group as any).denetronMeta = { kind: "path", name: "Tahliye Oku" };
  return group;
}

