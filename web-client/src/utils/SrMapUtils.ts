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
import { useMapParamsStore } from '@/stores/mapParamsStore';
import type { ExtHMean } from '@/workers/workerUtils';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { Style, Fill, Stroke } from 'ol/style';
import { useCurReqSumStore } from '@/stores/curReqSumStore';
import { processFileForReq } from '@/utils/SrParquetUtils';
import { getScOrientFromSpotGt } from '@/utils/parmUtils';

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
    useAtlChartFilterStore().setIsLoading();
    useMapStore().setIsLoading();
    console.log('d:',d,'d.spot',d.spot,'d.gt',d.gt,'d.rgt',d.rgt,'d.cycle',d.cycle,'d.track:',d.track,'d.gt:',d.gt,'d.sc_orient:',d.sc_orient,'d.pair:',d.pair)
    if(d.track !== undefined){ // for atl03
        useAtlChartFilterStore().setTrackWithNumber(d.track);
        useAtlChartFilterStore().setBeamsForTracks(useAtlChartFilterStore().getTracks());
    }
    if(d.gt !== undefined){ // for atl06
        useAtlChartFilterStore().setBeamsAndTracksWithGt(d.gt);
    }
    if(d.sc_orient !== undefined){
        useAtlChartFilterStore().setScOrient(d.sc_orient);
    }
    if(d.pair !== undefined){
        useAtlChartFilterStore().setPair(d.pair);
    }
    if(d.spot !== undefined){
        useAtlChartFilterStore().setSpotWithNumber(d.spot);
    }
    if((d.gt !== undefined) && (d.spot !== undefined)){
        useAtlChartFilterStore().setScOrient(getScOrientFromSpotGt(d.spot,d.gt));
    }
    if(d.rgt !== undefined){
        useReqParamsStore().setRgt(d.rgt);
        useAtlChartFilterStore().setRgtWithNumber(d.rgt);
    } else {
        console.error('d.rgt is undefined'); // should always be defined
    }
    if(d.cycle !== undefined){
        useReqParamsStore().setCycle(d.cycle);
        useAtlChartFilterStore().setCycleWithNumber(d.cycle);
    } else {
        console.error('d.cycle is undefined'); // should always be defined
    }
    await processFileForReq(useCurReqSumStore().getReqId());
    useMapStore().resetIsLoading();
    useAtlChartFilterStore().setUpdateScatterPlot();
}

function checkFilter(d:ElevationDataItem): boolean {
    let matched = false;
    if(d.gt){ // atl06
        matched = ( (useAtlChartFilterStore().getRgtValues()[0] == d.rgt) && 
                    (useAtlChartFilterStore().getCycleValues()[0] == d.cycle) && 
                    (useAtlChartFilterStore().getBeams().includes(d.gt)));
    } else {
        matched = ( (useAtlChartFilterStore().getRgtValues()[0] == d.rgt) && 
                    (useAtlChartFilterStore().getCycleValues()[0] == d.cycle) && 
                    (useAtlChartFilterStore().getTracks().includes(d.track)) && 
                    (useAtlChartFilterStore().getScOrient() == d.sc_orient) && 
                    (useAtlChartFilterStore().getPair() == d.pair));
    }
    return matched;
}

export function updateElLayerWithObject(elevationData:ElevationDataItem[], extHMean: ExtHMean, heightFieldName:string): void{
    const startTime = performance.now(); // Start time
    console.log('updateElLayerWithObject startTime:',startTime);
    try{
        //const canvas = document.querySelector('canvas');
        //console.log('updateElLayerWithObject elevationData.length:',elevationData.length,'elevationData:',elevationData,'heightFieldName:',heightFieldName, 'use_white:',use_white);
        const layer =     
            new PointCloudLayer({
                id: 'point-cloud-layer', // keep this constant so deck does the right thing and updates the layer
                data: elevationData,
                getPosition: (d) => {
                    return [d['longitude'], d['latitude'], 0];
                },
                getNormal: [0, 0, 1],
                getColor: (d) => {
                    if(checkFilter(d)==true){
                        return [255, 0, 0, 127];
                    } else {
                        return getColorForElevation(d[heightFieldName], extHMean.lowHMean , extHMean.highHMean) as [number, number, number, number];
                    }
                },
                pointSize: 3,
                pickable: true, // Enable picking
                onHover: ({ object, x, y }) => {
                    //console.log('onHover object:',object,' x:',x,' y:',y);
                    if (object) {
                        //console.log('object',object,'newObject:',newObject);
                        //canvas.style.cursor = 'pointer'; // Change cursor to pointer
                        const tooltip = formatObject(object);
                        showTooltip({ x, y, tooltip });
                    } else {
                        //canvas.style.cursor = 'grab';
                        hideTooltip();
                    }
                },
                onClick: ({ object, x, y }) => {
                    //console.log('onclick object:',object,' x:',x,' y:',y);
                    if (object) {
                        clicked(object);
                    }
                }
            });
        if(useMapStore().getDeckInstance()){
            useMapStore().getDeckInstance().setProps({layers:[layer]});
        } else {
            console.error('Error updating elevation useMapStore().deckInstance:',useMapStore().getDeckInstance());
        }
    } catch (error) {
        console.error('Error updating elevation layer:',error);
    } finally {
        const endTime = performance.now(); // End time
        console.log(`updateElLayerWithObject took ${endTime - startTime} milliseconds. endTime:`,endTime);  
    }

}

export function createNewDeckLayer(deck:Deck): OL_Layer{
    const layerOptions = {
        title: 'DeckGL Layer',
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
    useMapStore().setDeckLayer(new_layer); 
    return new_layer;  
}

// Custom Render Logic: The render option is a function that takes an object containing size and viewState. This function is where you align the DeckGL layer's view with the OpenLayers map's current view state.
// size is an array [width, height] indicating the dimensions of the map's viewport.
// viewState contains the current state of the map's view, including center coordinates, zoom level, and rotation. This information is converted and passed to DeckGL to ensure both visualizations are synchronized.
// Setting DeckGL Properties: Inside the render function, properties of the DeckGL instance (deck) are updated to match the current size and view state of the OpenLayers map. This ensures that the DeckGL visualization aligns correctly with the map's viewport, zoom level, and rotation.
// Redrawing DeckGL: After updating the properties, deck.redraw() is called to render the DeckGL layer with the new settings.
// Sync deck view with OL view

export function createDeckGLInstance(tgt:HTMLDivElement): Deck | null{
    try{
        useMapStore().clearDeckInstance(); // Clear any existing instance first
        const deck = new Deck({
            initialViewState: {longitude: 0, latitude: 0, zoom: 1},
            controller: false,
            parent: tgt,
            style: {pointerEvents: 'none', zIndex: '1'},
            layers: []
        });
        useMapStore().setDeckInstance(deck);
        return deck // we just need a 'fake' Layer object with render function and title to marry to Open Layers
    } catch (error) {
        console.error('Error creating DeckGL instance:',error);
        return null;
    }
}

export function removeDeckLayer(map: OLMap){
    const current_layer = useMapStore().getDeckLayer();
    if(current_layer){
        map.removeLayer(current_layer);
    } else {
        //console.error('No current_layer to remove.');
    }
}

export function removeCurrentDeckLayer(){
    const current_layer = useMapStore().getDeckLayer();
    if(current_layer){
        useMapStore().getMap()?.removeLayer(current_layer);
    } else {
        //console.error('No current_layer to remove.');
    }   
}
export function addDeckLayer(map: OLMap, deck:Deck){
    const deckLayer = createNewDeckLayer(deck);
    if(deckLayer){
        map.addLayer(deckLayer);
    } else {
        //console.error('No current_layer to add.');
    }
}

export function updateDeck(map: OLMap){
    const tgt = map.getViewport() as HTMLDivElement;
    const deck = createDeckGLInstance(tgt);
   
    if(deck){
        removeDeckLayer(map);
        addDeckLayer(map,deck);        
    } else {
      console.error('deck Instance is null');
    }

}

// function updateExtremeLatLon(elevationData:any[][],
//                                     hMeanNdx:number,
//                                     latNdx:number,
//                                     lonNdx:number,
//                                     localExtLatLon: ExtLatLon,
//                                     localExtHMean: ExtHMean): {extLatLon:ExtLatLon,extHMean:ExtHMean} {
//     elevationData.forEach(d => {
//         if (d[2] < localExtHMean.minHMean) {
//             localExtHMean.minHMean = d[hMeanNdx];
//         }
//         if (d[2] > localExtHMean.maxHMean) {
//             localExtHMean.maxHMean = d[hMeanNdx];
//         }
//         if (d[2] < localExtHMean.lowHMean) { // TBD fix this
//             localExtHMean.lowHMean = d[hMeanNdx];
//         }
//         if (d[2] > localExtHMean.highHMean) { // TBD fix this
//             localExtHMean.highHMean = d[hMeanNdx];
//         }
//         if (d[1] < localExtLatLon.minLat) {
//             localExtLatLon.minLat = d[latNdx];
//         }
//         if (d[1] > localExtLatLon.maxLat) {
//             localExtLatLon.maxLat = d[latNdx];
//         }
//         if (d[0] < localExtLatLon.minLon) {
//             localExtLatLon.minLon = d[lonNdx];
//         }
//         if (d[0] > localExtLatLon.maxLon) {
//             localExtLatLon.maxLon = d[lonNdx];
//         }
//     });
//     return {extLatLon:localExtLatLon,extHMean:localExtHMean};
// }

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