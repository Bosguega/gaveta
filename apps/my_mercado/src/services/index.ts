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
} from "./dictionaryService";

// Establishment dictionary service
export {
    getFullEstablishmentDictionaryFromDB,
    getEstablishmentMapFromDB,
    upsertEstablishmentDictionaryEntryInDB,
    applyEstablishmentEntryToSavedReceipts,
    deleteEstablishmentDictionaryEntryFromDB,
    clearEstablishmentDictionaryInDB,
} from "./establishmentDictionaryService";


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