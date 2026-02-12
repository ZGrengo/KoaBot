import { describe, it, expect } from 'vitest';
import { parseItemLine } from './item-parser';

describe('parseItemLine', () => {
    describe('Semicolon-separated format (original)', () => {
        it('should parse standard format: REF; nombre; cantidad; unidad', () => {
            const result = parseItemLine('ABC123; Tomate; 10; kg');
            expect(result).toEqual({
                ref: 'ABC123',
                product: 'Tomate',
                quantity: 10,
                unit: 'kg',
            });
        });

        it('should parse without REF (uses UNKNOWN)', () => {
            const result = parseItemLine('; Tomate; 10; kg');
            expect(result).toEqual({
                ref: 'UNKNOWN',
                product: 'Tomate',
                quantity: 10,
                unit: 'kg',
            });
        });

        it('should parse with reason: REF; nombre; cantidad; unidad; motivo', () => {
            const result = parseItemLine('POLLO001; Pechuga; 0.25; kg; caducado');
            expect(result).toEqual({
                ref: 'POLLO001',
                product: 'Pechuga',
                quantity: 0.25,
                unit: 'kg',
                reason: 'caducado',
            });
        });
    });

    describe('Natural language format', () => {
        it('should parse "product quantity unit" format', () => {
            const result = parseItemLine('Pechuga de pollo 0.25 kg');
            expect(result).toEqual({
                ref: 'UNKNOWN',
                product: 'Pechuga de pollo',
                quantity: 0.25,
                unit: 'kg',
            });
        });

        it('should parse "quantity unit product" format', () => {
            const result = parseItemLine('0,25 kg Pechuga de pollo');
            expect(result).toEqual({
                ref: 'UNKNOWN',
                product: 'Pechuga de pollo',
                quantity: 0.25,
                unit: 'kg',
            });
        });

        it('should parse with REF at start: "REF product quantity unit"', () => {
            const result = parseItemLine('PAN010 Pan burger 12 ud');
            expect(result).toEqual({
                ref: 'PAN010',
                product: 'Pan burger',
                quantity: 12,
                unit: 'ud',
            });
        });

        it('should parse with reason at end: "product quantity unit reason"', () => {
            const result = parseItemLine('Pan burger 12 ud quemado');
            expect(result.ref).toBe('UNKNOWN');
            expect(result.product).toBe('Pan burger');
            expect(result.quantity).toBe(12);
            expect(result.unit).toBe('ud');
            expect(result.reason).toBe('quemado');
        });
    });

    describe('Alternative separators', () => {
        it('should accept pipe separator', () => {
            const result = parseItemLine('ABC123 | Tomate | 10 | kg');
            expect(result.product).toBe('Tomate');
            expect(result.quantity).toBe(10);
            expect(result.unit).toBe('kg');
        });

        it('should accept comma separator', () => {
            const result = parseItemLine('ABC123, Tomate, 10, kg');
            expect(result.product).toBe('Tomate');
            expect(result.quantity).toBe(10);
            expect(result.unit).toBe('kg');
        });
    });

    describe('Unit variations', () => {
        it('should accept "unidad" and "unidades"', () => {
            const result1 = parseItemLine('Tomate 5 unidad');
            expect(result1.unit).toBe('ud');

            const result2 = parseItemLine('Tomate 5 unidades');
            expect(result2.unit).toBe('ud');
        });

        it('should accept "kilo" and "kilos"', () => {
            const result1 = parseItemLine('Tomate 5 kilo');
            expect(result1.unit).toBe('kg');

            const result2 = parseItemLine('Tomate 5 kilos');
            expect(result2.unit).toBe('kg');
        });

        it('should accept "litro", "litros", "l", "lt"', () => {
            expect(parseItemLine('Aceite 2 litro').unit).toBe('L');
            expect(parseItemLine('Aceite 2 litros').unit).toBe('L');
            expect(parseItemLine('Aceite 2 l').unit).toBe('L');
            expect(parseItemLine('Aceite 2 lt').unit).toBe('L');
        });
    });

    describe('Decimal handling', () => {
        it('should accept comma as decimal separator', () => {
            const result = parseItemLine('Tomate 2,5 kg');
            expect(result.quantity).toBe(2.5);
        });

        it('should accept dot as decimal separator', () => {
            const result = parseItemLine('Tomate 2.5 kg');
            expect(result.quantity).toBe(2.5);
        });
    });

    describe('Error cases', () => {
        it('should throw on empty line', () => {
            expect(() => parseItemLine('')).toThrow();
        });

        it('should throw on invalid format', () => {
            expect(() => parseItemLine('invalid format')).toThrow();
        });

        it('should throw on missing product', () => {
            expect(() => parseItemLine('10 kg')).toThrow('producto');
        });

        it('should throw on invalid quantity', () => {
            expect(() => parseItemLine('Tomate abc kg')).toThrow('Cantidad');
        });

        it('should throw on invalid unit', () => {
            expect(() => parseItemLine('Tomate 10 invalid')).toThrow('Unidad');
        });
    });
});

