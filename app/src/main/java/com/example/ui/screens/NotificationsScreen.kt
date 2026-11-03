package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.MainViewModel
import com.example.ui.components.*
import com.example.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun NotificationsScreen(viewModel: MainViewModel) {
    val notifications by viewModel.filteredNotifications.collectAsState()
    var filterId by remember { mutableStateOf("ALL") }

    val filtered = remember(notifications, filterId) {
        when (filterId) {
            "UNREAD" -> notifications.filter { !it.isRead }
            else -> notifications
        }
    }

    val timeFmt = remember { SimpleDateFormat("dd MMM HH:mm", Locale("tr", "TR")) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(BgCanvas),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                MinimalFilterChipRow(
                    items = listOf(
                        FilterChipItem("ALL", "Tümü", notifications.size),
                        FilterChipItem("UNREAD", "Okunmamış", notifications.count { !it.isRead })
                    ),
                    selectedId = filterId,
                    onSelect = { filterId = it },
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(8.dp))
                MinimalBasicButton(
                    text = "Tümünü Okundu İşaretle",
                    onClick = { viewModel.markAllNotificationsAsRead() },
                    variant = MinimalButtonVariant.OUTLINE,
                    icon = Icons.Default.DoneAll,
                    height = 32.dp
                )
            }
        }

        if (filtered.isEmpty()) {
            item {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = CardSurface,
                    border = BorderStroke(1.dp, LineHairline),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(28.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Gösterilecek bildirim bulunmuyor.",
                            color = InkMuted,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        } else {
            items(filtered, key = { it.id }) { notif ->
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = CardSurface,
                    border = BorderStroke(1.dp, LineHairline),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { viewModel.markNotificationAsRead(notif.id) }
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Box(
                            modifier = Modifier
                                .padding(top = 5.dp)
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(if (notif.isRead) InkFaint else AlbayrakRed)
                        )
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = notif.title,
                                    color = InkPrimary,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = timeFmt.format(Date(notif.timestamp)),
                                    color = InkMuted,
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                            Text(
                                text = notif.message,
                                color = InkSecondary,
                                fontSize = 12.sp
                            )
                        }
                    }
                }
            }
        }
    }
}
