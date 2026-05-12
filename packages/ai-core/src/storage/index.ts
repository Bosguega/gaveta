export {
    setConfigStore,
    getConfigStore,
    isPersistenceEnabled,
    setPersistenceEnabled,
    getApiKey,
    setApiKey,
    clearApiKey,
    getApiModel,
    setApiModel,
    detectProvider,
    hasApiKey,
    browserStore,
} from './aiConfig'

export type { ConfigStore, KeyValueStore, Provider } from './types'

export {
    initializeAiConfig,
    getApiKeyCached,
    getApiModelCached,
    detectProviderCached,
    hasApiKeyCached,
    invalidateAiConfigCache,
} from './cache'
