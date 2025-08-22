<template>
    <SrCustomTooltip ref="tooltipRef" id="yatcTooltip"/>
    <div class="sr-y-atc-panel" 
        @mouseover="tooltipRef.showTooltip('Used to increase/decrease width of coverage and filter in/out off pointed tracks from different cycles')"
        @mouseleave="tooltipRef.hideTooltip()"
    >
        <label class="sr-label-simple_yatc" for="width">Width of Coverage (meters):</label>
        <InputNumber 
            v-model="widthOfCoverage"
            id="width-of-coverage"
            class="sr-yatc-number"
            size="small"
            :minFractionDigits="1"
            :min="0.001"
            :max="10000"
            :step="1.000"
            showButtons
            @update:modelValue="handleModelValueChange"
        ></InputNumber>
    </div>
</template>

<script setup lang="ts">
import InputNumber from 'primevue/inputnumber';
import { setCyclesGtsSpotsFromFileUsingRgtYatc } from "@/utils/SrMapUtils";
import SrCustomTooltip from '@/components/SrCustomTooltip.vue';
import { useGlobalChartStore } from '@/stores/globalChartStore';
import { updatePlotAndSelectedTrackMapLayer } from "@/utils/plotUtils";
import { ref } from 'vue';

const globalChartStore = useGlobalChartStore();
const tooltipRef = ref();
const widthOfCoverage = ref<number>(globalChartStore.y_atc_margin*2);



async function handleModelValueChange(value: number) {
    console.log('SrSimpleYatcFilterCntrl handleValueChange:', value);
    globalChartStore.y_atc_margin = value/2;
    if(!value) {
        console.warn('SrSimpleYatcFilterCntrl handleValueChange: value is undefined:', value);
    }
    await setCyclesGtsSpotsFromFileUsingRgtYatc();
    await updatePlotAndSelectedTrackMapLayer("SrSimpleYatcCntrl");// no need to debounce
}

</script>

<style scoped>

.sr-checkbox-item{
    display: flex;
    align-items: center;
    justify-content: center;
    row-gap: 0.5rem; 
    column-gap: 0.25rem;
    margin: 0.25rem;
}

.sr-y-atc-panel{
    display: flex;
    flex-direction: column;
    justify-content:center;
    align-items:center;
    margin: 0.25rem;
    padding: 0.25rem;
    width: auto;
    white-space: nowrap; /* Prevents text from wrapping */
    overflow: hidden; /* Hides overflow */
    text-overflow: ellipsis; /* Adds an ellipsis if the text overflows */
}

.sr-label-simple_yatc{
    font-size: small;
    margin:auto;
}

.sr-yatc-min-selected-max{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items:flex-end;
    margin: 0.25rem;
    padding: 0.25rem;
    width: auto;
    white-space: nowrap; /* Prevents text from wrapping */
    overflow: hidden; /* Hides overflow */
    text-overflow: ellipsis; /* Adds an ellipsis if the text overflows */
}

:deep(.sr-yatc-number) {
    width: auto; /* Ensure the input adjusts to fit its content */
    min-width: 4rem; /* Optional: Set a minimum width for usability */
}
</style>