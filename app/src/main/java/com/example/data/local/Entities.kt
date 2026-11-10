package com.example.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class UserRole(val displayName: String, val badgeColorHex: Long) {
    PERSONNEL("Personel", 0xFF1E40AF),
    HR("İK Yetkilisi", 0xFF059669),
    IT("BT / Sistem Yöneticisi", 0xFF7C3AED)
}

@Entity(tableName = "branches")
data class BranchEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val branchCode: String,
    val city: String,
    val address: String,
    val latitude: Double,
    val longitude: Double,
    val radiusMeters: Double = 30.0, // Varsayılan 30 metre kuralı
    val wifiSsid: String = "FINANS_CORP_SECURE",
    val phone: String = "0212 555 0100",
    val isDefault: Boolean = false
)

@Entity(tableName = "employees")
data class EmployeeEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val employeeCode: String,
    val fullName: String,
    val email: String,
    val department: String,
    val title: String,
    val branchId: Long,
    val deviceId: String = "FN-DEV-9842",
    val phone: String = "+90 532 555 0142",
    val role: String = "PERSONNEL", // "PERSONNEL", "HR", "IT"
    val password: String = "123456",
    val isKvkkConsentGiven: Boolean = true,
    val kvkkConsentTimestamp: Long? = 1714000000000L,
    val profileImageUrl: String = "",
    // PostgreSQL shifts tablosundan gelen vardiya penceresi (dakika cinsinden)
    val shiftStartMin: Int = 510, // 08:30
    val shiftEndMin: Int = 1050, // 17:30
    val shiftGraceMin: Int = 5
)

@Entity(tableName = "attendance_records")
data class AttendanceRecordEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val employeeId: Long,
    val employeeName: String,
    val branchId: Long,
    val branchName: String,
    val recordType: String, // "GİRİŞ" veya "ÇIKIŞ"
    val timestamp: Long,
    val formattedTime: String,
    val formattedDate: String,
    val userLatitude: Double,
    val userLongitude: Double,
    val distanceMeters: Double,
    val isWithin5Meters: Boolean, // 30 metre yetkili alan bayrağı
    val ipAddress: String,
    val deviceModel: String,
    val isMockLocation: Boolean = false,
    val note: String = "",
    val lateMinutes: Int = 0, // 09:00'dan sonraki gecikme dakikası
    val overtimeMinutes: Int = 0, // 18:00'dan sonraki fazla mesai dakikası
    val verificationMethod: String = "ONE_TAP_GEOFENCE", // ONE_TAP_GEOFENCE, NFC, QR
    val securityStatus: String = "VERIFIED", // VERIFIED, FLAGGED, EXCUSED
    val lateReasonCode: String = "", // Geç giriş gerekçe şablonu (örn. TRAFIK)
    val lateReasonNote: String = "" // "Diğer" seçildiğinde personelin yazdığı açıklama
)

@Entity(tableName = "security_alerts")
data class SecurityAlertEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val timestamp: Long,
    val employeeId: Long,
    val employeeName: String,
    val branchName: String,
    val alertType: String, // "MOCK_LOCATION", "GEOFENCE_BREACH", "DEVICE_MISMATCH", "ROOT_DETECTED"
    val message: String,
    val distanceMeters: Double,
    val severity: String, // "HIGH", "MEDIUM", "LOW"
    val isResolved: Boolean = false
)

@Entity(tableName = "notifications")
data class NotificationEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val timestamp: Long,
    val targetDepartment: String, // "ALL", "HR", "IT"
    val title: String,
    val message: String,
    val category: String, // "ATTENDANCE_IN", "ATTENDANCE_OUT", "GEOFENCE_BREACH", "SECURITY"
    val employeeName: String,
    val branchName: String,
    val distanceMeters: Double = 0.0,
    val isRead: Boolean = false
)

