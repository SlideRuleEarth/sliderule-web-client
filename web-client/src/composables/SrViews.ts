import { ref, computed } from "vue";

export interface SrView {
  name: string;
  description: string;
  projectionName: string;
  baseLayerName?: string;
  default_zoom?: number;
  min_zoom: number;
  max_zoom: number;
  bbox: number[];
}

// srViews is now an object with keys as view names
export const srViews = ref<{ [key: string]: SrView }>({
  "Global": {
    name: "Global",
    description: "WGS 84 Lat/Long",
    projectionName: "EPSG:4326", // +proj=longlat +datum=WGS84 +no_defs
    baseLayerName: "Esri World Topo",
    default_zoom: 1,
    min_zoom: 0,
    max_zoom: 16,
    bbox: [90.0, -180.0, -90.0, 180.0],
  },
  "Global Mercator": {
    name: "Global Mercator",
    description: "WGS 84 Mercator",
    projectionName: "EPSG:3857", // 
    baseLayerName: "Esri World Topo",
    default_zoom: 1,
    min_zoom: 0,
    max_zoom: 16,
    bbox: [90.0, -180.0, -90.0, 180.0],
  },
  "Global google": {
    name: "Global google",
    description: "WGS 84",
    projectionName: "EPSG:4326", // +proj=longlat +datum=WGS84 +no_defs
    baseLayerName: "Google",
    default_zoom: 1,
    min_zoom: 0,
    max_zoom: 16,
    bbox: [90.0, -180.0, -90.0, 180.0],
  },
  "North": {
    name: "North",
    description: "North Polar Stereographic",
    projectionName: "EPSG:5936",// +proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs
    baseLayerName: "Artic Ocean Base",
    default_zoom: 5,
    min_zoom: 0,
    max_zoom: 16,
    bbox: [90.0, -180.0, 60.0, 180.0],
  },
  "South": {
    name: "South",
    description: "South: Antarctic Polar Stereographic",
    projectionName: "EPSG:3031", // +proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs
    baseLayerName: "Antartic Imagery",
    default_zoom: 2,
    min_zoom: 0,
    max_zoom: 16,
    bbox: [-60.0, -180.0, -90.0, 180.0],
  }
});

// Updated to work with an object
export const useViewNames = () => {
  const viewsNames = computed(() => Object.keys(srViews.value));
  return viewsNames;
};

// Directly access the view by its name
export const findViewByName = (name: string) => {
  return computed(() => srViews.value[name]);
};

// Assuming "Web Mercator" is the default view, or you can introduce a new ref to keep track of the default view's name
export const getDefaultView = () => {
  return srViews.value["Web Mercator"];
};
