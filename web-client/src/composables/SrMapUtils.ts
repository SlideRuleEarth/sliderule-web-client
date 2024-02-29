import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { useMapStore } from '@/stores/mapStore';
import Point from 'ol/geom/Point';
import Feature from 'ol/Feature';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Circle from 'ol/style/Circle';
import { ref } from 'vue';
import {Layer, Tile as TileLayer} from 'ol/layer';
import { transform,  get as getProjection } from 'ol/proj.js';
import { useMapParamsStore } from "@/stores/mapParamsStore.js";
import { useElevationStore } from '@/stores/elevationStore';
import {fromLonLat, toLonLat} from 'ol/proj';
import {type FeatureCollection, type Feature as GeoFeature, type Geometry} from 'geojson';

import {Deck} from '@deck.gl/core/typed';
import {GeoJsonLayer, ArcLayer, PointCloudLayer} from '@deck.gl/layers/typed';

export const pnt_cnt = ref(0);
const mapParamsStore = useMapParamsStore();
const elevationStore = useElevationStore();


// Helper function to interpolate between two colors
function interpolateColor(color1: number[], color2:number[], factor:number): number[] {
    if (arguments.length < 3) { 
      factor = 0.5; 
    }
    const result = color1.slice();
    for (let i = 0; i < 3; i++) {
      result[i] = Math.round(result[i] + factor * (color2[i] - color1[i]));
    }
    return result;
};
  
// Convert RGB array to hex
function rgbToHex(rgb:number[]): string {
    return "#" + rgb.map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join('');
}
  
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
  

export type ElevationData = {
    cycle: number;
    dh_fit_dx: number;
    extent_id: bigint;
    gt: number;
    h_mean: number;
    h_sigma: number;
    latitude: number;
    longitude: number;
    n_fit_photons: number;
    pflags: number;
    region: number;
    rgt: number;
    rms_misfit: number;
    segment_id: number;
    spot: number;
    time: Date;
    w_surface_window_final: number;
    x_atc: number;
    y_atc: number;
};
 
export function useElevationData() : ElevationData{
    const elevationData: ElevationData = {
        cycle: 0,
        dh_fit_dx: 0,
        extent_id: BigInt(0), // Note: BigInt literals require 'n' at the end, but TypeScript uses BigInt function for type consistency
        gt: 0,
        h_mean: 0,
        h_sigma: 0,
        latitude: 0,
        longitude: 0,
        n_fit_photons: 0,
        pflags: 0,
        region: 0,
        rgt: 0,
        rms_misfit: 0,
        segment_id: 0,
        spot: 0,
        time: new Date(0), // Epoch time as default
        w_surface_window_final: 0,
        x_atc: 0,
        y_atc: 0,
    };
    return elevationData;
}

// function createElevationFeatures(flattenedData: ElevationData[]) {
//     // Move projection lookup outside the loop
//     const srProjection = mapParamsStore.getProjection();
//     console.log("createElevationFeatures -> data: ", flattenedData);
//     const projection = getProjection(srProjection);
//     if (!projection) {
//         console.error('Projection not found');
//         return []; // Or handle this case as needed
//     }

//     // Filter out items without valid projection and map over the rest
//     return flattenedData.filter(elevation => elevation).map(elevation => {
//         const long = elevation.longitude;
//         const lat = elevation.latitude;
//         const h_mean = elevation.h_mean;
//         if(pnt_cnt.value === 0){
//             console.log("createElevationFeatures -> elevation: ", elevation);
//         }

//         const feature = new Feature({
//             geometry: new Point(transform([long, lat], 'EPSG:4326', srProjection))
//         });

//         const color = getHexColorForElevation(h_mean, elevationStore.getMin(), elevationStore.getMax());
//         feature.setStyle(new Style({
//             image: new Circle({
//                 radius: 5,
//                 fill: new Fill({color: color})
//             })
//         }));
        
//         //console.log("pnt_cnt: ", pnt_cnt.value)
//         //console.log("feature: ", feature)
//         pnt_cnt.value++;
//         return feature;
//     });
// }

export function createElevationDeckGLLayer(elevationData:ElevationData[],tgt:HTMLDivElement): Layer{

    const deck = new Deck({
        initialViewState: {longitude: 0, latitude: 0, zoom: 1},
        controller: false,
        parent: tgt,
        style: {pointerEvents: 'none', zIndex: '1'},
        layers: [
            new PointCloudLayer({
                id: 'point-cloud-layer',
                data: elevationData,
                //coordinateOrigin: [0.0, 0.0],
                //coordinateSystem: 'COORDINATE_SYSTEM.LNGLAT',
                getPosition: (d:ElevationData) => {
                    pnt_cnt.value++;
                    console.log(`${pnt_cnt.value} d:${d.longitude} ${d.latitude} ${d.h_mean} ***!!%% `);
                    return [d.longitude, d.latitude, d.h_mean]
                },
                getNormal: [0, 0, 1],
                getColor: (d:ElevationData) => {
                    const color = getColorForElevation(d.h_mean, 0.0, 300.0);
                    return color;
                },
                pointSize: 3
            })
        ]
    });
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
        deck.setProps({width, height, viewState: deckViewState});
        deck.redraw();
    }
    const layerOptions = {
        render: renderDeck as any,
        title: 'DeckGL Layer',
    }
    const deckLayer = new Layer({
        ...layerOptions
    });
    return deckLayer
}

// export function getVectorLayer(elevationData:ElevationData[]){
//     console.log("getVectorLayer -> elevationData: ", elevationData);
//     const vectorSource = new VectorSource({
//         features: createElevationFeatures(elevationData),
//     });
//     console.log("getVectorLayer pnt_cnt: ", pnt_cnt.value)
//     const elOptions = {
//         name: 'Elevation Layer',
//         source: vectorSource,
//         zIndex: 999
//     };
//     const elevationLayer = new VectorLayer({
//         ...elOptions
//     });
//     return elevationLayer;
// }

export function getTestDeckGLLayer(elevationData:ElevationData[],tgt:HTMLDivElement) : Layer{
    console.log("getTestDeckGLLayer -> ElevationData: ", elevationData);
    console.log("getTestDeckGLLayer -> tgt: ", tgt);
    // Datasource: Natural Earth http://www.naturalearthdata.com/ via geojson.xyz
    const AIR_PORTS =
    'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_airports.geojson';

    const deck = new Deck({
        initialViewState: {longitude: 0, latitude: 0, zoom: 1},
        controller: false,
        parent: tgt,
        style: {pointerEvents: 'none', zIndex: '1'},
        layers: [
            new GeoJsonLayer({
                name: "Airports",
                id: 'airports',
                data: AIR_PORTS,
                // Styles
                filled: true,
                pointRadiusMinPixels: 2,
                pointRadiusScale: 2000,
                getPointRadius: f => 11 - f.properties!.scalerank,
                getFillColor: [200, 0, 80, 180],
                // Interactive props
                pickable: true,
                autoHighlight: true,
                onClick: info =>
                    // eslint-disable-next-line
                    info.object && alert(`${info.object.properties.name} (${info.object.properties.abbrev})`)
            }),
            new ArcLayer({
                id: 'arcs',
                name: "Arcs",
                data: AIR_PORTS,
                dataTransform: (d: FeatureCollection) => d.features.filter(f => f.properties.scalerank < 4),
                // Styles
                getSourcePosition: f => [-0.4531566, 51.4709959], // London
                getTargetPosition: f => f.geometry.coordinates,
                getSourceColor: [0, 128, 200],
                getTargetColor: [200, 0, 80],
                getWidth: 1
            })
        ]
    });
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
        deck.setProps({width, height, viewState: deckViewState});
        deck.redraw();
    }
    const layerOptions = {
        render: renderDeck as any,
        title: 'DeckGL Layer',
    }
    const deckLayer = new Layer({
        ...layerOptions
    });
    return deckLayer
}

export function createLegend() {
    const legend = document.createElement('div');
    legend.innerHTML = '<strong>Elevation Legend</strong><br>';
    legend.style.color = 'var(--primary-color)';
    legend.style.position = 'absolute';
    legend.style.bottom = '20px';
    legend.style.right = '20px';
    legend.style.padding = '10px';
    legend.style.background = 'rgba(255, 255, 255, 0.8)';
    legend.style.borderRadius = '5px';

    const gradientDiv = document.createElement('div');
    gradientDiv.style.height = '20px';
    gradientDiv.style.width = '200px';
    gradientDiv.style.background = 'linear-gradient(to right, purple, yellow)';
    legend.appendChild(gradientDiv);

    const minLabel = document.createElement('span');
    minLabel.innerHTML = `${elevationStore.getMin()}m`;
    minLabel.style.float = 'left';

    const maxLabel = document.createElement('span');
    maxLabel.innerHTML = `${elevationStore.getMax()}m`;
    maxLabel.style.float = 'right';

    legend.appendChild(minLabel);
    legend.appendChild(maxLabel);

    document.body.appendChild(legend);
    //console.log("legend: ", legend)
  }

