/** Shared helpers used by the card builders. */
import type { Badge, Field } from '../card';
import type { InventoryEnrichedItem } from '@/enrichment/inventory-enricher';

export function sizeBadge(item: InventoryEnrichedItem): Badge { return { label: item.formattedSize, color: 'gray' }; }
export function precisionBadge(item: InventoryEnrichedItem): Badge | null { return item.metadata.precision ? { label: item.metadata.precision, color: 'blue' } : null; }
export function quantizationBadge(item: InventoryEnrichedItem): Badge | null { return item.metadata.quantization ? { label: item.metadata.quantization, color: 'purple' } : null; }
export function scaledBadge(item: InventoryEnrichedItem): Badge | null { return item.metadata.scaled ? { label: 'Scaled', color: 'green' } : null; }
export function variantBadge(item: InventoryEnrichedItem): Badge | null { return item.metadata.variant ? { label: item.metadata.variant, color: 'orange' } : null; }
export function collectBadges(...badges: (Badge | null)[]): Badge[] { return badges.filter((badge): badge is Badge => badge !== null); }
export function fileField(item: InventoryEnrichedItem): Field { return { label: 'File', value: item.name }; }
export function pathField(item: InventoryEnrichedItem): Field { return { label: 'Path', value: item.path }; }
export function modelField(item: InventoryEnrichedItem): Field | null { return item.metadata.baseModel ? { label: 'Model', value: item.metadata.baseModel } : null; }
export function variantField(item: InventoryEnrichedItem): Field | null { return item.metadata.variant ? { label: 'Variant', value: item.metadata.variant } : null; }
export function precisionField(item: InventoryEnrichedItem): Field | null { return item.metadata.precision ? { label: 'Precision', value: item.metadata.precision } : null; }
export function quantizationField(item: InventoryEnrichedItem): Field | null { return item.metadata.quantization ? { label: 'Quantization', value: item.metadata.quantization } : null; }
export function collectFields(...fields: (Field | null)[]): Field[] { return fields.filter((field): field is Field => field !== null); }
export function buildWarning(item: InventoryEnrichedItem): string | undefined { return item.warnings.length ? item.warnings.join('; ') : undefined; }
