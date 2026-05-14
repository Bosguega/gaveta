import { useEffect, useRef } from "react";
import { notify } from "../utils/notifications";
import { getShareIdFromUrl, loadSharedSnapshot } from "../utils/shareService";
import { deserializeSnapshotFromUrl } from "../utils/urlDataSerializer";
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

        const params = new URLSearchParams(window.location.search);
        const urlData = params.get("data");
        const shareId = getShareIdFromUrl();

        let snapshot = null;
        if (urlData) {
            snapshot = deserializeSnapshotFromUrl(urlData);
        } else if (shareId) {
            snapshot = loadSharedSnapshot(shareId);
        }

        if (!snapshot) {
            if (urlData || shareId) {
                notify.error("Lista compartilhada não encontrada ou inválida.");
            }
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

        // Limpar query params da URL
        const url = new URL(window.location.href);
        url.searchParams.delete("shared");
        url.searchParams.delete("data");
        window.history.replaceState({}, "", url.toString());
    }, []);
}