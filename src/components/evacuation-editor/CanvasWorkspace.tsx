import { useEffect, useRef } from "react";
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
const CANVAS_WIDTH = 1100;
const CANVAS_HEIGHT = 680;

export function CanvasWorkspace({
  activeTool,
  onCanvasReady,
  onSelectionChange,
  onObjectsChange,
  onToolConsumed,
  onCanvasResize,
  onZoomChange,
}: CanvasWorkspaceProps) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<any | null>(null);
  const lineDraftRef = useRef<any | null>(null);
  const callbacksRef = useRef({
    onCanvasReady,
    onSelectionChange,
    onObjectsChange,
    onToolConsumed,
    onCanvasResize,
    onZoomChange,
  });

  const isSpacePressedRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    callbacksRef.current = {
      onCanvasReady,
      onSelectionChange,
      onObjectsChange,
      onToolConsumed,
      onCanvasResize,
      onZoomChange,
    };
  }, [onCanvasReady, onCanvasResize, onObjectsChange, onSelectionChange, onToolConsumed, onZoomChange]);

  useEffect(() => {
    if (!canvasElRef.current || canvasRef.current || !FabricCtors.Canvas) return;

    const canvas = new FabricCtors.Canvas(canvasElRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      preserveObjectStacking: true,
      backgroundColor: "#ffffff",
      selection: true,
    } as any);

    canvasRef.current = canvas;
    canvas.set("backgroundColor", "#ffffff");
    canvas.setWidth(CANVAS_WIDTH);
    canvas.setHeight(CANVAS_HEIGHT);
    canvas.calcOffset();
    callbacksRef.current.onCanvasReady(canvas);

    const handleSelection = () => callbacksRef.current.onSelectionChange(canvas.getActiveObject() || null);
    const handleObjects = (event: any) => {
      if (event?.target?.denetronMeta?.kind === "grid") return;
      callbacksRef.current.onObjectsChange();
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
      callbacksRef.current.onZoomChange?.(Math.round(nextZoom * 100));
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
    canvas.on("selection:cleared", () => callbacksRef.current.onSelectionChange(null));
    canvas.on("object:added", handleObjects);
    canvas.on("object:removed", handleObjects);
    canvas.on("object:modified", handleObjects);
    canvas.on("mouse:wheel", handleWheel);
    canvas.on("mouse:down", handlePanMouseDown);
    canvas.on("mouse:move", handlePanMouseMove);
    canvas.on("mouse:up", handlePanMouseUp);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    callbacksRef.current.onCanvasResize?.(canvas);
    callbacksRef.current.onZoomChange?.(100);
    canvas.requestRenderAll();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.dispose();
      canvasRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = false;
    canvas.selection = activeTool === "select";
    canvas.defaultCursor = activeTool === "select" ? "default" : "crosshair";
    canvas.getObjects().forEach((obj: any) => {
      if (obj?.denetronMeta?.kind === "grid") return;
      const locked = obj.lockMovementX === true;
      obj.selectable = activeTool === "select" && !locked;
      obj.evented = activeTool === "select" && !locked;
    });
    canvas.requestRenderAll();

    const handleMouseDown = (event: any) => {
      if (isSpacePressedRef.current) return;

      const pointer = canvas.getPointer(event.e);

      if (activeTool === "text" && FabricCtors.IText) {
        const text = new FabricCtors.IText("Yeni Metin", {
          left: pointer.x,
          top: pointer.y,
          fontSize: 20,
          fill: "#0f172a",
        } as any);
        (text as any).denetronMeta = { kind: "text", name: "Metin" };
        canvas.add(text);
        canvas.setActiveObject(text);
        text.setCoords();
        canvas.requestRenderAll();
        callbacksRef.current.onObjectsChange();
        callbacksRef.current.onToolConsumed();
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
        rect.setCoords();
        canvas.requestRenderAll();
        callbacksRef.current.onObjectsChange();
        callbacksRef.current.onToolConsumed();
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
        circle.setCoords();
        canvas.requestRenderAll();
        callbacksRef.current.onObjectsChange();
        callbacksRef.current.onToolConsumed();
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
        (arrow as any).setCoords?.();
      } else {
        draft.set({ selectable: true, evented: true });
        (draft as any).denetronMeta = { kind: "path", name: activeTool === "polyline" ? "Poliline" : "Cizgi" };
        canvas.setActiveObject(draft as any);
        draft.setCoords();
      }

      lineDraftRef.current = null;
      callbacksRef.current.onToolConsumed();
      canvas.requestRenderAll();
      callbacksRef.current.onObjectsChange();
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
  }, [activeTool]);

  return (
    <div className="relative bg-white" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
      <canvas
        ref={canvasElRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="block h-[680px] w-[1100px] cursor-crosshair bg-white"
      />
    </div>
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

