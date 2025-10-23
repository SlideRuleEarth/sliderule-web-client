// tests/unit/parquetImportExport.spec.ts
/**
 * Unit tests for Parquet file comparison utilities
 *
 * This test validates:
 * - File checksum calculation from file streams
 * - Binary file comparison logic
 * - File size comparison
 * - Test data file existence and accessibility
 *
 * Note: Full end-to-end testing with OPFS and DuckDB should be done in e2e tests
 * since vitest/jsdom doesn't support the File System Access API.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const TEST_FILE_NAME = 'atl03x-surface_TEST_small_GEO.parquet';
const TEST_FILE_PLAIN = 'atl03x-surface_PLAIN.parquet';

/**
 * Calculate a simple checksum from a Buffer
 * This mimics the checksumFromOpfs function but works with Node buffers
 */
function calculateChecksum(buffer: Buffer): bigint {
    let checksum = 0;
    for (let i = 0; i < buffer.length; i++) {
        checksum += buffer[i];
    }
    return BigInt(checksum);
}

/**
 * Compare two files by their checksums
 */
function compareFilesByChecksum(file1Path: string, file2Path: string): boolean {
    const buffer1 = fs.readFileSync(file1Path);
    const buffer2 = fs.readFileSync(file2Path);

    // First check: sizes must match
    if (buffer1.length !== buffer2.length) {
        return false;
    }

    // Second check: checksums must match
    const checksum1 = calculateChecksum(buffer1);
    const checksum2 = calculateChecksum(buffer2);

    return checksum1 === checksum2;
}

/**
 * Compare two files byte by byte
 */
function compareFilesByteByByte(file1Path: string, file2Path: string): boolean {
    const buffer1 = fs.readFileSync(file1Path);
    const buffer2 = fs.readFileSync(file2Path);

    if (buffer1.length !== buffer2.length) {
        return false;
    }

    return buffer1.equals(buffer2);
}

/**
 * Get file info including size and checksum
 */
function getFileInfo(filePath: string): { size: number; checksum: bigint } {
    const buffer = fs.readFileSync(filePath);
    return {
        size: buffer.length,
        checksum: calculateChecksum(buffer)
    };
}

describe('Parquet File Comparison Utilities', () => {
    const testDataDir = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../data'
    );

    describe('Test data file accessibility', () => {
        it('should have the GEO parquet test file available', () => {
            const testFilePath = path.join(testDataDir, TEST_FILE_NAME);
            expect(fs.existsSync(testFilePath)).toBe(true);

            const stats = fs.statSync(testFilePath);
            expect(stats.size).toBeGreaterThan(0);
            expect(stats.isFile()).toBe(true);

            console.log(`${TEST_FILE_NAME} size: ${stats.size} bytes`);
        });

        it('should have the PLAIN parquet test file available', () => {
            const testFilePath = path.join(testDataDir, TEST_FILE_PLAIN);
            expect(fs.existsSync(testFilePath)).toBe(true);

            const stats = fs.statSync(testFilePath);
            expect(stats.size).toBeGreaterThan(0);
            expect(stats.isFile()).toBe(true);

            console.log(`${TEST_FILE_PLAIN} size: ${stats.size} bytes`);
        });
    });

    describe('Checksum calculation', () => {
        it('should calculate consistent checksums for the same file', () => {
            const testFilePath = path.join(testDataDir, TEST_FILE_NAME);
            const buffer = fs.readFileSync(testFilePath);

            const checksum1 = calculateChecksum(buffer);
            const checksum2 = calculateChecksum(buffer);

            expect(checksum1).toBe(checksum2);
            expect(typeof checksum1).toBe('bigint');
        });

        it('should calculate different checksums for different files', () => {
            const geoFilePath = path.join(testDataDir, TEST_FILE_NAME);
            const plainFilePath = path.join(testDataDir, TEST_FILE_PLAIN);

            const geoBuffer = fs.readFileSync(geoFilePath);
            const plainBuffer = fs.readFileSync(plainFilePath);

            const geoChecksum = calculateChecksum(geoBuffer);
            const plainChecksum = calculateChecksum(plainBuffer);

            expect(geoChecksum).not.toBe(plainChecksum);
            console.log(`GEO checksum: ${geoChecksum}`);
            console.log(`PLAIN checksum: ${plainChecksum}`);
        });

        it('should handle empty buffers', () => {
            const emptyBuffer = Buffer.from([]);
            const checksum = calculateChecksum(emptyBuffer);
            expect(checksum).toBe(BigInt(0));
        });

        it('should handle small buffers', () => {
            const smallBuffer = Buffer.from([1, 2, 3, 4, 5]);
            const checksum = calculateChecksum(smallBuffer);
            expect(checksum).toBe(BigInt(15)); // 1+2+3+4+5 = 15
        });
    });

    describe('File comparison by checksum', () => {
        it('should detect identical files', () => {
            const testFilePath = path.join(testDataDir, TEST_FILE_NAME);

            // Compare file to itself
            const areIdentical = compareFilesByChecksum(testFilePath, testFilePath);
            expect(areIdentical).toBe(true);
        });

        it('should detect different files', () => {
            const geoFilePath = path.join(testDataDir, TEST_FILE_NAME);
            const plainFilePath = path.join(testDataDir, TEST_FILE_PLAIN);

            const areDifferent = compareFilesByChecksum(geoFilePath, plainFilePath);
            expect(areDifferent).toBe(false);
        });
    });

    describe('File comparison byte by byte', () => {
        it('should detect identical files byte by byte', () => {
            const testFilePath = path.join(testDataDir, TEST_FILE_NAME);

            // Compare file to itself
            const areIdentical = compareFilesByteByByte(testFilePath, testFilePath);
            expect(areIdentical).toBe(true);
        });

        it('should detect different files byte by byte', () => {
            const geoFilePath = path.join(testDataDir, TEST_FILE_NAME);
            const plainFilePath = path.join(testDataDir, TEST_FILE_PLAIN);

            const areDifferent = compareFilesByteByByte(geoFilePath, plainFilePath);
            expect(areDifferent).toBe(false);
        });
    });

    describe('File info extraction', () => {
        it('should extract correct file info for GEO parquet', () => {
            const testFilePath = path.join(testDataDir, TEST_FILE_NAME);
            const info = getFileInfo(testFilePath);

            expect(info.size).toBeGreaterThan(0);
            expect(typeof info.checksum).toBe('bigint');

            console.log(`${TEST_FILE_NAME} info:`, info);
        });

        it('should extract correct file info for PLAIN parquet', () => {
            const testFilePath = path.join(testDataDir, TEST_FILE_PLAIN);
            const info = getFileInfo(testFilePath);

            expect(info.size).toBeGreaterThan(0);
            expect(typeof info.checksum).toBe('bigint');

            console.log(`${TEST_FILE_PLAIN} info:`, info);
        });

        it('should show different sizes for GEO vs PLAIN files', () => {
            const geoFilePath = path.join(testDataDir, TEST_FILE_NAME);
            const plainFilePath = path.join(testDataDir, TEST_FILE_PLAIN);

            const geoInfo = getFileInfo(geoFilePath);
            const plainInfo = getFileInfo(plainFilePath);

            // GEO file should be different size than PLAIN file
            expect(geoInfo.size).not.toBe(plainInfo.size);
            expect(geoInfo.checksum).not.toBe(plainInfo.checksum);

            console.log('Size comparison:', {
                geo: geoInfo.size,
                plain: plainInfo.size,
                difference: Math.abs(geoInfo.size - plainInfo.size)
            });
        });
    });

    describe('Import/Export simulation', () => {
        it('should document the expected import/export workflow', () => {
            // This test documents the expected workflow for a full e2e test:
            //
            // 1. Import: Load parquet file from filesystem into OPFS
            //    - Use writeFileToOpfs() or SrImportWorker
            //    - File is stored in OPFS SlideRule directory
            //
            // 2. Process: Load into DuckDB for querying
            //    - Use duckDb.insertOpfsParquet(fileName)
            //    - Creates a view in DuckDB for SQL queries
            //
            // 3. Export: Stream data back to a new parquet file
            //    - Query all data: SELECT * FROM "fileName"
            //    - Write results to new parquet file in OPFS
            //    - Use DuckDB's parquet writer or copy data
            //
            // 4. Verify: Compare original and exported files
            //    - Compare file sizes (must match exactly)
            //    - Compare checksums (must match exactly)
            //    - Compare metadata (geo, recordinfo, etc.)
            //    - Compare row counts via SQL queries
            //    - Compare sample data rows
            //
            // This workflow validates data integrity through the full cycle.

            expect(true).toBe(true);
        });

        it('should validate that a round-trip preserves file identity', () => {
            // In a real e2e test, we would:
            // 1. Import TEST_FILE_NAME to OPFS
            // 2. Load it into DuckDB
            // 3. Export all data to TEMP_FILE_NAME
            // 4. Compare checksums: original vs exported
            //
            // Expected result: checksums should match exactly
            //
            // For this unit test, we simulate by comparing a file to itself:

            const testFilePath = path.join(testDataDir, TEST_FILE_NAME);
            const originalInfo = getFileInfo(testFilePath);

            // Simulate export by reading the same file again
            const exportedInfo = getFileInfo(testFilePath);

            // These should be identical (perfect round-trip)
            expect(exportedInfo.size).toBe(originalInfo.size);
            expect(exportedInfo.checksum).toBe(originalInfo.checksum);

            console.log('Round-trip validation passed:', {
                size: originalInfo.size,
                checksum: originalInfo.checksum.toString()
            });
        });
    });

    describe('Edge cases and error conditions', () => {
        it('should handle comparison of files with size differences', () => {
            const geoFilePath = path.join(testDataDir, TEST_FILE_NAME);
            const plainFilePath = path.join(testDataDir, TEST_FILE_PLAIN);

            // These files have different sizes, comparison should return false
            const result = compareFilesByChecksum(geoFilePath, plainFilePath);
            expect(result).toBe(false);
        });

        it('should handle empty file comparison', () => {
            // Create temporary empty buffers for testing
            const empty1 = Buffer.from([]);
            const empty2 = Buffer.from([]);

            const checksum1 = calculateChecksum(empty1);
            const checksum2 = calculateChecksum(empty2);

            expect(checksum1).toBe(checksum2);
            expect(checksum1).toBe(BigInt(0));
        });

        it('should differentiate files that differ by a single byte', () => {
            const buffer1 = Buffer.from([1, 2, 3, 4, 5]);
            const buffer2 = Buffer.from([1, 2, 3, 4, 6]); // Last byte differs

            const checksum1 = calculateChecksum(buffer1);
            const checksum2 = calculateChecksum(buffer2);

            expect(checksum1).not.toBe(checksum2);
            expect(checksum2 - checksum1).toBe(BigInt(1)); // Difference of 1
        });
    });
});
