import { useState, useEffect } from 'react'
import {
    createDeviceStore,
    DEVICE_DESKTOP_MEDIA_QUERY,
    resolveDeviceMode,
    deriveDeviceFlags,
    type DeviceMode,
} from '@bosguega/device-mode-core'

const store = createDeviceStore({ storageKey: '@my-mercado/device-mode' })

function resolveIsDesktopViewport(): boolean {
    return window.matchMedia(DEVICE_DESKTOP_MEDIA_QUERY).matches
}

export function useDeviceUI() {
    const [mode, setMode] = useState<DeviceMode>(store.getMode())
    const [isDesktopViewport, setIsDesktopViewport] = useState(resolveIsDesktopViewport())

    // Escuta mudanças no store (modo manual via toolbar)
    useEffect(() => {
        const unsub = store.subscribe(setMode)
        return unsub
    }, [])

    // Escuta mudanças no viewport real (apenas para resolver 'auto')
    useEffect(() => {
        const mq = window.matchMedia(DEVICE_DESKTOP_MEDIA_QUERY)
        const handler = (e: MediaQueryListEvent) => setIsDesktopViewport(e.matches)
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [])

    const resolvedMode = resolveDeviceMode(mode, isDesktopViewport)
    const flags = deriveDeviceFlags(mode, resolvedMode)

    return {
        /** Valor bruto do store (auto | mobile | tablet | desktop) */
        mode,
        /** Valor resolvido: nunca é 'auto'. Se mode === 'auto', usa matchMedia */
        resolvedMode,
        setMode: store.setMode,
        ...flags,
    }
}
