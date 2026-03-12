package com.amiokay.androidagent.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.amiokay.androidagent.service.AgentLogEntry
import com.amiokay.androidagent.service.AgentLogLevel

@Composable
fun AgentScreen(
    uiState: AgentUiState,
    onBackendUrlChanged: (String) -> Unit,
    onAgentNameChanged: (String) -> Unit,
    onStartClicked: () -> Unit,
    onStopClicked: () -> Unit,
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
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(text = "Android Agent MVP")

            OutlinedTextField(
                value = uiState.backendUrlInput,
                onValueChange = onBackendUrlChanged,
                modifier = Modifier.fillMaxWidth(),
                label = { Text(text = "Backend URL") },
                placeholder = { Text(text = "ws://example.com/ws/agent") },
                singleLine = true
            )

            OutlinedTextField(
                value = uiState.agentNameInput,
                onValueChange = onAgentNameChanged,
                modifier = Modifier.fillMaxWidth(),
                label = { Text(text = "Agent Name") },
                placeholder = { Text(text = "android-agent") },
                singleLine = true
            )

            Button(
                onClick = onStartClicked,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(text = "Start Agent")
            }

            OutlinedButton(
                onClick = onStopClicked,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(text = "Stop Agent")
            }

            OutlinedButton(
                onClick = onOpenAccessibilitySettings,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(text = "Open Accessibility Settings")
            }

            Text(
                text = "Service running: ${if (uiState.isServiceRunning) "Yes" else "No"}"
            )

            Text(
                text = "Connection status: ${uiState.connectionStatus}"
            )

            Text(
                text = "Saved backend URL: ${uiState.savedBackendUrl.ifBlank { "Not set" }}"
            )

            Text(
                text = "Saved agent name: ${uiState.savedAgentName.ifBlank { "Not set" }}"
            )

            uiState.lastError?.let { lastError ->
                Text(text = "Last error: $lastError")
            }

            Text(text = "Logs")

            if (uiState.logEntries.isEmpty()) {
                Text(text = "No logs yet")
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 160.dp, max = 280.dp)
                        .background(
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            shape = MaterialTheme.shapes.medium
                        )
                        .padding(12.dp)
                ) {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(uiState.logEntries.asReversed()) { entry ->
                            LogEntryItem(entry = entry)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LogEntryItem(entry: AgentLogEntry) {
    val levelColor = when (entry.level) {
        AgentLogLevel.INFO -> MaterialTheme.colorScheme.onSurfaceVariant
        AgentLogLevel.WARN -> MaterialTheme.colorScheme.tertiary
        AgentLogLevel.ERROR -> MaterialTheme.colorScheme.error
    }

    Text(
        text = "${entry.timestamp} [${entry.level.name}] ${entry.message}",
        color = levelColor,
        fontFamily = FontFamily.Monospace,
        style = MaterialTheme.typography.bodySmall
    )
}
