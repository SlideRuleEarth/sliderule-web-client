<template>
    <div class="sr-legend">
        <SrAtl03CnfColors 
            reqIdStr="reqIdStr"
        />
        <Button 
            icon="pi pi-cog"
            class="sr-glow-button"
            label="Manage Atl03 Cnf Colors" 
            @click="showDialog = true" 
            size="small" 
            variant="text"
            rounded
        ></Button>
  
        <Dialog
            v-model:visible="showDialog"
            :modal="true"
            :draggable="false"
            :resizable="false"
            header="Manage ATL03 Cnf Colors"
            @hide="onDialogHide"
        >
            <SrAtl03CnfColorSelection
                :reqIdStr="reqIdStr"
                @atl03selectionChanged="atl03CnfColorChanged"
                @atl03defaultsChanged="atl03CnfColorChanged"
            />
        </Dialog>
    </div>
</template>
  
<script setup lang="ts">

import { ref, onMounted } from 'vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import SrAtl03CnfColorSelection from '@/components/SrAtl03CnfColorSelection.vue';
import { useColorMapStore } from '@/stores/colorMapStore';
import SrAtl03CnfColors from '@/components/SrAtl03CnfColors.vue';

const props = defineProps({
    reqIdStr: {
        type: String,
        required: true
    }
});

const emit = defineEmits(['restore-atl03-color-defaults-click', 'atl03CnfColorChanged']);
const colorMapStore = useColorMapStore();

// Dialog visibility state
const showDialog = ref(false);

onMounted(async () => {
});

// const atl03CnfOptions = computed(() => colorMapStore.atl03CnfOptions);


// const formatLabel = (label: string): string => {
//     return label.replace(/^atl03_/, '').replace(/_/g, ' ');
// };
    
// Emitted when a color changes
const atl03CnfColorChanged = (event: { label: string; color: string }) => {
    emit('atl03CnfColorChanged', event);
};

function onDialogHide() {
    // If you need to do something on close of the popup, do it here.
    // e.g., reload color map, etc.
}
</script>
  
<style scoped>
.sr-legend {
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
  