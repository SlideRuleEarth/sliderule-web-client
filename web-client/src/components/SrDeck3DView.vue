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

function computeZoomToFitBoundingSphere(boundingRadius: number, fovyDeg = 50): number {
    const fovy = (fovyDeg * Math.PI) / 180;
    const halfFovy = fovy / 2;
    const distance = boundingRadius / Math.tan(halfFovy); // camera distance to fit radius
    return Math.log2(1 / distance); // Deck.gl zoom scale is log2-based
}

onMounted(async () => {
    await nextTick();
    const startTime = performance.now();
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
        console.log('rows.length:', rows.length);
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
            console.log('lonMin:', lonMin, 'lonMax:', lonMax, 'latMin:', latMin, 'latMax:', latMax, 'elevMin:', elevMin, 'elevMax:', elevMax);
            console.log('lonField:', lonField, 'latField:', latField, 'heightField:', heightField);
            const lonRange = lonMax - lonMin;
            const latRange = latMax - latMin;
            const elevRange = elevMax - elevMin;
            console.log('lonRange:', lonRange, 'latRange:', latRange, 'elevRange:', elevRange);
            const scatterData = rows.map((d) => {
                const x = (d[lonField] - lonMin) / lonRange;
                const y = (d[latField] - latMin) / latRange;
                const z = (d[heightField] - elevMin) / elevRange;
                return [x, y, z];
            }).filter(([x, y, z]) => isFinite(x) && isFinite(y) && isFinite(z));
            //console.log('Sr3DView scatterData:', scatterData);
            // compute bounding radius (diagonal from center to cube corner)
            const boundingRadius = Math.sqrt(0.5 ** 2 + 0.5 ** 2 + 0.5 ** 2); // ≈ 0.866
            const zoom = computeZoomToFitBoundingSphere(boundingRadius * 1.2); // 1.2 = padding factor
            console.log('computed zoom:', zoom);

            const layer = new ScatterplotLayer({
                id: 'scatter-3d',
                data: scatterData,
                getPosition: (d) => d,
                // getRadius: 2,
                // radiusUnits: 'pixels',
                getRadius: 0.005,
                radiusUnits: 'common',
                getFillColor: (d) => {
                    const z = d[2];
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
            const center = [
                (lonRange > 0 ? 0.5 : 0),
                (latRange > 0 ? 0.5 : 0),
                (elevRange > 0 ? 0.5 : 0),
            ];
            console.log('center:', center);
            new Deck({
                parent: deckContainer.value!,
                views: [new OrbitView({ orbitAxis: 'Z', fovy: 50 })],
                controller: {
                    type: OrbitController,
                    autoRotate: true,
                } as any,
                // initialViewState: {
                //     target: center,
                //     zoom,
                //     rotationX: 45,
                //     rotationOrbit: 45,
                // } as any,
                initialViewState: {
                    target: [1.353, 0.893, -0.94],
                    zoom: 7.8,
                    rotationX: 42.96,
                    rotationOrbit: 20.0,
                } as any,
                layers: [layer],
                onViewStateChange: ({ viewState }) => {
                    const { zoom, target, rotationX, rotationOrbit } = viewState;
                    console.log('Zoom:', zoom.toFixed(2));
                    console.log('Target:', target.map(n => n.toFixed(3)).join(', '));
                    console.log('RotationX:', rotationX?.toFixed(2));
                    console.log('RotationOrbit:', rotationOrbit?.toFixed(2));
                },

                onAfterRender: () => {
                    console.log('Deck rendered frame');
                },
                onClick: (info) => {
                    console.log('Clicked:', info.object);
                },
            });
        } else {
            toast.warn('No Data Processed', 'No elevation data returned.');
        }
    } catch (err) {
        console.error('Error loading 3D view:', err);
        toast.error('Error', 'Failed to load elevation data.');
    } finally {
        const endTime = performance.now();
        console.log(`Sr3DView took ${endTime - startTime} ms`);
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

