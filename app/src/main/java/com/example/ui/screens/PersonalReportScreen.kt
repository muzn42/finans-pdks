package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.local.EmployeeEntity
import com.example.data.local.UserRole
import com.example.ui.MainViewModel
import com.example.ui.components.*
import com.example.ui.theme.*
import java.util.Locale

@Composable
fun PersonalReportScreen(viewModel: MainViewModel) {
    val context = LocalContext.current
    val currentRole by viewModel.currentRole.collectAsState()
    val selectedEmployee by viewModel.selectedEmployee.collectAsState()
    val employees by viewModel.employees.collectAsState()
    val allRecords by viewModel.records.collectAsState()

    // Üst Süre ve Özel Tarih Aralığı Filtresi
    var selectedPeriodDays by remember { mutableIntStateOf(30) } // 1, 7, 30, 60
    var customFromDate by remember { mutableStateOf("") }
    var customToDate by remember { mutableStateOf("") }
    var modalDeepEmployee by remember { mutableStateOf<EmployeeDeepAnalytics?>(null) }

    val activeEmp = remember(selectedEmployee, employees) {
        selectedEmployee ?: employees.firstOrNull() ?: EmployeeEntity(
            id = 1L,
            employeeCode = "FN-1001",
            password = "",
            branchId = 1L,
            fullName = "Ahmet Yılmaz",
            department = "Finans & Muhasebe",
            title = "Kıdemli Uzman",
            role = "PERSONNEL",
            email = "ahmet.yilmaz@albayrakfinans.com.tr",
            phone = "0532 100 10 01",
            deviceId = "FN-DEV-9842"
        )
    }

    val myDeepAnalytics = remember(
        activeEmp,
        allRecords,
        selectedPeriodDays,
        customFromDate,
        customToDate
    ) {
        computeEmployeeDeepAnalytics(
            emp = activeEmp,
            allRecords = allRecords,
            periodDays = selectedPeriodDays,
            customFromDate = customFromDate,
            customToDate = customToDate
        )
    }

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

    val punctualityPct = myDeepAnalytics.complianceScore
    val geofenceRate = myDeepAnalytics.geofencePct
    val trendSeries = remember(myDeepAnalytics) {
        val last7 = myDeepAnalytics.dailyLogs.takeLast(7).map { it.workHours }
        if (last7.size >= 3) last7 else listOf(8.6f, 8.9f, 9.1f, 8.5f, 9.0f, 8.8f, 9.2f)
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(BgCanvas),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f).padding(end = 10.dp)) {
                    Text(
                        text = "Performans, Mesai & Net Bakiye Analizi",
                        color = InkPrimary,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.3).sp
                    )
                    Text(
                        text = "${activeEmp.fullName} · ${activeEmp.department} · ${myDeepAnalytics.periodLabel}",
                        color = InkMuted,
                        fontSize = 12.sp
                    )
                }

                AnimatedDownloadButton(
                    label = "Analiz XLSX",
                    onDownloadComplete = {
                        exportEmployeeDeepExcelReport(context, myDeepAnalytics)
                    },
                    variant = MinimalButtonVariant.DARK,
                    height = 35.dp
                )
            }
        }

        // 1. Üst Süre (Bugün, 7g, 30g, 60g) ve Özel Tarih Seçici Filtre
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

        // 2. Dörtlü Minimalist KPI Grid (Dakiklik, Net Bakiye, Ek Mesai, Gecikme)
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    MinimalKpiCard(
                        label = "Net Mesai Bakiyesi",
                        value = formatSignedMinutes(myDeepAnalytics.netBalanceMin),
                        subtext = "Ek mesai − gecikme",
                        deltaText = if (myDeepAnalytics.netBalanceMin >= 0) "Pozitif" else "Eksi",
                        deltaTone = if (myDeepAnalytics.netBalanceMin >= 0) DeltaTone.OK else DeltaTone.BAD,
                        sparklinePoints = trendSeries,
                        accentColor = if (myDeepAnalytics.netBalanceMin >= 0) StatusOk else StatusBad,
                        modifier = Modifier.weight(1f)
                    )
                    MinimalKpiCard(
                        label = "En Çok Mesai Günü",
                        value = myDeepAnalytics.mostOvertimeDay.dowName,
                        subtext = "+${formatDurationMinutes(myDeepAnalytics.totalOvertimeMin)} toplam",
                        deltaText = "${myDeepAnalytics.overtimeDays} gün",
                        deltaTone = DeltaTone.OK,
                        accentColor = StatusOk,
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    MinimalKpiCard(
                        label = "En Çok Geç Kalınan",
                        value = if (myDeepAnalytics.mostLateDay.totalLateMin > 0) myDeepAnalytics.mostLateDay.dowName else "Yok",
                        subtext = "−${formatDurationMinutes(myDeepAnalytics.totalLateMin)} toplam gecikme",
                        deltaText = "${myDeepAnalytics.lateDays} kez",
                        deltaTone = if (myDeepAnalytics.totalLateMin > 0) DeltaTone.WARN else DeltaTone.OK,
                        modifier = Modifier.weight(1f)
                    )
                    MinimalKpiCard(
                        label = "Dakiklik & 30m Uyum",
                        value = "%$punctualityPct",
                        subtext = "30m Geofence: %$geofenceRate",
                        deltaText = "30m Aktif",
                        deltaTone = DeltaTone.OK,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // 3. Derin Personel Profil Analizi (Net Süre Terazisi, En Çok Geç/Mesai Günü, Pzt-Cum Kırılımı)
        item {
            AnimatedEntryBox(index = 0) {
                EmployeeDeepProfileAnalysisCard(
                    analytics = myDeepAnalytics,
                    onExportPersonalDeepExcel = {
                        exportEmployeeDeepExcelReport(context, myDeepAnalytics)
                    }
                )
            }
        }

        // 4. Kurumsal Ek Mesai & Net Süre Bakiyesi (Ek Mesai − Gecikme) Ligi
        if (allEmployeeAnalytics.isNotEmpty()) {
            item {
                AnimatedEntryBox(index = 1) {
                    MinimalOvertimeAndNetLeaderboardsCard(
                        analyticsList = allEmployeeAnalytics,
                        periodLabel = myDeepAnalytics.periodLabel,
                        onSelectEmployee = { modalDeepEmployee = it },
                        onExportLeaderboardExcel = {
                            exportFormattedExcelReport(
                                context = context,
                                fileNamePrefix = "Albayrak_Mesai_Net_Bakiye_Ligi",
                                title = "Ek Mesai & Net Süre Bakiyesi (Mesai − Gecikme) Lig Raporu",
                                subtitle = "Dönem: ${myDeepAnalytics.periodLabel}",
                                kpis = listOf(
                                    ReportKpiItem("Dönem", myDeepAnalytics.periodLabel, "${allEmployeeAnalytics.size} Personel")
                                ),
                                headers = listOf("Sicil No", "Ad Soyad", "Departman", "Ek Mesai", "Gecikme", "Net Bakiye", "En Çok Geç Günü", "En Çok Mesai Günü"),
                                rows = allEmployeeAnalytics.sortedByDescending { it.netBalanceMin }.map { a ->
                                    listOf(
                                        a.emp.employeeCode,
                                        a.emp.fullName,
                                        a.emp.department,
                                        "+${a.totalOvertimeMin} dk",
                                        "−${a.totalLateMin} dk",
                                        formatSignedMinutes(a.netBalanceMin),
                                        a.mostLateDay.dowName,
                                        a.mostOvertimeDay.dowName
                                    )
                                }
                            )
                        }
                    )
                }
            }
        }

        // 5. Günlük Mesai Süresi Trend Grafiği
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
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        MinimalSectionHeader(
                            title = "Mesai süresi istikrarı (Saat)",
                            subtitle = "Günlük çalışma saati eğilimi ve 8.5 saatlik referans çizgisi"
                        )
                        MinimalAreaChart(
                            labels = myDeepAnalytics.dailyLogs.takeLast(7).map { it.dowShort }.ifEmpty {
                                listOf("Pzt", "Sal", "Çar", "Per", "Cum", "Pzt", "Sal")
                            },
                            primarySeries = trendSeries,
                            secondarySeries = List(trendSeries.size) { 8.5f },
                            primaryColor = AlbayrakRed,
                            secondaryColor = InkMuted
                        )
                    }
                }
            }
        }

        // 6. Departman Kıyaslama Çubukları
        item {
            val deptName = activeEmp.department
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
                            title = "Birim ortalaması ile kıyaslama",
                            subtitle = "$deptName departmanı referans değerleri"
                        )
                        MinimalHorizontalBarRow(
                            label = "Kişisel Dakiklik Oranınız",
                            rightValueText = "%$punctualityPct",
                            fraction = punctualityPct / 100f,
                            barColor = StatusOk
                        )
                        MinimalHorizontalBarRow(
                            label = "$deptName Ortalaması",
                            rightValueText = "%91",
                            fraction = 0.91f,
                            barColor = InkPrimary
                        )
                        MinimalHorizontalBarRow(
                            label = "Şube (30m Geofence) Konum Doğrulaması",
                            rightValueText = "%$geofenceRate",
                            fraction = geofenceRate / 100f,
                            barColor = AlbayrakRed
                        )
                    }
                }
            }
        }
    }

    modalDeepEmployee?.let { modalAn ->
        AlertDialog(
            onDismissRequest = { modalDeepEmployee = null },
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
                    onClick = { modalDeepEmployee = null },
                    variant = MinimalButtonVariant.DARK
                )
            }
        )
    }
}
