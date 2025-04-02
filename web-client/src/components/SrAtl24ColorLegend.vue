<template>
    <div class="sr-legend">
        <SrAtl24Colors 
            reqIdStr="reqIdStr"
        />
        <div class="sr-restore-defaults">
            <Button 
                icon="pi pi-cog"
                label="Manage Atl24 Class Colors" 
                class="sr-glow-button"
                @click="showDialog = true" 
                size="small"
                variant="text"
                rounded
            ></Button>
        </div>
  
        <Dialog
            v-model:visible="showDialog"
            :modal="true"
            :draggable="false"
            :resizable="false"
            header="Manage Atl24 Class Colors"
            @hide="onDialogHide"
        >
            <SrAtl24ClassColorSelection
                :reqIdStr="reqIdStr"
                @atl24selectionChanged="atl24ClassColorChanged"
                @atl24defaultsChanged="atl24ClassColorChanged"
            />
        </Dialog>        
    </div>
</template>
  
<script setup lang="ts">

import { ref, onMounted } from 'vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import SrAtl24ClassColorSelection from '@/components/SrAtl24ClassColorSelection.vue';
import SrAtl24Colors from '@/components/SrAtl24Colors.vue';

const emit = defineEmits(['restore-atl24-color-defaults-click', 'atl24ClassColorChanged']);
const props = defineProps({
    reqIdStr: {
        type: String,
        required: true
    }
});

// Dialog visibility state
const showDialog = ref(false);

onMounted(async () => {

});

// Emitted when a color changes
const atl24ClassColorChanged = (event: { label: string; color: string }) => {
    emit('atl24ClassColorChanged', event);
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
    gap: 8px;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .color-box {
    width: 20px;
    height: 20px;
    border: 1px solid #000;
  }
  
  .label {
    font-size: 14px;
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
  