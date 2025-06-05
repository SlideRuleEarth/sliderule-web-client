
<template>
    <div class="sr-export-panel">
        <SrCustomTooltip ref="tooltipRef" id="exportSelTooltip" />
        <Button
            icon="pi pi-file-export"
            label="Export csv"
            class="sr-export-btn sr-glow-button"
            :id="id"
            @click="exportButtonClick"
            @mouseover="tooltipRef.showTooltip($event, 'Export the selected track data to a CSV file')"
            @mouseleave="tooltipRef.hideTooltip()"
            variant="text"
            rounded 
        >
        </Button>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { createDuckDbClient, DuckDBClient } from '@/utils/SrDuckDb';
import { streamSqlQueryToCSV } from '@/utils/SrDbShellUtils';
import { useChartStore } from '@/stores/chartStore';
import SrCustomTooltip from '@/components/SrCustomTooltip.vue';
import Button from 'primevue/button';

const props = withDefaults(
    defineProps<{
        reqId: number;
        customSql?: string;
    }>(),
    {
        reqId: 0,
    }
);
const chartStore = useChartStore();
const tooltipRef = ref();

let duckDbClient: DuckDBClient | null = null;

async function exportButtonClick(){
    duckDbClient = await createDuckDbClient();
    let sqlStmnt = '';
    if(props.customSql){
        sqlStmnt = props.customSql;
    } else {
        sqlStmnt = chartStore.getQuerySql(props.reqId.toString());
    }
    if (!sqlStmnt) {
        console.error('No SQL statement found for the selected request ID');
        return;
    }
    streamSqlQueryToCSV(duckDbClient,sqlStmnt);
};
const id=`sr-export-btn-${props.reqId}`;

</script>
<style scoped>
.sr-export-panel {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
} 
.sr-export-btn{
    min-width: 4rem;
    min-height: 2rem;
}</style>