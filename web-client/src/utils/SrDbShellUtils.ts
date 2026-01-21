import type { DuckDBClient, QueryResult } from '@/utils/SrDuckDb'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrDbShellUtils')

const MAX_QUERY_FILES = 10

/**
 * Converts a table of rows and columns to a CSV blob and triggers download.
 */
export function exportRowsToCSV(
  rows: Array<Record<string, any>>,
  columns: string[],
  filename = 'export.csv'
) {
  if (!rows || rows.length === 0) return

  let csvContent = columns.join(',') + '\n'
  for (const row of rows) {
    const rowData = columns.map((col) => {
      const cell = row[col] == null ? '' : String(row[col])
      return `"${cell.replace(/"/g, '""')}"`
    })
    csvContent += rowData.join(',') + '\n'
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Executes a DuckDB SQL query and returns the result rows and schema.
 */
export async function runSqlQuery(
  duckDbClient: DuckDBClient,
  sql: string
): Promise<{ rows: Array<Record<string, any>>; columns: string[]; chunkCount: number }> {
  const result: QueryResult = await duckDbClient.query(sql)
  const allRows: Array<Record<string, any>> = []
  let chunkCount = 0

  for await (const batch of result.readRows()) {
    allRows.push(...batch)
    chunkCount++
  }

  return {
    rows: allRows,
    columns: result.schema.map((col) => col.name),
    chunkCount
  }
}

/**
 * Generate a human-readable timestamp for filenames
 * Format: YYYY-MM-DD_HH-MM-SS
 */
function getTimestampForFilename(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`
}

/**
 * Format nanoseconds timestamp to human-readable ISO string
 */
function formatNanoseconds(ns: bigint | number | string): string {
  try {
    const nsValue = typeof ns === 'bigint' ? ns : BigInt(ns)
    const ms = Number(nsValue / BigInt(1_000_000))
    const date = new Date(ms)
    return date.toISOString()
  } catch {
    return ''
  }
}

export async function streamSqlQueryToCSV(
  duckDbClient: DuckDBClient,
  sql: string,
  reqId?: number,
  filename?: string
): Promise<void> {
  const startTime = performance.now()

  // Generate timestamped filename if not provided
  // Format: SlideRuleExport_SqlQuery_From_{reqId}_{YYYY-MM-DD_HH-MM-SS}.csv
  const reqIdPart = reqId ? `SqlQuery_From_${reqId}_` : ''
  const exportFilename = filename || `SlideRuleExport_${reqIdPart}${getTimestampForFilename()}.csv`

  const result: QueryResult = await duckDbClient.query(sql)
  const columns = result.schema.map((col) => col.name)

  // Check if there's a time_ns column to add formatted version
  const timeNsColIndex = columns.findIndex(
    (col) => col.toLowerCase() === 'time_ns' || col.toLowerCase() === 'time'
  )
  const hasTimeCol = timeNsColIndex !== -1
  const timeColName = hasTimeCol ? columns[timeNsColIndex] : null

  // Build header with optional time_ns_fmt column
  const exportColumns = hasTimeCol ? [...columns, 'time_ns_fmt'] : columns
  let csvContent = exportColumns.join(',') + '\n'

  let chunkCount = 0
  for await (const batch of result.readRows()) {
    for (const row of batch) {
      const rowData = columns.map((col) => {
        const cell = row[col] == null ? '' : String(row[col])
        return `"${cell.replace(/"/g, '""')}"`
      })

      // Add formatted time column if time_ns exists
      if (hasTimeCol && timeColName) {
        const timeValue = row[timeColName]
        const formattedTime = timeValue != null ? formatNanoseconds(timeValue) : ''
        rowData.push(`"${formattedTime}"`)
      }

      csvContent += rowData.join(',') + '\n'
    }
    chunkCount++
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', exportFilename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)

  // Also download the SQL query as a .sql file
  downloadSqlFile(sql, exportFilename)

  const endTime = performance.now()
  logger.debug('Exported chunks', {
    chunkCount,
    duration: ((endTime - startTime) / 1000).toFixed(2)
  })
}

/**
 * Download SQL query as a .sql text file
 */
export function downloadSqlFile(sql: string, baseFilename: string): void {
  const sqlFilename = baseFilename.replace(/\.(csv|parquet)$/i, '.sql')
  const blob = new Blob([sql], { type: 'text/plain;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', sqlFilename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
  logger.debug('Downloaded SQL file', { sqlFilename })
}

/**
 * Write buffer to OPFS folder
 */
async function writeToOpfs(folder: string, fileName: string, buffer: Uint8Array): Promise<void> {
  const opfsRoot = await navigator.storage.getDirectory()
  const directoryHandle = await opfsRoot.getDirectoryHandle(folder, { create: true })
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(buffer as unknown as Blob)
  await writable.close()
}

/**
 * Ensure query has geometry column, adding one from lat/lon if needed
 */
async function ensureGeometryColumn(duckDbClient: DuckDBClient, sql: string): Promise<string> {
  // Check if query already has geometry column
  const describeResult = await duckDbClient.query(`DESCRIBE (${sql})`)
  let hasGeometry = false
  let lonCol: string | null = null
  let latCol: string | null = null

  for await (const batch of describeResult.readRows()) {
    for (const row of batch) {
      const colType = (row.column_type || '').toUpperCase()
      const colName = (row.column_name || '').toLowerCase()

      if (colType.includes('GEOMETRY')) hasGeometry = true
      if (colName.includes('longitude') || colName === 'lon' || colName === 'x')
        lonCol = row.column_name
      if (colName.includes('latitude') || colName === 'lat' || colName === 'y')
        latCol = row.column_name
    }
  }

  if (hasGeometry) return sql
  if (!lonCol || !latCol) return sql // No geometry possible

  // Wrap query to add geometry column
  logger.debug('Adding geometry column from lat/lon', { lonCol, latCol })
  return `SELECT *, ST_Point("${lonCol}", "${latCol}") AS geometry FROM (${sql}) AS subquery`
}

/**
 * Cleanup old query files, keeping only the last MAX_QUERY_FILES
 */
async function cleanupOldQueryFiles(): Promise<void> {
  const opfsRoot = await navigator.storage.getDirectory()

  try {
    const directoryHandle = await opfsRoot.getDirectoryHandle('SqlQueries', { create: false })

    // Collect all files with their timestamps (from filename)
    const files: { name: string; timestamp: string }[] = []
    // Use type assertion for entries() which exists but isn't in TS types
    for await (const [name, handle] of (directoryHandle as any).entries()) {
      if (
        handle.kind === 'file' &&
        name.startsWith('SqlQuery_From_') &&
        name.endsWith('.parquet')
      ) {
        // Extract timestamp from filename: SqlQuery_From_{reqId}_{YYYY-MM-DD_HH-MM-SS}.parquet
        const match = name.match(/_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})\.parquet$/)
        if (match) {
          files.push({ name, timestamp: match[1] })
        }
      }
    }

    // Sort by timestamp descending (newest first) - ISO-like format sorts correctly as string
    files.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

    // Delete files beyond the limit
    for (let i = MAX_QUERY_FILES; i < files.length; i++) {
      await directoryHandle.removeEntry(files[i].name)
      logger.debug('Cleaned up old query file', { fileName: files[i].name })
    }
  } catch (error: any) {
    // Folder might not exist yet, that's fine
    if (error.name !== 'NotFoundError') {
      logger.warn('Failed to cleanup old query files', { error: error.message })
    }
  }
}

/**
 * Execute SQL query and write results to a GeoParquet file in OPFS
 */
export async function executeSqlQueryToGeoParquet(
  duckDbClient: DuckDBClient,
  sql: string,
  reqId: number
): Promise<{ fileName: string; rowCount: number }> {
  const startTime = performance.now()

  // 1. Generate filename: SqlQuery_From_{reqId}_{YYYY-MM-DD_HH-MM-SS}.parquet
  const humanTimestamp = getTimestampForFilename()
  const fileName = `SqlQuery_From_${reqId}_${humanTimestamp}.parquet`
  const virtualFileName = `query_${Date.now()}.parquet`

  logger.debug('Starting GeoParquet export', { fileName, reqId })

  // 2. Detect/add geometry column if needed (from lat/lon)
  const geoSql = await ensureGeometryColumn(duckDbClient, sql)

  // 3. Write to DuckDB virtual file via COPY
  await duckDbClient.copyQueryToParquet(geoSql, virtualFileName)

  // 4. Get buffer and write to OPFS SqlQueries folder
  const buffer = await duckDbClient.copyFileToBuffer(virtualFileName)
  await writeToOpfs('SqlQueries', fileName, buffer)

  // 5. Cleanup virtual file
  await duckDbClient.dropVirtualFile(virtualFileName)

  // 6. Register the new file with DuckDB for querying
  await duckDbClient.insertOpfsParquet(fileName, 'SqlQueries')

  // 7. Get row count
  const rowCount = await duckDbClient.getTotalRowCount(`SELECT * FROM "${fileName}"`)

  // 8. Cleanup old query files
  await cleanupOldQueryFiles()

  const endTime = performance.now()
  logger.debug('GeoParquet export complete', {
    fileName,
    rowCount,
    duration: ((endTime - startTime) / 1000).toFixed(2)
  })

  return { fileName, rowCount }
}
