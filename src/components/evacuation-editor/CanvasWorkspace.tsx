import { useEffect, useRef } from "react";
import { Fabric, FabricCtors } from "./FabricCompat";

type CanvasToolMode =
  | "select"
  | "line"
  | "arrow"
  | "polyline"
  | "text"
  | "rect"
  | "circle";

interface CanvasWorkspaceProps {
  activeTool: CanvasToolMode;
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
const DEBUG_CANVAS = true;



function isEditableInputTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;

  if (!element) return false;

  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.isContentEditable
  );
}

function normalizeFabricDom(canvas: any) {
  const wrapper = canvas.wrapperEl as HTMLDivElement | undefined;
  const lowerCanvas = canvas.lowerCanvasEl as HTMLCanvasElement | undefined;
  const upperCanvas = canvas.upperCanvasEl as HTMLCanvasElement | undefined;

  if (wrapper) {
    wrapper.style.position = "relative";
    wrapper.style.width = `${CANVAS_WIDTH}px`;
    wrapper.style.height = `${CANVAS_HEIGHT}px`;
    wrapper.style.background = "#ffffff";
    wrapper.style.overflow = "hidden";
  }

  [lowerCanvas, upperCanvas].forEach((canvasElement) => {
    if (!canvasElement) return;
    canvasElement.width = CANVAS_WIDTH;
    canvasElement.height = CANVAS_HEIGHT;
    canvasElement.style.width = `${CANVAS_WIDTH}px`;
    canvasElement.style.height = `${CANVAS_HEIGHT}px`;
    canvasElement.style.display = "block";
    canvasElement.style.visibility = "visible";
    canvasElement.style.opacity = "1";
  });

  if (lowerCanvas) {
    lowerCanvas.style.background = "transparent";
  }

  if (upperCanvas) {
    upperCanvas.style.background = "transparent";
    upperCanvas.style.backgroundColor = "transparent";
  }

  if (DEBUG_CANVAS) {
    const lowerStyle = lowerCanvas ? window.getComputedStyle(lowerCanvas) : null;
    const upperStyle = upperCanvas ? window.getComputedStyle(upperCanvas) : null;
    const wrapperStyle = wrapper ? window.getComputedStyle(wrapper) : null;

    console.log("Canvas DOM layers", {
      internal: { width: canvas.getWidth(), height: canvas.getHeight(), zoom: canvas.getZoom() },
      wrapper: wrapper
        ? {
            display: wrapperStyle?.display,
            visibility: wrapperStyle?.visibility,
            opacity: wrapperStyle?.opacity,
            width: wrapperStyle?.width,
            height: wrapperStyle?.height,
            zIndex: wrapperStyle?.zIndex,
          }
        : null,
      lower: lowerCanvas
        ? {
            display: lowerStyle?.display,
            visibility: lowerStyle?.visibility,
            opacity: lowerStyle?.opacity,
            background: lowerStyle?.backgroundColor,
            zIndex: lowerStyle?.zIndex,
            cssWidth: lowerStyle?.width,
            cssHeight: lowerStyle?.height,
            attrWidth: lowerCanvas.width,
            attrHeight: lowerCanvas.height,
          }
        : null,
      upper: upperCanvas
        ? {
            display: upperStyle?.display,
            visibility: upperStyle?.visibility,
            opacity: upperStyle?.opacity,
            background: upperStyle?.backgroundColor,
            zIndex: upperStyle?.zIndex,
            cssWidth: upperStyle?.width,
            cssHeight: upperStyle?.height,
            attrWidth: upperCanvas.width,
            attrHeight: upperCanvas.height,
          }
        : null,
    });
  }
}

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

  const activeToolRef = useRef<CanvasToolMode>(activeTool);
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

  const suppressObjectsChangeRef = useRef(false);
  const objectsChangeFrameRef = useRef<number | null>(null);
  const objectsChangeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    callbacksRef.current = {
      onCanvasReady,
      onSelectionChange,
      onObjectsChange,
      onToolConsumed,
      onCanvasResize,
      onZoomChange,
    };
  }, [
    onCanvasReady,
    onCanvasResize,
    onObjectsChange,
    onSelectionChange,
    onToolConsumed,
    onZoomChange,
  ]);

  const renderCanvas = (canvas: any) => {
    if (!canvas) return;

    if (typeof canvas.requestRenderAll === "function") {
      canvas.requestRenderAll();
    }

    if (typeof canvas.renderAll === "function") {
      canvas.renderAll();
    }
  };

  const scheduleObjectsChange = () => {
    if (suppressObjectsChangeRef.current) return;

    if (objectsChangeFrameRef.current !== null) {
      return;
    }

    objectsChangeFrameRef.current = window.requestAnimationFrame(() => {
      objectsChangeFrameRef.current = null;

      if (objectsChangeTimeoutRef.current !== null) {
        window.clearTimeout(objectsChangeTimeoutRef.current);
      }

      objectsChangeTimeoutRef.current = window.setTimeout(() => {
        objectsChangeTimeoutRef.current = null;
        callbacksRef.current.onObjectsChange();
      }, 0);
    });
  };

  const clearScheduledObjectsChange = () => {
    if (objectsChangeFrameRef.current !== null) {
      window.cancelAnimationFrame(objectsChangeFrameRef.current);
      objectsChangeFrameRef.current = null;
    }

    if (objectsChangeTimeoutRef.current !== null) {
      window.clearTimeout(objectsChangeTimeoutRef.current);
      objectsChangeTimeoutRef.current = null;
    }
  };

  const isGridObject = (obj: any) => obj?.denetronMeta?.kind === "grid";
  const isDraftObject = (obj: any) => obj?.denetronMeta?.kind === "draft";

  const isLockedBackground = (obj: any) =>
    obj?.denetronMeta?.kind === "background" && obj?.lockMovementX === true;

  const updateInteractivity = (canvas: any, tool: CanvasToolMode) => {
    const isSelectMode = tool === "select";

    canvas.getObjects().forEach((obj: any) => {
      if (isGridObject(obj)) {
        obj.selectable = false;
        obj.evented = false;
        return;
      }

      if (isLockedBackground(obj)) {
        obj.selectable = false;
        obj.evented = false;
        return;
      }

      const locked =
        obj.lockMovementX === true ||
        obj.lockMovementY === true ||
        obj.lockScalingX === true ||
        obj.lockScalingY === true ||
        obj.lockRotation === true;

      obj.selectable = isSelectMode && !locked;
      obj.evented = isSelectMode && !locked;
    });

    canvas.selection = isSelectMode;
  };

  const addObjectSafely = (canvas: any, obj: any, makeActive = true) => {
    suppressObjectsChangeRef.current = true;

    try {
      canvas.add(obj);

      if (makeActive) {
        canvas.setActiveObject(obj);
      }

      if (typeof obj.setCoords === "function") {
        obj.setCoords();
      }

      renderCanvas(canvas);
    } finally {
      suppressObjectsChangeRef.current = false;
    }

    scheduleObjectsChange();
  };

  const consumeToolAfterAdd = () => {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        callbacksRef.current.onToolConsumed();
      }, 0);
    });
  };

  useEffect(() => {
    if (!canvasElRef.current) return;
    if (canvasRef.current) return;
    if (!FabricCtors.Canvas) return;

    const canvas = new FabricCtors.Canvas(canvasElRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
      selection: true,
      stopContextMenu: true,
      fireRightClick: true,
    } as any);

    canvasRef.current = canvas;

    canvas.setWidth(CANVAS_WIDTH);
    canvas.setHeight(CANVAS_HEIGHT);
    canvas.set("backgroundColor", "#ffffff");
    canvas.calcOffset();
    normalizeFabricDom(canvas);

    const handleSelectionChange = () => {
      callbacksRef.current.onSelectionChange(canvas.getActiveObject() || null);
    };

    const handleSelectionCleared = () => {
      callbacksRef.current.onSelectionChange(null);
    };

    const handleObjectsChange = (event: any) => {
      if (suppressObjectsChangeRef.current) return;

      const target = event?.target;

      if (isGridObject(target)) return;
      if (isDraftObject(target)) return;

      scheduleObjectsChange();
    };

    const handleWheel = (event: any) => {
      const nativeEvent = event.e as WheelEvent;

      nativeEvent.preventDefault();
      nativeEvent.stopPropagation();

      const currentZoom = canvas.getZoom();
      const delta = nativeEvent.deltaY;
      const nextZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, currentZoom * Math.pow(0.999, delta)),
      );

      const pointer = canvas.getPointer(nativeEvent);
      const point = Fabric?.Point
        ? new Fabric.Point(pointer.x, pointer.y)
        : ({ x: pointer.x, y: pointer.y } as any);

      canvas.zoomToPoint(point, nextZoom);
      callbacksRef.current.onZoomChange?.(Math.round(nextZoom * 100));
      renderCanvas(canvas);
    };

    const handlePanMouseDown = (event: any) => {
      if (!isSpacePressedRef.current) return;

      isPanningRef.current = true;
      panStartRef.current = {
        x: event.e.clientX,
        y: event.e.clientY,
      };

      canvas.selection = false;
      canvas.defaultCursor = "grabbing";
      canvas.discardActiveObject();
      renderCanvas(canvas);
    };

    const handlePanMouseMove = (event: any) => {
      if (!isPanningRef.current) return;

      const viewportTransform = canvas.viewportTransform;
      if (!viewportTransform) return;

      const currentX = event.e.clientX;
      const currentY = event.e.clientY;

      viewportTransform[4] += currentX - panStartRef.current.x;
      viewportTransform[5] += currentY - panStartRef.current.y;

      panStartRef.current = {
        x: currentX,
        y: currentY,
      };

      renderCanvas(canvas);
    };

    const handlePanMouseUp = () => {
      if (!isPanningRef.current) return;

      isPanningRef.current = false;
      canvas.defaultCursor = isSpacePressedRef.current ? "grab" : "default";
      canvas.selection = activeToolRef.current === "select";
      renderCanvas(canvas);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      if (isEditableInputTarget(event.target)) return;

      event.preventDefault();

      isSpacePressedRef.current = true;

      if (!isPanningRef.current) {
        canvas.defaultCursor = "grab";
        renderCanvas(canvas);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;

      isSpacePressedRef.current = false;

      if (!isPanningRef.current) {
        canvas.defaultCursor =
          activeToolRef.current === "select" ? "default" : "crosshair";
        renderCanvas(canvas);
      }
    };

    canvas.on("selection:created", handleSelectionChange);
    canvas.on("selection:updated", handleSelectionChange);
    canvas.on("selection:cleared", handleSelectionCleared);

    canvas.on("object:added", handleObjectsChange);
    canvas.on("object:removed", handleObjectsChange);
    canvas.on("object:modified", handleObjectsChange);

    canvas.on("mouse:wheel", handleWheel);
    canvas.on("mouse:down", handlePanMouseDown);
    canvas.on("mouse:move", handlePanMouseMove);
    canvas.on("mouse:up", handlePanMouseUp);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    callbacksRef.current.onCanvasReady(canvas);
    callbacksRef.current.onCanvasResize?.(canvas);
    callbacksRef.current.onZoomChange?.(100);

    renderCanvas(canvas);

    return () => {
      clearScheduledObjectsChange();

      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);

      canvas.off("selection:created", handleSelectionChange);
      canvas.off("selection:updated", handleSelectionChange);
      canvas.off("selection:cleared", handleSelectionCleared);

      canvas.off("object:added", handleObjectsChange);
      canvas.off("object:removed", handleObjectsChange);
      canvas.off("object:modified", handleObjectsChange);

      canvas.off("mouse:wheel", handleWheel);
      canvas.off("mouse:down", handlePanMouseDown);
      canvas.off("mouse:move", handlePanMouseMove);
      canvas.off("mouse:up", handlePanMouseUp);

      canvas.dispose();

      canvasRef.current = null;
      lineDraftRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = false;
    canvas.defaultCursor = activeTool === "select" ? "default" : "crosshair";

    updateInteractivity(canvas, activeTool);
    renderCanvas(canvas);

    const cleanupDraft = () => {
      const draft = lineDraftRef.current;

      if (!draft) return;

      if (canvas.getObjects().includes(draft)) {
        suppressObjectsChangeRef.current = true;

        try {
          canvas.remove(draft);
          renderCanvas(canvas);
        } finally {
          suppressObjectsChangeRef.current = false;
        }
      }

      lineDraftRef.current = null;
    };

    const handleMouseDown = (event: any) => {
      if (isSpacePressedRef.current) return;
      if (activeToolRef.current === "select") return;

      const pointer = canvas.getPointer(event.e);
      const tool = activeToolRef.current;

      if (tool === "text" && FabricCtors.IText) {
        const text = new FabricCtors.IText("Yeni Metin", {
          left: pointer.x,
          top: pointer.y,
          fontSize: 20,
          fill: "#0f172a",
          originX: "left",
          originY: "top",
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
        } as any);

        (text as any).denetronMeta = {
          kind: "text",
          name: "Metin",
        };

        addObjectSafely(canvas, text);
        consumeToolAfterAdd();
        return;
      }

      if (tool === "rect" && FabricCtors.Rect) {
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
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
        } as any);

        (rect as any).denetronMeta = {
          kind: "shape",
          name: "Dikdörtgen",
        };

        addObjectSafely(canvas, rect);
        consumeToolAfterAdd();
        return;
      }

      if (tool === "circle" && FabricCtors.Circle) {
        const circle = new FabricCtors.Circle({
          left: pointer.x,
          top: pointer.y,
          radius: 42,
          fill: "rgba(59,130,246,0.15)",
          stroke: "#3b82f6",
          strokeWidth: 2,
          originX: "center",
          originY: "center",
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
        } as any);

        (circle as any).denetronMeta = {
          kind: "shape",
          name: "Daire",
        };

        addObjectSafely(canvas, circle);
        consumeToolAfterAdd();
        return;
      }

      if ((tool === "line" || tool === "arrow") && FabricCtors.Line) {
        cleanupDraft();

        const draft = new FabricCtors.Line(
          [pointer.x, pointer.y, pointer.x, pointer.y],
          {
            stroke: "#22c55e",
            strokeWidth: 4,
            selectable: false,
            evented: false,
            originX: "center",
            originY: "center",
          } as any,
        );

        (draft as any)._customType = tool === "arrow" ? "Arrow" : "Line";
        (draft as any).denetronMeta = {
          kind: "draft",
          name: "Çizim Taslağı",
        };

        lineDraftRef.current = draft;

        suppressObjectsChangeRef.current = true;

        try {
          canvas.add(draft);
          renderCanvas(canvas);
        } finally {
          suppressObjectsChangeRef.current = false;
        }

        return;
      }

      if (tool === "polyline" && FabricCtors.Polyline) {
        cleanupDraft();

        const draft = new FabricCtors.Polyline(
          [
            { x: pointer.x, y: pointer.y },
            { x: pointer.x + 1, y: pointer.y + 1 },
          ],
          {
            fill: "",
            stroke: "#22c55e",
            strokeWidth: 4,
            selectable: false,
            evented: false,
          } as any,
        );

        (draft as any)._customType = "Polyline";
        (draft as any).denetronMeta = {
          kind: "draft",
          name: "Poliline Taslağı",
        };

        lineDraftRef.current = draft;

        suppressObjectsChangeRef.current = true;

        try {
          canvas.add(draft);
          renderCanvas(canvas);
        } finally {
          suppressObjectsChangeRef.current = false;
        }
      }
    };

    const handleMouseMove = (event: any) => {
      const draft = lineDraftRef.current;

      if (!draft) return;

      const pointer = canvas.getPointer(event.e);

      if (
        draft._customType === "Line" ||
        draft._customType === "Arrow" ||
        draft.type === "line"
      ) {
        draft.set({
          x2: pointer.x,
          y2: pointer.y,
        });
      }

      if (draft._customType === "Polyline" || draft.type === "polyline") {
        const points = draft.get("points") || [];

        if (points.length >= 2) {
          points[points.length - 1] = {
            x: pointer.x,
            y: pointer.y,
          };

          draft.set({
            points: [...points],
          });

          if (typeof draft._calcDimensions === "function") {
            draft._calcDimensions();
          }
        }
      }

      if (typeof draft.setCoords === "function") {
        draft.setCoords();
      }

      renderCanvas(canvas);
    };

    const handleMouseUp = () => {
      const draft = lineDraftRef.current;

      if (!draft) return;

      const tool = activeToolRef.current;

      suppressObjectsChangeRef.current = true;

      try {
        if (tool === "arrow") {
          const arrow = createArrowFromLine(draft);

          canvas.remove(draft);
          canvas.add(arrow);
          canvas.setActiveObject(arrow);

          if (typeof arrow.setCoords === "function") {
            arrow.setCoords();
          }
        } else {
          draft.set({
            selectable: true,
            evented: true,
            hasControls: true,
            hasBorders: true,
          });

          (draft as any).denetronMeta = {
            kind: "path",
            name: tool === "polyline" ? "Poliline" : "Çizgi",
          };

          canvas.setActiveObject(draft);

          if (typeof draft.setCoords === "function") {
            draft.setCoords();
          }
        }

        renderCanvas(canvas);
      } finally {
        suppressObjectsChangeRef.current = false;
      }

      lineDraftRef.current = null;

      scheduleObjectsChange();
      consumeToolAfterAdd();
    };

    if (activeTool !== "select") {
      canvas.on("mouse:down", handleMouseDown);
      canvas.on("mouse:move", handleMouseMove);
      canvas.on("mouse:up", handleMouseUp);
    }

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);

      /**
       * Tool değişirken yarım çizim taslağı varsa temizle.
       * Normal eklenmiş text/rect/circle/line/arrow objelerine dokunmaz.
       */
      const draft = lineDraftRef.current;

      if (draft && isDraftObject(draft) && canvas.getObjects().includes(draft)) {
        suppressObjectsChangeRef.current = true;

        try {
          canvas.remove(draft);
          renderCanvas(canvas);
        } finally {
          suppressObjectsChangeRef.current = false;
        }
      }

      lineDraftRef.current = null;
    };
  }, [activeTool]);

  return (
    <div
      className="relative bg-white"
      style={{
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
      }}
    >
      <canvas
        ref={canvasElRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="block"
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          touchAction: "none",
          background: "transparent",
        }}
      />
    </div>
  );
}

function createArrowFromLine(line: any) {
  if (!FabricCtors.Line || !FabricCtors.Triangle || !FabricCtors.Group) {
    throw new Error("Fabric ok çizimi için gerekli sınıflar bulunamadı.");
  }

  const x1 = Number(line.x1 || 0);
  const y1 = Number(line.y1 || 0);
  const x2 = Number(line.x2 || 0);
  const y2 = Number(line.y2 || 0);

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headSize = 18;

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
    originX: "center",
    originY: "center",
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
  } as any);

  (group as any).denetronMeta = {
    kind: "path",
    name: "Tahliye Oku",
  };

  return group;
}
