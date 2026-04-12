//src\utils\naceDatabase.ts
export interface NACECode {
  code: string;
  name: string;
  hazard_class: "Az Tehlikeli" | "Tehlikeli" | "Çok Tehlikeli";
  industry_sector: string;
}

export const NACE_DATABASE: NACECode[] = [
  // ═══════════════════════════════════════════════════════
  // ÇOK TEHLİKELİ İŞLER
  // ═══════════════════════════════════════════════════════
  
  // Madencilik ve Taş Ocakları
  { code: "05.10", name: "Taş kömürü madenciliği", hazard_class: "Çok Tehlikeli", industry_sector: "mining" },
  { code: "05.20", name: "Linyit madenciliği", hazard_class: "Çok Tehlikeli", industry_sector: "mining" },
  { code: "06.10", name: "Ham petrol çıkarımı", hazard_class: "Çok Tehlikeli", industry_sector: "mining" },
  { code: "06.20", name: "Doğal gaz çıkarımı", hazard_class: "Çok Tehlikeli", industry_sector: "mining" },
  { code: "07.10", name: "Demir cevheri madenciliği", hazard_class: "Çok Tehlikeli", industry_sector: "mining" },
  { code: "07.21", name: "Uranyum ve toryum cevheri madenciliği", hazard_class: "Çok Tehlikeli", industry_sector: "mining" },
  { code: "08.11", name: "Süsleme ve yapı taşı, kireç taşı, alçı taşı, tebeşir ve kayağantaşı madenciliği", hazard_class: "Çok Tehlikeli", industry_sector: "mining" },
  { code: "08.12", name: "Çakıl ve kum ocakları; kil ve kaolin çıkarımı", hazard_class: "Çok Tehlikeli", industry_sector: "mining" },
  { code: "08.91", name: "Kimyasal ve gübreleme amaçlı maden madenciliği", hazard_class: "Çok Tehlikeli", industry_sector: "mining" },
  { code: "08.92", name: "Turba çıkarımı", hazard_class: "Çok Tehlikeli", industry_sector: "mining" },
  { code: "08.93", name: "Tuz çıkarımı", hazard_class: "Çok Tehlikeli", industry_sector: "mining" },
  { code: "09.10", name: "Petrol ve doğal gaz çıkarımını destekleyici faaliyetler", hazard_class: "Çok Tehlikeli", industry_sector: "mining" },

  // Ağır Metal İşleme ve Döküm
  { code: "24.10", name: "Ana demir ve çelik ürünleri ile ferro alaşımların imalatı", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "24.20", name: "Çelik tüplerin, boruların, içi boş profillerin ve benzeri bağlantı parçalarının imalatı", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "24.31", name: "Demirin ve çeliğin soğuk çekilmesi", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "24.32", name: "Demirin ve çeliğin soğuk haddelenmesi", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "24.33", name: "Demirin ve çeliğin soğuk şekillendirilmesi veya katlanması", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "24.41", name: "Değerli metallerin üretimi", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "24.42", name: "Alüminyum üretimi", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "24.43", name: "Kurşun, çinko ve kalay üretimi", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "24.44", name: "Bakır üretimi", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "24.45", name: "Diğer demir dışı metallerin üretimi", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "24.51", name: "Demir döküm", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "24.52", name: "Çelik döküm", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "24.53", name: "Hafif metaller döküm", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "24.54", name: "Diğer demir dışı metallerin döküm", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },

  // İnşaat ve Altyapı
  { code: "41.10", name: "Bina inşaat projelerinin geliştirilmesi", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },
  { code: "41.20", name: "İkamet amaçlı olan veya olmayan binaların inşaatı", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },
  { code: "42.11", name: "Karayolları ve demiryollarının inşaatı", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },
  { code: "42.12", name: "Demiryolları ve metro hatlarının inşaatı", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },
  { code: "42.13", name: "Köprü ve tünel inşaatı", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },
  { code: "42.21", name: "Akışkan taşımaya yönelik hizmet projeleri inşaatı", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },
  { code: "42.22", name: "Elektrik ve telekomünikasyon hatlarının inşaatı", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },
  { code: "42.91", name: "Su projeleri inşaatı", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },
  { code: "42.99", name: "Başka yerde sınıflandırılmamış diğer bina dışı yapıların inşaatı", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },
  { code: "43.11", name: "Yıkım", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },
  { code: "43.12", name: "İnşaat sahası hazırlık faaliyetleri", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },
  { code: "43.13", name: "Test sondajı ve delme", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },
  { code: "43.21", name: "Elektrik tesisatı", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },
  { code: "43.22", name: "Sıhhi tesisat, ısıtma ve iklimlendirme tesisatı", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },
  { code: "43.31", name: "Sıvama (suvama) işleri", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },
  { code: "43.32", name: "Doğrama işleri", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },
  { code: "43.33", name: "Yer ve duvar kaplama", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },
  { code: "43.34", name: "Boya ve cam işleri", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },
  { code: "43.99", name: "Başka yerde sınıflandırılmamış diğer özel inşaat faaliyetleri", hazard_class: "Çok Tehlikeli", industry_sector: "construction" },

  // Taşımacılık
  { code: "49.10", name: "Şehirlerarası demiryolu yolcu taşımacılığı", hazard_class: "Çok Tehlikeli", industry_sector: "transportation" },
  { code: "49.20", name: "Demiryolu yük taşımacılığı", hazard_class: "Çok Tehlikeli", industry_sector: "transportation" },
  { code: "49.31", name: "Kara taşımacılığıyla yapılan yolcu taşımacılığı", hazard_class: "Çok Tehlikeli", industry_sector: "transportation" },
  { code: "49.41", name: "Karayolu yük taşımacılığı", hazard_class: "Çok Tehlikeli", industry_sector: "transportation" },
  { code: "50.10", name: "Deniz ve kıyı sularında yolcu taşımacılığı", hazard_class: "Çok Tehlikeli", industry_sector: "transportation" },
  { code: "50.20", name: "Deniz ve kıyı sularında yük taşımacılığı", hazard_class: "Çok Tehlikeli", industry_sector: "transportation" },
  { code: "51.10", name: "Havayolu ile yolcu taşımacılığı", hazard_class: "Çok Tehlikeli", industry_sector: "transportation" },
  { code: "51.21", name: "Havayolu ile yük taşımacılığı", hazard_class: "Çok Tehlikeli", industry_sector: "transportation" },

  // Kimyasal Madde İmalatı
  { code: "20.11", name: "Sanayi gazları imalatı", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "20.12", name: "Boya maddeleri imalatı", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "20.13", name: "Diğer inorganik temel kimyasal maddelerin imalatı", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "20.14", name: "Diğer organik temel kimyasal maddelerin imalatı", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "20.15", name: "Gübre ve azot bileşikleri imalatı", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "20.16", name: "Birincil formda plastik hammaddeleri imalatı", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "20.17", name: "Birincil formda sentetik kauçuk imalatı", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "20.20", name: "Haşere ilaçları ve diğer zirai-kimyasal ürünlerin imalatı", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },
  { code: "20.30", name: "Boya, vernik ve benzeri kaplayıcı maddeler ile matbaa mürekkebi ve macun imalatı", hazard_class: "Çok Tehlikeli", industry_sector: "manufacturing" },

  // ═══════════════════════════════════════════════════════
  // TEHLİKELİ İŞLER
  // ═══════════════════════════════════════════════════════

  // Gıda İmalatı
  { code: "10.11", name: "Et işleme ve saklaması", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.12", name: "Kanatlı hayvan eti işleme ve saklaması", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.13", name: "Et ve kanatlı hayvan etinden üretilen et ürünleri imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.20", name: "Balık, kabuklu deniz hayvanları ve yumuşakçaların işlenmesi ve saklanması", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.31", name: "Patatesin işlenmesi ve saklanması", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.32", name: "Meyve ve sebze suyu imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.39", name: "Meyve ve sebzelerin işlenmesi ve saklanması (dondurulmuş olanlar hariç)", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.41", name: "Sıvı ve katı yağ imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.42", name: "Margarin ve benzeri yenilebilir katı yağların imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.51", name: "Süt işleme ve peynir imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.52", name: "Dondurma imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.61", name: "Öğütülmüş tahıl ürünleri imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.62", name: "Nişasta ve nişastalı ürünlerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.71", name: "Ekmek imalatı; taze pastane ürünleri ve taze kek imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.72", name: "Peksimet ve bisküvi imalatı; dayanıklı pastane ürünleri ve dayanıklı kek imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.73", name: "Makarna, şehriye, kuskus ve benzeri mamul ürünlerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.81", name: "Şeker imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.82", name: "Kakao, çikolata ve şekerleme imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.83", name: "Çay ve kahve işleme", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.84", name: "Baharat, sos, sirke ve diğer çeşni maddeleri imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.85", name: "Hazır yemeklerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.86", name: "Homojenize gıda müstahzarları ve diyet gıdaların imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.89", name: "Başka yerde sınıflandırılmamış diğer gıda maddelerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.91", name: "Hazır hayvan yemleri imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "10.92", name: "Ev hayvanları için hazır gıda imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // İçecek İmalatı
  { code: "11.01", name: "Alkollü içeceklerin damıtılması, arıtılması ve harmanlanması", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "11.02", name: "Üzümden şarap imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "11.03", name: "Elma şarabı ve diğer meyvalardan şarap imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "11.04", name: "Diğer damıtılmamış mayalı içeceklerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "11.05", name: "Bira imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "11.06", name: "Malt imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "11.07", name: "Alkolsüz içeceklerin imalatı; maden suları ve diğer şişelenmiş suların üretimi", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Tekstil İmalatı
  { code: "13.10", name: "Tekstil elyafının hazırlanması ve bükülmesi", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "13.20", name: "Dokuma", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "13.30", name: "Tekstil ürünlerinin bitirilmesi", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "13.91", name: "Örme ve tığ işi kumaşların imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "13.92", name: "Hazır tekstil eşyalarının imalatı (giyim eşyası hariç)", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "13.93", name: "Halı ve kilim imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "13.94", name: "Sicim, ip, urgan ve ağ imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "13.95", name: "Dokumaya elverişsiz tekstiller ve bunlardan mamul eşya imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "13.96", name: "Diğer teknik ve sınai tekstiller imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "13.99", name: "Başka yerde sınıflandırılmamış diğer tekstil ürünlerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Giyim Eşyası İmalatı
  { code: "14.11", name: "Deri giyim eşyası imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "14.12", name: "İş giysisi imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "14.13", name: "Diğer dış giyim eşyaları imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "14.14", name: "İç giyim eşyası imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "14.19", name: "Diğer giyim eşyaları ve giysi aksesuarlarının imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "14.20", name: "Kürkten eşya imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "14.31", name: "Örme ve tığ işi çorap imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "14.39", name: "Diğer örme ve tığ işi giyim eşyası imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Deri ve Ayakkabı İmalatı
  { code: "15.11", name: "Derinin tabaklanması ve işlenmesi; kürkün işlenmesi ve boyanması", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "15.12", name: "Bavul, el çantası ve benzeri eşyaların, saraç ve semer eşyalarının imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "15.20", name: "Ayakkabı, bot, terlik vb. imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Ağaç, Ağaç Ürünleri ve Mantar Ürünleri İmalatı
  { code: "16.10", name: "Ağaç, ağaç ve mantar ürünlerinin biçilmesi, planyalanması ve emprenye edilmesi", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "16.21", name: "Tahta kaplama paneli ve ağaç esaslı diğer panel imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "16.22", name: "Birleştirilmiş parke yer döşemesi imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "16.23", name: "Marangoz ve doğrama ürünlerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "16.24", name: "Ahşap konteyner imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "16.29", name: "Diğer ağaç ürünleri imalatı; saz, saman ve benzeri malzemelerden örülerek eşya imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Kağıt ve Kağıt Ürünleri İmalatı
  { code: "17.11", name: "Kağıt hamuru imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "17.12", name: "Kağıt ve karton imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "17.21", name: "Oluklu kağıt ve karton imalatı ile kağıt ve kartondan yapılan muhafazaların imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "17.22", name: "Evde ve sıhhı amaçlarla kullanılan kağıt ürünlerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "17.23", name: "Kağıt kırtasiye ürünlerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "17.24", name: "Duvar kağıdı imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "17.29", name: "Kağıt ve kartondan diğer ürünlerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Basım ve Kayıt Hizmetleri
  { code: "18.11", name: "Gazete basımı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "18.12", name: "Diğer matbaa işleri", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "18.13", name: "Basım ve yayım öncesi hizmetler", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "18.14", name: "Ciltçilik ve ilgili hizmetler", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "18.20", name: "Kayıtlı medyanın çoğaltılması", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Kok Kömürü ve Rafine Edilmiş Petrol Ürünleri İmalatı
  { code: "19.10", name: "Kok fırını ürünleri imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "19.20", name: "Rafine edilmiş petrol ürünleri imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Eczacılık Ürünlerinin İmalatı
  { code: "21.10", name: "Temel eczacılık ürünleri imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "21.20", name: "İlaç ve eczacılığa ilişkin diğer ürünlerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Kauçuk ve Plastik Ürünlerin İmalatı
  { code: "22.11", name: "Kauçuk lastik ve iç lastik imalatı; lastiğin protez edilmesi ve yenilenmesi", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "22.19", name: "Diğer kauçuk ürünlerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "22.21", name: "Plastik tabaka, levha, tüp ve profil imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "22.22", name: "Plastik torba, çanta, poşet, çuval, kutu, damacana, şişe, makara vb. paketleme malzemelerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "22.23", name: "Plastik inşaat malzemesi imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "22.29", name: "Diğer plastik ürünlerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Diğer Metalik Olmayan Mineral Ürünlerin İmalatı
  { code: "23.11", name: "Düz cam imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.12", name: "Düz camın şekillendirilmesi ve işlenmesi", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.13", name: "İçi boş cam imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.14", name: "Cam elyafı imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.19", name: "Diğer camların imalatı (teknik amaçlı camlar dahil) ile işlenmesi", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.20", name: "Ateşe dayanıklı (refrakter) ürünlerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.31", name: "Seramik karo ve kaldırım taşları imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.32", name: "Pişmiş kilden tuğla, kiremit ve inşaat malzemeleri imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.41", name: "Seramik ev ve süs eşyası imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.42", name: "Seramik sıhhi ürünlerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.43", name: "Seramik yalıtkanlar ve yalıtkanlık malzemeleri imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.44", name: "Diğer teknik seramik ürünlerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.49", name: "Diğer seramik ürünlerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.51", name: "Çimento imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.52", name: "Kireç ve alçı imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.61", name: "İnşaatlarda kullanılmak üzere beton ürünlerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.62", name: "İnşaatlarda kullanılmak üzere alçı ürünlerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.63", name: "Hazır beton imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.64", name: "Harç imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.65", name: "Lifli çimento imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.69", name: "Beton, çimento ve alçıdan diğer ürünlerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.70", name: "Taş yontma, biçme, şekillendirme ve bitirme işleri", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.91", name: "Aşındırıcı ürünlerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "23.99", name: "Başka yerde sınıflandırılmamış metalik olmayan diğer mineral ürünlerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Fabrikasyon Metal Ürünleri İmalatı
  { code: "25.11", name: "Metal yapı ve metal yapı parçalarının imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "25.12", name: "Metal kapı ve pencere imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "25.21", name: "Merkezi ısıtma radyatörleri ve kazanların imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "25.29", name: "Diğer metal sarnıç, rezervuar ve konteyner imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "25.30", name: "Buhar jeneratörü imalatı (merkezi ısıtma için sıcak su kazanları hariç)", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "25.40", name: "Silah ve mühimmat imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "25.50", name: "Metallerin dövülmesi, preslenmesi, baskılanması ve yuvarlanması; toz metalurjisi", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "25.61", name: "Metallerin kaplanması ve kaplamaları", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "25.62", name: "Metallerin işlenmesi ve kaplanması", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "25.71", name: "Çatal bıçak takımı imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "25.72", name: "Kilit ve menteşe imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "25.73", name: "El aletleri imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "25.91", name: "Çelik varil ve benzeri kapların imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "25.92", name: "Metalden hafif paketleme malzemelerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "25.93", name: "Tel ürünleri, zincir ve yay imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "25.94", name: "Bağlantı elemanları ve vida makine ürünleri imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "25.99", name: "Başka yerde sınıflandırılmamış diğer metal ürünlerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Bilgisayar, Elektronik ve Optik Ürünlerin İmalatı
  { code: "26.11", name: "Elektronik bileşenlerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "26.12", name: "Yüklü elektronik kartların imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "26.20", name: "Bilgisayarlar ve bilgisayar çevre birimleri imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "26.30", name: "İletişim teçhizatı imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "26.40", name: "Tüketici elektroniği ürünlerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "26.51", name: "Ölçü, test ve seyrüsefer amaçlı alet ve cihazların imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "26.52", name: "Saat imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "26.60", name: "Işınlama, elektro medikal ve elektro terapi cihazlarının imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "26.70", name: "Optik aletler ve fotografik ekipman imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "26.80", name: "Manyetik ve optik ortamların imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Elektrikli Teçhizat İmalatı
  { code: "27.11", name: "Elektrik motoru, jeneratör ve transformatör imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "27.12", name: "Elektrik dağıtım ve kontrol cihazları imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "27.20", name: "Pil ve akümülatör imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "27.31", name: "Fiber optik kablolar imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "27.32", name: "Diğer elektronik ve elektrik telleri ve kabloların imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "27.33", name: "Kablo tesisatı cihazları imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "27.40", name: "Elektrikli aydınlatma ekipmanları imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "27.51", name: "Elektrikli ev aletlerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "27.52", name: "Elektrikli olmayan ev aletlerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "27.90", name: "Diğer elektrikli ekipmanların imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Başka Yerde Sınıflandırılmamış Makine ve Ekipman İmalatı
  { code: "28.11", name: "Motor ve türbinlerin imalatı (uçak, motorlu taşıt ve motosiklet motorları hariç)", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.12", name: "Akışkan gücü ile çalışan ekipmanların imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.13", name: "Diğer pompa ve kompresörlerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.14", name: "Diğer musluk ve vana imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.15", name: "Rulmanlar, dişli takımları, şanzıman donanımları imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.21", name: "Fırınlar, ocaklar ve brülörler imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.22", name: "Kaldırma ve taşıma ekipmanları imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.23", name: "Büro makineleri ve ekipmanları imalatı (bilgisayarlar ve çevre birimleri hariç)", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.24", name: "Motorlu el aletlerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.25", name: "Endüstriyel soğutma ve havalandırma ekipmanlarının imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.29", name: "Başka yerde sınıflandırılmamış diğer genel amaçlı makinelerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.30", name: "Tarım ve ormancılık makinelerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.41", name: "Metal işleme makinelerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.49", name: "Diğer takım tezgahlarının imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.91", name: "Metalurji makinelerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.92", name: "Maden, taş ocağı ve inşaat makinelerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.93", name: "Gıda, içecek ve tütün işleme makinelerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.94", name: "Tekstil, giyim eşyası ve deri üretimi için makinelerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.95", name: "Kağıt ve karton üretimi için makinelerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.96", name: "Plastik ve kauçuk makinelerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "28.99", name: "Başka yerde sınıflandırılmamış özel amaçlı diğer makinelerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Motorlu Kara Taşıtı, Treyler (Römork) ve Yarı Treyler (Yarı Römork) İmalatı
  { code: "29.10", name: "Motorlu kara taşıtı imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "29.20", name: "Motorlu kara taşıtları için karoseri imalatı; treyler (römork) ve yarı treyler (yarı römork) imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "29.31", name: "Motorlu kara taşıtları için elektrik ve elektronik donanımların imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "29.32", name: "Motorlu kara taşıtları için diğer parça ve aksesuarların imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Diğer Ulaşım Araçlarının İmalatı
  { code: "30.11", name: "Gemi ve yüzer yapıların inşaası", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "30.12", name: "Eğlence ve spor amaçlı teknelerin inşaası", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "30.20", name: "Demiryolu lokomotifleri ve vagonlarının imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "30.30", name: "Hava ve uzay araçları ile ilgili makinelerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "30.40", name: "Askeri savaş araçlarının imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "30.91", name: "Motosiklet imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "30.92", name: "Bisiklet ve özürlü aracı imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "30.99", name: "Başka yerde sınıflandırılmamış diğer ulaşım ekipmanlarının imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Mobilya İmalatı
  { code: "31.01", name: "Büro ve mağaza mobilyaları imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "31.02", name: "Mutfak mobilyası imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "31.03", name: "Yatak imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "31.09", name: "Diğer mobilyaların imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Diğer İmalat
  { code: "32.11", name: "Madeni para basımı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "32.12", name: "Kuyumculuk ve ilgili eşya imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "32.13", name: "Takı eşyası ve benzeri eşya imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "32.20", name: "Müzik aletlerinin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "32.30", name: "Spor malzemeleri imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "32.40", name: "Oyun ve oyuncak imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "32.50", name: "Tıbbi ve dişçilik ile ilgili araç ve gereçlerin imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "32.91", name: "Süpürge ve fırça imalatı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "32.99", name: "Başka yerde sınıflandırılmamış diğer imalatlar", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Makine ve Ekipmanların Kurulumu ve Onarımı
  { code: "33.11", name: "Metal ürünlerin onarımı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "33.12", name: "Makinelerin onarımı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "33.13", name: "Elektronik ve optik ekipmanların onarımı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "33.14", name: "Elektrikli ekipmanların onarımı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "33.15", name: "Gemilerin ve teknelerin onarımı ve bakımı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "33.16", name: "Hava ve uzay araçlarının onarımı ve bakımı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "33.17", name: "Diğer ulaşım ekipmanlarının onarımı ve bakımı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "33.19", name: "Diğer ekipmanların onarımı", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },
  { code: "33.20", name: "Sanayi makine ve ekipmanlarının kurulumu", hazard_class: "Tehlikeli", industry_sector: "manufacturing" },

  // Elektrik, Gaz, Buhar ve İklimlendirme Üretimi ve Dağıtımı
  { code: "35.11", name: "Elektrik enerjisinin üretimi", hazard_class: "Tehlikeli", industry_sector: "energy" },
  { code: "35.12", name: "Elektrik enerjisinin iletimi", hazard_class: "Tehlikeli", industry_sector: "energy" },
  { code: "35.13", name: "Elektrik enerjisinin dağıtımı", hazard_class: "Tehlikeli", industry_sector: "energy" },
  { code: "35.14", name: "Elektrik enerjisinin ticareti", hazard_class: "Tehlikeli", industry_sector: "energy" },
  { code: "35.21", name: "Gaz yakıtların imalatı", hazard_class: "Tehlikeli", industry_sector: "energy" },
  { code: "35.22", name: "Boru hattı ile gaz yakıt dağıtımı", hazard_class: "Tehlikeli", industry_sector: "energy" },
  { code: "35.23", name: "Gaz yakıtların ticareti", hazard_class: "Tehlikeli", industry_sector: "energy" },
  { code: "35.30", name: "Buhar ve iklimlendirme temini", hazard_class: "Tehlikeli", industry_sector: "energy" },

  // Su Temini; Kanalizasyon, Atık Yönetimi ve İyileştirme Faaliyetleri
  { code: "36.00", name: "Suyun toplanması, arıtılması ve dağıtılması", hazard_class: "Tehlikeli", industry_sector: "utilities" },
  { code: "37.00", name: "Kanalizasyon", hazard_class: "Tehlikeli", industry_sector: "utilities" },
  { code: "38.11", name: "Tehlikesiz atıkların toplanması", hazard_class: "Tehlikeli", industry_sector: "waste" },
  { code: "38.12", name: "Tehlikeli atıkların toplanması", hazard_class: "Tehlikeli", industry_sector: "waste" },
  { code: "38.21", name: "Tehlikesiz atıkların ıslahı ve bertarafı", hazard_class: "Tehlikeli", industry_sector: "waste" },
  { code: "38.22", name: "Tehlikeli atıkların ıslahı ve bertarafı", hazard_class: "Tehlikeli", industry_sector: "waste" },
  { code: "38.31", name: "Hurdaların parçalara ayrılması", hazard_class: "Tehlikeli", industry_sector: "waste" },
  { code: "38.32", name: "Tasnif edilmiş materyallerin geri kazanımı", hazard_class: "Tehlikeli", industry_sector: "waste" },
  { code: "39.00", name: "İyileştirme faaliyetleri ve diğer atık yönetimi hizmetleri", hazard_class: "Tehlikeli", industry_sector: "utilities" },

  // Toptan Ticaret (Motorlu Kara Taşıtları ve Motosikletler Hariç)
  { code: "46.21", name: "Tahıllar, işlenmemiş tütün, tohumlar ve hayvan yemleri toptan ticareti", hazard_class: "Tehlikeli", industry_sector: "logistics" },
  { code: "46.75", name: "Kimyasal ürünlerin toptan ticareti", hazard_class: "Tehlikeli", industry_sector: "logistics" },
  
  // Kara Taşımacılığı ve Boru Hattı Taşımacılığı
  { code: "49.32", name: "Taksi işletmeciliği", hazard_class: "Tehlikeli", industry_sector: "transportation" },
  { code: "49.39", name: "Başka yerde sınıflandırılmamış diğer kara yolu taşımacılığı", hazard_class: "Tehlikeli", industry_sector: "transportation" },
  { code: "49.42", name: "Evden eve taşımacılık hizmetleri", hazard_class: "Tehlikeli", industry_sector: "transportation" },
  { code: "49.50", name: "Boru hattı taşımacılığı", hazard_class: "Tehlikeli", industry_sector: "transportation" },

  // Depolama ve Taşımacılığa Yardımcı Faaliyetler
  { code: "52.10", name: "Depolama ve ambarcılık", hazard_class: "Tehlikeli", industry_sector: "logistics" },
  { code: "52.21", name: "Kara taşımacılığına yardımcı hizmet faaliyetleri", hazard_class: "Tehlikeli", industry_sector: "logistics" },
  { code: "52.22", name: "Su yolu taşımacılığına yardımcı hizmet faaliyetleri", hazard_class: "Tehlikeli", industry_sector: "logistics" },
  { code: "52.23", name: "Hava yolu taşımacılığına yardımcı hizmet faaliyetleri", hazard_class: "Tehlikeli", industry_sector: "logistics" },
  { code: "52.24", name: "Kargo yükleme boşaltma hizmetleri", hazard_class: "Tehlikeli", industry_sector: "logistics" },
  { code: "52.29", name: "Taşımacılığa yardımcı diğer faaliyetler", hazard_class: "Tehlikeli", industry_sector: "logistics" },

  // ═══════════════════════════════════════════════════════
  // AZ TEHLİKELİ İŞLER
  // ═══════════════════════════════════════════════════════

  // Motorlu Kara Taşıtları ve Motosikletlerin Toptan ve Perakende Ticareti ile Onarımı
  { code: "45.11", name: "Motorlu kara taşıtlarının ticareti (satış)", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "45.19", name: "Diğer motorlu kara taşıtlarının ticareti (satış)", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "45.20", name: "Motorlu kara taşıtlarının bakım ve onarımı", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "45.31", name: "Motorlu kara taşıtı parçalarının ve aksesuarlarının toptan ticareti", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "45.32", name: "Motorlu kara taşıtı parçalarının ve aksesuarlarının perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "45.40", name: "Motosiklet, motosiklet parçaları ve aksesuarlarının satışı, bakımı ve onarımı", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Toptan Ticaret Aracıları
  { code: "46.11", name: "Tarımsal hammadde, canlı hayvan, tekstil hammaddesi ve yarı mamul ürünlerinin ticaretinde aracılık", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "46.12", name: "Yakıtların, madenlerin, metallerin ve sanayi kimyasallarının ticaretinde aracılık", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "46.13", name: "Kereste ve inşaat malzemelerinin ticaretinde aracılık", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "46.14", name: "Makine, sanayi ekipmanı, gemi ve uçakların ticaretinde aracılık", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "46.15", name: "Mobilya, ev eşyası, hırdavat ve nalburiye ürünlerinin ticaretinde aracılık", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "46.16", name: "Tekstil ürünleri, hazır giyim, kürk, ayakkabı ve deri eşyaların ticaretinde aracılık", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "46.17", name: "Gıda, içecek ve tütün ticaretinde aracılık", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "46.18", name: "Belirli bir mala tahsis edilmiş diğer uzmanlaşmış aracılar", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "46.19", name: "Çeşitli malların ticaretinde aracılık", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Perakende Ticaret
  { code: "47.11", name: "Gıda ürünleri, içecek ve tütün satışının yapıldığı perakende mağazalar", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.19", name: "Diğer perakende mağazalar", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.21", name: "Meyve ve sebze perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.22", name: "Et ve et ürünleri perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.23", name: "Balık, kabuklu deniz hayvanları ve yumuşakçalar perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.24", name: "Ekmek, hamur işleri ve şekerlemeler perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.25", name: "İçeceklerin perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.26", name: "Tütün mamullerinin perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.29", name: "Diğer gıda ürünleri perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.30", name: "Motorlu taşıt yakıtının perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.41", name: "Bilgisayar, çevre birimleri ve yazılım perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.42", name: "Telekomünikasyon ekipmanlarının perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.43", name: "Sesli ve görüntülü ekipmanların perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.51", name: "Tekstil ürünleri perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.52", name: "Nalburiye, boya ve cam eşyaların perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.53", name: "Halı, kilim, duvar ve yer kaplamaları perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.54", name: "Elektrikli ev aletlerinin perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.59", name: "Mobilya, aydınlatma ekipmanı ve diğer ev eşyalarının perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.61", name: "Kitap perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.62", name: "Gazete ve kırtasiye perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.63", name: "Müzik ve video kasetleri perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.64", name: "Spor ekipmanları perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.65", name: "Oyun ve oyuncak perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.71", name: "Giyim eşyası perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.72", name: "Ayakkabı ve deri eşyaların perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.73", name: "Eczacılık ürünleri perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.74", name: "Tıbbi ürünler, ortopedik ürünler ve eczacılık ürünleri perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.75", name: "Kozmetik ve kişisel bakım ürünlerinin perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.76", name: "Çiçek, bitki, tohum, gübre, ev hayvanı ve ev hayvanı yemi perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.77", name: "Saat, mücevherat ve takı eşyası perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.78", name: "Diğer yeni ürünlerin perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.79", name: "İkinci el eşyaların perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.81", name: "Tezgah ve pazarlarda gıda, içecek ve tütün ürünleri perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.82", name: "Tezgah ve pazarlarda tekstil, hazır giyim ve ayakkabı perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.89", name: "Tezgah ve pazarlarda diğer ürünlerin perakende ticareti", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.91", name: "Posta yoluyla veya internet üzerinden perakende ticaret", hazard_class: "Az Tehlikeli", industry_sector: "retail" },
  { code: "47.99", name: "Mağaza, tezgah ve pazar dışı perakende ticaret", hazard_class: "Az Tehlikeli", industry_sector: "retail" },

  // Konaklama
  { code: "55.10", name: "Oteller ve benzeri konaklama yerleri", hazard_class: "Az Tehlikeli", industry_sector: "hospitality" },
  { code: "55.20", name: "Tatil ve diğer kısa süreli konaklama yerleri", hazard_class: "Az Tehlikeli", industry_sector: "hospitality" },
  { code: "55.30", name: "Kamp alanları, motorlu karavan ve çekme karavan için yerler", hazard_class: "Az Tehlikeli", industry_sector: "hospitality" },
  { code: "55.90", name: "Diğer konaklama yerleri", hazard_class: "Az Tehlikeli", industry_sector: "hospitality" },

  // Yiyecek ve İçecek Hizmeti Faaliyetleri
  { code: "56.10", name: "Lokantalar ve seyyar yemek hizmeti faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "hospitality" },
  { code: "56.21", name: "Özel günlerde yapılan yemek hizmeti faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "hospitality" },
  { code: "56.29", name: "Diğer yemek hizmeti faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "hospitality" },
  { code: "56.30", name: "İçecek sunum faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "hospitality" },

  // Yayımcılık Faaliyetleri
  { code: "58.11", name: "Kitap yayımı", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "58.12", name: "Rehber, adres ve posta listesi yayımı", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "58.13", name: "Gazete yayımı", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "58.14", name: "Dergi ve süreli yayınların yayımı", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "58.19", name: "Diğer yayımcılık faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "58.21", name: "Bilgisayar oyunlarının yayımlanması", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "58.29", name: "Diğer yazılım programlarının yayımlanması", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Sinema Filmi, Video ve Television Programları Yapımcılığı, Ses Kaydı ve Müzik Yayımlama Faaliyetleri
  { code: "59.11", name: "Sinema filmi, video ve televizyon programları yapımcılığı faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "59.12", name: "Sinema filmi, video ve televizyon programlarının yapım sonrası faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "59.13", name: "Sinema filmi, video ve televizyon programlarının dağıtım faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "59.14", name: "Sinema filmi gösterim faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "59.20", name: "Ses kaydı ve müzik yayımlama faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Programcılık ve Yayıncılık Faaliyetleri
  { code: "60.10", name: "Radyo yayıncılığı", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "60.20", name: "Televizyon yayıncılığı ve programlanması faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Telekomünikasyon
  { code: "61.10", name: "Kablolu telekomünikasyon faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "61.20", name: "Kablosuz telekomünikasyon faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "61.30", name: "Uydu üzerinden telekomünikasyon faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "61.90", name: "Diğer telekomünikasyon faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Bilgisayar Programlama, Danışmanlık ve İlgili Faaliyetler
  { code: "62.01", name: "Bilgisayar programlama faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "62.02", name: "Bilgisayar danışmanlık faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "62.03", name: "Bilgisayar tesisleri yönetim faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "62.09", name: "Diğer bilgi teknolojileri ve bilgisayar hizmet faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Bilgi Hizmet Faaliyetleri
  { code: "63.11", name: "Veri işleme, barındırma (hosting) ve ilgili faaliyetler", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "63.12", name: "Web portalları", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "63.91", name: "Haber ajanslarının faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "63.99", name: "Başka yerde sınıflandırılmamış diğer bilgi hizmet faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Finansal Hizmet Faaliyetleri (Sigorta ve Emeklilik Fonları Hariç)
  { code: "64.11", name: "Merkez bankacılığı", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "64.19", name: "Diğer parasal aracılık", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "64.20", name: "Holding şirketlerinin faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "64.30", name: "Tröstler, fonlar ve benzeri finansal varlıklar", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "64.91", name: "Finansal kiralama (leasing)", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "64.92", name: "Diğer kredi verme", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "64.99", name: "Sigorta ve emeklilik fonları hariç, başka yerde sınıflandırılmamış diğer finansal hizmet faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Sigorta, Reasürans ve Emeklilik Fonları (Zorunlu Sosyal Güvenlik Hariç)
  { code: "65.11", name: "Hayat sigortası", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "65.12", name: "Hayat dışı sigortalar", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "65.20", name: "Reasürans", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "65.30", name: "Emeklilik fonları", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Finansal Hizmetler ile Sigorta Faaliyetleri için Yardımcı Hizmetler
  { code: "66.11", name: "Finansal piyasa yönetimi", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "66.12", name: "Menkul kıymetler ve emtia sözleşmeleri aracılığı", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "66.19", name: "Finansal hizmetler için diğer yardımcı faaliyetler", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "66.21", name: "Risk ve hasar değerlendirme", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "66.22", name: "Sigorta acentelerinin ve sigorta brokerlarının faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "66.29", name: "Sigorta ve emeklilik fonları için diğer yardımcı faaliyetler", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "66.30", name: "Fon yönetimi faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Gayrimenkul Faaliyetleri
  { code: "68.10", name: "Kendi mülkünün alınıp satılması", hazard_class: "Az Tehlikeli", industry_sector: "real_estate" },
  { code: "68.20", name: "Kendi binası veya kiraladığı gayrimenkulün kiralanması ve işletilmesi", hazard_class: "Az Tehlikeli", industry_sector: "real_estate" },
  { code: "68.31", name: "Gayrimenkul acentelerinin faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "real_estate" },
  { code: "68.32", name: "Ücret veya sözleşmeye dayalı olarak, gayrimenkullerin yönetimi", hazard_class: "Az Tehlikeli", industry_sector: "real_estate" },

  // Hukuki ve Muhasebe Faaliyetleri
  { code: "69.10", name: "Hukuk faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "69.20", name: "Muhasebe, defter tutma ve denetim faaliyetleri; vergi danışmanlığı", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // İdare Faaliyetleri ve Yönetim Danışmanlığı Faaliyetleri
  { code: "70.10", name: "İdare faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "70.21", name: "Halkla ilişkiler ve iletişim faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "70.22", name: "İşletme ve diğer idari danışmanlık faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Mimarlık ve Mühendislik Faaliyetleri; Teknik Test ve Analiz Faaliyetleri
  { code: "71.11", name: "Mimarlık faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "71.12", name: "Mühendislik faaliyetleri ve ilgili teknik danışmanlık", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "71.20", name: "Teknik test ve analiz faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Bilimsel Araştırma ve Geliştirme Faaliyetleri
  { code: "72.11", name: "Biyoteknoloji alanında araştırma ve deneysel geliştirme faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "72.19", name: "Doğa bilimleri ve mühendislik alanında diğer araştırma ve deneysel geliştirme faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "72.20", name: "Sosyal bilimler ve beşeri bilimler alanında araştırma ve deneysel geliştirme faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Reklamcılık ve Piyasa Araştırması
  { code: "73.11", name: "Reklam ajanslarının faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "73.12", name: "Medyada reklam ve gösterim hizmetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "73.20", name: "Piyasa araştırması ve kamuoyu yoklaması", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Diğer Mesleki, Bilimsel ve Teknik Faaliyetler
  { code: "74.10", name: "Uzmanlaşmış tasarım faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "74.20", name: "Fotoğrafçılık faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "74.30", name: "Tercüme ve tercümanlık faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "74.90", name: "Başka yerde sınıflandırılmamış diğer mesleki, bilimsel ve teknik faaliyetler", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Veterinerlik Hizmetleri
  { code: "75.00", name: "Veterinerlik hizmetleri", hazard_class: "Az Tehlikeli", industry_sector: "healthcare" },

  // Kiralama ve Leasing Faaliyetleri
  { code: "77.11", name: "Otomobil ve hafif motorlu kara taşıtı kiralaması", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "77.12", name: "Kamyon, otobüs, karavan vb. kiralaması", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "77.21", name: "Eğlence ve spor eşyalarının kiralanması", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "77.22", name: "Video kasetlerinin ve disklerin kiralanması", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "77.29", name: "Diğer kişisel ve ev eşyalarının kiralanması", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "77.31", name: "Tarım makine ve ekipmanlarının kiralanması", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "77.32", name: "İnşaat makine ve ekipmanlarının kiralanması", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "77.33", name: "Büro makine ve ekipmanlarının (bilgisayarlar dahil) kiralanması", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "77.34", name: "Su yolu taşıma ekipmanlarının kiralanması", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "77.35", name: "Hava yolu taşıma ekipmanlarının kiralanması", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "77.39", name: "Başka yerde sınıflandırılmamış diğer makine, ekipman ve maddi malların kiralanması", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "77.40", name: "Fikri mülkiyet ve benzeri ürünlerin kiralanması (telif hakkı ile korunan eserler hariç)", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // İstihdam Faaliyetleri
  { code: "78.10", name: "İş bulma aracı kurumlarının faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "78.20", name: "Geçici iş gücü tedarik hizmetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "78.30", name: "Diğer insan kaynakları temini", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Seyahat Acentesi, Tur Operatörü ve Diğer Rezervasyon Hizmet Faaliyetleri
  { code: "79.11", name: "Seyahat acentesi faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "79.12", name: "Tur operatörlerinin faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "79.90", name: "Diğer rezervasyon hizmet ve ilgili faaliyetler", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Güvenlik ve Soruşturma Faaliyetleri
  { code: "80.10", name: "Özel güvenlik faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "80.20", name: "Güvenlik sistemleri hizmet faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "80.30", name: "Soruşturma faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Bina ve Çevre Düzenleme Faaliyetleri
  { code: "81.10", name: "Kombine tesis yönetimi faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "81.21", name: "Binaların genel temizliği", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "81.22", name: "Binaların ve sanayi makinelerinin diğer temizlik faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "81.29", name: "Diğer bina ve sanayi temizliği faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "81.30", name: "Çevre düzenleme faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Büro Yönetimi, Büro Desteği ve Diğer İşletme Destek Faaliyetleri
  { code: "82.11", name: "Kombine büro idari hizmet faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "82.19", name: "Fotokopi, belge hazırlama ve diğer özelleşmiş büro destek faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "82.20", name: "Çağrı merkezlerinin faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "82.30", name: "Kongre, fuar ve iş organizasyonu faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "82.91", name: "Tahsilat acenteleri ve kredi bürolarının faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "82.92", name: "Paketleme faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "82.99", name: "Başka yerde sınıflandırılmamış diğer iş destek hizmet faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Kamu Yönetimi ve Savunma; Zorunlu Sosyal Güvenlik
  { code: "84.11", name: "Genel kamu yönetimi faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "84.12", name: "Sağlık, eğitim, kültür ve sosyal hizmetlerin yönetimi (sosyal güvenlik hariç)", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "84.13", name: "İşletmelerin daha etkin yürütülmesinin düzenlenmesi ve desteklenmesi", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "84.21", name: "Dış işleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "84.22", name: "Savunma faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "84.23", name: "Adalet ve yargı faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "84.24", name: "Kamu düzeni ve güvenlik faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "84.25", name: "İtfaiye hizmetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "84.30", name: "Zorunlu sosyal g��venlik faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Eğitim
  { code: "85.10", name: "Okul öncesi eğitim", hazard_class: "Az Tehlikeli", industry_sector: "education" },
  { code: "85.20", name: "İlköğretim", hazard_class: "Az Tehlikeli", industry_sector: "education" },
  { code: "85.31", name: "Genel ortaöğretim", hazard_class: "Az Tehlikeli", industry_sector: "education" },
  { code: "85.32", name: "Teknik ve mesleki ortaöğretim", hazard_class: "Az Tehlikeli", industry_sector: "education" },
  { code: "85.41", name: "Ortaöğretim sonrası yükseköğretim dışı eğitim", hazard_class: "Az Tehlikeli", industry_sector: "education" },
  { code: "85.42", name: "Yükseköğretim", hazard_class: "Az Tehlikeli", industry_sector: "education" },
  { code: "85.51", name: "Spor ve eğlence amaçlı eğitim", hazard_class: "Az Tehlikeli", industry_sector: "education" },
  { code: "85.52", name: "Kültürel eğitim", hazard_class: "Az Tehlikeli", industry_sector: "education" },
  { code: "85.53", name: "Sürücü kursu faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "education" },
  { code: "85.59", name: "Başka yerde sınıflandırılmamış diğer eğitim", hazard_class: "Az Tehlikeli", industry_sector: "education" },
  { code: "85.60", name: "Eğitimi destekleyici faaliyetler", hazard_class: "Az Tehlikeli", industry_sector: "education" },

  // İnsan Sağlığı Hizmetleri
  { code: "86.10", name: "Hastane faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "healthcare" },
  { code: "86.21", name: "Genel sağlık hizmetleri", hazard_class: "Az Tehlikeli", industry_sector: "healthcare" },
  { code: "86.22", name: "Uzman sağlık hizmetleri", hazard_class: "Az Tehlikeli", industry_sector: "healthcare" },
  { code: "86.23", name: "Dişçilik hizmetleri", hazard_class: "Az Tehlikeli", industry_sector: "healthcare" },
  { code: "86.90", name: "Diğer insan sağlığı hizmetleri", hazard_class: "Az Tehlikeli", industry_sector: "healthcare" },

  // Yatılı Bakım Faaliyetleri
  { code: "87.10", name: "Hemşirelik bakım tesislerinin faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "healthcare" },
  { code: "87.20", name: "Zihinsel özürlüler, ruh sağlığı ve madde bağımlılarının yatılı olarak bakımı faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "healthcare" },
  { code: "87.30", name: "Yaşlıların ve bedensel özürlülerin yatılı olarak bakımı faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "healthcare" },
  { code: "87.90", name: "Diğer yatılı bakım faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "healthcare" },

  // Barınacak yer sağlanmaksızın verilen sosyal hizmetler
  { code: "88.10", name: "Yaşlıların ve bedensel özürlülerin barınacak yer sağlanmaksızın verilen sosyal hizmetleri", hazard_class: "Az Tehlikeli", industry_sector: "healthcare" },
  { code: "88.91", name: "Çocuk gündüz bakım faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "healthcare" },
  { code: "88.99", name: "Başka yerde sınıflandırılmamış barınacak yer sağlanmaksızın verilen diğer sosyal hizmetler", hazard_class: "Az Tehlikeli", industry_sector: "healthcare" },

  // Yaratıcı, Sanatsal ve Eğlence Faaliyetleri
  { code: "90.01", name: "Gösteri sanatları", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "90.02", name: "Gösteri sanatlarını destekleyici faaliyetler", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "90.03", name: "Sanatsal yaratma faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "90.04", name: "Sanat tesislerinin işletilmesi", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Kütüphane, Arşiv, Müze ve Diğer Kültürel Faaliyetler
  { code: "91.01", name: "Kütüphane ve arşiv faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "91.02", name: "Müze faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "91.03", name: "Tarihi alanlar ve binalar ile benzeri turistik yerlerin işletilmesi", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "91.04", name: "Botanik ve hayvanat bahçeleri ile tabiat koruma faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Kumar ve Bahis Faaliyetleri
  { code: "92.00", name: "Kumar ve bahis faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Spor Faaliyetleri, Eğlence ve Dinlence Faaliyetleri
  { code: "93.11", name: "Spor tesislerinin işletilmesi", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "93.12", name: "Spor kulüplerinin faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "93.13", name: "Fitness (sağlıklı yaşam) tesislerinin faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "93.19", name: "Diğer spor faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "93.21", name: "Eğlence ve tema parkları faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "93.29", name: "Diğer eğlence ve dinlence faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Üye Olunan Kuruluşların Faaliyetleri
  { code: "94.11", name: "İş, işveren ve mesleki kuruluşların faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "94.12", name: "Mesleki kuruluşların faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "94.20", name: "İşçi sendikalarının faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "94.91", name: "Dini kuruluşların faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "94.92", name: "Siyasi kuruluşların faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "94.99", name: "Başka yerde sınıflandırılmamış diğer üye olunan kuruluşların faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Bilgisayarların ve kişisel ve ev eşyalarının onarımı
  { code: "95.11", name: "Bilgisayar ve çevre birimlerinin onarımı", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "95.12", name: "İletişim ekipmanlarının onarımı", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "95.21", name: "Tüketici elektroniği ürünlerinin onarımı", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "95.22", name: "Evde kullanılan cihazlar ile ev ve bahçe eşyalarının onarımı", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "95.23", name: "Ayakkabı ve deri eşyaların onarımı", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "95.24", name: "Mobilya ve ev döşemelerinin onarımı", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "95.25", name: "Saat ve mücevherat onarımı", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "95.29", name: "Diğer kişisel eşyaların ve ev eşyalarının onarımı", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Diğer Kişisel Hizmet Faaliyetleri
  { code: "96.01", name: "Tekstil ve kürk ürünlerinin yıkanması ve (kuru) temizlenmesi", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "96.02", name: "Kuaförlük ve güzellikle ilgili diğer hizmetler", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "96.03", name: "Cenaze işleri ve ilgili hizmetler", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "96.04", name: "Fiziksel rahatlama sağlayan hizmetler", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "96.09", name: "Başka yerde sınıflandırılmamış diğer kişisel hizmet faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Hane Halklarının İşveren Olarak Faaliyetleri
  { code: "97.00", name: "Ev içi çalışan personelin işverenleri olarak hane halklarının faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Hane Halkları Tarafından Kendi Kullanımlarına Yönelik Olarak Ayrım Yapılmamış Mal ve Hizmet Üretim Faaliyetleri
  { code: "98.10", name: "Hane halkları tarafından kendi kullanımlarına yönelik olarak ayrım yapılmamış mal üretim faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
  { code: "98.20", name: "Hane halkları tarafından kendi kullanımlarına yönelik olarak ayrım yapılmamış hizmet üretim faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },

  // Uluslararası Örgütler ve Temsilciliklerinin Faaliyetleri
  { code: "99.00", name: "Uluslararası örgütler ve temsilciliklerinin faaliyetleri", hazard_class: "Az Tehlikeli", industry_sector: "office" },
];

// src/utils/naceDatabase.ts içindeki ilgili kısmı şu şekilde güncelleyebilirsin:

export function searchNACE(query: string): NACECode[] {
  if (!query) return NACE_DATABASE;

  // Sorguyu Türkçe kurallarına göre (İ-i, Ş-ş) küçük harfe çeviriyoruz
  const lowerQuery = query.toLocaleLowerCase('tr-TR').trim();
  
  return NACE_DATABASE.filter(nace => {
    // Veritabanındaki ismi de Türkçe kurallarına göre küçük harfe çevirip karşılaştırıyoruz
    const lowerName = nace.name.toLocaleLowerCase('tr-TR');
    const codeMatch = nace.code.includes(query);

    // Bozuk karakterli verilerde 'includes' hata verebilir, 
    // bu yüzden önce metni düzelttiğinden emin ol!
    return lowerName.includes(lowerQuery) || codeMatch;
  });
}