
import { ref } from "vue";
import { useMapParamsStore } from "@/stores/mapParamsStore.js";
import TileLayer from 'ol/layer/Tile.js';
import { XYZ } from 'ol/source.js';

export interface SrLayer {
    isBaseLayer: boolean;
    url: string;
    title: string;
    attribution: string;
    allowed_projections: string[];
    type: string;
}

export const layers = ref<SrLayer[]>([
  {
    isBaseLayer: true,
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    title: "Esri World Topo",
    attribution: "Tiles © Esri contributers",
    allowed_projections:["EPSG:3857","EPSG:4326"],
    type: "xyz"
  },
  {
    isBaseLayer: true,
    url: "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    title: "OpenStreet",
    attribution: "© OpenStreetMap contributors",
    allowed_projections:["EPSG:3857","EPSG:4326"],
    type: "xyz"
  },
  {
    isBaseLayer: true,
    url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    title: "Google",
    attribution: "Map data © Google",
    allowed_projections:["EPSG:3857","EPSG:4326"],
    type: "xyz"
  },
  {
    isBaseLayer: false,
    url: "http://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
    title: "Artic Ocean Base",
    attribution: "Tiles © Esri contributers",
    allowed_projections:["EPSG:5936"],
    type: "xyz"
  },
  {
    isBaseLayer: false,
    url: "http://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Imagery/MapServer/tile/{z}/{y}/{x}",
    title: "Artic Imagery",
    attribution: "Tiles © Esri Artic Imagery contributers",
    allowed_projections:["EPSG:5936"],
    type: "xyz"
  },
  {
    isBaseLayer: false,
    url: "http://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Ocean_Reference/MapServer/tile/{z}/{y}/{x}",
    title: "Artic Reference",
    attribution: "Tiles © Esri Artic Ref contributers",
    allowed_projections:["EPSG:5936"],
    type: "xyz"
  },
  {
    isBaseLayer: false,
    url:"http://server.arcgisonline.com/ArcGIS/rest/services/Polar/Antarctic_Imagery/MapServer/tile/{z}/{y}/{x}",
    title: "Antarctic Imagery",
    attribution: "Tiles © Esri Antartic contributers",
    allowed_projections:["EPSG:3031"],
    type: "xyz"
  },
  {
    isBaseLayer: false,
    url:"url: 'https://gibs-{a-c}.earthdata.nasa.gov/wmts/epsg3031/best/wmts.cgi?TIME=2013-12-01'",
    title: "NASA Gibs",
    attribution: "Tiles © NASA Gibs contributers",
    allowed_projections:["EPSG:3031"],
    type: "wmts"
  }
]);
       
export const getSrLayersForCurrentProjection = () => {
  const mapParamsStore = useMapParamsStore();
  return layers.value.filter(layer => layer.allowed_projections.includes(mapParamsStore.projection.name));
}
export const getSrBaseLayersForProjection = (projection: string) => {
  //console.log('getSrBaseLayersForProjection', projection);
  return layers.value.filter(layer => layer.allowed_projections.includes(projection) && layer.isBaseLayer);
}

export const getDefaultBaseLayer = () => {
  return layers.value.find(layer => layer.isBaseLayer);
}

export const getLayer = (title: string) => {
  //console.log('getLayer', title);
  const mapParamsStore = useMapParamsStore();
  const cachedLayer = mapParamsStore.getLayerFromCache(title);
  let layerInstance;
  if (cachedLayer) {
    layerInstance = cachedLayer; // Return the cached layer if it exists
  } else {
    const srLayer = layers.value.find(layer => layer.title === title);
    if(srLayer){
      if(srLayer.type === "wmts"){
        console.log('WMTS Layer TBD');
      } else if(srLayer.type === "xyz"){
        const myOptions = {
          title: srLayer.title,
        }
        layerInstance = new TileLayer({
          source: new XYZ({
            url: srLayer.url
          }),
          ... myOptions
        });
      }
      if (layerInstance) {
        //console.log('Caching layer', title);
        mapParamsStore.cacheLayer(title, layerInstance);
      }
    } else {
      console.log('Layer not found with this title:', title);
    }
  }
  return layerInstance;
}