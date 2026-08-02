/**
 * TxtRenderer - simple text format, no complex Unicode.
 * Implements Renderer<string>.
 */
import type { Section } from '@/cards/section';
import type { Renderer } from './renderer';

export const txtRenderer: Renderer<string> = {
    render(sections: Section[]): string {
        let txt = 'ComfyUI Scanner - Relatorio de Scan\n';
        txt += '================================\n\n';

        let totalItems = 0;
        for (const section of sections) {
            totalItems += section.cards.length;
        }
        txt += `Total de itens: ${totalItems}\n\n`;

        for (const section of sections) {
            txt += `=== ${section.title.toUpperCase()} (${section.cards.length}) ===\n\n`;
            for (const card of section.cards) {
                txt += `[${card.subtitle || card.type}] ${card.title}\n`;
                for (const badge of card.badges) {
                    txt += `  * ${badge.label}\n`;
                }
                for (const field of card.fields) {
                    txt += `  ${field.label}: ${field.value}\n`;
                }
                if (card.warning) {
                    txt += `  WARNING: ${card.warning}\n`;
                }
                txt += '\n';
            }
        }
        return txt;
    },
};
