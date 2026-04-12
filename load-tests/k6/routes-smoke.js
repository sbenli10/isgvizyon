import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:4173";

const ROUTES = [
  "/auth",
  "/auth/login",
  "/auth/callback",
  "/",
  "/companies",
  "/assignment-letters",
  "/notifications",
  "/email-history",
  "/risk-assessments",
  "/risk-wizard",
  "/risk-editor",
  "/isg-bot",
  "/isg-bot-deleted",
  "/isg-bot/chat",
  "/docs/isg-bot-setup",
  "/findings",
  "/employees",
  "/ppe-management",
  "/periodic-controls",
  "/periodic-controls/guide",
  "/health-surveillance",
  "/incidents",
  "/inspections",
  "/form-builder",
  "/reports",
  "/capa",
  "/bulk-capa",
  "/bulk-capa/how-to",
  "/board-meetings",
  "/board-meetings/new",
  "/board-meetings/guide",
  "/adep-wizard",
  "/adep-plans",
  "/adep-list",
  "/adep-plans/new",
  "/annual-plans",
  "/blueprint-analyzer",
  "/blueprint-analyzer/how-to",
  "/evacuation-editor",
  "/evacuation-editor/history",
  "/safety-library",
  "/safety-library/guide",
  "/nace-query",
  "/nace-query/sectors",
  "/osgb",
  "/osgb/dashboard",
  "/osgb/personnel",
  "/osgb/assignments",
  "/osgb/company-tracking",
  "/osgb/capacity",
  "/osgb/alerts",
  "/osgb/finance",
  "/osgb/documents",
  "/osgb/tasks",
  "/osgb/notes",
  "/osgb/analytics",
  "/dashboard/certificates",
  "/dashboard/certificates/history",
  "/dashboard/certificate-studio",
  "/dashboard/profil",
  "/profile",
  "/settings",
];

export const options = {
  scenarios: {
    shell_routes: {
      executor: "ramping-arrival-rate",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 20,
      maxVUs: 100,
      stages: [
        { target: 5, duration: "30s" },
        { target: 20, duration: "1m" },
        { target: 40, duration: "1m" },
        { target: 0, duration: "30s" },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1200", "p(99)<2500"],
  },
};

export default function () {
  const route = ROUTES[Math.floor(Math.random() * ROUTES.length)];
  const res = http.get(`${BASE_URL}${route}`, {
    tags: { route_type: "spa-shell", route },
  });

  check(res, {
    "shell route status is acceptable": (r) => r.status >= 200 && r.status < 400,
    "shell route returned html": (r) =>
      String(r.headers["Content-Type"] || "").toLowerCase().includes("text/html"),
  });

  sleep(1);
}
