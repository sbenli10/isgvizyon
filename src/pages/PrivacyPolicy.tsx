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

Son güncelleme: ${new Date().toLocaleDateString("tr-TR")}`,
  },
  {
    id: "isgbot",
    title: "9. ISGBot Chrome Uzantısı Hakkında",
    icon: Shield,
    content: `ISGBot Chrome uzantısı, ISGVizyon kullanıcılarının Chrome tarayıcısı üzerinden İSG-KATİP senkron durumunu, bağlı organizasyon/firma özetlerini, uyum göstergelerini ve öncelikli aksiyonlarını hızlıca görüntülemesini sağlayan yardımcı bir uzantıdır.

ISGBot'un tek amacı, ISGVizyon hesabına bağlı iş sağlığı ve güvenliği süreçlerine hızlı erişim sağlamak ve kullanıcıya ilgili durum bilgilerini göstermektir.

ISGBot kapsamında aşağıdaki veriler işlenebilir:

• Kullanıcı hesap bilgileri: ad, soyad, e-posta adresi
• Oturum bilgileri: giriş durumu, erişim belirteçleri ve temel kimlik doğrulama bilgileri
• Organizasyon/firma bilgileri: kullanıcının bağlı olduğu organizasyon, firma özetleri ve yetkili olduğu kayıtlar
• İSG-KATİP senkron bilgileri: senkron durumu, son senkron zamanı ve işlem sonuçları
• Uyum ve aksiyon bilgileri: toplam firma sayısı, uyumlu/uyarı/kritik durum özetleri ve öncelikli aksiyon bilgileri
• Uzantı kullanım tercihleri: oturum durumu, temel görünüm/ayar tercihleri ve uzantının çalışması için gerekli yerel kayıtlar

Bu veriler yalnızca ISGBot'un temel işlevlerini sunmak, kullanıcının ISGVizyon hesabına bağlı bilgileri uzantı panelinde göstermek, oturum durumunu yönetmek, İSG-KATİP senkron bilgilerini görüntülemek ve kullanıcıya ilgili durum/aksiyon bildirimlerini sunmak amacıyla kullanılır.

ISGBot, kullanıcının genel web tarama geçmişini toplamaz, ziyaret edilen web sitelerinin içeriklerini izleme amacıyla işlemez ve kişisel verileri reklam, yeniden pazarlama, kredi değerlendirmesi veya borç verme amacıyla kullanmaz.

ISGBot tarafından işlenen kullanıcı verileri satılmaz. Veriler yalnızca ISGVizyon hizmetinin çalışması, güvenliği, kimlik doğrulama, altyapı barındırma, teknik destek, yasal yükümlülüklerin yerine getirilmesi ve hizmetin tek amacının sağlanması için gerekli olduğu ölçüde işlenir veya yetkili hizmet sağlayıcılarla paylaşılabilir.

ISGBot, Chrome Web Store Kullanıcı Verileri Politikası kapsamındaki sınırlı kullanım ilkelerine uygun şekilde, kullanıcı verilerini yalnızca uzantının açıklanan tek amacını sağlamak veya iyileştirmek için kullanır.`,
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
