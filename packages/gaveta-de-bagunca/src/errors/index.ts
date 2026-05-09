export type { ApiErrorCode, ApiErrorLike } from './types'
export {
    isAuthError,
    isRetryableError,
    isNetworkError,
} from './types'

// friendlyMessages e getFriendlyMessage não são reexportados daqui
// porque já existem em @bosguega/gaveta-de-bagunca vindos de src/gemini/errors.ts