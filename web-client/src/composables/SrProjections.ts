
import { ref } from "vue";
export interface SrProjection {
    title: string;
    name: string;
    label: string;
    proj4def: string;
    default_center: number[];
    default_zoom?: number;
    bbox?: number[];
}
export const projections = ref<SrProjection[]>([
  { // Web Mercator -- This is the 'standard' projection for web maps
    title: "Web Mercator",
    label: "Global",
    name: "EPSG:4326",
    proj4def: "+proj=longlat +datum=WGS84 +no_defs +type=crs",
    default_center: [-108, 39],
    default_zoom: 1,
    bbox: [90.0,-180.0,-90.0,180.0],
  },
  {
    title: "North: Alaska Polar Stereographic",
    name: "EPSG:5936",
    label: "North",
    proj4def: "+proj=stere +lat_0=90 +lon_0=-150 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m +no_defs +type=crs",
    default_center: [2978776.46, 3695290.56],
    default_zoom: 2,
    bbox: [90.0,-180.0,60.0,180.0],
  },
  {
    title: "South: Antarctic Polar Stereographic",
    name: "EPSG:3031",
    label: "South",
    proj4def: "+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs",
    default_center: [0.0, 1915741.27],
    default_zoom: 2,
    bbox: [-60.0,-180.0,-90.0,180.0],
  }
  ]);
