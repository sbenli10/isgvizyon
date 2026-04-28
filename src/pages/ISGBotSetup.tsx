import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowRight,
  CheckCircle2,
  Chrome,
  ExternalLink,
  Play,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";

const extensionDownloadUrl = "/chrome-extension.zip";
const isgKatipUrl = "https://isgkatip.csgb.gov.tr";

const nextSteps = [
  "Eksik sözleşmeleri kontrol et",
  "Denetime hazır olmayan firmaları aç",
  "Kurul gereken firmalara git",
  "Öncelikli görevleri ilgili modüllere taşı",
];

export default function ISGBotSetup() {
  return (
    <div className="container mx-auto max-w-6xl space-y-8 py-8">
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Chrome className="h-12 w-12 text-primary" />
          </div>
        </div>
        <div className="space-y-2">
          <Badge className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/10">
            ISG-Bot Kurulum Rehberi
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight">3 adımda bağlantıyı kur, veriyi aksiyona çevir</h1>
          <p className="mx-auto max-w-3xl text-lg leading-8 text-muted-foreground">
            ISG-Bot, İSG-KATİP verinizi okuyup size yapılacak işleri, eksikleri ve öncelikli
            aksiyonları gösterir. Bu sayfa kurulum içindir; veri girişi eklentiden, yorumlama ve iş
            akışı ise ISGVizyon içinden yürür.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <Zap className="mx-auto mb-2 h-8 w-8 text-amber-500" />
            <p className="text-2xl font-bold">3 Adım</p>
            <p className="text-sm text-muted-foreground">Kurulum kısa ve nettir</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Shield className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
            <p className="text-2xl font-bold">Salt Okuma</p>
            <p className="text-sm text-muted-foreground">Eklenti veriyi okur, kayıtları değiştirmez</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Sparkles className="mx-auto mb-2 h-8 w-8 text-cyan-500" />
            <p className="text-2xl font-bold">Aksiyon Odaklı</p>
            <p className="text-sm text-muted-foreground">Sözleşme, kurul ve denetim işlerine dönüşür</p>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Önce bunu netleştirelim</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p>ISG-Bot bir veri giriş ekranı değildir. İSG-KATİP verisini okur, ISGVizyon içinde iş diline çevirir.</p>
          <p>Bireysel uzman için günlük yönlendirme sağlar. Ekipli portföy ve çok kullanıcılı operasyon için OSGB modülü kullanılır.</p>
        </AlertDescription>
      </Alert>

      <Card className="border-2 border-primary/40">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Badge variant="default" className="w-fit px-4 py-2 text-base">
              Adım 1
            </Badge>
            <div>
              <CardTitle className="text-2xl">Chrome eklentisini yükleyin</CardTitle>
              <CardDescription className="text-base">
                İlk bağlantı için eklentiyi indirip tarayıcınıza ekleyin.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <Button size="lg" className="h-14 px-10 text-base" asChild>
              <a href={extensionDownloadUrl} target="_blank" rel="noopener noreferrer">
                <Chrome className="mr-3 h-5 w-5" />
                Eklentiyi İndir
              </a>
            </Button>
          </div>

          <div className="rounded-2xl border bg-muted/50 p-5">
            <p className="font-semibold">Eklenti yüklendikten sonra ne olur?</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                Tarayıcınızda ISGVizyon ISG-Bot kısayolu görünür.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                İSG-KATİP işyeri listesi ekranında veri alımı için hazır hale gelir.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                Verileriniz ISGVizyon içinde durum, uyum ve aksiyon ekranlarına taşınır.
              </li>
            </ul>
          </div>

          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-semibold text-sm">Manuel kurulum gerekiyorsa</summary>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p>Eğer eklentiyi paket dosyasıyla yüklüyorsanız şu adımları izleyin:</p>
              <ol className="ml-2 list-inside list-decimal space-y-1">
                <li><code className="rounded bg-muted px-1">chrome://extensions/</code> adresini açın.</li>
                <li>Sağ üstten geliştirici modunu etkinleştirin.</li>
                <li><strong>Paketlenmemiş öğe yükle</strong> seçeneğini kullanın.</li>
                <li><code className="rounded bg-muted px-1">chrome-extension</code> klasörünü seçin.</li>
              </ol>
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Badge variant="secondary" className="w-fit px-4 py-2 text-base">
              Adım 2
            </Badge>
            <div>
              <CardTitle className="text-2xl">İSG-KATİP’e giriş yapın</CardTitle>
              <CardDescription className="text-base">
                E-Devlet ile giriş yapıp işyeri listesi ekranına geçin.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">1</div>
              <div>
                <p className="font-semibold">İSG-KATİP sitesini açın</p>
                <a
                  href={isgKatipUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  isgkatip.csgb.gov.tr
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">2</div>
              <div>
                <p className="font-semibold">E-Devlet ile giriş yapın</p>
                <p className="text-sm text-muted-foreground">Mevcut uzman hesabınızla giriş yapmanız yeterlidir.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">3</div>
              <div>
                <p className="font-semibold">İşyeri listesi ekranını açın</p>
                <p className="text-sm text-muted-foreground">Eklenti veri alımını işyeri listesi görünümünde başlatır.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center rounded-2xl border bg-muted/50 p-6">
            <div className="space-y-3 text-center">
              <div className="inline-flex rounded-xl bg-red-100 px-6 py-3 font-semibold text-red-700">
                E-Devlet Girişi
              </div>
              <p className="text-sm text-muted-foreground">Bu adımda tarayıcı tarafında giriş yapılır, veri aktarımı ISGVizyon içinde görünür.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-emerald-500/40">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Badge className="w-fit bg-emerald-500 px-4 py-2 text-base text-white hover:bg-emerald-500">
              Adım 3
            </Badge>
            <div>
              <CardTitle className="text-2xl">İlk senkronu tamamlayın</CardTitle>
              <CardDescription className="text-base">
                İşyeri listesi açıldığında eklenti veriyi okur ve ISGVizyon’a taşır.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border bg-muted/40 p-4">
              <p className="font-semibold">1. Listeyi açın</p>
              <p className="mt-2 text-sm text-muted-foreground">İşyeri listesi ekranında kalın.</p>
            </div>
            <div className="rounded-2xl border bg-muted/40 p-4">
              <p className="font-semibold">2. Veri okunsun</p>
              <p className="mt-2 text-sm text-muted-foreground">Firma, çalışan, süre ve sözleşme bilgileri alınır.</p>
            </div>
            <div className="rounded-2xl border bg-muted/40 p-4">
              <p className="font-semibold">3. Bildirim görün</p>
              <p className="mt-2 text-sm text-muted-foreground">Senkron tamamlandığında kısa bir bildirim görürsünüz.</p>
            </div>
            <div className="rounded-2xl border bg-muted/40 p-4">
              <p className="font-semibold">4. Durum merkezine dönün</p>
              <p className="mt-2 text-sm text-muted-foreground">Öneri kartları ve sonraki işler otomatik belirir.</p>
            </div>
          </div>

          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>İlk senkron sonrası burada ne göreceksiniz?</AlertTitle>
            <AlertDescription className="mt-2">
              Hazır firmalar, eksik sözleşmeler, kurul ihtiyacı olan işyerleri ve denetime hazır olmayan
              firmalar öneri kartları halinde önünüze gelir.
            </AlertDescription>
          </Alert>

          <div className="rounded-2xl border bg-muted/50 p-5">
            <p className="font-semibold">Sonraki adımlar</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {nextSteps.map((step) => (
                <div key={step} className="rounded-xl border bg-background p-4 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{step}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <a href="/isg-bot">
                Durum Merkezine Git
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href={isgKatipUrl} target="_blank" rel="noopener noreferrer">
                İSG-KATİP’i Aç
                <ExternalLink className="ml-2 h-5 w-5" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ISG-Bot ile OSGB modülü aynı şey mi?</CardTitle>
          <CardDescription>
            Hayır. Aynı veri kaynağını kullanırlar ama kullanıcı tipi ve amaçları farklıdır.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card/60 p-5">
            <p className="font-semibold">ISG-Bot: bireysel uzman akışı</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Kendi firmanızda veya sorumlu olduğunuz işyerlerinde önce ne yapmanız gerektiğini gösterir.
              Günlük iş listesi, denetime hazırlık ve uyum yönlendirmesi için idealdir.
            </p>
          </div>
          <div className="rounded-2xl border bg-card/60 p-5">
            <p className="font-semibold">OSGB modülü: ekipli portföy yönetimi</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Birden fazla uzman, çok sayıda firma, görev paylaşımı ve kurumsal portföy görünümü için
              kullanılır. Yönetim ve ekip operasyonu burada güçlenir.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Play className="mr-2 inline-flex h-5 w-5" />
            Kısa kullanım mantığı
          </CardTitle>
          <CardDescription>
            Teknik detay yerine iş diliyle düşünün.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p><strong>ISG-Bot ne yapar?</strong> Veriyi okur, eksikleri ve yaklaşan işleri sıralar.</p>
          <p><strong>ISG-Bot ne yapmaz?</strong> İSG-KATİP tarafında veri değiştirmez, resmi kayıtları sizin yerinize yönetmez.</p>
          <p><strong>Doğru kullanım nedir?</strong> Veriyi alın, öneri kartlarına bakın, gerekli işlere ilgili modüllerden devam edin.</p>
        </CardContent>
      </Card>
    </div>
  );
}
