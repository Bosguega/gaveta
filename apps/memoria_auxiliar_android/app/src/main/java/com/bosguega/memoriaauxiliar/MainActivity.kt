package com.bosguega.memoriaauxiliar

import android.app.Activity
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.ListView
import android.widget.TextView
import android.widget.Toast
import com.bosguega.memoriaauxiliar.data.PendingMemory
import com.bosguega.memoriaauxiliar.data.PendingMemoryStore
import com.bosguega.memoriaauxiliar.data.SyncClient
import com.bosguega.memoriaauxiliar.data.SyncConfig

/**
 * Tela única do esqueleto: captura rápida, lista de pendentes e sincronização
 * manual com o PC (etapa 3).
 *
 * A UI não conhece armazenamento nem rede — apenas PendingMemoryStore,
 * SyncConfig e SyncClient. Essa separação existe para que o widget e a
 * sincronização automática futuros entrem pelo mesmo ponto sem depender
 * desta Activity.
 */
class MainActivity : Activity() {

    private lateinit var contentInput: EditText
    private lateinit var tagsInput: EditText
    private lateinit var hostInput: EditText
    private lateinit var tokenInput: EditText
    private lateinit var syncButton: Button
    private lateinit var pendingTitle: TextView
    private lateinit var pendingList: ListView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        PendingMemoryStore.init(this)

        contentInput = findViewById(R.id.contentInput)
        tagsInput = findViewById(R.id.tagsInput)
        hostInput = findViewById(R.id.hostInput)
        tokenInput = findViewById(R.id.tokenInput)
        syncButton = findViewById(R.id.syncButton)
        pendingTitle = findViewById(R.id.pendingTitle)
        pendingList = findViewById(R.id.pendingList)

        SyncConfig.load(this)?.let {
            hostInput.setText(it.host)
            tokenInput.setText(it.token)
        }

        findViewById<Button>(R.id.saveButton).setOnClickListener { saveMemory() }
        syncButton.setOnClickListener { syncNow() }

        refreshList()
    }

    private fun saveMemory() {
        val content = contentInput.text.toString().trim()
        if (content.isEmpty()) {
            Toast.makeText(this, "Escreva a memória antes de salvar.", Toast.LENGTH_SHORT).show()
            return
        }

        val saved = PendingMemoryStore.add(
            PendingMemory.create(
                content = content,
                tags = tagsInput.text.toString().trim(),
            )
        )

        if (saved) {
            contentInput.text.clear()
            tagsInput.text.clear()
            refreshList()
            Toast.makeText(this, "Memória guardada neste aparelho.", Toast.LENGTH_SHORT).show()
        } else {
            // Falha de gravação em disco: mantém o texto digitado para o usuário
            // poder tentar de novo — nada foi guardado de fato.
            Toast.makeText(this, "Não foi possível salvar a memória.", Toast.LENGTH_LONG).show()
        }
    }

    private fun refreshList() {
        val memories = PendingMemoryStore.list()
        pendingTitle.text = getString(R.string.pending_count, memories.size)
        pendingList.adapter = ArrayAdapter(
            this,
            android.R.layout.simple_list_item_1,
            memories.map { it.toDisplayString() },
        )
    }

    /**
     * Envia as pendentes e remove APENAS os ids em accepted[].
     *
     * Rede em thread própria (sem coroutine/lib): um POST ocasional não
     * justifica dependência. A regra de remoção vive no SyncClient +
     * PendingMemoryStore.removeByIds — aqui só orquestramos e exibimos.
     */
    private fun syncNow() {
        val host = hostInput.text.toString().trim()
        val token = tokenInput.text.toString().trim()
        if (host.isEmpty() || token.isEmpty()) {
            Toast.makeText(this, "Informe o IP do PC e o token.", Toast.LENGTH_LONG).show()
            return
        }

        val pending = PendingMemoryStore.list()
        if (pending.isEmpty()) {
            Toast.makeText(this, "Nada pendente para sincronizar.", Toast.LENGTH_SHORT).show()
            return
        }

        SyncConfig.save(this, host, SyncConfig.DEFAULT_PORT, token)
        syncButton.isEnabled = false

        Thread {
            val result = SyncClient.push(host, SyncConfig.DEFAULT_PORT, token, pending)
            runOnUiThread {
                syncButton.isEnabled = true
                when (result) {
                    is SyncClient.Result.Acknowledged -> {
                        val removed = PendingMemoryStore.removeByIds(result.clientIds)
                        refreshList()
                        val remaining = PendingMemoryStore.list().size
                        val message = if (removed > 0) {
                            "$removed memória(s) confirmada(s) pelo PC."
                        } else {
                            "PC não confirmou nenhuma memória. Tudo continua pendente."
                        }
                        val suffix = if (remaining > 0) " Restam $remaining pendente(s)." else ""
                        Toast.makeText(this, message + suffix, Toast.LENGTH_LONG).show()
                    }
                    is SyncClient.Result.Failed -> {
                        Toast.makeText(this, result.message, Toast.LENGTH_LONG).show()
                    }
                }
            }
        }.start()
    }
}