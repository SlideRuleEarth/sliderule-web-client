import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { useMapStore } from '@/stores/mapStore';
import Point from 'ol/geom/Point';
import Feature from 'ol/Feature';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Circle from 'ol/style/Circle';
import { ref } from 'vue';
import { transform,  get as getProjection } from 'ol/proj.js';
import { useMapParamsStore } from "@/stores/mapParamsStore.js";
import { useElevationStore } from '@/stores/elevationStore';

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
    return rgbToHex(interpolateColor(purple, yellow, factor));
}
  

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

function createElevationFeatures(flattenedData: ElevationData[]) {
    // Move projection lookup outside the loop
    const srProjection = mapParamsStore.getProjection();
    console.log("createElevationFeatures -> data: ", flattenedData);
    const projection = getProjection(srProjection.name);
    if (!projection) {
        console.error('Projection not found');
        return []; // Or handle this case as needed
    }

    // Filter out items without valid projection and map over the rest
    return flattenedData.filter(elevation => elevation).map(elevation => {
        const long = elevation.longitude;
        const lat = elevation.latitude;
        const h_mean = elevation.h_mean;
        if(pnt_cnt.value === 0){
            console.log("createElevationFeatures -> elevation: ", elevation);
        }

        const feature = new Feature({
            geometry: new Point(transform([long, lat], 'EPSG:4326', srProjection.name))
        });

        const color = getColorForElevation(h_mean, elevationStore.getMin(), elevationStore.getMax());
        feature.setStyle(new Style({
            image: new Circle({
                radius: 5,
                fill: new Fill({color: color})
            })
        }));
        
        //console.log("pnt_cnt: ", pnt_cnt.value)
        //console.log("feature: ", feature)
        pnt_cnt.value++;
        return feature;
    });
}

export function addVectorLayer(elevationData:ElevationData[]){
    console.log("addVectorLayer -> elevationData: ", elevationData);
    const vectorSource = new VectorSource({
        features: createElevationFeatures(elevationData),
    });
    console.log("addVectorLayer pnt_cnt: ", pnt_cnt.value)
    const elOptions = {
        name: 'Elevation Layer',
        source: vectorSource,
        zIndex: 999
    };
    const elevationLayer = new VectorLayer({
        ...elOptions
    });
    const mapStore = useMapStore();
    const map = mapStore.getMap();
    
    if (map) {
        map.addLayer(elevationLayer); 
    } else {
        console.error('Map not found');
    }
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

