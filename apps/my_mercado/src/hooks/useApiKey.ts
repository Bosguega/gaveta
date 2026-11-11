import { useState, useCallback, useMemo } from 'react';
import {
  getAiBaseUrl,
  getAiMode,
  getAiProvider,
  getApiKey,
  setApiKey as setApiKeyStorage,
  getApiModel,
  setApiModel as setApiModelStorage,
  getAiLocalModel,
  setAiLocalModel as setAiLocalModelStorage,
  detectProvider,
  getProviderLabel,
  setAiBaseUrl as setAiBaseUrlStorage,
  setAiMode as setAiModeStorage,
  setAiProvider as setAiProviderStorage,
  isPersistenceEnabled,
  setPersistenceEnabled,
  type AIMode,
  type AIProvider
} from '../utils/ai/aiConfig';

export function useAiConfig() {
  const [mode, setModeInternal] = useState<AIMode>(() => getAiMode());
  const [providerInternal, setProviderInternal] = useState<AIProvider>(() => getAiProvider());
  const [apiKey, setApiKeyInternal] = useState(() => getApiKey());
  const [model, setModelInternal] = useState(() => getApiModel());
  const [localModel, setLocalModelInternal] = useState(() => getAiLocalModel());
  const [baseUrl, setBaseUrlInternal] = useState(() => getAiBaseUrl());
  const [persistApiKey, setPersistApiKeyInternal] = useState(() => isPersistenceEnabled());

  const setMode = useCallback(async (newMode: AIMode) => {
    await setAiModeStorage(newMode);
    setModeInternal(newMode);
  }, []);

  const setProvider = useCallback(async (newProvider: AIProvider) => {
    await setAiProviderStorage(newProvider);
    setProviderInternal(newProvider);
  }, []);

  const setApiKey = useCallback(async (newKey: string | null | undefined) => {
    await setApiKeyStorage(newKey);
    setApiKeyInternal(newKey ?? null);
  }, []);

  const setModel = useCallback(async (newModel: string) => {
    await setApiModelStorage(newModel);
    setModelInternal(newModel);
  }, []);

  const setLocalModel = useCallback(async (newModel: string) => {
    await setAiLocalModelStorage(newModel);
    setLocalModelInternal(newModel);
  }, []);

  const setBaseUrl = useCallback(async (newBaseUrl: string) => {
    await setAiBaseUrlStorage(newBaseUrl);
    setBaseUrlInternal(newBaseUrl);
  }, []);

  const setPersistApiKey = useCallback(async (enabled: boolean) => {
    await setPersistenceEnabled(enabled);
    setPersistApiKeyInternal(enabled);
  }, []);

  const provider = useMemo(
    () => mode === 'local' ? getProviderLabel(providerInternal) : detectProvider(apiKey),
    [apiKey, mode, providerInternal]
  );
  const hasAiConfig = mode === 'local'
    ? providerInternal === 'llama-cpp' && !!localModel
    : !!apiKey;

  return {
    mode,
    setMode,
    providerInternal,
    setProvider,
    apiKey,
    setApiKey,
    hasKey: !!apiKey,
    hasAiConfig,
    model,
    setModel,
    localModel,
    setLocalModel,
    baseUrl,
    setBaseUrl,
    persistApiKey,
    setPersistApiKey,
    provider
  };
}

export const useApiKey = useAiConfig;
