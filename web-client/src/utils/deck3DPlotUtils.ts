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
const toast = useSrToastStore();
const deck3DConfigStore = useDeck3DConfigStore();
const elevationStore = useElevationColorMapStore();
const fieldStore = useFieldNameStore();
const viewId = 'main';

let latField = '';
let lonField = '';
let heightField = '';

const deckInstance: Ref<Deck<OrbitView[]> | null> = ref(null);
// Module-level state for caching and Deck.gl instance
let cachedRawData: any[] = [];
let lastLoadedReqId: number | null = null;



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

/**
 * [SLOW] Fetches data from DB, processes it, and stores it in the cache.
 * Should only be called when the request ID changes.
 */
export async function loadAndCachePointCloudData(reqId: number) {
    const toast = useSrToastStore();
    latField = fieldStore.getLatFieldName(reqId);
    lonField = fieldStore.getLonFieldName(reqId);
    heightField = fieldStore.getHFieldName(reqId);
    if (reqId === lastLoadedReqId) {
        console.log(`Data for reqId ${reqId} is already cached.`);
        return;
    }
    console.log(`Loading new data for reqId ${reqId}...`);
    
    try {
        const fieldStore = useFieldNameStore();
        const fileName = await indexedDb.getFilename(reqId);
        if (!fileName) throw new Error('Filename not found');

        const duckDbClient = await createDuckDbClient();
        await duckDbClient.insertOpfsParquet(fileName);
        const sample_fraction = await computeSamplingRate(reqId);
        const result = await duckDbClient.queryChunkSampled(`SELECT * FROM read_parquet('${fileName}')`, sample_fraction);
        const { value: rows = [] } = await result.readRows().next();

        if (rows.length > 0) {
            latField = fieldStore.getLatFieldName(reqId);
            lonField = fieldStore.getLonFieldName(reqId);
            heightField = fieldStore.getHFieldName(reqId);
            
            cachedRawData = rows.filter(d => {
                const lon = d[lonField];
                const lat = d[latField];
                const elev = d[heightField];
                return (
                    typeof lon === 'number' && Number.isFinite(lon) &&
                    typeof lat === 'number' && Number.isFinite(lat) &&
                    typeof elev === 'number' && Number.isFinite(elev)
                );
            });
            lastLoadedReqId = reqId;
            console.log(`Cached ${cachedRawData.length} valid data points.`);
        } else {
            cachedRawData = [];
            lastLoadedReqId = null;
            toast.warn('No Data Processed', 'No elevation data returned from query.');
        }
    } catch (err) {
        console.error('Error loading 3D view data:', err);
        toast.error('Error', 'Failed to load elevation data.');
        cachedRawData = [];
        lastLoadedReqId = null;
    }
}

/**
 * [FAST] Uses the cached data to regenerate and render layers.
 * This is safe to call frequently (e.g., from debounced UI handlers).
 */
export function renderCachedData(deckContainer: Ref<HTMLDivElement | null>) {
    if(!deckContainer || !deckContainer.value) {
        console.warn('Deck container is null or undefined');
        return;
    }
    if (!initDeckIfNeeded(deckContainer)) return;
    

    const deck3DConfigStore = useDeck3DConfigStore();
    const elevationStore = useElevationColorMapStore();
    const fieldStore = useFieldNameStore();

    if (!cachedRawData.length || lastLoadedReqId === null) {
        console.warn('No cached data available or last request ID is null');
        deckInstance.value?.setProps({ layers: [] });
        return;
    }

    // --- All your fast, in-memory data processing logic ---
    const heightField = fieldStore.getHFieldName(lastLoadedReqId);

    const elevations = cachedRawData.map(d => d[heightField]).sort((a, b) => a - b);
    // ... all your min/max/range/percentile calculations using `cachedRawData` ...
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

    const lonMin = Math.min(...cachedRawData.map(d => d[lonField]));
    const lonMax = Math.max(...cachedRawData.map(d => d[lonField]));

    const latMin = Math.min(...cachedRawData.map(d => d[latField]));
    const latMax = Math.max(...cachedRawData.map(d => d[latField]));

    const lonRange = Math.max(1e-6, lonMax - lonMin);
    const latRange = Math.max(1e-6, latMax - latMin);

    elevationStore.updateElevationColorMapValues();
    const rgbaArray = elevationStore.elevationColorMap;

    // Map cached data to point cloud format
    const pointCloudData = cachedRawData
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
    
    // --- Layer creation ---
    const layer = new PointCloudLayer({
        id: 'point-cloud-layer', // <-- STABLE ID IS CRITICAL FOR PERFORMANCE
        data: pointCloudData,
        getPosition: d => d.position,
        getColor: d => d.color,
        pointSize: deck3DConfigStore.pointSize,
        opacity: 0.95,
    });
    
    const layers: Layer<any>[] = [layer];
    
    if (deck3DConfigStore.showAxes) {
        // ... your axes creation logic ...
        layers.push(...createAxesAndLabels(
                    100, 
                    'East',
                    'North',
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
        ));
    }
    
    // --- Update Deck ---
    requestAnimationFrame(() => {
        deckInstance.value?.setProps({ layers });
    });
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