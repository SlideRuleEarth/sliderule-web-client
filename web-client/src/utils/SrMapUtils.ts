import { useMapStore } from '@/stores/mapStore';
import { computed} from 'vue';
import { useGeoJsonStore } from '@/stores/geoJsonStore';
import { PointCloudLayer } from '@deck.gl/layers';
import { COORDINATE_SYSTEM } from '@deck.gl/core';
import GeoJSON from 'ol/format/GeoJSON';
import VectorSource from 'ol/source/Vector';
import { Feature } from 'ol';
import { Deck } from '@deck.gl/core';
import { toLonLat } from 'ol/proj';
import { Layer as OLlayer } from 'ol/layer';
import type OLMap from "ol/Map.js";
import { unByKey } from 'ol/Observable';
import type { EventsKey } from 'ol/events';
import type { ExtHMean } from '@/workers/workerUtils';
import { Style, Fill, Stroke } from 'ol/style';
import { getScOrientFromSpotGt } from '@/utils/parmUtils';
import { getSpotNumber,getGroundTrack } from './spotUtils';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { useDeckStore } from '@/stores/deckStore';
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore';
import { useAtl03ColorMapStore } from '@/stores/atl03ColorMapStore';
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
import { readOrCacheSummary } from "@/utils/SrParquetUtils";
import type { PickingInfo } from '@deck.gl/core';
import type { MjolnirEvent } from 'mjolnir.js';
import { useChartStore } from '@/stores/chartStore';
import { clearPlot } from '@/utils/plotUtils';

export const EL_LAYER_NAME = 'elevation-deck-layer';
export const SELECTED_LAYER_NAME = 'selected-deck-layer';

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
    vectorSource: VectorSource,
    geoJsonData: string, 
    noFill: boolean = false, 
    zoomTo: boolean = false,
    tag: string = '', 
): void {
    console.log('drawGeoJson geoJsonData:',geoJsonData,tag);
    try{
        const map = useMapStore().map;
        if(!map){
            console.error('Map is not defined.');
            return;
        }
        if(vectorSource){
            dumpFeaturesToConsole(vectorSource);
            // Parse GeoJSON data
            const format = new GeoJSON();
            const features = format.readFeatures(geoJsonData, {
                featureProjection: useMapStore().getSrViewObj().projectionName, 
            });
            // add features to source
            let style: Style;
            if (noFill) {
                // Define a style without a fill
                style = new Style({
                    stroke: new Stroke({
                        color: 'rgba(255, 0, 0, 1)', // Red stroke with 100% opacity
                        width: 2,
                    }),
                });
            } else {
                // Define a style with both fill and stroke
                style = new Style({
                    fill: new Fill({
                        color: 'rgba(255, 0, 0, 0.1)', // Red fill with 10% opacity
                    }),
                    stroke: new Stroke({
                        color: 'rgba(0, 0, 255, 1)', // Blue stroke with 100% opacity
                        width: 2,
                    }),
                });
            }
            // add style and tag to features
            features.forEach((feature,index) => {
                feature.setId(`feature-${index}`);
                feature.setStyle(style);
                feature.set('tag', tag);  // Add the tag to the feature's properties
            });
            console.log('drawGeoJson add features:',features);
            vectorSource.addFeatures(features);
            // Zoom to the extent of the new features
            if (zoomTo) {
                const extent = vectorSource.getExtent();
                map.getView().fit(extent, { padding: [50, 50, 50, 50] });
            }
            dumpFeaturesToConsole(vectorSource);
        } else {
            console.error('VectorSource is not defined.');
        }
    } catch (error) {
        console.error('drawGeoJson error:',error);
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
function formatElObject(obj: { [key: string]: any }): string {
    const gpsToATLASOffset = 1198800018; // Offset in seconds from GPS to ATLAS SDP time
    const gpsToUnixOffset = 315964800; // Offset in seconds from GPS epoch to Unix epoch
  
    return Object.entries(obj)
      .filter(([key]) => key !== 'extent_id') // Exclude 'extent_id'
      .map(([key, value]) => {
        let formattedValue;
        //console.log('key:',key,'type of value:',typeof value,'value:',value);
        if (key === 'time' && typeof value === 'number') {
          // Step 1: Convert GPS to ATLAS SDP by subtracting the ATLAS offset
          let adjustedTime = value - gpsToATLASOffset;
          // Step 2: Align ATLAS SDP with Unix epoch by adding the GPS-to-Unix offset
          adjustedTime += gpsToUnixOffset;
          // Step 3: Adjust for UTC by subtracting the GPS-UTC offset
          adjustedTime -= useReqParamsStore().getGpsToUTCOffset();
  
          const date = new Date(adjustedTime); // Convert seconds to milliseconds
          formattedValue = date.toISOString(); // Format as ISO string in UTC
        } else if (key === 'canopy_h_metrics' && typeof value === 'object' && 'toArray' in value) {
            const arr = (value as any).toArray(); // Safely call toArray if available
            const formattedPairs = [...arr]
                .reduce((pairs: number[][], num: number, index: number) => {
                    if (index % 3 === 0) {
                        // Start a new pair
                        pairs.push([num]);
                    } else {
                        // Add to the last pair
                        pairs[pairs.length - 1].push(num);
                    }
                    return pairs;
                }, []) // Initialize as an array of arrays
                .map((pair: number[]) => pair.map((num: number) => num.toFixed(5)).join(', ')) // Format each pair
                .join('<br>'); // Join pairs with line breaks
        
            formattedValue = `[<br>${formattedPairs}<br>]`; // Wrap the entire string with brackets
            // console.log('canopy_h_metrics formattedValue:', formattedValue);
        } else if (typeof value === 'number') {
          // Format other numbers to 5 significant figures
          formattedValue = parseFloat(value.toPrecision(10));
        } else {
          formattedValue = value;
        }
  
        return `<strong>${key}</strong>: <em>${formattedValue}</em>`;
      })
      .join('<br>'); // Use <br> for line breaks in HTML
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

export function updateWhereClause(reqIdStr:string){
    const cs = useChartStore();
    const func = cs.getFunc(reqIdStr);
    console.log("updateWhereClause func:",func,'reqIdStr:',reqIdStr);
    if(func==='atl03sp'){
        let atl03spWhereClause = `
            WHERE rgt IN (${cs.getRgtValues(reqIdStr).join(', ')}) 
            AND cycle IN (${cs.getCycleValues(reqIdStr).join(', ')})
            AND track IN (${cs.getTrackValues(reqIdStr).join(", ")}) 
        `;
        if ((cs.getPairValues(reqIdStr) !== undefined) && (cs.getPairValues(reqIdStr).length > 0)) {
            atl03spWhereClause += ` AND pair IN (${cs.getPairValues(reqIdStr).join(", ")})`;
        } else {
            console.warn('Clicked: pairs is undefined or empty');
        }
        if ((cs.getScOrientValues(reqIdStr) !== undefined)  && (cs.getScOrientValues(reqIdStr).length > 0)) {
            atl03spWhereClause += ` AND sc_orient IN (${cs.getScOrientValues(reqIdStr).join(", ")})`;
        } else {
            console.warn('Clicked: sc_orient is undefined or empty');
        }
        cs.setWhereClause(reqIdStr,atl03spWhereClause);
        
        console.log('Clicked: atl03spWhereClause',cs.getWhereClause(reqIdStr))
    } else if(func === 'atl03vp'){
        const atl03vpWhereClause = `
            WHERE rgt IN (${cs.getRgtValues(reqIdStr).join(', ')}) 
            AND cycle IN (${cs.getCycleValues(reqIdStr).join(', ')})
            AND spot IN (${cs.getSpotValues(reqIdStr).join(", ")}) 
        `;
        cs.setWhereClause(reqIdStr,atl03vpWhereClause);
        console.log('Clicked: atl06spWhereClause',cs.getWhereClause(reqIdStr))
    } else if (func.includes('atl06')){ // all atl06
        const atl06WhereClause = `
            WHERE rgt IN (${cs.getRgtValues(reqIdStr).join(', ')}) 
            AND cycle IN (${cs.getCycleValues(reqIdStr).join(', ')})
            AND spot IN (${cs.getSpotValues(reqIdStr).join(", ")}) 
        `;
        cs.setWhereClause(reqIdStr,atl06WhereClause);
        console.log('Clicked: atl06WhereClause',cs.getWhereClause(reqIdStr))
    } else if (func === 'atl08p'){
        const atl08pWhereClause = `
            WHERE rgt IN (${cs.getRgtValues(reqIdStr).join(', ')}) 
            AND cycle IN (${cs.getCycleValues(reqIdStr).join(', ')})
            AND spot IN (${cs.getSpotValues(reqIdStr).join(", ")}) 
        `;
        cs.setWhereClause(reqIdStr,atl08pWhereClause);
        console.log('Clicked: atl08pWhereClause',cs.getWhereClause(reqIdStr))
    } else {
        console.error('Clicked: Unknown func?:',func);
    }

}

export async function clicked(d:ElevationDataItem): Promise<void> {
    //console.log('Clicked data:',d);
    hideTooltip();
    useAtlChartFilterStore().setShowPhotonCloud(false);
    clearPlot();
    
    const reqIdStr = useAtlChartFilterStore().getReqIdStr();
    //useAtlChartFilterStore().setIsLoading();

    //console.log('d:',d,'d.spot',d.spot,'d.gt',d.gt,'d.rgt',d.rgt,'d.cycle',d.cycle,'d.track:',d.track,'d.gt:',d.gt,'d.sc_orient:',d.sc_orient,'d.pair:',d.pair)
    const cs = useChartStore();
    if(d.track !== undefined){ // for atl03
        cs.setTrackWithNumber(reqIdStr, d.track);
        cs.setBeamsForTracks(reqIdStr, cs.getTracks(reqIdStr));
    }
    if(d.gt !== undefined){ // for atl06
        cs.setBeamsAndTracksWithGts(reqIdStr, [{label:d.gt.toString(), value:d.gt}]);
    }
    if(d.sc_orient !== undefined){
        cs.setScOrientWithNumber(reqIdStr, d.sc_orient);
    }
    if(d.pair !== undefined){
        cs.setPairWithNumber(reqIdStr, d.pair);
    }
    if(d.spot !== undefined){
        cs.setSpotWithNumber(reqIdStr, d.spot);
    }
    if((d.gt !== undefined) && (d.spot !== undefined)){
        cs.setScOrientWithNumber(reqIdStr, getScOrientFromSpotGt(d.spot,d.gt));
    }
    if(d.rgt !== undefined){
        cs.setRgtWithNumber(reqIdStr, d.rgt);
    } else {
        console.error('d.rgt is undefined'); // should always be defined
    }
    if(d.cycle !== undefined){
        cs.setCycleWithNumber(reqIdStr, d.cycle);
    } else {
        console.error('d.cycle is undefined'); // should always be defined
    }
    // for atl03
    const func = useChartStore().getFunc(reqIdStr);
    console.log('Clicked: func',func);
    console.log('Clicked: rgts',cs.getRgtValues(reqIdStr))
    console.log('Clicked: cycles',cs.getCycleValues(reqIdStr))
    console.log('Clicked: tracks',cs.getTrackValues(reqIdStr))
    console.log('Clicked: sc_orient',cs.getScOrientValues(reqIdStr))
    console.log('Clicked: pair',cs.getPairValues(reqIdStr));
    if(func==='atl03sp'){
        if((d.sc_orient !== undefined) && (d.track !== undefined) && (d.pair !== undefined)){ //atl03
            cs.setSpotWithNumber(reqIdStr, getSpotNumber(d.sc_orient,d.track,d.pair));
            cs.setBeamWithNumber(reqIdStr, getGroundTrack(d.sc_orient,d.track,d.pair));
        }
    }
    updateWhereClause(reqIdStr);
    console.log('Clicked: spot',cs.getSpotValues(reqIdStr))
    console.log('Clicked: beam',cs.getBeamValues(reqIdStr))

}

function createHighlightLayer(name:string,elevationData:ElevationDataItem[], color:[number,number,number,number], projName:string): PointCloudLayer {
    //console.log('createHighlightLayer elevationData:',elevationData,'color:',color,'projName:',projName);
    return new PointCloudLayer({
        id: name,
        data: elevationData,
        getPosition: (d) => {
            return [d['longitude'], d['latitude'], 0];
        },
        // getPosition: (d) => {
        //     const coords = proj4(projName, 'EPSG:3857', [d['longitude'], d['latitude'], 0]);
        //     return new Float64Array(coords); // Use Float64Array for higher precision
        // },
        getNormal: [0, 0, 1],
        getColor: () => {
             return color;
        },
        pointSize: useDeckStore().getPointSize(),
        onDragStart: () => {
            console.log('onDragStart');
            document.body.style.cursor = 'grabbing'; // Change to grabbing when dragging starts
          },
        onDragEnd: () => {
            console.log('onDragEnd');
            document.body.style.cursor = 'default'; // Revert to default when dragging ends
        },
    });
}

export function updateSelectedLayerWithObject(elevationData:ElevationDataItem[], projName:string): void{
    const startTime = performance.now(); // Start time
    //console.log('updateSelectedLayerWithObject startTime:',startTime);
    try{
        const layer = createHighlightLayer(SELECTED_LAYER_NAME,elevationData,[255, 0, 0, 255],projName);
        useDeckStore().replaceOrAddLayer(layer,SELECTED_LAYER_NAME);
        useDeckStore().getDeckInstance().setProps({layers:useDeckStore().getLayers()});
    } catch (error) {
        console.error('updateSelectedLayerWithObject Error updating elevation layer:',error);
    } finally {
        const endTime = performance.now(); // End time
        console.log(`updateSelectedLayerWithObject took ${endTime - startTime} milliseconds. endTime:`,endTime);  
    }

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

function createElLayer(name:string, elevationData:ElevationDataItem[], extHMean: ExtHMean, heightFieldName:string, projName:string): PointCloudLayer {
    //console.log('createElLayer name:',name,' elevationData:',elevationData,'extHMean:',extHMean,'heightFieldName:',heightFieldName,'projName:',projName);
    //let coordSys;
    //if(projName === 'EPSG:4326'){
    //    coordSys = COORDINATE_SYSTEM.LNGLAT; // Deck.gl’s internal system for EPSG:4326
    //} else {
    //    coordSys = COORDINATE_SYSTEM.DEFAULT;
    //}
    return new PointCloudLayer({
        id: name,
        data: elevationData,
        //coordinateSystem: coordSys, 
        getPosition: (d) => {
            return [d['longitude'], d['latitude'], 0];
        },
        // getPosition: (d) => {
        //     const coords = proj4(projName, 'EPSG:3857', [d['longitude'], d['latitude'], 0]); // Deck is in EPSG:3857
        //     return new Float64Array(coords); // Use Float64Array for higher precision
        // },
        getNormal: [0, 0, 1],
        getColor: (d:any) => {
            let c; 
            try{
                const h = d[heightFieldName];
                c = useElevationColorMapStore().getColorForElevation(h, extHMean.lowHMean , extHMean.highHMean) as [number, number, number, number];
                //console.log(`hfn:${heightFieldName} getColor h:${h} c:${c}`);
                if(c){
                    c[3] = 255; // Set the alpha channel to 255 (fully opaque)
                }
            } catch (error) {
                console.error('Error getting color:',c,' error:',error);
            }
            if((c === undefined) || (c === null)){
                c = [255, 255, 255, 255] as [number,number,number,number];// flag illegal points with white
            }   
            return c;
        },
        pointSize: 3,
        pickable: true, // Enable picking
        getCursor: () => 'default',
        parameters: {
            depthTest: false
        },
        onHover: onHoverHandler,
        onClick: ({ object, x, y }) => {
            if (object) {
                clicked(object);
            }
        },
        // onDragStart: ({ object, x, y }, event) => {
        //     if (object) {
        //         console.log('Drag started at:', x, y);
        //         document.body.style.cursor = 'grabbing'; // Change to grabbing when dragging starts
        //         return true; // Mark the event as handled
        //     }
        // },
        // onDragEnd: ({ object, x, y }, event) => {
        //     if (object) {
        //         console.log('Drag ended at:', x, y);
        //         document.body.style.cursor = 'default'; // Revert to default when dragging ends
        //         return true; // Mark the event as handled
        //     }
        // },        
    });
}

export function updateElLayerWithObject(name:string,elevationData:ElevationDataItem[], extHMean: ExtHMean, heightFieldName:string, projName:string): void{
    const startTime = performance.now(); // Start time
    //console.log('updateElLayerWithObject startTime:',startTime);
    try{
        if(useDeckStore().getDeckInstance()){
            //console.log('updateElLayerWithObject elevationData:',elevationData,'extHMean:',extHMean,'heightFieldName:',heightFieldName);
            const layer = createElLayer(name,elevationData,extHMean,heightFieldName,projName);
            const replaced = useDeckStore().replaceOrAddLayer(layer,name);
            //console.log('updateElLayerWithObject layer:',layer);
            console.log('updateElLayerWithObject useDeckStore().getLayers():',useDeckStore().getLayers());
            useDeckStore().getDeckInstance().setProps({layers:useDeckStore().getLayers()});
            //console.log('updateElLayerWithObject useDeckStore().getDeckInstance():',useDeckStore().getDeckInstance());
            // if(replaced){
            //     console.log('Replaced using elevation layer:',layer);
            // } else {
            //     console.log('Added using elevation layer:',layer);
            // }
        } else {
            console.error('updateElLayerWithObject Error updating elevation useDeckStore().deckInstance:',useDeckStore().getDeckInstance());
        }
    } catch (error) {
        console.error('updateElLayerWithObject Error updating elevation layer:',error);
    } finally {
        const endTime = performance.now(); // End time
        console.log(`updateElLayerWithObject took ${endTime - startTime} milliseconds. endTime:`,endTime);  
    }

}

export function createNewDeckLayer(deck:Deck,name:String,projectionUnits:string): OLlayer{
    console.log('createNewDeckLayer:',name,' projectonUnits:',projectionUnits);  

    const layerOptions = {
        title: name,
    }
    const new_layer = new OLlayer({
        render: ({size, viewState}: {size: number[], viewState: {center: number[], zoom: number, rotation: number}})=>{
            //console.log('createNewDeckLayer render:',name,' size:',size,' viewState:',viewState,' center:',viewState.center,' zoom:',viewState.zoom,' rotation:',viewState.rotation);
            const [width, height] = size;
            //console.log('createNewDeckLayer render:',name,' size:',size,' viewState:',viewState,' center:',viewState.center,' zoom:',viewState.zoom,' rotation:',viewState.rotation);
            let [longitude, latitude] = viewState.center;
            if(projectionUnits !== 'degrees'){
                [longitude, latitude] = toLonLat(viewState.center);
            }
            const zoom = viewState.zoom - 1;
            const bearing = (-viewState.rotation * 180) / Math.PI;
            const deckViewState = {bearing, longitude, latitude, zoom};
            deck.setProps({width, height, viewState: deckViewState});
            deck.redraw();
            return document.createElement('div');
        },
        ...layerOptions
    }); 
    return new_layer;  
}

// Custom Render Logic: The render option is a function that takes an object containing size and viewState. This function is where you align the DeckGL layer's view with the OpenLayers map's current view state.
// size is an array [width, height] indicating the dimensions of the map's viewport.
// viewState contains the current state of the map's view, including center coordinates, zoom level, and rotation. This information is converted and passed to DeckGL to ensure both visualizations are synchronized.
// Setting DeckGL Properties: Inside the render function, properties of the DeckGL instance (deck) are updated to match the current size and view state of the OpenLayers map. This ensures that the DeckGL visualization aligns correctly with the map's viewport, zoom level, and rotation.
// Redrawing DeckGL: After updating the properties, deck.redraw() is called to render the DeckGL layer with the new settings.
// Sync deck view with OL view

export function resetDeckGLInstance(map:OLMap): Deck | null{
    console.log('resetDeckGLInstance');
    try{
        useDeckStore().clearDeckInstance(); // Clear any existing instance first
        let deck = null;
        const mapView =  map.getView();
        console.log('mapView:',mapView);
        const mapCenter = mapView.getCenter();
        const mapZoom = mapView.getZoom();
        console.log('resetDeckGLInstance mapCenter:',mapCenter,' mapZoom:',mapZoom);
        if(mapCenter && mapZoom){
            const tgt = map.getViewport() as HTMLDivElement;
            deck = new Deck({
                initialViewState: {longitude:0, latitude:0, zoom: 1},
                controller: false,
                parent: tgt,
                style: {pointerEvents: 'none', zIndex: '1'},
                layers: [],
                getCursor: () => 'default'
            });
            useDeckStore().setDeckInstance(deck);
        } else {
            console.error('resetDeckGLInstance mapCenter or mapZoom is null mapCenter:',mapCenter,' mapZoom:',mapZoom);
            deck = null;
        }
        return deck // we just need a 'fake' Layer object with render function and title to marry to Open Layers
    } catch (error) {
        console.error('Error creating DeckGL instance:',error);
        return null;
    }
}

export function addDeckLayerToMap(map: OLMap, deck:Deck, name:string){
    console.log('addDeckLayerToMap:',name);
    const mapView =  map.getView();
    const projection = mapView.getProjection();
    const projectionUnits = projection.getUnits();
    const updatingLayer = map.getLayers().getArray().find(layer => layer.get('title') === name);
    if (updatingLayer) {
        console.log('addDeckLayerToMap: removeLayer:',updatingLayer);
        map.removeLayer(updatingLayer);
    }
    useDeckStore().deleteLayer(name);
    const deckLayer = createNewDeckLayer(deck,name,projectionUnits);
    if(deckLayer){
        map.addLayer(deckLayer);
        console.log('addDeckLayerToMap: added deckLayer:',deckLayer,' deckLayer.get(\'title\'):',deckLayer.get('title'));
    } else {
        console.error('No current_layer to add.');
    }
}

export function initDeck(map: OLMap){
    console.log('initDeck start')
    const tgt = map.getViewport() as HTMLDivElement;
    const deck = resetDeckGLInstance(map); 
    if(deck){
        addDeckLayerToMap(map,deck,EL_LAYER_NAME);        
    } else {
      console.error('initDeck(): deck Instance is null');
    }
    console.log('initDeck end: deck:',deck);
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
    const limit = useReqParamsStore().getAreaWarningThreshold()
    //console.log('checkAreaOfConvexHullWarning area:',limit);
    if(useReqParamsStore().getAreaOfConvexHull() > limit){
        const msg = `The area of the convex hull might be too large (${useReqParamsStore().getFormattedAreaOfConvexHull()}).\n Please zoom in and then select a smaller area (try < ${useReqParamsStore().getAreaWarningThreshold()} km²).`;
        if(!useAdvancedModeStore().getAdvanced()){
            useSrToastStore().warn('Warn',msg);
        } else {
            console.log('checkAreaOfConvexHullWarning: Advanced mode is enabled. '+msg);
        }
        return false;
    }
    return true;
}

export function checkAreaOfConvexHullError(): boolean {
    const limit = useReqParamsStore().getAreaErrorThreshold()
    console.log('checkAreaOfConvexHullError area:',limit);
    if(useReqParamsStore().getAreaOfConvexHull() > limit){
        const msg = `The area of the convex hull is too large (${useReqParamsStore().getFormattedAreaOfConvexHull()}).\n Please zoom in and then select a smaller area  < ${useReqParamsStore().getAreaErrorThreshold()} km²).`;
        if(!useAdvancedModeStore().getAdvanced()){
            useSrToastStore().error('Error',msg);
        } else {
            console.log('checkAreaOfConvexHullError: Advanced mode is enabled. '+msg);
        }
        return false;
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
        console.log(`Feature #${index + 1}:`, JSON.stringify(geoJsonFeature, null, 2));
    });

    console.log(`Total features: ${features.length}`);
}

export async function updateMapView(map:OLMap, srViewKey:string, reason:string){
    try {
        if(map){
            console.log(`------ updateMapView for srView Key:${srViewKey} ${reason} ------ altChartFilterStore.selectedReqIdStr:`,useAtlChartFilterStore().getReqIdStr());
            const srViewObj = srViews.value[`${srViewKey}`];
            const srProjObj = srProjections.value[srViewObj.projectionName];
            let newProj = getProjection(srViewObj.projectionName);
            const baseLayer = srViewObj.baseLayerName;
            console.log(`updateMapView for ${reason} with baseLayer:${baseLayer} projectionName:${srViewObj.projectionName} projection:`,newProj);    
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
                console.log("newProj:",newProj);         
                console.log("newProj.getExtent():",extent);         
                if((extent===undefined)||(extent===null)){
                    if(srProjObj.extent){
                        console.log("extent is null using srProjObj.extent");
                        extent = srProjObj.extent;
                    } else {
                        console.error("extent is null using bbox");
                        let bbox = srProjObj.bbox;
                        if (srProjObj.bbox[0] > srProjObj.bbox[2]) {
                            bbox[2] += 360;
                        }
                        if(newProj.getUnits() === 'degrees'){
                            console.log("using bbox for extent in degrees bbox:",bbox);
                            extent = bbox;
                        } else {
                            console.log("using bbox for extent transformed from degrees to meters bbox:",bbox);
                            extent = applyTransform(bbox, fromLonLat, undefined, undefined);
                        }
                        newProj.setExtent(extent);
                    }
                }

                let worldExtent = newProj.getWorldExtent();
                if((worldExtent===undefined) || (worldExtent===null) ||  worldExtent.some(value => !Number.isFinite(value))){
                    console.log("worldExtent is null using bbox");
                    let bbox = srProjObj.bbox;
                    if (srProjObj.bbox[0] > srProjObj.bbox[2]) {
                        bbox[2] += 360;
                    }
                    if(newProj.getUnits() === 'degrees'){
                        console.log("using bbox for worldExtent in degrees bbox:",bbox);
                        worldExtent = bbox;
                    } else {
                        console.log("using bbox for worldExtent transformed from degrees to meters bbox:",bbox);
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
                    console.log("using srProjObj.center for center");
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
                console.log('Initial newView extent:', extent);
                console.log('Initial newView center:', center);
                console.log('Initial newView zoom:', srProjObj.default_zoom);
                console.log('Initial newView:', newView);
                
                if (reason === 'handleUpdateBaseLayer') {
                    console.log('Restoring view for handleUpdateBaseLayer');
                
                    const mapStore = useMapStore();
                    const extentToRestore = mapStore.getExtentToRestore();
                    const centerToRestore = mapStore.getCenterToRestore();
                    const zoomToRestore = mapStore.getZoomToRestore();
                
                    // Validate the restore parameters
                    if (
                        extentToRestore === null ||
                        centerToRestore === null ||
                        zoomToRestore === null
                    ) {
                        console.warn('One or more restore parameters are null');
                    } else if (
                        !extentToRestore.every(value => Number.isFinite(value))
                    ) {
                        console.warn('Invalid extentToRestore:', extentToRestore);
                    } else {
                        // All restore parameters are valid, create a new view
                        newView = new OlView({
                            projection: newProj,
                            extent: extentToRestore,
                            center: centerToRestore,
                            zoom: zoomToRestore,
                        });
                        console.log('Restored view with extent:', extentToRestore);
                        console.log('Restored view with center:', centerToRestore);
                        console.log('Restored view with zoom:', zoomToRestore);
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
            console.log('calling readOrCacheSummary(',reqId,')');  
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
            console.log('using degrees view_extent?:',view_extent);
        }
        //console.log(`zoomMapForReqIdUsingView:${reqId} view_extent:`,view_extent);
        map.getView().fit(view_extent, {size: map.getSize(), padding: [40, 40, 40, 40]});
    } catch (error) {
        console.error(`Error: zoomMapForReqIdUsingView failed for reqId:${reqId}`,error);
    }
}