import { SupabaseError } from './errors'

/**
 * Adiciona um limite de tempo a uma Promise.
 * Lança SupabaseError se a operação exceder o tempo limite.
 *
 * @example
 * const data = await withTimeout(
 *   client.from('users').select('*'),
 *   5000
 * )
 */
export async function withTimeout<T>(
    promise: Promise<T>,
    ms: number
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined

    const result = await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
            timer = setTimeout(
                () => reject(new SupabaseError('TIMEOUT', `Operação excedeu o limite de ${ms}ms`)),
                ms
            )
        }),
    ])

    clearTimeout(timer!)
    return result
}