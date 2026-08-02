/**
 * CardFactory - orchestrator that delegates to specialized Builders.
 * Produces Card[], not Sections.
 */
import type { Card } from './card';
import type { InventoryEnrichedItem } from '@/enrichment/inventory-enricher';
import * as DiffusionBuilder from './builders/diffusion-builder';
import * as LoraBuilder from './builders/lora-builder';
import * as VaeBuilder from './builders/vae-builder';
import * as TextEncoderBuilder from './builders/text-encoder-builder';
import * as CustomNodeBuilder from './builders/custom-node-builder';
import * as GenericBuilder from './builders/generic-builder';

export function createCards(items: InventoryEnrichedItem[]): Card[] {
    return items.map(item => {
        switch (item.category) {
            case 'Diffusion Models':
                return DiffusionBuilder.build(item);
            case 'LoRAs':
                return LoraBuilder.build(item);
            case 'VAE':
            case 'VAE Approx':
                return VaeBuilder.build(item);
            case 'Text Encoders':
                return TextEncoderBuilder.build(item);
            case 'Custom Nodes':
                return CustomNodeBuilder.build(item);
            default:
                return GenericBuilder.build(item);
        }
    });
}
