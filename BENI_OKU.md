# Denetron Safety Suite / ISGVizyon

Bu dosya, uygulamayi bir ogretim uyesine, hakeme veya teknik inceleyiciye gonderirken projenin ne yaptigini hizli ve dogru sekilde anlatmak icin hazirlanmistir.

## 1. Projenin Amaci

İSGVİZYON Safety Suite, Is Sagligi ve Guvenligi sureclerini tek bir dijital platformda toplamak icin gelistirilmis bir web uygulamasidir. Hedefi, sahadaki daginik ISG operasyonlarini yazilim destekli, izlenebilir ve olculebilir hale getirmektir.

Uygulama su ihtiyaclara cevap verir:

- firma ve calisan kayitlarinin takibi
- risk degerlendirme sureclerinin yonetimi
- denetim, bulgu ve duzeltici faaliyet yonetimi
- acil durum eylem plani ve kurul toplantisi surecleri
- periyodik kontrol, PPE ve saglik gozetimi takibi
- OSGB operasyonlarinin merkezi olarak yonetilmesi
- ISG-KATIP/harici portal verilerinin yardimci entegrasyonlar ile kullanilmasi
- AI destekli analiz, ozetleme ve aksiyon onerisi uretilmesi

## 2. Uygulamanin Kisa Ozeti

Teknik olarak bu proje:

- frontend tarafinda React + TypeScript + Vite
- backend tarafinda Supabase
- veritabani tarafinda PostgreSQL
- kimlik dogrulama tarafinda Supabase Auth
- dosya yonetimi tarafinda Supabase Storage
- sunucusuz is akislari icin Supabase Edge Functions
- AI ozellikleri icin Google Gemini

kullanilarak gelistirilmistir.

Bu yapi sayesinde uygulama hem klasik CRUD ekrani gibi calisabilir, hem de belge analizi, toplu aksiyon yonetimi ve operasyonel karar destek sistemi gibi daha ileri fonksiyonlar sunabilir.

## 3. Temel Moduller

Uygulama tek bir ekran degil, birden fazla alt urunden olusan bir platformdur.

### 3.1 Ana Dashboard

Giristen sonra kullaniciya genel durumu gosteren merkez ekrandir. Uygulamadaki diger modullere gecis buradan yapilir.

### 3.2 Firma ve Calisan Yonetimi

- firmalarin temel bilgileri
- tehlike sinifi, sektor ve iletisim verileri
- calisan listeleri
- gorevlendirme mektuplari

bu bolumde yonetilir.

### 3.3 Risk Degerlendirme Modulu

- risk degerlendirme olusturma
- risk kalemleri ekleme ve duzenleme
- risk kutuphanesi kullanma
- imza akislari
- rapor/PDF ciktilari

Bu modulde klasik ISG risk degerlendirme sureci dijital ortama tasinmistir.

### 3.4 Denetim ve Bulgular

- saha denetimleri
- ozel form tabanli denetim akislari
- bulgu takibi
- onleyici ve duzeltici aksiyonlar

Bu kisim ozellikle denetim sonrasi takibin kaybolmamasi icin tasarlanmistir.

### 3.5 CAPA ve Bulk CAPA

CAPA modulu, uygunsuzluklar icin duzeltici/onleyici faaliyet takibi sunar.

Bulk CAPA modulu ise:

- sahadan coklu gorsel veya toplu veri alip
- AI yardimiyla tespitleri yorumlayip
- seri aksiyon kaydi olusturmayi

hedefler.

### 3.6 ADEP - Acil Durum Eylem Plani

Bu modulde acil durum eylem planlari dijital olarak uretilir ve yonetilir.

Kapsaminda:

- senaryolar
- ekipler
- ekipman envanteri
- hukuki referanslar
- onleyici tedbirler
- RACI matrisi
- tatbikatlar
- checklist yapilari

yer alir.

### 3.7 Kurul Toplantilari

- kurul toplantisi kaydi
- gundem yonetimi
- katilimci takibi
- toplanti belgeleri
- karar ve sorumlu atamalari

bu modulle yonetilir.

### 3.8 Yillik Planlar

Yillik calisma plani, egitim plani ve degerlendirme raporu gibi surecler bu bolumde yonetilir.

### 3.9 PPE, Periyodik Kontrol ve Saglik Gozetimi

Bu moduller ile:

- KKD envanteri ve zimmetleri
- periyodik kontroller
- saglik gozetimi kayitlari
- ilgili dosya ve raporlar

tek sistemden takip edilir.

### 3.10 Belge Analizi

Bu modulde kullanici belge yukleyebilir. Sistem belgeyi:

- siniflandirir
- ozetler
- kritik noktalar cikarir
- aksiyon maddeleri onerir

Bu ozellik AI desteklidir.

### 3.11 Blueprint Analyzer ve Tahliye Editoru

Plan/kroki/yerlesim gorselleri uzerinde analiz yapmayi ve tahliye plani uretmeyi hedefleyen moduldur.

### 3.12 OSGB Modulu

Uygulamanin daha kurumsal ve operasyonel tarafidir. Bir OSGB'nin coklu musteri/firma operasyonunu yonetmesini hedefler.

Alt ekranlardan bazilari:

- OSGB Dashboard
- personel yonetimi
- atamalar
- firma takibi
- kapasite analizi
- saha ziyaretleri
- finans
- belge ve yukumluluk takibi
- gorev ve not akislari
- analitik ekranlar

### 3.13 ISG-Bot

ISG-Bot, uygulamanin karar destek ve otomasyon tarafidir.

Amaç:

- uyum risklerini erken gormek
- kritik sirketleri listelemek
- toplanti, sure, sozlesme ve gorev aciklarini one cikarmak
- AI destekli aksiyon onermek

ISG-Bot, klasik bir chatbot degil; daha cok ISG surec verilerini yorumlayan operasyon merkezi gibi dusunulebilir.

### 3.14 Chrome Eklentisi

Projede `chrome-extension/` klasoru altinda bir Chrome eklentisi de bulunur.

Bu eklenti:

- harici portallarla yardimci entegrasyon
- kimlik baglama
- veri toplama/aktarma

gibi ihtiyaclar icin kullanilir.

## 4. Mimarinin Ozet Yapisi

### Frontend

Kaynak kod agirlikli olarak `src/` altindadir.

Ana yapilar:

- `src/pages/`: sayfa seviyesindeki ekranlar
- `src/components/`: tekrar kullanilan bilesenler
- `src/components/ui/`: shadcn/ui tabanli arayuz bilesenleri
- `src/contexts/`: oturum ve uygulama seviyesi context yapilari
- `src/domain/`: is kurali ve alan mantigi
- `src/lib/`: yardimci fonksiyonlar, export, storage, orchestrasyon
- `src/integrations/supabase/`: Supabase istemcisi ve tipler

### Routing

Tum ana route yapisi `src/App.tsx` icindedir. Uygulama, tek sayfa uygulamasi olarak React Router ile calisir.

### Backend

`supabase/` klasoru altinda:

- migration dosyalari
- Edge Function'lar
- Supabase'a ait backend mantigi

yer alir.

Bu yapi sayesinde backend mantigi proje ile birlikte versiyonlanir.

## 5. Guvenlik Yaklasimi

Projede son donemde ciddi bir Supabase guvenlik sertlestirmesi yapilmistir.

Uygulanan temel yaklasimlar:

- Row Level Security aktif kullanilmistir
- tablo erisimleri organization ve kullanici kapsaminda sinirlandirilmistir
- hassas alanlar icin hash/shadow kolonlar eklenmistir
- kritik storage bucket'lari private yapilmistir
- public URL bagimliligi signed URL modeline alinmistir
- security definer function yetkileri daraltilmistir
- policy ve function execute izinleri gozden gecirilmistir

Bu nedenle sistem sadece ozellik bazli degil, veri erisimi bazli da korunmaktadir.

## 6. Veritabani ve Veri Modeli

Veritabani tarafinda uygulama cok sayida ISG odakli tablo icerir. Baslica veri alanlari:

- profiles
- organizations
- companies
- employees
- risk_assessments
- risk_items
- inspections
- findings
- capa_records
- board_meetings
- adep_plans
- osgb_* tablolari
- isgkatip_* tablolari

Bu model, hem bireysel kullanici senaryolarini hem de organizasyon/OSGB senaryolarini tasimak uzere tasarlanmistir.

## 7. AI Kullanim Alanlari

Projede AI dogrudan "sohbet" amacli degil, gorev odakli kullanilmistir.

Ornek kullanimlar:

- belge analizi
- hazard/risk yorumlama
- toplu CAPA onerileri
- kroki/tahliye destek akislari
- karar destek ve ozetleme

Bu, projeyi klasik form uygulamasindan ayiran temel farklardan biridir.

## 8. Kullanici Tipleri ve Yetkilendirme

Sistem tek tip kullaniciya gore degil, farkli rol ve senaryolara gore sekillenmistir.

Ornek roller:

- bireysel kullanici
- firma yetkilisi
- organizasyon uyeleri
- admin
- OSGB operasyon kullanicisi

Uygulamada hem route seviyesinde hem veri seviyesinde yetki kontrolu vardir.

## 9. Degerlendirme Icin Onerilen Demo Akisi

Bir ogretim uyesine uygulamayi gostermek icin asagidaki akis uygundur:

1. Giris ve genel dashboard
2. Firma olusturma ve calisan yonetimi
3. Risk degerlendirme sihirbazi
4. Denetim ve bulgu akisi
5. CAPA / Bulk CAPA gosteri
6. ADEP modulu
7. Kurul toplantisi ve raporlama
8. Belge analizi veya Blueprint Analyzer
9. OSGB modulu
10. ISG-Bot ekranlari

Bu akis, projenin hem klasik kurumsal yazilim kismini hem de yenilikci AI destekli kismini gostermeye yardimci olur.

## 10. Kurulum

### Gereksinimler

- Node.js 18+
- npm 9+ tavsiye edilir

### Kurulum Adimlari

```bash
npm install
npm run dev
```

Varsayilan gelistirme ortaminda uygulama Vite ile calisir.

## 11. Ortam Degiskenleri

Proje `.env` kullanir. Ornek dosya:

- `.env.example`

Baslica entegrasyonlar:

- Supabase URL ve anon key
- Google Gemini API key
- Google Maps API key
- Resend
- Stripe
- Sentry

Bu bilgilerin gercek degerleri guvenlik nedeniyle repoya dahil edilmemelidir.

## 12. Test ve Kalite

Projede birden fazla kalite katmani vardir:

- TypeScript tip guvenligi
- ESLint
- Vitest unit testleri
- Playwright E2E testleri

Kullanilan temel komutlar:

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run test:e2e
```

## 13. Projenin Guclu Yonleri

- Tek bir probleme degil, tam bir ISG operasyon alanina cozum sunmasi
- Klasik CRUD'un otesine gecip surec ve is akisi yonetmesi
- AI destekli analiz katmanlarina sahip olmasi
- Supabase tabanli modern web mimarisi kullanmasi
- Guvenlik sertlestirmesinin ciddi sekilde ele alinmis olmasi
- OSGB gibi daha zor ve kurumsal bir kullanim senaryosunu desteklemesi

## 14. Sinirlar ve Gelisime Acik Alanlar

Bu proje aktif gelisim mantiginda tasarlanmistir. Asagidaki alanlar ileride daha da guclendirilebilir:

- daha genis raporlama ve BI entegrasyonu
- mobil odakli saha akislari
- daha derin e-imza ve resmi sistem entegrasyonlari
- daha ileri yapay zeka destekli tahminleme
- daha genis otomasyon ve bildirim orkestrasyonu

## 15. Sonuc

isgvizyon, yalnizca veri girisi yapilan bir panel degil; ISG sureclerini dijitallestiren, takip eden, yorumlayan ve aksiyon ureten bir platform olarak tasarlanmistir.

Akademik veya teknik acidan bakildiginda proje su uc boyutta deger tasir:

- yazilim mimarisi
- alan problemi cozumleme
- uygulamali yenilikcilik

Kisacasi bu proje, ISG alanina yonelik modern, moduler, guvenlik odakli ve AI destekli bir yazilim platformudur.
