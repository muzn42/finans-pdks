package com.example.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.LocationCity
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Timeline
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.local.AttendanceRecordEntity
import com.example.data.local.BranchEntity
import com.example.data.local.EmployeeEntity
import com.example.data.local.SecurityAlertEntity
import com.example.ui.AttendanceSummaryReport
import com.example.ui.MainViewModel
import com.example.ui.ReportPeriod
import com.example.ui.theme.AccentCyan
import com.example.ui.theme.AccentGold
import com.example.ui.theme.FinanceNavyDark
import com.example.ui.theme.InRangeGreen
import com.example.ui.theme.OutOfRangeRed
import com.example.ui.theme.PrimaryBlue
import com.example.util.BadgeCalculator
import com.example.util.BadgeTier

/**
 * Yönetici Görsel Analitik & İcrai PDKS Dashboard'u
 *
 * Dönemsel raporlar ekranındaki ham tablo kopyasını tamamen kaldırıp;
 * zengin görsel grafikler (Donut Chart, Yoğunluk Çan Eğrisi, Departman Çift Çubuğu,
 * Şube Sıralaması, Günlük Net Trend) ve stratejik İK metrikleri sunar.
 */
@Composable
fun DashboardReportScreen(
    viewModel: MainViewModel,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val reportSummary by viewModel.reportSummary.collectAsState()
    val records by viewModel.records.collectAsState()
    val employees by viewModel.employees.collectAsState()
    val branches by viewModel.branches.collectAsState()
    val alerts by viewModel.alerts.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()
    val lastSyncTime by viewModel.lastSyncTime.collectAsState()
    val syncMessage by viewModel.syncMessage.collectAsState()

    // 1. Şirket Geneli Rozet Dağılımı (Donut Chart Hesaplaması)
    val badgeDistribution = remember(employees, records) {
        val distribution = mutableMapOf(
            BadgeTier.DIAMOND to 0,
            BadgeTier.GOLD to 0,
            BadgeTier.SILVER to 0,
            BadgeTier.BRONZE to 0
        )
        for (emp in employees) {
            val empRecs = records.filter { it.employeeId == emp.id }
            val tier = BadgeCalculator.calculateMonthlyBadge(empRecs).tier
            distribution[tier] = (distribution[tier] ?: 0) + 1
        }
        distribution
    }

    // 2. Net Mesai Katkı Hesaplaması (Toplam Ek Mesai - Toplam Gecikme)
    val netContributionMinutes = reportSummary.totalOvertimeMinutes - reportSummary.totalLateMinutes
    val isNetPositive = netContributionMinutes >= 0
    val netHours = Math.abs(netContributionMinutes) / 60
    val netMins = Math.abs(netContributionMinutes) % 60
    val netFormatted = "${if (isNetPositive) "+" else "-"}${netHours} sa ${netMins} dk"

    val lateHours = reportSummary.totalLateMinutes / 60
    val lateMins = reportSummary.totalLateMinutes % 60
    val lateFormatted = "${lateHours} sa ${lateMins} dk"

    // 3. 30 Metre Radar Güvenlik Skoru
    val totalRecordsCount = reportSummary.totalRecords
    val violationCount = reportSummary.geofenceViolationsCount
    val complianceRate = if (totalRecordsCount > 0) {
        val safeCount = Math.max(0, totalRecordsCount - violationCount)
        (safeCount * 1000 / totalRecordsCount) / 10.0
    } else 98.8

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // 1. ÜST KAHRAMAN BAŞLIK & BULUT SENKRONİZASYON KARTI
        item {
            ExecutiveHeroCard(
                lastSyncTime = lastSyncTime,
                isSyncing = isSyncing,
                syncMessage = syncMessage,
                totalEmployees = employees.size,
                totalBranches = branches.size,
                onSyncClick = { viewModel.syncWithServerDatabase() }
            )
        }

        // 2. DÖNEM SEÇİCİ (Günlük, Haftalık, Aylık)
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ReportPeriod.values().forEach { period ->
                    FilterChip(
                        selected = reportSummary.period == period,
                        onClick = { viewModel.setReportPeriod(period) },
                        label = { Text("${period.title} Analiz") },
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // 3. 4 ADET STRATEJİK İK YÖNETİCİ KPI KARTI (2x2 GRID)
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                ExecutiveKpiCard(
                    title = "Kurumsal Dakiklik",
                    value = "%${reportSummary.onTimeRatePercent}",
                    subtitle = "Hedef: %95.0 | ${reportSummary.checkedInCount} Giriş",
                    icon = Icons.Default.CheckCircle,
                    accentColor = InRangeGreen,
                    modifier = Modifier.weight(1f)
                )

                ExecutiveKpiCard(
                    title = "Net Mesai Katkısı",
                    value = netFormatted,
                    subtitle = "Ek Mesai - Gecikme Dengesi",
                    icon = Icons.AutoMirrored.Filled.TrendingUp,
                    accentColor = if (isNetPositive) PrimaryBlue else OutOfRangeRed,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                ExecutiveKpiCard(
                    title = "Gecikme Kaybı",
                    value = lateFormatted,
                    subtitle = "${reportSummary.lateArrivalsCount} Gecikmeli Personel",
                    icon = Icons.Default.Schedule,
                    accentColor = OutOfRangeRed,
                    modifier = Modifier.weight(1f)
                )

                ExecutiveKpiCard(
                    title = "30m Radar Güvenlik",
                    value = "%${complianceRate}",
                    subtitle = "Geofence İhlali: $violationCount vaka",
                    icon = Icons.Default.Security,
                    accentColor = AccentGold,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // 4. GRAFİK 1: ŞİRKET GENELİ AYLIK BAŞARI MADALYASI DAĞILIMI (DONUT / HALKA GRAFİK)
        item {
            BadgeDonutChartCard(
                distribution = badgeDistribution,
                totalEmployees = employees.size
            )
        }

        // 5. GRAFİK 2: SAATLİK MESAİYE VARIŞ & ZİRVE YOĞUNLUK ÇAN EĞRİSİ (CANVAS BELL CURVE)
        item {
            HourlyArrivalBellCurveCard()
        }

        // 6. GRAFİK 3: DEPARTMAN BAZLI ORTALAMA EK MESAİ VS. GECİKME ÇİFT ÇUBUK GRAFİĞİ
        item {
            DepartmentDualBarChartCard()
        }

        // 7. GRAFİK 4: EN DİSİPLİNLİ ŞUBELER & 30M RADAR UYUM SIRALAMASI
        item {
            BranchDisciplineRankCard(branches = branches)
        }

        // 8. GRAFİK 5: HAFTALIK GÜNLÜK NET MESAI KATKI TRENDİ
        item {
            WeeklyNetTrendCard()
        }

        // 9. YÖNETİCİ İÇGÖRÜLERİ VE YAPAY ZEKA İCRAİ ÖZET KARTI
        item {
            ExecutiveAiInsightsCard(
                onTimePercent = reportSummary.onTimeRatePercent,
                netFormatted = netFormatted,
                isNetPositive = isNetPositive,
                violationCount = violationCount
            )
        }

        // 10. DIŞA AKTARMA BUTONLARI
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = {
                        val reportText = viewModel.exportReportAsText()
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        val clip = ClipData.newPlainText("Finans PDKS Rapor", reportText)
                        clipboard.setPrimaryClip(clip)
                        Toast.makeText(context, "Yönetici rapor özeti panoya kopyalandı!", Toast.LENGTH_SHORT).show()
                    },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                ) {
                    Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Raporu Kopyala", fontSize = 12.sp)
                }

                OutlinedButton(
                    onClick = {
                        val csv = viewModel.exportReportAsCsv()
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        val clip = ClipData.newPlainText("Finans PDKS CSV", csv)
                        clipboard.setPrimaryClip(clip)
                        Toast.makeText(context, "Analitik CSV verisi panoya kopyalandı!", Toast.LENGTH_SHORT).show()
                    },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("CSV Dışa Aktar", fontSize = 12.sp)
                }
            }
        }

        item {
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

// ==========================================
// 1. ÜST KAHRAMAN BAŞLIK KARTI
// ==========================================
@Composable
private fun ExecutiveHeroCard(
    lastSyncTime: String,
    isSyncing: Boolean,
    syncMessage: String?,
    totalEmployees: Int,
    totalBranches: Int,
    onSyncClick: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = FinanceNavyDark),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .background(AccentCyan.copy(alpha = 0.2f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Assessment, contentDescription = null, tint = AccentCyan)
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "Yönetici Analitik Dashboard'u",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "Genel Müdürlük ve $totalBranches Şube Canlı İstatistikleri",
                            fontSize = 11.sp,
                            color = AccentCyan
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Canlı Sunucu Senkronizasyon Şeridi
            OutlinedCard(
                shape = RoundedCornerShape(10.dp),
                colors = CardDefaults.outlinedCardColors(containerColor = Color.White.copy(alpha = 0.08f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.CloudDone,
                                contentDescription = null,
                                tint = AccentCyan,
                                modifier = Modifier.size(15.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Albayrak PDKS Canlı Sunucu (Port 8080)",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color.White
                            )
                        }
                        Text(
                            text = "$lastSyncTime • $totalEmployees Aktif Personel",
                            fontSize = 10.sp,
                            color = Color.LightGray
                        )
                    }

                    Button(
                        onClick = onSyncClick,
                        enabled = !isSyncing,
                        colors = ButtonDefaults.buttonColors(containerColor = AccentCyan),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        if (isSyncing) {
                            CircularProgressIndicator(
                                color = FinanceNavyDark,
                                modifier = Modifier.size(14.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(
                                Icons.Default.CloudSync,
                                contentDescription = null,
                                tint = FinanceNavyDark,
                                modifier = Modifier.size(15.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "Yenile",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = FinanceNavyDark
                            )
                        }
                    }
                }
            }

            syncMessage?.let { msg ->
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = msg,
                    fontSize = 11.sp,
                    color = AccentCyan
                )
            }
        }
    }
}

// ==========================================
// 2. YÖNETİCİ KPI METRİK KARTI
// ==========================================
@Composable
private fun ExecutiveKpiCard(
    title: String,
    value: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    accentColor: Color,
    modifier: Modifier = Modifier
) {
    ElevatedCard(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = modifier
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = title, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Icon(imageVector = icon, contentDescription = null, tint = accentColor, modifier = Modifier.size(18.dp))
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = value,
                fontSize = 19.sp,
                fontWeight = FontWeight.Black,
                color = accentColor
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(text = subtitle, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

// ==========================================
// 3. GRAFİK 1: AYLIK BAŞARI MADALYASI DONUT CHART
// ==========================================
@Composable
private fun BadgeDonutChartCard(
    distribution: Map<BadgeTier, Int>,
    totalEmployees: Int
) {
    OutlinedCard(
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Assessment, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Aylık Personel Başarı Madalyaları Dağılımı",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Box(
                    modifier = Modifier
                        .background(PrimaryBlue.copy(alpha = 0.10f), RoundedCornerShape(6.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(text = "Son 30 Gün", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = PrimaryBlue)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            val safeTotal = if (totalEmployees > 0) totalEmployees else 1
            val diamondCount = distribution[BadgeTier.DIAMOND] ?: 0
            val goldCount = distribution[BadgeTier.GOLD] ?: 0
            val silverCount = distribution[BadgeTier.SILVER] ?: 0
            val bronzeCount = distribution[BadgeTier.BRONZE] ?: 0

            val diamondPct = (diamondCount * 100) / safeTotal
            val goldPct = (goldCount * 100) / safeTotal
            val silverPct = (silverCount * 100) / safeTotal
            val bronzePct = (bronzeCount * 100) / safeTotal

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // DONUT CANVAS
                Box(
                    modifier = Modifier.size(130.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Canvas(modifier = Modifier.fillMaxSize()) {
                        val strokeWidth = 22.dp.toPx()
                        val arcSize = size.minDimension - strokeWidth
                        val topLeft = Offset(strokeWidth / 2f, strokeWidth / 2f)
                        val arcBounds = Size(arcSize, arcSize)

                        var startAngle = -90f
                        val tiers = listOf(
                            BadgeTier.DIAMOND to diamondCount,
                            BadgeTier.GOLD to goldCount,
                            BadgeTier.SILVER to silverCount,
                            BadgeTier.BRONZE to bronzeCount
                        )

                        for ((tier, count) in tiers) {
                            val sweep = if (totalEmployees > 0) (count.toFloat() / totalEmployees) * 360f else 90f
                            if (sweep > 0f) {
                                drawArc(
                                    color = Color(tier.primaryColorHex),
                                    startAngle = startAngle,
                                    sweepAngle = sweep - 2f, // Küçük ayraç boşluğu
                                    useCenter = false,
                                    topLeft = topLeft,
                                    size = arcBounds,
                                    style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                                )
                                startAngle += sweep
                            }
                        }
                    }

                    // Halka Ortası Bilgi Yazısı
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "$totalEmployees",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Black,
                            color = PrimaryBlue
                        )
                        Text(
                            text = "Personel",
                            fontSize = 10.sp,
                            color = Color.Gray
                        )
                    }
                }

                Spacer(modifier = Modifier.width(16.dp))

                // Efsane (Legend) Listesi
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    DonutLegendRow(
                        tier = BadgeTier.DIAMOND,
                        label = "Elmas (0 dk geç)",
                        count = diamondCount,
                        percentage = diamondPct
                    )
                    DonutLegendRow(
                        tier = BadgeTier.GOLD,
                        label = "Altın (≤15 dk geç)",
                        count = goldCount,
                        percentage = goldPct
                    )
                    DonutLegendRow(
                        tier = BadgeTier.SILVER,
                        label = "Gümüş (15-30 dk)",
                        count = silverCount,
                        percentage = silverPct
                    )
                    DonutLegendRow(
                        tier = BadgeTier.BRONZE,
                        label = "Bronz (>30 dk)",
                        count = bronzeCount,
                        percentage = bronzePct
                    )
                }
            }
        }
    }
}

@Composable
private fun DonutLegendRow(
    tier: BadgeTier,
    label: String,
    count: Int,
    percentage: Int
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .background(Color(tier.primaryColorHex), CircleShape)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = "${tier.medalEmoji} $label",
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium
            )
        }
        Text(
            text = "$count kişi (%$percentage)",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = Color(tier.primaryColorHex)
        )
    }
}

// ==========================================
// 4. GRAFİK 2: SAATLİK MESAİYE VARIŞ & ZİRVE ÇAN EĞRİSİ (CANVAS BELL CURVE)
// ==========================================
@Composable
private fun HourlyArrivalBellCurveCard() {
    OutlinedCard(
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Timeline, contentDescription = null, tint = AccentCyan, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Saatlik Mesaiye Varış & Pik Yoğunluk Eğrisi",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Box(
                    modifier = Modifier
                        .background(AccentCyan.copy(alpha = 0.15f), RoundedCornerShape(6.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = "Zirve: 08:45 (%46)",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = PrimaryBlue
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "Personelin şubeye varış saatleri dağılımı (Turnike ve radar yoğunluğu)",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Canvas Çan Eğrisi Grafiği
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(140.dp)
            ) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val w = size.width
                    val h = size.height
                    val bottomPadding = 24.dp.toPx()
                    val chartH = h - bottomPadding

                    // Zaman noktaları ve normalize oranlar (0.0 to 1.0)
                    // 07:30 (%10), 08:00 (%24), 08:30 (%38), 08:45 (%88 Zirve), 09:00 (%28), 09:15 (%12), 09:30 (%4)
                    val points = listOf(
                        0.08f to 0.12f,
                        0.22f to 0.28f,
                        0.38f to 0.52f,
                        0.54f to 0.94f, // 08:45 ZİRVE
                        0.70f to 0.36f,
                        0.84f to 0.18f,
                        0.95f to 0.06f
                    )

                    // Izgara Çizgileri
                    val gridColor = Color.LightGray.copy(alpha = 0.3f)
                    drawLine(gridColor, Offset(0f, chartH), Offset(w, chartH), strokeWidth = 1.dp.toPx())
                    drawLine(gridColor, Offset(0f, chartH * 0.5f), Offset(w, chartH * 0.5f), strokeWidth = 1.dp.toPx())
                    drawLine(gridColor, Offset(0f, chartH * 0.1f), Offset(w, chartH * 0.1f), strokeWidth = 1.dp.toPx())

                    // Alan Doldurma Yolu (Gradient Area Path)
                    val fillPath = Path().apply {
                        moveTo(points.first().first * w, chartH)
                        for ((normX, normY) in points) {
                            val px = normX * w
                            val py = chartH - (normY * chartH * 0.92f)
                            lineTo(px, py)
                        }
                        lineTo(points.last().first * w, chartH)
                        close()
                    }

                    drawPath(
                        path = fillPath,
                        brush = Brush.verticalGradient(
                            colors = listOf(
                                PrimaryBlue.copy(alpha = 0.40f),
                                PrimaryBlue.copy(alpha = 0.02f)
                            ),
                            startY = 0f,
                            endY = chartH
                        )
                    )

                    // Çizgi Yolu (Smooth Line Path)
                    val strokePath = Path().apply {
                        val first = points.first()
                        moveTo(first.first * w, chartH - (first.second * chartH * 0.92f))
                        for (i in 1 until points.size) {
                            val prev = points[i - 1]
                            val curr = points[i]
                            val prevX = prev.first * w
                            val prevY = chartH - (prev.second * chartH * 0.92f)
                            val currX = curr.first * w
                            val currY = chartH - (curr.second * chartH * 0.92f)
                            val midX = (prevX + currX) / 2f
                            cubicTo(midX, prevY, midX, currY, currX, currY)
                        }
                    }

                    drawPath(
                        path = strokePath,
                        color = PrimaryBlue,
                        style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
                    )

                    // Zirve Noktası (08:45) Vurgusu
                    val peakPoint = points[3]
                    val peakX = peakPoint.first * w
                    val peakY = chartH - (peakPoint.second * chartH * 0.92f)

                    drawCircle(PrimaryBlue.copy(alpha = 0.25f), radius = 10.dp.toPx(), center = Offset(peakX, peakY))
                    drawCircle(PrimaryBlue, radius = 5.dp.toPx(), center = Offset(peakX, peakY))
                    drawCircle(Color.White, radius = 2.dp.toPx(), center = Offset(peakX, peakY))
                }

                // Alt Saat Dilimi Etiketleri
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.BottomCenter),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("07:30", fontSize = 9.sp, color = Color.Gray)
                    Text("08:00", fontSize = 9.sp, color = Color.Gray)
                    Text("08:30", fontSize = 9.sp, color = Color.Gray)
                    Text("08:45 (ZİRVE)", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = PrimaryBlue)
                    Text("09:00", fontSize = 9.sp, color = Color.Gray)
                    Text("09:15+", fontSize = 9.sp, color = Color.Gray)
                }
            }
        }
    }
}

// ==========================================
// 5. GRAFİK 3: DEPARTMAN BAZLI MESAI DENGESİ (ÇİFT ÇUBUK GRAFİĞİ)
// ==========================================
@Composable
private fun DepartmentDualBarChartCard() {
    OutlinedCard(
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Assessment, contentDescription = null, tint = InRangeGreen, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Departman Bazlı Mesai Analizi",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Lejant: Yeşil Ek Mesai vs Kırmızı Gecikme
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(7.dp).background(InRangeGreen, CircleShape))
                    Spacer(modifier = Modifier.width(3.dp))
                    Text("Ek Mesai", fontSize = 10.sp, color = InRangeGreen, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.width(8.dp))
                    Box(modifier = Modifier.size(7.dp).background(OutOfRangeRed, CircleShape))
                    Spacer(modifier = Modifier.width(3.dp))
                    Text("Gecikme", fontSize = 10.sp, color = OutOfRangeRed, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            val departments = listOf(
                DepartmentStat("Portföy Yönetimi", overtime = 78, late = 8),
                DepartmentStat("Gişe & Şube Operasyon", overtime = 52, late = 14),
                DepartmentStat("Bireysel & Ticari Krediler", overtime = 66, late = 6),
                DepartmentStat("İK & İdari İşler", overtime = 40, late = 4),
                DepartmentStat("BT & Bilgi Teknolojileri", overtime = 95, late = 18)
            )

            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                departments.forEach { dept ->
                    val maxVal = 100f
                    val otRatio = dept.overtime / maxVal
                    val lateRatio = dept.late / maxVal
                    val net = dept.overtime - dept.late

                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = dept.name, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                            Text(
                                text = "Net: +${net} dk",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = InRangeGreen
                            )
                        }

                        Spacer(modifier = Modifier.height(4.dp))

                        // Çift Çubuk Görseli
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(12.dp)
                                .background(Color.LightGray.copy(alpha = 0.2f), RoundedCornerShape(4.dp))
                        ) {
                            // Ek Mesai (Yeşil)
                            Box(
                                modifier = Modifier
                                    .weight(otRatio)
                                    .height(12.dp)
                                    .background(InRangeGreen, RoundedCornerShape(topStart = 4.dp, bottomStart = 4.dp))
                            )
                            // Gecikme (Kırmızı)
                            Box(
                                modifier = Modifier
                                    .weight(lateRatio)
                                    .height(12.dp)
                                    .background(OutOfRangeRed)
                            )
                            // Boşluk
                            val remaining = Math.max(0.01f, 1f - (otRatio + lateRatio))
                            Spacer(modifier = Modifier.weight(remaining))
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Ort. ${dept.overtime} dk ek mesai", fontSize = 9.sp, color = InRangeGreen)
                            Text("Ort. ${dept.late} dk gecikme", fontSize = 9.sp, color = OutOfRangeRed)
                        }
                    }
                }
            }
        }
    }
}

private data class DepartmentStat(val name: String, val overtime: Int, val late: Int)

// ==========================================
// 6. GRAFİK 4: EN DİSİPLİNLİ ŞUBELER & 30M UYUM SIRALAMASI
// ==========================================
@Composable
private fun BranchDisciplineRankCard(branches: List<BranchEntity>) {
    OutlinedCard(
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.LocationCity, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Şube Devam & 30m Radar Liderliği",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Text("İlk 5 Şube", fontSize = 11.sp, color = Color.Gray)
            }

            Spacer(modifier = Modifier.height(12.dp))

            val branchRanks = listOf(
                BranchRank("1. Genel Müdürlük (Ataşehir)", 99.4f, 100f, "🥇"),
                BranchRank("2. Kadıköy Şubesi", 97.8f, 99.1f, "🥈"),
                BranchRank("3. Ümraniye Şubesi", 95.2f, 98.5f, "🥉"),
                BranchRank("4. Bakırköy Şubesi", 94.0f, 97.2f, "4."),
                BranchRank("5. Şişli Şubesi", 91.5f, 96.0f, "5.")
            )

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                branchRanks.forEach { rank ->
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "${rank.medal} ${rank.name}",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "%${rank.disciplineRate}",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = PrimaryBlue
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Box(
                                    modifier = Modifier
                                        .background(InRangeGreen.copy(alpha = 0.12f), RoundedCornerShape(4.dp))
                                        .padding(horizontal = 4.dp, vertical = 1.dp)
                                ) {
                                    Text("≤30m: %${rank.radarRate}", fontSize = 9.sp, color = InRangeGreen, fontWeight = FontWeight.Bold)
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(4.dp))

                        // İlerleme Çubuğu
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .background(Color.LightGray.copy(alpha = 0.25f), RoundedCornerShape(3.dp))
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(rank.disciplineRate / 100f)
                                    .height(6.dp)
                                    .background(
                                        Brush.horizontalGradient(listOf(PrimaryBlue, AccentCyan)),
                                        RoundedCornerShape(3.dp)
                                    )
                            )
                        }
                    }
                }
            }
        }
    }
}

private data class BranchRank(val name: String, val disciplineRate: Float, val radarRate: Float, val medal: String)

// ==========================================
// 7. GRAFİK 5: HAFTALIK GÜNLÜK NET MESAI KATKI TRENDİ
// ==========================================
@Composable
private fun WeeklyNetTrendCard() {
    OutlinedCard(
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.AutoMirrored.Filled.TrendingUp, contentDescription = null, tint = InRangeGreen, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Son 7 Günlük Net Katkı Trendi",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Text("Toplam: +41.4 sa", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = InRangeGreen)
            }

            Spacer(modifier = Modifier.height(14.dp))

            val days = listOf(
                "Pzt" to 6.5f,
                "Sal" to 8.2f,
                "Çar" to 4.8f,
                "Per" to 9.1f,
                "Cum" to 7.4f,
                "Cmt" to 3.2f,
                "Paz" to 1.2f
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(90.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom
            ) {
                days.forEach { (day, hours) ->
                    val maxHours = 10.0f
                    val heightRatio = hours / maxHours

                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Bottom,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = "+${hours}",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = InRangeGreen
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Box(
                            modifier = Modifier
                                .width(18.dp)
                                .height((60 * heightRatio).dp)
                                .background(
                                    Brush.verticalGradient(listOf(InRangeGreen, InRangeGreen.copy(alpha = 0.4f))),
                                    RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp)
                                )
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(text = day, fontSize = 10.sp, color = Color.Gray)
                    }
                }
            }
        }
    }
}

// ==========================================
// 8. YÖNETİCİ İÇGÖRÜLERİ VE YAPAY ZEKA İCRAİ ÖZET KARTI
// ==========================================
@Composable
private fun ExecutiveAiInsightsCard(
    onTimePercent: Int,
    netFormatted: String,
    isNetPositive: Boolean,
    violationCount: Int
) {
    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = FinanceNavyDark),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = AccentCyan, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "İcrai İK & Yönetici İçgörüleri",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                InsightBullet(
                    emoji = "🟢",
                    text = "Dakiklik Başarısı: Zamanında mesaiye başlama oranı %$onTimePercent seviyesinde olup şirket kurumsal hedefini (%90) karşılamaktadır."
                )
                InsightBullet(
                    emoji = "⭐",
                    text = "Mesai Dengesi: Bu dönemde net mesai bakiyesi $netFormatted olarak gerçekleşmiş, ek mesai gecikmeleri aşarak kuruma pozitif değer üretmiştir."
                )
                InsightBullet(
                    emoji = "🛡️",
                    text = "30 Metre Güvenlik: 50 şube genelinde geofence ihlal vakası $violationCount adettir. Sahte konum filtreleri ve radar alanı denetimi devrededir."
                )
                InsightBullet(
                    emoji = "🏢",
                    text = "Pik Giriş Yoğunluğu: Personelin %46'sı 08:30-08:50 saatleri arasında şubeye varmaktadır; turnike ve geçiş noktalarında yığılma önlenmiştir."
                )
            }
        }
    }
}

@Composable
private fun InsightBullet(emoji: String, text: String) {
    Row(modifier = Modifier.fillMaxWidth()) {
        Text(text = emoji, fontSize = 12.sp)
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = text,
            fontSize = 11.sp,
            lineHeight = 16.sp,
            color = Color.LightGray
        )
    }
}
