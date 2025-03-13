<template>
    <div class="sr-legend" v-if="gradientColorMapStore">
        <Fieldset
            class="sr-legend-box"
            :legend='props.label'
            :toggleable="false"
            :collapsed="false" 
        >
            <div class="sr-cntrls-panel" >
                <Select 
                    size="small"
                    label="Color Map" 
                    labelFontSize="small"
                    v-model="gradientColorMapStore.selectedGradientColorMapName"
                    :options="srColorMapNames" 
                    @update:modelValue="gradientColorMapChanged"
                    tooltipText="Gradient Color Map for scatter plot"
                />
            </div>
            <SrGradientLegend :reqIdStr="props.req_id.toString()" :data_key="props.data_key" :transparentBackground="true" />
        </Fieldset>
        <Button class="sr-legend-restore-btn" size="small" label="Restore Defaults" @click="gradientDefaultsRestored" />
    </div>
    <div v-else>Loading gradient color map...</div>
</template>
  
<script setup lang="ts">

import { onMounted } from 'vue';
import { srColorMapNames } from '@/utils/colorUtils';
import Fieldset from 'primevue/fieldset';
import Select from 'primevue/select';
import Button from 'primevue/button';
import SrGradientLegend from './SrGradientLegend.vue';
import { useGradientColorMapStore } from '@/stores/gradientColorMapStore';

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

const emit = defineEmits(['restore-gradient-color-defaults-click','gradient-num-shades-changed', 'gradient-color-map-changed']);

// Initialize the store without awaiting directly
const gradientColorMapStore = useGradientColorMapStore(props.req_id.toString());

onMounted(async () => {
    // Await the asynchronous store initialization after mounting
    console.log('Mounted SrGradientLegendCntrl with store:', gradientColorMapStore);
});

const gradientColorMapChanged = () => {
    gradientColorMapStore.updateGradientColorMapValues();
    emit('gradient-color-map-changed');
};

const gradientDefaultsRestored = async () => {
    await gradientColorMapStore.restoreDefaultGradientColorMap();
    emit('restore-gradient-color-defaults-click');
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

:deep(.sr-select-menu-default) {
    background-color: transparent;
}


.sr-legend-box {
    padding: 0.2rem; /* 3.2px equivalent */
    margin-top: 1rem;
    border-radius: var(--p-border-radius);
    position: relative; /* Enable positioning for the legend */
}

.sr-legend-restore-btn {
    align-self: center;
    margin-top: 0.5rem;
    font-size: small;
}

.sr-controls-panel {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin-bottom: 0.5rem;
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
    margin:0.5rem;
}
</style>
  