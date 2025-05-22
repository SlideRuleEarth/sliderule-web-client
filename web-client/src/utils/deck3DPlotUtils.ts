import { PointCloudLayer } from '@deck.gl/layers';
import { createDuckDbClient } from '@/utils/SrDuckDb';
import { db as indexedDb } from '@/db/SlideRuleDb';
import { computeSamplingRate } from '@/utils/SrDuckDbUtils';
import { createAxesAndLabels } from '@/utils/deckAxes';
import type { Layer } from '@deck.gl/core';
import { useFieldNameStore } from '@/stores/fieldNameStore';
import { useSrToastStore } from '@/stores/srToastStore';
import { useDeck3DConfigStore } from '@/stores/deck3DConfigStore';
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore';
import { OrbitView, OrbitController } from '@deck.gl/core';
import { Deck } from '@deck.gl/core';
import { ref,type Ref } from 'vue';


const toast = useSrToastStore();
const deck3DConfigStore = useDeck3DConfigStore();
const elevationStore = useElevationColorMapStore();
const fieldStore = useFieldNameStore();
const deckInstance = ref<Deck | null>(null);
const viewId = 'main';


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

function initDeckInstance( deckContainer: Ref<HTMLDivElement | null>) {
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

function getPercentile(sorted: number[], p: number): number {
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}


export async function update3DPointCloud(reqId:number, deckContainer: Ref<HTMLDivElement | null>) {
    try {
        const status = await indexedDb.getStatus(reqId);
        if (status === 'error') return;

        const fileName = await indexedDb.getFilename(reqId);
        if (!fileName) throw new Error('Filename not found');

        const duckDbClient = await createDuckDbClient();
        await duckDbClient.insertOpfsParquet(fileName);

        const sample_fraction = await computeSamplingRate(reqId);
        const result = await duckDbClient.queryChunkSampled(
            `SELECT * FROM read_parquet('${fileName}')`,
            sample_fraction
        );

        const { value: rows = [], done } = await result.readRows().next();
        if (!done && rows.length > 0) {
            const latField = fieldStore.getLatFieldName(reqId);
            const lonField = fieldStore.getLonFieldName(reqId);
            const heightField = fieldStore.getHFieldName(reqId);

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
            const elevations = validRows.map(d => d[heightField]).sort((a, b) => a - b);
            const colorMin = getPercentile(elevations, deck3DConfigStore.minColorPercent);
            const colorMax = getPercentile(elevations, deck3DConfigStore.maxColorPercent);
            const colorRange = Math.max(1e-6, colorMax - colorMin);
            const [minElPercent, maxElPercent] = deck3DConfigStore.elRange;
            const elevMin = getPercentile(elevations, minElPercent);
            const elevMax = getPercentile(elevations, maxElPercent);
            const elevRange = Math.max(1e-6, elevMax - elevMin);
            const lonMin = Math.min(...validRows.map(d => d[lonField]));
            const lonMax = Math.max(...validRows.map(d => d[lonField]));
            const latMin = Math.min(...validRows.map(d => d[latField]));
            const latMax = Math.max(...validRows.map(d => d[latField]));
            const lonRange = Math.max(1e-6, lonMax - lonMin);
            const latRange = Math.max(1e-6, latMax - latMin);

            elevationStore.updateElevationColorMapValues();
            const rgbaArray = elevationStore.elevationColorMap;

            const pointCloudData = validRows.map(d => {
                const x = deck3DConfigStore.scale * (d[lonField] - lonMin) / lonRange;
                const y = deck3DConfigStore.scale * (d[latField] - latMin) / latRange;

                // z is *not* clamped — we preserve true geometry
                const z = deck3DConfigStore.scale * (d[heightField] - elevMin) / elevRange;

                // But color is computed using clamped-to-percentile range
                const colorZ = Math.max(colorMin, Math.min(colorMax, d[heightField]));
                const colorNorm = (colorZ - colorMin) / colorRange;
                const index = Math.floor(colorNorm * (rgbaArray.length - 1));
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
            initDeckInstance(deckContainer);
            const layer = new PointCloudLayer({
                id: 'point-cloud-layer',
                data: pointCloudData,
                getPosition: d => d.position,
                getColor: d => d.color,
                pointSize: deck3DConfigStore.pointSize,
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
