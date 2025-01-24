<template>
    <div class="sr-legend">
        <Fieldset
            class="sr-legend-box"
            :legend='props.label'
            :toggleable="false"
            :collapsed="false" 
        >
            <div class="sr-cntrls-panel" >
                <SrMenu 
                    label="Color Map" 
                    v-model="colorMapStore.selectedGradientColorMapName"
                    :menuOptions="srColorMapNames" 
                    :getSelectedMenuItem="colorMapStore.getSelectedGradientColorMapName"
                    :setSelectedMenuItem="colorMapStore.setSelectedGradientColorMapName"
                    @update:modelValue="gradientColorMapChanged"
                    tooltipText="Gradient Color Map for scatter plot"
                />
                <SrSliderInput
                    v-model="colorMapStore.numShadesForGradient"
                    label="Number of Shades"
                    @update:model-value="gradientNumShadesChanged"
                    :min="getFormattedMinValue"
                    :max="getFormattedMaxValue"
                    sliderWidth="5rem"
                    inputWidth="5rem"
                    :step="1"
                    :tooltipText="`Number of Shades for Gradient Color Map`"
                />
            </div>
            <div class="sr-legend-box">
                <div class="sr-color-map-gradient" :style="gradientStyle">
                </div>
                <div class="sr-legend-minmax">
                    <span class="sr-legend-min">
                        {{ getFormattedMinValue }}
                    </span>
                    <span class="sr-legend-max">
                        {{ getFormattedMaxValue }}
                    </span>
                </div>
            </div>        
        </Fieldset>
        <Button label="Restore Defaults" @click="gradientDefaultsRestored" />

    </div>
</template>
  
<script setup lang="ts">

import { onMounted, computed } from 'vue';
import { srColorMapNames } from '@/utils/colorUtils';
import { useColorMapStore } from '@/stores/colorMapStore';
import { useChartStore } from '@/stores/chartStore';
import Fieldset from 'primevue/fieldset';
import SrMenu from './SrMenu.vue';
import SrSliderInput from './SrSliderInput.vue';
import Button from 'primevue/button';

// Define props with TypeScript types
const props = withDefaults(
    defineProps<{
        req_id: number;
        data_key: string;
        label: string;
    }>(),
    {
        req_id: 0,
        data_key: '',
        label: 'Gradient Colors Legend',
    }
);

const chartStore = useChartStore();
const emit = defineEmits(['restore-gradient-color-defaults-click','gradient-num-shades-changed', 'gradient-color-map-changed']);
const colorMapStore = useColorMapStore();
const gradientStyle = computed(() => {
    const style = colorMapStore.getColorGradientStyle();
    console.log('--> computed: colorMapStore.getColorGradientStyle() :', style);
    return style || { background: 'linear-gradient(to right, #ccc, #ccc)', height: '1.25rem', width: '100%' };
  });
  

onMounted(async () => {
    if (!colorMapStore.isInitialized) {
        await colorMapStore.initializeColorMapStore();
    }
    colorMapStore.updateGradientColorMapValues();
    //console.log('Mounted SrGradientColorCntrl colors:', colorMapStore.getGradientColorMap());
});

// const getFormattedMinValue = computed(() => {
// //     const minValue = chartStore.getMinValue(props.req_id.toString(), props.data_key);
// //     if (minValue !== null && minValue !== undefined) {
// //         return Math.max(parseFloat(minValue.toFixed(1)), 10);
// //     }
//      return 10; // Default to the minimum value if minValue is null or undefined
// });
const getFormattedMinValue = computed(() => {
    return 10;
});

// const getFormattedMaxValue = computed(() => {
//     const maxValue = chartStore.getMaxValue(props.req_id.toString(), props.data_key);
//     return maxValue !== null && maxValue !== undefined ? parseFloat(maxValue.toFixed(1)) : 0;
// });
const getFormattedMaxValue = computed(() => {
    return 256;
});

const gradientColorMapChanged = () => {
    colorMapStore.updateGradientColorMapValues();
    emit('gradient-color-map-changed');
};

const gradientDefaultsRestored = () => {
    colorMapStore.restoreDefaultGradientColorMap();
    emit('restore-gradient-color-defaults-click');
};

const gradientNumShadesChanged = () => {
    colorMapStore.updateGradientColorMapValues();
    emit('gradient-num-shades-changed');
};


</script>
  
<style scoped>
.sr-legend {
  display: flex;
  flex-direction: column;
  gap: 0.25rem; /* 4px equivalent */
}

.sr-color-map-gradient {
  border: 1px solid #ccc; /* Optional styling for better visibility */
}

.sr-legend-minmax {
    display: flex;
    justify-content: space-between;
}
.sr-legend-min {
    font-size: 0.75rem;
    padding-left: 0.25rem;
}

.sr-legend-max {
    font-size: 0.75rem;
    padding-right: 0.25rem;
}
.sr-cntrls-panel {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin-bottom: 0.5rem;
}


.sr-legend-box {
    padding: 0.2rem; /* 3.2px equivalent */
    margin-top: 1rem;
    border-radius: var(--p-border-radius);
    position: relative; /* Enable positioning for the legend */
}

/* Custom Fieldset legend style */
:deep(.sr-legend-box .p-fieldset-legend) {
    font-size: small;
    font-weight: normal;
    color: white;
    padding: 0.2rem;
    text-align: center;
    position: absolute;
    top: 0.5rem;
    left: 50%;
    transform: translate(-50%, -50%);
    background: black;
    border-radius: 0.25rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    z-index: 1;
    padding: 0 0.5rem;
}

:deep(.p-fieldset-content-container) {
    padding-top: 1.5rem; /* Adjust padding to prevent overlap with the legend */
}
</style>
  