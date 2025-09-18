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
        <div>
            <label class="sr-y-data-label":for="`srYColEncode3D-overlayed-${recTreeStore.selectedReqIdStr}`">Point Color</label>
            <Select
                class="sr-select-col-encode-data"
                v-model="yColorEncodeSelectedReactive[recTreeStore.selectedReqIdStr]"
                :options="chartStore.getColorEncodeOptionsForFunc(recTreeStore.selectedReqIdStr,computedFunc)"
                @change="handleColorEncodeSelectionChange"
                placeholder="Encode Color with"
                :id="`srYColEncode3D-overlayed-${recTreeStore.selectedReqIdStr}`"
                size="small"
            >
            </Select>
        </div>
        <div>
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
        </div>
        <div>
            <label class="sr-vert-exag-label" for="vertExagId">Vertical Exaggeration</label>
            <InputNumber
                v-model="deck3DConfigStore.verticalExaggeration"
                inputId="vertExagId"
                size="small"
                :step="computedStepSize"
                :min="1"
                :max="1000000"
                showButtons
                :defaultValue="deck3DConfigStore.verticalExaggeration"
                :decimalPlaces="1"
                @value-change="handleVerticalExaggerationChange"
            />
        </div>

    </div>
    <SrDeck3DCfg/>
</template>

<script setup lang="ts">
import { onMounted, nextTick, computed, watch, ref, onUnmounted } from 'vue';
import { useSrToastStore } from '@/stores/srToastStore';
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { updateMapAndPlot } from '@/utils/SrMapUtils';
import { useDeck3DConfigStore } from '@/stores/deck3DConfigStore';
import SrDeck3DCfg from '@/components/SrDeck3DCfg.vue';
import Button from 'primevue/button';
import { InputNumber } from 'primevue';
import { finalizeDeck,loadAndCachePointCloudData, updateFovy } from '@/utils/deck3DPlotUtils';
import { debouncedRender } from '@/utils/SrDebounce';
import { yColorEncodeSelectedReactive } from '@/utils/plotUtils';
import Select from 'primevue/select';
import { useChartStore } from '@/stores/chartStore'; 

const recTreeStore = useRecTreeStore();
const chartStore = useChartStore();
const toast = useSrToastStore();
const deck3DConfigStore = useDeck3DConfigStore();
const reqId = computed(() => recTreeStore.selectedReqId);
const elevationStore = useElevationColorMapStore();
const computedFunc = computed(() => recTreeStore.selectedApi);

const localDeckContainer = ref<HTMLDivElement | null>(null);
const computedStepSize = computed(() => {
    if (deck3DConfigStore.verticalScaleRatio > 1000) {
        // If the vertical scale ratio is very large, increase the step size for better control
        return 100;
    } else if (deck3DConfigStore.verticalScaleRatio > 100) {
        // For moderate vertical scale ratios, use a smaller step size
        return 10;
    } else if (deck3DConfigStore.verticalScaleRatio > 10) {
        // For smaller vertical scale ratios, use an even smaller step size
        return 5;       
    } else {
        // For very small vertical scale ratios, use a minimal step size
        return 1;
    }
});


async function handleColorEncodeSelectionChange() {
    console.log('handleColorEncodeSelectionChange');
    await loadAndCachePointCloudData(reqId.value);
    debouncedRender(localDeckContainer); // Use the fast, debounced renderer
}

async function handleToggleAxes() {
    deck3DConfigStore.showAxes = !deck3DConfigStore.showAxes;
    debouncedRender(localDeckContainer); // Use the fast, debounced renderer
}

async function handlePointSizeChange() {
    //console.log('Point Size Changed:', deck3DConfigStore.pointSize);
    debouncedRender(localDeckContainer); // Use the fast, debounced renderer
}

async function handleVerticalExaggerationChange() {
    //console.log('Vertical exaggeration changed:', deck3DConfigStore.verticalExaggeration);
    debouncedRender(localDeckContainer); // Use the fast, debounced renderer
}


onMounted(async () => {
    updateMapAndPlot(false);
    await nextTick(); // ensures DOM is updated
    elevationStore.updateElevationColorMapValues();
    await nextTick(); // makes sure the gradient is available
    //console.log('onMounted Centroid:', deck3DConfigStore.centroid);
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
            //console.log('onMounted Deck container set:', deck3DConfigStore.deckContainer);
            //console.log('onMounted Deck container size:', deck3DConfigStore.deckContainer?.getBoundingClientRect());
        }
    } else {
        console.error('onMounted localDeckContainer is null');
    }

    if (elevationStore.elevationColorMap.length > 0) {
        //console.log('onMounted calling loadAndCachePointCloudData');
        await loadAndCachePointCloudData(reqId.value);
        debouncedRender(localDeckContainer); // Use the fast, debounced renderer
    } else {
        console.error('No color Gradient');
        toast.error('No color Gradient', 'Skipping point cloud due to missing gradient.');
    }
    toast.info('3D view', 'Drag to rotate, scroll to zoom. Hold the shift key and drag to pan.');
});

onUnmounted(() => {
    //console.log('onUnmounted for SrDeck3DView');
    finalizeDeck();
});

watch(reqId, async (newVal, oldVal) => {
    if (newVal && newVal !== oldVal) {
        updateMapAndPlot(false);
        await loadAndCachePointCloudData(reqId.value);
        debouncedRender(localDeckContainer); // Use the fast, debounced renderer
    }
});

watch(() => deck3DConfigStore.fovy, (newFov) => {
    console.log('FOV updated to:', newFov);
    updateFovy(newFov);
    debouncedRender(localDeckContainer); // Use the fast, debounced renderer
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
    overflow: hidden; /* if you want scrollbars */
    will-change: transform; /* Hint for performance */
}
  /* Override PrimeVue component widths */
:deep(.p-inputnumber-input) {
    width: 7rem;
}

.sr-3d-cntrl {
    display: flex;
    flex-direction: row;
}
.sr-y-data-label{
    font-size: small;
    margin-right: 0.2rem;
    align-items: center;
    justify-content: center;
}
.sr-pnt-sz-label{
    font-size: small;
    margin-right: 0.2rem;
    align-items: center;
    justify-content: center;
}
.sr-vert-exag-label{
    font-size: small;
    margin-right: 0.2rem;
    align-items: center;
    justify-content: center;
}
.sr-vert-scl-label{
    font-size: small;
    margin-left: 0.5rem;
    margin-right: 0.2rem;
    align-items: center;
    justify-content: center;
}
</style>
