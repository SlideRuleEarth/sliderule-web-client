import { ref } from 'vue'
import TileLayer from 'ol/layer/Tile.js'
import TileWMS from 'ol/source/TileWMS' // Import the TileWMS module
import { useMapStore } from '@/stores/mapStore.js'
import type { ServerType } from 'ol/source/wms.js'
import { XYZ } from 'ol/source.js'
import type OLMap from 'ol/Map.js'
// import { srViews } from "./SrViews"; // Unused import
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrLayers')

export const srAttributions = {
  esri: 'Tiles © Esri contributors',
  openStreetMap: '© OpenStreetMap contributors',
  google: 'Map data © Google',
  usgs: 'USGS National Map 3D Elevation Program (3DEP)',
  usgs_antartic:
    'U.S. Geological Survey (USGS), British Antarctic Survey (BAS), National Aeronautics and Space Administration (NASA)',
  glims: 'GLIMS Glacier Data © Contributors',
  nasa_gibs: 'NASA GIBS',
  ahocevar: 'Ahocevar'
}

export interface SrLayer {
  type: string
  isBaseLayer: boolean
  url: string
  title: string // unique title for the layer
  attributionKey: keyof typeof srAttributions // Use the keys from the srAttributions object
  source_projection: string // if view is different from source an automatic reprojection will be attempted
  allowed_reprojections: string[] // List of allowed reprojections
  layerName?: string
  serverType?: ServerType //  WMS server type
  init_visibility: boolean
  init_opacity: number
}

// Unused - kept for future reference
// const antarticTileGrid_Options = {
//   origin: [-3.369955099203E7,3.369955101703E7],
//   resolutions: [238810.81335399998,
//       119405.40667699999,
//       59702.70333849987,
//       29851.351669250063,
//       14925.675834625032,
//       7462.837917312516,
//       3731.4189586563907,
//       1865.709479328063,
//       932.8547396640315,
//       466.42736983214803,
//       233.21368491607402,
//       116.60684245803701,
//       58.30342122888621,
//       29.151710614575396,
//       14.5758553072877,
//       7.28792765351156,
//       3.64396382688807,
//       1.82198191331174,
//       0.910990956788164,
//       0.45549547826179,
//       0.227747739130895,
//       0.113873869697739,
//       0.05693693484887,
//       0.028468467424435
//   ],
//   extent: [-9913957.327914657,-5730886.461772691,
//     9913957.327914657,5730886.461773157]
// }

// const Antartic_hillshadeParams = {
//   azimuth: 315,
//   altitude: 45
// }

// Temporarily commented out - not currently used but may be needed in the future
// const antarticTileGrid = new TileGrid(antarticTileGrid_Options);

export const layers = ref<{ [key: string]: SrLayer }>({
  'Esri World Topo': {
    title: 'Esri World Topo',
    type: 'xyz',
    isBaseLayer: true,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attributionKey: 'esri',
    source_projection: 'EPSG:3857',
    allowed_reprojections: ['EPSG:3857', 'EPSG:4326'],
    init_visibility: true,
    init_opacity: 1
  },
  OpenStreet: {
    title: 'OpenStreet',
    type: 'xyz',
    isBaseLayer: true,
    url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attributionKey: 'openStreetMap',
    source_projection: 'EPSG:3857',
    allowed_reprojections: ['EPSG:4326', 'EPSG:3857'],
    init_visibility: true,
    init_opacity: 1
  },
  Google: {
    title: 'Google',
    type: 'xyz',
    isBaseLayer: true,
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attributionKey: 'google',
    source_projection: 'EPSG:3857',
    allowed_reprojections: ['EPSG:3857', 'EPSG:4326'],
    init_visibility: true,
    init_opacity: 1
  },
  'USGS 3DEP': {
    title: 'USGS 3DEP',
    type: 'wms',
    serverType: 'mapserver',
    isBaseLayer: false,
    url: 'https://elevation.nationalmap.gov/arcgis/services/3DEPElevation/ImageServer/WMSServer?',
    attributionKey: 'usgs',
    source_projection: 'EPSG:3857',
    allowed_reprojections: ['EPSG:3857', 'EPSG:4326'],
    layerName: '3DEPElevation:Hillshade Gray',
    init_visibility: false, // Note: This layer is not visible by default
    init_opacity: 0.2
  },
  'Nasa Shaded Relief': {
    title: 'Nasa Shaded Relief',
    type: 'xyz',
    isBaseLayer: false,
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/ASTER_GDEM_Greyscale_Shaded_Relief/default/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpg',
    attributionKey: 'nasa_gibs',
    source_projection: 'EPSG:3857',
    allowed_reprojections: ['EPSG:3857'],
    init_visibility: false,
    init_opacity: 0.5
  },
  'Arctic Ocean Base': {
    title: 'Arctic Ocean Base',
    type: 'xyz',
    isBaseLayer: true,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    attributionKey: 'esri',
    source_projection: 'EPSG:5936',
    allowed_reprojections: ['EPSG:5936', 'EPSG:4326', 'EPSG:3413'],
    init_visibility: true,
    init_opacity: 1
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
  'Artic Reference': {
    title: 'Artic Reference',
    type: 'xyz',
    isBaseLayer: false,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Ocean_Reference/MapServer/tile/{z}/{y}/{x}',
    attributionKey: 'esri',
    source_projection: 'EPSG:5936',
    allowed_reprojections: ['EPSG:5936', 'EPSG:3413'],
    init_visibility: true,
    init_opacity: 1
  },
  // "Artic Imagery": {
  //   //type: "ArcGisRest",
  //   type: "xyz",
  //   isBaseLayer: true,
  //   url: "http://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
  //   title: "Artic Imagery",
  //   attributionKey: "esri",
  //   source_projection: "EPSG:3413",
  //   allowed_reprojections:["EPSG:4326"],
  //   init_visibility: true,
  //   init_opacity: 1,
  //   allowed_views: ["North"],
  // },
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
  'Antarctic Imagery': {
    title: 'Antarctic Imagery',
    //type: "ArcGisRest",
    type: 'xyz',
    isBaseLayer: true,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Polar/Antarctic_Imagery/MapServer/tile/{z}/{y}/{x}',
    attributionKey: 'esri',
    source_projection: 'EPSG:3031',
    allowed_reprojections: ['EPSG:3031'],
    init_visibility: false,
    init_opacity: 0.5,
    serverType: 'mapserver'
    //tileGrid: antarticTileGrid,
  },
  LIMA: {
    title: 'LIMA',
    type: 'wms',
    isBaseLayer: false,
    url: 'https://nimbus.cr.usgs.gov/arcgis/services/Antarctica/USGS_EROS_Antarctica_Reference/MapServer/WmsServer',
    attributionKey: 'usgs_antartic',
    source_projection: 'EPSG:3031',
    allowed_reprojections: ['EPSG:3031'],
    layerName: 'LIMA_Full_1km',
    init_visibility: true,
    init_opacity: 0.2
  },
  MOA: {
    title: 'MOA',
    type: 'wms',
    isBaseLayer: false,
    url: 'https://nimbus.cr.usgs.gov/arcgis/services/Antarctica/USGS_EROS_Antarctica_Reference/MapServer/WmsServer',
    attributionKey: 'usgs_antartic',
    source_projection: 'EPSG:3031',
    allowed_reprojections: ['EPSG:3031'],
    layerName: 'MOA_125_HP1_090_230',
    init_visibility: true,
    init_opacity: 0.2
  },
  REMA: {
    title: 'REMA',
    type: 'wms',
    isBaseLayer: false,
    url: 'https://elevation2.arcgis.com/arcgis/rest/services/Polar/AntarcticDEM/ImageServer',
    attributionKey: 'usgs_antartic',
    source_projection: 'EPSG:3031',
    allowed_reprojections: ['EPSG:3031'],
    layerName: 'Antartic_DEM',
    init_visibility: true,
    init_opacity: 0.2
  },
  RadarMosaic: {
    title: 'RadarMosaic',
    type: 'wms',
    isBaseLayer: false,
    url: 'https://nimbus.cr.usgs.gov/arcgis/services/Antarctica/USGS_EROS_Antarctica_Reference/MapServer/WmsServer',
    attributionKey: 'usgs_antartic',
    source_projection: 'EPSG:3031',
    allowed_reprojections: ['EPSG:3031'],
    layerName: 'Radar_Mosaic',
    init_visibility: false,
    init_opacity: 0.2
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
  'GLIMS Glacier': {
    title: 'GLIMS Glacier',
    type: 'wms',
    isBaseLayer: false,
    url: 'https://www.glims.org/geoserver/GLIMS/wms',
    attributionKey: 'glims',
    source_projection: 'EPSG:4326',
    allowed_reprojections: ['EPSG:3857', 'EPSG:4326'],
    layerName: 'GLIMS_GLACIER',
    init_visibility: false,
    init_opacity: 0.2
  }
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
})

export const getSrLayersForCurrentView = () => {
  const mapStore = useMapStore()
  const srViewObj = mapStore.getSrViewObj()
  const projName = srViewObj.projectionName
  return Object.values(layers.value).filter((layer) =>
    layer.allowed_reprojections.includes(projName)
  )
}

export const getSrLayersForCurrentProjection = () => {
  const mapStore = useMapStore()
  return Object.values(layers.value).filter((layer) =>
    layer.allowed_reprojections.includes(mapStore.getSrViewObj().projectionName)
  )
}

export const getSrBaseLayersForCurrentView = () => {
  //console.log('getSrBaseLayersForCurrentView', view);
  const allLayersList = getSrLayersForCurrentView()
  const layerList = Object.values(allLayersList).filter((layer) => layer.isBaseLayer)
  //console.log('getSrBaseLayersForCurrentView', layerList);
  return layerList
}

export const addLayersForCurrentView = (map: OLMap, projectionName: string) => {
  //console.log('--------------------addLayersForCurrentView--------------------');
  try {
    const srLayersForView = getSrLayersForCurrentView()
    srLayersForView.forEach((srLayerForView) => {
      if (!srLayerForView.isBaseLayer) {
        // base layer is managed by baseLayerControl
        //console.log(`adding non base layer:`,srLayerForView.title);
        const newLayer = getLayer(projectionName, srLayerForView.title)
        if (newLayer) {
          if (map) {
            logger.debug('addLayersForCurrentView adding layer', { title: srLayerForView.title })
            map.addLayer(newLayer)
          } else {
            logger.error('addLayersForCurrentView map not available', { map })
          }
        } else {
          logger.error(
            `addLayersForCurrentView SKIPPING - No layer found for title: ${srLayerForView.title} projection: ${projectionName}`
          )
        }
      } else {
        logger.debug('addLayersForCurrentView SKIPPING - base layer', {
          title: srLayerForView.title
        })
      }
    })
  } catch (error) {
    logger.error('addLayersForCurrentView error', {
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

export const getLayer = (projectionName: string, title: string): TileLayer | undefined => {
  //console.log(`getLayer ${title}`);

  const srLayer = Object.values(layers.value).find((layer) => layer.title === title)
  let layerInstance
  if (srLayer) {
    const mapStore = useMapStore()
    const cachedLayer = mapStore.getLayerFromCache(projectionName, title)
    let lname = srLayer.title
    if (srLayer.isBaseLayer) {
      lname = 'Base Layer'
    } else {
      lname = srLayer.layerName || srLayer.title
    }
    const localTileLayerOptions = {
      title: title,
      name: lname,
      opacity: srLayer.init_opacity,
      visible: srLayer.init_visibility
    }
    if (cachedLayer) {
      layerInstance = cachedLayer // Return the cached layer if it exists
      logger.debug('Using cached layer', { cachedLayer })
    } else {
      if (srLayer.type === 'wmts') {
        logger.debug('WMTS Layer TBD')
      } else if (srLayer.type === 'wms') {
        // Handle WMS layers
        //console.log(`WMS serverType?:${srLayer.serverType} Layer: url: ${srLayer.url} layer:${srLayer.layerName} proj:${mapStore.getProjection()}`);
        layerInstance = new TileLayer({
          // if we specify it, the layer will be reprojected to the view's projection
          // if we don't specify it we assume it is in the view's projection
          // note: projection is defaulted to the View's projection
          source: new TileWMS({
            url: srLayer.url,
            attributions: srAttributions[srLayer.attributionKey],
            params: {
              LAYERS: srLayer.layerName, // the WMS layer name(s) to load
              TILED: true
              //'CRS': srLayer.source_projection, // TBD verify this !!!!
            },
            //projection:srLayer.source_projection,  // TBD verify this !!!!
            serverType: srLayer.serverType, //  WMS server type
            //crossOrigin: '', // Consider CORS policies
            crossOrigin: 'anonymous' // Consider CORS policies
            //referrerPolicy: 'no-referrer',
          }),
          ...localTileLayerOptions
        })
      } else if (srLayer.type === 'xyz') {
        //console.log(`XYZ ${srLayer.serverType} Layer: url: ${srLayer.url} layer:${(srLayer.layerName || srLayer.title)} proj:${mapStore.getProjection()}`);
        const xyzOptions = {
          url: srLayer.url,
          //extent: mapStore.extent,
          projection: srLayer.source_projection,
          attributions: srAttributions[srLayer.attributionKey]
        }
        layerInstance = new TileLayer({
          source: new XYZ(xyzOptions),
          ...localTileLayerOptions
        })
        // } else if(srLayer.type === "ArcGisRest"){
        //   console.log(`XYZ ${srLayer.serverType} Layer: url: ${srLayer.url} layer:${(srLayer.layerName || srLayer.title)} proj:${mapStore.getProjection()}`);
        //   const arcGisRestOptions = {
        //     url: srLayer.url,
        //     //extent: mapStore.extent,
        //     attributions: srAttributions[srLayer.attributionKey],
        //   }
        //   layerInstance = new TileLayer({
        //     source: new TileArcGISRest(arcGisRestOptions),
        //     ... localTileLayerOptions
        //   });
      }
      if (layerInstance) {
        //console.log('Caching layer', title);
        mapStore.addLayerToCache(projectionName, lname, layerInstance)
      }
    }
    //console.log (`getLayer returning: ${lname} isBaseLayer:${srLayer.isBaseLayer} title:${title}`);
  } else {
    logger.debug('Layer not found with this title', { title })
  }
  //console.log('getLayer returning:', layerInstance);
  return layerInstance
}
