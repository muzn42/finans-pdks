/* ==========================================================================
   data.js · demo veri üretimi ve derin personel analiz motoru (deterministik).
   ========================================================================== */
(function (g) {
    'use strict';
    const A = g.ATF;
    const rnd = A.rng(20261020);

    const BRANCHES = [
        {"id": 1, "code": "ŞB-001", "name": "Albayrak Finans Genel Müdürlük (Ataşehir)", "city": "İstanbul", "district": "Ataşehir", "address": "Yenişehir Mah. Kızılcık Sok. Albayrak Plaza No:1/35 34779 Ataşehir / İstanbul", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=40.995454,29.140893", "lat": 40.995454, "lng": 29.140893, "radius": 30.0, "wifi": "ALBAYRAK_GM_SECURE", "w": 0.16},
        {"id": 2, "code": "ŞB-002", "name": "Adana / Seyhan Şube", "city": "Adana", "district": "Seyhan", "address": "Reşatbey Mah. Atatürk Cad. Duru Apt. A Girişi No:34/A SEYHAN / ADANA", "phone": "0322 480 02 01", "googleMapUrl": "https://maps.app.goo.gl/YW5Yb2wL37ft3KCeA", "lat": 36.99142, "lng": 35.33083, "radius": 30.0, "wifi": "ALBAYRAK_02_WIFI", "w": 0.01585},
        {"id": 3, "code": "ŞB-003", "name": "Ankara / Keçiören Şube", "city": "Ankara", "district": "Keçiören", "address": "Şefkat Mah. Cumhuriyet Cd. No:4 B/A - KEÇİÖREN / ANKARA", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=39.996840,32.863250", "lat": 39.99684, "lng": 32.86325, "radius": 30.0, "wifi": "ALBAYRAK_03_WIFI", "w": 0.01585},
        {"id": 4, "code": "ŞB-004", "name": "Ankara / Sıhhiye Şube", "city": "Ankara", "district": "Sıhhiye", "address": "Eti Mah. Strazburg Cad. No:18/A ÇANKAYA / ANKARA", "phone": "0312 920 17 06", "googleMapUrl": "https://maps.app.goo.gl/fsTmAELXCwr4bFsQ8", "lat": 39.92721, "lng": 32.85581, "radius": 30.0, "wifi": "ALBAYRAK_04_WIFI", "w": 0.01585},
        {"id": 5, "code": "ŞB-005", "name": "Ankara / Sincan Şube", "city": "Ankara", "district": "Sincan", "address": "Maraşal Çakmak Mah. Atatürk Cd. No:86/B Sincan / ANKARA", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=39.974620,32.580140", "lat": 39.97462, "lng": 32.58014, "radius": 30.0, "wifi": "ALBAYRAK_05_WIFI", "w": 0.01585},
        {"id": 6, "code": "ŞB-006", "name": "Ankara / Yenimahalle Şube", "city": "Ankara", "district": "Yenimahalle", "address": "Çarşı Mh. Akın Cd. No:59A Yenimahalle / ANKARA", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=39.969350,32.816420", "lat": 39.96935, "lng": 32.81642, "radius": 30.0, "wifi": "ALBAYRAK_06_WIFI", "w": 0.01585},
        {"id": 7, "code": "ŞB-007", "name": "Antalya / Muratpaşa Şube", "city": "Antalya", "district": "Muratpaşa", "address": "Tahılpazarı Mah. Adnan Menderes Bulvarı Yüce 3 Apt. No:33/A MURATPAŞA / ANTALYA", "phone": "0242 277 18 07", "googleMapUrl": "https://maps.app.goo.gl/HKPZjreqnCdAKp6a8", "lat": 36.88912, "lng": 30.70341, "radius": 30.0, "wifi": "ALBAYRAK_07_WIFI", "w": 0.01585},
        {"id": 8, "code": "ŞB-008", "name": "Aydın / Efeler Şube", "city": "Aydın", "district": "Efeler", "address": "Zafer Mah. Doğu Gazi Bulvarı Dış kapı No:51 D EFELER / AYDIN", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=37.848150,27.845230", "lat": 37.84815, "lng": 27.84523, "radius": 30.0, "wifi": "ALBAYRAK_08_WIFI", "w": 0.01585},
        {"id": 9, "code": "ŞB-009", "name": "Batman / Merkez Şube", "city": "Batman", "district": "Merkez", "address": "Kültür Mah. Turgut Özal Bulvarı No:59/A - MERKEZ / BATMAN", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=37.889540,41.132180", "lat": 37.88954, "lng": 41.13218, "radius": 30.0, "wifi": "ALBAYRAK_09_WIFI", "w": 0.01585},
        {"id": 10, "code": "ŞB-010", "name": "Bursa / İnegöl Şube", "city": "Bursa", "district": "İnegöl", "address": "Sinanbey Mh. Nuri Doğrul Cd. No:11/B İNEGÖL / BURSA", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=40.078120,29.513340", "lat": 40.07812, "lng": 29.51334, "radius": 30.0, "wifi": "ALBAYRAK_10_WIFI", "w": 0.01585},
        {"id": 11, "code": "ŞB-011", "name": "Bursa / Osmangazi Şube (Yakında Hizmetinizde)", "city": "Bursa", "district": "Osmangazi  (Yakında Hizmetinizde)", "address": "Ulu Mh. Kıbrıs Şehitleri Cd. No:62 OSMANGAZİ / BURSA", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=40.193240,29.061020", "lat": 40.19324, "lng": 29.06102, "radius": 30.0, "wifi": "ALBAYRAK_11_WIFI", "w": 0.01585},
        {"id": 12, "code": "ŞB-012", "name": "Bursa / Yıldırım Şube", "city": "Bursa", "district": "Yıldırım", "address": "Anadolu Mah. Ankarayolu Cad. A Blok No: 121/E YILDIRIM / BURSA", "phone": "0224 552 01 16", "googleMapUrl": "https://maps.app.goo.gl/DxBvSofYM5s3fFzs5", "lat": 40.19165, "lng": 29.08843, "radius": 30.0, "wifi": "ALBAYRAK_12_WIFI", "w": 0.01585},
        {"id": 13, "code": "ŞB-013", "name": "Denizli / Merkezefendi Şube", "city": "Denizli", "district": "Merkezefendi", "address": "Saraylar Mah. Enverpaşa Cad. No:11 MERKEZEFENDİ / DENİZLİ", "phone": "0258 201 00 20", "googleMapUrl": "https://maps.app.goo.gl/LbfcayZnfdhncSUUA", "lat": 37.78342, "lng": 29.08615, "radius": 30.0, "wifi": "ALBAYRAK_13_WIFI", "w": 0.01585},
        {"id": 14, "code": "ŞB-014", "name": "Diyarbakır / Bağlar Şube", "city": "Diyarbakır", "district": "Bağlar", "address": "Bağlar Mahallesi Şanlıurfa Bulvarı No:141 A/B BAĞLAR / DİYARBAKIR", "phone": "0412 505 34 14", "googleMapUrl": "https://maps.app.goo.gl/KriKMioWevUG7VbV6", "lat": 37.91683, "lng": 40.21094, "radius": 30.0, "wifi": "ALBAYRAK_14_WIFI", "w": 0.01585},
        {"id": 15, "code": "ŞB-015", "name": "Erzurum / Yakutiye Şube", "city": "Erzurum", "district": "Yakutiye", "address": "Muratpaşa Mah. Saraybosna Cad. No :35/A YAKUTİYE / ERZURUM", "phone": "444 88 61", "googleMapUrl": "https://maps.app.goo.gl/K1xtWPuvVMYeP6ry6", "lat": 39.90552, "lng": 41.26831, "radius": 30.0, "wifi": "ALBAYRAK_15_WIFI", "w": 0.01585},
        {"id": 16, "code": "ŞB-016", "name": "Eskişehir / Tepebaşı Şube", "city": "Eskişehir", "district": "Tepebaşı", "address": "Hacı Ali Bey Mah. Sakarya 1 Cd. No:22A TEPEBAŞI/ ESKİŞEHİR", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=39.776710,30.520630", "lat": 39.77671, "lng": 30.52063, "radius": 30.0, "wifi": "ALBAYRAK_16_WIFI", "w": 0.01585},
        {"id": 17, "code": "ŞB-017", "name": "Gaziantep / Şahinbey Şube", "city": "Gaziantep", "district": "Şahinbey", "address": "Alaybey Mah. Hürriyet Cad. No:1/E Belediye Pasajı ŞAHİNBEY / GAZİANTEP", "phone": "0342 233 00 27", "googleMapUrl": "https://maps.app.goo.gl/aQgFNT7MNsmKwhvS7", "lat": 37.06284, "lng": 37.37921, "radius": 30.0, "wifi": "ALBAYRAK_17_WIFI", "w": 0.01585},
        {"id": 18, "code": "ŞB-018", "name": "Gaziantep / Şehitkamil Şube", "city": "Gaziantep", "district": "Şehitkamil", "address": "Batıkent Mah. Hasan Celal Güzel Cd. No:101A ŞEHİTKAMİL / GAZİANTEP", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=37.078410,37.344120", "lat": 37.07841, "lng": 37.34412, "radius": 30.0, "wifi": "ALBAYRAK_18_WIFI", "w": 0.01585},
        {"id": 19, "code": "ŞB-019", "name": "Giresun / Merkez Şube (Yakında Hizmetinizde)", "city": "Giresun", "district": "Merkez  (Yakında Hizmetinizde)", "address": "Hacısiyam Mah. İnönü Cad. No:24A MERKEZ / GİRESUN", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=40.916980,38.387410", "lat": 40.91698, "lng": 38.38741, "radius": 30.0, "wifi": "ALBAYRAK_19_WIFI", "w": 0.01585},
        {"id": 20, "code": "ŞB-020", "name": "Isparta / Merkez Şube", "city": "Isparta", "district": "Merkez", "address": "Yayla Mah. 118 Cumhuriyet Cad. No:25/B A-3 Blok İç Kapı No:4 Isparta Meydan AVM MERKEZ / ISPARTA", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=37.768120,30.556420", "lat": 37.76812, "lng": 30.55642, "radius": 30.0, "wifi": "ALBAYRAK_20_WIFI", "w": 0.01585},
        {"id": 21, "code": "ŞB-021", "name": "İstanbul / Avcılar Şube", "city": "İstanbul", "district": "Avcılar", "address": "Cihangir Mah. E-5 Yan Yol Caddesi ( Londra Asfaltı ) NO:223/A AVCILAR / İSTANBUL", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=40.980140,28.717530", "lat": 40.98014, "lng": 28.71753, "radius": 30.0, "wifi": "ALBAYRAK_21_WIFI", "w": 0.01585},
        {"id": 22, "code": "ŞB-022", "name": "İstanbul / Bağcılar Şube", "city": "İstanbul", "district": "Bağcılar", "address": "Çınar Mahallesi İstanbul Caddesi No:45-47/A Burak Apt. BAĞCILAR / İSTANBUL", "phone": "0212 912 27 34", "googleMapUrl": "https://maps.app.goo.gl/8Vz6tNjZ4c8w7hqy9", "lat": 41.03382, "lng": 28.85671, "radius": 30.0, "wifi": "ALBAYRAK_22_WIFI", "w": 0.01585},
        {"id": 23, "code": "ŞB-023", "name": "İstanbul / Esenler Şube", "city": "İstanbul", "district": "Esenler", "address": "Menderes Mah. 301. Sok. Dörtyaka Apt. No:1/H ESENLER / İSTANBUL", "phone": "0212 912 02 34", "googleMapUrl": "https://maps.app.goo.gl/LouYkU2ffPYSEWqC7", "lat": 41.04351, "lng": 28.87562, "radius": 30.0, "wifi": "ALBAYRAK_23_WIFI", "w": 0.01585},
        {"id": 24, "code": "ŞB-024", "name": "İstanbul / Esenyurt Şube", "city": "İstanbul", "district": "Esenyurt", "address": "Sultaniye Mah. Doğan Araslı Bulvarı No: 134/C ESENYURT / İSTANBUL", "phone": "0212 912 05 34", "googleMapUrl": "https://maps.app.goo.gl/vViXg64HhQfsyDHB9", "lat": 41.03428, "lng": 28.68011, "radius": 30.0, "wifi": "ALBAYRAK_24_WIFI", "w": 0.01585},
        {"id": 25, "code": "ŞB-025", "name": "İstanbul / Fatih Şube", "city": "İstanbul", "district": "Fatih", "address": "Atikali Mah. Fevzipaşa Cad. 104/A FATİH / İSTANBUL", "phone": "0212 912 00 34", "googleMapUrl": "https://maps.app.goo.gl/4jD6THHqbiLBmjZv8", "lat": 41.02214, "lng": 28.94385, "radius": 30.0, "wifi": "ALBAYRAK_25_WIFI", "w": 0.01585},
        {"id": 26, "code": "ŞB-026", "name": "İstanbul / Gaziosmanpaşa Şube", "city": "İstanbul", "district": "Gaziosmanpaşa", "address": "Sarıgöl Mah. Ordu Cad. Esen Apt. No:15/B GAZİOSMANPAŞA / İSTANBUL", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=41.057830,28.912340", "lat": 41.05783, "lng": 28.91234, "radius": 30.0, "wifi": "ALBAYRAK_26_WIFI", "w": 0.01585},
        {"id": 27, "code": "ŞB-027", "name": "İstanbul / Pendik Şube", "city": "İstanbul", "district": "Pendik", "address": "Doğu Mah. 23 Nisan Cad. No:62/A PENDİK / İSTANBUL", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=40.879640,29.234510", "lat": 40.87964, "lng": 29.23451, "radius": 30.0, "wifi": "ALBAYRAK_27_WIFI", "w": 0.01585},
        {"id": 28, "code": "ŞB-028", "name": "İstanbul / Sancaktepe Şube", "city": "İstanbul", "district": "Sancaktepe", "address": "Meclis Mah. Ankara Cad. No:42 SANCAKTEPE / İSTANBUL", "phone": "0216 912 25 34", "googleMapUrl": "https://maps.app.goo.gl/ohWhCN9QRbiwMtPM8", "lat": 41.00215, "lng": 29.23164, "radius": 30.0, "wifi": "ALBAYRAK_28_WIFI", "w": 0.01585},
        {"id": 29, "code": "ŞB-029", "name": "İstanbul / Sultangazi Şube", "city": "İstanbul", "district": "Sultangazi", "address": "İsmetpaşa Mah. 48/1 Sok. 645-651/3B SULTANGAZİ / İSTANBUL", "phone": "0212 912 06 34", "googleMapUrl": "https://maps.app.goo.gl/YmcJceYHJVSnVPp79", "lat": 41.10432, "lng": 28.86145, "radius": 30.0, "wifi": "ALBAYRAK_29_WIFI", "w": 0.01585},
        {"id": 30, "code": "ŞB-030", "name": "İstanbul / Ümraniye Şube", "city": "İstanbul", "district": "Ümraniye", "address": "İstiklal Mah. Alemdağ Cad. No:192 ÜMRANİYE / İSTANBUL", "phone": "0216 912 00 34", "googleMapUrl": "https://maps.app.goo.gl/eogiwu45xuBFBGXr8", "lat": 41.02563, "lng": 29.09632, "radius": 30.0, "wifi": "ALBAYRAK_30_WIFI", "w": 0.01585},
        {"id": 31, "code": "ŞB-031", "name": "İstanbul / Üsküdar Şube", "city": "İstanbul", "district": "Üsküdar", "address": "Mimar Sinan Mh. Selmanı Pak Cd. No:28 ÜSKÜDAR / İSTANBUL", "phone": "0216 912 02 34", "googleMapUrl": "https://maps.app.goo.gl/KUvyc6fUUdZyzX9J6", "lat": 41.02384, "lng": 29.01521, "radius": 30.0, "wifi": "ALBAYRAK_31_WIFI", "w": 0.01585},
        {"id": 32, "code": "ŞB-032", "name": "İstanbul / Zeytinburnu Şube", "city": "İstanbul", "district": "Zeytinburnu", "address": "Gökalp Mah. Prof. Muammer Aksoy Caddesi Erlüks İş Merkezi No:77 A ZEYTİNBURNU / İSTANBUL", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=40.994120,28.904510", "lat": 40.99412, "lng": 28.90451, "radius": 30.0, "wifi": "ALBAYRAK_32_WIFI", "w": 0.01585},
        {"id": 33, "code": "ŞB-033", "name": "İzmir / Karabağlar Şube", "city": "İzmir", "district": "Karabağlar", "address": "Aşık Veysel Mah. Yeşillik Cad. No:437-441 KARABAĞLAR / İZMİR", "phone": "0232 218 18 35", "googleMapUrl": "https://maps.app.goo.gl/SvNa62tAJd4ZJj9P9", "lat": 38.37854, "lng": 27.13512, "radius": 30.0, "wifi": "ALBAYRAK_33_WIFI", "w": 0.01585},
        {"id": 34, "code": "ŞB-034", "name": "İzmir / Konak Şube", "city": "İzmir", "district": "Konak", "address": "Akdeniz Mah. Fevzipaşa Bulvarı 61/A Altın Asır İş Hanı KONAK / İZMİR", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=38.423710,27.138420", "lat": 38.42371, "lng": 27.13842, "radius": 30.0, "wifi": "ALBAYRAK_34_WIFI", "w": 0.01585},
        {"id": 35, "code": "ŞB-035", "name": "Kahramanmaraş / Dulkadiroğlu Şube (Yakında Hizmetinizde)", "city": "Kahramanmaraş", "district": "Dulkadiroğlu  (Yakında Hizmetinizde)", "address": "Menderes Mh. Trabzon Blv. Dış Kapı No:53/1A-53/1B DULKADİROĞLU / KAHRAMANMARAŞ", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=37.575210,36.937140", "lat": 37.57521, "lng": 36.93714, "radius": 30.0, "wifi": "ALBAYRAK_35_WIFI", "w": 0.01585},
        {"id": 36, "code": "ŞB-036", "name": "Kayseri / Kocasinan Şube", "city": "Kayseri", "district": "Kocasinan", "address": "Gevher Nesibe Mahallesi İstasyon Cad. No:31/B KOCASİNAN / KAYSERİ", "phone": "0352 203 00 38", "googleMapUrl": "https://maps.app.goo.gl/M2ZfzcKtF5uKS38W9", "lat": 38.72485, "lng": 35.48263, "radius": 30.0, "wifi": "ALBAYRAK_36_WIFI", "w": 0.01585},
        {"id": 37, "code": "ŞB-037", "name": "Kocaeli / Gebze Merkez Şube", "city": "Kocaeli", "district": "Gebze Merkez", "address": "Hacıhalil Mah. 1215 Sok. No:1/GEBZE / KOCAELİ", "phone": "0262 302 00 41", "googleMapUrl": "https://maps.app.goo.gl/2wj4dGxjBiYXCka77", "lat": 40.79954, "lng": 29.43121, "radius": 30.0, "wifi": "ALBAYRAK_37_WIFI", "w": 0.01585},
        {"id": 38, "code": "ŞB-038", "name": "Kocaeli / İzmit Şube (Yakında Hizmetinizde)", "city": "Kocaeli", "district": "İzmit  (Yakında Hizmetinizde)", "address": "Karabaş Mh. Cumhuriyet Blv. No:149/A İzmit / KOCAELİ", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=40.765420,29.940810", "lat": 40.76542, "lng": 29.94081, "radius": 30.0, "wifi": "ALBAYRAK_38_WIFI", "w": 0.01585},
        {"id": 39, "code": "ŞB-039", "name": "Konya / Nalçacı Şube", "city": "Konya", "district": "Nalçacı", "address": "Musalla Bağları Mah. Telgrafçı Hamdi Bey Cad. No:14/B SELÇUKLU / KONYA", "phone": "0332 344 01 42", "googleMapUrl": "https://maps.app.goo.gl/iNNiNpq8ajpLWf3a8", "lat": 37.88142, "lng": 32.49215, "radius": 30.0, "wifi": "ALBAYRAK_39_WIFI", "w": 0.01585},
        {"id": 40, "code": "ŞB-040", "name": "Kütahya / Merkez Şube (Yakında Hizmetinizde)", "city": "Kütahya", "district": "Merkez  (Yakında Hizmetinizde)", "address": "Pirler Mh. Adnan Menderes Blv. No:52I MERKEZ / KÜTAHYA", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=39.420140,29.985620", "lat": 39.42014, "lng": 29.98562, "radius": 30.0, "wifi": "ALBAYRAK_40_WIFI", "w": 0.01585},
        {"id": 41, "code": "ŞB-041", "name": "Malatya / Battalgazi Şube", "city": "Malatya", "district": "Battalgazi", "address": "Şifa Mah. İnönü Cad. Sıtmapınarı Mevki No:171/B BATTALGAZİ / MALATYA", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=38.351420,38.321540", "lat": 38.35142, "lng": 38.32154, "radius": 30.0, "wifi": "ALBAYRAK_41_WIFI", "w": 0.01585},
        {"id": 42, "code": "ŞB-042", "name": "Manisa / Şehzadeler Şube (Yakında Hizmetinizde)", "city": "Manisa", "district": "Şehzadeler  (Yakında Hizmetinizde)", "address": "1nci Anafartalar Mh. Mustafa Kemal Paşa Cd. Kamil Menteş Apt. No:34A Şehzadeler / MANİSA", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=38.614230,27.429510", "lat": 38.61423, "lng": 27.42951, "radius": 30.0, "wifi": "ALBAYRAK_42_WIFI", "w": 0.01585},
        {"id": 43, "code": "ŞB-043", "name": "Mardin / Artuklu Şube", "city": "Mardin", "district": "Artuklu", "address": "13 Mart Mah. Vali Ozan Cad. Dış Kapı No: 80/A ARTUKLU / MARDİN", "phone": "444 88 61", "googleMapUrl": "https://maps.app.goo.gl/j16BagqMGenRuGKJ7", "lat": 37.32145, "lng": 40.72451, "radius": 30.0, "wifi": "ALBAYRAK_43_WIFI", "w": 0.01585},
        {"id": 44, "code": "ŞB-044", "name": "Mersin / Yenişehir Şube (Yakında Hizmetinizde)", "city": "Mersin", "district": "Yenişehir  (Yakında Hizmetinizde)", "address": "İnönü Mah. Gazi Mustafa Kemal Blv. Büyük Apt.No:415B YENİŞEHİR / MERSİN", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=36.784520,34.596410", "lat": 36.78452, "lng": 34.59641, "radius": 30.0, "wifi": "ALBAYRAK_44_WIFI", "w": 0.01585},
        {"id": 45, "code": "ŞB-045", "name": "Ordu / Altınordu Şube", "city": "Ordu", "district": "Altınordu", "address": "Şarkiye Mah. Süleyman Felek Cad. No:52 ALTINORDU / ORDU", "phone": "0452 212 45 89", "googleMapUrl": "https://maps.app.goo.gl/qU6AkCQPiKN73NU17", "lat": 40.98392, "lng": 37.87891, "radius": 30.0, "wifi": "ALBAYRAK_45_WIFI", "w": 0.01585},
        {"id": 46, "code": "ŞB-046", "name": "Osmaniye / Merkez Şube (Yakında Hizmetinizde)", "city": "Osmaniye", "district": "Merkez  (Yakında Hizmetinizde)", "address": "Mehmet Akif Ersoy Mh. Atatürk Cd. No:397/A Merkez/OSMANİYE", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=37.074520,36.247810", "lat": 37.07452, "lng": 36.24781, "radius": 30.0, "wifi": "ALBAYRAK_46_WIFI", "w": 0.01585},
        {"id": 47, "code": "ŞB-047", "name": "Sakarya / Adapazarı Şube", "city": "Sakarya", "district": "Adapazarı", "address": "Semerciler Mah. Çark Cad. Dış Kapı No: 95 ADAPAZARI / SAKARYA", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=40.778420,30.401240", "lat": 40.77842, "lng": 30.40124, "radius": 30.0, "wifi": "ALBAYRAK_47_WIFI", "w": 0.01585},
        {"id": 48, "code": "ŞB-048", "name": "Samsun / İlkadım Şube", "city": "Samsun", "district": "İlkadım", "address": "Kale Mah. Kazım Paşa Cad. NO:40/1 A Blok Fatih Temiz İş Merkezi İLKADIM / SAMSUN", "phone": "0362 313 02 55", "googleMapUrl": "https://maps.app.goo.gl/DqecKYWnMCTvyF7i8", "lat": 41.28954, "lng": 36.33241, "radius": 30.0, "wifi": "ALBAYRAK_48_WIFI", "w": 0.01585},
        {"id": 49, "code": "ŞB-049", "name": "Sivas / Merkez Şube", "city": "Sivas", "district": "Merkez", "address": "Eskikale Mah. 13-2 Sokak Dış kapı No: 5/A - MERKEZ / SİVAS", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=39.748520,37.015420", "lat": 39.74852, "lng": 37.01542, "radius": 30.0, "wifi": "ALBAYRAK_49_WIFI", "w": 0.01585},
        {"id": 50, "code": "ŞB-050", "name": "Şanlıurfa / Karaköprü Şube", "city": "Şanlıurfa", "district": "Karaköprü", "address": "Batıkent Mah. Gap Bulvarı No:125/D KARAKÖPRÜ / ŞANLIURFA", "phone": "0414 503 30 36", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=37.194520,38.791240", "lat": 37.19452, "lng": 38.79124, "radius": 30.0, "wifi": "ALBAYRAK_50_WIFI", "w": 0.01585},
        {"id": 51, "code": "ŞB-051", "name": "Tokat / Merkez Şube", "city": "Tokat", "district": "Merkez", "address": "Kabe -i Mescid Mah. Gazi Osman Paşa Bulv. No:174A Merkez / TOKAT", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=40.316840,36.554210", "lat": 40.31684, "lng": 36.55421, "radius": 30.0, "wifi": "ALBAYRAK_51_WIFI", "w": 0.01585},
        {"id": 52, "code": "ŞB-052", "name": "Trabzon / Ortahisar Şube", "city": "Trabzon", "district": "Ortahisar", "address": "Cumhuriyet Mah. Yavuz Selim Bulvarı No:173/A ORTAHİSAR / TRABZON", "phone": "0462 350 01 61", "googleMapUrl": "https://maps.app.goo.gl/ySnYcCD3XiZDMHAg7", "lat": 41.00542, "lng": 39.72681, "radius": 30.0, "wifi": "ALBAYRAK_52_WIFI", "w": 0.01585},
        {"id": 53, "code": "ŞB-053", "name": "Van / İpekyolu Şube", "city": "Van", "district": "İpekyolu", "address": "Halilağa Mah. Kazım Karabekir Bulv. No: 115/A İPEKYOLU / VAN", "phone": "444 88 61", "googleMapUrl": "https://maps.app.goo.gl/RNzgJbKLukgxzxJNA", "lat": 38.49852, "lng": 43.38341, "radius": 30.0, "wifi": "ALBAYRAK_53_WIFI", "w": 0.01585},
        {"id": 54, "code": "ŞB-054", "name": "Yalova / Merkez Şube (Yakında Hizmetinizde)", "city": "Yalova", "district": "Merkez  (Yakında Hizmetinizde)", "address": "Süleyman Bey Mh. Sefabey Cd. No:26/A Merkez / YALOVA", "phone": "444 88 61", "googleMapUrl": "https://www.google.com/maps/search/?api=1&query=40.656420,29.274510", "lat": 40.65642, "lng": 29.27451, "radius": 30.0, "wifi": "ALBAYRAK_54_WIFI", "w": 0.01585}
    ];
    const DEPTS = ['Bireysel Finansman', 'Taşıt Finansmanı', 'Konut Finansmanı', 'Kurumsal Finansman', 'Şube Operasyon', 'Bilgi Teknolojileri', 'Mali İşler', 'İnsan Kaynakları', 'Hukuk ve Uyum'];
    const TITLES = ['Finans Uzmanı', 'Müşteri Temsilcisi', 'Operasyon Uzmanı', 'Takım Lideri', 'Uzman Yardımcısı', 'Şube Müdür Yrd.', 'Analist'];
    const FN = ['Ahmet', 'Mehmet', 'Mustafa', 'Ali', 'Hüseyin', 'Hasan', 'İbrahim', 'Ömer', 'Yusuf', 'Emre', 'Burak', 'Murat', 'Serkan', 'Hakan', 'Caner', 'Tolga', 'Onur', 'Kerem', 'Barış', 'Eren', 'Berk', 'Kaan', 'Arda', 'Alper', 'Cem', 'Deniz', 'Ayşe', 'Fatma', 'Emine', 'Hatice', 'Zeynep', 'Elif', 'Meryem', 'Zehra', 'Merve', 'Büşra', 'Esra', 'Gamze', 'Seda', 'Gizem', 'Tuğba', 'Kübra', 'Ebru', 'Betül', 'Yasemin', 'Duygu', 'Pelin', 'Damla', 'Selin', 'Ece', 'İrem', 'Başak', 'Melis', 'Ceren'];
    const LN = ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Yıldız', 'Yıldırım', 'Öztürk', 'Aydın', 'Özdemir', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özkan', 'Şimşek', 'Polat', 'Korkmaz', 'Çakır', 'Erdoğan', 'Yavuz', 'Güneş', 'Bozkurt', 'Ünal', 'Acar', 'Tekin'];
    const DOW_NAMES = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    const DOW_SHORT = ['', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

    const pick = (arr, r) => arr[Math.floor((r || rnd)() * arr.length)];
    const wpick = () => { let x = rnd(), a = 0; for (const b of BRANCHES) { a += b.w; if (x <= a) return b; } return BRANCHES[0]; };

    const hhmm = m => A.pad(Math.floor(m / 60)) + ':' + A.pad(Math.round(m % 60));
    const fmtDurMin = min => {
        const sign = min < 0 ? '-' : (min > 0 ? '+' : '');
        const abs = Math.abs(Math.round(min));
        const h = Math.floor(abs / 60);
        const m = abs % 60;
        if (h === 0) return `${sign}${m} dk`;
        if (m === 0) return `${sign}${h} sa`;
        return `${sign}${h} sa ${m} dk`;
    };

    /* ---- Son 60 iş günü (tarih + oranlar) ---- */
    const DAYS = [];
    (function () {
        const d = new Date(2026, 9, 20); // 20.10.2026 referans bugünü
        let guard = 0, out = [];
        while (out.length < 60 && guard++ < 140) {
            const w = d.getDay();
            if (w !== 0 && w !== 6) out.push(new Date(d));
            d.setDate(d.getDate() - 1);
        }
        out.reverse().forEach((dt, i) => {
            const dow = dt.getDay();
            const yyyy = dt.getFullYear();
            const mm = A.pad(dt.getMonth() + 1);
            const dd = A.pad(dt.getDate());
            const iso = `${yyyy}-${mm}-${dd}`;
            const label = `${dd}.${mm}`;
            const fullDate = `${dd}.${mm}.${yyyy}`;
            const r = A.rng(yyyy * 400 + (dt.getMonth() + 1) * 40 + dt.getDate());
            const base = 0.925 + 0.012 * Math.sin(i / 4) - (dow === 1 ? 0.03 : dow === 5 ? 0.018 : 0) + (r() - .5) * 0.02;
            const late = A.clamp(1 - base - 0.045 - 0.012, 0.015, 0.14), absent = 0.014 + r() * 0.014, leave = 0.028 + r() * 0.02;
            DAYS.push({
                idx: i,
                dayIndex: i,
                iso,
                label,
                fullDate,
                dow,
                dowName: DOW_NAMES[dow],
                dowShort: DOW_SHORT[dow],
                onTime: 1 - late - absent - leave,
                late,
                absent,
                leave,
                lateMin: 14 + r() * 12,
                overtimeH: 28 + r() * 40 + (dow === 5 ? -10 : 0),
                workH: 8.1 + r() * 0.6
            });
        });
    })();

    /* ---- Personel (500 kişi + kişisel çalışma profili) ---- */
    const EMPLOYEES = [];
    for (let i = 0; i < 500; i++) {
        const br = wpick(), r = rnd();
        let status = 'PRESENT', inMin = null, late = 0, outMin = null, otMin = 0;
        if (r < 0.068) {
            status = 'LATE';
            inMin = 8 * 60 + 35 + 1 + Math.floor(rnd() * 52);
            late = inMin - (8 * 60 + 35);
            outMin = 17 * 60 + 30 + Math.floor(rnd() * 45);
            otMin = Math.max(0, outMin - (17 * 60 + 30));
        } else if (r < 0.10) {
            status = 'LEAVE';
        } else if (r < 0.122) {
            status = 'ABSENT';
        } else {
            inMin = 8 * 60 + 5 + Math.floor((rnd() + rnd()) / 2 * 52);
            outMin = 17 * 60 + 30 + Math.floor(rnd() * 115);
            otMin = Math.max(0, outMin - (17 * 60 + 30));
        }
        const name = FN[(i * 7 + Math.floor(rnd() * 5)) % FN.length] + ' ' + LN[(i * 11 + 3) % LN.length];
        // Her personelin karakteristik "en çok geç kaldığı gün" ve "en çok mesai yaptığı gün" eğilimi
        const proneLateDow = 1 + ((i * 3) % 5); // 1=Pzt..5=Cum
        const proneOtDow = 1 + ((i * 2 + 2) % 5);
        const workHabitBias = ((i * 17) % 100) / 100; // >0.55 yüksek mesai eğilimli, <0.22 geç kalma eğilimli

        EMPLOYEES.push({
            id: 1001 + i,
            sicil: 'FN-' + (1001 + i),
            name,
            dept: DEPTS[i % DEPTS.length],
            title: pick(TITLES),
            branch: br.code,
            status,
            inMin,
            outMin,
            checkIn: inMin == null ? null : hhmm(inMin),
            checkOut: outMin == null ? null : hhmm(outMin),
            lateMin: late,
            overtimeMin: otMin,
            dist: status === 'PRESENT' || status === 'LATE' ? +(2 + rnd() * 24).toFixed(1) : null,
            tone: 1 + (i % 5),
            proneLateDow,
            proneOtDow,
            workHabitBias
        });
    }

    /* ---- Tarih Aralığı Çözümleyici ---- */
    function resolveDays(opts) {
        const o = opts || {};
        if (o.fromDate || o.toDate) {
            const from = o.fromDate || DAYS[0].iso;
            const to = o.toDate || DAYS[DAYS.length - 1].iso;
            const filtered = DAYS.filter(d => d.iso >= from && d.iso <= to);
            if (filtered.length > 0) return filtered;
        }
        const n = Math.max(1, Math.min(DAYS.length, +(o.range || 30)));
        return DAYS.slice(-n);
    }

    /* ---- Kişi Bazlı Derin Analiz Motoru (Seçili Süre / Tarih Aralığına Göre) ---- */
    const analyticsCache = new Map();

    function empAnalytics(empId, opts) {
        const e = EMPLOYEES.find(x => x.id === empId) || EMPLOYEES[0];
        const selDays = resolveDays(opts);
        const sh = shiftOf(e);
        const lateTh = sh.lateThreshold;
        // Gece vardiyası (bitiş < başlangıç) gece yarısını aşar: çıkış dakikaları +1440 taşınır
        const overnight = sh.endMin <= sh.startMin;
        const endAbs = overnight ? sh.endMin + 1440 : sh.endMin;
        const hhmmDay = m => hhmm(((Math.round(m) % 1440) + 1440) % 1440);
        const cacheKey = `${e.id}_${selDays[0].iso}_${selDays[selDays.length - 1].iso}_${e.status}_${e.lateMin}_${e.lateExcusedMin || 0}_${sh.id || 0}_${sh.startMin}_${sh.graceMin}_${sh.endMin}`;
        if (analyticsCache.has(cacheKey)) return analyticsCache.get(cacheKey);

        const logs = [];
        const byDow = {
            1: { dow: 1, name: 'Pazartesi', short: 'Pzt', lateMin: 0, lateCount: 0, otMin: 0, otCount: 0, workMin: 0, days: 0, inSum: 0, outSum: 0 },
            2: { dow: 2, name: 'Salı', short: 'Sal', lateMin: 0, lateCount: 0, otMin: 0, otCount: 0, workMin: 0, days: 0, inSum: 0, outSum: 0 },
            3: { dow: 3, name: 'Çarşamba', short: 'Çar', lateMin: 0, lateCount: 0, otMin: 0, otCount: 0, workMin: 0, days: 0, inSum: 0, outSum: 0 },
            4: { dow: 4, name: 'Perşembe', short: 'Per', lateMin: 0, lateCount: 0, otMin: 0, otCount: 0, workMin: 0, days: 0, inSum: 0, outSum: 0 },
            5: { dow: 5, name: 'Cuma', short: 'Cum', lateMin: 0, lateCount: 0, otMin: 0, otCount: 0, workMin: 0, days: 0, inSum: 0, outSum: 0 }
        };

        let totalLateMin = 0, lateDaysCount = 0;
        let totalOvertimeMin = 0, otDaysCount = 0;
        let presentDays = 0, leaveDays = 0, absentDays = 0;
        let totalWorkMin = 0;
        let inMinSum = 0, outMinSum = 0, activeDays = 0;
        let earliestIn = 9999, latestIn = 0, latestOut = 0;
        let distSum = 0, maxDist = 0, geofenceOk = 0;
        let peakLateRec = null, peakOtRec = null;

        selDays.forEach((day, idx) => {
            const isToday = day.iso === DAYS[DAYS.length - 1].iso;
            const r = A.rng(e.id * 997 + day.idx * 31);
            let st = 'PRESENT', inM = lateTh - 5, outM = sh.endMin + 5, lMin = 0, oMin = 0, dist = +(3.2 + r() * 18).toFixed(1);

            if (isToday) {
                st = e.status;
                if (st === 'PRESENT' || st === 'LATE') {
                    inM = e.inMin || (lateTh - 4);
                    // Vardiya şablonu değiştirildiğinde analiz anında yansır; onaylı saatlik izin
                    // mahsubu sunucuda yapıldığı için sunucu değerinden büyük sonuç üretilmez.
                    const lateExcused = e.lateExcusedMin || 0;
                    const candLate = Math.max(0, inM - lateTh - lateExcused);
                    lMin = e.lateMin ? Math.min(candLate, Math.max(0, e.lateMin - lateExcused)) : 0;
                    // Bugünün ek mesaisi veya beklenen çıkış saati
                    const otChance = r() + (day.dow === e.proneOtDow ? 0.35 : 0) + (e.workHabitBias > 0.55 ? 0.28 : 0);
                    if (otChance > 0.68) {
                        oMin = 20 + Math.floor(r() * 85) + (e.workHabitBias > 0.7 ? 25 : 0);
                        outM = endAbs + oMin;
                    } else {
                        oMin = e.overtimeMin || 0;
                        outM = endAbs + 2 + Math.floor(r() * 24) + oMin;
                    }
                    dist = e.dist != null ? e.dist : dist;
                }
            } else {
                const roll = r();
                const lateThreshold = 0.08 + (day.dow === e.proneLateDow ? 0.16 : 0) + (e.workHabitBias < 0.25 ? 0.14 : 0);
                if (roll < 0.025) {
                    st = 'LEAVE';
                } else if (roll < 0.036 && e.workHabitBias < 0.3) {
                    st = 'ABSENT';
                } else if (roll < 0.036 + lateThreshold) {
                    st = 'LATE';
                    lMin = 6 + Math.floor(r() * 38) + (day.dow === e.proneLateDow ? 11 : 0) + (e.workHabitBias < 0.2 ? 14 : 0);
                    inM = lateTh + lMin;
                } else {
                    st = 'PRESENT';
                    inM = lateTh - 24 + Math.floor(r() * 24);
                }

                if (st === 'PRESENT' || st === 'LATE') {
                    const otRoll = r() + (day.dow === e.proneOtDow ? 0.32 : 0) + (e.workHabitBias > 0.5 ? 0.25 : -0.1);
                    if (otRoll > 0.62) {
                        oMin = 18 + Math.floor(r() * 78) + (day.dow === e.proneOtDow ? 22 : 0) + (e.workHabitBias > 0.75 ? 30 : 0);
                        outM = endAbs + oMin;
                    } else {
                        oMin = 0;
                        outM = endAbs + Math.floor(r() * 25);
                    }
                }
            }

            if (st === 'LEAVE') {
                leaveDays++;
                logs.push({
                    iso: day.iso, label: day.label, fullDate: day.fullDate, dow: day.dow, dowName: day.dowName, dowShort: day.dowShort,
                    status: st, checkIn: '—', checkOut: '—', lateMin: 0, overtimeMin: 0, netMin: 0, workMin: 0, workH: 0, dist: null
                });
            } else if (st === 'ABSENT') {
                absentDays++;
                logs.push({
                    iso: day.iso, label: day.label, fullDate: day.fullDate, dow: day.dow, dowName: day.dowName, dowShort: day.dowShort,
                    status: st, checkIn: '—', checkOut: '—', lateMin: 0, overtimeMin: 0, netMin: 0, workMin: 0, workH: 0, dist: null
                });
            } else {
                activeDays++;
                if (st === 'PRESENT') presentDays++; else lateDaysCount++;
                const wMin = Math.max(240, outM - inM - sh.breakMin); // vardiya şablonundaki mola süresi
                const netM = oMin - lMin;

                totalLateMin += lMin;
                if (oMin > 0) {
                    totalOvertimeMin += oMin;
                    otDaysCount++;
                }
                totalWorkMin += wMin;
                inMinSum += inM;
                outMinSum += outM;
                if (inM < earliestIn) earliestIn = inM;
                if (inM > latestIn) latestIn = inM;
                if (outM > latestOut) latestOut = outM;
                distSum += dist;
                if (dist > maxDist) maxDist = dist;
                if (dist <= 30) geofenceOk++;

                const dBucket = byDow[day.dow];
                if (dBucket) {
                    dBucket.days++;
                    dBucket.lateMin += lMin;
                    if (lMin > 0) dBucket.lateCount++;
                    dBucket.otMin += oMin;
                    if (oMin > 0) dBucket.otCount++;
                    dBucket.workMin += wMin;
                    dBucket.inSum += inM;
                    dBucket.outSum += outM;
                }

                const rec = {
                    iso: day.iso,
                    label: day.label,
                    fullDate: day.fullDate,
                    dow: day.dow,
                    dowName: day.dowName,
                    dowShort: day.dowShort,
                    status: st,
                    checkIn: hhmm(inM),
                    checkOut: hhmmDay(outM),
                    lateMin: lMin,
                    overtimeMin: oMin,
                    netMin: netM,
                    workMin: wMin,
                    workH: +(wMin / 60).toFixed(1),
                    dist
                };
                if (!peakLateRec || lMin > peakLateRec.lateMin) peakLateRec = rec;
                if (!peakOtRec || oMin > peakOtRec.overtimeMin) peakOtRec = rec;
                logs.push(rec);
            }
        });

        const weekdayList = [1, 2, 3, 4, 5].map(d => {
            const b = byDow[d];
            const cnt = b.days || 1;
            return {
                dow: d,
                name: b.name,
                dowName: b.name,
                short: b.short,
                dowShort: b.short,
                days: b.days,
                attended: b.days,
                lateMin: b.lateMin,
                totalLateMin: b.lateMin,
                lateCount: b.lateCount,
                avgLateMin: b.lateCount ? Math.round(b.lateMin / b.lateCount) : 0,
                otMin: b.otMin,
                totalOvertimeMin: b.otMin,
                otCount: b.otCount,
                avgOtMin: b.otCount ? Math.round(b.otMin / b.otCount) : 0,
                avgOvertimeMin: b.otCount ? Math.round(b.otMin / b.otCount) : 0,
                netMin: b.otMin - b.lateMin,
                avgIn: b.days ? hhmm(Math.round(b.inSum / cnt)) : hhmm(lateTh - 5),
                avgOut: b.days ? hhmmDay(b.outSum / cnt) : hhmm(sh.endMin + 5),
                avgWorkH: b.days ? +(b.workMin / cnt / 60).toFixed(1) : 8.5
            };
        });

        const mostLateDay = [...weekdayList].sort((a, b) => (b.lateMin - a.lateMin) || (b.lateCount - a.lateCount))[0];
        const mostOvertimeDay = [...weekdayList].sort((a, b) => (b.otMin - a.otMin) || (b.otCount - a.otCount))[0];
        const bestNetDay = [...weekdayList].sort((a, b) => b.netMin - a.netMin)[0];

        const netBalanceMin = totalOvertimeMin - totalLateMin;
        const onTimePct = activeDays > 0 ? +(presentDays / activeDays * 100).toFixed(1) : 95.0;

        const res = {
            empId: e.id,
            emp: e,
            periodLabel: `${selDays[0].fullDate} – ${selDays[selDays.length - 1].fullDate}`,
            totalDays: selDays.length,
            activeDays,
            attendedDays: activeDays,
            presentDays,
            lateDaysCount,
            lateDays: lateDaysCount,
            otDaysCount,
            overtimeDays: otDaysCount,
            leaveDays,
            absentDays,
            onTimePct,
            totalLateMin,
            totalLateFmt: fmtDurMin(-totalLateMin),
            totalOvertimeMin,
            totalOvertimeFmt: fmtDurMin(totalOvertimeMin),
            netBalanceMin,
            netBalanceFmt: fmtDurMin(netBalanceMin),
            avgWorkH: activeDays ? +(totalWorkMin / activeDays / 60).toFixed(1) : 8.5,
            totalWorkH: +(totalWorkMin / 60).toFixed(1),
            avgCheckIn: activeDays ? hhmm(Math.round(inMinSum / activeDays)) : '08:26',
            avgCheckOut: activeDays ? hhmmDay(outMinSum / activeDays) : '17:42',
            earliestCheckIn: earliestIn < 9999 ? hhmm(earliestIn) : '08:05',
            latestCheckIn: latestIn > 0 ? hhmm(latestIn) : '08:55',
            latestCheckOut: latestOut > 0 ? hhmmDay(latestOut) : '18:30',
            avgDist: activeDays ? +(distSum / activeDays).toFixed(1) : 5.4,
            maxDist: maxDist > 0 ? maxDist : 14.2,
            geofenceRate: activeDays ? +(geofenceOk / activeDays * 100).toFixed(1) : 100,
            mostLateDay,
            mostOvertimeDay,
            bestNetDay,
            peakLateRec,
            peakOtRec,
            weekdayList,
            logs
        };

        if (analyticsCache.size >= 2500) {
            const oldestKey = analyticsCache.keys().next().value;
            if (oldestKey !== undefined) analyticsCache.delete(oldestKey);
        }
        analyticsCache.set(cacheKey, res);
        return res;
    }

    /* ---- Tüm Personeller İçin Sıralama / Lig Hesaplayıcı (Memoized) ---- */
    const leaderboardCache = new Map();

    function computeLeaderboards(empList, opts) {
        const src = empList || EMPLOYEES;
        const selDays = resolveDays(opts);
        const firstId = src.length ? src[0].id : 0;
        const lastId = src.length ? src[src.length - 1].id : 0;
        const shiftSig = SHIFTS.map(s => `${s.id}.${s.startMin}.${s.graceMin}.${s.endMin}.${s.breakMin}`).join('|');
        const assignSig = src.reduce((a, e) => a + ((e.shiftId || 0) * ((e.id % 97) + 1)), 0);
        const lbKey = `${src.length}_${firstId}_${lastId}_${selDays[0].iso}_${selDays[selDays.length - 1].iso}_${EMPLOYEES.length}_${shiftSig}_${assignSig}`;
        if (leaderboardCache.has(lbKey)) return leaderboardCache.get(lbKey);

        const list = src.map(e => empAnalytics(e.id, opts));
        const topOvertime = [...list].sort((a, b) => (b.totalOvertimeMin - a.totalOvertimeMin) || (b.otDaysCount - a.otDaysCount));
        const bestNet = [...list].sort((a, b) => (b.netBalanceMin - a.netBalanceMin) || (b.onTimePct - a.onTimePct));
        const worstNet = [...list].sort((a, b) => (a.netBalanceMin - b.netBalanceMin) || (b.totalLateMin - a.totalLateMin));
        const mostLate = [...list].sort((a, b) => (b.totalLateMin - a.totalLateMin) || (b.lateDaysCount - a.lateDaysCount));
        const out = { all: list, topOvertime, bestNet, worstNet, mostLate };

        if (leaderboardCache.size >= 60) {
            const oldestKey = leaderboardCache.keys().next().value;
            if (oldestKey !== undefined) leaderboardCache.delete(oldestKey);
        }
        leaderboardCache.set(lbKey, out);
        return out;
    }

    /* ---- İzin / mazeret talepleri ---- */
    const LEAVE_TYPES = ['Saatlik izin', 'Yıllık izin', 'Mazeret izni', 'Saha görevi', 'Sağlık raporu'];
    const LEAVES = [];
    const LATE_REASONS = [];
    (function () {
        const r = A.rng(77), st = ['pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'approved', 'approved', 'approved', 'approved', 'approved', 'approved', 'approved', 'approved', 'rejected', 'rejected', 'rejected', 'rejected'];
        const reasons = ['Ailevi nedenlerle', 'Hastane randevusu', 'Müşteri ziyareti (saha)', 'Tapu işlemleri', 'Çocuğun okul toplantısı', 'Dinlenme izni', 'Doktor raporu ekte', 'Eğitim programı'];
        st.forEach((s, i) => {
            const e = EMPLOYEES[Math.floor(r() * 60) + 3], t = LEAVE_TYPES[Math.floor(r() * LEAVE_TYPES.length)], days = t === 'Saatlik izin' ? 0.2 : t === 'Yıllık izin' ? 2 + Math.floor(r() * 5) : t === 'Sağlık raporu' ? 1 + Math.floor(r() * 3) : 1;
            const d = new Date(2026, 9, 20); d.setDate(d.getDate() + Math.floor(r() * 9) - 2);
            LEAVES.push({ id: i + 1, empId: e.id, type: t, days, from: A.pad(d.getDate()) + '.' + A.pad(d.getMonth() + 1) + '.' + d.getFullYear(), reason: reasons[Math.floor(r() * reasons.length)], status: s, ago: (1 + Math.floor(r() * 46)) + ' sa önce' });
        });
    })();

    /* ---- BT: uyarılar, destek talepleri, cihazlar, denetim ---- */
    const ALERT_TYPES = { MOCK_GPS: 'Sahte konum (Mock GPS)', GEOFENCE: '30 m sınır aşımı', DEVICE: 'Farklı cihaz', ROOT: 'Kurumsal Wi-Fi / Root ihlali', BRUTE: 'Mesai dışı / hatalı giriş' };
    const ALERTS = [];
    (function () {
        const r = A.rng(31), kinds = ['MOCK_GPS', 'GEOFENCE', 'DEVICE', 'GEOFENCE', 'BRUTE', 'ROOT', 'GEOFENCE', 'MOCK_GPS', 'DEVICE', 'GEOFENCE', 'BRUTE', 'GEOFENCE', 'DEVICE', 'ROOT'];
        const sev = { MOCK_GPS: 'HIGH', ROOT: 'HIGH', BRUTE: 'MED', DEVICE: 'MED', GEOFENCE: 'LOW' };
        kinds.forEach((k, i) => {
            const e = EMPLOYEES[Math.floor(r() * 120) + 10];
            ALERTS.push({ id: i + 1, type: k, sev: sev[k], empId: e.id, branch: e.branch, ago: (i + 1) * 17 + 'dk', resolved: i > 9, dist: k === 'GEOFENCE' ? Math.round(34 + r() * 260) : null });
        });
    })();

    const TICKET_TYPES = { FORGOT: 'Parolamı unuttum', LOCKED: 'Hesap kilitli', DEVICE: 'Cihaz değişikliği', ERROR: 'Uygulama hatası' };
    const TICKETS = [];
    (function () {
        const r = A.rng(5), kinds = ['FORGOT', 'LOCKED', 'FORGOT', 'DEVICE', 'ERROR', 'FORGOT', 'LOCKED', 'DEVICE', 'FORGOT', 'ERROR', 'FORGOT', 'LOCKED'];
        const notes = { FORGOT: 'Parolamı hatırlamıyorum, giriş yapamıyorum.', LOCKED: '5 hatalı denemeden sonra hesap kilitlendi.', DEVICE: 'Telefonumu yeniledim, yeni cihazı eşlemek istiyorum.', ERROR: 'Giriş butonuna basınca konum alınamıyor hatası çıkıyor.' };
        kinds.forEach((k, i) => {
            const e = EMPLOYEES[Math.floor(r() * 200) + 20];
            TICKETS.push({ id: 'TK-' + (2041 + i), type: k, empId: e.id, note: notes[k], status: i < 6 ? 'open' : i < 8 ? 'progress' : 'done', ago: (i * 23 + 6) + 'dk' });
        });
    })();

    const MODELS = ['Samsung Galaxy S24', 'Samsung Galaxy A55', 'Xiaomi Redmi Note 13', 'Google Pixel 8', 'Oppo Reno 11', 'Honor 200', 'Samsung Galaxy S23'];
    const DEVICES = [];
    (function () {
        const r = A.rng(900);
        for (let i = 0; i < 90; i++) {
            const e = EMPLOYEES[i * 5 + 2], v = r() < 0.78 ? '2.4.1' : r() < 0.7 ? '2.3.8' : '2.2.0', s = r();
            DEVICES.push({ id: 'DV-' + (7000 + i), empId: e.id, model: MODELS[Math.floor(r() * MODELS.length)], os: 'Android ' + (12 + Math.floor(r() * 3)), ver: v, seen: Math.floor(r() * 50) + 1, status: s < 0.88 ? 'BOUND' : s < 0.96 ? 'PENDING' : 'BLOCKED', mask: 'a' + Math.floor(r() * 9) + 'f…' + Math.floor(r() * 90 + 10) });
        }
    })();

    const AUDIT = [
        { t: '09:12', who: 'Murat Doğan', act: 'Geçici parola oluşturuldu', target: 'FN-1043', cat: 'ACCOUNT' },
        { t: '09:05', who: 'Murat Doğan', act: 'Cihaz eşlemesi sıfırlandı', target: 'DV-7012', cat: 'DEVICE' },
        { t: '08:41', who: 'Sistem', act: 'Sahte konum uyarısı üretildi', target: 'FN-1108', cat: 'SECURITY' },
        { t: '08:30', who: 'Zehra Yılmaz', act: 'İzin talebi onaylandı', target: 'LV-4', cat: 'HR' },
        { t: '08:02', who: 'Sistem', act: 'Gece yedeği tamamlandı', target: 'DB', cat: 'SYSTEM' },
        { t: 'Dün', who: 'Murat Doğan', act: 'Yeni şube geofence tanımlandı', target: 'BUR', cat: 'SYSTEM' }
    ];

    // Yeni işe başlayan, düzenlenen veya silinen personelleri localStorage üzerinden geri yükle
    function persistLocalState() {
        try {
            const custom = EMPLOYEES.filter(x => x.isNewHire);
            localStorage.setItem('atf_custom_employees', JSON.stringify(custom));
        } catch (_) {}
    }

    try {
        const deletedIds = JSON.parse(localStorage.getItem('atf_deleted_emp_ids') || '[]');
        if (Array.isArray(deletedIds) && deletedIds.length) {
            for (let i = EMPLOYEES.length - 1; i >= 0; i--) {
                if (deletedIds.includes(EMPLOYEES[i].id)) EMPLOYEES.splice(i, 1);
            }
        }
        const updatedMap = JSON.parse(localStorage.getItem('atf_updated_employees') || '{}');
        if (updatedMap && typeof updatedMap === 'object') {
            EMPLOYEES.forEach((e, idx) => {
                if (updatedMap[e.id]) {
                    EMPLOYEES[idx] = Object.assign({}, e, updatedMap[e.id]);
                }
            });
        }
        const savedEmps = JSON.parse(localStorage.getItem('atf_custom_employees') || '[]');
        if (Array.isArray(savedEmps)) {
            savedEmps.forEach(ce => {
                if (ce && ce.id && !EMPLOYEES.some(x => x.id === ce.id)) {
                    EMPLOYEES.unshift(ce);
                }
            });
        }
    } catch (_) {}

    // Lokal silme/güncelleme sonrası sahipsiz kalan referansları temizle
    syncEmployeeReferences();

    /* Personel kadrosu değiştiğinde (backend senkronizasyonu, yeni kayıt veya silme)
       izin / uyarı / destek talebi / cihaz kayıtlarındaki personel referanslarını
       güncel kadroya bağlar. Eşleşmeyen (sahipsiz) kayıtları temizler; böylece
       `emp(id)` çağrıları hiçbir zaman undefined dönüp arayüzü kilitlemez. */
    function syncEmployeeReferences(previousEmployees) {
        const validIds = new Set(EMPLOYEES.map(e => e.id));
        const idBySicil = new Map();
        EMPLOYEES.forEach(e => { if (e.sicil) idBySicil.set(e.sicil, e.id); });
        const oldById = new Map((previousEmployees || []).map(e => [e.id, e]));

        const resolveId = rec => {
            if (!rec) return null;
            if (validIds.has(rec.empId)) return rec.empId;
            const old = oldById.get(rec.empId);
            const mapped = old ? idBySicil.get(old.sicil) : null;
            return mapped != null ? mapped : null;
        };

        [LEAVES, ALERTS, TICKETS, DEVICES].forEach(list => {
            for (let i = list.length - 1; i >= 0; i--) {
                const nextId = resolveId(list[i]);
                if (nextId == null) list.splice(i, 1);
                else list[i].empId = nextId;
            }
        });
    }

    /* Backend kaydı lokal geçici ID'yi kalıcı ID ile değiştirdiğinde
       cihaz/izin/uyarı/talep referanslarını da yeni ID'ye taşır. */
    function rekeyEmployeeReferences(oldId, newId) {
        if (oldId == null || newId == null || oldId === newId) return;
        [LEAVES, ALERTS, TICKETS, DEVICES].forEach(list => {
            list.forEach(rec => { if (rec.empId === oldId) rec.empId = newId; });
        });
    }

    function clearAnalyticsCache() {
        analyticsCache.clear();
        leaderboardCache.clear();
    }

    const API_BASE = '/api/v1/employees';

    function refreshTodayInDays() {
        const last = DAYS[DAYS.length - 1];
        if (!last || !EMPLOYEES.length) return;
        const N = EMPLOYEES.length || 1;
        const onTime = EMPLOYEES.filter(e => e.status === 'PRESENT').length;
        const late = EMPLOYEES.filter(e => e.status === 'LATE').length;
        const leave = EMPLOYEES.filter(e => e.status === 'LEAVE').length;
        const absent = EMPLOYEES.filter(e => e.status === 'ABSENT').length;
        const lateEmps = EMPLOYEES.filter(e => e.status === 'LATE' || (e.lateMin || 0) > 0);
        const avgLateMin = lateEmps.length
            ? lateEmps.reduce((s, e) => s + (e.lateMin || 0), 0) / lateEmps.length
            : 0;
        const totalOtH = EMPLOYEES.reduce((s, e) => s + (e.overtimeMin || 0), 0) / 60;
        last.onTime = onTime / N;
        last.late = late / N;
        last.leave = leave / N;
        last.absent = absent / N;
        last.lateMin = +(avgLateMin.toFixed(1));
        last.overtimeH = +(totalOtH.toFixed(1));
    }

    function normalizeAlertType(rawType) {
        const s = String(rawType || '').toLocaleUpperCase('tr-TR');
        if (s === 'MOCK_GPS' || s.includes('SAHTE') || s.includes('MOCK')) return 'MOCK_GPS';
        if (s === 'GEOFENCE' || s.includes('30M') || s.includes('30 M') || s.includes('GEOFENCE') || s.includes('SINIR')) return 'GEOFENCE';
        if (s === 'DEVICE' || s.includes('CİHAZ') || s.includes('CIHAZ')) return 'DEVICE';
        if (s === 'ROOT' || s.includes('WI-FI') || s.includes('WIFI') || s.includes('ROOT') || s.includes('JAILBREAK')) return 'ROOT';
        return 'BRUTE';
    }

    function normalizeAuditCat(role, action) {
        const a = String(action || '').toLocaleLowerCase('tr-TR');
        const r = String(role || '').toUpperCase();
        if (a.includes('güvenlik') || a.includes('sahte') || a.includes('alarm') || a.includes('engel')) return 'SECURITY';
        if (a.includes('cihaz') || a.includes('eşleme')) return 'DEVICE';
        if (a.includes('izin') || a.includes('personel') || a.includes('vardiya') || r === 'HR') return 'HR';
        if (a.includes('parola') || a.includes('kullanıcı') || a.includes('hesap') || r === 'ADMIN') return 'ACCOUNT';
        return 'SYSTEM';
    }

    function syncEmployeesFromBackend(onSync) {
        return syncAllFromPostgres({ force: true }).then(() => {
            if (typeof onSync === 'function') onSync(EMPLOYEES);
            return EMPLOYEES;
        });
    }

    /* =========================================================================
       PostgreSQL 18 + Prisma gerçek veri katmanı (/api/v1/bootstrap + SSE)
       Web panelindeki tüm ekranlar bu katmandan beslenir; demo üretimi yalnızca
       API erişilemediğinde yedek olarak kalır.
       ========================================================================= */
    const SHIFTS = [];
    const ACCESS_LOGS = [];
    const SYNC = { ok: false, inFlight: false, lastSync: null, error: null, sse: 'idle', events: [], accessLogTotal: 0 };

    /* Personelin atanmış vardiya şablonu (yoksa 08:30 – 17:30 standart) */
    function shiftOf(e) {
        const id = e && e.shiftId != null ? +e.shiftId : null;
        const s = id != null ? SHIFTS.find(x => +x.id === id) : null;
        const startMin = s && s.startMin != null ? +s.startMin : (e && e.shiftStartMin != null ? +e.shiftStartMin : 510);
        const endMin = s && s.endMin != null ? +s.endMin : (e && e.shiftEndMin != null ? +e.shiftEndMin : 1050);
        const graceMin = s && s.graceMin != null ? +s.graceMin : 5;
        const breakMin = s && s.breakMin != null ? +s.breakMin : 60;
        return {
            id,
            code: (s && s.code) || '',
            name: (s && s.name) || (e && e.shiftName) || 'Standart Vardiya',
            startMin,
            endMin,
            graceMin,
            breakMin,
            lateThreshold: startMin + graceMin
        };
    }

    const trDate = iso => {
        if (!iso) return '';
        const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso);
    };
    const legacyStatus = s => String(s || 'PENDING').toLowerCase();

    function mapEmployeeRow(item, idx) {
        const seedIdx = idx != null ? idx : Math.max(0, (+item.id || 1) - 501);
        const defaultBias = item.status === 'LATE'
            ? 0.16
            : (item.overtimeMin || 0) > 30
            ? 0.78
            : ((seedIdx * 17) % 100) / 100;
        return {
            id: item.id,
            sicil: item.sicil,
            name: item.name,
            dept: item.dept,
            title: item.title,
            branch: item.branch || 'ŞB-001',
            shiftId: item.shiftId || null,
            shiftName: item.shiftName || '',
            shiftStartMin: item.shiftStartMin != null ? item.shiftStartMin : 510,
            shiftEndMin: item.shiftEndMin != null ? item.shiftEndMin : 1050,
            status: item.status || 'PRESENT',
            inMin: item.inMin != null ? item.inMin : null,
            outMin: item.outMin != null ? item.outMin : null,
            checkIn: item.checkIn || (item.inMin != null ? hhmm(item.inMin) : null),
            checkOut: item.checkOut || (item.outMin != null ? hhmm(item.outMin) : null),
            lateMin: item.lateMin || 0,
            lateExcusedMin: item.lateExcusedMin || 0,
            overtimeMin: item.overtimeMin || 0,
            dist: item.dist != null ? item.dist : null,
            device: item.device || 'Kurumsal Mobil Cihaz',
            os: item.os || 'Android 14',
            ver: item.ver || '2.4.1',
            bound: item.bound !== false,
            tone: item.tone || (1 + (seedIdx % 5)),
            proneLateDow: item.proneLateDow || (1 + ((seedIdx * 3) % 5)),
            proneOtDow: item.proneOtDow || (1 + ((seedIdx * 2 + 2) % 5)),
            workHabitBias: item.workHabitBias != null ? item.workHabitBias : defaultBias,
            email: item.email || '',
            phone: item.phone || '',
            startDate: item.hireDate || item.startDate || '2026-10-20',
            leaveUsed: item.leaveUsed != null ? item.leaveUsed : 0,
            leaveTotal: item.leaveTotal != null ? item.leaveTotal : 14,
            isNewHire: !!item.isNewHire
        };
    }

    function applyBootstrap(d) {
        if (!d || d.status !== 'success') return false;
        const previousEmployees = EMPLOYEES.slice();

        if (Array.isArray(d.branches) && d.branches.length) {
            BRANCHES.length = 0;
            d.branches.forEach((b, i) => BRANCHES.push({
                id: b.id != null ? b.id : i + 1,
                code: b.code,
                name: b.name,
                city: b.city || '',
                district: b.district || '',
                address: b.address || '',
                phone: b.phone || '',
                googleMapUrl: b.googleMapUrl || '',
                lat: +b.lat,
                lng: +b.lng,
                radius: b.radius != null ? +b.radius : 30,
                wifi: b.wifi || '',
                w: b.w != null ? +b.w : (b.code === 'ŞB-001' ? 0.16 : 0.01585)
            }));
        }

        SHIFTS.length = 0;
        (d.shifts || []).forEach(s => SHIFTS.push(Object.assign({}, s)));

        if (Array.isArray(d.employees) && d.employees.length) {
            EMPLOYEES.length = 0;
            d.employees.forEach((item, idx) => EMPLOYEES.push(mapEmployeeRow(item, idx)));
            syncEmployeeReferences(previousEmployees);

            // Cihaz tablosunu da PostgreSQL personel cihaz kayıtlarından besle
            const prevDeviceStatus = new Map(DEVICES.map(dv => [dv.empId, dv.status]));
            DEVICES.length = 0;
            EMPLOYEES.forEach((e, idx) => {
                const st = prevDeviceStatus.get(e.id) || (e.bound === false ? 'PENDING' : 'BOUND');
                DEVICES.push({
                    id: 'DV-' + (7001 + idx),
                    empId: e.id,
                    model: e.device || MODELS[idx % MODELS.length],
                    os: e.os || 'Android 14',
                    ver: e.ver || '2.4.1',
                    seen: (idx % 38) + 1,
                    status: st,
                    mask: 'a' + ((e.id * 3) % 9) + 'f…' + (10 + ((e.id * 7) % 89))
                });
            });
        }

        if (Array.isArray(d.leaves)) {
            LEAVES.length = 0;
            d.leaves.forEach(l => LEAVES.push({
                id: l.dbId != null ? l.dbId : l.id,
                code: l.id,
                empId: l.empId,
                type: l.type,
                days: l.days,
                from: trDate(l.start),
                to: trDate(l.end),
                reason: l.note || '',
                status: legacyStatus(l.status),
                ago: l.createdAtIstanbul || '',
                isHourly: !!l.isHourly,
                startClock: l.startClock,
                endClock: l.endClock,
                durationMin: l.durationMin,
                sicil: l.sicil,
                name: l.name
            }));
        }

        if (Array.isArray(d.lateReasons)) {
            LATE_REASONS.length = 0;
            d.lateReasons.forEach(r => LATE_REASONS.push({
                id: r.id,
                empId: r.empId,
                sicil: r.sicil,
                name: r.name,
                dept: r.dept,
                branch: r.branch,
                workDate: r.workDate,
                workDateTr: trDate(r.workDate),
                checkIn: r.checkIn || '—',
                lateMin: r.lateMin || 0,
                reasonCode: r.reasonCode || '',
                reasonNote: r.reasonNote || '',
                status: r.status || 'PENDING',
                excusedMin: r.excusedMin || 0,
                reviewedBy: r.reviewedBy || '',
                reviewedAt: r.reviewedAt || ''
            }));
        }

        if (Array.isArray(d.alerts)) {
            ALERTS.length = 0;
            d.alerts.forEach((a, i) => ALERTS.push({
                id: a.dbId != null ? a.dbId : i + 1,
                dbId: a.dbId,
                code: a.id,
                type: normalizeAlertType(a.type),
                rawType: a.type,
                sev: a.sev,
                empId: a.empId,
                branch: a.branch,
                ago: a.time,
                dist: a.dist,
                status: a.status,
                resolved: a.status === 'RESOLVED' || a.status === 'CLOSED'
            }));
        }

        if (Array.isArray(d.accessLogs)) {
            ACCESS_LOGS.length = 0;
            d.accessLogs.forEach(a => ACCESS_LOGS.push(Object.assign({}, a)));
        }
        SYNC.accessLogTotal = d.accessLogTotal != null ? d.accessLogTotal : ACCESS_LOGS.length;

        if (Array.isArray(d.audits) && d.audits.length) {
            AUDIT.length = 0;
            d.audits.forEach(a => AUDIT.push({
                t: a.time,
                who: a.actor || 'Sistem',
                act: a.action,
                target: a.target || '',
                cat: normalizeAuditCat(a.role, a.action)
            }));
        }

        refreshTodayInDays();
        clearAnalyticsCache();
        SYNC.ok = true;
        SYNC.error = null;
        SYNC.lastSync = new Date().toISOString();
        try { g.dispatchEvent(new CustomEvent('atf:sync', { detail: { source: 'bootstrap' } })); } catch (_) {}
        return true;
    }

    let syncPromise = null;
    function syncAllFromPostgres(opts) {
        if (typeof fetch !== 'function') return Promise.resolve(false);
        if (typeof location !== 'undefined' && location.protocol === 'file:') return Promise.resolve(false);
        if (syncPromise && !(opts && opts.force)) return syncPromise;
        SYNC.inFlight = true;
        syncPromise = fetch('/api/v1/bootstrap', { cache: 'no-store', headers: { Accept: 'application/json' } })
            .then(r => (r.ok ? r.json() : Promise.reject(new Error('PostgreSQL yanıtı: HTTP ' + r.status))))
            .then(d => applyBootstrap(d))
            .catch(err => {
                SYNC.error = String((err && err.message) || err);
                return false;
            })
            .finally(() => {
                SYNC.inFlight = false;
                syncPromise = null;
            });
        return syncPromise;
    }

    let sseSource = null, sseRefetchTimer = null, sseWatchdog = null, sseStartedAt = 0;
    function startRealtimeStream(force) {
        if (typeof EventSource !== 'function') return;
        // Takılı kalan (CONNECTING) veya kapanmış akışları yeniden kur.
        const stuck = sseSource && sseSource.readyState === 0 && (Date.now() - sseStartedAt > 10000);
        if (sseSource && sseSource.readyState !== 2 && !stuck && !force) return;
        if (sseSource) {
            try { sseSource.close(); } catch (_) {}
            sseSource = null;
        }
        SYNC.sse = 'connecting';
        sseStartedAt = Date.now();
        try {
            const es = new EventSource('/api/v1/events/stream');
            sseSource = es;
            clearTimeout(sseWatchdog);
            sseWatchdog = setTimeout(() => {
                if (sseSource === es && es.readyState !== 1) {
                    try { es.close(); } catch (_) {}
                    if (sseSource === es) sseSource = null;
                    SYNC.sse = 'retry';
                    setTimeout(() => startRealtimeStream(true), 5000);
                }
            }, 10000);
            es.addEventListener('connected', () => { clearTimeout(sseWatchdog); SYNC.sse = 'open'; });
            es.addEventListener('pdks_event', e => {
                SYNC.sse = 'open';
                let evt = null;
                try { evt = JSON.parse(e.data); } catch (_) {}
                if (evt) {
                    SYNC.events = [evt].concat(SYNC.events).slice(0, 40);
                    if (A.toast && document.body.classList.contains('in-app')) {
                        A.toast('[Canlı] ' + (evt.title || 'PDKS') + ': ' + (evt.message || ''), evt.severity || 'info');
                    }
                    try { g.dispatchEvent(new CustomEvent('atf:live-event', { detail: evt })); } catch (_) {}
                }
                clearTimeout(sseRefetchTimer);
                sseRefetchTimer = setTimeout(() => { syncAllFromPostgres({ force: true }); }, 320);
            });
            es.onerror = () => {
                SYNC.sse = 'retry';
                if (es.readyState === 2) {
                    sseSource = null;
                    setTimeout(() => startRealtimeStream(true), 4000);
                }
            };
        } catch (_) {
            SYNC.sse = 'off';
        }
    }

    function addEmployee(o, onSync) {
        const maxId = EMPLOYEES.reduce((m, x) => Math.max(m, x.id), 1500);
        const nextId = maxId + 1;
        const sicil = 'FN-' + nextId;
        const status = o.status || 'PRESENT';
        const inMin = status === 'PRESENT' ? 505 : status === 'LATE' ? 552 : null;
        const outMin = status === 'PRESENT' || status === 'LATE' ? 1060 : null;
        const newEmp = {
            id: nextId,
            sicil,
            name: o.name,
            dept: o.dept || DEPTS[0],
            title: o.title || TITLES[0],
            branch: o.branch || 'ŞB-001',
            status,
            inMin,
            outMin,
            checkIn: inMin == null ? null : hhmm(inMin),
            checkOut: outMin == null ? null : hhmm(outMin),
            lateMin: status === 'LATE' ? 12 : 0,
            overtimeMin: status === 'PRESENT' ? 15 : 0,
            dist: status === 'PRESENT' || status === 'LATE' ? 8.4 : null,
            tone: 1 + (nextId % 5),
            proneLateDow: 1,
            proneOtDow: 3,
            workHabitBias: 0.72,
            startDate: o.startDate || DAYS[DAYS.length - 1].iso,
            email: o.email || '',
            isNewHire: true
        };
        EMPLOYEES.unshift(newEmp);
        DEVICES.unshift({
            id: 'DV-' + (7000 + DEVICES.length + 1),
            empId: newEmp.id,
            model: o.deviceModel || 'Yeni Kayıt · Mobil Cihaz',
            os: 'Android 14',
            ver: '2.4.1',
            seen: 1,
            status: o.deviceBound === false ? 'PENDING' : 'BOUND',
            mask: 'n' + (nextId % 9) + 'f…' + (nextId % 90 + 10)
        });
        refreshTodayInDays();
        clearAnalyticsCache();
        persistLocalState();

        if (typeof fetch === 'function' && (typeof location === 'undefined' || location.protocol !== 'file:')) {
            const payload = {
                name: newEmp.name,
                dept: newEmp.dept,
                title: newEmp.title,
                branch: newEmp.branch,
                status: newEmp.status,
                hireDate: newEmp.startDate
            };
            // Boş e-posta gönderilmez: zod doğrulaması boş string yerine undefined bekler.
            if (newEmp.email) payload.email = newEmp.email;

            fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload)
            })
                .then(r => {
                    if (!r.ok) {
                        A.toast('Personel sunucuya kaydedilemedi · yerel taslak olarak tutuldu.', 'err');
                        return null;
                    }
                    return r.json();
                })
                .then(res => {
                    if (res && res.employee) {
                        const idx = EMPLOYEES.findIndex(x => x.id === newEmp.id);
                        if (idx >= 0) {
                            rekeyEmployeeReferences(EMPLOYEES[idx].id, res.employee.id);
                            EMPLOYEES[idx] = Object.assign({}, EMPLOYEES[idx], res.employee);
                            refreshTodayInDays();
                            clearAnalyticsCache();
                            if (typeof onSync === 'function') onSync(EMPLOYEES[idx]);
                        }
                        syncAllFromPostgres({ force: true });
                    }
                })
                .catch(() => {});
        }
        return newEmp;
    }

    function updateEmployee(empId, patch, onSync) {
        const idx = EMPLOYEES.findIndex(x => x.id === +empId);
        if (idx < 0) return null;
        const current = EMPLOYEES[idx];
        const nextStatus = patch.status || current.status;
        let inMin = current.inMin;
        let outMin = current.outMin;
        let lateMin = current.lateMin;
        let overtimeMin = current.overtimeMin;
        let dist = current.dist;

        if (patch.status && patch.status !== current.status) {
            if (nextStatus === 'LEAVE' || nextStatus === 'ABSENT') {
                inMin = null;
                outMin = null;
                lateMin = 0;
                overtimeMin = 0;
                dist = null;
            } else if (inMin == null) {
                inMin = nextStatus === 'PRESENT' ? 505 : 552;
                outMin = 1060;
                lateMin = nextStatus === 'LATE' ? 12 : 0;
                overtimeMin = nextStatus === 'PRESENT' ? 15 : 0;
                dist = 7.8;
            }
        }

        const updated = Object.assign({}, current, {
            name: patch.name != null ? patch.name : current.name,
            dept: patch.dept != null ? patch.dept : current.dept,
            title: patch.title != null ? patch.title : current.title,
            branch: patch.branch != null ? patch.branch : current.branch,
            status: nextStatus,
            email: patch.email != null ? patch.email : (current.email || ''),
            startDate: patch.startDate != null ? patch.startDate : (current.startDate || '2026-10-20'),
            inMin,
            outMin,
            checkIn: inMin == null ? null : hhmm(inMin),
            checkOut: outMin == null ? null : hhmm(outMin),
            lateMin,
            overtimeMin,
            dist
        });
        EMPLOYEES[idx] = updated;
        refreshTodayInDays();
        clearAnalyticsCache();
        persistLocalState();

        try {
            const updatedMap = JSON.parse(localStorage.getItem('atf_updated_employees') || '{}');
            updatedMap[updated.id] = updated;
            localStorage.setItem('atf_updated_employees', JSON.stringify(updatedMap));
        } catch (_) {}

        if (typeof fetch === 'function' && (typeof location === 'undefined' || location.protocol !== 'file:')) {
            fetch(`${API_BASE}/${encodeURIComponent(updated.id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(patch)
            })
                .then(r => (r.ok ? r.json() : null))
                .then(res => {
                    if (res && res.employee) {
                        const i2 = EMPLOYEES.findIndex(x => x.id === updated.id);
                        if (i2 >= 0) {
                            EMPLOYEES[i2] = Object.assign({}, EMPLOYEES[i2], res.employee);
                            refreshTodayInDays();
                            clearAnalyticsCache();
                            if (typeof onSync === 'function') onSync(EMPLOYEES[i2]);
                        }
                        syncAllFromPostgres({ force: true });
                    }
                })
                .catch(() => {});
        }
        return updated;
    }

    function deleteEmployee(empId, onSync) {
        const idx = EMPLOYEES.findIndex(x => x.id === +empId);
        if (idx < 0) return null;
        const removed = EMPLOYEES.splice(idx, 1)[0];
        [LEAVES, ALERTS, TICKETS, DEVICES].forEach(list => {
            for (let i = list.length - 1; i >= 0; i--) {
                if (list[i].empId === removed.id) list.splice(i, 1);
            }
        });
        refreshTodayInDays();
        clearAnalyticsCache();
        persistLocalState();

        try {
            const deletedIds = JSON.parse(localStorage.getItem('atf_deleted_emp_ids') || '[]');
            if (!deletedIds.includes(removed.id)) deletedIds.push(removed.id);
            localStorage.setItem('atf_deleted_emp_ids', JSON.stringify(deletedIds));
        } catch (_) {}

        if (typeof fetch === 'function' && (typeof location === 'undefined' || location.protocol !== 'file:')) {
            fetch(`${API_BASE}/${encodeURIComponent(removed.id)}`, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json' }
            })
                .then(r => (r.ok ? r.json() : null))
                .then(res => {
                    if (res && typeof onSync === 'function') onSync(removed);
                    syncAllFromPostgres({ force: true });
                })
                .catch(() => {});
        }
        return removed;
    }

    g.ATF.DATA = {
        BRANCHES, DEPTS, TITLES, EMPLOYEES, DAYS, LEAVES, LEAVE_TYPES, ALERTS, ALERT_TYPES,
        TICKETS, TICKET_TYPES, DEVICES, AUDIT, SHIFTS, ACCESS_LOGS, LATE_REASONS, SYNC, hhmm, fmtDurMin, resolveDays, shiftOf,
        empAnalytics, computeLeaderboards, addEmployee, updateEmployee, deleteEmployee,
        syncEmployeesFromBackend, syncAllFromPostgres, startRealtimeStream, clearAnalyticsCache
    };
})(window);
