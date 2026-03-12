package com.amiokay.androidagent.service

import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

class AgentWebSocketClient {

    private val okHttpClient = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(20, TimeUnit.SECONDS)
        .build()

    @Volatile
    private var webSocket: WebSocket? = null

    @Volatile
    private var connected = false

    @Volatile
    private var targetUrl: String? = null

    fun connect(url: String, onOpen: (() -> Unit)? = null) {
        if (targetUrl == url && (connected || webSocket != null)) {
            return
        }

        close("reconnect")
        targetUrl = url
        AgentRuntimeState.appendLog("Preparing websocket connection: $url")
        AgentRuntimeState.onConnecting()

        val request = Request.Builder()
            .url(url)
            .build()

        webSocket = okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                this@AgentWebSocketClient.webSocket = webSocket
                connected = true
                AgentRuntimeState.onConnected()
                AgentRuntimeState.appendLog("WebSocket open: $url")
                onOpen?.invoke()
                Log.i(TAG, "Connected to backend: $url")
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                AgentRuntimeState.appendLog("Backend message received")
                Log.d(TAG, "Received backend message: $text")
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                connected = false
                this@AgentWebSocketClient.webSocket = null
                AgentRuntimeState.onDisconnected()
                AgentRuntimeState.appendLog("WebSocket closing code=$code reason=$reason")
                webSocket.close(code, reason)
                Log.i(TAG, "Backend closing connection code=$code reason=$reason")
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                connected = false
                this@AgentWebSocketClient.webSocket = null
                AgentRuntimeState.onDisconnected()
                AgentRuntimeState.appendLog("WebSocket closed code=$code reason=$reason")
                Log.i(TAG, "Backend connection closed code=$code reason=$reason")
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                connected = false
                this@AgentWebSocketClient.webSocket = null
                val message = t.message ?: "Unknown websocket error"
                AgentRuntimeState.onError(message)
                AgentRuntimeState.appendLog("WebSocket failure: $message")
                Log.e(TAG, "WebSocket connection failed", t)
            }
        })
    }

    fun send(text: String): Boolean {
        val sent = webSocket?.send(text) == true
        AgentRuntimeState.appendLog(if (sent) "WebSocket message sent to backend" else "WebSocket send skipped")
        if (!sent && connected) {
            AgentRuntimeState.onError("Failed to send message to backend.")
        }
        return sent
    }

    fun isConnected(): Boolean = connected

    fun close(reason: String = "agent_stopped") {
        connected = false
        AgentRuntimeState.appendLog("Closing websocket: $reason")
        webSocket?.close(1000, reason)
        webSocket = null
        AgentRuntimeState.onDisconnected()
    }

    fun shutdown() {
        close()
        okHttpClient.dispatcher.executorService.shutdown()
        okHttpClient.connectionPool.evictAll()
    }

    companion object {
        private const val TAG = "AgentWebSocketClient"
    }
}
