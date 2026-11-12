package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.repository.AttendanceResult
import com.example.ui.theme.InRangeGreen
import com.example.ui.theme.OutOfRangeRed

@Composable
fun KvkkConsentDialog(
    employeeName: String,
    onAccept: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Box(
                modifier = Modifier
                    .size(54.dp)
                    .background(Color(0xFFE31E24).copy(alpha = 0.12f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Shield,
                    contentDescription = "KVKK",
                    tint = Color(0xFFE31E24),
                    modifier = Modifier.size(32.dp)
                )
            }
        },
        title = {
            Text(
                text = "KVKK Aydınlatma ve Açık Rıza Metni",
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                color = MaterialTheme.colorScheme.onSurface
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(vertical = 4.dp)
            ) {
                Text(
                    text = "Sayın $employeeName,",
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "6698 sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") uyarınca, Albayrak Tasarruf Finansman A.Ş. (\"Şirket\") tarafından Personel Devam Kontrol Sistemi (\"ATF PDKS\") kapsamında işlenen kişisel verileriniz hakkında bilgilendirmedir:",
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(10.dp))
                
                Text(
                    text = "1. Anlık Konum (GPS) Verisi:",
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    color = Color(0xFFE31E24)
                )
                Text(
                    text = "Konum bilginiz yalnızca mesai 'GİRİŞ' ve 'ÇIKIŞ' butonlarına bastığınız an şube sınırları (30 metre) içerisinde bulunup bulunmadığınızı doğrulamak amacıyla işlenir. Arka planda 7/24 sürekli konum takibi kesinlikle YAPILMAMAKTADIR.",
                    fontSize = 11.sp,
                    lineHeight = 16.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "2. Cihaz Kimliği ve Ağ Güvenliği:",
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    color = Color(0xFFE31E24)
                )
                Text(
                    text = "Başkası adına işlem yapılmasını önlemek ve bilgi güvenliğini sağlamak amacıyla cihaz modeli ve IP adresi işlenmektedir. Sahte konum (Mock GPS) ve yetkisiz cihaz tespitleri sistem kayıtlarına işlenir.",
                    fontSize = 11.sp,
                    lineHeight = 16.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "3. Haklarınız:",
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    color = Color(0xFFE31E24)
                )
                Text(
                    text = "KVKK'nın 11. maddesi kapsamındaki tüm haklarınızı Şirketimiz İnsan Kaynakları ve Hukuk birimlerine başvurarak her zaman kullanabilirsiniz.",
                    fontSize = 11.sp,
                    lineHeight = 16.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onAccept,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE31E24))
            ) {
                Text("Okudum, Onaylıyorum", fontWeight = FontWeight.Bold, color = Color.White)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Kapat")
            }
        }
    )
}

@Composable
fun SecurityBreachDialog(
    title: String,
    message: String,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Box(
                modifier = Modifier
                    .size(54.dp)
                    .background(OutOfRangeRed.copy(alpha = 0.15f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = "Güvenlik İhlali",
                    tint = OutOfRangeRed,
                    modifier = Modifier.size(34.dp)
                )
            }
        },
        title = {
            Text(
                text = title,
                fontWeight = FontWeight.Bold,
                color = OutOfRangeRed
            )
        },
        text = {
            Text(
                text = message,
                fontSize = 13.sp,
                lineHeight = 19.sp,
                color = MaterialTheme.colorScheme.onSurface
            )
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = OutOfRangeRed)
            ) {
                Text("Anladım", color = Color.White)
            }
        }
    )
}

@Composable
fun AttendanceResultDialog(
    result: AttendanceResult,
    onDismiss: () -> Unit,
    onOpenExcuseDialog: (() -> Unit)? = null
) {
    when (result) {
        is AttendanceResult.Success -> {
            AlertDialog(
                onDismissRequest = onDismiss,
                icon = {
                    Box(
                        modifier = Modifier
                            .size(54.dp)
                            .background(InRangeGreen.copy(alpha = 0.15f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = "Başarılı",
                            tint = InRangeGreen,
                            modifier = Modifier.size(34.dp)
                        )
                    }
                },
                title = {
                    Text(
                        text = "${result.record.recordType} Başarılı",
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                },
                text = {
                    Column {
                        Text(
                            text = result.message,
                            fontSize = 14.sp,
                            lineHeight = 20.sp
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = "Konum Doğrulama: 30 Metre Yarıçap İçi (✓ Onaylı)",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = InRangeGreen
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = onDismiss,
                        colors = ButtonDefaults.buttonColors(containerColor = InRangeGreen)
                    ) {
                        Text("Tamam", color = Color.White)
                    }
                }
            )
        }

        is AttendanceResult.DistanceExceeded -> {
            AlertDialog(
                onDismissRequest = onDismiss,
                icon = {
                    Box(
                        modifier = Modifier
                            .size(54.dp)
                            .background(OutOfRangeRed.copy(alpha = 0.15f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Warning,
                            contentDescription = "Konum Uyarısı",
                            tint = OutOfRangeRed,
                            modifier = Modifier.size(34.dp)
                        )
                    }
                },
                title = {
                    Text(
                        text = "⚠️ 30 Metre Sınırı Aşıldı!",
                        fontWeight = FontWeight.Bold,
                        color = OutOfRangeRed
                    )
                },
                text = {
                    Column {
                        Text(
                            text = result.message,
                            fontSize = 14.sp,
                            lineHeight = 20.sp
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(OutOfRangeRed.copy(alpha = 0.1f), RoundedCornerShape(8.dp))
                                .padding(8.dp)
                        ) {
                            Text(
                                text = "İhlal kaydı IT ve İK güvenlik merkezine loglanmıştır.",
                                fontSize = 12.sp,
                                color = OutOfRangeRed,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = onDismiss,
                        colors = ButtonDefaults.buttonColors(containerColor = OutOfRangeRed)
                    ) {
                        Text("Anladım", color = Color.White)
                    }
                },
                dismissButton = {
                    if (onOpenExcuseDialog != null) {
                        OutlinedButton(onClick = {
                            onDismiss()
                            onOpenExcuseDialog()
                        }) {
                            Text("Mazeret Bildir")
                        }
                    }
                }
            )
        }

        is AttendanceResult.MockLocationDetected -> {
            AlertDialog(
                onDismissRequest = onDismiss,
                icon = {
                    Box(
                        modifier = Modifier
                            .size(54.dp)
                            .background(OutOfRangeRed.copy(alpha = 0.15f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Shield,
                            contentDescription = "Sahte konum engellendi",
                            tint = OutOfRangeRed,
                            modifier = Modifier.size(34.dp)
                        )
                    }
                },
                title = {
                    Text(
                        text = "🚫 Sahte Konum (Mock GPS) Engellendi",
                        fontWeight = FontWeight.Bold,
                        color = OutOfRangeRed
                    )
                },
                text = {
                    Column {
                        Text(
                            text = result.message,
                            fontSize = 14.sp,
                            lineHeight = 20.sp
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(OutOfRangeRed.copy(alpha = 0.1f), RoundedCornerShape(8.dp))
                                .padding(8.dp)
                        ) {
                            Text(
                                text = "MOCK_LOCATION ihlali yüksek öncelikli güvenlik alarmı olarak İK ve BT birimlerine kaydedildi.",
                                fontSize = 12.sp,
                                color = OutOfRangeRed,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = onDismiss,
                        colors = ButtonDefaults.buttonColors(containerColor = OutOfRangeRed)
                    ) {
                        Text("Anladım", color = Color.White)
                    }
                }
            )
        }

        is AttendanceResult.Error -> {
            AlertDialog(
                onDismissRequest = onDismiss,
                title = { Text("Hata") },
                text = { Text(result.errorMessage) },
                confirmButton = {
                    Button(onClick = onDismiss) { Text("Kapat") }
                }
            )
        }
    }
}

@Composable
fun ExcuseSubmissionDialog(
    currentDistanceMeters: Double,
    onDismiss: () -> Unit,
    onSubmit: (String) -> Unit
) {
    var reasonText by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Şube Dışı Mazeret Bildirimi",
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column {
                Text(
                    text = "Şube merkezine ${"%.1f".format(currentDistanceMeters)} metre mesafedesiniz (30m kuralı dışı). Giriş/çıkış gerekçenizi belirtiniz:",
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = reasonText,
                    onValueChange = { reasonText = it },
                    label = { Text("Mazeret / Açıklama") },
                    placeholder = { Text("Örn: Dış müşteri toplantısı, şube önü araç parkı vs.") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (reasonText.isNotBlank()) {
                        onSubmit(reasonText)
                        onDismiss()
                    }
                },
                enabled = reasonText.isNotBlank()
            ) {
                Text("İK'ya İlet")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Vazgeç")
            }
        }
    )
}

@Composable
fun KvkkConsentDialog(
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                imageVector = Icons.Default.Shield,
                contentDescription = "KVKK",
                tint = com.example.ui.theme.PrimaryBlue,
                modifier = Modifier.size(36.dp)
            )
        },
        title = {
            Text(
                text = "KVKK Aydınlatma Metni & Gizlilik",
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(vertical = 4.dp)
            ) {
                Text(
                    text = "Albayrak Tasarruf Finansman A.Ş. Personel Devam Kontrol Sistemi (PDKS) Konum Verisi İşleme İlkeleri:",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "1. Veri Sorumlusu: 6698 Sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu Albayrak Tasarruf Finansman A.Ş.'dir.\n\n" +
                           "2. İşleme Amacı: Konum bilginiz yalnızca mesai başlangıç ve bitiş anlarında, 6361 sayılı Kanun ve BDDK düzenlemeleri çerçevesinde şube fiziki mekan güvenliği ile işe devam takibinin doğrulanması amacıyla işlenir.\n\n" +
                           "3. Kesintisiz Takip Yapılmaz: Uygulama arka planda sürekli GPS veya konum takibi yapmaz. Yalnızca 'Giriş Yap' veya 'Çıkış Yap' butonuna bastığınız anda şube merkezine 30 metre mesafede olup olmadığınız anlık olarak doğrulanır.\n\n" +
                           "4. Veri Güvenliği: Toplanan kayıtlar kurumsal güvenlik duvarı arkasındaki şifreli kurumsal sunucularda saklanır ve yetkisiz üçüncü şahıslarla paylaşılmaz.",
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = com.example.ui.theme.PrimaryBlue)
            ) {
                Text("Okudum, Anladım")
            }
        }
    )
}
