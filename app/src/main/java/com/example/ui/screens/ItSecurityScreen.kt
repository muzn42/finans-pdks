package com.example.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.local.SecurityAlertEntity
import com.example.ui.MainViewModel
import com.example.ui.components.*
import com.example.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

private data class ItSupportTicketItem(
    val id: String,
    val employeeName: String,
    val employeeCode: String,
    val department: String,
    val branch: String,
    val category: String, // PASSWORD, LOCKED, DEVICE, APP_ISSUE
    val categoryLabel: String,
    val summary: String,
    val timeAgo: String,
    val isResolved: Boolean = false,
    val generatedOtp: String? = null
)

@Composable
fun ItSecurityScreen(viewModel: MainViewModel) {
    val context = LocalContext.current
    val alerts by viewModel.alerts.collectAsState()
    val branches by viewModel.branches.collectAsState()
    val employees by viewModel.employees.collectAsState()

    var selectedTab by remember { mutableIntStateOf(0) } // 0: Parola & Destek, 1: Güvenlik Logları, 2: 30m Şubeler, 3: Sistem Sağlığı
    var ticketFilter by remember { mutableStateOf("ALL") }
    var alertFilter by remember { mutableStateOf("ALL") }

    var blockMockGps by remember { mutableStateOf(true) }
    var enforce30mRadius by remember { mutableStateOf(true) }
    var enforceDeviceBind by remember { mutableStateOf(true) }

    val supportTickets = remember {
        mutableStateListOf(
            ItSupportTicketItem(
                id = "BT-1048",
                employeeName = "Selin Demir",
                employeeCode = "FN-1003",
                department = "Müşteri İlişkileri",
                branch = "Genel Müdürlük (Topkapı)",
                category = "PASSWORD",
                categoryLabel = "Parola Sıfırlama",
                summary = "Personel kurumsal giriş parolasını unuttuğu için giriş ekranından sıfırlama talep etti.",
                timeAgo = "6 dk önce"
            ),
            ItSupportTicketItem(
                id = "BT-1047",
                employeeName = "Mehmet Kaya",
                employeeCode = "FN-1002",
                department = "Finans & Muhasebe",
                branch = "Bursa Şubesi",
                category = "LOCKED",
                categoryLabel = "Hesap Kilidi (5 Hatalı Deneme)",
                summary = "Arka arkaya 5 hatalı parola girişi nedeniyle hesap otomatik olarak kilitlendi.",
                timeAgo = "19 dk önce"
            ),
            ItSupportTicketItem(
                id = "BT-1045",
                employeeName = "Emre Çelik",
                employeeCode = "FN-1004",
                department = "Şube Operasyon",
                branch = "Ankara Şubesi",
                category = "DEVICE",
                categoryLabel = "Cihaz Eşleşme Sıfırlama",
                summary = "Personel yeni telefona geçiş yaptı (iPhone 15 -> Galaxy S24). Cihaz kimliği sıfırlanmalı.",
                timeAgo = "42 dk önce"
            ),
            ItSupportTicketItem(
                id = "BT-1042",
                employeeName = "Ayşe Kara",
                employeeCode = "FN-1005",
                department = "Kredi Tahsis",
                branch = "İzmir Şubesi",
                category = "APP_ISSUE",
                categoryLabel = "Uygulama / GPS Sorunu",
                summary = "Şube içinde olmasına rağmen GPS sapması (44m) nedeniyle konum doğrulama uyarısı alıyor.",
                timeAgo = "1 saat önce"
            ),
            ItSupportTicketItem(
                id = "BT-1039",
                employeeName = "Ahmet Yılmaz",
                employeeCode = "FN-1001",
                department = "Finans & Muhasebe",
                branch = "Genel Müdürlük (Topkapı)",
                category = "PASSWORD",
                categoryLabel = "Parola Sıfırlama",
                summary = "Üç aylık kurumsal parola süresi dolduğu için geçici parola üretildi.",
                timeAgo = "Dün 16:20",
                isResolved = true,
                generatedOtp = "ALB-7391-TK"
            )
        )
    }

    val openTicketsCount = supportTickets.count { !it.isResolved }
    val highSeverityCount = alerts.count { it.severity == "HIGH" }

    val filteredTickets = remember(supportTickets.toList(), ticketFilter) {
        when (ticketFilter) {
            "OPEN" -> supportTickets.filter { !it.isResolved }
            "PASSWORD" -> supportTickets.filter { it.category == "PASSWORD" || it.category == "LOCKED" }
            "DEVICE" -> supportTickets.filter { it.category == "DEVICE" || it.category == "APP_ISSUE" }
            "RESOLVED" -> supportTickets.filter { it.isResolved }
            else -> supportTickets
        }
    }

    val filteredAlerts = remember(alerts, alertFilter) {
        when (alertFilter) {
            "HIGH" -> alerts.filter { it.severity == "HIGH" }
            "MEDIUM" -> alerts.filter { it.severity != "HIGH" }
            else -> alerts
        }
    }

    val dateTimeFmt = remember { SimpleDateFormat("dd MMM HH:mm", Locale("tr", "TR")) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(BgCanvas),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. Üst Başlık & Animasyonlu Denetim Raporu İndirme Butonu
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f).padding(end = 10.dp)) {
                    Text(
                        text = "BT Destek & Güvenlik Merkezi",
                        color = InkPrimary,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.3).sp
                    )
                    Text(
                        text = "Parola sıfırlama, cihaz kilidi, 30m geofence ve uygulama sağlığı",
                        color = InkMuted,
                        fontSize = 12.sp
                    )
                }
                AnimatedDownloadButton(
                    label = "Denetim XLSX",
                    onDownloadComplete = {
                        exportFormattedExcelReport(
                            context = context,
                            fileNamePrefix = "Albayrak_BT_Guvenlik_Denetim_Raporu",
                            title = "BT Destek Talepleri ve 30m Geofence Güvenlik Denetim Raporu",
                            subtitle = "${supportTickets.size} Destek Talebi · ${alerts.size} Güvenlik Kaydı",
                            kpis = listOf(
                                ReportKpiItem("Açık BT Talebi", openTicketsCount.toString(), "Parola & Cihaz"),
                                ReportKpiItem("Güvenlik Uyarısı", alerts.size.toString(), "$highSeverityCount Kritik"),
                                ReportKpiItem("API Yanıt Süresi", "38 ms", "%99.94 Uptime")
                            ),
                            headers = listOf("Kayıt No / Tarih", "Personel Ad Soyad", "Birim / Şube", "Kategori / Tür", "Detay / Açıklama", "Durum"),
                            rows = supportTickets.map { t ->
                                listOf(
                                    "#${t.id} (${t.timeAgo})",
                                    "${t.employeeName} (${t.employeeCode})",
                                    "${t.department} / ${t.branch}",
                                    t.categoryLabel,
                                    t.summary,
                                    if (t.isResolved) "Çözüldü" else "Bekliyor"
                                )
                            } + alerts.map { a ->
                                listOf(
                                    dateTimeFmt.format(Date(a.timestamp)),
                                    a.employeeName,
                                    a.branchName,
                                    a.alertType,
                                    "${a.message} (${String.format(Locale.US, "%.1f m", a.distanceMeters)})",
                                    if (a.severity == "HIGH") "Kritik İhlal" else "Uyarı"
                                )
                            }
                        )
                    },
                    variant = MinimalButtonVariant.DARK,
                    height = 35.dp
                )
            }
        }

        // 2. Dörtlü BT KPI Kartları
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    MinimalKpiCard(
                        label = "Açık BT Talebi",
                        value = openTicketsCount.toString(),
                        subtext = "Parola & cihaz kilidi",
                        deltaText = if (openTicketsCount > 0) "Bekliyor" else "Temiz",
                        deltaTone = if (openTicketsCount > 0) DeltaTone.WARN else DeltaTone.OK,
                        sparklinePoints = listOf(7f, 6f, 8f, 5f, 4f, openTicketsCount.toFloat()),
                        accentColor = StatusWarn,
                        modifier = Modifier.weight(1f)
                    )
                    MinimalKpiCard(
                        label = "Güvenlik Uyarısı",
                        value = alerts.size.toString(),
                        subtext = "Sahte GPS / 30m ihlali",
                        deltaText = "$highSeverityCount Kritik",
                        deltaTone = DeltaTone.BAD,
                        sparklinePoints = listOf(4f, 3f, 5f, 2f, 3f, alerts.size.toFloat()),
                        accentColor = AlbayrakRed,
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    MinimalKpiCard(
                        label = "API Yanıt Süresi",
                        value = "38 ms",
                        subtext = "Konum doğrulama servisi",
                        deltaText = "-4 ms",
                        deltaTone = DeltaTone.OK,
                        sparklinePoints = listOf(46f, 44f, 41f, 42f, 39f, 38f),
                        accentColor = StatusOk,
                        modifier = Modifier.weight(1f)
                    )
                    MinimalKpiCard(
                        label = "Geofence Yarıçapı",
                        value = "30 Metre",
                        subtext = "${branches.size} şubede aktif",
                        deltaText = "Zorunlu",
                        deltaTone = DeltaTone.NEUTRAL,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // 3. Kayan Sekme Seçici
        item {
            MinimalSegmentedControl(
                items = listOf(
                    "Parola & Destek ($openTicketsCount)",
                    "Güvenlik (${alerts.size})",
                    "30m Şubeler",
                    "Sistem"
                ),
                selectedIndex = selectedTab,
                onSelect = { selectedTab = it }
            )
        }

        when (selectedTab) {
            // =================================================================
            // SEKME 0: PAROLA SIFIRLAMA, HESAP KİLİDİ & CİHAZ DESTEK TALEPLERİ
            // =================================================================
            0 -> {
                item {
                    MinimalFilterChipRow(
                        items = listOf(
                            FilterChipItem("ALL", "Tümü", supportTickets.size),
                            FilterChipItem("OPEN", "Açık Talepler", openTicketsCount),
                            FilterChipItem("PASSWORD", "Parola & Kilit", supportTickets.count { it.category == "PASSWORD" || it.category == "LOCKED" }),
                            FilterChipItem("DEVICE", "Cihaz & Uygulama", supportTickets.count { it.category == "DEVICE" || it.category == "APP_ISSUE" }),
                            FilterChipItem("RESOLVED", "Tamamlananlar", supportTickets.count { it.isResolved })
                        ),
                        selectedId = ticketFilter,
                        onSelect = { ticketFilter = it }
                    )
                }

                items(filteredTickets, key = { it.id }) { ticket ->
                    ItSupportTicketCard(
                        ticket = ticket,
                        onGeneratePassword = {
                            val idx = supportTickets.indexOfFirst { it.id == ticket.id }
                            if (idx != -1) {
                                val otp = "ALB-${(1000..9999).random()}-TK"
                                supportTickets[idx] = supportTickets[idx].copy(
                                    isResolved = true,
                                    generatedOtp = otp
                                )
                                // Veritabanındaki personelin şifresini de geçici parola ile güncelle
                                employees.find {
                                    it.employeeCode.equals(ticket.employeeCode, ignoreCase = true) ||
                                            it.fullName.equals(ticket.employeeName, ignoreCase = true)
                                }?.let { emp ->
                                    viewModel.updateEmployee(emp.copy(password = otp))
                                }
                                copyToClipboard(context, otp)
                                Toast.makeText(
                                    context,
                                    "${ticket.employeeName} için geçici parola ($otp) üretildi ve panoya kopyalandı.",
                                    Toast.LENGTH_LONG
                                ).show()
                            }
                        },
                        onUnlockOrResetDevice = { actionLabel ->
                            val idx = supportTickets.indexOfFirst { it.id == ticket.id }
                            if (idx != -1) {
                                supportTickets[idx] = supportTickets[idx].copy(isResolved = true)
                                Toast.makeText(
                                    context,
                                    "${ticket.employeeName}: $actionLabel işlemi tamamlandı.",
                                    Toast.LENGTH_SHORT
                                ).show()
                            }
                        }
                    )
                }
            }

            // =================================================================
            // SEKME 1: GÜVENLİK UYARILARI (SAHTE GPS, ROOT, 30M İHLALİ)
            // =================================================================
            1 -> {
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
                                title = "Haftalık güvenlik anomalisi grafiği",
                                subtitle = "Sahte konum (Mock GPS) ve 30m sınır dışı yoklama denemeleri"
                            )
                            MinimalAreaChart(
                                labels = listOf("Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Bugün"),
                                primarySeries = listOf(3f, 5f, 2f, 4f, 6f, 1f, alerts.size.toFloat()),
                                primaryColor = AlbayrakRed
                            )
                        }
                    }
                }

                item {
                    MinimalFilterChipRow(
                        items = listOf(
                            FilterChipItem("ALL", "Tüm Kayıtlar", alerts.size),
                            FilterChipItem("HIGH", "Kritik", highSeverityCount),
                            FilterChipItem("MEDIUM", "Uyarı", alerts.size - highSeverityCount)
                        ),
                        selectedId = alertFilter,
                        onSelect = { alertFilter = it }
                    )
                }

                items(filteredAlerts, key = { it.id }) { alert ->
                    SecurityAlertMinimalCard(
                        alert = alert,
                        dateTimeFmt = dateTimeFmt
                    )
                }
            }

            // =================================================================
            // SEKME 2: ŞUBE 30 METRE GEOFENCE YÖNETİMİ
            // =================================================================
            2 -> {
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
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Kurumsal Geofence Standardı",
                                    color = InkPrimary,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                MinimalStatusBadge(text = "30.0 Metre Yarıçap", tone = DeltaTone.OK)
                            }
                            Text(
                                text = "Personel mobil uygulaması yalnızca şube merkez koordinatına 30 metre ve daha yakın mesafede olduğunda giriş-çıkış kaydına izin verir.",
                                color = InkMuted,
                                fontSize = 12.sp
                            )
                        }
                    }
                }

                items(branches, key = { it.id }) { branch ->
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
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = branch.name,
                                        color = InkPrimary,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "${branch.city} · ${branch.address}",
                                        color = InkMuted,
                                        fontSize = 11.sp
                                    )
                                }
                                MinimalStatusBadge(
                                    text = "${branch.radiusMeters.toInt()} Metre",
                                    tone = DeltaTone.OK
                                )
                            }

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(BgCanvas)
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = String.format(Locale.US, "GPS: %.4f, %.4f", branch.latitude, branch.longitude),
                                    color = InkSecondary,
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.SemiBold
                                )
                                MinimalBasicButton(
                                    text = "Şube İçi Test Et",
                                    onClick = {
                                        viewModel.selectBranch(branch)
                                        viewModel.setSimulatedDistance(2.5)
                                        Toast.makeText(context, "${branch.name} içi (2.5m) simüle edildi.", Toast.LENGTH_SHORT).show()
                                    },
                                    variant = MinimalButtonVariant.OUTLINE,
                                    height = 28.dp
                                )
                            }
                        }
                    }
                }
            }

            // =================================================================
            // SEKME 3: SİSTEM SAĞLIĞI VE GÜVENLİK POLİTİKALARI
            // =================================================================
            3 -> {
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
                                title = "Altyapı ve servis çalışma durumu",
                                subtitle = "Son 30 günlük çalışma süresi (Uptime) oranları"
                            )
                            MinimalHorizontalBarRow("Kimlik Doğrulama & SSO Servisi", "%99.98", 0.999f, StatusOk, "34 ms")
                            MinimalHorizontalBarRow("30m Geofence Konum Doğrulama Motoru", "%99.95", 0.999f, StatusOk, "38 ms")
                            MinimalHorizontalBarRow("PostgreSQL Yoklama Veritabanı", "%100.0", 1.0f, StatusOk, "12 ms")
                            MinimalHorizontalBarRow("Mobil Anlık Bildirim (Push) Ağ Geçidi", "%99.82", 0.998f, InkPrimary, "64 ms")
                        }
                    }
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
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            MinimalSectionHeader(
                                title = "Mobil uygulama güvenlik politikaları",
                                subtitle = "Personel cihazlarında zorunlu tutulan güvenlik kontrolleri"
                            )

                            PolicySwitchRow(
                                title = "Sahte Konum (Mock GPS) Engelleme",
                                subtitle = "Geliştirici seçeneklerinden sahte konum açıldığında yoklamayı reddet",
                                checked = blockMockGps,
                                onCheckedChange = { blockMockGps = it }
                            )
                            HorizontalDivider(color = LineHairline, thickness = 1.dp)
                            PolicySwitchRow(
                                title = "30 Metre Şube Geofence Zorunluluğu",
                                subtitle = "Şube merkezine 30m mesafeden uzak cihazların giriş kaydını engelle",
                                checked = enforce30mRadius,
                                onCheckedChange = { enforce30mRadius = it }
                            )
                            HorizontalDivider(color = LineHairline, thickness = 1.dp)
                            PolicySwitchRow(
                                title = "Tekil Cihaz Kimliği (Device-ID) Eşleşmesi",
                                subtitle = "Personelin yalnızca BT tarafından onaylı cihazından giriş yapmasını zorunlu kıl",
                                checked = enforceDeviceBind,
                                onCheckedChange = { enforceDeviceBind = it }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ItSupportTicketCard(
    ticket: ItSupportTicketItem,
    onGeneratePassword: () -> Unit,
    onUnlockOrResetDevice: (String) -> Unit
) {
    val categoryTone = when {
        ticket.isResolved -> DeltaTone.OK
        ticket.category == "LOCKED" -> DeltaTone.BAD
        ticket.category == "PASSWORD" -> DeltaTone.WARN
        else -> DeltaTone.NEUTRAL
    }

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
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = "#${ticket.id}",
                        color = InkMuted,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = ticket.employeeName,
                        color = InkPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                MinimalStatusBadge(
                    text = if (ticket.isResolved) "Çözüldü" else ticket.categoryLabel,
                    tone = categoryTone
                )
            }

            Text(
                text = "${ticket.department} · ${ticket.branch} · Sicil: ${ticket.employeeCode} · ${ticket.timeAgo}",
                color = InkMuted,
                fontSize = 11.sp
            )

            Text(
                text = ticket.summary,
                color = InkSecondary,
                fontSize = 12.sp
            )

            if (ticket.generatedOtp != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(StatusOkSoft)
                        .border(1.dp, StatusOk.copy(alpha = 0.3f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Tek Kullanımlık Parola (15 dk):",
                        color = StatusOk,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = ticket.generatedOtp,
                        color = InkPrimary,
                        fontSize = 13.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            if (!ticket.isResolved) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    when (ticket.category) {
                        "PASSWORD" -> {
                            MinimalBasicButton(
                                text = "Tek Kullanımlık Parola Üret",
                                onClick = onGeneratePassword,
                                variant = MinimalButtonVariant.DARK,
                                icon = Icons.Default.Key,
                                height = 36.dp,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        "LOCKED" -> {
                            MinimalBasicButton(
                                text = "Kilidi Aç & Parola Üret",
                                onClick = onGeneratePassword,
                                variant = MinimalButtonVariant.BRAND_RED,
                                icon = Icons.Default.LockOpen,
                                height = 36.dp,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        "DEVICE" -> {
                            MinimalBasicButton(
                                text = "Cihaz Eşleşmesini Sıfırla",
                                onClick = { onUnlockOrResetDevice("Cihaz eşleşmesi sıfırlama") },
                                variant = MinimalButtonVariant.DARK,
                                icon = Icons.Default.PhonelinkSetup,
                                height = 36.dp,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        else -> {
                            MinimalBasicButton(
                                text = "GPS Kalibrasyonunu Onayla",
                                onClick = { onUnlockOrResetDevice("GPS istisna kontrolü") },
                                variant = MinimalButtonVariant.DARK,
                                icon = Icons.Default.Check,
                                height = 36.dp,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SecurityAlertMinimalCard(
    alert: SecurityAlertEntity,
    dateTimeFmt: SimpleDateFormat
) {
    val isCrit = alert.severity == "HIGH"
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
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = alert.employeeName,
                    color = InkPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
                MinimalStatusBadge(
                    text = if (isCrit) "Kritik İhlal" else "Güvenlik Uyarısı",
                    tone = if (isCrit) DeltaTone.BAD else DeltaTone.WARN
                )
            }
            Text(
                text = "${alert.alertType} · ${alert.branchName}",
                color = InkSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = alert.message,
                color = InkMuted,
                fontSize = 12.sp
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = String.format(Locale.US, "Sapma: %.1f metre", alert.distanceMeters),
                    color = InkMuted,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    text = dateTimeFmt.format(Date(alert.timestamp)),
                    color = InkMuted,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
        }
    }
}

@Composable
private fun PolicySwitchRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
            Text(
                text = title,
                color = InkPrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = subtitle,
                color = InkMuted,
                fontSize = 11.sp
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = CardSurface,
                checkedTrackColor = InkPrimary,
                uncheckedThumbColor = InkMuted,
                uncheckedTrackColor = SubtleSurface
            )
        )
    }
}

private fun copyToClipboard(context: Context, text: String) {
    try {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("Geçici Parola", text))
    } catch (_: Exception) {
    }
}
