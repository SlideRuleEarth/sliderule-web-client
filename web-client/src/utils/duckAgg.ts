// in '@/utils/duckAgg.ts'
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


export function buildSafeAggregateClauses(
  columnNames: string[],
  getType: (colName: string) => string,
  escape: (colName: string) => string
): string[] {
  return columnNames.flatMap((colName) => {
    const rawType = getType(colName);
    const type = baseType(rawType);
    const escaped = escape(colName);

    // Filters
    const floatFilter = `FILTER (WHERE NOT isnan(${escaped}) AND NOT isinf(${escaped}))`;
    const pctOrderExpr = percentileOrderExpr(type, escaped);

    const pctFilter =
      FLOAT_TYPES.has(type)
        ? `FILTER (WHERE NOT isnan(${pctOrderExpr}) AND NOT isinf(${pctOrderExpr}))`
        : ``; // NULLs are ignored by aggregates anyway

    // MIN/MAX: use native values (duckdb ignores NULLs)
    const minMaxClauses =
      FLOAT_TYPES.has(type)
        ? [
            `MIN(${escaped}) ${floatFilter} AS ${alias("min", colName)}`,
            `MAX(${escaped}) ${floatFilter} AS ${alias("max", colName)}`
          ]
        : [
            `MIN(${escaped}) AS ${alias("min", colName)}`,
            `MAX(${escaped}) AS ${alias("max", colName)}`
          ];

    // LOW/HIGH: percentile-based, using the numeric ORDER BY expression
    const lowHighClauses = [
      `PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY ${pctOrderExpr}) ${pctFilter} AS ${alias("low", colName)}`,
      `PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY ${pctOrderExpr}) ${pctFilter} AS ${alias("high", colName)}`
    ];

    return [...minMaxClauses, ...lowHighClauses];
  });
}
