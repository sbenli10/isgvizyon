import { Sentry, sentryEnabled } from "@/lib/sentry";

type GuardOperation = "appendChild" | "insertBefore" | "removeChild" | "replaceChild";

type GuardNodeSummary = {
  name: string;
  nodeType: number;
  isConnected: boolean;
};

type GuardFailurePayload = {
  operation: GuardOperation;
  fallbackUsed: boolean;
  fallbackStrategy: string;
  parent: GuardNodeSummary | null;
  child: GuardNodeSummary | null;
  reference: GuardNodeSummary | null;
  route: string;
  componentName: string;
  reason: string;
};

export type DomGuardSnapshot = {
  failureCount: number;
  lastFailure: GuardFailurePayload | null;
};

let domMutationGuardsInstalled = false;

const domGuardSnapshot: DomGuardSnapshot = {
  failureCount: 0,
  lastFailure: null,
};

const isDomNotFoundError = (error: unknown) =>
  error instanceof DOMException &&
  error.name === "NotFoundError" &&
  typeof error.message === "string" &&
  (error.message.includes("not a child of this node") ||
    error.message.includes("before which the new node is to be inserted"));

const summarizeNode = (node: Node | null | undefined): GuardNodeSummary | null => {
  if (!node) return null;

  return {
    name: node.nodeName,
    nodeType: node.nodeType,
    isConnected: "isConnected" in node ? Boolean((node as Node & { isConnected?: boolean }).isConnected) : false,
  };
};

const getCurrentRoute = () => {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}` || "/";
};

const getCurrentComponentName = () => {
  if (typeof window === "undefined") return "unknown";
  const pathname = window.location.pathname;

  if (pathname.startsWith("/companies")) return "CompanyManager";
  if (pathname.startsWith("/risk-assessment")) return "RiskAssessmentEditor";
  if (pathname.startsWith("/bulk-capa")) return "BulkCAPA";
  if (pathname.startsWith("/adep")) return "ADEPWizard";
  return "unknown";
};

const recordGuardFailure = (payload: GuardFailurePayload) => {
  domGuardSnapshot.failureCount += 1;
  domGuardSnapshot.lastFailure = payload;

  if (!sentryEnabled) return;

  Sentry.addBreadcrumb({
    category: "dom.guard",
    level: "warning",
    message: `${payload.operation} fallback`,
    data: {
      route: payload.route,
      component_name: payload.componentName,
      fallback_strategy: payload.fallbackStrategy,
      fallback_used: payload.fallbackUsed,
      reason: payload.reason,
      parent: payload.parent,
      child: payload.child,
      reference: payload.reference,
    },
  });

  Sentry.setTag("dom_guard_failed", "true");
  Sentry.setContext("dom_guard", {
    failure_count: domGuardSnapshot.failureCount,
    last_operation: payload.operation,
    route: payload.route,
    component_name: payload.componentName,
    fallback_strategy: payload.fallbackStrategy,
    fallback_used: payload.fallbackUsed,
    reason: payload.reason,
    parent: payload.parent,
    child: payload.child,
    reference: payload.reference,
  });
};

export const getDomGuardSnapshot = (): DomGuardSnapshot => ({
  failureCount: domGuardSnapshot.failureCount,
  lastFailure: domGuardSnapshot.lastFailure,
});

export function installDomMutationGuards() {
  if (domMutationGuardsInstalled || typeof Node === "undefined") return;

  domMutationGuardsInstalled = true;

  const nativeAppendChild = Node.prototype.appendChild;
  const nativeInsertBefore = Node.prototype.insertBefore;
  const nativeRemoveChild = Node.prototype.removeChild;
  const nativeReplaceChild = Node.prototype.replaceChild;

  Node.prototype.appendChild = function guardedAppendChild<T extends Node>(child: T): T {
    try {
      return nativeAppendChild.call(this, child) as T;
    } catch (error) {
      const parent = this as Node;

      if (child.parentNode === parent) {
        recordGuardFailure({
          operation: "appendChild",
          fallbackUsed: true,
          fallbackStrategy: "reuse-existing-child",
          parent: summarizeNode(parent),
          child: summarizeNode(child),
          reference: null,
          route: getCurrentRoute(),
          componentName: getCurrentComponentName(),
          reason: error instanceof Error ? error.message : "appendChild failed",
        });
        return child;
      }

      throw error;
    }
  };

  Node.prototype.insertBefore = function guardedInsertBefore<T extends Node>(
    newNode: T,
    referenceNode: Node | null,
  ): T {
    try {
      return nativeInsertBefore.call(this, newNode, referenceNode) as T;
    } catch (error) {
      const parent = this as Node;
      const referenceParent = referenceNode?.parentNode ?? null;

      if (isDomNotFoundError(error) && referenceNode && referenceParent !== parent) {
        recordGuardFailure({
          operation: "insertBefore",
          fallbackUsed: true,
          fallbackStrategy: "append-child",
          parent: summarizeNode(parent),
          child: summarizeNode(newNode),
          reference: summarizeNode(referenceNode),
          route: getCurrentRoute(),
          componentName: getCurrentComponentName(),
          reason: error.message,
        });

        if (newNode.parentNode === parent) {
          return newNode;
        }

        return nativeAppendChild.call(parent, newNode) as T;
      }

      throw error;
    }
  };

  Node.prototype.removeChild = function guardedRemoveChild<T extends Node>(child: T): T {
    try {
      return nativeRemoveChild.call(this, child) as T;
    } catch (error) {
      const parent = this as Node;

      if (isDomNotFoundError(error) && child.parentNode !== parent) {
        recordGuardFailure({
          operation: "removeChild",
          fallbackUsed: true,
          fallbackStrategy: "skip-remove",
          parent: summarizeNode(parent),
          child: summarizeNode(child),
          reference: null,
          route: getCurrentRoute(),
          componentName: getCurrentComponentName(),
          reason: error.message,
        });
        return child;
      }

      throw error;
    }
  };

  Node.prototype.replaceChild = function guardedReplaceChild<T extends Node, U extends Node>(
    newChild: T,
    oldChild: U,
  ): U {
    try {
      return nativeReplaceChild.call(this, newChild, oldChild) as U;
    } catch (error) {
      const parent = this as Node;

      if (isDomNotFoundError(error) && oldChild.parentNode !== parent) {
        recordGuardFailure({
          operation: "replaceChild",
          fallbackUsed: true,
          fallbackStrategy: "append-new-child",
          parent: summarizeNode(parent),
          child: summarizeNode(newChild),
          reference: summarizeNode(oldChild),
          route: getCurrentRoute(),
          componentName: getCurrentComponentName(),
          reason: error.message,
        });

        if (newChild.parentNode !== parent) {
          nativeAppendChild.call(parent, newChild);
        }

        return oldChild;
      }

      throw error;
    }
  };
}
