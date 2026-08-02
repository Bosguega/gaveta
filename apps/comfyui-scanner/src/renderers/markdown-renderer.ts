/**
 * MarkdownRenderer - GitHub/Obsidian compatible.
 * Implements Renderer<string>.
 */
import type { Section } from '@/cards/section';
import type { Renderer } from './renderer';

export const markdownRenderer: Renderer<string> = {
    render(sections: Section[]): string {
        let md = '# ComfyUI Scanner - Relatorio de Scan\n\n';

        let totalItems = 0;
        for (const section of sections) {
            totalItems += section.cards.length;
        }
        md += `**Total de itens:** ${totalItems}\n\n---\n\n`;

        for (const section of sections) {
            md += `## ${section.title} (${section.cards.length})\n\n`;
            for (const card of section.cards) {
                md += `### ${card.title}\n\n`;
                if (card.subtitle) {
                    md += `*${card.subtitle}*\n\n`;
                }
                if (card.badges.length > 0) {
                    md += card.badges.map(b => '`' + b.label + '`').join(' ') + '\n\n';
                }
                if (card.fields.length > 0) {
                    md += '| Field | Value |\n|-------|-------|\n';
                    for (const field of card.fields) {
                        md += `| ${field.label} | ${field.value} |\n`;
                    }
                    md += '\n';
                }
                if (card.warning) {
                    md += `> **Warning:** ${card.warning}\n\n`;
                }
            }
        }
        return md;
    },
};
