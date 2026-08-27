/// Um ponto do stream de stitches.
export interface Stitch {
    x: number;
    y: number;
    /** Nome canônico: STITCH | JUMP | TRIM | COLOR_CHANGE | STOP | END. */
    type: string;
}

/// Metadados de uma thread no formato Brother PEC.
export interface Thread {
    index: number;
    rgb: [number, number, number];
    description: string;
}

/// Resultado do parsing do pyembroidery (JSON serializado pelo Rust via serde).
export interface PatternParse {
    version: string;
    paletteIndex: number[];
    threads: Thread[];
    stitches: Stitch[];
    bounds: {
        min_x: number;
        min_y: number;
        max_x: number;
        max_y: number;
    };
    designWidthMm: number;
    designHeightMm: number;
    pageCount: number | null;
    thumbnail: string | null;
    plainStitchCount?: number;
    jumpCount?: number;
}

/// Resultado da comparação entre o parser Rust e o pyembroidery.
export interface CompareResult {
    file: string;
    rust: PatternParse | null;
    pyembroidery: PatternParse | null;
    match: 'match' | 'stitch_mismatch' | 'bounds_mismatch' | 'colors_mismatch' | 'error';
    error?: string;
}

