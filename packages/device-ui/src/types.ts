export type DeviceMode = 'auto' | 'mobile' | 'tablet' | 'desktop'

export interface DeviceStore {
    /** Returns the current mode */
    getMode(): DeviceMode
    /** Sets and persists the current mode */
    setMode(mode: DeviceMode): void
    /** Subscribes to mode changes. Returns an unsubscribe function. */
    subscribe(callback: (mode: DeviceMode) => void): () => void
    /** Removes all listeners */
    destroy(): void
}

export interface DeviceStoreOptions {
    /** Initial mode when nothing is persisted. Default: 'auto' */
    defaultMode?: DeviceMode
    /** localStorage key. Default: '@bosguega/device-ui:mode' */
    storageKey?: string
}