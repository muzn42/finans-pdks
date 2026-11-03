package com.example.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.local.BranchEntity
import com.example.ui.MainViewModel
import com.example.ui.theme.AccentCyan
import com.example.ui.theme.FinanceNavyDark
import com.example.ui.theme.PrimaryBlue
import com.example.util.turkishContains

@Composable
fun ItBranchManagementScreen(
    viewModel: MainViewModel,
    modifier: Modifier = Modifier
) {
    val branches by viewModel.branches.collectAsState()

    var searchQuery by remember { mutableStateOf("") }
    var showDialog by remember { mutableStateOf(false) }
    var editingBranch by remember { mutableStateOf<BranchEntity?>(null) }
    var branchToDelete by remember { mutableStateOf<BranchEntity?>(null) }

    val filteredBranches = branches.filter {
        it.name.turkishContains(searchQuery) ||
        it.branchCode.turkishContains(searchQuery) ||
        it.city.turkishContains(searchQuery) ||
        it.address.turkishContains(searchQuery)
    }

    Box(
        modifier = modifier.fillMaxSize()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Başlık Kartı
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = FinanceNavyDark),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .background(Color(0xFF7C3AED).copy(alpha = 0.3f), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Business, contentDescription = null, tint = AccentCyan)
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "BT Şube Adres & İsim Tanımları",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Text(
                                text = "Şube Lokasyonları ve 30 Metre Geofence Altyapısı",
                                fontSize = 12.sp,
                                color = AccentCyan
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "Tanımlı Şube Sayısı: ${branches.size} • Geofence Politikası: Max 30.0m",
                        fontSize = 12.sp,
                        color = Color.LightGray
                    )
                }
            }

            // Arama Kutusu
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                label = { Text("Şube Ara (İsim, Şehir, Kod, Adres)") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            )

            // Şube Listesi
            if (filteredBranches.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Kayıtlı şube bulunamadı.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(filteredBranches, key = { it.id }) { branch ->
                        BranchItemCard(
                            branch = branch,
                            onEdit = {
                                editingBranch = branch
                                showDialog = true
                            },
                            onDelete = {
                                branchToDelete = branch
                            }
                        )
                    }
                }
            }
        }

        FloatingActionButton(
            onClick = {
                editingBranch = null
                showDialog = true
            },
            containerColor = Color(0xFF7C3AED),
            contentColor = Color.White,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.Add, contentDescription = "Yeni Şube Tanımla")
                Spacer(modifier = Modifier.width(6.dp))
                Text("Şube Tanımla", fontWeight = FontWeight.Bold)
            }
        }
    }

    // Şube Ekle / Düzenle Dialog
    if (showDialog) {
        BranchFormDialog(
            initialBranch = editingBranch,
            onDismiss = {
                showDialog = false
                editingBranch = null
            },
            onSave = { id, name, code, city, address, lat, lng, radius, wifi, phone ->
                viewModel.saveOrUpdateBranch(
                    id = id,
                    name = name,
                    branchCode = code,
                    city = city,
                    address = address,
                    latitude = lat,
                    longitude = lng,
                    radiusMeters = radius,
                    wifiSsid = wifi,
                    phone = phone
                )
                showDialog = false
                editingBranch = null
            }
        )
    }

    // Şube Silme Onay Dialog
    branchToDelete?.let { b ->
        AlertDialog(
            onDismissRequest = { branchToDelete = null },
            title = { Text("Şubeyi Sil") },
            text = { Text("${b.name} şubesi veritabanından silinsin mi?") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteBranch(b.id)
                        branchToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Sil", color = Color.White)
                }
            },
            dismissButton = {
                TextButton(onClick = { branchToDelete = null }) {
                    Text("İptal")
                }
            }
        )
    }
}

@Composable
fun BranchItemCard(
    branch: BranchEntity,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    OutlinedCard(
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .background(Color(0xFF7C3AED).copy(alpha = 0.12f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Business, contentDescription = null, tint = Color(0xFF7C3AED))
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = branch.name,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                        Text(
                            text = "Kod: ${branch.branchCode} • ${branch.city}",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Row {
                    IconButton(onClick = onEdit) {
                        Icon(Icons.Default.Edit, contentDescription = "Düzenle", tint = PrimaryBlue)
                    }
                    IconButton(onClick = onDelete) {
                        Icon(Icons.Default.Delete, contentDescription = "Sil", tint = MaterialTheme.colorScheme.error)
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "📍 Adres: ${branch.address}",
                fontSize = 12.sp,
                color = Color.DarkGray
            )

            Spacer(modifier = Modifier.height(4.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "GPS: ${"%.5f".format(branch.latitude)}, ${"%.5f".format(branch.longitude)}",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "Tolerans: ${branch.radiusMeters}m",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF059669)
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Wifi, contentDescription = null, modifier = Modifier.size(13.dp), tint = Color.Gray)
                Spacer(modifier = Modifier.width(4.dp))
                Text(text = "WiFi: ${branch.wifiSsid}", fontSize = 11.sp, color = Color.Gray)
                Spacer(modifier = Modifier.width(12.dp))
                Icon(Icons.Default.Phone, contentDescription = null, modifier = Modifier.size(13.dp), tint = Color.Gray)
                Spacer(modifier = Modifier.width(4.dp))
                Text(text = branch.phone, fontSize = 11.sp, color = Color.Gray)
            }
        }
    }
}

@Composable
fun BranchFormDialog(
    initialBranch: BranchEntity?,
    onDismiss: () -> Unit,
    onSave: (Long, String, String, String, String, Double, Double, Double, String, String) -> Unit
) {
    var name by remember { mutableStateOf(initialBranch?.name ?: "") }
    var branchCode by remember { mutableStateOf(initialBranch?.branchCode ?: "") }
    var city by remember { mutableStateOf(initialBranch?.city ?: "İstanbul") }
    var address by remember { mutableStateOf(initialBranch?.address ?: "") }
    var latStr by remember { mutableStateOf(initialBranch?.latitude?.toString() ?: "41.111850") }
    var lngStr by remember { mutableStateOf(initialBranch?.longitude?.toString() ?: "29.022350") }
    var radiusStr by remember { mutableStateOf(initialBranch?.radiusMeters?.toString() ?: "5.0") }
    var wifiSsid by remember { mutableStateOf(initialBranch?.wifiSsid ?: "FINANS_CORP_SECURE") }
    var phone by remember { mutableStateOf(initialBranch?.phone ?: "0212 555 0100") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = if (initialBranch == null) "Yeni Şube Tanımla" else "Şube Adres & İsim Düzenle",
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Şube Adı (Örn: Maslak Finans Şubesi)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = branchCode,
                        onValueChange = { branchCode = it },
                        label = { Text("Şube Kodu (ŞB-105)") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = city,
                        onValueChange = { city = it },
                        label = { Text("Şehir") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                }

                OutlinedTextField(
                    value = address,
                    onValueChange = { address = it },
                    label = { Text("Açık Adres Tanımı") },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth()
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = latStr,
                        onValueChange = { latStr = it },
                        label = { Text("Enlem (Lat)") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = lngStr,
                        onValueChange = { lngStr = it },
                        label = { Text("Boylam (Lng)") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = radiusStr,
                        onValueChange = { radiusStr = it },
                        label = { Text("Geofence Tolerans (m)") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = wifiSsid,
                        onValueChange = { wifiSsid = it },
                        label = { Text("Kurumsal WiFi") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                }

                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text("Şube Telefon") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val lat = latStr.toDoubleOrNull() ?: 41.111850
                    val lng = lngStr.toDoubleOrNull() ?: 29.022350
                    val radius = radiusStr.toDoubleOrNull() ?: 5.0

                    if (name.isNotBlank() && address.isNotBlank() && branchCode.isNotBlank()) {
                        onSave(
                            initialBranch?.id ?: 0L,
                            name,
                            branchCode,
                            city,
                            address,
                            lat,
                            lng,
                            radius,
                            wifiSsid,
                            phone
                        )
                    }
                },
                enabled = name.isNotBlank() && address.isNotBlank() && branchCode.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7C3AED))
            ) {
                Text("Şubeyi Kaydet", color = Color.White)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Vazgeç")
            }
        }
    )
}
