import { useState, useCallback, useMemo } from 'react';
import {
  getApiKey,
  setApiKey as setApiKeyStorage,
  getApiModel,
  setApiModel as setApiModelStorage,
  detectProvider,
  isPersistenceEnabled,
  setPersistenceEnabled
} from '../utils/ai/aiConfig';

export function useApiKey() {
  const [apiKey, setApiKeyInternal] = useState(() => getApiKey());
  const [model, setModelInternal] = useState(() => getApiModel());
  const [persistApiKey, setPersistApiKeyInternal] = useState(() => isPersistenceEnabled());

  const setApiKey = useCallback(async (newKey: string | null | undefined) => {
    await setApiKeyStorage(newKey);
    setApiKeyInternal(newKey ?? null);
  }, []);

  const setModel = useCallback(async (newModel: string) => {
    await setApiModelStorage(newModel);
    setModelInternal(newModel);
  }, []);

  const setPersistApiKey = useCallback(async (enabled: boolean) => {
    await setPersistenceEnabled(enabled);
    setPersistApiKeyInternal(enabled);
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
