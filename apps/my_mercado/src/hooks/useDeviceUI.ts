import { useState, useEffect } from 'react'
import { createDeviceStore } from '@bosguega/device-mode-core'
import type { DeviceMode } from '@bosguega/device-mode-core'

const store = createDeviceStore({ storageKey: '@my-mercado/device-mode' })

function resolveAutoMode(): boolean {
    return window.matchMedia('(min-width: 768px)').matches
}

export function useDeviceUI() {
    const [mode, setMode] = useState<DeviceMode>(store.getMode())
    const [isDesktopViewport, setIsDesktopViewport] = useState(resolveAutoMode())

    // Escuta mudanças no store (modo manual via toolbar)
    useEffect(() => {
        const unsub = store.subscribe(setMode)
        return unsub
    }, [])

    // Escuta mudanças no viewport real (apenas para resolver 'auto')
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 768px)')
        const handler = (e: MediaQueryListEvent) => setIsDesktopViewport(e.matches)
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [])

    const resolvedMode: DeviceMode =
        mode === 'auto' ? (isDesktopViewport ? 'desktop' : 'mobile') : mode

    return {
        /** Valor bruto do store (auto | mobile | tablet | desktop) */
        mode,
        /** Valor resolvido: nunca é 'auto'. Se mode === 'auto', usa matchMedia */
        resolvedMode,
        setMode: store.setMode,
        isMobile: resolvedMode === 'mobile',
        isTablet: resolvedMode === 'tablet',
        isDesktop: resolvedMode === 'desktop' || resolvedMode === 'tablet',
        isAuto: mode === 'auto',
    }
}