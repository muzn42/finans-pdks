# Android & Kotlin Uzmanlık Kuralları (`ecc/rules/kotlin`) — Albayrak PDKS (`app/`)

Bu dizindeki tüm Kotlin (`.kt`, `.kts`) ve Jetpack Compose kodları, kök [`AGENTS.md`](../AGENTS.md) kurallarına ek olarak aşağıdaki ECC Kotlin standartlarına tabidir.

---

## 1. Kotlin Kodlama Stili (`kotlin/coding-style.md`)

### Değişmezlik (Immutability)
- Varsayılan olarak her zaman `val` kullan; yalnızca mutasyonun zorunlu olduğu yerel durumlarda `var` tercih et.
- Değer tipleri için `data class` kullan ve dışa açık API'lerde değişmez koleksiyonları (`List`, `Map`, `Set`) tercih et.
- Durum güncellemelerinde kopyalayarak yazma (copy-on-write) uygula: `_state.update { it.copy(field = newValue) }`.

### İsimlendirme ve Tip Güvenliği
- Fonksiyon ve özellikler için `camelCase`, sınıflar/arayüzler/nesneler için `PascalCase`, sabitler için `SCREAMING_SNAKE_CASE` (`const val`) kullan.
- **Null Güvenliği (KRİTİK):** Asla `!!` (not-null assertion) operatörünü kullanma. Bunun yerine `?.`, `?:`, `requireNotNull()` veya `checkNotNull()` kullan.
- Kapalı durum hiyerarşilerini modellemek için `sealed interface` veya `sealed class` kullan ve `when` ifadelerinde `else` dalı bırakmadan tüm durumları (exhaustive) ele al.

### Kapsam (Scope) ve Uzantı Fonksiyonları
- `let` (null kontrolü + dönüşüm), `run` (alıcı üzerinde hesaplama), `apply` (nesne yapılandırma), `also` (yan etkiler / loglama) fonksiyonlarını amacına uygun kullan; 2 seviyeden fazla iç içe scope fonksiyonu yazma.
- Hata yönetiminde kontrol akışı için `try-catch` kullanma; `runCatching {}`, `Result<T>` veya nullable dönüş tiplerini tercih et.
- **Coroutine İptali:** `CancellationException` istisnasını asla yutma; yakalanırsa mutlaka yeniden fırlat (`throw e`).

---

## 2. Android & Compose Mimari Desenleri (`kotlin/patterns.md`)

### ViewModel & Tek Yönlü Veri Akışı (UDF)
- Ekran durumu tek bir değişmez durum nesnesi (`StateFlow`) veya kararlı akışlar üzerinden sunulmalı; UI doğrudan `MutableStateFlow` değiştirmemelidir.
- Coroutine başlatırken ViewModel içinde `viewModelScope` kullan; soğuk `Flow` kaynaklarını `stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), initialValue)` ile sıcak `StateFlow`'a dönüştür.

### Jetpack Compose Performans Kuralları
- `LazyColumn` ve `LazyRow` içindeki `items(...)` çağrılarında her zaman benzersiz ve kararlı `key = { item -> item.id }` tanımla.
- Maliyetli liste filtreleme, sıralama ve mesai/gecikme hesaplamalarını Composable gövdesinde doğrudan çalıştırma; `remember(...)` veya `derivedStateOf` içinde önbellekle.
- Renkleri sabit hex koduyla değil `ui/theme/Color.kt` içindeki `Albayrak*` sabitleriyle, metinleri Türkçe olarak tanımla.

### Repository & Room Veritabanı
- Veri erişimini `PdksRepository` arkasında kapsülle; DAO sorgularında asla string birleştirme yapma, her zaman `@Query` içinde parametreli (`:param`) bağlama kullan.
- Room tablo şemalarında (`Entity`) değişiklik yapıldığında `AppDatabase` içindeki `version` numarasını artır.

---

## 3. Güvenlik & Doğrulama (`kotlin/security.md` & `kotlin/testing.md`)

- **30m Geofence & Mock GPS:** Konum doğrulamasında Haversine mesafesi `<= 30.0` metre şartını ve `isMockLocation` kontrolünü asla devre dışı bırakma.
- **Gizli Bilgiler:** Kaynak kodun içine sabit API anahtarı veya parola gömme.
- **Derleme Kuralı:** Bu projede CLI üzerinden `./gradlew` çalıştırılmaz; derleme Android Studio üzerinden kullanıcı tarafından yapılır. Rapor üretimi (`ExcelReportGenerator.kt` vb.) gibi bağımsız mantıklar yerel doğrulama betikleriyle test edilir.
