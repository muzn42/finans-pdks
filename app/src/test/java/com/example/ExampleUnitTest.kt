package com.example

import com.example.location.LocationHelper
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ExampleUnitTest {
    @Test
    fun testHaversineDistanceZeroAtSamePoint() {
        val lat = 41.111850
        val lon = 29.022350
        val distance = LocationHelper.calculateDistanceMeters(lat, lon, lat, lon)
        assertEquals(0.0, distance, 0.001)
    }

    @Test
    fun testGeofence5MetersRule() {
        val branchLat = 41.111850
        val branchLon = 29.022350

        // 3 meters away
        val (latInside, lonInside) = LocationHelper.generateCoordinateAtDistance(branchLat, branchLon, 3.0)
        val distInside = LocationHelper.calculateDistanceMeters(branchLat, branchLon, latInside, lonInside)
        assertTrue("Distance should be within 5m", distInside <= LocationHelper.STRICT_GEOFENCE_RADIUS_METERS)

        // 8 meters away (beyond 5m - should trigger warning)
        val (latOutside, lonOutside) = LocationHelper.generateCoordinateAtDistance(branchLat, branchLon, 8.0)
        val distOutside = LocationHelper.calculateDistanceMeters(branchLat, branchLon, latOutside, lonOutside)
        assertFalse("Distance should exceed 5m and trigger warning", distOutside <= LocationHelper.STRICT_GEOFENCE_RADIUS_METERS)
        assertTrue("Distance should be greater than 5m", distOutside > 5.0)
    }
}
