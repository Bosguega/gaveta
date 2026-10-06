package com.bosguega.memoriaauxiliar.data

import java.time.Instant
import java.util.UUID

/**
 * Memória capturada no celular ainda não confirmada pelo PC.
 *
 * Espelha apenas os campos do Note do memoria_auxiliar que fazem sentido
 * fora do PC: content, tags e created_at. O timestamp é RFC 3339 em UTC,
 * o mesmo formato gerado por Utc::now().to_rfc3339() no backend Rust —
 * Instant.toString() produz "2026-10-06T12:00:00.123Z", que também é
 * RFC 3339 válido e parseável pelo chrono.
 *
 * O id é um UUID gerado no momento da captura. O id inteiro do SQLite do PC
 * é local (rowid autoincremental) e não serve como identificador entre
 * dispositivos: a sincronização futura levará este UUID para que o PC possa
 * descartar duplicatas de forma idempotente (futura coluna client_id).
 *
 * embedding, pinned e reminder_at não existem aqui de propósito: embedding
 * é exclusivo do PC (BGE-M3), e os demais entram quando houver fluxo real.
 */
data class PendingMemory(
    val id: String,
    val content: String,
    val tags: String,
    val createdAt: String,
) {
    /** Linha resumida exibida na lista de pendentes. */
    fun toDisplayString(): String {
        val time = createdAt.take(16).replace('T', ' ')
        val firstLine = content.lineSequence().firstOrNull().orEmpty()
        val preview = if (firstLine.length > 60) firstLine.take(60) + "…" else firstLine
        val tagPart = if (tags.isBlank()) "" else "  [$tags]"
        return "$time  $preview$tagPart"
    }

    companion object {
        /** Cria uma memória com identidade própria e o momento da captura. */
        fun create(content: String, tags: String = ""): PendingMemory =
            PendingMemory(
                id = UUID.randomUUID().toString(),
                content = content,
                tags = tags,
                createdAt = Instant.now().toString(),
            )
    }
}