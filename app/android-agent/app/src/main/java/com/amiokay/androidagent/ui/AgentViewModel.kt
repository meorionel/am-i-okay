package com.amiokay.androidagent.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.amiokay.androidagent.domain.AgentController
import com.amiokay.androidagent.domain.AgentStartResult
import com.amiokay.androidagent.domain.InstalledAppOption
import com.amiokay.androidagent.service.AgentConnectionState
import com.amiokay.androidagent.service.AgentLogEntry
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

data class AgentUiState(
    val backendUrlInput: String = "",
    val agentNameInput: String = "",
    val statusTextInput: String = "",
    val installedApps: List<InstalledAppOption> = emptyList(),
    val selectedExcludedPackages: Set<String> = emptySet(),
    val savedExcludedPackages: Set<String> = emptySet(),
    val excludedAppsFilterInput: String = "",
    val savedBackendUrl: String = "",
    val savedAgentName: String = "",
    val savedStatusText: String = "",
    val isServiceRunning: Boolean = false,
    val connectionStatus: String = AgentConnectionState.DISCONNECTED.name,
    val lastError: String? = null,
    val logEntries: List<AgentLogEntry> = emptyList(),
    val message: String? = null
)

class AgentViewModel(
    private val agentController: AgentController
) : ViewModel() {

    var uiState by mutableStateOf(AgentUiState())
        private set

    private var inputHydratedFromStorage = false
    private var agentNameInputHydratedFromStorage = false
    private var statusTextInputHydratedFromStorage = false
    private var excludedPackagesHydratedFromStorage = false

    init {
        loadInstalledApps()
        observeSavedBackendUrl()
        observeSavedAgentName()
        observeSavedStatusText()
        observeExcludedPackages()
        observeRuntimeStatus()
    }

    fun onBackendUrlChanged(value: String) {
        uiState = uiState.copy(
            backendUrlInput = value,
            message = null
        )
    }

    fun onAgentNameChanged(value: String) {
        uiState = uiState.copy(
            agentNameInput = value,
            message = null
        )
    }

    fun onStatusTextChanged(value: String) {
        uiState = uiState.copy(
            statusTextInput = value,
            message = null
        )
    }

    fun onExcludedAppsFilterChanged(value: String) {
        uiState = uiState.copy(
            excludedAppsFilterInput = value
        )
    }

    fun onExcludedPackageToggled(packageName: String) {
        val selectedPackages = uiState.selectedExcludedPackages.toMutableSet()
        if (!selectedPackages.add(packageName)) {
            selectedPackages.remove(packageName)
        }
        uiState = uiState.copy(
            selectedExcludedPackages = selectedPackages,
            message = null
        )
    }

    fun onStartClicked() {
        val currentBackendUrl = uiState.backendUrlInput
        val currentAgentName = uiState.agentNameInput
        val currentStatusText = uiState.statusTextInput
        val currentExcludedPackages = uiState.selectedExcludedPackages
        viewModelScope.launch {
            when (
                val result = agentController.startAgent(
                    currentBackendUrl,
                    currentAgentName,
                    currentStatusText,
                    currentExcludedPackages
                )
            ) {
                is AgentStartResult.Started -> {
                    uiState = uiState.copy(
                        backendUrlInput = result.savedBackendUrl,
                        savedBackendUrl = result.savedBackendUrl,
                        agentNameInput = result.savedAgentName,
                        savedAgentName = result.savedAgentName,
                        statusTextInput = result.savedStatusText,
                        savedStatusText = result.savedStatusText,
                        selectedExcludedPackages = result.savedExcludedPackages,
                        savedExcludedPackages = result.savedExcludedPackages,
                        message = "Agent started"
                    )
                }

                is AgentStartResult.Error -> {
                    uiState = uiState.copy(
                        message = result.reason
                    )
                }
            }
        }
    }

    fun onStopClicked() {
        agentController.stopAgent()
        uiState = uiState.copy(
            message = "Agent stopped"
        )
    }

    fun onClearLogsClicked() {
        agentController.clearLogs()
    }

    fun onMessageConsumed() {
        if (uiState.message != null) {
            uiState = uiState.copy(message = null)
        }
    }

    fun refreshServiceStatus() {
        uiState = uiState.copy(
            isServiceRunning = agentController.isServiceRunning()
        )
    }

    private fun observeRuntimeStatus() {
        viewModelScope.launch {
            agentController.runtimeStatus.collect { runtimeStatus ->
                uiState = uiState.copy(
                    isServiceRunning = runtimeStatus.isServiceRunning,
                    connectionStatus = runtimeStatus.connectionState.name,
                    lastError = runtimeStatus.lastError,
                    logEntries = runtimeStatus.logEntries
                )
            }
        }
    }

    private fun observeSavedBackendUrl() {
        viewModelScope.launch {
            agentController.backendUrl.collect { storedUrl ->
                uiState = uiState.copy(
                    savedBackendUrl = storedUrl,
                    backendUrlInput = if (inputHydratedFromStorage) {
                        uiState.backendUrlInput
                    } else {
                        storedUrl
                    }
                )
                inputHydratedFromStorage = true
            }
        }
    }

    private fun observeSavedAgentName() {
        viewModelScope.launch {
            agentController.agentName.collect { storedAgentName ->
                uiState = uiState.copy(
                    savedAgentName = storedAgentName,
                    agentNameInput = if (agentNameInputHydratedFromStorage) {
                        uiState.agentNameInput
                    } else {
                        storedAgentName
                    }
                )
                agentNameInputHydratedFromStorage = true
            }
        }
    }

    private fun observeSavedStatusText() {
        viewModelScope.launch {
            agentController.statusText.collect { storedStatusText ->
                uiState = uiState.copy(
                    savedStatusText = storedStatusText,
                    statusTextInput = if (statusTextInputHydratedFromStorage) {
                        uiState.statusTextInput
                    } else {
                        storedStatusText
                    }
                )
                statusTextInputHydratedFromStorage = true
            }
        }
    }

    private fun observeExcludedPackages() {
        viewModelScope.launch {
            agentController.excludedPackages.collect { storedExcludedPackages ->
                uiState = uiState.copy(
                    savedExcludedPackages = storedExcludedPackages,
                    selectedExcludedPackages = if (excludedPackagesHydratedFromStorage) {
                        uiState.selectedExcludedPackages
                    } else {
                        storedExcludedPackages
                    }
                )
                excludedPackagesHydratedFromStorage = true
            }
        }
    }

    private fun loadInstalledApps() {
        viewModelScope.launch {
            uiState = uiState.copy(
                installedApps = agentController.getInstalledApps()
            )
        }
    }

    companion object {
        fun factory(agentController: AgentController): ViewModelProvider.Factory {
            return object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    if (modelClass.isAssignableFrom(AgentViewModel::class.java)) {
                        return AgentViewModel(agentController) as T
                    }
                    error("Unknown ViewModel class: ${modelClass.name}")
                }
            }
        }
    }
}
