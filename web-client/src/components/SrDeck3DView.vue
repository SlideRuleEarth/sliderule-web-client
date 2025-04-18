<template>
    <div ref="deckContainer" class="deck-canvas" />
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed, watch } from 'vue';
import type { Deck } from '@deck.gl/core';
import { Deck as DeckImpl } from '@deck.gl/core';
import { PointCloudLayer } from '@deck.gl/layers';
import { OrbitView, OrbitController } from '@deck.gl/core';
import { useFieldNameCacheStore } from '@/stores/fieldNameStore';
import { useSrToastStore } from '@/stores/srToastStore';
import { useGradientColorMapStore } from '@/stores/gradientColorMapStore';
import { createDuckDbClient } from '@/utils/SrDuckDb';
import { db as indexedDb } from '@/db/SlideRuleDb';
import { computeSamplingRate } from '@/utils/SrDuckDbUtils';
import { useRecTreeStore } from '@/stores/recTreeStore';

const deckContainer = ref<HTMLDivElement | null>(null);
const zoomRef = ref(0);
const scale = 100;

const recTreeStore = useRecTreeStore();
const toast = useSrToastStore();
const fieldStore = useFieldNameCacheStore();
const reqIdStr = computed(() => recTreeStore.selectedReqIdStr);
const reqId = computed(() => recTreeStore.selectedReqId);

const gradientStore = useGradientColorMapStore(reqIdStr.value);
gradientStore.initializeColorMapStore();
const colorGradient = gradientStore.getGradientColorMap();

const deckInstance = ref<Deck<OrbitView[]> | null>(null);

async function updatePointCloud() {
    try {
        const status = await indexedDb.getStatus(reqId.value);
        if (status === 'error') {
            console.error('Sr3DView: request status is error — skipping');
            return;
        }

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

            const lonMin = Math.min(...rows.map(d => d[lonField]));
            const lonMax = Math.max(...rows.map(d => d[lonField]));
            const latMin = Math.min(...rows.map(d => d[latField]));
            const latMax = Math.max(...rows.map(d => d[latField]));
            const elevMin = Math.min(...rows.map(d => d[heightField]));
            const elevMax = Math.max(...rows.map(d => d[heightField]));

            const lonRange = lonMax - lonMin;
            const latRange = latMax - latMin;
            const elevRange = elevMax - elevMin;

            const pointCloudData = rows.map((d) => {
                const x = scale * (d[lonField] - lonMin) / lonRange;
                const y = scale * (d[latField] - latMin) / latRange;
                const z = scale * (d[heightField] - elevMin) / elevRange;
                const zNorm = z / scale;
                const index = Math.floor(zNorm * (colorGradient.length - 1));
                const rgba = colorGradient[Math.max(0, Math.min(index, colorGradient.length - 1))];
                const match = rgba.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
                const color = match
                    ? [
                          parseInt(match[1]),
                          parseInt(match[2]),
                          parseInt(match[3]),
                          Math.round(parseFloat(match[4]) * 255),
                      ]
                    : [255, 255, 255, 255];
                return { position: [x, y, z], color };
            }).filter(p => p.position.every(isFinite));

            const layer = new PointCloudLayer({
                id: 'point-cloud-layer',
                data: pointCloudData,
                getPosition: d => d.position,
                getColor: d => d.color,
                pointSize: 2,
                opacity: 0.95,
                pickable: true,
            });

            // 🧼 Replace existing layer(s) on the existing Deck instance
            if (deckInstance.value) {
                deckInstance.value.setProps({ layers: [layer] });
            }
        } else {
            toast.warn('No Data Processed', 'No elevation data returned.');
        }
    } catch (err) {
        console.error('Error loading 3D view:', err);
        toast.error('Error', 'Failed to load elevation data.');
    } finally {
        console.log(`Sr3DView completed.`);
    }
}

onMounted(async () => {
    await nextTick();

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
            target: [scale / 2, scale / 2, scale / 2],
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
        onAfterRender: () => {
            console.log('Deck rendered frame');
        },
        debug: true,
    });

    updatePointCloud();
});

// 🔁 Watch for reqId changes and refresh point cloud
watch(reqId, async (newVal, oldVal) => {
    if (newVal && newVal !== oldVal) {
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
