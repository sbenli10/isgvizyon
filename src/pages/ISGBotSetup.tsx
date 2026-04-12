// src/app/(app)/isg-bot/setup/page.tsx

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Chrome,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Zap,
  Shield,
  Play,
} from "lucide-react";

export default function ISGBotSetup() {
  return (
    <div className="container max-w-5xl mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="bg-primary/10 p-4 rounded-full">
            <Chrome className="h-12 w-12 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold">İSG Bot Kurulumu</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          İSG-KATİP verilerinizi otomatik olarak İSGVizyon'a aktarın.
          <br />
          <strong>3 adımda</strong> kurulum tamamlanır.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Zap className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">3 Adım</p>
            <p className="text-sm text-muted-foreground">Hızlı Kurulum</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Shield className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">%100 Güvenli</p>
            <p className="text-sm text-muted-foreground">Verileriniz Korunur</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Play className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">Otomatik</p>
            <p className="text-sm text-muted-foreground">Tek Tıkla Sync</p>
          </CardContent>
        </Card>
      </div>

      {/* Step 1: Install Extension */}
      <Card className="border-2 border-primary">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Badge variant="default" className="text-lg px-4 py-2">
              Adım 1
            </Badge>
            <div className="flex-1">
              <CardTitle className="text-2xl">Chrome Extension'ı Yükle</CardTitle>
              <CardDescription className="text-base">
                Tek tıkla yükle, hiçbir ayar gerekmez
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Big Install Button */}
          <div className="flex justify-center">
            <Button
              size="lg"
              className="h-16 px-12 text-lg"
              onClick={() => {
                // Chrome Web Store link (gerçek publish edilince)
                window.open(
                  "https://chrome.google.com/webstore/detail/denetron-isg-bot/xxxxx",
                  "_blank"
                );
              }}
            >
              <Chrome className="h-6 w-6 mr-3" />
              Chrome'a Ekle (Ücretsiz)
            </Button>
          </div>

          <Alert>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription>
              Extension yüklendikten sonra <strong>otomatik olarak</strong> İSGVizyon
              hesabınıza bağlanır. Hiçbir ayar yapmanıza gerek yok.
            </AlertDescription>
          </Alert>

          {/* What happens */}
          <div className="bg-muted p-6 rounded-lg space-y-3">
            <p className="font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Extension yüklenince ne olur?
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>
                  Chrome toolbar'a <strong>İSGVizyon İSG Bot</strong> ikonu eklenir
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>
                  Otomatik olarak İSGVizyon hesabınıza <strong>bağlanır</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>
                  İSG-KATİP sitesinde <strong>otomatik çalışmaya</strong> başlar
                </span>
              </li>
            </ul>
          </div>

          {/* Alternative: Manual Install */}
          <details className="border rounded-lg p-4">
            <summary className="font-semibold cursor-pointer text-sm">
              👨‍💻 Gelişmiş: Manuel Kurulum (Developer Mode)
            </summary>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p>
                Eğer extension henüz Chrome Web Store'da yayınlanmadıysa manuel
                yükleyebilirsiniz:
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>
                  <code className="bg-muted px-1 rounded">chrome://extensions/</code>{" "}
                  adresine gidin
                </li>
                <li>Sağ üstte "Developer mode" düğmesini aktif edin</li>
                <li>"Load unpacked" butonuna tıklayın</li>
                <li>
                  <code className="bg-muted px-1 rounded">chrome-extension</code>{" "}
                  klasörünü seçin
                </li>
              </ol>
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Step 2: Login to İSG-KATİP */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              Adım 2
            </Badge>
            <div className="flex-1">
              <CardTitle className="text-2xl">İSG-KATİP'e Giriş Yap</CardTitle>
              <CardDescription className="text-base">
                E-Devlet ile giriş yapın
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Instructions */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center shrink-0 font-bold">
                  1
                </div>
                <div>
                  <p className="font-semibold">İSG-KATİP Sitesine Git</p>
                  <a
                    href="https://isgkatip.csgb.gov.tr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    isgkatip.csgb.gov.tr
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center shrink-0 font-bold">
                  2
                </div>
                <div>
                  <p className="font-semibold">E-Devlet ile Giriş Yap</p>
                  <p className="text-sm text-muted-foreground">
                    Sağ üstteki <strong>"E-Devlet Girişi"</strong> butonuna tıklayın
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center shrink-0 font-bold">
                  3
                </div>
                <div>
                  <p className="font-semibold">T.C. Kimlik No ve Şifre Girin</p>
                  <p className="text-sm text-muted-foreground">
                    E-Devlet bilgilerinizle giriş yapın
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Visual */}
            <div className="bg-muted rounded-lg p-6 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="bg-red-100 text-red-600 rounded-lg py-3 px-6 inline-block font-bold">
                  E-Devlet Girişi
                </div>
                <p className="text-sm text-muted-foreground">
                  İSG-KATİP giriş ekranı
                </p>
              </div>
            </div>
          </div>

          <Alert>
            <Shield className="h-4 w-4 text-green-500" />
            <AlertDescription>
              <strong>Güvenlik:</strong> Extension sadece <strong>okuma</strong>{" "}
              yetkisine sahiptir. Hiçbir bilginiz değiştirilmez veya paylaşılmaz.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Step 3: Sync Data */}
      <Card className="border-2 border-green-500">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Badge variant="default" className="text-lg px-4 py-2 bg-green-500">
              Adım 3
            </Badge>
            <div className="flex-1">
              <CardTitle className="text-2xl">Verileri Senkronize Et</CardTitle>
              <CardDescription className="text-base">
                İşyeri listesine gidin, extension otomatik çalışır
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {/* Step 3.1 */}
            <div className="flex items-start gap-4">
              <div className="bg-green-500 text-white rounded-full w-10 h-10 flex items-center justify-center shrink-0 font-bold text-lg">
                1
              </div>
              <div className="flex-1">
                <p className="font-semibold text-lg">İşyeri Listesine Git</p>
                <p className="text-muted-foreground">
                  İSG-KATİP'te: <strong>Menü → İşyerleri → İşyeri Listesi</strong>
                </p>
                <div className="mt-2">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href="https://isgkatip.csgb.gov.tr/kisi-kurum/kisi-karti/kisi-kartim"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Direkt Git
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 3.2 */}
            <div className="flex items-start gap-4">
              <div className="bg-green-500 text-white rounded-full w-10 h-10 flex items-center justify-center shrink-0 font-bold text-lg">
                2
              </div>
              <div className="flex-1">
                <p className="font-semibold text-lg">Extension Otomatik Çalışır</p>
                <p className="text-muted-foreground">
                  Sayfa yüklendiğinde extension <strong>otomatik olarak</strong> firma
                  verilerinizi toplar
                </p>
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-green-700 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Ne olacak?
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-green-700">
                    <li>✅ Firma adları</li>
                    <li>✅ SGK numaraları</li>
                    <li>✅ Çalışan sayıları</li>
                    <li>✅ Tehlike sınıfları</li>
                    <li>✅ Sözleşme bilgileri</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Step 3.3 */}
            <div className="flex items-start gap-4">
              <div className="bg-green-500 text-white rounded-full w-10 h-10 flex items-center justify-center shrink-0 font-bold text-lg">
                3
              </div>
              <div className="flex-1">
                <p className="font-semibold text-lg">Bildirim Gelir</p>
                <p className="text-muted-foreground">
                  Extension senkronizasyon tamamlandığında bildirim gösterir
                </p>
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-900">
                      12 işyeri başarıyla senkronize edildi!
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      İSGVizyon Dashboard'da görüntüleyebilirsiniz.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3.4 */}
            <div className="flex items-start gap-4">
              <div className="bg-green-500 text-white rounded-full w-10 h-10 flex items-center justify-center shrink-0 font-bold text-lg">
                4
              </div>
              <div className="flex-1">
                <p className="font-semibold text-lg">İSGVizyon'da Görüntüle</p>
                <p className="text-muted-foreground mb-3">
                  Firmalarınız İSGVizyon Dashboard'da hazır!
                </p>
                <Button size="lg" asChild>
                  <a href="/isg-bot">
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Dashboard'a Git
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Video Tutorial */}
      <Card>
        <CardHeader>
          <CardTitle>📹 Video Anlatım</CardTitle>
          <CardDescription>
            Kurulumun tüm adımlarını videoda izleyin (2 dakika)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center space-y-3">
              <Play className="h-16 w-16 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Video yakında eklenecek</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle>Sık Sorulan Sorular</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <details className="border rounded-lg p-4">
            <summary className="font-semibold cursor-pointer">
              Extension ücretsiz mi?
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">
              Evet, extension tamamen <strong>ücretsizdir</strong>. İSGVizyon
              aboneliğinize dahildir.
            </p>
          </details>

          <details className="border rounded-lg p-4">
            <summary className="font-semibold cursor-pointer">
              Verilerim güvende mi?
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">
              Evet, tüm veriler <strong>şifrelenmiş</strong> olarak Supabase'de
              saklanır. Row Level Security (RLS) ile sadece siz erişebilirsiniz.
            </p>
          </details>

          <details className="border rounded-lg p-4">
            <summary className="font-semibold cursor-pointer">
              Her seferinde manuel sync yapmam gerekiyor mu?
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">
              Hayır, İSG-KATİP işyeri listesi sayfasını her açtığınızda extension{" "}
              <strong>otomatik</strong> olarak çalışır.
            </p>
          </details>

          <details className="border rounded-lg p-4">
            <summary className="font-semibold cursor-pointer">
              Edge veya Firefox'ta çalışır mı?
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">
              Edge tarayıcısında çalışır (Chromium tabanlı). Firefox için ayrı bir
              versiyon yayınlanacak.
            </p>
          </details>
        </CardContent>
      </Card>

      {/* CTA */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="py-8 text-center space-y-4">
          <h2 className="text-2xl font-bold">Kuruluma Başlayın! 🚀</h2>
          <p className="text-primary-foreground/90 max-w-2xl mx-auto">
            Extension'ı yükleyin, İSG-KATİP'e giriş yapın ve firmalarınız otomatik
            olarak İSGVizyon'a aktarılsın.
          </p>
          <div className="flex justify-center gap-3 pt-4">
            <Button size="lg" variant="secondary" asChild>
              <a href="https://chrome.google.com/webstore/detail/xxxxx" target="_blank">
                <Chrome className="h-5 w-5 mr-2" />
                Extension'ı Yükle
              </a>
            </Button>
            <Button size="lg" variant="outline" className="bg-transparent" asChild>
              <a href="/isg-bot">
                Dashboard'a Git
                <ArrowRight className="h-5 w-5 ml-2" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
