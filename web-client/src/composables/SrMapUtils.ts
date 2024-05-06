import { useMapStore } from '@/stores/mapStore';
import { computed } from 'vue';
import { useGeoJsonStore } from '@/stores/geoJsonStore';
import { PointCloudLayer } from '@deck.gl/layers/typed';
import { GeoJSON} from 'ol/format';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { Geometry } from 'ol/geom';
import { Polygon } from 'ol/geom';
import { type Elevation } from '@/db/SlideRuleDb';
import { useCurAtl06ReqSumStore } from '@/stores/curAtl06ReqSumStore';
import { db } from "@/db/SlideRuleDb";
import { Deck } from '@deck.gl/core/typed';
import { toLonLat} from 'ol/proj';
import { Layer as OL_Layer} from 'ol/layer';
import type OLMap from "ol/Map.js";
import { useMapParamsStore } from '@/stores/mapParamsStore';


export const polyCoordsExist = computed(() => {
    let exist = false;
    if(useGeoJsonStore().geoJsonData){
        console.log('useGeoJsonStore().geoJsonData:',useGeoJsonStore().geoJsonData);
        exist = true;
    } else if (useMapStore().polyCoords.length > 0) {
        console.log('useMapStore().polyCoords:',useMapStore().polyCoords);
        exist = true;
    } else {
        console.log(`useMapStore().polyCoords: ${useMapStore().polyCoords} and useGeoJsonStore().geoJsonData: ${useGeoJsonStore().geoJsonData} do not exist.`);
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
    const map = useMapStore().map
    if(map){
        const vectorLayer = map.getLayers().getArray().find(layer => layer.get('name') === 'Drawing Layer') as VectorLayer<VectorSource<Feature<Geometry>>>;
        if (!vectorLayer) {
            console.error('Vector layer is not defined.');
            return;
        }
        const geoJSON = new GeoJSON(); // Assuming 'ol' is the OpenLayers object
        const features = geoJSON.readFeatures(geoJsonData, {
            featureProjection: useMapParamsStore().projection, //'EPSG:3857' // Assuming the map projection is Web Mercator
        }) as Feature<Geometry>[];
        const src = vectorLayer.getSource();
        if(src){
            // Add the features to the vector layer source
            src.clear(); // Optional: Remove existing features
            src.addFeatures(features);
            const geometry = features[0].getGeometry();
            if (geometry instanceof Polygon) {
                const nestedCoords = geometry.getCoordinates();
                useMapStore().polyCoords = nestedCoords;
                console.log('useMapStore().polyCoords:',useMapStore().polyCoords);
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

export function updateElevationLayer(elevationData:Elevation[],use_white:boolean = false): void{
    try{
        //console.log('updateElevationLayer:',elevationData);

        const layer =     
            new PointCloudLayer({
                id: 'point-cloud-layer', // keep this constant so deck does the right thing and updates the layer
                data: elevationData,
                getPosition: (d:Elevation) => {
                    return [d.longitude, d.latitude, d.h_mean]
                },
                getNormal: [0, 0, 1],
                getColor: (d:Elevation) => {
                    if (use_white) return [255, 255, 255, 127];
                    return getColorForElevation(d.h_mean, useCurAtl06ReqSumStore().get_h_mean_Low() , useCurAtl06ReqSumStore().get_h_mean_High()) as [number, number, number, number];
                },
                pointSize: 3,
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
        console.log('Removing current_layer:',current_layer);
        map.removeLayer(current_layer);
      }else{
        console.log('No current_layer to remove.');
      }
      const deckLayer = createNewDeckLayer(deck);
      if(deckLayer){
          map.addLayer(deckLayer);
          console.log('deckLayer added:',deckLayer);
      } else {
          console.error('createDeckGLInstance returned null');
      }
    } else {
      console.error('deck Instance is null');
    }

}

export async function fetchAndUpdateElevationData(reqId: number, maxPoints?: number) {
    try {
        const chunkSize = 100000; // the size of each chunk
        let offset = 0;
        let hasMore = true;
        let elevationData: Elevation[] = [];
        let maxPointsToUse = chunkSize;
        // If maxPoints is not provided, fetch it from the database
        if (maxPoints) {
            maxPointsToUse = maxPoints;
            console.log('Using provided maxPoints:', maxPoints);
        } else {
            const dbNumPoints = await db.getNumberOfElevationPoints(reqId);
            if (dbNumPoints !== null) {
                maxPointsToUse = dbNumPoints;
                console.log('Fetched maxPoints from DB:', maxPointsToUse);
            } else {
                console.error('Failed to fetch maxPoints from DB using default value of:', chunkSize);
                maxPointsToUse = chunkSize;
            }
        }

        console.log('Fetching and updating elevation data for request:', reqId, 'maxPointsToUse:', maxPointsToUse);

        // Loop until we reach the specified number of points or exceed it
        while (offset < maxPointsToUse && hasMore && !useMapStore().isAborting && !useMapStore().isLoading ){
            const elevationDataChunk = await db.getElevationsChunk(reqId, offset, chunkSize);
            elevationData = elevationData.concat(elevationDataChunk);
            updateElevationLayer(elevationData);     // Update the layer with each chunk
            console.log('maxPointsToUse:',maxPointsToUse,'elevationDataChunk.length:', elevationDataChunk.length);
            offset += elevationDataChunk.length;
            hasMore = elevationDataChunk.length === chunkSize;

            // allow the UI thread to update
            await new Promise(resolve => setTimeout(resolve, 0)); // Small delay to allow UI updates
            console.log(`Fetched ${offset} elevation data points hasMore:${hasMore}`);
        }
        console.log('Elevation data fetched and updated:', elevationData.length);
    } catch (error) {
        console.error('Failed to fetch and update elevation data:', error);
    }
    useMapStore().scheduleDrawElevations();
}
