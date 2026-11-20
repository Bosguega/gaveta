import assert from 'node:assert/strict';
import test from 'node:test';

import { splitSearchSnippet } from '../src/utils/searchSnippet.ts';

const START = '\uE000';
const END = '\uE001';

test('preserves plain snippets without highlight markers', () => {
    assert.deepEqual(splitSearchSnippet('Texto comum da página'), [
        { text: 'Texto comum da página', highlighted: false },
    ]);
});

test('separates highlighted terms from surrounding text', () => {
    assert.deepEqual(splitSearchSnippet(`antes ${START}termo encontrado${END} depois`), [
        { text: 'antes ', highlighted: false },
        { text: 'termo encontrado', highlighted: true },
        { text: ' depois', highlighted: false },
    ]);
});

test('keeps HTML from indexed documents as plain text segments', () => {
    const payload = '<img src=x onerror=alert(1)><script>alert(1)</script>';
    assert.deepEqual(splitSearchSnippet(`${payload} ${START}termo${END}`), [
        { text: payload + ' ', highlighted: false },
        { text: 'termo', highlighted: true },
    ]);
});

test('does not fail on unmatched delimiters', () => {
    assert.deepEqual(splitSearchSnippet(`antes ${END}depois ${START}fim`), [
        { text: 'antes ', highlighted: false },
        { text: 'depois ', highlighted: false },
        { text: 'fim', highlighted: true },
    ]);
});
