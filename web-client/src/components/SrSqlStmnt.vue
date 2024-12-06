<template>
    <div class="sr-sql-stmnt-display-panel">
        <div class="sr-sql-stmnt-display-panel-content">
            <div class="sr-sql-stmnt-display-panel-header"> 
                <SrCheckbox
                    v-model="showSqlStmnt"
                    label="Show Sql Statement"
                />
            </div>
            <div class="sr-sql-stmnt-display-parms" v-if="showSqlStmnt">
                <pre class="sql-stmnt-pre"><code>{{ computedSqlStmnt }}</code></pre>
            </div>
        </div>
    </div>
</template>
  
<script setup lang="ts">
    import { ref,onMounted,computed } from "vue";
    import SrCheckbox from "@/components/SrCheckbox.vue";
    import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
    import { useChartStore } from "@/stores/chartStore";
    const atlChartFilterStore = useAtlChartFilterStore();

    const showSqlStmnt = ref(false);
    const computedCurFunc = computed(() => {
        return atlChartFilterStore.getFunc();
    });
    const computedSqlStmnt = computed(() => {
        const sqlStmnt = useChartStore().getQuerySql();
        if ((sqlStmnt === undefined) || (sqlStmnt === null) || (sqlStmnt === '')) {
            return `No SQL statement available for this function: ${computedCurFunc.value}`;
        }
        return sqlStmnt;
    }); 

    onMounted(async () => {
        //console.log('SrSqlStmnt onMounted: computedSqlStmnt:',computedSqlStmnt.value);
    });

</script>
  
<style scoped>
    /* Style your button and component here */
    .sr-sql-stmnt-display-panel {
        display: flex;
        flex-direction: column;
        align-self: start;
        justify-content: left;
        padding: 0rem;
        margin-top: 0rem;
    }
    .sr-sql-stmnt-display-panel-header {
        margin-top: 0;
        font-size: medium;
        font-weight: bold;
        justify-content:left;
    }
    .sr-sql-stmnt-display-panel-content {
        font-size: smaller;
        padding: 0rem;
    }
    .sr-sql-stmnt-display-parms {
        margin-top: 0rem;
        overflow-x: auto;
        max-width: 20rem;
    }
    .sql-stmnt-pre {
        margin: 0;
        padding: 0;
    }
</style>
  