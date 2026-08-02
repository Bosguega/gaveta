import type { Card } from '../card';
import type { InventoryEnrichedItem } from '@/enrichment/inventory-enricher';
import { collectBadges, collectFields, sizeBadge, fileField, pathField, buildWarning } from './builder-helpers';

export function build(item: InventoryEnrichedItem): Card {
  const loraTypeBadge = item.metadata.loraType ? { label: item.metadata.loraType, color: 'teal' } : null;
  const loraTypeField = item.metadata.loraType ? { label: 'Type', value: item.metadata.loraType } : null;
  const modelField = item.metadata.baseModel ? { label: 'Model', value: item.metadata.baseModel } : null;
  return { id: item.id, type: 'lora', title: item.friendlyName, subtitle: 'LoRA', icon: 'lora', badges: collectBadges(loraTypeBadge, sizeBadge(item)), fields: collectFields(modelField, loraTypeField, fileField(item), pathField(item)), warning: buildWarning(item), sortKey: item.metadata.baseModel || item.name };
}
