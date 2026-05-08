/**
 * Tests for currency utilities
 */

import { describe, it, expect } from 'vitest';
import { parseBRL, formatBRL, calc } from '../utils/currency';

describe('currency utils', () => {
  describe('parseBRL', () => {
    it('should parse BRL string to number', () => {
      expect(parseBRL('10,50')).toBe(10.5);
      expect(parseBRL('100,00')).toBe(100);
      expect(parseBRL('1.000,50')).toBe(1000.5);
    });

    it('should parse number to number', () => {
      expect(parseBRL(10.5)).toBe(10.5);
      expect(parseBRL(100)).toBe(100);
    });

    it('should handle empty or invalid values', () => {
      expect(parseBRL('')).toBe(0);
      expect(parseBRL(null)).toBe(0);
      expect(parseBRL(undefined)).toBe(0);
      expect(parseBRL('invalid')).toBe(0);
    });
  });

  describe('formatBRL', () => {
    it('should format number to BRL string', () => {
      expect(formatBRL(10.5)).toBe('10,50');
      expect(formatBRL(100)).toBe('100,00');
      expect(formatBRL(1000.5)).toBe('1.000,50');
    });

    it('should handle string input', () => {
      expect(formatBRL('10.5')).toBe('10,50');
      expect(formatBRL('100')).toBe('100,00');
    });

    it('should handle zero and negative values', () => {
      expect(formatBRL(0)).toBe('0,00');
      expect(formatBRL(-10.5)).toBe('-10,50');
    });
  });

  describe('calc', () => {
    it('should multiply correctly', () => {
      expect(calc.mul(10.5, 2)).toBe(21);
      expect(calc.mul(5, 3.5)).toBe(17.5);
    });

    it('should add correctly', () => {
      expect(calc.add(10, 5)).toBe(15);
      expect(calc.add(10.5, 5.5)).toBe(16);
    });

    it('should subtract correctly', () => {
      expect(calc.sub(10, 5)).toBe(5);
      expect(calc.sub(10.5, 3.5)).toBe(7);
    });
  });
});
