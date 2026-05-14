import type { ShoppingListsCloudSnapshot } from "../types/ui";

/**
 * Serializa um snapshot de lista para uma string Base64 segura para URL.
 */
export function serializeSnapshotToUrl(snapshot: ShoppingListsCloudSnapshot): string {
  try {
    const json = JSON.stringify(snapshot);
    // encodeURIComponent + unescape é um truque comum para lidar com caracteres Unicode no btoa
    const base64 = btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
    return base64;
  } catch (error) {
    console.error("Erro ao serializar snapshot:", error);
    return "";
  }
}

/**
 * Deserializa um snapshot a partir de uma string Base64.
 */
export function deserializeSnapshotFromUrl(data: string): ShoppingListsCloudSnapshot | null {
  try {
    const json = decodeURIComponent(Array.prototype.map.call(atob(data), (c: string) => {
      return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(""));
    const parsed = JSON.parse(json);
    
    // Validação básica
    if (!parsed || !Array.isArray(parsed.lists)) return null;
    return parsed as ShoppingListsCloudSnapshot;
  } catch (error) {
    console.error("Erro ao deserializar snapshot:", error);
    return null;
  }
}
