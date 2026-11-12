package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.example.ui.theme.BgCanvas
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.tan

/**
 * Web Mercator (EPSG:3857) projeksiyonu — OpenStreetMap karo (tile) koordinatları.
 * Tüm "birim" değerleri dp cinsindendir (1 karo = 256 dp).
 */
object StreetMapProjection {
    const val TILE_SIZE = 256.0
    const val MIN_ZOOM = 3
    const val MAX_ZOOM = 19

    private const val MAX_LAT = 85.05112878

    fun worldX(lon: Double, zoom: Int): Double =
        (lon + 180.0) / 360.0 * TILE_SIZE * (1 shl zoom)

    fun worldY(lat: Double, zoom: Int): Double {
        val rad = Math.toRadians(lat.coerceIn(-MAX_LAT, MAX_LAT))
        return (1.0 - ln(tan(rad) + 1.0 / cos(rad)) / PI) / 2.0 * TILE_SIZE * (1 shl zoom)
    }

    /** Verilen enlem ve zoom seviyesinde 1 dp'nin kaç metreye karşılık geldiği. */
    fun metersPerUnit(lat: Double, zoom: Int): Double =
        156543.03392 * cos(Math.toRadians(lat)) / (1 shl zoom)

    /**
     * Şube geofence çemberi ve personel konumunun ikisini de kapsayan görünümü hesaplar.
     * [zoomDelta] kullanıcının +/- ile yaptığı ek yakınlaştırmadır.
     */
    fun fitViewport(
        branchLat: Double,
        branchLon: Double,
        userLat: Double,
        userLon: Double,
        radiusMeters: Double,
        widthDp: Float,
        heightDp: Float,
        paddingHorizontalDp: Float,
        paddingVerticalDp: Float,
        verticalBiasDp: Float,
        zoomDelta: Int
    ): StreetMapViewport {
        val availW = (widthDp - paddingHorizontalDp).coerceAtLeast(40f)
        val availH = (heightDp - paddingVerticalDp).coerceAtLeast(40f)

        fun bounds(zoom: Int): DoubleArray {
            val bx = worldX(branchLon, zoom)
            val by = worldY(branchLat, zoom)
            val ux = worldX(userLon, zoom)
            val uy = worldY(userLat, zoom)
            val r = radiusMeters / metersPerUnit(branchLat, zoom)
            return doubleArrayOf(
                min(bx - r, ux), min(by - r, uy),
                max(bx + r, ux), max(by + r, uy)
            )
        }

        var fitZoom = MIN_ZOOM
        for (z in MAX_ZOOM downTo MIN_ZOOM) {
            val b = bounds(z)
            if (b[2] - b[0] <= availW && b[3] - b[1] <= availH) {
                fitZoom = z
                break
            }
        }
        val zoom = (fitZoom + zoomDelta).coerceIn(MIN_ZOOM, MAX_ZOOM)
        val b = bounds(zoom)
        return StreetMapViewport(
            zoom = zoom,
            centerX = (b[0] + b[2]) / 2.0,
            centerY = (b[1] + b[3]) / 2.0 - verticalBiasDp,
            widthDp = widthDp,
            heightDp = heightDp
        )
    }
}

/** Ekrandaki harita penceresi: merkez dünya koordinatı (dp) + boyut + zoom. */
data class StreetMapViewport(
    val zoom: Int,
    val centerX: Double,
    val centerY: Double,
    val widthDp: Float,
    val heightDp: Float
) {
    val leftDp: Double get() = centerX - widthDp / 2.0
    val topDp: Double get() = centerY - heightDp / 2.0

    /** Coğrafi koordinatı harita kutusunun sol üst köşesine göre dp ofsetine çevirir. */
    fun toLocalDp(lat: Double, lon: Double): Offset = Offset(
        (StreetMapProjection.worldX(lon, zoom) - leftDp).toFloat(),
        (StreetMapProjection.worldY(lat, zoom) - topDp).toFloat()
    )
}

private const val OSM_TILE_URL = "https://tile.openstreetmap.org/%d/%d/%d.png"
private const val OSM_USER_AGENT = "AlbayrakPDKS/1.0 (Android; personel konum haritasi)"

/**
 * Gerçek sokak/cadde altlığı: OpenStreetMap karolarını Coil ile indirip yerleştirir.
 * API anahtarı gerektirmez; karolar Coil disk önbelleğinde tutulur.
 * İnternet yoksa yalnızca zemin rengi görünür, pin ve geofence çizimi yine çalışır.
 */
@Composable
fun OsmTileLayer(viewport: StreetMapViewport, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val zoom = viewport.zoom
    val tileCount = 1 shl zoom
    val tile = StreetMapProjection.TILE_SIZE
    val left = viewport.leftDp
    val top = viewport.topDp

    val firstX = floor(left / tile).toInt()
    val lastX = floor((left + viewport.widthDp) / tile).toInt()
    val firstY = floor(top / tile).toInt()
    val lastY = floor((top + viewport.heightDp) / tile).toInt()

    Box(
        modifier = modifier
            .fillMaxSize()
            .clipToBounds()
            .background(BgCanvas)
    ) {
        for (ty in firstY..lastY) {
            if (ty !in 0 until tileCount) continue
            for (tx in firstX..lastX) {
                val wrappedX = ((tx % tileCount) + tileCount) % tileCount
                key(zoom, tx, ty) {
                    val url = String.format(java.util.Locale.US, OSM_TILE_URL, zoom, wrappedX, ty)
                    val request = remember(url) {
                        ImageRequest.Builder(context)
                            .data(url)
                            .addHeader("User-Agent", OSM_USER_AGENT)
                            .crossfade(true)
                            .build()
                    }
                    AsyncImage(
                        model = request,
                        contentDescription = null,
                        contentScale = ContentScale.FillBounds,
                        modifier = Modifier
                            .offset(
                                x = (tx * tile - left).toFloat().dp,
                                y = (ty * tile - top).toFloat().dp
                            )
                            .wrapContentSize(align = Alignment.TopStart, unbounded = true)
                            .size(tile.toFloat().dp)
                    )
                }
            }
        }
    }
}
