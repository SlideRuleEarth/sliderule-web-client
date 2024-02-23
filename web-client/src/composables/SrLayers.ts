
import { ref } from "vue";
import { useMapParamsStore } from "@/stores/mapParamsStore.js";
import TileLayer from 'ol/layer/Tile.js';
import TileWMS from 'ol/source/TileWMS'; // Import the TileWMS module
import TileGrid from "ol/tilegrid/TileGrid.js";
import { useMapStore } from "@/stores/mapStore.js";
import { XYZ } from 'ol/source.js';
import type { ServerType } from 'ol/source/wms.js';

const mapStore = useMapStore();

export const srAttributions = {
  esri: "Tiles © Esri contributors",
  openStreetMap: "© OpenStreetMap contributors",
  google: "Map data © Google",
  usgs: "USGS National Map 3D Elevation Program (3DEP)",
  usgs_antartic: "U.S. Geological Survey (USGS), British Antarctic Survey (BAS), National Aeronautics and Space Administration (NASA)",
  glims: "GLIMS Glacier Data © Contributors",
  nasa_gibs: "NASA GIBS",
  ahocevar: "Ahocevar",
};


export interface SrLayer {
  type: string;
  isBaseLayer: boolean;
  url: string;
  title: string;
  attributionKey: keyof typeof srAttributions; // Use the keys from the srAttributions object
  source_projection?: string; // if view is different from source an automatic reprojection will be attempted
  allowed_reprojections: string[]; // List of allowed reprojections
  layerName?: string;
  serverType?: ServerType;  //  WMS server type
  init_visibility: boolean;
  init_opacity: number;
  //tileGrid?: TileGrid;
}

const antarticTileGrid_Options = {
  origin: [-3.369955099203E7,3.369955101703E7],
  resolutions: [238810.81335399998,
      119405.40667699999,
      59702.70333849987,
      29851.351669250063,
      14925.675834625032,
      7462.837917312516,
      3731.4189586563907,
      1865.709479328063,
      932.8547396640315,
      466.42736983214803,
      233.21368491607402,
      116.60684245803701,
      58.30342122888621,
      29.151710614575396,
      14.5758553072877,
      7.28792765351156,
      3.64396382688807,
      1.82198191331174,
      0.910990956788164,
      0.45549547826179,
      0.227747739130895,
      0.113873869697739,
      0.05693693484887,
      0.028468467424435
  ],
  extent: [-9913957.327914657,-5730886.461772691,
    9913957.327914657,5730886.461773157]
}

// const Antartic_hillshadeParams = {
//   azimuth: 315,
//   altitude: 45
// }

const antarticTileGrid = new TileGrid(antarticTileGrid_Options);

export const layers = ref<SrLayer[]>([
  {
    type: "xyz",
    isBaseLayer: true,
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    title: "Esri World Topo",
    attributionKey: "esri",
    source_projection: "EPSG:3857",
    allowed_reprojections:["EPSG:3857","EPSG:4326","EPSG:3413","EPSG:3031","EPSG:5936"],
    init_visibility: true,
    init_opacity: 1,
  },
  {
    type: "xyz",
    isBaseLayer: true,
    url: "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    title: "OpenStreet",
    attributionKey: "openStreetMap",
    source_projection: "EPSG:3857",
    allowed_reprojections:["EPSG:4326","EPSG:3857"],
    init_visibility: true,
    init_opacity: 1,
  },
  {
    isBaseLayer: true,
    type: "xyz",
    url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    title: "Google",
    attributionKey: "google",
    source_projection: "EPSG:3857",
    allowed_reprojections:["EPSG:3857","EPSG:4326"],
    init_visibility: true,
    init_opacity: 1,
  },
  {
    type: "wms",
    serverType: "mapserver",
    isBaseLayer: false,
    url:"https://elevation.nationalmap.gov/arcgis/services/3DEPElevation/ImageServer/WMSServer?",
    title: "USGS 3DEP",
    attributionKey: "usgs",
    source_projection: "EPSG:3857",
    allowed_reprojections:["EPSG:3857","EPSG:4326"],
    layerName: "3DEPElevation:Hillshade Gray",
    init_visibility: false, // Note: This layer is not visible by default
    init_opacity: 0.2,
  },
  {
    type: "xyz",
    isBaseLayer: false,
    url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/ASTER_GDEM_Greyscale_Shaded_Relief/default/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpg",
    title: "Nasa Shaded Relief",
    attributionKey: "nasa_gibs",
    source_projection: "EPSG:3857",
    allowed_reprojections:["EPSG:3857"],
    init_visibility: false,
    init_opacity: 0.5,
  },
  {
    type: "xyz",
    isBaseLayer: true,
    url: "http://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
    title: "Artic Ocean Base",
    attributionKey : "esri",
    source_projection: "EPSG:5936",
    allowed_reprojections:["EPSG:5936"],
    init_visibility: true,
    init_opacity: 1,
  },
  // {
  //   type: "xyz",
  //   isBaseLayer: true,
  //   url: "http://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Imagery/MapServer/tile/{z}/{y}/{x}",
  //   title: "Artic Imagery",
  //   attributionKey: "esri",
  //   allowed_reprojections:["EPSG:5936"],
  //   init_visibility: true,
  //   init_opacity: 1,
  // },
  {
    type: "xyz",
    isBaseLayer: false,
    url: "http://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Ocean_Reference/MapServer/tile/{z}/{y}/{x}",
    title: "Artic Reference",
    attributionKey: "esri",
    source_projection: "EPSG:5936",
    allowed_reprojections:["EPSG:5936"],
    init_visibility: true,
    init_opacity: 1,
  },
  {
    type: "xyz",
    isBaseLayer: true,
    url: "http://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
    title: "Artic Imagery",
    attributionKey: "esri",
    source_projection: "EPSG:3857",
    allowed_reprojections:["EPSG:3413"],
    init_visibility: true,
    init_opacity: 1,
  },
  // {
  //   type: "xyz",
  //   isBaseLayer: true,
  //   url:"https://tiles.arcgis.com/tiles/C8EMgrsFcRFL6LrL/arcgis/rest/services/Antarctic_Basemap/MapServer/tile/{z}/{y}/{x}",
  //   //url:"http://server.arcgisonline.com/ArcGIS/rest/services/Polar/Antarctic_Basemap/MapServer/tile/{z}/{y}/{x}",
  //   title: "Antarctic Basemap",
  //   attributionKey: "esri",
  //   allowed_reprojections:["EPSG:3031"],
  //   init_visibility: true,
  //   init_opacity: 1,
  // },
  // {
  //   type: "xyz",
  //   isBaseLayer: true,
  //   url:"http://server.arcgisonline.com/ArcGIS/rest/services/Polar/Antarctic_Imagery/MapServer/tile/{z}/{y}/{x}",
  //   title: "Antarctic Imagery",
  //   attributionKey: "esri",
  //   source_projection: "EPSG:3031",
  //   allowed_reprojections:["EPSG:3031"],
  //   init_visibility: false,
  //   init_opacity: 0.5,
  //   serverType: "mapserver",
  //   tileGrid: antarticTileGrid,
  // },
  {
    type: "wms",
    isBaseLayer: true,
    url:"https://nimbus.cr.usgs.gov/arcgis/services/Antarctica/USGS_EROS_Antarctica_Reference/MapServer/WmsServer",
    title: "LIMA",
    attributionKey: "usgs_antartic",
    source_projection: "EPSG:3031",
    allowed_reprojections:["EPSG:3031"],
    layerName: "LIMA_Full_1km",
    init_visibility: true,
    init_opacity: 0.2,
  },
  {
    type: "wms",
    isBaseLayer: false,
    url:"https://nimbus.cr.usgs.gov/arcgis/services/Antarctica/USGS_EROS_Antarctica_Reference/MapServer/WmsServer",
    title: "MOA",
    attributionKey: "usgs_antartic",
    source_projection: "EPSG:3031",
    allowed_reprojections:["EPSG:3031"],
    layerName: "MOA_125_HP1_090_230",
    init_visibility: true,
    init_opacity: 0.2,
  },  
  {
    type: "wms",
    isBaseLayer: false,
    url:"https://elevation2.arcgis.com/arcgis/rest/services/Polar/AntarcticDEM/ImageServer",
    title: "REMA",
    attributionKey: "usgs_antartic",
    source_projection: "EPSG:3031",
    allowed_reprojections:["EPSG:3031"],
    layerName: "Antartic_DEM",
    init_visibility: true,
    init_opacity: 0.2,
  },
  {
    type: "wms",
    isBaseLayer: false,
    url:"https://nimbus.cr.usgs.gov/arcgis/services/Antarctica/USGS_EROS_Antarctica_Reference/MapServer/WmsServer",
    title: "RadarMosaic",
    attributionKey: "usgs_antartic",
    source_projection: "EPSG:3031",
    allowed_reprojections:["EPSG:3031"],
    layerName: "Radar_Mosaic",
    init_visibility: false,
    init_opacity: 0.2,
  },  
  // {
  //   type: "wms",
  //   isBaseLayer: false,
  //   url:"https://ahocevar.com/geoserver/wms",
  //   title: "US States",
  //   attributionKey: "ahocevar",
  //   source_projection: "EPSG:4326",
  //   allowed_reprojections:["EPSG:3857","EPSG:4326"],
  //   layerName: "topp:states",
  //   init_visibility: false,
  //   init_opacity: 0.1,
  // }  
  {
    type: "wms",
    isBaseLayer: false,
    url:"https://www.glims.org/geoserver/GLIMS/wms",
    title: "GLIMS Glacier",
    attributionKey: "glims",
    source_projection: "EPSG:4326",
    allowed_reprojections:["EPSG:3857","EPSG:4326"],
    layerName: "GLIMS_GLACIER",
    init_visibility: false,
    init_opacity: 0.2,    
  },
  // {
  //   isBaseLayer: false,
  //   url:"url: 'https://gibs-{a-c}.earthdata.nasa.gov/wmts/epsg3031/best/wmts.cgi?TIME=2013-12-01'",
  //   title: "NASA Gibs",
  //   attributionKey: "nasa_gibs",
  //   source_projection: "EPSG:3031",//??
  //   allowed_reprojections:["EPSG:3031"],
  //   init_visibility: true,
  //   init_opacity: 0.5,
  //   type: "wmts",
  // }
]);
       
export const getSrLayersForCurrentProjection = () => {
  const mapParamsStore = useMapParamsStore();
  return layers.value.filter(layer => layer.allowed_reprojections.includes(mapParamsStore.projection.name));
}
export const getSrBaseLayersForProjection = (projection: string) => {
  //console.log('getSrBaseLayersForProjection', projection);
  const layerList = layers.value.filter(layer => layer.allowed_reprojections.includes(projection) && layer.isBaseLayer);
  console.log('getSrBaseLayersForProjection', layerList);
  return layerList;
}

export const addLayersForCurrentProjection = () => {
  console.log('--------------------addLayersForCurrentProjection--------------------');

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
    } else{
      console.log(`skipping layer: ${srLayerForProj.title} for projection: ${mapStore.map?.getView().getProjection()}`);
    }
  });
}

export const getDefaultBaseLayer = (projection: string) => {
  return layers.value.find(layer => layer.isBaseLayer && layer.allowed_reprojections.includes(projection));
}

export const getLayer = (title: string) => {
  console.log(`getLayer ${title}`);
  const srLayer = layers.value.find(layer => layer.title === title);
  let layerInstance;
  if(srLayer){
    const mapParamsStore = useMapParamsStore();
    const cachedLayer = mapParamsStore.getLayerFromCache(title);
    let lname = srLayer.title;
    if (srLayer.isBaseLayer) {
      lname = "Base Layer";
    } else {
      lname = srLayer.layerName || srLayer.title;
    }
    const localTileLayerOptions = {
      title: title,
      name: lname,
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
          console.log(`WMS serverType?:${srLayer.serverType} Layer: url: ${srLayer.url} layer:${srLayer.layerName} proj:${mapParamsStore.projection.name}`);
          layerInstance = new TileLayer({
            // if we specify it, the layer will be reprojected to the view's projection
            // if we don't specify it we assume it is in the view's projection
            // note: projection is defaulted to the View's projection
            source: new TileWMS({ 
              url: srLayer.url,
              attributions: srAttributions[srLayer.attributionKey],
              params: {
                'LAYERS': srLayer.layerName, // the WMS layer name(s) to load
                'TILED': true,
                'CRS': mapParamsStore.projection.name,
              },
              projection: srLayer.source_projection,
              serverType: srLayer.serverType, //  WMS server type 
              //crossOrigin: '', // Consider CORS policies
              crossOrigin: 'anonymous', // Consider CORS policies
              //referrerPolicy: 'no-referrer',
            }),
            ... localTileLayerOptions
          });

        } else if(srLayer.type === "xyz"){
          console.log(`XYZ ${srLayer.serverType} Layer: url: ${srLayer.url} layer:${(srLayer.layerName || srLayer.title)} proj:${mapParamsStore.projection.name}`);
          const xyzOptions = {
            url: srLayer.url,
            extent: mapParamsStore.extent,
            attributions: srAttributions[srLayer.attributionKey],
          }
          layerInstance = new TileLayer({
            source: new XYZ(xyzOptions),
            ... localTileLayerOptions
          });
        }
        if (layerInstance) {
          //console.log('Caching layer', title);
          mapParamsStore.cacheLayer(title, layerInstance);
        }
    }
    console.log (`getLayer returning: ${lname} isBaseLayer:${srLayer.isBaseLayer} title:${title}`);
  } else {
    console.log('Layer not found with this title:', title);
  }
  //console.log('getLayer returning:', layerInstance);
  return layerInstance;
}