import type { InventoryItem } from '@/inventory/inventory';
import type { Metadata } from '@/metadata/metadata';

export interface InventoryEnrichedItem extends InventoryItem {
    friendlyName: string;
    formattedSize: string;
    metadata: Metadata;
    warnings: string[];
}

function parseMetadata(name: string): Metadata {
    const stem = name.replace(/\.[^.]+$/, '');
    const lower = stem.toLowerCase();
    const precision = lower.match(/\b(fp(?:16|32|8)|bf16)\b/)?.[1]?.toUpperCase();
    const quantization = lower.match(/\b(q\d+(?:_[a-z0-9]+)?|int[48])\b/i)?.[1]?.toUpperCase();
    const scaled = /\b(?:scaled|upscaled|\d+x)\b/i.test(stem) || undefined;
    return { precision, quantization, scaled };
}

function formatSize(sizeMb: number): string {
    if (sizeMb >= 1024) return `${(sizeMb / 1024).toFixed(2)} GB`;
    return `${sizeMb.toFixed(2)} MB`;
}

export function enrichItems(items: InventoryItem[]): InventoryEnrichedItem[] {
    return items.map(item => ({
        ...item,
        friendlyName: item.name.replace(/\.[^.]+$/, ''),
        formattedSize: formatSize(item.sizeMb),
        metadata: parseMetadata(item.name),
        warnings: item.sizeMb === 0 ? ['Empty file'] : [],
    }));
}
