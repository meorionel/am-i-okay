package com.amiokay.androidagent.data

import android.content.Context
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore

private const val DATASTORE_NAME = "agent_preferences"

val Context.dataStore by preferencesDataStore(name = DATASTORE_NAME)

object AppPreferences {
    val BackendUrl = stringPreferencesKey("backend_url")
    val DeviceId = stringPreferencesKey("device_id")
    val AgentName = stringPreferencesKey("agent_name")
    val AgentApiToken = stringPreferencesKey("agent_api_token")
    val StatusText = stringPreferencesKey("status_text")
    val ExcludedPackages = stringPreferencesKey("excluded_packages")
}
