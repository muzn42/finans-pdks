package com.example.ui.screens

import android.widget.Toast
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.ui.MainViewModel
import com.example.ui.components.MinimalBasicButton
import com.example.ui.components.MinimalButtonVariant
import com.example.ui.components.MinimalSegmentedControl
import com.example.ui.theme.*
import com.example.util.SoundEffectPlayer

private data class QuickPersonnelProfile(
    val shortLabel: String,
    val code: String,
    val fullName: String,
    val titleDept: String,
    val branchLabel: String
)

@Composable
fun LoginScreen(viewModel: MainViewModel) {
    val context = LocalContext.current
    val employees by viewModel.employees.collectAsState()
    val branches by viewModel.branches.collectAsState()
    val loginError by viewModel.loginError.collectAsState()

    var selectedProfileIdx by remember { mutableIntStateOf(0) }
    var username by remember { mutableStateOf("FN-1048") }
    var password by remember { mutableStateOf("123456") }
    var passwordVisible by remember { mutableStateOf(false) }
    var showForgotPassDialog by remember { mutableStateOf(false) }

    // Yalnızca Personel Hızlı Seçim Profilleri (İK ve BT girişi mobilden kaldırıldı)
    val profiles = remember(employees, branches) {
        val branchMap = branches.associateBy { it.id }
        val p1 = employees.getOrNull(0)
        val p2 = employees.getOrNull(1)
        val p3 = employees.getOrNull(2)

        listOf(
            QuickPersonnelProfile(
                shortLabel = p1?.employeeCode ?: "FN-1048",
                code = p1?.employeeCode ?: "FN-1048",
                fullName = p1?.fullName ?: "Ahmet Yılmaz",
                titleDept = "${p1?.title ?: "Kıdemli Tasarruf Danışmanı"} · ${p1?.department ?: "Tasarruf Finansman Satış"}",
                branchLabel = branchMap[p1?.branchId]?.name ?: "Genel Müdürlük (Ataşehir)"
            ),
            QuickPersonnelProfile(
                shortLabel = p2?.employeeCode ?: "FN-2091",
                code = p2?.employeeCode ?: "FN-2091",
                fullName = p2?.fullName ?: "Zeynep Kaya",
                titleDept = "${p2?.title ?: "Tasarruf Sözleşme Uzmanı"} · ${p2?.department ?: "Şube Operasyon"}",
                branchLabel = branchMap[p2?.branchId]?.name ?: "Genel Müdürlük (Ataşehir)"
            ),
            QuickPersonnelProfile(
                shortLabel = p3?.employeeCode ?: "FN-3114",
                code = p3?.employeeCode ?: "FN-3114",
                fullName = p3?.fullName ?: "Caner Özdemir",
                titleDept = "${p3?.title ?: "Teslimat & Finansman Yöneticisi"} · ${p3?.department ?: "Tahsis & Teslimat"}",
                branchLabel = branchMap[p3?.branchId]?.name ?: "Adana / Seyhan Şube"
            )
        )
    }

    val activeProfile = profiles[selectedProfileIdx]

    val infiniteTransition = rememberInfiniteTransition(label = "login_hero_pulse")
    val pulseRadiusFactor by infiniteTransition.animateFloat(
        initialValue = 0.94f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(
            animation = tween(2800, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_radius"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BgCanvas)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // =================================================================
            // 1. WEB DASHBOARD İLE UYUMLU MİMARİ KOYU HERO BAŞLIK ALANI
            // =================================================================
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(AlbayrakDarkSurface)
            ) {
                Canvas(modifier = Modifier.matchParentSize()) {
                    val c = Offset(size.width * 0.90f, size.height * 0.22f)
                    drawCircle(
                        brush = Brush.radialGradient(
                            colors = listOf(
                                AlbayrakRed.copy(alpha = 0.24f),
                                Color.Transparent
                            ),
                            center = c,
                            radius = size.width * 0.70f * pulseRadiusFactor
                        ),
                        center = c,
                        radius = size.width * 0.70f * pulseRadiusFactor
                    )
                    for (i in 1..3) {
                        drawCircle(
                            color = Color.White.copy(alpha = 0.05f),
                            radius = (size.width * 0.21f) * i * pulseRadiusFactor,
                            center = Offset(size.width * 0.86f, size.height * 0.82f),
                            style = Stroke(width = 1.dp.toPx())
                        )
                    }
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(start = 22.dp, end = 22.dp, top = 20.dp, bottom = 44.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Image(
                                painter = painterResource(id = R.drawable.ic_albayrak_emblem),
                                contentDescription = "Albayrak Finans Logosu",
                                modifier = Modifier.size(38.dp)
                            )

                            Column {
                                Text(
                                    text = "Albayrak Finans",
                                    color = Color.White,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = (-0.3).sp
                                )
                                Text(
                                    text = "Mobil Personel Yoklama & Kariyer Portalı",
                                    color = Color.White.copy(alpha = 0.60f),
                                    fontSize = 11.sp
                                )
                            }
                        }

                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(999.dp))
                                .background(Color.White.copy(alpha = 0.08f))
                                .border(1.dp, Color.White.copy(alpha = 0.14f), RoundedCornerShape(999.dp))
                                .padding(horizontal = 10.dp, vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(StatusOk)
                            )
                            Text(
                                text = "${branches.size.coerceAtLeast(54)} Şube · 30m Harita",
                                color = Color.White.copy(alpha = 0.90f),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(22.dp))

                    Text(
                        text = "Şube harita konumu ve\n30m mesai tek dokunuşta.",
                        color = Color.White,
                        fontSize = 24.sp,
                        lineHeight = 30.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = (-0.6).sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Şubenizin açık adresini ve kendi canlı konumunuzu harita üzerinde görün, 30 metre geofence alanından giriş-çıkış yapın ve kişisel PDKS analizinizi takip edin.",
                        color = Color.White.copy(alpha = 0.68f),
                        fontSize = 12.sp,
                        lineHeight = 17.sp
                    )
                }
            }

            // =================================================================
            // 2. SADECE PERSONEL GİRİŞ KARTI (İK & BT Girişleri Kaldırıldı)
            // =================================================================
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .offset(y = (-24).dp)
                    .padding(horizontal = 16.dp)
            ) {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .shadow(
                            elevation = 12.dp,
                            shape = RoundedCornerShape(20.dp),
                            ambientColor = Color.Black.copy(alpha = 0.09f),
                            spotColor = Color.Black.copy(alpha = 0.09f)
                        ),
                    shape = RoundedCornerShape(20.dp),
                    color = CardSurface,
                    border = BorderStroke(1.dp, LineHairline)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "Personel Girişi",
                                    color = InkPrimary,
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = (-0.4).sp
                                )
                                Text(
                                    text = "Kurumsal sicil numaranız veya e-postanız ile oturum açın",
                                    color = InkMuted,
                                    fontSize = 11.5.sp
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(AlbayrakRedLight)
                                    .padding(horizontal = 9.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = "Sadece Personel",
                                    color = AlbayrakRed,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        Text(
                            text = "Hızlı Demo Personel Seçimi",
                            color = InkSecondary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(6.dp))

                        MinimalSegmentedControl(
                            items = profiles.map { it.shortLabel },
                            selectedIndex = selectedProfileIdx,
                            onSelect = { idx ->
                                selectedProfileIdx = idx
                                viewModel.clearLoginError()
                                username = profiles[idx].code
                                password = "123456"
                            }
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        AnimatedContent(
                            targetState = activeProfile,
                            transitionSpec = {
                                fadeIn(tween(180)) togetherWith fadeOut(tween(120))
                            },
                            label = "demo_personnel_card"
                        ) { prof ->
                            val initials = prof.fullName.split(" ")
                                .mapNotNull { it.firstOrNull()?.uppercaseChar() }
                                .take(2)
                                .joinToString("")

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(BgCanvas)
                                    .border(1.dp, LineHairline, RoundedCornerShape(12.dp))
                                    .clickable {
                                        username = prof.code
                                        password = "123456"
                                    }
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(38.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(AlbayrakRed),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = initials,
                                        color = Color.White,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }

                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = prof.fullName,
                                        color = InkPrimary,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        text = prof.titleDept,
                                        color = InkMuted,
                                        fontSize = 11.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                                        modifier = Modifier.padding(top = 2.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.LocationOn,
                                            contentDescription = null,
                                            tint = AlbayrakRed,
                                            modifier = Modifier.size(11.dp)
                                        )
                                        Text(
                                            text = prof.branchLabel,
                                            color = InkSecondary,
                                            fontSize = 10.5.sp,
                                            fontWeight = FontWeight.Medium,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }

                                Column(horizontalAlignment = Alignment.End) {
                                    Text(
                                        text = prof.code,
                                        color = InkPrimary,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "Aktif Kadro",
                                        color = StatusOk,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        MinimalLoginField(
                            label = "Personel Sicil Numarası veya E-Posta",
                            value = username,
                            onValueChange = {
                                username = it
                                viewModel.clearLoginError()
                            },
                            placeholder = "FN-1048 veya ad.soyad@albayrakfinans.com.tr",
                            leadingIcon = Icons.Default.Badge,
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Text,
                                imeAction = ImeAction.Next
                            )
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        MinimalLoginField(
                            label = "Personel Parolası",
                            value = password,
                            onValueChange = {
                                password = it
                                viewModel.clearLoginError()
                            },
                            placeholder = "••••••••",
                            leadingIcon = Icons.Default.Lock,
                            isPassword = true,
                            passwordVisible = passwordVisible,
                            onTogglePassword = { passwordVisible = !passwordVisible },
                            headerRightText = "Parolamı unuttum / BT Destek",
                            onHeaderRightClick = { showForgotPassDialog = true },
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Password,
                                imeAction = ImeAction.Done
                            )
                        )

                        if (loginError != null) {
                            Spacer(modifier = Modifier.height(12.dp))
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(StatusBadSoft)
                                    .border(1.dp, StatusBad.copy(alpha = 0.25f), RoundedCornerShape(10.dp))
                                    .padding(horizontal = 12.dp, vertical = 9.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.ErrorOutline,
                                    contentDescription = null,
                                    tint = StatusBad,
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(
                                    text = loginError ?: "",
                                    color = StatusBad,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(18.dp))

                        val loginBtnInteraction = remember { MutableInteractionSource() }
                        val isBtnPressed by loginBtnInteraction.collectIsPressedAsState()
                        val btnScale by animateFloatAsState(
                            targetValue = if (isBtnPressed) 0.97f else 1f,
                            animationSpec = spring(
                                dampingRatio = Spring.DampingRatioMediumBouncy,
                                stiffness = Spring.StiffnessMediumLow
                            ),
                            label = "login_btn_scale"
                        )

                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp)
                                .graphicsLayer {
                                    scaleX = btnScale
                                    scaleY = btnScale
                                },
                            shape = RoundedCornerShape(13.dp),
                            color = InkPrimary,
                            interactionSource = loginBtnInteraction,
                            onClick = {
                                val ok = viewModel.login(username, password)
                                if (ok) {
                                    SoundEffectPlayer.playCheckInChime(context)
                                } else {
                                    SoundEffectPlayer.playWarningTone(context)
                                }
                            }
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(horizontal = 16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = "Personel Olarak Giriş Yap",
                                        color = Color.White,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        letterSpacing = (-0.2).sp
                                    )
                                    Text(
                                        text = "Sicil: $username · 30m Harita & Yoklama",
                                        color = Color.White.copy(alpha = 0.65f),
                                        fontSize = 10.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }

                                Box(
                                    modifier = Modifier
                                        .size(34.dp)
                                        .clip(RoundedCornerShape(9.dp))
                                        .background(AlbayrakRed),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                        contentDescription = "Giriş Yap",
                                        tint = Color.White,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(SubtleSurface)
                                .padding(horizontal = 11.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.DesktopWindows,
                                contentDescription = null,
                                tint = InkSecondary,
                                modifier = Modifier.size(15.dp)
                            )
                            Text(
                                text = "İK Yönetimi, BT Güvenlik ve Admin işlemleri kurumsal Web Dashboard üzerinden yürütülmektedir.",
                                color = InkMuted,
                                fontSize = 10.5.sp,
                                lineHeight = 14.sp
                            )
                        }
                    }
                }
            }
        }

        // =================================================================
        // 3. ALT GÜVENLİK & KVKK DOĞRULAMA ŞERİDİ
        // =================================================================
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                FooterSecurityTag(Icons.Default.VerifiedUser, "KVKK Uyumlu")
                FooterSecurityTag(Icons.Default.Map, "Canlı Şube Haritası")
                FooterSecurityTag(Icons.Default.GpsFixed, "30m Geofence")
            }
            Text(
                text = "© 2026 Albayrak Tasarruf Finansman A.Ş. · Mobil Personel Uygulaması",
                color = InkFaint,
                fontSize = 11.sp
            )
        }
    }

    if (showForgotPassDialog) {
        ForgotPasswordSupportModal(
            initialUsername = username,
            onDismiss = { showForgotPassDialog = false },
            onSubmit = { _, _, _ ->
                showForgotPassDialog = false
                SoundEffectPlayer.playCheckInChime(context)
                Toast.makeText(
                    context,
                    "BT Destek talebiniz (#BT-${(1040..1099).random()}) Web BT Portalına iletildi.",
                    Toast.LENGTH_LONG
                ).show()
            }
        )
    }
}

@Composable
private fun MinimalLoginField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    leadingIcon: ImageVector,
    isPassword: Boolean = false,
    passwordVisible: Boolean = false,
    onTogglePassword: (() -> Unit)? = null,
    headerRightText: String? = null,
    onHeaderRightClick: (() -> Unit)? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    val borderColor by animateColorAsState(
        targetValue = if (isFocused) InkPrimary else LineHairline,
        animationSpec = tween(150),
        label = "field_border"
    )
    val bgColor by animateColorAsState(
        targetValue = if (isFocused) CardSurface else BgCanvas,
        animationSpec = tween(150),
        label = "field_bg"
    )

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                color = InkSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            )
            if (headerRightText != null && onHeaderRightClick != null) {
                Text(
                    text = headerRightText,
                    color = AlbayrakRed,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .clickable { onHeaderRightClick() }
                        .padding(horizontal = 4.dp, vertical = 2.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(6.dp))

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(11.dp))
                .background(bgColor)
                .border(if (isFocused) 1.5.dp else 1.dp, borderColor, RoundedCornerShape(11.dp))
                .padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(7.dp))
                    .background(if (isFocused) InkPrimary.copy(alpha = 0.08f) else SubtleSurface),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = leadingIcon,
                    contentDescription = null,
                    tint = if (isFocused) InkPrimary else InkMuted,
                    modifier = Modifier.size(15.dp)
                )
            }

            Box(
                modifier = Modifier.weight(1f),
                contentAlignment = Alignment.CenterStart
            ) {
                if (value.isEmpty()) {
                    Text(
                        text = placeholder,
                        color = InkFaint,
                        fontSize = 13.sp
                    )
                }
                BasicTextField(
                    value = value,
                    onValueChange = onValueChange,
                    singleLine = true,
                    textStyle = TextStyle(
                        color = InkPrimary,
                        fontSize = 14.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.SemiBold
                    ),
                    cursorBrush = SolidColor(AlbayrakRed),
                    visualTransformation = if (isPassword && !passwordVisible) {
                        PasswordVisualTransformation()
                    } else {
                        VisualTransformation.None
                    },
                    keyboardOptions = keyboardOptions,
                    interactionSource = interactionSource,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            if (isPassword && onTogglePassword != null) {
                IconButton(
                    onClick = onTogglePassword,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                        contentDescription = "Parolayı Göster",
                        tint = InkMuted,
                        modifier = Modifier.size(17.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun FooterSecurityTag(icon: ImageVector, label: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = InkMuted,
            modifier = Modifier.size(13.dp)
        )
        Text(
            text = label,
            color = InkMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun ForgotPasswordSupportModal(
    initialUsername: String,
    onDismiss: () -> Unit,
    onSubmit: (String, String, String) -> Unit
) {
    var userField by remember { mutableStateOf(initialUsername) }
    var selectedIssueIdx by remember { mutableIntStateOf(0) }
    var description by remember { mutableStateOf("") }

    val issueTypes = listOf("Parola Sıfırlama", "Cihaz Değişikliği", "Hesap Kilidi")

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CardSurface,
        shape = RoundedCornerShape(16.dp),
        title = {
            Column {
                Text(
                    text = "BT Destek & Parola Sıfırlama",
                    color = InkPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "Talebiniz Web BT Portalı ekranına anlık olarak düşer.",
                    color = InkMuted,
                    fontSize = 12.sp
                )
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                MinimalSegmentedControl(
                    items = issueTypes,
                    selectedIndex = selectedIssueIdx,
                    onSelect = { selectedIssueIdx = it }
                )

                OutlinedTextField(
                    value = userField,
                    onValueChange = { userField = it },
                    label = { Text("Sicil No veya E-Posta", fontSize = 12.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Açıklama (İsteğe bağlı)", fontSize = 12.sp) },
                    placeholder = { Text("Örn: Yeni telefona geçiş yaptım / parolamı unuttum", fontSize = 12.sp) },
                    minLines = 2,
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(SubtleSurface)
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = null,
                        tint = InkSecondary,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = "BT uzmanı onayladığında 15 dakika geçerli tek kullanımlık parola üretilir.",
                        color = InkSecondary,
                        fontSize = 11.sp
                    )
                }
            }
        },
        confirmButton = {
            MinimalBasicButton(
                text = "BT'ye Talep Gönder",
                onClick = { onSubmit(userField, issueTypes[selectedIssueIdx], description) },
                variant = MinimalButtonVariant.DARK
            )
        },
        dismissButton = {
            MinimalBasicButton(
                text = "Vazgeç",
                onClick = onDismiss,
                variant = MinimalButtonVariant.OUTLINE
            )
        }
    )
}
