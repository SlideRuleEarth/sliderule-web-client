import type { DuckDBClient, QueryResult } from '@/utils/SrDuckDb';


/**
 * Converts a table of rows and columns to a CSV blob and triggers download.
 */
export function exportRowsToCSV(rows: Array<Record<string, any>>, columns: string[], filename = 'export.csv') {
    if (!rows || rows.length === 0) return;

    let csvContent = columns.join(',') + '\n';
    for (const row of rows) {
        const rowData = columns.map(col => {
            const cell = row[col] == null ? '' : String(row[col]);
            return `"${cell.replace(/"/g, '""')}"`;
        });
        csvContent += rowData.join(',') + '\n';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Executes a DuckDB SQL query and returns the result rows and schema.
 */
export async function runSqlQuery(
    duckDbClient: DuckDBClient,
    sql: string
): Promise<{ rows: Array<Record<string, any>>, columns: string[], chunkCount: number }> {
    const result: QueryResult = await duckDbClient.query(sql);
    const allRows: Array<Record<string, any>> = [];
    let chunkCount = 0;

    for await (const batch of result.readRows()) {
        allRows.push(...batch);
        chunkCount++;
    }

    return {
        rows: allRows,
        columns: result.schema.map(col => col.name),
        chunkCount
    };
}

export async function streamSqlQueryToCSV(
    duckDbClient: DuckDBClient,
    sql: string,
    filename = 'SlideRuleExport.csv'
): Promise<void> {
    const startTime = performance.now();
    const result: QueryResult = await duckDbClient.query(sql);
    const columns = result.schema.map(col => col.name);

    // Prepare the CSV header
    let csvContent = columns.join(',') + '\n';

    let chunkCount = 0;
    for await (const batch of result.readRows()) {
        for (const row of batch) {
            const rowData = columns.map(col => {
                const cell = row[col] == null ? '' : String(row[col]);
                return `"${cell.replace(/"/g, '""')}"`;
            });
            csvContent += rowData.join(',') + '\n';
        }
        chunkCount++;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    const endTime = performance.now();
    console.log(`Exported ${chunkCount} chunks in ${((endTime - startTime) / 1000).toFixed(2)} seconds.`);
}
