# Albayrak Finans PDKS (Personel Devam Kontrol Sistemi)

Albayrak Finans (Albayrak Tasarruf Finansman A.Ş.) şube personeli ve genel müdürlük birimleri için geliştirilmiş; **30 metre konum doğrulamalı (geofence) mobil yoklama**, kurumsal **Web Yönetim Dashboard'u**, derin personel performans analitiği, fazla mesai & net süre bakiyesi ligi ve BT güvenlik denetimi sağlayan yeni nesil PDKS çözümüdür.

> [!NOTE]
> **Mimari:** Sistem tamamen çevrimdışı ve yerel analiz motoruyla çalışabilen, harici yapay zeka anahtarı (Gemini API vb.) gerektirmeyen bağımsız ve güvenli bir yapıya sahiptir.

---

## 1. Temel Yetenekler & Özellikler

### 📱 Android Mobil Uygulama (Jetpack Compose)
* **30 Metre Konum (Geofence) Doğrulaması:** Personel, atandığı şubenin merkez koordinatına 30 metre yarıçap içerisinde olduğunda işe giriş/çıkış yapabilir. Şube dışındaki denemeler engellenir ve güvenlik kaydı oluşturulur.
* **Derin Personel Profil Analizi:**
  * **En Çok Geç Kaldığı Gün:** Personelin haftanın hangi gününde en sık geç kaldığı (gün adı, toplam dakika, gecikme sayısı, zirve gecikme günü).
  * **En Çok Ek Mesai Yaptığı Gün:** Fazla mesainin en yoğun olduğu gün, toplam süre ve zirve mesai kaydı.
  * **Net Mesai Bakiyesi:** `Ek Mesai − Gecikme Dakikası` formülüyle üretilen net süre bakiyesi (`+X sa Y dk` veya `−X dk`) ve görsel terazi ayrım barı.
  * **Haftalık Detay Kırılımı:** Pazartesi–Cuma gün bazlı katılım, ortalama giriş/çıkış saatleri ve net süre tablosu.
* **Mesai ve Net Bakiye Ligi:**
  1. *En Çok Mesai Yapanlar*
  2. *Net Süre Bakiyesi En İyiler (+)*
  3. *Net Süre Bakiyesi En Kötüler (−)*
* **Dönem ve Tarih Filtreleme:** `Bugün`, `7 Gün`, `30 Gün`, `60 Gün` ve takvim üzerinden istenen başlangıç/bitiş tarih aralığını seçebilme.
* **A4 Dikey Yazdırmaya Hazır Excel (.xlsx) Raporlama & Bireysel PDKS Puantaj Karnesi:** Android ve bilgisayar ortamlarında uyumsuzluk hatası vermeyen, biçimlendirilmiş kurumsal OpenXML `.xlsx` rapor çıktısı. Web panelindeki tüm raporlar **A4 dikey (portrait)** sayfa düzeninde, sütunlar tek sayfa genişliğine sığdırılmış (`fitToWidth=1`), her sayfada tekrarlanan tablo başlığı ve "Sayfa X / Y" alt bilgisiyle üretilir. Bireysel personel raporları (`exportOneExcel`) tam kapsamlı bir **PDKS Puantaj Cetveli ve Performans Karnesi** olarak; özlük/kadro/şube geofence/cihaz sicil kartını, dönem puantaj ve mesai tahakkuk cetvelini, 6 dikey KPI kartını, Pazartesi–Cuma davranış analizini, izin/güvenlik kayıtlarını ve gün gün giriş-çıkış puantaj cetvelini doğrudan ilk sayfada dikey düzende sunar.
* **Animasyonlu İndirme Butonları & Ses Efektleri:** Akıcı mikro etkileşimler, ilerleme çubukları ve kurumsal ses/haptic geri bildirimleri.
* **Sahte Konum (Mock GPS) & Tek Cihaz Eşleme Koruması:** Sahte konum uygulamalarını algılama ve her personeli yalnızca kendi onaylı cihazına bağlama.

---

### 💻 Kurumsal Web Yönetim Dashboard'u (`web-dashboard/`)
* **3D Scroll-Driven Anahtar Teslim & Giriş Sahnesi (`landing.css`, `landing.js`):**
  * **Sahne 1 (Şube Önü & Kadife Kutu):** Albayrak Finans şubesi önünde temsilcinin kırmızı kadife kutudan 3D akıllı araç kumandasını çıkarması ve kurumsal tasarruf finansmanı karşılaması.
  * **Sahne 2 (3D Dönen Anahtar İnişi):** Sayfa aşağı kaydırıldıkça 3D anahtarın havada dönerek alt sahneye süzülmesi ve mimari bilgi kartları.
  * **Sahne 3 (Müşterinin Eliyle Yakalaması & Kumandayla Farların Yanıp Sönmesi):** Alt sahneye geçerken erkek müşterinin elinin uzanıp anahtarı yakalaması, eşi kırmızı Chevrolet Suburban SUV yanında beklerken kumandaya basılmış gibi aracın LED farlarının iki kez çakması (`suvUnlockFlash`).
  * **Sahne 4 (Çift Arabanın Yanında & Yönetim Giriş Ekranı):** Erkek müşterinin eşinin yanına geçip sarılarak sağa (arabaya ve sağdaki yönetim giriş formuna) bakması.
  * **Sahne 5 (Etkileşimli Parola Gizlilik Animasyonu — `#togglePass`):** Giriş formunda **"Parolayı Göster"** göz butonuna basıldığında çiftin animasyonla arabanın diğer tarafına geçip arkalarını dönerek şifreye bakmıyor gibi durması; parola gizlendiğinde tekrar eski yerlerine dönmesi.
* **İK Portalı:**
  * **Genel Bakış:** Canlı katılım yüzdesi, bugün geç kalanlar, izin talepleri, haftalık trend grafikleri ve özet lig tabloları.
  * **Personel & Yoklama ve Derin PDKS Profil Karnesi (`HR.profile`):** Arama, departman filtresi, durum filtreleri, sayfalama, satır altı hızlı önizleme (`empDetailHtml`) ve tam sayfa **İK Yöneticisi Karar Destek Profili (`#/profile`)**. Profil ekranı; dikey PDKS Excel karnesiyle birebir aynı 22 özlük/cihaz/geofence ve dönem puantaj/tahakkuk metriğini, 6 animasyonlu sparkline KPI kartını, 4 interaktif SVG grafiği (*Günlük çalışma istikrarı vs 8,5 sa hedef*, *Dönem yoklama dağılımı donut grafiği*, *Pazartesi–Cuma ek mesai/gecikme sütun grafiği*, *30m şube geofence mesafe istikrarı grafiği*), departman ve kurum ortalaması kıyaslama çubuklarını, izin/güvenlik denetim kayıtlarını ve gün gün PDKS giriş-çıkış cetvelini anasayfa (`HR.overview`) ile tam tipografik ve görsel bütünlük içinde sunar.
  * **İzin Talepleri:** Mazeret ve yıllık izin onay/red iş akışı.
  * **Analitik & Lig Tabloları:** 3 sütunlu tam lig matrisi, kök neden dağılımları ve yönetici Excel raporlama.
  * **Kurumsal Rapor Sayfası (`HR.reports`):** Rapor, sekme/liste yığını yerine **resmî belge görünümünde** tek sayfa olarak sunulur: kurumsal logo + unvan anteti, rapor numarası ve üretim tarihi künyesi, 4 sütunlu dönem/şube/iş günü/hazırlayan bilgi bloğu, numaralı bölümler (Yönetici Özeti, Departman Performansı, Rapor Kataloğu, Metodoloji Notu) ve hazırlayan/onaylayan imza bloğu. Sayfa **Ctrl+P** ile A4 dikey olarak doğrudan yazdırılabilir (`@media print`).
* **BT Güvenlik Portalı:**
  * **Gelişmiş Güvenlik Radarı:** 30m geofence ihlalleri, mock GPS uyarıları, anormal mesai saatleri ve IP ihlalleri.
  * **Cihaz Eşlemeleri:** Personel cihaz modelleri, OS sürümleri ve tek cihaz sıfırlama/engelleme yönetimi.
  * **Şube & 30m Simülatörü:** 50 şubenin koordinatları ve etkileşimli mesafe kaydırıcılı canlı test motoru.
* **Özel Temalı Şube Seçici (`.cselect`):** İşletim sisteminin varsayılan beyaz kutularından arındırılmış, kurumsal temayla uyumlu şube açılır menüsü.
* **Sürükle-Bırak (Drag & Drop) Panel Düzenleme:** Yöneticilerin kartları kendi isteklerine göre serbestçe dizip kaydedebildiği modüler arayüz.

---

## 2. Hızlı Başlangıç

### Mobil Uygulamayı Çalıştırma
1. **Android Studio** → **Open** → Proje klasörünü seçin.
2. Derleme için ek bir API anahtarı veya yapılandırma gerekmez.
3. Bir emülatör veya gerçek cihaz seçip **Run** ▶ butonuna basın.

#### Test Hesapları (Şifre: `123`)
Giriş ekranında yer alan hazır çiplerle tek dokunuşla giriş yapılabilir:
| Sicil | Ad Soyad | Rol | İlk Açılan Ekran |
|---|---|---|---|
| FN-1048 | Ahmet Yılmaz | PERSONNEL | Giriş / Çıkış & Profil |
| FN-2091 | Zeynep Kaya | PERSONNEL | Giriş / Çıkış & Profil |
| FN-4002 | Elif Demir | HR | İK Yönetim Portalı |
| FN-5055 | Murat Akın | IT | BT Siber Güvenlik Portalı |

---

### Web Dashboard'u Çalıştırma
Herhangi bir kurulum veya build adımı gerektirmez:

**Yöntem 1 — Yerel sunucu (önerilen, Excel indirmeyi test etmek için):**
```powershell
# Proje kökünde:
python -m http.server 8000 --directory web-dashboard --bind 127.0.0.1
```
Ardından **http://127.0.0.1:8000/index.html** adresini Chrome'da açın. `file://` ile açmak yerine bu yöntem kullanılmalıdır; aksi halde bazı tarayıcılar `.xlsx` indirmesini engelleyebilir.

**Yöntem 2 — Doğrudan dosya:**
* [`web-dashboard/index.html`](web-dashboard/index.html) dosyasını doğrudan Google Chrome veya modern bir tarayıcıda açın.
* > [!NOTE]
  > Raporların kurumsal logosu `core.js` içine base64 olarak gömülüdür; bu sayede `file://` ile açıldığında da `.xlsx` dosyasına logo eklenir (harici dosya isteği gerekmez).

* **Demo Girişleri:**
  * **İK Direktörü:** `ik@albayrakfinans.com.tr` / `Ik!2026demo`
  * **BT Müdürü:** `bt@albayrakfinans.com.tr` / `Bt!2026demo`

---

## 3. Teknoloji Mimarisi

| Katman | Teknoloji | Açıklama |
|---|---|---|
| **Mobil Dil & UI** | Kotlin 2.2, Jetpack Compose, Material 3 | XML içermeyen, modern reaktif arayüz |
| **Mobil Mimari** | MVVM + Repository Pattern | `MainViewModel`, StateFlow ve Coroutines |
| **Yerel Veritabanı** | Room (SQLite) v8 | 500 çalışan ve zengin devam geçmişi seed verisi |
| **Konum & Radar** | Google Play Services Fused Location | Haversine mesafe algoritması ve 30m geofence |
| **Excel Motoru** | Özel OpenXML ZIP/XML Üretici | Harici ağır kütüphane gerektirmeyen native `.xlsx` motoru |
| **Ses & Haptic** | Android SoundPool & Vibrator | Kurumsal onay/red tınıları ve dokunsal geri bildirim |
| **Web Dashboard** | Vanilla ES6+, CSS3 Custom Properties, SVG | Çerçevesiz, hafif, ultra hızlı kurumsal gösterge paneli |
| **Test Sunucusu** | Python FastAPI / HTTP Server | `server/mock_server.py` (isteğe bağlı REST API) |

---

## 4. Klasör Yapısı

```
finans-pdks/
├── app/                              # Android Mobil Uygulama Kaynak Kodları
│   └── src/main/java/com/example/
│       ├── ai/                       # Kural tabanlı yerel İK ve BT analiz servisleri
│       │   └── PdksAnalysisService.kt
│       ├── data/                     # Room SQLite veritabanı, DAO ve Entity tanımları
│       │   ├── local/
│       │   └── repository/
│       ├── location/                 # Fused Location GPS ve mesafe hesaplayıcı
│       ├── notification/             # Sistem ve durum çubuğu bildirimleri
│       ├── util/                     # Excel .xlsx üretici, ses efektleri ve ses yardımcıları
│       └── ui/                       # Jetpack Compose ekranları, temalar ve bileşenler
│           ├── components/MinimalComponents.kt   # Kartlar, ligler, analiz bileşenleri
│           ├── screens/              # PersonnelScreen, HrScreen, ProfileScreen vb.
│           └── theme/                # Albayrak Finans kurumsal renk paleti
├── web-dashboard/                    # Kurumsal Web Yönetim Paneli
│   ├── index.html                    # Dashboard ana yapısı ve modal pencereler
│   ├── styles.css                    # Tema değişkenleri, dark mode ve animasyonlar
│   ├── assets/branding/              # Rapor anteti ve panel için kurumsal logo (SVG + PNG)
│   ├── data.js                       # 50 şube, 500 çalışan ve 60 günlük analiz motoru
│   ├── core.js                       # Grafik çiziciler, drag&drop ve OpenXML xlsx üretici
│   └── app.js                        # İK & BT portal mantığı, derin profil çekmecesi ve ligler
├── branding/                         # Albayrak Finans resmi vektör logoları
├── server/                           # Python yerel test sunucusu ve şube scraper
├── AGENTS.md                         # Kök AI asistan & ECC evrensel mühendislik kuralları
│                                     # (Modül kuralları: app/AGENTS.md, web-dashboard/AGENTS.md, server/AGENTS.md)
└── README.md                         # Proje dokümantasyonu
```

---

## 5. Geliştirme Akışı (Git Branch Stratejisi)

- **`main`:** Korunan ana hat. Yalnızca kullanıcı onay verdiğinde `dev` branch'inden merge edilir; doğrudan commit atılmaz.
- **`dev`:** Tüm geliştirme, düzeltme ve deneme çalışmalarının yürütüldüğü çalışma branch'i.
- AI asistanlar geliştirmeleri **`dev`** branch'inde commit eder. `main`'e aktarım için kullanıcıdan onay istenir ve onay yoksa `dev` üzerinde çalışmaya devam edilir.

```bash
git switch dev                              # çalışma hattına geç
git add -A && git commit -m "feat: ..."     # dev üzerinde commit

# Kullanıcı onayı sonrası main'e aktarım
git switch main && git merge --no-ff dev
git switch dev
```

> [!NOTE]
> Derleme çıktıları (`*.apk`, `*.aab`, `*.zip`), imza anahtarları (`*.jks`, `*.keystore`), `.env` ve Python önbellekleri sürüm kontrolü dışındadır.

---

## 6. Değişiklik Günlüğü (Changelog)

| Tarih | Açıklama |
|---|---|
| **2026-11-07** | **Personel CRUD REST API Backend (`server/employee_crud.py`, `server/mock_server.py`) & Web Dashboard Tam CRUD Entegrasyonu (`web-dashboard/data.js`, `app.js`, `landing.css`, `v=9.6`):**<br>1) **SQLite Tabanlı Personel CRUD Backend (`server/employee_crud.py` & `server/mock_server.py`):** `server/AGENTS.md` standartlarına (PEP 8, tip bildirimleri, UTF-8, `with` context manager, `EMPLOYEES_LOCK` thread-safety ve 30m geofence doğrulaması) uygun olarak SQLite (`pdks_employees.db`) destekli RESTful Personel CRUD servisi geliştirildi: `GET /api/v1/employees` (arama, departman, şube, durum filtreleme ve sayfalama), `GET /api/v1/employees/{id\|sicil}` (tekil personel sorgulama), `POST /api/v1/employees` (otomatik ardışık `FN-XXXX` sicil ile yeni personel oluşturma), `PUT / PATCH /api/v1/employees/{id\|sicil}` (personel bilgilerini ve yoklama durumunu güncelleme) ve `DELETE /api/v1/employees/{id\|sicil}` (personel kaydını silme). Ayrıca `server/mock_server.py` hem REST API uçlarını hem de `web-dashboard/` statik dosyalarını tek port üzerinden sunacak şekilde birleştirildi.<br>2) **Web Dashboard CRUD Arayüzü (`data.js` & `app.js`):** `ATF.DATA` katmanına `syncEmployeesFromBackend`, `addEmployee`, `updateEmployee` ve `deleteEmployee` fonksiyonları eklendi; personel listesi satır altı detayına (`empDetailHtml`), tam sayfa personel profiline (`HR.profile`) ve işe giriş ekranına (`HR.onboarding`) **Bilgileri Düzenle (`emp-edit`)** ve **Personeli Sil (`emp-delete`)** modalları entegre edildi.<br>3) **Giriş Sahnesi (`#authView`) Karanlık Mod İzolasyonu (`landing.css`, `app.js`, `landing.js`):** Karanlık modda çıkış yapıldığında `#authView` 3D beyaz stüdyo sahnesinde oluşan kontrast sorunları giderildi; giriş sahnesi açık stüdyo renk değişkenlerine sabitlendi ve giriş/çıkışta tema senkronizasyonu (`syncTheme`) sağlandı. |
| **2026-11-07** | **Personel Profili (`HR.profile`) Yalın Üst Mimari, Sütun Bazlı Sıralanabilir Günlük PDKS Cetveli & Tüm Sitede Büyütülen Kutularda İnteraktif Grafik (`web-dashboard/core.js`, `app.js`, `styles.css`, `index.html`, `v=9.4`):**<br>1) **Yalınlaştırılmış Üst Profil Kartları (`HR.profile` & `styles.css`):** Üstteki "kutu içinde kutu" görünümü kaldırılarak kimlik kartı (`.profile-banner`) tek katmanlı sade bir başlığa dönüştürüldü; altında anasayfa ile birebir uyumlu 4 ferah KPI kartı (`.grid.g-4`) ve 3 bağımsız yönetici analiz kartı (`.grid.g-3` — *Ek mesai ve gecikme terazisi*, *En çok geç kaldığı gün*, *En çok ek mesai günü*) olarak ayrıştırıldı.<br>2) **Sıralanabilir & Filtrelenebilir Gün Gün PDKS Cetveli (`profLog`):** Profilin en altındaki *Gün gün PDKS giriş-çıkış, mesai, gecikme, ek mesai ve konum cetveli* tablosundaki tüm sütun başlıkları (`Tarih`, `Gün`, `İlk Giriş`, `Son Çıkış`, `Fiili Mesai`, `Gecikme`, `Onaylı Ek Mesai`, `Net Süre Bakiyesi`, `Konum & Mesafe`, `Durum`) tıklanarak artan/azalan (`▲`/`▼`) sıralanabilir hale getirildi ve üstüne hızlı durum filtre çipleri (`Tümü`, `Ek Mesai Yapan`, `Geç Kaldı`, `Zamanında`, `İzin / Devamsız`) eklendi.<br>3) **Tüm Sitede Küçük Kutular Büyütülünce İnteraktif Grafik (`ATF.syncCardExpansion` — `core.js`):** Panel genelinde (`HR.overview`, `HR.analytics`, `HR.profile` vb.) herhangi bir küçük KPI kutusu sağ üstteki büyütme butonuyla (`.dnd-span` / `.span-wide`) veya doğrudan mini sparkline üzerine tıklanarak genişletildiğinde, içindeki küçük sabit çizgi otomatik olarak **En Düşük / Dönem Ort. / En Yüksek / Son Kayıt** özet barına sahip, tam genişlikli ve fareyle üzerinde gezinildiğinde gün bazlı değer + ortalama sapma kutucuğu (tooltip) gösteren **interaktif alan grafiğine (`.kpi-expanded-panel`)** dönüşür. |
| **2026-11-07** | **Personel Profili (`HR.profile`) İK Yöneticisi Karar Destek Kokpiti, 4 İnteraktif Grafik & Anasayfa Tipografi/Tasarım Bütünlüğü (`web-dashboard/app.js`, `styles.css`, `index.html`):**<br>1) **Tasarım ve Tipografi Bütünlüğü (`styles.css`):** `styles.css` içinde kapanmamış `@media (prefers-reduced-motion: reduce)` bloğu düzeltildi ve `.kpi-label` tipografisi anasayfa ile uyumlu sentence-case (`Plus Jakarta Sans` + `JetBrains Mono`) yapısına kavuşturuldu. Eski `.profile-section-head` (kırmızı alt çizgili ve `[1]..[4]` numaralı rapor başlıkları) ve `.profile-stat` kutuları kaldırılarak anasayfadaki (`HR.overview`) `.card`, `cardHead()`, `kpi()`, `.hi-card`, `.net-meter` ve `rank()` bileşenleriyle %100 görsel bütünlük sağlandı.<br>2) **Dikey PDKS Excel Karnesiyle %100 Veri Eşleniği (`HR.profile`):** Profil ekranına önceki/sonraki personel hızlı geçişi, 3 yönetici vurgu kartı, Ek Mesai vs Gecikme terazisi, 6 animasyonlu KPI kartı (+ mini sparkline), 11'er satırlık *1. Personel Özlük, Kadro, Şube Geofence ve Mobil Cihaz Sicil Kartı* ile *2. Dönem Puantaj, Mesai ve Devam Tahakkuk Cetveli* (birim/kurum sıralaması, zirve gecikme ve ek mesai kayıtları dahil), *Haftanın Günleri (Pazartesi–Cuma) Davranış Tablosu*, *Dönem İzin, Mazeret ve Güvenlik Denetim Kayıtları* (doğrudan onay/red aksiyonlu) ve *Gün Gün PDKS Giriş-Çıkış Cetveli* eklendi.<br>3) **4 İnteraktif İK Yöneticisi Grafiği (`mountProfileChart`):** `#prChartWork` (Günlük çalışma süresi vs 8,5 sa hedef alan grafiği), `#prChartDonut` (Zamanında/Geç/İzinli/Devamsız dönem yoklama donut grafiği), `#prChartWeekday` (Pazartesi–Cuma ek mesai yükü sütun grafiği) ve `#prChartDist` (30m şube geofence mesafe istikrarı alan grafiği) ile birim/kurum ortalaması kıyaslama çubukları devreye alındı. |
| **2026-11-06** | **Web Dashboard Performans Optimizasyonu & Dikey (A4 Portrait) Kapsamlı PDKS Excel Karnesi (`web-dashboard/landing.js`, `data.js`, `core.js`, `app.js`, `styles.css`, `index.html`):**<br>1) **Performans Darboğazları Giderildi:** `landing.js` içindeki sonsuz `requestAnimationFrame` (`tick`) döngüsü `#authView` gizlendiğinde (`inApp`) veya yay fiziği (`spring`) hedefe ulaştığında otomatik duracak (`stopLoop`/`wakeLoop`) şekilde optimize edildi; 95 adet parola gizlilik karesi (`privacy_frames`) sayfa açılışından çıkarılıp yalnızca parola alanına odaklanıldığında veya birim seçildiğinde kademeli (`lazy`) yüklenecek hale getirildi; `renderFrameToStage` içinde Canvas + `<img>` çift boyama (`double paint`) kaldırıldı. `data.js` içinde `computeLeaderboards` önbelleğe alındı (`leaderboardCache`) ve `analyticsCache` boyutu sınırlandı. `app.js` içinde arama kutularına (`emp-q`, `tk-q`, `dv-q`) `180ms` debounce eklendi ve `filteredEmps()` sıralama mantığı optimize edildi. `core.js` sürükle-bırak (`dragover`) olayında sürekli DOM taraması yerine `lastDropTarget` referansı kullanıldı.<br>2) **Dikey (A4 Portrait) PDKS Excel Raporu ve Bireysel Puantaj Karnesi:** `ATF.excelReport` varsayılan sayfa yönü `portrait` (A4 Dikey) olarak güncellendi; dikey 2'li/3'lü KPI kart dizilimi, anahtar-değer sicil/tahakkuk blokları (`kvSections`) ve çoklu dikey tablo (`extraSections`) desteği eklendi. Personel profilinden indirilen Excel raporu (`exportOneExcel`), gerçek bir **PDKS Bireysel Puantaj Cetveli ve Performans Karnesi** olarak; *Personel Özlük, Şube Geofence, Wi-Fi, Vardiya ve Mobil Cihaz Sicil Kartı*, *Dönem Puantaj, Mesai ve Devam Tahakkuk Cetveli (22 metrik + departman kıyaslaması + zirve gecikme/mesai kayıtları)*, *6 Dikey KPI Kartı*, *Haftanın Günleri (Pazartesi–Cuma) Analizi*, *Dönem İzin/Mazeret ve Güvenlik Kayıtları* ile *Gün Gün PDKS Giriş-Çıkış Puantaj Cetveli* bölümlerinin tamamını doğrudan ilk sayfada dikey düzende ve ikinci sekmede (`Puantaj Detay`) filtreli olarak sunacak şekilde yeniden tasarlandı. |
| **2026-11-04** | **Hiyerarşik ECC Mühendislik Kuralları Entegrasyonu (`AGENTS.md`, `app/AGENTS.md`, `web-dashboard/AGENTS.md`, `server/AGENTS.md`):** ECC (Everything Claude Code) eklentisinden projeye doğrudan lazım olan kurallar, alakasız dillerle (Rust, Go, C++, PHP vb.) bağlamı şişirmeden Antigravity'nin hiyerarşik kural keşif mimarisine uygun olarak entegre edildi. Kök `AGENTS.md` dosyasına evrensel ECC ilkeleri (`common/coding-style`, `agents`, `code-review`, `git-workflow`), `app/AGENTS.md` dosyasına Android/Kotlin & Jetpack Compose kuralları (`kotlin/*`), `web-dashboard/AGENTS.md` dosyasına Web/CSS/JS, 60 FPS compositor, sayısal dayanıklılık ve OOXML `.xlsx` şema sırası kuralları (`web/*`, `typescript/*`), `server/AGENTS.md` dosyasına ise Python yerel sunucu ve scraper güvenlik/kodlama kuralları (`python/*`) eklendi. |
| **2026-11-04** | **Git Sürüm Kontrolü & Branch Akışı (`.gitignore`, `README.md`):** Proje git deposuna alındı; `main` korunan ana hat, geliştirmeler onaylı `dev` çalışma branch'inde yürütülüyor. `.gitignore`'a `*.apk`, `*.aab`, `*.zip`, `*.jks`, `*.keystore`, `__pycache__/`, `*.pyc`, `.venv/` kuralları eklenerek derleme çıktıları, paket arşivleri ve imza anahtarları sürüm kontrolü dışına alındı; daha önce izlenen `finans_pdks_app.zip` deposundan çıkarıldı. README'ye "Geliştirme Akışı (Git Branch Stratejisi)" bölümü eklendi. |
| **2026-11-04** | **Excel "Onarım" Dialogu ve Kayıp Logo Kök Neden Düzeltmesi (`web-dashboard/core.js`, `app.js`):**<br>1) **XML eleman sırası ihlali giderildi:** Excel, `openpyxl`'in aksine OOXML şemasındaki eleman sırasına tolerans göstermez. Detay sekmesinde `<mergeCells>` (şema sırası 15) `<autoFilter>` (sıra 11) elemanından **önce** yazıldığı için Excel dosyayı "onarım" modunda açıyor, `/xl/worksheets/sheet2.xml Satır 12` XML hatası veriyor ve onarım sırasında gömülü logoyu düşürüyordu. Sıra `autoFilter → mergeCells` olarak düzeltildi. Bu hata `openpyxl` ile yapılan testlerden kaçtığı için `scratch/verify_sheet_order.py` (ECMA-376 CT_Worksheet katı sıra denetimi) ve `scratch/verify_package.py` (içerik tipi / ilişki hedefi bütünlüğü) doğrulayıcıları eklendi.<br>2) **Logo artık `core.js` içine gömülü:** Logo PNG'si (1303 bayt) base64 olarak `LOGO_PNG_BASE64` sabitine gömüldü; `loadLogoBytes()` `atob` ile senkron çözüyor. Böylece `fetch()` gereksinimi kalktı — raporlar **`file://` ile açıldığında da logolu** üretiliyor.<br>3) **Yerleşim iyileştirmesi:** Logo 104 px → 88 px genişliğe, antet satır yükseklikleri 24/16/14 pt'ye ayarlanarak kırmızı ayraç çizgisiyle çakışması engellendi; `xmlns:r` çizim kök elemanına taşındı.<br>4) **İzin raporuna 3 yeni gösterge:** Reddedilen, Toplam Gecikme ve İzinli Personel eklendi (6 KPI).<br>5) **Önbellek sürümü** `8.6 → 8.7`.<br>6) **Doğrulama:** Tarayıcıdan indirilen gerçek dosya diske kaydedilip (`scratch/browser_analitik.xlsx`) katı denetimlerden geçirildi; 5 raporun tamamı için şema sırası, gömülü logo, A4, `Print_Titles`, `AutoFilter`, imza bloğu ve Power BI temizliği tarayıcı içinde toplu doğrulandı. |
| **2026-11-04** | **Kurumsal Rapor Sayfası & Logolu A4 Excel Anteti (`web-dashboard/core.js`, `app.js`, `styles.css`, `assets/branding/`):**<br>1) **Belge görünümlü rapor sayfası:** Raporlar sekmesi listeleme görünümünden çıkarılıp resmî belge düzenine alındı — `branding/albayrak_pdks_logo.svg` anteti, şirket unvanı, rapor numarası/üretim tarihi/nüsha künyesi, kırmızı ayraç, 4 sütunlu dönem-şube-iş günü-hazırlayan bloğu, numaralı bölümler (Yönetici Özeti, Departman Performansı, Rapor Kataloğu, Metodoloji Notu), hazırlayan/onaylayan imza bloğu ve gizlilik dipnotu. Yeni `.rpt-*` bileşen sınıfları eklendi; sayfa `@media print` ile A4 yatay yazdırılabilir.<br>2) **Görünmeyen veri hatası giderildi:** KPI değer kartlarının "nötr" stili beyaz yazı + beyaz zemin (`fontId=1` / `fillId=0`) kullandığı için **toplam personel, toplam gecikme** gibi `+`/`%` içermeyen değerler Excel'de görünmüyordu. Yeni koyu `fontId=12` stiliyle düzeltildi; doğrulama betiği artık "beyaz üzerine beyaz hücre" taraması yapıyor.<br>3) **Toplam Gecikme göstergesi eklendi:** Beş raporun tümünde (`Puantaj`, `Lig`, `Analitik`, `Gecikme Denetim`) dönem toplam gecikme süresi KPI olarak raporlanıyor; lig raporundaki toplamlar `computeLeaderboards` dönüşünde bulunmadığı için `lb.all` üzerinden hesaplandı. KPI kartları 6'ya kadar destekleniyor (4'ten fazlaysa 3+3 düzeni).<br>4) **Excel'e gömülü kurumsal logo:** SVG logo tarayıcıda 4× rasterize edilip PNG'ye çevrildi (`assets/branding/albayrak_pdks_logo.png`, 612×516, 1,3 KB) ve `.xlsx` paketine `xl/media/image1.png` + `xl/drawings/drawing1.xml` + ilişki dosyaları ile `OneCellAnchor` olarak A2 hücresine yerleştirildi. `createZipBlob` ikili (Uint8Array) içerik desteği kazandı. Logo yüklenemezse rapor logosuz üretilir (bozulma olmaz).<br>5) **Yeni antet ve dipnot düzeni:** Antet 3 satıra bölündü (unvan / birim / rapor no-üretim tarihi), kırmızı ince ayraç, koyu rapor başlık bandı, açık gri alt başlık bandı ve filtre künyesi eklendi. Detay sekmesine `EK-1` başlık bandı geldi; dondurulan bölme 2 satıra çıktı, `AutoFilter` `A2:` aralığına taşındı ve `Print_Titles` `$1:$2` yapıldı. Alt bilgiye rapor numarası eklendi.<br>6) **Önbellek sürümü:** `index.html` içindeki `styles.css` ve JS sürüm parametreleri `8.5/8.0 → 8.6` yükseltildi.<br>7) **Doğrulama:** `scratch/test_xlsx_export.js` (Node + DOM/fetch mock), `scratch/verify_xlsx_a4.py` (openpyxl + Pillow; A4, fitToWidth, Print_Titles, gömülü logo, görünmez hücre taraması, Power BI kalıntısı) ve `scratch/test_report_page.js` (render çıktısı) testleri geçti; canlı tarayıcıda rapor sayfası ve `.xlsx` indirme uçtan uca doğrulandı. |
| **2026-11-04** | **A4 Yazdırma Düzeni ve Rapor Sadeleştirmesi (`web-dashboard/core.js`, `web-dashboard/app.js`, `MinimalComponents.kt`):** Tüm `.xlsx` raporları A4 yatay yazdırmaya hazır hale getirildi. Her iki platformda `pageSetUpPr fitToPage="1"`, `paperSize="9"` (A4), `orientation="landscape"`, `fitToWidth="1"` / `fitToHeight="0"`, `horizontalCentered="1"`, 600 DPI ve `Sayfa &P / &N` + tarih alt bilgisi eklendi. `Puantaj Detay` sekmesine `_xlnm.Print_Titles` tanımlanarak tablo başlığının her sayfada tekrar etmesi sağlandı; Android raporunda da aynı davranış `$N:$N` aralığıyla aktif. Sütun genişlikleri A4'e sığacak şekilde daraltıldı (web detay sekmesi 232 → 162 birim, Android 268 → 96 birim), KPI kartları sayfa genişliğine dengeli dağıtıldı ve tablo kenarlıklarıyla çakışan grid çizgileri kapatıldı. Rapor içeriğindeki yanıltıcı **"Power BI"**, **"Power BI KPI Kokpiti"** ve **"Power BI Veritabanı"** ifadeleri kaldırıldı; sekme adları `Rapor Ozeti` / `Puantaj Detay` olarak sadeleştirildi ve indirme bildirimleri temizlendi. Doğrulama `scratch/test_xlsx_export.js` + `scratch/verify_xlsx_a4.py` + `scratch/verify_android_xlsx.py` ile `openpyxl` üzerinden yapıldı. |
| **2026-11-03** | **`NaN%` Hata Ayıklaması ve Sayısal Dayanıklılık Katmanı (`app.js`, `core.js`):** Departman bazlı "zamanında gelme" oranları `NaN%` gösteriyordu. Kök neden: `deptStats()` fonksiyonu var olmayan `analytics.onTimeDays` alanını topluyordu (doğru alan `presentDays`). Alan düzeltildi. Ayrıca tüm panelde benzer hataların tekrar etmemesi için `ATF.clamp` NaN/Infinity güvenli hale getirildi, `ATF.pctText()` / `ATF.numText()` / `ATF.num()` yardımcıları eklendi ve yüzde/süre biçimlendirmeleri (departman ve şube sıralamaları, KPI alt metinleri, donut merkezi, Excel rapor özet satırları, uygulama sürüm dağılımı çubukları) bu güvenli yardımcılara taşındı. Geçersiz değerler artık `NaN` yerine `—` olarak gösterilir. |
| **2026-10-30** | **Excel İçi Yerel Power BI Yönetici Kokpiti Mimarisi (Çift Sekmeli `.xlsx` Motoru):** Şirket çalışanlarının hiçbir harici eklenti (`add-in`) kurmasına veya Power BI Pro bulut lisansına gerek kalmadan doğrudan Excel içinde Power BI deneyimi yaşaması sağlandı. 1. Sekme (`Yonetici Kokpiti`): Koyu antrasit kurumsal antet, yan yana dizilmiş büyük puntolu 4 KPI kartı (`Zamanında Katılım`, `Toplam Ek Mesai`, `Net Süre Bakiyesi`, `30m Geofence Uyum Oranı`), renkli durum rozetleriyle departman bazlı performans matrisi ve filtreleme yönlendirme çağrısı. 2. Sekme (`Puantaj Veritabani`): Üst satırı dondurulmuş (`freeze panes`) ve Excel otomatik filtreleme (`AutoFilter`) devrede ham veri listesi içeren native OOXML yapısı `core.js` üzerinde devreye alındı. |
| **2026-10-29** | **#FFFFFF Saf Beyaz 1080p 3D Scroll-Scrubbing & Parola Gizlilik Giriş Mimarisi (`landing.css`, `landing.js`, `scroll_frames/`, `privacy_frames/`):** OpenCV/NumPy White-Point Normalizasyonu ile 200 karelik `scroll_frames/` (kutunun bırakılması $\rightarrow$ 3D Albayrak anahtarının çıkıp dönmesi $\rightarrow$ sağdan uzanan ele konması $\rightarrow$ adamın kırmızı SUV ve eşinin yanına yürümesi + son 15 karede kesintisiz crossfade) ve 95 karelik `privacy_frames/` (çiftin 180 derece arkasını dönüp kırmızı SUV'ye bakması) `#FFFFFF` saf beyaz zemine normalize edildi. Sahne 0'da ortada büyük başlayan Albayrak Finans logosunun spring fiziğiyle (`stiffness: 260, damping: 28`) sol üste yerleşmesi, Sahne 5'te sağ yarıya "Yönetim Portalına Giriş" kartının süzülmesi ve **Parolayı Göster (`#togglePass`)** tetiklendiğinde çiftin sıçramasız şekilde arkasını dönmesi sağlandı. |
| **2026-10-28** | **Web Dashboard 3D Scroll-Driven Anahtar Teslim & Parola Gizlilik Etkileşimli Giriş Ekranı (`landing.css`, `landing.js`):** Şube önünde kadife kutudan çıkan 3D Albayrak anahtarının kaydırma (scroll) ile dönerek aşağı süzülmesi, erkek müşterinin anahtarı yakalayıp kırmızı Chevrolet Suburban SUV farlarının yanıp sönmesi, çiftin arabanın solunda sarılarak sağdaki giriş ekranına bakması ve **Parolayı Göster (`#togglePass`)** butonuna tıklandığında çiftin arabanın diğer tarafına geçip şifreye bakmıyor gibi arkasını dönmesi animasyonu 1080p sahnelerle entegre edildi. |
| **2026-10-21** | **Derin Personel Analizi, Net Mesai Terazisi, Lig Tabloları, Web Dashboard, OpenXML Excel ve Harici API Bağımsızlığı:**<br>1) **Derin Personel Analizi:** Profil detayına personelin en çok geç kaldığı gün, en çok ek mesai yaptığı gün, ortalama ve zirve gecikme/mesai saatleri, gün gün Pazartesi-Cuma devam tablosu eklendi.<br>2) **Net Mesai Bakiyesi:** `Ek Mesai − Gecikme` formülüyle görsel terazi split barı ve pozitif/negatif renk kodlu rozetler entegre edildi.<br>3) **Mesai ve Net Bakiye Ligi:** Web ve Mobil ekranlara 3 sütunlu lig tablosu (En çok mesai yapanlar, Net bakiye en iyiler, Net bakiye en kötüler) eklendi.<br>4) **Üst Süre ve Tarih Filtresi:** `Bugün`, `7 Gün`, `30 Gün`, `60 Gün` ve özel tarih seçici filtreleri kuruldu.<br>5) **Web Dashboard & Şube Seçicisi:** Web paneline İK ve BT yönetim portalları, sürükle-bırak kartlar ve temayla tam uyumlu özel `.cselect` şube açılır menüsü entegre edildi.<br>6) **OpenXML Excel Motoru:** Mobil ve webde hata vermeden açılan biçimlendirilmiş kurumsal `.xlsx` raporlayıcı geliştirildi.<br>7) **Harici API Bağımsızlığı:** Gemini API çağrıları ve API key gereksinimi tamamen kaldırılarak sistem %100 yerel, hızlı ve kural tabanlı `PdksAnalysisService` motoruna geçirildi. |
| **2026-10-15** | **500 Kişilik Mock Personel & Devam Kayıtları:** Room veritabanı v8'e yükseltilerek `MockDataGenerator.kt` devreye alındı. 500 benzersiz çalışan ve 30 günlük gerçekçi giriş-çıkış geçmişi oluşturuldu. |
| **2026-10-15** | **İK Yönetici Dashboard'u & Görsel Grafikler:** Dakiklik madalyası donut halkası, çan eğrisi ve departman bazlı karşılaştırma çubukları eklendi. |
| **2026-10-15** | **30 Metre Geofence & Güvenlik Bildirimi İzolasyonu:** Radar doğrulama mesafesi mobil GPS hassasiyetine uygun olarak 30 metreye güncellendi. |
| **2026-10-14** | **Albayrak Finans Kurumsal Kimlik & Vektör Logoları:** Kurumsal kırmızı `#E31E24`, antrasit `#2B2D30` renk paleti ve amblem/ikonlar entegre edildi. |
