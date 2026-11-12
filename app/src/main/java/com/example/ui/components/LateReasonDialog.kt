package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.AlbayrakRed
import com.example.ui.theme.BgCanvas
import com.example.ui.theme.CardSurface
import com.example.ui.theme.InkMuted
import com.example.ui.theme.InkPrimary
import com.example.ui.theme.InkSecondary
import com.example.ui.theme.LineHairline
import com.example.ui.theme.StatusBadSoft

/**
 * Geç giriş gerekçesi şablonu.
 * [code] veritabanına yazılan kısa anahtar, [label] personele gösterilen metin.
 */
data class LateReasonTemplate(
    val code: String,
    val label: String,
    val group: String
)

/** "Diğer" seçildiğinde serbest açıklama zorunludur. */
const val LATE_REASON_OTHER_CODE = "DIGER"

val LATE_REASON_TEMPLATES: List<LateReasonTemplate> = listOf(
    // ULAŞIM & YOL
    LateReasonTemplate("TRAFIK", "Trafik yoğunluğu", "ULAŞIM & YOL"),
    LateReasonTemplate("TOPLU_TASIMA", "Toplu taşıma gecikmesi / arıza", "ULAŞIM & YOL"),
    LateReasonTemplate("ARAC_ARIZA", "Araç arızası", "ULAŞIM & YOL"),
    LateReasonTemplate("SERVIS", "Personel servisi gecikmesi", "ULAŞIM & YOL"),
    LateReasonTemplate("YOL_KAPALI", "Yol kapanması / trafik kazası", "ULAŞIM & YOL"),
    LateReasonTemplate("OTOPARK", "Otopark / park yeri sorunu", "ULAŞIM & YOL"),
    LateReasonTemplate("HAVA", "Hava koşulları (kar, buz, sis, yağış)", "ULAŞIM & YOL"),

    // SAĞLIK
    LateReasonTemplate("SAGLIK_KENDI", "Kendi sağlık sorunum / doktor randevusu", "SAĞLIK"),
    LateReasonTemplate("SAGLIK_AILE", "Aile / çocuk sağlığı", "SAĞLIK"),
    LateReasonTemplate("ACIL_HASTANE", "Acil hastane / refakat", "SAĞLIK"),
    LateReasonTemplate("ECZANE", "Eczane, kan / numune işlemi", "SAĞLIK"),

    // AİLE & ÖZLÜK
    LateReasonTemplate("COCUK", "Çocuğu okula / kreşe bırakma", "AİLE & ÖZLÜK"),
    LateReasonTemplate("AILEVI_ACIL", "Ailevi acil durum", "AİLE & ÖZLÜK"),
    LateReasonTemplate("RESMI_KURUM", "Resmi kurum işlemi (noter, tapu, nüfus, SGK)", "AİLE & ÖZLÜK"),
    LateReasonTemplate("EV_ACIL", "Evde acil tamir (su, elektrik, doğalgaz)", "AİLE & ÖZLÜK"),
    LateReasonTemplate("ADLI", "Adli / idari zorunluluk", "AİLE & ÖZLÜK"),

    // İŞ & GÖREV
    LateReasonTemplate("SAHA_GOREVI", "Şube dışı saha görevi / müşteri ziyareti", "İŞ & GÖREV"),
    LateReasonTemplate("YONETICI_TALIMAT", "Yönetici talimatıyla farklı lokasyonda görev", "İŞ & GÖREV"),
    LateReasonTemplate("EVRAK", "Evrak / belge teslimi", "İŞ & GÖREV"),
    LateReasonTemplate("ONCEKI_GUN_MESAISI", "Önceki gün geç biten toplantı / fazla mesai", "İŞ & GÖREV"),

    // TEKNİK & SİSTEM
    LateReasonTemplate("CIHAZ_ARIZA", "Mobil cihaz arızası / şarj bitmesi", "TEKNİK & SİSTEM"),
    LateReasonTemplate("GPS_SINYAL", "Konum / GPS sinyali alınamadı", "TEKNİK & SİSTEM"),
    LateReasonTemplate("UYGULAMA", "Uygulama / internet kesintisi", "TEKNİK & SİSTEM"),
    LateReasonTemplate("SISTEM_BAKIM", "Sistem bakımı / güncelleme", "TEKNİK & SİSTEM"),

    // DİĞER
    LateReasonTemplate(LATE_REASON_OTHER_CODE, "Diğer (açıklama yazınız)", "DİĞER")
)

/**
 * Personel vardiya toleransını aşarak giriş yaptığında gösterilen gerekçe ekranı.
 * Şablonlardan biri seçilir; "Diğer" seçilirse serbest açıklama zorunlu olur.
 */
@Composable
fun LateReasonDialog(
    lateMinutes: Int,
    checkInTime: String,
    onDismiss: () -> Unit,
    onSubmit: (code: String, note: String) -> Unit
) {
    var selectedCode by remember { mutableStateOf<String?>(null) }
    var otherNote by remember { mutableStateOf("") }

    val isOther = selectedCode == LATE_REASON_OTHER_CODE
    val canSubmit = selectedCode != null && (!isOther || otherNote.trim().length >= 3)

    val groups = remember { LATE_REASON_TEMPLATES.groupBy { it.group } }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CardSurface,
        shape = RoundedCornerShape(18.dp),
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = "Geç Giriş Gerekçesi",
                    color = InkPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.ExtraBold
                )
                Text(
                    text = "Giriş saatiniz vardiya toleransını aştı. Gerekçenizi seçin.",
                    color = InkMuted,
                    fontSize = 11.5.sp
                )
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Gecikme özeti
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = StatusBadSoft,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 9.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Giriş: $checkInTime",
                            color = InkPrimary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = "$lateMinutes dk gecikme",
                            color = AlbayrakRed,
                            fontSize = 12.5.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                }

                // Şablon listesi (gruplu, kaydırılabilir)
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 330.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    groups.forEach { (groupName, templates) ->
                        Text(
                            text = groupName,
                            color = InkSecondary,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = 0.6.sp,
                            modifier = Modifier.padding(top = 4.dp, bottom = 1.dp)
                        )
                        templates.chunked(2).forEach { pair ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                pair.forEach { template ->
                                    ReasonChip(
                                        label = template.label,
                                        selected = selectedCode == template.code,
                                        onClick = { selectedCode = template.code },
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                                if (pair.size == 1) {
                                    Box(modifier = Modifier.weight(1f))
                                }
                            }
                        }
                    }
                }

                // "Diğer" açıklaması
                if (isOther) {
                    OutlinedTextField(
                        value = otherNote,
                        onValueChange = { if (it.length <= 200) otherNote = it },
                        label = { Text("Gerekçenizi kısaca yazın (zorunlu)", fontSize = 11.sp) },
                        placeholder = { Text("Örn. Şube açılışında kasa sayımı nedeniyle bekledim.", fontSize = 12.sp) },
                        minLines = 3,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        supportingText = {
                            Text(
                                text = "${otherNote.length}/200",
                                fontSize = 10.sp,
                                color = InkMuted,
                                modifier = Modifier.fillMaxWidth(),
                                textAlign = TextAlign.End
                            )
                        }
                    )
                }
                if (selectedCode == null) {
                    Text(
                        text = "Kaydetmek için listeden bir gerekçe seçin.",
                        color = InkMuted,
                        fontSize = 10.5.sp
                    )
                }
            }
        },
        confirmButton = {
            MinimalBasicButton(
                text = "Gerekçeyi Kaydet",
                onClick = {
                    val code = selectedCode ?: return@MinimalBasicButton
                    val note = if (code == LATE_REASON_OTHER_CODE) otherNote.trim() else ""
                    onSubmit(code, note)
                },
                variant = MinimalButtonVariant.DARK,
                enabled = canSubmit,
                height = 48.dp
            )
        },
        dismissButton = {
            MinimalBasicButton(
                text = "Daha Sonra",
                onClick = onDismiss,
                variant = MinimalButtonVariant.OUTLINE,
                height = 48.dp
            )
        }
    )
}

@Composable
private fun ReasonChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .heightIn(min = 48.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) AlbayrakRed.copy(alpha = 0.10f) else BgCanvas)
            .border(
                width = if (selected) 1.5.dp else 1.dp,
                color = if (selected) AlbayrakRed else LineHairline,
                shape = RoundedCornerShape(10.dp)
            )
            .selectable(selected = selected, role = Role.RadioButton, onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            color = if (selected) AlbayrakRed else InkPrimary,
            fontSize = 11.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            textAlign = TextAlign.Center,
            maxLines = 2,
            lineHeight = 13.sp
        )
    }
}
