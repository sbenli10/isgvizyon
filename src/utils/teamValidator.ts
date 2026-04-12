import { TEAM_REQUIREMENTS, type CompanyInfo, type EmergencyTeams } from "@/types/adep";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// teamValidator.ts

export const validateTeams = (companyInfo: any, teams: any) => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. KORUMA: Eğer sabit yüklenmediyse çökmesini engelle
  if (typeof TEAM_REQUIREMENTS === 'undefined' || !TEAM_REQUIREMENTS) {
    console.warn("TEAM_REQUIREMENTS henüz hazır değil.");
    return { valid: true, errors: [], warnings: [] };
  }

  // 2. KORUMA: teams objesi veya içindeki diziler undefined ise kontrol ekle
  const getCount = (key: string) => (teams && teams[key] ? teams[key].length : 0);

  const req = TEAM_REQUIREMENTS;

  // Örnek kontrol satırı (Hata muhtemelen burada patlıyor)
  if (getCount('sondurme') < (req.sondurme?.min || 0)) {
    errors.push(`${req.sondurme?.label || 'Söndürme ekibi'} en az ${req.sondurme?.min || 0} kişi olmalıdır.`);
  }
  
  // Diğer ekipler için de aynı güvenli yapıyı (optional chaining) kullan:
  if (getCount('kurtarma') < (req.kurtarma?.min || 0)) {
    errors.push(`${req.kurtarma?.label || 'Kurtarma ekibi'} yetersiz.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

export const getRecommendedTeamSizes = (hazardClass: string) => {
  // TEAM_REQUIREMENTS yüklenmemişse boş bir obje dönerek çökmesini engelle
  if (!TEAM_REQUIREMENTS) {
    console.error("TEAM_REQUIREMENTS bulunamadı!");
    return { sondurme: 0, kurtarma: 0, koruma: 0, ilk_yardim: 0 };
  }

  // TEAM_REQUIREMENTS'a erişirken hata almamak için:
  return {
    sondurme: TEAM_REQUIREMENTS.sondurme?.min || 0,
    kurtarma: TEAM_REQUIREMENTS.kurtarma?.min || 0,
    koruma: TEAM_REQUIREMENTS.koruma?.min || 0,
    ilk_yardim: TEAM_REQUIREMENTS.ilk_yardim?.min || 0
  };
};