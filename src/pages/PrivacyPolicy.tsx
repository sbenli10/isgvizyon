import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Lock, Eye, Trash2, FileText, Scale, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const sections = [
  {
    id: "sorumlu",
    title: "1. Veri Sorumlusu",
    icon: Users,
    content: `Denetron İSG Platformu ("Platform") veri sorumlusu olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında kişisel verilerinizi aşağıda açıklanan şekilde işlemektedir.

İletişim:
• E-posta: kvkk@isgvizyon.com
• Adres: Platform üzerinden bildirilebilir`,
  },
  {
    id: "islenen",
    title: "2. İşlenen Kişisel Veriler",
    icon: FileText,
    content: `Platform kapsamında aşağıdaki kişisel verileriniz işlenmektedir:

a) Kimlik Bilgileri: Ad, soyad, T.C. kimlik numarası (sertifika oluşturma amacıyla)
b) İletişim Bilgileri: E-posta adresi, telefon numarası
c) İş Bilgileri: Görev unvanı, çalıştığı kurum, iş güvenliği uzmanlığı belge bilgileri
d) İşlem Güvenliği Bilgileri: IP adresi, tarayıcı bilgileri, oturum kayıtları
e) Görsel Veriler: Saha fotoğrafları (risk değerlendirmesi amacıyla yüklenen görseller)

T.C. kimlik numarası KVKK Madde 6 kapsamında "özel nitelikli kişisel veri" olarak değerlendirilmekte ve ek güvenlik önlemleriyle şifrelenerek saklanmaktadır.`,
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
    content: `Kişisel verilerinizin güvenliğini sağlamak için aşağıdaki teknik ve idari önlemler alınmaktadır:

• Veri şifreleme: T.C. kimlik numaraları veritabanında şifreli olarak saklanır
• Erişim kontrolü: Yetkisiz erişime karşı rol tabanlı erişim kontrolü (RLS) uygulanır
• HTTPS: Tüm veri iletişimi şifreli bağlantı üzerinden yapılır
• Supabase altyapısı: Veriler SOC 2 uyumlu veri merkezlerinde saklanır
• Oturum güvenliği: JWT tabanlı kimlik doğrulama ve otomatik oturum sonlandırma
• Güvenlik denetimi: Düzenli güvenlik taramaları ve penetrasyon testleri`,
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
• İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle kişinin kendisi aleyhine bir sonucun ortaya çıkmasına itiraz etme
• Verilerin kanuna aykırı olarak işlenmesi sebebiyle zarara uğraması hâlinde zararın giderilmesini talep etme

Bu haklarınızı kullanmak için "Veri Haklarım" sayfasını kullanabilir veya kvkk@isgvizyon.com adresine başvurabilirsiniz.`,
  },
  {
    id: "saklama",
    title: "7. Veri Saklama ve Silme",
    icon: Trash2,
    content: `Kişisel verileriniz, işleme amacının gerçekleşmesine kadar saklanır. Yasal yükümlülükler kapsamında (İSG mevzuatı gereği) belirli veriler yasal süre boyunca muhafaza edilir.

Saklama süreleri:
• Kullanıcı hesabı verileri: Hesap aktif olduğu sürece + silme talebinden sonra 30 gün
• İş sağlığı ve güvenliği kayıtları: İlgili mevzuatın öngördüğü süre (genellikle 10 yıl)
• Oturum ve log kayıtları: 1 yıl
• Silme talebiniz doğrultusunda verileriniz kalıcı olarak silinir`,
  },
  {
    id: "guncelleme",
    title: "8. Politika Güncellemeleri",
    icon: FileText,
    content: `Bu gizlilik politikası, yasal düzenleme değişiklikleri veya hizmet güncellemeleri doğrultusunda güncellenebilir. Güncellemeler platform üzerinden duyurulur.

Son güncelleme: ${new Date().toLocaleDateString("tr-TR")}`,
  },
];

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
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
              <h1 className="text-2xl font-bold text-foreground">
                Gizlilik Politikası
              </h1>
              <p className="text-sm text-muted-foreground">
                6698 sayılı KVKK kapsamında kişisel verilerinizin korunması
              </p>
            </div>
          </div>
        </div>

        {/* Summary Card */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <p className="text-sm leading-relaxed text-foreground/90">
              Denetron İSG Platformu olarak, kişisel verilerinizin güvenliği en yüksek önceliğimizdir.
              Bu politika, hangi verilerin toplandığını, nasıl kullanıldığını ve haklarınızı açıklamaktadır.
              KVKK Madde 10 uyarınca, verilerinizin işlenmesi hakkında açık bilgilendirme yapılmaktadır.
            </p>
          </CardContent>
        </Card>

        {/* Sections */}
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

        <Separator className="my-8" />

        {/* Footer */}
        <div className="text-center">
          <Button variant="outline" onClick={() => navigate("/data-privacy")}>
            Veri Haklarım Sayfasına Git
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            Bu gizlilik politikası, Denetron İSG Platformu kullanıcılarını bilgilendirmek amacıyla
            6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında hazırlanmıştır.
          </p>
        </div>
      </div>
    </div>
  );
}
