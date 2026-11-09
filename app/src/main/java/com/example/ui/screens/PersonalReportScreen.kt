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
import com.example.ui.MainViewModel
import com.example.ui.components.*
import com.example.ui.theme.*

@Composable
fun PersonalReportScreen(viewModel: MainViewModel) {
    val context = LocalContext.current
    val selectedEmployee by viewModel.selectedEmployee.collectAsState()
    val employees by viewModel.employees.collectAsState()
    val allRecords by viewModel.records.collectAsState()

    // Üst Süre ve Özel Tarih Aralığı Filtresi
    var selectedPeriodDays by remember { mutableIntStateOf(30) } // 1, 7, 30, 60
    var customFromDate by remember { mutableStateOf("") }
    var customToDate by remember { mutableStateOf("") }

    val activeEmp = remember(selectedEmployee, employees) {
        selectedEmployee ?: employees.firstOrNull() ?: EmployeeEntity(
            id = 1L,
            employeeCode = "FN-1048",
            password = "",
            branchId = 1L,
            fullName = "Ahmet Yılmaz",
            department = "Tasarruf Finansman Satış & Portföy",
            title = "Kıdemli Tasarruf Danışmanı",
            role = "PERSONNEL",
            email = "ahmet.yilmaz@albayrakfinans.com.tr",
            phone = "+90 532 100 2030",
            deviceId = "SM-S928B-883A"
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
        item(key = "report_header") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f).padding(end = 10.dp)) {
                    Text(
                        text = "Kişisel Performans & Net Bakiye Analizi",
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
        item(key = "report_filter") {
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
        item(key = "report_kpis") {
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

        // 3. Derin Kişisel PDKS Analizi (Net Süre Terazisi, En Çok Geç/Mesai Günü, Pzt-Cum Kırılımı)
        item(key = "report_deep_card") {
            AnimatedEntryBox(index = 0) {
                EmployeeDeepProfileAnalysisCard(
                    analytics = myDeepAnalytics,
                    onExportPersonalDeepExcel = {
                        exportEmployeeDeepExcelReport(context, myDeepAnalytics)
                    }
                )
            }
        }

        // 4. Günlük Mesai Süresi Trend Grafiği
        item(key = "report_trend_chart") {
            AnimatedEntryBox(index = 1) {
                ZoomableCard(
                    title = "Mesai süresi istikrarı",
                    subtitle = "Büyütülmüş günlük trend ve 8.5 saat referans çizgisi",
                    showDialogHeader = false
                ) {
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
        }

        // 5. Departman Kıyaslama Çubukları
        item(key = "report_dept_comparison") {
            val deptName = activeEmp.department
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
}
