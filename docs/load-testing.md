# Load Testing Plan

Bu proje için yük testi iki katmanda yapılmalı:

1. `SPA shell / CDN / static asset` testi
2. `Authenticated Supabase API` testi

İkisini ayırmak önemli. `GET /employees` gibi route testleri çoğunlukla `index.html` ve static asset davranışını ölçer. Gerçek uygulama yükü esas olarak Supabase auth, PostgREST sorguları, storage ve edge function çağrılarında oluşur.

## Test edeceğimiz route'lar

### Tier 1: her deploy sonrası zorunlu

- `/auth`
- `/`
- `/employees`
- `/ppe-management`
- `/periodic-controls`
- `/health-surveillance`
- `/incidents`
- `/inspections`
- `/reports`

Gerekçe:
- kullanıcıların en sık açacağı akışlar
- dashboard ve operasyon modülleri burada toplanıyor
- first-load ve bundle yükü ilk burada görünür

### Tier 2: yüksek veri yoğunluklu modüller

- `/osgb/dashboard`
- `/osgb/personnel`
- `/osgb/assignments`
- `/osgb/company-tracking`
- `/osgb/tasks`
- `/dashboard/certificates`

Gerekçe:
- OSGB modülü çok tabloya ve çok ilişkili veriye yük bindirir
- sertifika akışı CPU/storage/edge function tarafını zorlar

### Tier 3: ayrı test edilmesi gereken ağır işlemler

Bu işler ana browse/load test senaryosundan ayrı tutulmalı:

- sertifika üretimi
- PDF/export akışları
- AI analiz akışları
- Excel upload/import
- toplu CAPA/report üretimi

Gerekçe:
- bunlar normal listeleme yükünden farklıdır
- CPU, storage ve edge function kapasitesini ayrı tüketir
- aynı senaryoya karıştırılırsa darboğazın kaynağı görünmez

## K6 scriptleri

Repo içine eklenen scriptler:

- [routes-smoke.js](C:\Users\benli\Downloads\denetron-safety-suite-428441ec\load-tests\k6\routes-smoke.js)
- [supabase-authenticated.js](C:\Users\benli\Downloads\denetron-safety-suite-428441ec\load-tests\k6\supabase-authenticated.js)

## Çalıştırma

### 1. Route / shell testi

Bu test Vercel/CDN/static shell davranışını ölçer.

```powershell
k6 run .\load-tests\k6\routes-smoke.js -e BASE_URL=https://your-app-domain.vercel.app
```

### 2. Authenticated Supabase testi

Bu test gerçek kullanıcı token'ı alır ve temel modüllerin PostgREST sorgularını yük altında çalıştırır.

Gerekli env:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `TEST_EMAIL`
- `TEST_PASSWORD`

```powershell
k6 run .\load-tests\k6\supabase-authenticated.js `
  -e SUPABASE_URL=https://YOUR_PROJECT.supabase.co `
  -e SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY `
  -e TEST_EMAIL=loadtest-user@example.com `
  -e TEST_PASSWORD=your-password
```

## Hangi kullanıcıyla test edeceğiz

Load test için ayrı kullanıcı aç:

- sadece test amaçlı olsun
- production gerçek kullanıcı hesabı olmasın
- yeterli ama sınırlı veri görsün

Tercihen ayrıca:

- normal kullanıcı
- OSGB erişimli kullanıcı

olarak iki ayrı test hesabı kullan.

## Hangi API gruplarını ölçüyoruz

Authenticated script şu grupları temsil eder:

### Dashboard

- `profiles`
- `notifications`
- `companies`

### Core operasyon modülleri

- `employees`
- `ppe_inventory`
- `ppe_assignments`
- `periodic_controls`
- `health_surveillance_records`
- `incident_reports`

### OSGB modülü

- `isgkatip_companies`
- `osgb_personnel`
- `osgb_assignments`
- `osgb_tasks`

Bu seçim bu projedeki en kritik kullanıcı yükünü temsil eder.

## Kodda doğrulanan gerçek sorgular

Bu turda taranan sayfalar ve arka planda çalışan sorgular:

### PPEManagement

- `ppe_inventory`
  - `select(*)`
  - `eq(user_id)`
  - `order(item_name asc)`
- `ppe_assignments`
  - `select(*)`
  - `eq(user_id)`
  - `order(due_date asc)`
- `employees`
  - çalışan seçenekleri için tam liste
- `companies`
  - firma adı eşleme için tam liste
- ek görev kontrolü:
  - `osgb_tasks`

### PeriodicControls

- `periodic_controls`
  - `select(*, company:isgkatip_companies(company_name))`
  - `eq(user_id)`
  - `order(next_control_date asc)`
- `periodic_control_reports`
  - kullanıcı bazlı tam geçmiş
- `isgkatip_companies`
  - firma seçenekleri
- ek görev kontrolü:
  - `osgb_tasks`

### HealthSurveillance

- `health_surveillance_records`
  - `select(*, employee:employees(first_name,last_name), company:companies(name))`
  - `eq(user_id)`
  - `order(next_exam_date asc)`
- `employees`
  - çalışan seçenekleri için tam liste
- `companies`
  - firma eşleme
- ek görev kontrolü:
  - `osgb_tasks`

### OSGBTasks

- `osgb_tasks`
  - `select(*, company:isgkatip_companies(company_name))`
  - `eq(user_id)`
  - `order(created_at desc)`
- `isgkatip_companies`
  - firma seçenekleri

### OSGBCompanyTracking

- `isgkatip_companies`
- `osgb_assignments`
- `osgb_document_tracking`
- `osgb_finance`
- `osgb_tasks`
- `osgb_notes`

Bu ekran tek başına 6 veri seti çekiyor ve client tarafında birleştiriyor. İlk darboğaz adayı burada.

## Bu turda kapatılan eksikler

- `PeriodicControls`
  - session cache eklendi
  - kontrol listesi pagination eklendi
  - rapor geçmişi pagination eklendi
- `HealthSurveillance`
  - session cache eklendi
  - kayıt listesi pagination eklendi
- `OSGBTasks`
  - session cache eklendi
  - görev listesi pagination eklendi
- `OSGBCompanyTracking`
  - tablo pagination eklendi
- `PPEManagement`
  - zaten vardı: session cache + çoklu pagination

## Sonuçları nasıl yorumlayacaksın

### Ana metrikler

K6 çıktısında şunlara bak:

1. `http_req_failed`
2. `http_req_duration`
3. `p(95)`
4. `p(99)`
5. `vus` ve `iterations`
6. hata mesajları

### Hedef eşikler

#### Route / shell testi

- `http_req_failed < 1%`
- `p95 < 1200ms`
- `p99 < 2500ms`

Bu testte bozulma varsa sorun genelde:

- Vercel/CDN
- bundle boyutu
- fazla asset yükü
- cold start benzeri frontend boot maliyeti

#### Authenticated dashboard

- `p95 < 600ms`

Bu bozulursa bak:

- `profiles`
- `notifications`
- `companies`
- auth session kurulum maliyeti

#### Core modüller

- `p95 < 1000ms`

Bu bozulursa bak:

- index eksikliği
- pagination eksikliği
- fazla kolon çekilmesi
- RLS policy maliyeti

#### OSGB modülü

- `p95 < 1200ms`

Bu bozulursa bak:

- `isgkatip_companies`
- `osgb_*`
- join/select genişliği
- org bazlı sorgular

## Kötü sonuç gelirse ne yapacağız

### Durum 1: hata oranı artıyor

Belirti:

- `http_req_failed > 1-2%`
- 401/403/429/500 artışı

Yorum:

- auth problemi
- RLS/policy problemi
- rate limit
- edge function timeout
- DB bağlantı baskısı

İlk aksiyon:

1. Supabase logs
2. Sentry
3. Network hata kodları
4. en sık patlayan endpoint

### Durum 2: p95 yükseliyor ama hata yok

Belirti:

- istekler dönüyor ama yavaş

Yorum:

- index eksik
- sorgu fazla veri çekiyor
- pagination yetersiz
- aynı sayfa çok fazla request atıyor

İlk aksiyon:

1. en yavaş endpoint'i bul
2. `EXPLAIN ANALYZE` çalıştır
3. kolonları daralt
4. limit/range uygula
5. cache ekle

### Durum 3: route testi iyi ama authenticated test kötü

Yorum:

- frontend/CDN değil
- asıl sorun Supabase sorguları veya RLS

Öncelik:

1. PostgREST sorguları
2. index
3. RLS maliyeti

### Durum 4: authenticated ok ama ağır işlerde çöküyor

Yorum:

- listeleme iyi
- ama CPU/storage/edge function yükü kötü

Öncelik:

1. queue/job sistemi
2. batch processing
3. concurrency limiti
4. background worker

## Önerilen test sırası

### Aşama 1

Her deploy sonrası:

1. `routes-smoke.js`
2. düşük yük authenticated test

### Aşama 2

Staging'de:

1. 25 kullanıcı
2. 50 kullanıcı
3. 100 kullanıcı

### Aşama 3

Production-benzeri veride:

1. 250 kullanıcı
2. 500 kullanıcı
3. 1000 kullanıcı

Direkt 1000 ile başlama. Önce kırılma eşiğini bul.

## İkinci tur k6

`supabase-authenticated.js` içine ikinci tur phase-2 senaryoları eklendi:

- `core_module_reads_phase2`
- `osgb_reads_phase2`

Bunlar daha yüksek arrival rate ve daha yüksek `maxVUs` ile çalışır. İlk tur temiz geçtikten sonra ikinci turu kullan.

## Bu projede beklenen ilk darboğazlar

Muhtemel ilk darboğazlar:

1. `employees`
2. `ppe_assignments`
3. `periodic_controls`
4. `health_surveillance_records`
5. `isgkatip_companies`
6. `osgb_tasks`
7. sertifika üretimi

## Sonraki adım

Bu planın ardından yapılacak en doğru işler:

1. `PeriodicControls` ve `HealthSurveillance` sayfalarında pagination/cache sertleştirmesi
2. kritik sorgular için `EXPLAIN ANALYZE`
3. ağır edge function akışları için ayrı `k6` senaryosu
