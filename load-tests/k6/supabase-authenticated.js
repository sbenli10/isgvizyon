import encoding from "k6/encoding";
import http from "k6/http";
import { check, fail, sleep } from "k6";

const SUPABASE_URL = __ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY;
const TEST_EMAIL = __ENV.TEST_EMAIL;
const TEST_PASSWORD = __ENV.TEST_PASSWORD;

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

export const options = {
  scenarios: {
    dashboard_reads: {
      executor: "ramping-arrival-rate",
      exec: "dashboardReads",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 10,
      maxVUs: 40,
      stages: [
        { target: 3, duration: "1m" },
        { target: 6, duration: "2m" },
        { target: 8, duration: "2m" },
        { target: 0, duration: "1m" },
      ],
    },
    core_module_reads: {
      executor: "ramping-arrival-rate",
      exec: "coreModuleReads",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 12,
      maxVUs: 50,
      stages: [
        { target: 4, duration: "1m" },
        { target: 8, duration: "2m" },
        { target: 12, duration: "2m" },
        { target: 0, duration: "1m" },
      ],
    },
    osgb_reads: {
      executor: "ramping-arrival-rate",
      exec: "osgbReads",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 8,
      maxVUs: 30,
      stages: [
        { target: 2, duration: "1m" },
        { target: 4, duration: "2m" },
        { target: 6, duration: "2m" },
        { target: 0, duration: "1m" },
      ],
    },
    core_module_reads_phase2: {
      executor: "ramping-arrival-rate",
      exec: "coreModuleReads",
      startRate: 2,
      timeUnit: "1s",
      preAllocatedVUs: 20,
      maxVUs: 80,
      stages: [
        { target: 6, duration: "1m" },
        { target: 12, duration: "2m" },
        { target: 18, duration: "2m" },
        { target: 0, duration: "1m" },
      ],
    },
    osgb_reads_phase2: {
      executor: "ramping-arrival-rate",
      exec: "osgbReads",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 12,
      maxVUs: 50,
      stages: [
        { target: 4, duration: "1m" },
        { target: 8, duration: "2m" },
        { target: 10, duration: "2m" },
        { target: 0, duration: "1m" },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<800", "p(99)<1500"],
    "http_req_duration{scenario:dashboard_reads}": ["p(95)<600"],
    "http_req_duration{scenario:core_module_reads}": ["p(95)<1000"],
    "http_req_duration{scenario:osgb_reads}": ["p(95)<1200"],
    "http_req_duration{scenario:core_module_reads_phase2}": ["p(95)<1200"],
    "http_req_duration{scenario:osgb_reads_phase2}": ["p(95)<1500"],
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

function checkJson(res, label) {
  check(res, {
    [`${label} status ok`]: (r) => r.status >= 200 && r.status < 300,
    [`${label} returned json`]: (r) =>
      String(r.headers["Content-Type"] || "").toLowerCase().includes("application/json"),
  });
}

export function dashboardReads(data) {
  const notificationsRes = get(
    "/rest/v1/notifications?select=id,is_read,priority,created_at&order=created_at.desc&limit=10",
    data.accessToken,
    { module: "dashboard", query: "notifications" },
  );
  checkJson(notificationsRes, "notifications");

  const inspectionsRes = get(
    `/rest/v1/inspections?select=id,location_name,risk_level,status,created_at,org_id&org_id=eq.${data.orgId}&order=created_at.desc`,
    data.accessToken,
    { module: "dashboard", query: "inspections" },
  );
  checkJson(inspectionsRes, "inspections");

  if (inspectionsRes.status >= 200 && inspectionsRes.status < 300) {
    const inspections = inspectionsRes.json();
    const inspectionIds = Array.isArray(inspections)
      ? inspections.map((inspection) => inspection.id).filter(Boolean)
      : [];

    if (inspectionIds.length > 0) {
      const findingsRes = get(
        `/rest/v1/findings?select=id,due_date,is_resolved,inspection_id&inspection_id=in.(${inspectionIds.join(",")})`,
        data.accessToken,
        { module: "dashboard", query: "findings" },
      );
      checkJson(findingsRes, "findings");
    }
  }

  sleep(1);
}

export function coreModuleReads(data) {
  const screens = [
    {
      label: "employees_page_active",
      path: "/rest/v1/employees?select=id,company_id,first_name,last_name,is_active&is_active=eq.true&order=first_name.asc&limit=10",
    },
    {
      label: "ppe_inventory_page",
      path: "/rest/v1/ppe_inventory?select=id,item_name,category,stock_quantity,is_active&order=updated_at.desc&limit=10",
    },
    {
      label: "ppe_assignments_page",
      path: "/rest/v1/ppe_assignments?select=id,inventory_id,employee_id,status,due_date&order=due_date.asc&limit=10",
    },
    {
      label: "periodic_controls_page",
      path: "/rest/v1/periodic_controls?select=id,company_id,equipment_name,status,next_control_date&order=next_control_date.asc&limit=10",
    },
    {
      label: "health_surveillance_records_page",
      path: "/rest/v1/health_surveillance_records?select=id,employee_id,company_id,status,exam_date,next_exam_date&order=next_exam_date.asc&limit=10",
    },
    {
      label: "incident_reports",
      path: "/rest/v1/incident_reports?select=id,company_id,status,severity,incident_date,updated_at&order=updated_at.desc&limit=25",
    },
  ];

  const screen = screens[__ITER % screens.length];
  const response = get(screen.path, data.accessToken, {
    module: "core",
    query: screen.label,
  });
  checkJson(response, screen.label);

  sleep(1);
}

export function osgbReads(data) {
  const screens = [
    {
      type: "rest",
      label: "isgkatip_companies_page",
      path: "/rest/v1/isgkatip_companies?select=id,company_name,employee_count,compliance_status&is_deleted=eq.false&order=company_name.asc&limit=10",
    },
    {
      type: "rest",
      label: "osgb_personnel_page",
      path: "/rest/v1/osgb_personnel?select=id,full_name,role,is_active&is_active=eq.true&order=full_name.asc&limit=10",
    },
    {
      type: "rest",
      label: "osgb_assignments_page",
      path: "/rest/v1/osgb_assignments?select=id,company_id,personnel_id,status,assigned_minutes&order=created_at.desc&limit=10",
    },
    {
      type: "rest",
      label: "osgb_tasks_page",
      path: "/rest/v1/osgb_tasks?select=id,company_id,title,status,priority,due_date&order=created_at.desc&limit=10",
    },
    {
      type: "rpc",
      label: "osgb_company_tracking_rpc",
    },
  ];

  const screen = screens[__ITER % screens.length];

  if (screen.type === "rpc") {
    const trackingRes = postRpc(
      "get_osgb_company_tracking_page",
      {
        p_org_id: data.orgId,
        p_page: 1,
        p_page_size: 10,
        p_search: null,
        p_assignment_status: null,
      },
      data.accessToken,
      { module: "osgb", query: screen.label },
    );
    checkJson(trackingRes, screen.label);
  } else {
    const response = get(screen.path, data.accessToken, {
      module: "osgb",
      query: screen.label,
    });
    checkJson(response, screen.label);
  }

  sleep(1);
}
