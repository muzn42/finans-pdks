package com.example.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.example.data.repository.AttendanceResult
import com.example.ui.MainViewModel
import com.example.ui.components.*
import com.example.ui.theme.*
import com.example.util.SoundEffectPlayer
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun PersonnelScreen(viewModel: MainViewModel) {
    val context = LocalContext.current
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
    val todayDateStr = remember(currentTimeMillis) {
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

    // Son işlem geri bildirimi ve kurumsal harmonik ses efekti
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
                is AttendanceResult.Error -> {
                    SoundEffectPlayer.playWarningTone(context)
                    res.errorMessage
                }
            }
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
            viewModel.dismissActionResult()
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(BgCanvas),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. Üst Şube & 30m Geofence Doğrulama Çubuğu
        item {
            Surface(
                shape = RoundedCornerShape(12.dp),
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
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(6.dp))
                                .clickable { showBranchSelectorModal = true }
                                .padding(vertical = 2.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(
                                        when {
                                            userLocation.isMock -> StatusBad
                                            isWithinRadius -> StatusOk
                                            else -> StatusWarn
                                        }
                                    )
                            )
                            Column {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Text(
                                        text = selectedBranch?.name ?: "Genel Müdürlük (Topkapı)",
                                        color = InkPrimary,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Icon(
                                        imageVector = Icons.Default.KeyboardArrowDown,
                                        contentDescription = "Şube Seç",
                                        tint = InkMuted,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                                Text(
                                    text = dateFormatter.format(Date(currentTimeMillis)),
                                    color = InkMuted,
                                    fontSize = 11.sp
                                )
                            }
                        }

                        MinimalStatusBadge(
                            text = String.format(Locale.US, "%.1f m / 30 m", distance),
                            tone = when {
                                userLocation.isMock -> DeltaTone.BAD
                                isWithinRadius -> DeltaTone.OK
                                else -> DeltaTone.WARN
                            }
                        )
                    }

                    HorizontalDivider(color = LineHairline, thickness = 1.dp)

                    // Konum Test / GPS Kontrol Satırı
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isWithinRadius) "30m güvenli şube alanı içerisindesiniz"
                            else "Şube sınırının (30m) dışındasınız",
                            color = InkMuted,
                            fontSize = 11.sp,
                            modifier = Modifier.weight(1f)
                        )

                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            SmallSimChip(
                                label = "Şube İçi (2.5m)",
                                active = isWithinRadius && userLocation.isSimulated,
                                onClick = { viewModel.setSimulatedDistance(2.5) }
                            )
                            SmallSimChip(
                                label = "Alan Dışı (85m)",
                                active = !isWithinRadius && userLocation.isSimulated,
                                onClick = { viewModel.setSimulatedDistance(85.0) }
                            )
                            SmallSimChip(
                                label = "Canlı GPS",
                                active = !userLocation.isSimulated,
                                onClick = {
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
                                }
                            )
                        }
                    }
                }
            }
        }

        // 2. ANA YOKLAMA KARTI (Minimalist Tek Dokunuşla Giriş / Çıkış)
        item {
            Surface(
                shape = RoundedCornerShape(16.dp),
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
                        MinimalStatusBadge(
                            text = when {
                                isCurrentlyCheckedIn -> "Mesai Devam Ediyor"
                                firstCheckIn != null -> "Mesai Tamamlandı"
                                else -> "Giriş Bekleniyor"
                            },
                            tone = when {
                                isCurrentlyCheckedIn -> DeltaTone.OK
                                firstCheckIn != null -> DeltaTone.NEUTRAL
                                else -> DeltaTone.WARN
                            }
                        )
                        Text(
                            text = clockFormatter.format(Date(currentTimeMillis)),
                            color = InkMuted,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    MinimalPunchOrb(
                        isCheckedIn = isCurrentlyCheckedIn,
                        isWithinRadius = isWithinRadius,
                        shiftDurationText = shiftDurationText,
                        onPunchClick = {
                            if (isCurrentlyCheckedIn) {
                                viewModel.doCheckOut(noteInput)
                            } else {
                                viewModel.doCheckIn(noteInput)
                            }
                        }
                    )

                    Spacer(modifier = Modifier.height(18.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        MinimalBasicButton(
                            text = "Giriş Kaydı",
                            onClick = { viewModel.doCheckIn(noteInput) },
                            variant = if (!isCurrentlyCheckedIn) MinimalButtonVariant.DARK else MinimalButtonVariant.OUTLINE,
                            icon = Icons.AutoMirrored.Filled.Login,
                            height = 46.dp,
                            modifier = Modifier.weight(1f)
                        )
                        MinimalBasicButton(
                            text = "Çıkış Kaydı",
                            onClick = { viewModel.doCheckOut(noteInput) },
                            variant = if (isCurrentlyCheckedIn) MinimalButtonVariant.BRAND_RED else MinimalButtonVariant.OUTLINE,
                            icon = Icons.AutoMirrored.Filled.Logout,
                            height = 46.dp,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(BgCanvas)
                            .border(1.dp, LineHairline, RoundedCornerShape(10.dp))
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

        // 3. Hızlı İşlemler (Mazeret & Sunucu Eşitleme)
        item {
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
        item {
            Surface(
                shape = RoundedCornerShape(12.dp),
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
                        title = "Haftalık çalışma özeti",
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
                            subtext = "Hedef: 45.0 saat",
                            deltaText = "Normal",
                            deltaTone = DeltaTone.NEUTRAL,
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
        AlertDialog(
            onDismissRequest = { showBranchSelectorModal = false },
            containerColor = CardSurface,
            shape = RoundedCornerShape(16.dp),
            title = {
                Text(
                    text = "Şube Seçimi (30m Geofence)",
                    color = InkPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    branches.forEach { branch ->
                        val isSel = branch.id == selectedBranch?.id
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (isSel) SubtleSurface else CardSurface)
                                .border(1.dp, if (isSel) InkPrimary else LineHairline, RoundedCornerShape(10.dp))
                                .clickable {
                                    viewModel.selectBranch(branch)
                                    showBranchSelectorModal = false
                                }
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = branch.name,
                                    color = InkPrimary,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "${branch.city} · Sınır: ${branch.radiusMeters.toInt()}m",
                                    color = InkMuted,
                                    fontSize = 11.sp
                                )
                            }
                            if (isSel) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = AlbayrakRed,
                                    modifier = Modifier.size(18.dp)
                                )
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

@Composable
private fun SmallSimChip(
    label: String,
    active: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(if (active) InkPrimary else SubtleSurface)
            .clickable { onClick() }
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = label,
            color = if (active) Color.White else InkSecondary,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun MinimalPunchOrb(
    isCheckedIn: Boolean,
    isWithinRadius: Boolean,
    shiftDurationText: String,
    onPunchClick: () -> Unit
) {
    val infiniteTransition = rememberInfiniteTransition(label = "orb_pulse")
    val pulseRadius by infiniteTransition.animateFloat(
        initialValue = 0.88f,
        targetValue = 1.06f,
        animationSpec = infiniteRepeatable(
            animation = tween(1800, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_radius"
    )

    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.96f else 1f,
        animationSpec = spring(stiffness = Spring.StiffnessMedium),
        label = "orb_scale"
    )

    val ringColor by animateColorAsState(
        targetValue = when {
            isCheckedIn -> StatusOk
            isWithinRadius -> AlbayrakRed
            else -> StatusWarn
        },
        animationSpec = tween(250),
        label = "orb_ring_color"
    )

    Box(
        modifier = Modifier
            .size(172.dp)
            .scale(scale)
            .clip(CircleShape)
            .clickable(
                interactionSource = interactionSource,
                indication = null
            ) { onPunchClick() },
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val center = Offset(size.width / 2f, size.height / 2f)
            val baseR = size.minDimension / 2f

            drawCircle(
                color = ringColor.copy(alpha = 0.14f),
                radius = baseR * pulseRadius,
                center = center,
                style = Stroke(width = 1.5.dp.toPx())
            )
            drawCircle(
                color = ringColor.copy(alpha = 0.28f),
                radius = baseR * 0.84f,
                center = center,
                style = Stroke(width = 1.5.dp.toPx())
            )
        }

        Surface(
            modifier = Modifier.size(132.dp),
            shape = CircleShape,
            color = BgCanvas,
            border = BorderStroke(1.5.dp, ringColor.copy(alpha = 0.55f))
        ) {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = if (isCheckedIn) "AKTİF SÜRE" else "VARDİYA",
                    color = InkMuted,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.8.sp
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = shiftDurationText,
                    color = InkPrimary,
                    fontSize = 19.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.5).sp
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = if (isCheckedIn) "Çıkış için dokun" else "Giriş için dokun",
                    color = ringColor,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
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
