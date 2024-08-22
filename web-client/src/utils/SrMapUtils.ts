import { useMapStore } from '@/stores/mapStore';
import { computed, h } from 'vue';
import { useGeoJsonStore } from '@/stores/geoJsonStore';
import { PointCloudLayer } from '@deck.gl/layers';
import { GeoJSON} from 'ol/format';
import VectorLayer from 'ol/layer/Vector';
import Feature from 'ol/Feature';
import { Geometry } from 'ol/geom';
import { Polygon } from 'ol/geom';
import { Deck } from '@deck.gl/core';
import { toLonLat} from 'ol/proj';
import { Layer as OL_Layer} from 'ol/layer';
import type OLMap from "ol/Map.js";
import type { ExtHMean } from '@/workers/workerUtils';
import { Style, Fill, Stroke } from 'ol/style';
import { addHighlightLayerForReq } from '@/utils/SrParquetUtils';
import { getScOrientFromSpotGt } from '@/utils/parmUtils';
import { getSpotNumber,getGroundTrack } from './spotUtils';
import { useMapParamsStore } from '@/stores/mapParamsStore';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { useCurReqSumStore } from '@/stores/curReqSumStore';
import { useDeckStore } from '@/stores/deckStore';

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

export function drawGeoJson(geoJsonData:string) {
    console.log('drawGeoJson:',geoJsonData);
    const map = useMapStore().map
    if(map){
        const vectorLayer = map.getLayers().getArray().find(layer => layer.get('name') === 'Drawing Layer') as VectorLayer<Feature<Geometry>>;
        if (!vectorLayer) {
            console.error('Vector layer is not defined.');
            return;
        }
        const geoJSON = new GeoJSON(); 
        const features = geoJSON.readFeatures(geoJsonData, {
            featureProjection: useMapParamsStore().projection, 
        }) as Feature<Geometry>[];
        const src = vectorLayer.getSource();
        if(src){
            // Add the features to the vector layer source
            src.clear(); // Optional: Remove existing features
            src.addFeatures(features);


            // Define a style with the desired colors
            const style = new Style({
                fill: new Fill({
                color: 'rgba(255, 0, 0, 0.1)', // Red fill with 10% opacity
                }),
                stroke: new Stroke({
                color: 'rgba(0, 0, 255, 1)', // Blue stroke with 100% opacity
                width: 2,
                }),
            });

            // Apply the style to each feature
            features.forEach(feature => {
                feature.setStyle(style);
            });


            const geometry = features[0].getGeometry();
            if (geometry instanceof Polygon) {
                const nestedCoords = geometry.getCoordinates();
                useMapStore().polyCoords = nestedCoords;
                //console.log('useMapStore().polyCoords:',useMapStore().polyCoords);
            } else {
                console.error('The geometry type Polygon is only type supported. got geometry:',geometry);
            }        
        }
    } else {
        console.error('Map is not defined.');
    }
    return null;
}

// Helper function to interpolate between two colors
function interpolateColor(color1: number[], color2: number[], factor: number = 0.5, alpha: number = 255): number[] {
    factor = Math.max(0, Math.min(1, factor)); // Clamp factor between 0 and 1
  
    const result = color1.slice();
    for (let i = 0; i < 3; i++) {
      result[i] = Math.round(result[i] + factor * (color2[i] - color1[i]));
    }
    result[3] = alpha; 
    return result;
  };
  
// Function to get color for elevation
function getColorForElevation(elevation:number, minElevation:number, maxElevation:number) {
    const purple = [100, 0, 100]; // RGB for purple
    const yellow = [255, 255, 0]; // RGB for yellow
    const factor = (elevation - minElevation) / (maxElevation - minElevation);
    return interpolateColor(purple, yellow, factor);
}


function formatObject(obj: { [key: string]: any }): string {
    return Object.entries(obj)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }
interface TooltipParams {
    x: number;
    y: number;
    tooltip: string;
}

// Utility functions to show and hide tooltip
function showTooltip({ x, y, tooltip }: TooltipParams): void {
    const tooltipEl = document.getElementById('tooltip');
    if (tooltipEl) {
        tooltipEl.innerHTML = tooltip;
        tooltipEl.style.display = 'block';

        // Calculate the percentage positions
        const xPercent = (x / window.innerWidth) * 100;
        const yPercent = (y / window.innerHeight) * 100;
        const offset = 33; // Offset in percentage to position the tooltip below the pointer

        // Set the tooltip position using percentage
        tooltipEl.style.left = `${xPercent}%`;
        tooltipEl.style.top = `${yPercent + offset}%`;
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

async function clicked(d:ElevationDataItem): Promise<void> {
    //console.log('Clicked:',d);
    useAtlChartFilterStore().setClearPlot();
    //useAtlChartFilterStore().setIsLoading();
    //console.log('d:',d,'d.spot',d.spot,'d.gt',d.gt,'d.rgt',d.rgt,'d.cycle',d.cycle,'d.track:',d.track,'d.gt:',d.gt,'d.sc_orient:',d.sc_orient,'d.pair:',d.pair)
    if(d.track !== undefined){ // for atl03
        useAtlChartFilterStore().setTrackWithNumber(d.track);
        useAtlChartFilterStore().setBeamsForTracks(useAtlChartFilterStore().getTracks());
    }
    if(d.gt !== undefined){ // for atl06
        useAtlChartFilterStore().setBeamsAndTracksWithGts([{label:d.gt.toString(), value:d.gt}]);
    }
    if(d.sc_orient !== undefined){
        useAtlChartFilterStore().setScOrientWithNumber(d.sc_orient);
    }
    if(d.pair !== undefined){
        useAtlChartFilterStore().setPairWithNumber(d.pair);
    }
    if(d.spot !== undefined){
        useAtlChartFilterStore().setSpotWithNumber(d.spot);
    }
    if((d.gt !== undefined) && (d.spot !== undefined)){
        useAtlChartFilterStore().setScOrientWithNumber(getScOrientFromSpotGt(d.spot,d.gt));
    }
    if(d.rgt !== undefined){
        useAtlChartFilterStore().setRgtWithNumber(d.rgt);
    } else {
        console.error('d.rgt is undefined'); // should always be defined
    }
    if(d.cycle !== undefined){
        useAtlChartFilterStore().setCycleWithNumber(d.cycle);
    } else {
        console.error('d.cycle is undefined'); // should always be defined
    }
    // for atl03
    console.log('Clicked: rgts',useAtlChartFilterStore().getRgtValues())
    console.log('Clicked: cycles',useAtlChartFilterStore().getCycleValues())
    console.log('Clicked: tracks',useAtlChartFilterStore().getTrackValues())
    console.log('Clicked: sc_orient',useAtlChartFilterStore().getScOrientValues())
    console.log('Clicked: pair',useAtlChartFilterStore().getPairValues());
    if((d.sc_orient !== undefined) && (d.track !== undefined) && (d.pair !== undefined)){ //atl03
        useAtlChartFilterStore().setSpotWithNumber(getSpotNumber(d.sc_orient,d.track,d.pair));
        useAtlChartFilterStore().setBeamWithNumber(getGroundTrack(d.sc_orient,d.track,d.pair));

        let atl03WhereClause = `
                WHERE rgt IN (${useAtlChartFilterStore().getRgtValues().join(', ')}) 
                AND cycle IN (${useAtlChartFilterStore().getCycleValues().join(', ')})
                AND track IN (${useAtlChartFilterStore().getTrackValues().join(", ")}) 
            `;
            if (useAtlChartFilterStore().getPairValues() !== undefined) {
                atl03WhereClause += ` AND pair IN (${useAtlChartFilterStore().getPairValues().join(", ")})`;
            }
            if (useAtlChartFilterStore().getScOrientValues() !== undefined) {
                atl03WhereClause += ` AND sc_orient IN (${useAtlChartFilterStore().getScOrientValues().join(", ")})`;
            }
        useAtlChartFilterStore().setAtl03WhereClause(atl03WhereClause);
    }
    console.log('Clicked: spot',useAtlChartFilterStore().getSpotValues())
    console.log('Clicked: beam',useAtlChartFilterStore().getBeamValues())
    console.log('Clicked: atl03WhereClause',useAtlChartFilterStore().getAtl03WhereClause())
    // await addHighlightLayerForReq(useCurReqSumStore().getReqId());
    // useAtlChartFilterStore().updateScatterPlot();
}

function checkFilter(d:ElevationDataItem): boolean {
    let matched = false;
    if(d.gt){ // atl06
        matched = ( (useAtlChartFilterStore().getRgtValues()[0] == d.rgt) && 
                    (useAtlChartFilterStore().getCycleValues()[0] == d.cycle) && 
                    (useAtlChartFilterStore().getBeamValues()[0]== d.gt));
    } else {
        matched = ( (useAtlChartFilterStore().getRgtValues()[0] == d.rgt) && 
                    (useAtlChartFilterStore().getCycleValues()[0] == d.cycle) && 
                    (useAtlChartFilterStore().getTrackValues()[0] == d.track) && 
                    (useAtlChartFilterStore().getScOrientValues()[0] == d.sc_orient) && 
                    (useAtlChartFilterStore().getPairValues()[0] == d.pair));
    }
    return matched;
}
// [255, 0, 0, 255]; // red

function createHighlightLayer(name:string,elevationData:ElevationDataItem[], color:[number,number,number,number]): PointCloudLayer {
    return new PointCloudLayer({
        id: name,
        data: elevationData,
        getPosition: (d) => {
            return [d['longitude'], d['latitude'], 0];
        },
        getNormal: [0, 0, 1],
        getColor: () => {
             return color;
        },
        pointSize: useDeckStore().getPointSize(),
    });
}

export function updateSelectedLayerWithObject(elevationData:ElevationDataItem[]): void{
    const startTime = performance.now(); // Start time
    //console.log('updateSelectedLayerWithObject startTime:',startTime);
    try{
        const deck = useDeckStore().getDeckInstance()
        if(deck){
            if(!getDeckLayerByName(SELECTED_LAYER_NAME)){
                //console.log('updateSelectedLayerWithObject getDeckLayerByName:',getDeckLayerByName(SELECTED_LAYER_NAME));
                const map = useMapStore().getMap() as OLMap;
                if(map){
                    addDeckLayerToMap(map,deck,SELECTED_LAYER_NAME);
                }
            }        
            const layer = createHighlightLayer(SELECTED_LAYER_NAME,elevationData,[255, 0, 0, 255]);
            useDeckStore().replaceOrAddHighlightLayer(layer);
            useDeckStore().getDeckInstance().setProps({layers:useDeckStore().getLayers()});
        } else {
            console.error('createHighlightLayer Error updating elevation useMapStore().deckInstance:',useDeckStore().getDeckInstance());
        }
    } catch (error) {
        console.error('createHighlightLayer Error updating elevation layer:',error);
    } finally {
        const endTime = performance.now(); // End time
        console.log(`updateSelectedLayerWithObject took ${endTime - startTime} milliseconds. endTime:`,endTime);  
    }

}

function createElLayer(elevationData:ElevationDataItem[], extHMean: ExtHMean, heightFieldName:string): PointCloudLayer {
    return new PointCloudLayer({
        id: EL_LAYER_NAME,
        data: elevationData,
        getPosition: (d) => {
            return [d['longitude'], d['latitude'], 0];
        },
        getNormal: [0, 0, 1],
        getColor: (d) => {
            return getColorForElevation(d[heightFieldName], extHMean.lowHMean , extHMean.highHMean) as [number, number, number, number];
        },
        pointSize: 3,
        pickable: true, // Enable picking
        onHover: ({ object, x, y }) => {
            if (object) {
                const tooltip = formatObject(object);
                showTooltip({ x, y, tooltip });
            } else {
                hideTooltip();
            }
        },
        onClick: ({ object, x, y }) => {
            if (object) {
                clicked(object);
            }
        }
    });
}

export function updateElLayerWithObject(elevationData:ElevationDataItem[], extHMean: ExtHMean, heightFieldName:string): void{
    const startTime = performance.now(); // Start time
    //console.log('updateElLayerWithObject startTime:',startTime);
    try{
        if(useDeckStore().getDeckInstance()){
            const layer = createElLayer(elevationData,extHMean,heightFieldName);
            useDeckStore().replaceOrAddElLayer(layer);
            //console.log('updateElLayerWithObject layer:',layer);
            useDeckStore().getDeckInstance().setProps({layers:useDeckStore().getLayers()});
            //console.log('updateElLayerWithObject useDeckStore().getDeckInstance():',useDeckStore().getDeckInstance());
        } else {
            console.error('Error updating elevation useDeckStore().deckInstance:',useDeckStore().getDeckInstance());
        }
    } catch (error) {
        console.error('Error updating elevation layer:',error);
    } finally {
        const endTime = performance.now(); // End time
        console.log(`updateElLayerWithObject took ${endTime - startTime} milliseconds. endTime:`,endTime);  
    }

}

export function createNewDeckLayer(deck:Deck,name:String): OL_Layer{
    console.log('createNewDeckLayer:',name);
    const layerOptions = {
        title: name,
    }
    const new_layer = new OL_Layer({
        render: ({size, viewState}: {size: number[], viewState: {center: number[], zoom: number, rotation: number}})=>{
            const [width, height] = size;
            const [longitude, latitude] = toLonLat(viewState.center);
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

export function resetDeckGLInstance(tgt:HTMLDivElement): Deck | null{
    //console.log('resetDeckGLInstance tgt:',tgt);
    try{
        useDeckStore().clearDeckInstance(); // Clear any existing instance first
        const deck = new Deck({
            initialViewState: {longitude: 0, latitude: 0, zoom: 1},
            controller: false,
            parent: tgt,
            style: {pointerEvents: 'none', zIndex: '1'},
            layers: []
        });
        useDeckStore().setDeckInstance(deck);
        return deck // we just need a 'fake' Layer object with render function and title to marry to Open Layers
    } catch (error) {
        console.error('Error creating DeckGL instance:',error);
        return null;
    }
}

export function removeDeckLayersFromMap(map: OLMap){
    const current_layers = useMapStore().getDeckLayers();
    if(current_layers.length > 0){
        current_layers.forEach(layer => {
            map.removeLayer(layer);
        });
    } else {
        console.warn('removeDeckLayersFromMap: No current_layers to remove.');
    }
}

export function addDeckLayerToMap(map: OLMap, deck:Deck, name:string){
    console.log('addDeckLayerToMap:',name);
    const deckLayer = createNewDeckLayer(deck,name);
    if(deckLayer){
        const selectedLayer = map.getLayers().getArray().find(layer => layer.get('title') === SELECTED_LAYER_NAME) as VectorLayer<Feature<Geometry>>;
        if (selectedLayer) {
            //console.log('addDeckLayerToMap: removeLayer:',selectedLayer);
            map.removeLayer(selectedLayer);
        }
        map.addLayer(deckLayer);
        //console.log('addDeckLayerToMap: deckLayer:',deckLayer,' deckLayer.get(\'title\'):',deckLayer.get('title'));
    } else {
        console.error('No current_layer to add.');
    }
}

export function getDeckLayerByName(name:string): OL_Layer | undefined {
    const deckLayers = useMapStore().getDeckLayers();
    return deckLayers.find(layer => layer.get('name') === name);
}

export function addExistingDeckLayersToMap(map: OLMap, deck:Deck){
    const deckLayers = useMapStore().getDeckLayers() as OL_Layer[];
    if (deckLayers.length > 0){
        deckLayers.forEach(layer => {
            addDeckLayerToMap(map,deck,layer.get('name'));
        });
    } else {
        console.warn('No current_layers to add.');
    }
}

export function resetDeck(map: OLMap){
    console.log('resetDeck')
    const tgt = map.getViewport() as HTMLDivElement;
    const deck = resetDeckGLInstance(tgt); 
    if(deck){
        removeDeckLayersFromMap(map);
        addExistingDeckLayersToMap(map,deck);        
    } else {
      console.error('resetDeck(): deck Instance is null');
    }
}

export function initDeck(map: OLMap){
    console.log('initDeck')
    const tgt = map.getViewport() as HTMLDivElement;
    const deck = resetDeckGLInstance(tgt); 
    if(deck){
        addDeckLayerToMap(map,deck,EL_LAYER_NAME);        
        //addDeckLayerToMap(map,deck,SELECTED_LAYER_NAME);        
    } else {
      console.error('initDeck(): deck Instance is null');
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