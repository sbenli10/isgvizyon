import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  Plus,
  FileText,
  Calendar,
  CheckCircle,
  Sparkles,
  Download,
  Edit,
  Trash2,
  Eye,
  PlayCircle,
  BookOpen,
  AlertCircle,
  Lightbulb,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function BoardMeetingsGuide() {
  const navigate = useNavigate();
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/board-meetings")}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-blue-500" />
              İSG Kurul Toplantıları - Kullanım Rehberi
            </h1>
            <p className="text-slate-400 mt-1">
              Adım adım öğrenin ve profesyonel toplantılar düzenleyin
            </p>
          </div>
        </div>

        <Button
          onClick={() => navigate("/board-meetings/new")}
          className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600"
        >
          <Plus className="h-4 w-4" />
          Hemen Başla
        </Button>
      </div>

      {/* Quick Start */}
      <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <Lightbulb className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Hızlı Başlangıç</h3>
              <p className="text-slate-300 mb-4">
                İSG Kurul Toplantıları modülü, 6331 sayılı İş Sağlığı ve Güvenliği Kanunu
                gereği düzenlenmesi zorunlu olan kurul toplantılarınızı dijital ortamda
                yönetmenizi sağlar.
              </p>
              <div className="flex gap-2">
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                  AI Destekli Gündem
                </Badge>
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                  Resmi Tutanak PDF
                </Badge>
                <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                  Mevzuata Uygun
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ana İçerik */}
        <div className="lg:col-span-2 space-y-6">
          {/* Adım Adım Kılavuz */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <PlayCircle className="h-5 w-5 text-blue-400" />
                Adım Adım Nasıl Kullanılır?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="space-y-2">
                {/* Adım 1 */}
                <AccordionItem value="step1" className="border-slate-800">
                  <AccordionTrigger className="text-white hover:text-blue-400">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                        1
                      </div>
                      <span>Yeni Toplantı Oluşturma</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-300 pl-11 space-y-3">
                    <p>
                      Ana sayfada sağ üstteki <strong>"+ Yeni Toplantı"</strong> butonuna
                      tıklayın.
                    </p>
                    <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
                      <p className="font-semibold text-white">Doldurmanız Gerekenler:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>
                          <strong>Firma:</strong> Toplantının yapılacağı şirket
                        </li>
                        <li>
                          <strong>Toplantı Tarihi & Saati:</strong> Ne zaman yapılacak?
                        </li>
                        <li>
                          <strong>Lokasyon:</strong> Toplantı Salonu, Ofis vb.
                        </li>
                        <li>
                          <strong>Toplantı Başkanı:</strong> Kurul başkanının adı
                        </li>
                        <li>
                          <strong>Sekreter:</strong> (Opsiyonel) Toplantı sekreteri
                        </li>
                      </ul>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-300">
                        <strong>İpucu:</strong> Firma seçtiğinizde, o firmaya bağlı
                        çalışanlar otomatik olarak katılımcı listesine eklenmeye hazır
                        hale gelir.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Adım 2 */}
                <AccordionItem value="step2" className="border-slate-800">
                  <AccordionTrigger className="text-white hover:text-blue-400">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm">
                        2
                      </div>
                      <span>Katılımcı Ekleme</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-300 pl-11 space-y-3">
                    <p>
                      Katılımcılar bölümünde <strong>"+ Katılımcı Ekle"</strong> butonuna
                      tıklayın.
                    </p>
                    <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                      <div>
                        <p className="font-semibold text-white mb-2">İki Seçenek:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          <li>
                            <strong>Çalışan Seçimi:</strong> Sistemde kayıtlı çalışanları
                            seçin
                          </li>
                          <li>
                            <strong>Dışarıdan Katılımcı:</strong> Harici konuk ekleyin
                          </li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-white mb-2">Roller:</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">İşveren Vekili</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">İSG Uzmanı</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">İşyeri Hekimi</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Çalışan Temsilcisi</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                      <Lightbulb className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-purple-300">
                        <strong>Not:</strong> Katılım durumunu (Katıldı/Katılmadı) daha
                        sonra güncelleyebilirsiniz.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Adım 3 */}
                <AccordionItem value="step3" className="border-slate-800">
                  <AccordionTrigger className="text-white hover:text-blue-400">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">
                        3
                      </div>
                      <span>AI ile Gündem Oluşturma</span>
                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-300 pl-11 space-y-3">
                    <p>
                      Gündem Maddeleri bölümünde <strong>"AI Gündem Öner"</strong>{" "}
                      butonuna tıklayın.
                    </p>
                    <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-400" />
                        <p className="font-semibold text-white">AI Nasıl Çalışır?</p>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Seçtiğiniz firmanın sektörüne bakar</li>
                        <li>Çalışan sayısını dikkate alır</li>
                        <li>6331 sayılı İSG Kanunu'na uygun 10 madde oluşturur</li>
                        <li>Sektöre özel riskleri dahil eder</li>
                      </ul>
                    </div>
                    <p className="text-sm">
                      Manuel olarak gündem eklemek isterseniz{" "}
                      <strong>"+ Madde Ekle"</strong> butonunu kullanabilirsiniz.
                    </p>
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <p className="font-semibold text-white mb-2">Her Maddede:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>
                          <strong>Başlık:</strong> Gündem maddesi
                        </li>
                        <li>
                          <strong>Görüşmeler:</strong> Tartışma detayları
                        </li>
                        <li>
                          <strong>Karar:</strong> Alınan karar
                        </li>
                        <li>
                          <strong>Sorumlu:</strong> Karardan sorumlu kişi
                        </li>
                        <li>
                          <strong>Termin:</strong> Tamamlanma tarihi
                        </li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Adım 4 */}
                <AccordionItem value="step4" className="border-slate-800">
                  <AccordionTrigger className="text-white hover:text-blue-400">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
                        4
                      </div>
                      <span>Kaydetme ve Tamamlama</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-300 pl-11 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Edit className="h-5 w-5 text-yellow-400" />
                          <p className="font-semibold text-white">Taslak Kaydet</p>
                        </div>
                        <p className="text-sm">
                          Toplantıyı daha sonra tamamlamak için taslak olarak kaydedin.
                        </p>
                      </div>

                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-5 w-5 text-green-400" />
                          <p className="font-semibold text-white">Tamamla ve Kaydet</p>
                        </div>
                        <p className="text-sm">
                          Toplantı tamamlandı olarak işaretlenir ve PDF oluşturabilirsiniz.
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Adım 5 */}
                <AccordionItem value="step5" className="border-slate-800">
                  <AccordionTrigger className="text-white hover:text-blue-400">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-sm">
                        5
                      </div>
                      <span>PDF Tutanak Oluşturma</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-300 pl-11 space-y-3">
                    <p>
                      Toplantı detay sayfasında <strong>"PDF İndir"</strong> butonuna
                      tıklayın.
                    </p>
                    <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
                      <p className="font-semibold text-white">PDF İçeriği:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Firma ve toplantı bilgileri</li>
                        <li>Katılımcı listesi (imza alanları ile)</li>
                        <li>Gündem maddeleri ve alınan kararlar</li>
                        <li>Sorumlu kişiler ve terminler</li>
                        <li>Toplantı başkanı ve sekreter imza alanları</li>
                      </ul>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-green-300">
                        <strong>Mevzuata Uygun:</strong> Oluşturulan PDF, İSG mevzuatına
                        uygun resmi tutanak formatındadır.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Özellikler */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                Özellikler ve Avantajlar
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  <h4 className="font-semibold text-white">AI Gündem Önerisi</h4>
                </div>
                <p className="text-sm text-slate-300">
                  Yapay zeka ile sektöre özel, mevzuata uygun gündem maddeleri otomatik
                  oluşturulur.
                </p>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="h-5 w-5 text-green-400" />
                  <h4 className="font-semibold text-white">Resmi PDF Tutanak</h4>
                </div>
                <p className="text-sm text-slate-300">
                  Profesyonel ve mevzuata uygun PDF tutanak tek tıkla oluşturulur.
                </p>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-5 w-5 text-blue-400" />
                  <h4 className="font-semibold text-white">Otomatik Katılımcı</h4>
                </div>
                <p className="text-sm text-slate-300">
                  Firma seçtiğinizde çalışanlar otomatik olarak listeye eklenir.
                </p>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-orange-400" />
                  <h4 className="font-semibold text-white">Karar Takibi</h4>
                </div>
                <p className="text-sm text-slate-300">
                  Her gündem maddesi için sorumlu ve termin atayarak takip edin.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* SSS */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
                Sık Sorulan Sorular
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="space-y-2">
                <AccordionItem value="faq1" className="border-slate-800">
                  <AccordionTrigger className="text-white hover:text-blue-400 text-left">
                    İSG Kurul Toplantısı ne sıklıkla yapılmalı?
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-300">
                    6331 sayılı İSG Kanunu'na göre, işyerinde ayda en az bir defa İSG
                    Kurulu toplantısı yapılması zorunludur. Toplantı tutanakları en az 3
                    yıl süreyle saklanmalıdır.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq2" className="border-slate-800">
                  <AccordionTrigger className="text-white hover:text-blue-400 text-left">
                    Kurul toplantısına kimler katılmalı?
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-300">
                    - İşveren veya işveren vekili (Başkan)
                    <br />
                    - İşyeri hekimi
                    <br />
                    - İş güvenliği uzmanı
                    <br />
                    - Çalışan temsilcisi(leri)
                    <br />- İnsan kaynakları, sivil savunma uzmanı gibi ilgili personel
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq3" className="border-slate-800">
                  <AccordionTrigger className="text-white hover:text-blue-400 text-left">
                    Taslak ve tamamlanmış toplantı arasındaki fark nedir?
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-300">
                    <strong>Taslak:</strong> Toplantı henüz tamamlanmamış, detaylar daha
                    sonra düzenlenebilir.
                    <br />
                    <strong>Tamamlanmış:</strong> Toplantı yapıldı olarak işaretlenir, PDF
                    oluşturulabilir ve resmi tutanak çıkarılabilir.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq4" className="border-slate-800">
                  <AccordionTrigger className="text-white hover:text-blue-400 text-left">
                    AI gündem önerisi nasıl çalışır?
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-300">
                    Yapay zeka, seçtiğiniz firmanın sektörünü ve çalışan sayısını analiz
                    ederek 6331 sayılı İSG Kanunu'na uygun, sektöre özel 10 maddelik bir
                    gündem listesi oluşturur. İsterseniz bu maddeleri düzenleyebilir veya
                    manuel olarak yeni maddeler ekleyebilirsiniz.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>

        {/* Sağ Sidebar */}
        <div className="space-y-6">
          {/* Hızlı Erişim */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-lg">Hızlı Erişim</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => navigate("/board-meetings/new")}
                className="w-full gap-2 bg-gradient-to-r from-blue-600 to-purple-600"
              >
                <Plus className="h-4 w-4" />
                Yeni Toplantı Oluştur
              </Button>

              <Button
                onClick={() => navigate("/board-meetings")}
                variant="outline"
                className="w-full gap-2"
              >
                <Users className="h-4 w-4" />
                Toplantılarım
              </Button>

              <Button
                onClick={() => navigate("/companies")}
                variant="outline"
                className="w-full gap-2"
              >
                <Building2 className="h-4 w-4" />
                Firmalarım
              </Button>
            </CardContent>
          </Card>

          {/* İpuçları */}
          <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-400" />
                Önemli İpuçları
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                <p>Toplantıdan önce taslak oluşturun ve gündem hazırlayın</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                <p>AI gündem önerisini kullanarak zaman kazanın</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                <p>Her karar için sorumlu ve termin belirleyin</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                <p>Toplantı sonrası mutlaka PDF tutanak oluşturun</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                <p>Tutanakları en az 3 yıl süreyle saklayın</p>
              </div>
            </CardContent>
          </Card>

          {/* Mevzuat Bilgisi */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-400" />
                Mevzuat Bilgisi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-300">
              <p>
                <strong className="text-white">6331 Sayılı Kanun</strong>
                <br />İş Sağlığı ve Güvenliği Kanunu
              </p>
              <p>
                <strong className="text-white">Madde 22:</strong> İşyerlerinde iş sağlığı
                ve güvenliği kurulu oluşturulur.
              </p>
              <p className="text-xs text-slate-500 pt-2">
                Kurul ayda en az bir defa toplanır ve toplantı tutanakları 3 yıl süreyle
                saklanır.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}