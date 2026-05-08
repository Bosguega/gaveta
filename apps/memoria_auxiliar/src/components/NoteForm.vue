<script setup lang="ts">
import { ref, watch } from 'vue';
import { notesStore } from '../store/notesStore';

const emit = defineEmits<{
  save: [content: string];
}>();

const content = ref('');
const error = ref('');

watch(() => notesStore.editingNote, (note) => {
  if (note) {
    content.value = note.content;
    error.value = '';
  } else {
    content.value = '';
    error.value = '';
  }
}, { immediate: true });

function validateContent(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'A nota não pode estar vazia.';
  }
  if (trimmed.length < 3) {
    return 'A nota deve ter pelo menos 3 caracteres.';
  }
  if (trimmed.length > 1000) {
    return 'A nota deve ter no máximo 1000 caracteres.';
  }
  return '';
}

function submit() {
  const value = content.value.trim();
  const validationError = validateContent(value);
  if (validationError) {
    error.value = validationError;
    return;
  }

  emit('save', value);
  content.value = '';
  error.value = '';
}

defineExpose({ submit });

function cancel() {
  notesStore.editingNote = null;
  content.value = '';
  error.value = '';
}
</script>

<template>
  <section class="panel">
    <h2>{{ notesStore.editingNote ? 'Editar nota' : 'Nova nota' }}</h2>
    <form class="note-form" @submit.prevent="submit">
      <textarea
        v-model="content"
        rows="3"
        placeholder="Ex.: Levar documento ao medico na sexta"
        :class="{ error: error }"
      />
      <p v-if="error" class="error-message">{{ error }}</p>
      <div class="form-actions">
        <button type="submit">{{ notesStore.editingNote ? 'Atualizar' : 'Salvar' }}</button>
        <button v-if="notesStore.editingNote" type="button" class="secondary" @click="cancel">Cancelar</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.form-actions {
  display: flex;
  gap: 10px;
}

textarea.error {
  border-color: var(--error);
}

.error-message {
  color: var(--error);
  font-size: 0.875rem;
  margin: 4px 0 0 0;
}
</style>
