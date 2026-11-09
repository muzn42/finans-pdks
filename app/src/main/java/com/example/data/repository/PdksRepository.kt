package com.example.data.repository

import android.content.Context
import com.example.data.local.AppDatabase
import com.example.data.local.AttendanceRecordEntity
import com.example.data.local.BranchEntity
import com.example.data.local.EmployeeEntity
import com.example.data.local.NotificationEntity
import com.example.data.local.SecurityAlertEntity
import com.example.location.LocationHelper
import com.example.notification.NotificationHelper
import kotlinx.coroutines.flow.Flow
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

sealed class AttendanceResult {
    data class Success(val record: AttendanceRecordEntity, val message: String) : AttendanceResult()
    data class DistanceExceeded(val distanceMeters: Double, val allowedRadius: Double, val message: String) : AttendanceResult()
    data class MockLocationDetected(val message: String) : AttendanceResult()
    data class Error(val errorMessage: String) : AttendanceResult()
}

class PdksRepository(
    private val database: AppDatabase,
    private val context: Context
) {

    private val dao = database.attendanceDao()

    val allBranches: Flow<List<BranchEntity>> = dao.getAllBranches()
    val allEmployees: Flow<List<EmployeeEntity>> = dao.getAllEmployees()
    val allRecords: Flow<List<AttendanceRecordEntity>> = dao.getAllAttendanceRecords()
    val allAlerts: Flow<List<SecurityAlertEntity>> = dao.getAllSecurityAlerts()
    val allNotifications: Flow<List<NotificationEntity>> = dao.getAllNotifications()
    val unreadNotificationsCount: Flow<Int> = dao.getUnreadNotificationsCount()

    fun getRecordsForEmployee(employeeId: Long): Flow<List<AttendanceRecordEntity>> =
        dao.getRecordsForEmployee(employeeId)

    suspend fun getLastRecordForEmployee(employeeId: Long): AttendanceRecordEntity? =
        dao.getLastRecordForEmployee(employeeId)

    suspend fun updateBranch(branch: BranchEntity) {
        dao.updateBranch(branch)
    }

    suspend fun insertBranches(branches: List<BranchEntity>) {
        dao.insertBranches(branches)
    }

    suspend fun addBranch(branch: BranchEntity): Long {
        return dao.insertBranch(branch)
    }

    suspend fun deleteBranch(id: Long) {
        dao.deleteBranchById(id)
    }

    suspend fun addEmployee(employee: EmployeeEntity) {
        dao.insertEmployee(employee)
    }

    suspend fun updateEmployee(employee: EmployeeEntity) {
        dao.updateEmployee(employee)
    }

    suspend fun deleteEmployee(id: Long) {
        dao.deleteEmployeeById(id)
    }

    suspend fun markNotificationAsRead(id: Long) {
        dao.markNotificationAsRead(id)
    }

    suspend fun markAllNotificationsAsRead() {
        dao.markAllNotificationsAsRead()
    }

    suspend fun clearAllNotifications() {
        dao.clearAllNotifications()
    }

    /**
     * İşe Giriş / Çıkış İşlemini Gerçekleştirir.
     * 5 metre kuralı ve otomatik İK/BT bildirim sistemi burada işletilir.
     */
    suspend fun processAttendance(
        employee: EmployeeEntity,
        branch: BranchEntity,
        type: String, // "GİRİŞ" veya "ÇIKIŞ"
        userLat: Double,
        userLng: Double,
        isMock: Boolean,
        isSimulated: Boolean,
        note: String = ""
    ): AttendanceResult {
        val distance = LocationHelper.calculateDistanceMeters(
            lat1 = userLat,
            lon1 = userLng,
            lat2 = branch.latitude,
            lon2 = branch.longitude
        )

        val allowedRadius = branch.radiusMeters // 5.0 metre
        val isWithinAllowed = distance <= allowedRadius

        val now = System.currentTimeMillis()
        val calendar = Calendar.getInstance()
        calendar.timeInMillis = now
        val currentHour = calendar.get(Calendar.HOUR_OF_DAY)
        val currentMinute = calendar.get(Calendar.MINUTE)

        val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
        val dateFormat = SimpleDateFormat("dd.MM.yyyy", Locale.getDefault())
        val formattedTime = timeFormat.format(Date(now))
        val formattedDate = dateFormat.format(Date(now))

        // SAHTE KONUM (MOCK GPS) KESİN ENGELİ — mesafe kontrolünden ÖNCE çalışır.
        // Uygulamanın kendi demo/simülasyon modu (isSimulated) bu blokajdan muaftır.
        if (isMock && !isSimulated) {
            val mockMessage =
                "Sahte Konum (Mock GPS) Tespit Edildi: Personel (${employee.fullName}) $formattedTime itibarıyla $type işlemini sahte konumla yapmayı denedi. İşlem engellendi ve güvenlik birimlerine yüksek önem dereceli ihlal kaydı oluşturuldu."

            dao.insertSecurityAlert(
                SecurityAlertEntity(
                    timestamp = now,
                    employeeId = employee.id,
                    employeeName = employee.fullName,
                    branchName = branch.name,
                    alertType = "MOCK_LOCATION",
                    message = mockMessage,
                    distanceMeters = distance,
                    severity = "HIGH"
                )
            )

            val mockNotifTitle = "🚫 Sahte Konum Engellendi: ${employee.fullName}"
            val mockNotifMsg =
                "${employee.fullName} (${branch.name}) sahte konum (mock GPS) ile $type denemesi yaptı. İşlem anında engellendi; güvenlik ihlali olarak İK ve BT birimlerine iletildi."

            dao.insertNotification(
                NotificationEntity(
                    timestamp = now,
                    targetDepartment = "IT",
                    title = mockNotifTitle,
                    message = mockNotifMsg,
                    category = "MOCK_LOCATION",
                    employeeName = employee.fullName,
                    branchName = branch.name,
                    distanceMeters = distance
                )
            )

            NotificationHelper.postSystemNotification(
                context = context,
                notificationId = (now % 10000).toInt(),
                channelId = NotificationHelper.CHANNEL_ALERTS_ID,
                title = mockNotifTitle,
                message = mockNotifMsg,
                isAlert = true
            )

            return AttendanceResult.MockLocationDetected(
                message = "GÜVENLİK İHLALİ: Cihazınızda sahte konum (mock GPS) tespit edildi.\n\nGiriş/çıkış işlemi kesin olarak reddedildi ve durum yüksek öncelikli güvenlik ihlali olarak İK ve BT birimlerine bildirildi.\n\nLütfen konum sahteleme uygulamalarını kapatıp gerçek GPS ile tekrar deneyin."
            )
        }

        if (!isWithinAllowed) {
            // 30 METRE AŞILDI! GÜVENLİK UYARISI OLUŞTUR VE İŞLEMİ REDDET
            val excessDistance = distance - allowedRadius
            val alertMessage = "30 Metre Sınırı Aşıldı: Personel (${employee.fullName}) şube merkezine ${"%.1f".format(distance)} metre mesafeden $type yapmayı denedi. (İzin verilen: ${allowedRadius}m, Fark: +${"%.1f".format(excessDistance)}m)"

            // Güvenlik alarmı kaydet
            dao.insertSecurityAlert(
                SecurityAlertEntity(
                    timestamp = now,
                    employeeId = employee.id,
                    employeeName = employee.fullName,
                    branchName = branch.name,
                    alertType = "30M_VIOLATION_ATTEMPT",
                    message = alertMessage,
                    distanceMeters = distance,
                    severity = if (distance > 50) "HIGH" else "MEDIUM"
                )
            )

            // OTOMATİK BİLDİRİM SİSTEMİ: İK ve BT Birimlerine Acil Uyarı Bildirimi
            val notifTitle = "🚨 30M İhlal Uyarısı: ${employee.fullName}"
            val notifMsg = "${employee.fullName} (${branch.name}) ${"%.1f".format(distance)} metre mesafeden $type yapmaya çalıştı! Sistem 30 metre kuralı uyarınca işlemi durdurdu."
            dao.insertNotification(
                NotificationEntity(
                    timestamp = now,
                    targetDepartment = "IT", // BT ve İK Güvenlik Birimlerine (Personel ekranına düşmez)
                    title = notifTitle,
                    message = notifMsg,
                    category = "GEOFENCE_BREACH",
                    employeeName = employee.fullName,
                    branchName = branch.name,
                    distanceMeters = distance
                )
            )

            // Sistem bildirimini tetikle
            NotificationHelper.postSystemNotification(
                context = context,
                notificationId = (now % 10000).toInt(),
                channelId = NotificationHelper.CHANNEL_ALERTS_ID,
                title = notifTitle,
                message = notifMsg,
                isAlert = true
            )

            return AttendanceResult.DistanceExceeded(
                distanceMeters = distance,
                allowedRadius = allowedRadius,
                message = "DİKKAT: Şube konumunun ${"%.1f".format(excessDistance)} metre ötesindesiniz!\n\nŞubeye olan mesafeniz: ${"%.1f".format(distance)} metre.\nİzin verilen maksimum mesafe: ${allowedRadius} metre.\n\nGiriş veya Çıkış işlemi yapabilmek için lütfen şube sınırları (en fazla 30m) içerisine giriniz.\n\nDurum İK ve BT yöneticilerine anında iletilmiştir."
            )
        }

        // 30 METRE İÇERİSİNDE - İŞLEM ONAYLANDI
        // Mesai ve gecikme hesabı, PostgreSQL shifts tablosundan gelen personel
        // vardiyasına göre yapılır (varsayılan: 08:30 – 17:30, 5 dk tolerans).
        var lateMinutes = 0
        var overtimeMinutes = 0
        val standardStartMinutes = employee.shiftStartMin + employee.shiftGraceMin
        val standardEndMinutes = employee.shiftEndMin
        if (type == "GİRİŞ") {
            val totalMinutes = currentHour * 60 + currentMinute
            if (totalMinutes > standardStartMinutes) {
                lateMinutes = totalMinutes - standardStartMinutes
            }
        } else if (type == "ÇIKIŞ") {
            val totalMinutes = currentHour * 60 + currentMinute
            if (totalMinutes > standardEndMinutes) {
                overtimeMinutes = totalMinutes - standardEndMinutes
            }
        }

        val ipMock = if (isSimulated) "10.14.88.24 (Simüle Ağ)" else "10.14.88.19 (Şube Yerel Ağı)"
        val record = AttendanceRecordEntity(
            employeeId = employee.id,
            employeeName = employee.fullName,
            branchId = branch.id,
            branchName = branch.name,
            recordType = type,
            timestamp = now,
            formattedTime = formattedTime,
            formattedDate = formattedDate,
            userLatitude = userLat,
            userLongitude = userLng,
            distanceMeters = distance,
            isWithin5Meters = true,
            ipAddress = ipMock,
            deviceModel = employee.deviceId,
            isMockLocation = isMock,
            note = if (note.isNotBlank()) note else "30 metre kuralına uygun başarılı işlem (${"%.1f".format(distance)}m)",
            lateMinutes = lateMinutes,
            overtimeMinutes = overtimeMinutes
        )

        dao.insertAttendanceRecord(record)

        // OTOMATİK BİLDİRİM SİSTEMİ: İK ve Personel Bildirimi
        val notifTitle = "Mesai ${record.recordType}: ${employee.fullName}"
        val lateStr = if (lateMinutes > 0) " (⚠️ $lateMinutes dk gecikme)" else ""
        val overtimeStr = if (overtimeMinutes > 0) " (✨ $overtimeMinutes dk fazla mesai)" else ""
        val notifMsg = "${employee.fullName} (${branch.name}) $formattedTime itibarıyla ${"%.1f".format(distance)}m mesafeden ${record.recordType} yaptı.$lateStr$overtimeStr"

        dao.insertNotification(
            NotificationEntity(
                timestamp = now,
                targetDepartment = "HR", // İK birimine ve ilgili personele
                title = notifTitle,
                message = notifMsg,
                category = if (type == "GİRİŞ") "ATTENDANCE_IN" else "ATTENDANCE_OUT",
                employeeName = employee.fullName,
                branchName = branch.name,
                distanceMeters = distance
            )
        )

        // Sistem bildirimini gönder
        NotificationHelper.postSystemNotification(
            context = context,
            notificationId = (now % 10000).toInt(),
            channelId = NotificationHelper.CHANNEL_EVENTS_ID,
            title = notifTitle,
            message = notifMsg,
            isAlert = false
        )

        return AttendanceResult.Success(
            record = record,
            message = "Tebrikler! ${record.recordType} işlemi başarıyla kaydedildi.\nŞube Mesafesi: ${"%.1f".format(distance)} metre (İzin verilen: ${allowedRadius}m)\nKayıt Saati: $formattedTime\n\nOtomatik Bildirim: İK ve BT birimlerine başarıyla iletildi."
        )
    }
}
