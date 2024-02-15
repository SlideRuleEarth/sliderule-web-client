
import { ref } from "vue";
import { useMapParamsStore } from "@/stores/mapParamsStore.js";
import TileLayer from 'ol/layer/Tile.js';
import TileWMS from 'ol/source/TileWMS'; // Import the TileWMS module
import { useMapStore } from "@/stores/mapStore.js";
import { XYZ } from 'ol/source.js';
import { e } from "vitest/dist/reporters-rzC174PQ.js";

const mapStore = useMapStore();

export interface SrLayer {
  type: string;
  isBaseLayer: boolean;
  url: string;
  title: string;
  attribution: string;
  allowed_projections: string[];
  layerName?: string;
  init_visibility: boolean;
  init_opacity: number;
}

export const layers = ref<SrLayer[]>([
  {
    type: "xyz",
    isBaseLayer: true,
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    title: "Esri World Topo",
    attribution: "Tiles © Esri contributers",
    allowed_projections:["EPSG:3857","EPSG:4326"],
    init_visibility: true,
    init_opacity: 1,
  },
  {
    type: "xyz",
    isBaseLayer: true,
    url: "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    title: "OpenStreet",
    attribution: "© OpenStreetMap contributors",
    allowed_projections:["EPSG:3857","EPSG:4326"],
    init_visibility: true,
    init_opacity: 1,
  },
  {
    isBaseLayer: true,
    type: "xyz",
    url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    title: "Google",
    attribution: "Map data © Google",
    allowed_projections:["EPSG:3857","EPSG:4326"],
    init_visibility: true,
    init_opacity: 1,
  },
  {
    type: "xyz",
    isBaseLayer: true,
    url: "http://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
    title: "Artic Ocean Base",
    attribution: "Tiles © Esri contributers",
    allowed_projections:["EPSG:5936"],
    init_visibility: true,
    init_opacity: 1,
  },
  {
    type: "xyz",
    isBaseLayer: true,
    url: "http://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Imagery/MapServer/tile/{z}/{y}/{x}",
    title: "Artic Imagery",
    attribution: "Tiles © Esri Artic Imagery contributers",
    allowed_projections:["EPSG:5936"],
    init_visibility: true,
    init_opacity: 1,
  },
  {
    type: "xyz",
    isBaseLayer: false,
    url: "http://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Ocean_Reference/MapServer/tile/{z}/{y}/{x}",
    title: "Artic Reference",
    attribution: "Tiles © Esri Artic Ref contributers",
    allowed_projections:["EPSG:5936"],
    init_visibility: true,
    init_opacity: 1,
  },
  {
    type: "xyz",
    isBaseLayer: true,
    url: "http://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
    title: "Artic Imagery",
    attribution: "Tiles © Esri Artic Imagery contributers",
    allowed_projections:["EPSG:3413"],
    init_visibility: true,
    init_opacity: 1,
  },
  {
    type: "xyz",
    isBaseLayer: true,
    url:"http://server.arcgisonline.com/ArcGIS/rest/services/Polar/Antarctic_Imagery/MapServer/tile/{z}/{y}/{x}",
    title: "Antarctic Imagery",
    attribution: "Tiles © Esri Antartic contributers",
    allowed_projections:["EPSG:3031"],
    init_visibility: true,
    init_opacity: 1,
  },
  {
    type: "wms",
    isBaseLayer: false,
    url:"https://elevation.nationalmap.gov/arcgis/services/3DEPElevation/ImageServer/WMSServer?",
    title: "USGS 3DEP",
    attribution: "USGS National Map 3D Elevation Program (3DEP)",
    allowed_projections:["EPSG:3857","EPSG:4326"],
    layerName: "3DEPElevation:Hillshade Gray",
    init_visibility: true,
    init_opacity: 0.2,
  }
  // {
  //   isBaseLayer: false,
  //   url:"url: 'https://gibs-{a-c}.earthdata.nasa.gov/wmts/epsg3031/best/wmts.cgi?TIME=2013-12-01'",
  //   title: "NASA Gibs",
  //   attribution: "Tiles © NASA Gibs contributers",
  //   allowed_projections:["EPSG:3031"],
  //   type: "wmts"
  // }
]);
       
export const getSrLayersForCurrentProjection = () => {
  const mapParamsStore = useMapParamsStore();
  return layers.value.filter(layer => layer.allowed_projections.includes(mapParamsStore.projection.name));
}
export const getSrBaseLayersForProjection = (projection: string) => {
  //console.log('getSrBaseLayersForProjection', projection);
  return layers.value.filter(layer => layer.allowed_projections.includes(projection) && layer.isBaseLayer);
}

export const addLayersForCurrentProjection = () => {
  const srLayersForProj = getSrLayersForCurrentProjection();
  srLayersForProj.forEach(srLayerForProj => {
    if(!srLayerForProj.isBaseLayer){ // base layer is managed by baseLayerControl
      console.log(`adding non base layer:`,srLayerForProj.title);
      const newLayer = getLayer(srLayerForProj.title);
      if(mapStore.map){
        mapStore.map.addLayer(newLayer);
      } else {
        console.log('map not available');
      }
    }
  });
}

export const getDefaultBaseLayer = (projection: string) => {
  return layers.value.find(layer => layer.isBaseLayer && layer.allowed_projections.includes(projection));
}

export const getLayer = (title: string) => {
  //console.log('getLayer', title);
  const srLayer = layers.value.find(layer => layer.title === title);
  let layerInstance;
  if(srLayer){
    const mapParamsStore = useMapParamsStore();
    const cachedLayer = mapParamsStore.getLayerFromCache(title);
    const localTileLayerOptions = {
      title: title,
      opacity: srLayer.init_opacity,
      visible: srLayer.init_visibility,
    }
    if (cachedLayer) {
      layerInstance = cachedLayer; // Return the cached layer if it exists
    } else {
        if(srLayer.type === "wmts"){
          console.log('WMTS Layer TBD');
        } else if(srLayer.type === "wms"){
          // Handle WMS layers
          layerInstance = new TileLayer({
            source: new TileWMS({
              url: srLayer.url,
              params: {
                'LAYERS': srLayer.layerName, // Specify the WMS layer name(s) you want to load
                'TILED': true,
              },
              serverType: 'geoserver', // Change this as per your WMS server type if needed
              crossOrigin: 'anonymous', // Consider CORS policies
            }),
            ... localTileLayerOptions
          });

        } else if(srLayer.type === "xyz"){
          layerInstance = new TileLayer({
            source: new XYZ({
              url: srLayer.url
            }),
            ... localTileLayerOptions
          });
        }
        if (layerInstance) {
          //console.log('Caching layer', title);
          mapParamsStore.cacheLayer(title, layerInstance);
        }
    }
  } else {
    console.log('Layer not found with this title:', title);
  }
  return layerInstance;
}