import { useEffect, useRef } from "react";
import { notify } from "../utils/notifications";
import { getShareIdFromUrl, loadSharedSnapshot } from "../utils/shareService";
import { useShoppingListStore } from "../stores/useShoppingListStore";
import { useUiStore } from "../stores/useUiStore";
import { useReceiptsSessionStore } from "../stores/useReceiptsSessionStore";

/**
 * Hook que detecta se o app foi aberto com ?shared=xxx na URL
 * e importa a lista compartilhada automaticamente.
 *
 * Deve ser usado no App.tsx ou ShoppingListTab.
 */
export function useSharedListImport() {
    const importedRef = useRef(false);

    useEffect(() => {
        if (importedRef.current) return;
        importedRef.current = true;

        const shareId = getShareIdFromUrl();
        if (!shareId) return;

        const snapshot = loadSharedSnapshot(shareId);
        if (!snapshot) {
            notify.error("Lista compartilhada não encontrada ou expirada.");
            return;
        }

        const sessionUserId = useReceiptsSessionStore.getState().sessionUserId;
        const applied = useShoppingListStore.getState().applyCloudSnapshot(sessionUserId, snapshot);

        if (applied) {
            const listName = snapshot.lists[0]?.name || "Compras";
            notify.success(`Lista "${listName}" importada!`);

            // Navegar para a aba de lista
            useUiStore.getState().setTab("shopping");
        } else {
            notify.error("Não foi possível importar a lista compartilhada.");
        }

        // Limpar query param da URL
        const url = new URL(window.location.href);
        url.searchParams.delete("shared");
        window.history.replaceState({}, "", url.toString());
    }, []);
}