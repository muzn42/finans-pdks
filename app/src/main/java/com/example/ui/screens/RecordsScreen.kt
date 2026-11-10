package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.local.AttendanceRecordEntity
import com.example.data.local.UserRole
import com.example.ui.MainViewModel
import com.example.ui.components.*
import com.example.ui.theme.*
import java.util.Locale

@Composable
fun RecordsScreen(viewModel: MainViewModel) {
    val context = LocalContext.current
    val allRecords by viewModel.records.collectAsState()
    val currentRole by viewModel.currentRole.collectAsState()
    val selectedEmployee by viewModel.selectedEmployee.collectAsState()

    var typeFilter by remember { mutableStateOf("ALL") }
    var sortMode by remember { mutableStateOf("RECENT") } // RECENT, DISTANCE, LATE
    var searchQuery by remember { mutableStateOf("") }
    var expandedRecordId by remember { mutableStateOf<Long?>(null) }

    // Üst Süre ve Özel Tarih Filtresi
    var selectedPeriodDays by remember { mutableIntStateOf(30) }
    var customFromDate by remember { mutableStateOf("") }
    var customToDate by remember { mutableStateOf("") }

    // Personel rolündeyse sadece kendi kayıtları, İK/BT ise tüm kayıtlar
    val roleScopedRecords = remember(allRecords, currentRole, selectedEmployee) {
        if (currentRole == UserRole.PERSONNEL && selectedEmployee != null) {
            allRecords.filter {
                it.employeeId == selectedEmployee?.id ||
                        it.employeeName.equals(selectedEmployee?.fullName, ignoreCase = true)
            }
        } else {
            allRecords
        }
    }

    val filteredRecords = remember(
        roleScopedRecords,
        typeFilter,
        sortMode,
        searchQuery,
        selectedPeriodDays,
        customFromDate,
        customToDate
    ) {
        val base = roleScopedRecords.filter { rec ->
            val typeMatch = when (typeFilter) {
                "IN" -> rec.recordType == "GİRİŞ"
                "OUT" -> rec.recordType == "ÇIKIŞ"
                "LATE" -> rec.lateMinutes > 0
                "OUTSIDE" -> !rec.isWithin5Meters
                else -> true
            }
            val queryMatch = searchQuery.isBlank() ||
                    rec.employeeName.contains(searchQuery, ignoreCase = true) ||
                    rec.branchName.contains(searchQuery, ignoreCase = true) ||
                    rec.formattedDate.contains(searchQuery, ignoreCase = true)

            val dateMatch = when {
                customFromDate.isNotBlank() || customToDate.isNotBlank() -> {
                    val fromMs = parseDmyToMillis(customFromDate) ?: Long.MIN_VALUE
                    val toRaw = parseDmyToMillis(customToDate) ?: Long.MAX_VALUE
                    // Bitiş gününün tamamı dahil olsun
                    val toMs = if (toRaw == Long.MAX_VALUE) toRaw else toRaw + DAY_MS - 1
                    rec.timestamp in fromMs..toMs
                }
                else -> {
                    // "Bugün / 7 Gün / 30 Gün / 60 Gün" seçimi kayıtları gerçekten süzer
                    val cutoff = startOfTodayMillis() -
                            (selectedPeriodDays.coerceAtLeast(1) - 1).toLong() * DAY_MS
                    rec.timestamp >= cutoff
                }
            }

            typeMatch && queryMatch && dateMatch
        }
        when (sortMode) {
            "DISTANCE" -> base.sortedBy { it.distanceMeters }
            "LATE" -> base.sortedByDescending { it.lateMinutes }
            else -> base.sortedByDescending { it.timestamp }
        }
    }

    val onTimeCount = roleScopedRecords.count { it.lateMinutes == 0 && it.isWithin5Meters }
    val lateCount = roleScopedRecords.count { it.lateMinutes > 0 }
    val outsideCount = roleScopedRecords.count { !it.isWithin5Meters }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(BgCanvas),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f).padding(end = 10.dp)) {
                    Text(
                        text = if (currentRole == UserRole.PERSONNEL) "Kişisel Yoklama Geçmişi" else "Kurumsal Yoklama Kayıtları",
                        color = InkPrimary,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.3).sp
                    )
                    Text(
                        text = "Toplam ${filteredRecords.size} kayıt · 30m Geofence denetimli",
                        color = InkMuted,
                        fontSize = 12.sp
                    )
                }

                AnimatedDownloadButton(
                    label = "Excel İndir",
                    onDownloadComplete = {
                        exportFormattedExcelReport(
                            context = context,
                            fileNamePrefix = "Albayrak_Yoklama_Kayitlari",
                            title = if (currentRole == UserRole.PERSONNEL) "Kişisel Yoklama Geçmişi Raporu" else "Kurumsal Yoklama Kayıtları Raporu",
                            subtitle = "Filtrelenen ${filteredRecords.size} kayıt",
                            kpis = listOf(
                                ReportKpiItem("Toplam Kayıt", filteredRecords.size.toString(), "Listelenen"),
                                ReportKpiItem("Zamanında & 30m İçi", onTimeCount.toString(), "Tam uyum"),
                                ReportKpiItem("Geç Giriş", lateCount.toString(), "Mesai sonrası"),
                                ReportKpiItem("30m Sınır Dışı", outsideCount.toString(), "Geofence ihlali")
                            ),
                            headers = listOf("Tarih", "Saat", "Personel Ad Soyad", "Şube", "İşlem", "Mesafe (30m)", "Durum", "Geç Gerekçesi"),
                            rows = filteredRecords.take(100).map { rec ->
                                val statusText = when {
                                    !rec.isWithin5Meters -> "Alan Dışı (30m+)"
                                    rec.lateMinutes > 0 -> "${rec.lateMinutes} dk Geç"
                                    rec.overtimeMinutes > 0 -> "+${rec.overtimeMinutes} dk Mesai"
                                    else -> "Zamanında"
                                }
                                val reasonText = if (rec.lateReasonCode.isBlank()) "—" else
                                    lateReasonLabel(rec.lateReasonCode) +
                                            (if (rec.lateReasonNote.isNotBlank()) " (${rec.lateReasonNote})" else "")
                                listOf(
                                    rec.formattedDate,
                                    rec.formattedTime,
                                    rec.employeeName,
                                    rec.branchName,
                                    rec.recordType,
                                    String.format(Locale.US, "%.1f m", rec.distanceMeters),
                                    statusText,
                                    reasonText
                                )
                            }
                        )
                    },
                    variant = MinimalButtonVariant.DARK,
                    height = 35.dp
                )
            }
        }

        // Üst Süre ve Özel Tarih Aralığı Filtresi
        item {
            MinimalPeriodAndDateFilterBar(
                selectedDays = selectedPeriodDays,
                customFromDate = customFromDate,
                customToDate = customToDate,
                onSelectDays = { selectedPeriodDays = it },
                onApplyCustomDates = { f, t ->
                    customFromDate = f
                    customToDate = t
                },
                onClearCustomDates = {
                    customFromDate = ""
                    customToDate = ""
                }
            )
        }

        // Arama, Filtre ve Sıralama Çubuğu
        item {
            Surface(
                shape = RoundedCornerShape(13.dp),
                color = CardSurface,
                border = BorderStroke(1.dp, LineHairline)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        placeholder = {
                            Text(
                                "Tarih, şube veya personel ara...",
                                fontSize = 12.sp,
                                color = InkFaint
                            )
                        },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = null,
                                tint = InkMuted,
                                modifier = Modifier.size(18.dp)
                            )
                        },
                        trailingIcon = {
                            if (searchQuery.isNotEmpty()) {
                                IconButton(onClick = { searchQuery = "" }) {
                                    Icon(
                                        imageVector = Icons.Default.Close,
                                        contentDescription = "Temizle",
                                        tint = InkMuted,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }
                        },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = InkPrimary,
                            unfocusedBorderColor = LineHairline,
                            focusedContainerColor = BgCanvas,
                            unfocusedContainerColor = BgCanvas
                        )
                    )

                    MinimalFilterChipRow(
                        items = listOf(
                            FilterChipItem("ALL", "Tümü", roleScopedRecords.size),
                            FilterChipItem("IN", "Giriş", roleScopedRecords.count { it.recordType == "GİRİŞ" }),
                            FilterChipItem("OUT", "Çıkış", roleScopedRecords.count { it.recordType == "ÇIKIŞ" }),
                            FilterChipItem("LATE", "Geç Giriş", lateCount),
                            FilterChipItem("OUTSIDE", "30m Alan Dışı", outsideCount)
                        ),
                        selectedId = typeFilter,
                        onSelect = { typeFilter = it }
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "SIRALA:",
                            color = InkMuted,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.6.sp
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf(
                                "RECENT" to "En Yeni",
                                "DISTANCE" to "Mesafe ↑",
                                "LATE" to "Gecikme ↓"
                            ).forEach { (id, label) ->
                                val active = sortMode == id
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(7.dp))
                                        .background(if (active) InkPrimary else BgCanvas)
                                        .border(1.dp, if (active) InkPrimary else LineHairline, RoundedCornerShape(7.dp))
                                        .clickable { sortMode = id }
                                        .padding(horizontal = 9.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = label,
                                        color = if (active) Color.White else InkSecondary,
                                        fontSize = 11.sp,
                                        fontWeight = if (active) FontWeight.Bold else FontWeight.Medium
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        if (filteredRecords.isEmpty()) {
            item {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = CardSurface,
                    border = BorderStroke(1.dp, LineHairline),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(28.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Seçili filtreye uygun yoklama kaydı bulunamadı.",
                            color = InkMuted,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        } else {
            itemsIndexed(filteredRecords, key = { _, it -> it.id }) { idx, record ->
                AnimatedEntryBox(index = idx) {
                    MinimalRecordRowCard(
                        record = record,
                        isExpanded = expandedRecordId == record.id,
                        onToggle = {
                            expandedRecordId = if (expandedRecordId == record.id) null else record.id
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun MinimalRecordRowCard(
    record: AttendanceRecordEntity,
    isExpanded: Boolean,
    onToggle: () -> Unit
) {
    val isCheckIn = record.recordType == "GİRİŞ"
    val (badgeText, badgeTone, ringColor) = when {
        !record.isWithin5Meters -> Triple("Alan Dışı (30m+)", DeltaTone.BAD, StatusBad)
        record.lateMinutes > 0 -> Triple("${record.lateMinutes} dk Geç", DeltaTone.WARN, StatusWarn)
        record.overtimeMinutes > 0 -> Triple("+${record.overtimeMinutes} dk Mesai", DeltaTone.OK, StatusOk)
        else -> Triple("Zamanında", DeltaTone.OK, StatusOk)
    }

    Surface(
        shape = RoundedCornerShape(13.dp),
        color = CardSurface,
        border = BorderStroke(1.dp, LineHairline),
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize()
            .clickable { onToggle() }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(11.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    MonogramAvatarBadge(
                        fullName = record.employeeName,
                        ringColor = ringColor
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = record.employeeName,
                            color = InkPrimary,
                            fontSize = 14.5.sp,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = (-0.3).sp
                        )
                        Text(
                            text = "${record.branchName} · ${String.format(Locale.US, "%.1f m", record.distanceMeters)}",
                            color = InkMuted,
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
                MinimalStatusBadge(text = badgeText, tone = badgeTone)
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(9.dp))
                    .background(BgCanvas)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = record.formattedDate,
                    color = InkSecondary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "${record.recordType} ──●── ${record.formattedTime}",
                    color = if (isCheckIn) InkPrimary else AlbayrakRed,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = if (record.isWithin5Meters) "30m Uygun" else "Sınır Dışı",
                    color = if (record.isWithin5Meters) StatusOk else StatusBad,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
            }

            AnimatedVisibility(visible = isExpanded) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(5.dp)
                ) {
                    HorizontalDivider(color = LineHairline, thickness = 1.dp)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Cihaz: ${record.deviceModel}",
                            color = InkMuted,
                            fontSize = 10.5.sp,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            text = String.format(Locale.US, "GPS: %.4f, %.4f", record.userLatitude, record.userLongitude),
                            color = InkSecondary,
                            fontSize = 10.5.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                    if (record.lateReasonCode.isNotBlank()) {
                        Text(
                            text = "Geç Kalma Gerekçesi: " + lateReasonLabel(record.lateReasonCode) +
                                    (if (record.lateReasonNote.isNotBlank()) " — ${record.lateReasonNote}" else ""),
                            color = if (record.lateReasonCode == LATE_REASON_OTHER_CODE) InkSecondary else AlbayrakRed,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                    if (record.note.isNotBlank()) {
                        Text(
                            text = "Not: ${record.note}",
                            color = InkSecondary,
                            fontSize = 11.sp
                        )
                    }
                }
            }
        }
    }
}

/* ---- Geç giriş gerekçesi ---- */
private fun lateReasonLabel(code: String): String =
    LATE_REASON_TEMPLATES.firstOrNull { it.code == code }?.label ?: code

/* ---- Tarih aralığı yardımcıları (Kayıtlar ekranı) ---- */
private const val DAY_MS = 86_400_000L

private fun parseDmyToMillis(text: String): Long? {
    val s = text.trim()
    if (s.isBlank()) return null
    return runCatching {
        java.text.SimpleDateFormat("dd.MM.yyyy", java.util.Locale("tr", "TR"))
            .apply { isLenient = false }
            .parse(s)?.time
    }.getOrNull()
}

private fun startOfTodayMillis(): Long = java.util.Calendar.getInstance().apply {
    set(java.util.Calendar.HOUR_OF_DAY, 0)
    set(java.util.Calendar.MINUTE, 0)
    set(java.util.Calendar.SECOND, 0)
    set(java.util.Calendar.MILLISECOND, 0)
}.timeInMillis
