/**
 * AI Config - Legacy Re-export
 *
 * Este arquivo existe para compatibilidade com imports existentes.
 * Use utils/ai/aiConfig.ts para novos imports.
 */

export {
  getApiKey,
  setApiKey,
  getApiModel,
  setApiModel,
  detectProvider,
  isPersistenceEnabled,
  setPersistenceEnabled,
} from "./ai/aiConfig";
