// tests/unit/formatUtils.spec.ts
/**
 * Tests for timestamp formatting and CSV cell handling
 *
 * These tests verify that:
 * 1. BigInt nanoseconds are converted to correct ISO strings
 * 2. BigInt values are output as integers in CSV (no decimals)
 * 3. Float64 numbers produce decimals (documenting the old bug)
 */
import { describe, it, expect } from 'vitest'
import { formatTime } from '@/utils/formatUtils'
import { safeCsvCell } from '@/utils/SrParquetUtils'

describe('formatTime', () => {
  it('should convert BigInt nanoseconds to correct ISO string', () => {
    // 1666418048650338944 nanoseconds = 1666418048650 milliseconds
    // Verify against JavaScript's native Date conversion
    const nanoseconds = BigInt('1666418048650338944')
    const expectedMs = Number(nanoseconds / BigInt(1_000_000))
    const expected = new Date(expectedMs).toISOString()

    const result = formatTime(nanoseconds)
    expect(result).toBe(expected)
    expect(result).toMatch(/^2022-10-22T\d{2}:\d{2}:08\.650Z$/)
  })

  it('should convert number milliseconds to correct ISO string (legacy)', () => {
    // Legacy path: number is assumed to be milliseconds
    const milliseconds = 1666418048650
    const expected = new Date(milliseconds).toISOString()

    const result = formatTime(milliseconds)
    expect(result).toBe(expected)
    expect(result).toMatch(/^2022-10-22T/)
  })

  it('should handle BigInt at Unix epoch', () => {
    const epochNs = BigInt(0)
    const result = formatTime(epochNs)
    expect(result).toBe('1970-01-01T00:00:00.000Z')
  })

  it('should handle BigInt for recent ICESat-2 data (2024)', () => {
    // Example: Jan 15, 2024 12:00:00 UTC
    // = 1705320000000 ms = 1705320000000000000 ns
    const nanoseconds = BigInt('1705320000000000000')
    const result = formatTime(nanoseconds)
    expect(result).toBe('2024-01-15T12:00:00.000Z')
  })
})

describe('safeCsvCell timestamp handling', () => {
  it('should output BigInt as integer string without decimals', () => {
    // This is the fix: epoch_ns() returns BIGINT which becomes bigint in JS
    const nanoseconds = BigInt('1666418048650338944')
    const result = safeCsvCell(nanoseconds)
    // Should be quoted integer, NO decimal point
    expect(result).toBe('"1666418048650338944"')
    expect(result).not.toContain('.')
  })

  it('should output float64 number WITH decimals (documents old bug)', () => {
    // This documents the old behavior when DuckDB cast timestamps to float64
    // The decimal came from precision loss in float64 representation
    const floatValue = 1666418048650.3389
    const result = safeCsvCell(floatValue)
    // Float produces decimal - this was the bug
    expect(result).toContain('.')
  })

  it('should output integer number without decimals', () => {
    // Integer numbers should not have decimals
    const intValue = 1666418048650
    const result = safeCsvCell(intValue)
    expect(result).toBe('1666418048650')
    expect(result).not.toContain('.')
  })

  it('should handle very large BigInt values', () => {
    // Test with max safe integer exceeded (common for nanoseconds)
    const largeNs = BigInt('9007199254740993000000000') // > Number.MAX_SAFE_INTEGER
    const result = safeCsvCell(largeNs)
    expect(result).toBe('"9007199254740993000000000"')
    expect(result).not.toContain('.')
  })
})
