import type { Card } from '../card';
import type { InventoryEnrichedItem } from '@/enrichment/inventory-enricher';
import { collectBadges, collectFields, sizeBadge, precisionBadge, modelField, precisionField, fileField, pathField, buildWarning } from './builder-helpers';

export function build(item: InventoryEnrichedItem): Card {
  const typeField = { label: 'Type', value: item.fileType };
  return { id: item.id, type: 'generic', title: item.friendlyName, subtitle: item.category, icon: 'generic', badges: collectBadges(precisionBadge(item), sizeBadge(item)), fields: collectFields(modelField(item), precisionField(item), typeField, fileField(item), pathField(item)), warning: buildWarning(item), sortKey: item.name };
}
