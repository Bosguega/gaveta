// Auth
export {
  requireSupabase,
  getAuthenticatedSupabaseContext,
  getUserOrThrow,
  isAuthenticated,
  getUserOrNull,
} from "./authService";

// Receipts
export {
  getReceiptsPaginated,
  getReceiptItemsFromDB,
  getAllReceiptsFromDB,
  restoreReceiptsToDB,
  saveReceiptToDB,
  deleteReceiptFromDB,
  clearReceiptsAndItemsFromDB,
  type GetReceiptsFilters,
  type GetReceiptsOptions,
  type GetReceiptsResult,
} from "./receiptService";

// Dictionary
export {
  getFullDictionaryFromDB,
  updateDictionaryEntryInDB,
  applyDictionaryEntryToSavedItems,
  deleteDictionaryEntryFromDB,
  clearDictionaryInDB,
  getDictionary,
  updateDictionary,
  associateDictionaryToCanonicalProduct,
  type DictionaryUpdateEntry,
} from "./dictionaryService";

// Canonical Products
export {
  getCanonicalProducts,
  getCanonicalProduct,
  createCanonicalProduct,
  updateCanonicalProduct,
  deleteCanonicalProduct,
  mergeCanonicalProducts,
  clearCanonicalProductsInDB,
  associateItemToCanonicalProduct,
} from "./canonicalProductService";

// Storage Fallback
export {
  getAllReceiptsFromDBWithFallback,
  saveReceiptToDBWithFallback,
  getDictionaryWithFallback,
  getStorageConnectionStatus,
} from "./storageFallbackService";

// Sync
export { syncLocalStorageWithSupabase } from "./syncService";
export { syncShoppingListsWithCloud } from "./shoppingListCloudSyncService";

// Shopping List Snapshots (tabela dedicada Supabase)
export {
  pushSnapshot,
  pullSnapshot,
  deleteSnapshot,
} from "./shoppingListSnapshotService";
