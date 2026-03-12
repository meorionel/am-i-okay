package com.amiokay.androidagent.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class AgentConfigRepository(
    private val context: Context
) {

    val backendUrl: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[AppPreferences.BackendUrl].orEmpty()
    }

    suspend fun saveBackendUrl(url: String) {
        context.dataStore.edit { preferences ->
            preferences[AppPreferences.BackendUrl] = url
        }
    }
}
