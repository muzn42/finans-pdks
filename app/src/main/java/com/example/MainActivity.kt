package com.example

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.data.local.UserRole
import com.example.ui.MainViewModel
import com.example.ui.screens.*
import com.example.ui.theme.*
import kotlinx.coroutines.delay
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            FinansPdksTheme {
                PdksApp()
            }
        }
    }
}

private enum class NavTab(val title: String, val icon: ImageVector) {
    ATTENDANCE("Yoklama", Icons.Default.LocationOn),
    RECORDS("Kayıtlar", Icons.Default.History),
    REPORT("Analiz", Icons.Default.Insights),
    PROFILE("Profil", Icons.Default.Person),
    HR_MANAGEMENT("İK Portalı", Icons.Default.PeopleAlt),
    IT_SECURITY("BT & Destek", Icons.Default.Shield)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PdksApp(viewModel: MainViewModel = viewModel()) {
    val context = LocalContext.current
    val isLoggedIn by viewModel.isLoggedIn.collectAsState()
    val currentRole by viewModel.currentRole.collectAsState()
    val selectedEmployee by viewModel.selectedEmployee.collectAsState()
    val unreadNotifsCount by viewModel.filteredUnreadNotificationsCount.collectAsState()

    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> }

    var showLaunchSplash by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        delay(2150)
        showLaunchSplash = false
    }

    if (showLaunchSplash) {
        AnimatedBrandSplashScreen()
        return
    }

    if (!isLoggedIn) {
        LoginScreen(viewModel = viewModel)
        return
    }

    var selectedTab by remember { mutableStateOf(NavTab.ATTENDANCE) }
    var isViewingNotifications by remember { mutableStateOf(false) }

    LaunchedEffect(currentRole) {
        selectedTab = when (currentRole) {
            UserRole.PERSONNEL -> NavTab.ATTENDANCE
            UserRole.HR -> NavTab.HR_MANAGEMENT
            UserRole.IT -> NavTab.IT_SECURITY
        }
    }

    val availableTabs = remember(currentRole) {
        when (currentRole) {
            UserRole.PERSONNEL -> listOf(
                NavTab.ATTENDANCE,
                NavTab.RECORDS,
                NavTab.REPORT,
                NavTab.PROFILE
            )
            UserRole.HR -> listOf(
                NavTab.HR_MANAGEMENT,
                NavTab.ATTENDANCE,
                NavTab.RECORDS,
                NavTab.REPORT,
                NavTab.PROFILE
            )
            UserRole.IT -> listOf(
                NavTab.IT_SECURITY,
                NavTab.ATTENDANCE,
                NavTab.RECORDS,
                NavTab.REPORT,
                NavTab.PROFILE
            )
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = BgCanvas,
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(CardSurface)
                    .statusBarsPadding()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(58.dp)
                        .padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    if (isViewingNotifications) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(34.dp)
                                    .clip(RoundedCornerShape(9.dp))
                                    .background(SubtleSurface)
                                    .border(1.dp, LineHairline, RoundedCornerShape(9.dp))
                                    .clickable { isViewingNotifications = false },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                    contentDescription = "Geri",
                                    tint = InkPrimary,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            Text(
                                text = "Sistem Bildirimleri",
                                color = InkPrimary,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    } else {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Image(
                                painter = painterResource(id = R.drawable.ic_albayrak_emblem),
                                contentDescription = "Albayrak Finans",
                                modifier = Modifier.size(32.dp)
                            )

                            Column {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        text = "Albayrak Finans",
                                        color = InkPrimary,
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Bold,
                                        letterSpacing = (-0.3).sp
                                    )
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(999.dp))
                                            .background(SubtleSurface)
                                            .border(1.dp, LineHairline, RoundedCornerShape(999.dp))
                                            .padding(horizontal = 7.dp, vertical = 2.dp)
                                    ) {
                                        Text(
                                            text = currentRole.displayName,
                                            color = InkSecondary,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }
                                }
                                Text(
                                    text = selectedEmployee?.let { "${it.fullName} · ${it.department}" }
                                        ?: "Kurumsal Personel Devam Sistemi",
                                    color = InkMuted,
                                    fontSize = 11.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }

                    if (!isViewingNotifications) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(RoundedCornerShape(9.dp))
                                    .background(CardSurface)
                                    .border(1.dp, LineHairline, RoundedCornerShape(9.dp))
                                    .clickable { isViewingNotifications = true },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.NotificationsNone,
                                    contentDescription = "Bildirimler",
                                    tint = InkPrimary,
                                    modifier = Modifier.size(18.dp)
                                )
                                if (unreadNotifsCount > 0) {
                                    Box(
                                        modifier = Modifier
                                            .align(Alignment.TopEnd)
                                            .padding(top = 6.dp, end = 6.dp)
                                            .size(7.dp)
                                            .clip(CircleShape)
                                            .background(AlbayrakRed)
                                    )
                                }
                            }

                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(RoundedCornerShape(9.dp))
                                    .background(CardSurface)
                                    .border(1.dp, LineHairline, RoundedCornerShape(9.dp))
                                    .clickable { viewModel.logout() },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.Logout,
                                    contentDescription = "Çıkış",
                                    tint = InkSecondary,
                                    modifier = Modifier.size(17.dp)
                                )
                            }
                        }
                    }
                }
                HorizontalDivider(color = LineHairline, thickness = 1.dp)
            }
        },
        bottomBar = {
            MinimalBottomNavBar(
                tabs = availableTabs,
                selectedTab = selectedTab,
                isViewingNotifications = isViewingNotifications,
                onSelect = { tab ->
                    isViewingNotifications = false
                    selectedTab = tab
                }
            )
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (isViewingNotifications) {
                NotificationsScreen(viewModel = viewModel)
            } else {
                AnimatedContent(
                    targetState = selectedTab,
                    transitionSpec = {
                        (fadeIn(animationSpec = tween(220)) +
                                slideInVertically(animationSpec = tween(240)) { it / 28 } +
                                scaleIn(initialScale = 0.985f, animationSpec = tween(220))) togetherWith
                                fadeOut(animationSpec = tween(150))
                    },
                    label = "tab_content_transition"
                ) { tab ->
                    when (tab) {
                        NavTab.ATTENDANCE -> PersonnelScreen(viewModel = viewModel)
                        NavTab.HR_MANAGEMENT -> HrScreen(viewModel = viewModel)
                        NavTab.IT_SECURITY -> ItSecurityScreen(viewModel = viewModel)
                        NavTab.RECORDS -> RecordsScreen(viewModel = viewModel)
                        NavTab.REPORT -> PersonalReportScreen(viewModel = viewModel)
                        NavTab.PROFILE -> ProfileScreen(
                            viewModel = viewModel,
                            onNavigateToNotifications = { isViewingNotifications = true }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MinimalBottomNavBar(
    tabs: List<NavTab>,
    selectedTab: NavTab,
    isViewingNotifications: Boolean,
    onSelect: (NavTab) -> Unit
) {
    val density = LocalDensity.current
    var barWidthPx by remember { mutableIntStateOf(0) }
    val count = tabs.size.coerceAtLeast(1)
    val slotWidthDp = with(density) { (barWidthPx / count).toDp() }
    val selectedIdx = tabs.indexOf(selectedTab).coerceAtLeast(0)

    val indicatorOffsetDp by animateDpAsState(
        targetValue = slotWidthDp * selectedIdx,
        animationSpec = spring(
            dampingRatio = 0.8f,
            stiffness = Spring.StiffnessMediumLow
        ),
        label = "nav_pill_offset"
    )

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(CardSurface)
            .navigationBarsPadding()
    ) {
        HorizontalDivider(color = LineHairline, thickness = 1.dp)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp)
                .padding(horizontal = 8.dp, vertical = 6.dp)
                .onSizeChanged { barWidthPx = it.width }
        ) {
            if (barWidthPx > 0 && !isViewingNotifications) {
                Box(
                    modifier = Modifier
                        .offset(x = indicatorOffsetDp)
                        .width(slotWidthDp)
                        .fillMaxHeight()
                        .padding(horizontal = 3.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(SubtleSurface)
                        .border(1.dp, LineHairline, RoundedCornerShape(10.dp))
                )
            }

            Row(modifier = Modifier.fillMaxSize()) {
                tabs.forEach { tab ->
                    val isSelected = !isViewingNotifications && selectedTab == tab
                    val tint by animateColorAsState(
                        targetValue = if (isSelected) InkPrimary else InkMuted,
                        animationSpec = tween(180),
                        label = "nav_tint"
                    )
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(10.dp))
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null
                            ) { onSelect(tab) },
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            if (isSelected) {
                                Box(
                                    modifier = Modifier
                                        .size(5.dp)
                                        .clip(CircleShape)
                                        .background(AlbayrakRed)
                                )
                            }
                            Icon(
                                imageVector = tab.icon,
                                contentDescription = tab.title,
                                tint = tint,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = tab.title,
                            color = tint,
                            fontSize = 10.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AnimatedBrandSplashScreen() {
    var mounted by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { mounted = true }

    val logoScale by animateFloatAsState(
        targetValue = if (mounted) 1f else 0.72f,
        animationSpec = spring(dampingRatio = 0.58f, stiffness = Spring.StiffnessMediumLow),
        label = "splash_logo_scale"
    )

    val textReveal by animateFloatAsState(
        targetValue = if (mounted) 1f else 0f,
        animationSpec = tween(680, delayMillis = 150, easing = FastOutSlowInEasing),
        label = "splash_text_reveal"
    )

    val bootProgress by animateFloatAsState(
        targetValue = if (mounted) 1f else 0f,
        animationSpec = tween(1950, easing = FastOutSlowInEasing),
        label = "splash_boot_progress"
    )

    val infiniteTransition = rememberInfiniteTransition(label = "splash_radar")
    val radarSweepAngle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(2600, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "radar_angle"
    )
    val pulseExpand by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1800, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "radar_pulse"
    )
    val floatY by infiniteTransition.animateFloat(
        initialValue = -4f,
        targetValue = 4f,
        animationSpec = infiniteRepeatable(
            animation = tween(1400, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "logo_float"
    )

    val pct = (bootProgress * 100f).roundToInt().coerceIn(0, 100)
    val stepText = when {
        pct < 38 -> "Kurumsal güvenlik sertifikaları doğrulanıyor..."
        pct < 78 -> "30m Şube Geofence GPS uyduları senkronize ediliyor..."
        else -> "Albayrak Finans PDKS hazır ✓"
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF101215),
                        Color(0xFF16181D),
                        Color(0xFF111317)
                    )
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        // Arka Plan 30m Geofence Radar Halkaları & Dönen Tarama Işını
        Canvas(modifier = Modifier.size(340.dp)) {
            val center = Offset(size.width / 2f, size.height / 2f)
            val maxR = size.minDimension / 2f

            // Yumuşak kırmızı merkez ışıması
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        AlbayrakRed.copy(alpha = 0.22f),
                        AlbayrakRed.copy(alpha = 0.05f),
                        Color.Transparent
                    ),
                    center = center,
                    radius = maxR * 0.9f
                ),
                radius = maxR * 0.9f,
                center = center
            )

            // Sabit eşmerkezli geofence yörüngeleri (10m, 20m, 30m temsili)
            listOf(0.42f, 0.66f, 0.90f).forEachIndexed { idx, frac ->
                drawCircle(
                    color = Color.White.copy(alpha = if (idx == 2) 0.11f else 0.06f),
                    radius = maxR * frac,
                    center = center,
                    style = Stroke(width = 1.dp.toPx())
                )
            }

            // Dışa yayılan canlı radar dalgası
            val waveR = maxR * (0.35f + 0.58f * pulseExpand)
            drawCircle(
                color = AlbayrakRed.copy(alpha = (1f - pulseExpand) * 0.42f),
                radius = waveR,
                center = center,
                style = Stroke(width = 1.8.dp.toPx())
            )

            // Dönen GPS uydu noktaları
            val rad = Math.toRadians(radarSweepAngle.toDouble())
            val orbitR = maxR * 0.66f
            val satX = center.x + (orbitR * cos(rad)).toFloat()
            val satY = center.y + (orbitR * sin(rad)).toFloat()

            drawCircle(
                color = AlbayrakRed.copy(alpha = 0.35f),
                radius = 7.dp.toPx(),
                center = Offset(satX, satY)
            )
            drawCircle(
                color = AlbayrakRed,
                radius = 3.5.dp.toPx(),
                center = Offset(satX, satY)
            )

            val rad2 = Math.toRadians((radarSweepAngle + 145f).toDouble())
            val orbitR2 = maxR * 0.90f
            val sat2X = center.x + (orbitR2 * cos(rad2)).toFloat()
            val sat2Y = center.y + (orbitR2 * sin(rad2)).toFloat()
            drawCircle(
                color = StatusOk,
                radius = 3.2.dp.toPx(),
                center = Offset(sat2X, sat2Y)
            )
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // 100% Saydam Kurumsal Amblem (Çerçevesiz & Kutusu Olmadan)
            Image(
                painter = painterResource(id = R.drawable.ic_albayrak_emblem),
                contentDescription = "Albayrak Finans PDKS",
                modifier = Modifier
                    .size(116.dp)
                    .graphicsLayer {
                        scaleX = logoScale
                        scaleY = logoScale
                        translationY = floatY
                    }
            )

            Spacer(modifier = Modifier.height(22.dp))

            // Başlık & Alt Başlık
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.graphicsLayer {
                    alpha = textReveal
                    translationY = (1f - textReveal) * 20f
                }
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(7.dp)
                            .clip(CircleShape)
                            .background(AlbayrakRed)
                    )
                    Text(
                        text = "ALBAYRAK FİNANS",
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 1.2.sp
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = "Kurumsal Personel Devam & 30m Geofence Sistemi",
                    color = Color(0xFF9CA3AF),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )

                Spacer(modifier = Modifier.height(28.dp))

                // Canlı Başlatma Durum Kartı
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color.White.copy(alpha = 0.05f))
                        .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(14.dp))
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = stepText,
                            color = Color(0xFFE5E7EB),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "%$pct",
                            color = if (pct >= 95) StatusOk else AlbayrakRed,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    // İlerleme Çubuğu
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(5.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(Color.White.copy(alpha = 0.10f))
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(bootProgress.coerceIn(0.04f, 1f))
                                .fillMaxHeight()
                                .clip(RoundedCornerShape(999.dp))
                                .background(
                                    Brush.horizontalGradient(
                                        colors = listOf(
                                            AlbayrakRed,
                                            if (pct >= 90) StatusOk else Color(0xFFFF5258)
                                        )
                                    )
                                )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                // Alt Kurumsal Güvenlik Rozetleri
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    listOf("30m Geofence", "Canlı İK Analitik", "SSL / Cihaz Kilidi").forEach { tag ->
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(999.dp))
                                .background(Color.White.copy(alpha = 0.06f))
                                .border(1.dp, Color.White.copy(alpha = 0.09f), RoundedCornerShape(999.dp))
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = tag,
                                color = Color(0xFF9CA3AF),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }
        }
    }
}

