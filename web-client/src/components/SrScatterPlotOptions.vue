<script setup lang="ts">
import SrSqlStmnt from "@/components/SrSqlStmnt.vue";
import Fieldset from "primevue/fieldset";
import SrMenu from "@/components/SrMenu.vue";
import SrSwitchedSliderInput from "@/components/SrSwitchedSliderInput.vue";
import { callPlotUpdateDebounced } from "@/utils/plotUtils";

import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { useAtl03ColorMapStore } from '@/stores/atl03ColorMapStore';
import { useChartStore } from '@/stores/chartStore';
import { onMounted, computed } from "vue";
import { clearPlot } from "@/utils/plotUtils";

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const atl03ColorMapStore = useAtl03ColorMapStore();
const atlChartFilterStore = useAtlChartFilterStore();
const chartStore = useChartStore();


// Define props with TypeScript types
const props = defineProps<{
  req_id: number;
}>();

const computedReqIdStr = computed(() => {
    return props.req_id.toString();
});

const computedFunc = computed(() => {
    return chartStore.getFunc(computedReqIdStr.value);
});

const computedLabel = computed(() => {
  return `Plot Details for ${computedReqIdStr.value} - ${computedFunc.value}`;
});


onMounted(() => {
    console.log('SrScatterPlotOptions onMounted props.req_id:', props.req_id);
    console.log('SrScatterPlotOptions onMounted computedReqIdStr:', computedReqIdStr.value);
});


async function changedColorKey() {
    //console.log('changedColorKey:', atl03ColorMapStore.getAtl03ColorKey());
    clearPlot();
    await callPlotUpdateDebounced('changedColorKey');
}

</script>
<template>
<Fieldset   
    class="sr-scatter-plot-options" 
    :legend="computedLabel" 
    :toggleable="true" 
    :collapsed="true"
>
    <div class="sr-sql-stmnt">
        <SrSqlStmnt 
            :req_id="props.req_id"
        />
    </div>
    <div class="sr-data-set-options">
        <label>Num points in plot:</label>
        {{ numberFormatter.format(chartStore.getNumOfPlottedPnts(computedReqIdStr)) }}
        <SrSwitchedSliderInput 
            v-model="atlChartFilterStore.largeDataThreshold"
            :getCheckboxValue="atlChartFilterStore.getLargeData"
            :setCheckboxValue="atlChartFilterStore.setLargeData"
            :getValue="atlChartFilterStore.getLargeDataThreshold"
            :setValue="atlChartFilterStore.setLargeDataThreshold"
            label="Large Data Threshold (optimization-single color)"
            :min="1"
            :max="1000000" 
            :decimalPlaces="0"
            tooltipText="Threshold for large data optimization (progressive rendering)"
            tooltipUrl="https://echarts.apache.org/en/option.html#series-scatter.large"
        />
    </div>

    <div class="sr-select-color-key">
        <SrMenu 
            v-if = "chartStore.getFunc(computedReqIdStr) === 'atl03sp'"
            label="Alt03 Color Map" 
            v-model="atl03ColorMapStore.atl03ColorKey"
            @update:modelValue="changedColorKey"
            :getSelectedMenuItem="atl03ColorMapStore.getAtl03ColorKey"
            :setSelectedMenuItem="atl03ColorMapStore.setAtl03ColorKey"
            :menuOptions="atl03ColorMapStore.getAtl03ColorKeyOptions()" 
            tooltipText="Data key for Color of atl03 scatter plot"
        /> 
    </div>

</Fieldset>
</template>
<style scoped>
.sr-scatter-plot-options {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 0.5rem;
    margin: 0.5rem;
    width: fit-content;
    min-width: 30rem;
}

.sr-select-color-map {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.5rem;
    margin: 0.5rem;
    width: 100%;
}

.sr-select-color-key {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.5rem;
    margin: 0.5rem;
    width: 100%;
}

.sr-select-atl03-colors {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.5rem;
    margin: 0.5rem;
    width: 100%;
}

.sr-select-atl08-colors {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.5rem;
    margin: 0.5rem;
    width: 100%;
}

.sr-select-yapc-color-map {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.5rem;
    margin: 0.5rem;
    width: 100%;
}

.sr-scatter-plot-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.5rem;
    margin: 0.5rem;
    width: 100%;
}

.sr-sql-stmnt {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.5rem;
    margin: 0.5rem;
    width: 100%;
}
</style>