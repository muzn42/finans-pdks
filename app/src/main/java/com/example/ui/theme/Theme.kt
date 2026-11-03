package com.example.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColorScheme = lightColorScheme(
    primary = AlbayrakRed,
    onPrimary = Color.White,
    primaryContainer = AlbayrakRedLight,
    onPrimaryContainer = AlbayrakRedDark,
    secondary = InkPrimary,
    onSecondary = Color.White,
    secondaryContainer = SubtleSurface,
    onSecondaryContainer = InkPrimary,
    tertiary = StatusOk,
    background = BgCanvas,
    surface = CardSurface,
    surfaceVariant = SubtleSurface,
    onBackground = InkPrimary,
    onSurface = InkPrimary,
    onSurfaceVariant = InkMuted,
    outline = LineHairline,
    outlineVariant = LineStrong,
    error = StatusBad,
    errorContainer = StatusBadSoft
)

@Composable
fun FinansPdksTheme(
    darkTheme: Boolean = false,
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window
            if (window != null) {
                window.statusBarColor = CardSurface.toArgb()
                window.navigationBarColor = CardSurface.toArgb()
                WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = true
                WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = true
            }
        }
    }

    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = Typography,
        content = content
    )
}
