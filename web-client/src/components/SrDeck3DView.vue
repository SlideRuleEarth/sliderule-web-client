<template>
    <div ref="deckContainer" class="deck-canvas" />
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed, watch } from 'vue';
import type { Deck } from '@deck.gl/core';
import { Deck as DeckImpl } from '@deck.gl/core';
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

const deckContainer = ref<HTMLDivElement | null>(null);
const zoomRef = ref(0);
const fitZoom = ref(0);
const scale = 100;

const recTreeStore = useRecTreeStore();
const toast = useSrToastStore();
const fieldStore = useFieldNameStore();

const reqId = computed(() => recTreeStore.selectedReqId);

const elevationStore = useElevationColorMapStore();

const centroid = ref<[number, number, number]>([scale / 2, scale / 2, scale / 2]);
const deckInstance = ref<Deck<OrbitView[]> | null>(null);

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
        centroid.value = avg as [number, number, number];
    }
}

function initDeckInstance() {
    if (deckInstance.value) {
        deckInstance.value.finalize();
        deckInstance.value = null;
    }

    deckInstance.value = new DeckImpl<OrbitView[]>({
        parent: deckContainer.value!,
        views: [new OrbitView({ orbitAxis: 'Z', fovy: 50 })],
        controller: {
            type: OrbitController,
            autoRotate: false,
            inertia: 0,
            zoomSpeed: 0.02,
            rotateSpeed: 0.3,
            panSpeed: 0.5,
        } as any,
        initialViewState: {
            target: [...centroid.value],
            zoom: 5,
            rotationX: 45,
            rotationOrbit: 30,
        } as any,
        layers: [],
        onViewStateChange: ({ viewState }) => {
            zoomRef.value = viewState.zoom;
        },
        onClick: (info) => {
            console.log('Clicked:', info.object);
        },
        debug: true,
    });
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

            const totalPoints = validRows.length;
            const pointCloudData = validRows.map(d => {
                const x = scale * (d[lonField] - lonMin) / lonRange;
                const y = scale * (d[latField] - latMin) / latRange;
                const z = scale * (d[heightField] - elevMin) / elevRange;
                const index = Math.floor(z / scale * (rgbaArray.length - 1));
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

            const { width, height } = deckContainer.value!.getBoundingClientRect();
            fitZoom.value = Math.log2(Math.min(width, height) / scale);

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

            deckInstance.value?.setProps({ layers: [layer] });
        } else {
            toast.warn('No Data Processed', 'No elevation data returned.');
        }
    } catch (err) {
        console.error('Error loading 3D view:', err);
        toast.error('Error', 'Failed to load elevation data.');
    }
}

onMounted(async () => {
    updateMapAndPlot(false);
    await nextTick();
    elevationStore.updateElevationColorMapValues();
    await nextTick();
    if (elevationStore.elevationColorMap.length > 0) {
        await updatePointCloud();
    } else {
        toast.warn('No Gradient', 'Skipping point cloud due to missing gradient.');
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
    width: 100%;
    height: 600px;
    background: #111;
}
</style>
