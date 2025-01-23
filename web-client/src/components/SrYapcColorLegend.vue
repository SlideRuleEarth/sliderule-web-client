<template>
    <div class="legend">
        <!-- Existing Yapc Score color scale -->
        <Fieldset
            class="sr-legend-box"
            legend="Yapc Colors"
            :toggleable="false"
            :collapsed="false" 
        >
            <div class="legend-item">
                <div class="sr-legend-box">
                    <div class="sr-color-map-gradient" :style="gradientStyle">
                    </div>
                    <div class="sr-legend-minmax">
                        <span class="sr-legend-min">
                            {{ (chartStore.getMinYapcScore(props.req_id.toString()) !== null && chartStore.getMinYapcScore(props.req_id.toString()) !== undefined ? chartStore.getMinYapcScore(props.req_id.toString()) : '?') }}
                        </span>
                        <span class="sr-legend-max">
                            {{ (chartStore.getMaxYapcScore(props.req_id.toString()) !== null && chartStore.getMaxYapcScore(props.req_id.toString()) !== undefined ? chartStore.getMaxYapcScore(props.req_id.toString()) : '?') }}
                        </span>
                    </div>
                </div>
            </div>
        </Fieldset>

        <!-- New Manage Colors button -->
        <div class="sr-restore-defaults">
            <Button label="Manage Colors" @click="showDialog = true" size="small" />
        </div>
  
        <!-- Dialog that contains SrYapcColors when visible -->
        <Dialog
            v-model:visible="showDialog"
            :modal="true"
            :draggable="false"
            :resizable="false"
            header="Manage Colors"
            @hide="onDialogHide"
        >
            <SrYapcColors
                :req_id="props.req_id"
                @selectionChanged="yapcColorChanged"
                @defaultsChanged="yapcColorChanged"
            />
        </Dialog>
    </div>
</template>
  
<script setup lang="ts">

import { ref, onMounted, computed } from 'vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import SrYapcColors from './SrYapcColors.vue';
import { useColorMapStore } from '@/stores/colorMapStore';
import { useChartStore } from '@/stores/chartStore';
import Fieldset from 'primevue/fieldset';

// Define props with TypeScript types
const props = defineProps<{
  req_id: number;
}>();

const chartStore = useChartStore();
const emit = defineEmits(['restore-yapc-color-defaults-click', 'yapc-color-changed']);
const colorMapStore = useColorMapStore();
const gradientStyle = computed(() => {
    const style = colorMapStore.getColorGradientStyle();
    console.log('--> computed: colorMapStore.getColorGradientStyle() :', style);
    return style || { background: 'linear-gradient(to right, #ccc, #ccc)', height: '1.25rem', width: '100%' };
  });
  
// Dialog visibility state
const showDialog = ref(false);

onMounted(async () => {
    if (!colorMapStore.isInitialized) {
        await colorMapStore.initializeColorMapStore();
    }
    colorMapStore.updateGradientColorMapValues();
    console.log('Mounted SrYapcColors colors:', colorMapStore.getNamedColorPalette());
});


// Emitted when a color changes
const yapcColorChanged = (event: { label: string; color: string }) => {
    emit('yapc-color-changed', event);
};

function onDialogHide() {
    // If you need to do something on close of the popup, do it here.
    // e.g., reload color map, etc.
}
</script>
  
<style scoped>
.legend {
  display: flex;
  flex-direction: column;
  gap: 0.25rem; /* 4px equivalent */
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem; /* 6px equivalent */
  white-space: nowrap; /* Keep text on a single line */
  overflow: hidden; /* Hide overflowing text */
  text-overflow: ellipsis; /* Add ellipsis for truncated text */
}

.color-box {
  width: 1rem; /* 16px equivalent */
  height: 1rem;
  border: 0.0625rem solid #000; /* 1px equivalent */
}

.label {
  font-size: 1rem; 
  line-height: 1.2; /* Adjust line height */
  color: white; /* Optional: Adjust color for subtle appearance */
}

.sr-legend-box {
    color: var(--p-primary-color);
    padding: 0.3125rem;
    background: transparent;
    border-radius: var(--p-border-radius);
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
}


.sr-color-map-gradient {
  border: 1px solid #ccc; /* Optional styling for better visibility */
  margin-top: 5px; /* Optional spacing */
}

.sr-legend-minmax {
    display: flex;
    justify-content: space-between;
    width: 10rem;
}
.sr-legend-min {
    font-size: 0.75rem;
    padding-left: 0.25rem;
}

.sr-legend-max {
    font-size: 0.75rem;
    padding-right: 0.25rem;
}
.sr-restore-defaults {
    display: flex;
    justify-content: center;
    margin-bottom: 0.5rem;
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
</style>
  