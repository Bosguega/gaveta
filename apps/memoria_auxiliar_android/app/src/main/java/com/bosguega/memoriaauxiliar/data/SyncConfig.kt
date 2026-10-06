package com.bosguega.memoriaauxiliar.data

import android.content.Context

/**
 * Endereço do PC e token de sincronização, digitados manualmente (v1).
 *
 * SharedPreferences separado da caixa de pendentes: configuração raramente
 * muda, memórias mudam toda hora. Sem descoberta automática ainda — essa é
 * uma decisão futura (mDNS/NSD), não um campo a mais aqui.
 */
object SyncConfig {

    private const val PREFS_NAME = "sync_config"
    private const val KEY_HOST = "host"
    private const val KEY_PORT = "port"
    private const val KEY_TOKEN = "token"

    const val DEFAULT_PORT = 32173

    data class Settings(
        val host: String,
        val port: Int,
        val token: String,
    )

    fun load(context: Context): Settings? {
        val prefs = context.applicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val host = prefs.getString(KEY_HOST, null)?.trim().orEmpty()
        val token = prefs.getString(KEY_TOKEN, null)?.trim().orEmpty()
        if (host.isEmpty() || token.isEmpty()) return null
        val port = prefs.getInt(KEY_PORT, DEFAULT_PORT).takeIf { it in 1..65535 }
            ?: DEFAULT_PORT
        return Settings(host = host, port = port, token = token)
    }

    fun save(context: Context, host: String, port: Int, token: String) {
        context.applicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_HOST, host.trim())
            .putInt(KEY_PORT, port.coerceIn(1, 65535))
            .putString(KEY_TOKEN, token.trim())
            .apply()
    }
}
