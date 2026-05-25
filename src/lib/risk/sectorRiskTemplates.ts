import { getSectorMinimumRiskItemCount, normalizeRiskSectorKey } from "@/lib/risk/riskTemplateConfig";

export type SectorRiskTemplate = {
  hazard: string;
  risk: string;
  category: string;
  o: number;
  f: number;
  s: number;
  controls: string[];
};

const ensureMinimumCount = <T,>(items: T[], minCount: number, factory: (index: number) => T) => {
  const nextItems = [...items];
  while (nextItems.length < minCount) {
    nextItems.push(factory(nextItems.length));
  }
  return nextItems;
};

const COMMON_TEMPLATE_RISKS: SectorRiskTemplate[] = [
  {
    hazard: "Acil Çıkışların Kapanması",
    risk: "Acil çıkış kapılarının malzeme ve ekipmanla kapatılması tahliye süresini uzatabilir.",
    category: "Acil Durum",
    o: 6,
    f: 6,
    s: 15,
    controls: ["Panik, dumana maruziyet, ezilme ve tahliye gecikmesi oluşabilir.", "Acil çıkışlar sürekli açık tutulmalı, günlük saha kontrol listesine dahil edilmelidir."],
  },
  {
    hazard: "Yangın Söndürücü Erişimi",
    risk: "Yangın söndürücülerin erişiminin kısıtlı olması veya periyodik kontrollerinin yapılmaması ilk müdahaleyi geciktirebilir.",
    category: "Yangın",
    o: 3,
    f: 3,
    s: 40,
    controls: ["Yangının büyümesi, yaralanma ve maddi hasar meydana gelebilir.", "Yangın söndürücüler görünür alanlarda tutulmalı ve bakım etiketleri düzenli kontrol edilmelidir."],
  },
  {
    hazard: "Kaygan Geçiş Alanı",
    risk: "Saha içinde dökülme ve temizlik sonrası kaygan zemin oluşması çalışanların dengesini bozabilir.",
    category: "Kayma / Düşme",
    o: 10,
    f: 10,
    s: 7,
    controls: ["Kayma, düşme, burkulma veya kırık oluşabilir.", "Dökülmeler derhal temizlenmeli, kaymaz zemin ve uyarı levhası kullanılmalıdır."],
  },
  {
    hazard: "Yetersiz Aydınlatma",
    risk: "Çalışma alanlarında aydınlatma seviyesinin düşük olması güvenli çalışma görüşünü azaltabilir.",
    category: "Fiziksel Etken",
    o: 6,
    f: 6,
    s: 7,
    controls: ["Takılma, çarpma, hatalı işlem ve göz yorgunluğu oluşabilir.", "Lux ölçümleri yapılmalı ve karanlık alanlarda ilave aydınlatma planlanmalıdır."],
  },
  {
    hazard: "Eğitim ve Talimat Eksikliği",
    risk: "Göreve özel eğitim verilmeden çalışma yaptırılması yanlış uygulama ve kaza ihtimalini artırabilir.",
    category: "Yönetimsel",
    o: 6,
    f: 6,
    s: 15,
    controls: ["Hatalı işlem, yaralanma ve ekipman hasarı oluşabilir.", "Göreve başlama öncesi eğitim kayıtları tamamlanmalı ve talimat imza karşılığı tebliğ edilmelidir."],
  },
  {
    hazard: "KKD Kullanım Disiplini",
    risk: "İşe uygun kişisel koruyucu donanımın kullanılmaması maruziyetlerin etkisini artırabilir.",
    category: "KKD",
    o: 6,
    f: 10,
    s: 15,
    controls: ["Göz, baş, ayak, el ve solunum yaralanmaları oluşabilir.", "İşe uygun KKD matrisi belirlenmeli, saha denetimlerinde kullanım doğrulanmalıdır."],
  },
  {
    hazard: "İlk Yardım Erişimi",
    risk: "İlk yardım ekipmanı ve eğitimli personel eksikliği olay sonrası müdahale süresini uzatabilir.",
    category: "Acil Durum",
    o: 3,
    f: 3,
    s: 15,
    controls: ["Yaralanmanın ağırlaşması ve müdahalenin gecikmesi oluşabilir.", "İlk yardım dolapları standart tutulmalı, ekip ve vardiya kapsamı düzenli kontrol edilmelidir."],
  },
  {
    hazard: "İşaretleme ve Uyarı Levhası Eksikliği",
    risk: "Tehlikeli alanlarda yeterli yönlendirme bulunmaması çalışanların hatalı alana girmesine neden olabilir.",
    category: "Yönetimsel",
    o: 6,
    f: 6,
    s: 7,
    controls: ["Yanlış alana giriş, maruziyet ve ikincil kazalar oluşabilir.", "Tehlike levhaları görünür seviyede standardize edilmeli ve düzenli yenilenmelidir."],
  },
  {
    hazard: "Bakım ve Periyodik Kontrol Takibi",
    risk: "Makine, ekipman veya tesisatların planlı bakım kayıtlarının eksik tutulması arıza riskini yükseltebilir.",
    category: "Bakım",
    o: 6,
    f: 6,
    s: 15,
    controls: ["Arıza, duruş, yangın veya yaralanma oluşabilir.", "Periyodik kontrol planı dijital takvimle izlenmeli ve bakım sonrası doğrulama yapılmalıdır."],
  },
  {
    hazard: "Elle Taşıma",
    risk: "Ağır, düzensiz veya tekrarlı kaldırma işlemleri kas-iskelet sistemi zorlanmasına yol açabilir.",
    category: "Ergonomi",
    o: 10,
    f: 10,
    s: 7,
    controls: ["Bel, omuz ve diz yaralanmaları oluşabilir.", "Kaldırma yardımcıları, ekip işi ve taşıma eğitimi ile yük sınırları uygulanmalıdır."],
  },
];

const CONSTRUCTION_RISKS: SectorRiskTemplate[] = [
  { hazard: "İskele Korkuluk Eksikliği", risk: "İskele platformunda topuk levhası ve ara korkuluk bulunmaması düşme riskini artırabilir.", category: "Yüksekte Çalışma", o: 6, f: 6, s: 100, controls: ["Yüksekten düşme sonucu ağır yaralanma veya ölüm oluşabilir.", "İskeleler yetkili kişi tarafından teslim alınmalı, korkuluk ve topuk levhası standart hale getirilmelidir."] },
  { hazard: "İskele Ankraj Yetersizliği", risk: "İskelenin yapıya uygun noktalardan sabitlenmemesi devrilme ve çökme oluşturabilir.", category: "İskele Güvenliği", o: 3, f: 3, s: 100, controls: ["İskele çökmesi, çoklu yaralanma ve ölüm oluşabilir.", "İskele ankraj planı hazırlanmalı, kurulum sonrası kontrol formu onaylanmalıdır."] },
  { hazard: "Merdivenle Uygunsuz Erişim", risk: "Sabitlenmemiş seyyar merdivenle yan eğimli erişim yapılması düşmeye neden olabilir.", category: "Yüksekte Çalışma", o: 6, f: 6, s: 40, controls: ["Düşme sonucu kırık, kafa travması ve iş göremezlik oluşabilir.", "Merdivenler 4/1 kuralına göre kurulmalı ve çalışma platformu yerine kullanılmamalıdır."] },
  { hazard: "Çatı Kenarında Yaşam Hattı Eksikliği", risk: "Çatı ve parapet kenarında yaşam hattı kurulmadan çalışma yapılması düşme riski doğurur.", category: "Çatı Çalışması", o: 6, f: 6, s: 100, controls: ["Yüksekten düşme ve ölüm oluşabilir.", "Yaşam hattı, ankraj noktası ve emniyet kemeri bağlantısı çalışma öncesi doğrulanmalıdır."] },
  { hazard: "Açık Kenar Boşluğu", risk: "Asansör boşluğu veya döşeme kenarlarının bariyersiz bırakılması çalışan ve malzeme düşmesine yol açabilir.", category: "Düşme", o: 6, f: 6, s: 100, controls: ["Çalışan düşmesi, malzeme düşmesi ve ağır travma oluşabilir.", "Açık kenarlar kapak, bariyer ve kırmızı-beyaz işaretleme ile korunmalıdır."] },
  { hazard: "Kazı Kenarında Şev Hatası", risk: "Kazı kenarlarında şev açısının zemine uygun verilmeyişi göçük riski oluşturabilir.", category: "Kazı Çalışması", o: 3, f: 3, s: 100, controls: ["Göçük altında kalma ve ölüm oluşabilir.", "Kazı izin formu, şev hesabı ve iksa sistemi uzman kontrolünde uygulanmalıdır."] },
  { hazard: "Kazı İçine Kontrolsüz Giriş", risk: "Gaz ölçümü ve giriş izni olmadan kazı içine inmek oksijen yetersizliği ve çökme riski doğurabilir.", category: "Kapalı Alan / Kazı", o: 3, f: 3, s: 100, controls: ["Boğulma, zehirlenme veya göçük altında kalma oluşabilir.", "Giriş öncesi gaz ölçümü, gözcü ve kurtarma planı uygulanmalıdır."] },
  { hazard: "Demir Donatı Uçları", risk: "Korumalı başlık takılmamış filiz demirlere çarpma ve saplanma yaşanabilir.", category: "Betonarme", o: 6, f: 6, s: 15, controls: ["Delici yaralanma, göz ve karın travması oluşabilir.", "Tüm açık donatı uçlarına mantar başlık takılmalı ve alan sınırlandırılmalıdır."] },
  { hazard: "Kalıp Altında Yetkisiz Bekleme", risk: "Kalıp sökümü sırasında alt bölgede personel bulunması malzeme düşmesi yaratabilir.", category: "Kalıp İşleri", o: 3, f: 6, s: 40, controls: ["Baş yaralanması, ezilme ve ölüm oluşabilir.", "Kalıp söküm alanı şeritlenmeli ve söküm sırasında alt alana giriş yasaklanmalıdır."] },
  { hazard: "Beton Pompası Hortum Sıçraması", risk: "Beton dökümü sırasında hat sabitlenmezse hortum savrulması operatöre çarpabilir.", category: "Beton Dökümü", o: 6, f: 6, s: 15, controls: ["Çarpma, düşme ve uzuv yaralanmaları oluşabilir.", "Pompa hattı kelepçeleri kontrol edilmeli ve hortum yöneticisi görevlendirilmelidir."] },
  { hazard: "Kule Vinç Yük Altında Geçiş", risk: "Askıdaki yük altında personel veya araç geçişi yapılması ezilme riski oluşturur.", category: "Kaldırma Operasyonu", o: 3, f: 6, s: 100, controls: ["Yük düşmesi ve ölüm oluşabilir.", "Yük altı güvenlik koridoru oluşturulmalı, sinyalci ve alan kapaması uygulanmalıdır."] },
  { hazard: "Sapan ve Kanca Uygunsuzluğu", risk: "Hasarlı sapan ve emniyet mandalsız kanca kullanımı yük düşmesine neden olabilir.", category: "Kaldırma Operasyonu", o: 3, f: 3, s: 100, controls: ["Ezilme, ekipman hasarı ve ölüm oluşabilir.", "Sapan ve kancalar renk kodlu periyodik kontrole alınmalı, hasarlı ekipman derhal ayrılmalıdır."] },
  { hazard: "Geri Manevra Kör Noktası", risk: "Şantiye içi kamyon ve iş makinelerinde geri görüş desteği olmaması çarpışma doğurabilir.", category: "Şantiye Trafiği", o: 6, f: 10, s: 40, controls: ["Ezilme, sıkışma ve ölüm oluşabilir.", "Geri vites alarmı, spotter personel ve tek yönlü trafik planı uygulanmalıdır."] },
  { hazard: "Geçici Elektrik Panosu", risk: "Şantiye panolarında kapak, kaçak akım rölesi ve topraklama eksikliği elektrik çarpmasına neden olabilir.", category: "Elektrik", o: 3, f: 6, s: 100, controls: ["Elektrik çarpması, yanık ve ölüm oluşabilir.", "Geçici panolar IP korumalı olmalı, RCD ve topraklama ölçümleri kayıt altına alınmalıdır."] },
  { hazard: "Kablo Gelişigüzel Geçişi", risk: "Yaya yolundan geçen uzatma kabloları takılma ve izolasyon hasarı oluşturabilir.", category: "Elektrik", o: 6, f: 10, s: 7, controls: ["Takılma, düşme ve elektrik teması oluşabilir.", "Kablolar tavadan veya kablo köprüsü üzerinden geçirilmelidir."] },
  { hazard: "El Aleti Koruyucu Eksikliği", risk: "Spiral taşlama veya kırıcı delicide koruyucusuz çalışma sıçrama ve kopma yaratabilir.", category: "El Aletleri", o: 6, f: 6, s: 15, controls: ["Göz yaralanması, kesik ve yüz travması oluşabilir.", "Disk koruyucusu, uygun disk seçimi ve yüz siperi zorunlu tutulmalıdır."] },
  { hazard: "Sıcak Çalışma İzni", risk: "Kaynak ve kesim işlerinde izin formu olmadan yanıcı ortama giriş yangın başlatabilir.", category: "Sıcak Çalışma", o: 3, f: 3, s: 40, controls: ["Yangın, patlama ve ciddi yanıklar oluşabilir.", "Sıcak çalışma izni, yangın gözcüsü ve kıvılcım perdesi uygulanmalıdır."] },
  { hazard: "Yanıcı Tüp Depolaması", risk: "Oksijen ve LPG tüplerinin yan yana ve sabitlenmeden tutulması patlayıcı ortam yaratabilir.", category: "Yangın / Patlama", o: 3, f: 3, s: 40, controls: ["Patlama, yangın ve ciddi yaralanmalar oluşabilir.", "Tüpler zincirlenmeli, türlerine göre ayrılmalı ve gölgeli alanda depolanmalıdır."] },
  { hazard: "Şantiye Kaçış Yolları", risk: "Malzeme depolaması nedeniyle acil kaçış yollarının daralması tahliyeyi geciktirebilir.", category: "Acil Durum", o: 6, f: 6, s: 15, controls: ["Panik, ezilme ve dumana maruziyet oluşabilir.", "Kaçış koridorları işaretlenmeli ve günlük saha turunda engel kontrolü yapılmalıdır."] },
  { hazard: "Tozlu Kesim İşleri", risk: "Seramik, beton ve taş kesiminde sulu kesim veya emiş olmaması silika maruziyeti oluşturabilir.", category: "Toz Maruziyeti", o: 10, f: 10, s: 15, controls: ["Silikoz, kronik akciğer hastalığı ve göz tahrişi oluşabilir.", "Sulu kesim, lokal emiş ve FFP3 maske standardı uygulanmalıdır."] },
  { hazard: "Gürültülü Kırım ve Delme", risk: "Hilti ve kırıcı ekipmanla uzun süre çalışma işitme kaybı yaratabilir.", category: "Fiziksel Etken", o: 10, f: 10, s: 7, controls: ["İşitme kaybı, dikkat azalması ve stres oluşabilir.", "Gürültü ölçümü yapılmalı, kulak koruyucu kullanımı denetlenmelidir."] },
  { hazard: "Titreşimli Ekipman Kullanımı", risk: "Kırıcı ve sıkıştırma ekipmanlarının uzun süreli kullanımı el-kol titreşim sendromu oluşturabilir.", category: "Fiziksel Etken", o: 6, f: 10, s: 7, controls: ["Dolaşım ve sinir sistemi etkilenmesi oluşabilir.", "Maruziyet süreleri sınırlandırılmalı ve titreşim sönümleyici ekipman kullanılmalıdır."] },
  { hazard: "Kimyasal Kür ve Katkılar", risk: "Beton katkıları, çözücüler veya yapıştırıcılarla çıplak temas cilt ve göz etkilenmesine neden olabilir.", category: "Kimyasal", o: 6, f: 6, s: 15, controls: ["Kimyasal yanık, tahriş ve solunum etkilenmesi oluşabilir.", "SDS erişimi sağlanmalı, göz duşu ve kimyasala dayanıklı eldiven kullanılmalıdır."] },
  { hazard: "Baret ve Emniyet Kemeri Disiplini", risk: "Şantiye girişinde KKD kontrolünün zayıf olması düşme ve çarpma etkisini artırabilir.", category: "KKD", o: 6, f: 10, s: 15, controls: ["Kafa travması, düşme sonrası ağır yaralanma oluşabilir.", "Turnike veya saha girişinde KKD kontrol noktası kurulmalıdır."] },
  { hazard: "Alt Yüklenici Koordinasyonu", risk: "Birden fazla alt yüklenicinin aynı alanda eş zamanlı çalışması çapraz riskler oluşturabilir.", category: "Koordinasyon", o: 6, f: 6, s: 15, controls: ["Çarpışma, düşme, yanlış enerji verme veya yangın oluşabilir.", "Günlük koordinasyon toplantısı ve alan bazlı izin sistemi uygulanmalıdır."] },
  { hazard: "Gece Çalışması Aydınlatması", risk: "Gece vardiyasında çalışma alanlarının homojen aydınlatılmaması çarpma ve düşme oluşturabilir.", category: "Gece Çalışması", o: 6, f: 6, s: 15, controls: ["Düşme, araç çarpması ve yanlış işlem oluşabilir.", "Gece çalışması öncesi aydınlatma kontrol listesi ve ilave projektör planı hazırlanmalıdır."] },
  { hazard: "Olumsuz Hava Koşulları", risk: "Rüzgarlı ve yağışlı havada yüksekte çalışma sürdürülmesi denge kaybına neden olabilir.", category: "Çevresel Etken", o: 6, f: 6, s: 40, controls: ["Yüksekten düşme, yıldırım ve kontrol kaybı oluşabilir.", "Rüzgar ve yağış limitleri belirlenmeli, limit aşımında iş durdurulmalıdır."] },
  { hazard: "Malzeme Depolama Düzeni", risk: "Boru, kalas ve profillerin yuvarlanmaya karşı takozsuz istiflenmesi malzeme devrilmesine yol açabilir.", category: "Depolama", o: 6, f: 6, s: 15, controls: ["Ezilme, sıkışma ve ayak yaralanması oluşabilir.", "Malzemeler takoz ve bariyer ile sabitlenmeli, yükseklik limitleri uygulanmalıdır."] },
  { hazard: "Sosyal Alan Hijyeni", risk: "Soyunma, yemek ve tuvalet alanlarının yetersiz hijyeni bulaşıcı hastalık ve memnuniyetsizlik oluşturabilir.", category: "Hijyen", o: 6, f: 6, s: 7, controls: ["Hastalık yayılımı, devamsızlık ve hijyen şikayetleri oluşabilir.", "Sosyal alan temizlik planı, atık ayrıştırma ve su kontrolleri düzenli yapılmalıdır."] },
  { hazard: "Şantiye Giriş Kontrolü", risk: "Yetkisiz kişilerin sahaya kontrolsüz girmesi araç ve düşen cisim riskine maruz kalmasına neden olabilir.", category: "Erişim Kontrolü", o: 3, f: 3, s: 40, controls: ["Üçüncü kişilerin yaralanması ve güvenlik ihlali oluşabilir.", "Saha girişleri kartlı sistem ve ziyaretçi bilgilendirme prosedürü ile yönetilmelidir."] },
  { hazard: "İlk Yardım ve Kurtarma Hazırlığı", risk: "Şantiye büyük alanlarında ekipman ve personelin dağınık olması olay yerine müdahaleyi geciktirebilir.", category: "Acil Durum", o: 3, f: 3, s: 15, controls: ["Yaralanmanın ağırlaşması ve tahliye gecikmesi oluşabilir.", "Toplanma noktaları, kurtarma sedyesi ve vardiya bazlı ilk yardımcı planı görünür tutulmalıdır."] },
  { hazard: "Yangın Söndürme Ekipmanı Erişimi", risk: "Kaynak ve kalıp alanlarında söndürme ekipmanının uzak konumlandırılması ilk müdahaleyi geciktirebilir.", category: "Yangın", o: 3, f: 3, s: 40, controls: ["Yangının büyümesi ve ekipman hasarı oluşabilir.", "Sıcak çalışma alanlarına portatif söndürücü ve yangın battaniyesi yakın yerleştirilmelidir."] },
  { hazard: "Şantiye İçi Yaya Yolu Eksikliği", risk: "Yaya yollarının iş makinesi yollarıyla ayrılmaması yaya çarpışmasına neden olabilir.", category: "Şantiye Trafiği", o: 6, f: 10, s: 40, controls: ["Çarpma, ezilme ve ölüm oluşabilir.", "Yaya güzergahları bariyerle ayrılmalı, zemin işaretleme yenilenmelidir."] },
  { hazard: "Mobil Platform Emniyeti", risk: "Makaslı platformda korkuluk dışına sarkarak çalışma yapılması düşme riski doğurabilir.", category: "Yüksekte Çalışma", o: 6, f: 6, s: 40, controls: ["Platformdan düşme ve ciddi travma oluşabilir.", "Platform kullanıcı eğitimi ve tam vücut kemeri bağlantısı zorunlu tutulmalıdır."] },
  { hazard: "Prefabrik Montaj Hizalama", risk: "Prefabrik eleman montajında geçici sabitleme yapılmadan bağlantı çözülmesi eleman devrilmesine yol açabilir.", category: "Montaj", o: 3, f: 3, s: 100, controls: ["Ezilme, göçme ve ölüm oluşabilir.", "Montaj sırası mühendis onayıyla belirlenmeli, geçici sabitleme sökülmeden alan açılmamalıdır."] },
];

const FACTORY_RISKS: SectorRiskTemplate[] = [
  { hazard: "Makine Koruyucu Sökülmesi", risk: "Pres ve kesim makinelerinde koruyucu switch devre dışı bırakıldığında çalışan hareketli aksama temas edebilir.", category: "Makine Güvenliği", o: 6, f: 6, s: 40, controls: ["El sıkışması, uzuv kaybı ve ciddi travma oluşabilir.", "Koruyucu switch by-pass denetimi yapılmalı, emniyet rölesi müdahaleleri kayıt altına alınmalıdır."] },
  { hazard: "Dönen Aksam Teması", risk: "Kayış, kasnak ve mil koruyucularının eksik olması kıyafet veya uzuv kaptırmaya yol açabilir.", category: "Makine Güvenliği", o: 6, f: 6, s: 40, controls: ["Sıkışma, ezilme ve uzuv kaybı oluşabilir.", "Tüm dönen aksamlar muhafaza altına alınmalı ve açılır koruyucular interlocklu olmalıdır."] },
  { hazard: "Pres Çift El Kumanda Eksikliği", risk: "Preslerde iki el kumanda veya ışık perdesi bulunmaması kalıp bölgesine el girmesine neden olabilir.", category: "Pres Güvenliği", o: 6, f: 6, s: 40, controls: ["El ezilmesi ve amputasyon oluşabilir.", "Çift el kumanda, ışık perdesi ve kalıp değişimi sonrası doğrulama testleri uygulanmalıdır."] },
  { hazard: "LOTO Uygulama Eksikliği", risk: "Bakım öncesi enerji kesme ve kilitleme yapılmadan makineye müdahale edilmesi ani çalışma yaratabilir.", category: "Bakım Onarım", o: 3, f: 6, s: 100, controls: ["Sıkışma, elektrik çarpması ve ölüm oluşabilir.", "LOTO prosedürü tüm enerji kaynaklarını kapsayacak şekilde bakım izin sistemine bağlanmalıdır."] },
  { hazard: "Elektrik Panosunda Yetkisiz Müdahale", risk: "Açık panolara yetkisiz personelin müdahalesi kısa devre ve ark flaşı oluşturabilir.", category: "Elektrik", o: 3, f: 3, s: 100, controls: ["Elektrik çarpması, ark yanığı ve yangın oluşabilir.", "Pano kilitleme, yetki matrisi ve termal kamera kontrolleri uygulanmalıdır."] },
  { hazard: "Topraklama Sürekliliği", risk: "Makine gövdelerinde topraklama sürekliliği bozulduğunda kaçak akım çalışanı etkileyebilir.", category: "Elektrik", o: 3, f: 3, s: 40, controls: ["Elektrik çarpması ve yangın oluşabilir.", "Topraklama ölçümleri planlı yapılmalı ve uygunsuzluklar etiketlenmelidir."] },
  { hazard: "Gürültülü Üretim Hattı", risk: "Pres, kompresör ve fanların 85 dB(A) üstü gürültü üretmesi işitme kaybı yaratabilir.", category: "Fiziksel Etken", o: 10, f: 10, s: 7, controls: ["İşitme kaybı, dikkat bozulması ve stres oluşabilir.", "Gürültü haritası çıkarılmalı, kabinleme ve kulak koruyucu kullanımı doğrulanmalıdır."] },
  { hazard: "Titreşimli El Aletleri", risk: "Sürekli taşlama ve darbeli el aleti kullanımı el-kol titreşim sendromu oluşturabilir.", category: "Fiziksel Etken", o: 6, f: 10, s: 7, controls: ["Uyuşma, dolaşım bozukluğu ve kas yorgunluğu oluşabilir.", "Maruziyet süreleri sınırlandırılmalı ve düşük titreşimli ekipman seçilmelidir."] },
  { hazard: "Kaynak Dumanı Birikimi", risk: "Kaynak yapılan kabinlerde lokal emişin çalışmaması metal dumanı maruziyeti yaratabilir.", category: "Kimyasal / Fiziksel", o: 6, f: 10, s: 15, controls: ["Solunum yolu etkilenmesi, göz tahrişi ve kronik maruziyet oluşabilir.", "Lokal emiş debisi ölçülmeli, maske ve alan havalandırması yeterliliği doğrulanmalıdır."] },
  { hazard: "Toz ve Duman Yükü", risk: "Kesim, dolum veya paketleme alanlarında toz bulutu oluşması solunum ve patlayıcı ortam riskini artırabilir.", category: "Toz Maruziyeti", o: 6, f: 10, s: 15, controls: ["Solunum rahatsızlığı, görüş kaybı ve yangın oluşabilir.", "Lokal emiş, düzenli temizlik ve ATEX uygunluğu değerlendirilmelidir."] },
  { hazard: "Yanıcı Kimyasal Depolama", risk: "Solvent, boya ve tinerlerin havalandırmasız depoda tutulması yangın ve patlama oluşturabilir.", category: "Kimyasal", o: 3, f: 3, s: 40, controls: ["Yangın, patlama ve toksik maruziyet oluşabilir.", "Yanıcı kimyasallar yangına dayanımlı dolapta, SDS erişimiyle ve uyumlu depolanmalıdır."] },
  { hazard: "Sıcak Yüzey Teması", risk: "Fırın, rezistans ve ısıtılmış kalıp bölgelerinde yüzey sıcaklıkları korunmadan bırakılabilir.", category: "Termal Risk", o: 6, f: 6, s: 15, controls: ["Yanık, refleksle düşme ve iş göremezlik oluşabilir.", "Sıcak yüzeyler bariyerlenmeli ve temassız termal uyarılar kullanılmalıdır."] },
  { hazard: "Basınçlı Kap Takibi", risk: "Kompresör, hava tankı ve hidroforların periyodik kontrolünün aksaması patlama riski doğurabilir.", category: "Basınçlı Ekipman", o: 3, f: 3, s: 40, controls: ["Patlama, şarapnel etkisi ve ölüm oluşabilir.", "Periyodik muayene tarihi görünür etiketlenmeli ve emniyet ventili test edilmelidir."] },
  { hazard: "Forklift Yaya Ayırımı", risk: "Forklift yolları ile üretim içi yaya geçişlerinin ayrılmaması çarpışma oluşturabilir.", category: "Araç Güvenliği", o: 6, f: 10, s: 40, controls: ["Ezilme, çarpma ve ölüm oluşabilir.", "Yaya bariyeri, hız limiti ve kör nokta aynaları kurulmalıdır."] },
  { hazard: "Raf Emniyet Pimi Eksikliği", risk: "Depo raf traverslerinde emniyet pimlerinin eksik olması yük devrilmesine yol açabilir.", category: "Depolama", o: 6, f: 6, s: 15, controls: ["Malzeme düşmesi ve ezilme oluşabilir.", "Raf güvenlik denetimi ve yük etiketi uygulaması yapılmalıdır."] },
  { hazard: "Ergonomik Yüksek Tempo", risk: "Tekrarlı montaj hattı işleri kısa çevrimde kas-iskelet sistemi zorlanmasına neden olabilir.", category: "Ergonomi", o: 10, f: 10, s: 7, controls: ["Bel, boyun, omuz ve el bileği rahatsızlıkları oluşabilir.", "İş rotasyonu, ayarlanabilir tezgah ve mikro mola planı oluşturulmalıdır."] },
  { hazard: "Kayma ve Takılma", risk: "Hat kenarındaki palet, hortum ve dökülmeler geçiş yollarında takılma yaratabilir.", category: "Düzen ve Temizlik", o: 10, f: 10, s: 7, controls: ["Düşme, burkulma ve ikincil çarpışmalar oluşabilir.", "5S alan denetimi, hortum askısı ve geçiş yolu standardı uygulanmalıdır."] },
  { hazard: "Zemin Hasarı", risk: "Çatlak ve bozulmuş zeminler transpalet ve yaya için dengesizlik oluşturabilir.", category: "Altyapı", o: 6, f: 6, s: 7, controls: ["Düşme, ekipman devrilmesi ve ürün hasarı oluşabilir.", "Bozuk zeminler iş planına alınmalı ve geçici uyarı ile korunmalıdır."] },
  { hazard: "Yetersiz Havalandırma", risk: "Kapalı üretim alanlarında hava değişim oranının düşük olması duman ve ısı birikimi yaratabilir.", category: "Fiziksel Etken", o: 6, f: 10, s: 7, controls: ["Baş ağrısı, yorgunluk ve maruziyet artışı oluşabilir.", "Alan bazlı havalandırma debileri ölçülmeli ve bakım takvimi uygulanmalıdır."] },
  { hazard: "Acil Çıkışa İstif Yapılması", risk: "Üretim yoğunluğunda acil çıkış önlerine geçici malzeme bırakılması tahliye akışını kesebilir.", category: "Acil Durum", o: 6, f: 6, s: 15, controls: ["Tahliye gecikmesi ve panik oluşabilir.", "Acil çıkış önü kırmızı çizgi ile ayrılmalı ve anlık depo alanı olarak kullanılmamalıdır."] },
  { hazard: "Yangın Algılama Kör Noktası", risk: "Tozlu ve sıcak alanlarda dedektör kapsamasının yetersiz kalması yangını geç algılatabilir.", category: "Yangın", o: 3, f: 3, s: 40, controls: ["Yangının büyümesi ve ekipman hasarı oluşabilir.", "Yangın algılama zonları prosese göre gözden geçirilmeli ve test kayıtları tutulmalıdır."] },
  { hazard: "Bakım Sonrası Test Eksikliği", risk: "Bakım sonrası koruyucu ve emniyet ekipmanlarının fonksiyon testi yapılmaması gizli arıza bırakabilir.", category: "Bakım Onarım", o: 3, f: 6, s: 40, controls: ["Beklenmeyen hareket, arıza ve yaralanma oluşabilir.", "Bakım sonrası devreye alma checklisti ve operatör teslim formu kullanılmalıdır."] },
  { hazard: "Operatör Yetkinlik Açığı", risk: "Yeni operatörün makine talimatı ve ayar noktalarını bilmeden tek başına çalışması hata riski oluşturabilir.", category: "Eğitim", o: 6, f: 6, s: 15, controls: ["Yanlış ayar, ürün hasarı ve yaralanma oluşabilir.", "Yetkinlik matrisi, usta gözetimi ve devralma süreci tanımlanmalıdır."] },
  { hazard: "SDS Erişim Eksikliği", risk: "Kimyasal kullanılan alanda güvenlik bilgi formlarının erişilebilir olmaması müdahaleyi geciktirebilir.", category: "Kimyasal", o: 6, f: 6, s: 15, controls: ["Yanlış müdahale, tahriş ve yangın riski oluşabilir.", "SDS panosu kurulmalı ve çalışanlara kimyasal acil durum eğitimi verilmelidir."] },
  { hazard: "Atık Ayrıştırma Hatası", risk: "Tehlikeli atık, yağlı bez ve genel atığın karışması yangın ve çevre riski yaratabilir.", category: "Atık Yönetimi", o: 6, f: 6, s: 15, controls: ["Yangın, sızıntı ve mevzuat uygunsuzluğu oluşabilir.", "Renk kodlu atık sistemi ve geçici depolama alanı düzeni standardize edilmelidir."] },
  { hazard: "Üretim Hattında Sıkışma Noktası", risk: "Konveyör geçişlerinde sıkışma noktalarının işaretlenmemesi el-kol temasına yol açabilir.", category: "Üretim Hattı", o: 6, f: 6, s: 15, controls: ["Sıkışma, ezilme ve kesik oluşabilir.", "Sıkışma noktaları piktogramla işaretlenmeli ve acil stop erişimi iyileştirilmelidir."] },
  { hazard: "Acil Stop Erişimi", risk: "Acil stop butonlarının önü kapalı olduğunda olay anında durdurma gecikebilir.", category: "Makine Güvenliği", o: 3, f: 6, s: 40, controls: ["Makinenin durmaması sonucu ciddi yaralanma oluşabilir.", "Acil stop çevresi boş bırakılmalı ve işlev testleri vardiya öncesi yapılmalıdır."] },
  { hazard: "Temizlik Sırasında Enerjili Çalışma", risk: "Hat temizliği sırasında ekipman enerjisinin kesilmemesi aniden hareket oluşturabilir.", category: "Temizlik / Bakım", o: 3, f: 6, s: 40, controls: ["Sıkışma, kesilme ve amputasyon oluşabilir.", "Temizlik prosedürüne enerji kesme adımı ve kilit kartı uygulaması eklenmelidir."] },
  { hazard: "Kompresör Gürültü ve Isı Yükü", risk: "Kompresör odasında sıcaklık ve gürültünün yüksek olması bakım personelini etkileyebilir.", category: "Fiziksel Etken", o: 6, f: 6, s: 7, controls: ["İşitme kaybı, sıcak stres ve yorgunluk oluşabilir.", "Oda havalandırması iyileştirilmeli ve bakım süresi planlanmalıdır."] },
  { hazard: "Yetersiz İçme Suyu ve Dinlenme Alanı", risk: "Sıcak proseslerde dinlenme alanı ve su erişimi zayıf olduğunda performans düşebilir.", category: "Çalışma Koşulları", o: 6, f: 6, s: 7, controls: ["Sıcak stres, dikkatsizlik ve hata artışı oluşabilir.", "Dinlenme noktaları, soğuk su erişimi ve sıcak ortam molaları planlanmalıdır."] },
  { hazard: "Ramak Kala Bildirim Eksikliği", risk: "Yakın tehlike olaylarının raporlanmaması tekrar eden kazalara zemin hazırlayabilir.", category: "Yönetimsel", o: 6, f: 6, s: 7, controls: ["Aynı nedenli kazaların tekrarı ve kök nedenin gizli kalması oluşabilir.", "Ramak kala bildirimi teşvik edilmeli ve düzeltici faaliyetler haftalık takip edilmelidir."] },
  { hazard: "İlk Yardım Alanına Uzaklık", risk: "Geniş üretim sahasında ilk yardım ekipmanına erişimin uzak olması müdahaleyi geciktirebilir.", category: "Acil Durum", o: 3, f: 3, s: 15, controls: ["Yaralanmanın ağırlaşması oluşabilir.", "Hat bazlı ilk yardım noktaları ve vardiya listeleri güncel tutulmalıdır."] },
  { hazard: "Aydınlatma Kör Noktası", risk: "Makine arkasında veya depo koridorunda gölgeli alan kalması operatör görüşünü bozabilir.", category: "Altyapı", o: 6, f: 6, s: 7, controls: ["Takılma, yanlış kullanım ve çarpma oluşabilir.", "Bakım ekibiyle kör noktalar tespit edilip ilave armatür planlanmalıdır."] },
  { hazard: "Palet ve Sevkiyat Düzeni", risk: "Sevkiyat öncesi paletlerin sarılmadan veya dengesiz hazırlanması yük kaymasına neden olabilir.", category: "Sevkiyat", o: 6, f: 6, s: 15, controls: ["Yük düşmesi, ezilme ve ürün hasarı oluşabilir.", "Palet sarma standardı ve forklift yükleme kontrolü uygulanmalıdır."] },
];

const METAL_RISKS: SectorRiskTemplate[] = [
  { hazard: "Taşlama Kıvılcım Saçılması", risk: "Kıvılcım perdesi olmadan taşlama yapılması çevredeki personeli ve yanıcı maddeleri etkileyebilir.", category: "Taşlama", o: 6, f: 6, s: 15, controls: ["Göz yaralanması, yanık ve yangın oluşabilir.", "Taşlama alanı perde ile ayrılmalı ve kıvılcım yönü kontrol edilmelidir."] },
  { hazard: "Keskin Sac Kenarı", risk: "İşlenmiş sac ve profil köşelerinin çapaksız bırakılması el kesisi oluşturabilir.", category: "Kesici Kenarlar", o: 10, f: 10, s: 7, controls: ["Derin kesik ve el yaralanması oluşabilir.", "Çapak alma işlemi ve cut-resistant eldiven kullanımı zorunlu tutulmalıdır."] },
  { hazard: "Kaynak Ark Işıması", risk: "Çevre personelin kaynak perdesi olmadan ark ışınlarına maruz kalması göz hasarı oluşturabilir.", category: "Kaynak", o: 6, f: 6, s: 7, controls: ["Göz yanığı, cilt etkilenmesi ve geçici görme kaybı oluşabilir.", "Kaynak perdeleri ve kaynakçı dışında personel için göz koruyucu uygulanmalıdır."] },
  { hazard: "Gaz Tüpü Geri Tepme Riski", risk: "Kesme setlerinde alev tutucu eksikliği geri tepme ve yangın başlatabilir.", category: "Sıcak Çalışma", o: 3, f: 3, s: 40, controls: ["Tüp patlaması, yangın ve ağır yanık oluşabilir.", "Alev tutucu, hortum kontrolü ve tüp sabitleme standardı uygulanmalıdır."] },
  { hazard: "Sıcak Parça Elle Taşıma", risk: "Yeni kaynak veya kesimden çıkan parçaların işaretlenmeden elle temas edilmesi yanığa neden olabilir.", category: "Termal Risk", o: 6, f: 6, s: 15, controls: ["Ciddi yanıklar oluşabilir.", "Sıcak parça bekleme alanı, maşa kullanımı ve uyarı levhası uygulanmalıdır."] },
  { hazard: "Ağır Sac Devrilmesi", risk: "Sac plakaların dikey istifte sabitlenmemesi devrilme riski oluşturabilir.", category: "Depolama", o: 3, f: 3, s: 40, controls: ["Ezilme ve ölüm oluşabilir.", "Sac istif sehpası ve zincir sabitleme kullanılmalıdır."] },
  { hazard: "Manyetik Kaldırıcı Uygunsuzluğu", risk: "Manyetik kaldırıcı kapasite üzerinde kullanıldığında parça düşebilir.", category: "Kaldırma", o: 3, f: 3, s: 40, controls: ["Malzeme düşmesi ve ezilme oluşabilir.", "Kapasite etiketi, yüzey temizliği ve kaldırma planı doğrulanmalıdır."] },
  { hazard: "Kaynak Sonrası Duman Birikimi", risk: "Kapalı kabinde kaynak sonrası hava değişimi beklenmeden çalışma sürdürülmesi maruziyet yaratabilir.", category: "Kaynak", o: 6, f: 6, s: 15, controls: ["Solunum yolu etkilenmesi oluşabilir.", "Kaynak sonrası purge süresi tanımlanmalı ve havalandırma sensörü kullanılmalıdır."] },
  { hazard: "Pres Kalıbı Sıkışması", risk: "Kalıp ayarı sırasında el ile müdahale edilmesi sıkışmaya yol açabilir.", category: "Pres Güvenliği", o: 3, f: 6, s: 40, controls: ["El ezilmesi ve amputasyon oluşabilir.", "Kalıp ayarında kalıp destek pimi ve bakım modu kullanılmalıdır."] },
  { hazard: "Metal Tozu ve Çapak", risk: "Zemin üzerinde biriken metal çapakları kayma ve batma riski oluşturabilir.", category: "Düzen ve Temizlik", o: 6, f: 10, s: 7, controls: ["Kayma, delinme ve göz yaralanması oluşabilir.", "Endüstriyel süpürge, mıknatıslı temizlik ve taban korumalı ayakkabı kullanılmalıdır."] },
];

const WOOD_RISKS: SectorRiskTemplate[] = [
  { hazard: "Ahşap Tozu Birikimi", risk: "Zımpara ve kesim hatlarında toz emiş yetersizliği yangın yükü ve solunum riski oluşturabilir.", category: "Toz Maruziyeti", o: 10, f: 10, s: 7, controls: ["Solunum yolu etkilenmesi ve patlayıcı toz ortamı oluşabilir.", "Toz emiş sistemi ve filtre temizliği vardiya bazlı kontrol edilmelidir."] },
  { hazard: "Dairesel Testere Geri Tepmesi", risk: "Yanlış besleme açısı ve itme aparatı kullanılmaması geri tepme ile parçanın fırlamasına neden olabilir.", category: "Makine Güvenliği", o: 3, f: 6, s: 40, controls: ["Göğüs ve yüz travması, kesik ve uzuv kaybı oluşabilir.", "İtme aparatı, ayarlı dayama ve geri tepme önleyici uygulanmalıdır."] },
  { hazard: "Tutkal ve Solvent Kullanımı", risk: "Yapıştırıcı buharı ve çözücülerin havalandırmasız alanda kullanılması kimyasal maruziyet oluşturabilir.", category: "Kimyasal", o: 6, f: 6, s: 15, controls: ["Baş ağrısı, tahriş ve yangın riski oluşabilir.", "Lokal emiş, SDS erişimi ve uygun eldiven kullanılmalıdır."] },
  { hazard: "Freze Bıçağı Değişimi", risk: "Freze bıçağı değişiminde enerji kesmeden çalışma yapılması el yaralanmasına neden olabilir.", category: "Bakım Onarım", o: 3, f: 6, s: 40, controls: ["Kesik ve amputasyon oluşabilir.", "Bıçak değişiminde LOTO ve kilitli anahtar uygulaması kullanılmalıdır."] },
  { hazard: "Mobilya Parçası Devrilmesi", risk: "Bitmiş ürünlerin dik ve sabitsiz istiflenmesi devrilme oluşturabilir.", category: "Depolama", o: 6, f: 6, s: 15, controls: ["Ezilme ve ürün hasarı oluşabilir.", "Ürünler bölmeli raflarda veya takozla sabitlenmiş alanda depolanmalıdır."] },
];

const FOOD_PRODUCTION_RISKS: SectorRiskTemplate[] = [
  { hazard: "Çapraz Kontaminasyon", risk: "Çiğ ve pişmiş ürün akışlarının ayrılmaması gıda güvenliği ihlali oluşturabilir.", category: "Hijyen", o: 6, f: 10, s: 15, controls: ["Gıda zehirlenmesi ve toplu sağlık problemi oluşabilir.", "Renk kodlu ekipman, alan ayrımı ve temizlik-validasyon planı uygulanmalıdır."] },
  { hazard: "Bıçakla Hızlı Kesim", risk: "Kesim istasyonunda el koruması olmadan yüksek tempolu bıçak kullanımı derin kesik oluşturabilir.", category: "Kesici Aletler", o: 6, f: 10, s: 15, controls: ["Derin kesik ve tendon yaralanması oluşabilir.", "Kesilmeye dayanıklı eldiven ve güvenli kesim yüzeyi standardı uygulanmalıdır."] },
  { hazard: "Haşlama ve Buhar Hattı", risk: "Kazan ve buhar hattı vanalarının yalıtımsız bırakılması haşlanma riski oluşturabilir.", category: "Termal Risk", o: 6, f: 6, s: 15, controls: ["Yanık ve refleksle düşme oluşabilir.", "Vanalar yalıtılmalı, sıcak yüzeyler işaretlenmeli ve tahliye vanaları kontrol edilmelidir."] },
  { hazard: "Alerjen Yönetimi", risk: "Alerjen içeren ürün geçişlerinde ekipman temizliğinin doğrulanmaması uygunsuz etiketlemeye yol açabilir.", category: "Hijyen", o: 6, f: 6, s: 15, controls: ["Tüketicide ciddi sağlık etkileri ve geri çağırma oluşabilir.", "Alerjen matrisi, hat temizliği ve lot bazlı doğrulama uygulanmalıdır."] },
  { hazard: "Soğuk Zincir Kesintisi", risk: "Ürünün bekleme alanında limit dışı sıcaklıkta tutulması mikrobiyolojik bozulma yaratabilir.", category: "Soğuk Zincir", o: 6, f: 6, s: 15, controls: ["Ürün bozulması ve tüketici sağlığı riski oluşabilir.", "Sıcaklık kayıtları ve alarm sistemiyle soğuk zincir sürekliliği izlenmelidir."] },
];

const DEPOT_RISKS: SectorRiskTemplate[] = [
  { hazard: "Yüksek İstifleme", risk: "Raf ve blok istiflerde kapasite üstü yükleme malzeme düşmesine yol açabilir.", category: "İstifleme", o: 6, f: 6, s: 15, controls: ["Malzeme düşmesi ve ezilme oluşabilir.", "İstif yükseklik limiti ve raf etiketleri görünür tutulmalıdır."] },
  { hazard: "Forklift Şarj Alanı", risk: "Akü şarj alanında havalandırma ve asit sıçrama önlemi olmaması maruziyet yaratabilir.", category: "Elektrik / Kimyasal", o: 3, f: 3, s: 15, controls: ["Yanık, yangın ve patlayıcı gaz oluşabilir.", "Şarj alanı ayrılmalı, göz duşu ve havalandırma standardı uygulanmalıdır."] },
  { hazard: "Dock Leveler Boşluğu", risk: "Yükleme rampasında boşluk ve seviye farkı araç-kasa arasında düşmeye neden olabilir.", category: "Yükleme", o: 6, f: 6, s: 15, controls: ["Düşme, ayak sıkışması ve yük kayması oluşabilir.", "Dock leveler kilidi ve araç teker takozu kullanılmalıdır."] },
  { hazard: "El Terminali ile Yaya Dikkat Dağınıklığı", risk: "Sipariş toplarken ekrana odaklanma çevresel tehlikeyi fark etmeyi geciktirebilir.", category: "Davranışsal", o: 6, f: 10, s: 7, controls: ["Çarpma, takılma ve raf köşesine vurma oluşabilir.", "Yaya güzergahları netleştirilmeli ve terminal kullanımı için güvenli duruş noktaları tanımlanmalıdır."] },
];

const RESTAURANT_RISKS: SectorRiskTemplate[] = [
  { hazard: "Kızgın Yağ Sıçraması", risk: "Kızartma alanında su teması ve hızlı ürün bırakma yağa sıçrama oluşturabilir.", category: "Termal Risk", o: 6, f: 6, s: 15, controls: ["Ciddi yanıklar oluşabilir.", "Yağ seviyesi, sıçrama siperi ve ısıya dayanıklı eldiven kullanımı denetlenmelidir."] },
  { hazard: "Doğalgaz Kaçak Kontrolü", risk: "Ocak ve bağlantı noktalarında gaz kaçağının geç fark edilmesi patlama riski doğurabilir.", category: "Yangın / Patlama", o: 3, f: 3, s: 40, controls: ["Patlama, yangın ve can kaybı oluşabilir.", "Gaz dedektörü, vana kapama eğitimi ve periyodik sızdırmazlık testi yapılmalıdır."] },
  { hazard: "Bulaşık Alanında Sıcak Su Yanığı", risk: "Endüstriyel bulaşık ve haşlama ekipmanlarında sıcak suya kontrolsüz temas olabilir.", category: "Termal Risk", o: 6, f: 6, s: 15, controls: ["Haşlanma ve yanık oluşabilir.", "Sıcak su uyarıları, dirsek boyu eldiven ve ekipman kapağı kullanımı zorunlu tutulmalıdır."] },
  { hazard: "Servis Alanında Taşıma Yoğunluğu", risk: "Tepsi ve sıcak tabakla dar alanda hızlı hareket çarpışma ve dökülme doğurabilir.", category: "Ergonomi", o: 6, f: 10, s: 7, controls: ["Yanık, kayma ve kas zorlanması oluşabilir.", "Servis akışı tek yönlü planlanmalı ve tepsi ağırlık limiti belirlenmelidir."] },
];

const OFFICE_RISKS: SectorRiskTemplate[] = [
  { hazard: "Monitör ve Sandalye Uyumsuzluğu", risk: "Ekran yüksekliği ve sandalye ayarının çalışana uygun olmaması boyun-bel zorlanması oluşturabilir.", category: "Ergonomi", o: 10, f: 10, s: 3, controls: ["Kas-iskelet sistemi ağrıları ve verim düşüşü oluşabilir.", "Ergonomik değerlendirme formu ile masa-sandalye ayarı kişiye göre yapılmalıdır."] },
  { hazard: "Kablo Karmaşası", risk: "Masa altındaki adaptör ve kablo yığılması takılma ve ısınma riski doğurabilir.", category: "Elektrik", o: 6, f: 6, s: 7, controls: ["Düşme ve küçük çaplı elektrik yangını oluşabilir.", "Kablo tavaları, çoklu priz yük kontrolü ve masa altı düzeni sağlanmalıdır."] },
  { hazard: "Psikososyal İş Yükü", risk: "Süre baskısı, çağrı yoğunluğu veya iş yetiştirme stresi dikkat ve sağlık üzerinde olumsuz etki oluşturabilir.", category: "Psikososyal", o: 10, f: 6, s: 7, controls: ["Tükenmişlik, hata artışı ve devamsızlık oluşabilir.", "İş yükü dengesi, mola planı ve yönetici geri bildirim sistemi kurulmalıdır."] },
  { hazard: "Arşiv ve Dolap Devrilmesi", risk: "Yüksek dolapların duvara sabitlenmemesi deprem veya çekme hareketinde devrilmeye yol açabilir.", category: "Altyapı", o: 3, f: 3, s: 15, controls: ["Baş ve omuz yaralanması oluşabilir.", "Dolaplar sabitlenmeli, ağır klasörler alt raflarda tutulmalıdır."] },
];

const COLD_STORAGE_RISKS: SectorRiskTemplate[] = [
  { hazard: "Düşük Sıcaklıkta Uzun Çalışma", risk: "Soğuk odada mola planı olmadan uzun süre çalışma hipotermi ve dikkat azalması yaratabilir.", category: "Termal Risk", o: 6, f: 6, s: 15, controls: ["Hipotermi, kas sertliği ve dikkat kaybı oluşabilir.", "Mola çevrimi, termal KKD ve sıcak alan dönüş planı uygulanmalıdır."] },
  { hazard: "Buzlanmış Zemin", risk: "Donan zemin ve eğimli rampalarda kayma düşmeye yol açabilir.", category: "Kayma / Düşme", o: 10, f: 10, s: 7, controls: ["Düşme ve kırık oluşabilir.", "Buz çözme, kaymaz zemin ve taban deseni uygun ayakkabı kullanılmalıdır."] },
  { hazard: "İçeride Kilitli Kalma", risk: "Soğuk oda kapılarında içeriden açma mekanizması arızası mahsur kalma oluşturabilir.", category: "Acil Durum", o: 3, f: 3, s: 40, controls: ["Soğuk maruziyet ve panik oluşabilir.", "İç açma kolu, alarm butonu ve yalnız çalışmama kuralı uygulanmalıdır."] },
];

const CONFINED_SPACE_RISKS: SectorRiskTemplate[] = [
  { hazard: "Oksijen Yetersizliği", risk: "Kapalı alana giriş öncesi gaz ölçümü yapılmaması boğucu atmosfer riskine yol açabilir.", category: "Kapalı Alan", o: 3, f: 3, s: 100, controls: ["Boğulma ve ölüm oluşabilir.", "Giriş öncesi çoklu gaz ölçümü ve sürekli izleme yapılmalıdır."] },
  { hazard: "Kurtarma Planı Eksikliği", risk: "Tank, kuyu ve menhol çalışmalarında kurtarma ekipmanı hazır olmadan giriş yapılması olay sonrası müdahaleyi imkansızlaştırabilir.", category: "Kapalı Alan", o: 3, f: 3, s: 100, controls: ["Kurtarma gecikmesi ve ölüm oluşabilir.", "Tripod, kurtarma vinci, gözcü ve tatbikat planı olmadan giriş yapılmamalıdır."] },
  { hazard: "Toksik Gaz Birikimi", risk: "Temizlenmemiş kapalı alanda solvent, H2S veya CO gibi gazların birikmesi maruziyet yaratabilir.", category: "Kimyasal", o: 3, f: 3, s: 100, controls: ["Zehirlenme, bilinç kaybı ve ölüm oluşabilir.", "Havalandırma, gaz ölçümü ve izinli çalışma formu ile alan kontrol edilmelidir."] },
];

function buildSectorTemplatePool(normalizedSector: string) {
  switch (normalizedSector) {
    case "insaat":
    case "yuksekte_calisma":
      return [...CONSTRUCTION_RISKS, ...COMMON_TEMPLATE_RISKS];
    case "fabrika":
      return [...FACTORY_RISKS, ...COMMON_TEMPLATE_RISKS];
    case "metal":
      return [...FACTORY_RISKS, ...METAL_RISKS, ...COMMON_TEMPLATE_RISKS];
    case "ahsap":
      return [...FACTORY_RISKS.slice(0, 24), ...WOOD_RISKS, ...COMMON_TEMPLATE_RISKS];
    case "gida":
      return [...FACTORY_RISKS.slice(0, 22), ...FOOD_PRODUCTION_RISKS, ...COMMON_TEMPLATE_RISKS];
    case "depo":
      return [...DEPOT_RISKS, ...FACTORY_RISKS.slice(0, 18), ...COMMON_TEMPLATE_RISKS];
    case "restoran":
    case "otel":
      return [...RESTAURANT_RISKS, ...FOOD_PRODUCTION_RISKS, ...COMMON_TEMPLATE_RISKS];
    case "ofis":
    case "egitim":
      return [...OFFICE_RISKS, ...COMMON_TEMPLATE_RISKS];
    case "saglik":
    case "laboratuvar":
      return [...COMMON_TEMPLATE_RISKS, ...CONFINED_SPACE_RISKS.slice(0, 1)];
    case "kimyasal":
      return [...FACTORY_RISKS.slice(0, 18), ...CONFINED_SPACE_RISKS.slice(2), ...COMMON_TEMPLATE_RISKS];
    case "teknik_servis":
    case "oto_servis":
      return [...FACTORY_RISKS.slice(0, 24), ...METAL_RISKS.slice(0, 4), ...COMMON_TEMPLATE_RISKS];
    case "tarim":
      return [...COMMON_TEMPLATE_RISKS, ...COLD_STORAGE_RISKS.slice(0, 1)];
    case "temizlik":
    case "guvenlik":
    case "kuafor":
    case "market":
    case "tekstil":
      return [...COMMON_TEMPLATE_RISKS, ...OFFICE_RISKS.slice(0, 2)];
    case "soguk_hava":
      return [...COLD_STORAGE_RISKS, ...DEPOT_RISKS, ...COMMON_TEMPLATE_RISKS];
    case "kapali_alan":
      return [...CONFINED_SPACE_RISKS, ...COMMON_TEMPLATE_RISKS];
    default:
      return COMMON_TEMPLATE_RISKS;
  }
}

export function generateSectorRiskTemplates(sectorName: string) {
  const normalizedSector = normalizeRiskSectorKey(sectorName);
  const targetCount = getSectorMinimumRiskItemCount(sectorName, 40);
  const baseRisks = buildSectorTemplatePool(normalizedSector);

  return ensureMinimumCount(baseRisks.slice(0, targetCount), targetCount, (index) => {
    const template = baseRisks[index % baseRisks.length];
    return {
      ...template,
      hazard: `${template.hazard} ${index + 1}`,
      risk: `${template.risk} (${sectorName})`,
    };
  });
}
