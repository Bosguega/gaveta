import { describe, expect, it } from 'vitest'
import { getAuthenticatedContext, requireSession, requireUser } from './auth'

describe('auth helpers', () => {
    it('requires a user and preserves auth errors', async () => {
        const client = {
            auth: {
                getUser: async () => ({
                    data: { user: null },
                    error: new Error('invalid jwt'),
                }),
            },
        }

        await expect(requireUser(client as never)).rejects.toMatchObject({
            code: 'AUTH_UNKNOWN',
        })
    })

    it('returns authenticated context', async () => {
        const user = { id: 'user-1' }
        const client = {
            auth: {
                getUser: async () => ({ data: { user }, error: null }),
            },
        }

        await expect(getAuthenticatedContext(client as never)).resolves.toEqual({
            client,
            user,
        })
    })

    it('requires a session', async () => {
        const session = { access_token: 'token' }
        const client = {
            auth: {
                getSession: async () => ({ data: { session }, error: null }),
            },
        }

        await expect(requireSession(client as never)).resolves.toBe(session)
    })
})
