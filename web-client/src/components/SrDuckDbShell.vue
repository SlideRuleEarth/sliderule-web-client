<template>
    <div class="duckdb-shell">
        <h2 class="sr-header">Sql Playground</h2>

        <div>
            <!-- Query Input -->
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
        <div>
            <!-- Run Button -->
            <Button :disabled="isLoading" @click="executeQuery">
                {{ isLoading ? "Running..." : "Run" }}
            </Button>

            <!-- Error Display -->
            <p v-if="error" class="error">
                {{ error }}
            </p>
        </div>

        <!-- Results DataTable -->
        <DataTable 
            v-if="rows.length > 0" 
            :value="rows"
            scrollable
            scrollDirection="both" 
            style="margin-top: 1rem; width: 100%;"
        >
            <Column
                v-for="col in columns"
                :key="col"
                :field="col"
                :header="col"
            />
        </DataTable>
    </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { createDuckDbClient, DuckDBClient, QueryResult } from '@/utils/SrDuckDb';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { useChartStore } from '@/stores/chartStore';

// PrimeVue Components
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';

const recTreeStore = useRecTreeStore();
const chartStore = useChartStore();

const query = ref('');
const rows = ref<Array<Record<string, any>>>([]);
const columns = ref<string[]>([]);
const error = ref<string | null>(null);
const isLoading = ref(false);

let duckDbClient: DuckDBClient | null = null;

function getSql(){
    const sqlStmnt = chartStore.getQuerySql(recTreeStore.selectedReqIdStr);
    if (!sqlStmnt) {
        return `No SQL statement available for this reqId: ${recTreeStore.selectedReqIdStr}`;
    }
    return sqlStmnt.trim();
}

onMounted(async () => {
    try {
        duckDbClient = await createDuckDbClient();
        query.value = getSql();
        console.log('SrDuckDbShell onMounted: DuckDB client initialized ');
    } catch (err: any) {
        error.value = `Failed to initialize DuckDB: ${err?.message ?? err}`;
        console.error(err);
    }
});

async function executeQuery() {
    if (!duckDbClient) return;
    isLoading.value = true;
    error.value = null;
    rows.value = [];
    columns.value = [];

    try {
        const result: QueryResult = await duckDbClient.query(query.value);
        const allRows: Array<Record<string, any>> = [];
        for await (const batch of result.readRows()) {
            allRows.push(...batch);
        }

        rows.value = allRows;
        columns.value = result.schema.map((col) => col.name);
    } catch (err: any) {
        error.value = `Query error: ${err?.message ?? err}`;
        console.error(err);
    } finally {
        isLoading.value = false;
    }
}
</script>

<style scoped>
.sr-header {
    margin-bottom: 0.25rem;
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
.sr-duckdb-textarea :deep(.p-inputtextarea) {
    font-family: monospace;
}
.error {
    color: red;
    white-space: pre-wrap;
}
</style>
