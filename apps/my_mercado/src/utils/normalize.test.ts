/**
 * Tests for normalize utilities
 */

import { describe, it, expect } from 'vitest';
import { normalizeKey } from '../utils/normalize';

describe('normalize utils', () => {
  describe('normalizeKey', () => {
    it('should normalize product names to uppercase with spaces', () => {
      expect(normalizeKey('Coca Cola 2L')).toBe('COCA COLA 2L');
      expect(normalizeKey('ARROZ BRANCO 5KG')).toBe('ARROZ BRANCO 5KG');
      expect(normalizeKey('Leite Piracanjuba Integral')).toBe('LEITE PIRACANJUBA INTEGRAL');
    });

    it('should remove special characters', () => {
      expect(normalizeKey('Coca-Cola® 2L')).toBe('COCA COLA 2L');
      expect(normalizeKey('Pão de Leite (10un)')).toBe('PAO DE LEITE 10UN');
      expect(normalizeKey('Água s/ Gás 500ml')).toBe('AGUA S GAS 500ML');
    });

    it('should handle multiple spaces', () => {
      expect(normalizeKey('Arroz   Branco')).toBe('ARROZ BRANCO');
      expect(normalizeKey('  Leite  Integral  ')).toBe('LEITE INTEGRAL');
    });

    it('should handle empty or invalid values', () => {
      expect(normalizeKey('')).toBe('');
      expect(normalizeKey('   ')).toBe('');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(normalizeKey(null as any)).toBe('');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(normalizeKey(undefined as any)).toBe('');
    });

    it('should preserve numbers', () => {
      expect(normalizeKey('Cerveja 350ml')).toBe('CERVEJA 350ML');
      expect(normalizeKey('Sabão 1kg')).toBe('SABAO 1KG');
      expect(normalizeKey('Produto 123')).toBe('PRODUTO 123');
    });

    it('should replace special separators with spaces', () => {
      expect(normalizeKey('Coca-Cola')).toBe('COCA COLA');
      expect(normalizeKey('Arroz/Feijão')).toBe('ARROZ FEIJAO');
      expect(normalizeKey('Sabão_em_Pó')).toBe('SABAO EM PO');
    });
  });
});
