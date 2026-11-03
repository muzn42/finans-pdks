package com.example.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.example.R

object NotificationHelper {

    const val CHANNEL_EVENTS_ID = "pdks_events_channel"
    const val CHANNEL_ALERTS_ID = "pdks_alerts_channel"

    fun initNotificationChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val eventChannel = NotificationChannel(
                CHANNEL_EVENTS_ID,
                "PDKS Giriş / Çıkış Bildirimleri (İK)",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Personellerin mesai başlangıç ve bitiş bildirimleri"
            }

            val alertChannel = NotificationChannel(
                CHANNEL_ALERTS_ID,
                "PDKS 30 Metre Güvenlik & BT Alarmları",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "30 metre geofence kuralı ihlalleri ve güvenlik uyarıları"
                enableVibration(true)
            }

            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(eventChannel)
            manager.createNotificationChannel(alertChannel)
        }
    }

    fun postSystemNotification(
        context: Context,
        notificationId: Int,
        channelId: String,
        title: String,
        message: String,
        isAlert: Boolean = false
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    context,
                    android.Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                // İzin yoksa sistem bildirimi atlanabilir, ancak uygulama içi bildirim merkezinde zaten kaydediliyor
                return
            }
        }

        try {
            val builder = NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.drawable.ic_albayrak_notification)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(if (isAlert) NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)

            NotificationManagerCompat.from(context).notify(notificationId, builder.build())
        } catch (_: SecurityException) {
            // Güvenli hata yakalama
        }
    }
}
