# Playwright UX tests

These tests measure user-facing timings instead of backend capacity.

Measured flows:

- login submit -> session ready
- route click -> shell render
- route click -> page data ready

Required environment variables:

- `PLAYWRIGHT_TEST_EMAIL`
- `PLAYWRIGHT_TEST_PASSWORD`

Optional thresholds:

- `PLAYWRIGHT_MAX_LOGIN_MS` default: `2500`
- `PLAYWRIGHT_MAX_ROUTE_SHELL_MS` default: `800`
- `PLAYWRIGHT_MAX_ROUTE_DATA_MS` default: `2000`

Run:

```powershell
npm install
npx playwright install
npm run test:e2e
```

Run with visible browser:

```powershell
npm run test:e2e:headed
```

Application timing entries are stored under `window.__appTimings`.
