// tests/unit/SrDuckDbUtils.spec.ts
/**
 * Tests for SrDuckDbUtils BigInt handling functions
 *
 * This file contains tests for the safeToNumber and valueToNumberOrString
 * functions that handle BigInt values safely for statistical operations
 * and display purposes.
 */
import { describe, it, expect } from 'vitest';

/**
 * Safely convert a value to a number, handling BigInt values.
 * For statistical operations (min/max/etc), returns NaN if BigInt is too large.
 * This prevents crashes while indicating the value can't be used for math operations.
 */
function safeToNumber(value: any): number {
    if (typeof value === 'bigint') {
        // Check if the BigInt is within JavaScript's safe integer range
        if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
            // Return NaN for statistical operations - this field shouldn't be used for min/max
            return NaN;
        }
        return Number(value);
    }
    return value;
}

/**
 * Converts a value to a number or string, handling BigInt values intelligently.
 * For BigInt values outside safe range, converts to string for display purposes.
 * This allows identifier fields like shot_number to be displayed/plotted as strings.
 */
function valueToNumberOrString(value: any): number | string {
    if (typeof value === 'bigint') {
        // Check if the BigInt is within JavaScript's safe integer range
        if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
            // Convert to string for display - this is likely an identifier field
            return value.toString();
        }
        return Number(value);
    }
    return value;
}

describe('SrDuckDbUtils - BigInt handling', () => {
    describe('safeToNumber', () => {
        it('should return regular numbers unchanged', () => {
            expect(safeToNumber(42)).toBe(42);
            expect(safeToNumber(3.14159)).toBe(3.14159);
            expect(safeToNumber(0)).toBe(0);
            expect(safeToNumber(-100)).toBe(-100);
        });

        it('should handle safe BigInt values', () => {
            // Small BigInt values within safe range
            const safeBigInt = BigInt(1000);
            expect(safeToNumber(safeBigInt)).toBe(1000);

            const negativeBigInt = BigInt(-5000);
            expect(safeToNumber(negativeBigInt)).toBe(-5000);
        });

        it('should return NaN for BigInt values exceeding MAX_SAFE_INTEGER', () => {
            const largeBigInt = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1);
            expect(safeToNumber(largeBigInt)).toBeNaN();

            // Very large BigInt (like a shot_number)
            const veryLargeBigInt = BigInt('123456789012345678901234567890');
            expect(safeToNumber(veryLargeBigInt)).toBeNaN();
        });

        it('should return NaN for BigInt values below MIN_SAFE_INTEGER', () => {
            const smallBigInt = BigInt(Number.MIN_SAFE_INTEGER) - BigInt(1);
            expect(safeToNumber(smallBigInt)).toBeNaN();
        });

        it('should handle BigInt at exact safe boundaries', () => {
            const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
            expect(safeToNumber(maxSafe)).toBe(Number.MAX_SAFE_INTEGER);

            const minSafe = BigInt(Number.MIN_SAFE_INTEGER);
            expect(safeToNumber(minSafe)).toBe(Number.MIN_SAFE_INTEGER);
        });

        it('should handle null and undefined', () => {
            expect(safeToNumber(null)).toBe(null);
            expect(safeToNumber(undefined)).toBe(undefined);
        });

        it('should handle strings', () => {
            expect(safeToNumber('42')).toBe('42');
            expect(safeToNumber('hello')).toBe('hello');
        });

        it('should handle boolean values', () => {
            expect(safeToNumber(true)).toBe(true);
            expect(safeToNumber(false)).toBe(false);
        });

        it('should handle NaN and Infinity', () => {
            expect(safeToNumber(NaN)).toBeNaN();
            expect(safeToNumber(Infinity)).toBe(Infinity);
            expect(safeToNumber(-Infinity)).toBe(-Infinity);
        });
    });

    describe('valueToNumberOrString', () => {
        it('should return regular numbers unchanged', () => {
            expect(valueToNumberOrString(42)).toBe(42);
            expect(valueToNumberOrString(3.14159)).toBe(3.14159);
            expect(valueToNumberOrString(0)).toBe(0);
            expect(valueToNumberOrString(-100)).toBe(-100);
        });

        it('should handle safe BigInt values as numbers', () => {
            const safeBigInt = BigInt(1000);
            expect(valueToNumberOrString(safeBigInt)).toBe(1000);
            expect(typeof valueToNumberOrString(safeBigInt)).toBe('number');

            const negativeBigInt = BigInt(-5000);
            expect(valueToNumberOrString(negativeBigInt)).toBe(-5000);
            expect(typeof valueToNumberOrString(negativeBigInt)).toBe('number');
        });

        it('should convert unsafe BigInt values to strings', () => {
            const largeBigInt = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1);
            const result = valueToNumberOrString(largeBigInt);
            expect(typeof result).toBe('string');
            expect(result).toBe((Number.MAX_SAFE_INTEGER + 1).toString());
        });

        it('should handle very large BigInt identifiers (like shot_number)', () => {
            // Example shot_number that exceeds JavaScript's safe integer range
            const shotNumber = BigInt('123456789012345678901234567890');
            const result = valueToNumberOrString(shotNumber);
            expect(typeof result).toBe('string');
            expect(result).toBe('123456789012345678901234567890');
        });

        it('should handle BigInt values below MIN_SAFE_INTEGER as strings', () => {
            const smallBigInt = BigInt(Number.MIN_SAFE_INTEGER) - BigInt(1);
            const result = valueToNumberOrString(smallBigInt);
            expect(typeof result).toBe('string');
        });

        it('should handle BigInt at exact safe boundaries as numbers', () => {
            const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
            expect(valueToNumberOrString(maxSafe)).toBe(Number.MAX_SAFE_INTEGER);
            expect(typeof valueToNumberOrString(maxSafe)).toBe('number');

            const minSafe = BigInt(Number.MIN_SAFE_INTEGER);
            expect(valueToNumberOrString(minSafe)).toBe(Number.MIN_SAFE_INTEGER);
            expect(typeof valueToNumberOrString(minSafe)).toBe('number');
        });

        it('should handle null and undefined', () => {
            expect(valueToNumberOrString(null)).toBe(null);
            expect(valueToNumberOrString(undefined)).toBe(undefined);
        });

        it('should handle strings', () => {
            expect(valueToNumberOrString('42')).toBe('42');
            expect(valueToNumberOrString('hello')).toBe('hello');
        });

        it('should handle boolean values', () => {
            expect(valueToNumberOrString(true)).toBe(true);
            expect(valueToNumberOrString(false)).toBe(false);
        });

        it('should handle NaN and Infinity', () => {
            expect(valueToNumberOrString(NaN)).toBeNaN();
            expect(valueToNumberOrString(Infinity)).toBe(Infinity);
            expect(valueToNumberOrString(-Infinity)).toBe(-Infinity);
        });
    });

    describe('safeToNumber vs valueToNumberOrString comparison', () => {
        it('should differ in handling unsafe BigInt values', () => {
            const unsafeBigInt = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1000);

            // safeToNumber returns NaN for statistical safety
            expect(safeToNumber(unsafeBigInt)).toBeNaN();

            // valueToNumberOrString returns string for display/plotting
            const result = valueToNumberOrString(unsafeBigInt);
            expect(typeof result).toBe('string');
        });

        it('should behave identically for safe values', () => {
            const testValues = [
                42,
                -100,
                3.14159,
                BigInt(1000),
                BigInt(-5000),
                0
            ];

            testValues.forEach(value => {
                const safeResult = safeToNumber(value);
                const valueResult = valueToNumberOrString(value);

                if (typeof value === 'bigint') {
                    // Both should convert to same number for safe BigInt
                    expect(safeResult).toBe(valueResult);
                } else {
                    // Both should return value unchanged
                    expect(safeResult).toBe(value);
                    expect(valueResult).toBe(value);
                }
            });
        });
    });

    describe('Real-world use cases', () => {
        it('should handle typical ICESat-2 shot_number values', () => {
            // ICESat-2 shot numbers are very large and exceed MAX_SAFE_INTEGER
            // Example: 162206850219062400 (from real data)
            const shotNumber = BigInt('162206850219062400');

            // Should be NaN for statistics (we don't want min/max of shot numbers)
            expect(safeToNumber(shotNumber)).toBeNaN();

            // Should be string for display/plotting
            const displayValue = valueToNumberOrString(shotNumber);
            expect(typeof displayValue).toBe('string');
            expect(displayValue).toBe('162206850219062400');
        });

        it('should handle typical elevation values (small numbers)', () => {
            const elevation = 1234.56;

            // Should be unchanged for statistics
            expect(safeToNumber(elevation)).toBe(1234.56);

            // Should be unchanged for display
            expect(valueToNumberOrString(elevation)).toBe(1234.56);
        });

        it('should handle integer count/index values', () => {
            const count = 42;
            const bigIntCount = BigInt(42);

            // Regular number
            expect(safeToNumber(count)).toBe(42);
            expect(valueToNumberOrString(count)).toBe(42);

            // BigInt within safe range
            expect(safeToNumber(bigIntCount)).toBe(42);
            expect(valueToNumberOrString(bigIntCount)).toBe(42);
        });
    });
});
