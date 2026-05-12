import { describe, expect, it } from 'vitest'
import { extractJsonFromResponse } from './extractJson'

describe('extractJsonFromResponse', () => {
    it('parses direct JSON', () => {
        expect(extractJsonFromResponse('[{"key":"x"}]')).toEqual([{ key: 'x' }])
    })

    it('parses JSON from markdown fences', () => {
        expect(extractJsonFromResponse('```json\n{"ok":true}\n```')).toEqual({ ok: true })
    })

    it('extracts embedded JSON', () => {
        expect(extractJsonFromResponse('Resposta: [{"ok":true}] fim')).toEqual([{ ok: true }])
    })

    it('returns null for invalid JSON', () => {
        expect(extractJsonFromResponse('not json')).toBeNull()
    })
})
