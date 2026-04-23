import { Sentry, sentryEnabled } from "@/lib/sentry";
import { safeInsertBefore, safeRemoveChild, type SafeDomFailure } from "@/lib/safeDom";

type GuardOperation = "insertBefore" | "removeChild";

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
  routeComponentCounts: Record<string, number>;
};

let domMutationGuardsInstalled = false;

const domGuardSnapshot: DomGuardSnapshot = {
  failureCount: 0,
  lastFailure: null,
  routeComponentCounts: {},
};

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
  const routeComponentKey = `${payload.route}::${payload.componentName}`;
  domGuardSnapshot.routeComponentCounts[routeComponentKey] =
    (domGuardSnapshot.routeComponentCounts[routeComponentKey] ?? 0) + 1;
  const routeComponentCount = domGuardSnapshot.routeComponentCounts[routeComponentKey];

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
      dom_guard_event: "fallback",
      route_component_key: routeComponentKey,
      route_component_count: routeComponentCount,
      reason: payload.reason,
      parent: payload.parent,
      child: payload.child,
      reference: payload.reference,
    },
  });

  Sentry.setTag("dom_guard_failed", "true");
  Sentry.setTag("dom_guard_event", "fallback");
  Sentry.setTag("dom_guard_operation", payload.operation);
  Sentry.setTag("dom_guard_route_component", routeComponentKey);
  Sentry.setContext("dom_guard", {
    failure_count: domGuardSnapshot.failureCount,
    route_component_key: routeComponentKey,
    route_component_count: routeComponentCount,
    route_component_counts: domGuardSnapshot.routeComponentCounts,
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

  if (routeComponentCount <= 3) {
    Sentry.captureMessage("dom_guard_fallback", {
      level: "warning",
      tags: {
        dom_guard_event: "fallback",
        dom_guard_operation: payload.operation,
        current_route: payload.route,
        component_name: payload.componentName,
      },
      fingerprint: ["dom-guard-fallback", payload.operation, routeComponentKey],
      extra: {
        route_component_count: routeComponentCount,
        fallback_strategy: payload.fallbackStrategy,
        reason: payload.reason,
      },
    });
  }
};

export const getDomGuardSnapshot = (): DomGuardSnapshot => ({
  failureCount: domGuardSnapshot.failureCount,
  lastFailure: domGuardSnapshot.lastFailure,
  routeComponentCounts: { ...domGuardSnapshot.routeComponentCounts },
});

export const resetDomGuardSnapshotForTests = () => {
  domGuardSnapshot.failureCount = 0;
  domGuardSnapshot.lastFailure = null;
  domGuardSnapshot.routeComponentCounts = {};
};

const toGuardPayload = (failure: SafeDomFailure): GuardFailurePayload => ({
  operation: failure.operation,
  fallbackUsed: failure.fallbackUsed,
  fallbackStrategy: failure.fallbackStrategy,
  parent: failure.parentName ? { name: failure.parentName, nodeType: 0, isConnected: true } : null,
  child: failure.childName ? { name: failure.childName, nodeType: 0, isConnected: true } : null,
  reference: failure.referenceName ? { name: failure.referenceName, nodeType: 0, isConnected: true } : null,
  route: getCurrentRoute(),
  componentName: getCurrentComponentName(),
  reason: failure.reason,
});

export function installDomMutationGuards() {
  if (domMutationGuardsInstalled || typeof Node === "undefined") return;

  domMutationGuardsInstalled = true;

  const nativeInsertBefore = Node.prototype.insertBefore;
  const nativeRemoveChild = Node.prototype.removeChild;

  Node.prototype.insertBefore = function guardedInsertBefore<T extends Node>(
    newNode: T,
    referenceNode: Node | null,
  ): T {
    const parent = this as Node;
    Node.prototype.insertBefore = nativeInsertBefore;
    try {
      return safeInsertBefore(parent, newNode, referenceNode, (failure) =>
        recordGuardFailure({
          ...toGuardPayload(failure),
          parent: summarizeNode(parent),
          child: summarizeNode(newNode),
          reference: summarizeNode(referenceNode),
        }),
      );
    } finally {
      Node.prototype.insertBefore = guardedInsertBefore;
    }
  };

  Node.prototype.removeChild = function guardedRemoveChild<T extends Node>(child: T): T {
    const parent = this as Node;
    Node.prototype.removeChild = nativeRemoveChild;
    try {
      return safeRemoveChild(parent, child, (failure) =>
        recordGuardFailure({
          ...toGuardPayload(failure),
          parent: summarizeNode(parent),
          child: summarizeNode(child),
        }),
      );
    } finally {
      Node.prototype.removeChild = guardedRemoveChild;
    }
  };
}
