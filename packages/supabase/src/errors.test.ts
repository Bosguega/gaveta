import { describe, expect, it } from 'vitest'
import {
    SupabaseError,
    getSupabaseErrorInfo,
    isRetryableError,
    mapSupabaseError,
} from './errors'

describe('supabase errors', () => {
    it('extracts postgres/postgrest error fields', () => {
        const info = getSupabaseErrorInfo({
            code: '23505',
            message: 'duplicate key',
            details: 'Key already exists',
        })

        expect(info).toEqual({
            code: '23505',
            message: 'duplicate key',
            details: 'Key already exists',
            hint: undefined,
            status: undefined,
        })
    })

    it('extracts status from function error context', () => {
        const info = getSupabaseErrorInfo({
            name: 'FunctionsHttpError',
            message: 'Edge Function returned a non-2xx status code',
            context: { status: 503 },
        })

        expect(info.status).toBe(503)
        expect(info.code).toBe('FunctionsHttpError')
    })

    it('marks only recoverable errors as retryable by default', () => {
        expect(isRetryableError({ status: 500, message: 'server error' })).toBe(true)
        expect(isRetryableError({ status: 429, message: 'rate limit' })).toBe(true)
        expect(isRetryableError({ code: '23505', message: 'duplicate' })).toBe(false)
    })

    it('maps unknown errors to SupabaseError while preserving status', () => {
        const mapped = mapSupabaseError({ code: 'PGRST116', message: 'not found', status: 406 })

        expect(mapped).toBeInstanceOf(SupabaseError)
        expect(mapped.code).toBe('PGRST116')
        expect(mapped.statusCode).toBe(406)
    })
})
