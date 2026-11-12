package com.example.ui.screens

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.local.EmployeeEntity
import com.example.ui.MainViewModel
import com.example.ui.components.*
import com.example.ui.theme.*
import java.util.Locale

@Composable
fun ProfileScreen(
    viewModel: MainViewModel,
    onNavigateToNotifications: () -> Unit = {}
) {
    val context = LocalContext.current
    val selectedEmployee by viewModel.selectedEmployee.collectAsState()
    val selectedBranch by viewModel.selectedBranch.collectAsState()
    val employees by viewModel.employees.collectAsState()
    val allRecords by viewModel.records.collectAsState()

    var pushNotificationsEnabled by remember { mutableStateOf(true) }
    var shiftReminderEnabled by remember { mutableStateOf(true) }
    var showChangePasswordDialog by remember { mutableStateOf(false) }

    // Üst Süre ve Özel Tarih Aralığı Filtresi
    var selectedPeriodDays by remember { mutableIntStateOf(30) } // 1, 7, 30, 60
    var customFromDate by remember { mutableStateOf("") }
    var customToDate by remember { mutableStateOf("") }

    val activeEmp = remember(selectedEmployee, employees) {
        selectedEmployee ?: employees.firstOrNull() ?: EmployeeEntity(
            id = 501L,
            employeeCode = "FN-1001",
            password = "123",
            branchId = 46L,
            fullName = "Caner Öztürk",
            department = "Şube Operasyon",
            title = "Takım Lideri",
            role = "PERSONNEL",
            email = "caner.ozturk@albayrakfinans.com.tr",
            phone = "+90 532 100 2030",
            deviceId = "iPhone 13",
            shiftStartMin = 480,
            shiftEndMin = 1020,
            shiftGraceMin = 5
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

    val fullName = activeEmp.fullName
    val initials = remember(fullName) {
        fullName.split(" ")
            .mapNotNull { it.firstOrNull()?.uppercaseChar() }
            .take(2)
            .joinToString("")
    }

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
        // 1. Üst Başlık & Kişisel Analiz Excel Rapor İndirme Butonu
        item(key = "profile_header") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f).padding(end = 10.dp)) {
                    Text(
                        text = "Kişisel Profil & PDKS Karnesi",
                        color = InkPrimary,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.35).sp
                    )
                    Text(
                        text = "$fullName · ${activeEmp.department} · ${myDeepAnalytics.periodLabel}",
                        color = InkMuted,
                        fontSize = 12.sp
                    )
                }

                AnimatedDownloadButton(
                    label = "Karnemi İndir (.xlsx)",
                    onDownloadComplete = {
                        exportEmployeeDeepExcelReport(context, myDeepAnalytics)
                    },
                    variant = MinimalButtonVariant.DARK,
                    height = 36.dp
                )
            }
        }

        // 2. Minimalist Kimlik Kartı
        item(key = "profile_id_card") {
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = CardSurface,
                border = BorderStroke(1.dp, LineHairline)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(54.dp)
                                .clip(CircleShape)
                                .background(AlbayrakRed),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = initials,
                                color = Color.White,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = fullName,
                                color = InkPrimary,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = (-0.3).sp
                            )
                            Text(
                                text = "${activeEmp.title} · ${activeEmp.department}",
                                color = InkMuted,
                                fontSize = 12.sp
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                MinimalStatusBadge(text = "Personel", tone = DeltaTone.OK)
                                MinimalStatusBadge(
                                    text = "Net: ${formatSignedMinutes(myDeepAnalytics.netBalanceMin)}",
                                    tone = if (myDeepAnalytics.netBalanceMin >= 0) DeltaTone.OK else DeltaTone.BAD
                                )
                            }
                        }
                    }

                    HorizontalDivider(color = LineHairline, thickness = 1.dp)

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        val shiftStartStr = String.format(Locale.US, "%02d:%02d", activeEmp.shiftStartMin / 60, activeEmp.shiftStartMin % 60)
                        val shiftEndStr = String.format(Locale.US, "%02d:%02d", activeEmp.shiftEndMin / 60, activeEmp.shiftEndMin % 60)
                        ProfileMetaCol("Sicil No", activeEmp.employeeCode)
                        ProfileMetaCol("Vardiya", "$shiftStartStr – $shiftEndStr")
                        ProfileMetaCol("Geofence Sınır", "30.0 Metre")
                    }
                }
            }
        }

        // 3. Bağlı Şube Açık Adresi & Harita Konumu Kartı
        item(key = "profile_branch_map_card") {
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = CardSurface,
                border = BorderStroke(1.dp, LineHairline)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    MinimalSectionHeader(
                        title = "Bağlı olduğunuz şube ve açık adresi",
                        subtitle = "30 metre geofence doğrulamasının yapıldığı kurumsal lokasyon"
                    )

                    ProfileInfoRow(
                        Icons.Default.Business,
                        "Bağlı Şube & Şehir",
                        "${selectedBranch?.name ?: "Albayrak Finans Genel Müdürlük (Ataşehir)"} (${selectedBranch?.city ?: "İstanbul"})"
                    )
                    HorizontalDivider(color = LineHairline, thickness = 1.dp)
                    ProfileInfoRow(
                        Icons.Default.LocationOn,
                        "Şube Açık Adresi",
                        selectedBranch?.address ?: "Yenişehir Mah. Kızılcık Sok. Albayrak Plaza No:1/35 34779 Ataşehir / İstanbul"
                    )
                    HorizontalDivider(color = LineHairline, thickness = 1.dp)
                    ProfileInfoRow(
                        Icons.Default.Call,
                        "Şube Telefon & Koordinat",
                        "${selectedBranch?.phone ?: "444 88 61"} · ${
                            String.format(
                                Locale.US,
                                "%.4f, %.4f",
                                selectedBranch?.latitude ?: 40.9954,
                                selectedBranch?.longitude ?: 29.1408
                            )
                        }"
                    )

                    MinimalBasicButton(
                        text = "Şube Konumunu Google Haritalar'da Aç",
                        icon = Icons.Default.Map,
                        variant = MinimalButtonVariant.OUTLINE,
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            val bLat = selectedBranch?.latitude ?: 40.995454
                            val bLng = selectedBranch?.longitude ?: 29.140893
                            val bName = Uri.encode("${selectedBranch?.name ?: "Albayrak Finans"} ${selectedBranch?.address ?: ""}")
                            val gmmIntentUri = Uri.parse("geo:$bLat,$bLng?q=$bLat,$bLng($bName)")
                            try {
                                context.startActivity(Intent(Intent.ACTION_VIEW, gmmIntentUri))
                            } catch (_: Exception) {
                                try {
                                    context.startActivity(
                                        Intent(
                                            Intent.ACTION_VIEW,
                                            Uri.parse("https://www.google.com/maps/search/?api=1&query=$bLat,$bLng")
                                        )
                                    )
                                } catch (_: Exception) {
                                    Toast.makeText(context, "Harita uygulaması bulunamadı.", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                    )
                }
            }
        }

        // 4. Üst Süre ve Özel Tarih Aralığı Filtresi
        item(key = "profile_period_filter") {
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

        // 5. Dörtlü KPI Kartları
        item(key = "profile_kpis") {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    MinimalKpiCard(
                        label = "Net Mesai Bakiyesi",
                        value = formatSignedMinutes(myDeepAnalytics.netBalanceMin),
                        subtext = "Ek mesai − gecikme",
                        deltaText = if (myDeepAnalytics.netBalanceMin >= 0) "Pozitif Bakiye" else "Eksi Bakiye",
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
                        label = "En Çok Geç Kaldığı Gün",
                        value = if (myDeepAnalytics.mostLateDay.totalLateMin > 0) myDeepAnalytics.mostLateDay.dowName else "Yok",
                        subtext = "−${formatDurationMinutes(myDeepAnalytics.totalLateMin)} toplam gecikme",
                        deltaText = "${myDeepAnalytics.lateDays} gün",
                        deltaTone = if (myDeepAnalytics.totalLateMin > 0) DeltaTone.WARN else DeltaTone.OK,
                        modifier = Modifier.weight(1f)
                    )
                    MinimalKpiCard(
                        label = "Uyum & 30m Geofence",
                        value = "%${myDeepAnalytics.complianceScore}",
                        subtext = "30m Geofence: %${myDeepAnalytics.geofencePct}",
                        deltaText = "30m Kuralı",
                        deltaTone = DeltaTone.OK,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // 6. Derin Kişisel PDKS Karnesi
        item(key = "profile_deep_analysis") {
            AnimatedEntryBox(index = 0) {
                EmployeeDeepProfileAnalysisCard(
                    analytics = myDeepAnalytics,
                    onExportPersonalDeepExcel = {
                        exportEmployeeDeepExcelReport(context, myDeepAnalytics)
                    }
                )
            }
        }

        // 7. Kurumsal İletişim & Cihaz Bilgileri
        item(key = "profile_device_info") {
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
                        title = "Hesap ve cihaz doğrulaması",
                        subtitle = "Kayıtlı kurumsal bilgileriniz"
                    )

                    ProfileInfoRow(
                        Icons.Default.Email,
                        "Kurumsal E-Posta",
                        activeEmp.email
                    )
                    HorizontalDivider(color = LineHairline, thickness = 1.dp)
                    ProfileInfoRow(
                        Icons.Default.Smartphone,
                        "Eşleşen Cihaz Kimliği",
                        "${activeEmp.deviceId} (BT Onaylı)"
                    )
                }
            }
        }

        // 8. Uygulama Tercihleri
        item(key = "profile_settings") {
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
                        title = "Bildirim ve güvenlik ayarları",
                        subtitle = "Vardiya hatırlatıcıları ve parola işlemleri",
                        trailingText = "Bildirimleri Gör",
                        onTrailingClick = onNavigateToNotifications
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Anlık Bildirimler", color = InkPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Text("Mesai giriş-çıkış ve vardiya duyuruları", color = InkMuted, fontSize = 11.sp)
                        }
                        Switch(
                            checked = pushNotificationsEnabled,
                            onCheckedChange = { pushNotificationsEnabled = it },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = CardSurface,
                                checkedTrackColor = InkPrimary
                            )
                        )
                    }

                    HorizontalDivider(color = LineHairline, thickness = 1.dp)

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Mesai Başlangıç Hatırlatıcısı", color = InkPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Text("Şubeye yaklaştığınızda 08:25 hatırlatma bildirimi", color = InkMuted, fontSize = 11.sp)
                        }
                        Switch(
                            checked = shiftReminderEnabled,
                            onCheckedChange = { shiftReminderEnabled = it },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = CardSurface,
                                checkedTrackColor = InkPrimary
                            )
                        )
                    }

                    HorizontalDivider(color = LineHairline, thickness = 1.dp)

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        MinimalBasicButton(
                            text = "Parola Değiştir",
                            onClick = { showChangePasswordDialog = true },
                            variant = MinimalButtonVariant.OUTLINE,
                            icon = Icons.Default.Key,
                            modifier = Modifier.weight(1f)
                        )
                        MinimalBasicButton(
                            text = "Oturumu Kapat",
                            onClick = { viewModel.logout() },
                            variant = MinimalButtonVariant.BRAND_RED,
                            icon = Icons.AutoMirrored.Filled.Logout,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }
    }

    if (showChangePasswordDialog) {
        var currentPass by remember { mutableStateOf("") }
        var newPass by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { showChangePasswordDialog = false },
            containerColor = CardSurface,
            shape = RoundedCornerShape(16.dp),
            title = {
                Text(
                    text = "Kurumsal Parola Güncelleme",
                    color = InkPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Mevcut parolanızı hatırlamıyorsanız BT Destek birimi üzerinden tek kullanımlık parola talep edebilirsiniz.",
                        color = InkMuted,
                        fontSize = 12.sp
                    )
                    OutlinedTextField(
                        value = currentPass,
                        onValueChange = { currentPass = it },
                        label = { Text("Mevcut Parola", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )
                    OutlinedTextField(
                        value = newPass,
                        onValueChange = { newPass = it },
                        label = { Text("Yeni Parola (En az 6 karakter)", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )
                }
            },
            confirmButton = {
                MinimalBasicButton(
                    text = "Güncelle",
                    enabled = newPass.length >= 3,
                    onClick = {
                        viewModel.updateEmployee(activeEmp.copy(password = newPass.trim()))
                        showChangePasswordDialog = false
                        Toast.makeText(context, "Parolanız güvenli şekilde güncellendi.", Toast.LENGTH_SHORT).show()
                    },
                    variant = MinimalButtonVariant.DARK
                )
            },
            dismissButton = {
                MinimalBasicButton(
                    text = "Vazgeç",
                    onClick = { showChangePasswordDialog = false },
                    variant = MinimalButtonVariant.OUTLINE
                )
            }
        )
    }
}

@Composable
private fun ProfileMetaCol(label: String, value: String) {
    Column {
        Text(text = label, color = InkMuted, fontSize = 10.sp)
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = value,
            color = InkPrimary,
            fontSize = 12.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun ProfileInfoRow(icon: ImageVector, label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(SubtleSurface),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = InkSecondary,
                modifier = Modifier.size(17.dp)
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = label, color = InkMuted, fontSize = 11.sp)
            Text(text = value, color = InkPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}
