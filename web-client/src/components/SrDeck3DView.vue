<template>
    <div ref="deckContainer" class="deck-canvas">    
    </div>
    <div class="sr-3d-cntrl">
        <Button 
            label="Toggle Axes"
            icon="pi pi-eye"
            class="p-button-sm p-mt-2"
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
        <SrDeck3DCfg/>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed, watch } from 'vue';
import { Deck } from '@deck.gl/core';
import { PointCloudLayer } from '@deck.gl/layers';
import { OrbitView, OrbitController } from '@deck.gl/core';
import { useFieldNameStore } from '@/stores/fieldNameStore';
import { useSrToastStore } from '@/stores/srToastStore';
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore';
import { createDuckDbClient } from '@/utils/SrDuckDb';
import { db as indexedDb } from '@/db/SlideRuleDb';
import { computeSamplingRate } from '@/utils/SrDuckDbUtils';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { updateMapAndPlot } from '@/utils/SrMapUtils';
import { useDeck3DConfigStore } from '@/stores/deck3DConfigStore';
import SrDeck3DCfg from '@/components/SrDeck3DCfg.vue';
import Button from 'primevue/button';
import { createAxesAndLabels } from '@/utils/deckAxes';
import type { Layer } from '@deck.gl/core';

const deckContainer = ref<HTMLDivElement | null>(null);

const viewId = 'main';
const recTreeStore = useRecTreeStore();
const toast = useSrToastStore();
const fieldStore = useFieldNameStore();
const deck3DConfigStore = useDeck3DConfigStore();
const reqId = computed(() => recTreeStore.selectedReqId);
const elevationStore = useElevationColorMapStore();
const deckInstance = ref<Deck | null>(null);

function computeCentroid(position: [number, number, number][]) {
    if (!position.length) return;
    const n = position.length;
    const sum = position.reduce((acc, p) => {
        acc[0] += p[0];
        acc[1] += p[1];
        acc[2] += p[2];
        return acc;
    }, [0, 0, 0]);
    const avg = sum.map(c => c / n);
    if (avg.every(Number.isFinite)) {
        deck3DConfigStore.centroid = avg as [number, number, number];
    }
    console.log('Centroid:', deck3DConfigStore.centroid);
}

function initDeckInstance() {
    console.log('Initializing Deck Instance viewId:', viewId);

    if (deckInstance.value) {
        deckInstance.value.finalize();
        deckInstance.value = null;
    }
    console.log('deckContainer:', deckContainer.value);
    console.log('container rect:', deckContainer.value?.getBoundingClientRect());

    deckInstance.value = new Deck({
        parent: deckContainer.value!,
        views: [
            new OrbitView({
                id: viewId,
                orbitAxis: deck3DConfigStore.orbitAxis,
                fovy: deck3DConfigStore.fovy           
            })
        ],
        controller: {
            type: OrbitController,
            inertia:    deck3DConfigStore.inertia,
            // wheel zoom speed & easing
            scrollZoom: {
                speed: deck3DConfigStore.zoomSpeed,   // your desired wheel zoom multiplier
                smooth: false                         // or true if you want easing
            },

            // keyboard controls (arrow keys & +/-)
            keyboard: {
                zoomSpeed:     deck3DConfigStore.zoomSpeed,   // +/- keys
                moveSpeed:     deck3DConfigStore.panSpeed,    // arrow keys panning
                rotateSpeedX:  deck3DConfigStore.rotateSpeed, // shift+up/down (pitch)
                rotateSpeedY:  deck3DConfigStore.rotateSpeed  // shift+left/right (yaw)
            }
        },
        initialViewState: {
            [viewId]: {
                target:        deck3DConfigStore.centroid,
                zoom:          deck3DConfigStore.fitZoom,
                rotationX:     deck3DConfigStore.viewState.rotationX,
                rotationOrbit: deck3DConfigStore.viewState.rotationOrbit
            }
            },        
        layers: [ /* … */ ],
        onViewStateChange: ({ viewState }) => {
            deck3DConfigStore.updateViewState(viewState)
        },
        debug: deck3DConfigStore.debug
    }) as any

}

async function updatePointCloud() {
    try {
        const status = await indexedDb.getStatus(reqId.value);
        if (status === 'error') return;

        const fileName = await indexedDb.getFilename(reqId.value);
        if (!fileName) throw new Error('Filename not found');

        const duckDbClient = await createDuckDbClient();
        await duckDbClient.insertOpfsParquet(fileName);

        const sample_fraction = await computeSamplingRate(reqId.value);
        const result = await duckDbClient.queryChunkSampled(
            `SELECT * FROM read_parquet('${fileName}')`,
            sample_fraction
        );

        const { value: rows = [], done } = await result.readRows().next();
        if (!done && rows.length > 0) {
            const latField = fieldStore.getLatFieldName(reqId.value);
            const lonField = fieldStore.getLonFieldName(reqId.value);
            const heightField = fieldStore.getHFieldName(reqId.value);

            const validRows = rows.filter(d => {
                const lon = d[lonField];
                const lat = d[latField];
                const elev = d[heightField];
                return (
                    typeof lon === 'number' && Number.isFinite(lon) &&
                    typeof lat === 'number' && Number.isFinite(lat) &&
                    typeof elev === 'number' && Number.isFinite(elev)
                );
            });

            if (!validRows.length) {
                toast.warn('No Valid Rows', 'No rows with valid lat/lon/elevation found.');
                return;
            }

            const lonMin = Math.min(...validRows.map(d => d[lonField]));
            const lonMax = Math.max(...validRows.map(d => d[lonField]));
            const latMin = Math.min(...validRows.map(d => d[latField]));
            const latMax = Math.max(...validRows.map(d => d[latField]));
            const elevMin = Math.min(...validRows.map(d => d[heightField]));
            const elevMax = Math.max(...validRows.map(d => d[heightField]));
            const lonRange = Math.max(1e-6, lonMax - lonMin);
            const latRange = Math.max(1e-6, latMax - latMin);
            const elevRange = Math.max(1e-6, elevMax - elevMin);

            elevationStore.updateElevationColorMapValues();
            const rgbaArray = elevationStore.elevationColorMap;

            const pointCloudData = validRows.map(d => {
                const x = deck3DConfigStore.scale * (d[lonField] - lonMin) / lonRange;
                const y = deck3DConfigStore.scale * (d[latField] - latMin) / latRange;
                const z = deck3DConfigStore.scale * (d[heightField] - elevMin) / elevRange;
                const index = Math.floor(z / deck3DConfigStore.scale * (rgbaArray.length - 1));
                const rawColor = rgbaArray[Math.max(0, Math.min(index, rgbaArray.length - 1))] ?? [255, 255, 255, 1];
                const color = [
                    Math.round(rawColor[0]),
                    Math.round(rawColor[1]),
                    Math.round(rawColor[2]),
                    Math.round(rawColor[3] * 255),
                ];
                return { position: [x, y, z] as [number, number, number], color };
            });

            computeCentroid(pointCloudData.map(p => p.position));

            //console.log('Fit Zoom:', computedFitZoom.value);
            initDeckInstance();
            const layer = new PointCloudLayer({
                id: 'point-cloud-layer',
                data: pointCloudData,
                getPosition: d => d.position,
                getColor: d => d.color,
                pointSize: 0.5,
                opacity: 0.95,
                pickable: true,
            });
            const layers: Layer<any>[] = [layer];

            if (deck3DConfigStore.showAxes) {
                const [axes, labels] = createAxesAndLabels(deck3DConfigStore.scale);
                layers.push(axes, labels);
            }

            deckInstance.value?.setProps({layers});
        } else {
            toast.warn('No Data Processed', 'No elevation data returned.');
        }
    } catch (err) {
        console.error('Error loading 3D view:', err);
        toast.error('Error', 'Failed to load elevation data.');
    }
}

function handleUpdateClick() {
    console.log('Update View Clicked');
    updatePointCloud();
}

function handleToggleAxes() {
    deck3DConfigStore.showAxes = !deck3DConfigStore.showAxes;
    updatePointCloud();
}

onMounted(async () => {
    updateMapAndPlot(false);
    await nextTick(); // ensures DOM is updated
    elevationStore.updateElevationColorMapValues();
    await nextTick(); // makes sure the gradient is available
    console.log('onMounted Centroid:', deck3DConfigStore.centroid);
    const { width, height } = deckContainer.value!.getBoundingClientRect();
    deck3DConfigStore.fitZoom = Math.log2(Math.min(width, height) / deck3DConfigStore.scale);
    //console.log('onMounted fitZoom:', deck3DConfigStore.fitZoom);
    //console.log('onMounted Deck container size:', deckContainer.value?.getBoundingClientRect());

    if (deckContainer.value) {
        const { width, height } = deckContainer.value.getBoundingClientRect();
        if (width === 0 || height === 0) {
            console.warn('onMounted Deck container has zero dimensions!');
        }
    }

    if (elevationStore.elevationColorMap.length > 0) {
        await updatePointCloud();
    } else {
        console.error('No color Gradient');
        toast.error('No color Gradient', 'Skipping point cloud due to missing gradient.');
    }
    toast.info('3D view', 'Drag to rotate, scroll to zoom. Hold the shift key and drag to pan.');
});

watch(reqId, async (newVal, oldVal) => {
    if (newVal && newVal !== oldVal) {
        updateMapAndPlot(false);
        await updatePointCloud();
    }
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
</style>
