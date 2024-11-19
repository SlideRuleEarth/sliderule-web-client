<script setup lang="ts">
import SrSqlStmnt from "./SrSqlStmnt.vue";
import SrSliderInput from "./SrSliderInput.vue";
import Fieldset from "primevue/fieldset";
import SrMenuInput from "./SrMenuInput.vue";
import SrMenu from "./SrMenu.vue";
import SrSwitchedSliderInput from "./SrSwitchedSliderInput.vue";
import { fetchScatterOptions,clearPlot } from "@/utils/plotUtils";

import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { useAtl03ColorMapStore } from '@/stores/atl03ColorMapStore';
import { getColorMapOptions } from '@/utils/colorUtils';
import { debounce } from "lodash";
import SrAtl03CnfColors from "./SrAtl03CnfColors.vue";
import SrAtl08ClassColors from "./SrAtl08ClassColors.vue";

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const atl03ColorMapStore = useAtl03ColorMapStore();
const atlChartFilterStore = useAtlChartFilterStore();
const debouncedFetchScatterOptions = debounce(fetchScatterOptions, 300);
interface AtColorChangeEvent {
  label: string;
  color?: string; // color can be undefined
}

const symbolSizeSelection = () => {
    clearPlot();
    debouncedFetchScatterOptions();
};

function changedColorKey() {
    console.log('changedColorKey:', atl03ColorMapStore.getAtl03ColorKey());
    atlChartFilterStore.resetTheScatterPlot();
    debouncedFetchScatterOptions();
}

const atl03CnfColorChanged = (colorKey:string): void =>{
  console.log(`atl03CnfColorChanged:`,colorKey);
    clearPlot();
    debouncedFetchScatterOptions();
};

const atl08ClassColorChanged = ({ label, color }:AtColorChangeEvent): void => {
    console.log(`atl08ClassColorChanged received selection change: ${label} with color ${color}`);
    if (color) {
      clearPlot();
      debouncedFetchScatterOptions();
    } else {
      console.warn('atl08ClassColorChanged color is undefined');
    }
};

const alt03YAPCColorMapChanged = (colorMap:string): void => {
    console.log(`alt03YAPCColorMapChanged:`,colorMap);
    clearPlot();
    debouncedFetchScatterOptions();
};

</script>
<template>
<Fieldset class="sr-scatter-plot-options" legend="Plot Options" :toggleable="true" :collapsed="true">
    <div class="sr-sql-stmnt">
    <SrSqlStmnt />
</div>
<div class="sr-data-set-options">
    <label>Num points in plot</label>
    {{ numberFormatter.format(useAtlChartFilterStore().getNumOfPlottedPnts()) }}
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
        v-if = "atlChartFilterStore.getFunc() === 'atl03sp'"
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
            v-if = "atlChartFilterStore.getFunc() === 'atl03sp' && (atl03ColorMapStore.getAtl03ColorKey() == 'atl03_cnf')"
            @selectionChanged="atl03CnfColorChanged"
            @defaultsChanged="atl03CnfColorChanged"
        />
    </div>  
    <div class="sr-select-atl08-colors">
        <SrAtl08ClassColors 
            v-if = "atlChartFilterStore.getFunc() === 'atl03sp' && (atl03ColorMapStore.getAtl03ColorKey() == 'atl08_class')"
            @selectionChanged="atl08ClassColorChanged"
            @defaultsChanged="atl08ClassColorChanged"
        />
    </div>
    <div class="sr-select-yapc-color-map">
        <SrMenuInput 
            v-if = "atlChartFilterStore.getFunc() === 'atl03sp'&& (atl03ColorMapStore.getAtl03ColorKey() == 'YAPC')"
            label="YAPC Color Map" 
            :menuOptions="getColorMapOptions()" 
            @update:modelValue="alt03YAPCColorMapChanged"
            v-model="atlChartFilterStore.selectedAtl03YapcColorMap"
            tooltipText="YAPC Color Map for atl03 scatter plot"
        />
    </div>
</div>
<div class="sr-select-symbol-size">
    <SrSliderInput
        v-if = "atlChartFilterStore.getFunc() === 'atl03sp'"
        v-model="atlChartFilterStore.atl03spSymbolSize"
        @update:model-value="symbolSizeSelection"
        label="Atl03sp Scatter Plot symbol size"
        :min="1"
        :max="20"
        :defaultValue="atlChartFilterStore.atl03spSymbolSize"
        :decimalPlaces=0
        tooltipText="Symbol size for Atl03 Scatter Plot"
    />
    <SrSliderInput
        v-if = "atlChartFilterStore.getFunc() === 'atl03vp'"
        v-model="atlChartFilterStore.atl03spSymbolSize"
        @update:model-value="symbolSizeSelection"
        label="Atl03vp Scatter Plot symbol size"
        :min="5"
        :max="20"
        :defaultValue="atlChartFilterStore.atl03spSymbolSize"
        :decimalPlaces=0
        tooltipText="Symbol size for Atl03 Scatter Plot"
    />
    <SrSliderInput
        v-if = "atlChartFilterStore.getFunc().includes('atl06')"
        v-model="atlChartFilterStore.atl06SymbolSize"
        @update:model-value="symbolSizeSelection"
        label="Atl06 Scatter Plot symbol size"
        :min="1"
        :max="20"
        :defaultValue="atlChartFilterStore.atl06SymbolSize"
        :decimalPlaces=0
        tooltipText="Symbol size for Atl06 Scatter Plot"
    />
    <SrSliderInput
        v-if = "atlChartFilterStore.getFunc().includes('atl08')"
        v-model="atlChartFilterStore.atl08SymbolSize"
        @update:model-value="symbolSizeSelection"
        label="Atl08 Scatter Plot symbol size"
        :min="1"
        :max="20"
        :defaultValue="atlChartFilterStore.atl08SymbolSize"
        :decimalPlaces=0
        tooltipText="Symbol size for Atl08 Scatter Plot"
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