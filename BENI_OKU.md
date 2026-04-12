# Denetron Safety Suite - Kurulum Rehberi

## Proje Hakkinda

Denetron Safety Suite, Is Sagligi ve Guvenligi (ISG) yonetim platformudur.
React + TypeScript + Vite ile gelistirilmistir. Supabase backend, Google Gemini AI entegrasyonu ve Chrome eklentisi icerir.

---

## Gereksinimler

Asagidakilerden birini bilgisayariniza kurun:

| Arac | Minimum Surum | Indirme Linki |
|------|---------------|---------------|
| **Node.js** | 18+ | https://nodejs.org |
| **npm** (Node.js ile gelir) | 9+ | Node.js ile otomatik kurulur |

> **Not:** Bun yerine `bun` veya `yarn` da kullanabilirsiniz.

### Editir (Opsiyonel)
- VS Code: https://code.visualstudio.com
- Onerilen eklentiler: ESLint, Tailwind CSS IntelliSense, TypeScript Importer

---

## Kurulum Adimlari

### 1. Zip Dosyasini Cikartin

Zip dosyasini istediginiz klasore cikartin. Ornegin:

```
C:\Projeler\denetron-safety-suite\
```

### 2. Terminal Acin

Cikardiginiz klasorde terminal (komut satiri) acin:

**Windows icin:**
- Klasoru Dosya Gezgini'nde acin
- Adres cubuguna `cmd` yazip Enter'a basin

**Mac/Linux icin:**
- Terminal acin, `cd` komutuyla klasore gidin

### 3. Bagimliklari Yukleyin

```bash
npm install
```

> Bu adim `node_modules` klasorunu olusturur ve tum gerekli kutuphaneleri indirir.
> Internet baglantisi gerektirir. Islem 1-3 dakika surebilir.

### 4. Ortam Degiskenlerini Ayarlayin

Proje klasorundeki `.env.example` dosyasini kopyalayip `.env` olarak yeniden adlandirin:

```bash
cp .env.example .env
```

**Windows (CMD):**
```cmd
copy .env.example .env
```

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

Ardindan `.env` dosyasini acip **gercel API anahtarlarinizi** girin:

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
GOOGLE_API_KEY=Supabase Edge Function secret
GOOGLE_MODEL=gemini-2.5-flash
...vb
```

#### Gerekli API Anahtarlari

| Anahtar | Nereden Alinir |
|---------|----------------|
| Google AI (Gemini) API Key | https://aistudio.google.com/apikey |
| Supabase URL & Anon Key | https://supabase.com/dashboard → Proje ayarlari |
| Google Maps API Key | https://console.cloud.google.com/apis/credentials |
| Resend API Key | https://resend.com/api-keys |
| Sentry DSN | https://sentry.io |

> **Onemli:** `.env` dosyasini asla baskalariyla paylasmayin!

### 5. Gelistirme Sunucusunu Baslatin

```bash
npm run dev
```

Tarayicinizda otomatik olarak `http://localhost:8080` adresi acilacaktir.

---

## Diger Komutlar

### Uretim Derlemesi (Production Build)

```bash
npm run build
```

Derlenen dosyalar `dist/` klasorune olusur. Bu klasoru herhangi bir web sunucusuna (Nginx, Apache, Vercel, Netlify) yukleyebilirsiniz.

### Derleme Onizleme

```bash
npm run preview
```

Uretim derlemesini lokalde test etmek icin kullanin.

### Kod Kalite Kontrolu

```bash
npm run lint
```

### Test Calistirma

```bash
# Birim testler
npm run test

# Testleri izleme modunda calistir
npm run test:watch

# Uctan uca (E2E) testler
npm run test:e2e
```

---

## Proje Yapisi

```
denetron-safety-suite/
├── chrome-extension/       # ISG-KATIP Chrome eklentisi
│   ├── background/         # Arka plan servis calistani
│   ├── content/            # Web sayfasi betikleri
│   ├── popup/              # Eklenti arayuzu
│   └── auth/               # Kimlik dogrulama
├── public/                 # Statik dosyalar
├── src/
│   ├── components/         # React bilesenleri
│   │   ├── ui/             # shadcn/ui arayuz bilesenleri
│   │   ├── isg-bot/        # AI asistan bilesenleri
│   │   ├── adep/           # Yillik degerlendirme bilesenleri
│   │   └── certificates/   # Sertifika bilesenleri
│   ├── pages/              # Sayfa bilesenleri
│   ├── services/           # API servis katmani
│   ├── hooks/              # Ozel React hook'lari
│   ├── integrations/       # Supabase entegrasyonu
│   ├── lib/                # Yardimci fonksiyonlar
│   └── types/              # TypeScript tip tanimlari
├── supabase/
│   └── functions/          # Supabase Edge Functions (backend)
├── .env.example            # Ortam degiskenleri sablonu
├── package.json            # Proje yapilandirmasi
├── vite.config.ts          # Vite yapilandirmasi
├── tailwind.config.ts      # Tailwind CSS yapilandirmasi
└── tsconfig.json           # TypeScript yapilandirmasi
```

---

## Supabase Edge Functions

Backend fonksiyonlari `supabase/functions/` klasorundedir. Bu fonksiyonlari calistirmak icin:

1. Supabase CLI yukleyin: https://supabase.com/docs/guides/cli
2. Supabase'e giris yapin:
   ```bash
   supabase login
   ```
3. Fonksiyonlari derivative edin:
   ```bash
   supabase functions deploy <fonksiyon-adi>
   ```

---

## Chrome Eklentisi Kurulumu

1. Chrome browser'da `chrome://extensions/` adresine gidin
2. Sag ustte **Gelistirici modu**nu acin
3. **Paketlenmemis oge yukle** butonuna tiklayin
4. `chrome-extension/` klasorunu secin

Eklenti ISG-KATIP portali ile entegre calisir.

---

## Vercel'e Deploy

Proje Vercel icin yapilandirilmistir:

1. https://vercel.com adresinde hesap acin
2. Yeni proje olusturup GitHub repo'nuzu baglayin
3. Vercel otomatik olarak `npm run build` calistirir
4. Ortam degiskenlerini Vercel dashboard'dan ekleyin

---

## Sorun Giderme

| Sorun | Cozum |
|-------|-------|
| `npm install` hata veriyor | Node.js surumunu kontrol edin: `node -v` (18+ olmali) |
| Sayfa bos gorunuyor | `.env` dosyasinin varligini ve API anahtarlarini kontrol edin |
| Supabase baglantisi basarisiz | `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` degerlerini kontrol edin |
| AI ozellikleri calismiyor | Supabase secrets icinde `GOOGLE_API_KEY` ve opsiyonel `GOOGLE_MODEL` tanimlandigindan emin olun |
| Port 8080 kullanimda | `vite.config.ts` dosyasinda port degerini degistirin |

---

## Teknoloji Yigini

- **Frontend:** React 18 + TypeScript + Vite
- **UI:** shadcn/ui + Tailwind CSS + Radix UI
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **AI:** Google Gemini (Generative AI)
- **State:** TanStack React Query
- **Form:** React Hook Form + Zod
- **Grafik:** Recharts
- **PDF:** jsPDF + PDF.js
- **Test:** Vitest + Playwright

---

## Lisans

Ozel proje - tum haklari saklidir.
