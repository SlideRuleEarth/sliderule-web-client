import { useMapStore } from '@/stores/mapStore';
import { Deck } from '@deck.gl/core/typed';
import { computed } from 'vue';
import {Layer} from 'ol/layer';
import { useGeoJsonStore } from '@/stores/geoJsonStore';
import { PointCloudLayer } from '@deck.gl/layers/typed';
import { toLonLat} from 'ol/proj';
import { GeoJSON} from 'ol/format';
import { useMapParamsStore } from '@/stores/mapParamsStore';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { Geometry } from 'ol/geom';
import { Polygon } from 'ol/geom';
import { useDeckStore } from '@/stores/deckStore';
import { type Elevation } from '@/composables/db';

const mapParamsStore = useMapParamsStore();
const mapStore = useMapStore();
const geoJsonStore = useGeoJsonStore();
const deckStore = useDeckStore();

export const polyCoordsExist = computed(() => {
    let exist = false;
    if(geoJsonStore.geoJsonData){
        console.log('geoJsonStore.geoJsonData:',geoJsonStore.geoJsonData);
        exist = true;
    } else if (mapStore.polyCoords.length > 0) {
        console.log('mapStore.polyCoords:',mapStore.polyCoords);
        exist = true;
    } else {
        console.log(`mapStore.polyCoords: ${mapStore.polyCoords} and geoJsonStore.geoJsonData: ${geoJsonStore.geoJsonData} do not exist.`);
        exist = false;
    }
    return exist
});
export const clearPolyCoords = () => {
    mapStore.polyCoords = [];
    if(geoJsonStore.geoJsonData){
        geoJsonStore.geoJsonData = null;
    }
}

export function drawGeoJson(geoJsonData:string) {
    if(mapStore.map){
        const vectorLayer = mapStore.map.getLayers().getArray().find(layer => layer.get('name') === 'Drawing Layer') as VectorLayer<VectorSource<Feature<Geometry>>>;
        if (!vectorLayer) {
            console.error('Vector layer is not defined.');
            return;
        }
        const geoJSON = new GeoJSON(); // Assuming 'ol' is the OpenLayers object
        const features = geoJSON.readFeatures(geoJsonData, {
            featureProjection: mapParamsStore.projection, //'EPSG:3857' // Assuming the map projection is Web Mercator
        }) as Feature<Geometry>[];
        const src = vectorLayer.getSource();
        if(src){
            // Add the features to the vector layer source
            src.clear(); // Optional: Remove existing features
            src.addFeatures(features);
            const geometry = features[0].getGeometry();
            if (geometry instanceof Polygon) {
                const nestedCoords = geometry.getCoordinates();
                mapStore.polyCoords = nestedCoords;
                console.log('mapStore.polyCoords:',mapStore.polyCoords);
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
function interpolateColor(color1: number[], color2:number[], factor:number): number[] {
    if (arguments.length < 3) { 
      factor = 0.5; 
    }
    const result = color1.slice();
    for (let i = 0; i < 3; i++) {
      result[i] = Math.round(result[i] + factor * (color2[i] - color1[i]));
    }
    result[3] = 255; // Alpha
    return result;
};

  
// Function to get color for elevation
function getColorForElevation(elevation:number, minElevation:number, maxElevation:number) {
    const purple = [128, 0, 128]; // RGB for purple
    const yellow = [255, 255, 0]; // RGB for yellow
    const factor = (elevation - minElevation) / (maxElevation - minElevation);
    return interpolateColor(purple, yellow, factor);
}

// // Function to get hex formatted color for elevation
// function getHexColorForElevation(elevation:number, minElevation:number, maxElevation:number) {
//     const purple = [128, 0, 128]; // RGB for purple
//     const yellow = [255, 255, 0]; // RGB for yellow
//     const factor = (elevation - minElevation) / (maxElevation - minElevation);
//     return rgbToHex(interpolateColor(purple, yellow, factor));
// }
  

// Custom Render Logic: The render option is a function that takes an object containing size and viewState. This function is where you align the DeckGL layer's view with the OpenLayers map's current view state.
// size is an array [width, height] indicating the dimensions of the map's viewport.
// viewState contains the current state of the map's view, including center coordinates, zoom level, and rotation. This information is converted and passed to DeckGL to ensure both visualizations are synchronized.
// Setting DeckGL Properties: Inside the render function, properties of the DeckGL instance (deck) are updated to match the current size and view state of the OpenLayers map. This ensures that the DeckGL visualization aligns correctly with the map's viewport, zoom level, and rotation.
// Redrawing DeckGL: After updating the properties, deck.redraw() is called to render the DeckGL layer with the new settings.
// Sync deck view with OL view
function renderDeck({size, viewState}: {size: number[], viewState: {center: number[], zoom: number, rotation: number}}){
    const [width, height] = size;
    const [longitude, latitude] = toLonLat(viewState.center);
    const zoom = viewState.zoom - 1;
    const bearing = (-viewState.rotation * 180) / Math.PI;
    const deckViewState = {bearing, longitude, latitude, zoom};
    deckStore.deckInstance.setProps({width, height, viewState: deckViewState});
    deckStore.deckInstance.redraw();
}

export function createDeckGLInstance(tgt:HTMLDivElement): Layer{
    const deck = new Deck({
        initialViewState: {longitude: 0, latitude: 0, zoom: 1},
        controller: false,
        parent: tgt,
        style: {pointerEvents: 'none', zIndex: '1'},
        layers: []
    });
    deckStore.setDeckInstance(deck);
    const layerOptions = {
        render: renderDeck as any,
        title: 'DeckGL Layer',
    }
    const deckLayer = new Layer({
        ...layerOptions
    });
    return deckLayer // we just need a 'fake' Layer object with render function and title to marry to Open Layers
}

export function updateElevationLayer(elevationData:Elevation[]): void{
    const layer =     
        new PointCloudLayer({
            id: 'point-cloud-layer', // keep this constant so deck does the right thing and updates the layer
            data: elevationData,
            getPosition: (d:Elevation) => {
                return [d.longitude, d.latitude, d.h_mean]
            },
            getNormal: [0, 0, 1],
            getColor: (d:Elevation) => {
                const color = getColorForElevation(d.h_mean, 0.0, 300.0) as [number, number, number, number];
                return color;
            },
            pointSize: 3,
        })

    deckStore.deckInstance.setProps({layers:[layer]});

}

// export function createLegend() {
//     const legend = document.createElement('div');
//     legend.innerHTML = '<strong>Elevation Legend</strong><br>';
//     legend.style.color = 'var(--primary-color)';
//     legend.style.position = 'absolute';
//     legend.style.bottom = '1.25rem'; // 20px / 16px = 1.25rem
//     legend.style.right = '1.25rem'; // 20px / 16px = 1.25rem
//     legend.style.padding = '0.625rem'; // 10px / 16px = 0.625rem
//     legend.style.background = 'rgba(255, 255, 255, 0.8)';
//     legend.style.borderRadius = '0.3125rem'; // 5px / 16px = 0.3125rem

//     const gradientDiv = document.createElement('div');
//     gradientDiv.style.height = '1.25rem'; // 20px / 16px = 1.25rem
//     gradientDiv.style.width = '12.5rem'; // 200px / 16px = 12.5rem
//     gradientDiv.style.background = 'linear-gradient(to right, purple, yellow)';
//     legend.appendChild(gradientDiv);

//     const minLabel = document.createElement('span');
//     minLabel.innerHTML = `${elevationStore.getMin().toFixed(1)}m`; // Rounded to 1 decimal place
//     minLabel.style.float = 'left';

//     const maxLabel = document.createElement('span');
//     maxLabel.innerHTML = `${elevationStore.getMax().toFixed(1)}m`; // Rounded to 1 decimal place
//     maxLabel.style.float = 'right';

//     legend.appendChild(minLabel);
//     legend.appendChild(maxLabel);

//     document.body.appendChild(legend);
// }
