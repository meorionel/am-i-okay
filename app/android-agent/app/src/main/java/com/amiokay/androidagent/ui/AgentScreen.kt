package com.amiokay.androidagent.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccessibilityNew
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.RunningWithErrors
import androidx.compose.material.icons.outlined.Stop
import androidx.compose.material.icons.outlined.Terminal
import androidx.compose.material.icons.outlined.Wifi
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.amiokay.androidagent.domain.InstalledAppOption
import com.amiokay.androidagent.service.AgentConnectionState
import com.amiokay.androidagent.service.AgentLogEntry
import com.amiokay.androidagent.service.AgentLogLevel

@Composable
fun AgentScreen(
    uiState: AgentUiState,
    onBackendUrlChanged: (String) -> Unit,
    onAgentNameChanged: (String) -> Unit,
    onStatusTextChanged: (String) -> Unit,
    onExcludedAppsFilterChanged: (String) -> Unit,
    onExcludedPackageToggled: (String) -> Unit,
    onStartClicked: () -> Unit,
    onStopClicked: () -> Unit,
    onClearLogsClicked: () -> Unit,
    onOpenAccessibilitySettings: () -> Unit,
    onMessageConsumed: () -> Unit
) {
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(uiState.message) {
        val message = uiState.message ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        onMessageConsumed()
    }

    Scaffold(
        containerColor = AppColors.Screen,
        topBar = {
            Surface(color = AppColors.Screen) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                ) {
                    Text(
                        text = "Android Agent MVP",
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp),
                        color = AppColors.TextPrimary,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Medium
                    )
                    HorizontalDivider(color = AppColors.SurfaceVariant)
                }
            }
        },
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    LabeledInputCard(
                        label = "Backend URL",
                        value = uiState.backendUrlInput,
                        placeholder = "ws://example.com/ws/agent",
                        onValueChange = onBackendUrlChanged
                    )
                    LabeledInputCard(
                        label = "Agent Name",
                        value = uiState.agentNameInput,
                        placeholder = "android-agent",
                        onValueChange = onAgentNameChanged
                    )
                    LabeledInputCard(
                        label = "Status Text",
                        value = uiState.statusTextInput,
                        placeholder = "type something for the dashboard",
                        onValueChange = onStatusTextChanged
                    )
                    ExcludedAppsCard(
                        filterText = uiState.excludedAppsFilterInput,
                        installedApps = uiState.installedApps,
                        selectedPackages = uiState.selectedExcludedPackages,
                        onFilterChanged = onExcludedAppsFilterChanged,
                        onPackageToggled = onExcludedPackageToggled
                    )
                }
            }

            item {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Button(
                        onClick = onStartClicked,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(999.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AppColors.Primary,
                            contentColor = AppColors.OnPrimary
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.PlayArrow,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.size(8.dp))
                        Text(
                            text = "Start Agent",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                        if (maxWidth < 360.dp) {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                SecondaryActionButton(
                                    text = "Stop Agent",
                                    icon = Icons.Outlined.Stop,
                                    outlined = true,
                                    onClick = onStopClicked
                                )
                                SecondaryActionButton(
                                    text = "Accessibility",
                                    icon = Icons.Outlined.AccessibilityNew,
                                    outlined = false,
                                    onClick = onOpenAccessibilitySettings
                                )
                            }
                        } else {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                SecondaryActionButton(
                                    text = "Stop Agent",
                                    icon = Icons.Outlined.Stop,
                                    outlined = true,
                                    onClick = onStopClicked,
                                    modifier = Modifier.weight(1f)
                                )
                                SecondaryActionButton(
                                    text = "Accessibility",
                                    icon = Icons.Outlined.AccessibilityNew,
                                    outlined = false,
                                    onClick = onOpenAccessibilitySettings,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }
                }
            }

            item {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatusCard(
                        icon = Icons.Outlined.Wifi,
                        iconTint = connectionColor(uiState.connectionStatus),
                        iconBackground = AppColors.SuccessSoft,
                        label = "Connection Status",
                        value = uiState.connectionStatus,
                        valueColor = connectionColor(uiState.connectionStatus),
                        subtitle = null
                    )
                    StatusCard(
                        icon = Icons.Outlined.RunningWithErrors,
                        iconTint = AppColors.Primary,
                        iconBackground = AppColors.SecondarySurface,
                        label = "Service Running",
                        value = if (uiState.isServiceRunning) "Yes" else "No",
                        valueColor = AppColors.TextPrimary,
                        subtitle = uiState.lastError
                    )
                }
            }

            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Terminal,
                                contentDescription = null,
                                tint = AppColors.TextSecondary,
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                text = "System Logs",
                                color = AppColors.TextSecondary,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                        Text(
                            text = "Clear Logs",
                            color = AppColors.Primary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .clickable(onClick = onClearLogsClicked)
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 320.dp, max = 460.dp)
                            .clip(RoundedCornerShape(24.dp))
                            .background(AppColors.SurfaceVariantSoft)
                            .border(1.dp, AppColors.SurfaceVariant, RoundedCornerShape(24.dp))
                            .padding(16.dp)
                    ) {
                        if (uiState.logEntries.isEmpty()) {
                            Text(
                                text = "No logs yet",
                                color = AppColors.TextMuted,
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontFamily = FontFamily.Monospace
                                )
                            )
                        } else {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                items(uiState.logEntries.asReversed()) { entry ->
                                    LogEntryItem(entry)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LabeledInputCard(
    label: String,
    value: String,
    placeholder: String,
    onValueChange: (String) -> Unit
) {
    Box {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp),
            singleLine = true,
            textStyle = TextStyle(
                fontSize = 16.sp,
                fontWeight = FontWeight.Normal,
                color = AppColors.TextPrimary
            ),
            placeholder = {
                Text(
                    text = placeholder,
                    color = AppColors.TextMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            },
            shape = RoundedCornerShape(16.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = AppColors.SurfaceVariantFaint,
                unfocusedContainerColor = AppColors.SurfaceVariantFaint,
                focusedBorderColor = AppColors.Primary,
                unfocusedBorderColor = Color.Transparent,
                cursorColor = AppColors.Primary,
                focusedTextColor = AppColors.TextPrimary,
                unfocusedTextColor = AppColors.TextPrimary
            )
        )
        Text(
            text = label,
            color = AppColors.Primary,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier
                .padding(start = 12.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(AppColors.Screen)
                .padding(horizontal = 4.dp)
        )
    }
}

@Composable
private fun ExcludedAppsCard(
    filterText: String,
    installedApps: List<InstalledAppOption>,
    selectedPackages: Set<String>,
    onFilterChanged: (String) -> Unit,
    onPackageToggled: (String) -> Unit
) {
    val normalizedFilter = filterText.trim().lowercase()
    val filteredApps = installedApps.filter { app ->
        normalizedFilter.isEmpty() ||
            app.appName.lowercase().contains(normalizedFilter) ||
            app.packageName.lowercase().contains(normalizedFilter)
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        color = AppColors.SurfaceVariantSoft,
        border = BorderStroke(1.dp, AppColors.SurfaceVariant)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Skip Reporting Apps",
                color = AppColors.TextPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = "Selected apps will not trigger a new report. The dashboard keeps the last reported app.",
                color = AppColors.TextMuted,
                fontSize = 12.sp,
                lineHeight = 18.sp
            )
            LabeledInputCard(
                label = "Search Apps",
                value = filterText,
                placeholder = "search by app name or package",
                onValueChange = onFilterChanged
            )
            Text(
                text = "Selected ${selectedPackages.size}",
                color = AppColors.Primary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 160.dp, max = 280.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(AppColors.SurfaceVariantFaint)
                    .border(1.dp, AppColors.SurfaceVariant, RoundedCornerShape(20.dp))
            ) {
                if (filteredApps.isEmpty()) {
                    Text(
                        text = if (installedApps.isEmpty()) {
                            "No launchable apps found"
                        } else {
                            "No apps match the current filter"
                        },
                        modifier = Modifier.padding(16.dp),
                        color = AppColors.TextMuted,
                        fontSize = 13.sp
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(vertical = 8.dp)
                    ) {
                        items(filteredApps, key = { it.packageName }) { app ->
                            SelectableAppRow(
                                app = app,
                                selected = selectedPackages.contains(app.packageName),
                                onClick = { onPackageToggled(app.packageName) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SelectableAppRow(
    app: InstalledAppOption,
    selected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Checkbox(
            checked = selected,
            onCheckedChange = { onClick() }
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(
                text = app.appName,
                color = AppColors.TextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = app.packageName,
                color = AppColors.TextMuted,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun SecondaryActionButton(
    text: String,
    icon: ImageVector,
    outlined: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    if (outlined) {
        OutlinedButton(
            onClick = onClick,
            modifier = modifier.height(48.dp),
            shape = RoundedCornerShape(999.dp),
            border = BorderStroke(2.dp, AppColors.Outline),
            colors = ButtonDefaults.outlinedButtonColors(
                containerColor = Color.Transparent,
                contentColor = AppColors.Primary
            )
        ) {
            Icon(imageVector = icon, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(modifier = Modifier.size(8.dp))
            Text(
                text = text,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    } else {
        Button(
            onClick = onClick,
            modifier = modifier.height(48.dp),
            shape = RoundedCornerShape(999.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = AppColors.SecondarySurface,
                contentColor = AppColors.OnSecondarySurface
            )
        ) {
            Icon(imageVector = icon, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(modifier = Modifier.size(8.dp))
            Text(
                text = text,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun StatusCard(
    icon: ImageVector,
    iconTint: Color,
    iconBackground: Color,
    label: String,
    value: String,
    valueColor: Color,
    subtitle: String?
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        color = AppColors.SurfaceVariantSoft,
        border = BorderStroke(1.dp, AppColors.SurfaceVariant),
        tonalElevation = 0.dp,
        shadowElevation = 0.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 18.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(iconBackground),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = iconTint,
                    modifier = Modifier.size(22.dp)
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = label.uppercase(),
                    color = AppColors.TextSecondary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 1.2.sp
                )
                Text(
                    text = value,
                    color = valueColor,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
                if (!subtitle.isNullOrBlank()) {
                    Text(
                        text = subtitle,
                        color = AppColors.TextMuted,
                        fontSize = 12.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

@Composable
private fun LogEntryItem(entry: AgentLogEntry) {
    val levelColor = when (entry.level) {
        AgentLogLevel.INFO -> AppColors.Success
        AgentLogLevel.WARN -> AppColors.Warning
        AgentLogLevel.ERROR -> AppColors.Error
    }

    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(
            text = entry.timestamp,
            color = AppColors.Timestamp,
            fontFamily = FontFamily.Monospace,
            fontSize = 13.sp
        )
        Text(
            text = "[${entry.level.name}]",
            color = levelColor,
            fontFamily = FontFamily.Monospace,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = entry.message,
            color = AppColors.TextPrimary,
            fontFamily = FontFamily.Monospace,
            fontSize = 13.sp,
            lineHeight = 20.sp
        )
    }
}

private fun connectionColor(connectionStatus: String): Color {
    return when (connectionStatus) {
        AgentConnectionState.CONNECTED.name -> AppColors.Success
        AgentConnectionState.CONNECTING.name -> AppColors.Warning
        AgentConnectionState.ERROR.name -> AppColors.Error
        else -> AppColors.TextPrimary
    }
}

private object AppColors {
    val Screen = Color(0xFFFEF7FF)
    val Primary = Color(0xFF6750A4)
    val OnPrimary = Color(0xFFFFFFFF)
    val SecondarySurface = Color(0xFFE8DEF8)
    val OnSecondarySurface = Color(0xFF1D192B)
    val SurfaceVariant = Color(0xFFE7E0EC)
    val SurfaceVariantSoft = Color(0xFFF4EDF7)
    val SurfaceVariantFaint = Color(0xFFF8F1FA)
    val Outline = Color(0xFF79747E)
    val Success = Color(0xFF1B8E3F)
    val SuccessSoft = Color(0xFFDDF2E3)
    val Warning = Color(0xFF9A6700)
    val Error = Color(0xFFB3261E)
    val TextPrimary = Color(0xFF1D1B20)
    val TextSecondary = Color(0xFF49454F)
    val TextMuted = Color(0xFF6F6A73)
    val Timestamp = Color(0xFF8B80B6)
}
