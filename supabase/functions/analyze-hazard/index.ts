import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getGoogleModelChain, getGoogleLiteModel } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PHOTOS = 3;
const TIMEOUT_MS = 55000;
const DELAY_BETWEEN_PHOTOS_MS = 1500;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getModelCandidates = (primaryModel: string) => {
  return [primaryModel, ...getGoogleModelChain("lite")]
    .filter((model, index, list): model is string => Boolean(model) && list.indexOf(model) === index);
};

const shouldRetryProviderStatus = (status: number) => status === 429 || status === 503;

async function invokeGoogleAIWithRetry({
  requestId,
  apiKey,
  models,
  requestBody,
  context,
}: {
  requestId: string;
  apiKey: string;
  models: string[];
  requestBody: Record<string, unknown>;
  context: string;
}) {
  let lastErrorMessage = "Google AI servisi şu anda yanıt vermiyor.";

  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`🚀 [${requestId}] Google AI'a gönderiliyor...`, { context, model, attempt });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return { data, model };
      }

      const errorText = await response.text();
      lastErrorMessage = errorText;
      console.error(`❌ [${requestId}] HTTP ${response.status}:`, errorText.substring(0, 200));

      if (response.status === 401) {
        throw new Error("Google API Key geçersiz. Lütfen yeni bir API Key oluşturun.");
      }

      if (response.status === 404) {
        console.warn(`⚠️ [${requestId}] Model bulunamadı, sonraki modele geçiliyor: ${model}`);
        break;
      }

      if (shouldRetryProviderStatus(response.status) && attempt < 3) {
        const waitMs = 800 * attempt;
        console.log(`⏳ [${requestId}] Sağlayıcı yoğun, ${waitMs}ms sonra tekrar denenecek...`);
        await delay(waitMs);
        continue;
      }

      if (!shouldRetryProviderStatus(response.status)) {
        break;
      }
    }
  }

  throw new Error(
    `Google AI servisi şu anda yoğun. Sistem tekrar deneme ve yedek model kullanmayı denedi ancak sonuç alamadı. ${lastErrorMessage.substring(0, 220)}`
  );
}

/**
 * ✅ JSON Parse Helper - AI'nın döndürdüğü geçersiz JSON'ları temizler
 */
/**
 * ✅ JSON Parse Helper - Son versiyon (truncated property name desteği)
 */
function parseAIResponse(contentText: string, requestId: string): any {
  try {
    let cleaned = contentText;
    
    // 1. Markdown temizliği
    cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    // 2. JSON objesini bul
    const jsonStart = cleaned.indexOf('{');
    if (jsonStart === -1) {
      throw new Error("JSON formatı bulunamadı");
    }
    
    cleaned = cleaned.substring(jsonStart);
    
    // ✅ 3. Son karakteri kontrol et ve temizle
    // Eğer yarım property name varsa (örn: "frequency) sil
    const lastQuoteIndex = cleaned.lastIndexOf('"');
    if (lastQuoteIndex > 0) {
      const afterLastQuote = cleaned.substring(lastQuoteIndex + 1).trim();
      
      // Son tırnaktan sonra sadece whitespace veya yarım kelime varsa
      if (afterLastQuote.length > 0 && !afterLastQuote.startsWith(':') && !afterLastQuote.startsWith(',') && !afterLastQuote.startsWith('}')) {
        // Bu yarım bir property name, son virgüle kadar kes
        const lastCommaBeforeQuote = cleaned.lastIndexOf(',', lastQuoteIndex);
        if (lastCommaBeforeQuote > 0) {
          cleaned = cleaned.substring(0, lastCommaBeforeQuote);
        }
      }
    }
    
    // ✅ 4. Açık tırnakları kapat
    const quoteCount = (cleaned.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      console.warn(`⚠️  [${requestId}] Açık tırnak bulundu, kapatılıyor...`);
      cleaned += '"';
    }
    
    // ✅ 5. Son karakteri kontrol et (tekrar)
    const lastChar = cleaned.trim().slice(-1);
    
    // Virgül ile bitiyorsa sil
    if (lastChar === ',') {
      cleaned = cleaned.trim().slice(0, -1);
    }
    
    // Başlangıç karakterleriyle bitiyorsa sil
    if (lastChar === '{' || lastChar === '[' || lastChar === ':') {
      const lastComma = cleaned.lastIndexOf(',');
      if (lastComma > 0) {
        cleaned = cleaned.substring(0, lastComma);
      }
    }
    
    // ✅ 6. JSON kapatma parantezini ekle (yoksa)
    if (!cleaned.trim().endsWith('}')) {
      console.warn(`⚠️  [${requestId}] Yanıt kesik, otomatik tamamlanıyor...`);
      
      // Eksik alanları ekle
      const fieldsToAdd = [];
      
      if (!cleaned.includes('"probability"')) {
        fieldsToAdd.push('"probability": 3');
      }
      if (!cleaned.includes('"frequency"')) {
        fieldsToAdd.push('"frequency": 6');
      }
      if (!cleaned.includes('"severity"')) {
        fieldsToAdd.push('"severity": 15');
      }
      if (!cleaned.includes('"legalReference"')) {
        fieldsToAdd.push('"legalReference": "6331 Sayılı İSG Kanunu"');
      }
      if (!cleaned.includes('"immediateAction"')) {
        fieldsToAdd.push('"immediateAction": "Acil müdahale gerekli"');
      }
      if (!cleaned.includes('"preventiveAction"')) {
        fieldsToAdd.push('"preventiveAction": "Kalıcı önlem alınmalı"');
      }
      if (!cleaned.includes('"justification"')) {
        fieldsToAdd.push('"justification": "Risk analizi yapılmıştır"');
      }
      
      if (fieldsToAdd.length > 0) {
        // Virgül ekle (eğer yoksa)
        const trimmed = cleaned.trim();
        if (!trimmed.endsWith(',') && !trimmed.endsWith('{')) {
          cleaned += ', ';
        } else if (trimmed.endsWith('{')) {
          cleaned += ' ';
        }
        
        cleaned += fieldsToAdd.join(', ');
      }
      
      // Kapanış parantezi ekle
      cleaned += ' }';
    } else {
      // JSON zaten kapalıysa son } karakterini bul
      const jsonEnd = cleaned.lastIndexOf('}');
      cleaned = cleaned.substring(0, jsonEnd + 1);
    }
    
    // 7. Whitespace temizliği
    cleaned = cleaned.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ');
    
    // 8. Trailing comma temizliği (son kez)
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
    
    console.log(`🔧 [${requestId}] Temizlenmiş JSON (son 200 kar):`, 
      cleaned.length > 200 ? '...' + cleaned.slice(-200) : cleaned);
    
    const parsedResult = JSON.parse(cleaned);
    
    // 9. Zorunlu alanları kontrol et
    if (!parsedResult.hazardDescription) {
      throw new Error("hazardDescription alanı eksik");
    }
    
    // 10. Eksik alanlar için default değerler
    if (!parsedResult.probability) parsedResult.probability = 3;
    if (!parsedResult.frequency) parsedResult.frequency = 6;
    if (!parsedResult.severity) parsedResult.severity = 15;
    if (!parsedResult.legalReference) parsedResult.legalReference = "6331 Sayılı İSG Kanunu";
    if (!parsedResult.immediateAction) parsedResult.immediateAction = "Acil müdahale gerekli";
    if (!parsedResult.preventiveAction) parsedResult.preventiveAction = "Kalıcı önlem alınmalı";
    if (!parsedResult.justification) parsedResult.justification = "Risk analizi yapılmıştır";
    
    // 11. Tip kontrolü
    parsedResult.riskScore = typeof parsedResult.riskScore === 'number' 
      ? parsedResult.riskScore 
      : parseFloat(parsedResult.riskScore) || (parsedResult.probability * parsedResult.frequency * parsedResult.severity);
    
    parsedResult.probability = typeof parsedResult.probability === 'number' 
      ? parsedResult.probability 
      : parseFloat(parsedResult.probability) || 3;
    
    parsedResult.frequency = typeof parsedResult.frequency === 'number' 
      ? parsedResult.frequency 
      : parseFloat(parsedResult.frequency) || 6;
    
    parsedResult.severity = typeof parsedResult.severity === 'number' 
      ? parsedResult.severity 
      : parseFloat(parsedResult.severity) || 15;
    
    // 12. Risk seviyesi hesapla (eksikse)
    if (!parsedResult.riskLevel) {
      const score = parsedResult.riskScore;
      if (score >= 400) parsedResult.riskLevel = "Kritik";
      else if (score >= 200) parsedResult.riskLevel = "Yüksek";
      else if (score >= 70) parsedResult.riskLevel = "Önemli";
      else if (score >= 20) parsedResult.riskLevel = "Düşük";
      else parsedResult.riskLevel = "Kabul Edilebilir";
    }
    
    return parsedResult;
    
  } catch (parseError: any) {
    console.error(`❌ [${requestId}] JSON Parse Hatası:`, parseError.message);
    console.error(`📄 [${requestId}] Ham İçerik (son 300 kar):`, 
      contentText.length > 300 ? '...' + contentText.slice(-300) : contentText);
    
    // ✅ En son çare: Manuel cleanup ve yeniden dene
    try {
      console.warn(`🔧 [${requestId}] Son çare temizliği deneniyor...`);
      
      let lastResort = contentText;
      
      // JSON'u bul
      const start = lastResort.indexOf('{');
      if (start === -1) throw new Error("JSON bulunamadı");
      
      lastResort = lastResort.substring(start);
      
      // Son property'yi bul ve sil
      const lastComma = lastResort.lastIndexOf(',');
      if (lastComma > 0) {
        lastResort = lastResort.substring(0, lastComma);
      }
      
      // Kapat
      if (!lastResort.trim().endsWith('}')) {
        lastResort += ' }';
      }
      
      const desperate = JSON.parse(lastResort);
      
      // Eksik alanları doldur
      if (!desperate.probability) desperate.probability = 3;
      if (!desperate.frequency) desperate.frequency = 6;
      if (!desperate.severity) desperate.severity = 15;
      if (!desperate.legalReference) desperate.legalReference = "6331 Sayılı İSG Kanunu";
      if (!desperate.immediateAction) desperate.immediateAction = "Acil müdahale gerekli";
      if (!desperate.preventiveAction) desperate.preventiveAction = "Kalıcı önlem alınmalı";
      if (!desperate.justification) desperate.justification = "Risk analizi yapılmıştır";
      
      console.log(`✅ [${requestId}] Son çare başarılı!`);
      return desperate;
      
    } catch (desperateError) {
      throw new Error(`JSON parse hatası: ${parseError.message}`);
    }
  }
}
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`\n🆔 [${requestId}] ===== YENİ ANALIZ İSTEĞİ =====`);

  try {
    const body = await req.json();
    const hazardDescription = body.hazardDescription || "";
    const images = body.images || [];

    console.log(`📊 [${requestId}] Gelen Veri:`, {
      hazardLength: hazardDescription.length,
      imageCount: images.length,
    });

    // ✅ Validasyon
    if (!hazardDescription.trim() && images.length === 0) {
      console.error(`❌ [${requestId}] Validasyon hatası: Boş istek`);
      return new Response(
        JSON.stringify({ error: "Tehlike açıklaması veya görsel zorunludur." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (images.length > MAX_PHOTOS) {
      console.error(`❌ [${requestId}] Limit aşımı: ${images.length} > ${MAX_PHOTOS}`);
      return new Response(
        JSON.stringify({ 
          error: `⚠️ Maksimum ${MAX_PHOTOS} fotoğraf yüklenebilir.` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ Environment Variables
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const GOOGLE_MODEL = getGoogleLiteModel();
    const MODEL_CANDIDATES = getModelCandidates(GOOGLE_MODEL);

    if (!GOOGLE_API_KEY) {
      console.error(`❌ [${requestId}] GOOGLE_API_KEY bulunamadı!`);
      throw new Error("GOOGLE_API_KEY ortam değişkeni ayarlanmamış. Lütfen Supabase Dashboard'dan secret ekleyin.");
    }

    // ✅ API Key format kontrolü
    if (!GOOGLE_API_KEY.startsWith("AIza")) {
      console.error(`❌ [${requestId}] Geçersiz API Key formatı`);
      throw new Error("Google API Key geçersiz format. Lütfen AI Studio'dan yeni key alın.");
    }

    console.log(`🤖 [${requestId}] Model: ${GOOGLE_MODEL}`);
    console.log(`🪜 [${requestId}] Yedek modeller:`, MODEL_CANDIDATES.slice(1));

    const systemPrompt = `Sen 20 yıl sahada çalışmış, sertifikalı A Sınıfı İş Güvenliği Uzmanısın. Türkiye İSG mevzuatına hakimsin ve Fine-Kinney risk değerlendirmesinde uzmansın.

## 🎯 GÖREVIN
Verilen fotoğraf ve/veya açıklamayı analiz edip Fine-Kinney metodolojisi ile risk değerlendirmesi yap.

## 📊 FİNE-KINNEY KRİTERLERİ (DİKKATLE UYGULA)

### Olasılık (O):
- 0.2 = Neredeyse imkansız (yılda 1'den az)
- 0.5 = Oldukça düşük ihtimal (yılda 1-2)
- 1 = Nadir (ayda 1)
- 3 = Ara sıra (haftada 1)
- 6 = Muhtemel (günde 1)
- 10 = Kesin (sürekli)

### Frekans (F):
- 0.5 = Çok nadir maruz kalma (yılda 1)
- 1 = Nadir (ayda 1)
- 2 = Ara sıra (haftada 1)
- 3 = Düzenli (günde 1)
- 6 = Sık (saatte 1)
- 10 = Sürekli maruz kalma

### Şiddet (Ş):
- 1 = Çizik, ilk yardım gerektirmeyen
- 3 = Hafif yaralanma, ilk yardım
- 7 = Önemli yaralanma, iş kaybı
- 15 = Ağır yaralanma, sakatlık
- 40 = Bir kişi ölüm, birden fazla ağır yaralanma
- 100 = Birden fazla kişi ölüm

### Risk Skoru = O × F × Ş

### Risk Seviyesi:
- 0-19: "Kabul Edilebilir"
- 20-69: "Düşük"
- 70-199: "Önemli"
- 200-399: "Yüksek"
- 400+: "Kritik"

## 📜 YASAL ATIF REHBERİ
Analizinde şu mevzuatlardan uygun olanını kullan:
- Elektrik: "Elektrik İç Tesisleri Yönetmeliği (EITR)"
- Genel güvenlik: "6331 Sayılı İSG Kanunu"
- Yangın: "Binaların Yangından Korunması Hakkında Yönetmelik"
- Gaz/LPG: "LPG Piyasası Kanunu ve Yönetmelikleri"
- Yüksekte çalışma: "Yüksekte Çalışmalarda Sağlık ve Güvenlik Önlemleri Yönetmeliği"
- Makine güvenliği: "Makine Emniyeti Yönetmeliği"
- KKD: "Kişisel Koruyucu Donanımlar Yönetmeliği"

## 🎓 ANALİZ KURALLARI

1. **Fotoğrafı dikkatlice incele**: Görünen her tehlikeyi belirle
2. **Gerçekçi skorla**: Abartma veya küçümseme
3. **Somut ol**: "Elektrik riski" değil → "Açık pano nedeniyle 380V gerilime temas riski"
4. **Hemen ve kalıcı ayır**: 
   - Hemen = Bugün yapılacak geçici önlem
   - Kalıcı = Sistemsel, mühendislik çözümü
5. **Yasal atfı doğru yap**: Tehlikenin türüne uygun mevzuatı belirt

## ⚠️ KRİTİK: SADECE JSON DÖNDÜR

Yanıtın MUTLAKA şu formatta olmalı (başka hiçbir şey yazma):

{
  "hazardDescription": "Somut, teknik tehlike tanımı (ne, nerede, nasıl)",
  "probability": 6,
  "frequency": 6,
  "severity": 40,
  "riskScore": 1440,
  "riskLevel": "Kritik",
  "legalReference": "Elektrik İç Tesisleri Yönetmeliği Md. 34",
  "immediateAction": "Enerji kesilerek pano kapatılmalı, uyarı levhası asılmalı, erişim engellenmelidir.",
  "preventiveAction": "Elektrik panoları tip onaylı kapak ile kapatılmalı, boş modül yuvaları kapatılmalı, periyodik bakım planı oluşturulmalıdır.",
  "justification": "380V gerilime günlük maruz kalma (F=6), kesin temas ihtimali (O=6), ölüm riski (Ş=40) nedeniyle Risk Skoru = 6×6×40 = 1440 (Kritik seviye)"
}

🚫 YAPMA: Markdown kullanma,"İşte analiz:" gibi açıklama yazma,Birden fazla JSON dönme,Tahmin yürütme, net olmayan ifadeler kullanma
✅ YAP:Sadece yukarıdaki JSON formatında yanıt ver,Tüm sayısal değerleri yukarıdaki tablolardan seç,Risk skorunu elle hesapla (O × F × Ş),Justification'da hesaplamayı göster,Somut, uygulanabilir aksiyon öner

**TEKRAR EDİYORUM:** Yanıtın SADECE yukarıdaki JSON olmalı. Markdown, açıklama veya başka metin yazma!`;

    // ✅ FOTOĞRAF YOKSA TEK ANALİZ
    if (images.length === 0) {
      console.log(`��� [${requestId}] Fotoğrafsız analiz başlatılıyor...`);

      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [
              { text: systemPrompt },
              { text: `\n\nLütfen şu tehlike durumunu detaylıca analiz et: ${hazardDescription}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              hazardDescription: { type: "string" },
              probability: { type: "number" },
              frequency: { type: "number" },
              severity: { type: "number" },
              riskScore: { type: "number" },
              riskLevel: { type: "string" },
              legalReference: { type: "string" },
              immediateAction: { type: "string" },
              preventiveAction: { type: "string" },
              justification: { type: "string" }
            },
            required: ["hazardDescription", "riskScore", "riskLevel"]
          }
        }
      };

      const { data, model: resolvedModel } = await invokeGoogleAIWithRetry({
        requestId,
        apiKey: GOOGLE_API_KEY,
        models: MODEL_CANDIDATES,
        requestBody,
        context: "text-only",
      });
      console.log(`✅ [${requestId}] Google AI yanıtı alındı`, { model: resolvedModel });

      const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const parsedResult = parseAIResponse(contentText, requestId);

      console.log(`🎉 [${requestId}] Tek analiz tamamlandı - Risk: ${parsedResult.riskScore}`);

      return new Response(JSON.stringify(parsedResult), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ✅ ÇOKLU FOTOĞRAF ANALİZİ (SIRALI)
    console.log(`\n📸 [${requestId}] ===== ÇOKLU FOTOĞRAF ANALİZİ =====`);
    console.log(`📊 [${requestId}] ${images.length} fotoğraf sırayla işlenecek`);
    
    const startTime = Date.now();
    const photoAnalyses = [];

    for (let i = 0; i < images.length; i++) {
      const imageUrl = images[i];
      const photoNumber = i + 1;

      console.log(`\n📷 [${requestId}] ──────────────────────`);
      console.log(`🔄 [${requestId}] Fotoğraf ${photoNumber}/${images.length}`);

      // ✅ Timeout kontrolü
      if (Date.now() - startTime > TIMEOUT_MS) {
        console.error(`⏰ [${requestId}] TIMEOUT! ${photoAnalyses.length}/${images.length} fotoğraf işlendi.`);
        break;
      }

      // ✅ Rate limit koruması
      if (i > 0) {
        console.log(`⏳ [${requestId}] ${DELAY_BETWEEN_PHOTOS_MS}ms bekleniyor...`);
        await delay(DELAY_BETWEEN_PHOTOS_MS);
      }

      try {
        // ✅ Base64 parse
        const base64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
        if (!base64Match) {
          throw new Error("Geçersiz base64 formatı");
        }

        const base64Data = base64Match[1];
        const mimeType = imageUrl.match(/data:(image\/\w+);/)?.[1] || "image/jpeg";

        console.log(`📊 [${requestId}] MIME: ${mimeType}, Boyut: ${(base64Data.length / 1024).toFixed(2)} KB`);

        const requestBody = {
          contents: [
            {
              role: "user",
              parts: [
                { text: systemPrompt },
                { text: `\n\nBU ${photoNumber}. FOTOĞRAF.\n\nTehlike Açıklaması: ${hazardDescription || "Fotoğrafı analiz et"}` },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                hazardDescription: { type: "string" },
                probability: { type: "number" },
                frequency: { type: "number" },
                severity: { type: "number" },
                riskScore: { type: "number" },
                riskLevel: { type: "string" },
                legalReference: { type: "string" },
                immediateAction: { type: "string" },
                preventiveAction: { type: "string" },
                justification: { type: "string" }
              },
              required: ["hazardDescription", "riskScore", "riskLevel"]
            }
          }
        };

        const { data, model: resolvedModel } = await invokeGoogleAIWithRetry({
          requestId,
          apiKey: GOOGLE_API_KEY,
          models: MODEL_CANDIDATES,
          requestBody,
          context: `photo-${photoNumber}`,
        });
        console.log(`✅ [${requestId}] Yanıt alındı`, { model: resolvedModel });
        const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        
        console.log(`📦 [${requestId}] Ham yanıt (ilk 300 kar):`, contentText.substring(0, 300));
        
        const parsedResult = parseAIResponse(contentText, requestId);

        photoAnalyses.push({
          photoNumber,
          ...parsedResult
        });

        console.log(`✅ [${requestId}] Parse başarılı - Risk: ${parsedResult.riskScore} (${parsedResult.riskLevel})`);

      } catch (err: any) {
        console.error(`❌ [${requestId}] Fotoğraf ${photoNumber} hatası:`, err.message);
        // Hata olsa bile devam et, diğer fotoğrafları dene
        continue;
      }
    }

    // ✅ Sonuç kontrolü
    if (photoAnalyses.length === 0) {
      console.error(`❌ [${requestId}] HİÇBİR FOTOĞRAF ANALİZ EDİLEMEDİ!`);
      return new Response(JSON.stringify({ 
        error: "Hiçbir fotoğraf analiz edilemedi. Lütfen farklı fotoğraflar deneyin veya tekrar deneyin.",
        hint: "Fotoğrafların net olduğundan ve tehlike içerdiğinden emin olun."
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`\n🎉 [${requestId}] ===== ANALİZ TAMAMLANDI =====`);
    console.log(`📊 [${requestId}] Sonuç: ${photoAnalyses.length}/${images.length} fotoğraf başarıyla analiz edildi`);
    console.log(`⏱️  [${requestId}] Süre: ${Math.round((Date.now() - startTime) / 1000)}s`);

    const responseData = {
      photoAnalyses,
      summary: {
        totalPhotos: images.length,
        analyzedPhotos: photoAnalyses.length,
        highestRisk: Math.max(...photoAnalyses.map(p => p.riskScore)),
        processingTime: Math.round((Date.now() - startTime) / 1000)
      }
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error(`\n💥 [${requestId}] ===== SUNUCU HATASI =====`);
    console.error(`📛 [${requestId}] Hata Tipi:`, e.name);
    console.error(`📄 [${requestId}] Hata Mesajı:`, e.message);
    console.error(`🔍 [${requestId}] Stack Trace:`, e.stack);

    return new Response(JSON.stringify({ 
      error: e.message || "Bilinmeyen bir hata oluştu",
      requestId,
      hint: e.message?.includes("API Key") 
        ? "Lütfen Google AI Studio'dan (aistudio.google.com) yeni bir API Key oluşturun."
        : "Lütfen tekrar deneyin veya destek ekibiyle iletişime geçin."
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
