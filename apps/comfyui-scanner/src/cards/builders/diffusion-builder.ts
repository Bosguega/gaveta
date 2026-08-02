import type { Card } from '../card';
import type { InventoryEnrichedItem } from '@/enrichment/inventory-enricher';
import { collectBadges, collectFields, sizeBadge, precisionBadge, quantizationBadge, scaledBadge, variantBadge, modelField, variantField, precisionField, quantizationField, fileField, pathField, buildWarning } from './builder-helpers';

export function build(item: InventoryEnrichedItem): Card {
  return { id: item.id, type: 'diffusion', title: item.friendlyName, subtitle: 'Diffusion Model', icon: 'diffusion', badges: collectBadges(precisionBadge(item), quantizationBadge(item), scaledBadge(item), variantBadge(item), sizeBadge(item)), fields: collectFields(modelField(item), variantField(item), precisionField(item), quantizationField(item), fileField(item), pathField(item)), warning: buildWarning(item), sortKey: item.metadata.baseModel || item.name };
}
