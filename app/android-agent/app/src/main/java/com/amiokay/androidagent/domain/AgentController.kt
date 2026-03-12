package com.amiokay.androidagent.domain

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import com.amiokay.androidagent.data.AgentConfigRepository
import com.amiokay.androidagent.service.AgentForegroundService
import com.amiokay.androidagent.service.AgentRuntimeState
import com.amiokay.androidagent.service.AgentRuntimeStatus
import kotlinx.coroutines.flow.Flow

sealed interface AgentStartResult {
    data class Started(
        val savedBackendUrl: String,
        val savedAgentName: String
    ) : AgentStartResult

    data class Error(val reason: String) : AgentStartResult
}

class AgentController(
    private val appContext: Context,
    private val configRepository: AgentConfigRepository
) {

    val backendUrl: Flow<String> = configRepository.backendUrl
    val agentName: Flow<String> = configRepository.agentName
    val runtimeStatus: Flow<AgentRuntimeStatus> = AgentRuntimeState.status

    suspend fun startAgent(rawBackendUrl: String, rawAgentName: String): AgentStartResult {
        val backendUrl = rawBackendUrl.trim()
        val agentName = rawAgentName.trim()
        if (backendUrl.isEmpty()) {
            return AgentStartResult.Error("Backend URL is required before starting the agent.")
        }
        if (agentName.isEmpty()) {
            return AgentStartResult.Error("Agent name is required before starting the agent.")
        }

        val supportedSchemes = listOf("http://", "https://", "ws://", "wss://")
        if (supportedSchemes.none { backendUrl.startsWith(it) }) {
            return AgentStartResult.Error(
                "Backend URL must start with http://, https://, ws://, or wss://."
            )
        }

        configRepository.saveBackendUrl(backendUrl)
        configRepository.saveAgentName(agentName)
        AgentRuntimeState.appendLog("Saved backend URL: $backendUrl")
        AgentRuntimeState.appendLog("Saved agent name: $agentName")

        val startIntent = Intent(appContext, AgentForegroundService::class.java).apply {
            action = AgentForegroundService.ACTION_START
        }
        return runCatching {
            AgentRuntimeState.appendLog("Starting foreground service")
            ContextCompat.startForegroundService(appContext, startIntent)
            AgentStartResult.Started(backendUrl, agentName)
        }.getOrElse { error ->
            val message = when {
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                    error is android.app.ForegroundServiceStartNotAllowedException -> {
                    "Foreground service start was blocked by the system: ${error.message.orEmpty()}"
                }

                error is SecurityException -> {
                    "Missing permission or system restriction while starting foreground service: ${error.message.orEmpty()}"
                }

                else -> {
                    "Failed to start agent service: ${error.message.orEmpty()}"
                }
            }.trim()
            AgentRuntimeState.onError(message)
            AgentStartResult.Error(message)
        }
    }

    fun stopAgent() {
        AgentRuntimeState.appendLog("Stopping foreground service")
        val stopIntent = Intent(appContext, AgentForegroundService::class.java).apply {
            action = AgentForegroundService.ACTION_STOP
        }
        runCatching {
            appContext.startService(stopIntent)
        }.onFailure {
            appContext.stopService(Intent(appContext, AgentForegroundService::class.java))
        }
    }

    @Suppress("DEPRECATION")
    fun isServiceRunning(): Boolean {
        val manager = appContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        return manager.getRunningServices(Int.MAX_VALUE)
            .any { it.service.className == AgentForegroundService::class.java.name }
    }
}
