import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
    createDeviceStore,
    DEVICE_DESKTOP_MEDIA_QUERY,
    resolveDeviceMode,
    deriveDeviceFlags,
    type DeviceMode,
} from '@bosguega/device-mode-core'

const store = createDeviceStore({ storageKey: '@memoria-auxiliar/device-mode' })

export function useDeviceUI() {
    const mode = ref<DeviceMode>(store.getMode())
    const isDesktopViewport = ref(
        window.matchMedia(DEVICE_DESKTOP_MEDIA_QUERY).matches,
    )

    let unsub: (() => void) | null = null
    let mq: MediaQueryList | null = null
    let mqHandler: ((e: MediaQueryListEvent) => void) | null = null

    onMounted(() => {
        // Escuta mudanças no store (modo manual via toolbar)
        unsub = store.subscribe((m: DeviceMode) => {
            mode.value = m
        })

        // Escuta mudanças no viewport real (para resolver 'auto')
        mq = window.matchMedia(DEVICE_DESKTOP_MEDIA_QUERY)
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

    const resolvedMode = computed<DeviceMode>(() =>
        resolveDeviceMode(mode.value, isDesktopViewport.value),
    )

    const flags = computed(() =>
        deriveDeviceFlags(mode.value, resolvedMode.value),
    )

    return {
        /** Valor bruto do store (auto | mobile | tablet | desktop) */
        mode,
        /** Valor resolvido: nunca é 'auto'. Se mode === 'auto', usa matchMedia */
        resolvedMode,
        setMode: (m: DeviceMode) => store.setMode(m),
        isMobile: computed(() => flags.value.isMobile),
        isTablet: computed(() => flags.value.isTablet),
        isDesktop: computed(() => flags.value.isDesktop),
        isAuto: computed(() => flags.value.isAuto),
    }
}
