package com.amiokay.androidagent.domain

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Drawable
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
        val savedAgentName: String,
        val savedStatusText: String,
        val savedExcludedPackages: Set<String>
    ) : AgentStartResult

    data class Error(val reason: String) : AgentStartResult
}

data class InstalledAppOption(
    val packageName: String,
    val appName: String,
    val icon: Drawable?
)

class AgentController(
    private val appContext: Context,
    private val configRepository: AgentConfigRepository
) {

    val backendUrl: Flow<String> = configRepository.backendUrl
    val agentName: Flow<String> = configRepository.agentName
    val statusText: Flow<String> = configRepository.statusText
    val excludedPackages: Flow<Set<String>> = configRepository.excludedPackages
    val runtimeStatus: Flow<AgentRuntimeStatus> = AgentRuntimeState.status

    suspend fun startAgent(
        rawBackendUrl: String,
        rawAgentName: String,
        rawStatusText: String,
        excludedPackages: Set<String>
    ): AgentStartResult {
        val backendUrl = rawBackendUrl.trim()
        val agentName = rawAgentName.trim()
        val statusText = rawStatusText.trim()
        val sanitizedExcludedPackages = excludedPackages
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .toSet()
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
        configRepository.saveStatusText(statusText)
        configRepository.saveExcludedPackages(sanitizedExcludedPackages)
        AgentRuntimeState.appendLog("Saved backend URL: $backendUrl")
        AgentRuntimeState.appendLog("Saved agent name: $agentName")
        AgentRuntimeState.appendLog("Saved status text: ${statusText.ifEmpty { "(empty)" }}")
        AgentRuntimeState.appendLog(
            "Saved excluded packages: ${
                sanitizedExcludedPackages.joinToString().ifEmpty { "(none)" }
            }"
        )

        val startIntent = Intent(appContext, AgentForegroundService::class.java).apply {
            action = AgentForegroundService.ACTION_START
        }
        return runCatching {
            AgentRuntimeState.appendLog("Starting foreground service")
            ContextCompat.startForegroundService(appContext, startIntent)
            AgentStartResult.Started(
                backendUrl,
                agentName,
                statusText,
                sanitizedExcludedPackages
            )
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

    suspend fun saveExcludedPackages(excludedPackages: Set<String>) {
        val sanitizedExcludedPackages = excludedPackages
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .toSet()
        configRepository.saveExcludedPackages(sanitizedExcludedPackages)
        AgentRuntimeState.appendLog(
            "Saved excluded packages: ${
                sanitizedExcludedPackages.joinToString().ifEmpty { "(none)" }
            }"
        )
    }

    suspend fun updateStatusText(rawStatusText: String): String {
        val statusText = rawStatusText.trim()
        configRepository.saveStatusText(statusText)
        AgentRuntimeState.appendLog("Saved status text: ${statusText.ifEmpty { "(empty)" }}")

        if (!isServiceRunning()) {
            return "Status text saved"
        }

        val updateIntent = Intent(appContext, AgentForegroundService::class.java).apply {
            action = AgentForegroundService.ACTION_UPDATE_STATUS_TEXT
        }
        appContext.startService(updateIntent)
        return "Status text updated"
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

    fun clearLogs() {
        AgentRuntimeState.clearLogs()
    }

    fun getInstalledApps(): List<InstalledAppOption> {
        val packageManager = appContext.packageManager
        return packageManager.getInstalledApplications(0)
            .asSequence()
            .filter { applicationInfo ->
                applicationInfo.packageName != appContext.packageName &&
                    isUserInstalledApp(applicationInfo) &&
                    packageManager.getLaunchIntentForPackage(applicationInfo.packageName) != null
            }
            .map { applicationInfo ->
                InstalledAppOption(
                    packageName = applicationInfo.packageName,
                    appName = packageManager.getApplicationLabel(applicationInfo).toString(),
                    icon = packageManager.getApplicationIcon(applicationInfo)
                )
            }
            .sortedWith(
                compareBy<InstalledAppOption> { it.appName.lowercase() }
                    .thenBy { it.packageName.lowercase() }
            )
            .toList()
    }

    private fun isUserInstalledApp(applicationInfo: android.content.pm.ApplicationInfo): Boolean {
        val isSystemApp =
            (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0
        val isUpdatedSystemApp =
            (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0
        return !isSystemApp || isUpdatedSystemApp
    }

    @Suppress("DEPRECATION")
    fun isServiceRunning(): Boolean {
        val manager = appContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        return manager.getRunningServices(Int.MAX_VALUE)
            .any { it.service.className == AgentForegroundService::class.java.name }
    }
}
