package com.example.ui.screens

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Login
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.example.data.local.BranchEntity
import com.example.data.repository.AttendanceResult
import com.example.location.LocationHelper
import com.example.location.UserLocationData
import com.example.ui.MainViewModel
import com.example.ui.components.*
import com.example.ui.theme.*
import com.example.util.SoundEffectPlayer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun PersonnelScreen(viewModel: MainViewModel) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val selectedEmployee by viewModel.selectedEmployee.collectAsState()
    val selectedBranch by viewModel.selectedBranch.collectAsState()
    val branches by viewModel.branches.collectAsState()
    val distance by viewModel.distanceToBranch.collectAsState()
    val isWithinRadius by viewModel.isWithin5Meters.collectAsState()
    val userLocation by viewModel.userLocation.collectAsState()
    val records by viewModel.records.collectAsState()
    val actionResult by viewModel.actionResult.collectAsState()

    var showExcuseModal by remember { mutableStateOf(false) }
    var showBranchSelectorModal by remember { mutableStateOf(false) }
    var noteInput by remember { mutableStateOf("") }

    // Geç giriş gerekçesi: aynı kayıt için "Daha Sonra" denildiyse tekrar açılmaz
    var lateReasonDismissedId by remember { mutableStateOf(0L) }

    // Patlama / Dalga (Burst) Animasyon Tetikleyicisi
    val burstProgress = remember { Animatable(0f) }
    val punchBounce = remember { Animatable(1f) }
    var lastBurstColor by remember { mutableStateOf(AlbayrakRed) }

    fun triggerPunchAnimation(targetColor: Color, action: () -> Unit) {
        lastBurstColor = targetColor
        coroutineScope.launch {
            launch {
                punchBounce.snapTo(0.88f)
                punchBounce.animateTo(
                    targetValue = 1f,
                    animationSpec = spring(
                        dampingRatio = Spring.DampingRatioLowBouncy,
                        stiffness = Spring.StiffnessMediumLow
                    )
                )
            }
            launch {
                burstProgress.snapTo(0.01f)
                burstProgress.animateTo(
                    targetValue = 1f,
                    animationSpec = tween(durationMillis = 760, easing = FastOutSlowInEasing)
                )
                burstProgress.snapTo(0f)
            }
        }
        action()
    }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { perms ->
        val granted = perms[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                perms[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
            viewModel.startRealGps(context)
        } else {
            Toast.makeText(context, "Gerçek GPS için konum izni gereklidir.", Toast.LENGTH_SHORT).show()
        }
    }

    // Uygulama açılışında gerçek GPS'i otomatik başlat; izin yoksa bir kez iste.
    // Simülasyon modu (isSimulated) ayrıdır ve bu izin akışından etkilenmez.
    LaunchedEffect(Unit) {
        val fineGranted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        if (fineGranted || coarseGranted) {
            viewModel.startRealGps(context)
        } else {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    // Canlı saat
    var currentTimeMillis by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            currentTimeMillis = System.currentTimeMillis()
            delay(1000L)
        }
    }

    val clockFormatter = remember { SimpleDateFormat("HH:mm:ss", Locale("tr", "TR")) }
    val dateFormatter = remember { SimpleDateFormat("dd MMMM yyyy, EEEE", Locale("tr", "TR")) }
    val dayBucket = currentTimeMillis / 86_400_000L
    val todayDateStr = remember(dayBucket) {
        SimpleDateFormat("dd.MM.yyyy", Locale.getDefault()).format(Date(currentTimeMillis))
    }

    val myTodayRecords = remember(records, selectedEmployee, todayDateStr) {
        records.filter {
            (selectedEmployee == null || it.employeeId == selectedEmployee?.id) &&
                    it.formattedDate == todayDateStr
        }.sortedBy { it.timestamp }
    }

    val firstCheckIn = myTodayRecords.firstOrNull { it.recordType == "GİRİŞ" }
    val lastCheckOut = myTodayRecords.lastOrNull { it.recordType == "ÇIKIŞ" }
    val isCurrentlyCheckedIn = firstCheckIn != null &&
            (lastCheckOut == null || firstCheckIn.timestamp > lastCheckOut.timestamp)

    val shiftDurationText = remember(currentTimeMillis, firstCheckIn, lastCheckOut) {
        if (firstCheckIn == null) {
            "00:00:00"
        } else {
            val end = if (lastCheckOut != null && lastCheckOut.timestamp > firstCheckIn.timestamp) {
                lastCheckOut.timestamp
            } else {
                currentTimeMillis
            }
            val diffSec = ((end - firstCheckIn.timestamp) / 1000L).coerceAtLeast(0L)
            val hrs = diffSec / 3600
            val mins = (diffSec % 3600) / 60
            val secs = diffSec % 60
            String.format(Locale.US, "%02d:%02d:%02d", hrs, mins, secs)
        }
    }

    // Geliştirici Seçenekleri / Sahte Konum (Mock GPS) canlı güvenlik denetimi
    var mockSecurityReport by remember {
        mutableStateOf(LocationHelper.inspectDeviceMockSecurity(context, userLocation))
    }
    var showDevMockWarningDialog by remember { mutableStateOf(false) }
    var lastWarnedState by remember { mutableStateOf(false) }

    LaunchedEffect(userLocation) {
        while (true) {
            // Paket taraması ve ayar okumaları ana iş parçacığını meşgul etmesin.
            val report = withContext(Dispatchers.IO) {
                LocationHelper.inspectDeviceMockSecurity(context, userLocation)
            }
            mockSecurityReport = report
            if (report.hasSecurityWarning && !lastWarnedState) {
                lastWarnedState = true
                showDevMockWarningDialog = true
                SoundEffectPlayer.playWarningTone(context)
            } else if (!report.hasSecurityWarning) {
                lastWarnedState = false
                showDevMockWarningDialog = false
            }
            delay(1500L)
        }
    }

    val openDeveloperSettings = {
        runCatching {
            val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }.onFailure {
            runCatching {
                val fallback = Intent(android.provider.Settings.ACTION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(fallback)
            }
        }
    }

    if (showDevMockWarningDialog && mockSecurityReport.hasSecurityWarning) {
        AlertDialog(
            onDismissRequest = { showDevMockWarningDialog = false },
            title = {
                Text(
                    text = mockSecurityReport.summaryTitle,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 16.sp,
                    color = StatusBad
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = mockSecurityReport.summaryMessage,
                        fontSize = 13.5.sp,
                        lineHeight = 19.sp,
                        color = InkPrimary
                    )
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = StatusBadSoft,
                        border = BorderStroke(1.dp, StatusBad.copy(alpha = 0.35f))
                    ) {
                        Text(
                            text = "Kurumsal PDKS Güvenlik Kuralı: Geliştirici Seçenekleri veya Sahte Konum açıkken yapılan yoklama denemeleri otomatik olarak reddedilir ve İK / BT birimlerine güvenlik ihlali olarak raporlanır.",
                            fontSize = 11.5.sp,
                            lineHeight = 16.sp,
                            color = StatusBad,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(10.dp)
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDevMockWarningDialog = false
                        openDeveloperSettings()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = StatusBad)
                ) {
                    Text("Geliştirici Ayarlarını Aç", color = Color.White, fontSize = 12.sp)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDevMockWarningDialog = false }) {
                    Text("Anladım", color = InkSecondary)
                }
            }
        )
    }

    // Son işlem geri bildirimi ve kurumsal harmonik ses efekti + sonuç dialogu
    LaunchedEffect(actionResult) {
        actionResult?.let { res ->
            val msg = when (res) {
                is AttendanceResult.Success -> {
                    if (res.record.recordType == "GİRİŞ") {
                        SoundEffectPlayer.playCheckInChime(context)
                    } else {
                        SoundEffectPlayer.playCheckOutChime(context)
                    }
                    res.message
                }
                is AttendanceResult.DistanceExceeded -> {
                    SoundEffectPlayer.playWarningTone(context)
                    res.message
                }
                is AttendanceResult.MockLocationDetected -> {
                    SoundEffectPlayer.playWarningTone(context)
                    res.message
                }
                is AttendanceResult.Error -> {
                    SoundEffectPlayer.playWarningTone(context)
                    res.errorMessage
                }
            }
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
        }
    }

    // Geç girişte önce gerekçe ekranı gösterilir; diğer sonuçlarda standart sonuç dialogu açılır.
    val lateReasonRecord = (actionResult as? AttendanceResult.Success)?.record?.takeIf {
        it.recordType == "GİRİŞ" &&
                it.lateMinutes > 0 &&
                it.lateReasonCode.isBlank() &&
                it.id > 0L &&
                it.id != lateReasonDismissedId
    }

    actionResult?.let { res ->
        if (lateReasonRecord != null) {
            LateReasonDialog(
                lateMinutes = lateReasonRecord.lateMinutes,
                checkInTime = lateReasonRecord.formattedTime,
                onDismiss = {
                    lateReasonDismissedId = lateReasonRecord.id
                    viewModel.dismissActionResult()
                },
                onSubmit = { code, note ->
                    viewModel.submitLateReason(lateReasonRecord.id, code, note)
                    lateReasonDismissedId = lateReasonRecord.id
                    viewModel.dismissActionResult()
                    Toast.makeText(context, "Geç giriş gerekçeniz kaydedildi.", Toast.LENGTH_SHORT).show()
                }
            )
        } else {
            AttendanceResultDialog(
                result = res,
                onDismiss = { viewModel.dismissActionResult() }
            )
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(BgCanvas),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 0. GELİŞTİRİCİ SEÇENEKLERİ / SAHTE KONUM GÜVENLİK UYARI KARTI
        if (mockSecurityReport.hasSecurityWarning) {
            item(key = "mock_dev_security_warning") {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = StatusBadSoft,
                    border = BorderStroke(1.5.dp, StatusBad)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Warning,
                                contentDescription = "Güvenlik Uyarısı",
                                tint = StatusBad,
                                modifier = Modifier.size(20.dp)
                            )
                            Text(
                                text = mockSecurityReport.summaryTitle,
                                color = StatusBad,
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                        Text(
                            text = mockSecurityReport.summaryMessage,
                            color = InkPrimary,
                            fontSize = 12.sp,
                            lineHeight = 17.sp
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.End
                        ) {
                            Button(
                                onClick = { openDeveloperSettings() },
                                colors = ButtonDefaults.buttonColors(containerColor = StatusBad),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = "Geliştirici Ayarlarını Kapat",
                                    color = Color.White,
                                    fontSize = 11.5.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }

        // 1. ANA YOKLAMA KARTI (Çok Katmanlı Kuantum Giriş / Çıkış Buton Animasyonu)
        item(key = "punch_orb_card") {
            Surface(
                shape = RoundedCornerShape(18.dp),
                color = CardSurface,
                border = BorderStroke(1.dp, LineHairline)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .padding(end = 8.dp)
                        ) {
                            Text(
                                text = dateFormatter.format(Date(currentTimeMillis)),
                                color = InkMuted,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Spacer(modifier = Modifier.height(3.dp))
                            MinimalStatusBadge(
                                text = when {
                                    isCurrentlyCheckedIn -> "Mesai Devam Ediyor"
                                    firstCheckIn != null -> "Mesai Tamamlandı"
                                    else -> "Giriş Bekleniyor (08:30)"
                                },
                                tone = when {
                                    isCurrentlyCheckedIn -> DeltaTone.OK
                                    firstCheckIn != null -> DeltaTone.NEUTRAL
                                    else -> DeltaTone.WARN
                                }
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                text = clockFormatter.format(Date(currentTimeMillis)),
                                color = InkPrimary,
                                fontSize = 15.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = String.format(Locale.US, "%.1f m / 30 m sınır", distance),
                                color = if (isWithinRadius) StatusOk else StatusWarn,
                                fontSize = 10.5.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    InteractiveQuantumPunchOrb(
                        isCheckedIn = isCurrentlyCheckedIn,
                        isWithinRadius = isWithinRadius,
                        distanceMeters = distance,
                        shiftDurationText = shiftDurationText,
                        burstProgressProvider = { burstProgress.value },
                        punchBounceProvider = { punchBounce.value },
                        burstColor = lastBurstColor,
                        onPunchClick = {
                            if (isCurrentlyCheckedIn) {
                                triggerPunchAnimation(AlbayrakRed) {
                                    viewModel.doCheckOut(noteInput)
                                }
                            } else {
                                triggerPunchAnimation(if (isWithinRadius) StatusOk else StatusWarn) {
                                    viewModel.doCheckIn(noteInput)
                                }
                            }
                        }
                    )

                    Spacer(modifier = Modifier.height(18.dp))

                    // Alt İkili Tactile Giriş & Çıkış Tuşları
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        AnimatedActionPunchButton(
                            title = "Giriş Yap",
                            subtitle = "Sabah Yoklaması",
                            icon = Icons.AutoMirrored.Filled.Login,
                            isPrimary = !isCurrentlyCheckedIn,
                            activeColor = StatusOk,
                            modifier = Modifier.weight(1f),
                            onClick = {
                                triggerPunchAnimation(if (isWithinRadius) StatusOk else StatusWarn) {
                                    viewModel.doCheckIn(noteInput)
                                }
                            }
                        )
                        AnimatedActionPunchButton(
                            title = "Çıkış Yap",
                            subtitle = "Akşam Yoklaması",
                            icon = Icons.AutoMirrored.Filled.Logout,
                            isPrimary = isCurrentlyCheckedIn,
                            activeColor = AlbayrakRed,
                            modifier = Modifier.weight(1f),
                            onClick = {
                                triggerPunchAnimation(AlbayrakRed) {
                                    viewModel.doCheckOut(noteInput)
                                }
                            }
                        )
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(BgCanvas)
                            .border(1.dp, LineHairline, RoundedCornerShape(12.dp))
                            .padding(vertical = 10.dp, horizontal = 12.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        PunchTimeStat("İlk Giriş", firstCheckIn?.formattedTime ?: "--:--")
                        Box(
                            modifier = Modifier
                                .width(1.dp)
                                .height(26.dp)
                                .background(LineHairline)
                        )
                        PunchTimeStat("Son Çıkış", lastCheckOut?.formattedTime ?: "--:--")
                        Box(
                            modifier = Modifier
                                .width(1.dp)
                                .height(26.dp)
                                .background(LineHairline)
                        )
                        PunchTimeStat("Mesai Süresi", shiftDurationText.take(5))
                    }
                }
            }
        }

        // 2. CANLI ŞUBE HARİTASI, AÇIK ADRES & BENİM KONUMUM RADARI
        item(key = "branch_user_live_map") {
            BranchAndUserLiveMapCard(
                branch = selectedBranch,
                totalBranchCount = branches.size.coerceAtLeast(54),
                userLocation = userLocation,
                distanceMeters = distance,
                isWithinRadius = isWithinRadius,
                onOpenBranchSelector = { showBranchSelectorModal = true },
                onSimulateDistance = { dist -> viewModel.setSimulatedDistance(dist) },
                onStartRealGps = {
                    val hasPerm = ContextCompat.checkSelfPermission(
                        context,
                        Manifest.permission.ACCESS_FINE_LOCATION
                    ) == PackageManager.PERMISSION_GRANTED
                    if (hasPerm) {
                        viewModel.startRealGps(context)
                    } else {
                        locationPermissionLauncher.launch(
                            arrayOf(
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                            )
                        )
                    }
                },
                onOpenGoogleMaps = { b ->
                    val q = Uri.encode("${b.name} ${b.address}")
                    val gmmIntentUri = Uri.parse("geo:${b.latitude},${b.longitude}?q=${b.latitude},${b.longitude}($q)")
                    val mapIntent = Intent(Intent.ACTION_VIEW, gmmIntentUri)
                    try {
                        context.startActivity(mapIntent)
                    } catch (_: Exception) {
                        try {
                            val browserUri = Uri.parse("https://www.google.com/maps/search/?api=1&query=${b.latitude},${b.longitude}")
                            context.startActivity(Intent(Intent.ACTION_VIEW, browserUri))
                        } catch (_: Exception) {
                            Toast.makeText(context, "Harita uygulaması bulunamadı.", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            )
        }

        // 3. Hızlı İşlemler (Mazeret & Sunucu Eşitleme)
        item(key = "quick_actions") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                MinimalBasicButton(
                    text = "Mazeret / Not Bildir",
                    onClick = { showExcuseModal = true },
                    variant = MinimalButtonVariant.OUTLINE,
                    icon = Icons.Default.EditNote,
                    modifier = Modifier.weight(1f)
                )
                MinimalBasicButton(
                    text = "Sunucu ile Eşitle",
                    onClick = {
                        viewModel.syncWithServerDatabase()
                        Toast.makeText(context, "Kayıtlar merkezi sunucu ile eşitleniyor...", Toast.LENGTH_SHORT).show()
                    },
                    variant = MinimalButtonVariant.OUTLINE,
                    icon = Icons.Default.Sync,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // 4. Haftalık Devam ve Dakiklik Özeti
        item(key = "weekly_summary") {
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = CardSurface,
                border = BorderStroke(1.dp, LineHairline)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    MinimalSectionHeader(
                        title = "Haftalık kişisel çalışma özeti",
                        subtitle = "Son 5 iş günü mesai süresi ve 30m konum doğrulama uyumu"
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        MinimalKpiCard(
                            label = "Dakiklik Oranı",
                            value = "%96",
                            subtext = "08:30 vardiya uyumu",
                            deltaText = "+1.8p",
                            deltaTone = DeltaTone.OK,
                            modifier = Modifier.weight(1f)
                        )
                        MinimalKpiCard(
                            label = "Haftalık Süre",
                            value = "42.5 sa",
                            subtext = "Hedef: 42.5 saat",
                            deltaText = "Tam Uyum",
                            deltaTone = DeltaTone.OK,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    val weekDays = listOf(
                        Triple("Pzt", 8.8f, StatusOk),
                        Triple("Sal", 9.1f, StatusOk),
                        Triple("Çar", 8.5f, StatusWarn),
                        Triple("Per", 9.0f, StatusOk),
                        Triple("Cum", 8.6f, AlbayrakRed)
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(92.dp)
                            .padding(top = 6.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.Bottom
                    ) {
                        weekDays.forEach { (day, hrs, color) ->
                            val ratio = (hrs / 10f).coerceIn(0.15f, 1f)
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Bottom,
                                modifier = Modifier.fillMaxHeight()
                            ) {
                                Text(
                                    text = "${hrs}s",
                                    color = InkMuted,
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Box(
                                    modifier = Modifier
                                        .width(28.dp)
                                        .fillMaxHeight(ratio * 0.7f)
                                        .clip(RoundedCornerShape(topStart = 5.dp, topEnd = 5.dp))
                                        .background(color)
                                )
                                Spacer(modifier = Modifier.height(5.dp))
                                Text(
                                    text = day,
                                    color = InkSecondary,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showExcuseModal) {
        var excuseReason by remember { mutableStateOf(noteInput) }
        AlertDialog(
            onDismissRequest = { showExcuseModal = false },
            containerColor = CardSurface,
            shape = RoundedCornerShape(16.dp),
            title = {
                Text(
                    text = "Mazeret veya Görev Notu Bildir",
                    color = InkPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Geç giriş, erken çıkış veya dış görev açıklamanız İK ekranına iletilir.",
                        color = InkMuted,
                        fontSize = 12.sp
                    )
                    OutlinedTextField(
                        value = excuseReason,
                        onValueChange = { excuseReason = it },
                        label = { Text("Açıklama", fontSize = 12.sp) },
                        placeholder = { Text("Örn: Müşteri ziyareti / trafik yoğunluğu", fontSize = 12.sp) },
                        minLines = 3,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )
                }
            },
            confirmButton = {
                MinimalBasicButton(
                    text = "Kaydet ve İK'ya İlet",
                    onClick = {
                        noteInput = excuseReason.trim()
                        if (noteInput.isNotBlank()) {
                            viewModel.submitExcuse(noteInput)
                            Toast.makeText(context, "Mazeret bildiriminiz İK ekranına iletildi.", Toast.LENGTH_SHORT).show()
                        }
                        showExcuseModal = false
                    },
                    variant = MinimalButtonVariant.DARK
                )
            },
            dismissButton = {
                MinimalBasicButton(
                    text = "Vazgeç",
                    onClick = { showExcuseModal = false },
                    variant = MinimalButtonVariant.OUTLINE
                )
            }
        )
    }

    if (showBranchSelectorModal) {
        var searchQuery by remember { mutableStateOf("") }
        val filteredBranches = remember(branches, searchQuery) {
            val q = searchQuery.trim().lowercase(Locale("tr", "TR"))
            if (q.isEmpty()) branches
            else branches.filter {
                it.name.lowercase(Locale("tr", "TR")).contains(q) ||
                        it.city.lowercase(Locale("tr", "TR")).contains(q) ||
                        it.address.lowercase(Locale("tr", "TR")).contains(q) ||
                        it.branchCode.lowercase(Locale("tr", "TR")).contains(q)
            }
        }

        AlertDialog(
            onDismissRequest = { showBranchSelectorModal = false },
            containerColor = CardSurface,
            shape = RoundedCornerShape(18.dp),
            title = {
                Column {
                    Text(
                        text = "Şube & Açık Adres Seçimi (${branches.size} Şube)",
                        color = InkPrimary,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Şubenin açık adresini ve harita koordinatını seçin",
                        color = InkMuted,
                        fontSize = 11.5.sp
                    )
                }
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 420.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        placeholder = { Text("Şube, şehir, ilçe veya mahalle ara...", fontSize = 12.sp) },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = "Ara",
                                modifier = Modifier.size(18.dp)
                            )
                        },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )

                    LazyColumn(
                        modifier = Modifier.weight(1f, fill = false),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(filteredBranches, key = { it.id }) { branch ->
                            val isSel = branch.id == selectedBranch?.id
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(11.dp))
                                    .background(if (isSel) AlbayrakRedLight else BgCanvas)
                                    .border(
                                        1.dp,
                                        if (isSel) AlbayrakRed else LineHairline,
                                        RoundedCornerShape(11.dp)
                                    )
                                    .clickable {
                                        viewModel.selectBranch(branch)
                                        showBranchSelectorModal = false
                                    }
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.Top
                            ) {
                                Column(
                                    modifier = Modifier.weight(1f),
                                    verticalArrangement = Arrangement.spacedBy(3.dp)
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Text(
                                            text = branch.name,
                                            color = InkPrimary,
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                    Text(
                                        text = branch.address,
                                        color = InkSecondary,
                                        fontSize = 11.sp,
                                        lineHeight = 14.sp
                                    )
                                    Text(
                                        text = "${branch.city} · Tel: ${branch.phone} · ${String.format(Locale.US, "%.4f, %.4f", branch.latitude, branch.longitude)}",
                                        color = InkMuted,
                                        fontSize = 10.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                                if (isSel) {
                                    Icon(
                                        imageVector = Icons.Default.CheckCircle,
                                        contentDescription = "Seçili",
                                        tint = AlbayrakRed,
                                        modifier = Modifier
                                            .padding(start = 8.dp)
                                            .size(18.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                MinimalBasicButton(
                    text = "Kapat",
                    onClick = { showBranchSelectorModal = false },
                    variant = MinimalButtonVariant.OUTLINE
                )
            }
        )
    }
}

// ============================================================================
// ÇOK KATMANLI KUANTUM GİRİŞ / ÇIKIŞ ORB ANİMASYONU
// ============================================================================
@Composable
private fun InteractiveQuantumPunchOrb(
    isCheckedIn: Boolean,
    isWithinRadius: Boolean,
    distanceMeters: Double,
    shiftDurationText: String,
    burstProgressProvider: () -> Float,
    punchBounceProvider: () -> Float,
    burstColor: Color,
    onPunchClick: () -> Unit
) {
    val infiniteTransition = rememberInfiniteTransition(label = "quantum_orb")

    // 1. Dış Yörünge Sürekli Dönüşü (0..360 derece)
    val orbitRotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 12000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "orbit_rotation"
    )

    // 2. Ters Yönlü İç Enerji Halkası Dönüşü
    val counterRotation by infiniteTransition.animateFloat(
        initialValue = 360f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 8500, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "counter_rotation"
    )

    // 3. Nefes Alan (Breathing) Halo Genişlemesi
    val breathScale by infiniteTransition.animateFloat(
        initialValue = 0.90f,
        targetValue = 1.07f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1900, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "breath_scale"
    )

    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val pressScale by animateFloatAsState(
        targetValue = if (isPressed) 0.92f else 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMediumLow
        ),
        label = "orb_press_scale"
    )

    val primaryColor by animateColorAsState(
        targetValue = when {
            !isWithinRadius -> StatusWarn
            isCheckedIn -> StatusOk
            else -> AlbayrakRed
        },
        animationSpec = tween(320),
        label = "orb_primary_color"
    )

    val coreBgColor by animateColorAsState(
        targetValue = when {
            !isWithinRadius -> StatusWarnSoft
            isCheckedIn -> StatusOkSoft
            else -> CardSurface
        },
        animationSpec = tween(320),
        label = "orb_core_bg"
    )

    Box(
        modifier = Modifier
            .size(220.dp)
            .graphicsLayer {
                val combinedScale = pressScale * punchBounceProvider()
                scaleX = combinedScale
                scaleY = combinedScale
            }
            .clip(CircleShape)
            .clickable(
                interactionSource = interactionSource,
                indication = null
            ) { onPunchClick() },
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val center = Offset(size.width / 2f, size.height / 2f)
            val maxR = size.minDimension / 2f
            val burstProgress = burstProgressProvider()

            // Yumuşak Radyal Arka Plan Işıması (Aura)
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        primaryColor.copy(alpha = 0.22f),
                        primaryColor.copy(alpha = 0.05f),
                        Color.Transparent
                    ),
                    center = center,
                    radius = maxR * breathScale
                ),
                radius = maxR * breathScale,
                center = center
            )

            // Nefes Alan Dış Halka
            drawCircle(
                color = primaryColor.copy(alpha = 0.20f),
                radius = maxR * 0.88f * breathScale,
                center = center,
                style = Stroke(width = 1.5.dp.toPx())
            )

            // Dönen Kesikli Yörünge Halkası (Orbital Track)
            rotate(degrees = orbitRotation, pivot = center) {
                drawCircle(
                    color = primaryColor.copy(alpha = 0.42f),
                    radius = maxR * 0.78f,
                    center = center,
                    style = Stroke(
                        width = 2.dp.toPx(),
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(18f, 14f), 0f)
                    )
                )
                // Yörünge Üzerindeki Uydu Noktası
                val satAngleRad = Math.toRadians(0.0)
                val satX = center.x + (maxR * 0.78f) * cos(satAngleRad).toFloat()
                val satY = center.y + (maxR * 0.78f) * sin(satAngleRad).toFloat()
                drawCircle(
                    color = primaryColor,
                    radius = 4.5.dp.toPx(),
                    center = Offset(satX, satY)
                )
            }

            // Ters Dönen Enerji Yayları (Arcs)
            rotate(degrees = counterRotation, pivot = center) {
                drawArc(
                    color = primaryColor.copy(alpha = 0.65f),
                    startAngle = 20f,
                    sweepAngle = 110f,
                    useCenter = false,
                    topLeft = Offset(center.x - maxR * 0.70f, center.y - maxR * 0.70f),
                    size = Size(maxR * 1.40f, maxR * 1.40f),
                    style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
                )
                drawArc(
                    color = primaryColor.copy(alpha = 0.65f),
                    startAngle = 200f,
                    sweepAngle = 110f,
                    useCenter = false,
                    topLeft = Offset(center.x - maxR * 0.70f, center.y - maxR * 0.70f),
                    size = Size(maxR * 1.40f, maxR * 1.40f),
                    style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
                )
            }

            // Tıklama Anında Yayılan Şok Dalgası (Shockwave) & 16 Radyal Parçacık Patlaması
            if (burstProgress > 0.01f) {
                val fadeAlpha = (1f - burstProgress).coerceIn(0f, 1f)
                val waveRadius1 = maxR * (0.58f + burstProgress * 0.42f)
                val waveRadius2 = maxR * (0.52f + burstProgress * 0.32f)

                drawCircle(
                    color = burstColor.copy(alpha = fadeAlpha * 0.75f),
                    radius = waveRadius1,
                    center = center,
                    style = Stroke(width = (4.dp.toPx() * fadeAlpha).coerceAtLeast(1f))
                )
                drawCircle(
                    color = burstColor.copy(alpha = fadeAlpha * 0.45f),
                    radius = waveRadius2,
                    center = center,
                    style = Stroke(width = (2.dp.toPx() * fadeAlpha).coerceAtLeast(1f))
                )

                val particleCount = 16
                for (i in 0 until particleCount) {
                    val angleRad = Math.toRadians((i * (360.0 / particleCount)))
                    val distR = maxR * (0.58f + burstProgress * 0.40f)
                    val px = center.x + distR * cos(angleRad).toFloat()
                    val py = center.y + distR * sin(angleRad).toFloat()
                    drawCircle(
                        color = burstColor.copy(alpha = fadeAlpha),
                        radius = (3.8.dp.toPx() * fadeAlpha).coerceAtLeast(1f),
                        center = Offset(px, py)
                    )
                }
            }
        }

        // İç Çekirdek (Interactive Core)
        Surface(
            modifier = Modifier.size(144.dp),
            shape = CircleShape,
            color = coreBgColor,
            border = BorderStroke(2.5.dp, primaryColor)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                AnimatedContent(
                    targetState = isCheckedIn to isWithinRadius,
                    transitionSpec = {
                        (fadeIn(tween(200)) + scaleIn(initialScale = 0.88f, animationSpec = tween(200))) togetherWith
                                (fadeOut(tween(140)) + scaleOut(targetScale = 0.92f, animationSpec = tween(140)))
                    },
                    label = "punch_core_content"
                ) { (checkedIn, withinRadius) ->
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(primaryColor.copy(alpha = 0.14f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = when {
                                    !withinRadius -> Icons.Default.LocationOff
                                    checkedIn -> Icons.Default.Verified
                                    else -> Icons.Default.Fingerprint
                                },
                                contentDescription = null,
                                tint = primaryColor,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        Text(
                            text = when {
                                !withinRadius -> "30m SINIR DIŞI"
                                checkedIn -> "AKTİF MESAİ"
                                else -> "MESAİYE HAZIR"
                            },
                            color = InkSecondary,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.7.sp
                        )

                        Spacer(modifier = Modifier.height(2.dp))

                        Text(
                            text = if (checkedIn) shiftDurationText else String.format(Locale.US, "%.1f m", distanceMeters),
                            color = InkPrimary,
                            fontSize = 18.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = (-0.5).sp
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(999.dp))
                                .background(primaryColor)
                                .padding(horizontal = 10.dp, vertical = 3.dp)
                        ) {
                            Text(
                                text = when {
                                    !withinRadius -> "Konum Doğrula"
                                    checkedIn -> "Çıkış İçin Dokun"
                                    else -> "Giriş İçin Dokun"
                                },
                                color = Color.White,
                                fontSize = 9.5.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AnimatedActionPunchButton(
    title: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    isPrimary: Boolean,
    activeColor: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.95f else 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMediumLow
        ),
        label = "action_btn_scale"
    )

    val containerColor by animateColorAsState(
        targetValue = if (isPrimary) InkPrimary else CardSurface,
        animationSpec = tween(220),
        label = "action_btn_bg"
    )

    Surface(
        modifier = modifier
            .height(54.dp)
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            },
        shape = RoundedCornerShape(12.dp),
        color = containerColor,
        border = BorderStroke(1.dp, if (isPrimary) InkPrimary else LineHairline),
        interactionSource = interactionSource,
        onClick = onClick
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (isPrimary) activeColor else SubtleSurface),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = title,
                    tint = if (isPrimary) Color.White else InkPrimary,
                    modifier = Modifier.size(17.dp)
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    color = if (isPrimary) Color.White else InkPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1
                )
                Text(
                    text = subtitle,
                    color = if (isPrimary) Color.White.copy(alpha = 0.65f) else InkMuted,
                    fontSize = 10.sp,
                    maxLines = 1
                )
            }
        }
    }
}

// ============================================================================
// CANLI ŞUBE HARİTASI, AÇIK ADRES & BENİM KONUMUM KARTI
// ============================================================================
@Composable
private fun BranchAndUserLiveMapCard(
    branch: BranchEntity?,
    totalBranchCount: Int,
    userLocation: UserLocationData,
    distanceMeters: Double,
    isWithinRadius: Boolean,
    onOpenBranchSelector: () -> Unit,
    onSimulateDistance: (Double) -> Unit,
    onStartRealGps: () -> Unit,
    onOpenGoogleMaps: (BranchEntity) -> Unit
) {
    var mapStyleIdx by remember { mutableIntStateOf(0) } // 0: Sokak Haritası, 1: 30m Uydu Radarı
    var mapZoomLevel by remember { mutableFloatStateOf(1f) } // 0.75f .. 1.6f

    val infiniteTransition = rememberInfiniteTransition(label = "map_beacon")
    val beaconPulse by infiniteTransition.animateFloat(
        initialValue = 0.6f,
        targetValue = 1.4f,
        animationSpec = infiniteRepeatable(
            animation = tween(1400, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "beacon_pulse"
    )
    val radarSweepAngle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(4200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "radar_sweep"
    )

    val animatedDist by animateFloatAsState(
        targetValue = distanceMeters.toFloat(),
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioNoBouncy,
            stiffness = Spring.StiffnessMediumLow
        ),
        label = "animated_map_dist"
    )

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = CardSurface,
        border = BorderStroke(1.dp, LineHairline)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
                // Başlık + Şube Değiştir Butonu
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .padding(end = 10.dp)
                    ) {
                        Text(
                            text = "Şube Haritası & Canlı Konumum",
                            color = InkPrimary,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Şubenin haritadaki yeri, açık adresi ve sizin şubeye mesafeniz",
                            color = InkMuted,
                            fontSize = 11.sp
                        )
                    }

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(AlbayrakRedLight)
                            .clickable { onOpenBranchSelector() }
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.SwapHoriz,
                                contentDescription = "Şube Seç",
                                tint = AlbayrakRed,
                                modifier = Modifier.size(14.dp)
                            )
                            Text(
                                text = "Şube Seç ($totalBranchCount)",
                                color = AlbayrakRed,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                softWrap = false
                            )
                        }
                    }
                }

            // Seçili Şube Açık Adres & İletişim Kutusu
            if (branch != null) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(BgCanvas)
                        .border(1.dp, LineHairline, RoundedCornerShape(12.dp))
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Business,
                                contentDescription = null,
                                tint = AlbayrakRed,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = branch.name,
                                color = InkPrimary,
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                        MinimalStatusBadge(
                            text = "${branch.city} · ${branch.branchCode}",
                            tone = DeltaTone.NEUTRAL
                        )
                    }

                    Text(
                        text = branch.address,
                        color = InkSecondary,
                        fontSize = 11.5.sp,
                        lineHeight = 16.sp
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Tel: ${branch.phone} · Wi-Fi: ${branch.wifiSsid}",
                            color = InkMuted,
                            fontSize = 10.5.sp,
                            fontFamily = FontFamily.Monospace,
                            modifier = Modifier
                                .weight(1f)
                                .padding(end = 8.dp),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = String.format(Locale.US, "%.4f, %.4f", branch.latitude, branch.longitude),
                            color = InkPrimary,
                            fontSize = 10.5.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            softWrap = false
                        )
                    }
                }
            }

            // Harita Modu Seçici (Sokak Haritası vs 30m Uydu Radarı)
            MinimalSegmentedControl(
                items = listOf("Sokak & Cadde Haritası", "30m Uydu Radarı"),
                selectedIndex = mapStyleIdx,
                onSelect = { mapStyleIdx = it }
            )

            // İnteraktif Harita Canvas (Şube Pin + 30m Geofence Çemberi + Personel Canlı Pin)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(225.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .border(1.dp, LineHairline, RoundedCornerShape(14.dp))
            ) {
                val statusPinColor = if (isWithinRadius) StatusOk else StatusBad

                Canvas(modifier = Modifier.fillMaxSize()) {
                    val w = size.width
                    val h = size.height
                    val cx = w * 0.46f
                    val cy = h * 0.52f

                    if (mapStyleIdx == 0) {
                        // 1. SOKAK & CADDE HARİTASI GÖRÜNÜMÜ
                        drawRect(color = Color(0xFFEEF2F6))

                        // Park / Yeşil Alan Blokları
                        drawRoundRect(
                            color = Color(0xFFDCECE2),
                            topLeft = Offset(w * 0.04f, h * 0.08f),
                            size = Size(w * 0.24f, h * 0.30f),
                            cornerRadius = CornerRadius(12f, 12f)
                        )
                        drawRoundRect(
                            color = Color(0xFFDCECE2),
                            topLeft = Offset(w * 0.72f, h * 0.62f),
                            size = Size(w * 0.23f, h * 0.30f),
                            cornerRadius = CornerRadius(12f, 12f)
                        )

                        // Mimari Bina Adaları
                        val blocks = listOf(
                            Offset(w * 0.32f, h * 0.08f) to Size(w * 0.28f, h * 0.22f),
                            Offset(w * 0.66f, h * 0.08f) to Size(w * 0.28f, h * 0.26f),
                            Offset(w * 0.05f, h * 0.56f) to Size(w * 0.26f, h * 0.34f),
                            Offset(w * 0.36f, h * 0.68f) to Size(w * 0.30f, h * 0.24f)
                        )
                        blocks.forEach { (topLeft, blockSize) ->
                            drawRoundRect(
                                color = Color(0xFFE2E8F0),
                                topLeft = topLeft,
                                size = blockSize,
                                cornerRadius = CornerRadius(8f, 8f)
                            )
                        }

                        // Tali Sokaklar ve Ana Caddeler
                        val roadColor = Color.White
                        val roadBorder = Color(0xFFCBD5E1)
                        // Yatay Ana Bulvar
                        drawLine(
                            color = roadBorder,
                            start = Offset(0f, cy),
                            end = Offset(w, cy),
                            strokeWidth = 22.dp.toPx()
                        )
                        drawLine(
                            color = roadColor,
                            start = Offset(0f, cy),
                            end = Offset(w, cy),
                            strokeWidth = 18.dp.toPx()
                        )
                        // Dikey Ana Cadde
                        drawLine(
                            color = roadBorder,
                            start = Offset(cx, 0f),
                            end = Offset(cx, h),
                            strokeWidth = 20.dp.toPx()
                        )
                        drawLine(
                            color = roadColor,
                            start = Offset(cx, 0f),
                            end = Offset(cx, h),
                            strokeWidth = 16.dp.toPx()
                        )
                        // Çapraz Bağlantı Yolu
                        drawLine(
                            color = roadColor,
                            start = Offset(w * 0.1f, h * 0.9f),
                            end = Offset(w * 0.9f, h * 0.15f),
                            strokeWidth = 10.dp.toPx()
                        )
                    } else {
                        // 2. 30m UYDU RADAR GÖRÜNÜMÜ
                        drawRect(color = AlbayrakDarkSurface)
                        val gridStep = 28.dp.toPx()
                        var gx = 0f
                        while (gx < w) {
                            drawLine(
                                color = Color.White.copy(alpha = 0.05f),
                                start = Offset(gx, 0f),
                                end = Offset(gx, h),
                                strokeWidth = 1f
                            )
                            gx += gridStep
                        }
                        var gy = 0f
                        while (gy < h) {
                            drawLine(
                                color = Color.White.copy(alpha = 0.05f),
                                start = Offset(0f, gy),
                                end = Offset(w, gy),
                                strokeWidth = 1f
                            )
                            gy += gridStep
                        }

                        // Radar Tarama Açısı
                        rotate(degrees = radarSweepAngle, pivot = Offset(cx, cy)) {
                            drawArc(
                                brush = Brush.sweepGradient(
                                    colors = listOf(
                                        Color.Transparent,
                                        StatusOk.copy(alpha = 0.25f)
                                    ),
                                    center = Offset(cx, cy)
                                ),
                                startAngle = 0f,
                                sweepAngle = 75f,
                                useCenter = true,
                                topLeft = Offset(cx - 95.dp.toPx(), cy - 95.dp.toPx()),
                                size = Size(190.dp.toPx(), 190.dp.toPx())
                            )
                        }
                    }

                    // 30m Geofence Güvenlik Alanı Çemberi
                    val geofenceRadiusPx = (48.dp.toPx() * mapZoomLevel).coerceIn(32.dp.toPx(), 84.dp.toPx())
                    drawCircle(
                        color = if (isWithinRadius) StatusOk.copy(alpha = 0.16f) else AlbayrakRed.copy(alpha = 0.14f),
                        radius = geofenceRadiusPx,
                        center = Offset(cx, cy)
                    )
                    drawCircle(
                        color = if (isWithinRadius) StatusOk else AlbayrakRed,
                        radius = geofenceRadiusPx,
                        center = Offset(cx, cy),
                        style = Stroke(
                            width = 2.dp.toPx(),
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 8f), 0f)
                        )
                    )

                    // Personel Konumunun Şube Merkezine Göre Harita Üzerindeki Noktası
                    val normalizedRatio = (animatedDist / 30f).coerceIn(0.05f, 2.1f)
                    val userOffsetPx = geofenceRadiusPx * normalizedRatio
                    val angleRad = Math.toRadians(28.0) // Kuzeydoğu - Doğu yönü
                    val ux = (cx + userOffsetPx * cos(angleRad).toFloat()).coerceIn(24.dp.toPx(), w - 24.dp.toPx())
                    val uy = (cy - userOffsetPx * sin(angleRad).toFloat()).coerceIn(24.dp.toPx(), h - 24.dp.toPx())

                    // Şube ile Personel Arası Mesafe Vektör Çizgisi
                    drawLine(
                        color = statusPinColor,
                        start = Offset(cx, cy),
                        end = Offset(ux, uy),
                        strokeWidth = 2.5.dp.toPx(),
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 6f), 0f)
                    )

                    // ŞUBE MERKEZ PİNİ (Albayrak Kırmızısı)
                    drawCircle(
                        color = AlbayrakRed.copy(alpha = 0.28f),
                        radius = 15.dp.toPx(),
                        center = Offset(cx, cy)
                    )
                    drawCircle(
                        color = Color.White,
                        radius = 9.dp.toPx(),
                        center = Offset(cx, cy)
                    )
                    drawCircle(
                        color = AlbayrakRed,
                        radius = 6.5.dp.toPx(),
                        center = Offset(cx, cy)
                    )

                    // PERSONEL (BENİM KONUMUM) CANLI GPS PİNİ
                    drawCircle(
                        color = statusPinColor.copy(alpha = 0.26f),
                        radius = 13.dp.toPx() * beaconPulse,
                        center = Offset(ux, uy)
                    )
                    drawCircle(
                        color = Color.White,
                        radius = 8.dp.toPx(),
                        center = Offset(ux, uy)
                    )
                    drawCircle(
                        color = statusPinColor,
                        radius = 5.5.dp.toPx(),
                        center = Offset(ux, uy)
                    )
                }

                // Sol Üst Harita Lejant Etiketleri (Şube & Benim Konumum)
                Column(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(10.dp)
                        .widthIn(max = 235.dp)
                        .clip(RoundedCornerShape(9.dp))
                        .background(AlbayrakDarkSurface.copy(alpha = 0.86f))
                        .padding(horizontal = 10.dp, vertical = 7.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(AlbayrakRed)
                        )
                        Text(
                            text = "Şube: ${branch?.name ?: "Genel Müdürlük"}",
                            color = Color.White,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(if (isWithinRadius) StatusOk else StatusBad)
                        )
                        Text(
                            text = String.format(
                                Locale.US,
                                "Benim Konumum: %.1f m (%s)",
                                distanceMeters,
                                if (isWithinRadius) "30m İçinde" else "Sınır Dışı"
                            ),
                            color = Color.White.copy(alpha = 0.90f),
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }

                // Sağ Üst Yakınlaştırma (+ / -) Kontrolleri
                Column(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(10.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(CardSurface.copy(alpha = 0.92f))
                        .border(1.dp, LineHairline, RoundedCornerShape(8.dp))
                ) {
                    Box(
                        modifier = Modifier
                            .size(30.dp)
                            .clickable { mapZoomLevel = (mapZoomLevel + 0.2f).coerceAtMost(1.6f) },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "Yakınlaştır",
                            tint = InkPrimary,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                    HorizontalDivider(color = LineHairline, thickness = 1.dp, modifier = Modifier.width(30.dp))
                    Box(
                        modifier = Modifier
                            .size(30.dp)
                            .clickable { mapZoomLevel = (mapZoomLevel - 0.2f).coerceAtLeast(0.75f) },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Remove,
                            contentDescription = "Uzaklaştır",
                            tint = InkPrimary,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }

                // Alt Koordinat & Google Haritalar'da Aç Şeridi
                Row(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .background(AlbayrakDarkSurface.copy(alpha = 0.88f))
                        .padding(horizontal = 12.dp, vertical = 7.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = String.format(
                            Locale.US,
                            "Ben: %.4f, %.4f",
                            userLocation.latitude,
                            userLocation.longitude
                        ),
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier
                            .weight(1f)
                            .padding(end = 8.dp),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    if (branch != null) {
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(AlbayrakRed)
                                .clickable { onOpenGoogleMaps(branch) }
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Directions,
                                contentDescription = "Yol Tarifi",
                                tint = Color.White,
                                modifier = Modifier.size(12.dp)
                            )
                            Text(
                                text = "Google Haritalar'da Aç",
                                color = Color.White,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                softWrap = false
                            )
                        }
                    }
                }
            }

            // Canlı Mesafe Simülasyon Kaydırıcısı ve Hızlı Konum Çipleri
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Harita Üzerinde Konum & Mesafe Testi",
                        color = InkSecondary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier
                            .weight(1f)
                            .padding(end = 8.dp),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = String.format(Locale.US, "%.1f metre", distanceMeters),
                        color = if (isWithinRadius) StatusOk else StatusBad,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        softWrap = false
                    )
                }

                Slider(
                    value = distanceMeters.toFloat().coerceIn(1f, 85f),
                    onValueChange = { onSimulateDistance(it.toDouble()) },
                    valueRange = 1f..85f,
                    colors = SliderDefaults.colors(
                        thumbColor = AlbayrakRed,
                        activeTrackColor = if (isWithinRadius) StatusOk else AlbayrakRed,
                        inactiveTrackColor = SubtleSurface
                    ),
                    modifier = Modifier.height(26.dp)
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    SmallSimChip(
                        label = "2.5m İçi",
                        active = distanceMeters <= 10.0 && userLocation.isSimulated,
                        modifier = Modifier.weight(1f),
                        onClick = { onSimulateDistance(2.5) }
                    )
                    SmallSimChip(
                        label = "26m Sınır",
                        active = distanceMeters in 10.1..30.0 && userLocation.isSimulated,
                        modifier = Modifier.weight(1f),
                        onClick = { onSimulateDistance(26.0) }
                    )
                    SmallSimChip(
                        label = "75m Dış",
                        active = !isWithinRadius && userLocation.isSimulated,
                        modifier = Modifier.weight(1f),
                        onClick = { onSimulateDistance(75.0) }
                    )
                    SmallSimChip(
                        label = "Canlı GPS",
                        active = !userLocation.isSimulated,
                        modifier = Modifier.weight(1f),
                        onClick = onStartRealGps
                    )
                }
            }
        }
    }
}

@Composable
private fun SmallSimChip(
    label: String,
    active: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(if (active) InkPrimary else SubtleSurface)
            .clickable { onClick() }
            .padding(horizontal = 6.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            color = if (active) Color.White else InkSecondary,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            maxLines = 1,
            softWrap = false
        )
    }
}

@Composable
private fun PunchTimeStat(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = label,
            color = InkMuted,
            fontSize = 10.sp,
            fontWeight = FontWeight.Medium
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = value,
            color = InkPrimary,
            fontSize = 14.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold
        )
    }
}
