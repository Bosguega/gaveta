/**
 * CsvRenderer - tabular format directly from Inventory (no Cards).
 */
import type { Inventory } from '@/inventory/inventory';

export function renderCsv(inventory: Inventory): string {
    let csv = 'Export Group,Name,Path,Size (MB),Category,Type\n';
    const items = [...inventory.items].sort((a, b) => {
        const groupA = a.category === 'Workflows' ? 1 : 0;
        const groupB = b.category === 'Workflows' ? 1 : 0;
        return groupA - groupB || a.name.localeCompare(b.name);
    });
    for (const item of items) {
        csv += [item.category === 'Workflows' ? 'Workflow' : 'Inventory', item.name, item.path, item.sizeMb.toFixed(2), item.category, item.fileType]
            .map(escapeCsvValue)
            .join(',') + '\n';
    }
    return csv;
}

function escapeCsvValue(value: string): string {
    const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safeValue.replace(/"/g, '""')}"`;
}
