// Types and store
export type { DeviceMode, DeviceStore, DeviceStoreOptions } from './types'
export { createDeviceStore } from './store'

// Domain constants (no UI — just rules)
export { DEVICE_DESKTOP_MEDIA_QUERY } from './constants'

// Pure helpers (framework-agnostic)
export { resolveDeviceMode, deriveDeviceFlags } from './resolve'
export type { DeviceFlags } from './resolve'
