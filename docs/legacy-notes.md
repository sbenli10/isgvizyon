# ISGVizyon İSG Bot Legacy Notes

Bu not, uzantı tarafında şu an aktif manifest zincirinde kullanılmayan dosyaları işaretlemek için tutulur.

## Legacy / Aktif Olmayan Dosyalar

- `chrome-extension/background/sync-manager.js`
- `chrome-extension/background/queue-manager.js`
- `chrome-extension/background/rule-engine.js`
- `chrome-extension/content/content.js`
- `chrome-extension/content/dom-parser.js`
- `chrome-extension/content/observer.js`

## Durum

Bu dosyalar mevcut `chrome-extension/manifest.json` içinde tanımlı değildir ve aktif `background/service-worker.js` ya da yeni `content-scripts/isgkatip-scraper.js` tarafından import edilmemektedir.

## Öneri

- Kısa vadede: Repo içinde legacy olarak tutulabilir.
- Orta vadede: Gerçekten ihtiyaç yoksa ayrı bir arşiv klasörüne taşınmalı veya silinmelidir.
- Yayın öncesinde: ZIP paketine yalnızca aktif uzantı dosyalarının girdiğinden emin olunmalıdır.
