<script setup lang="ts">
import Fieldset from "primevue/fieldset";
import MultiSelect from "primevue/multiselect";
import FloatLabel from "primevue/floatlabel";
import { callPlotUpdateDebounced } from "@/utils/plotUtils";
import { useChartStore } from '@/stores/chartStore';
import { onMounted, computed } from "vue";
import { yDataBindingsReactive,findReqMenuLabel } from "@/utils/plotUtils";

const chartStore = useChartStore();


// Define props with TypeScript types
const props = defineProps<{
  req_id: number;
}>();

const computedReqIdStr = computed(() => {
    return props.req_id.toString();
});

const computedFunc = computed(() => {
    return chartStore.getFunc(props.req_id.toString());
});

const computedLabel = computed(() => {
  return `Plot Configuration for ${props.req_id} - ${computedFunc.value}`;
});

const computedElId = computed(() => {
    return `srYdataItems-${props.req_id}`;
});

const computedMainLabel = computed(() => {
    return `Available Y data options for ${findReqMenuLabel(props.req_id)}`;
});

async function onMainYDataSelectionChange(newValue: string[]) {
    console.log("Main Y Data changed:", newValue);
    await callPlotUpdateDebounced('from onMainYDataSelectionChange');
}

onMounted(() => {
    console.log('SrScatterPlotOptions onMounted props.req_id:', props.req_id);
    console.log('SrScatterPlotOptions onMounted computedReqIdStr:', computedReqIdStr.value);
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
                :id="`srYdataItems-${req_id}`"
                v-model="yDataBindingsReactive[computedReqIdStr]"
                size="small" 
                :options="useChartStore().getElevationDataOptions(computedReqIdStr)"
                display="chip"
                @update:modelValue="onMainYDataSelectionChange"
            />
            <label :for=computedElId>{{`${computedMainLabel}`}}</label>
        </FloatLabel>
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