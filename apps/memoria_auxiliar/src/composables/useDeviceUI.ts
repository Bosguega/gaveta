import { ref, computed, onMounted, onUnmounted } from 'vue'
import { createDeviceStore } from '@bosguega/device-mode-core'
import type { DeviceMode } from '@bosguega/device-mode-core'

const store = createDeviceStore({ storageKey: '@memoria-auxiliar/device-mode' })

export function useDeviceUI() {
    const mode = ref<DeviceMode>(store.getMode())
    const isDesktopViewport = ref(window.matchMedia('(min-width: 768px)').matches)

    let unsub: (() => void) | null = null
    let mq: MediaQueryList | null = null
    let mqHandler: ((e: MediaQueryListEvent) => void) | null = null

    onMounted(() => {
        // Escuta mudanças no store (modo manual via toolbar)
        unsub = store.subscribe((m: DeviceMode) => {
            mode.value = m
        })

        // Escuta mudanças no viewport real (para resolver 'auto')
        mq = window.matchMedia('(min-width: 768px)')
        mqHandler = (e: MediaQueryListEvent) => {
            isDesktopViewport.value = e.matches
        }
        mq.addEventListener('change', mqHandler)
    })

    onUnmounted(() => {
        unsub?.()
        if (mq && mqHandler) {
            mq.removeEventListener('change', mqHandler)
        }
    })

    const resolvedMode = computed<DeviceMode>(() => {
        return mode.value === 'auto'
            ? (isDesktopViewport.value ? 'desktop' : 'mobile')
            : mode.value
    })

    const setMode = (m: DeviceMode) => store.setMode(m)

    return {
        /** Valor bruto do store (auto | mobile | tablet | desktop) */
        mode,
        /** Valor resolvido: nunca é 'auto'. Se mode === 'auto', usa matchMedia */
        resolvedMode,
        setMode,
        isMobile: computed(() => resolvedMode.value === 'mobile'),
        isTablet: computed(() => resolvedMode.value === 'tablet'),
        isDesktop: computed(() => resolvedMode.value === 'desktop' || resolvedMode.value === 'tablet'),
        isAuto: computed(() => mode.value === 'auto'),
    }
}