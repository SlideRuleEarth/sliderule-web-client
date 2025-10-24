<script setup lang="ts">
import Fieldset from "primevue/fieldset";
import MultiSelect from "primevue/multiselect";
import FloatLabel from "primevue/floatlabel";
import Select from "primevue/select";
import type { SelectChangeEvent } from "primevue/select";
import { refreshScatterPlot, callPlotUpdateDebounced } from "@/utils/plotUtils";
import { useChartStore } from '@/stores/chartStore';
import { onMounted, computed, watch } from "vue";
import SrCheckbox from "./SrCheckbox.vue";
import { yDataBindingsReactive,findReqMenuLabel,showYDataMenuReactive,useGlobalMinMaxReactive } from "@/utils/plotUtils";
import { useRecTreeStore } from "@/stores/recTreeStore";
import { useGlobalChartStore } from "@/stores/globalChartStore";
import { useRequestsStore } from "@/stores/requestsStore";
import { useFieldNameStore } from "@/stores/fieldNameStore";
import { useToast } from "primevue";
import { useActiveTabStore } from "@/stores/activeTabStore";
import { useDeck3DConfigStore } from '@/stores/deck3DConfigStore';
import { loadAndCachePointCloudData } from '@/utils/deck3DPlotUtils';
import { renderCachedData } from '@/utils/deck3DPlotUtils';
import { useSrcIdTblStore } from "@/stores/srcIdTblStore";
import { createLogger } from '@/utils/logger';

const logger = createLogger('SrPlotConfig');
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
    if (!recTreeStore.isTreeLoaded) return '';
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


async function onMainYDataSelectionChange(_newValue: string[]) {
    logger.debug('Main Y Data changed', { newValue: _newValue });
    await callPlotUpdateDebounced('from onMainYDataSelectionChange');
}

async function onUseSelectedMinMaxChange(_newValue: string[]) {
    logger.debug('Use Selected MinMax changed', { newValue: _newValue });
    await callPlotUpdateDebounced('from onUseSelectedMinMaxChange');
}

async function onUsePercentileRangeChange(_newValue: boolean) {
    logger.debug('Use Percentile Range changed', { newValue: _newValue });
    await callPlotUpdateDebounced('from onUsePercentileRangeChange');
}

async function handleGediFieldNameChange(event: SelectChangeEvent) {
    logger.debug('Gedi El Data changed', { value: event.value });
    if(activeTabStore.isActiveTabLabel('3-D View')){
        await callPlotUpdateDebounced('from handleGediFieldNameChange');
        await loadAndCachePointCloudData(props.reqId);
        renderCachedData(deckContainer);
    } else if(activeTabStore.isActiveTabLabel('Elevation Plot')) {
        await callPlotUpdateDebounced('from handleGediFieldNameChange');
    }
}

async function enableLocationFinder(): Promise<void> {
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

    // Get the actual columns available in the file (elevationDataOptions contains the actual file columns)
    const availableColumns = chartStore.getElevationDataOptions(reqIdStr);

    // Only add lat/lon if they exist as actual columns in the file (regular parquet)
    // For geoparquet, they're extracted from geometry column and don't need to be in yDataOptions
    const newFields = [latField, lonField].filter(
        field => !currentYData.includes(field) && availableColumns.includes(field)
    );

    if (newFields.length > 0) {
        logger.debug('enableLocationFinder: Adding fields to yDataOptions', { newFields, reason: 'they exist as separate columns in file' });
        chartStore.setYDataOptions(reqIdStr, [...currentYData, ...newFields]);
        await refreshScatterPlot('enabled Link to Elevation Plot');
    } else if ([latField, lonField].some(field => !availableColumns.includes(field))) {
        logger.debug('enableLocationFinder: Skipping lat/lon', { reason: "they don't exist as separate columns (likely geoparquet with geometry column)" });
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
    void enableLocationFinder();
});

// Wait for tree to load before accessing API info
watch(() => recTreeStore.isTreeLoaded, (loaded) => {
    if (!loaded) return;

    const api = recTreeStore.findApiForReqId(props.reqId);
    logger.debug('Tree loaded, initializing', { api, reqId: props.reqId });
    if(api.includes('x')) {
        // This sets the source table for the given request ID so tooltip uses granule name
        srcIdTblStore.getUniqueSourceCount(props.reqId);
    }
}, { immediate: true });



watch(() => globalChartStore.enableLocationFinder, (newVal, oldValue) => {
    if (!oldValue && newVal) {
        //console.log('SrPlotConfig watch enableLocationFinder:', newVal);
        void enableLocationFinder();
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
            class="sr-checkbox-style"
            :defaultValue="false"
            label="Use global min/max for gradient legend (vice selected trk's min/max)"
            labelFontSize="small"
            tooltipText="Use the global min/max for legend instead of the selected min/max"
            v-model="useGlobalMinMaxReactive[computedReqIdStr]"
            size="small" 
            @update:modelValue="onUseSelectedMinMaxChange"

        />
        <SrCheckbox
            v-if="(!props.isOverlay && !activeTabStore.isActiveTabLabel('Time Series'))" 
            class="sr-checkbox-style"
            :defaultValue="false"
            label="Use Percentile Range vice full range for legend (low/high vs min/max)"
            labelFontSize="small"
            v-model="globalChartStore.usePercentileRange"
            tooltipText="Use Percentile Range: Filtered(low/high) vs Full(min/max)"
            size="small"
            @update:modelValue="onUsePercentileRangeChange"

        />
        <div class="sr-ged02ap-el-select" v-if="recTreeStore.selectedApi == 'gedi02ap'">
            <label class="sr-ged02ap-elevation-label" :for="`sr-ged02ap-elevation-field-select`">Gedi02a Elevation to use</label> 
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