package com.example.ui.components

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.example.ui.theme.CardSurface
import com.example.ui.theme.InkMuted
import com.example.ui.theme.InkPrimary
import com.example.ui.theme.InkSecondary
import com.example.ui.theme.LineHairline
import com.example.ui.theme.SubtleSurface

/**
 * Web panelindeki `ATF.openCardPopover` davranışının Compose karşılığı:
 * KPI veya grafik kartına dokununca içerik yay eğrisiyle büyüyerek odaklanır,
 * dışarı dokunma veya kapat düğmesiyle geri küçülür.
 */
@Composable
fun CardZoomDialog(
    title: String,
    subtitle: String? = null,
    showHeader: Boolean = true,
    onDismiss: () -> Unit,
    content: @Composable () -> Unit
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        var shown by remember { mutableStateOf(false) }
        LaunchedEffect(Unit) { shown = true }

        val progress by animateFloatAsState(
            targetValue = if (shown) 1f else 0f,
            animationSpec = spring(
                dampingRatio = 0.82f,
                stiffness = Spring.StiffnessMediumLow
            ),
            label = "card_zoom_in"
        )

        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 24.dp)
                .heightIn(max = 640.dp)
                .graphicsLayer {
                    alpha = progress.coerceIn(0f, 1f)
                    val s = 0.90f + 0.10f * progress
                    scaleX = s
                    scaleY = s
                    translationY = (1f - progress) * 26f
                },
            shape = RoundedCornerShape(22.dp),
            color = CardSurface,
            border = BorderStroke(1.dp, LineHairline),
            shadowElevation = 22.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(18.dp)
            ) {
                Box(modifier = Modifier.fillMaxWidth()) {
                    if (showHeader) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(end = 42.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                text = title,
                                color = InkPrimary,
                                fontSize = 17.sp,
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = (-0.3).sp
                            )
                            if (subtitle != null) {
                                Text(
                                    text = subtitle,
                                    color = InkMuted,
                                    fontSize = 12.sp,
                                    lineHeight = 17.sp
                                )
                            }
                        }
                    }
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(SubtleSurface)
                            .border(1.dp, LineHairline, CircleShape)
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null,
                                onClick = onDismiss
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Büyütülmüş kartı kapat",
                            tint = InkSecondary,
                            modifier = Modifier.size(17.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                ) {
                    content()
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = "Kapatmak için dışarı dokunun",
                    color = InkMuted,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

/**
 * Herhangi bir kartı büyütülebilir hale getirir.
 * [showDialogHeader] false ise kartın kendi başlığı korunur (grafik kartları için).
 */
@Composable
fun ZoomableCard(
    title: String,
    subtitle: String? = null,
    enabled: Boolean = true,
    showDialogHeader: Boolean = true,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    var zoomed by remember { mutableStateOf(false) }

    Box(
        modifier = modifier.then(
            if (enabled) {
                Modifier.clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = { zoomed = true }
                )
            } else {
                Modifier
            }
        )
    ) {
        content()
    }

    if (zoomed) {
        CardZoomDialog(
            title = title,
            subtitle = subtitle,
            showHeader = showDialogHeader,
            onDismiss = { zoomed = false }
        ) {
            content()
        }
    }
}
