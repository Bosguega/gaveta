/**
 * JsonRenderer - serializes Inventory directly (no Cards).
 * Preserves the current JSON format for AI/chatbot/automation compatibility.
 */
import type { Inventory } from '@/inventory/inventory';

export function renderJson(inventory: Inventory): string {
    const data = {
        comfyui_path: inventory.comfyuiPath,
        scan_date: inventory.scanDate,
        summary: inventory.summary,
        items: inventory.items.map(item => ({
            name: item.name,
            path: item.path,
            size_mb: item.sizeMb,
            category: item.category,
            file_type: item.fileType,
        })),
    };
    return JSON.stringify(data, null, 2);
}
