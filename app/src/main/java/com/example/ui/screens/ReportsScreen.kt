package com.example.ui.screens

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FileDownload
import androidx.compose.material.icons.filled.MoreTime
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.TimerOff
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.MainViewModel
import com.example.ui.ReportPeriod
import com.example.ui.theme.AccentCyan
import com.example.ui.theme.AccentGold
import com.example.ui.theme.InRangeGreen
import com.example.ui.theme.OutOfRangeRed
import com.example.ui.theme.PrimaryBlue

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ReportsScreen(
    viewModel: MainViewModel,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val currentPeriod by viewModel.selectedReportPeriod.collectAsState()
    val reportSummary by viewModel.reportSummary.collectAsState()

    var detailTabIndex by remember { mutableIntStateOf(0) } // 0: Geç Kalanlar, 1: Fazla Mesai, 2: 5m İhlalleri

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Başlık ve Periyot Seçimi
        item {
            Column {
                Text(
                    text = "Gelişmiş Devam & Mesai Raporları",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "Günlük, haftalık ve aylık devamlılık, geç kalma ve fazla mesai dökümü",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Periyot Seçim Butonları (Günlük, Haftalık, Aylık)
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ReportPeriod.values().forEach { p ->
                    FilterChip(
                        selected = currentPeriod == p,
                        onClick = { viewModel.setReportPeriod(p) },
                        label = { Text(p.title) }
                    )
                }
            }
        }

        // Dışa Aktarma / Paylaşım Butonları
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = {
                        val textToShare = viewModel.exportReportAsText()
                        val sendIntent = Intent().apply {
                            action = Intent.ACTION_SEND
                            putExtra(Intent.EXTRA_TEXT, textToShare)
                            putExtra(Intent.EXTRA_SUBJECT, "Finans PDKS ${currentPeriod.title} Devam Raporu")
                            type = "text/plain"
                        }
                        val shareIntent = Intent.createChooser(sendIntent, "Raporu Paylaş / İlet")
                        context.startActivity(shareIntent)
                    },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Share,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Raporu Paylaş (TXT)", fontSize = 12.sp)
                }

                OutlinedButton(
                    onClick = {
                        val csvToShare = viewModel.exportReportAsCsv()
                        val sendIntent = Intent().apply {
                            action = Intent.ACTION_SEND
                            putExtra(Intent.EXTRA_TEXT, csvToShare)
                            putExtra(Intent.EXTRA_SUBJECT, "Finans_PDKS_${currentPeriod.title}_Rapor.csv")
                            type = "text/csv"
                        }
                        val shareIntent = Intent.createChooser(sendIntent, "CSV Olarak Dışa Aktar")
                        context.startActivity(shareIntent)
                    },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.FileDownload,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("CSV Dışa Aktar", fontSize = 12.sp)
                }
            }
        }

        // Özet Metrik Kartları
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Zamanında Giriş Oranı
                ElevatedCard(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text("Zamanında", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            text = "%${reportSummary.onTimeRatePercent}",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = InRangeGreen
                        )
                        Text("Devamlılık Oranı", fontSize = 9.sp, color = Color.Gray)
                    }
                }

                // Geç Kalanlar (Tıklanabilir Filtre)
                ElevatedCard(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { detailTabIndex = 0 },
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text("Geç Kalanlar", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            text = "${reportSummary.lateArrivalsCount} Kişi",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = OutOfRangeRed
                        )
                        Text("Toplam ${reportSummary.totalLateMinutes} dk", fontSize = 9.sp, color = Color.Gray)
                    }
                }

                // Fazla Mesai (Tıklanabilir Filtre)
                ElevatedCard(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { detailTabIndex = 1 },
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text("Fazla Mesai", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            text = "${reportSummary.overtimeCount} Kişi",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = AccentGold
                        )
                        Text("Toplam ${reportSummary.totalOvertimeMinutes} dk", fontSize = 9.sp, color = Color.Gray)
                    }
                }
            }
        }

        // İkinci Satır Metrikler (Toplam İşlem & 30m İhlalleri)
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedCard(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.TrendingUp,
                            contentDescription = null,
                            tint = PrimaryBlue,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text("Toplam Hareket", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(
                                "${reportSummary.totalRecords} Giriş/Çıkış",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                OutlinedCard(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { detailTabIndex = 2 },
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Warning,
                            contentDescription = null,
                            tint = OutOfRangeRed,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text("30m Konum İhlali", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(
                                "${reportSummary.geofenceViolationsCount} Engelleme",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = OutOfRangeRed
                            )
                        }
                    }
                }
            }
        }

        // Detay Sekmeleri (Geç Kalanlar, Fazla Mesai, 30m İhlalleri)
        item {
            TabRow(selectedTabIndex = detailTabIndex) {
                Tab(
                    selected = detailTabIndex == 0,
                    onClick = { detailTabIndex = 0 },
                    text = { Text("Geç Kalanlar (${reportSummary.lateArrivalsCount})", fontSize = 11.sp) }
                )
                Tab(
                    selected = detailTabIndex == 1,
                    onClick = { detailTabIndex = 1 },
                    text = { Text("Fazla Mesai (${reportSummary.overtimeCount})", fontSize = 11.sp) }
                )
                Tab(
                    selected = detailTabIndex == 2,
                    onClick = { detailTabIndex = 2 },
                    text = { Text("🚨 30m İhlalleri (${reportSummary.geofenceViolationsCount})", fontSize = 11.sp) }
                )
            }
        }

        when (detailTabIndex) {
            0 -> {
                // Geç Kalanlar Listesi
                if (reportSummary.lateRecords.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Seçilen periyotta (${currentPeriod.title}) geç kalan personel bulunmamaktadır. Tebrikler!",
                                fontSize = 12.sp,
                                color = InRangeGreen
                            )
                        }
                    }
                } else {
                    items(reportSummary.lateRecords) { r ->
                        OutlinedCard(
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = r.employeeName,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "${r.branchName} • Giriş: ${r.formattedTime}",
                                        fontSize = 11.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    if (r.note.isNotBlank()) {
                                        Text(
                                            text = "Not: ${r.note}",
                                            fontSize = 11.sp,
                                            fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                                            color = MaterialTheme.colorScheme.primary
                                        )
                                    }
                                }

                                Box(
                                    modifier = Modifier
                                        .background(OutOfRangeRed.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = "+${r.lateMinutes} dk Gecikme",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = OutOfRangeRed
                                    )
                                }
                            }
                        }
                    }
                }
            }
            1 -> {
                // Fazla Mesai Listesi
                if (reportSummary.overtimeRecords.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Seçilen periyotta (${currentPeriod.title}) 18:00 sonrası fazla mesai kaydı bulunmamaktadır.",
                                fontSize = 12.sp,
                                color = Color.Gray
                            )
                        }
                    }
                } else {
                    items(reportSummary.overtimeRecords) { r ->
                        OutlinedCard(
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = r.employeeName,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "${r.branchName} • Çıkış: ${r.formattedTime}",
                                        fontSize = 11.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }

                                Box(
                                    modifier = Modifier
                                        .background(AccentGold.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = "+${r.overtimeMinutes} dk Mesai",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = AccentGold
                                    )
                                }
                            }
                        }
                    }
                }
            }
            else -> {
                // 30m İhlalleri Listesi
                if (reportSummary.violationAlerts.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Seçilen periyotta (${currentPeriod.title}) 30 metre kural ihlali kaydedilmemiştir. %100 Uyum!",
                                fontSize = 12.sp,
                                color = InRangeGreen
                            )
                        }
                    }
                } else {
                    items(reportSummary.violationAlerts) { alert ->
                        val dateFmt = SimpleDateFormat("dd.MM.yyyy HH:mm", Locale.getDefault())
                        val timeStr = dateFmt.format(Date(alert.timestamp))
                        OutlinedCard(
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = alert.employeeName,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "${alert.branchName} • $timeStr",
                                        fontSize = 11.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    Text(
                                        text = alert.message,
                                        fontSize = 11.sp,
                                        color = OutOfRangeRed
                                    )
                                }

                                Box(
                                    modifier = Modifier
                                        .background(OutOfRangeRed.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = "${"%.1f".format(alert.distanceMeters)}m Uyarı",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = OutOfRangeRed
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
