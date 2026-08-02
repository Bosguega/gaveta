/**
 * CsvRenderer - tabular format directly from Inventory (no Cards).
 */
import type { Inventory } from '@/inventory/inventory';

export function renderCsv(inventory: Inventory): string {
    let csv = 'Name,Path,Size (MB),Category,Type\n';
    for (const item of inventory.items) {
        csv += [item.name, item.path, item.sizeMb.toFixed(2), item.category, item.fileType]
            .map(escapeCsvValue)
            .join(',') + '\n';
    }
    return csv;
}

function escapeCsvValue(value: string): string {
    const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safeValue.replace(/"/g, '""')}"`;
}
