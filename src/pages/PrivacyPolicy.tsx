import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, FileText, Lock, Scale, Shield, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const sections = [
  {
    id: "sorumlu",
    title: "1. Veri Sorumlusu",
    icon: Users,
    content: `ISGVizyon İSG Platformu ("Platform") veri sorumlusu olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında kişisel verilerinizi aşağıda açıklanan şekilde işlemektedir.

İletişim:
• E-posta: kvkk@isgvizyon.com
• Adres: Platform üzerinden bildirilebilir`,
  },
  {
    id: "islenen",
    title: "2. İşlenen Kişisel Veriler",
    icon: FileText,
    content: `Platform kapsamında aşağıdaki kişisel verileriniz işlenebilir:

a) Kimlik Bilgileri: Ad, soyad, T.C. kimlik numarası (sertifika oluşturma amacıyla)
b) İletişim Bilgileri: E-posta adresi, telefon numarası
c) İş Bilgileri: Görev unvanı, çalıştığı kurum, iş güvenliği uzmanlığı belge bilgileri
d) İşlem Güvenliği Bilgileri: IP adresi, tarayıcı bilgileri, oturum kayıtları
e) Görsel Veriler: Saha fotoğrafları ve risk değerlendirmesi amacıyla yüklenen görseller

T.C. kimlik numarası KVKK kapsamında hassasiyetle ele alınmakta ve ek güvenlik önlemleriyle saklanmaktadır.`,
  },
  {
    id: "amac",
    title: "3. İşleme Amaçları",
    icon: Eye,
    content: `Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:

• Platform hizmetlerinin sunulması ve yönetilmesi
• İş sağlığı ve güvenliği raporlarının oluşturulması
• Risk değerlendirmelerinin yapılması
• Sertifika oluşturma ve doğrulama
• Yasal yükümlülüklerin yerine getirilmesi
• Hizmet kalitesinin artırılması
• Kullanıcı taleplerinin karşılanması`,
  },
  {
    id: "hukuki",
    title: "4. Hukuki Sebepler",
    icon: Scale,
    content: `Verileriniz aşağıdaki hukuki sebeplere dayanılarak işlenmektedir:

• Açık rızanızın bulunması (KVKK Madde 5/1-a)
• Yasal yükümlülüklerin yerine getirilmesi (KVKK Madde 5/2-ç)
• Meşru menfaatlerimizin sağlanması (KVKK Madde 5/2-f)
• İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla`,
  },
  {
    id: "guvenlik",
    title: "5. Veri Güvenliği",
    icon: Lock,
    content: `Kişisel verilerinizin güvenliğini sağlamak için aşağıdaki teknik ve idari önlemler uygulanır:

• Veri şifreleme ve erişim kontrolü
• Rol tabanlı erişim kontrolü ve yetki sınırlandırmaları
• HTTPS üzerinden şifreli veri iletimi
• Supabase ve yetkili altyapı hizmetleri üzerinde güvenli barındırma
• JWT tabanlı kimlik doğrulama ve oturum güvenliği
• Güvenlik logları, izleme ve teknik denetimler`,
  },
  {
    id: "haklar",
    title: "6. Kullanıcı Hakları (KVKK Madde 11)",
    icon: Shield,
    content: `KVKK Madde 11 kapsamında aşağıdaki haklara sahipsiniz:

• Kişisel verilerinizin işlenip işlenmediğini öğrenme
• İşlenmişse buna ilişkin bilgi talep etme
• İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme
• Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme
• Eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme
• KVKK'nın 7. maddesinde öngörülen şartlar çerçevesinde silinmesini isteme
• Otomatik sistemlerle analiz sonucunda aleyhinize bir sonuç ortaya çıkmasına itiraz etme
• Kanuna aykırı işleme sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme

Bu haklarınızı kullanmak için "Veri Haklarım" sayfasını kullanabilir veya kvkk@isgvizyon.com adresine başvurabilirsiniz.`,
  },
  {
    id: "saklama",
    title: "7. Veri Saklama ve Silme",
    icon: Trash2,
    content: `Kişisel verileriniz, işleme amacının gerçekleşmesine kadar saklanır. Yasal yükümlülükler kapsamında bazı İSG kayıtları ilgili mevzuatın öngördüğü süre boyunca muhafaza edilebilir.

Saklama süreleri:
• Kullanıcı hesabı verileri: Hesap aktif olduğu sürece ve silme talebinden sonra teknik/yasal gereklilikler ölçüsünde
• İş sağlığı ve güvenliği kayıtları: İlgili mevzuatın öngördüğü süre boyunca
• Oturum ve log kayıtları: Güvenlik ve yasal yükümlülükler için gerekli süre boyunca
• Silme talebiniz doğrultusunda, yasal saklama yükümlülükleri dışındaki veriler silinir veya anonimleştirilir`,
  },
  {
    id: "guncelleme",
    title: "8. Politika Güncellemeleri",
    icon: FileText,
    content: `Bu gizlilik politikası, yasal düzenleme değişiklikleri veya hizmet güncellemeleri doğrultusunda güncellenebilir. Güncellemeler platform üzerinden veya ilgili iletişim kanallarından duyurulabilir.

Son güncelleme: 13.05.2026`,
  },
  {
    id: "isgbot",
    title: "9. ISGBot Chrome Uzantısı Hakkında",
    icon: Shield,
    content: `ISGBot Chrome uzantısı, ISGVizyon kullanıcılarının kendi yetkili İSG-KATİP oturumlarında görüntüleyebildikleri aktif atama, firma, işyeri ve sözleşme bilgilerini, kullanıcının açık onayıyla İSGVizyon hesabına aktarmaya yardımcı olan bir tarayıcı uzantısıdır.

Uzantı, resmi İSG-KATİP, e-Devlet veya herhangi bir kamu kurumu ürünü değildir. İSG-KATİP adına işlem yapmaz; yalnızca kullanıcının kendi yetkili oturumunda ekranda görüntüleyebildiği bilgileri, kullanıcı tarafından başlatılan ve onaylanan aktarım işlemi kapsamında işler.

ISGBot'un temel amacı, kullanıcının kendi yetkili oturumunda gördüğü bilgileri manuel veri girişini azaltacak şekilde ISGVizyon hesabına taşımak, aktarım sonucunu kullanıcıya göstermek ve ISGVizyon hesabındaki ilgili İSG süreçlerinin yönetimini desteklemektir.

Resmi İSG-KATİP, e-Devlet veya kamu kurumu ürünü değildir. Şifre, çerez veya kamu sistemi oturum bilgisi toplanmaz. Aktarım kullanıcı tarafından başlatılır ve kullanıcı onayı olmadan yapılmaz.`,
  },
  {
    id: "isgbot-veriler",
    title: "10. ISGBot Kapsamında İşlenen Veriler",
    icon: FileText,
    content: `ISGBot kapsamında, uzantının açıklanan amacını yerine getirmek için aşağıdaki veri türleri işlenebilir:

• Kullanıcı hesap bilgileri: ad, soyad, e-posta adresi
• Oturum bilgileri: ISGVizyon giriş durumu, erişim belirteçleri ve temel kimlik doğrulama bilgileri
• Organizasyon/firma bilgileri: kullanıcının bağlı olduğu organizasyon, firma özetleri ve yetkili olduğu kayıtlar
• İSG-KATİP ekranında görüntülenen aktif atama, firma, işyeri ve sözleşme bilgileri
• Firma/işyeri unvanı
• SGK sicil numarası
• Çalışan sayısı
• Tehlike sınıfı
• NACE kodu
• Sözleşme başlangıç/bitiş tarihleri
• Atama/süre bilgileri
• Senkronizasyon zamanı, işlem sonucu, hata durumu ve aktarım logları
• Uyum ve aksiyon bilgileri: toplam firma sayısı, uyumlu/uyarı/kritik durum özetleri ve öncelikli aksiyon bilgileri
• Uzantı kullanım tercihleri: temel görünüm/ayar tercihleri ve uzantının çalışması için gerekli yerel kayıtlar`,
  },
  {
    id: "isgbot-toplanmayan",
    title: "11. ISGBot Tarafından Toplanmayan Veriler",
    icon: Lock,
    content: `ISGBot aşağıdaki verileri toplamaz veya aktarmaz:

• e-Devlet şifresi
• İSG-KATİP şifresi
• Çerezler
• Kamu sistemi oturum anahtarları
• Kullanıcının genel tarayıcı geçmişi
• Ziyaret edilen diğer web sitelerinin içerikleri
• Finansal bilgiler
• Sağlık bilgileri
• Reklam, yeniden pazarlama, kullanıcı profilleme veya kredi değerlendirmesi amacıyla kullanılacak veriler

Kullanıcının genel web tarama geçmişi toplanmaz. Veriler reklam veya kredi değerlendirmesi amacıyla kullanılmaz.`,
  },
  {
    id: "isgbot-aktarim",
    title: "12. İSG-KATİP Verilerinin Aktarımı",
    icon: Shield,
    content: `ISGBot, İSG-KATİP'teki verileri otomatik olarak arka planda göndermez.

Aktarım süreci şu şekilde işler:

• Kullanıcı önce "Firmalarımı Oku" işlemiyle verileri önizler
• Aktarılacak bilgiler kullanıcıya gösterilir
• Kullanıcı "Onayla ve İSGVizyon'a Aktar" şeklinde ikinci onay vermeden veri İSGVizyon'a gönderilmez
• Kullanıcı iptal ederse hiçbir veri aktarılmaz
• Aktarım yalnızca kullanıcının kendi yetkili oturumunda görüntüleyebildiği verilerle sınırlıdır

Aktarım kullanıcı tarafından başlatılır ve kullanıcı onayı olmadan yapılmaz.`,
  },
  {
    id: "isgbot-limited-use",
    title: "13. Sınırlı Kullanım ve Üçüncü Taraflar",
    icon: Eye,
    content: `ISGBot tarafından işlenen kullanıcı verileri satılmaz, kiralanmaz veya reklam, yeniden pazarlama, kullanıcı profilleme, kredi değerlendirmesi ya da borç verme amacıyla kullanılmaz.

Kullanıcı verileri yalnızca uzantının açıklanan tek amacını yerine getirmek için kullanılır: kullanıcının kendi yetkili İSG-KATİP oturumunda görüntüleyebildiği bilgileri, kullanıcının açık onayıyla İSGVizyon hesabına aktarmak, aktarım sonucunu kullanıcıya göstermek ve ISGVizyon hesabındaki ilgili İSG süreçlerini yönetmek.

Veriler yalnızca hizmetin çalışması için gerekli altyapı sağlayıcılarıyla işlenebilir. Veriler reklam ağlarıyla, veri brokerlarıyla veya bağımsız pazarlama taraflarıyla paylaşılmaz. Supabase veya benzeri altyapı sağlayıcıları yalnızca barındırma, kimlik doğrulama, veri tabanı, loglama ve güvenlik amacıyla kullanılır.`,
  },
];

function setMetaTag(name: string, content: string) {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.name = name;
    document.head.appendChild(tag);
  }
  tag.content = content;
}

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "ISGVizyon Gizlilik Politikası";
    setMetaTag(
      "description",
      "ISGVizyon Gizlilik Politikası, KVKK aydınlatma bilgileri ve ISGBot Chrome uzantısı veri kullanım açıklamaları.",
    );
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Geri
          </Button>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Gizlilik Politikası</h1>
              <p className="text-sm text-muted-foreground">
                6698 sayılı KVKK kapsamında kişisel verilerinizin korunması
              </p>
            </div>
          </div>
        </div>

        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <p className="text-sm leading-relaxed text-foreground/90">
              ISGVizyon İSG Platformu olarak, kişisel verilerinizin güvenliği en yüksek önceliklerimizden biridir.
              Bu politika, hangi verilerin toplandığını, nasıl kullanıldığını, ISGBot Chrome uzantısının hangi
              sınırlı amaçla veri işlediğini ve KVKK kapsamındaki haklarınızı açıklar.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.id} className="border-border/60 bg-card/70">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {section.content}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="my-8 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6 text-center">
          <h4 className="mb-2 text-base font-semibold text-foreground">
            Kurumsal Müşterilerimiz İçin Bilgilendirme
          </h4>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
            Kurumsal müşterilerimiz, Veri İşleyen Sözleşmesi (DPA) ve detaylı KVKK dokümanları için
            kvkk@isgvizyon.com adresinden bizimle iletişime geçebilir.
          </p>
        </div>

        <Separator className="my-8" />

        <div className="pb-8 text-center">
          <Button variant="outline" onClick={() => navigate("/data-privacy")} className="mb-6">
            Veri Haklarım Sayfasına Git
          </Button>
          <p className="text-xs text-muted-foreground">
            Bu gizlilik politikası, ISGVizyon İSG Platformu kullanıcılarını bilgilendirmek amacıyla
            6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında hazırlanmıştır.
          </p>
        </div>
      </div>
    </div>
  );
}
