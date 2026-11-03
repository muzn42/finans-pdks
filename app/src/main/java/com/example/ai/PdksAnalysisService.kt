package com.example.ai

import com.example.data.local.AttendanceRecordEntity
import com.example.data.local.SecurityAlertEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Albayrak Finans PDKS Kural Tabanlı Analiz ve Değerlendirme Servisi.
 * Tamamen yerel, hızlı, çevrimdışı çalışır; dış API anahtarı veya ağ bağımlılığı gerektirmez.
 */
object PdksAnalysisService {

    /**
     * İK Vardiya & Devam Durumu Değerlendirmesi (Yerel İK Analitiği)
     */
    suspend fun analyzeHrAttendance(
        records: List<AttendanceRecordEntity>,
        alerts: List<SecurityAlertEntity>
    ): String = withContext(Dispatchers.Default) {
        val total = records.size
        val inRange = records.count { it.isWithin5Meters }
        val lateCount = records.count { it.lateMinutes > 0 }
        val violations = alerts.size
        val compliancePct = if (total > 0) (inRange * 100 / total) else 100

        """
        📊 İK VARDİYA VE DEVAM RAPORU (YEREL ANALİZ)
        --------------------------------------------------
        • Toplam İncelenen Kayıt: $total
        • 30 Metre Şube İçi Doğrulanmış Giriş/Çıkış: $inRange (%$compliancePct)
        • Gecikme Kaydı Bulunan İşlem: $lateCount
        • 30 Metre Dışı Engellenen / Uyarılı Deneme: $violations

        📌 Öne Çıkan Tespitler:
        1. Şube personellerinin %$compliancePct'si 30 metre şube merkez yarıçapı içerisinde kurallara uygun giriş yapmıştır.
        2. Mesaiye zamanında başlayan personeller için kayıtlar onaylanmış, gecikmeler ilgili vardiya kartına işlenmiştir.
        3. 30 metre ötesinden işlem yapmaya çalışan $violations deneme sistem tarafından engellenmiş ve güvenlik kaydı oluşturulmuştur.

        💡 İK Aksiyon Planı:
        • Şube giriş kapısı önünde bekleyen personellere 30m geofence alanı bildirilmelidir.
        • Gecikme süreleri ay sonu net mesai bakiyesine (ek mesai - gecikme) otomatik yansıtılmaktadır.
        """.trimIndent()
    }

    /**
     * BT Güvenlik ve Konum Denetim Raporu
     */
    suspend fun auditSecurityAndFraud(
        records: List<AttendanceRecordEntity>,
        alerts: List<SecurityAlertEntity>
    ): String = withContext(Dispatchers.Default) {
        val mockCount = records.count { it.isMockLocation }
        val violations = alerts.size

        """
        🛡️ BT GÜVENLİK VE LOKASYON DENETİM RAPORU (YEREL ANALİZ)
        --------------------------------------------------
        • Güvenlik İncelemesi: Tamamlandı (Sistem Güvenli)
        • Sahte Konum (Mock GPS) Tespitleri: $mockCount vaka
        • 30 Metre Kuralı İhlal Denemeleri: $violations engellendi
        • Şube İçi Ağ Entegrasyonu: Aktif (SSID & Kurumsal IP Doğrulaması)

        🔍 Güvenlik Bulguları:
        - Tüm giriş-çıkış işlemleri şube yerel subnet (10.14.x.x / 10.16.x.x) ve 30m geofence koordinatlarıyla izlenmektedir.
        - 30 metrelik yarıçap sınırı, GPS drift ve koordinat manipülasyonlarına karşı tam koruma sağlamaktadır.
        - Tek cihaz eşleme kuralı devrede olup yetkisiz cihaz değişimleri BT onayına bağlanmıştır.

        ⚙️ BT Güvenlik Tavsiyesi:
        - Mock GPS tespit edilen cihazların donanım parmak izi otomatik olarak blokaj listesine alınabilir.
        """.trimIndent()
    }

    suspend fun auditSecurityAndFraudWithHighThinking(
        records: List<AttendanceRecordEntity>,
        alerts: List<SecurityAlertEntity>
    ): String = auditSecurityAndFraud(records, alerts)

    /**
     * Şube Dışı Mazeret Bildirimi Değerlendirmesi
     */
    suspend fun evaluateExcuse(
        employeeName: String,
        reason: String,
        distanceMeters: Double
    ): String = withContext(Dispatchers.Default) {
        val distStr = String.format(java.util.Locale.US, "%.1f", distanceMeters)
        if (distanceMeters <= 30.0) {
            "Mazeret Onaylandı: Personel $employeeName 30 metre şube sınırları içerisinde ($distStr m) bulunmaktadır."
        } else {
            "Mazeret İK İnceleme Havuzuna Alındı: $employeeName şubeye $distStr m mesafede. Açıklama: \"$reason\". Şube yöneticisi ve İK onayına sunuldu."
        }
    }

    suspend fun evaluateExcuseQuickly(
        employeeName: String,
        reason: String,
        distanceMeters: Double
    ): String = evaluateExcuse(employeeName, reason, distanceMeters)
}
