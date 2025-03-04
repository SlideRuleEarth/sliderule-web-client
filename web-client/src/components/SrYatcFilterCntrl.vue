<template>
    <SrCustomTooltip ref="tooltipRef"/>
    <div class="sr-y-atc-panel" 
        @mouseover="tooltipRef.showTooltip($event, toolTipStr)"
        @mouseleave="tooltipRef.hideTooltip"
    >
        <div class="sr-checkbox-item">
            <label>y_atc</label>
            <Checkbox 
                binary 
                v-model="globalChartStore.use_y_atc_filter" 
                size="small"
                @update:model-value="handleModelValueChange"
                :disabled="!y_atc_is_selected"  
            />
        </div>
        <InputNumber 
            v-model="globalChartStore.y_atc_margin"
            class="sr-yatc-number"
            size="small"
            :minFractionDigits="1"
            :min="0.001"
            :max="9999"
            :step="1.000"
            showButtons
            :disabled="!computedUseYAtcFilter" 
            @update:modelValue="handleModelValueChange"
        ></InputNumber>
        <div class="sr-yatc-min-selected-max" v-if="(y_atc_is_selected)">
            <span>y_atc: {{ globalChartStore.selected_y_atc?.toFixed(3) }}</span>
            <span>y_atc_min: {{ computedMaxYAtc.toFixed(3) }}</span>
            <span>y_atc_max: {{ computedMinYAtc.toFixed(3) }}</span>    
        </div>
    </div>
</template>

<script setup lang="ts">
import Checkbox from 'primevue/checkbox';
import InputNumber from 'primevue/inputnumber';
import { filterByAtc } from "@/utils/SrMapUtils";
import SrCustomTooltip from '@/components/SrCustomTooltip.vue';
import { useGlobalChartStore } from '@/stores/globalChartStore';
import { updatePlotAndSelectedTrackMapLayer } from "@/utils/plotUtils";
import { ref, computed } from 'vue';

const globalChartStore = useGlobalChartStore();
const tooltipRef = ref();

const y_atc_is_selected = computed(() => {
    return ((globalChartStore.selected_y_atc != undefined) && (globalChartStore.selected_y_atc != null) && (!isNaN(globalChartStore.selected_y_atc)));
});

const computedUseYAtcFilter = computed(() => {
    return (y_atc_is_selected && globalChartStore.use_y_atc_filter);
});

const computedMaxYAtc = computed(() => {
    return globalChartStore.selected_y_atc + globalChartStore.y_atc_margin;
});

const computedMinYAtc = computed(() => {
    return globalChartStore.selected_y_atc - globalChartStore.y_atc_margin;
});

const toolTipStr = computed(() => {
    const ttstr = globalChartStore.selected_y_atc === undefined? 'Click on a track to enable this, it is used to filter out off pointed tracks from different cycles' : 'Used to filter out off pointed tracks from different cycles';
    console.log('toolTipStr:',ttstr);
    return ttstr;
});

async function handleModelValueChange(value: number) {
    console.log('SrYatcFilterCntrl handleValueChange:', value);
    if(!value) {
        console.log('SrYatcFilterCntrl handleValueChange: value is undefined:', value);
    }
    await filterByAtc();
    await updatePlotAndSelectedTrackMapLayer("SrYatcFilterCntrl");// no need to debounce
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