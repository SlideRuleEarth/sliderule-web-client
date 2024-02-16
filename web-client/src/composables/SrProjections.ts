import { ref,computed } from "vue";
export interface SrProjection {
    title: string;
    name: string;
    label: string;
    proj4def: string;
    default_center: number[];
    default_zoom?: number;
    min_zoom?: number;
    max_zoom?: number;
    bbox?: number[];
}
export const srProjections = ref<SrProjection[]>([
  {
    title: "Web Mercator",
    label: "Web Mercator",
    name: "EPSG:3857",
    proj4def: "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +type=crs",
    default_center: [0, 0], // Center of the map in Web Mercator coordinates
    default_zoom: 2,
    min_zoom: 1,
    max_zoom: 19,
    bbox: [90.0,-180.0,-90.0,180.0], // Approximate valid range in meters
  },
  { // Web Mercator -- This is the 'standard' projection for web maps
    title: "WGS 84",
    label: "WGS 84",
    name: "EPSG:4326",
    proj4def: "+proj=longlat +datum=WGS84 +no_defs +type=crs",
    default_center: [-108, 39],
    default_zoom: 1,
    min_zoom: 1,
    max_zoom: 19,
    bbox: [90.0,-180.0,-90.0,180.0],
  },
  {
    title: "North: Alaska Polar Stereographic",
    name: "EPSG:5936",
    label: "North Alaska",
    proj4def: "+proj=stere +lat_0=90 +lon_0=-150 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m +no_defs +type=crs",
    default_center: [9000000, 13000000],
    default_zoom: 4,
    min_zoom: 1,
    max_zoom: 16,
    bbox: [90.0,-180.0,60.0,180.0],
  },
  {
    title: "NSIDC Sea Ice Polar Stereographic North",
    name: "EPSG:3413",
    label: "North Sea Ice",
    proj4def: "+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs",
    default_center: [9000000,-9000000],
    default_zoom: 4,
    min_zoom: 1,
    max_zoom: 16,
    bbox: [90.0,-180.0,0.0,180.0],
  },
  {
    title: "South: Antarctic Polar Stereographic",
    name: "EPSG:3031",
    label: "South",
    proj4def: "+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +k=1 +no_defs",
    default_center: [3000000,9000000],
    default_zoom: 4,
    min_zoom: 1,
    max_zoom: 16,
    bbox: [-60.0,-180.0,-90.0,180.0],
  }
]);

export const useProjectionNames = () => {
  const projectionNames = computed(() => srProjections.value.map(p => p.name));
  return projectionNames;
};

// Function to fetch a projection by its name
export const findProjectionByName = (name: string) => {
  return computed(() => srProjections.value.find(p => p.name === name));
};

export const getDefaultProjection = () => {
  return srProjections.value[0];
};