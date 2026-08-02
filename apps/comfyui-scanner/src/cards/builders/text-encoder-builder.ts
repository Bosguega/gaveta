import type { Card } from '../card';
import type { InventoryEnrichedItem } from '@/enrichment/inventory-enricher';
import { collectBadges, collectFields, sizeBadge, precisionBadge, quantizationBadge, modelField, precisionField, quantizationField, fileField, pathField, buildWarning } from './builder-helpers';

export function build(item: InventoryEnrichedItem): Card {
  return { id: item.id, type: 'text-encoder', title: item.friendlyName, subtitle: 'Text Encoder', icon: 'text-encoder', badges: collectBadges(precisionBadge(item), quantizationBadge(item), sizeBadge(item)), fields: collectFields(modelField(item), precisionField(item), quantizationField(item), fileField(item), pathField(item)), warning: buildWarning(item), sortKey: item.metadata.baseModel || item.name };
}
