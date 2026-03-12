package com.amiokay.androidagent.monitor

import android.content.Context
import android.provider.Settings
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class ForegroundAppInfo(
    val packageName: String,
    val appName: String,
    val observedAtMillis: Long,
    val detectionSource: String
)

interface ActivityMonitor {
    fun isMonitoringAvailable(): Boolean
    suspend fun getForegroundApp(): ForegroundAppInfo?
}

object AccessibilityAppState {
    private val mutableForegroundApp = MutableStateFlow<ForegroundAppInfo?>(null)
    private val mutablePaused = MutableStateFlow(false)

    val foregroundApp: StateFlow<ForegroundAppInfo?> = mutableForegroundApp.asStateFlow()
    val paused: StateFlow<Boolean> = mutablePaused.asStateFlow()

    fun updateForegroundApp(info: ForegroundAppInfo) {
        if (mutablePaused.value) {
            return
        }
        mutableForegroundApp.value = info
    }

    fun clearForegroundApp() {
        mutableForegroundApp.value = null
    }

    fun setPaused(paused: Boolean) {
        mutablePaused.value = paused
        if (paused) {
            clearForegroundApp()
        }
    }
}

class AccessibilityActivityMonitor(
    private val context: Context
) : ActivityMonitor {

    override fun isMonitoringAvailable(): Boolean = isAccessibilityServiceEnabled()

    override suspend fun getForegroundApp(): ForegroundAppInfo? {
        return AccessibilityAppState.foregroundApp.value
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val enabledServices = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ).orEmpty()

        val expectedComponent = "${context.packageName}/${AccessibilityTrackingService::class.java.name}"
        return enabledServices
            .split(':')
            .any { it.equals(expectedComponent, ignoreCase = true) }
    }
}
