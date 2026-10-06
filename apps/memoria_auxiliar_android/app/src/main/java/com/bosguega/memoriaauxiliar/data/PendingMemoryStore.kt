package com.bosguega.memoriaauxiliar.data

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * Caixa de entrada temporária das memórias capturadas no celular.
 *
 * Persistência: SharedPreferences + JSON (org.json, da própria platform).
 * Justificativa: o volume real é pequeno (dezenas/centenas de itens de poucos
 * KB) e o acesso é apenas "listar tudo" e "inserir" — Room/SQLite não
 * trariam benefício e custariam KSP + schema + migrations. Se um dia
 * precisarmos de consultas, histórico ou milhares de registros, a troca
 * interna deste objeto por Room não afeta nenhum chamador.
 *
 * Gravação com commit() síncrono: uma ferramenta de captura não pode perder
 * a memória recém-salva se o processo morrer logo em seguida; o payload é
 * minúsculo, então o custo em thread principal é irrelevante.
 *
 * Obrigatório: init(context) antes do primeiro uso (MainActivity, futuro
 * widget ou worker). É idempotente e guarda o applicationContext.
 *
 * A sincronização futura só poderá remover memórias depois que o PC confirmar
 * a persistência; a remoção por confirmação entrará aqui nesse momento.
 */
object PendingMemoryStore {

    private const val PREFS_NAME = "pending_memories"
    private const val KEY_MEMORIES = "memories"

    private lateinit var prefs: SharedPreferences

    // Mais recente primeiro, alinhado à ordenação do list_notes do PC.
    private val memories = mutableListOf<PendingMemory>()

    /** Carrega a caixa do disco. Idempotente; seguro de chamar várias vezes. */
    fun init(context: Context) {
        if (::prefs.isInitialized) return
        prefs = context.applicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        memories.clear()
        memories.addAll(load())
    }

    /**
     * Adiciona e grava em disco.
     * Retorna false quando a gravação falhou — nesse caso nada foi guardado
     * e a memória é retirada da lista para não aparecer como pendente falso.
     */
    fun add(memory: PendingMemory): Boolean {
        memories.add(0, memory)
        if (persist()) return true
        memories.removeAt(0)
        return false
    }

    fun list(): List<PendingMemory> = memories.toList()

    /**
     * Remove somente os ids explicitamente confirmados pelo PC (accepted[]).
     *
     * Regra dura: o chamador nunca decide o que apagar a partir de "HTTP 200"
     * sozinho — apenas os client_ids listados na resposta entram aqui.
     * Retorna quantos foram removidos de fato.
     */
    fun removeByIds(ids: Collection<String>): Int {
        if (ids.isEmpty()) return 0
        val idSet = ids.toSet()
        val before = memories.size
        memories.removeAll { it.id in idSet }
        if (memories.size == before) return 0
        if (!persist()) {
            // Falha improvável (o arquivo já existia), mas sem gravação não há
            // remoção: recarrega do disco para não mentir sobre o estado.
            memories.clear()
            memories.addAll(load())
            return 0
        }
        return before - memories.size
    }

    private fun persist(): Boolean {
        val array = JSONArray()
        for (memory in memories) {
            array.put(
                JSONObject().apply {
                    put("id", memory.id)
                    put("content", memory.content)
                    put("tags", memory.tags)
                    put("createdAt", memory.createdAt)
                }
            )
        }
        return prefs.edit().putString(KEY_MEMORIES, array.toString()).commit()
    }

    /**
     * Lê o JSON do disco. Arquivo ilegível → caixa vazia; item corrompido →
     * descarta apenas ele (um campo inválido não apaga a fila inteira).
     */
    private fun load(): List<PendingMemory> {
        val raw = prefs.getString(KEY_MEMORIES, null) ?: return emptyList()
        return try {
            val array = JSONArray(raw)
            buildList {
                for (i in 0 until array.length()) {
                    try {
                        val item = array.getJSONObject(i)
                        add(
                            PendingMemory(
                                id = item.getString("id"),
                                content = item.getString("content"),
                                tags = item.optString("tags", ""),
                                createdAt = item.getString("createdAt"),
                            )
                        )
                    } catch (_: Exception) {
                        // item malformado: ignora apenas ele
                    }
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }
}