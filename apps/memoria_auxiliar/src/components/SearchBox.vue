<script setup lang="ts">
import { ref, watch } from 'vue';

const emit = defineEmits<{
  search: [query: string];
}>();

const query = ref('');
let timeout: ReturnType<typeof setTimeout> | null = null;

watch(query, (newVal) => {
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(() => {
    emit('search', newVal.trim());
  }, 300);
});

function submit() {
  const value = query.value.trim();
  emit('search', value);
}
</script>

<template>
  <section class="panel search-panel">
    <h2>Buscar memoria</h2>
    <form class="search-form" @submit.prevent="submit">
      <input
        v-model="query"
        type="search"
        placeholder="Busque em linguagem natural"
      />
      <button type="submit">Buscar</button>
    </form>
  </section>
</template>
