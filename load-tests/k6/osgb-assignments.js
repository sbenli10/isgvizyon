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

function buildAssignmentsPath(params = {}) {
  const queryParts = [
    `select=${encodeURIComponent("id,company_id,personnel_id,assigned_role,assigned_minutes,start_date,end_date,status,notes,created_at,company:isgkatip_companies(company_name),personnel:osgb_personnel(full_name,role)")}`,
    `order=${encodeURIComponent("created_at.desc")}`,
    "limit=20",
  ];

  if (params.status) {
    queryParts.push(`status=${encodeURIComponent(`eq.${params.status}`)}`);
  }

  if (params.search) {
    const term = params.search.replace(/,/g, " ");
    const orFilter = [
      `notes.ilike.%${term}%`,
      `assigned_role.ilike.%${term}%`,
    ].join(",");
    queryParts.push(`or=${encodeURIComponent(`(${orFilter})`)}`);
  }

  return `/rest/v1/osgb_assignments?${queryParts.join("&")}`;
}

function buildCompanySearchPath(term) {
  return `/rest/v1/isgkatip_companies?select=${encodeURIComponent("id")}&is_deleted=eq.false&company_name=${encodeURIComponent(`ilike.%${term}%`)}&limit=20`;
}

function buildPersonnelSearchPath(term) {
  return `/rest/v1/osgb_personnel?select=${encodeURIComponent("id")}&full_name=${encodeURIComponent(`ilike.%${term}%`)}&limit=20`;
}

function buildActivePersonnelPath() {
  return `/rest/v1/osgb_personnel?select=${encodeURIComponent("id,full_name,role,monthly_capacity_minutes,is_active")}&is_active=eq.true&order=${encodeURIComponent("full_name.asc")}&limit=20`;
}

function buildCompanyOptionsPath() {
  return `/rest/v1/isgkatip_companies?select=${encodeURIComponent("id,company_name,hazard_class,contract_end,employee_count,required_minutes,assigned_minutes")}&is_deleted=eq.false&order=${encodeURIComponent("company_name.asc")}&limit=100`;
}

function buildAssignmentsByPersonnelPath(personnelId, excludeId = null) {
  const queryParts = [
    `select=${encodeURIComponent("assigned_minutes")}`,
    `personnel_id=${encodeURIComponent(`eq.${personnelId}`)}`,
    `status=${encodeURIComponent("eq.active")}`,
  ];

  if (excludeId) {
    queryParts.push(`id=${encodeURIComponent(`neq.${excludeId}`)}`);
  }

  return `/rest/v1/osgb_assignments?${queryParts.join("&")}`;
}

function buildAssignmentsByCompanyPath(companyId, excludeId = null) {
  const queryParts = [
    `select=${encodeURIComponent("assigned_minutes")}`,
    `company_id=${encodeURIComponent(`eq.${companyId}`)}`,
    `status=${encodeURIComponent("eq.active")}`,
  ];

  if (excludeId) {
    queryParts.push(`id=${encodeURIComponent(`neq.${excludeId}`)}`);
  }

  return `/rest/v1/osgb_assignments?${queryParts.join("&")}`;
}

export const options = {
  scenarios: {
    assignment_page_reads: {
      executor: "ramping-arrival-rate",
      exec: "assignmentPageReads",
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
    assignment_filtered_reads: {
      executor: "ramping-arrival-rate",
      exec: "assignmentFilteredReads",
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
    assignment_form_helper_reads: {
      executor: "ramping-arrival-rate",
      exec: "assignmentFormHelperReads",
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
    "http_req_duration{scenario:assignment_page_reads}": ["p(95)<600"],
    "http_req_duration{scenario:assignment_filtered_reads}": ["p(95)<700"],
    "http_req_duration{scenario:assignment_form_helper_reads}": ["p(95)<800"],
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

export function assignmentPageReads(data) {
  const assignmentsRes = get(buildAssignmentsPath(), data.accessToken, {
    module: "osgb-assignments",
    query: "osgb_assignments_page",
  });
  checkJson(assignmentsRes, "osgb_assignments_page");

  const companiesRes = get(buildCompanyOptionsPath(), data.accessToken, {
    module: "osgb-assignments",
    query: "osgb_assignments_company_options",
  });
  checkJson(companiesRes, "osgb_assignments_company_options");

  sleep(1);
}

export function assignmentFilteredReads(data) {
  const mode = __ITER % 3;

  if (mode === 0) {
    const response = get(buildAssignmentsPath({ status: "active" }), data.accessToken, {
      module: "osgb-assignments",
      query: "osgb_assignments_filtered",
    });
    checkJson(response, "osgb_assignments_filtered");
    sleep(1);
    return;
  }

  if (mode === 1) {
    const term = "igu";
    const response = get(buildAssignmentsPath({ search: term }), data.accessToken, {
      module: "osgb-assignments",
      query: "osgb_assignments_filtered",
    });
    checkJson(response, "osgb_assignments_filtered");
    sleep(1);
    return;
  }

  const searchTerm = "a";
  const companySearchRes = get(buildCompanySearchPath(searchTerm), data.accessToken, {
    module: "osgb-assignments",
    query: "osgb_assignments_company_search_seed",
  });
  checkJson(companySearchRes, "osgb_assignments_company_search_seed");

  const personnelSearchRes = get(buildPersonnelSearchPath(searchTerm), data.accessToken, {
    module: "osgb-assignments",
    query: "osgb_assignments_personnel_search_seed",
  });
  checkJson(personnelSearchRes, "osgb_assignments_personnel_search_seed");

  sleep(1);
}

export function assignmentFormHelperReads(data) {
  const personnelRes = get(buildActivePersonnelPath(), data.accessToken, {
    module: "osgb-assignments",
    query: "osgb_assignments_personnel_options",
  });
  checkJson(personnelRes, "osgb_assignments_personnel_options");

  const companiesRes = get(buildCompanyOptionsPath(), data.accessToken, {
    module: "osgb-assignments",
    query: "osgb_assignments_form_company_options",
  });
  checkJson(companiesRes, "osgb_assignments_form_company_options");

  if (personnelRes.status < 200 || personnelRes.status >= 300 || companiesRes.status < 200 || companiesRes.status >= 300) {
    sleep(1);
    return;
  }

  const personnelRows = Array.isArray(personnelRes.json()) ? personnelRes.json() : [];
  const companyRows = Array.isArray(companiesRes.json()) ? companiesRes.json() : [];
  const selectedPersonnel = personnelRows.length > 0 ? personnelRows[__ITER % personnelRows.length] : null;
  const selectedCompany = companyRows.length > 0 ? companyRows[__ITER % companyRows.length] : null;

  if (!selectedPersonnel?.id || !selectedCompany?.id) {
    sleep(1);
    return;
  }

  const personnelLoadRes = get(
    buildAssignmentsByPersonnelPath(selectedPersonnel.id),
    data.accessToken,
    {
      module: "osgb-assignments",
      query: "osgb_assignments_personnel_load_total",
    },
  );
  checkJson(personnelLoadRes, "osgb_assignments_personnel_load_total");

  const companyLoadRes = get(
    buildAssignmentsByCompanyPath(selectedCompany.id),
    data.accessToken,
    {
      module: "osgb-assignments",
      query: "osgb_assignments_company_load_total",
    },
  );
  checkJson(companyLoadRes, "osgb_assignments_company_load_total");

  sleep(1);
}
