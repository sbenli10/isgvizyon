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

function buildFinancePagePath(params = {}) {
  const queryParts = [
    `select=${encodeURIComponent("id,company_id,invoice_no,service_period,invoice_date,due_date,amount,currency,status,paid_at,payment_note,company:isgkatip_companies(company_name)")}`,
    `order=${encodeURIComponent("created_at.desc")}`,
    "limit=20",
  ];

  if (params.status) {
    queryParts.push(`status=${encodeURIComponent(`eq.${params.status}`)}`);
  }

  if (params.companyId) {
    queryParts.push(`company_id=${encodeURIComponent(`eq.${params.companyId}`)}`);
  }

  if (params.search) {
    const term = params.search.replace(/,/g, " ");
    const orFilter = [
      `invoice_no.ilike.%${term}%`,
      `service_period.ilike.%${term}%`,
      `payment_note.ilike.%${term}%`,
    ].join(",");
    queryParts.push(`or=${encodeURIComponent(`(${orFilter})`)}`);
  }

  return `/rest/v1/osgb_finance?${queryParts.join("&")}`;
}

function buildFinanceOverviewPath() {
  return `/rest/v1/osgb_finance?select=${encodeURIComponent("id,due_date,invoice_date,amount,status,currency,invoice_no,service_period,company:isgkatip_companies(company_name)")}&order=${encodeURIComponent("created_at.desc")}&limit=250`;
}

function buildCompanyOptionsPath() {
  return `/rest/v1/isgkatip_companies?select=${encodeURIComponent("id,company_name,hazard_class,contract_end,employee_count,required_minutes,assigned_minutes")}&is_deleted=eq.false&order=${encodeURIComponent("company_name.asc")}&limit=100`;
}

function buildCompanySearchPath(term) {
  return `/rest/v1/isgkatip_companies?select=${encodeURIComponent("id")}&is_deleted=eq.false&company_name=${encodeURIComponent(`ilike.%${term}%`)}&limit=20`;
}

export const options = {
  scenarios: {
    finance_page_reads: {
      executor: "ramping-arrival-rate",
      exec: "financePageReads",
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
    finance_filtered_reads: {
      executor: "ramping-arrival-rate",
      exec: "financeFilteredReads",
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
    finance_calendar_reads: {
      executor: "ramping-arrival-rate",
      exec: "financeCalendarReads",
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
    "http_req_duration{scenario:finance_page_reads}": ["p(95)<600"],
    "http_req_duration{scenario:finance_filtered_reads}": ["p(95)<700"],
    "http_req_duration{scenario:finance_calendar_reads}": ["p(95)<800"],
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

export function financePageReads(data) {
  const pageRes = get(buildFinancePagePath(), data.accessToken, {
    module: "osgb-finance",
    query: "osgb_finance_page",
  });
  checkJson(pageRes, "osgb_finance_page");

  const companyRes = get(buildCompanyOptionsPath(), data.accessToken, {
    module: "osgb-finance",
    query: "osgb_finance_company_options",
  });
  checkJson(companyRes, "osgb_finance_company_options");

  const overviewRes = get(buildFinanceOverviewPath(), data.accessToken, {
    module: "osgb-finance",
    query: "osgb_finance_overview",
  });
  checkJson(overviewRes, "osgb_finance_overview");

  sleep(1);
}

export function financeFilteredReads(data) {
  const mode = __ITER % 3;

  if (mode === 0) {
    const response = get(buildFinancePagePath({ status: "overdue" }), data.accessToken, {
      module: "osgb-finance",
      query: "osgb_finance_filtered",
    });
    checkJson(response, "osgb_finance_filtered");
    sleep(1);
    return;
  }

  if (mode === 1) {
    const response = get(buildFinancePagePath({ search: "2026" }), data.accessToken, {
      module: "osgb-finance",
      query: "osgb_finance_filtered",
    });
    checkJson(response, "osgb_finance_filtered");
    sleep(1);
    return;
  }

  const companySeedRes = get(buildCompanySearchPath("a"), data.accessToken, {
    module: "osgb-finance",
    query: "osgb_finance_company_seed",
  });
  checkJson(companySeedRes, "osgb_finance_company_seed");

  if (companySeedRes.status < 200 || companySeedRes.status >= 300) {
    sleep(1);
    return;
  }

  const rows = Array.isArray(companySeedRes.json()) ? companySeedRes.json() : [];
  const companyId = rows.length > 0 ? rows[0]?.id : null;

  if (!companyId) {
    sleep(1);
    return;
  }

  const response = get(buildFinancePagePath({ companyId }), data.accessToken, {
    module: "osgb-finance",
    query: "osgb_finance_filtered",
  });
  checkJson(response, "osgb_finance_filtered");

  sleep(1);
}

export function financeCalendarReads(data) {
  const overviewRes = get(buildFinanceOverviewPath(), data.accessToken, {
    module: "osgb-finance",
    query: "osgb_finance_calendar_snapshot",
  });
  checkJson(overviewRes, "osgb_finance_calendar_snapshot");

  sleep(1);
}
