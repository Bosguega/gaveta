import { describe, expect, it } from 'vitest';
import { renderCsv } from './csv-renderer';
import { htmlRenderer } from './html-renderer';
import type { Inventory } from '@/inventory/inventory';

describe('export renderers', () => {
    it('escapes spreadsheet formulas and quotes in CSV', () => {
        const inventory: Inventory = {
            comfyuiPath: 'C:/ComfyUI', scanDate: '2026-08-02', summary: { LoRAs: 1 },
            items: [{ id: '1', name: '=HYPERLINK("https://bad")', path: 'C:/a"b', category: 'LoRAs', sizeMb: 1, fileType: 'safetensors' }],
        };
        expect(renderCsv(inventory)).toContain('"\'=HYPERLINK(""https://bad"")"');
        expect(renderCsv(inventory)).toContain('"C:/a""b"');
    });

    it('escapes file-derived content in HTML', () => {
        const html = htmlRenderer.render([{ id: '1', title: '<script>', cards: [{
            id: '1', type: 'generic', title: '<img src=x>', icon: 'generic',
            badges: [{ label: '<b>bad</b>' }], fields: [{ label: 'Path', value: 'a&b' }],
        }] }]);
        expect(html).toContain('&lt;img src=x&gt;');
        expect(html).not.toContain('<img src=x>');
        expect(html).toContain('a&amp;b');
    });
});
