import { useState, useCallback, useMemo } from 'react';
import {
  getApiKey,
  setApiKey as setApiKeyStorage,
  getApiModel,
  setApiModel as setApiModelStorage,
  detectProvider,
  isPersistenceEnabled,
  setPersistenceEnabled
} from '../utils/aiConfig';

export function useApiKey() {
  const [apiKey, setApiKeyInternal] = useState(() => getApiKey());
  const [model, setModelInternal] = useState(() => getApiModel());
  const [persistApiKey, setPersistApiKeyInternal] = useState(() => isPersistenceEnabled());

  const setApiKey = useCallback((newKey: string | null | undefined) => {
    setApiKeyStorage(newKey);
    setApiKeyInternal(newKey ?? null);
  }, []);

  const setModel = useCallback((newModel: string) => {
    setApiModelStorage(newModel);
    setModelInternal(newModel);
  }, []);

  const setPersistApiKey = useCallback((enabled: boolean) => {
    setPersistenceEnabled(enabled);
    setPersistApiKeyInternal(enabled);
    // Re-salva a chave atual no novo local se ela existir
    const currentKey = getApiKey();
    if (currentKey) {
      setApiKeyStorage(currentKey);
    }
  }, []);

  const provider = useMemo(() => detectProvider(apiKey), [apiKey]);

  return {
    apiKey,
    setApiKey,
    hasKey: !!apiKey,
    model,
    setModel,
    persistApiKey,
    setPersistApiKey,
    provider
  };
}
