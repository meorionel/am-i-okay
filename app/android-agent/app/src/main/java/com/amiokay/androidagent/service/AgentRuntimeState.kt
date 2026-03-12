package com.amiokay.androidagent.service

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class AgentConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    ERROR
}

enum class AgentLogLevel {
    INFO,
    WARN,
    ERROR
}

data class AgentLogEntry(
    val timestamp: String,
    val level: AgentLogLevel,
    val message: String
)

data class AgentRuntimeStatus(
    val isServiceRunning: Boolean = false,
    val connectionState: AgentConnectionState = AgentConnectionState.DISCONNECTED,
    val lastError: String? = null,
    val logEntries: List<AgentLogEntry> = emptyList()
)

object AgentRuntimeState {
    private const val MAX_LOG_LINES = 40
    private val timeFormatter = SimpleDateFormat("HH:mm:ss", Locale.US)
    private val mutableStatus = MutableStateFlow(AgentRuntimeStatus())

    val status: StateFlow<AgentRuntimeStatus> = mutableStatus.asStateFlow()

    fun onServiceStarted() {
        mutableStatus.value = mutableStatus.value.copy(
            isServiceRunning = true,
            lastError = null
        )
        appendLog("Service started")
    }

    fun onServiceStopped() {
        val previousLogs = mutableStatus.value.logEntries
        mutableStatus.value = AgentRuntimeStatus(
            logEntries = appendLogLine(previousLogs, AgentLogLevel.INFO, "Service stopped")
        )
    }

    fun onConnecting() {
        mutableStatus.value = mutableStatus.value.copy(
            isServiceRunning = true,
            connectionState = AgentConnectionState.CONNECTING,
            lastError = null
        )
        appendLog("Connecting to backend")
    }

    fun onConnected() {
        mutableStatus.value = mutableStatus.value.copy(
            isServiceRunning = true,
            connectionState = AgentConnectionState.CONNECTED,
            lastError = null
        )
        appendLog("Connected to backend")
    }

    fun onDisconnected() {
        mutableStatus.value = mutableStatus.value.copy(
            isServiceRunning = true,
            connectionState = AgentConnectionState.DISCONNECTED
        )
        appendLog("Disconnected from backend")
    }

    fun onError(message: String) {
        mutableStatus.value = mutableStatus.value.copy(
            isServiceRunning = true,
            connectionState = AgentConnectionState.ERROR,
            lastError = message
        )
        appendLog(message, AgentLogLevel.ERROR)
    }

    fun appendLog(message: String, level: AgentLogLevel = AgentLogLevel.INFO) {
        mutableStatus.value = mutableStatus.value.copy(
            logEntries = appendLogLine(mutableStatus.value.logEntries, level, message)
        )
    }

    private fun appendLogLine(
        currentLines: List<AgentLogEntry>,
        level: AgentLogLevel,
        message: String
    ): List<AgentLogEntry> {
        val entry = AgentLogEntry(
            timestamp = timeFormatter.format(Date()),
            level = level,
            message = message
        )
        return (currentLines + entry).takeLast(MAX_LOG_LINES)
    }
}
