export type SafeDomFailure = {
  operation: "insertBefore" | "removeChild";
  fallbackUsed: boolean;
  fallbackStrategy: string;
  reason: string;
  parentName: string | null;
  childName: string | null;
  referenceName: string | null;
};

export type SafeDomFailureReporter = (failure: SafeDomFailure) => void;

const getNodeName = (node: Node | null | undefined) => node?.nodeName ?? null;
const getNativeInsertBefore = () => (typeof Node !== "undefined" ? Node.prototype.insertBefore : null);
const getNativeRemoveChild = () => (typeof Node !== "undefined" ? Node.prototype.removeChild : null);
const getNativeAppendChild = () => (typeof Node !== "undefined" ? Node.prototype.appendChild : null);

const isDomNotFoundError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as { name?: unknown; message?: unknown };
  const name = typeof maybeError.name === "string" ? maybeError.name : "";
  const message = typeof maybeError.message === "string" ? maybeError.message : "";

  return (
    (name === "NotFoundError" || message.length > 0) &&
    (message.includes("not a child of this node") ||
      message.includes("before which the new node is to be inserted"))
  );
};

export function safeInsertBefore<T extends Node>(
  parent: Node,
  newNode: T,
  referenceNode: Node | null,
  onFailure?: SafeDomFailureReporter,
): T {
  const nativeInsertBefore = getNativeInsertBefore();
  try {
    if (!nativeInsertBefore) throw new Error("insertBefore is not available");
    return nativeInsertBefore.call(parent, newNode, referenceNode) as T;
  } catch (error) {
    const referenceParent = referenceNode?.parentNode ?? null;

    if (isDomNotFoundError(error) && referenceNode && referenceParent !== parent) {
      onFailure?.({
        operation: "insertBefore",
        fallbackUsed: true,
        fallbackStrategy: newNode.parentNode === parent ? "reuse-existing-child" : "append-child",
        reason: error.message,
        parentName: getNodeName(parent),
        childName: getNodeName(newNode),
        referenceName: getNodeName(referenceNode),
      });

      if (newNode.parentNode === parent) {
        return newNode;
      }

      const nativeAppendChild = getNativeAppendChild();
      if (!nativeAppendChild) throw error;
      return nativeAppendChild.call(parent, newNode) as T;
    }

    throw error;
  }
}

export function safeRemoveChild<T extends Node>(
  parent: Node,
  child: T,
  onFailure?: SafeDomFailureReporter,
): T {
  const nativeRemoveChild = getNativeRemoveChild();
  try {
    if (!nativeRemoveChild) throw new Error("removeChild is not available");
    return nativeRemoveChild.call(parent, child) as T;
  } catch (error) {
    if (isDomNotFoundError(error) && child.parentNode !== parent) {
      onFailure?.({
        operation: "removeChild",
        fallbackUsed: true,
        fallbackStrategy: "skip-remove",
        reason: error.message,
        parentName: getNodeName(parent),
        childName: getNodeName(child),
        referenceName: null,
      });
      return child;
    }

    throw error;
  }
}

export function withTemporaryBodyChild<T extends Node>(child: T, callback: () => void) {
  if (typeof document === "undefined") {
    callback();
    return;
  }

  const nativeAppendChild = getNativeAppendChild();

  if (!nativeAppendChild) {
    callback();
    return;
  }

  nativeAppendChild.call(document.body, child);

  try {
    callback();
  } finally {
    safeRemoveChild(document.body, child);
  }
}
