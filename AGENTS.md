# AI Asistan Kuralları & Uzmanlık Standartları — Albayrak PDKS

Bu projede çalışan her AI asistan (Antigravity, Gemini, Claude, Copilot vb.) bu kurallara ve entegre edilen uzmanlık standartlarına uyar.

---

## 1. Temel İşleyiş Kuralları

### README'yi Güncel Tut
- İşe başlamadan önce [`README.md`](README.md) dosyasını oku; projenin tek doğruluk kaynağıdır.
- **Kalıcı** bir değişiklik yaptığında (yeni ekran, yeni tablo/alan, iş kuralı, bağımlılık, build ayarı, renk/tema, çözülen bir "Bilinen Eksik") aynı görev içinde:
  1. README'nin ilgili bölümünü güncelle,
  2. **Değişiklik Günlüğü** tablosunun en üstüne tarihli tek satır ekle.
- Küçük düzeltmeler (yazım hatası, tek satırlık bug fix, yorum) için README'ye dokunma.

### Proje Kuralları
- **Dil:** Kod ve tanımlayıcılar İngilizce/Kotlin/JS; kullanıcıya görünen tüm metinler, uyarılar ve dökümanlar **Türkçe**.
- **UI:** Yalnızca Jetpack Compose + Material 3. XML layout ekleme.
- **Renkler:** `ui/theme/Color.kt` içindeki `Albayrak*` sabitlerini kullan, ekranlara sabit hex yazma.
- **Room Veritabanı:** Room şeması değişirse `AppDatabase` `version` değerini artır (destructive migration açık).
- **Harici Bağımlılıklar:** Gemini API vb. harici yapay zeka anahtarı kullanılmaz; tüm analizler `PdksAnalysisService` ile yerel ve kural tabanlı çalışır.
- **Derleme Kuralı:** CLI üzerinden `./gradlew` derlemesi çalıştırılmaz; derleme doğrudan Android Studio üzerinden kullanıcı tarafından yapılır.

---

## 2. Entegre Edilen 5 Aktif Uzmanlık Standardı

### 🛡️ 1. Güvenlik & Hile Önleme Standardı (`security-review` / `security-audit`)
- **30m Geofence:** Şube sınırları 30 metre toleransla denetlenir. Koordinat dışındaki tüm işlemler engellenmeli ve güvenlik kaydı (`security_alerts`) üretilmelidir.
- **Mock GPS Koruması:** Sahte konum tespiti (`isMockLocation`) devrede tutulmalı, tespitte anında blokaj uygulanmalıdır.
- **XSS & Veri Sanitizasyonu:** Web panelinde kullanıcıdan veya tablodan gelen tüm dinamik alanlar (personel adı, departman, sicil, mazeret notu) `esc()` fonksiyonu ile filtrelenmeden DOM'a basılamaz.
- **Rol İzolasyonu (RBAC):** Personel yalnızca kendi kayıtlarını görebilir. İK kullanıcıları BT ekranlarına, BT kullanıcıları İK onay ekranlarına URL manipülasyonuyla erişemez; rota koruması (`route guard`) ihlallerde denetim günlüğü (`audit log`) üretmelidir.

### ✨ 2. Tasarım Mühendisliği & Animasyon Standardı (`emil-design-eng` / `find-animation-opportunities`)
- **Mikro Dokunsal Geri Bildirim (Tactile Feedback):** Butonlar, çipler ve açılır menüler tıklandığında hafif baskı (`scale(0.97)`) geri bildirimi vermelidir.
- **Akıcı 60 FPS Geçişler:** Çekmece (`drawer`), modal ve menü açılışlarında ani hareketler yerine fiziksel yay eğrileri (`cubic-bezier(0.16, 1, 0.3, 1)`) kullanılmalıdır.
- **Sayısal Kararlılık:** Sayaçlar ve saatler titremeyi önlemek için `tabular-nums` ile hizalanmalıdır.

### ♿ 3. Erişilebilirlik Standardı (`frontend-a11y` / `accessibility` — WCAG 2.2 AA)
- **Klavye Gezinimi:** Web üzerindeki tüm modal, çekmece ve özel açılır menüler (`.cselect`) klavyeden (`Tab`, `ArrowDown`, `ArrowUp`, `Enter`, `Space`, `Escape`) fareye ihtiyaç duymadan eksiksiz yönetilebilmelidir.
- **Focus Rings:** Klavye odağında net görülebilir odak çerçeveleri (`:focus-visible`) aktif olmalı; fare tıklamasında gereksiz çerçeve çıkmamalıdır.
- **ARIA & Rol Tanımları:** Menüler `role="listbox"`, elemanlar `role="option"`, butonlar `aria-expanded` ve `aria-haspopup` ile ekran okuyuculara anons edilmelidir. Aktif menü butonlarında `aria-current="page"` bulunmalıdır.
- **Dokunma Hedefleri:** Mobilde tüm dokunulabilir alanlar en az 48x48dp boyutunda olmalı, TalkBack için `contentDescription` boş bırakılmamalıdır.

### 🧪 4. Tarayıcı Sağlamlığı & Doğrulama (`browser-qa` / `e2e-testing`)
- **Hatasız Konsol (Zero Console Errors):** Web paneli çalışırken tarayıcı konsolunda hiçbir `undefined`, `null` referansı veya uyarı olmamalıdır.
- **Tema Bütünlüğü:** Dark/Light tema geçişlerinde metin görünürlüğü, kontrast oranları ve açılır menü arka planları asla bozulmamalıdır.

### 🔍 5. Android Mimari & Performans Standardı (`kotlin-reviewer` / `android-clean-architecture`)
- **Compose Recomposition Optimizasyonu:** `LazyColumn` ve `LazyRow` içindeki tüm dinamik listeler kararlı `key = { ... }` parametresiyle çağrılmalıdır.
- **Gereksiz Hesaplama Engelleme:** Ağır analitik ve liste filtrelemeleri `remember` veya `derivedStateOf` bloklarında saklanmalı; kaydırma esnasında her karede yeniden hesaplanmamalıdır.
- **Temiz Mimari (UDF):** Tek yönlü veri akışı (Unidirectional Data Flow) korunmalı; UI ekranları doğrudan veritabanı veya ağ işlemi yapmamalı, tüm state `MainViewModel` ve `PdksRepository` üzerinden akmalıdır.
