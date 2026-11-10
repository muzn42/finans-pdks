package com.example.location

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.Looper
import android.provider.Settings
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

data class UserLocationData(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Float = 1.0f,
    val isMock: Boolean = false,
    val isSimulated: Boolean = false,
    /** Gerçek GPS sağlayıcısından en az bir konum sabitlemesi alındı mı? */
    val hasRealFix: Boolean = false
)

data class DeviceMockSecurityReport(
    val isMockLocationDetected: Boolean,
    val isDeveloperOptionsEnabled: Boolean,
    val isAllowMockSettingEnabled: Boolean,
    val detectedMockApps: List<String>,
    val summaryTitle: String,
    val summaryMessage: String
) {
    val hasSecurityWarning: Boolean
        get() = isMockLocationDetected ||
                isDeveloperOptionsEnabled ||
                isAllowMockSettingEnabled ||
                detectedMockApps.isNotEmpty()
}

object LocationHelper {

    const val STRICT_GEOFENCE_RADIUS_METERS = 30.0

    private val KNOWN_MOCK_GPS_PACKAGES = setOf(
        "com.lexa.fakegps",
        "com.incorporateapps.fakegps.fre",
        "com.incorporateapps.fakegps_route",
        "ru.gavrikov.mocklocations",
        "com.blogspot.newapphorizons.fakegps",
        "com.evezzon.fakegps",
        "com.gsmartstudio.fakegps",
        "com.theappninjas.fakegpsjoystick",
        "com.lkr.fakelocation",
        "com.useapp.fakegps",
        "org.hola.gpslocation",
        "com.fly.gps"
    )

    /**
     * Haversine formülü ile iki koordinat arasındaki mesafeyi metre cinsinden hesaplar.
     */
    fun calculateDistanceMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371000.0 // Dünya yarıçapı (metre)
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2) * sin(dLat / 2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
                sin(dLon / 2) * sin(dLon / 2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return r * c
    }

    /**
     * Şube merkezinden belirli bir metre uzaklıkta simüle koordinat üretir.
     * 1 enlem derecesi ≈ 111,139 metre
     */
    fun generateCoordinateAtDistance(
        centerLat: Double,
        centerLon: Double,
        distanceMeters: Double
    ): Pair<Double, Double> {
        val deltaLat = distanceMeters / 111139.0
        return Pair(centerLat + deltaLat, centerLon)
    }

    /**
     * Sahte konum tespiti — platform bayrağı + Bundle ekstraları + anormal doğruluk.
     * Bazı sahte GPS uygulamaları yalnızca ekstra alanları doldurur veya 0m doğruluk verir.
     */
    fun isMockLocation(location: Location): Boolean {
        val platformMock = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            location.isMock
        } else {
            @Suppress("DEPRECATION")
            location.isFromMockProvider
        }
        if (platformMock) return true

        val extras = location.extras
        if (extras != null) {
            if (extras.getBoolean("mockLocation", false)) return true
            if (extras.getBoolean("isMock", false)) return true
            if (extras.getBoolean("sahte_konum", false)) return true
        }

        // Gerçek GPS donanımı hiçbir zaman 0m doğruluk bildirmez.
        return location.accuracy == 0f
    }

    /**
     * Cihazın Geliştirici Seçenekleri, Sahte Konum (ALLOW_MOCK_LOCATION),
     * aktif LocationManager sağlayıcıları ve yüklü sahte GPS uygulamalarını denetler.
     */
    @SuppressLint("MissingPermission")
    fun inspectDeviceMockSecurity(
        context: Context,
        currentLocation: UserLocationData? = null
    ): DeviceMockSecurityReport {
        val cr = context.contentResolver

        val devOptionsEnabled = runCatching {
            Settings.Global.getInt(cr, Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0) != 0
        }.getOrDefault(false)

        val allowMockSetting = runCatching {
            @Suppress("DEPRECATION")
            Settings.Secure.getInt(cr, Settings.Secure.ALLOW_MOCK_LOCATION, 0) != 0
        }.getOrDefault(false)

        var providerMockDetected = currentLocation?.isMock == true
        runCatching {
            val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            val providers = listOf(
                LocationManager.GPS_PROVIDER,
                LocationManager.NETWORK_PROVIDER,
                LocationManager.PASSIVE_PROVIDER,
                "fused"
            )
            for (provider in providers) {
                val last = runCatching { lm?.getLastKnownLocation(provider) }.getOrNull()
                if (last != null && isMockLocation(last)) {
                    providerMockDetected = true
                    break
                }
            }
        }

        val detectedApps = mutableListOf<String>()
        runCatching {
            val pm = context.packageManager
            for (pkg in KNOWN_MOCK_GPS_PACKAGES) {
                val info = runCatching {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        pm.getApplicationInfo(pkg, PackageManager.ApplicationInfoFlags.of(0L))
                    } else {
                        @Suppress("DEPRECATION")
                        pm.getApplicationInfo(pkg, 0)
                    }
                }.getOrNull()
                if (info != null) {
                    val label = runCatching { pm.getApplicationLabel(info).toString() }.getOrDefault(pkg)
                    detectedApps.add(label)
                }
            }

            // İzin tabanlı tarama (ACCESS_MOCK_LOCATION isteyen 3. parti uygulamalar)
            val packages: List<PackageInfo> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getInstalledPackages(PackageManager.PackageInfoFlags.of(PackageManager.GET_PERMISSIONS.toLong()))
            } else {
                @Suppress("DEPRECATION")
                pm.getInstalledPackages(PackageManager.GET_PERMISSIONS)
            }
            for (pi in packages) {
                if (pi.packageName == context.packageName) continue
                val appInfo = pi.applicationInfo ?: continue
                val isSystem = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0 ||
                        (appInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0
                if (isSystem) continue
                val perms = pi.requestedPermissions ?: continue
                if (perms.any { it == "android.permission.ACCESS_MOCK_LOCATION" }) {
                    val label = runCatching { pm.getApplicationLabel(appInfo).toString() }.getOrDefault(pi.packageName)
                    if (!detectedApps.contains(label)) {
                        detectedApps.add(label)
                    }
                }
            }
        }

        val title: String
        val message: String
        when {
            providerMockDetected -> {
                title = "🚫 Sahte Konum (Mock GPS) Tespit Edildi"
                message = "Cihazınızda aktif sahte konum (Mock GPS) sinyali tespit edildi. Kurumsal güvenlik politikası gereği sahte konum açıkken yoklama yapılamaz."
            }
            allowMockSetting || detectedApps.isNotEmpty() -> {
                val appList = detectedApps.joinToString(", ")
                title = "🚫 Sahte Konum Uygulaması / Ayarı Aktif"
                message = if (appList.isNotEmpty()) {
                    "Cihazınızda sahte konum uygulaması ($appList) tespit edildi. Yoklama işlemi için sahte konum uygulamasını ve Geliştirici Seçeneklerini kapatın."
                } else {
                    "Geliştirici Seçeneklerinde 'Sahte Konum' ayarı açık tespit edildi. Yoklama işlemi için bu ayarı kapatmanız gerekmektedir."
                }
            }
            devOptionsEnabled -> {
                title = "⚠️ Geliştirici Seçenekleri Açık (Sahte Konum Riski)"
                message = "Cihazınızda Geliştirici Seçenekleri açık durumda. Sahte konum (Mock GPS) suistimalini önlemek amacıyla canlı GPS ile yoklama yapmadan önce Geliştirici Seçeneklerini kapatmanız gerekmektedir."
            }
            else -> {
                title = "Konum Güvenliği Doğrulandı"
                message = "Gerçek GPS donanımı aktif."
            }
        }

        return DeviceMockSecurityReport(
            isMockLocationDetected = providerMockDetected,
            isDeveloperOptionsEnabled = devOptionsEnabled,
            isAllowMockSettingEnabled = allowMockSetting,
            detectedMockApps = detectedApps,
            summaryTitle = title,
            summaryMessage = message
        )
    }

    /**
     * Gerçek GPS lokasyon akışı
     */
    @SuppressLint("MissingPermission")
    fun getLocationFlow(context: Context): Flow<UserLocationData> = callbackFlow {
        val fusedClient: FusedLocationProviderClient =
            LocationServices.getFusedLocationProviderClient(context)

        // Açılışta son bilinen konumu hemen kontrol et (cihaz hareket etmese bile sahte konumu yakala)
        runCatching {
            val sec = inspectDeviceMockSecurity(context)
            fusedClient.lastLocation.addOnSuccessListener { loc: Location? ->
                if (loc != null) {
                    trySend(
                        UserLocationData(
                            latitude = loc.latitude,
                            longitude = loc.longitude,
                            accuracyMeters = loc.accuracy,
                            isMock = isMockLocation(loc) || sec.isMockLocationDetected || sec.isAllowMockSettingEnabled,
                            isSimulated = false,
                            hasRealFix = true
                        )
                    )
                }
            }
        }

        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 2500L)
            .setMinUpdateIntervalMillis(1200L)
            .setMinUpdateDistanceMeters(0f)
            .build()

        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val loc: Location? = result.lastLocation
                if (loc != null) {
                    val sec = inspectDeviceMockSecurity(context)
                    trySend(
                        UserLocationData(
                            latitude = loc.latitude,
                            longitude = loc.longitude,
                            accuracyMeters = loc.accuracy,
                            isMock = isMockLocation(loc) || sec.isMockLocationDetected || sec.isAllowMockSettingEnabled,
                            isSimulated = false,
                            hasRealFix = true
                        )
                    )
                }
            }
        }

        try {
            fusedClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        } catch (e: SecurityException) {
            close(e)
        }

        awaitClose {
            fusedClient.removeLocationUpdates(locationCallback)
        }
    }
}
