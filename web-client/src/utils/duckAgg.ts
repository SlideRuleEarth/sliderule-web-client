// in '@/utils/duckAgg.ts'
import { useFieldNameStore } from '@/stores/fieldNameStore';
import { db as indexedDb } from '@/db/SlideRuleDb';
import { createDuckDbClient } from '@/utils/SrDuckDb';

export { baseType, FLOAT_TYPES, INT_TYPES, DECIMAL_TYPES, BOOL_TYPES, TEMPORAL_TYPES };



// Normalize type names like DECIMAL(10,2) -> DECIMAL
const baseType = (t: string) => t.split('(')[0].trim().toUpperCase();

const FLOAT_TYPES = new Set(['REAL', 'FLOAT', 'DOUBLE']);
const INT_TYPES = new Set([
  'TINYINT','UTINYINT','SMALLINT','USMALLINT','INTEGER','UINTEGER','BIGINT','UBIGINT','HUGEINT','UHUGEINT'
]);
const DECIMAL_TYPES = new Set(['DECIMAL']);
const BOOL_TYPES = new Set(['BOOLEAN']);
const TEMPORAL_TYPES = new Set([
  'DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMP_S', 'TIMESTAMP_MS', 'TIMESTAMP_US', 'TIMESTAMP_NS'
]);

export function alias(prefix: string, colName: string): string {
    return `${prefix}_${colName.replace(/\./g, '_')}`;
}



// For percentile calc, we need a numeric ORDER BY expression for each type.
function percentileOrderExpr(type: string, escaped: string): string {
  if (FLOAT_TYPES.has(type) || INT_TYPES.has(type) || DECIMAL_TYPES.has(type)) {
    // As-is for numeric
    return escaped;
  }
  if (BOOL_TYPES.has(type)) {
    // Map TRUE->1, FALSE->0, NULL->NULL
    return `(CASE WHEN ${escaped} THEN 1 WHEN NOT ${escaped} THEN 0 ELSE NULL END)`;
  }
  if (TEMPORAL_TYPES.has(type)) {
    // Use epoch in appropriate resolution so we can compute percentiles numerically.
    // DuckDB supports epoch(), epoch_ms(), epoch_us(), epoch_ns()
    switch (type) {
      case 'TIMESTAMP_NS': return `epoch_ns(${escaped})`;
      case 'TIMESTAMP_US': return `epoch_us(${escaped})`;
      case 'TIMESTAMP_MS': return `epoch_ms(${escaped})`;
      case 'TIMESTAMP_S':
      case 'TIMESTAMP':    return `epoch(${escaped})`; // seconds
      case 'DATE':         return `epoch(${escaped})`; // seconds since 1970-01-01
      case 'TIME':         return `extract(epoch from ${escaped})`; // seconds since midnight
      default:             return `epoch(${escaped})`;
    }
  }
  // Fallback: treat like numeric (will likely fail only if truly non-orderable)
  return escaped;
}


export interface GeometryInfo {
  hasGeometry: boolean;
  xCol?: string;
  yCol?: string;
  zCol?: string;
}

/**
 * Check if a parquet file has a geometry column and create GeometryInfo
 *
 * @param colTypes - Column types from queryColumnTypes
 * @param reqId - Request ID to get field names from fieldNameStore
 * @returns GeometryInfo object or undefined if no geometry column exists
 */
export function getGeometryInfo(
  colTypes: Array<{ name: string; type: string }>,
  reqId: number
): GeometryInfo | undefined {
  const hasGeometry = colTypes.some(c => c.name === 'geometry');
  if (!hasGeometry) {
    return undefined;
  }

  const fieldNameStore = useFieldNameStore();
  const heightFieldName = fieldNameStore.getHFieldName(reqId);

  // Check if Z column exists as a separate column in the file
  // If it does, the geometry is 2D (Point) and Z is stored separately
  // If it doesn't, the geometry is 3D (Point Z) and Z is in the geometry
  const hasZColumn = colTypes.some(c => c.name === heightFieldName);

  return {
    hasGeometry: true,
    xCol: fieldNameStore.getLonFieldName(reqId),
    yCol: fieldNameStore.getLatFieldName(reqId),
    zCol: hasZColumn ? undefined : heightFieldName  // Only set zCol if Z is NOT a separate column
  };
}

/**
 * Complete setup for geometry-aware DuckDB operations.
 * Convenience wrapper that:
 * - Gets filename from reqId
 * - Creates DuckDB client (singleton)
 * - Loads parquet file
 * - Queries column types
 * - Determines geometry info
 *
 * @param reqId - Request ID
 * @returns Object with everything needed for geometry-aware queries
 */
export async function getGeometryInfoWithTypes(reqId: number): Promise<{
  geometryInfo: GeometryInfo | undefined;
  colTypes: Array<{ name: string; type: string }>;
  getType: (colName: string) => string;
  fileName: string;
  duckDbClient: any; // Using any to avoid importing DuckDBClient type
}> {
  const fileName = await indexedDb.getFilename(reqId);
  const duckDbClient = await createDuckDbClient();
  await duckDbClient.insertOpfsParquet(fileName);

  const colTypes = await duckDbClient.queryColumnTypes(fileName);
  const getType = (colName: string) => colTypes.find((c: any) => c.name === colName)?.type ?? 'UNKNOWN';
  const geometryInfo = getGeometryInfo(colTypes, reqId);

  return { geometryInfo, colTypes, getType, fileName, duckDbClient };
}

export function buildSafeAggregateClauses(
  columnNames: string[],
  getType: (colName: string) => string,
  escape: (colName: string) => string,
  geometryInfo?: GeometryInfo
): string[] {
  // Helper to get the expression for a column (either geometry extraction or direct column)
  const getColumnExpression = (colName: string): string => {
    if (geometryInfo?.hasGeometry) {
      // Check if this column should be extracted from geometry
      if (colName === geometryInfo.xCol) {
        return `ST_X(${escape('geometry')})`;
      } else if (colName === geometryInfo.yCol) {
        return `ST_Y(${escape('geometry')})`;
      } else if (colName === geometryInfo.zCol) {
        return `ST_Z(${escape('geometry')})`;
      }
    }
    // Default: use the column directly
    return escape(colName);
  };

  return columnNames.flatMap((colName) => {
    const rawType = getType(colName);
    const type = baseType(rawType);
    const colExpr = getColumnExpression(colName);

    // Filters
    const floatFilter = `FILTER (WHERE NOT isnan(${colExpr}) AND NOT isinf(${colExpr}))`;
    const pctOrderExpr = percentileOrderExpr(type, colExpr);

    const pctFilter =
      FLOAT_TYPES.has(type)
        ? `FILTER (WHERE NOT isnan(${pctOrderExpr}) AND NOT isinf(${pctOrderExpr}))`
        : ``; // NULLs are ignored by aggregates anyway

    // MIN/MAX: use native values (duckdb ignores NULLs)
    const minMaxClauses =
      FLOAT_TYPES.has(type)
        ? [
            `MIN(${colExpr}) ${floatFilter} AS ${alias("min", colName)}`,
            `MAX(${colExpr}) ${floatFilter} AS ${alias("max", colName)}`
          ]
        : [
            `MIN(${colExpr}) AS ${alias("min", colName)}`,
            `MAX(${colExpr}) AS ${alias("max", colName)}`
          ];

    // LOW/HIGH: percentile-based, using the numeric ORDER BY expression
    const lowHighClauses = [
      `PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY ${pctOrderExpr}) ${pctFilter} AS ${alias("low", colName)}`,
      `PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY ${pctOrderExpr}) ${pctFilter} AS ${alias("high", colName)}`
    ];

    return [...minMaxClauses, ...lowHighClauses];
  });
}
