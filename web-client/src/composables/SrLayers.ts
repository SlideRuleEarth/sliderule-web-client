
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
    title: "Esri-World-Topo",
    attribution: "Tiles © Esri contributers",
    allowed_projections:["EPSG:3857","EPSG:4326","EPSG:5936","EPSG:3031"],
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
    allowed_projections:["EPSG:3857","EPSG:4326","EPSG:5936","EPSG:3031"],
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
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    title: "Esri World Topo",
    attribution: "Tiles © Esri World Topo contributers",
    allowed_projections:["EPSG:3857","EPSG:4326"],
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
       
export const getLayersForCurrentProjection = () => {
  const mapParamsStore = useMapParamsStore();
  return layers.value.filter(layer => 
    layer.allowed_projections.includes(mapParamsStore.projection.name)
  );
}
export const getBaseLayersForProjection = (projection: string) => {
  console.log('getBaseLayersForProjection', projection);
  return layers.value.filter(layer => layer.allowed_projections.includes(projection) && layer.isBaseLayer);
}

export const getDefaultBaseLayer = () => {
  return layers.value.find(layer => layer.isBaseLayer);
}

export const getLayer = (title: string) => {
  const srBaseLayer = layers.value.find(layer => layer.title === title);
  if(srBaseLayer){
    if(srBaseLayer.type === "wmts"){
      console.log('WMTS Layer TBD');
    } else if(srBaseLayer.type === "xyz"){
      const myOptions = {
        title: srBaseLayer.title,
      }
      return new TileLayer({
        source: new XYZ({
          url: srBaseLayer.url
        }),
        ... myOptions
      });
    }
  }
}