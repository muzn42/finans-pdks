package com.example.data.remote

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class LoginRequestDto(
    @Json(name = "employeeCode") val employeeCode: String,
    @Json(name = "password") val password: String,
    @Json(name = "deviceModel") val deviceModel: String? = null
)

@JsonClass(generateAdapter = true)
data class LoginResponseDto(
    @Json(name = "token") val token: String,
    @Json(name = "employeeId") val employeeId: Long,
    @Json(name = "fullName") val fullName: String,
    @Json(name = "role") val role: String,
    @Json(name = "branchId") val branchId: Long
)

@JsonClass(generateAdapter = true)
data class NearbyWifiDto(
    @Json(name = "bssid") val bssid: String,
    @Json(name = "ssid") val ssid: String = "",
    @Json(name = "rssi") val rssi: Int = -60,
    @Json(name = "frequency") val frequency: Int? = null
)

@JsonClass(generateAdapter = true)
data class AttendanceRecordDto(
    @Json(name = "id") val id: Long? = null,
    @Json(name = "employeeId") val employeeId: Long,
    @Json(name = "employeeName") val employeeName: String,
    @Json(name = "branchId") val branchId: Long,
    @Json(name = "branchName") val branchName: String,
    @Json(name = "recordType") val recordType: String,
    @Json(name = "timestamp") val timestamp: Long,
    @Json(name = "userLatitude") val userLatitude: Double,
    @Json(name = "userLongitude") val userLongitude: Double,
    @Json(name = "distanceMeters") val distanceMeters: Double,
    @Json(name = "accuracyMeters") val accuracyMeters: Float = 3.4521f,
    @Json(name = "isWithin5Meters") val isWithin5Meters: Boolean,
    @Json(name = "isMockLocation") val isMockLocation: Boolean = false,
    @Json(name = "nearbyWifis") val nearbyWifis: List<NearbyWifiDto> = emptyList(),
    @Json(name = "deviceModel") val deviceModel: String = "",
    @Json(name = "note") val note: String = "",
    @Json(name = "lateMinutes") val lateMinutes: Int = 0,
    @Json(name = "overtimeMinutes") val overtimeMinutes: Int = 0,
    @Json(name = "lateReasonCode") val lateReasonCode: String? = null,
    @Json(name = "lateReasonNote") val lateReasonNote: String? = null,
    @Json(name = "formattedTime") val formattedTime: String? = null,
    @Json(name = "formattedDate") val formattedDate: String? = null,
    @Json(name = "ipAddress") val ipAddress: String? = null
)

@JsonClass(generateAdapter = true)
data class SecurityAlertDto(
    @Json(name = "timestamp") val timestamp: Long,
    @Json(name = "employeeId") val employeeId: Long,
    @Json(name = "employeeName") val employeeName: String,
    @Json(name = "branchName") val branchName: String,
    @Json(name = "alertType") val alertType: String,
    @Json(name = "message") val message: String,
    @Json(name = "distanceMeters") val distanceMeters: Double,
    @Json(name = "severity") val severity: String
)

@JsonClass(generateAdapter = true)
data class SyncBatchRequestDto(
    @Json(name = "lastSyncTimestamp") val lastSyncTimestamp: Long,
    @Json(name = "records") val records: List<AttendanceRecordDto>,
    @Json(name = "alerts") val alerts: List<SecurityAlertDto>
)

@JsonClass(generateAdapter = true)
data class SyncBatchResponseDto(
    @Json(name = "success") val success: Boolean,
    @Json(name = "syncedCount") val syncedCount: Int,
    @Json(name = "serverTimestamp") val serverTimestamp: Long,
    @Json(name = "message") val message: String? = null
)

@JsonClass(generateAdapter = true)
data class BranchDto(
    @Json(name = "id") val id: Long,
    @Json(name = "name") val name: String,
    @Json(name = "branchCode") val branchCode: String? = null,
    @Json(name = "city") val city: String,
    @Json(name = "address") val address: String,
    @Json(name = "latitude") val latitude: Double,
    @Json(name = "longitude") val longitude: Double,
    @Json(name = "radiusMeters") val radiusMeters: Double = 30.0,
    @Json(name = "wifiSsid") val wifiSsid: String? = null,
    @Json(name = "wifiBssid") val wifiBssid: String? = null,
    @Json(name = "backupWifiBssids") val backupWifiBssids: String? = null,
    @Json(name = "wifiEnforcementMode") val wifiEnforcementMode: String? = null,
    @Json(name = "phone") val phone: String? = "444 88 61",
    @Json(name = "isDefault") val isDefault: Boolean? = false
)
