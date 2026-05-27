import { computed, onMounted, onUnmounted, ref } from 'vue'
import { createDeviceStore } from '@bosguega/device-ui-core'
import type { DeviceMode } from '@bosguega/device-ui-core'

const store = createDeviceStore()

export function useDeviceUI() {
    const mode = ref<DeviceMode>(store.getMode())

    let unsubscribe: (() => void) | null = null

    onMounted(() => {
        unsubscribe = store.subscribe((m) => {
            mode.value = m
        })
    })

    onUnmounted(() => {
        unsubscribe?.()
    })

    const setMode = (m: DeviceMode) => store.setMode(m)

    const isMobile = computed(() => mode.value === 'mobile')
    const isTablet = computed(() => mode.value === 'tablet')
    const isDesktop = computed(() => mode.value === 'desktop')
    const isAuto = computed(() => mode.value === 'auto')

    return { mode, setMode, isMobile, isTablet, isDesktop, isAuto }
}