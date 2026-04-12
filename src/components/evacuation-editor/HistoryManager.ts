

export class HistoryManager {
  private canvas: any;
  private snapshots: string[] = [];
  private pointer = -1;
  private isApplying = false;
  private readonly maxSnapshots: number;
  private listenersAttached = false;

  constructor(canvas: any, maxSnapshots = 120) {
    this.canvas = canvas;
    this.maxSnapshots = maxSnapshots;
    this.attach();
    this.pushSnapshot();
  }

  private serialize(): string {
    const json = this.canvas.toJSON(["denetronMeta", "symbolId", "symbolName", "legendEmoji", "name"] as any);
    return JSON.stringify(json);
  }

  private handleMutation = () => {
    if (this.isApplying) return;
    this.pushSnapshot();
  };

  private attach() {
    if (this.listenersAttached) return;
    this.canvas.on("object:added", this.handleMutation);
    this.canvas.on("object:modified", this.handleMutation);
    this.canvas.on("object:removed", this.handleMutation);
    this.listenersAttached = true;
  }

  destroy() {
    if (!this.listenersAttached) return;
    this.canvas.off("object:added", this.handleMutation);
    this.canvas.off("object:modified", this.handleMutation);
    this.canvas.off("object:removed", this.handleMutation);
    this.listenersAttached = false;
  }

  pushSnapshot() {
    const serialized = this.serialize();
    if (this.pointer >= 0 && this.snapshots[this.pointer] === serialized) {
      return;
    }

    if (this.pointer < this.snapshots.length - 1) {
      this.snapshots = this.snapshots.slice(0, this.pointer + 1);
    }

    this.snapshots.push(serialized);

    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    this.pointer = this.snapshots.length - 1;
  }

  canUndo() {
    return this.pointer > 0;
  }

  canRedo() {
    return this.pointer < this.snapshots.length - 1;
  }

  async undo() {
    if (!this.canUndo()) return;
    this.pointer -= 1;
    await this.loadAtPointer();
  }

  async redo() {
    if (!this.canRedo()) return;
    this.pointer += 1;
    await this.loadAtPointer();
  }

  private async loadAtPointer() {
    const snapshot = this.snapshots[this.pointer];
    if (!snapshot) return;

    this.isApplying = true;
    await this.canvas.loadFromJSON(snapshot);
    this.canvas.requestRenderAll();
    this.isApplying = false;
  }
}