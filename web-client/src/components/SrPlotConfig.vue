<script setup lang="ts">
import Fieldset from "primevue/fieldset";
import MultiSelect from "primevue/multiselect";
import FloatLabel from "primevue/floatlabel";
import Select from "primevue/select";
import type { SelectChangeEvent } from "primevue/select";
import { refreshScatterPlot, updatePlotAndSelectedTrackMapLayer } from "@/utils/plotUtils";
import { useChartStore } from '@/stores/chartStore';
import { onMounted, computed, watch } from "vue";
import SrCheckbox from "./SrCheckbox.vue";
import { yDataBindingsReactive,findReqMenuLabel,showYDataMenuReactive,showUseSelectedMinMaxReactive } from "@/utils/plotUtils";
import { useRecTreeStore } from "@/stores/recTreeStore";
import { useGlobalChartStore } from "@/stores/globalChartStore";
import { useRequestsStore } from "@/stores/requestsStore";
import { useFieldNameStore } from "@/stores/fieldNameStore";
import { useToast } from "primevue";
import { useActiveTabStore } from "@/stores/activeTabStore";
import { useDeck3DConfigStore } from '@/stores/deck3DConfigStore';
import { loadAndCachePointCloudData } from '@/utils/deck3DPlotUtils';
import { renderCachedData } from '@/utils/deck3DPlotUtils';
import { updateMapAndPlot } from '@/utils/SrMapUtils';
import { useSrcIdTblStore } from "@/stores/srcIdTblStore";

const globalChartStore = useGlobalChartStore();
const requestsStore = useRequestsStore();
const recTreeStore = useRecTreeStore();
const toast = useToast();
const chartStore = useChartStore();
const fieldNameStore = useFieldNameStore();
const deck3DConfigStore = useDeck3DConfigStore();
const activeTabStore = useActiveTabStore();
const srcIdTblStore = useSrcIdTblStore();

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

const deckContainer = computed(() => deck3DConfigStore.deckContainer);


async function onMainYDataSelectionChange(newValue: string[]) {
    console.log("Main Y Data changed:", newValue);
    await updatePlotAndSelectedTrackMapLayer('from onMainYDataSelectionChange');
}

async function onUseSelectedMinMaxChange(newValue: string[]) {
    console.log("Main Y Data changed:", newValue);
    await updatePlotAndSelectedTrackMapLayer('from onUseSelectedMinMaxChange');
}


async function handleGediFieldNameChange(event: SelectChangeEvent) {
    console.log("Gedi El Data changed:", event.value);
    if(activeTabStore.isActiveTabLabel('3-D View')){
        await updateMapAndPlot(false);       
        await loadAndCachePointCloudData(props.reqId);
        renderCachedData(deckContainer);
    } else if(activeTabStore.isActiveTabLabel('Elevation Plot')) {
        await updatePlotAndSelectedTrackMapLayer('from handleGediFieldNameChange');
    }
}

async function enableLocationFinder() {
    const latField = fieldNameStore.getLatFieldName(props.reqId);
    const lonField = fieldNameStore.getLonFieldName(props.reqId);
    const selectedElRec = globalChartStore.getSelectedElevationRec();
    if(selectedElRec){
        // initialize to selected point on map then update later from plot tooltip formatter
        globalChartStore.locationFinderLat = selectedElRec[latField];
        globalChartStore.locationFinderLon = selectedElRec[lonField];    
    }
    const reqIdStr = props.reqId.toString();
    const currentYData = chartStore.getYDataOptions(reqIdStr);

    const newFields = [latField, lonField].filter(
        field => !currentYData.includes(field)
    );

    if (newFields.length > 0) {
        chartStore.setYDataOptions(reqIdStr, [...currentYData, ...newFields]);
        await refreshScatterPlot('enabled Link to Elevation Plot');
    }

    if (await requestsStore.needAdvice()) {
        toast.add({
            severity: 'info',
            summary: 'Link to Elevation Plot',
            detail: 'Click on a plot point to see where on the map it is.',
            life: 3000
        });
    }
}

onMounted(() => {
    //console.log('SrPlotConfig onMounted props.reqId:', props.reqId);
    //console.log('SrPlotConfig onMounted computedReqIdStr:', computedReqIdStr.value);
    enableLocationFinder();
    const api = recTreeStore.findApiForReqId(props.reqId);
    console.log('SrPlotConfig onMounted api:', api);
    if(api.includes('x')) {
        srcIdTblStore.setSourceTbl(props.reqId);
    }
});



watch(() => globalChartStore.enableLocationFinder, async (newVal, oldValue) => {
    if (!oldValue && newVal) {
        console.log('SrPlotConfig watch enableLocationFinder:', newVal);
        enableLocationFinder();
    }
});


</script>
<template>
<Fieldset   
    class="sr-scatter-plot-options" 
    :legend="computedLabel" 
    :toggleable="true" 
    :collapsed="true"
>
    <div class="sr-select-gedi02a-el-options">
        <FloatLabel >
            <MultiSelect class="sr-multiselect"
                :placeholder="`${computedMainLabel}`"
                :id="`srYdataItems-${reqId}`"
                v-model="yDataBindingsReactive[computedReqIdStr]"
                size="small" 
                :options="chartStore.getElevationDataOptions(computedReqIdStr)"
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
        <SrCheckbox
            v-if="(!props.isOverlay && !activeTabStore.isActiveTabLabel('Time Series'))" 
            class="sr-use-selected-min-max"
            :defaultValue="false"
            label="Use selected track min/max for gradient legend"
            labelFontSize="small"
            tooltipText="Use the selected track min/max for legend instead of the global min/max"
            v-model="showUseSelectedMinMaxReactive[computedReqIdStr]"
            size="small" 
            @update:modelValue="onUseSelectedMinMaxChange"

        />
        <div class="sr-ged02ap-el-select" v-if="recTreeStore.selectedApi == 'gedi02ap'">
            <label class="sr-ged02ap-elevation-label":for="`sr-ged02ap-elevation-field-select`">Gedi02a Elevation to use</label> 
            <Select 
                class="sr-ged02ap-elevation-field-select"
                v-model="fieldNameStore.curGedi2apElevationField"
                :options="fieldNameStore.curGedi2apElFieldOptions"
                @change="handleGediFieldNameChange"
                placeholder="Select Y data"
                :id="`srYdataItems-overlayed-${reqId}`"
                size="small"
            >
            </Select> 
        </div> 
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

.sr-select-gedi02a-el-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.5rem;
    margin-top: 1.0rem;
    margin-bottom: 0.25rem;
    width: 100%;
}

.sr-ged02ap-el-select {
    display: inline-flex; /* Allow the container to shrink-wrap its content */
    flex-direction: row;
    justify-content: left;
    align-items: center;
    gap: 0.5rem; /* Add spacing between elements */
    width: auto; /* Let the container size itself based on the content */
}

.sr-ged02ap-elevation-label {
    font-size: 0.875rem; /* Adjust the font size as needed */
    margin-bottom: 0.5rem; /* Add some space below the label */

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