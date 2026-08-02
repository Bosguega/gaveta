/**
 * Card — presentation model. Contains only display-related information.
 * Renderers receive Cards and never touch InventoryItem.
 * The `icon` field is a string identifier, NEVER an emoji.
 * Each renderer decides how to represent it (SVG, emoji, text).
 */

export interface Badge {
    label: string;
    color?: string;
}

export interface Field {
    label: string;
    value: string;
}

export interface Card {
    id: string;
    type: string;
    title: string;
    subtitle?: string;
    description?: string;
    icon: string;
    badges: Badge[];
    fields: Field[];
    warning?: string;
    footer?: string;
    sortKey?: string;
}
