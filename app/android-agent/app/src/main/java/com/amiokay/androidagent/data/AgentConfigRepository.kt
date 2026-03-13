package com.amiokay.androidagent.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class AgentConfigRepository(
    private val context: Context
) {
    val excludedPackagesRaw: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[AppPreferences.ExcludedPackages].orEmpty()
    }

    val excludedPackages: Flow<Set<String>> = excludedPackagesRaw.map(::parseExcludedPackages)

    val backendUrl: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[AppPreferences.BackendUrl].orEmpty()
    }

    val agentName: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[AppPreferences.AgentName].orEmpty()
    }

    val agentApiToken: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[AppPreferences.AgentApiToken].orEmpty()
    }

    val statusText: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[AppPreferences.StatusText].orEmpty()
    }

    suspend fun saveBackendUrl(url: String) {
        context.dataStore.edit { preferences ->
            preferences[AppPreferences.BackendUrl] = url
        }
    }

    suspend fun saveAgentName(name: String) {
        context.dataStore.edit { preferences ->
            preferences[AppPreferences.AgentName] = name
        }
    }

    suspend fun saveAgentApiToken(token: String) {
        context.dataStore.edit { preferences ->
            preferences[AppPreferences.AgentApiToken] = token
        }
    }

    suspend fun saveStatusText(text: String) {
        context.dataStore.edit { preferences ->
            preferences[AppPreferences.StatusText] = text
        }
    }

    suspend fun saveExcludedPackages(packageNames: Set<String>) {
        context.dataStore.edit { preferences ->
            preferences[AppPreferences.ExcludedPackages] = packageNames
                .map { it.trim() }
                .filter { it.isNotEmpty() }
                .sorted()
                .joinToString(separator = "\n")
        }
    }

    companion object {
        fun parseExcludedPackages(rawValue: String): Set<String> {
            return rawValue
                .lineSequence()
                .map { it.trim() }
                .filter { it.isNotEmpty() }
                .toSet()
        }
    }
}
