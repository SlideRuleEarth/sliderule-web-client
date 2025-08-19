<template>
    <Fieldset :legend="computedLabel">
        <div class="sr-fieldset-box">
            <div class="sr-num-of-pnts" v-if="props.isOverlay">
               <Chip>Photon Cloud</Chip>
            </div>
            <div class="sr-num-of-pnts">
            </div>
            <div class="sr-ydata-menu" v-if="showYDataMenuReactive[reqIdStr]">
                <label class="sr-y-data-label":for="`srYdataItems-overlayed-${reqIdStr}`">Y Data</label> 
                <Select 
                    class="sr-select-ydata"
                    v-model="yDataSelectedReactive[reqIdStr]"
                    :options="chartStore.getYDataOptions(reqIdStr)"
                    @change="handleYDataSelectionChange"
                    placeholder="Select Y data"
                    :id="`srYdataItems-overlayed-${reqIdStr}`"
                    size="small"
                >
                </Select> 
            </div>
            <div class="sr-ydata-menu">
                <div>
                    <label class="sr-y-data-label":for="`srYColEncode-overlayed-${reqIdStr}`">Point Color</label>
                    <OverlayBadge  :value="computedNumOfPnts" size="small">
                    <Select
                        class="sr-select-col-encode-data"
                        v-model="yColorEncodeSelectedReactive[reqIdStr]"
                        :options="chartStore.getColorEncodeOptionsForFunc(reqIdStr,computedFunc)"
                        @change="handleColorEncodeSelectionChange"
                        placeholder="Encode Color with"
                        :id="`srYColEncode-overlayed-${reqIdStr}`"
                        size="small"
                    >
                    </Select>
                    </OverlayBadge>
                </div>
                <div class="sr-legend-panel">
                    <SrAtl03ColorLegend
                        reqIdStr="reqIdStr" 
                        v-if="shouldDisplayAtl03ColorLegend" 
                        @restore-atl03-color-defaults-click="restoreAtl03DefaultColorsAndUpdatePlot" 
                        @atl03-cnf-color-changed="handleAtl03CnfColorChanged"
                    />
                    <SrAtl08ColorLegend 
                        reqIdStr="reqIdStr"
                        v-if="shouldDisplayAtl08ColorLegend"
                        @restore-atl08-color-defaults-click="restoreAtl08DefaultColorsAndUpdatePlot" 
                        @atl08-class-color-changed="handleAtl08ClassColorChanged" 
                    />
                    <SrAtl24ColorLegend 
                        reqIdStr="reqIdStr"
                        v-if="shouldDisplayAtl24ColorLegend"
                        @restore-atl24-color-defaults-click="restoreAtl24DefaultColorsAndUpdatePlot" 
                        @atl24-class-color-changed="handleAtl24ClassColorChanged" 
                    />

                    <SrGradientLegendCntrl 
                        v-if="shouldDisplayGradientColorLegend"
                        :label="gradientLabel"
                        :req_id="props.reqId"
                        :data_key="chartStore.getSelectedColorEncodeData(reqIdStr)"
                        @gradient-color-map-changed="gradientColorMapChanged" 
                        @restore-gradient-color-defaults-click="gradientDefaultColorMapRestored"
                        @gradient-num-shades-changed="gradientNumShadesChanged"
                    />
                </div>
                <div class="sr-solid-color-selection-panel" v-if="(chartStore.getSelectedColorEncodeData(reqIdStr)==='solid')" >
                    <label class="sr-solid-color-menu-label":for="computedSolidColorId">Solid Color</label> 
                    <div class="sr-solid-color-panel">
                        <Select
                            class="sr-select-solid-color"
                            v-model="solidColorSelectedReactive[reqIdStr]"
                            :options="colorMapStore.namedColorPalette"
                            placeholder="Symbol Color"
                            :id="computedSolidColorId"
                            size="small" 
                        >
                        </Select>
                        <div class="sr-solid-color-preview" :style="{ backgroundColor: computedSolidSymbolColor }"></div>
                    </div>
                </div>
            </div>
        </div>
        <div>
            <SrSymbolSize
                :reqIdStr="reqIdStr"
            />
        </div>
        <div>
            <SrRecIdReqDisplay 
                :reqId="props.reqId"
                label="Request Parameters"
                :tooltipText="reqParamsToolTipText"
                
            />
        </div>
        <div class="sr-export-panel">
            <SrExportSelected
                :reqId="props.reqId"
            />
        </div>
        <div class="sr-sql-stmnt">
            <SrSqlStmnt 
                :reqId="props.reqId"
                :label="`Sql statement`"
                :tooltipText="sqlStmntToolTipText"
            />
        </div>
        <div class="sr-npnts">
            <p>  {{ computedNumOfPnts }} Points</p>
        </div>
    </Fieldset>
</template>
  
<script setup lang="ts">
import { useChartStore } from '@/stores/chartStore';
import SrSymbolSize from '@/components/SrSymbolSize.vue';
import Select  from 'primevue/select';
import Fieldset  from 'primevue/fieldset';
import Chip from 'primevue/chip';
import { OverlayBadge } from 'primevue';
import { useColorMapStore } from '@/stores/colorMapStore';
import { useAtl03CnfColorMapStore } from '@/stores/atl03CnfColorMapStore';
import { useAtl08ClassColorMapStore } from '@/stores/atl08ClassColorMapStore';
import { useAtl24ClassColorMapStore } from '@/stores/atl24ClassColorMapStore';
import { initDataBindingsToChartStore, yDataSelectedReactive, yColorEncodeSelectedReactive, solidColorSelectedReactive, initializeColorEncoding, showYDataMenuReactive } from '@/utils/plotUtils';
import { computed, onMounted, ref } from 'vue';
import { callPlotUpdateDebounced } from "@/utils/plotUtils";
import SrAtl03ColorLegend from '@/components/SrAtl03ColorLegend.vue';
import SrAtl08ColorLegend from '@/components/SrAtl08ColorLegend.vue';
import SrAtl24ColorLegend from '@/components/SrAtl24ColorLegend.vue';
import SrGradientLegendCntrl from '@/components/SrGradientLegendCntrl.vue';
import SrRecIdReqDisplay from "./SrRecIdReqDisplay.vue";
import SrSqlStmnt from "@/components/SrSqlStmnt.vue";
import { useRecTreeStore } from '@/stores/recTreeStore';
import type { SelectChangeEvent } from 'primevue/select';
import { useActiveTabStore } from '@/stores/activeTabStore';
import { useFieldNameStore } from '@/stores/fieldNameStore';
import { useToast } from 'primevue/usetoast';
import SrExportSelected from './SrExportSelected.vue';

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
let atl03CnfColorMapStore: any;
const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const chartStore = useChartStore();
const colorMapStore = useColorMapStore();
const atl08ClassColorMapStore = ref<any>(null);
const atl24ClassColorMapStore = ref<any>(null);
const recTreeStore = useRecTreeStore();
const activeTabStore = useActiveTabStore();
const fieldNameStore = useFieldNameStore();
const toast = useToast();
const reqIdStr = computed(() => props.reqId.toString());
const computedFunc = computed(() => recTreeStore.findApiForReqId(props.reqId));
const computedSolidColorId = computed(() => `srSolidColorItems-${reqIdStr.value}`);
const computedSolidSymbolColor = computed(() => {
    return chartStore.getSolidSymbolColor(reqIdStr.value);
});
const computedLabel = computed(() => {
    let label = `${props.reqId} - ${computedFunc.value}`;
    return `${label}`;
});
const computedNumOfPnts = computed(() => {
    return `${numberFormatter.format(chartStore.getNumOfPlottedPnts(reqIdStr.value))}`
});


const shouldDisplayGradientColorLegend = computed(() => {
    const func = recTreeStore.findApiForReqId(props.reqId);
    const selectedColorEncodeData = chartStore.getSelectedColorEncodeData(reqIdStr.value);
    let should = false;
    if(selectedColorEncodeData && (selectedColorEncodeData !== 'unset')){
        if(func.includes('atl03')){
            if(selectedColorEncodeData !== 'atl08_class' && selectedColorEncodeData !== 'atl24_class' && selectedColorEncodeData !== 'atl03_cnf'){
                should = true;
            }
        } else if(func.includes('atl06') || func.includes('atl08') || func.includes('atl24')){
            if(selectedColorEncodeData !== 'solid'){
                should = true;
            }
        }
    }
    //console.log('func',func, 'selectedColorEncodeData:',selectedColorEncodeData,' computed: shouldDisplayGradientColorLegend:', should);
    return should;
});

const gradientLabel = computed(() => {
    return `${chartStore.getSelectedColorEncodeData(reqIdStr.value)} colors`;
});

const shouldDisplayAtl03ColorLegend = computed(() => {
    const func = recTreeStore.findApiForReqId(props.reqId);
    const selectedColorEncodeData = chartStore.getSelectedColorEncodeData(reqIdStr.value);
    let should = false;
    if(func.includes('atl03') && selectedColorEncodeData === 'atl03_cnf'){
        should = true;
    }
    //console.log('func',func, 'selectedColorEncodeData:',selectedColorEncodeData,' computed: shouldDisplayAtl03ColorLegend:', should);
    return should;
});

const shouldDisplayAtl08ColorLegend = computed(() => {
    const func = recTreeStore.findApiForReqId(props.reqId);
    const selectedColorEncodeData = chartStore.getSelectedColorEncodeData(reqIdStr.value);
    let should = false;
    if(func.includes('atl03') && selectedColorEncodeData === 'atl08_class'){
        should = true;
    }
    //console.log('func',func, 'selectedColorEncodeData:',selectedColorEncodeData,' computed: shouldDisplayAtl08ColorLegend:', should);
    return should;
});


const shouldDisplayAtl24ColorLegend = computed(() => {
    const func = recTreeStore.findApiForReqId(props.reqId);
    const selectedColorEncodeData = chartStore.getSelectedColorEncodeData(reqIdStr.value);
    let should = false;
    if(func.includes('atl03') && selectedColorEncodeData === 'atl24_class'){
        should = true;
    }
    //console.log('func',func, 'selectedColorEncodeData:',selectedColorEncodeData,' computed: shouldDisplayAtl08ColorLegend:', should);
    return should;
});


const isTimeSeries = computed(() => {
    if(activeTabStore.activeTabLabel === 'Time Series'){
        return true;
    } else {
        return false;
    }
});

onMounted(async () => {
    atl03CnfColorMapStore = await useAtl03CnfColorMapStore(props.reqId.toString());
    atl08ClassColorMapStore.value = await useAtl08ClassColorMapStore(props.reqId.toString());
    atl24ClassColorMapStore.value = await useAtl24ClassColorMapStore(props.reqId.toString());
    initDataBindingsToChartStore([reqIdStr.value]);
    let parentFuncStr;
    if(props.isOverlay){
        // selected reqId is parent
        parentFuncStr = recTreeStore.findApiForReqId(recTreeStore.selectedReqId);
    }
    initializeColorEncoding(props.reqId,parentFuncStr);
    //console.log('computedFunc:', computedFunc.value);
    if(isTimeSeries.value){
        chartStore.setSelectedColorEncodeData(reqIdStr.value, 'cycle')
    }
});

async function restoreAtl03DefaultColorsAndUpdatePlot() {
    //console.log('restoreAtl03DefaultColorsAndUpdatePlot');
    await atl03CnfColorMapStore.restoreDefaultAtl03CnfColorMap();
    await callPlotUpdateDebounced('from restoreAtl03DefaultColorsAndUpdatePlot');
}

async function restoreAtl08DefaultColorsAndUpdatePlot() {
    //console.log('restoreAtl08DefaultColorsAndUpdatePlot');
    await atl08ClassColorMapStore.value?.restoreDefaultAtl08ClassColorMap();
    await callPlotUpdateDebounced('from restoreAtl08DefaultColorsAndUpdatePlot');
}

async function restoreAtl24DefaultColorsAndUpdatePlot() {
    //console.log('restoreAtl08DefaultColorsAndUpdatePlot');
    await atl24ClassColorMapStore.value?.restoreDefaultAtl24ClassColorMap();
    await callPlotUpdateDebounced('from restoreAtl24DefaultColorsAndUpdatePlot');
}

async function gradientDefaultColorMapRestored() {
    console.log('gradientDefaultColorMapRestored');
    await callPlotUpdateDebounced('from gradientDefaultColorMapRestored');
}

async function gradientColorMapChanged() {
    console.log('gradientColorMapChanged');
    await callPlotUpdateDebounced('from gradientColorMapChanged');
}

async function gradientNumShadesChanged() {
    console.log('gradientNumShadesChanged');
    await callPlotUpdateDebounced('from gradientNumShadesChanged');
}

const reqParamsToolTipText = computed(() => {
    if(props.isOverlay){
        return `These were the params used to create the record ${props.reqId} for the overlayed scatter plot above`;
    } else {
        return `These were the params used to create the record ${props.reqId} for the elevation map in the upper left corner and the scatter plot above`;
    }
});
const sqlStmntToolTipText = computed(() => {
    return `This is the Sql statement used to create (the record ${props.reqId} portion of) the scatter plot above`;    
});

// const handleSymbolSizeUpdate = async (newSymbolSize: number) => {
//     console.log(`Updated symbol size for ${props.reqId}:`, newSymbolSize);
//     await callPlotUpdateDebounced('handleSymbolSizeUpdate');
// };

const handleYDataSelectionChange = async (event: SelectChangeEvent) => {
    const newValue = event.value as string[]; // Extract the selected value
    console.log("Y Data changed:", newValue);
    await callPlotUpdateDebounced('from handleYDataSelectionChange');
};

const handleColorEncodeSelectionChange = async (event: SelectChangeEvent) => {
    const newValue = event.value as string; // Extract the selected value
    console.log("Color Encode changed:", newValue);
    if(newValue === fieldNameStore.getHFieldName(props.reqId)){
        chartStore.setUseSelectedMinMax(reqIdStr.value, false);
        toast.add({ severity: 'info', summary: `Using ${newValue} MinMax of entire Record`, detail: `the Plot Config is now set to use legend with Min Max of ${newValue} using the entire Record`, life: 5000 });
    } else {
        if(newValue !== 'solid'){
            chartStore.setUseSelectedMinMax(reqIdStr.value, true);
            toast.add({ severity: 'info', summary: `Using ${newValue} MinMax of selected Track`, detail: `the Plot Config is now set to use legend with Min Max of ${newValue} using only the selected track`, life: 5000 });
        }
    }
    await callPlotUpdateDebounced('from handleColorEncodeSelectionChange');
};

const handleAtl03CnfColorChanged = async () => {
    console.log('handleAtl03CnfColorChanged');
    atl03CnfColorMapStore.resetColorCache();
    await callPlotUpdateDebounced('from handleAtl03CnfColorChanged');
};

const handleAtl08ClassColorChanged = async () => {
    console.log('handleAtl08ClassColorChanged');
    atl08ClassColorMapStore.value?.resetAtl08ClassColorCaches();
    await callPlotUpdateDebounced('from handleAtl08ClassColorChanged');
};

const handleAtl24ClassColorChanged = async () => {
    console.log('handleAtl24ClassColorChanged');
    atl24ClassColorMapStore.value?.resetAtl24ClassColorCaches();
    await callPlotUpdateDebounced('from handleAtl24ClassColorChanged');
};

</script>
  
<style scoped>

.sr-ydata-menu {
    display: inline-flex; /* Allow the container to shrink-wrap its content */
    flex-direction: column;
    justify-content: center;
    align-items: flex-start; /* Align content to the left */
    width: auto; /* Let the container size itself based on the content */
    padding: 0.5rem; /* Optional: Add some padding for spacing */
}
.sr-num-of-pnts {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: row;
    font-size: large;
    font-weight: bold;
    margin-bottom: 0rem;
    padding: 0rem; /* Optional: Add some padding for spacing */
}

.sr-y-data-label {
    margin: 0;
    font-size: small;
}

.sr-select-ydata {
    width: 100%;
    margin: 0rem;
}

.sr-select-col-encode-data{
    width: 100%;
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
}

.sr-select-y-data {
    width: 100%;
    margin: 0rem;
    margin-bottom: 0.25rem;
}

.sr-y-data-label:hover {
    color: #007bff; /* Accent color */
}

.sr-solid-color-menu {
    display: flex;
    flex-direction: row;
    align-items: center;

}

.sr-solid-color-menu-label-container {
    margin: 0;
    font-size: small;
    align-items: left;
}

.sr-solid-color-menu-label {
    margin: 0;
    margin-bottom: 0.25rem;
    font-size: small;
}

.sr-solid-color-selection-panel {
    display: flex;
    flex-direction: column;
    justify-content:left;
    margin-top:1.0rem;
}

.sr-solid-color-panel {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
}
.sr-select-solid-color{
    width: 100%;
    margin-bottom: 0.25rem;
}

.sr-solid-color-preview {
    width: 1rem;
    height: 1rem;
    border: 1px solid var(--p-border-color);
    border-radius: 2px;
    margin-left:0.25rem;
}
:deep(.p-fieldset-legend) {
    white-space: pre-line; /* This allows \n to work as a line break */
}
.sr-npnts {
    font-size: small;
}
</style>
  