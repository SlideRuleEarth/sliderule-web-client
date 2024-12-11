<script setup lang="ts">
import SrSqlStmnt from "@/components/SrSqlStmnt.vue";
import SrSliderInput from "@/components/SrSliderInput.vue";
import Fieldset from "primevue/fieldset";
import SrMenu from "@/components/SrMenu.vue";
import SrSwitchedSliderInput from "@/components/SrSwitchedSliderInput.vue";
import { refreshScatterPlot } from "@/utils/plotUtils";

import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { useAtl03ColorMapStore } from '@/stores/atl03ColorMapStore';
import { useChartStore } from '@/stores/chartStore';
import { colorMapNames } from '@/utils/colorUtils';
import SrAtl03CnfColors from "@/components/SrAtl03CnfColors.vue";
import SrAtl08ClassColors from "@/components/SrAtl08ClassColors.vue";
import { onMounted, watch, computed } from "vue";

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const atl03ColorMapStore = useAtl03ColorMapStore();
const atlChartFilterStore = useAtlChartFilterStore();
const chartStore = useChartStore();

interface AtColorChangeEvent {
  label: string;
  color?: string; // color can be undefined
}

// Define props with TypeScript types
const props = defineProps<{
  req_id: number;
  label: string;
}>();

const computedLabel = computed(() => {
  return props.label
    ? `Plot Options (${props.label})`
    : `Plot Options (${props.req_id})`;
});


const computedReqIdStr = computed(() => {
    return props.req_id.toString();
});

const computedSlideLabel = computed(() => {
    return `${chartStore.getFunc(computedReqIdStr.value)} Scatter Plot symbol size`
});

// Create a computed property that updates and retrieves the symbol size 
const computedSymbolSize = computed<number>({
  get() {
        return chartStore.getSymbolSize(computedReqIdStr.value);
  },
  set(value: number) {
        console.log(`computedSymbolSize set value: ${value}`);
        chartStore.setSymbolSize(computedReqIdStr.value, value);
  }
});

onMounted(() => {
    console.log('SrScatterPlotOptions onMounted props.req_id:', props.req_id);
    console.log('SrScatterPlotOptions onMounted computedReqIdStr:', computedReqIdStr.value);
    computedSymbolSize.value = chartStore.getSymbolSize(computedReqIdStr.value);
    console.log('SrScatterPlotOptions onMounted computedSymbolSize:', computedSymbolSize.value);
});


const symbolSizeSelection = async () => {
    //console.log('symbolSizeSelection');
    await refreshScatterPlot('from symbolSizeSelection');
};

async function changedColorKey() {
    //console.log('changedColorKey:', atl03ColorMapStore.getAtl03ColorKey());
    atlChartFilterStore.resetTheScatterPlot();
    await refreshScatterPlot('from changedColorKey');
}

const atl03CnfColorChanged = async (colorKey:string): Promise<void> =>{
    //console.log(`atl03CnfColorChanged:`,colorKey);
    await refreshScatterPlot('from atl03CnfColorChanged');
};

const atl08ClassColorChanged = async ({ label, color }:AtColorChangeEvent): Promise<void> => {
    //console.log(`atl08ClassColorChanged received selection change: ${label} with color ${color}`);
    if (color) {
      await refreshScatterPlot('from atl08ClassColorChanged');
    } else {
      console.warn('atl08ClassColorChanged color is undefined');
    }
};

watch(
  () => props.label,
  (newLabel, oldLabel) => {
    console.log(`SrScatterPlotOptions: label changed from ${oldLabel} to ${newLabel}`);
    console.log(`SrScatterPlotOptions: computedLabel changed to ${computedLabel}`);
  }
);

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
    <label>Num points in plot</label>
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
        tooltipText="Threshold for large data optimization using single color"
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
<div class="sr-select-color-map-panel">
    <div class="sr-select-atl03-colors">
        <SrAtl03CnfColors 
            v-if = "chartStore.getFunc(computedReqIdStr) === 'atl03sp' && (atl03ColorMapStore.getAtl03ColorKey() == 'atl03_cnf')"
            @selectionChanged="atl03CnfColorChanged"
            @defaultsChanged="atl03CnfColorChanged"
        />
    </div>  
    <div class="sr-select-atl08-colors">
        <SrAtl08ClassColors 
            v-if = "chartStore.getFunc(computedReqIdStr) === 'atl03sp' && (atl03ColorMapStore.getAtl03ColorKey() == 'atl08_class')"
            @selectionChanged="atl08ClassColorChanged"
            @defaultsChanged="atl08ClassColorChanged"
        />
    </div>
    <div class="sr-select-yapc-color-map">
        <SrMenu 
            v-if = "chartStore.getFunc(computedReqIdStr) === 'atl03sp'&& (atl03ColorMapStore.getAtl03ColorKey() == 'YAPC')"
            label="YAPC Color Map" 
            v-model="atl03ColorMapStore.selectedAtl03YapcColorMapName"
            :menuOptions="colorMapNames" 
            :getSelectedMenuItem="atl03ColorMapStore.getSelectedAtl03YapcColorMapName"
            :setSelectedMenuItem="atl03ColorMapStore.setSelectedAtl03YapcColorMapName"
            tooltipText="YAPC Color Map for atl03 scatter plot"
        />
    </div>
</div>
<div class="sr-select-symbol-size">
    <SrSliderInput
        v-model="computedSymbolSize"
        @update:model-value="symbolSizeSelection"
        :label="computedSlideLabel"
        :min="1"
        :max="20"
        :defaultValue="computedSymbolSize"
        :decimalPlaces=0
        tooltipText="Symbol size for Atl03 Scatter Plot"
    />
</div>  

</Fieldset>
</template>
<style scoped>

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