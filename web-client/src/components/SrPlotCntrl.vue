<template>
    <Fieldset :legend="overlayedReqLegend(reqId)">
        <div>
            <div class="sr-ydata-menu">
                <label class="sr-y-data-label":for="`srYdataItems-overlayed-${reqIdStr}`">Y Data</label> 
                <Select class="sr-select-ydata"
                    v-model="yDataSelectedReactive[reqIdStr]"
                    :options="chartStore.getYDataOptions(reqIdStr)"
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
                        placeholder="Encode Color with"
                        :id="`srYColEncode-overlayed-${reqIdStr}`"
                        size="small"
                    >
                    </Select>
                </div>
                <div class="sr-legend-panel">
                    <SrAtl03ColorLegend 
                        v-if="((chartStore.getSelectedColorEncodeData(reqIdStr) === 'atl03_cnf') && (chartStore.getFunc(reqIdStr) === 'atl03sp'))" 
                        @restore-defaults-click="restoreAtl03DefaultColorsAndUpdatePlot" 
                    />
                    <SrAtl08ColorLegend 
                        v-if="((chartStore.getSelectedColorEncodeData(reqIdStr) === 'atl08_class') && (chartStore.getFunc(reqIdStr) === 'atl03sp'))" 
                    />
                </div>
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
        <div>
            <SrSymbolSize
                :reqIdStr="reqIdStr"
                @update:symbolSize="handleSymbolSizeUpdate"
            />
        </div>
    
    </Fieldset>
</template>
  
<script setup lang="ts">
import { useChartStore } from '@/stores/chartStore';
import SrSymbolSize from '@/components/SrSymbolSize.vue';
import Select  from 'primevue/select';
import Fieldset  from 'primevue/fieldset';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { useAtl03ColorMapStore } from '@/stores/atl03ColorMapStore';
import { initDataBindingsToChartStore, yDataSelectedReactive, yColorEncodeSelectedReactive, solidColorSelectedReactive, initializeColorEncoding } from '@/utils/plotUtils';
import { computed, onMounted, ComputedRef } from 'vue';
import { callPlotUpdateDebounced } from "@/utils/plotUtils";
import { restoreAtl03DefaultColors } from '@/utils/colorUtils';
import SrAtl03ColorLegend from '@/components/SrAtl03ColorLegend.vue';
import SrAtl08ColorLegend from '@/components/SrAtl08ColorLegend.vue';

const props = defineProps<{ reqId: number }>();

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


onMounted(() => {
    initDataBindingsToChartStore([reqIdStr.value]);
    initializeColorEncoding(reqIdStr.value,computedFunc.value);
    console.log('computedFunc:', computedFunc.value);
});

async function restoreAtl03DefaultColorsAndUpdatePlot() {
    console.log('restoreAtl03DefaultColorsAndUpdatePlot');
    restoreAtl03DefaultColors();
    await callPlotUpdateDebounced('from restoreAtl03DefaultColorsAndUpdatePlot');
}
const useFindReqMenuLabel = () => {
  const atlChartFilterStore = useAtlChartFilterStore();

  const findReqMenuLabel = computed(() => {
    return (reqId: number): string => {
      const item = atlChartFilterStore.reqIdMenuItems.find((i) => i.value === reqId);
      return item ? item.label : 'unknown';
    };
  });

  return findReqMenuLabel;
};
const findReqMenuLabel = useFindReqMenuLabel();
const overlayedReqLegend: ComputedRef<(overlayedReqId: number) => string> = computed(() => {
    return (overlayedReqId: number): string => {
        let label = findReqMenuLabel.value(overlayedReqId);
        if(computedFunc.value==='atl03sp'){
            label = label+ ` - Photon Cloud`;
        };
        return `${label}`;
    };
});

const handleSymbolSizeUpdate = (newSymbolSize: number) => {
    console.log(`Updated symbol size for ${props.reqId}:`, newSymbolSize);
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
  