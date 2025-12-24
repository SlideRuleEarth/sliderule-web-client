/**
 * Array/List aggregation utilities for DuckDB
 *
 * This module provides SQL building functions for handling array columns
 * from parquet files, supporting both flattening (UNNEST) and aggregation
 * (list_avg, list_min, etc.) operations.
 */

import type { AggregationFunction } from '@/stores/arrayColumnStore'

/**
 * Mapping of aggregation function names to DuckDB list functions
 */
export const AGGREGATION_SQL_MAP: Record<AggregationFunction, string> = {
  mean: 'list_avg',
  min: 'list_min',
  max: 'list_max',
  sum: 'list_sum',
  count: 'len',
  first: 'list_first',
  last: 'list_last',
  unique_count: 'list_distinct',
  // These require special handling
  median: 'MEDIAN_SPECIAL',
  stddev: 'STDDEV_SPECIAL'
}

/**
 * Escape a column name for safe use in SQL queries
 * Wraps in double quotes to handle special characters and reserved words
 */
export function escapeColumnName(name: string): string {
  // Replace any existing double quotes with escaped double quotes
  const escaped = name.replace(/"/g, '""')
  return `"${escaped}"`
}

/**
 * Build a single aggregation SQL clause for an array column
 *
 * @param columnName - The array column name
 * @param aggregation - The aggregation function to apply
 * @returns SQL clause string like 'list_avg("column") AS "column_mean"'
 */
export function buildSingleAggregateClause(
  columnName: string,
  aggregation: AggregationFunction
): string {
  const escapedCol = escapeColumnName(columnName)
  const derivedName = `${columnName}_${aggregation}`
  const escapedDerived = escapeColumnName(derivedName)
  // Filter out NaN and Inf values from the array before aggregating
  const filteredCol = `list_filter(${escapedCol}, x -> x IS NOT NULL AND NOT isnan(x) AND NOT isinf(x))`

  switch (aggregation) {
    case 'median':
      // DuckDB: get middle element of sorted list
      // list_sort returns sorted array, then index by (length/2 + 1) for 1-based indexing
      return `list_sort(${filteredCol})[CAST((len(${filteredCol}) + 1) / 2 AS INTEGER)] AS ${escapedDerived}`

    case 'stddev':
      // Use list_aggregate with stddev_pop function
      return `list_aggregate(${filteredCol}, 'stddev_pop') AS ${escapedDerived}`

    case 'unique_count':
      // Count distinct elements: len(list_distinct(col))
      return `len(list_distinct(${filteredCol})) AS ${escapedDerived}`

    case 'count':
      // Count uses original array to count all elements including NaN/Inf
      return `len(${escapedCol}) AS ${escapedDerived}`

    default: {
      // Standard list functions (use filtered array)
      const func = AGGREGATION_SQL_MAP[aggregation]
      return `${func}(${filteredCol}) AS ${escapedDerived}`
    }
  }
}

/**
 * Build SELECT clauses for array aggregation mode
 *
 * @param columnName - The array column name
 * @param aggregations - Array of aggregation functions to apply
 * @returns Array of SQL clause strings
 *
 * @example
 * buildArrayAggregateSelect('photons', ['mean', 'min', 'max'])
 * // Returns:
 * // [
 * //   'list_avg("photons") AS "photons_mean"',
 * //   'list_min("photons") AS "photons_min"',
 * //   'list_max("photons") AS "photons_max"'
 * // ]
 */
export function buildArrayAggregateSelect(
  columnName: string,
  aggregations: AggregationFunction[]
): string[] {
  return aggregations.map((agg) => buildSingleAggregateClause(columnName, agg))
}

/**
 * Build SELECT clause for array flatten mode (UNNEST)
 *
 * @param columnName - The array column name
 * @returns SQL clause string for UNNEST operation
 *
 * @example
 * buildArrayFlattenSelect('photons')
 * // Returns: 'UNNEST("photons") AS "photons"'
 */
export function buildArrayFlattenSelect(columnName: string): string {
  const escapedCol = escapeColumnName(columnName)
  return `UNNEST(${escapedCol}) AS ${escapedCol}`
}

/**
 * Build a complete SELECT clause with array column handling
 *
 * @param baseColumns - Array of base column names to select
 * @param arrayColumn - The array column name (if any)
 * @param mode - 'flatten' | 'aggregate' | 'none'
 * @param aggregations - Aggregation functions to apply (for aggregate mode)
 * @returns Complete SELECT clause string
 */
export function buildSelectWithArrayColumn(
  baseColumns: string[],
  arrayColumn: string | null,
  mode: 'flatten' | 'aggregate' | 'none',
  aggregations: AggregationFunction[] = []
): string {
  // Start with base columns
  const selectParts = baseColumns.map((col) => escapeColumnName(col))

  if (!arrayColumn || mode === 'none') {
    return selectParts.join(', ')
  }

  if (mode === 'flatten') {
    // Add UNNEST for the array column
    selectParts.push(buildArrayFlattenSelect(arrayColumn))
  } else if (mode === 'aggregate') {
    // Add aggregation clauses
    const aggClauses = buildArrayAggregateSelect(arrayColumn, aggregations)
    selectParts.push(...aggClauses)
  }

  return selectParts.join(', ')
}

/**
 * Get the derived column names that will be created from array operations
 *
 * @param columnName - The array column name
 * @param mode - 'flatten' | 'aggregate' | 'none'
 * @param aggregations - Aggregation functions (for aggregate mode)
 * @returns Array of derived column names
 */
export function getDerivedColumnNames(
  columnName: string,
  mode: 'flatten' | 'aggregate' | 'none',
  aggregations: AggregationFunction[] = []
): string[] {
  if (mode === 'none' || !columnName) {
    return []
  }

  if (mode === 'flatten') {
    // Flatten mode: the array column becomes a scalar with the same name
    return [columnName]
  }

  if (mode === 'aggregate') {
    // Aggregate mode: create derived columns for each aggregation
    return aggregations.map((agg) => `${columnName}_${agg}`)
  }

  return []
}

/**
 * Validate that an array column can be safely used in queries
 *
 * @param columnName - The column name to validate
 * @returns true if valid, false otherwise
 */
export function isValidArrayColumnName(columnName: string): boolean {
  if (!columnName || typeof columnName !== 'string') {
    return false
  }
  // Check for SQL injection patterns
  const dangerousPatterns = [';', '--', '/*', '*/', 'DROP', 'DELETE', 'INSERT', 'UPDATE']
  const upperName = columnName.toUpperCase()
  return !dangerousPatterns.some((pattern) => upperName.includes(pattern))
}

/**
 * Build a WHERE clause to filter out rows with empty or null arrays
 *
 * @param columnName - The array column name
 * @returns WHERE clause string
 */
export function buildArrayNotEmptyClause(columnName: string): string {
  const escapedCol = escapeColumnName(columnName)
  return `${escapedCol} IS NOT NULL AND len(${escapedCol}) > 0`
}
