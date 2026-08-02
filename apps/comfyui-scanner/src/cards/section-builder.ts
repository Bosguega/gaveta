/**
 * SectionBuilder - groups Cards into Sections by type.
 */
import type { Card } from './card';
import type { Section } from './section';

const SECTION_TITLES: Record<string, string> = {
    'diffusion': 'Diffusion Models',
    'lora': 'LoRAs',
    'vae': 'VAEs',
    'text-encoder': 'Text Encoders',
    'custom-node': 'Custom Nodes',
    'workflow': 'Workflows',
    'generic': 'Other',
};

export function buildSections(cards: Card[]): Section[] {
    const sectionMap = new Map<string, Card[]>();
    for (const card of cards) {
        if (!sectionMap.has(card.type)) {
            sectionMap.set(card.type, []);
        }
        sectionMap.get(card.type)!.push(card);
    }
    return Array.from(sectionMap.entries()).map(([type, sectionCards], index) => ({
        id: `section-${index}`,
        title: SECTION_TITLES[type] || sectionCards[0]?.subtitle || type,
        cards: sectionCards.sort((a, b) => (a.sortKey || '').localeCompare(b.sortKey || '')),
    }));
}
