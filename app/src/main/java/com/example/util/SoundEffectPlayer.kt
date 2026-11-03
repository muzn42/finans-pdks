package com.example.util

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.sin

/**
 * Kurumsal PDKS Polifonik Ses Sentezleyici (44.1kHz PCM Harmonik Akor Üretici).
 * Basit sistem "bip" sesi yerine Apple Pay / modern finans uygulamalarındaki gibi
 * yumuşak zarflı (attack + exponential decay) kristal akor sesleri üretir.
 */
object SoundEffectPlayer {

    private const val SAMPLE_RATE = 44100

    private data class HarmonicNote(
        val frequencyHz: Double,
        val startSec: Double,
        val durationSec: Double,
        val amplitude: Double = 0.32
    )

    /**
     * Başarılı Giriş Sesi: Yükselen kristal majör beşli + oktav akoru (E5 -> B5 -> E6)
     */
    fun playCheckInChime(context: Context? = null) {
        triggerSubtleHaptic(context, isSuccess = true)
        playPolyphonicNotes(
            listOf(
                HarmonicNote(frequencyHz = 659.25, startSec = 0.00, durationSec = 0.22, amplitude = 0.28), // E5
                HarmonicNote(frequencyHz = 987.77, startSec = 0.085, durationSec = 0.26, amplitude = 0.30), // B5
                HarmonicNote(frequencyHz = 1318.51, startSec = 0.17, durationSec = 0.46, amplitude = 0.34), // E6
                HarmonicNote(frequencyHz = 1661.22, startSec = 0.17, durationSec = 0.40, amplitude = 0.14)  // G#6 (Majör 3. armoni)
            )
        )
    }

    /**
     * Başarılı Çıkış Sesi: Sıcak, dingin çözülen vardiya tamamlama akoru (C6 -> G5 -> E5)
     */
    fun playCheckOutChime(context: Context? = null) {
        triggerSubtleHaptic(context, isSuccess = true)
        playPolyphonicNotes(
            listOf(
                HarmonicNote(frequencyHz = 1046.50, startSec = 0.00, durationSec = 0.20, amplitude = 0.28), // C6
                HarmonicNote(frequencyHz = 783.99, startSec = 0.09, durationSec = 0.24, amplitude = 0.28),  // G5
                HarmonicNote(frequencyHz = 659.25, startSec = 0.18, durationSec = 0.48, amplitude = 0.32),  // E5
                HarmonicNote(frequencyHz = 523.25, startSec = 0.18, durationSec = 0.45, amplitude = 0.18)   // C5 (Alt gövde)
            )
        )
    }

    /**
     * 30m Sınır İhlali / Uyarı Sesi: Tok çift darbeli kurumsal uyarı tonu (F4 -> D4)
     */
    fun playWarningTone(context: Context? = null) {
        triggerSubtleHaptic(context, isSuccess = false)
        playPolyphonicNotes(
            listOf(
                HarmonicNote(frequencyHz = 349.23, startSec = 0.00, durationSec = 0.16, amplitude = 0.34),
                HarmonicNote(frequencyHz = 293.66, startSec = 0.16, durationSec = 0.28, amplitude = 0.36)
            )
        )
    }

    private fun playPolyphonicNotes(notes: List<HarmonicNote>) {
        CoroutineScope(Dispatchers.Default).launch {
            try {
                val totalDurationSec = (notes.maxOfOrNull { it.startSec + it.durationSec } ?: 0.5) + 0.08
                val totalSamples = (SAMPLE_RATE * totalDurationSec).toInt()
                val mixBuffer = DoubleArray(totalSamples)

                for (note in notes) {
                    val startSample = (note.startSec * SAMPLE_RATE).toInt()
                    val noteSamples = (note.durationSec * SAMPLE_RATE).toInt()
                    val attackSamples = (0.014 * SAMPLE_RATE).toInt().coerceAtLeast(1)

                    for (i in 0 until noteSamples) {
                        val globalIdx = startSample + i
                        if (globalIdx >= totalSamples) break

                        val t = i.toDouble() / SAMPLE_RATE
                        // Yumuşak attack ve doğal kristal sönümlenme (exponential decay)
                        val attackEnv = if (i < attackSamples) i.toDouble() / attackSamples else 1.0
                        val decayEnv = exp(-5.8 * (t / note.durationSec))
                        val env = attackEnv * decayEnv

                        // Temel frekans + 2. ve 3. sıcak harmonikler (zil/cam tınısı)
                        val fundamental = sin(2.0 * PI * note.frequencyHz * t)
                        val overtone2 = 0.28 * sin(2.0 * PI * (note.frequencyHz * 2.0) * t) * exp(-3.0 * t)
                        val overtone3 = 0.08 * sin(2.0 * PI * (note.frequencyHz * 3.0) * t) * exp(-6.0 * t)

                        mixBuffer[globalIdx] += (fundamental + overtone2 + overtone3) * env * note.amplitude
                    }
                }

                // Soft-clipping & 16-bit PCM dönüşümü
                val pcmData = ShortArray(totalSamples)
                for (i in 0 until totalSamples) {
                    val clamped = mixBuffer[i].coerceIn(-0.95, 0.95)
                    pcmData[i] = (clamped * Short.MAX_VALUE).toInt().toShort()
                }

                val bufferSizeInBytes = pcmData.size * 2
                val audioTrack = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(SAMPLE_RATE)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .build()
                    )
                    .setBufferSizeInBytes(bufferSizeInBytes)
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .build()

                audioTrack.write(pcmData, 0, pcmData.size)
                audioTrack.play()

                kotlinx.coroutines.delay((totalDurationSec * 1000).toLong() + 120L)
                audioTrack.stop()
                audioTrack.release()
            } catch (_: Exception) {
                // Ses donanımı meşgulse sessizce geç
            }
        }
    }

    private fun triggerSubtleHaptic(context: Context?, isSuccess: Boolean) {
        if (context == null) return
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }
            if (vibrator?.hasVibrator() == true) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val timings = if (isSuccess) longArrayOf(0, 18, 45, 28) else longArrayOf(0, 45, 60, 55)
                    val amplitudes = if (isSuccess) intArrayOf(0, 90, 0, 150) else intArrayOf(0, 180, 0, 200)
                    vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
                }
            }
        } catch (_: Exception) {
        }
    }
}
