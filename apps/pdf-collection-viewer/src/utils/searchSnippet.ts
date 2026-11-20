const HIGHLIGHT_START = '\uE000';
const HIGHLIGHT_END = '\uE001';

export interface SearchSnippetSegment {
    text: string;
    highlighted: boolean;
}

/**
 * Splits SQLite FTS snippets into plain-text and highlighted segments.
 *
 * The delimiters are private-use Unicode characters, not HTML tags. Document
 * content is therefore always rendered by React as text rather than parsed as
 * markup.
 */
export function splitSearchSnippet(snippet: string): SearchSnippetSegment[] {
    const segments: SearchSnippetSegment[] = [];
    let highlighted = false;

    for (const part of snippet.split(/(\uE000|\uE001)/g)) {
        if (part === HIGHLIGHT_START) {
            highlighted = true;
        } else if (part === HIGHLIGHT_END) {
            highlighted = false;
        } else if (part) {
            segments.push({ text: part, highlighted });
        }
    }

    return segments;
}
