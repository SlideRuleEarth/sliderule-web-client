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
import { useRecTreeStore } from '@/stores/recTreeStore';
import { useChartStore } from '@/stores/chartStore';

// import log from '@probe.gl/log';
// log.level = 1;  // 0 = silent, 1 = minimal, 2 = verbose

import { toRaw, isProxy } from 'vue';
import { formatTime } from '@/utils/formatUtils';
import { createLogger } from '@/utils/logger';

const logger = createLogger('Deck3DPlotUtils');

const deck3DConfigStore = useDeck3DConfigStore();
const recTreeStore = useRecTreeStore();
const fieldStore = useFieldNameStore();
const chartStore = useChartStore();
const viewId = 'main';

let latField = '';
let lonField = '';
let heightField = '';
let timeField = '';

const deckInstance: Ref<Deck<OrbitView[]> | null> = ref(null);
// Module-level state for caching and Deck.gl instance
let cachedRawData: any[] = [];
let lastLoadedReqId: number | null = null;
let verticalExaggerationInitialized = false;


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
    logger.debug('Sanitized Deck.gl data sample', { sample: sanitized.slice(0, 5), total: sanitized.length }); // limit to 5 for readability
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
    //console.log('Centroid:', deck3DConfigStore.centroid);
}


function initDeckIfNeeded(deckContainer: Ref<HTMLDivElement | null>): boolean {
    const container = deckContainer.value;
    if (!container) {
        logger.warn('Deck container is null');
        return false;
    }

    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) {
        logger.warn('Deck container has zero size', { width, height });
        return false;
    }

    if (!deckInstance.value) {
        createDeck(container);
    }
    return true;
}


function createDeck(container: HTMLDivElement) {
    //console.log('createDeck inside:', container);
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
            const {
                lat, lon, elevation, cycle, time,
                colorByLabel, colorByValue
            } = info.object;

            const timeStr = time ? formatTime(time) : '?';
            const colorByHtml =
                colorByLabel
                    ? `<strong>Color by:</strong> ${colorByLabel}${colorByValue !== null ? ` = ${colorByValue}` : ''}<br>`
                    : '';

            return {
                html: `
                <div>
                    <strong>Longitude:</strong> ${lon?.toFixed(5)}<br>
                    <strong>Latitude:</strong> ${lat?.toFixed(5)}<br>
                    <strong>Elevation (Z):</strong> ${Number.isFinite(elevation) ? elevation.toFixed(2) : '?'} m<br>
                    <strong>Cycle:</strong> ${cycle ?? '?'}<br>
                    ${colorByHtml}
                    <strong>Time:</strong> ${timeStr}<br>
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
        //console.log('Deck instance finalized');
    } else {
        logger.warn('No Deck instance to finalize');
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
        //console.log(`Data for reqId ${reqId} is already cached.`);
        return;
    }
    //console.log(`Loading new data for reqId ${reqId}...`);
    
    try {
        const fieldStore = useFieldNameStore();
        const fileName = await indexedDb.getFilename(reqId);
        if (!fileName) throw new Error('Filename not found');

        const duckDbClient = await createDuckDbClient();
        await duckDbClient.insertOpfsParquet(fileName);

        // Check if geometry column exists and build appropriate SELECT
        const colTypes = await duckDbClient.queryColumnTypes(fileName);
        const hasGeometry = colTypes.some(c => c.name === 'geometry');

        let selectClause: string;
        if (hasGeometry) {
            // Check if Z column exists as a separate column
            // If it does, geometry is 2D (Point) and Z is stored separately
            // If it doesn't, geometry is 3D (Point Z) and Z is in the geometry
            const hasZColumn = colTypes.some(c => c.name === heightField);
            const geometryHasZ = !hasZColumn;  // Z is in geometry if there's no separate Z column

            // Build column list: all columns except geometry (and z column if it's in geometry)
            const nonGeomCols = colTypes
                .filter(c => {
                    if (c.name === 'geometry') return false;
                    // If Z is in geometry, exclude the separate Z column
                    if (geometryHasZ && c.name === heightField) return false;
                    return true;
                })
                .map(c => duckDbClient.escape(c.name));

            // Add geometry extractions with field name aliases
            const geomExtractions = [
                `ST_X(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(lonField)}`,
                `ST_Y(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(latField)}`
            ];

            // Only extract Z from geometry if it has Z, otherwise include the separate column
            if (geometryHasZ) {
                geomExtractions.push(
                    `ST_Z(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(heightField)}`
                );
            } else {
                // Z is a separate column, already included in nonGeomCols
            }

            selectClause = [...nonGeomCols, ...geomExtractions].join(', ');
        } else {
            selectClause = '*';
        }

        const sample_fraction = await computeSamplingRate(reqId);
        const query = `SELECT ${selectClause} FROM read_parquet('${fileName}')`;
        const result = await duckDbClient.queryChunkSampled(query, sample_fraction);
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
            verticalExaggerationInitialized = false; // Reset flag for new data
            //console.log(`Cached ${cachedRawData.length} valid data points.`);

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
        logger.error('Error loading 3D view data', { error: err instanceof Error ? err.message : String(err) });
        toast.error('Error', 'Failed to load elevation data.');
        cachedRawData = [];
        lastLoadedReqId = null;
    }
}

/**
 * [FAST] Uses the cached data to regenerate and render layers.
 * This is safe to call frequently (e.g., from debounced UI handlers).
 */
// add at top if not already present

export function renderCachedData(deckContainer: Ref<HTMLDivElement | null>) {
    if (!deckContainer || !deckContainer.value) {
        logger.warn('Deck container is null or undefined');
        return;
    }
    if (!initDeckIfNeeded(deckContainer)) return;

    const deck3DConfigStore = useDeck3DConfigStore();
    const elevationStore = useElevationColorMapStore();
    const fieldStore = useFieldNameStore();

    if (!cachedRawData.length || lastLoadedReqId === null) {
        logger.warn('No cached data available or last request ID is null');
        deckInstance.value?.setProps({ layers: [] });
        return;
    }

    // --- fast, in-memory processing ---
    const selectedColorField = chartStore.getSelectedColorEncodeData(recTreeStore.selectedReqIdStr);
    //console.log('renderCachedData: selectedColorField:', selectedColorField, ' for reqId:', recTreeStore.selectedReqIdStr);
    const zField = fieldStore.getHFieldName(lastLoadedReqId);

    // helper
    const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

    // Gather arrays once
    const elevations = cachedRawData.map(d => d[zField]).filter(isFiniteNumber).sort((a, b) => a - b);

    // choose color field (fallback to zField if not present or not numeric)
    const hasColorField = selectedColorField && cachedRawData.some(d => isFiniteNumber(d[selectedColorField]));

    const cField = hasColorField ? selectedColorField : zField;

    // percentiles for COLOR scale come from the color values
    const colorValues = cachedRawData.map((d:any) => d[cField]).filter(isFiniteNumber).sort((a, b) => a - b);

    if (colorValues.length === 0) {
        // fall back to elevations to avoid NaN ranges
        colorValues.push(...elevations);
    }
    const colorMin = getPercentile(colorValues, deck3DConfigStore.minColorPercent);
    const colorMax = getPercentile(colorValues, deck3DConfigStore.maxColorPercent);
    const colorRange = Math.max(1e-6, colorMax - colorMin);
    //console.log(`renderCachedData hasColorField: ${hasColorField}, color field: ${cField} [${colorMin.toFixed(2)}, ${colorMax.toFixed(2)}] based on ${colorValues.length} samples`);
    // percentiles for Z scale still come from elevations
    const [minElScalePercent, maxElScalePercent] = deck3DConfigStore.elScaleRange;
    const elevMinScale = getPercentile(elevations, minElScalePercent);
    const elevMaxScale = getPercentile(elevations, maxElScalePercent);

    // data window (filter) still based on elevations
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

    // ---- Longest-axis scaling (XY) ----
    const targetScale = deck3DConfigStore.scale;   // length of the longest side in world units
    const longestRange = Math.max(Erange, Nrange);
    const metersToWorld = targetScale / longestRange; // COMMON factor for X and Y

    const scaleX = Erange * metersToWorld;  // ≤ targetScale
    const scaleY = Nrange * metersToWorld;  // ≤ targetScale

    // ---- Isotropic Z (meters → world) ----
    const h0 = elevMinScale; // base plane for Z (matches percentile window)
    const zRangeMeters = Math.max(1e-6, (elevMaxScale - elevMinScale));

    // Calculate vertical scale ratio based on z range vs x range
    const calculatedVerticalScaleRatio = Erange / zRangeMeters;
    //console.log(`Calculated verticalScaleRatio: ${calculatedVerticalScaleRatio.toFixed(2)} (Erange: ${Erange.toFixed(2)} m, zRange: ${zRangeMeters.toFixed(2)} m)`);
    deck3DConfigStore.verticalScaleRatio = calculatedVerticalScaleRatio;

    // Set vertical exaggeration to 1/2 of the calculated ratio (only once per dataset)
    if (!verticalExaggerationInitialized) {
        deck3DConfigStore.verticalExaggeration = calculatedVerticalScaleRatio / 2;
        verticalExaggerationInitialized = true;
        //console.log(`Initialized verticalExaggeration to: ${deck3DConfigStore.verticalExaggeration.toFixed(2)}`);
    }

    const zToWorld = metersToWorld * deck3DConfigStore.verticalExaggeration;
    const scaleZ = zToWorld * zRangeMeters; // Z axis length to pass to axes

    elevationStore.updateElevationColorMapValues();
    const rgbaArray = elevationStore.elevationColorMap;

    // Map cached data → world coords
    const pointCloudData = cachedRawData
        .filter(d => {
            const h = d[zField];
            return isFiniteNumber(h) && h >= elevMinData && h <= elevMaxData;
        })
        .map(d => {
            const [E, N] = proj4('EPSG:4326', dstCrs, [d[lonField], d[latField]]);
            // origin = SW corner → same framing; uniform metersToWorld keeps aspect ratio
            const x = metersToWorld * (E - Emin); // East (m → world)
            const y = metersToWorld * (N - Nmin); // North (m → world)
            const z = zToWorld * ((d[zField] as number) - h0); // Up

            // --- COLOR from cField (fallback handled above) ---
            const rawVal = d[cField] as number;
            const colorVal = Math.max(colorMin, Math.min(colorMax, rawVal));
            const colorNorm = (colorVal - colorMin) / colorRange;
            const idx = Math.floor(colorNorm * (rgbaArray.length - 1));
            const rawColor = rgbaArray[Math.max(0, Math.min(idx, rgbaArray.length - 1))] ?? [255, 255, 255, 1];
            const color = [
                Math.round(rawColor[0]),
                Math.round(rawColor[1]),
                Math.round(rawColor[2]),
                Math.round(rawColor[3] * 255),
            ];
            // Build a single "color-by" descriptor.
            // We *always* show Elevation and Cycle lines separately in the tooltip.
            // If color-by is Elevation or Cycle, we just show the label (no duplicate value).
            const colorByLabel = cField === zField ? 'Elevation'
                            : cField === 'cycle' ? 'Cycle'
                            : cField;

            const colorByValue =
                cField === zField || cField === 'cycle'
                    ? null
                    : (isFiniteNumber(rawVal) ? rawVal : null);

            return {
                position: [x, y, z] as [number, number, number],
                color,
                lat: d[latField],
                lon: d[lonField],
                elevation: d[zField],
                cycle: d['cycle'] ?? null,
                time: d[timeField] ?? null,
                colorByLabel,
                colorByValue,
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
                /* E meters */ Emin, Emax
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
        //console.log('Redrawing deck with new FOVY');
        deckInstance.value?.redraw(); // <-- manual redraw for non-animated mode
    });
}