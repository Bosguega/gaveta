import { SupabaseError } from './errors'

export async function withTimeout<T>(
    promise: Promise<T>,
    ms: number
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined

    try {
        return await Promise.race([
            promise,
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new SupabaseError('TIMEOUT', `Operacao excedeu o limite de ${ms}ms`)),
                    ms
                )
            }),
        ])
    } finally {
        if (timer) clearTimeout(timer)
    }
}
