package com.example.util

import java.util.Locale

/**
 * Türkçe karakter uyumlu esnek arama yardımcısı.
 * - 'i' - 'İ', 'ı' - 'I', 'ş' - 's', 'ç' - 'c', 'ğ' - 'g', 'ö' - 'o', 'ü' - 'u' dönüşümlerini
 * hem tam Türkçe yerel ayarlarla hem de emülatör/PC klavyesinden İngilizce karakter girilme ihtimaline karşı normalize ederek arar.
 */
fun String.turkishContains(query: String): Boolean {
    if (query.isBlank()) return true

    val trLocale = Locale("tr", "TR")
    val lowerSelf = this.lowercase(trLocale)
    val lowerQuery = query.lowercase(trLocale).trim()

    // 1. Doğrudan Türkçe küçük harf eşleşmesi
    if (lowerSelf.contains(lowerQuery)) return true

    // 2. Diyakritik / Türkçe harf normalizasyonu (Örn: 'istanbul' yazınca 'İstanbul', 'sube' yazınca 'şube')
    fun normalizeTurkish(text: String): String {
        return text.lowercase(trLocale)
            .replace('ı', 'i')
            .replace('İ', 'i')
            .replace('ğ', 'g')
            .replace('ü', 'u')
            .replace('ş', 's')
            .replace('ö', 'o')
            .replace('ç', 'c')
    }

    val normSelf = normalizeTurkish(this)
    val normQuery = normalizeTurkish(query)
    return normSelf.contains(normQuery)
}
