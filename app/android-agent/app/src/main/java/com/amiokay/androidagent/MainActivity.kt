package com.amiokay.androidagent

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.amiokay.androidagent.data.AgentConfigRepository
import com.amiokay.androidagent.domain.AgentController
import com.amiokay.androidagent.ui.AgentScreen
import com.amiokay.androidagent.ui.AgentViewModel

class MainActivity : ComponentActivity() {

    private val configRepository by lazy { AgentConfigRepository(applicationContext) }
    private val agentController by lazy { AgentController(applicationContext, configRepository) }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) {
        // No-op for MVP. If denied, service can still run but notification visibility varies by OS.
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestNotificationPermissionIfNeeded()

        setContent {
            val viewModel: AgentViewModel = viewModel(
                factory = AgentViewModel.factory(agentController)
            )

            MaterialTheme {
                Surface(modifier = Modifier) {
                    AgentScreen(
                        uiState = viewModel.uiState,
                        onBackendUrlChanged = viewModel::onBackendUrlChanged,
                        onAgentNameChanged = viewModel::onAgentNameChanged,
                        onAgentApiTokenChanged = viewModel::onAgentApiTokenChanged,
                        onStatusTextChanged = viewModel::onStatusTextChanged,
                        onUpdateStatusTextClicked = viewModel::onUpdateStatusTextClicked,
                        onExcludedAppsFilterChanged = viewModel::onExcludedAppsFilterChanged,
                        onExcludedPackageToggled = viewModel::onExcludedPackageToggled,
                        onStartClicked = viewModel::onStartClicked,
                        onRestartClicked = viewModel::onRestartClicked,
                        onStopClicked = viewModel::onStopClicked,
                        onSaveExcludedAppsClicked = viewModel::onSaveExcludedAppsClicked,
                        onClearLogsClicked = viewModel::onClearLogsClicked,
                        onOpenAccessibilitySettings = ::openAccessibilitySettings,
                        onOpenExternalLink = ::openExternalLink,
                        onMessageConsumed = viewModel::onMessageConsumed
                    )
                }
            }
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return
        }

        if (ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    private fun openAccessibilitySettings() {
        startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
    }

    private fun openExternalLink(url: String) {
        startActivity(
            Intent(Intent.ACTION_VIEW, Uri.parse(url))
        )
    }
}
