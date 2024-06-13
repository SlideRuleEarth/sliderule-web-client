import { useMapStore } from '@/stores/mapStore';
import { computed, h } from 'vue';
import { useGeoJsonStore } from '@/stores/geoJsonStore';
import { PointCloudLayer } from '@deck.gl/layers/typed';
import { GeoJSON} from 'ol/format';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { Geometry } from 'ol/geom';
import { Polygon } from 'ol/geom';
import { Deck } from '@deck.gl/core/typed';
import { toLonLat} from 'ol/proj';
import { Layer as OL_Layer} from 'ol/layer';
import type OLMap from "ol/Map.js";
import { useMapParamsStore } from '@/stores/mapParamsStore';
import type { ExtHMean } from '@/workers/workerUtils';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { Style, Fill, Stroke } from 'ol/style';

const reqParams = useReqParamsStore();

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
        const vectorLayer = map.getLayers().getArray().find(layer => layer.get('name') === 'Drawing Layer') as VectorLayer<VectorSource<Feature<Geometry>>>;
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
    const purple = [128, 0, 128]; // RGB for purple
    const yellow = [255, 255, 0]; // RGB for yellow
    const factor = (elevation - minElevation) / (maxElevation - minElevation);
    return interpolateColor(purple, yellow, factor);
}


function replaceKeysWithLabels(
        originalObject: { [key: string]: any },
        fieldNames: string[]
    ): { [key: string]: any } {
    const newObject: { [key: string]: any } = {};

    Object.keys(originalObject).forEach((key) => {
        const newKey = fieldNames[parseInt(key, 10)];
        if (newKey !== undefined) {
            newObject[newKey] = originalObject[key];
        }
    });
    
    return newObject;
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
function showTooltip({ x, y, tooltip }: TooltipParams):void {
    const tooltipEl = document.getElementById('tooltip');
    if (tooltipEl) {
        tooltipEl.innerHTML = tooltip;
        tooltipEl.style.display = 'block';
        tooltipEl.style.left = `${x}px`;
        tooltipEl.style.top = `${y}px`;
    }
}

function hideTooltip():void {
    const tooltipEl = document.getElementById('tooltip');
    if (tooltipEl) {
        tooltipEl.style.display = 'none';
    }
}

// tooltip element 
const tooltipStyle = `
    #tooltip {
        position: absolute;
        z-index: 10;
        background: rgba(0, 0, 0, 0.8);
        color: #fff;
        padding: 5px;
        border-radius: 3px;
        pointer-events: none;
        font-size: 12px;
    }
`;
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = tooltipStyle;
document.head.appendChild(styleSheet);

const tooltipDiv = document.createElement('div');
tooltipDiv.id = 'tooltip';
document.body.appendChild(tooltipDiv);


export function updateElLayerWithArray(elevationData:any[][],hMeanNdx:number,lonNdx:number,latNdx:number, extHMean: ExtHMean, fieldNames:string[], use_white:boolean = false): void{
    try{
        console.log('updateElLayerWithArray elevationData.length:',elevationData.length,'elevationData:',elevationData,'hMeanNdx:',hMeanNdx,'lonNdx:',lonNdx,'latNdx:',latNdx, 'use_white:',use_white);
        const layer =     
            new PointCloudLayer({
                id: 'point-cloud-layer', // keep this constant so deck does the right thing and updates the layer
                data: elevationData,
                getPosition: (d:number[]) => {
                    //console.log('lon: d[',lonNdx,']:',d[lonNdx],' lat: d[',latNdx,']:',d[latNdx],' hMean: d[',hMeanNdx,']:',d[hMeanNdx]);
                    return [d[lonNdx], d[latNdx], 0]// d[hMeanNdx]]
                },
                getNormal: [0, 0, 1],
                getColor: (d:number[]) => {
                    if (use_white) return [255, 255, 255, 127];
                    return getColorForElevation(d[hMeanNdx], extHMean.lowHMean , extHMean.highHMean) as [number, number, number, number];
                },
                pointSize: 3,
                pickable: true, // Enable picking
                onHover: ({ object, x, y }) => {
                    //console.log('onHover object:',object,' x:',x,' y:',y);
                    if (object) {
                        const newObject = replaceKeysWithLabels(object, fieldNames);
                        //console.log('object',object,'newObject:',newObject);
                        const tooltip = formatObject(newObject);
                        showTooltip({ x, y, tooltip });
                    } else {
                        hideTooltip();
                    }
                },
                onClick: ({ object, x, y }) => {
                    //console.log('onclick object:',object,' x:',x,' y:',y);
                    if (object) {
                        const newObject = replaceKeysWithLabels(object, fieldNames);
                        console.log('Clicked:',newObject);
                        reqParams.setReqion(newObject.region);
                        useReqParamsStore().setRgt(newObject.rgt);
                        useReqParamsStore().setCycle(newObject.cycle);
                        useReqParamsStore().setTracks(newObject.track);
                        useReqParamsStore().setBeams(newObject.beams);
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
    }
}

export interface ElevationDataItem {
    [key: string]: any; // This allows indexing by any string key
}
export function updateElLayerWithObject(elevationData:ElevationDataItem[], extHMean: ExtHMean, heightFieldName:string, use_white:boolean = false): void{
    try{
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
                    if (use_white) return [255, 255, 255, 127];
                    return getColorForElevation(d[heightFieldName], extHMean.lowHMean , extHMean.highHMean) as [number, number, number, number];
                },
                pointSize: 3,
                pickable: true, // Enable picking
                onHover: ({ object, x, y }) => {
                    //console.log('onHover object:',object,' x:',x,' y:',y);
                    if (object) {
                        //console.log('object',object,'newObject:',newObject);
                        const tooltip = formatObject(object);
                        showTooltip({ x, y, tooltip });
                    } else {
                        hideTooltip();
                    }
                },
                onClick: ({ object, x, y }) => {
                    //console.log('onclick object:',object,' x:',x,' y:',y);
                    if (object) {
                        console.log('Clicked:',object);
                        reqParams.setReqion(object.region);
                        useReqParamsStore().setRgt(object.rgt);
                        useReqParamsStore().setCycle(object.cycle);
                        useReqParamsStore().setTracks(object.track);
                        useReqParamsStore().setBeams(object.beams);
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

export function updateDeck(map: OLMap){
    const tgt = map.getViewport() as HTMLDivElement;
    const deck = createDeckGLInstance(tgt);
   
    if(deck){
      const current_layer = useMapStore().getDeckLayer();
      if(current_layer){
        //console.log('Removing current_layer:',current_layer);
        map.removeLayer(current_layer);
      }else{
        //console.log('No current_layer to remove.');
      }
      const deckLayer = createNewDeckLayer(deck);
      if(deckLayer){
          map.addLayer(deckLayer);
          //console.log('deckLayer added:',deckLayer);
      } else {
          console.error('createDeckGLInstance returned null');
      }
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