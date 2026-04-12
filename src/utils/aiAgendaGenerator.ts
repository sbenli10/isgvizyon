import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AgendaItem {
  topic: string;
  description: string;
}

// ✅ Industry code to name mapping (NACE kodları)
const INDUSTRY_MAP: Record<string, string> = {
  // İnşaat
  "41": "İnşaat",
  "42": "İnşaat",
  "43": "İnşaat",
  "23.51": "İnşaat",
  
  // Gıda
  "10": "Gıda İmalatı",
  "11": "İçecek İmalatı",
  
  // Sağlık
  "86": "Sağlık",
  "87": "Sağlık",
  "88": "Sağlık",
  
  // Eğitim
  "85": "Eğitim",
  
  // Üretim
  "13": "Üretim",
  "14": "Üretim",
  "15": "Üretim",
  "24": "Üretim",
  "25": "Üretim",
  "28": "Üretim",
  "29": "Üretim",
  
  // Lojistik
  "49": "Lojistik",
  "50": "Lojistik",
  "52": "Lojistik",
  "53": "Lojistik",
};

/**
 * Industry code'u okunabilir isme çevirir
 */
function getIndustryName(industryCode: string): string {
  // Önce tam eşleşme ara
  if (INDUSTRY_MAP[industryCode]) {
    return INDUSTRY_MAP[industryCode];
  }
  
  // Kod içeriyorsa (örn: "23.51 - İnşaat")
  if (industryCode.includes("-")) {
    return industryCode.split("-")[1].trim();
  }
  
  // İlk 2 karaktere göre ara (NACE kodu)
  const prefix = industryCode.substring(0, 2);
  if (INDUSTRY_MAP[prefix]) {
    return INDUSTRY_MAP[prefix];
  }
  
  // Varsayılan olarak kodu döndür
  return industryCode;
}

/**
 * AI ile sektöre özel İSG Kurul Toplantısı gündemi oluşturur
 */
export async function generateAgendaWithAI(
  companyName: string,
  industry: string,
  employeeCount: number
): Promise<AgendaItem[]> {
  try {
    // ✅ Industry code'u isme çevir
    const industryName = getIndustryName(industry);
    
    console.log("🤖 Generating agenda with AI for:", {
      companyName,
      industry: industryName,
      industryCode: industry,
      employeeCount,
    });

// ✅ Kapsamlı ve detaylı prompt
const prompt = `Sen 15 yıllık deneyime sahip, Türkiye İSG mevzuatı uzmanı bir İş Sağlığı ve Güvenliği profesyonelisin. Saha tecrübesiyle birlikte risk yönetimi, kaza analizi ve mevzuat uyumluluğu konularında uzmanlaşmış durumdayısın.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 ŞİRKET PROFILI VE ANALIZ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Şirket Adı: ${companyName}
Faaliyet Sektörü: ${industryName}
Çalışan Sayısı: ${employeeCount} kişi
Toplantı Türü: Aylık İSG Kurul Toplantısı (6331 sayılı Kanun, Madde 22)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 GÖREV VE BEKLENTI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${companyName} şirketi için profesyonel, kapsamlı ve uygulanabilir bir İSG Kurul Toplantısı gündem listesi hazırlamanı istiyorum.

GÜNDEM ÖZELLİKLERİ:
✓ Tam 15 maddelik detaylı gündem
✓ Her madde sektöre özgü riskler ve iş süreçleri dikkate alınarak hazırlanmalı
✓ Mevzuat gereksinimleri (6331 sayılı Kanun, İSG Yönetmeliği) referans alınmalı
✓ Uygulanabilir ve ölçülebilir aksiyonlar içermeli
✓ Gerçekçi ve sahada karşılaşılan sorunlara odaklanmalı

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ SEKTÖRE ÖZEL RİSK ODAKLARI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${industryName} sektörü için aşağıdaki risklere özel vurgu yap:

${getSectorSpecificGuidance(industryName)}

Bu risklere yönelik:
- Mevcut önlemleri değerlendirme
- Eksik/yetersiz nokta tespiti
- İyileştirme önerileri
- Sorumlu atama ve termin belirleme

konularını gündem maddelerine yansıt.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ZORUNLU GÜNDEM MADDELERİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Aşağıdaki standart maddeler MUTLAKA dahil edilmeli, ancak sektöre özel detaylandırılmalı:

1️⃣ Açılış ve Yoklama
   → Toplantı açılışı, yoklama, mazeretlerin tespiti

2️⃣ Önceki Toplantı Kararlarının Takibi
   → Geçmiş toplantıdaki aksiyonların durumu
   → Tamamlanan/geciken işlerin analizi
   → Sorumluların hesap verebilirliği

3️⃣ İş Kazaları ve Ramak Kala Olayların İncelenmesi
   → Son dönem kaza istatistikleri
   → Kök neden analizi (5 Neden, Balık Kılçığı)
   → Tekrar etmemesi için alınacak önlemler
   → Benzer risklerin belirlenmesi

4️⃣ Risk Değerlendirmesi Güncelleme
   → Mevcut risk değerlendirmesinin gözden geçirilmesi
   → Yeni süreçler/ekipmanlar için risk analizi
   → Fine-Kinney skorlarının güncellenmesi
   → Kontrol önlemlerinin etkinliği

5️⃣ Kişisel Koruyucu Donanım (KKD) Yönetimi
   → KKD ihtiyaç analizi ve eksik tespiti
   → Kullanım uyum denetimi
   → Eğitim ihtiyacı
   → Tedarik ve değişim planı

6️⃣ İSG Eğitim Programları
   → Yıllık eğitim planı oluşturma/güncelleme
   → Genel, mesleki, acil durum eğitimleri
   → Eğitim etkinliğinin değerlendirilmesi
   → Yeni işe başlayan personel eğitimleri

7️⃣ Sağlık Gözetimi ve Periyodik Muayeneler
   → İşe giriş ve periyodik muayene takvimi
   → Kronik hastalık/özür durumu olan çalışanlar
   → İşyeri hekimi raporlarının değerlendirilmesi
   → Ergonomik risk azaltma önerileri

8️⃣ Sektöre Özel Risk Yönetimi
   → ${industryName} sektörüne özgü tehlikeler
   → Makine/ekipman güvenlik kontrolleri
   → Çevresel faktörler (gürültü, kimyasal, biyolojik)
   → Taşeron/ziyaretçi güvenliği

9️⃣ Dilek ve Temenniler
   → Çalışan temsilcisinin gözlem ve önerileri
   → Çalışanlardan gelen geri bildirimler
   → Güvenlik komitesi önerileri

🔟 Kapanış ve Karar Özeti
   → Alınan kararların özeti
   → Sorumlu atamaları ve terminler
   → Bir sonraki toplantı tarihi

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━��━━━━━━━
📝 DETAYLANDIRMA GEREKSİNİMLERİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Her gündem maddesi için:

✓ "topic" (Başlık):
  - Net ve profesyonel
  - Maksimum 100 karakter
  - Eylem odaklı ifadeler kullan
  - Örnek: "Makine Koruyucu Sistemleri ve Acil Durdurma Butonları Güvenlik Denetimi"

✓ "description" (Açıklama):
  - Kapsamlı ve detaylı
  - Maksimum 250 karakter
  - Nelerin konuşulacağını açıkça belirt
  - Somut örnekler ver
  - Alt başlıklar kullan (virgül ile ayır)
  - Örnek: "Üretim hatlarındaki tüm makinelerin koruyucu sistemleri kontrol edilecek, acil durdurma butonlarının fonksiyonel testleri yapılacak, eksik/arızalı olanlar tespit edilecek, bakım planı oluşturulacak"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 ÇIKTI FORMATI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Yanıtını SADECE ve SADECE aşağıdaki JSON formatında ver.
Markdown, açıklama, yorum EKLEMEYİN!

[
  {
    "topic": "Açılış, Yoklama ve Mazeretlerin Tespiti",
    "description": "Kurul üyelerinin katılım kontrolü yapılacak, mazeret bildirenlerin durumu değerlendirilecek, toplantı açılışı gerçekleştirilecek ve gündem maddelerine geçiş yapılacak"
  },
  {
    "topic": "Önceki Kurul Toplantısı Kararlarının Takip ve Değerlendirmesi",
    "description": "Bir önceki toplantıda alınan kararların uygulama durumu incelenecek, tamamlanan işler onaylanacak, geciken aksiyonların sebepleri araştırılacak, yeni terminler belirlenecek"
  }
]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 ŞİMDİ BAŞLA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${companyName} (${industryName} sektörü, ${employeeCount} çalışan) için yukarıdaki tüm kriterleri karşılayan, profesyonel ve kapsamlı 10 maddelik İSG Kurul Toplantısı gündem listesi oluştur.

JSON çıktısını VER:`;

    // ✅ Supabase session kontrolü
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      console.warn("⚠️ No session, using fallback agenda");
      toast.info("AI gündem oluşturulamadı, varsayılan gündem kullanılıyor");
      return getDefaultAgenda(industryName);
    }

    // ✅ Supabase Edge Function çağrısı
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    if (!supabaseUrl) {
      console.error("❌ Supabase URL not configured");
      throw new Error("Supabase URL yapılandırılmamış");
    }

    console.log("📡 Calling Edge Function...");

    const response = await fetch(
      `${supabaseUrl}/functions/v1/generate-agenda`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          prompt,
          companyName,
          industry: industryName,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Edge Function error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      
      // Parse error if possible
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.error || `API hatası: ${response.status}`);
      } catch {
        throw new Error(`API hatası: ${response.status}`);
      }
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "AI gündem oluşturulamadı");
    }

    console.log("✅ AI agenda generated successfully:", {
      itemCount: data.agenda?.length,
      model: data.metadata?.model,
    });

    // Validate response
    if (!Array.isArray(data.agenda) || data.agenda.length === 0) {
      console.warn("⚠️ Invalid AI response, using fallback");
      throw new Error("Geçersiz AI yanıtı");
    }

    // Validate each item
    const validAgenda = data.agenda.filter(
      (item: any) => item.topic && item.description
    );

    if (validAgenda.length === 0) {
      throw new Error("Geçerli gündem maddesi bulunamadı");
    }

    toast.success("✅ AI gündem oluşturuldu!", {
      description: `${validAgenda.length} madde eklendi`,
    });

    return validAgenda;
  } catch (error: any) {
    console.error("❌ AI agenda generation error:", error);

    // User-friendly error messages
    let errorMessage = "AI gündem oluşturulamadı";
    let errorDescription = "Varsayılan gündem kullanılıyor";

    if (error.message?.includes("not configured")) {
      errorMessage = "Sistem yapılandırma hatası";
      errorDescription = "Lütfen yöneticinize bildirin";
    } else if (error.message?.includes("API hatası: 500")) {
      errorMessage = "Sunucu hatası";
      errorDescription = "API anahtarı eksik olabilir";
    } else if (error.message?.includes("Oturum")) {
      errorMessage = "Oturum süresi dolmuş";
      errorDescription = "Lütfen yeniden giriş yapın";
    } else if (error.message) {
      errorDescription = error.message;
    }

    toast.error(errorMessage, {
      description: errorDescription,
    });

    // Fallback: Varsayılan gündem
    const industryName = getIndustryName(industry);
    return getDefaultAgenda(industryName);
  }
}

/**
 * Sektöre özel güvenlik rehberliği
 */
function getSectorSpecificGuidance(industry: string): string {
  const guidance: Record<string, string> = {
    İnşaat: `
- Yüksekte çalışma güvenliği (iskele, platform, emniyet kemeri)
- İş makineleri ve vinç güvenliği
- Şantiye içi trafik düzeni
- Yapı malzemesi depolama ve istifleme
- Kazı çalışmaları ve göçük riski
- Elektrik tesisatı güvenliği
- Çatı ve cephe çalışmaları`,
    
    Sağlık: `
- Biyolojik risk ve enfeksiyon kontrolü
- Kesici-delici alet yaralanmaları
- Tıbbi atık yönetimi
- Hasta taşıma ve ergonomi
- Kimyasal dezenfektanlar ve ilaçlar
- Psikolojik riskler (şiddet, stres)
- Radyasyon güvenliği`,
    
    Üretim: `
- Makine koruyucuları ve güvenlik sistemleri
- Kimyasal madde güvenliği (MSDS kontrol)
- Toz, gürültü, titreşim riskleri
- Ergonomik risklerin değerlendirilmesi
- Forklift ve taşıma ekipmanları
- Elektrik panoları ve kablo düzeni
- Yangın ve patlama riski`,
    
    Lojistik: `
- Araç ve forklift güvenliği
- Yükleme-boşaltma operasyonları
- Depo istifleme ve raf güvenliği
- Sürücü sağlığı ve yorgunluk
- Tehlikeli madde taşımacılığı (varsa)
- Geri manevra ve görüş alanı kontrolleri
- Trafik düzeni ve yaya güvenliği`,
    
    "Gıda İmalatı": `
- Hijyen ve sanitasyon kontrolleri
- Gıda güvenliği ve çapraz kontaminasyon
- Soğuk zincir ve depolama
- Kesici makineler ve karıştırıcılar
- Kaygan zemin ve düşme riskleri
- Allerjen yönetimi
- Kimyasal temizlik maddeleri`,
    
    Eğitim: `
- Öğrenci ve personel güvenliği
- Acil durum ve tahliye planları
- Laboratuvar güvenliği (varsa)
- Oyun alanları ve spor salonu kontrolleri
- Yangın güvenliği ve yangın söndürme sistemleri
- Psikolojik riskler (zorbalık, şiddet)
- Yemek güvenliği ve hijyen`,
    
    "İçecek İmalatı": `
- Hijyen ve sanitasyon
- Kimyasal madde güvenliği
- Basınçlı kaplar ve kazanlar
- Dolum hatları ve makine güvenliği
- Depolama ve istifleme
- Soğuk zincir`,
  };

  return (
    guidance[industry] ||
    `
- Sektöre özgü risklerin belirlenmesi
- İş ekipmanları ve makine güvenliği
- Çalışma ortamı koşulları (aydınlatma, havalandırma)
- Acil durum hazırlığı ve tatbikatlar
- Ergonomik riskler ve fiziksel yüklenme
- Kimyasal ve fiziksel etkenler
- Yangın güvenliği`
  );
}

/**
 * Fallback: Sektöre göre varsayılan gündem
 */
function getDefaultAgenda(industry: string): AgendaItem[] {
  const commonAgenda: AgendaItem[] = [
    {
      topic: "Açılış ve Yoklama",
      description: "Kurul üyelerinin katılım kontrolü ve toplantı açılışı",
    },
    {
      topic: "Önceki Toplantı Kararlarının Değerlendirilmesi",
      description: "Bir önceki toplantıda alınan kararların uygulama durumunun incelenmesi",
    },
    {
      topic: "İş Kazaları ve Ramak Kala Olayların İncelenmesi",
      description: "Son dönemde meydana gelen kazalar ve ramak kala olayların kök neden analizi",
    },
    {
      topic: "Risk Değerlendirmesi Çalışmalarının Gözden Geçirilmesi",
      description: "Mevcut risk değerlendirmelerinin güncellenmesi ve yeni risklerin belirlenmesi",
    },
    {
      topic: "Acil Durum Planları ve Yangın Tatbikatları",
      description: "Acil durum senaryolarının gözden geçirilmesi ve tatbikat planlaması",
    },
    {
      topic: "Kişisel Koruyucu Donanım (KKD) Kullanımı ve Kontrolü",
      description: "KKD kullanım uyumunun denetimi ve eksikliklerin tespiti",
    },
    {
      topic: "İş Sağlığı ve Güvenliği Eğitim Programları",
      description: "Çalışanlara verilecek İSG eğitimlerinin planlanması ve takibi",
    },
    {
      topic: "Sağlık Gözetimi ve Periyodik Muayeneler",
      description: "Çalışanların sağlık muayenelerinin takibi ve sonuçların değerlendirilmesi",
    },
  ];

  // Sektöre özel maddeler
  const sectorSpecific: Record<string, AgendaItem[]> = {
    İnşaat: [
      {
        topic: "Yüksekte Çalışma Güvenliği ve İskele Kontrolleri",
        description: "İskele, platform ve düşme önleme sistemlerinin periyodik kontrolü",
      },
      {
        topic: "İş Makineleri ve Kaldırma Ekipmanları Güvenliği",
        description: "İş makinelerinin bakım-onarım durumu ve operatör yetkileri",
      },
    ],
    Sağlık: [
      {
        topic: "Biyolojik Risk Yönetimi ve Enfeksiyon Kontrolü",
        description: "Enfeksiyon önleme protokollerinin etkinliğinin değerlendirilmesi",
      },
      {
        topic: "Tıbbi Atık Yönetimi ve Bertaraf Prosedürleri",
        description: "Tıbbi atıkların güvenli toplanması, depolanması ve bertarafı",
      },
    ],
    Üretim: [
      {
        topic: "Makine Koruyucuları ve Güvenlik Sistemleri Kontrolü",
        description: "Üretim hatlarındaki makine koruyucularının fonksiyonel kontrolü",
      },
      {
        topic: "Kimyasal Madde Güvenliği ve MSDS Kontrolü",
        description: "Kimyasal envanteri, etiketleme ve MSDS güncelliği kontrolü",
      },
    ],
    Lojistik: [
      {
        topic: "Araç Filosu ve Forklift Güvenlik Kontrolleri",
        description: "Araç bakım kayıtları ve operatör yetkinlik kontrolleri",
      },
      {
        topic: "Yükleme-Boşaltma ve Depo Güvenlik Prosedürleri",
        description: "Depo düzeni, istifleme ve yükleme operasyonları güvenliği",
      },
    ],
    "Gıda İmalatı": [
      {
        topic: "Hijyen Kontrolleri ve Sanitasyon Prosedürleri",
        description: "Temizlik-dezenfeksiyon uygulamalarının değerlendirilmesi",
      },
      {
        topic: "Gıda Güvenliği ve Çapraz Kontaminasyon Önlemleri",
        description: "Allerjen yönetimi ve kontaminasyon riski önleme çalışmaları",
      },
    ],
    Eğitim: [
      {
        topic: "Öğrenci ve Personel Güvenlik Kontrolleri",
        description: "Okul güvenliği ve acil durum hazırlığının değerlendirilmesi",
      },
      {
        topic: "Oyun Alanı ve Spor Salonu Güvenliği",
        description: "Ekipman kontrolleri ve zemin güvenliği",
      },
    ],
  };

  // Sektöre göre ekle
  const industryAgenda = sectorSpecific[industry] || [];

  const finalAgenda = [
    ...commonAgenda,
    ...industryAgenda,
    {
      topic: "Çalışan Görüşleri, Dilek ve Temenniler",
      description: "Çalışan temsilcilerinin ve kurul üyelerinin önerileri",
    },
    {
      topic: "Kapanış ve Bir Sonraki Toplantı Tarihi",
      description: "Toplantının sona erdirilmesi ve gelecek toplantı planlaması",
    },
  ];

  console.log(`ℹ️ Using default agenda for ${industry} (${finalAgenda.length} items)`);
  
  return finalAgenda;
}