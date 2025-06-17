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
import { ref,type Ref } from 'vue';
import { Deck } from '@deck.gl/core';

// import log from '@probe.gl/log';
// log.level = 1;  // 0 = silent, 1 = minimal, 2 = verbose

import { toRaw, isProxy } from 'vue';


const deckInstance: Ref<Deck<OrbitView[]> | null> = ref(null);

const toast = useSrToastStore();
const deck3DConfigStore = useDeck3DConfigStore();
const elevationStore = useElevationColorMapStore();
const fieldStore = useFieldNameStore();
const viewId = 'main';


/**
 * Strips Vue reactivity from Deck.gl-compatible data to prevent runtime Proxy errors.
 *
 * @param data - The data array to sanitize
 * @returns A plain array with raw objects safe to use with Deck.gl layers
 */
export function sanitizeDeckData<T extends Record<string, any>>(data: T[]): T[] {
    let sanitized: T[];

    if (isProxy(data)) {
        const raw = toRaw(data);
        sanitized = raw.map(item => ({ ...toRaw(item) }));
    } else {
        sanitized = data.map(item => ({ ...item }));
    }

    // ✅ Log sanitized output once
    console.log('Sanitized Deck.gl data sample:', sanitized.slice(0, 5),' num:',sanitized.length); // limit to 5 for readability
    return sanitized;
}



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




function initDeckIfNeeded(deckContainer: Ref<HTMLDivElement | null>): boolean {
    const container = deckContainer.value;
    if (!container) {
        console.warn('Deck container is null');
        return false;
    }

    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) {
        console.warn('Deck container has zero size:', width, height);
        return false;
    }

    if (!deckInstance.value) {
        createDeck(container);
    }
    return true;
}


function createDeck(container: HTMLDivElement) {
    console.log('createDeck inside:', container);
    deckInstance.value = new Deck({
        parent: container,
        useDevicePixels: false,
        _animate: false, // Disable animation for better performance
        views: [
            new OrbitView({
                id: viewId,
                orbitAxis: deck3DConfigStore.orbitAxis,
                fovy: deck3DConfigStore.fovy,
            }),
        ],
        controller: {
            type: OrbitController,
            inertia: 0,
            scrollZoom: {
                speed: deck3DConfigStore.zoomSpeed,
                smooth: false,
            },
            keyboard: {
                zoomSpeed: deck3DConfigStore.zoomSpeed,
                moveSpeed: deck3DConfigStore.panSpeed,
                rotateSpeedX: deck3DConfigStore.rotateSpeed,
                rotateSpeedY: deck3DConfigStore.rotateSpeed,
            },
        },
        initialViewState: {
            [viewId]: {
                target: deck3DConfigStore.centroid,
                zoom: deck3DConfigStore.fitZoom,
                rotationX: deck3DConfigStore.viewState.rotationX,
                rotationOrbit: deck3DConfigStore.viewState.rotationOrbit,
            },
        },
        layers: [],
        onViewStateChange: ({ viewState }) => {
            deck3DConfigStore.updateViewState(viewState);
        },
        debug: deck3DConfigStore.debug,
    });
}

export function finalizeDeck() {
    if (deckInstance.value) {
        deckInstance.value.finalize();
        deckInstance.value = null;
        console.log('Deck instance finalized');
    } else {
        console.warn('No Deck instance to finalize');
    }
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
        //console.log('Updating 3D Point Cloud for request ID:', reqId, 'in container:', deckContainer.value);
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

            const [minElScalePercent, maxElScalePercent] = deck3DConfigStore.elScaleRange;
            const elevMinScale = getPercentile(elevations, minElScalePercent);
            const elevMaxScale = getPercentile(elevations, maxElScalePercent);
            const elevRangeScale = Math.max(1e-6, elevMaxScale - elevMinScale);

            const [minElDataPercent, maxElDataPercent] = deck3DConfigStore.elDataRange;
            const elevMinData = getPercentile(elevations, minElDataPercent);
            const elevMaxData = getPercentile(elevations, maxElDataPercent);

            const lonMin = Math.min(...validRows.map(d => d[lonField]));
            const lonMax = Math.max(...validRows.map(d => d[lonField]));

            const latMin = Math.min(...validRows.map(d => d[latField]));
            const latMax = Math.max(...validRows.map(d => d[latField]));

            const lonRange = Math.max(1e-6, lonMax - lonMin);
            const latRange = Math.max(1e-6, latMax - latMin);

            elevationStore.updateElevationColorMapValues();
            const rgbaArray = elevationStore.elevationColorMap;

            const pointCloudData = validRows
            .filter(d => {
                const height = d[heightField];
                return height >= elevMinData && height <= elevMaxData;
            })
            .map(d => {
                const x = deck3DConfigStore.scale * (d[lonField] - lonMin) / lonRange;
                const y = deck3DConfigStore.scale * (d[latField] - latMin) / latRange;

                const z = deck3DConfigStore.verticalExaggeration *
                        deck3DConfigStore.scale *
                        (d[heightField] - elevMinScale) / elevRangeScale;

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
            if (!initDeckIfNeeded(deckContainer)) {
                toast.error('Deck container not ready', 'Check layout or timing.');
                console.error('Deck container not ready');
                return;
            }            
            const layer = new PointCloudLayer({
                id: `point-cloud-layer-${Date.now()}`, // Ensures a new identity each time
                data: sanitizeDeckData(pointCloudData),
                getPosition: d => d.position,
                getColor: d => d.color,
                pointSize: deck3DConfigStore.pointSize,
                opacity: 0.95,
                pickable: true,
            });
            const layers: Layer<any>[] = [layer];

            if (deck3DConfigStore.showAxes) {
                const zAxisLengthInMeters = elevMaxScale - elevMinScale;
                const [axes, labels, tickLines, tickText] = createAxesAndLabels(
                    zAxisLengthInMeters,
                    'Lon',
                    'Lat',
                    'Elev (m)',
                    [255, 255, 255], // text color
                    [200, 200, 200], // line color
                    5,               // font size
                    1,               // line width
                    elevMinScale,
                    elevMaxScale,
                    latMin,
                    latMax,
                    lonMin,
                    lonMax,
                    deck3DConfigStore.verticalExaggeration,
                );
                layers.push(axes, labels, tickLines, tickText);
            }

            if( deckInstance.value){
                requestAnimationFrame(() => {
                    deckInstance.value?.setProps({layers});
                    //console.log('Redrawing deck with new point cloud layer');
                    deckInstance.value?.redraw(); // <-- manual redraw for non-animated mode
                });
            }
        } else {
            toast.warn('No Data Processed', 'No elevation data returned.');
        }
    } catch (err) {
        console.error('Error loading 3D view:', err);
        toast.error('Error', 'Failed to load elevation data.');
    }
}

export function updateFovy(fovy: number) {
    requestAnimationFrame(() => {
        deckInstance.value?.setProps({
            views: [
                new OrbitView({
                    id: viewId,
                    orbitAxis: deck3DConfigStore.orbitAxis,
                    fovy: fovy,
                }),
            ],
        });
        console.log('Redrawing deck with new FOVY');
        deckInstance.value?.redraw(); // <-- manual redraw for non-animated mode
    });
}