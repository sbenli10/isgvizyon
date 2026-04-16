# OSGB Platformu Yol Haritası

## Amaç

Denetron içindeki OSGB modülünü basit bir dashboard setinden çıkarıp Türkiye'deki OSGB firmalarının günlük işini gerçekten yöneten bir operasyon + mevzuat + finans + saha doğrulama platformuna dönüştürmek.

Bu hedef için temel ürün omurgası 4 katman üzerine kurulmalıdır:

1. Kurumsal çalışma modeli
2. Mevzuat ve dakika motoru
3. Saha hizmeti ve hizmet ispatı
4. Finans ve müşteri kârlılığı

## Bugünkü Durum

Mevcut modül şunları yapıyor:

- OSGB dashboard ile portföy görünümü veriyor
- Personel havuzu ve görevlendirme akışını yönetiyor
- Finans, evrak, görev ve not modülleri sunuyor
- Firma takip ekranında firma özelinde özet operasyon görünümü veriyor
- İSG-KATİP şirket verisini kullanıyor

En büyük mimari eksik:

- Birçok OSGB tablosu kullanıcı bazlı (`user_id`) kurgulanmış
- Kurum bazlı ekip çalışması, rol ayrımı ve çok kullanıcılı operasyon sınırlı
- Saha hizmetinin ispatı ve müşteriye dönük teslim kanıtı eksik
- Evrak sistemi mevzuat-temelli karar motoru seviyesinde değil
- Finans tarafı tahsilat listesi seviyesinde, cari ve kârlılık seviyesinde değil

## Yeni Veri Omurgası

Yeni migration ile şu yapı kuruluyor:

- Var olan `osgb_*` tabloları `organization_id` scope'una taşınıyor
- Yeni sözleşme yapısı: `osgb_service_contracts`, `osgb_contract_service_lines`
- Yeni saha yapısı: `osgb_field_visits`, `osgb_visit_personnel`, `osgb_visit_evidence`
- Yeni mevzuat yapısı: `osgb_obligation_catalog`, `osgb_company_obligations`
- Yeni dakika ve mevzuat snapshot yapısı: `osgb_monthly_company_compliance`
- Yeni finans özet yapısı: `osgb_finance_accounts`
- Yardımcı görünüm: `v_osgb_company_profitability`

Bu foundation, ürünün geri kalanını sürdürülebilir hale getirir.

## Hedef Ürün Modülleri

### 1. Kurumsal OSGB Operasyon Merkezi

Amaç:

- Tüm ekip aynı veri havuzunda çalışsın
- Roller ayrışsın
- Kimin neyi yöneteceği net olsun

Roller:

- `owner`
- `operations_manager`
- `secretary`
- `finance`
- `igu`
- `hekim`
- `dsp`

İlk ekran çıktıları:

- ekip doluluk görünümü
- şube/portföy bazlı dağılım
- izinli personel / yedek personel eşleştirme
- rol bazlı görev kuyruğu

### 2. Dakika ve Mevzuat Motoru

Amaç:

- “Bu ay hangi firmada mevzuat açığı var?” sorusunu tek ekranda cevaplamak

Temel motor:

- `calculate_osgb_required_minutes`
- `refresh_osgb_monthly_compliance`
- firma başına İGU, hekim, DSP zorunlu dakikaları
- atanan toplam dakika
- açık dakika
- fazla dakika
- mevzuat uyum durumu

İlk ekran çıktıları:

- bu ay açık dakika listesi
- rol bazlı kapasite açığı
- yedek personel önerisi
- sözleşme kapsamı ile fiili atama farkı

### 3. Saha Operasyonu ve Hizmet İspatı

Amaç:

- OSGB'nin verdiği hizmetin kanıtını üretmek

Temel akış:

- ziyaret planı oluştur
- personele ata
- check-in / check-out al
- fotoğraf / imza / tutanak ekle
- hizmet özetini kaydet
- gerekirse görev üret

Ziyaret tipleri:

- onsite visit
- board meeting
- training
- risk review
- emergency drill
- health surveillance
- periodic control
- document delivery
- remote consulting

İlk ekran çıktıları:

- günlük rota
- firma başına aylık ziyaret takvimi
- ziyaret kanıt eksikleri
- müşteriye sunulabilir hizmet geçmişi

### 4. Evrak ve Yükümlülük Otomasyonu

Amaç:

- sadece evrak listesi değil, neden gerekli ve riski ne onu göstermek

Temel yapı:

- `osgb_obligation_catalog`
- `osgb_company_obligations`
- `osgb_document_tracking`

İlk katalog başlıkları:

- risk assessment
- emergency plan
- board minutes
- annual training plan
- periodic controls

İlk ekran çıktıları:

- firma bazlı yükümlülük matrisi
- hangi belge neden gerekli
- ne kadar gecikti
- eksikse hangi görev oluşmalı
- müşteriye hangi bildirim gitmeli

### 5. Finans ve Müşteri Kârlılığı

Amaç:

- tahsilat listesinden çıkıp müşteri bazlı operasyon ekonomisini görmek

Temel yapı:

- `osgb_service_contracts`
- `osgb_contract_service_lines`
- `osgb_finance`
- `osgb_finance_accounts`
- `v_osgb_company_profitability`

İlk ekran çıktıları:

- tahakkuk
- tahsilat
- gecikme riski
- aylık tahmini marj
- müşteri kârlılığı
- portföyde zarar yazan firmalar

## Faz Planı

### Faz 1

Altyapı ve veri modeli

- organization scope migration
- rol ve RLS ayrımı
- sözleşme, saha, yükümlülük, finans hesap tabloları
- dakika hesap fonksiyonları

### Faz 2

OSGB dashboard yeniden yazımı

- kurum bazlı veri okuma
- açık dakika görünümü
- kritik yükümlülük görünümü
- saha doğrulama KPI'ları
- tahsilat baskısı ve marj kartları

### Faz 3

Görevlendirme ve kapasite motoru

- aylık planlama
- personel yedek öneri sistemi
- fazla/düşük yük uyarıları
- sözleşme satırı bazlı kapasite karşılaştırması

### Faz 4

Saha uygulama katmanı

- ziyaret planı
- check-in / check-out
- fotoğraf / imza / tutanak
- hizmet teslim kaydı

### Faz 5

Evrak ve mevzuat otomasyonu

- yükümlülük kataloğu genişletme
- firma tipi ve tehlike sınıfına göre otomatik öneri
- görev ve müşteri bildirimi üretimi

### Faz 6

Finans işletim sistemi

- cari görünüm
- sözleşme bazlı tahakkuk
- tahsilat planı
- tahmini kârlılık
- uzman yükü vs gelir ilişkisi

## Uygulama Önceliği

Tek seferde her ekranı yeniden yazmak yerine şu sırayla gitmek gerekir:

1. DB foundation migration
2. Dashboard veri kaynağını organization scope'a geçirmek
3. Assignments + Capacity ekranlarını yeni dakika motoruna bağlamak
4. Company Tracking ekranını sözleşme + yükümlülük + saha ile genişletmek
5. Saha ziyaret ekranlarını eklemek
6. Finans ekranını cari/kârlılık seviyesine taşımak

## Başarı Ölçütleri

Bu ürün gerçekten başarılı sayılmalıysa aşağıdaki sorular uygulama içinden cevaplanmalı:

- Bu ay hangi firmalarda mevzuat açığı var?
- Hangi uzmanın kapasitesi dolu veya eksik?
- Hangi hizmetler sahada gerçekten verildi ve kanıtı var?
- Hangi müşterinin hangi evrağı neden eksik?
- Hangi müşteriden ne kadar tahsilat riski var?
- Hangi portföy kârlı, hangisi operasyonu yoruyor?

## Sonuç

OSGB modülünün gerçek değer üreten ürün olması için odak nokta “ekran çoğaltmak” değil, “OSGB'nin günlük operasyonunu karar motoruna çevirmek” olmalıdır.

Bu repo içindeki yeni foundation migration bunun ilk ciddi adımıdır. Sonraki geliştirmeler artık dağınık değil, bu omurga üzerine yapılmalıdır.
