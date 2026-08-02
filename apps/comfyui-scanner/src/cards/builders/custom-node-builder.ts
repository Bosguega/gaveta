import type { Card } from '../card';
import type { InventoryEnrichedItem } from '@/enrichment/inventory-enricher';
import { collectBadges, collectFields, sizeBadge, pathField, buildWarning } from './builder-helpers';

export function build(item: InventoryEnrichedItem): Card {
  return { id: item.id, type: 'custom-node', title: item.name, subtitle: 'Custom Node', icon: 'custom-node', badges: collectBadges(sizeBadge(item)), fields: collectFields(pathField(item)), warning: buildWarning(item), sortKey: item.name };
}
