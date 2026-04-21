let domMutationGuardsInstalled = false;

const isDomNotFoundError = (error: unknown) =>
  error instanceof DOMException &&
  error.name === "NotFoundError" &&
  error.message.includes("not a child of this node");

export function installDomMutationGuards() {
  if (domMutationGuardsInstalled || typeof Node === "undefined") return;
  domMutationGuardsInstalled = true;

  const nativeRemoveChild = Node.prototype.removeChild;

  Node.prototype.removeChild = function guardedRemoveChild<T extends Node>(child: T): T {
    try {
      return nativeRemoveChild.call(this, child) as T;
    } catch (error) {
      if (isDomNotFoundError(error) && child.parentNode !== this) {
        return child;
      }

      throw error;
    }
  };
}
