package com.example.util

import com.example.data.local.AttendanceRecordEntity
import java.util.Calendar

enum class BadgeTier(
    val title: String,
    val medalEmoji: String,
    val primaryColorHex: Long,
    val secondaryColorHex: Long,
    val containerBgHex: Long
) {
    DIAMOND("Elmas", "💎", 0xFF06B6D4, 0xFF38BDF8, 0xFFE0F2FE),
    GOLD("Altın", "🥇", 0xFFD97706, 0xFFF59E0B, 0xFFFEF3C7),
    SILVER("Gümüş", "🥈", 0xFF64748B, 0xFF94A3B8, 0xFFF1F5F9),
    BRONZE("Bronz", "🥉", 0xFF9A3412, 0xFFC2410C, 0xFFFFEDD5)
}

data class PunctualityBadgeResult(
    val tier: BadgeTier,
    val title: String,
    val reason: String,
    val totalCheckIns: Int,
    val onTimeCount: Int,
    val lateCount: Int,
    val maxLateMinutes: Int,
    val late15To30Count: Int,
    val lateOver30Count: Int
)

object BadgeCalculator {

    /**
     * Personelin son 1 aylık (30 gün) mesai giriş verilerini analiz ederek
     * Dakiklik (Geç Kalma) başarı madalyasını hesaplar.
     *  - Elmas: Son 1 ayda hiç geç kalmamış (0 dk).
     *  - Altın: Son 1 ayda en fazla 15 dakika geç kalmış.
     *  - Gümüş: 15-30 dk arası en fazla 3 gün ve 30 dk'dan fazla hiç geç kalmamış.
     *  - Bronz: 30 dk üzeri veya 3 günden fazla gecikmesi olanlar.
     */
    fun calculateMonthlyBadge(personalRecords: List<AttendanceRecordEntity>): PunctualityBadgeResult {
        val thirtyDaysAgo = Calendar.getInstance().apply {
            add(Calendar.DAY_OF_YEAR, -30)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis

        val monthlyRecords = personalRecords.filter { it.timestamp >= thirtyDaysAgo }
        val checkInRecords = monthlyRecords.filter { it.recordType == "GİRİŞ" }

        val totalCheckIns = checkInRecords.size
        val onTimeCount = checkInRecords.count { it.lateMinutes == 0 }
        val lateRecords = checkInRecords.filter { it.lateMinutes > 0 }
        val lateCount = lateRecords.size
        val maxLate = lateRecords.maxOfOrNull { it.lateMinutes } ?: 0
        val late15To30 = checkInRecords.count { it.lateMinutes in 16..30 }
        val lateOver30 = checkInRecords.count { it.lateMinutes > 30 }

        val punctualityTier: BadgeTier
        val punctualityTitle: String
        val punctualityReason: String

        if (totalCheckIns == 0) {
            punctualityTier = BadgeTier.BRONZE
            punctualityTitle = "Bronz Dakiklik"
            punctualityReason = "Son 30 günde kayıtlı mesai girişiniz bulunmuyor. Yeni ayda düzenli giriş yaparak Elmas rozeti hedefleyebilirsiniz."
        } else if (lateCount == 0) {
            // Kural: Son 1 ayda hiç geç kalmamışlara elmas
            punctualityTier = BadgeTier.DIAMOND
            punctualityTitle = "Elmas Dakiklik"
            punctualityReason = "Kusursuz Dakiklik! Son 30 günde yaptığınız $totalCheckIns mesai girişinin hiçbirinde geç kalmadınız (%100 tam zamanında)."
        } else if (maxLate <= 15) {
            // Kural: 15dk dan fazla geç kalmamış kişilere altın
            punctualityTier = BadgeTier.GOLD
            punctualityTitle = "Altın Dakiklik"
            punctualityReason = "Yüksek Disiplin! Son 30 günde 15 dakikadan fazla hiçbir gecikmeniz olmadı (Maksimum gecikme: $maxLate dk)."
        } else if (lateOver30 == 0 && late15To30 <= 3) {
            // Kural: 15 ila yarım saat arasında en fazla 3 gün ve yarım saatten fazlada hiç geç kalmamışlara gümüş
            punctualityTier = BadgeTier.SILVER
            punctualityTitle = "Gümüş Dakiklik"
            punctualityReason = "İyi Seviye! Son 30 günde yarım saatten (30 dk) fazla hiç geç kalmadınız; 15-30 dk arası gecikmeniz $late15To30 gün ile sınırlandı."
        } else {
            // Kural: Geride kalanlara bronz
            punctualityTier = BadgeTier.BRONZE
            punctualityTitle = "Bronz Dakiklik"
            punctualityReason = if (lateOver30 > 0) {
                "Geliştirilebilir: Son 30 günde yarım saati aşan ($maxLate dk) gecikme kaydedildi."
            } else {
                "Geliştirilebilir: Son 30 günde 15-30 dk arası gecikme sayısı ($late15To30 gün) sınırı aştı."
            }
        }

        return PunctualityBadgeResult(
            tier = punctualityTier,
            title = punctualityTitle,
            reason = punctualityReason,
            totalCheckIns = totalCheckIns,
            onTimeCount = onTimeCount,
            lateCount = lateCount,
            maxLateMinutes = maxLate,
            late15To30Count = late15To30,
            lateOver30Count = lateOver30
        )
    }
}
