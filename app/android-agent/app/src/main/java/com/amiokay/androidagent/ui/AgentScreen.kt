package com.amiokay.androidagent.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Article
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.Apps
import androidx.compose.material.icons.outlined.CheckBox
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.SettingsAccessibility
import androidx.compose.material.icons.outlined.Stop
import androidx.compose.material.icons.outlined.Terminal
import androidx.compose.material.icons.outlined.Wifi
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.Image
import androidx.core.graphics.drawable.toBitmap
import com.amiokay.androidagent.R
import com.amiokay.androidagent.domain.InstalledAppOption
import com.amiokay.androidagent.service.AgentConnectionState
import com.amiokay.androidagent.service.AgentLogEntry
import com.amiokay.androidagent.service.AgentLogLevel

private const val TwitterUrl = "https://x.com/meorionel"
private const val GitHubUrl = "https://github.com/meorionel/am-i-okay"
private const val AppVersion = "1.0.0"

private enum class AgentTab(
    val label: String,
    val icon: ImageVector
) {
    About("About", Icons.Outlined.Info),
    Control("Control", Icons.Outlined.SettingsAccessibility),
    Apps("Apps", Icons.Outlined.GridView),
    Logs("Logs", Icons.AutoMirrored.Outlined.Article)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AgentScreen(
    uiState: AgentUiState,
    onBackendUrlChanged: (String) -> Unit,
    onAgentNameChanged: (String) -> Unit,
    onAgentApiTokenChanged: (String) -> Unit,
    onStatusTextChanged: (String) -> Unit,
    onUpdateStatusTextClicked: () -> Unit,
    onExcludedAppsFilterChanged: (String) -> Unit,
    onExcludedPackageToggled: (String) -> Unit,
    onStartClicked: () -> Unit,
    onRestartClicked: () -> Unit,
    onStopClicked: () -> Unit,
    onSaveExcludedAppsClicked: () -> Unit,
    onClearLogsClicked: () -> Unit,
    onOpenAccessibilitySettings: () -> Unit,
    onOpenExternalLink: (String) -> Unit,
    onMessageConsumed: () -> Unit
) {
    val snackbarHostState = remember { SnackbarHostState() }
    var selectedTab by rememberSaveable { mutableStateOf(AgentTab.About) }

    LaunchedEffect(uiState.message) {
        val message = uiState.message ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        onMessageConsumed()
    }

    MaterialTheme(
        colorScheme = agentColorScheme()
    ) {
        Scaffold(
            modifier = Modifier.fillMaxSize(),
            containerColor = AppColors.Screen,
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            text = selectedTab.label,
                            fontWeight = FontWeight.SemiBold,
                            color = AppColors.TextPrimary
                        )
                    },
                    actions = {
                        if (selectedTab == AgentTab.Logs) {
                            TextButton(onClick = onClearLogsClicked) {
                                Text(
                                    text = "Clear Logs",
                                    color = AppColors.Primary,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = AppColors.Screen
                    ),
                    modifier = Modifier.statusBarsPadding()
                )
            },
            snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
            bottomBar = {
                NavigationBar(
                    containerColor = AppColors.NavBar,
                    tonalElevation = 0.dp
                ) {
                    AgentTab.entries.forEach { tab ->
                        NavigationBarItem(
                            selected = selectedTab == tab,
                            onClick = { selectedTab = tab },
                            icon = {
                                Icon(
                                    imageVector = tab.icon,
                                    contentDescription = tab.label
                                )
                            },
                            label = { Text(tab.label) },
                            colors = androidx.compose.material3.NavigationBarItemDefaults.colors(
                                selectedIconColor = AppColors.Primary,
                                selectedTextColor = AppColors.TextPrimary,
                                indicatorColor = AppColors.NavIndicator,
                                unselectedIconColor = AppColors.TextSecondary,
                                unselectedTextColor = AppColors.TextSecondary
                            )
                        )
                    }
                }
            }
        ) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .navigationBarsPadding()
            ) {
                when (selectedTab) {
                    AgentTab.About -> AboutPage(onOpenExternalLink = onOpenExternalLink)
                    AgentTab.Control -> ControlPage(
                        uiState = uiState,
                        onBackendUrlChanged = onBackendUrlChanged,
                        onAgentNameChanged = onAgentNameChanged,
                        onAgentApiTokenChanged = onAgentApiTokenChanged,
                        onStatusTextChanged = onStatusTextChanged,
                        onUpdateStatusTextClicked = onUpdateStatusTextClicked,
                        onStartClicked = onStartClicked,
                        onRestartClicked = onRestartClicked,
                        onStopClicked = onStopClicked,
                        onOpenAccessibilitySettings = onOpenAccessibilitySettings
                    )
                    AgentTab.Apps -> AppsPage(
                        uiState = uiState,
                        onExcludedAppsFilterChanged = onExcludedAppsFilterChanged,
                        onExcludedPackageToggled = onExcludedPackageToggled,
                        onSaveExcludedAppsClicked = onSaveExcludedAppsClicked
                    )
                    AgentTab.Logs -> LogsPage(
                        logEntries = uiState.logEntries
                    )
                }
            }
        }
    }
}

@Composable
private fun AboutPage(
    onOpenExternalLink: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        item {
            AboutHeroCard()
        }
        item {
            DeveloperCard()
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                SocialCard(
                    modifier = Modifier.weight(1f),
                    title = "Twitter / X",
                    icon = Icons.AutoMirrored.Outlined.OpenInNew,
                    onClick = { onOpenExternalLink(TwitterUrl) }
                )
                SocialCard(
                    modifier = Modifier.weight(1f),
                    title = "GitHub",
                    icon = Icons.AutoMirrored.Outlined.OpenInNew,
                    onClick = { onOpenExternalLink(GitHubUrl) }
                )
            }
        }
    }
}

@Composable
private fun AboutHeroCard() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Image(
            painter = painterResource(id = R.drawable.me),
            contentDescription = "Meorion avatar",
            modifier = Modifier
                .size(96.dp)
                .clip(RoundedCornerShape(24.dp))
                .background(AppColors.PrimaryContainer),
            contentScale = ContentScale.Crop
        )
        Spacer(modifier = Modifier.height(20.dp))
        Text(
            text = "am i okay",
            color = AppColors.TextPrimary,
            fontSize = 24.sp,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Surface(
            shape = RoundedCornerShape(999.dp),
            color = AppColors.NavIndicator
        ) {
            Text(
                text = "v$AppVersion",
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                color = AppColors.Primary,
                fontWeight = FontWeight.Medium,
                fontSize = 14.sp
            )
        }
    }
}

@Composable
private fun DeveloperCard() {
    ElevatedSectionCard {
        Text(
            text = "DEVELOPED BY",
            color = AppColors.Primary,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp
        )
        Spacer(modifier = Modifier.height(14.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            DeveloperAvatar()
            Column {
                Text(
                    text = "Meorion (AliceClodia)",
                    color = AppColors.TextPrimary,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "meorionel",
                    color = AppColors.TextSecondary,
                    fontSize = 14.sp
                )
            }
        }
    }
}

@Composable
private fun DeveloperAvatar() {
    Surface(
        modifier = Modifier.size(48.dp),
        shape = CircleShape,
        color = AppColors.AvatarBadge,
        border = BorderStroke(1.dp, AppColors.TextPrimary.copy(alpha = 0.12f)),
        shadowElevation = 0.dp
    ) {
        Image(
            painter = painterResource(id = R.drawable.me),
            contentDescription = "Developer avatar",
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )
    }
}

@Composable
private fun SocialCard(
    modifier: Modifier = Modifier,
    title: String,
    icon: ImageVector,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = AppColors.Card),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 26.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = AppColors.TextPrimary,
                modifier = Modifier.size(24.dp)
            )
            Text(
                text = title,
                color = AppColors.TextPrimary,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun ControlPage(
    uiState: AgentUiState,
    onBackendUrlChanged: (String) -> Unit,
    onAgentNameChanged: (String) -> Unit,
    onAgentApiTokenChanged: (String) -> Unit,
    onStatusTextChanged: (String) -> Unit,
    onUpdateStatusTextClicked: () -> Unit,
    onStartClicked: () -> Unit,
    onRestartClicked: () -> Unit,
    onStopClicked: () -> Unit,
    onOpenAccessibilitySettings: () -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        item {
            LabeledField(
                label = "Backend URL",
                value = uiState.backendUrlInput,
                onValueChange = onBackendUrlChanged
            )
        }
        item {
            LabeledField(
                label = "Agent Name",
                value = uiState.agentNameInput,
                onValueChange = onAgentNameChanged
            )
        }
        item {
            LabeledField(
                label = "Agent API Token",
                value = uiState.agentApiTokenInput,
                onValueChange = onAgentApiTokenChanged
            )
        }
        item {
            LabeledFieldWithAction(
                label = "Status Text",
                value = uiState.statusTextInput,
                onValueChange = onStatusTextChanged,
                actionLabel = "Update",
                onActionClick = onUpdateStatusTextClicked
            )
        }
        item {
            Button(
                onClick = onStartClicked,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(999.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = AppColors.Primary,
                    contentColor = Color.White
                )
            ) {
                Icon(Icons.Outlined.PlayArrow, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Start Agent", fontSize = 18.sp)
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                OutlinedButton(
                    onClick = onStopClicked,
                    modifier = Modifier
                        .weight(1f)
                        .height(56.dp),
                    shape = RoundedCornerShape(999.dp),
                    border = BorderStroke(1.dp, AppColors.Primary.copy(alpha = 0.35f)),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = AppColors.Primary
                    )
                ) {
                    Icon(Icons.Outlined.Stop, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Stop Agent")
                }
                FilledTonalButton(
                    onClick = onRestartClicked,
                    modifier = Modifier
                        .weight(1f)
                        .height(56.dp),
                    shape = RoundedCornerShape(999.dp),
                    colors = ButtonDefaults.filledTonalButtonColors(
                        containerColor = AppColors.NavIndicator,
                        contentColor = AppColors.TextPrimary
                    )
                ) {
                    Icon(Icons.Outlined.Refresh, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Restart")
                }
            }
        }
        item {
            OutlinedButton(
                onClick = onOpenAccessibilitySettings,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(999.dp),
                border = BorderStroke(1.dp, AppColors.Primary.copy(alpha = 0.2f)),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = AppColors.TextPrimary
                )
            ) {
                Icon(Icons.Outlined.SettingsAccessibility, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Accessibility")
            }
        }
        item {
            StatusTile(
                icon = Icons.Outlined.Wifi,
                iconTint = connectionColor(uiState.connectionStatus),
                label = "CONNECTION STATUS",
                value = uiState.connectionStatus
            )
        }
        item {
            StatusTile(
                icon = Icons.Outlined.CheckBox,
                iconTint = AppColors.Primary,
                label = "SERVICE RUNNING",
                value = if (uiState.isServiceRunning) "ACTIVE" else "INACTIVE"
            )
        }
    }
}

@Composable
private fun AppsPage(
    uiState: AgentUiState,
    onExcludedAppsFilterChanged: (String) -> Unit,
    onExcludedPackageToggled: (String) -> Unit,
    onSaveExcludedAppsClicked: () -> Unit
) {
    val normalizedFilter = uiState.excludedAppsFilterInput.trim().lowercase()
    val filteredApps = uiState.installedApps.filter { app ->
        normalizedFilter.isEmpty() ||
            app.appName.lowercase().contains(normalizedFilter) ||
            app.packageName.lowercase().contains(normalizedFilter)
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        item {
            Text(
                text = "Selected apps will not trigger a new report. The dashboard keeps the last reported app.",
                color = AppColors.TextSecondary,
                fontSize = 16.sp,
                lineHeight = 22.sp,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
        item {
            OutlinedTextField(
                value = uiState.excludedAppsFilterInput,
                onValueChange = onExcludedAppsFilterChanged,
                modifier = Modifier.fillMaxWidth(),
                leadingIcon = {
                    Icon(Icons.Outlined.Apps, contentDescription = null)
                },
                placeholder = {
                    Text("Search by app name or package")
                },
                singleLine = true,
                shape = RoundedCornerShape(999.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = AppColors.Card,
                    unfocusedContainerColor = AppColors.Card,
                    focusedBorderColor = Color.Transparent,
                    unfocusedBorderColor = Color.Transparent
                )
            )
        }
        item {
            Text(
                text = "Selected ${uiState.selectedExcludedPackages.size}",
                color = AppColors.Primary,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium
            )
        }
        if (filteredApps.isEmpty()) {
            item {
                ElevatedSectionCard {
                    Text(
                        text = "No apps match the current filter.",
                        color = AppColors.TextSecondary
                    )
                }
            }
        } else {
            items(filteredApps, key = { it.packageName }) { app ->
                AppSelectionRow(
                    app = app,
                    selected = uiState.selectedExcludedPackages.contains(app.packageName),
                    onToggle = { onExcludedPackageToggled(app.packageName) }
                )
            }
        }
        item {
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = onSaveExcludedAppsClicked,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(58.dp),
                shape = RoundedCornerShape(18.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = AppColors.Primary,
                    contentColor = Color.White
                )
            ) {
                Icon(Icons.AutoMirrored.Outlined.Article, contentDescription = null)
                Spacer(modifier = Modifier.width(10.dp))
                Text("Save Selection", fontSize = 20.sp)
            }
        }
    }
}

@Composable
private fun LogsPage(
    logEntries: List<AgentLogEntry>
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 14.dp, vertical = 8.dp)
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = AppColors.Card),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
            Column {
                Row(
                    modifier = Modifier.padding(horizontal = 18.dp, vertical = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Terminal,
                        contentDescription = null,
                        tint = AppColors.TextPrimary
                    )
                    Text(
                        text = "System Logs",
                        color = AppColors.TextPrimary,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 22.sp
                    )
                }
                HorizontalDivider(color = AppColors.Divider)
                if (logEntries.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(28.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No logs yet",
                            color = AppColors.TextSecondary,
                            textAlign = TextAlign.Center
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.heightIn(min = 240.dp),
                        contentPadding = PaddingValues(18.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(logEntries.asReversed()) { entry ->
                            LogEntryRow(entry)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ElevatedSectionCard(
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = AppColors.Card),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            content = content
        )
    }
}

@Composable
private fun LabeledField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit
) {
    Box(modifier = Modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp),
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = AppColors.Card,
                unfocusedContainerColor = AppColors.Card,
                focusedBorderColor = AppColors.TextSecondary,
                unfocusedBorderColor = AppColors.TextSecondary.copy(alpha = 0.7f),
                cursorColor = AppColors.Primary
            )
        )
        Text(
            text = label,
            modifier = Modifier
                .padding(start = 16.dp)
                .background(AppColors.Screen)
                .padding(horizontal = 6.dp),
            color = AppColors.Primary,
            fontSize = 14.sp
        )
    }
}

@Composable
private fun LabeledFieldWithAction(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    actionLabel: String,
    onActionClick: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            OutlinedTextField(
                value = value,
                onValueChange = onValueChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = AppColors.Card,
                    unfocusedContainerColor = AppColors.Card,
                    focusedBorderColor = AppColors.TextSecondary,
                    unfocusedBorderColor = AppColors.TextSecondary.copy(alpha = 0.7f),
                    cursorColor = AppColors.Primary
                )
            )
            Text(
                text = label,
                modifier = Modifier
                    .padding(start = 16.dp)
                    .background(AppColors.Screen)
                    .padding(horizontal = 6.dp),
                color = AppColors.Primary,
                fontSize = 14.sp
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End
        ) {
            FilledTonalButton(
                onClick = onActionClick,
                shape = RoundedCornerShape(999.dp),
                colors = ButtonDefaults.filledTonalButtonColors(
                    containerColor = AppColors.NavIndicator,
                    contentColor = AppColors.Primary
                )
            ) {
                Text(
                    text = actionLabel,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
private fun StatusTile(
    icon: ImageVector,
    iconTint: Color,
    label: String,
    value: String
) {
    ElevatedSectionCard {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Surface(
                modifier = Modifier.size(56.dp),
                shape = CircleShape,
                color = Color.White
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = iconTint
                    )
                }
            }
            Column {
                Text(
                    text = label,
                    color = AppColors.TextMuted,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
                Text(
                    text = value,
                    color = if (label.contains("CONNECTION")) iconTint else AppColors.TextPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp
                )
            }
        }
    }
}

@Composable
private fun AppSelectionRow(
    app: InstalledAppOption,
    selected: Boolean,
    onToggle: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggle),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = AppColors.Card),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Surface(
                modifier = Modifier.size(48.dp),
                shape = RoundedCornerShape(14.dp),
                color = AppColors.PrimaryContainer
            ) {
                val iconBitmap = remember(app.icon) {
                    app.icon?.toBitmap(width = 96, height = 96)?.asImageBitmap()
                }
                if (iconBitmap != null) {
                    Image(
                        bitmap = iconBitmap,
                        contentDescription = "${app.appName} icon",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            text = app.appName.take(1).uppercase(),
                            color = AppColors.Primary,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = app.appName,
                    color = AppColors.TextPrimary,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp
                )
                Text(
                    text = app.packageName,
                    color = AppColors.TextSecondary,
                    fontSize = 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Switch(
                checked = selected,
                onCheckedChange = { onToggle() }
            )
        }
    }
}

@Composable
private fun LogEntryRow(entry: AgentLogEntry) {
    val levelColor = when (entry.level) {
        AgentLogLevel.INFO -> AppColors.Success
        AgentLogLevel.WARN -> AppColors.Warning
        AgentLogLevel.ERROR -> AppColors.Error
    }

    Text(
        text = "${entry.timestamp} [${entry.level.name}] ${entry.message}",
        color = AppColors.TextPrimary,
        fontFamily = FontFamily.Monospace,
        fontSize = 14.sp,
        lineHeight = 22.sp
    )
    Spacer(modifier = Modifier.height(2.dp))
    HorizontalDivider(color = levelColor.copy(alpha = 0.16f))
}

private fun connectionColor(connectionStatus: String): Color {
    return when (connectionStatus) {
        AgentConnectionState.CONNECTED.name -> AppColors.Success
        AgentConnectionState.CONNECTING.name -> AppColors.Warning
        AgentConnectionState.ERROR.name -> AppColors.Error
        else -> AppColors.TextPrimary
    }
}

@Composable
private fun agentColorScheme() = MaterialTheme.colorScheme.copy(
    primary = AppColors.Primary,
    secondary = AppColors.Primary,
    background = AppColors.Screen,
    surface = AppColors.Card,
    surfaceVariant = AppColors.NavIndicator,
    onSurface = AppColors.TextPrimary,
    onBackground = AppColors.TextPrimary
)

private object AppColors {
    val Screen = Color(0xFFF1F3EF)
    val Card = Color(0xFFF7F8F5)
    val NavBar = Color(0xFFEAEDE5)
    val NavIndicator = Color(0xFFDDE5D8)
    val Primary = Color(0xFF6A9367)
    val PrimaryContainer = Color(0xFF648A5D)
    val AvatarBadge = Color(0xFFD5EDD8)
    val TextPrimary = Color(0xFF1F2937)
    val TextSecondary = Color(0xFF5D6470)
    val TextMuted = Color(0xFF8A9085)
    val Success = Color(0xFF6A9367)
    val Warning = Color(0xFFA06E1A)
    val Error = Color(0xFFC23C2A)
    val Divider = Color(0xFFD9DED4)
}
