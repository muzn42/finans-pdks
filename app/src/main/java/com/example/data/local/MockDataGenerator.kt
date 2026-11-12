package com.example.data.local

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Albayrak Tasarruf Finansman A.Ş. 500 Kişilik Zengin Mock Veri Üreticisi.
 *
 * Gerçekçi Türkçe ad-soyad, farklı departman ve unvanlar, 50 şubeye dengeli dağılım,
 * çeşitli cihaz modelleri ve performans durumları (Elmas, Altın, Gümüş, Bronz,
 * ek mesai ve 30m ihlali) içerir.
 */
object MockDataGenerator {

    private val FIRST_NAMES = listOf(
        // Erkek İsimleri
        "Ahmet", "Mehmet", "Mustafa", "Ali", "Hüseyin", "Hasan", "İbrahim", "İsmail", "Osman", "Yusuf",
        "Ömer", "Emre", "Burak", "Murat", "Serkan", "Hakan", "Caner", "Tolga", "Onur", "Kerem",
        "Barış", "Eren", "Berk", "Kaan", "Arda", "Alper", "Batuhan", "Cem", "Deniz", "Ege",
        "Furkan", "Gökhan", "Harun", "Kadir", "Koray", "Mert", "Oğuz", "Ozan", "Polat", "Rıza",
        "Samet", "Selim", "Sinan", "Şafak", "Tarık", "Ufuk", "Umut", "Volkan", "Yağız", "Zafer",
        "Adem", "Altan", "Baha", "Berkay", "Bora", "Cihan", "Cüneyt", "Doruk", "Emir", "Enes",
        "Erdem", "Fatih", "Görkem", "Halil", "Hamza", "İlker", "İrfan", "Kenan", "Levent", "Melih",
        "Metin", "Necati", "Nihat", "Okan", "Orhan", "Özgür", "Recep", "Ramazan", "Sabri", "Sedat",
        "Semih", "Serdar", "Süleyman", "Taha", "Tayfun", "Tuna", "Turan", "Uğur", "Vedat", "Yasin",
        // Kadın İsimleri
        "Ayşe", "Fatma", "Emine", "Hatice", "Zeynep", "Elif", "Meryem", "Şerife", "Zehra", "Sultan",
        "Hanife", "Merve", "Büşra", "Esra", "Gamze", "Seda", "Gizem", "Tuğba", "Kübra", "Ebru",
        "Betül", "Yasemin", "Duygu", "Pelin", "Damla", "Selin", "Ece", "İrem", "Başak", "Melis",
        "Ceren", "Aslı", "Burcu", "Derya", "Dilara", "Ezgi", "Fulya", "Gözde", "Hande", "Hazal",
        "Hilal", "Ilgın", "Janset", "Leman", "Mine", "Nazlı", "Nilgün", "Nur", "Özge", "Pınar",
        "Rüya", "Sevgi", "Simge", "Şule", "Yağmur", "Berna", "Bahar", "Beyza", "Buket", "Cansu",
        "Çağla", "Defne", "Eda", "Ela", "Eylül", "Feyza", "Gülşah", "Gülben", "Hacer", "Hale",
        "İnci", "İpek", "Kader", "Kardelen", "Melike", "Nalan", "Nesrin", "Nida", "Nihal",
        "Rabia", "Reyhan", "Rumeysa", "Sahra", "Sanem", "Sedef", "Selen", "Sena", "Sevil", "Sıla",
        "Sude", "Tuğçe", "Tülay", "Vildan", "Zeliha", "Zuhal", "Zümrüt", "Berrin", "Burçak", "Canan"
    )

    private val LAST_NAMES = listOf(
        "Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir",
        "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek",
        "Polat", "Korkmaz", "Önal", "Erdoğan", "Yavuz", "Ceylan", "Güler", "Aktaş", "Yalçın", "Güneş",
        "Bozkurt", "Bulut", "Keskin", "Ünal", "Kaplan", "Avcı", "Karaca", "Taşkın", "Akın", "Coşkun",
        "Şen", "Sönmez", "Bilgin", "Duman", "Erol", "Çakır", "Sevim", "Tekin", "Acar", "Albayrak",
        "Gök", "Turan", "Varol", "Uysal", "Yalaza", "Yaman", "Yenice", "Zorlu", "Aksu", "Alkan",
        "Altun", "Atalay", "Baştürk", "Bayram", "Bozdağ", "Candemir", "Cengiz", "Çakmak", "Dağdelen", "Demirci",
        "Dilek", "Ergin", "Esen", "Gedik", "Göktürk", "Gültekin", "Işık", "Kahraman", "Kandemir", "Karadağ",
        "Kocaman", "Köksal", "Mercan", "Ocak", "Özbay", "Özer", "Pala", "Pehlivan", "Sarı", "Saygın"
    )

    private val DEPARTMENTS_AND_TITLES = listOf(
        "Tasarruf Finansman Satış & Portföy" to listOf(
            "Kıdemli Tasarruf Danışmanı", "Tasarruf Finansman Danışmanı", "Portföy Yöneticisi",
            "Bireysel Tasarruf Uzmanı", "Kurumsal Portföy Danışmanı", "Şube Satış Temsilcisi"
        ),
        "Şube Operasyon & Müşteri Deneyimi" to listOf(
            "Şube Müdürü", "Şube Operasyon Yönetmeni", "Tasarruf Sözleşme Uzmanı",
            "Gişe & Tahsilat Yetkilisi", "Müşteri Deneyimi Temsilcisi", "Operasyon Asistanı"
        ),
        "Tahsis, Teslimat & Finansman" to listOf(
            "Teslimat & Finansman Yöneticisi", "Tahsis Operasyon Uzmanı", "Konut & Araç Teslimat Uzmanı",
            "Sözleşme Finansman Değerleme Sorumlusu", "Teslimat Takip Yetkilisi"
        ),
        "İnsan Kaynakları & Akademi" to listOf(
            "İK İş Ortağı (HRBP)", "İşe Alım & Yetenek Uzmanı", "Eğitim & Gelişim Danışmanı",
            "Bordro & Özlük İşleri Yetkilisi", "Çalışan Deneyimi Sorumlusu"
        ),
        "Bilgi Teknolojileri & Siber Güvenlik" to listOf(
            "BT Altyapı & Sistem Yöneticisi", "Siber Güvenlik & Ağ Uzmanı", "Mobil & Web Yazılım Uzmanı",
            "Veritabanı Yöneticisi (DBA)", "BT Destek & Saha Uzmanı"
        ),
        "Hukuk, Mevzuat & Uyum" to listOf(
            "Kurumsal Hukuk Müşaviri", "Mevzuat & BDDK Uyum Uzmanı", "Sözleşmeler Hukuku Sorumlusu"
        ),
        "Mali İşler & Muhasebe" to listOf(
            "Mali İşler Müdürü", "Genel Muhasebe Uzmanı", "Finansal Raporlama Sorumlusu", "Bütçe & Planlama Uzmanı"
        ),
        "İç Denetim, Teftiş & Risk" to listOf(
            "İç Denetim Müfettişi", "Risk Yönetimi Uzmanı", "Şube Denetim Sorumlusu"
        ),
        "Müşteri Deneyimi & Çağrı Merkezi" to listOf(
            "Çağrı Merkezi Takım Lideri", "Kıdemli Müşteri Temsilcisi", "Gelen Çağrı Destek Yetkilisi"
        )
    )

    private val DEVICE_MODELS = listOf(
        "SM-S928B-883A", "IPH-15PRO-41B0", "SM-A546E-33F2", "PIXEL-8-99D1", "NOTE-20-C10A",
        "SM-G998B-771C", "IPH-14-884A", "XIAOMI-13T-55A1", "REDMI-NOTE12-22B", "ONEPLUS-11-90E"
    )

    private fun turkishToAscii(text: String): String {
        return text.replace("ç", "c").replace("Ç", "c")
            .replace("ğ", "g").replace("Ğ", "g")
            .replace("ı", "i").replace("I", "i")
            .replace("İ", "i")
            .replace("ö", "o").replace("Ö", "o")
            .replace("ş", "s").replace("Ş", "s")
            .replace("ü", "u").replace("Ü", "u")
            .lowercase(Locale.ENGLISH)
    }

    /**
     * 500 benzersiz, zengin ve gerçekçi çalışan listesi üretir.
     * İlk 5 çalışan Login ekranındaki hızlı test hesaplarını korur.
     */
    fun generate500Employees(): List<EmployeeEntity> {
        val list = mutableListOf<EmployeeEntity>()

        // 1. PostgreSQL 18 seed'iyle birebir aynı ilk 5 personel (FN-1001 … FN-1005)
        list.add(
            EmployeeEntity(
                id = 501,
                employeeCode = "FN-1001",
                fullName = "Caner Öztürk",
                email = "caner.ozturk@albayrakfinans.com.tr",
                department = "Şube Operasyon",
                title = "Takım Lideri",
                branchId = 46,
                deviceId = "SM-S928B-883A",
                phone = "+90 532 100 2030",
                role = "PERSONNEL",
                password = "123",
                shiftStartMin = 480,
                shiftEndMin = 1020,
                shiftGraceMin = 5
            )
        )
        list.add(
            EmployeeEntity(
                id = 502,
                employeeCode = "FN-1002",
                fullName = "Deniz Yılmaz",
                email = "deniz.yilmaz@albayrakfinans.com.tr",
                department = "Mali İşler",
                title = "Şube Müdür Yrd.",
                branchId = 5,
                deviceId = "IPH-15PRO-41B0",
                phone = "+90 533 200 4050",
                role = "PERSONNEL",
                password = "123",
                shiftStartMin = 510,
                shiftEndMin = 1050,
                shiftGraceMin = 5
            )
        )
        list.add(
            EmployeeEntity(
                id = 503,
                employeeCode = "FN-1003",
                fullName = "Melis Yılmaz",
                email = "melis.yilmaz@albayrakfinans.com.tr",
                department = "Kurumsal Finansman",
                title = "Operasyon Uzmanı",
                branchId = 18,
                deviceId = "SM-A546E-33F2",
                phone = "+90 535 300 6070",
                role = "PERSONNEL",
                password = "123",
                shiftStartMin = 510,
                shiftEndMin = 1050,
                shiftGraceMin = 5
            )
        )
        list.add(
            EmployeeEntity(
                id = 504,
                employeeCode = "FN-1004",
                fullName = "Ayşe Yıldırım",
                email = "ayse.yildirim@albayrakfinans.com.tr",
                department = "Taşıt Finansmanı",
                title = "Takım Lideri",
                branchId = 26,
                deviceId = "PIXEL-8-99D1",
                phone = "+90 536 400 8090",
                role = "PERSONNEL",
                password = "123",
                shiftStartMin = 540,
                shiftEndMin = 1080,
                shiftGraceMin = 10
            )
        )
        list.add(
            EmployeeEntity(
                id = 505,
                employeeCode = "FN-1005",
                fullName = "Büşra Tekin",
                email = "busra.tekin@albayrakfinans.com.tr",
                department = "İnsan Kaynakları",
                title = "Uzman Yardımcısı",
                branchId = 45,
                deviceId = "NOTE-20-C10A",
                phone = "+90 537 500 1122",
                role = "PERSONNEL",
                password = "123",
                shiftStartMin = 510,
                shiftEndMin = 1050,
                shiftGraceMin = 5
            )
        )

        val usedNames = list.map { it.fullName }.toMutableSet()
        val usedCodes = list.map { it.employeeCode }.toMutableSet()
        val fnLen = FIRST_NAMES.size
        val lnLen = LAST_NAMES.size

        for (i in 6..500) {
            var fIdx = (i * 7 + 13) % fnLen
            val lIdx = (i * 11 + 29) % lnLen

            var first = FIRST_NAMES[fIdx]
            val last = LAST_NAMES[lIdx]
            var fullName = "$first $last"

            var offset = 1
            while (fullName in usedNames) {
                fIdx = (fIdx + offset) % fnLen
                first = FIRST_NAMES[fIdx]
                fullName = "$first $last"
                offset++
            }
            usedNames.add(fullName)

            var empCode = "FN-${1000 + i}"
            if (empCode in usedCodes) {
                empCode = "FN-${5000 + i}"
            }
            usedCodes.add(empCode)

            val deptIdx = i % DEPARTMENTS_AND_TITLES.size
            val (deptName, titles) = DEPARTMENTS_AND_TITLES[deptIdx]
            val title = titles[(i / DEPARTMENTS_AND_TITLES.size) % titles.size]

            val role = "PERSONNEL"

            val branchId = ((i % 54) + 1).toLong()
            val asciiFirst = turkishToAscii(first)
            val asciiLast = turkishToAscii(last)
            val email = "$asciiFirst.$asciiLast$i@albayrakfinans.com.tr"
            val phone = "+90 53${(i % 8) + 1} ${String.format(Locale.US, "%03d", 100 + (i * 7) % 899)} ${String.format(Locale.US, "%04d", 1000 + (i * 13) % 8999)}"
            val device = DEVICE_MODELS[i % DEVICE_MODELS.size]

            list.add(
                EmployeeEntity(
                    id = i.toLong(),
                    employeeCode = empCode,
                    fullName = fullName,
                    email = email,
                    department = deptName,
                    title = title,
                    branchId = branchId,
                    deviceId = device,
                    phone = phone,
                    role = role,
                    password = "123"
                )
            )
        }

        return list
    }

    /**
     * 500 çalışan için son 30 güne ait gerçekçi devam, gecikme, ek mesai
     * ve 30m güvenlik kontrolü kayıtları üretir.
     */
    fun generateSampleRecords(
        employees: List<EmployeeEntity>,
        branches: List<BranchEntity>
    ): List<AttendanceRecordEntity> {
        val records = mutableListOf<AttendanceRecordEntity>()
        var recId = 1L
        val now = System.currentTimeMillis()
        val dayStep = 86400000L
        val dateFormat = SimpleDateFormat("dd.MM.yyyy", Locale.getDefault())
        val branchMap = branches.associateBy { it.id }

        for (emp in employees) {
            val branch = branchMap[emp.branchId]
            val branchName = branch?.name ?: "Albayrak Finans Şubesi"
            val branchLat = branch?.latitude ?: 40.995454
            val branchLng = branch?.longitude ?: 29.140893

            // Personelin performans profili (emp.id üzerinden kararlı dağılım)
            val archetype = (emp.id % 10).toInt()
            // 0, 1, 2, 3 -> Elmas (%40)
            // 4, 5, 6 -> Altın (%30)
            // 7, 8 -> Gümüş (%20)
            // 9 -> Bronz (%10)

            val days = listOf(2, 5, 9, 14, 20, 26)
            for (day in days) {
                val dayTimestamp = now - (day * dayStep)
                val dateStr = dateFormat.format(Date(dayTimestamp))

                val late: Int
                val ot: Int
                var dist = 3.5 + ((emp.id + day) % 15) * 0.8
                var isWithin = true

                when (archetype) {
                    0, 1, 2, 3 -> {
                        // Elmas: 0 gecikme, bol ek mesai
                        late = 0
                        ot = if (day % 2 == 0) 30 else 45
                    }
                    4, 5, 6 -> {
                        // Altın: Maksimum 12-15 dk gecikme
                        late = if (day == 5) 12 else 0
                        ot = if (day % 2 == 0) 25 else 15
                    }
                    7, 8 -> {
                        // Gümüş: 15-30 dk arası gecikme
                        late = if (day in listOf(5, 14)) 22 else 0
                        ot = if (day == 9) 20 else 0
                    }
                    else -> {
                        // Bronz: 30 dk üzeri gecikme, eksi bakiye
                        late = if (day == 5) 45 else if (day == 14) 35 else 0
                        ot = if (day == 2) 15 else 0
                    }
                }

                // 30m İhlali: Her 35 personelden birine 1 adet 30m geofence dışı işlem
                if (emp.id % 35L == 0L && day == 14) {
                    dist = 68.4
                    isWithin = false
                }

                // Giriş Kaydı
                records.add(
                    AttendanceRecordEntity(
                        id = recId++,
                        employeeId = emp.id,
                        employeeName = emp.fullName,
                        branchId = emp.branchId,
                        branchName = branchName,
                        recordType = "GİRİŞ",
                        timestamp = dayTimestamp + (8 * 3600000L + 50 * 60000L),
                        formattedTime = String.format(Locale.US, "08:%02d", 50 + (late % 10)),
                        formattedDate = dateStr,
                        userLatitude = branchLat,
                        userLongitude = branchLng,
                        distanceMeters = dist,
                        isWithin5Meters = isWithin,
                        ipAddress = "10.0.2.15",
                        deviceModel = emp.deviceId,
                        isMockLocation = false,
                        note = if (late == 0) "Zamanında şube içi giriş" else "$late dk gecikmeli giriş",
                        lateMinutes = late,
                        overtimeMinutes = 0
                    )
                )

                // Çıkış Kaydı
                val outHour = 18 + (ot / 60)
                val outMin = ot % 60
                records.add(
                    AttendanceRecordEntity(
                        id = recId++,
                        employeeId = emp.id,
                        employeeName = emp.fullName,
                        branchId = emp.branchId,
                        branchName = branchName,
                        recordType = "ÇIKIŞ",
                        timestamp = dayTimestamp + (outHour * 3600000L + outMin * 60000L),
                        formattedTime = String.format(Locale.US, "%02d:%02d", outHour, outMin),
                        formattedDate = dateStr,
                        userLatitude = branchLat,
                        userLongitude = branchLng,
                        distanceMeters = 3.8,
                        isWithin5Meters = true,
                        ipAddress = "10.0.2.15",
                        deviceModel = emp.deviceId,
                        isMockLocation = false,
                        note = if (ot > 0) "$ot dk onaylı ek mesai" else "Normal mesai çıkışı",
                        lateMinutes = 0,
                        overtimeMinutes = ot
                    )
                )
            }
        }

        return records
    }
}
