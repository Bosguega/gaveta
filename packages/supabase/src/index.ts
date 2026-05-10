// Factory
export { createSupabaseClient } from './create-client'
export type { SupabaseConfig } from './create-client'

// Errors
export { SupabaseError, isAuthError, isNetworkError, mapSupabaseError } from './errors'

// Utils
export { withRetry } from './retry'
export type { RetryOptions } from './retry'
export { withTimeout } from './timeout'

// Auth
export {
    signIn,
    signUp,
    signOut,
    getUser,
    getSession,
    onAuthStateChange,
    mapAuthError,
} from './auth'

// Services
export { invoke } from './services/functions'
export type { InvokeOptions } from './services/functions'
export { upload, download, remove, getPublicUrl } from './services/storage'