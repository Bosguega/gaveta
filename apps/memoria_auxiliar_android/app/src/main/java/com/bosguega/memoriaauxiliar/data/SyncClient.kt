package com.bosguega.memoriaauxiliar.data

import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONArray
import org.json.JSONObject

/**
 * Cliente da sincronização com o PC: POST /memories com Bearer.
 *
 * HttpURLConnection + org.json, ambos da platform — zero dependências novas.
 * Retrofit/OkHttp só entrariam com necessidade real (aqui é um POST ocasional
 * com timeout curto, não um cliente de API permanente).
 *
 * Contrato de remoção (regra dura): o resultado carrega apenas os client_ids
 * presentes em accepted[] com HTTP 200. Qualquer erro de rede, timeout, HTTP
 * diferente de 200, corpo ilegível ou item ausente da resposta significa
 * "nada confirmado" — o chamador mantém tudo como pendente.
 *
 * Chamadas bloqueiam a thread atual: usar sempre fora da thread principal.
 */
object SyncClient {

    private const val CONNECT_TIMEOUT_MS = 8000
    private const val READ_TIMEOUT_MS = 15000

    sealed interface Result {
        /** Ids explicitamente confirmados pelo PC — e só esses podem sair da caixa. */
        data class Acknowledged(val clientIds: List<String>) : Result

        /** Nada confirmado: mantém tudo pendente. A mensagem é só para exibir. */
        data class Failed(val message: String) : Result
    }

    fun push(
        host: String,
        port: Int,
        token: String,
        memories: List<PendingMemory>,
    ): Result {
        if (memories.isEmpty()) return Result.Acknowledged(emptyList())

        val body = JSONObject().apply {
            put(
                "memories",
                JSONArray().apply {
                    for (memory in memories) {
                        put(
                            JSONObject().apply {
                                put("client_id", memory.id)
                                put("content", memory.content)
                                put("tags", memory.tags)
                                put("created_at", memory.createdAt)
                            },
                        )
                    }
                },
            )
        }.toString().toByteArray(Charsets.UTF_8)

        val connection = try {
            (URL("http://$host:$port/memories").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = CONNECT_TIMEOUT_MS
                readTimeout = READ_TIMEOUT_MS
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
                setRequestProperty("Content-Length", body.size.toString())
            }
        } catch (e: Exception) {
            return Result.Failed("Não foi possível alcançar o PC: ${e.message}")
        }

        try {
            try {
                connection.outputStream.use { it.write(body) }
            } catch (e: Exception) {
                return Result.Failed("Falha ao enviar memórias: ${e.message}")
            }

            val status = try {
                connection.responseCode
            } catch (e: Exception) {
                return Result.Failed("PC não respondeu a tempo: ${e.message}")
            }
            if (status != HttpURLConnection.HTTP_OK) {
                return Result.Failed(
                    if (status == HttpURLConnection.HTTP_UNAUTHORIZED) {
                        "Token rejeitado pelo PC. Confira o token."
                    } else {
                        "PC respondeu HTTP $status. Nada foi apagado."
                    },
                )
            }

            val responseBody = try {
                connection.inputStream.use { it.readBytes().toString(Charsets.UTF_8) }
            } catch (e: Exception) {
                return Result.Failed("Resposta ilegível do PC: ${e.message}")
            }

            return try {
                val accepted = JSONObject(responseBody).optJSONArray("accepted")
                    ?: return Result.Failed("Resposta sem accepted[]. Nada foi apagado.")
                val ids = buildList {
                    for (i in 0 until accepted.length()) {
                        accepted.optJSONObject(i)
                            ?.optString("client_id")
                            ?.takeIf { it.isNotEmpty() }
                            ?.let { add(it) }
                    }
                }
                Result.Acknowledged(ids)
            } catch (e: Exception) {
                Result.Failed("Resposta inválida do PC: ${e.message}")
            }
        } finally {
            connection.disconnect()
        }
    }
}
