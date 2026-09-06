# Veli başlangıç rehberi

Karşılama ve profil menüsünün ortak `startTour()` girişi artık `/parent/guide` sayfasını açar. Mevcut çocuğu olan veliye çocuk ekleme turu gösterilmez. Rehber, çocuk verilerini okuyarak mevcut profil/okul/kaynak bilgilerini belirtir; sekiz bölümden gerçek ekranlara bağlantı verir. Çocuğu olmayan veli için önce profil oluşturma bağlantısı sunulur. Öğretmen ve öğretmen erişimi bölümleri isteğe bağlıdır.

`onboardingStorage.js` kullanıcı bazında karşılama tercihini saklar ve eski `parentWelcomeSeen` kayıtlarını gözetir. localStorage engellenirse oturum içinde bellek yedeği kullanılır. Tercihler cihazlar arasında senkronize edilmez.

`ScreenTour` ve `parentTourSteps.js` önceki bağlamsal tur altyapısıdır; mevcut rehber girişleri bu turu başlatmaz.

Kontroller:
- `npm run lint`
- `npm test`: konumlandırma ve tercih saklama birim testleri.
- `npm run test:onboarding:browser`: sahte API yanıtlarıyla mevcut çocuk, yeni veli, menü/karşılama girişleri, mobil taşma ve bağlantı kontrolleri. Playwright ortamda kurulu olmalıdır. Harici kurulum için `PLAYWRIGHT_MODULE=/absolute/path/to/playwright`, yerel sunucu için `TEST_BASE_URL=http://localhost:5173` kullanılabilir. Gerçek hesap/veritabanı değiştirilmez.
- `npm run build`

Proje JavaScript/JSX kullanır; TypeScript ve `type-check` komutu tanımlı değildir.
