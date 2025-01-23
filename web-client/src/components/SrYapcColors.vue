<template>
    <div class="legend">
        <Fieldset legend="Color Map Control" class="sr-legend-box" :toggleable="false" :collapsed="false">
            <div class="sr-menu-container" >
                <SrMenu 
                    label="Color Map" 
                    v-model="colorMapStore.selectedGradientColorMapName"
                    :menuOptions="srColorMapNames" 
                    :getSelectedMenuItem="colorMapStore.getSelectedGradientColorMapName"
                    :setSelectedMenuItem="colorMapStore.setSelectedGradientColorMapName"
                    @update:modelValue="handleSelectionChanged( $event)"
                    tooltipText="Color Map for scatter plot"
                />
                <SrSliderInput
                    v-model="colorMapStore.numShadesForGradient"
                    label="Number of Shades"
                    :min="(chartStore.getMinYapcScore(props.req_id.toString()) !== null && chartStore.getMinYapcScore(props.req_id.toString()) !== undefined ? chartStore.getMinYapcScore(props.req_id.toString()) : 0)"
                    :max="(chartStore.getMaxYapcScore(props.req_id.toString()) !== null && chartStore.getMaxYapcScore(props.req_id.toString()) !== undefined ? chartStore.getMaxYapcScore(props.req_id.toString()) : 0)"
                    :step="1"
                    :tooltipText="`Number of Shades for YAPC Color Map`"
                />

            </div>
            <div class="sr-restore-defaults">
                <Button label="Restore Defaults" @click="restoreDefaultGradientColorMap" />
            </div>
        </Fieldset>
    </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import SrMenu from './SrMenu.vue';
import Fieldset from 'primevue/fieldset';
import Button from 'primevue/button';
import { srColorMapNames } from '@/utils/colorUtils';
import { useColorMapStore } from '@/stores/colorMapStore';
import SrSliderInput from './SrSliderInput.vue';
import { useChartStore } from '@/stores/chartStore';

// Define props with TypeScript types
const props = defineProps<{
  req_id: number;
}>();

const colorMapStore = useColorMapStore();
const chartStore = useChartStore();
const emit = defineEmits(['yapc-selection-changed', 'yapc-defaults-changed']);

// Initialize the store
onMounted(async () => {
});

// Handle menu selection changes
const handleSelectionChanged = (mapName: string) => {
    colorMapStore.updateGradientColorMapValues();
    emit('yapc-selection-changed', { mapName });
};

const restoreDefaultGradientColorMap = () => {
    colorMapStore.restoreDefaultGradientColorMap();
    emit('yapc-defaults-changed', {});
};
</script>

<style scoped>

.legend {
  display: flex;
  flex-direction: column;
  gap: 0.25rem; /* 4px equivalent */
}

.sr-legend-box {
    padding: 0.2rem; /* 3.2px equivalent */
    margin-top: 1rem;
    border-radius: var(--p-border-radius);
    position: relative; /* Enable positioning for the legend */
}

/* Custom Fieldset legend style */
:deep(.sr-legend-box .p-fieldset-legend) {
    font-size: 0.75rem; /* Adjust font size */
    font-weight: normal; /* Optional: Adjust font weight */
    color:white; /* Adjust color */
    padding: 0.2rem; /* Adjust padding for a smaller appearance */
    text-align: center; /* Center text horizontally */
    position: absolute; /* Position relative to the Fieldset */
    top: 0.5rem; /* Align legend to the top */
    left: 50%; /* Center horizontally */
    transform: translate(-50%, -50%); /* Adjust position to center it over the top border */
    background:  black; /* Match the background color */
    z-index: 1; /* Ensure it appears above the Fieldset border */
    padding: 0 0.5rem; /* Add spacing to prevent overlap with text */
}
:deep(.p-fieldset-content-container) {
    padding-top: 1.5rem; /* Adjust padding to prevent overlap with the legend */
}

.sr-restore-defaults {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.5rem;
}

.sr-menu-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.5rem;
}

</style>
