import { toast } from "sonner";

export type UserFacingErrorDetails = {
  title: string;
  description: string;
  action: string;
  severity: "info" | "warning" | "error";
  code: string;
};

type ToastOptions = {
  title?: string;
  description?: string;
  fallbackTitle?: string;
  fallbackDescription?: string;
  logLabel?: string;
};

const DEFAULT_ERROR: UserFacingErrorDetails = {
  title: "İşlem tamamlanamadı",
  description: "Sistem beklenmeyen bir yanıt verdi veya işlem yarıda kaldı.",
  action: "Birkaç saniye sonra tekrar deneyin. Sorun sürerse sayfayı yenileyin.",
  severity: "error",
  code: "unknown",
};

const TECHNICAL_TEXT_PATTERNS = [
  /^failed\b/i,
  /^fetch\b/i,
  /^error\b/i,
  /^typeerror\b/i,
  /^syntaxerror\b/i,
  /^referenceerror\b/i,
  /^cannot\b/i,
  /^could not\b/i,
  /^null\b/i,
  /^undefined\b/i,
  /^nan\b/i,
  /violates .*constraint/i,
  /duplicate key/i,
  /row-level security/i,
  /jwt/i,
  /supabase/i,
  /postgrest/i,
  /edge function/i,
];

function getErrorText(error: unknown) {
  if (!error) return "";
  if (typeof error === "string") return error.trim();

  const maybeError = error as {
    message?: unknown;
    error?: unknown;
    error_description?: unknown;
    details?: unknown;
    hint?: unknown;
    code?: unknown;
    status?: unknown;
    statusText?: unknown;
  };

  return String(
    maybeError.message ||
      maybeError.error_description ||
      maybeError.error ||
      maybeError.details ||
      maybeError.hint ||
      maybeError.statusText ||
      maybeError.code ||
      maybeError.status ||
      "",
  ).trim();
}

function normalize(text: string) {
  return text.toLocaleLowerCase("tr-TR");
}

function matches(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

function isTechnicalText(text: string) {
  return TECHNICAL_TEXT_PATTERNS.some((pattern) => pattern.test(text.trim()));
}

function getStatus(error: unknown) {
  const status = Number(
    (error as { status?: unknown; statusCode?: unknown })?.status ||
      (error as { statusCode?: unknown })?.statusCode,
  );
  return Number.isFinite(status) ? status : null;
}

export function getUserFacingError(error: unknown): UserFacingErrorDetails {
  const rawText = getErrorText(error);
  const text = normalize(rawText);
  const status = getStatus(error);

  if (!rawText) return DEFAULT_ERROR;

  if (status === 400 || matches(text, ["bad request", "invalid input", "invalid payload", "validation"])) {
    return {
      title: "Bilgileri kontrol edin",
      description: "Gönderilen bilgiler beklenen formatta değil.",
      action: "Eksik veya hatalı alanları düzeltip tekrar deneyin.",
      severity: "warning",
      code: "validation",
    };
  }

  if (status === 401 || matches(text, ["invalid login credentials", "invalid credentials", "invalid grant", "wrong password"])) {
    return {
      title: "Giriş bilgileri doğrulanamadı",
      description: "E-posta veya şifre eşleşmedi.",
      action: "Bilgilerinizi kontrol edin. Şifrenizi unuttuysanız şifre sıfırlama bağlantısını kullanın.",
      severity: "warning",
      code: "invalid_credentials",
    };
  }

  if (matches(text, ["email not confirmed", "e-posta doğrulanmamış", "email confirmation"])) {
    return {
      title: "E-posta doğrulaması gerekli",
      description: "Hesabınız oluşturulmuş olabilir ancak e-posta onayı bekleniyor.",
      action: "Gelen kutunuzu ve spam klasörünü kontrol edin. Gerekirse doğrulama e-postasını yeniden gönderin.",
      severity: "warning",
      code: "email_not_confirmed",
    };
  }

  if (status === 403 || matches(text, ["permission denied", "not allowed", "forbidden", "insufficient", "unauthorized"])) {
    return {
      title: "Bu işlem için yetkiniz yok",
      description: "Hesabınız bu işlemi yapmaya yetkili değil veya gerekli erişim tanımlanmamış.",
      action: "Rol ve yetki ayarlarınızı kontrol edin. Gerekirse organizasyon yöneticisinden erişim isteyin.",
      severity: "warning",
      code: "permission",
    };
  }

  if (matches(text, ["row-level security", "violates row-level security policy", "rls"])) {
    return {
      title: "Bu kayıt için erişim izni yok",
      description: "Veritabanı güvenlik kuralı bu işlemi kabul etmedi.",
      action: "Doğru organizasyon veya firma üzerinde çalıştığınızdan emin olun. Sorun sürerse yönetici yetkileri kontrol edilmeli.",
      severity: "warning",
      code: "rls_policy",
    };
  }

  if (status === 404 || matches(text, ["not found", "bulunamadı", "does not exist", "no rows"])) {
    return {
      title: "İlgili kayıt bulunamadı",
      description: "İşlem yapılmak istenen veri silinmiş, taşınmış veya erişilemez durumda olabilir.",
      action: "Listeyi yenileyin ve doğru kayıt üzerinde işlem yaptığınızdan emin olun.",
      severity: "warning",
      code: "not_found",
    };
  }

  if (status === 409 || matches(text, ["already exists", "duplicate", "zaten", "unique constraint", "duplicate key"])) {
    return {
      title: "Aynı kayıt zaten mevcut",
      description: "Aynı bilgilerle daha önce oluşturulmuş bir kayıt bulundu.",
      action: "Mevcut kaydı kontrol edin; gerekiyorsa yeni kayıt yerine güncelleme yapın.",
      severity: "warning",
      code: "duplicate",
    };
  }

  if (status === 413 || matches(text, ["payload too large", "file too large", "dosya boyutu", "too large"])) {
    return {
      title: "Dosya çok büyük",
      description: "Seçilen dosya izin verilen boyut sınırını aşıyor.",
      action: "Dosyayı küçültüp tekrar yükleyin veya daha küçük parçalar halinde deneyin.",
      severity: "warning",
      code: "file_too_large",
    };
  }

  if (status === 429 || matches(text, ["too many requests", "rate limit", "quota"])) {
    return {
      title: "Çok fazla deneme yapıldı",
      description: "Sistem güvenliği için kısa süreli istek sınırına ulaşıldı.",
      action: "30-60 saniye bekleyin ve tekrar deneyin.",
      severity: "warning",
      code: "rate_limit",
    };
  }

  if (status && status >= 500) {
    return {
      title: "Servis geçici olarak yanıt veremiyor",
      description: "Sunucu tarafında geçici bir sorun oluştu.",
      action: "Birkaç dakika sonra tekrar deneyin. Sorun sürerse sistem yöneticisine bildirin.",
      severity: "error",
      code: "server_error",
    };
  }

  if (matches(text, ["network", "failed to fetch", "load failed", "internet", "networkerror", "connection", "bağlantı"])) {
    return {
      title: "Bağlantı sorunu oluştu",
      description: "Sunucuya erişim sırasında ağ bağlantısı kesildi veya yanıt alınamadı.",
      action: "İnternet bağlantınızı kontrol edin. VPN kullanıyorsanız kapatıp tekrar deneyin.",
      severity: "warning",
      code: "network",
    };
  }

  if (matches(text, ["jwt", "session", "oturum", "refresh token", "not authenticated", "auth session missing"])) {
    return {
      title: "Oturum doğrulanamadı",
      description: "Oturum süreniz dolmuş olabilir veya güvenli erişim anahtarı yenilenemedi.",
      action: "Çıkış yapıp yeniden giriş yapın. Sorun devam ederse sayfayı yenileyin.",
      severity: "warning",
      code: "session",
    };
  }

  if (matches(text, ["timeout", "timed out", "deadline exceeded"])) {
    return {
      title: "İşlem zaman aşımına uğradı",
      description: "Sunucu beklenen sürede yanıt vermedi.",
      action: "Biraz sonra tekrar deneyin. Büyük dosya veya yoğun işlem varsa daha küçük parçalar halinde deneyin.",
      severity: "warning",
      code: "timeout",
    };
  }

  if (matches(text, ["storage", "upload", "bucket", "dosya", "file", "object"])) {
    return {
      title: "Dosya işlemi tamamlanamadı",
      description: "Dosya yükleme, indirme veya depolama işlemi sırasında sorun oluştu.",
      action: "Dosya formatını, boyutunu ve bağlantınızı kontrol edip tekrar deneyin.",
      severity: "warning",
      code: "storage",
    };
  }

  if (matches(text, ["json", "syntaxerror", "expected ','", "unexpected token", "parse"])) {
    return {
      title: "Gelen veri okunamadı",
      description: "Servisten dönen yanıt beklenen formatta değil.",
      action: "İşlemi tekrar deneyin. AI veya entegrasyon işlemlerinde sorun sürerse teknik loglar kontrol edilmeli.",
      severity: "error",
      code: "parse",
    };
  }

  if (matches(text, ["insertbefore", "removechild", "replacechild", "appendchild", "notfounderror"])) {
    return {
      title: "Sayfa görünümü yenilenemedi",
      description: "Tarayıcı eklentisi, otomatik çeviri veya sayfa içi bir müdahale arayüzü etkiledi.",
      action: "Sayfayı yenileyin. Devam ederse otomatik çeviri ve tarayıcı eklentilerini kapatıp tekrar deneyin.",
      severity: "warning",
      code: "dom_mutation",
    };
  }

  if (isTechnicalText(rawText)) return DEFAULT_ERROR;

  return {
    title: "İşlem tamamlanamadı",
    description: rawText,
    action: "Bilgileri kontrol edip tekrar deneyin.",
    severity: "error",
    code: "message",
  };
}

export function getUserFacingErrorDescription(error: unknown) {
  const details = getUserFacingError(error);
  return `${details.description} ${details.action}`.trim();
}

export function getUserFacingErrorMessage(error: unknown) {
  return getUserFacingError(error).title;
}

export function notifyUserFacingError(error: unknown, options: ToastOptions = {}) {
  if (options.logLabel) {
    console.error(options.logLabel, error);
  }

  const details = getUserFacingError(error);
  const title =
    options.title ||
    (details.code === "unknown" ? options.fallbackTitle : undefined) ||
    details.title;
  const description =
    options.description ||
    (details.code === "unknown" ? options.fallbackDescription : undefined) ||
    getUserFacingErrorDescription(error);

  if (details.severity === "warning") {
    toast.warning(title, { description });
    return;
  }

  if (details.severity === "info") {
    toast.info(title, { description });
    return;
  }

  toast.error(title, { description });
}
