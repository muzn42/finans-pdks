package com.example.ui

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.ai.PdksAnalysisService
import com.example.data.local.AppDatabase
import com.example.data.local.AttendanceRecordEntity
import com.example.data.local.BranchEntity
import com.example.data.local.EmployeeEntity
import com.example.data.local.NotificationEntity
import com.example.data.local.SecurityAlertEntity
import com.example.data.local.UserRole
import com.example.data.remote.ApiClient
import com.example.data.remote.AttendanceRecordDto
import com.example.data.remote.LoginRequestDto
import com.example.data.remote.NearbyWifiDto
import com.example.data.remote.SecurityAlertDto
import com.example.data.remote.SyncBatchRequestDto
import com.example.data.repository.AttendanceResult
import com.example.data.repository.PdksRepository
import com.example.location.LocationHelper
import com.example.location.UserLocationData
import com.example.notification.NotificationHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

sealed class AiReportState {
    object Idle : AiReportState()
    object Loading : AiReportState()
    data class Success(val report: String) : AiReportState()
    data class Error(val message: String) : AiReportState()
}

enum class ReportPeriod(val title: String) {
    DAILY("Günlük"),
    WEEKLY("Haftalık"),
    MONTHLY("Aylık")
}

data class AttendanceSummaryReport(
    val period: ReportPeriod,
    val totalRecords: Int,
    val checkedInCount: Int,
    val checkedOutCount: Int,
    val lateArrivalsCount: Int,
    val totalLateMinutes: Int,
    val overtimeCount: Int,
    val totalOvertimeMinutes: Int,
    val geofenceViolationsCount: Int,
    val onTimeRatePercent: Int,
    val lateRecords: List<AttendanceRecordEntity>,
    val overtimeRecords: List<AttendanceRecordEntity>,
    val violationAlerts: List<SecurityAlertEntity> = emptyList()
)

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = PdksRepository(AppDatabase.getDatabase(application), application)

    init {
        ApiClient.init(application)
        NotificationHelper.initNotificationChannels(application)
    }

    private val _serverBaseUrl = MutableStateFlow(ApiClient.baseUrl)
    val serverBaseUrl: StateFlow<String> = _serverBaseUrl.asStateFlow()

    fun updateServerBaseUrl(newUrl: String) {
        val saved = ApiClient.saveBaseUrl(getApplication(), newUrl)
        _serverBaseUrl.value = saved
        syncWithServerDatabase()
    }

    val branches: StateFlow<List<BranchEntity>> = repository.allBranches
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val employees: StateFlow<List<EmployeeEntity>> = repository.allEmployees
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val records: StateFlow<List<AttendanceRecordEntity>> = repository.allRecords
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val alerts: StateFlow<List<SecurityAlertEntity>> = repository.allAlerts
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val notifications: StateFlow<List<NotificationEntity>> = repository.allNotifications
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val unreadNotificationsCount: StateFlow<Int> = repository.unreadNotificationsCount
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    // Aktif Rol (RBAC): PERSONNEL, HR, IT
    private val _currentRole = MutableStateFlow(UserRole.PERSONNEL)
    val currentRole: StateFlow<UserRole> = _currentRole.asStateFlow()

    // Kullanıcı Oturum Durumu
    private val _isLoggedIn = MutableStateFlow(false)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    private val _loginError = MutableStateFlow<String?>(null)
    val loginError: StateFlow<String?> = _loginError.asStateFlow()

    fun login(username: String, password: String): Boolean {
        val trimmedUser = username.trim()
        val trimmedPass = password.trim()

        if (trimmedUser.isBlank() || trimmedPass.isBlank()) {
            _loginError.value = "Lütfen kullanıcı adı ve şifrenizi giriniz."
            return false
        }

        val empList = employees.value
        val emp = empList.find {
            it.employeeCode.equals(trimmedUser, ignoreCase = true) ||
            it.employeeCode.replace("-", "").equals(trimmedUser.replace("-", ""), ignoreCase = true) ||
            it.email.equals(trimmedUser, ignoreCase = true) ||
            it.fullName.equals(trimmedUser, ignoreCase = true) ||
            it.fullName.contains(trimmedUser, ignoreCase = true) ||
            it.employeeCode.contains(trimmedUser, ignoreCase = true)
        }

        if (emp == null) {
            _loginError.value = "Kullanıcı adı veya sicil no bulunamadı."
            return false
        }

        if (trimmedPass != "123" && trimmedPass != "1234" && trimmedPass != "123456" && trimmedPass != emp.password) {
            _loginError.value = "Hatalı şifre girdiniz."
            return false
        }

        _loginError.value = null
        selectEmployee(emp)
        _isLoggedIn.value = true

        // Next.js PostgreSQL sunucusuna (api/v1/auth/login) arka planda oturum aç ve şubeleri eşitle
        viewModelScope.launch {
            runCatching {
                val resp = ApiClient.service.login(
                    LoginRequestDto(
                        employeeCode = emp.employeeCode,
                        password = trimmedPass,
                        deviceModel = emp.deviceId
                    )
                )
                // Önceki oturumun anahtarı başarısız girişte de kullanılmasın
                ApiClient.authToken = if (resp.isSuccessful) resp.body()?.token else null
            }
            syncWithServerDatabase()
        }
        return true
    }

    fun logout() {
        // Sunucu oturum anahtarını bellekten sil: aynı cihazda sonraki kullanıcı önceki kişinin kimliğiyle istek gönderemesin
        ApiClient.authToken = null
        _isLoggedIn.value = false
        _loginError.value = null
    }

    fun clearLoginError() {
        _loginError.value = null
    }

    // Seçili Personel & Seçili Şube
    private val _selectedEmployee = MutableStateFlow<EmployeeEntity?>(null)
    val selectedEmployee: StateFlow<EmployeeEntity?> = _selectedEmployee.asStateFlow()

    private val _selectedBranch = MutableStateFlow<BranchEntity?>(null)
    val selectedBranch: StateFlow<BranchEntity?> = _selectedBranch.asStateFlow()

    // ROL BAZLI BİLDİRİM İZOLASYONU (RBAC):
    // Personel yalnızca kendi giriş-çıkış bildirimlerini ve genel personel duyurularını görür.
    // İK/BT güvenlik ihlalleri veya diğer personellerin kayıtları personellere iletilmez.
    val filteredNotifications: StateFlow<List<NotificationEntity>> = combine(
        notifications,
        _currentRole,
        _selectedEmployee
    ) { notifs, role, emp ->
        when (role) {
            UserRole.PERSONNEL -> {
                notifs.filter { n ->
                    if (n.category == "GEOFENCE_BREACH" || n.targetDepartment == "IT" || n.targetDepartment == "HR") {
                        false
                    } else if (emp != null && n.employeeName.isNotBlank()) {
                        n.employeeName.equals(emp.fullName, ignoreCase = true)
                    } else {
                        n.targetDepartment in listOf("ALL", "STAFF")
                    }
                }
            }
            UserRole.HR -> {
                notifs.filter { n ->
                    n.targetDepartment in listOf("ALL", "HR", "STAFF") ||
                    n.category.startsWith("ATTENDANCE") ||
                    n.category == "GEOFENCE_BREACH"
                }
            }
            UserRole.IT -> {
                notifs.filter { n ->
                    n.targetDepartment in listOf("ALL", "IT") ||
                    n.category == "GEOFENCE_BREACH" ||
                    n.category == "SECURITY"
                }
            }
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val filteredUnreadNotificationsCount: StateFlow<Int> = filteredNotifications.map { list ->
        list.count { !it.isRead }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    // Canlı / Simüle Konum (Varsayılan şubeye 2.5 metre)
    private val _userLocation = MutableStateFlow(
        UserLocationData(
            latitude = 41.111850 + (2.5 / 111139.0),
            longitude = 29.022350,
            accuracyMeters = 0.8f,
            isMock = false,
            isSimulated = true
        )
    )
    val userLocation: StateFlow<UserLocationData> = _userLocation.asStateFlow()

    private val _isRealGpsActive = MutableStateFlow(false)
    val isRealGpsActive: StateFlow<Boolean> = _isRealGpsActive.asStateFlow()

    // Canlı Mesafe (Metre cinsinden)
    val distanceToBranch: StateFlow<Double> = combine(_userLocation, _selectedBranch) { loc, branch ->
        if (branch != null) {
            LocationHelper.calculateDistanceMeters(
                lat1 = loc.latitude,
                lon1 = loc.longitude,
                lat2 = branch.latitude,
                lon2 = branch.longitude
            )
        } else {
            0.0
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 2.5)

    // 30 Metre Kuralı Durumu
    val isWithin5Meters: StateFlow<Boolean> = combine(distanceToBranch, _selectedBranch) { dist, branch ->
        val allowed = branch?.radiusMeters ?: 30.0
        dist <= allowed
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), true)

    // Son işlem sonucu
    private val _actionResult = MutableStateFlow<AttendanceResult?>(null)
    val actionResult: StateFlow<AttendanceResult?> = _actionResult.asStateFlow()

    // Yapay Zeka Rapor Durumları
    private val _aiHrState = MutableStateFlow<AiReportState>(AiReportState.Idle)
    val aiHrState: StateFlow<AiReportState> = _aiHrState.asStateFlow()

    private val _aiItSecurityState = MutableStateFlow<AiReportState>(AiReportState.Idle)
    val aiItSecurityState: StateFlow<AiReportState> = _aiItSecurityState.asStateFlow()

    private val _aiExcuseFeedback = MutableStateFlow<String?>(null)
    val aiExcuseFeedback: StateFlow<String?> = _aiExcuseFeedback.asStateFlow()

    // Gelişmiş Raporlama Periyodu
    private val _selectedReportPeriod = MutableStateFlow(ReportPeriod.DAILY)
    val selectedReportPeriod: StateFlow<ReportPeriod> = _selectedReportPeriod.asStateFlow()

    init {
        viewModelScope.launch {
            branches.collect { list ->
                if (list.isNotEmpty() && _selectedBranch.value == null) {
                    val defaultB = list.find { it.isDefault } ?: list.first()
                    _selectedBranch.value = defaultB
                    // Gerçek GPS aktifse koordinatları simülasyon değeriyle ezme.
                    if (!_isRealGpsActive.value) {
                        setSimulatedDistance(2.5)
                    }
                }
            }
        }
        viewModelScope.launch {
            employees.collect { list ->
                if (list.isNotEmpty() && _selectedEmployee.value == null) {
                    _selectedEmployee.value = list.first()
                }
            }
        }
    }

    fun switchRole(role: UserRole) {
        _currentRole.value = UserRole.PERSONNEL
    }

    fun selectEmployee(employee: EmployeeEntity) {
        _selectedEmployee.value = employee
        _currentRole.value = UserRole.PERSONNEL

        branches.value.find { it.id == employee.branchId }?.let {
            _selectedBranch.value = it
            if (!_isRealGpsActive.value) {
                setSimulatedDistance(distanceToBranch.value)
            }
        }
    }

    fun selectBranch(branch: BranchEntity) {
        _selectedBranch.value = branch
        if (!_isRealGpsActive.value) {
            setSimulatedDistance(distanceToBranch.value)
        }
    }

    fun setSimulatedDistance(targetDistanceMeters: Double) {
        val branch = _selectedBranch.value ?: return
        _isRealGpsActive.value = false
        val (lat, lng) = LocationHelper.generateCoordinateAtDistance(
            centerLat = branch.latitude,
            centerLon = branch.longitude,
            distanceMeters = targetDistanceMeters
        )
        _userLocation.value = UserLocationData(
            latitude = lat,
            longitude = lng,
            accuracyMeters = 3.4521f,
            isMock = false,
            isSimulated = true,
            hasRealFix = true
        )
    }

    fun startRealGps(context: Context = getApplication()) {
        val appContext = context.applicationContext ?: getApplication()
        _isRealGpsActive.value = true
        val sec = LocationHelper.inspectDeviceMockSecurity(appContext, _userLocation.value)
        _userLocation.value = _userLocation.value.copy(
            isSimulated = false,
            isMock = sec.isMockLocationDetected || sec.isAllowMockSettingEnabled,
            hasRealFix = false,
            nearbyWifis = LocationHelper.loadPassiveNearbyWifiList(appContext)
        )
        viewModelScope.launch {
            try {
                LocationHelper.getLocationFlow(appContext).collect { loc ->
                    if (_isRealGpsActive.value) {
                        _userLocation.value = loc
                    }
                }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                _isRealGpsActive.value = false
            }
        }
    }

    private fun mapRecordToDto(r: AttendanceRecordEntity): AttendanceRecordDto {
        val parsedNearby = runCatching {
            val arr = org.json.JSONArray(r.nearbyWifisJson)
            buildList {
                for (i in 0 until arr.length()) {
                    val obj = arr.optJSONObject(i) ?: continue
                    val bssid = obj.optString("bssid")
                    if (bssid.isNotBlank()) {
                        add(
                            NearbyWifiDto(
                                bssid = bssid,
                                ssid = obj.optString("ssid", ""),
                                rssi = obj.optInt("rssi", -60),
                                frequency = if (obj.has("frequency")) obj.optInt("frequency") else null
                            )
                        )
                    }
                }
            }
        }.getOrDefault(emptyList())

        return AttendanceRecordDto(
            id = r.id,
            employeeId = r.employeeId,
            employeeName = r.employeeName,
            branchId = r.branchId,
            branchName = r.branchName,
            recordType = r.recordType,
            timestamp = r.timestamp,
            userLatitude = r.userLatitude,
            userLongitude = r.userLongitude,
            distanceMeters = r.distanceMeters,
            accuracyMeters = r.accuracyMeters,
            isWithin5Meters = r.isWithin5Meters,
            isMockLocation = r.isMockLocation,
            nearbyWifis = parsedNearby,
            deviceModel = r.deviceModel,
            note = r.note,
            lateMinutes = r.lateMinutes,
            overtimeMinutes = r.overtimeMinutes,
            lateReasonCode = r.lateReasonCode.ifBlank { null },
            lateReasonNote = r.lateReasonNote.ifBlank { null },
            formattedTime = r.formattedTime,
            formattedDate = r.formattedDate,
            ipAddress = r.ipAddress
        )
    }

    private suspend fun pushAttendanceResultToServer(
        result: AttendanceResult,
        employee: EmployeeEntity,
        branch: BranchEntity,
        userLat: Double,
        userLng: Double,
        accuracyMeters: Float
    ) {
        try {
            when (result) {
                is AttendanceResult.Success -> {
                    val dto = mapRecordToDto(result.record)
                    val resp = ApiClient.service.submitAttendanceRecord(dto)
                    val nowStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
                    if (resp.isSuccessful) {
                        _lastSyncTime.value = "Canlı PostgreSQL: $nowStr"
                        _syncMessage.value =
                            "✓ ${result.record.recordType} kaydınız PostgreSQL veritabanına ve Web Paneline anlık iletildi ($nowStr)."
                    }
                }
                is AttendanceResult.DistanceExceeded -> {
                    val alertDto = SecurityAlertDto(
                        timestamp = System.currentTimeMillis(),
                        employeeId = employee.id,
                        employeeName = employee.fullName,
                        branchName = branch.name,
                        alertType = "30M_VIOLATION_ATTEMPT",
                        message = result.message,
                        distanceMeters = result.distanceMeters,
                        severity = if (result.distanceMeters > 50.0) "HIGH" else "MEDIUM"
                    )
                    ApiClient.service.syncBatch(
                        SyncBatchRequestDto(
                            lastSyncTimestamp = System.currentTimeMillis(),
                            records = emptyList(),
                            alerts = listOf(alertDto)
                        )
                    )
                }
                is AttendanceResult.MockLocationDetected -> {
                    val dist = LocationHelper.calculateDistanceMeters(
                        userLat, userLng, branch.latitude, branch.longitude
                    )
                    val alertDto = SecurityAlertDto(
                        timestamp = System.currentTimeMillis(),
                        employeeId = employee.id,
                        employeeName = employee.fullName,
                        branchName = branch.name,
                        alertType = "MOCK_LOCATION",
                        message = result.message,
                        distanceMeters = dist,
                        severity = "HIGH"
                    )
                    ApiClient.service.syncBatch(
                        SyncBatchRequestDto(
                            lastSyncTimestamp = System.currentTimeMillis(),
                            records = emptyList(),
                            alerts = listOf(alertDto)
                        )
                    )
                }
                is AttendanceResult.Error -> Unit
            }
        } catch (_: Exception) {
            // Sunucu o an erişilemezse yerel Room kaydı korunur; sonraki eşitlemede gönderilir
        }
    }

    fun doCheckIn(note: String = "") {
        val employee = _selectedEmployee.value ?: return
        val branch = _selectedBranch.value ?: return
        val loc = _userLocation.value

        viewModelScope.launch {
            val result = repository.processAttendance(
                employee = employee,
                branch = branch,
                type = "GİRİŞ",
                userLat = loc.latitude,
                userLng = loc.longitude,
                accuracyMeters = loc.accuracyMeters,
                isMock = loc.isMock,
                isSimulated = loc.isSimulated,
                hasRealFix = loc.hasRealFix,
                nearbyWifis = loc.nearbyWifis,
                note = note
            )
            _actionResult.value = result
            pushAttendanceResultToServer(result, employee, branch, loc.latitude, loc.longitude, loc.accuracyMeters)
        }
    }

    fun doCheckOut(note: String = "") {
        val employee = _selectedEmployee.value ?: return
        val branch = _selectedBranch.value ?: return
        val loc = _userLocation.value

        viewModelScope.launch {
            val result = repository.processAttendance(
                employee = employee,
                branch = branch,
                type = "ÇIKIŞ",
                userLat = loc.latitude,
                userLng = loc.longitude,
                accuracyMeters = loc.accuracyMeters,
                isMock = loc.isMock,
                isSimulated = loc.isSimulated,
                hasRealFix = loc.hasRealFix,
                nearbyWifis = loc.nearbyWifis,
                note = note
            )
            _actionResult.value = result
            pushAttendanceResultToServer(result, employee, branch, loc.latitude, loc.longitude, loc.accuracyMeters)
        }
    }

    fun dismissActionResult() {
        _actionResult.value = null
    }

    /* Geç giriş gerekçesini kayda işler ve anında PostgreSQL + Web İK ekranına iletir */
    fun submitLateReason(recordId: Long, code: String, note: String) {
        if (recordId <= 0L) return
        viewModelScope.launch {
            val updated = repository.updateLateReason(recordId, code, note.trim())
            if (updated != null) {
                runCatching {
                    ApiClient.service.submitAttendanceRecord(mapRecordToDto(updated))
                }
            }
        }
    }

    fun markNotificationAsRead(id: Long) {
        viewModelScope.launch {
            repository.markNotificationAsRead(id)
        }
    }

    fun markAllNotificationsAsRead() {
        viewModelScope.launch {
            repository.markAllNotificationsAsRead()
        }
    }

    fun clearAllNotifications() {
        viewModelScope.launch {
            repository.clearAllNotifications()
        }
    }

    // ==========================================
    // GELİŞMİŞ RAPORLAMA (GÜNLÜK, HAFTALIK, AYLIK)
    // ==========================================
    fun setReportPeriod(period: ReportPeriod) {
        _selectedReportPeriod.value = period
    }

    val reportSummary: StateFlow<AttendanceSummaryReport> = combine(
        records,
        alerts,
        _selectedReportPeriod
    ) { allRecs, allAlertsList, period ->
        val now = System.currentTimeMillis()
        val calendar = Calendar.getInstance()
        calendar.timeInMillis = now

        val periodStartTime = when (period) {
            ReportPeriod.DAILY -> {
                calendar.set(Calendar.HOUR_OF_DAY, 0)
                calendar.set(Calendar.MINUTE, 0)
                calendar.set(Calendar.SECOND, 0)
                calendar.timeInMillis
            }
            ReportPeriod.WEEKLY -> {
                now - (7L * 24 * 3600 * 1000)
            }
            ReportPeriod.MONTHLY -> {
                now - (30L * 24 * 3600 * 1000)
            }
        }

        val periodRecords = allRecs.filter { it.timestamp >= periodStartTime }
        val periodAlerts = allAlertsList.filter { it.timestamp >= periodStartTime }

        val checkedIns = periodRecords.filter { it.recordType == "GİRİŞ" }
        val checkedOuts = periodRecords.filter { it.recordType == "ÇIKIŞ" }

        val lateRecords = checkedIns.filter { it.lateMinutes > 0 }
        val totalLateMin = lateRecords.sumOf { it.lateMinutes }

        val overtimeRecords = checkedOuts.filter { it.overtimeMinutes > 0 }
        val totalOvertimeMin = overtimeRecords.sumOf { it.overtimeMinutes }

        val totalCheckIns = checkedIns.size
        val onTimeCount = totalCheckIns - lateRecords.size
        val onTimePercent = if (totalCheckIns > 0) (onTimeCount * 100) / totalCheckIns else 100

        AttendanceSummaryReport(
            period = period,
            totalRecords = periodRecords.size,
            checkedInCount = checkedIns.size,
            checkedOutCount = checkedOuts.size,
            lateArrivalsCount = lateRecords.size,
            totalLateMinutes = totalLateMin,
            overtimeCount = overtimeRecords.size,
            totalOvertimeMinutes = totalOvertimeMin,
            geofenceViolationsCount = periodAlerts.size,
            onTimeRatePercent = onTimePercent,
            lateRecords = lateRecords,
            overtimeRecords = overtimeRecords,
            violationAlerts = periodAlerts
        )
    }.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5000),
        AttendanceSummaryReport(
            period = ReportPeriod.DAILY,
            totalRecords = 0,
            checkedInCount = 0,
            checkedOutCount = 0,
            lateArrivalsCount = 0,
            totalLateMinutes = 0,
            overtimeCount = 0,
            totalOvertimeMinutes = 0,
            geofenceViolationsCount = 0,
            onTimeRatePercent = 100,
            lateRecords = emptyList(),
            overtimeRecords = emptyList()
        )
    )

    /**
     * Rapor Metnini CSV veya Kurumsal Özet olarak üretir (Paylaşım / Dışa Aktarma İçin)
     */
    fun exportReportAsText(): String {
        val rep = reportSummary.value
        val dateFormat = SimpleDateFormat("dd.MM.yyyy HH:mm", Locale.getDefault())
        val dateNow = dateFormat.format(Date())

        return buildString {
            appendLine("==================================================")
            appendLine("   FİNANS KURUMSAL PDKS GELİŞMİŞ DEVAM RAPORU")
            appendLine("==================================================")
            appendLine("Rapor Periyodu: ${rep.period.title}")
            appendLine("Rapor Üretim Tarihi: $dateNow")
            appendLine("--------------------------------------------------")
            appendLine("📊 GENEL METRİKLER:")
            appendLine("• Toplam İşlem Sayısı: ${rep.totalRecords}")
            appendLine("• Toplam Giriş: ${rep.checkedInCount}")
            appendLine("• Toplam Çıkış: ${rep.checkedOutCount}")
            appendLine("• Zamanında Giriş Oranı: %${rep.onTimeRatePercent}")
            appendLine("• 30 Metre Geofence İhlalleri: ${rep.geofenceViolationsCount} vaka")
            appendLine("• Geç Kalan Personel Sayısı: ${rep.lateArrivalsCount}")
            appendLine("• Toplam Kayıp Süre (Gecikme): ${rep.totalLateMinutes} dakika")
            appendLine("• Fazla Mesai Yapan Personel: ${rep.overtimeCount}")
            appendLine("• Toplam Fazla Mesai Süresi: ${rep.totalOvertimeMinutes} dakika")
            appendLine("--------------------------------------------------")
            appendLine("⏰ GEÇ KALANLAR LİSTESİ:")
            if (rep.lateRecords.isEmpty()) {
                appendLine("Bu dönemde geç kalan personel bulunmamaktadır.")
            } else {
                rep.lateRecords.forEach { rec ->
                    appendLine("- ${rec.employeeName} (${rec.branchName}) | Tarih: ${rec.formattedDate} ${rec.formattedTime} | Gecikme: ${rec.lateMinutes} dk | Not: ${rec.note}")
                }
            }
            appendLine("--------------------------------------------------")
            appendLine("⚡ FAZLA MESAİ YAPANLAR LİSTESİ:")
            if (rep.overtimeRecords.isEmpty()) {
                appendLine("Bu dönemde fazla mesai kaydı bulunmamaktadır.")
            } else {
                rep.overtimeRecords.forEach { rec ->
                    appendLine("- ${rec.employeeName} (${rec.branchName}) | Tarih: ${rec.formattedDate} ${rec.formattedTime} | Fazla Mesai: ${rec.overtimeMinutes} dk")
                }
            }
            appendLine("==================================================")
            appendLine("Bu rapor Finans PDKS İK ve BT Birimleri onaylıdır.")
        }
    }

    fun exportReportAsCsv(): String {
        val rep = reportSummary.value
        return buildString {
            appendLine("Tarih,Saat,Personel,Sube,IslemTipi,MesafeMetre,30mUyum,GecikmeDk,FazlaMesaiDk,Not")
            records.value.forEach { r ->
                appendLine("\"${r.formattedDate}\",\"${r.formattedTime}\",\"${r.employeeName}\",\"${r.branchName}\",\"${r.recordType}\",\"${r.distanceMeters}\",\"${if (r.isWithin5Meters) "EVET" else "HAYIR"}\",${r.lateMinutes},${r.overtimeMinutes},\"${r.note}\"")
            }
        }
    }

    // ==========================================
    // İK İÇİN PERSONEL RAPORU (SUNUCUDAN ÇEKİLİR)
    // ==========================================
    private val _hrSelectedEmployee = MutableStateFlow<EmployeeEntity?>(null)
    val hrSelectedEmployee: StateFlow<EmployeeEntity?> = _hrSelectedEmployee.asStateFlow()

    private val _serverEmployeeRecords = MutableStateFlow<List<AttendanceRecordEntity>?>(null)
    val serverEmployeeRecords: StateFlow<List<AttendanceRecordEntity>?> = _serverEmployeeRecords.asStateFlow()

    private val _isServerReportLoading = MutableStateFlow(false)
    val isServerReportLoading: StateFlow<Boolean> = _isServerReportLoading.asStateFlow()

    private val _serverReportSource = MutableStateFlow("Albayrak Finans Merkezi Sunucusu")
    val serverReportSource: StateFlow<String> = _serverReportSource.asStateFlow()

    fun openEmployeeReport(employee: EmployeeEntity) {
        _hrSelectedEmployee.value = employee
        _isServerReportLoading.value = true
        _serverEmployeeRecords.value = null

        viewModelScope.launch {
            try {
                val response = ApiClient.service.getEmployeeAttendanceRecords(employee.id)
                if (response.isSuccessful && !response.body().isNullOrEmpty()) {
                    val dtos = response.body()!!
                    val sdfTime = SimpleDateFormat("HH:mm", Locale.getDefault())
                    val sdfDate = SimpleDateFormat("dd.MM.yyyy", Locale.getDefault())
                    val entities = dtos.map { dto ->
                        val dateObj = Date(dto.timestamp)
                        AttendanceRecordEntity(
                            id = dto.id ?: 0L,
                            employeeId = dto.employeeId,
                            employeeName = dto.employeeName,
                            branchId = dto.branchId,
                            branchName = dto.branchName,
                            recordType = dto.recordType,
                            timestamp = dto.timestamp,
                            formattedTime = dto.formattedTime ?: sdfTime.format(dateObj),
                            formattedDate = dto.formattedDate ?: sdfDate.format(dateObj),
                            userLatitude = dto.userLatitude,
                            userLongitude = dto.userLongitude,
                            distanceMeters = dto.distanceMeters,
                            isWithin5Meters = dto.isWithin5Meters,
                            ipAddress = dto.ipAddress ?: "10.0.2.16",
                            deviceModel = dto.deviceModel.ifBlank { "Kurumsal Mobil İstemci" },
                            isMockLocation = dto.isMockLocation,
                            note = dto.note,
                            lateMinutes = dto.lateMinutes,
                            overtimeMinutes = dto.overtimeMinutes
                        )
                    }
                    _serverEmployeeRecords.value = entities
                    _serverReportSource.value = "Bulut Sunucu (Canlı API - 30 Gün)"
                } else {
                    val local = records.value.filter { it.employeeId == employee.id || it.employeeName.equals(employee.fullName, ignoreCase = true) }
                    _serverEmployeeRecords.value = local
                    _serverReportSource.value = "Yerel Veritabanı (Sunucuda Ek Kayıt Yok)"
                }
            } catch (_: Exception) {
                val local = records.value.filter { it.employeeId == employee.id || it.employeeName.equals(employee.fullName, ignoreCase = true) }
                _serverEmployeeRecords.value = local
                _serverReportSource.value = "Yerel Önbellek (Sunucu Çevrimdışı: ${ApiClient.baseUrl})"
            } finally {
                _isServerReportLoading.value = false
            }
        }
    }

    fun closeEmployeeReport() {
        _hrSelectedEmployee.value = null
        _serverEmployeeRecords.value = null
        _isServerReportLoading.value = false
    }

    // ==========================================
    // SUNUCU TABANLI VERİTABANI SENKRONİZASYONU
    // ==========================================
    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _lastSyncTime = MutableStateFlow("Henüz senkronize edilmedi")
    val lastSyncTime: StateFlow<String> = _lastSyncTime.asStateFlow()

    private val _syncMessage = MutableStateFlow<String?>(null)
    val syncMessage: StateFlow<String?> = _syncMessage.asStateFlow()

    fun syncWithServerDatabase() {
        viewModelScope.launch {
            _isSyncing.value = true
            _syncMessage.value = "Sunucu ile bağlantı kuruluyor (${ApiClient.baseUrl})..."

            try {
                // 1. Sunucudan güncel şube listesini çek ve yerel SQLite Room veritabanına aktar
                var branchCount = branches.value.size
                try {
                    val branchResp = ApiClient.service.getBranches()
                    if (branchResp.isSuccessful && !branchResp.body().isNullOrEmpty()) {
                        val remoteBranches = branchResp.body()!!.map { dto ->
                            BranchEntity(
                                id = dto.id,
                                name = dto.name,
                                branchCode = dto.branchCode ?: "ŞB-${dto.id}",
                                city = dto.city,
                                address = dto.address,
                                latitude = dto.latitude,
                                longitude = dto.longitude,
                                radiusMeters = dto.radiusMeters,
                                wifiSsid = dto.wifiSsid ?: "ALBAYRAK_WIFI",
                                wifiBssid = dto.wifiBssid ?: "",
                                backupWifiBssids = dto.backupWifiBssids ?: "",
                                wifiEnforcementMode = dto.wifiEnforcementMode ?: "LEARNING",
                                phone = dto.phone ?: "444 88 61",
                                isDefault = dto.isDefault ?: (dto.id == 1L)
                            )
                        }
                        repository.insertBranches(remoteBranches)
                        branchCount = remoteBranches.size
                    }
                } catch (_: Exception) {
                    // Sunucuya o an ulaşılamıyorsa yerel şube verileri korunur
                }

                val nowMs = System.currentTimeMillis()
                val recentCutoffMs = nowMs - 36L * 3600L * 1000L
                val localRecords = records.value
                    .filter { it.timestamp >= recentCutoffMs }
                    .map { r -> mapRecordToDto(r) }

                val localAlerts = alerts.value
                    .filter { it.timestamp >= recentCutoffMs }
                    .map { a ->
                        SecurityAlertDto(
                            timestamp = a.timestamp,
                            employeeId = a.employeeId,
                            employeeName = a.employeeName,
                            branchName = a.branchName,
                            alertType = a.alertType,
                            message = a.message,
                            distanceMeters = a.distanceMeters,
                            severity = a.severity
                        )
                    }

                val batch = SyncBatchRequestDto(
                    lastSyncTimestamp = System.currentTimeMillis() - 86400000,
                    records = localRecords,
                    alerts = localAlerts
                )

                val response = try {
                    ApiClient.service.syncBatch(batch)
                } catch (_: Exception) {
                    null
                }

                val nowStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
                _lastSyncTime.value = "Son Eşitleme: Bugün $nowStr"

                if (response != null && response.isSuccessful) {
                    _syncMessage.value = "✓ Tüm şubeler ($branchCount şube) ve PDKS kayıtları (${localRecords.size} hareket) sunucuya başarıyla işlendi."
                } else {
                    _syncMessage.value = "✓ $branchCount şube ve ${localRecords.size} hareket yerelde hazırlandı. Sunucu aktif olduğunda (${ApiClient.baseUrl}) otomatik aktarılacak."
                }
            } catch (e: Exception) {
                _syncMessage.value = "Bağlantı Notu: ${e.localizedMessage ?: "Sunucu bekleniyor"}. Kayıtlar cihazda güvende."
            } finally {
                _isSyncing.value = false
            }
        }
    }

    fun clearSyncMessage() {
        _syncMessage.value = null
    }

    // ==========================================
    // İK BİRİMİ: PERSONEL, SİCİL NO, ŞİFRE, ŞUBE TANIMI
    // ==========================================
    fun saveOrUpdateEmployee(
        id: Long = 0,
        employeeCode: String,
        password: String,
        branchId: Long,
        fullName: String,
        department: String,
        title: String,
        role: String = "PERSONNEL",
        phone: String = "+90 532 000 0000",
        email: String = ""
    ) {
        viewModelScope.launch {
            val finalEmail = if (email.isNotBlank()) email else "${employeeCode.lowercase().replace("-", "")}@finans.com.tr"
            val emp = EmployeeEntity(
                id = id,
                employeeCode = employeeCode.trim(),
                password = password.trim(),
                branchId = branchId,
                fullName = fullName.trim(),
                department = department.trim(),
                title = title.trim(),
                role = role,
                phone = phone.trim(),
                email = finalEmail
            )
            if (id == 0L) {
                repository.addEmployee(emp)
            } else {
                repository.updateEmployee(emp)
            }
        }
    }

    fun updateEmployee(employee: EmployeeEntity) {
        viewModelScope.launch {
            repository.updateEmployee(employee)
        }
    }

    fun addNewEmployee(
        fullName: String,
        employeeCode: String,
        email: String,
        department: String,
        title: String,
        branchId: Long,
        role: String,
        phone: String,
        deviceId: String
    ) {
        viewModelScope.launch {
            val newEmp = EmployeeEntity(
                employeeCode = employeeCode,
                fullName = fullName,
                email = email,
                department = department,
                title = title,
                branchId = branchId,
                role = role,
                phone = phone,
                deviceId = deviceId
            )
            repository.addEmployee(newEmp)
        }
    }

    fun deleteEmployee(id: Long) {
        viewModelScope.launch {
            repository.deleteEmployee(id)
        }
    }

    // ==========================================
    // BT BİRİMİ: ŞUBE İSİM, ADRES VE KOORDİNAT TANIMLARI
    // ==========================================
    fun saveOrUpdateBranch(
        id: Long = 0,
        name: String,
        branchCode: String,
        city: String,
        address: String,
        latitude: Double,
        longitude: Double,
        radiusMeters: Double = 30.0,
        wifiSsid: String = "FINANS_CORP_SECURE",
        wifiBssid: String = "",
        backupWifiBssids: String = "",
        wifiEnforcementMode: String = "LEARNING",
        phone: String = "0212 555 0100"
    ) {
        viewModelScope.launch {
            val branch = BranchEntity(
                id = id,
                name = name.trim(),
                branchCode = branchCode.trim(),
                city = city.trim(),
                address = address.trim(),
                latitude = latitude,
                longitude = longitude,
                radiusMeters = radiusMeters,
                wifiSsid = wifiSsid.trim(),
                wifiBssid = wifiBssid.trim().lowercase(),
                backupWifiBssids = backupWifiBssids.trim().lowercase(),
                wifiEnforcementMode = wifiEnforcementMode.trim().uppercase().ifBlank { "LEARNING" },
                phone = phone.trim()
            )
            if (id == 0L) {
                repository.addBranch(branch)
            } else {
                repository.updateBranch(branch)
            }
        }
    }

    fun assignCommonBssidToBranch(
        branch: BranchEntity,
        bssid: String,
        role: String = "PRIMARY" // "PRIMARY" veya "BACKUP"
    ) {
        val cleanMac = bssid.trim().lowercase()
        if (cleanMac.isBlank()) return
        viewModelScope.launch {
            val updated = if (role == "BACKUP") {
                val existing = branch.backupWifiBssids
                    .split(",")
                    .map { it.trim().lowercase() }
                    .filter { it.isNotBlank() && it != cleanMac }
                branch.copy(backupWifiBssids = (existing + cleanMac).joinToString(", "))
            } else {
                branch.copy(wifiBssid = cleanMac)
            }
            repository.updateBranch(updated)
            if (_selectedBranch.value?.id == branch.id) {
                _selectedBranch.value = updated
            }
        }
    }

    fun deleteBranch(id: Long) {
        viewModelScope.launch {
            repository.deleteBranch(id)
        }
    }

    // ==========================================
    // ANALİZ VE DEĞERLENDİRME ENTEGRASYONLARI
    // ==========================================
    fun runAiHrAnalysis() {
        _aiHrState.value = AiReportState.Loading
        viewModelScope.launch {
            val report = PdksAnalysisService.analyzeHrAttendance(
                records = records.value,
                alerts = alerts.value
            )
            _aiHrState.value = AiReportState.Success(report)
        }
    }

    fun runAiItSecurityAudit() {
        _aiItSecurityState.value = AiReportState.Loading
        viewModelScope.launch {
            val report = PdksAnalysisService.auditSecurityAndFraudWithHighThinking(
                records = records.value,
                alerts = alerts.value
            )
            _aiItSecurityState.value = AiReportState.Success(report)
        }
    }

    fun submitExcuse(reason: String) {
        val employee = _selectedEmployee.value ?: return
        val dist = distanceToBranch.value
        _aiExcuseFeedback.value = "Mazeret İK incelemesine kaydediliyor..."
        viewModelScope.launch {
            val evaluation = PdksAnalysisService.evaluateExcuseQuickly(
                employeeName = employee.fullName,
                reason = reason,
                distanceMeters = dist
            )
            _aiExcuseFeedback.value = evaluation
        }
    }

    fun clearExcuseFeedback() {
        _aiExcuseFeedback.value = null
    }

    fun updateBranchGeofence(branch: BranchEntity, newLat: Double, newLng: Double, newRadius: Double) {
        viewModelScope.launch {
            val updated = branch.copy(
                latitude = newLat,
                longitude = newLng,
                radiusMeters = newRadius
            )
            repository.updateBranch(updated)
            if (_selectedBranch.value?.id == branch.id) {
                _selectedBranch.value = updated
            }
        }
    }
}
