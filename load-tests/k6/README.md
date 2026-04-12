# k6 Test Matrix

Bu klasorde testler uc gruba ayrildi:

- `smoke`
  - SPA shell route erisimi
  - amac: deploy sonrasi temel route kirik mi
- `realistic`
  - gercek kullaniciya yakin authenticated read akislari
  - amac: release gate
- `targeted`
  - agir veya daha once timeout ureten ekranlara ozel testler
  - amac: refactor sonrasi regresyon yakalamak

## Suites

| Grup | Dosya | Amac |
| --- | --- | --- |
| smoke | `routes-smoke.js` | shell route ve HTML donus kontrolu |
| realistic | `supabase-authenticated.js` | auth + dashboard/core/osgb karmasi gercekci akis |
| realistic-capacity | `capacity-realistic.js` | constant-VUs ile 100/250/500/1000 aktif kullanici kapasite testi |
| targeted | `incident-management.js` | IncidentManagement page/filter/detail |
| targeted | `osgb-personnel.js` | OSGBPersonnel page/filter/load-summary |
| targeted | `osgb-assignments.js` | OSGBAssignments page/filter/form-helper |
| targeted | `osgb-dashboard.js` | OSGBDashboard catalog/refresh/operational snapshot |
| targeted | `osgb-finance.js` | OSGBFinance page/filter/calendar snapshot |

## Runner Scripts

- `run-realistic.ps1`
  - `routes-smoke.js` + `supabase-authenticated.js`
- `run-targeted.ps1`
  - varsayilan olarak tum targeted suite'leri kosar
  - istenirse `-Suites` ile daraltilir

### Ornekler

```powershell
.\load-tests\k6\run-realistic.ps1 `
  -K6Path "C:\Users\benli\OneDrive\Desktop\k6.exe" `
  -SupabaseUrl "https://YOUR_PROJECT.supabase.co" `
  -SupabaseAnonKey "YOUR_ANON_KEY" `
  -TestEmail "YOUR_EMAIL" `
  -TestPassword "YOUR_PASSWORD" `
  -BaseUrl "http://localhost:4173"
```

```powershell
.\load-tests\k6\run-targeted.ps1 `
  -K6Path "C:\Users\benli\OneDrive\Desktop\k6.exe" `
  -SupabaseUrl "https://YOUR_PROJECT.supabase.co" `
  -SupabaseAnonKey "YOUR_ANON_KEY" `
  -TestEmail "YOUR_EMAIL" `
  -TestPassword "YOUR_PASSWORD"
```

```powershell
.\load-tests\k6\run-targeted.ps1 `
  -K6Path "C:\Users\benli\OneDrive\Desktop\k6.exe" `
  -SupabaseUrl "https://YOUR_PROJECT.supabase.co" `
  -SupabaseAnonKey "YOUR_ANON_KEY" `
  -TestEmail "YOUR_EMAIL" `
  -TestPassword "YOUR_PASSWORD" `
  -Suites @("osgb-dashboard","osgb-assignments")
```

## Capacity Test

`capacity-realistic.js`, ayni anda aktif kullanici sayisini taklit etmek icin `constant-vus` kullanir.

Varsayilanlar:

- `TARGET_VUS=100`
- `TEST_DURATION=15m`

### 100 aktif kullanici

```powershell
& "C:\Users\benli\OneDrive\Desktop\k6.exe" run .\load-tests\k6\capacity-realistic.js `
  -e SUPABASE_URL=https://YOUR_PROJECT.supabase.co `
  -e SUPABASE_ANON_KEY=YOUR_ANON_KEY `
  -e TEST_EMAIL=YOUR_EMAIL `
  -e TEST_PASSWORD=YOUR_PASSWORD `
  -e TARGET_VUS=100 `
  -e TEST_DURATION=15m
```

### 250 aktif kullanici

```powershell
& "C:\Users\benli\OneDrive\Desktop\k6.exe" run .\load-tests\k6\capacity-realistic.js `
  -e SUPABASE_URL=https://YOUR_PROJECT.supabase.co `
  -e SUPABASE_ANON_KEY=YOUR_ANON_KEY `
  -e TEST_EMAIL=YOUR_EMAIL `
  -e TEST_PASSWORD=YOUR_PASSWORD `
  -e TARGET_VUS=250 `
  -e TEST_DURATION=20m
```

### 500 aktif kullanici

```powershell
& "C:\Users\benli\OneDrive\Desktop\k6.exe" run .\load-tests\k6\capacity-realistic.js `
  -e SUPABASE_URL=https://YOUR_PROJECT.supabase.co `
  -e SUPABASE_ANON_KEY=YOUR_ANON_KEY `
  -e TEST_EMAIL=YOUR_EMAIL `
  -e TEST_PASSWORD=YOUR_PASSWORD `
  -e TARGET_VUS=500 `
  -e TEST_DURATION=20m
```

### 1000 aktif kullanici

```powershell
& "C:\Users\benli\OneDrive\Desktop\k6.exe" run .\load-tests\k6\capacity-realistic.js `
  -e SUPABASE_URL=https://YOUR_PROJECT.supabase.co `
  -e SUPABASE_ANON_KEY=YOUR_ANON_KEY `
  -e TEST_EMAIL=YOUR_EMAIL `
  -e TEST_PASSWORD=YOUR_PASSWORD `
  -e TARGET_VUS=1000 `
  -e TEST_DURATION=10m
```

### Yorumlama

- `100`: taban cizgisi
- `250`: orta yuk
- `500`: yuksek yuk
- `1000`: sinir / kirilma noktasi testi

Her kosuda su metrikleri kaydet:

- `THRESHOLDS`
- `HTTP`
- `EXECUTION`

## Last Known Results

Tarih: `2026-03-24`

| Suite | Durum | Not |
| --- | --- | --- |
| `supabase-authenticated.js` | pass | `http_req_failed=0.00%`, `p95=114.3ms` |
| `incident-management.js` | pass | `http_req_failed=0.00%`, `p95=107.6ms` |
| `osgb-personnel.js` | pass | `http_req_failed=0.00%`, `p95=112.49ms` |
| `osgb-assignments.js` | pass | `http_req_failed=0.00%`, `p95=179.15ms` |
| `osgb-dashboard.js` | pass | `http_req_failed=0.00%` threshold gecti, tekil `refresh_finance` hatasi `1/11046` |
| `osgb-finance.js` | pending | finance refactor sonrasi kosulacak |

## Refactor Coverage

Dusuk risk grubuna alinmis ekranlar:

- `OSGBCompanyTracking`
- `IncidentManagement`
- `OSGBPersonnel`
- `OSGBAssignments`
- `OSGBDashboard`

Bu ekranlarda uygulanan ortak desen:

- full-list yerine page-first veya purpose-built snapshot
- ilk yukte fan-out azaltma
- detay gerekiyorsa lazy load
- mutation sonrasi stale local state yerine reload

## Remaining Heavy Screens

Bir sonraki hedefler, halen tam liste veya agir helper kullanan ekranlar:

1. `OSGBFinance`
   - refactor edildi
   - targeted suite eklendi: `osgb-finance.js`
2. `OSGBDocuments`
   - tam `listOsgbDocuments(user.id)` ile geliyor
   - client-side filter kullaniyor
3. `OSGBAlerts`
   - halen `getOsgbDashboardData(user.id)` tam snapshot kullaniyor
4. `OSGBCapacity`
   - halen `getOsgbDashboardData(user.id)` tam snapshot kullaniyor

## Release Gate Onerisi

Deploy sonrasi minimum set:

1. `routes-smoke.js`
2. `supabase-authenticated.js`
3. degisen ekran varsa ilgili targeted suite

Ornek:

- dashboard degisti ise `osgb-dashboard.js`
- assignments degisti ise `osgb-assignments.js`
- personel degisti ise `osgb-personnel.js`
- incident degisti ise `incident-management.js`
