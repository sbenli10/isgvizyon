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

function buildIncidentReportsPath(params = {}) {
  const queryParts = [
    `select=${encodeURIComponent("id,company_id,incident_type,title,incident_date,severity,status,company:isgkatip_companies(company_name)")}`,
    `order=${encodeURIComponent("incident_date.desc")}`,
    "limit=20",
  ];

  if (params.type) {
    queryParts.push(`incident_type=${encodeURIComponent(`eq.${params.type}`)}`);
  }

  if (params.status) {
    queryParts.push(`status=${encodeURIComponent(`eq.${params.status}`)}`);
  }

  if (params.search) {
    const term = params.search;
    const orFilter = [
      `title.ilike.%${term}%`,
      `description.ilike.%${term}%`,
      `location.ilike.%${term}%`,
      `affected_person.ilike.%${term}%`,
      `reported_by.ilike.%${term}%`,
    ].join(",");
    queryParts.push(`or=${encodeURIComponent(`(${orFilter})`)}`);
  }

  return `/rest/v1/incident_reports?${queryParts.join("&")}`;
}

function checkJson(res, label) {
  check(res, {
    [`${label} status ok`]: (r) => r.status >= 200 && r.status < 300,
    [`${label} returned json`]: (r) =>
      String(r.headers["Content-Type"] || "").toLowerCase().includes("application/json"),
  });
}

export const options = {
  scenarios: {
    incident_page_reads: {
      executor: "ramping-arrival-rate",
      exec: "incidentPageReads",
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
    incident_filtered_reads: {
      executor: "ramping-arrival-rate",
      exec: "incidentFilteredReads",
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
    incident_detail_reads: {
      executor: "ramping-arrival-rate",
      exec: "incidentDetailReads",
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
    "http_req_duration{scenario:incident_page_reads}": ["p(95)<600"],
    "http_req_duration{scenario:incident_filtered_reads}": ["p(95)<700"],
    "http_req_duration{scenario:incident_detail_reads}": ["p(95)<800"],
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

export function incidentPageReads(data) {
  const companiesRes = get(
    "/rest/v1/isgkatip_companies?select=id,company_name,hazard_class,contract_end,employee_count,required_minutes,assigned_minutes&is_deleted=eq.false&order=company_name.asc&limit=100",
    data.accessToken,
    { module: "incident", query: "incident_company_options" },
  );
  checkJson(companiesRes, "incident_company_options");

  const incidentsRes = get(
    "/rest/v1/incident_reports?select=id,company_id,incident_type,title,description,incident_date,location,affected_person,severity,status,requires_notification,lost_time_days,company:isgkatip_companies(company_name)&order=incident_date.desc&limit=20",
    data.accessToken,
    { module: "incident", query: "incident_reports_page" },
  );
  checkJson(incidentsRes, "incident_reports_page");

  sleep(1);
}

export function incidentFilteredReads(data) {
  const paths = [
    buildIncidentReportsPath({ type: "work_accident" }),
    buildIncidentReportsPath({ status: "open" }),
    buildIncidentReportsPath({ search: "kaza" }),
  ];

  const path = paths[__ITER % paths.length];
  const response = get(path, data.accessToken, {
    module: "incident",
    query: "incident_reports_filtered",
  });
  checkJson(response, "incident_reports_filtered");

  sleep(1);
}

export function incidentDetailReads(data) {
  const incidentsRes = get(
    "/rest/v1/incident_reports?select=id,title,incident_date&order=incident_date.desc&limit=20",
    data.accessToken,
    { module: "incident", query: "incident_reports_detail_seed" },
  );
  checkJson(incidentsRes, "incident_reports_detail_seed");

  if (incidentsRes.status < 200 || incidentsRes.status >= 300) {
    sleep(1);
    return;
  }

  const incidents = incidentsRes.json();
  const rows = Array.isArray(incidents) ? incidents : [];
  const record = rows.length > 0 ? rows[__ITER % rows.length] : null;

  if (!record?.id) {
    sleep(1);
    return;
  }

  const attachmentsRes = get(
    `/rest/v1/incident_attachments?select=id,report_id,file_name,file_size,mime_type,created_at&report_id=eq.${record.id}&order=created_at.desc`,
    data.accessToken,
    { module: "incident", query: "incident_attachments" },
  );
  checkJson(attachmentsRes, "incident_attachments");

  const actionsRes = get(
    `/rest/v1/incident_actions?select=id,report_id,action_title,owner_name,due_date,status,notes,created_at,updated_at&report_id=eq.${record.id}&order=created_at.desc`,
    data.accessToken,
    { module: "incident", query: "incident_actions" },
  );
  checkJson(actionsRes, "incident_actions");

  sleep(1);
}
