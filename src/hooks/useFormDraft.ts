import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";

/**
 * useFormDraft
 *
 * Sekme değişimi veya sayfa navigasyonu sırasında form verisinin sıfırlanmaması
 * için form state'ini sessionStorage'a persist eder.
 *
 * Kullanım:
 *   const [value, setValue, clearDraft] = useFormDraft("myForm:field", initialValue);
 *
 * Form submit edildiğinde clearDraft() çağrılarak sessionStorage temizlenmelidir.
 *
 * @param key           Benzersiz sessionStorage anahtarı (ör. "dataPrivacy:correctionNote")
 * @param initialValues Kayıtlı taslak bulunamazsa kullanılacak başlangıç değeri
 * @returns             [value, setValue, clearDraft]
 */
export function useFormDraft<T>(
  key: string,
  initialValues: T,
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = sessionStorage.getItem(key);
      return saved ? (JSON.parse(saved) as T) : initialValues;
    } catch {
      // JSON parse hatası veya private-mode erişim hatası
      return initialValues;
    }
  });

  // Her değişiklikte sessionStorage'a yaz
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Kota veya private-mode hatalarını yoksay
    }
  }, [key, value]);

  // Form submit veya iptal sonrasında taslağı temizle
  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  }, [key]);

  return [value, setValue, clearDraft];
}
