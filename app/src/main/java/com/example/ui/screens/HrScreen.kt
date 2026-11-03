package com.example.ui.screens

import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
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
import com.example.data.local.BranchEntity
import com.example.data.local.EmployeeEntity
import com.example.ui.MainViewModel
import com.example.ui.components.*
import com.example.ui.theme.*
import java.util.Locale

private data class HrLeaveItem(
    val id: String,
    val employeeName: String,
    val department: String,
    val leaveType: String,
    val dateRange: String,
    val reason: String,
    val status: String = "PENDING" // PENDING, APPROVED, REJECTED
)

private data class DeptAnalyticsRow(
    val name: String,
    val headcount: Int,
    val punctualityPct: Int,
    val avgCheckIn: String,
    val overtimeHours: String,
    val geofenceCompliancePct: Int
)

@Composable
fun HrScreen(viewModel: MainViewModel) {
    val context = LocalContext.current
    val allRecords by viewModel.records.collectAsState()
    val employees by viewModel.employees.collectAsState()
    val branches by viewModel.branches.collectAsState()

    var selectedSection by remember { mutableIntStateOf(0) } // 0: Canlı Yoklama, 1: İzin & Mazeret, 2: Analitik, 3: Personeller
    var selectedBranchFilter by remember { mutableStateOf("ALL") }
    var selectedStatusFilter by remember { mutableStateOf("ALL") }
    var searchQuery by remember { mutableStateOf("") }

    // Üst Süre ve Özel Tarih Aralığı Filtresi
    var selectedPeriodDays by remember { mutableIntStateOf(30) } // 1, 7, 30, 60
    var customFromDate by remember { mutableStateOf("") }
    var customToDate by remember { mutableStateOf("") }

    // Personel Sekmesi (Sekme 3) Özel Filtre & Sıralama Durumları
    var empSearchQuery by remember { mutableStateOf("") }
    var empDeptFilter by remember { mutableStateOf("ALL") }
    var empRoleFilter by remember { mutableStateOf("ALL") }
    var empSortBy by remember { mutableStateOf("NET") } // NET, OT, SCORE, NAME
    var expandedEmployeeId by remember { mutableStateOf<Long?>(null) }
    var expandedRecordId by remember { mutableStateOf<Long?>(null) }
    var deepModalEmployee by remember { mutableStateOf<EmployeeDeepAnalytics?>(null) }

    var showAddEmployeeModal by remember { mutableStateOf(false) }

    val leaveItems = remember {
        mutableStateListOf(
            HrLeaveItem(
                id = "IZ-204",
                employeeName = "Selin Demir",
                department = "Müşteri İlişkileri",
                leaveType = "Yıllık İzin (3 Gün)",
                dateRange = "24.10.2026 – 26.10.2026",
                reason = "Planlı yıllık izin kullanımı; görev devri Emre Çelik'e yapıldı."
            ),
            HrLeaveItem(
                id = "IZ-203",
                employeeName = "Mehmet Kaya",
                department = "Finans & Muhasebe",
                leaveType = "Mazeret İzni (1 Gün)",
                dateRange = "22.10.2026",
                reason = "Resmi tapu ve banka işlemleri nedeniyle tam gün mazeret izni."
            ),
            HrLeaveItem(
                id = "IZ-201",
                employeeName = "Ayşe Kara",
                department = "Kredi Tahsis",
                leaveType = "Sağlık Raporu (2 Gün)",
                dateRange = "18.10.2026 – 19.10.2026",
                reason = "Hastane poliklinik istirahat raporu sisteme yüklendi.",
                status = "APPROVED"
            )
        )
    }

    val checkInRecords = remember(allRecords) { allRecords.filter { it.recordType == "GİRİŞ" } }
    val lateCount = remember(checkInRecords) { checkInRecords.count { it.lateMinutes > 0 } }
    val onTimeCount = remember(checkInRecords, lateCount) { (checkInRecords.size - lateCount).coerceAtLeast(0) }
    val outOfAreaCount = remember(allRecords) { allRecords.count { !it.isWithin5Meters } }
    val punctualityPct = if (checkInRecords.isNotEmpty()) (onTimeCount * 100) / checkInRecords.size else 93
    val pendingLeavesCount = leaveItems.count { it.status == "PENDING" }

    val filteredRecords = remember(
        allRecords,
        selectedBranchFilter,
        selectedStatusFilter,
        searchQuery
    ) {
        allRecords.filter { rec ->
            val branchMatch = selectedBranchFilter == "ALL" ||
                    rec.branchName.contains(selectedBranchFilter, ignoreCase = true)
            val statusMatch = when (selectedStatusFilter) {
                "ON_TIME" -> rec.recordType == "GİRİŞ" && rec.lateMinutes == 0 && rec.isWithin5Meters
                "LATE" -> rec.lateMinutes > 0
                "OUT_OF_AREA" -> !rec.isWithin5Meters
                "OVERTIME" -> rec.overtimeMinutes > 0
                else -> true
            }
            val queryMatch = searchQuery.isBlank() ||
                    rec.employeeName.contains(searchQuery, ignoreCase = true) ||
                    rec.branchName.contains(searchQuery, ignoreCase = true) ||
                    rec.note.contains(searchQuery, ignoreCase = true)
            branchMatch && statusMatch && queryMatch
        }
    }

    // Her personel için seçili tarih/süre filtresine göre derin analiz ve net mesai bakiyesi hesapla
    val allEmployeeAnalytics = remember(
        employees,
        allRecords,
        selectedPeriodDays,
        customFromDate,
        customToDate
    ) {
        employees.map { emp ->
            computeEmployeeDeepAnalytics(
                emp = emp,
                allRecords = allRecords,
                periodDays = selectedPeriodDays,
                customFromDate = customFromDate,
                customToDate = customToDate
            )
        }
    }

    val analyticsByEmpId = remember(allEmployeeAnalytics) {
        allEmployeeAnalytics.associateBy { it.emp.id }
    }

    val activePeriodLabel = allEmployeeAnalytics.firstOrNull()?.periodLabel ?: "Son 30 İş Günü"

    fun computeEmployeeScore(emp: EmployeeEntity): Int {
        return analyticsByEmpId[emp.id]?.complianceScore ?: 93
    }

    val uniqueDepartments = remember(employees) {
        employees.map { it.department }.distinct().filter { it.isNotBlank() }
    }

    val filteredEmployees = remember(
        employees,
        allEmployeeAnalytics,
        empSearchQuery,
        empDeptFilter,
        empRoleFilter,
        empSortBy
    ) {
        val base = employees.filter { emp ->
            val qMatch = empSearchQuery.isBlank() ||
                    emp.fullName.contains(empSearchQuery, ignoreCase = true) ||
                    emp.employeeCode.contains(empSearchQuery, ignoreCase = true) ||
                    emp.department.contains(empSearchQuery, ignoreCase = true) ||
                    emp.title.contains(empSearchQuery, ignoreCase = true) ||
                    emp.email.contains(empSearchQuery, ignoreCase = true)
            val deptMatch = empDeptFilter == "ALL" || emp.department.equals(empDeptFilter, ignoreCase = true)
            val score = computeEmployeeScore(emp)
            val roleMatch = when (empRoleFilter) {
                "HIGH_SCORE" -> score >= 92
                "PERSONNEL" -> emp.role == "PERSONNEL"
                "HR" -> emp.role == "HR"
                "IT" -> emp.role == "IT"
                else -> true
            }
            qMatch && deptMatch && roleMatch
        }

        when (empSortBy) {
            "NET" -> base.sortedByDescending { analyticsByEmpId[it.id]?.netBalanceMin ?: 0 }
            "OT" -> base.sortedByDescending { analyticsByEmpId[it.id]?.totalOvertimeMin ?: 0 }
            "SCORE" -> base.sortedByDescending { computeEmployeeScore(it) }
            else -> base.sortedBy { it.fullName }
        }
    }

    fun exportLeaderboardExcelReport() {
        exportFormattedExcelReport(
            context = context,
            fileNamePrefix = "Albayrak_Mesai_ve_Net_Bakiye_Ligi",
            title = "Fazla Mesai & Net Süre Bakiyesi (Mesai − Gecikme) Lig Raporu",
            subtitle = "Dönem: $activePeriodLabel · ${allEmployeeAnalytics.size} Personel",
            kpis = listOf(
                ReportKpiItem(
                    "En Çok Mesai",
                    allEmployeeAnalytics.maxByOrNull { it.totalOvertimeMin }?.emp?.fullName ?: "—",
                    "+${formatDurationMinutes(allEmployeeAnalytics.maxOfOrNull { it.totalOvertimeMin } ?: 0)}"
                ),
                ReportKpiItem(
                    "Net Bakiye Lideri",
                    allEmployeeAnalytics.maxByOrNull { it.netBalanceMin }?.emp?.fullName ?: "—",
                    formatSignedMinutes(allEmployeeAnalytics.maxOfOrNull { it.netBalanceMin } ?: 0)
                ),
                ReportKpiItem(
                    "En Düşük Net",
                    allEmployeeAnalytics.minByOrNull { it.netBalanceMin }?.emp?.fullName ?: "—",
                    formatSignedMinutes(allEmployeeAnalytics.minOfOrNull { it.netBalanceMin } ?: 0)
                )
            ),
            headers = listOf("Sicil No", "Ad Soyad", "Departman", "Ek Mesai (dk)", "Gecikme (dk)", "Net Süre Bakiyesi", "En Çok Geç Günü", "En Çok Mesai Günü"),
            rows = allEmployeeAnalytics.sortedByDescending { it.netBalanceMin }.map { a ->
                listOf(
                    a.emp.employeeCode,
                    a.emp.fullName,
                    a.emp.department,
                    "+${a.totalOvertimeMin} dk",
                    "−${a.totalLateMin} dk",
                    formatSignedMinutes(a.netBalanceMin),
                    "${a.mostLateDay.dowName} (−${a.mostLateDay.totalLateMin} dk)",
                    "${a.mostOvertimeDay.dowName} (+${a.mostOvertimeDay.totalOvertimeMin} dk)"
                )
            }
        )
    }

    fun exportMainHrExcelReport() {
        exportFormattedExcelReport(
            context = context,
            fileNamePrefix = "Albayrak_Finans_IK_PDKS_Raporu",
            title = "İnsan Kaynakları Kurumsal Yoklama & Uyum Raporu",
            subtitle = "${employees.size} Personel · ${branches.size} Şube · 30m Geofence Denetimli",
            kpis = listOf(
                ReportKpiItem("Kurum Dakiklik", "%$punctualityPct", "$onTimeCount zamanında giriş"),
                ReportKpiItem("Geç Girişler", lateCount.toString(), "Mesai başlangıcı sonrası"),
                ReportKpiItem("30m Alan İhlali", outOfAreaCount.toString(), "Geofence sınırı dışı"),
                ReportKpiItem("Kayıtlı Personel", employees.size.toString(), "${branches.size} aktif şube")
            ),
            headers = listOf("Tarih", "Saat", "Personel Ad Soyad", "Şube", "İşlem", "Mesafe (30m)", "Durum"),
            rows = filteredRecords.take(120).map { rec ->
                val statusText = when {
                    !rec.isWithin5Meters -> "Alan Dışı (30m+)"
                    rec.lateMinutes > 0 -> "${rec.lateMinutes} dk Geç"
                    rec.overtimeMinutes > 0 -> "+${rec.overtimeMinutes} dk Mesai"
                    else -> "Zamanında"
                }
                listOf(
                    rec.formattedDate,
                    rec.formattedTime,
                    rec.employeeName,
                    rec.branchName,
                    rec.recordType,
                    String.format(Locale.US, "%.1f m", rec.distanceMeters),
                    statusText
                )
            }
        )
    }

    fun exportDirectoryExcelReport() {
        exportFormattedExcelReport(
            context = context,
            fileNamePrefix = "Albayrak_Finans_Personel_Rehberi",
            title = "Kurumsal Personel Sicil, Vardiya ve Uyum Matrisi",
            subtitle = "Filtrelenen ${filteredEmployees.size} personel kaydı",
            kpis = listOf(
                ReportKpiItem("Toplam Personel", filteredEmployees.size.toString(), "Aktif kadro"),
                ReportKpiItem("Ortalama Uyum", "%$punctualityPct", "30m Geofence & Vardiya"),
                ReportKpiItem("Birim Sayısı", uniqueDepartments.size.toString(), "Merkez & Şube")
            ),
            headers = listOf("Sicil No", "Ad Soyad", "Departman", "Ünvan", "Şube", "Rol", "Uyum Skoru", "E-Posta"),
            rows = filteredEmployees.map { emp ->
                val brName = branches.find { it.id == emp.branchId }?.name ?: "Genel Müdürlük (Topkapı)"
                val sc = computeEmployeeScore(emp)
                listOf(
                    emp.employeeCode,
                    emp.fullName,
                    emp.department,
                    emp.title,
                    brName,
                    emp.role,
                    "%$sc Zamanında",
                    emp.email
                )
            }
        )
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(BgCanvas),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. Üst Başlık & Animasyonlu Excel Rapor İndirme Butonu
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f).padding(end = 10.dp)) {
                    Text(
                        text = "İnsan Kaynakları Yönetim Portalı",
                        color = InkPrimary,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.35).sp
                    )
                    Text(
                        text = "${employees.size} personel · ${branches.size} şube · 30m konum doğrulama",
                        color = InkMuted,
                        fontSize = 12.sp
                    )
                }
                AnimatedDownloadButton(
                    label = "Excel Rapor",
                    onDownloadComplete = { exportMainHrExcelReport() },
                    variant = MinimalButtonVariant.DARK,
                    height = 36.dp
                )
            }
        }

        // 1B. Üst Süre (Bugün, 7g, 30g, 60g) ve Özel Tarih Aralığı Filtresi
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

        // 2. Dörtlü Kurumsal KPI Kartları
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    MinimalKpiCard(
                        label = "Kurum Dakiklik",
                        value = "%$punctualityPct",
                        subtext = "$onTimeCount zamanında giriş",
                        deltaText = "+2.4p",
                        deltaTone = DeltaTone.OK,
                        sparklinePoints = listOf(88f, 90f, 89f, 91f, 92f, punctualityPct.toFloat()),
                        accentColor = StatusOk,
                        modifier = Modifier.weight(1f)
                    )
                    MinimalKpiCard(
                        label = "Geç Girişler",
                        value = lateCount.toString(),
                        subtext = "Mesai saati sonrası",
                        deltaText = "-2 kişi",
                        deltaTone = DeltaTone.WARN,
                        sparklinePoints = listOf(14f, 12f, 15f, 11f, 9f, lateCount.toFloat()),
                        accentColor = StatusWarn,
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    MinimalKpiCard(
                        label = "Onay Bekleyen",
                        value = pendingLeavesCount.toString(),
                        subtext = "İzin & mazeret talebi",
                        deltaText = if (pendingLeavesCount > 0) "İncele" else "Güncel",
                        deltaTone = if (pendingLeavesCount > 0) DeltaTone.WARN else DeltaTone.OK,
                        modifier = Modifier.weight(1f)
                    )
                    MinimalKpiCard(
                        label = "30m Alan İhlali",
                        value = outOfAreaCount.toString(),
                        subtext = "Şube sınırı dışı kayıt",
                        deltaText = "30m Kuralı",
                        deltaTone = if (outOfAreaCount > 0) DeltaTone.BAD else DeltaTone.OK,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // 3. Kayan Alt Sekme Seçici
        item {
            MinimalSegmentedControl(
                items = listOf(
                    "Yoklama",
                    "İzinler ($pendingLeavesCount)",
                    "Analitik",
                    "Personel (${employees.size})"
                ),
                selectedIndex = selectedSection,
                onSelect = { selectedSection = it }
            )
        }

        when (selectedSection) {
            // =============================================================
            // SEKME 0: CANLI YOKLAMA KAYITLARI, FİLTRELEME & NET MESAİ LİGİ
            // =============================================================
            0 -> {
                item {
                    MinimalOvertimeAndNetLeaderboardsCard(
                        analyticsList = allEmployeeAnalytics,
                        periodLabel = activePeriodLabel,
                        onSelectEmployee = { deepModalEmployee = it },
                        onExportLeaderboardExcel = { exportLeaderboardExcelReport() }
                    )
                }

                item {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
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
                                        "Personel adı, şube veya açıklama ara...",
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
                                    FilterChipItem("ALL", "Tüm Şubeler", allRecords.size),
                                    FilterChipItem("Genel Müdürlük", "Genel Müdürlük"),
                                    FilterChipItem("Bursa", "Bursa"),
                                    FilterChipItem("Ankara", "Ankara"),
                                    FilterChipItem("İzmir", "İzmir"),
                                    FilterChipItem("Konya", "Konya"),
                                    FilterChipItem("Trabzon", "Trabzon")
                                ),
                                selectedId = selectedBranchFilter,
                                onSelect = { selectedBranchFilter = it }
                            )

                            MinimalFilterChipRow(
                                items = listOf(
                                    FilterChipItem("ALL", "Tüm Durumlar", allRecords.size),
                                    FilterChipItem("ON_TIME", "Zamanında", onTimeCount),
                                    FilterChipItem("LATE", "Geç Giriş", lateCount),
                                    FilterChipItem("OVERTIME", "Fazla Mesai", allRecords.count { it.overtimeMinutes > 0 }),
                                    FilterChipItem("OUT_OF_AREA", "30m Alan Dışı", outOfAreaCount)
                                ),
                                selectedId = selectedStatusFilter,
                                onSelect = { selectedStatusFilter = it }
                            )
                        }
                    }
                }

                itemsIndexed(filteredRecords.take(40), key = { _, it -> it.id }) { idx, record ->
                    AnimatedEntryBox(index = idx) {
                        HrRecordCard(
                            record = record,
                            isExpanded = expandedRecordId == record.id,
                            onToggleExpand = {
                                expandedRecordId = if (expandedRecordId == record.id) null else record.id
                            }
                        )
                    }
                }
            }

            // =============================================================
            // SEKME 1: İZİN VE MAZERET ONAY MERKEZİ
            // =============================================================
            1 -> {
                item {
                    MinimalSectionHeader(
                        title = "İzin ve Mazeret Onayları",
                        subtitle = "Personellerin oluşturduğu yıllık, mazeret ve rapor talepleri"
                    )
                }

                itemsIndexed(leaveItems, key = { _, it -> it.id }) { idx, item ->
                    AnimatedEntryBox(index = idx) {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = CardSurface,
                            border = BorderStroke(1.dp, LineHairline),
                            modifier = Modifier.fillMaxWidth()
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
                                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        MonogramAvatarBadge(
                                            fullName = item.employeeName,
                                            ringColor = when (item.status) {
                                                "APPROVED" -> StatusOk
                                                "REJECTED" -> StatusBad
                                                else -> StatusWarn
                                            }
                                        )
                                        Column {
                                            Text(
                                                text = item.employeeName,
                                                color = InkPrimary,
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                letterSpacing = (-0.3).sp
                                            )
                                            Text(
                                                text = "${item.department} · ${item.leaveType}",
                                                color = InkMuted,
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Medium
                                            )
                                        }
                                    }
                                    MinimalStatusBadge(
                                        text = when (item.status) {
                                            "APPROVED" -> "Onaylandı"
                                            "REJECTED" -> "Reddedildi"
                                            else -> "İK Onayı Bekliyor"
                                        },
                                        tone = when (item.status) {
                                            "APPROVED" -> DeltaTone.OK
                                            "REJECTED" -> DeltaTone.BAD
                                            else -> DeltaTone.WARN
                                        }
                                    )
                                }

                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(BgCanvas)
                                        .padding(horizontal = 10.dp, vertical = 7.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "Talep Kodu: #${item.id}",
                                        color = InkMuted,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                    Text(
                                        text = item.dateRange,
                                        color = InkPrimary,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold
                                    )
                                }

                                Text(
                                    text = item.reason,
                                    color = InkSecondary,
                                    fontSize = 12.sp
                                )

                                if (item.status == "PENDING") {
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        MinimalBasicButton(
                                            text = "Onayla",
                                            onClick = {
                                                val i = leaveItems.indexOfFirst { it.id == item.id }
                                                if (i != -1) {
                                                    leaveItems[i] = leaveItems[i].copy(status = "APPROVED")
                                                    Toast.makeText(context, "${item.employeeName} izni onaylandı.", Toast.LENGTH_SHORT).show()
                                                }
                                            },
                                            variant = MinimalButtonVariant.DARK,
                                            icon = Icons.Default.Check,
                                            height = 34.dp,
                                            modifier = Modifier.weight(1f)
                                        )
                                        MinimalBasicButton(
                                            text = "Reddet",
                                            onClick = {
                                                val i = leaveItems.indexOfFirst { it.id == item.id }
                                                if (i != -1) {
                                                    leaveItems[i] = leaveItems[i].copy(status = "REJECTED")
                                                    Toast.makeText(context, "${item.employeeName} izni reddedildi.", Toast.LENGTH_SHORT).show()
                                                }
                                            },
                                            variant = MinimalButtonVariant.OUTLINE,
                                            icon = Icons.Default.Close,
                                            height = 34.dp,
                                            modifier = Modifier.weight(1f)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // =============================================================
            // SEKME 2: DERİNLEŞTİRİLMİŞ İK & ŞUBE ANALİTİĞİ
            // =============================================================
            2 -> {
                val deptMatrix = listOf(
                    DeptAnalyticsRow("Finans & Muhasebe", 38, 96, "08:23", "46.5 sa", 99),
                    DeptAnalyticsRow("Bilgi Teknolojileri", 22, 95, "08:26", "38.0 sa", 100),
                    DeptAnalyticsRow("Kredi Tahsis", 29, 93, "08:28", "31.5 sa", 98),
                    DeptAnalyticsRow("Müşteri İlişkileri", 34, 91, "08:31", "24.0 sa", 97),
                    DeptAnalyticsRow("Şube Operasyon", 25, 89, "08:34", "42.0 sa", 95)
                )

                // En Çok Mesai Yapanlar & Net Süre Bakiyesi (Ek Mesai − Gecikme) En İyiler / En Kötüler
                item {
                    MinimalOvertimeAndNetLeaderboardsCard(
                        analyticsList = allEmployeeAnalytics,
                        periodLabel = activePeriodLabel,
                        onSelectEmployee = { deepModalEmployee = it },
                        onExportLeaderboardExcel = { exportLeaderboardExcelReport() }
                    )
                }

                item {
                    AnimatedEntryBox(index = 0) {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = CardSurface,
                            border = BorderStroke(1.dp, LineHairline)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = "Kurumsal yoklama dağılımı",
                                            color = InkPrimary,
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = "Zamanında giriş, gecikme ve 30m geofence uyum kırılımı",
                                            color = InkMuted,
                                            fontSize = 11.sp
                                        )
                                    }
                                    AnimatedDownloadButton(
                                        label = "Analitik XLSX",
                                        onDownloadComplete = {
                                            exportFormattedExcelReport(
                                                context = context,
                                                fileNamePrefix = "Albayrak_IK_Analitik_Matrisi",
                                                title = "Departman Performans, Fazla Mesai ve 30m Uyum Analitiği",
                                                subtitle = "Kurumsal İK Analitik Özeti",
                                                kpis = listOf(
                                                    ReportKpiItem("Kurum Dakiklik", "%$punctualityPct", "Hedef %95"),
                                                    ReportKpiItem("Toplam Fazla Mesai", "182.0 sa", "Bu ay onaylı"),
                                                    ReportKpiItem("30m Geofence Uyum", "%98.4", "6 şube ortalaması")
                                                ),
                                                headers = listOf("Departman", "Personel", "Dakiklik Oranı", "Ort. Giriş", "Fazla Mesai", "30m Konum Uyumu"),
                                                rows = deptMatrix.map { d ->
                                                    listOf(
                                                        d.name,
                                                        d.headcount.toString(),
                                                        "%${d.punctualityPct} Zamanında",
                                                        d.avgCheckIn,
                                                        d.overtimeHours,
                                                        "%${d.geofenceCompliancePct} Uygun"
                                                    )
                                                }
                                            )
                                        },
                                        variant = MinimalButtonVariant.OUTLINE,
                                        height = 32.dp
                                    )
                                }
                                MinimalDonutChart(
                                    slices = listOf(
                                        DonutSlice("Zamanında Giriş", onTimeCount.coerceAtLeast(18), StatusOk),
                                        DonutSlice("Geç Giriş", lateCount.coerceAtLeast(3), StatusWarn),
                                        DonutSlice("30m Alan Dışı", outOfAreaCount.coerceAtLeast(1), StatusBad)
                                    ),
                                    centerValue = "%$punctualityPct",
                                    centerLabel = "Dakiklik"
                                )
                            }
                        }
                    }
                }

                item {
                    AnimatedEntryBox(index = 1) {
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
                                    title = "Saatlik giriş ve çıkış yoğunluğu",
                                    subtitle = "Kırmızı: Giriş akışı · Antrasit: Çıkış akışı"
                                )
                                MinimalAreaChart(
                                    labels = listOf("07:30", "08:30", "09:30", "12:30", "15:30", "17:30", "18:30"),
                                    primarySeries = listOf(14f, 68f, 22f, 8f, 6f, 54f, 38f),
                                    secondarySeries = listOf(2f, 8f, 14f, 18f, 12f, 48f, 62f),
                                    primaryColor = AlbayrakRed,
                                    secondaryColor = InkPrimary
                                )
                            }
                        }
                    }
                }

                // YENİ: Gecikme Kök Neden Analizi
                item {
                    AnimatedEntryBox(index = 2) {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = CardSurface,
                            border = BorderStroke(1.dp, LineHairline)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                MinimalSectionHeader(
                                    title = "Gecikme kök neden analizi",
                                    subtitle = "08:40 tolerans saati sonrası gecikmelerin dağılımı"
                                )
                                MinimalDonutChart(
                                    slices = listOf(
                                        DonutSlice("Trafik & Ulaşım Yoğunluğu", 11, StatusWarn),
                                        DonutSlice("Saha / Müşteri Ziyareti", 6, InkPrimary),
                                        DonutSlice("Sağlık & İzinli Geç Giriş", 4, StatusOk),
                                        DonutSlice("30m GPS Sapması / Diğer", 2, AlbayrakRed)
                                    ),
                                    centerValue = "14 dk",
                                    centerLabel = "Ort. Gecikme"
                                )
                            }
                        }
                    }
                }

                // YENİ: Departman Performans, Fazla Mesai ve Uyum Matrisi
                item {
                    AnimatedEntryBox(index = 3) {
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
                                    title = "Departman performans ve mesai matrisi",
                                    subtitle = "Birim bazlı ortalama giriş saati, fazla mesai ve 30m uyumu"
                                )

                                deptMatrix.forEachIndexed { idx, dept ->
                                    if (idx > 0) {
                                        HorizontalDivider(color = LineHairline, thickness = 1.dp)
                                    }
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 4.dp),
                                        verticalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = "${dept.name} (${dept.headcount})",
                                                color = InkPrimary,
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                            MinimalStatusBadge(
                                                text = "%${dept.punctualityPct} Dakiklik",
                                                tone = if (dept.punctualityPct >= 92) DeltaTone.OK else DeltaTone.WARN
                                            )
                                        }
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(8.dp))
                                                .background(BgCanvas)
                                                .padding(horizontal = 10.dp, vertical = 6.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(
                                                text = "Ort. Giriş: ${dept.avgCheckIn}",
                                                color = InkSecondary,
                                                fontSize = 11.sp,
                                                fontFamily = FontFamily.Monospace
                                            )
                                            Text(
                                                text = "Mesai: ${dept.overtimeHours}",
                                                color = InkPrimary,
                                                fontSize = 11.sp,
                                                fontFamily = FontFamily.Monospace,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                            Text(
                                                text = "30m: %${dept.geofenceCompliancePct}",
                                                color = StatusOk,
                                                fontSize = 11.sp,
                                                fontFamily = FontFamily.Monospace,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                item {
                    AnimatedEntryBox(index = 4) {
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
                                    title = "Şube bazlı dakiklik sıralaması",
                                    subtitle = "30m geofence içinde zamanında giriş başarısı"
                                )
                                MinimalHorizontalBarRow("Genel Müdürlük (Topkapı)", "%95", 0.95f, StatusOk, "Merkez")
                                MinimalHorizontalBarRow("Ankara Çankaya Şubesi", "%93", 0.93f, StatusOk, "İç Anadolu")
                                MinimalHorizontalBarRow("Bursa Osmangazi Şubesi", "%91", 0.91f, InkPrimary, "Marmara")
                                MinimalHorizontalBarRow("Konya Selçuklu Şubesi", "%89", 0.89f, InkPrimary, "İç Anadolu")
                                MinimalHorizontalBarRow("İzmir Konak Şubesi", "%86", 0.86f, StatusWarn, "Ege")
                                MinimalHorizontalBarRow("Trabzon Ortahisar Şubesi", "%84", 0.84f, StatusWarn, "Karadeniz")
                            }
                        }
                    }
                }
            }

            // =============================================================
            // SEKME 3: YENİLENMİŞ ŞIK PERSONEL REHBERİ, FİLTRELEME & KARNE
            // =============================================================
            3 -> {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        MinimalSectionHeader(
                            title = "Kurumsal Personel Dizini (${filteredEmployees.size}/${employees.size})",
                            subtitle = "Kartlara dokunarak vardiya ve uyum karnesini açın",
                            modifier = Modifier.weight(1f).padding(end = 8.dp)
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            AnimatedDownloadButton(
                                label = "Rehber XLSX",
                                onDownloadComplete = { exportDirectoryExcelReport() },
                                variant = MinimalButtonVariant.OUTLINE,
                                height = 34.dp
                            )
                            MinimalBasicButton(
                                text = "Ekle",
                                onClick = { showAddEmployeeModal = true },
                                variant = MinimalButtonVariant.DARK,
                                icon = Icons.Default.PersonAdd,
                                height = 34.dp
                            )
                        }
                    }
                }

                // Gelişmiş ve Kolay Personel Filtreleme & Sıralama Paneli
                item {
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = CardSurface,
                        border = BorderStroke(1.dp, LineHairline)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(13.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedTextField(
                                value = empSearchQuery,
                                onValueChange = { empSearchQuery = it },
                                placeholder = {
                                    Text(
                                        "Ad soyad, sicil (FN-1001), departman veya ünvan ara...",
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
                                    if (empSearchQuery.isNotEmpty()) {
                                        IconButton(onClick = { empSearchQuery = "" }) {
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

                            // 1. Departman Filtresi
                            MinimalFilterChipRow(
                                items = buildList {
                                    add(FilterChipItem("ALL", "Tüm Birimler", employees.size))
                                    uniqueDepartments.forEach { deptName ->
                                        add(
                                            FilterChipItem(
                                                id = deptName,
                                                label = deptName,
                                                count = employees.count { it.department.equals(deptName, ignoreCase = true) }
                                            )
                                        )
                                    }
                                },
                                selectedId = empDeptFilter,
                                onSelect = { empDeptFilter = it }
                            )

                            // 2. Rol & Uyum Filtresi
                            MinimalFilterChipRow(
                                items = listOf(
                                    FilterChipItem("ALL", "Tüm Roller", employees.size),
                                    FilterChipItem("HIGH_SCORE", "Yüksek Uyum (%92+)", employees.count { computeEmployeeScore(it) >= 92 }),
                                    FilterChipItem("PERSONNEL", "Personel", employees.count { it.role == "PERSONNEL" }),
                                    FilterChipItem("HR", "İK Yetkilisi", employees.count { it.role == "HR" }),
                                    FilterChipItem("IT", "BT Uzmanı", employees.count { it.role == "IT" })
                                ),
                                selectedId = empRoleFilter,
                                onSelect = { empRoleFilter = it }
                            )

                            HorizontalDivider(color = LineHairline, thickness = 1.dp)

                            // 3. Hızlı Sıralama Çubuğu
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(5.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Sort,
                                        contentDescription = null,
                                        tint = InkMuted,
                                        modifier = Modifier.size(15.dp)
                                    )
                                    Text(
                                        text = "SIRALA:",
                                        color = InkMuted,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        letterSpacing = 0.6.sp
                                    )
                                }

                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    listOf(
                                        "NET" to "Net Bakiye ↓",
                                        "OT" to "Ek Mesai ↓",
                                        "SCORE" to "Uyum ↓",
                                        "NAME" to "Ad (A-Z)"
                                    ).forEach { (sortId, sortLabel) ->
                                        val active = empSortBy == sortId
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(7.dp))
                                                .background(if (active) InkPrimary else BgCanvas)
                                                .border(
                                                    1.dp,
                                                    if (active) InkPrimary else LineHairline,
                                                    RoundedCornerShape(7.dp)
                                                )
                                                .clickable { empSortBy = sortId }
                                                .padding(horizontal = 9.dp, vertical = 4.dp)
                                        ) {
                                            Text(
                                                text = sortLabel,
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

                if (filteredEmployees.isEmpty()) {
                    item {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = CardSurface,
                            border = BorderStroke(1.dp, LineHairline),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(28.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = "Arama veya filtre kriterlerine uygun personel bulunamadı.",
                                    color = InkMuted,
                                    fontSize = 13.sp
                                )
                                MinimalBasicButton(
                                    text = "Filtreleri Temizle",
                                    onClick = {
                                        empSearchQuery = ""
                                        empDeptFilter = "ALL"
                                        empRoleFilter = "ALL"
                                    },
                                    variant = MinimalButtonVariant.OUTLINE,
                                    height = 32.dp
                                )
                            }
                        }
                    }
                } else {
                    itemsIndexed(filteredEmployees, key = { _, it -> it.id }) { idx, emp ->
                        val deepAn = analyticsByEmpId[emp.id] ?: computeEmployeeDeepAnalytics(
                            emp = emp,
                            allRecords = allRecords,
                            periodDays = selectedPeriodDays,
                            customFromDate = customFromDate,
                            customToDate = customToDate
                        )
                        val branchObj = branches.find { it.id == emp.branchId }

                        AnimatedEntryBox(index = idx) {
                            HrEmployeeExecutiveCard(
                                emp = emp,
                                branch = branchObj,
                                deepAnalytics = deepAn,
                                isExpanded = expandedEmployeeId == emp.id,
                                onToggleExpand = {
                                    expandedEmployeeId = if (expandedEmployeeId == emp.id) null else emp.id
                                },
                                onExportSingleEmployee = {
                                    exportEmployeeDeepExcelReport(context, deepAn)
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showAddEmployeeModal) {
        var fullName by remember { mutableStateOf("") }
        var empCode by remember { mutableStateOf("FN-${(1050..1999).random()}") }
        var dept by remember { mutableStateOf("Finans & Muhasebe") }
        var title by remember { mutableStateOf("Uzman") }

        AlertDialog(
            onDismissRequest = { showAddEmployeeModal = false },
            containerColor = CardSurface,
            shape = RoundedCornerShape(16.dp),
            title = {
                Text(
                    text = "Yeni Personel Kaydı",
                    color = InkPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = fullName,
                        onValueChange = { fullName = it },
                        label = { Text("Ad Soyad", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )
                    OutlinedTextField(
                        value = empCode,
                        onValueChange = { empCode = it },
                        label = { Text("Sicil Kodu", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )
                    OutlinedTextField(
                        value = dept,
                        onValueChange = { dept = it },
                        label = { Text("Departman", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )
                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it },
                        label = { Text("Ünvan", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )
                }
            },
            confirmButton = {
                MinimalBasicButton(
                    text = "Kaydet",
                    enabled = fullName.isNotBlank() && empCode.isNotBlank(),
                    onClick = {
                        viewModel.saveOrUpdateEmployee(
                            employeeCode = empCode,
                            password = "123456",
                            branchId = branches.firstOrNull()?.id ?: 1L,
                            fullName = fullName,
                            department = dept,
                            title = title
                        )
                        showAddEmployeeModal = false
                        Toast.makeText(context, "$fullName sisteme eklendi.", Toast.LENGTH_SHORT).show()
                    },
                    variant = MinimalButtonVariant.DARK
                )
            },
            dismissButton = {
                MinimalBasicButton(
                    text = "Vazgeç",
                    onClick = { showAddEmployeeModal = false },
                    variant = MinimalButtonVariant.OUTLINE
                )
            }
        )
    }

    // Lig listesinden bir personele tıklandığında açılan Derin Profil Analiz Penceresi
    deepModalEmployee?.let { modalAn ->
        AlertDialog(
            onDismissRequest = { deepModalEmployee = null },
            containerColor = BgCanvas,
            shape = RoundedCornerShape(16.dp),
            title = {
                Text(
                    text = "${modalAn.emp.fullName} · Derin Analiz",
                    color = InkPrimary,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.ExtraBold
                )
            },
            text = {
                EmployeeDeepProfileAnalysisCard(
                    analytics = modalAn,
                    onExportPersonalDeepExcel = {
                        exportEmployeeDeepExcelReport(context, modalAn)
                    }
                )
            },
            confirmButton = {
                MinimalBasicButton(
                    text = "Kapat",
                    onClick = { deepModalEmployee = null },
                    variant = MinimalButtonVariant.DARK
                )
            }
        )
    }
}

// =========================================================================
// YARDIMCI BİLEŞEN: MONOGRAM AVATAR ROZETİ (Çift Halkalı & Canlı Durum Noktalı)
// =========================================================================
@Composable
fun MonogramAvatarBadge(
    fullName: String,
    ringColor: Color = StatusOk,
    modifier: Modifier = Modifier
) {
    val initials = remember(fullName) {
        val parts = fullName.trim().split("\\s+".toRegex()).filter { it.isNotEmpty() }
        when {
            parts.size >= 2 -> "${parts.first().first()}${parts.last().first()}".uppercase()
            parts.size == 1 -> parts.first().take(2).uppercase()
            else -> "AF"
        }
    }

    Box(modifier = modifier.size(44.dp)) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clip(RoundedCornerShape(13.dp))
                .background(ringColor.copy(alpha = 0.10f))
                .border(1.4.dp, ringColor.copy(alpha = 0.35f), RoundedCornerShape(13.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = initials,
                color = InkPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.4).sp
            )
        }
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .offset(x = 2.dp, y = 2.dp)
                .size(11.dp)
                .clip(CircleShape)
                .background(CardSurface)
                .padding(2.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(CircleShape)
                    .background(ringColor)
            )
        }
    }
}

// =========================================================================
// YENİLENMİŞ KURUMSAL PERSONEL KARTI (Şık Tipografi, Net Bakiye & Derin Analiz)
// =========================================================================
@Composable
private fun HrEmployeeExecutiveCard(
    emp: EmployeeEntity,
    branch: BranchEntity?,
    deepAnalytics: EmployeeDeepAnalytics,
    isExpanded: Boolean,
    onToggleExpand: () -> Unit,
    onExportSingleEmployee: () -> Unit
) {
    val complianceScore = deepAnalytics.complianceScore
    val lastCheckIn = deepAnalytics.avgCheckIn
    val lastCheckOut = deepAnalytics.avgCheckOut

    val scoreColor = when {
        complianceScore >= 92 -> StatusOk
        complianceScore >= 85 -> StatusWarn
        else -> AlbayrakRed
    }

    val animBar by animateFloatAsState(
        targetValue = (complianceScore / 100f).coerceIn(0f, 1f),
        animationSpec = tween(600, easing = FastOutSlowInEasing),
        label = "emp_score_bar"
    )

    Surface(
        shape = RoundedCornerShape(14.dp),
        color = CardSurface,
        border = BorderStroke(
            width = if (isExpanded) 1.4.dp else 1.dp,
            color = if (isExpanded) InkPrimary.copy(alpha = 0.35f) else LineHairline
        ),
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize()
            .clickable { onToggleExpand() }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(11.dp)
        ) {
            // Üst Satır: Monogram Avatar + Tipografik Başlıklar + Net Mesai Bakiyesi Rozeti
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    MonogramAvatarBadge(
                        fullName = emp.fullName,
                        ringColor = scoreColor
                    )

                    Column(
                        verticalArrangement = Arrangement.spacedBy(3.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(7.dp)
                        ) {
                            Text(
                                text = emp.fullName,
                                color = InkPrimary,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = (-0.35).sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(SubtleSurface)
                                    .border(1.dp, LineHairline, RoundedCornerShape(6.dp))
                                    .padding(horizontal = 6.dp, vertical = 1.5.dp)
                            ) {
                                Text(
                                    text = emp.employeeCode,
                                    color = InkSecondary,
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        Text(
                            text = "${emp.title}  •  ${emp.department}",
                            color = InkMuted,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                MinimalStatusBadge(
                    text = "Net: ${formatSignedMinutes(deepAnalytics.netBalanceMin)}",
                    tone = if (deepAnalytics.netBalanceMin >= 0) DeltaTone.OK else DeltaTone.BAD
                )
            }

            // Orta Şerit: Ort. Giriş-Çıkış, En Çok Geç/Mesai Günü ve Uyum Skoru
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(BgCanvas)
                    .border(1.dp, LineHairline.copy(alpha = 0.7f), RoundedCornerShape(10.dp))
                    .padding(horizontal = 12.dp, vertical = 9.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = "$lastCheckIn ──●── $lastCheckOut",
                        color = InkPrimary,
                        fontSize = 11.5.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "En Geç: ${deepAnalytics.mostLateDay.dowShort} (−${deepAnalytics.mostLateDay.totalLateMin} dk) · En Mesai: ${deepAnalytics.mostOvertimeDay.dowShort} (+${deepAnalytics.mostOvertimeDay.totalOvertimeMin} dk)",
                        color = InkMuted,
                        fontSize = 10.sp
                    )
                }

                Column(horizontalAlignment = Alignment.End) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = "UYUM",
                            color = InkMuted,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.5.sp
                        )
                        Text(
                            text = "%$complianceScore",
                            color = scoreColor,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Box(
                        modifier = Modifier
                            .width(80.dp)
                            .height(5.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(SubtleSurface)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(animBar)
                                .fillMaxHeight()
                                .clip(RoundedCornerShape(999.dp))
                                .background(scoreColor)
                        )
                    }
                }
            }

            // Tıklandığında Açılan Derin Personel Profil Analizi (En Çok Hangi Gün Geç/Mesai, Net Terazi, Haftalık Tablo)
            AnimatedVisibility(
                visible = isExpanded,
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    HorizontalDivider(color = LineHairline, thickness = 1.dp)

                    EmployeeDeepProfileAnalysisCard(
                        analytics = deepAnalytics,
                        onExportPersonalDeepExcel = onExportSingleEmployee
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "E-Posta: ${emp.email} · Tel: ${emp.phone}",
                            color = InkMuted,
                            fontSize = 10.5.sp,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            text = branch?.name ?: "Genel Müdürlük",
                            color = InkPrimary,
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }
    }
}

// =========================================================================
// YENİLENMİŞ CANLI YOKLAMA KAYDI KARTI (Şık Tipografi & Açılır Detay)
// =========================================================================
@Composable
private fun HrRecordCard(
    record: AttendanceRecordEntity,
    isExpanded: Boolean,
    onToggleExpand: () -> Unit
) {
    val (statusLabel, tone, ringColor) = when {
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
            .clickable { onToggleExpand() }
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
                            text = record.branchName,
                            color = InkMuted,
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
                MinimalStatusBadge(text = statusLabel, tone = tone)
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
                    color = if (record.recordType == "GİRİŞ") InkPrimary else AlbayrakRed,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = String.format(Locale.US, "%.1f m", record.distanceMeters),
                    color = if (record.isWithin5Meters) StatusOk else StatusBad,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
            }

            AnimatedVisibility(visible = isExpanded) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    HorizontalDivider(color = LineHairline, thickness = 1.dp)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Cihaz: ${record.deviceModel} · IP: ${record.ipAddress}",
                            color = InkMuted,
                            fontSize = 10.5.sp,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            text = "Doğrulama: 30m Geofence",
                            color = StatusOk,
                            fontSize = 10.5.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.SemiBold
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
