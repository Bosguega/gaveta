import type { ShoppingListsCloudSnapshot } from "../types/ui";
import { serializeSnapshotToUrl } from "./urlDataSerializer";
import { formatListToWhatsApp } from "./shoppingList";
import { generateId } from "./idGenerator";

const SHARE_STORAGE_PREFIX = "@MyMercado:shared-list:";

/**
 * Gera um ID curto para compartilhamento (8 caracteres alfanuméricos)
 */
function generateShareId(): string {
    return generateId().slice(0, 8).toLowerCase();
}

/**
 * Salva um snapshot de lista no localStorage e retorna o shareId.
 * O snapshot fica disponível para importação por quem tiver o shareId.
 */
export function saveSharedSnapshot(snapshot: ShoppingListsCloudSnapshot): string {
    const shareId = generateShareId();
    const key = `${SHARE_STORAGE_PREFIX}${shareId}`;

    const payload = {
        ...snapshot,
        shared_at: new Date().toISOString(),
    };

    try {
        localStorage.setItem(key, JSON.stringify(payload));
        return shareId;
    } catch {
        // Se localStorage estiver cheio, limpa snapshots antigos e tenta de novo
        cleanupOldSnapshots();
        try {
            localStorage.setItem(key, JSON.stringify(payload));
            return shareId;
        } catch {
            throw new Error("Não foi possível salvar o snapshot para compartilhamento.");
        }
    }
}

/**
 * Carrega um snapshot de lista pelo shareId.
 * Retorna null se não encontrado ou expirado.
 */
export function loadSharedSnapshot(shareId: string): ShoppingListsCloudSnapshot | null {
    const key = `${SHARE_STORAGE_PREFIX}${shareId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        // Validação básica
        if (!parsed || !Array.isArray(parsed.lists) || !parsed.items_by_list) return null;
        return parsed as ShoppingListsCloudSnapshot;
    } catch {
        return null;
    }
}

/**
 * Monta URL de compartilhamento para o app.
 * Pode ser baseado em ID (requer persistência), em Data (standalone) ou em Code (live).
 */
export function getShareUrl(shareIdOrData: string, type: "shared" | "data" | "code" = "shared"): string {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?${type}=${shareIdOrData}`;
}

/**
 * Tenta compartilhar via Web Share API.
 * Se não disponível, copia o link para a área de transferência.
 */
export async function shareList(
    snapshot: ShoppingListsCloudSnapshot,
    listName: string,
    items: any[],
    liveCode?: string
): Promise<"shared" | "copied" | "failed"> {
    const data = serializeSnapshotToUrl(snapshot);
    
    // Se tiver liveCode, gera um link "live", senão usa o "data" (estático)
    const url = liveCode ? getShareUrl(liveCode, "code") : getShareUrl(data, "data");
    const text = formatListToWhatsApp(listName, items);

    const shareTitle = `Lista: ${listName}`;
    const shareText = liveCode 
        ? `🛒 Veja minha lista de compras em tempo real!\n\n${text}`
        : text;

    if (navigator.share) {
        try {
            await navigator.share({
                title: shareTitle,
                text: shareText,
                url,
            });
            return "shared";
        } catch (err) {
            if ((err as Error).name === "AbortError") return "failed";
        }
    }

    // Fallback: copiar link e texto
    try {
        await navigator.clipboard.writeText(`${shareText}\n\nLink: ${url}`);
        return "copied";
    } catch {
        return "failed";
    }
}

/**
 * Extrai shareId da URL atual (query param ?shared=xxx)
 */
export function getShareIdFromUrl(): string | null {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("shared")?.trim().toLowerCase();
    return raw?.length ? raw : null;
}

/**
 * Remove snapshots antigos (> 7 dias) para liberar espaço.
 */
function cleanupOldSnapshots() {
    const now = Date.now();
    const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(SHARE_STORAGE_PREFIX)) {
            try {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    const sharedAt = new Date(parsed.shared_at).getTime();
                    if (now - sharedAt > MAX_AGE_MS) {
                        localStorage.removeItem(key);
                    }
                }
            } catch {
                // Se corrompido, remove
                localStorage.removeItem(key);
            }
        }
    }
}