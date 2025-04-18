<template>
    <div style="position: absolute; top: 0; right: 0; color: white; padding: 0.5rem;">
        Zoom: {{ zoomRef.toFixed(2) }}
    </div>
    
    <div ref="deckContainer" class="deck-canvas" />
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { Deck } from '@deck.gl/core';
import { ScatterplotLayer } from '@deck.gl/layers';
import { OrbitView, OrbitController } from '@deck.gl/core';
import { useFieldNameCacheStore } from '@/stores/fieldNameStore';
import { useSrToastStore } from '@/stores/srToastStore';
import { useGradientColorMapStore } from '@/stores/gradientColorMapStore';
import { createDuckDbClient } from '@/utils/SrDuckDb';
import { db as indexedDb } from '@/db/SlideRuleDb';
import { computeSamplingRate } from '@/utils/SrDuckDbUtils';

const props = defineProps({
    reqId: {
        type: Number,
        required: true,
    },
});

const deckContainer = ref<HTMLDivElement | null>(null);
const zoomRef = ref(0);

const scale = 100;

onMounted(async () => {
    await nextTick();
    const toast = useSrToastStore();
    const fieldStore = useFieldNameCacheStore();
    const reqIdStr = props.reqId.toString();
    const gradientStore = useGradientColorMapStore(reqIdStr);
    gradientStore.initializeColorMapStore();
    const colorGradient = gradientStore.getGradientColorMap();

    if (!colorGradient || colorGradient.length === 0) {
        throw new Error('Gradient color map is empty or not initialized');
    }

    try {
        const status = await indexedDb.getStatus(props.reqId);
        if (status === 'error') {
            console.error('Sr3DView: request status is error — skipping');
            return;
        }

        const fileName = await indexedDb.getFilename(props.reqId);
        if (!fileName) throw new Error('Filename not found');

        const duckDbClient = await createDuckDbClient();
        await duckDbClient.insertOpfsParquet(fileName);

        const sample_fraction = await computeSamplingRate(props.reqId);
        const result = await duckDbClient.queryChunkSampled(
            `SELECT * FROM read_parquet('${fileName}')`,
            sample_fraction
        );

        const { value: rows = [], done } = await result.readRows().next();
        if (!done && rows.length > 0) {
            const latField = fieldStore.getLatFieldName(props.reqId);
            const lonField = fieldStore.getLonFieldName(props.reqId);
            const heightField = fieldStore.getHFieldName(props.reqId);

            const lonMin = Math.min(...rows.map(d => d[lonField]));
            const lonMax = Math.max(...rows.map(d => d[lonField]));
            const latMin = Math.min(...rows.map(d => d[latField]));
            const latMax = Math.max(...rows.map(d => d[latField]));
            const elevMin = Math.min(...rows.map(d => d[heightField]));
            const elevMax = Math.max(...rows.map(d => d[heightField]));

            const lonRange = lonMax - lonMin;
            const latRange = latMax - latMin;
            const elevRange = elevMax - elevMin;

            const scatterData = rows.map((d) => {
                const x = scale * (d[lonField] - lonMin) / lonRange;
                const y = scale * (d[latField] - latMin) / latRange;
                const z = scale * (d[heightField] - elevMin) / elevRange;
                return [x, y, z];
            }).filter(([x, y, z]) => isFinite(x) && isFinite(y) && isFinite(z));

            const center = [scale / 2, scale / 2, scale / 2];
            const zoom = 5;

            const layer = new ScatterplotLayer({
                id: 'scatter-3d',
                data: scatterData,
                getPosition: (d) => d,
                getRadius: 1,
                radiusUnits: 'common',
                getFillColor: (d) => {
                    const z = d[2] / scale;
                    const index = Math.floor(z * (colorGradient.length - 1));
                    const rgba = colorGradient[Math.max(0, Math.min(index, colorGradient.length - 1))];
                    const match = rgba.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
                    if (match) {
                        const r = parseInt(match[1]);
                        const g = parseInt(match[2]);
                        const b = parseInt(match[3]);
                        const a = Math.round(parseFloat(match[4]) * 255);
                        return [r, g, b, a];
                    }
                    return [255, 255, 255, 255];
                },
                opacity: 0.9,
                pickable: true,
            });

            new Deck({
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
                    target: center,
                    zoom,
                    rotationX: 45,
                    rotationOrbit: 30,
                } as any,
                layers: [layer],
                onViewStateChange: ({ viewState }) => {
                    zoomRef.value = viewState.zoom;
                    const { zoom, target, rotationX, rotationOrbit } = viewState;
                    console.log(`Zoom: ${zoom.toFixed(2)}`);
                    console.log(`Target: ${target.map(n => n.toFixed(3)).join(', ')}`);
                    console.log(`RotationX: ${rotationX?.toFixed(2)}`);
                    console.log(`RotationOrbit: ${rotationOrbit?.toFixed(2)}`);
                },
                onAfterRender: () => {
                    console.log('Deck rendered frame');
                },
                onClick: (info) => {
                    console.log('Clicked:', info.object);
                },
                debug: true,
            });
        } else {
            toast.warn('No Data Processed', 'No elevation data returned.');
        }
    } catch (err) {
        console.error('Error loading 3D view:', err);
        toast.error('Error', 'Failed to load elevation data.');
    } finally {
        console.log(`Sr3DView completed.`);
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

