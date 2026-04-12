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

function checkJson(res, label) {
  check(res, {
    [`${label} status ok`]: (r) => r.status >= 200 && r.status < 300,
    [`${label} returned json`]: (r) =>
      String(r.headers["Content-Type"] || "").toLowerCase().includes("application/json"),
  });
}

function buildDashboardCompaniesPath() {
  return `/rest/v1/isgkatip_companies?select=${encodeURIComponent("id,employee_count,assigned_minutes,required_minutes,compliance_status,risk_score,contract_end,assigned_person_name,last_synced_at")}&is_deleted=eq.false&order=${encodeURIComponent("risk_score.desc")}&limit=100`;
}

function buildDashboardFlagsPath() {
  return `/rest/v1/isgkatip_compliance_flags?select=${encodeURIComponent("created_at")}&status=eq.OPEN&order=${encodeURIComponent("created_at.desc")}&limit=100`;
}

function buildDashboardAlertsPath() {
  return `/rest/v1/isgkatip_predictive_alerts?select=${encodeURIComponent("created_at")}&status=eq.OPEN&order=${encodeURIComponent("created_at.desc")}&limit=100`;
}

function buildDashboardFinancePath() {
  return `/rest/v1/osgb_finance?select=${encodeURIComponent("due_date,invoice_date,amount,status")}&order=${encodeURIComponent("created_at.desc")}&limit=250`;
}

function buildDashboardDocumentsPath() {
  return `/rest/v1/osgb_document_tracking?select=${encodeURIComponent("expiry_date,created_at,status")}&order=${encodeURIComponent("created_at.desc")}&limit=250`;
}

export const options = {
  scenarios: {
    dashboard_catalog_reads: {
      executor: "ramping-arrival-rate",
      exec: "dashboardCatalogReads",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 5,
      maxVUs: 20,
      stages: [
        { target: 2, duration: "1m" },
        { target: 4, duration: "2m" },
        { target: 6, duration: "2m" },
        { target: 0, duration: "1m" },
      ],
    },
    dashboard_refresh_reads: {
      executor: "ramping-arrival-rate",
      exec: "dashboardRefreshReads",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 5,
      maxVUs: 20,
      stages: [
        { target: 2, duration: "1m" },
        { target: 4, duration: "2m" },
        { target: 6, duration: "2m" },
        { target: 0, duration: "1m" },
      ],
    },
    dashboard_operational_reads: {
      executor: "ramping-arrival-rate",
      exec: "dashboardOperationalReads",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 5,
      maxVUs: 20,
      stages: [
        { target: 1, duration: "1m" },
        { target: 2, duration: "2m" },
        { target: 3, duration: "2m" },
        { target: 0, duration: "1m" },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<700", "p(99)<1200"],
    "http_req_duration{scenario:dashboard_catalog_reads}": ["p(95)<600"],
    "http_req_duration{scenario:dashboard_refresh_reads}": ["p(95)<700"],
    "http_req_duration{scenario:dashboard_operational_reads}": ["p(95)<800"],
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

  return {
    accessToken,
    userId: payload.sub,
  };
}

export function dashboardCatalogReads(data) {
  const companiesRes = get(buildDashboardCompaniesPath(), data.accessToken, {
    module: "osgb-dashboard",
    query: "osgb_dashboard_companies_snapshot",
  });
  checkJson(companiesRes, "osgb_dashboard_companies_snapshot");

  const flagsRes = get(buildDashboardFlagsPath(), data.accessToken, {
    module: "osgb-dashboard",
    query: "osgb_dashboard_flags_snapshot",
  });
  checkJson(flagsRes, "osgb_dashboard_flags_snapshot");

  const alertsRes = get(buildDashboardAlertsPath(), data.accessToken, {
    module: "osgb-dashboard",
    query: "osgb_dashboard_alerts_snapshot",
  });
  checkJson(alertsRes, "osgb_dashboard_alerts_snapshot");

  sleep(1);
}

export function dashboardRefreshReads(data) {
  const responses = [
    get(buildDashboardCompaniesPath(), data.accessToken, {
      module: "osgb-dashboard",
      query: "osgb_dashboard_refresh_companies",
    }),
    get(buildDashboardFlagsPath(), data.accessToken, {
      module: "osgb-dashboard",
      query: "osgb_dashboard_refresh_flags",
    }),
    get(buildDashboardAlertsPath(), data.accessToken, {
      module: "osgb-dashboard",
      query: "osgb_dashboard_refresh_alerts",
    }),
    get(buildDashboardFinancePath(), data.accessToken, {
      module: "osgb-dashboard",
      query: "osgb_dashboard_refresh_finance",
    }),
    get(buildDashboardDocumentsPath(), data.accessToken, {
      module: "osgb-dashboard",
      query: "osgb_dashboard_refresh_documents",
    }),
  ];

  checkJson(responses[0], "osgb_dashboard_refresh_companies");
  checkJson(responses[1], "osgb_dashboard_refresh_flags");
  checkJson(responses[2], "osgb_dashboard_refresh_alerts");
  checkJson(responses[3], "osgb_dashboard_refresh_finance");
  checkJson(responses[4], "osgb_dashboard_refresh_documents");

  sleep(1);
}

export function dashboardOperationalReads(data) {
  const financeRes = get(buildDashboardFinancePath(), data.accessToken, {
    module: "osgb-dashboard",
    query: "osgb_dashboard_finance_snapshot",
  });
  checkJson(financeRes, "osgb_dashboard_finance_snapshot");

  const documentsRes = get(buildDashboardDocumentsPath(), data.accessToken, {
    module: "osgb-dashboard",
    query: "osgb_dashboard_documents_snapshot",
  });
  checkJson(documentsRes, "osgb_dashboard_documents_snapshot");

  sleep(1);
}
