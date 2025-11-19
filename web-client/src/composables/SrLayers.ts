import { ref } from 'vue'
import TileLayer from 'ol/layer/Tile.js'
import TileWMS from 'ol/source/TileWMS' // Import the TileWMS module
import { useMapStore } from '@/stores/mapStore.js'
import type { ServerType } from 'ol/source/wms.js'
import { XYZ } from 'ol/source.js'
import TileGrid from 'ol/tilegrid/TileGrid.js'
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
  max_zoom?: number // Maximum zoom level for this layer
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

// EPSG:5936 (Alaska Polar Stereographic) tile grid configuration
// Based on ArcGIS Arctic Ocean Base/Reference service metadata
// Limited to zoom 0-10 for overzooming (tiles not available everywhere beyond zoom 10)
const arcticTileGrid = new TileGrid({
  origin: [-28567784.109255, 32567784.109255],
  resolutions: [
    238810.813354,
    119405.406677,
    59702.7033384999,
    29851.3516692501,
    14925.675834625,
    7462.83791731252,
    3731.41895865626,
    1865.70947932813,
    932.854739664063,
    466.427369832032,
    233.213684916016 // Zoom 10 - last resolution, enables overzooming beyond this
  ],
  tileSize: [256, 256]
})

// EPSG:3413 (NSIDC Sea Ice Polar Stereographic North) tile grid configuration
// Based on ArcGIS Arctic Imagery service metadata
const nsidcTileGrid = new TileGrid({
  origin: [-4194304, 4194304],
  resolutions: [16384, 8192, 4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1, 0.5],
  tileSize: [256, 256]
})

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
    init_opacity: 1,
    max_zoom: 19
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
    init_opacity: 1,
    max_zoom: 19
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
    init_opacity: 1,
    max_zoom: 19
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
    allowed_reprojections: ['EPSG:5936', 'EPSG:4326'],
    init_visibility: true,
    init_opacity: 1,
    max_zoom: 23
  },
  'Arctic Imagery NSIDC': {
    title: 'Arctic Imagery NSIDC',
    type: 'xyz',
    isBaseLayer: true,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Imagery/MapServer/tile/{z}/{y}/{x}',
    attributionKey: 'esri',
    source_projection: 'EPSG:5936', // Actual projection of ArcGIS Arctic Imagery tiles
    allowed_reprojections: ['EPSG:5936', 'EPSG:3413'], // Allow use in both projections
    init_visibility: true,
    init_opacity: 1,
    max_zoom: 23
  },
  'NASA GIBS HLS Arctic': {
    title: 'NASA GIBS HLS Arctic',
    type: 'xyz',
    isBaseLayer: false,
    // NASA GIBS Harmonized Landsat Sentinel-2 (HLS) - 30m resolution Arctic imagery
    // Using RESTful WMTS endpoint for tile access
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3413/best/HLS_S30_Nadir_BRDF_Adjusted_Reflectance/default/2024-01-01/250m/{z}/{y}/{x}.jpg',
    attributionKey: 'nasa_gibs',
    source_projection: 'EPSG:3413',
    allowed_reprojections: ['EPSG:3413'],
    init_visibility: false,
    init_opacity: 0.7,
    max_zoom: 15
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
    allowed_reprojections: ['EPSG:5936'],
    init_visibility: true,
    init_opacity: 1,
    max_zoom: 23
  },
  // 'Arctic Reference NSIDC': {
  //   title: 'Arctic Reference NSIDC',
  //   type: 'xyz',
  //   isBaseLayer: false,
  //   // Note: Arctic Connect tiles appear to be unavailable or using incompatible tile scheme
  //   // url: 'https://tiles.arcticconnect.ca/osm_3413/{z}/{x}/{y}.png',
  //   url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Imagery/MapServer/tile/{z}/{y}/{x}',
  //   attributionKey: 'esri',
  //   source_projection: 'EPSG:3413',
  //   allowed_reprojections: ['EPSG:3413'],
  //   init_visibility: true,
  //   init_opacity: 0.3
  // },
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
    init_opacity: 1,
    serverType: 'mapserver',
    max_zoom: 10
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
    init_opacity: 0.9
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
    // Temporarily disable caching to debug black screen issue
    // const mapStore = useMapStore()
    // const cachedLayer = mapStore.getLayerFromCache(projectionName, title)
    const cachedLayer = null
    let lname = srLayer.title
    if (srLayer.isBaseLayer) {
      lname = 'Base Layer'
    } else {
      lname = srLayer.layerName || srLayer.title
    }
    const localTileLayerOptions: any = {
      title: title,
      name: lname,
      opacity: srLayer.init_opacity,
      visible: srLayer.init_visibility
    }

    // Set maxZoom on layer if specified in layer definition
    if (srLayer.max_zoom !== undefined) {
      localTileLayerOptions.maxZoom = srLayer.max_zoom
      console.log('[SrLayers] Setting layer maxZoom:', {
        layerTitle: title,
        layerMaxZoom: srLayer.max_zoom,
        sourceProjection: srLayer.source_projection
      })
    }
    if (cachedLayer) {
      layerInstance = cachedLayer // Return the cached layer if it exists
      logger.debug('Using cached layer', { title, projectionName })
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
        // Disable tile wrapping for polar projections
        const isPolarProjection =
          srLayer.source_projection === 'EPSG:5936' ||
          srLayer.source_projection === 'EPSG:3413' ||
          srLayer.source_projection === 'EPSG:3031'
        const xyzOptions: any = {
          url: srLayer.url,
          //extent: mapStore.extent,
          projection: srLayer.source_projection,
          attributions: srAttributions[srLayer.attributionKey],
          wrapX: !isPolarProjection // Don't wrap tiles for polar projections
        }
        // Add custom tile grid for EPSG:5936 to ensure proper tile loading
        if (srLayer.source_projection === 'EPSG:5936') {
          xyzOptions.tileGrid = arcticTileGrid
          // Set source maxZoom to 10 to enable overzooming beyond tile availability
          // The layer maxZoom (23) controls view limits, but tiles are only requested up to zoom 10
          // When zooming beyond 10, OpenLayers will scale/stretch the zoom 10 tiles
          xyzOptions.maxZoom = 10
          console.log('[SrLayers] EPSG:5936 configured for overzooming:', {
            layerTitle: title,
            layerMaxZoom: srLayer.max_zoom,
            sourceMaxZoom: 10,
            tileGridResolutions: arcticTileGrid.getResolutions().length,
            overzooming: 'enabled beyond zoom 10'
          })
        }
        // Add custom tile grid for EPSG:3413 ArcGIS tiles only (not for OSM tiles)
        if (srLayer.source_projection === 'EPSG:3413' && srLayer.url.includes('arcgisonline')) {
          xyzOptions.tileGrid = nsidcTileGrid
          // Set maxZoom on source if defined in layer
          if (srLayer.max_zoom !== undefined) {
            xyzOptions.maxZoom = srLayer.max_zoom
            console.log('[SrLayers] Setting EPSG:3413 source maxZoom:', {
              layerTitle: title,
              sourceMaxZoom: srLayer.max_zoom,
              tileGridResolutions: nsidcTileGrid.getResolutions().length
            })
          }
        }

        // Create XYZ source with tile load debugging for polar projections
        const xyzSource = new XYZ(xyzOptions)

        // Add tile load debugging for EPSG:5936
        if (srLayer.source_projection === 'EPSG:5936') {
          xyzSource.on('tileloaderror', (event: any) => {
            const tile = event.tile
            const tileCoord = tile.getTileCoord()
            console.error('[SrLayers] EPSG:5936 Tile load error:', {
              layerTitle: title,
              zoom: tileCoord[0],
              x: tileCoord[1],
              y: tileCoord[2],
              url: tile.src_
            })
          })

          // Log tile URL requests at zoom > 7
          const originalTileUrlFunction = xyzSource.getTileUrlFunction()
          xyzSource.setTileUrlFunction((tileCoord: any, pixelRatio: any, projection: any) => {
            const zoom = tileCoord[0]
            const url = originalTileUrlFunction?.call(xyzSource, tileCoord, pixelRatio, projection)
            if (zoom > 7) {
              console.log('[SrLayers] EPSG:5936 Requesting tile:', {
                zoom,
                x: tileCoord[1],
                y: tileCoord[2],
                url
              })
            }
            return url
          })
        }

        layerInstance = new TileLayer({
          source: xyzSource,
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
        // Temporarily disable caching to debug black screen issue
        // mapStore.addLayerToCache(projectionName, title, layerInstance)
      }
    }
    //console.log (`getLayer returning: ${lname} isBaseLayer:${srLayer.isBaseLayer} title:${title}`);
  } else {
    logger.debug('Layer not found with this title', { title })
  }
  //console.log('getLayer returning:', layerInstance);
  return layerInstance
}
