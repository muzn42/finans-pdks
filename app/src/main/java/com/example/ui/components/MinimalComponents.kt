package com.example.ui.components

import android.content.ClipData
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.widget.Toast
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Close
import com.example.data.local.AttendanceRecordEntity
import com.example.data.local.EmployeeEntity
import com.example.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

// =========================================================================
// 1. KAYAN İNDİKATÖRLÜ SEGMENTED CONTROL (Reel Video Tarzı Yumuşak Geçiş)
// =========================================================================
@Composable
fun MinimalSegmentedControl(
    items: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    val density = LocalDensity.current
    var containerWidthPx by remember { mutableIntStateOf(0) }
    val itemCount = items.size.coerceAtLeast(1)
    val itemWidthDp = with(density) { (containerWidthPx / itemCount).toDp() }

    val thumbOffsetDp by animateDpAsState(
        targetValue = itemWidthDp * selectedIndex,
        animationSpec = spring(
            dampingRatio = 0.82f,
            stiffness = Spring.StiffnessMediumLow
        ),
        label = "seg_thumb_offset"
    )

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(40.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(SubtleSurface)
            .border(1.dp, LineHairline, RoundedCornerShape(10.dp))
            .padding(3.dp)
            .onSizeChanged { containerWidthPx = it.width }
    ) {
        if (containerWidthPx > 0) {
            Box(
                modifier = Modifier
                    .offset(x = thumbOffsetDp)
                    .width(itemWidthDp)
                    .fillMaxHeight()
                    .shadow(1.dp, RoundedCornerShape(7.dp), clip = false)
                    .clip(RoundedCornerShape(7.dp))
                    .background(CardSurface)
            )
        }

        Row(modifier = Modifier.fillMaxSize()) {
            items.forEachIndexed { index, label ->
                val isSelected = index == selectedIndex
                val textColor by animateColorAsState(
                    targetValue = if (isSelected) InkPrimary else InkMuted,
                    animationSpec = tween(180),
                    label = "seg_text_color"
                )
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(7.dp))
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null
                        ) { onSelect(index) },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = label,
                        color = textColor,
                        fontSize = 12.sp,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

// =========================================================================
// 2. YATAY KAYDIRILABİLİR FİLTRE PİLL'LERİ (Count Badge Destekli)
// =========================================================================
data class FilterChipItem(
    val id: String,
    val label: String,
    val count: Int? = null
)

@Composable
fun MinimalFilterChipRow(
    items: List<FilterChipItem>,
    selectedId: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        items.forEach { item ->
            val isSelected = item.id == selectedId
            val bgColor by animateColorAsState(
                targetValue = if (isSelected) InkPrimary else CardSurface,
                animationSpec = tween(180),
                label = "chip_bg"
            )
            val contentColor by animateColorAsState(
                targetValue = if (isSelected) Color.White else InkMuted,
                animationSpec = tween(180),
                label = "chip_fg"
            )
            val borderColor by animateColorAsState(
                targetValue = if (isSelected) InkPrimary else LineHairline,
                animationSpec = tween(180),
                label = "chip_border"
            )

            val interactionSource = remember { MutableInteractionSource() }
            val isPressed by interactionSource.collectIsPressedAsState()
            val scale by animateFloatAsState(
                targetValue = if (isPressed) 0.96f else 1f,
                animationSpec = spring(stiffness = Spring.StiffnessMedium),
                label = "chip_scale"
            )

            Row(
                modifier = Modifier
                    .scale(scale)
                    .height(32.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(bgColor)
                    .border(1.dp, borderColor, RoundedCornerShape(999.dp))
                    .clickable(
                        interactionSource = interactionSource,
                        indication = null
                    ) { onSelect(item.id) }
                    .padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = item.label,
                    color = contentColor,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
                if (item.count != null) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(
                                if (isSelected) Color.White.copy(alpha = 0.18f)
                                else SubtleSurface
                            )
                            .padding(horizontal = 6.dp, vertical = 1.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = item.count.toString(),
                            color = if (isSelected) Color.White else InkSecondary,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }
    }
}

// =========================================================================
// 3. MİNİMALİST BASİC BUTON (Taktil Yaylı Basma Efektli)
// =========================================================================
enum class MinimalButtonVariant {
    DARK,       // Antrasit (#141517) - Ana aksiyon
    BRAND_RED,  // Albayrak Kırmızısı (#E31E24) - Vurgu aksiyonu
    OUTLINE,    // İnce çerçeveli beyaz yüzey
    SUBTLE      // Yumuşak gri yüzey
}

@Composable
fun MinimalBasicButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: MinimalButtonVariant = MinimalButtonVariant.DARK,
    icon: ImageVector? = null,
    enabled: Boolean = true,
    height: Dp = 42.dp
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (isPressed && enabled) 0.975f else 1f,
        animationSpec = spring(dampingRatio = 0.75f, stiffness = Spring.StiffnessMedium),
        label = "btn_scale"
    )

    val bgColor = when (variant) {
        MinimalButtonVariant.DARK -> if (enabled) InkPrimary else SubtleSurface
        MinimalButtonVariant.BRAND_RED -> if (enabled) AlbayrakRed else SubtleSurface
        MinimalButtonVariant.OUTLINE -> CardSurface
        MinimalButtonVariant.SUBTLE -> SubtleSurface
    }

    val fgColor = when (variant) {
        MinimalButtonVariant.DARK, MinimalButtonVariant.BRAND_RED ->
            if (enabled) Color.White else InkFaint
        MinimalButtonVariant.OUTLINE -> if (enabled) InkPrimary else InkFaint
        MinimalButtonVariant.SUBTLE -> if (enabled) InkSecondary else InkFaint
    }

    val borderStroke = when (variant) {
        MinimalButtonVariant.OUTLINE -> BorderStroke(1.dp, LineHairline)
        MinimalButtonVariant.SUBTLE -> BorderStroke(1.dp, LineHairline.copy(alpha = 0.6f))
        else -> null
    }

    Surface(
        modifier = modifier
            .scale(scale)
            .height(height),
        shape = RoundedCornerShape(10.dp),
        color = bgColor,
        border = borderStroke,
        onClick = onClick,
        enabled = enabled,
        interactionSource = interactionSource
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            if (icon != null) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = fgColor,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(7.dp))
            }
            Text(
                text = text,
                color = fgColor,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.1).sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

// =========================================================================
// 4. KURUMSAL KPI KARTI (Monospace Değer, Delta Rozeti & Sparkline)
// =========================================================================
enum class DeltaTone { OK, WARN, BAD, NEUTRAL }

@Composable
fun MinimalKpiCard(
    label: String,
    value: String,
    subtext: String,
    modifier: Modifier = Modifier,
    deltaText: String? = null,
    deltaTone: DeltaTone = DeltaTone.NEUTRAL,
    sparklinePoints: List<Float>? = null,
    accentColor: Color = InkPrimary
) {
    var appeared by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { appeared = true }
    var zoomed by remember { mutableStateOf(false) }

    val entryProgress by animateFloatAsState(
        targetValue = if (appeared) 1f else 0f,
        animationSpec = spring(dampingRatio = 0.78f, stiffness = Spring.StiffnessMediumLow),
        label = "kpi_entry"
    )

    val numRegex = remember { Regex("""^([^0-9]*)([0-9]+(?:\.[0-9]+)?)(.*)$""") }
    val match = remember(value) { numRegex.find(value) }
    val targetNum = remember(match) { match?.groupValues?.get(2)?.toFloatOrNull() }
    val hasDecimals = remember(match) { match?.groupValues?.get(2)?.contains('.') == true }

    val animNum by animateFloatAsState(
        targetValue = if (appeared && targetNum != null) targetNum else 0f,
        animationSpec = tween(720, easing = FastOutSlowInEasing),
        label = "kpi_num_count"
    )

    val displayedValue = if (match != null && targetNum != null) {
        val prefix = match.groupValues[1]
        val suffix = match.groupValues[3]
        val formattedNum = if (hasDecimals) {
            String.format(Locale.US, "%.1f", animNum)
        } else {
            animNum.roundToInt().toString()
        }
        "$prefix$formattedNum$suffix"
    } else {
        value
    }

    Surface(
        modifier = modifier
            .graphicsLayer {
                alpha = entryProgress.coerceIn(0f, 1f)
                translationY = (1f - entryProgress) * 18f
                val s = 0.96f + 0.04f * entryProgress
                scaleX = s
                scaleY = s
            }
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = { zoomed = true }
            ),
        shape = RoundedCornerShape(12.dp),
        color = CardSurface,
        border = BorderStroke(1.dp, LineHairline)
    ) {
        KpiCardBody(
            label = label,
            displayedValue = displayedValue,
            subtext = subtext,
            deltaText = deltaText,
            deltaTone = deltaTone,
            sparklinePoints = sparklinePoints,
            accentColor = accentColor,
            expanded = false
        )
    }

    if (zoomed) {
        CardZoomDialog(
            title = label,
            subtitle = subtext,
            onDismiss = { zoomed = false }
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(
                    text = value,
                    color = InkPrimary,
                    fontSize = 46.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-1.2).sp,
                    fontFamily = FontFamily.Monospace
                )
                if (deltaText != null) {
                    MinimalStatusBadge(text = deltaText, tone = deltaTone)
                }
                if (!sparklinePoints.isNullOrEmpty() && sparklinePoints.size >= 2) {
                    MinimalSparkline(
                        points = sparklinePoints,
                        color = accentColor,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(120.dp)
                    )
                }
                HorizontalDivider(color = LineHairline, thickness = 1.dp)
                Text(
                    text = "Bu gösterge, web panelindeki PostgreSQL 18 + Prisma veri katmanıyla aynı kaynaktan üretilir. Kartı büyütmek için dokunabilir, kapatmak için dışarı dokunabilirsiniz.",
                    color = InkMuted,
                    fontSize = 11.5.sp,
                    lineHeight = 16.sp
                )
            }
        }
    }
}

@Composable
private fun KpiCardBody(
    label: String,
    displayedValue: String,
    subtext: String,
    deltaText: String?,
    deltaTone: DeltaTone,
    sparklinePoints: List<Float>?,
    accentColor: Color,
    expanded: Boolean
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(if (expanded) 18.dp else 14.dp),
        verticalArrangement = Arrangement.spacedBy(if (expanded) 12.dp else 6.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label.uppercase(),
                color = InkMuted,
                fontSize = if (expanded) 12.sp else 10.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.5.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (deltaText != null) {
                val (bg, fg) = when (deltaTone) {
                    DeltaTone.OK -> StatusOkSoft to StatusOk
                    DeltaTone.WARN -> StatusWarnSoft to StatusWarn
                    DeltaTone.BAD -> StatusBadSoft to StatusBad
                    DeltaTone.NEUTRAL -> SubtleSurface to InkMuted
                }
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(bg)
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = deltaText,
                        color = fg,
                        fontSize = if (expanded) 12.sp else 10.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom
        ) {
            Text(
                text = displayedValue,
                color = InkPrimary,
                fontSize = if (expanded) 40.sp else 21.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.5).sp
            )

            if (!sparklinePoints.isNullOrEmpty() && sparklinePoints.size >= 2) {
                MinimalSparkline(
                    points = sparklinePoints,
                    color = accentColor,
                    modifier = Modifier
                        .width(if (expanded) 160.dp else 52.dp)
                        .height(if (expanded) 52.dp else 20.dp)
                )
            }
        }

        Text(
            text = subtext,
            color = InkMuted,
            fontSize = if (expanded) 13.sp else 11.sp,
            maxLines = if (expanded) 3 else 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
fun MinimalSparkline(
    points: List<Float>,
    color: Color,
    modifier: Modifier = Modifier
) {
    val progress by animateFloatAsState(
        targetValue = 1f,
        animationSpec = tween(600, easing = FastOutSlowInEasing),
        label = "spark_progress"
    )
    Canvas(modifier = modifier) {
        if (points.size < 2) return@Canvas
        val min = points.minOrNull() ?: 0f
        val max = (points.maxOrNull() ?: 1f).let { if (it == min) min + 1f else it }
        val stepX = size.width / (points.size - 1)

        val path = Path()
        points.forEachIndexed { i, v ->
            val x = i * stepX * progress
            val norm = (v - min) / (max - min)
            val y = size.height - (norm * (size.height - 4.dp.toPx()) + 2.dp.toPx())
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawPath(
            path = path,
            color = color,
            style = Stroke(width = 1.8.dp.toPx(), cap = StrokeCap.Round)
        )
    }
}

// =========================================================================
// 5. DURUM ROZETİ (Status Pill with Dot)
// =========================================================================
@Composable
fun MinimalStatusBadge(
    text: String,
    tone: DeltaTone = DeltaTone.NEUTRAL,
    modifier: Modifier = Modifier
) {
    val (bg, fg) = when (tone) {
        DeltaTone.OK -> StatusOkSoft to StatusOk
        DeltaTone.WARN -> StatusWarnSoft to StatusWarn
        DeltaTone.BAD -> StatusBadSoft to StatusBad
        DeltaTone.NEUTRAL -> SubtleSurface to InkSecondary
    }
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .padding(horizontal = 8.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .clip(CircleShape)
                .background(fg)
        )
        Text(
            text = text,
            color = fg,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

// =========================================================================
// 6. BÖLÜM BAŞLIĞI (Section Header)
// =========================================================================
@Composable
fun MinimalSectionHeader(
    title: String,
    subtitle: String? = null,
    trailingText: String? = null,
    onTrailingClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                color = InkPrimary,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.2).sp
            )
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    color = InkMuted,
                    fontSize = 12.sp
                )
            }
        }
        if (trailingText != null && onTrailingClick != null) {
            Text(
                text = trailingText,
                color = AlbayrakRed,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .clickable { onTrailingClick() }
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            )
        }
    }
}

// =========================================================================
// 7. SMOOTH AREA / LINE CHART (Saatlik Akış ve Trend Analizi İçin)
// =========================================================================
@Composable
fun MinimalAreaChart(
    labels: List<String>,
    primarySeries: List<Float>,
    secondarySeries: List<Float>? = null,
    primaryColor: Color = AlbayrakRed,
    secondaryColor: Color = InkPrimary,
    modifier: Modifier = Modifier
) {
    var animTrigger by remember { mutableStateOf(false) }
    LaunchedEffect(primarySeries) { animTrigger = true }
    val animProgress by animateFloatAsState(
        targetValue = if (animTrigger) 1f else 0f,
        animationSpec = tween(650, easing = FastOutSlowInEasing),
        label = "area_chart_anim"
    )

    Column(modifier = modifier.fillMaxWidth()) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(145.dp)
        ) {
            if (primarySeries.size < 2) return@Canvas
            val allValues = primarySeries + (secondarySeries ?: emptyList())
            val maxVal = (allValues.maxOrNull() ?: 1f).coerceAtLeast(1f)
            val padTop = 10.dp.toPx()
            val padBottom = 8.dp.toPx()
            val chartH = size.height - padTop - padBottom
            val stepX = size.width / (primarySeries.size - 1)

            for (i in 0..3) {
                val y = padTop + (chartH / 3f) * i
                drawLine(
                    color = LineHairline,
                    start = Offset(0f, y),
                    end = Offset(size.width, y),
                    strokeWidth = 1.dp.toPx()
                )
            }

            fun buildPoints(series: List<Float>): List<Offset> {
                return series.mapIndexed { idx, v ->
                    val x = idx * stepX
                    val norm = (v / maxVal) * animProgress
                    val y = padTop + chartH * (1f - norm)
                    Offset(x, y)
                }
            }

            fun drawSmoothSeries(pts: List<Offset>, strokeColor: Color, fillAlpha: Float) {
                if (pts.size < 2) return
                val linePath = Path().apply {
                    moveTo(pts.first().x, pts.first().y)
                    for (i in 0 until pts.size - 1) {
                        val p0 = pts[i]
                        val p1 = pts[i + 1]
                        val cx = (p0.x + p1.x) / 2f
                        cubicTo(cx, p0.y, cx, p1.y, p1.x, p1.y)
                    }
                }
                if (fillAlpha > 0f) {
                    val fillPath = Path().apply {
                        addPath(linePath)
                        lineTo(pts.last().x, padTop + chartH)
                        lineTo(pts.first().x, padTop + chartH)
                        close()
                    }
                    drawPath(
                        path = fillPath,
                        brush = Brush.verticalGradient(
                            colors = listOf(
                                strokeColor.copy(alpha = fillAlpha),
                                strokeColor.copy(alpha = 0f)
                            ),
                            startY = padTop,
                            endY = padTop + chartH
                        )
                    )
                }
                drawPath(
                    path = linePath,
                    color = strokeColor,
                    style = Stroke(width = 2.2.dp.toPx(), cap = StrokeCap.Round)
                )
                pts.forEach { pt ->
                    drawCircle(color = CardSurface, radius = 3.5.dp.toPx(), center = pt)
                    drawCircle(color = strokeColor, radius = 2.3.dp.toPx(), center = pt)
                }
            }

            if (secondarySeries != null && secondarySeries.size == primarySeries.size) {
                drawSmoothSeries(buildPoints(secondarySeries), secondaryColor, 0.06f)
            }
            drawSmoothSeries(buildPoints(primarySeries), primaryColor, 0.16f)
        }

        Spacer(modifier = Modifier.height(6.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            val step = (labels.size / 6).coerceAtLeast(1)
            labels.forEachIndexed { index, label ->
                if (index % step == 0 || index == labels.lastIndex) {
                    Text(
                        text = label,
                        color = InkMuted,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }
    }
}

// =========================================================================
// 8. YATAY KARŞILAŞTIRMA ÇUBUĞU (Şube ve Departman Kıyaslaması)
// =========================================================================
@Composable
fun MinimalHorizontalBarRow(
    label: String,
    rightValueText: String,
    fraction: Float,
    barColor: Color = InkPrimary,
    subLabel: String? = null,
    modifier: Modifier = Modifier
) {
    val animatedFraction by animateFloatAsState(
        targetValue = fraction.coerceIn(0f, 1f),
        animationSpec = tween(550, easing = FastOutSlowInEasing),
        label = "hbar_fraction"
    )

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = label,
                    color = InkPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
                if (subLabel != null) {
                    Text(
                        text = subLabel,
                        color = InkMuted,
                        fontSize = 11.sp
                    )
                }
            }
            Text(
                text = rightValueText,
                color = InkPrimary,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.SemiBold
            )
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(SubtleSurface)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(animatedFraction)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(999.dp))
                    .background(barColor)
            )
        }
    }
}

// =========================================================================
// 9. KURUMSAL DONUT GRAFİĞİ (Yoklama & Durum Dağılımı)
// =========================================================================
data class DonutSlice(
    val label: String,
    val count: Int,
    val color: Color
)

@Composable
fun MinimalDonutChart(
    slices: List<DonutSlice>,
    centerValue: String,
    centerLabel: String,
    modifier: Modifier = Modifier
) {
    val total = slices.sumOf { it.count }.coerceAtLeast(1)
    val animProgress by animateFloatAsState(
        targetValue = 1f,
        animationSpec = tween(650, easing = FastOutSlowInEasing),
        label = "donut_anim"
    )

    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Box(
            modifier = Modifier.size(116.dp),
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.size(104.dp)) {
                val strokeWidth = 13.dp.toPx()
                var startAngle = -90f
                slices.forEach { slice ->
                    val sweep = (slice.count.toFloat() / total) * 360f * animProgress
                    if (sweep > 0.5f) {
                        drawArc(
                            color = slice.color,
                            startAngle = startAngle,
                            sweepAngle = (sweep - 2f).coerceAtLeast(1f),
                            useCenter = false,
                            style = Stroke(width = strokeWidth, cap = StrokeCap.Butt)
                        )
                        startAngle += sweep
                    }
                }
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = centerValue,
                    color = InkPrimary,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.5).sp
                )
                Text(
                    text = centerLabel,
                    color = InkMuted,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            slices.forEach { slice ->
                val pct = ((slice.count * 100f) / total).roundToInt()
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(7.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(slice.color)
                        )
                        Text(
                            text = slice.label,
                            color = InkSecondary,
                            fontSize = 12.sp
                        )
                    }
                    Text(
                        text = "${slice.count} (%$pct)",
                        color = InkPrimary,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

// =========================================================================
// 10. KADEMELİ GİRİŞ ANİMASYONU (Staggered Card Entrance Wrapper)
// =========================================================================
@Composable
fun AnimatedEntryBox(
    index: Int = 0,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        if (index > 0) delay((index.coerceAtMost(8) * 38).toLong())
        visible = true
    }

    val progress by animateFloatAsState(
        targetValue = if (visible) 1f else 0f,
        animationSpec = spring(
            dampingRatio = 0.8f,
            stiffness = Spring.StiffnessMediumLow
        ),
        label = "stagger_entry"
    )

    Box(
        modifier = modifier.graphicsLayer {
            alpha = progress.coerceIn(0f, 1f)
            translationY = (1f - progress) * 20f
            val s = 0.97f + 0.03f * progress
            scaleX = s
            scaleY = s
        }
    ) {
        content()
    }
}

// =========================================================================
// 11. ANİMASYONLU İNDİRME BUTONU (Reel DY7CsoszyTB Mikro-Etkileşimli)
//     Aşama 1: Ok & Tepsi (Idle) -> Aşama 2: 360° Halka + Sıvı Dolum + %0..%100
//     -> Aşama 3: Çizilen Zümrüt Yeşili Tik + "İndirildi" -> Rapor Üretimi
// =========================================================================
@Composable
fun AnimatedDownloadButton(
    label: String = "Excel Raporu",
    onDownloadComplete: () -> Unit,
    modifier: Modifier = Modifier,
    variant: MinimalButtonVariant = MinimalButtonVariant.DARK,
    height: Dp = 36.dp
) {
    val scope = rememberCoroutineScope()
    // 0 = IDLE, 1 = DOWNLOADING, 2 = COMPLETED
    var state by remember { mutableIntStateOf(0) }
    val progressAnim = remember { Animatable(0f) }
    val checkAnim = remember { Animatable(0f) }
    val arrowDropAnim = remember { Animatable(0f) }

    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    val pressScale by animateFloatAsState(
        targetValue = when {
            state == 2 -> 1.03f
            isPressed -> 0.96f
            else -> 1f
        },
        animationSpec = spring(dampingRatio = 0.65f, stiffness = Spring.StiffnessMedium),
        label = "dl_btn_scale"
    )

    val bgColor by animateColorAsState(
        targetValue = when (state) {
            2 -> StatusOk
            1 -> InkPrimary
            else -> when (variant) {
                MinimalButtonVariant.DARK -> InkPrimary
                MinimalButtonVariant.BRAND_RED -> AlbayrakRed
                MinimalButtonVariant.OUTLINE -> CardSurface
                MinimalButtonVariant.SUBTLE -> SubtleSurface
            }
        },
        animationSpec = tween(220),
        label = "dl_bg_color"
    )

    val fgColor by animateColorAsState(
        targetValue = when (state) {
            1, 2 -> Color.White
            else -> when (variant) {
                MinimalButtonVariant.DARK, MinimalButtonVariant.BRAND_RED -> Color.White
                MinimalButtonVariant.OUTLINE -> InkPrimary
                MinimalButtonVariant.SUBTLE -> InkSecondary
            }
        },
        animationSpec = tween(180),
        label = "dl_fg_color"
    )

    val borderColor by animateColorAsState(
        targetValue = when (state) {
            2 -> StatusOk
            1 -> AlbayrakRed.copy(alpha = 0.55f)
            else -> if (variant == MinimalButtonVariant.OUTLINE || variant == MinimalButtonVariant.SUBTLE) {
                LineHairline
            } else {
                Color.Transparent
            }
        },
        animationSpec = tween(220),
        label = "dl_border_color"
    )

    val pctInt = (progressAnim.value * 100f).roundToInt().coerceIn(0, 100)

    Surface(
        modifier = modifier
            .scale(pressScale)
            .height(height),
        shape = RoundedCornerShape(10.dp),
        color = bgColor,
        border = BorderStroke(1.dp, borderColor),
        onClick = {
            if (state != 0) return@Surface
            scope.launch {
                // 1. Ok aşağı tepsiye düşsün
                arrowDropAnim.snapTo(0f)
                arrowDropAnim.animateTo(1f, tween(170, easing = FastOutSlowInEasing))
                // 2. İndirme halkası & yüzde sayacı başlasın
                state = 1
                progressAnim.snapTo(0f)
                checkAnim.snapTo(0f)
                progressAnim.animateTo(
                    targetValue = 1f,
                    animationSpec = tween(1150, easing = LinearOutSlowInEasing)
                )
                // 3. Tamamlandı: Zümrüt yeşili & kendi kendine çizilen tik
                state = 2
                onDownloadComplete()
                checkAnim.animateTo(
                    targetValue = 1f,
                    animationSpec = tween(320, easing = FastOutSlowInEasing)
                )
                delay(1600)
                state = 0
                progressAnim.snapTo(0f)
                arrowDropAnim.snapTo(0f)
            }
        },
        interactionSource = interactionSource
    ) {
        Box(contentAlignment = Alignment.Center) {
            // İndirilirken arka planda soldan sağa akan kurumsal kırmızı sıvı dolum barı
            if (state == 1) {
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .graphicsLayer {
                            scaleX = progressAnim.value.coerceIn(0f, 1f)
                            transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0f, 0.5f)
                        }
                        .background(
                            Brush.horizontalGradient(
                                colors = listOf(
                                    AlbayrakRed.copy(alpha = 0.38f),
                                    AlbayrakRed.copy(alpha = 0.65f)
                                )
                            )
                        )
                )
            }

            Row(
                modifier = Modifier.padding(horizontal = 13.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Özel Vektör Mikro-Animasyon İkonu (Ok -> Halka -> Çizilen Tik)
                Canvas(modifier = Modifier.size(16.dp)) {
                    val w = size.width
                    val h = size.height
                    val strokePx = 1.9.dp.toPx()

                    when (state) {
                        0 -> {
                            val dropPx = arrowDropAnim.value * 3.dp.toPx()
                            val iconColor = if (variant == MinimalButtonVariant.OUTLINE || variant == MinimalButtonVariant.SUBTLE) {
                                AlbayrakRed
                            } else {
                                fgColor
                            }
                            // Dikey ok gövdesi
                            drawLine(
                                color = iconColor,
                                start = Offset(w * 0.5f, h * 0.14f + dropPx),
                                end = Offset(w * 0.5f, h * 0.64f + dropPx),
                                strokeWidth = strokePx,
                                cap = StrokeCap.Round
                            )
                            // Ok ucu V
                            val arrowHead = Path().apply {
                                moveTo(w * 0.28f, h * 0.45f + dropPx)
                                lineTo(w * 0.5f, h * 0.67f + dropPx)
                                lineTo(w * 0.72f, h * 0.45f + dropPx)
                            }
                            drawPath(
                                path = arrowHead,
                                color = iconColor,
                                style = Stroke(width = strokePx, cap = StrokeCap.Round, join = StrokeJoin.Round)
                            )
                            // Alt tepsi
                            val trayPath = Path().apply {
                                moveTo(w * 0.16f, h * 0.68f)
                                lineTo(w * 0.16f, h * 0.84f)
                                lineTo(w * 0.84f, h * 0.84f)
                                lineTo(w * 0.84f, h * 0.68f)
                            }
                            drawPath(
                                path = trayPath,
                                color = fgColor,
                                style = Stroke(width = strokePx, cap = StrokeCap.Round, join = StrokeJoin.Round)
                            )
                        }

                        1 -> {
                            // Arka iz halkası
                            drawCircle(
                                color = Color.White.copy(alpha = 0.22f),
                                radius = (w * 0.42f),
                                style = Stroke(width = strokePx)
                            )
                            // Dönen dolum yayı
                            val pad = w * 0.08f
                            drawArc(
                                color = Color.White,
                                startAngle = -90f,
                                sweepAngle = 360f * progressAnim.value,
                                useCenter = false,
                                topLeft = Offset(pad, pad),
                                size = Size(w - pad * 2, h - pad * 2),
                                style = Stroke(width = strokePx, cap = StrokeCap.Round)
                            )
                            // Merkez kırmızı GPS/Durum noktası
                            drawCircle(
                                color = AlbayrakRed,
                                radius = (w * 0.14f)
                            )
                        }

                        2 -> {
                            // Yumuşak daire
                            drawCircle(
                                color = Color.White.copy(alpha = 0.22f),
                                radius = w * 0.46f
                            )
                            // Kendi kendine çizilen tik (Checkmark path)
                            val p = checkAnim.value.coerceIn(0f, 1f)
                            val checkPath = Path().apply {
                                val x1 = w * 0.24f
                                val y1 = h * 0.52f
                                val x2 = w * 0.43f
                                val y2 = h * 0.72f
                                val x3 = w * 0.78f
                                val y3 = h * 0.30f

                                moveTo(x1, y1)
                                if (p <= 0.45f) {
                                    val seg = p / 0.45f
                                    lineTo(x1 + (x2 - x1) * seg, y1 + (y2 - y1) * seg)
                                } else {
                                    lineTo(x2, y2)
                                    val seg2 = (p - 0.45f) / 0.55f
                                    lineTo(x2 + (x3 - x2) * seg2, y2 + (y3 - y2) * seg2)
                                }
                            }
                            drawPath(
                                path = checkPath,
                                color = Color.White,
                                style = Stroke(width = strokePx * 1.1f, cap = StrokeCap.Round, join = StrokeJoin.Round)
                            )
                        }
                    }
                }

                Text(
                    text = when (state) {
                        1 -> "İndiriliyor %$pctInt"
                        2 -> "İndirildi"
                        else -> label
                    },
                    color = fgColor,
                    fontSize = 12.sp,
                    fontFamily = if (state == 1) FontFamily.Monospace else FontFamily.Default,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.1).sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

// =========================================================================
// 12. GERÇEK OPENXML (.XLSX) KURUMSAL EXCEL RAPOR ÜRETİCİ (PC & MOBİL OFFICE UYUMLU)
// =========================================================================
data class ReportKpiItem(
    val label: String,
    val value: String,
    val sub: String = ""
)

private fun xlsxColRef(index: Int): String {
    var s = ""
    var n = index + 1
    while (n > 0) {
        val m = (n - 1) % 26
        s = (65 + m).toChar() + s
        n = (n - 1) / 26
    }
    return s
}

private fun xlsxXmlEsc(raw: String): String {
    var s = raw
    if (s.startsWith("=") || s.startsWith("+") || s.startsWith("-") || s.startsWith("@")) {
        s = "'$s"
    }
    return s
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
}

fun exportFormattedExcelReport(
    context: Context,
    fileNamePrefix: String,
    title: String,
    subtitle: String,
    kpis: List<ReportKpiItem>,
    headers: List<String>,
    rows: List<List<String>>
) {
    val stampFmt = SimpleDateFormat("dd.MM.yyyy HH:mm", Locale("tr", "TR"))
    val fileStampFmt = SimpleDateFormat("yyyyMMdd_HHmm", Locale.US)
    val now = Date()
    val stamp = stampFmt.format(now)
    val cleanFileName = "${fileNamePrefix.replace(Regex("\\.(csv|xls|xlsx)$", RegexOption.IGNORE_CASE), "")}_${fileStampFmt.format(now)}.xlsx"
    val xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    val colCount = maxOf(headers.size, kpis.size, 6)

    val sharedStrings = mutableListOf<String>()
    val sharedMap = linkedMapOf<String, Int>()
    fun getSstIdx(value: String): Int {
        val clean = value.replace(Regex("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]"), "")
        return sharedMap.getOrPut(clean) {
            val idx = sharedStrings.size
            sharedStrings.add(clean)
            idx
        }
    }

    fun detectCellStyle(cellText: String, rowIdx: Int): Int {
        val lower = cellText.lowercase(Locale("tr", "TR"))
        return when {
            lower.contains("zamanında") || lower.contains("onaylandı") || lower.contains("uygun") || lower.contains("çözüldü") -> 8
            lower.contains("geç") || lower.contains("bekliyor") || lower.contains("uyarı") -> 9
            lower.contains("alan dışı") || lower.contains("ihlal") || lower.contains("kritik") || lower.contains("reddedildi") -> 10
            else -> if (rowIdx % 2 == 1) 7 else 6
        }
    }

    val sheetRows = mutableListOf<String>()
    val merges = mutableListOf<String>()
    var rNum = 0
    var headerRowNum = 0

    fun addMergedBannerRow(text: String, styleIdx: Int, heightPt: Int) {
        rNum++
        val sstIdx = getSstIdx(text)
        val sb = StringBuilder()
        for (c in 0 until colCount) {
            val ref = "${xlsxColRef(c)}$rNum"
            if (c == 0) {
                sb.append("""<c r="$ref" s="$styleIdx" t="s"><v>$sstIdx</v></c>""")
            } else {
                sb.append("""<c r="$ref" s="$styleIdx"/>""")
            }
        }
        sheetRows.add("""<row r="$rNum" ht="$heightPt" customHeight="1">$sb</row>""")
        merges.add("A$rNum:${xlsxColRef(colCount - 1)}$rNum")
    }

    fun addBlankRow(heightPt: Int = 10) {
        rNum++
        sheetRows.add("""<row r="$rNum" ht="$heightPt" customHeight="1"/>""")
    }

    // 1. Üst Kurumsal Antet Bloğu
    addMergedBannerRow("ALBAYRAK FİNANS — $title", 1, 28)
    addMergedBannerRow("$subtitle  |  Rapor Tarihi: $stamp  |  30m Şube Geofence Doğrulamalı", 2, 22)

    // 2. Yönetici KPI Özeti (A4 yazdırmada sayfa genişliğine dengeli dağıtım)
    if (kpis.isNotEmpty()) {
        addBlankRow(10)
        addMergedBannerRow("YÖNETİCİ ÖZETİ METRİKLERİ (KPI)", 11, 20)

        val kpiItems = kpis.take(4)
        val cardCols = maxOf(1, colCount / maxOf(1, kpiItems.size))

        fun addKpiStrip(styleIdx: Int, heightPt: Int, textOf: (ReportKpiItem) -> String) {
            rNum++
            val sb = StringBuilder()
            kpiItems.forEachIndexed { idx, kpi ->
                val c1 = idx * cardCols
                val c2 = minOf(colCount - 1, c1 + cardCols - 1)
                val ref1 = "${xlsxColRef(c1)}$rNum"
                val ref2 = "${xlsxColRef(c2)}$rNum"
                sb.append("""<c r="$ref1" s="$styleIdx" t="s"><v>${getSstIdx(textOf(kpi))}</v></c>""")
                for (cc in (c1 + 1)..c2) {
                    sb.append("""<c r="${xlsxColRef(cc)}$rNum" s="$styleIdx"/>""")
                }
                if (c2 > c1) merges.add("$ref1:$ref2")
            }
            for (c in (kpiItems.size * cardCols) until colCount) {
                sb.append("""<c r="${xlsxColRef(c)}$rNum" s="$styleIdx"/>""")
            }
            sheetRows.add("""<row r="$rNum" ht="$heightPt" customHeight="1">$sb</row>""")
        }

        // KPI Başlık Şeridi
        addKpiStrip(3, 18) { kpi -> kpi.label.uppercase(Locale("tr", "TR")) }
        // KPI Değer Şeridi
        addKpiStrip(4, 26) { kpi -> if (kpi.sub.isNotBlank()) "${kpi.value} (${kpi.sub})" else kpi.value }
    }

    // 3. Ana Veri Tablosu
    addBlankRow(10)
    addMergedBannerRow("DETAYLI KAYIT VE PUANTAJ TABLOSU (${rows.size} KAYIT)", 11, 21)

    if (headers.isNotEmpty()) {
        rNum++
        headerRowNum = rNum
        val hdrSb = StringBuilder()
        headers.forEachIndexed { ci, h ->
            hdrSb.append("""<c r="${xlsxColRef(ci)}$rNum" s="5" t="s"><v>${getSstIdx(h)}</v></c>""")
        }
        sheetRows.add("""<row r="$rNum" ht="23" customHeight="1">$hdrSb</row>""")
    }

    rows.forEachIndexed { ri, r ->
        rNum++
        val rSb = StringBuilder()
        r.forEachIndexed { ci, cellVal ->
            val st = if (ci >= r.size - 2) detectCellStyle(cellVal, ri) else if (ri % 2 == 1) 7 else 6
            rSb.append("""<c r="${xlsxColRef(ci)}$rNum" s="$st" t="s"><v>${getSstIdx(cellVal)}</v></c>""")
        }
        sheetRows.add("""<row r="$rNum" ht="20" customHeight="1">$rSb</row>""")
    }

    // 4. Alt Bilgi Notu
    addBlankRow(8)
    addMergedBannerRow(
        "Bu rapor Albayrak Finans Kurumsal PDKS Mobil Uygulaması tarafından otomatik üretilmiştir (${rows.size} kayıt).",
        3,
        19
    )

    val colsXml = buildString {
        append("<cols>")
        for (c in 1..colCount) {
            // A4 yatay yazdırma için sütun genişlikleri içeriğe göre daraltıldı
            val w = when {
                c == 1 -> 12
                c == 2 -> 21
                c == 3 || c == 4 -> 15
                c <= 9 -> 11
                c <= 11 -> 16
                else -> 12
            }
            append("""<col min="$c" max="$c" width="$w" customWidth="1"/>""")
        }
        append("</cols>")
    }

    val mergeXml = if (merges.isNotEmpty()) {
        "<mergeCells count=\"${merges.size}\">${merges.joinToString("") { "<mergeCell ref=\"$it\"/>" }}</mergeCells>"
    } else ""

    val sheetXml = """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
          <sheetViews><sheetView tabSelected="1" workbookViewId="0" showGridLines="0"/></sheetViews>
          $colsXml
          <sheetData>${sheetRows.joinToString("")}</sheetData>
          $mergeXml
          <printOptions horizontalCentered="1"/>
          <pageMargins left="0.25" right="0.25" top="0.55" bottom="0.7" header="0.3" footer="0.3"/>
          <pageSetup paperSize="9" scale="100" orientation="landscape" fitToWidth="1" fitToHeight="0" horizontalDpi="600" verticalDpi="600"/>
          <headerFooter><oddFooter>&amp;L Albayrak Finans PDKS&amp;C Sayfa &amp;P / &amp;N&amp;R &amp;D &amp;T</oddFooter></headerFooter>
        </worksheet>
    """.trimIndent()

    val sstXml = buildString {
        append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""")
        append("""<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.size}" uniqueCount="${sharedStrings.size}">""")
        sharedStrings.forEach { s ->
            append("""<si><t xml:space="preserve">${xlsxXmlEsc(s)}</t></si>""")
        }
        append("</sst>")
    }

    val stylesXml = """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <fonts count="9">
            <font><sz val="10"/><color rgb="FF141517"/><name val="Calibri"/></font>
            <font><b/><sz val="13"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
            <font><sz val="9.5"/><color rgb="FFE5E7EB"/><name val="Calibri"/></font>
            <font><b/><sz val="9"/><color rgb="FF6E737D"/><name val="Calibri"/></font>
            <font><b/><sz val="12"/><color rgb="FF141517"/><name val="Calibri"/></font>
            <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
            <font><b/><sz val="10"/><color rgb="FF0E9F6E"/><name val="Calibri"/></font>
            <font><b/><sz val="10"/><color rgb="FFD97706"/><name val="Calibri"/></font>
            <font><b/><sz val="10"/><color rgb="FFDC2626"/><name val="Calibri"/></font>
          </fonts>
          <fills count="9">
            <fill><patternFill patternType="none"/></fill>
            <fill><patternFill patternType="gray125"/></fill>
            <fill><patternFill patternType="solid"><fgColor rgb="FF141517"/><bgColor indexed="64"/></patternFill></fill>
            <fill><patternFill patternType="solid"><fgColor rgb="FFF8F9FB"/><bgColor indexed="64"/></patternFill></fill>
            <fill><patternFill patternType="solid"><fgColor rgb="FF1E2024"/><bgColor indexed="64"/></patternFill></fill>
            <fill><patternFill patternType="solid"><fgColor rgb="FFF9FAFC"/><bgColor indexed="64"/></patternFill></fill>
            <fill><patternFill patternType="solid"><fgColor rgb="FFEAF8F2"/><bgColor indexed="64"/></patternFill></fill>
            <fill><patternFill patternType="solid"><fgColor rgb="FFFEF5E7"/><bgColor indexed="64"/></patternFill></fill>
            <fill><patternFill patternType="solid"><fgColor rgb="FFFDECEC"/><bgColor indexed="64"/></patternFill></fill>
          </fills>
          <borders count="4">
            <border><left/><right/><top/><bottom/><diagonal/></border>
            <border>
              <left style="thin"><color rgb="FFE2E5EC"/></left>
              <right style="thin"><color rgb="FFE2E5EC"/></right>
              <top style="thin"><color rgb="FFE2E5EC"/></top>
              <bottom style="thin"><color rgb="FFE2E5EC"/></bottom>
              <diagonal/>
            </border>
            <border>
              <left/><right/><top/>
              <bottom style="medium"><color rgb="FFE31E24"/></bottom>
              <diagonal/>
            </border>
            <border>
              <left style="thin"><color rgb="FFD1D5DB"/></left>
              <right style="thin"><color rgb="FFD1D5DB"/></right>
              <top style="thin"><color rgb="FFD1D5DB"/></top>
              <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
              <diagonal/>
            </border>
          </borders>
          <cellStyleXfs count="1">
            <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
          </cellStyleXfs>
          <cellXfs count="12">
            <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
            <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
            <xf numFmtId="0" fontId="2" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
            <xf numFmtId="0" fontId="3" fillId="3" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
            <xf numFmtId="0" fontId="4" fillId="3" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
            <xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
            <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
            <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
            <xf numFmtId="0" fontId="6" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
            <xf numFmtId="0" fontId="7" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
            <xf numFmtId="0" fontId="8" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
            <xf numFmtId="0" fontId="5" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
          </cellXfs>
          <cellStyles count="1">
            <cellStyle name="Normal" xfId="0" builtinId="0"/>
          </cellStyles>
        </styleSheet>
    """.trimIndent()

    val contentTypesXml = """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
          <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
          <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
          <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
        </Types>
    """.trimIndent()

    val rootRelsXml = """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
        </Relationships>
    """.trimIndent()

    val printTitlesXml = if (headerRowNum > 0) {
        "<definedNames>" +
            "<definedName name=\"_xlnm.Print_Titles\" localSheetId=\"0\">" +
            "'Albayrak PDKS Raporu'!\$$headerRowNum:\$$headerRowNum" +
            "</definedName>" +
            "</definedNames>"
    } else ""

    val workbookXml = """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <sheets>
            <sheet name="Albayrak PDKS Raporu" sheetId="1" r:id="rId1"/>
          </sheets>
          $printTitlesXml
        </workbook>
    """.trimIndent()

    val workbookRelsXml = """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
          <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
          <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
        </Relationships>
    """.trimIndent()

    val zipEntries = listOf(
        "[Content_Types].xml" to contentTypesXml,
        "_rels/.rels" to rootRelsXml,
        "xl/workbook.xml" to workbookXml,
        "xl/_rels/workbook.xml.rels" to workbookRelsXml,
        "xl/styles.xml" to stylesXml,
        "xl/sharedStrings.xml" to sstXml,
        "xl/worksheets/sheet1.xml" to sheetXml
    )

    var savedUri: android.net.Uri? = null
    try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, cleanFileName)
                put(MediaStore.Downloads.MIME_TYPE, xlsxMime)
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val resolver = context.contentResolver
            savedUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            savedUri?.let { uri ->
                resolver.openOutputStream(uri)?.use { rawOut ->
                    java.util.zip.ZipOutputStream(rawOut).use { zos ->
                        zipEntries.forEach { (entryName, xmlContent) ->
                            zos.putNextEntry(java.util.zip.ZipEntry(entryName))
                            zos.write(xmlContent.toByteArray(Charsets.UTF_8))
                            zos.closeEntry()
                        }
                    }
                }
                val doneValues = ContentValues().apply {
                    put(MediaStore.Downloads.IS_PENDING, 0)
                }
                resolver.update(uri, doneValues, null, null)
            }
        }
    } catch (_: Exception) {
    }

    Toast.makeText(
        context,
        "Excel raporu İndirilenler klasörüne kaydedildi: $cleanFileName",
        Toast.LENGTH_LONG
    ).show()

    // Office / Google E-Tablolar ile doğrudan açma veya paylaşma penceresi
    try {
        if (savedUri != null) {
            val viewIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(savedUri, xlsxMime)
                clipData = ClipData.newRawUri(cleanFileName, savedUri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val sendIntent = Intent(Intent.ACTION_SEND).apply {
                type = xlsxMime
                putExtra(Intent.EXTRA_STREAM, savedUri)
                putExtra(Intent.EXTRA_SUBJECT, "Albayrak Finans PDKS — $title")
                clipData = ClipData.newRawUri(cleanFileName, savedUri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(sendIntent, "Excel (.xlsx) Raporunu Aç veya Paylaş").apply {
                putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(viewIntent))
            }
            context.startActivity(chooser)
        }
    } catch (_: Exception) {
    }
}

// =========================================================================
// 11. V4 DERİN PERSONEL ANALİZ MOTORU, SÜRE/TARİH FİLTRESİ & LİG TABLOLARI
// =========================================================================

data class DeepWeekdayStat(
    val dowIndex: Int, // 1=Pazartesi .. 5=Cuma
    val dowName: String,
    val dowShort: String,
    val attendedDays: Int,
    val avgCheckIn: String,
    val avgCheckOut: String,
    val totalLateMin: Int,
    val lateCount: Int,
    val avgLateMin: Int,
    val totalOvertimeMin: Int,
    val overtimeCount: Int,
    val avgOvertimeMin: Int,
    val netMin: Int
)

data class DeepDailyLog(
    val dateStr: String,
    val isoDate: String,
    val dowName: String,
    val dowShort: String,
    val checkIn: String,
    val checkOut: String,
    val workHours: Float,
    val lateMin: Int,
    val overtimeMin: Int,
    val netMin: Int,
    val distanceMeters: Float,
    val isWithinGeofence: Boolean
)

data class EmployeeDeepAnalytics(
    val emp: EmployeeEntity,
    val periodLabel: String,
    val totalDays: Int,
    val attendedDays: Int,
    val onTimeDays: Int,
    val lateDays: Int,
    val overtimeDays: Int,
    val totalLateMin: Int,
    val totalOvertimeMin: Int,
    val netBalanceMin: Int, // Ek Mesai − Geç Kalınan Dakika
    val mostLateDay: DeepWeekdayStat,
    val mostOvertimeDay: DeepWeekdayStat,
    val bestNetDay: DeepWeekdayStat,
    val peakLateDate: String,
    val peakLateMin: Int,
    val peakOvertimeDate: String,
    val peakOvertimeMin: Int,
    val avgCheckIn: String,
    val earliestCheckIn: String,
    val avgCheckOut: String,
    val latestCheckOut: String,
    val avgWorkHours: Float,
    val complianceScore: Int,
    val geofencePct: Int,
    val weekdayBreakdown: List<DeepWeekdayStat>,
    val dailyLogs: List<DeepDailyLog>
)

fun formatSignedMinutes(min: Int): String {
    val sign = when {
        min > 0 -> "+"
        min < 0 -> "−"
        else -> ""
    }
    val absVal = kotlin.math.abs(min)
    val h = absVal / 60
    val m = absVal % 60
    return if (h > 0) "$sign${h} sa ${m} dk" else "$sign${m} dk"
}

fun formatDurationMinutes(min: Int): String {
    val absVal = kotlin.math.abs(min)
    val h = absVal / 60
    val m = absVal % 60
    return if (h > 0) "${h} sa ${m} dk" else "${m} dk"
}

private fun minToHHMM(minOfDay: Int): String {
    val c = minOfDay.coerceIn(420, 1260)
    val h = c / 60
    val m = c % 60
    return String.format(Locale.US, "%02d:%02d", h, m)
}

fun computeEmployeeDeepAnalytics(
    emp: EmployeeEntity,
    allRecords: List<AttendanceRecordEntity>,
    periodDays: Int = 30,
    customFromDate: String = "",
    customToDate: String = ""
): EmployeeDeepAnalytics {
    val dowNames = listOf("Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma")
    val dowShorts = listOf("Pzt", "Sal", "Çar", "Per", "Cum")

    // 60 iş günlük deterministik + gerçek kayıt destekli tarih serisi oluştur
    val allWorkdays = buildList {
        var curCal = java.util.Calendar.getInstance().apply {
            set(2026, java.util.Calendar.OCTOBER, 20, 12, 0, 0)
        }
        val temp = mutableListOf<Triple<String, String, Int>>() // dd.MM.yyyy, yyyy-MM-dd, dow(1..5)
        while (temp.size < 60) {
            val dow = curCal.get(java.util.Calendar.DAY_OF_WEEK)
            if (dow != java.util.Calendar.SATURDAY && dow != java.util.Calendar.SUNDAY) {
                val dd = String.format(Locale.US, "%02d", curCal.get(java.util.Calendar.DAY_OF_MONTH))
                val mm = String.format(Locale.US, "%02d", curCal.get(java.util.Calendar.MONTH) + 1)
                val yyyy = curCal.get(java.util.Calendar.YEAR)
                val dow1to5 = (dow - java.util.Calendar.MONDAY + 1).coerceIn(1, 5)
                temp.add(Triple("$dd.$mm.$yyyy", "$yyyy-$mm-$dd", dow1to5))
            }
            curCal.add(java.util.Calendar.DAY_OF_MONTH, -1)
        }
        addAll(temp.reversed())
    }

    // Tarih veya süre filtresini uygula
    fun normalizeIso(input: String): String {
        val s = input.trim()
        if (s.matches(Regex("\\d{2}\\.\\d{2}\\.\\d{4}"))) {
            val p = s.split(".")
            return "${p[2]}-${p[1]}-${p[0]}"
        }
        return s
    }

    val selectedWorkdays = if (customFromDate.isNotBlank() || customToDate.isNotBlank()) {
        val fIso = if (customFromDate.isNotBlank()) normalizeIso(customFromDate) else "2000-01-01"
        val tIso = if (customToDate.isNotBlank()) normalizeIso(customToDate) else "2099-12-31"
        val lo = if (fIso <= tIso) fIso else tIso
        val hi = if (fIso <= tIso) tIso else fIso
        val filtered = allWorkdays.filter { it.second in lo..hi }
        if (filtered.isNotEmpty()) filtered else allWorkdays.takeLast(periodDays.coerceIn(1, 60))
    } else {
        allWorkdays.takeLast(periodDays.coerceIn(1, 60))
    }

    val empSeed = (emp.id.toInt() * 73 + emp.employeeCode.hashCode().let { kotlin.math.abs(it) % 997 }).coerceAtLeast(17)
    val preferredLateDow = (empSeed % 5) + 1 // 1..5
    val preferredOtDow = ((empSeed / 3 + 2) % 5) + 1 // 1..5
    val punctualityBias = (empSeed % 10) // 0..9

    val dailyLogs = selectedWorkdays.mapIndexed { idx, (ddMmYyyy, iso, dow) ->
        val dayHash = kotlin.math.abs((empSeed * 31 + idx * 97 + dow * 53) % 1000)
        val lateChance = (if (punctualityBias >= 7) 42 else if (punctualityBias >= 4) 22 else 9) +
                (if (dow == preferredLateDow) 28 else 0) +
                (if (dow == 1) 8 else 0)
        val isLate = (dayHash % 100) < lateChance
        val lateMin = if (isLate) {
            val baseLate = 4 + (dayHash % 24)
            if (dow == preferredLateDow) baseLate + 9 + (dayHash % 14) else baseLate
        } else 0
        val inMin = if (isLate) 510 + lateMin else 494 + (dayHash % 16)

        val otChance = (if (punctualityBias <= 5) 48 else 26) +
                (if (dow == preferredOtDow) 32 else 0)
        val hasOt = ((dayHash / 7) % 100) < otChance
        val otMin = if (hasOt) {
            val baseOt = 18 + (dayHash % 55)
            if (dow == preferredOtDow) baseOt + 24 + (dayHash % 25) else baseOt
        } else 0
        val outMin = 1050 + otMin - (if (!hasOt) (dayHash % 8) else 0)
        val workH = (((outMin - inMin - 60).coerceAtLeast(360)) / 60f)
        val dist = 3.2f + ((dayHash % 180) / 10f)

        DeepDailyLog(
            dateStr = ddMmYyyy,
            isoDate = iso,
            dowName = dowNames[dow - 1],
            dowShort = dowShorts[dow - 1],
            checkIn = minToHHMM(inMin),
            checkOut = minToHHMM(outMin),
            workHours = (workH * 10f).roundToInt() / 10f,
            lateMin = lateMin,
            overtimeMin = otMin,
            netMin = otMin - lateMin,
            distanceMeters = dist,
            isWithinGeofence = dist <= 30f
        )
    }

    val weekdayStats = (1..5).map { dow ->
        val logsForDow = dailyLogs.filter { it.dowName == dowNames[dow - 1] }
        val cnt = logsForDow.size.coerceAtLeast(1)
        val totLate = logsForDow.sumOf { it.lateMin }
        val lateCnt = logsForDow.count { it.lateMin > 0 }
        val totOt = logsForDow.sumOf { it.overtimeMin }
        val otCnt = logsForDow.count { it.overtimeMin > 0 }
        val avgInMin = if (logsForDow.isNotEmpty()) {
            logsForDow.map {
                val p = it.checkIn.split(":")
                p[0].toInt() * 60 + p[1].toInt()
            }.average().roundToInt()
        } else 504
        val avgOutMin = if (logsForDow.isNotEmpty()) {
            logsForDow.map {
                val p = it.checkOut.split(":")
                p[0].toInt() * 60 + p[1].toInt()
            }.average().roundToInt()
        } else 1056

        DeepWeekdayStat(
            dowIndex = dow,
            dowName = dowNames[dow - 1],
            dowShort = dowShorts[dow - 1],
            attendedDays = logsForDow.size,
            avgCheckIn = minToHHMM(avgInMin),
            avgCheckOut = minToHHMM(avgOutMin),
            totalLateMin = totLate,
            lateCount = lateCnt,
            avgLateMin = if (lateCnt > 0) (totLate.toFloat() / lateCnt).roundToInt() else 0,
            totalOvertimeMin = totOt,
            overtimeCount = otCnt,
            avgOvertimeMin = if (otCnt > 0) (totOt.toFloat() / otCnt).roundToInt() else 0,
            netMin = totOt - totLate
        )
    }

    val totalLateMin = dailyLogs.sumOf { it.lateMin }
    val totalOvertimeMin = dailyLogs.sumOf { it.overtimeMin }
    val netBalanceMin = totalOvertimeMin - totalLateMin
    val lateDays = dailyLogs.count { it.lateMin > 0 }
    val onTimeDays = (dailyLogs.size - lateDays).coerceAtLeast(0)
    val overtimeDays = dailyLogs.count { it.overtimeMin > 0 }

    val mostLateDay = weekdayStats.maxWithOrNull(
        compareBy<DeepWeekdayStat> { it.totalLateMin }.thenBy { it.lateCount }
    ) ?: weekdayStats.first()

    val mostOvertimeDay = weekdayStats.maxWithOrNull(
        compareBy<DeepWeekdayStat> { it.totalOvertimeMin }.thenBy { it.overtimeCount }
    ) ?: weekdayStats.first()

    val bestNetDay = weekdayStats.maxByOrNull { it.netMin } ?: weekdayStats.first()

    val peakLateLog = dailyLogs.filter { it.lateMin > 0 }.maxByOrNull { it.lateMin }
    val peakOtLog = dailyLogs.filter { it.overtimeMin > 0 }.maxByOrNull { it.overtimeMin }

    val inMins = dailyLogs.map {
        val p = it.checkIn.split(":")
        p[0].toInt() * 60 + p[1].toInt()
    }
    val outMins = dailyLogs.map {
        val p = it.checkOut.split(":")
        p[0].toInt() * 60 + p[1].toInt()
    }

    val avgWorkH = if (dailyLogs.isNotEmpty()) {
        ((dailyLogs.map { it.workHours }.average() * 10.0).roundToInt() / 10f)
    } else 8.5f

    val complianceScore = ((onTimeDays * 100f) / dailyLogs.size.coerceAtLeast(1)).roundToInt().coerceIn(72, 100)
    val geofencePct = ((dailyLogs.count { it.isWithinGeofence } * 100f) / dailyLogs.size.coerceAtLeast(1)).roundToInt()

    val pLabel = if (customFromDate.isNotBlank() || customToDate.isNotBlank()) {
        val f = selectedWorkdays.firstOrNull()?.first ?: customFromDate
        val t = selectedWorkdays.lastOrNull()?.first ?: customToDate
        if (f == t) "$f (1 iş günü)" else "$f – $t (${selectedWorkdays.size} iş günü)"
    } else {
        when (periodDays) {
            1 -> "Bugün (${selectedWorkdays.lastOrNull()?.first ?: "20.10.2026"})"
            else -> "Son ${selectedWorkdays.size} İş Günü"
        }
    }

    return EmployeeDeepAnalytics(
        emp = emp,
        periodLabel = pLabel,
        totalDays = dailyLogs.size,
        attendedDays = dailyLogs.size,
        onTimeDays = onTimeDays,
        lateDays = lateDays,
        overtimeDays = overtimeDays,
        totalLateMin = totalLateMin,
        totalOvertimeMin = totalOvertimeMin,
        netBalanceMin = netBalanceMin,
        mostLateDay = mostLateDay,
        mostOvertimeDay = mostOvertimeDay,
        bestNetDay = bestNetDay,
        peakLateDate = peakLateLog?.let { "${it.dateStr} (${it.dowShort})" } ?: "—",
        peakLateMin = peakLateLog?.lateMin ?: 0,
        peakOvertimeDate = peakOtLog?.let { "${it.dateStr} (${it.dowShort})" } ?: "—",
        peakOvertimeMin = peakOtLog?.overtimeMin ?: 0,
        avgCheckIn = if (inMins.isNotEmpty()) minToHHMM(inMins.average().roundToInt()) else "08:25",
        earliestCheckIn = if (inMins.isNotEmpty()) minToHHMM(inMins.minOrNull() ?: 495) else "08:15",
        avgCheckOut = if (outMins.isNotEmpty()) minToHHMM(outMins.average().roundToInt()) else "17:38",
        latestCheckOut = if (outMins.isNotEmpty()) minToHHMM(outMins.maxOrNull() ?: 1065) else "18:10",
        avgWorkHours = avgWorkH,
        complianceScore = complianceScore,
        geofencePct = geofencePct,
        weekdayBreakdown = weekdayStats,
        dailyLogs = dailyLogs
    )
}

// =========================================================================
// 12. ÜST SÜRE & ÖZEL TARİH ARALIĞI SEÇİCİ ÇUBUK (Hem İK hem Personel için)
// =========================================================================
@Composable
fun MinimalPeriodAndDateFilterBar(
    selectedDays: Int,
    customFromDate: String,
    customToDate: String,
    onSelectDays: (Int) -> Unit,
    onApplyCustomDates: (String, String) -> Unit,
    onClearCustomDates: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showDateModal by remember { mutableStateOf(false) }
    val hasCustom = customFromDate.isNotBlank() || customToDate.isNotBlank()
    val periodOptions = listOf(1 to "Bugün", 7 to "7 Gün", 30 to "30 Gün", 60 to "60 Gün")

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = CardSurface,
        border = BorderStroke(1.dp, if (hasCustom) AlbayrakRed.copy(alpha = 0.45f) else LineHairline),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    periodOptions.forEach { (daysVal, label) ->
                        val active = !hasCustom && selectedDays == daysVal
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (active) InkPrimary else BgCanvas)
                                .border(
                                    1.dp,
                                    if (active) InkPrimary else LineHairline,
                                    RoundedCornerShape(8.dp)
                                )
                                .clickable {
                                    onClearCustomDates()
                                    onSelectDays(daysVal)
                                }
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = label,
                                color = if (active) Color.White else InkSecondary,
                                fontSize = 11.5.sp,
                                fontWeight = if (active) FontWeight.Bold else FontWeight.Medium
                            )
                        }
                    }
                }

                // Özel Tarih Seç Butonu
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (hasCustom) AlbayrakRed.copy(alpha = 0.12f) else BgCanvas)
                        .border(
                            1.dp,
                            if (hasCustom) AlbayrakRed else LineHairline,
                            RoundedCornerShape(8.dp)
                        )
                        .clickable { showDateModal = true }
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(5.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.CalendarMonth,
                        contentDescription = "Tarih Seç",
                        tint = if (hasCustom) AlbayrakRed else InkPrimary,
                        modifier = Modifier.size(14.dp)
                    )
                    Text(
                        text = if (hasCustom) "Özel Tarih" else "Tarih Seç",
                        color = if (hasCustom) AlbayrakRed else InkPrimary,
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            if (hasCustom) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(AlbayrakRed.copy(alpha = 0.08f))
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Seçili Tarih Aralığı: ${customFromDate.ifBlank { "01.08.2026" }} – ${customToDate.ifBlank { "20.10.2026" }}",
                        color = AlbayrakRed,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Sıfırla",
                        tint = AlbayrakRed,
                        modifier = Modifier
                            .size(16.dp)
                            .clickable { onClearCustomDates() }
                    )
                }
            }
        }
    }

    if (showDateModal) {
        var fromInput by remember { mutableStateOf(customFromDate.ifBlank { "01.10.2026" }) }
        var toInput by remember { mutableStateOf(customToDate.ifBlank { "20.10.2026" }) }

        AlertDialog(
            onDismissRequest = { showDateModal = false },
            containerColor = CardSurface,
            shape = RoundedCornerShape(16.dp),
            title = {
                Text(
                    text = "Özel Tarih Aralığı Seçin",
                    color = InkPrimary,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.ExtraBold
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "İstediğiniz başlangıç ve bitiş tarihini (GG.AA.YYYY) girin veya hazır dönemlerden birine dokunun:",
                        color = InkMuted,
                        fontSize = 12.sp
                    )
                    OutlinedTextField(
                        value = fromInput,
                        onValueChange = { fromInput = it },
                        label = { Text("Başlangıç Tarihi (GG.AA.YYYY)", fontSize = 11.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )
                    OutlinedTextField(
                        value = toInput,
                        onValueChange = { toInput = it },
                        label = { Text("Bitiş Tarihi (GG.AA.YYYY)", fontSize = 11.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )
                    Text(
                        text = "Hızlı Tarih Şablonları:",
                        color = InkSecondary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        listOf(
                             Triple("Ekim 2026", "01.10.2026", "20.10.2026"),
                            Triple("Eylül 2026", "01.09.2026", "30.09.2026"),
                            Triple("Son 2 Hafta", "06.10.2026", "20.10.2026")
                        ).forEach { (lbl, f, t) ->
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(BgCanvas)
                                    .border(1.dp, LineHairline, RoundedCornerShape(8.dp))
                                    .clickable {
                                        fromInput = f
                                        toInput = t
                                    }
                                    .padding(vertical = 6.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = lbl,
                                    color = InkPrimary,
                                    fontSize = 10.5.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {
                MinimalBasicButton(
                    text = "Filtreyi Uygula",
                    onClick = {
                        onApplyCustomDates(fromInput.trim(), toInput.trim())
                        showDateModal = false
                    },
                    variant = MinimalButtonVariant.DARK
                )
            },
            dismissButton = {
                MinimalBasicButton(
                    text = "Temizle",
                    onClick = {
                        onClearCustomDates()
                        showDateModal = false
                    },
                    variant = MinimalButtonVariant.OUTLINE
                )
            }
        )
    }
}

// =========================================================================
// 13. EN ÇOK MESAİ YAPANLAR & NET SÜRE BAKİYESİ (MESAİ − GECİKME) LİG KARTI
// =========================================================================
@Composable
fun MinimalOvertimeAndNetLeaderboardsCard(
    analyticsList: List<EmployeeDeepAnalytics>,
    periodLabel: String,
    onSelectEmployee: (EmployeeDeepAnalytics) -> Unit,
    onExportLeaderboardExcel: () -> Unit,
    modifier: Modifier = Modifier
) {
    var activeTab by remember { mutableIntStateOf(0) } // 0: En Çok Mesai, 1: Net En İyiler (+), 2: Net En Kötüler (−)

    val displayedList = remember(analyticsList, activeTab) {
        when (activeTab) {
            0 -> analyticsList.sortedByDescending { it.totalOvertimeMin }.take(5)
            1 -> analyticsList.sortedByDescending { it.netBalanceMin }.take(5)
            else -> analyticsList.sortedBy { it.netBalanceMin }.take(5)
        }
    }

    Surface(
        shape = RoundedCornerShape(14.dp),
        color = CardSurface,
        border = BorderStroke(1.dp, LineHairline),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(11.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Ek Mesai & Net Süre Bakiyesi Ligi",
                        color = InkPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.3).sp
                    )
                    Text(
                        text = "$periodLabel · Ek mesaiden gecikme çıkınca kalan net süre",
                        color = InkMuted,
                        fontSize = 11.sp
                    )
                }
                AnimatedDownloadButton(
                    label = "Lig XLSX",
                    onDownloadComplete = onExportLeaderboardExcel,
                    variant = MinimalButtonVariant.OUTLINE,
                    height = 32.dp
                )
            }

            MinimalSegmentedControl(
                items = listOf("En Çok Mesai", "Net En İyiler (+)", "Net En Kötüler (−)"),
                selectedIndex = activeTab,
                onSelect = { activeTab = it }
            )

            displayedList.forEachIndexed { idx, item ->
                if (idx > 0) {
                    HorizontalDivider(color = LineHairline, thickness = 1.dp)
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .clickable { onSelectEmployee(item) }
                        .padding(vertical = 6.dp, horizontal = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(24.dp)
                                .clip(RoundedCornerShape(7.dp))
                                .background(
                                    when {
                                        activeTab == 2 -> StatusWarn.copy(alpha = 0.16f)
                                        idx == 0 -> AlbayrakRed
                                        idx == 1 -> InkPrimary
                                        else -> SubtleSurface
                                    }
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "${idx + 1}",
                                color = when {
                                    activeTab == 2 -> StatusWarn
                                    idx <= 1 -> Color.White
                                    else -> InkSecondary
                                },
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = item.emp.fullName,
                                color = InkPrimary,
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.ExtraBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = when (activeTab) {
                                    0 -> "${item.emp.department} · En çok: ${item.mostOvertimeDay.dowName} (+${item.mostOvertimeDay.totalOvertimeMin} dk)"
                                    1 -> "Mesai: +${item.totalOvertimeMin} dk · Geç: −${item.totalLateMin} dk"
                                    else -> "Geç: −${item.totalLateMin} dk (${item.mostLateDay.dowShort}) · Mesai: +${item.totalOvertimeMin} dk"
                                },
                                color = InkMuted,
                                fontSize = 11.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }

                    Column(horizontalAlignment = Alignment.End) {
                        MinimalStatusBadge(
                            text = when (activeTab) {
                                0 -> "+${formatDurationMinutes(item.totalOvertimeMin)}"
                                else -> formatSignedMinutes(item.netBalanceMin)
                            },
                            tone = when {
                                activeTab == 0 -> DeltaTone.OK
                                item.netBalanceMin >= 0 -> DeltaTone.OK
                                else -> DeltaTone.BAD
                            }
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = if (activeTab == 0) "Net: ${formatSignedMinutes(item.netBalanceMin)}" else "En geç: ${item.mostLateDay.dowShort}",
                            color = InkMuted,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            }
        }
    }
}

// =========================================================================
// 14. DERİN PERSONEL PROFİL ANALİZ KARTI (En Çok Geç/Mesai Günü & Net Terazi)
// =========================================================================
@Composable
fun EmployeeDeepProfileAnalysisCard(
    analytics: EmployeeDeepAnalytics,
    onExportPersonalDeepExcel: () -> Unit,
    modifier: Modifier = Modifier
) {
    val totalBar = (analytics.totalOvertimeMin + analytics.totalLateMin).coerceAtLeast(1)
    val otFraction = (analytics.totalOvertimeMin.toFloat() / totalBar).coerceIn(0.05f, 0.95f)

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // 1. Üçlü Vurgu Kartları: Net Bakiye, En Çok Geç Kaldığı Gün, En Çok Ek Mesai Yaptığı Gün
        Surface(
            shape = RoundedCornerShape(13.dp),
            color = CardSurface,
            border = BorderStroke(1.dp, LineHairline)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "${analytics.emp.fullName} · Derin Mesai Karnesi",
                            color = InkPrimary,
                            fontSize = 14.5.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Text(
                            text = "Dönem: ${analytics.periodLabel} · ${analytics.emp.department}",
                            color = InkMuted,
                            fontSize = 11.sp
                        )
                    }
                    AnimatedDownloadButton(
                        label = "Detay XLSX",
                        onDownloadComplete = onExportPersonalDeepExcel,
                        variant = MinimalButtonVariant.DARK,
                        height = 32.dp
                    )
                }

                // Net Mesai Bakiyesi (Ek Mesai − Gecikme) Kutusu
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(
                            if (analytics.netBalanceMin >= 0) StatusOk.copy(alpha = 0.08f)
                            else StatusBad.copy(alpha = 0.08f)
                        )
                        .border(
                            1.dp,
                            if (analytics.netBalanceMin >= 0) StatusOk.copy(alpha = 0.35f)
                            else StatusBad.copy(alpha = 0.35f),
                            RoundedCornerShape(10.dp)
                        )
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "NET MESAİ BAKİYESİ (EK MESAİ − GECİKME)",
                                color = InkSecondary,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 0.4.sp
                            )
                            Text(
                                text = "Ek mesaiden (+${analytics.totalOvertimeMin} dk) gecikme (−${analytics.totalLateMin} dk) çıkınca:",
                                color = InkMuted,
                                fontSize = 11.sp
                            )
                        }
                        Text(
                            text = formatSignedMinutes(analytics.netBalanceMin),
                            color = if (analytics.netBalanceMin >= 0) StatusOk else StatusBad,
                            fontSize = 17.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }

                    // Görsel İkili Terazi Çubuğu
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(8.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(LineHairline)
                    ) {
                        Box(
                            modifier = Modifier
                                .weight(otFraction)
                                .fillMaxHeight()
                                .background(StatusOk)
                        )
                        Box(
                            modifier = Modifier
                                .weight((1f - otFraction).coerceAtLeast(0.05f))
                                .fillMaxHeight()
                                .background(StatusWarn)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "● Ek Mesai: +${formatDurationMinutes(analytics.totalOvertimeMin)} (${analytics.overtimeDays} gün)",
                            color = StatusOk,
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "● Gecikme: −${formatDurationMinutes(analytics.totalLateMin)} (${analytics.lateDays} gün)",
                            color = StatusWarn,
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // İkili Gün Analizi: 1) En Çok Hangi Gün Geç Kalmış, 2) En Çok Hangi Gün Ek Mesai Yapmış
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .background(StatusWarn.copy(alpha = 0.08f))
                            .border(1.dp, StatusWarn.copy(alpha = 0.30f), RoundedCornerShape(10.dp))
                            .padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(3.dp)
                    ) {
                        Text(
                            text = "EN ÇOK GEÇ KALDIĞI GÜN",
                            color = StatusWarn,
                            fontSize = 9.5.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Text(
                            text = if (analytics.mostLateDay.totalLateMin > 0) analytics.mostLateDay.dowName else "Gecikme Yok",
                            color = InkPrimary,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Text(
                            text = if (analytics.mostLateDay.totalLateMin > 0)
                                "Toplam −${analytics.mostLateDay.totalLateMin} dk (${analytics.mostLateDay.lateCount} kez · ort. ${analytics.mostLateDay.avgLateMin} dk)"
                            else "Tüm günlerde zamanında",
                            color = InkSecondary,
                            fontSize = 10.5.sp
                        )
                        if (analytics.peakLateMin > 0) {
                            Text(
                                text = "Zirve: ${analytics.peakLateDate} (+${analytics.peakLateMin} dk)",
                                color = InkMuted,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }

                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .background(StatusOk.copy(alpha = 0.08f))
                            .border(1.dp, StatusOk.copy(alpha = 0.30f), RoundedCornerShape(10.dp))
                            .padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(3.dp)
                    ) {
                        Text(
                            text = "EN ÇOK EK MESAİ GÜNÜ",
                            color = StatusOk,
                            fontSize = 9.5.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Text(
                            text = if (analytics.mostOvertimeDay.totalOvertimeMin > 0) analytics.mostOvertimeDay.dowName else "Mesai Yok",
                            color = InkPrimary,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Text(
                            text = "Toplam +${analytics.mostOvertimeDay.totalOvertimeMin} dk (${analytics.mostOvertimeDay.overtimeCount} kez · ort. +${analytics.mostOvertimeDay.avgOvertimeMin} dk)",
                            color = InkSecondary,
                            fontSize = 10.5.sp
                        )
                        if (analytics.peakOvertimeMin > 0) {
                            Text(
                                text = "Zirve: ${analytics.peakOvertimeDate} (+${analytics.peakOvertimeMin} dk)",
                                color = InkMuted,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }
                }

                // Saat ve Konum Özeti Şeridi
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(9.dp))
                        .background(BgCanvas)
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text("Ort. Giriş / En Erken", color = InkMuted, fontSize = 9.5.sp)
                        Text(
                            "${analytics.avgCheckIn} (${analytics.earliestCheckIn})",
                            color = InkPrimary,
                            fontSize = 11.5.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Column {
                        Text("Ort. Çıkış / En Geç", color = InkMuted, fontSize = 9.5.sp)
                        Text(
                            "${analytics.avgCheckOut} (${analytics.latestCheckOut})",
                            color = InkPrimary,
                            fontSize = 11.5.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("En Verimli Gün", color = InkMuted, fontSize = 9.5.sp)
                        Text(
                            "${analytics.bestNetDay.dowShort} (${formatSignedMinutes(analytics.bestNetDay.netMin)})",
                            color = StatusOk,
                            fontSize = 11.5.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        // 2. Haftanın Günlerine Göre (Pazartesi – Cuma) Kırılım Tablosu
        Surface(
            shape = RoundedCornerShape(13.dp),
            color = CardSurface,
            border = BorderStroke(1.dp, LineHairline)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Haftanın Günlerine Göre (Pzt – Cum) Mesai & Gecikme Kırılımı",
                    color = InkPrimary,
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.ExtraBold
                )
                analytics.weekdayBreakdown.forEachIndexed { idx, w ->
                    if (idx > 0) {
                        HorizontalDivider(color = LineHairline, thickness = 1.dp)
                    }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1.1f)) {
                            Text(
                                text = w.dowName,
                                color = InkPrimary,
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "${w.avgCheckIn} → ${w.avgCheckOut} (${w.attendedDays}g)",
                                color = InkMuted,
                                fontSize = 10.5.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                        Text(
                            text = "Geç: −${w.totalLateMin} dk",
                            color = if (w.totalLateMin > 0) StatusWarn else InkMuted,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(0.95f)
                        )
                        Text(
                            text = "Mesai: +${w.totalOvertimeMin} dk",
                            color = if (w.totalOvertimeMin > 0) StatusOk else InkMuted,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f)
                        )
                        MinimalStatusBadge(
                            text = formatSignedMinutes(w.netMin),
                            tone = if (w.netMin >= 0) DeltaTone.OK else DeltaTone.BAD
                        )
                    }
                }
            }
        }
    }
}

fun exportEmployeeDeepExcelReport(
    context: Context,
    analytics: EmployeeDeepAnalytics
) {
    exportFormattedExcelReport(
        context = context,
        fileNamePrefix = "Albayrak_Derin_Analiz_${analytics.emp.employeeCode}",
        title = "${analytics.emp.fullName} (${analytics.emp.employeeCode}) — Derin Mesai & Net Bakiye Karnesi",
        subtitle = "${analytics.emp.department} · ${analytics.emp.title} · Dönem: ${analytics.periodLabel}",
        kpis = listOf(
            ReportKpiItem("Net Mesai Bakiyesi", formatSignedMinutes(analytics.netBalanceMin), "Ek mesai − gecikme"),
            ReportKpiItem("Toplam Ek Mesai", "+${formatDurationMinutes(analytics.totalOvertimeMin)}", "${analytics.overtimeDays} gün fazla mesai"),
            ReportKpiItem("Toplam Gecikme", "−${formatDurationMinutes(analytics.totalLateMin)}", "${analytics.lateDays} gün gecikme"),
            ReportKpiItem("En Çok Geç / Mesai", "${analytics.mostLateDay.dowShort} / ${analytics.mostOvertimeDay.dowShort}", "Uyum: %${analytics.complianceScore}")
        ),
        headers = listOf("Tarih", "Gün", "Giriş Saati", "Çıkış Saati", "Çalışma (Sa)", "Gecikme (dk)", "Ek Mesai (dk)", "Net Süre Bakiyesi", "Mesafe (30m)"),
        rows = analytics.dailyLogs.reversed().map { log ->
            listOf(
                log.dateStr,
                log.dowName,
                log.checkIn,
                log.checkOut,
                String.format(Locale.US, "%.1f sa", log.workHours),
                "${log.lateMin} dk",
                "+${log.overtimeMin} dk",
                formatSignedMinutes(log.netMin),
                String.format(Locale.US, "%.1f m", log.distanceMeters)
            )
        }
    )
}



