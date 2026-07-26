import { supabase } from "@/integrations/supabase/client";
import type { Company, Employee } from "@/types/companies";

export type DrillChecklistAnswer = "Evet" | "Hayır" | "Kısmen";

export interface EmergencyDrillTeamMember {
  id: string;
  employeeId?: string | null;
  fullName: string;
  teamRole: string;
}

export interface EmergencyDrillChecklistItem {
  id: string;
  question: string;
  answer: DrillChecklistAnswer;
}

export interface EmergencyDrillReportRecord {
  id?: string;
  userId?: string;
  organizationId?: string | null;
  companyId: string;
  companyName: string;
  companyAddress: string;
  workplaceRegistrationNumber: string;
  hazardClass: string;
  employerName: string;
  specialistName: string;
  drillType: string;
  drillDate: string;
  drillLocation: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  isPlanned: boolean;
  isAnnounced: boolean;
  coordinatorName: string;
  scenarioText: string;
  teamMembers: EmergencyDrillTeamMember[];
  checklist: EmergencyDrillChecklistItem[];
  generalEvaluation: string;
  detectedDeficiencies: string;
  correctiveActions: string;
  nextReviewDate: string;
  logoDataUrl?: string | null;
  status: "Taslak" | "Kaydedildi";
}

type JsPdfConstructor = new (options?: Record<string, unknown>) => any;

const db = supabase as any;

export const drillTypes = [
  "Yangın Tatbikatı",
  "Deprem Tatbikatı",
  "Genel Tahliye Tatbikatı",
  "Kimyasal Dökülme/Sızıntı Tatbikatı",
  "İlk Yardım / İş Kazası Tatbikatı",
  "Doğalgaz/LPG Kaçağı Tatbikatı",
  "Sel/Su Baskını Tatbikatı",
  "Elektrik Yangını Tatbikatı",
  "Sabotaj/Güvenlik Tehdidi Tatbikatı",
  "Gıda Zehirlenmesi Tatbikatı",
];

export const drillTeamRoles = [
  "Söndürme Ekibi",
  "Kurtarma Ekibi",
  "Koruma Ekibi",
  "İlk Yardım Ekibi",
  "Tahliye Ekibi",
  "Tatbikat Gözlemcisi",
];

export const defaultDrillScenarioSteps = [
  "Tatbikat başlangıcında, çalışma alanında görev yapan bir çalışanın seviye farkından düşerek yere yığıldığı ve bilincinin kapandığı senaryosu canlandırılır. Çalışanın yanında devrilmiş bir malzeme bulunduğu ve bacağının bu malzemenin altında sıkıştığı varsayılır.",
  "Olayı fark eden en yakındaki çalışan, kazazedeyi hareket ettirmeden yüksek sesle yardım çağırır; durumu derhal bölüm sorumlusuna ve acil durum ekiplerine bildirir. İşyeri alarm ve anons sistemi ile tüm çalışanlar uyarılır.",
  "Koruma ekibi olay yerini emniyet şeridi ile çevreler, çevredeki makine ve ekipmanları durdurarak bölgeyi güvenli hale getirir ve müdahale ekipleri dışındaki kişilerin kazazedeye yaklaşmasını engeller.",
  "Kurtarma ekibi, sıkışan uzvun serbest kalması için uygun kaldırma ekipmanı ve destekleme yöntemiyle kontrollü müdahale yapar; kazazedeye ek zarar verilmemesine özen gösterilir.",
  "İlk yardım ekibi kazazedenin bilinç, solunum ve dolaşım kontrolünü yapar; bilinç kapalı ve solunum mevcut senaryosuna göre omurga yaralanması ihtimali gözetilerek kazazede hareket ettirilmeden sabitlenir, kanama kontrolü ve temel yaşam desteği hazırlığı uygulanır.",
  "Eş zamanlı olarak görevli personel 112 Acil Çağrı Merkezini arar; olayın türünü, kazazedenin durumunu, işyerinin açık adresini ve ulaşım tarifini net biçimde iletir. Bir çalışan, ambulansı karşılamak ve olay yerine yönlendirmek üzere işyeri girişinde görevlendirilir.",
  "Olay bölgesindeki diğer çalışanlar, müdahaleyi engellememek amacıyla tahliye görevlilerinin yönlendirmesiyle kaçış yollarını kullanarak çalışma alanını sakin ve düzenli şekilde boşaltır ve toplanma noktasına yönelir.",
  "Toplanma noktasında bölüm sorumluları tarafından sayım yapılır; çalışanların, ziyaretçilerin ve stajyerlerin eksiksiz olduğu teyit edilerek sonuç tatbikat yöneticisine raporlanır.",
  "Temsili ambulansın işyerine ulaşmasıyla kazazedenin sağlık ekibine devri canlandırılır; kazazedenin durumu ve yapılan ilk yardım uygulamaları sağlık ekibine sözlü olarak aktarılır.",
  "Tatbikat yöneticisinin anonsuyla tatbikat sonlandırılır ve çalışanlar kontrollü şekilde iş başı yapar.",
  "Tatbikatın hemen ardından acil durum ekipleri, tatbikat yöneticisi ve iş güvenliği uzmanının katılımıyla kısa bir değerlendirme brifingi yapılır; müdahale süreleri, gözlenen aksaklıklar ve iyileştirme önerileri kayıt altına alınarak tatbikat raporuna işlenir.",
];

export const fireDrillScenarioSteps = [
  "Tatbikat başlangıcında, işyerinin depolama alanında elektrik panosundan kaynaklanan kıvılcım nedeniyle ambalaj malzemelerinin tutuştuğu ve dumanın çevreye yayılmaya başladığı kabul edilir. Yangının henüz başlangıç aşamasında olduğu senaryolaştırılır.",
  "Yangını ilk fark eden çalışan, yüksek sesle çevresindekileri uyarır ve en yakın yangın ihbar butonuna basarak alarm sistemini devreye alır. Durum eş zamanlı olarak acil durum koordinatörüne ve işveren vekiline bildirilir.",
  "Söndürme ekibi olay yerine intikal ederek kuru kimyevi tozlu (KKT) yangın söndürücülerle, hava akımını arkasına alacak şekilde alevin kaynağına müdahale eder. Müdahale öncesinde bölgenin elektrik enerjisi yetkili personel tarafından kesilir. Koruma ekibi olay bölgesini çevirerek yetkisiz girişleri engeller ve kıymetli evrak ile ekipmanı koruma altına alır.",
  "Eş zamanlı olarak kurtarma ekibi, çalışma alanlarını dolaşarak tüm çalışanların, ziyaretçilerin ve yardıma muhtaç kişilerin kaçış yolları üzerinden tahliyesine refakat eder. Çalışanlar koşmadan, eşyalarını almak için geri dönmeden ve asansör kullanmadan acil çıkışlara yönlendirilir.",
  "Tahliye edilen tüm personel toplanma noktasında bölüm sorumluları eşliğinde toplanır; güncel personel listesi üzerinden yoklama alınır ve sayım sonucu acil durum koordinatörüne raporlanır. Senaryo gereği bir çalışanın içeride mahsur kaldığı varsayılır; kurtarma ekibi tarafından temsili tahliyesi gerçekleştirilir ve ilk yardım ekibi etkilenen çalışana toplanma noktasında temsili ilk yardım uygular.",
  "Yangının ilk müdahale ile tamamen kontrol altına alınamadığı varsayımıyla görevli personel 112 Acil Çağrı Merkezini temsili olarak arar; işyerinin açık adresi, yangının türü, mahsur kalan kişi bilgisi ve ulaşım güzergâhı net biçimde bildirilir; itfaiye ve acil sağlık desteği bu tek hat üzerinden talep edilir.",
  "Yangının söndürüldüğünün ve ortamın güvenli olduğunun teyit edilmesinin ardından tatbikat, acil durum koordinatörü tarafından sonlandırılır. Toplanma noktasında tüm katılımcılarla kısa bir değerlendirme brifingi yapılır; gözlemci notları doğrultusunda aksayan yönler, müdahale ve tahliye süreleri ile iyileştirme önerileri kayıt altına alınarak tatbikat tutanağı düzenlenir.",
];

export const earthquakeDrillScenarioSteps = [
  "Tatbikat başlangıcında, çalışma saatleri içinde işyerini etkileyen şiddetli bir deprem meydana geldiği varsayılır. Sarsıntı, anons veya siren sistemi ile temsil edilir ve tüm çalışanlara tatbikatın başladığı duyurulur.",
  "Sarsıntıyı fark eden çalışanlar panik yapmadan bulundukları yerde Çök-Kapan-Tutun hareketini uygular; sağlam bir masa veya benzeri mobilyanın altına girerek baş ve enseyi korur, masanın ayağına veya sabit bir noktaya tutunur. Altına girilebilecek sağlam bir mobilya yoksa iç duvar dibine çökülerek baş ve ense kollarla korunur. Pencere, cam yüzey ve devrilebilecek malzemelerden uzak durulur.",
  "Sarsıntının sona erdiği anons edilir ve acil durum amiri tahliye kararı verir. Alarm ve anons sistemiyle tüm çalışma alanlarına kontrollü tahliye talimatı iletilir.",
  "Söndürme ekibi, deprem sonrası yangın riskine karşı elektrik ve doğalgaz gibi enerji kaynaklarını ana pano ve vanadan keser; olası başlangıç yangınlarına karşı çalışma alanlarını kontrol eder.",
  "Koruma ekibi kaçış yollarının güvenliğini sağlayarak çalışanları asansör kullanmadan, koşmadan ve birbirini itmeden toplanma noktasına yönlendirir. Ziyaretçi, stajyer ve yardıma muhtaç kişilere refakat edilir.",
  "Kurtarma ekibi çalışma alanlarını son kez tarar; senaryo gereği devrilen malzeme altında mahsur kaldığı varsayılan bir çalışan temsili olarak tespit edilir ve güvenli taşıma teknikleriyle tahliye edilir.",
  "İlk yardım ekibi, toplanma noktasına getirilen temsili yaralının değerlendirmesini yapar, temel ilk yardım uygular ve durumu acil durum amirine raporlar.",
  "Toplanma noktasında bölüm sorumluları tarafından sayım yapılır; tüm çalışanların, ziyaretçilerin ve stajyerlerin eksiksiz tahliye edildiği teyit edilerek sonuç acil durum amirine bildirilir.",
  "Artçı sarsıntı riski nedeniyle hiçbir çalışanın binaya geri dönmesine izin verilmez. Görevlendirilen ekip, bina dış cephesinde ve taşıyıcı elemanlarda çatlak, dökülme ve hasar olup olmadığını dışarıdan gözle kontrol eder.",
  "Acil durum amiri tarafından 112 Acil Çağrı Merkezi'nin (itfaiye, acil sağlık ve AFAD dahil) temsili olarak arandığı, doğalgaz kaçağı şüphesine karşı 187 numaralı doğalgaz arıza hattına bildirim yapıldığı varsayılır.",
  "Tüm adımların tamamlanmasının ardından tatbikatın sona erdiği anons edilir ve çalışanların kontrollü şekilde çalışma alanlarına dönüşü sağlanır.",
  "Toplanma noktasında kısa bir değerlendirme brifingi yapılır; gözlemci notları, tahliye süresi ve tespit edilen aksaklıklar paylaşılır, iyileştirme önerileri tatbikat tutanağına kaydedilir.",
];

export const generalEvacuationDrillScenarioSteps = [
  "Tatbikat başlangıcında, yalnızca tatbikat yöneticisi ve gözlemcilerin bilgisi dahilinde, sebep belirtilmeksizin genel tahliye kararı alınır ve tatbikat yöneticisi süre ölçümü için hazırlığını tamamlar.",
  "Tahliye kararı, acil durum alarm sistemi ve sesli anons aracılığıyla tüm çalışma alanlarına duyurulur. Alarmın verildiği an, tahliye süresi ölçümünün başlangıç zamanı olarak kaydedilir.",
  "Alarmı duyan çalışanlar yürüttükleri işi güvenli şekilde durdurur, kullandıkları makine ve ekipmanı emniyete alır; kişisel eşyalarını toplamaya çalışmadan en yakın kaçış yoluna yönelir.",
  "Koruma ekibi görev alanlarında düzeni sağlar ve yetkilendirilmiş personel aracılığıyla elektrik, doğalgaz gibi enerji kaynaklarının kesme prosedürünü senaryo gereği uygular.",
  "Arama, kurtarma ve tahliye ekibi üyeleri sorumlu oldukları bölümlerde çalışanları yönlendirir; tüm çalışma alanlarını, ortak kullanım alanlarını ve kapalı hacimleri kontrol ederek içeride kimsenin kalmadığını teyit eder ve bölümlerini en son terk eder.",
  "Ziyaretçi, stajyer ve alt işveren çalışanları ile hamile, engelli ve yardıma muhtaç kişiler, görevlilerin refakatinde öncelikli olarak tahliye edilir.",
  "İlk yardım ekibi, ilk yardım çantası ve malzemeleriyle toplanma noktasında konuşlanır; tahliye sırasında oluşabilecek düşme, çarpma veya panik kaynaklı durumlara müdahale için hazır bekler.",
  "Tüm personel, kaçış planında belirlenen güzergahları izleyerek koşmadan, itişmeden ve asansör kullanmaksızın işyerini terk eder ve toplanma noktasına ulaşır.",
  "Son çalışanın toplanma noktasına ulaşmasıyla tahliye süresi durdurulur ve ölçülen süre tutanağa kaydedilir.",
  "Toplanma noktasında bölüm sorumluları kendi personelinin sayımını yapar; sonuçlar günlük personel listesi ve ziyaretçi kayıtlarıyla karşılaştırılarak tatbikat yöneticisine raporlanır. Eksik kişi tespit edilmesi halinde arama ve kurtarma ekibi senaryo gereği yeniden görevlendirilir.",
  "Haberleşme zincirinin işlerliğini sınamak amacıyla 112 Acil Çağrı Merkezi (itfaiye, acil sağlık, polis ve AFAD) ile doğalgaz arıza (187) hattına yapılacak bildirimler temsilî olarak gerçekleştirilir; gerçek arama yapılmaz, aranacak numaralar ve bildirim içeriği sözlü olarak tatbik edilir.",
  "Sayımın eksiksiz tamamlandığının ve tatbikat hedeflerine ulaşıldığının gözlemcilerce doğrulanmasının ardından tatbikat yöneticisi tatbikatı sonlandırır; personelin çalışma alanlarına kontrollü dönüşü sağlanır.",
  "Tatbikatın hemen ardından toplanma noktasında kısa bir değerlendirme brifingi yapılır; ölçülen tahliye süresi, gözlemlenen aksaklıklar ve iyileştirme önerileri paylaşılır, tatbikat tutanağı ve katılım formu düzenlenir.",
];

export const chemicalSpillDrillScenarioSteps = [
  "Tatbikat başlangıcında, depolama alanında tehlikeli kimyasal madde içeren bir varilin taşıma manevrası sırasında devrildiği ve içeriğin zemine döküldüğü senaryosu kurgulanır. Dökülen maddenin buharlaşarak çevredeki çalışma alanlarına yayılma riski bulunduğu varsayılır.",
  "Dökülmeyi ilk fark eden çalışan, alana yaklaşmadan çevresindeki çalışanları sesli olarak uyarır ve durumu acil durum sorumlusuna bildirir. Acil durum alarmı verilir ve işyeri geneline kimyasal dökülme anonsu yapılır.",
  "Koruma ekibi, dökülen maddenin Güvenlik Bilgi Formunu (GBF/MSDS) kontrol ederek tehlike sınıfını, uygun kişisel koruyucu donanımı ve müdahale yöntemini belirler. Ekip üyeleri kimyasala dirençli eldiven, tulum, koruyucu gözlük ve uygun solunum koruyucu donanımı kuşanır.",
  "Müdahale ekibi dökülme alanını şerit ve bariyerlerle izole eder, yetkisiz girişleri engeller ve sızıntının kaynağını güvenli şekilde durdurur. Dökülen kimyasalın kanalizasyon ve drenaj hatlarına ulaşmaması için çevreleme önlemi alınır.",
  "GBF'de belirtilen uygun absorban (emici) malzeme ile dökülen kimyasal çevrelenerek emdirilir ve toplanır; kontamine absorban ile temizlik malzemeleri etiketli tehlikeli atık kaplarına konulur.",
  "Senaryo gereği kimyasala maruz kaldığı varsayılan bir çalışan, ilk yardım ekibi tarafından güvenli alana alınır; kontamine kıyafetleri çıkarılır, göz ve vücut duşunda yeterli süre dekontaminasyon uygulanır ve GBF'deki ilk yardım tedbirleri yerine getirilir.",
  "Tahliye ekibi, dökülme bölgesindeki ve etkilenme ihtimali bulunan çalışma alanlarındaki çalışanları, rüzgar yönünü dikkate alarak kaçış yolları üzerinden panik oluşturmadan tahliye eder.",
  "Çalışanlar toplanma noktasında toplanır; bölüm sorumluları sayım yaparak sonuçları acil durum koordinatörüne raporlar ve eksik kişi olup olmadığı doğrulanır.",
  "Senaryo gereği 112 Acil Çağrı Merkezinden maruziyet yaşayan çalışan için tıbbi destek istendiği, dökülmenin boyutuna göre itfaiye ve AFAD desteğinin de aynı hat üzerinden talep edildiği tatbikat amaçlı sözlü olarak canlandırılır; gerçek arama yapılmaz.",
  "Müdahalenin tamamlanması, alanın güvenli hale getirilmesi ve sayımın eksiksiz doğrulanmasının ardından tatbikat sonlandırılır. Tüm katılımcılarla kısa bir değerlendirme brifingi yapılır; güçlü yönler, aksaklıklar ve iyileştirme önerileri kayıt altına alınarak tatbikat tutanağı düzenlenir.",
];

export const gasLeakDrillScenarioSteps = [
  "Tatbikat başlangıcında, işyerinin gaz kullanılan bölümünde (kazan dairesi, mutfak veya proses hattı gibi) doğalgaz/LPG kaçağı meydana geldiği senaryosu devreye alınır. Kaçak, bağlantı rakorundaki gevşeme nedeniyle ortama gaz yayılması şeklinde kurgulanır.",
  "Bölgede çalışan bir personel, belirgin gaz kokusunu veya gaz dedektörünün sesli-ışıklı ikazını fark eder. Çalışan, hiçbir elektrik anahtarına, prize ve elektrikli cihaza dokunmadan, kıvılcım oluşturabilecek hiçbir işlem yapmadan alanı terk eder ve durumu acil durum sorumlusuna sözlü olarak bildirir.",
  "Acil durum sorumlusunun talimatıyla genel alarm verilir; alarm butonu, gaz kaçağı bölgesinin dışındaki güvenli bir noktadan kullanılır ve tüm çalışma alanlarına tahliye anonsu yapılır.",
  "Söndürme ekibi, ana gaz kesme vanasını ve bölüm vanasını kapatır; alanın elektrik enerjisi, bölge dışındaki ana pano üzerinden kesilir. Koruma ekibi, gaz kaçağı bölgesini emniyet şeridiyle çevirir, kapı ve pencereleri açarak doğal havalandırmayı sağlar ve bölgeye girişleri engeller.",
  "Kurtarma ekibi, tüm çalışma alanlarını kontrol ederek içeride kimsenin kalmadığını doğrular ve senaryo gereği gazdan etkilendiği varsayılan bir çalışanı temiz havaya çıkarır. İlk yardım ekibi, etkilenen çalışanı toplanma noktası yakınında değerlendirir, yaşam bulgularını kontrol eder ve müdahaleyi uygular.",
  "Tüm çalışanlar, kaçış yollarını kullanarak, panik oluşturmadan ve asansör kullanmadan işyerini tahliye eder; ziyaretçi, stajyer ve yardıma muhtaç kişiler görevliler eşliğinde toplanma noktasına yönlendirilir.",
  "Toplanma noktasında ekip liderleri ve bölüm sorumluları sayım yapar; sonuçlar acil durum sorumlusuna raporlanır ve eksik personel bulunmadığı teyit edilir.",
  "Acil durum sorumlusu, doğalgaz dağıtım şirketinin 187 arıza hattına temsili bildirim yapar; bildirimde işyeri adresi, kaçağın yeri ve alınan önlemler aktarılır. Gazdan etkilenen çalışan senaryosu kapsamında 112 acil çağrı merkezine bilgi verilmesi de temsili olarak tatbik edilir.",
  "Gaz ölçümü yapılmadan ve yetkili kurum onayı alınmadan binaya yeniden giriş yapılmayacağı vurgulanır; ortamın güvenli hale geldiği bilgisinin alınmasıyla tatbikat sonlandırılır ve çalışanlar kontrollü şekilde çalışma alanlarına döner.",
  "Toplanma noktasında kısa bir değerlendirme brifingi yapılır; tespit edilen aksaklıklar, ölçülen süreler ve iyileştirme önerileri kayıt altına alınarak tatbikat raporuna işlenir.",
];

export const floodDrillScenarioSteps = [
  "Tatbikat başlangıcında, bölgeyi etkisi altına alan aşırı yağış nedeniyle işyerinin bodrum ve zemin katındaki çalışma alanlarına su girmeye başladığı kurgulanır. Su seviyesinin kısa sürede yükseldiği ve gider hatlarının yetersiz kaldığı varsayılır.",
  "Su baskınını ilk fark eden çalışan, durumu derhal acil durum sorumlusuna ve işveren vekiline bildirir. Acil durum sorumlusunun talimatıyla genel alarm verilir ve tüm çalışma alanlarına sesli anons yapılarak sel/su baskını acil durumu ilan edilir.",
  "Koruma ekibi ana elektrik panosuna ulaşarak su baskınından etkilenen alanların elektrik enerjisini ana şalterden keser; doğalgaz ve basınçlı hat vanaları kapatılır. Elektrik kesintisi tamamlanmadan suya temas edilmemesi kuralı tüm ekiplere hatırlatılır.",
  "Kurtarma ekibi, suyun yükseldiği alanlardaki kritik ekipman, evrak ve veri yedeklerini önceden belirlenen öncelik listesine göre üst katlardaki güvenli alanlara taşır. Koruma ekibi, su girişini yavaşlatmak amacıyla kum torbası ve bariyer benzeri geçici önlemleri uygular.",
  "Tahliye, alt katlardan üst katlara doğru dikey tahliye ilkesiyle yürütülür; asansör kullanımı yasaklanır ve yalnızca merdivenler kullanılır. Çalışanlar görevli personelin yönlendirmesiyle su basan alanlardan uzaklaştırılır; yardıma muhtaç kişiler, ziyaretçiler ve stajyerler refakatçi eşliğinde tahliye edilir.",
  "Tüm çalışanlar, suyun ulaşamayacağı güvenli kotta belirlenen toplanma noktasında toplanır. Bölüm sorumluları sayım yaparak sonuçları acil durum koordinatörüne raporlar; eksik kişi tespit edilmesi halinde kurtarma ekibi kişinin son görüldüğü alana yönlendirilir.",
  "İlk yardım ekibi, tahliye sırasında kayma, düşme veya soğuk suya maruziyet yaşadığı kurgulanan bir çalışana temsili müdahale yapar; durumun ciddiyetine göre 112 Acil Çağrı Merkezinin aranması süreci tatbik edilir.",
  "Acil durum koordinatörü, su baskınının işletme imkanlarıyla kontrol altına alınamayacağı varsayımıyla 112 üzerinden itfaiyeye ve AFAD'a temsili bildirim yapar; baskının boyutu, etkilenen alanlar ve mahsur kalan olup olmadığı bilgisi iletilir.",
  "Dış kurum bildirimi ve sayımın tamamlanmasının ardından tatbikat sonlandırılır. Toplanma noktasında kısa bir değerlendirme brifingi yapılarak güçlü yönler, aksaklıklar ve iyileştirme önerileri kayıt altına alınır; tatbikat gözlem ve değerlendirme tutanağı düzenlenir.",
];

export const electricalFireDrillScenarioSteps = [
  "Tatbikat başlangıcında, işyerinin elektrik panosunda aşırı ısınma sonucu kıvılcım oluştuğu ve kablo izolasyonunun tutuşarak yoğun dumanla birlikte yangın başlangıcı meydana geldiği kurgulanır. Pano çevresine tatbikat amaçlı duman efekti veya uyarı işareti yerleştirilir.",
  "Pano yakınında çalışan bir personel kıvılcımı ve yanık kokusunu fark eder; durumu derhal pano sorumlusuna ve en yakın acil durum ekip üyesine bildirir.",
  "Pano sorumlusu olay yerine ulaşır, yangının elektrik kaynaklı olduğunu teyit eder ve ana şalterden ilgili hattın enerjisini keser. Enerji kesilmeden hiçbir müdahaleye izin verilmez.",
  "Alarm butonuna basılarak veya anons sistemiyle tüm çalışma alanlarına acil durum duyurusu yapılır; çalışanlar işlerini güvenli şekilde durdurur.",
  "Söndürme ekibi, enerjinin kesildiğini pano sorumlusundan teyit aldıktan sonra karbondioksitli (CO2) veya kuru kimyevi tozlu (KKT) söndürücülerle yangın başlangıcına müdahale eder. Elektrik yangınında su ve sulu söndürücü kesinlikle kullanılmaz; bu kural tatbikat sırasında tüm katılımcılara sözlü olarak vurgulanır.",
  "Koruma ekibi olay bölgesini güvenlik şeridiyle çevirir, yangın alanına yetkisiz girişleri engeller ve kıymetli evrak ile ekipmanın korunmasını sağlar.",
  "Kurtarma ekibi çalışma alanlarını dolaşarak içeride kimsenin kalmadığını kontrol eder; ziyaretçi, stajyer ve yardıma ihtiyaç duyan kişilere tahliye sırasında refakat eder.",
  "Çalışanlar kaçış yollarını kullanarak koşmadan, panik yapmadan ve asansör kullanmadan toplanma noktasına tahliye edilir.",
  "İlk yardım ekibi toplanma noktasında hazır bulunur; senaryo gereği dumandan etkilendiği varsayılan bir çalışana temel ilk yardım uygulaması canlandırılır.",
  "Toplanma noktasında bölüm sorumluları personel sayımını yapar ve sonuçları acil durum koordinatörüne raporlar; eksik kişi bulunup bulunmadığı teyit edilir.",
  "Acil durum koordinatörü, senaryo gereği 112 Acil Çağrı Merkezi'nin (itfaiye ve acil sağlık) aranacağı haber verme zincirini tatbik eder; gerçek arama yapılmaz, arama adımı sözlü olarak canlandırılır.",
  "Yangının tamamen söndürüldüğü ve ortamın güvenli hale geldiği teyit edildikten sonra tatbikatın sona erdiği anons edilir; çalışanlar kontrollü şekilde çalışma alanlarına döner.",
  "Tatbikat sonrasında acil durum ekipleri, işveren veya vekili ve iş güvenliği uzmanının katılımıyla kısa bir değerlendirme brifingi yapılır; gözlemlenen aksaklıklar, müdahale ve tahliye süreleri ile iyileştirme önerileri kayıt altına alınarak tatbikat raporu hazırlanır.",
];

export const sabotageSecurityDrillScenarioSteps = [
  "Tatbikat başlangıcında, çalışma alanlarından birine sahipsiz ve kime ait olduğu bilinmeyen şüpheli bir paket senaryo gereği yerleştirilir. Eş zamanlı olarak işyeri telefon hattına kimliği belirsiz bir kişiden sabotaj tehdidi içeren bir ihbar geldiği varsayılır.",
  "Paketi fark eden çalışan nesneye kesinlikle dokunmaz, yerini değiştirmez ve çevresindeki kişileri sakin biçimde uzaklaştırarak durumu derhal bölüm amirine ve güvenlik görevlisine bildirir. Panik oluşmaması için sesli alarm verilmez; acil durum yönetimi önceden belirlenen sessiz haberleşme yöntemiyle bilgilendirilir.",
  "Koruma ekibi şüpheli nesnenin çevresinde güvenli mesafe oluşturarak alanı kapatır ve bölgeye kimsenin yaklaşmasına izin vermez; nesnenin yakınında telsiz ve cep telefonu kullanılmaz. Kurtarma ekibi kaçış güzergahlarını kontrol ederek çalışanları yönlendirir, ilk yardım ekibi olası yaralanmalara karşı toplanma noktası yakınında hazır bulunur, söndürme ekibi olası patlama sonrası yangın riskine karşı teyakkuza geçer.",
  "Tahliye, şüpheli nesneye en yakın çalışma alanından başlanarak kademeli ve sessiz biçimde yürütülür. Çalışanlar, sahipsiz eşya ayrımının yapılabilmesi için kişisel eşyalarını yanlarına alarak, koşmadan ve şüpheli nesnenin bulunduğu güzergahı kullanmadan işyerini terk eder.",
  "Çalışanlar, şüpheli nesneden yeterli güvenli uzaklıkta belirlenen toplanma noktasında bölüm sorumluları tarafından sayılır. Ziyaretçi, stajyer ve alt işveren çalışanları dahil tüm kişilerin eksiksiz olduğu acil durum koordinatörüne raporlanır.",
  "Acil durum yönetimi tarafından 112 Acil Çağrı Merkezi temsili olarak aranarak polis desteği istenir; ihbarın içeriği, şüpheli paketin yeri ve görünümü hakkında net bilgi verilir. Kolluk kuvvetleri ve bomba imha uzmanları gelene kadar alanın boş ve kontrol altında tutulduğu, hiçbir kişinin içeri alınmadığı senaryo gereği canlandırılır.",
  "Kolluk kuvvetlerinin kontrolü tamamladığı ve tehlike bulunmadığı bilgisinin alınmasıyla tatbikat sonlandırılır; çalışanlar düzenli biçimde çalışma alanlarına döner. Toplanma noktasında yapılan kısa değerlendirme brifinginde gözlemci notları paylaşılır, tespit edilen aksaklıklar ve iyileştirme önerileri kayıt altına alınır.",
];

export const foodPoisoningDrillScenarioSteps = [
  "Tatbikat başlangıcında, yemek servisinin tamamlanmasının hemen ardından çalışma alanlarına dönen çalışanların bir kısmında bulantı, kusma, karın ağrısı ve halsizlik şikayetleri görüldüğü senaryo gereği canlandırılır. Kısa süre içinde benzer şikayeti olan çalışan sayısının arttığı gözlenir.",
  "Durumu fark eden bir çalışan, en yakın amirine ve işyeri hekimi ile iş güvenliği uzmanına haber verir. Acil durum sorumlusu, vaka sayısındaki artışı toplu gıda zehirlenmesi şüphesi olarak değerlendirir ve anons sistemiyle acil durum alarmı verilmesini sağlar.",
  "İlk yardım ekibi, etkilenen çalışanların bulunduğu alanlara yönlendirilir; hastalar belirti şiddetine ve bilinç durumuna göre triyaj esasıyla sınıflandırılır. Ağır belirti gösterenler sedye ile revire veya belirlenen ilk yardım alanına taşınır; kusması olanlar yan yatış pozisyonunda gözetim altında tutulur ve kayıt formlarına ad ile belirtiler işlenir.",
  "Koruma ekibi yemekhane ve mutfak bölümünü boşaltarak girişleri kapatır ve yemek servisini durdurur. Servis edilen yemeklerden ve içme suyundan alınan şahit numuneler etiketlenerek soğuk ortamda bozulmadan muhafaza edilir; servis ve tedarik kayıtları güvence altına alınır.",
  "Etkilenmeyen çalışanlar, kaçış yolları üzerinden düzenli ve panik oluşturmadan toplanma noktasına tahliye edilir. Tahliye sırasında ziyaretçilere ve yardıma ihtiyaç duyan kişilere refakat edilir.",
  "Toplanma noktasında bölüm sorumluları sayım yapar; revirde müdahale gören ve hastaneye sevki planlanan çalışanlar liste üzerinden teyit edilerek eksik kimse olup olmadığı doğrulanır. Sayım sonucu acil durum sorumlusuna raporlanır.",
  "Acil durum sorumlusunun talimatıyla 112 Acil Çağrı Merkezi temsili olarak aranır; vaka sayısı, belirtiler, şüpheli gıda ve işyeri adresi net biçimde aktarılır. Eş zamanlı olarak İl/İlçe Sağlık Müdürlüğüne ve Alo 174 Gıda Hattına temsili bildirim yapılır; görevlendirilen personel, gelen sağlık ekiplerini işyeri girişinden revir alanına yönlendirir.",
  "Tüm vakalara müdahalenin ve sayımın tamamlanmasının ardından tatbikat sonlandırılır. Acil durum ekipleri, gözlemciler ve işyeri yönetiminin katılımıyla kısa bir değerlendirme brifingi yapılır; triyaj düzeni, numune muhafazası ve bildirim zincirindeki güçlü ve geliştirmeye açık yönler tutanakla kayıt altına alınır.",
];

export const drillScenarioTemplates: Record<string, string[]> = {
  "Yangın Tatbikatı": fireDrillScenarioSteps,
  "Deprem Tatbikatı": earthquakeDrillScenarioSteps,
  "Genel Tahliye Tatbikatı": generalEvacuationDrillScenarioSteps,
  "Kimyasal Dökülme/Sızıntı Tatbikatı": chemicalSpillDrillScenarioSteps,
  "Doğalgaz/LPG Kaçağı Tatbikatı": gasLeakDrillScenarioSteps,
  "Sel/Su Baskını Tatbikatı": floodDrillScenarioSteps,
  "Elektrik Yangını Tatbikatı": electricalFireDrillScenarioSteps,
  "Sabotaj/Güvenlik Tehdidi Tatbikatı": sabotageSecurityDrillScenarioSteps,
  "Gıda Zehirlenmesi Tatbikatı": foodPoisoningDrillScenarioSteps,
  "İlk Yardım / İş Kazası Tatbikatı": defaultDrillScenarioSteps,
};

export function getScenarioTextForDrillType(drillType: string) {
  return (drillScenarioTemplates[drillType] || defaultDrillScenarioSteps).join("\n");
}

export const defaultDrillChecklist = [
  "Alarm/anons tüm çalışma alanlarında duyuldu mu?",
  "Tahliye planlanan sürede tamamlandı mı?",
  "Kaçış yolları ve acil çıkışlar açık ve engelsiz miydi?",
  "Acil durum yönlendirme levhaları yeterli ve görünür müydü?",
  "Toplanma noktasında sayım doğru ve eksiksiz yapıldı mı?",
  "Acil durum ekipleri görev ve sorumluluklarını biliyor muydu?",
  "Enerji kaynaklarının kesme/kilitleme/güvence altına alma prosedürü uygulandı mı?",
  "İş ve iş ekipmanlarında ikincil tehlike oluşturabilecek durum kontrol edildi mi?",
  "Ziyaretçi, stajyer ve yardımcı hizmet personeli tahliyeye dahil edildi mi?",
  "Çalışanlar toplanma noktasının yerini önceden biliyor muydu?",
  "İlk yardım ekibi kazazedeye planlanan süre içinde müdahale etti mi?",
  "Kazazedenin bilinç, solunum ve dolaşım kontrolü doğru teknikle yapıldı mı?",
  "Kazazedeye omurga yaralanması ihtimali gözetilerek hareket ettirmeden müdahale edildi mi?",
  "112 aramasında olay türü, kazazedenin durumu ve işyeri adresi eksiksiz iletildi mi?",
  "Olay yeri emniyete alınarak müdahale ekipleri dışındaki kişilerin yaklaşması engellendi mi?",
  "Ambulansın karşılanması ve olay yerine yönlendirilmesi için görevlendirme yapıldı mı?",
];

export function createClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function companyDisplayName(company: Company) {
  return company.company_name || (company as unknown as { name?: string }).name || "Firma";
}

export function getEmployeeFullName(employee: Employee) {
  return (employee.full_name || `${employee.first_name || ""} ${employee.last_name || ""}`).replace(/\s+/g, " ").trim();
}

export function employeeToDrillTeamMember(employee: Employee, teamRole = "Söndürme Ekibi"): EmergencyDrillTeamMember {
  return {
    id: createClientId("team"),
    employeeId: employee.id,
    fullName: getEmployeeFullName(employee),
    teamRole,
  };
}

export function createEmptyEmergencyDrillReport(organizationId?: string | null): EmergencyDrillReportRecord {
  const today = new Date().toISOString().slice(0, 10);
  return {
    organizationId: organizationId ?? null,
    companyId: "",
    companyName: "",
    companyAddress: "",
    workplaceRegistrationNumber: "",
    hazardClass: "",
    employerName: "",
    specialistName: "",
    drillType: "İlk Yardım / İş Kazası Tatbikatı",
    drillDate: today,
    drillLocation: "",
    startTime: "18:00",
    endTime: "21:00",
    durationMinutes: 180,
    isPlanned: true,
    isAnnounced: true,
    coordinatorName: "",
    scenarioText: getScenarioTextForDrillType("İlk Yardım / İş Kazası Tatbikatı"),
    teamMembers: [],
    checklist: defaultDrillChecklist.map((question) => ({ id: createClientId("check"), question, answer: "Evet" })),
    generalEvaluation: "",
    detectedDeficiencies: "Tatbikat sırasında herhangi bir eksiklik tespit edilmemiştir.",
    correctiveActions: "Düzeltici/önleyici faaliyet ihtiyacı bulunmamaktadır.",
    nextReviewDate: today,
    logoDataUrl: null,
    status: "Taslak",
  };
}

export function applyCompanyToDrillReport(record: EmergencyDrillReportRecord, company: Company): EmergencyDrillReportRecord {
  const address = [company.address, company.district, company.city].filter(Boolean).join(" / ");
  return {
    ...record,
    companyId: company.id,
    companyName: companyDisplayName(company),
    companyAddress: address,
    workplaceRegistrationNumber: company.sgk_workplace_number || company.workplace_registration_number || company.tax_number || "",
    hazardClass: company.hazard_class || "",
    employerName: company.employer_representative_name || "",
    specialistName: company.occupational_safety_specialist_name || "",
    teamMembers: [],
  };
}

export function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function formatDateTr(value?: string | null) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("tr-TR");
}

export function validateEmergencyDrillReport(record: EmergencyDrillReportRecord) {
  const errors: string[] = [];
  if (!record.companyId) errors.push("Firma seçimi zorunlu.");
  if (!record.drillType.trim()) errors.push("Tatbikat türü zorunlu.");
  if (!record.drillDate) errors.push("Tatbikat tarihi zorunlu.");
  if (!record.drillLocation.trim()) errors.push("Tatbikat yeri zorunlu.");
  if (!record.startTime.trim() || !record.endTime.trim()) errors.push("Başlama ve bitiş saati zorunlu.");
  if (!record.coordinatorName.trim()) errors.push("Tatbikat koordinatörü zorunlu.");
  if (!record.scenarioText.trim()) errors.push("Senaryo metni zorunlu.");
  if (!record.teamMembers.length) errors.push("Tatbikatta görev alan en az bir ekip üyesi eklenmeli.");
  if (!record.checklist.length) errors.push("Kontrol listesi boş olamaz.");
  return errors;
}

export async function loadEmergencyDrillCompanies(): Promise<Company[]> {
  const { data, error } = await db.from("companies").select("*").eq("is_active", true).order("name", { ascending: true });
  if (error) throw error;
  return (data || []) as Company[];
}

export async function loadEmergencyDrillCompanyEmployees(companyId: string): Promise<Employee[]> {
  if (!companyId) return [];
  const { data, error } = await db
    .from("employees")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("first_name", { ascending: true });
  if (error) throw error;
  return (data || []) as Employee[];
}

export async function saveEmergencyDrillReport(record: EmergencyDrillReportRecord, userId: string, organizationId?: string | null) {
  const payload = {
    user_id: userId,
    organization_id: organizationId || record.organizationId || null,
    company_id: record.companyId || null,
    company_name: record.companyName,
    company_address: record.companyAddress,
    workplace_registration_number: record.workplaceRegistrationNumber,
    hazard_class: record.hazardClass,
    employer_name: record.employerName,
    specialist_name: record.specialistName,
    drill_type: record.drillType,
    drill_date: record.drillDate,
    drill_location: record.drillLocation,
    start_time: record.startTime,
    end_time: record.endTime,
    duration_minutes: record.durationMinutes,
    is_planned: record.isPlanned,
    is_announced: record.isAnnounced,
    coordinator_name: record.coordinatorName,
    scenario_text: record.scenarioText,
    general_evaluation: record.generalEvaluation,
    detected_deficiencies: record.detectedDeficiencies,
    corrective_actions: record.correctiveActions,
    next_review_date: record.nextReviewDate || null,
    logo_data_url: record.logoDataUrl || null,
    status: "Kaydedildi",
    updated_at: new Date().toISOString(),
  };

  const query = record.id
    ? db.from("emergency_drill_reports").update(payload).eq("id", record.id).select("*").single()
    : db.from("emergency_drill_reports").insert(payload).select("*").single();

  const { data: saved, error } = await query;
  if (error) throw error;

  await db.from("emergency_drill_report_teams").delete().eq("report_id", saved.id);
  await db.from("emergency_drill_report_checklist").delete().eq("report_id", saved.id);

  if (record.teamMembers.length) {
    const rows = record.teamMembers.map((member, index) => ({
      report_id: saved.id,
      employee_id: member.employeeId || null,
      full_name: member.fullName,
      team_role: member.teamRole,
      sort_order: index,
    }));
    const { error: teamError } = await db.from("emergency_drill_report_teams").insert(rows);
    if (teamError) throw teamError;
  }

  if (record.checklist.length) {
    const rows = record.checklist.map((item, index) => ({
      report_id: saved.id,
      question: item.question,
      answer: item.answer,
      sort_order: index,
    }));
    const { error: checklistError } = await db.from("emergency_drill_report_checklist").insert(rows);
    if (checklistError) throw checklistError;
  }

  return { ...record, id: saved.id, status: "Kaydedildi" as const };
}

async function loadPdfTools() {
  const [{ default: jsPDF }, { default: autoTable }, { addInterFontsToJsPDF }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("@/utils/fonts"),
  ]);
  return { jsPDF: jsPDF as JsPdfConstructor, autoTable, addInterFontsToJsPDF };
}

function lastY(doc: any, fallback: number) {
  return doc.lastAutoTable?.finalY || fallback;
}

function section(autoTable: any, doc: any, title: string, startY: number, fontName: string) {
  autoTable(doc, {
    startY,
    theme: "grid",
    margin: { left: 10, right: 10 },
    styles: { font: fontName, fontSize: 7.2, cellPadding: 1.2, lineColor: [0, 0, 0], lineWidth: 0.25, textColor: [15, 23, 42] },
    body: [[title]],
    columnStyles: { 0: { cellWidth: 190, fontStyle: "bold", fillColor: [238, 242, 248] } },
  });
}

function addHeader(doc: any, record: EmergencyDrillReportRecord, fontName: string) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(10, 10, 190, 20);
  doc.line(50, 10, 50, 30);
  if (record.logoDataUrl) {
    try {
      doc.addImage(record.logoDataUrl, "PNG", 15, 13, 28, 14, undefined, "FAST");
    } catch {
      // Logo okunamazsa resmi atlayıp belge düzenini koru.
    }
  }
  doc.setFont(fontName, "bold");
  doc.setFontSize(11);
  doc.text("ACİL DURUM TATBİKAT TUTANAĞI", 125, 21, { align: "center" });
}

function addFooter(doc: any, page: number, total: number, fontName: string) {
  doc.setFont(fontName, "normal");
  doc.setFontSize(7);
  doc.setTextColor(90, 96, 110);
  doc.text(`Sayfa ${page} / ${total}`, 105, 286, { align: "center" });
  doc.setTextColor(15, 23, 42);
}

export async function generateEmergencyDrillReportPdf(record: EmergencyDrillReportRecord) {
  const { jsPDF, autoTable, addInterFontsToJsPDF } = await loadPdfTools();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fontsLoaded = addInterFontsToJsPDF(doc);
  const fontName = fontsLoaded ? "Inter" : "helvetica";
  doc.setFont(fontName, "normal");

  addHeader(doc, record, fontName);

  autoTable(doc, {
    startY: 34,
    theme: "grid",
    margin: { left: 10, right: 10 },
    styles: { font: fontName, fontSize: 6.2, cellPadding: 1.3, lineColor: [0, 0, 0], lineWidth: 0.25, textColor: [15, 23, 42] },
    body: [
      [
        "6331 sayılı İş Sağlığı ve Güvenliği Kanunu ile 18.06.2013 tarih ve 28681 sayılı Resmi Gazete'de yayımlanan İşyerlerinde Acil Durumlar Hakkında Yönetmelik hükümleri kapsamında; acil durum planının uygulanabilirliğini değerlendirmek, çalışanların acil durum halindeki davranışlarını görmek ve eksiklikleri belirlemek amacıyla acil durum tatbikatı yapılmış; tatbikat sonucu, gözlem ve eksiklikler bu tutanakla kayıt altına alınmıştır.",
      ],
    ],
    columnStyles: { 0: { cellWidth: 190 } },
  });

  section(autoTable, doc, "FİRMA VE TATBİKAT BİLGİLERİ", lastY(doc, 48) + 2, fontName);
  autoTable(doc, {
    startY: lastY(doc, 52),
    theme: "grid",
    margin: { left: 10, right: 10 },
    styles: { font: fontName, fontSize: 6.8, cellPadding: 1.4, lineColor: [0, 0, 0], lineWidth: 0.25, textColor: [15, 23, 42] },
    body: [
      ["Firma / İşyeri", record.companyName || "-", "Tatbikat Türü", record.drillType || "-"],
      ["Adres", record.companyAddress || "-", "Tatbikat Tarihi", formatDateTr(record.drillDate)],
      ["SGK Sicil No", record.workplaceRegistrationNumber || "-", "Saat", `${record.startTime || "-"} - ${record.endTime || "-"}`],
      ["Tehlike Sınıfı", record.hazardClass || "-", "Tahliye Süresi", `${record.durationMinutes || 0} dk`],
      ["İşveren / Vekili", record.employerName || "-", "Bilgilendirme", record.isAnnounced ? "Haberli (önceden duyuruldu)" : "Habersiz"],
      ["Tatbikat Yeri", record.drillLocation || "-", "Planlama", record.isPlanned ? "Yıllık plan dahilinde" : "Plansız"],
    ],
    columnStyles: {
      0: { cellWidth: 28, fontStyle: "bold" },
      1: { cellWidth: 67 },
      2: { cellWidth: 28, fontStyle: "bold" },
      3: { cellWidth: 67 },
    },
  });

  section(autoTable, doc, "TATBİKAT SENARYOSU", lastY(doc, 86) + 2, fontName);
  const scenarioLines = record.scenarioText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => `${index + 1}. ${line.replace(/^\d+\.\s*/, "")}`);

  autoTable(doc, {
    startY: lastY(doc, 90),
    theme: "grid",
    margin: { left: 10, right: 10 },
    styles: { font: fontName, fontSize: 5.9, cellPadding: 1.1, lineColor: [0, 0, 0], lineWidth: 0.25, textColor: [15, 23, 42] },
    body: [[scenarioLines.join("\n")]],
    columnStyles: { 0: { cellWidth: 190 } },
  });

  section(autoTable, doc, "TATBİKATTA GÖREV ALAN EKİPLER", lastY(doc, 168) + 2, fontName);
  autoTable(doc, {
    startY: lastY(doc, 172),
    theme: "grid",
    margin: { left: 10, right: 10 },
    head: [["#", "Adı Soyadı", "Ekibi / Görevi"]],
    body: record.teamMembers.map((member, index) => [String(index + 1), member.fullName, member.teamRole]),
    styles: { font: fontName, fontSize: 6.6, cellPadding: 1.3, lineColor: [0, 0, 0], lineWidth: 0.25, textColor: [15, 23, 42] },
    headStyles: { fillColor: [238, 242, 248], fontStyle: "bold", textColor: [15, 23, 42] },
    columnStyles: { 0: { cellWidth: 12, halign: "center" }, 1: { cellWidth: 93 }, 2: { cellWidth: 85 } },
  });

  autoTable(doc, {
    startY: lastY(doc, 190),
    theme: "plain",
    margin: { left: 10, right: 10 },
    styles: { font: fontName, fontSize: 5.9, textColor: [15, 23, 42], cellPadding: 0.7 },
    body: [["Bilgi Notu - Acil durum ekiplerinin görevleri: Söndürme Ekibi yangının başlangıç safhasında uygun yangın söndürücü ve hortumla doğru teknikle ilk müdahaleyi yapar; yayılmayı sınırlar ve itfaiye gelene kadar mücadeleyi sürdürür."]],
  });

  section(autoTable, doc, "TATBİKAT DEĞERLENDİRME KONTROL LİSTESİ", lastY(doc, 199) + 3, fontName);
  const firstChecklist = record.checklist.slice(0, 1);
  const remainingChecklist = record.checklist.slice(1);
  autoTable(doc, {
    startY: lastY(doc, 203),
    theme: "grid",
    margin: { left: 10, right: 10 },
    head: [["Değerlendirme Sorusu", "Evet", "Hayır", "Kısmen"]],
    body: firstChecklist.map((item) => [
      item.question,
      item.answer === "Evet" ? "✓" : "",
      item.answer === "Hayır" ? "✓" : "",
      item.answer === "Kısmen" ? "✓" : "",
    ]),
    styles: { font: fontName, fontSize: 6.4, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.25, textColor: [15, 23, 42] },
    headStyles: { fillColor: [238, 242, 248], fontStyle: "bold", textColor: [15, 23, 42] },
    columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 20, halign: "center", textColor: [15, 118, 110] }, 2: { cellWidth: 20, halign: "center" }, 3: { cellWidth: 20, halign: "center" } },
  });
  addFooter(doc, 1, 2, fontName);

  doc.addPage();
  autoTable(doc, {
    startY: 10,
    theme: "grid",
    margin: { left: 10, right: 10 },
    body: remainingChecklist.map((item) => [
      item.question,
      item.answer === "Evet" ? "✓" : "",
      item.answer === "Hayır" ? "✓" : "",
      item.answer === "Kısmen" ? "✓" : "",
    ]),
    styles: { font: fontName, fontSize: 6.4, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.25, textColor: [15, 23, 42] },
    columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 20, halign: "center", textColor: [15, 118, 110] }, 2: { cellWidth: 20, halign: "center" }, 3: { cellWidth: 20, halign: "center" } },
  });

  section(autoTable, doc, "TESPİT EDİLEN EKSİKLİKLER", lastY(doc, 65) + 4, fontName);
  autoTable(doc, {
    startY: lastY(doc, 70),
    theme: "plain",
    margin: { left: 10, right: 10 },
    styles: { font: fontName, fontSize: 6.8, cellPadding: 1.2, textColor: [15, 23, 42] },
    body: [[record.detectedDeficiencies || "-"]],
  });

  section(autoTable, doc, "YAPILACAK DÜZENLEMELER (DÜZELTİCİ / ÖNLEYİCİ FAALİYETLER)", lastY(doc, 82) + 4, fontName);
  autoTable(doc, {
    startY: lastY(doc, 87),
    theme: "plain",
    margin: { left: 10, right: 10 },
    styles: { font: fontName, fontSize: 6.8, cellPadding: 1.2, textColor: [15, 23, 42] },
    body: [[record.correctiveActions || "-"]],
  });

  doc.setFont(fontName, "normal");
  doc.setFontSize(6.5);
  doc.text(`Belge Tarihi: ${formatDateTr(record.nextReviewDate || record.drillDate)}`, 10, lastY(doc, 99) + 6);

  autoTable(doc, {
    startY: Math.max(lastY(doc, 105) + 8, 130),
    theme: "grid",
    margin: { left: 10, right: 10 },
    styles: { font: fontName, fontSize: 6.5, cellPadding: 2, halign: "center", valign: "middle", lineColor: [0, 0, 0], lineWidth: 0.25, minCellHeight: 28, textColor: [15, 23, 42] },
    body: [[
      `İŞVEREN / VEKİLİ\n\n${record.employerName || "Ad Soyad"}\n\nİmza`,
      `İŞ GÜVENLİĞİ UZMANI\n\n${record.specialistName || "Ad Soyad"}\n\nİmza`,
      `TATBİKAT KOORDİNATÖRÜ\n\n${record.coordinatorName || "Ad Soyad"}\n\nİmza`,
    ]],
    columnStyles: { 0: { cellWidth: 63.33 }, 1: { cellWidth: 63.33 }, 2: { cellWidth: 63.34 } },
  });

  addFooter(doc, 2, 2, fontName);
  doc.save(`Acil_Durum_Tatbikat_Tutanagi_${safeFileName(record.companyName || "Firma")}_${record.drillDate}.pdf`);
}
