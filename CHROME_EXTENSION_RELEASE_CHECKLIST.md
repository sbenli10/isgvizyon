# CHROME EXTENSION RELEASE CHECKLIST

- Manifest V3 kullanıldığını doğrula
- `<all_urls>` kullanılmadığını doğrula
- `cookies`, `webRequest`, `webRequestBlocking` izinlerinin eklenmediğini doğrula
- Popup içinde resmi kurum olmadığı açıklamasının göründüğünü doğrula
- İSG-KATİP sayfasındaki aktarım panelinde kullanıcı onay akışını doğrula
- Önizleme olmadan veri aktarımı başlamadığını doğrula
- Şifre, çerez ve e-Devlet oturum bilgisinin toplanmadığını doğrula
- `DENETRON_AUTH_SUCCESS` ve `AUTH_SESSION_UPDATED` akışlarının çalıştığını doğrula
- `CONFIG_UPDATED` sonrası background config’in yenilendiğini doğrula
- Edge Function üzerinden sync yapıldığını doğrula
- Duplicate firma aktarımında yeni kayıt oluşmadığını doğrula
- Sync log summary içinde inserted/updated/skipped/errors değerlerini doğrula
- ZIP paketinde yalnızca aktif extension dosyalarının bulunduğunu doğrula
