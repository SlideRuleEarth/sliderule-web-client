import { useMapStore } from '@/stores/mapStore';
import { computed} from 'vue';
import { useGeoJsonStore } from '@/stores/geoJsonStore';
import { ScatterplotLayer } from '@deck.gl/layers';
import GeoJSON from 'ol/format/GeoJSON';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import type { FeatureLike } from 'ol/Feature';
import { toLonLat,fromLonLat, type ProjectionLike } from 'ol/proj';
import { Layer as OLlayer } from 'ol/layer';
import type OLMap from "ol/Map.js";
import { unByKey } from 'ol/Observable';
import type { EventsKey } from 'ol/events';
import type { ExtHMean } from '@/workers/workerUtils';
import { Style, Fill, Stroke } from 'ol/style';
import { getSpotNumber,getGtsForSpotsAndScOrients } from '@/utils/spotUtils';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { useDeckStore } from '@/stores/deckStore';
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore';
import { useSrToastStore } from '@/stores/srToastStore';
import { useAdvancedModeStore } from '@/stores/advancedModeStore';
import { srViews } from "@/composables/SrViews";
import { srProjections } from "@/composables/SrProjections";
import { get as getProjection } from 'ol/proj.js';
import { getLayer } from "@/composables/SrLayers";
import { getTransform } from 'ol/proj.js';
import { applyTransform } from 'ol/extent.js';
import { View as OlView } from 'ol';
import { getCenter as getExtentCenter } from 'ol/extent.js';
import { readOrCacheSummary, getColsForRgtYatcFromFile } from "@/utils/SrDuckDbUtils";
import type { AccessorContext, PickingInfo } from '@deck.gl/core';
import type { MjolnirEvent } from 'mjolnir.js';
import { clearPlot,updatePlotAndSelectedTrackMapLayer } from '@/utils/plotUtils';
import { Polygon as OlPolygon } from 'ol/geom';
import { db } from '@/db/SlideRuleDb';
import type { Coordinate } from 'ol/coordinate';
import { Text as TextStyle } from 'ol/style';
import Geometry from 'ol/geom/Geometry';
import type { SrRegion } from '@/sliderule/icesat2';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { useGlobalChartStore } from '@/stores/globalChartStore';
import { useAnalysisTabStore } from '@/stores/analysisTabStore';
import { useAreaThresholdsStore } from '@/stores/areaThresholdsStore';
import { formatKeyValuePair } from '@/utils/formatUtils';
import { duckDbReadAndUpdateElevationData, getAllFilteredCycleOptionsFromFile } from '@/utils/SrDuckDbUtils';
import router from '@/router/index.js';
import { type SrPosition, type SrRGBAColor } from '@/types/SrTypes';

export const EL_LAYER_NAME_PREFIX = 'elevation-deck-layer'; // deck elevation layer
export const SELECTED_LAYER_NAME_PREFIX = 'selected-deck-layer'; // deck selected layer prefix
export const OL_DECK_LAYER_NAME = 'ol-deck-layer'; // open layers deck layer

export const polyCoordsExist = computed(() => {
    let exist = false;
    if(useGeoJsonStore().geoJsonData){
        //console.log('useGeoJsonStore().geoJsonData:',useGeoJsonStore().geoJsonData);
        exist = true;
    } else if (useMapStore().polyCoords.length > 0) {
        //console.log('useMapStore().polyCoords:',useMapStore().polyCoords);
        exist = true;
    } else {
        //console.log(`useMapStore().polyCoords: ${useMapStore().polyCoords} and useGeoJsonStore().geoJsonData: ${useGeoJsonStore().geoJsonData} do not exist.`);
        exist = false;
    }
    return exist
});
export const clearPolyCoords = () => {
    useMapStore().polyCoords = [];
    if(useGeoJsonStore().geoJsonData){
        useGeoJsonStore().geoJsonData = null;
    }
}

export function drawGeoJson(
    uniqueId: string,
    vectorSource: VectorSource,
    geoJsonData: string | object, // Allow string or object
    noFill: boolean = false,
    zoomTo: boolean = false,
    tag: string = '',
): void {
    console.log('drawGeoJson: uniqueId:',uniqueId,' vectorSource:',vectorSource,' geoJsonData:',geoJsonData,' noFill:',noFill,' zoomTo:',zoomTo,' tag:',tag);
    try {
        const map = useMapStore().map;
        if (!map) {
            console.error('drawGeoJson: Map is not defined.');
            return;
        }
        if (!vectorSource) {
            console.error('drawGeoJson: VectorSource is not defined.');
            return;
        }
        if (!geoJsonData) {
            console.warn('drawGeoJson: GeoJSON data is null or undefined.');
            return;
        }

        let geoJsonString: string;
        if (typeof geoJsonData === 'string') {
            geoJsonString = geoJsonData.trim();
            if (geoJsonString === '') {
                console.warn('drawGeoJson: Empty GeoJSON data.');
                return;
            }
        } else if (typeof geoJsonData === 'object') {
            try {
                geoJsonString = JSON.stringify(geoJsonData);
            } catch (stringifyError) {
                console.error('drawGeoJson: Failed to convert object to JSON string.', stringifyError);
                return;
            }
        } else {
            console.error('drawGeoJson: Invalid GeoJSON data type:', typeof geoJsonData);
            return;
        }

        // Parse GeoJSON data
        let features = [];
        try {
            const format = new GeoJSON();
            //console.log('drawGeoJson: geoJsonString:',geoJsonString);
            features = format.readFeatures(geoJsonString, {
                featureProjection: useMapStore().getSrViewObj()?.projectionName || 'EPSG:3857',
            });
        } catch (parseError) {
            console.error('drawGeoJson: Failed to parse GeoJSON data.', parseError);
            return;
        }

        if (features.length === 0) {
            console.warn('drawGeoJson: No valid features found in GeoJSON.');
            return;
        }

        //console.log(`drawGeoJson: Adding ${features.length} feature(s) with tag: ${tag}`);

        // Define style based on noFill flag
        const style = new Style({
            stroke: new Stroke({
                color: noFill ? 'rgba(255, 0, 0, 1)' : 'rgba(0, 0, 255, 1)',
                width: 2,
            }),
            fill: noFill
                ? undefined
                : new Fill({
                      color: 'rgba(255, 0, 0, 0.1)', // Red fill with 10% opacity
                  }),
        });

        // Apply styles and ensure unique IDs
        features.forEach((feature, index) => {
            feature.setId(`feature-${uniqueId}`); // Unique ID
            feature.setStyle(style);
            feature.set('tag', tag);
        });

        vectorSource.addFeatures(features);

        console.log('drawGeoJson: Features in source after addition:', vectorSource.getFeatures().length);

        // Zoom to extent of features if requested
        if (zoomTo && vectorSource.getFeatures().length > 0) {
            const extent = vectorSource.getExtent();
            if (extent.every((val) => val !== Infinity && val !== -Infinity)) {
                map.getView().fit(extent, { padding: [50, 50, 50, 50] });
            } else {
                console.warn('drawGeoJson: Invalid extent, skipping zoom.');
            }
        }

    } catch (error) {
        console.error('drawGeoJson: Unexpected error:', error);
    }
}


export function enableTagDisplay(map: OLMap, vectorSource: VectorSource): void {
    const tooltipEl = document.getElementById('tooltip');

    // Listen for pointer move (hover) events
    useMapStore().pointerMoveListenerKey = map.on('pointermove', function (evt) {
        //console.log('pointermove');
        const pixel = map.getEventPixel(evt.originalEvent);
        const features = map.getFeaturesAtPixel(pixel);
        
        // Check if any feature is under the cursor
        if (features && features.length > 0) {
            const feature = features[0];
            const tag = feature.get('tag');  // Retrieve the tag

            if (tag && tooltipEl) {
                // Display the tag in the tooltip
                tooltipEl.innerHTML = `Area: ${tag}`;
                tooltipEl.style.display = 'block';
                tooltipEl.style.left = `${evt.originalEvent.clientX}px`;
                tooltipEl.style.top = `${evt.originalEvent.clientY - 15}px`; // Offset the tooltip above the cursor
            }
        } else {
            // Hide the tooltip if no feature is found
            if (tooltipEl) {
                tooltipEl.style.display = 'none';
            }
        }
    });

    // Hide tooltip when the mouse leaves the map
    map.getViewport().addEventListener('mouseout', function () {
        //console.log('mouseout');
        if (tooltipEl) {
            tooltipEl.style.display = 'none';
        }
    });
}

export function disableTagDisplay(): void {
    const pointerMoveListenerKey = useMapStore().getPointerMoveListenerKey();
    if (pointerMoveListenerKey !== null) {  
        unByKey(pointerMoveListenerKey as EventsKey);  // Remove the pointermove event listener
        useMapStore().setPointerMoveListenerKey(null);    // Clear the reference
    }
}

export function formatElObject(obj: { [key: string]: any }): string {
    // Exclude 'extent_id' and format everything else
    return Object.entries(obj)
        .filter(([key]) => key !== 'extent_id')
        .map(([key, value]) => formatKeyValuePair(key, value))
        .join('<br>');
}
  
  
interface TooltipParams {
    x: number;
    y: number;
    tooltip: string;
}

function showTooltip({ x, y, tooltip }: TooltipParams): void {
    const tooltipEl = document.getElementById('tooltip');
    if (tooltipEl) {
        tooltipEl.innerHTML = tooltip;
        tooltipEl.style.display = 'block';

        const xoffset = 75; // Offset in pixels to position the tooltip to the right of the pointer
        const yoffset = 75; // Offset in pixels to position the tooltip below the pointer   
        // Set initial tooltip position to the right of the pointer
        tooltipEl.style.left = `${x + xoffset}px`;
        tooltipEl.style.top = `${y + yoffset}px`;

        // Re-check tooltip position and adjust if it goes off-screen
        const tooltipRect = tooltipEl.getBoundingClientRect();
        //console.log('x:',x,'y:',y,'showTooltip tooltipRect:',tooltipRect, ' window.innerWidth:',window.innerWidth,' window.innerHeight:',window.innerHeight);
        if (tooltipRect.right > window.innerWidth) {
            // If clipped at the right, reposition to the left of the pointer
            //console.warn('showTooltip clipped at the right');
            tooltipEl.style.left = `${x - tooltipRect.width - xoffset}px`;
        }
        if (tooltipRect.bottom > window.innerHeight) {
            // If clipped at the bottom, reposition slightly higher
            console.warn('showTooltip clipped at the bottom');
            tooltipEl.style.top = `${window.innerHeight - tooltipRect.height - xoffset}px`;
        }
        if (tooltipRect.top < 0) {
            // If clipped at the top, reposition slightly lower
            console.warn('showTooltip clipped at the top');
            tooltipEl.style.top = `${xoffset}px`;
        }
        //console.log('showTooltip tooltipEl:',tooltipEl);
    }
}

function hideTooltip():void {
    const tooltipEl = document.getElementById('tooltip');
    if (tooltipEl) {
        tooltipEl.style.display = 'none';
    }
}

export interface ElevationDataItem {
    [key: string]: any; // This allows indexing by any string key
}

function isInvalid(value: any): boolean {
    return value === null || value === undefined || Number.isNaN(value);
}

export async function setCyclesGtsSpotsFromFileUsingRgtYatc() {
    const reqIdStr = useRecTreeStore().selectedReqIdStr;
    const api = useRecTreeStore().findApiForReqId(parseInt(reqIdStr));
    const gcs = useGlobalChartStore();

    if (!api.includes('atl03')) {
        if (gcs.use_y_atc_filter && !isInvalid(gcs.selected_y_atc)) {
            const y_atc_filtered_Cols = await getColsForRgtYatcFromFile(useRecTreeStore().selectedReqId, ['spot', 'cycle', 'gt']);
            console.log('setCyclesGtsSpotsFromFileUsingRgtYatc: y_atc_filtered_Cols:', y_atc_filtered_Cols);

            if (y_atc_filtered_Cols) {
                // Store previous values
                const prevSpots = gcs.getSpots(); 
                const prevCycles = gcs.getCycles(); 
                const prevGts = gcs.getGts(); 
                console.log('setCyclesGtsSpotsFromFileUsingRgtYatc: prevSpots:', prevSpots);
                console.log('setCyclesGtsSpotsFromFileUsingRgtYatc: prevCycles:', prevCycles);
                console.log('setCyclesGtsSpotsFromFileUsingRgtYatc: prevGts:', prevGts);

                // Map new values, filtering out invalid entries
                const y_atc_filtered_spots = y_atc_filtered_Cols.spot.filter(spot => !isInvalid(spot));
                const y_atc_filtered_cycles = y_atc_filtered_Cols.cycle.filter(cycle => !isInvalid(cycle));
                const y_atc_filtered_gts = y_atc_filtered_Cols.gt.filter(gt => !isInvalid(gt));

                // Check for changes
                const spotsChanged = JSON.stringify(prevSpots) !== JSON.stringify(y_atc_filtered_spots);
                const cyclesChanged = JSON.stringify(prevCycles) !== JSON.stringify(y_atc_filtered_cycles);
                const gtsChanged = JSON.stringify(prevGts) !== JSON.stringify(y_atc_filtered_gts);

                // Log changes
                if (spotsChanged) console.log("setCyclesGtsSpotsFromFileUsingRgtYatc Spots changed by y_atc_filter:", { prev: prevSpots, new: y_atc_filtered_spots });
                if (cyclesChanged) console.log("setCyclesGtsSpotsFromFileUsingRgtYatc Cycles changed by y_atc_filter:", { prev: prevCycles, new: y_atc_filtered_cycles });
                if (gtsChanged) console.log("setCyclesGtsSpotsFromFileUsingRgtYatc GTs changed by y_atc_filter:", { prev: prevGts, new: y_atc_filtered_gts });

                // Set new values
                gcs.setSpots(y_atc_filtered_spots);
                gcs.setGts(y_atc_filtered_gts);
                gcs.setCycles(y_atc_filtered_cycles);
                const selectedCycleOptions = gcs.getSelectedCycleOptions();
                gcs.setFilteredCycleOptions(selectedCycleOptions);
                console.log('setCyclesGtsSpotsFromFileUsingRgtYatc: selectedCycleOptions:', selectedCycleOptions);
                console.log('setCyclesGtsSpotsFromFileUsingRgtYatc: gcs.getFilteredCycleOptions():', gcs.getFilteredCycleOptions());
            }
        }
    }
}

export function isClickable(d:ElevationDataItem): boolean {

    let valid = true;
    if(isInvalid(d.cycle) || isInvalid(d.rgt) || isInvalid(d.y_atc)){
        console.log('isValidElevationPnt: invalid elevation point:',d);
        valid = false;
    }
    return valid;
}

export async function processSelectedElData(d:ElevationDataItem): Promise<void> {
    console.log('processSelectedElData d:',d);
    const globalChartStore = useGlobalChartStore();
    globalChartStore.setSelectedElevationRec(d);
    hideTooltip();
    useAtlChartFilterStore().setShowPhotonCloud(false);
    clearPlot();

    //console.log('d:',d,'d.spot',d.spot,'d.gt',d.gt,'d.rgt',d.rgt,'d.cycle',d.cycle,'d.track:',d.track,'d.gt:',d.gt,'d.sc_orient:',d.sc_orient,'d.pair:',d.pair)
    const gcs = useGlobalChartStore();

    if(d.track !== undefined){ // for atl03
        gcs.setTracks([d.track]); // set to this one track
        gcs.setGtsForTracks(gcs.getTracks());
    }
    if((d.gt !== undefined) && (d.spot !== undefined)){ // for atl06 or atl08
        gcs.setFilterWithSpotAndGt(d.spot,d.gt);
    } else { // atl03
        if((d.sc_orient !== undefined) && (d.track !== undefined) && (d.pair !== undefined)){ //atl03
            const spot = getSpotNumber(d.sc_orient,d.track,d.pair);
            gcs.setSpots([spot]);
            const gts = getGtsForSpotsAndScOrients(gcs.getSpots(), gcs.getScOrients());
            gcs.setGts(gts);
        } else {
            console.error('d.spot or d.gt is undefined when sc_orient and spot are undefined?'); // should always be defined
        }
    }

    if(d.sc_orient !== undefined){
        gcs.setScOrients([d.sc_orient]);
    }
    if(d.pair !== undefined){
        gcs.setPairs([d.pair]);
    }
    if(d.rgt !== undefined){
        gcs.setRgt(d.rgt);
    } else {
        console.error('d.rgt is undefined'); // should always be defined
    }
    if(d.cycle !== undefined){
        gcs.setCycles( [d.cycle]);
    } else {
        console.error('d.cycle is undefined'); // should always be defined
    }
    gcs.selected_y_atc = d.y_atc;
    console.log('processSelectedElData: selected_y_atc:',gcs.selected_y_atc);
    console.log(`processSelectedElData: ${useAnalysisTabStore().activeTabLabel}`);
    if(gcs.use_y_atc_filter){    
        await setCyclesGtsSpotsFromFileUsingRgtYatc();
    }
    console.log('processSelectedElData: pair',gcs.getPairs());
    console.log('processSelectedElData: rgt',gcs.getRgt())
    console.log('processSelectedElData: cycles',gcs.getCycles())
    console.log('processSelectedElData: tracks',gcs.getTracks())
    console.log('processSelectedElData: sc_orient',gcs.getScOrients())
    console.log('processSelectedElData: spot',gcs.getSpots())
    console.log('processSelectedElData: gt',gcs.getGts())
}

export async function clicked(d:ElevationDataItem): Promise<void> {
    console.log('clicked data:',d);
    if(!isClickable(d)){
        console.log('clicked: invalid elevation point:',d);
        useSrToastStore().warn('Clicked data point contains NaNs', 'Please Click on another point.');
        return;
    }
    await processSelectedElData(d);
    const msg = `clicked ${d}`;
    await updatePlotAndSelectedTrackMapLayer(msg);
}

function createDeckLayer(
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

    // Precompute color for each data point once.
    const precomputedColors: SrRGBAColor[] = elevationData.map(d => {
        let color: [number, number, number, number] = [255, 255, 255, 255]; // default (white)
        const h = d[heightFieldName];
        if (h !== undefined && h !== null) {
            const c = elevationColorMapStore.getColorForElevation(
                h,
                extHMean.lowHMean,
                extHMean.highHMean
            );
            if (c) {
                color = [...c] as [number, number, number, number]; // Ensure correct type
                color[3] = 255;
            }
        }
        return color;
    });

    const endTime1 = performance.now();
    console.log(`createDeckLayer precomputeColors took ${endTime1 - startTime} milliseconds. endTime:`, endTime1);

    type ScatterplotLayerProps = {
        getLineWidthUnits?: string;
        getLineWidth?: number;
        getLineColor?: (_d: ElevationDataItem) => [number, number, number, number];
        stroked?: boolean;
        getFillColor?: (d: any, context: AccessorContext<any>) => SrRGBAColor;
        filled?: boolean;
        getCursor?: () => string;
    };
    // Conditionally include properties
    const isSelectedLayer = name.includes(SELECTED_LAYER_NAME_PREFIX);
    const selectedLayerProps: Partial<ScatterplotLayerProps> = isSelectedLayer ? 
    {
        getLineWidthUnits: 'pixels',
        getLineWidth: 1,
        getLineColor: (_d: ElevationDataItem): [number, number, number, number] => [255, 0, 0, 255], // Explicit type
        stroked: true,
        filled: false,
    } : {
        getCursor: () => 'default',
        getFillColor: (d: any, { index }: AccessorContext<any>): SrRGBAColor => precomputedColors[index],
    };

    const newLayer = new ScatterplotLayer({
        id: name,
        data: elevationData,
        getPosition: (d: ElevationDataItem, { index }): SrPosition => positions[index],
        getNormal: [0, 0, 1],
        getRadius: highlightPntSize,
        radiusUnits: 'pixels',
        pickable: true,
        onHover: onHoverHandler,
        parameters: {
            depthTest: false
        },
        onClick: ({ object, x, y }) => {
            if (object) {
                clicked(object);
            }
        },
        ...selectedLayerProps // Spread conditionally included properties
    });
    const endTime = performance.now();
    console.log(`createDeckLayer took ${endTime - startTime} milliseconds. endTime:`, endTime);
    return newLayer;
}

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
// Check device dimensions
const deviceWidth = Math.min(window.screen.width, window.screen.height); // Use the smaller value for width
const deviceHeight = Math.max(window.screen.width, window.screen.height); // Use the larger value for height

// Define breakpoints for iPhone and iPad
const isIPhone = isTouchDevice && deviceWidth <= 430 && deviceHeight <= 932; // Typical iPhone dimensions
const isIPad = isTouchDevice && deviceWidth > 430 && deviceWidth <= 768;    // Typical iPad dimensions

// Nullify the handler only for iPhones
const onHoverHandler = isIPhone
    ? undefined
    : (pickingInfo: PickingInfo, event?: MjolnirEvent) => {
            const { object } = pickingInfo;
            let x = pickingInfo.x ?? 0;
            let y = pickingInfo.y ?? 0;

            // Use event.srcEvent for fallback if pickingInfo.x and pickingInfo.y are undefined
            if (event?.srcEvent instanceof MouseEvent || event?.srcEvent instanceof PointerEvent) {
                x = pickingInfo.x ?? event.srcEvent.clientX;
                y = pickingInfo.y ?? event.srcEvent.clientY;
            }
            const mapStore = useMapStore();

            //console.log('onHoverHandler object:',object,' x:',x,' y:',y,' mapStore.showTheTooltip:',mapStore.showTheTooltip);
            if(mapStore.showTheTooltip){
                if (object && !useDeckStore().isDragging) {
                    const tooltip = formatElObject(object);
                    showTooltip({ x, y, tooltip });
                } else {
                    hideTooltip();
                }
            }
};

export function updateDeckLayerWithObject(
    name:string,
    elevationData:ElevationDataItem[], 
    extHMean: ExtHMean, 
    heightFieldName:string, 
    positions:SrPosition[],
    projName:string
): void 
{
    const startTime = performance.now(); // Start time
    console.log(`updateDeckLayerWithObject ${name} startTime:`,startTime);
    try{
        if(useDeckStore().getDeckInstance()){
            const layer = createDeckLayer(name,elevationData,extHMean,heightFieldName,positions,projName);
            //const replaced = useDeckStore().replaceOrAddLayer(layer,name);
            useDeckStore().appendLayer(layer);
        } else {
            console.error(`updateDeckLayerWithObject ${name}  Error updating elevation useDeckStore().deckInstance:`,useDeckStore().getDeckInstance());
        }
    } catch (error) {
        console.error(`updateDeckLayerWithObject ${name}  Error updating elevation layer:`,error);
    } finally {
        const endTime = performance.now(); // End time
        console.log(`updateDeckLayerWithObject ${name} took ${endTime - startTime} milliseconds. endTime:`,endTime);  
    }

}

// Function to swap coordinates from (longitude, latitude) to (latitude, longitude)
export function swapLongLatToLatLong(coordString: string): string {
    // Split the coordinate string into an array
    const coords = coordString.split(',');

    // Trim any whitespace and convert to numbers
    const long = parseFloat(coords[0].trim());
    const lat = parseFloat(coords[1].trim());

    // Return the swapped coordinates as a string
    return `${lat.toFixed(4)}, ${long.toFixed(4)}`;
}

export function checkAreaOfConvexHullWarning(): boolean {
    const currentApi = useReqParamsStore().getCurAPIObj();
    if(currentApi){
        const limit = useAreaThresholdsStore().getAreaWarningThreshold(currentApi)
        //console.log('checkAreaOfConvexHullWarning area:',limit);
        if(useReqParamsStore().getAreaOfConvexHull() > limit){
            const msg = `The area of the convex hull might be too large (${useReqParamsStore().getFormattedAreaOfConvexHull()}).\n Please zoom in and then select a smaller area (try < ${useAreaThresholdsStore().getAreaWarningThreshold(currentApi)} km²).`;
            if(!useAdvancedModeStore().getAdvanced()){
                useSrToastStore().warn('Warn',msg);
            } else {
                //console.log('checkAreaOfConvexHullWarning: Advanced mode is enabled. '+msg);
            }
            return false;
        }
    } else {
        console.error('checkAreaOfConvexHullWarning: currentApi is null');

    }
    return true;
}

export function checkAreaOfConvexHullError(): boolean {
    const currentApi = useReqParamsStore().getCurAPIObj();
    if(currentApi){
        const limit = useAreaThresholdsStore().getAreaErrorThreshold(currentApi)
        //console.log('checkAreaOfConvexHullError area:',limit);
        if(useReqParamsStore().getAreaOfConvexHull() > limit){
            const msg = `The area of the convex hull is too large (${useReqParamsStore().getFormattedAreaOfConvexHull()}).\n Please zoom in and then select a smaller area  < ${useAreaThresholdsStore().getAreaErrorThreshold(currentApi)} km²).`;
            if(!useAdvancedModeStore().getAdvanced()){
                useSrToastStore().error('Error',msg);
            } else {
                //console.log('checkAreaOfConvexHullError: Advanced mode is enabled. '+msg);
            }
            return false;
        }
    } else {
        console.error('checkAreaOfConvexHullError: currentApi is null');
    }
    return true;
}

export function dumpMapLayers(map: OLMap, tag:string=''): void {
    map.getAllLayers().forEach((layer: OLlayer) => {
      console.log(`dumpMapLayers ${tag} layer:`,layer.getProperties());
    });
}

/**
 * Dumps all features from a given VectorSource to the console in GeoJSON format.
 * @param vectorSource - The VectorSource containing the features.
 */
export function dumpFeaturesToConsole(vectorSource: VectorSource): void {
    if (!vectorSource) {
        console.error('VectorSource is not defined.');
        return;
    }

    const format = new GeoJSON();
    const features: Feature[] = vectorSource.getFeatures();

    features.forEach((feature, index) => {
        const geoJsonFeature = format.writeFeatureObject(feature, {
            featureProjection: 'EPSG:3857', // Replace with your desired projection
        });
        //console.log(`Feature #${index + 1}:`, JSON.stringify(geoJsonFeature, null, 2));
    });

    //console.log(`Total features: ${features.length}`);
}

export function saveMapZoomState(map:OLMap){
    if(map){
        const mapStore = useMapStore();
        const view = map.getView();
        const center = view.getCenter();
        if(center){
            mapStore.setCenterToRestore(center);
        } else {
            console.error("SrMap Error: center is null");
        }
        const zoom = view.getZoom();
        if(zoom){
            mapStore.setZoomToRestore(zoom);
        } else {
            console.error("SrMap Error: zoom is null");
        }
        console.log('saveMapZoomState center:',center,' zoom:',zoom);
    } else {
        console.error("SrMap Error: map is null");
    }
}
export function canRestoreZoomCenter(map:OLMap): boolean {
    const mapStore = useMapStore();
    const extentToRestore = mapStore.getExtentToRestore();
    const centerToRestore = mapStore.getCenterToRestore();
    const zoomToRestore = mapStore.getZoomToRestore();
    return (centerToRestore !== null && zoomToRestore !== null && extentToRestore !== null);
}

export function restoreMapView(proj:ProjectionLike) : OlView | null {
    const mapStore = useMapStore();
    const extentToRestore = mapStore.getExtentToRestore();
    const centerToRestore = mapStore.getCenterToRestore();
    const zoomToRestore = mapStore.getZoomToRestore();
    let newView = null;
    // Validate the restore parameters
    if (
        extentToRestore === null ||
        centerToRestore === null ||
        zoomToRestore === null
    ) {
        console.warn('One or more restore parameters are null extent:',extentToRestore,' center:',centerToRestore,' zoom:',zoomToRestore);
    } else if (
        !extentToRestore.every(value => Number.isFinite(value))
    ) {
        console.warn('Invalid extentToRestore:', extentToRestore);
    } else {
        // All restore parameters are valid, create a new view
        newView = new OlView({
            projection: proj,
            extent: extentToRestore,
            center: centerToRestore,
            zoom: zoomToRestore,
        });
        //console.log('Restored view with extent:', extentToRestore);
        //console.log('Restored view with center:', centerToRestore);
        //console.log('Restored view with zoom:', zoomToRestore);
    }
    return newView;
}


export function addFeatureClickListener(
    map: OLMap,
    onFeatureClick: (feature: Feature<Geometry>) => void
): void {
    map.on('singleclick', (evt) => {
      map.forEachFeatureAtPixel(evt.pixel, (featureLike: FeatureLike) => {
        // Check if it really is a Feature (not a RenderFeature)
        if (featureLike instanceof Feature) {

            onFeatureClick(featureLike);
            return true; // Stop searching for features
        }
        return false; // Continue searching for features
      });
    });
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
        stroke: new Stroke({ color: '#fff', width: 3 }), // Outline for contrast
        overflow: true,  
        placement: 'point', // Usually for points/lines; for polygons it often centers automatically.
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
        stroke: new Stroke({ color: '#fff', width: 3 }), // Outline for contrast
        overflow: true,  
        placement: 'point', // Usually for points/lines; for polygons it often centers automatically.
      })
    });
}

export function zoomToRequestPolygon(map: OLMap, reqId:number): void {
    const vectorLayer = map.getLayers().getArray().find(layer => layer.get('name') === 'Records Layer');
    if (!vectorLayer) {
      console.error('zoomToRequestPolygon: "Records Layer" not found');
      return;
    }
    if (!vectorLayer || !(vectorLayer instanceof OLlayer)) {
        console.error('Records Layer source not found');
        return;
    
    }    
    const vectorSource = vectorLayer.getSource();
    if (!(vectorSource instanceof VectorSource)) {
        console.error('zoomToRequestPolygon: vector source not found');
        return;
    }

    const features = vectorSource.getFeatures();
    const feature = features.find(f => f.get('req_id') === reqId);
    if (feature) {
      map.getView().fit(feature.getGeometry().getExtent(), { size: map.getSize(), padding: [20,20,20,20] });
    } else {
      console.error('zoomToRequestPolygon: feature not found for reqId:',reqId);
    }
}

export function renderRequestPolygon(map: OLMap, poly: {lon: number, lat: number}[],color:string, reqId:number=0, layerName:string='Drawing Layer',forceZoom:boolean=false): void {
    // 1. Find your vector layer
    const vectorLayer = map.getLayers().getArray().find(layer => layer.get('name') === layerName);
    if (!vectorLayer) {
      console.error(`renderRequestPolygon: ${layerName} not found`);
      return;
    }
    // 2. Get the source
    if (!vectorLayer || !(vectorLayer instanceof OLlayer)) {
        console.error('Records Layer source not found');
        return;
    
    }
    const vectorSource = vectorLayer.getSource();
    // 3. Ensure the polygon is closed
    const originalCoordinates: Coordinate[] = poly.map(p => [p.lon, p.lat]);
    if (originalCoordinates.length > 0) {
      const first = originalCoordinates[0];
      const last = originalCoordinates[originalCoordinates.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        originalCoordinates.push(first); // close the loop
      }
    }

    // 4. Transform coordinates FROM lat/lon TO map's projection if needed
    const projection = map.getView().getProjection();
    let coordinates: Coordinate[];
    if (projection.getUnits() !== 'degrees') {
      // e.g. if the map is in EPSG:3857 or meters, transform from lat/lon
      coordinates = originalCoordinates.map(coord => fromLonLat(coord));
    } else {
      // already in lat/lon
      coordinates = originalCoordinates;
    }

    // 5. Create the Polygon feature
    const polygon = new OlPolygon([coordinates]);
    const feature = new Feature({ geometry: polygon, req_id:(reqId>0)?reqId:null });
    if(color==='red'){
        feature.setStyle(createRedReqPolygonStyle());
        feature.setId(`SelectedArea-${reqId}`);
    } else {
        feature.setStyle(createBlueReqPolygonStyle(reqId.toString()));
        feature.setId(`SelectedAreaCH-${reqId}`);
    }
    vectorSource.addFeature(feature);

    // 6. if tis is current request and no saved zoom: zoom to the new polygon
    if(reqId === 0){
        if(!canRestoreZoomCenter(map)){
            console.log('renderRequestPolygon: zooming to new polygon');
            map.getView().fit(polygon.getExtent(), { size: map.getSize(), padding: [20,20,20,20] });
        }
    } else {
        if(forceZoom){
            console.log('renderRequestPolygon: zooming to new polygon');
            map.getView().fit(polygon.getExtent(), { size: map.getSize(), padding: [20,20,20,20] });
        }
    }
    //console.log('renderRequestPolygon: feature added', feature, 'polygon:',polygon, 'color',color, 'reqId:',reqId, 'layerName:',layerName, 'forceZoom:',forceZoom);
}

export async function renderSvrReqPoly(map:OLMap,reqId:number,layerName:string='Records Layer',forceZoom:boolean=false): Promise<SrRegion> {
    const startTime = performance.now(); // Start time
    let poly:SrRegion = [];
    try{
        if(map){
            poly = await db.getSvrReqPoly(reqId);
            const rc = await db.getRunContext(reqId);
            if(poly.length > 0){
                if(rc){
                    if(rc?.parentReqId<=0){
                        renderRequestPolygon(map, poly, 'blue', reqId, layerName, forceZoom);
                    }
                } else {
                    renderRequestPolygon(map, poly, 'blue', reqId, layerName, forceZoom);
                }
            } else {
                console.warn('renderSvrReqPoly Error getting svrReqPoly for reqId:',reqId);
            }
        } else {
            console.error('renderSvrReqPoly Error: map is null');
        }
    } catch (error) {
        console.error('renderSvrReqPoly Error:',error);
    }
    const endTime = performance.now(); // End time
    //console.log(`renderSvrReqPoly forceZoom:${forceZoom} took ${endTime - startTime} milliseconds.`);
    return poly;
}

export async function updateMapView(map:OLMap, 
                                    srViewKey:string, 
                                    reason:string, 
                                    restore:boolean=false,
                                    reqId:number=0 // for saving state
): Promise<void> {
    // This function is generic and shared between the two maps
    try {
        if(map){
            console.log(`------ updateMapView ${reason} srView Key:${srViewKey} ------ `);
            const srViewObj = srViews.value[`${srViewKey}`];
            const srProjObj = srProjections.value[srViewObj.projectionName];
            let newProj = getProjection(srViewObj.projectionName);
            const baseLayer = srViewObj.baseLayerName;
            //console.log(`updateMapView for ${reason} with baseLayer:${baseLayer} projectionName:${srViewObj.projectionName} projection:`,newProj);    
            if(baseLayer && newProj && srViewObj){
                map.getAllLayers().forEach((layer: OLlayer) => {
                    //console.log(`removing layer:`,layer.get('title'));
                    map.removeLayer(layer);
                });
                //console.log('adding Base Layer', baseLayer);
                const layer = getLayer(srViewObj.projectionName, baseLayer);
                if(layer){
                    map.addLayer(layer);
                } else {
                    console.error(`Error: no layer found for curProj:${srViewObj.projectionName} baseLayer.title:${baseLayer}`);
                }
                //console.log(`${newProj.getCode()} units: ${newProj.getUnits()}`);
                const fromLonLat = getTransform('EPSG:4326', newProj);
                let extent = newProj.getExtent();
                //console.log("newProj:",newProj);         
                //console.log("newProj.getExtent():",extent);         
                if((extent===undefined)||(extent===null)){
                    if(srProjObj.extent){
                        //console.log("extent is null using srProjObj.extent");
                        extent = srProjObj.extent;
                    } else {
                        console.error("extent is null using bbox");
                        let bbox = srProjObj.bbox;
                        if (srProjObj.bbox[0] > srProjObj.bbox[2]) {
                            bbox[2] += 360;
                        }
                        if(newProj.getUnits() === 'degrees'){
                            //console.log("using bbox for extent in degrees bbox:",bbox);
                            extent = bbox;
                        } else {
                            //console.log("using bbox for extent transformed from degrees to meters bbox:",bbox);
                            extent = applyTransform(bbox, fromLonLat, undefined, undefined);
                        }
                        newProj.setExtent(extent);
                    }
                }

                let worldExtent = newProj.getWorldExtent();
                if((worldExtent===undefined) || (worldExtent===null) ||  worldExtent.some(value => !Number.isFinite(value))){
                    //console.log("worldExtent is null using bbox");
                    let bbox = srProjObj.bbox;
                    if (srProjObj.bbox[0] > srProjObj.bbox[2]) {
                        bbox[2] += 360;
                    }
                    if(newProj.getUnits() === 'degrees'){
                        //console.log("using bbox for worldExtent in degrees bbox:",bbox);
                        worldExtent = bbox;
                    } else {
                        //console.log("using bbox for worldExtent transformed from degrees to meters bbox:",bbox);
                        worldExtent = applyTransform(bbox, fromLonLat, undefined, undefined);
                    }
                    if(worldExtent.some(value => !Number.isFinite(value))){
                        console.warn("worldExtent is still invalid after transformation falling back to extent");
                        worldExtent = extent;
                        newProj.setWorldExtent(worldExtent);
                    } else {
                        newProj.setWorldExtent(worldExtent);                        
                    }
                }
                let center = getExtentCenter(extent);
                if(srProjObj.center){
                    //console.log("using srProjObj.center for center");
                    center = srProjObj.center;
                }

                //console.log("newProj:",newProj);          
                //console.log("newProj final extent:",extent);          
                //console.log("newProj final WorldExtent:",worldExtent);          
                //console.log("newProj final Center:",center); 
                let newView = new OlView({
                    projection: newProj,
                    extent: extent,
                    center: center,
                    zoom: srProjObj.default_zoom,
                });
                //console.log('Initial newView extent:', extent);
                //console.log('Initial newView center:', center);
                //console.log('Initial newView zoom:', srProjObj.default_zoom);
                //console.log('Initial newView:', newView);
                useMapStore().setExtentToRestore(extent);
                if(restore){
                    const restoredView = restoreMapView(newProj);
                    if (restoredView) {
                        newView = restoredView;
                    } else {
                        console.warn('Failed to restore view for:', reason);
                    }    
                }
                console.log('Setting new view:', newView);
                map.setView(newView);
            } else {
                if(!baseLayer){
                    console.error("Error:baseLayer is null");
                }
                if(!newProj){
                    console.error("Error:newProj is null");
                }
                if(!srViewObj){
                    console.error("Error:srView is null");
                }
            }
        } else {
            console.error("Error:map is null");
        }
    } catch (error) {
        console.error(`Error: updateMapView failed for ${reason}`,error);
    }
}

export async function zoomMapForReqIdUsingView(map:OLMap, reqId:number, srViewKey:string){
    try{
        let reqExtremeLatLon = [0,0,0,0];
        if(reqId > 0){   
            //console.log('calling readOrCacheSummary(',reqId,')');  
            const workerSummary = await readOrCacheSummary(reqId);
            if(workerSummary){
                const extremeLatLon = workerSummary.extLatLon;
                if (extremeLatLon) {
                    reqExtremeLatLon = [
                        extremeLatLon.minLon,
                        extremeLatLon.minLat,
                        extremeLatLon.maxLon,
                        extremeLatLon.maxLat
                    ];
                    //console.log('Using reqId:',props.reqId,' with extent:',extent);
                } else {
                    console.error("Error: invalid lat-lon data for request:",reqId);
                }
            } else {
                console.error("Error: invalid workerSummary for request:",reqId);
            } 
        } else {
            console.info("no reqId:",reqId);
        }
        //console.log('reqExtremeLatLon:',reqExtremeLatLon);
        //console.log('Using extent:',extent);               
        //let srViewKey = await db.getSrViewName(reqId);
        const srViewObj = srViews.value[`${srViewKey}`];
        const srProjObj = srProjections.value[srViewObj.projectionName];
        let newProj = getProjection(srViewObj.projectionName);
        //console.log(`zoomMapForReqIdUsingView:${reqId} srViewKey:${srViewKey} srViewObj:`,srViewObj);
        //console.log(`zoomMapForReqIdUsingView:${reqId} newProj:`,newProj);
        let view_extent = reqExtremeLatLon;
        if(newProj?.getUnits() !== 'degrees'){
            //console.log('transforming view_extent to degrees for projection:',newProj);
            const fromLonLat = getTransform('EPSG:4326', srViewObj.projectionName);
            view_extent = applyTransform(reqExtremeLatLon, fromLonLat, undefined, 8);
        } else {
            //console.log('using degrees view_extent?:',view_extent);
        }
        //console.log(`zoomMapForReqIdUsingView:${reqId} view_extent:`,view_extent);
        map.getView().fit(view_extent, {size: map.getSize(), padding: [40, 40, 40, 40]});
    } catch (error) {
        console.error(`Error: zoomMapForReqIdUsingView failed for reqId:${reqId}`,error);
    }
}

const updateElevationMap = async (req_id: number) => {
    const startTime = performance.now(); // Start time
    console.log('updateElevationMap req_id:', req_id);
    //const reqIdStr = req_id.toString();
    if(req_id <= 0){
        console.warn(`updateElevationMap Invalid request ID:${req_id}`);
        return;
    }
    try {
        const mapStore = useMapStore();
        mapStore.setIsLoading(true);
        const parms = await duckDbReadAndUpdateElevationData(req_id);
        mapStore.setMapInitialized(true);
        mapStore.setIsLoading(false);
    } catch (error) {
        console.warn('Failed to update selected request:', error);
        //toast.add({ severity: 'warn', summary: 'No points in file', detail: 'The request produced no points', life: srToastStore.getLife()});
    }
    try {
        await router.push(`/analyze/${useRecTreeStore().selectedReqId}`);
        console.log('Successfully navigated to analyze:', useRecTreeStore().selectedReqId);
    } catch (error) {
        console.error('Failed to navigate to analyze:', error);
    }
    const endTime = performance.now(); // End time
    console.log(`updateElevationMap took ${endTime - startTime} milliseconds.`);
};

export async function processNewReqId(map:OLMap): Promise<void> {
    const startTime = performance.now(); // Start time
 
    const mapStore = useMapStore();
 
    const atlChartFilterStore = useAtlChartFilterStore();
    const recTreeStore = useRecTreeStore();
    try {
        const req_id = recTreeStore.selectedReqId;
        if(req_id > 0){
            mapStore.setTotalRows(0);
            mapStore.setCurrentRows(0);
            atlChartFilterStore.setDebugCnt(0);
            atlChartFilterStore.setSelectedOverlayedReqIds([]);
            await updateElevationMap(req_id);
            await updatePlotAndSelectedTrackMapLayer("processNewReqId");
        }
        //console.log('onMounted recTreeStore.reqIdMenuItems:', recTreeStore.reqIdMenuItems);
    } catch (error) {
        if (error instanceof Error) {
            console.error('processNewReqId Failed:', error.message);
        } else {
            console.error('processNewReqId Unknown error occurred:', error);
        }
    } finally {
        //console.log('Mounted SrAnalyzeOptSidebar with defaultReqIdMenuItemIndex:', defaultReqIdMenuItemIndex);
        const endTime = performance.now(); // End time
        console.log(`processNewReqId took ${endTime - startTime} milliseconds.`);
    }
}
export function generateNameSuffix(
    req_id: number|string,
    rgt: number|string,
    cycles: number[],
    spots: number[],
    use_y_atc_filter: boolean,
    min_y_atc?: number|string,
    max_y_atc?: number|string
): string {
    let nameSuffix = `-${req_id}-${rgt}-${cycles.join('-')}-${spots.join('-')}`;

    if (use_y_atc_filter && min_y_atc !== undefined && max_y_atc !== undefined) {
        nameSuffix += `-${min_y_atc}-${max_y_atc}`;
    }

    return nameSuffix;
}
