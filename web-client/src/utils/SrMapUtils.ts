import { useMapStore } from '@/stores/mapStore';
import { computed } from 'vue';
import { useGeoJsonStore } from '@/stores/geoJsonStore';
import { ScatterplotLayer } from '@deck.gl/layers';
import GeoJSON from 'ol/format/GeoJSON';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { fromLonLat, type ProjectionLike } from 'ol/proj';
import { Layer as OLlayer } from 'ol/layer';
import type OLMap from 'ol/Map.js';
import { unByKey } from 'ol/Observable';
import type { EventsKey } from 'ol/events';
import type { ExtHMean } from '@/workers/workerUtils';
import { Style, Icon, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { Text as TextStyle } from 'ol/style';
import { getSpotNumber, getGtsForSpotsAndScOrients } from '@/utils/spotUtils';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { useDeckStore } from '@/stores/deckStore';
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore';
import { useSrToastStore } from '@/stores/srToastStore';
import { useAdvancedModeStore } from '@/stores/advancedModeStore';
import { useAnalysisMapStore } from '@/stores/analysisMapStore';
import { srViews } from "@/composables/SrViews";
import { srProjections } from "@/composables/SrProjections";
import { get as getProjection } from 'ol/proj.js';
import { getLayer } from "@/composables/SrLayers";
import { getTransform } from 'ol/proj.js';
import { applyTransform } from 'ol/extent.js';
import { View as OlView } from 'ol';
import { getCenter as getExtentCenter } from 'ol/extent.js';
import {
    readOrCacheSummary,
    getColsForRgtYatcFromFile,
    getAllCycleOptionsInFile,
    getAllRgtOptionsInFile,
    getAllColumnMinMax,
    duckDbReadAndUpdateElevationData,
    getAllFilteredCycleOptionsFromFile
} from "@/utils/SrDuckDbUtils";
import type { PickingInfo } from '@deck.gl/core';
import type { MjolnirEvent } from 'mjolnir.js';
import { clearPlot, updatePlotAndSelectedTrackMapLayer } from '@/utils/plotUtils';
import { Polygon as OlPolygon } from 'ol/geom';
import { db } from '@/db/SlideRuleDb';
import type { Coordinate } from 'ol/coordinate';
import type { SrRegion } from '@/types/SrTypes';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { useGlobalChartStore } from '@/stores/globalChartStore';
import { useActiveTabStore } from '@/stores/activeTabStore';
import { useAreaThresholdsStore } from '@/stores/areaThresholdsStore';
import { formatKeyValuePair } from '@/utils/formatUtils';
import router from '@/router/index.js';
import {
    type Atl13Coord,
    type SrPosition,
    type SrRGBAColor,
    EL_LAYER_NAME_PREFIX,
    SELECTED_LAYER_NAME_PREFIX,
    polyColor,
    hullColor,
    pointColor
} from '@/types/SrTypes';
import { useFieldNameStore } from '@/stores/fieldNameStore';
import { createUnifiedColorMapperRGBA } from '@/utils/colorUtils';
import { boundingExtent } from 'ol/extent';
import type { Geometry } from 'ol/geom';
import type { Extent } from 'ol/extent';
import type { SrLatLon } from '@/types/SrTypes';
import type { FeatureLike } from 'ol/Feature';
import VectorLayer from 'ol/layer/Vector';
import Point from 'ol/geom/Point';
import Overlay from 'ol/Overlay';
import { extractSrRegionFromGeometry, processConvexHull } from '@/utils/geojsonUploader';
 

// This grabs the constructor’s first parameter type
type ScatterplotLayerProps = ConstructorParameters<typeof ScatterplotLayer>[0];

export const polyCoordsExist = computed(() => {
    let exist = false;
    if (useGeoJsonStore().getReqGeoJsonData()) {
        exist = true;
    } else if (useMapStore().polyCoords.length > 0) {
        exist = true;
    } else {
        exist = false;
    }
    return exist;
});

export const clearReqGeoJsonData = () => {
    if (useGeoJsonStore().getReqGeoJsonData()) { // clear any previous geojson data
        useGeoJsonStore().setReqGeoJsonData(null);
    }
};

export const clearPolyCoords = () => {
    useMapStore().polyCoords = [];
    clearReqGeoJsonData();
};

export function extractCoordinates(geometry: any): Coordinate[] {
    if (!geometry) return [];

    switch (geometry.getType()) {
        case 'Point':
            return [geometry.getCoordinates()];
        case 'LineString':
        case 'MultiPoint':
            return geometry.getCoordinates();
        case 'Polygon':
        case 'MultiLineString':
            return geometry.getCoordinates().flat();
        case 'MultiPolygon':
            return geometry.getCoordinates().flat(2);
        default:
            console.warn('Unknown geometry type:', geometry.getType());
            return [];
    }
}

function unwrapGeoJson(input: string | unknown): any {
    // 1) parse if stringified
    let data: any = input;
    if (typeof data === 'string') {
        const trimmed = data.trim();
        try { data = JSON.parse(trimmed); } catch { /* it might already be raw GeoJSON string */ }
    }

    // 2) peel common wrappers
    if (data && typeof data === 'object') {
        if (data.server?.rqst?.parms?.region_mask?.geojson)
            data = data.server.rqst.parms.region_mask.geojson;
        else if (data.region_mask?.geojson)
            data = data.region_mask.geojson;
        else if (data.geojson)
            data = data.geojson;
    }

    // 3) if geojson is still a string, parse it
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { /* leave as string; OL can ingest a raw JSON string */ }
    }

    return data;
}


export function drawGeoJson(
    uniqueId: string,
    vectorSource: VectorSource,
    geoJsonData: string | object,
    color: string,
    noFill: boolean = false,
    tag: string = '',
    dataProjection: string = 'EPSG:4326'
): Extent | undefined {
    const map = useMapStore().map;
    if (!map || !vectorSource || !geoJsonData) return;
    console.log(`drawGeoJson called with uniqueId: ${uniqueId}, color: ${color}, noFill: ${noFill}, tag: ${tag} dataProjection: ${dataProjection} geoJsonData:`, geoJsonData);
    const geoJsonString = typeof geoJsonData === 'string'
        ? geoJsonData.trim()
        : JSON.stringify(geoJsonData);

    const format = new GeoJSON();
    let features: Feature[] = [];
    try {
        console.log('Parsing GeoJSON data:', geoJsonString);

        const normalized = unwrapGeoJson(geoJsonData);

        // Optional: validate before passing to OL
        if (!normalized || (typeof normalized === 'object' && !normalized.type)) {
            console.error('drawGeoJson: input is not a valid GeoJSON object (missing "type"). Got:', normalized);
            return;
        }

        features = format.readFeatures(normalized, {
            dataProjection,
            featureProjection: useMapStore().getSrViewObj()?.projectionName || 'EPSG:3857',
        });
    } catch (e) {
        console.error('Failed to parse GeoJSON:', e);
        return;
    }

    features.forEach((feature, i) => {
        feature.setId(`feature-${uniqueId}-${i}`);
        feature.set('tag', tag || uniqueId);

        const geometry = feature.getGeometry();
        const props = feature.getProperties();
        const isPoint = geometry?.getType() === 'Point';

        if (isPoint) {
            const coord = (geometry as Point).getCoordinates();
            const markerSymbol = props['marker-symbol'];
            const markerColor = props['marker-color'] || color;

            // Fallback circle style
            const fallbackStyle = new Style({
                image: new CircleStyle({
                    radius: 6,
                    fill: new Fill({ color: markerColor }),
                    stroke: new Stroke({ color: '#fff', width: 1 })
                })
            });

            if (markerSymbol) {
                const iconUrl = `/icons/${markerSymbol}.png`;

                const img = new Image();
                img.onload = () => {
                    feature.setStyle(new Style({
                        image: new Icon({
                            anchor: [0.5, 1],
                            src: `/icons/${markerSymbol}.png`,
                            scale: 1,
                            crossOrigin: 'anonymous',
                        }),
                    }));
                };
                img.onerror = () => {
                    console.warn(`⚠️ Missing icon: ${iconUrl}`);
                    feature.setStyle(fallbackStyle);
                };
                img.src = iconUrl;
            } else {
                feature.setStyle(fallbackStyle);
            }

            // Add label overlay
            const label = props.name || props.title;
            if (label && map) {
                const el = document.createElement('div');
                el.className = 'ol-marker-label';
                el.innerText = label;

                const overlay = new Overlay({
                    element: el,
                    position: coord,
                    positioning: 'bottom-center',
                    stopEvent: false,
                    offset: [0, -18]
                });

                map.addOverlay(overlay);
            }

        } else {
            const style = new Style({
                stroke: new Stroke({ color, width: 2 }),
                fill: noFill ? undefined : new Fill({ color: color.replace(/, *1\)$/, ', 0.1)') }),
            });
            feature.setStyle(style);
        }
    });

    vectorSource.addFeatures(features);

    return getBoundingExtentFromFeatures(features);
}

/**
 * NEW (moved from useGeoJsonUploader): Load + draw features from a GeoJSON object,
 * optionally computing and drawing a convex hull for request polygons.
 */
export async function handleGeoJsonLoad(
    map: OLMap,
    geoJsonData: any,
    options: { loadReqPoly?: boolean } = {}
): Promise<number[] | undefined> {
    const { loadReqPoly = false } = options;
    const srToast = useSrToastStore();

    const features = geoJsonData?.features;
    if (!features || features.length === 0) {
        srToast.error('GeoJSON Error', 'GeoJSON file has no features');
        return;
    }

    const targetLayerName = loadReqPoly ? 'Drawing Layer' : 'Uploaded Features';
    const vectorLayer = map.getLayers().getArray().find((layer: any) =>
        layer.get('name') === targetLayerName
    );

    if (!vectorLayer || !(vectorLayer instanceof VectorLayer)) {
        srToast.error('Layer Error', `Could not find expected vector layer: ${targetLayerName}`);
        return;
    }

    const vectorSource = vectorLayer.getSource();
    if (!vectorSource) {
        srToast.error('Source Error', 'Vector layer has no source');
        return;
    }

    let combinedExtent: number[] | undefined;
    let allCoords: SrRegion = [];

    for (let fIndex = 0; fIndex < features.length; fIndex++) {
        const feature = features[fIndex];
        const geometry = feature.geometry;
        const properties = feature.properties || {};

        if (!geometry) continue;

        if (geometry.type === 'Polygon') {
            const srRegion = extractSrRegionFromGeometry(geometry);
            if (srRegion.length >= 3) {
                allCoords.push(...srRegion);
                const extent = drawGeoJson(
                    `polygon-${fIndex + 1}`,
                    vectorSource,
                    JSON.stringify({ type: 'Feature', geometry, properties }),
                    polyColor,
                    false,
                    `polygon-${fIndex + 1}`
                );
                if (extent) combinedExtent = expandExtent(combinedExtent, extent);
            } else {
                srToast.warn('Skipping Invalid Polygon', `Polygon in feature ${fIndex + 1} has less than 3 points.`);
            }

        } else if (geometry.type === 'MultiPolygon') {
            const polygons = geometry.coordinates as number[][][][];
            for (let i = 0; i < polygons.length; i++) {
                const outerRing = polygons[i][0];
                if (Array.isArray(outerRing) && outerRing.length >= 3) {
                    const srRegion: SrRegion = outerRing.map(coord => ({ lon: coord[0], lat: coord[1] }));
                    allCoords.push(...srRegion);

                    const polygonFeature = {
                        type: 'Feature',
                        geometry: {
                            type: 'Polygon',
                            coordinates: [outerRing]
                        },
                        properties
                    };

                    const extent = drawGeoJson(
                        `multipolygon-${fIndex + 1}-${i + 1}`,
                        vectorSource,
                        JSON.stringify(polygonFeature),
                        polyColor,
                        false,
                        `polygon-${fIndex + 1}-${i + 1}`
                    );
                    if (extent) combinedExtent = expandExtent(combinedExtent, extent);
                } else {
                    srToast.warn('Skipping Invalid MultiPolygon Part',
                        `MultiPolygon part ${i + 1} in feature ${fIndex + 1} has less than 3 points.`);
                }
            }

        } else if (geometry.type === 'LineString') {
            const coords = geometry.coordinates as number[][];
            if (Array.isArray(coords) && coords.length >= 2) {
                // add vertices to hull inputs
                allCoords.push(...coords.map(c => ({ lon: c[0], lat: c[1] })));

                const lineFeature = {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: coords
                    },
                    properties
                };

                const extent = drawGeoJson(
                    `linestring-${fIndex + 1}`,
                    vectorSource,
                    JSON.stringify(lineFeature),
                    /* use a dedicated lineColor if you have one */ polyColor,
                    false,
                    `line-${fIndex + 1}`
                );
                if (extent) combinedExtent = expandExtent(combinedExtent, extent);
            } else {
                srToast.warn('Skipping Invalid LineString',
                    `LineString in feature ${fIndex + 1} has less than 2 points.`);
            }

        } else if (geometry.type === 'MultiLineString') {
            const lines = geometry.coordinates as number[][][];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (Array.isArray(line) && line.length >= 2) {
                    allCoords.push(...line.map(c => ({ lon: c[0], lat: c[1] })));

                    const lineFeature = {
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: line
                        },
                        properties
                    };

                    const extent = drawGeoJson(
                        `multilinestring-${fIndex + 1}-${i + 1}`,
                        vectorSource,
                        JSON.stringify(lineFeature),
                        /* use a dedicated lineColor if you have one */ polyColor,
                        false,
                        `line-${fIndex + 1}-${i + 1}`
                    );
                    if (extent) combinedExtent = expandExtent(combinedExtent, extent);
                } else {
                    srToast.warn('Skipping Invalid MultiLineString Part',
                        `MultiLineString part ${i + 1} in feature ${fIndex + 1} has less than 2 points.`);
                }
            }

        } else if (geometry.type === 'Point') {
            const coord = geometry.coordinates;
            allCoords.push({ lon: coord[0], lat: coord[1] });

            const pointFeature = {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: coord
                },
                properties
            };

            const extent = drawGeoJson(
                `point-${fIndex + 1}`,
                vectorSource,
                JSON.stringify(pointFeature),
                pointColor,
                false,
                `point-${fIndex + 1}`
            );
            if (extent) combinedExtent = expandExtent(combinedExtent, extent);

        } else if (geometry.type === 'MultiPoint') {
            const coords = geometry.coordinates;
            for (let i = 0; i < coords.length; i++) {
                const coord = coords[i];
                allCoords.push({ lon: coord[0], lat: coord[1] });

                const pointFeature = {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: coord
                    },
                    properties
                };

                const extent = drawGeoJson(
                    `multipoint-${fIndex + 1}-${i + 1}`,
                    vectorSource,
                    JSON.stringify(pointFeature),
                    pointColor,
                    false,
                    `point-${fIndex + 1}-${i + 1}`
                );
                if (extent) combinedExtent = expandExtent(combinedExtent, extent);
            }

        } else {
            console.warn('Unsupported geometry type:', geometry.type);
            srToast.warn('Unsupported Geometry', `Feature ${fIndex + 1} has unsupported geometry type: ${geometry.type}`);
        }
    }

    if (loadReqPoly) {
        const geoJsonStore = useGeoJsonStore();
        const reqParamsStore = useReqParamsStore();
        if (allCoords.length >= 3) {
            const { geoJson, label } = processConvexHull(allCoords);
            const extent = drawGeoJson(
                'combined-convexHull',
                vectorSource,
                JSON.stringify(geoJson),
                hullColor,
                false,
                `${label}-combined`
            );
            if (extent) combinedExtent = expandExtent(combinedExtent, extent);

            reqParamsStore.poly = geoJson.geometry.coordinates[0].map(
                (coord: number[]) => ({ lon: coord[0], lat: coord[1] })
            );
        } else {
            srToast.warn('Convex Hull Skipped', 'Not enough valid points to construct a convex hull.');
        }
    }

    return combinedExtent;
}

function expandExtent(current: number[] | undefined, next: number[]): number[] {
    if (!current) return next;
    return [
        Math.min(current[0], next[0]),
        Math.min(current[1], next[1]),
        Math.max(current[2], next[2]),
        Math.max(current[3], next[3])
    ];
}

export function enableTagDisplay(map: OLMap, vectorSource: VectorSource): void {
    const mapStore = useMapStore();
    mapStore.pointerMoveListenerKey = map.on('pointermove', function (evt) {
        const pixel = map.getEventPixel(evt.originalEvent);
        const features = map.getFeaturesAtPixel(pixel);

        if (mapStore.tooltipRef) {
            if (features && features.length > 0) {
                const feature = features[0];
                const tag = feature.get('tag');
                if (tag) {
                    const { clientX, clientY } = evt.originalEvent;
                    mapStore.tooltipRef.showTooltip({ clientX, clientY } as MouseEvent, `Area: ${tag}`);
                }
            } else {
                mapStore.tooltipRef.hideTooltip();
            }
        } else {
            console.warn('enableTagDisplay: tooltipRef is not set in MapStore.');
        }
    });

    map.getViewport().addEventListener('mouseout', function () {
        useMapStore().tooltipRef.hideTooltip();
    });
}

export function disableTagDisplay(): void {
    const pointerMoveListenerKey = useMapStore().getPointerMoveListenerKey();
    if (pointerMoveListenerKey !== null) {
        unByKey(pointerMoveListenerKey as EventsKey);
        useMapStore().setPointerMoveListenerKey(null);
    }
}

export function formatElObject(obj: { [key: string]: any }): string {
    const html = Object.entries(obj)
        .filter(([key]) => key !== 'extent_id' && key !== '__rgba')
        .map(([key, value]) => formatKeyValuePair(key, value))
        .join('<br>');
    return html;
}

export interface ElevationDataItem {
    [key: string]: any;
}

function isInvalid(value: any): boolean {
    return value === null || value === undefined || value === '' || Number.isNaN(value);
}

function hasValidIdFields(d: ElevationDataItem): boolean {
    return (!isInvalid(d?.cycle) && !isInvalid(d?.rgt)) ||
        (!isInvalid(d?.orbit) && !isInvalid(d?.track));
}

export async function setCyclesGtsSpotsFromFileUsingRgtYatc() {
    const reqIdStr = useRecTreeStore().selectedReqIdStr;
    const api = useRecTreeStore().findApiForReqId(parseInt(reqIdStr));
    const gcs = useGlobalChartStore();

    if (!api.includes('atl03') || !api.includes('atl08')) {
        if (gcs.use_y_atc_filter && !isInvalid(gcs.selected_y_atc)) {
            const y_atc_filtered_Cols = await getColsForRgtYatcFromFile(useRecTreeStore().selectedReqId, ['spot', 'cycle', 'gt']);

            if (y_atc_filtered_Cols) {
                const prevSpots = gcs.getSpots();
                const prevCycles = gcs.getCycles();
                const prevGts = gcs.getGts();

                const y_atc_filtered_spots = y_atc_filtered_Cols.spot.filter(spot => !isInvalid(spot)).sort((a, b) => a - b);
                const y_atc_filtered_cycles = y_atc_filtered_Cols.cycle.filter(cycle => !isInvalid(cycle)).sort((a, b) => a - b);
                const y_atc_filtered_gts = y_atc_filtered_Cols.gt.filter(gt => !isInvalid(gt));

                const spotsChanged = JSON.stringify(prevSpots) !== JSON.stringify(y_atc_filtered_spots);
                const cyclesChanged = JSON.stringify(prevCycles) !== JSON.stringify(y_atc_filtered_cycles);
                const gtsChanged = JSON.stringify(prevGts) !== JSON.stringify(y_atc_filtered_gts);

                if (spotsChanged) console.log("setCyclesGtsSpotsFromFileUsingRgtYatc Spots changed by y_atc_filter:", { prev: prevSpots, new: y_atc_filtered_spots });
                if (cyclesChanged) console.log("setCyclesGtsSpotsFromFileUsingRgtYatc Cycles changed by y_atc_filter:", { prev: prevCycles, new: y_atc_filtered_cycles });
                if (gtsChanged) console.log("setCyclesGtsSpotsFromFileUsingRgtYatc GTs changed by y_atc_filter:", { prev: prevGts, new: y_atc_filtered_gts });

                gcs.setSpots(y_atc_filtered_spots);
                gcs.setGts(y_atc_filtered_gts);
                gcs.setCycles(y_atc_filtered_cycles);
                const selectedCycleOptions = gcs.getSelectedCycleOptions();
                gcs.setFilteredCycleOptions(selectedCycleOptions);
            }
        }
    } else {
        console.warn('setCyclesGtsSpotsFromFileUsingRgtYatc: Ignored for ATL03. TBD need to implement an atl03 equivalent function for y_atc?');
    }
}

export function isClickable(d: ElevationDataItem): boolean {
    return hasValidIdFields(d) && (d?.y_atc === undefined || !isInvalid(d.y_atc));
}

export async function processSelectedElPnt(d: ElevationDataItem): Promise<void> {
    const gcs = useGlobalChartStore();
    gcs.setSelectedElevationRec(d);
    const ttRef = useMapStore().tooltipRef;
    if (ttRef) {
        ttRef.hideTooltip();
    }
    useAtlChartFilterStore().setShowPhotonCloud(false);
    clearPlot();
    useAtlChartFilterStore().setSelectedOverlayedReqIds([]);
    const mission = useFieldNameStore().getMissionForReqId(useRecTreeStore().selectedReqId);

    if (mission === 'ICESat-2') {
        if (d.track !== undefined) {
            gcs.setTracks([d.track]);
            gcs.setGtsForTracks(gcs.getTracks());
        }
        if ((d.gt !== undefined) && (d.spot !== undefined)) {
            gcs.setFilterWithSpotAndGt(d.spot, d.gt);
        } else {
            if ((d.sc_orient !== undefined) && (d.track !== undefined) && (d.pair !== undefined)) {
                const spot = getSpotNumber(d.sc_orient, d.track, d.pair);
                gcs.setSpots([spot]);
                const gts = getGtsForSpotsAndScOrients(gcs.getSpots(), gcs.getScOrients());
                gcs.setGts(gts);
            } else {
                console.error('d.spot or d.gt is undefined when sc_orient and spot are undefined?');
            }
        }

        if (d.sc_orient !== undefined) gcs.setScOrients([d.sc_orient]);
        if (d.pair !== undefined) gcs.setPairs([d.pair]);
        if (d.rgt !== undefined) {
            gcs.setRgt(d.rgt);
        } else {
            console.error('d.rgt is undefined');
        }
        if (d.cycle !== undefined) {
            gcs.setCycles([d.cycle]);
        } else {
            console.error('d.cycle is undefined');
        }
        gcs.selected_y_atc = d.y_atc;
        if (gcs.use_y_atc_filter) {
            await setCyclesGtsSpotsFromFileUsingRgtYatc();
        }
    } else if (mission === 'GEDI') {
        gcs.setRgt(d.track);
        if (d.orbit !== undefined) {
            gcs.setCycles([d.orbit]);
        } else {
            console.error('processSelectedElPnt: GEDI d.orbit is undefined');
        }
        gcs.setSpots([d.beam]);
    } else {
        console.error('processSelectedElPnt: Unknown mission:', mission);
    }
}

export async function clicked(d: ElevationDataItem): Promise<void> {
    if (!isClickable(d)) {
        console.warn('clicked: invalid elevation point:', d);
        useSrToastStore().warn('Clicked data point contains NaNs', 'Please Click on another point.');
        return;
    }
    await processSelectedElPnt(d);
    const msg = `clicked ${d}`;
    await updatePlotAndSelectedTrackMapLayer(msg);
}

export async function syncAllCycleOptionsFromFile(): Promise<void> {
    const globalChartStore = useGlobalChartStore();
    const retObj = await getAllCycleOptionsInFile(useRecTreeStore().selectedReqId);
    globalChartStore.setCycleOptions(retObj.cycleOptions);
}

export async function resetCycleOptions(): Promise<void> {
    syncAllCycleOptionsFromFile();
    useGlobalChartStore().setCycleOptions(useGlobalChartStore().getCycleOptions());
}

export async function resetFilterCycleOptions(): Promise<void> {
    syncAllCycleOptionsFromFile();
    const globalChartStore = useGlobalChartStore();
    const filteredCycleOptions = await getAllFilteredCycleOptionsFromFile(useRecTreeStore().selectedReqId);
    globalChartStore.setFilteredCycleOptions(filteredCycleOptions);
    globalChartStore.setSelectedCycleOptions(filteredCycleOptions);
}

export async function resetFilterRgtOptions(): Promise<void> {
    const globalChartStore = useGlobalChartStore();
    const rgtOptions = await getAllRgtOptionsInFile(useRecTreeStore().selectedReqId);
    globalChartStore.setRgtOptions(rgtOptions);
}

export async function resetFilter(): Promise<void> {
    resetCycleOptions();
    resetFilterRgtOptions();
}

export async function resetFilterUsingSelectedRec() {
    const gcs = useGlobalChartStore();
    const selectedRec = gcs.getSelectedElevationRec();
    if (selectedRec) {
        await processSelectedElPnt(selectedRec);
    } else {
        console.warn('resetFilterUsingSelectedRec: selectedRec is null');
    }
    resetFilterCycleOptions();
    resetFilterRgtOptions();
}

export function createDeckLayer(
    name: string,
    elevationData: ElevationDataItem[],
    extHMean: ExtHMean,
    heightFieldName: string,
    positions: SrPosition[],
    projName: string
): ScatterplotLayer {
    const startTime = performance.now();
    const elevationColorMapStore = useElevationColorMapStore();
    const deckStore = useDeckStore();
    const highlightPntSize = deckStore.getPointSize() + 1;

    const colorFn = createUnifiedColorMapperRGBA({
        colorMap: elevationColorMapStore.getElevationColorMap(),
        min: extHMean.lowHMean,
        max: extHMean.highHMean,
        valueAccessor: d => d[heightFieldName]
    });
    const precomputedColors = elevationData.map(colorFn);

    const dataWithColor = elevationData.map((d, i) => ({
        ...d,
        __rgba: precomputedColors[i] as [number, number, number, number]
    }));

    const isSelectedLayer = name.includes(SELECTED_LAYER_NAME_PREFIX);

    const layerProps = {
        id: name,
        visible: true,
        data: dataWithColor,
        getPosition: (_d: any, { index }: { index: number }) => positions[index],
        getNormal: [0, 0, 1],
        getRadius: highlightPntSize,
        radiusUnits: 'pixels',
        pickable: true,
        onHover: onHoverHandler,
        onClick: (info: PickingInfo) => {
            if (info.object) clicked(info.object);
        },
        onError: (error: Error) => console.error(`Error in ScatterplotLayer ${name}:`, error),
        parameters: { depthTest: false },
        ...(isSelectedLayer
            ? {
                stroked: true,
                filled: false,
                getLineWidthUnits: 'pixels' as const,
                getLineWidth: 1,
                getLineColor: () => [255, 0, 0, 255]
            }
            : {
                stroked: false,
                filled: true,
                getFillColor: (d: any) => (d as any).__rgba,
                getCursor: () => 'default'
            })
    };

    const layer = new ScatterplotLayer(layerProps as any);
    //console.log(`createDeckLayer took ${performance.now() - startTime} ms.`);
    return layer;
}

export function updateDeckLayerWithObject(
    name: string,
    elevationData: ElevationDataItem[],
    extHMean: ExtHMean,
    heightFieldName: string,
    positions: SrPosition[],
    projName: string
): void {
    const startTime = performance.now();
    //console.log(`updateDeckLayerWithObject ${name} startTime:`, startTime);
    try {
        if (useDeckStore().getDeckInstance()) {
            const layer = createDeckLayer(name, elevationData, extHMean, heightFieldName, positions, projName);
            useDeckStore().replaceOrAddLayer(layer, name);
            useDeckStore().getDeckInstance().setProps({ layers: useDeckStore().getLayers() });
        } else {
            console.error(`updateDeckLayerWithObject ${name}  Error updating elevation useDeckStore().deckInstance:`, useDeckStore().getDeckInstance());
        }
    } catch (error) {
        console.error(`updateDeckLayerWithObject ${name}  Error updating elevation layer:`, error);
    } finally {
        const endTime = performance.now();
        //console.log(`updateDeckLayerWithObject ${name} took ${endTime - startTime} milliseconds. endTime:`, endTime);
    }
}

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const deviceWidth = Math.min(window.screen.width, window.screen.height);
const deviceHeight = Math.max(window.screen.width, window.screen.height);

const isIPhone = isTouchDevice && deviceWidth <= 430 && deviceHeight <= 932;
const isIPad = isTouchDevice && deviceWidth > 430 && deviceWidth <= 768;

const onHoverHandler = isIPhone
    ? undefined
    : (pickingInfo: PickingInfo, event?: MjolnirEvent) => {
        const { object } = pickingInfo;
        const analysisMapStore = useAnalysisMapStore();
        const canvas = document.querySelector('canvas');
        let x = 0;
        let y = 0;

        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;

            x = (pickingInfo.x ?? 0) + rect.left + scrollX;
            y = (pickingInfo.y ?? 0) + rect.top + scrollY;
        }

        if ((x === 0 && y === 0) && event?.srcEvent instanceof MouseEvent) {
            x = event.srcEvent.clientX;
            y = event.srcEvent.clientY;
        }

        if (analysisMapStore.showTheTooltip) {
            if (object && !useDeckStore().isDragging) {
                const tooltip = formatElObject(object);

                const syntheticEvent = new MouseEvent('mousemove', {
                    clientX: x,
                    clientY: y,
                    bubbles: true,
                    cancelable: true,
                    view: window,
                });

                analysisMapStore.tooltipRef.showTooltip(syntheticEvent, tooltip);
            } else {
                analysisMapStore.tooltipRef.hideTooltip();
            }
        }
    };

// Function to swap coordinates from (longitude, latitude) to (latitude, longitude)
export function swapLongLatToLatLong(coordString: string): string {
    const coords = coordString.split(',');
    const long = parseFloat(coords[0].trim());
    const lat = parseFloat(coords[1].trim());
    return `${lat.toFixed(4)}, ${long.toFixed(4)}`;
}

export function checkAreaOfConvexHullWarning(): boolean {
    const currentApi = useReqParamsStore().getCurAPIObj();
    if (currentApi) {
        const limit = useAreaThresholdsStore().getAreaWarningThreshold(currentApi);
        console.log(`checkAreaOfConvexHullWarning: currentApi: ${currentApi} limit: ${limit} area: ${useReqParamsStore().getAreaOfConvexHull()}`);
        if (useReqParamsStore().getAreaOfConvexHull() > limit) {
            const msg = `The area of the convex hull might be too large (${useReqParamsStore().getFormattedAreaOfConvexHull()}).\n Please zoom in and then select a smaller area (try < ${useAreaThresholdsStore().getAreaWarningThreshold(currentApi)} km²).`;
            if (!useAdvancedModeStore().getAdvanced()) {
                useSrToastStore().warn('Warn', msg);
            }
            return false;
        }
    } else {
        console.error('checkAreaOfConvexHullWarning: currentApi is null');
    }
    return true;
}

export function checkAreaOfConvexHullError(): { ok: boolean, msg?: string } {
    const currentApi = useReqParamsStore().getCurAPIObj();
    if (useReqParamsStore().getUseRgt()) {
        const msg = 'checkAreaOfConvexHullError: useRGT is true skipping check';
        console.warn(msg);
        return { ok: true, msg: msg };
    }
    if (currentApi) {
        const limit = useAreaThresholdsStore().getAreaErrorThreshold(currentApi)
        console.log(`checkAreaOfConvexHullError: currentApi: ${currentApi} limit: ${limit} area: ${useReqParamsStore().getAreaOfConvexHull()}`);
        if (useReqParamsStore().getAreaOfConvexHull() > limit) {
            const msg = `The area of the convex hull is too large (${useReqParamsStore().getFormattedAreaOfConvexHull()}).\n Please zoom in and then select a smaller area  < ${limit} km²).`;
            if (!useAdvancedModeStore().getAdvanced()) {
                useSrToastStore().error('Error', msg);
            }
            return { ok: false, msg: msg };
        }
    } else {
        console.error('checkAreaOfConvexHullError: currentApi is null');
    }
    return { ok: true, msg: 'Size is acceptable' };
}

export function dumpMapLayers(map: OLMap, tag: string = ''): void {
    map.getAllLayers().forEach((layer: OLlayer) => {
        console.log(`dumpMapLayers ${tag} layer:`, layer.getProperties());
    });
}

/**
 * Dumps all features from a given VectorSource to the console in GeoJSON format.
 */
export function dumpFeaturesToConsole(vectorSource: VectorSource): void {
    if (!vectorSource) {
        console.error('VectorSource is not defined.');
        return;
    }

    const format = new GeoJSON();
    const features: Feature[] = vectorSource.getFeatures();

    features.forEach((_feature, _index) => {
        // const geoJsonFeature = format.writeFeatureObject(feature, { featureProjection: 'EPSG:3857' });
        // console.log(`Feature #${index + 1}:`, JSON.stringify(geoJsonFeature, null, 2));
    });
}

export function saveMapZoomState(map: OLMap) {
    if (map) {
        const mapStore = useMapStore();
        const view = map.getView();
        const center = view.getCenter();
        if (center) {
            mapStore.setCenterToRestore(center);
        } else {
            console.error("SrMap Error: center is null");
        }
        const zoom = view.getZoom();
        if (zoom) {
            mapStore.setZoomToRestore(zoom);
        } else {
            console.error("SrMap Error: zoom is null");
        }
        console.log('saveMapZoomState center:', center, ' zoom:', zoom);
    } else {
        console.error("SrMap Error: map is null");
    }
}

export function canRestoreZoomCenter(map: OLMap): boolean {
    const mapStore = useMapStore();
    const extentToRestore = mapStore.getExtentToRestore();
    const centerToRestore = mapStore.getCenterToRestore();
    const zoomToRestore = mapStore.getZoomToRestore();
    return (centerToRestore !== null && zoomToRestore !== null && extentToRestore !== null);
}

export function restoreMapView(proj: ProjectionLike): OlView | null {
    const mapStore = useMapStore();
    const extentToRestore = mapStore.getExtentToRestore();
    const centerToRestore = mapStore.getCenterToRestore();
    const zoomToRestore = mapStore.getZoomToRestore();
    let newView: OlView | null = null;

    if (
        extentToRestore === null ||
        centerToRestore === null ||
        zoomToRestore === null
    ) {
        console.warn('One or more restore parameters are null extent:', extentToRestore, ' center:', centerToRestore, ' zoom:', zoomToRestore);
    } else if (
        !extentToRestore.every(value => Number.isFinite(value))
    ) {
        console.warn('Invalid extentToRestore:', extentToRestore);
    } else {
        newView = new OlView({
            projection: proj,
            extent: extentToRestore,
            center: centerToRestore,
            zoom: zoomToRestore,
        });
    }
    return newView;
}

function createBlueReqPolygonStyle(label: string): Style {
    return new Style({
        fill: new Fill({
            color: 'rgba(0, 0, 255, 0.05)'
        }),
        stroke: new Stroke({
            color: 'blue',
            width: 2
        }),
        text: new TextStyle({
            text: label || '',
            font: '14px Calibri,sans-serif',
            fill: new Fill({ color: '#000' }),
            stroke: new Stroke({ color: '#fff', width: 3 }),
            overflow: true,
            placement: 'point',
        })
    });
}

function createRedReqPolygonStyle(): Style {
    return new Style({
        fill: new Fill({
            color: 'rgba(255, 0, 0, 0.1)'
        }),
        stroke: new Stroke({
            color: 'red',
            width: 2
        }),
        text: new TextStyle({
            font: '14px Calibri,sans-serif',
            fill: new Fill({ color: '#000' }),
            stroke: new Stroke({ color: '#fff', width: 3 }),
            overflow: true,
            placement: 'point',
        })
    });
}

export function zoomToRequestPolygon(map: OLMap, reqId: number): void {
    const vectorLayer = map.getLayers().getArray().find(layer => layer.get('name') === 'Records Layer');
    if (!vectorLayer) {
        console.error('zoomToRequestPolygon: "Records Layer" not found');
        return;
    }
    if (!vectorLayer || !(vectorLayer instanceof OLlayer)) {
        console.error('Records Layer source not found');
        return;
    }
    const vectorSource = (vectorLayer as any).getSource();
    if (!(vectorSource instanceof VectorSource)) {
        console.error('zoomToRequestPolygon: vector source not found');
        return;
    }

    const features = vectorSource.getFeatures();
    const feature = features.find((f: any) => f.get('req_id') === reqId);
    if (feature) {
        map.getView().fit(feature.getGeometry().getExtent(), { size: map.getSize(), padding: [20, 20, 20, 20] });
    } else {
        console.error('zoomToRequestPolygon: feature not found for reqId:', reqId);
    }
}

export function renderRequestPolygon(
    map: OLMap,
    poly: { lon: number, lat: number }[],
    color: string,
    reqId: number = 0,
    layerName: string = 'Drawing Layer',
    forceZoom: boolean = false
): void {
    const vectorLayer = map.getLayers().getArray().find(layer => layer.get('name') === layerName);
    if (!vectorLayer) {
        console.error(`renderRequestPolygon: ${layerName} not found`);
        return;
    }
    if (!vectorLayer || !(vectorLayer instanceof OLlayer)) {
        console.error('Records Layer source not found');
        return;
    }
    const vectorSource = (vectorLayer as any).getSource();

    const originalCoordinates: Coordinate[] = poly.map(p => [p.lon, p.lat]);
    if (originalCoordinates.length > 0) {
        const first = originalCoordinates[0];
        const last = originalCoordinates[originalCoordinates.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            originalCoordinates.push(first);
        }
    }

    const projection = map.getView().getProjection();
    let coordinates: Coordinate[];
    if (projection.getUnits() !== 'degrees') {
        coordinates = originalCoordinates.map(coord => fromLonLat(coord));
    } else {
        coordinates = originalCoordinates;
    }
    const api = useRecTreeStore().findApiForReqId(reqId);
    const polygon = new OlPolygon([coordinates]);
    const feature = new Feature({ geometry: polygon, req_id: (reqId > 0) ? reqId : null });
    if (color === 'red') {
        feature.setStyle(createRedReqPolygonStyle());
        feature.setId(`Record:${reqId}-${api}`);
    } else {
        feature.setStyle(createBlueReqPolygonStyle(reqId.toString()));
        feature.setId(`Record:${reqId}-${api}`);
    }
    vectorSource.addFeature(feature);

    if (reqId === 0) {
        if (!canRestoreZoomCenter(map)) {
            map.getView().fit(polygon.getExtent(), { size: map.getSize(), padding: [20, 20, 20, 20] });
        }
    } else {
        if (forceZoom) {
            map.getView().fit(polygon.getExtent(), { size: map.getSize(), padding: [20, 20, 20, 20] });
        }
    }
}

async function getAtl13CoordFromSvrParms(reqId: number): Promise<SrLatLon | null> {
    const jsonStr = await db.getSvrParams(reqId) as any;
    const jsonObj = JSON.parse(jsonStr);
    if (jsonObj?.atl13?.coord && typeof jsonObj?.atl13?.coord?.lon === 'number' && typeof jsonObj?.atl13?.coord?.lat === 'number') {
        return {
            lon: jsonObj.atl13.coord.lon,
            lat: jsonObj.atl13.coord.lat
        };
    }
    return null;
}

export function makePinStyleFunction(
    map: OLMap,
    minZoomToShowPin: number = 8
): (feature: FeatureLike, _resolution: number) => Style {
    return (feature: FeatureLike, _resolution: number): Style => {
        const zoom = map.getView().getZoom();
        const reqId = (feature as any).get('req_id');
        const showPin = useReqParamsStore().useAtl13Point || (zoom && zoom >= minZoomToShowPin);
        return new Style({
            image: showPin
                ? new CircleStyle({
                    radius: 6,
                    fill: new Fill({ color: 'red' }),
                    stroke: new Stroke({ color: 'white', width: 2 })
                })
                : undefined,
            text: new TextStyle({
                text: reqId > 0 ? reqId.toString() : '',
                font: '14px Calibri,sans-serif',
                fill: new Fill({ color: '#000' }),
                stroke: new Stroke({ color: '#fff', width: 3 }),
                offsetY: -15
            })
        });
    };
}

export function assignStyleFunctionToPinLayer(
    map: OLMap,
    minZoomToShowPin: number,
    layerName: string = 'Pin Layer'
): void {
    const vectorLayer = map.getLayers().getArray().find(layer => layer.get('name') === layerName);
    if (!vectorLayer || !(vectorLayer instanceof VectorLayer)) {
        console.error(`assignStyleFunctionToPinLayer: ${layerName} not found or not a VectorLayer`);
        return;
    }

    const pinStyleFunction = makePinStyleFunction(map, minZoomToShowPin);
    (vectorLayer as VectorLayer).setStyle(pinStyleFunction);
}

export function renderReqPin(
    map: OLMap,
    coord: Atl13Coord,
    featureId: string = 'Dropped Pin',
    layerName: string = 'Pin Layer',
    forceZoom: boolean = false,
    reqId: number = 0
): void {
    if (!map || !coord) return;

    const vectorLayer = map.getLayers().getArray().find(layer => layer.get('name') === layerName);
    if (!vectorLayer || !(vectorLayer instanceof OLlayer)) {
        console.error(`renderReqPin: ${layerName} not found or not an OLlayer`);
        return;
    }

    const vectorSource = (vectorLayer as any).getSource();
    if (!(vectorSource instanceof VectorSource)) {
        console.error(`renderReqPin: vector source not found for layer ${layerName}`);
        return;
    }

    const projection = map.getView().getProjection();
    const coordTransformed = projection.getUnits() === 'degrees'
        ? [coord.lon, coord.lat]
        : fromLonLat([coord.lon, coord.lat], projection);

    const pointFeature = new Feature({
        geometry: new Point(coordTransformed),
        name: `Record ${reqId}`,
        req_id: reqId,
        tag: `Record ${reqId}`
    });

    pointFeature.setId(featureId);
    vectorSource.addFeature(pointFeature);

    if (forceZoom) {
        const geom = pointFeature.getGeometry();
        if (geom) {
            map.getView().fit(geom.getExtent(), {
                size: map.getSize(),
                padding: [20, 20, 20, 20]
            });
        }
    }
}

export async function renderSvrReqPin(
    map: OLMap,
    reqId: number,
    layerName: string = 'Pin Layer',
    forceZoom: boolean = false
): Promise<SrLatLon | null> {
    const startTime = performance.now();
    let coord: SrLatLon | null = null;
    try {
        if (!map) {
            console.error('renderSvrReqPin Error: map is null');
            return null;
        }

        coord = await getAtl13CoordFromSvrParms(reqId);
        if ((coord === undefined) || (coord === null) || (coord.lon === undefined) || (coord.lat === undefined)) {
            console.warn(`renderSvrReqPin: No coordinate found for reqId ${reqId}`);
            return null;
        }

        renderReqPin(map, coord, `Atl13Coord:${reqId}`, layerName, forceZoom, reqId);
    } catch (error) {
        console.error('renderSvrReqPin Error:', error);
    }

    const endTime = performance.now();
    console.log(`renderSvrReqPin took ${endTime - startTime} milliseconds.`);
    return coord;
}

export async function renderSvrReqPoly(map: OLMap, reqId: number, layerName: string = 'Records Layer', forceZoom: boolean = false): Promise<SrRegion> {
    const startTime = performance.now();
    let poly: SrRegion = [];
    try {
        if (map) {
            poly = await db.getSvrReqPoly(reqId);
            const rc = await db.getRunContext(reqId);
            if (poly.length > 0) {
                renderRequestPolygon(map, poly, 'blue', reqId, layerName, forceZoom);
            } else {
                console.warn('renderSvrReqPoly No svrReqPoly for reqId:', reqId);
            }
        } else {
            console.error('renderSvrReqPoly Error: map is null');
        }
    } catch (error) {
        console.error('renderSvrReqPoly Error:', error);
    }
    const endTime = performance.now();
    return poly;
}

export async function renderSvrReqRegionMask(
    map: OLMap,
    reqId: number,
    layerName: string = 'Records Layer'
): Promise<SrRegion | null> {
    const startTime = performance.now();
    let region: SrRegion | null = null;
    try {
        if (!map) {
            console.error('renderSvrReqRegionMask Error: map is null');
            return null;
        }
        const vectorLayer = map.getLayers().getArray().find(layer => layer.get('name') === layerName);
        if(vectorLayer && vectorLayer instanceof OLlayer){
            const vectorSource = vectorLayer.getSource();
            if(vectorSource){
                const uniqueId = `region-mask-${reqId}`;
                const regionGeoJsonData = await db.getRegionMaskFromSvrParms(reqId);

                if(regionGeoJsonData && regionGeoJsonData.rows && regionGeoJsonData.rows > 0){
                    //console.log("drawCurrentReqPolyAndPin drawing reqGeoJsonData:",geoJsonData);
                    drawGeoJson(uniqueId,vectorSource, regionGeoJsonData, 'red', true);
                } else {
                    //console.log(`renderSvrReqRegionMask: No region mask found in svrParms for reqId ${reqId} regionGeoJsonData:`, regionGeoJsonData);
                }
            } else {
                console.error('renderSvrReqRegionMask: vector source not found for layer Drawing Layer');
            }
        } else {
            console.error('renderSvrReqRegionMask: vector layer not found');
        }
    } catch (error) {
        console.error('renderSvrReqRegionMask Error:', error);
    }

    const endTime = performance.now();
    //console.log(`renderSvrReqRegionMask took ${endTime - startTime} milliseconds.`);
    return region;
}

export async function updateSrViewName(srViewName: string): Promise<void> {
    if (srViewName) {
        await db.updateRequestRecord({ req_id: useRecTreeStore().selectedReqId, srViewName: srViewName }, false);
        console.log(`updateSrViewName: Updated srViewName to ${srViewName} for req_id: ${useRecTreeStore().selectedReqId}`);
    } else {
        console.error("SrMap Error: srViewKey is null when trying to handleUpdateBaseLayer");
    }
    return;
}

export async function updateMapView(
    map: OLMap,
    srViewKey: string,
    reason: string,
    restore: boolean = false,
    reqId: number = 0
): Promise<void> {
    try {
        if (map) {
            console.log(`------ updateMapView ${reason} srView Key:${srViewKey} ------ `);
            const srViewObj = (srViews as any).value[`${srViewKey}`];
            const srProjObj = (srProjections as any).value[srViewObj.projectionName];
            let newProj = getProjection(srViewObj.projectionName);
            const baseLayer = srViewObj.baseLayerName;

            if (baseLayer && newProj && srViewObj) {
                map.getAllLayers().forEach((layer: OLlayer) => {
                    map.removeLayer(layer);
                });
                const layer = getLayer(srViewObj.projectionName, baseLayer);
                if (layer) {
                    map.addLayer(layer);
                } else {
                    console.error(`Error: no layer found for curProj:${srViewObj.projectionName} baseLayer.title:${baseLayer}`);
                }
                const fromLonLatFn = getTransform('EPSG:4326', newProj);
                let extent = newProj.getExtent();
                if ((extent === undefined) || (extent === null)) {
                    if (srProjObj.extent) {
                        extent = srProjObj.extent;
                    } else {
                        let bbox = srProjObj.bbox;
                        if (srProjObj.bbox[0] > srProjObj.bbox[2]) {
                            bbox[2] += 360;
                        }
                        if (newProj.getUnits() === 'degrees') {
                            extent = bbox;
                        } else {
                            extent = applyTransform(bbox, fromLonLatFn, undefined, undefined);
                        }
                        newProj.setExtent(extent);
                    }
                }

                let worldExtent = newProj.getWorldExtent();
                if ((worldExtent === undefined) || (worldExtent === null) || worldExtent.some((value: number) => !Number.isFinite(value))) {
                    let bbox = srProjObj.bbox;
                    if (srProjObj.bbox[0] > srProjObj.bbox[2]) {
                        bbox[2] += 360;
                    }
                    if (newProj.getUnits() === 'degrees') {
                        worldExtent = bbox;
                    } else {
                        worldExtent = applyTransform(bbox, fromLonLatFn, undefined, undefined);
                    }
                    if (worldExtent.some((value: number) => !Number.isFinite(value))) {
                        console.warn("worldExtent is still invalid after transformation falling back to extent");
                        worldExtent = extent;
                        newProj.setWorldExtent(worldExtent);
                    } else {
                        newProj.setWorldExtent(worldExtent);
                    }
                }
                let center = getExtentCenter(extent);
                if (srProjObj.center) {
                    center = srProjObj.center;
                }
                let newView = new OlView({
                    projection: newProj,
                    extent: extent,
                    center: center,
                    zoom: srProjObj.default_zoom,
                });
                useMapStore().setExtentToRestore(extent);
                if (restore) {
                    const restoredView = restoreMapView(newProj);
                    if (restoredView) {
                        newView = restoredView;
                    } else {
                        console.warn('Failed to restore view for:', reason);
                    }
                }
                map.setView(newView);
            } else {
                if (!baseLayer) console.error("Error:baseLayer is null");
                if (!newProj) console.error("Error:newProj is null");
                if (!srViewObj) console.error("Error:srView is null");
            }
        } else {
            console.error("Error:map is null");
        }
    } catch (error) {
        console.error(`Error: updateMapView failed for ${reason}`, error);
    }
}

export async function zoomMapForReqIdUsingView(map: OLMap, reqId: number, srViewKey: string) {
    try {
        let reqExtremeLatLon = [0, 0, 0, 0];
        if (reqId > 0) {
            const workerSummary = await readOrCacheSummary(reqId);
            if (workerSummary) {
                const extremeLatLon = workerSummary.extLatLon;
                if (extremeLatLon) {
                    reqExtremeLatLon = [
                        extremeLatLon.minLon,
                        extremeLatLon.minLat,
                        extremeLatLon.maxLon,
                        extremeLatLon.maxLat
                    ];
                } else {
                    console.error("Error: invalid lat-lon data for request:", reqId);
                }
            } else {
                console.error("Error: invalid workerSummary for request:", reqId);
            }
        }
        const srViewObj = (srViews as any).value[`${srViewKey}`];
        let newProj = getProjection(srViewObj.projectionName);
        let view_extent = reqExtremeLatLon;
        if (newProj?.getUnits() !== 'degrees') {
            const fromLonLatFn = getTransform('EPSG:4326', srViewObj.projectionName);
            view_extent = applyTransform(reqExtremeLatLon, fromLonLatFn, undefined, 8);
        }
        map.getView().fit(view_extent, { size: map.getSize(), padding: [40, 40, 40, 40] });
    } catch (error) {
        console.error(`Error: zoomMapForReqIdUsingView failed for reqId:${reqId}`, error);
    }
}

export const updateElevationMap = async (req_id: number) => {
    const startTime = performance.now();
    console.log('updateElevationMap req_id:', req_id);
    if (req_id <= 0) {
        console.warn(`updateElevationMap Invalid request ID:${req_id}`);
        return;
    }
    try {
        const analysisMapStore = useAnalysisMapStore();
        const minMax = await getAllColumnMinMax(req_id);
        useGlobalChartStore().setAllColumnMinMaxValues(minMax);

        const parms = await duckDbReadAndUpdateElevationData(req_id, EL_LAYER_NAME_PREFIX);
        if (parms) {
            const numRows = parms.numRows;
            if (numRows > 0) {
                if (parms.firstRec) {
                    useDeckStore().deleteSelectedLayer();
                    await processSelectedElPnt(parms.firstRec);
                    analysisMapStore.analysisMapInitialized = true;
                } else {
                    console.error(`updateElevationMap Failed to get firstRec for req_id:${req_id}`);
                    useSrToastStore().warn('No points in file', 'The request produced no points');
                }
            } else {
                console.warn(`updateElevationMap No points in file for req_id:${req_id}`);
                useSrToastStore().warn('No points in file', 'The request produced no points');
            }
        } else {
            console.error(`updateElevationMap Failed to get parms for req_id:${req_id}`);
        }
    } catch (error) {
        console.warn('Failed to update selected request:', error);
    }
    try {
        await router.push(`/analyze/${useRecTreeStore().selectedReqId}`);
        console.log('Successfully navigated to analyze:', useRecTreeStore().selectedReqId);
    } catch (error) {
        console.error('Failed to navigate to analyze:', error);
    }
    const endTime = performance.now();
    console.log(`updateElevationMap took ${endTime - startTime} milliseconds.`);
};

export async function updateMapAndPlot(withHighlight: boolean = true): Promise<void> {
    const startTime = performance.now();
    const atlChartFilterStore = useAtlChartFilterStore();
    const recTreeStore = useRecTreeStore();
    try {
        const req_id = recTreeStore.selectedReqId;
        if (req_id > 0) {
            atlChartFilterStore.setSelectedOverlayedReqIds([]);
            await updateElevationMap(req_id);
            if (withHighlight) {
                await updatePlotAndSelectedTrackMapLayer("updateMapAndPlot");
            }
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error('updateMapAndPlot Failed:', error.message);
        } else {
            console.error('updateMapAndPlot Unknown error occurred:', error);
        }
    } finally {
        const endTime = performance.now();
        console.log(`updateMapAndPlot took ${endTime - startTime} milliseconds.`);
    }
}

export function getBoundingExtentFromFeatures(features: Feature<Geometry>[]): Extent | undefined {
    // Debug log feature types and extents
    features.forEach((feature, idx) => {
        const geom = feature.getGeometry();
        console.log(`Feature[${idx}] type:`, geom?.getType());
        console.log(`Feature[${idx}] extent:`, geom?.getExtent());
    });

    // Helper to extract all raw coordinates from any geometry

    const allCoords: Coordinate[] = features.flatMap(f =>
        extractCoordinates(f.getGeometry())
    );

    if (allCoords.length === 0) {
        console.warn('No coordinates found in features');
        return undefined;
    }

    return boundingExtent(allCoords);
}

export function zoomOutToFullMap(map: OLMap): void {
    const view = map.getView();
    const projection = view.getProjection();
    let extent = projection.getExtent();

    if (!extent || !extent.every(Number.isFinite)) {
        console.warn('zoomOutToFullMap: projection extent is invalid, falling back to worldExtent.');
        extent = projection.getWorldExtent() as any;
    }

    if (!extent || !(extent as any).every(Number.isFinite)) {
        console.error('zoomOutToFullMap: No valid extent found to zoom to.');
        return;
    }

    view.fit(extent as any, {
        size: map.getSize(),
        padding: [40, 40, 40, 40],
    });

    console.log('zoomOutToFullMap: zoomed to full projection/world extent:', extent);
}

export function getScrollableAncestors(el: HTMLElement | null): HTMLElement[] {
    const scrollables: HTMLElement[] = [];

    while (el && el !== document.body && el !== document.documentElement) {
        const style = getComputedStyle(el);
        const overflowY = style.overflowY;
        const overflowX = style.overflowX;

        const isScrollable = ['auto', 'scroll', 'overlay'].some(v =>
            [overflowY, overflowX].includes(v)
        );

        if (isScrollable && (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)) {
            scrollables.push(el);
        }

        el = el.parentElement;
    }

    return scrollables;
}
