# branding/ — Logo Teslim Klasörü

Bu klasör **ham marka dosyaları** içindir (uygulamaya doğrudan derlenmez).
Dosyalar buradan işlenip `app/src/main/res/` altına (drawable / mipmap) aktarılır.

## Buraya konacak dosyalar

| Dosya | Açıklama |
|---|---|
| `albayrak_logo.svg` veya `.png` | Sadece amblem (kırmızı + gri işaret) |
| `albayrak_logo_yazili.svg` veya `.png` | Amblem + "Albayrak Finans" yazısı |

- Tercih sırası: **SVG** > şeffaf arka planlı yüksek çözünürlüklü **PNG** (en az 1024 px).
- Dosya adlarında Türkçe karakter ve boşluk kullanmayın.

## Üretilen çıktılar (işlendikten sonra)

- `res/drawable/` → giriş ekranı ve üst bar logosu (vektör)
- `res/mipmap-*/` → uygulama ikonu (adaptive icon)
- Bildirim ikonu (tek renk, beyaz silüet)
