<template>
    <div class="duckdb-shell">
        <h2 class="sr-header">Sql Playground</h2>
        <div class="sr-query-panel">
            <div>
                <!-- Query Input -->
                <Message class="sr-onmap-msg" severity="info" closable size="small">
                    <p>Parquet file: {{ computedFileLabel }}</p>
                </Message>
                <Textarea
                    class="sr-duckdb-textarea"
                    :style="{ resize: 'both', overflow: 'auto' }"
                    v-model="query"
                    placeholder="Enter SQL query"
                    size="large"
                    rows="5"
                    cols="50"
                ></Textarea>
            </div>
            <div class="sr-btn-msg-panel">
                <div class="sr-query-buttons">
                    <!-- Run Button -->
                    <Button 
                        :disabled="isLoading" 
                        @click="executeQuery" size="small"
                    >
                        {{ isLoading ? "Running..." : "Run Sql Query" }}
                    </Button>
                    <Button 
                        v-if="rows.length > 0" 
                        @click="exportToCSV"
                        style="margin-left: 1rem;"
                        size="small"
                        >
                        Export CSV
                    </Button>
                </div>
                <div class="sr-query-msg-panel">
                    <!-- Error Display -->
                    <p class="sr-query-msg sr-error" v-if="error" >
                        {{ error }}
                    </p>

                    <!-- Info Display -->
                    <p class="sr-query-msg sr-info" v-if="info" >
                        {{ info }}
                    </p>
                </div>
                <FloatLabel variant="on">
                    <InputNumber class="sr-limit" v-model="limit" inputId="integeronly" fluid />
                    <label for="integeronly">Limit</label>
                </FloatLabel>
            </div>
        </div>
        <div class="sr-results-panel">
            <!-- Results DataTable -->
            <DataTable 
                v-if="rows.length > 0" 
                :value="rows"
                scrollable
                scrollHeight="400px"
                scrollDirection="both" 
                style="margin-top: 1rem; width: 50rem;"
            >
                <Column
                    v-for="col in columns"
                    sortable
                    :key="col"
                    :field="col"
                    :header="col"
                />
            </DataTable>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import { createDuckDbClient, DuckDBClient, QueryResult } from '@/utils/SrDuckDb';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { useChartStore } from '@/stores/chartStore';

// PrimeVue Components
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import FloatLabel from 'primevue/floatlabel';
import InputNumber from 'primevue/inputnumber';
import { Message } from 'primevue';
import { useRequestsStore } from '@/stores/requestsStore';
const requestsStore = useRequestsStore();

const recTreeStore = useRecTreeStore();
const chartStore = useChartStore();

const query = ref('');
const rows = ref<Array<Record<string, any>>>([]);
const columns = ref<string[]>([]);
const error = ref<string | null>(null);
const info = ref<string | null>(null);
const isLoading = ref(false);
const computedFileLabel = computed(() => `${chartStore.getFile(recTreeStore.selectedReqIdStr)}`);
const limit = ref(1000);
const computedLimitClause = computed(() => (limit.value > 0 ? `LIMIT ${limit.value}` : ''));
const computedStartingInfoText = computed(() => {
    if(limit.value > 0){
        return `running query adding ${computedLimitClause} ...`;
    } else {
        return 'running query ...';
    }
});

let duckDbClient: DuckDBClient | null = null;

function getSql(){
    const sqlStmnt = chartStore.getQuerySql(recTreeStore.selectedReqIdStr);
    if (!sqlStmnt) {
        return `No SQL statement available for this reqId: ${recTreeStore.selectedReqIdStr}`;
    }
    return sqlStmnt.trim();
}

function exportToCSV(): void {
    // If no rows, do nothing
    if (!rows.value || rows.value.length === 0) {
        return;
    }

    // 1. Create CSV header from columns
    let csvContent = columns.value.join(',') + '\n';

    // 2. Append rows
    rows.value.forEach(row => {
        // Convert each cell to string, handle commas, quotes if needed
        const rowData = columns.value.map(col => {
            // Convert "undefined" or null values to empty string
            const cellValue = row[col] == null ? '' : String(row[col]);
            // Optional: handle quotes, escape commas, etc. if you want more robust CSV
            return `"${cellValue.replace(/"/g, '""')}"`;
        });
        csvContent += rowData.join(',') + '\n';
    });

    // 3. Create a Blob object for the CSV data
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // 4. Create a temporary link to download the Blob
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'export.csv');
    link.style.visibility = 'hidden';

    // 5. Trigger the download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

onMounted(async () => {
    try {
        duckDbClient = await createDuckDbClient();
        query.value = getSql();
        requestsStore.displayHelpfulPlotAdvice("click Run to generate a table of the selected track data");
        requestsStore.displayHelpfulPlotAdvice("You can query the table with any valid SQL statement");
        console.log('SrDuckDbShell onMounted: DuckDB client initialized ');
        info.value = 'Enter a SQL query and click "Run Sql Query"\nIf it "Snaps" reload the page and narrow the query and/or use LIMIT';
    } catch (err: any) {
        error.value = `Failed to initialize DuckDB: ${err?.message ?? err}`;
        console.error(err);
    }
});

async function executeQuery() {
    if (!duckDbClient){
        console.error('DuckDB client not initialized');
        error.value = 'DuckDB client not initialized?';
        return;
    }
    isLoading.value = true;
    error.value = '';
    info.value = computedStartingInfoText.value;
    rows.value = [];
    columns.value = [];
    let numChunks = 0;
    const finalQuery = `${query.value} ${computedLimitClause.value}`;
    try {
        const result: QueryResult = await duckDbClient.query(finalQuery);
        const allRows: Array<Record<string, any>> = [];
        for await (const batch of result.readRows()) {
            numChunks++;
            allRows.push(...batch);
        }

        rows.value = allRows;
        columns.value = result.schema.map((col) => col.name);
        if(numChunks === 0){
            error.value = 'No results found';
        }
    } catch (err: any) {
        error.value = `Query error: ${err?.message ?? err}`;
        console.error(err);
    } finally {
        isLoading.value = false;
        console.log(`Query executed in ${numChunks} chunks`);
        info.value= `There are ${rows.value.length} rows in the result`;
    }
}
</script>

<style scoped>
.sr-header {
    margin-bottom: 0.25rem;
    margin-top:0rem;
}

.duckdb-shell {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 0.75rem;
    max-width: 600px;
    width: 100%;
    margin: 1rem auto;
}

.sr-btn-msg-panel {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
}

.sr-query-msg-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    background-color: #2c2c2c;
    gap: 0.5rem;
    width: 100%;
    border-radius: var(--p-border-radius);
    padding: 0.25rem;
    margin-bottom: 0.25rem;
}

.sr-query-msg {
    display: block;
    font-size: x-small;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
}

.sr-onmap-msg {
    justify-content: center;
    text-align: center;
    align-items: center;
    font-size: x-small;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
    height: 2rem;
}

.sr-results-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
}

.sr-query-buttons {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    white-space: nowrap;

}

:deep(.sr-duckdb-textarea) {
    font-family: monospace;
    font-size: smaller;
    width: 100%;
}

.sr-query-panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    background-color: transparent;
    border-radius: 0.5rem;
    padding: 0.5rem;
    margin-bottom: 0.25rem;
}
.sr-limit {
    width: fit-content;
}
.sr-error {
    color: red;
    white-space: pre-wrap;
}

.sr-info {
    white-space: pre-wrap;
}

</style>
