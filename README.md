# İSGVizyon (Denetron Safety Suite)

İSGVizyon, İş Sağlığı ve Güvenliği (İSG) süreçlerini yönetmek için geliştirilmiş bir web platformudur.  
Frontend: **React + TypeScript + Vite** — Backend: **Supabase (PostgreSQL + Edge Functions)**.  
Ayrıca **Google Gemini (Generative AI)** entegrasyonu ve **Chrome eklentisi** içerir.

**Canlı URL:** https://www.isgvizyon.com

---

## İçerik
- [Özellikler](#özellikler)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri (.env)](#ortam-değişkenleri-env)
- [Komutlar](#komutlar)
- [Proje Yapısı](#proje-yapısı)
- [Supabase (Backend)](#supabase-backend)
- [Chrome Eklentisi](#chrome-eklentisi)
- [Testler](#testler)
- [Load/Performans Testleri (k6)](#loadperformans-testleri-k6)
- [Deploy (Vercel)](#deploy-vercel)
- [Sorun Giderme](#sorun-giderme)
- [Lisans](#lisans)

---

## Özellikler
- İSG operasyonlarını yönetmeye yönelik ekranlar ve iş akışları
- Supabase tabanlı kimlik doğrulama/veri erişimi
- AI destekli analiz akışları (Gemini)
- Chrome extension ile portal/harici sistem entegrasyonları
- E2E kullanıcı deneyimi testleri (Playwright)
- Load test senaryoları (k6)

---

## Teknoloji Yığını
- **Frontend:** React 18, TypeScript, Vite
- **UI:** Tailwind CSS, shadcn/ui, Radix UI
- **State/Data:** TanStack React Query
- **Forms/Validation:** React Hook Form, Zod
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **AI:** Google Generative AI (Gemini)
- **Gözlemlenebilirlik:** Sentry
- **Test:** Vitest, Playwright
- **Load Test:** k6

---

## Kurulum

### Gereksinimler
- **Node.js 18+** (önerilir)
- npm / bun / yarn (birini kullanabilirsin)

### Adımlar
```bash
# 1) Repo'yu klonla
git clone <REPO_URL>
cd isgvizyon

# 2) Bağımlılıkları kur
npm install

# 3) .env oluştur
cp .env.example .env

# 4) Dev server
npm run dev
```

> Vite dev server varsayılan olarak **8080** portunda çalışacak şekilde ayarlı.

---

## Ortam Değişkenleri (.env)

Repo kökündeki `.env.example` dosyasını `.env` olarak kopyalayıp kendi değerlerini gir:

```dotenv
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_GOOGLE_MAPS_API_KEY=...
VITE_SENTRY_DSN=...
PUBLIC_APP_URL=http://localhost:5173

# AI / otomasyon / entegrasyon
GOOGLE_API_KEY=...
GOOGLE_MODEL=gemini-2.5-flash
GOOGLE_MODEL_ROBUST=gemini-2.5-pro

# E-posta, ödeme, otomasyon vb.
RESEND_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
N8N_WEBHOOK_URL=...
N8N_WEBHOOK_SECRET=...
```

> Not: `.env` dosyasını commit’leme / paylaşma.

---

## Komutlar
```bash
# geliştirme
npm run dev

# build
npm run build
npm run build:dev

# preview
npm run preview

# lint
npm run lint

# unit test
npm run test
npm run test:watch

# e2e test
npm run test:e2e
npm run test:e2e:headed
```

---

## Proje Yapısı (özet)
```
.
├─ chrome-extension/        # Chrome eklentisi
├─ docs/                    # Dokümantasyon
├─ load-tests/              # k6 senaryoları vb.
├─ public/                  # statik dosyalar
├─ src/                     # uygulama kaynak kodu
├─ supabase/                # edge functions / supabase config
├─ tests/                   # e2e test dokümanları ve testler
├─ .env.example
├─ package.json
├─ vite.config.ts
└─ vercel.json
```

---

## Supabase (Backend)

Supabase proje ayarları `supabase/config.toml` altında tutulur. Edge Functions örnekleri:
- `functions/analyze-image` (JWT verify açık)
- `functions/analyze-hazard` (JWT verify kapalı)

Edge Functions için genel yaklaşım:
1. Supabase CLI kur ve login ol
2. İlgili function’ı deploy et

---

## Chrome Eklentisi

Geliştirme amaçlı yükleme:
1. Chrome’da `chrome://extensions/` aç
2. **Developer mode**’u aktif et
3. **Load unpacked** → `chrome-extension/` klasörünü seç

---

## Testler

### E2E (Playwright)
E2E testleri kullanıcı-akışı timing ölçümleri içerir (login, route render vb.).

Gerekli env değişkenleri:
- `PLAYWRIGHT_TEST_EMAIL`
- `PLAYWRIGHT_TEST_PASSWORD`

Çalıştırma:
```bash
npm run test:e2e
# veya
npm run test:e2e:headed
```

---

## Load/Performans Testleri (k6)

k6 testleri `load-tests/k6` altında “smoke / realistic / targeted” olarak ayrılmıştır.  
Runner script örnekleri ve suite açıklamaları için:
- `load-tests/k6/README.md`

---

## Deploy (Vercel)

Repo Vercel ile uyumludur:
1. Vercel’de yeni proje oluştur
2. GitHub repo’yu bağla
3. Build komutu: `npm run build`
4. Vercel dashboard üzerinden `.env` değişkenlerini ekle

Canlı URL: https://www.isgvizyon.com

---

## Sorun Giderme

- `npm install` hata veriyor → Node sürümünü kontrol et (`node -v`, 18+)
- Sayfa boş / API çalışmıyor → `.env` var mı, Supabase URL/Anon Key doğru mu?
- AI özellikleri çalışmıyor → `GOOGLE_API_KEY` ve model env’leri doğru mu?
- Port çakışması → `vite.config.ts` içindeki `server.port` (varsayılan 8080)

---

## Lisans
Özel proje — tüm hakları saklıdır.
