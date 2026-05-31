import type { DeviceMode, DeviceStore, DeviceStoreOptions } from './types'

const DEFAULT_STORAGE_KEY = '@bosguega/device-mode:mode'

function load(key: string, fallback: DeviceMode): DeviceMode {
    try {
        const raw = localStorage.getItem(key)
        if (raw === 'auto' || raw === 'mobile' || raw === 'tablet' || raw === 'desktop') {
            return raw
        }
    } catch {
        // localStorage might be unavailable (SSR, privacy mode, etc.)
    }
    return fallback
}

function save(key: string, mode: DeviceMode): void {
    try {
        localStorage.setItem(key, mode)
    } catch {
        // Silently fail if localStorage is unavailable
    }
}

export function createDeviceStore(options?: DeviceStoreOptions): DeviceStore {
    const key = options?.storageKey ?? DEFAULT_STORAGE_KEY
    const fallback = options?.defaultMode ?? 'auto'
    let mode: DeviceMode = load(key, fallback)
    const listeners = new Set<(mode: DeviceMode) => void>()

    return {
        getMode: () => mode,

        setMode: (newMode: DeviceMode) => {
            if (mode === newMode) return
            mode = newMode
            save(key, mode)
            listeners.forEach((fn) => fn(mode))
        },

        subscribe: (callback) => {
            listeners.add(callback)
            return () => {
                listeners.delete(callback)
            }
        },

        destroy: () => {
            listeners.clear()
        },
    }
}