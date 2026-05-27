<template>
    <div v-if="maxWidth" :style="frameStyle" class="dui-frame">
        <slot />
    </div>
    <slot v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDeviceUI } from '../composables/useDeviceUI'

const props = withDefaults(
    defineProps<{
        widths?: Partial<Record<'mobile' | 'tablet', number>>
    }>(),
    {
        widths: () => ({
            mobile: 375,
            tablet: 768,
        }),
    }
)

const { mode } = useDeviceUI()

const maxWidth = computed(() => {
    if (mode.value === 'auto' || mode.value === 'desktop') return 0
    return props.widths[mode.value] ?? 0
})

const frameStyle = computed(() => ({
    maxWidth: maxWidth.value + 'px',
    marginLeft: 'auto',
    marginRight: 'auto',
    width: '100%',
}))
</script>