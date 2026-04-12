

export interface SnapOptions {
  enabled: boolean;
  gridEnabled: boolean;
  gridSpacing: number;
  snapToObjects: boolean;
  snapToCenter: boolean;
  tolerance: number;
}

const defaultOptions: SnapOptions = {
  enabled: true,
  gridEnabled: true,
  gridSpacing: 20,
  snapToObjects: true,
  snapToCenter: true,
  tolerance: 8,
};

export class SnapSystem {
  private canvas: any;
  private options: SnapOptions;

  constructor(canvas: any, options?: Partial<SnapOptions>) {
    this.canvas = canvas;
    this.options = { ...defaultOptions, ...options };
    this.canvas.on("object:moving", this.handleObjectMoving);
  }

  updateOptions(options: Partial<SnapOptions>) {
    this.options = { ...this.options, ...options };
  }

  destroy() {
    this.canvas.off("object:moving", this.handleObjectMoving);
  }

  private handleObjectMoving = (event: any) => {
    if (!this.options.enabled) return;

    const target = event.target;
    if (!target || target?.denetronMeta?.kind === "grid") return;

    const width = this.canvas.getWidth();
    const height = this.canvas.getHeight();
    const tolerance = this.options.tolerance;

    if (this.options.gridEnabled && this.options.gridSpacing > 0) {
      const snappedLeft = Math.round(target.left / this.options.gridSpacing) * this.options.gridSpacing;
      const snappedTop = Math.round(target.top / this.options.gridSpacing) * this.options.gridSpacing;

      if (Math.abs(target.left - snappedLeft) <= tolerance) {
        target.set("left", snappedLeft);
      }

      if (Math.abs(target.top - snappedTop) <= tolerance) {
        target.set("top", snappedTop);
      }
    }

    if (this.options.snapToCenter) {
      const centerX = width / 2;
      const centerY = height / 2;

      if (Math.abs(target.left - centerX) <= tolerance) {
        target.set("left", centerX);
      }

      if (Math.abs(target.top - centerY) <= tolerance) {
        target.set("top", centerY);
      }
    }

    if (this.options.snapToObjects) {
      const others = this.canvas
        .getObjects()
        .filter((obj: any) => obj !== target && obj?.denetronMeta?.kind !== "grid" && obj.visible !== false);

      for (const obj of others) {
        if (Math.abs(target.left - obj.left) <= tolerance) {
          target.set("left", obj.left);
        }

        if (Math.abs(target.top - obj.top) <= tolerance) {
          target.set("top", obj.top);
        }
      }
    }
  };
}