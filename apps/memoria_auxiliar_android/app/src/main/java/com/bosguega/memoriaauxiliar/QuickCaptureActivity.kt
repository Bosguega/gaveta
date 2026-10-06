package com.bosguega.memoriaauxiliar

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import com.bosguega.memoriaauxiliar.data.PendingMemory
import com.bosguega.memoriaauxiliar.data.PendingMemoryStore

/**
 * Captura rápida aberta pelo widget: digitar -> salvar -> fechar.
 *
 * Entrada alternativa para a mesma PendingMemoryStore do app — sem tags
 * (v1), sem sincronização e sem conhecimento do PC. Na falha de gravação
 * o texto é mantido e o diálogo não fecha, para nada se perder.
 */
class QuickCaptureActivity : Activity() {

    private lateinit var contentInput: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_quick_capture)

        PendingMemoryStore.init(this)

        contentInput = findViewById(R.id.quickContentInput)
        findViewById<Button>(R.id.quickSaveButton).setOnClickListener { saveAndClose() }
    }

    private fun saveAndClose() {
        val content = contentInput.text.toString().trim()
        if (content.isEmpty()) {
            Toast.makeText(this, "Escreva a memória antes de salvar.", Toast.LENGTH_SHORT).show()
            return
        }

        val saved = PendingMemoryStore.add(PendingMemory.create(content = content))
        if (saved) {
            Toast.makeText(this, "✓ Memória salva.", Toast.LENGTH_SHORT).show()
            finish()
        } else {
            Toast.makeText(this, "Não foi possível salvar a memória.", Toast.LENGTH_LONG).show()
        }
    }
}
