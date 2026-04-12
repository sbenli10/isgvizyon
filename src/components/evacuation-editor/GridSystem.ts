import { Fabric } from "./FabricCompat";

const GRID_KIND = "grid";

export class GridSystem {
  static clear(canvas: any) {
    const gridLines = canvas.getObjects().filter((obj: any) => obj?.denetronMeta?.kind === GRID_KIND);
    gridLines.forEach((line) => canvas.remove(line));
  }

  static render(canvas: any, spacing: number, color = "#334155") {
    if (!spacing || spacing < 4) return;

    const width = canvas.getWidth();
    const height = canvas.getHeight();

    for (let x = 0; x <= width; x += spacing) {
      const vertical = new Fabric.Line([x, 0, x, height], {
        stroke: color,
        strokeWidth: x % (spacing * 5) === 0 ? 0.8 : 0.4,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        opacity: x % (spacing * 5) === 0 ? 0.35 : 0.2,
      } as any);
      (vertical as any).denetronMeta = { kind: GRID_KIND };
      canvas.add(vertical);
      vertical.sendToBack();
    }

    for (let y = 0; y <= height; y += spacing) {
      const horizontal = new Fabric.Line([0, y, width, y], {
        stroke: color,
        strokeWidth: y % (spacing * 5) === 0 ? 0.8 : 0.4,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        opacity: y % (spacing * 5) === 0 ? 0.35 : 0.2,
      } as any);
      (horizontal as any).denetronMeta = { kind: GRID_KIND };
      canvas.add(horizontal);
      horizontal.sendToBack();
    }
  }

  static apply(canvas: any, enabled: boolean, spacing: number) {
    GridSystem.clear(canvas);
    if (enabled) {
      GridSystem.render(canvas, spacing);
    }
    canvas.requestRenderAll();
  }
}