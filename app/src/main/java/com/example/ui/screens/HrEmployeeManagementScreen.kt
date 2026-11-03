package com.example.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
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
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.border
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Sort
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import com.example.data.local.AttendanceRecordEntity
import com.example.ui.theme.InRangeGreen
import com.example.data.local.BranchEntity
import com.example.data.local.EmployeeEntity
import com.example.ui.MainViewModel
import com.example.ui.theme.AccentCyan
import com.example.ui.theme.FinanceNavyDark
import com.example.ui.theme.OutOfRangeRed
import com.example.ui.theme.PrimaryBlue
import com.example.util.BadgeCalculator
import com.example.util.BadgeTier
import com.example.util.turkishContains

enum class HrEmployeeSortOption(val title: String) {
    LATE_DESC("En Çok Geç Kalan 🔻"),
    OVERTIME_DESC("En Çok Ek Mesai 🔻"),
    NET_BALANCE_DESC("En Yüksek Katkı (Net+) 🔻"),
    NET_BALANCE_ASC("En Fazla Açık (Net-) 🔺"),
    NAME_ASC("İsim Sırası (A → Z)"),
    CODE_ASC("Sicil Numarası"),
    BRANCH_ASC("Şube Sırası")
}

enum class HrAttendanceStatusFilter(val title: String) {
    ALL("Tüm Durumlar"),
    WITH_LATE("⚠️ Gecikenler"),
    WITH_OVERTIME("⭐ Ek Mesai"),
    NEGATIVE_BALANCE("📉 Net Açık"),
    POSITIVE_BALANCE("📈 Net Katkı"),
    WITH_VIOLATION("🚨 30m İhlalleri")
}

data class EmployeeAttendanceStats(
    val badgeTier: BadgeTier,
    val totalLateMinutes: Int,
    val totalOvertimeMinutes: Int,
    val netBalanceMinutes: Int,
    val violationCount: Int,
    val totalCheckIns: Int
)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun HrEmployeeManagementScreen(
    viewModel: MainViewModel,
    modifier: Modifier = Modifier
) {
    val employees by viewModel.employees.collectAsState()
    val branches by viewModel.branches.collectAsState()
    val records by viewModel.records.collectAsState()
    val alerts by viewModel.alerts.collectAsState()

    var searchQuery by remember { mutableStateOf("") }
    var currentSortOption by remember { mutableStateOf(HrEmployeeSortOption.LATE_DESC) }
    var selectedBadgeFilter by remember { mutableStateOf<BadgeTier?>(null) }
    var selectedStatusFilter by remember { mutableStateOf(HrAttendanceStatusFilter.ALL) }
    var showSortMenu by remember { mutableStateOf(false) }

    var showDialog by remember { mutableStateOf(false) }
    var editingEmployee by remember { mutableStateOf<EmployeeEntity?>(null) }
    var employeeToDelete by remember { mutableStateOf<EmployeeEntity?>(null) }

    // Her personelin son 30 günlük devam ve mesai metrikleri
    val employeeStatsMap = remember(employees, records, alerts) {
        employees.associate { emp ->
            val empRecs = records.filter { it.employeeId == emp.id }
            val badgeResult = BadgeCalculator.calculateMonthlyBadge(empRecs)
            val lateMin = empRecs.filter { it.recordType == "GİRİŞ" }.sumOf { it.lateMinutes }
            val otMin = empRecs.filter { it.recordType == "ÇIKIŞ" }.sumOf { it.overtimeMinutes }
            val violCount = alerts.count { it.employeeId == emp.id }
            val checkIns = empRecs.count { it.recordType == "GİRİŞ" }
            emp.id to EmployeeAttendanceStats(
                badgeTier = badgeResult.tier,
                totalLateMinutes = lateMin,
                totalOvertimeMinutes = otMin,
                netBalanceMinutes = otMin - lateMin,
                violationCount = violCount,
                totalCheckIns = checkIns
            )
        }
    }

    // Filtre çipleri için dinamik sayaçlar
    val diamondCount = remember(employeeStatsMap) { employeeStatsMap.values.count { it.badgeTier == BadgeTier.DIAMOND } }
    val goldCount = remember(employeeStatsMap) { employeeStatsMap.values.count { it.badgeTier == BadgeTier.GOLD } }
    val silverCount = remember(employeeStatsMap) { employeeStatsMap.values.count { it.badgeTier == BadgeTier.SILVER } }
    val bronzeCount = remember(employeeStatsMap) { employeeStatsMap.values.count { it.badgeTier == BadgeTier.BRONZE } }

    val lateCount = remember(employeeStatsMap) { employeeStatsMap.values.count { it.totalLateMinutes > 0 } }
    val overtimeCount = remember(employeeStatsMap) { employeeStatsMap.values.count { it.totalOvertimeMinutes > 0 } }
    val negativeCount = remember(employeeStatsMap) { employeeStatsMap.values.count { it.netBalanceMinutes < 0 } }
    val positiveCount = remember(employeeStatsMap) { employeeStatsMap.values.count { it.netBalanceMinutes >= 0 } }
    val violationCount = remember(employeeStatsMap) { employeeStatsMap.values.count { it.violationCount > 0 } }

    // Filtreleme ve Sıralama
    val filteredEmployees = remember(
        employees, searchQuery, selectedBadgeFilter, selectedStatusFilter, currentSortOption, employeeStatsMap, branches
    ) {
        val filtered = employees.filter { emp ->
            val stats = employeeStatsMap[emp.id]

            // 1. Arama Filtresi (İsim, Sicil, Departman)
            val matchesSearch = searchQuery.isBlank() ||
                emp.fullName.turkishContains(searchQuery) ||
                emp.employeeCode.turkishContains(searchQuery) ||
                emp.department.turkishContains(searchQuery)

            // 2. Rozet Filtresi
            val matchesBadge = selectedBadgeFilter == null || stats?.badgeTier == selectedBadgeFilter

            // 3. Mesai & Rapor Durum Filtresi
            val matchesStatus = when (selectedStatusFilter) {
                HrAttendanceStatusFilter.ALL -> true
                HrAttendanceStatusFilter.WITH_LATE -> (stats?.totalLateMinutes ?: 0) > 0
                HrAttendanceStatusFilter.WITH_OVERTIME -> (stats?.totalOvertimeMinutes ?: 0) > 0
                HrAttendanceStatusFilter.NEGATIVE_BALANCE -> (stats?.netBalanceMinutes ?: 0) < 0
                HrAttendanceStatusFilter.POSITIVE_BALANCE -> (stats?.netBalanceMinutes ?: 0) >= 0
                HrAttendanceStatusFilter.WITH_VIOLATION -> (stats?.violationCount ?: 0) > 0
            }

            matchesSearch && matchesBadge && matchesStatus
        }

        // İK İhtiyaçlarına Göre Sıralama
        when (currentSortOption) {
            HrEmployeeSortOption.LATE_DESC -> filtered.sortedByDescending { employeeStatsMap[it.id]?.totalLateMinutes ?: 0 }
            HrEmployeeSortOption.OVERTIME_DESC -> filtered.sortedByDescending { employeeStatsMap[it.id]?.totalOvertimeMinutes ?: 0 }
            HrEmployeeSortOption.NET_BALANCE_DESC -> filtered.sortedByDescending { employeeStatsMap[it.id]?.netBalanceMinutes ?: 0 }
            HrEmployeeSortOption.NET_BALANCE_ASC -> filtered.sortedBy { employeeStatsMap[it.id]?.netBalanceMinutes ?: 0 }
            HrEmployeeSortOption.NAME_ASC -> filtered.sortedBy { it.fullName }
            HrEmployeeSortOption.CODE_ASC -> filtered.sortedBy { it.employeeCode }
            HrEmployeeSortOption.BRANCH_ASC -> filtered.sortedBy { branches.find { b -> b.id == it.branchId }?.name ?: "" }
        }
    }

    val listState = rememberLazyListState()
    val isScrolled by remember {
        derivedStateOf {
            listState.firstVisibleItemIndex > 0 || listState.firstVisibleItemScrollOffset > 30
        }
    }
    var isSearchExpanded by remember { mutableStateOf(false) }

    Box(
        modifier = modifier.fillMaxSize()
    ) {
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Başlık Kartı: Yukarı kaydırdıkça arama dışındakiler doğal olarak yukarı kayar
            item {
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = FinanceNavyDark),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .background(AccentCyan.copy(alpha = 0.2f), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.Security,
                                    contentDescription = null,
                                    tint = AccentCyan,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = "İK Personel & Şifre Yönetim Paneli",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                                Text(
                                    text = "Performans, Rozet, Sicil ve Şube Yönetim Merkezi",
                                    fontSize = 11.sp,
                                    color = AccentCyan
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Kayıtlı: ${employees.size} kişi",
                                fontSize = 11.sp,
                                color = Color.LightGray
                            )
                            Text(
                                text = "Aktif Şubeler: ${branches.size}",
                                fontSize = 11.sp,
                                color = Color.LightGray
                            )
                        }
                    }
                }
            }

            // Arama Çubuğu / Kompakt Kısayol Barı
            stickyHeader {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.background)
                        .padding(vertical = 4.dp)
                ) {
                    if (!isScrolled || isSearchExpanded) {
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            placeholder = { Text("Personel Ara (İsim, Sicil No, Departman)", fontSize = 13.sp) },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(20.dp)) },
                            trailingIcon = {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    if (searchQuery.isNotEmpty()) {
                                        IconButton(onClick = { searchQuery = "" }) {
                                            Icon(Icons.Default.Clear, contentDescription = "Temizle", modifier = Modifier.size(18.dp))
                                        }
                                    }
                                    if (isScrolled) {
                                        IconButton(onClick = { isSearchExpanded = false }) {
                                            Icon(Icons.Default.ExpandLess, contentDescription = "Küçült", tint = PrimaryBlue, modifier = Modifier.size(20.dp))
                                        }
                                    }
                                }
                            },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp)
                        )
                    } else {
                        Surface(
                            shape = RoundedCornerShape(20.dp),
                            color = FinanceNavyDark,
                            tonalElevation = 4.dp,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(38.dp)
                                .clickable { isSearchExpanded = true }
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(horizontal = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Search,
                                        contentDescription = null,
                                        tint = AccentCyan,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = if (searchQuery.isNotBlank())
                                            "Arama: \"$searchQuery\" (${filteredEmployees.size} personel)"
                                        else
                                            "Personel Ara... (${filteredEmployees.size} kayıt)",
                                        fontSize = 12.sp,
                                        color = Color.White,
                                        fontWeight = FontWeight.Medium
                                    )
                                }

                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    if (searchQuery.isNotEmpty()) {
                                        IconButton(
                                            onClick = { searchQuery = "" },
                                            modifier = Modifier.size(26.dp)
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.Clear,
                                                contentDescription = "Temizle",
                                                tint = Color.LightGray,
                                                modifier = Modifier.size(14.dp)
                                            )
                                        }
                                    }
                                    Icon(
                                        imageVector = Icons.Default.ExpandMore,
                                        contentDescription = "Genişlet",
                                        tint = AccentCyan,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // ==========================================
            // İK RAPOR, SIRALAMA VE ROZET FİLTRE BARLARI
            // ==========================================
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    // Sıralama Seçici ve Filtre Sıfırla Satırı
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box {
                            OutlinedCard(
                                modifier = Modifier.clickable { showSortMenu = true },
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Sort,
                                        contentDescription = null,
                                        tint = PrimaryBlue,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = currentSortOption.title,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = PrimaryBlue
                                    )
                                    Icon(
                                        imageVector = Icons.Default.ArrowDropDown,
                                        contentDescription = null,
                                        tint = PrimaryBlue,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }

                            DropdownMenu(
                                expanded = showSortMenu,
                                onDismissRequest = { showSortMenu = false }
                            ) {
                                HrEmployeeSortOption.values().forEach { sortOpt ->
                                    DropdownMenuItem(
                                        text = {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                if (currentSortOption == sortOpt) {
                                                    Icon(
                                                        Icons.Default.Check,
                                                        contentDescription = null,
                                                        tint = PrimaryBlue,
                                                        modifier = Modifier.size(14.dp)
                                                    )
                                                    Spacer(modifier = Modifier.width(6.dp))
                                                }
                                                Text(
                                                    text = sortOpt.title,
                                                    fontWeight = if (currentSortOption == sortOpt) FontWeight.Bold else FontWeight.Normal,
                                                    fontSize = 12.sp,
                                                    color = if (currentSortOption == sortOpt) PrimaryBlue else MaterialTheme.colorScheme.onSurface
                                                )
                                            }
                                        },
                                        onClick = {
                                            currentSortOption = sortOpt
                                            showSortMenu = false
                                        }
                                    )
                                }
                            }
                        }

                        // Filtreleri Temizle veya Toplam Bilgisi
                        val isFilterActive = selectedBadgeFilter != null ||
                            selectedStatusFilter != HrAttendanceStatusFilter.ALL ||
                            searchQuery.isNotEmpty() ||
                            currentSortOption != HrEmployeeSortOption.LATE_DESC

                        if (isFilterActive) {
                            TextButton(
                                onClick = {
                                    selectedBadgeFilter = null
                                    selectedStatusFilter = HrAttendanceStatusFilter.ALL
                                    searchQuery = ""
                                    currentSortOption = HrEmployeeSortOption.LATE_DESC
                                }
                            ) {
                                Text("Filtreleri Sıfırla", fontSize = 11.sp, color = OutOfRangeRed)
                            }
                        } else {
                            Text(
                                text = "${filteredEmployees.size} personel",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    // 1. Rozet Filtreleri (Elmas, Altın, Gümüş, Bronz)
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        item {
                            FilterChip(
                                selected = selectedBadgeFilter == null,
                                onClick = { selectedBadgeFilter = null },
                                label = { Text("Tüm Rozetler", fontSize = 11.sp) }
                            )
                        }
                        item {
                            FilterChip(
                                selected = selectedBadgeFilter == BadgeTier.DIAMOND,
                                onClick = { selectedBadgeFilter = if (selectedBadgeFilter == BadgeTier.DIAMOND) null else BadgeTier.DIAMOND },
                                label = { Text("💎 Elmas ($diamondCount)", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                        }
                        item {
                            FilterChip(
                                selected = selectedBadgeFilter == BadgeTier.GOLD,
                                onClick = { selectedBadgeFilter = if (selectedBadgeFilter == BadgeTier.GOLD) null else BadgeTier.GOLD },
                                label = { Text("🥇 Altın ($goldCount)", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                        }
                        item {
                            FilterChip(
                                selected = selectedBadgeFilter == BadgeTier.SILVER,
                                onClick = { selectedBadgeFilter = if (selectedBadgeFilter == BadgeTier.SILVER) null else BadgeTier.SILVER },
                                label = { Text("🥈 Gümüş ($silverCount)", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                        }
                        item {
                            FilterChip(
                                selected = selectedBadgeFilter == BadgeTier.BRONZE,
                                onClick = { selectedBadgeFilter = if (selectedBadgeFilter == BadgeTier.BRONZE) null else BadgeTier.BRONZE },
                                label = { Text("🥉 Bronz ($bronzeCount)", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                        }
                    }

                    // 2. Mesai & Rapor Durum Filtreleri (Gecikenler, Ek Mesai, Net Açık, İhlaller)
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        HrAttendanceStatusFilter.values().forEach { statusOpt ->
                            val isSelected = selectedStatusFilter == statusOpt
                            item {
                                FilterChip(
                                    selected = isSelected,
                                    onClick = { selectedStatusFilter = if (isSelected) HrAttendanceStatusFilter.ALL else statusOpt },
                                    label = {
                                        val count = when (statusOpt) {
                                            HrAttendanceStatusFilter.ALL -> employees.size
                                            HrAttendanceStatusFilter.WITH_LATE -> lateCount
                                            HrAttendanceStatusFilter.WITH_OVERTIME -> overtimeCount
                                            HrAttendanceStatusFilter.NEGATIVE_BALANCE -> negativeCount
                                            HrAttendanceStatusFilter.POSITIVE_BALANCE -> positiveCount
                                            HrAttendanceStatusFilter.WITH_VIOLATION -> violationCount
                                        }
                                        Text("${statusOpt.title} ($count)", fontSize = 11.sp)
                                    }
                                )
                            }
                        }
                    }
                }
            }

            // Personel Listesi veya Boş Durum
            if (filteredEmployees.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 40.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (searchQuery.isNotEmpty())
                                "\"$searchQuery\" ile eşleşen personel bulunamadı."
                            else
                                "Kayıtlı personel bulunamadı.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 13.sp
                        )
                    }
                }
            } else {
                items(filteredEmployees, key = { it.id }) { emp ->
                    val branch = branches.find { it.id == emp.branchId }
                    val stats = employeeStatsMap[emp.id]
                    EmployeeItemCard(
                        employee = emp,
                        branchName = branch?.name ?: "Şube Atanmamış",
                        stats = stats,
                        onViewReport = {
                            viewModel.openEmployeeReport(emp)
                        },
                        onEdit = {
                            editingEmployee = emp
                            showDialog = true
                        },
                        onDelete = {
                            employeeToDelete = emp
                        }
                    )
                }
            }

            // FAB altında boşluk
            item {
                Spacer(modifier = Modifier.height(72.dp))
            }
        }

        ExtendedFloatingActionButton(
            expanded = !isScrolled,
            onClick = {
                editingEmployee = null
                showDialog = true
            },
            icon = { Icon(Icons.Default.Add, contentDescription = "Yeni Personel") },
            text = { Text("Personel Ekle", fontWeight = FontWeight.Bold) },
            containerColor = PrimaryBlue,
            contentColor = Color.White,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp)
        )
    }

    // Personel Ekle / Düzenle Dialog
    if (showDialog) {
        EmployeeFormDialog(
            initialEmployee = editingEmployee,
            branches = branches,
            onDismiss = {
                showDialog = false
                editingEmployee = null
            },
            onSave = { id, code, pass, branchId, name, dept, title, role, phone ->
                viewModel.saveOrUpdateEmployee(
                    id = id,
                    employeeCode = code,
                    password = pass,
                    branchId = branchId,
                    fullName = name,
                    department = dept,
                    title = title,
                    role = role,
                    phone = phone
                )
                showDialog = false
                editingEmployee = null
            }
        )
    }

    // Silme Onay Dialog
    employeeToDelete?.let { emp ->
        AlertDialog(
            onDismissRequest = { employeeToDelete = null },
            title = { Text("Personeli Sil") },
            text = { Text("${emp.fullName} (${emp.employeeCode}) personeli veritabanından silinsin mi?") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteEmployee(emp.id)
                        employeeToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Sil", color = Color.White)
                }
            },
            dismissButton = {
                TextButton(onClick = { employeeToDelete = null }) {
                    Text("İptal")
                }
            }
        )
    }
}

@Composable
fun EmployeeItemCard(
    employee: EmployeeEntity,
    branchName: String,
    stats: EmployeeAttendanceStats? = null,
    onViewReport: () -> Unit = {},
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    var showPassword by remember { mutableStateOf(false) }

    OutlinedCard(
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onViewReport() }
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .background(PrimaryBlue.copy(alpha = 0.12f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Person, contentDescription = null, tint = PrimaryBlue)
            }

            Spacer(modifier = Modifier.width(10.dp))

            Column(modifier = Modifier.weight(1f)) {
                // Ad Soyad, Rol ve Aylık Başarı Rozeti
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = employee.fullName,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Box(
                        modifier = Modifier
                            .background(
                                color = when (employee.role) {
                                    "HR" -> Color(0xFF059669)
                                    "IT" -> Color(0xFF7C3AED)
                                    else -> PrimaryBlue
                                },
                                shape = RoundedCornerShape(4.dp)
                            )
                            .padding(horizontal = 5.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = employee.role,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }

                    // Rozet Madalyası
                    stats?.badgeTier?.let { tier ->
                        Spacer(modifier = Modifier.width(4.dp))
                        Box(
                            modifier = Modifier
                                .background(
                                    color = Color(tier.containerBgHex),
                                    shape = RoundedCornerShape(4.dp)
                                )
                                .border(1.dp, Color(tier.primaryColorHex).copy(alpha = 0.4f), RoundedCornerShape(4.dp))
                                .padding(horizontal = 5.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "${tier.medalEmoji} ${tier.title}",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(tier.primaryColorHex)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "Sicil No: ${employee.employeeCode} • ${employee.title}",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "${employee.department} • $branchName",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = PrimaryBlue
                )

                // İK Rapor Metrik Hapları (Gecikme, Ek Mesai, Net Denge, İhlal)
                if (stats != null) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Gecikme Hapı
                        if (stats.totalLateMinutes > 0) {
                            Box(
                                modifier = Modifier
                                    .background(OutOfRangeRed.copy(alpha = 0.12f), RoundedCornerShape(4.dp))
                                    .padding(horizontal = 5.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = "⚠️ ${stats.totalLateMinutes}dk geç",
                                    fontSize = 10.sp,
                                    color = OutOfRangeRed,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        // Ek Mesai Hapı
                        if (stats.totalOvertimeMinutes > 0) {
                            Box(
                                modifier = Modifier
                                    .background(PrimaryBlue.copy(alpha = 0.12f), RoundedCornerShape(4.dp))
                                    .padding(horizontal = 5.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = "⭐ ${stats.totalOvertimeMinutes}dk ek",
                                    fontSize = 10.sp,
                                    color = PrimaryBlue,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        // Net Denge Hapı
                        val isNetPositive = stats.netBalanceMinutes >= 0
                        Box(
                            modifier = Modifier
                                .background(
                                    if (isNetPositive) InRangeGreen.copy(alpha = 0.12f) else OutOfRangeRed.copy(alpha = 0.12f),
                                    RoundedCornerShape(4.dp)
                                )
                                .padding(horizontal = 5.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "Net: ${if (isNetPositive) "+" else ""}${stats.netBalanceMinutes}dk",
                                fontSize = 10.sp,
                                color = if (isNetPositive) InRangeGreen else OutOfRangeRed,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        // İhlal Hapı
                        if (stats.violationCount > 0) {
                            Box(
                                modifier = Modifier
                                    .background(OutOfRangeRed.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                                    .padding(horizontal = 5.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = "🚨 ${stats.violationCount} ihlal",
                                    fontSize = 10.sp,
                                    color = OutOfRangeRed,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Şifre: ${if (showPassword) employee.password else "••••••"}",
                        fontSize = 11.sp,
                        color = Color.DarkGray
                    )
                    IconButton(
                        onClick = { showPassword = !showPassword },
                        modifier = Modifier.size(20.dp)
                    ) {
                        Icon(
                            imageVector = if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = "Şifreyi Göster",
                            modifier = Modifier.size(13.dp)
                        )
                    }
                }
            }

            // İşlem Butonları (Rapor, Düzenle, Sil)
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Row(
                    modifier = Modifier
                        .background(PrimaryBlue.copy(alpha = 0.10f), RoundedCornerShape(6.dp))
                        .clickable { onViewReport() }
                        .padding(horizontal = 7.dp, vertical = 3.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Assessment,
                        contentDescription = "Rapor",
                        tint = PrimaryBlue,
                        modifier = Modifier.size(12.dp)
                    )
                    Spacer(modifier = Modifier.width(3.dp))
                    Text(
                        text = "Rapor",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = PrimaryBlue
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(
                        onClick = onEdit,
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(Icons.Default.Edit, contentDescription = "Düzenle", tint = PrimaryBlue, modifier = Modifier.size(16.dp))
                    }
                    IconButton(
                        onClick = onDelete,
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(Icons.Default.Delete, contentDescription = "Sil", tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(16.dp))
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmployeeFormDialog(
    initialEmployee: EmployeeEntity?,
    branches: List<BranchEntity>,
    onDismiss: () -> Unit,
    onSave: (Long, String, String, Long, String, String, String, String, String) -> Unit
) {
    var fullName by remember { mutableStateOf(initialEmployee?.fullName ?: "") }
    var employeeCode by remember { mutableStateOf(initialEmployee?.employeeCode ?: "") }
    var password by remember { mutableStateOf(initialEmployee?.password ?: "123456") }
    var department by remember { mutableStateOf(initialEmployee?.department ?: "Portföy Yönetimi") }
    var title by remember { mutableStateOf(initialEmployee?.title ?: "Müşteri Temsilcisi") }
    var phone by remember { mutableStateOf(initialEmployee?.phone ?: "+90 532 555 0100") }
    var selectedBranchId by remember { mutableLongStateOf(initialEmployee?.branchId ?: (branches.firstOrNull()?.id ?: 1L)) }
    var selectedRole by remember { mutableStateOf(initialEmployee?.role ?: "PERSONNEL") }

    var branchDropdownExpanded by remember { mutableStateOf(false) }
    var roleDropdownExpanded by remember { mutableStateOf(false) }

    val selectedBranchName = branches.find { it.id == selectedBranchId }?.name ?: "Şube Seçiniz"

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = if (initialEmployee == null) "Yeni Personel Tanımla" else "Personel Bilgilerini Düzenle",
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = fullName,
                    onValueChange = { fullName = it },
                    label = { Text("Ad Soyad") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = employeeCode,
                    onValueChange = { employeeCode = it },
                    label = { Text("Sicil No (Örn: FN-1088)") },
                    leadingIcon = { Icon(Icons.Default.Badge, contentDescription = null) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Giriş Şifresi") },
                    leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Şube Seçimi Dropdown
                ExposedDropdownMenuBox(
                    expanded = branchDropdownExpanded,
                    onExpandedChange = { branchDropdownExpanded = !branchDropdownExpanded }
                ) {
                    OutlinedTextField(
                        value = selectedBranchName,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Görevli Şube") },
                        leadingIcon = { Icon(Icons.Default.Business, contentDescription = null) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = branchDropdownExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                    )
                    ExposedDropdownMenu(
                        expanded = branchDropdownExpanded,
                        onDismissRequest = { branchDropdownExpanded = false }
                    ) {
                        branches.forEach { b ->
                            DropdownMenuItem(
                                text = { Text(b.name) },
                                onClick = {
                                    selectedBranchId = b.id
                                    branchDropdownExpanded = false
                                }
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = department,
                    onValueChange = { department = it },
                    label = { Text("Departman") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Unvan") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Rol Seçimi
                ExposedDropdownMenuBox(
                    expanded = roleDropdownExpanded,
                    onExpandedChange = { roleDropdownExpanded = !roleDropdownExpanded }
                ) {
                    OutlinedTextField(
                        value = when (selectedRole) {
                            "HR" -> "İK Yetkilisi (HR)"
                            "IT" -> "BT / Sistem Yöneticisi (IT)"
                            else -> "Şube Personeli (PERSONNEL)"
                        },
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Erişim Rolü") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = roleDropdownExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                    )
                    ExposedDropdownMenu(
                        expanded = roleDropdownExpanded,
                        onDismissRequest = { roleDropdownExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Şube Personeli (PERSONNEL)") },
                            onClick = {
                                selectedRole = "PERSONNEL"
                                roleDropdownExpanded = false
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("İK Yetkilisi (HR)") },
                            onClick = {
                                selectedRole = "HR"
                                roleDropdownExpanded = false
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("BT / Sistem Yöneticisi (IT)") },
                            onClick = {
                                selectedRole = "IT"
                                roleDropdownExpanded = false
                            }
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (fullName.isNotBlank() && employeeCode.isNotBlank() && password.isNotBlank()) {
                        onSave(
                            initialEmployee?.id ?: 0L,
                            employeeCode,
                            password,
                            selectedBranchId,
                            fullName,
                            department,
                            title,
                            selectedRole,
                            phone
                        )
                    }
                },
                enabled = fullName.isNotBlank() && employeeCode.isNotBlank() && password.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
            ) {
                Text("Veritabanına Kaydet", color = Color.White)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Vazgeç")
            }
        }
    )
}
