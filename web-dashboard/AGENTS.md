# Web Dashboard & Vanilla JS/CSS Uzmanlık Kuralları (`ecc/rules/web` & `typescript`) — Albayrak PDKS (`web-dashboard/`)

Bu dizindeki tüm HTML, CSS ve JavaScript (`index.html`, `styles.css`, `landing.css`, `data.js`, `core.js`, `app.js`, `landing.js`) dosyaları, kök [`AGENTS.md`](../AGENTS.md) kurallarına ek olarak aşağıdaki ECC Web ve JavaScript standartlarına tabidir.

---

## 1. Web Kodlama Stili & CSS Mimarisi (`web/coding-style.md`)

### Tasarım Belirteçleri (CSS Custom Properties)
- Renkleri, tipografiyi, gölgeleri ve geçiş eğrilerini tekrar tekrar sabit yazmak yerine `:root` ve `[data-theme="dark"]` altındaki CSS değişkenleriyle (`--bg-*`, `--text-*`, `--brand-*`) yönet.
- Hem Açık (Light) hem Koyu (Dark) temada metin-zemin kontrastının (WCAG AA) korunduğundan emin ol.

### Animasyon ve 60 FPS Compositor Kuralları (`web/performance.md`)
- Animasyonlarda yalnızca compositor dostu özellikleri (`transform`, `opacity`, `clip-path`) kullan.
- Yerleşimi (layout/reflow) tetikleyen `width`, `height`, `top`, `left`, `margin`, `padding` özelliklerini kare kare anime etme.
- Çekmece (`drawer`), modal ve `.cselect` açılır menülerinde `cubic-bezier(0.16, 1, 0.3, 1)` eğrisini ve butonlarda `scale(0.97)` dokunsal geri bildirimini koru.
- Sayısal tablolarda, KPI kartlarında ve sayaçlarda hizalamayı korumak için `font-variant-numeric: tabular-nums` kullan.

### Semantik HTML & Erişilebilirlik (`frontend-a11y`)
- Genel `div` yığınları yerine uygun semantik etiketleri (`header`, `nav`, `main`, `section`, `aside`, `button`) tercih et.
- Özel bileşenlerde (`.cselect`, çekmece, sekme çubukları, modallar) klavye gezinimini (`Tab`, `ArrowUp/Down`, `Enter`, `Escape`), `:focus-visible` halkalarını ve ARIA niteliklerini (`role="listbox"`, `role="option"`, `aria-expanded`, `aria-current="page"`) eksiksiz uygula.

---

## 2. JavaScript Sağlamlığı & Veri İşleme (`typescript/coding-style.md`)

### Değişmezlik & Sayısal Dayanıklılık
- Veri dizilerini yerinde bozmak yerine değişmez (immutable) kopyalarla filtrele/sırala.
- **Sayısal Güvenlik (`NaN` / `Infinity` Koruması):** Yüzde, ortalama ve süre hesaplamalarında sıfıra bölünme veya eksik alan kaynaklı `NaN%` / `undefined` oluşumunu engellemek için her zaman `ATF.clamp`, `ATF.pctText()`, `ATF.numText()` ve `ATF.num()` yardımcılarını kullan.
- Üretim kodunda gereksiz `console.log` bırakma; tarayıcı konsolunda sıfır hata (Zero Console Errors) ilkesini koru.
- `index.html` içinde statik CSS/JS dosyalarında yapılan kalıcı değişikliklerden sonra önbellek sürüm parametresini (`?v=...`) güncelle.

### OpenXML Excel (`.xlsx`) Üretim Kuralları (`core.js`)
- Excel OOXML şemasında (`ECMA-376 CT_Worksheet`) XML eleman sırası katıdır: `<sheetViews>` → `<cols>` → `<sheetData>` → `<autoFilter>` → `<mergeCells>` → `<pageMargins>` → `<pageSetup>` → `<headerFooter>` → `<drawing>`. Bu sırayı asla bozma (`<mergeCells>` her zaman `<autoFilter>`'dan **sonra** gelmelidir).
- Raporlar A4 yatay (`paperSize="9"`, `orientation="landscape"`, `fitToWidth="1"`, `fitToHeight="0"`), her sayfada tekrarlanan başlık (`_xlnm.Print_Titles`) ve gömülü kurumsal logo (`LOGO_PNG_BASE64`) ile üretilmelidir.
- Hücre stillerinde beyaz zemin üzerine beyaz yazı (`fontId` / `fillId` çakışması) oluşmadığından emin ol.

---

## 3. Web Güvenliği & Doğrulama (`web/security.md` & `web/testing.md`)

- **XSS Önleme (KRİTİK):** Kullanıcıdan, URL'den veya veri tablosundan gelen hiçbir dinamik metni (personel adı, sicil, şube adı, izin/mazeret notu) `esc()` fonksiyonundan geçirmeden `innerHTML` içine yazma.
- **Rol İzolasyonu (RBAC):** İK ve BT görünümleri arasındaki yetki sınırlarını koru; yetkisiz rota geçişlerini engelle ve denetim günlüğüne (`audit log`) kaydet.
- **Doğrulama:** Excel ve rapor değişikliklerinden sonra `scratch/test_xlsx_export.js`, `scratch/verify_sheet_order.py` ve `scratch/verify_xlsx_a4.py` doğrulama betiklerini çalıştırarak çıktıyı doğrula.
