<script setup lang="ts">
import Fieldset from "primevue/fieldset";
import MultiSelect from "primevue/multiselect";
import FloatLabel from "primevue/floatlabel";
import { callPlotUpdateDebounced } from "@/utils/plotUtils";
import { useChartStore } from '@/stores/chartStore';
import { onMounted, computed } from "vue";
import SrCheckbox from "./SrCheckbox.vue";
import { yDataBindingsReactive,findReqMenuLabel,showYDataMenuReactive } from "@/utils/plotUtils";
import { useRecTreeStore } from "@/stores/recTreeStore";

const recTreeStore = useRecTreeStore();

// Define props with TypeScript types
const props = withDefaults(
    defineProps<{
        reqId: number;
        isOverlay?: boolean;
    }>(),
    {
        reqId: 0,
        isOverlay: false,
    }
);

const computedReqIdStr = computed(() => {
    return props.reqId.toString();
});

const computedFunc = computed(() => {
    return recTreeStore.findApiForReqId(props.reqId);
});

const computedLabel = computed(() => {
  return `Plot Configuration for ${props.reqId} - ${computedFunc.value}`;
});

const computedElId = computed(() => {
    return `srYdataItems-${props.reqId}`;
});

const computedMainLabel = computed(() => {
    return `Available data options for ${findReqMenuLabel(props.reqId)}`;
});

async function onMainYDataSelectionChange(newValue: string[]) {
    console.log("Main Y Data changed:", newValue);
    await callPlotUpdateDebounced('from onMainYDataSelectionChange');
}

onMounted(() => {
    //console.log('SrScatterPlotConfig onMounted props.reqId:', props.reqId);
    //console.log('SrScatterPlotConfig onMounted computedReqIdStr:', computedReqIdStr.value);
});


</script>
<template>
<Fieldset   
    class="sr-scatter-plot-options" 
    :legend="computedLabel" 
    :toggleable="true" 
    :collapsed="true"
>
    <div class="sr-select-Ydata-options">
        <FloatLabel >
            <MultiSelect class="sr-multiselect"
                :placeholder="`${computedMainLabel}`"
                :id="`srYdataItems-${reqId}`"
                v-model="yDataBindingsReactive[computedReqIdStr]"
                size="small" 
                :options="useChartStore().getElevationDataOptions(computedReqIdStr)"
                display="chip"
                @update:modelValue="onMainYDataSelectionChange"
            />
            <label :for=computedElId>{{`${computedMainLabel}`}}</label>
        </FloatLabel>
        <SrCheckbox
            v-if="(!props.isOverlay)" 
            class="sr-show-hide-ydata"
            :defaultValue="false"
            label="Show Y Data menu"
            labelFontSize="small"
            tooltipText="Show or hide the Y Data selection in plot control"
            v-model="showYDataMenuReactive[computedReqIdStr]"
            size="small" 
        />              
    </div>

</Fieldset>

</template>
<style scoped>

.sr-multiselect {
  width: 100%;
  max-width: 100%;
  /* no fit-content here */
  display: flex;
  flex-wrap: wrap;

  :deep(.p-multiselect-label-container) {
    display: flex;
    flex-wrap: wrap;
    max-height: 8rem;       /* optional vertical limit */
    overflow-y: auto;       /* scroll if too many chips */
    overflow-x: auto; 
    box-sizing: border-box;
  }
}

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

.sr-select-Ydata-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.5rem;
    margin-top: 1.0rem;
    margin-bottom: 0.25rem;
    width: 100%;
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