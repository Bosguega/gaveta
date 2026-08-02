/**
 * Inventory — pure data model returned by the Rust scanner.
 * No presentation fields exist here. This is the single source of truth.
 */

import type { Metadata } from '@/metadata/metadata';

export interface InventoryItem {
    id: string;
    name: string;
    path: string;
    category: string;
    sizeMb: number;
    fileType: string;
    metadata?: Metadata;
}

export interface Inventory {
    comfyuiPath: string;
    scanDate: string;
    items: InventoryItem[];
    summary: Record<string, number>;
}

/**
 * Maps the raw Rust ScanResult (snake_case) to the immutable Inventory (camelCase).
 * The original object is never mutated.
 */
export function toInventory(
    raw: {
        success: boolean;
        comfyui_path: string;
        items: Array<{ name: string; path: string; size_mb: number; category: string; file_type: string }>;
        summary: Record<string, number>;
        error?: string;
    }
): Inventory {
    return {
        comfyuiPath: raw.comfyui_path,
        scanDate: new Date().toISOString(),
        items: raw.items.map((item, index) => ({
            id: `${item.path}-${index}`,
            name: item.name,
            path: item.path,
            category: item.category,
            sizeMb: item.size_mb,
            fileType: item.file_type,
        })),
        summary: raw.summary,
    };
}

/**
 * Filters out Input/Output Images from the inventory, returning a new immutable Inventory.
 */
export function filterImageCategories(inventory: Inventory): Inventory {
    const items = inventory.items.filter(
        item => item.category !== 'Input Images' && item.category !== 'Output Images'
    );
    const summary = items.reduce<Record<string, number>>((counts, item) => {
        counts[item.category] = (counts[item.category] ?? 0) + 1;
        return counts;
    }, {});

    return {
        ...inventory,
        items,
        summary,
    };
}
