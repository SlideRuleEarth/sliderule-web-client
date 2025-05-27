<template>
    <div ref="localDeckContainer" class="deck-canvas">    
    </div>
    <div class="sr-3d-cntrl">
        <Button 
            label="Toggle Axes"
            icon="pi pi-eye"
            class="sr-glow-button"
            variant = text
            rounded
            @click="handleToggleAxes"
        />
        <Button 
            label="Update View"
            icon="pi pi-refresh"
            class="sr-glow-button"
            variant = text
            rounded
            @click="handleUpdateClick"
        />
        <label class="sr-pnt-sz-label" for="pointSizeId">Point Size</label>
        <InputNumber
            v-model="deck3DConfigStore.pointSize"
            inputId="pointSizeId"
            size="small"
            :step="0.5"
            :min="0.1"
            :max="10"
            showButtons
            :defaultValue="deck3DConfigStore.pointSize"
            :decimalPlaces=0
            @value-change="handlePointSizeChange"
        />
        <SrDeck3DCfg/>
    </div>
</template>

<script setup lang="ts">
import { onMounted, nextTick, computed, watch, ref } from 'vue';
import { useSrToastStore } from '@/stores/srToastStore';
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { updateMapAndPlot } from '@/utils/SrMapUtils';
import { useDeck3DConfigStore } from '@/stores/deck3DConfigStore';
import SrDeck3DCfg from '@/components/SrDeck3DCfg.vue';
import Button from 'primevue/button';
import { InputNumber } from 'primevue';
import { update3DPointCloud, updateFovy } from '@/utils/deck3DPlotUtils';


const recTreeStore = useRecTreeStore();
const toast = useSrToastStore();
const deck3DConfigStore = useDeck3DConfigStore();
const reqId = computed(() => recTreeStore.selectedReqId);
const elevationStore = useElevationColorMapStore();

const localDeckContainer = ref<HTMLDivElement | null>(null);
const deckContainerStored = computed(() => deck3DConfigStore.deckContainer);

async function handleUpdateClick() {
    console.log('Update View Clicked');
    await update3DPointCloud(reqId.value,deckContainerStored);
}

async function handleToggleAxes() {
    deck3DConfigStore.showAxes = !deck3DConfigStore.showAxes;
    await update3DPointCloud(reqId.value,deckContainerStored);
}

async function handlePointSizeChange() {
    console.log('Point Size Changed:', deck3DConfigStore.pointSize);
    await update3DPointCloud(reqId.value,deckContainerStored);
}

onMounted(async () => {
    updateMapAndPlot(false);
    await nextTick(); // ensures DOM is updated
    elevationStore.updateElevationColorMapValues();
    await nextTick(); // makes sure the gradient is available
    console.log('onMounted Centroid:', deck3DConfigStore.centroid);
    const { width, height } = localDeckContainer.value!.getBoundingClientRect();
    deck3DConfigStore.fitZoom = Math.log2(Math.min(width, height) / deck3DConfigStore.scale);
    //console.log('onMounted fitZoom:', deck3DConfigStore.fitZoom);
    //console.log('onMounted Deck container size:', deckContainer.value?.getBoundingClientRect());

    if (localDeckContainer.value) {
        const { width, height } = localDeckContainer.value.getBoundingClientRect();
        if (width === 0 || height === 0) {
            console.error('onMounted Deck container has zero dimensions!');
        } else {
            deck3DConfigStore.deckContainer = localDeckContainer.value;
            console.log('onMounted Deck container set:', deck3DConfigStore.deckContainer);
            console.log('onMounted Deck container size:', deck3DConfigStore.deckContainer?.getBoundingClientRect());
        }
    }

    if (elevationStore.elevationColorMap.length > 0) {
        await update3DPointCloud(reqId.value,deckContainerStored);
    } else {
        console.error('No color Gradient');
        toast.error('No color Gradient', 'Skipping point cloud due to missing gradient.');
    }
    toast.info('3D view', 'Drag to rotate, scroll to zoom. Hold the shift key and drag to pan.');
});

watch(reqId, async (newVal, oldVal) => {
    if (newVal && newVal !== oldVal) {
        updateMapAndPlot(false);
        await update3DPointCloud(reqId.value,deckContainerStored);
    }
});

watch(() => deck3DConfigStore.fovy, (newFov) => {
    console.log('FOV updated to:', newFov);
    updateFovy(newFov);
});


</script>

<style scoped>
.deck-canvas {
    position: relative; /* ✅ ensures canvas stays in scroll flow */
    display: block;
    width: 100%;
    height: 60vh;
    min-height: 400px;
    background: #111;
    /* border: 1px solid #ccc;  */
    overflow: auto; /* if you want scrollbars */
}
  /* Override PrimeVue component widths */
  :deep(.p-inputnumber-input) {
    width: 7rem;
  }
  .sr-pnt-sz-label{
    font-size: small;
    margin-right: 0.5rem;
  }
</style>
