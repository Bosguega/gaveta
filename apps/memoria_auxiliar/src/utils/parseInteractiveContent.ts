import type { InteractiveSegment } from '../types';

/**
 * Regex para detectar URLs web (http/https).
 * Evita capturar pontuação final como ponto, parêntese de fechamento, etc.
 * Usa [^\s)]+ para não incluir espaços ou ) no final da URL.
 */
const URL_REGEX = /https?:\/\/[^\s)]+/g;

/**
 * Regex para detectar caminhos Windows absolutos.
 * Exemplos:
 *   C:\Users\Marcos\...
 *   D:\Arquivos\pasta
 *   C:\Program Files\app.exe
 *
 * Não captura caracteres inválidos em paths Windows: < > " | ? *
 */
const WINDOWS_PATH_REGEX = /[A-Za-z]:[^\s<>:"|?*\n]+/g;

/**
 * Regex combinado que captura tanto URLs quanto caminhos Windows.
 * Usa alternância (|) para tentar um padrão ou outro.
 */
const COMBINED_REGEX = /https?:\/\/[^\s)]+|[A-Za-z]:[^\s<>:"|?*\n]+/g;

/**
 * Determina o tipo de um caminho local baseado na extensão.
 */
function classifyPath(path: string): InteractiveSegment['type'] {
    const lower = path.toLowerCase().trimEnd();

    // Verifica se termina com \  (é uma pasta) ou se é uma raiz de drive
    if (lower.endsWith('\\') || /^[a-z]:\\?$/i.test(lower)) {
        return 'path';
    }

    // Verifica extensões de executável
    if (/\.(exe|bat|cmd|com|msi)$/i.test(lower)) {
        return 'path';
    }

    return 'path';
}

/**
 * Extrai o nome amigável do caminho para exibição no modal de confirmação.
 * Exemplo: "C:\Users\...\Code.exe" → "Code.exe"
 */
export function extractFileName(filePath: string): string {
    // Lida com separadores Windows e Unix
    const normalized = filePath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    const last = parts[parts.length - 1];
    return last || filePath;
}

/**
 * Verifica se um path parece ser um executável (.exe, .bat, .cmd, .com, .msi)
 */
export function isExecutablePath(filePath: string): boolean {
    return /\.(exe|bat|cmd|com|msi)$/i.test(filePath.trim());
}

/**
 * Verifica se um path parece ser uma pasta.
 * Heurística: termina com separador ou não tem extensão de arquivo.
 */
export function isDirectoryPath(filePath: string): boolean {
    const trimmed = filePath.trim();
    if (trimmed.endsWith('\\') || trimmed.endsWith('/')) return true;
    // Sem extensão e não é executável → provavelmente pasta
    const lastSegment = trimmed.replace(/\\/g, '/').split('/').pop() || '';
    return !lastSegment.includes('.');
}

/**
 * Parsea um texto e retorna segmentos interativos.
 *
 * Exemplo:
 *   "VSCode: C:\path\to\Code.exe"
 *   →
 *   [
 *     { type: 'text', value: 'VSCode: ' },
 *     { type: 'path', value: 'C:\path\to\Code.exe' }
 *   ]
 *
 * @param text Texto bruto para parsear
 * @returns Array de segmentos para renderização
 */
export function parseInteractiveContent(text: string): InteractiveSegment[] {
    if (!text) return [{ type: 'text', value: '' }];

    const segments: InteractiveSegment[] = [];
    let lastIndex = 0;

    // Encontra todas as ocorrências de URLs e paths
    const matches: Array<{ index: number; value: string; type: InteractiveSegment['type'] }> = [];

    let match: RegExpExecArray | null;
    COMBINED_REGEX.lastIndex = 0;

    while ((match = COMBINED_REGEX.exec(text)) !== null) {
        const value = match[0];
        const index = match.index;

        // Determina o tipo: se começa com http → url, senão → path
        const type: InteractiveSegment['type'] = /^https?:\/\//i.test(value) ? 'url' : classifyPath(value);

        matches.push({ index, value, type });
    }

    // Ordena por índice (já vem em ordem do regex, mas garantimos)
    matches.sort((a, b) => a.index - b.index);

    // Constrói segmentos intercalando texto puro com matches
    for (const m of matches) {
        // Texto antes deste match
        if (m.index > lastIndex) {
            segments.push({
                type: 'text',
                value: text.slice(lastIndex, m.index),
            });
        }

        segments.push({
            type: m.type,
            value: m.value,
        });

        lastIndex = m.index + m.value.length;
    }

    // Texto restante após o último match
    if (lastIndex < text.length) {
        segments.push({
            type: 'text',
            value: text.slice(lastIndex),
        });
    }

    // Se não houve matches, retorna um único segmento de texto
    if (segments.length === 0) {
        segments.push({ type: 'text', value: text });
    }

    return segments;
}