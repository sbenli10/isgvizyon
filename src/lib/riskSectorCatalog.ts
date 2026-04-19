export type RiskSectorCatalogItem = {
  code: string;
  name: string;
  itemCount: number;
  icon: string;
  group: string;
};

const inferIcon = (name: string) => {
  const upper = name.toLocaleUpperCase("tr-TR");
  if (upper.includes("HASTANE") || upper.includes("SAĞLIK") || upper.includes("LABORATUVAR") || upper.includes("VETERİNER")) return "🏥";
  if (upper.includes("İNŞAAT") || upper.includes("ŞANTİYE") || upper.includes("HAFRİYAT") || upper.includes("YIKIM") || upper.includes("KÖPRÜ") || upper.includes("TÜNEL")) return "🏗️";
  if (upper.includes("OTEL") || upper.includes("RESTORAN") || upper.includes("KAFE") || upper.includes("YEMEKHANE")) return "🏨";
  if (upper.includes("OFİS") || upper.includes("BÜRO") || upper.includes("MUHASEBE") || upper.includes("HUKUK") || upper.includes("DANIŞMANLIK")) return "💼";
  if (upper.includes("FABRİKA") || upper.includes("ATÖLYE") || upper.includes("METAL") || upper.includes("DÖKÜM") || upper.includes("KAYNAK") || upper.includes("TORNA")) return "🏭";
  if (upper.includes("TEKSTİL") || upper.includes("DERİ") || upper.includes("AYAKKABI")) return "🧵";
  if (upper.includes("GIDA") || upper.includes("KASAP") || upper.includes("CATERING")) return "🍽️";
  if (upper.includes("TARIM") || upper.includes("ÇİFTLİK") || upper.includes("SERA") || upper.includes("BAHÇE")) return "🌾";
  if (upper.includes("AKARYAKIT") || upper.includes("DOĞALGAZ")) return "⛽";
  if (upper.includes("LİMAN") || upper.includes("MARİNA")) return "⚓";
  if (upper.includes("HAVALİMANI") || upper.includes("HANGAR")) return "✈️";
  if (upper.includes("NAKLİYE") || upper.includes("KARGO") || upper.includes("KURYE") || upper.includes("OTOBÜS") || upper.includes("TAKSİ")) return "🚚";
  if (upper.includes("OKUL") || upper.includes("EĞİTİM")) return "📚";
  if (upper.includes("GÜVENLİK")) return "🛡️";
  if (upper.includes("MADEN") || upper.includes("TAŞOCAĞI")) return "⛏️";
  if (upper.includes("MAĞAZA") || upper.includes("AVM") || upper.includes("PETSHOP") || upper.includes("NALBUR")) return "🛒";
  if (upper.includes("SPOR") || upper.includes("HALI SAHA") || upper.includes("AQUAPARK") || upper.includes("LUNAPARK")) return "🏟️";
  return "📋";
};

const inferGroup = (name: string) => {
  const upper = name.toLocaleUpperCase("tr-TR");
  if (["FABRİKA", "ATÖLYE", "TERSANE", "MADEN", "ENERJİ", "DEMİRÇELİK", "DÖKÜM", "METAL", "KAYNAK", "TORNA", "OTOMOTİV", "YEDEKPARÇA", "LASTİK", "PLASTİK", "KİMYA", "BOYA", "İLAÇ", "KOZMETİK", "CAM", "SERAMİK", "ÇİMENTO", "BETON", "MERMER", "TAŞOCAĞI", "TEKSTİL", "BOYAHANE (TEKSTİL)", "DERİ", "AYAKKABI", "MOBİLYA", "MARANGOZ", "DOĞRAMA", "KAĞIT", "MATBAA", "AMBALAJ", "DOLUM", "GIDA", "KALIP", "MONTAJ", "GERİDÖNÜŞÜM", "ARITMA", "SİLAH"].some((value) => upper.includes(value))) return "Üretim";
  if (["HASTANE", "SAĞLIK OCAĞI", "ACİL SERVİS", "ECZANE", "SAĞLIK DEPO", "LABORATUVAR", "MEDİKAL", "VETERİNER", "BAKIMEVİ", "KREŞ", "GÜZELLİK SALONU", "KUAFÖR", "SOLARYUM", "SPA", "KAPLICA"].some((value) => upper.includes(value))) return "Sağlık ve Hizmet";
  if (["MAĞAZA", "AVM", "BİLGİSAYARCI", "KIRTASİYE", "SPOR MAĞAZASI", "AV MALZEMELERİ", "PETSHOP", "NALBUR", "BOYACI (SATIŞ)", "PAZARYERİ"].some((value) => upper.includes(value))) return "Perakende";
  if (["İNŞAAT", "ŞANTİYE", "MİMARLIK", "MÜHENDİSLİK", "ZEMİN", "HAFRİYAT", "YIKIM", "DEKORASYON", "TADİLAT", "TAMİRHANE", "SERVİS", "OTOSERVIS", "KAPORTA", "ELEKTRİK", "TESİSAT", "DOĞALGAZ", "İKLİMLENDİRME", "HAVALANDIRMA", "ASANSÖR", "YÜRÜYEN MERDİVEN", "İZOLASYON", "YALITIM", "ÇATI", "CEPHE", "CAMCI", "ALÜMİNYUM", "PVC", "DEMİRCİ", "KAYNAKÇI", "PEYZAJ", "BAHÇE", "HAVUZ", "SONDAJ", "İSKELE", "VİNÇ", "YOL", "KÖPRÜ", "TÜNEL"].some((value) => upper.includes(value))) return "İnşaat ve Teknik";
  if (["OTEL", "RESTORAN", "KAFE", "YEMEKHANE", "CATERING", "DÜĞÜN SALONU"].some((value) => upper.includes(value))) return "Konaklama ve Gıda";
  if (["OFİS", "BÜRO", "BANKA", "SİGORTA", "EKSPER", "MUHASEBE", "HUKUK", "NOTER", "DANIŞMANLIK", "ÇAĞRI MERKEZİ", "EMLAK", "SİTE YÖNETİMİ"].some((value) => upper.includes(value))) return "Ofis ve Hizmet";
  if (["NAKLİYE", "KARGO", "KURYE", "HANGAR", "LİMAN", "MARİNA", "HAVALİMANI", "METRO", "TRAMVAY", "TELEFERİK", "OTOBÜS", "TAKSİ", "RENT A CAR", "OTOPARK", "OTO YIKAMA", "AKARYAKIT İSTASYONU"].some((value) => upper.includes(value))) return "Ulaşım ve Lojistik";
  if (["EĞİTİM KURUMLARI", "TARIM", "ÇİFTLİK", "SERA", "HAYVANCILIK", "SPOR SALONU", "HALI SAHA", "AQUAPARK", "LUNAPARK", "OYUN SALONU", "İNTERNET KAFE", "POLİGON", "PAINTBALL", "KAYAK MERKEZİ", "TEMİZLİK HİZMETLERİ", "HALI YIKAMA", "TERZİ", "TAMİRCİ", "AYAKKABICI"].some((value) => upper.includes(value))) return "Genel Hizmet";
  return "Genel";
};

const RAW_SECTORS: Array<[string, string, number]> = [
  ["01", "FABRİKA", 15], ["02", "ATÖLYE", 15], ["03", "TERSANE", 20], ["04", "MADEN", 20], ["08", "ENERJİ", 15],
  ["09", "DEMİRÇELİK", 25], ["10", "DÖKÜM", 15], ["12", "METAL", 15], ["13", "KAYNAK", 15], ["14", "TORNA", 15],
  ["18", "OTOMOTİV", 14], ["19", "YEDEKPARÇA", 15], ["20", "LASTİK", 15], ["21", "PLASTİK", 15], ["23", "KİMYA", 15],
  ["24", "BOYA", 15], ["27", "İLAÇ", 15], ["28", "KOZMETİK", 15], ["29", "CAM", 15], ["30", "SERAMİK", 15],
  ["32", "ÇİMENTO", 15], ["33", "BETON", 15], ["36", "MERMER", 15], ["37", "TAŞOCAĞI", 15], ["38", "TEKSTİL", 15],
  ["43", "BOYAHANE (TEKSTİL)", 15], ["45", "DERİ", 15], ["46", "AYAKKABI", 15], ["49", "MOBİLYA", 15], ["52", "MARANGOZ", 15],
  ["53", "DOĞRAMA", 15], ["54", "KAĞIT", 15], ["56", "MATBAA", 15], ["57", "AMBALAJ", 15], ["58", "DOLUM", 15],
  ["60", "GIDA", 15], ["61", "KALIP", 15], ["62", "MONTAJ", 15], ["63", "GERİDÖNÜŞÜM", 15], ["64", "ARITMA", 15],
  ["65", "SİLAH", 15], ["66", "GÜVENLİK", 15], ["68", "HASTANE", 15], ["70", "SAĞLIK OCAĞI", 15], ["72", "ACİL SERVİS", 15],
  ["74", "ECZANE", 15], ["75", "SAĞLIK DEPO", 15], ["76", "LABORATUVAR", 15], ["79", "MEDİKAL", 15], ["81", "VETERİNER", 15],
  ["88", "BAKIMEVİ", 15], ["89", "KREŞ", 15], ["90", "GÜZELLİK SALONU", 15], ["93", "KUAFÖR", 15], ["96", "SOLARYUM", 15],
  ["97", "SPA", 15], ["101", "KAPLICA", 15], ["113", "KASAP", 30], ["121", "MAĞAZA", 15], ["122", "AVM", 15],
  ["127", "BİLGİSAYARCI", 15], ["128", "KIRTASİYE", 15], ["131", "SPOR MAĞAZASI", 15], ["132", "AV MALZEMELERİ", 15], ["134", "PETSHOP", 15],
  ["137", "NALBUR", 15], ["138", "BOYACI (SATIŞ)", 15], ["140", "PAZARYERİ", 15], ["141", "İNŞAAT (YAPIM İŞLERİ)", 15], ["142", "ŞANTİYE (SAHA VE ORTAM)", 15],
  ["143", "MİMARLIK", 15], ["144", "MÜHENDİSLİK", 15], ["145", "ZEMİN", 15], ["146", "HAFRİYAT", 15], ["147", "YIKIM", 15],
  ["148", "DEKORASYON", 15], ["149", "TADİLAT", 15], ["150", "TAMİRHANE", 15], ["151", "SERVİS", 15], ["152", "OTOSERVIS", 15],
  ["153", "KAPORTA", 15], ["154", "ELEKTRİK", 15], ["155", "TESİSAT", 15], ["156", "DOĞALGAZ", 15], ["157", "İKLİMLENDİRME", 15],
  ["158", "HAVALANDIRMA", 15], ["159", "ASANSÖR", 15], ["160", "YÜRÜYEN MERDİVEN", 15], ["161", "İZOLASYON", 15], ["162", "YALITIM", 15],
  ["163", "ÇATI", 15], ["164", "CEPHE", 15], ["165", "CAMCI", 15], ["166", "ALÜMİNYUM", 15], ["167", "PVC", 15],
  ["168", "DEMİRCİ", 15], ["169", "KAYNAKÇI (ŞANTİYE)", 15], ["170", "PEYZAJ", 15], ["171", "BAHÇE", 15], ["172", "HAVUZ (YAPIM)", 15],
  ["173", "SONDAJ", 15], ["174", "İSKELE", 15], ["175", "VİNÇ", 15], ["176", "YOL", 15], ["177", "KÖPRÜ", 15],
  ["178", "TÜNEL", 15], ["179", "OTEL", 10], ["180", "RESTORAN", 10], ["181", "KAFE", 10], ["183", "YEMEKHANE", 10],
  ["184", "CATERING", 10], ["187", "DÜĞÜN SALONU", 10], ["189", "OFİS", 10], ["190", "BÜRO", 10], ["191", "BANKA", 10],
  ["192", "SİGORTA", 10], ["193", "EKSPER", 10], ["194", "MUHASEBE", 10], ["195", "HUKUK", 10], ["196", "NOTER", 10],
  ["197", "DANIŞMANLIK", 9], ["205", "ÇAĞRI MERKEZİ", 10], ["206", "EMLAK", 10], ["207", "SİTE YÖNETİMİ", 10], ["210", "NAKLİYE", 10],
  ["212", "KARGO", 10], ["213", "KURYE", 10], ["216", "HANGAR", 10], ["218", "LİMAN", 10], ["219", "MARİNA", 10],
  ["220", "HAVALİMANI", 10], ["225", "METRO", 10], ["226", "TRAMVAY", 10], ["227", "TELEFERİK", 10], ["228", "OTOBÜS/MİNİBÜS", 10],
  ["229", "TAKSİ", 10], ["230", "RENT A CAR", 10], ["231", "OTOPARK/VALE", 10], ["232", "OTO YIKAMA", 10], ["233", "AKARYAKIT İSTASYONU", 10],
  ["234", "EĞİTİM KURUMLARI (OKUL/DERSHANE)", 15], ["241", "TARIM", 10], ["242", "ÇİFTLİK", 10], ["243", "SERA", 10], ["244", "HAYVANCILIK", 10],
  ["251", "SPOR SALONU", 10], ["253", "HALI SAHA", 10], ["255", "AQUAPARK", 10], ["256", "LUNAPARK", 10], ["257", "OYUN SALONU", 10],
  ["258", "İNTERNET KAFE", 10], ["259", "POLİGON", 10], ["261", "PAINTBALL", 10], ["262", "KAYAK MERKEZİ", 10], ["263", "TEMİZLİK HİZMETLERİ", 10],
  ["267", "HALI YIKAMA", 10], ["268", "TERZİ", 10], ["269", "TAMİRCİ (GENEL/EV ALETLERİ)", 10], ["270", "AYAKKABICI (TAMİR)", 10], ["278", "GENEL (TÜM SEKTÖRLER)", 35],
];

export const RISK_SECTOR_CATALOG: RiskSectorCatalogItem[] = RAW_SECTORS.map(([code, name, itemCount]) => ({
  code,
  name,
  itemCount,
  icon: inferIcon(name),
  group: inferGroup(name),
}));

export function buildCatalogKey(name: string) {
  return name.toLocaleLowerCase("tr-TR");
}
