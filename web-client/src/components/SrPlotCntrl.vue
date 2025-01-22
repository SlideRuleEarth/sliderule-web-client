<template>
    <Fieldset :legend="computedLabel">
        <div>
            <div class="sr-ydata-menu">
                <label class="sr-y-data-label":for="`srYdataItems-overlayed-${reqIdStr}`">Y Data</label> 
                <Select class="sr-select-ydata"
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
                    <label class="sr-y-data-label":for="`srYColEncode-overlayed-${reqIdStr}`">Color Encode</label>
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
                </div>
                <div class="sr-legend-panel">
                    <SrAtl03ColorLegend 
                        v-if="((chartStore.getSelectedColorEncodeData(reqIdStr) === 'atl03_cnf') && (chartStore.getFunc(reqIdStr) === 'atl03sp'))" 
                        @restore-atl03-color-defaults-click="restoreAtl03DefaultColorsAndUpdatePlot" 
                    />
                    <SrAtl08ColorLegend 
                        v-if="((chartStore.getSelectedColorEncodeData(reqIdStr) === 'atl08_class') && (chartStore.getFunc(reqIdStr) === 'atl03sp'))"
                        @restore-atl08-color-defaults-click="restoreAtl08DefaultColorsAndUpdatePlot"  
                    />
                    <SrYapcColorLegend 
                        v-if="((chartStore.getSelectedColorEncodeData(reqIdStr) === 'yapc_score') && (chartStore.getFunc(reqIdStr) === 'atl03sp'))"
                        :req_id="props.reqId" 
                        @restore-yapc-color-defaults-click="restoreYapcDefaultColorsAndUpdatePlot"
                    />
                </div>
                <div class="sr-ydata-menu" v-if="computedSymbolColorEncoding=='solid'" >
                    <label class="sr-y-data-label":for="computedSolidColorId">Color</label> 
                    <div class="sr-color-selection-panel">
                        <Select
                            v-model="solidColorSelectedReactive[reqIdStr]"
                            :options="atl03ColorMapStore.namedColorPalette"
                            placeholder="Symbol Color"
                            :id="computedSolidColorId"
                            size="small" 
                        >
                        </Select>
                        <div class="color-preview" :style="{ backgroundColor: computedSolidSymbolColor }"></div>
                    </div>
                </div>
            </div>
        </div>
        <div>
            <SrSymbolSize
                :reqIdStr="reqIdStr"
                @update:symbolSize="handleSymbolSizeUpdate"
            />
        </div>
        <div>
            <SrRecIdReqDisplay 
                :reqId="props.reqId"
                :label="`Show request parms for record:${props.reqId}`"
                :tooltipText="reqParamsToolTipText"
                
            />
        </div>
        <div class="sr-sql-stmnt">
            <SrSqlStmnt 
                :reqId="props.reqId"
                :label="`Show sql statement for record:${props.reqId}`"
                :tooltipText="sqlStmntToolTipText"
            />
        </div>
    </Fieldset>
</template>
  
<script setup lang="ts">
import { useChartStore } from '@/stores/chartStore';
import SrSymbolSize from '@/components/SrSymbolSize.vue';
import Select  from 'primevue/select';
import Fieldset  from 'primevue/fieldset';
import { useAtl03ColorMapStore } from '@/stores/atl03ColorMapStore';
import { initDataBindingsToChartStore, yDataSelectedReactive, yColorEncodeSelectedReactive, solidColorSelectedReactive, initializeColorEncoding } from '@/utils/plotUtils';
import { computed, onMounted } from 'vue';
import { callPlotUpdateDebounced } from "@/utils/plotUtils";
import SrAtl03ColorLegend from '@/components/SrAtl03ColorLegend.vue';
import SrAtl08ColorLegend from '@/components/SrAtl08ColorLegend.vue';
import SrYapcColorLegend from '@/components/SrYapcColorLegend.vue';
import SrRecIdReqDisplay from "./SrRecIdReqDisplay.vue";
import SrSqlStmnt from "@/components/SrSqlStmnt.vue";

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

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const chartStore = useChartStore();
const atl03ColorMapStore = useAtl03ColorMapStore();
const reqIdStr = computed(() => props.reqId.toString());
const computedFunc = computed(() => chartStore.getFunc(reqIdStr.value));
const computedSolidColorId = computed(() => `srSolidColorItems-${reqIdStr.value}`);
const computedSymbolColorEncoding = computed(() => {
    return chartStore.getSelectedColorEncodeData(reqIdStr.value);
});
const computedSolidSymbolColor = computed(() => {
    return chartStore.getSolidSymbolColor(reqIdStr.value);
});
const computedLabel = computed(() => {
    let label = `${props.reqId} - ${computedFunc.value}`;
    if(computedFunc.value.includes('atl03')){
        label = label+` - Photon Cloud `;
    }
    label = label +  ` (${numberFormatter.format(chartStore.getNumOfPlottedPnts(reqIdStr.value))} pnts)`;
    return `${label}`;
});

onMounted(() => {
    initDataBindingsToChartStore([reqIdStr.value]);
    initializeColorEncoding(reqIdStr.value,computedFunc.value);
    console.log('computedFunc:', computedFunc.value);
});

async function restoreAtl03DefaultColorsAndUpdatePlot() {
    console.log('restoreAtl03DefaultColorsAndUpdatePlot');
    await atl03ColorMapStore.restoreDefaultAtl03CnfColorMap();
    await callPlotUpdateDebounced('from restoreAtl03DefaultColorsAndUpdatePlot');
}

async function restoreAtl08DefaultColorsAndUpdatePlot() {
    console.log('restoreAtl08DefaultColorsAndUpdatePlot');
    await atl03ColorMapStore.restoreDefaultAtl08ClassColorMap();
    await callPlotUpdateDebounced('from restoreAtl08DefaultColorsAndUpdatePlot');
}

async function restoreYapcDefaultColorsAndUpdatePlot() {
    console.log('restoreYapcDefaultColorsAndUpdatePlot');
    await atl03ColorMapStore.restoreDefaultYapcColorMap();
    await callPlotUpdateDebounced('from restoreYapcDefaultColorsAndUpdatePlot');
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

const handleSymbolSizeUpdate = async (newSymbolSize: number) => {
    console.log(`Updated symbol size for ${props.reqId}:`, newSymbolSize);
    await callPlotUpdateDebounced('handleSymbolSizeUpdate');
};

const handleYDataSelectionChange = async (newValue: string[]) => {
    console.log("Y Data changed:", newValue);
    await callPlotUpdateDebounced('from handleYDataSelectionChange');
};

const handleColorEncodeSelectionChange = async (newValue: string) => {
    console.log("Color Encode changed:", newValue);
    await callPlotUpdateDebounced('from handleColorEncodeSelectionChange');
};

</script>
  
<style scoped>

.sr-ydata-menu {
    display: inline-flex; /* Allow the container to shrink-wrap its content */
    flex-direction: column;
    justify-content: center;
    align-items: flex-start; /* Align content to the left */
    gap: 0.5rem; /* Add spacing between elements */
    width: auto; /* Let the container size itself based on the content */
    padding: 0.5rem; /* Optional: Add some padding for spacing */
}
.sr-y-data-label {
    margin: 0;
    font-size: small;
}
.sr-select-col-encode-data,
.sr-select-y-data {
    width: 100%;
    margin: 0.25rem;
}
.sr-y-data-label:hover {
    color: #007bff; /* Accent color */
}

</style>
  