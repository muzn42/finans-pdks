package com.example.ui.theme

import androidx.compose.ui.graphics.Color

// ============================================================
// Albayrak Finans Kurumsal Minimalist Renk Sistemi
// Web portalı (styles.css) ile birebir uyumlu tasarım tokenları
// ============================================================

// Yüzey ve Çizgi Tokenları
val BgCanvas = Color(0xFFF5F5F6)         // --bg
val CardSurface = Color(0xFFFFFFFF)      // --card
val SubtleSurface = Color(0xFFEEEEF0)    // --subtle
val LineHairline = Color(0xFFE2E3E6)     // --line
val LineStrong = Color(0xFFC9CBD0)       // --line-strong

// Tipografi ve Mürekkep Tokenları
val InkPrimary = Color(0xFF141517)       // --ink
val InkSecondary = Color(0xFF2B2D30)     // --ink-2
val InkMuted = Color(0xFF6B6F76)         // --muted
val InkFaint = Color(0xFF9A9EA6)         // --faint

// Marka Vurgu Tokenları (Albayrak Kırmızısı & Antrasit)
val AlbayrakRed = Color(0xFFE31E24)
val AlbayrakRedDark = Color(0xFFB8161B)
val AlbayrakRedLight = Color(0xFFFCECEE)
val AlbayrakRedContainer = Color(0xFFFDE4E5)
val AlbayrakGray = Color(0xFF5D5F61)
val AlbayrakCharcoal = Color(0xFF2B2D30)
val AlbayrakCharcoalDeep = Color(0xFF1C1D1F)
val AlbayrakDarkSurface = Color(0xFF141517)
val AlbayrakCharcoalSurface = Color(0xFF36383C)

// Durum Tokenları — Düşük doygunluklu, kurumsal netlikte
val StatusOk = Color(0xFF0E9F6E)
val StatusOkSoft = Color(0xFFE8F7F1)
val StatusWarn = Color(0xFFC77700)
val StatusWarnSoft = Color(0xFFFEF4E6)
val StatusBad = Color(0xFFD92D20)
val StatusBadSoft = Color(0xFFFDECEC)

// --- Geriye Dönük Uyumluluk İsimleri ---
val FinanceNavyDark = AlbayrakCharcoalDeep
val FinanceNavySurface = AlbayrakCharcoalSurface
val FinanceNavyLight = AlbayrakGray

val PrimaryBlue = AlbayrakRed
val PrimaryBlueDark = AlbayrakRedDark
val AccentCyan = AlbayrakGray
val AccentGold = StatusWarn

val InRangeGreen = StatusOk
val InRangeGreenContainer = StatusOkSoft
val OnInRangeGreenContainer = Color(0xFF065F46)

val OutOfRangeRed = StatusBad
val OutOfRangeRedContainer = StatusBadSoft
val OnOutOfRangeRedContainer = Color(0xFF881337)

val WarningAmber = StatusWarn
val WarningAmberContainer = StatusWarnSoft

val Slate50 = BgCanvas
val Slate100 = SubtleSurface
val Slate200 = LineHairline
val Slate700 = Color(0xFF3F4145)
val Slate800 = InkSecondary
val Slate900 = InkPrimary
