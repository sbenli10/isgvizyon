export type BulkCapaLegalBasisEntry = {
  description: string;
  riskDefinition: string;
  relatedDepartment: string;
};

export const getBulkCapaLegalBasis = (entry: BulkCapaLegalBasisEntry) => {
  const haystack = `${entry.description} ${entry.riskDefinition} ${entry.relatedDepartment}`.toLocaleLowerCase("tr-TR");

  if (haystack.includes("elektrik") || haystack.includes("pano") || haystack.includes("priz") || haystack.includes("kablo")) {
    return "İşyeri Bina ve Eklentileri Yönetmeliği Ek-1, Elektrik Tesislerinde Topraklamalar Yönetmeliği, 6331 Sayılı Kanun Md. 4.";
  }
  if (haystack.includes("yangın") || haystack.includes("tüp") || haystack.includes("acil durum") || haystack.includes("parlama")) {
    return "Binaların Yangından Korunması Hakkında Yönetmelik, Acil Durumlar Hakkında Yönetmelik, 6331 Sayılı Kanun Md. 11.";
  }
  if (haystack.includes("kimyasal") || haystack.includes("solvent") || haystack.includes("boya")) {
    return "Kimyasal Maddelerle Çalışmalarda Sağlık ve Güvenlik Önlemleri Yönetmeliği, KKD Kullanımı Yönetmeliği.";
  }
  if (haystack.includes("forklift") || haystack.includes("istif") || haystack.includes("trafik")) {
    return "İş Ekipmanlarının Kullanımında Sağlık ve Güvenlik Şartları Yönetmeliği, Güvenlik ve Sağlık İşaretleri Yönetmeliği.";
  }
  if (haystack.includes("yüksekte") || haystack.includes("iskele") || haystack.includes("merdiven")) {
    return "Yapı İşlerinde İş Sağlığı ve Güvenliği Yönetmeliği, İş Ekipmanlarının Kullanımında Sağlık ve Güvenlik Şartları Yönetmeliği.";
  }

  return "6331 Sayılı İş Sağlığı ve Güvenliği Kanunu Md. 4, İş Sağlığı ve Güvenliği Risk Değerlendirmesi Yönetmeliği, İşyeri Bina ve Eklentileri Yönetmeliği.";
};
