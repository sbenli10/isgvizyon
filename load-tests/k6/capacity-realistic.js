import encoding from "k6/encoding";
import http from "k6/http";
import { check, fail, sleep } from "k6";

const SUPABASE_URL = __ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY;
const TEST_EMAIL = __ENV.TEST_EMAIL;
const TEST_PASSWORD = __ENV.TEST_PASSWORD;

const TARGET_VUS = Number(__ENV.TARGET_VUS || 100);
const TEST_DURATION = __ENV.TEST_DURATION || "15m";
const ENDPOINTS = [
  "notifications",
  "inspections",
  "findings",
  "employees_page_active",
  "incident_reports",
  "health_surveillance_records_page",
  "periodic_controls_page",
  "ppe_inventory_page",
  "ppe_assignments_page",
  "osgb_personnel_page",
  "osgb_assignments_page",
  "osgb_tasks_page",
  "isgkatip_companies_page",
  "osgb_company_tracking_rpc",
];

function requireEnv(name, value) {
  if (!value) {
    fail(`Missing required env: ${name}`);
  }
}

function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length < 2) {
    fail("Invalid JWT token");
  }

  return JSON.parse(encoding.b64decode(parts[1], "rawurl", "s"));
}

function authHeaders(accessToken) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
  };
}

function get(path, accessToken, tags = {}) {
  return http.get(`${SUPABASE_URL}${path}`, {
    headers: authHeaders(accessToken),
    tags,
  });
}

function postRpc(fnName, payload, accessToken, tags = {}) {
  return http.post(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, JSON.stringify(payload), {
    headers: {
      ...authHeaders(accessToken),
      "Content-Type": "application/json",
      Prefer: "count=exact",
    },
    tags,
  });
}

function checkJson(res, label) {
  check(res, {
    [`${label} status ok`]: (r) => r.status >= 200 && r.status < 300,
    [`${label} returned json`]: (r) =>
      String(r.headers["Content-Type"] || "").toLowerCase().includes("application/json"),
  });
}

function randomThinkTime() {
  sleep(1 + Math.random() * 2);
}

function buildFindingsPath(orgId, accessToken) {
  const inspectionsRes = get(
    `/rest/v1/inspections?select=id&org_id=eq.${orgId}&order=created_at.desc&limit=10`,
    accessToken,
    { module: "capacity", query: "seed_inspections" },
  );

  if (inspectionsRes.status < 200 || inspectionsRes.status >= 300) {
    return null;
  }

  const rows = inspectionsRes.json();
  const ids = Array.isArray(rows) ? rows.map((row) => row.id).filter(Boolean) : [];
  if (ids.length === 0) return null;

  return `/rest/v1/findings?select=id,due_date,is_resolved,inspection_id&inspection_id=in.(${ids.join(",")})&limit=20`;
}

export const options = {
  scenarios: {
    realistic_capacity: {
      executor: "constant-vus",
      vus: TARGET_VUS,
      duration: TEST_DURATION,
      gracefulStop: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.03"],
    http_req_duration: ["p(95)<1500", "p(99)<3000"],
    ...Object.fromEntries(
      ENDPOINTS.map((endpoint) => [
        `http_req_duration{endpoint:${endpoint}}`,
        ["p(95)<1500", "p(99)<10000"],
      ]),
    ),
  },
};

export function setup() {
  requireEnv("SUPABASE_URL", SUPABASE_URL);
  requireEnv("SUPABASE_ANON_KEY", SUPABASE_ANON_KEY);
  requireEnv("TEST_EMAIL", TEST_EMAIL);
  requireEnv("TEST_PASSWORD", TEST_PASSWORD);

  const loginRes = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      tags: { endpoint: "auth-token" },
    },
  );

  const loginOk = check(loginRes, {
    "login succeeded": (r) => r.status === 200,
    "access token present": (r) => Boolean(r.json("access_token")),
  });

  if (!loginOk) {
    fail(`Login failed: ${loginRes.status} ${loginRes.body}`);
  }

  const accessToken = loginRes.json("access_token");
  const payload = decodeJwtPayload(accessToken);
  const userId = payload.sub;

  const profileRes = get(
    `/rest/v1/profiles?select=organization_id&id=eq.${userId}`,
    accessToken,
    { endpoint: "profile-bootstrap" },
  );

  const profileOk = check(profileRes, {
    "profile bootstrap succeeded": (r) => r.status === 200,
  });

  if (!profileOk) {
    fail(`Profile bootstrap failed: ${profileRes.status} ${profileRes.body}`);
  }

  const profileRows = profileRes.json();
  const orgId = Array.isArray(profileRows) ? profileRows[0]?.organization_id : null;

  return {
    accessToken,
    userId,
    orgId: orgId || userId,
  };
}

function runDashboardFlow(data) {
  const notificationsRes = get(
    "/rest/v1/notifications?select=id,is_read,priority,created_at&order=created_at.desc&limit=10",
    data.accessToken,
    { module: "capacity-dashboard", query: "notifications", endpoint: "notifications" },
  );
  checkJson(notificationsRes, "notifications");

  const inspectionsRes = get(
    `/rest/v1/inspections?select=id,location_name,risk_level,status,created_at,org_id&org_id=eq.${data.orgId}&order=created_at.desc&limit=20`,
    data.accessToken,
    { module: "capacity-dashboard", query: "inspections", endpoint: "inspections" },
  );
  checkJson(inspectionsRes, "inspections");

  const findingsPath = buildFindingsPath(data.orgId, data.accessToken);
  if (findingsPath) {
    const findingsRes = get(findingsPath, data.accessToken, {
      module: "capacity-dashboard",
      query: "findings",
      endpoint: "findings",
    });
    checkJson(findingsRes, "findings");
  }
}

function runCoreFlow(data) {
  const flows = [
    {
      label: "employees_page_active",
      path: "/rest/v1/employees?select=id,company_id,first_name,last_name,is_active&is_active=eq.true&order=first_name.asc&limit=10",
    },
    {
      label: "incident_reports",
      path: "/rest/v1/incident_reports?select=id,company_id,status,severity,incident_date,updated_at&order=updated_at.desc&limit=25",
    },
    {
      label: "health_surveillance_records_page",
      path: "/rest/v1/health_surveillance_records?select=id,employee_id,company_id,status,exam_date,next_exam_date&order=next_exam_date.asc&limit=10",
    },
    {
      label: "periodic_controls_page",
      path: "/rest/v1/periodic_controls?select=id,company_id,equipment_name,status,next_control_date&order=next_control_date.asc&limit=10",
    },
    {
      label: "ppe_inventory_page",
      path: "/rest/v1/ppe_inventory?select=id,item_name,category,stock_quantity,is_active&order=updated_at.desc&limit=10",
    },
    {
      label: "ppe_assignments_page",
      path: "/rest/v1/ppe_assignments?select=id,inventory_id,employee_id,status,due_date&order=due_date.asc&limit=10",
    },
  ];

  const flow = flows[__ITER % flows.length];
  const res = get(flow.path, data.accessToken, {
    module: "capacity-core",
    query: flow.label,
    endpoint: flow.label,
  });
  checkJson(res, flow.label);
}

function runOsgbFlow(data) {
  const flows = [
    {
      label: "osgb_personnel_page",
      path: "/rest/v1/osgb_personnel?select=id,full_name,role,is_active&is_active=eq.true&order=full_name.asc&limit=10",
    },
    {
      label: "osgb_assignments_page",
      path: "/rest/v1/osgb_assignments?select=id,company_id,personnel_id,status,assigned_minutes&order=created_at.desc&limit=10",
    },
    {
      label: "osgb_tasks_page",
      path: "/rest/v1/osgb_tasks?select=id,company_id,title,status,priority,due_date&order=created_at.desc&limit=10",
    },
    {
      label: "isgkatip_companies_page",
      path: "/rest/v1/isgkatip_companies?select=id,company_name,employee_count,compliance_status&is_deleted=eq.false&order=company_name.asc&limit=10",
    },
    {
      label: "osgb_company_tracking_rpc",
      rpc: true,
      fnName: "get_osgb_company_tracking_page",
      payload: {
        p_org_id: data.orgId,
        p_page: 1,
        p_page_size: 10,
        p_search: null,
        p_assignment_status: null,
      },
    },
  ];

  const flow = flows[__ITER % flows.length];
  const res = flow.rpc
    ? postRpc(flow.fnName, flow.payload, data.accessToken, {
        module: "capacity-osgb",
        query: flow.label,
        endpoint: flow.label,
      })
    : get(flow.path, data.accessToken, {
        module: "capacity-osgb",
        query: flow.label,
        endpoint: flow.label,
      });
  checkJson(res, flow.label);
}

export default function (data) {
  const roll = Math.random();

  if (roll < 0.25) {
    runDashboardFlow(data);
  } else if (roll < 0.6) {
    runCoreFlow(data);
  } else {
    runOsgbFlow(data);
  }

  randomThinkTime();
}
