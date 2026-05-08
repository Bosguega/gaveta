/**
 * Barrel exports para hooks de queries
 *
 * @example
 * // Importar hooks individuais
 * import { useReceiptsQuery, useSaveReceipt } from '@/hooks/queries';
 *
 * // Ou importar hooks específicos de arquivos individuais
 * import { useAllReceiptsQuery } from '@/hooks/queries/useAllReceiptsQuery';
 */

// Receipts
export { useReceiptsQuery, useInfiniteReceiptsQuery, useReceiptItemsQuery } from './useReceiptsQuery';
export { useSaveReceipt } from './useReceiptsQuery';
export { useAllReceiptsQuery } from './useAllReceiptsQuery';
export { useDeleteReceipt } from './useReceiptsQuery';
export { useRestoreReceipts } from './useReceiptsQuery';
export { receiptKeys } from './useReceiptsQuery';
export { allReceiptsKeys } from './useAllReceiptsQuery';

// Canonical Products
export {
  useCanonicalProductsQuery,
  useCreateCanonicalProduct,
  useUpdateCanonicalProduct,
  useDeleteCanonicalProduct,
  useMergeCanonicalProducts,
  canonicalProductKeys,
} from './useCanonicalProductsQuery';

// Dictionary
export {
  useDictionaryQuery,
  useUpdateDictionaryEntry,
  useDeleteDictionaryEntry,
  useClearDictionary,
  dictionaryKeys,
} from './useDictionaryQuery';

// History
export { useHistoryReceipts } from './useHistoryReceipts';

// Search
export { useSearchItems } from './useSearchItems';
export { useFilteredSearchItems } from './useFilteredSearchItems';
export { useSearchChartData } from './useSearchChartData';

// Purchase History
export { usePurchaseHistory } from './usePurchaseHistory';

// Shopping List
export { useSortedShoppingItems } from './useSortedShoppingItems';

// Collaborative Shopping Lists
export {
  useCollaborativeListsQuery,
  useCollaborativeListItemsQuery,
  useCollaborativeListMembersQuery,
  useCollaborativeListRealtime,
  useCreateCollaborativeList,
  useJoinCollaborativeListByCode,
  useRenameCollaborativeList,
  useDeleteCollaborativeList,
  useRegenerateCollaborativeListCode,
  useAddCollaborativeListItem,
  useRemoveCollaborativeListItem,
  useToggleCollaborativeListItem,
  useClearCollaborativeListItems,
  useUpdateCollaborativeListMemberRole,
  useRemoveCollaborativeListMember,
  useTransferCollaborativeListOwnership,
} from './useCollaborativeShoppingListsQuery';
