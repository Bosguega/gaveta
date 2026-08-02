/**
 * Renderer - base interface for all section-based renderers.
 * JSON and CSV do NOT implement this - they work directly with Inventory.
 */
import type { Section } from '@/cards/section';

export interface Renderer<T> {
    render(sections: Section[]): T;
}
