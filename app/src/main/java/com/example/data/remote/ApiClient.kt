package com.example.data.remote

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    /**
     * Şirket network ve sistem ekibinin belirleyeceği API sunucu adresi.
     * Android emülatöründen bilgisayardaki yerel backend testleri için varsayılan: http://10.0.2.2:8080/
     * Şirket kurumsal sunucusu devreye girdiğinde bu değişken doğrudan güncellenebilir.
     */
    @Volatile
    var baseUrl: String = "http://10.0.2.2:8080/"
        set(value) {
            field = if (value.endsWith("/")) value else "$value/"
            _service = null // rebuild on URL change
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
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
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
