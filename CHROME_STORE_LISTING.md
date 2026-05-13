# CHROME STORE LISTING

## Kısa Açıklama

İSG-KATİP ekranındaki firma ve sözleşme verilerini kullanıcı onayıyla ISGVizyon hesabınıza aktarır.

## Uzun Açıklama

ISGVizyon İSG Bot, kullanıcının kendi yetkili İSG-KATİP oturumunda görüntüleyebildiği firma ve sözleşme bilgilerini okuyup önizler. Kullanıcı onay verirse bu veriler ISGVizyon hesabına aktarılır ve uyum, risk, sözleşme ve operasyon ekranlarında kullanılabilir hale gelir.

## Tek Amaç Beyanı

Bu uzantının tek amacı, kullanıcının kendi gördüğü İSG-KATİP verilerini açık onayla ISGVizyon hesabına aktarmaktır.

## Permission Justification

- `storage`: oturum ve uzantı yapılandırmasını saklamak için
- `tabs`: İSG-KATİP ve ISGVizyon sekmelerini açmak/odaklamak için
- `notifications`: senkron sonuçlarını kullanıcıya göstermek için
- `scripting`: ISGVizyon web oturumu ile uzantı arasında güvenli köprü kurmak için

## Host Permission Justification

- `https://isgkatip.csgb.gov.tr/*`: İSG-KATİP ekranındaki verileri kullanıcı onayıyla okumak için
- `https://www.isgvizyon.com/*` ve `https://isgvizyon.com/*`: ISGVizyon oturum bağlantısı için
- `https://elmdzekyyoepdrpnfppn.supabase.co/*`: ISGVizyon backend ve edge function erişimi için

## Veri Kullanımı Açıklaması

- Firma/sözleşme bilgileri kullanıcı onayıyla aktarılır
- Şifre, çerez ve e-Devlet oturum bilgileri toplanmaz
- Veriler ISGVizyon içindeki uyum ve operasyon ekranlarında gösterilir

## Resmi Kurum Olmadığı Açıklaması

ISGVizyon İSG Bot, resmi İSG-KATİP, e-Devlet veya herhangi bir kamu kurumu ürünü değildir.
