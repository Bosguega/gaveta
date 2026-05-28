import { useState, useEffect } from 'react'
import { createDeviceStore } from '@bosguega/device-ui-core'
import type { DeviceMode } from '@bosguega/device-ui-core'

const store = createDeviceStore()

export function useDeviceUI() {
    const [mode, setMode] = useState<DeviceMode>(store.getMode())

    useEffect(() => {
        const unsub = store.subscribe(setMode)
        return unsub
    }, [])

    return {
        mode,
        setMode: store.setMode,
        isMobile: mode === 'mobile',
        isTablet: mode === 'tablet',
        isDesktop: mode === 'desktop',
        isAuto: mode === 'auto',
    }
}