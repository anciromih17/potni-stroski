import { describe, it, expect } from 'vitest';
import { normalizePdfText } from './helpers';

describe('normalizePdfText', () => {
    it('returns empty string for null/undefined', () => {
        expect(normalizePdfText(null)).toBe('');
        expect(normalizePdfText(undefined)).toBe('');
    });

    it('converts value to string and trims whitespace', () => {
        expect(normalizePdfText(123)).toBe('123');
        expect(normalizePdfText('  test  ')).toBe('test');
    });

    it('replaces non-breaking spaces with normal spaces', () => {
        const input = 'A\u00A0B';
        expect(normalizePdfText(input)).toBe('A B');
    });

    it('normalizes multiple spaces and tabs to a single space', () => {
        const input = 'A   \t   B';
        expect(normalizePdfText(input)).toBe('A B');
    });

    it('normalizes various dash characters to "-"', () => {
        const input = 'A – B — C –– D';
        const out = normalizePdfText(input);
        expect(out.includes('A - B')).toBe(true);
    });

    it('normalizes Windows newlines to \\n and trims', () => {
        const input = 'line1\r\nline2\r\n';
        expect(normalizePdfText(input)).toBe('line1\nline2');
    });
});
