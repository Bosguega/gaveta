import type { Card } from '../card';
import type { InventoryEnrichedItem } from '@/enrichment/inventory-enricher';
import { collectBadges, collectFields, sizeBadge, precisionBadge, fileField, pathField, buildWarning, modelField, precisionField } from './builder-helpers';

export function build(item: InventoryEnrichedItem): Card {
  return { id: item.id, type: 'vae', title: item.friendlyName, subtitle: 'VAE', icon: 'vae', badges: collectBadges(precisionBadge(item), sizeBadge(item)), fields: collectFields(modelField(item), precisionField(item), fileField(item), pathField(item)), warning: buildWarning(item), sortKey: item.metadata.baseModel || item.name };
}
