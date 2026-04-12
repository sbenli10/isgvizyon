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

function buildPersonnelPath(params = {}) {
  const queryParts = [
    `select=${encodeURIComponent("id,full_name,role,certificate_no,certificate_expiry_date,expertise_areas,phone,email,monthly_capacity_minutes,is_active,notes")}`,
    `order=${encodeURIComponent("full_name.asc")}`,
    "limit=20",
  ];

  if (params.role) {
    queryParts.push(`role=${encodeURIComponent(`eq.${params.role}`)}`);
  }

  if (params.status) {
    queryParts.push(`is_active=${encodeURIComponent(`eq.${params.status}`)}`);
  }

  if (params.search) {
    const term = params.search;
    const orFilter = [
      `full_name.ilike.%${term}%`,
      `email.ilike.%${term}%`,
      `phone.ilike.%${term}%`,
      `certificate_no.ilike.%${term}%`,
    ].join(",");
    queryParts.push(`or=${encodeURIComponent(`(${orFilter})`)}`);
  }

  return `/rest/v1/osgb_personnel?${queryParts.join("&")}`;
}

function buildAssignmentsByPersonnelPath(personnelIds) {
  const queryParts = [
    `select=${encodeURIComponent("personnel_id,assigned_minutes")}`,
    `status=${encodeURIComponent("eq.active")}`,
  ];

  if (personnelIds.length > 0) {
    queryParts.push(`personnel_id=${encodeURIComponent(`in.(${personnelIds.join(",")})`)}`);
  }

  return `/rest/v1/osgb_assignments?${queryParts.join("&")}`;
}

export const options = {
  scenarios: {
    personnel_page_reads: {
      executor: "ramping-arrival-rate",
      exec: "personnelPageReads",
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
    personnel_filtered_reads: {
      executor: "ramping-arrival-rate",
      exec: "personnelFilteredReads",
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
    personnel_load_summary_reads: {
      executor: "ramping-arrival-rate",
      exec: "personnelLoadSummaryReads",
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
    "http_req_duration{scenario:personnel_page_reads}": ["p(95)<600"],
    "http_req_duration{scenario:personnel_filtered_reads}": ["p(95)<700"],
    "http_req_duration{scenario:personnel_load_summary_reads}": ["p(95)<800"],
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

export function personnelPageReads(data) {
  const response = get(buildPersonnelPath(), data.accessToken, {
    module: "osgb-personnel",
    query: "osgb_personnel_page",
  });
  checkJson(response, "osgb_personnel_page");

  sleep(1);
}

export function personnelFilteredReads(data) {
  const paths = [
    buildPersonnelPath({ role: "igu" }),
    buildPersonnelPath({ status: true }),
    buildPersonnelPath({ search: "hekim" }),
  ];

  const path = paths[__ITER % paths.length];
  const response = get(path, data.accessToken, {
    module: "osgb-personnel",
    query: "osgb_personnel_filtered",
  });
  checkJson(response, "osgb_personnel_filtered");

  sleep(1);
}

export function personnelLoadSummaryReads(data) {
  const personnelRes = get(buildPersonnelPath(), data.accessToken, {
    module: "osgb-personnel",
    query: "osgb_personnel_seed",
  });
  checkJson(personnelRes, "osgb_personnel_seed");

  if (personnelRes.status < 200 || personnelRes.status >= 300) {
    sleep(1);
    return;
  }

  const rows = Array.isArray(personnelRes.json()) ? personnelRes.json() : [];
  const personnelIds = rows.map((row) => row.id).filter(Boolean);

  const assignmentsRes = get(
    buildAssignmentsByPersonnelPath(personnelIds),
    data.accessToken,
    {
      module: "osgb-personnel",
      query: "osgb_personnel_assignment_summary",
    },
  );
  checkJson(assignmentsRes, "osgb_personnel_assignment_summary");

  sleep(1);
}
