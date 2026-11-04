# Python Yerel Test Sunucusu & Scraper Kuralları (`ecc/rules/python`) — Albayrak PDKS (`server/`)

Bu dizindeki Python betikleri (`mock_server.py` vb.) ve `scratch/` altındaki doğrulama araçları, kök [`AGENTS.md`](../AGENTS.md) kurallarına ek olarak aşağıdaki ECC Python standartlarına tabidir.

---

## 1. Python Kodlama Stili (`python/coding-style.md`)

- **PEP 8 & Tip Bildirimleri:** PEP 8 kurallarına uy; yeni eklenen fonksiyonlarda okunabilirliği artırmak için tip ipuçları (type annotations) kullan.
- **UTF-8 Konsol ve Dosya Kodlaması:** Windows ortamında Türkçe karakter sorunlarını (`CP1254` kaynaklı bozulmaları) önlemek için tüm dosya okuma/yazma işlemlerinde `encoding="utf-8"` parametresini açıkça belirt ve `sys.stdout.reconfigure(encoding="utf-8")` yapısını koru.
- **Kaynak Yönetimi:** Dosya, ağ (`urllib.request.urlopen`) ve ZIP/XML akışlarında her zaman context manager (`with ... as ...:`) kullan.
- **İş Parçacığı Güvenliği (Thread Safety):** `ACTIVE_BRANCHES` ve `RECEIVED_RECORDS` gibi paylaşılan bellek yapılarında `BRANCHES_LOCK` ve `RECORDS_LOCK` kilitlerini kullanmadan okuma/yazma yapma.

---

## 2. Güvenlik & Veri Doğrulama (`python/security.md`)

- **Gizli Bilgiler:** Kaynak kod içine gerçek kimlik bilgisi, API anahtarı veya token gömme; ortam değişkenlerini (`os.environ`) kullan.
- **Girdi ve Şube Doğrulaması:** İstemciden gelen POST verilerini (`json.loads`) ayrıştırırken hatalı biçimlendirilmiş yükleri güvenli şekilde yakala; tüm şubelerde 30 metre geofence yarıçapını (`radius_meters: 30.0`) koru.
- **Harici Ağ İstekleri:** Şube scraper (`scrape_albayrak_branches`) çağrılarında mutlaka `timeout` tanımla ve ağ hatası durumunda sunucuyu çökertmeden yerel önbelleğe (`cached_branches.json`) geri dön (graceful fallback).
