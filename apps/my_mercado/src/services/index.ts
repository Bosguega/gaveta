// Barrel export for services module

// Receipt service
export {
    getReceiptsPaginated,
    getAllReceiptsFromDB,
    getReceiptItemsFromDB,
    restoreReceiptsToDB,
    saveReceiptToDB,
    deleteReceiptFromDB,
    clearReceiptsAndItemsFromDB,
} from "./receiptService";

// Dictionary service
export {
    getFullDictionaryFromDB,
    updateDictionaryEntryInDB,
    applyDictionaryEntryToSavedItems,
    deleteDictionaryEntryFromDB,
    clearDictionaryInDB,
    getDictionary,
    updateDictionary,
    associateDictionaryToCanonicalProduct,
} from "./dictionaryService";

// Canonical product service
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

// Storage fallback service
export {
    getAllReceiptsFromDBWithFallback,
    saveReceiptToDBWithFallback,
    getDictionaryWithFallback,
    getStorageConnectionStatus,
} from "./storageFallbackService";

// Shopping list snapshot service
export {
    pushSnapshot,
    pullSnapshot,
    deleteSnapshot,
} from "./shoppingListSnapshotService";