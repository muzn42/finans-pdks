package com.example.data.remote

import android.content.Context
import android.os.Build
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    private const val PREFS_NAME = "atf_pdks_network_prefs"
    private const val KEY_BASE_URL = "server_base_url"

    const val URL_EMULATOR = "http://10.0.2.2:8000/"
    const val URL_USB_ADB = "http://127.0.0.1:8000/"
    const val URL_WIFI_LAN = "http://192.168.1.8:8000/"

    fun isRunningOnEmulator(): Boolean {
        val fp = Build.FINGERPRINT.lowercase()
        val model = Build.MODEL.lowercase()
        val brand = Build.BRAND.lowercase()
        val device = Build.DEVICE.lowercase()
        val product = Build.PRODUCT.lowercase()
        return fp.startsWith("generic") ||
                fp.startsWith("unknown") ||
                model.contains("google_sdk") ||
                model.contains("emulator") ||
                model.contains("android sdk built for") ||
                model.contains("sdk_gphone") ||
                (brand.startsWith("generic") && device.startsWith("generic")) ||
                product.contains("sdk")
    }

    private fun defaultUrlForDevice(): String =
        if (isRunningOnEmulator()) URL_EMULATOR else URL_USB_ADB

    private fun sanitizeBaseUrl(rawUrl: String): String {
        val trimmed = rawUrl.trim()
        if (trimmed.isEmpty()) return defaultUrlForDevice()
        val withScheme = if (trimmed.startsWith("http://", ignoreCase = true) ||
            trimmed.startsWith("https://", ignoreCase = true)
        ) {
            trimmed
        } else {
            "http://$trimmed"
        }
        val withSlash = if (withScheme.endsWith("/")) withScheme else "$withScheme/"
        val parsed = withSlash.toHttpUrlOrNull()
        return parsed?.toString() ?: defaultUrlForDevice()
    }

    /**
     * Next.js 15 + PostgreSQL 18 sunucu adresi (varsayılan port: 8000).
     * - Emülatör: http://10.0.2.2:8000/
     * - USB ile bağlı gerçek telefon (adb reverse tcp:8000 tcp:8000): http://127.0.0.1:8000/
     * - Aynı Wi-Fi'daki gerçek telefon: http://192.168.1.8:8000/
     * - Mobil veri / Cloudflare Tunnel / ngrok: https://xxxx.trycloudflare.com/
     */
    @Volatile
    var baseUrl: String = defaultUrlForDevice()
        set(value) {
            field = sanitizeBaseUrl(value)
            _service = null // rebuild on URL change
        }

    fun init(context: Context) {
        val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val saved = prefs.getString(KEY_BASE_URL, null)
        if (!saved.isNullOrBlank() && !saved.contains(":8080")) {
            baseUrl = sanitizeBaseUrl(saved)
        } else {
            baseUrl = defaultUrlForDevice()
            prefs.edit().putString(KEY_BASE_URL, baseUrl).apply()
        }
    }

    fun saveBaseUrl(context: Context, newUrl: String): String {
        val normalized = sanitizeBaseUrl(newUrl)
        baseUrl = normalized
        context.applicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_BASE_URL, normalized)
            .apply()
        return normalized
    }

    @Volatile
    var authToken: String? = null

    private val moshi: Moshi by lazy {
        Moshi.Builder()
            .addLast(KotlinJsonAdapterFactory())
            .build()
    }

    private val okHttpClient: OkHttpClient by lazy {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        OkHttpClient.Builder()
            .addInterceptor(logging)
            .addInterceptor { chain ->
                val requestBuilder = chain.request().newBuilder()
                    .addHeader("Accept", "application/json")
                    .addHeader("Content-Type", "application/json")
                authToken?.let { token ->
                    requestBuilder.addHeader("Authorization", "Bearer $token")
                }
                chain.proceed(requestBuilder.build())
            }
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(12, TimeUnit.SECONDS)
            .writeTimeout(12, TimeUnit.SECONDS)
            .build()
    }

    private var _service: PdksApiService? = null

    val service: PdksApiService
        get() {
            return _service ?: synchronized(this) {
                val s = Retrofit.Builder()
                    .baseUrl(baseUrl)
                    .client(okHttpClient)
                    .addConverterFactory(MoshiConverterFactory.create(moshi))
                    .build()
                    .create(PdksApiService::class.java)
                _service = s
                s
            }
        }
}
