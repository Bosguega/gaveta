import { describe, expect, it } from 'vitest';
import { filterImageCategories } from './inventory';

describe('filterImageCategories', () => {
    it('removes image categories and recalculates the summary', () => {
        const result = filterImageCategories({
            comfyuiPath: 'C:/ComfyUI', scanDate: '2026-08-02', summary: { LoRAs: 1, 'Output Images': 1 },
            items: [
                { id: '1', name: 'model', path: 'a', category: 'LoRAs', sizeMb: 1, fileType: 'safetensors' },
                { id: '2', name: 'image', path: 'b', category: 'Output Images', sizeMb: 1, fileType: 'png' },
            ],
        });
        expect(result.items).toHaveLength(1);
        expect(result.summary).toEqual({ LoRAs: 1 });
    });
});
