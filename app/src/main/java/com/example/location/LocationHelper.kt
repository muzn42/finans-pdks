package com.example.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Build
import android.os.Looper
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
    val isSimulated: Boolean = false
)

object LocationHelper {

    const val STRICT_GEOFENCE_RADIUS_METERS = 30.0

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
     * Gerçek GPS lokasyon akışı
     */
    @SuppressLint("MissingPermission")
    fun getLocationFlow(context: Context): Flow<UserLocationData> = callbackFlow {
        val fusedClient: FusedLocationProviderClient =
            LocationServices.getFusedLocationProviderClient(context)

        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 3000L)
            .setMinUpdateIntervalMillis(1500L)
            .setMinUpdateDistanceMeters(0.5f)
            .build()

        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val loc: Location? = result.lastLocation
                if (loc != null) {
                    val isMock = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        loc.isMock
                    } else {
                        @Suppress("DEPRECATION")
                        loc.isFromMockProvider
                    }

                    trySend(
                        UserLocationData(
                            latitude = loc.latitude,
                            longitude = loc.longitude,
                            accuracyMeters = loc.accuracy,
                            isMock = isMock,
                            isSimulated = false
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
