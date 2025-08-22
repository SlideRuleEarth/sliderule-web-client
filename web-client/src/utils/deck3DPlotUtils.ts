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
import proj4 from 'proj4';

// import log from '@probe.gl/log';
// log.level = 1;  // 0 = silent, 1 = minimal, 2 = verbose

import { toRaw, isProxy } from 'vue';
import { formatTime } from '@/utils/formatUtils';

const deck3DConfigStore = useDeck3DConfigStore();
const elevationStore = useElevationColorMapStore();
const fieldStore = useFieldNameStore();
const viewId = 'main';

let latField = '';
let lonField = '';
let heightField = '';
let timeField = '';

const deckInstance: Ref<Deck<OrbitView[]> | null> = ref(null);
// Module-level state for caching and Deck.gl instance
let cachedRawData: any[] = [];
let lastLoadedReqId: number | null = null;


// helper: pick a local metric CRS (UTM or polar)
function pickLocalMetricCRS(lat: number, lon: number): string {
    const absLat = Math.abs(lat);
    if (absLat >= 83) {
        // near poles: use polar stereographic
        return lat >= 0 ? 'EPSG:3413' : 'EPSG:3031';
    }
    const zone = Math.floor((lon + 180) / 6) + 1;
    return lat >= 0 ? `EPSG:326${String(zone).padStart(2, '0')}` // WGS84 / UTM N
                    : `EPSG:327${String(zone).padStart(2, '0')}`; // WGS84 / UTM S
}


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
        getTooltip: info => {
            if (!info.object) return null;
            const { lat, lon, elevation, cycle, time } = info.object;
            const timeStr = time ? formatTime(time) : '?';
            return {
                html: `
                    <div>
                        <strong>Longitude:</strong> ${lon?.toFixed(5)}<br>
                        <strong>Latitude:</strong> ${lat?.toFixed(5)}<br>
                        <strong>Elevation:</strong> ${elevation?.toFixed(2)} m <br>
                        <strong>Cycle:</strong> ${cycle ?? '?'}<br>
                        <strong>Time:</strong> ${timeStr ?? '?'}<br>
                    </div>
                `,
                style: {
                    background: 'rgba(20, 20, 20, 0.85)',
                    color: 'white',
                    padding: '8px',
                    fontSize: '13px',
                    borderRadius: '4px'
                }
            };
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
    timeField = fieldStore.getTimeFieldName(reqId);

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

            if (cachedRawData.length > 0) {
                latField = fieldStore.getLatFieldName(reqId);
                lonField = fieldStore.getLonFieldName(reqId);
                heightField = fieldStore.getHFieldName(reqId);

                // Compute min/max
                let elevMin = Infinity, elevMax = -Infinity;
                let latMin = Infinity, latMax = -Infinity;
                let lonMin = Infinity, lonMax = -Infinity;

                for (const row of cachedRawData) {
                    const lat = row[latField];
                    const lon = row[lonField];
                    const elev = row[heightField];
                    if (typeof lat === 'number' && isFinite(lat)) {
                        latMin = Math.min(latMin, lat);
                        latMax = Math.max(latMax, lat);
                    }
                    if (typeof lon === 'number' && isFinite(lon)) {
                        lonMin = Math.min(lonMin, lon);
                        lonMax = Math.max(lonMax, lon);
                    }
                    if (typeof elev === 'number' && isFinite(elev)) {
                        elevMin = Math.min(elevMin, elev);
                        elevMax = Math.max(elevMax, elev);
                    }
                }
            }


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
    if (!deckContainer || !deckContainer.value) {
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

    // --- helpers ---
    const pickLocalMetricCRS = (lat: number, lon: number): string => {
        const absLat = Math.abs(lat);
        if (absLat >= 83) return lat >= 0 ? 'EPSG:3413' : 'EPSG:3031'; // polar stereo
        const zone = Math.floor((lon + 180) / 6) + 1;
        return lat >= 0
            ? `EPSG:326${String(zone).padStart(2, '0')}` // UTM north
            : `EPSG:327${String(zone).padStart(2, '0')}`; // UTM south
    };

    // --- fast, in-memory processing ---
    const heightField = fieldStore.getHFieldName(lastLoadedReqId);

    const elevations = cachedRawData.map(d => d[heightField]).sort((a, b) => a - b);

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

    // geographic bounds (degrees)
    const lonMin = Math.min(...cachedRawData.map(d => d[lonField]));
    const lonMax = Math.max(...cachedRawData.map(d => d[lonField]));
    const latMin = Math.min(...cachedRawData.map(d => d[latField]));
    const latMax = Math.max(...cachedRawData.map(d => d[latField]));
    const lonMid = 0.5 * (lonMin + lonMax);
    const latMid = 0.5 * (latMin + latMax);

    // choose a local metric CRS
    const dstCrs = pickLocalMetricCRS(latMid, lonMid);

    // project SW/NE to meters → extents
    const [Emin, Nmin] = proj4('EPSG:4326', dstCrs, [lonMin, latMin]);
    const [Emax, Nmax] = proj4('EPSG:4326', dstCrs, [lonMax, latMax]);

    const Erange = Math.max(1e-6, Emax - Emin);
    const Nrange = Math.max(1e-6, Nmax - Nmin);

    // ---- Longest-axis scaling ----
    // The longest ground span maps to deck3DConfigStore.scale; the other axis shrinks proportionally.
    const targetScale = deck3DConfigStore.scale; // your "max side" length in world units
    const longestRange = Math.max(Erange, Nrange);
    const metersToWorld = targetScale / longestRange;

    const scaleX = Erange * metersToWorld; // <= targetScale
    const scaleY = Nrange * metersToWorld; // <= targetScale
    const scaleZ = Math.max(scaleX, scaleY); // keep Z axis length comparable

    elevationStore.updateElevationColorMapValues();
    const rgbaArray = elevationStore.elevationColorMap;

    // Map cached data → world coords
    const pointCloudData = cachedRawData
        .filter(d => {
            const h = d[heightField];
            return h >= elevMinData && h <= elevMaxData;
        })
        .map(d => {
            const [E, N] = proj4('EPSG:4326', dstCrs, [d[lonField], d[latField]]);
            // origin = SW corner → same framing; uniform metersToWorld keeps aspect ratio
            const x = metersToWorld * (E - Emin); // East
            const y = metersToWorld * (N - Nmin); // North

            // Z uses your percentile window; scale by scaleZ so ticks match the Z axis length
            const z =
                (deck3DConfigStore.verticalExaggeration / deck3DConfigStore.verticalScaleRatio) *
                scaleZ *
                (d[heightField] - elevMinScale) / elevRangeScale;

            // color unchanged
            const colorZ = Math.max(colorMin, Math.min(colorMax, d[heightField]));
            const colorNorm = (colorZ - colorMin) / colorRange;
            const index = Math.floor(colorNorm * (rgbaArray.length - 1));
            const rawColor =
                rgbaArray[Math.max(0, Math.min(index, rgbaArray.length - 1))] ??
                [255, 255, 255, 1];

            const color = [
                Math.round(rawColor[0]),
                Math.round(rawColor[1]),
                Math.round(rawColor[2]),
                Math.round(rawColor[3] * 255),
            ];

            return {
                position: [x, y, z] as [number, number, number],
                color,
                lat: d[latField],
                lon: d[lonField],
                elevation: d[heightField],
                cycle: d['cycle'],
                time: d[timeField] ?? null,
            };
        });

    computeCentroid(pointCloudData.map(p => p.position));

    // --- Layer creation ---
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
        layers.push(
            ...createAxesAndLabels(
                /* scaleX */ scaleX,
                /* scaleY */ scaleY,
                /* scaleZ */ scaleZ,
                'East',
                'North',
                'Elev (m)',
                [255, 255, 255],   // text color
                [200, 200, 200],   // line color
                5,                 // font size
                1,                 // line width
                elevMinScale,
                elevMaxScale,
                /* N meters */ Nmin, Nmax,
                /* E meters */ Emin, Emax   // pass meter extents
            )
        );
    }

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