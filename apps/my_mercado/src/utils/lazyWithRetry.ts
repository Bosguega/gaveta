import { lazy } from 'react'
import type { ComponentType } from 'react'

const LAZY_RELOAD_KEY = '@MyMercado:lazy-reload-once'

/**
 * Wrapper para `React.lazy` que faz reload único da página
 * caso o chunk lazy falhe ao carregar (comum após deploy
 * com novos hashes de assets). Evita tela branca em produção.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends { default: ComponentType<any> }>(
    importer: () => Promise<T>,
) {
    return lazy(async () => {
        try {
            const module = await importer()
            try {
                sessionStorage.removeItem(LAZY_RELOAD_KEY)
            } catch {
                /* noop */
            }
            return module
        } catch (error) {
            try {
                const alreadyReloaded = sessionStorage.getItem(LAZY_RELOAD_KEY) === '1'
                if (!alreadyReloaded) {
                    sessionStorage.setItem(LAZY_RELOAD_KEY, '1')
                    window.location.reload()
                }
            } catch {
                /* noop */
            }
            throw error
        }
    })
}
