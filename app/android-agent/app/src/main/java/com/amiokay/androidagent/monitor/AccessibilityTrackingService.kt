package com.amiokay.androidagent.monitor

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

class AccessibilityTrackingService : AccessibilityService() {

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (AccessibilityAppState.paused.value) {
            return
        }

        val packageName = event?.packageName?.toString()
            ?: rootInActiveWindow?.packageName?.toString()
            ?: return

        if (packageName == this.packageName || isIgnoredPackage(packageName)) {
            return
        }

        val appName = resolveAppName(packageName)
        AccessibilityAppState.updateForegroundApp(
            ForegroundAppInfo(
                packageName = packageName,
                appName = appName,
                observedAtMillis = event?.eventTime?.takeIf { it > 0 } ?: System.currentTimeMillis(),
                detectionSource = "accessibility"
            )
        )
    }

    override fun onInterrupt() = Unit

    override fun onServiceConnected() {
        super.onServiceConnected()
        if (AccessibilityAppState.paused.value) {
            return
        }
        rootInActiveWindow?.packageName?.toString()?.let { packageName ->
            if (packageName != this.packageName && !isIgnoredPackage(packageName)) {
                AccessibilityAppState.updateForegroundApp(
                    ForegroundAppInfo(
                        packageName = packageName,
                        appName = resolveAppName(packageName),
                        observedAtMillis = System.currentTimeMillis(),
                        detectionSource = "accessibility"
                    )
                )
            }
        }
    }

    override fun onUnbind(intent: android.content.Intent?): Boolean {
        AccessibilityAppState.clearForegroundApp()
        return super.onUnbind(intent)
    }

    private fun resolveAppName(packageName: String): String {
        return runCatching {
            val packageManager = packageManager
            val applicationInfo = packageManager.getApplicationInfo(packageName, 0)
            packageManager.getApplicationLabel(applicationInfo).toString()
        }.getOrElse {
            packageName
        }
    }

    private fun isIgnoredPackage(packageName: String): Boolean {
        if (packageName == "com.android.systemui" || packageName == "com.miui.home") {
            return true
        }

        return getHomePackages().contains(packageName)
    }

    private fun getHomePackages(): Set<String> {
        val homeIntent = android.content.Intent(android.content.Intent.ACTION_MAIN).apply {
            addCategory(android.content.Intent.CATEGORY_HOME)
        }
        return packageManager.queryIntentActivities(homeIntent, 0)
            .mapNotNull { it.activityInfo?.packageName }
            .toSet()
    }
}
