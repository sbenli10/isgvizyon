export type UserFacingErrorDetails = {
  title: string;
  description: string;
  action: string;
  severity: "info" | "warning" | "error";
  code: string;
};

const DEFAULT_ERROR: UserFacingErrorDetails = {
  title: "İşlem tamamlanamadı",
  description: "Sistem beklenmeyen bir yanıt verdi veya işlem yarıda kaldı.",
  action: "Birkaç saniye sonra tekrar deneyin. Sorun sürerse sayfayı yenileyin.",
  severity: "error",
  code: "unknown",
};

function getErrorText(error: unknown) {
  return String(
    (error as { message?: string; error_description?: string })?.message ||
      (error as { error_description?: string })?.error_description ||
      error ||
      "",
  ).trim();
}

function matches(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

export function getUserFacingError(error: unknown): UserFacingErrorDetails {
  const rawText = getErrorText(error);
  const text = rawText.toLowerCase();

  if (!rawText) {
    return DEFAULT_ERROR;
  }

  if (matches(text, ["429", "too many requests", "rate limit"])) {
    return {
      title: "Çok fazla deneme yapıldı",
      description: "Sistem güvenliği için kısa süreli istek sınırına ulaşıldı.",
      action: "30-60 saniye bekleyin ve tekrar deneyin. Gerekirse yeni e-posta göndermeden önce biraz bekleyin.",
      severity: "warning",
      code: "rate_limit",
    };
  }

  if (matches(text, ["email not confirmed", "e-posta doğrulanmamış"])) {
    return {
      title: "E-posta doğrulaması tamamlanmadı",
      description: "Hesabınız oluşturulmuş olabilir ancak e-posta onayı bekleniyor.",
      action: "Gelen kutunuzu ve spam klasörünü kontrol edin. Gerekirse doğrulama e-postasını yeniden gönderin.",
      severity: "warning",
      code: "email_not_confirmed",
    };
  }

  if (matches(text, ["invalid login credentials"])) {
    return {
      title: "Giriş bilgileri doğrulanamadı",
      description: "E-posta veya şifre eşleşmedi.",
      action: "E-posta adresinizi kontrol edin. Şifrenizi unuttuysanız şifre sıfırlama bağlantısını kullanın.",
      severity: "warning",
      code: "invalid_credentials",
    };
  }

  if (matches(text, ["row-level security", "violates row-level security policy"])) {
    return {
      title: "Hesap kurulumu tamamlanamadı",
      description: "Veritabanı güvenlik kuralı bu işlemi şu anda kabul etmedi.",
      action: "Sayfayı yenileyip tekrar deneyin. Sorun sürerse sistem yöneticisi veritabanı yetkilerini kontrol etmelidir.",
      severity: "error",
      code: "rls_policy",
    };
  }

  if (matches(text, ["network", "failed to fetch", "load failed", "internet", "networkerror"])) {
    return {
      title: "Bağlantı sorunu oluştu",
      description: "Sunucuya erişim sırasında ağ bağlantısı kesildi veya yanıt alınamadı.",
      action: "İnternet bağlantınızı kontrol edin, VPN kullanıyorsanız kapatıp tekrar deneyin.",
      severity: "warning",
      code: "network",
    };
  }

  if (matches(text, ["jwt", "session", "oturum", "refresh token", "not authenticated"])) {
    return {
      title: "Oturum doğrulanamadı",
      description: "Oturum süreniz dolmuş olabilir veya güvenli erişim anahtarı yenilenemedi.",
      action: "Çıkış yapıp yeniden giriş yapın. Sorun devam ederse tarayıcı önbelleğini temizleyin.",
      severity: "warning",
      code: "session",
    };
  }

  if (matches(text, ["permission denied", "not allowed", "forbidden", "insufficient"])) {
    return {
      title: "Bu işlem için yetki bulunamadı",
      description: "Hesabınız bu işlemi yapmaya yetkili değil veya gerekli erişim tanımlanmamış.",
      action: "Rol ve yetki ayarlarınızı kontrol edin. Gerekirse organizasyon yöneticisinden erişim isteyin.",
      severity: "warning",
      code: "permission",
    };
  }

  if (matches(text, ["already exists", "duplicate", "zaten", "unique constraint"])) {
    return {
      title: "Aynı kayıt zaten mevcut",
      description: "Aynı bilgilerle daha önce oluşturulmuş bir kayıt bulundu.",
      action: "Mevcut kaydı kontrol edin; gerekiyorsa yeni kayıt yerine güncelleme yapın.",
      severity: "warning",
      code: "duplicate",
    };
  }

  if (matches(text, ["not found", "bulunamadı"])) {
    return {
      title: "İlgili kayıt bulunamadı",
      description: "İşlem yapılmak istenen veri artık mevcut olmayabilir veya silinmiş olabilir.",
      action: "Listeyi yenileyin ve doğru kayıt üzerinde işlem yaptığınızdan emin olun.",
      severity: "warning",
      code: "not_found",
    };
  }

  if (matches(text, ["timeout", "timed out"])) {
    return {
      title: "İşlem zaman aşımına uğradı",
      description: "Sunucu beklenen sürede yanıt vermedi.",
      action: "Biraz sonra tekrar deneyin. Büyük dosya veya yoğun işlem varsa daha küçük parçalara bölün.",
      severity: "warning",
      code: "timeout",
    };
  }

  if (matches(text, ["storage", "upload", "bucket", "dosya", "file"])) {
    return {
      title: "Dosya işlemi tamamlanamadı",
      description: "Dosya yükleme, indirme veya depolama işlemi sırasında hata oluştu.",
      action: "Dosya boyutunu ve formatını kontrol edip yeniden deneyin.",
      severity: "warning",
      code: "storage",
    };
  }

  if (matches(text, ["insertbefore", "removechild", "replacechild", "appendchild", "notfounderror"])) {
    return {
      title: "Görünüm oluşturulurken tarayıcı uyumsuzluğu oluştu",
      description: "Tarayıcı eklentisi, otomatik çeviri veya sayfa içi müdahale arayüzü etkiledi.",
      action: "Sayfayı yenileyin. Devam ederse otomatik çeviri ve tarayıcı eklentilerini kapatıp tekrar deneyin.",
      severity: "warning",
      code: "dom_mutation",
    };
  }

  return {
    ...DEFAULT_ERROR,
    description: rawText,
  };
}

export function getUserFacingErrorDescription(error: unknown) {
  const details = getUserFacingError(error);
  return `${details.description} ${details.action}`.trim();
}

export function getUserFacingErrorMessage(error: unknown) {
  const details = getUserFacingError(error);
  return `${details.title}. ${details.action}`;
}
