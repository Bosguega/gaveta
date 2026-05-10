/**
 * SHA-256 Hash Utility
 *
 * Gera hash SHA-256 de um texto usando a Web Crypto API.
 * Funciona em browsers e ambientes que implementam crypto.subtle.
 */

export async function sha256(text: string): Promise<string> {
    const data = new TextEncoder().encode(text.trim());
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}