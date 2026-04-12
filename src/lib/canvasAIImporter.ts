import type { AIEvacuationPlan, AIPlanPointItem, AIPlanRoom, AIPlanRoute } from "@/lib/aiPlanGenerator";
import { FabricCtors, groupSVGElementsCompat, loadSVGFromStringCompat } from "@/components/evacuation-editor/FabricCompat";

const EXIT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#16a34a"/><path d="M12 32h16" stroke="#fff" stroke-width="4"/><path d="m22 24 10 8-10 8" fill="none" stroke="#fff" stroke-width="4"/><rect x="40" y="14" width="12" height="36" rx="2" fill="#fff"/></svg>';
const EXTINGUISHER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#dc2626"/><rect x="25" y="18" width="14" height="32" rx="4" fill="#fff"/><rect x="21" y="14" width="8" height="5" fill="#fff"/><path d="M29 14c0-4 3-7 7-7h4" stroke="#fff" stroke-width="3" fill="none"/></svg>';

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function resolveRoute(route: any): { x1: number; y1: number; x2: number; y2: number } | null {
  const x1 = toFiniteNumber(route?.x1 ?? route?.fromX ?? route?.startX ?? route?.start?.x);
  const y1 = toFiniteNumber(route?.y1 ?? route?.fromY ?? route?.startY ?? route?.start?.y);
  const x2 = toFiniteNumber(route?.x2 ?? route?.toX ?? route?.endX ?? route?.end?.x);
  const y2 = toFiniteNumber(route?.y2 ?? route?.toY ?? route?.endY ?? route?.end?.y);

  if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
    return { x1, y1, x2, y2 };
  }

  const points = Array.isArray(route?.points) ? route.points : Array.isArray(route) ? route : null;
  if (points && points.length >= 2) {
    const first = points[0];
    const last = points[points.length - 1];
    const px1 = toFiniteNumber(first?.x ?? first?.[0]);
    const py1 = toFiniteNumber(first?.y ?? first?.[1]);
    const px2 = toFiniteNumber(last?.x ?? last?.[0]);
    const py2 = toFiniteNumber(last?.y ?? last?.[1]);
    if (px1 !== null && py1 !== null && px2 !== null && py2 !== null) {
      return { x1: px1, y1: py1, x2: px2, y2: py2 };
    }
  }

  return null;
}

function toRoomArray(rooms: any[]): AIPlanRoom[] {
  return rooms
    .map((room: any, idx: number) => {
      const x = toFiniteNumber(room?.x);
      const y = toFiniteNumber(room?.y);
      const width = toFiniteNumber(room?.width);
      const height = toFiniteNumber(room?.height);
      if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) {
        return null;
      }
      return {
        id: room?.id ?? `room-${idx}`,
        name: room?.name ?? "Oda",
        x,
        y,
        width,
        height,
      };
    })
    .filter(Boolean) as AIPlanRoom[];
}

function toPointArray(items: any[], fallbackName: string): AIPlanPointItem[] {
  return items
    .map((item: any, idx: number) => {
      const x = toFiniteNumber(item?.x ?? item?.left ?? item?.cx);
      const y = toFiniteNumber(item?.y ?? item?.top ?? item?.cy);
      if (x === null || y === null) return null;
      return {
        id: item?.id ?? `${fallbackName}-${idx}`,
        name: item?.name ?? fallbackName,
        x,
        y,
      };
    })
    .filter(Boolean) as AIPlanPointItem[];
}

function toRouteArray(routes: any[]): AIPlanRoute[] {
  return routes
    .map((route: any, idx: number) => {
      const resolved = resolveRoute(route);
      if (!resolved) return null;
      return {
        id: route?.id ?? `route-${idx}`,
        ...resolved,
      };
    })
    .filter(Boolean) as AIPlanRoute[];
}

function roomCenter(room: AIPlanRoom) {
  return { x: room.x + room.width / 2, y: room.y + room.height / 2 };
}

function boundsOfRooms(rooms: AIPlanRoom[]) {
  if (rooms.length === 0) return null;
  const minX = Math.min(...rooms.map((r) => r.x));
  const minY = Math.min(...rooms.map((r) => r.y));
  const maxX = Math.max(...rooms.map((r) => r.x + r.width));
  const maxY = Math.max(...rooms.map((r) => r.y + r.height));
  return { minX, minY, maxX, maxY };
}

function enrichPlan(plan: AIEvacuationPlan): AIEvacuationPlan {
  const rooms = toRoomArray(plan.rooms as any[]);
  let exits = toPointArray(plan.exits as any[], "Acil Cikis");
  const extinguishers = toPointArray(plan.extinguishers as any[], "Yangin Sondurucu");
  let routes = toRouteArray(plan.routes as any[]);

  const bounds = boundsOfRooms(rooms);

  if (exits.length === 0 && bounds) {
    const midY = (bounds.minY + bounds.maxY) / 2;
    exits = [
      { id: "auto-exit-left", name: "Acil Cikis", x: bounds.minX - 40, y: midY },
      { id: "auto-exit-right", name: "Acil Cikis", x: bounds.maxX + 40, y: midY },
    ];
  }

  if (routes.length === 0 && exits.length > 0) {
    const autoRoutes: AIPlanRoute[] = [];
    rooms.forEach((room, idx) => {
      const c = roomCenter(room);
      let nearest = exits[0];
      let minDist = Number.POSITIVE_INFINITY;
      exits.forEach((exit) => {
        const d = Math.hypot(exit.x - c.x, exit.y - c.y);
        if (d < minDist) {
          minDist = d;
          nearest = exit;
        }
      });
      autoRoutes.push({
        id: `auto-route-${idx}`,
        x1: c.x,
        y1: c.y,
        x2: nearest.x,
        y2: nearest.y,
      });
    });
    routes = autoRoutes;
  }

  return {
    rooms,
    exits,
    extinguishers,
    routes,
  };
}

export function validateAIPlan(plan: AIEvacuationPlan): void {
  if (!plan || typeof plan !== "object") {
    throw new Error("AI plan gecersiz.");
  }

  if (!Array.isArray(plan.rooms) || !Array.isArray(plan.exits) || !Array.isArray(plan.extinguishers) || !Array.isArray(plan.routes)) {
    throw new Error("AI plan alanlari eksik.");
  }

  const normalized = enrichPlan(plan);

  for (const room of normalized.rooms) {
    if (!Number.isFinite(room.x) || !Number.isFinite(room.y) || !Number.isFinite(room.width) || !Number.isFinite(room.height)) {
      throw new Error("Room koordinatlari sayisal olmali.");
    }
    if (room.width <= 0 || room.height <= 0) {
      throw new Error("Room width ve height sifirdan buyuk olmali.");
    }
  }

  for (const exit of normalized.exits) {
    if (!Number.isFinite(exit.x) || !Number.isFinite(exit.y)) {
      throw new Error("Exit koordinatlari sayisal olmali.");
    }
  }

  for (const ext of normalized.extinguishers) {
    if (!Number.isFinite(ext.x) || !Number.isFinite(ext.y)) {
      throw new Error("Extinguisher koordinatlari sayisal olmali.");
    }
  }

  for (const route of normalized.routes) {
    if (!Number.isFinite(route.x1) || !Number.isFinite(route.y1) || !Number.isFinite(route.x2) || !Number.isFinite(route.y2)) {
      throw new Error("Route koordinatlari sayisal olmali.");
    }
  }
}

async function addSvgSymbol(canvas: any, svg: string, x: number, y: number, name: string, symbolId: string, legendEmoji: string) {
  const loaded = await loadSVGFromStringCompat(svg);
  const grouped = groupSVGElementsCompat(loaded.objects, loaded.options);

  grouped.set({
    left: x,
    top: y,
    originX: "center",
    originY: "center",
    scaleX: 0.55,
    scaleY: 0.55,
  } as any);

  (grouped as any).denetronMeta = {
    kind: "symbol",
    name,
    symbolId,
    symbolName: name,
    legendEmoji,
  };

  canvas.add(grouped as any);
}

function addRouteArrow(canvas: any, x1: number, y1: number, x2: number, y2: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headSize = 14;

  const shaft = new FabricCtors.Line([x1, y1, x2, y2], {
    stroke: "#22c55e",
    strokeWidth: 4,
    strokeDashArray: [10, 6],
    selectable: true,
    evented: true,
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
    selectable: true,
    evented: true,
  } as any);

  const group = new FabricCtors.Group([shaft, head], {
    selectable: true,
    evented: true,
  } as any);

  (group as any).denetronMeta = { kind: "path", name: "Tahliye Oku" };
  canvas.add(group as any);
}

function addBuildingShell(canvas: any, rooms: AIPlanRoom[]) {
  const b = boundsOfRooms(rooms);
  if (!b) return;

  const shell = new FabricCtors.Rect({
    left: b.minX - 36,
    top: b.minY - 36,
    width: b.maxX - b.minX + 72,
    height: b.maxY - b.minY + 72,
    fill: "rgba(148,163,184,0.03)",
    stroke: "#94a3b8",
    strokeWidth: 2,
    selectable: false,
    evented: false,
  } as any);

  (shell as any).denetronMeta = { kind: "shell", name: "Bina Siniri" };
  canvas.add(shell as any);
  shell.sendToBack();
}

function addPlanHeader(canvas: any) {
  if (!FabricCtors.IText) return;
  const title = new FabricCtors.IText("IS SAGLIGI VE GUVENLIGI ACIL DURUM PLANI", {
    left: 120,
    top: 26,
    fontSize: 22,
    fontWeight: "bold",
    fill: "#dbeafe",
    selectable: false,
    evented: false,
  } as any);
  (title as any).denetronMeta = { kind: "header", name: "Plan Basligi" };
  canvas.add(title as any);
}

function addAssemblyPoint(canvas: any, x: number, y: number) {
  const circle = new FabricCtors.Circle({
    left: x,
    top: y,
    radius: 28,
    fill: "#1d4ed8",
    stroke: "#93c5fd",
    strokeWidth: 2,
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
  } as any);
  (circle as any).denetronMeta = { kind: "assembly", symbolId: "assembly-point", symbolName: "Toplanma Noktasi", legendEmoji: "📍" };
  canvas.add(circle as any);

  if (FabricCtors.IText) {
    const text = new FabricCtors.IText("TOPLANMA", {
      left: x - 22,
      top: y - 6,
      fontSize: 10,
      fill: "#ffffff",
      selectable: false,
      evented: false,
    } as any);
    (text as any).denetronMeta = { kind: "assembly-label", name: "Toplanma" };
    canvas.add(text as any);
  }
}


export async function importAIPlan(canvas: any, rawPlan: AIEvacuationPlan): Promise<void> {
  validateAIPlan(rawPlan);
  const plan = enrichPlan(rawPlan);

  addBuildingShell(canvas, plan.rooms);
  addPlanHeader(canvas);
  addAssemblyPoint(canvas, 120, 730);
  addAssemblyPoint(canvas, 1080, 730);

  for (const room of plan.rooms) {
    const rect = new FabricCtors.Rect({
      left: room.x,
      top: room.y,
      width: room.width,
      height: room.height,
      fill: "rgba(148,163,184,0.08)",
      stroke: "#94a3b8",
      strokeWidth: 2,
      originX: "left",
      originY: "top",
    } as any);

    (rect as any).denetronMeta = {
      kind: "room",
      name: room.name || "Oda",
    };

    canvas.add(rect as any);

    if (FabricCtors.IText) {
      const label = new FabricCtors.IText(room.name || "Oda", {
        left: room.x + 8,
        top: room.y + 8,
        fontSize: 14,
        fill: "#e2e8f0",
        selectable: true,
      } as any);
      (label as any).denetronMeta = { kind: "text", name: room.name || "Oda" };
      canvas.add(label as any);
    }
  }

  for (const exit of plan.exits) {
    await addSvgSymbol(canvas, EXIT_SVG, exit.x, exit.y, exit.name || "Acil Cikis", "ai-exit", "🚪");
  }

  for (const ext of plan.extinguishers) {
    await addSvgSymbol(canvas, EXTINGUISHER_SVG, ext.x, ext.y, ext.name || "Yangin Sondurucu", "ai-extinguisher", "🧯");
  }

  for (const route of plan.routes) {
    addRouteArrow(canvas, route.x1, route.y1, route.x2, route.y2);
  }

  canvas.requestRenderAll();
}



