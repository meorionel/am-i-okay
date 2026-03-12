package com.amiokay.androidagent.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.IntentFilter
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build.VERSION.SDK_INT
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.amiokay.androidagent.MainActivity
import com.amiokay.androidagent.R
import com.amiokay.androidagent.data.AgentConfigRepository
import com.amiokay.androidagent.monitor.AccessibilityAppState
import com.amiokay.androidagent.monitor.AccessibilityActivityMonitor
import com.amiokay.androidagent.monitor.ActivityMonitor
import com.amiokay.androidagent.service.AgentLogLevel.WARN
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.net.URI
import java.time.Instant
import java.util.UUID

class AgentForegroundService : Service() {

    private val coroutineExceptionHandler = CoroutineExceptionHandler { _, throwable ->
        val message = throwable.message ?: throwable::class.java.simpleName
        Log.e(TAG, "Agent service coroutine failed", throwable)
        AgentRuntimeState.onError(message)
        stopAgentService()
    }

    private val serviceScope = CoroutineScope(
        SupervisorJob() + Dispatchers.Default + coroutineExceptionHandler
    )
    private var monitorJob: Job? = null
    private lateinit var activityMonitor: ActivityMonitor
    private lateinit var configRepository: AgentConfigRepository
    private val webSocketClient = AgentWebSocketClient()
    private var backendWebSocketUrl: String? = null
    private var agentName: String = DEFAULT_AGENT_NAME
    private var statusText: String = ""
    private var reportSequence: Long = 0
    private var lastReportedPackageName: String? = null
    private var usageAccessUnavailableLogged = false
    private var isScreenInteractive = true

    private val screenStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                Intent.ACTION_SCREEN_OFF -> {
                    isScreenInteractive = false
                    AgentRuntimeState.appendLog("Screen turned off, disconnecting websocket")
                    AccessibilityAppState.setPaused(true)
                    lastReportedPackageName = null
                    webSocketClient.close("screen_off")
                }

                Intent.ACTION_SCREEN_ON -> {
                    isScreenInteractive = true
                    AccessibilityAppState.setPaused(false)
                    AgentRuntimeState.appendLog("Screen turned on, foreground app tracking resumed")
                    AgentRuntimeState.appendLog("Websocket reconnect allowed")
                }
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        configRepository = AgentConfigRepository(applicationContext)
        activityMonitor = AccessibilityActivityMonitor(applicationContext)
        isScreenInteractive = currentScreenInteractiveState()
        AccessibilityAppState.setPaused(!isScreenInteractive)
        registerReceiver(
            screenStateReceiver,
            IntentFilter().apply {
                addAction(Intent.ACTION_SCREEN_OFF)
                addAction(Intent.ACTION_SCREEN_ON)
            }
        )
        AgentRuntimeState.appendLog("AgentForegroundService created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return runCatching {
            when (intent?.action) {
                ACTION_STOP -> {
                    stopAgentService()
                    START_NOT_STICKY
                }

                ACTION_START, null -> {
                    startAsForeground()
                    AgentRuntimeState.onServiceStarted()
                    startMonitorLoopIfNeeded()
                    START_STICKY
                }

                else -> {
                    startAsForeground()
                    AgentRuntimeState.onServiceStarted()
                    startMonitorLoopIfNeeded()
                    START_STICKY
                }
            }
        }.getOrElse { error ->
            val message = "Agent service crashed during start: ${error.message.orEmpty()}".trim()
            Log.e(TAG, message, error)
            AgentRuntimeState.onError(message)
            stopAgentService()
            START_NOT_STICKY
        }
    }

    override fun onDestroy() {
        monitorJob?.cancel()
        unregisterReceiver(screenStateReceiver)
        webSocketClient.shutdown()
        AgentRuntimeState.onServiceStopped()
        serviceScope.cancel()
        super.onDestroy()
    }

    private fun startAsForeground() {
        createNotificationChannelIfNeeded()
        val notification = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_popup_sync)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(getString(R.string.notification_text))
            .setOngoing(true)
            .setContentIntent(createContentIntent())
            .build()

        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        )
    }

    private fun startMonitorLoopIfNeeded() {
        if (monitorJob?.isActive == true) {
            return
        }

        monitorJob = serviceScope.launch {
            val savedBackendUrl = configRepository.backendUrl.first().trim()
            if (savedBackendUrl.isEmpty()) {
                AgentRuntimeState.onError("Backend URL is empty. Stop and start the agent again.")
                stopAgentService()
                return@launch
            }

            agentName = configRepository.agentName.first().trim()
                .ifBlank { DEFAULT_AGENT_NAME }
            statusText = configRepository.statusText.first().trim()
            backendWebSocketUrl = toAgentWebSocketUrl(savedBackendUrl)
            AgentRuntimeState.appendLog("Using agent name: $agentName")
            AgentRuntimeState.appendLog("Using status text: ${statusText.ifEmpty { "(empty)" }}")
            AgentRuntimeState.appendLog("Resolved backend websocket URL: ${backendWebSocketUrl ?: "invalid"}")

            while (isActive) {
                val targetUrl = backendWebSocketUrl
                if (targetUrl.isNullOrEmpty()) {
                    AgentRuntimeState.onError("Backend URL is invalid.")
                    delay(SAMPLE_INTERVAL_MS)
                    continue
                }

                if (!isScreenInteractive) {
                    delay(SAMPLE_INTERVAL_MS)
                    continue
                }

                if (!webSocketClient.isConnected()) {
                    webSocketClient.connect(targetUrl) {
                        sendStatusPayload()
                    }
                    delay(RECONNECT_DELAY_MS)
                }

                val foregroundApp = activityMonitor.getForegroundApp()
                if (foregroundApp == null) {
                    lastReportedPackageName = null
                    if (!activityMonitor.isMonitoringAvailable()) {
                        if (!usageAccessUnavailableLogged) {
                            AgentRuntimeState.appendLog(
                                "Foreground app unavailable. Enable Accessibility for Android Agent.",
                                WARN
                            )
                            usageAccessUnavailableLogged = true
                        }
                    } else {
                        usageAccessUnavailableLogged = false
                    }
                    delay(SAMPLE_INTERVAL_MS)
                    continue
                }
                usageAccessUnavailableLogged = false

                if (foregroundApp.packageName == lastReportedPackageName) {
                    delay(SAMPLE_INTERVAL_MS)
                    continue
                }

                reportSequence += 1
                AgentRuntimeState.appendLog(
                    "Foreground app changed via ${foregroundApp.detectionSource}: " +
                        "${foregroundApp.appName} (${foregroundApp.packageName})"
                )
                val payload = buildActivityPayload(
                    foregroundApp = foregroundApp,
                    sequence = reportSequence
                )
                val sent = webSocketClient.send(payload)
                if (sent) {
                    lastReportedPackageName = foregroundApp.packageName
                    AgentRuntimeState.appendLog("Activity payload #$reportSequence reported")
                    Log.d(TAG, "Activity event sent to backend.")
                } else {
                    AgentRuntimeState.appendLog(
                        "Activity payload #$reportSequence not sent because connection is not ready"
                    )
                    Log.w(TAG, "Activity event was not sent because websocket is not connected.")
                }
                delay(SAMPLE_INTERVAL_MS)
            }
        }
    }

    private fun stopAgentService() {
        monitorJob?.cancel()
        monitorJob = null
        lastReportedPackageName = null
        usageAccessUnavailableLogged = false
        AccessibilityAppState.setPaused(true)
        webSocketClient.close("agent_stopped")
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        AgentRuntimeState.onServiceStopped()
        stopSelf()
    }

    private fun createNotificationChannelIfNeeded() {
        if (SDK_INT < Build.VERSION_CODES.O) {
            return
        }

        val channel = NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = getString(R.string.notification_channel_description)
        }

        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }

    private fun createContentIntent(): PendingIntent {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getActivity(this, 0, intent, flags)
    }

    private fun currentScreenInteractiveState(): Boolean {
        val powerManager = getSystemService(PowerManager::class.java)
        return powerManager?.isInteractive ?: true
    }

    private fun toAgentWebSocketUrl(rawBackendUrl: String): String? {
        val uri = runCatching { URI(rawBackendUrl.trim()) }.getOrNull() ?: return null
        val scheme = uri.scheme?.lowercase() ?: return null
        val host = uri.host ?: return null
        val port = uri.port
        val query = uri.query

        return when (scheme) {
            "http", "https" -> {
                val wsScheme = if (scheme == "https") "wss" else "ws"
                val path = when {
                    uri.path.isNullOrBlank() || uri.path == "/" -> "/ws/agent"
                    uri.path == "/ws/agent" -> "/ws/agent"
                    else -> "${uri.path.trimEnd('/')}/ws/agent"
                }
                URI(wsScheme, uri.userInfo, host, port, path, query, null).toString()
            }

            "ws", "wss" -> {
                val path = uri.path?.ifBlank { "/" } ?: "/"
                URI(scheme, uri.userInfo, host, port, path, query, null).toString()
            }

            else -> null
        }
    }

    private fun buildActivityPayload(
        foregroundApp: com.amiokay.androidagent.monitor.ForegroundAppInfo,
        sequence: Long
    ): String {
        val deviceId = agentName.ifBlank { DEFAULT_AGENT_NAME }
        val now = Instant.now().toString()
        val packageName = foregroundApp.packageName
        val appTitle = foregroundApp.appName
        val windowTitle = "Foreground app sampled #$sequence"

        return JSONObject().apply {
            put("type", "activity")
            put(
                "payload",
                JSONObject().apply {
                    put("eventId", UUID.randomUUID().toString())
                    put("ts", now)
                    put("deviceId", deviceId)
                    put("agentName", agentName)
                    put("platform", "android")
                    put("kind", "foreground_changed")
                    put(
                        "app",
                        JSONObject().apply {
                            put("id", packageName)
                            put("name", packageName)
                            put("title", appTitle)
                        }
                    )
                    put("windowTitle", windowTitle)
                    put("source", "usage-stats")
                }
            )
        }.toString()
    }

    private fun sendStatusPayload() {
        val sent = webSocketClient.send(buildStatusPayload())
        if (sent) {
            AgentRuntimeState.appendLog("Status payload reported")
        } else {
            AgentRuntimeState.appendLog("Status payload not sent because connection is not ready")
        }
    }

    private fun buildStatusPayload(): String {
        val deviceId = agentName.ifBlank { DEFAULT_AGENT_NAME }

        return JSONObject().apply {
            put("type", "status")
            put(
                "payload",
                JSONObject().apply {
                    put("ts", Instant.now().toString())
                    put("deviceId", deviceId)
                    put("agentName", agentName)
                    put("platform", "android")
                    put("statusText", statusText)
                    put("source", "android-agent")
                }
            )
        }.toString()
    }

    companion object {
        const val ACTION_START = "com.amiokay.androidagent.action.START"
        const val ACTION_STOP = "com.amiokay.androidagent.action.STOP"

        private const val TAG = "AgentForegroundService"
        private const val DEFAULT_AGENT_NAME = "android-agent"
        private const val NOTIFICATION_CHANNEL_ID = "activity_agent_channel"
        private const val NOTIFICATION_ID = 1001
        private const val SAMPLE_INTERVAL_MS = 1_000L
        private const val RECONNECT_DELAY_MS = 2_000L
    }
}
